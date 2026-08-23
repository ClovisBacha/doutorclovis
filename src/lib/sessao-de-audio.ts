/**
 * A SESSÃO DE ÁUDIO DO iOS — e o defeito que ela conserta.
 *
 * ─── ⚠️ A PREMISSA ESTAVA INVERTIDA, E ISSO MUDA TUDO ───────────────────────
 *
 * Eu escrevia, e o projeto acreditava, que "Web Audio ignora o botão de
 * silêncio do iPhone". **É o contrário, por padrão.** O WebKit trata isso como
 * o bug 237322 — *"webaudio api is muted when the iOS ringer is muted"*: Web
 * Audio É silenciado pelo botão; quem IGNORA o botão são os elementos `<audio>`
 * e `<video>`. Existe até uma biblioteca (`unmute-ios-audio`) cuja descrição é
 * literal: "o áudio pode tocar com o interruptor de silêncio ligado, mas só
 * para tags HTML5, não para Web Audio".
 *
 * ─── ⚠️ E O PERIGO REAL É OUTRO, E JÁ ESTÁ NESTE REPOSITÓRIO ────────────────
 *
 * Desde o iOS 17 existe `navigator.audioSession.type`. O padrão do Safari é
 * `auto`, que **começa em `ambient`** (respeita o botão) e **escala para
 * `playback` quando um elemento de mídia toca** — e nunca volta sozinho.
 *
 * Este app toca `<audio>` em quatro lugares: a voz da meditação, as histórias
 * para dormir, os sons para dormir e a sessão do casal. Então o caso concreto
 * do desastre não é o chime tocar sozinho:
 *
 *     Ela ouve uma história para dormir às 22h · o `audioSession` sobe para
 *     `playback` · e o som de conquista das 3h da manhã HERDA isso, tocando
 *     alto com o telefone no silencioso.
 *
 * Hoje nada devolve a sessão para `ambient`. Este arquivo devolve.
 *
 * ⚠️ **A consequência de errar aqui não é "ela desliga o som de UI".** É "ela
 * silencia o app inteiro nas Configurações do iPhone" — e esse é o mesmo canal
 * por onde chega o aviso de emergência e o lembrete de consulta.
 *
 * ⚠️ **E NUNCA embarcar o truque do `unmute-ios-audio`.** Ele existe para
 * desfazer exatamente a proteção que este app quer.
 */

type SessaoDeAudio = { type: string };

function sessao(): SessaoDeAudio | null {
  if (typeof navigator === "undefined") return null;
  const n = navigator as unknown as { audioSession?: SessaoDeAudio };
  return n.audioSession ?? null;
}

/**
 * O estado de REPOUSO: mixa com outros apps e é silenciado pelo botão.
 *
 * Chamado no boot e ao SAIR de qualquer conteúdo de áudio longo. Não "detecta"
 * o silêncio — delega a decisão ao sistema operacional, que é onde ela
 * pertence. Nenhuma API da web lê a posição do botão Ring/Silent, nem o Foco,
 * nem o volume absoluto; e o truque nativo de medir um som mudo é heurístico e
 * quebra com fone. Delegar é a única resposta honesta.
 */
export function emRepouso(): void {
  const s = sessao();
  if (!s) return;
  try {
    s.type = "ambient";
  } catch {
    /* navegador sem suporte: o padrão dele já é o certo */
  }
}

/**
 * O estado de CONTEÚDO: toca mesmo com o botão no silencioso.
 *
 * ⚠️ Só para o que ela PEDIU e está ouvindo de propósito — meditação, história
 * para dormir, sons para dormir, sessão do casal. Nunca para som de interface.
 */
export function emConteudo(): void {
  const s = sessao();
  if (!s) return;
  try {
    s.type = "playback";
  } catch {
    /* ignore */
  }
}

/**
 * ⚠️ AQUI HAVIA UM `comAudioLongo(f)` que embrulhava uma promessa num
 * `try/finally`. Ele foi ESCRITO e nunca teve chamador — e este repositório já
 * pagou três vezes por deixar código assim de pé (`proximoDesbloqueio`,
 * `escadaDeTrofeus`, as três conquistas da Escola apontando para uma tabela que
 * nada escrevia).
 *
 * A razão de não servir: as três telas de áudio longo são componentes React, e
 * o que garante o "sempre volta" nelas não é um `finally` numa promessa — é o
 * RETORNO DO EFEITO, que roda no ✕, ao trocar de tela e quando algo estoura no
 * meio. O efeito já é o `finally`; um segundo mecanismo seria uma segunda régua
 * para a mesma coisa.
 *
 * Se um dia houver áudio longo fora de componente (um cron, um worker), a
 * função volta — com chamador.
 */
