/**
 * O mascote da jornada — a própria bolha do app, viva.
 *
 * Ela existe para resolver o buraco maior da gamificação: não havia
 * personagem. O Duolingo tem o Duo, o Candy Crush tem a Tiffi, e a Obstétrica
 * tinha um ursinho emoji que cada celular desenhava de um jeito. O símbolo já
 * estava em toda tela; faltava dar rosto a ele.
 *
 * A sensação de "aplicativo muito bem feito" que se atribui a elemento 3D não
 * vem de 3D. O Duolingo é vetor chapado; o Candy Crush usa 3D pré-renderizado e
 * achatado em sprite. Nenhum dos dois roda motor 3D no celular. O que produz a
 * sensação são três coisas que cabem em CSS, e estão todas aqui:
 *
 *  1. VOLUME ASSADO na arte — luz vindo sempre do mesmo lado
 *  2. MOLA no toque — afunda e volta ultrapassando o repouso
 *  3. PESO — a sombra encolhe e clareia quando ela sobe, espalha quando desce
 *
 * A terceira é a que o olho lê como massa. Objeto que flutua com sombra fixa
 * parece adesivo; sombra que responde à altura parece coisa.
 */

import { useEffect, useRef, useState } from "react";
import feliz from "@/assets/bolha/feliz.webp";
import comemorando from "@/assets/bolha/comemorando.webp";
import dormindo from "@/assets/bolha/dormindo.webp";
import preocupada from "@/assets/bolha/preocupada.webp";

export type Humor = "feliz" | "comemorando" | "dormindo" | "preocupada";

const ARTE: Record<Humor, string> = { feliz, comemorando, dormindo, preocupada };

/**
 * Que cara ela faz, a partir do estado da jornada.
 *
 * A ordem das perguntas é a prioridade emocional, e ela importa: comemorar
 * ganha de tudo, porque é o único instante que a paciente veio buscar. A cara
 * preocupada só aparece quando a sequência já morreu — nunca como cobrança de
 * quem está em dia, o que seria pressão num público que não precisa de mais.
 */
export function humorDaJornada(o: {
  comemorando?: boolean;
  diaFeito?: boolean;
  sequenciaPerdida?: boolean;
  noite?: boolean;
}): Humor {
  if (o.comemorando) return "comemorando";
  if (o.sequenciaPerdida) return "preocupada";
  if (o.noite && o.diaFeito) return "dormindo";
  return "feliz";
}

export function Bolha({
  humor = "feliz",
  tamanho = 64,
  flutua = true,
  className = "",
}: {
  humor?: Humor;
  tamanho?: number;
  flutua?: boolean;
  className?: string;
}) {
  const [apertada, setApertada] = useState(false);
  const solta = useRef<number | null>(null);

  useEffect(() => () => void (solta.current && clearTimeout(solta.current)), []);

  /** O toque só existe para dar retorno físico — quem navega é o pai. */
  function tocar() {
    setApertada(true);
    if (solta.current) clearTimeout(solta.current);
    solta.current = window.setTimeout(() => setApertada(false), 220);
  }

  return (
    <span
      className={`bolha-viva ${flutua ? "bolha-flutua" : ""} ${apertada ? "bolha-apertada" : ""} ${className}`}
      style={{ width: tamanho, height: tamanho }}
      onPointerDown={tocar}
      aria-hidden
    >
      {/* A sombra é irmã, não filha: precisa encolher enquanto o corpo estica,
          e uma sombra dentro do elemento herdaria a mesma deformação. */}
      <span className="bolha-sombra" />
      <img className="bolha-corpo" src={ARTE[humor]} alt="" draggable={false} />
    </span>
  );
}
