/**
 * O RUNTIME DO SOM DE INTERFACE — a régua está em `som-da-interface.ts`.
 *
 * Aqui mora o que depende do aparelho: a preferência guardada, o instante do
 * último toque dela, e quantas vezes cada espécie já soou hoje. A separação é a
 * de sempre — régua pura e testável de um lado, `localStorage` e `document` do
 * outro.
 */

import {
  DESENHOS,
  NIVEL_PADRAO,
  CHAVE_NIVEL,
  desenhar,
  destravar,
  ehAlarme,
  ehNoite,
  tocarConquista,
  podeSoar,
  type EspecieDeSom,
  type NivelDeSom,
} from "./som-da-interface";

const NIVEIS: NivelDeSom[] = ["desligado", "essencial", "completo"];

export function lerNivel(): NivelDeSom {
  return escolha() ?? NIVEL_PADRAO;
}

/**
 * O que ela ESCOLHEU — `null` quando nunca escolheu nada.
 *
 * ⚠️ A diferença entre "não escolheu" e "escolheu desligar" é a que resolve uma
 * tensão real. A comemoração (`celebrateChime`, o troféu) JÁ EXISTIA e já
 * tocava: aplicar o padrão desligado a ela seria TIRAR uma coisa que o app tem,
 * e ninguém pediu isso. Mas ser impossível de silenciar também é defeito — era
 * o único som do app que a paciente não conseguia desligar de jeito nenhum, e
 * é justamente um dos que tocam sem ela pedir.
 *
 * Com os dois estados separados: quem nunca mexeu continua ouvindo a festa
 * exatamente como antes; quem tocou em "Não" silencia TUDO menos o alarme.
 */
function escolha(): NivelDeSom | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(CHAVE_NIVEL) as NivelDeSom | null;
    return v && NIVEIS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** Ela pediu silêncio explicitamente — nem a festa passa. */
export function pediuSilencio(): boolean {
  return escolha() === "desligado";
}

export function gravarNivel(n: NivelDeSom): void {
  try {
    localStorage.setItem(CHAVE_NIVEL, n);
  } catch {
    /* modo privado, cota cheia: a preferência não persiste e nada quebra */
  }
}

/**
 * ⚠️ O INSTANTE DO ÚLTIMO TOQUE — e ele é global de propósito.
 *
 * O portão "sem gesto recente, não soa" existe porque este app tem push, cron e
 * temporizadores capazes de disparar sozinhos. Passar o instante por prop
 * exigiria que cada um dos seis pontos de chamada soubesse rastreá-lo, e o
 * sétimo que alguém escrever amanhã esqueceria.
 */
let ultimoGesto = 0;
let ouvindo = false;
/* O último som que efetivamente tocou — a régua da vez precisa dos dois. */
let ultimoSomEm = 0;
let ultimoSom: EspecieDeSom | undefined;

/**
 * ⚠️ O MODO CUIDADO CARIMBADO — para o portão ser fechado POR PADRÃO.
 *
 * Antes, cada ponto de chamada tinha de passar `careMode` à mão. Isso é
 * exatamente a "segunda régua no chamador" que este projeto já pagou várias
 * vezes: `AvisoDePresente` teve o portão movido para dentro por isso, e a
 * revisão desta noite achou `celebrateChime` com um chamador que não passava
 * nada.
 *
 * E há um caso onde passar à mão nem é possível: `creditarSementinhas` é o
 * funil de DEZESSETE pontos de concessão, num módulo que de propósito não
 * importa nada — a moeda tocaria sem saber do luto.
 *
 * Com o carimbo, quem não passa herda o estado real em vez de herdar `false`.
 * Quem passa continua mandando: um bloco que sabe mais que a tela (a atividade
 * do Caminho, por exemplo) segue tendo a última palavra.
 */
let lutoAtual = false;

export function carimbarModoCuidado(v: boolean): void {
  lutoAtual = !!v;
}

function ouvirGestos() {
  if (ouvindo || typeof document === "undefined") return;
  ouvindo = true;
  const marca = () => {
    ultimoGesto = Date.now();
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    document.addEventListener(ev, marca, { passive: true, capture: true });
  }
}

/* Contagem do dia, por espécie. A chave carrega a data local — e as de
   ontem são apagadas na gravação, ver `somar`. */
function chaveDoDia(e: EspecieDeSom): string {
  const d = new Date();
  const dia = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  return `${PREFIXO_CONTA}${e}:${dia}`;
}

function contarHoje(e: EspecieDeSom): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    return Number(localStorage.getItem(chaveDoDia(e)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

const PREFIXO_CONTA = "dc-som-ui-conta:";

/**
 * ⚠️ AS CHAVES DE ONTEM SÃO APAGADAS — antes elas só se acumulavam.
 *
 * A prosa anterior dizia "virou o dia, zerou — sem nenhuma limpeza agendada", e
 * tratava isso como recurso. Não é: a chave de ONTEM continua no
 * `localStorage`, e nada a remove. São seis espécies vezes trezentos e sessenta
 * e cinco dias — umas 2.200 chaves por ano.
 *
 * Neste app isso tem consequência conhecida: quando a cota do `localStorage`
 * estoura, quem quebra é a PRÓXIMA gravação de qualquer coisa, inclusive o
 * `journey_state`, que carrega a jornada inteira dela. É a mesma razão pela
 * qual o rascunho do compositor não guarda fotos.
 *
 * A limpeza roda na gravação, que é rara (seis vezes por dia no máximo) e já
 * está tocando o `localStorage` de qualquer jeito.
 */
function somar(e: EspecieDeSom): void {
  try {
    const hoje = chaveDoDia(e);
    localStorage.setItem(hoje, String(contarHoje(e) + 1));
    const velhas: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIXO_CONTA) && !k.endsWith(hoje.slice(hoje.lastIndexOf(":")))) {
        velhas.push(k);
      }
    }
    for (const k of velhas) localStorage.removeItem(k);
  } catch {
    /* modo privado, cota cheia: a contagem não persiste e nada quebra */
  }
}

/**
 * Toca — se puder.
 *
 * ⚠️ Quem decide é `podeSoar`, que é pura e testada. Esta função só reúne o
 * contexto e conta. Um `if` local aqui seria a segunda régua que o projeto
 * proíbe desde `humorDaJornada`.
 */
export function tocarSomDeUI(
  especie: EspecieDeSom,
  o?: { careMode?: boolean; emSessao?: boolean },
): void {
  if (typeof window === "undefined") return;
  ouvirGestos();
  const ctx = {
    /**
     * ⚠️ O TROFÉU segue a mesma régua da conquista: ele é festa, já existia
     * como ANIMAÇÃO, e o som dele é a correção de uma tela que era muda. Quem
     * nunca escolheu ouve; quem pediu silêncio, não.
     */
    nivel: especie === "trofeu" ? (pediuSilencio() ? "desligado" : "completo") : lerNivel(),
    careMode: o?.careMode ?? lutoAtual,
    visivel: typeof document === "undefined" || document.visibilityState === "visible",
    desdeOGesto: Date.now() - ultimoGesto,
    jaTocouHoje: contarHoje(especie),
    emSessao: !!o?.emSessao,
    hora: new Date().getHours(),
    desdeOUltimo: Date.now() - ultimoSomEm,
    ultimaEspecie: ultimoSom,
  };
  if (!podeSoar(especie, ctx)) return;
  desenhar(especie);
  somar(especie);
  ultimoSomEm = Date.now();
  ultimoSom = especie;
}

/**
 * ⚠️ Um atalho para a bancada e para a folha de escolha: toca IGNORANDO os
 * portões, porque ali ela pediu para ouvir.
 *
 * Nunca use isto num evento do app — é justamente o que os portões existem para
 * impedir.
 */
export function ouvirAmostraDeUI(especie: EspecieDeSom): void {
  desenhar(especie);
}

/**
 * ⚠️ DESTRAVA O ÁUDIO DENTRO DO TOQUE — para o alarme não nascer mudo.
 *
 * O `AudioContext` do som de interface nasce na primeira nota. Quando essa
 * primeira nota só acontece DEPOIS de esperas (o SOS espera GPS, endereço e
 * servidor), o gesto já passou e o iOS recusa o contexto em silêncio.
 *
 * Chamar isto no prefixo SÍNCRONO do toque cria e acorda o contexto enquanto o
 * gesto ainda vale. É a mesma correção que `destravar()` faz nos Sons para
 * dormir, e pela mesma razão.
 */
export function destravarSomDeUI(): void {
  destravar();
}

/**
 * A festa da conquista, com os portões — MENOS o da preferência.
 *
 * ⚠️ Ela não consulta o nível porque **este som já existia e já tocava**. A
 * preferência nasceu desligada para o que é NOVO; aplicá-la aqui seria tirar
 * uma coisa que o app tem, e ninguém pediu isso. O que ela ganha são os três
 * portões que nunca teve: aba escondida, ausência de gesto recente, e o teto de
 * três por dia.
 */
export function tocarConquistaComPortoes(
  degraus: number,
  o?: { careMode?: boolean; especie?: EspecieDeSom },
): void {
  if (typeof window === "undefined") return;
  ouvirGestos();
  const especie = o?.especie ?? "conquista";
  const podia = podeSoar(especie, {
    /**
     * ⚠️ `completo` a menos que ela tenha PEDIDO silêncio.
     *
     * A festa já existia e já tocava, então quem nunca mexeu continua ouvindo —
     * o padrão desligado vale para o que é NOVO. Mas quem tocou em "Não" na
     * folha de sons silencia isto também: ser impossível de desligar era o
     * defeito na outra ponta, e num app que a paciente instala no celular ela
     * precisa poder pedir silêncio e ser atendida.
     */
    nivel: pediuSilencio() ? "desligado" : "completo",
    careMode: o?.careMode ?? lutoAtual,
    visivel: typeof document === "undefined" || document.visibilityState === "visible",
    desdeOGesto: Date.now() - ultimoGesto,
    jaTocouHoje: contarHoje(especie),
    hora: new Date().getHours(),
    desdeOUltimo: Date.now() - ultimoSomEm,
    ultimaEspecie: ultimoSom,
  });
  if (!podia) return;
  tocarConquista(degraus);
  somar(especie);
  ultimoSomEm = Date.now();
  ultimoSom = especie;
}

export { DESENHOS, ehAlarme, ehNoite, type EspecieDeSom, type NivelDeSom };
