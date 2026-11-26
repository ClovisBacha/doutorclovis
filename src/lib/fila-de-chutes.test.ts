import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  chaveDaFilaDeChutes,
  comSessao,
  ehLocal,
  mesclar,
  novoIdLocal,
  podarChutes,
  PREFIXO_LOCAL,
  semSessao,
  VALIDADE_DIAS,
  type SessaoPendente,
} from "@/lib/fila-de-chutes";
import { chaveDaSessaoDeChutes } from "@/lib/sessao-guardada";
import { chaveDaFila } from "@/lib/fila-de-contracoes";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * DUAS HORAS DE CONTAGEM NÃO SE PERDEM MAIS SEM REDE.
 *
 * ⚠️ O defeito: `stop()` fazia `insert` e ESPERAVA a resposta, no fim de até
 * duas horas deitada de lado. Sem rede saía um `toast.error` com a contagem
 * presa na tela esperando um dedo — e o que ela de fato faz depois de duas
 * horas é fechar o app. A sessão guardada vence em QUATRO horas, então a noite
 * em que o bebê se mexeu pouco simplesmente sumia até a manhã seguinte.
 */

const AGORA = Date.UTC(2026, 8, 11, 3, 0);
const p = (minAtras: number, tentativas = 0, kick = 10): SessaoPendente => ({
  id: `${PREFIXO_LOCAL}${minAtras}`,
  started_at: new Date(AGORA - minAtras * 60000).toISOString(),
  ended_at: new Date(AGORA - minAtras * 60000 + 20 * 60000).toISOString(),
  kick_count: kick,
  strength: 2,
  tentativas,
});

describe("a fila guarda a contagem que não subiu", () => {
  test("a chave leva o id da CONTA e não o prefixo da jornada", () => {
    const chave = chaveDaFilaDeChutes("abc");
    expect(chave).toContain("abc");
    /* ⚠️ `dc-path-` viaja no blob do `journey_state` e dispara um PUSH por
       gravação. */
    expect(chave.startsWith("dc-path-")).toBe(false);
  });

  test("nenhuma das três chaves é prefixo da outra", () => {
    /* ⚠️ A sessão EM CURSO e a fila são coisas diferentes e vivem lado a lado;
       e a fila das contrações é de outra tela. Uma varredura por prefixo que
       levasse duas juntas apagaria dado clínico — foi o que já custou uma volta
       no rascunho do story. */
    const chaves = [chaveDaFilaDeChutes("u"), chaveDaSessaoDeChutes("u"), chaveDaFila("u")];
    for (const a of chaves)
      for (const b of chaves) if (a !== b) expect(a.startsWith(b)).toBe(false);
  });

  test("o id local se distingue do id do banco", () => {
    expect(ehLocal(novoIdLocal(AGORA))).toBe(true);
    expect(ehLocal("9f1c2b7e-0000-4000-8000-000000000000")).toBe(false);
  });

  test("sai da fila em ordem CRESCENTE — é a ordem de quem sincroniza", () => {
    const lista = podarChutes([p(5), p(600), p(30)], AGORA);
    expect(lista.map((c) => c.id)).toEqual([
      `${PREFIXO_LOCAL}600`,
      `${PREFIXO_LOCAL}30`,
      `${PREFIXO_LOCAL}5`,
    ]);
  });

  test("o que passou da validade some, e o FUTURO também", () => {
    expect(podarChutes([p(VALIDADE_DIAS * 24 * 60 + 10), p(5)], AGORA)).toHaveLength(1);
    /* Relógio adiantado e depois corrigido deixaria uma pendente eterna. */
    expect(podarChutes([p(-600)], AGORA)).toHaveLength(0);
  });

  test("`comSessao` substitui em vez de duplicar", () => {
    const uma = comSessao([], p(5), AGORA);
    const outra = comSessao(uma, { ...p(5), strength: 1 }, AGORA);
    expect(outra).toHaveLength(1);
    expect(outra[0].strength).toBe(1);
  });

  test("`semSessao` tira só o alvo", () => {
    expect(semSessao([p(5), p(10)], `${PREFIXO_LOCAL}5`).map((c) => c.id)).toEqual([
      `${PREFIXO_LOCAL}10`,
    ]);
  });
});

describe("o que a lista mesclada mostra", () => {
  const doServidor = [
    { id: "real-1", started_at: new Date(AGORA - 30 * 60000).toISOString() },
    { id: "real-2", started_at: new Date(AGORA - 600 * 60000).toISOString() },
  ];

  test("a mesma contagem não aparece duas vezes", () => {
    const local: SessaoPendente = { ...p(30), started_at: doServidor[0].started_at };
    const lista = mesclar(doServidor, [local]);
    expect(lista).toHaveLength(2);
    expect(lista.some((c) => ehLocal(c.id))).toBe(false);
  });

  test("a pendente que ainda não subiu entra no TOPO", () => {
    /* É a contagem que ela acabou de encerrar — e a lista é decrescente. */
    const lista = mesclar(doServidor, [p(5)]);
    expect(lista).toHaveLength(3);
    expect(ehLocal(lista[0].id)).toBe(true);
  });

  test("sem nada do servidor, a lista é só o aparelho", () => {
    /* ⚠️ É o estado de "encerrei sem rede": sem a mesclagem, a tela diria
       "Nenhuma sessão registrada ainda" um segundo depois de ela ter contado
       por duas horas. */
    expect(mesclar([], [p(5), p(20)])).toHaveLength(2);
  });
});

describe("a forma do pacote", () => {
  test("um pacote SEM fim não entra na fila", () => {
    /* ⚠️ É a diferença desta fila para a das contrações, e ela é clínica: um
       pacote sem `ended_at` viraria uma linha ABERTA no banco, que chega ao
       prontuário como "Movimentos — 0 movimentos" — uma afirmação que nunca
       aconteceu. Lá a aberta é um estado legítimo; aqui a contagem em curso
       mora em `sessao-guardada.ts`. */
    const fonte = semComentarios(readFileSync("src/lib/fila-de-chutes.ts", "utf8"));
    const i = fonte.indexOf("function ehPendente");
    expect(i).toBeGreaterThan(0);
    const corpo = fonte.slice(i, fonte.indexOf("\n}", i));
    expect(corpo).toContain('typeof s.ended_at === "string"');
    expect(corpo).not.toContain("s.ended_at === null");
  });

  test("o mecanismo é o MÓDULO ÚNICO, e não uma segunda cópia", () => {
    /* ⚠️ Duas filas escritas à mão divergiriam no primeiro conserto, e a
       divergência apareceria como uma das duas perdendo dado clínico em
       silêncio — a fila que falha fica calada por construção. */
    for (const arq of ["src/lib/fila-de-chutes.ts", "src/lib/fila-de-contracoes.ts"]) {
      const fonte = semComentarios(readFileSync(arq, "utf8"));
      expect(fonte).toContain('from "@/lib/fila-local"');
      /* Nenhuma das duas volta a falar com o `localStorage` por conta própria. */
      expect(fonte).not.toContain("localStorage");
    }
  });
});

describe("a tela usa a fila nos lugares certos", () => {
  const TELA = semComentarios(readFileSync("src/components/kicks-tab.tsx", "utf8"));
  const corpoDe = (assinatura: string, ate: string) => {
    const i = TELA.indexOf(assinatura);
    expect(i).toBeGreaterThan(0);
    const f = TELA.indexOf(ate, i + assinatura.length);
    expect(f).toBeGreaterThan(i);
    return TELA.slice(i, f);
  };

  test("encerrar GRAVA NO APARELHO antes de tocar na rede", () => {
    /* ⚠️ A garantia: entre o encerramento e o pacote estar salvo não pode
       existir um `insert`. Era o único ponto de falha de até duas horas de
       contagem. */
    const corpo = corpoDe(
      "async function stop(finalCount = count) {",
      "async function sincronizar",
    );
    const gravou = corpo.indexOf("gravarFilaDeChutes(");
    expect(gravou).toBeGreaterThan(0);
    expect(corpo).not.toContain(".insert(");
    /* E a confirmação para ela não espera rede nenhuma. */
    expect(corpo.indexOf("toast.success")).toBeGreaterThan(gravou);
  });

  test("a segunda tentativa CONFERE antes de inserir", () => {
    /* `kick_sessions` não tem chave única: um insert que deu certo com a
       resposta perdida viraria DUAS noites de contagem no prontuário. */
    const corpo = corpoDe("async function sincronizar(", "const [corrigindo, setCorrigindo]");
    expect(corpo).toContain("pacote.tentativas > 0");
    expect(corpo).toContain('.eq("started_at", pacote.started_at)');
    /* E falha ao CONFERIR não insere: na dúvida, a contagem espera. */
    expect(corpo).toContain("if (erroConfere) continue;");
  });

  test("a rede voltando dispara a sincronização sozinha", () => {
    expect(TELA).toContain('window.addEventListener("online"');
    expect(TELA).toContain('window.removeEventListener("online"');
  });

  test("a pendente é corrigida e apagada NA FILA, nunca por id no banco", () => {
    /* ⚠️ Um `update`/`delete` por id local não casa linha nenhuma e devolve
       `error: null` (o PostgREST responde 204): a tela diria "pronto" sobre
       coisa nenhuma, e o que subiria depois seria o valor velho. */
    for (const [ass, ate] of [
      ["async function corrigirForca(", "async function apagarContagem("],
      ["async function apagarContagem(", "const relogio = relogioDeSessao("],
    ] as const) {
      const corpo = corpoDe(ass, ate);
      const local = corpo.indexOf("ehLocal(id)");
      expect(local).toBeGreaterThan(0);
      /* o ramo local devolve ANTES de qualquer ida ao banco */
      expect(local).toBeLessThan(corpo.indexOf('.from("kick_sessions")'));
      expect(corpo).toContain("gravarFilaDeChutes(");
    }
  });

  test("o que a lista desenha é a MESCLADA, e não só o servidor", () => {
    /* Sem isto a contagem encerrada sem rede não apareceria, e a tela diria
       "Nenhuma sessão registrada ainda" logo depois de duas horas contando. */
    expect(TELA).toContain("const todas = mesclar(history, pendentes)");
    expect(TELA).toContain("serieDeChutes(todas)");
    expect(TELA).toContain("ultimaContagem(todas)");
    expect(TELA).toContain("todas.slice(0, LINHAS_NO_HISTORICO)");
  });

  test("o toque a mais tem desfazer, e ele REESCREVE a sessão guardada", () => {
    /* ⚠️ O erro do contador de toque empurra para o lado de TRANQUILIZAR: a
       contagem inflada fecha os dez mais cedo. E sem reescrever o pacote
       guardado, trocar de aba traria o valor inflado de volta — que é o defeito
       que `sessao-guardada.ts` existe para não ter. */
    const i = TELA.indexOf("const anterior = count - 1;");
    expect(i).toBeGreaterThan(0);
    const corpo = TELA.slice(i, i + 260);
    expect(corpo).toContain("setCount(anterior)");
    expect(corpo).toContain("count: anterior");
    expect(corpo).toContain("guardarSessao(");
  });
});
