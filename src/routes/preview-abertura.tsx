import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppBottomNav } from "@/components/app-mobile-shell";
import type { NomeDoCeu } from "@/components/ceu-do-dia";
import { EmergencySheet } from "@/components/emergency-sheet";
import { PrimeiroQuadro } from "@/components/primeiro-quadro";

/**
 * Bancada do PRIMEIRO QUADRO — o que a paciente vê enquanto o app carrega.
 *
 * ⚠️ **Este estado era impossível de olhar.** Ele vive atrás do login, dura uma
 * fração de segundo e acontece no meio de duas idas à rede — então ninguém
 * nunca tinha visto o quadro em que o app abre. Foi assim que a barra de baixo
 * (e com ela o **botão de socorro**) passou a não existir ali, sem nenhum
 * relato: quem abre o app com pressa e não acha o SOS conclui que o app é assim.
 *
 *   /preview-abertura                → o caso normal: céu do dia + a barra
 *   /preview-abertura?ceu=anoitecer  → a barra escura, sobre céu de noite
 *   /preview-abertura?ceu=nenhum     → DEEP LINK (`?tab=…`): vulto neutro,
 *                                      porque o destino não é a home
 *   /preview-abertura?medico=1       → conta com marca de médico: sem a barra
 *                                      da gestante (o app dele é o painel)
 *   /preview-abertura?sos=1          → o SOS aberto ANTES de o perfil chegar
 *
 * Nenhum dado real: tudo é constante de exemplo.
 */
export const Route = createFileRoute("/preview-abertura")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `String(q.ceu ?? "")` e não `q.ceu === "…"`: o router serializa e
       revalida, e na segunda passada o valor pode chegar já convertido. É a
       armadilha que `preview-jogo` e `preview-saude` documentam. */
    ceu: String(q.ceu ?? "dia"),
    medico: q.medico === true || String(q.medico ?? "") === "1",
    sos: q.sos === true || String(q.sos ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada da abertura" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewAbertura,
});

const CEUS: NomeDoCeu[] = ["amanhecer", "dia", "por-do-sol", "anoitecer"];

function PreviewAbertura() {
  const { ceu, medico, sos } = Route.useSearch();
  const [aberto, setAberto] = useState(sos);

  const nome = CEUS.find((c) => c === ceu) ?? null;
  const escura = nome === "anoitecer";

  /* O MESMO par do app: a folha e a barra. A bancada monta as duas de verdade
     — desenhar um retângulo no lugar delas provaria o layout e nada mais. */
  const cromo = (
    <>
      {aberto && (
        <EmergencySheet
          /* ⚠️ O ESTADO QUE ESTA BANCADA EXISTE PARA PROVAR: o perfil ainda não
             chegou. Sem `fichaResolvida={false}` a folha AFIRMA duas coisas
             falsas — "Complete tipo sanguíneo e contato de emergência no seu
             Perfil" (uma acusação, sobre um perfil preenchido há meses) e
             "Alergias: nenhuma informada" / "Medicamentos: nenhum", que é uma
             afirmação lida por um SOCORRISTA. */
          fichaResolvida={false}
          /* Falha FECHADO: sem perfil não se sabe se ela está em luto, e o
             rótulo neutro é verdadeiro nos dois casos. */
          tituloDaFicha="FICHA DE EMERGÊNCIA - PACIENTE OBSTÉTRICA"
          info={{
            name: null,
            weekLabel: null,
            bloodType: null,
            allergies: null,
            emergencyContact: null,
            emergencyPhone: null,
            babyName: null,
            dpp: null,
            medications: null,
          }}
          medico={null}
          /* `false` = ainda não sabemos se ela tem médico — que é a verdade
             durante o carregamento. */
          medicoResolvido={false}
          /* Nunca fotografadas: a triagem é a única porta dela no celular. */
          onTriagem={() => {}}
          onOpenCard={() => {}}
          onClose={() => setAberto(false)}
        />
      )}
      <AppBottomNav
        activeSection={nome ? "home" : null}
        onSelect={() => {}}
        onEmergency={() => setAberto(true)}
        escura={escura}
      />
    </>
  );

  return (
    <div className="min-h-[100svh] bg-background px-5 pt-2">
      {/* O cromo é IRMÃO do quadro, como na produção — ver `PrimeiroQuadro`. */}
      <PrimeiroQuadro ceu={nome} />
      {!medico && cromo}
    </div>
  );
}
