import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROTULO_DO_FILTRO } from "@/lib/fase-parecida";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * "QUEM ESTÁ NUMA FASE PARECIDA COM A SUA" — o filtro do servidor
 * (`sugestoesDoFeed({ mesmaFase })`) e as três coisas que o próprio
 * `fase-parecida.ts` proíbe: o filtro ligado por PADRÃO, um selo de fase por
 * pessoa e um agrupamento com cabeçalho de fase. Qualquer um dos três
 * transforma uma inferência grosseira e escolhida num dado publicado sobre
 * terceiros.
 */

const RAIZ = join(import.meta.dir, "..", "..");

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
const fonte = (a: string) => FONTES.find((f) => f.arquivo === a)!.codigo;

describe("o filtro de fase parecida", () => {
  test("só a api fala com o servidor sobre a fase, e só quando ela liga", () => {
    const quem = FONTES.filter((f) => /mesmaFase\s*:\s*true/.test(f.codigo)).map((f) => f.arquivo);
    expect(quem).toEqual([join("lib", "comunidade", "api.ts")]);
    expect(fonte(join("lib", "comunidade", "api.ts"))).toContain(
      "rede.sugestoesDoFeed(mesmaFase ? { mesmaFase: true } : {})",
    );
  });

  test("nasce desligado: só liga pelo toque dela (a chave, ou o atalho que diz isso)", () => {
    const busca = fonte(join("app", "comunidade", "busca.tsx"));
    expect(busca).toContain("useState(faseNoInicio)");
    expect(busca).toContain('<Descoberta faseNoInicio={fase === "1"} />');
    /* Nada guarda a escolha para ligar sozinho da próxima vez. */
    expect(busca).not.toMatch(/gravarJson|lerJson|AsyncStorage/);
    const quemLiga = FONTES.filter((f) => /\/comunidade\/busca\?fase=1/.test(f.codigo)).map(
      (f) => f.arquivo,
    );
    expect(quemLiga).toEqual([join("app", "(abas)", "inicio.tsx")]);
    expect(fonte(join("app", "(abas)", "inicio.tsx"))).toContain("texto={`${ROTULO_DO_FILTRO}.`}");
  });

  test("o rótulo fala da fase DELA, nunca das outras (nada de trimestre na tela)", () => {
    expect(ROTULO_DO_FILTRO).toContain("parecida com a sua");
    expect(ROTULO_DO_FILTRO).not.toMatch(/trimestre|semana|reta final|pós/i);
    const busca = fonte(join("app", "comunidade", "busca.tsx"));
    expect(busca).toContain("{ROTULO_DO_FILTRO}");
    expect(busca).toContain("VAZIO_DO_FILTRO");
    expect(busca).not.toMatch(/trimestre|seloSemana/);
  });
});
