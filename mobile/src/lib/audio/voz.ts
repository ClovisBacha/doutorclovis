import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

/**
 * O TOCADOR DAS VOZES — os dois canais do app antigo (`src/lib/voz.ts`):
 *
 *   · "guia"  — a narração (o movimento, a fala da meditação);
 *   · "pulso" — as palavras da respiração (inspire, segure, solte).
 *
 * Tocar num canal para o que estava nele; os dois canais nunca se cortam. Um
 * arquivo que falta é silêncio, nunca erro.
 *
 * Toca no modo silencioso do iPhone (é a atividade que ela abriu para ouvir) e
 * mistura com o que mais estiver tocando. Na web (a bancada) não toca nada: o
 * navegador sem gesto recusa áudio, e a bancada é para olhar.
 */

export type Canal = "guia" | "pulso";

const tocando: Partial<Record<Canal, AudioPlayer>> = {};
/* Cada parada avança a vez do canal. O tocador nasce depois de uma espera (o
   modo de áudio), e uma pausa ou uma saída NESSA espera precisa valer: sem a
   vez, a voz começaria a falar com a sessão já pausada ou fechada. */
const vez: Record<Canal, number> = { guia: 0, pulso: 0 };
let modo: Promise<unknown> | null = null;
let modoComFundo: boolean | null = null;

/**
 * O modo de áudio: toca no silencioso e mistura com o resto. `fundo` é só para
 * a noite (os sons e as histórias para dormir), que continuam com a tela
 * apagada; as sessões guiadas param quando o app sai da tela. O modo só é
 * reaplicado quando muda.
 */
export function prepararModo(o: { fundo?: boolean } = {}) {
  const fundo = !!o.fundo;
  if (!modo || modoComFundo !== fundo) {
    modoComFundo = fundo;
    modo = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: fundo,
    }).catch(() => {});
  }
  return modo;
}

/** Outro módulo trocou o modo (o alarme do SOS): o próximo som reaplica o seu. */
export function esquecerModo() {
  modo = null;
  modoComFundo = null;
}

export function pararCanal(canal: Canal) {
  vez[canal]++;
  const p = tocando[canal];
  if (!p) return;
  delete tocando[canal];
  try {
    p.pause();
    p.remove();
  } catch {
    /* já liberado */
  }
}

export function pararVozes() {
  pararCanal("guia");
  pararCanal("pulso");
}

/**
 * Toca uma voz num canal (para o que estava nele). `fonte` ausente = silêncio.
 *
 * `aoAcabar` é chamado quando a fala chega ao fim — nunca quando ela é parada
 * (pausa, saída, outra fala no mesmo canal): quem encadeia falas (as histórias,
 * a sessão do casal) só segue quando a voz terminou de verdade. `velocidade`
 * mantém o tom (as histórias tocam a 0,92×, mais arrastadas, como no site).
 */
export function tocarVoz(
  fonte: number | undefined | null,
  o: {
    canal?: Canal;
    volume?: number;
    fundo?: boolean;
    velocidade?: number;
    aoAcabar?: () => void;
  } = {},
) {
  if (!fonte || Platform.OS === "web") return;
  const canal = o.canal ?? "guia";
  pararCanal(canal);
  const minha = vez[canal];
  void prepararModo({ fundo: o.fundo }).then(() => {
    if (vez[canal] !== minha) return;
    let p: AudioPlayer;
    try {
      p = createAudioPlayer(fonte);
    } catch {
      o.aoAcabar?.();
      return;
    }
    p.volume = o.volume ?? 1;
    if (o.velocidade && o.velocidade !== 1) {
      try {
        p.shouldCorrectPitch = true;
        p.setPlaybackRate(o.velocidade, "high");
      } catch {
        /* sem ajuste de velocidade: toca no ritmo gravado */
      }
    }
    tocando[canal] = p;
    const sub = p.addListener("playbackStatusUpdate", (s) => {
      if (!s.didJustFinish) return;
      sub.remove();
      const aindaEra = tocando[canal] === p;
      if (aindaEra) delete tocando[canal];
      try {
        p.remove();
      } catch {
        /* já liberado */
      }
      if (aindaEra && vez[canal] === minha) o.aoAcabar?.();
    });
    p.play();
  });
}
