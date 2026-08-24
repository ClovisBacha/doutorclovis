/**
 * QUAL PAINEL DE EXAMES A PLATAFORMA SUGERE PARA ESTA PACIENTE.
 *
 * ─── O PEDIDO ───────────────────────────────────────────────────────────────
 *
 * "quando o médico clicar ali na paciente, vai abrir algumas opções de
 * receituário rápido, onde a plataforma já dá a dica, e ele vai poder editar da
 * maneira que quiser" (dono, ago/2026).
 *
 * Dar a dica, aqui, é apontar o painel do trimestre em que ela está. O médico
 * abriu a ficha de uma gestante de 26 semanas: a lista tem três painéis e um
 * deles é o dela.
 *
 * ─── A DECISÃO QUE IMPORTA: A FAIXA SAI DO PRÓPRIO TÍTULO ───────────────────
 *
 * Os painéis já se chamam "2º Trimestre — 18 a 28 semanas". Escrever
 * `{ de: 18, ate: 28 }` num segundo lugar criaria duas fontes para a mesma
 * verdade — e esta base já viu exatamente isso divergir (o Painel contava pela
 * data preferida e o Calendário pela confirmada; os dois filtros de lacuna).
 * Editar o título e esquecer a tabela faria a tela sugerir um trimestre e
 * escrever outro no cabeçalho do pedido.
 *
 * Isto NÃO é limite clínico — não decide gravidade nem conduta, só qual das
 * três listas de rotina aparece marcada. A régua de gravidade continua sendo
 * uma só, em `sinais-clinicos.ts`.
 */

/** A faixa de semanas escrita no título, ou `null` se não houver uma. */
export function faixaDoTitulo(titulo: string): { de: number; ate: number } | null {
  /* "8 a 13 semanas", "32 a 37 semanas". Exige a palavra "semanas" depois: sem
     isso, "1º Trimestre — 8 a 13" casaria com qualquer par de números que
     aparecesse num título futuro ("Painel 2 a 3 dias"). */
  const m = titulo.match(/(\d{1,2})\s*a\s*(\d{1,2})\s*semanas/i);
  if (!m) return null;
  const de = Number(m[1]);
  const ate = Number(m[2]);
  if (!Number.isFinite(de) || !Number.isFinite(ate) || de > ate) return null;
  return { de, ate };
}

/**
 * O índice do painel sugerido, ou `null` quando não há sugestão.
 *
 * `null` acontece de verdade e não é caso de borda: paciente sem data de
 * gestação (cadastro novo), puérpera, e as semanas ENTRE as faixas — 14 a 17,
 * 29 a 31 — em que nenhum painel de rotina é o certo. Chutar o mais próximo
 * seria pior que não sugerir: uma sugestão errada com cara de sugestão certa é
 * o que faz alguém pedir o painel do 1º trimestre para quem está em 30 semanas.
 */
export function exameSugerido(
  paineis: readonly { title: string }[],
  semanas: number | null | undefined,
): number | null {
  if (typeof semanas !== "number" || !Number.isFinite(semanas)) return null;
  for (let i = 0; i < paineis.length; i++) {
    const faixa = faixaDoTitulo(paineis[i].title);
    if (faixa && semanas >= faixa.de && semanas <= faixa.ate) return i;
  }
  return null;
}
