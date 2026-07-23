/**
 * Cartão de marco compartilhável — gera uma imagem bonita ("N semanas") num
 * canvas e compartilha via Web Share API (WhatsApp/Instagram/etc.). Tudo
 * offline, sem asset externo. Fallback: baixa a imagem.
 */

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

function drawCard(opts: CardOpts): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Fundo em degradê quente
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#fbeee6");
  g.addColorStop(0.55, "#f6d9cf");
  g.addColorStop(1, "#eebfb2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Brilhos suaves
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(W * 0.8, H * 0.18, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(200,120,95,0.12)";
  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.85, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  const cx = W / 2;

  // Eyebrow
  ctx.fillStyle = "#a85a44";
  ctx.font = "600 34px Georgia, serif";
  ctx.fillText("M I N H A   G E S T A Ç Ã O", cx, 200);

  // Fruta gigante (emoji)
  ctx.font = "220px sans-serif";
  ctx.fillText(fruitEmoji(opts.fruit), cx, 520);

  // Número da semana
  ctx.fillStyle = "#5b3225";
  ctx.font = "700 300px Georgia, serif";
  ctx.fillText(String(opts.week), cx, 800);
  ctx.fillStyle = "#8a5c4c";
  ctx.font = "500 70px Georgia, serif";
  ctx.fillText("semanas", cx, 880);

  // Tamanho do bebê
  ctx.fillStyle = "#5b3225";
  ctx.font = "400 46px Georgia, serif";
  const who = opts.babyName ? opts.babyName : "meu bebê";
  roundedText(ctx, `${who} do tamanho de ${opts.fruit.toLowerCase()} 💛`, cx, 1010, W - 200, 62);

  // Assinatura da mãe
  if (opts.motherName) {
    ctx.fillStyle = "#a85a44";
    ctx.font = "italic 500 44px Georgia, serif";
    ctx.fillText(`— ${opts.motherName}`, cx, 1130);
  }

  // Marca
  ctx.fillStyle = "rgba(91,50,37,0.55)";
  ctx.font = "600 36px sans-serif";
  ctx.fillText("obstetrica.com.br", cx, H - 70);

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
