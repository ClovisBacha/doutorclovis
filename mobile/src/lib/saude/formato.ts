/**
 * Como a aba Saúde escreve número, hora e duração — num lugar só, e PURO
 * (sem react-native), para os testes do bun poderem importar.
 */

/** 68.4 → "68,4". `casas` é o máximo; zeros à direita saem. */
export function numeroBR(n: number, casas = 1): string {
  if (!Number.isFinite(n)) return "";
  const fator = 10 ** casas;
  const r = Math.round(n * fator) / fator;
  return String(r).replace(".", ",");
}

const dois = (n: number) => String(n).padStart(2, "0");

/** "14:20", no fuso do aparelho. */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** "2026-09-28" → "28/09". Lê a data civil sem passar por UTC. */
export function dataCurta(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? "");
  return m ? `${m[3]}/${m[2]}` : "";
}

/** O relógio de um cronômetro: "04:07" ou, passada uma hora, "1:04:07". */
export function relogio(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

/** Duração em fala: "45 s", "1 min 05 s", "18 min", "1 h 05 min". */
export function duracaoFalada(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  if (s < 60) return `${s} s`;
  if (s < 600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m} min ${dois(r)} s` : `${m} min`;
  }
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${dois(r)} min` : `${h} h`;
}

/** Início do dia de hoje, no fuso do aparelho, em ms. */
export function inicioDoDia(agora: number): number {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "hoje às 20:15", "ontem às 20:15" ou "28/09 às 20:15". */
export function quandoFoi(iso: string, agora: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const hoje = inicioDoDia(agora);
  const hora = horaCurta(iso);
  if (t >= hoje) return `hoje às ${hora}`;
  if (t >= hoje - 86400000) return `ontem às ${hora}`;
  const d = new Date(t);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${hora}`;
}
