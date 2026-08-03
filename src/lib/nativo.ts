/**
 * A ponte para o app nativo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A CORREÇÃO QUE ESTE ARQUIVO CARREGA — leia antes de mexer
 *
 * A primeira versão desta ponte falava com `window.Capacitor.Plugins.X` em vez
 * de importar os pacotes. A ideia era boa e o resultado era **nada**:
 *
 *   `Capacitor.Plugins` NÃO é preenchido pela ponte nativa injetada.
 *
 * Quem escreve `Plugins[nome]` é o `registerPlugin` do `@capacitor/core`, que
 * roda quando a PÁGINA importa o pacote do plugin. A ponte injetada só publica
 * `Capacitor.PluginHeaders` (a lista do que existe do lado nativo) e um
 * `nativeCallback`. Está no próprio `native-bridge.js`: quando ele precisa do
 * plugin App, ele testa `if (!cap.Plugins?.App)` e avisa `"App plugin not
 * installed"` — ou seja, ele mesmo conta com a possibilidade de não estar lá.
 *
 * Consequência: sem importar, `Plugins.Haptics` era `undefined`, o `?.` engolia
 * a chamada, nada dava erro e **a paciente de iPhone continuava não sentindo
 * nada** — exatamente o defeito que a ponte existia para consertar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE `import()` DINÂMICO, E NÃO IMPORT NORMAL
 *
 * Os pacotes precisam ser importados; o site inteiro não precisa carregá-los. O
 * `import()` dentro de `carregar()` faz o Vite separar tudo num pedaço próprio,
 * que só é buscado quando `ehNativo()` é verdade. Quem abre pelo navegador não
 * baixa um byte de código nativo — que era o único ganho real do desenho
 * anterior, e ele fica.
 *
 * A casca carrega o site PUBLICADO (ver `capacitor.config.ts`), então o mesmo
 * JavaScript roda nos dois lugares e precisa descobrir onde está em tempo de
 * execução. `ehNativo()` e `plataforma()` continuam lendo o global, porque
 * esses dois a ponte injetada de fato publica.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA DE VIBRAÇÃO QUE ISTO RESOLVE
 *
 * `navigator.vibrate` recebe um padrão inteiro: `[liga, desliga, liga, …]`. O
 * Haptics do iOS NÃO TEM padrão — tem impactos individuais, disparados um a um,
 * com intensidade. Então o crescendo de doze pulsos que a respiração usa não
 * "cabe" numa chamada: vira uma AGENDA de impactos.
 *
 * E isso melhora o resultado em vez de piorar. O motor do iPhone tem `light`,
 * `medium` e `heavy` — que é exatamente a forma que o crescendo já tinha. No
 * Android o padrão continua indo inteiro para o `navigator.vibrate`, porque lá
 * ele existe e é mais preciso que uma sequência de timers.
 */

import type { HapticsPlugin } from "@capacitor/haptics";
import type { SplashScreenPlugin } from "@capacitor/splash-screen";
import type { StatusBarPlugin } from "@capacitor/status-bar";
import type { AppPlugin } from "@capacitor/app";
import { voltarAgora } from "@/lib/voltar";

/** O que a ponte injetada publica de fato — sem `Plugins`, ver o cabeçalho. */
type PonteCapacitor = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function ponte(): PonteCapacitor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: PonteCapacitor }).Capacitor ?? null;
}

/**
 * Roda dentro da casca nativa?
 *
 * NÃO é o mesmo que "instalado na Tela de Início". Um PWA instalado responde
 * `display-mode: standalone` e continua sendo web — sem haptics no iPhone, sem
 * controle de barra de status. A pergunta que importa aqui é outra: existe
 * ponte nativa para conversar?
 */
export function ehNativo(): boolean {
  return ponte()?.isNativePlatform?.() === true;
}

/** `"ios"`, `"android"` ou `"web"`. */
export function plataforma(): string {
  return ponte()?.getPlatform?.() ?? "web";
}

/* ── Os plugins, carregados uma vez ──────────────────────────────────────── */

type Plugins = {
  Haptics?: HapticsPlugin;
  SplashScreen?: SplashScreenPlugin;
  StatusBar?: StatusBarPlugin;
  App?: AppPlugin;
};

/**
 * O cache SÍNCRONO, para `tocarPadrao` não virar `async`.
 *
 * A vibração é chamada de dentro do compasso da respiração: transformá-la em
 * promessa colocaria um `await` entre o quadro e o pulso, e o crescendo depende
 * de o pulso cair na hora. Então quem carrega é o boot (`prepararNativo`), e
 * quem toca lê o que já está aqui. Se ainda não chegou, o Android cai no
 * `navigator.vibrate` e o iPhone fica sem — que é o comportamento de hoje, não
 * uma regressão.
 */
let carregados: Plugins = {};
let carga: Promise<Plugins> | null = null;

function carregar(): Promise<Plugins> {
  if (!ehNativo()) return Promise.resolve({});
  carga ??= (async () => {
    /* Um `catch` por pacote: um plugin que falte não pode derrubar os outros.
       `Promise.all` com `.catch(() => null)` em cada ramo faz isso. */
    const [h, s, b, a] = await Promise.all([
      import("@capacitor/haptics").catch(() => null),
      import("@capacitor/splash-screen").catch(() => null),
      import("@capacitor/status-bar").catch(() => null),
      import("@capacitor/app").catch(() => null),
    ]);
    carregados = {
      Haptics: h?.Haptics,
      SplashScreen: s?.SplashScreen,
      StatusBar: b?.StatusBar,
      App: a?.App,
    };
    return carregados;
  })();
  return carga;
}

/**
 * O boot do lado nativo. Chamado uma vez, em `src/router.tsx`.
 *
 * Faz três coisas nesta ordem: carrega os plugins, tira a tela de abertura e
 * deixa a barra de status combinando com o topo da tela.
 *
 * No navegador é no-op silencioso e nem busca o pedaço de código nativo.
 */
export function prepararNativo(): void {
  if (!ehNativo()) return;
  /* SÍNCRONO, antes de qualquer `await`: esta classe é o que esconde o
     cabeçalho e o rodapé do SITE dentro do app (ver `.nativo` em `styles.css`).
     Feito num `useEffect`, o menu do site apareceria por um quadro na tela de
     login — que é justamente a primeira coisa que o revisor da Apple vê, e a
     primeira coisa que denuncia "isto é um site embrulhado".
     Como `prepararNativo` roda no escopo do módulo do `router.tsx`, isto
     acontece antes de o React hidratar: nenhum quadro com o menu errado. */
  document.documentElement.classList.add("nativo");
  void carregar().then(({ App }) => {
    esconderSplash();
    ligarBotaoVoltar(App);
  });
}

/**
 * O botão de voltar do Android, ligado à pilha de `src/lib/voltar.ts`.
 *
 * Sem listener nenhum, o Capacitor faz o padrão dele e FECHA O APP — de
 * qualquer tela, inclusive com uma folha de compra aberta por cima. As telas
 * deste app não são rotas (são estado do React sobre uma URL só), então não há
 * histórico para o sistema desfazer sozinho: alguém tem que responder.
 *
 * Quando ninguém na pilha assume, a saída é **minimizar, não sair**. Os dois
 * tiram o app da frente; a diferença aparece na volta. `exitApp()` encerra a
 * WebView, e como a casca carrega o SITE, reabrir custa uma página inteira pela
 * rede — a paciente que saiu sem querer paga uma tela de carregamento e perde
 * onde estava. `minimizeApp()` mantém tudo quente e a volta é instantânea.
 */
function ligarBotaoVoltar(App?: AppPlugin): void {
  if (!App) return;
  void App.addListener("backButton", ({ canGoBack }) => {
    if (voltarAgora() === "consumido") return;
    /* Ninguém quis. Se houver histórico de verdade (uma navegação de rota, não
       uma troca de aba), desfaz. Senão, minimiza. */
    if (canGoBack) {
      window.history.back();
      return;
    }
    void App.minimizeApp().catch(() => {});
  }).catch(() => {});
}

/**
 * Antecipa a saída da tela de abertura, assim que a página remota respondeu.
 *
 * A casca carrega o SITE, então há uma espera de rede antes do primeiro pixel
 * útil. Escondendo a splash por tempo fixo, essa espera vira tela branca;
 * escondendo quando a página carregou, vira a marca até o conteúdo existir.
 *
 * **Isto NÃO é a única saída da splash, e não pode ser.** O
 * `capacitor.config.ts` mantém `launchAutoHide: true` com teto de 6 segundos:
 * o lado nativo esconde sozinho, sem depender da página. Um app congelado na
 * marca é pior que um app mostrando erro — a paciente não sabe sequer que houve
 * erro —, e é exatamente isso que acontece quando quem esconde é só o
 * JavaScript e o JavaScript não roda. Aqui isso deixou de ser hipótese: o
 * pedaço de código dos plugins vem pela REDE, da mesma origem que pode estar
 * fora do ar.
 */
export function esconderSplash(): void {
  if (!ehNativo() || typeof window === "undefined") return;
  let feito = false;
  const some = () => {
    if (feito) return;
    feito = true;
    try {
      void carregados.SplashScreen?.hide({ fadeOutDuration: 220 })?.catch(() => {});
    } catch {
      /* melhor esforço — o auto-hide nativo continua valendo */
    }
  };
  if (typeof document === "undefined" || document.readyState === "complete") return some();
  window.addEventListener("load", some, { once: true });
}

/* ── Barra de status ─────────────────────────────────────────────────────── */

/** O último estado pedido, para não conversar com o nativo a cada quadro. */
let barraEscura: boolean | null = null;

/**
 * Deixa o relógio e os ícones do sistema legíveis sobre o topo da tela.
 *
 * O topo do app da paciente é o CÉU, e o céu muda com a hora: azul claro ao
 * meio-dia, quase preto de madrugada. Uma cor fixa de barra de status acerta
 * metade do dia e some na outra metade — de madrugada, ícones escuros somem no
 * céu escuro; ao meio-dia, ícones claros somem no azul claro. Por isso quem
 * manda aqui é `isDark` de `useWeatherSky`, a MESMA variável que o hero já usa
 * para decidir a cor do próprio texto. Um sinal só, dois consumidores.
 *
 * Cuidado com o nome do estilo, que é invertido em relação à intuição: no
 * Capacitor, `"DARK"` quer dizer **texto claro** (para fundo escuro) e
 * `"LIGHT"` quer dizer **texto escuro**. Por isso o parâmetro aqui é o FUNDO,
 * não o texto — errar isso deixa a barra ilegível, e é um erro que passa
 * despercebido em quem revisa o código sem rodar.
 */
export function estiloDaBarra(fundoEscuro: boolean): "DARK" | "LIGHT" {
  return fundoEscuro ? "DARK" : "LIGHT";
}

export function barraDeStatus(fundoEscuro: boolean): void {
  if (!ehNativo() || barraEscura === fundoEscuro) return;
  barraEscura = fundoEscuro;
  void carregar().then(({ StatusBar }) => {
    if (!StatusBar) return;
    /* `Style` vem do pacote como enum; os valores são estas strings. Passar a
       string evita carregar o enum só para isso. */
    void StatusBar.setStyle({ style: estiloDaBarra(fundoEscuro) as never }).catch(() => {});
    /* A página desenha SOB a barra — é o que apaga a faixa clara do topo. No
       iOS quem garante isso é `contentInset: "never"`; no Android 15+ o sistema
       já força a borda-a-borda e esta chamada não existe mais, então o `catch`
       é o caminho normal, não exceção. */
    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  });
}

/* ── Vibração ────────────────────────────────────────────────────────────── */

/**
 * A intensidade de um pulso, a partir da duração que o padrão pediu.
 *
 * Os cortes vêm da faixa que `padraoDaFase` gera: numa fatia de 500ms os pulsos
 * vão de ~110ms (22%) a ~360ms (72%). Dividir essa faixa em três dá os degraus
 * que o crescendo já tinha por duração — só que agora por força, que é o que o
 * motor do iPhone entende.
 *
 * Função pura para o teste poder cobrar a monotonia: pulso maior nunca pode
 * sair mais fraco, senão o crescendo inverte no meio.
 */
export function forcaDoPulso(ms: number): "LIGHT" | "MEDIUM" | "HEAVY" {
  if (ms < 140) return "LIGHT";
  if (ms < 250) return "MEDIUM";
  return "HEAVY";
}

/**
 * O padrão `[liga, desliga, …]` virado em agenda de impactos.
 *
 * Devolve `{ em, forca }` por pulso, com `em` medido do início da fase. O
 * `desliga` do padrão não vira nada: no iOS o silêncio é a ausência de impacto,
 * não um comando.
 */
export function agendaDeImpactos(padrao: number[]): Array<{ em: number; forca: string }> {
  const agenda: Array<{ em: number; forca: string }> = [];
  let t = 0;
  for (let i = 0; i < padrao.length; i++) {
    /* `> 0`, não só "índice par": um pulso de duração ZERO não é vibração
       nenhuma, e virava impacto assim mesmo. É um padrão real e comum — o
       `[0, 25, 40, 55]` do contador de chutes começa com zero justamente para
       ATRASAR o primeiro toque (par = vibra, ímpar = pausa). O Android tocava
       um pulso e o iPhone sentia dois: um fantasma em 0 ms e o de verdade em
       25 ms. Mesmo código, aparelhos com sensações diferentes. */
    if (i % 2 === 0 && padrao[i] > 0) agenda.push({ em: t, forca: forcaDoPulso(padrao[i]) });
    t += padrao[i];
  }
  return agenda;
}

/** Timers da fase em curso, para uma fase nova cancelar a anterior. */
let pendentes: number[] = [];

function cancelar() {
  for (const id of pendentes) clearTimeout(id);
  pendentes = [];
}

/**
 * Toca um padrão de vibração no melhor canal que o aparelho oferece.
 *
 * · **iOS nativo** — agenda de impactos com força crescente. É o único jeito de
 *   o iPhone sentir isto: o Safari nunca implementou a Vibration API, então
 *   hoje as pacientes de iPhone não sentem nada.
 * · **Android** — o padrão inteiro de uma vez. O sistema toca com precisão que
 *   uma fila de `setTimeout` não alcança.
 * · **Web sem suporte** — silêncio, e é o comportamento certo: quem guia de
 *   olhos fechados nos dois sistemas é o som.
 */
export function tocarPadrao(padrao: number[]): void {
  if (!padrao.length) return;
  cancelar();

  const haptics = carregados.Haptics;

  /* iOS: impacto por impacto. O Android também tem Haptics no Capacitor, mas
     ali o `navigator.vibrate` continua sendo melhor — ele recebe o padrão
     inteiro e o sistema cuida do compasso, sem depender do event loop. */
  if (ehNativo() && plataforma() === "ios" && haptics) {
    for (const { em, forca } of agendaDeImpactos(padrao)) {
      pendentes.push(
        window.setTimeout(
          () => void haptics.impact({ style: forca as never })?.catch(() => {}),
          em,
        ),
      );
    }
    return;
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(padrao);
    }
  } catch {
    /* sem haptics */
  }
}

/** Interrompe o que estiver tocando. */
export function pararVibracao(): void {
  cancelar();
  try {
    navigator?.vibrate?.(0);
  } catch {
    /* ignore */
  }
}
