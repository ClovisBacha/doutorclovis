import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * AS ATIVIDADES NO AMANHECER E SEM RELÓGIO NO JS (18/11/2026, a vistoria de
 * design). Mexer, Meditar, a Carta, a Gratidão, Para vocês dois e Para dormir
 * eram pintados com a paleta Tailwind do site e redesenhavam a tela inteira de
 * 4 a 30 vezes por segundo por um relógio no JS — parte do app "travado".
 *
 * Esta catraca segura o que se perde sem ninguém ver:
 * - nenhum `requestAnimationFrame` e nenhum `setInterval` nas sessões: o
 *   estado muda só nas fronteiras (um `setTimeout`), e o que anda sem parar
 *   anda no motor nativo. O ÚNICO relógio é a contagem do tocador de dormir;
 * - a paleta Tailwind não volta, e a cor de cada atividade segura o AA;
 * - as telas escuras acendem a barra de status, e a folha de sons é a nativa.
 */

const SRC = join(import.meta.dir, "..", "..");
const de = (...p: string[]) => semComentarios(readFileSync(join(SRC, ...p), "utf8"));

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}

const SESSOES = [
  ["app", "jornada", "mexer.tsx"],
  ["app", "jornada", "meditar.tsx"],
  ["app", "jornada", "bebe.tsx"],
  ["app", "jornada", "gratidao.tsx"],
  ["app", "jornada", "casal.tsx"],
  ["app", "jornada", "dormir.tsx"],
  ["componentes", "jornada", "figura-movimento.tsx"],
  ["componentes", "jornada", "atividade.tsx"],
] as const;

describe("as atividades no Amanhecer, sem relógio no JS", () => {
  test("nenhuma sessão redesenha a tela por relógio", () => {
    for (const p of SESSOES) {
      const codigo = de(...p);
      const arquivo = p.join("/");
      expect({ arquivo, quadro: /requestAnimationFrame/.test(codigo) }).toEqual({
        arquivo,
        quadro: false,
      });
      /* Só a contagem do tocador de dormir tem relógio (e só ela se redesenha). */
      const relogios = (codigo.match(/setInterval\(/g) ?? []).length;
      expect({ arquivo, relogios }).toEqual({
        arquivo,
        relogios: arquivo.endsWith("dormir.tsx") ? 1 : 0,
      });
    }
    const dormir = de("app", "jornada", "dormir.tsx");
    const contagem = /function ContagemDoSom[\s\S]*?\n}\n/.exec(dormir)?.[0] ?? "";
    expect(contagem).toMatch(/setInterval\(/);
  });

  test("o anel do Mexer e a figura andam no motor nativo", () => {
    const mexer = de("app", "jornada", "mexer.tsx");
    expect(mexer).toMatch(/Animated\.timing\(anel, \{[\s\S]*?useNativeDriver: true/);
    expect(mexer).not.toMatch(/strokeDashoffset/);
    /* A tela-ponte "Terminou!" (sobra do "Melhorou / Piorou") não volta. */
    expect(mexer).not.toMatch(/"reflexo"\)|etapa === "reflexo"/);
    const figura = de("componentes", "jornada", "figura-movimento.tsx");
    expect(figura).toMatch(/useNativeDriver: true/);
    expect(figura).not.toMatch(/useState/);
  });

  test("a paleta Tailwind das atividades não volta", () => {
    const fora = arquivos(SRC)
      .filter((p) =>
        /\bcor(Movimento|Meditacao|Bebe|Gratidao)\b/.test(semComentarios(readFileSync(p, "utf8"))),
      )
      .map((p) => relative(SRC, p));
    expect(fora).toEqual([]);
  });

  test("a cor de cada atividade segura o AA: branco sobre ela, e ela sobre a névoa", () => {
    const tema = de("tema", "index.ts");
    const doTema = (nome: string) => new RegExp(`\\b${nome}: "(#[0-9a-fA-F]{6})"`).exec(tema)![1]!;
    const cores = de("componentes", "jornada", "cores.ts");
    const bloco = /export const corDaAtividade = \{([\s\S]*?)\} as const;/.exec(cores)![1]!;
    const acoes = [...bloco.matchAll(/(\w+): \{ luz: "(#[0-9a-f]{6})", acao: ([^}]+?) \}/gi)].map(
      ([, nome, , acao]) => {
        const a = acao!.trim();
        return { nome: nome!, hex: a.startsWith('"') ? a.slice(1, -1) : doTema(a.split(".")[1]!) };
      },
    );
    expect(acoes.map((a) => a.nome)).toEqual(["mexer", "meditar", "carta", "gratidao"]);
    const luminancia = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contraste = (a: string, b: string) => {
      const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
      return (x! + 0.05) / (y! + 0.05);
    };
    const fracos = acoes
      .flatMap((a) => [
        { onde: `branco sobre ${a.nome}`, razao: contraste("#ffffff", a.hex) },
        { onde: `${a.nome} sobre a névoa`, razao: contraste(a.hex, doTema("fundo")) },
      ])
      .filter((x) => x.razao < 4.5);
    expect(fracos).toEqual([]);
  });

  test("as telas da noite acendem a barra de status, e a folha de sons é a nativa", () => {
    expect(de("app", "jornada", "casal.tsx")).toMatch(/<StatusBar style="light" animated \/>/);
    const dormir = de("app", "jornada", "dormir.tsx");
    expect(dormir).toMatch(/<StatusBar style="light" animated \/>/);
    expect(dormir).toMatch(/<StatusBar style="light" hidden=\{escuro\} animated \/>/);
    expect(de("componentes", "jornada", "atividade.tsx")).toMatch(/presentationStyle="pageSheet"/);
    const folha = de("componentes", "jornada", "folha-de-sons.tsx");
    expect(folha).toMatch(/<FolhaDaAtividade/);
    expect(folha).not.toMatch(/transparent/);
  });
});
