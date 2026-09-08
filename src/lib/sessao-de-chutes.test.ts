/**
 * UMA SESSÃO DE CHUTES ABANDONADA NÃO PODE VIRAR "0 MOVIMENTOS" NO PRONTUÁRIO.
 *
 * ⚠️ Tocar em "Iniciar sessão" INSERIA na hora uma linha com `kick_count: 0` e
 * `ended_at` nulo. Quem abria a tela e desistia — fechou o app, o telefone
 * dormiu — deixava essa linha para sempre. Ela não aparece no histórico DELA
 * (a lista filtra por `ended_at`), mas `clinical_events` une `kick_sessions`
 * SEM filtro: no prontuário e no "o que mudou desde a última consulta" o
 * médico lia "Movimentos — 0 movimentos", sobre uma contagem que nunca
 * começou.
 *
 * ⚠️ E o conserto NÃO é "só gravar se houver chute": zero movimentos em duas
 * horas é justamente o alarme que esta tela existe para dar — um dos nove
 * sintomas vermelhos. O que separa os dois casos é o ENCERRAMENTO.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** Sem os comentários: eles CITAM os padrões proibidos para explicá-los. */
const semProsa = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const TELA = semProsa(readFileSync("src/components/kicks-tab.tsx", "utf8"));

/** O corpo de uma função, do nome dela até a próxima do mesmo nível. */
function corpo(nome: string): string {
  const i = TELA.indexOf(`function ${nome}(`);
  expect(i).toBeGreaterThan(-1);
  const j = TELA.indexOf("\n  function ", i + 1);
  const k = TELA.indexOf("\n  async function ", i + 1);
  const fim = [j, k].filter((x) => x > i).sort((a, b) => a - b)[0];
  return TELA.slice(i, fim ?? undefined);
}

describe("começar não grava nada", () => {
  test("⚠️ `start` não toca no banco", () => {
    const c = corpo("start");
    expect(c).not.toContain("kick_sessions");
    expect(c).not.toContain(".insert(");
  });

  test("ele guarda o instante do início, que é o que dá sentido à duração", () => {
    /* ⚠️ A asserção cobrava `setActive({ startedAt:` com os dois pontos — e
       reprovou o dia em que o instante virou uma `const` e o objeto passou a
       usar a forma curta (`setActive({ startedAt })`), que é o MESMO
       comportamento. Cobre a garantia: o instante nasce aqui e é o que vai
       para o estado E para a sessão guardada. */
    const c = corpo("start");
    expect(c).toMatch(/const startedAt = new Date\(\)\.toISOString\(\)/);
    expect(c).toMatch(/setActive\(\{\s*startedAt/);
  });

  test("⚠️ e ele GRAVA a sessão no aparelho — trocar de sub-tela apagava duas horas", () => {
    /* `RegistrosHub` renderiza `<Fade key={sub}>`: tocar em Contrações, no
       Diário ou na seta DESMONTA esta aba, e a contagem era estado do React.
       O pior caminho era o do SOCORRO — o botão do cartão vermelho troca de
       aba, ou seja, o único caminho de contato DESTRUÍA a contagem que
       produziu o alarme. */
    expect(corpo("start")).toContain("guardarSessao(uid,");
    expect(corpo("tap")).toContain("guardarSessao(uid,");
    /* E encerrar LIMPA — senão a sessão salva reapareceria na abertura
       seguinte, com o relógio de uma contagem que já virou linha. */
    expect(corpo("stop")).toContain("guardarSessao(uid, null)");
  });
});

describe("encerrar é o que grava", () => {
  const c = corpo("stop");

  test("⚠️ a linha nasce aqui, com o `started_at` do INÍCIO", () => {
    /* Pelo `DEFAULT now()` do banco, a sessão pareceria ter começado no
       instante em que ela encerrou — e a duração é metade da régua
       ("10 em até 2 horas"). */
    expect(c).toContain(".insert(");
    expect(c).toMatch(/started_at:\s*active\.startedAt/);
    expect(c).toMatch(/ended_at:/);
  });

  test("⚠️ ZERO movimentos continua sendo gravado — é o alarme", () => {
    /* Nenhuma condição sobre a contagem entre o começo da função e o insert. */
    const ateOInsert = c.slice(0, c.indexOf(".insert("));
    expect(ateOInsert).not.toMatch(/if\s*\([^)]*(finalCount|count)[^)]*\)/);
  });

  test("⚠️ falhar ao gravar NÃO limpa a tela", () => {
    /* Zerar aqui perderia duas horas de contagem dela. */
    const i = c.indexOf("if (error)");
    expect(i).toBeGreaterThan(-1);
    const j = c.indexOf("}", c.indexOf("return;", i));
    const bloco = c.slice(i, j);
    expect(bloco).toContain("toast.error");
    expect(bloco).not.toContain("setCount(0)");
    expect(bloco).not.toContain("setActive(null)");
  });
});
