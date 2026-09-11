import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb, type SementinhasLedgerRow } from "@/integrations/supabase/types.extended";
import { isCareModeActive } from "@/lib/care-mode.functions";
import { COURSE_MODULES } from "@/lib/course-modules";
import { carregarQuizDoDia } from "@/lib/daily-quizzes";
import {
  RAZAO_PRESENTE_AMIGA,
  RAZAO_PRESENTE_INFLUENCIADORA,
  RAZAO_PRESENTE_MEDICO,
} from "@/lib/economia-sementinhas";
import { computeGestation } from "@/lib/gestacao";
import { nomeDoMedico } from "@/lib/nome-do-medico";
import { PREFIXO_ATIVIDADE, trofeusDasChaves } from "@/lib/trofeus";

/**
 * Sementinhas 🌱 — moeda de recompensa da paciente.
 *
 * Ética (ver pesquisa de gamificação em saúde):
 * - O saldo NUNCA zera e nada é deletado — o saldo é sempre SUM(amount).
 * - Ganho só por autocuidado / educação / marcos, NUNCA por resultado clínico.
 * - Sem streak punitivo, sem aleatoriedade, sem FOMO.
 * - O ganho é concedido SÓ no servidor; o cliente jamais escreve no ledger
 *   (a tabela é server-only), pra ninguém "imprimir" moeda.
 *
 * Desde ago/2026 existe uma SEGUNDA porta de entrada: os pacotes pagos
 * (`pacotes-sementinhas.ts`, creditados pelo webhook do Stripe). Isso não
 * revoga nada acima — o ganho por jogar continua inteiro e o pacote é atalho,
 * nunca condição. O limite que sustenta as duas portas convivendo é um só, e
 * ele é inegociável: **a Sementinha compra enfeite, nunca cuidado**. Nenhuma
 * aula, exame, alerta ou conduta clínica pode passar a depender dela. No dia
 * em que isso acontecer, o app terá começado a cobrar por saúde — que é outro
 * negócio, e não este.
 */

/** Valores de ganho — transparentes e calibráveis sem migração. */
export const SEMENTINHAS = {
  dailyCheckin: 5,
  weekMilestone: 25,
  trimesterMilestone: 100,
  achievementDefault: 20,
  achievementBig: 100,
} as const;

/** Conquistas "grandes" que valem mais (marcos de conclusão). */
export const BIG_ACHIEVEMENTS = new Set(["course_complete", "prenatal_done"]);

type Db = ReturnType<typeof typedDb>;
// dedupeKey é obrigatório: ganho sem chave duplicaria (NULL não conflita no
// índice único). Gastos NÃO passam por aqui — usam insert direto (dedupe_key NULL).
type Grant = { amount: number; reason: string; dedupeKey: string };

/** Concede Sementinhas de forma idempotente (dedupe_key). Server-only. */
export async function grantSementinhas(db: Db, userId: string, grants: Grant[]): Promise<void> {
  const rows = grants
    .filter((g) => g.amount !== 0)
    .map((g) => ({
      user_id: userId,
      amount: g.amount,
      reason: g.reason,
      dedupe_key: g.dedupeKey,
    }));
  if (rows.length === 0) return;
  const { error } = await db
    .from("sementinhas_ledger")
    .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  /* `dedupe_key` torna a concessão idempotente, então repetir é seguro — o que
     não existe é alguém para repetir. Falhando aqui, ela cumpre o desafio, vê
     a animação e o saldo não muda; e como todo chamador ignora o retorno, o
     único lugar onde isso pode aparecer é o log. */
  if (error) console.error("[sementinhas] concessão não gravou", userId, error);
}

/** Saldo atual = SUM(amount). Server-only. */
async function computeBalance(db: Db, userId: string): Promise<number> {
  const { data } = await db.from("sementinhas_ledger").select("amount").eq("user_id", userId);
  return ((data ?? []) as Pick<SementinhasLedgerRow, "amount">[]).reduce(
    (sum, r) => sum + (r.amount ?? 0),
    0,
  );
}

/** Data de hoje (America/Sao_Paulo) como YYYY-MM-DD, para dedupe do check-in. */
function todayKeySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Lê o perfil e devolve o "ciclo" (chave de dedupe por gestação) + a idade
 * gestacional REAL de hoje calculada no servidor. É a fonte de verdade
 * anti-fraude: o cliente não pode reivindicar recompensa de um dia/semana no
 * FUTURO (isso "imprimiria" a jornada inteira de uma vez). `gest` é null quando
 * não há dado gestacional (pós-parto ou perfil incompleto) — aí não dá pra
 * validar por data e caímos no limite do conteúdo finito + dedupe.
 */
import { cicloDoPerfil } from "./ciclo-da-gestacao";

async function loadCycleAndGestation(
  admin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  uid: string,
) {
  const { data: prof } = await admin
    .from("patient_profiles")
    .select("lmp_date, reference_date, reference_weeks, reference_days, birth_date")
    .eq("id", uid)
    .single();
  const p = prof as {
    lmp_date?: string | null;
    reference_date?: string | null;
    reference_weeks?: number | null;
    reference_days?: number | null;
    birth_date?: string | null;
  } | null;
  /* ⚠️ A expressão mora em `ciclo-da-gestacao.ts` desde que as MEMÓRIAS da
     rede passaram a carimbar o ciclo na publicação. Duas cópias divergiriam, e
     aqui a divergência aparece como troféu sumindo. */
  const cycle = cicloDoPerfil(p);
  const gest = computeGestation({
    lmp: p?.lmp_date ?? null,
    referenceDate: p?.reference_date ?? null,
    referenceWeeks: p?.reference_weeks ?? null,
    referenceDays: p?.reference_days ?? null,
  });
  return { cycle, gest };
}

/**
 * O PRESENTE QUE ALGUÉM DEU A ELA — e por que ele precisava existir.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────────
 *
 * O médico presenteava, o servidor gravava a linha no ledger, o saldo dela
 * subia — e **nada, em lugar nenhum do app dela, dizia que aquilo aconteceu**.
 * Ela abriria o Caminho um dia e teria 100 🌱 a mais que ontem, sem explicação.
 *
 * Do lado do médico o recurso parecia inteiro: o botão dizia "Enviado ✓" e a
 * mesada descia. Do lado dela, presente sem remetente é indistinguível de bug —
 * e presente que ninguém percebe não é presente, é uma linha de banco. O ponto
 * inteiro do desenho (ele dá, ela vê que foi ELE, ela volta) morria no silêncio.
 *
 * ─── MODO CUIDADO É BARRADO AQUI, NÃO NO CHAMADOR ───────────────────────────
 *
 * `presentearPaciente` já recusa enviar para quem está em Modo Cuidado, mas o
 * modo pode ser ligado DEPOIS de um presente legítimo. Anunciar moedinha e
 * confete para quem acabou de perder a gestação é exatamente o que o Modo
 * Cuidado existe para impedir — então o portão mora dentro desta função, e não
 * em cada tela que a chama. É a mesma lição de `recado-da-bolha.ts`: nove
 * pontos de uso lembram e o décimo esquece.
 *
 * ─── A JANELA DE 30 DIAS ────────────────────────────────────────────────────
 *
 * Sem ela, uma paciente que ficasse dois meses fora voltaria e receberia o
 * anúncio de um presente de abril como se fosse de hoje. Trinta dias cobre com
 * folga o ciclo da mesada, que é o intervalo em que um presente ainda é notícia.
 */
export type PresenteRecebido = {
  /** Quantas Sementinhas. */
  quantidade: number;
  /** ISO — também é o que a tela usa para lembrar que já anunciou este. */
  quando: string;
  /** Quem deu: o médico dela, a amiga que a trouxe, ou a criadora do código. */
  de: "medico" | "amiga" | "criadora";
  /** Primeiro nome de quem deu, quando dá para saber. */
  nome: string | null;
};

const JANELA_DO_PRESENTE_MS = 30 * 24 * 60 * 60 * 1000;

async function presenteRecente(
  db: Db,
  userId: string,
  careMode: boolean,
): Promise<PresenteRecebido | null> {
  if (careMode) return null;

  const desde = new Date(Date.now() - JANELA_DO_PRESENTE_MS).toISOString();
  const { data, error } = await db
    .from("sementinhas_ledger")
    .select("amount, reason, created_at")
    .eq("user_id", userId)
    .in("reason", [RAZAO_PRESENTE_MEDICO, RAZAO_PRESENTE_AMIGA, RAZAO_PRESENTE_INFLUENCIADORA])
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1);

  const linha = (data ?? [])[0] as
    | Pick<SementinhasLedgerRow, "amount" | "reason" | "created_at">
    | undefined;
  /* Falha de leitura → nenhum anúncio. O saldo dela já está certo de qualquer
     jeito; o que se perde é a festa, e festa errada é pior que festa ausente. */
  if (error || !linha) return null;

  const de =
    linha.reason === RAZAO_PRESENTE_MEDICO
      ? "medico"
      : linha.reason === RAZAO_PRESENTE_INFLUENCIADORA
        ? "criadora"
        : "amiga";
  return {
    quantidade: linha.amount ?? 0,
    quando: linha.created_at as string,
    de,
    nome: await nomeDeQuemDeu(db, userId, de),
  };
}

/**
 * O NOME DE QUEM DEU — lido do VÍNCULO, nunca gravado no presente.
 *
 * A linha do ledger não carrega quem deu (o `dedupe_key` carrega, mas ele é
 * chave técnica e não deve virar fonte de exibição). O médico sai de
 * `patient_profiles.doctor_id` e a amiga de `referred_by` — os mesmos campos que
 * autorizaram o presente lá atrás.
 *
 * `null` é resposta legítima: o vínculo pode ter sido encerrado depois. Aí o
 * anúncio diz "do seu médico" em vez de inventar um nome.
 */
async function nomeDeQuemDeu(
  db: Db,
  userId: string,
  de: "medico" | "amiga" | "criadora",
): Promise<string | null> {
  const sb = db as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  };
  try {
    const { data: perfil } = await sb
      .from("patient_profiles")
      .select("doctor_id, referred_by, ref_code")
      .eq("id", userId)
      .maybeSingle();
    const p = perfil as {
      doctor_id?: string | null;
      referred_by?: string | null;
      ref_code?: string | null;
    } | null;

    /* ⚠️ A criadora sai de `ref_code` → `affiliates.name`, e não de
       `referred_by`: aquele é o grafo de AMIZADE, e o código foi tirado dele
       de propósito — uma criadora com três mil seguidoras viraria amiga de
       três mil gestantes. É a decisão que `influenciadora.functions.ts`
       registra com todas as letras. */
    if (de === "criadora") {
      const codigo = p?.ref_code;
      if (!codigo) return null;
      const { data: aff } = await sb
        .from("affiliates")
        .select("name")
        .eq("code", codigo)
        .maybeSingle();
      const nome = ((aff as { name?: string | null } | null)?.name ?? "").trim();
      return nome.split(/\s+/)[0] || null;
    }

    const quem = de === "medico" ? p?.doctor_id : p?.referred_by;
    if (!quem) return null;

    const { data: dono } = await sb
      .from(de === "medico" ? "doctors" : "patient_profiles")
      .select("display_name")
      .eq("id", quem)
      .maybeSingle();
    const bruto = (dono as { display_name?: string | null } | null)?.display_name ?? "";
    /* O médico volta como "Dr. Clóvis" (título + primeiro nome, régua única em
       `nome-do-medico.ts`); a amiga, só o primeiro nome. Nome inteiro estoura
       o título do aviso, e o cadastro do médico já traz o título dentro do
       `display_name` — daí o `Dr(a). ${nome}` que eu tinha escrito virar
       "Dr(a). Dr. Clóvis Bacha" na primeira foto. */
    if (de === "medico") return nomeDoMedico(bruto);
    return bruto.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

/**
 * QUANTOS TROFÉUS ELA TEM — uma linha `day_stars:` por dia de cinco estrelas.
 *
 * A contagem sai do LEDGER e não de `doneDays`, e a diferença é o que permite o
 * troféu destrancar item da loja: `doneDays` mora no `localStorage` da paciente
 * e sobe no blob do `journey_state`, então quem o escreve é o navegador.
 * `grantDayStarsBonus` só grava a linha depois de o ledger confirmar as cinco
 * atividades do dia — é escrita de servidor, e é a única aqui que não se forja.
 *
 * `head: true` com `count`: o PostgREST devolve só o número, sem trazer as
 * linhas. Quem fecha o dia por 300 dias tem 300 linhas, e elas não têm nada a
 * dizer além de existirem.
 */
export async function contarTrofeus(db: Db, userId: string): Promise<number> {
  const { data, error } = await db
    .from("sementinhas_ledger")
    .select("dedupe_key")
    .eq("user_id", userId)
    .like("dedupe_key", `${PREFIXO_ATIVIDADE}%`)
    .limit(5000);

  /* Falha de leitura → ZERO, nunca um palpite. O número destranca item pago:
     errar para cima entrega de graça o que ela ainda não conquistou, e errar
     para baixo só adia. */
  if (error) return 0;
  return trofeusDasChaves(
    ((data ?? []) as { dedupe_key: string | null }[]).map((r) => r.dedupe_key),
    WELLNESS_ACTIVITIES,
  );
}

async function walletPayload(db: Db, userId: string, careMode: boolean) {
  const balance = await computeBalance(db, userId);
  const { data: recent } = await db
    .from("sementinhas_ledger")
    .select("amount, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    balance,
    recent: (recent ?? []) as Pick<SementinhasLedgerRow, "amount" | "reason" | "created_at">[],
    presente: await presenteRecente(db, userId, careMode),
    /* Fora do Modo Cuidado: o troféu é gamificação, e no luto ela some junto
       com o resto. Zero aqui esconde o contador — não apaga nada no banco. */
    trofeus: careMode ? 0 : await contarTrofeus(db, userId),
  };
}

/**
 * Lê a carteira e, de quebra, concede o check-in do dia (idempotente por dia).
 * O app chama isto ao abrir a área logada.
 */
export const claimDailyAndGetWallet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    // Modo Cuidado: não concede nem comemora; só devolve o saldo que já existe.
    const careMode = await isCareModeActive(supabaseAdmin, uid);
    if (!careMode) {
      await grantSementinhas(db, uid, [
        {
          amount: SEMENTINHAS.dailyCheckin,
          reason: "Check-in de hoje",
          dedupeKey: `checkin:${todayKeySaoPaulo()}`,
        },
      ]);
    }
    return { ok: true as const, careMode, ...(await walletPayload(db, uid, careMode)) };
  });

/** Só lê a carteira (sem conceder nada). */
export const getWallet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const careMode = await isCareModeActive(supabaseAdmin, u.user.id);
    return { ok: true as const, ...(await walletPayload(db, u.user.id, careMode)) };
  });

/**
 * Recompensa por concluir a lição do quiz. NUNCA punitivo: base por concluir +
 * bônus por acerto. Idempotente por lição (dedupe), escopado ao ciclo. Devolve
 * quanto foi concedido AGORA (0 se já havia ganhado ou em Modo Cuidado).
 */
export const grantLessonReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        week: z.number().int().min(1).max(45),
        correct: z.number().int().min(0).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };

    // ANTI-FRAUDE: a semana e o nº de acertos são validados contra o CURSO real
    // no servidor — o cliente não define o valor creditado. Semana inexistente
    // não paga; `correct` é limitado ao nº de perguntas daquela lição.
    const mod = COURSE_MODULES.find((mm) => mm.week === data.week);
    if (!mod) return { ok: true as const, granted: 0 };
    const correct = Math.max(0, Math.min(data.correct, mod.quiz.length));

    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    // ANTI-FRAUDE (cadência): a lição só paga a SEMANA gestacional atual (±1 de
    // folga p/ fuso). Sem idade gestacional confiável não paga. Assim uma única
    // edição do perfil não "varre" os 12 módulos de uma vez (antes bastava
    // inflar reference_weeks). As lições do curso já saíram da UI (ensino só no
    // desafio do dia), então travar na semana atual não bloqueia nada legítimo.
    if (!gest) return { ok: true as const, granted: 0 };
    if (Math.abs(data.week - gest.weeks) > 1) return { ok: true as const, granted: 0 };
    const dedupeKey = `lesson:${cycle}:${data.week}`;

    // Já ganhou por esta lição? (idempotência transparente p/ o "você ganhou X")
    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing) return { ok: true as const, granted: 0 };

    const amount = 10 + 3 * correct; // base + bônus por acerto (limitado)
    await grantSementinhas(db, uid, [
      { amount, reason: `Lição da semana ${data.week} 📚`, dedupeKey },
    ]);
    return { ok: true as const, granted: amount };
  });

/**
 * Recompensa por concluir o DESAFIO DO DIA (quiz da aula de hoje). Base por
 * concluir + bônus por acerto (nunca punitivo). Validado no servidor contra o
 * quiz real do dia (anti-fraude: dia inexistente não paga; `correct` limitado
 * ao nº de perguntas). Idempotente por dia/ciclo; suprimido em Modo Cuidado.
 */
export const grantDailyQuizReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        day: z.number().int().min(1).max(400),
        correct: z.number().int().min(0).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };

    /* `await` porque o banco de aulas virou `import()` dinâmico (ver
       daily-quizzes.ts). No servidor o arquivo é local — o custo é o primeiro
       acesso do processo, não uma ida à rede. */
    const quiz = await carregarQuizDoDia(data.day);
    if (!quiz || quiz.questions.length === 0) return { ok: true as const, granted: 0 };
    const correct = Math.max(0, Math.min(data.correct, quiz.questions.length));

    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    // ANTI-FRAUDE (cadência diária): o "desafio do dia" só paga o dia de HOJE.
    // Espelha o cliente (canEarn={isToday}). Isto barra as DUAS fraudes: minerar
    // o FUTURO (reivindicar a jornada inteira) e reprocessar TODOS os dias
    // passados de uma vez. `todayDay` usa a mesma janela do cliente (7..300).
    // Sem idade gestacional confiável (perfil incompleto/pós-parto) não há
    // cadência a validar — não paga (o quiz é conteúdo de gravidez).
    if (!gest) return { ok: true as const, granted: 0 };
    const todayDay = Math.max(7, Math.min(300, gest.totalDays));
    if (Math.abs(data.day - todayDay) > 1) return { ok: true as const, granted: 0 };
    const dedupeKey = `dailyquiz:${cycle}:${data.day}`;

    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing) return { ok: true as const, granted: 0 };

    const amount = 5 + 3 * correct; // base 5 + 3 por acerto
    await grantSementinhas(db, uid, [{ amount, reason: "Desafio do dia 🎯", dedupeKey }]);
    return { ok: true as const, granted: amount };
  });

/**
 * Recompensa por concluir a ATIVIDADE DE BEM-ESTAR do dia (respiração,
 * movimento ou meditação). Recompensa fixa por concluir (nunca punitivo, sem
 * "acerto"). Só paga o dia de HOJE (mesma cadência do desafio), idempotente por
 * dia/ciclo (uma por dia, independente do tipo), suprimido em Modo Cuidado.
 */
export const grantWellnessReward = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        day: z.number().int().min(1).max(400),
        activity: z.enum(["breathing", "movement", "meditation", "bonding", "gratitude"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };

    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    // Mesma cadência do desafio: só paga o dia de HOJE (anti-fraude).
    if (!gest) return { ok: true as const, granted: 0 };
    const todayDay = Math.max(7, Math.min(300, gest.totalDays));
    if (Math.abs(data.day - todayDay) > 1) return { ok: true as const, granted: 0 };
    // Recompensa POR ATIVIDADE (uma vez por dia cada). Fazer TODAS rende mais —
    // é o "desafio do dia". Nunca punitivo: fazer só uma já ganha.
    const keyFor = (a: string) => `wellness:${a}:${cycle}:${data.day}`;
    const dedupeKey = keyFor(data.activity);

    const { data: existing } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    const reason =
      data.activity === "breathing"
        ? "Respiração do dia 🌬️"
        : data.activity === "movement"
          ? "Movimento do dia 🤸"
          : data.activity === "meditation"
            ? "Meditação do dia 🧘"
            : data.activity === "bonding"
              ? "Momento com o bebê 💛"
              : "Gratidão do dia ✨";
    const amount = 5; // base fixa por concluir (nunca punitivo)
    let granted = 0;
    if (!existing) {
      await grantSementinhas(db, uid, [{ amount, reason, dedupeKey }]);
      granted = amount;
    }

    // Quantas atividades já foram feitas hoje (fonte da verdade: o ledger).
    const allKeys = WELLNESS_ACTIVITIES.map(keyFor);
    const { data: rows } = await db
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .eq("user_id", uid)
      .in("dedupe_key", allKeys);
    const doneSet = new Set(((rows ?? []) as { dedupe_key: string }[]).map((r) => r.dedupe_key));
    doneSet.add(dedupeKey); // acabou de ganhar (pode não estar no SELECT ainda)
    const doneCount = WELLNESS_ACTIVITIES.filter((a) => doneSet.has(keyFor(a))).length;
    const allDone = doneCount === WELLNESS_ACTIVITIES.length;

    // (O bônus do dia é por fechar as 5 ESTRELAS — a aula + os 4 jogos, uma
    // estrela cada — via grantDayStarsBonus. Aqui cada atividade só rende a sua.)
    return { ok: true as const, granted, doneCount, allDone };
  });

/** Bônus por fechar as 5 estrelas do dia (a aula + os 4 jogos). 1x/dia. */
export const grantDayStarsBonus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), day: z.number().int().min(1).max(400) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, granted: 0 };
    const uid = u.user.id;
    if (await isCareModeActive(supabaseAdmin, uid)) return { ok: true as const, granted: 0 };
    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    if (!gest) return { ok: true as const, granted: 0 };
    const todayDay = Math.max(7, Math.min(300, gest.totalDays));
    if (Math.abs(data.day - todayDay) > 1) return { ok: true as const, granted: 0 };
    // Anti-fraude: o bônus só sai se o LEDGER confirmar as 5 atividades de
    // bem-estar do dia (não confia no cliente dizer "fechei").
    const wellnessKeys = WELLNESS_ACTIVITIES.map((a) => `wellness:${a}:${cycle}:${data.day}`);
    const { data: wrows } = await db
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .eq("user_id", uid)
      .in("dedupe_key", wellnessKeys);
    if (((wrows ?? []) as { dedupe_key: string }[]).length < WELLNESS_ACTIVITIES.length) {
      return { ok: true as const, granted: 0 };
    }
    const dedupeKey = `day_stars:${cycle}:${data.day}`;
    const { data: had } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (had) return { ok: true as const, granted: 0 };
    const amount = 20;
    await grantSementinhas(db, uid, [{ amount, reason: "5 estrelas do dia! 🌟", dedupeKey }]);
    return { ok: true as const, granted: amount };
  });

/** Atividades do desafio diário de bem-estar (ordem = ordem no jogo). */
/* ─── QUATRO, E NÃO MAIS CINCO (ago/2026) ────────────────────────────────
   "breathing" saiu: a respiração guiada virou um tema da meditação, e uma
   chave que ninguém mais grava faria `allDone` nunca ser verdade — o bônus do
   dia deixaria de existir em silêncio, sem erro nenhum a apontar. */
const WELLNESS_ACTIVITIES = ["movement", "meditation", "bonding", "gratitude"] as const;

/** Progresso do desafio de bem-estar de HOJE (quais atividades já foram feitas). */
export const getWellnessProgress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), day: z.number().int().min(1).max(400) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, done: [] as string[], allDone: false };
    const uid = u.user.id;
    // Modo Cuidado: sem gamificação — desafio "vazio".
    if (await isCareModeActive(supabaseAdmin, uid))
      return { ok: true as const, done: [] as string[], allDone: false };
    const { cycle, gest } = await loadCycleAndGestation(supabaseAdmin, uid);
    if (!gest) return { ok: true as const, done: [] as string[], allDone: false };

    const keyFor = (a: string) => `wellness:${a}:${cycle}:${data.day}`;
    const allKeys = WELLNESS_ACTIVITIES.map(keyFor);
    const { data: rows } = await db
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .eq("user_id", uid)
      .in("dedupe_key", allKeys);
    const doneSet = new Set(((rows ?? []) as { dedupe_key: string }[]).map((r) => r.dedupe_key));
    const done = WELLNESS_ACTIVITIES.filter((a) => doneSet.has(keyFor(a)));
    return {
      ok: true as const,
      done: done as string[],
      allDone: done.length === WELLNESS_ACTIVITIES.length,
    };
  });

// Nota: o GASTO de Sementinhas é feito pela RPC atômica buy_cantinho_item
// (ver cantinho.functions.ts) — com advisory lock por usuário, sem risco de
// saldo negativo. Não há função genérica de gasto de propósito, pra evitar um
// caminho não-atômico que furasse essa garantia.

/**
 * O BÔNUS DE VINCULAR UM MÉDICO — pago uma vez, por médico.
 *
 * ─── POR QUE UMA FUNÇÃO, E NÃO TRÊS LINHAS ──────────────────────────────────
 *
 * Existem TRÊS caminhos que gravam `patient_profiles.doctor_id`:
 *
 *   · `chooseDoctor`        — ela escolhe no diretório;
 *   · `respondPatientRequest` — ele aceita o pedido dela;
 *   · `redeemInviteCode`    — ela resgata o código dele.
 *
 * Copiar a concessão nos três é a receita de divergência que esta base já viveu
 * mais de uma vez (o teto de pacientes existia em dois e vazava no terceiro; a
 * régua de vencimento tinha quatro cópias discordantes). Uma função, três
 * chamadas.
 *
 * ─── UMA VEZ NA VIDA DELA, E ESSA FOI UMA CORREÇÃO ──────────────────────────
 *
 * A `dedupeKey` é fixa (`vinculo-medico`), não carrega o médico. A primeira
 * versão carregava, com o argumento de que "trocar de médico é um vínculo novo"
 * — e isso abria um farm de um minuto pela busca pública. Ver o comentário no
 * corpo. O bônus é do evento "ela passou a ter um médico", que acontece uma vez.
 *
 * Nunca lança e nunca bloqueia o vínculo: um bônus que falha é um bônus a
 * menos; um vínculo que falha por causa do bônus é uma paciente sem médico.
 */
export async function bonusDeVinculo(
  supabaseAdmin: unknown,
  patientId: string,
  doctorId: string,
): Promise<void> {
  try {
    const { BONUS_VINCULO_MEDICO } = await import("@/lib/economia-sementinhas");
    /* Modo Cuidado não recebe gamificação — mesma regra do resto do arquivo.
       Dar Sementinhas a quem acabou de perder a gestação é o oposto do cuidado
       que o Modo Cuidado existe para prestar. */
    if (await isCareModeActive(supabaseAdmin as never, patientId)) return;
    /* ─── UMA VEZ POR PACIENTE, NÃO POR MÉDICO ────────────────────────────
     *
     * A chave era `vinculo:${doctorId}` — única por PAR. Um verificador mediu o
     * buraco: `/encontrar-medico` é rota pública e a troca de médico é livre e
     * sem carência, então quatro toques na lista pagavam quatro bônus. Com o
     * bônus em 200, isso dá 800 🌱 — mais que a loja grátis inteira (704), em
     * menos de um minuto. A parede de quinze dias, que é a razão de existir de
     * todo este desenho, caía antes de existir.
     *
     * (E cada toque ainda dispara push e e-mail "Nova paciente" para um médico
     * que a perde no toque seguinte.)
     *
     * A chave passa a ser fixa: `vinculo-medico`. O bônus é do EVENTO "ela
     * passou a ter um médico", que acontece uma vez na vida dela no app — não
     * de cada médico. Trocar de médico continua livre; o que não se repete é o
     * pagamento. */
    await grantSementinhas(typedDb(supabaseAdmin as never), patientId, [
      {
        amount: BONUS_VINCULO_MEDICO,
        reason: "vinculo-medico",
        dedupeKey: "vinculo-medico",
      },
    ]);
  } catch (e) {
    console.error("[sementinhas] bônus de vínculo não foi pago", patientId, doctorId, e);
  }
}
