/**
 * MARCAR CONSULTA NO DIA — a régua, antes da tela.
 *
 * O calendário deixou de ser só leitura: o médico clica num dia e marca. As
 * duas formas de isso dar errado são caras e silenciosas — duas pacientes no
 * mesmo horário, e um aviso mandado para um e-mail que não existe.
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
  ...p,
});

const base = {
  dia: "2026-08-20",
  tipo: "presencial" as const,
  nome: "Maria Silva",
  email: "maria@exemplo.com",
  hora: "09:00",
  pacienteId: null,
};

describe("1. o choque de horário", () => {
  test("recusa quando já existe compromisso naquela hora — e diz com quem", () => {
    /**
     * O servidor recusaria de qualquer jeito (índice único do slot). Isto aqui
     * existe para ele ver o NOME de quem já está no horário, agora, em vez de
     * receber "horário ocupado" meio segundo depois e sem saber de quem.
     */
    const erro = validarNovaConsulta({ ...base, hora: "14:00" }, [evento({})]);
    expect(erro).toContain("Ana");
    expect(erro).toContain("14:00");
  });

  test("horário livre no mesmo dia passa", () => {
    expect(validarNovaConsulta({ ...base, hora: "15:00" }, [evento({})])).toBeNull();
  });

  test("uma PREFERÊNCIA não ocupa horário", () => {
    /**
     * Pedido sem confirmar e consulta particular sem hora combinada entram no
     * calendário com `firme: false` — são lembretes, não compromissos. Deixá-los
     * bloquear o horário faria o médico não conseguir marcar em cima de um
     * "quem sabe" que ele mesmo nunca aceitou.
     */
    const erro = validarNovaConsulta({ ...base, hora: "14:00" }, [evento({ firme: false })]);
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
    const erro = validarNovaConsulta({ ...base, tipo: "teleconsulta" }, []);
    expect(erro).toContain("paciente do app");
  });

  test("com `pacienteId` passa", () => {
    expect(
      validarNovaConsulta({ ...base, tipo: "teleconsulta", pacienteId: "abc" }, []),
    ).toBeNull();
  });

  test("presencial NÃO exige paciente do app — é o caminho de quem não tem conta", () => {
    /* "a pessoa não pode estar cadastrada no aplicativo, mas a gente faz essa
       intermediação" (dono, ago/2026). */
    expect(validarNovaConsulta({ ...base, pacienteId: null }, [])).toBeNull();
  });
});

describe("3. quem e quando", () => {
  test("nome vazio ou de uma letra não passa", () => {
    expect(validarNovaConsulta({ ...base, nome: "" }, [])).toContain("nome");
    expect(validarNovaConsulta({ ...base, nome: "  A " }, [])).toContain("nome");
  });

  test("e-mail em branco passa QUANDO é paciente do app", () => {
    /**
     * O e-mail dela mora em `auth.users`, que a tela não enxerga: nenhuma lista
     * do painel o carrega. Exigir aqui obrigaria o médico a digitar de cabeça o
     * e-mail de quem já está cadastrada — é assim que se erra um caractere e se
     * manda a confirmação para o vazio. Quem resolve é o servidor.
     */
    expect(validarNovaConsulta({ ...base, email: "", pacienteId: "abc" }, [])).toBeNull();
  });

  test("e-mail em branco NÃO passa para quem não tem conta", () => {
    /* Aí o e-mail é a única forma de avisar. Deixar passar criaria a consulta
       que a pessoa nunca fica sabendo que existe. */
    const erro = validarNovaConsulta({ ...base, email: "", pacienteId: null }, []);
    expect(erro).toContain("e-mail");
  });

  test("e-mail ERRADO não passa nem para paciente do app", () => {
    /* O em-branco é o caso de "deixa o servidor resolver". Um endereço digitado
       pela metade é outra coisa: ele quis escrever e errou. */
    expect(validarNovaConsulta({ ...base, email: "maria@", pacienteId: "abc" }, [])).toContain(
      "e-mail",
    );
  });

  test("e-mail sem cara de e-mail não passa — é por ele que o aviso vai", () => {
    expect(validarNovaConsulta({ ...base, email: "maria" }, [])).toContain("e-mail");
    expect(validarNovaConsulta({ ...base, email: "maria@" }, [])).toContain("e-mail");
    expect(validarNovaConsulta({ ...base, email: "maria@exemplo" }, [])).toContain("e-mail");
  });

  test("espaço em volta não invalida nada", () => {
    /* Colar do WhatsApp traz espaço junto. Recusar por isso seria uma consulta
       não marcada por um caractere invisível. */
    expect(
      validarNovaConsulta({ ...base, email: "  maria@exemplo.com ", nome: " Maria " }, []),
    ).toBeNull();
  });

  test("hora impossível não passa", () => {
    expect(validarNovaConsulta({ ...base, hora: "25:00" }, [])).toContain("horário");
    expect(validarNovaConsulta({ ...base, hora: "9:00" }, [])).toContain("horário");
    expect(validarNovaConsulta({ ...base, hora: "" }, [])).toContain("horário");
  });

  test("a virada do dia é hora válida", () => {
    /* `00:00` e `23:59` existem. Um regex de `[0-2]\\d` deixaria passar 29:00 e
       um de `[1-2]\\d` recusaria a meia-noite. */
    expect(validarNovaConsulta({ ...base, hora: "00:00" }, [])).toBeNull();
    expect(validarNovaConsulta({ ...base, hora: "23:59" }, [])).toBeNull();
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
