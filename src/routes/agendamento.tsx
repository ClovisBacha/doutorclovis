import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { submitAppointmentRequest } from "@/lib/appointments.functions";

export const Route = createFileRoute("/agendamento")({
  head: () => ({
    meta: [
      { title: "Agendar consulta — Dr. Clóvis Bacha" },
      { name: "description", content: "Solicite seu horário com o Dr. Clóvis Bacha. Nossa equipe confirma a consulta em até 1 dia útil." },
      { property: "og:title", content: "Agendar consulta — Dr. Clóvis Bacha" },
      { property: "og:description", content: "Solicite seu horário com o Dr. Clóvis Bacha." },
    ],
  }),
  component: AgendamentoPage,
});

const horarios = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

function AgendamentoPage() {
  const submit = useServerFn(submitAppointmentRequest);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await submit({
        data: {
          patient_name: String(fd.get("name") ?? ""),
          patient_email: String(fd.get("email") ?? ""),
          patient_phone: String(fd.get("phone") ?? ""),
          preferred_date: String(fd.get("date") ?? ""),
          preferred_time: String(fd.get("time") ?? ""),
          reason: String(fd.get("reason") ?? ""),
          notes: String(fd.get("notes") ?? "") || null,
        },
      });
      if (res.ok) setDone(true);
      else setError(res.error);
    } catch (err) {
      console.error(err);
      setError("Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Agendamento</p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Solicite seu horário</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Preencha seus dados e a data desejada. Nossa equipe confirma o horário disponível com o doutor por telefone ou e-mail.
      </p>

      {done ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-primary/30 bg-card p-10 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="mt-5 font-serif text-2xl">Solicitação enviada!</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Recebemos seu pedido. A equipe entrará em contato em até 1 dia útil para confirmar seu horário com o Dr. Clóvis.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <Field label="Nome completo" name="name" required />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-mail" type="email" name="email" required />
            <Field label="Telefone / WhatsApp" name="phone" required placeholder="(00) 00000-0000" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Data preferida" type="date" name="date" min={today} required />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Horário preferido</label>
              <select name="time" required defaultValue="" className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="" disabled>Selecione…</option>
                {horarios.map((h) => (<option key={h} value={h}>{h}</option>))}
              </select>
            </div>
          </div>
          <Field label="Motivo da consulta" name="reason" required placeholder="Ex.: pré-natal, gestação de alto risco, primeira consulta…" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Observações (opcional)</label>
            <textarea name="notes" rows={4} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Conte algo que ajude o doutor a se preparar para a consulta." />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Enviando…" : "Enviar solicitação"}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input {...props} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
    </div>
  );
}