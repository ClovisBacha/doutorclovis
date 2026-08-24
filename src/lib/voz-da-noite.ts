/**
 * OS ARQUIVOS DE VOZ DA NOITE — histórias para dormir e sessão do casal.
 *
 * Gerados em 13/ago/2026 na mesma cadeia de tudo que fala neste app: Isabella
 * no motor ElevenLabs, `text2speech_v2`, voz `80924413-…`. Conferido arquivo
 * por arquivo: 65 mp3, 128 kbps · 44,1 kHz · mono · com ID3, idênticos aos
 * 191 da meditação. 14,6 MB, 14 min 53 s de narração.
 *
 * Mesmo mecanismo de `voz-meditacao.ts` e pela mesma razão: o mapa sai do
 * DIRETÓRIO, não de uma lista escrita à mão que alguém precisa lembrar de
 * editar. `eager` + `?url` resolve tudo para URLs com hash no build, e o
 * navegador só busca o arquivo no instante em que o bloco toca.
 *
 * ⚠️ Os `id` são permanentes: cada um custou crédito. Ver o aviso no topo de
 * `historias-para-dormir.ts`.
 */

const DORMIR = import.meta.glob<string>("../assets/audio/dormir/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

const CASAL = import.meta.glob<string>("../assets/audio/casal/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

function mapear(arquivos: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(arquivos).map(([caminho, url]) => [
      caminho.slice(caminho.lastIndexOf("/") + 1, -".mp3".length),
      url,
    ]),
  );
}

const POR_ID: Record<string, string> = { ...mapear(DORMIR), ...mapear(CASAL) };

/**
 * A faixa de um bloco — `null` quando não existe.
 *
 * Devolver `null` em vez de estourar: um bloco sem áudio faz a história pular
 * aquele trecho em silêncio, que é degradação aceitável numa tela cujo assunto
 * é dormir. O que não pode é a tela quebrar às três da manhã.
 */
export function faixaDoBloco(id: string): string | null {
  return POR_ID[id] ?? null;
}

/** Quantos blocos têm arquivo — usado pelo teste de cobertura. */
export function blocosComFaixa(): string[] {
  return Object.keys(POR_ID);
}
