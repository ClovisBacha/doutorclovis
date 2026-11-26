/**
 * Datas digitadas como "dd/mm/aaaa" (sem seletor nativo: funciona igual no
 * iPhone, no Android e na bancada web). Régua pura, testada.
 */

/** Põe as barras enquanto ela digita: "0203" → "02/03". */
export function mascaraDeData(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "02/03/2026" → "2026-03-02", ou null se a data não existe. */
export function paraYmd(texto: string): string | null {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** "2026-03-02" → "02/03/2026". */
export function deYmd(ymd: string | null | undefined): string {
  const m = (ymd ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Dias inteiros entre uma data AAAA-MM-DD e hoje, no calendário local. */
export function diasDesde(ymd: string, hoje = new Date()): number {
  const [a, m, d] = ymd.split("-").map(Number);
  const inicio = new Date(a, m - 1, d).getTime();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return Math.round((fim - inicio) / 86_400_000);
}

export type RecusaDaData = "formato" | "futuro" | "antiga";

/** A DUM precisa estar entre hoje e ~43 semanas atrás. */
export function recusaDaDum(ymd: string | null, hoje = new Date()): RecusaDaData | null {
  if (!ymd) return "formato";
  const dias = diasDesde(ymd, hoje);
  if (dias < 0) return "futuro";
  if (dias > 301) return "antiga";
  return null;
}

/** A data do ultrassom: não pode estar no futuro nem antes da gestação. */
export function recusaDoUltrassom(
  ymd: string | null,
  semanas: number,
  hoje = new Date(),
): RecusaDaData | null {
  if (!ymd) return "formato";
  const dias = diasDesde(ymd, hoje);
  if (dias < 0) return "futuro";
  if (dias + semanas * 7 > 301) return "antiga";
  return null;
}

export const RECADO_DA_DATA: Record<RecusaDaData, string> = {
  formato: "Escreva a data como dia/mês/ano, por exemplo 02/03/2026.",
  futuro: "Essa data ainda não chegou. Confira o dia e o mês.",
  antiga: "Essa data passa de 43 semanas. Confira o ano.",
};
