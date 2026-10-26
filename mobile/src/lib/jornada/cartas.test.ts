import { describe, expect, test } from "bun:test";
import { CARTAS, cartaDoDia } from "@/lib/cartas-do-bebe";
import {
  CARTAS_INTEIRAS_NO_APP,
  cartaDoDiaNoApp,
  cartaNoApp,
  falaDaBolhaNaCartaNoApp,
  LINHAS_DAS_CARTAS_NO_APP,
  poolDeHojeNoApp,
  TITULOS_DAS_CARTAS_NO_APP,
} from "~/lib/jornada/cartas";
import { D_MAXIMO, D_MINIMO, semanaDoDia } from "~/lib/jornada/dia";

const naGestacao = (dia: number) => cartaDoDiaNoApp({ dia, semanas: semanaDoDia(dia) });
const noPosParto = (dia: number) => cartaDoDiaNoApp({ dia, semanas: null, posParto: true });

describe("a carta do bebê nunca se repete de um dia para o outro", () => {
  test("em nenhum dia da gestação (D 7–300)", () => {
    const repetidas: number[] = [];
    for (let D = D_MINIMO + 1; D <= D_MAXIMO; D++)
      if (naGestacao(D).id === naGestacao(D - 1).id) repetidas.push(D);
    expect(repetidas).toEqual([]);
  });

  test("em nenhum dia do pós-parto (bebê com até 120 dias)", () => {
    const repetidas: number[] = [];
    for (let D = 8; D <= 127; D++) if (noPosParto(D).id === noPosParto(D - 1).id) repetidas.push(D);
    expect(repetidas).toEqual([]);
  });

  test("o caso medido — dias 195 e 196, na troca das semanas 27→28", () => {
    expect(naGestacao(196).id).not.toBe(naGestacao(195).id);
  });

  test("fora do dia da colisão, a carta é a mesma da régua do site", () => {
    const diferentes: number[] = [];
    for (let D = D_MINIMO; D <= D_MAXIMO; D++)
      if (naGestacao(D).id !== cartaDoDia({ dia: D, semanas: semanaDoDia(D) }).id)
        diferentes.push(D);
    // só os dias de troca de fase podem mudar, e são poucos
    expect(diferentes.length).toBeLessThanOrEqual(3);
    expect(diferentes).toContain(196);
  });
});

describe("as cartas como o app as lê", () => {
  const todas = [
    ...CARTAS.map((c) => cartaNoApp(c)),
    ...[null, 6, 20, 30].flatMap((semanas) =>
      [false, true].flatMap((posParto) => poolDeHojeNoApp({ semanas, posParto })),
    ),
  ];
  const linhas = todas.flatMap((c) => [c.title, ...c.lines]);

  test("cada linha, título e carta trocada ainda é, no site, o texto que foi trocado", () => {
    const doSite = CARTAS.flatMap((c) => [c.title, ...c.lines]);
    for (const l of Object.keys(LINHAS_DAS_CARTAS_NO_APP)) expect(doSite).toContain(l);
    for (const t of Object.keys(TITULOS_DAS_CARTAS_NO_APP)) expect(doSite).toContain(t);
    for (const [id, c] of Object.entries(CARTAS_INTEIRAS_NO_APP))
      expect(CARTAS.find((x) => x.id === id)?.title).toBe(c.siteTitulo);
  });

  test("nenhuma carta que ela lê fala das mexidinhas, de exame ou sintoma, ou põe o bebê no masculino", () => {
    const fora = linhas.filter((l) =>
      /dança aí dentro|chutinho|quietinho|\bmexe\b|te senti|exame|enjoo|gases|o sono é curto|encantado|tranquilo\b|pequenininho|quando estiver pronto|calminho|encostado|você é feito|colados|juntos\b|já está pronta/i.test(
        l,
      ),
    );
    expect(fora).toEqual([]);
  });

  test("a carta do dia e o álbum passam pela troca; o id segue o do site", () => {
    const enjoo = cartaNoApp(CARTAS.find((c) => c.id === "t1-enjoo")!);
    expect(enjoo.id).toBe("t1-enjoo");
    expect(enjoo.title).toBe("Os nossos primeiros dias");
    for (let dia = 7; dia < 300; dia++) {
      const c = cartaDoDiaNoApp({ dia });
      expect(c.lines.some((l) => /enjoo|te senti|chutinho/i.test(l))).toBe(false);
    }
  });

  test("a bolha da carta não diz 'ele' nem afirma o que o bebê sente", () => {
    for (const periodo of ["madrugada", "manha", "tarde", "noite"] as const)
      for (const lendoAsDelas of [false, true]) {
        const f = falaDaBolhaNaCartaNoApp({ tela: "abertura", periodo, lendoAsDelas });
        expect(f).not.toMatch(/\b(ele|dele)\b|reconhece/i);
      }
  });
});
