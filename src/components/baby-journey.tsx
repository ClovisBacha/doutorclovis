import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BONUS_VINCULO_MEDICO } from "@/lib/economia-sementinhas";
import {
  ANUAL_CENTAVOS,
  ANUAL_MENSAL_EQUIV_CENTAVOS,
  DESCONTO_ANUAL_PCT,
  MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
  brl,
} from "@/lib/promo";
import { X, Lock, Sparkles } from "lucide-react";
import {
  BabyIllustration,
  STAGE_LABEL,
  STAGE_RANGES,
  clampTone,
} from "@/components/baby-illustration";
import { babyForWeek, babyStage, type BabyStage } from "@/lib/gestacao";

/**
 * Jornada do Bebê — o gatilho de Premium pedido pelo produto:
 * tocar na foto do bebê abre um caminho com os 5 estágios da ilustração.
 * Estágios já vividos (e o atual) ficam desbloqueados, com a arte e as
 * dicas; os FUTUROS aparecem com "?" e cadeado — tocar neles abre o popup
 * do Premium. Assinante Premium vê o caminho inteiro desbloqueado, até a
 * "prévia do parto".
 */

const STAGE_ORDER: BabyStage[] = ["embriao", "inicial", "feto", "tardio", "termo"];

/** Dica exclusiva de cada estágio (o "spoiler" que o Premium desbloqueia). */
const STAGE_TIP: Record<BabyStage, string> = {
  embriao:
    "O coração começa a bater por volta da 6ª semana — mais rápido que o seu, quase o dobro.",
  inicial: "Os dedinhos se separam e as digitais se formam — únicas no mundo, já agora.",
  feto: "Ela começa a ouvir sua voz aqui dentro. Conversar e cantar já vale — e acalma.",
  tardio: "Fase de engordar: o bebê ganha ~200g por semana e treina a respiração para o mundo.",
  termo:
    "Prontinho para nascer: pulmões maduros, posição de parto e as bochechas que você vai beijar.",
};

export function BabyJourneyModal({
  currentWeek,
  tone = 0,
  premium,
  onClose,
  onWantPremium,
}: {
  currentWeek: number;
  tone?: number;
  premium: boolean;
  onClose: () => void;
  onWantPremium: () => void;
}) {
  const currentStage = babyStage(currentWeek);
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  // Trava o scroll da página atrás do sheet (evita scroll chaining no iOS).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-background sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="font-serif text-xl">A jornada do seu bebê 👣</p>
            <p className="text-xs text-muted-foreground">
              Do primeiro batimento ao dia do parto — semana {currentWeek}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full border border-border p-1.5 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="relative">
            {/* trilho vertical */}
            <div className="absolute bottom-6 left-[44px] top-6 w-0.5 bg-gradient-to-b from-primary/50 via-primary/25 to-border" />

            <div className="space-y-5">
              {STAGE_ORDER.map((stage, i) => {
                const [wMin, wMax] = STAGE_RANGES[stage];
                const unlocked = premium || i <= currentIdx;
                const isCurrent = i === currentIdx;
                // Semana exibida: no estágio atual, a semana real; nos
                // passados/futuros, o meio do intervalo (arte mais típica).
                const showWeek = isCurrent ? currentWeek : Math.round((wMin + wMax) / 2);
                const info = babyForWeek(showWeek);

                return (
                  <button
                    key={stage}
                    onClick={() => {
                      if (!unlocked) onWantPremium();
                    }}
                    className={`relative flex w-full items-center gap-4 rounded-2xl border p-3.5 text-left transition-all ${
                      isCurrent
                        ? "border-primary/50 bg-primary/5 shadow-[var(--shadow-card)]"
                        : unlocked
                          ? "border-border bg-card"
                          : "border-dashed border-border bg-secondary/30 active:scale-[0.98]"
                    }`}
                  >
                    {/* nó do caminho */}
                    <div
                      className={`relative z-10 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${
                        isCurrent
                          ? "border-primary bg-card"
                          : unlocked
                            ? "border-primary/30 bg-card"
                            : "border-border bg-secondary"
                      }`}
                    >
                      {unlocked ? (
                        <BabyIllustration
                          week={showWeek}
                          tone={clampTone(tone)}
                          showSac={false}
                          showInfo={false}
                          className="h-14 w-14"
                        />
                      ) : (
                        <span className="font-serif text-3xl text-muted-foreground/70">?</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-bold">
                          {unlocked ? STAGE_LABEL[stage] : "Ainda é surpresa…"}
                        </p>
                        {isCurrent && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                            você está aqui
                          </span>
                        )}
                        {!unlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Semanas {wMin}–{wMax}
                        {unlocked && info.weight !== "—" ? ` · ${info.size} · ${info.weight}` : ""}
                      </p>
                      {/* Bloqueado: texto-isca genérico borrado (a dica real
                          NÃO vai ao DOM — nem via devtools). */}
                      <p
                        className={`mt-1 text-xs leading-snug ${
                          unlocked ? "text-muted-foreground" : "select-none text-transparent"
                        }`}
                        style={
                          unlocked ? undefined : { textShadow: "0 0 9px rgba(120,100,90,0.6)" }
                        }
                        aria-hidden={!unlocked}
                      >
                        {unlocked
                          ? STAGE_TIP[stage]
                          : "Uma surpresa linda acontece nesta fase do seu bebê aqui dentro"}
                      </p>
                      {!unlocked && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <Sparkles className="h-3 w-3" /> Desbloquear com o Premium
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {premium ? (
            <p className="mt-5 rounded-2xl bg-emerald-50 p-3 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
              ⭐ Premium ativo — a jornada inteira do seu bebê está desbloqueada.
            </p>
          ) : (
            <button
              onClick={onWantPremium}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-bold text-white shadow-[0_8px_30px_rgba(167,139,250,0.35)]"
            >
              ✨ Ver a jornada completa até o parto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Popup do Premium — bonito, tecnológico e direto: a comparação com pagar mês
 * a mês, os desbloqueios visuais, e o campo do CÓDIGO do médico no rodapé (o
 * que o médico gera libera o Premium na hora; futuramente, cupons de
 * desconto). Reutiliza a identidade tech (brain-tech/grid/scanline).
 */
export function PremiumUpsellModal({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  /** Chamado quando o código do médico foi resgatado (recarregar o perfil). */
  onUnlocked: () => void;
}) {
  const [busy, setBusy] = useState<"annual" | "monthly" | null>(null);
  const [coupon, setCoupon] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  // trava o scroll do fundo enquanto o popup está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function checkout(plan: "annual" | "monthly") {
    setBusy(plan);
    try {
      /* Portão da loja: assinatura digital dentro do app nativo tem de passar
         pela Apple/Google (diretriz 3.1.1). Abrir o Stripe aqui reprova o app
         na revisão. Mesma regra da OfertaPremium, do QuizPaywall e da
         LojaSementinhas — esta era a última porta de pagamento da área da
         paciente que ainda estava aberta. */
      /* A regra vem de `canal-de-venda.ts`, com a frase junto. A versão
         anterior desta mensagem mandava assinar pelo site — sugerir caminho
         de pagamento fora do app é justamente o que a loja proíbe. */
      const { ehNativo } = await import("@/lib/nativo");
      const { podeComprarAqui } = await import("@/lib/canal-de-venda");
      const veredito = podeComprarAqui("premium_paciente", ehNativo());
      if (!veredito.pode) {
        toast(veredito.texto, { duration: 6000 });
        return;
      }
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Entre na sua conta para assinar.");
        return;
      }
      const { createSubscriptionCheckout } = await import("@/lib/billing.functions");
      const { storedAffiliateCode } = await import("@/routes/__root");
      const refCode = storedAffiliateCode();
      const res = await createSubscriptionCheckout({
        data: {
          accessToken: s.session.access_token,
          product: "quiz_premium",
          plan,
          returnPath: "/minha-conta",
          ...(refCode ? { refCode } : {}),
        },
      });
      if (res.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(
        res.error === "pagamento_indisponivel"
          ? "O pagamento está sendo configurado. Tente em instantes."
          : "Não foi possível abrir o pagamento — tente novamente.",
      );
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  async function redeem() {
    const code = coupon.trim().toUpperCase();
    if (!code || redeeming) return;
    // Mesmo formato do servidor (4–16 chars): valida aqui para o erro ser
    // claro ("código inválido") e não um falso "falha de conexão".
    if (code.length < 4 || code.length > 16) {
      toast.error("Código inválido — confira o código do seu médico (4 a 16 caracteres).");
      return;
    }
    setRedeeming(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Entre na sua conta para usar o código.");
        return;
      }
      const { redeemInviteCode } = await import("@/lib/invites.functions");
      const res = await redeemInviteCode({
        data: { accessToken: s.session.access_token, code },
      });
      if (res.ok) {
        /* Ela dizia "Premium liberado". O resgate parou de dar Premium quando
           o médico deixou de dar a assinatura; hoje ele vincula e paga o bônus
           de Sementinhas. Anunciar Premium e entregar outra coisa faz a
           paciente ir procurar o que não existe. */
        toast.success(`Médico vinculado! Você ganhou ${BONUS_VINCULO_MEDICO} Sementinhas 🌱`);
        onUnlocked();
        onClose();
        return;
      }
      toast.error("Cupom inválido ou já utilizado — confira com quem te enviou.");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="brain-tech relative w-full max-w-sm overflow-hidden rounded-t-3xl text-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* identidade tech: grade de circuito estática (sem varredura) */}
        <div className="brain-grid pointer-events-none absolute inset-0" aria-hidden />

        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white/80"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-6 pb-6 pt-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">
            <Sparkles className="h-3 w-3" /> Obstétrica Premium
          </p>
          <h3 className="mt-3 font-serif text-2xl leading-tight">
            Desbloqueie a{" "}
            <span className="bg-gradient-to-r from-pink-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
              jornada completa
            </span>{" "}
            do seu bebê
          </h3>

          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li className="flex items-start gap-2">
              <span>👣</span> Todos os estágios do bebê revelados, até a prévia do parto
            </li>
            <li className="flex items-start gap-2">
              <span>🔮</span> Dicas e segredos de cada fase, antes de chegar nela
            </li>
            <li className="flex items-start gap-2">
              <span>📚</span> Revisite qualquer aula da Jornada diária, quando quiser
            </li>
          </ul>

          {/* ─── OS TRÊS NÚMEROS ERAM ESCRITOS À MÃO, E OS TRÊS ESTAVAM ERRADOS
              "de R$ 19,90 por R$ 9,90/mês, no plano anual (R$ 118,80/ano)".

              O anual passou a R$ 109,90 (equivalente de R$ 9,16), e esta tela
              ficou com a tabela antiga — cobrando um valor e anunciando outro,
              que é a reclamação mais cara que existe.

              Agora os três saem de `promo.ts`. E o riscado é o preço REAL de
              pagar mês a mês por doze meses, com a legenda dizendo o que ele é:
              riscar um número que ninguém cobra é o "preço de referência" que o
              CDC proíbe. */}
          <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4 text-center backdrop-blur-sm">
            <p className="text-xs text-white/60">
              <span className="font-semibold line-through">{brl(REFERENCIA_CENTAVOS)}</span> pagando
              mês a mês · por
            </p>
            <p className="mt-0.5 font-serif text-4xl font-bold">{brl(ANUAL_CENTAVOS)}</p>
            <p className="text-[11px] text-white/55">
              no plano anual · equivale a {brl(ANUAL_MENSAL_EQUIV_CENTAVOS)}/mês ·{" "}
              {DESCONTO_ANUAL_PCT}% de desconto
            </p>
            <div className="mt-3 grid gap-2">
              <button
                onClick={() => checkout("annual")}
                disabled={busy !== null}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_30px_rgba(167,139,250,0.4)] transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {busy === "annual" ? "Abrindo…" : "Assinar anual — 50% OFF"}
              </button>
              <button
                onClick={() => checkout("monthly")}
                disabled={busy !== null}
                className="w-full rounded-full border border-white/25 px-5 py-2.5 text-xs font-semibold text-white/85 disabled:opacity-60"
              >
                {busy === "monthly" ? "Abrindo…" : `Prefiro mensal — ${brl(MENSAL_CENTAVOS)}`}
              </button>
            </div>
          </div>

          {/* Código do médico: vincula e paga Sementinhas — não dá Premium. */}
          <div className="mt-4 text-center">
            {couponOpen ? (
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && redeem()}
                  maxLength={16}
                  placeholder="CÓDIGO DO CUPOM"
                  autoFocus
                  className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-center text-sm font-semibold uppercase tracking-widest text-white placeholder:text-white/40 focus:border-cyan-300/60 focus:outline-none"
                />
                <button
                  onClick={redeem}
                  disabled={redeeming || !coupon.trim()}
                  className="rounded-full bg-cyan-400/90 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-50"
                >
                  {redeeming ? "…" : "Aplicar"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCouponOpen(true)}
                className="text-xs font-semibold text-cyan-200 underline underline-offset-4"
              >
                🌱 Tenho o código do meu médico
              </button>
            )}
            <p className="mt-2 text-[10px] text-white/40">
              Cancele quando quiser · tem o código do seu médico? Aplique acima e ganhe{" "}
              {BONUS_VINCULO_MEDICO} Sementinhas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
