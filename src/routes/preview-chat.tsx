import { createFileRoute } from "@tanstack/react-router";
import { ChatTab } from "@/routes/_authenticated/minha-conta";

/**
 * Bancada de design do CHAT — renderiza o `ChatTab` REAL, sem login.
 *
 * Existe pelo mesmo motivo da `/preview-home`, e por uma lição cara: o céu
 * recuado da home passou no navegador de teste e quebrou no Safari do iPhone,
 * porque a conferência tinha sido feita numa reprodução e não no componente.
 * Aqui o Playwright fotografa o componente de verdade, hora a hora — o fundo
 * desta aba é o gradiente do céu, então ele muda entre madrugada, dia,
 * entardecer e noite, e cada um precisa de prova própria.
 *
 * Não expõe dado nenhum: perfil e gestação são constantes de exemplo, e sem
 * sessão o nome do médico cai no da instalação (`doctor.config`).
 */
export const Route = createFileRoute("/preview-chat")({
  head: () => ({
    meta: [{ title: "Bancada do chat" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewChat,
});

function PreviewChat() {
  const gest = { weeks: 20, days: 6, totalDays: 146 } as never;
  const profile = { display_name: "Ana Clara", baby_name: "Clovis" } as never;
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-4 pt-3">
        <ChatTab profile={profile} gest={gest} />
      </div>
    </div>
  );
}
