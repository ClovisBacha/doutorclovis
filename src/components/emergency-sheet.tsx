import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { RED_SYMPTOMS } from "@/lib/triage";
import { DOCTOR } from "@/lib/doctor.config";

type Info = {
  name?: string | null;
  weekLabel?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
};

// Número do médico em formato tel: a partir do link do WhatsApp (wa.me/<num>).
function doctorTel(): string {
  const m = DOCTOR.whatsappUrl.match(/(\d{8,})/);
  return m ? `tel:+${m[1]}` : "";
}

/**
 * Central de Emergência (aberta pelo botão SOS da barra de baixo). Junta tudo
 * num lugar só: ligar 192, falar com o médico, os sinais de alerta e uma
 * carteirinha com QR (gerado no próprio aparelho — LGPD, sem serviço externo)
 * pra mostrar no hospital.
 */
export function EmergencySheet({ info, onClose }: { info: Info; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);

  const card = [
    "FICHA DE EMERGÊNCIA - GESTANTE",
    `Nome: ${info.name || "-"}`,
    `Idade gestacional: ${info.weekLabel || "-"}`,
    `Tipo sanguineo: ${info.bloodType || "-"}`,
    `Alergias: ${info.allergies || "nenhuma informada"}`,
    `Contato emergencia: ${info.emergencyContact || "-"} ${info.emergencyPhone || ""}`.trim(),
    `Medico: ${DOCTOR.name} - ${DOCTOR.whatsappDisplay}`,
  ].join("\n");

  useEffect(() => {
    QRCode.toDataURL(card, { margin: 1, width: 260, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [card]);

  const tel = doctorTel();

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-center justify-between">
          <p className="font-serif text-xl text-foreground">Emergência</p>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground"
          >
            ×
          </button>
        </div>

        {/* Ações imediatas */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href="tel:192"
            className="flex flex-col items-center gap-1 rounded-2xl bg-rose-500 px-4 py-4 text-center text-sm font-semibold text-white"
          >
            <span className="text-2xl">🚑</span>
            Ligar 192 (SAMU)
          </a>
          <a
            href={DOCTOR.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-4 py-4 text-center text-sm font-semibold text-primary-foreground"
          >
            <span className="text-2xl">💬</span>
            WhatsApp do médico
          </a>
        </div>
        {tel && (
          <a
            href={tel}
            className="mt-2 flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            📞 Ligar para {DOCTOR.name.split(" ").slice(0, 2).join(" ")}
          </a>
        )}

        {/* Carteirinha de emergência (QR gerado no aparelho) */}
        <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-semibold text-foreground">Ficha de emergência</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mostre este QR no hospital — ele traz seus dados essenciais.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="shrink-0 rounded-xl bg-white p-2">
              {qr ? (
                <img src={qr} alt="QR com sua ficha de emergência" className="h-28 w-28" />
              ) : (
                <div className="h-28 w-28 animate-pulse rounded bg-muted" />
              )}
            </div>
            <dl className="min-w-0 flex-1 space-y-1 text-xs">
              <Row label="Sangue" value={info.bloodType} />
              <Row label="Alergias" value={info.allergies || "nenhuma informada"} />
              <Row label="Semana" value={info.weekLabel} />
              <Row label="Contato" value={info.emergencyContact} />
            </dl>
          </div>
          {(!info.bloodType || !info.emergencyContact) && (
            <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
              Complete tipo sanguíneo e contato de emergência no seu Perfil para a ficha ficar
              completa.
            </p>
          )}
        </div>

        {/* Sinais de alerta */}
        <div className="mt-5">
          <p className="text-sm font-semibold text-foreground">
            Procure atendimento agora se sentir:
          </p>
          <ul className="mt-2 space-y-1.5">
            {RED_SYMPTOMS.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-2 rounded-xl bg-rose-500/8 px-3 py-2 text-sm text-foreground"
              >
                <span className="mt-0.5 text-rose-500" aria-hidden>
                  ●
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Orientação geral — não substitui a avaliação do seu médico.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 font-semibold text-muted-foreground">{label}:</dt>
      <dd className="truncate text-foreground">{value || "—"}</dd>
    </div>
  );
}
