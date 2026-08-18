/**
 * AS COTAS — o item caro dividido em partes.
 *
 * Carrinho de R$ 1.200 ninguém dá sozinho. Doze cotas de R$ 100 todo mundo dá.
 * O mundo do casamento já provou isto há anos (o iCasei divide a partir de duas
 * cotas de R$ 10); o do bebê quase não usa.
 *
 * O que a cota muda não é o valor arrecadado — é QUEM participa. Em vez de três
 * pessoas com dinheiro, doze amigas. Numa gestação de alto risco, em que a rede
 * de apoio é o recurso mais escasso, doze pessoas envolvidas vale mais que o
 * carrinho.
 *
 * ⚠️ **NA v1 NÃO HÁ DINHEIRO PASSANDO POR AQUI.** Uma cota é uma PROMESSA
 * ("eu entro com R$ 100"), combinada por fora como já acontece num chá de
 * verdade. O app conta, não cobra. Isso dispensa de uma vez: merchant of
 * record, endereço de entrega (que nem existe em `patient_profiles`), estorno,
 * e a armadilha de `createOneTimeCheckout` cravar `metadata[product] =
 * "sementinhas"` — reusá-lo sem parametrizar faria o webhook creditar moeda em
 * vez de registrar presente.
 */

/* O formatador é o MESMO do resto do app (`dinheiro.ts`), nunca um
   `toLocaleString` local: o preço que ela cadastrou e o preço que a amiga lê
   têm de sair idênticos, e duas formatações divergem na primeira moeda. */
import { formatarDinheiro } from "@/lib/dinheiro";

/**
 * Divide o total em N cotas, em CENTAVOS INTEIROS.
 *
 * ⚠️ **A última cota absorve o resto, e é isso que faz a soma fechar.**
 * R$ 1.200 ÷ 7 é o caso que quebra: `Math.round(120000/7)` é 17143, e sete
 * delas somam 120001 — um centavo a mais, todo chá, para sempre. Arredondando
 * para baixo dá 120000 − 6 = um centavo a menos. Nenhum dos dois é aceitável
 * numa tela que diz à amiga quanto ela está prometendo.
 *
 * Nunca `numeric`, nunca float: `dinheiro.ts` é a régua, e centavo é inteiro.
 */
export function dividirEmCotas(centavosTotal: number, cotas: number): number[] {
  if (!Number.isInteger(centavosTotal) || centavosTotal <= 0) return [];
  if (!Number.isInteger(cotas) || cotas < 1) return [];

  const base = Math.floor(centavosTotal / cotas);
  const resto = centavosTotal - base * cotas;
  const partes = Array.from({ length: cotas }, () => base);
  /* O resto vai para a ÚLTIMA, não espalhado uma a uma: espalhar deixaria as
     primeiras cotas um centavo mais caras que as últimas, e a tela mostraria
     dois preços para a mesma cota. Uma diferença concentrada é explicável;
     duas faixas de preço não. */
  partes[cotas - 1] += resto;
  return partes;
}

/** Valor de uma cota qualquer, para a tela mostrar "12x de R$ 100,00". */
export function valorDaCota(centavosTotal: number, cotas: number): number {
  const p = dividirEmCotas(centavosTotal, cotas);
  return p.length ? p[0] : 0;
}

export type EstadoDaCota = {
  total: number;
  reservadas: number;
  restantes: number;
  fracao: number;
  fechada: boolean;
};

export function estadoDaCota(total: number, reservadas: number): EstadoDaCota {
  const t = Math.max(0, Math.floor(total) || 0);
  const r = Math.min(Math.max(0, Math.floor(reservadas) || 0), t);
  return {
    total: t,
    reservadas: r,
    restantes: Math.max(0, t - r),
    fracao: t > 0 ? r / t : 1,
    fechada: t > 0 && r >= t,
  };
}

export type RecusaDeCota = {
  ok: false;
  motivo: "cota-fechada" | "acima-do-restante" | "quantidade-invalida";
  maximo: number;
};

/**
 * O servidor pergunta isto DEPOIS de reler o saldo, nunca antes.
 *
 * ⚠️ A corrida é real: duas amigas na última cota, no mesmo segundo. Quem
 * decide é esta função, mas quem garante é o servidor reler e gravar na mesma
 * operação — uma régua pura chamada com um saldo velho responde "pode" com toda
 * a confiança do mundo.
 */
export function podeReservarCotas(
  total: number,
  jaReservadas: number,
  pedido: number,
): { ok: true } | RecusaDeCota {
  if (!Number.isInteger(pedido) || pedido < 1) {
    return { ok: false, motivo: "quantidade-invalida", maximo: 0 };
  }
  const e = estadoDaCota(total, jaReservadas);
  if (e.fechada) return { ok: false, motivo: "cota-fechada", maximo: 0 };
  if (pedido > e.restantes) {
    return { ok: false, motivo: "acima-do-restante", maximo: e.restantes };
  }
  return { ok: true };
}

/** Piso de uma cota. Abaixo disto a divisão vira vaquinha de trocado. */
export const COTA_MINIMA_CENTAVOS = 2500;

/**
 * Sugestões de divisão para um valor.
 *
 * ⚠️ **Nunca sugere cota abaixo de R$ 25.** "12x de R$ 8" transforma o carrinho
 * numa vaquinha de trocado e faz a amiga achar que o app está pedindo esmola —
 * o oposto do que a cota existe para fazer, que é deixar um presente grande ao
 * alcance de quem não daria sozinha.
 */
export function sugerirCotas(centavosTotal: number): number[] {
  if (!Number.isInteger(centavosTotal) || centavosTotal < COTA_MINIMA_CENTAVOS * 2) return [];
  const maximo = Math.floor(centavosTotal / COTA_MINIMA_CENTAVOS);
  return [4, 6, 8, 10, 12, 16, 20, 24].filter((n) => n >= 2 && n <= maximo).slice(0, 3);
}

/**
 * "12 de 12 cotas · fechado" · "5 de 12 cotas".
 *
 * ⚠️ Estado, nunca dívida — a mesma régua de `legendaDoTamanho`. "Faltam 7!"
 * é cobrança sobre a rede de uma gestante, e quem paga o constrangimento é ela.
 */
export function legendaDaCota(e: EstadoDaCota): string {
  const p = e.total === 1 ? "cota" : "cotas";
  if (e.fechada) return `${e.reservadas} de ${e.total} ${p} · fechado`;
  return `${e.reservadas} de ${e.total} ${p}`;
}

/** "12x de R$ 100,00" — o texto que convence. */
export function chamadaDaCota(centavosTotal: number, cotas: number): string {
  return `${cotas}x de ${formatarDinheiro(valorDaCota(centavosTotal, cotas), "BRL")}`;
}
