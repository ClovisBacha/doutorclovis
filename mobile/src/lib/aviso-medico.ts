/**
 * O AVISO MÉDICO DO APP — um texto só, para todas as telas dizerem o mesmo.
 *
 * ⚠️ 21/10/2026, decisão do dono: o app é rede social + gamificação, e NÃO dá
 * orientação médica. O aviso diz isso com todas as letras (antes dizia que o
 * app "acompanha e orienta"). Ele continua existindo pela diretriz 1.4.1 da
 * App Store — o app guarda o cartão do SOS e acompanha o bebê — e pelo limite
 * do produto: quem examina e decide é o obstetra.
 *
 * Mora aqui (e não no JSX) para o dono reler e corrigir num lugar só, e para o
 * teste cobrar que as frases que importam continuam nele.
 */
export const AVISO_MEDICO = {
  titulo: "Aviso médico",
  completo:
    "O Obstétrica é uma comunidade de gestantes com um jogo de cuidado diário. Ele não dá orientação médica, não faz diagnóstico e não substitui consultas, exames nem a avaliação do seu médico. Em emergência, use o SOS ou ligue 192.",
  curto: "O Obstétrica não dá orientação médica. Em emergência, use o SOS ou ligue 192.",
} as const;
