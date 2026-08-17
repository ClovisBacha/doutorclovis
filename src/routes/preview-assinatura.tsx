import { createFileRoute } from "@tanstack/react-router";
import { AssinaturaTab } from "@/components/assinatura-tab";

/**
 * Bancada de MINHA ASSINATURA.
 *
 * ⚠️ ELA NASCE JUNTO COM A TELA, e isso é a lição de hoje aplicada na hora: o
 * campo do código da embaixadora e o cartão do Perfil foram escritos às cegas
 * e só ganharam bancada depois, num remendo. Esta tela lê `subscriptions` do
 * servidor — sem sessão ela cai sempre no "plano gratuito", e os três estados
 * que importam (ativa pelo Stripe, ativa pela loja do celular, cancelada) só
 * apareceriam numa conta real que estivesse naquele estado exato.
 *
 * A bancada fabrica o DADO (a linha de assinatura), nunca o desenho.
 *
 * Parâmetros:
 *   `?estado=loja`      ativa · loja · presente · cancelada · gratuito
 */
export const Route = createFileRoute("/preview-assinatura")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Oitava vez que isto aparece no repo. */
    /* ⚠️ O PADRÃO É `loja`, e não `ativa` (Stripe): é o caminho REAL da
       paciente. `CANAL_DE.premium_paciente === "app"` — o Premium dela se
       compra na loja; o Stripe é do médico, no site. Uma bancada que abre no
       caso raro ensina o caso errado. */
    estado: q.estado == null ? "loja" : String(q.estado),
  }),
  head: () => ({
    meta: [{ title: "Bancada da assinatura" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewAssinatura,
});

function PreviewAssinatura() {
  const { estado } = Route.useSearch();
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString();

  const bancada =
    estado === "gratuito"
      ? []
      : estado === "presente"
        ? [
            {
              product: "quiz_premium",
              plan: "convite_medico_1ano",
              status: "active",
              source: "convite",
              current_period_end: em30,
            },
          ]
        : estado === "loja"
          ? [
              {
                product: "premium",
                plan: "mensal",
                status: "active",
                source: "apple",
                current_period_end: em30,
              },
            ]
          : estado === "cancelada"
            ? [
                {
                  product: "premium",
                  plan: "mensal",
                  status: "canceled",
                  source: "stripe",
                  current_period_end: em30,
                },
              ]
            : [
                {
                  product: "premium",
                  plan: "mensal",
                  status: "active",
                  source: "stripe",
                  current_period_end: em30,
                },
              ];

  return (
    <div className="mx-auto max-w-md p-4">
      <AssinaturaTab bancada={bancada} onNavigate={() => {}} />
    </div>
  );
}
