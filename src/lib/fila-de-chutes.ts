/**
 * A FILA DE CONTAGENS — duas horas de contagem não se perdem mais sem rede.
 *
 * ⚠️ **O DEFEITO: `stop()` EXIGIA A REDE, no fim de até duas horas.** A sessão
 * de chutes só vira linha quando ela encerra — decisão certa, e testada, porque
 * a linha aberta com `kick_count: 0` chegava ao prontuário como "Movimentos — 0
 * movimentos", uma afirmação clínica que nunca aconteceu. O preço disso é que
 * TODO o valor da sessão atravessa um único `insert`: falhando ele, saía um
 * `toast.error` e a contagem ficava presa na tela, esperando um dedo para
 * tentar de novo.
 *
 * E o que ela de fato faz depois de duas horas deitada de lado é fechar o app.
 * A contagem em curso é guardada (`sessao-guardada.ts`), mas com validade de
 * QUATRO HORAS — então a paciente que contou no quarto dos fundos, recebeu o
 * erro e voltou ao app na manhã seguinte encontrava **nada**. Perder a noite em
 * que o bebê se mexeu pouco é perder exatamente a que importa.
 *
 * ⚠️ É o mesmo defeito que a aba irmã — o cronômetro de contrações — consertou
 * em set/2026, deixado de pé aqui. O mecanismo é o MESMO módulo
 * (`fila-local.ts`), e não uma segunda cópia: ver a razão escrita lá.
 *
 * ─── O QUE É PRÓPRIO DESTA FILA ────────────────────────────────────────────
 *
 * ⚠️ **Aqui TUDO que entra já está fechado.** A contagem em curso não mora
 * nesta fila — ela mora em `sessao-guardada.ts`, com validade de quatro horas,
 * porque uma contagem de ontem restaurada faria o relógio afirmar um instante
 * que não corresponde a nada. A fila só existe a partir do ENCERRAMENTO: é o
 * momento em que a sessão vira um fato clínico completo.
 *
 * ⚠️ **E a chave é distinta da chave da sessão** (`dc-chutes-fila:` contra
 * `dc-chutes-sessao:`): nenhuma é prefixo da outra, então uma varredura por
 * prefixo nunca leva as duas juntas. Foi o que já custou uma volta no rascunho
 * do story.
 */
import {
  comPacote as comPacoteGenerico,
  ehLocal,
  gravarFilaEm,
  lerFilaDe,
  mesclar,
  novoIdLocal,
  podar as podarGenerico,
  PREFIXO_LOCAL,
  semPacote as semPacoteGenerico,
  VALIDADE_DIAS,
  type PacoteLocal,
} from "@/lib/fila-local";

export { ehLocal, mesclar, novoIdLocal, PREFIXO_LOCAL, VALIDADE_DIAS };

export type SessaoPendente = PacoteLocal & {
  started_at: string;
  /** Sempre preenchido: só a sessão ENCERRADA entra nesta fila. */
  ended_at: string;
  kick_count: number;
  /** 1 mais fraco · 2 como sempre · 3 mais forte. */
  strength: number;
};

export function chaveDaFilaDeChutes(uid: string): string {
  return `dc-chutes-fila:${uid}`;
}

export function lerFilaDeChutes(uid: string, agora: number): SessaoPendente[] {
  if (!uid) return [];
  return lerFilaDe(chaveDaFilaDeChutes(uid), ehPendente, agora);
}

export function gravarFilaDeChutes(uid: string, lista: readonly SessaoPendente[]): void {
  if (!uid) return;
  gravarFilaEm(chaveDaFilaDeChutes(uid), lista);
}

export function podarChutes(lista: readonly SessaoPendente[], agora: number): SessaoPendente[] {
  return podarGenerico(lista, agora);
}

export function comSessao(
  lista: readonly SessaoPendente[],
  pacote: SessaoPendente,
  agora: number,
): SessaoPendente[] {
  return comPacoteGenerico(lista, pacote, agora);
}

export function semSessao(lista: readonly SessaoPendente[], id: string): SessaoPendente[] {
  return semPacoteGenerico(lista, id);
}

function ehPendente(x: unknown): x is SessaoPendente {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<SessaoPendente>;
  return (
    typeof s.id === "string" &&
    ehLocal(s.id) &&
    typeof s.started_at === "string" &&
    /* ⚠️ `ended_at` é OBRIGATÓRIO aqui, ao contrário da fila de contrações: um
       pacote sem fim nesta fila viraria uma linha aberta no banco, que é
       exatamente o "0 movimentos" que a decisão de gravar-no-encerramento
       existe para impedir. */
    typeof s.ended_at === "string" &&
    typeof s.kick_count === "number" &&
    typeof s.strength === "number"
  );
}
