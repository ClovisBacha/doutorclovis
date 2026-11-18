import { Stack } from "expo-router";
import { veu } from "~/tema";

/* O fundo atrás das telas da entrada é o do véu (17/11/2026): ao deslizar de
   uma para a outra, nada de clarão branco entre os dois céus. */
export default function LayoutDaEntrada() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: veu.fundoDoVeu } }}
    />
  );
}
