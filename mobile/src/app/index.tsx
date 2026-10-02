import { Redirect } from "expo-router";
import { Carregando, NaoConsegueLer, Tela } from "~/componentes/base";
import { useSessao } from "~/lib/sessao";

/** A porta do app: decide para onde cada estado vai, num lugar só. */
export default function Porta() {
  const { sessao, carregandoSessao, perfil, estadoDoPerfil, recarregarPerfil } = useSessao();
  if (carregandoSessao) return <Carregando texto="Abrindo…" />;
  if (!sessao) return <Redirect href="/entrar" />;
  if (estadoDoPerfil === "carregando") return <Carregando texto="Abrindo…" />;
  if (estadoDoPerfil === "falhou")
    return (
      <Tela>
        <NaoConsegueLer
          sossego="Os seus dados continuam guardados. O SOS funciona sem internet pelo botão vermelho."
          aoTentar={() => void recarregarPerfil()}
        />
      </Tela>
    );
  /* Sem perfil, ou sem nenhuma âncora da gestação (e sem parto), o ritual
     de boas-vindas pede o que falta. */
  const temAncora = !!(perfil?.lmp_date || perfil?.reference_date || perfil?.birth_date);
  if (!perfil || !temAncora) return <Redirect href="/ritual" />;
  return <Redirect href="/inicio" />;
}
