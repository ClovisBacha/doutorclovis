/**
 * A SETA DA BARRA DE CIMA — para onde ela volta, e o que ela anuncia.
 *
 * ⚠️ **ELA SAIU DE `minha-conta.tsx` PORQUE A GARANTIA PRECISAVA SER
 * EXECUTADA.** Enterrada num arquivo de vinte e um mil linhas, a única forma de
 * exercitá-la era ler o FONTE e procurar palavras — e este repositório registra
 * dezoito vezes em que um teste de texto ficou verde sobre o defeito que ele
 * existia para pegar. Aqui, "volta para a grade" e "volta para a tela de onde
 * ela veio" são dois destinos diferentes, e o teste compara os dois.
 *
 * ─── OS DOIS DEFEITOS QUE ELA FECHA ─────────────────────────────────────────
 *
 * ⚠️ **1. `origem` GUARDAVA A ABA E NUNCA A SUB-TELA.** O único botão de
 * contato dos dois cronômetros clínicos — o cartão vermelho de movimentos
 * reduzidos e o de contrações — chama `onNavigate("Consultas")`. Na volta, a
 * paciente caía na GRADE de "Meu dia a dia" (Diário · Chutes · Contrações ·
 * Linha do tempo) em vez da tela de onde saiu: é exatamente a tela que o dono
 * reclamou ("quando você clica pra voltar, ele abre uma outra aba com diário,
 * com linha do tempo"). O conserto de set/2026 fechou a seta de DENTRO do
 * cabeçalho (`veioDeFora`) e deixou de pé a volta pelo médico. O contrato
 * escrito de `origem` sempre foi "entra numa tela a partir de outra e volta
 * para AQUELA" — e "aquela" era Chutes, não a grade.
 *
 * ⚠️ **2. A REGRA DO HUB ROUBAVA A VOLTA DE BEM-ESTAR E ALERTAS.** Ela olhava a
 * SEÇÃO da aba (`tabToSection === "saude"`, cinco abas) e mandava para o hub —
 * mas o hub tem CINCO LADRILHOS QUE NÃO SÃO AS MESMAS CINCO ABAS: Bem-estar e
 * Alertas estão na seção e não estão na grade, por decisão escrita do dono. O
 * voltar subia para um hub que não contém a tela de onde ela veio, descartando
 * `origem`. E o caminho é alcançável justamente em MODO CUIDADO: o cartão de
 * acolhimento tem "Apoio emocional" → Bem-estar, e de lá a seta anunciava
 * "Voltar para Caminho" e ia para a grade da Saúde.
 *
 * ⚠️ **E O RÓTULO SAI DO MESMO DESTINO, nunca de `origem` solto.** Era
 * `origem ? \`Voltar para ${origem}\` : "Voltar"` — o leitor de tela anunciava
 * um lugar que a regra do hub não honrava. Uma seta que promete um destino e
 * entrega outro é pior que uma seta sem rótulo.
 */

/** De onde ela veio: a aba E a sub-tela. Guardar só a aba perde o lugar. */
export type OrigemDaBarra = { tab: string; sub: string | null } | null;

export type EstadoDaBarra = {
  /** O hub aberto agora, quando ela está NELE. */
  hubAberto: string | null;
  /** "Vim de um hub para uma aba de outra seção" (Chutes, Contrações). */
  voltarAoHub: string | null;
  tab: string;
  origem: OrigemDaBarra;
  /** A seção da aba atual — `tabToSection`. */
  secao: string | null;
  /**
   * As abas que o hub da Saúde de fato CONTÉM.
   *
   * ⚠️ Derivadas de `HUB_SAUDE` pelo chamador, e nunca de `SECTION_TABS`: é a
   * diferença entre as duas listas que produzia o defeito 2.
   */
  abasDoHub: readonly string[];
};

export type DestinoDaBarra =
  | { t: "hub"; hub: string }
  | { t: "aba"; tab: string; sub: string | null }
  | { t: "home" };

/**
 * Para onde a seta volta.
 *
 * Três níveis, do mais específico para o mais genérico — a ordem é a de sempre;
 * o que mudou foi o ALCANCE da regra do hub e o que `origem` carrega.
 */
export function destinoDaBarra(e: EstadoDaBarra): DestinoDaBarra {
  /* Antes da regra do hub, e não depois: quem veio de um hub para uma aba de
     FORA da seção dele (Chutes, Contrações) volta para o hub. */
  if (!e.hubAberto && e.voltarAoHub) return { t: "hub", hub: e.voltarAoHub };
  /* ⚠️ `abasDoHub.includes`, e não `secao === "saude"` sozinho. */
  if (!e.hubAberto && e.secao === "saude" && e.abasDoHub.includes(e.tab)) {
    return { t: "hub", hub: "saude" };
  }
  if (e.origem) return { t: "aba", tab: e.origem.tab, sub: e.origem.sub };
  return { t: "home" };
}

/** O que a seta ANUNCIA — derivado do destino, nunca de `origem`. */
export function rotuloDaBarra(d: DestinoDaBarra): string {
  if (d.t === "hub") return "Voltar para a sua saúde";
  if (d.t === "aba") return `Voltar para ${d.tab}`;
  return "Voltar";
}
