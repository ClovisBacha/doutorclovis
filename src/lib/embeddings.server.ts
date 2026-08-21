/**
 * Embeddings do Segundo Cérebro — Gemini `gemini-embedding-001` em 768 dims,
 * via REST (mesmo padrão do transcritor; sem dependência nova).
 *
 * Filosofia: embeddings são ENRIQUECIMENTO, nunca dependência. Toda função
 * aqui é best-effort e devolve null/false em falha — o chamador segue com o
 * ranking por palavras. Nada de IA no caminho crítico sem rede de segurança.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────────
 *
 * O padrão era `text-embedding-004`, que o Google APOSENTOU. Toda chamada
 * voltava erro, o `!res.ok` devolvia null, e a filosofia acima — a mesma que
 * protege o chat — escondeu a falha por completo: nenhum vetor era gravado,
 * nenhum erro aparecia, e a busca semântica caía no ranking por palavras
 * sempre. Do lado de fora, um cérebro que nunca entendeu sinônimos parecia um
 * cérebro que só não tinha achado nada parecido.
 *
 * Foi descoberto porque as lacunas paravam de agrupar: `embedding IS NULL` em
 * TODAS, inclusive nas recém-criadas.
 *
 * A lição não é o nome do modelo — é que "best-effort silencioso" e "modelo
 * que some" juntos produzem um recurso morto que ninguém vê morrer. Por isso
 * a falha agora é REGISTRADA (`console.error`) com o status da resposta.
 */

/**
 * `gemini-embedding-001`: modelo de TEXTO atual. Existe o
 * `gemini-embedding-2`, multimodal e mais novo — não é preciso aqui, e os dois
 * espaços vetoriais são INCOMPATÍVEIS entre si. Trocar de modelo depois exige
 * regerar tudo (ver a nota de migração no fim do arquivo).
 */
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-001";
/**
 * 768 é o tamanho das colunas `vector(768)` no banco.
 *
 * O padrão deste modelo é 3072. Sem pedir 768 explicitamente, o vetor volta
 * grande demais, a guarda de tamanho abaixo o rejeita, e voltaríamos a
 * gravar nada — o mesmo defeito com outra causa.
 */
const EMBEDDING_DIMS = 768;
/** Entrada truncada: perguntas/respostas longas não precisam de mais que isso. */
const MAX_INPUT_CHARS = 2000;

/** Não repetir o mesmo erro a cada mensagem: um aviso por processo basta. */
let jaAvisouDaFalha = false;
function avisarFalha(motivo: string): void {
  if (jaAvisouDaFalha) return;
  jaAvisouDaFalha = true;
  console.error(
    `[embeddings] busca semântica DESLIGADA (${motivo}). ` +
      `Modelo: ${EMBEDDING_MODEL}. O cérebro segue funcionando por palavras.`,
  );
}

/**
 * Gera o vetor de um texto. null em qualquer falha (sem chave, rede, cota).
 * `timeoutMs`: no caminho de ESCRITA/backfill o padrão de 6s é ok; no caminho
 * de LEITURA do chat use um valor curto — a paciente está esperando a
 * resposta, e um Gemini lento não pode congelar o chat até o fallback.
 */
/**
 * Para que serve o vetor: procurar (`consulta`) ou ser encontrado (`documento`).
 *
 * O Gemini tem `RETRIEVAL_QUERY` e `RETRIEVAL_DOCUMENT` para exatamente o
 * desequilíbrio que existe aqui: a consulta é uma pergunta de trinta
 * caracteres, e o documento é pergunta + resposta inteira do médico, com até
 * dois mil. Sem dizer qual é qual, o modelo trata os dois como o mesmo tipo de
 * texto e a comparação fica pior do que precisa — a resposta longa domina o
 * vetor e a pergunta curta some dentro dela.
 *
 * Era ganho de graça sendo jogado fora: o parâmetro existe, não custa nada, e
 * é a diferença entre "posso comer sushi?" encontrar ou não a orientação que o
 * médico já escreveu sobre peixe cru.
 */
export type UsoDoVetor = "consulta" | "documento" | "semelhanca";

const TASK_TYPE: Record<UsoDoVetor, string> = {
  /** A pergunta da paciente procurando no conhecimento do médico. */
  consulta: "RETRIEVAL_QUERY",
  /** A entrada do médico (pergunta + resposta) esperando ser encontrada. */
  documento: "RETRIEVAL_DOCUMENT",
  /**
   * Duas coisas do MESMO tipo se comparando — lacuna com lacuna.
   *
   * Aqui não há lado curto e lado longo: são duas perguntas de paciente. Usar
   * consulta/documento numa comparação simétrica é aplicar uma correção de
   * desequilíbrio onde não há desequilíbrio, e piora em vez de melhorar.
   */
  semelhanca: "SEMANTIC_SIMILARITY",
};

export async function embedText(
  text: string,
  timeoutMs = 6000,
  uso: UsoDoVetor = "documento",
): Promise<number[] | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const clean = text.trim().slice(0, MAX_INPUT_CHARS);
  if (!apiKey || clean.length < 2) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: clean }] },
          /* NA RAIZ, e não dentro de `embedContentConfig`.
             O aninhado é a forma dos SDKs oficiais; aqui a chamada é REST
             crua, e nela o campo aninhado é ACEITO pelo parser e IGNORADO na
             hora de gerar — a resposta volta com as 3072 dimensões padrão. Foi
             assim que nenhum vetor chegou a ser gravado: a guarda de tamanho
             recusava todos, silenciosamente, porque a coluna é `vector(768)`. */
          outputDimensionality: EMBEDDING_DIMS,
          /* Consulta e documento vivem no MESMO espaço — o `taskType` não os
             separa, ele orienta o modelo sobre o papel de cada texto. Trocar
             este valor depois exige regerar tudo, como trocar de modelo. */
          taskType: TASK_TYPE[uso],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) {
      /* 404 aqui quer dizer "modelo aposentado" — foi assim que o recurso
         morreu da última vez, e sem esta linha morreria calado de novo. */
      avisarFalha(`HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      embedding?: { values?: number[] };
      usageMetadata?: { totalTokenCount?: number };
    };

    /* ─── OS EMBEDDINGS NUNCA FORAM MEDIDOS ────────────────────────────────
     *
     * `especie: "embedding"` existe no tipo desde sempre, e `cota-ia.server`
     * afirma, com todas as letras: "as três custam dinheiro e as três estão
     * medidas". Uma busca por `especie: "embedding"` no repo inteiro não
     * devolvia NADA — este arquivo nem importava `uso-ia.server`.
     *
     * E não é volume desprezível: cada mensagem da paciente paga um embedding
     * de consulta, cada entrada do médico paga um de documento, cada lacuna
     * paga um de semelhança, e o backfill paga vinte por visita ao painel.
     *
     * Disparado e não aguardado de propósito: aqui não é o `onFinish`, e sim o
     * meio de uma leitura que a paciente está esperando — aguardar poria uma
     * escrita no caminho da resposta dela. Perder uma linha de medição de
     * embedding não muda decisão nenhuma; atrasar a resposta, sim.
     *
     * `totalTokenCount` quando o Gemini manda; senão, a estimativa de 4
     * caracteres por token, que é a régua usual e erra para menos.
     */
    try {
      const { registrarUso } = await import("./uso-ia.server");
      registrarUso({
        especie: "embedding",
        modelo: EMBEDDING_MODEL,
        inputTokens: data.usageMetadata?.totalTokenCount ?? Math.ceil(clean.length / 4),
        outputTokens: 0,
        canal: `embedding-${uso}`,
      });
    } catch {
      /* medir nunca derruba a busca */
    }

    const values = data.embedding?.values;
    if (!Array.isArray(values)) {
      avisarFalha("resposta sem vetor");
      return null;
    }
    /* CORTAR, em vez de recusar — e isso é mais que tolerância a defeito.
       `gemini-embedding-001` é treinado com Matryoshka: as primeiras
       dimensões carregam a maior parte do significado, e a própria
       documentação diz que pedir menos que 3072 devolve o vetor TRUNCADO. Ou
       seja, cortar aqui produz exatamente o mesmo vetor que o parâmetro
       produziria.
       Recusar era o comportamento anterior, e ele transformava um campo
       ignorado em recurso morto: todos os vetores viravam null e ninguém
       conseguia adivinhar por quê. Agora o parâmetro é uma otimização (menos
       bytes na rede), não uma dependência. */
    if (values.length < EMBEDDING_DIMS) {
      avisarFalha(`vetor com ${values.length} dimensões, menor que ${EMBEDDING_DIMS}`);
      return null;
    }
    return normalizar(values.slice(0, EMBEDDING_DIMS));
  } catch {
    return null;
  }
}

/**
 * Normaliza para norma 1.
 *
 * Pedindo menos que 3072 dimensões o Google devolve o vetor TRUNCADO e não
 * renormalizado. Para a distância de cosseno (`<=>`, a que o banco usa) isso
 * não muda o ranking — cosseno ignora magnitude. Normalizamos assim mesmo por
 * dois motivos: o número de similaridade passa a significar o que aparenta
 * (e é ele que calibra o corte de agrupamento), e quem um dia usar `<->`
 * (distância L2) não herda um erro silencioso.
 */
function normalizar(v: number[]): number[] {
  let soma = 0;
  for (const x of v) soma += x * x;
  const norma = Math.sqrt(soma);
  if (!norma || !Number.isFinite(norma)) return v;
  return v.map((x) => x / norma);
}

/**
 * Calcula e grava o embedding de UMA entrada do cérebro. O texto indexado é
 * pergunta+resposta — é assim que "enjoo" encontra uma entrada cuja pergunta
 * diz "náuseas".
 *
 * É `async` DE PROPÓSITO, e quem chama decide se aguarda.
 *
 * Antes era `void (async () => {…})()` com retorno `void`: uma função que
 * dispara e devolve na hora. Quem tentasse `await embedBrainEntry(...)` estaria
 * aguardando `undefined` — resolve no microtask seguinte e a função de servidor
 * retorna antes da chamada de embedding acontecer. Em serverless o processo
 * morre com a resposta, então o texto novo ficava com o vetor velho e a busca
 * continuava achando a versão antiga. O `await` parecia certo e não era.
 *
 * Nunca lança: erro aqui é enriquecimento perdido, não escrita perdida.
 */
export async function embedBrainEntry(
  entryId: string,
  question: string,
  answer: string,
): Promise<void> {
  try {
    const vec = await embedText(`${question}\n${answer}`, 6000, "documento");
    if (!vec) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* Coluna `embedding` ausente (migração pendente): o supabase-js devolve
       `{error}` sem lançar, e o update vira no-op — o que é desejado, porque
       o banco sem a coluna não tem busca semântica de qualquer forma.
       O que NÃO é desejado é o mesmo silêncio para qualquer outro erro: sem
       vetor, a entrada existe e é inencontrável por significado, e o sintoma
       ("respondi isso e a IA não usa") não aponta para lugar nenhum. */
    const { error } = await (supabaseAdmin as any)
      .from("brain_entries")
      .update({ embedding: vec })
      .eq("id", entryId);
    /* ⚠️ `colunaAusente`, e não `42703` cru: este é um UPDATE, e um payload com
       coluna fora do schema cache volta PGRST204. Com o teste antigo, o banco
       SEM a coluna `embedding` — que é o caso normal antes da migration —
       registrava um erro no log a cada entrada do cérebro, gritando sobre uma
       situação esperada. Alarme que grita sempre é alarme que se ignora. */
    const { colunaAusente } = await import("./postgrest");
    if (error && !colunaAusente(error)) {
      console.error("[cérebro] vetor não gravou; entrada fica inencontrável", entryId, error);
    }
  } catch {
    /* enriquecimento é best-effort — o backfill cobre depois */
  }
}

/**
 * Roda em lotes: paralelo o bastante para ser rápido, gentil o bastante para
 * não bater no limite de taxa do modelo — que é o que transforma a falha de
 * UMA chamada em falha de todas.
 *
 * Mora aqui, e não no lado de quem usa, porque a razão de existir é do
 * embedding: é a API de vetores que tem o limite de taxa. Havia uma cópia em
 * `secondbrain.server.ts`; duas cópias de uma regra é como as duas cópias do
 * filtro de lacuna divergiram.
 */
export async function emLotes<T, R>(
  itens: T[],
  tamanho: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(fn))));
  }
  return saida;
}

/** Teto por visita ao painel, e tamanho do lote. Iguais aos da cura de lacunas. */
const BACKFILL_POR_VEZ = 20;
const BACKFILL_POR_LOTE = 4;
const BACKFILL_TIMEOUT_MS = 6000;

/**
 * Dá vetor às ENTRADAS do cérebro que nasceram sem um.
 *
 * ─── Por que isto vale a busca semântica inteira ────────────────────────────
 *
 * `match_brain_entries` só enxerga linha com `embedding` preenchido. Entrada
 * sem vetor é invisível para a busca por sentido — e o kit de partida, tudo o
 * que foi salvo antes da migration e tudo o que foi salvo com a chave de IA
 * fora do ar nasce assim. Com a tabela inteira cega, a busca semântica não
 * devolve nada, o chat cai calado no ranking por palavras, e "posso comer
 * comida japonesa?" não encontra a orientação sobre sushi. O corte de 0,62
 * está certo e simplesmente nunca é exercitado.
 *
 * ─── É `async` DE PROPÓSITO, e quem chama TEM que aguardar ──────────────────
 *
 * A primeira versão era `void (async () => {…})()`. Não embedava nada: em
 * servidor sem servidor a invocação congela quando a resposta sai, e
 * `listBrainEntries` devolve a lista na hora — o laço morria antes do primeiro
 * embedding. Nenhum erro, nenhum log, e a busca semântica inteira parada.
 *
 * A cicatriz gêmea foi diagnosticada e consertada em `curarLacunasSemVetor`,
 * que inclusive aponta ESTE arquivo como origem do padrão errado. Consertaram
 * o lado que copiou e deixaram o original. Agora os dois têm a mesma forma:
 * requisição própria, lotes pequenos, e conferência do que foi gravado.
 *
 * Duas diferenças em relação ao laço antigo, além do `await`:
 *
 * - **Uma falha não aborta o resto.** Era `if (!vec) return`: um estouro de
 *   tempo na terceira entrada jogava fora as dezessete seguintes. Agora as que
 *   deram certo são gravadas e as que falharam ficam para a próxima visita.
 * - **Confere o `update`.** Antes disparava e contava como feito; com a coluna
 *   ausente ou a RLS no caminho, "embedei 20" tendo gravado zero.
 *
 * Devolve quantas embedou — é o número que torna o efeito verificável de fora.
 * Nunca lança: enriquecimento perdido não pode virar painel quebrado.
 */
/**
 * A ordem em que as entradas ganham vetor. Separada para poder ser exercitada:
 * é uma decisão de PRODUTO — quem fica visível primeiro — escondida dentro de
 * duas chamadas de construtor de consulta.
 *
 * `approved` DESCENDENTE porque em Postgres `false < true`, então descendente
 * põe as aprovadas na frente. Desempate pela mais antiga: a que está esperando
 * há mais tempo é a que está invisível há mais tempo.
 */
export function priorizarAprovadas<T>(q: T): T {
  const query = q as unknown as {
    order: (c: string, o: { ascending: boolean }) => unknown;
  };
  return (query.order("approved", { ascending: false }) as any).order("created_at", {
    ascending: true,
  }) as T;
}

export async function backfillBrainEmbeddings(
  doctorId: string,
  limit = BACKFILL_POR_VEZ,
): Promise<number> {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 0;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    /* ─── APROVADA PRIMEIRO ───────────────────────────────────────────────
     *
     * `match_brain_entries` filtra `AND e.approved = true`: rascunho não é
     * encontrável, por vetor nem por palavra. Mas o backfill pegava qualquer
     * `embedding IS NULL`, sem ordem, 20 por visita.
     *
     * O kit de partida instala ~30 entradas como RASCUNHO. Então duas visitas
     * inteiras à Base de conhecimento podiam ser gastas vetorizando exatamente
     * o que a busca nunca vai devolver — enquanto a orientação aprovada do
     * médico seguia invisível e a paciente ouvia "registrei para ele ver"
     * sobre um assunto que ele já tinha escrito.
     *
     * O rascunho continua sendo embedado (ele vira aprovado um dia, e o vetor
     * já estar pronto é bom), só que DEPOIS. `approved` descendente porque em
     * Postgres `false < true`.
     */
    const { data: rows, error } = await priorizarAprovadas(
      sb.from("brain_entries").select("id,question,answer").eq("doctor_id", doctorId),
    )
      .is("embedding", null)
      .limit(Math.min(limit, BACKFILL_POR_VEZ));
    if (error || !rows?.length) return 0; // 42703/42P01: migração pendente → nada a fazer

    const linhas = rows as { id: string; question: string; answer: string }[];
    const vetores = await emLotes(linhas, BACKFILL_POR_LOTE, (r) =>
      embedText(`${r.question}\n${r.answer}`, BACKFILL_TIMEOUT_MS, "documento"),
    );

    const prontas = linhas
      .map((r, i) => ({ id: r.id, vetor: vetores[i] }))
      .filter((e): e is { id: string; vetor: number[] } => !!e.vetor);

    const gravacoes = await Promise.all(
      prontas.map((e) => sb.from("brain_entries").update({ embedding: e.vetor }).eq("id", e.id)),
    );
    const falhas = gravacoes.filter((r: any) => r?.error);
    if (falhas.length) {
      console.error(
        `[embeddings] backfill: ${falhas.length}/${prontas.length} updates falharam — ` +
          `${(falhas[0] as any)?.error?.message ?? "sem detalhe"}`,
      );
    }
    return prontas.length - falhas.length;
  } catch {
    /* best-effort: o médico volta ao painel e a próxima visita continua */
    return 0;
  }
}

/* ─── NOTA DE MIGRAÇÃO DE MODELO ─────────────────────────────────────────────
 *
 * Espaços vetoriais de modelos diferentes NÃO são comparáveis. Um vetor gerado
 * pelo `text-embedding-004` e outro pelo `gemini-embedding-001` produzem uma
 * similaridade que parece um número normal e não significa nada.
 *
 * Trocar de modelo, portanto, obriga a regerar TUDO. Como os `embedding` estão
 * todos nulos (o modelo antigo já estava aposentado quando isto foi
 * descoberto), não há o que migrar hoje. Se um dia houver — ou se este arquivo
 * mudar de modelo de novo —, limpe antes de deixar o backfill correr:
 *
 *   UPDATE public.brain_entries SET embedding = NULL;
 *   UPDATE public.brain_gaps    SET embedding = NULL;
 *
 * O backfill (`backfillBrainEmbeddings`) e a cura (`curarLacunasSemVetor`) só
 * enxergam linhas com vetor NULO — é assim que elas se reconstroem sozinhas.  */
