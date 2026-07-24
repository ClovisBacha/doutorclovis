/**
 * Avisos in-app para usuários logados (médicos e pacientes):
 *  - Comunicados do dono (banner dispensável, filtrado por papel no servidor).
 *
 * Montado no layout autenticado; não aparece no console do dono (/admin).
 */
import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveAnnouncements,
  dismissAnnouncement,
  type Announcement,
} from "@/lib/announcements.functions";

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
  // Reativo à navegação client-side: o layout persiste, então não dá pra
  // depender de um snapshot de window.location (some/aparece ao trocar de rota).
  const onAdmin = useLocation({ select: (l) => l.pathname.startsWith("/admin") });

  useEffect(() => {
    if (onAdmin) return;
    (async () => {
      const tk = await token();
      if (!tk) return;
      try {
        const a = await getActiveAnnouncements({ data: { accessToken: tk } });
        if (a.ok) setAnns(a.announcements);
      } catch {
        /* silencioso */
      }
    })();
  }, [onAdmin]);

  if (onAdmin) return null;
  if (anns.length === 0) return null;

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
    </div>
  );
}
