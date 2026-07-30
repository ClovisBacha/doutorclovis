import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerDoctor, getMyDoctor } from "@/lib/doctors.functions";
import { juntarCrm, separarCrm, UFS } from "@/lib/crm";
import { GoogleButton, OrDivider } from "@/components/google-button";

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

type Step = "auth" | "perfil" | "confirm-email" | "pronto";

function CadastroMedicoPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("auth");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Sessão pré-existente (ex.: conta de paciente): confirmar a intenção antes
  // de criar um perfil de médico por cima da mesma conta.
  const [existingSession, setExistingSession] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    display_name: "",
    title: "Ginecologista e Obstetra",
    specialty: "",
    crm: "",
    whatsapp: "",
    pix_key: "",
  });

  // Já logado? Médico ativo vai direto ao painel (ex.: login com Google);
  // senão mostra o perfil profissional, avisando qual conta está em uso e
  // oferecendo trocar — evita paciente virando "médico" sem perceber.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      try {
        const me = await getMyDoctor({ data: { accessToken: data.session.access_token } });
        if (me.ok && me.doctor?.active) {
          navigate({ to: "/painel" });
          return;
        }
      } catch {
        /* sem rede/perfil: segue para a etapa de perfil */
      }
      setExistingSession(data.session.user.email ?? "sua conta atual");
      // Pré-preenche o nome com o do Google, se veio no cadastro social.
      const gName =
        (data.session.user.user_metadata?.full_name as string | undefined) ??
        (data.session.user.user_metadata?.name as string | undefined) ??
        "";
      if (gName) setProfile((p) => (p.display_name ? p : { ...p, display_name: gName }));
      setStep("perfil");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchAccount() {
    await supabase.auth.signOut();
    setExistingSession(null);
    setStep("auth");
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Informe e-mail e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: su, error } = await supabase.auth.signUp({ email: email.trim(), password });
        // Anti-enumeração do Supabase: e-mail já cadastrado retorna "sucesso"
        // sem sessão e com identities vazio — orienta a entrar em vez de
        // prometer um e-mail de confirmação que nunca chega.
        if (!error && su.user && su.user.identities?.length === 0) {
          toast.error("Este e-mail já tem conta — use o modo Entrar.");
          setMode("login");
          return;
        }
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
        // Confirmação de e-mail ativa: um toast some — a tela precisa ficar.
        setStep("confirm-email");
        return;
      }
      setStep("perfil");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
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
      // Indicação: ?ref=<doctorId> na URL vira o médico que indicou.
      const ref =
        typeof window !== "undefined"
          ? (new URLSearchParams(window.location.search).get("ref") ?? undefined)
          : undefined;
      // Convite de PACIENTE (obst_doc_invite): +15% no checkout p/ o médico
      // e Premium para ela quando ele assinar — validado no servidor.
      let patientInvite: string | undefined;
      try {
        const raw = localStorage.getItem("obst_doc_invite");
        if (raw) {
          const parsed = JSON.parse(raw) as { code?: string; at?: number };
          if (parsed?.code && Date.now() - (parsed.at ?? 0) < 90 * 86400000)
            patientInvite = parsed.code;
        }
      } catch {
        /* sem storage, sem convite */
      }
      const res = await registerDoctor({
        data: {
          accessToken: s.session.access_token,
          profile,
          ref: ref || undefined,
          ...(patientInvite ? { patientInvite } : {}),
        },
      });
      if (!res.ok) {
        toast.error(
          "error" in res && res.error
            ? `Não foi possível criar seu perfil: ${res.error}`
            : "Não foi possível criar seu perfil. Tente novamente.",
        );
        return;
      }
      setStep("pronto");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
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

        {/* Etapas (só nos passos de formulário) */}
        {(step === "auth" || step === "perfil") && (
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
        )}

        {step === "confirm-email" && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-4xl">📬</p>
            <h2 className="mt-3 font-serif text-xl">Confirme seu e-mail</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele e volte a
              esta página para continuar o cadastro do seu consultório.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="press mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Já confirmei — continuar
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Não chegou? Olhe o spam ou{" "}
              <button
                type="button"
                onClick={() => setStep("auth")}
                className="font-semibold text-primary hover:underline"
              >
                tente outro e-mail
              </button>
              .
            </p>
          </div>
        )}

        {step === "pronto" && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-4xl">🎉</p>
            <h2 className="mt-3 font-serif text-xl">Seu painel já está ativo!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Seus <strong>14 dias grátis</strong> começaram agora. Você já pode entrar no painel,
              treinar a sua IA (Segundo Cérebro), abrir a agenda e convidar suas pacientes — sem
              esperar por ninguém.
            </p>
            <div className="mt-5 space-y-2 rounded-2xl bg-secondary/50 p-4 text-left text-xs text-muted-foreground">
              <p>✅ Conta e perfil profissional criados</p>
              <p>✅ Painel liberado — trial de 14 dias ativo</p>
              <p>👉 Agora: treine sua IA e convide suas pacientes pelo painel</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => navigate({ to: "/painel" })}
                className="press glow-cta rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground"
              >
                Abrir meu painel →
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="press rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-primary hover:text-primary"
              >
                Conhecer o app da paciente
              </button>
            </div>
          </div>
        )}

        {step === "perfil" && existingSession && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-800">
            Você está conectado como <strong>{existingSession}</strong>. O perfil de médico será
            criado nesta conta.{" "}
            <button
              type="button"
              onClick={switchAccount}
              className="font-semibold text-amber-900 underline"
            >
              Usar outra conta
            </button>
          </div>
        )}

        {step === "auth" ? (
          <form
            onSubmit={submitAuth}
            className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <GoogleButton role="medico" />
            <p className="-mt-1 text-[11px] text-muted-foreground">
              Com o Google seu e-mail já fica conectado — as teleconsultas caem na sua Agenda Google
              automaticamente.
            </p>
            <OrDivider />
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
        ) : step === "perfil" ? (
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
              {/* UF primeiro, número depois — o registro é estadual, e
                  "CRM 12345" sozinho não identifica ninguém. Em dois controles
                  o formato sai sempre igual e dá para conferir no portal do
                  conselho. */}
              <div>
                <label className={label}>CRM *</label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={separarCrm(profile.crm).uf}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        crm: juntarCrm(e.target.value, separarCrm(p.crm).numero),
                      }))
                    }
                    className={`${input} w-[86px] shrink-0`}
                    aria-label="Estado do CRM"
                  >
                    <option value="">UF</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                  <input
                    value={separarCrm(profile.crm).numero}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        crm: juntarCrm(separarCrm(p.crm).uf, e.target.value),
                      }))
                    }
                    placeholder="12345"
                    inputMode="numeric"
                    className={input}
                    aria-label="Número do CRM"
                  />
                </div>
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
        ) : null}
      </div>
    </main>
  );
}
