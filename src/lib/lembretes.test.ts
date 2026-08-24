/**
 * O LEMBRETE NÃO PODE CHEGAR DUAS VEZES.
 *
 * O risco deste arquivo não é esquecer de mandar: é mandar de hora em hora. Um
 * cron que roda a cada hora passa muitas vezes pela mesma consulta, e "sua
 * consulta é amanhã" repetido vinte vezes faz a paciente desligar as
 * notificações do app — que é o mesmo canal por onde chega a emergência.
 */

import { describe, expect, test } from "bun:test";
import {
  chaveDoLembrete,
  comoDizerQuando,
  lembretesVencidos,
  textoDoLembrete,
  type Compromisso,
} from "./lembretes";

const AGORA = new Date("2026-08-20T12:00:00Z");
const daquiA = (horas: number) => new Date(AGORA.getTime() + horas * 3600_000).toISOString();

const consulta = (p: Partial<Compromisso> = {}): Compromisso => ({
  id: "c1",
  fonte: "consulta",
  quando: daquiA(20),
  email: "ana@exemplo.com",
  userId: "u1",
  nome: "Ana Paula",
  ...p,
});

const nada = new Set<string>();

describe("1. quando o lembrete vence", () => {
  test("faltando 20 h, sai o de 24 h", () => {
    const r = lembretesVencidos([consulta()], AGORA, nada);
    expect(r).toHaveLength(1);
    expect(r[0].especie).toBe("24h");
  });

  test("faltando 30 h, sai o PEDIDO DE PRÉ-CONSULTA", () => {
    /* Era "não sai nada" até a pré-consulta entrar na mesma escada. Dois dias
       antes é quando responder ainda muda a consulta: ele lê antes de ela
       chegar. */
    const r = lembretesVencidos([consulta({ quando: daquiA(30) })], AGORA, nada);
    expect(r).toHaveLength(1);
    expect(r[0].especie).toBe("48h_pre");
  });

  test("faltando 60 h, ainda não sai nada", () => {
    expect(lembretesVencidos([consulta({ quando: daquiA(60) })], AGORA, nada)).toEqual([]);
  });

  test("a pré-consulta JÁ RESPONDIDA não é pedida de novo", () => {
    /**
     * Pedir o que ela acabou de mandar é a forma mais rápida de ensinar que os
     * avisos deste app não valem leitura — e é o mesmo canal por onde chega a
     * emergência.
     */
    expect(
      lembretesVencidos([consulta({ quando: daquiA(30), preConsultaPronta: true })], AGORA, nada),
    ).toEqual([]);
  });

  test("sem conta no app, a pré-consulta não é pedida — nem por e-mail", () => {
    /* O formulário existe DENTRO do app. Um e-mail pedindo que ela abra uma
       tela que não pode abrir é pior que silêncio. */
    expect(
      lembretesVencidos([consulta({ quando: daquiA(30), userId: null })], AGORA, nada),
    ).toEqual([]);
  });

  test("mas o lembrete de 24 h ainda vai por e-mail para quem não tem app", () => {
    /* A escada não pode calar as outras espécies junto: quem não tem conta
       continua sendo lembrada da consulta. */
    const r = lembretesVencidos([consulta({ quando: daquiA(20), userId: null })], AGORA, nada);
    expect(r).toHaveLength(1);
    expect(r[0].especie).toBe("24h");
  });

  test("faltando 3 h, sai o de 4 h — e só ele", () => {
    /**
     * Esta é a regra que evita o aviso duplo. Faltando 3 h, "faltam 24 h ou
     * menos" também é verdade: avaliadas soltas, as duas espécies disparariam
     * juntas numa consulta marcada de véspera, e a paciente receberia dois
     * avisos no mesmo minuto dizendo a mesma coisa.
     */
    const r = lembretesVencidos([consulta({ quando: daquiA(3) })], AGORA, nada);
    expect(r).toHaveLength(1);
    expect(r[0].especie).toBe("4h");
  });

  test("a janela é ABERTA: cron atrasado manda tarde, e não deixa de mandar", () => {
    /**
     * "Mandar quando faltar exatamente 24 h" perde a consulta toda vez que o
     * cron atrasa — e a ausência de um lembrete não deixa rastro nenhum. Com
     * "24 h ou menos", faltando 5 h e sem nada enviado, o aviso ainda sai.
     */
    const r = lembretesVencidos([consulta({ quando: daquiA(5) })], AGORA, nada);
    expect(r).toHaveLength(1);
    expect(r[0].especie).toBe("24h");
  });
});

describe("2. o que NÃO vira lembrete", () => {
  test("consulta que já começou", () => {
    /* "Sua consulta é em -20 minutos" é pior que não chegar nada. */
    expect(lembretesVencidos([consulta({ quando: daquiA(-1) })], AGORA, nada)).toEqual([]);
  });

  test("consulta acontecendo AGORA, no minuto exato", () => {
    expect(lembretesVencidos([consulta({ quando: AGORA.toISOString() })], AGORA, nada)).toEqual([]);
  });

  test("data podre", () => {
    expect(lembretesVencidos([consulta({ quando: "abacaxi" })], AGORA, nada)).toEqual([]);
  });

  test("sem e-mail E sem conta no app", () => {
    /**
     * Não há canal. Sair na lista faria o chamador gravar "enviado" para quem
     * não recebeu nada — e o lembrete nunca mais sairia, nem depois de ela
     * cadastrar o e-mail.
     */
    expect(lembretesVencidos([consulta({ email: null, userId: null })], AGORA, nada)).toEqual([]);
  });

  test("só e-mail, ou só conta, basta", () => {
    expect(lembretesVencidos([consulta({ userId: null })], AGORA, nada)).toHaveLength(1);
    expect(lembretesVencidos([consulta({ email: null })], AGORA, nada)).toHaveLength(1);
  });
});

describe("3. não repetir — o ponto do arquivo", () => {
  test("o que já foi enviado não sai de novo", () => {
    const c = consulta();
    const enviados = new Set([chaveDoLembrete(c, "24h")]);
    expect(lembretesVencidos([c], AGORA, enviados)).toEqual([]);
  });

  test("mas o de 4 h AINDA sai, mesmo com o de 24 h já enviado", () => {
    /* São dois avisos diferentes, e o segundo é o que de fato evita a falta. */
    const c = consulta({ quando: daquiA(3) });
    const enviados = new Set([chaveDoLembrete(c, "24h")]);
    const r = lembretesVencidos([c], AGORA, enviados);
    expect(r).toHaveLength(1);
    expect(r[0].especie).toBe("4h");
  });

  test("as três espécies são independentes na escada", () => {
    /**
     * A pré-consulta já pedida não impede o lembrete de 24 h: são avisos
     * diferentes, com propósitos diferentes. Um `jaEnviados` que casasse por
     * compromisso, e não por (compromisso, espécie), calaria os dois seguintes.
     */
    const c = consulta({ quando: daquiA(20) });
    const enviados = new Set([chaveDoLembrete(c, "48h_pre")]);
    const r = lembretesVencidos([c], AGORA, enviados);
    expect(r).toHaveLength(1);
    expect(r[0].especie).toBe("24h");
  });

  test("a chave separa fonte, linha e espécie", () => {
    /**
     * Sem a fonte na chave, a consulta `abc` e a teleconsulta `abc` — ids de
     * tabelas diferentes podem coincidir — silenciariam uma à outra.
     */
    expect(chaveDoLembrete({ fonte: "consulta", id: "abc" }, "24h")).toBe("consulta:abc:24h");
    expect(chaveDoLembrete({ fonte: "teleconsulta", id: "abc" }, "24h")).toBe(
      "teleconsulta:abc:24h",
    );
    expect(chaveDoLembrete({ fonte: "consulta", id: "abc" }, "4h")).toBe("consulta:abc:4h");
  });
});

describe("4. a ordem do lote", () => {
  test("o mais urgente primeiro", () => {
    /* Se o lote for cortado por tempo de execução, o que sobra para a próxima
       rodada tem de ser o menos urgente. */
    const r = lembretesVencidos(
      [
        consulta({ id: "longe", quando: daquiA(20) }),
        consulta({ id: "perto", quando: daquiA(2) }),
        consulta({ id: "meio", quando: daquiA(10) }),
      ],
      AGORA,
      nada,
    );
    expect(r.map((x) => x.compromisso.id)).toEqual(["perto", "meio", "longe"]);
  });
});

describe("5. o texto", () => {
  test("o de 24 h chama para confirmar; o de 4 h não", () => {
    /* Confirmar de véspera ainda dá tempo de a vaga ir para a fila de espera.
       Faltando três horas, pedir confirmação só serve para assustar. */
    const vinteQuatro = lembretesVencidos([consulta()], AGORA, nada)[0];
    expect(textoDoLembrete(vinteQuatro, "14:30").corpo).toContain("Confirme");

    const quatro = lembretesVencidos([consulta({ quando: daquiA(3) })], AGORA, nada)[0];
    expect(textoDoLembrete(quatro, "14:30").corpo).not.toContain("Confirme");
  });

  test("o pedido de pré-consulta diz o que responder, e onde", () => {
    /* "Preencha a pré-consulta" não diz nada a quem nunca viu a tela. Pressão,
       peso e como ela tem se sentido é o que de fato muda a consulta. */
    const l = lembretesVencidos([consulta({ quando: daquiA(30) })], AGORA, nada)[0];
    const t = textoDoLembrete(l, "14:30");
    expect(t.corpo).toContain("no app");
    expect(t.corpo).toContain("pressão");
  });

  test("teleconsulta diz que o link abre no app", () => {
    const l = lembretesVencidos(
      [consulta({ fonte: "teleconsulta", quando: daquiA(2) })],
      AGORA,
      nada,
    )[0];
    expect(textoDoLembrete(l, "14:30").corpo).toContain("link");
  });

  test("usa o PRIMEIRO nome, e não quebra sem nome", () => {
    const l = lembretesVencidos([consulta({ nome: "Ana Paula da Silva" })], AGORA, nada)[0];
    expect(textoDoLembrete(l, "14:30").corpo).toContain("Ana,");
    const sem = lembretesVencidos([consulta({ nome: null })], AGORA, nada)[0];
    expect(() => textoDoLembrete(sem, "14:30")).not.toThrow();
  });

  test("o jeito de dizer quando muda com a distância", () => {
    expect(comoDizerQuando(20 * 60, "14:30")).toBe("amanhã às 14:30");
    expect(comoDizerQuando(5 * 60, "14:30")).toBe("hoje às 14:30");
    expect(comoDizerQuando(180, "14:30")).toBe("hoje às 14:30");
    /* Perto demais para o relógio ajudar. Abaixo daqui, "às 14:30" para de ser
       informação e vira pressa. */
    expect(comoDizerQuando(30, "14:30")).toBe("daqui a pouco");
    expect(comoDizerQuando(90, "14:30")).toBe("daqui a pouco");
    expect(comoDizerQuando(91, "14:30")).toBe("hoje às 14:30");
  });
});
