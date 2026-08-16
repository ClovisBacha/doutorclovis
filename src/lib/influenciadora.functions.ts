/**
 * O CÓDIGO DA INFLUENCIADORA, ATRIBUÍDO NO CADASTRO — e o bônus de boas-vindas.
 *
 * ─── O QUE FALTAVA, E POR QUE IMPORTA ───────────────────────────────────────
 *
 * O motor de afiliados já existia inteiro: `?ref=CODIGO` é guardado 90 dias no
 * navegador (`useAffiliateCapture`), o checkout carimba `ref_code` na paciente
 * e a metadata da Stripe, e cada fatura PAGA credita 50% em `affiliate_earnings`.
 *
 * ⚠️ MAS `ref_code` SÓ ERA ESCRITO NO CHECKOUT. Quem chegava pela influenciadora
 * e não assinava não existia para ela: o relatório contava só quem pagou, e a
 * pergunta que toda criadora faz primeiro — "quantas pessoas eu trouxe?" — não
 * tinha resposta. Pior, a atribuição dependia de a paciente assinar ANTES de os
 * 90 dias do navegador vencerem; trocar de celular no meio apagava a indicação.
 *
 * Agora a atribuição acontece na PRIMEIRA VISITA LOGADA, como a indicação entre
 * amigas. O checkout continua carimbando (é ele que fala com a Stripe), e a
 * escrita continua sendo `.is("ref_code", null)` — primeiro código vence.
 *
 * ─── ⚠️ `ref_code` E `referred_by` SÃO COLUNAS DIFERENTES, DE PROPÓSITO ──────
 *
 * A proposta original era gravar o código da influenciadora em `referred_by`.
 * Isso teria um efeito que não se vê de imediato: `referred_by` NÃO é um
 * registro de origem, é o GRAFO DE AMIZADE — `saoAmigas` decide quem enxerga o
 * Cantinho de quem exatamente por ele
 * (`minha.referred_by === outra || dela.referred_by === eu`).
 *
 * Uma influenciadora com três mil seguidoras viraria "amiga" de três mil
 * gestantes: apareceria na lista de Amigas de cada uma, poderia visitar o
 * Cantinho, formar dupla de sequência e receber presente. E como `referred_by` é
 * fixado UMA VEZ e nunca reescrito, o código da influenciadora queimaria a
 * indicação de uma amiga de verdade — ou o contrário, conforme quem chegasse
 * antes.
 *
 * São dois relacionamentos diferentes que por acaso começam do mesmo jeito.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { grantSementinhas } from "@/lib/sementinhas.functions";
import { isCareModeActive } from "@/lib/care-mode.functions";
import { BONUS_INFLUENCIADORA } from "@/lib/economia-sementinhas";

/** A razão no ledger — nunca escrita à mão em outro lugar. */
export const RAZAO_BONUS_INFLUENCIADORA = "bonus-influenciadora";

/**
 * Normaliza como o `useAffiliateCapture` do `__root` já normaliza: maiúsculas,
 * só letras, números, `_` e `-`.
 *
 * ⚠️ O conjunto de caracteres é o MESMO da captura do link. Se divergir, um
 * código digitado à mão no onboarding não acha a linha que o link acharia — e a
 * paciente veria "código não encontrado" para um código que existe.
 */
function normaliza(cru: string): string {
  return cru
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
}

export const atribuirInfluenciadora = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), codigo: z.string().min(3).max(24) }).parse(i),
  )
  .handler(async ({ data }) => {
    const codigo = normaliza(data.codigo);
    if (codigo.length < 3) return { ok: true as const, atribuido: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ E-MAIL CONFIRMADO, como em `attributeReferral`. Uma conta apenas criada
       não credita ninguém: sem isso, criar contas com e-mails inventados seria
       uma torneira de Sementinhas — e Sementinha compra item de verdade na loja.
       `repetir` mantém o código guardado no navegador até ela confirmar. */
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "nao_autenticado" as const };
    const confirmado = Boolean(
      u.user.email_confirmed_at ?? (u.user as { confirmed_at?: string | null }).confirmed_at,
    );
    if (!confirmado) return { ok: true as const, atribuido: false, repetir: true };
    const uid = u.user.id;

    /* O código existe e está ATIVO? Um código desligado não atribui e não paga
       — e a paciente precisa saber disso na hora, senão ela digita, vê "pronto"
       e nunca recebe o bônus. */
    let ativo = false;
    try {
      const { data: aff } = await sb
        .from("affiliates")
        .select("code,active")
        .eq("code", codigo)
        .maybeSingle();
      ativo = Boolean(aff?.active);
    } catch {
      /* tabela ausente (banco sem o SQL de afiliados) — segue sem atribuir */
    }
    if (!ativo) return { ok: true as const, atribuido: false, invalido: true };

    const { data: eu } = await sb
      .from("patient_profiles")
      .select("ref_code")
      .eq("id", uid)
      .maybeSingle();
    /* Perfil ainda não criado (recém-chegada): pede para tentar de novo. */
    if (!eu) return { ok: true as const, atribuido: false, repetir: true };
    if (eu.ref_code) return { ok: true as const, atribuido: false, jaTinha: true };

    /* ⚠️ `.is("ref_code", null)` na CONDIÇÃO, não só na leitura acima: entre ler
       e escrever cabe o checkout gravando o dele. Quem chegar primeiro vence, e
       a segunda escrita não devolve linha — que é como sabemos que não valeu. */
    const { data: gravou, error: gravouErr } = await sb
      .from("patient_profiles")
      .update({ ref_code: codigo })
      .eq("id", uid)
      .is("ref_code", null)
      .select("id");
    if (gravouErr) {
      console.error("[influenciadora] atribuição recusada pelo banco", uid, gravouErr);
      return { ok: true as const, atribuido: false, repetir: true };
    }
    if (!gravou || gravou.length === 0) return { ok: true as const, atribuido: false };

    /* ⚠️ O BÔNUS VEM DEPOIS DA ATRIBUIÇÃO, e falhar aqui não desfaz nada: a
       indicação já está fixada e a comissão dela está garantida. Melhor a
       paciente ficar sem o presente (que a tela pode reoferecer) do que a
       influenciadora perder a venda.

       Fora do Modo Cuidado: quem acabou de perder a gestação não recebe festa de
       boas-vindas. A `dedupeKey` é por CÓDIGO, então um segundo código nunca
       paga de novo — e como `ref_code` é fixado uma vez, isso é cinto e
       suspensório sobre o mesmo risco. */
    let bonus = 0;
    try {
      if (!(await isCareModeActive(supabaseAdmin, uid))) {
        await grantSementinhas(typedDb(supabaseAdmin), uid, [
          {
            amount: BONUS_INFLUENCIADORA,
            reason: RAZAO_BONUS_INFLUENCIADORA,
            dedupeKey: `influenciadora:${uid}:${codigo}`,
          },
        ]);
        bonus = BONUS_INFLUENCIADORA;
      }
    } catch (e) {
      console.error("[influenciadora] bônus não creditado", uid, e);
    }

    return { ok: true as const, atribuido: true, bonus, codigo };
  });

/* ══════════════════ O PAINEL DELA — o que ela trouxe e quanto ganhou ══════════════════ */

export type GanhoDaInfluenciadora = {
  quando: string;
  comissaoCentavos: number;
  pagoCentavos: number;
};

export type PainelDaInfluenciadora = {
  nome: string;
  codigo: string;
  ativa: boolean;
  comissaoPct: number;
  /** Quantas contas de gestante carregam o código dela. */
  cadastros: number;
  /** Soma de tudo que ela já ganhou, em centavos. */
  totalCentavos: number;
  /** O que entrou nos últimos 30 dias. */
  mesCentavos: number;
  /** As últimas comissões, da mais recente para a mais antiga. */
  ultimos: GanhoDaInfluenciadora[];
};

/**
 * O PAINEL DA INFLUENCIADORA, pela conta dela.
 *
 * ⚠️ QUEM DECIDE DE QUEM SÃO OS NÚMEROS É O E-MAIL DA SESSÃO, nunca um código
 * vindo do cliente. Se a tela mandasse o código e o servidor confiasse, bastaria
 * trocar uma letra na requisição para ler o faturamento de outra criadora. É a
 * mesma regra de `contatoDaPaciente` no painel do médico: confere o vínculo
 * ANTES de ler qualquer coisa.
 *
 * ⚠️ E A COMPARAÇÃO É EM MINÚSCULAS dos dois lados — ver o SQL. O Supabase
 * guarda o e-mail como a pessoa digitou.
 */
export const meuPainelDeInfluenciadora = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u.user?.email?.trim().toLowerCase();
    if (!email) return { ok: false as const, error: "nao_autenticado" as const };

    const sb = supabaseAdmin as any;
    let linha: {
      code: string;
      name: string;
      commission_pct: number;
      active: boolean;
    } | null = null;
    try {
      const { data: r } = await sb
        .from("affiliates")
        .select("code,name,commission_pct,active,email")
        .ilike("email", email)
        .maybeSingle();
      linha = r ?? null;
    } catch {
      /* coluna/tabela ausente (SQL não aplicado) → trata como "não é afiliada" */
    }
    /* ⚠️ "Não é afiliada" NÃO é erro. É o caso de longe mais comum — qualquer
       gestante logada que abrir a URL — e devolver erro faria a tela mostrar
       "algo deu errado" para um estado perfeitamente normal. */
    if (!linha) return { ok: true as const, painel: null };

    const codigo = linha.code;

    /* Os cadastros: contas de gestante que carregam o código dela. Nasce do
       `ref_code`, que agora é escrito no CADASTRO e não só no checkout — antes
       este número só enxergava quem tinha pago. */
    let cadastros = 0;
    try {
      const { count } = await sb
        .from("patient_profiles")
        .select("id", { count: "exact", head: true })
        .eq("ref_code", codigo);
      cadastros = count ?? 0;
    } catch {
      /* segue com zero — o resto do painel continua verdadeiro */
    }

    let total = 0;
    let mes = 0;
    const ultimos: GanhoDaInfluenciadora[] = [];
    try {
      const { data: ganhos } = await sb
        .from("affiliate_earnings")
        .select("commission_cents,amount_paid_cents,created_at")
        .eq("affiliate_code", codigo)
        .order("created_at", { ascending: false })
        .limit(500);
      const corte = Date.now() - 30 * 86400000;
      for (const g of (ganhos ?? []) as {
        commission_cents: number;
        amount_paid_cents: number;
        created_at: string;
      }[]) {
        const c = g.commission_cents ?? 0;
        total += c;
        if (new Date(g.created_at).getTime() >= corte) mes += c;
        if (ultimos.length < 20)
          ultimos.push({
            quando: g.created_at,
            comissaoCentavos: c,
            pagoCentavos: g.amount_paid_cents ?? 0,
          });
      }
    } catch {
      /* tabela ausente → painel com os cadastros e zero em dinheiro */
    }

    return {
      ok: true as const,
      painel: {
        nome: linha.name,
        codigo,
        ativa: Boolean(linha.active),
        comissaoPct: linha.commission_pct ?? 50,
        cadastros,
        totalCentavos: total,
        mesCentavos: mes,
        ultimos,
      } satisfies PainelDaInfluenciadora,
    };
  });
