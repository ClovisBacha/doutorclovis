import { Redirect } from "expo-router";
import { TelaDaNutricao } from "~/componentes/nutricao/TelaDaNutricao";
import { IA_NO_APP } from "~/config";

/**
 * /nutricao — a nutricionista com IA (conversa e foto). A Saúde aponta para cá.
 *
 * Com a IA desligada (`IA_NO_APP`), um link antigo ou guardado não abre a
 * conversa: volta para a Saúde.
 */
export default function Nutricao() {
  if (!IA_NO_APP) return <Redirect href="/saude" />;
  return <TelaDaNutricao />;
}
