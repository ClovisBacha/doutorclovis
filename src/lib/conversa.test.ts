/**
 * A CONVERSA, MEDIDA.
 *
 * As três travas contra assédio são o que este arquivo guarda. Nenhuma delas é
 * enfeite: caixa de entrada aberta a desconhecidos, numa base de gestantes de
 * alto risco, é o desenho que transforma um recurso de afeto numa porta de
 * perseguição.
 */

import { describe, expect, test } from "bun:test";
import {
  MENSAGENS_ANTES_DE_ACEITAR,
  minhaColunaDeLeitura,
  parOrdenado,
  podeEnviar,
  podeIniciarConversa,
  previaDaMensagem,
  temNaoLida,
} from "./conversa";

const EU = "aaa";
const ELA = "zzz";

const iniciar = (v: Partial<Parameters<typeof podeIniciarConversa>[0]> = {}) =>
  podeIniciarConversa({
    euId: EU,
    alvoId: ELA,
    temBloqueio: false,
    alcancaOPerfil: true,
    alvoMeSegue: false,
    ...v,
  });

describe("⚠️ trava 1 — só quem alcança o perfil escreve", () => {
  test("perfil fora de alcance recusa", () => {
    /* Quem não consegue nem abrir o perfil dela não pode aparecer na caixa de
       entrada dela. É a MESMA régua de `alcancaOPerfil`, de propósito. */
    expect(iniciar({ alcancaOPerfil: false })).toEqual({
      pode: false,
      motivo: "fora_de_alcance",
    });
  });

  test("⚠️ o bloqueio vem ANTES do alcance, e o motivo não conta a diferença", () => {
    /* Quem bloqueou pode continuar com perfil público; responder "fora de
       alcance" ali revelaria que o bloqueio existe. */
    expect(iniciar({ temBloqueio: true, alcancaOPerfil: true })).toEqual({
      pode: false,
      motivo: "bloqueio",
    });
    expect(iniciar({ temBloqueio: true, alcancaOPerfil: false })).toEqual({
      pode: false,
      motivo: "bloqueio",
    });
  });

  test("ninguém puxa conversa consigo mesma", () => {
    expect(iniciar({ alvoId: EU })).toEqual({ pode: false, motivo: "eu_mesma" });
  });
});

describe("⚠️ trava 2 — se ela não me segue, é pedido", () => {
  test("desconhecida cai na caixa de pedidos", () => {
    expect(iniciar({ alvoMeSegue: false })).toEqual({ pode: true, comoPedido: true });
  });

  test("quem já me segue abre conversa direta", () => {
    expect(iniciar({ alvoMeSegue: true })).toEqual({ pode: true, comoPedido: false });
  });
});

describe("⚠️ trava 3 — UMA mensagem até ser aceito", () => {
  const enviar = (v: Partial<Parameters<typeof podeEnviar>[0]> = {}) =>
    podeEnviar({
      souODono: true,
      aceita: false,
      euIniciei: true,
      minhasMensagens: 0,
      temBloqueio: false,
      ...v,
    });

  test("a primeira passa; a segunda espera o aceite", () => {
    /* É a trava que o Instagram não tem: lá dá para encher a caixa de
       solicitações. Aqui, quem pediu escreve uma e espera. */
    expect(enviar({ minhasMensagens: 0 }).pode).toBe(true);
    expect(enviar({ minhasMensagens: MENSAGENS_ANTES_DE_ACEITAR })).toEqual({
      pode: false,
      motivo: "aguardando_aceite",
    });
    expect(enviar({ minhasMensagens: 7 }).pode).toBe(false);
  });

  test("⚠️ QUEM RECEBEU O PEDIDO RESPONDE SEM ACEITAR FORMALMENTE", () => {
    /* Responder É aceitar. Obrigar dois toques faria a paciente escrever e a
       mensagem não sair — o pior desfecho possível numa caixa de entrada. */
    expect(enviar({ euIniciei: false, minhasMensagens: 0 }).pode).toBe(true);
    expect(enviar({ euIniciei: false, minhasMensagens: 5 }).pode).toBe(true);
  });

  test("aceita libera os dois lados", () => {
    expect(enviar({ aceita: true, minhasMensagens: 99 }).pode).toBe(true);
  });

  test("bloqueio fecha mesmo em conversa aceita", () => {
    expect(enviar({ aceita: true, temBloqueio: true })).toEqual({
      pode: false,
      motivo: "bloqueio",
    });
  });

  test("quem não é das duas pontas não escreve", () => {
    expect(enviar({ souODono: false, aceita: true })).toEqual({
      pode: false,
      motivo: "nao_e_minha",
    });
  });
});

describe("⚠️ o par ordenado", () => {
  test("(A,B) e (B,A) são a MESMA conversa", () => {
    /* Sem isto, duas pessoas que se escrevem ao mesmo tempo criam duas
       conversas, cada uma vê a sua, e as mensagens da outra somem. */
    expect(parOrdenado("zzz", "aaa")).toEqual(parOrdenado("aaa", "zzz"));
    expect(parOrdenado("zzz", "aaa")).toEqual({ a: "aaa", b: "zzz" });
  });

  test("a coluna de leitura segue o lado do par", () => {
    expect(minhaColunaDeLeitura("aaa", "aaa")).toBe("lida_a");
    expect(minhaColunaDeLeitura("zzz", "aaa")).toBe("lida_b");
  });
});

describe("o não lido", () => {
  const base = { ultimaEm: "2026-08-24T10:00:00Z", minhaLeitura: null, ultimoAutor: ELA, euId: EU };

  test("nunca vi: é não lida", () => {
    expect(temNaoLida(base)).toBe(true);
  });

  test("⚠️ a MINHA mensagem nunca conta como não lida", () => {
    /* Sem esta regra o emblema acende no instante em que ela manda, e o número
       perde o sentido na primeira mensagem enviada. */
    expect(temNaoLida({ ...base, ultimoAutor: EU })).toBe(false);
    expect(temNaoLida({ ...base, ultimoAutor: EU, minhaLeitura: null })).toBe(false);
  });

  test("li depois da última: não há novidade", () => {
    expect(temNaoLida({ ...base, minhaLeitura: "2026-08-24T11:00:00Z" })).toBe(false);
    expect(temNaoLida({ ...base, minhaLeitura: "2026-08-24T09:00:00Z" })).toBe(true);
  });

  test("conversa sem mensagem não acende nada", () => {
    expect(temNaoLida({ ...base, ultimaEm: null })).toBe(false);
  });
});

describe("a prévia da lista", () => {
  test("⚠️ apagada vira aviso, e NÃO some da lista", () => {
    /* Uma conversa que perde a última linha e volta a mostrar a anterior faz a
       paciente achar que a mensagem que ela viu chegar não existiu. */
    expect(previaDaMensagem("qualquer coisa", true)).toBe("Mensagem apagada");
  });

  test("corta sem quebrar, e junta as quebras de linha", () => {
    expect(previaDaMensagem("oi\n\n  tudo   bem?", false)).toBe("oi tudo bem?");
    const longa = "a".repeat(200);
    expect(previaDaMensagem(longa, false, 10)).toBe("aaaaaaaaa…");
    expect(previaDaMensagem(longa, false, 10).length).toBe(10);
  });

  test("vazia não vira reticências soltas", () => {
    expect(previaDaMensagem(null, false)).toBe("");
    expect(previaDaMensagem("   ", false)).toBe("");
  });
});
