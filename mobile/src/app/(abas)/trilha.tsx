import { Redirect } from "expo-router";
import { Carregando, NaoConsegueLer, T, Tela } from "~/componentes/base";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { JornadaDaGestacao, JornadaDoPosParto } from "~/app/(abas)/jornada";

/**
 * A ABA DA TRILHA — o jogo, à direita da barra (decisão do dono, 13/11/2026:
 * "o bebê é o centro [...] o jogo deve ficar na direita"). A trilha inteira,
 * como no Duolingo: fases, semanas, um nó por dia, o Cantinho espalhado e o
 * placar no topo (com a foto dela, que abre o Perfil). Depois do parto, a
 * trilha das 12 semanas de vida.
 *
 * A abertura do dia (a festa dos marcos, a reconciliação, os avisos) roda na
 * tela do bebê, que abre o app — não aqui, para não festejar duas vezes.
 *
 * No Modo Cuidado e sem a data da gestação não há trilha: a aba some da
 * barra, e quem chegar aqui por um link volta para a aba do meio.
 *
 * Bancada: /trilha?bancada=1 (os mesmos parâmetros da tela do bebê) [&pos=1&idade=20]
 */
export default function AbaDaTrilha() {
  const { dia, loja } = useJornada();
  if (dia.modo === "carregando")
    return (
      <Tela>
        <Carregando texto="Abrindo a sua trilha…" />
      </Tela>
    );
  if (dia.modo === "falhou")
    return (
      <Tela>
        <T tipo="titulo">Sua trilha</T>
        <NaoConsegueLer
          sossego="Tudo o que você já fez na trilha continua guardado."
          aoTentar={dia.tentar}
        />
      </Tela>
    );
  if (dia.cuidado || dia.modo === "sem-data") return <Redirect href="/jornada" />;
  if (dia.modo === "pos") return <JornadaDoPosParto dia={dia} loja={loja} vista="aba" />;
  return <JornadaDaGestacao dia={dia} loja={loja} vista="aba" />;
}
