/**
 * AS FRASES DO BEBÊ BOLHA — e as quatro coisas que não podem escapar.
 *
 * Ele fala com gestante de alto risco, todo dia, no canto da tela dela. As
 * regras abaixo não são preferência de estilo: cada uma existe porque a
 * violação correspondente seria sentida por quem está no pior dia da gestação.
 */

import { describe, expect, test } from "bun:test";
import {
  comNomeNaFrase,
  diaLocalDe,
  fraseDoDia,
  FRASES,
  periodoDaHora,
  tempoDoMomento,
  type Periodo,
} from "./frases-do-mascote";

const PERIODOS: Periodo[] = ["madrugada", "manha", "tarde", "noite"];

describe("o relógio", () => {
  test("as quatro faixas cobrem as 24 horas", () => {
    expect(periodoDaHora(0)).toBe("madrugada");
    expect(periodoDaHora(4)).toBe("madrugada");
    expect(periodoDaHora(5)).toBe("manha");
    expect(periodoDaHora(11)).toBe("manha");
    expect(periodoDaHora(12)).toBe("tarde");
    expect(periodoDaHora(17)).toBe("tarde");
    expect(periodoDaHora(18)).toBe("noite");
    expect(periodoDaHora(23)).toBe("noite");
  });
});

describe("o relógio dentro da frase", () => {
  test("'quase onze' não aparece às seis da tarde", () => {
    /* 18h05 e 22h40 caem as duas em `noite`, e a segunda é a única em que essa
       frase é verdade. Errar a hora que ele mesmo anunciou destrói a única
       coisa que o personagem tem: parecer estar ali junto. */
    const noite = (hora: number) =>
      Array.from({ length: 40 }, (_, i) =>
        fraseDoDia({ dia: 20_000 + i, periodo: "noite", hora, nome: "Ana" }),
      );
    expect(noite(18).some((f) => f?.includes("quase onze"))).toBe(false);
    expect(noite(22).some((f) => f?.includes("quase onze"))).toBe(true);
  });

  test("toda hora da noite ainda tem o que dizer", () => {
    /* O recorte não pode deixar um buraco: quem abre às 19h precisa de frase
       tanto quanto quem abre às 23h. */
    for (let hora = 18; hora <= 23; hora++) {
      expect(fraseDoDia({ dia: 20_000, periodo: "noite", hora, nome: "Ana" })).toBeTruthy();
      expect(fraseDoDia({ dia: 20_001, periodo: "noite", hora, nome: null })).toBeTruthy();
    }
  });

  test("sem hora conhecida, nenhuma frase cita o relógio", () => {
    const comRelogio = FRASES.filter((f) => f.horas).map((f) => f.texto);
    expect(comRelogio.length).toBeGreaterThan(0);
    for (let dia = 20_000; dia < 20_060; dia++) {
      const f = fraseDoDia({ dia, periodo: "noite", nome: "Ana" });
      expect(comRelogio.some((t) => t === f || comNomeNaFrase(t, "Ana") === f)).toBe(false);
    }
  });
});

describe("a semana da gestação", () => {
  const CHUTES = /sentiu o bebê/;
  const trintaDias = (semanas: number | null) =>
    Array.from({ length: 40 }, (_, i) =>
      fraseDoDia({ dia: 20_000 + i, periodo: "tarde", hora: 15, nome: "Ana", semanas }),
    );

  test("não pergunta se ela sentiu o bebê antes da hora", () => {
    /* Uma mulher de 11 semanas não tem como sentir movimento, e sabe disso
       vagamente. Um personagem perguntando todo dia se ela já sentiu planta
       "eu deveria estar sentindo e não estou" — num app de alto risco, o
       oposto do que este balão existe para fazer. */
    expect(trintaDias(11).some((f) => f && CHUTES.test(f))).toBe(false);
    expect(trintaDias(27).some((f) => f && CHUTES.test(f))).toBe(false);
  });

  test("a partir da 28ª ela aparece", () => {
    /* A régua é a do próprio app: o módulo do 3º trimestre é quem diz "é hora
       de começar a contar os chutes". */
    expect(trintaDias(28).some((f) => f && CHUTES.test(f))).toBe(true);
  });

  test("sem semana conhecida, cala", () => {
    /* Sem DUM, ou no pós-parto. Na dúvida, calar. */
    expect(trintaDias(null).some((f) => f && CHUTES.test(f))).toBe(false);
  });
});

describe("nenhuma hora fica muda", () => {
  test("existe frase para as quatro faixas, com nome e sem nome", () => {
    /* Uma faixa sem frase deixaria o mascote calado o dia inteiro para quem
       abre naquele horário — e a madrugada, que é a faixa mais frágil, é
       justamente a que tem menos frases. */
    for (const periodo of PERIODOS) {
      expect(fraseDoDia({ dia: 20_000, periodo, nome: "Ana" })).toBeTruthy();
      expect(fraseDoDia({ dia: 20_000, periodo, nome: null })).toBeTruthy();
    }
  });

  test("no Modo Cuidado também sobra frase em toda faixa", () => {
    /* O luto é onde ele mais precisa existir, e é onde a lista mais encolhe:
       se o filtro derrubasse tudo numa faixa, a paciente que perdeu a gestação
       abriria o app às 3h e encontraria o personagem mudo. */
    for (const periodo of PERIODOS) {
      expect(fraseDoDia({ dia: 20_000, periodo, nome: "Ana", careMode: true })).toBeTruthy();
    }
  });
});

describe("o que ele nunca diz", () => {
  test("nada de cobrança", () => {
    /* A carinha `preocupada` já saiu da personagem por isto: cobrança
       disfarçada de fofura continua sendo cobrança. */
    const proibido =
      /\b(você não fez|faltou|não fez|está atrasad|perdeu a sequência|vai perder|precisa fazer|devia)\b/i;
    for (const f of FRASES) expect(f.texto).not.toMatch(proibido);
  });

  test("nada de promessa clínica", () => {
    /* Ele não tranquiliza sobre sintoma, não afirma que está tudo bem e não
       receita. Quem faz isso é o médico, e a triagem tem tela própria. */
    const proibido = /\b(está tudo bem|não se preocupe|é normal sentir|vai passar|fique calma)\b/i;
    for (const f of FRASES) expect(f.texto).not.toMatch(proibido);
  });

  test("⚠️ nenhuma frase PRESSUPÕE que o dia está ruim", () => {
    /* A frase do dia é sorteada pelo DIA, não pelo estado dela: um consolo
       cai numa terça comum, às 6h51, sem nada ter acontecido. Aí ele faz uma
       de duas coisas, as duas ruins — ou vira ruído, ou faz a paciente achar
       que o app SABE de alguma coisa, que num app de alto risco é a leitura
       mais assustadora possível.

       O dono abriu o app e leu "Não existe jeito certo de viver um dia
       difícil"; a pergunta dele foi a certa: qual o objetivo dela?

       Conforto com GATILHO continua valendo: na madrugada a hora é a
       evidência, e no Modo Cuidado o motivo é conhecido. O que não pode é
       inventar o motivo. */
    const pressupoe =
      /dia dif[íi]cil|dia ruim|s[óo] der para|mal consegu|aguentar|d[ée] conta de tudo/i;
    const semGatilho = FRASES.filter((f) => !f.periodos?.includes("madrugada"));
    expect(semGatilho.filter((f) => pressupoe.test(f.texto)).map((f) => f.texto)).toEqual([]);
  });

  test("no luto, nenhuma frase fala de bebê, semana ou jogo", () => {
    const luto = FRASES.filter((f) => f.noLuto);
    expect(luto.length).toBeGreaterThan(4);
    for (const f of luto) {
      expect(f.texto).not.toMatch(/\b(bebê|semana|chutes|Caminho|aula|Sementinhas)\b/i);
    }
  });
});

describe("o nome", () => {
  test("`{nome}` vira vírgula + primeiro nome", () => {
    expect(comNomeNaFrase("Bom dia{nome} 💛", "Ana Beatriz")).toBe("Bom dia, Ana 💛");
  });

  test("sem nome, o trecho SOME — e não deixa vírgula órfã", () => {
    /* "Bom dia, !" é o defeito que aparece justamente na conta de quem pulou o
       cadastro, que é quem mais vê estas frases. */
    expect(comNomeNaFrase("Bom dia{nome} 💛", null)).toBe("Bom dia 💛");
    expect(comNomeNaFrase("Bom dia{nome} 💛", "   ")).toBe("Bom dia 💛");
  });

  test("quem não tem nome nunca recebe frase que pede nome", () => {
    for (const periodo of PERIODOS) {
      for (let dia = 20_000; dia < 20_040; dia++) {
        const f = fraseDoDia({ dia, periodo, nome: null });
        expect(f).not.toContain("{nome}");
      }
    }
  });
});

describe("uma por dia, e ela roda", () => {
  test("o mesmo dia devolve sempre a mesma frase", () => {
    /* Se mudasse a cada montagem, a home trocaria a frase a cada toque em
       "Bebê" — e o balão viraria um letreiro. */
    const a = fraseDoDia({ dia: 20_100, periodo: "tarde", nome: "Ana" });
    const b = fraseDoDia({ dia: 20_100, periodo: "tarde", nome: "Ana" });
    expect(a).toBe(b);
  });

  test("dias seguidos não repetem, e a volta percorre a lista inteira", () => {
    /* O que se cobra é a cobertura: em N dias ela viu as N frases da faixa,
       sem repetir. A primeira versão andava de 7 em 7 e a manhã, que tem 14
       frases, ficava presa em duas — este teste é o que pegou. */
    for (const periodo of PERIODOS) {
      const vistas = new Set<string>();
      /* Sem clima, hora nem semana conhecidos, as frases com esses recortes não
         entram — o teste conta a mesma lista que a régua monta. */
      const total = FRASES.filter(
        (f) =>
          (!f.periodos || f.periodos.includes(periodo)) && !f.tempo && !f.horas && f.desde == null,
      ).length;
      for (let dia = 0; dia < total * 2; dia++) {
        const f = fraseDoDia({ dia, periodo, nome: "Ana" });
        if (f) vistas.add(f);
      }
      expect(vistas.size).toBe(total);
    }
  });
});

describe("o dia vem do calendário LOCAL", () => {
  test("duas horas do mesmo dia dão o mesmo número", () => {
    const manha = new Date(2026, 7, 12, 8, 0, 0);
    const noite = new Date(2026, 7, 12, 23, 30, 0);
    expect(diaLocalDe(manha)).toBe(diaLocalDe(noite));
  });

  test("a virada da meia-noite muda o dia", () => {
    const hoje = new Date(2026, 7, 12, 23, 59, 0);
    const amanha = new Date(2026, 7, 13, 0, 1, 0);
    expect(diaLocalDe(amanha)).toBe(diaLocalDe(hoje) + 1);
  });
});

describe("o tempo lá fora", () => {
  test("chuva vem do MESMO limiar do cartão de saudação", () => {
    /* Duas réguas para "está chovendo" na mesma tela é como o app começa a se
       contradizer: o cartão diria "chá quentinho" e a bolha, "vamos caminhar". */
    expect(tempoDoMomento(51, 22)).toBe("chuva");
    expect(tempoDoMomento(95, 30)).toBe("chuva");
    expect(tempoDoMomento(3, 22)).toBeNull();
  });

  test("calor e frio pelos cortes do senso comum", () => {
    expect(tempoDoMomento(1, 31)).toBe("calor");
    expect(tempoDoMomento(1, 12)).toBe("frio");
    expect(tempoDoMomento(1, 22)).toBeNull();
  });

  test("chuva ganha do calor — quem se molha não pensa em sombra", () => {
    expect(tempoDoMomento(61, 33)).toBe("chuva");
  });

  test("sem clima conhecido, nenhuma frase fala do tempo", () => {
    /* A API pode não ter respondido, ou ela negou a localização. Falar de uma
       chuva que não está caindo é pior que não falar do tempo. */
    for (const periodo of ["madrugada", "manha", "tarde", "noite"] as Periodo[]) {
      for (let dia = 0; dia < 40; dia++) {
        const f = fraseDoDia({ dia, periodo, nome: "Ana" });
        expect(f).not.toMatch(/chuva|chovendo|calor|frio/i);
      }
    }
  });

  test("com chuva, a frase da chuva pode aparecer", () => {
    const vistas = new Set<string>();
    for (let dia = 0; dia < 60; dia++) {
      const f = fraseDoDia({ dia, periodo: "tarde", nome: "Ana", tempo: "chuva" });
      if (f) vistas.add(f);
    }
    expect([...vistas].some((t) => /chuv|chovendo/i.test(t))).toBe(true);
  });
});
