import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { RED_SYMPTOMS } from "@/lib/triage";
import { DOCTOR } from "@/lib/doctor.config";
import { linkTel, linkWhatsApp } from "@/lib/telefone";
import type { DoctorContato } from "@/lib/patientlink.functions";
import { dispararEmergencia, type CanaisAviso } from "@/lib/emergencia.functions";
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
  /* Quem é "o médico" desta tela — tudo ou nada, nunca uma mistura.
     
     Se a paciente TEM médico vinculado, valem só os dados dele. Se ele não
     cadastrou telefone, os botões de ligar e WhatsApp somem e a tela diz isso
     — cair no número do dono da instalação seria o pior defeito imaginável:
     o botão diria "Ligar para Dra. Marina" e chamaria outra pessoa, e ela
     ficaria esperando do outro lado uma resposta que nunca vem.

     Sem vínculo (a maioria hoje), vale o `doctor.config` — o médico dono da
     instalação, que é de fato quem a atende. */
  const temVinculo = !!medico?.nome?.trim();
  const medNome = temVinculo ? medico!.nome.trim() : DOCTOR.name;
  const medCrm = (temVinculo ? medico!.crm?.trim() : DOCTOR.crm) || "";
  const medZap = temVinculo ? linkWhatsApp(medico!.whatsapp) : DOCTOR.whatsappUrl;
  const medTel = temVinculo ? linkTel(medico!.whatsapp) : linkTel(DOCTOR.whatsappUrl);
  const [qr, setQr] = useState<string | null>(null);
  const [panic, setPanic] = useState<"idle" | "sending" | "sent">("idle");
  /** O que DE FATO saiu, devolvido pelo servidor. A tela só diz o que houve. */
  const [canais, setCanais] = useState<CanaisAviso | null>(null);
  /** Mensagem pronta para o WhatsApp do contato principal, vinda do servidor. */
  const [zap, setZap] = useState<string | null>(null);
  /** O WhatsApp abriu sozinho? Quando não, o botão verde muda de tom. */
  const [zapAbriu, setZapAbriu] = useState(false);
  // Carteirinha recolhida por padrão; toca pra ver tudo (fica dentro do SOS).
  const [cardOpen, setCardOpen] = useState(false);

  /**
   * Pedir socorro — o servidor avisa, não ela.
   *
   * Duas versões atrás este botão montava uma mensagem e abria o WhatsApp:
   * quem apertava enviar era a paciente. Quem está com a visão embaçada,
   * sozinha ou prestes a desmaiar pode não concluir — e o app dizia "enviado"
   * do mesmo jeito.
   *
   * Agora um toque dispara `dispararEmergencia`, que envia do servidor por
   * todos os canais que existirem: push e e-mail para o médico dela, e-mail e
   * SMS para o contato de emergência. A resposta diz QUAIS saíram, e a tela
   * mostra nome por nome. Se sobrou alguém sem aviso, aí sim aparece o
   * WhatsApp — como o que FALTA, não como o que foi feito.
   *
   * A localização é tentada primeiro, com teto de 10s: numa emergência não dá
   * para esperar um GPS que não pega. Sem ela o aviso sai assim mesmo, dizendo
   * que não foi possível localizar.
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

      const { data: s } = await supabase.auth.getSession();
      if (!s.session) throw new Error("sem sessão");
      const r = await dispararEmergencia({
        data: { accessToken: s.session.access_token, latitude: lat, longitude: lng, address },
      });
      if (!r.ok) throw new Error("falhou");

      setCanais(r.canais);
      setPanic("sent");
      /* A mensagem do WhatsApp é a MESMA que saiu por e-mail e SMS — vem
         pronta do servidor em vez de ser remontada aqui, senão o parente que
         receber pelos dois canais leria duas versões diferentes do mesmo
         socorro. */
      setZap(r.mensagem || null);

      /* ── O WhatsApp abre sozinho, e só DEPOIS ────────────────────────────
         A ordem importa e é esta de propósito: e-mail e SMS já saíram (a
         chamada acima terminou), então abrir o WhatsApp agora não atrasa nem
         atrapalha nenhum deles. Ele é o último passo, não o primeiro.

         O app vai viver dentro da App Store e da Play Store, onde a abertura
         de um link externo a partir de um toque é permitida sem bloqueio —
         então lá isto acontece sempre. No navegador de hoje o Safari pode
         barrar por causa da espera do GPS; quando barrar, `window.open`
         devolve `null` e o botão verde abaixo continua ali, a um toque.

         Ela ainda aperta ENVIAR dentro do WhatsApp: a mensagem chega escrita,
         mas quem manda de dentro do aplicativo é sempre a pessoa. */
      const alvo = linkWhatsApp(info.emergencyPhone);
      if (alvo && r.mensagem) {
        const url = `${alvo}?text=${encodeURIComponent(r.mensagem)}`;
        const janela = window.open(url, "_blank", "noopener,noreferrer");
        setZapAbriu(!!janela);
      }
      if (r.canais.destinos.length) {
        toast.success(`Avisei ${r.canais.destinos.map((d) => d.nome).join(" e ")} 💛`);
      } else {
        toast.error("Não consegui avisar ninguém automaticamente — ligue 192.");
      }
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
    medCrm ? `Medico: ${medNome} - ${medCrm}` : `Medico: ${medNome}`,
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
          {medZap ? (
            <a
              href={medZap}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-4 py-4 text-center text-sm font-semibold text-primary-foreground"
            >
              <span className="text-2xl">💬</span>
              WhatsApp do médico
            </a>
          ) : (
            /* Médico vinculado sem telefone cadastrado. O lugar não fica
               vazio: 193 é um número que atende sempre, em qualquer estado. */
            <a
              href="tel:193"
              className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-4 py-4 text-center text-sm font-semibold text-primary-foreground"
            >
              <span className="text-2xl">🚒</span>
              Ligar 193 (Bombeiros)
            </a>
          )}
        </div>
        {!medZap && !medTel && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-center text-[12px] leading-snug text-amber-900">
            {medNome} ainda não cadastrou um telefone no app. Use o 192 ou o 193 acima.
          </p>
        )}
        {medTel && (
          <a
            href={medTel}
            className="mt-2 flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            📞 Ligar para {medNome.split(" ").slice(0, 2).join(" ")}
          </a>
        )}

        {/* Pedir socorro: um toque, o servidor avisa. */}
        <button
          onClick={sendLocation}
          disabled={panic !== "idle"}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-70"
        >
          {panic === "sending"
            ? "📍 Localizando e avisando…"
            : panic === "sent"
              ? "✓ Aviso enviado"
              : "🆘 Pedir socorro agora"}
        </button>
        {panic === "idle" && (
          <p className="mt-1.5 text-center text-[11px] leading-snug text-muted-foreground">
            Avisa {medNome.split(" ").slice(0, 2).join(" ")}
            {info.emergencyContact ? ` e ${info.emergencyContact.split(" ")[0]}` : ""} com a sua
            localização, sem você precisar escrever nada.
          </p>
        )}

        {/* O que REALMENTE saiu. A tela nunca diz "enviado" no genérico: quem
            foi avisado aparece pelo nome, e quem não foi também. */}
        {panic === "sent" && canais && (
          <div className="mt-2 rounded-2xl bg-emerald-50 px-3.5 py-3 text-[12px] leading-snug text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
            {canais.destinos.length ? (
              <>
                <p className="font-bold">SOS enviado para:</p>
                <ul className="mt-1 space-y-1">
                  {canais.destinos.map((d) => (
                    <li key={d.nome + d.via}>
                      {/* O endereço aparece junto do nome de propósito: é o que
                          deixa ela conferir, na hora, que o aviso foi para quem
                          ela cadastrou — e perceber um cadastro errado antes da
                          próxima vez, em vez de descobrir na emergência. */}
                      <span className="font-semibold">{d.nome}</span>
                      <span className="opacity-80"> — {d.via}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              /* Não dizemos POR QUE ninguém recebeu (sem médico vinculado, sem
                 contato cadastrado): ela já sabe o que preencheu, e explicar
                 cadastro no meio de uma emergência gasta a atenção que ela
                 precisa ter para ligar. Uma frase, uma ação. */
              <p className="font-bold">Ninguém foi avisado automaticamente. Ligue 192.</p>
            )}
          </div>
        )}

        {/* O botão fica MESMO quando o WhatsApp abriu sozinho: ela pode ter
            fechado sem enviar, ou voltado para cá para ligar 192 antes. Sem
            ele, refazer o caminho exigiria acionar o SOS de novo. */}
        {panic === "sent" && zap && linkWhatsApp(info.emergencyPhone) && (
          <a
            href={`${linkWhatsApp(info.emergencyPhone)}?text=${encodeURIComponent(zap)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="press mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white"
          >
            💬 {zapAbriu ? "Abrir o WhatsApp de novo" : "Mandar no WhatsApp"}
            {!zapAbriu && info.emergencyContact ? ` de ${info.emergencyContact.split(" ")[0]}` : ""}
          </a>
        )}
        {panic === "sent" && zapAbriu && (
          <p className="mt-1.5 text-center text-[11px] leading-snug text-muted-foreground">
            A mensagem já está escrita no WhatsApp — é só apertar enviar.
          </p>
        )}

        {/* Terceira camada de urgência: sempre visível, nunca competindo.
            193 e 188 estavam dentro da carteirinha RECOLHIDA — três toques até
            um número de socorro. Agora ficam na primeira dobra, mas com metade
            da altura, sem cor de fundo e com o número em segundo plano: quem
            varre a tela em pânico continua batendo o olho primeiro no 192
            vermelho e no botão de socorro. */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href="tel:193"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-foreground"
          >
            <span aria-hidden>🚒</span>
            <span className="font-semibold">193</span>
            <span className="text-muted-foreground">Bombeiros</span>
          </a>
          <a
            href="tel:188"
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-foreground"
          >
            <span aria-hidden>💚</span>
            <span className="font-semibold">188</span>
            <span className="text-muted-foreground">CVV</span>
          </a>
        </div>
        {/* Quase ninguém sabe o que é "CVV" — e um número que a pessoa não
            entende é um número que ela não liga. */}
        <p className="mt-1.5 text-center text-[10.5px] leading-snug text-muted-foreground">
          CVV: Centro de Valorização da Vida — apoio emocional gratuito, 24h, sigiloso. Para quando
          a angústia é o que está doendo.
        </p>

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
                <Row label="Médico" value={medCrm ? `${medNome} · ${medCrm}` : medNome} />
              </dl>
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
