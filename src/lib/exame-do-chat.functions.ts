/**
 * O anexo do chat vai para o MÉDICO — não para a IA.
 *
 * ─── O QUE EXISTIA ──────────────────────────────────────────────────────────
 *
 * A paciente anexava uma foto no chat, via a bolha com a imagem e o duplo-check
 * de entregue. E a foto não ia a lugar nenhum: vivia numa data URL no estado do
 * React, era mandada pela rede, DESCARTADA no servidor (o histórico é
 * reconstruído só com texto), e sumia para sempre no primeiro recarregamento.
 * O botão "Documento" nem isso — mostrava "em breve".
 *
 * Então ela mandava o exame, ninguém recebia, e nada avisava que ninguém
 * recebeu. É o pior formato de defeito num app clínico: a tela confirma, e a
 * confirmação é falsa.
 *
 * ─── POR QUE NÃO É A IA QUE OLHA ────────────────────────────────────────────
 *
 * Ler exame é ato médico. Uma IA dizendo "seu hemograma está bom" é conduta
 * sem CRM — e se errar, o erro chega vestido de confiança. O exame vai para
 * quem pode assiná-lo.
 *
 * ─── POR QUE NÃO SE REESCREVEU NADA ─────────────────────────────────────────
 *
 * O ciclo completo do exame JÁ existe e funciona: a tabela `exam_files` com
 * RLS, a aba Exames do painel, o visualizador sob demanda, a devolutiva que
 * volta para a paciente e o registro do desfecho. O que faltava era a ponte
 * entre o chat e essa porta — e o aviso de que algo chegou.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const enviarExameDoChat = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /**
         * O arquivo, em data URL: foto do laudo (JPEG/PNG/HEIC) ou o PDF que o
         * laboratório mandou por e-mail.
         *
         * O `startsWith` não é decoração. Sem ele, qualquer string de 32
         * caracteres entrava na coluna e o painel do médico desenhava um ícone
         * de arquivo quebrado — sem nada dizendo por quê. E a docstring
         * anterior afirmava "já redimensionado pelo cliente", o que nunca foi
         * verdade: o cliente lia o arquivo direto, sem canvas.
         */
        imagem: z
          .string()
          .min(32)
          .max(8_000_000)
          .refine((v) => v.startsWith("data:image/") || v.startsWith("data:application/pdf"), {
            message: "arquivo precisa ser imagem ou PDF em data URL",
          }),
        /** O que ela escreveu junto, se escreveu. Vira a observação do exame. */
        nota: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      const { data: u, error: uerr } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (uerr || !u?.user) return { ok: false as const };

      const { data: prof } = await sb
        .from("patient_profiles")
        .select("doctor_id,display_name")
        .eq("id", u.user.id)
        .maybeSingle();
      const doctorId = (prof?.doctor_id as string | null) ?? null;
      const nomeDela = ((prof?.display_name as string | null) ?? "").trim() || "Uma paciente";

      const { error } = await sb.from("exam_files").insert({
        user_id: u.user.id,
        /* Nome com a data porque é o que a lista do médico mostra, e "Exame"
           repetido dez vezes não distingue nada. */
        name: `Enviado no chat — ${new Date().toLocaleDateString("pt-BR")}`,
        category: "outros",
        notes: data.nota?.slice(0, 500) || null,
        image_data: data.imagem,
      });
      /* Erro aqui é o único que a paciente PRECISA ver: se o exame não foi
         gravado, ela tem que saber para mandar de novo. Todo o resto desta
         função é best-effort. */
      if (error) return { ok: false as const };

      /* O AVISO — a peça que faltava no ciclo que já existia.
         Sem ela o exame chegava em `exam_files` e ficava lá até o médico
         abrir a aba por conta própria. Uma caixa de entrada que não avisa é
         uma gaveta. */
      if (doctorId) void avisarDoExame(doctorId, nomeDela);
      return { ok: true as const, semMedico: !doctorId };
    } catch {
      return { ok: false as const };
    }
  });

/** E-mail + push para o médico. Nunca lança: o exame já está salvo. */
async function avisarDoExame(doctorId: string, nomeDela: string): Promise<void> {
  try {
    const [{ avisarMedico }, { sendEmail, emailLayout }, { DOCTOR }] = await Promise.all([
      import("./doctor-mail.server"),
      import("./email.server"),
      import("./doctor.config"),
    ]);
    const destino = await avisarMedico(doctorId);
    if (!destino.para.length) return;
    const corpo = `<p style="margin:0 0 12px;line-height:1.6"><strong>${escapar(nomeDela)}</strong> enviou um exame pelo chat do aplicativo.</p>
       <p style="margin:0 0 16px;line-height:1.6">Ele está na aba <strong>Exames</strong> do seu painel, com a imagem e o espaço para você responder a ela.</p>
       <p style="margin:0"><a href="${DOCTOR.siteUrl}/painel" style="display:inline-block;background:#a85a44;color:#fff;text-decoration:none;border-radius:999px;padding:10px 22px;font-size:14px">Ver o exame</a></p>`;
    await sendEmail({
      to: destino.para[0],
      subject: "📄 Uma paciente enviou um exame",
      html: emailLayout("Exame recebido pelo chat", corpo),
    });
    const { sendPushToEmail } = await import("./push.server");
    await sendPushToEmail(destino.para[0], {
      title: "📄 Exame recebido",
      body: `${nomeDela} enviou um exame pelo chat.`,
      url: "/painel",
    });
  } catch {
    /* o exame está salvo; o aviso é enriquecimento */
  }
}

/** Campo livre no corpo do e-mail: um "<" no nome quebraria a moldura. */
function escapar(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}
