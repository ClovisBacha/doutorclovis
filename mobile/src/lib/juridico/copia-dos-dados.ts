import { CONTATO_EMAIL } from "~/config";
import { ymdLocal } from "~/lib/gestacao";

/**
 * A CÓPIA DOS DADOS — o direito de acesso e de portabilidade (LGPD, art. 18,
 * II e V) dentro do app, em Perfil → Baixar uma cópia dos meus dados.
 *
 * O servidor já monta o arquivo (`exportarMeusDados`, do site): uma lista de
 * permissão tabela a tabela, nada de dado de outra pessoa, e o que fica de
 * fora escrito DENTRO do arquivo. O app só o grava no cache, abre a folha de
 * compartilhar do iPhone e apaga a cópia (`arquivo-da-copia.ts`).
 *
 * ⚠️ Um arquivo que voltou com `falhas` NÃO é dito completo: alguma parte não
 * pôde ser lida, e ela pode apagar a conta confiando nele.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

export const PREFIXO_DA_COPIA = "obstetrica-meus-dados-";

/** Sem o nome dela; a data é a do aparelho (nunca o dia em UTC). */
export function nomeDaCopia(agora: Date): string {
  return `${PREFIXO_DA_COPIA}${ymdLocal(agora)}.json`;
}

export function ehCopiaDosDados(nome: string): boolean {
  return nome.startsWith(PREFIXO_DA_COPIA) && nome.endsWith(".json");
}

export type RespostaDaCopia =
  | { ok: true; arquivo: { falhas?: unknown } }
  | { ok: false; motivo: string };

/** O que a tela diz depois de pedir a cópia. */
export function recadoDaCopia(r: RespostaDaCopia): { texto: string; erro: boolean } {
  if (!r.ok) {
    if (r.motivo === "sessao")
      return { texto: "Sua sessão expirou. Entre de novo e repita.", erro: true };
    if (r.motivo === "medico")
      return {
        texto: `Esta é uma conta de médico — a cópia passa pelo suporte: ${CONTATO_EMAIL}.`,
        erro: true,
      };
    return { texto: "Não conseguimos montar o arquivo agora. Tente de novo.", erro: true };
  }
  const falhas = Array.isArray(r.arquivo.falhas) ? r.arquivo.falhas.length : 0;
  if (falhas > 0)
    return {
      texto: `O arquivo saiu sem uma parte: ${falhas === 1 ? "uma fonte não pôde ser lida" : `${falhas} fontes não puderam ser lidas`}. Tente de novo mais tarde ou escreva para ${CONTATO_EMAIL}.`,
      erro: true,
    };
  return {
    texto:
      "Pronto. O arquivo tem informações de saúde: guarde-o com o mesmo cuidado que teria com um exame.",
    erro: false,
  };
}
