import { cartaDoDia, poolDeHoje, type Carta } from "@/lib/cartas-do-bebe";
import { D_MINIMO, semanaDoDia } from "~/lib/jornada/dia";

/**
 * A CARTA DO DIA SEM REPETIR DE UM DIA PARA O OUTRO.
 *
 * A régua do site (`cartaDoDia`) gira `dia % n` dentro do poço da fase. Na
 * troca de fase o poço muda, e a mesma carta pode cair em dois dias seguidos —
 * medido em 15/10/2026: dias 195 e 196 (semanas 27→28), "Pra você, que eu
 * ainda não vi". Quem abre o vínculo todo dia lia a mesma carta duas vezes.
 *
 * Aqui, SÓ no dia da colisão, entra outra carta do mesmo poço — diferente da
 * de ontem e da de amanhã. Todos os outros dias são os mesmos da régua do
 * site. A colisão só acontece na troca de fase (dentro de uma fase, dois dias
 * seguidos caem em posições vizinhas do poço), e uma fase dura semanas — então
 * ontem e amanhã nunca são, eles próprios, dias de colisão.
 *
 * Sem react-native aqui: é testado pelo bun.
 */
export function cartaDoDiaNoApp(o: {
  dia: number;
  semanas?: number | null;
  posParto?: boolean;
}): Carta {
  /* A semana de cada dia, como o app a calcula: na gestação, a do próprio
     dia; no pós-parto, a régua não usa semana. */
  const em = (dia: number) => ({
    dia,
    semanas: o.posParto ? (o.semanas ?? null) : semanaDoDia(dia),
    posParto: o.posParto,
  });
  const hoje = cartaDoDia(em(o.dia));
  if (o.dia <= D_MINIMO) return hoje;
  const ontem = cartaDoDia(em(o.dia - 1));
  if (hoje.id !== ontem.id) return hoje;

  const amanha = cartaDoDia(em(o.dia + 1));
  const pool = poolDeHoje(em(o.dia));
  const n = pool.length;
  const base = Math.abs(Math.floor(o.dia));
  for (let passo = 1; passo < n; passo++) {
    for (const k of [-passo, passo]) {
      const c = pool[(((base + k) % n) + n) % n];
      if (c.id !== ontem.id && c.id !== amanha.id) return c;
    }
  }
  return hoje;
}
