import { funcaoDoServidor } from "~/servidor/ponte";

/** src/lib/conta.functions.ts e src/lib/care-mode.functions.ts */

export const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";

/** Exclusão de conta DENTRO do app (diretriz 5.1.1(v) da Apple). */
export const excluirMinhaConta = funcaoDoServidor<
  { confirmacao: string },
  { ok: true } | { ok: false; motivo: "confirmacao" | "sessao" | "medico" | "falhou" }
>("src/lib/conta.functions.ts", "excluirMinhaConta");

export const apagarMinhasConversas = funcaoDoServidor<
  Record<string, never>,
  { ok: true } | { ok: false; motivo: "sessao" | "falhou" }
>("src/lib/conta.functions.ts", "apagarMinhasConversas");

/** O Modo Cuidado (luto) não é gravado pelo app: passa pelo servidor. */
export const ligarModoCuidado = funcaoDoServidor<
  { on: boolean },
  { ok: true; careMode: boolean } | { ok: false; error: string }
>("src/lib/care-mode.functions.ts", "setCareMode");
