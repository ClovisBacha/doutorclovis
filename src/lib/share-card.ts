/**
 * O CARTÃO COMPARTILHÁVEL — canvas, sem biblioteca, sem servidor.
 *
 * Ele nasceu cravado numa coisa só ("N semanas") e passou meses sendo o ÚNICO
 * caminho de saída do app: o mapeamento contou trinta e quatro momentos de
 * conquista, e dois saíam — os dois iguais.
 *
 * Agora ele desenha QUALQUER momento (`src/lib/momento.ts`), e `shareMilestoneCard`
 * virou um caso particular dele, para os dois chamadores antigos não mudarem
 * uma linha.
 *
 * ⚠️ **Canvas 2D e fontes do SISTEMA, de propósito.** Não há `satori`,
 * `@vercel/og`, `sharp` nem `resvg` no projeto (conferido) — e não é falta:
 * gerar no servidor obrigaria a foto e o número dela a viajarem, e o cartão é
 * exatamente a coisa que não precisa sair do aparelho para existir.
 *
 * ⚠️ **PNG, e não WebP.** O compartilhamento entrega o arquivo ao Instagram e
 * ao WhatsApp por `navigator.share`, e PNG é o que todo destino aceita sem
 * conversão.
 */
import type { Momento } from "@/lib/momento";

type CardOpts = {
  week: number;
  fruit: string;
  babyName?: string | null;
  motherName?: string | null;
};

const W = 1080;
const H = 1350;

function roundedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}

/**
 * Desenha um momento qualquer.
 *
 * ⚠️ **A régua decide o TEXTO; aqui só se desenha.** Nada neste arquivo escolhe
 * o que dizer, e nada aqui confere Modo Cuidado — quem faz as duas coisas é
 * `momentoDe`, e é ela que as oito telas chamam. Uma segunda régua aqui faria
 * o cartão dizer o que o app proíbe, no arquivo que o exporta para fora.
 */
function desenharMomento(m: Momento, quem: { motherName?: string | null }): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  fundo(ctx);
  ctx.textAlign = "center";
  const cx = W / 2;

  /* O chapéu, espaçado — é a linha que dá o contexto sem competir. */
  ctx.fillStyle = "#a85a44";
  ctx.font = "600 34px Georgia, serif";
  ctx.fillText(m.chapeu.toLocaleUpperCase("pt-BR").split("").join(" "), cx, 200);

  ctx.font = "220px sans-serif";
  ctx.fillText(m.emoji, cx, 520);

  if (m.numero !== null) {
    ctx.fillStyle = "#5b3225";
    ctx.font = "700 300px Georgia, serif";
    ctx.fillText(String(m.numero), cx, 800);
    if (m.unidade) {
      ctx.fillStyle = "#8a5c4c";
      ctx.font = "500 70px Georgia, serif";
      ctx.fillText(m.unidade, cx, 880);
    }
    ctx.fillStyle = "#5b3225";
    ctx.font = "400 46px Georgia, serif";
    roundedText(ctx, m.titulo, cx, 1010, W - 200, 62);
  } else {
    /* ⚠️ Sem número, o TÍTULO ocupa o corpo do cartão — e não um espaço vazio
       onde o número estaria. Um cartão com um buraco no meio lê como imagem
       que falhou ao carregar. */
    ctx.fillStyle = "#5b3225";
    ctx.font = "700 72px Georgia, serif";
    roundedText(ctx, m.titulo, cx, 790, W - 220, 96);
  }

  if (quem.motherName) {
    ctx.fillStyle = "#a85a44";
    ctx.font = "italic 500 44px Georgia, serif";
    ctx.fillText(`— ${quem.motherName}`, cx, 1130);
  }

  marca(ctx);
  return canvas;
}

/** O degradê quente e os dois brilhos — o mesmo dos dois cartões. */
function fundo(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#fbeee6");
  g.addColorStop(0.55, "#f6d9cf");
  g.addColorStop(1, "#eebfb2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(W * 0.8, H * 0.18, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(200,120,95,0.12)";
  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.85, 260, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * O endereço no pé.
 *
 * ⚠️ **Sem o código de indicação.** Ele é uma capacidade, e um cartão vai para
 * o story de quem quiser ver — o código impresso ali seria a indicação dela
 * distribuída a estranhos, e o `attributeReferral` prende no PRIMEIRO código
 * que chegar. O convite com código continua sendo o link, que ela manda para
 * quem escolhe.
 */
function marca(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(91,50,37,0.55)";
  ctx.font = "600 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("obstetrica.com.br", W / 2, H - 70);
}

/**
 * O cartão da SEMANA — o caso particular, com a fruta e o tamanho do bebê.
 *
 * Ele continua existindo à parte porque diz uma coisa que nenhum outro momento
 * diz ("do tamanho de uma berinjela"), e porque os dois chamadores antigos não
 * precisam saber que o arquivo mudou.
 */
function drawCard(opts: CardOpts): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  fundo(ctx);
  ctx.textAlign = "center";
  const cx = W / 2;

  ctx.fillStyle = "#a85a44";
  ctx.font = "600 34px Georgia, serif";
  ctx.fillText("M I N H A   G E S T A Ç Ã O", cx, 200);

  ctx.font = "220px sans-serif";
  ctx.fillText(fruitEmoji(opts.fruit), cx, 520);

  ctx.fillStyle = "#5b3225";
  ctx.font = "700 300px Georgia, serif";
  ctx.fillText(String(opts.week), cx, 800);
  ctx.fillStyle = "#8a5c4c";
  ctx.font = "500 70px Georgia, serif";
  ctx.fillText("semanas", cx, 880);

  ctx.fillStyle = "#5b3225";
  ctx.font = "400 46px Georgia, serif";
  const who = opts.babyName ? opts.babyName : "meu bebê";
  roundedText(ctx, `${who} do tamanho de ${opts.fruit.toLowerCase()} 💛`, cx, 1010, W - 200, 62);

  if (opts.motherName) {
    ctx.fillStyle = "#a85a44";
    ctx.font = "italic 500 44px Georgia, serif";
    ctx.fillText(`— ${opts.motherName}`, cx, 1130);
  }

  marca(ctx);
  return canvas;
}

// Alguns emojis de fruta comuns dos rótulos; senão, um coração.
function fruitEmoji(fruit: string): string {
  const f = fruit.toLowerCase();
  if (f.includes("morango")) return "🍓";
  if (f.includes("lim")) return "🍋";
  if (f.includes("uva")) return "🍇";
  if (f.includes("framboesa") || f.includes("amora")) return "🫐";
  if (f.includes("laranja") || f.includes("tangerina")) return "🍊";
  if (f.includes("banana")) return "🍌";
  if (f.includes("maçã") || f.includes("maca")) return "🍎";
  if (f.includes("pera")) return "🍐";
  if (f.includes("abacate")) return "🥑";
  if (f.includes("milho")) return "🌽";
  if (f.includes("cenoura")) return "🥕";
  if (f.includes("coco")) return "🥥";
  if (f.includes("abacaxi")) return "🍍";
  if (f.includes("melancia")) return "🍉";
  if (f.includes("abóbora") || f.includes("abobora")) return "🎃";
  if (f.includes("berinjela")) return "🍆";
  if (f.includes("pêssego") || f.includes("pessego")) return "🍑";
  return "🍼";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export type ShareResult = "shared" | "downloaded" | "unsupported" | "error";

/** Gera o cartão e tenta compartilhar; se não der, baixa a imagem. */
export async function shareMilestoneCard(opts: CardOpts): Promise<ShareResult> {
  if (typeof document === "undefined") return "unsupported";
  try {
    const canvas = drawCard(opts);
    const blob = await canvasToBlob(canvas);
    if (!blob) return "error";
    const file = new File([blob], `obstetrica-semana-${opts.week}.png`, { type: "image/png" });

    const nav = navigator as Navigator & {
      canShare?: (d: unknown) => boolean;
      share?: (d: unknown) => Promise<void>;
    };
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({
        files: [file],
        title: `${opts.week} semanas 💛`,
        text: `Estou de ${opts.week} semanas! Acompanhando minha gestação no Obstétrica 💛`,
      });
      return "shared";
    }

    // Fallback: baixa a imagem
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "downloaded";
  } catch (e) {
    // AbortError = usuária cancelou o compartilhamento; não é erro real
    if ((e as { name?: string })?.name === "AbortError") return "shared";
    return "error";
  }
}

/**
 * Gera o cartão de um MOMENTO e o entrega.
 *
 * ⚠️ **Três desfechos, e a tela precisa dos três.** `shared` (o sistema abriu a
 * folha e ela escolheu o destino), `downloaded` (o navegador não sabe
 * compartilhar arquivo — o PNG foi para os Downloads, e a tela tem de DIZER
 * isso, senão o toque não fez nada visível) e `error`.
 *
 * ⚠️ **`AbortError` é `shared`.** Cancelar a folha do sistema é uma decisão
 * dela, não uma falha — e tratá-lo como erro faria a tela pedir desculpa por
 * ela ter mudado de ideia. Era assim que o cartão da semana já tratava.
 */
export async function compartilharMomento(
  m: Momento,
  quem: { motherName?: string | null } = {},
): Promise<ShareResult> {
  if (typeof document === "undefined") return "unsupported";
  try {
    const canvas = desenharMomento(m, quem);
    const blob = await canvasToBlob(canvas);
    if (!blob) return "error";
    const file = new File([blob], `${m.arquivo}.png`, { type: "image/png" });

    const nav = navigator as Navigator & {
      canShare?: (d: unknown) => boolean;
      share?: (d: unknown) => Promise<void>;
    };
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: m.titulo, text: m.textoDeShare });
      return "shared";
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "downloaded";
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return "shared";
    return "error";
  }
}

/**
 * O mesmo cartão, mas como DATA URL — para virar a foto de um post da
 * Comunidade em vez de sair do app.
 *
 * ⚠️ **JPEG a 0,9, e não o PNG do compartilhamento.** O compositor manda a foto
 * no corpo do pedido, e `publicarPost` tem teto de 1.500.000 caracteres por
 * imagem: o PNG deste cartão passa fácil de 1 MB em base64, e a publicação
 * seria recusada com "não deu para publicar" sobre um cartão que a paciente
 * acabou de ver na tela. É a mesma razão pela qual as fotos do post já são
 * reduzidas a 1080 em JPEG.
 */
export function momentoComoDataUrl(
  m: Momento,
  quem: { motherName?: string | null } = {},
): string | null {
  if (typeof document === "undefined") return null;
  try {
    return desenharMomento(m, quem).toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}
