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
