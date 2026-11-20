import type { ModoDaData } from "~/lib/ritual";

/**
 * AS RESPOSTAS DO FUNIL "MONTAR O MEU PLANO" (20/11/2026).
 *
 * O dono, ao mandar as telas de um app que converte muito bem: "um processo
 * [...] onde a pessoa fica preenchendo informações, muitas informações. O
 * aplicativo demonstra informações ali, validando que o aplicativo é bom".
 * Ela responde ANTES de criar a conta; as respostas ficam no aparelho e, depois
 * do cadastro, `app/guardar-plano.tsx` grava no perfil o que o perfil já tem
 * (o nome, a data, o bebê) e guarda o resto SÓ no aparelho.
 *
 * ⚠️ O que ela sente e o que a preocupa são dados íntimos: nunca saem do
 * aparelho. Servem para a Bolha e o plano falarem com ela, e mais nada. Depois
 * do cadastro, a cópia muda para uma chave com o uid e o prefixo "dc-" (que o
 * sair da conta apaga, `limparRastrosLocais`).
 */

export type Fase = "gravida" | "nasceu";

export type Sentir = "tranquila" | "animada" | "cansada" | "ansiosa" | "de-tudo";

export type Preocupacao =
  | "semanas"
  | "ansiedade"
  | "tempo"
  | "corpo"
  | "parto"
  | "sozinha"
  | "mundo-do-bebe"
  | "sono"
  | "nenhuma";

export type Pilar = "aprender" | "calma" | "mexer" | "vinculo" | "memorias";

export type Minutos = 3 | 5 | 10 | 15;

export type Momento = "manha" | "almoco" | "tarde" | "noite";

export type Amiga = "codigo" | "depois" | "sozinha";

export type RespostasDoPlano = {
  versao: 1;
  nome: string;
  fase: Fase | null;
  /** Como ela data a gestação (ou "nasceu"), na mesma régua do ritual. */
  modo: ModoDaData;
  /** "dd/mm/aaaa", como a máscara escreve. */
  data: string;
  semanasUs: string;
  diasUs: string;
  bebe: string;
  primeira: boolean | null;
  sentir: Sentir | null;
  preocupacoes: Preocupacao[];
  pilares: Pilar[];
  minutos: Minutos | null;
  momento: Momento | null;
  amiga: Amiga | null;
  codigo: string;
  /** Quando ela chegou ao "plano pronto" (ISO): o funil está completo. */
  completoEm: string | null;
};

export const RESPOSTAS_VAZIAS: RespostasDoPlano = {
  versao: 1,
  nome: "",
  fase: null,
  modo: "dum",
  data: "",
  semanasUs: "",
  diasUs: "",
  bebe: "",
  primeira: null,
  sentir: null,
  preocupacoes: [],
  pilares: [],
  minutos: null,
  momento: null,
  amiga: null,
  codigo: "",
  completoEm: null,
};

/** Antes da conta não há uid: a chave é do aparelho, e não começa com "dc-". */
export const CHAVE_DO_PLANO_SEM_CONTA = "me-plano-respostas";

/** Depois do cadastro, por conta (apagada no sair). */
export const chaveDoPlano = (uid: string) => `dc-plano:${uid}`;

const SENTIRES: readonly Sentir[] = ["tranquila", "animada", "cansada", "ansiosa", "de-tudo"];
const PREOCUPACOES: readonly Preocupacao[] = [
  "semanas",
  "ansiedade",
  "tempo",
  "corpo",
  "parto",
  "sozinha",
  "mundo-do-bebe",
  "sono",
  "nenhuma",
];
const PILARES: readonly Pilar[] = ["aprender", "calma", "mexer", "vinculo", "memorias"];
const MINUTOS: readonly Minutos[] = [3, 5, 10, 15];
const MOMENTOS: readonly Momento[] = ["manha", "almoco", "tarde", "noite"];
const AMIGAS: readonly Amiga[] = ["codigo", "depois", "sozinha"];

const texto = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : "");
const um = <T>(lista: readonly T[], v: unknown): T | null =>
  lista.includes(v as T) ? (v as T) : null;
const varios = <T>(lista: readonly T[], v: unknown): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x) => lista.includes(x as T)) as T[])] : [];

/**
 * Lê o que estava guardado, tolerante: o que não reconhece volta ao vazio
 * (um aparelho com uma versão antiga, ou um JSON estragado, nunca derruba a
 * entrada).
 */
export function lerRespostas(bruto: unknown): RespostasDoPlano {
  if (!bruto || typeof bruto !== "object") return { ...RESPOSTAS_VAZIAS };
  const r = bruto as Record<string, unknown>;
  const modo = r.modo === "us" || r.modo === "nasceu" ? r.modo : "dum";
  return {
    versao: 1,
    nome: texto(r.nome),
    fase: r.fase === "gravida" || r.fase === "nasceu" ? r.fase : null,
    modo,
    data: texto(r.data, 10),
    semanasUs: texto(r.semanasUs, 2),
    diasUs: texto(r.diasUs, 1),
    bebe: texto(r.bebe),
    primeira: typeof r.primeira === "boolean" ? r.primeira : null,
    sentir: um(SENTIRES, r.sentir),
    preocupacoes: varios(PREOCUPACOES, r.preocupacoes),
    pilares: varios(PILARES, r.pilares),
    minutos: um(MINUTOS, r.minutos),
    momento: um(MOMENTOS, r.momento),
    amiga: um(AMIGAS, r.amiga),
    codigo: texto(r.codigo, 20),
    completoEm: typeof r.completoEm === "string" ? r.completoEm : null,
  };
}

/** O funil chegou ao plano pronto, com a data que o perfil precisa. */
export function planoCompleto(r: RespostasDoPlano): boolean {
  return !!r.completoEm && !!r.fase && /^\d{2}\/\d{2}\/\d{4}$/.test(r.data.trim());
}

/** Marca uma opção de várias, com "nenhuma" exclusiva (ela tira as outras, e as outras a tiram). */
export function alternarPreocupacao(atual: Preocupacao[], p: Preocupacao): Preocupacao[] {
  if (atual.includes(p)) return atual.filter((x) => x !== p);
  if (p === "nenhuma") return ["nenhuma"];
  return [...atual.filter((x) => x !== "nenhuma"), p];
}

export function alternar<T>(atual: T[], v: T): T[] {
  return atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v];
}

/** A hora do lembrete de cada momento do dia. */
export const HORA_DO_MOMENTO: Readonly<Record<Momento, string>> = {
  manha: "08:00",
  almoco: "12:30",
  tarde: "16:00",
  noite: "21:00",
};
