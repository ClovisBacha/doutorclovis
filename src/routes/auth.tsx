import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyDoctor } from "@/lib/doctors.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Obstétrica" },
      {
        name: "description",
        content: "Acesse sua conta para acompanhar semana a semana o desenvolvimento do seu bebê.",
      },
    ],
  }),
  component: AuthPage,
});

function translateAuthError(msg: string): string {
  if (msg.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos. Tente novamente.";
  if (msg.includes("Email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (msg.includes("User already registered"))
    return "Já existe uma conta com este e-mail. Faça login.";
  if (msg.includes("Password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("Unable to validate email"))
    return "E-mail inválido. Verifique o endereço digitado.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  return "Ocorreu um erro. Tente novamente ou entre em contato pelo WhatsApp.";
}

function AuthPage() {
  const navigate = useNavigate();
  // Veio do link de redefinição de senha? (Supabase põe type=recovery no hash.)
  // Precisa ser detectado ANTES de qualquer redirect, senão a sessão de
  // recovery joga a usuária para dentro do app sem deixar trocar a senha.
  const isRecoveryLink =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    isRecoveryLink ? "reset" : "login",
  );
  // Papel escolhido: define o destino pós-login e o fluxo de cadastro.
  const [role, setRole] = useState<"paciente" | "medico">("paciente");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // Nunca redireciona durante o fluxo de redefinição de senha.
    if (isRecoveryLink) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      // Conta com perfil de médico ATIVO vai para o painel;
      // as demais, para o app da paciente.
      try {
        const me = await getMyDoctor({ data: { accessToken: data.session.access_token } });
        if (me.ok && me.doctor?.active) {
          navigate({ to: "/painel" });
          return;
        }
      } catch {
        /* sem rede/perfil: segue como paciente */
      }
      navigate({ to: "/minha-conta" });
    });
  }, [navigate, isRecoveryLink]);

  // Catch PASSWORD_RECOVERY event from the magic link in the reset email
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setMsg(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setShowResend(false);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/minha-conta`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        setMsg({
          text: "Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.",
          type: "success",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (role === "medico") {
          // Médico: painel se o perfil profissional existe e está ativo;
          // senão, completar o cadastro (o fluxo reconhece a sessão).
          const { data: s } = await supabase.auth.getSession();
          const me = s.session
            ? await getMyDoctor({ data: { accessToken: s.session.access_token } })
            : null;
          navigate({ to: me?.ok && me.doctor?.active ? "/painel" : "/medicos/cadastro" });
          return;
        }
        navigate({ to: "/minha-conta" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setMsg({ text: translateAuthError(message), type: "error" });
      setShowResend(message.includes("Email not confirmed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/minha-conta` },
      });
      if (error) throw error;
      setMsg({
        text: "E-mail de confirmação reenviado! Verifique sua caixa de entrada.",
        type: "success",
      });
      setShowResend(false);
    } catch {
      setMsg({
        text: "Não foi possível reenviar. Tente novamente em alguns minutos.",
        type: "error",
      });
    } finally {
      setResendLoading(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setMsg({
        text: "Link de redefinição enviado! Verifique sua caixa de entrada (e a pasta de spam).",
        type: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setMsg({ text: translateAuthError(message), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMsg({ text: "Senha atualizada com sucesso! Redirecionando...", type: "success" });
      setTimeout(() => navigate({ to: "/minha-conta" }), 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setMsg({ text: translateAuthError(message), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "signup" : "login");
    setMsg(null);
  }

  const title =
    mode === "login"
      ? "Acessar minha conta"
      : mode === "signup"
        ? "Criar minha conta"
        : mode === "forgot"
          ? "Redefinir senha"
          : "Nova senha";

  return (
    <section
      className="mx-auto flex max-w-md flex-col px-5 py-16"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.92 0.03 52 / 0.6) 0%, transparent 70%)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Minha conta</p>
      <h1 className="mt-3 font-serif text-3xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {mode === "forgot"
          ? "Digite seu e-mail e enviaremos um link para redefinir a senha."
          : mode === "reset"
            ? "Escolha uma nova senha para sua conta."
            : role === "medico"
              ? "Acesse o painel do seu consultório: pacientes, agenda e o seu Segundo Cérebro."
              : "Acompanhe semana a semana o desenvolvimento do seu bebê, salve seu diário gestacional e muito mais."}
      </p>

      {/* ── Papel: paciente ou médico (define destino e fluxo de cadastro) ── */}
      {(mode === "login" || mode === "signup") && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {(
            [
              { key: "paciente", emoji: "🤰", label: "Sou paciente" },
              { key: "medico", emoji: "🩺", label: "Sou médico(a)" },
            ] as const
          ).map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRole(r.key)}
              aria-pressed={role === r.key}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                role === r.key
                  ? "border-primary bg-primary/10 text-primary shadow-[var(--shadow-soft)]"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {r.emoji} {r.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Cadastro de médico tem fluxo próprio (CRM, perfil profissional) ── */}
      {mode === "signup" && role === "medico" && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <p className="text-4xl">🩺</p>
          <h2 className="mt-3 font-serif text-xl">Criar conta de médico</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O cadastro de médico tem uma etapa própria: conta profissional + perfil com CRM e
            especialidade — é com ele que suas pacientes encontram você.
          </p>
          <Link
            to="/medicos/cadastro"
            className="press mt-5 inline-block rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            Continuar cadastro de médico →
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            14 dias grátis · sem cartão de crédito
          </p>
        </div>
      )}

      {/* ── Forgot password form ── */}
      {mode === "forgot" && (
        <form
          onSubmit={submitForgot}
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          noValidate
        >
          <div>
            <label
              htmlFor="auth-email"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {msg && (
            <p
              role="alert"
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
          >
            {loading ? "Enviando..." : "Enviar link de redefinição"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMsg(null);
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ← Voltar ao login
          </button>
        </form>
      )}

      {/* ── Reset password form (after clicking email link) ── */}
      {mode === "reset" && (
        <form
          onSubmit={submitReset}
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          noValidate
        >
          <div>
            <label
              htmlFor="auth-new-password"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Nova senha
            </label>
            <input
              id="auth-new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="mt-1 text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
          </div>

          {msg && (
            <p
              role="alert"
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}

      {/* ── Login / Signup form ── */}
      {(mode === "login" || (mode === "signup" && role !== "medico")) && (
        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          noValidate
        >
          {mode === "signup" && (
            <div>
              <label
                htmlFor="auth-name"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Seu nome
              </label>
              <input
                id="auth-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}
          <div>
            <label
              htmlFor="auth-email"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete={mode === "signup" ? "email" : "username"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="auth-password"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Senha
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setMsg(null);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {mode === "signup" && (
              <p className="mt-1 text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
            )}
          </div>

          {msg && (
            <p
              role="alert"
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </p>
          )}

          {showResend && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="w-full rounded-full border border-primary px-5 py-2 text-sm font-medium text-primary transition-opacity disabled:opacity-60 hover:bg-primary/5"
            >
              {resendLoading ? "Enviando..." : "Reenviar e-mail de confirmação"}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
          <button
            type="button"
            onClick={switchMode}
            className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "login"
              ? "Não tem conta? Cadastre-se gratuitamente"
              : "Já tem conta? Fazer login"}
          </button>
        </form>
      )}

      <Link
        to="/"
        className="mt-6 text-center text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        ← Voltar ao início
      </Link>
    </section>
  );
}
