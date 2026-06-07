import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Minha Conta · Dr. Clóvis Bacha" },
      { name: "description", content: "Acesse sua conta para acompanhar semana a semana o desenvolvimento do seu bebê." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
        setMsg("Conta criada! Verifique seu e-mail para confirmar e depois faça login.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/minha-conta" });
      }
    } catch (err: any) {
      setMsg(err.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-md flex-col px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Minha conta</p>
      <h1 className="mt-3 font-serif text-3xl">{mode === "login" ? "Acessar minha conta" : "Criar minha conta"}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Acompanhe semana a semana o desenvolvimento do seu bebê, salve seu diário gestacional e muito mais.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        {mode === "signup" && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seu nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Senha</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-xs text-muted-foreground hover:text-primary"
        >
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </form>
      <Link to="/" className="mt-6 text-center text-xs text-muted-foreground hover:text-primary">← Voltar ao site</Link>
    </section>
  );
}