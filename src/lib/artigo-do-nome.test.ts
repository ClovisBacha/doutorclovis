/**
 * ⚠️ O ARTIGO ANTES DO NOME DO BEBÊ — a armadilha que já apareceu TRÊS vezes.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * `baby_name` é um campo livre e **não carrega gênero**. Toda tentativa de
 * escolher "o" ou "a" a partir do nome erra: pela primeira letra, "Helena" vira
 * "**do** Helena" (medido); por lista de nomes, erra no primeiro nome fora da
 * lista; por heurística de terminação, erra em "Alex", "Ariel", "Miguel".
 *
 * Histórico no repo:
 *   1. o bolão do nascimento — "Quando **o** Helena nasce?"
 *   2. o agradecimento do chá de bebê — documentado no CLAUDE.md
 *   3. o exemplo do título da lista do chá — reintroduzido em ago/2026,
 *      na mesma rodada em que a regra foi relida
 *
 * A régua: **nome de bebê nunca leva artigo definido colado.** Usa-se
 * travessão, dois-pontos, vírgula, ou a frase é reescrita.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { semComentarios } from "./sem-comentarios";
import { join } from "node:path";

/** Todo `.ts`/`.tsx` de produção — o pronome erra em qualquer tela. */
function fontesDoApp(dir = "src", out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fontesDoApp(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

/**
 * Os padrões que tentam adivinhar o gênero a partir do nome.
 *
 * ⚠️ Casam a CONSTRUÇÃO, não a palavra: é o `d${...}` interpolado e o ternário
 * de vogal que produzem o defeito.
 */
const ADIVINHACOES: { nome: string; re: RegExp }[] = [
  {
    /**
     * ⚠️ **PRECISO, e a primeira versão era larga demais.** `/`d\$\{[^}]*\}/`
     * casava `` `dc-path-day-d${D}` `` — a chave do dia da trilha, que não tem
     * nada a ver com artigo. Uma catraca que reprova código correto é uma
     * catraca que a próxima pessoa desliga.
     *
     * O que se procura é a interpolação colada num `d` cujo corpo produz
     * literalmente "a" ou "o": `d${... ? "a" : "o"}`.
     */
    nome: 'artigo por interpolação (`d${… ? "a" : "o"}`)',
    re: /\bd\$\{[^}]*["']a["'][^}]*["']o["'][^}]*\}/,
  },
  {
    nome: "ternário de vogal escolhendo 'a' ou 'o'",
    re: /\[aeiou[^\]]*\][^?]{0,80}\?\s*["']a["']\s*:\s*["']o["']/i,
  },
];

function fontes(): { arquivo: string; codigo: string }[] {
  const saida: { arquivo: string; codigo: string }[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, nome.name);
      if (nome.isDirectory()) anda(caminho);
      else if (/\.(ts|tsx)$/.test(nome.name) && !nome.name.includes(".test.")) {
        saida.push({
          arquivo: caminho,
          /* ⚠️ Tira os comentários: este projeto CITA os padrões que proíbe
             para explicá-los, e um teste que casa a própria documentação fica
             verde exatamente quando o defeito está descrito. */
          codigo: readFileSync(caminho, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, ""),
        });
      }
    }
  };
  anda("src");
  return saida;
}

describe("⚠️ o artigo antes do nome do bebê", () => {
  test("ninguém adivinha o gênero a partir do nome", () => {
    const culpados: string[] = [];
    for (const { arquivo, codigo } of fontes()) {
      for (const a of ADIVINHACOES) {
        if (a.re.test(codigo)) culpados.push(`${arquivo} → ${a.nome}`);
      }
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e a prova de por que a primeira letra não serve", () => {
    /* O teste acima é uma catraca de texto; este é o argumento. Quem for
       relaxar a catraca precisa antes explicar estes três nomes. */
    const porVogal = (n: string) => (/^[aeiouAEIOU]/.test(n) ? "a" : "o");
    expect(porVogal("Helena")).toBe("o"); // errado: Helena é feminino
    expect(porVogal("Ariel")).toBe("a"); // errado: pode ser os dois
    expect(porVogal("Miguel")).toBe("o"); // certo por acaso, não por regra
  });
});

/**
 * ⚠️ E O PRIMO DELE: O PRONOME.
 *
 * A mesma premissa falsa ("o nome diz o gênero") produz um segundo defeito, e
 * ele apareceu duas vezes mais:
 *
 *   4. a linha de socorro dos chutes — "menos que o normal DELE", consertada em
 *      set/2026 numa das TRÊS ocorrências do mesmo arquivo;
 *   5. o resumo da semana da aba Bebê — `{baby_name ? "ele" : "seu bebê"}`, que
 *      escrevia "ele vai ter o tamanho de mamão" para a mãe de uma menina.
 *
 * A régua: quando o app precisa se referir ao bebê, usa **o NOME** (que é o que
 * ela escreveu) ou reescreve a frase. Nunca um pronome escolhido a partir da
 * existência do nome.
 *
 * ⚠️ E "dele" NÃO é proibido por si só: em "A última ficou acima **dele**" o
 * antecedente é *o intervalo*, masculino gramatical, e está correto. Uma
 * catraca que reprovasse isso reprovaria português certo — e catraca que
 * reprova o estado correto é catraca que alguém desliga.
 */
describe("⚠️ o PRONOME do bebê — a mesma premissa falsa, outra forma", () => {
  test("nenhuma tela escolhe o pronome a partir do nome do bebê", () => {
    const culpados: string[] = [];
    for (const arq of fontesDoApp()) {
      const codigo = semComentarios(readFileSync(arq, "utf8"));
      /* A construção exata: um ternário sobre o nome do bebê cujo ramo
         verdadeiro é um pronome masculino. */
      if (/(baby_?[Nn]ame|babyName)[^?\n]{0,30}\?\s*"(ele|dele|nele)"/.test(codigo)) {
        culpados.push(arq);
      }
    }
    expect(culpados).toEqual([]);
  });

  test("a frase do socorro não volta a ter dono", () => {
    /* "menos que o normal dele" fala SEMPRE do bebê — conferido nas duas
       ocorrências que existiam (a linha de socorro dos chutes e as bandeiras
       vermelhas da ACOG no cronômetro de contrações). */
    const culpados: string[] = [];
    for (const arq of fontesDoApp()) {
      const codigo = semComentarios(readFileSync(arq, "utf8"));
      if (/normal dele/i.test(codigo)) culpados.push(arq);
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e a catraca NÃO reprova o 'dele' com antecedente masculino", () => {
    /* Contraprova: a frase certa do gráfico de chutes continua existindo, e
       nenhuma das duas regras acima a alcança. */
    const chutes = semComentarios(readFileSync("src/components/kicks-tab.tsx", "utf8"));
    expect(chutes.includes("A última ficou acima dele.")).toBe(true);
  });
});
