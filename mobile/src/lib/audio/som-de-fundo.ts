import { createAudioPlaylist, type AudioPlaylist } from "expo-audio";
import { Platform } from "react-native";
import type { SomKey } from "@/lib/som-receitas";
import { SONS_DE_FUNDO } from "~/lib/audio/sons-de-fundo";
import { prepararModo } from "~/lib/audio/voz";

/**
 * O SOM DE FUNDO DA MEDITAÇÃO — os sons do site, em laço sem emenda.
 *
 * Cada arquivo é um laço que fecha sem costura (scripts/gerar-sons-de-fundo.mjs).
 * Tocar o MESMO laço com `loop` daria um soluço a cada volta (o tocador volta
 * ao começo), então ele vai numa FILA de cópias: o iPhone (AVQueuePlayer) passa
 * de uma cópia para a seguinte sem pausa, porque o AAC traz a lista de edição
 * que corta o enchimento do codificador. A fila só se refaz depois da última
 * cópia — com 24 cópias de 30 s, a cada 12 minutos, mais do que a sessão.
 *
 * O volume e as rampas são os do site (`createSoundscape`): o som entra em
 * 1,5 s (ele aparece sem ser pedido no instante exato), sai em 150 ms ao
 * pausar, volta em 600 ms, e corte seco nunca. Na web (a bancada) não toca.
 */

export type SomDeFundo = {
  pausar: () => void;
  retomar: () => void;
  /** Desce até o silêncio em `ms` e libera o tocador. */
  parar: (ms?: number) => void;
};

const COPIAS = 24;
const PASSO_MS = 40;

const MUDO: SomDeFundo = { pausar: () => {}, retomar: () => {}, parar: () => {} };

export function tocarSomDeFundo(
  som: SomKey | "silencio",
  o: {
    entradaMs?: number;
    /** O nível (0 a 1). Sem ele, o que o som tinha ao vivo na meditação do site. */
    volume?: number;
    /** Continua com a tela apagada (os sons para dormir). */
    fundo?: boolean;
    /** Quantas cópias na fila: a fila se refaz depois da última, com um soluço. */
    copias?: number;
  } = {},
): SomDeFundo {
  if (som === "silencio" || Platform.OS === "web") return MUDO;
  const fonte = SONS_DE_FUNDO[som];
  if (!fonte) return MUDO;
  const alvo = o.volume ?? fonte.volume;
  let fila: AudioPlaylist | null = null;
  let nivel = 0;
  let rampa: ReturnType<typeof setInterval> | null = null;
  let acabou = false;
  let pausado = false;

  function aplicar(v: number) {
    nivel = v;
    try {
      if (fila) fila.volume = v;
    } catch {
      /* tocador já liberado */
    }
  }

  function rampaAte(destino: number, ms: number, depois?: () => void) {
    if (rampa) clearInterval(rampa);
    rampa = null;
    const de = nivel;
    const passos = Math.max(1, Math.round(ms / PASSO_MS));
    let i = 0;
    if (ms <= 0) {
      aplicar(destino);
      depois?.();
      return;
    }
    rampa = setInterval(() => {
      i++;
      aplicar(de + ((destino - de) * i) / passos);
      if (i >= passos) {
        if (rampa) clearInterval(rampa);
        rampa = null;
        depois?.();
      }
    }, PASSO_MS);
  }

  function liberar() {
    const f = fila;
    fila = null;
    try {
      f?.pause();
      f?.destroy();
    } catch {
      /* já liberado */
    }
  }

  void prepararModo({ fundo: o.fundo }).then(() => {
    if (acabou) return;
    try {
      fila = createAudioPlaylist({
        sources: Array.from({ length: o.copias ?? COPIAS }, () => fonte.arquivo),
        loop: "all",
      });
      fila.volume = 0;
      if (!pausado) {
        fila.play();
        rampaAte(alvo, o.entradaMs ?? 1500);
      }
    } catch {
      fila = null;
    }
  });

  return {
    pausar() {
      if (acabou || pausado) return;
      pausado = true;
      rampaAte(0, 150, () => {
        try {
          fila?.pause();
        } catch {
          /* já liberado */
        }
      });
    },
    retomar() {
      if (acabou || !pausado) return;
      pausado = false;
      try {
        fila?.play();
      } catch {
        /* já liberado */
      }
      rampaAte(alvo, 600);
    },
    parar(ms = 80) {
      if (acabou) return;
      acabou = true;
      rampaAte(0, ms, liberar);
    },
  };
}

/**
 * A AMOSTRA DE CINCO SEGUNDOS — tocar num som, na escolha, deixa ouvir antes
 * de decidir. Cinco, e não dez, a pedido do dono no app antigo: a decisão
 * ("gosto ou não gosto") acontece nos dois primeiros, e folhear não pode custar
 * um minuto. Sai em rampa, porque corte seco é o oposto do que a tela existe
 * para fazer.
 */
export const AMOSTRA_MS = 5000;

export function tocarAmostra(som: SomKey, aoAcabar: () => void): () => void {
  const s = tocarSomDeFundo(som);
  let vivo = true;
  const t = setTimeout(() => {
    if (!vivo) return;
    vivo = false;
    s.parar(400);
    aoAcabar();
  }, AMOSTRA_MS);
  return () => {
    if (!vivo) return;
    vivo = false;
    clearTimeout(t);
    s.parar(150);
  };
}
