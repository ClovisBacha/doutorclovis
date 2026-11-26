import { PLANOS, type Plano } from "~/lib/assinatura/plano";

/**
 * OS PREÇOS DA TELA DE VENDA — funções puras, com teste.
 *
 * ⚠️ HONESTIDADE (Apple 2.3.1, 3.1.2 e 5.6; Código de Defesa do Consumidor):
 * todo preço vem do StoreKit (`displayPrice`, já no formato da loja dela).
 * Nada aqui escreve um preço à mão: o que se calcula (o por mês do anual, a
 * economia) parte dos números que a Apple devolveu, e é escrito NO FORMATO do
 * preço que ela devolveu (`formatarComoALoja`). Sem preço da Apple, sem
 * cálculo e sem número na tela.
 */

export type UnidadeDoPeriodo = "dia" | "semana" | "mes" | "ano";
export type Periodo = { unidade: UnidadeDoPeriodo; quantidade: number };

/**
 * A OFERTA INTRODUTÓRIA, se o App Store Connect tiver uma no produto E ela
 * tiver direito (quem já usou a do grupo não tem): o app não inventa oferta.
 * - `gratis`: dias grátis ("7 dias grátis, depois…");
 * - `por-periodo`: um preço menor a cada período, por alguns períodos;
 * - `adiantado`: um preço pago uma vez por um tempo.
 */
export type OfertaIntro = {
  modo: "gratis" | "por-periodo" | "adiantado";
  /** O preço da oferta, como a loja o escreve (vazio na grátis). */
  precoTexto: string;
  /** Um período da oferta. */
  periodo: Periodo;
  /** Quantos períodos ela dura. */
  repeticoes: number;
};

/** Um produto como a tela o usa (o invólucro do StoreKit o monta). */
export type ProdutoDaLoja = {
  plano: Plano;
  id: string;
  /** O preço como a loja o escreve ("R$ 99,90"). */
  precoTexto: string;
  /** O número do preço (99.9), para as contas. */
  preco: number | null;
  /** A moeda (ISO 4217, "BRL"). */
  moeda: string | null;
  oferta: OfertaIntro | null;
};

/* ── A oferta, a partir do que o StoreKit devolve ─────────────────────── */

/** O pedaço do produto do expo-iap que diz a oferta (estrutural: o teste não carrega o StoreKit). */
export type ProdutoBruto = {
  subscriptionOffers?:
    | readonly {
        type?: string | null;
        paymentMode?: string | null;
        displayPrice?: string | null;
        localizedPriceIOS?: string | null;
        period?: { unit?: string | null; value?: number | null } | null;
        periodCount?: number | null;
        numberOfPeriodsIOS?: number | null;
      }[]
    | null;
};

const UNIDADES: Record<string, UnidadeDoPeriodo> = {
  day: "dia",
  week: "semana",
  month: "mes",
  year: "ano",
};

/**
 * A oferta introdutória do produto (a padronizada, `subscriptionOffers`). O
 * que não se entende fica de fora: melhor não mostrar uma oferta que existe
 * (a folha da Apple mostra) do que prometer uma errada.
 */
export function ofertaIntrodutoria(p: ProdutoBruto): OfertaIntro | null {
  const o = (p.subscriptionOffers ?? []).find((x) => x?.type === "introductory");
  if (!o) return null;
  const modo =
    o.paymentMode === "free-trial"
      ? "gratis"
      : o.paymentMode === "pay-as-you-go"
        ? "por-periodo"
        : o.paymentMode === "pay-up-front"
          ? "adiantado"
          : null;
  if (!modo) return null;
  const unidade = UNIDADES[o.period?.unit ?? ""];
  const quantidade = Math.floor(o.period?.value ?? 0);
  if (!unidade || quantidade < 1) return null;
  const repeticoes = Math.max(1, Math.floor(o.periodCount ?? o.numberOfPeriodsIOS ?? 1));
  const precoTexto = (o.localizedPriceIOS || o.displayPrice || "").trim();
  if (modo !== "gratis" && !precoTexto) return null;
  return {
    modo,
    precoTexto: modo === "gratis" ? "" : precoTexto,
    periodo: { unidade, quantidade },
    repeticoes,
  };
}

/* ── As contas ────────────────────────────────────────────────────────── */

const centavos = (v: number) => Math.round(v * 100);

/**
 * QUANTO O ANUAL ECONOMIZA em relação a 12 meses do mensal, em %, ARREDONDADO
 * PARA BAIXO (nunca prometer um ponto a mais). Só aparece de 10% para cima;
 * sem os dois preços, ou em moedas diferentes, não há faixa.
 */
export function economiaDoAnual(
  anual: Pick<ProdutoDaLoja, "preco" | "moeda"> | null | undefined,
  mensal: Pick<ProdutoDaLoja, "preco" | "moeda"> | null | undefined,
): number | null {
  if (!anual || !mensal || anual.preco == null || mensal.preco == null) return null;
  if (anual.moeda && mensal.moeda && anual.moeda !== mensal.moeda) return null;
  const a = centavos(anual.preco);
  const doze = centavos(mensal.preco) * 12;
  if (a <= 0 || doze <= 0 || a >= doze) return null;
  const pct = Math.floor(((doze - a) * 100) / doze);
  return pct >= 10 ? pct : null;
}

/** O anual dividido por 12, em centavos arredondados (99,90 → 8,33). */
export function precoPorMesDoAnual(
  anual: Pick<ProdutoDaLoja, "preco"> | null | undefined,
): number | null {
  if (!anual || anual.preco == null || anual.preco <= 0) return null;
  return Math.round(centavos(anual.preco) / 12) / 100;
}

/**
 * Escreve `valor` NO FORMATO de um preço da loja: o mesmo símbolo, o mesmo
 * lugar do símbolo, o mesmo separador de decimais e de milhar, as mesmas
 * casas. ("R$ 99,90", 8.33) → "R$ 8,33"; ("$99.99", 8.33) → "$8.33". Sem
 * número no modelo, nada (a tela não mostra o que não sabe escrever).
 */
export function formatarComoALoja(modelo: string, valor: number): string | null {
  if (!Number.isFinite(valor) || valor < 0) return null;
  const achado = /\d(?:[\d.,   ']*\d)?/.exec(modelo);
  if (!achado) return null;
  const numero = achado[0];
  const ultimo = Math.max(numero.lastIndexOf(","), numero.lastIndexOf("."));
  let decimal: string | null = null;
  let casas = 0;
  let inteira = numero;
  if (ultimo >= 0) {
    const depois = numero.slice(ultimo + 1);
    if (/^\d+$/.test(depois) && depois.length !== 3) {
      decimal = numero[ultimo]!;
      casas = depois.length;
      inteira = numero.slice(0, ultimo);
    }
  }
  const sepDoMilhar = /[^\d]/.exec(inteira)?.[0] ?? (decimal === "," ? "." : ",");
  const unidades = Math.round(valor * 10 ** casas);
  const texto = String(unidades).padStart(casas + 1, "0");
  const parteInteira = casas ? texto.slice(0, -casas) : texto;
  const parteDecimal = casas ? texto.slice(-casas) : "";
  const agrupada = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, sepDoMilhar);
  const novo = decimal ? `${agrupada}${decimal}${parteDecimal}` : agrupada;
  return modelo.slice(0, achado.index) + novo + modelo.slice(achado.index + numero.length);
}

/* ── O que cada plano diz ─────────────────────────────────────────────── */

/** Os produtos na ordem da tela (anual, mensal, vitalício), só os que vieram. */
export function emOrdem(produtos: readonly ProdutoDaLoja[]): ProdutoDaLoja[] {
  return PLANOS.map((p) => produtos.find((x) => x.plano === p)).filter(
    (x): x is ProdutoDaLoja => !!x,
  );
}

/** O plano que nasce escolhido: o anual, se a loja o devolveu. */
export function planoPadrao(produtos: readonly ProdutoDaLoja[]): Plano | null {
  return emOrdem(produtos)[0]?.plano ?? null;
}

export function nomeDoPlano(plano: Plano): string {
  return plano === "anual" ? "Anual" : plano === "mensal" ? "Mensal" : "Vitalício";
}

/** O que vem depois do preço no cartão. */
export function porPeriodo(plano: Plano): string {
  return plano === "anual" ? "por ano" : plano === "mensal" ? "por mês" : "uma vez";
}

/** O texto do botão grande. */
export function textoDoBotao(plano: Plano): string {
  return plano === "anual"
    ? "Assinar plano anual"
    : plano === "mensal"
      ? "Assinar plano mensal"
      : "Comprar o vitalício";
}

/** "7 dias", "1 mês", "3 meses" (a semana vira dias: "7 dias grátis"). */
export function duracao(periodo: Periodo, repeticoes = 1): string {
  let n = periodo.quantidade * Math.max(1, repeticoes);
  let u = periodo.unidade;
  if (u === "semana") {
    n *= 7;
    u = "dia";
  }
  if (u === "dia") return n === 1 ? "1 dia" : `${n} dias`;
  if (u === "mes") return n === 1 ? "1 mês" : `${n} meses`;
  return n === 1 ? "1 ano" : `${n} anos`;
}

const NOME_DA_UNIDADE: Record<UnidadeDoPeriodo, string> = {
  dia: "dia",
  semana: "semana",
  mes: "mês",
  ano: "ano",
};

/** A oferta em uma linha: "7 dias grátis, depois R$ 99,90 por ano". */
export function textoDaOferta(produto: ProdutoDaLoja): string | null {
  const o = produto.oferta;
  if (!o || produto.plano === "vitalicio") return null;
  const depois = `depois ${produto.precoTexto} ${porPeriodo(produto.plano)}`;
  const tempo = duracao(o.periodo, o.repeticoes);
  if (o.modo === "gratis") return `${tempo} grátis, ${depois}`;
  if (o.modo === "adiantado") return `${o.precoTexto} pelos primeiros ${tempo}, ${depois}`;
  const cada = o.periodo.quantidade === 1 ? NOME_DA_UNIDADE[o.periodo.unidade] : duracao(o.periodo);
  return `${o.precoTexto} por ${cada} nos primeiros ${tempo}, ${depois}`;
}

/**
 * A linha de baixo do nome do plano, no cartão. Com oferta, duas linhas: a
 * oferta, e o que vem depois dela ("7 dias grátis" / "Depois, R$ 99,90 por ano").
 */
export function subDoCartao(produto: ProdutoDaLoja): string {
  const oferta = textoDaOferta(produto);
  if (oferta) {
    const [antes, depois] = oferta.split(", depois ");
    return depois ? `${antes}\nDepois, ${depois}` : oferta;
  }
  if (produto.plano === "vitalicio") return "Pague uma vez, use para sempre";
  if (produto.plano === "mensal") return "Cobrado todo mês";
  const mes = precoPorMesDoAnual(produto);
  const porMes = mes == null ? null : formatarComoALoja(produto.precoTexto, mes);
  return porMes ? `Equivale a ${porMes} por mês` : "Cobrado uma vez por ano";
}

/** A faixa do anual ("ECONOMIZE 76%"), só com 10% ou mais. */
export function faixaDoAnual(produtos: readonly ProdutoDaLoja[]): string | null {
  const pct = economiaDoAnual(
    produtos.find((p) => p.plano === "anual"),
    produtos.find((p) => p.plano === "mensal"),
  );
  return pct == null ? null : `ECONOMIZE ${pct}%`;
}

const CANCELAR = "Cancele quando quiser nos Ajustes do iPhone, até 24 horas antes da renovação.";

/**
 * A LETRA PEQUENA do plano escolhido, visível ANTES do botão: o preço, se
 * renova sozinha e como cancelar (Apple 3.1.2). O vitalício diz que é
 * pagamento único.
 */
export function letraPequena(produto: ProdutoDaLoja): string {
  const p = produto.precoTexto;
  if (produto.plano === "vitalicio")
    return `Você paga ${p} uma vez. Pagamento único, sem renovação.`;
  const renovacao = `Renovação ${produto.plano === "anual" ? "anual" : "mensal"} automática até você cancelar.`;
  const o = produto.oferta;
  if (!o) return `Você paga ${p} hoje. ${renovacao} ${CANCELAR}`;
  if (o.modo === "gratis") {
    return (
      `Hoje você não paga nada. Depois de ${duracao(o.periodo, o.repeticoes)} grátis, ` +
      `${p} ${porPeriodo(produto.plano)}. ${renovacao} Cancele nos Ajustes do iPhone até 24 horas ` +
      "antes do fim do período grátis e nada é cobrado."
    );
  }
  const oferta = textoDaOferta(produto) ?? "";
  return `${oferta.charAt(0).toUpperCase()}${oferta.slice(1)}. ${renovacao} ${CANCELAR}`;
}
