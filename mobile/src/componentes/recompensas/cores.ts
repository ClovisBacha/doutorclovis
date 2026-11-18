import type { Raridade } from "@/lib/conquistas";
import { amanhecer, cor } from "~/tema";

/**
 * As cores das RECOMPENSAS (Meu Cantinho e Conquistas) — rebatidas no tema
 * (18/11/2026, a vistoria). Antes era uma paleta inteira tirada do site, no
 * Tailwind dele: verde-lima, menta, âmbar de alerta, azul-céu, rosé-barro e a
 * sombra marrom. Numa rolagem só apareciam seis famílias de cor que não eram
 * do Amanhecer, e o olho não sabia onde tocar.
 *
 * Agora: a sementinha é UM verde (`cor.sementinha` sobre `sementinhaFundo`),
 * agir é framboesa (`cor.primaria`), superfície é o `Cartao` do tema, texto é
 * `cor.texto`/`textoApagado`. Cor nova entra no tema, nunca aqui.
 */

/**
 * A RARIDADE de uma conquista: a cor do anel da medalha, o fundo dela e a
 * tinta do rótulo ("Raro · 40"). Comum é cinza e quieta (como o dono pediu:
 * a maioria não pode brilhar), rara é o violeta do jogo, e a épica ganha o
 * anel no degradê do amanhecer.
 */
export const corDaRaridade: Record<
  Raridade,
  {
    anel: readonly [string, string, ...string[]];
    fundo: string;
    tinta: string;
    rotuloFundo: string;
  }
> = {
  comum: {
    anel: [cor.chevron, cor.chevron],
    fundo: cor.apagado,
    tinta: cor.textoApagado,
    rotuloFundo: cor.apagado,
  },
  raro: {
    anel: [cor.jogo, cor.jogo],
    fundo: cor.jogoFundo,
    tinta: cor.jogo,
    rotuloFundo: cor.jogoFundo,
  },
  epico: {
    anel: amanhecer,
    fundo: cor.destaque,
    tinta: cor.textoDestaque,
    rotuloFundo: cor.destaque,
  },
};
