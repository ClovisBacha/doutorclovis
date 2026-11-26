import { fromCrossJSON, toJSONAsync } from "seroval";
import { SITE } from "~/config";
import { idDaFuncao } from "~/servidor/id-da-funcao";
import { tokenAtual } from "~/servidor/supabase";

/**
 * A PONTE PARA AS FUNÇÕES DE SERVIDOR DO SITE.
 *
 * O site é TanStack Start: a lógica de servidor (economia de sementinhas,
 * Comunidade, SOS, conquistas) mora em ~510 `createServerFn`, que o navegador
 * chama por POST em /_serverFn/<id>, com o corpo serializado pelo seroval.
 * O app nativo fala o MESMO protocolo — e por isso herda tudo isso sem uma
 * linha de servidor nova, com as mesmas travas (RLS, tetos, Modo Cuidado).
 *
 * Fora do navegador não existe CORS, então não há cabeçalho a liberar.
 *
 * ⚠️ O seroval aqui é a MESMA versão do servidor (1.5.2, fixada no
 * package.json): o formato do corpo é o dele, e uma versão diferente pode
 * desserializar errado sem erro nenhum.
 */

export class ErroDaPonte extends Error {
  constructor(
    public readonly motivo: "rede" | "tempo" | "servidor" | "funcao",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const TEMPO_LIMITE_MS = 25_000;

export async function serializarCorpo(data: unknown): Promise<string> {
  return JSON.stringify(await toJSONAsync({ data }));
}

/** Desmonta a resposta `{ result, error, context }` do servidor. */
export function lerResposta(json: unknown): unknown {
  const r = fromCrossJSON(json as never, { refs: new Map() }) as {
    result?: unknown;
    error?: unknown;
  };
  if (r && typeof r === "object" && r.error != null) {
    const msg = r.error instanceof Error ? r.error.message : String(r.error);
    throw new ErroDaPonte("funcao", msg);
  }
  return r?.result;
}

/**
 * Chama uma função de servidor. O token vai no cabeçalho Authorization (é o
 * que o middleware do site anexa no navegador) — e as funções que pedem
 * `accessToken` no corpo o recebem pelo chamador, como no site.
 */
async function chamarPorId<T>(id: string, data: unknown): Promise<T> {
  const token = await tokenAtual();
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  let resposta: Response;
  try {
    resposta = await fetch(`${SITE}/_serverFn/${id}`, {
      method: "POST",
      headers: {
        "x-tsr-serverFn": "true",
        accept: "application/json",
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: await serializarCorpo(data),
      signal: controle.signal,
    });
  } catch (e) {
    throw new ErroDaPonte(
      controle.signal.aborted ? "tempo" : "rede",
      controle.signal.aborted ? "O servidor demorou a responder." : "Sem conexão com a internet.",
    );
  } finally {
    clearTimeout(relogio);
  }
  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) {
    throw new ErroDaPonte("servidor", `Resposta inesperada do servidor (${resposta.status}).`);
  }
  const json = await resposta.json();
  if (resposta.headers.get("x-tss-serialized")) return lerResposta(json) as T;
  return json as T;
}

/**
 * Declara uma função de servidor do site para o app chamar.
 *
 *   export const meuFeed = funcaoDoServidor<Entrada, Saida>(
 *     "src/lib/rede-social.functions.ts", "meuFeed");
 *
 * ⚠️ Escreva o caminho e o nome como TEXTO LITERAL, nesta ordem: é assim que
 * a catraca do site (src/lib/ponte-do-app.test.ts) acha a declaração e
 * confere que a função existe. O `accessToken` da sessão entra no corpo
 * sozinho — quase toda função do site o lê de lá.
 */
export function funcaoDoServidor<
  Entrada extends Record<string, unknown> = Record<string, never>,
  Saida = unknown,
>(arquivo: string, nome: string): (entrada?: Entrada) => Promise<Saida> {
  const id = idDaFuncao(arquivo, nome);
  return async (entrada) => {
    const accessToken = await tokenAtual();
    return chamarPorId<Saida>(id, { ...(entrada ?? {}), ...(accessToken ? { accessToken } : {}) });
  };
}
