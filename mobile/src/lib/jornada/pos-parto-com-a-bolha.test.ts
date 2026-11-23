import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * O 4º TRIMESTRE E O NASCIMENTO COM A BOLHA (19/11/2026, decisão do dono).
 *
 * "Nosso principal personagem agora será o bebê bolha. Eu quero tirar as
 * imagens dos bebês [...] o número 24 ali estava muito bacana [...] o bebê
 * bolha será esse guia neste caminho."
 *
 * - Nenhuma ilustração de bebê (o recém-nascido enrolado, `bebe/semana.webp`,
 *   e o feto de `assets/bebes/`) no pós-parto, na festa, no cartão e na porta
 *   do nascimento, nem no álbum. No lugar, a Bolha; o número da semana de vida
 *   fica, atrás dela.
 * - Nada atrás da Bolha: o brilho que ficava atrás do bebê saiu junto.
 * - A Bolha guia é o primeiro painel do pós-parto, e o check-in do humor mora
 *   nela (o cartão "Como você está hoje?" separado saiu). O Modo Cuidado (luto)
 *   não tem Bolha guia.
 */

const RAIZ = join(import.meta.dir, "..", "..");
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

const ARQUIVOS = [
  ["componentes", "jornada", "hoje-pos.tsx"],
  ["componentes", "jornada", "nascimento.tsx"],
  ["app", "jornada", "nascimento.tsx"],
  ["app", "jornada", "album.tsx"],
] as const;

describe("o pós-parto e o nascimento sem bebê ilustrado", () => {
  test("nenhuma arte de bebê: nem o recém-nascido, nem o feto da semana", () => {
    const fora = ARQUIVOS.filter((a) =>
      /bebe\/semana\.webp|RECEM_NASCIDO|arteDoBebe|assets\/bebes\//.test(ler(...a)),
    ).map((a) => a.join("/"));
    expect(fora).toEqual([]);
  });

  test("a Bolha está onde o bebê estava, e nada fica atrás dela", () => {
    const pos = ler("componentes", "jornada", "hoje-pos.tsx");
    expect(pos).toMatch(/<ArteDaBolha humor="apaixonado" tamanho=\{BEBE\} \/>/);
    expect(pos).toContain("source={BOLHA.apaixonado}");
    const nascimento = ler("componentes", "jornada", "nascimento.tsx");
    expect(nascimento).toContain('<BolhaViva humor="comemorando"');
    expect(nascimento).toContain("source={BOLHA.comemorando}");
    expect(nascimento).toContain("source={BOLHA.surpresa}");
    /* O brilho morava atrás do bebê, na festa e no cartão. */
    expect(nascimento).not.toMatch(/<Brilho\b/);
    expect(ler("app", "jornada", "nascimento.tsx")).toMatch(/<ArteDaBolha humor=/);
    expect(ler("app", "jornada", "album.tsx")).toContain("falaDoAlbum(");
    /* No herói do pós, o número continua atrás (e é enfeite). */
    expect(pos).toMatch(/\{semana\}\s*<\/Text>/);
  });

  test("a Bolha guia é o primeiro painel do pós, e o humor é ela quem pergunta", () => {
    const pos = ler("componentes", "jornada", "hoje-pos.tsx");
    const bolha = pos.indexOf("<ConversaComABolha");
    expect(bolha).toBeGreaterThan(-1);
    expect(bolha).toBeLessThan(pos.indexOf("O cuidado de hoje"));
    expect(pos).toContain('modo: "pos"');
    expect(pos).not.toMatch(/function ComoVoceEsta|<ComoVoceEsta/);
    /* O apoio (CVV e 192) aparece junto da Bolha quando ela diz "Triste". */
    expect(pos).toMatch(/humorPedeApoio\(humorDeHoje\) \? <Apoio \/> : null\}\s*<\/PainelDaBolha>/);
    /* A ponte do pós: nenhum destino da Bolha é lido cru. */
    expect(pos).toContain("destinoNoPos(d)");
  });

  test("o Modo Cuidado continua sem Bolha guia", () => {
    expect(ler("componentes", "jornada", "cuidado.tsx")).not.toContain("ConversaComABolha");
    expect(ler("app", "(abas)", "inicio.tsx")).not.toContain("ConversaComABolha");
  });
});
