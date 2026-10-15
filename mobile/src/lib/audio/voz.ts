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

/** O modo de áudio das sessões guiadas: toca no silencioso e mistura com o resto. */
export function prepararModo() {
  if (!modo)
    modo = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    }).catch(() => {});
  return modo;
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

/** Toca uma voz num canal (para o que estava nele). `fonte` ausente = silêncio. */
export function tocarVoz(
  fonte: number | undefined | null,
  o: { canal?: Canal; volume?: number } = {},
) {
  if (!fonte || Platform.OS === "web") return;
  const canal = o.canal ?? "guia";
  pararCanal(canal);
  const minha = vez[canal];
  void prepararModo().then(() => {
    if (vez[canal] !== minha) return;
    let p: AudioPlayer;
    try {
      p = createAudioPlayer(fonte);
    } catch {
      return;
    }
    p.volume = o.volume ?? 1;
    tocando[canal] = p;
    const sub = p.addListener("playbackStatusUpdate", (s) => {
      if (!s.didJustFinish) return;
      sub.remove();
      if (tocando[canal] === p) delete tocando[canal];
      try {
        p.remove();
      } catch {
        /* já liberado */
      }
    });
    p.play();
  });
}
