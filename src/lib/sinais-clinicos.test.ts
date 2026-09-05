/**
 * Testes da régua clínica.
 *
 * Existem porque os únicos portões deste projeto eram `tsc`, `eslint` e
 * `build` — tipo, estilo e compilação. Nenhum dos três vê lógica, e TODO defeito
 * encontrado nas revisões foi de lógica: um filtro que excluía justamente o que
 * a tela existia para mostrar, um `catch` que devolvia "está tudo limpo", uma
 * faixa que rotulava 35 mg/dL como normal.
 *
 * Cada teste aqui nasceu de um defeito real. Se algum deles voltar, o commit
 * quebra antes de chegar ao médico.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  diasDeSilencio,
  sinalGlicemia,
  sinalPressao,
  sinalSaturacao,
  sinalSilencio,
  validaRegistro,
  vozDaPaciente,
  sinalContracoesPrematuras,
} from "./sinais-clinicos";

describe("pressão arterial", () => {
  test("o OU da hipertensão — 138/95 é elevada, e um E deixaria passar", () => {
    expect(sinalPressao(138, 95)?.gravidade).toBe("atencao");
    expect(sinalPressao(145, 80)?.gravidade).toBe("atencao");
  });

  test("faixa grave a partir de 160 OU 110", () => {
    expect(sinalPressao(165, 100)?.gravidade).toBe("grave");
    expect(sinalPressao(150, 115)?.gravidade).toBe("grave");
  });

  test("120/80 não é marcado", () => {
    expect(sinalPressao(120, 80)?.gravidade).toBe("normal");
    expect(sinalPressao(120, 80)?.nota).toBe("");
  });

  /* DEFEITO REAL: "0/0" chegava ao banco porque o formulário testava
     `if (form.systolic)` e a string "0" é truthy. Passava pelos dois `if` e
     saía como `normal`, ocupando na ficha o lugar da última medida real. */
  test("implausível NÃO é normal", () => {
    expect(sinalPressao(0, 0)?.gravidade).toBe("atencao");
    expect(sinalPressao(999, 10)?.gravidade).toBe("atencao");
    expect(sinalPressao(-120, -80)?.gravidade).toBe("atencao");
    expect(sinalPressao(NaN, NaN)).toBeNull();
  });

  /* DEFEITO REAL: 100/170 (campos trocados numa pré-eclâmpsia grave) saía como
     `atencao` e ordenava ABAIXO de qualquer vermelho. A escala tem que estar
     ancorada na urgência, não no formato do dado. */
  test("campos invertidos preservam a gravidade do par real", () => {
    const grave = sinalPressao(100, 170);
    expect(grave?.gravidade).toBe("grave");
    expect(grave?.nota).toContain("170/100");

    const normal = sinalPressao(80, 120);
    expect(normal?.gravidade).toBe("normal");
    expect(normal?.nota).toContain("invertidos");
  });

  /* DEFEITO REAL: a primeira versão da guarda de inversão recursava infinito
     quando sistólica == diastólica, travando a aba inteira. */
  test("pressão de pulso zero não recursa nem trava", () => {
    const r = sinalPressao(90, 90);
    expect(r?.gravidade).toBe("atencao");
    expect(r?.nota).toContain("implausível");
  });
});

describe("glicemia", () => {
  /* DEFEITO REAL, o pior de todos: o app da paciente tinha uma cópia da escala
     que só olhava para cima, e 35 mg/dL — neuroglicopenia — saía "Normal" em
     verde para uma gestante em insulina. */
  test("hipoglicemia grave é GRAVE, e vem antes do teto alto", () => {
    expect(sinalGlicemia(35)?.gravidade).toBe("grave");
    expect(sinalGlicemia(25)?.gravidade).toBe("grave");
    expect(sinalGlicemia(55)?.gravidade).toBe("atencao");
  });

  test("alvo e teto alto", () => {
    expect(sinalGlicemia(90)?.gravidade).toBe("normal");
    expect(sinalGlicemia(145)?.gravidade).toBe("atencao");
    expect(sinalGlicemia(185)?.gravidade).toBe("grave");
  });

  /* DEFEITO REAL: glicosímetro em mmol/L. 10,0 mmol = 180 mg/dL (GRAVE) virava
     10 na coluna inteira e saía rotulado "Glicemia baixa" — o alerta
     exatamente oposto ao correto. */
  test("leitura em mmol/L é grave e pede conferência de unidade", () => {
    const r = sinalGlicemia(10);
    expect(r?.gravidade).toBe("grave");
    expect(r?.nota).toContain("unidade");
  });

  test("zero não passa como normal — e o número ALTO é grave, não implausível", () => {
    expect(sinalGlicemia(0)?.gravidade).toBe("atencao");
    /* ⚠️ Isto já foi `atencao`, e era o defeito: com o teto de 900, uma glicemia
       de 1200 saía "implausível" e ordenava ABAIXO de um 185 rotulado grave, na
       fila de trabalho do médico. Um número alto demais para ser plausível é,
       antes disso, um número alto — e cetoacidose é emergência. */
    expect(sinalGlicemia(1200)?.gravidade).toBe("grave");
  });
});

describe("saturação", () => {
  /* DEFEITO REAL: SpO2 atravessava o sistema inteiro — a paciente registrava, a
     view emitia, o tipo declarava — e chegava à tela como a palavra "Medida",
     sem número, porque não havia régua. */
  test("na gestação a reserva é menor: 94% já pede atenção", () => {
    expect(sinalSaturacao(98)?.gravidade).toBe("normal");
    expect(sinalSaturacao(94)?.gravidade).toBe("atencao");
    expect(sinalSaturacao(88)?.gravidade).toBe("grave");
    expect(sinalSaturacao(101)?.gravidade).toBe("atencao");
  });
});

describe("silêncio", () => {
  const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  test("cortes de 14 e 30 dias", () => {
    expect(sinalSilencio(diasAtras(3))?.gravidade).toBe("normal");
    expect(sinalSilencio(diasAtras(15))?.gravidade).toBe("atencao");
    expect(sinalSilencio(diasAtras(32))?.gravidade).toBe("grave");
  });

  /* DEFEITO REAL: sem registro na janela virava "Nunca registrou nada no app" —
     afirmação falsa sobre uma paciente que usa o app há meses. */
  test("fora da janela não vira 'nunca'", () => {
    const r = sinalSilencio(null, 45);
    expect(r?.nota).toContain("últimos 45 dias");
    expect(r?.nota).not.toContain("Nunca");
  });

  test("data ilegível aparece na lista em vez de sumir", () => {
    expect(sinalSilencio("ontem")?.gravidade).toBe("atencao");
    expect(diasDeSilencio("ontem", 45)).toBe(46);
  });
});

describe("voz da paciente", () => {
  /* DEFEITO REAL: a orientação de pressão ("repita sentada e em repouso") saía
     para glicemia, e "confira a unidade" saía para uma glicemia de 250 real. */
  test("cada medida tem a sua conduta", () => {
    expect(vozDaPaciente(sinalGlicemia(35), "glicemia")?.orientacao).toContain("doce");
    expect(vozDaPaciente(sinalGlicemia(250), "glicemia")?.orientacao).not.toContain("mg/dL");
    expect(vozDaPaciente(sinalGlicemia(10), "glicemia")?.orientacao).toContain("mg/dL");
    expect(vozDaPaciente(sinalPressao(175, 115))?.orientacao).toContain("repouso");
  });

  test("normal não gera orientação", () => {
    expect(vozDaPaciente(sinalPressao(120, 80))).toBeNull();
  });
});

describe("validação na entrada", () => {
  test("aceita o legítimo", () => {
    expect(validaRegistro({ systolic: "118", diastolic: "76", weight_kg: "72,4" })).toBeNull();
    expect(validaRegistro({})).toBeNull();
  });

  /* DEFEITO REAL: `if (form.systolic)` com estado em string — "0" é truthy. */
  test("recusa o impossível — o que é impossível, e não o que é incomum", () => {
    expect(validaRegistro({ systolic: "0", diastolic: "0" })).toBeTruthy();
    /* ⚠️ `weight_kg: "999"` era recusado aqui, e o dono derrubou esse teto: um
       peso alto é o peso de alguém. O que continua impossível é o que não é
       medida — zero, negativo — e o que a DEFINIÇÃO da grandeza proíbe. */
    expect(validaRegistro({ weight_kg: "999" })).toBe(null);
    expect(validaRegistro({ weight_kg: "0" })).toBeTruthy();
    expect(validaRegistro({ spo2: "10" })).toBeTruthy();
    expect(validaRegistro({ spo2: "101" })).toBeTruthy();
  });

  test("pressão pela metade é recusada com a frase certa", () => {
    const e = validaRegistro({ systolic: "140" });
    expect(e).toContain("dois números");
  });

  test("mmol/L recebe explicação, não erro genérico", () => {
    const e = validaRegistro({ glucose_mg_dl: "5,4" });
    expect(e).toContain("mmol/L");
  });
});

describe("contrações regulares antes das 37 semanas", () => {
  /* ⚠️ Este bloco existe porque o cronômetro RECEBIA a semana gestacional e a
     descartava. Uma paciente de 28 semanas com contrações a cada 12 minutos
     lia "Padrão normal", e a mesma paciente, na triagem, receberia "procure
     atendimento agora" — o app dizendo coisas opostas sobre o mesmo quadro. */

  test("28 semanas com padrão regular é GRAVE, mesmo sendo um padrão leve", () => {
    /* 8 minutos é o padrão que a régua de trabalho de parto chamaria de
       "atenção — monitore de perto". Antes do termo, ele é vermelho. */
    const s = sinalContracoesPrematuras({ semanas: 28, intervaloMin: 8 });
    expect(s?.gravidade).toBe("grave");
    expect(s?.nota).toContain("37 semanas");
  });

  test("no limite de 10 minutos ainda conta como regular", () => {
    expect(sinalContracoesPrematuras({ semanas: 30, intervaloMin: 10 })?.gravidade).toBe("grave");
    expect(sinalContracoesPrematuras({ semanas: 30, intervaloMin: 11 })).toBeNull();
  });

  test("a partir das 37 não é prematuro — 37 é a fronteira do termo", () => {
    expect(sinalContracoesPrematuras({ semanas: 37, intervaloMin: 5 })).toBeNull();
    expect(sinalContracoesPrematuras({ semanas: 36, intervaloMin: 5 })?.gravidade).toBe("grave");
  });

  test("sem semana conhecida NÃO afirma prematuridade", () => {
    /* Inventar aqui alarmaria quem está de 39 semanas em trabalho de parto
       normal — que é exatamente quem mais usa o cronômetro. */
    expect(sinalContracoesPrematuras({ semanas: null, intervaloMin: 5 })).toBeNull();
    expect(sinalContracoesPrematuras({ semanas: Number.NaN, intervaloMin: 5 })).toBeNull();
    expect(sinalContracoesPrematuras({ semanas: 28, intervaloMin: null })).toBeNull();
  });

  test("o cronômetro usa a régua, e o teste da semana vem ANTES dos cortes de parto", () => {
    /* Sem a ordem, o caso perigoso — padrão leve antes do termo — só seria
       alcançado depois de passar pelos cortes de trabalho de parto ativo, que
       o classificariam como normal.

       ⚠️ **ESTA ASSERÇÃO JÁ ENVELHECEU DUAS VEZES, e da segunda ela estava
       ESCONDENDO dois defeitos.** Ela cobrava a string
       `sinalContracoesPrematuras({ semanas: weeks` — ou seja, provava que a
       CHAMADA existia, e nada sobre o que ela recebia nem sobre quando era
       alcançada. Por baixo dela a régua ficava barrada por uma duração que não
       usa, e a MÉDIA do intervalo apagava o alerta. As duas coisas silenciavam
       o "Ligue para o seu médico agora" antes das 37 semanas.

       O conserto não foi escrever mais uma asserção de texto: a régua saiu do
       componente para `src/lib/analise-de-contracoes.ts`, onde é pura, e o que
       a guarda agora é `analise-de-contracoes.test.ts`, que a EXERCITA. O que
       fica aqui é só a ORDEM — a única garantia que se lê melhor no fonte que
       no comportamento. */
    /* ⚠️ SEM OS COMENTÁRIOS. O comentário que EXPLICA por que a régua tem de
       vir antes do corte de `completed` contém, por definição, a string
       `completed.length < 2` — e a primeira versão desta asserção ficou
       vermelha por causa da própria prosa que documenta o conserto. É a
       enésima vez nesta base, e ela quebra nos dois sentidos. */
    const arq = readFileSync("src/lib/analise-de-contracoes.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const i = arq.indexOf("export function analyzeContractions(");
    expect(i).toBeGreaterThan(-1);
    const corpo = arq.slice(i);
    const regua = corpo.indexOf("sinalContracoesPrematuras(");
    expect(regua).toBeGreaterThan(-1);
    /* Antes dos cortes de trabalho de parto… */
    expect(regua).toBeLessThan(corpo.indexOf("avgInterval <= 3"));
    /* …e antes do corte que exige contrações TERMINADAS, que é o que a barrava
       com a segunda contração ainda em curso. */
    expect(regua).toBeLessThan(corpo.indexOf("completed.length < 2"));
  });
});
