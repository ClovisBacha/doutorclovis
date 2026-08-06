/**
 * LER EXAME É ATO MÉDICO.
 *
 * A paciente anexava uma foto no chat, via a bolha com a imagem e o
 * duplo-check de entregue — e a foto não ia a lugar nenhum. Vivia numa data
 * URL no estado do React, era DESCARTADA no servidor (o histórico é
 * reconstruído só com texto) e sumia no primeiro recarregamento.
 *
 * É o pior formato de defeito num app clínico: a tela confirma, e a
 * confirmação é falsa. Ela manda o exame, ninguém recebe, e nada avisa que
 * ninguém recebeu.
 *
 * O botão "Documento" era ainda mais direto: mostrava "em breve".
 *
 * O conserto NÃO reescreveu nada — o ciclo do exame já existia inteiro
 * (tabela com RLS, aba do painel, visualizador, devolutiva). Faltava a ponte
 * entre o chat e essa porta, e o aviso de que algo chegou.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

const fn = codigoDe("src/lib/exame-do-chat.functions.ts");
const app = codigoDe("src/routes/_authenticated/minha-conta.tsx");
const appBruto = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

describe("o anexo vai para o médico", () => {
  test("grava na tabela de exames que já existe", () => {
    /* Reusar `exam_files` é o que dá de graça o visualizador, a devolutiva e o
       registro de desfecho — tudo já construído e funcionando. */
    expect(fn).toContain('.from("exam_files").insert(');
    expect(fn).toContain("image_data: data.imagem");
  });

  test("o chat NÃO manda mais a imagem para a IA", () => {
    /* `sendText(input, dataURL)` era o caminho antigo: a imagem viajava e era
       descartada no servidor. */
    expect(appBruto).toContain('void enviarParaOMedico(canvas.toDataURL("image/jpeg", 0.85))');
    expect(app).not.toContain("void sendText(input, reader.result as string)");
  });

  test("o botão falso virou botão de verdade — e é UM só", () => {
    /* Um botão que não faz nada é pior que um botão a menos: ela tenta,
       acredita que enviou, e espera.
       E dois botões que fazem a MESMA coisa sugerindo destinos diferentes é o
       defeito seguinte: "Galeria" e "Exame" abriam o mesmo seletor e gravavam
       o mesmo registro em `exam_files`, com e-mail e push. Uma foto da barriga
       disparava "📄 Uma paciente enviou um exame" — e aviso que chega errado
       ensina o médico a ignorar aviso. Desde que a IA parou de analisar
       imagem, todo arquivo tem um destino só, então o botão diz qual é. */
    expect(app).not.toContain("handleDocSoon");
    expect(app).not.toContain("Envio de documentos em breve");
    expect(appBruto).toContain('label: "Enviar ao médico"');
    expect(appBruto).not.toContain('label: "Galeria"');
  });

  test("laudo em PDF tem caminho — nas duas pontas", () => {
    /* O botão chama-se "Exame" e recusava `application/pdf`, que é o formato
       que todo laboratório entrega por e-mail. Aceitar no envio sem tratar na
       exibição só moveria o defeito: `<img src="data:application/pdf…">`
       desenha ícone de arquivo quebrado no painel do médico. */
    /* No texto BRUTO: o `codigoDe` remove blocos `/* … *\/`, e `image/*` abre
       um desses por acidente — a partir dali ele engole o arquivo até achar um
       fechamento qualquer. Medir a versão limpa aqui seria medir um texto que
       não existe. */
    expect(appBruto).toContain('accept="image/*,application/pdf"');
    expect(appBruto).toContain('const ehPdf = file.type === "application/pdf"');
    expect(fn).toContain('v.startsWith("data:application/pdf")');
    const visor = readFileSync("src/components/exames-recebidos.tsx", "utf8");
    expect(visor).toContain('imagem.startsWith("data:application/pdf")');
    expect(visor).toContain('type="application/pdf"');
  });

  test("a foto do exame é redimensionada, como todas as outras do app", () => {
    /* Era o ÚNICO caminho de imagem do arquivo sem canvas — e é a maior foto
       do produto. Avatar 256px, álbum 800px, aba Exames 1200px, laudo… cru.
       Consequência dupla: a conta de tamanho não fechava, e a instrução de
       recusa ("tente uma foto com menos resolução") era impossível de seguir
       para uma foto de celular de 48MP. */
    expect(appBruto).toContain("const maxSize = 1600;");
    expect(appBruto).toContain('canvas.toDataURL("image/jpeg", 0.85)');
  });

  test("A CONTA, não o literal: base64 cabe no limite da Vercel", () => {
    /* Isto é a propriedade, e não a string do fonte — um avaliador mediu que
       trocar o teto por 300 MiB só quebrava um `toContain`, que detecta
       QUALQUER mudança e não detecta a errada.
       PDF não passa por canvas, então é ele que define o teto. base64 cresce
       4/3, e o limite da Vercel é 4,5 MB — ambíguo entre decimal e MiB, então
       a conta tem que caber na leitura MENOR. */
    const TETO_PDF = 3.0 * 1024 * 1024;
    const base64 = Math.ceil(TETO_PDF * (4 / 3));
    expect(base64).toBeLessThan(4_500_000);
    expect(appBruto).toContain("file.size > 3.0 * 1024 * 1024");
  });
});

describe("a paciente sabe QUEM vai olhar", () => {
  test("a confirmação diz o destino, não só 'enviado'", () => {
    /* Sem isso ela fica esperando uma leitura da IA que não vem. */
    expect(appBruto).toContain("Eu não analiso exames: quem olha é quem pode assinar");
  });

  test("sem médico vinculado, não promete encaminhamento", () => {
    expect(appBruto).toContain("Assim que você se vincular a um obstetra");
    expect(fn).toContain("semMedico: !doctorId");
  });

  test("falha no envio ela PRECISA ver", () => {
    /* Se o exame não foi guardado, ela tem que saber para mandar de novo —
       este é o único erro deste fluxo que não pode ser silencioso. */
    expect(appBruto).toContain("Não consegui enviar o arquivo agora");
    expect(fn).toContain("if (error) return { ok: false as const };");
  });
});

describe("o médico é avisado", () => {
  test("e-mail e push saem quando o exame chega", () => {
    /* Era a peça que faltava no ciclo pronto: o exame chegava em `exam_files`
       e ficava lá até ele abrir a aba por conta própria. Uma caixa de entrada
       que não avisa é uma gaveta. */
    expect(fn).toContain("avisarDoExame(doctorId, nomeDela)");
    expect(fn).toContain("sendPushToEmail(");
    expect(fn).toContain("sendEmail({");
  });

  test("o aviso nunca derruba o envio", () => {
    /* O exame já está salvo quando o aviso é disparado. Falhar ali não pode
       fazer a paciente achar que precisa mandar de novo. */
    expect(fn).toContain("void avisarDoExame(");
    const aviso = fn.slice(fn.indexOf("async function avisarDoExame"));
    expect(aviso).toContain("} catch {");
  });

  test("o nome dela é escapado no e-mail", () => {
    /* Campo livre no corpo do e-mail: um "<" no nome quebraria a moldura. */
    expect(fn).toContain("escapar(nomeDela)");
  });

  test("o exame é identificado por data, não por rótulo repetido", () => {
    /* "Exame" dez vezes na lista dele não distingue nada. */
    expect(fn).toContain("Enviado no chat —");
  });
});
