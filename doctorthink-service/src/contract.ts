/**
 * DoctorThink — CONTRATO do produto (a "costura" entre o cérebro e o app).
 *
 * Define a fronteira que a Obstétrica implementa (obstetrica-store.server.ts) e
 * que um serviço DoctorThink standalone implementará na Fase 3 (banco próprio,
 * API key, metering). O núcleo (core.ts) e o orquestrador (orchestrator.ts) não
 * conhecem Supabase nem Obstétrica — só falam com estas interfaces.
 */
import type { BrainEntry, BrainPersona } from "./core";

/** Canal de uso — a Obstétrica usa app|whatsapp|teste; outro app define os seus. */
export type BrainChannel = "app" | "whatsapp" | "teste" | (string & {});

/** O que o app pergunta ao cérebro. */
export type BrainQuery = {
  /** Inquilino (app cliente). No produto, resolvido pela API key. */
  tenantId?: string;
  /** Profissional dono do cérebro (médico). */
  doctorId: string;
  /** Mensagem do usuário final. SÓ pontua relevância; nunca vaza no bloco. */
  message: string;
  channel: BrainChannel;
};

/** O que o cérebro devolve para o app injetar no prompt do LLM. */
export type BrainContextResult = {
  block: string;
  hadCoverage: boolean;
  /** Canais habilitados para este profissional (o app decide o que fazer). */
  enabledChannels: Record<string, boolean>;
};

/**
 * Perfil do profissional como o storage entrega: persona + o mapa de canais já
 * COMPOSTO pela regra do app (plano + toggles). Assim a regra de acesso
 * (entitlements, na Obstétrica) fica no adaptador, e o orquestrador só lê o mapa.
 */
export type BrainProfile = BrainPersona & {
  channels: Record<string, boolean>;
};

/**
 * PORTA DE ARMAZENAMENTO — tudo que o cérebro precisa ler/escrever.
 * Hoje: Supabase da Obstétrica (obstetrica-store.server.ts). Fase 3: banco
 * próprio do DoctorThink. O núcleo/orquestrador não conhecem nenhuma das duas.
 */
export interface BrainStore {
  /** Persona + mapa de canais habilitados (sempre retorna; persona vazia = "" ). */
  loadProfile(doctorId: string): Promise<BrainProfile>;
  /** Entradas aprovadas do profissional (Q&A), mais recentes primeiro. */
  loadApprovedEntries(doctorId: string, limit: number): Promise<BrainEntry[]>;
  /** Busca semântica (pgvector/embeddings). null = indisponível → cai no keyword. */
  semanticSearch(doctorId: string, message: string, limit: number): Promise<BrainEntry[] | null>;
  /** Telemetria: o cérebro respondeu (fire-and-forget). */
  logHit(doctorId: string, channel: BrainChannel): void;
  /** Autoaprendizado: pergunta sem cobertura vira lacuna (fire-and-forget). */
  logGap(doctorId: string, message: string, channel: BrainChannel): void;
  /** Treino: adiciona uma entrada aprovada (Q&A) e a torna "encontrável". */
  addEntry(doctorId: string, question: string, answer: string): Promise<{ id: string } | null>;
}
