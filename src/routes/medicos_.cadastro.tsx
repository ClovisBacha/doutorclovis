import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerDoctor } from "@/lib/doctors.functions";

export const Route = createFileRoute("/medicos_/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta de médico — Plataforma Obstétrica" },
      {
        name: "description",
        content:
          "Crie sua conta de médico: 14 dias grátis, painel completo, Segundo Cérebro de IA e app para suas pacientes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CadastroMedicoPage,
});

type Step = "auth" | "perfil";

function CadastroMedicoPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("auth");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState({
    display_name: "",
    title: "Ginecologista e Obstetra",
    specialty: "",
    crm: "",
    whatsapp: "",
    pix_key: "",
  });

  // Já logado? Pula direto para o perfil profissional
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStep("perfil");
    });
  }, []);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Informe e-mail e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          // Conta já existe → tenta entrar
          const { error: loginErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (loginErr) {
            toast.error(
              error.message.includes("already")
                ? "E-mail já cadastrado — confira a senha."
                : error.message,
            );
            return;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error("E-mail ou senha incorretos.");
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.success("Confira seu e-mail para confirmar a conta e volte para continuar.");
        return;
      }
      setStep("perfil");
    } finally {
      setBusy(false);
    }
  }

  async function submitPerfil(e: React.FormEvent) {
    e.preventDefault();
    if (profile.display_name.trim().length < 2 || !profile.crm.trim()) {
      toast.error("Nome e CRM são obrigatórios.");
      return;
    }
    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Sessão expirada — entre novamente.");
        setStep("auth");
        return;
      }
      const res = await registerDoctor({
        data: { accessToken: s.session.access_token, profile },
      });
      if (!res.ok) {
        toast.error("Não foi possível criar seu perfil. Tente novamente.");
        return;
      }
      toast.success("Bem-vindo(a)! Seu consultório digital está pronto. 🎉");
      navigate({ to: "/painel" });
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary";
  const label = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <main className="min-h-[70vh] bg-[var(--gradient-warm)] px-5 py-16">
      <div className="mx-auto max-w-md">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Para médicos
        </p>
        <h1 className="mt-2 text-center font-serif text-3xl">
          {step === "auth" ? "Crie sua conta" : "Seu perfil profissional"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {step === "auth"
            ? "14 dias grátis · sem cartão de crédito · cancele quando quiser"
            : "É com esses dados que suas pacientes vão te encontrar."}
        </p>

        {/* Etapas */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold">
          <span
            className={`rounded-full px-3 py-1 ${step === "auth" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}
          >
            1. Conta
          </span>
          <span className="h-px w-6 bg-border" />
          <span
            className={`rounded-full px-3 py-1 ${step === "perfil" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            2. Perfil médico
          </span>
        </div>

        {step === "auth" ? (
          <form
            onSubmit={submitAuth}
            className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <div>
              <label className={label}>E-mail profissional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@clinica.com.br"
                className={input}
                autoComplete="email"
              />
            </div>
            <div>
              <label className={label}>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={input}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="press glow-cta w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Aguarde..." : mode === "signup" ? "Criar conta grátis" : "Entrar"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              {mode === "signup" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                className="font-semibold text-primary hover:underline"
              >
                {mode === "signup" ? "Entrar" : "Criar conta"}
              </button>
            </p>
          </form>
        ) : (
          <form
            onSubmit={submitPerfil}
            className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <div>
              <label className={label}>Nome completo *</label>
              <input
                value={profile.display_name}
                onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                placeholder="Dra. Ana Souza"
                className={input}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>CRM *</label>
                <input
                  value={profile.crm}
                  onChange={(e) => setProfile((p) => ({ ...p, crm: e.target.value }))}
                  placeholder="CRM-MG 12345"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>WhatsApp</label>
                <input
                  value={profile.whatsapp}
                  onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="(31) 99999-9999"
                  className={input}
                />
              </div>
            </div>
            <div>
              <label className={label}>Título</label>
              <input
                value={profile.title}
                onChange={(e) => setProfile((p) => ({ ...p, title: e.target.value }))}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Especialidade / foco</label>
              <input
                value={profile.specialty}
                onChange={(e) => setProfile((p) => ({ ...p, specialty: e.target.value }))}
                placeholder="Gestação de alto risco"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Chave PIX (cobranças)</label>
              <input
                value={profile.pix_key}
                onChange={(e) => setProfile((p) => ({ ...p, pix_key: e.target.value }))}
                placeholder="Opcional — dá para configurar depois"
                className={input}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="press glow-cta w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Criando seu consultório..." : "Abrir meu consultório digital 🚀"}
            </button>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Ao continuar você concorda com os termos de uso. Seus dados e os das suas pacientes
              ficam protegidos por Row Level Security e LGPD.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
