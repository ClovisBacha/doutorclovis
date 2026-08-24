/**
 * Peles das bolinhas do Caminho.
 *
 * Cada pele tem TRÊS estados, e é isso que a torna diferente de um enfeite:
 * ela não decora a trilha, ela CONTA a trilha. O mesmo objeto aparece
 * adormecido no dia que ainda não chegou, desperto no dia de hoje e florido no
 * dia cumprido — então a paciente lê o próprio progresso na forma, não só na
 * cor. É a razão de a pele ser um item de loja e não um tema de cor.
 *
 * ─── Como acrescentar as próximas ──────────────────────────────────────
 *
 * O trabalho é mecânico e está documentado porque as outras sete artes ainda
 * não existem (ver `docs/prompts-skins.md`):
 *
 *   1. gere a folha com os três estados lado a lado, em fundo branco;
 *   2. `node skin.mjs <nome>` fatia em terços, recorta o fundo por
 *      preenchimento a partir da borda e grava três `.webp` de 192px;
 *   3. copie para `src/assets/skins/` e acrescente uma entrada aqui;
 *   4. acrescente o item correspondente em `CANTINHO_ITEMS` com
 *      `type: "trilha"` e o mesmo `id`.
 *
 * O passo 4 é o que faz a pele aparecer na loja. Sem ele ela existe no código
 * e não existe para a paciente — que é justamente o estado em que as sete
 * ficam até a arte chegar, de propósito: melhor faltar na loja do que aparecer
 * lá sem imagem.
 */
import jardimFuturo from "@/assets/skins/jardim-futuro.webp";
import jardimAtual from "@/assets/skins/jardim-atual.webp";
import jardimFeito from "@/assets/skins/jardim-feito.webp";
import lotusFuturo from "@/assets/skins/lotus-futuro.webp";
import lotusAtual from "@/assets/skins/lotus-atual.webp";
import lotusFeito from "@/assets/skins/lotus-feito.webp";
import origamiFuturo from "@/assets/skins/origami-futuro.webp";
import origamiAtual from "@/assets/skins/origami-atual.webp";
import origamiFeito from "@/assets/skins/origami-feito.webp";
import perolasFuturo from "@/assets/skins/perolas-futuro.webp";
import perolasAtual from "@/assets/skins/perolas-atual.webp";
import perolasFeito from "@/assets/skins/perolas-feito.webp";
import constelacaoFuturo from "@/assets/skins/constelacao-futuro.webp";
import constelacaoAtual from "@/assets/skins/constelacao-atual.webp";
import constelacaoFeito from "@/assets/skins/constelacao-feito.webp";
import cristaisFuturo from "@/assets/skins/cristais-futuro.webp";
import cristaisAtual from "@/assets/skins/cristais-atual.webp";
import cristaisFeito from "@/assets/skins/cristais-feito.webp";
import planetasFuturo from "@/assets/skins/planetas-futuro.webp";
import planetasAtual from "@/assets/skins/planetas-atual.webp";
import planetasFeito from "@/assets/skins/planetas-feito.webp";
import coracaoFuturo from "@/assets/skins/coracao-futuro.webp";
import coracaoAtual from "@/assets/skins/coracao-atual.webp";
import coracaoFeito from "@/assets/skins/coracao-feito.webp";

export type EstadoNo = "futuro" | "atual" | "feito";

export type TrilhaSkin = {
  id: string;
  nome: string;
  /** As três artes, na ordem em que a jornada acontece. */
  arte: Record<EstadoNo, string>;
};

export const TRILHA_SKINS: Record<string, TrilhaSkin> = {
  "trilha-jardim": {
    id: "trilha-jardim",
    nome: "Jardim",
    arte: { futuro: jardimFuturo, atual: jardimAtual, feito: jardimFeito },
  },
  "trilha-lotus": {
    id: "trilha-lotus",
    nome: "Lótus",
    arte: { futuro: lotusFuturo, atual: lotusAtual, feito: lotusFeito },
  },
  "trilha-origami": {
    id: "trilha-origami",
    nome: "Origami",
    arte: { futuro: origamiFuturo, atual: origamiAtual, feito: origamiFeito },
  },
  "trilha-perolas": {
    id: "trilha-perolas",
    nome: "Pérolas",
    arte: { futuro: perolasFuturo, atual: perolasAtual, feito: perolasFeito },
  },
  "trilha-constelacao": {
    id: "trilha-constelacao",
    nome: "Constelação",
    arte: { futuro: constelacaoFuturo, atual: constelacaoAtual, feito: constelacaoFeito },
  },
  "trilha-cristais": {
    id: "trilha-cristais",
    nome: "Cristais",
    arte: { futuro: cristaisFuturo, atual: cristaisAtual, feito: cristaisFeito },
  },
  "trilha-planetas": {
    id: "trilha-planetas",
    nome: "Planetas",
    arte: { futuro: planetasFuturo, atual: planetasAtual, feito: planetasFeito },
  },
  "trilha-coracao": {
    id: "trilha-coracao",
    nome: "Coração",
    arte: { futuro: coracaoFuturo, atual: coracaoAtual, feito: coracaoFeito },
  },
};

/** Chave no `journey_state` — sincroniza entre aparelhos junto com a jornada. */
export const SKIN_KEY = "dc-path-skin";

/**
 * Qual estado a bolinha de um dia mostra.
 *
 * "Hoje ainda não feito" é o único estado ATUAL — e é só um por trilha, o que
 * é proposital: o dia de hoje precisa ser achável de relance numa tela que
 * rola por 294 dias.
 */
export function estadoDoNo(feito: boolean, hoje: boolean): EstadoNo {
  if (feito) return "feito";
  return hoje ? "atual" : "futuro";
}
