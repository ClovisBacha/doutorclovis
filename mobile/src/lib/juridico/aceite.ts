/**
 * O ACEITE DOS TERMOS E DA PRIVACIDADE DO APP, por versão (fase 4).
 *
 * Até o build 41 o app abria as páginas do SITE — congeladas, e escritas para
 * outro produto (teleconsulta, médico assinante, Stripe, chatbot) — e o aceite
 * era um carimbo só do cadastro por e-mail: quem entrava pela Apple nunca
 * aceitava nada nem confirmava os 18 anos.
 *
 * Agora o documento é do app (`termos.ts`, `privacidade.ts`), tem VERSÃO, e o
 * aceite de cada versão fica nos metadados da conta (`auth.users`,
 * `raw_user_meta_data`) — gravados pelo próprio app, sem servidor novo.
 *
 * ⚠️ O dado de saúde tem consentimento PRÓPRIO (LGPD, art. 11, I: "de forma
 * específica e destacada"), separado do aceite dos Termos.
 *
 * Sem react-native: é testado pelo bun.
 */

/** A versão em vigor. Mudou o texto de forma relevante? Mude a data: todas aceitam de novo. */
export const VERSAO_DOS_TERMOS = "2026-10-28";

/** A data por extenso que os documentos mostram ("Versão de …"). */
export const DATA_DOS_TERMOS = "28 de outubro de 2026";

type Metadados = Record<string, unknown> | null | undefined;

/** A versão que ela aceitou, se aceitou alguma no app. */
export function versaoAceita(meta: Metadados): string | null {
  const v = meta?.termos_do_app;
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * Precisa aceitar? Sem aceite nenhum, ou com uma versão anterior à em vigor.
 * (O carimbo antigo do cadastro, `aceite_termos_em`, era de outros termos —
 * os do site — e não conta.)
 */
export function precisaAceitar(meta: Metadados, versao: string = VERSAO_DOS_TERMOS): boolean {
  const v = versaoAceita(meta);
  return v === null || v < versao;
}

/** O que se grava nos metadados da conta quando ela aceita. */
export function metadadosDoAceite(
  agora: Date,
  versao: string = VERSAO_DOS_TERMOS,
): Record<string, string> {
  const quando = agora.toISOString();
  return {
    termos_do_app: versao,
    termos_do_app_aceite_em: quando,
    maior_de_18_confirmado_em: quando,
    consentimento_dados_de_saude_em: quando,
  };
}
