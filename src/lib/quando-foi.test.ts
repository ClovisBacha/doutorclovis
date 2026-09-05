/**
 * O "HOJE" DOS CONTADORES DA GRADE DA SAÚDE.
 *
 * ⚠️ Medido antes do conserto, em São Paulo (UTC−3): uma sessão de chutes às
 * 21h30 do dia 5 é gravada como `2026-09-06T00:30:00+00:00`. O código cortava
 * os dez primeiros caracteres — `2026-09-06` — e comparava com o dia local
 * (`2026-09-05`): não era "hoje", não era "ontem", e o contador SUMIA do
 * bloco. Quem conta movimentos no horário que a própria tela recomenda (à
 * noite, deitada) era exatamente quem nunca via o número.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { inicioDeHojeISO, quandoFoi } from "./quando-foi";

/** Sem os comentários: eles CITAM os padrões proibidos para explicá-los. */
const semProsa = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

/* ⚠️ Datas CRAVADAS: um teste que lê o relógio falha às terças. */
const AGORA = new Date("2026-09-05T22:00:00-03:00");

describe("quandoFoi", () => {
  test("⚠️ o caso que sumia: 21h30 dela, gravado como o dia seguinte em UTC", () => {
    expect(quandoFoi("2026-09-06T00:30:00+00:00", AGORA)).toBe("hoje");
  });

  test("de manhã, no mesmo dia", () => {
    expect(quandoFoi("2026-09-05T12:00:00-03:00", AGORA)).toBe("hoje");
  });

  test("ontem à noite continua sendo ontem", () => {
    expect(quandoFoi("2026-09-05T00:30:00+00:00", AGORA)).toBe("ontem");
  });

  test("anteontem não é nem um nem outro", () => {
    expect(quandoFoi("2026-09-03T15:00:00-03:00", AGORA)).toBeNull();
  });

  test("⚠️ instante ilegível vira null, nunca um rótulo chutado", () => {
    expect(quandoFoi("manhã", AGORA)).toBeNull();
    expect(quandoFoi(null, AGORA)).toBeNull();
    expect(quandoFoi(undefined, AGORA)).toBeNull();
  });
});

describe("inicioDeHojeISO", () => {
  test("⚠️ é a meia-noite DELA, e viaja com fuso", () => {
    /* Mandar `"2026-09-05T00:00:00"` solto faz o Postgres ler em UTC, e em São
       Paulo isso arrasta as contrações das 21h de ONTEM para dentro do hoje. */
    const iso = inicioDeHojeISO(AGORA);
    expect(iso).toMatch(/Z$|[+-]\d{2}:\d{2}$/);
    const meiaNoite = new Date(iso);
    expect(meiaNoite.getHours()).toBe(0);
    expect(meiaNoite.getMinutes()).toBe(0);
    expect(meiaNoite.getDate()).toBe(AGORA.getDate());
  });

  test("uma contração das 23h de ontem fica DE FORA do hoje", () => {
    const ontemTarde = new Date("2026-09-04T23:00:00-03:00");
    expect(ontemTarde.getTime()).toBeLessThan(new Date(inicioDeHojeISO(AGORA)).getTime());
  });
});

describe("a grade da Saúde usa a régua", () => {
  const CONTA = semProsa(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
  /* Só o bloco dos contadores da grade — o arquivo tem quinze mil linhas, e
     medir sobre ele inteiro é como uma asserção passa em vazio. */
  const BLOCO = (() => {
    const i = CONTA.indexOf("const [dados, setDados] = useState<Record<string, Dado | null>>");
    expect(i).toBeGreaterThan(-1);
    const j = CONTA.indexOf("setDados(d);", i);
    expect(j).toBeGreaterThan(i);
    return CONTA.slice(i, j);
  })();

  test("⚠️ o dia do registro sai do INSTANTE, nunca de um corte de string", () => {
    expect(BLOCO).toContain("quandoFoi(chutes.started_at");
    /* A forma exata do defeito. */
    expect(BLOCO).not.toContain("slice(0, 10)");
  });

  test("⚠️ o filtro do dia manda um instante com fuso", () => {
    expect(BLOCO).toContain("inicioDeHojeISO(");
    expect(BLOCO).toMatch(/\.gte\("started_at", desdeMeiaNoite\)/);
    /* Uma data solta seria lida pelo banco em UTC. */
    expect(BLOCO).not.toMatch(/gte\("started_at", `\$\{[a-z]+\}T00:00:00`\)/);
  });
});

describe("o bloco da Saúde não afirma atualidade sobre dado velho — sem escrever quando", () => {
  const CONTA = semProsa(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
  const BLOCO = (() => {
    const i = CONTA.indexOf("const [dados, setDados] = useState<Record<string, Dado | null>>");
    const j = CONTA.indexOf("setDados(d);", i);
    return CONTA.slice(i, j);
  })();

  test("⚠️ passado o prazo, o número SOME — nunca vira 'há N meses' na legenda", () => {
    /* Decisão do dono: nada de "quando" escrito no bloco. O que sobrou para o
       dado velho não se passar por atual é a régua dos vizinhos: some. */
    expect(BLOCO).toMatch(/velho = saude\.log_date \? diasEntre\(saude\.log_date, agora\) > \d+/);
    expect(BLOCO).toMatch(/d\["Saúde"\] = velho\s*\? null/);
    expect(BLOCO).not.toContain("haQuantoTempo(");
  });

  test("⚠️ nenhuma legenda do bloco carrega tempo", () => {
    expect(BLOCO).not.toMatch(/hoje|ontem|última às|há\s/);
    expect(BLOCO).toContain('legenda: "chutes"');
    expect(BLOCO).toContain('legenda: "contrações"');
  });

  test("e o filtro de recência dos chutes continua sendo `quandoFoi`", () => {
    expect(BLOCO).toMatch(
      /const quando = quandoFoi\(chutes\.started_at, agora\);\s*d\["chutes"\] = quando \?/,
    );
  });
});
