import { router } from "expo-router";
import { SAMU, SOS_NO_APP } from "~/config";
import { ligar } from "~/lib/links";

/**
 * O SOCORRO, COM OU SEM O SOS. Onde o app dizia "abra o SOS" (os movimentos do
 * bebê, o Mexer, a reta final, o pós-parto), ele chama isto: com o SOS no app,
 * abre a tela de emergência; sem ele (`SOS_NO_APP = false`), liga para o 192
 * — o caminho que funciona sem internet e sem nada cadastrado.
 *
 * O texto que acompanha também muda junto, para a tela nunca prometer um SOS
 * que não existe.
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
