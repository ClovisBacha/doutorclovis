/**
 * A SESSÃO DE CONTAGEM SOBREVIVE A TROCAR DE TELA — e antes ela não sobrevivia.
 *
 * ⚠️ **DUAS HORAS DE CONTAGEM SUMIAM EM SILÊNCIO.** `RegistrosHub` renderiza
 * `<Fade key={sub}>`: tocar em Contrações, no Diário ou na seta DESMONTA a aba
 * de chutes, e `active`/`count` são estado do React — a sessão só vira linha no
 * banco quando ela encerra. Fechar o app, o telefone dormir ou atender o
 * telefone tinham o mesmo efeito.
 *
 * ⚠️ **E o pior caminho era o do SOCORRO.** O botão do cartão vermelho chama
 * `onNavigate("Consultas")` — ou seja, o único caminho de contato da tela
 * DESTRUÍA a contagem que produziu o alarme, que é justamente a evidência que
 * ela ia contar ao médico.
 *
 * ─── AS TRÊS DECISÕES ───────────────────────────────────────────────────────
 *
 * ⚠️ **A chave NÃO leva o prefixo `dc-path-`.** Aquele viaja no blob do
 * `journey_state` e dispara um PUSH a cada gravação — e aqui a gravação
 * acontece a cada toque no bebê. É o mesmo motivo pelo qual as chaves da
 * nutrição (`dc-agua:`, `dc-suplementos:`) ficaram de fora dele.
 *
 * ⚠️ **A chave leva o id da conta.** O aparelho é compartilhado — num
 * consultório isso é o caso comum —, e uma contagem em curso da conta anterior
 * reaparecendo é pior que contagem nenhuma: ela seria lida como dela.
 *
 * ⚠️ **E NADA é gravado no BANCO a cada toque.** A decisão de "a linha nasce no
 * encerramento" está escrita e testada em `sessao-de-chutes.test.ts`, e existe
 * porque linha aberta com `kick_count: 0` chegava ao prontuário do médico como
 * "Movimentos — 0 movimentos", uma afirmação clínica que nunca aconteceu.
 */

export type SessaoGuardada = {
  /** ISO do início — é ele que ancora o relógio e o `started_at` da linha. */
  startedAt: string;
  count: number;
};

/**
 * ⚠️ Depois disto a sessão é ABANDONO, não pausa. O protocolo é de duas horas;
 * quatro é folga para "atendi o telefone e voltei". Restaurar uma contagem de
 * ontem faria a tela afirmar um relógio que não corresponde a nada — e o
 * `started_at` gravado ancoraria a duração num instante de outro dia.
 */
const VALIDADE_MS = 4 * 3600000;

export const chaveDaSessaoDeChutes = (uid: string) => `dc-chutes-sessao:${uid}`;

export function guardarSessao(uid: string | null, s: SessaoGuardada | null): void {
  if (!uid || typeof window === "undefined") return;
  try {
    if (s) window.localStorage.setItem(chaveDaSessaoDeChutes(uid), JSON.stringify(s));
    else window.localStorage.removeItem(chaveDaSessaoDeChutes(uid));
  } catch {
    /* Cota cheia ou storage bloqueado: a contagem segue valendo em memória.
       Perder a persistência é ruim; derrubar a contagem seria pior. */
  }
}

export function lerSessao(uid: string | null, agora: number): SessaoGuardada | null {
  if (!uid || typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(chaveDaSessaoDeChutes(uid));
    if (!cru) return null;
    const s = JSON.parse(cru) as Partial<SessaoGuardada>;
    if (typeof s?.startedAt !== "string" || typeof s?.count !== "number") return null;
    const ini = new Date(s.startedAt).getTime();
    if (!Number.isFinite(ini)) return null;
    /* Instante no FUTURO também vence — relógio adiantado e depois corrigido
       deixaria uma sessão eterna. */
    if (agora - ini > VALIDADE_MS || ini > agora) {
      guardarSessao(uid, null);
      return null;
    }
    return { startedAt: s.startedAt, count: Math.max(0, Math.floor(s.count)) };
  } catch {
    return null;
  }
}
