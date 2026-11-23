import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * SEM BEBÊ ILUSTRADO (19/11/2026, decisão do dono): "nosso principal
 * personagem agora será o bebê bolha. Eu quero tirar as imagens dos bebês
 * [...] o número 24 ali estava muito bacana".
 *
 * O app não desenha o bebê: nem o feto da semana (`arteDoBebe`, o `BEBE` de
 * `componentes/artes.ts`, as artes de `src/assets/bebes/`), nem o
 * recém-nascido enrolado (`src/assets/bebe/semana.webp`, o `RECEM_NASCIDO`).
 * No lugar, a Bolha, e o número gigante da semana atrás dela. As artes de
 * OBJETO de `src/assets/bebe/` (o álbum, a carta, o quartinho…) ficam.
 *
 * As artes continuam no SITE (`src/assets`, que não muda mais): a catraca
 * olha só o app (`mobile/src`).
 */

const RAIZ = join(import.meta.dir, "..");

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}

const FONTES = arquivos(RAIZ).map((p) => ({
  arquivo: relative(RAIZ, p),
  codigo: semComentarios(readFileSync(p, "utf8")),
}));

/** O que desenha o bebê. */
const BEBE_ILUSTRADO: readonly { nome: string; re: RegExp }[] = [
  { nome: "arteDoBebe", re: /\barteDoBebe\b|jornada\/arte-do-bebe/ },
  {
    nome: "BEBE de artes.ts",
    re: /\bBEBE\[|import\s*\{[^}]*\bBEBE\b[^}]*\}\s*from\s*"~\/componentes\/artes"/,
  },
  { nome: "assets/bebes/", re: /assets\/bebes\// },
  { nome: "assets/bebe/semana.webp", re: /assets\/bebe\/semana\.webp/ },
  { nome: "RECEM_NASCIDO", re: /\bRECEM_NASCIDO\b/ },
];

/**
 * ⚠️ LISTA PROVISÓRIA (19/11/2026): os arquivos de OUTROS pacotes da rodada
 * que ainda desenham o bebê quando esta catraca nasceu. Cada pacote tira o
 * seu; quem junta os pacotes ZERA a lista (e apaga `arte-do-bebe.ts`, que só
 * existe por eles). A lista só encolhe: um arquivo que não usa mais sai dela
 * (o segundo teste cobra), e nenhum arquivo novo entra.
 */
const AINDA_DESENHAM_O_BEBE: readonly string[] = [
  /* Zerada em 19/11/2026, depois de juntar os pacotes A–E: nenhum arquivo do
     app desenha mais o bebê. Não volta a crescer. */
];

const usos = (codigo: string) => BEBE_ILUSTRADO.filter((b) => b.re.test(codigo)).map((b) => b.nome);

describe("o app não desenha o bebê: a Bolha é a personagem", () => {
  test("nenhum arquivo do app usa uma arte do bebê (fora a lista provisória)", () => {
    const fora = FONTES.filter((f) => !AINDA_DESENHAM_O_BEBE.includes(f.arquivo))
      .map((f) => ({ arquivo: f.arquivo, usa: usos(f.codigo) }))
      .filter((f) => f.usa.length);
    expect(fora).toEqual([]);
  });

  test("a lista provisória só encolhe: quem não desenha mais o bebê sai dela", () => {
    const sobrando = AINDA_DESENHAM_O_BEBE.filter((arquivo) => {
      const f = FONTES.find((x) => x.arquivo === arquivo);
      return !f || !usos(f.codigo).length;
    });
    expect(sobrando).toEqual([]);
  });

  test("artes.ts não exporta mais as artes do bebê", () => {
    const artes = FONTES.find((f) => f.arquivo === join("componentes", "artes.ts"))!.codigo;
    expect(artes).not.toMatch(/export const BEBE\b/);
    expect(artes).toMatch(/export const BOLHA\b/);
  });

  test("as telas do bebê, a festa e o cartão dos Stories mostram a Bolha e o número", () => {
    const de = (arquivo: string) => FONTES.find((f) => f.arquivo === arquivo)!.codigo;
    /* A festa: a Bolha viva na frente do número, sem o brilho atrás dela. */
    const festa = de(join("componentes", "jornada", "marco.tsx"));
    expect(festa).toMatch(/<BolhaViva humor=\{v\.pose\}/);
    expect(festa).toMatch(/\{v\.numero\}/);
    expect(festa).not.toMatch(/<Brilho\b/);
    /* O cartão dos Stories: a Bolha, o número da semana e a assinatura do app. */
    const cartao = de(join("componentes", "jornada", "cartao-da-semana.tsx"));
    expect(cartao).toMatch(/source=\{BOLHA\.\w+\}/);
    expect(cartao).toMatch(/\{d\.semana\}/);
    expect(cartao).toMatch(/Mãe Esperta/);
    expect(cartao).toMatch(/@maeesperta\.app/);
    expect(cartao).not.toMatch(/<Brilho\b/);
    /* O céu do cartão é o da hora (23/11/2026), e não o pôr do sol fixo. */
    expect(cartao).toMatch(/useCeuDasAbas\(\)/);
    expect(cartao).not.toMatch(/CEUS\.tarde/);
    /* O semana a semana é o céu da aba (a Bolha na frente do número). */
    expect(de(join("app", "bebe.tsx"))).toMatch(/<CeuDoBebe[\s\S]*modo="semanas"/);
  });
});
