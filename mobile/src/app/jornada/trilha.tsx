import { useEffect } from "react";
import { Carregando, Tela } from "~/componentes/base";
import { voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { JornadaDaGestacao, JornadaDoPosParto } from "~/app/(abas)/jornada";

/**
 * MINHA JORNADA — o Caminho inteiro (fases, semanas, um nó por dia, o Cantinho
 * espalhado), aberto por "Ver minha jornada" na tela Hoje. A aba virou o
 * cuidado do dia; a trilha continua a mesma, a um toque. Depois do parto, a
 * trilha das 12 semanas de vida (o 4º trimestre).
 *
 * Bancada: /jornada/trilha?bancada=1 (os mesmos parâmetros da aba) [&pos=1&idade=20]
 */
export default function Trilha() {
  const { dia, loja } = useJornada();
  const temTrilha = (dia.modo === "gestacao" || dia.modo === "pos") && !dia.cuidado;
  const semTrilha = dia.modo !== "carregando" && !temTrilha;
  useEffect(() => {
    if (semTrilha) voltarParaJornada();
  }, [semTrilha]);
  if (dia.modo === "pos" && !dia.cuidado)
    return <JornadaDoPosParto dia={dia} loja={loja} vista="trilha" />;
  if (dia.modo !== "gestacao" || dia.cuidado) {
    return (
      <Tela>
        <Carregando texto="Abrindo a sua jornada…" />
      </Tela>
    );
  }
  return <JornadaDaGestacao dia={dia} loja={loja} vista="trilha" />;
}
