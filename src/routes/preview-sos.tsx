import { createFileRoute } from "@tanstack/react-router";
import { EmergencySheet } from "@/components/emergency-sheet";

/**
 * Bancada da CENTRAL DE EMERGÊNCIA.
 *
 * É a tela mais delicada do app e era a única sem como conferir: vive atrás do
 * login e só abre por um toque no SOS. Aqui ela renderiza com uma ficha
 * fictícia, em dois estados que mudam tudo — `?vazio=1` simula o perfil
 * incompleto (sem tipo sanguíneo e sem contato de emergência), que é
 * justamente quando os botões precisam continuar fazendo sentido.
 *
 * Nenhum dado real: tudo é constante de exemplo.
 */
export const Route = createFileRoute("/preview-sos")({
  validateSearch: (q: Record<string, unknown>) => ({
    vazio: q.vazio === true || String(q.vazio ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada do SOS" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewSos,
});

function PreviewSos() {
  const { vazio } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[50] bg-background">
      <EmergencySheet
        info={
          vazio
            ? { name: "Ana", weekLabel: "20s 6d" }
            : {
                name: "Ana",
                weekLabel: "20s 6d",
                bloodType: "O+",
                allergies: "Dipirona",
                emergencyContact: "Marcos Silva",
                emergencyPhone: "(31) 98888-7777",
                babyName: "Helena",
                dpp: "10/12/2026",
                medications: "Ácido fólico",
              }
        }
        onClose={() => {}}
        onOpenCard={() => {}}
      />
    </div>
  );
}
