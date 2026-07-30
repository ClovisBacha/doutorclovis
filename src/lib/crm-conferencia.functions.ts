/**
 * Conferência do CRM no conselho.
 *
 * PRECISO SER DIRETO SOBRE O QUE ISTO É E O QUE NÃO É.
 *
 * O CFM e os CRMs estaduais **não publicam API oficial**. O portal de busca é
 * uma página com proteção anti-robô, e raspá-la de uma função de servidor é
 * frágil (quebra quando mudam o HTML) e de legalidade duvidosa. Fingir que dá
 * seria pior do que não ter: um selo "✓ verificado" que na verdade não verificou
 * nada é ativamente perigoso — a paciente confia nele para escolher quem vai
 * acompanhar a gestação dela.
 *
 * Então o que existe aqui é a INFRAESTRUTURA, com um provedor plugável:
 *
 * - Com `CRM_LOOKUP_URL` configurada (um serviço de consulta ao CFM, pago ou
 *   próprio), a conferência acontece de verdade e o resultado é gravado.
 * - Sem ela, a resposta é `indisponivel` — e a tela diz exatamente isso, nunca
 *   "verificado".
 *
 * O selo continua sendo `verified`, que só o super-admin escreve. O que estas
 * colunas fazem é dar a ele o que olhar antes de apertar o botão: o nome que o
 * conselho devolveu e a situação do registro.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ResultadoCrm =
  | { status: "confirmado"; nome: string; situacao: string; especialidade?: string }
  | { status: "nao_encontrado" }
  | { status: "indisponivel"; motivo: "sem_provedor" | "falhou" };

/**
 * Consulta o provedor externo.
 *
 * O contrato esperado é deliberadamente simples, para caber em qualquer serviço:
 * `GET {CRM_LOOKUP_URL}?uf=MG&numero=12345` devolvendo
 * `{ nome, situacao, especialidade }` — ou 404 para não encontrado.
 * Trocar de provedor é trocar a URL e, no máximo, o mapeamento abaixo.
 */
async function consultarProvedor(uf: string, numero: string): Promise<ResultadoCrm> {
  const base = process.env.CRM_LOOKUP_URL;
  if (!base) return { status: "indisponivel", motivo: "sem_provedor" };
  try {
    const url = `${base}${base.includes("?") ? "&" : "?"}uf=${encodeURIComponent(uf)}&numero=${encodeURIComponent(numero)}`;
    const corta = new AbortController();
    // 8s: é uma consulta a terceiro dentro de um handler com teto de 30s.
    const alarme = setTimeout(() => corta.abort(), 8000);
    try {
      const res = await fetch(url, {
        signal: corta.signal,
        headers: process.env.CRM_LOOKUP_TOKEN
          ? { Authorization: `Bearer ${process.env.CRM_LOOKUP_TOKEN}` }
          : undefined,
      });
      if (res.status === 404) return { status: "nao_encontrado" };
      if (!res.ok) return { status: "indisponivel", motivo: "falhou" };
      const j = (await res.json()) as {
        nome?: string;
        situacao?: string;
        especialidade?: string;
      };
      if (!j?.nome) return { status: "nao_encontrado" };
      return {
        status: "confirmado",
        nome: String(j.nome).trim(),
        situacao: String(j.situacao ?? "").trim(),
        especialidade: j.especialidade ? String(j.especialidade).trim() : undefined,
      };
    } finally {
      clearTimeout(alarme);
    }
  } catch {
    return { status: "indisponivel", motivo: "falhou" };
  }
}

/** Compara nomes ignorando acento, caixa e partículas ("de", "da", "dos"). */
function nomesBatem(a: string, b: string): boolean {
  const limpar = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/^(dr|dra)\.?\s+/i, "")
      .split(/\s+/)
      .filter((p) => p.length > 2 && !["de", "da", "do", "das", "dos"].includes(p));
  const pa = limpar(a);
  const pb = limpar(b);
  if (!pa.length || !pb.length) return false;
  /* Primeiro e último nome batendo já é suficiente: o conselho costuma trazer o
     nome completo e o médico cadastra o nome pelo qual é conhecido. Exigir
     igualdade exata reprovaria quase todo mundo. */
  return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
}

/**
 * Confere o CRM do médico logado e grava o resultado.
 *
 * Nunca bloqueia nada: é informação para ele e para quem aprova o selo. Um
 * conselho fora do ar não pode impedir um médico de trabalhar.
 */
export const conferirMeuCrm = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, resultado: null };

    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("crm,display_name")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!doc?.crm) return { ok: false as const, resultado: null };

    const { separarCrm } = await import("./crm");
    const { uf, numero } = separarCrm(doc.crm as string);
    if (!uf || !numero) return { ok: false as const, resultado: null };

    const r = await consultarProvedor(uf, numero);

    /* Só grava quando houve resposta REAL do conselho. Um "indisponível" não
       pode apagar uma conferência boa de ontem — nem virar carimbo de hoje. */
    if (r.status === "confirmado" || r.status === "nao_encontrado") {
      try {
        await (supabaseAdmin as any)
          .from("doctors")
          .update({
            crm_conferido_em: new Date().toISOString(),
            crm_conferido_nome: r.status === "confirmado" ? r.nome : null,
            crm_conferido_situacao: r.status === "confirmado" ? r.situacao : "não encontrado",
          })
          .eq("id", u.user.id);
      } catch {
        /* coluna ainda não migrada: a resposta abaixo ainda serve na tela */
      }
    }

    return {
      ok: true as const,
      resultado: r,
      /* O alerta que importa para quem aprova: o conselho respondeu OUTRO nome.
         Não é necessariamente fraude — nome de casada, abreviação — mas é
         exatamente o que um humano precisa olhar antes de dar o selo. */
      nomeDivergente:
        r.status === "confirmado" && !nomesBatem(r.nome, (doc.display_name as string) ?? ""),
    };
  });
