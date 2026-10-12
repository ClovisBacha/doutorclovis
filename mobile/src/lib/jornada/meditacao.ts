/**
 * OS TEMAS DA MEDITAÇÃO DO DIA e o plano da sessão.
 *
 * Os temas são os mesmos do site (MEDITACOES em gestacao-path.tsx), com a
 * mesma decisão de luto: só passa quem foi marcado `noLuto`. As falas vêm de
 * `planejarSessao` (`@/lib/meditacao-sessao`), que também limpa, fala a fala,
 * o que citaria o bebê no Modo Cuidado.
 * Sem react-native aqui: é testado pelo bun.
 */

import { planejarSessao, type Plano } from "@/lib/meditacao-sessao";

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

/** Durações da atividade do dia. O mínimo que conta é um minuto. */
export const DURACOES_MEDITAR = [1, 2, 5] as const;
export type DuracaoMeditar = (typeof DURACOES_MEDITAR)[number];

export function planoDoDia(o: {
  minutos: DuracaoMeditar;
  tema: string;
  semanas: number | null;
  cuidado: boolean;
  D: number;
}): Plano {
  return planejarSessao({
    minutos: o.minutos,
    tema: o.tema,
    /* A variação gira pelo dia: o mesmo tema em dias seguidos não repete a leitura. */
    variacao: ((((o.D % 3) + 3) % 3) + 1) as 1 | 2 | 3,
    /* No luto a fala de fase ("você está no terceiro trimestre") não entra. */
    semanas: o.cuidado ? null : o.semanas,
    densidade: "guiada",
    careMode: o.cuidado,
    semente: o.D,
  });
}
