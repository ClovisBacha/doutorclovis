import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "./sem-comentarios";
import { PERDA_DE_PESO_PCT, sinalPerdaDePeso } from "./sinais-clinicos";

/**
 * ⚠️ O MÉDICO PASSOU A VER A PERDA DE PESO — e o cartão parou de AFIRMAR
 * "normal" sobre ela.
 *
 * `sinalPerdaDePeso` existia desde set/2026 com **um leitor só: o prompt da
 * nutricionista**. Do lado do médico, o cartão "Peso" do prontuário calculava o
 * ganho e cravava `gravidade="normal"` sempre que houvesse os dois números — ou
 * seja, uma paciente que caiu de 62 para 55 kg aparecia com "−6,8 kg na
 * gestação" em cinza neutro, do lado de uma pressão em âmbar.
 *
 * ⚠️ Isso não é omissão, é AFIRMAÇÃO: é a mesma família da glicemia que o prompt
 * dizia estar "dentro do alvo" sem saber se foi em jejum.
 */

const CARD = semComentarios(readFileSync("src/components/prontuario-paciente.tsx", "utf8"));
const SERVER = semComentarios(readFileSync("src/lib/clinical.functions.ts", "utf8"));

describe("a régua na tela do médico", () => {
  test("o cartão chama `sinalPerdaDePeso` — e não uma conta própria", () => {
    expect(CARD).toContain("sinalPerdaDePeso(peso.ultimo, ficha.pesoPreGestacional)");
  });

  /**
   * ⚠️ OS DOIS PORTÕES SÃO DO CHAMADOR, e `sinais-clinicos.ts` declara isso no
   * cabeçalho da régua: depois do parto e no luto o corpo perde peso, e é
   * esperado. Marcar isso na tela clínica ensinaria o médico a ignorar o sinal.
   */
  test("⚠️ o luto e o pós-parto gateiam a régua", () => {
    const i = CARD.indexOf("const perda =");
    expect(i).toBeGreaterThan(-1);
    const bloco = CARD.slice(i, CARD.indexOf(";", CARD.indexOf("sinalPerdaDePeso", i)));
    expect(bloco).toContain("ficha.modoCuidado");
    expect(bloco).toContain("ficha.jaPariu");
    /* e os dois levam a NENHUM sinal, nunca a um sinal mais fraco */
    expect(bloco).toMatch(/\?\s*null/);
  });

  test("o limite mora em `sinais-clinicos.ts`, e em nenhum outro lugar", () => {
    expect(PERDA_DE_PESO_PCT).toBe(5);
    /* nenhuma cópia do número na tela nem no servidor */
    expect(CARD).not.toContain("PERDA_DE_PESO_PCT");
    expect(CARD).not.toMatch(/0\.05|\b5\s*%/);
  });

  test("a régua ainda responde o que prometeu", () => {
    expect(sinalPerdaDePeso(55.2, 62)?.gravidade).toBe("atencao");
    expect(sinalPerdaDePeso(71.4, 62)?.gravidade).toBe("normal");
    /* ⚠️ NUNCA `grave`: perda isolada não é emergência de minutos, e marcá-la
       grave poria uma queda de 3 kg acima de um SANGRAMENTO na fila. */
    expect(sinalPerdaDePeso(40, 90)?.gravidade).not.toBe("grave");
  });

  test('⚠️ "na gestação" não é dito a quem já pariu', () => {
    const i = CARD.indexOf("kg ${");
    expect(i).toBeGreaterThan(-1);
    expect(CARD.slice(i, i + 140)).toContain("ficha.jaPariu");
  });
});

describe("⚠️ `birth_date` tem degrau PRÓPRIO", () => {
  /**
   * A coluna nasceu numa migration posterior às do perfil rico. Sem um degrau
   * só dela, um banco atrasado devolveria `42703` para a consulta INTEIRA e a
   * ficha cairia no mínimo: alergias, medicações e a história de risco viravam
   * DESCONHECIDAS por causa de uma coluna que a tela usa só para saber se ela
   * pariu. É a "coluna nova apagando o recurso antigo".
   */
  test("a escada tem TRÊS degraus, e o do meio é derivado por remoção", () => {
    expect(SERVER).toContain('PERFIL_COLS.replace(",birth_date", "")');
    const laco = SERVER.slice(SERVER.indexOf("for (const cols of ["));
    const lista = laco.slice(0, laco.indexOf("]"));
    expect(lista).toContain("PERFIL_COLS");
    expect(lista).toContain("PERFIL_SEM_NASCIMENTO");
    expect(lista).toContain("display_name,baby_name,lmp_date,due_date");
  });

  test("⚠️ e o degrau do nascimento NÃO acende `degradada`", () => {
    const i = SERVER.indexOf("degradada = true");
    const linha = SERVER.slice(SERVER.lastIndexOf("if (", i), i);
    expect(linha).toContain("cols !== PERFIL_SEM_NASCIMENTO");
  });

  test('`jaPariu` sai de `birth_date`, e "não sei" vale NÃO PARIU', () => {
    expect(SERVER).toContain("jaPariu: !!perfil.birth_date");
  });
});
