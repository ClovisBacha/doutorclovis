import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "@/lib/sem-comentarios";

/**
 * O PORTÃO DA NUTRICIONISTA ESTÁ LIGADO NOS DOIS ENDPOINTS — e ANTES do gasto.
 *
 * ⚠️ A régua é pura e testada ao lado (`nutricao-premium.test.ts`); o que este
 * arquivo cobre é a CORRENTE, que é onde ela pode existir e não valer nada:
 * um portão escrito DEPOIS da chamada ao modelo recusa a resposta e paga a
 * conta do mesmo jeito — ou seja, o teto que existe para proteger a margem
 * passaria a custar exatamente o que ele veio impedir.
 *
 * ⚠️ E ele cobra o AVISO da amostra junto, porque sem ele a paciente que não
 * assina gasta as três perguntas ao longo da semana e encontra a porta fechada
 * sem nunca ter visto que havia uma contagem — é o requisito que o tipo
 * `Acesso` declara com todas as letras.
 *
 * ⚠️ Os comentários saem antes de qualquer busca: a prosa deste repositório
 * cita o que ela proíbe, e já quebrou teste de texto nos dois sentidos.
 */

const CONVERSA = semComentarios(readFileSync("src/routes/api/nutrition.ts", "utf8"));
const FOTO = semComentarios(readFileSync("src/routes/api/prato.ts", "utf8"));

/** Onde o texto aparece — e ESTOURA quando ele não aparece, em vez de −1. */
function onde(fonte: string, agulha: string) {
  const i = fonte.indexOf(agulha);
  if (i < 0) throw new Error(`não achei ${JSON.stringify(agulha)}`);
  return i;
}

test("os dois endpoints consultam a régua e devolvem 402", () => {
  for (const [nome, fonte] of [
    ["nutrition", CONVERSA],
    ["prato", FOTO],
  ] as const) {
    expect(`${nome}:${fonte.includes("decidirAcesso(")}`).toBe(`${nome}:true`);
    expect(`${nome}:${fonte.includes("usoDaNutricionista(")}`).toBe(`${nome}:true`);
    /* 402 é a porta, e não 403: a tela distingue "fechada" de "proibida". */
    expect(`${nome}:${fonte.includes("402")}`).toBe(`${nome}:true`);
  }
});

test("⚠️ o portão vem ANTES do gasto — senão ele recusa e paga a conta igual", () => {
  /* Na conversa, o que custa é montar o contexto do cérebro e abrir o fluxo. */
  expect(onde(CONVERSA, "decidirAcesso(")).toBeLessThan(onde(CONVERSA, "getBrainContextResolved"));
  /* ⚠️ `streamText(` e não `streamText`: o nome aparece no IMPORT, na linha 5,
     e ancorar nele compararia o portão com o topo do arquivo — a asserção
     ficaria vermelha sobre código certo. É a armadilha de substring de sempre,
     na direção do falso negativo. */
  expect(onde(CONVERSA, "decidirAcesso(")).toBeLessThan(onde(CONVERSA, "streamText({"));
  /* Na foto, o que custa é converter a imagem e chamar o modelo de visão — e
     aqui custa uma ordem de grandeza mais, que é por que ela tem canal próprio
     fora da franquia clínica da gestante. */
  expect(onde(FOTO, "decidirAcesso(")).toBeLessThan(onde(FOTO, 'toString("base64")'));
  expect(onde(FOTO, "decidirAcesso(")).toBeLessThan(onde(FOTO, "generativelanguage"));
  /* ⚠️ E a RECUSA junto: mover só a régua para cima e deixar o `return` depois
     do modelo consultaria o portão, pagaria a conta e devolveria 402 — o pior
     dos dois mundos. O que se cobra é a SAÍDA antes do gasto. */
  expect(onde(CONVERSA, "!acesso.pode")).toBeLessThan(onde(CONVERSA, "streamText({"));
  expect(onde(FOTO, "!acesso.pode")).toBeLessThan(onde(FOTO, "generativelanguage"));
});

test("⚠️ quantas sobram da amostra CHEGA à tela, nos dois caminhos", () => {
  /* Na conversa é CABEÇALHO, e não metadata do fluxo: a metadata só chega no
     chunk final, depois de a resposta inteira ter sido lida — o cabeçalho
     chega antes do primeiro byte, e a tela já sabe o que dizer enquanto o
     texto digita. */
  expect(CONVERSA).toContain("X-Nutricionista-Amostra");
  expect(onde(CONVERSA, "X-Nutricionista-Amostra")).toBeGreaterThan(
    onde(CONVERSA, "decidirAcesso("),
  );
  /* Na foto a resposta já é JSON, então ele viaja como campo. */
  expect(FOTO).toContain("restantesNaAmostra");
});

test("⚠️ o aviso só sai na AMOSTRA — a assinante não conta nada", () => {
  /* Sem este recorte, quem paga leria "restam N perguntas nesta semana" sobre
     um limite que não existe para ela. Nos dois caminhos o número é gateado
     por `acesso.amostra`. */
  for (const [nome, fonte] of [
    ["nutrition", CONVERSA],
    ["prato", FOTO],
  ] as const) {
    expect(`${nome}:${/acesso\.amostra/.test(fonte)}`).toBe(`${nome}:true`);
    expect(`${nome}:${/restantesNaAmostra/.test(fonte)}`).toBe(`${nome}:true`);
  }
});

test("⚠️ a tela não inventa a contagem quando o servidor não manda", () => {
  const TELA = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));
  /* Cabeçalho ausente vira `null`, e `recadoDaAmostra(null)` cala. Um `?? 0`
     aqui diria "essa foi a última" para toda assinante. */
  expect(TELA).toMatch(/sobram === null \? null : Number\(sobram\)/);
  expect(TELA).toContain("recadoDaAmostra(");
});
