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
};

export type FatosDoFunil = {
  /** Contas com `referred_by` — vieram pelo convite de outra paciente. */
  porAmiga: number;
  /** Contas com `ref_code` — vieram pelo link de uma criadora. */
  porCriadora: number;
  /** Dessas, quantas publicaram ao menos uma vez na Comunidade. */
  publicaram: number;
  /** Dessas, quantas seguem ao menos uma pessoa. */
  conectaram: number;
  comCodigo: number;
};

/**
 * Monta os degraus.
 *
 * ⚠️ **A ordem é a do funil, e cada degrau diz COMO foi contado.** Um painel de
 * conversão sem essa linha é onde alguém lê "publicaram: 12" como "12 posts" —
 * e decide sobre uma métrica que nunca existiu.
 */
export function montarFunil(f: FatosDoFunil): Funil {
  const chegaram = f.porAmiga + f.porCriadora;
  return {
    comCodigo: f.comCodigo,
    degraus: [
      {
        chave: "abriram",
        rotulo: "Abriram o link",
        quantos: null,
        comoFoiContado:
          "Não medido: o código fica no navegador e só vira linha quando a conta é criada.",
      },
      {
        chave: "criaram",
        rotulo: "Criaram conta por convite",
        quantos: chegaram,
        comoFoiContado: `${f.porAmiga} por convite de amiga · ${f.porCriadora} por link de criadora.`,
      },
      {
        chave: "publicaram",
        rotulo: "Publicaram ao menos uma vez",
        quantos: f.publicaram,
        comoFoiContado: "Contas vindas por convite com pelo menos uma publicação não arquivada.",
      },
      {
        chave: "conectaram",
        rotulo: "Seguem alguém",
        quantos: f.conectaram,
        comoFoiContado: "Contas vindas por convite que seguem ao menos uma pessoa.",
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
