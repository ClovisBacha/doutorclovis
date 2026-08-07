/**
 * Convites premium — o médico Elite/Black gera um código NA HORA e envia como
 * quiser. Cada código é de USO ÚNICO; a paciente digita e ganha o premium.
 *
 *   - getMyInviteInfo: (médico) elegibilidade + cota do mês (gerados/limite).
 *   - generateInviteCode: (médico) cria um código novo e único na hora.
 *   - redeemInviteCode: (paciente) resgata um código válido não usado.
 *
 * A cota mensal conta os códigos GERADOS no mês (Elite 25, Black 250). Tudo
 * escrito via service_role; a UI nunca concede acesso.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Início do mês corrente (UTC) em ISO — para contar a cota do mês. */
function monthStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Código legível de 8 caracteres (sem 0/O/1/I para não confundir). */
function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function loadDoctor(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  if (!u.user) return { supabaseAdmin, user: null, doc: null as any, convitesPorMes: 0 };
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,plan,active")
    .eq("id", u.user.id)
    .maybeSingle();
  /* ─── O TETO VEM DO RESOLVEDOR, NÃO DA COLUNA CRUA ──────────────────────────
   * Era `entitlementsFor(doc.plan)` nos dois pontos que leem a cota. A coluna
   * `plan` sozinha ignora TRÊS coisas que só o resolvedor conhece:
   *   · o vencimento (`plan_expires_at` nem era selecionado aqui) — um Elite
   *     com o cartão recusado seguia com 25 convites premium por mês;
   *   · o assento de clínica — um membro cuja clínica é Clínica não recebia;
   *   · o dono da instalação (ADMIN_EMAILS).
   * A assimetria estava no MESMO arquivo: o caminho de RESGATE já consultava o
   * resolvedor. Duas verdades sobre o mesmo médico, uma em cada ponta do
   * mesmo recurso.
   * Calculado UMA vez aqui para que os dois chamadores não possam divergir —
   * foi assim que eles divergiram do resgate. */
  const { getEntitlements } = await import("./entitlements.server");
  const ent = doc ? await getEntitlements(u.user) : null;
  const convitesPorMes: number = doc?.active && ent ? (ent.premiumInvitesPerMonth ?? 0) : 0;
  return { supabaseAdmin, user: u.user, doc, convitesPorMes };
}

async function monthlyUsed(supabaseAdmin: any, doctorId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", doctorId)
    .gte("created_at", monthStartISO());
  return count ?? 0;
}

export type InviteInfo = {
  eligible: boolean; // o plano do médico dá convites?
  limit: number;
  used: number;
  remaining: number;
};

export const getMyInviteInfo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }): Promise<{ ok: false } | ({ ok: true } & InviteInfo)> => {
    const { supabaseAdmin, doc, convitesPorMes } = await loadDoctor(data.accessToken);
    if (!doc) return { ok: false as const };
    const limit = convitesPorMes;
    if (limit <= 0) return { ok: true as const, eligible: false, limit: 0, used: 0, remaining: 0 };
    const used = await monthlyUsed(supabaseAdmin, doc.id);
    return {
      ok: true as const,
      eligible: true,
      limit,
      used,
      remaining: Math.max(0, limit - used),
    };
  });

export const generateInviteCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin, doc, convitesPorMes } = await loadDoctor(data.accessToken);
    if (!doc) return { ok: false as const, error: "sem_perfil" };
    const limit = convitesPorMes;
    if (limit <= 0) return { ok: false as const, error: "sem_convites" };

    const used = await monthlyUsed(supabaseAdmin, doc.id);
    if (used >= limit) return { ok: false as const, error: "cota_esgotada" };

    // Gera um código único (retenta em colisão de UNIQUE).
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = genCode();
      const { error } = await (supabaseAdmin as any)
        .from("invite_codes")
        .insert({ code, doctor_id: doc.id });
      if (!error) {
        return { ok: true as const, code, used: used + 1, limit, remaining: limit - used - 1 };
      }
      if (error.code !== "23505") return { ok: false as const, error: "falha_geracao" };
    }
    return { ok: false as const, error: "falha_geracao" };
  });

export const redeemInviteCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), code: z.string().min(4).max(16) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, error: "nao_autenticado" };

    const code = data.code.trim().toUpperCase();

    // 1) Cupom de PLATAFORMA (gerado pelo super-admin) tem prioridade. Pode
    //    ter vários usos; 1 resgate por usuário (idempotente). Tabela ausente
    //    (migração pendente) → cai para o convite do médico abaixo.
    try {
      const sb = supabaseAdmin as any;
      const { data: pc } = await sb
        .from("platform_coupons")
        .select("id,active,max_redemptions")
        .eq("code", code)
        .maybeSingle();
      if (pc) {
        if (!pc.active) return { ok: false as const, error: "codigo_invalido" };
        const { data: mine } = await sb
          .from("platform_coupon_redemptions")
          .select("user_id")
          .eq("coupon_id", pc.id)
          .eq("user_id", u.user.id)
          .maybeSingle();
        if (!mine) {
          // Insere PRIMEIRO (a PK torna a contagem pós-insert autoritativa) e,
          // se ultrapassou o teto, reverte o próprio resgate — fecha a janela
          // TOCTOU em que dois usuários simultâneos furariam max_redemptions.
          const ins = await sb
            .from("platform_coupon_redemptions")
            .insert({ coupon_id: pc.id, user_id: u.user.id });
          if (ins.error && ins.error.code !== "23505")
            return { ok: false as const, error: "codigo_usado" };
          if (pc.max_redemptions != null) {
            const { count } = await sb
              .from("platform_coupon_redemptions")
              .select("user_id", { count: "exact", head: true })
              .eq("coupon_id", pc.id);
            if ((count ?? 0) > pc.max_redemptions) {
              await sb
                .from("platform_coupon_redemptions")
                .delete()
                .eq("coupon_id", pc.id)
                .eq("user_id", u.user.id);
              return { ok: false as const, error: "codigo_usado" };
            }
          }
        }
        /* O RESGATE JÁ FOI GRAVADO acima. Se a concessão do premium falhar em
           silêncio, o cupom foi QUEIMADO e ela não recebeu nada — e, sendo
           uso único, tentar de novo devolve "codigo_usado". Ou o premium
           entra, ou o resgate volta atrás. */
        const { error: premErr } = await sb
          .from("patient_profiles")
          .update({ quiz_premium: true })
          .eq("id", u.user.id);
        if (premErr) {
          await sb
            .from("platform_coupon_redemptions")
            .delete()
            .eq("coupon_id", pc.id)
            .eq("user_id", u.user.id);
          console.error("[cupom] falha ao liberar premium; resgate desfeito", premErr);
          return { ok: false as const, error: "falha_ao_liberar" };
        }
        // Origem 'cupom' → o premium sobrevive ao toggle manual (mesma
        // proteção de stripe/doctor_invite/convite).
        /* O `try/catch` que estava aqui dizia "opcional" e não protegia nada:
           o supabase-js não LANÇA quando o Postgres recusa, ele devolve
           `{ error }`. O catch nunca disparou uma vez sequer.
           E o efeito de perder esta linha não é nenhum: o premium concedido
           acima passa a ser revogável por um toggle manual, silenciosamente.
           Não derruba o resgate — ela ficou premium —, mas precisa aparecer. */
        const { error: subErr } = await sb.from("subscriptions").upsert(
          {
            user_id: u.user.id,
            product: "quiz_premium",
            plan: "cupom",
            source: "cupom",
            status: "active",
            stripe_subscription_id: `cupom_${pc.id}_${u.user.id}`,
          },
          { onConflict: "stripe_subscription_id" },
        );
        if (subErr) {
          console.error("[cupom] premium concedido sem marca de origem", u.user.id, subErr);
        }
        return { ok: true as const };
      }
    } catch {
      /* tabela ausente → segue para o convite do médico */
    }

    // 2) Convite do MÉDICO (invite_codes) — uso único, vincula ao médico.
    const { data: row } = await (supabaseAdmin as any)
      .from("invite_codes")
      .select("id,doctor_id,redeemed_by")
      .eq("code", code)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "codigo_invalido" };

    // Já usado por OUTRA paciente? Uso único.
    if (row.redeemed_by && row.redeemed_by !== u.user.id) {
      return { ok: false as const, error: "codigo_usado" };
    }

    // Marca como resgatado (idempotente para a mesma paciente). A condição
    // redeemed_by IS NULL evita corrida: só a 1ª resgata.
    if (!row.redeemed_by) {
      const { data: upd } = await (supabaseAdmin as any)
        .from("invite_codes")
        .update({ redeemed_by: u.user.id, redeemed_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("redeemed_by", null)
        .select("id");
      if (!upd || upd.length === 0) {
        // Alguém resgatou no meio-tempo.
        return { ok: false as const, error: "codigo_usado" };
      }
    }

    /* ─── O CÓDIGO DO MÉDICO VIROU DESCONTO, NÃO PREMIUM DE GRAÇA ─────────
       DECISÃO DO DONO (ago/2026). Aqui havia um
       `patient_profiles.update({ quiz_premium: true })`: o médico dava a
       assinatura inteira, de graça, para um punhado de pacientes por mês.

       Agora ele dá 20% de desconto, nos dois planos, enquanto ela for
       assinante. Nada é concedido neste ponto — `redeemed_by`, marcado logo
       acima, É o cupom: `lerPrecos` procura por ele e o checkout aplica a
       porcentagem no Stripe.

       Ou seja, esta etapa deixou de ter uma escrita que podia falhar em
       silêncio e deixar o convite consumido sem ela receber nada. O que ela
       ganha passou a ser consequência da MESMA linha que marca o resgate. */

    let semVaga = false;
    // Vincula ao médico só se a paciente ainda não tem um (não "rouba").
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", u.user.id)
      .maybeSingle();
    if (prof && !prof.doctor_id) {
      /* O TETO DE PACIENTES do plano vale aqui também.
         
         Este era o terceiro caminho de vínculo e o único sem a checagem: os
         outros dois (`respondPatientRequest` e `chooseDoctor`) contam as
         pacientes antes de ligar mais uma, e este ligava direto. Um médico no
         Free (5 pacientes) podia passar do teto distribuindo códigos — o
         limite existia em dois lugares e vazava no terceiro.
         
         Passando do teto, o cupom Premium dela continua valendo: ela ganhou o
         que o código prometia. O que não acontece é o vínculo — e é o médico
         que precisa resolver isso, fazendo upgrade. */
      let podeVincular = true;
      try {
        const { getEntitlementsByDoctorId } = await import("./entitlements.server");
        const ent = await getEntitlementsByDoctorId(row.doctor_id as string);
        if (ent.maxPatients != null) {
          const { count, error: cntErr } = await (supabaseAdmin as any)
            .from("patient_profiles")
            .select("id", { count: "exact", head: true })
            .eq("doctor_id", row.doctor_id);
          /* Fail-CLOSED: se a contagem falhar, não vincula. O outro caminho
             erra para o lado de vincular; aqui, sem interação humana do outro
             lado, o silêncio tem de ser o lado seguro. */
          if (cntErr || (count ?? 0) >= ent.maxPatients) podeVincular = false;
        }
      } catch {
        podeVincular = false;
      }
      if (podeVincular) {
        /* O vínculo é o que o médico comprou ao distribuir o código. Se ele
           não gravar, ela sai "premium sem médico" e ninguém fica sabendo —
           nem ela, que viu "código aplicado", nem ele, que contou com a
           paciente. `semVaga` já existe para dizer "premium sim, vínculo não";
           é exatamente esse estado, e a tela dela já sabe explicá-lo. */
        const { error: vincErr } = await (supabaseAdmin as any)
          .from("patient_profiles")
          .update({ doctor_id: row.doctor_id })
          .eq("id", u.user.id);
        /* O bônus de vínculo — mesma função dos outros dois caminhos. */
        {
          const { bonusDeVinculo } = await import("@/lib/sementinhas.functions");
          await bonusDeVinculo(supabaseAdmin, u.user.id, row.doctor_id as string);
        }
        if (vincErr) {
          console.error("[convite] premium liberado, vínculo não gravou", row.id, vincErr);
          semVaga = true;
        }
      } else {
        /* Não vinculou porque o plano dele está no teto. Ela precisa saber:
           antes a tela dizia "código aplicado" e ela ficava sem médico sem
           entender por quê — e ele nunca soube que perdeu uma paciente para o
           próprio limite. O Premium dela continua valendo. */
        semVaga = true;
      }
    }

    /* Registro em subscriptions (origem convite): é o que faz o premium dela
       sobreviver a um toggle manual. Não trava o resgate — ela já é premium —,
       mas perder isto em silêncio significa que um dia o premium some sem
       explicação, e o `catch` que estava aqui nunca disparou: o supabase-js
       devolve `{ error }`, não lança. */
    const { error: subErr } = await (supabaseAdmin as any).from("subscriptions").upsert(
      {
        user_id: u.user.id,
        product: "quiz_premium",
        plan: "invite",
        source: "doctor_invite",
        status: "active",
        stripe_subscription_id: `invite_${row.id}`,
      },
      { onConflict: "stripe_subscription_id" },
    );
    if (subErr) {
      console.error("[convite] premium concedido sem marca de origem", u.user.id, subErr);
    }

    return { ok: true as const, semVaga };
  });
