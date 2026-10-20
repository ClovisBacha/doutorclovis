/**
 * O 4º TRIMESTRE — as 12 primeiras semanas de vida do bebê, a régua do
 * `PosPartoJourney` do site (src/components/gestacao-path.tsx), em puro.
 *
 * As tabelas (fases, figurinhas, orientação da semana) moram num COMPONENTE do
 * site, que não dá para importar. A catraca `pos-parto.test.ts` lê o fonte do
 * site e cobra que as daqui sejam as mesmas de lá.
 *
 * ── O dia do pós-parto ──
 *   dc-path-pos-day-<D>    = { humor?, desafio?, leitura?, w_meditation?, … }
 *   dc-path-pos-done-days  = number[]  (dias com as TRÊS tarefas do site)
 *   dc-path-pos-stickers   = number[]  (semanas de vida com figurinha)
 *
 * D = idade do bebê em dias + 7, preso em 90 (o site prende a idade em 83: as
 * 12 semanas completas encerram a trilha). O dia fecha com as três tarefas do
 * site — o check-in de humor, o desafio e a leitura da orientação da semana —
 * e não com os cinco momentos da gestação: no pós-parto, o essencial é pouco,
 * de propósito. As atividades (respirar, gratidão…) acendem a chama e não
 * entram na conta do dia.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

import { posChallenge } from "@/lib/daily-challenges";
import { tomDeHex, type Fase, type Tom } from "~/lib/jornada/caminho";
import { MESES } from "~/lib/jornada/hoje";
import {
  chaveDoDia,
  flagsDoDia,
  listaDeNumeros,
  type Blob,
  type FlagsDoDia,
} from "~/lib/jornada/momentos";

/* ── As tabelas do site ─────────────────────────────────────────────────── */

export const FASES_DO_POS: readonly Fase[] = [
  { n: 1, from: 1, to: 4, emoji: "🍼", name: "Chegando em casa" },
  { n: 2, from: 5, to: 8, emoji: "🌙", name: "Criando ritmo" },
  { n: 3, from: 9, to: 12, emoji: "🧸", name: "Descobertas" },
];

export const SEMANAS_DO_POS = 12;

/** A figurinha de cada semana de vida (`POS_EMOJI`). */
export const FIGURINHAS_DO_POS: Readonly<Record<number, string>> = {
  1: "🤱",
  2: "🍼",
  3: "👶",
  4: "💜",
  5: "🌙",
  6: "😊",
  7: "🎈",
  8: "🧸",
  9: "🪁",
  10: "🌷",
  11: "🎵",
  12: "🎓",
};

/** O que vale em cada semana de vida (`POS_GUIDANCE`). */
export const ORIENTACAO_DO_POS: Readonly<Record<number, string>> = {
  1: "Descanso e amamentação em livre demanda. Teste do pezinho entre o 3º e o 5º dia. Agende a revisão pós-parto (7–10 dias).",
  2: "Atenção aos sinais de alerta: febre, sangramento intenso, dor forte ou tristeza persistente. Se a amamentação doer, procure ajuda com a pega.",
  3: "Baby blues costuma passar até aqui. Se a tristeza persistir ou piorar, faça o check-in emocional e fale com o seu médico — você não está sozinha.",
  4: "Agende a consulta puerperal completa (30–40 dias): revisão geral, contracepção e liberação de atividades.",
  5: "As vacinas de 2 meses do bebê estão chegando — deixe agendadas (penta, VIP, pneumo 10, rotavírus).",
  6: "Consulta puerperal em dia? É nela que se libera exercício físico e se define contracepção. Cuide também do seu sono.",
  7: "Crie pequenos rituais de rotina para o bebê: banho, mamada, soneca. A previsibilidade acalma vocês dois.",
  8: "Semana das vacinas de 2 meses. Febre baixa e irritação no dia seguinte podem acontecer — mantenha o bebê hidratado.",
  9: "Se liberada na consulta puerperal, retome exercícios leves de forma gradual. Assoalho pélvico primeiro.",
  10: "Autocuidado não é luxo: reserve um tempo seu por dia. Mãe cuidada cuida melhor.",
  11: "Marcos esperados: sorriso social e mais firmeza no pescoço. Cada bebê tem seu ritmo — registre os do seu.",
  12: "Fim do 4º trimestre! Vacina de meningo C aos 3 meses. Parabéns por chegar até aqui — jornada completa. 🎓",
};

/* ── O desafio do dia ───────────────────────────────────────────────────── */

/**
 * Os desafios do pós-parto que mandam para telas que o app não tem — o Álbum
 * de fotos, o Diário, a aba Pós-parto e as vacinas em Saúde. O texto é do site
 * (congelado); aqui ele vira o gesto que o app consegue acompanhar (a agenda,
 * o álbum de vocês, uma foto no celular). A catraca de `pos-parto.test.ts`
 * confere que o texto do site ainda é o que foi trocado.
 */
export const DESAFIOS_DO_POS_NO_APP: Readonly<Record<number, { site: string; app: string }>> = {
  27: {
    site: "Feche a semana 3 com uma foto no Álbum",
    app: "Feche a semana 3 com uma foto de vocês dois",
  },
  41: {
    site: "Escreva no Diário 3 coisas que você aprendeu",
    app: "Anote 3 coisas que você aprendeu nestas semanas",
  },
  48: {
    site: "Feche as 6 semanas: registre no Pós-parto",
    app: "Feche as 6 semanas: ponha a consulta puerperal na agenda",
  },
  55: {
    site: "Anote no Diário a rotina que já funciona",
    app: "Anote a rotina que já funciona para vocês",
  },
  62: {
    site: "Registre em Saúde as vacinas de 2 meses",
    app: "Ponha na agenda as vacinas de 2 meses",
  },
  75: {
    site: "Escreva no Diário como você está de verdade",
    app: "Escreva como você está de verdade, só para você",
  },
  83: {
    site: "Guarde no Álbum a cabecinha mais firme",
    app: "Guarde uma foto da cabecinha mais firme",
  },
  90: {
    site: "Releia o Diário e celebre o 4º trimestre",
    app: "Abra o álbum de vocês e celebre o 4º trimestre",
  },
};

/** O desafio do dia D do pós-parto, como o app o mostra (`null` depois do dia 90). */
export function desafioDoPos(D: number): { emoji: string; label: string } | null {
  const c = posChallenge(D);
  if (!c) return null;
  const troca = DESAFIOS_DO_POS_NO_APP[D];
  return { emoji: c.emoji, label: troca && troca.site === c.label ? troca.app : c.label };
}

/* ── As chaves do blob ──────────────────────────────────────────────────── */

export const CHAVE_FEITOS_POS = "dc-path-pos-done-days";
export const CHAVE_FIGURINHAS_POS = "dc-path-pos-stickers";
/** A festa do nascimento já foi vista (a `LS.celebrated` do site). */
export const CHAVE_NASCIMENTO_FESTEJADO = "dc-path-birth-celebrated";

/* ── O dia e a semana ───────────────────────────────────────────────────── */

/** 12 semanas completas: a idade em que a trilha do 4º trimestre se encerra. */
export const ULTIMA_IDADE_DA_TRILHA = 83;

/** O D da trilha: idade + 7, presa nas 12 semanas (D 7..90). */
export function diaNaTrilhaDoPos(idadeDias: number): number {
  return Math.min(ULTIMA_IDADE_DA_TRILHA, Math.max(0, Math.floor(idadeDias))) + 7;
}

/** Passou das 12 semanas: o 4º trimestre terminou (a "formatura" do site). */
export function formou(idadeDias: number): boolean {
  return idadeDias > ULTIMA_IDADE_DA_TRILHA;
}

export function semanaDeVida(D: number): number {
  return Math.max(1, Math.min(SEMANAS_DO_POS, Math.floor(D / 7)));
}

export function faseDoPos(semana: number): Fase {
  return FASES_DO_POS.find((f) => semana >= f.from && semana <= f.to) ?? FASES_DO_POS[2]!;
}

export function figurinhaDoPos(semana: number): string {
  return FIGURINHAS_DO_POS[semana] ?? "🍼";
}

export function orientacaoDoPos(semana: number): string {
  return ORIENTACAO_DO_POS[semana] ?? ORIENTACAO_DO_POS[12]!;
}

/* ── As três tarefas do dia ─────────────────────────────────────────────── */

export type TarefaDoPos = "humor" | "desafio" | "leitura";

export const TAREFAS_DO_POS: readonly TarefaDoPos[] = ["humor", "desafio", "leitura"];

export function tarefasFeitas(flags: FlagsDoDia): number {
  return TAREFAS_DO_POS.filter((t) => flags[t]).length;
}

export function diasDoPosFechados(blob: Blob): number[] {
  return listaDeNumeros(blob[CHAVE_FEITOS_POS]);
}

export function figurinhasDoPos(blob: Blob): number[] {
  return listaDeNumeros(blob[CHAVE_FIGURINHAS_POS]);
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type MarcaDoPos = {
  blob: Blob;
  jaEstava: boolean;
  /** Esta marca fechou as três tarefas agora. */
  fechouAgora: boolean;
  /** A semana de vida que ganhou a figurinha agora (ou `null`). */
  figurinhaNova: number | null;
};

/**
 * Marca uma tarefa num dia do pós-parto e, se as três fecharam, põe o dia nos
 * feitos e a semana nas figurinhas — o `markDayTask` do `PosPartoJourney`.
 * Devolve um blob NOVO (a loja compara por referência).
 */
export function marcarTarefaDoPos(blob: Blob, D: number, tarefa: TarefaDoPos): MarcaDoPos {
  const chave = chaveDoDia(D, true);
  const flags = flagsDoDia(blob, D, true);
  if (flags[tarefa]) return { blob, jaEstava: true, fechouAgora: false, figurinhaNova: null };
  const bruto = blob[chave];
  const dia: Record<string, unknown> = { ...(ehObjeto(bruto) ? bruto : {}), [tarefa]: true };
  const novo: Blob = { ...blob, [chave]: dia };
  const feitos = diasDoPosFechados(blob);
  if (tarefasFeitas(dia as FlagsDoDia) < TAREFAS_DO_POS.length || feitos.includes(D)) {
    return { blob: novo, jaEstava: false, fechouAgora: false, figurinhaNova: null };
  }
  novo[CHAVE_FEITOS_POS] = [...feitos, D].sort((a, b) => a - b);
  const semana = Math.floor(D / 7);
  const figurinhas = figurinhasDoPos(blob);
  let figurinhaNova: number | null = null;
  if (!figurinhas.includes(semana)) {
    novo[CHAVE_FIGURINHAS_POS] = [...figurinhas, semana].sort((a, b) => a - b);
    figurinhaNova = semana;
  }
  return { blob: novo, jaEstava: false, fechouAgora: true, figurinhaNova };
}

/**
 * Fecha os dias do pós-parto que ficaram com as três tarefas sem passar pela
 * marca que fecha (uma parte feita no site, outra aqui: a mescla junta as
 * flags, mas ninguém fechou o dia). Mesma referência quando não há o que fechar.
 */
export function fecharDiasDoPosCompletos(blob: Blob): { blob: Blob; fechados: number[] } {
  const prefixo = "dc-path-pos-day-";
  const feitos = diasDoPosFechados(blob);
  const fechados: number[] = [];
  for (const [chave, v] of Object.entries(blob)) {
    if (!chave.startsWith(prefixo) || !ehObjeto(v)) continue;
    const resto = chave.slice(prefixo.length);
    if (!/^\d+$/.test(resto)) continue;
    const D = Number(resto);
    if (!feitos.includes(D) && tarefasFeitas(flagsDoDia(blob, D, true)) >= TAREFAS_DO_POS.length)
      fechados.push(D);
  }
  if (!fechados.length) return { blob, fechados };
  fechados.sort((a, b) => a - b);
  const semanas = fechados.map((D) => Math.floor(D / 7));
  return {
    blob: {
      ...blob,
      [CHAVE_FEITOS_POS]: Array.from(new Set([...feitos, ...fechados])).sort((a, b) => a - b),
      [CHAVE_FIGURINHAS_POS]: Array.from(new Set([...figurinhasDoPos(blob), ...semanas])).sort(
        (a, b) => a - b,
      ),
    },
    fechados,
  };
}

export type EstadoDoNoDoPos =
  | { tipo: "hoje"; tarefas: number; fechado: boolean }
  | { tipo: "passado"; tarefas: number; fechado: boolean }
  | { tipo: "futuro" };

export function estadoDoNoDoPos(blob: Blob, D: number, hojeD: number): EstadoDoNoDoPos {
  if (D > hojeD) return { tipo: "futuro" };
  const tarefas = tarefasFeitas(flagsDoDia(blob, D, true));
  const fechado = diasDoPosFechados(blob).includes(D) || tarefas >= TAREFAS_DO_POS.length;
  return {
    tipo: D === hojeD ? "hoje" : "passado",
    tarefas: fechado ? TAREFAS_DO_POS.length : tarefas,
    fechado,
  };
}

/* ── As cores (o `posMeta` do site) ─────────────────────────────────────── */

export function coresDaSemanaDoPos(semana: number): Tom {
  if (semana <= 4) return tomDeHex("#38bdf8", "#0369a1");
  if (semana <= 8) return tomDeHex("#8b5cf6", "#6d28d9");
  return tomDeHex("#34d399", "#047857");
}

/** A faixa da fase: sky-500, violet-500 e emerald-500 (as do Tailwind 4 do site). */
export function corDaFaixaDoPos(semanaInicial: number): string {
  if (semanaInicial <= 4) return "#00a6f4";
  if (semanaInicial <= 8) return "#8e51ff";
  return "#00bc7d";
}

/* ── O humor ────────────────────────────────────────────────────────────── */

/**
 * Os humores do check-in no pós-parto. O site reaproveitava os da gestação, e
 * "Enjoada" sobrava; "Triste" faltava — e é o que mais importa aqui, porque é
 * por ele que a tela oferece apoio.
 */
export const HUMORES_DO_POS: readonly { emoji: string; label: string }[] = [
  { emoji: "😄", label: "Ótima" },
  { emoji: "🙂", label: "Bem" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😴", label: "Cansada" },
  { emoji: "😢", label: "Triste" },
];

/** O humor que abre o cartão de apoio (fale com o seu médico · CVV 188). */
export function humorPedeApoio(label: string | null | undefined): boolean {
  return label === "Triste";
}

/* ── O nascimento ───────────────────────────────────────────────────────── */

/** Até quanto tempo para trás ela pode contar o nascimento (~14 meses, a régua do site). */
export const DIAS_PARA_TRAS_DO_NASCIMENTO = 420;

export type RecusaDoNascimento = "futuro" | "antiga";

/** Por que a data não serve (`null` = serve). `hoje` e `ymd` em AAAA-MM-DD. */
export function recusaDoNascimento(ymd: string, hoje: Date): RecusaDoNascimento | null {
  const h = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  if (ymd > h) return "futuro";
  const limite = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate() - DIAS_PARA_TRAS_DO_NASCIMENTO,
  );
  const l = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
  if (ymd < l) return "antiga";
  return null;
}

/**
 * O nascimento como o blob guarda (`dc-path-birth`). O site lê só `date`; a
 * hora, o peso e o comprimento são do app — eles vão no cartão da chegada.
 */
export type DadosDoNascimento = {
  date: string;
  hora?: string;
  pesoG?: number;
  cm?: number;
};

/** Faixas de DIGITAÇÃO (um zero a mais, uma vírgula no lugar errado) — não são régua clínica. */
export const PESO_DIGITAVEL = { min: 300, max: 6500 } as const;
export const COMPRIMENTO_DIGITAVEL = { min: 25, max: 60 } as const;

export function lerNascimento(v: unknown): DadosDoNascimento | null {
  if (!ehObjeto(v) || typeof v.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.date))
    return null;
  const fora: DadosDoNascimento = { date: v.date };
  if (typeof v.hora === "string" && /^\d{1,2}:\d{2}$/.test(v.hora)) fora.hora = v.hora;
  if (typeof v.pesoG === "number" && v.pesoG >= PESO_DIGITAVEL.min && v.pesoG <= PESO_DIGITAVEL.max)
    fora.pesoG = Math.round(v.pesoG);
  if (
    typeof v.cm === "number" &&
    v.cm >= COMPRIMENTO_DIGITAVEL.min &&
    v.cm <= COMPRIMENTO_DIGITAVEL.max
  )
    fora.cm = Math.round(v.cm * 10) / 10;
  return fora;
}

/** "3.250 g" — o peso como o cartão escreve. */
export function pesoPorExtenso(g: number): string {
  return `${Math.round(g).toLocaleString("pt-BR")} g`;
}

/** "48,5 cm". */
export function comprimentoPorExtenso(cm: number): string {
  return `${String(Math.round(cm * 10) / 10).replace(".", ",")} cm`;
}

/** "18 de outubro de 2026 · 6:42" — a chegada como o cartão escreve. */
export function nascimentoPorExtenso(d: DadosDoNascimento): string {
  const [a, m, dia] = d.date.split("-").map(Number) as [number, number, number];
  return `${dia} de ${MESES[m - 1]} de ${a}${d.hora ? ` · ${d.hora}` : ""}`;
}

/** "3.250 g · 48,5 cm", só com o que ela contou (ou `null`). */
export function medidasPorExtenso(d: DadosDoNascimento): string | null {
  const partes = [
    d.pesoG != null ? pesoPorExtenso(d.pesoG) : null,
    d.cm != null ? comprimentoPorExtenso(d.cm) : null,
  ].filter((x): x is string => !!x);
  return partes.length ? partes.join(" · ") : null;
}

/**
 * O peso como ela digita: "3250", "3.250", "3250 g" ou em quilos ("3,25",
 * "3.25 kg"). `null` quando vazio ou fora da faixa de digitação.
 */
export function lerPesoDigitado(texto: string): number | null {
  const t = texto
    .trim()
    .toLowerCase()
    .replace(/\s|g$|kg$/g, "");
  if (!t) return null;
  let g: number;
  if (/^\d{1,2}[.,]\d{1,3}$/.test(t) && !/^\d[.]\d{3}$/.test(t))
    g = Number(t.replace(",", ".")) * 1000;
  else g = Number(t.replace(/[.,]/g, ""));
  if (!Number.isFinite(g) || g < PESO_DIGITAVEL.min || g > PESO_DIGITAVEL.max) return null;
  return Math.round(g);
}

/** A máscara do campo da hora: só dígitos, com os dois-pontos depois do segundo. */
export function mascaraDeHora(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

/** A hora digitada ("06:42", "6:42", "0642") como o blob guarda ("6:42"), ou `null`. */
export function lerHoraDigitada(texto: string): string | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${h}:${String(mi).padStart(2, "0")}`;
}

/** O comprimento: "48", "48,5", "48.5 cm". */
export function lerComprimentoDigitado(texto: string): number | null {
  const t = texto
    .trim()
    .toLowerCase()
    .replace(/\s|cm$/g, "")
    .replace(",", ".");
  if (!t) return null;
  const cm = Number(t);
  if (!Number.isFinite(cm) || cm < COMPRIMENTO_DIGITAVEL.min || cm > COMPRIMENTO_DIGITAVEL.max)
    return null;
  return Math.round(cm * 10) / 10;
}

/** Até quantos dias depois do parto a festa ainda abre (quem só volta meses depois não a recebe). */
export const DIAS_DA_FESTA_DO_NASCIMENTO = 30;

/** A festa do nascimento abre? Nunca no Modo Cuidado — a perda perinatal mora nesta fase. */
export function abreFestaDoNascimento(o: {
  idadeDias: number;
  festejado: boolean;
  cuidado: boolean;
}): boolean {
  return (
    !o.cuidado && !o.festejado && o.idadeDias >= 0 && o.idadeDias <= DIAS_DA_FESTA_DO_NASCIMENTO
  );
}

/** O que a gestação deixou: dias de cinco estrelas e figurinhas (para a festa e o álbum). */
export function resumoDaGestacao(blob: Blob): { diasCompletos: number; figurinhas: number } {
  return {
    diasCompletos: listaDeNumeros(blob["dc-path-done-days"]).length,
    figurinhas: listaDeNumeros(blob["dc-path-stickers"]).length,
  };
}
