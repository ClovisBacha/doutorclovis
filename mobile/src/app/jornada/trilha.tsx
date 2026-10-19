import { useEffect } from "react";
import { Carregando, Tela } from "~/componentes/base";
import { voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { JornadaDaGestacao } from "~/app/(abas)/jornada";

/**
 * MINHA JORNADA — o Caminho inteiro (fases, semanas, um nó por dia, o Cantinho
 * espalhado), aberto por "Ver minha jornada" na tela Hoje. A aba virou o
 * cuidado do dia; a trilha continua a mesma, a um toque.
 *
 * Bancada: /jornada/trilha?bancada=1 (os mesmos parâmetros da aba)
 */
export default function Trilha() {
  const { dia, loja } = useJornada();
  const semTrilha = dia.modo !== "carregando" && (dia.modo !== "gestacao" || dia.cuidado);
  useEffect(() => {
    if (semTrilha) voltarParaJornada();
  }, [semTrilha]);
  if (dia.modo !== "gestacao" || dia.cuidado) {
    return (
      <Tela>
        <Carregando texto="Abrindo a sua jornada…" />
      </Tela>
    );
  }
  return <JornadaDaGestacao dia={dia} loja={loja} vista="trilha" />;
}
