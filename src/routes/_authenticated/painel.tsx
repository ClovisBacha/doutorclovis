import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminData,
  setQuestionAnswered,
  updateAppointmentStatus,
  type AdminAppointment,
  type AdminQuestion,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel do médico — Dr. Clóvis Bacha" }] }),
  component: PainelPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  done: "Realizada",
  cancelled: "Cancelada",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  done: "bg-sky-100 text-sky-800",
  cancelled: "bg-rose-100 text-rose-700",
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function PainelPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);

  async function load() {
    const res = await getAdminData({ data: { accessToken: await token() } });
    if (!res.ok) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setAllowed(true);
    setAppointments(res.appointments);
    setQuestions(res.questions);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(id: string, status: AdminAppointment["status"]) {
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    await updateAppointmentStatus({
      data: { accessToken: await token(), id, status: status as never },
    });
  }

  async function toggleAnswered(id: string, answered: boolean) {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, answered } : x)));
    await setQuestionAnswered({ data: { accessToken: await token(), id, answered } });
  }

  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center text-muted-foreground">
        Carregando...
      </div>
    );

  if (!allowed)
    return (
      <section className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-serif text-3xl">Área restrita</h1>
        <p className="mt-3 text-muted-foreground">
          Este painel é exclusivo da equipe médica. Se você é o responsável, peça para adicionar seu
          e-mail à variável <code className="rounded bg-secondary px-1">ADMIN_EMAILS</code>.
        </p>
      </section>
    );

  const pendingAppts = appointments.filter((a) => a.status === "pending").length;
  const pendingQs = questions.filter((q) => !q.answered).length;

  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Painel do médico
      </p>
      <h1 className="mt-2 font-serif text-3xl md:text-4xl">Gestão do consultório</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pedidos pendentes" value={pendingAppts} />
        <Stat label="Perguntas a responder" value={pendingQs} />
        <Stat label="Total de pedidos" value={appointments.length} />
        <Stat label="Total de perguntas" value={questions.length} />
      </div>

      {/* Pedidos de consulta */}
      <h2 className="mt-12 font-serif text-2xl">Pedidos de consulta</h2>
      {appointments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{a.patient_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.patient_phone} · {a.patient_email}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[a.status] ?? ""}`}
                >
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>
              <p className="mt-3 text-sm">
                <strong>Preferência:</strong>{" "}
                {new Date(a.preferred_date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                {a.preferred_time}
              </p>
              <p className="mt-1 text-sm">
                <strong>Motivo:</strong> {a.reason}
              </p>
              {a.notes && (
                <p className="mt-1 text-sm text-muted-foreground">
                  <strong>Obs.:</strong> {a.notes}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {(["confirmed", "done", "cancelled", "pending"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(a.id, s)}
                    disabled={a.status === s}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
                <a
                  href={`https://wa.me/55${a.patient_phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Perguntas das pacientes */}
      <h2 className="mt-12 font-serif text-2xl">Perguntas das pacientes</h2>
      {questions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div>
                <p className="text-sm text-muted-foreground">{q.patient}</p>
                <p className="mt-1 text-foreground">{q.question}</p>
              </div>
              <button
                onClick={() => toggleAnswered(q.id, !q.answered)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  q.answered
                    ? "bg-emerald-100 text-emerald-800"
                    : "border border-border text-muted-foreground hover:text-primary"
                }`}
              >
                {q.answered ? "Respondida ✓" : "Marcar respondida"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-[var(--shadow-card)]">
      <p className="font-serif text-3xl text-primary">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
