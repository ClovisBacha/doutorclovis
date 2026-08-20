import { describe, expect, test } from "bun:test";
import { ANTECEDENCIA_DIAS, DURACAO_SUPOSTA, liveDoTopo, quandoAcontece } from "./proxima-live";

/* Um instante fixo em São Paulo: 20/08/2026, 14h. O `agora` é sempre
   parâmetro — teste que depende do relógio do contêiner falha às terças. */
const AGORA = Date.parse("2026-08-20T17:00:00.000Z"); // 14h em SP
const emHoras = (h: number) => new Date(AGORA + h * 3600_000).toISOString();

const live = (over: Partial<Parameters<typeof liveDoTopo>[0][number]> = {}) => ({
  id: "l1",
  title: "Parto humanizado",
  scheduled_at: emHoras(3),
  link: "https://exemplo",
  ...over,
});

describe("qual live vai para o topo", () => {
  test("a que acontece daqui a pouco", () => {
    const r = liveDoTopo([live()], AGORA);
    expect(r?.id).toBe("l1");
    expect(r?.aoVivo).toBe(false);
  });

  /**
   * ⚠️ A MAIS PRÓXIMA, e não a primeira da lista.
   *
   * `listLivesPublic` ordena por `scheduled_at` DESCENDENTE — a página de lives
   * mostra a mais recente em cima. Pegar `lives[0]` traria a mais DISTANTE no
   * futuro, e o topo do feed anunciaria a live de daqui a seis dias enquanto a
   * de hoje à noite passava em branco.
   */
  test("⚠️ escolhe a mais próxima, mesmo vindo em ordem decrescente", () => {
    const lista = [
      live({ id: "distante", scheduled_at: emHoras(24 * 6) }),
      live({ id: "perto", scheduled_at: emHoras(2) }),
    ];
    expect(liveDoTopo(lista, AGORA)?.id).toBe("perto");
  });

  /* ⚠️ A que começou há pouco é a que MAIS importa: é a única em que o toque
     leva a alguma coisa agora. */
  test("⚠️ a que começou há dez minutos entra, e vem marcada como ao vivo", () => {
    const r = liveDoTopo([live({ scheduled_at: emHoras(-10 / 60) })], AGORA);
    expect(r?.aoVivo).toBe(true);
  });

  /* ⚠️ Uma live de ontem no topo do feed é a prova mais barata de que o app
     está abandonado — e ela some sozinha, sem ninguém despublicar à mão. */
  test("⚠️ a que já acabou some", () => {
    const passou = emHoras(-(DURACAO_SUPOSTA + 10) / 60);
    expect(liveDoTopo([live({ scheduled_at: passou })], AGORA)).toBeNull();
  });

  /**
   * ⚠️ Um cartão anunciando setembro no topo do feed em agosto ocupa, todo dia,
   * o lugar mais valioso da aba com uma informação que ela não pode usar hoje —
   * e ensina a pular o topo do feed, que é onde o aviso precisa funcionar na
   * semana em que ele importa.
   */
  test("⚠️ a distante demais não entra", () => {
    const longe = emHoras(24 * (ANTECEDENCIA_DIAS + 1));
    expect(liveDoTopo([live({ scheduled_at: longe })], AGORA)).toBeNull();
  });

  /* ⚠️ A tabela aceita live sem horário (o dono cadastra antes de decidir
     quando). Um cartão "acontece em breve" sem data não dá o que fazer. */
  test("⚠️ sem horário não entra", () => {
    expect(liveDoTopo([live({ scheduled_at: null })], AGORA)).toBeNull();
  });

  test("despublicada não entra", () => {
    expect(liveDoTopo([live({ is_published: false })], AGORA)).toBeNull();
  });

  /* ⚠️ Nada de convite para uma aula sobre a gestação em curso — o mesmo
     portão do rodapé de convite e do "Nome do bebê". */
  test("⚠️ nunca em Modo Cuidado", () => {
    expect(liveDoTopo([live()], AGORA, true)).toBeNull();
  });

  /* `null` é o caso NORMAL: na maioria dos dias não há live marcada. */
  test("lista vazia é null, e não erro", () => {
    expect(liveDoTopo([], AGORA)).toBeNull();
  });

  test("horário inválido não derruba nada", () => {
    expect(liveDoTopo([live({ scheduled_at: "amanhã" })], AGORA)).toBeNull();
  });
});

describe("o texto do quando", () => {
  /**
   * ⚠️ Relativo, e nunca uma data por extenso: "20 de agosto às 20h" obriga a
   * paciente a lembrar que dia é hoje para saber se ainda dá tempo — e o cartão
   * existe para responder isso num relance.
   */
  test("⚠️ hoje e amanhã são ditos por nome", () => {
    expect(quandoAcontece(emHoras(4), AGORA).startsWith("hoje às ")).toBe(true);
    expect(quandoAcontece(emHoras(24), AGORA).startsWith("amanhã às ")).toBe(true);
  });

  test("mais longe, o dia da semana", () => {
    const t = quandoAcontece(emHoras(24 * 3), AGORA);
    expect(t).toContain("às ");
    expect(t).not.toContain("hoje");
    expect(t).not.toContain("amanhã");
  });

  /* ⚠️ O fuso é o de SÃO PAULO, e não o do contêiner — o servidor roda em UTC,
     e das 21h à meia-noite ele já está no dia seguinte. */
  test("⚠️ o dia é o de São Paulo", () => {
    /* 23h30 em SP = 02h30 UTC do dia seguinte. Ainda é "hoje" para ela. */
    const agora = Date.parse("2026-08-21T01:00:00.000Z"); // 22h de 20/08 em SP
    expect(quandoAcontece("2026-08-21T02:30:00.000Z", agora).startsWith("hoje às ")).toBe(true);
  });

  test("horário inválido devolve vazio, e não 'Invalid Date'", () => {
    expect(quandoAcontece("qualquer coisa", AGORA)).toBe("");
  });
});
