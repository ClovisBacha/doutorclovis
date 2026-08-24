/**
 * "Esta pessoa estava se cadastrando como médico."
 *
 * Existe porque as duas pistas que tínhamos são ruins em direções opostas.
 *
 * `user_metadata.role = "doctor"` é FORTE: bloqueia o app da gestante. Bom como
 * conclusão, péssimo como intenção — e só é gravável na criação da conta, então
 * quem já tinha conta nunca ganhava a marca.
 *
 * `?papel=medico` na URL é FRACO: não sobrevive a um recarregamento, e some no
 * caminho do link de confirmação de e-mail.
 *
 * Esta chave é o meio-termo. Dura no aparelho, atravessa a volta do Google e o
 * clique no e-mail de confirmação, e não tira acesso de NINGUÉM — ela só evita
 * que as telas de entrada despachem para o app da gestante alguém que está no
 * meio de um cadastro profissional. É uma dica de roteamento, nunca uma
 * permissão.
 */
export const INTENCAO_MEDICO = "obst_intencao_medico";

/** Há quanto tempo, no máximo, a intenção continua valendo: 7 dias. */
const VALIDADE_MS = 7 * 86400_000;

/** Alguém começou um cadastro de médico neste aparelho e não terminou? */
export function querSerMedico(): boolean {
  try {
    const bruto = localStorage.getItem(INTENCAO_MEDICO);
    if (!bruto) return false;
    const quando = Number(bruto);
    // Sem prazo, um teste de meses atrás ainda estaria roteando o aparelho.
    if (!Number.isFinite(quando) || Date.now() - quando > VALIDADE_MS) {
      localStorage.removeItem(INTENCAO_MEDICO);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Desistiu, ou já virou médico de fato. */
export function esquecerIntencaoMedico(): void {
  try {
    localStorage.removeItem(INTENCAO_MEDICO);
  } catch {
    /* sem storage, nada a limpar */
  }
}
