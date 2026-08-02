/**
 * A ponte para o app nativo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO IMPORTA `@capacitor/haptics`
 *
 * O Capacitor injeta um objeto global na página — `window.Capacitor` — com os
 * plugins já prontos. Falar com ele por esse global, em vez de importar o
 * pacote, tem três consequências que valem a feiura de um `any` controlado:
 *
 *  · Este arquivo COMPILA E RODA hoje, sem o Capacitor instalado. A instalação
 *    ficou travada pela rede do contêiner, e sem isso a ponte não poderia nem
 *    ser escrita.
 *  · O bundle da web não engorda um byte. Quem abre pelo navegador não baixa
 *    código nativo que nunca vai usar.
 *  · A casca carrega o site PUBLICADO (ver `capacitor.config.ts`), então o
 *    mesmo JavaScript roda nos dois lugares. Ele precisa descobrir onde está em
 *    tempo de execução — não em tempo de build.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ISTO RESOLVE DE VERDADE
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

/** O que o Capacitor injeta na página. Só o que este arquivo usa. */
type PonteCapacitor = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Haptics?: {
      impact?: (o: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void>;
      vibrate?: (o: { duration: number }) => Promise<void>;
    };
    StatusBar?: {
      setStyle?: (o: { style: "DARK" | "LIGHT" }) => Promise<void>;
      setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void>;
    };
  };
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
    if (i % 2 === 0) agenda.push({ em: t, forca: forcaDoPulso(padrao[i]) });
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

  const p = ponte();
  const haptics = p?.Plugins?.Haptics;

  /* iOS: impacto por impacto. O Android também tem Haptics no Capacitor, mas
     ali o `navigator.vibrate` continua sendo melhor — ele recebe o padrão
     inteiro e o sistema cuida do compasso, sem depender do event loop. */
  if (ehNativo() && plataforma() === "ios" && haptics?.impact) {
    for (const { em, forca } of agendaDeImpactos(padrao)) {
      pendentes.push(
        window.setTimeout(
          () =>
            void haptics
              .impact?.({ style: forca as "LIGHT" | "MEDIUM" | "HEAVY" })
              ?.catch(() => {}),
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
