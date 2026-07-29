import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { RED_SYMPTOMS } from "@/lib/triage";
import { DOCTOR } from "@/lib/doctor.config";
import { linkTel, linkWhatsApp } from "@/lib/telefone";
import type { DoctorContato } from "@/lib/patientlink.functions";
import { savePanicEvent } from "@/lib/escola.functions";
import { supabase } from "@/integrations/supabase/client";

type Info = {
  name?: string | null;
  weekLabel?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  // Carteirinha completa (aberta ao tocar na ficha, dentro do próprio SOS).
  babyName?: string | null;
  dpp?: string | null;
  medications?: string | null;
};

/**
 * Central de Emergência (aberta pelo botão SOS da barra de baixo). Junta tudo
 * num lugar só: ligar 192, falar com o médico, os sinais de alerta e uma
 * carteirinha com QR (gerado no próprio aparelho — LGPD, sem serviço externo)
 * pra mostrar no hospital.
 */
export function EmergencySheet({
  info,
  medico,
  onClose,
  onOpenCard,
}: {
  info: Info;
  /**
   * O médico DA PACIENTE, lido do cadastro dele (`getMyDoctorContact`).
   * `null` = ela ainda não tem médico vinculado, ou ele não preencheu o
   * WhatsApp: aí vale o `doctor.config`, que é o dono da instalação.
   *
   * Isto não é preciosismo de multi-tenant: um SOS que liga para o médico
   * errado é pior que um SOS que não liga para ninguém, porque ela vai
   * esperar do outro lado uma resposta que não vem.
   */
  medico?: DoctorContato | null;
  onClose: () => void;
  /** Abre a carteirinha completa (QR grande, copiar, imprimir) fora do SOS. */
  onOpenCard?: () => void;
}) {
  const medNome = medico?.nome?.trim() || DOCTOR.name;
  const medCrm = medico?.crm?.trim() || DOCTOR.crm;
  const medZap = linkWhatsApp(medico?.whatsapp) ?? DOCTOR.whatsappUrl;
  const medTel = linkTel(medico?.whatsapp) ?? linkTel(DOCTOR.whatsappUrl) ?? "";
  const [qr, setQr] = useState<string | null>(null);
  const [panic, setPanic] = useState<"idle" | "sending" | "sent">("idle");
  // Carteirinha recolhida por padrão; toca pra ver tudo (fica dentro do SOS).
  const [cardOpen, setCardOpen] = useState(false);

  /**
   * Avisar o contato de emergência.
   *
   * O que este botão fazia antes: gravava uma linha em `panic_events` e dizia
   * "Alerta com sua localização enviado 💛". Ninguém era avisado. Não havia
   * push, e-mail, SMS nem WhatsApp em lugar nenhum do caminho — a linha só
   * seria vista se o acompanhante ABRISSE o painel dele nos 30 minutos
   * seguintes, por conta própria. Numa tela de emergência, dizer "enviado"
   * para algo que não foi enviado é o pior defeito possível: ela pode parar
   * de procurar ajuda achando que já pediu.
   *
   * O que ele faz agora: pega a localização e ABRE O WHATSAPP do contato de
   * emergência com a mensagem pronta — nome, semana, tipo sanguíneo e o link
   * do mapa. Quem envia é ela, num toque, e a mensagem chega de verdade. Sem
   * contato cadastrado, cai no compartilhamento do sistema (ou na cópia do
   * texto), que também chega em alguém.
   *
   * O registro em `panic_events` continua, best-effort e em silêncio: ele
   * alimenta o painel do acompanhante. Mas ele não é mais o que a tela
   * promete, porque nunca foi o que a tela entregava.
   */
  async function sendLocation() {
    if (panic !== "idle") return;
    setPanic("sending");
    let lat: number | null = null;
    let lng: number | null = null;
    let address: string | null = null;
    try {
      if (navigator?.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true,
            }),
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            );
            address = (await resp.json()).display_name ?? null;
          } catch {
            /* nome do local é opcional — o link do mapa já resolve */
          }
        } catch {
          /* sem permissão ou sem sinal: segue sem coordenadas */
        }
      }

      // Registro para o painel do acompanhante. Em silêncio de propósito: se
      // falhar (tabela ainda não aplicada, sessão vencida, sem rede), o aviso
      // pelo WhatsApp continua valendo e é ele que importa.
      try {
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          await savePanicEvent({
            data: { accessToken: s.session.access_token, latitude: lat, longitude: lng, address },
          });
        }
      } catch {
        /* melhor esforço */
      }

      const mapa = lat != null && lng != null ? `https://maps.google.com/?q=${lat},${lng}` : null;
      const texto = [
        `${info.name || "Ela"} precisa de ajuda agora.`,
        info.weekLabel ? `Gestante de ${info.weekLabel}.` : null,
        info.bloodType ? `Tipo sanguíneo: ${info.bloodType}.` : null,
        info.allergies ? `Alergias: ${info.allergies}.` : null,
        address ? `Local: ${address}` : null,
        mapa ?? "Não consegui pegar a localização — me ligue.",
      ]
        .filter(Boolean)
        .join("\n");

      const zap = linkWhatsApp(info.emergencyPhone);
      if (zap) {
        window.open(`${zap}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
        setPanic("sent");
        toast.success(`WhatsApp aberto para ${info.emergencyContact || "seu contato"} 💛`);
        return;
      }
      // Sem contato de emergência cadastrado: entrega para o compartilhamento
      // do sistema, e se nem isso existir, copia para ela colar onde quiser.
      if (navigator.share) {
        await navigator.share({ text: texto });
        setPanic("sent");
        return;
      }
      await navigator.clipboard.writeText(texto);
      setPanic("sent");
      toast.success("Texto copiado — cole no WhatsApp de quem você quer avisar.");
    } catch {
      setPanic("idle");
      toast.error("Não consegui avisar por aqui — ligue 192 imediatamente.");
    }
  }

  const card = [
    "FICHA DE EMERGÊNCIA - GESTANTE",
    `Nome: ${info.name || "-"}`,
    info.babyName ? `Bebe: ${info.babyName}` : "",
    `Idade gestacional: ${info.weekLabel || "-"}`,
    info.dpp ? `DPP: ${info.dpp}` : "",
    `Tipo sanguineo: ${info.bloodType || "-"}`,
    `Alergias: ${info.allergies || "nenhuma informada"}`,
    `Medicamentos: ${info.medications || "nenhum"}`,
    `Contato emergencia: ${info.emergencyContact || "-"} ${info.emergencyPhone || ""}`.trim(),
    `Medico: ${medNome} - ${medCrm}`,
  ]
    .filter(Boolean)
    .join("\n");

  /* O QR é REFEITO sempre que o texto da ficha muda — e `card` é uma string,
     então a comparação do efeito é por conteúdo, não por referência. Mudou o
     tipo sanguíneo, a alergia, o medicamento, a semana, o médico? Sai um QR
     novo no mesmo instante, sem recarregar a página. E é gerado no próprio
     aparelho: cada paciente tem o seu, e nenhum dado de saúde sai daqui. */
  useEffect(() => {
    QRCode.toDataURL(card, { margin: 1, width: 260, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [card]);

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
            href={medZap}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-4 py-4 text-center text-sm font-semibold text-primary-foreground"
          >
            <span className="text-2xl">💬</span>
            WhatsApp do médico
          </a>
        </div>
        {medTel && (
          <a
            href={medTel}
            className="mt-2 flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            📞 Ligar para {medNome.split(" ").slice(0, 2).join(" ")}
          </a>
        )}

        {/* Botão de pânico: registra a localização pro contato de emergência */}
        <button
          onClick={sendLocation}
          disabled={panic !== "idle"}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-60 dark:text-rose-300"
        >
          {panic === "sending"
            ? "📍 Pegando sua localização…"
            : panic === "sent"
              ? "✓ Mensagem pronta"
              : info.emergencyContact
                ? `🆘 Avisar ${info.emergencyContact.split(" ")[0]}`
                : "🆘 Avisar alguém com minha localização"}
        </button>

        {/* Carteirinha de emergência (QR gerado no aparelho) — toca pra ver tudo */}
        <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4">
          <button
            onClick={() => setCardOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">Carteirinha de emergência</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mostre o QR no hospital · toque para ver tudo
              </p>
            </div>
            <span
              className={`shrink-0 text-muted-foreground transition-transform duration-300 ${cardOpen ? "rotate-90" : ""}`}
            >
              ›
            </span>
          </button>

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

          {cardOpen && (
            <>
              <dl className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                {info.babyName && <Row label="Bebê" value={info.babyName} />}
                <Row label="DPP" value={info.dpp} />
                <Row label="Medicamentos" value={info.medications || "nenhum"} />
                <Row label="Tel. emergência" value={info.emergencyPhone} />
                <Row label="Médico" value={`${medNome} · ${medCrm}`} />
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
                {[
                  { label: "Bombeiros", number: "193" },
                  { label: "CVV (apoio)", number: "188" },
                ].map(({ label, number }) => (
                  <a
                    key={number}
                    href={`tel:${number}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-bold text-foreground">{number}</span>
                  </a>
                ))}
              </div>
            </>
          )}

          {cardOpen && onOpenCard && (
            <button
              onClick={onOpenCard}
              className="press mt-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
            >
              Abrir carteirinha completa (copiar / imprimir) →
            </button>
          )}

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
