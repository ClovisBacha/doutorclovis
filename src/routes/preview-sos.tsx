import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
    // `?outro=1` simula uma paciente vinculada a OUTRO médico: e o teste que
    // prova que o SOS liga para o medico dela, e nao para o dono da
    // instalacao.
    outro: q.outro === true || String(q.outro ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada do SOS" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewSos,
});

function PreviewSos() {
  const { vazio, outro } = Route.useSearch();
  /* Troca o tipo sanguíneo SEM remontar a tela: é assim que se prova que o QR
     acompanha a edição do perfil, e não só o primeiro desenho. */
  const [sangue, setSangue] = useState("O+");
  return (
    <div className="fixed inset-0 z-[50] bg-background">
      <button
        data-testid="trocar-sangue"
        onClick={() => setSangue((v) => (v === "O+" ? "AB−" : "O+"))}
        className="fixed left-2 top-2 z-[200] rounded bg-black/70 px-2 py-1 text-[10px] text-white"
      >
        trocar sangue
      </button>
      <EmergencySheet
        info={
          vazio
            ? { name: "Ana", weekLabel: "20s 6d" }
            : {
                name: "Ana",
                weekLabel: "20s 6d",
                bloodType: sangue,
                allergies: "Dipirona",
                emergencyContact: "Marcos Silva",
                emergencyPhone: "(31) 98888-7777",
                babyName: "Helena",
                dpp: "10/12/2026",
                medications: "Ácido fólico",
              }
        }
        medico={
          outro
            ? {
                nome: "Dra. Marina Prado",
                title: "Ginecologista e Obstetra",
                specialty: "Gestação de alto risco",
                crm: "CRM-SP 98.765",
                whatsapp: "(11) 97777-1234",
              }
            : null
        }
        onClose={() => {}}
        onOpenCard={() => {}}
      />
    </div>
  );
}
