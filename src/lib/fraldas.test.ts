import { describe, expect, test } from "bun:test";
import {
  duracaoEmTexto,
  FAIXAS,
  faixaDe,
  legendaDoTamanho,
  metaDeFraldas,
  ordemDeUrgencia,
  podeReservarFralda,
  saldoDeFraldas,
  TAMANHOS,
  TOTAL_MAXIMO_DE_FRALDAS,
  TOTAL_MINIMO_DE_FRALDAS,
  UNIDADES_POR_PACOTE,
} from "./fraldas";

describe("a tabela", () => {
  test("⚠️ a soma das metas fica na faixa combinada", () => {
    // Trava contra alguém dobrar uma meta sem perceber que a lista virou um
    // pedido de 90 pacotes para uma rede de 30 pessoas. O chá cobre ~8 meses,
    // não o ano — e a tela diz isso.
    const total = FAIXAS.reduce((s, f) => s + f.metaPacotes, 0) * UNIDADES_POR_PACOTE;
    expect(total).toBeGreaterThanOrEqual(TOTAL_MINIMO_DE_FRALDAS);
    expect(total).toBeLessThanOrEqual(TOTAL_MAXIMO_DE_FRALDAS);
  });

  test("⚠️ RN tem teto, e M e G não têm", () => {
    // RN é o único tamanho que pode durar ZERO dias, e o excedente dele é o
    // único presente do chá que literalmente não tem uso. M e G são dois
    // terços do volume do ano — recusar é que seria o defeito.
    expect(faixaDe("RN").tetoPacotes).toBe(6);
    expect(faixaDe("M").tetoPacotes).toBeNull();
    expect(faixaDe("G").tetoPacotes).toBeNull();
  });

  test("⚠️ a meta de M é a MAIOR — é onde o volume está", () => {
    const maior = [...FAIXAS].sort((a, b) => b.metaPacotes - a.metaPacotes)[0];
    expect(maior.tamanho).toBe("M");
    expect(faixaDe("M").metaPacotes).toBeGreaterThan(faixaDe("RN").metaPacotes);
    expect(faixaDe("G").metaPacotes).toBeGreaterThan(faixaDe("RN").metaPacotes);
  });

  test("as faixas de dias não têm buraco", () => {
    for (let i = 0; i < FAIXAS.length - 1; i++) {
      expect(FAIXAS[i].diaFim).toBeGreaterThanOrEqual(FAIXAS[i + 1].diaInicio);
    }
  });

  test("todo tamanho aparece uma vez só", () => {
    expect(new Set(TAMANHOS).size).toBe(TAMANHOS.length);
  });
});

describe("metaDeFraldas", () => {
  test("⚠️ sem peso estimado devolve a tabela PADRÃO, não o mínimo", () => {
    // Mesma lição de `escalaDaArvore` devolver 1 sem semana conhecida: um
    // mínimo inesperado lê como recurso quebrado.
    expect(metaDeFraldas().RN).toBe(faixaDe("RN").metaPacotes);
    expect(metaDeFraldas({ pesoEstimadoGramas: null }).RN).toBe(faixaDe("RN").metaPacotes);
    expect(metaDeFraldas({}).M).toBe(faixaDe("M").metaPacotes);
  });

  test("bebê grande derruba RN, e só RN", () => {
    const m = metaDeFraldas({ pesoEstimadoGramas: 3900 });
    expect(m.RN).toBeLessThanOrEqual(2);
    expect(m.M).toBe(faixaDe("M").metaPacotes);
    expect(m.G).toBe(faixaDe("G").metaPacotes);
  });

  test("peso inválido não muda nada", () => {
    expect(metaDeFraldas({ pesoEstimadoGramas: NaN }).RN).toBe(faixaDe("RN").metaPacotes);
  });
});

describe("saldoDeFraldas", () => {
  const meta = metaDeFraldas();

  test("falta nunca é negativo", () => {
    const s = saldoDeFraldas(meta, { RN: 99 });
    const rn = s.find((x) => x.tamanho === "RN")!;
    expect(rn.falta).toBe(0);
    expect(rn.cheio).toBe(true);
  });

  test("passar da meta não quebra a legenda", () => {
    const s = saldoDeFraldas(meta, { M: 20 });
    const m = s.find((x) => x.tamanho === "M")!;
    expect(m.fracao).toBeGreaterThan(1);
    expect(legendaDoTamanho(m)).toBe("20 de 18 pacotes · completo");
  });

  test("tamanho sem reserva vem zerado", () => {
    const s = saldoDeFraldas(meta, {});
    expect(s.every((x) => x.reservado === 0)).toBe(true);
    expect(s.every((x) => x.falta === x.meta)).toBe(true);
  });
});

describe("ordemDeUrgencia", () => {
  test("⚠️ NÃO é a ordem de tamanho — com RN cheio, M vem antes", () => {
    // Se a página listar RN · P · M · G · XG, a amiga toca no primeiro e o
    // erro universal se reproduz com um contador bonito por cima.
    const s = saldoDeFraldas(metaDeFraldas(), { RN: 6 });
    const ordem = ordemDeUrgencia(s);
    expect(ordem.indexOf("M")).toBeLessThan(ordem.indexOf("RN"));
    expect(ordem[ordem.length - 1]).toBe("RN");
  });

  test("⚠️ com tudo zerado, o primeiro é M — onde está o volume", () => {
    // O desempate é pela MAIOR META, não pelo maior tamanho.
    //
    // A primeira versão desempatava por tamanho e a bancada mostrou o
    // resultado: com a lista zerada, o primeiro cartão era XG — um tamanho que
    // o bebê só usa depois de um ano, num chá que acontece na 32ª semana.
    // Certo na letra, errado no espírito. A meta já É a régua de volume.
    const ordem = ordemDeUrgencia(saldoDeFraldas(metaDeFraldas(), {}));
    expect(ordem[0]).toBe("M");
    expect(ordem[1]).toBe("G");
    expect(ordem).not.toContain(undefined);
  });

  test("⚠️ e RN nunca abre a lista", () => {
    // É o erro universal do chá: a amiga toca no primeiro cartão e pronto.
    for (const reservado of [{}, { M: 4 }, { M: 18, G: 12 }]) {
      expect(ordemDeUrgencia(saldoDeFraldas(metaDeFraldas(), reservado))[0]).not.toBe("RN");
    }
  });

  test("quem está mais longe da meta vem primeiro", () => {
    const s = saldoDeFraldas(metaDeFraldas(), { RN: 4, P: 10, M: 18, G: 12, XG: 0 });
    expect(ordemDeUrgencia(s)[0]).toBe("XG");
  });
});

describe("podeReservarFralda", () => {
  const rn = faixaDe("RN");

  test("⚠️ RN cheio recusa NO SERVIDOR, não só some da tela", () => {
    // Cadeado que só existe na vitrine é decoração — lição que
    // `cantinho.functions.ts` já pagou com o gate de troféus.
    const r = podeReservarFralda(rn, 6, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("acima-do-teto");
      expect(r.maximo).toBe(0);
    }
  });

  test("⚠️ recusa por INTEIRO, nunca trunca", () => {
    // Truncar faria a amiga sair achando que deu quatro pacotes enquanto o app
    // registrou dois — e ela descobriria no chá, na frente de todo mundo.
    const r = podeReservarFralda(rn, 4, 4);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.maximo).toBe(2);
  });

  test("dentro do teto passa", () => {
    expect(podeReservarFralda(rn, 4, 2).ok).toBe(true);
    expect(podeReservarFralda(rn, 0, 6).ok).toBe(true);
  });

  test("tamanho sem teto aceita qualquer quantidade", () => {
    expect(podeReservarFralda(faixaDe("M"), 500, 40).ok).toBe(true);
  });

  test("quantidade inválida é recusada", () => {
    for (const q of [0, -1, 1.5, NaN]) {
      const r = podeReservarFralda(rn, 0, q);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toBe("quantidade-invalida");
    }
  });
});

describe("os textos", () => {
  test("⚠️ nenhuma legenda cobra — estado, nunca dívida", () => {
    // Lista de presentes é a mecânica que mais fácil vira cobrança sobre a rede
    // de uma gestante, e quem paga o constrangimento é ela.
    const proibido = /falta[m]?\s|só\s+\d|corre|últim|urgente|agora!/i;
    for (const s of saldoDeFraldas(metaDeFraldas(), { RN: 2, M: 0 })) {
      expect(legendaDoTamanho(s)).not.toMatch(proibido);
    }
  });

  test("a legenda diz quanto tem e quanto é a meta", () => {
    const s = saldoDeFraldas(metaDeFraldas(), { M: 4 });
    expect(legendaDoTamanho(s.find((x) => x.tamanho === "M")!)).toBe("4 de 18 pacotes");
  });

  test("a duração explica a ordem", () => {
    expect(duracaoEmTexto("RN")).toBe("3 semanas");
    expect(duracaoEmTexto("M")).toMatch(/mes/);
  });
});
