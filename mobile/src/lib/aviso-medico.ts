/**
 * O AVISO MÉDICO DO APP — um texto só, para todas as telas dizerem o mesmo.
 *
 * ⚠️ 21/10/2026, decisão do dono: o app NÃO dá orientação médica. O aviso diz
 * isso com todas as letras (antes dizia que o app "acompanha e orienta"). Ele
 * continua existindo pela diretriz 1.4.1 da App Store — o app ensina sobre a
 * gestação e acompanha o bebê — e pelo limite do produto: quem examina e
 * decide é o obstetra. Desde 11/11/2026 o app é um jogo para aprender sobre a
 * gestação, sem o SOS (`SOS_NO_APP`): em emergência, o caminho é o 192.
 *
 * Mora aqui (e não no JSX) para o dono reler e corrigir num lugar só, e para o
 * teste cobrar que as frases que importam continuam nele.
 */
export const AVISO_MEDICO = {
  titulo: "Aviso médico",
  completo:
    "O Obstétrica é um jogo para aprender sobre a gestação, um pouco por dia. Ele não dá orientação médica, não faz diagnóstico e não substitui consultas, exames nem a avaliação do seu médico. Em emergência, ligue 192 ou vá ao pronto-socorro.",
  curto: "O Obstétrica não dá orientação médica. Em emergência, ligue 192.",
} as const;
