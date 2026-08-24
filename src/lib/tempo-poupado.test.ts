/**
 * O número que o card de valor afirma ao médico.
 *
 * O risco aqui não é errar por pouco — é **inflar**. "A IA economizou 50 horas
 * suas" é uma afirmação forte; um médico que faz a conta de cabeça, não
 * reconhece o número e o acha exagerado passa a desconfiar do painel inteiro,
 * inclusive das partes certas. Um card que argumenta cobrança precisa errar
 * para baixo, sempre.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MINIMO_DE_AMOSTRAS,
  MINUTOS_PADRAO,
  mediana,
  minutosPorResposta,
  palavras,
  tempoPoupado,
  fechoDoTempo,
} from "./tempo-poupado";

const frase = (n: number) => Array.from({ length: n }, () => "palavra").join(" ");

describe("nunca inflar", () => {
  test("uma resposta gigante não puxa a estimativa — mediana, não média", () => {
    /* Um protocolo colado entre respostas curtas dobraria a média. */
    const curtas = Array.from({ length: 9 }, () => frase(40));
    const comOutlier = [...curtas, frase(4000)];
    expect(minutosPorResposta(comOutlier)).toBe(minutosPorResposta(curtas));
  });

  test("o arredondamento desce", () => {
    /* 59 palavras ÷ 40 × 0,5 = 0,7375 min → 0,7, não 0,8. Como fica abaixo do
       piso, o resultado é o piso — mas a mediana em si não pode subir. */
    expect(mediana([1, 2])).toBe(1);
    expect(mediana([10, 11, 12, 13])).toBe(11);
  });

  test("nunca passa de 10 minutos por resposta", () => {
    /* Acima disso quase certamente é texto colado, não redigido. */
    const enormes = Array.from({ length: 20 }, () => frase(5000));
    expect(minutosPorResposta(enormes)).toBeLessThanOrEqual(10);
  });
});

describe("poucos dados voltam para o padrão conservador", () => {
  test("abaixo do mínimo de amostras, vale o piso", () => {
    const poucas = Array.from({ length: MINIMO_DE_AMOSTRAS - 1 }, () => frase(400));
    expect(minutosPorResposta(poucas)).toBe(MINUTOS_PADRAO);
  });

  test("sem nenhuma resposta, vale o piso", () => {
    expect(minutosPorResposta([])).toBe(MINUTOS_PADRAO);
  });

  test("a estimativa nova nunca fica ABAIXO da conta antiga", () => {
    /* Quem escreve respostas curtíssimas não pode passar a ver um número menor
       do que o painel já mostrava — seria uma regressão visível de valor. */
    const curtinhas = Array.from({ length: 30 }, () => frase(6));
    expect(minutosPorResposta(curtinhas)).toBe(MINUTOS_PADRAO);
  });
});

describe("quem escreve mais vê um número maior — e verdadeiro", () => {
  test("respostas longas elevam a estimativa acima do piso", () => {
    const longas = Array.from({ length: 20 }, () => frase(600));
    expect(minutosPorResposta(longas)).toBeGreaterThan(MINUTOS_PADRAO);
  });

  test("dobrar o tamanho das respostas dobra a estimativa", () => {
    const a = minutosPorResposta(Array.from({ length: 20 }, () => frase(400)));
    const b = minutosPorResposta(Array.from({ length: 20 }, () => frase(800)));
    expect(b).toBeCloseTo(a * 2, 0);
  });

  test('respostas de uma palavra ("ok", "sim") não entram na conta', () => {
    /* Elas não representam o trabalho que a IA substitui e puxariam a mediana
       para baixo sem motivo. */
    const mistura = [...Array.from({ length: 20 }, () => frase(600)), ...Array(50).fill("ok")];
    const soLongas = Array.from({ length: 20 }, () => frase(600));
    expect(minutosPorResposta(mistura)).toBe(minutosPorResposta(soLongas));
  });
});

describe("contar palavras não se engana com pontuação", () => {
  test("quebras de linha, tabs e espaços duplos", () => {
    expect(palavras("uma   duas\ntrês\t\tquatro  ")).toBe(4);
  });

  test("texto vazio é zero, não um", () => {
    expect(palavras("")).toBe(0);
    expect(palavras("   \n ")).toBe(0);
  });
});

describe("o rótulo fala a língua da agenda", () => {
  test("minutos, depois horas", () => {
    expect(tempoPoupado(10, 3)).toBe("30 min");
    expect(tempoPoupado(20, 3)).toBe("1h");
    expect(tempoPoupado(25, 3)).toBe("1h15");
  });

  test("NUNCA fala em dias de consultório — consulta é a renda dele", () => {
    /* Este é o teste que existe por causa de uma correção de negócio, não de
       formatação: "você economizou 6 dias de consultório" diz ao médico que ele
       faturou menos. O tempo que a IA devolve é o NÃO PAGO — mensagem à noite,
       no domingo, no jantar. Isso não se mede em jornadas de trabalho. */
    for (const n of [160, 320, 1000, 5000]) {
      const r = tempoPoupado(n, 3);
      expect(r).not.toMatch(/dia/i);
      expect(r).not.toMatch(/consult/i);
    }
    /* 1000 × 3 min = 3.000 min = 50h. */
    expect(tempoPoupado(1000, 3)).toBe("50 horas");
  });

  test("depois de 10 horas os minutos somem — viram ruído", () => {
    expect(tempoPoupado(200, 3)).toBe("10 horas");
    expect(tempoPoupado(199, 3)).toBe("9h57");
  });

  test("o total também desce, nunca sobe", () => {
    expect(tempoPoupado(1, 3.9)).toBe("3 min");
  });
});

describe("o fecho do card", () => {
  test("é estável dentro do mesmo mês — sorteio leria como defeito", () => {
    /* Frase que muda a cada carregamento parece bug. Pelo mês, ela muda quando
       o número muda. */
    expect(fechoDoTempo(3)).toBe(fechoDoTempo(3));
  });

  test("qualquer mês devolve uma frase — inclusive fora da faixa", () => {
    for (const m of [-13, -1, 0, 5, 11, 99]) {
      expect(fechoDoTempo(m).length).toBeGreaterThan(10);
    }
  });

  test("nenhuma frase fala do consultório ou da agenda de atendimento", () => {
    /* É a mesma regra do rótulo: o tempo devolvido é o de casa. */
    for (const m of [0, 1, 2, 3, 4, 5]) {
      expect(fechoDoTempo(m)).not.toMatch(/consult[óo]rio|agenda|paciente/i);
    }
  });
});

describe("o card nunca fala em tempo de consultório", () => {
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8")
    /* Sem comentários: eles EXPLICAM a correção e citam "consultório". */
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  test('a linha do dinheiro não diz mais "em consultas suas"', () => {
    /* Dizia que a IA poupou CONSULTAS — ou seja, que ele faturou menos.
       Consulta é a renda dele; o que a IA poupa é o tempo não pago. */
    expect(painel).not.toContain("em consultas suas");
  });

  test("a frase direta diz QUAL tempo voltou", () => {
    const semQuebras = painel.replace(/\s+/g, " ");
    expect(semQuebras).toContain("Você ganhou");
    expect(semQuebras).toContain("respondendo mensagem fora do consultório");
  });

  test("a frase só aparece a partir de uma hora", () => {
    /* "Você ganhou 12 minutos de volta" não é uma frase, é uma piada. */
    expect(painel).toContain("assists * minutosPorResposta >= 60");
  });
});
