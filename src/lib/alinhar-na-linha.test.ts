/**
 * O ALINHAMENTO DA FITA — e por que ele precisou de uma conta.
 *
 * O dono viu o troféu pendurado abaixo dos números: "a base do troféu tem que
 * ficar alinhada com a base dos números, toda essa nav bar". Ele estava certo
 * sobre os três ícones, não só o troféu — nenhum estava na linha, porque
 * `items-center` centra a CAIXA e cada arte tem margem interna própria:
 *
 *   chama 78,1% · calendário 89,4% · troféu 98,3%  (medidos)
 *
 * O calendário depois virou o ícone das Amigas, cuja tinta encosta na borda
 * (fração 1) — a régua não mudou, só a arte que passa por ela.
 *
 * Com as caixas centradas, isso punha as bases em 33,3 · 37,0 · 39,1 numa fita
 * cuja base do texto está em 31,5. Depois da régua, medido no navegador com as
 * duas fotos e a chama congelada: 31,67 · 31,67 · 32,00.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { deslocamentoDaLinha } from "./alinhar-na-linha";

/** Onde a base do texto cai numa fita de 18px: 5,5px abaixo do centro. */
const BASE_DO_TEXTO = 5.5;

/** A conta que a tela faz: onde a tinta pousa depois do deslocamento. */
const ondePousa = (altura: number, baseDaTinta: number, fonte = 18) =>
  altura * (baseDaTinta - 0.5) + deslocamentoDaLinha({ altura, baseDaTinta, fonte });

describe("a tinta pousa na linha de base, seja qual for a arte", () => {
  test("os três ícones da fita", () => {
    /* Alvo: 5,5px abaixo do centro da linha — exatamente onde os algarismos
       apoiam. As três artes chegam lá por deslocamentos diferentes.

       Precisão de 0,05px e não de 0,000001: `deslocamentoDaLinha` arredonda o
       resultado a duas casas de propósito (é um valor de CSS), então exigir
       mais que isso testaria o arredondamento, não o alinhamento. 0,05px é um
       sétimo de pixel real num iPhone. */
    expect(ondePousa(26, 0.7813)).toBeCloseTo(BASE_DO_TEXTO, 1);
    expect(ondePousa(22, 0.8939)).toBeCloseTo(BASE_DO_TEXTO, 1);
    expect(ondePousa(27, 0.9833)).toBeCloseTo(BASE_DO_TEXTO, 1);
  });

  test("arte que preenche a caixa e arte que não preenchem chegam ao mesmo lugar", () => {
    for (const f of [0.5, 0.6, 0.75, 0.9, 1]) {
      expect(ondePousa(30, f)).toBeCloseTo(BASE_DO_TEXTO, 1);
    }
  });
});

describe("os deslocamentos que a fita usa hoje", () => {
  test("troféu sobe mais que os outros — é a caixa mais alta e a tinta mais baixa", () => {
    const chama = deslocamentoDaLinha({ altura: 26, baseDaTinta: 0.7813 });
    const cal = deslocamentoDaLinha({ altura: 22, baseDaTinta: 0.8939 });
    const trofeu = deslocamentoDaLinha({ altura: 27, baseDaTinta: 0.9833 });
    expect(chama).toBeCloseTo(-1.81, 2);
    expect(cal).toBeCloseTo(-3.17, 2);
    expect(trofeu).toBeCloseTo(-7.55, 2);
    /* A ordem importa: se o troféu deixar de ser o que mais sobe, ou a régua
       mudou de sentido ou alguém trocou uma fração por estimativa. */
    expect(trofeu).toBeLessThan(cal);
    expect(cal).toBeLessThan(chama);
  });
});

describe("escala com o tamanho, em vez de px cravado", () => {
  test("dobrar o ícone dobra a correção da arte", () => {
    /* Era o risco de resolver com um número mágico: funcionaria hoje e
       quebraria no primeiro ícone que mudasse de tamanho. */
    const a = deslocamentoDaLinha({ altura: 20, baseDaTinta: 1 });
    const b = deslocamentoDaLinha({ altura: 40, baseDaTinta: 1 });
    expect(5.5 - a).toBeCloseTo((5.5 - b) / 2, 1);
  });

  test("fonte maior empurra a linha para baixo", () => {
    const p = deslocamentoDaLinha({ altura: 26, baseDaTinta: 0.78, fonte: 18 });
    const g = deslocamentoDaLinha({ altura: 26, baseDaTinta: 0.78, fonte: 24 });
    expect(g).toBeGreaterThan(p);
  });
});

describe("a fita usa a régua, e não px soltos", () => {
  const jogo = readFileSync("src/components/gestacao-path.tsx", "utf8");
  const trofeu = readFileSync("src/components/trofeu.tsx", "utf8");
  const chama = readFileSync("src/components/chama-sequencia.tsx", "utf8");

  test("os três passam por `deslocamentoDaLinha`", () => {
    /* O calendário saiu da fita (virou o ícone das Amigas, a pedido do dono).
       A fração dele é 0,9242 — MEDIDA com o ícone isolado sobre fundo
       transparente. Eu tinha estimado 1, supondo que o disco do `+` encostasse
       na borda do `viewBox`, e o ícone subiu 1,67px acima da linha. */
    expect(jogo).toContain("deslocamentoDaLinha({ altura: 22, baseDaTinta: 0.9242 })");
    expect(trofeu).toContain("deslocamentoDaLinha({");
    expect(chama).toContain("deslocamentoDaLinha({");
  });

  test("nenhuma fração da fita é 1 — nenhuma arte encosta na borda", () => {
    /* `1` é o valor que se escreve quando se ESTIMA em vez de medir: significa
       "a tinta vai até a borda do quadro", e nenhum dos três ícones faz isso
       (0,7813 · 0,9242 · 0,9833). Um `1` reaparecendo aqui é o sinal de que
       alguém pulou a medição — foi assim que o ícone das Amigas nasceu 1,67px
       acima da linha. */
    expect(jogo).not.toMatch(/baseDaTinta: 1\s*\}/);
    expect(trofeu).not.toMatch(/const BASE_DA_TINTA = 1;/);
    /* A chama tem DUAS artes — acesa e o contorno de apagada —, e a apagada
       também estava em 1 (5,5px alta). As duas medidas caem quase juntas
       (0,7813 e 0,7879), que é o que impede a chama de pular de altura no dia
       em que ela acende. */
    expect(chama).not.toMatch(/deslocar\(1\)/);
    expect(chama).toMatch(/const BASE_DA_TINTA_APAGADA = 0\.7879;/);
  });

  test("as frações são constantes nomeadas, não literais no meio do JSX", () => {
    /* Uma fração solta no meio da marcação é indistinguível de chute, e a
       próxima pessoa não saberia que ela veio de medição. */
    expect(trofeu).toMatch(/const BASE_DA_TINTA = 0\.9833;/);
    expect(chama).toMatch(/const BASE_DA_TINTA = 0\.7813;/);
  });

  test("o deslocamento é `translateY`, e não margem", () => {
    /* Margem empurraria os vizinhos na fita; o ajuste é visual. */
    expect(trofeu).toContain("translateY(");
    expect(chama).toContain("translateY(");
    expect(jogo).toContain("translateY(");
  });
});
