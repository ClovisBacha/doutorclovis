/**
 * A NOTA CLÍNICA NÃO PODE SER PERDIDA EM SILÊNCIO.
 *
 * `doSaveNote` (`painel.tsx`) descartava o retorno de `saveDoctorClinicalNote`
 * e não tinha `try/catch`. Os dois desfechos ruins eram mudos:
 *
 *  · **Recusa.** O servidor devolve `{ ok: false }` numa resposta 200 NORMAL —
 *    sessão inválida, sessão de outro médico, erro do banco — e nenhum desses
 *    casos LANÇA, então um `try/catch` sozinho nunca os pegaria. A tela ficava
 *    em silêncio absoluto: o botão voltava de "Salvando…" para "💾 Salvar
 *    nota", exatamente como no sucesso. O texto continuava à vista por
 *    acidente (`generatedNote` é estado local e sobrevive ao refresh), e é
 *    isso que fecha a armadilha — ele lê a nota na tela, conclui que salvou,
 *    fecha, e o estado local morre com a navegação.
 *  · **Rede.** A promessa rejeitava, `setSavingNote(null)` nunca rodava, e o
 *    botão ficava preso em "Salvando…" até o F5 — sem nem poder tentar de
 *    novo. É a mesma forma do SOS sem teto de tempo, que este repositório já
 *    pagou uma vez.
 *
 * Nota clínica é o registro que outro profissional lê depois. E o padrão
 * inteiro já existia em `doGenerateNote`, dez linhas acima, na MESMA tela —
 * a régua aplicada num lugar e deixada de pé no vizinho, que é a forma mais
 * comum de defeito deste repositório.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "./sem-comentarios";

/**
 * ⚠️ A PROSA SAI ANTES, e aqui isso não é ritual: o comentário de
 * `doSaveNote` CITA `{ ok: false }`, `setSavingNote(null)` e `onRefresh()`
 * para explicar por que eles estão onde estão. Sem esta linha, as asserções
 * abaixo ficariam verdes lendo a explicação do defeito em vez do conserto.
 */
const PAINEL = semComentarios(readFileSync("src/routes/_authenticated/painel.tsx", "utf8"));

/**
 * O corpo de uma função, por CONTAGEM DE CHAVES.
 *
 * ⚠️ Uma janela de N caracteres mentiria nos dois sentidos: curta demais ela
 * corta o `finally`, e larga demais ela alcança a função vizinha — que aqui é
 * justamente `doGenerateNote`, cujo corpo satisfaz quase todas estas
 * asserções sozinho.
 */
function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  const abre = fonte.indexOf("{", i);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

const SALVAR = corpoDe(PAINEL, "async function doSaveNote(");

describe("a gravação da nota clínica tem desfecho", () => {
  test("a âncora casou — sem isto, todo o resto passa em vazio", () => {
    /* `indexOf` devolve −1 quando a assinatura muda de nome, e um corpo vazio
       satisfaz qualquer `not.toContain`. Esta é a asserção que impede o
       arquivo inteiro de virar enfeite. */
    expect(SALVAR.length).toBeGreaterThan(200);
    expect(SALVAR).toContain("saveDoctorClinicalNote(");
  });

  test("⚠️ o retorno é LIDO — `{ ok: false }` vem numa resposta 200", () => {
    /* A garantia é que o desfecho da chamada decida alguma coisa. A grafia
       pode mudar (`!res.ok`, `res.ok === false`, outro nome de variável); o
       que não pode é o valor ser descartado. */
    expect(SALVAR).toMatch(/const\s+\w+\s*=\s*await\s+saveDoctorClinicalNote\(/);
    expect(SALVAR).toMatch(/if\s*\(\s*!\w+\.ok\s*\)|if\s*\(\s*\w+\.ok\s*\)/);
  });

  test("⚠️ a recusa DIZ alguma coisa, e o caminho de rede também", () => {
    expect(SALVAR).toContain("catch");
    /* Dois recados: um no ramo da recusa, outro no `catch`. Um só deixaria
       metade dos desfechos muda. */
    expect((SALVAR.match(/toast\.error\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("⚠️ o botão SEMPRE volta — `setSavingNote(null)` no `finally`", () => {
    /* Fora do `finally`, a rejeição da rede o pula e o botão fica preso em
       "Salvando…" para sempre. */
    const finallyDoCorpo = SALVAR.slice(SALVAR.indexOf("} finally {"));
    expect(SALVAR).toContain("} finally {");
    expect(finallyDoCorpo).toContain("setSavingNote(null)");
  });

  test("⚠️ `onRefresh()` só roda no SUCESSO", () => {
    /* Recarregar depois de uma recusa é o que tornaria "o texto continua
       aqui" dependente de sorte: hoje ele sobrevive porque `generatedNote` é
       estado local, e depender disso é depender de um acidente. */
    const recusa = SALVAR.search(/if\s*\(\s*!\w+\.ok\s*\)/);
    const refresh = SALVAR.indexOf("onRefresh()");
    expect(recusa).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(recusa);
    /* E o ramo da recusa SAI antes de chegar nele. */
    expect(SALVAR.slice(recusa, refresh)).toContain("return;");
  });

  test("⚠️ o sucesso também fala — senão ele é indistinguível da recusa", () => {
    expect(SALVAR).toContain("toast.success(");
  });
});
