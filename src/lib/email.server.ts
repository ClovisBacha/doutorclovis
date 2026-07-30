// Envio de e-mail transacional via Resend (https://resend.com — nível gratuito).
// Sem dependência nova: chamamos a API REST com fetch.
//
// Variáveis de ambiente:
// - RESEND_API_KEY: chave da API (secreta). Sem ela, o envio vira no-op e o
//   resto do fluxo (ex.: agendamento) continua funcionando normalmente.
// - MAIL_FROM: remetente. Padrão "onboarding@resend.dev" (só envia para o dono
//   da conta enquanto você não verifica um domínio próprio no Resend).

import { DOCTOR } from "@/lib/doctor.config";

type SendArgs = { to: string | string[]; subject: string; html: string; replyTo?: string };

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY ausente — e-mail não enviado: "${subject}"`);
    return false;
  }
  const from = process.env.MAIL_FROM || `${DOCTOR.name} <onboarding@resend.dev>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] falha no envio", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] erro de rede", e);
    return false;
  }
}

/**
 * Marca do e-mail: quem assina o cabeçalho e o rodapé.
 *
 * Existe porque a plataforma é multi-médico. Enquanto o layout fixava
 * `DOCTOR.name`, TODO e-mail de TODA paciente saía assinado pelo fundador —
 * inclusive os de paciente de outro médico, que nunca ouviu falar dele. É a
 * versão de e-mail do mesmo bug que o painel tinha: "sem médico" virava
 * "médico = fundador".
 *
 * Sem marca, o remetente é a plataforma. Nunca um médico específico: assinar
 * com o nome errado é pior do que assinar com o nome neutro.
 */
export type MarcaEmail = { nome?: string | null; linha?: string | null };

const PLATAFORMA = { nome: "Obstétrica", linha: "Acompanhamento de gestação" };

/**
 * Escapa o que vai virar texto dentro do HTML do e-mail.
 *
 * Exportado porque nome de paciente e de médico entram no corpo de vários
 * e-mails, e nome é campo livre: sem isto, um `<` no cadastro quebra a
 * moldura (e um `<img onerror=...>` faz pior).
 */
export function escEmail(s: string): string {
  return esc(s);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Moldura HTML simples e acolhedora, nas cores do consultório. */
export function emailLayout(title: string, bodyHtml: string, marca?: MarcaEmail): string {
  const nome = esc(marca?.nome?.trim() || PLATAFORMA.nome);
  const linha = esc(marca?.linha?.trim() || PLATAFORMA.linha);
  return `<!doctype html><html><body style="margin:0;background:#f7efe8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#3a2a25">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:18px;padding:28px;box-shadow:0 6px 24px rgba(120,60,40,.08)">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#a85a44">${nome}</p>
      <!-- title NÃO passa por esc(): quem chama já escapa o que interpola, e
           escapar de novo aqui viraria "Jo&amp;amp;ão" em nome com "&". -->
      <h1 style="margin:0 0 16px;font-size:22px;color:#7a3d2c">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="text-align:center;font-size:12px;color:#9b8178;margin-top:18px">
      ${linha}
    </p>
  </div></body></html>`;
}
