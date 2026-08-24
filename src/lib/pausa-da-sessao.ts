/**
 * POSSO RETOMAR? — a pergunta que precisa ser feita DUAS vezes.
 *
 * Retomar espera o `AudioContext` voltar, e esperar é onde o mundo muda. Entre
 * o toque em "Continuar" e a resposta do navegador cabem: fechar a folha, a
 * sessão terminar, trocar o som de fundo, e — o pior — a paciente sair do app.
 *
 * ─── OS DOIS DEFEITOS QUE ESTA RÉGUA FECHA ──────────────────────────────────
 *
 * 1. **Retomar depois de a folha fechar.** O componente já saiu, o
 *    `AudioContext` já foi fechado, e o recuo ("não voltou? recria") criava um
 *    som NOVO tocando num componente que não existe mais — sem nenhum botão em
 *    lugar nenhum para desligá-lo.
 *
 * 2. **Retomar com o app escondido.** O ▶︎ da tela bloqueada e o botão do fone
 *    chegam pelo card do sistema, e chegam com a página escondida. Despausar
 *    ali devolve a sessão a um mundo em que o iOS congela os relógios e suspende
 *    o áudio: ela voltaria para a bolha parada no meio de um "Inspire", muda,
 *    SEM o véu — que é exatamente o defeito que a pausa foi criada para
 *    consertar, agora sem o aviso.
 *
 * É régua e não `if` solto porque ela é usada duas vezes na MESMA função (antes
 * e depois da espera) e as duas têm de perguntar a mesma coisa.
 */

export type EstadoDaRetomada = {
  /** A etapa em que a folha está. Só `sessao` retoma. */
  etapa: string;
  /** Está pausada agora? */
  pausada: boolean;
  /** `document.hidden` — o app está fora da tela? */
  escondida: boolean;
  /** O componente ainda está montado? */
  viva: boolean;
};

export function podeRetomar(e: EstadoDaRetomada): boolean {
  return e.viva && e.pausada && e.etapa === "sessao" && !e.escondida;
}

/** Lê `document.hidden` sem quebrar no servidor. */
export function estaEscondida(): boolean {
  return typeof document !== "undefined" && document.hidden === true;
}
