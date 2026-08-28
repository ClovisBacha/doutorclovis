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
        .select(
          "display_name, perfil_publico, care_mode, rede_pausada_em, rede_suspensa_em, created_at",
        )
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
      rede_suspensa_em?: string | null;
      rede_suspensa_motivo?: string | null;
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
        suspensa: !!p?.rede_suspensa_em,
        /* ⚠️ **O MOTIVO É LIDO, e não só gravado.** Uma coluna escrita que
           ninguém lê é dívida com cara de recurso — e foi a catraca de
           `escrita-tem-leitor` que pegou esta, minutos depois de eu a criar.
           Aqui ele serve para quem abre a ficha DEPOIS: sem ele, "suspensa" não
           diz por quê, e rever a decisão vira adivinhação. */
        suspensaPor: p?.rede_suspensa_motivo ?? null,
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

/**
 * SUSPENDER UMA CONTA DA COMUNIDADE — o degrau acima de remover uma peça.
 *
 * ⚠️ **A fila só sabia tirar UMA publicação por vez.** Uma conta que reincide
 * continua publicando, e a única saída era remover peça por peça enquanto ela
 * produz mais. Isso não é moderação, é enxugar gelo.
 *
 * ⚠️ **SUSPENSA ≠ EM LUTO ≠ PAUSADA, e as três somem do mesmo jeito.**
 * `foraDaRede` é a régua única; a suspensão entra nela e não em vinte e seis
 * `if`. O que a distingue é quem decidiu — e por isso ela é a ÚNICA das três em
 * que a pessoa É AVISADA: pausa e luto são escolha dela; suspensão é decisão da
 * plataforma, e uma conta que some sem explicação lê como app quebrado.
 *
 * ⚠️ **NUNCA suspende quem está em Modo Cuidado.** Ela já está fora da rede, e
 * suspender seria punir quem acabou de perder a gestação por algo que ela pode
 * ter escrito antes. A ficha mostra esse estado justamente para o administrador
 * ver antes de decidir; aqui o servidor recusa, porque tela não é trava.
 *
 * ⚠️ **É REVERSÍVEL, e o motivo é catálogo fechado** — campo livre aqui vira o
 * texto que a paciente lê sobre si mesma, escrito às pressas.
 */
export const suspenderDaComunidade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        contaId: z.string().uuid(),
        suspender: z.boolean(),
        motivo: z.enum(["saude", "assedio", "spam", "imagem", "outro"]).optional(),
      })
      .parse(i),
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

    if (data.suspender) {
      /* ⚠️ O ESTADO É CONFERIDO NO BANCO, e não vem do corpo do pedido: a tela
         mostra a ficha, mas quem decide é isto. */
      const { data: p, error: erroP } = await sb
        .from("patient_profiles")
        .select("care_mode")
        .eq("id", data.contaId)
        .maybeSingle();
      /* ⚠️ Não consegui ler = NÃO suspende. O pior caso aqui é uma suspensão
         adiada; o oposto é suspender quem está de luto. */
      if (erroP || !p) return { ok: false as const, motivo: "banco" as const };
      if ((p as { care_mode?: boolean }).care_mode) {
        return { ok: false as const, motivo: "em_cuidado" as const };
      }
    }

    const { error } = await sb
      .from("patient_profiles")
      .update({
        rede_suspensa_em: data.suspender ? new Date().toISOString() : null,
        rede_suspensa_motivo: data.suspender ? (data.motivo ?? "outro") : null,
      })
      .eq("id", data.contaId);
    if (error) {
      console.warn("[rede] sem rede_suspensa_em — rode APLICAR_SUSPENDER_DA_REDE.sql");
      return { ok: false as const, motivo: "sem_suporte" as const };
    }

    /* ⚠️ **ELA É AVISADA, e é o que separa suspensão de sumiço.** Uma conta que
       some da Comunidade sem uma palavra faz a paciente concluir que o app
       quebrou — e num app de gestação ela tem coisa melhor para fazer do que
       investigar isso. O push não diz o motivo: o texto completo mora na tela
       dela, e a tela de bloqueio do celular é o pior contexto que existe.

       Só ao SUSPENDER: o "voltou" chega quando ela abrir e encontrar a aba
       inteira de novo, que é a notícia se dando sozinha. */
    if (data.suspender) {
      try {
        const { sendPushToUser } = await import("@/lib/push.server");
        await sendPushToUser(data.contaId, {
          title: "Comunidade",
          body: "Sua conta da Comunidade está temporariamente indisponível. Toque para entender.",
          url: "/minha-conta?tab=Comunidade",
        });
      } catch {
        /* O aviso é acessório; a suspensão já valeu. */
      }
    }

    /* ─── A LINHA DE AUDITORIA ────────────────────────────────────────────
     *
     * ⚠️ **A DUAS AÇÕES MAIS GRAVES DO ADMIN NÃO DEIXAVAM RASTRO.** Trocar o
     * plano de um médico, criar um cupom, publicar um comunicado — tudo isso
     * grava em `audit_log`. Tirar uma paciente da Comunidade, não.
     *
     * Isso importa em três momentos concretos: quando ela pergunta por que
     * sumiu (e ninguém sabe quem decidiu, quando, nem por quê), quando é
     * preciso reverter (e não há o que reverter para), e numa disputa — onde
     * **a ausência de linha é lida como "a ação não aconteceu"**, que é
     * exatamente o que o log existe para desmentir.
     *
     * `writeAudit` é best-effort e NUNCA lança: uma falha de log não pode
     * derrubar a suspensão em si. Ela vai DEPOIS do `update`, senão gravaria
     * uma ação que não aconteceu. */
    const { writeAudit } = await import("./audit.server");
    await writeAudit(
      { id: u.user?.id, email },
      data.suspender ? "comunidade.suspender" : "comunidade.reativar",
      data.contaId,
      { motivo: data.suspender ? (data.motivo ?? "outro") : null },
    );
    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   A REINCIDÊNCIA CLÍNICA — o leitor que a tabela nunca teve
   ══════════════════════════════════════════════════════════════════════════ */

export type GrupoDeBarradas = ReturnType<
  typeof import("./triagem-barrada").agruparPorPessoa
>[number];

/**
 * ⚠️ **`rede_triagem_barrada` ERA ESCRITA EM SETE PONTOS E LIDA EM NENHUM.**
 *
 * `anotarBarrada` grava desde que o rastro nasceu — post, story, comentário,
 * bio, resposta da caixinha, nota — e a régua `agruparPorPessoa` existia pura,
 * testada, com o limiar de três repetições documentado… e com zero chamadores.
 * O sinal MAIS FORTE de moderação que esta aba produz (alguém tentando publicar
 * conduta clínica repetidamente) era gravado e ninguém nunca via. É o
 * `denunciado_em` outra vez: a promessa escrita no módulo ("a plataforma passa
 * a ver o padrão") sem a metade que vê.
 *
 * ⚠️ **SÓ OS GRUPOS QUE CHAMAM ATENÇÃO viajam para o navegador.** O próprio
 * módulo da régua diz: "uma tentativa isolada não é caso — toda paciente um dia
 * escreve uma frase que a régua barra". Mandar os trechos de quem NÃO é caso
 * seria despejar texto quase-clínico de pacientes inocentes na tela do admin.
 * O que viaja além dos grupos é um NÚMERO agregado (`totalNaJanela`), para a
 * fila vazia poder dizer "a régua barrou N vezes e ninguém reincidiu" — que é
 * outra frase que "a régua não barrou nada", e as duas são outra coisa que
 * "não consegui ler".
 *
 * ⚠️ **JANELA DE 30 DIAS.** Reincidência é padrão de AGORA: sem janela, três
 * tentativas de um ano atrás gritariam para sempre numa fila cuja moeda é
 * atenção. E o teto de linhas existe porque `MAX_ROWS` é a lição de todo
 * relatório desta base — sem ele, uma conta ruidosa faria a leitura crescer sem
 * limite.
 */
export const filaDeBarradas = createServerFn({ method: "POST" })
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
    const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: linhas, error } = await sb
      .from("rede_triagem_barrada")
      .select("quem_id, onde, desfecho, trecho, criado_em")
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false })
      .limit(400);
    /* ⚠️ Tabela ausente ≠ leitura falhou, e nenhum dos dois é "ninguém
       reincide". O primeiro é "falta rodar o SQL" (a tela diz qual); o segundo
       é "tente de novo". Fundi-los foi o defeito do export LGPD. */
    if (error?.code === "42P01") return { ok: false as const, motivo: "sem_tabela" as const };
    if (error || !linhas) return { ok: false as const, motivo: "banco" as const };

    const cru = linhas as {
      quem_id: string;
      onde: string;
      desfecho: string;
      trecho: string;
      criado_em: string;
    }[];

    /* Nomes em LOTE — uma consulta, nunca uma por pessoa. `patient_profiles`
       filtra por `id` (a chave é `id`, não `user_id` — a catraca
       patient-profiles-por-id existe porque esse engano já custou aqui). */
    const ids = [...new Set(cru.map((l) => l.quem_id))];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: perfis } = await sb
        .from("patient_profiles")
        .select("id, display_name")
        .in("id", ids);
      for (const p of (perfis ?? []) as { id: string; display_name: string | null }[]) {
        if (p.display_name?.trim()) nomes.set(p.id, p.display_name.trim());
      }
    }

    const { agruparPorPessoa } = await import("./triagem-barrada");
    const grupos = agruparPorPessoa(
      cru.map((l) => ({
        quemId: l.quem_id,
        quemNome: nomes.get(l.quem_id) ?? null,
        onde: l.onde as import("./triagem-barrada").OndeBarrou,
        desfecho: l.desfecho,
        trecho: l.trecho,
        criadoEm: l.criado_em,
      })),
    );

    return {
      ok: true as const,
      grupos: grupos.filter((g) => g.chamaAtencao),
      /* A emergência não entra nem no agregado: é pedido de socorro, e somá-la
         faria o número da régua parecer maior do que o que ela BARRA. */
      totalNaJanela: cru.filter((l) => l.desfecho !== "emergencia").length,
    };
  });
