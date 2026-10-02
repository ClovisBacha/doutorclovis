import * as Linking from "expo-linking";
import { SITE } from "~/config";

export const TERMOS = `${SITE}/termos`;
export const PRIVACIDADE = `${SITE}/privacidade`;

export function abrir(url: string) {
  void Linking.openURL(url).catch(() => {});
}

/** Liga para um número. Funciona sem internet — é o caminho do 192. */
export function ligar(numero: string) {
  abrir(`tel:${numero.replace(/[^\d+]/g, "")}`);
}
