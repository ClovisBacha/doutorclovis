import {
  comPacote,
  ehLocal,
  podar,
  semPacote,
  type PacoteLocal,
} from "@/lib/fila-local";

/**
 * AS DUAS FILAS OFFLINE DA SAÚDE (chutes e contrações) — a parte pura.
 *
 * O mecanismo (podar, pôr, tirar, mesclar) é o MESMO do site, importado de
 * `@/lib/fila-local`: duas filas escritas à mão divergiriam no primeiro
 * conserto, e a divergência apareceria como uma delas perdendo dado clínico
 * em silêncio. Aqui só muda o DISCO (AsyncStorage em vez de localStorage — ver
 * `armazem-de-filas.ts`) e o laço de subida, que ficou puro para ser testado.
 */

export type SessaoPendente = PacoteLocal & {
  ended_at: string;
  kick_count: number;
  /** 1 mais fraco · 2 como sempre · 3 mais forte. */
  strength: number;
};

export type ContracaoPendente = PacoteLocal & {
  ended_at: string | null;
  intensity: number;
};

export const chaveDaFilaDeChutes = (uid: string) => `dc-fila-chutes:${uid}`;
export const chaveDaFilaDeContracoes = (uid: string) => `dc-fila-contracoes:${uid}`;

export function ehSessaoPendente(x: unknown): x is SessaoPendente {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<SessaoPendente>;
  return (
    typeof s.id === "string" &&
    ehLocal(s.id) &&
    typeof s.started_at === "string" &&
    /* Só a sessão ENCERRADA entra nesta fila: sem fim, ela viraria uma linha
       aberta com "0 movimentos" no banco. */
    typeof s.ended_at === "string" &&
    typeof s.kick_count === "number" &&
    typeof s.strength === "number" &&
    typeof s.tentativas === "number"
  );
}

export function ehContracaoPendente(x: unknown): x is ContracaoPendente {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<ContracaoPendente>;
  return (
    typeof c.id === "string" &&
    ehLocal(c.id) &&
    typeof c.started_at === "string" &&
    (c.ended_at === null || typeof c.ended_at === "string") &&
    typeof c.intensity === "number" &&
    typeof c.tentativas === "number"
  );
}

/** O que veio do disco, saneado, podado e em ordem crescente. */
export function filaDoBruto<T extends PacoteLocal>(
  bruto: unknown,
  eh: (x: unknown) => x is T,
  agora: number,
): T[] {
  if (!Array.isArray(bruto)) return [];
  return podar(bruto.filter(eh), agora);
}

/** Na contração, só a ENCERRADA sobe — a aberta ainda vai ganhar `ended_at`. */
export const contracaoPronta = (c: ContracaoPendente) => c.ended_at != null;

export type ResultadoDaConferencia = "ja-esta" | "nao-esta" | "falhou";

/**
 * Sobe o que está pronto, um por um, na ordem em que aconteceu.
 *
 * ⚠️ A PARTIR DA 2ª TENTATIVA ELA CONFERE ANTES DE INSERIR. Nenhuma das duas
 * tabelas tem chave única: um insert que deu certo com a resposta perdida no
 * caminho viraria uma segunda linha no mesmo instante — e duas contrações no
 * mesmo minuto mudam o INTERVALO, o número que decide ir à maternidade. A
 * chave natural é o `started_at`. Falha ao conferir NÃO insere (adiar um ciclo
 * é melhor que duplicar).
 *
 * ⚠️ A cada passo ela RELÊ a fila do disco e aplica só a mudança daquele
 * pacote: a paciente pode ter começado outra contração enquanto esta subia, e
 * gravar a cópia antiga por cima apagaria a nova.
 */
export async function sincronizarFila<P extends PacoteLocal>(o: {
  ler: () => Promise<P[]>;
  gravar: (fila: P[]) => Promise<void>;
  pronto: (p: P) => boolean;
  conferir: (p: P) => Promise<ResultadoDaConferencia>;
  inserir: (p: P) => Promise<boolean>;
  agora: () => number;
}): Promise<{ subiram: number; ficaram: number }> {
  const inicial = await o.ler();
  const prontos = inicial.filter(o.pronto);
  let subiram = 0;
  for (const pacote of prontos) {
    if (pacote.tentativas > 0) {
      const r = await o.conferir(pacote);
      if (r === "falhou") continue;
      if (r === "ja-esta") {
        await o.gravar(semPacote(await o.ler(), pacote.id));
        subiram++;
        continue;
      }
    }
    const deuCerto = await o.inserir(pacote);
    const atual = await o.ler();
    if (deuCerto) {
      await o.gravar(semPacote(atual, pacote.id));
      subiram++;
    } else {
      const ali = atual.find((p) => p.id === pacote.id);
      if (ali) await o.gravar(comPacote(atual, { ...ali, tentativas: ali.tentativas + 1 }, o.agora()));
    }
  }
  const final = await o.ler();
  return { subiram, ficaram: final.filter(o.pronto).length };
}

/**
 * Insere; se o banco disser que a coluna opcional ainda não existe (PGRST204
 * — o SQL chega depois do código), repete sem ela. A contagem vale mais que a
 * força: perder as duas por causa de uma coluna seria o pior desfecho.
 */
export async function inserirComRecuo(
  inserir: (linha: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>,
  linha: Record<string, unknown>,
  colunaOpcional: string,
): Promise<{ error: { code?: string } | null }> {
  const r = await inserir(linha);
  if (r.error?.code === "PGRST204" && colunaOpcional in linha) {
    const { [colunaOpcional]: _fora, ...sem } = linha;
    return inserir(sem);
  }
  return r;
}
