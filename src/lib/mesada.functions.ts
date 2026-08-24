/**
 * A MESADA DE SEMENTINHAS DO MÉDICO.
 *
 * ─── A IDEIA ────────────────────────────────────────────────────────────────
 *
 * O médico ganha, todo mês, um bolso de Sementinhas para presentear as
 * pacientes dele. O tamanho do bolso é `mensagens contratadas × 3` — ver
 * `economia-sementinhas.ts` para por que essa razão se calibra sozinha.
 *
 * ─── O QUE ISSO SUBSTITUI ───────────────────────────────────────────────────
 *
 * O médico dava Premium DE GRAÇA para um punhado de pacientes por mês
 * (`premiumInvitesPerMonth`). Aquilo tinha dois problemas: dava a assinatura
 * inteira (a receita que a plataforma vive de vender) e não funcionava nos apps
 * de iOS e Android, porque desconto de assinatura ali é a loja quem dá.
 *
 * Sementinha não passa por Stripe, Apple nem Google — é uma linha no nosso
 * banco. Funciona igual nas três plataformas, e o custo para a plataforma é
 * **zero**: Sementinha compra conteúdo estático.
 *
 * ─── E ELA ACELERA A CONVERSÃO, NÃO A SUBSTITUI ─────────────────────────────
 *
 * Este é o ponto que faz o desenho valer. Quanto mais generoso o médico é, mais
 * rápido a paciente compra os 15 itens grátis e passa a acumular moeda sem ter
 * no que gastar — olhando 57 itens bloqueados que ela JÁ pode pagar. O presente
 * dele empurra a assinatura em vez de adiar.
 *
 * ─── O CICLO É O MESMO DA COTA DE IA ────────────────────────────────────────
 *
 * `inicioDoCiclo()`, o mesmo de `cota-ia.server`. Duas noções de "este mês" no
 * mesmo painel é como o placar do cérebro e o card de consumo passaram a
 * discordar — o comentário de lá conta a história inteira.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  PRESENTE_SUGERIDO,
  RAZAO_PRESENTE_MEDICO,
  chaveDoPresente,
  mesadaDoMedico,
  prefixoDosPresentes,
  recebidoPorPaciente,
  tokenDePresente,
} from "@/lib/economia-sementinhas";

/**
 * O médico da sessão — cópia local, como fazem `secondbrain`, `clinical`,
 * `admin` e `dashboard`.
 *
 * Nenhum desses arquivos exporta a sua versão, e exportar uma agora criaria um
 * acoplamento novo entre módulos que hoje só compartilham o banco. Cinco cópias
 * de dez linhas é feio; um import cruzado entre cinco módulos de domínio é pior.
 */
async function medicoDaSessao(accessToken: string): Promise<{ id: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  if (!u.user) return null;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", u.user.id)
    .maybeSingle();
  return doc && doc.active !== false ? { id: u.user.id } : null;
}

/**
 * A razão gravada no ledger — é por ela que a mesada é contada de volta.
 *
 * O valor mora em `economia-sementinhas.ts` (puro) porque a tela da PACIENTE
 * também precisa reconhecê-lo para anunciar o presente, e ela não pode importar
 * este arquivo de servidor.
 */
export const RAZAO_PRESENTE = RAZAO_PRESENTE_MEDICO;

export type EstadoDaMesada = {
  /** O bolso do mês, em Sementinhas. */
  total: number;
  /** Quanto já foi presenteado neste ciclo. */
  usado: number;
  /** O que sobra. */
  restante: number;
  /** O valor sugerido no botão de um clique. */
  sugerido: number;
  /**
   * Quanto cada paciente já recebeu neste ciclo — `patientId → Sementinhas`.
   *
   * Era uma lista de quem estava BLOQUEADA, quando havia um presente por
   * paciente por mês. Sem o limite, bloquear ninguém: o mapa virou INFORMAÇÃO
   * ("Fulana já recebeu 90 🌱 este mês"), que é o que o médico precisa para
   * dosar a mesada entre as pacientes dele sem que o app decida por ele.
   *
   * Sai dos `dedupe_key` que a própria mesada já lê para contar o gasto — sem
   * consulta nova e sem uma segunda fonte de verdade que possa discordar do
   * número exibido ao lado.
   */
  recebido: Record<string, number>;
};

/**
 * Quantas mensagens o médico contratou.
 *
 * A mesada é do TAMANHO DO PLANO, então ela precisa do mesmo número que a cota
 * de IA usa. Enquanto a coluna do Stripe não existir, cai no teto do plano —
 * e devolver 0 aqui seria pior que estimar: o médico veria "mesada zerada" sem
 * ter feito nada.
 */
async function mensagensContratadas(_sb: any, _doctorId: string): Promise<number> {
  /* ─── POR QUE ISTO NÃO LÊ O PLANO ANTIGO ────────────────────────────────
   *
   * A primeira versão devolvia `ent.aiRepliesPerCycle`, e um verificador mediu
   * o estrago: os planos ANTIGOS têm tetos de outra ordem de grandeza (Black =
   * 30.000), então a mesada saía **90.000 🌱/mês** — doze vezes o topo que a
   * escada nova pretende (2.500 × 3 = 7.500).
   *
   * Sementinha não custa dinheiro, então isso não quebraria a fatura. Quebraria
   * coisa pior: a economia da loja. `economia-sementinhas.ts` calibra dia a dia
   * para a paciente zerar os 15 itens grátis no 15º dia — com 90.000 no bolso
   * do médico, ela zera no PRIMEIRO, e o mecanismo inteiro (moeda parada sem ter
   * o que comprar) deixa de existir.
   *
   * A fonte certa é a coluna que o Stripe vai gravar com a quantidade comprada
   * (`doctors.ai_messages_per_cycle`), e ela ainda não existe. Até lá, o
   * fallback honesto é a ENTRADA da escada — 150 mensagens = 450 🌱. Errar para
   * o lado de dar de menos mantém a economia de pé; errar para o outro a
   * destrói em silêncio, e ninguém veria, porque 90.000 é um número plausível
   * ao lado de 7.500.
   */
  const { ENTRADA_MENSAGENS } = await import("@/lib/planos-medico");
  return ENTRADA_MENSAGENS;
}

/** Lê a mesada do ciclo — exportada para o checkout do presente reusar. */
export async function lerMesada(sb: any, doctorId: string): Promise<EstadoDaMesada> {
  const total = mesadaDoMedico(await mensagensContratadas(sb, doctorId));
  const { inicioDoCiclo } = await import("@/lib/cota-ia.server");

  /* O gasto vem do LEDGER DA PACIENTE, filtrado pela razão que carrega o id do
     médico. É a mesma linha que creditou a paciente: uma fonte só, e nenhuma
     chance de o painel dizer um número e o extrato dela dizer outro. */
  const { data, error } = await sb
    .from("sementinhas_ledger")
    .select("amount, dedupe_key")
    .eq("reason", RAZAO_PRESENTE)
    .like("dedupe_key", prefixoDosPresentes(doctorId))
    .gte("created_at", inicioDoCiclo().toISOString())
    .limit(5000);

  /* Falha de leitura → mesada ZERADA, não cheia. Errar para o lado de não
     presentear é chato; errar para o outro deixa o médico distribuir sem teto
     e some com a única trava que existe. */
  if (error) {
    return { total, usado: total, restante: 0, sugerido: PRESENTE_SUGERIDO, recebido: {} };
  }

  const linhas = (data ?? []) as { amount: number; dedupe_key: string | null }[];
  const usado = linhas.reduce((s, l) => s + (l.amount ?? 0), 0);
  return {
    total,
    usado,
    restante: Math.max(0, total - usado),
    sugerido: PRESENTE_SUGERIDO,
    recebido: recebidoPorPaciente(linhas),
  };
}

/** O que o painel chama para desenhar o card da mesada. */
export const getMesada = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { ok: true as const, mesada: await lerMesada(supabaseAdmin as any, user.id) };
  });

/**
 * Presenteia UMA paciente.
 *
 * As três travas, e cada uma fecha um buraco diferente:
 *
 *  1. **Vínculo ATUAL** — só paciente dele HOJE. `patient_profiles.doctor_id`,
 *     nunca um carimbo histórico. É a mesma régua que `responderPergunta` e
 *     `answerAndTrain` usam, e pelo mesmo motivo: presente é uma mensagem, e
 *     mandar mensagem para ex-paciente é o que a régua existe para impedir.
 *  2. **Teto da mesada** — conferido DEPOIS de gravar, e revertido se estourar.
 *     Conferir antes deixa uma janela em que dois cliques simultâneos passam
 *     dos dois lados do `if`. É a mesma correção que `platform_coupons` já tinha.
 *  3. **Um presente por ENVIO, e não por ciclo.** O limite de "uma vez por
 *     paciente por mês" caiu a pedido do dono: ele presenteia quem quiser,
 *     quantas vezes quiser, até a mesada acabar. O que continua de pé é a
 *     idempotência do CLIQUE — `dedupeKey` carrega um token de envio, então
 *     clique duplo e retentativa de rede gravam uma vez só. Sem essa troca,
 *     "sem limite" viraria "sem defesa": `grantSementinhas` usa
 *     `ignoreDuplicates`, e a chave é a única coisa entre um toque nervoso e
 *     dois presentes.
 *
 * O TETO DA MESADA é o que sobrou de limite, e ele basta — é o mesmo número que
 * paga a conta. Duas travas para o mesmo risco só serviam para o médico bater
 * na que ele não escolheu.
 */
export const presentearPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patientId: z.string().uuid(),
        /* Quanto dar. O padrão é o sugerido; o médico pode mudar, mas não pode
           dar mais que a mesada nem um valor absurdo numa paciente só. */
        quantidade: z.number().int().min(1).max(1000).optional(),
        /* O token do CLIQUE (ver `chaveDoPresente`). Opcional para não quebrar
           nenhum chamador antigo — mas quem não manda perde a idempotência,
           então a tela sempre manda. */
        token: z.string().max(80).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const, error: "sem_permissao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const doctorId = user.id;
    const quanto = data.quantidade ?? PRESENTE_SUGERIDO;

    /* 1. VÍNCULO ATUAL. */
    const { data: dela } = await sb
      .from("patient_profiles")
      .select("id")
      .eq("id", data.patientId)
      .eq("doctor_id", doctorId)
      .maybeSingle();
    if (!dela) return { ok: false as const, error: "sem_vinculo" as const };

    const mesada = await lerMesada(sb, doctorId);
    if (quanto > mesada.restante) {
      return { ok: false as const, error: "mesada_esgotada" as const, mesada };
    }

    /* Modo Cuidado não recebe gamificação. Presentear quem acabou de perder a
       gestação com moedinhas de decoração é o oposto do cuidado. */
    const { isCareModeActive } = await import("@/lib/care-mode.functions");
    if (await isCareModeActive(supabaseAdmin as never, data.patientId)) {
      return { ok: false as const, error: "modo_cuidado" as const };
    }

    /* 3. UM POR ENVIO. A chave carrega médico, paciente e o token DO CLIQUE —
          não mais o ciclo. O formato mora em `economia-sementinhas.ts`, junto
          do `LIKE` que a lê de volta.

          `tokenDePresente` limpa o que veio do cliente e devolve `null` se
          sobrar nada; aí o servidor sorteia um. Sortear é o certo aqui: um
          token vazio faria todos os presentes daquela paciente colidirem numa
          chave só, ressuscitando pela porta dos fundos exatamente o limite que
          o dono mandou tirar. */
    const dedupeKey = chaveDoPresente(
      doctorId,
      data.patientId,
      tokenDePresente(data.token) ?? globalThis.crypto.randomUUID(),
    );

    /* ─── CONFERE O TETO ANTES, E NÃO DESFAZ DEPOIS ───────────────────────
     *
     * A primeira versão gravava, relia e APAGAVA a linha se estourasse. Duas
     * coisas erradas nisso, as duas achadas por um verificador:
     *
     *  · o `delete` viola a invariante escrita na própria migration
     *    (`20260722120000_sementinhas.sql`: "o saldo NUNCA zera, nada é
     *    deletado"). Numa corrida, ele podia apagar o presente ANTERIOR da
     *    paciente — que ela já pode ter GASTO, deixando o saldo negativo;
     *  · e dois cliques que estourassem juntos desfaziam OS DOIS, inclusive o
     *    que cabia.
     *
     * A conferência de `lerMesada` logo acima já barra o caso normal. A corrida
     * que sobra — dois presentes simultâneos que juntos estouram — custa no
     * máximo UM presente a mais que o teto, e isso é Sementinha, que não custa
     * dinheiro. Aceitar um erro de 50 🌱 é muito melhor que manter uma escrita
     * destrutiva num livro-caixa que o produto inteiro assume ser append-only. */
    /* ─── O MESMO CLIQUE CHEGANDO DUAS VEZES NÃO É ERRO ───────────────────
     *
     * `grantSementinhas` usa `ignoreDuplicates: true`: gravar de novo a mesma
     * chave é DO NOTHING, sem erro. Antes, a chave carregava o CICLO, então
     * encontrar a linha significava "ela já ganhou este mês" — uma recusa.
     *
     * Agora a chave carrega o token do clique, e encontrar a linha significa
     * outra coisa: **este mesmo envio já foi processado** (o médico tocou duas
     * vezes, ou a rede repetiu o POST). Isso é sucesso, não recusa — devolver
     * erro aqui faria um toque nervoso parecer falha, e ele mandaria de novo,
     * agora com token novo, gastando a mesada duas vezes de verdade.
     *
     * Um envio deliberado a mais, esse sim, tem token próprio e passa direto —
     * que é o limite tirado a pedido do dono. */
    const { data: jaExistia } = await sb
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", data.patientId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (jaExistia) {
      return {
        ok: true as const,
        mesada,
        quantidade: jaExistia.amount as number,
        /* A tela usa isto para NÃO comemorar de novo nem mandar outro push. */
        repetido: true as const,
      };
    }

    const { grantSementinhas } = await import("@/lib/sementinhas.functions");
    const { typedDb } = await import("@/integrations/supabase/types.extended");
    await grantSementinhas(typedDb(supabaseAdmin as never), data.patientId, [
      { amount: quanto, reason: RAZAO_PRESENTE, dedupeKey },
    ]);

    /* E confere que a escrita aconteceu. Com a chave por token, a corrida que
       sobra é o MESMO clique chegando duas vezes — e aí a linha existe, o
       `gravou` a encontra, e o resultado é o certo dos dois lados. */
    const { data: gravou } = await sb
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", data.patientId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    const depois = await lerMesada(sb, doctorId);
    if (!gravou) {
      return { ok: false as const, error: "nao_gravou" as const, mesada: depois };
    }

    /* ─── E AGORA ELA FICA SABENDO ────────────────────────────────────────
     *
     * Sem isto, o presente era uma linha de banco: o saldo dela subia e nada,
     * em canto nenhum do app, dizia que o médico tinha feito aquilo. O ponto do
     * desenho é ELA saber que foi ele — o push é o único canal que funciona com
     * o app fechado, que é onde ela está na maior parte do tempo.
     *
     * Depois do `if (!gravou)`, de propósito: avisar de um presente que não foi
     * gravado é pior que não avisar. E best-effort — `sendPushToUser` engole os
     * próprios erros, e um push que não sai não pode desfazer um presente que
     * já está no ledger. */
    try {
      const { sendPushToUser } = await import("@/lib/push.server");
      const { data: eu } = await sb
        .from("doctors")
        .select("display_name")
        .eq("id", doctorId)
        .maybeSingle();
      /* `nomeDoMedico` e não `split(" ")[0]`: o `display_name` do cadastro já
         traz o título, então a primeira parte é "Dr." — e o push chegaria
         dizendo "Dr. te mandou um presente". Mesma régua do aviso na tela dela,
         para os dois textos nunca chamarem a mesma pessoa de nomes diferentes. */
      const { nomeDoMedico } = await import("@/lib/nome-do-medico");
      const nome = nomeDoMedico(eu?.display_name as string | null);
      await sendPushToUser(data.patientId, {
        title: nome ? `${nome} te mandou um presente 🌱` : "Você ganhou um presente 🌱",
        body: `${quanto} Sementinhas para gastar no seu Cantinho.`,
        /* "Caminho" com C maiúsculo: o deep-link de `minha-conta` compara o
           `?tab=` com os rótulos de `TABS` e ignora o que não bate — errar a
           caixa deixaria o push abrindo a aba do Bebê, sem erro nenhum. */
        url: "/minha-conta?tab=Caminho",
      });
    } catch {
      /* best-effort: o presente já está gravado. */
    }

    return { ok: true as const, mesada: depois, quantidade: quanto };
  });
