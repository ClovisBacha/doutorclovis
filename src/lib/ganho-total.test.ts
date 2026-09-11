/**
 * "GANHO TOTAL" NÃO ERA O GANHO TOTAL.
 *
 * ⚠️ O cartão dizia "📈 Ganho total" e mostrava o último peso menos o
 * **primeiro da lista** — e a lista é cortada em sessenta registros. Duas
 * coisas erradas de uma vez:
 *
 *   · **A base estava errada.** O ganho da gestação se conta a partir do peso
 *     PRÉ-GESTACIONAL, que está no perfil e que esta MESMA tela já lê vinte
 *     linhas abaixo para desenhar a curva do IOM. Medido na bancada: com 62 kg
 *     de partida e 68,4 hoje, o cartão dizia **+1,9 kg** onde o ganho é
 *     **+6,4** — no número que decide se ela está dentro do corredor de ganho
 *     de uma gestação de alto risco.
 *   · **E a base DESLIZAVA.** Passados sessenta registros o primeiro da janela
 *     vai embora e o "ganho total" ENCOLHE sozinho, sem ela ter feito nada.
 *
 * ⚠️ Só apareceu quando a tela virou fotografável. Nenhum teste chegava perto:
 * a conta estava "certa" para o que ela media, e o que estava errado era a
 * palavra "total".
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** ⚠️ A prosa acima cita o que ela cobra — sai antes da busca. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const TELA = semComentarios(readFileSync("src/components/health-tab.tsx", "utf8"));

describe("⚠️ o ganho é contado do peso pré-gestacional", () => {
  test("a base é o peso do PERFIL, e o primeiro registro é só a reserva", () => {
    expect(TELA).toMatch(/const baseDoGanho = prePregW \?\? firstWeight;/);
    expect(TELA).toMatch(/lastWeight - baseDoGanho/);
    /* ⚠️ A conta antiga não pode voltar: ela media a janela, não a gestação. */
    expect(TELA).not.toMatch(/lastWeight - firstWeight/);
  });

  test("⚠️ sem peso pré-gestacional o RÓTULO muda — a conta não chuta", () => {
    /* Trocar a palavra é mais honesto que trocar a conta: aquele número é
       mesmo o ganho desde o primeiro registro, e dizer isso é verdade. */
    expect(TELA).toMatch(/const ganhoDesdeOInicio = prePregW != null;/);
    expect(TELA).toMatch(/ganhoDesdeOInicio \? "Ganho total" : "Ganho desde o 1º registro"/);
    /* E o rótulo não pode voltar a ser cravado. */
    expect(TELA).not.toMatch(/📈 Ganho total<\/p>/);
  });

  test("a base sai do MESMO campo que a curva do IOM usa", () => {
    /* Duas fontes para "de quanto ela partiu" divergiriam, e a divergência
       apareceria como o cartão e o gráfico discordando na mesma tela. */
    const i = TELA.indexOf("const prePregW");
    expect(i).toBeGreaterThan(-1);
    expect(TELA.slice(i, i + 200)).toContain("profile?.pre_pregnancy_weight_kg");
    expect(TELA.indexOf("const baseDoGanho")).toBeGreaterThan(i);
  });

  test("⚠️ e a tela é FOTOGRAFÁVEL — foi assim que isto apareceu", () => {
    const rota = readFileSync("src/routes/preview-saude-registros.tsx", "utf8");
    /* Os dois estados que provam os dois rótulos. */
    expect(rota).toContain("estado=semperfil");
    expect(rota).toContain("pre_pregnancy_weight_kg: 62");
    /* E o estado que mais engana: a leitura falhou COM dados à mostra. */
    expect(rota).toContain('estado === "parcial"');
    expect(rota).toMatch(/logs: NORMAL, instavel: true/);
  });
});
