import { createFileRoute } from "@tanstack/react-router";
import { ymdLocal } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { submitAppointmentRequest } from "@/lib/appointments.functions";
import { DOCTOR } from "@/lib/doctor.config";
import { Reveal } from "@/components/reveal";

type Booked = { name: string; date: string; time: string; reason: string };

// "2026-06-20" + "14:00" → "20260620T140000" (hora local "flutuante")
function toCalStamp(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}
function addHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function googleCalUrl(b: Booked) {
  const start = toCalStamp(b.date, b.time);
  const end = toCalStamp(b.date, addHour(b.time));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Consulta com Dr. Clóvis Bacha (a confirmar)",
    dates: `${start}/${end}`,
    details: `Motivo: ${b.reason}. Horário sujeito à confirmação do consultório.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function downloadIcs(b: Booked) {
  const start = toCalStamp(b.date, b.time);
  const end = toCalStamp(b.date, addHour(b.time));
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dr Clovis Bacha//Agendamento//PT-BR",
    "BEGIN:VEVENT",
    `UID:${start}-${Math.random().toString(36).slice(2)}@doutorclovis`,
    `DTSTAMP:${toCalStamp(b.date, b.time)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    "SUMMARY:Consulta com Dr. Clóvis Bacha (a confirmar)",
    `DESCRIPTION:Motivo: ${b.reason}. Horário sujeito à confirmação do consultório.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "consulta-dr-clovis.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/agendamento")({
  head: () => ({
    meta: [
      { title: "Agendar consulta — Obstétrica" },
      {
        name: "description",
        content:
          "Solicite seu horário com o Dr. Clóvis Bacha. Nossa equipe confirma a consulta em até 1 dia útil.",
      },
      { property: "og:title", content: "Agendar consulta — Obstétrica" },
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
  const [booked, setBooked] = useState<Booked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = ymdLocal();

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
      if (res.ok) {
        setBooked({
          name: String(fd.get("name") ?? ""),
          date: String(fd.get("date") ?? ""),
          time: String(fd.get("time") ?? ""),
          reason: String(fd.get("reason") ?? ""),
        });
        setDone(true);
      } else setError(res.error);
    } catch (err) {
      console.error(err);
      setError("Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: DOCTOR.siteUrl },
              {
                "@type": "ListItem",
                position: 2,
                name: "Agendar consulta",
                item: `${DOCTOR.siteUrl}/agendamento`,
              },
            ],
          }),
        }}
      />
      <section className="mx-auto max-w-3xl px-5 py-16 md:py-24">
        <Reveal variant="blur">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Agendamento
          </p>
        </Reveal>
        <Reveal variant="up" delay={60}>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">Solicite seu horário</h1>
        </Reveal>
        <Reveal variant="up" delay={120}>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Preencha seus dados e a data desejada. Nossa equipe confirma o horário disponível com o
            doutor por telefone ou e-mail.
          </p>
        </Reveal>

        {done ? (
          <Reveal variant="scale" delay={100}>
            <div className="mt-10 flex flex-col items-center rounded-2xl border border-primary/30 bg-card p-10 text-center shadow-[var(--shadow-card)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-7 w-7" />
              </div>
              <h2 className="mt-5 font-serif text-2xl">Solicitação enviada!</h2>
              <p className="mt-2 max-w-md text-muted-foreground">
                Recebemos seu pedido e enviamos uma confirmação para o seu e-mail. A equipe entrará
                em contato em até 1 dia útil para confirmar seu horário com o Dr. Clóvis.
              </p>
              {booked && (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <a
                    href={googleCalUrl(booked)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                  >
                    <CalendarPlus className="h-4 w-4" /> Google Agenda
                  </a>
                  <button
                    onClick={() => downloadIcs(booked)}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:text-primary"
                  >
                    <CalendarPlus className="h-4 w-4" /> Baixar .ics
                  </button>
                </div>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                O horário no calendário é uma lembrança da sua preferência — a confirmação final vem
                do consultório.
              </p>
            </div>
          </Reveal>
        ) : (
          <Reveal variant="up" delay={160}>
            <form
              onSubmit={onSubmit}
              className="mt-10 grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
            >
              <Field label="Nome completo" name="name" required />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="E-mail" type="email" name="email" required />
                <Field
                  label="Telefone / WhatsApp"
                  name="phone"
                  required
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Data preferida" type="date" name="date" min={today} required />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Horário preferido</label>
                  <select
                    name="time"
                    required
                    defaultValue=""
                    className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="" disabled>
                      Selecione…
                    </option>
                    {horarios.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Field
                label="Motivo da consulta"
                name="reason"
                required
                placeholder="Ex.: pré-natal, gestação de alto risco, primeira consulta…"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Observações (opcional)</label>
                <textarea
                  name="notes"
                  rows={4}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  placeholder="Conte algo que ajude o doutor a se preparar para a consulta."
                />
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
          </Reveal>
        )}
      </section>
    </>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input
        {...props}
        className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
