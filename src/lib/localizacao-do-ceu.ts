/**
 * A LOCALIZAÇÃO DO CÉU SÓ É PEDIDA QUANDO ELA TOCA.
 *
 * O céu da home é a janela dela: com a coordenada certa, sol, chuva e
 * entardecer batem com o que ela vê. Mas o GPS era pedido AO MONTAR a home, e
 * na casca nativa isso fazia da caixa de permissão de localização — com o texto
 * do SOS do `Info.plist` — o primeiro diálogo do app, antes de ela ver qualquer
 * tela. É incoerente para quem lê ("para o SOS", enquanto o app quer o clima),
 * é o padrão de site, e a revisão da Apple aponta (5.1.1).
 *
 * A regra agora:
 *  · ao montar, o GPS só é lido se o sistema já disse "granted", ou se ela já
 *    autorizou pelo cartão neste aparelho (e o sistema não disse "denied");
 *  · fora disso, o piso aproximado fica, e o cartão "Ativar localização" é a
 *    única porta — é ELA quem toca, e o diálogo chega com contexto;
 *  · o cartão entrega a coordenada por evento, e o céu troca no lugar, sem
 *    recarregar a página (era `window.location.reload()`).
 *
 * ⚠️ `navigator.permissions.query` não existe em todo WebView; onde não há
 * resposta, vale "desconhecido", e a lembrança local decide.
 */
export const CHAVE_LOCALIZACAO_DO_CEU = "dc-ceu-localizacao";
const EVENTO = "dc:ceu-localizacao";

export type EstadoDaPermissao = "granted" | "denied" | "prompt" | "desconhecido";
export type Coordenadas = { lat: number; lon: number };

type Armazem = Pick<Storage, "getItem" | "setItem">;

function armazem(): Armazem | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Ela já autorizou pelo cartão neste aparelho? */
export function localizacaoJaAutorizada(storage: Armazem | null = armazem()): boolean {
  try {
    return storage?.getItem(CHAVE_LOCALIZACAO_DO_CEU) === "1";
  } catch {
    return false;
  }
}

export function marcarLocalizacaoAutorizada(storage: Armazem | null = armazem()): void {
  try {
    storage?.setItem(CHAVE_LOCALIZACAO_DO_CEU, "1");
  } catch {
    /* armazenamento bloqueado: a próxima abertura volta a oferecer o cartão */
  }
}

/** A regra pura: pode ler o GPS ao montar, sem ela ter tocado em nada? */
export function podePedirAoMontar(permissao: EstadoDaPermissao, autorizadaAqui: boolean): boolean {
  if (permissao === "granted") return true;
  if (permissao === "denied") return false;
  return autorizadaAqui;
}

/** O que o sistema diz da permissão — sem nunca lançar. */
export async function permissaoDeLocalizacao(
  nav: Pick<Navigator, "permissions"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
): Promise<EstadoDaPermissao> {
  try {
    const status = await nav?.permissions?.query({ name: "geolocation" });
    const s = status?.state;
    return s === "granted" || s === "denied" || s === "prompt" ? s : "desconhecido";
  } catch {
    return "desconhecido";
  }
}

function janela(): EventTarget | null {
  return typeof window === "undefined" ? null : window;
}

/** O cartão avisa: chegou coordenada. */
export function anunciarLocalizacao(
  coords: Coordenadas,
  alvo: EventTarget | null = janela(),
): void {
  alvo?.dispatchEvent(new CustomEvent<Coordenadas>(EVENTO, { detail: coords }));
}

/** O céu escuta. Devolve a função que para de escutar. */
export function aoReceberLocalizacao(
  cb: (coords: Coordenadas) => void,
  alvo: EventTarget | null = janela(),
): () => void {
  if (!alvo) return () => {};
  const ouvinte = (e: Event) => {
    const d = (e as CustomEvent<Coordenadas>).detail;
    if (d && Number.isFinite(d.lat) && Number.isFinite(d.lon)) cb(d);
  };
  alvo.addEventListener(EVENTO, ouvinte);
  return () => alvo.removeEventListener(EVENTO, ouvinte);
}
