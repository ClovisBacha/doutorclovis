/**
 * Primitivas visuais compartilhadas do console do dono — para todas as seções
 * do /admin falarem a mesma língua (KPIs, barras, exportar CSV, dinheiro).
 */
import { supabase } from "@/integrations/supabase/client";

export async function adminToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export const brl = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const brl0 = (cents: number) => `R$ ${Math.round(cents / 100).toLocaleString("pt-BR")}`;

export type Tone = "primary" | "emerald" | "amber" | "sky" | "rose";
const TONES: Record<Tone, string> = {
  primary: "border-primary/25 bg-primary/5 text-primary",
  emerald: "border-emerald-300/40 bg-emerald-50/60 text-emerald-600",
  amber: "border-amber-300/50 bg-amber-50/60 text-amber-600",
  sky: "border-sky-300/40 bg-sky-50/60 text-sky-600",
  rose: "border-rose-300/40 bg-rose-50/60 text-rose-600",
};

export function Kpi({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className={`card-3d rounded-2xl border p-4 ${TONES[tone]}`}>
      <p className="text-2xl font-extrabold tabular-nums md:text-3xl">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-serif text-lg">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Barra horizontal proporcional (para funil, planos, etc.). */
export function Bar({
  label,
  value,
  max,
  caption,
  tone = "primary",
}: {
  label: string;
  value: number;
  max: number;
  caption?: string;
  tone?: Tone;
}) {
  const fill: Record<Tone, string> = {
    primary: "bg-primary/80 text-primary-foreground",
    emerald: "bg-emerald-500/80 text-white",
    amber: "bg-amber-500/80 text-white",
    sky: "bg-sky-500/80 text-white",
    rose: "bg-rose-500/80 text-white",
  };
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm font-medium">{label}</span>
      <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`flex h-full items-center rounded-full px-2 text-[11px] font-semibold ${fill[tone]}`}
          style={{ width: `${Math.max(6, max > 0 ? (value / max) * 100 : 0)}%` }}
        >
          {value}
        </div>
      </div>
      {caption && (
        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {caption}
        </span>
      )}
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Baixa uma matriz de dados como CSV (com BOM p/ Excel abrir acentos certo). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
    >
      ↓ Exportar CSV
    </button>
  );
}
