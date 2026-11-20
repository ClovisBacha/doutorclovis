import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { babyForWeek, WEEK_MAX, WEEK_MIN } from "@/lib/gestacao";
import { semComentarios } from "@/lib/sem-comentarios";
import { EMOJI_DA_FRUTA_NO_APP, emojiDaFrutaNoApp } from "~/lib/bebe-da-semana";

/**
 * A FRUTA DA SEMANA (18/11/2026, a vistoria): o emoji do site desenhava "o
 * parente mais próximo" — uma cebola ao lado de "Alho-poró", um melão ao lado
 * de "Mamão", brócolis ao lado de "Couve-flor", um morango ao lado de
 * "Framboesa". Esta catraca cobra que NENHUM emoji do app desenhe outra fruta.
 *
 * O dicionário abaixo diz, de forma independente da tabela do app, o que cada
 * emoji desenha (pelo nome do Unicode). Um par só passa se o nome da fruta,
 * sem os qualificadores de tamanho ("grande", "pequena", "honeydew"), for
 * exatamente o que o emoji desenha.
 */
const O_QUE_O_EMOJI_DESENHA: Readonly<Record<string, readonly string[]>> = {
  "🫐": ["mirtilo"],
  "🍇": ["uva"],
  "🍓": ["morango"],
  "🍋": ["limão siciliano"],
  "🍎": ["maçã"],
  "🥑": ["abacate"],
  "🧅": ["cebola"],
  "🫑": ["pimentão"],
  "🍅": ["tomate"],
  "🍌": ["banana"],
  "🥕": ["cenoura"],
  "🌽": ["milho", "espiga de milho"],
  "🥭": ["manga"],
  "🍆": ["berinjela"],
  "🥒": ["pepino"],
  "🥥": ["coco"],
  "🍍": ["abacaxi"],
  "🍈": ["melão"],
  "🍉": ["melancia"],
};

const semTamanho = (fruta: string) =>
  fruta
    .toLowerCase()
    .replace(/\s+(grande|pequen[ao]|honeydew)$/u, "")
    .trim();

const FRUTAS_DA_TABELA = new Set(
  Array.from({ length: WEEK_MAX - WEEK_MIN + 1 }, (_, i) => babyForWeek(WEEK_MIN + i).fruit),
);

describe("a fruta da semana no app", () => {
  test("cada emoji desenha a fruta que está escrita ao lado", () => {
    const errados = Object.entries(EMOJI_DA_FRUTA_NO_APP)
      .filter(([fruta, emoji]) => !(O_QUE_O_EMOJI_DESENHA[emoji] ?? []).includes(semTamanho(fruta)))
      .map(([fruta, emoji]) => `${fruta} ${emoji}`);
    expect(errados).toEqual([]);
  });

  test("toda fruta da tabela do app existe na tabela do bebê (nenhum par morto)", () => {
    const mortos = Object.keys(EMOJI_DA_FRUTA_NO_APP).filter((f) => !FRUTAS_DA_TABELA.has(f));
    expect(mortos).toEqual([]);
  });

  test("as que a vistoria pegou ficam sem emoji (a tela desenha a régua)", () => {
    for (const fruta of [
      "Alho-poró",
      "Mamão",
      "Couve-flor",
      "Figo",
      "Framboesa",
      "Jaca pequena",
      "Semente de papoula",
      "Aipo",
      "Abóbora",
      "Abóbora moranga",
      "Abóbora grande",
      "Limão",
      "Vagem",
    ])
      expect({ fruta, emoji: EMOJI_DA_FRUTA_NO_APP[fruta] ?? null }).toEqual({
        fruta,
        emoji: null,
      });
    /* Semana 24 é milho; 38 é alho-poró (sem par); 8 é framboesa (sem par). */
    expect(emojiDaFrutaNoApp(24)).toBe("🌽");
    expect(emojiDaFrutaNoApp(38)).toBeNull();
    expect(emojiDaFrutaNoApp(8)).toBeNull();
  });

  test("as telas do bebê e a festa da semana não desenham o emoji do site", () => {
    const RAIZ = join(import.meta.dir, "..");
    for (const arquivo of [
      join("componentes", "jornada", "bebe-nesta-semana.tsx"),
      join("componentes", "jornada", "marco.tsx"),
      join("app", "bebe.tsx"),
    ]) {
      const codigo = semComentarios(readFileSync(join(RAIZ, arquivo), "utf8"));
      expect({ arquivo, usa: /\bfruitEmojiForWeek\b/.test(codigo) }).toEqual({
        arquivo,
        usa: false,
      });
    }
  });
});
