import { router } from "expo-router";
import Sparkles from "lucide-react-native/icons/sparkles";
import { LinhaDeAjuste, SecaoDeAjustes } from "~/componentes/ajustes";
import { rota } from "~/componentes/jornada/bancada";
import { GERENCIAR_ASSINATURAS } from "~/lib/assinatura/plano";
import { usePlano } from "~/lib/assinatura/usar-plano";
import { abrir } from "~/lib/links";
import { cor } from "~/tema";

/**
 * O PLANO COMPLETO NO PERFIL (só com a chave da assinatura ligada, e nunca no
 * Modo Cuidado — quem chama decide as duas coisas): uma linha que abre a tela
 * do plano (`origem: "perfil"`) e, para quem assina, "Gerenciar assinatura"
 * (a página de assinaturas da conta da Apple).
 */
export function SecaoDoPlano() {
  const plano = usePlano();
  const tem = plano.conhecido && plano.temPlano;
  const abrirPlano = () => router.push(rota("/assinatura?origem=perfil") as never);
  return (
    <SecaoDeAjustes>
      <LinhaDeAjuste
        Icone={Sparkles}
        tinta={cor.primaria}
        titulo="Plano completo"
        valor={tem ? "Ativo" : null}
        aoTocar={abrirPlano}
      />
      {tem ? (
        <LinhaDeAjuste titulo="Gerenciar assinatura" aoTocar={() => abrir(GERENCIAR_ASSINATURAS)} />
      ) : null}
    </SecaoDeAjustes>
  );
}
