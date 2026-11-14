/**
 * O PAINEL DO ACOMPANHANTE NO MODO CUIDADO.
 *
 * ⚠️ **O portão anterior cobria SÓ o batimento** — com o comentário certo ("ele
 * ouviria o coração de um bebê que não existe mais") e alcance curto. As
 * outras quatro superfícies continuavam:
 *
 *   · o TÍTULO, "Helena de Marina Costa"
 *   · a linha "Semana 28 e 3 dias · 81 dias para a DPP"
 *   · a aba "Bebê" (tamanho e descrição da semana)
 *   · a aba "Para o parto", e as dicas de "Apoiar mamãe"/"Tarefas", que são
 *     todas de gestação ("acompanhe às consultas do pré-natal", "lanches leves
 *     para o enjoo matinal")
 *
 * Tudo isso para quem abre o link — o marido, a mãe, a irmã — com ela sem
 * estar do lado para explicar.
 *
 * ⚠️ **E A EMERGÊNCIA FICA.** O alerta de SOS com localização e o botão do
 * SAMU vivem FORA das abas: era a razão que o comentário do batimento dava
 * para manter o resto, e ela vale inteira sem uma única aba de gestação.
 *
 * ⚠️ **O texto NÃO conta o que aconteceu.** O Modo Cuidado pode ser ligado
 * pelo MÉDICO, e quem tem o link pode não saber de nada — um painel que
 * anunciasse a perda seria o app dando, por ela, a notícia mais íntima que
 * existe.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const TELA = semComentarios(readFileSync("src/routes/acompanhar.$token.tsx", "utf8"));

describe("no luto, nada de gestação abre", () => {
  test("⚠️ a fita de abas fica VAZIA", () => {
    expect(TELA).toMatch(/TABS[^=]*=\s*profile\.care_mode\s*\?\s*\[\]/);
  });

  test("⚠️ as quatro abas têm portão no CORPO, e não só na fita", () => {
    /* A aba inicial é `"bebe"` no `useState`: sem o portão no corpo, o painel
       abriria na aba do bebê mesmo com ela fora da fita. */
    for (const aba of ['"bebe"', '"apoiar"', '"tarefas"', '"parto"']) {
      expect(TELA).toMatch(new RegExp(`activeTab === ${aba} && !profile\\.care_mode`));
    }
  });

  test("⚠️ o TÍTULO não traz o nome do bebê", () => {
    /* Foi a bancada que pegou isto: eu tinha gateado as quatro abas e deixado
       "Helena de Marina Costa" no topo. */
    expect(TELA).toMatch(/care_mode \?[\s\S]{0,200}display_name/);
    expect(TELA).not.toMatch(
      /<h1[\s\S]{0,120}baby_name \? `\$\{profile\.baby_name\} de`[\s\S]{0,60}<\/h1>/,
    );
  });

  test("⚠️ a linha da SEMANA e da DPP não aparece", () => {
    expect(TELA).toMatch(/\{gest && !profile\.care_mode && \(/);
  });

  test("⚠️ o batimento continua gateado", () => {
    expect(TELA).toMatch(/\{!profile\.care_mode && \(\s*<HeartbeatFeel/);
  });
});

describe("o que NÃO some", () => {
  test("⚠️ o alerta de SOS e o SAMU ficam", () => {
    /* Eles vivem antes das abas, e são a razão de o painel continuar de pé. */
    const i = TELA.indexOf("{panicEvent && (");
    expect(i).toBeGreaterThan(-1);
    expect(TELA.slice(i, TELA.indexOf("Painel do Papai", i))).toContain("tel:192");
    /* E o bloco do SOS não pode ganhar portão de luto. */
    expect(TELA).not.toMatch(/panicEvent && !profile\.care_mode/);
  });

  test("⚠️ o texto do luto NÃO conta o motivo", () => {
    /* Nem "perda", nem "luto", nem consolo. Ele diz o fato sobre o painel e
       para aí — a mesma régua dos textos sensíveis do resto do app. */
    /* ⚠️ Com a CHAVE na frente: `profile.care_mode && (` casa dentro de
       `!profile.care_mode && (` — a asserção pegava o portão da linha da
       semana em vez do cartão, e media as palavras proibidas no bloco errado.
       Armadilha de substring, pela enésima vez nesta base. */
    const i = TELA.indexOf("{profile.care_mode && (");
    expect(i).toBeGreaterThan(-1);
    const cartao = TELA.slice(i, i + 600);
    for (const proibido of ["perda", "perdeu", "luto", "sentimos", "está tudo bem", "vai passar"]) {
      expect(cartao.toLowerCase()).not.toContain(proibido);
    }
    expect(cartao).toContain("pausadas");
  });
});

describe("a bancada existe", () => {
  test("⚠️ dá para olhar esta tela sem um convite real", () => {
    /* Ela nasce de um token: conferir o Modo Cuidado exigia uma conta de
       gestante, um convite gerado e o luto ligado numa conta de verdade. Foi
       por isso que o portão ficou meses cobrindo só o batimento. */
    expect(TELA).toContain("validateSearch");
    expect(TELA).toMatch(/bancada === "luto"/);
    /* ⚠️ `== null` e não `=== undefined`: o router revalida e manda `null` na
       segunda passada. */
    expect(TELA).toMatch(/q\.bancada == null/);
  });
});
