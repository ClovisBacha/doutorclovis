import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import {
  chaveDaPermissao,
  permissaoVale,
  registroDaPermissao,
  type RegistroDaPermissao,
} from "~/lib/ia/regua-da-permissao";

/**
 * A permissão de IA no armazém do aparelho. A régua (versão, validade, texto)
 * está em `regua-da-permissao.ts`; aqui só há leitura e escrita.
 *
 * Qualquer tela que mande dado a uma IA (nutrição hoje; amanhã outra) usa
 * ESTAS funções — um "sim" é um só para o app inteiro, e retirar retira de
 * todas.
 */

/** O registro guardado, se ainda vale; `null` = ela ainda não permitiu. */
export async function lerPermissaoDeIA(uid: string): Promise<RegistroDaPermissao | null> {
  const bruto = await lerJson<unknown>(chaveDaPermissao(uid), null);
  return permissaoVale(bruto) ? (bruto as RegistroDaPermissao) : null;
}

/** Grava o "Permitir". Devolve `false` se o armazém falhou (a tela avisa). */
export async function concederPermissaoDeIA(uid: string): Promise<boolean> {
  return gravarJson(chaveDaPermissao(uid), registroDaPermissao());
}

/**
 * Retira a permissão. Da próxima vez que ela abrir uma tela com IA, a folha
 * aparece de novo e nada sai do aparelho até ela dizer sim.
 *
 * ⚠️ Não apaga a memória da conversa no banco (`nutricao_mensagens`): aquilo
 * é dela e já está guardado; retirar a permissão impede o PRÓXIMO envio.
 */
export async function revogarPermissaoDeIA(uid: string): Promise<void> {
  await apagar(chaveDaPermissao(uid));
}
