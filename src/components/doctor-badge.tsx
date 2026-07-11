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

  const style =
    badge === "Elite"
      ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm"
      : badge === "Pro"
        ? "bg-primary/15 text-primary"
        : "bg-slate-100 text-slate-500";

  const dims = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-bold ${style} ${dims}`}
      title={`Médico verificado · plano ${badge}`}
    >
      <span aria-hidden>✓</span>
      {badge}
    </span>
  );
}
