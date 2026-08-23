/**
 * Sons de fundo da meditação — gerados no navegador (Web Audio), sem nenhum
 * arquivo de áudio.
 *
 * Por que sintetizar em vez de servir mp3: um app de meditação de mercado
 * carrega dezenas de megabytes de trilha. Aqui a paciente costuma abrir a tela
 * no 4G, à noite, com o celular quase sem bateria — e um som que demora 8s pra
 * começar não acalma ninguém. Ruído filtrado toca no primeiro frame, funciona
 * offline, não pesa no bundle e não tem licença pra pagar.
 *
 * ⚠️ AS RECEITAS NÃO MORAM MAIS AQUI. Elas foram para `som-continuo.ts` quando
 * os sons foram refeitos (ago/2026): chuva ganhou GOTAS, mar ganhou a quebra
 * da onda, o ruído virou rosa e o laço passou de 2 s para 10 s. Este arquivo
 * ficou só com o que é do AO VIVO — o contexto, o volume, a pausa e o
 * agendamento por janelas. O som é o mesmo dos Sons para dormir, e é o mesmo
 * porque é o mesmo código.
 *
 * Tudo é guardado por try/catch: navegador sem Web Audio simplesmente fica em
 * silêncio, a tela nunca quebra.
 */

import { criarMusica } from "./musica-audio";
import {
  FAMILIAS,
  FAMILIA_DO_SOM,
  NIVEL_AO_VIVO,
  ofertaveis,
  ROTULO_DO_SOM,
  SONS_CONTINUOS,
  montar,
  type SomKey,
} from "./som-continuo";

/**
 * ⚠️ `musica` NÃO É UM SOM CONTÍNUO — e é por isso que ela entra aqui e não em
 * `SONS_CONTINUOS`.
 *
 * Os vinte sons são laços de 30 s: tocam para sempre, e o render offline os
 * transforma em arquivo para os Sons para dormir. A música tem ARCO e FIM — ela
 * é construída para a duração da sessão, e a última nota é composta, não
 * cortada. Pôr a música na lista dos contínuos faria o render tentar fechar um
 * laço de 30 s numa peça de dez minutos.
 *
 * O que ela COMPARTILHA é a interface (`start`/`stop`/`setVolume`/`pausar`/
 * `retomar`), e é por isso que a tela não precisa saber a diferença.
 */
export type SoundscapeKey = "silencio" | "musica" | SomKey;

/**
 * ⚠️ A LISTA SAI DO CATÁLOGO, e o silêncio entra à mão.
 *
 * Eram cinco itens escritos aqui. Com vinte sons, uma segunda lista divergiria
 * do motor no primeiro som novo — e a divergência apareceria como um som que
 * existe e não tem botão, que é indistinguível de não existir.
 *
 * O SILÊNCIO não vem do catálogo porque ele não é um som: é a ausência de um.
 * `som-receitas.ts` só conhece coisas que tocam.
 */
export const SOUNDSCAPES: { key: SoundscapeKey; label: string; emoji: string; sub?: string }[] = [
  {
    key: "musica",
    label: "Música",
    emoji: "🎶",
    sub: "composta para a duração da sessão",
  },
  ...SONS_CONTINUOS.map((k) => ({
    key: k as SoundscapeKey,
    label: ROTULO_DO_SOM[k].label,
    emoji: ROTULO_DO_SOM[k].emoji,
    sub: ROTULO_DO_SOM[k].sub,
  })),
  { key: "silencio", label: "Silêncio", emoji: "🔇" },
];

/**
 * ⚠️ AGRUPADOS, porque vinte e duas pílulas numa fita é um MURO.
 *
 * Com cinco opções a fita lisa funcionava. Com vinte e duas ela vira uma
 * parede de rótulos que a paciente não lê — ela toca nas duas primeiras e
 * desiste, que é o mesmo resultado de não ter os outros vinte.
 *
 * A primeira fileira é a que NÃO é ambiente: a música (composta, com arco e
 * fim) e o silêncio (a ausência). As seis famílias vêm depois, com título.
 */
export const GRUPOS_DE_SOM: { familia: string; sons: SoundscapeKey[] }[] = [
  { familia: "", sons: ["musica", "silencio"] as SoundscapeKey[] },
  ...FAMILIAS.map((f) => ({
    familia: f as string,
    sons: SONS_CONTINUOS.filter((k) => FAMILIA_DO_SOM[k] === f) as SoundscapeKey[],
  })),
].filter((g) => g.sons.length > 0);

/** O rótulo de qualquer chave, inclusive as que não são som contínuo. */
export const ROTULO: Record<string, { label: string; emoji: string; sub?: string }> =
  Object.fromEntries(SOUNDSCAPES.map((s) => [s.key, s]));

/**
 * Os grupos, já recortados pelo Modo Cuidado.
 *
 * ⚠️ "Coração do bebê" e "Ventre" saem da OFERTA para quem está de luto — ver
 * `FORA_DO_MODO_CUIDADO`. Eles são os únicos do catálogo cujo nome afirma sobre
 * uma gestação em curso, e numa folha aberta por quem acabou de perder a
 * gestação seriam a única coisa da tela falando do bebê, no presente.
 */
export function gruposDeSom(
  luto: boolean,
  comMusica = true,
): { familia: string; sons: SoundscapeKey[] }[] {
  const ok = new Set<string>(ofertaveis(luto));
  return GRUPOS_DE_SOM.map((g) => ({
    familia: g.familia,
    sons: g.sons.filter(
      (k) =>
        (k === "musica" ? comMusica : true) && (k === "musica" || k === "silencio" || ok.has(k)),
    ),
  })).filter((g) => g.sons.length > 0);
}

/**
 * A lista lisa, já recortada pelo Modo Cuidado — para as folhas que não agrupam.
 */
export function sonsOfertados(luto: boolean, comMusica = true) {
  const ok = new Set<string>(ofertaveis(luto));
  return SOUNDSCAPES.filter(
    (s) =>
      (s.key === "musica" ? comMusica : true) &&
      (s.key === "musica" || s.key === "silencio" || ok.has(s.key)),
  );
}

/** Agrupados, para a folha de escolha não virar uma lista de vinte. */
export const SOUNDSCAPES_POR_FAMILIA = FAMILIAS.map((f) => ({
  familia: f,
  sons: SONS_CONTINUOS.filter((k) => FAMILIA_DO_SOM[k] === f),
})).filter((g) => g.sons.length > 0);

export type Soundscape = {
  /** Sobe o volume até o alvo (0..1 relativo). Idempotente. */
  start: () => void;
  /** Desliga tudo e libera o contexto. Chamar SEMPRE no unmount. */
  stop: () => void;
  /** Volume mestre, 0..1. */
  setVolume: (v: number) => void;
  /** Silencia guardando o estado — para a pausa da sessão e o aparelho bloqueado. */
  pausar: () => void;
  /**
   * Volta a tocar. Devolve `false` quando o navegador recusou (contexto
   * suspenso costuma exigir um gesto novo no iOS) — aí quem chamou recria.
   */
  retomar: () => Promise<boolean>;
};

const SILENCIO: Soundscape = {
  start: () => {},
  stop: () => {},
  setVolume: () => {},
  pausar: () => {},
  retomar: async () => true,
};

/**
 * ⚠️ AS RECEITAS SAÍRAM DAQUI (ago/2026) — e foram para `som-continuo.ts`.
 *
 * Eram duas cópias do mesmo som: uma aqui, ao vivo, e outra lá, renderizada
 * para os Sons para dormir. Quando o dono disse que os sons estavam ruins e a
 * auditoria mostrou por quê (chuva sem gota, mar sem quebra, laço de 2 s
 * audível a 0,997 de auto-similaridade), consertar em dois lugares seria
 * garantir que um dia eles divergiriam.
 *
 * `montar()` agora serve aos dois: ela aceita qualquer `BaseAudioContext`, o
 * que inclui o `OfflineAudioContext` do render e o `AudioContext` ao vivo.
 * A única diferença é COMO os eventos são agendados — offline escreve todos de
 * uma vez, ao vivo pede a próxima janela de tempos em tempos.
 */

/**
 * Quanto tempo de eventos se agenda por vez, ao vivo.
 *
 * Vinte segundos, remarcados a cada cinco: gotas e ondas são eventos com hora
 * marcada, e um `AudioContext` só aceita agendamento no futuro. Sem a janela,
 * a chuva pararia de pingar assim que a primeira leva acabasse.
 */
const JANELA_SEGS = 20;

/**
 * ⚠️ `opcoes` EXISTE POR CAUSA DA MÚSICA, e ela é opcional de propósito.
 *
 * A música precisa saber a duração da sessão (o arco é construído para ela) e
 * se é Modo Cuidado (a cor mais escura não entra). Os vinte sons não precisam
 * de nada — são laços. Deixar o parâmetro opcional é o que permite os dezenove
 * chamadores existentes continuarem como estão.
 */
export function createSoundscape(
  kind: SoundscapeKey,
  opcoes?: { minutos?: number; luto?: boolean },
): Soundscape {
  if (kind === "silencio" || typeof window === "undefined") return SILENCIO;
  /**
   * ⚠️ A MÚSICA TEM A MESMA FORMA E OUTRA NATUREZA.
   *
   * `Musica` e `Soundscape` têm exatamente os mesmos cinco métodos, então a
   * tela troca de um para o outro sem saber. É isso que fez a integração caber
   * em duas linhas — e é o motivo de a interface ter sido desenhada assim.
   */
  if (kind === "musica") {
    return criarMusica({ minutos: opcoes?.minutos ?? 10, luto: opcoes?.luto });
  }
  const som: SomKey = kind;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  /**
   * ⚠️ O nó que iguala os vinte sons. Ver `NIVEL_AO_VIVO` — sem ele, trocar de
   * som no meio da sessão dá um salto de até 31,5 dB.
   */
  let nivel: GainNode | null = null;
  let heart: ReturnType<typeof setInterval> | null = null;
  let alvo = 0.28;
  /* Guardados para a pausa: o batimento é o único som agendado por relógio de
     fora do áudio, então é o único que precisa ser rearmado ao voltar. */
  /* Até quando os eventos já foram agendados. */
  let proximaJanela = 0;
  /** Suspensão adiada, para o volume ter tempo de descer. Ver `pausar()`. */
  let adormecer: ReturnType<typeof setTimeout> | null = null;

  /** Empurra a fronteira dos eventos para a frente enquanto o som toca. */
  function agendarJanelas() {
    if (!ctx || !master || ctx.state !== "running") return;
    /**
     * ⚠️ A ÂNCORA — sem ela, uma falha no `start()` vira um laço infinito de
     * exceções.
     *
     * `proximaJanela` nasce em 0 e só é fixado DEPOIS do `montar` do `start()`.
     * Quando aquele `montar` estourava (ver `comVolta`), `proximaJanela` ficava
     * em zero — e este `while`, rodando cinco minutos depois, tentaria agendar
     * dezesseis janelas de uma vez, TODAS NO PASSADO. Com `chuva-telhado` isso
     * são dezenas de milhares de nós criados de uma vez, disparando juntos.
     *
     * E o incremento vem ANTES do `montar`: se ele estourar, a janela seguinte
     * ainda avança, e o agendador não fica travado repetindo a mesma.
     */
    proximaJanela = Math.max(proximaJanela, ctx.currentTime);
    while (proximaJanela < ctx.currentTime + JANELA_SEGS) {
      const quando = proximaJanela;
      proximaJanela += JANELA_SEGS;
      /* ⚠️ `false`: ao vivo não há laço, e a cópia de emenda cairia em tempo
         NEGATIVO — que é `RangeError`, não um evento ignorado. */
      montar(ctx, som, nivel ?? master, JANELA_SEGS, quando, false, false);
    }
  }

  function start() {
    if (ctx) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      /**
       * ⚠️ `resume()` NA CRIAÇÃO — sem ele a sessão roda MUDA e nada avisa.
       *
       * Um `AudioContext` pode nascer `suspended`: política de autoplay,
       * criação fora de um gesto, teto de contextos do navegador. Quando isso
       * acontecia, `ctx` ficava não-nulo, `agendarJanelas` desistia em silêncio
       * (`state !== "running"`) e o `catch` daqui nunca disparava — a meditação
       * corria inteira sem som, com o chip do som aceso na tela.
       *
       * A promessa é ignorada de propósito: se for recusada, `retomar()`
       * continua sendo o caminho, e não há nada útil a fazer aqui.
       */
      void ctx.resume().catch(() => {});
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
      // Fade-in de 1,5s. Som que entra "no talo" assusta — e a tela toda existe
      // pra fazer o contrário disso.
      master.gain.linearRampToValueAtTime(alvo, ctx.currentTime + 1.5);

      /* A base (ruído, filtros, osciladores) nasce uma vez; os eventos vêm
         por janela — ver `JANELA_SEGS`. */
      nivel = ctx.createGain();
      nivel.gain.value = NIVEL_AO_VIVO[som] ?? 1;
      nivel.connect(master);
      montar(ctx, som, nivel, JANELA_SEGS, ctx.currentTime, true, false);
      proximaJanela = ctx.currentTime + JANELA_SEGS;
      heart = setInterval(agendarJanelas, 5000);
    } catch {
      /* sem áudio */
    }
  }

  /**
   * ⚠️ PAUSAR PRECISA PARAR O RELÓGIO DO CORAÇÃO, não só suspender o áudio.
   *
   * Num contexto suspenso o `currentTime` CONGELA — e o `setInterval` continua
   * correndo, agendando cada batida para o mesmo instante parado. Ao voltar,
   * todas saem juntas: um estouro no ouvido de quem estava meditando. Suspender
   * sem isto troca um defeito silencioso por um barulhento.
   *
   * O volume desce em 150 ms antes de suspender, e sobe em 600 ms ao voltar.
   * `suspend()` corta no ato, e corte seco é o que o fade de entrada de 1,5 s
   * existe para evitar — o mesmo botão não pode ter dois comportamentos.
   */
  function pausar() {
    if (heart) clearInterval(heart);
    heart = null;
    const meu = ctx;
    if (!meu || !master) return;
    try {
      master.gain.cancelScheduledValues(meu.currentTime);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), meu.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, meu.currentTime + 0.15);
    } catch {
      /* ignore */
    }
    if (adormecer) clearTimeout(adormecer);
    adormecer = setTimeout(() => {
      adormecer = null;
      try {
        void meu.suspend();
      } catch {
        /* ignore */
      }
    }, 200);
  }

  async function retomar(): Promise<boolean> {
    const meu = ctx;
    if (!meu) return false;
    if (adormecer) {
      clearTimeout(adormecer);
      adormecer = null;
    }
    try {
      await meu.resume();
    } catch {
      return false;
    }
    /**
     * ⚠️ RECONFERE O CONTEXTO DEPOIS DO `await`.
     *
     * `stop()` pode ter rodado no meio — ela fechou a folha, ou trocou de som.
     * Sem esta linha, `ctx.state` era lido de `null`, o TypeError subia pela
     * promessa, e o recuo de quem chamou criava um `AudioContext` NOVO num
     * componente que já tinha saído da tela: som tocando sem nenhum botão em
     * lugar nenhum que o desligasse.
     */
    if (!ctx || ctx !== meu || meu.state !== "running") return false;
    try {
      master?.gain.cancelScheduledValues(meu.currentTime);
      master?.gain.setValueAtTime(0.0001, meu.currentTime);
      master?.gain.linearRampToValueAtTime(Math.max(0.0001, alvo), meu.currentTime + 0.6);
    } catch {
      /* ignore */
    }
    if (!heart) heart = setInterval(agendarJanelas, 5000);
    return true;
  }

  function setVolume(v: number) {
    alvo = Math.max(0, Math.min(1, v));
    if (!ctx || !master) return;
    try {
      /**
       * ⚠️ A ÂNCORA — `cancelScheduledValues` NÃO segura o valor corrente.
       *
       * Ele reverte ao último evento anterior ao corte, e durante o fade de
       * entrada de 1,5 s não existe nenhum: só o `value` intrínseco, 0,0001.
       * Sem o `setValueAtTime`, mexer no volume no começo da sessão fazia o som
       * CAIR A ZERO e subir de novo em 0,3 s. `pausar`, `retomar` e `stop` já
       * ancoravam; só o volume não — era a única automação sem âncora do
       * arquivo.
       */
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime);
      master.gain.linearRampToValueAtTime(Math.max(0.0001, alvo), ctx.currentTime + 0.3);
    } catch {
      /* ignore */
    }
  }

  /**
   * ⚠️ DESLIGA COM RAMPA — cortar o contexto no ato é um CLIQUE.
   *
   * A versão anterior chamava `ctx.close()` seco, e quatro caminhos passam por
   * aqui: começar a sessão, retomar, fechar a folha e **trocar de som no meio
   * da sessão**. Este último é o pior: o som atual era cortado e o novo entrava
   * com 1,5 s de fade, sem cruzamento nenhum.
   *
   * O código já SABIA disso — `ouvirAmostra` desce o volume e espera 400 ms
   * antes de parar. O caminho da sessão não fazia.
   *
   * Oitenta milissegundos bastam para matar o degrau e são curtos demais para
   * quem chamou perceber espera. O contexto é fechado depois, e `ctx` vira
   * nulo NA HORA — quem chamar `start()` em seguida cria um novo e não encosta
   * neste.
   */
  function stop() {
    if (heart) clearInterval(heart);
    heart = null;
    /* Sem isto, a suspensão adiada acordaria depois do `close()` e chamaria
       `suspend()` num contexto fechado. */
    if (adormecer) clearTimeout(adormecer);
    adormecer = null;
    const meu = ctx;
    const meuMaster = master;
    ctx = null;
    master = null;
    nivel = null;
    if (!meu) return;
    try {
      if (meuMaster) {
        meuMaster.gain.cancelScheduledValues(meu.currentTime);
        meuMaster.gain.setValueAtTime(Math.max(0.0001, meuMaster.gain.value), meu.currentTime);
        meuMaster.gain.linearRampToValueAtTime(0.0001, meu.currentTime + 0.08);
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      try {
        void meu.close();
      } catch {
        /* ignore */
      }
    }, 110);
  }

  return { start, stop, setVolume, pausar, retomar };
}
