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
import { TEXTO_REGRAVADO } from "~/lib/audio/regravadas-texto";

export type TemaDeMeditacao = {
  tema: string;
  precisa: string;
  emoji: string;
  /** Oferecido no Modo Cuidado. O padrão é não. */
  noLuto?: boolean;
  /** Fala da gestação (o bebê dentro, o parto que vem): fora do pós-parto. */
  soGestacao?: boolean;
};

/**
 * "Quero sentir o bebê" lia-se como sentir mexer — e o que ela sente das
 * mexidinhas fica fora do app (quem sente pouco lê ali um sinal; sinal mora no
 * SOS). A catraca do teste confere que o site ainda diz o texto trocado.
 */
export const PRECISA_NO_APP: Readonly<Record<string, { site: string; app: string }>> = {
  "Conexão com o bebê": { site: "Quero sentir o bebê", app: "Quero um momento com o bebê" },
};

export const TEMAS_DE_MEDITACAO: readonly TemaDeMeditacao[] = [
  { tema: "Só respirar", precisa: "Quero só respirar", emoji: "🌬️", noLuto: true },
  { tema: "Calma", precisa: "Estou tensa", emoji: "🌊", noLuto: true },
  {
    tema: "Conexão com o bebê",
    precisa: PRECISA_NO_APP["Conexão com o bebê"]!.app,
    emoji: "💛",
    soGestacao: true,
  },
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
  /** O bebê já nasceu: sai o que fala dele "aqui dentro" e da gestação. */
  posParto?: boolean;
  densidade: Densidade;
  registro: RegistroDaMeditacao;
  /** As falas regravadas (texto novo por `id`); o padrão é o mapa gerado. */
  regravadas?: Readonly<Record<string, string>>;
}): Plano {
  const regravadas = o.regravadas ?? TEXTO_REGRAVADO;
  const plano = planejarSessao({
    minutos: o.minutos,
    tema: o.tema,
    variacao: ((o.registro.dias.length % 3) + 1) as 1 | 2 | 3,
    /* No luto a fala de fase ("você está no terceiro trimestre") não entra. */
    semanas: o.cuidado ? null : o.semanas,
    densidade: o.densidade,
    careMode: o.cuidado,
    semente: o.registro.minutos,
  });
  /* A fala regravada volta com o texto novo — e a voz nova, que a tela toca
     de `VOZ_REGRAVADA`. As réguas do luto e do pós-parto olham o texto que ela
     vai ouvir, e não o antigo. */
  const fica = (id: string, texto: string) => {
    const regravada = regravadas[id] != null;
    return (
      (regravada || !FALAS_FORA_DO_APP.has(id)) &&
      !(o.cuidado && FORA_DO_LUTO.test(texto)) &&
      !(o.posParto && (FORA_DO_POS.test(texto) || (!regravada && FALAS_FORA_DO_POS.has(id))))
    );
  };
  const deixas = plano.deixas
    .map((d) => {
      const texto = regravadas[d.fala.id];
      return texto ? { ...d, fala: { ...d.fala, texto } } : d;
    })
    .filter((d) => fica(d.fala.id, d.fala.texto));
  return { ...plano, deixas };
}

/**
 * ⚠️ AS FALAS QUE O APP NÃO DIZ (21/10/2026: o app não é conselho médico).
 *
 * As falas da meditação têm voz gravada pelo `id`: trocar o texto deixaria a
 * voz dizendo a frase antiga. Então a fala que foge das regras SAI do plano, e
 * aquele ciclo fica em silêncio — a meditação já é feita de silêncio.
 *
 * - Em qualquer fase: "Se você tiver dúvida, ela cabe na consulta", "é normal
 *   que seja", "Acordar de madrugada não é sinal de nada", "Não precisa sentir
 *   para ser verdade", o bebê "neste mesmo lugar seguro que você" (tranquilizar
 *   sobre o corpo ou o bebê é régua), a respiração "que mais ajuda" no parto e
 *   "a porta do consultório".
 * - No Modo Cuidado, a régua do site (`careMode`) não pega "gestação" nem
 *   "grávida": "Cansaço na gestação não é fraqueza" e "Dormir grávida é uma
 *   negociação" chegavam a quem perdeu o bebê.
 * - No pós-parto, o mesmo, mais o bebê "aqui dentro" e "o coração está batendo
 *   por dois", que já não são verdade.
 *
 * O "ele" para o bebê nas falas gravadas do tema "Conexão com o bebê" fica até
 * a regravação: tirar dez falas do tema o esvaziaria.
 *
 * A REGRAVAÇÃO (`docs/regravacao`) devolve cada uma, com texto e voz novos: a
 * fala que está em `TEXTO_REGRAVADO` volta ao plano mesmo estando aqui.
 */
export const FALAS_FORA_DO_APP: ReadonlySet<string> = new Set([
  "fase-1b",
  "fase-3a",
  "calma-3-4",
  "sono-2-5",
  "coragem-1-5",
  "coragem-2-4",
  "coragem-3-3",
  "prog-6-4",
]);

const FORA_DO_LUTO = /gesta|grávid|gravidez|recém-nascid/i;
const FORA_DO_POS = /aqui dentro|gesta|grávid|gravidez|recém-nascid/i;
const FALAS_FORA_DO_POS: ReadonlySet<string> = new Set(["gratidao-2-2"]);

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
 * O que ela lê depois de responder. O texto é o do site, com três trocas do app
 * (21/10/2026, decisão do dono: o app não é conselho médico): "Ainda ansiosa"
 * mandava "levar isso pra consulta", "Conectada" chamava o bebê de "ele", e
 * "Com sono" mandava dormir ("Vá deitar").
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
  "Com sono": {
    site: "Sono depois de meditar é o corpo aceitando descansar. Vá deitar.",
    app: "Sono depois de meditar é o corpo pedindo descanso. Se der, aproveite.",
  },
};

export const FECHAMENTO: Record<string, string> = {
  "Mais calma": "É isso mesmo. Guarde esse ritmo pro resto do dia.",
  "Com sono": FECHAMENTO_TROCADO_NO_APP["Com sono"]!.app,
  Conectada: FECHAMENTO_TROCADO_NO_APP.Conectada!.app,
  Igual: "Nem toda sessão muda o dia — e mesmo assim ela contou. Volte amanhã.",
  "Ainda ansiosa": FECHAMENTO_TROCADO_NO_APP["Ainda ansiosa"]!.app,
};

/**
 * A última fala da sessão, dita depois que ela responde (a gravação `fe-*`).
 * As respostas trocadas ficam sem voz: a gravação do site diz a frase antiga,
 * e uma frase dita diferente da escrita seria pior que o silêncio.
 */
export const FALA_DO_FECHAMENTO: Record<string, string> = {
  "Mais calma": "fe-calma",
  Igual: "fe-igual",
};

/** A regravação de cada resposta trocada (`docs/regravacao`). "Ainda ansiosa" o site gravou e nunca tocou. */
const FECHAMENTO_REGRAVADO: Readonly<Record<string, string>> = {
  "Com sono": "fe-sono",
  Conectada: "fe-conectada",
  "Ainda ansiosa": "fe-ansiosa",
};

/**
 * A gravação que fecha a sessão para a resposta dela: a regravada da trocada,
 * se ela existe e diz o que a tela escreve, ou a do site; `null` = sem voz.
 */
export function falaDoFechamento(
  rotulo: string,
  regravadas: Readonly<Record<string, string>> = TEXTO_REGRAVADO,
): string | null {
  const nova = FECHAMENTO_REGRAVADO[rotulo];
  if (nova && regravadas[nova] === FECHAMENTO[rotulo]) return nova;
  return FALA_DO_FECHAMENTO[rotulo] ?? null;
}

/** A escala do círculo e da bolha em cada fase (`ESCALA_RESPIRO` de `bolha.tsx`). */
export const ESCALA_RESPIRO = { inspire: 1.16, segure: 1.16, solte: 0.9 } as const;
