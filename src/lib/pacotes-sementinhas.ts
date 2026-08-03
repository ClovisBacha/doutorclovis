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
 * ─── Sobre a escala ─────────────────────────────────────────────────────
 *
 * O catálogo inteiro custa ~11.700 🌱 e o teto de ganho é ~70/dia. O pacote
 * grande (10.000) NÃO compra tudo — de propósito: um pacote que zera o jogo
 * mata o jogo.
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
  /** Quantas Sementinhas entram na carteira. */
  quantidade: number;
  /** Preço em CENTAVOS — inteiro. Dinheiro em float é como se perde um real. */
  centavos: number;
  rotulo: string;
};

/**
 * Os quatro pacotes. A âncora é o de 10.000 por R$ 249,00, definido pelo dono;
 * os outros três descem a partir dele.
 *
 * A escala é deliberadamente crescente em vantagem: quanto maior o pacote,
 * mais Sementinhas por real. É o padrão honesto — o contrário (pacote grande
 * com valor pior) é a pegadinha clássica de loja de jogo, e quem compra o
 * maior é justamente quem confiou mais.
 */
export const PACOTES: PacoteSementinhas[] = [
  { id: "sem-1000", quantidade: 1_000, centavos: 3_990, rotulo: "Punhado" },
  { id: "sem-2000", quantidade: 2_000, centavos: 6_990, rotulo: "Saquinho" },
  { id: "sem-5000", quantidade: 5_000, centavos: 13_990, rotulo: "Cesta" },
  { id: "sem-10000", quantidade: 10_000, centavos: 24_900, rotulo: "Jardim inteiro" },
];

export const PACOTE_POR_ID: Record<string, PacoteSementinhas> = Object.fromEntries(
  PACOTES.map((p) => [p.id, p]),
);

/** Sementinhas por real — a medida de vantagem do pacote. */
export function porReal(p: PacoteSementinhas): number {
  return p.quantidade / (p.centavos / 100);
}

/** "R$ 249,00" — formatação única, para preço não divergir entre telas. */
export function precoBRL(p: PacoteSementinhas): string {
  return `R$ ${(p.centavos / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Quanto o pacote rende a mais que o menor, em porcentagem — o "+61%" que a
 * tela mostra. Devolve 0 para o menor.
 */
export function vantagemSobreMenor(p: PacoteSementinhas): number {
  const base = porReal(PACOTES[0]);
  return Math.round((porReal(p) / base - 1) * 100);
}

/* A pergunta "esta compra pode acontecer aqui?" NÃO mora mais neste arquivo.
   Havia um `podeComprarAqui` aqui, e a mesma regra vivia noutras cinco telas
   com o texto escrito à mão em cada uma — foi assim que as portas da paciente
   e as do médico acabaram com comportamentos diferentes.
   A regra e a frase moram agora em `canal-de-venda.ts`, uma vez só. */
