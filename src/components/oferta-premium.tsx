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
 * O tom NÃO é neutro desde ago/2026 — o Clóvis pediu cara de promoção, e a
 * tela anterior (só os dois planos, sem nada) era, nas palavras dele, "muito
 * pouco chamativa". A oferta de boas-vindas dá 61% no primeiro ano do anual,
 * por 2h59.
 *
 * O que NÃO mudou é a honestidade, e é o que separa isto de um contador
 * falso: o relógio nasce no servidor, mora no banco, e depois que fecha não
 * reabre — nem limpando os dados do app, nem reinstalando, nem trocando de
 * celular. O desconto é aplicado no servidor, conferindo a janela de novo na
 * hora de criar o checkout. E a tela diz, com todas as letras, que o desconto
 * vale para o PRIMEIRO ANO e quanto custa a renovação. Ver `promo.ts`.
 *
 * O que continua proibido aqui: dizer que a promoção volta, reabrir a janela,
 * ou usar frase que faça a paciente se sentir devendo alguma coisa.
 *
 * Ela NÃO concede nada: o acesso só é liberado pelo webhook depois do
 * pagamento confirmado, ou pelo código do médico — as duas portas que já
 * existiam.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ehNativo } from "@/lib/nativo";
import { brl, formataRestante } from "@/lib/promo";
import type { OfertaBoasVindas } from "@/lib/promo.functions";

const PRECO_MENSAL = 19.9;
const PRECO_ANUAL_MES = 9.9;
/** O total do anual, cobrado DE UMA VEZ — é o valor que sai do cartão dela. */
const PRECO_ANUAL_TOTAL = PRECO_ANUAL_MES * 12;

/* Reais → texto. O `brl` de `promo.ts` recebe CENTAVOS; misturar os dois é a
   forma mais fácil de mostrar R$ 4.633,00 no lugar de R$ 46,33, então o nome
   diz a unidade. */
const reaisBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export type MotivoOferta = "item" | "aula" | "geral";

export function OfertaPremium({
  aberto,
  onFechar,
  motivo = "geral",
  /** Nome do item que ela tentou pegar — a oferta fica concreta com ele. */
  itemNome,
  /**
   * Oferta fixa, só para a bancada de `/preview-oferta`.
   *
   * Existe para a prova visual renderizar ESTE componente em vez de uma cópia
   * do markup: cópia diverge, e uma bancada que mostra outra tela é pior que
   * bancada nenhuma. Em produção nunca é passada — o valor vem do servidor.
   */
  ofertaDeProva,
}: {
  aberto: boolean;
  onFechar: () => void;
  motivo?: MotivoOferta;
  itemNome?: string;
  ofertaDeProva?: OfertaBoasVindas;
}) {
  const [plano, setPlano] = useState<"monthly" | "annual">("annual");
  const [indo, setIndo] = useState(false);
  const [codigoAberto, setCodigoAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [resgatando, setResgatando] = useState(false);
  /* Mesma regra da LojaSementinhas: assinatura digital dentro do app nativo
     tem de passar pela loja da Apple/Google (diretriz 3.1.1). Abrir o Stripe
     aqui reprova o app na revisão. Lido em efeito porque `ehNativo()` olha um
     global do Capacitor, que não existe no SSR. */
  const [nativo, setNativo] = useState(false);
  useEffect(() => setNativo(ehNativo()), []);

  /* A oferta e o contador. `restante` é milissegundos e vem do SERVIDOR — o
     relógio do aparelho só serve para descontar o tempo que passa com a tela
     aberta. Adiantar o celular não estende nada. */
  const [oferta, setOferta] = useState<OfertaBoasVindas | null>(null);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    if (ofertaDeProva) {
      setOferta(ofertaDeProva);
      setRestante(ofertaDeProva.restanteMs);
      if (ofertaDeProva.ativa) setPlano("annual");
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return;
        const { getOfertaBoasVindas } = await import("@/lib/promo.functions");
        const o = await getOfertaBoasVindas({
          data: { accessToken: s.session.access_token },
        });
        if (!vivo) return;
        setOferta(o);
        setRestante(o.restanteMs);
        /* Oferta ativa pré-seleciona o anual: é o único plano com desconto, e
           deixar o mensal marcado enquanto o cartaz fala do anual faria ela
           pagar cheio achando que pegou a promoção. */
        if (o.ativa) setPlano("annual");
      } catch {
        /* Sem oferta: a folha mostra os planos normais. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aberto, ofertaDeProva]);

  /* O contador anda de segundo em segundo enquanto a folha está aberta. */
  useEffect(() => {
    if (!aberto || restante <= 0) return;
    const t = setInterval(() => setRestante((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(t);
  }, [aberto, restante]);

  const promoViva = Boolean(oferta?.ativa) && restante > 0;

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

        {/* ── O cartaz da oferta ────────────────────────────────────────
            Só aparece com a janela aberta. Três coisas ficam ditas aqui, e as
            três de propósito:
              · o desconto e o preço que ela vai pagar;
              · que vale para o PRIMEIRO ANO (a renovação volta ao cheio);
              · quanto tempo falta, de verdade.
            Nada de "última chance", nada de "só hoje", nada que sugira que a
            oferta volta. */}
        {promoViva && oferta && (
          <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-500 p-4 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">
                  Oferta de boas-vindas
                </p>
                <p className="mt-0.5 font-serif text-3xl leading-none">{oferta.descontoPct}% OFF</p>
                <p className="mt-1 text-[12px] text-white/90">no primeiro ano do plano anual</p>
              </div>
              <div className="shrink-0 rounded-xl bg-black/25 px-3 py-2 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/80">
                  termina em
                </p>
                {/* `tabular-nums` para o contador não mudar de largura a cada
                    segundo e empurrar o cartaz. */}
                <p
                  className="font-mono text-lg font-bold tabular-nums"
                  role="timer"
                  aria-live="off"
                >
                  {formataRestante(restante)}
                </p>
              </div>
            </div>
            {/* Duas linhas, não três colunas espremidas. Com tudo lado a lado
                cada preço quebrava no meio — "R$" numa linha, "46,33" na
                outra — e preço partido é o tipo de coisa que faz a paciente
                desconfiar do número. `whitespace-nowrap` em cada valor
                garante que nenhum se parta em nenhuma largura de tela. */}
            <div className="mt-3 rounded-xl bg-white/15 px-3 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="whitespace-nowrap text-[13px] text-white/70 line-through">
                  {brl(oferta.cheioCentavos)}
                </span>
                <span className="whitespace-nowrap font-serif text-[28px] leading-none">
                  {brl(oferta.promoCentavos)}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] font-semibold text-white/95">
                você economiza{" "}
                <span className="whitespace-nowrap">{brl(oferta.economiaCentavos)}</span> no
                primeiro ano
              </p>
            </div>
          </div>
        )}

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
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Anual
              {promoViva && oferta && (
                <span className="rounded-full bg-violet-600 px-1.5 py-px text-[9px] text-white">
                  −{oferta.descontoPct}%
                </span>
              )}
            </span>
            {promoViva && oferta ? (
              <>
                {/* Com a promoção, o card mostra o preço À VISTA do primeiro
                    ano — que é o número que sai do cartão dela hoje. O "por
                    mês" continua abaixo, porque é como ela compara com o
                    mensal, e a renovação aparece por extenso: o desconto
                    acaba, e esconder isso é a mentira que este arquivo
                    inteiro existe para não cometer. */}
                <span className="mt-0.5 block whitespace-nowrap text-[11px] text-muted-foreground line-through">
                  {brl(oferta.cheioCentavos)}
                </span>
                <span className="block whitespace-nowrap font-serif text-xl leading-tight tabular-nums text-violet-700">
                  {brl(oferta.promoCentavos)}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  no 1º ano ·{" "}
                  <span className="whitespace-nowrap">
                    {brl(Math.round(oferta.promoCentavos / 12))}/mês
                  </span>
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  depois <span className="whitespace-nowrap">{brl(oferta.cheioCentavos)}/ano</span>
                </span>
              </>
            ) : (
              <>
                <span className="mt-0.5 block font-serif text-lg tabular-nums">
                  {reaisBRL(PRECO_ANUAL_MES)}
                </span>
                <span className="block text-[11px] text-muted-foreground">por mês</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {reaisBRL(PRECO_ANUAL_TOTAL)} cobrados de uma vez
                </span>
              </>
            )}
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
              {reaisBRL(PRECO_MENSAL)}
            </span>
            <span className="block text-[11px] text-muted-foreground">por mês</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              cancela quando quiser
            </span>
          </button>
        </div>

        {nativo ? (
          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              A assinatura ainda não está disponível no aplicativo
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Pelo aplicativo, a assinatura tem que passar pela loja da Apple ou do Google, e ela
              ainda está sendo preparada. Dá pra assinar pelo site, no navegador — vale para a mesma
              conta. Se o seu médico te deu um código, ele funciona aqui mesmo.
            </p>
          </div>
        ) : (
          <button
            onClick={assinar}
            disabled={indo}
            className={`press mt-4 w-full rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60 ${
              promoViva && plano === "annual"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {indo
              ? "Abrindo…"
              : promoViva && plano === "annual" && oferta
                ? /* O botão repete o valor. É o último lugar antes de sair do
                     app para o Stripe, e a paciente confere ali o número que
                     vai ver na tela de pagamento — se divergir, ela desiste. */
                  `Garantir por ${brl(oferta.promoCentavos)}`
                : "Assinar o Premium"}
          </button>
        )}

        {/* A letra miúda que não é miúda. O desconto vale UMA cobrança; a
            renovação é cheia. Dizer isso antes do clique é o que impede o
            estorno de daqui a doze meses. */}
        {promoViva && oferta && plano === "annual" && (
          <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            O desconto vale para o primeiro ano. A renovação, daqui a 12 meses, volta para{" "}
            {brl(oferta.cheioCentavos)} — e você pode cancelar antes, quando quiser.
          </p>
        )}

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
