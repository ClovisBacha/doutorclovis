/**
 * O VÍDEO NA PUBLICAÇÃO — régua pura.
 *
 * Era o último formato que faltava: até aqui a aba só aceitava foto, e é em
 * vídeo que uma mãe mostra o bebê mexendo, o primeiro sorriso, o primeiro
 * passo. Foto conta que aconteceu; vídeo mostra.
 *
 * ⚠️ **E ELE NÃO PODE SUBIR PELO MESMO CAMINHO DA FOTO.** As fotos viajam como
 * data URL dentro da chamada do servidor — 1080px de JPEG são ~200 KB, e isso
 * cabe. Trinta segundos de vídeo de celular são 10 a 30 MB, e em base64 ficam
 * 1,4× maiores: estouraria o corpo da requisição, e o que a paciente veria é
 * "não deu para publicar" depois de esperar um minuto no 4G dela.
 *
 * O vídeo sobe DIRETO para o Storage, com URL assinada. Esta régua é o que
 * decide o que nem chega a subir.
 */

/**
 * ⚠️ **SESSENTA SEGUNDOS, e o corte é de produto, não técnico.**
 *
 * O que uma mãe publica é um trecho: o bebê mexendo, a risada, o primeiro
 * passo. Vídeo longo neste app viraria um lugar de assistir em vez de um lugar
 * de mostrar — e cada minuto a mais é 4G da paciente que assiste, muitas vezes
 * num plano contado.
 */
export const SEGUNDOS_MAX = 60;

/**
 * ⚠️ **QUINZE MEGABYTES, e desceu de cinquenta por causa do EGRESSO.**
 *
 * Um iPhone grava 1080p60 a ~7 MB/s; sessenta segundos passam de 400 MB e
 * seriam recusados pelo tempo antes do tamanho. O teto existe para o vídeo JÁ
 * COMPRIMIDO que o navegador manda.
 *
 * ⚠️ **O que decide não é o armazenamento — é quantas vezes o arquivo é
 * BAIXADO.** Guardar 50 MB custa centavos; um story de 50 MB visto por vinte
 * pessoas é **1 GB de banda por publicação**, e a plataforma paga isso toda
 * vez que alguém abre. Quinze cobrem um minuto de 720p bem comprimido, que é o
 * que um celular de verdade produz ao mandar vídeo — é o mesmo teto que o
 * WhatsApp aplica, e ninguém reclama dele.
 *
 * ⚠️ **A DURAÇÃO SOZINHA NÃO LIMITA NADA**: sessenta segundos podem ser 3 MB
 * ou 400, conforme o bitrate. Os dois tetos existem porque medem coisas
 * diferentes — tempo de atenção e tamanho de download.
 */
export const BYTES_MAX = 15 * 1024 * 1024;

/**
 * Os formatos que o navegador de uma paciente realmente produz e toca.
 *
 * ⚠️ **`video/quicktime` ESTÁ NA LISTA, e esquecê-lo quebraria o iPhone.** É o
 * que o iOS entrega ao escolher um vídeo da galeria (`.mov`), e uma lista com
 * só `mp4`/`webm` recusaria em silêncio o aparelho onde o app é instalado —
 * exatamente a armadilha que `audio/mp4` já documenta no gravador do diário.
 */
export const TIPOS_ACEITOS = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"] as const;

export type RecusaDoVideo = "tipo" | "tamanho" | "duracao";

export function recusaDoVideo(v: {
  tipo: string;
  bytes: number;
  /** `null` quando o navegador não soube ler a duração. */
  segundos: number | null;
}): RecusaDoVideo | null {
  if (!(TIPOS_ACEITOS as readonly string[]).includes(v.tipo)) return "tipo";
  if (v.bytes > BYTES_MAX) return "tamanho";
  /**
   * ⚠️ **DURAÇÃO DESCONHECIDA PASSA.** Alguns `.mov` do iPhone demoram a expor
   * a duração, e uns nunca expõem no `<video>` do Safari. Recusar por não saber
   * mandaria embora o formato mais comum do aparelho mais comum — e o teto de
   * tamanho já limita o estrago. É a mesma escolha de `faixaDoMovimento`:
   * quando o dado falta, não se inventa uma recusa.
   */
  if (v.segundos !== null && v.segundos > SEGUNDOS_MAX + 1) return "duracao";
  return null;
}

export function recadoDaRecusa(r: RecusaDoVideo): string {
  switch (r) {
    case "tipo":
      return "Esse formato de vídeo não dá para publicar aqui.";
    case "tamanho":
      /* ⚠️ O recado DIZ o que fazer diferente. "Vídeo muito pesado" sozinho
         deixa ela tentando o mesmo arquivo de novo. */
      return `Esse vídeo é pesado demais (o limite é ${Math.round(
        BYTES_MAX / 1024 / 1024,
      )} MB). Tente um trecho mais curto.`;
    case "duracao":
      return `O vídeo precisa ter até ${SEGUNDOS_MAX} segundos.`;
  }
}

/**
 * O caminho é DESTA pessoa?
 *
 * ⚠️ **O CLIENTE MANDA O CAMINHO, e sem esta conferência ele mandaria o de
 * outra.** O vídeo sobe direto para o Storage e só o caminho volta ao servidor
 * na hora de publicar — então quem garante que a paciente não está anexando o
 * vídeo de outra conta é isto, e nada mais. A pasta é o uuid dela.
 */
export function caminhoEhDoDono(caminho: string, donoId: string): boolean {
  if (!caminho || !donoId) return false;
  /* ⚠️ Sem `..` e sem barra dupla: um caminho como `<eu>/../<outra>/x.mp4`
     começa com a pasta certa e aponta para fora dela. */
  if (caminho.includes("..") || caminho.includes("//")) return false;
  return caminho.startsWith(`${donoId}/`);
}

/** A extensão a partir do tipo, para o nome do arquivo no Storage. */
export function extensaoDoTipo(tipo: string): string {
  if (tipo === "video/quicktime") return "mov";
  if (tipo === "video/webm") return "webm";
  if (tipo === "video/x-m4v") return "m4v";
  return "mp4";
}
