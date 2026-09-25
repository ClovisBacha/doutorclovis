/**
 * O MÉDICO NÃO VIA O QUE ELE MESMO RECEITOU.
 *
 * ⚠️ `emissoesDaPaciente` existia inteira — escrita, recortada pelo vínculo
 * ATUAL, devolvendo receita e pedido de exame com data, texto e o "ela marcou
 * como feito" — e **com zero chamadores no app**. Ele emitia, o documento
 * chegava na aba dela, e do lado dele o rastro sumia.
 *
 * ⚠️ **O custo é clínico:** na consulta seguinte ele abre a ficha para decidir o
 * que pedir, sem enxergar o que ELE MESMO pediu no mês passado. Exame repetido
 * é agulha à toa; receita repetida é dose dobrada quando ela já está tomando.
 *
 * ⚠️ **E a função tinha a falha aberta da noite inteira:** `if (error) return
 * vazio` fazia "não consegui ler" chegar como "ele não emitiu nada". Dar a
 * porta sem consertar isso seria entregar o defeito junto com o recurso.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const SERVIDOR = semComentarios(readFileSync("src/lib/clinical.functions.ts", "utf8"));
const TELA = semComentarios(readFileSync("src/components/emissoes-da-paciente.tsx", "utf8"));
const PAINEL = semComentarios(readFileSync("src/routes/_authenticated/painel.tsx", "utf8"));

function corpoDe(fonte: string, assinatura: string, depois: readonly string[] = []): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  let de = i;
  for (const marca of depois) {
    de = fonte.indexOf(marca, de);
    if (de < 0) return "";
    de += marca.length;
  }
  const abre = fonte.indexOf("{", de);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

/** ⚠️ `.handler(` → `=>` (sem a chave): o marcador com ela começaria a contagem
 *  na desestruturação `{ data }` da primeira linha. */
const HANDLER = corpoDe(SERVIDOR, "export const emissoesDaPaciente", [".handler(", "=>"]);

describe("o servidor distingue vazio de falha", () => {
  test("⚠️ falha de leitura devolve `degradado`, e não lista vazia limpa", () => {
    expect(HANDLER.length).toBeGreaterThan(0);
    expect(HANDLER).toContain("{ ...vazio, degradado: true }");
    /* O `return vazio` cru é a forma exata do defeito: `degradado: false` numa
       leitura que falhou. */
    expect(HANDLER).not.toMatch(/if \(error\) return vazio;/);
    expect(HANDLER).not.toMatch(/catch \{\s*return vazio;/);
  });

  test("⚠️ `degradado` é campo PRÓPRIO — `ok: false` já faz outro trabalho", () => {
    /* `ok: false` quer dizer "não é sua paciente" ou sessão inválida, e a tela
       responde a isso escondendo o bloco. Um booleano fazendo dois trabalhos é
       o defeito que a tela de assinatura já pagou aqui. */
    expect(HANDLER).toContain("if (!user) return { ...vazio, ok: false as const }");
    expect(HANDLER).toContain("degradado: false");
  });

  test("⚠️ o recorte continua sendo o vínculo ATUAL", () => {
    /* Nunca um `doctor_id` carimbado na linha de origem: se ela trocou de
       médico, o anterior não vê mais nada dela. */
    expect(HANDLER).toContain("pacientesAtuais(user.id)");
    expect(HANDLER).toContain("if (!pacientes.has(data.pacienteId))");
  });
});

describe("a lista chegou ao painel", () => {
  test("⚠️ `emissoesDaPaciente` deixou de ser órfã", () => {
    expect(TELA).toContain('import("@/lib/clinical.functions")');
    expect(TELA).toContain("emissoesDaPaciente({");
  });

  test("⚠️ e ela é montada ONDE a emissão nasce", () => {
    /* Ao lado dos botões que emitem, e não numa aba própria: é o histórico ao
       lado do botão que impede a segunda emissão. */
    expect(PAINEL).toContain("<EmissoesDaPaciente pacienteId={p.id}");
    /* ⚠️ CONTENÇÃO por posição, e não extração por chaves: num `return (` de
       JSX a primeira chave é uma EXPRESSÃO (`{() => setEscolhendo("exame")}`),
       e o contador devolvia essa expressão em vez do corpo. O que garante o
       lugar é a montagem estar entre esta função e a próxima. */
    const daFuncao = PAINEL.indexOf("function AcoesDaPaciente(");
    const proximaFuncao = PAINEL.indexOf("\nfunction ", daFuncao + 1);
    const montagem = PAINEL.indexOf("<EmissoesDaPaciente", daFuncao);
    expect(daFuncao).toBeGreaterThan(-1);
    expect(proximaFuncao).toBeGreaterThan(daFuncao);
    expect(montagem).toBeGreaterThan(daFuncao);
    expect(montagem).toBeLessThan(proximaFuncao);
  });

  test("⚠️ a lista relê depois de uma emissão", () => {
    /* Senão ele acabaria de emitir e continuaria vendo a lista de antes — que é
       exatamente quando ela importa. */
    expect(PAINEL).toContain("recarregar={emitidas}");
    expect(PAINEL).toContain("setEmitidas((n) => n + 1)");
  });
});

describe("a tela não afirma o que não leu", () => {
  test("⚠️ `degradado` tem aviso PRÓPRIO, e ele diz para não concluir", () => {
    /* Num cartão clínico, "não há nada" sobre uma leitura que falhou vale uma
       receita repetida. */
    expect(TELA).toContain("if (degradado) {");
    expect(TELA).toMatch(/não conclua que não há/i);
    expect(TELA).toMatch(/Tentar de novo/);
  });

  test("⚠️ o vazio VERDADEIRO não desenha seção", () => {
    /* "Nada emitido" é o estado normal de toda paciente nova, e uma linha
       dizendo isso em cada ficha é ruído. */
    expect(TELA).toContain("if (lista.length === 0) return null;");
  });

  test("⚠️ o degradado é conferido ANTES do vazio", () => {
    /* Invertido, a falha cairia no `return null` do vazio e o médico não veria
       aviso nenhum — o defeito silencioso de volta. */
    expect(TELA.indexOf("if (degradado) {")).toBeLessThan(
      TELA.indexOf("if (lista.length === 0) return null;"),
    );
  });

  test("⚠️ o 'ela marcou como feito' aparece", () => {
    /* É a informação que muda a conduta: um pedido de seis semanas atrás sem
       retorno é outra conversa que um de ontem. */
    expect(TELA).toContain("e.cumprido_em ?");
    expect(TELA).toMatch(/aguardando/);
  });

  test("o alvo de toque tem 44px e a lista é cortada com aviso", () => {
    expect(TELA).toContain("min-h-[44px]");
    expect(TELA).toContain("lista.slice(0, 8)");
    expect(TELA).toContain("lista.length > 8");
  });
});
