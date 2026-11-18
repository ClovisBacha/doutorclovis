/**
 * DEPOIS DA VOLTA (18/11/2026, a vistoria: "cada vez que a aba ganha foco
 * saem umas oito leituras do servidor, e cada resposta redesenha a tela
 * inteira — justo durante a animação de volta da atividade").
 *
 * As leituras do foco esperam a animação de volta da pilha (≈ 350 ms no iOS)
 * para começar: as respostas não caem no meio da transição.
 *
 * ⚠️ Não é o `InteractionManager.runAfterInteractions`: no React Native 0.86
 * ele virou um esboço que só adia para o próximo giro do laço (`setImmediate`,
 * sem esperar animação nenhuma) e avisa que vai sair. Um prazo fixo faz o que
 * ele prometia.
 *
 * Devolve o cancelamento (para a limpeza do `useFocusEffect`).
 */
export const ESPERA_DA_VOLTA_MS = 380;

export function depoisDaVolta(tarefa: () => void, imediato = false): () => void {
  if (imediato) {
    tarefa();
    return () => {};
  }
  const t = setTimeout(tarefa, ESPERA_DA_VOLTA_MS);
  return () => clearTimeout(t);
}
