/**
 * Pacotes de Sementinhas — a única coisa do app que se compra com dinheiro
 * além da assinatura.
 *
 * ─── O que muda no contrato do jogo ─────────────────────────────────────
 *
 * Até aqui a regra escrita em `sementinhas.functions.ts` era: "ganho só por
 * autocuidado / educação / marcos". Vender Sementinhas abre uma segunda porta,
 * e ela precisa ser honesta consigo mesma:
 *
 * · Nada do que a Sementinha compra é CUIDADO. Ela compra enfeite: plantinha,
 *   bichinho, cenário, pele da trilha. Nenhuma aula, nenhum exame, nenhum
 *   alerta, nenhuma conduta clínica está atrás dela — e isso não pode mudar.
 *   No dia em que uma Sementinha comprar informação de saúde, o app terá
 *   passado a cobrar por cuidado, que é outro negócio.
 * · O ganho por jogar CONTINUA INTEIRO. O pacote encurta caminho para quem
 *   quer; não é condição para nada.
 * · Sem oferta relâmpago, sem contador, sem pacote "que some". Vender pressa
 *   para grávida de alto risco é o oposto do que este app é.
 *
 * ─── ⚠️ TRÊS PACOTES, E OS NÚMEROS SÃO DO DONO (ago/2026) ───────────────
 *
 * Eu tinha proposto cinco faixas, com uma de R$ 4,90 na entrada. O dono
 * recusou as duas coisas, e tinha razão nas duas:
 *
 *  1. **Cinco é menu de jogo hardcore.** Clash of Clans tem seis faixas
 *     porque caça quem gasta muito toda semana; Duolingo — que é o
 *     comparável de verdade (assinatura + moeda ganha jogando + loja
 *     cosmética) — roda com duas. A maioria das nossas pacientes vai abrir
 *     uma loja de moeda pela primeira vez na vida.
 *  2. **Abaixo de mil não parece compra.** Palavras dele: "quatrocentos e
 *     cinquenta, cento e cinquenta sementinhas, a pessoa não compra nada".
 *     Com o catálogo reajustado, 1.000 🌱 compram o item MAIS CARO da loja e
 *     ainda sobra — é uma compra completa, não uma fração.
 *
 * ─── ⚠️ O BÔNUS É O QUE FAZ A ESCADA, E ELE TEM UM CUSTO ────────────────
 *
 * Cada pacote entrega `base + bonus`. O bônus cresce muito mais rápido que o
 * preço (10% → 20% → 50%), e é ele que transforma o maior pacote no melhor
 * negócio sem precisar de desconto nenhum.
 *
 * Foi o bônus do topo que obrigou o reajuste do catálogo: 15.000 🌱 numa
 * compra só valiam 101% do catálogo de então (14.894 🌱). Ela compraria uma
 * vez e não sobraria mais nada para querer. Hoje o catálogo custa ~29.000 e a
 * mesma compra vale ~52% — ver o cabeçalho de `cantinho.ts`.
 *
 * ─── Onde se compra ─────────────────────────────────────────────────────
 *
 * Sementinhas são moeda virtual consumida dentro do app, então a compra passa
 * pela loja da Apple/Google — nunca pelo Stripe. Quem decide isso é
 * `canal-de-venda.ts`, inclusive no servidor: um checkout do Stripe É o canal
 * "site", e `sementinhas` tem canal "app", então a recusa não depende de nada
 * que o cliente informe.
 */

export type PacoteSementinhas = {
  id: string;
  /** O que ela paga — a base do pacote. */
  base: number;
  /** O que vem de brinde. Some com a base para dar o total. */
  bonus: number;
  /** Preço em CENTAVOS — inteiro. Dinheiro em float é como se perde um real. */
  centavos: number;
  rotulo: string;
  /**
   * A cor do cartão na loja, do layout que o dono desenhou: o maior é verde
   * (a cor da Sementinha), o do meio azul e o menor roxo.
   */
  cor: "verde" | "azul" | "roxo";
  /** O da fita "MELHOR VALOR" — exatamente um, e é sempre o maior. */
  destaque?: true;
};

/**
 * Os três, do maior para o menor — a MESMA ordem da tela.
 *
 * ⚠️ O maior vem primeiro de propósito. É a ordem do layout do dono, e ela
 * também é a que os jogos usam: mostrar o topo antes faz o do meio parecer
 * razoável. Inverter aqui inverteria a tela, porque ela renderiza na ordem
 * desta lista.
 */
export const PACOTES: PacoteSementinhas[] = [
  {
    id: "sem-10000",
    base: 10_000,
    bonus: 5_000,
    centavos: 9_990,
    rotulo: "Celeiro",
    cor: "verde",
    destaque: true,
  },
  { id: "sem-5000", base: 5_000, bonus: 1_000, centavos: 5_990, rotulo: "Cesto", cor: "azul" },
  { id: "sem-1000", base: 1_000, bonus: 100, centavos: 1_490, rotulo: "Saquinho", cor: "roxo" },
];

export const PACOTE_POR_ID: Record<string, PacoteSementinhas> = Object.fromEntries(
  PACOTES.map((p) => [p.id, p]),
);

/** O que entra na carteira: base + bônus. É este o número grande do cartão. */
export function totalDoPacote(p: PacoteSementinhas): number {
  return p.base + p.bonus;
}

/** Sementinhas por real — a medida de vantagem do pacote. */
export function porReal(p: PacoteSementinhas): number {
  return totalDoPacote(p) / (p.centavos / 100);
}

/** "R$ 99,90" — formatação única, para preço não divergir entre telas. */
export function precoBRL(p: PacoteSementinhas): string {
  return `R$ ${(p.centavos / 100).toFixed(2).replace(".", ",")}`;
}

/** "15.000" — separador de milhar, como no layout. */
export function numeroBR(n: number): string {
  return n.toLocaleString("pt-BR");
}

/**
 * Quanto o pacote rende a mais que o MENOR, em porcentagem.
 *
 * ⚠️ O menor é o último da lista, não o primeiro: a ordem da tela é do maior
 * para o menor. Ler `PACOTES[0]` daria a vantagem contra o topo, que é sempre
 * negativa — e a tela mostraria "-67%" no cartão que ela deve querer.
 *
 * ⚠️ **HOJE ELA NÃO TEM CHAMADOR, e isso é deliberado — por enquanto.** A tela
 * chegou a mostrar "rende +X% por real" e a linha SAIU: a referência do dono
 * não tinha esse número, e o pedido foi "exatamente dessa forma". A função fica
 * porque a escada de vantagem é a regra que os testes cobram (pacote maior
 * nunca rende menos por real) e é ela que dá o número quando a linha voltar.
 *
 * O comentário acima descrevia um defeito de TELA — "a tela mostraria -67%" —
 * numa função que nenhuma tela usa. Ficou registrado porque a armadilha
 * (`PACOTES[0]` em vez do último) espera quem for ligá-la de volta.
 */
export function vantagemSobreMenor(p: PacoteSementinhas): number {
  const base = porReal(PACOTES[PACOTES.length - 1]);
  return Math.round((porReal(p) / base - 1) * 100);
}

/* A pergunta "esta compra pode acontecer aqui?" NÃO mora neste arquivo.
   Havia um `podeComprarAqui` aqui, e a mesma regra vivia noutras cinco telas
   com o texto escrito à mão em cada uma — foi assim que as portas da paciente
   e as do médico acabaram com comportamentos diferentes.
   A regra e a frase moram em `canal-de-venda.ts`, uma vez só. */
