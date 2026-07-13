import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { finishGoogleCalendarConnect } from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/medicos_/google-callback")({
  head: () => ({
    meta: [
      { title: "Conectando Google Agenda — Obstétrica" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const st = params.get("state");
    const oauthErr = params.get("error");
    if (oauthErr || !code || !st) {
      setState("error");
      setErrorMsg(oauthErr === "access_denied" ? "Você cancelou a autorização." : "Link inválido.");
      return;
    }
    finishGoogleCalendarConnect({
      data: { code, state: st, origin: window.location.origin },
    })
      .then((res) => {
        if (res.ok) {
          setState("ok");
          setEmail(res.email ?? null);
        } else {
          setState("error");
          setErrorMsg(("error" in res && res.error) || "Não foi possível conectar.");
        }
      })
      .catch(() => {
        setState("error");
        setErrorMsg("Falha de conexão. Tente novamente.");
      });
  }, []);

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[var(--gradient-warm)] px-5 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        {state === "loading" && (
          <>
            <p className="text-4xl">🔗</p>
            <h1 className="mt-3 font-serif text-xl">Conectando sua Agenda Google…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Só um instante.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-3 font-serif text-xl">Agenda conectada!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {email ? (
                <>
                  Suas teleconsultas passam a ser criadas em <strong>{email}</strong>.
                </>
              ) : (
                "Suas teleconsultas passam a ser criadas na sua conta Google."
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/painel" })}
              className="press mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Voltar ao painel
            </button>
          </>
        )}
        {state === "error" && (
          <>
            <p className="text-4xl">⚠️</p>
            <h1 className="mt-3 font-serif text-xl">Não deu para conectar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/painel" })}
              className="press mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Voltar ao painel
            </button>
          </>
        )}
      </div>
    </main>
  );
}
