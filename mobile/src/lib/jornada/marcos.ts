/**
 * OS MARCOS DO CALENDÁRIO — a semana nova (+25 🌱), o fim de um trimestre
 * (+100), o nascimento (+100) e cada mês do bebê (+25).
 *
 * O servidor paga sozinho, de propósito ("ninguém conquistou a semana 22 — ela
 * chegou"; `checkAndAwardAchievements`), e o app recebia em silêncio: o saldo
 * subia sem festa nem motivo. O site abria "chegou um novo marco" com o bebê
 * da semana. Aqui a festa sai do EXTRATO (`recent` da carteira, com o motivo
 * gravado pelo servidor): só se celebra o crédito que existe — nunca um
 * prometido.
 *
 * Os vistos moram no blob da jornada (`dc-path-marcos-vistos`): a festa
 * aparece uma vez, em um aparelho só. E só o que chegou nos últimos 3 dias:
 * quem atualiza o app não recebe a festa de marcos de meses atrás.
 * Sem react-native aqui: é testado pelo bun.
 */

export const CHAVE_MARCOS_VISTOS = "dc-path-marcos-vistos";

/** Quantos vistos guardar (o extrato traz os últimos 20 lançamentos). */
const MAXIMO_DE_VISTOS = 40;

/** Até quantos dias depois de pago um marco ainda vira festa. */
export const DIAS_DE_FESTA = 3;

export type Lancamento = { amount: number; reason: string; created_at: string };

export type Marco =
  | { tipo: "semana"; semana: number; sementinhas: number; chave: string }
  | { tipo: "trimestre"; trimestre: 1 | 2; sementinhas: number; chave: string }
  | { tipo: "nascimento"; sementinhas: number; chave: string }
  | { tipo: "mes"; meses: number; sementinhas: number; chave: string };

/** A chave de um lançamento: o motivo e o instante (dois ciclos não colidem). */
export const chaveDoLancamento = (l: Lancamento) => `${l.reason}|${l.created_at}`;

/** O marco que um lançamento é — pelos motivos que o servidor grava. */
export function marcoDoLancamento(l: Lancamento): Marco | null {
  if (!(l.amount > 0) || typeof l.reason !== "string") return null;
  const chave = chaveDoLancamento(l);
  const semana = /^Semana (\d{1,2}) 🎉$/.exec(l.reason);
  if (semana) return { tipo: "semana", semana: Number(semana[1]), sementinhas: l.amount, chave };
  const tri = /^Fim do ([12])º trimestre 🎊$/.exec(l.reason);
  if (tri)
    return { tipo: "trimestre", trimestre: Number(tri[1]) as 1 | 2, sementinhas: l.amount, chave };
  if (l.reason === "Bem-vindo ao mundo 🍼")
    return { tipo: "nascimento", sementinhas: l.amount, chave };
  const mes = /^Bebê com (\d{1,2}) (?:mês|meses) 🎉$/.exec(l.reason);
  if (mes) return { tipo: "mes", meses: Number(mes[1]), sementinhas: l.amount, chave };
  return null;
}

const PESO: Record<Marco["tipo"], number> = { nascimento: 4, trimestre: 3, mes: 2, semana: 1 };

export type Festa = {
  /** O marco que dá o título (o mais importante dos novos). */
  principal: Marco;
  /** A soma de todos os novos — a semana 13 chega junto com o fim do trimestre. */
  sementinhas: number;
  /** As chaves a guardar como vistas ao fechar. */
  chaves: string[];
};

/**
 * A festa a abrir agora, ou nenhuma: os marcos do extrato que ela ainda não
 * viu e que foram pagos há no máximo `DIAS_DE_FESTA` dias.
 */
export function festaDoExtrato(
  recent: readonly Lancamento[],
  vistos: readonly string[],
  agora: Date,
): Festa | null {
  const limite = agora.getTime() - DIAS_DE_FESTA * 86_400_000;
  const novos = recent
    .filter((l) => {
      const t = new Date(l.created_at).getTime();
      return Number.isFinite(t) && t >= limite && !vistos.includes(chaveDoLancamento(l));
    })
    .map(marcoDoLancamento)
    .filter((m): m is Marco => m != null);
  if (!novos.length) return null;
  const principal = [...novos].sort((a, b) => PESO[b.tipo] - PESO[a.tipo])[0]!;
  return {
    principal,
    sementinhas: novos.reduce((s, m) => s + m.sementinhas, 0),
    chaves: novos.map((m) => m.chave),
  };
}

/** Os vistos depois de fechar a festa: os novos entram, a lista não cresce sem fim. */
export function marcarVistos(vistos: readonly string[], novas: readonly string[]): string[] {
  return [...vistos.filter((v) => !novas.includes(v)), ...novas].slice(-MAXIMO_DE_VISTOS);
}

export function lerVistos(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
