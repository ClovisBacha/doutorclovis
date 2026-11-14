import { TelaDoDocumento } from "~/componentes/juridico/tela-do-documento";
import { PRIVACIDADE } from "~/lib/juridico/privacidade";

/** A Política de privacidade do app (fase 4) — o texto mora em `lib/juridico/privacidade.ts`. */
export default function Privacidade() {
  return <TelaDoDocumento doc={PRIVACIDADE} />;
}
