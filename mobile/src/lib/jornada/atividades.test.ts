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
  tituloCurtoDaAula,
  tituloDaLicao,
  verificar,
} from "./aula";
import { contaComoFeita, instanteNoTempo, relogio, segundosDaSessao } from "./respiracao";
import {
  DURACAO_PADRAO,
  DURACOES_MEXER,
  inicioDoProximo,
  linhaDoTempo,
  montarSessao,
  NARRACAO_FORA_DO_APP,
  posicaoNoTempo,
  TEXTO_DO_MOVIMENTO_NO_APP,
  temChaoParaTirar,
} from "./mexer";
import { MOVIMENTOS } from "@/lib/exercicios";
import { lerRegistro, planoDaSessao, temasDisponiveis } from "./meditacao";
import { CONQUISTAS } from "@/lib/conquistas";
import {
  CONQUISTAS_NO_APP,
  conquistaNoApp,
  montarGrade,
  paraResgatar,
  placar,
  resumo,
  secoes,
  SEM_CAMINHO_NO_APP,
  TEXTO_DAS_CONQUISTAS_NO_APP,
} from "./conquistas";

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

  test("o assunto curto da aula: a primeira frase, sem o ponto, cortada no espaço", () => {
    expect(tituloCurtoDaAula("Cãibras são comuns. Alongue a panturrilha.")).toBe(
      "Cãibras são comuns",
    );
    const longa =
      "O ferro ajuda a levar oxigênio para você e para o bebê durante toda a gestação. Fim.";
    const t = tituloCurtoDaAula(longa);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(46);
    expect(t).not.toMatch(/ …$/);
    /* O corte que cai depois de uma vírgula não deixa ",…". */
    expect(
      tituloCurtoDaAula("Se o TOTG indicar diabetes gestacional, procure seu médico. Fim."),
    ).toBe("Se o TOTG indicar diabetes gestacional…");
  });

  test("o título é a primeira frase da lição", () => {
    expect(tituloDaLicao("Revisão da semana 24: marco. Outra frase.")).toBe(
      "Revisão da semana 24: marco.",
    );
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
    const p = planoDaSessao({
      minutos: 1,
      tema: "Calma",
      semanas: 24,
      cuidado: false,
      densidade: "guiada",
      registro: lerRegistro(null),
    });
    expect(p.totalCiclos).toBe(4);
    expect(p.deixas.length).toBeGreaterThan(0);
  });
  test("no Modo Cuidado nenhuma fala cita o bebê, e os temas de bebê saem", () => {
    for (const minutos of [1, 2, 5, 10] as const) {
      const p = planoDaSessao({
        minutos,
        tema: "Calma",
        semanas: 24,
        cuidado: true,
        densidade: "guiada",
        registro: lerRegistro(null),
      });
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
  test("os tempos do app antigo: 2, 5 e 10 minutos, com 5 marcado", () => {
    expect([...DURACOES_MEXER]).toEqual([2, 5, 10]);
    expect(DURACAO_PADRAO).toBe(5);
  });
  test("cada sessão cabe no tempo escolhido e tem passo a passo", () => {
    for (const minutos of DURACOES_MEXER) {
      const seq = montarSessao({
        D: 171,
        minutos,
        semana: 24,
        posParto: false,
        cuidado: false,
        sintoma: null,
      });
      expect(seq.length).toBeGreaterThan(0);
      expect(seq.reduce((s, m) => s + m.secs, 0)).toBeLessThanOrEqual(minutos * 60);
      for (const m of seq) expect(m.passos.length).toBeGreaterThan(0);
    }
    const dez = montarSessao({
      D: 171,
      minutos: 10,
      semana: 24,
      posParto: false,
      cuidado: false,
      sintoma: null,
    });
    expect(dez.length).toBeGreaterThan(5);
  });
  test('"Hoje eu não desço ao chão" tira o chão — e só aparece quando há chão a tirar', () => {
    const base = {
      D: 171,
      minutos: 10 as const,
      semana: 24,
      posParto: false,
      cuidado: false,
      sintoma: null,
    };
    expect(montarSessao(base).some((m) => m.chao)).toBe(true);
    for (const m of montarSessao({ ...base, semChao: true })) expect(m.chao).toBe(false);
    expect(temChaoParaTirar({ semana: 24, posParto: false, cuidado: false })).toBe(true);
    expect(temChaoParaTirar({ semana: 38, posParto: false, cuidado: false })).toBe(false);
    expect(temChaoParaTirar({ semana: null, posParto: true, cuidado: false })).toBe(false);
    expect(temChaoParaTirar({ semana: 24, posParto: false, cuidado: true })).toBe(false);
  });
  test("com 38 semanas, nada de chão", () => {
    const seq = montarSessao({
      D: 268,
      minutos: 5,
      semana: 38,
      posParto: false,
      cuidado: false,
      sintoma: null,
    });
    for (const m of seq) expect(m.chao).toBe(false);
  });
  test("no Modo Cuidado vale a régua do pós-parto: sem preparação para o parto, sem chão", () => {
    const seq = montarSessao({
      D: 171,
      minutos: 5,
      semana: 24,
      posParto: false,
      cuidado: true,
      sintoma: null,
    });
    for (const m of seq) {
      expect(m.fases).toContain("pos");
      expect(m.chao).toBe(false);
    }
  });
  test("a queixa dela vem primeiro", () => {
    const seq = montarSessao({
      D: 171,
      minutos: 2,
      semana: 24,
      posParto: false,
      cuidado: false,
      sintoma: "caimbra",
    });
    expect(seq.some((m) => m.alivia.includes("caimbra"))).toBe(true);
  });
  test("linha do tempo, posição e pular", () => {
    const seq = montarSessao({
      D: 171,
      minutos: 5,
      semana: 24,
      posParto: false,
      cuidado: false,
      sintoma: null,
    });
    const { trechos, total } = linhaDoTempo(seq);
    expect(posicaoNoTempo(trechos, 0).tipo).toBe("movimento");
    if (trechos.length > 1) {
      /* Como no site: o seguinte começa onde o anterior acaba, sem respiro. */
      expect(trechos[1].inicio).toBe(trechos[0].fim);
      const p = posicaoNoTempo(trechos, trechos[0].fim + 1);
      expect(p.tipo === "movimento" && p.trecho.indice).toBe(1);
      expect(inicioDoProximo(trechos, 1)).toBe(trechos[1].inicio);
    }
    expect(total).toBe(seq.reduce((s, m) => s + m.secs, 0));
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
  test("na gestação, o placar do Início: as do pós-parto (sem tela no app) não entram trancadas", () => {
    const g = montarGrade(unlocked, []);
    const p = placar(g, false);
    expect(p.feitas).toBe(2);
    expect(p.total).toBe(g.length);
    expect(g.some((c) => c.def.posParto)).toBe(false);
  });
  test("as conquistas sem caminho no app somem trancadas, e ficam quando ela já as ganhou", () => {
    const g = montarGrade(unlocked, []);
    for (const k of SEM_CAMINHO_NO_APP) expect(g.some((c) => c.def.key === k)).toBe(false);
    const ganhou = montarGrade(
      [...unlocked, { achievement_key: "prenatal_done", unlocked_at: "2026-09-20T12:00:00Z" }],
      [],
    );
    expect(ganhou.find((c) => c.def.key === "prenatal_done")?.estado).toBe("resgatar");
    /* 21/10/2026: o app não pede mais altura e peso, nem registra peso,
       pressão e glicemia — as conquistas que pagavam por isso saem trancadas. */
    for (const k of ["profile_complete", "first_health_log", "health_7_days"])
      expect(g.some((c) => c.def.key === k)).toBe(false);
  });
  test("a aba segue o site: seções na ordem do site, X de todas, e a nota do nascimento", () => {
    const g = montarGrade(unlocked, []);
    const sec = secoes(g);
    /* "Saúde" vira "Bem-estar": a seção junta a meditação e o Mexer, e o app
       não fala de saúde como régua (21/10/2026). */
    expect(sec.map((s) => s.rotulo)).toEqual([
      "Bebê",
      "Bem-estar",
      "Diário",
      "Educação",
      "Família",
    ]);
    expect(sec.flatMap((s) => s.cartoes).length).toBe(g.length);
    const r = resumo(g);
    expect(r.feitas).toBe(2);
    expect(r.total).toBe(g.length);
    expect(r.pct).toBe(Math.round((2 / g.length) * 100));
    /* Sem nenhuma do pós-parto à mostra (todas sem tela no app), a nota do
       nascimento não tem do que falar. */
    expect(r.mostrarNotaDoNascimento).toBe(false);
    const comPos = montarGrade(
      [...unlocked, { achievement_key: "first_vaccine", unlocked_at: "2027-01-01T12:00:00Z" }],
      [],
    );
    expect(resumo(comPos).mostrarNotaDoNascimento).toBe(false);
  });
});

describe("a revisão da aula feita", () => {
  test("abre com o gabarito marcado, verificada, sem contar acerto", async () => {
    const { revisao, estadoDaOpcao } = await import("./aula");
    const q = { q: "?", o: ["a", "b", "c", "d"], a: [0, 2], why: "porque" };
    const e = revisao(q, 3);
    expect(e).toEqual({
      etapa: "pergunta",
      indice: 3,
      escolha: [0, 2],
      verificada: true,
      acertou: true,
      acertos: 0,
    });
    expect(estadoDaOpcao(e, q, 0)).toBe("certa");
    expect(estadoDaOpcao(e, q, 1)).toBe("neutra");
  });
});

describe("os textos das conquistas no app", () => {
  test("as trocadas ainda são, no site, o texto que foi trocado", () => {
    for (const [key, t] of Object.entries(TEXTO_DAS_CONQUISTAS_NO_APP)) {
      const site = CONQUISTAS.find((c) => c.key === key);
      expect({ title: site?.title, description: site?.description }).toEqual(t.site);
      expect(conquistaNoApp(key)?.title).toBe(t.app.title ?? t.site.title);
    }
  });

  test("nenhum título nem descrição dá gênero ao bebê ou fala de saúde, vacina, mamada ou chute", () => {
    const fora = CONQUISTAS_NO_APP.filter((c) =>
      /\b(ele|ela)\b|saúde|saudável|vacina|mamada|amament|chutes|pré-natal|peso do bebê|bebê ativo/i.test(
        `${c.title} ${c.description}`,
      ),
    ).map((c) => `${c.key}: ${c.title} — ${c.description}`);
    expect(fora).toEqual([]);
    expect(montarGrade([], []).every((c) => CONQUISTAS_NO_APP.includes(c.def))).toBe(true);
  });
});

describe("os textos do Mexer no app", () => {
  test("cada troca ainda é, no site, o texto que foi trocado", () => {
    for (const [id, t] of Object.entries(TEXTO_DO_MOVIMENTO_NO_APP)) {
      const m = MOVIMENTOS.find((x) => x.id === id);
      expect(m).toBeDefined();
      for (const k of ["cue", "sentir", "parar"] as const) if (t[k]) expect(m![k]).toBe(t[k]!.site);
      for (const [i, p] of Object.entries(t.passos ?? {}))
        expect(m!.passos[Number(i)]).toBe(p.site);
    }
  });

  test("nenhuma sessão promete remédio, lista sinal de alerta ou manda para médico e consulta", () => {
    const fora = new Set<string>();
    for (const semana of [8, 16, 24, 30, 37, 39])
      for (const minutos of DURACOES_MEXER)
        for (const sintoma of [null, "cansaco"] as const)
          for (let D = semana * 7; D < semana * 7 + 7; D++)
            for (const m of montarSessao({
              D,
              minutos,
              semana,
              posParto: false,
              cuidado: false,
              sintoma,
            }))
              for (const t of [m.cue, m.sentir, m.parar, ...m.passos])
                if (
                  /médic|consulta|fisioterap|inchaço|azia|câimbra|remédio|encaixe|o parto pede|contração|quando você tosse|formigamento cedendo|dormente|dormência|refluxo|20ª semana|abre a saída/i.test(
                    t,
                  ) ||
                  /lado ESQUERDO/.test(t)
                )
                  fora.add(`${m.id}: ${t}`);
    expect([...fora]).toEqual([]);
  });

  test("a dica que mudou perde a narração gravada (a voz diria a frase antiga)", () => {
    expect([...NARRACAO_FORA_DO_APP].sort()).toEqual(
      Object.entries(TEXTO_DO_MOVIMENTO_NO_APP)
        .filter(([, t]) => t.cue)
        .map(([id]) => id)
        .sort(),
    );
    expect(NARRACAO_FORA_DO_APP.has("tornozelo")).toBe(true);
    expect(NARRACAO_FORA_DO_APP.has("balanco")).toBe(true);
  });
});
