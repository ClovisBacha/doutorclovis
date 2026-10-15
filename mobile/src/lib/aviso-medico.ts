/**
 * O AVISO MÉDICO DO APP — um texto só, para todas as telas dizerem o mesmo.
 *
 * Diretriz 1.4.1 da App Store: app de saúde que orienta precisa lembrar, com
 * clareza, que não substitui o médico. E, mais do que a loja, é o limite do
 * produto: o app acompanha e orienta; quem examina e decide é o obstetra.
 *
 * Mora aqui (e não no JSX) para o dono reler e corrigir num lugar só, e para o
 * teste cobrar que as duas frases que importam continuam nele.
 */
export const AVISO_MEDICO = {
  titulo: "Aviso médico",
  completo:
    "O Obstétrica acompanha a sua gestação e orienta, mas não faz diagnóstico e não substitui consultas, exames nem a avaliação do seu médico. Em emergência, ligue 192 ou use o SOS.",
  curto: "Conteúdo educativo: não substitui a orientação do seu médico. Em emergência, ligue 192.",
} as const;
