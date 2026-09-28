import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  chaveDaFila,
  comPacote,
  ehLocal,
  mesclar,
  podar,
  PREFIXO_LOCAL,
  prontasParaSubir,
  semPacote,
  VALIDADE_DIAS,
  type ContracaoPendente,
} from "@/lib/fila-de-contracoes";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * A CONTRAÇÃO NÃO SE PERDE SEM REDE.
 *
 * ⚠️ O defeito: `startContraction` fazia `insert` e ESPERAVA a resposta. Sem
 * rede saía um toast e a contração não existia — no carro a caminho da
 * maternidade, no elevador do hospital, no quarto dos fundos. E com rede o
 * cronômetro só partia depois da latência.
 */

const AGORA = Date.UTC(2026, 8, 11, 3, 0);
const p = (minAtras: number, ended = true, tentativas = 0): ContracaoPendente => ({
  id: `${PREFIXO_LOCAL}${minAtras}`,
  started_at: new Date(AGORA - minAtras * 60000).toISOString(),
  ended_at: ended ? new Date(AGORA - minAtras * 60000 + 60000).toISOString() : null,
  intensity: 2,
  tentativas,
});

describe("a fila guarda o que não subiu", () => {
  test("a chave leva o id da CONTA e não o prefixo da jornada", () => {
    const chave = chaveDaFila("abc");
    expect(chave).toContain("abc");
    /* ⚠️ `dc-path-` viaja no blob do `journey_state` e dispara um PUSH por
       gravação — e aqui a gravação acontece a cada toque, em trabalho de
       parto. */
    expect(chave.startsWith("dc-path-")).toBe(false);
  });

  test("o id local se distingue do id do banco", () => {
    expect(ehLocal(`${PREFIXO_LOCAL}123`)).toBe(true);
    expect(ehLocal("9f1c2b7e-0000-4000-8000-000000000000")).toBe(false);
  });

  test("sai da fila em ordem CRESCENTE", () => {
    /* Quem sincroniza insere na ordem em que aconteceram; fora de ordem, o
       intervalo entre contrações sairia negativo em alguma linha. */
    const lista = podar([p(5), p(60), p(30)], AGORA);
    expect(lista.map((c) => c.id)).toEqual([
      `${PREFIXO_LOCAL}60`,
      `${PREFIXO_LOCAL}30`,
      `${PREFIXO_LOCAL}5`,
    ]);
  });

  test("o que passou da validade some", () => {
    const velha = p(VALIDADE_DIAS * 24 * 60 + 10);
    expect(podar([velha, p(5)], AGORA)).toHaveLength(1);
  });

  test("instante no FUTURO também vence", () => {
    /* Relógio adiantado e depois corrigido deixaria uma pendente eterna. */
    const futura = p(-600);
    expect(podar([futura], AGORA)).toHaveLength(0);
  });

  test("`comPacote` substitui em vez de duplicar", () => {
    const inicial = comPacote([], p(5, false), AGORA);
    const fechada = comPacote(inicial, p(5, true), AGORA);
    expect(fechada).toHaveLength(1);
    expect(fechada[0].ended_at).not.toBeNull();
  });

  test("`semPacote` tira só o alvo", () => {
    expect(semPacote([p(5), p(10)], `${PREFIXO_LOCAL}5`).map((c) => c.id)).toEqual([
      `${PREFIXO_LOCAL}10`,
    ]);
  });
});

describe("só a contração ENCERRADA sobe", () => {
  test("a em curso fica", () => {
    /* Uma linha sem `ended_at` no banco é exatamente o que a tela retoma como
       "contração aberta": subir cedo faria outro carregamento ressuscitar uma
       contração que já acabou. */
    const prontas = prontasParaSubir([p(5, false), p(30, true)]);
    expect(prontas).toHaveLength(1);
    expect(prontas[0].id).toBe(`${PREFIXO_LOCAL}30`);
  });
});

describe("mesclar o aparelho com o servidor", () => {
  const doServidor = [
    { id: "real-1", started_at: new Date(AGORA - 30 * 60000).toISOString() },
    { id: "real-2", started_at: new Date(AGORA - 60 * 60000).toISOString() },
  ];

  test("a mesma contração não aparece duas vezes", () => {
    /* Entre o `insert` dar certo e o `load()` responder, ela existe nos dois
       lugares — e o `started_at` é a chave natural. */
    const local: ContracaoPendente = { ...p(30), started_at: doServidor[0].started_at };
    const lista = mesclar(doServidor, [local]);
    expect(lista).toHaveLength(2);
    expect(lista.some((c) => ehLocal(c.id))).toBe(false);
  });

  test("quem vence é a do SERVIDOR — ela tem o id de verdade", () => {
    const local: ContracaoPendente = { ...p(30), started_at: doServidor[0].started_at };
    const lista = mesclar(doServidor, [local]);
    expect(lista.map((c) => c.id)).toContain("real-1");
  });

  test("a pendente que ainda não subiu aparece", () => {
    const lista = mesclar(doServidor, [p(5)]);
    expect(lista).toHaveLength(3);
    /* ⚠️ E ela entra no TOPO, porque a lista é decrescente e ela é a mais
       recente — é a contração que ela acabou de cronometrar. */
    expect(ehLocal(lista[0].id)).toBe(true);
  });

  test("sem nada do servidor, a lista é só o aparelho", () => {
    /* É o estado de "não consegui carregar": o que ela cronometrou continua na
       tela, e a análise continua rodando sobre ele. */
    const lista = mesclar([], [p(5), p(20)]);
    expect(lista).toHaveLength(2);
  });
});

describe("a tela usa a fila nos lugares certos", () => {
  const TELA = semComentarios(readFileSync("src/components/contracoes-tab.tsx", "utf8"));

  test("iniciar NÃO espera a rede", () => {
    /* A função era `async` e fazia `insert` antes de o cronômetro partir. */
    expect(TELA).toContain("function startContraction()");
    const i = TELA.indexOf("function startContraction()");
    const corpo = TELA.slice(i, TELA.indexOf("\n  async function", i));
    expect(corpo).not.toContain("await");
    expect(corpo).not.toContain(".insert(");
    expect(corpo).toContain("gravarFila");
  });

  test("apagar o histórico limpa a fila junto", () => {
    /* Sem isto as pendentes SUBIRIAM depois, ressuscitando no banco o que ela
       mandou apagar. */
    const i = TELA.indexOf("async function clearSession()");
    const corpo = TELA.slice(i, i + 1400);
    expect(corpo).toContain("gravarFila(idDaConta, [])");
  });

  test("a segunda tentativa CONFERE antes de inserir", () => {
    /* `contraction_logs` não tem chave única: um insert que deu certo com a
       resposta perdida viraria uma contração duplicada no mesmo instante, e
       duas no mesmo minuto deslocam o INTERVALO. */
    const i = TELA.indexOf("async function sincronizar(");
    const corpo = TELA.slice(i, TELA.indexOf("\n  async function load()", i));
    expect(corpo).toContain("pacote.tentativas > 0");
    expect(corpo).toContain('.eq("started_at", pacote.started_at)');
    /* E falha ao CONFERIR não insere. */
    expect(corpo).toContain("if (erroConfere) continue;");
  });

  test("a rede voltando dispara a sincronização", () => {
    expect(TELA).toContain('window.addEventListener("online"');
    expect(TELA).toContain('window.removeEventListener("online"');
  });
});
