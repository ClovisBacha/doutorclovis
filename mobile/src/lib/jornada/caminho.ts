/**
 * O CAMINHO — a régua do desenho da trilha, portada do site
 * (src/components/gestacao-path.tsx). Sem react-native aqui: é testado pelo bun.
 *
 * As constantes moram num COMPONENTE do site (não em src/lib), então não dá
 * para importá-las. A catraca `caminho.test.ts` lê o fonte do site e cobra que
 * fases, marcos e humores daqui sejam os mesmos de lá: uma cópia que divergisse
 * apareceria como o app e o site contando a mesma gestação de jeitos
 * diferentes.
 *
 * As CORES saem das mesmas fórmulas do site — oklch com o matiz girando pelas
 * 42 semanas, e `color-mix(in oklab, …)` para os tons de dia futuro, perdido e
 * para o brilho da bolinha —, calculadas aqui em hex sRGB (o React Native não
 * entende oklch). Fora do gamut sRGB o canal é cortado, como o navegador faz.
 */

/* ── Fases, marcos, humores ─────────────────────────────────────────────── */

export type Fase = { n: number; from: number; to: number; emoji: string; name: string };

export const FASES: readonly Fase[] = [
  { n: 1, from: 1, to: 7, emoji: "🌱", name: "Primeiros passos" },
  { n: 2, from: 8, to: 14, emoji: "💗", name: "Coração e forma" },
  { n: 3, from: 15, to: 21, emoji: "🦋", name: "Primeiros chutes" },
  { n: 4, from: 22, to: 28, emoji: "🌈", name: "Crescendo forte" },
  { n: 5, from: 29, to: 35, emoji: "🌙", name: "Reta final" },
  { n: 6, from: 36, to: 40, emoji: "🎉", name: "Chegada" },
];

/** Só para quem passa da semana 40 sem o bebê nascer (dia cru > 286). */
export const FASE_BONUS: Fase = { n: 7, from: 41, to: 42, emoji: "⏳", name: "Bônus: quase lá" };

export function fasesDaGestacao(diaCru: number): Fase[] {
  return diaCru > 286 ? [...FASES, FASE_BONUS] : [...FASES];
}

/**
 * Os marcos das semanas na trilha — os do site, MENOS os que eram exame ou
 * conduta (translucência nucal, morfológico, viabilidade fetal, scan de
 * crescimento, monitoramento pós-data, avaliação para indução): o app não é
 * conselho médico (decisão do dono, 21/10/2026). Semana sem marco mostra o
 * placar dela, "N de 7 dias".
 */
export const MARCOS: Readonly<Record<number, { emoji: string; label: string }>> = {
  4: { emoji: "🌱", label: "Início da jornada" },
  8: { emoji: "💗", label: "Coração batendo" },
  16: { emoji: "🫐", label: "Sente a luz" },
  28: { emoji: "💜", label: "3º Trimestre!" },
  36: { emoji: "🏠", label: "Quase em casa" },
  40: { emoji: "🎊", label: "Data prevista do parto!" },
};

export const HUMORES: readonly { emoji: string; label: string }[] = [
  { emoji: "😄", label: "Ótima" },
  { emoji: "🙂", label: "Bem" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😔", label: "Cansada" },
  { emoji: "🤢", label: "Enjoada" },
];

/* ── O check-in do humor ("Como você está hoje?") ───────────────────────── */

export const CHAVE_CHECKIN = "dc-path-checkin";

export type Checkin = { last: string; streak: number; mood?: string };

/** "AAAA-MM-DD" no fuso do aparelho — a mesma régua do `localDateStr` do site. */
export function dataLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function lerCheckin(v: unknown): Checkin {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return { last: "", streak: 0 };
  const o = v as Record<string, unknown>;
  return {
    last: typeof o.last === "string" ? o.last : "",
    streak: typeof o.streak === "number" && Number.isFinite(o.streak) ? o.streak : 0,
    mood: typeof o.mood === "string" ? o.mood : undefined,
  };
}

export function marcouHumorHoje(c: Checkin, hoje: Date): boolean {
  return c.last === dataLocal(hoje);
}

/** O check-in novo — `doCheckin` do site: a sequência cresce só se o último foi ontem. */
export function novoCheckin(c: Checkin, humor: string, hoje: Date): Checkin {
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  const streak = c.last === dataLocal(ontem) ? c.streak + 1 : 1;
  return { last: dataLocal(hoje), streak, mood: humor };
}

/* ── O desenho da trilha ────────────────────────────────────────────────── */

/** A mesma régua de arredondamento do site (`casaDoDesenho`): três casas. */
const casa = (v: number) => Math.round(v * 1000) / 1000;

/** Onde, em % da largura, mora a bolinha do passo `r` (r = D − 7): a onda de 8 passos. */
export function xDoPasso(r: number): number {
  return casa(50 + 26 * Math.sin((r * Math.PI) / 4));
}

export const ALTURA = {
  /** O passo entre duas bolinhas. */
  dia: 78,
  /** A folga a mais antes de HOJE, onde mora o balão "Desafio de hoje". */
  folgaDeHoje: 64,
  semana: 112,
  fase: 120,
} as const;

export type Bloco =
  | { tipo: "fase"; fase: Fase; travada: boolean; altura: number }
  | {
      tipo: "semana";
      semana: number;
      /** As 7 bolinhas da semana, com o centro (y) relativo ao topo do bloco. */
      dias: { D: number; x: number; y: number; hoje: boolean }[];
      altura: number;
    };

/**
 * A trilha em BLOCOS — uma faixa de fase, ou uma semana inteira (a barra da
 * semana + os sete dias). É a montagem de `buildFullJourney` do site, só que
 * agrupada para a lista virtualizada do app: cada bloco tem altura fixa e
 * conhecida, e o deslocamento de qualquer um sai de uma soma.
 */
export function montarCaminho(fases: readonly Fase[], hojeD: number): Bloco[] {
  const blocos: Bloco[] = [];
  let passo = 0;
  for (const fase of fases) {
    blocos.push({ tipo: "fase", fase, travada: fase.from * 7 > hojeD, altura: ALTURA.fase });
    for (let w = fase.from; w <= fase.to; w++) {
      let y = ALTURA.semana;
      const dias: { D: number; x: number; y: number; hoje: boolean }[] = [];
      for (let D = w * 7; D <= w * 7 + 6; D++) {
        const hoje = D === hojeD;
        if (hoje) y += ALTURA.folgaDeHoje;
        dias.push({ D, x: xDoPasso(passo), y: y + ALTURA.dia / 2, hoje });
        y += ALTURA.dia;
        passo++;
      }
      blocos.push({ tipo: "semana", semana: w, dias, altura: y });
    }
  }
  return blocos;
}

/* ── As cores ───────────────────────────────────────────────────────────── */

type Lab = { L: number; a: number; b: number };

function oklchParaLab(L: number, C: number, h: number): Lab {
  const r = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(r), b: C * Math.sin(r) };
}

function labParaRgbLinear({ L, a, b }: Lab): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function rgbLinearParaLab([r, g, b]: [number, number, number]): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

const paraLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const paraGama = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexParaLab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  return rgbLinearParaLab([
    paraLinear(((n >> 16) & 255) / 255),
    paraLinear(((n >> 8) & 255) / 255),
    paraLinear((n & 255) / 255),
  ]);
}

function labParaHex(lab: Lab): string {
  return (
    "#" +
    labParaRgbLinear(lab)
      .map((c) => {
        const v = Math.round(Math.min(1, Math.max(0, paraGama(Math.min(1, Math.max(0, c))))) * 255);
        return v.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

/** `color-mix(in oklab, X p, Y)` — p é a parte de X, de 0 a 1. */
function misturar(x: Lab, p: number, y: Lab): Lab {
  return { L: x.L * p + y.L * (1 - p), a: x.a * p + y.a * (1 - p), b: x.b * p + y.b * (1 - p) };
}

const BRANCO = hexParaLab("#ffffff");
const PRETO = hexParaLab("#000000");

/** O matiz da semana: do rosé da marca (348°) girando 300° até a semana 42. */
export function matizDaSemana(semana: number): number {
  const w = Math.max(1, Math.min(42, semana));
  return Number(((348 - ((w - 1) / 41) * 300 + 360) % 360).toFixed(1));
}

/**
 * Um tom da trilha: corpo e "lábio" (a sombra sólida embaixo da moeda 3D), em
 * hex para desenhar e em oklab para as misturas seguintes — o navegador mistura
 * a cor CHEIA, antes do corte do gamut, e aqui também.
 */
export type Tom = { main: string; lip: string; mainLab: Lab; lipLab: Lab };

function tomDeLab(mainLab: Lab, lipLab: Lab): Tom {
  return { main: labParaHex(mainLab), lip: labParaHex(lipLab), mainLab, lipLab };
}

/** Um tom de dois hex fixos (as cores do 4º trimestre, o `posMeta` do site). */
export function tomDeHex(main: string, lip: string): Tom {
  return tomDeLab(hexParaLab(main), hexParaLab(lip));
}

export function coresDaSemana(semana: number): Tom {
  const h = matizDaSemana(semana);
  return tomDeLab(oklchParaLab(0.64, 0.163, h), oklchParaLab(0.47, 0.142, h));
}

/** Dia que ainda vem: a cor da semana, pálida ("tem caminho pela frente"). */
export function tomFuturo(c: Tom): Tom {
  return tomDeLab(misturar(c.mainLab, 0.2, BRANCO), misturar(c.lipLab, 0.28, BRANCO));
}

/** Dia que passou sem ser feito: a cor da semana, acinzentada ("passou"). */
export function tomPerdido(c: Tom): Tom {
  return tomDeLab(
    misturar(c.mainLab, 0.42, hexParaLab("#ded7dc")),
    misturar(c.lipLab, 0.46, hexParaLab("#c3bcc2")),
  );
}

/** A semana inteira ainda no futuro: cinza, como a régua do site (`LOCKED`). */
export const TOM_TRAVADO: Tom = tomDeLab(hexParaLab("#dde5ee"), hexParaLab("#9fb0c4"));

/**
 * As três paradas do degradê radial de uma moeda: brilho (corpo misturado com
 * branco), corpo e borda (corpo misturado com preto). A bolinha do dia usa
 * 55 % / 82 %; a moeda da barra da semana, 45 % / 80 %.
 */
export function degradeDaMoeda(t: Tom, claro: number, escuro: number) {
  return {
    brilho: labParaHex(misturar(t.mainLab, claro, BRANCO)),
    corpo: t.main,
    borda: labParaHex(misturar(t.mainLab, escuro, PRETO)),
  };
}

/** `color-mix(in oklab, <cor do tom> p, white)`. */
export function comBranco(t: Tom, p: number, qual: "main" | "lip" = "main"): string {
  return labParaHex(misturar(qual === "main" ? t.mainLab : t.lipLab, p, BRANCO));
}

/** A cor da faixa da fase — por TRIMESTRE, pela semana em que a fase começa. */
export function corDaFaixa(semanaInicial: number): string {
  if (semanaInicial <= 13) return "#f6339a"; // pink-500
  if (semanaInicial <= 27) return "#fe9a00"; // amber-500
  if (semanaInicial <= 40) return "#8e51ff"; // violet-500
  return "#fe9a00";
}

/** O lábio da faixa: o mesmo lábio da SEMANA em que a fase começa. */
export function labioDaFaixa(semanaInicial: number): string {
  return coresDaSemana(semanaInicial).lip;
}
