import * as Linking from "expo-linking";

/* Os Termos e a Privacidade são do app desde a fase 4 (`app/termos.tsx`,
   `app/privacidade.tsx`, texto em `lib/juridico`): as páginas do site são
   congeladas e falam de outro produto. */

export function abrir(url: string) {
  void Linking.openURL(url).catch(() => {});
}

/** Liga para um número. Funciona sem internet — é o caminho do 192. */
export function ligar(numero: string) {
  abrir(`tel:${numero.replace(/[^\d+]/g, "")}`);
}
