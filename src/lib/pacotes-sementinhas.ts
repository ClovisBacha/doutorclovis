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
 * ─── ⚠️ O BÔNUS É DE OUTRO BOLSO: ELE SÓ PRESENTEIA (ago/2026) ──────────
 *
 * Pedido do dono, e ele muda o SIGNIFICADO dos números, não só o valor: "esse
 * bônus, ele só pode ser usado pra você dar outras sementinhas pras suas
 * amizades, pras suas amigas, pra outras contas".
 *
 * Por isso o campo se chama `bonusParaPresentear` e não mais `bonus`. Renomear
 * foi de propósito — era a única forma de obrigar cada lugar que o lia a ser
 * relido, e o pior desfecho possível aqui seria alguém somar os dois bolsos
 * sem reparar que agora são moedas diferentes.
 *
 * ⚠️ SOMAR OS DOIS É MENTIRA. `base` compra enfeite no Cantinho dela;
 * `bonusParaPresentear` não compra NADA para ela — só vai para uma amiga. Um
 * "Total: 12.500" no cartão prometeria 12.500 de poder de compra e entregaria
 * 10.000, que é a categoria de erro mais cara que uma loja pode ter. Daí o
 * número grande do cartão ser a BASE, e o bônus aparecer à parte, dizendo em
 * voz alta para que serve.
 *
 * É o mesmo desenho da `MESADA_DA_ASSINANTE` (o bolso mensal do Premium, que
 * ela também só pode dar) — o bônus comprado é aquele bolso, comprado.
 *
 * ⚠️ E ISSO REBAIXOU A FATIA DO CATÁLOGO, de propósito. Antes o topo entregava
 * 15.000 gastáveis, ~52% do catálogo. Agora entrega 10.000 gastáveis, ~35%:
 * quem compra o maior pacote continua tendo muito o que querer depois — que é
 * exatamente o problema que o reajuste do catálogo veio resolver
 * (15.000 valiam 101% do catálogo de então; ela comprava uma vez e acabava o
 * jogo). Ver o cabeçalho de `cantinho.ts`.
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
  /** O que cai na carteira DELA — o único bolso que compra enfeite. */
  base: number;
  /**
   * ⚠️ O brinde, e ele é de OUTRO BOLSO: só serve para presentear amigas.
   *
   * NUNCA some com `base` para mostrar um "total" — são moedas diferentes, e
   * o cartão prometeria poder de compra que não existe. O nome é longo por
   * isso: `bonus` sozinho convida à soma.
   */
  bonusParaPresentear: number;
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
    /* 2.500, e não os 5.000 de antes — número do dono. Ver o cabeçalho: com o
       bônus virando bolso de presente, 5.000 seriam 125 presentes de 40 🌱
       guardados numa conta que talvez tenha três amigas. */
    bonusParaPresentear: 2_500,
    centavos: 9_990,
    rotulo: "Celeiro",
    cor: "verde",
    destaque: true,
  },
  {
    id: "sem-5000",
    base: 5_000,
    bonusParaPresentear: 1_000,
    centavos: 5_990,
    rotulo: "Cesto",
    cor: "azul",
  },
  {
    id: "sem-1000",
    base: 1_000,
    bonusParaPresentear: 100,
    centavos: 1_490,
    rotulo: "Saquinho",
    cor: "roxo",
  },
];

export const PACOTE_POR_ID: Record<string, PacoteSementinhas> = Object.fromEntries(
  PACOTES.map((p) => [p.id, p]),
);

/**
 * ⚠️ TUDO que o pacote entrega — os DOIS bolsos somados.
 *
 * Serve para comparar pacotes entre si (`porReal`) e para mais nada. NÃO é o
 * número grande do cartão, e não é o que ela pode gastar: metade dele, no
 * topo, só sai da conta indo para uma amiga. Quem responde "quanto ela pode
 * gastar" é `gastavelDoPacote`.
 *
 * O nome mudou de `totalDoPacote` para `totalEntregue` junto com a renomeação
 * de `bonus`: "total do pacote" é exatamente a expressão que faz alguém
 * escrevê-lo num cartão como se fosse saldo.
 */
export function totalEntregue(p: PacoteSementinhas): number {
  return p.base + p.bonusParaPresentear;
}

/**
 * O que ela pode GASTAR consigo — só a base.
 *
 * É este o número grande do cartão, e é este que entra na conta de "quanto do
 * catálogo uma compra cobre": o bônus não compra um enfeite sequer.
 */
export function gastavelDoPacote(p: PacoteSementinhas): number {
  return p.base;
}

/** Sementinhas por real — a medida de vantagem do pacote. */
export function porReal(p: PacoteSementinhas): number {
  return totalEntregue(p) / (p.centavos / 100);
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
