/**
 * O SOM DE FUNDO, RODANDO DE VERDADE — com um `AudioContext` de mentira.
 *
 * Estes testes existem porque a revisão adversarial da pausa achou aqui um
 * defeito que casamento de string nunca acharia: `retomar()` lia `ctx.state`
 * DEPOIS de esperar, e nesse meio-tempo `stop()` podia ter zerado o `ctx`. O
 * TypeError subia pela promessa, quem chamou entendia "não voltou" e criava um
 * `AudioContext` NOVO — som tocando num componente que já tinha saído da tela,
 * sem nenhum botão em lugar nenhum que o desligasse.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createSoundscape } from "./soundscapes";
import { NIVEL_AO_VIVO, SONS_CONTINUOS } from "./som-receitas";
import { GRAVADOS } from "./som-gravado";

/**
 * ⚠️ O CORPO DE UMA FUNÇÃO, e não uma fatia entre dois `indexOf`.
 *
 * Fatiar de "function A" até "function B" só funciona enquanto B estiver
 * DEPOIS de A no arquivo — e essa é a fragilidade que o projeto já pagou três
 * vezes: `indexOf` devolve −1 quando some, `slice(-1, x)` devolve string
 * vazia, e `not.toContain` sobre vazio PASSA. Aqui ela reapareceu na hora:
 * `retomar` está declarada antes de `stop`, então a fatia veio vazia e o teste
 * ficou verde sobre nada.
 *
 * Contando chaves a partir da declaração, o corpo é o corpo, venha em que
 * ordem vier.
 */
function corpoDaFuncao(fonte: string, declaracao: string): string {
  const i = fonte.indexOf(declaracao);
  if (i < 0) throw new Error("função não encontrada: " + declaracao);
  const abre = fonte.indexOf("{", i);
  let nivel = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") nivel++;
    else if (fonte[j] === "}") {
      nivel--;
      if (nivel === 0) return fonte.slice(i, j + 1);
    }
  }
  throw new Error("chave não fechou: " + declaracao);
}

class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
}
class No {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  type = "";
  buffer: unknown = null;
  loop = false;
  connect(n: unknown) {
    return n;
  }
  start() {}
  stop() {}
}

class CtxFalso {
  static vivos = 0;
  state: "running" | "suspended" | "closed" = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = new No();
  suspensoes = 0;
  /** Trava a volta, para simular o que acontece DURANTE a espera. */
  segurarResume: (() => void) | null = null;
  constructor() {
    CtxFalso.vivos++;
  }
  createGain() {
    return new No();
  }
  createBufferSource() {
    return new No();
  }
  createBiquadFilter() {
    return new No();
  }
  createOscillator() {
    return new No();
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len), copyToChannel: () => {} };
  }
  /** Uma gravação de mentira, já decodificada. */
  async decodeAudioData() {
    return {
      numberOfChannels: 1,
      sampleRate: 48000,
      length: 48000 * 10,
      getChannelData: () => new Float32Array(48000 * 10).fill(0.2),
    };
  }
  async suspend() {
    this.suspensoes++;
    if (this.state !== "closed") this.state = "suspended";
  }
  async resume() {
    if (this.segurarResume) await new Promise<void>((ok) => (this.segurarResume = ok));
    if (this.state !== "closed") this.state = "running";
  }
  async close() {
    this.state = "closed";
    CtxFalso.vivos--;
  }
}

let criados: CtxFalso[] = [];
beforeEach(() => {
  criados = [];
  CtxFalso.vivos = 0;
  (globalThis as Record<string, unknown>).window = {
    AudioContext: class extends CtxFalso {
      constructor() {
        super();
        criados.push(this);
      }
    },
  };
});
afterEach(async () => {
  /**
   * ⚠️ ESPERA O FECHAMENTO ADIADO ANTES DE PASSAR PARA O PRÓXIMO TESTE.
   *
   * `stop()` faz uma rampa de 80 ms e só então fecha o contexto — sem isso o
   * corte é um clique. O efeito colateral é que ele tem uma CAUDA assíncrona:
   * um teste que chama `stop()` e termina deixa o `close()` para depois, e ele
   * caía dentro do teste SEGUINTE, já com o contador zerado pelo `beforeEach`.
   * Medido: `CtxFalso.vivos` chegava a −1, e a falha aparecia num teste que
   * não tinha nada a ver com a causa.
   */
  await new Promise((ok) => setTimeout(ok, 160));
  delete (globalThis as Record<string, unknown>).window;
});

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("pausar e voltar", () => {
  test("pausar suspende o contexto (depois de baixar o volume)", async () => {
    const s = createSoundscape("pad");
    s.start();
    s.pausar();
    /* Não suspende no ato: o volume desce em 150 ms primeiro, senão o corte é
       seco — que é o que o fade de entrada de 1,5 s existe para evitar. */
    expect(criados[0].state).toBe("running");
    await espera(260);
    expect(criados[0].state).toBe("suspended");
  });

  test("retomar volta a tocar e diz que conseguiu", async () => {
    const s = createSoundscape("pad");
    s.start();
    s.pausar();
    await espera(260);
    expect(await s.retomar()).toBe(true);
    expect(criados[0].state).toBe("running");
  });

  test("⚠️ fechar DURANTE a espera não estoura e não deixa som órfão", async () => {
    /* O cenário: ela toca em Continuar e, enquanto o navegador ainda não
       respondeu, toca no ✕. Antes, isto lançava TypeError e quem chamou criava
       um AudioContext novo, tocando sem dono. */
    const s = createSoundscape("pad");
    s.start();
    const ctx = criados[0];
    ctx.segurarResume = () => {};
    s.pausar();
    const voltando = s.retomar();
    await espera(0);
    s.stop(); // ✕ no meio da espera
    ctx.segurarResume?.(); // o navegador responde agora
    expect(await voltando).toBe(false);
    /* ⚠️ O fechamento é ADIADO em ~110 ms, de propósito: `stop()` faz uma
       rampa de 80 ms antes de fechar, senão o corte seco é um clique — e um
       dos quatro caminhos que passam por aqui é trocar de som no MEIO da
       sessão. Ver o comentário do `stop()`. */
    await espera(160);
    expect(ctx.state).toBe("closed");
    expect(CtxFalso.vivos).toBe(0);
  });

  test("retomar depois de parar devolve false, sem lançar", async () => {
    const s = createSoundscape("pad");
    s.start();
    s.stop();
    expect(await s.retomar()).toBe(false);
  });

  test("stop cancela a suspensão adiada", async () => {
    /* Sem isto, o temporizador acordava depois do `close()` e chamava
       `suspend()` num contexto fechado. */
    const s = createSoundscape("pad");
    s.start();
    const ctx = criados[0];
    s.pausar();
    s.stop();
    await espera(260);
    expect(ctx.suspensoes).toBe(0);
  });

  test("o silêncio responde às duas sem contexto nenhum", async () => {
    const s = createSoundscape("silencio");
    s.start();
    s.pausar();
    expect(await s.retomar()).toBe(true);
    expect(criados.length).toBe(0);
  });
});

describe("⚠️ o relógio do coração", () => {
  test("pausar para o batimento; voltar rearma UM só", async () => {
    /* Num contexto suspenso o `currentTime` congela, e o `setInterval` seguiria
       agendando toda batida para o mesmo instante parado: ao voltar sairiam
       todas juntas, no ouvido de quem estava meditando. */
    const s = createSoundscape("coracao");
    s.start();
    const ctx = criados[0];
    s.pausar();
    await espera(260);
    ctx.currentTime = 5;
    /* Duas voltas concorrentes (o botão da tela e o ▶︎ do card do sistema)
       não podem deixar dois relógios batendo. */
    const [a, b] = await Promise.all([s.retomar(), s.retomar()]);
    expect([a, b]).toEqual([true, true]);
    s.stop();
    await espera(160);
    expect(ctx.state).toBe("closed");
  });

  test("o batimento não é agendado num contexto que não está rodando", async () => {
    const s = createSoundscape("coracao");
    s.start();
    const ctx = criados[0];
    s.pausar();
    await espera(260);
    const antes = ctx.currentTime;
    await espera(60); // mais que um período (≈429 ms não, mas o guarda é por estado)
    expect(ctx.currentTime).toBe(antes);
    s.stop();
  });
});

describe("⚠️ a passagem da síntese para a gravação", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
    delete (GRAVADOS as Record<string, unknown>).chuva;
  });

  function registrarGravacao() {
    (GRAVADOS as Record<string, unknown>).chuva = { arquivo: "/sons/chuva.webm", ganho: 1 };
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as unknown as Response)) as typeof fetch;
  }

  test("sem gravação, nada muda: o agendador continua vivo", async () => {
    const s = createSoundscape("chuva");
    s.start();
    await espera(30);
    /* O agendador é o coração da síntese. Se a passagem o matasse sem haver
       gravação, o som pararia de evoluir depois da primeira janela. */
    expect(criados[0].state).toBe("running");
    s.stop();
  });

  test("⚠️ com gravação, ela entra e o agendador da síntese PARA", async () => {
    /* Sem parar o agendador, a síntese seguiria criando nós a cada janela para
       sempre — inaudíveis (ganho zero) e caros: com `chuva-telhado` são dezenas
       de milhares de nós por hora. */
    registrarGravacao();
    const s = createSoundscape("chuva");
    s.start();
    await espera(60);
    const ctx = criados[0];
    const antes = ctx.currentTime;
    ctx.currentTime = 999;
    await espera(30);
    expect(ctx.state).toBe("running");
    expect(antes).toBe(0);
    s.stop();
    await espera(160);
    expect(ctx.state).toBe("closed");
  });

  test("⚠️ parar DURANTE o carregamento não deixa gravação órfã tocando", async () => {
    /* O cenário: ela toca em Começar e fecha a folha antes de o arquivo chegar.
       Sem a conferência depois da espera, a gravação começaria a tocar num
       componente que já saiu da tela — sem nenhum botão que a desligasse. É o
       mesmo defeito que `podeRetomar` conferir duas vezes evitou na pausa. */
    registrarGravacao();
    const s = createSoundscape("chuva");
    s.start();
    const ctx = criados[0];
    s.stop(); // fecha no meio da espera
    await espera(200);
    expect(ctx.state).toBe("closed");
    expect(CtxFalso.vivos).toBe(0);
  });
});

describe("os vinte sons montam sem quebrar", () => {
  test("cada receita cria o contexto e nenhum lança", async () => {
    /* ⚠️ A lista sai do catálogo, e não de uma cópia aqui: um som novo entra
       nesta prova sozinho. Ela é barata e pega a classe de defeito mais chata
       de todas — a receita que estoura só quando alguém escolhe aquele som. */
    for (const k of SONS_CONTINUOS) {
      const s = createSoundscape(k);
      expect(() => s.start()).not.toThrow();
      expect(() => s.setVolume(0.5)).not.toThrow();
      s.stop();
    }
    expect(criados.length).toBe(SONS_CONTINUOS.length);
    await espera(160);
    expect(CtxFalso.vivos).toBe(0);
  });

  test("⚠️ e cada um entra com o ganho MEDIDO dele", () => {
    /* Sem esta tabela, trocar de som no meio da sessão dá um salto de até
       31,5 dB (medido com `node scripts/ouvir.mjs --niveis`). O teste cobra
       que todo som do catálogo tenha número — um som novo sem entrada aqui
       cairia no `?? 1` e voltaria a destoar. */
    for (const k of SONS_CONTINUOS) {
      const g = NIVEL_AO_VIVO[k];
      expect({ k, tem: typeof g === "number" && g > 0 && g < 50 }).toEqual({ k, tem: true });
    }
  });

  test("⚠️ o stop faz RAMPA antes de fechar — não só adia o fechamento", () => {
    /* Adiar o `close()` sem descer o volume trocaria um clique por um clique
       110 ms depois. Quem mata o degrau é a rampa. */
    const fonte = readFileSync("src/lib/soundscapes.ts", "utf8");
    const fn = corpoDaFuncao(fonte, "  function stop()");
    expect(fn).toContain("linearRampToValueAtTime(0.0001");
    expect(fn).toContain("void meu.close()");
  });

  test("⚠️ o contexto é acordado na criação — senão a sessão roda muda", () => {
    /* Um `AudioContext` pode nascer `suspended`, e aí `agendarJanelas` desiste
       em silêncio: a meditação inteira sem som, com o chip aceso. */
    const fonte = readFileSync("src/lib/soundscapes.ts", "utf8");
    const fn = corpoDaFuncao(fonte, "  function start()");
    expect(fn).toContain("ctx.resume()");
  });

  test("navegador sem Web Audio fica em silêncio, e a tela não quebra", () => {
    (globalThis as Record<string, unknown>).window = {};
    const s = createSoundscape("chuva");
    expect(() => {
      s.start();
      s.pausar();
      s.stop();
    }).not.toThrow();
  });
});
