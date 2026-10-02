import { describe, expect, test } from "bun:test";
import type { QuizQuestion } from "@/lib/daily-quizzes";
import {
  comecarPerguntas,
  continuar,
  escolher,
  estadoDaOpcao,
  INICIO_DA_AULA,
  podeVerificar,
  dividirLicao,
  tituloDaLicao,
  verificar,
} from "./aula";
import { contaComoFeita, instanteNoTempo, relogio, segundosDaSessao } from "./respiracao";
import { inicioDoProximo, linhaDoTempo, montarSessao, posicaoNoTempo } from "./mexer";
import { planoDoDia, temasDisponiveis } from "./meditacao";
import { montarGrade, paraResgatar, placar, prateleiras } from "./conquistas";

const unica: QuizQuestion = { q: "?", o: ["a", "b", "c"], a: 2, why: "porque" };
const varias: QuizQuestion = { q: "?", o: ["a", "b", "c", "d"], a: [0, 2], why: "porque" };

describe("a aula: uma tentativa por pergunta", () => {
  test("escolha única troca a escolha; verificar trava", () => {
    let e = comecarPerguntas(INICIO_DA_AULA);
    expect(podeVerificar(e)).toBe(false);
    e = escolher(e, unica, 0);
    e = escolher(e, unica, 2);
    expect(e.escolha).toEqual([2]);
    e = verificar(e, unica);
    expect(e.acertou).toBe(true);
    expect(e.acertos).toBe(1);
    // depois de verificar, tocar não muda nada e verificar de novo não soma
    expect(escolher(e, unica, 0)).toBe(e);
    expect(verificar(e, unica)).toBe(e);
  });

  test("marque todas: só o conjunto exato vale", () => {
    let e = comecarPerguntas(INICIO_DA_AULA);
    e = escolher(e, varias, 2);
    e = escolher(e, varias, 0);
    e = escolher(e, varias, 1);
    e = escolher(e, varias, 1); // desmarca
    expect(e.escolha).toEqual([0, 2]);
    expect(verificar(e, varias).acertou).toBe(true);
    const errada = verificar(escolher(e, varias, 3), varias);
    expect(errada.acertou).toBe(false);
    expect(estadoDaOpcao(errada, varias, 3)).toBe("errada");
    expect(estadoDaOpcao(errada, varias, 0)).toBe("certa");
    expect(estadoDaOpcao(errada, varias, 1)).toBe("neutra");
  });

  test("a certa que ela não marcou aparece como 'faltou'", () => {
    const e = verificar(escolher(comecarPerguntas(INICIO_DA_AULA), unica, 0), unica);
    expect(estadoDaOpcao(e, unica, 2)).toBe("faltou");
    expect(estadoDaOpcao(e, unica, 0)).toBe("errada");
  });

  test("continuar anda e termina", () => {
    let e = verificar(escolher(comecarPerguntas(INICIO_DA_AULA), unica, 2), unica);
    expect(continuar(e, 2).indice).toBe(1);
    e = continuar(e, 1);
    expect(e.etapa).toBe("fim");
    expect(e.acertos).toBe(1);
  });

  test("continuar sem verificar não anda", () => {
    const e = escolher(comecarPerguntas(INICIO_DA_AULA), unica, 2);
    expect(continuar(e, 3)).toBe(e);
  });

  test("a lição se divide em título curto + corpo, sem repetir", () => {
    expect(dividirLicao("Cãibras são comuns. Alongue a panturrilha.")).toEqual({
      titulo: "Cãibras são comuns.",
      corpo: "Alongue a panturrilha.",
    });
    const longa = "A".repeat(100) + ". Resto.";
    expect(dividirLicao(longa)).toEqual({ titulo: null, corpo: longa });
    expect(dividirLicao("Uma frase só.")).toEqual({ titulo: null, corpo: "Uma frase só." });
  });

  test("o título é a primeira frase da lição", () => {
    expect(tituloDaLicao("Revisão da semana 24: marco. Outra frase.")).toBe("Revisão da semana 24: marco.");
    expect(tituloDaLicao("Sem ponto")).toBe("Sem ponto");
  });
});

describe("a respiração 4-4-8", () => {
  test("as fases no tempo", () => {
    expect(instanteNoTempo(0)).toEqual({ ciclo: 0, fase: "inspire", restante: 4, progresso: 0 });
    expect(instanteNoTempo(3.5).fase).toBe("inspire");
    expect(instanteNoTempo(3.5).restante).toBe(1);
    expect(instanteNoTempo(4).fase).toBe("segure");
    expect(instanteNoTempo(8).fase).toBe("solte");
    expect(instanteNoTempo(8).restante).toBe(8);
    expect(instanteNoTempo(16)).toEqual({ ciclo: 1, fase: "inspire", restante: 4, progresso: 0 });
  });
  test("a sessão é de ciclos inteiros e o mínimo é um minuto", () => {
    expect(segundosDaSessao(4)).toBe(64);
    expect(contaComoFeita(59)).toBe(false);
    expect(contaComoFeita(60)).toBe(true);
    expect(relogio(65)).toBe("1:05");
  });
  test("o plano de um minuto tem acolhimento e volta", () => {
    const p = planoDoDia({ minutos: 1, tema: "Calma", semanas: 24, cuidado: false, D: 171 });
    expect(p.totalCiclos).toBe(4);
    expect(p.deixas.length).toBeGreaterThan(0);
  });
  test("no Modo Cuidado nenhuma fala cita o bebê, e os temas de bebê saem", () => {
    for (const minutos of [1, 2, 5] as const) {
      const p = planoDoDia({ minutos, tema: "Calma", semanas: 24, cuidado: true, D: 171 });
      for (const d of p.deixas) expect(/beb[êe]/i.test(d.fala.texto)).toBe(false);
    }
    const temas = temasDisponiveis({ cuidado: true, posParto: false }).map((t) => t.tema);
    expect(temas).not.toContain("Conexão com o bebê");
    expect(temas).not.toContain("Coragem pro parto");
    expect(temas).toContain("Calma");
  });
  test("no pós-parto o parto que vem não é tema", () => {
    const temas = temasDisponiveis({ cuidado: false, posParto: true }).map((t) => t.tema);
    expect(temas).not.toContain("Coragem pro parto");
    expect(temas).toContain("Gratidão");
  });
});

describe("mexer", () => {
  test("a sessão de 3 minutos cabe em ~3 minutos, com mais de um movimento e tem passo a passo", () => {
    const seq = montarSessao({ D: 171, minutos: 3, semana: 24, posParto: false, cuidado: false, sintoma: null });
    expect(seq.length).toBeGreaterThan(0);
    const { total } = linhaDoTempo(seq);
    expect(total).toBeLessThanOrEqual(200);
    expect(seq.length).toBeGreaterThan(1);
    for (const m of seq) expect(m.passos.length).toBeGreaterThan(0);
  });
  test("com 38 semanas, nada de chão", () => {
    const seq = montarSessao({ D: 268, minutos: 5, semana: 38, posParto: false, cuidado: false, sintoma: null });
    for (const m of seq) expect(m.chao).toBe(false);
  });
  test("no Modo Cuidado vale a régua do pós-parto: sem preparação para o parto, sem chão", () => {
    const seq = montarSessao({ D: 171, minutos: 5, semana: 24, posParto: false, cuidado: true, sintoma: null });
    for (const m of seq) {
      expect(m.fases).toContain("pos");
      expect(m.chao).toBe(false);
    }
  });
  test("a queixa dela vem primeiro", () => {
    const seq = montarSessao({ D: 171, minutos: 3, semana: 24, posParto: false, cuidado: false, sintoma: "caimbra" });
    expect(seq.some((m) => m.alivia.includes("caimbra"))).toBe(true);
  });
  test("linha do tempo, posição e pular", () => {
    const seq = montarSessao({ D: 171, minutos: 5, semana: 24, posParto: false, cuidado: false, sintoma: null });
    const { trechos, total } = linhaDoTempo(seq);
    expect(posicaoNoTempo(trechos, 0).tipo).toBe("movimento");
    if (trechos.length > 1) {
      const p = posicaoNoTempo(trechos, trechos[0].fim + 1);
      expect(p.tipo).toBe("troca");
      expect(inicioDoProximo(trechos, 1)).toBe(trechos[1].inicio);
    }
    expect(posicaoNoTempo(trechos, total).tipo).toBe("fim");
  });
});

describe("a grade de conquistas", () => {
  const unlocked = [
    { achievement_key: "first_login", unlocked_at: "2026-09-01T12:00:00Z" },
    { achievement_key: "first_journal", unlocked_at: "2026-09-12T12:00:00Z" },
  ];
  test("bloqueada, a resgatar, resgatada", () => {
    const g = montarGrade(unlocked, ["first_login"]);
    const por = (k: string) => g.find((c) => c.def.key === k)!;
    expect(por("first_login").estado).toBe("resgatada");
    expect(por("first_journal").estado).toBe("resgatar");
    expect(por("first_journal").sementinhas).toBe(15);
    expect(por("journal_10").estado).toBe("bloqueada");
    expect(paraResgatar(g)).toBe(1);
  });
  test("resgatadas null (falha de leitura): ninguém pede resgate", () => {
    const g = montarGrade(unlocked, null);
    expect(paraResgatar(g)).toBe(0);
    expect(g.find((c) => c.def.key === "first_journal")!.estado).toBe("desbloqueada");
  });
  test("na gestação, as do pós-parto ficam na prateleira própria e fora do placar", () => {
    const g = montarGrade(unlocked, []);
    const p = placar(g, false);
    expect(p.feitas).toBe(2);
    expect(p.total).toBeLessThan(g.length);
    const pr = prateleiras(g, false);
    expect(pr[pr.length - 1].titulo).toBe("Depois do nascimento");
    expect(pr.flatMap((x) => x.cartoes).length).toBe(g.length);
  });
});
