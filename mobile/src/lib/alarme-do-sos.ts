import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Platform } from "react-native";
import { esquecerModo } from "~/lib/audio/voz";

/**
 * O ALARME DO SOS — o único som de INTERFACE do app (as vozes das sessões são
 * conteúdo que ela abriu para ouvir, e moram em ~/lib/audio).
 *
 * É a régua do site (`tocarSomDeUI("sos" | "sos-falhou")` em
 * src/lib/som-da-interface.ts): a confirmação é CLÍNICA e quem a recebe pode
 * não estar olhando a tela — em pânico, com o celular longe do rosto. Um
 * "✓ enviado" só na tela é a confirmação que ela não vai ver.
 *
 * Por isso ele toca mesmo no SILENCIOSO (`playsInSilentMode`) e mesmo no Modo
 * Cuidado — quem perdeu a gestação continua podendo passar mal. Abaixa a
 * música de outro app em vez de pará-la (`duckOthers`).
 *
 * Os arquivos saem do MESMO desenho do site (scripts/gerar-sons-do-sos.ts):
 * sobe para "chegou", desce e repete para "não chegou" — dá para distinguir os
 * dois sem olhar.
 */
const SONS = {
  enviado: require("../../assets/sons/sos-enviado.wav"),
  falhou: require("../../assets/sons/sos-falhou.wav"),
} as const;

/** Toca e devolve quando o som teve tempo de ser ouvido (para o WhatsApp não cortá-lo). */
export async function tocarAlarmeDoSos(tipo: keyof typeof SONS): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
    });
    /* O modo do alarme não é o das sessões: o próximo som reaplica o seu. */
    esquecerModo();
    const tocador = createAudioPlayer(SONS[tipo]);
    tocador.play();
    const duracao = tipo === "enviado" ? 650 : 1050;
    await new Promise((r) => setTimeout(r, duracao));
    setTimeout(() => {
      try {
        tocador.remove();
      } catch {
        /* já liberado */
      }
    }, 500);
  } catch {
    /* sem áudio, o SOS segue: a vibração e a tela continuam dizendo o desfecho */
  }
}
