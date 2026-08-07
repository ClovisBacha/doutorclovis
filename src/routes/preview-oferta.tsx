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
import { useMemo, useState } from "react";
import { OfertaPremium } from "@/components/oferta-premium";
import {
  ANUAL_CENTAVOS,
  ANUAL_MENSAL_EQUIV_CENTAVOS,
  CUPOM_MEDICO_PCT,
  DESCONTO_ANUAL_COM_CUPOM_PCT,
  DESCONTO_ANUAL_PCT,
  ECONOMIA_ANUAL_CENTAVOS,
  MENSAL_CENTAVOS,
  PRECOS_PREMIUM,
  REFERENCIA_CENTAVOS,
} from "@/lib/promo";

export const Route = createFileRoute("/preview-oferta")({
  component: Preview,
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
});

function Preview() {
  const [comPromo, setComPromo] = useState(true);
  /* `useMemo` porque `ofertaDeProva` está na lista de dependências do efeito
     que lê a oferta: um objeto novo a cada render faria o efeito rodar a cada
     render, e o `setOferta` dentro dele voltaria a disparar o render. Não
     explodiu na tela, mas é laço — e laço que não aparece é o que sobra para
     alguém achar daqui a três meses. */
  const oferta = useMemo(
    () => ({
      /* Os dois estados da tela hoje: com e sem o cupom do médico. A oferta de
         boas-vindas foi aposentada — ver `promo.ts`. */
      temCupom: comPromo,
      medicoDoCupom: comPromo ? "Dr. Clóvis Bacha" : null,
      mensalCentavos: MENSAL_CENTAVOS,
      anualCentavos: ANUAL_CENTAVOS,
      mensalFinalCentavos: comPromo ? PRECOS_PREMIUM.mensalComCupom : MENSAL_CENTAVOS,
      anualFinalCentavos: comPromo ? PRECOS_PREMIUM.anualComCupom : ANUAL_CENTAVOS,
      referenciaCentavos: REFERENCIA_CENTAVOS,
      economiaCentavos: ECONOMIA_ANUAL_CENTAVOS,
      anualMensalEquivCentavos: ANUAL_MENSAL_EQUIV_CENTAVOS,
      descontoAnualPct: DESCONTO_ANUAL_PCT,
      descontoAnualComCupomPct: DESCONTO_ANUAL_COM_CUPOM_PCT,
      cupomPct: CUPOM_MEDICO_PCT,
    }),
    [comPromo],
  );
  return (
    <div className="min-h-screen bg-neutral-300">
      <button
        onClick={() => setComPromo((v) => !v)}
        className="fixed left-3 top-3 z-[80] rounded-full bg-black/80 px-3 py-1.5 text-xs font-bold text-white"
      >
        {comPromo ? "ver SEM cupom do médico" : "ver COM cupom do médico"}
      </button>
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
