import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { emTelaCheia } from "@/lib/nativo";
import { RED_SYMPTOMS } from "@/lib/triage";
import { linkTel, linkWhatsApp } from "@/lib/telefone";
import type { DoctorContato } from "@/lib/patientlink.functions";
import { dispararEmergencia, type CanaisAviso } from "@/lib/emergencia.functions";
import { supabase } from "@/integrations/supabase/client";
import { useVoltar } from "@/lib/use-voltar";
import { localizacaoAgora, localizacaoNegada } from "@/lib/localizacao";

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
  medicoResolvido,
  onClose,
  onOpenCard,
}: {
  info: Info;
  /**
   * O médico DA PACIENTE, lido do cadastro dele (`getMyDoctorContact`).
   * `null` = ela ainda não tem médico vinculado, ou ele não preencheu o
   * WhatsApp: sem médico vinculado, NENHUM nome é mostrado (nunca o do dono da
   * instalação — ver `temVinculo` abaixo).
   *
   * Isto não é preciosismo de multi-tenant: um SOS que liga para o médico
   * errado é pior que um SOS que não liga para ninguém, porque ela vai
   * esperar do outro lado uma resposta que não vem.
   */
  medico?: DoctorContato | null;
  /** `false` = ainda não sabemos se ela tem médico. Ver `medicoResolvido`. */
  medicoResolvido?: boolean;
  onClose: () => void;
  /** Abre a carteirinha completa (QR grande, copiar, imprimir) fora do SOS. */
  onOpenCard?: () => void;
}) {
  /* Voltar (Android) e Escape fecham o SOS. Sem isto, o botão que o Android
     inteiro usa para "cancelar isto aqui" fechava o APP — com a tela de
     emergência aberta. */
  useVoltar(true, onClose);

  /* Quem é "o médico" desta tela — tudo ou nada, nunca uma mistura.
     
     Se a paciente TEM médico vinculado, valem só os dados dele. Se ele não
     cadastrou telefone, os botões de ligar e WhatsApp somem e a tela diz isso
     — cair no número do dono da instalação seria o pior defeito imaginável:
     o botão diria "Ligar para Dra. Marina" e chamaria outra pessoa, e ela
     ficaria esperando do outro lado uma resposta que nunca vem.

     Sem vínculo, nada do médico aparece. */
  /* `temVinculo` decide se a tela nomeia um médico.
     
     Sem vínculo ela nomeava o dono da instalação — "Ligar para Dr. Clóvis",
     "Avisa Dr. Clóvis" — enquanto o servidor, corretamente, não avisa médico
     nenhum (`emergencia.functions.ts` só notifica `doctor_id`). A tela
     prometia o que o disparo não entrega. Agora, sem vínculo, o botão do
     médico dá lugar ao 193 e o texto não cita nome nenhum. */
  const temVinculo = !!medico?.nome?.trim();
  /* Não sabemos ainda: nem afirma que ela tem médico, nem que não tem. */
  const medicoIndefinido = medicoResolvido === false && !temVinculo;
  const medNome = temVinculo ? medico!.nome.trim() : "";
  const medCrm = temVinculo ? (medico!.crm ?? "").trim() : "";
  const medZap = temVinculo ? linkWhatsApp(medico!.whatsapp) : null;
  const medTel = temVinculo ? linkTel(medico!.whatsapp) : null;
  const [qr, setQr] = useState<string | null>(null);
  /* Localização PRÉ-AQUECIDA, obtida ao abrir a Central — não no toque do SOS.

     Este é o conserto de um estrago meu. Para escapar do bloqueador de pop-up
     eu passei a abrir a aba do WhatsApp DENTRO do toque, antes de tudo. Só que
     abrir uma aba manda a página do SOS para segundo plano, e o iOS SUSPENDE a
     geolocalização de página em segundo plano: o pedido nunca era respondido e
     estourava o prazo sem nada. O aviso saía sem a coordenada, em silêncio.

     Pedindo ao ABRIR a central, a coordenada já está na mão quando ela toca no
     botão — e o toque não precisa esperar por nada. De quebra, a tela consegue
     dizer ANTES da emergência se a localização vai junto, que é a hora de
     descobrir isso. */
  const [posicao, setPosicao] = useState<{ lat: number; lng: number; em: number } | null>(null);
  const [posicaoNegada, setPosicaoNegada] = useState(false);

  useEffect(() => {
    let vivo = true;
    /* Por `localizacaoAgora` e não por `navigator.geolocation` direto: dentro
       da casca nativa o WebView só entrega coordenada se o APLICATIVO tiver a
       permissão do sistema, e a chamada da web não pede nenhuma. Ver
       `src/lib/localizacao.ts`.

       Aqui pode esperar mais: ninguém está travado numa tela. 10s dá tempo do
       aparelho responder até com sinal ruim, e o resultado fica guardado. */
    void localizacaoAgora({ timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }).then(
      async (c) => {
        if (!vivo) return;
        if (c) {
          setPosicao({ lat: c.lat, lng: c.lng, em: Date.now() });
          setPosicaoNegada(false);
          return;
        }
        /* Sem coordenada pode ser "ela disse não" ou problema técnico, e a tela
           diz coisas diferentes nos dois casos. Perguntar ao sistema é o único
           jeito de saber — o `code === 1` da API da web não existe no plugin. */
        const negada = await localizacaoNegada();
        if (vivo) setPosicaoNegada(negada);
      },
    );
    return () => {
      vivo = false;
    };
  }, []);
  /* "sent" não bastava. O botão dizia "✓ Aviso enviado" só porque o servidor
     respondeu, mesmo quando a lista de avisados voltava VAZIA — e o texto abaixo
     dizia, em letra menor, "ninguém foi avisado". O maior e mais vermelho
     elemento da tela contradizia o aviso importante. `ninguem` é esse caso. */
  const [panic, setPanic] = useState<"idle" | "sending" | "sent" | "ninguem">("idle");
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

    /* ── A janela do WhatsApp é aberta AGORA, dentro do toque ──────────────
       Isto parece estranho e é o único jeito de funcionar. iOS e Android só
       permitem abrir uma janela dentro do gesto que a pessoa fez; qualquer
       `window.open` depois de um `await` — e nós esperamos o GPS e o servidor
       — é bloqueado silenciosamente. Foi por isso que, no primeiro teste, o
       WhatsApp só abriu quando ele tocou no botão verde.

       Então abrimos uma aba em branco no toque, escrevemos nela um "preparando
       o pedido de socorro" para ela não olhar para um vazio, e no fim
       apontamos essa mesma aba para o WhatsApp com a mensagem pronta. */
    let janela: Window | null = null;
    let cachorro: number | null = null;
    /* ── E NÃO FAZEMOS ISSO NO APP INSTALADO ──────────────────────────────
       Num PWA na Tela de Início (ou na casca nativa) NÃO existe aba: o
       `window.open` abre uma visão que toma a tela inteira, e sem barra de
       navegador não há botão de voltar. Se ela não navegar para lugar nenhum,
       a paciente fica presa na tela verde "Abrindo o WhatsApp…" e só sai
       matando o app — que foi exatamente o que o dono viu, e é o pior defeito
       possível numa tela de emergência.

       Ali o caminho é outro e é seguro: o aviso sai igual (push, e-mail e SMS
       já não dependiam desta janela), e o WhatsApp abre pelo BOTÃO VERDE que
       aparece logo depois — um toque de verdade, que o iOS entrega ao
       aplicativo do WhatsApp sem tirar a paciente do app. */
    if (linkWhatsApp(info.emergencyPhone) && !emTelaCheia()) {
      janela = window.open("", "_blank");
      try {
        /* Esta tela dura o tempo de pegar a coordenada e chamar o servidor —
           cerca de um segundo quando a localização está liberada. Ela existe
           porque a alternativa é uma aba `about:blank` cinza, e porque sem a
           aba aberta AQUI, dentro do toque, o iPhone bloqueia a abertura do
           WhatsApp e ela teria que apertar um segundo botão. Um segundo de
           tela de passagem custa menos que um toque a mais numa emergência. */
        janela?.document.write(
          `<!doctype html><meta charset="utf-8">
           <meta name="viewport" content="width=device-width,initial-scale=1">
           <title>Abrindo o WhatsApp…</title>
           <body style="margin:0;display:grid;place-items:center;height:100vh;
             font-family:system-ui,sans-serif;background:#25D366;color:#fff;text-align:center">
             <div>
               <p style="font-size:17px;font-weight:700;margin:0">Abrindo o WhatsApp…</p>
               <p style="font-size:13px;margin:14px 24px 0;opacity:.92;line-height:1.4">
                 O aviso já foi enviado para quem você cadastrou.
               </p>
               <!-- SAÍDA. Uma tela de passagem sem porta é uma armadilha:
                    basta o WhatsApp não estar instalado para ela virar o fim
                    do caminho. O botão fecha esta aba e devolve a paciente ao
                    app, onde o 192 continua a um toque. -->
               <button onclick="window.close()" style="margin-top:22px;border:0;
                 border-radius:999px;padding:12px 22px;font-size:15px;font-weight:700;
                 background:#fff;color:#178a45">Voltar ao app</button>
             </div>
           </body>`,
        );
      } catch {
        /* algumas WebViews não deixam escrever; a aba em branco resolve igual */
      }
      /* ── CÃO DE GUARDA ────────────────────────────────────────────────
         A tela de passagem existe para durar ~1 s. Se o servidor demorar, a
         rede cair ou algo lançar num caminho que eu não previ, ela ficaria
         aberta para sempre — e uma tela verde parada é indistinguível de app
         travado, ainda mais em pânico.

         12 s: mais que o pior caso somado (5 s de GPS + 2 s de endereço + o
         disparo), e menos que a paciência de quem está passando mal. Fechar
         não perde nada: o aviso já saiu por push, e-mail e SMS, e o botão
         verde continua na tela. */
      cachorro = window.setTimeout(() => {
        try {
          if (janela && !janela.closed) janela.close();
        } catch {
          /* aba de outra origem já navegada: nada a fazer, e nada a quebrar */
        }
      }, 12000);
    }

    let lat: number | null = null;
    let lng: number | null = null;
    let address: string | null = null;
    /* Se a leitura pré-aquecida ainda vale (5 min), ela é usada e NÃO pedimos de
       novo — o pedido novo aconteceria com a página já em segundo plano por
       causa da aba do WhatsApp, que é exatamente o que não funciona no iOS. */
    const fresca = posicao && Date.now() - posicao.em < 5 * 60_000 ? posicao : null;
    if (fresca) {
      lat = fresca.lat;
      lng = fresca.lng;
    }
    try {
      if (!fresca) {
        const coord = await localizacaoAgora(
          /* Três escolhas, e nenhuma é sobre "ser rápido por ser rápido":

             `enableHighAccuracy: false` — alta precisão espera o GPS travar
             nos satélites, o que leva 10s ou mais e FALHA dentro de casa, que
             é onde a maioria das emergências acontece. Sem ela, a posição vem
             da rede em ~1s, com erro de algumas dezenas de metros. Para uma
             ambulância te achar, 50m é o mesmo que 5m; a diferença entre 1s e
             12s não é.

             `maximumAge: 120000` — aceita uma leitura de até 2 minutos atrás.
             O aparelho quase sempre tem uma, e ela é boa: em dois minutos
             ninguém foi longe.

             `timeout: 5000` — o limite para desistir. Cinco segundos é o ponto
             em que esperar mais custa mais do que a coordenada vale: depois
             disso a tela de espera do WhatsApp começa a incomodar e o socorro
             atrasa. Passou, o aviso sai sem ela em vez de não sair. */
          { timeout: 5000, maximumAge: 120000, enableHighAccuracy: false },
        );
        if (coord) {
          lat = coord.lat;
          lng = coord.lng;
          try {
            /* TETO OBRIGATÓRIO aqui. Este `fetch` é opcional — só traduz a
               coordenada em "Rua tal, bairro tal" — e estava entre a
               localização e o DISPARO, sem timeout. Numa rede ruim ou num wi-fi
               de hospital que engole a requisição, o SOS nunca saía: o botão
               ficava travado em "Localizando e avisando…" para sempre, sem erro
               e sem aviso a ninguém. Um enfeite não pode segurar a emergência.

               2 segundos: se o nome da rua não chegou nisso, o link do mapa
               resolve igual. */
            const corta = new AbortController();
            const alarme = setTimeout(() => corta.abort(), 2000);
            try {
              const resp = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
                { signal: corta.signal },
              );
              address = (await resp.json()).display_name ?? null;
            } finally {
              clearTimeout(alarme);
            }
          } catch {
            /* nome do local é opcional — o link do mapa já resolve */
          }
        } else {
          /* Antes esta falha era engolida em silêncio e o aviso saía dizendo
             "não foi possível obter a localização" sem que ninguém soubesse
             POR QUÊ. Numa emergência a coordenada é o dado mais útil da
             mensagem inteira: se ela não vai, a pessoa precisa saber na hora
             que precisa liberar — e não descobrir depois, lendo o WhatsApp. */
          toast.error(
            (await localizacaoNegada())
              ? "Sem permissão de localização — o aviso vai sem ela. Libere nos ajustes do aparelho."
              : "Não consegui pegar a sua localização a tempo — o aviso vai sem ela.",
            { duration: 6000 },
          );
        }
      }

      const { data: s } = await supabase.auth.getSession();
      if (!s.session) throw new Error("sem sessão");
      const r = await dispararEmergencia({
        data: { accessToken: s.session.access_token, latitude: lat, longitude: lng, address },
      });
      if (!r.ok) throw new Error("falhou");

      setCanais(r.canais);
      setPanic(r.canais.destinos.length ? "sent" : "ninguem");
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
      if (cachorro !== null) window.clearTimeout(cachorro);
      const alvo = linkWhatsApp(info.emergencyPhone);
      if (alvo && r.mensagem) {
        const url = `${alvo}?text=${encodeURIComponent(r.mensagem)}`;
        if (janela && !janela.closed) {
          janela.location.href = url;
          setZapAbriu(true);
        } else if (!emTelaCheia()) {
          // A aba do toque não sobreviveu (ela fechou, ou a WebView recusou):
          // tenta agora e, se falhar, o botão verde continua a um toque.
          setZapAbriu(!!window.open(url, "_blank", "noopener,noreferrer"));
        }
        /* No app instalado não tentamos abrir nada sozinhos — nem aqui nem
           acima. `zapAbriu` fica falso de propósito, e é ele que faz o botão
           verde aparecer dizendo "Mandar no WhatsApp" em vez de "abrir de
           novo". */
      } else {
        janela?.close();
      }
      if (r.canais.destinos.length) {
        toast.success(`Avisei ${r.canais.destinos.map((d) => d.nome).join(" e ")} 💛`);
      } else {
        toast.error("Não consegui avisar ninguém automaticamente — ligue 192.");
      }
    } catch {
      if (cachorro !== null) window.clearTimeout(cachorro);
      janela?.close();
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
    medNome ? (medCrm ? `Medico: ${medNome} - ${medCrm}` : `Medico: ${medNome}`) : "",
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
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-6 pb-[calc(1.5rem+var(--safe-bottom))] shadow-xl sm:rounded-3xl sm:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        {/* ─────────────────────────────────────────────────────────────
            A PRIMEIRA DOBRA SEGUE O MODELO APROVADO (ago/2026).

            O que mudou não foi só estilo: mudou a HIERARQUIA. Antes, a
            primeira coisa da tela eram dois botões lado a lado (192 e
            WhatsApp) e o "pedir socorro" vinha depois, como uma pílula fina.
            Agora o SOS é um círculo que ocupa dois terços da largura e os
            outros números viram "Outras opções" abaixo dele.

            A razão é o dedo em pânico: um alvo circular de ~250px acerta-se
            sem mirar, e é o único caminho da tela que avisa MÉDICO e CONTATO
            de uma vez, com localização, sem ela digitar nada. Os outros dois
            exigem que ela saiba o que dizer a um estranho.
            ───────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-[2rem] font-extrabold leading-none tracking-tight text-foreground">
            Emergência
          </p>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-xl text-foreground shadow-[0_2px_10px_rgba(0,0,0,0.10)] ring-1 ring-black/5"
          >
            ✕
          </button>
        </div>

        {/* ── O BOTÃO SOS ────────────────────────────────────────────────
            Círculo, e não retângulo: num alvo redondo qualquer direção do
            toque cai dentro, e o anel branco com halo o separa do fundo sem
            depender da cor — que é o que faz ele continuar óbvio para quem
            enxerga pouco ou está com a tela no sol. */}
        <div className="mt-5 flex justify-center">
          <button
            onClick={sendLocation}
            disabled={panic !== "idle"}
            aria-label="Pedir socorro agora"
            className="press relative flex aspect-square w-[min(66vw,16.5rem)] items-center justify-center rounded-full disabled:opacity-90"
            style={{
              /* Halo VERMELHO por fora e anel BRANCO por dentro: os dois
                 juntos sustentam o botão sobre fundo claro e sobre a foto de
                 um hospital, que é onde esta tela costuma ser aberta. */
              background:
                panic === "ninguem"
                  ? "linear-gradient(180deg,#f0a30a,#d98600)"
                  : "linear-gradient(180deg,#fd1010,#e80709)",
              boxShadow:
                "0 0 0 8px #fff, 0 0 0 12px rgba(253,16,16,0.16), 0 18px 40px -12px rgba(232,7,9,0.55)",
            }}
          >
            <span className="flex flex-col items-center px-6 text-white">
              {panic === "idle" ? (
                <>
                  {/* A sirene, desenhada: emoji de sirene tem cor e forma
                      próprias em cada sistema, e este é o único desenho da
                      tela que precisa ler igual em todo aparelho. */}
                  <svg viewBox="0 0 48 40" className="h-9 w-11" aria-hidden fill="currentColor">
                    <path d="M24 12c5.2 0 9.4 4.2 9.4 9.4V27H14.6v-5.6C14.6 16.2 18.8 12 24 12z" />
                    <rect x="11.5" y="28.4" width="25" height="4.4" rx="2.2" />
                    <g strokeWidth="2.6" stroke="currentColor" strokeLinecap="round">
                      <path d="M24 6.5V2.6" />
                      <path d="M34.6 10.4l2.8-2.8" />
                      <path d="M13.4 10.4l-2.8-2.8" />
                      <path d="M39.4 19.6h4" />
                      <path d="M8.6 19.6h-4" />
                    </g>
                  </svg>
                  <span className="mt-1 text-[clamp(3.2rem,17vw,4.6rem)] font-black leading-[0.9] tracking-[-0.02em]">
                    SOS
                  </span>
                  <span className="mt-1 text-center text-[clamp(1rem,4.6vw,1.3rem)] font-semibold leading-tight">
                    Pedir socorro agora
                  </span>
                </>
              ) : (
                <span className="text-center text-[clamp(1.05rem,4.8vw,1.35rem)] font-bold leading-snug">
                  {panic === "sending"
                    ? "Localizando e avisando…"
                    : panic === "sent"
                      ? "✓ Aviso enviado"
                      : "Ninguém foi avisado — ligue 192"}
                </span>
              )}
            </span>
          </button>
        </div>

        {panic === "idle" && (
          <>
            {/* ── O QUE O BOTÃO FAZ, antes de ela apertar ──────────────
                A frase mais importante da tela é a segunda: "sem você
                precisar escrever nada". É ela que responde ao medo de quem
                está passando mal e não sabe o que dizer. */}
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 ring-1 ring-black/5">
              {/* Pin desenhado pelo mesmo motivo do fone. */}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15">
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="currentColor">
                  <path d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.4 6.4 11.6 6.7 11.9.3.3.7.3 1 0 .3-.3 6.7-6.5 6.7-11.9 0-4-3.2-7.2-7.2-7.2zm0 9.9a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4z" />
                </svg>
              </span>
              <p className="text-[13.5px] leading-snug text-foreground">
                Avisa{" "}
                {[
                  medNome ? medNome.split(" ").slice(0, 2).join(" ") : null,
                  info.emergencyContact ? info.emergencyContact.split(" ")[0] : null,
                ]
                  .filter(Boolean)
                  .join(" e ") || "quem você cadastrou"}
                {posicao ? " com a sua localização" : ""},{" "}
                <strong className="font-bold text-rose-600 dark:text-rose-400">
                  sem você precisar escrever nada.
                </strong>
              </p>
            </div>

            {/* ── O ESTADO DA LOCALIZAÇÃO, ANTES DA EMERGÊNCIA ─────────
                A hora de descobrir que o aviso vai sair sem localização não é
                depois de apertar — é agora, com calma, quando ainda dá para
                liberar a permissão. */}
            <div className="mt-2.5 flex justify-center">
              {posicao ? (
                <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-[13px] font-bold text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
                  Localização pronta
                </span>
              ) : posicaoNegada ? (
                <button
                  type="button"
                  onClick={() =>
                    toast("Libere a localização nos ajustes do navegador e reabra esta tela.", {
                      duration: 7000,
                    })
                  }
                  className="flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-[13px] font-bold text-amber-800 underline underline-offset-2 dark:bg-amber-500/12 dark:text-amber-300"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  Sem localização — o aviso vai sem ela
                </button>
              ) : (
                <span className="flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-[13px] font-medium text-muted-foreground">
                  <span
                    className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground"
                    aria-hidden
                  />
                  Buscando sua localização…
                </span>
              )}
            </div>
          </>
        )}

        {/* O que REALMENTE saiu. A tela nunca diz "enviado" no genérico: quem
            foi avisado aparece pelo nome, e quem não foi também. */}
        {(panic === "sent" || panic === "ninguem") && canais && (
          <div
            /* Âmbar quando ninguém foi avisado: o painel ficava verde de sucesso
               enquanto o texto dentro dele dizia "ninguém foi avisado". */
            className={`mt-2 rounded-2xl px-3.5 py-3 text-[12px] leading-snug ${
              panic === "ninguem"
                ? "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                : "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
            }`}
          >
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
        {(panic === "sent" || panic === "ninguem") && zap && linkWhatsApp(info.emergencyPhone) && (
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
        {(panic === "sent" || panic === "ninguem") && zapAbriu && (
          <p className="mt-1.5 text-center text-[11px] leading-snug text-muted-foreground">
            A mensagem já está escrita no WhatsApp — é só apertar enviar.
          </p>
        )}

        {/* Localização em tempo real.

            O WhatsApp NÃO permite que um link ou uma API ligue isso — é uma
            ação que só a pessoa faz, dentro do aplicativo, de propósito (seria
            grave se um link conseguisse rastrear alguém). O que dá para fazer
            é o que está aqui: dizer os três toques, na ordem, na tela em que
            ela já está. Enviada a mensagem, o aviso é o que vale mais: uma
            coordenada de um instante vira um trajeto de oito horas. */}
        {(panic === "sent" || panic === "ninguem") && zapAbriu && (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-[12.5px] font-bold text-emerald-800 dark:text-emerald-300">
              Se você estiver a caminho do hospital, compartilhe onde você está
            </p>
            <p className="mt-1 text-[12px] leading-snug text-foreground/75">
              Dentro da conversa do WhatsApp: toque em <b>📎</b> → <b>Localização</b> →{" "}
              <b>Localização em tempo real</b> → <b>8 horas</b>. Quem estiver te procurando passa a
              ver você se movendo.
            </p>
          </div>
        )}

        {/* ── OUTRAS OPÇÕES ──────────────────────────────────────────────
            Depois do SOS, e não antes. Os dois são caminhos que EXIGEM que ela
            saiba o que dizer — para um atendente do SAMU ou para o médico. O
            botão de cima não exige nada, e por isso vem primeiro. */}
        <div className="mt-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-[14px] font-bold text-foreground">Outras opções</span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* 192 — cartão CLARO com o telefone vermelho. No modelo ele não é
              um bloco vermelho cheio: vermelho cheio ao lado do círculo do SOS
              faria dois "botões de emergência" disputando o olho. */}
          <a
            href="tel:192"
            className="press flex flex-col items-center justify-between gap-3 rounded-3xl bg-card px-3 py-4 text-center ring-1 ring-black/5"
          >
            <span className="text-[2.6rem] leading-none" aria-hidden>
              🚑
            </span>
            <span>
              <span className="block text-[1.05rem] font-extrabold leading-tight text-foreground">
                Ligar 192
              </span>
              <span className="block text-[1.05rem] font-extrabold leading-tight text-rose-600">
                (SAMU)
              </span>
            </span>
            {/* O telefone DESENHADO, e não o emoji 📞: emoji tem cor própria em
                cada sistema (sai preto no iOS) e o modelo pede um fone
                vermelho aqui e verde no cartão do WhatsApp. É a mesma lição do
                calendário da fita. */}
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-rose-600 ring-1 ring-rose-300"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden fill="currentColor">
                <path d="M6.6 3.5c.5 0 1 .3 1.2.8l1.3 3a1.3 1.3 0 0 1-.3 1.5l-1.3 1.1a12 12 0 0 0 5.6 5.6l1.1-1.3a1.3 1.3 0 0 1 1.5-.3l3 1.3c.5.2.8.7.8 1.2v2.7c0 .8-.6 1.4-1.4 1.4C10 20.5 3.5 14 3.5 5.9c0-.8.6-1.4 1.4-1.4h1.7z" />
              </svg>
            </span>
          </a>

          {medZap ? (
            <a
              href={medZap}
              target="_blank"
              rel="noopener noreferrer"
              className="press flex flex-col items-center justify-between gap-3 rounded-3xl px-3 py-4 text-center text-white"
              style={{ background: "linear-gradient(180deg,#2da348,#259941)" }}
            >
              {/* O logo desenhado, e não o emoji 💬: o balão genérico não diz
                  WhatsApp, e é o reconhecimento da marca que faz o dedo ir. */}
              <svg viewBox="0 0 32 32" className="h-11 w-11" aria-hidden fill="currentColor">
                <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-4 1 1.1-3.9-.3-.4A10.5 10.5 0 015.4 16C5.4 10.2 10.2 5.4 16 5.4S26.6 10.2 26.6 16 21.8 26.6 16 26.6z" />
                <path d="M21.8 18.6c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2c-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.1 2.9 1.2 3.5 1 4.1.9.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z" />
              </svg>
              <span className="text-[1.05rem] font-extrabold leading-tight">
                WhatsApp do médico
              </span>
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#259941]"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden fill="currentColor">
                  <path d="M6.6 3.5c.5 0 1 .3 1.2.8l1.3 3a1.3 1.3 0 0 1-.3 1.5l-1.3 1.1a12 12 0 0 0 5.6 5.6l1.1-1.3a1.3 1.3 0 0 1 1.5-.3l3 1.3c.5.2.8.7.8 1.2v2.7c0 .8-.6 1.4-1.4 1.4C10 20.5 3.5 14 3.5 5.9c0-.8.6-1.4 1.4-1.4h1.7z" />
                </svg>
              </span>
            </a>
          ) : (
            /* Médico vinculado sem telefone cadastrado, ou nenhum médico. O
               lugar não fica vazio: 193 atende sempre, em qualquer estado. */
            <a
              href="tel:193"
              className="press flex flex-col items-center justify-between gap-3 rounded-3xl bg-card px-3 py-4 text-center ring-1 ring-black/5"
            >
              <span className="text-[2.6rem] leading-none" aria-hidden>
                🚒
              </span>
              <span>
                <span className="block text-[1.05rem] font-extrabold leading-tight text-foreground">
                  Ligar 193
                </span>
                <span className="block text-[1.05rem] font-extrabold leading-tight text-rose-600">
                  (Bombeiros)
                </span>
              </span>
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-rose-600 ring-1 ring-rose-300"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden fill="currentColor">
                  <path d="M6.6 3.5c.5 0 1 .3 1.2.8l1.3 3a1.3 1.3 0 0 1-.3 1.5l-1.3 1.1a12 12 0 0 0 5.6 5.6l1.1-1.3a1.3 1.3 0 0 1 1.5-.3l3 1.3c.5.2.8.7.8 1.2v2.7c0 .8-.6 1.4-1.4 1.4C10 20.5 3.5 14 3.5 5.9c0-.8.6-1.4 1.4-1.4h1.7z" />
                </svg>
              </span>
            </a>
          )}
        </div>

        {!medZap && !medTel && (
          <p className="mt-2.5 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-center text-[12px] leading-snug text-amber-900 dark:bg-amber-500/12 dark:text-amber-200">
            {medNome
              ? `${medNome} ainda não cadastrou um telefone no app. Use o 192 ou o 193 acima.`
              : medicoIndefinido
                ? "Carregando os dados do seu médico… o 192 e o 193 acima funcionam agora."
                : "Você ainda não tem um médico vinculado no app. Use o 192 ou o 193 acima."}
          </p>
        )}
        {medTel && (
          <a
            href={medTel}
            className="press mt-2.5 flex items-center justify-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold text-foreground ring-1 ring-black/5"
          >
            📞 Ligar para {medNome.split(" ").slice(0, 2).join(" ")}
          </a>
        )}

        {/* ── CVV ────────────────────────────────────────────────────────
            Quase ninguém sabe o que é "CVV", e um número que a pessoa não
            entende é um número que ela não liga. Por isso a linha explica
            ANTES de oferecer — e a segunda linha nomeia o que ela está
            sentindo, que é o que faz alguém reconhecer que é para ela. */}
        <a
          href="tel:188"
          className="press mt-3 flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 ring-1 ring-black/5"
        >
          <span className="text-2xl leading-none" aria-hidden>
            ❤️
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-snug text-foreground">
              <strong className="font-bold">CVV:</strong> apoio emocional gratuito, 24h, sigiloso.
            </span>
            <span className="block text-[13px] leading-snug text-muted-foreground">
              Quando a angústia é o que está doendo.
            </span>
          </span>
          <span className="shrink-0 text-xl text-muted-foreground" aria-hidden>
            ›
          </span>
        </a>

        {/* 193 desceu para cá: no modelo aprovado a primeira dobra termina no
            CVV. Ele não saiu do app — sai da disputa pelo olho de quem está em
            pânico, que já tem o círculo vermelho e o 192 acima. */}
        {medZap && (
          <a
            href="tel:193"
            className="press mt-2 flex items-center justify-center gap-2 rounded-2xl bg-card px-3 py-2.5 text-[13px] text-foreground ring-1 ring-black/5"
          >
            <span aria-hidden>🚒</span>
            <span className="font-bold">193</span>
            <span className="text-muted-foreground">Bombeiros</span>
          </a>
        )}

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
                {medNome && (
                  <Row label="Médico" value={medCrm ? `${medNome} · ${medCrm}` : medNome} />
                )}
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
