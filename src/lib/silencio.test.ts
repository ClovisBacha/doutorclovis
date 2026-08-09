/**
 * O SILÊNCIO NA FILA — sem transformar engajamento em diagnóstico.
 *
 * `sinais-clinicos.ts` declara que silêncio NÃO é sinal clínico: a paciente
 * pode estar ótima e sem paciência para o app. Este arquivo cobra que a decisão
 * continue de pé — o item fala em REGISTRO, e não em acompanhamento nem em
 * saúde. Um item que sugere o contrário faz o médico ligar com a pergunta
 * errada.
 */

import { describe, expect, test } from "bun:test";
import { prazoDeSilencio, quemEstaQuieta, textoDaQuietude, type PacienteQuieta } from "./silencio";

const AGORA = new Date("2026-08-20T12:00:00Z");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86400_000).toISOString();

const pac = (p: Partial<PacienteQuieta> = {}): PacienteQuieta => ({
  id: "p1",
  nome: "Ana Paula",
  semanas: 20,
  ultimoEm: diasAtras(2),
  criadaEm: diasAtras(120),
  ...p,
});

describe("1. o prazo acompanha a fase", () => {
  test("perto do fim, o prazo é curto", () => {
    /* Três semanas de silêncio em 12 semanas é normal; as mesmas três em 38 é
       outra conversa. Um número único seria frouxo no fim e chato no começo. */
    expect(prazoDeSilencio(38)).toBe(7);
    expect(prazoDeSilencio(30)).toBe(12);
    expect(prazoDeSilencio(12)).toBe(21);
  });

  test("as bordas caem na faixa mais apertada", () => {
    /* Exatamente 36 semanas já é o prazo de 7 dias: um `>` no lugar do `>=`
       daria a 36s0d o prazo do trimestre anterior. */
    expect(prazoDeSilencio(36)).toBe(7);
    expect(prazoDeSilencio(28)).toBe(12);
  });

  test("sem idade gestacional, o prazo é o mais frouxo", () => {
    /* Não sabendo em que fase ela está, incomodar menos é o lado certo de
       errar. */
    expect(prazoDeSilencio(null)).toBe(21);
  });
});

describe("2. quem entra na lista", () => {
  test("quieta além do prazo entra", () => {
    const r = quemEstaQuieta([pac({ semanas: 38, ultimoEm: diasAtras(10) })], AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].dias).toBe(10);
    expect(r[0].prazo).toBe(7);
  });

  test("dentro do prazo NÃO entra", () => {
    expect(quemEstaQuieta([pac({ semanas: 38, ultimoEm: diasAtras(5) })], AGORA)).toEqual([]);
  });

  test("exatamente no prazo já entra", () => {
    /* No dia do corte a conversa já vale — e um `>` perderia justamente o
       primeiro dia em que o item seria útil. */
    expect(quemEstaQuieta([pac({ semanas: 38, ultimoEm: diasAtras(7) })], AGORA)).toHaveLength(1);
  });
});

describe("3. quem NÃO entra, e é o ponto", () => {
  test("recém-cadastrada que ainda não registrou nada", () => {
    /**
     * "Nenhum registro na janela" era indistinguível entre a paciente que sumiu
     * e a que criou a conta ontem — defeito que a aba de Engajamento já teve, e
     * que punha a recém-chegada na lista de sumidas no dia seguinte ao cadastro.
     */
    const r = quemEstaQuieta([pac({ ultimoEm: null, criadaEm: diasAtras(3) })], AGORA);
    expect(r).toEqual([]);
  });

  test("mas quem se cadastrou há muito e nunca registrou, entra", () => {
    /* Aí o silêncio é real: ela teve tempo de sobra. O relógio corre do
       cadastro. */
    const r = quemEstaQuieta([pac({ ultimoEm: null, criadaEm: diasAtras(40) })], AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].dias).toBe(40);
  });

  test("sem registro E sem cadastro não vira item", () => {
    /**
     * Não há de onde contar. Assumir "hoje" faria TODA paciente antiga aparecer
     * como quieta no dia em que este código subisse — uma fila de trabalho
     * inteira de itens falsos, que é como se ensina alguém a ignorar a fila.
     */
    expect(quemEstaQuieta([pac({ ultimoEm: null, criadaEm: null })], AGORA)).toEqual([]);
  });

  test("data no futuro não vira silêncio negativo", () => {
    const futuro = new Date(AGORA.getTime() + 5 * 86400_000).toISOString();
    expect(quemEstaQuieta([pac({ ultimoEm: futuro })], AGORA)).toEqual([]);
  });

  test("data podre é ignorada", () => {
    expect(quemEstaQuieta([pac({ ultimoEm: "abacaxi", criadaEm: "abacaxi" })], AGORA)).toEqual([]);
  });
});

describe("4. a ordem", () => {
  test("quem estourou MAIS o próprio prazo vem primeiro", () => {
    /**
     * Por FOLGA, e não por dias absolutos: 30 dias de silêncio em 12 semanas
     * (prazo 21, folga 9) é menos urgente que 20 dias em 38 semanas (prazo 7,
     * folga 13). Ordenar por dias crus inverteria os dois.
     */
    const r = quemEstaQuieta(
      [
        pac({ id: "cedo", semanas: 12, ultimoEm: diasAtras(30) }),
        pac({ id: "fim", semanas: 38, ultimoEm: diasAtras(20) }),
      ],
      AGORA,
    );
    expect(r.map((q) => q.paciente.id)).toEqual(["fim", "cedo"]);
  });

  test("empate na folga desempata pela semana mais avançada", () => {
    const r = quemEstaQuieta(
      [
        pac({ id: "a", semanas: 30, ultimoEm: diasAtras(15) }),
        pac({ id: "b", semanas: 34, ultimoEm: diasAtras(15) }),
      ],
      AGORA,
    );
    expect(r[0].paciente.id).toBe("b");
  });
});

describe("5. o texto não diagnostica", () => {
  const q = quemEstaQuieta([pac({ semanas: 38, ultimoEm: diasAtras(12) })], AGORA)[0];

  test("fala em REGISTRO, e diz que ela pode estar bem", () => {
    /* A decisão de `sinais-clinicos`: "o texto fala em 'sem registro' e não em
       'sem acompanhamento'". */
    const t = textoDaQuietude(q);
    expect(t.titulo).toContain("sem registro");
    expect(t.detalhe).toContain("pode estar bem");
  });

  test("não afirma nada sobre a saúde dela", () => {
    const t = `${textoDaQuietude(q).titulo} ${textoDaQuietude(q).detalhe}`.toLowerCase();
    for (const palavra of ["risco", "abandon", "sem acompanhamento", "grave", "perigo"]) {
      expect(t).not.toContain(palavra);
    }
  });

  test("sem nome, não escreve 'null sem registro'", () => {
    const semNome = quemEstaQuieta([pac({ nome: null, ultimoEm: diasAtras(60) })], AGORA)[0];
    expect(textoDaQuietude(semNome).titulo).toContain("Paciente");
    expect(textoDaQuietude(semNome).titulo).not.toContain("null");
  });
});
