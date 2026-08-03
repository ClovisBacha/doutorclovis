/**
 * Bancada da oferta de boas-vindas.
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
import { useState } from "react";
import { OfertaPremium } from "@/components/oferta-premium";
import {
  ANUAL_LISTA_CENTAVOS,
  DESCONTO_PCT,
  ECONOMIA_CENTAVOS,
  JANELA_MS,
  PROMO_CENTAVOS,
  REFERENCIA_CENTAVOS,
} from "@/lib/promo";

export const Route = createFileRoute("/preview-oferta")({
  component: Preview,
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
});

function Preview() {
  const [comPromo, setComPromo] = useState(true);
  const oferta = {
    ativa: comPromo,
    restanteMs: comPromo ? JANELA_MS : 0,
    descontoPct: DESCONTO_PCT,
    referenciaCentavos: REFERENCIA_CENTAVOS,
    promoCentavos: PROMO_CENTAVOS,
    economiaCentavos: ECONOMIA_CENTAVOS,
    listaCentavos: ANUAL_LISTA_CENTAVOS,
  };
  return (
    <div className="min-h-screen bg-neutral-300">
      <button
        onClick={() => setComPromo((v) => !v)}
        className="fixed left-3 top-3 z-[80] rounded-full bg-black/80 px-3 py-1.5 text-xs font-bold text-white"
      >
        {comPromo ? "ver SEM promoção" : "ver COM promoção"}
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
