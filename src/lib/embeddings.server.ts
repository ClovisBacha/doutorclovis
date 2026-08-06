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
export async function embedText(text: string, timeoutMs = 6000): Promise<number[] | null> {
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
    const data = (await res.json()) as { embedding?: { values?: number[] } };
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
    const vec = await embedText(`${question}\n${answer}`);
    if (!vec) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Coluna embedding ausente (migração pendente): o supabase-js devolve
    // {error} sem lançar — o update vira no-op silencioso, que é o desejado.
    await (supabaseAdmin as any).from("brain_entries").update({ embedding: vec }).eq("id", entryId);
  } catch {
    /* enriquecimento é best-effort — o backfill cobre depois */
  }
}

/**
 * Backfill oportunista: embeda até `limit` entradas sem vetor do médico.
 * Disparado (fire-and-forget) quando o médico abre a base de conhecimento —
 * visitar o painel "cura" o cérebro dele, incluindo o kit de partida e
 * entradas criadas quando a chave de IA estava indisponível.
 */
export function backfillBrainEmbeddings(doctorId: string, limit = 40): void {
  void (async () => {
    try {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      const { data: rows, error } = await sb
        .from("brain_entries")
        .select("id,question,answer")
        .eq("doctor_id", doctorId)
        .is("embedding", null)
        .limit(Math.min(limit, 60));
      if (error || !rows?.length) return; // 42703/42P01: migração pendente → nada a fazer
      // Sequencial de propósito: evita estourar rate limit da API de embeddings.
      for (const row of rows as { id: string; question: string; answer: string }[]) {
        const vec = await embedText(`${row.question}\n${row.answer}`);
        if (!vec) return; // falhou uma → para o lote (cota/chave); tenta na próxima visita
        await sb.from("brain_entries").update({ embedding: vec }).eq("id", row.id);
      }
    } catch {
      /* best-effort */
    }
  })();
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
