import { Redirect } from "expo-router";
import { rota } from "~/componentes/jornada/bancada";

/**
 * As conquistas moram agora nas RECOMPENSAS, na aba "Conquistas" — como no
 * site. Esta rota fica para quem chega pelo endereço antigo (um link, um
 * aviso) e cai direto na aba certa.
 */
export default function Conquistas() {
  return <Redirect href={rota("/jornada/recompensas?aba=conquistas") as never} />;
}
