/**
 * A NUTRIÇÃO DA SEMANA DELA — e o sujeito da frase é o BEBÊ.
 *
 * Pedido do dono: "será que a gente coloca uma frase ali, tem a nutrição
 * adequada pra sua semana? Para a sua semana, baseado na sua gestação — será
 * que a gente consegue deixar isso de uma maneira personalizada que a gente
 * crie valor?".
 *
 * ⚠️ **E O MOTOR JÁ EXISTE — a nutrição pega carona nele.** 81,5% das
 * gestantes usam app de gestação para acompanhar o DESENVOLVIMENTO FETAL,
 * contra 26,2% para nutrição; "informação da semana" foi considerada útil por
 * 98,5% das usuárias. Uma frase cujo sujeito é o bebê ("nesta semana ele está
 * fazendo X, e é para isso que serve Y") entra pela porta que ela já abre; uma
 * frase cujo sujeito é a dieta compete com um motor que ela não tem.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AS CINCO COISAS QUE ESTE ARQUIVO NÃO PODE FAZER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **1. NENHUMA FRASE SUGERE SUPLEMENTO.** A ACOG orienta TRIAR a dieta e o
 * uso de suplementos, e quem indica é o profissional. Este app já tem um
 * checklist de suplementos, e ele nasce do que o MÉDICO prescreveu — sem
 * prescrição ele nem existe na tela, porque um checklist vazio convida a
 * preencher, e aí o app receitou. Há teste com regex sobre os verbos.
 *
 * ⚠️ **2. A FRASE DO PRIMEIRO TRIMESTRE NÃO PODE FALAR EM FECHAR O TUBO
 * NEURAL.** Ele fecha até ~28 dias depois da concepção — antes de muitas
 * mulheres saberem que estão grávidas. Dizer isso na semana 8 não orienta
 * ninguém: transforma em culpa retroativa o que ela não tinha como ter feito.
 * O texto dessa faixa é de CONTINUIDADE.
 *
 * ⚠️ **3. NENHUMA CALORIA, NENHUMA META DE PESO, NENHUMA DIETA.** Numa base de
 * gestação de alto risco o dano é documentado: uso regular de app de dieta se
 * associa a hábitos problemáticos com comida, e ~13% das puérperas têm
 * transtorno alimentar. Fala-se em ALIMENTO e em porção da vida real.
 *
 * ⚠️ **4. NADA DISSO NO MODO CUIDADO.** A frase tem o bebê como sujeito — é
 * exatamente o que o Modo Cuidado existe para calar.
 *
 * ⚠️ **5. SEM SEMANA CONHECIDA, NÃO HÁ FRASE.** Uma frase genérica com cara de
 * personalizada é pior que nenhuma: ela ensina que o "para a sua semana" do
 * app não quer dizer nada.
 */

export type FraseDaSemana = {
  /** O título curto, que é o que ela lê primeiro. */
  titulo: string;
  /** Uma frase. O sujeito é o bebê; o complemento é comida de verdade. */
  texto: string;
};

type Faixa = { de: number; ate: number } & FraseDaSemana;

/**
 * As faixas. Poucas e largas de propósito: uma frase por semana daria 39
 * textos que ninguém revisa, e a diferença entre a semana 21 e a 22 não muda
 * nada do que ela põe no prato.
 */
const FAIXAS: Faixa[] = [
  {
    de: 4,
    ate: 8,
    titulo: "As primeiras semanas",
    texto:
      "Ele ainda é do tamanho de um grão, e o que mais importa agora é você conseguir comer — enjoo é normal e comida em pouca quantidade, várias vezes ao dia, costuma passar melhor que um prato cheio.",
  },
  {
    de: 9,
    ate: 13,
    titulo: "Ele está formando os órgãos",
    texto:
      "Nesta fase ele forma o que vai usar a vida inteira, e quem entrega a matéria-prima é o seu prato: feijão, carne, ovo e folhas escuras são a base do dia, mesmo em porções pequenas.",
  },
  {
    de: 14,
    ate: 19,
    titulo: "O enjoo costuma dar trégua",
    texto:
      "O apetite volta e ele começa a crescer rápido: é uma boa semana para reencontrar o arroz com feijão, a fruta da tarde e o prato colorido que o enjoo tinha tirado de você.",
  },
  {
    de: 20,
    ate: 25,
    titulo: "Ele está fazendo o próprio sangue",
    texto:
      "A quantidade de sangue dele e a sua aumentam muito agora — carne, feijão e folhas escuras entregam o ferro, e comer com uma fruta cítrica na mesma refeição faz o corpo aproveitar bem mais.",
  },
  {
    de: 26,
    ate: 31,
    titulo: "Os ossos dele estão endurecendo",
    texto:
      "Ele guarda cálcio dos seus ossos para montar os dele: leite, queijo, iogurte, sardinha e folhas verde-escuras ao longo do dia repõem o que ele leva.",
  },
  {
    de: 32,
    ate: 36,
    titulo: "O cérebro dele está no auge",
    texto:
      "É agora que ele monta a maior parte do cérebro e da retina — sardinha, atum e outros peixes que você já come, duas vezes por semana, são a melhor fonte disso.",
  },
  {
    de: 37,
    ate: 42,
    titulo: "Ele está ganhando peso para nascer",
    texto:
      "Ele guarda energia para os primeiros dias fora, e o seu estômago fica espremido: em vez de três pratos cheios, refeições menores e mais frequentes — uma fruta, um iogurte, um pedaço de queijo entre as principais — costumam cair muito melhor.",
  },
];

/**
 * @param semanas  a semana gestacional; `null` quando não há DUM.
 * @param careMode Modo Cuidado — a frase tem o bebê como sujeito.
 */
export function nutricaoDaSemana(
  semanas: number | null | undefined,
  careMode = false,
): FraseDaSemana | null {
  if (careMode) return null;
  if (semanas == null || !Number.isFinite(semanas)) return null;
  const s = Math.floor(semanas);
  const faixa = FAIXAS.find((f) => s >= f.de && s <= f.ate);
  return faixa ? { titulo: faixa.titulo, texto: faixa.texto } : null;
}

/** Só para o teste varrer todas as faixas sem reescrever a tabela. */
export const FAIXAS_DA_NUTRICAO: readonly FraseDaSemana[] = FAIXAS.map((f) => ({
  titulo: f.titulo,
  texto: f.texto,
}));
