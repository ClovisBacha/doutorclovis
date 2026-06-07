import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { babyForWeek, computeGestation, dueDateFromLmp } from "@/lib/gestacao";

export const Route = createFileRoute("/acompanhar/$token")({
  head: () => ({ meta: [{ title: "Acompanhar gestação — Dr. Clóvis Bacha" }] }),
  component: CompanionView,
});

function CompanionView() {
  const { token } = Route.useParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: invite } = await (supabase as any)
        .from("companion_invites").select("*").eq("token", token).maybeSingle();
      if (!invite) { setErr("Convite inválido ou expirado."); setLoading(false); return; }
      const { data: p } = await (supabase as any)
        .from("patient_profiles").select("display_name,baby_name,lmp_date,due_date,reference_date,reference_weeks,reference_days")
        .eq("id", invite.user_id).maybeSingle();
      setProfile(p);
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-muted-foreground">Carregando...</div>;
  if (err || !profile) return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-muted-foreground">{err ?? "Não encontrado."}</div>;

  const gest = computeGestation({
    lmp: profile.lmp_date,
    referenceDate: profile.reference_date,
    referenceWeeks: profile.reference_weeks,
    referenceDays: profile.reference_days,
  });
  const baby = gest ? babyForWeek(gest.weeks) : null;
  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);

  return (
    <section className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Acompanhamento</p>
      <h1 className="mt-2 font-serif text-3xl">
        {profile.baby_name ?? "O bebê"} de {profile.display_name ?? "—"}
      </h1>

      {gest && baby && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Esta semana</p>
          <h2 className="mt-2 font-serif text-4xl">
            {gest.weeks} <span className="text-2xl text-muted-foreground">semanas</span>
            {gest.days > 0 && <span className="ml-2 text-xl text-muted-foreground">e {gest.days}d</span>}
          </h2>
          <div className="mt-6 rounded-2xl bg-[var(--gradient-warm)] p-6">
            <p className="font-serif text-2xl text-primary">{baby.size}</p>
            <p className="text-sm text-muted-foreground">Peso aproximado: {baby.weight}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tamanho de: {baby.fruit}</p>
            <p className="mt-4 text-sm leading-relaxed">{baby.desc}</p>
          </div>
          {due && (
            <p className="mt-6 text-sm text-muted-foreground">
              DPP: <strong className="text-foreground">{new Date(due + "T00:00:00").toLocaleDateString("pt-BR")}</strong>
            </p>
          )}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Acompanhamento médico com Dr. Clóvis Bacha
      </p>
    </section>
  );
}