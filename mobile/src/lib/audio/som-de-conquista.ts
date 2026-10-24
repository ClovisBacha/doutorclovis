import { createAudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import { podeSoar } from "@/lib/som-da-interface";
import { gravarJson, lerJson } from "~/lib/armazem";
import { prepararModo } from "~/lib/audio/voz";
import { ymdLocal } from "~/lib/gestacao";

/**
 * A COMEMORAÇÃO — os quatro degraus subindo do site (`conquista` em
 * `som-da-interface.ts`, gerado por scripts/gerar-sons-do-sos.ts), ao fim de
 * uma aula com acertos.
 *
 * No site ela é a exceção do som de interface: já existia antes da régua e
 * toca para quem NUNCA escolheu silêncio. As outras portas valem iguais, pela
 * mesma função (`podeSoar`): calada no Modo Cuidado, das 22h às 7h e depois
 * de três vezes no dia — a décima festa não acrescenta nada à nona.
 */
const SOM = require("../../../assets/sons/conquista.wav");

const chaveDoDia = () => `dc-som-conquista:${ymdLocal()}`;

export async function tocarConquista(o: { cuidado: boolean }) {
  if (Platform.OS === "web") return;
  const jaTocouHoje = await lerJson<number>(chaveDoDia(), 0);
  const pode = podeSoar("conquista", {
    nivel: "completo",
    careMode: o.cuidado,
    visivel: true,
    desdeOGesto: 0,
    jaTocouHoje,
    hora: new Date().getHours(),
  });
  if (!pode) return;
  await gravarJson(chaveDoDia(), jaTocouHoje + 1);
  await prepararModo();
  try {
    const p = createAudioPlayer(SOM);
    p.play();
    setTimeout(() => {
      try {
        p.remove();
      } catch {
        /* já liberado */
      }
    }, 2000);
  } catch {
    /* sem som: o confete e a vibração continuam dizendo */
  }
}
