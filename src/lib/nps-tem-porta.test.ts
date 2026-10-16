/**
 * O NPS NÃO TINHA COMO RECEBER UMA RESPOSTA.
 *
 * ⚠️ `shouldAskNps` e `submitNps` estavam escritas, testadas, com a trava
 * anti-repetição no servidor — e **sem chamador nenhum no app**. `getNpsReport`
 * tinha tela no admin: o dono abria o relatório e via ZERO para sempre, sem
 * nada quebrado a que apontar. É a forma mais cara de recurso morto — o painel
 * parecia funcionar e media o vazio.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const TELA = semComentarios(readFileSync("src/components/pesquisa-nps.tsx", "utf8"));
const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
const PAINEL = semComentarios(readFileSync("src/routes/_authenticated/painel.tsx", "utf8"));
const SERVIDOR = semComentarios(readFileSync("src/lib/nps.functions.ts", "utf8"));

describe("as duas pontas existem", () => {
  test("⚠️ a tela chama as duas funções que estavam órfãs", () => {
    expect(TELA).toContain("shouldAskNps({");
    expect(TELA).toContain("submitNps({");
  });

  test("⚠️ e ela é montada nos DOIS lados — o relatório separa por papel", () => {
    /* `byRole` divide médico e paciente. Montando só de um lado, metade do
       relatório do dono continuaria em zero para sempre. */
    expect(CONTA).toContain("<PesquisaNps");
    expect(PAINEL).toContain("<PesquisaNps");
  });

  test("⚠️ na PACIENTE, o 'não sei' chega como `undefined`", () => {
    /* A prop `careMode` daquela aba é `boolean` puro: antes de o perfil
       carregar ela vale `false` — "não está de luto" — e o portão não
       protegeria nada. `profile === null` é o "não sei" de verdade. */
    expect(CONTA).toContain("careMode={profile ? careMode : undefined}");
  });

  test("⚠️ no MÉDICO, `careMode={false}` explícito", () => {
    /* Modo Cuidado é da paciente; um médico não tem esse estado, e `undefined`
       calaria a pesquisa deste lado para sempre. */
    expect(PAINEL).toContain("<PesquisaNps tokenFn={token} careMode={false} />");
  });
});

describe("quando é decente perguntar", () => {
  test("⚠️ o portão do luto e o do adiamento rodam ANTES da ida ao servidor", () => {
    /* Senão toda abertura em Modo Cuidado gastaria uma consulta para descobrir
       que não pode perguntar. */
    const iLocal = TELA.indexOf("podeMostrarNps(");
    const iRede = TELA.indexOf("shouldAskNps({");
    expect(iLocal).toBeGreaterThan(-1);
    expect(iRede).toBeGreaterThan(iLocal);
  });

  test("⚠️ `ok: false` do servidor NÃO vira 'pergunte'", () => {
    /* O padrão de uma pesquisa é o silêncio. Insistir com quem o servidor não
       conseguiu conferir é o tipo de coisa que faz alguém desinstalar. */
    expect(TELA).toContain("if (vivo && r.ok && r.ask) setFase");
  });

  test("⚠️ conta NOVA não é perguntada — a régua entrou no servidor", () => {
    /* O único corte era "90 dias desde a última resposta": quem criava a conta
       era perguntada na primeira abertura, e a resposta mediria a expectativa
       dela, não o produto. */
    expect(SERVIDOR).toContain("contaNovaDemais(user.created_at");
    expect(SERVIDOR).toContain('import("@/lib/nps")');
  });

  test("⚠️ a régua mora em `lib/`, e não no componente", () => {
    /* `pesquisa-nps.tsx` importa React; um teste dela morreria no primeiro
       import. Mesma razão de `assinatura.ts` e `frases-do-mascote.ts`. */
    const regua = readFileSync("src/lib/nps.ts", "utf8");
    expect(regua).not.toMatch(/from "react"/);
    expect(TELA).toContain('from "@/lib/nps"');
    expect(TELA).not.toMatch(/export function podeMostrarNps/);
  });
});

describe("a pesquisa não cobra por um favor", () => {
  test("⚠️ recusa do servidor NÃO vira erro na tela", () => {
    /* Mostrar um erro a quem acabou de fazer um favor ao produto é cobrar duas
       vezes por um gesto voluntário. A tela agradece e se fecha nos dois casos,
       e o carimbo de adiamento entra do mesmo jeito. */
    expect(TELA).not.toMatch(/toast\.error/);
    expect(TELA).toContain('setFase("obrigada")');
  });

  test("⚠️ o agradecimento é UM só, e não fala de loja", () => {
    /* "Avalie na loja" para quem deu 10 é o review gating que a diretriz 1.1.7
       da App Store proíbe. */
    expect(TELA).toContain("{AGRADECIMENTO}");
    expect(TELA).not.toMatch(/App Store|Play Store|avaliar na loja/i);
  });

  test("⚠️ o 'Agora não' é lembrado, e a falha de storage não quebra nada", () => {
    expect(TELA).toContain("localStorage.setItem(CHAVE_DISPENSA");
    /* Aba anônima e cota estourada: ela vê de novo, e o botão continua ali. */
    expect(TELA).toMatch(/try \{\s*localStorage\.setItem\(CHAVE_DISPENSA/);
  });

  test("⚠️ os alvos são de 44px, em DUAS fileiras", () => {
    /* Onze alvos de 44px somam 484px e a tela tem 393: numa linha só cada botão
       media 26px de largura. Medido na bancada; com `grid-cols-6` ficam 50x44. */
    expect(TELA).toContain("grid-cols-6");
    expect(TELA).not.toContain("grid-cols-11");
    expect(TELA).toContain("min-h-[44px]");
  });
});
