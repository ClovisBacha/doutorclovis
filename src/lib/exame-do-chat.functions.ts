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
/* `ymdBrasilia`, e não `toLocaleDateString`: isto roda no SERVIDOR, que na
   Vercel está em UTC. Um exame enviado às 21h30 de Brasília ganhava a data do
   dia seguinte — e o médico procurava na lista pelo dia errado. A função já
   existe neste repo, criada por causa deste mesmo defeito. */
import { ymdBrasilia } from "./utils";
/* O escape CANÔNICO do repo, e não uma cópia. `email.server.ts` exporta
   `escEmail` justamente para isto — o comentário de lá diz "exportado porque
   nome de paciente e de médico entram no corpo de vários e-mails". Aqui havia
   uma reimplementação sem as aspas: funciona (o nome entra em nó de texto, não
   em atributo) e é uma segunda verdade sobre escape esperando divergir. */
import { escEmail as escapar } from "./email.server";
import { makeRateLimiter } from "./rate-limit.server";

/**
 * Seis exames por hora, por sessão.
 *
 * A escrita é pela chave de serviço, então a RLS não protege este caminho: uma
 * conta logada podia empilhar linhas de 4 MB à vontade, cada uma disparando
 * e-mail e push para o médico. Seis cobre qualquer envio real — um laudo tem 1
 * a 3 páginas — e fecha a torneira de spam e de inchaço do banco.
 */
const exameLimitado = makeRateLimiter(6, 3_600_000);

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
          /* ALINHADO COM O CLIENTE, e com o limite da Vercel.
             8 MB era quase o dobro do que a plataforma deixa passar: um
             arquivo entre 4,2 e 8 MB nunca chegava aqui — morria como 413
             genérico, que na tela vira "não consegui enviar" e um retry
             infinito com o MESMO arquivo. O teto do cliente é 3,0 MiB de PDF,
             que em base64 dá ~4,19 MB; a folga cobre o cabeçalho e o JSON. */
          .max(4_300_000)
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
      /* LIMITE DE TAXA. A escrita é pela chave de serviço, então a RLS não
         protege: uma conta logada podia empilhar linhas de 4 MB à vontade —
         cada uma disparando e-mail e push para o médico. Seis por hora cobre
         qualquer envio real (um laudo tem 1 a 3 páginas) e fecha a torneira. */
      if (exameLimitado(data.accessToken.slice(-32))) {
        return { ok: false as const, motivo: "muitos" as const };
      }
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

      /* O laudo vai para o Storage, com DOIS recuos — o balde pode não existir
         e a coluna também não. Os dois voltam a gravar base64, como sempre foi.
         O exame da paciente nunca pode se perder por causa de uma migração de
         armazenamento: ela fotografa o laudo às onze da noite e não tem como
         saber que a culpa é de uma coluna. */
      const { gravarLinhaComImagem, BALDE_EXAMES } = await import("@/lib/imagens.server");
      const { error } = await gravarLinhaComImagem({
        tabela: "exam_files",
        balde: BALDE_EXAMES,
        donoId: u.user.id,
        dataUrl: data.imagem,
        resto: {
          user_id: u.user.id,
          /* Nome com a data porque é o que a lista do médico mostra, e "Exame"
             repetido dez vezes não distingue nada. */
          name: `Enviado no chat — ${ymdBrasilia()}`,
          category: "outros",
          notes: data.nota?.slice(0, 500) || null,
        },
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
      html: emailLayout("Exame recebido pelo chat", corpo, destino.marca),
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

/**
 * A IMAGEM DE UM EXAME DELA — pelo servidor, e não mais pelo navegador.
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ──────────────────────────────────────────
 *
 * A aba Exames dela lia `image_data` direto do banco com a chave anon. Isso
 * funcionava enquanto o laudo morava DENTRO da linha.
 *
 * Com o laudo no Storage, `image_data` fica NULL — e o navegador não pode ler o
 * balde: eles são privados e sem policy nenhuma, por decisão explícita (ver
 * `imagens.server.ts`). O resultado seria a paciente deixando de ver o PRÓPRIO
 * exame, calada, à medida que os novos fossem migrando.
 *
 * Ou seja: não é uma função nova de produto, é a metade que faltava da migração
 * de armazenamento. Sem ela, a economia de disco teria custado à paciente o
 * acesso ao laudo dela.
 *
 * ─── O RECORTE ──────────────────────────────────────────────────────────────
 *
 * `.eq("user_id", u.user.id)` na própria consulta, e não uma checagem depois:
 * assim um id de exame de outra pessoa não devolve linha nenhuma, em vez de
 * devolver a linha e depender de um `if` para barrar. A RLS já protegia o
 * caminho antigo; aqui a leitura é com a chave de serviço, que a ignora — então
 * o filtro é obrigatório.
 */
export const minhaImagemDeExame = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), exameId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u?.user) return { ok: false as const, imagem: null };

      const { lerComCaminho, imagemDaLinha, BALDE_EXAMES } = await import("@/lib/imagens.server");
      const { data: linha } = await lerComCaminho<{
        image_data?: string | null;
        image_path?: string | null;
      }>("exam_files", "image_data", (q) =>
        q.eq("id", data.exameId).eq("user_id", u.user.id).maybeSingle(),
      );
      if (!linha) return { ok: false as const, imagem: null };
      return { ok: true as const, imagem: await imagemDaLinha(BALDE_EXAMES, linha) };
    } catch {
      /* Falhar aqui devolve `imagem: null`, e a tela mostra "não consegui
         carregar" — nunca um estouro. Ver o comentário do modal. */
      return { ok: false as const, imagem: null };
    }
  });

/**
 * Apagar UM exame dela — linha e arquivo.
 *
 * ─── A TERCEIRA PONTA DA MESMA MIGRAÇÃO ─────────────────────────────────────
 *
 * A aba Exames apagava a linha direto do navegador com a chave anon. Enquanto o
 * laudo morava DENTRO da linha, isso apagava a imagem junto.
 *
 * Com o laudo no Storage, a linha some e o arquivo fica — e o navegador não
 * pode limpá-lo, porque os baldes são privados e sem policy por decisão
 * explícita. Ela manda apagar, a tela diz que apagou, e o laudo continua no
 * nosso disco.
 *
 * É o mesmo defeito que já foi fechado em `deleteAlbumPost` e na exclusão da
 * conta. Esta era a terceira ponta, e ficou aberta porque a exclusão do exame
 * mora na TELA e não numa função de servidor — não apareceu em nenhuma busca
 * pelos arquivos que a migração tocou.
 *
 * O caminho é lido ANTES do delete: depois a linha não existe e não há como
 * saber qual arquivo era dela.
 */
export const apagarMeuExame = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), exameId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u?.user) return { ok: false as const };
      const sb = supabaseAdmin as any;

      const { lerComCaminho, apagarImagem, BALDE_EXAMES } = await import("@/lib/imagens.server");
      /* `.eq("user_id")` na própria consulta: um id de outra pessoa não devolve
         linha nenhuma, em vez de devolver e depender de um `if` para barrar. */
      const { data: linha } = await lerComCaminho<{ image_path?: string | null }>(
        "exam_files",
        "id",
        (q) => q.eq("id", data.exameId).eq("user_id", u.user.id).maybeSingle(),
      );
      if (!linha) return { ok: false as const };

      const { error } = await sb
        .from("exam_files")
        .delete()
        .eq("id", data.exameId)
        .eq("user_id", u.user.id);
      if (error) return { ok: false as const };

      if (linha.image_path) await apagarImagem(BALDE_EXAMES, linha.image_path);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });
