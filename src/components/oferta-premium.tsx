/**
 * Oferta do Premium — a folha que sobe quando a paciente toca em algo que o
 * plano dela não alcança.
 *
 * Existia UM paywall no app, dentro do Caminho, e ele só falava de aula. A
 * loja do Cantinho não tinha nenhum: 38 dos 72 itens pagos são premium e o
 * tile deles era um `<span>` sem `onClick`. Tocar não fazia absolutamente
 * nada — nem erro, nem explicação, nem caminho para assinar. Metade da loja
 * era parede muda, e a paciente não tinha como saber que aquilo tinha porta.
 *
 * O tom segue a decisão do produto: neutro. Nada de urgência inventada,
 * contador, "só hoje" ou frase que faça a paciente se sentir devendo algo.
 * Diz o que o Premium abre, quanto custa, e sai da frente.
 *
 * Ela NÃO concede nada: o acesso só é liberado pelo webhook depois do
 * pagamento confirmado, ou pelo código do médico — as duas portas que já
 * existiam.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PRECO_MENSAL = 19.9;
const PRECO_ANUAL_MES = 9.9;
/** O total do anual, cobrado DE UMA VEZ — é o valor que sai do cartão dela. */
const PRECO_ANUAL_TOTAL = PRECO_ANUAL_MES * 12;

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export type MotivoOferta = "item" | "aula" | "geral";

export function OfertaPremium({
  aberto,
  onFechar,
  motivo = "geral",
  /** Nome do item que ela tentou pegar — a oferta fica concreta com ele. */
  itemNome,
}: {
  aberto: boolean;
  onFechar: () => void;
  motivo?: MotivoOferta;
  itemNome?: string;
}) {
  const [plano, setPlano] = useState<"monthly" | "annual">("annual");
  const [indo, setIndo] = useState(false);
  const [codigoAberto, setCodigoAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [resgatando, setResgatando] = useState(false);

  /* Trava o fundo enquanto a folha está aberta — sem isso, o dedo arrasta a
     lista de trás e a folha parece descolada da tela. */
  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [aberto]);

  /* Esc fecha: no app nativo não há Esc, mas no navegador é o reflexo de
     quem usa teclado, e sem isso a folha vira armadilha. */
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  async function assinar() {
    if (indo) return;
    setIndo(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Entre na sua conta para assinar.");
        setIndo(false);
        return;
      }
      const { createSubscriptionCheckout } = await import("@/lib/billing.functions");
      const { storedAffiliateCode } = await import("@/routes/__root");
      const refCode = storedAffiliateCode();
      const res = await createSubscriptionCheckout({
        data: {
          accessToken: s.session.access_token,
          product: "quiz_premium",
          plan: plano,
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
          : "Não foi possível abrir o pagamento. Tente novamente.",
      );
    } catch {
      toast.error("Não foi possível abrir o pagamento. Tente novamente.");
    }
    setIndo(false);
  }

  async function resgatar() {
    if (codigo.trim().length < 4) {
      toast.error("Digite o código do seu médico.");
      return;
    }
    setResgatando(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Entre na sua conta para usar o código.");
        setResgatando(false);
        return;
      }
      const { redeemInviteCode } = await import("@/lib/invites.functions");
      const res = await redeemInviteCode({
        data: { accessToken: s.session.access_token, code: codigo.trim() },
      });
      if (res.ok) {
        toast.success("Premium liberado! 💛");
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      const msg: Record<string, string> = {
        codigo_invalido: "Código não encontrado. Confira com o seu médico.",
        codigo_usado: "Este código já foi usado. Peça um novo ao seu médico.",
        codigo_inativo: "Este código não está mais ativo.",
        cota_esgotada: "O seu médico já usou todos os convites deste mês.",
        nao_autenticado: "Entre na sua conta para usar o código.",
        falha_resgate: "Não foi possível resgatar. Tente novamente.",
      };
      toast.error(msg[res.error ?? ""] ?? "Não foi possível resgatar o código.");
    } catch {
      toast.error("Não foi possível resgatar o código.");
    }
    setResgatando(false);
  }

  const titulo =
    motivo === "item" && itemNome
      ? `${itemNome} é do Premium`
      : motivo === "aula"
        ? "Rever as aulas é do Premium"
        : "Obstétrica Premium";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="dc-sheet-up relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <h2 className="font-serif text-xl text-foreground">{titulo}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          O Premium abre <strong className="text-foreground">todas as aulas já liberadas</strong>{" "}
          para rever quando quiser, e os{" "}
          <strong className="text-foreground">enfeites exclusivos</strong> do Meu Cantinho. Os
          enfeites continuam se pagando com Sementinhas — a assinatura abre a prateleira, não compra
          o item.
        </p>

        {/* Escolha do plano. O total do anual aparece à vista: preço por mês
            com cobrança anual, sem dizer quanto sai do cartão, é informação
            incompleta — e é a primeira coisa que vira estorno. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setPlano("annual")}
            aria-pressed={plano === "annual"}
            className={`rounded-2xl border p-3 text-left transition ${
              plano === "annual"
                ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                : "border-border bg-background"
            }`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wide text-primary">
              Anual
            </span>
            <span className="mt-0.5 block font-serif text-lg tabular-nums">
              {brl(PRECO_ANUAL_MES)}
            </span>
            <span className="block text-[11px] text-muted-foreground">por mês</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              {brl(PRECO_ANUAL_TOTAL)} cobrados de uma vez
            </span>
          </button>
          <button
            onClick={() => setPlano("monthly")}
            aria-pressed={plano === "monthly"}
            className={`rounded-2xl border p-3 text-left transition ${
              plano === "monthly"
                ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                : "border-border bg-background"
            }`}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Mensal
            </span>
            <span className="mt-0.5 block font-serif text-lg tabular-nums">
              {brl(PRECO_MENSAL)}
            </span>
            <span className="block text-[11px] text-muted-foreground">por mês</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              cancela quando quiser
            </span>
          </button>
        </div>

        <button
          onClick={assinar}
          disabled={indo}
          className="press mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {indo ? "Abrindo…" : "Assinar o Premium"}
        </button>

        {/* Código do médico: existe e é grátis, então fica visível — não
            escondido atrás do pagamento. */}
        {!codigoAberto ? (
          <button
            onClick={() => setCodigoAberto(true)}
            className="mt-3 w-full text-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Tenho um código do meu médico
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 font-mono text-sm tracking-wider"
            />
            <button
              onClick={resgatar}
              disabled={resgatando}
              className="press shrink-0 rounded-full bg-secondary px-4 py-2 text-xs font-bold disabled:opacity-60"
            >
              {resgatando ? "…" : "Usar"}
            </button>
          </div>
        )}

        <button
          onClick={onFechar}
          className="mt-3 w-full py-2 text-center text-xs font-medium text-muted-foreground"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
