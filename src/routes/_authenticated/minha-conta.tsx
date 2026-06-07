import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { babyForWeek, computeGestation, dueDateFromLmp } from "@/lib/gestacao";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Dr. Clóvis Bacha" },
      { name: "description", content: "Acompanhe semana a semana o desenvolvimento do seu bebê." },
    ],
  }),
  component: MinhaContaPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  baby_name: string | null;
  lmp_date: string | null;
  due_date: string | null;
  reference_date: string | null;
  reference_weeks: number | null;
  reference_days: number | null;
  blood_type?: string | null;
  allergies?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
};

type JournalEntry = { id: string; entry_date: string; mood: string | null; content: string; created_at: string };
type KickSession = { id: string; started_at: string; ended_at: string | null; kick_count: number };
type ChecklistItem = { id: string; category: string; label: string; done: boolean };

type HealthLog = { id: string; log_date: string; weight_kg: number | null; systolic: number | null; diastolic: number | null; notes: string | null };
type DoctorQ = { id: string; question: string; answered: boolean; created_at: string };
type Invite = { id: string; token: string; companion_name: string | null; created_at: string };

const TABS = ["Bebê", "Diário", "Chutes", "Saúde", "Perguntas", "Checklist", "Acompanhante", "Carteirinha", "Chat IA", "Perfil"] as const;
type Tab = typeof TABS[number];

function MinhaContaPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Bebê");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await (supabase as any)
        .from("patient_profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      setProfile(data);
      setLoading(false);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (loading) return <div className="mx-auto max-w-5xl px-5 py-20 text-center text-muted-foreground">Carregando...</div>;

  const gest = profile
    ? computeGestation({
        lmp: profile.lmp_date,
        referenceDate: profile.reference_date,
        referenceWeeks: profile.reference_weeks,
        referenceDays: profile.reference_days,
      })
    : null;

  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Minha conta</p>
          <h1 className="mt-2 font-serif text-3xl md:text-4xl">
            Olá, {profile?.display_name ?? "mamãe"} 💛
          </h1>
          {profile?.baby_name && (
            <p className="mt-1 text-sm text-muted-foreground">Acompanhando {profile.baby_name}</p>
          )}
        </div>
        <button onClick={signOut} className="text-xs text-muted-foreground hover:text-primary">Sair</button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "Bebê" && <BabyTab profile={profile} gest={gest} />}
        {tab === "Diário" && <JournalTab />}
        {tab === "Chutes" && <KicksTab />}
        {tab === "Saúde" && <HealthTab />}
        {tab === "Perguntas" && <QuestionsTab />}
        {tab === "Checklist" && <ChecklistTab />}
        {tab === "Acompanhante" && <CompanionTab />}
        {tab === "Carteirinha" && <CardTab profile={profile} gest={gest} />}
        {tab === "Chat IA" && <ChatTab />}
        {tab === "Perfil" && <ProfileTab profile={profile} onSaved={setProfile} />}
      </div>
    </section>
  );
}

/* ---------- Bebê ---------- */
function BabyTab({ profile, gest }: { profile: Profile | null; gest: ReturnType<typeof computeGestation> }) {
  if (!profile || !gest) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Configure a data da sua última menstruação ou os dados do ultrassom em <strong>Perfil</strong> para começar o acompanhamento.
        </p>
      </div>
    );
  }
  const baby = babyForWeek(gest.weeks);
  const trimestre = gest.weeks < 14 ? "1º trimestre" : gest.weeks < 28 ? "2º trimestre" : "3º trimestre";
  const progress = Math.min(100, (gest.totalDays / 280) * 100);
  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  const daysToDue = due ? Math.max(0, Math.ceil((new Date(due + "T00:00:00").getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">{trimestre}</p>
        <h2 className="mt-2 font-serif text-4xl">
          {gest.weeks} <span className="text-2xl text-muted-foreground">semanas</span>
          {gest.days > 0 && <span className="ml-2 text-xl text-muted-foreground">e {gest.days}d</span>}
        </h2>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {progress.toFixed(0)}% da jornada {daysToDue != null && `· faltam ${daysToDue} dias`}
        </p>

        <div className="mt-6 rounded-2xl bg-[var(--gradient-warm)] p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Esta semana</p>
          <p className="mt-2 font-serif text-2xl text-primary">{baby.size}</p>
          <p className="text-sm text-muted-foreground">Peso aproximado: {baby.weight}</p>
          <p className="mt-1 text-sm text-muted-foreground">Tamanho de: {baby.fruit}</p>
          <p className="mt-4 text-sm leading-relaxed text-foreground">{baby.desc}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">DPP — Data provável do parto</p>
          <p className="mt-2 font-serif text-2xl">
            {due ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Próxima consulta</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {gest.weeks < 28
              ? "Consultas mensais — agende sua próxima visita."
              : gest.weeks < 36
                ? "Consultas quinzenais a partir de agora."
                : "Consultas semanais — acompanhamento próximo."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Diário ---------- */
function JournalTab() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("😊");

  async function load() {
    const { data } = await (supabase as any)
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });
    setEntries(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!content.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any).from("journal_entries").insert({
      user_id: u.user.id,
      content: content.trim(),
      mood,
    });
    setContent("");
    load();
  }

  async function remove(id: string) {
    await (supabase as any).from("journal_entries").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-sm font-medium">Como você está se sentindo hoje?</p>
        <div className="mt-3 flex gap-2">
          {["😊", "🥰", "😴", "🤢", "😢", "😰"].map((m) => (
            <button key={m} onClick={() => setMood(m)}
              className={`rounded-full px-3 py-2 text-xl ${mood === m ? "bg-primary/15 ring-2 ring-primary" : "bg-secondary"}`}>
              {m}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Escreva uma memória, um pensamento, um sonho..."
          className="mt-4 w-full rounded-md border border-input bg-background p-3 text-sm"
        />
        <button onClick={add} className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          Salvar no diário
        </button>
      </div>

      <div className="space-y-3">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Seu diário começará aqui ✨</p>}
        {entries.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {e.mood} · {new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
              <button onClick={() => remove(e.id)} className="text-xs text-muted-foreground hover:text-destructive">excluir</button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{e.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Chutes ---------- */
function KicksTab() {
  const [active, setActive] = useState<KickSession | null>(null);
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<KickSession[]>([]);
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  async function load() {
    const { data } = await (supabase as any)
      .from("kick_sessions")
      .select("*")
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(10);
    setHistory(data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  async function start() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("kick_sessions")
      .insert({ user_id: u.user.id, kick_count: 0 })
      .select()
      .single();
    setActive(data);
    setCount(0);
    startRef.current = Date.now();
    setElapsed(0);
  }

  async function tap() {
    if (!active) return;
    const next = count + 1;
    setCount(next);
    if (next >= 10) {
      await stop(next);
    }
  }

  async function stop(finalCount = count) {
    if (!active) return;
    await (supabase as any)
      .from("kick_sessions")
      .update({ ended_at: new Date().toISOString(), kick_count: finalCount })
      .eq("id", active.id);
    setActive(null);
    setCount(0);
    load();
  }

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Contador de chutes</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A partir da 28ª semana, conte 10 movimentos. O ideal é sentir 10 em até 2 horas.
        </p>
        {!active ? (
          <button onClick={start} className="mt-6 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground">
            Iniciar sessão
          </button>
        ) : (
          <div className="mt-6">
            <button
              onClick={tap}
              className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95"
            >
              <div>
                <div className="font-serif text-5xl">{count}</div>
                <div className="text-xs uppercase tracking-widest opacity-80">/ 10 chutes</div>
              </div>
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </p>
            <button onClick={() => stop()} className="mt-3 text-xs text-muted-foreground hover:text-destructive">
              Encerrar sessão
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Histórico</p>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>}
          {history.map((s) => {
            const dur = s.ended_at ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000) : 0;
            return (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm">
                <span>{new Date(s.started_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="text-muted-foreground">{s.kick_count} chutes · {dur} min</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Checklist ---------- */
const DEFAULT_ITEMS: { category: string; label: string }[] = [
  { category: "mae", label: "Documentos (RG, CPF, cartão SUS)" },
  { category: "mae", label: "Carteira da gestante" },
  { category: "mae", label: "Camisola com abertura frontal" },
  { category: "mae", label: "Roupão e chinelos" },
  { category: "mae", label: "Itens de higiene pessoal" },
  { category: "bebe", label: "5 bodies tamanho RN" },
  { category: "bebe", label: "5 macacões / mijões" },
  { category: "bebe", label: "Fraldas RN (1 pacote)" },
  { category: "bebe", label: "Manta de algodão" },
  { category: "bebe", label: "Saída de maternidade" },
  { category: "acompanhante", label: "Trocas de roupa" },
  { category: "acompanhante", label: "Lanches e água" },
  { category: "acompanhante", label: "Carregador de celular" },
];

function ChecklistTab() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("mae");

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("checklist_items")
      .select("*")
      .order("created_at", { ascending: true });
    if (!data || data.length === 0) {
      // seed defaults on first load
      const seed = DEFAULT_ITEMS.map((d) => ({ ...d, user_id: u.user!.id, done: false }));
      await (supabase as any).from("checklist_items").insert(seed);
      const { data: again } = await (supabase as any)
        .from("checklist_items")
        .select("*")
        .order("created_at", { ascending: true });
      setItems(again ?? []);
    } else {
      setItems(data);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggle(it: ChecklistItem) {
    await (supabase as any).from("checklist_items").update({ done: !it.done }).eq("id", it.id);
    setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
  }
  async function add() {
    if (!label.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any).from("checklist_items").insert({ user_id: u.user.id, label: label.trim(), category });
    setLabel("");
    load();
  }
  async function remove(id: string) {
    await (supabase as any).from("checklist_items").delete().eq("id", id);
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  const groups = useMemo(() => {
    const g: Record<string, ChecklistItem[]> = { mae: [], bebe: [], acompanhante: [] };
    items.forEach((it) => {
      (g[it.category] = g[it.category] ?? []).push(it);
    });
    return g;
  }, [items]);

  const labels: Record<string, string> = { mae: "Para a mamãe", bebe: "Para o bebê", acompanhante: "Para o acompanhante" };
  const total = items.length;
  const done = items.filter((i) => i.done).length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Mala da maternidade</p>
        <p className="mt-1 text-sm text-muted-foreground">{done} de {total} itens prontos</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
        </div>
      </div>

      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat} className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">{labels[cat] ?? cat}</p>
          <ul className="mt-3 space-y-1">
            {list.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-secondary/60">
                <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" checked={it.done} onChange={() => toggle(it)} className="h-4 w-4" />
                  <span className={it.done ? "text-muted-foreground line-through" : ""}>{it.label}</span>
                </label>
                <button onClick={() => remove(it.id)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-3xl border border-dashed border-border bg-card p-6">
        <p className="text-sm font-medium">Adicionar item</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="mae">Mamãe</option>
            <option value="bebe">Bebê</option>
            <option value="acompanhante">Acompanhante</option>
          </select>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: protetor de seios"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={add} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Adicionar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Perfil ---------- */
function ProfileTab({ profile, onSaved }: { profile: Profile | null; onSaved: (p: Profile) => void }) {
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    baby_name: profile?.baby_name ?? "",
    lmp_date: profile?.lmp_date ?? "",
    reference_date: profile?.reference_date ?? "",
    reference_weeks: profile?.reference_weeks?.toString() ?? "",
    reference_days: profile?.reference_days?.toString() ?? "",
    blood_type: profile?.blood_type ?? "",
    allergies: profile?.allergies ?? "",
    emergency_contact: profile?.emergency_contact ?? "",
    emergency_phone: profile?.emergency_phone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload: any = {
      id: u.user.id,
      display_name: form.display_name || null,
      baby_name: form.baby_name || null,
      lmp_date: form.lmp_date || null,
      due_date: form.lmp_date ? dueDateFromLmp(form.lmp_date) : null,
      reference_date: form.reference_date || null,
      reference_weeks: form.reference_weeks ? Number(form.reference_weeks) : null,
      reference_days: form.reference_days ? Number(form.reference_days) : null,
      blood_type: form.blood_type || null,
      allergies: form.allergies || null,
      emergency_contact: form.emergency_contact || null,
      emergency_phone: form.emergency_phone || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (supabase as any)
      .from("patient_profiles")
      .upsert(payload)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setMsg(error.message);
    } else {
      onSaved(data);
      setMsg("Salvo com sucesso ✓");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Suas informações</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Seu nome" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
          <Field label="Nome do bebê (opcional)" value={form.baby_name} onChange={(v) => setForm({ ...form, baby_name: v })} />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Idade gestacional</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use a DUM (data da última menstruação) <strong>ou</strong> os dados informados pelo médico no ultrassom.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="DUM — Data da última menstruação" type="date" value={form.lmp_date} onChange={(v) => setForm({ ...form, lmp_date: v })} />
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">— ou —</p>
          <p className="mt-1 text-sm">Idade gestacional informada pelo médico</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field label="Data da consulta/USG" type="date" value={form.reference_date} onChange={(v) => setForm({ ...form, reference_date: v })} />
            <Field label="Semanas" type="number" value={form.reference_weeks} onChange={(v) => setForm({ ...form, reference_weeks: v })} />
            <Field label="Dias" type="number" value={form.reference_days} onChange={(v) => setForm({ ...form, reference_days: v })} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Dados clínicos & emergência</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Tipo sanguíneo (ex: O+)" value={form.blood_type} onChange={(v) => setForm({ ...form, blood_type: v })} />
          <Field label="Alergias" value={form.allergies} onChange={(v) => setForm({ ...form, allergies: v })} />
          <Field label="Contato de emergência" value={form.emergency_contact} onChange={(v) => setForm({ ...form, emergency_contact: v })} />
          <Field label="Telefone de emergência" value={form.emergency_phone} onChange={(v) => setForm({ ...form, emergency_phone: v })} />
        </div>
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}
      <button onClick={save} disabled={saving}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

/* ---------- Saúde (peso + pressão) ---------- */
function HealthTab() {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [form, setForm] = useState({ weight_kg: "", systolic: "", diastolic: "", notes: "" });

  async function load() {
    const { data } = await (supabase as any)
      .from("health_logs").select("*").order("log_date", { ascending: false }).limit(60);
    setLogs(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!form.weight_kg && !form.systolic) return;
    await (supabase as any).from("health_logs").insert({
      user_id: u.user.id,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      systolic: form.systolic ? Number(form.systolic) : null,
      diastolic: form.diastolic ? Number(form.diastolic) : null,
      notes: form.notes || null,
    });
    setForm({ weight_kg: "", systolic: "", diastolic: "", notes: "" });
    load();
  }
  async function remove(id: string) {
    await (supabase as any).from("health_logs").delete().eq("id", id);
    load();
  }

  const last = logs[0];
  const weights = logs.filter((l) => l.weight_kg != null).slice(0, 12).reverse();
  const maxW = Math.max(...weights.map((w) => Number(w.weight_kg)), 1);
  const minW = Math.min(...weights.map((w) => Number(w.weight_kg)), maxW);
  const range = Math.max(maxW - minW, 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Último peso</p>
          <p className="mt-2 font-serif text-3xl">{last?.weight_kg ? `${last.weight_kg} kg` : "—"}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Última PA</p>
          <p className="mt-2 font-serif text-3xl">
            {last?.systolic && last?.diastolic ? `${last.systolic}/${last.diastolic}` : "—"}
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Registros</p>
          <p className="mt-2 font-serif text-3xl">{logs.length}</p>
        </div>
      </div>

      {weights.length > 1 && (
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Evolução do peso</p>
          <svg viewBox="0 0 300 100" className="mt-3 h-32 w-full">
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              points={weights.map((w, i) => {
                const x = (i / (weights.length - 1)) * 300;
                const y = 100 - ((Number(w.weight_kg) - minW) / range) * 80 - 10;
                return `${x},${y}`;
              }).join(" ")}
            />
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">Últimos {weights.length} registros</p>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Novo registro</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Peso (kg)" type="number" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} />
          <Field label="Sistólica" type="number" value={form.systolic} onChange={(v) => setForm({ ...form, systolic: v })} />
          <Field label="Diastólica" type="number" value={form.diastolic} onChange={(v) => setForm({ ...form, diastolic: v })} />
          <Field label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        </div>
        <button onClick={add} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Adicionar</button>
      </div>

      <div className="space-y-2">
        {logs.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm">
            <span className="text-muted-foreground">
              {new Date(l.log_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
            <span className="flex-1 px-3">
              {l.weight_kg && <>⚖️ {l.weight_kg} kg </>}
              {l.systolic && l.diastolic && <> · 💓 {l.systolic}/{l.diastolic}</>}
            </span>
            <button onClick={() => remove(l.id)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Perguntas para o médico ---------- */
function QuestionsTab() {
  const [items, setItems] = useState<DoctorQ[]>([]);
  const [text, setText] = useState("");

  async function load() {
    const { data } = await (supabase as any)
      .from("doctor_questions").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!text.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any).from("doctor_questions").insert({ user_id: u.user.id, question: text.trim() });
    setText("");
    load();
  }
  async function toggle(q: DoctorQ) {
    await (supabase as any).from("doctor_questions").update({ answered: !q.answered }).eq("id", q.id);
    setItems((arr) => arr.map((x) => (x.id === q.id ? { ...x, answered: !x.answered } : x)));
  }
  async function remove(id: string) {
    await (supabase as any).from("doctor_questions").delete().eq("id", id);
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  const pending = items.filter((q) => !q.answered);
  const answered = items.filter((q) => q.answered);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Anote para a próxima consulta</p>
        <p className="mt-1 text-sm text-muted-foreground">Aquela dúvida que sempre esquece na hora — registre aqui.</p>
        <div className="mt-4 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex: posso fazer exercícios físicos?"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={add} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Adicionar</button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Pendentes ({pending.length})
        </p>
        <div className="space-y-2">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta pendente.</p>}
          {pending.map((q) => (
            <div key={q.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <input type="checkbox" checked={q.answered} onChange={() => toggle(q)} className="mt-1 h-4 w-4" />
              <p className="flex-1 text-sm">{q.question}</p>
              <button onClick={() => remove(q.id)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
            </div>
          ))}
        </div>
      </div>

      {answered.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Respondidas ({answered.length})
          </p>
          <div className="space-y-2 opacity-60">
            {answered.map((q) => (
              <div key={q.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <input type="checkbox" checked onChange={() => toggle(q)} className="mt-1 h-4 w-4" />
                <p className="flex-1 text-sm line-through">{q.question}</p>
                <button onClick={() => remove(q.id)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Acompanhante ---------- */
function CompanionTab() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const { data } = await (supabase as any)
      .from("companion_invites").select("*").order("created_at", { ascending: false });
    setInvites(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    await (supabase as any).from("companion_invites").insert({
      user_id: u.user.id, token, companion_name: name || null,
    });
    setName("");
    load();
  }
  async function revoke(id: string) {
    await (supabase as any).from("companion_invites").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Convidar acompanhante</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere um link para o papai, vovó ou alguém especial acompanhar a evolução do bebê (visualização).
        </p>
        <div className="mt-4 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do acompanhante (opcional)"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={create} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">
            Gerar convite
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {invites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum convite ainda.</p>}
        {invites.map((i) => {
          const url = `${window.location.origin}/acompanhar/${i.token}`;
          return (
            <div key={i.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{i.companion_name ?? "Acompanhante"}</p>
                <button onClick={() => revoke(i.id)} className="text-xs text-muted-foreground hover:text-destructive">revogar</button>
              </div>
              <div className="mt-2 flex gap-2">
                <input readOnly value={url} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs" />
                <button onClick={() => navigator.clipboard.writeText(url)}
                  className="rounded-full bg-secondary px-4 py-2 text-xs">Copiar</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Carteirinha digital ---------- */
function CardTab({ profile, gest }: { profile: Profile | null; gest: ReturnType<typeof computeGestation> }) {
  if (!profile) return <p className="text-sm text-muted-foreground">Preencha seu perfil primeiro.</p>;
  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  const qrData = encodeURIComponent(
    `Gestante: ${profile.display_name ?? "—"}\nBebê: ${profile.baby_name ?? "—"}\nIG: ${gest ? `${gest.weeks}s${gest.days}d` : "—"}\nDPP: ${due ?? "—"}\nTipo sanguíneo: ${profile.blood_type ?? "—"}\nAlergias: ${profile.allergies ?? "—"}\nMédico: Dr. Clóvis Bacha`,
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}`;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-3xl bg-[var(--gradient-warm)] p-8 shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Carteirinha digital</p>
        <h2 className="mt-2 font-serif text-2xl">{profile.display_name ?? "—"}</h2>
        {profile.baby_name && <p className="text-sm text-muted-foreground">Bebê: {profile.baby_name}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="IG atual" value={gest ? `${gest.weeks}s ${gest.days}d` : "—"} />
          <Info label="DPP" value={due ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR") : "—"} />
          <Info label="Tipo sanguíneo" value={profile.blood_type ?? "—"} />
          <Info label="Alergias" value={profile.allergies ?? "Nenhuma"} />
          <Info label="Emergência" value={profile.emergency_contact ?? "—"} />
          <Info label="Telefone" value={profile.emergency_phone ?? "—"} />
        </div>

        <div className="mt-6 flex flex-col items-center border-t border-primary/20 pt-5">
          <img src={qrUrl} alt="QR Code de emergência" className="h-44 w-44 rounded-lg bg-white p-2" />
          <p className="mt-2 text-xs text-muted-foreground">Escaneie em caso de emergência</p>
          <p className="mt-3 text-xs font-medium text-primary">Dr. Clóvis Bacha — Ginecologia & Obstetrícia</p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/60 p-3 backdrop-blur">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/* ---------- Chat IA ---------- */
type ChatMsg = { role: "user" | "assistant"; content: string };
function ChatTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Olá! Sou o assistente virtual do consultório. Posso ajudar com dúvidas gerais sobre gestação e agendamento. Como posso ajudar?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const uiMessages = next.map((m, i) => ({
        id: String(i),
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: uiMessages }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages([...next, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        chunk.split("\n").forEach((line) => {
          if (!line.startsWith("data: ")) return;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === "text-delta" && json.delta) acc += json.delta;
          } catch {}
        });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setMessages([...next, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-3xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <p className="font-serif text-lg">Assistente IA</p>
        <p className="text-xs text-muted-foreground">Dúvidas gerais sobre gestação — não substitui consulta médica.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}>
              {m.content || "..."}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Digite sua pergunta..."
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm"
        />
        <button onClick={send} disabled={loading}
          className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-60">
          {loading ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}