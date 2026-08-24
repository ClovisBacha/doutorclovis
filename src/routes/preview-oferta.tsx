/**
 * Bancada dos preços do Premium — com e sem o cupom do médico.
 *
 * Existe porque a queixa que originou esta tela foi VISUAL ("muito pouco
 * chamativo"), e ler código não responde a isso.
 *
 * Renderiza o COMPONENTE DE VERDADE, com uma oferta fixa — não uma cópia do
 * markup. A primeira versão desta bancada era cópia, e divergiu do original em
 * menos de dez minutos: mostrava a tela consertada enquanto o app ainda tinha
 * o defeito. Bancada que mostra outra coisa é pior que bancada nenhuma.
 *
 * `noindex`, e coberta pelo `Disallow: /preview-` do robots.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { OfertaPremium } from "@/components/oferta-premium";
import {
  ANUAL_CENTAVOS,
  ANUAL_MENSAL_EQUIV_CENTAVOS,
  DESCONTO_ANUAL_PCT,
  ECONOMIA_ANUAL_CENTAVOS,
  MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
} from "@/lib/promo";

export const Route = createFileRoute("/preview-oferta")({
  component: Preview,
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
});

function Preview() {
  /**
   * A tela tinha DOIS estados — com e sem o cupom do médico — e o interruptor
   * que alternava entre eles. O cupom foi aposentado: há um preço só, para
   * todas. Manter o interruptor mostraria ao dono uma variante que a paciente
   * nunca vai ver, que é a pior coisa que uma tela de prova pode fazer.
   */
  const oferta = useMemo(
    () => ({
      mensalCentavos: MENSAL_CENTAVOS,
      anualCentavos: ANUAL_CENTAVOS,
      referenciaCentavos: REFERENCIA_CENTAVOS,
      economiaCentavos: ECONOMIA_ANUAL_CENTAVOS,
      anualMensalEquivCentavos: ANUAL_MENSAL_EQUIV_CENTAVOS,
      descontoAnualPct: DESCONTO_ANUAL_PCT,
    }),
    [],
  );
  return (
    <div className="min-h-screen bg-neutral-300">
      {/* O interruptor "com/sem cupom do médico" saiu com o cupom. Havia um
          estado só a partir daqui, e um botão que alterna entre um estado e ele
          mesmo é pior que nenhum botão. */}
      <OfertaPremium
        aberto
        onFechar={() => {}}
        motivo="item"
        itemNome="Coelhinho"
        ofertaDeProva={oferta}
      />
    </div>
  );
}
