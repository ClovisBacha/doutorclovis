/**
 * OS ARQUIVOS DE VOZ DAS 149 FALAS DA MEDITAÇÃO.
 *
 * Gerados em 12/ago/2026 na mesma cadeia das 25 faixas antigas — Isabella no
 * motor ElevenLabs, `text2speech_v2`, voz `80924413-…`. Conferido arquivo por
 * arquivo: 128 kbps · 44,1 kHz · mono, idêntico ao `inspire.mp3` que já estava
 * no app. 11,4 MB, 12,5 minutos de áudio, 5,0 s por fala em média.
 *
 * ─── POR QUE `import.meta.glob`, E NÃO 149 `import` ────────────────────────
 *
 * `voz.ts` lista os 25 arquivos dela um a um, e naquela escala isso é legível.
 * Em 149 vira uma parede que ninguém revisa — e, pior, uma parede que precisa
 * ser editada à mão toda vez que uma fala nasce ou morre em
 * `meditacao-roteiros.ts`. O glob lê o diretório: acrescentar uma fala é
 * acrescentar o texto e gerar o `.mp3`, e o mapa se atualiza sozinho.
 *
 * `eager` + `?url` faz o Vite resolver tudo para URLs com hash no build. O
 * navegador NÃO baixa os 11,4 MB: `new Audio(src)` só busca o arquivo no
 * instante em que a fala toca. (Medido na produção: nenhum `.mp3` é
 * pré-carregado — ver o `preload` ausente no HTML.)
 *
 * ⚠️ A chave é o `id` da fala, e ele é PERMANENTE. Renomear um id órfã um
 * arquivo que custou crédito para existir; mudar o TEXTO de um id obriga a
 * regravar aquele arquivo, e só aquele.
 */

const ARQUIVOS = import.meta.glob<string>("../assets/audio/med/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

/** id da fala → URL do arquivo. Montado do diretório, não de uma lista. */
const POR_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ARQUIVOS).map(([caminho, url]) => [
    caminho.slice(caminho.lastIndexOf("/") + 1, -".mp3".length),
    url,
  ]),
);

/**
 * A faixa de uma fala — `null` quando não existe.
 *
 * Devolver `null` e não estourar é deliberado: uma fala sem áudio faz a sessão
 * seguir em silêncio naquele trecho, que é degradação aceitável. O que não
 * pode acontecer é a meditação inteira morrer porque um arquivo faltou.
 */
export function faixaDaFala(id: string): string | null {
  return POR_ID[id] ?? null;
}

/** Os ids que têm arquivo. O teste compara com os roteiros. */
export function falasComFaixa(): string[] {
  return Object.keys(POR_ID);
}
