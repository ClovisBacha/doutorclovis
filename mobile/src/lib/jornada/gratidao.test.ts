import { describe, expect, test } from "bun:test";
import { PERGUNTAS, PERGUNTAS_DIA_DIFICIL } from "@/lib/gratidao";
import { PERGUNTAS_NO_APP, perguntaDoDiaNoApp } from "~/lib/jornada/gratidao";

/** Tudo o que a roda pode mostrar: dias, semanas, pós-parto, luto e dia difícil. */
function* perguntas() {
  for (const posParto of [false, true])
    for (const semanas of [null, 6, 12, 20, 30, 39])
      for (const careMode of [false, true])
        for (const diaDificil of [false, true])
          for (let dia = 0; dia < 50; dia++)
            yield {
              o: { dia, semanas, posParto, careMode, diaDificil },
              p: perguntaDoDiaNoApp({ dia, semanas, posParto, careMode, diaDificil }),
            };
}

const texto = (p: { texto: string; fichas: string[] }) => [p.texto, ...p.fichas].join(" · ");

describe("a pergunta da gratidão no app", () => {
  test("as trocadas ainda são, no site, o texto que foi trocado", () => {
    for (const [id, t] of Object.entries(PERGUNTAS_NO_APP)) {
      const site = PERGUNTAS.find((p) => p.id === id);
      expect(site).toBeDefined();
      expect({ texto: site!.texto, fichas: site!.fichas }).toEqual(t.site);
      expect(t.app.fichas).toHaveLength(site!.fichas.length);
    }
  });

  test("no Modo Cuidado, só a roda de qualquer dia: nada da gestação, do bebê ou do colo", () => {
    /* O site cortava do luto só as perguntas marcadas `bebe`, e as semanas
       seguiam correndo: "Contar pra alguém", "no começo da gestação", "com as
       duas mãos livres" chegavam a quem perdeu o bebê. */
    const fora = new Set<string>();
    for (const { o, p } of perguntas()) {
      if (!o.careMode) continue;
      const doLuto = !p.fases && !p.bebe;
      if (!doLuto || /gesta|grávida|barriga|bebê|parto|colo|mãos livres|contar pra/i.test(texto(p)))
        fora.add(`${p.id}: ${texto(p)}`);
    }
    expect([...fora]).toEqual([]);
  });

  test("nenhuma pergunta que ela vê fala de médico, consulta, sintoma, sono contado, régua, mexidinha ou dá gênero ao bebê", () => {
    const fora = new Set<string>();
    for (const { p } of perguntas())
      if (
        /m[eé]dic|consulta|enjoo|normal|recupera|sentiu ele|barriga mexer|quanto tempo seguido|\b(ele|dele|ela|dela)\b/i.test(
          texto(p),
        )
      )
        fora.add(`${p.id}: ${texto(p)}`);
    expect([...fora]).toEqual([]);
  });

  test("fora do luto, a rotação é a do site (a troca ocupa o lugar da pergunta trocada)", () => {
    for (let dia = 0; dia < 40; dia++) {
      const p = perguntaDoDiaNoApp({ dia, semanas: 20 });
      expect(PERGUNTAS.some((s) => s.id === p.id)).toBe(true);
    }
    expect(perguntaDoDiaNoApp({ dia: 1, semanas: 20, diaDificil: true }).id).toBe(
      PERGUNTAS_DIA_DIFICIL[1]!.id,
    );
  });
});
