/**
 * A CAMADA DE GRAVAÇÃO, MEDIDA.
 *
 * O teste que justifica o arquivo existir é o do cruzamento: uma gravação NÃO
 * emenda sozinha, e o degrau na volta do laço é audível como um estalo a cada
 * repetição. Aqui ele é MEDIDO antes e depois — não afirmado.
 */

import { describe, expect, test } from "bun:test";
import { GRAVADOS, carregarGravado, fecharLaco, temGravacao } from "./som-gravado";
import { SONS_CONTINUOS } from "./som-receitas";

const TAXA = 22050;

/**
 * Senoide COM DERIVA DE NÍVEL — o que uma gravação de campo de verdade tem.
 *
 * ⚠️ A primeira versão era uma senoide pura, e o teste falhou por uma razão que
 * vale registrar: o degrau dela caiu em 0,049 POR ACASO, conforme a fase batia
 * no fim do arquivo. Uma fixture cujo pior caso depende de sorte não prova
 * nada. A deriva (a captação fica mais alta ao longo dos minutos, porque o
 * vento aumenta ou o bicho chega perto) garante um degrau grande e é o motivo
 * REAL de gravação não emendar.
 */
function senoideQueNaoFecha(segundos: number, hz = 220): Float32Array<ArrayBuffer> {
  const n = Math.floor(TAXA * segundos);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / TAXA + 0.7) + 0.5 * (i / n);
  }
  return x;
}

/** O salto entre o último quadro e o primeiro — o que o ouvido ouve na volta. */
function degrauDaVolta(x: Float32Array): number {
  return Math.abs(x[0] - x[x.length - 1]);
}

describe("o cruzamento que fecha o laço", () => {
  test("⚠️ o degrau da volta DIMINUI — medido, não afirmado", () => {
    const cru = senoideQueNaoFecha(10);
    const antes = degrauDaVolta(cru);
    const depois = degrauDaVolta(fecharLaco(cru, TAXA));
    /* Sem isto o arquivo estala a cada volta. A senoide escolhida tem degrau
       grande de propósito: é o caso que uma gravação de campo produz. */
    expect(antes).toBeGreaterThan(0.05);
    expect(depois).toBeLessThan(antes / 5);
  });

  test("o trecho encurta pelo tamanho do cruzamento, e nunca fica vazio", () => {
    const cru = senoideQueNaoFecha(10);
    const saida = fecharLaco(cru, TAXA);
    expect(saida.length).toBeLessThan(cru.length);
    /* ⚠️ Encurtar demais seria pior que a emenda: um laço de meio segundo é
       reconhecível na hora. O cruzamento é 15% com teto de 1,5 s. */
    expect(saida.length).toBeGreaterThan(cru.length * 0.8);
  });

  test("⚠️ o cruzamento tem TETO — numa gravação longa não vira eco", () => {
    /* Proporcional puro daria 9 s de cruzamento num arquivo de 60 s: o mesmo
       som tocando duas vezes, defasado. */
    const longa = senoideQueNaoFecha(60);
    const cortado = longa.length - fecharLaco(longa, TAXA).length;
    expect(cortado).toBeLessThanOrEqual(Math.floor(TAXA * 1.5));
  });

  test("⚠️ arquivo curto demais volta INTEIRO, sem se comer", () => {
    const curtinha = senoideQueNaoFecha(0.2);
    expect(fecharLaco(curtinha, TAXA).length).toBe(curtinha.length);
  });

  test("não devolve NaN — um só contamina o buffer inteiro", () => {
    const saida = fecharLaco(senoideQueNaoFecha(10), TAXA);
    expect(saida.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("o catálogo adormecido", () => {
  /* ⚠️ ESTE TESTE É O CONTRATO DE SEGURANÇA DA MUDANÇA INTEIRA.
     Enquanto não houver arquivo nenhum, o app tem de se comportar EXATAMENTE
     como antes — nenhum som pode passar a depender de rede. */
  test("sem arquivo registrado, nenhum som se diz gravado", () => {
    for (const k of SONS_CONTINUOS) expect(temGravacao(k)).toBe(false);
  });

  test("⚠️ toda entrada futura precisa de caminho E de ganho medido", () => {
    /* Um ganho ausente cairia no `?? 1` e desfaria a igualação de nível que
       custou uma rodada de medição (34,1 dB → 9,7 dB de espalhamento). */
    for (const [k, v] of Object.entries(GRAVADOS)) {
      expect({ k, ok: typeof v?.arquivo === "string" && v.arquivo.length > 0 }).toEqual({
        k,
        ok: true,
      });
      expect({ k, ok: typeof v?.ganho === "number" && v!.ganho > 0 && v!.ganho < 50 }).toEqual({
        k,
        ok: true,
      });
    }
  });

  test("⚠️ o arquivo mora em /sons/, fora do grafo do bundler", () => {
    /* Em `src/assets` o Vite carimba hash no nome, e o cache de áudio do
       service worker (sem versão, para 16 MB de voz não caírem a cada deploy)
       depende de caminho estável. */
    for (const [k, v] of Object.entries(GRAVADOS)) {
      expect({ k, ok: v!.arquivo.startsWith("/sons/") }).toEqual({ k, ok: true });
    }
  });
});

describe("carregar", () => {
  const ctxFalso = {} as unknown as BaseAudioContext;

  test("som sem gravação devolve null, sem tocar na rede", async () => {
    expect(await carregarGravado(ctxFalso, "chuva")).toBe(null);
  });

  test("⚠️ falha de rede vira null, NUNCA exceção", async () => {
    /* Quem chama usa o retorno para escolher entre gravação e síntese. Uma
       exceção subindo daqui derrubaria o som inteiro em vez de cair na
       síntese — som que existe é melhor que o perfeito que não veio. */
    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("sem rede"))) as typeof fetch;
    try {
      (GRAVADOS as Record<string, unknown>).chuva = { arquivo: "/sons/chuva.webm", ganho: 1 };
      const ctx = {
        decodeAudioData: () => Promise.reject(new Error("não decodifica")),
      } as unknown as BaseAudioContext;
      expect(await carregarGravado(ctx, "chuva")).toBe(null);
    } finally {
      delete (GRAVADOS as Record<string, unknown>).chuva;
      globalThis.fetch = original;
    }
  });

  test("⚠️ dois toques rápidos baixam UMA vez — guarda a promessa", async () => {
    const original = globalThis.fetch;
    let idas = 0;
    globalThis.fetch = (() => {
      idas++;
      return Promise.resolve({ ok: false } as Response);
    }) as typeof fetch;
    try {
      (GRAVADOS as Record<string, unknown>).mar = { arquivo: "/sons/mar.webm", ganho: 1 };
      const ctx = {} as unknown as BaseAudioContext;
      await Promise.all([carregarGravado(ctx, "mar"), carregarGravado(ctx, "mar")]);
      expect(idas).toBe(1);
    } finally {
      delete (GRAVADOS as Record<string, unknown>).mar;
      globalThis.fetch = original;
    }
  });
});
