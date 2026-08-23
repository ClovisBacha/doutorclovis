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
  ehAlarme,
  tocarConquista,
  podeSoar,
  type EspecieDeSom,
  type NivelDeSom,
} from "./som-da-interface";

const NIVEIS: NivelDeSom[] = ["desligado", "essencial", "completo"];

export function lerNivel(): NivelDeSom {
  if (typeof localStorage === "undefined") return NIVEL_PADRAO;
  try {
    const v = localStorage.getItem(CHAVE_NIVEL) as NivelDeSom | null;
    return v && NIVEIS.includes(v) ? v : NIVEL_PADRAO;
  } catch {
    return NIVEL_PADRAO;
  }
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

/* Contagem do dia, por espécie. A chave carrega a data local: virou o dia,
   zerou — sem nenhuma limpeza agendada. */
function chaveDoDia(e: EspecieDeSom): string {
  const d = new Date();
  const dia = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  return `dc-som-ui-conta:${e}:${dia}`;
}

function contarHoje(e: EspecieDeSom): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    return Number(localStorage.getItem(chaveDoDia(e)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function somar(e: EspecieDeSom): void {
  try {
    localStorage.setItem(chaveDoDia(e), String(contarHoje(e) + 1));
  } catch {
    /* ignore */
  }
}

/**
 * Toca — se puder.
 *
 * ⚠️ Quem decide é `podeSoar`, que é pura e testada. Esta função só reúne o
 * contexto e conta. Um `if` local aqui seria a segunda régua que o projeto
 * proíbe desde `humorDaJornada`.
 */
export function tocarSomDeUI(especie: EspecieDeSom, o?: { careMode?: boolean }): void {
  if (typeof window === "undefined") return;
  ouvirGestos();
  const ctx = {
    nivel: lerNivel(),
    careMode: !!o?.careMode,
    visivel: typeof document === "undefined" || document.visibilityState === "visible",
    desdeOGesto: Date.now() - ultimoGesto,
    jaTocouHoje: contarHoje(especie),
  };
  if (!podeSoar(especie, ctx)) return;
  desenhar(especie);
  somar(especie);
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
 * A festa da conquista, com os portões — MENOS o da preferência.
 *
 * ⚠️ Ela não consulta o nível porque **este som já existia e já tocava**. A
 * preferência nasceu desligada para o que é NOVO; aplicá-la aqui seria tirar
 * uma coisa que o app tem, e ninguém pediu isso. O que ela ganha são os três
 * portões que nunca teve: aba escondida, ausência de gesto recente, e o teto de
 * três por dia.
 */
export function tocarConquistaComPortoes(degraus: number, o?: { careMode?: boolean }): void {
  if (typeof window === "undefined") return;
  ouvirGestos();
  const podia = podeSoar("conquista", {
    /* `completo` de propósito: é o que faz a preferência NÃO governar aqui. */
    nivel: "completo",
    careMode: !!o?.careMode,
    visivel: typeof document === "undefined" || document.visibilityState === "visible",
    desdeOGesto: Date.now() - ultimoGesto,
    jaTocouHoje: contarHoje("conquista"),
  });
  if (!podia) return;
  tocarConquista(degraus);
  somar("conquista");
}

export { DESENHOS, ehAlarme, type EspecieDeSom, type NivelDeSom };
