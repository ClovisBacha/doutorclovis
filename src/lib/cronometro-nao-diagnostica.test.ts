/**
 * O CRONÔMETRO MANDA LIGAR — ELE NÃO DIAGNOSTICA, E NÃO MANDA CORRER.
 *
 * ⚠️ A versão que estava no ar escrevia, com todas as letras, as duas frases
 * que o material do setor nomeia como as erradas: **"Trabalho de parto ativo"**
 * e **"⚠️ Vá para a maternidade agora"**. A recomendação de redação é literal —
 * "alerts should say call your provider, not go now or you are in active
 * labor"; "treat 5-1-1 alerts as a prompt to call, not a diagnosis" — e ela tem
 * uma razão clínica, não estética: **fase ativa não se afirma sem exame do
 * colo.** A ACOG, no mesmo lugar em que ensina os sinais, manda LIGAR em caso
 * de dúvida e combinar antes com a equipe "whether to call first or go directly
 * to the hospital" — ou seja, quem decide entre ligar e ir é o serviço dela, e
 * não um cronômetro.
 *
 * E há um segundo dano, do outro lado: "vá agora" numa cidade grande, de
 * madrugada, com trânsito, é o app tomando por ela uma decisão de deslocamento
 * que ele não tem como avaliar.
 *
 * ─── E A OUTRA METADE: ANTES DO TERMO, NENHUMA PALAVRA DE SOSSEGO ───────────
 *
 * "Padrão normal" era o texto que uma gestante de 28 semanas com contrações a
 * cada 12 minutos lia. A ACOG diz o oposto para essa faixa ("do not wait; call
 * right away"), e contar contração em casa NÃO prediz parto prematuro — a
 * monitorização domiciliar foi abandonada justamente por isso. Numa gestante de
 * alto risco, o custo de uma frase de sossego é um corticoide que não foi dado.
 *
 * ⚠️ Esta catraca RODA a régua em dezenas de cenários e lê o que ela DEVOLVE —
 * não procura palavra no fonte. Foi uma catraca de texto que deixou passar os
 * dois defeitos que este arquivo existe para impedir.
 */
import { describe, expect, test } from "bun:test";
import { analyzeContractions, type ContracaoParaAnalise } from "@/lib/analise-de-contracoes";

const BASE = new Date("2026-09-05T02:00:00-03:00").getTime();

function comIntervalos(minutos: number[], duracaoSeg: number): ContracaoParaAnalise[] {
  const inicios = [0];
  for (const m of minutos) inicios.push(inicios[inicios.length - 1] + m * 60000);
  return inicios.map((off) => ({
    started_at: new Date(BASE + off).toISOString(),
    ended_at: new Date(BASE + off + duracaoSeg * 1000).toISOString(),
  }));
}

/** Todo cenário plausível: espaçado, próximo, grudado, longo, curto, aberto. */
const PADROES: ContracaoParaAnalise[][] = [
  [],
  comIntervalos([], 30),
  comIntervalos([2, 2, 2], 70),
  comIntervalos([3, 3, 3, 3], 60),
  comIntervalos([5, 5, 5], 50),
  comIntervalos(Array(13).fill(5), 50),
  comIntervalos([7, 8, 7], 45),
  comIntervalos([9, 9], 35),
  comIntervalos([11, 11, 11, 11, 11], 40),
  comIntervalos([20, 22], 20),
  comIntervalos([30, 5, 5, 5], 40),
  comIntervalos([45, 50], 25),
  comIntervalos([1, 12, 12], 55),
];

const SEMANAS: (number | null)[] = [
  null,
  8,
  16,
  19,
  20,
  24,
  28,
  31,
  34,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
];

function todas() {
  const fora: { semanas: number | null; texto: string; status: string }[] = [];
  for (const semanas of SEMANAS) {
    for (const lista of PADROES) {
      const ultimo = lista.reduce((m, c) => Math.max(m, new Date(c.started_at).getTime()), BASE);
      const r = analyzeContractions(lista, semanas, ultimo + 60000);
      fora.push({ semanas, texto: `${r.label} ${r.detail}`, status: r.status });
    }
  }
  return fora;
}

describe("⚠️ o alerta encaminha, e nunca diagnostica", () => {
  /* As famílias de frase proibidas, e a razão de cada uma:
     - afirmar a fase do parto (não se sabe sem exame do colo);
     - mandar ir agora (a decisão entre ligar e ir é do serviço dela);
     - NEGAR o trabalho de parto (o outro lado da mesma afirmação);
     - nomear Braxton Hicks (é diagnóstico diferencial, não leitura de app). */
  const PROIBIDAS = [
    /trabalho de parto ativo/i,
    /voc[êe] est[áa] em trabalho de parto/i,
    /v[áa] (para )?(a )?maternidade agora/i,
    /v[áa] agora/i,
    /corra/i,
    /(ainda )?n[ãa]o (é|e) trabalho de parto/i,
    /braxton/i,
    /parece treinamento/i,
    /falso trabalho/i,
  ];

  test("nenhum dos cenários devolve uma frase de diagnóstico ou de corrida", () => {
    const culpados: string[] = [];
    for (const { semanas, texto } of todas()) {
      for (const p of PROIBIDAS) if (p.test(texto)) culpados.push(`${semanas}s → ${texto}`);
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e a varredura MORDE — as duas frases que estavam no ar reprovam", () => {
    /* Contraprova: catraca que passa em vazio é catraca que mente. */
    const eram = ["Trabalho de parto ativo", "⚠️ Vá para a maternidade agora"];
    for (const frase of eram) {
      expect(PROIBIDAS.some((p) => p.test(frase))).toBe(true);
    }
  });

  test("o verbo do caso urgente é LIGAR, em todas as semanas", () => {
    for (const { texto, status } of todas()) {
      if (status === "urgente") expect(texto.toLowerCase()).toContain("ligue");
    }
  });
});

describe("⚠️ antes do termo, nenhuma palavra de sossego", () => {
  const SOSSEGO = [
    /padr[ãa]o normal/i,
    /est[áa] tudo (bem|certo)/i,
    /tranquil/i,
    /sem motivo para preocupa/i,
    /nada com que se preocupar/i,
    /pode ficar em casa/i,
    /n[ãa]o precisa ligar/i,
  ];

  test("de 4 a 36 semanas, e sem semana conhecida, o texto nunca sossega", () => {
    const culpados: string[] = [];
    for (const { semanas, texto, status } of todas()) {
      if (semanas != null && semanas >= 37) continue;
      for (const p of SOSSEGO) if (p.test(texto)) culpados.push(`${semanas}s → ${texto}`);
      /* E o status verde é ele mesmo uma frase de sossego. */
      if (status === "normal") culpados.push(`${semanas}s → status normal`);
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e ela MORDE o texto que estava no ar", () => {
    expect(SOSSEGO.some((p) => p.test("Padrão normal"))).toBe(true);
  });
});

describe("o 5-1-1 é apresentado como COMBINADO, e não como regra médica", () => {
  test("quando ele aparece, aparece com a palavra 'combinado'", () => {
    /* Ele não está na ACOG, nem no NICE NG235, nem na Diretriz Nacional (que
       usa DILATAÇÃO, nunca frequência). É convenção de maternidade — o app
       pode acompanhá-la, não pode chancelá-la. */
    for (const { texto } of todas()) {
      if (/5-1-1/.test(texto)) expect(texto.toLowerCase()).toContain("combinado");
    }
  });

  test("e ele nunca aparece antes das 37 semanas", () => {
    for (const { semanas, texto } of todas()) {
      if (semanas != null && semanas >= 37) continue;
      expect(texto).not.toContain("5-1-1");
    }
  });
});
