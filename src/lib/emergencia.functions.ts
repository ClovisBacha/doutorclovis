/**
 * Disparo de emergência — o que acontece quando ela toca no SOS.
 *
 * O botão antigo montava uma mensagem e abria o WhatsApp: quem enviava era
 * ela. Numa emergência de verdade isso é frágil — quem está passando mal, com
 * a visão embaçada ou prestes a desmaiar, pode não concluir. E o app dizia
 * "enviado" mesmo assim.
 *
 * Agora o envio é do SERVIDOR, num toque só, por todos os canais que existirem
 * para aquela paciente:
 *
 *   1. PUSH para o médico dela — chega no celular dele em segundos;
 *   2. E-MAIL para o médico dela — o canal que não depende de ele ter
 *      autorizado notificação no navegador;
 *   3. E-MAIL para o contato de emergência — se ela cadastrou o e-mail dele;
 *   4. SMS/WhatsApp para o contato — via webhook configurável (ver abaixo).
 *
 * A resposta diz QUAIS canais saíram, e a tela mostra isso. Nada de "enviado"
 * genérico: se só o médico foi avisado, ela precisa saber que o marido ainda
 * não sabe — e é aí que o WhatsApp manual continua valendo, agora como o que
 * FALTA e não como o que foi feito.
 *
 * ── Webhook de SMS/WhatsApp (opcional) ────────────────────────────────────
 * `SOS_SMS_WEBHOOK_URL` recebe um POST `{ "to": "+5531...", "text": "..." }`,
 * com `Authorization: Bearer SOS_SMS_WEBHOOK_TOKEN` se o token existir.
 * É de propósito genérico: aponte para o Twilio, Zenvia, WhatsApp Cloud API ou
 * um n8n/Zapier no meio. Sem a variável, o canal simplesmente não existe e a
 * tela avisa que falta o contato — nunca finge que mandou.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DOCTOR } from "@/lib/doctor.config";

export type CanaisAviso = {
  /** Quantos aparelhos do médico receberam o push. */
  medicoPush: number;
  medicoEmail: boolean;
  contatoEmail: boolean;
  sms: boolean;
  /** Nome de quem foi avisado, para a tela dizer sem inventar. */
  avisados: string[];
  /** Nome do contato que NÃO recebeu nada — a tela oferece o WhatsApp dele. */
  faltou: string | null;
};

function textoDoAviso(p: {
  nome: string;
  semana: string | null;
  sangue: string | null;
  alergias: string | null;
  endereco: string | null;
  mapa: string | null;
}): string {
  return [
    `${p.nome} acionou o botão de emergência do app Obstétrica.`,
    p.semana ? `Gestante de ${p.semana}.` : null,
    p.sangue ? `Tipo sanguíneo: ${p.sangue}.` : null,
    p.alergias ? `Alergias: ${p.alergias}.` : null,
    p.endereco ? `Local: ${p.endereco}` : null,
    p.mapa ?? "Não foi possível obter a localização.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const dispararEmergencia = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
        address: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio: CanaisAviso = {
      medicoPush: 0,
      medicoEmail: false,
      contatoEmail: false,
      sms: false,
      avisados: [],
      faltou: null,
    };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return { ok: false as const, canais: vazio };

      const sb = supabaseAdmin as any;
      const { data: prof } = await sb
        .from("patient_profiles")
        .select(
          "display_name, blood_type, allergies, emergency_contact, emergency_phone, emergency_email, doctor_id, lmp_date, reference_date, reference_weeks, reference_days",
        )
        .eq("id", u.user.id)
        .maybeSingle();

      const nome = (prof?.display_name as string) || "Uma paciente";
      const mapa =
        data.latitude != null && data.longitude != null
          ? `https://maps.google.com/?q=${data.latitude},${data.longitude}`
          : null;

      // A semana sai do mesmo cálculo do app; se não der, o aviso vai sem ela
      // em vez de segurar o disparo.
      let semana: string | null = null;
      try {
        const { computeGestation } = await import("@/lib/gestacao");
        const g = computeGestation({
          lmp: (prof?.lmp_date as string) ?? null,
          referenceDate: (prof?.reference_date as string) ?? null,
          referenceWeeks: (prof?.reference_weeks as number) ?? null,
          referenceDays: (prof?.reference_days as number) ?? null,
        });
        semana = g ? `${g.weeks}s ${g.days}d` : null;
      } catch {
        /* opcional */
      }

      const texto = textoDoAviso({
        nome,
        semana,
        sangue: (prof?.blood_type as string) ?? null,
        alergias: (prof?.allergies as string) ?? null,
        endereco: data.address,
        mapa,
      });

      const canais: CanaisAviso = { ...vazio };

      /* ── 1 e 2. O médico dela ─────────────────────────────────────────── */
      let medicoNome = DOCTOR.name;
      let medicoUserId: string | null = null;
      if (prof?.doctor_id) {
        const { data: d } = await sb
          .from("doctors")
          .select("display_name")
          .eq("id", prof.doctor_id)
          .maybeSingle();
        if (d?.display_name) medicoNome = d.display_name as string;
        medicoUserId = prof.doctor_id as string;
      }

      if (medicoUserId) {
        try {
          const { sendPushToUser } = await import("@/lib/push.server");
          const r = await sendPushToUser(medicoUserId, {
            title: `🆘 ${nome} acionou o SOS`,
            body: texto.split("\n").slice(1, 3).join(" "),
            url: "/painel",
          });
          canais.medicoPush = r.sent;
        } catch {
          /* melhor esforço */
        }
        try {
          const { data: dUser } = await supabaseAdmin.auth.admin.getUserById(medicoUserId);
          const email = dUser?.user?.email;
          if (email) {
            const { sendEmail } = await import("@/lib/email.server");
            canais.medicoEmail = await sendEmail({
              to: email,
              subject: `🆘 EMERGÊNCIA — ${nome} acionou o SOS`,
              html: emailHtml(nome, texto, prof),
            });
          }
        } catch {
          /* melhor esforço */
        }
      }
      if (canais.medicoPush > 0 || canais.medicoEmail) canais.avisados.push(medicoNome);

      /* ── 3. O contato de emergência, por e-mail ───────────────────────── */
      const contatoNome = ((prof?.emergency_contact as string) || "").trim();
      const contatoEmail = ((prof?.emergency_email as string) || "").trim();
      if (contatoEmail) {
        try {
          const { sendEmail } = await import("@/lib/email.server");
          canais.contatoEmail = await sendEmail({
            to: contatoEmail,
            subject: `🆘 ${nome} precisa de ajuda agora`,
            html: emailHtml(nome, texto, prof),
          });
        } catch {
          /* melhor esforço */
        }
      }

      /* ── 4. SMS/WhatsApp pelo webhook, se configurado ─────────────────── */
      const contatoTel = ((prof?.emergency_phone as string) || "").replace(/\D/g, "");
      const hook = process.env.SOS_SMS_WEBHOOK_URL;
      if (hook && contatoTel.length >= 10) {
        try {
          const ddi = contatoTel.length <= 11 ? `55${contatoTel}` : contatoTel;
          const res = await fetch(hook, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(process.env.SOS_SMS_WEBHOOK_TOKEN
                ? { authorization: `Bearer ${process.env.SOS_SMS_WEBHOOK_TOKEN}` }
                : {}),
            },
            body: JSON.stringify({ to: `+${ddi}`, text: texto }),
          });
          canais.sms = res.ok;
        } catch {
          /* melhor esforço */
        }
      }

      if ((canais.contatoEmail || canais.sms) && contatoNome) canais.avisados.push(contatoNome);
      // Só é "faltou" quando existe um contato cadastrado e nada chegou nele.
      if (contatoNome && !canais.contatoEmail && !canais.sms) canais.faltou = contatoNome;

      /* ── Registro, com o que saiu ─────────────────────────────────────── */
      try {
        await sb.from("panic_events").insert({
          user_id: u.user.id,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          channels: canais,
        });
      } catch {
        /* a coluna `channels` pode não existir ainda; o evento importa mais */
        try {
          await sb.from("panic_events").insert({
            user_id: u.user.id,
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.address,
          });
        } catch {
          /* melhor esforço */
        }
      }

      return { ok: true as const, canais };
    } catch {
      return { ok: false as const, canais: vazio };
    }
  });

function emailHtml(nome: string, texto: string, prof: Record<string, unknown> | null): string {
  const linhas = texto
    .split("\n")
    .map((l) => `<p style="margin:0 0 6px;font-size:15px;line-height:1.5">${escapar(l)}</p>`)
    .join("");
  const contato = [prof?.emergency_contact, prof?.emergency_phone].filter(Boolean).join(" · ");
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;color:#be123c;font-weight:700">
        ALERTA DE EMERGÊNCIA
      </p>
      <h1 style="margin:0 0 16px;font-size:22px">${escapar(nome)} acionou o SOS</h1>
      ${linhas}
      ${contato ? `<p style="margin:14px 0 0;font-size:13px;color:#555">Contato de emergência: ${escapar(contato)}</p>` : ""}
      <p style="margin:18px 0 0;font-size:12px;color:#777">
        Enviado automaticamente pelo app Obstétrica no momento do acionamento.
        Em caso de risco de vida, ligue 192.
      </p>
    </div>`;
}

function escapar(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}
