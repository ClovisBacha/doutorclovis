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
    expect(app).toContain("void enviarParaOMedico(reader.result as string)");
    expect(app).not.toContain("void sendText(input, reader.result as string)");
  });

  test("o botão falso virou botão de verdade", () => {
    /* Um botão que não faz nada é pior que um botão a menos: ela tenta,
       acredita que enviou, e espera. */
    expect(app).not.toContain("handleDocSoon");
    expect(app).not.toContain("Envio de documentos em breve");
    expect(app).toContain('label: "Exame"');
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
