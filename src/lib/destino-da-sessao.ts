/**
 * PARA ONDE VAI QUEM ABRE /auth JÁ COM SESSÃO.
 *
 * É a única árvore de decisão sobre "quem é quem" — a casca nativa entra por
 * `/auth` justamente para reaproveitá-la (ver `capacitor.config.ts`).
 *
 * ⚠️ A ORDEM É A REGRA, e não é detalhe:
 *
 *  1. Dono → `/admin`. O e-mail do dono também está em `ADMIN_EMAILS` como
 *     "equipe do consultório", então a pergunta "é médico?" respondia sim e o
 *     mandava para o painel do consultório. Perguntar "é dono?" primeiro é o
 *     que separa as duas identidades.
 *  2. Perfil de médico, ATIVO OU NÃO → `/painel`. Com a conta inativa ele
 *     precisa chegar ao painel para ver perfil e assinatura; mandá-lo ao app da
 *     gestante fechava um ciclo sem tela utilizável.
 *  3. Cadastro de médico começado neste aparelho → `/medicos/cadastro`. Quem
 *     volta do link de confirmação de e-mail com o cadastro pela metade não
 *     pode cair em "configure sua data de gestação".
 *  4. Senão → `/minha-conta`, o app da paciente.
 *
 * As duas perguntas ao servidor (1 e 2) são independentes, então `auth.tsx` as
 * faz EM PARALELO e só depois consulta esta função: em série, toda abertura fria
 * do app pagava duas idas ao servidor uma atrás da outra antes da primeira tela.
 */
export type PapelDaSessao = {
  isAdmin: boolean;
  temPerfilMedico: boolean;
  querSerMedico: boolean;
};

export type DestinoDaSessao = "/admin" | "/painel" | "/medicos/cadastro" | "/minha-conta";

export function destinoDaSessao(p: PapelDaSessao): DestinoDaSessao {
  if (p.isAdmin) return "/admin";
  if (p.temPerfilMedico) return "/painel";
  if (p.querSerMedico) return "/medicos/cadastro";
  return "/minha-conta";
}
