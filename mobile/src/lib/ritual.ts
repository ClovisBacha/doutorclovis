import type { PoseDaBolha } from "~/lib/bolha/conversa";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { diaDaJornada, semanaDoDia } from "~/lib/jornada/dia";
import type { Perfil } from "~/lib/sessao";

/**
 * AS REGRAS DO RITUAL de boas-vindas (`app/ritual.tsx`), em puro: que passos
 * ela vê, o que a Bolha diz em cada um, e quando o fim do ritual revela a
 * semana.
 *
 * Os passos são numerados como sempre foram (0 o nome, 1 a data, 2 o bebê,
 * 3 o contato, 4 o médico, 5 a amiga), e a ordem vista pula os que não valem.
 */
export const PASSO_DO_CONTATO = 3;
export const PASSO_DO_MEDICO = 4;
export const PASSO_DA_AMIGA = 5;

/**
 * Os passos na ordem em que ela os vê. Com o SOS desligado (`SOS_NO_APP`),
 * o contato de emergência e o médico saem do ritual: eram dados do SOS, e
 * pedi-los no meio da entrada de um jogo assustava sem servir para nada. O
 * médico continua em "Seus dados", no Perfil.
 */
export function ordemDoRitual(total: number, sosNoApp: boolean): number[] {
  return Array.from({ length: total }, (_, i) => i).filter(
    (p) => sosNoApp || (p !== PASSO_DO_CONTATO && p !== PASSO_DO_MEDICO),
  );
}

export type ModoDaData = "dum" | "us" | "nasceu";

/**
 * A REVELAÇÃO (18/11/2026; desde 19/11 sem o bebê ilustrado): no fim do
 * PRIMEIRO ritual, a Bolha comemora na frente do número da semana dela antes
 * da primeira aba. Nunca corrigindo a data (`?editar=1`), nunca depois do
 * parto (a semana não é mais verdade), e nunca no Modo Cuidado (o app não
 * fala da gestação).
 */
export function revelaASemana(o: { editar: boolean; modo: ModoDaData; cuidado: boolean }): boolean {
  return !o.editar && o.modo !== "nasceu" && !o.cuidado;
}

/**
 * A semana que a revelação mostra: a mesma régua da trilha (o dia da jornada
 * preso de 7 a 300, a semana de 1 a 42), a partir do que ela acabou de
 * digitar. `null` quando não há o que revelar.
 */
export function semanaDaRevelacao(
  o: { modo: ModoDaData; ymd: string | null; semanasUs?: number; diasUs?: number },
  hoje = new Date(),
): number | null {
  if (o.modo === "nasceu" || !o.ymd) return null;
  const perfil: Perfil =
    o.modo === "dum"
      ? { id: "", lmp_date: o.ymd }
      : {
          id: "",
          reference_date: o.ymd,
          reference_weeks: o.semanasUs ?? null,
          reference_days: o.diasUs ?? 0,
        };
  const g = gestacaoDoPerfil(perfil, hoje);
  if (!g) return null;
  return semanaDoDia(diaDaJornada(g.totalDays));
}

/* ── A Bolha conduz o ritual (19/11/2026) ─────────────────────────────── */

/**
 * O dono: "o bebê bolha vai ser aquele personagem que vai conversar com a
 * mãe". No ritual, cada pergunta chega como fala da Bolha, e a resposta do
 * passo anterior aparece do lado dela, como numa conversa.
 *
 * As regras das falas (a catraca está em `ritual.test.ts`): nunca conduta,
 * o bebê sem gênero, sem travessão nem emoji, e o nome dela só o primeiro.
 */
export type ContextoDoRitual = {
  passo: number;
  /** Corrigindo a data (`?editar=1`): sem boas-vindas, direto ao ponto. */
  editar: boolean;
  modo: ModoDaData;
  /** O que ela digitou até aqui, cru. */
  nome: string;
  data: string;
  semanasUs: string;
  diasUs: string;
  bebe: string;
  /** O passo que veio antes deste na ordem vista (`null` no primeiro). */
  anterior: number | null;
};

export type FalaDoRitual = {
  /** O que a Bolha diz (a pergunta do passo). */
  texto: string;
  pose: PoseDaBolha;
  /** A resposta dela no passo anterior, do lado dela (`null`: nenhuma). */
  dela: string | null;
};

const primeiroNome = (s: string) => s.trim().split(/\s+/)[0] || null;

/** "30/05/2026": a data inteira, como a máscara a escreve. */
const dataCompleta = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s.trim());

/** A resposta do passo da data, como ela diria: "Última menstruação em 30/05/2026". */
export function resumoDaData(c: Pick<ContextoDoRitual, "modo" | "data" | "semanasUs" | "diasUs">) {
  if (!dataCompleta(c.data)) return null;
  const data = c.data.trim();
  if (c.modo === "nasceu") return `Nasceu em ${data}`;
  if (c.modo === "dum") return `Última menstruação em ${data}`;
  const s = Number(c.semanasUs);
  const d = Number(c.diasUs || 0);
  if (!Number.isInteger(s) || s <= 0) return `Ultrassom em ${data}`;
  const dias = d > 0 ? ` e ${d} ${d === 1 ? "dia" : "dias"}` : "";
  return `Ultrassom em ${data}, com ${s} semanas${dias}`;
}

/** A resposta que um passo deixa (o que aparece do lado dela no passo seguinte). */
function respostaDoPasso(passo: number | null, c: ContextoDoRitual): string | null {
  switch (passo) {
    case 0:
      return c.nome.trim() || null;
    case 1:
      return resumoDaData(c);
    case 2:
      return c.bebe.trim() || null;
    default:
      return null;
  }
}

/** O que a Bolha diz em cada passo do ritual. */
export function falaDoRitual(c: ContextoDoRitual): FalaDoRitual {
  const dela = c.editar && c.passo === 1 ? null : respostaDoPasso(c.anterior, c);
  const nome = primeiroNome(c.nome);
  switch (c.passo) {
    case 0:
      return {
        texto: "Que bom ter você aqui! Para começar, como você quer que eu te chame?",
        pose: "feliz",
        dela: null,
      };
    case 1:
      return {
        texto: c.editar
          ? "Vamos acertar a data. Em que fase você está?"
          : nome
            ? `Prazer, ${nome}! Agora me conta: em que fase você está?`
            : "Prazer! Agora me conta: em que fase você está?",
        pose: "estudiosa",
        dela,
      };
    case 2:
      return {
        texto:
          c.modo === "nasceu"
            ? "Anotado. E como se chama o bebê?"
            : "Anotado. E o bebê, já tem nome? Se ainda não decidiram, pode pular.",
        pose: "apaixonado",
        dela,
      };
    case PASSO_DO_CONTATO:
      return {
        texto:
          "Quem avisar numa emergência? No SOS, o app liga para o 192 e manda a sua localização para esta pessoa, mesmo sem internet, por SMS.",
        pose: "feliz",
        dela,
      };
    case PASSO_DO_MEDICO:
      return { texto: "Quem acompanha a sua gestação?", pose: "feliz", dela };
    default: {
      /* A amiga: o último passo do primeiro ritual. */
      const nomeDoBebe = c.anterior === 2 ? c.bebe.trim() : "";
      return {
        texto: `${nomeDoBebe ? `${nomeDoBebe}, que nome bonito! ` : ""}Última pergunta: alguma amiga te chamou para o app?`,
        pose: "comemorando",
        dela,
      };
    }
  }
}

/**
 * A FALA DA REVELAÇÃO: a Bolha dá as boas-vindas ao cuidado diário, na frente
 * do número da semana. Sem promessa de efeito: o app convida, não prescreve.
 */
export function falaDaRevelacao(semana: number, nome?: string | null): string {
  const primeiro = nome ? primeiroNome(nome) : null;
  return `${primeiro ? `${primeiro}, você` : "Você"} está na semana ${semana}. A partir de hoje, cuidar de você faz parte do dia, e eu vou junto.`;
}
