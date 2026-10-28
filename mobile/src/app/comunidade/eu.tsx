import { Redirect } from "expo-router";

/**
 * O antigo "Meu perfil" da Comunidade. Na fase 3 o Perfil virou um só
 * (`/perfil`, com "Editar perfil" em `/perfil/editar`): um link antigo ou
 * guardado cai lá.
 */
export default function MeuPerfilAntigo() {
  return <Redirect href="/perfil" />;
}
