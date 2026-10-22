/**
 * O QUE CADA CARTÃO DE COMPARTILHAR DIZ — a conquista, o marco, a chama. Em
 * puro, para o teste cobrar o que vai para os Stories: o nome do bebê sem
 * artigo (o artigo supõe o sexo), a descrição da conquista que o app usa (e
 * não a do site, que cita telas que o app não tem), e nada íntimo.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

import { fruitEmojiForWeek } from "@/lib/gestacao";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { RARIDADES, type ConquistaDef } from "@/lib/conquistas";
import type { DadosDoCartaoDeConquista } from "~/componentes/jornada/cartao-de-conquista";
import { descricaoNoApp } from "~/lib/jornada/conquistas";
import type { Marco } from "~/lib/jornada/marcos";

export function cartaoDaConquista(def: ConquistaDef): DadosDoCartaoDeConquista {
  return {
    eyebrow: "Conquista desbloqueada",
    titulo: def.title,
    arte: def.emoji,
    detalhe: descricaoNoApp(def),
    selo: RARIDADES[def.raridade]?.label ?? null,
    fundo: "violeta",
  };
}

export function cartaoDoMarco(m: Marco, nomeDoBebe: string | null): DadosDoCartaoDeConquista {
  const quem = nomeDoBebe?.trim() || null;
  if (m.tipo === "semana") {
    const b = bebeDaSemana(m.semana);
    return {
      eyebrow: "Novo marco",
      titulo: `Semana ${m.semana}!`,
      arte: fruitEmojiForWeek(m.semana),
      /* O número e a unidade não se separam na quebra de linha ("30 cm"). */
      detalhe: `${quem ?? "O bebê"} tem o tamanho de ${b.fruit.toLowerCase()} · ${b.size.replace(" ", "\u00a0")}`,
      fundo: "aurora",
    };
  }
  if (m.tipo === "trimestre") {
    return {
      eyebrow: "Novo marco",
      titulo: `Fim do ${m.trimestre}º trimestre!`,
      arte: "🎊",
      detalhe: "Uma fase inteira cuidada, um dia de cada vez.",
      fundo: "aurora",
    };
  }
  if (m.tipo === "nascimento") {
    return {
      eyebrow: "Novo marco",
      titulo: `${quem ?? "O bebê"} chegou!`,
      arte: "🍼",
      detalhe: "A maior jornada que existe, completa.",
      fundo: "aurora",
    };
  }
  return {
    eyebrow: "Novo marco",
    titulo: `${quem ?? "O bebê"} com ${m.meses} ${m.meses === 1 ? "mês" : "meses"}!`,
    arte: "🎉",
    detalhe: "Mais um mês juntos. Cada dia conta.",
    fundo: "aurora",
  };
}

export function cartaoDaChama(dias: number, posParto: boolean): DadosDoCartaoDeConquista {
  return {
    eyebrow: "Minha chama",
    titulo: `${dias} ${dias === 1 ? "dia seguido" : "dias seguidos"}`,
    arte: "🔥",
    detalhe: posParto
      ? "Cuidando de nós no 4º trimestre, um dia de cada vez."
      : "Cuidando de nós, um dia de cada vez.",
    fundo: "chama",
  };
}

/** A chama só vira cartão a partir de 3 dias: um dia aceso ainda não é história. */
export const CHAMA_PARA_COMPARTILHAR = 3;
