import { Redirect } from "expo-router";
import { NaoConsegueLer, Tela } from "~/componentes/base";
import { BotaoDoPerfil } from "~/componentes/botao-do-perfil";
import { TelaDoCuidado } from "~/componentes/jornada/cuidado";
import { SOS_NO_APP } from "~/config";
import { useSessao } from "~/lib/sessao";

/**
 * O "INÍCIO" — só existe no Modo Cuidado, e é a mesma tela do luto do "Hoje"
 * (`TelaDoCuidado`, 18/11/2026): o acolhimento com os números de ajuda, o que
 * fazer hoje e a agenda, numa tela só. Antes o Início e o Hoje se sobrepunham,
 * cada um com o seu texto de socorro, e o atalho daqui só levava de volta para
 * lá. A semana do bebê, o recém-nascido e os atalhos que moravam aqui saíram:
 * esta tela só abre no luto, então eles nunca eram vistos.
 */
export default function Inicio() {
  const { sessao, cuidado, estadoDoPerfil, recarregarPerfil } = useSessao();

  /* Fora do Modo Cuidado, o bebê, a semana e a agenda moram na aba do meio
     (decisão do dono, 13/11/2026), e esta aba sai da barra: quem chegar aqui
     por um "voltar" vai para lá. (`cuidado` é verdade enquanto o perfil
     carrega — o app falha fechado —, então ninguém em luto é desviado.) */
  if (!cuidado) return <Redirect href="/jornada" />;

  if (estadoDoPerfil === "falhou")
    return (
      <Tela>
        <NaoConsegueLer
          sossego={
            SOS_NO_APP
              ? "O SOS funciona sem internet pelo botão vermelho."
              : "Os seus dados continuam guardados."
          }
          aoTentar={() => void recarregarPerfil()}
        />
      </Tela>
    );

  return <TelaDoCuidado uid={sessao?.user.id ?? null} direita={<BotaoDoPerfil />} />;
}
