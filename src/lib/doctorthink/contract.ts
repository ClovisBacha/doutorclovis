/**
 * DoctorThink — CONTRATO do produto (a "costura" entre o cérebro e o app).
 *
 * Define a fronteira que, hoje, a Obstétrica implementa por dentro (Supabase +
 * entitlements) e que, na Fase 2, um serviço DoctorThink standalone implementa
 * atrás de uma API (auth por API key, banco próprio, metering).
 *
 * Nada aqui importa Supabase/Obstétrica: são só tipos e interfaces. É o mapa
 * do que precisa ser satisfeito para o cérebro rodar em qualquer app.
 */
import type { BrainEntry, BrainPersona } from "./core";

/** Canal de uso — a Obstétrica usa app|whatsapp|teste; outro app define os seus. */
export type BrainChannel = "app" | "whatsapp" | "teste" | (string & {});

/** O que o app pergunta ao cérebro. */
export type BrainQuery = {
  /** Inquilino (app cliente). Na Obstétrica é implícito; no produto, o API key. */
  tenantId?: string;
  /** Profissional dono do cérebro (médico). */
  doctorId: string;
  /** Mensagem do usuário final (paciente). SÓ pontua relevância; nunca vaza no bloco. */
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

/** Configurações + conhecimento do profissional, como o storage entrega. */
export type BrainProfile = BrainPersona & {
  enabledApp: boolean;
  enabledWhatsapp: boolean;
};

/**
 * PORTA DE ARMAZENAMENTO — tudo que o cérebro precisa ler/escrever.
 * Hoje: implementado sobre o Supabase da Obstétrica. Fase 2: sobre o banco
 * próprio do DoctorThink. O núcleo (core.ts) não conhece nenhuma das duas.
 */
export interface BrainStore {
  /** Persona + toggles do profissional (null se não configurado). */
  loadProfile(doctorId: string): Promise<BrainProfile | null>;
  /** Entradas aprovadas do profissional (Q&A), mais recentes primeiro. */
  loadApprovedEntries(doctorId: string, limit: number): Promise<BrainEntry[]>;
  /** Busca semântica (pgvector/embeddings). null = indisponível → cai no keyword. */
  semanticSearch(doctorId: string, message: string, limit: number): Promise<BrainEntry[] | null>;
  /** Telemetria: o cérebro respondeu (fire-and-forget). */
  logHit(doctorId: string, channel: BrainChannel): void;
  /** Autoaprendizado: pergunta sem cobertura vira lacuna (fire-and-forget). */
  logGap(doctorId: string, message: string, channel: BrainChannel): void;
}

/**
 * POLÍTICA DE ACESSO — decide se o cérebro pode ser servido naquele canal.
 * Na Obstétrica é o plano do médico (entitlements). No produto, é a regra do
 * app cliente (plano, feature flag, etc.). Fica FORA do núcleo de propósito.
 */
export interface BrainAccessPolicy {
  channelEnabled(doctorId: string, channel: BrainChannel): Promise<boolean>;
}
