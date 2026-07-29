/**
 * Voz guiada — `speechSynthesis` do próprio navegador, em português.
 *
 * Este é o atalho honesto para o buraco mais óbvio da meditação e do
 * movimento: gravar um locutor custa estúdio, direção e regravação a cada
 * palavra que mudar. A voz do sistema já está instalada no aparelho, fala
 * pt-BR, não pesa nada e sai no primeiro toque.
 *
 * E ela resolve uma coisa que texto na tela NÃO resolve: com a voz ligada, a
 * paciente pode fechar os olhos na meditação e olhar para o próprio corpo (e
 * não para o celular) no movimento — que é exatamente o que as duas telas
 * pedem que ela faça.
 *
 * Regras de convivência:
 *  - `falar()` sempre cancela a fala anterior. Duas frases sobrepostas viram
 *    ruído, e a tela avança de linha sozinha.
 *  - Se não houver voz pt-BR instalada, não force uma em inglês lendo
 *    português — fica pior do que o silêncio. Nesse caso é no-op.
 *  - A lista de vozes chega ASSÍNCRONA no Chrome: a primeira chamada pode ver
 *    um array vazio, por isso escutamos `voiceschanged` uma vez.
 */

let vozPt: SpeechSynthesisVoice | null = null;
let procurou = false;

function suporta(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function procurarVoz() {
  if (!suporta()) return;
  const todas = window.speechSynthesis.getVoices();
  if (!todas.length) return;
  procurou = true;
  // Preferimos pt-BR; pt-PT serve como segunda opção (sotaque diferente, mas
  // pronúncia correta). Vozes marcadas "Google"/"Luciana"/"Fernanda" soam
  // bem melhor que a padrão em vários sistemas — por isso a ordenação.
  const pt = todas.filter((v) => v.lang?.toLowerCase().startsWith("pt"));
  if (!pt.length) return;
  const nota = (v: SpeechSynthesisVoice) =>
    (v.lang?.toLowerCase().startsWith("pt-br") ? 4 : 0) +
    (/google|luciana|fernanda|joana|natural|premium/i.test(v.name) ? 2 : 0);
  vozPt = pt.sort((a, b) => nota(b) - nota(a))[0] ?? null;
}

/** Chame uma vez ao abrir a tela: aquece a lista de vozes do navegador. */
export function prepararVoz() {
  if (!suporta()) return;
  procurarVoz();
  if (!procurou) {
    window.speechSynthesis.addEventListener("voiceschanged", procurarVoz, { once: true });
  }
}

/** Existe voz em português neste aparelho? (a tela esconde o botão se não) */
export function temVozPt(): boolean {
  if (!suporta()) return false;
  if (!vozPt) procurarVoz();
  return !!vozPt;
}

/**
 * Fala a frase, cancelando o que estava na boca.
 * `rate` abaixo de 1 porque a voz padrão do sistema é rápida demais para o
 * ritmo destas telas — 0,82 é o ponto em que ela para de soar como GPS.
 */
export function falar(texto: string, opts?: { rate?: number; pitch?: number }) {
  if (!suporta() || !texto.trim()) return;
  if (!vozPt) procurarVoz();
  if (!vozPt) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.voice = vozPt;
    u.lang = vozPt.lang || "pt-BR";
    u.rate = opts?.rate ?? 0.82;
    u.pitch = opts?.pitch ?? 1;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* sem voz */
  }
}

/** Silencia imediatamente. Chamar ao fechar a tela e ao desligar a voz. */
export function calar() {
  if (!suporta()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
