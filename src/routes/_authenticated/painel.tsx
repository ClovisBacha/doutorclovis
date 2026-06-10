import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminData,
  getEngagementData,
  getPreConsultaForms,
  getPatientReport,
  markPreConsultaSeen,
  setQuestionAnswered,
  updateAppointmentStatus,
  type AdminAppointment,
  type AdminPreConsulta,
  type AdminQuestion,
  type PatientEngagement,
} from "@/lib/admin.functions";
import { computeGestation } from "@/lib/gestacao";
import {
  getTeleconsultasAdmin,
  createTeleconsulta,
  updateTeleconsultaStatus,
  type TeleconsultaSession,
} from "@/lib/teleconsulta.functions";
import {
  getCorporateLeadsAdmin,
  createCorporateAccountAdmin,
  updateLeadStatusAdmin,
  type CorporateLead,
  type CorporateAccount,
} from "@/lib/corporativo.functions";
import {
  getPrivateConsultationsAdmin,
  confirmPaymentAdmin,
  CONSULT_TYPES as PRIVATE_CONSULT_TYPES,
  type PrivateConsultation,
} from "@/lib/consultaparticular.functions";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel do médico — Obstétrica by Dr. Clóvis" }] }),
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

const PANEL_TABS = [
  "Calendário",
  "Agendamentos",
  "Agenda",
  "Perguntas",
  "Pré-consultas",
  "Teleconsultas",
  "Consultas Pagas",
  "Empresas",
  "Engajamento",
] as const;
type PanelTab = (typeof PANEL_TABS)[number];

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function PainelPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<PanelTab>("Calendário");
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [preForms, setPreForms] = useState<AdminPreConsulta[]>([]);
  const [teleconsultas, setTeleconsultas] = useState<TeleconsultaSession[]>([]);
  const [privateConsults, setPrivateConsults] = useState<any[]>([]);
  const [corporateLeads, setCorporateLeads] = useState<CorporateLead[]>([]);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccount[]>([]);
  const [engagement, setEngagement] = useState<{
    totalPatients: number;
    activeLastWeek: number;
    inactiveLastWeek: number;
    unseenPreConsultas: number;
    patients: PatientEngagement[];
  } | null>(null);

  async function load() {
    const tk = await token();
    const res = await getAdminData({ data: { accessToken: tk } });
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

  async function loadEngagement() {
    const tk = await token();
    const res = await getEngagementData({ data: { accessToken: tk } });
    if (res.ok) setEngagement(res);
  }

  async function loadPreForms() {
    const tk = await token();
    const res = await getPreConsultaForms({ data: { accessToken: tk } });
    if (res.ok) setPreForms(res.forms);
  }

  async function loadTeleconsultas() {
    const tk = await token();
    const res = await getTeleconsultasAdmin({ data: { accessToken: tk } });
    if (res.ok) setTeleconsultas(res.sessions);
  }

  async function loadPrivateConsults() {
    const tk = await token();
    const res = await getPrivateConsultationsAdmin({ data: { accessToken: tk } });
    if (res.ok) setPrivateConsults(res.consultations);
  }

  async function loadCorporate() {
    const tk = await token();
    const res = await getCorporateLeadsAdmin({ data: { accessToken: tk } });
    if (res.ok) {
      setCorporateLeads(res.leads);
      setCorporateAccounts(res.accounts);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    if (tab === "Engajamento" && !engagement) loadEngagement();
    if (tab === "Pré-consultas") loadPreForms();
    if (tab === "Teleconsultas") loadTeleconsultas();
    if (tab === "Consultas Pagas") loadPrivateConsults();
    if (tab === "Empresas") loadCorporate();
  }, [tab, allowed]);

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

  async function markSeen(id: string) {
    setPreForms((f) => f.map((x) => (x.id === id ? { ...x, seen_by_doctor: true } : x)));
    await markPreConsultaSeen({ data: { accessToken: await token(), id } });
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
  const unseenForms = preForms.filter((f) => !f.seen_by_doctor).length;

  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Painel do médico
      </p>
      <h1 className="mt-2 font-serif text-3xl md:text-4xl">Gestão do consultório</h1>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pedidos pendentes" value={pendingAppts} highlight={pendingAppts > 0} />
        <Stat label="Perguntas a responder" value={pendingQs} highlight={pendingQs > 0} />
        <Stat label="Pré-consultas novas" value={unseenForms} highlight={unseenForms > 0} />
        <Stat label="Total agendamentos" value={appointments.length} />
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border">
        {PANEL_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {t}
            {t === "Perguntas" && pendingQs > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {pendingQs}
              </span>
            )}
            {t === "Pré-consultas" && unseenForms > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-white">
                {unseenForms}
              </span>
            )}
            {t === "Teleconsultas" &&
              teleconsultas.filter((s) => s.status === "sala_aberta").length > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-xs font-bold text-white">
                  {teleconsultas.filter((s) => s.status === "sala_aberta").length}
                </span>
              )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "Calendário" && (
          <CalendárioSection appointments={appointments} onNavigate={setTab} />
        )}
        {tab === "Agendamentos" && (
          <AppointmentsSection
            appointments={appointments}
            onChangeStatus={changeStatus}
            onRefresh={load}
          />
        )}
        {tab === "Agenda" && <AgendaSection />}
        {tab === "Perguntas" && (
          <QuestionsSection questions={questions} onToggle={toggleAnswered} />
        )}
        {tab === "Pré-consultas" && (
          <PreConsultasSection forms={preForms} onMarkSeen={markSeen} tokenFn={token} />
        )}
        {tab === "Teleconsultas" && (
          <TeleconsultasSection
            sessions={teleconsultas}
            onRefresh={loadTeleconsultas}
            tokenFn={token}
            patients={engagement?.patients ?? []}
          />
        )}
        {tab === "Engajamento" && (
          <EngagementSection engagement={engagement} onRefresh={loadEngagement} tokenFn={token} />
        )}
        {tab === "Consultas Pagas" && (
          <ConsultasPagasSection
            consultations={privateConsults}
            onRefresh={loadPrivateConsults}
            tokenFn={token}
          />
        )}
        {tab === "Empresas" && (
          <EmpresasSection
            leads={corporateLeads}
            accounts={corporateAccounts}
            onRefresh={loadCorporate}
            tokenFn={token}
          />
        )}
      </div>
    </section>
  );
}

/* ---------- Agendamentos ---------- */
function AppointmentsSection({
  appointments,
  onChangeStatus,
  onRefresh,
}: {
  appointments: AdminAppointment[];
  onChangeStatus: (id: string, s: AdminAppointment["status"]) => void;
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmForm, setConfirmForm] = useState<{
    date: string;
    time: string;
    price: string;
    notes: string;
  }>({ date: "", time: "", price: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [receiptAppt, setReceiptAppt] = useState<AdminAppointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function saveConfirmation(a: AdminAppointment) {
    if (!confirmForm.date || !confirmForm.time) return;
    setSaving(true);
    await (supabase as any)
      .from("appointment_requests")
      .update({
        status: "confirmed",
        confirmed_date: confirmForm.date,
        confirmed_time: confirmForm.time,
        price_brl: confirmForm.price ? Math.round(Number(confirmForm.price) * 100) : null,
        internal_notes: confirmForm.notes || null,
      })
      .eq("id", a.id);
    onChangeStatus(a.id, "confirmed");
    setExpandedId(null);
    setSaving(false);
    onRefresh();
  }

  async function markPaid(id: string) {
    await (supabase as any)
      .from("appointment_requests")
      .update({ payment_status: "pago" })
      .eq("id", id);
    onRefresh();
  }

  function pixWhatsApp(a: AdminAppointment) {
    const price = (a as any).price_brl ? ((a as any).price_brl / 100).toFixed(2) : "___";
    const msg = encodeURIComponent(
      `Olá, ${a.patient_name}! Para confirmar sua consulta no dia ${(a as any).confirmed_date ? new Date((a as any).confirmed_date + "T00:00:00").toLocaleDateString("pt-BR") : new Date(a.preferred_date + "T00:00:00").toLocaleDateString("pt-BR")} às ${(a as any).confirmed_time ?? a.preferred_time}, envie R$ ${price} via PIX para a chave: bachaclovis@gmail.com (Dr. Clóvis Bacha). Após o pagamento, envie o comprovante aqui. Obrigado!`,
    );
    window.open(`https://wa.me/55${a.patient_phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  }

  function exportIcal() {
    const confirmed = appointments.filter(
      (a) => (a as any).confirmed_date && a.status === "confirmed",
    );
    if (!confirmed.length) {
      alert("Nenhuma consulta confirmada com data definida.");
      return;
    }
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Dr Clovis Bacha//Agenda//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];
    for (const a of confirmed) {
      const d = (a as any).confirmed_date as string;
      const t = ((a as any).confirmed_time ?? "08:00") as string;
      const start = `${d.replace(/-/g, "")}T${t.replace(":", "")}00`;
      const [h, m] = t.split(":").map(Number);
      const endH = String(h + 1).padStart(2, "0");
      const end = `${d.replace(/-/g, "")}T${endH}${String(m).padStart(2, "0")}00`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${a.id}@doutorclovis`,
        `DTSTART;TZID=America/Sao_Paulo:${start}`,
        `DTEND;TZID=America/Sao_Paulo:${end}`,
        `SUMMARY:Consulta — ${a.patient_name}`,
        `DESCRIPTION:Motivo: ${a.reason}. Tel: ${a.patient_phone}`,
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agenda-dr-clovis.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered =
    filterStatus === "all" ? appointments : appointments.filter((a) => a.status === filterStatus);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "confirmed", "done", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"}`}
            >
              {s === "all"
                ? `Todos (${appointments.length})`
                : `${STATUS_LABEL[s]} (${appointments.filter((a) => a.status === s).length})`}
            </button>
          ))}
        </div>
        <button
          onClick={exportIcal}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          ⬇ Exportar .ics
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido nesta categoria.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const ext = a as any;
            const isExpanded = expandedId === a.id;
            const payStatus = ext.payment_status ?? "sem_cobranca";
            return (
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
                  <div className="flex items-center gap-2">
                    {payStatus === "pago" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        💰 Pago
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[a.status] ?? ""}`}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-0.5 text-sm">
                  <p>
                    <strong>Preferência:</strong>{" "}
                    {new Date(a.preferred_date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                    {a.preferred_time}
                  </p>
                  {ext.confirmed_date && (
                    <p className="text-emerald-700 font-medium">
                      ✓ Confirmado para:{" "}
                      {new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                      {ext.confirmed_time}
                      {ext.price_brl && ` · R$ ${(ext.price_brl / 100).toFixed(2)}`}
                    </p>
                  )}
                  <p>
                    <strong>Motivo:</strong> {a.reason}
                  </p>
                  {a.notes && (
                    <p className="text-muted-foreground">
                      <strong>Obs.:</strong> {a.notes}
                    </p>
                  )}
                  {ext.internal_notes && (
                    <p className="text-primary text-xs">📝 Nota interna: {ext.internal_notes}</p>
                  )}
                </div>

                {/* Confirm with time panel */}
                {isExpanded && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium mb-3">Confirmar com horário definitivo</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Data confirmada *</label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.date}
                          onChange={(e) => setConfirmForm({ ...confirmForm, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Horário confirmado *
                        </label>
                        <input
                          type="time"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.time}
                          onChange={(e) => setConfirmForm({ ...confirmForm, time: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Valor (R$) — opcional
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 350"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.price}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, price: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Nota interna</label>
                        <input
                          placeholder="Apenas visível para você"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.notes}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => saveConfirmation(a)}
                        disabled={saving || !confirmForm.date || !confirmForm.time}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                      >
                        {saving ? "Salvando…" : "✓ Confirmar consulta"}
                      </button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {a.status === "pending" && (
                    <button
                      onClick={() => {
                        setExpandedId(isExpanded ? null : a.id);
                        setConfirmForm({
                          date: a.preferred_date,
                          time: a.preferred_time,
                          price: "",
                          notes: "",
                        });
                      }}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Confirmar com horário
                    </button>
                  )}
                  {(["done", "cancelled", "pending"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onChangeStatus(a.id, s)}
                      disabled={a.status === s}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-40"
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
                  {ext.price_brl && payStatus !== "pago" && (
                    <button
                      onClick={() => pixWhatsApp(a)}
                      className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      💰 Cobrar via PIX
                    </button>
                  )}
                  {ext.price_brl && payStatus !== "pago" && (
                    <button
                      onClick={() => markPaid(a.id)}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
                    >
                      ✓ Marcar pago
                    </button>
                  )}
                  {a.status === "confirmed" && (
                    <button
                      onClick={() => setReceiptAppt(a)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
                    >
                      🖨 Recibo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Modal */}
      {receiptAppt && <ReceiptModal appt={receiptAppt} onClose={() => setReceiptAppt(null)} />}
    </div>
  );
}

/* ---------- Perguntas ---------- */
function QuestionsSection({
  questions,
  onToggle,
}: {
  questions: AdminQuestion[];
  onToggle: (id: string, answered: boolean) => void;
}) {
  return (
    <div>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>
      ) : (
        <div className="space-y-3">
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
                onClick={() => onToggle(q.id, !q.answered)}
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
    </div>
  );
}

/* ---------- Pré-consultas (Feature 11 + 47) ---------- */
function PreConsultasSection({
  forms,
  onMarkSeen,
  tokenFn,
}: {
  forms: AdminPreConsulta[];
  onMarkSeen: (id: string) => void;
  tokenFn: () => Promise<string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  async function loadReport(userId: string) {
    setReportLoading(true);
    const tk = await tokenFn();
    const res = await getPatientReport({ data: { accessToken: tk, userId } });
    if (res.ok) setReportData(res);
    setReportLoading(false);
  }

  function printReport() {
    window.print();
  }

  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma pré-consulta recebida ainda. As pacientes podem preenchê-la em{" "}
        <strong>Minha Conta → Pré-consulta</strong>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {forms.map((f) => (
        <div
          key={f.id}
          className={`rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] ${!f.seen_by_doctor ? "border-primary/40" : "border-border"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{f.patient_name}</p>
                {!f.seen_by_doctor && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    Nova
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Semana {f.weeks_at_submission ?? "—"} ·{" "}
                {new Date(f.submitted_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setExpandedId((id) => (id === f.id ? null : f.id));
                  if (!f.seen_by_doctor) onMarkSeen(f.id);
                  if (expandedId !== f.id) loadReport(f.user_id);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                {expandedId === f.id ? "Fechar" : "Ver relatório"}
              </button>
            </div>
          </div>

          {/* Quick summary chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {f.symptoms.map((s) => (
              <span key={s} className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                {s}
              </span>
            ))}
            {f.current_weight && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                ⚖️ {f.current_weight} kg
              </span>
            )}
            {f.systolic && f.diastolic && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                💓 {f.systolic}/{f.diastolic}
              </span>
            )}
          </div>

          {f.questions && (
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>Perguntas:</strong> {f.questions}
            </p>
          )}

          {/* Expanded report */}
          {expandedId === f.id && (
            <div className="mt-5 border-t border-border pt-5">
              {reportLoading ? (
                <p className="text-sm text-muted-foreground">Carregando relatório...</p>
              ) : reportData ? (
                <PatientReportView data={reportData} formData={f} onPrint={printReport} />
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PatientReportView({
  data,
  formData,
  onPrint,
}: {
  data: any;
  formData: AdminPreConsulta;
  onPrint: () => void;
}) {
  const { profile, healthLogs, journals, kicks, pendingQuestions } = data;
  const gest = profile
    ? computeGestation({
        lmp: profile.lmp_date,
        referenceDate: profile.reference_date,
        referenceWeeks: profile.reference_weeks,
        referenceDays: profile.reference_days,
      })
    : null;

  const lastLog = healthLogs?.[0];
  const completeSessions = (kicks ?? []).filter((k: any) => k.kick_count >= 10).length;

  return (
    <div className="space-y-5 print:p-8">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl">Relatório Pré-consulta</h3>
        <button
          onClick={onPrint}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary print:hidden"
        >
          🖨️ Imprimir
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <InfoBox label="Paciente" value={profile?.display_name ?? "—"} />
        <InfoBox label="Bebê" value={profile?.baby_name ?? "—"} />
        <InfoBox
          label="IG na pré-consulta"
          value={
            formData.weeks_at_submission
              ? `${formData.weeks_at_submission} semanas`
              : gest
                ? `${gest.weeks}s${gest.days}d`
                : "—"
          }
        />
      </div>

      {/* Vitals */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Sinais Vitais (pré-consulta)
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBox
            label="Peso"
            value={
              formData.current_weight
                ? `${formData.current_weight} kg`
                : lastLog?.weight_kg
                  ? `${lastLog.weight_kg} kg (último reg.)`
                  : "—"
            }
          />
          <InfoBox
            label="Pressão arterial"
            value={
              formData.systolic && formData.diastolic
                ? `${formData.systolic}/${formData.diastolic} mmHg`
                : lastLog?.systolic
                  ? `${lastLog.systolic}/${lastLog.diastolic} mmHg (último reg.)`
                  : "—"
            }
          />
          <InfoBox label="Estado emocional" value={formData.emotional_state ?? "—"} />
        </div>
      </div>

      {/* Symptoms */}
      {formData.symptoms.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Sintomas relatados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {formData.symptoms.map((s: string) => (
              <span key={s} className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Medications */}
      {formData.medications && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1">
            Medicamentos em uso
          </p>
          <p className="text-sm">{formData.medications}</p>
        </div>
      )}

      {/* Questions */}
      {(formData.questions || pendingQuestions?.length > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Perguntas para o médico
          </p>
          {formData.questions && (
            <p className="text-sm mb-2 rounded-lg bg-primary/5 p-3">{formData.questions}</p>
          )}
          {pendingQuestions?.map((q: any) => (
            <p key={q.id} className="text-sm mb-1 text-muted-foreground">
              • {q.question}
            </p>
          ))}
        </div>
      )}

      {/* Activity summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Atividade nas últimas 2 semanas
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBox label="Registros de saúde" value={String(healthLogs?.length ?? 0)} />
          <InfoBox label="Entradas no diário" value={String(journals?.length ?? 0)} />
          <InfoBox label="Sessões de chutes completas" value={String(completeSessions)} />
        </div>
      </div>

      {formData.other_notes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1">
            Observações adicionais
          </p>
          <p className="text-sm">{formData.other_notes}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Engajamento (Feature 46) ---------- */
function EngagementSection({
  engagement,
  onRefresh,
  tokenFn,
}: {
  engagement: {
    totalPatients: number;
    activeLastWeek: number;
    inactiveLastWeek: number;
    unseenPreConsultas: number;
    patients: PatientEngagement[];
  } | null;
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [reportData, setReportData] = useState<Record<string, any>>({});
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadPatientReport(userId: string) {
    if (reportData[userId]) {
      setExpandedId((id) => (id === userId ? null : userId));
      return;
    }
    setLoadingReport(userId);
    const tk = await tokenFn();
    const res = await getPatientReport({ data: { accessToken: tk, userId } });
    if (res.ok) setReportData((d) => ({ ...d, [userId]: res }));
    setLoadingReport(null);
    setExpandedId(userId);
  }

  if (!engagement) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-3">Clique para carregar o dashboard.</p>
        <button
          onClick={onRefresh}
          className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground"
        >
          Carregar dados
        </button>
      </div>
    );
  }

  const { totalPatients, activeLastWeek, inactiveLastWeek, unseenPreConsultas, patients } =
    engagement;
  const inactivePatients = patients.filter((p) => !p.isActive);
  const activePatients = patients.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Últimos 7 dias</p>
        <button onClick={onRefresh} className="text-xs text-primary hover:underline">
          ↺ Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total de pacientes" value={totalPatients} />
        <Stat label="Ativas (7 dias)" value={activeLastWeek} highlight={activeLastWeek > 0} />
        <Stat label="Inativas (7 dias)" value={inactiveLastWeek} highlight={inactiveLastWeek > 0} />
        <Stat
          label="Pré-consultas novas"
          value={unseenPreConsultas}
          highlight={unseenPreConsultas > 0}
        />
      </div>

      {/* Inactive patients - need attention */}
      {inactivePatients.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">
            Sem atividade há mais de 7 dias ({inactivePatients.length})
          </p>
          <div className="space-y-2">
            {inactivePatients.map((p) => {
              const gest = computeGestation({
                lmp: p.lmp_date,
                referenceDate: p.reference_date,
                referenceWeeks: p.reference_weeks,
                referenceDays: p.reference_days,
              });
              return (
                <div key={p.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.display_name ?? "Paciente sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {gest
                          ? `${gest.weeks}s${gest.days}d de gestação`
                          : "Sem dados gestacionais"}
                        {p.lastActivityAt &&
                          ` · Último acesso: ${new Date(p.lastActivityAt).toLocaleDateString("pt-BR")}`}
                        {!p.lastActivityAt && " · Nunca acessou"}
                      </p>
                    </div>
                    <button
                      onClick={() => loadPatientReport(p.id)}
                      disabled={loadingReport === p.id}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {loadingReport === p.id ? "..." : "Ver relatório"}
                    </button>
                  </div>
                  {expandedId === p.id && reportData[p.id] && (
                    <div className="mt-4 border-t border-amber-200 pt-4">
                      <EngagementReportSnippet data={reportData[p.id]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active patients */}
      {activePatients.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
            Ativas nos últimos 7 dias ({activePatients.length})
          </p>
          <div className="space-y-2">
            {activePatients.map((p) => {
              const gest = computeGestation({
                lmp: p.lmp_date,
                referenceDate: p.reference_date,
                referenceWeeks: p.reference_weeks,
                referenceDays: p.reference_days,
              });
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{p.display_name ?? "Paciente"}</p>
                        {p.hasUnseenForm && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                            Pré-consulta nova
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {gest ? `${gest.weeks}s${gest.days}d` : "Sem dados gestacionais"}
                        {p.baby_name && ` · ${p.baby_name}`}
                        {p.lastActivityAt &&
                          ` · Último acesso: ${new Date(p.lastActivityAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <button
                      onClick={() => loadPatientReport(p.id)}
                      disabled={loadingReport === p.id}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {loadingReport === p.id ? "..." : "Ver relatório"}
                    </button>
                  </div>
                  {expandedId === p.id && reportData[p.id] && (
                    <div className="mt-4 border-t border-emerald-200 pt-4">
                      <EngagementReportSnippet data={reportData[p.id]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EngagementReportSnippet({ data }: { data: any }) {
  const { healthLogs, journals, kicks, pendingQuestions, latestPreConsulta } = data;
  const lastLog = healthLogs?.[0];
  return (
    <div className="grid gap-3 sm:grid-cols-4 text-sm">
      <InfoBox label="Último peso" value={lastLog?.weight_kg ? `${lastLog.weight_kg} kg` : "—"} />
      <InfoBox
        label="Última PA"
        value={lastLog?.systolic ? `${lastLog.systolic}/${lastLog.diastolic}` : "—"}
      />
      <InfoBox label="Entradas no diário" value={String(journals?.length ?? 0)} />
      <InfoBox label="Perguntas pendentes" value={String(pendingQuestions?.length ?? 0)} />
      {latestPreConsulta && (
        <div className="sm:col-span-4 rounded-lg bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary mb-1">Última pré-consulta</p>
          {latestPreConsulta.questions && (
            <p className="text-muted-foreground">{latestPreConsulta.questions}</p>
          )}
          {latestPreConsulta.symptoms?.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              Sintomas: {latestPreConsulta.symptoms.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Shared components ---------- */
function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center shadow-[var(--shadow-card)] ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
    >
      <p className={`font-serif text-3xl ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/* ---------- Teleconsultas ---------- */

function TeleconsultasSection({
  sessions,
  onRefresh,
  tokenFn,
  patients,
}: {
  sessions: TeleconsultaSession[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
  patients: import("@/lib/admin.functions").PatientEngagement[];
}) {
  const [form, setForm] = useState({ patientUserId: "", scheduledFor: "", doctorNotes: "" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const STATUS_LABEL_TC: Record<string, string> = {
    agendada: "Agendada",
    sala_aberta: "Sala aberta",
    encerrada: "Encerrada",
  };
  const STATUS_STYLE_TC: Record<string, string> = {
    agendada: "bg-amber-100 text-amber-700",
    sala_aberta: "bg-emerald-100 text-emerald-700",
    encerrada: "bg-secondary text-muted-foreground",
  };

  async function openRoom(id: string) {
    const tk = await tokenFn();
    await updateTeleconsultaStatus({ data: { accessToken: tk, id, status: "sala_aberta" } });
    onRefresh();
  }

  async function closeRoom(id: string) {
    const tk = await tokenFn();
    await updateTeleconsultaStatus({ data: { accessToken: tk, id, status: "encerrada" } });
    onRefresh();
  }

  async function create() {
    if (!form.patientUserId) return;
    setCreating(true);
    const tk = await tokenFn();
    await createTeleconsulta({
      data: {
        accessToken: tk,
        patientUserId: form.patientUserId,
        scheduledFor: form.scheduledFor || null,
        doctorNotes: form.doctorNotes || null,
      },
    });
    setCreating(false);
    setShowForm(false);
    setForm({ patientUserId: "", scheduledFor: "", doctorNotes: "" });
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-serif text-2xl">Teleconsultas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie salas de teleconsulta e abra a sala para as pacientes entrarem.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          + Agendar
        </button>
      </div>

      {showForm && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <p className="font-serif text-lg">Nova teleconsulta</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paciente
              </label>
              <select
                value={form.patientUserId}
                onChange={(e) => setForm((f) => ({ ...f, patientUserId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione a paciente...</option>
                {patients.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.displayName ?? p.email ?? p.userId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data e hora
              </label>
              <input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Observações para a paciente
            </label>
            <input
              type="text"
              value={form.doctorNotes}
              onChange={(e) => setForm((f) => ({ ...f, doctorNotes: e.target.value }))}
              placeholder="Ex: Trazer resultados dos últimos exames"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={create}
            disabled={creating || !form.patientUserId}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {creating ? "Criando..." : "Criar teleconsulta"}
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Nenhuma teleconsulta cadastrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{s.patient_name ?? "Paciente"}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.scheduled_for
                      ? new Date(s.scheduled_for).toLocaleString("pt-BR", {
                          dateStyle: "long",
                          timeStyle: "short",
                        })
                      : "Horário a definir"}
                  </p>
                  {s.doctor_notes && (
                    <p className="mt-1 text-xs text-muted-foreground">{s.doctor_notes}</p>
                  )}
                  {s.patient_notes && (
                    <p className="mt-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs italic text-muted-foreground">
                      Notas da paciente: {s.patient_notes}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE_TC[s.status]}`}
                >
                  {STATUS_LABEL_TC[s.status]}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {s.status === "agendada" && (
                  <button
                    onClick={() => openRoom(s.id)}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    🟢 Abrir sala agora
                  </button>
                )}
                {s.status === "sala_aberta" && (
                  <>
                    <a
                      href={`https://meet.jit.si/drclovis-${s.room_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                    >
                      🎥 Entrar na sala
                    </a>
                    <button
                      onClick={() => closeRoom(s.id)}
                      className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary"
                    >
                      Encerrar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Consultas Pagas ---------- */
function ConsultasPagasSection({
  consultations,
  onRefresh,
  tokenFn,
}: {
  consultations: any[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleConfirm(id: string, status: "confirmado" | "realizado" | "cancelado") {
    setUpdatingId(id);
    const tk = await tokenFn();
    await confirmPaymentAdmin({ data: { accessToken: tk, id, status } });
    onRefresh();
    setUpdatingId(null);
  }

  const statusColors: Record<string, string> = {
    pendente_pagamento: "bg-amber-50 border-amber-200",
    pagamento_enviado: "bg-blue-50 border-blue-200",
    confirmado: "bg-green-50 border-green-200",
    realizado: "bg-secondary border-border",
    cancelado: "bg-red-50 border-red-200",
  };
  const statusLabels: Record<string, string> = {
    pendente_pagamento: "⏳ Aguardando pagamento",
    pagamento_enviado: "💸 Pagamento enviado",
    confirmado: "✅ Confirmado",
    realizado: "🏁 Realizado",
    cancelado: "❌ Cancelado",
  };

  if (consultations.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Nenhuma consulta particular solicitada ainda.</p>
    );

  return (
    <div className="space-y-3">
      {consultations.map((c: any) => {
        const typeInfo = PRIVATE_CONSULT_TYPES.find((t) => t.key === c.consult_type);
        const color = statusColors[c.status] ?? "bg-card border-border";
        return (
          <div key={c.id} className={`rounded-2xl border p-5 ${color}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">
                  {c.patient_profiles?.display_name ?? "Paciente"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeInfo?.label ?? c.consult_type} · {typeInfo?.price ?? ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs mt-1">{statusLabels[c.status] ?? c.status}</p>
                {c.preferred_dates?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Datas sugeridas:{" "}
                    {c.preferred_dates
                      .map((d: string) => new Date(d).toLocaleString("pt-BR"))
                      .join(", ")}
                  </p>
                )}
                {c.message && (
                  <p className="text-xs mt-0.5 italic text-muted-foreground">"{c.message}"</p>
                )}
              </div>
              {c.status === "pagamento_enviado" && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => handleConfirm(c.id, "confirmado")}
                    disabled={updatingId === c.id}
                    className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    ✓ Confirmar
                  </button>
                  <button
                    onClick={() => handleConfirm(c.id, "cancelado")}
                    disabled={updatingId === c.id}
                    className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40"
                  >
                    × Cancelar
                  </button>
                </div>
              )}
              {c.status === "confirmado" && (
                <button
                  onClick={() => handleConfirm(c.id, "realizado")}
                  disabled={updatingId === c.id}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Marcar realizada
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Empresas ---------- */
function EmpresasSection({
  leads,
  accounts,
  onRefresh,
  tokenFn,
}: {
  leads: CorporateLead[];
  accounts: CorporateAccount[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPlan, setNewPlan] = useState<"basico" | "standard" | "premium">("basico");
  const [newSeats, setNewSeats] = useState("10");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const PLANS = { basico: "Básico (10)", standard: "Standard (50)", premium: "Premium (100)" };

  async function handleCreateAccount() {
    setCreating(true);
    const tk = await tokenFn();
    await createCorporateAccountAdmin({
      data: {
        accessToken: tk,
        companyName: newCompany,
        contactEmail: newEmail,
        planType: newPlan,
        maxSeats: Number(newSeats) || 10,
        notes: newNotes || null,
      },
    });
    setShowCreateForm(false);
    setNewCompany("");
    setNewEmail("");
    setNewNotes("");
    onRefresh();
    setCreating(false);
  }

  async function handleLeadStatus(id: string, status: string) {
    setUpdatingLeadId(id);
    const tk = await tokenFn();
    await updateLeadStatusAdmin({ data: { accessToken: tk, id, status } });
    onRefresh();
    setUpdatingLeadId(null);
  }

  const leadStatusColors: Record<string, string> = {
    novo: "bg-blue-50 border-blue-200",
    em_contato: "bg-amber-50 border-amber-200",
    convertido: "bg-green-50 border-green-200",
    descartado: "bg-secondary border-border opacity-60",
  };

  return (
    <div className="space-y-8">
      {/* Active accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Contas corporativas ativas</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white"
          >
            + Nova conta
          </button>
        </div>

        {showCreateForm && (
          <div className="rounded-2xl border border-border bg-card p-5 mb-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Empresa *</label>
                <input
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">E-mail de contato *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Plano</label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as any)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                >
                  {Object.entries(PLANS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vagas (max)</label>
                <input
                  type="number"
                  value={newSeats}
                  onChange={(e) => setNewSeats(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notas internas</label>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateAccount}
                disabled={creating || !newCompany || !newEmail}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {creating ? "Criando..." : "Criar conta"}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-full border border-border px-4 py-1.5 text-xs font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta corporativa criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{acc.company_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {acc.contact_email} ·{" "}
                      {PLANS[acc.plan_type as keyof typeof PLANS] ?? acc.plan_type}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Vagas: {acc.max_seats}</p>
                    {acc.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{acc.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-mono font-bold text-primary">
                      {acc.access_code}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">código de acesso</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leads */}
      <div>
        <h3 className="font-semibold mb-4">
          Leads / Solicitações de demonstração ({leads.length})
        </h3>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`rounded-2xl border p-4 ${leadStatusColors[lead.status] ?? "bg-card border-border"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{lead.company_name}</p>
                    <p className="text-xs">
                      {lead.contact_name} · {lead.contact_email}
                    </p>
                    {lead.contact_phone && (
                      <p className="text-xs text-muted-foreground">{lead.contact_phone}</p>
                    )}
                    {lead.employee_count && (
                      <p className="text-xs text-muted-foreground">{lead.employee_count}</p>
                    )}
                    {lead.message && <p className="text-xs mt-1 italic">"{lead.message}"</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {lead.status === "novo" && (
                      <>
                        <button
                          onClick={() => handleLeadStatus(lead.id, "em_contato")}
                          disabled={updatingLeadId === lead.id}
                          className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Em contato
                        </button>
                        <button
                          onClick={() => handleLeadStatus(lead.id, "convertido")}
                          disabled={updatingLeadId === lead.id}
                          className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Convertido
                        </button>
                        <button
                          onClick={() => handleLeadStatus(lead.id, "descartado")}
                          disabled={updatingLeadId === lead.id}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground disabled:opacity-40"
                        >
                          Descartar
                        </button>
                      </>
                    )}
                    {lead.status === "em_contato" && (
                      <button
                        onClick={() => handleLeadStatus(lead.id, "convertido")}
                        disabled={updatingLeadId === lead.id}
                        className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Marcar convertido
                      </button>
                    )}
                    {(lead.status === "convertido" || lead.status === "descartado") && (
                      <span className="text-xs font-medium capitalize">
                        {lead.status === "convertido" ? "✅ Convertido" : "✗ Descartado"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Calendário (week view) ---------- */
const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function CalendárioSection({
  appointments,
  onNavigate,
}: {
  appointments: AdminAppointment[];
  onNavigate: (tab: PanelTab) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function goToday() {
    setWeekStart(getWeekStart(new Date()));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const confirmedAppts = appointments.filter(
    (a) => a.status === "confirmed" && (a as any).confirmed_date,
  );

  function getAppts(day: Date) {
    const iso = day.toISOString().slice(0, 10);
    return confirmedAppts
      .filter((a) => (a as any).confirmed_date === iso)
      .sort((a, b) =>
        ((a as any).confirmed_time ?? "").localeCompare((b as any).confirmed_time ?? ""),
      );
  }

  const today = new Date().toISOString().slice(0, 10);

  const weekLabel = `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            ← Anterior
          </button>
          <button
            onClick={goToday}
            className="rounded-full border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary"
          >
            Hoje
          </button>
          <button
            onClick={nextWeek}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            Próxima →
          </button>
        </div>
        <p className="text-sm font-medium">{weekLabel}</p>
        <button
          onClick={() => onNavigate("Agendamentos")}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Ver todos
        </button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day, i) => {
          const iso = day.toISOString().slice(0, 10);
          const isToday = iso === today;
          const dayAppts = getAppts(day);
          return (
            <div
              key={i}
              className={`rounded-2xl border p-2 min-h-[120px] flex flex-col gap-1.5 ${isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="text-center">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}
                >
                  {DOW_LABELS[i]}
                </p>
                <p className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>
                  {day.getDate()}
                </p>
              </div>
              {dayAppts.map((a) => (
                <div
                  key={a.id}
                  title={`${a.patient_name} — ${(a as any).confirmed_time}`}
                  className="rounded-lg bg-primary/10 px-1.5 py-1 text-[10px] leading-tight text-primary truncate"
                >
                  <span className="font-medium">{(a as any).confirmed_time}</span>{" "}
                  {a.patient_name.split(" ")[0]}
                </div>
              ))}
              {dayAppts.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center mt-1">—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming confirmed list */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
          Próximas confirmadas
        </p>
        {confirmedAppts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma consulta confirmada com data definida.
          </p>
        ) : (
          <div className="space-y-2">
            {confirmedAppts
              .filter((a) => (a as any).confirmed_date >= today)
              .sort((a, b) => {
                const da = `${(a as any).confirmed_date}T${(a as any).confirmed_time ?? "00:00"}`;
                const db = `${(b as any).confirmed_date}T${(b as any).confirmed_time ?? "00:00"}`;
                return da.localeCompare(db);
              })
              .slice(0, 10)
              .map((a) => {
                const ext = a as any;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-2.5"
                  >
                    <div className="text-center min-w-[48px]">
                      <p className="text-sm font-bold text-primary">
                        {new Date(ext.confirmed_date + "T00:00:00").getDate()}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR", {
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ext.confirmed_time} · {a.reason}
                      </p>
                    </div>
                    {ext.price_brl && (
                      <p
                        className={`text-xs font-medium shrink-0 ${ext.payment_status === "pago" ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {ext.payment_status === "pago" ? "✓ " : ""}R${" "}
                        {(ext.price_brl / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Agenda (availability config) ---------- */
interface DoctorAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  enabled: boolean;
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

function AgendaSection() {
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [avail, blocked] = await Promise.all([
      (supabase as any).from("doctor_availability").select("*").order("day_of_week"),
      (supabase as any).from("blocked_dates").select("*").order("date"),
    ]);
    if (avail.data) setAvailability(avail.data);
    if (blocked.data) setBlockedDates(blocked.data);
    setLoading(false);
  }

  async function saveAvailability(row: DoctorAvailability) {
    setSaving(true);
    await (supabase as any)
      .from("doctor_availability")
      .update({
        start_time: row.start_time,
        end_time: row.end_time,
        slot_minutes: row.slot_minutes,
        enabled: row.enabled,
      })
      .eq("id", row.id);
    setSaving(false);
  }

  function updateRow(idx: number, patch: Partial<DoctorAvailability>) {
    setAvailability((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      return next;
    });
  }

  async function addBlockedDate() {
    if (!newBlockDate) return;
    setAddingBlock(true);
    const { data } = await (supabase as any)
      .from("blocked_dates")
      .insert({ date: newBlockDate, reason: newBlockReason || null })
      .select()
      .single();
    if (data)
      setBlockedDates((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
    setNewBlockDate("");
    setNewBlockReason("");
    setAddingBlock(false);
  }

  async function removeBlockedDate(id: string) {
    await (supabase as any).from("blocked_dates").delete().eq("id", id);
    setBlockedDates((prev) => prev.filter((b) => b.id !== id));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-8">
      {/* Availability per day */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-serif text-xl">Disponibilidade semanal</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure os dias e horários de atendimento. Salve cada linha individualmente.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {availability.map((row, idx) => (
            <div
              key={row.id}
              className={`rounded-2xl border p-4 transition-colors ${row.enabled ? "border-border bg-card" : "border-dashed border-border bg-secondary/30"}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 w-28">
                  <button
                    onClick={() => updateRow(idx, { enabled: !row.enabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${row.enabled ? "bg-primary" : "bg-muted"}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${row.enabled ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                  <span
                    className={`text-sm font-medium w-8 ${row.enabled ? "" : "text-muted-foreground"}`}
                  >
                    {DOW_LABELS[row.day_of_week]}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Início</label>
                    <input
                      type="time"
                      disabled={!row.enabled}
                      value={row.start_time}
                      onChange={(e) => updateRow(idx, { start_time: e.target.value })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Fim</label>
                    <input
                      type="time"
                      disabled={!row.enabled}
                      value={row.end_time}
                      onChange={(e) => updateRow(idx, { end_time: e.target.value })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      Duração (min)
                    </label>
                    <select
                      disabled={!row.enabled}
                      value={row.slot_minutes}
                      onChange={(e) => updateRow(idx, { slot_minutes: Number(e.target.value) })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs disabled:opacity-40"
                    >
                      {[15, 20, 30, 45, 60].map((v) => (
                        <option key={v} value={v}>
                          {v} min
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => saveAvailability(row)}
                    disabled={saving}
                    className="self-end rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
                {row.enabled && (
                  <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
                    {Math.floor(
                      (timeToMins(row.end_time) - timeToMins(row.start_time)) / row.slot_minutes,
                    )}{" "}
                    slots/dia
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked dates */}
      <div>
        <p className="font-serif text-xl mb-1">Datas bloqueadas</p>
        <p className="text-sm text-muted-foreground mb-4">
          Férias, feriados ou dias sem atendimento.
        </p>

        {/* Add form */}
        <div className="flex flex-wrap gap-2 mb-4 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-0.5">Data *</label>
            <input
              type="date"
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-0.5">Motivo (opcional)</label>
            <input
              placeholder="Ex: Férias"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm w-44"
            />
          </div>
          <button
            onClick={addBlockedDate}
            disabled={addingBlock || !newBlockDate}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            {addingBlock ? "..." : "+ Bloquear data"}
          </button>
        </div>

        {blockedDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma data bloqueada.</p>
        ) : (
          <div className="space-y-1.5">
            {blockedDates.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium">
                    {new Date(b.date + "T00:00:00").toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {b.reason && <span className="text-xs text-muted-foreground">{b.reason}</span>}
                </div>
                <button
                  onClick={() => removeBlockedDate(b.id)}
                  className="rounded-full border border-rose-300 px-2.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* ---------- Receipt Modal ---------- */
import { DOCTOR } from "@/lib/doctor.config";

function ReceiptModal({ appt, onClose }: { appt: AdminAppointment; onClose: () => void }) {
  const ext = appt as any;
  const printRef = useRef<HTMLDivElement>(null);
  const receiptDate = ext.confirmed_date
    ? new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date(appt.preferred_date + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
  const receiptTime = ext.confirmed_time ?? appt.preferred_time;
  const receiptNumber = appt.id.slice(0, 8).toUpperCase();
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document
      .write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Recibo de Consulta</title><style>
      body { font-family: Georgia, serif; max-width: 640px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; }
      h1 { font-size: 22px; margin: 0; }
      p { margin: 4px 0; }
      .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #666; margin-top: 16px; }
      .value { font-size: 14px; }
      hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
      .total { font-size: 22px; font-weight: bold; }
      .footer { font-size: 11px; color: #999; text-align: center; margin-top: 40px; }
      .sig { margin-top: 60px; border-top: 1px solid #999; width: 200px; padding-top: 6px; font-size: 11px; color: #666; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <p className="text-sm font-medium text-muted-foreground">Recibo #{receiptNumber}</p>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
            >
              🖨 Imprimir
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Receipt content */}
        <div ref={printRef} className="px-8 py-6">
          {/* Header */}
          <div className="border-b border-gray-200 pb-5 mb-5">
            <h1 className="font-serif text-2xl text-gray-900">{DOCTOR.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{DOCTOR.title}</p>
            <p className="text-xs text-gray-400">
              {DOCTOR.crm} · {DOCTOR.rqe}
            </p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Recibo de Consulta
          </p>
          <p className="text-xs text-gray-400">
            Nº {receiptNumber} · Emitido em {today}
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Paciente
              </p>
              <p className="text-sm text-gray-800">{appt.patient_name}</p>
              {appt.patient_phone && <p className="text-xs text-gray-500">{appt.patient_phone}</p>}
              {appt.patient_email && <p className="text-xs text-gray-500">{appt.patient_email}</p>}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Data e horário
              </p>
              <p className="text-sm text-gray-800">
                {receiptDate} às {receiptTime}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Descrição
              </p>
              <p className="text-sm text-gray-800">Consulta de {DOCTOR.title}</p>
              <p className="text-xs text-gray-500">{appt.reason}</p>
            </div>
          </div>

          {ext.price_brl ? (
            <div className="mt-5 flex items-baseline justify-between rounded-xl bg-gray-50 px-4 py-3 border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</p>
              <div className="text-right">
                <p className="font-serif text-2xl font-bold text-gray-900">
                  R$ {(ext.price_brl / 100).toFixed(2).replace(".", ",")}
                </p>
                {ext.payment_status === "pago" && (
                  <p className="text-xs font-medium text-emerald-600">✓ Pago</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-400">Valor a definir</p>
            </div>
          )}

          {/* Signature */}
          <div className="mt-10 flex justify-end">
            <div className="text-center">
              <div className="h-12 border-b border-gray-400 w-48" />
              <p className="text-xs text-gray-500 mt-1">{DOCTOR.name}</p>
              <p className="text-[10px] text-gray-400">{DOCTOR.crm}</p>
            </div>
          </div>

          <p className="mt-8 text-center text-[10px] text-gray-300">
            Este documento não tem validade fiscal. Para nota fiscal, consulte a recepção.
          </p>
        </div>
      </div>
    </div>
  );
}
