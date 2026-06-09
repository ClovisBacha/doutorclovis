import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Obstétrica by Dr. Clóvis" },
      { name: "description", content: "Acesse sua conta para acompanhar semana a semana o desenvolvimento do seu bebê." },
    ],
  }),
  component: AuthPage,
});

function translateAuthError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos. Tente novamente.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (msg.includes("User already registered")) return "Já existe uma conta com este e-mail. Faça login.";
  if (msg.includes("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("Unable to validate email")) return "E-mail inválido. Verifique o endereço digitado.";
  if (msg.includes("rate limit") || msg.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (msg.includes("network") || msg.includes("fetch")) return "Erro de conexão. Verifique sua internet e tente novamente.";
  return "Ocorreu um erro. Tente novamente ou entre em contato pelo WhatsApp.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/minha-conta" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
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
        setMsg({ text: "Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.", type: "success" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/minha-conta" });
      }
    } catch (err: any) {
      setMsg({ text: translateAuthError(err.message ?? ""), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "signup" : "login");
    setMsg(null);
  }

  return (
    <section className="mx-auto flex max-w-md flex-col px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Minha conta</p>
      <h1 className="mt-3 font-serif text-3xl">{mode === "login" ? "Acessar minha conta" : "Criar minha conta"}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Acompanhe semana a semana o desenvolvimento do seu bebê, salve seu diário gestacional e muito mais.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]" noValidate>
        {mode === "signup" && (
          <div>
            <label htmlFor="auth-name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
          <label htmlFor="auth-email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
          <label htmlFor="auth-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Senha
          </label>
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
          {mode === "login" ? "Não tem conta? Cadastre-se gratuitamente" : "Já tem conta? Fazer login"}
        </button>
      </form>

      <Link to="/" className="mt-6 text-center text-xs text-muted-foreground hover:text-primary transition-colors">
        ← Voltar ao início
      </Link>
    </section>
  );
}
