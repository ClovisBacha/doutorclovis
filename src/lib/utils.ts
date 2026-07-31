import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Data em YYYY-MM-DD no fuso LOCAL do usuário. Nunca use
 * `new Date().toISOString().slice(0,10)` para "hoje": em BRT (UTC-3) o ISO
 * rola para o dia seguinte a partir das 21h e o app inteiro erra a data.
 */
export function ymdLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Data em YYYY-MM-DD no fuso do CONSULTÓRIO — para carimbos feitos no SERVIDOR.
 *
 * `ymdLocal` não serve aqui: numa server function o "local" é o fuso da
 * máquina, e na Vercel isso é UTC. Foi o que fez `fetal_bpm_at` ser gravado
 * como 31/07 numa teleconsulta das 21h15 do dia 30 — e o cartão "ouvimos o
 * coração do seu bebê" simplesmente não aparecia para ela naquela noite, porque
 * o cliente calculava `days = -1` e a guarda exige `days >= 0`.
 *
 * O fuso é fixo em America/Sao_Paulo, e é uma decisão, não um descuido: este é
 * um produto brasileiro (CRM, CFM, pt-BR, Real), e um carimbo de DATA precisa
 * de um fuso definido — "o fuso do servidor" não é um. No dia em que houver
 * consultório fora do horário de Brasília, o fuso vira coluna do médico e este
 * é o único lugar a mudar.
 */
export function ymdBrasilia(d: Date = new Date()): string {
  /* `en-CA` porque devolve exatamente YYYY-MM-DD. Formatar e reler é mais
     confiável que somar offset na mão: o Intl conhece o histórico de horário de
     verão, e este país já mudou de regra várias vezes. */
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
