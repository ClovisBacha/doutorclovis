/**
 * Misturas de cor para o MATERIAL das atividades: o "lábio" embaixo do botão
 * (a cor dele, mais escura — o relevo da trilha da Jornada) e a ficha clara
 * atrás de um ícone saem da cor forte de cada atividade, em vez de dez tons
 * escritos à mão por paleta que desafinam quando a cor muda.
 * Sem react-native aqui: é testado pelo bun.
 */

type Rgb = readonly [number, number, number];

function lerHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hex2 = (v: number) =>
  Math.round(Math.min(255, Math.max(0, v)))
    .toString(16)
    .padStart(2, "0");

/** `a` misturada com `b` na proporção `t` (0 = só `a`, 1 = só `b`). Cor inválida volta como veio. */
export function misturar(a: string, b: string, t: number): string {
  const x = lerHex(a);
  const y = lerHex(b);
  if (!x || !y) return a;
  const k = Math.min(1, Math.max(0, t));
  return `#${hex2(x[0] + (y[0] - x[0]) * k)}${hex2(x[1] + (y[1] - x[1]) * k)}${hex2(x[2] + (y[2] - x[2]) * k)}`;
}

export const escurecer = (cor: string, t: number) => misturar(cor, "#000000", t);
export const clarear = (cor: string, t: number) => misturar(cor, "#ffffff", t);

/** A cor com transparência, para sombra e brilho (`rgba(...)`). */
export function comAlfa(cor: string, alfa: number): string {
  const x = lerHex(cor);
  if (!x) return cor;
  return `rgba(${x[0]},${x[1]},${x[2]},${Math.min(1, Math.max(0, alfa))})`;
}
