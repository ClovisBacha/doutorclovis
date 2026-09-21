import { badgeForPlan } from "@/lib/entitlements";

/**
 * Selo de verificação do médico, exibido às pacientes conforme o plano.
 * Elite (dourado) > Pro (roxo) > Starter (cinza). Free/Trial não têm selo.
 */
export function DoctorBadge({
  plan,
  size = "sm",
}: {
  plan: string | null | undefined;
  size?: "sm" | "xs";
}) {
  const badge = badgeForPlan(plan);
  if (!badge) return null;

  // O plano `elite` foi rebatizado como "Reconhecido" nas vendas — o selo
  // que a paciente vê acompanha (o valor interno segue "Elite").
  const label = badge === "Elite" ? "Reconhecido" : badge;

  const style =
    badge === "Black"
      ? "bg-gradient-to-r from-neutral-900 to-neutral-700 text-amber-300 shadow-sm ring-1 ring-amber-400/40"
      : badge === "Elite"
        ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm"
        : badge === "Pro"
          ? "bg-primary/15 text-primary"
          : "bg-slate-100 text-slate-500";

  const dims = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-bold ${style} ${dims}`}
      title={`Médico verificado · plano ${label}`}
    >
      <span aria-hidden>✓</span>
      {label}
    </span>
  );
}
