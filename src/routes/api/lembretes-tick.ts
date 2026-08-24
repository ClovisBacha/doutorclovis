import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { varrerLembretes } from "@/lib/lembretes.server";

/** Compara dois segredos em tempo constante (evita timing attack). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * LEMBRETE DE CONSULTA — 24 h antes e 4 h antes.
 *
 * ─── POR QUE ISTO VALE DINHEIRO ─────────────────────────────────────────────
 *
 * Falta em consultório de alto risco é vaga perdida duas vezes: o médico fica
 * com o buraco, e quem estava na fila de espera não foi chamada. A paciente
 * marcou há três semanas e esqueceu.
 *
 * ─── A DECISÃO NÃO ESTÁ AQUI ────────────────────────────────────────────────
 *
 * Quem decide o que está vencido é `src/lib/lembretes.ts` — função pura, sem
 * banco, testada. Este arquivo faz só o trabalho sujo: ler as duas fontes, ler
 * o que já foi enviado, mandar, e registrar.
 *
 * ─── O QUE IMPEDE O SPAM ────────────────────────────────────────────────────
 *
 * Duas coisas, e as duas precisam existir. A régua não repete o que está em
 * `appointment_reminders`; e o índice único dessa tabela recusa a segunda
 * gravação se dois crons rodarem no mesmo segundo. Sem a segunda, uma corrida
 * mandaria o aviso duas vezes — e "sua consulta é amanhã" repetido faz a
 * paciente desligar as notificações do app, que é o mesmo canal por onde chega
 * o aviso de emergência.
 *
 * O registro é gravado ANTES do envio, de propósito: um push que falha e não
 * repete é um lembrete perdido; um push que repete a cada hora é o produto
 * perdendo o canal.
 *
 * Protegido por CRON_SECRET (header `Authorization: Bearer <CRON_SECRET>`).
 * Agende de hora em hora — a janela é aberta ("faltam 24 h ou menos"), então um
 * cron atrasado manda tarde em vez de não mandar.
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("forbidden", { status: 401 });
  }

  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    });

  try {
    /* ⚠️ `forcar: true`: o cron é a fonte PROATIVA. Estrangulá-lo porque uma
       paciente abriu a tela um minuto antes faria a fonte confiável depender da
       fonte oportunista, que é o contrário do desenho. */
    const r = await varrerLembretes({ forcar: true });
    return json({ ok: true, ...(r ?? { enviados: 0, avaliados: 0 }) });
  } catch (e) {
    console.error("lembretes-tick falhou", e);
    return json({ ok: false, reason: "erro" }, 200);
  }
}

export const Route = createFileRoute("/api/lembretes-tick")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
