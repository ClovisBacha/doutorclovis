/**
 * MARCAR CONSULTA NO DIA — a régua, antes da tela.
 *
 * O calendário deixou de ser só leitura: o médico clica num dia e marca. As
 * formas de isso dar errado são caras e silenciosas — duas pacientes no mesmo
 * horário (ou em horários que se cruzam), um aviso mandado para um e-mail que
 * não existe, e uma consulta marcada num horário que já passou.
 */

import { describe, expect, test } from "bun:test";
import { resumoDoDia, validarNovaConsulta, type EventoDaAgenda } from "./agenda-unificada";

const evento = (p: Partial<EventoDaAgenda>): EventoDaAgenda => ({
  id: "x",
  tipo: "presencial",
  dia: "2026-08-20",
  hora: "14:00",
  titulo: "Ana",
  situacao: "Confirmada",
  firme: true,
  pago: null,
  duracaoMinutos: 30,
  ...p,
});

/* Bem no passado, de propósito: os testes que não são sobre "horário no
   passado" não podem depender da data em que o teste roda — senão o dia fixo
   `base.dia` (2026-08-20) vira um passado de verdade no dia em que o
   calendário chegar lá, e a suíte inteira apodrece sozinha. */
const AGORA = new Date("2020-01-01T00:00:00");

/** `validarNovaConsulta` com o "agora" fixo do arquivo, a menos que o teste
    precise de um "agora" próprio (aí passa o terceiro argumento na chamada). */
function validar(
  v: Partial<Parameters<typeof validarNovaConsulta>[0]>,
  doDia: EventoDaAgenda[],
  agora: Date = AGORA,
) {
  return validarNovaConsulta({ ...base, ...v }, doDia, agora);
}

const base = {
  dia: "2026-08-20",
  tipo: "presencial" as const,
  nome: "Maria Silva",
  email: "maria@exemplo.com",
  telefone: "",
  hora: "09:00",
  duracaoMinutos: 30,
  pacienteId: null,
};

describe("1. o choque de horário", () => {
  test("recusa quando já existe compromisso naquela hora — e diz com quem", () => {
    /**
     * O servidor recusaria de qualquer jeito (índice único do slot). Isto aqui
     * existe para ele ver o NOME de quem já está no horário, agora, em vez de
     * receber "horário ocupado" meio segundo depois e sem saber de quem.
     */
    const erro = validar({ hora: "14:00" }, [evento({})]);
    expect(erro).toContain("Ana");
    expect(erro).toContain("14:00");
  });

  test("horário livre no mesmo dia passa", () => {
    expect(validar({ hora: "15:00" }, [evento({})])).toBeNull();
  });

  test("uma PREFERÊNCIA não ocupa horário", () => {
    /**
     * Pedido sem confirmar e consulta particular sem hora combinada entram no
     * calendário com `firme: false` — são lembretes, não compromissos. Deixá-los
     * bloquear o horário faria o médico não conseguir marcar em cima de um
     * "quem sabe" que ele mesmo nunca aceitou.
     */
    const erro = validar({ hora: "14:00" }, [evento({ firme: false })]);
    expect(erro).toBeNull();
  });
});

describe("2. teleconsulta exige paciente do app", () => {
  test("sem `pacienteId` a teleconsulta é recusada", () => {
    /**
     * A sala de vídeo pendura na conta dela: é a conta que recebe o aviso, abre
     * a sala e guarda o registro. Marcar por e-mail avulso criaria uma sala sem
     * dono do outro lado — e o médico só descobriria na hora da consulta.
     */
    const erro = validar({ tipo: "teleconsulta" }, []);
    expect(erro).toContain("paciente do app");
  });

  test("com `pacienteId` passa", () => {
    expect(validar({ tipo: "teleconsulta", pacienteId: "abc" }, [])).toBeNull();
  });

  test("presencial NÃO exige paciente do app — é o caminho de quem não tem conta", () => {
    /* "a pessoa não pode estar cadastrada no aplicativo, mas a gente faz essa
       intermediação" (dono, ago/2026). */
    expect(validar({ pacienteId: null }, [])).toBeNull();
  });
});

describe("3. quem e quando", () => {
  test("nome vazio ou de uma letra não passa", () => {
    expect(validar({ nome: "" }, [])).toContain("nome");
    expect(validar({ nome: "  A " }, [])).toContain("nome");
  });

  test("e-mail em branco passa QUANDO é paciente do app", () => {
    /**
     * O e-mail dela mora em `auth.users`, que a tela não enxerga: nenhuma lista
     * do painel o carrega. Exigir aqui obrigaria o médico a digitar de cabeça o
     * e-mail de quem já está cadastrada — é assim que se erra um caractere e se
     * manda a confirmação para o vazio. Quem resolve é o servidor.
     */
    expect(validar({ email: "", pacienteId: "abc" }, [])).toBeNull();
  });

  test("e-mail em branco NÃO passa para quem não tem conta", () => {
    /* Aí o e-mail é a única forma de avisar. Deixar passar criaria a consulta
       que a pessoa nunca fica sabendo que existe. */
    const erro = validar({ email: "", pacienteId: null }, []);
    expect(erro).toContain("e-mail");
  });

  test("e-mail ERRADO não passa nem para paciente do app", () => {
    /* O em-branco é o caso de "deixa o servidor resolver". Um endereço digitado
       pela metade é outra coisa: ele quis escrever e errou. */
    expect(validar({ email: "maria@", pacienteId: "abc" }, [])).toContain("e-mail");
  });

  test("e-mail sem cara de e-mail não passa — é por ele que o aviso vai", () => {
    expect(validar({ email: "maria" }, [])).toContain("e-mail");
    expect(validar({ email: "maria@" }, [])).toContain("e-mail");
    expect(validar({ email: "maria@exemplo" }, [])).toContain("e-mail");
  });

  test("espaço em volta não invalida nada", () => {
    /* Colar do WhatsApp traz espaço junto. Recusar por isso seria uma consulta
       não marcada por um caractere invisível. */
    expect(validar({ email: "  maria@exemplo.com ", nome: " Maria " }, [])).toBeNull();
  });

  test("hora impossível não passa", () => {
    expect(validar({ hora: "25:00" }, [])).toContain("horário");
    expect(validar({ hora: "9:00" }, [])).toContain("horário");
    expect(validar({ hora: "" }, [])).toContain("horário");
  });

  test("a virada do dia é hora válida", () => {
    /* `00:00` e `23:59` existem. Um regex de `[0-2]\\d` deixaria passar 29:00 e
       um de `[1-2]\\d` recusaria a meia-noite. */
    expect(validar({ hora: "00:00" }, [])).toBeNull();
    expect(validar({ hora: "23:59" }, [])).toBeNull();
  });
});

describe("4. o resumo do dia", () => {
  test("conta por tipo, porque é o tipo que muda o dia dele", () => {
    const r = resumoDoDia([
      evento({ hora: "09:00" }),
      evento({ hora: "10:00" }),
      evento({ tipo: "teleconsulta", hora: "11:00" }),
    ]);
    expect(r).toBe("2 no consultório · 1 por vídeo");
  });

  test("preferência NÃO entra na conta", () => {
    /**
     * Somar os "quem sabe" daria "4 consultas" para um dia com uma marcada e
     * três pendentes — e o resumo existe justamente para ele saber se o dia
     * está cheio.
     */
    expect(resumoDoDia([evento({ firme: false }), evento({ firme: false })])).toBe(
      "Nada marcado — só pedidos sem hora.",
    );
  });

  test("dia sem nada diz que está livre, e não fica em branco", () => {
    expect(resumoDoDia([])).toBe("Dia livre");
  });

  test("particular no plural sai certo", () => {
    expect(resumoDoDia([evento({ tipo: "particular" })])).toBe("1 particular");
    expect(resumoDoDia([evento({ tipo: "particular" }), evento({ tipo: "particular" })])).toBe(
      "2 particulares",
    );
  });
});

describe("5. a duração e o choque de FAIXA", () => {
  /**
   * "Das 10h até as 11h, tem que ter o intervalo da consulta" (dono, ago/2026).
   * Marcar só o início deixava o calendário sem saber até quando o horário
   * fica ocupado — e a checagem antiga (`e.hora === v.hora`) só via colisão no
   * minuto EXATO, deixando passar uma segunda consulta que começa NO MEIO da
   * primeira.
   */
  test("duração fora de 5–240 minutos não passa", () => {
    expect(validar({ duracaoMinutos: 0 }, [])).toContain("duração");
    expect(validar({ duracaoMinutos: 4 }, [])).toContain("duração");
    expect(validar({ duracaoMinutos: 241 }, [])).toContain("duração");
    expect(validar({ duracaoMinutos: 1.5 }, [])).toContain("duração");
  });

  test("5 e 240 minutos, nas bordas, passam", () => {
    expect(validar({ duracaoMinutos: 5 }, [])).toBeNull();
    expect(validar({ duracaoMinutos: 240 }, [])).toBeNull();
  });

  test("uma consulta que começa DENTRO da outra é recusada — mesmo com hora diferente", () => {
    /**
     * Existe uma consulta de 30 min às 10:00 (ocupa até as 10:30). Marcar às
     * 10:15 tem hora DIFERENTE de "10:00" — a checagem por igualdade deixaria
     * passar — mas cai bem no meio da primeira.
     */
    const doDia = [evento({ hora: "10:00", duracaoMinutos: 30, titulo: "Bia" })];
    const erro = validar({ hora: "10:15", duracaoMinutos: 30 }, doDia);
    expect(erro).toContain("Bia");
  });

  test("uma consulta longa que ENGOLE outra já marcada é recusada", () => {
    /* Existe uma consulta às 10:30. Marcar das 10:00 às 11:00 (60 min) cobre
       o horário dela por dentro, mesmo começando antes. */
    const doDia = [evento({ hora: "10:30", duracaoMinutos: 20, titulo: "Bia" })];
    const erro = validar({ hora: "10:00", duracaoMinutos: 60 }, doDia);
    expect(erro).toContain("Bia");
  });

  test("faixas que só se ENCOSTAM não colidem", () => {
    /* Uma consulta das 10:00 às 10:30 e outra das 10:30 às 11:00: a segunda
       começa exatamente quando a primeira termina — não se sobrepõem. */
    const doDia = [evento({ hora: "10:00", duracaoMinutos: 30 })];
    expect(validar({ hora: "10:30", duracaoMinutos: 30 }, doDia)).toBeNull();
  });

  test("a mensagem de erro mostra a FAIXA da consulta que já está lá", () => {
    const doDia = [evento({ hora: "10:00", duracaoMinutos: 45, titulo: "Bia" })];
    const erro = validar({ hora: "10:20", duracaoMinutos: 15 }, doDia);
    expect(erro).toContain("10:00–10:45");
  });

  test("evento sem hora nunca colide — não há faixa para cruzar", () => {
    const doDia = [evento({ hora: null, firme: true })];
    expect(validar({ hora: "10:00" }, doDia)).toBeNull();
  });
});

describe("6. nada no passado", () => {
  /* Pedido do dono (ago/2026): "só tem que estar disponíveis os horários a
     partir da hora que a pessoa está acessando" — hoje o formulário deixava
     marcar consulta em qualquer dia e hora, inclusive num domingo que já
     tinha passado. */
  const AGORA_REAL = new Date("2026-08-10T14:00:00");

  test("um dia inteiro no passado é recusado, em qualquer hora dele", () => {
    const erro = validar({ dia: "2026-08-09", hora: "23:59" }, [], AGORA_REAL);
    expect(erro).toContain("passou");
  });

  test("hoje, uma hora que já passou é recusada", () => {
    const erro = validar({ dia: "2026-08-10", hora: "09:00" }, [], AGORA_REAL);
    expect(erro).toContain("passou");
  });

  test("hoje, uma hora ainda por vir passa", () => {
    expect(validar({ dia: "2026-08-10", hora: "15:00" }, [], AGORA_REAL)).toBeNull();
  });

  test("um dia no futuro passa, em qualquer hora", () => {
    expect(validar({ dia: "2026-08-11", hora: "00:00" }, [], AGORA_REAL)).toBeNull();
  });

  test("o minuto exato de agora ainda não passou", () => {
    /* `<`, e não `<=`: o instante em que ele clica "marcar" não pode virar
       "esse horário já passou" só porque o relógio bateu o mesmo minuto. */
    expect(validar({ dia: "2026-08-10", hora: "14:00" }, [], AGORA_REAL)).toBeNull();
  });
});
