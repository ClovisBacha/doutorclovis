import { router } from "expo-router";
import { SAMU, SOS_NO_APP } from "~/config";
import { ligar } from "~/lib/links";

/**
 * O SOCORRO, COM OU SEM O SOS: com o SOS no app, abre a tela de emergência;
 * sem ele (`SOS_NO_APP = false`), liga para o 192 — o caminho que funciona sem
 * internet e sem nada cadastrado. O texto que acompanha muda junto, para a
 * tela nunca prometer um SOS que não existe.
 *
 * ⚠️ 23/11/2026, decisão do dono: o dia a dia NÃO lembra de emergência ("isso
 * lembra a pessoa de ficar preocupada, o app é de bem-estar e de
 * tranquilidade"). Saíram as linhas dos movimentos do bebê, do Mexer e da reta
 * final; fica o Modo Cuidado (o luto), onde os números de ajuda são o centro
 * da tela. `sem-conselho-medico.test.ts` cobra.
 */
export function pedirSocorro() {
  if (SOS_NO_APP) router.push("/sos");
  else ligar(SAMU);
}

/** O que o botão diz. */
export const ROTULO_DO_SOCORRO = SOS_NO_APP ? "Abrir o SOS" : `Ligar ${SAMU} (SAMU)`;

/** A frase curta de "se precisar". */
export const SE_PRECISAR = SOS_NO_APP
  ? "Se precisar, o SOS está a um toque."
  : `Se precisar, ligue ${SAMU} ou vá ao pronto-socorro.`;
