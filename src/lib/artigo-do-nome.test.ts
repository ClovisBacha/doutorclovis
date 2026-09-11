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
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
