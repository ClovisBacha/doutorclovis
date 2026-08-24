/**
 * O FUNIL DA INDICAÇÃO — a régua, e o que ele NÃO mede.
 *
 * ─── POR QUE ELE EXISTE ─────────────────────────────────────────────────────
 *
 * As nove mudanças desta leva existem para trazer gente. Sem medir, nenhuma
 * delas pode ser julgada — e a decisão de manter, cortar ou ampliar cada uma
 * seria no escuro.
 *
 * ─── ⚠️ ELE É DERIVADO DE ESTADO, E ISSO TEM UM LIMITE HONESTO ─────────────
 *
 * Não existe tabela de eventos neste app (conferido: nada de `analytics`,
 * `page_view` ou `eventos_funil`), e `getGrowthMetrics` já monta o funil de
 * médicos e pacientes a partir de tabelas de estado, com as premissas
 * rotuladas. Este segue o mesmo caminho — e pelo mesmo motivo: uma tabela de
 * eventos é uma escrita por visita, RLS nova e uma decisão de retenção de dado
 * que ninguém pediu.
 *
 * **O degrau que o estado NÃO prova é o primeiro**: quantas pessoas ABRIRAM o
 * link. `?amiga=` e `?ref=` são guardados no navegador e só viram linha quando
 * a conta é criada — antes disso não há rastro nenhum. Este arquivo diz isso em
 * voz alta (`SEM_MEDIDA`) em vez de estimar: um número inventado no topo do
 * funil faria todas as taxas abaixo dele mentirem juntas.
 */

/** Um degrau do funil. */
export type Degrau = {
  chave: string;
  rotulo: string;
  /** `null` = não medido. Ver `SEM_MEDIDA`. */
  quantos: number | null;
  /** O que exatamente foi contado, para ninguém ler o número errado. */
  comoFoiContado: string;
};

/**
 * ⚠️ O texto que a tela mostra no lugar de um número que não existe.
 *
 * Nunca "0", nunca "—": zero é uma medida, e uma taxa calculada sobre ele
 * mente. "Não medido" é a única resposta honesta.
 */
export const SEM_MEDIDA = "não medido";

export type Funil = {
  degraus: Degrau[];
  /** Convites que EXISTEM: quantas pacientes já têm código para convidar. */
  comCodigo: number;
  /**
   * De cada 100 aberturas de link, quantas viraram conta — **dentro da mesma
   * janela**. `null` quando a medição ainda não existe.
   *
   * ⚠️ **Ela sai daqui pronta, e a tela não a calcula.** O par certo é
   * `visitas` × `chegaramNaJanela`; usar `chegaram` (que é de sempre) contra
   * `visitas` (que é de 30 dias) daria uma taxa acima de 3.000% num painel que
   * ninguém volta a acreditar. Deixar a conta na tela é deixar a armadilha na
   * tela.
   */
  taxaDaJanela: number | null;
};

export type FatosDoFunil = {
  /**
   * Contas com `referred_by` OU `ref_code` — contadas UMA vez.
   *
   * ⚠️ Não é `porAmiga + porCriadora`: os dois campos convivem na mesma linha.
   */
  chegaram: number;
  /** Contas com `referred_by` — vieram pelo convite de outra paciente. */
  porAmiga: number;
  /** Contas com `ref_code` — vieram pelo link de uma criadora. */
  porCriadora: number;
  /** Dessas, quantas publicaram ao menos uma vez na Comunidade. */
  publicaram: number;
  /** Dessas, quantas seguem ao menos uma pessoa. */
  conectaram: number;
  comCodigo: number;
  /**
   * Aberturas de link nos últimos {@link JANELA_DE_VISITAS} dias — ou `null`
   * quando a medição ainda não existe (banco sem a tabela).
   *
   * ⚠️ **É UMA JANELA, e os degraus abaixo são de SEMPRE.** A contagem começou
   * no dia em que a tabela nasceu; comparar "12 visitas" com "380 contas
   * criadas desde o começo do app" produziria uma taxa acima de 3.000% e um
   * painel que ninguém volta a acreditar. Por isso a taxa deste degrau usa
   * `chegaramNaJanela`, e nunca `chegaram`.
   */
  visitas?: number | null;
  /** Contas por convite criadas DENTRO da mesma janela — o par da taxa. */
  chegaramNaJanela?: number | null;
};

/**
 * Quantos dias a contagem de aberturas cobre.
 *
 * ⚠️ **Trinta, e o mesmo número dos dois lados.** O que faz a taxa significar
 * alguma coisa não é o tamanho da janela: é ela ser a MESMA no numerador e no
 * denominador. Mudar aqui muda os dois, porque é uma constante só.
 */
export const JANELA_DE_VISITAS = 30;

/**
 * Monta os degraus.
 *
 * ⚠️ **A ordem é a do funil, e cada degrau diz COMO foi contado.** Um painel de
 * conversão sem essa linha é onde alguém lê "publicaram: 12" como "12 posts" —
 * e decide sobre uma métrica que nunca existiu.
 */
/**
 * Quantos "seguir" o próprio app escreve por conta.
 *
 * ⚠️ **É por isso que o degrau começa a contar no SEGUNDO.** `paresDoSeguir`
 * grava uma linha da recém-chegada para a indicadora no instante da
 * atribuição. Um degrau que contasse "segue ao menos uma pessoa" mediria essa
 * escrita e ficaria em ~100% para sempre — um número que sobe sozinho, num
 * painel que existe para dizer ao dono onde o funil vaza.
 */
export const SEGUIR_AUTOMATICO = 1;

export function montarFunil(f: FatosDoFunil): Funil {
  /* ⚠️ **NUNCA `porAmiga + porCriadora`.** Os dois campos convivem na mesma
     linha (quem entrou pelo link de uma amiga pode digitar depois o código de
     uma embaixadora no Perfil), então a soma conta essa paciente duas vezes e
     infla o denominador de todas as taxas abaixo. `chegaram` é contado à parte,
     com `OR`, e o recuo é o MAIOR dos dois — nunca a soma. */
  const chegaram = Math.max(f.chegaram, f.porAmiga, f.porCriadora);
  return {
    comCodigo: f.comCodigo,
    taxaDaJanela: taxa(f.visitas ?? null, f.chegaramNaJanela ?? null),
    degraus: [
      {
        chave: "abriram",
        rotulo: `Abriram o link (${JANELA_DE_VISITAS} dias)`,
        quantos: f.visitas ?? null,
        comoFoiContado:
          f.visitas == null
            ? "Não medido ainda: rode APLICAR_VISITAS_DE_CONVITE.sql para começar a contar."
            : `Aberturas de link nos últimos ${JANELA_DE_VISITAS} dias, contadas uma vez por ` +
              "visita. Sem IP e sem identificação de quem abriu — só o dia. " +
              "⚠️ É uma JANELA: os degraus abaixo são de sempre, e a taxa daqui " +
              `compara com as ${f.chegaramNaJanela ?? 0} contas criadas na mesma janela.`,
      },
      {
        chave: "criaram",
        rotulo: "Criaram conta por convite",
        quantos: chegaram,
        comoFoiContado:
          `${f.porAmiga} por convite de amiga · ${f.porCriadora} por link de criadora` +
          (f.porAmiga + f.porCriadora > chegaram
            ? ` · ${f.porAmiga + f.porCriadora - chegaram} têm os dois, e contam uma vez.`
            : "."),
      },
      {
        chave: "publicaram",
        rotulo: "Publicaram ao menos uma vez",
        quantos: f.publicaram,
        comoFoiContado: "Contas vindas por convite com pelo menos uma publicação não arquivada.",
      },
      {
        chave: "conectaram",
        rotulo: "Seguem alguém além de quem as trouxe",
        quantos: f.conectaram,
        comoFoiContado:
          `Contas vindas por convite com mais de ${SEGUIR_AUTOMATICO} seguir ativo. ` +
          "O primeiro é escrito pelo próprio app na atribuição do convite, então " +
          "contá-lo mediria a nossa automação, e não a paciente.",
      },
    ],
  };
}

/**
 * A taxa entre dois degraus — ou `null`.
 *
 * ⚠️ **`null` quando qualquer um dos dois não foi medido, e quando o de cima é
 * zero.** Dividir por zero devolveria `Infinity`, e calcular sobre um degrau
 * não medido produziria uma porcentagem que parece exata e não é. É o mesmo
 * cuidado de `getGrowthMetrics` rotular as premissas.
 */
export function taxa(deCima: number | null, deBaixo: number | null): number | null {
  if (deCima === null || deBaixo === null) return null;
  if (deCima <= 0) return null;
  return Math.round((deBaixo / deCima) * 1000) / 10;
}
