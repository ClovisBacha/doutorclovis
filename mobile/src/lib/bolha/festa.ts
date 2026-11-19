/**
 * A BOLHA NA FESTA DOS MARCOS (19/11/2026) — o que a festa da semana nova, do
 * fim de um trimestre, do nascimento e de cada mês do bebê mostra e diz.
 *
 * O dono: "nosso principal personagem agora será o bebê bolha. Eu quero tirar
 * as imagens dos bebês [...] o número 24 ali estava muito bacana". A festa
 * mostrava o bebê ilustrado da semana (ou o recém-nascido enrolado) na frente
 * do número. Agora é a BOLHA que comemora na frente do número, e é ela que
 * fala: liga o marco ao que o app tem para ela (a aula nova da semana, um
 * tempo para respirar), sem conduta e sem prometer efeito.
 *
 * Função pura (testada pelo bun em `festa.test.ts`): a tela
 * (`componentes/jornada/marco.tsx`) só desenha. As regras são as da Bolha
 * guia (`conversa.ts`): nunca conduta, o bebê sem gênero, sem travessão nem
 * emoji, e a fala certa para o marco, nunca sorteada (a variação sai da
 * semana, e é a mesma em todo aparelho).
 */

import { bebeDaSemana } from "~/lib/bebe-da-semana";
import type { PoseDaBolha } from "~/lib/bolha/conversa";
import type { Marco } from "~/lib/jornada/marcos";

export type FestaDaBolha = {
  /** O número gigante atrás da Bolha: a semana, a última do trimestre, os meses. */
  numero: number | null;
  pose: Extract<PoseDaBolha, "comemorando" | "orgulhosa" | "apaixonado" | "feliz">;
  sobrelinha: string;
  titulo: string;
  /** Um dado da semana (o tamanho), quando há. */
  dado: string | null;
  /** O que a Bolha diz. */
  fala: string;
};

/** As falas da semana nova: a semana escolhe (a 24 diz sempre a mesma). */
const FALAS_DA_SEMANA = [
  "Semana nova, aulas novas: sete, uma por dia. Eu vou junto em cada uma.",
  "Mais uma semana de vocês dois. Esta tem aula nova todo dia e um tempo para respirar comigo.",
  "Cuidar de você é cuidar de vocês dois. E esta semana começa com aula nova.",
] as const;

const ORDINAL = { 2: "segundo", 3: "terceiro" } as const;

export function festaDaBolha(m: Marco, nomeDoBebe: string | null): FestaDaBolha {
  const quem = nomeDoBebe?.trim() || null;
  switch (m.tipo) {
    case "semana": {
      const b = bebeDaSemana(m.semana);
      return {
        numero: m.semana,
        pose: "comemorando",
        sobrelinha: "Novo marco",
        titulo: `Semana ${m.semana}`,
        /* O número e a unidade não se separam na quebra de linha ("30 cm"). */
        dado: `Do tamanho de ${b.fruit.toLowerCase()} · ${b.size.replace(" ", "\u00a0")}`,
        fala: FALAS_DA_SEMANA[m.semana % FALAS_DA_SEMANA.length]!,
      };
    }
    case "trimestre":
      return {
        numero: m.trimestre === 1 ? 13 : 27,
        pose: "orgulhosa",
        sobrelinha: "Novo marco",
        titulo: `Fim do ${m.trimestre}º trimestre`,
        dado: null,
        fala: `Um trimestre inteiro de aulas e de tempo para você. Agora começa o ${ORDINAL[(m.trimestre + 1) as 2 | 3]}, e eu sigo junto.`,
      };
    case "nascimento":
      return {
        numero: null,
        pose: "apaixonado",
        sobrelinha: "Novo marco",
        titulo: "Boas-vindas ao mundo",
        dado: null,
        fala: `${quem ?? "O bebê"} chegou, e eu fiquei apaixonada. Agora eu sigo com vocês dois.`,
      };
    case "mes":
      return {
        numero: m.meses,
        pose: "feliz",
        sobrelinha: "Novo marco",
        titulo: `${quem ?? "O bebê"} com ${m.meses} ${m.meses === 1 ? "mês" : "meses"}`,
        dado: null,
        fala: `${m.meses === 1 ? "Um mês inteiro" : "Mais um mês"} de colo e de descobertas. Que bom acompanhar vocês dois.`,
      };
  }
}
