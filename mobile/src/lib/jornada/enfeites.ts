/**
 * OS ENFEITES DO CANTINHO NA TRILHA — e o que a lojinha do app mostra.
 * Sem react-native aqui: é testado pelo bun.
 *
 * O layout é da PACIENTE (`dc-path-decor` no blob da jornada, o mesmo formato
 * do `loadDecor` do site): o que ela arrumou continua onde ela pôs.
 *
 * ⚠️ A régua de onde um enfeite NOVO nasce é do app (decisão do dono,
 * 14/10/2026): perto de hoje — ver `semearPertoDeHoje`. O site não muda mais.
 */

import {
  CANTINHO_BY_ID,
  CANTINHO_CATEGORIES,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_ITEMS,
  type CantinhoItem,
  type CantinhoType,
} from "@/lib/cantinho";
import { CONJUNTOS, conjuntosOrdenados, type ProgressoDoConjunto } from "@/lib/conjuntos";
import { ehClima } from "@/lib/clima-do-cantinho";

export const CHAVE_DECOR = "dc-path-decor";
export const DECOR_MAX = 120;
export const ESCALA_MIN = 0.5;
export const ESCALA_MAX = 4.5;

export type EnfeitePosto = { k: string; id: string; x: number; y: number; s: number };
export type Decoracao = { v: 1; items: EnfeitePosto[]; seen: string[] };

/** Hash estável (o `hashStr` do site): posições determinísticas, iguais nos dois. */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const limitar = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Lê o layout salvo, limpando o que não presta (o `loadDecor` do site). */
export function lerDecoracao(v: unknown): Decoracao | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const p = v as { items?: unknown; seen?: unknown };
  if (!Array.isArray(p.items)) return null;
  const items = (p.items as Record<string, unknown>[])
    .filter((it) => it && typeof it.id === "string" && CANTINHO_BY_ID[it.id as string])
    .map((it, i) => ({
      k: typeof it.k === "string" && it.k ? it.k : `p${i}`,
      id: it.id as string,
      x: limitar(Number(it.x) || 50, 3, 97),
      y: Math.max(0, Number(it.y) || 0),
      s: limitar(Number(it.s) || 1, ESCALA_MIN, ESCALA_MAX),
    }))
    .slice(0, DECOR_MAX);
  const seen = Array.isArray(p.seen)
    ? (p.seen as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  return { v: 1, items, seen };
}

/**
 * ESPALHA ITENS NOVOS PERTO DE HOJE — a régua do app (decisão do dono, 14/10).
 *
 * A régua do site (`seedDecor`) espalhava a partir do COMEÇO da trilha: quem
 * estava na semana 24 comprava uma joaninha e só a encontrava rolando até a
 * semana 1. Aqui cada item nasce em volta do dia de hoje — que é onde o
 * Caminho abre —, nas calhas dos dois lados, por fora das bolinhas (o meio é
 * da trilha). O céu nasce acima de hoje, no alto da tela.
 *
 * Determinístico (o mesmo hash para o mesmo item) e gravado: depois de nascer,
 * o enfeite não anda mais sozinho. Uma compra só cai a até ~290 px de hoje,
 * dentro da primeira tela; um lote grande se abre mais, para não amontoar.
 */
export function semearPertoDeHoje(
  ids: readonly string[],
  yDeHoje: number,
  alturaDaTrilha: number,
  deslocamento: number,
): EnfeitePosto[] {
  const fora: EnfeitePosto[] = [];
  const meia = Math.min(800, 260 + ids.length * 30);
  ids.forEach((id, i) => {
    const item = CANTINHO_BY_ID[id];
    if (!item) return;
    const h = hashStr(id);
    const idx = deslocamento + i;
    const especial = item.type === "especial";
    const copias = especial ? 1 : 2;
    for (let e = 0; e < copias; e++) {
      const mistura = (h % 997) + e * 389 + i * 211;
      const desvio = item.type === "ceu" ? -60 - (mistura % 220) : (mistura % (2 * meia)) - meia;
      const lado = (e + idx) % 2;
      /* Calhas de 7–11% e 89–93%: as bolinhas da trilha chegam a 16% e 84%
         da largura, e o enfeite desenhado ATRÁS de uma delas é o enfeite que
         ela comprou e não vê. */
      const ruido = (h >>> (e + 2)) % 5;
      fora.push({
        k: `h${idx}-${e}-${id}`,
        id,
        x: lado === 0 ? 7 + ruido : 89 + ruido,
        y: limitar(Math.round(yDeHoje + desvio), 20, Math.max(20, alturaDaTrilha - 20)),
        s: especial ? 1.6 : item.type === "planta" ? 1.25 : 1,
      });
    }
  });
  return fora;
}

/** Os tipos que NÃO viram enfeite de pôr na trilha (cenário, pele, céu do app, clima). */
const FORA_DA_BANDEJA: readonly CantinhoType[] = ["fundo", "trilha", "tema", "clima"];

/**
 * O que ela tem e pode pôr na trilha — a "bandeja" do Arrumar. Pelo TIPO, como
 * no site: a Chuva mansa e os Vaga-lumes são `especial` (adesivos de verdade,
 * com halo) e entram, mesmo emitindo partículas.
 */
export function bandeja(possuidos: readonly string[]): string[] {
  return possuidos.filter((id) => {
    const t = CANTINHO_BY_ID[id]?.type;
    return !!t && !FORA_DA_BANDEJA.includes(t);
  });
}

/** Os climas no ar: tudo o que ela tem e emite partículas (até três, `climasAtivos`). */
export function climasDela(possuidos: readonly string[]): string[] {
  return possuidos.filter((id) => ehClima(id));
}

/**
 * Semeia o que ela comprou e ainda não foi visto pela trilha (o efeito de
 * auto-colocação do site, com a régua do app — perto de hoje): cada item novo
 * nasce em duas cópias (o especial, em uma), até o teto de 120.
 *
 * ⚠️ Só é marcado como visto o que COUBE: o resto ESPERA a vaga (e `esperando`
 * diz quantos, para a tela avisar que a trilha está cheia). Marcar tudo de uma
 * vez fazia o item recém-comprado sumir para sempre — o defeito do Pavão no site.
 * `decoracao` é `null` quando não há nada novo que caiba.
 */
export function semearNovos(
  atual: Decoracao | null,
  possuidos: readonly string[],
  alturaDaTrilha: number,
  yDeHoje: number,
): { decoracao: Decoracao | null; esperando: number } {
  const base = atual ?? { v: 1 as const, items: [], seen: [] };
  const novos = bandeja(possuidos).filter((id) => !base.seen.includes(id));
  if (novos.length === 0) return { decoracao: null, esperando: 0 };
  const cabem: string[] = [];
  let usados = base.items.length;
  for (const id of novos) {
    const custo = CANTINHO_BY_ID[id]?.type === "especial" ? 1 : 2;
    if (usados + custo > DECOR_MAX) break;
    cabem.push(id);
    usados += custo;
  }
  const esperando = novos.length - cabem.length;
  if (cabem.length === 0) return { decoracao: null, esperando };
  return {
    decoracao: {
      v: 1,
      items: [
        ...base.items,
        ...semearPertoDeHoje(cabem, yDeHoje, alturaDaTrilha, base.items.length),
      ],
      seen: [...base.seen, ...cabem],
    },
    esperando,
  };
}

/**
 * Os enfeites que aparecem: nunca um de clima (layouts antigos podem tê-los
 * gravados), e só os que ela ainda tem — enquanto a lista do que ela tem não
 * chegou (`null`), aparecem todos os gravados, como no site.
 */
export function enfeitesVisiveis(
  d: Decoracao | null,
  possuidos: readonly string[] | null,
): EnfeitePosto[] {
  if (!d) return [];
  const semClima = d.items.filter((p) => CANTINHO_BY_ID[p.id]?.type !== "clima");
  if (!possuidos || possuidos.length === 0) return semClima;
  return semClima.filter((p) => possuidos.includes(p.id));
}

/* ── A trilha do site × os blocos do app ───────────────────────────────────

   As posições gravadas são as do SITE: `x` em % da largura e `y` em px desde o
   topo da trilha de `buildFullJourney`, que começa em y = 8 e termina com 40
   de respiro. Os blocos do app (`montarCaminho`) têm as MESMAS alturas, então
   o enfeite de y = 1234 no site cai no mesmo lugar da mesma semana aqui. */

/** Onde o primeiro bloco começa na trilha do site. */
export const Y_INICIAL_DO_SITE = 8;

/** A altura da trilha no site (`height` de `buildFullJourney`) — é com ela que se semeia. */
export function alturaNoSite(alturas: readonly number[]): number {
  return Y_INICIAL_DO_SITE + alturas.reduce((s, h) => s + h, 0) + 40;
}

export type EnfeiteNoBloco = { p: EnfeitePosto; y: number };

/**
 * Em que bloco cada enfeite mora, e a altura dele DENTRO do bloco — a lista do
 * app é virtualizada, e cada bloco desenha só os seus. Antes do primeiro bloco,
 * fica no primeiro; depois do último, no último.
 */
export function enfeitesPorBloco(
  enfeites: readonly EnfeitePosto[],
  alturas: readonly number[],
): EnfeiteNoBloco[][] {
  const fora: EnfeiteNoBloco[][] = alturas.map(() => []);
  if (alturas.length === 0) return fora;
  const inicios: number[] = [];
  let soma = Y_INICIAL_DO_SITE;
  for (const h of alturas) {
    inicios.push(soma);
    soma += h;
  }
  for (const p of enfeites) {
    let lo = 0;
    let hi = alturas.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (inicios[m] <= p.y) lo = m;
      else hi = m - 1;
    }
    fora[lo].push({ p, y: p.y - inicios[lo] });
  }
  return fora;
}

/* ── O modo Arrumar (as contas do `onPathPointerMove` e do `addDecor`) ──── */

/** Arrastar: `dx` em % da largura, `dy` em px; nunca sai da trilha. */
export function moverEnfeite(
  p: EnfeitePosto,
  dxPct: number,
  dyPx: number,
  alturaDaTrilha: number,
): EnfeitePosto {
  return {
    ...p,
    x: limitar(p.x + dxPct, 3, 97),
    y: limitar(p.y + dyPx, 20, Math.max(20, alturaDaTrilha - 20)),
  };
}

/** A alça ⤢: o arrasto na diagonal muda o tamanho (160 px = 1 de escala). */
export function escalaArrastada(s0: number, dx: number, dy: number): number {
  return limitar(s0 + (dx + dy) / 160, ESCALA_MIN, ESCALA_MAX);
}

/** O item tirado da bandeja: nasce no meio do que está à vista, para ela vê-lo aparecer. */
export function novoEnfeite(
  id: string,
  ySite: number,
  alturaDaTrilha: number,
  chave: string,
): EnfeitePosto {
  return {
    k: chave,
    id,
    x: 50,
    y: limitar(ySite, 40, Math.max(40, alturaDaTrilha - 40)),
    s: 1.4,
  };
}

/* ── O cenário (fundo) equipado ─────────────────────────────────────────── */

export type Parada = { cor: string; pos: number };

/** "linear-gradient(180deg,#a 0%,#b 40%,#c 100%)" → as paradas, em 0..1. */
export function paradasDoDegrade(css: string): Parada[] {
  const fora: Parada[] = [];
  const re = /(#[0-9a-fA-F]{3,6})\s+(\d+(?:\.\d+)?)%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let hex = m[1];
    if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    fora.push({ cor: hex.toLowerCase(), pos: Number(m[2]) / 100 });
  }
  return fora;
}

/** A cor do degradê na posição t (0..1), interpolada em sRGB como o CSS faz. */
export function corNoDegrade(paradas: readonly Parada[], t: number): string {
  if (paradas.length === 0) return "#ffffff";
  if (t <= paradas[0].pos) return paradas[0].cor;
  for (let i = 1; i < paradas.length; i++) {
    const a = paradas[i - 1];
    const b = paradas[i];
    if (t <= b.pos) {
      const f = b.pos === a.pos ? 1 : (t - a.pos) / (b.pos - a.pos);
      const ca = parseInt(a.cor.slice(1), 16);
      const cb = parseInt(b.cor.slice(1), 16);
      const canal = (sh: number) => {
        const x = (ca >> sh) & 255;
        const y = (cb >> sh) & 255;
        return Math.round(x + (y - x) * f);
      };
      return `#${[16, 8, 0].map((sh) => canal(sh).toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return paradas[paradas.length - 1].cor;
}

/**
 * O pedaço do degradê entre `t0` e `t1` (0..1 da trilha inteira), pronto para
 * um `LinearGradient`: as cores das pontas e as paradas que caem no meio.
 *
 * O site pinta o cenário na trilha INTEIRA (~27.000 px); o app pinta só a
 * janela que está à vista — um degradê dessa altura viraria uma textura de
 * centenas de megabytes no iPhone.
 */
export function fatiaDoDegrade(
  paradas: readonly Parada[],
  t0: number,
  t1: number,
): { cores: string[]; posicoes: number[] } {
  const a = limitar(t0, 0, 1);
  const b = limitar(t1, 0, 1);
  if (b <= a) {
    const c = corNoDegrade(paradas, a);
    return { cores: [c, c], posicoes: [0, 1] };
  }
  const cores = [corNoDegrade(paradas, a)];
  const posicoes = [0];
  for (const p of paradas) {
    if (p.pos > a && p.pos < b) {
      cores.push(p.cor);
      posicoes.push((p.pos - a) / (b - a));
    }
  }
  cores.push(corNoDegrade(paradas, b));
  posicoes.push(1);
  return { cores, posicoes };
}

/* ── A lojinha do app (v1: sem Premium) ─────────────────────────────────── */

/**
 * ⚠️ O APP v1 NÃO TEM PREMIUM — e nenhuma porta para comprar com dinheiro.
 *
 * No site, os itens premium aparecem trancados com "💎 Ver o Premium", que
 * abre a oferta paga. No app isso seria uma porta de compra fora do sistema
 * da Apple (diretriz 3.1.1). E mostrar a quem já assina no site o que só a
 * assinatura destrava esbarra na 3.1.3(b): conteúdo comprado fora só pode ser
 * usado no app se também estiver à venda lá dentro, pela Apple.
 *
 * Então, para TODAS: a lojinha do app mostra os itens que se compram com
 * sementinhas e os premium que ela JÁ tem (comprar é definitivo — o que é dela
 * continua dela). Nenhum cartão diz "Premium". Quando a compra pela Apple
 * existir, é aqui que os outros voltam.
 *
 * O "Céu do app" (`tema`) também fica fora: ele troca o céu da tela inicial do
 * SITE, e no app não teria efeito nenhum — um "Usar" que não muda nada.
 */
export function itensDaLoja(possuidos: readonly string[]): CantinhoItem[] {
  return CANTINHO_ITEMS.filter((i) => {
    if (i.type === "tema") return false;
    const tem = possuidos.includes(i.id);
    if (i.aposentado && !tem) return false;
    if (i.premium && !tem) return false;
    return true;
  }).sort((a, b) => {
    const peso = (i: CantinhoItem) => (i.id === CANTINHO_COMPLETIONIST_ID ? 1 : 0);
    return peso(a) - peso(b) || a.price - b.price || a.name.localeCompare(b.name, "pt-BR");
  });
}

/** As fichas de categoria que têm pelo menos um item à mostra, na ordem do site. */
export function categoriasDaLoja(
  itens: readonly CantinhoItem[],
): { key: CantinhoType; label: string }[] {
  return CANTINHO_CATEGORIES.filter((c) => itens.some((i) => i.type === c.key));
}

/**
 * Os conjuntos que ela consegue completar aqui (todos os itens à venda ou já
 * dela). ⚠️ Todo conjunto tem ao menos um item premium, então para quem nunca
 * comprou no site a lista é VAZIA — e a tela esconde a fileira, em vez de
 * mostrar "0 de 4" de coisas que o app não vende.
 */
export function conjuntosDaLoja(possuidos: readonly string[]): ProgressoDoConjunto[] {
  const alcancaveis = new Set(itensDaLoja(possuidos).map((i) => i.id));
  const ok = new Set(
    CONJUNTOS.filter((c) => c.itens.every((id) => alcancaveis.has(id))).map((c) => c.id),
  );
  return conjuntosOrdenados(possuidos).filter((p) => ok.has(p.conjunto.id));
}
