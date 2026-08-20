import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { grantSementinhas, SEMENTINHAS } from "@/lib/sementinhas.functions";
import { isCareModeActive } from "@/lib/care-mode.functions";

/**
 * Indicar uma amiga → 100 Sementinhas 🌱 quando ela cria a conta.
 *
 * Cada paciente tem um código (referral_code). A amiga entra pelo link
 * (?amiga=CODE), cria a conta e, na 1ª visita logada, o app chama
 * attributeReferral: fixa `referred_by` (uma vez) e credita 100 🌱 à indicadora
 * — uma vez por amiga (dedupe pelo id da amiga). Sem auto-indicação, sem trocar
 * a indicação depois. Crédito sempre server-only.
 */

export const REFERRAL_REWARD = 100;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I (menos confusão)

async function authUid(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

function randomCode(len = 7): string {
  const b = new Uint8Array(len);
  globalThis.crypto.getRandomValues(b);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[b[i] % ALPHABET.length];
  return out;
}

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Lê (e cria, se preciso) o código de indicação da paciente + nº de indicações. */
export const getReferral = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: prof } = await sb
      .from("patient_profiles")
      .select("referral_code")
      .eq("id", uid)
      .maybeSingle();
    let code: string | null = prof?.referral_code ?? null;

    // Gera na primeira vez (tenta poucas vezes em caso de colisão do índice único).
    if (!code) {
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const candidate = randomCode();
        const { error } = await sb
          .from("patient_profiles")
          .update({ referral_code: candidate })
          .eq("id", uid)
          .is("referral_code", null);
        if (!error) {
          const { data: check } = await sb
            .from("patient_profiles")
            .select("referral_code")
            .eq("id", uid)
            .maybeSingle();
          code = check?.referral_code ?? null;
        }
      }
    }

    const { count } = await sb
      .from("patient_profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", uid);

    return { ok: true as const, code, count: count ?? 0 };
  });

/**
 * Atribui a indicação da amiga logada (uid) a quem tem o código `code` e credita
 * 100 🌱 à indicadora. Idempotente: só age se a amiga ainda não tem
 * `referred_by`. Sem auto-indicação. Chamado na 1ª visita logada com o código
 * guardado do link.
 */
export const attributeReferral = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), code: z.string().min(3).max(20) }).parse(i),
  )
  .handler(async ({ data }) => {
    const code = normalizeCode(data.code);
    if (code.length < 3) return { ok: true as const, attributed: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // A indicação SÓ conta se a amiga REALMENTE fez login no site: precisa de um
    // token válido E de e-mail confirmado (o app exige confirmar o e-mail antes
    // de logar — ver src/routes/auth.tsx). Uma conta apenas criada, sem login/
    // confirmação, NÃO credita a indicadora. `retry` mantém o código guardado
    // até a amiga confirmar e logar.
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const confirmed = Boolean(
      u.user.email_confirmed_at ?? (u.user as { confirmed_at?: string | null }).confirmed_at,
    );
    if (!confirmed) return { ok: true as const, attributed: false, retry: true };
    const uid = u.user.id;

    // Já indicada? (fixado uma vez) — nada a fazer.
    const { data: me } = await sb
      .from("patient_profiles")
      .select("referred_by")
      .eq("id", uid)
      .maybeSingle();
    // Perfil ainda não criado (amiga recém-chegada): pede pra tentar de novo.
    if (!me) return { ok: true as const, attributed: false, retry: true };
    if (me.referred_by) return { ok: true as const, attributed: false };

    // Quem é a indicadora?
    const { data: ref } = await sb
      .from("patient_profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    const referrerId: string | undefined = ref?.id;
    if (!referrerId || referrerId === uid) return { ok: true as const, attributed: false };

    /* Fixa a indicação SÓ se ainda está nula (evita corrida / troca posterior).
       Já falhava seguro — sem linha de volta, ninguém é recompensado. O que
       faltava era distinguir "outra pessoa chegou antes" (normal) de "a
       escrita foi recusada" (defeito), porque os dois davam exatamente o mesmo
       silêncio e o segundo custa a recompensa de uma indicação real.
       O `retry: true` faz a tela tentar de novo mais tarde. */
    const { data: claimed, error: claimErr } = await sb
      .from("patient_profiles")
      .update({ referred_by: referrerId })
      .eq("id", uid)
      .is("referred_by", null)
      .select("id");
    if (claimErr) {
      console.error("[indicação] atribuição recusada pelo banco", uid, claimErr);
      return { ok: true as const, attributed: false, retry: true };
    }
    if (!claimed || claimed.length === 0) return { ok: true as const, attributed: false };

    // Credita a indicadora: 100 🌱 por amiga (dedupe pelo id da amiga), fora do
    // Modo Cuidado da indicadora. Best-effort — a atribuição já está fixada.
    /* ⚠️ UMA leitura do Modo Cuidado da indicadora, e não três. Ela decide a
       moeda, o push e o seguir — e este caminho roda no PRIMEIRO login de toda
       conta nova. Ler a mesma linha três vezes seguidas é desperdício num
       lugar em que ele custa a primeira impressão do app. */
    const refEmCuidado = await isCareModeActive(supabaseAdmin, referrerId);

    try {
      if (!refEmCuidado) {
        await grantSementinhas(typedDb(supabaseAdmin), referrerId, [
          {
            amount: REFERRAL_REWARD,
            reason: "Indicou uma amiga 👭",
            dedupeKey: `referral:${uid}`,
          },
        ]);
      }
    } catch (e) {
      console.error("[referral] reward failed", e);
    }

    /* ─── ⚠️ E A INDICADORA PRECISA SABER QUE A AMIGA CHEGOU ─────────────
       As 100 🌱 caíam em silêncio: o saldo dela subia e nada dizia por quê.
       Este é o momento de maior afeto do recurso inteiro — alguém aceitou o
       convite dela — e ele passava em branco.

       É a mesma lição do presente do médico ("saldo que sobe sozinho é
       indistinguível de bug"), e aqui há um segundo motivo: o push é o que faz
       ela ABRIR a aba das Amigas e encontrar a recém-chegada lá, que é onde a
       dupla e o presente vivem. Sem ele, a amiga entra e as duas nunca se
       encontram dentro do app.

       ⚠️ Modo Cuidado: o `isCareModeActive` acima já barrou a moeda. O aviso
       vai DENTRO do mesmo portão pela mesma razão — quem acabou de perder a
       gestação não recebe festa nenhuma.

       Best-effort: a atribuição já está fixada e não depende disto. */
    try {
      if (!refEmCuidado) {
        const { data: amiga } = await sb
          .from("patient_profiles")
          .select("display_name")
          .eq("id", uid)
          .maybeSingle();
        const nome =
          ((amiga?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "Uma amiga";
        const { sendPushToUser } = await import("@/lib/push.server");
        await sendPushToUser(referrerId, {
          title: `${nome} entrou pelo seu convite 💛`,
          body: `Vocês já estão conectadas — e você ganhou ${REFERRAL_REWARD} Sementinhas.`,
          url: "/minha-conta?tab=Amigas",
        });
      }
    } catch (e) {
      console.error("[referral] push failed", e);
    }

    /* ─── ⚠️ E AS DUAS PASSAM A SE SEGUIR NA COMUNIDADE ──────────────────
       A atribuição entregava a AMIZADE (Cantinho, dupla, presente, a camada
       `amigas` do feed) e não entregava a única coisa que faz um feed existir:
       ter alguém para ver. Na aba da Comunidade as duas continuavam invisíveis
       uma para a outra, e a indicadora tinha de ir à BUSCA procurar pelo nome
       da amiga que ela mesma acabou de trazer.

       Seguir é estritamente MENOS que o vínculo recém-criado — a régua inteira
       está em `seguir-apos-convite.ts`, com o portão de Modo Cuidado dentro.

       Best-effort, como a moeda e o push: a atribuição já está fixada, e
       derrubá-la por causa de duas linhas decorativas faria a amiga tentar de
       novo e o `referred_by` já estar preenchido — ou seja, perder a indicação
       de vez. */
    try {
      const { deveLigarNaRede, paresDoSeguir } = await import("@/lib/seguir-apos-convite");
      if (
        deveLigarNaRede({
          indicadoraEmCuidado: refEmCuidado,
          /* ⚠️ A recém-chegada também é conferida: a atribuição pode acontecer
             semanas depois (o código fica 60 dias no navegador), e nesse meio
             tempo ela pode ter ligado o Modo Cuidado. */
          novaEmCuidado: await isCareModeActive(supabaseAdmin, uid),
          mesmaPessoa: referrerId === uid,
        })
      ) {
        for (const par of paresDoSeguir(referrerId, uid)) {
          /* ⚠️ `insert` e não `upsert`: quem dedupa é o índice único do par, e
             `23505` aqui é sucesso repetido — a amiga pode já seguir a
             indicadora por conta própria. */
          const { error } = await sb.from("rede_seguidores").insert(par);
          if (error && (error as any).code !== "23505") {
            console.warn("[referral] seguir não gravou", error);
            break;
          }
        }
      }
    } catch (e) {
      console.error("[referral] seguir falhou", e);
    }

    return { ok: true as const, attributed: true };
  });
