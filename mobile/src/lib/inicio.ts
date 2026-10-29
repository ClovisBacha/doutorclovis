/**
 * Contas puras da home (sem react-native: testáveis no bun).
 */

/** Dias até a data provável (DUM + 280), a partir dos dias de gestação. */
export function diasAteADpp(totalDias: number): number {
  return 280 - totalDias;
}

/** Fração da gestação percorrida (0 a 1), sobre 40 semanas. */
export function fracaoDaGestacao(totalDias: number): number {
  return Math.max(0, Math.min(1, totalDias / 280));
}

/** "24 semanas e 3 dias" / "24 semanas" / "1 semana e 1 dia". */
export function rotuloDaIdade(semanas: number, dias: number): string {
  const s = `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  if (!dias) return s;
  return `${s} e ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** A data provável, em dia/mês/ano local, a partir da DUM efetiva. */
export function dataProvavel(totalDias: number, hoje = new Date()): Date {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  d.setDate(d.getDate() + (280 - totalDias));
  return d;
}

export function dataCurta(d: Date): string {
  const meses = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Idade do bebê depois do parto, em texto ("3 semanas de vida", "2 meses"). */
export function idadeDoBebe(nascimentoYmd: string, hoje = new Date()): string | null {
  const [a, m, d] = nascimentoYmd.split("-").map(Number);
  if (!a || !m || !d) return null;
  const nasc = new Date(a, m - 1, d);
  const dias = Math.floor(
    (new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() - nasc.getTime()) /
      86_400_000,
  );
  if (dias < 0) return null;
  if (dias < 14) return `${dias} ${dias === 1 ? "dia" : "dias"} de vida`;
  if (dias < 90) {
    const s = Math.floor(dias / 7);
    return `${s} semanas de vida`;
  }
  const meses = Math.floor(dias / 30.44);
  return `${meses} ${meses === 1 ? "mês" : "meses"} de vida`;
}
