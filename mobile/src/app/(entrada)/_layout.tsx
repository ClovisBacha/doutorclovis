import { Stack } from "expo-router";
import { cor } from "~/tema";

export default function LayoutDaEntrada() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.fundo } }} />
  );
}
