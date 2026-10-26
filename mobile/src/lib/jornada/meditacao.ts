/**
 * A MEDITAÇÃO DO DIA — os temas, o plano da sessão e o fechamento, como no
 * app antigo (`MeditationBlock` em gestacao-path.tsx).
 *
 * Os temas são os mesmos do site (MEDITACOES), com a mesma decisão de luto: só
 * passa quem foi marcado `noLuto`. As falas vêm de `planejarSessao`
 * (`@/lib/meditacao-sessao`), que também limpa, fala a fala, o que citaria o
 * bebê no Modo Cuidado. O que mora num componente do site (e por isso não se
 * importa) está copiado aqui, e `meditacao.test.ts` lê o site para nada
 * divergir.
 * Sem react-native aqui: é testado pelo bun.
 */

import { CICLO, planejarSessao, type Densidade, type Plano } from "@/lib/meditacao-sessao";
import { sequenciaDeDatas } from "@/lib/sequencia";

export type TemaDeMeditacao = {
  tema: string;
  precisa: string;
  emoji: string;
  /** Oferecido no Modo Cuidado. O padrão é não. */
  noLuto?: boolean;
  /** Fala da gestação (o bebê dentro, o parto que vem): fora do pós-parto. */
  soGestacao?: boolean;
};

export const TEMAS_DE_MEDITACAO: readonly TemaDeMeditacao[] = [
  { tema: "Só respirar", precisa: "Quero só respirar", emoji: "🌬️", noLuto: true },
  { tema: "Calma", precisa: "Estou tensa", emoji: "🌊", noLuto: true },
  { tema: "Conexão com o bebê", precisa: "Quero sentir o bebê", emoji: "💛", soGestacao: true },
  { tema: "Descanso", precisa: "Preciso descansar", emoji: "🌙", noLuto: true },
  { tema: "Gratidão", precisa: "Quero um respiro bom", emoji: "✨" },
  { tema: "Sono tranquilo", precisa: "Não consigo dormir", emoji: "😴", noLuto: true },
  { tema: "Coragem pro parto", precisa: "Estou com medo do parto", emoji: "🦁", soGestacao: true },
  { tema: "Aqui e agora", precisa: "Minha cabeça não para", emoji: "🍃", noLuto: true },
];

export function temasDisponiveis(o: { cuidado: boolean; posParto: boolean }): TemaDeMeditacao[] {
  return TEMAS_DE_MEDITACAO.filter(
    (t) => (!o.cuidado || t.noLuto) && (!o.posParto || !t.soGestacao),
  );
}

/** O tema "do dia" — o selo na lista, e o que já vem marcado. */
export function indiceDoTemaDoDia(D: number, quantos: number): number {
  return quantos > 0 ? ((Math.floor(D) % quantos) + quantos) % quantos : 0;
}

/** As durações do app antigo; "um minutinho de calma" também conta. */
export const DURACOES_MEDITAR = [1, 2, 5, 10] as const;
export type DuracaoMeditar = (typeof DURACOES_MEDITAR)[number];
export const DURACAO_PADRAO_MEDITAR: DuracaoMeditar = 5;

/** O registro da meditação, que viaja no blob da jornada (`dc-path-med-log`). */
export type RegistroDaMeditacao = { dias: string[]; minutos: number; humores: string[] };

export function lerRegistro(bruto: unknown): RegistroDaMeditacao {
  const r = (bruto ?? {}) as Partial<RegistroDaMeditacao>;
  return {
    dias: Array.isArray(r.dias) ? r.dias.filter((d): d is string => typeof d === "string") : [],
    minutos: typeof r.minutos === "number" && Number.isFinite(r.minutos) ? r.minutos : 0,
    humores: Array.isArray(r.humores)
      ? r.humores.filter((h): h is string => typeof h === "string")
      : [],
  };
}

/** `registrarMeditacao` do site: o dia entra uma vez, os minutos somam, o humor guarda os 30 últimos. */
export function registrar(
  r: RegistroDaMeditacao,
  o: { hoje: string; minutos: number; humor?: string | null },
): RegistroDaMeditacao {
  return {
    dias: r.dias.includes(o.hoje) ? r.dias : [...r.dias, o.hoje].slice(-400),
    minutos: r.minutos + o.minutos,
    humores: o.humor ? [...r.humores, o.humor].slice(-30) : r.humores,
  };
}

/** A fala do balão na escolha: a sequência de dias, quando existe. */
export function falaDoBalao(r: RegistroDaMeditacao, hoje: Date = new Date()): string {
  const seq = sequenciaDeDatas(r.dias, hoje);
  if (seq <= 0) return "Alguns minutos só seus. Comece por onde der.";
  return `🔥 ${seq} ${seq === 1 ? "dia seguido" : "dias seguidos"}${r.minutos > 0 ? ` · ${r.minutos} min no total` : ""}`;
}

/**
 * O plano da sessão, com as mesmas sementes do site: a variação gira pelo
 * número de dias meditados (o mesmo tema em dias seguidos não repete a
 * leitura) e o silêncio embaralha pelos minutos acumulados.
 */
export function planoDaSessao(o: {
  minutos: number;
  tema: string;
  semanas: number | null;
  cuidado: boolean;
  densidade: Densidade;
  registro: RegistroDaMeditacao;
}): Plano {
  return planejarSessao({
    minutos: o.minutos,
    tema: o.tema,
    variacao: ((o.registro.dias.length % 3) + 1) as 1 | 2 | 3,
    /* No luto a fala de fase ("você está no terceiro trimestre") não entra. */
    semanas: o.cuidado ? null : o.semanas,
    densidade: o.densidade,
    careMode: o.cuidado,
    semente: o.registro.minutos,
  });
}

/** Encerrar pelo ✕ só guarda a sessão a partir de um minuto (o mesmo corte do site). */
export const CICLOS_DE_UM_MINUTO = Math.ceil(60 / CICLO);

/** Os minutos feitos de quem encerra no meio: nunca zero, nunca mais do que respirou. */
export function minutosAoEncerrar(ciclo: number): number {
  return Math.max(1, Math.round(((ciclo + 1) * CICLO) / 60));
}

/** O tempo que falta, ao lado da barra: "45s" no último minuto, senão "3m" (arredondado para baixo). */
export function formatarRestante(seg: number | null): string {
  if (seg == null) return "";
  if (seg <= 59) return `${Math.max(0, Math.round(seg))}s`;
  return `${Math.max(1, Math.floor(seg / 60))}m`;
}

/* ── O fechamento: "Como você está agora?" ─────────────────────────────── */

export const COMO_ESTOU = [
  { emoji: "😌", label: "Mais calma" },
  { emoji: "🥱", label: "Com sono" },
  { emoji: "💛", label: "Conectada" },
  { emoji: "😐", label: "Igual" },
  { emoji: "😟", label: "Ainda ansiosa" },
] as const;

/** No luto, "Conectada" (ao bebê) sai. */
export function comoEstouPara(cuidado: boolean) {
  return COMO_ESTOU.filter((c) => !cuidado || c.label !== "Conectada");
}

/**
 * O que ela lê depois de responder. O texto é o do site, com duas trocas do app
 * (21/10/2026, decisão do dono: o app não é conselho médico): "Ainda ansiosa"
 * mandava "levar isso pra consulta", e "Conectada" chamava o bebê de "ele".
 * A catraca do teste confere que o site ainda diz a frase trocada.
 */
export const FECHAMENTO_TROCADO_NO_APP: Readonly<Record<string, { site: string; app: string }>> = {
  Conectada: {
    site: "Esse instante também é cuidado com ele. Vocês dois sentiram.",
    app: "Esse instante também é cuidado com o bebê. Vocês dois sentiram.",
  },
  "Ainda ansiosa": {
    site: "Ansiedade que não passa em 5 minutos merece ser falada. Leve isso pra consulta.",
    app: "Tudo bem: tem dia em que a calma demora mais. Volte quando quiser.",
  },
};

export const FECHAMENTO: Record<string, string> = {
  "Mais calma": "É isso mesmo. Guarde esse ritmo pro resto do dia.",
  "Com sono": "Sono depois de meditar é o corpo aceitando descansar. Vá deitar.",
  Conectada: FECHAMENTO_TROCADO_NO_APP.Conectada!.app,
  Igual: "Nem toda sessão muda o dia — e mesmo assim ela contou. Volte amanhã.",
  "Ainda ansiosa": FECHAMENTO_TROCADO_NO_APP["Ainda ansiosa"]!.app,
};

/**
 * A última fala da sessão, dita depois que ela responde (a gravação `fe-*`).
 * As duas respostas trocadas ficam sem voz: a gravação do site diz a frase
 * antiga, e uma frase dita diferente da escrita seria pior que o silêncio.
 */
export const FALA_DO_FECHAMENTO: Record<string, string> = {
  "Mais calma": "fe-calma",
  "Com sono": "fe-sono",
  Igual: "fe-igual",
};

/** A escala do círculo e da bolha em cada fase (`ESCALA_RESPIRO` de `bolha.tsx`). */
export const ESCALA_RESPIRO = { inspire: 1.16, segure: 1.16, solte: 0.9 } as const;
