/**
 * "QUEM ESTÁ NUMA FASE PARECIDA COM A SUA" — a régua.
 *
 * ─── O QUE ISTO RESOLVE ─────────────────────────────────────────────────────
 *
 * A busca só acha quem ela já sabe o nome, e a zona de sugeridos ordena por
 * elos em comum — que uma conta NOVA não tem nenhum. Quem chegou sozinha vê
 * uma fileira de desconhecidas em ordem quase arbitrária, e a pergunta que ela
 * faria ("tem alguém no mesmo ponto que eu?") não tinha resposta.
 *
 * ─── ⚠️ POR FASE, E NUNCA POR DIAGNÓSTICO ───────────────────────────────────
 *
 * Um recorte "pré-eclâmpsia" ou "diabetes gestacional" seria útil e é
 * exatamente o fórum de conselho leigo que a decisão de NÃO TER COMENTÁRIOS
 * existe para impedir — de 1.098 respostas com conselho em fóruns de gestação,
 * 20,9% estavam erradas e 5,5% eram potencialmente danosas. Fase é biografia;
 * diagnóstico é prontuário.
 *
 * ─── ⚠️ E NINGUÉM É ROTULADO ────────────────────────────────────────────────
 *
 * Esta é a diferença entre um recorte e um GRUPO. Um "grupo da reta final" com
 * lista visível conta, para qualquer pessoa que o abra, a fase de cada uma que
 * está lá — e desfaz pela lateral a chave `mostrar_semana`, que existe para
 * essa decisão ser dela e de mais ninguém.
 *
 * Então a fase entra como RECORTE do que ELA vê, e:
 *
 *  · nada na tela diz a fase de ninguém;
 *  · o número da semana não viaja para o cliente em momento nenhum;
 *  · e o rótulo do interruptor fala da fase DELA ("parecida com a sua"), nunca
 *    da fase das outras.
 *
 * ⚠️ **A régua de corte é `faseDaGratidao`**, e não uma segunda tabela de
 * semanas. Duas tabelas divergiriam no primeiro ajuste, e a paciente de 28
 * semanas cairia num grupo aqui e noutro na Gratidão.
 */
import { faseDaGratidao, type FaseGratidao } from "@/lib/gratidao";

export type Fase = FaseGratidao;

/**
 * A fase de alguém, a partir da semana.
 *
 * ⚠️ **Sem semana conhecida, `null` — e não "t2".** `faseDaGratidao` devolve
 * `t2` no desconhecido porque lá o pior caso é uma pergunta de trimestre
 * errado; aqui o desconhecido significa "não dá para dizer se é parecida", e
 * fingir uma fase colocaria estranhas no recorte de quem ligou o filtro
 * justamente para não vê-las.
 */
export function faseDe(semanas: number | null | undefined, posParto: boolean): Fase | null {
  if (posParto) return "pos";
  if (semanas == null || !Number.isFinite(semanas)) return null;
  return faseDaGratidao(semanas, false);
}

/**
 * Estas duas estão numa fase parecida?
 *
 * ⚠️ **Desconhecida NÃO é parecida com ninguém**, dos dois lados. É o lado
 * seguro do filtro: quem o liga está pedindo um recorte, e devolver gente sem
 * fase conhecida transformaria o interruptor em decoração.
 */
export function mesmaFase(minha: Fase | null, dela: Fase | null): boolean {
  if (!minha || !dela) return false;
  return minha === dela;
}

/**
 * O rótulo do interruptor.
 *
 * ⚠️ **Fala da fase DELA, nunca das outras.** "Gestantes do 3º trimestre"
 * anunciaria, para quem lesse a tela por cima do ombro dela, em que trimestre
 * ela está — e a chave `mostrar_semana` existe exatamente para essa decisão ser
 * dela. "Parecida com a sua" diz a mesma coisa e não conta nada de ninguém.
 */
/**
 * ⚠️ O RESÍDUO DESTE RECURSO, escrito para não ser esquecido.
 *
 * O rótulo descreve o FILTRO, nunca uma pessoa: ninguém aparece marcado com a
 * fase dela, e a conversão semana→fase acontece no SERVIDOR, a partir de
 * `lmp_date`, que nunca viaja. Isso é o que separa este recurso de um "grupo da
 * reta final", que contaria a fase de cada uma que estivesse lá.
 *
 * ⚠️ **Ainda assim sobra uma inferência, e ela é real:** com o filtro LIGADO,
 * quem aparece está na mesma faixa de quem olha. É grosseira (três faixas de
 * ~13 semanas), é voluntária (só quem liga o filtro a obtém) e não diz semana
 * nenhuma — mas existe, e é exatamente o tipo de coisa que some da memória de
 * quem mexer aqui daqui a seis meses.
 *
 * O que NÃO pode acontecer, e é o que este comentário existe para impedir:
 * um selo por pessoa, um agrupamento com cabeçalho de fase, ou o filtro ligado
 * por PADRÃO — qualquer um dos três transforma uma inferência grosseira e
 * escolhida num dado publicado sobre terceiros.
 */
export const ROTULO_DO_FILTRO = "Quem está numa fase parecida com a sua";

/**
 * O vazio.
 *
 * ⚠️ **Ele EXPLICA a régua**, como o vazio da busca. Ligar o filtro e não ver
 * ninguém, sem explicação, lê como app quebrado — e o motivo mais provável é
 * simplesmente não haver, hoje, outra paciente pública naquela fase.
 */
export const VAZIO_DO_FILTRO =
  "Ninguém numa fase parecida com a sua por aqui hoje. Desligue o filtro para ver as outras.";
