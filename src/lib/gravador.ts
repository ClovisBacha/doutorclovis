/**
 * GRAVAR A VOZ DELA — e as regras que o cliente e o servidor precisam
 * concordar.
 *
 * Existe porque escrever no celular às onze da noite, com o bebê no colo, é
 * trabalho. Falar não é. A gratidão passou a aceitar áudio: ela fala como foi
 * o dia, o servidor transcreve, e o texto cai no campo PARA ELA EDITAR antes
 * de guardar.
 *
 * ⚠️ O ÁUDIO NUNCA É GUARDADO. Vai para a transcrição e morre ali — não há
 * balde, não há coluna, não há URL. É a mesma decisão que tirou o envio de
 * exames do produto ("não vamos ter essa responsabilidade em guardar"), e aqui
 * ela é mais fácil: o que a paciente quer registrar é o texto, e a voz era só
 * o caminho até ele.
 *
 * ⚠️ E O QUE VOLTA É RASCUNHO, nunca o registro final. A transcrição erra
 * nomes, corta o fim da frase e inventa pontuação. Salvar direto faria o
 * diário dela ganhar frases que ela não escreveu — num texto que o médico lê.
 *
 * Os limites moram aqui, e não em cada lado, porque cliente e servidor têm de
 * concordar: o cliente para de gravar antes de estourar, e o servidor recusa o
 * que chegar acima — que é a única garantia de verdade, já que um relógio de
 * navegador em segundo plano é estrangulado pelo sistema.
 */

/** Quanto tempo ela pode falar. Um minuto e meio é um desabafo, não um podcast. */
export const LIMITE_SEGUNDOS = 90;

/**
 * O teto de bytes que o servidor aceita.
 *
 * Opus a ~24 kbps dá ~270 KB em 90 s; o AAC do iPhone, ~1 MB. Dois megabytes
 * cobrem os dois com folga e ainda assim são DEZ VEZES menos que o endpoint da
 * consulta, que aceita 20 MB — lá é uma consulta inteira, aqui é uma frase.
 * Áudio no Gemini custa ~32 tokens por segundo: o teto de bytes é o que impede
 * uma requisição de virar centenas de milhares de tokens.
 */
export const LIMITE_BYTES = 2 * 1024 * 1024;

/**
 * Os formatos aceitos.
 *
 * ⚠️ `audio/mp4` PRIMEIRO, e isso não é preferência: o Safari do iPhone só
 * grava nele. Uma lista que começasse em webm funcionaria em toda máquina de
 * desenvolvimento e falharia no aparelho onde o app é instalado.
 */
export const FORMATOS = [
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/aac",
] as const;

/** O melhor formato que este navegador grava. `null` quando nenhum serve. */
export function melhorMime(suporta: (t: string) => boolean): string | null {
  return FORMATOS.find((t) => suporta(t)) ?? null;
}

/**
 * O tipo chega com parâmetros (`audio/webm;codecs=opus`) — o que vale é o que
 * vem antes do ponto-e-vírgula, dos dois lados.
 */
export function tipoBase(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

export function ehAudioAceito(mime: string | null | undefined): boolean {
  return (FORMATOS as readonly string[]).includes(tipoBase(mime));
}

/**
 * O navegador sabe gravar?
 *
 * ⚠️ Isto decide se o BOTÃO APARECE. Um microfone desenhado numa tela que não
 * grava é a definição de botão que promete e não faz — e o iOS antes do 14.3 e
 * qualquer contexto sem HTTPS caem exatamente aí.
 */
export function podeGravar(): boolean {
  if (typeof window === "undefined") return false;
  const md = navigator.mediaDevices;
  return (
    !!md &&
    typeof md.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    melhorMime((t) => MediaRecorder.isTypeSupported?.(t) ?? false) !== null
  );
}

export type Gravacao = {
  mime: string;
  /** Encerra e devolve o áudio. O microfone é liberado nos dois caminhos. */
  parar: () => Promise<Blob>;
  /** Desiste: solta o microfone e joga fora o que já foi gravado. */
  cancelar: () => void;
};

/**
 * Começa a gravar. Estoura se a paciente negar o microfone — quem chama mostra
 * o recado.
 *
 * ⚠️ PRECISA SER CHAMADA DENTRO DO TOQUE. `getUserMedia` exige gesto do
 * usuário no iOS, e depois de um `await` o gesto já passou — é a mesma
 * armadilha do `destravar()` dos sons para dormir.
 */
export async function gravar(): Promise<Gravacao> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  /* Da aqui em diante, QUALQUER saída precisa soltar o microfone: uma exceção
     no meio deixaria a bolinha vermelha acesa no alto da tela do celular, para
     sempre, sem nada gravando. */
  const soltar = () => stream.getTracks().forEach((t) => t.stop());
  try {
    const escolhido = melhorMime((t) => MediaRecorder.isTypeSupported?.(t) ?? false);
    const mr = escolhido
      ? new MediaRecorder(stream, { mimeType: escolhido })
      : new MediaRecorder(stream);
    const mime = tipoBase(mr.mimeType || escolhido) || "audio/webm";
    const pedacos: BlobPart[] = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data);
    };
    mr.start();
    return {
      mime,
      parar: () =>
        new Promise<Blob>((resolve) => {
          /* O ouvinte é montado ANTES do `stop()`: o evento é síncrono em
             alguns navegadores, e registrá-lo depois perderia a gravação. */
          mr.onstop = () => {
            soltar();
            resolve(new Blob(pedacos, { type: mime }));
          };
          if (mr.state === "inactive") mr.onstop?.(new Event("stop"));
          else mr.stop();
        }),
      cancelar: () => {
        mr.onstop = () => soltar();
        try {
          if (mr.state !== "inactive") mr.stop();
          else soltar();
        } catch {
          soltar();
        }
      },
    };
  } catch (e) {
    soltar();
    throw e;
  }
}

/** "1:07" — o relógio que ela vê enquanto fala. */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
