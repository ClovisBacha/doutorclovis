/**
 * A FORÇA DO MOVIMENTO — o catálogo único dos três níveis.
 *
 * ⚠️ **ELE EXISTE PORQUE SÃO DOIS LEITORES, E OS DOIS PRECISAM CONCORDAR.**
 * Quem escolhe é a paciente (`kicks-tab.tsx`); quem lê é ela, no histórico, e
 * o MÉDICO, no prontuário (`prontuario-paciente.tsx`, via `clinical_events`).
 * Duas tabelas de rótulo divergiriam no primeiro ajuste — e a divergência
 * apareceria como o painel chamando de outra coisa o que ela marcou, que é o
 * pior lugar possível para um vocabulário se partir.
 *
 * ⚠️ **TRÊS níveis, e não a escala de 1 a 5 do Count the Kicks:** a tela irmã
 * (contrações) já usa três, e duas escalas no mesmo hub ensinam a decodificar.
 * Os valores são os mesmos do CHECK de `APLICAR_FORCA_DO_MOVIMENTO.sql` — um
 * quarto nível aqui é aceito pela tela e RECUSADO pelo banco.
 *
 * ⚠️ **O NÍVEL DO MEIO NÃO SE ANUNCIA**, e isto é regra e não economia de
 * espaço: "como sempre" é o padrão, e escrevê-lo em toda linha do histórico e
 * em toda linha do prontuário afogaria as duas únicas que carregam notícia. Por
 * isso `chip` e `frase` são nulos no 2 — quem não tem o que dizer, cala.
 *
 * ⚠️ **E "mais fraco" NÃO É ALARME.** Seria um limiar clínico novo inventado
 * fora de `sinais-clinicos.ts`, que é o único lugar onde eles moram. O que este
 * eixo faz é APARECER — para ela, comparando com as outras noites; para ele, na
 * linha do tempo. Heazell 2017: redução de FORÇA tem aOR 2,53 para
 * natimortalidade, contra 2,97 da frequência. Quase o mesmo peso, e o app
 * media só a primeira.
 */

export type NivelDeForca = {
  /** O que vai para `kick_sessions.strength`. */
  valor: 1 | 2 | 3;
  /** O botão que ela toca durante a sessão. */
  rotulo: string;
  /** A pastilha da linha do histórico. `null` no nível do meio — ver acima. */
  chip: string | null;
  /** O que o médico lê no prontuário. `null` no nível do meio. */
  frase: string | null;
};

export const NIVEIS_DE_FORCA: readonly NivelDeForca[] = [
  { valor: 1, rotulo: "Mais fraco", chip: "mais fraco", frase: "mais fracos que o normal" },
  { valor: 2, rotulo: "Como sempre", chip: null, frase: null },
  { valor: 3, rotulo: "Mais forte", chip: "mais forte", frase: "mais fortes que o normal" },
] as const;

/** O que a tela mostra antes de ela escolher. */
export const FORCA_PADRAO = 2;

/**
 * O nível, ou `null` fora do catálogo.
 *
 * ⚠️ Fora do catálogo devolve `null` — NUNCA o padrão. Quem escolhe o que
 * exibir na ausência de escolha é a TELA, num lugar só; cravar "como sempre"
 * aqui faria o leitor AFIRMAR uma escolha que ela não fez. É a mesma régua da
 * leitura da sessão guardada.
 */
export function nivelDeForca(valor: number | null | undefined): NivelDeForca | null {
  if (valor == null) return null;
  return NIVEIS_DE_FORCA.find((n) => n.valor === valor) ?? null;
}
