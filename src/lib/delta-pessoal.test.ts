/**
 * A PACIENTE COMPARADA COM ELA MESMA — sem rebaixar a régua absoluta.
 *
 * O risco deste arquivo tem nome: um delta "normal" apagando um 165/105. Um
 * alerta que falha justamente no caso grave é pior que nenhum alerta, porque
 * ensina a confiar nele.
 */

import { describe, expect, test } from "bun:test";
import {
  DELTA_PRESSAO,
  MINIMO_PARA_BASE,
  baseDePressao,
  sinalPressao,
  sinalPressaoComBase,
} from "./sinais-clinicos";

const par = (s: number, d: number) => ({ sistolica: s, diastolica: d });

describe("1. a linha de base", () => {
  test("é a média das PRIMEIRAS medidas", () => {
    /**
     * As primeiras, e não as últimas. Com média móvel, uma subida lenta
     * arrastaria a própria referência junto e o delta nunca dispararia — o
     * alarme de tendência falhando exatamente na tendência lenta.
     */
    /* SETE medidas, e não quatro: com quatro, `slice(0, 6)` e `slice(-6)`
       devolvem a mesma coisa e o teste não distingue média fixa de média
       móvel — foi assim que um mutante de média móvel sobreviveu à primeira
       versão deste arquivo. */
    const b = baseDePressao([
      par(100, 60),
      par(100, 60),
      par(100, 60),
      par(140, 90),
      par(142, 92),
      par(144, 94),
      par(146, 96),
    ])!;
    /* As SEIS primeiras: (100+100+100+140+142+144)/6 = 121.
       Com média móvel (as seis ÚLTIMAS) sairia 129 — e é essa diferença que o
       teste existe para enxergar. */
    expect(b.sistolica).toBe(121);
    expect(b.sistolica).not.toBe(129);
  });

  test("menos de três medidas não é base", () => {
    /* Duas medidas fariam o alerta disparar pela variação normal do dia. */
    expect(baseDePressao([par(100, 60), par(102, 62)])).toBeNull();
    expect(MINIMO_PARA_BASE).toBe(3);
  });

  test("valor implausível não entra na média", () => {
    /**
     * Um 0/0 — que chega ao banco porque o formulário testa `if (form.systolic)`
     * e a string "0" é truthy — puxaria a média para baixo e faria TUDO parecer
     * subida. A régua que o descarta é a mesma de `sinalPressao`, não uma cópia.
     */
    const b = baseDePressao([par(0, 0), par(110, 70), par(112, 72), par(114, 74)])!;
    expect(b.sistolica).toBe(112);
    expect(b.medidas).toBe(3);
  });

  test("usa no máximo seis medidas", () => {
    /* A base é o começo do acompanhamento, não a gestação inteira. */
    const b = baseDePressao(Array.from({ length: 20 }, () => par(110, 70)))!;
    expect(b.medidas).toBe(6);
  });
});

describe("2. o delta acende dentro da faixa normal", () => {
  const base = baseDePressao([par(100, 60), par(100, 60), par(100, 60)])!;

  test("quem sempre teve 100/60 e chega a 132/86 vira ATENÇÃO", () => {
    /* Está dentro de toda faixa de referência absoluta — e subiu 32. É o caso
       que motivou este código inteiro. */
    expect(sinalPressao(132, 86)!.gravidade).toBe("normal");
    const s = sinalPressaoComBase(132, 86, base)!;
    expect(s.gravidade).toBe("atencao");
    expect(s.nota).toContain("+32");
    expect(s.nota).toContain("100/60");
  });

  test("a diastólica sozinha também acende", () => {
    /* O `ou`, e não o `e` — mesmo erro clássico da régua absoluta. */
    const s = sinalPressaoComBase(118, 76, base)!;
    expect(s.gravidade).toBe("atencao");
    expect(s.nota).toContain("diastólica");
  });

  test("subida pequena continua normal", () => {
    expect(sinalPressaoComBase(115, 70, base)!.gravidade).toBe("normal");
  });

  test("os cortes são +30 e +15, e ficam num lugar só", () => {
    expect(DELTA_PRESSAO).toEqual({ sistolica: 30, diastolica: 15 });
    /* Exatamente no corte JÁ acende: um `>` no lugar do `>=` perderia o caso
       de fronteira, que é onde o alerta mais vale. */
    expect(sinalPressaoComBase(130, 60, base)!.gravidade).toBe("atencao");
  });
});

describe("3. o delta NUNCA rebaixa a régua absoluta", () => {
  const baseAlta = baseDePressao([par(150, 95), par(150, 95), par(150, 95)])!;

  test("165/105 continua grave mesmo sendo pouca subida para ELA", () => {
    /* Com a base em 150/95, um 165/105 é +15: o delta nem dispara. */
    const s = sinalPressaoComBase(165, 105, baseAlta)!;
    expect(s.gravidade).toBe("grave");
    expect(s.nota).toContain("grave");
  });

  test("e continua grave TAMBÉM quando o delta dispara junto — o caso que mata", () => {
    /**
     * A primeira versão deste bloco testava só o caso acima, em que o delta não
     * chega a disparar. Um mutante que APAGOU a guarda de "já é grave" passou
     * por ele inteirinho: a guarda nunca era exercida.
     *
     * Aqui as duas coisas são verdade ao mesmo tempo — base 100/60 e pressão
     * 165/105 são +65 e +45 — e sem a guarda o retorno seria "atenção",
     * rebaixando uma pressão em faixa grave para amarelo. Um alerta que falha
     * justamente no caso grave é pior que nenhum.
     */
    const baseBaixa = baseDePressao([par(100, 60), par(100, 60), par(100, 60)])!;
    const s = sinalPressaoComBase(165, 105, baseBaixa)!;
    expect(s.gravidade).toBe("grave");
    expect(s.nota).toContain("grave");
    /* E a nota é a da régua absoluta, não a do delta: é ela que ele precisa
       ler. */
    expect(s.nota).not.toContain("média dela");
  });

  test("145/92 continua atenção pela régua absoluta, sem base nenhuma", () => {
    expect(sinalPressaoComBase(145, 92, null)!.gravidade).toBe("atencao");
  });

  test("sem base, o resultado é exatamente o da régua absoluta", () => {
    /* Paciente nova, sem histórico: nada muda para ela. */
    for (const [s, d] of [
      [118, 76],
      [145, 92],
      [170, 115],
    ] as const) {
      expect(sinalPressaoComBase(s, d, null)).toEqual(sinalPressao(s, d));
    }
  });

  test("o delta não sobe além de atenção", () => {
    /* Uma subida de 60 sobre a base é assustadora e ainda assim não é
       diagnóstico: quem decide "grave" é a faixa absoluta. */
    const base = baseDePressao([par(90, 55), par(90, 55), par(90, 55)])!;
    expect(sinalPressaoComBase(152, 88, base)!.gravidade).toBe("atencao");
  });
});

describe("4. o que a nota diz", () => {
  const base = baseDePressao([par(100, 60), par(100, 60), par(100, 60)])!;

  test("descreve a subida, e não nomeia doença", () => {
    /* "Pré-eclâmpsia" escrito por um `if` é diagnóstico automático. A tela
       descreve; quem conclui é o médico. */
    const nota = sinalPressaoComBase(135, 80, base)!.nota.toLowerCase();
    expect(nota).toContain("sobre a média dela");
    for (const palavra of ["pré-eclâmpsia", "eclampsia", "hipertens", "diagnóst"]) {
      expect(nota).not.toContain(palavra);
    }
  });

  test("valor nulo não vira sinal", () => {
    expect(sinalPressaoComBase(null, 80, base)).toBeNull();
    expect(sinalPressaoComBase(120, null, base)).toBeNull();
  });
});
