import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * QUANTAS DENÚNCIAS ESPERAM — o número que impede a fila de crescer calada.
 *
 * ⚠️ **A fila vivia dentro da aba de entrada e não tinha contador em lugar
 * nenhum.** Quem estivesse noutra aba não tinha como saber que ela cresceu — e
 * uma denúncia de risco clínico pode esperar semanas sem nada apitar. Agora o
 * número sobe para a fita de abas, que é onde o painel já chama o médico para o
 * trabalho que ainda precisa dele.
 *
 * ⚠️ **CONTA AS DUAS FILAS, com os MESMOS filtros que as telas usam.** Um
 * número que diga 3 sobre uma lista de 2 faz o médico procurar uma denúncia
 * fantasma, e na terceira vez ele para de acreditar no número. A da rede é
 * `resolvido_em IS NULL`; a da caixinha é `denunciado_em NOT NULL` e
 * `resolvido_em IS NULL` — exatamente o que `denunciasDaRede` e
 * `denunciasAbertas` filtram.
 *
 * ⚠️ **`head: true`: conta sem trazer uma linha.** O corpo de uma denúncia tem
 * o trecho congelado do que foi dito, e ele não precisa viajar para virar um
 * número numa fita de abas.
 *
 * ⚠️ **Falha ao contar devolve `null`, nunca zero.** Zero AFIRMA que a fila
 * está limpa — é a frase mais perigosa que um painel de moderação pode dizer
 * errado, e faria o médico deixar de abrir a tela.
 */
export const contarDenunciasAbertas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u.user?.email?.trim().toLowerCase();
    const permitidos = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !permitidos.includes(email)) {
      return { ok: false as const, motivo: "sem_acesso" as const };
    }

    const sb = supabaseAdmin as any;
    const [rede, caixinha] = await Promise.all([
      sb
        .from("rede_denuncias")
        .select("id", { count: "exact", head: true })
        .is("resolvido_em", null),
      sb
        .from("rede_perguntas")
        .select("id", { count: "exact", head: true })
        .not("denunciado_em", "is", null)
        .is("resolvido_em", null),
    ]);

    /* ⚠️ Tabela ausente NÃO é falha de contagem — num banco atrás das
       migrations simplesmente não há denúncia daquela espécie ainda. Falha de
       verdade (rede fora, permissão) vira `null`, e a fita não desenha número
       nenhum em vez de afirmar "está limpo". */
    const conta = (r: { count: number | null; error: unknown }) => {
      const codigo = (r.error as { code?: string } | null)?.code;
      if (r.error && codigo !== "42P01") return null;
      return r.count ?? 0;
    };
    const a = conta(rede);
    const b = conta(caixinha);
    if (a === null || b === null) return { ok: true as const, total: null };
    return { ok: true as const, total: a + b };
  });

/**
 * A FICHA DE MODERAÇÃO DE UMA CONTA — e a linha que ela NÃO atravessa.
 *
 * ⚠️ **DADO PARA MODERAR, NUNCA PARA NAVEGAR.** A tentação óbvia é dar ao
 * administrador uma tela com tudo que a paciente publicou: seria fácil, e
 * transformaria a moderação em vigilância. A Comunidade é onde ela escreve para
 * o público que ELA escolheu; ler o que ninguém denunciou é uma capacidade que
 * este produto não precisa ter e que ninguém pediu.
 *
 * O que volta aqui é o que a decisão exige: **quantas denúncias**, **como
 * terminaram**, **desde quando a conta existe**, **em que estado ela está** — e
 * os TRECHOS QUE JÁ FORAM DENUNCIADOS, que o administrador já teria visto na
 * fila de qualquer jeito.
 *
 * ⚠️ **Decidir "avisar" ou "remover" sem isto é decidir às cegas**: a fila
 * mostra uma linha, e a mesma conta pode ter outras cinco resolvidas na semana
 * passada. A reincidência já aparecia como número; a ficha diz o que aconteceu.
 */
export const fichaDeModeracao = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), contaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u.user?.email?.trim().toLowerCase();
    const permitidos = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !permitidos.includes(email)) {
      return { ok: false as const, motivo: "sem_acesso" as const };
    }

    const sb = supabaseAdmin as any;
    const [denuncias, perfil] = await Promise.all([
      sb
        .from("rede_denuncias")
        .select("alvo, motivo, trecho, criado_em, resolvido_em, desfecho")
        .eq("denunciada_id", data.contaId)
        .order("criado_em", { ascending: false })
        .limit(50),
      /* ⚠️ Só o ESTADO da conta. Nem bio, nem foto, nem semana: nada disso
         muda uma decisão de moderação, e tudo isso é dado da paciente. */
      sb
        .from("patient_profiles")
        .select("display_name, perfil_publico, care_mode, rede_pausada_em, created_at")
        .eq("id", data.contaId)
        .maybeSingle(),
    ]);

    if (denuncias.error) return { ok: false as const, motivo: "banco" as const };

    type Linha = {
      alvo: string;
      motivo: string;
      trecho: string | null;
      criado_em: string;
      resolvido_em: string | null;
      desfecho: string | null;
    };
    const linhas = (denuncias.data ?? []) as Linha[];
    const p = (perfil.data ?? null) as {
      display_name?: string | null;
      perfil_publico?: boolean | null;
      care_mode?: boolean | null;
      rede_pausada_em?: string | null;
      created_at?: string | null;
    } | null;

    return {
      ok: true as const,
      ficha: {
        nome: p?.display_name?.trim() || "Sem nome",
        /* ⚠️ O estado que muda a decisão: uma conta em Modo Cuidado já está
           fora da rede, e "suspender" seria punir quem acabou de perder a
           gestação. */
        emCuidado: !!p?.care_mode,
        pausada: !!p?.rede_pausada_em,
        publica: !!p?.perfil_publico,
        desde: p?.created_at ?? null,
        abertas: linhas.filter((l) => !l.resolvido_em).length,
        total: linhas.length,
        porDesfecho: {
          removido: linhas.filter((l) => l.desfecho === "removido").length,
          avisado: linhas.filter((l) => l.desfecho === "avisado").length,
          sem_acao: linhas.filter((l) => l.desfecho === "sem_acao").length,
        },
        historico: linhas.slice(0, 20).map((l) => ({
          alvo: l.alvo,
          motivo: l.motivo,
          trecho: l.trecho,
          quando: l.criado_em,
          desfecho: l.desfecho,
          resolvida: !!l.resolvido_em,
        })),
      },
    };
  });

/**
 * OS NÚMEROS DA COMUNIDADE — a aba está viva?
 *
 * ⚠️ **SÃO CONTAGENS, e nunca uma amostra do conteúdo.** `head: true` em todas:
 * nenhum texto de paciente viaja para virar um número num painel.
 *
 * ⚠️ **Falha em qualquer linha vira `null` NAQUELA linha, e não zero.** Um
 * painel que diga "0 publicações esta semana" sobre uma leitura que falhou faz
 * o dono concluir que a aba morreu — e a decisão que ele tomaria a partir disso
 * é grande.
 */
export const numerosDaComunidade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u.user?.email?.trim().toLowerCase();
    const permitidos = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !permitidos.includes(email)) {
      return { ok: false as const, motivo: "sem_acesso" as const };
    }

    const sb = supabaseAdmin as any;
    const seteDias = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const conta = (r: { count: number | null; error: unknown }) => {
      const codigo = (r.error as { code?: string } | null)?.code;
      /* Tabela ausente num banco atrás das migrations não é falha: é zero. */
      if (r.error && codigo !== "42P01") return null;
      return r.count ?? 0;
    };

    const [posts, postsSemana, stories, comentarios, publicos, denunciasSemana] = await Promise.all(
      [
        sb.from("rede_posts").select("id", { count: "exact", head: true }).is("arquivado_em", null),
        sb
          .from("rede_posts")
          .select("id", { count: "exact", head: true })
          .is("arquivado_em", null)
          .gte("criado_em", seteDias),
        sb
          .from("rede_stories")
          .select("id", { count: "exact", head: true })
          .gte("criado_em", seteDias),
        sb
          .from("rede_comentarios")
          .select("id", { count: "exact", head: true })
          .is("apagado_em", null)
          .gte("criado_em", seteDias),
        sb
          .from("patient_profiles")
          .select("id", { count: "exact", head: true })
          .eq("perfil_publico", true),
        sb
          .from("rede_denuncias")
          .select("id", { count: "exact", head: true })
          .gte("criado_em", seteDias),
      ],
    );

    return {
      ok: true as const,
      numeros: {
        publicacoes: conta(posts),
        publicacoesNaSemana: conta(postsSemana),
        storiesNaSemana: conta(stories),
        comentariosNaSemana: conta(comentarios),
        perfisPublicos: conta(publicos),
        denunciasNaSemana: conta(denunciasSemana),
      },
    };
  });
