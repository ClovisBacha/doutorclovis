import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { computeGestation } from "@/lib/gestacao";
import { grantSementinhas, SEMENTINHAS } from "@/lib/sementinhas.functions";
import { isCareModeActive } from "@/lib/care-mode.functions";
import {
  ATIVIDADES_DO_DIA,
  CONQUISTAS,
  aulasRespondidas,
  conquistaPorChave,
  diasDistintos,
  maiorSequencia,
  sementinhasDaRaridade,
  vezesQueFez,
  type ConquistaDef,
} from "@/lib/conquistas";
import { PREFIXO_ATIVIDADE, trofeusDasChaves } from "@/lib/trofeus";

/**
 * ⚠️ O CATÁLOGO MUDOU DE CASA (ago/2026) — foi para `src/lib/conquistas.ts`.
 *
 * Ele é lido pela TELA (que desenha os cartões) e pelo SERVIDOR (que concede).
 * Morando aqui, junto das server functions, a tela arrastava `typedDb`,
 * `computeGestation` e `grantSementinhas` para o pacote do navegador só para
 * saber o título de um emblema.
 *
 * Lá ele também ganhou RARIDADE (comum/raro/épico) e recompensa por
 * dificuldade, a pedido do dono. Os nomes antigos continuam exportados daqui
 * para não quebrar quem já os importava.
 */
export type AchievementDef = ConquistaDef;
export const ACHIEVEMENT_DEFS = CONQUISTAS;
export { ehPosParto } from "@/lib/conquistas";

export const getMyAchievements = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: rows } = await db
      .from("patient_achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", u.user.id);
    return {
      ok: true as const,
      unlocked: (rows ?? []) as { achievement_key: string; unlocked_at: string }[],
    };
  });

export const checkAndAwardAchievements = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user)
      return {
        ok: false as const,
        unlocked: [] as { achievement_key: string; unlocked_at: string }[],
        newlyAwarded: [] as string[],
      };
    const uid = u.user.id;
    const toAward: string[] = [];

    toAward.push("first_login");

    const { data: profile } = await db
      .from("patient_profiles")
      .select(
        "display_name, lmp_date, reference_date, reference_weeks, reference_days, birth_date, blood_type, emergency_contact, emergency_phone, height_cm, pre_pregnancy_weight_kg",
      )
      .eq("id", uid)
      .single();
    if (profile) {
      const fields = [
        profile.display_name,
        profile.lmp_date || profile.reference_date,
        profile.blood_type,
        profile.emergency_contact,
        profile.emergency_phone,
        profile.height_cm,
        profile.pre_pregnancy_weight_kg,
      ];
      if (fields.every(Boolean)) toAward.push("profile_complete");
    }

    /* O ciclo — a chave que separa esta gestação da anterior. É a MESMA
       expressão que `loadCycleAndGestation` usa em `sementinhas.functions.ts`
       para montar as `dedupe_key`; ela precisa bater exatamente, senão a
       contagem procura por um ciclo que nunca foi gravado e devolve zero. */
    const cicloAtual = profile?.lmp_date ?? profile?.reference_date ?? profile?.birth_date ?? "x";

    /* ── ⚠️ "7 REGISTROS" VIROU "7 DIAS" ────────────────────────────────────
       As três abaixo são de raridade `raro`, cujo critério declarado em
       `conquistas.ts` é literalmente "repetição sustentada — ela voltou N
       vezes; é hábito, e hábito custa semanas". A implementação contava
       LINHAS (`count: "exact"` sobre a tabela inteira): dava para fechar as
       três salvando dez vezes numa tarde.

       A régua e o código discordavam, e quem tinha razão era a régua — um
       emblema azul de "Semana Saudável" ganho em quinze minutos ensina que a
       cor não quer dizer nada.

       O `first_` continua olhando se existe QUALQUER linha: a primeira vez é
       a primeira vez, não precisa de dia distinto. */
    const { data: healthRows } = await db
      .from("health_logs")
      .select("created_at")
      .eq("user_id", uid);
    const healthLinhas = (healthRows ?? []) as { created_at: string | null }[];
    if (healthLinhas.length >= 1) toAward.push("first_health_log");
    if (diasDistintos(healthLinhas.map((r) => r.created_at)) >= 7) toAward.push("health_7_days");

    const { data: journalRows } = await db
      .from("journal_entries")
      .select("created_at")
      .eq("user_id", uid);
    const journalLinhas = (journalRows ?? []) as { created_at: string | null }[];
    if (journalLinhas.length >= 1) toAward.push("first_journal");
    if (diasDistintos(journalLinhas.map((r) => r.created_at)) >= 10) toAward.push("journal_10");

    const { data: kickRows } = await db
      .from("kick_sessions")
      .select("created_at")
      .eq("user_id", uid);
    const kickLinhas = (kickRows ?? []) as { created_at: string | null }[];
    if (kickLinhas.length >= 1) toAward.push("first_kicks");
    if (diasDistintos(kickLinhas.map((r) => r.created_at)) >= 10) toAward.push("kicks_10");

    const { count: inviteCount } = await db
      .from("companion_invites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((inviteCount ?? 0) >= 1) toAward.push("companion_invited");

    const { count: albumCount } = await db
      .from("family_album_posts")
      .select("*", { count: "exact", head: true })
      .eq("patient_user_id", uid);
    if ((albumCount ?? 0) >= 1) toAward.push("album_post");

    const { data: checkItems } = await db.from("checklist_items").select("done").eq("user_id", uid);
    if (checkItems && checkItems.length > 0 && checkItems.every((c: any) => c.done))
      toAward.push("prenatal_done");

    // ── Conquistas pós-parto (registrar o ato, nunca o resultado clínico) ──
    const { count: bfCount } = await db
      .from("breastfeeding_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((bfCount ?? 0) >= 1) toAward.push("first_breastfeeding");

    const { count: weightCount } = await db
      .from("baby_weights")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((weightCount ?? 0) >= 1) toAward.push("first_baby_weight");

    const { count: vaccineCount } = await db
      .from("baby_vaccines")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((vaccineCount ?? 0) >= 1) toAward.push("first_vaccine");

    const { count: milestoneCount } = await db
      .from("baby_milestones")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((milestoneCount ?? 0) >= 1) toAward.push("first_baby_milestone");

    /* ── AS CONQUISTAS DO JOGO, PROVADAS PELO LEDGER ────────────────────────
       Uma consulta só traz todas as chaves; as contagens saem de funções
       PURAS (`conquistas.ts`), que é o que permite testá-las sem banco.

       ⚠️ São RETROATIVAS por construção: as linhas já existem desde que o
       Caminho existe, então quem já meditou trinta vezes ganha na próxima
       abertura do app, sem migration nenhuma.

       ⚠️ E o ciclo recorta tudo — sem ele, a segunda gestação de uma paciente
       nasceria com as conquistas da primeira já dadas, e ela abriria a aba
       sem nada para conquistar. */
    const { data: ledgerRows } = await db
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .eq("user_id", uid);
    const chaves = ((ledgerRows ?? []) as { dedupe_key: string | null }[]).map((r) => r.dedupe_key);

    const meditou = vezesQueFez(chaves, "meditation", cicloAtual);
    if (meditou >= 1) toAward.push("medita_1");
    if (meditou >= 10) toAward.push("medita_10");
    if (meditou >= 30) toAward.push("medita_30");

    const agradeceu = vezesQueFez(chaves, "gratitude", cicloAtual);
    if (agradeceu >= 1) toAward.push("gratidao_1");
    if (agradeceu >= 10) toAward.push("gratidao_10");
    if (agradeceu >= 50) toAward.push("gratidao_50");

    const leuCarta = vezesQueFez(chaves, "bonding", cicloAtual);
    if (leuCarta >= 1) toAward.push("carta_1");
    if (leuCarta >= 10) toAward.push("carta_10");
    if (leuCarta >= 30) toAward.push("carta_30");

    const mexeu = vezesQueFez(chaves, "movement", cicloAtual);
    if (mexeu >= 1) toAward.push("exercicio_1");
    if (mexeu >= 10) toAward.push("exercicio_10");
    if (mexeu >= 30) toAward.push("exercicio_30");

    const aulas = aulasRespondidas(chaves, cicloAtual);
    /* ⚠️ AS TRÊS DA "ESCOLA" AGORA APONTAM PRA AULA DO DIA.
       Elas liam `course_progress`, e nada escreve nessa tabela: o nó
       `kind: "lesson"` que abriria a Escola não é mais emitido pelo
       construtor da trilha. Eram três conquistas permanentemente impossíveis,
       uma delas ÉPICA, aparecendo como "🔒 bloqueada" para sempre.
       As chaves ficam (ninguém perde o que já ganhou); o que mudou é a fonte,
       e o texto delas foi reescrito em `conquistas.ts` para dizer a verdade. */
    if (aulas >= 1) toAward.push("first_course");
    if (aulas >= 5) toAward.push("course_5");
    if (aulas >= 10) toAward.push("aula_10");
    if (aulas >= 50) toAward.push("aula_50");
    if (aulas >= 100) toAward.push("course_complete");

    /* Dias fechados. A MESMA função que o troféu do topo do Caminho usa —
       duas contagens para a palavra "dia fechado" divergiriam no primeiro
       conserto, e aí o número do topo e a medalha diriam coisas diferentes. */
    const diasFechados = trofeusDasChaves(
      chaves.filter((k) => (k ?? "").startsWith(PREFIXO_ATIVIDADE)),
      ATIVIDADES_DO_DIA,
    );
    if (diasFechados >= 1) toAward.push("trofeu_1");
    if (diasFechados >= 10) toAward.push("trofeu_10");
    if (diasFechados >= 30) toAward.push("trofeu_30");

    const sequencia = maiorSequencia(chaves, cicloAtual);
    if (sequencia >= 7) toAward.push("sequencia_7");
    if (sequencia >= 30) toAward.push("sequencia_30");

    const { count: itensDoCantinho } = await db
      .from("cantinho_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    if ((itensDoCantinho ?? 0) >= 1) toAward.push("cantinho_1");
    if ((itensDoCantinho ?? 0) >= 10) toAward.push("cantinho_10");

    // Chaves já desbloqueadas antes desta checagem, para detectar as novas
    // (permite que os pontos de ação exibam um toast de "nova conquista").
    const { data: existingRows } = await db
      .from("patient_achievements")
      .select("achievement_key")
      .eq("user_id", uid);
    const existing = new Set(
      ((existingRows ?? []) as { achievement_key: string }[]).map((r) => r.achievement_key),
    );
    const newlyAwarded = toAward.filter((key) => !existing.has(key));

    if (toAward.length > 0) {
      const { error } = await db.from("patient_achievements").upsert(
        toAward.map((key) => ({ user_id: uid, achievement_key: key })),
        { onConflict: "user_id,achievement_key", ignoreDuplicates: true },
      );
      /* `newlyAwarded` é o que dispara a celebração na tela — e ele é
         calculado ANTES desta escrita. Se ela falhar, a conquista é celebrada
         e não fica: na próxima checagem ela é "nova" de novo, e a mesma
         medalha aparece toda vez, como se o app não guardasse nada. */
      if (error) console.error("[conquistas] concessão não gravou", uid, error);
    }

    // 🌱 Sementinhas: recompensa por conquistas + marcos de semana/trimestre.
    // Tudo idempotente (dedupe_key), então rodar a cada checagem se auto-corrige
    // sem conceder em dobro. Ganho só por ação/educação/marco — nunca por
    // resultado clínico.
    /* ⚠️ A RECOMPENSA SAI DA RARIDADE, e não mais de uma lista de exceções.
       Antes eram dois valores (`achievementBig` para duas chaves cravadas num
       `Set`, `achievementDefault` para todo o resto) — o que significava que
       "primeira mamada" e "10 sessões de chutes" pagavam igual. Pedido do
       dono: mais dificuldade, mais Sementinhas. A régua agora é a mesma que
       pinta o anel do cartão, então o número e a cor nunca podem discordar.

       Chave sem def conhecida cai no valor de `comum`: é o piso, e é o que
       impede uma conquista nova de pagar 0 por esquecimento. */
    /* ─── ⚠️ A CONQUISTA NÃO PAGA MAIS SOZINHA ──────────────────────────────
       Pedido do dono, ago/2026: "a pessoa só vai pegar as sementinhas quando
       ela clicar em cima daquela conquista. Hoje é o que o Duolingo faz".

       A concessão do prêmio saiu daqui e virou `resgatarConquista`. O que
       continua acontecendo nesta função é o DESBLOQUEIO — a linha em
       `patient_achievements`, que é o que faz o cartão acender.

       Por que a mudança vale: o prêmio automático chegava como um número que
       subia sozinho enquanto ela estava noutra tela. O toque transforma o
       mesmo prêmio num gesto dela, e é ele que faz a paciente ABRIR a aba —
       que é onde as outras 38 conquistas estão à vista.

       ⚠️ Os MARCOS abaixo (semana, trimestre, nascimento, mês do bebê)
       continuam automáticos, e é de propósito: não existe cartão para tocar,
       ninguém "conquistou" a semana 22 — ela chegou. Prêmio sem gesto precisa
       de um dono, e o dono deles é o calendário. */
    const grants: { amount: number; reason: string; dedupeKey: string }[] = [];
    // Marcos escopados à GESTAÇÃO/bebê atual (LMP/referência/nascimento) — senão,
    // numa 2ª gravidez os marcos já teriam sido "consumidos" na 1ª.
    const cycle = cicloAtual;
    if (profile?.birth_date) {
      // ── Pós-nascimento: para o ganho gestacional (que cresceria pra sempre)
      // e passa a recompensar a jornada do bebê. ──
      grants.push({
        amount: SEMENTINHAS.trimesterMilestone,
        reason: "Bem-vindo ao mundo 🍼",
        dedupeKey: `born:${cycle}`,
      });
      const ageDays = Math.floor(
        (Date.now() - new Date(profile.birth_date + "T00:00:00").getTime()) / 86400000,
      );
      const months = Math.floor(ageDays / 30);
      if (months >= 1)
        grants.push({
          amount: SEMENTINHAS.weekMilestone,
          reason: `Bebê com ${months} ${months === 1 ? "mês" : "meses"} 🎉`,
          dedupeKey: `babymonth:${cycle}:${months}`,
        });
    } else {
      const gest = computeGestation({
        lmp: profile?.lmp_date ?? null,
        referenceDate: profile?.reference_date ?? null,
        referenceWeeks: profile?.reference_weeks ?? null,
        referenceDays: profile?.reference_days ?? null,
      });
      if (gest) {
        // Marco da semana atual: presente por avançar, não por performance.
        grants.push({
          amount: SEMENTINHAS.weekMilestone,
          reason: `Semana ${gest.weeks} 🎉`,
          dedupeKey: `week:${cycle}:${gest.weeks}`,
        });
        if (gest.weeks >= 13)
          grants.push({
            amount: SEMENTINHAS.trimesterMilestone,
            reason: "Fim do 1º trimestre 🎊",
            dedupeKey: `trimester:${cycle}:1`,
          });
        if (gest.weeks >= 27)
          grants.push({
            amount: SEMENTINHAS.trimesterMilestone,
            reason: "Fim do 2º trimestre 🎊",
            dedupeKey: `trimester:${cycle}:2`,
          });
      }
    }
    // Modo Cuidado: não concede Sementinhas nem sinaliza comemoração ao cliente.
    const careMode = await isCareModeActive(supabaseAdmin, uid);
    if (!careMode) await grantSementinhas(db, uid, grants);

    const { data: rows } = await db
      .from("patient_achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", uid);
    return {
      ok: true as const,
      unlocked: (rows ?? []) as { achievement_key: string; unlocked_at: string }[],
      /**
       * Quais já foram RESGATADAS — ver `chavesResgatadas`.
       *
       * ⚠️ `null` é "não consegui ler", e é DIFERENTE de `[]` ("nenhuma
       * resgatada ainda"). A tela precisa dos dois separados: com a lista
       * vazia ela pinta tudo como pendente, e é exatamente isso que NÃO pode
       * acontecer numa falha de leitura.
       */
      resgatadas: await chavesResgatadas(db, uid),
      newlyAwarded,
      careMode,
    };
  });

/** Prefixo da linha do ledger que marca uma conquista como já paga. */
export const PREFIXO_CONQUISTA = "achievement:";

/**
 * QUAIS CONQUISTAS JÁ FORAM PAGAS.
 *
 * ⚠️ A fonte é o LEDGER, e não uma coluna nova. A linha
 * `achievement:<chave>` já existia — só mudou de MOMENTO: era escrita no
 * desbloqueio, e agora é escrita no resgate. Nada de migration, e nada de dois
 * lugares dizendo a mesma coisa.
 *
 * De quebra isso resolve sozinho o caso de quem já usava o app: quem recebeu o
 * prêmio automático antes desta mudança tem a linha, então a conquista aparece
 * como já resgatada — que é exatamente o certo. O app não vai pagar de novo
 * nem pedir que ela toque no que já recebeu.
 *
 * ─── ⚠️ FALHA DE LEITURA ERRA PARA O LADO DE «JÁ PAGA» ──────────────────────
 *
 * `null` diz "não sei", e os dois lados do não-sei têm custos MUITO diferentes:
 *
 *  · errando para "não paga", as 39 conquistas voltam a pulsar
 *    "Resgatar +120 🌱" de uma vez. Ela toca, o servidor responde certíssimo
 *    (`repetido: true`) e o cartão só vira uma data — o app promete moeda e
 *    não entrega, que é a forma mais rápida de ensinar que os avisos daqui
 *    não valem leitura;
 *  · errando para "paga", um resgate legítimo espera a próxima abertura.
 *
 * É a mesma régua de `contarTrofeus` ("falha ao contar RECUSA") e do lembrete
 * de pré-consulta ("falha ao ler trata como já respondeu"): na dúvida, não
 * prometer.
 *
 * Quem decide o que fazer com o `null` é `resgatePendente` — a tela não pode
 * confundir "sem conquista paga" (lista vazia) com "não consegui ler".
 */
async function chavesResgatadas(
  db: ReturnType<typeof typedDb>,
  uid: string,
): Promise<string[] | null> {
  const { data, error } = await db
    .from("sementinhas_ledger")
    .select("dedupe_key")
    .eq("user_id", uid)
    .like("dedupe_key", `${PREFIXO_CONQUISTA}%`);
  if (error || !data) return null;
  return (data as { dedupe_key: string | null }[])
    .map((r) => r.dedupe_key ?? "")
    .filter((k) => k.startsWith(PREFIXO_CONQUISTA))
    .map((k) => k.slice(PREFIXO_CONQUISTA.length));
}

/**
 * RESGATAR UMA CONQUISTA — o toque que paga.
 *
 * ⚠️ Confere o DESBLOQUEIO no banco antes de pagar. Sem essa linha, qualquer
 * chave enviada no corpo do pedido viraria Sementinhas — o mesmo defeito que
 * `contatoDaPaciente` teve no painel, e a razão de a compra do Cantinho
 * revalidar o preço pelo catálogo do servidor.
 *
 * ⚠️ Idempotente pela `dedupe_key`, que é a única coisa entre um toque nervoso
 * e dois pagamentos. Achar a linha já gravada NÃO é erro: é sucesso repetido,
 * marcado com `repetido` para a tela não festejar duas vezes. Devolver erro
 * aqui faria ela tocar DE NOVO achando que não funcionou.
 */
export const resgatarConquista = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), key: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (error || !u.user) return { ok: false as const, error: "Sua sessão expirou." };
      const uid = u.user.id;
      const db = typedDb(supabaseAdmin);

      const def = conquistaPorChave(data.key);
      if (!def) return { ok: false as const, error: "Conquista inexistente." };

      /* Modo Cuidado: nada de comemoração nem de moeda. O mesmo portão da
         loja, do saldo e das Amigas. */
      if (await isCareModeActive(supabaseAdmin, uid)) {
        return { ok: true as const, granted: 0, repetido: false };
      }

      const { data: linha } = await db
        .from("patient_achievements")
        .select("achievement_key")
        .eq("user_id", uid)
        .eq("achievement_key", data.key)
        .maybeSingle();
      if (!linha) return { ok: false as const, error: "Essa conquista ainda não é sua." };

      const dedupeKey = `${PREFIXO_CONQUISTA}${data.key}`;
      const { data: paga } = await db
        .from("sementinhas_ledger")
        .select("amount")
        .eq("user_id", uid)
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      if (paga) return { ok: true as const, granted: 0, repetido: true };

      const amount = sementinhasDaRaridade(def.raridade);
      await grantSementinhas(db, uid, [{ amount, reason: `Conquista: ${def.title}`, dedupeKey }]);
      return { ok: true as const, granted: amount, repetido: false };
    } catch {
      return { ok: false as const, error: "Não consegui resgatar agora." };
    }
  });
