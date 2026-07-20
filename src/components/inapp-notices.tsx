/**
 * Avisos in-app para usuários logados (médicos e pacientes):
 *  - Comunicados do dono (banner dispensável, filtrado por papel no servidor).
 *  - Pesquisa de NPS curta (1x a cada 90 dias), papel detectado no servidor.
 *
 * Montado no layout autenticado; não aparece no console do dono (/admin).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveAnnouncements,
  dismissAnnouncement,
  type Announcement,
} from "@/lib/announcements.functions";
import { shouldAskNps, submitNps } from "@/lib/nps.functions";

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const LEVEL_CLS: Record<string, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function InAppNotices() {
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [askNps, setAskNps] = useState(false);
  const onAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  useEffect(() => {
    if (onAdmin) return;
    (async () => {
      const tk = await token();
      if (!tk) return;
      try {
        const [a, n] = await Promise.all([
          getActiveAnnouncements({ data: { accessToken: tk } }),
          shouldAskNps({ data: { accessToken: tk } }),
        ]);
        if (a.ok) setAnns(a.announcements);
        if (n.ok && n.ask) setAskNps(true);
      } catch {
        /* silencioso */
      }
    })();
  }, [onAdmin]);

  if (onAdmin) return null;
  if (anns.length === 0 && !askNps) return null;

  async function dismiss(id: string) {
    setAnns((prev) => prev.filter((a) => a.id !== id));
    try {
      await dismissAnnouncement({ data: { accessToken: await token(), id } });
    } catch {
      /* segue */
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-2 px-4 pt-3">
      {anns.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${LEVEL_CLS[a.level] ?? LEVEL_CLS.info}`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{a.title}</p>
            <p className="mt-0.5 text-sm opacity-90">{a.body}</p>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            aria-label="Dispensar"
            className="shrink-0 rounded-full px-2 text-lg leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
      {askNps && <NpsPrompt onClose={() => setAskNps(false)} />}
    </div>
  );
}

function NpsPrompt({ onClose }: { onClose: () => void }) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (score === null) return;
    setBusy(true);
    try {
      await submitNps({
        data: { accessToken: await token(), score, comment: comment.trim() || null },
      });
      setDone(true);
      setTimeout(onClose, 2500);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
        Obrigado pelo feedback! 💚
      </div>
    );

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">De 0 a 10, o quanto você recomendaria a Obstétrica?</p>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full px-2 text-lg leading-none text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button
            key={n}
            onClick={() => setScore(n)}
            className={`h-9 w-9 rounded-lg border text-sm font-semibold tabular-nums transition-colors ${
              score === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {score !== null && (
        <div className="mt-3 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Quer contar o porquê? (opcional)"
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={send}
            disabled={busy}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
