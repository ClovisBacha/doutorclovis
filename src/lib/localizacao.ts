/**
 * Onde a paciente está — uma pergunta, dois jeitos de responder.
 *
 * ─── O defeito que isto conserta, e ele é do app ────────────────────────
 *
 * O SOS usa `navigator.geolocation` desde sempre, e no navegador funciona. **Na
 * casca nativa não funciona**, e não por bug: por permissão que ninguém pediu.
 *
 * · **Android** — o WebView só entrega coordenada se o APLICATIVO tiver
 *   `ACCESS_FINE_LOCATION` no manifesto. O manifesto gerado só tinha INTERNET.
 * · **iOS** — o `WKWebView` só entrega se o `Info.plist` declarar
 *   `NSLocationWhenInUseUsageDescription`. Não tinha.
 *
 * Sem os dois, `getCurrentPosition` chama o callback de erro. E o SOS trata
 * erro de localização como "sai sem a coordenada" — que é o comportamento certo
 * numa emergência e é justamente o que torna a falha INVISÍVEL: o aviso chega,
 * o médico vê "sem localização", e ninguém desconfia de que o aparelho nunca
 * teve chance de responder.
 *
 * ─── Sobre "localização em segundo plano" ───────────────────────────────
 *
 * Estava no plano com esse nome, e o nome está errado para o que o app precisa.
 * O SOS é disparado pela paciente TOCANDO num botão — o app está na frente. O
 * que ele precisa é (a) permissão de verdade, que é o que faltava, e (b)
 * continuar valendo quando a tela sai da frente durante o próprio SOS, porque o
 * fluxo abre o WhatsApp no meio. Os dois cabem em "durante o uso".
 *
 * Rastrear a paciente com o app fechado exigiria permissão "sempre", modo de
 * segundo plano e uma justificativa na revisão da Apple — e seria seguir uma
 * gestante o dia inteiro para um evento que ela mesma dispara. Não é o que o
 * SOS precisa, e é dado que é melhor não ter.
 */

import { ehNativo } from "@/lib/nativo";

export type Coordenada = { lat: number; lng: number };

export type OpcoesLocalizacao = {
  /** Desistir depois de tantos ms. */
  timeout: number;
  /** Aceita uma leitura guardada de até tantos ms atrás. */
  maximumAge: number;
  /** Esperar o GPS travar nos satélites. Caro e falha dentro de casa. */
  enableHighAccuracy?: boolean;
};

/**
 * A coordenada agora, ou `null`.
 *
 * **Nunca lança e nunca fica pendurada.** Quem chama é o SOS: uma promessa que
 * não resolve trava o botão em "Localizando e avisando…" para sempre, e a
 * emergência não sai. O prazo é cumprido aqui dentro, além do que a plataforma
 * promete — porque o `timeout` do plugin nativo depende do sistema responder, e
 * um sistema que não responde é exatamente o caso que se está protegendo.
 */
export async function localizacaoAgora(op: OpcoesLocalizacao): Promise<Coordenada | null> {
  const prazo = new Promise<null>((r) => setTimeout(() => r(null), op.timeout + 500));
  return await Promise.race([ehNativo() ? nativa(op) : doNavegador(op), prazo]);
}

async function nativa(op: OpcoesLocalizacao): Promise<Coordenada | null> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    /* Pedir permissão ANTES de chamar: no iOS, `getCurrentPosition` sem
       permissão concedida rejeita em vez de perguntar, e a paciente nunca veria
       o pedido. Se já está concedida, `requestPermissions` devolve na hora. */
    const atual = await Geolocation.checkPermissions();
    const perm = atual.location === "granted" ? atual : await Geolocation.requestPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") return null;

    const pos = await Geolocation.getCurrentPosition({
      timeout: op.timeout,
      maximumAge: op.maximumAge,
      enableHighAccuracy: op.enableHighAccuracy ?? false,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

function doNavegador(op: OpcoesLocalizacao): Promise<Coordenada | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      {
        timeout: op.timeout,
        maximumAge: op.maximumAge,
        enableHighAccuracy: op.enableHighAccuracy ?? false,
      },
    );
  });
}

/**
 * A paciente NEGOU a localização? (diferente de "deu erro técnico")
 *
 * A distinção importa porque a tela do SOS diz coisas diferentes: negada é
 * "toque aqui para permitir"; erro é "tentando de novo". Confundir as duas faz
 * a tela pedir uma permissão que já existe, ou calar sobre uma que falta.
 */
export async function localizacaoNegada(): Promise<boolean> {
  try {
    if (ehNativo()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      return (await Geolocation.checkPermissions()).location === "denied";
    }
    if (typeof navigator === "undefined" || !navigator.permissions) return false;
    const st = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return st.state === "denied";
  } catch {
    return false;
  }
}
