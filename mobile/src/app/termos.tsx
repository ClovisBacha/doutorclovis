import { TelaDoDocumento } from "~/componentes/juridico/tela-do-documento";
import { TERMOS } from "~/lib/juridico/termos";

/** Os Termos de uso do app (fase 4) — o texto mora em `lib/juridico/termos.ts`. */
export default function Termos() {
  return <TelaDoDocumento doc={TERMOS} />;
}
