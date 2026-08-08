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
 * Não há contador: quem tem direito é quem nunca assinou, e isso não tem
 * prazo. O relógio de 2h59 existiu e saiu — a paciente vai assinar dentro do
 * app, e o molde que a loja oferece para desconto de primeira assinatura vale
 * para quem nunca assinou, sem janela por pessoa. Prometer um prazo que a
 * loja não consegue honrar depois seria pior que não prometer nada.
 *
 * O que não mudou é a honestidade: quem decide o desconto é o SERVIDOR, que
 * confere a elegibilidade de novo na hora de criar o checkout; o preço riscado
 * vem com legenda dizendo o que ele é; e a tela diz, com todas as letras, que
 * o desconto vale para o PRIMEIRO ANO e para quanto a renovação volta.
 *
 * O que continua proibido aqui: urgência inventada, "última chance", ou frase
 * que faça a paciente se sentir devendo alguma coisa.
 *
 * Ela NÃO concede nada: o acesso só é liberado pelo webhook depois do
 * pagamento confirmado, ou pelo código do médico — as duas portas que já
 * existiam.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ehNativo } from "@/lib/nativo";
import { podeComprarAqui } from "@/lib/canal-de-venda";
import { brl } from "@/lib/promo";
import type { PrecosDaPaciente } from "@/lib/promo.functions";
import { useVoltar } from "@/lib/use-voltar";

/* Os preços vêm TODOS de `promo.ts`, e nenhum é escrito aqui.
   Antes havia três constantes locais (`PRECO_MENSAL`, `PRECO_ANUAL_MES`,
   `PRECO_ANUAL_TOTAL`) convivendo com os valores do servidor — duas fontes
   para o mesmo preço, na mesma tela, e a diferença só apareceria quando uma
   das duas mudasse. */

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
  ofertaDeProva?: PrecosDaPaciente;
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
  const veredito = podeComprarAqui("premium_paciente", nativo);

  /* O botão de voltar do Android fecha a oferta em vez de fechar o app.
     Numa folha de COMPRA isso importa duas vezes: sair sem querer no meio de
     um pagamento é a pior hora possível. */
  useVoltar(aberto, onFechar);

  /* A oferta. Sem contador: quem tem direito é quem nunca assinou, e isso não
     tem prazo — ver `promo.functions.ts`. */
  const [oferta, setOferta] = useState<PrecosDaPaciente | null>(null);

  useEffect(() => {
    if (!aberto) return;
    if (ofertaDeProva) {
      setOferta(ofertaDeProva);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return;
        const { getPrecosDaPaciente } = await import("@/lib/promo.functions");
        const o = await getPrecosDaPaciente({
          data: { accessToken: s.session.access_token },
        });
        if (!vivo) return;
        setOferta(o);
        /* O anual já vem pré-selecionado no `useState`. Antes isto era
           condicional à promoção; agora o anual é SEMPRE o de melhor valor,
           então não há estado em que faça sentido abrir no mensal. */
      } catch {
        /* Sem os preços do servidor, a folha não inventa: ver `promoViva`. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aberto, ofertaDeProva]);

  /* A folha só mostra preço quando o SERVIDOR respondeu. Antes ela tinha
     constantes locais para cair de volta, e um erro de rede virava "preço
     cheio" sem ninguém saber se era verdade. Preço é a única coisa desta tela
     que não pode ser adivinhada. */
  const temPrecos = Boolean(oferta);

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
        falha_ao_liberar:
          "O código foi aceito, mas o Premium não entrou. Tente de novo — o código continua seu.",
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
        className="dc-sheet-up relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,var(--safe-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        {/* ── O cartaz da oferta ────────────────────────────────────────
            Só aparece para quem tem direito — quem nunca assinou. Três coisas
            ficam ditas aqui, e as três de propósito:
              · o desconto e o preço que ela vai pagar;
              · sobre o quê incide (pagar mês a mês), com o riscado legendado;
              · que vale para o PRIMEIRO ANO, e para quanto a renovação volta.
            Havia um contador de 2h59 aqui. Saiu junto com a janela: a paciente
            vai assinar dentro do app, e o molde da loja para "desconto de
            primeira assinatura" não tem prazo por pessoa. Contador que a loja
            não consegue honrar depois é promessa que vira reclamação. */}
        {temPrecos && oferta && (
          <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-500 p-4 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">
                  Plano anual
                </p>
                <p className="mt-0.5 font-serif text-3xl leading-none">
                  {oferta.descontoAnualPct}% OFF
                </p>
                <p className="mt-1 text-[12px] text-white/90">comparado a pagar mês a mês</p>
              </div>
            </div>
            {/* O riscado EM CIMA, o preço EMBAIXO — o olho lê de cima para
                baixo, e é nessa ordem que a queda de preço se percebe.

                E o riscado vem com LEGENDA. R$ 238,80 é um preço REAL (o plano
                mensal por doze meses); riscá-lo sem dizer o que é faria parecer
                que o anual foi inflado para a promoção, que é o "preço de
                referência" que o CDC proíbe. Com a legenda é comparação
                verdadeira; sem ela é propaganda enganosa. */}
            <div className="mt-3 rounded-xl bg-white/15 px-3 py-2.5">
              <p className="text-[12px] leading-tight text-white/75">
                <span className="whitespace-nowrap line-through">
                  {brl(oferta.referenciaCentavos)}
                </span>{" "}
                pagando mês a mês
              </p>
              <p className="mt-0.5 whitespace-nowrap font-serif text-[30px] leading-none">
                {brl(oferta.anualCentavos)}
              </p>
              {/* ─── O EQUIVALENTE MENSAL NUNCA É UM PREÇO ──────────────────
                  Decisão do dono: R$ 9,16 só aparece DENTRO da comparação, ao
                  lado do que ela pagaria mês a mês e da porcentagem. O que sai
                  do cartão dela é R$ 109,90, de uma vez, e é esse o número
                  grande acima.
                  E "equivale a", nunca "×12": R$ 9,16 × 12 = R$ 109,92, dois
                  centavos ACIMA do cobrado. Quem fizer a conta encontra o texto
                  certo em vez de uma diferença inexplicada. */}
              <p className="mt-0.5 text-[12px] text-white/85">
                cobrado uma vez · equivale a{" "}
                <span className="whitespace-nowrap font-semibold">
                  {brl(oferta.anualMensalEquivCentavos)}/mês
                </span>
              </p>
              <p className="mt-1.5 text-[12px] font-semibold text-white/95">
                você economiza{" "}
                <span className="whitespace-nowrap">{brl(oferta.economiaCentavos)}</span> no ano
              </p>
            </div>

            {/* ─── O CUPOM DO MÉDICO SAIU DAQUI ───────────────────────────
                Havia uma faixa creditando 20% de desconto a ele. O médico não
                dá mais desconto: dá SEMENTINHAS. As razões estão no cabeçalho
                de `promo.ts`, e a mais dura é que cupom de Stripe não funciona
                dentro do iOS nem do Android — que é exatamente onde ela compra.
                A faixa prometia na tela um desconto que a loja não tinha como
                dar. */}
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

        {/* Empilhados, e o MAIS CARO em cima. Lado a lado, os dois planos
            pesavam igual e o olho comparava dois números soltos; um embaixo do
            outro, ela lê primeiro o que custa mais (mês a mês) e depois o
            anual — que é a ordem em que a diferença aparece.

            O total do anual continua à vista: preço por mês com cobrança
            anual, sem dizer quanto sai do cartão, é informação incompleta pelo
            CDC e é a primeira coisa que vira estorno. */}
        <div className="mt-4 flex flex-col gap-2">
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
              {oferta ? brl(oferta.mensalCentavos) : "—"}
            </span>
            <span className="block text-[11px] text-muted-foreground">por mês</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              cancela quando quiser
            </span>
          </button>
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
              {oferta && (
                <span className="rounded-full bg-violet-600 px-1.5 py-px text-[9px] text-white">
                  −{oferta.descontoAnualPct}%
                </span>
              )}
            </span>
            {/* O anual mostra sempre o preço À VISTA — é o número que sai do
                cartão dela. O equivalente mensal vem abaixo e SÓ dentro da
                comparação, nunca como preço: decisão do dono. */}
            {oferta ? (
              <>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  <span className="whitespace-nowrap line-through">
                    {brl(oferta.referenciaCentavos)}
                  </span>{" "}
                  mês a mês
                </span>
                <span className="block whitespace-nowrap font-serif text-2xl leading-tight tabular-nums text-violet-700">
                  {brl(oferta.anualCentavos)}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  cobrado uma vez · equivale a{" "}
                  <span className="whitespace-nowrap">
                    {brl(Math.round(oferta.anualCentavos / 12))}/mês
                  </span>
                </span>
              </>
            ) : (
              <span className="mt-0.5 block font-serif text-lg tabular-nums">—</span>
            )}
          </button>
        </div>

        {!veredito.pode ? (
          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="text-sm font-semibold text-foreground">Ainda não dá para assinar aqui</p>
            {/* A frase vem de `canal-de-venda.ts` — regra e texto no mesmo
                lugar. Repare que ela NÃO manda a paciente comprar pelo site:
                sugerir caminho de pagamento fora do app é o que a loja
                proíbe, e era o que a versão anterior desta tela fazia. */}
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {veredito.texto}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Se o seu médico te deu um código, ele funciona aqui mesmo.
            </p>
          </div>
        ) : (
          <button
            onClick={assinar}
            disabled={indo}
            className={`press mt-4 w-full rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60 ${
              plano === "annual"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {/* O botão repete o VALOR. É o último lugar antes de sair do app
                para o Stripe, e a paciente confere ali o número que vai ver na
                tela de pagamento — se divergir, ela desiste. Vale para os dois
                planos: antes só o anual em promoção mostrava o preço, e quem
                escolhia o mensal saía sem nunca ter lido o número. */}
            {indo
              ? "Abrindo…"
              : oferta
                ? `Assinar por ${brl(
                    plano === "annual" ? oferta.anualCentavos : oferta.mensalCentavos,
                  )}${plano === "annual" ? "" : "/mês"}`
                : "Assinar o Premium"}
          </button>
        )}

        {/* A letra miúda que não é miúda.
            ─── O QUE MUDOU AQUI ────────────────────────────────────────────
            A oferta antiga valia UMA cobrança e a renovação voltava cheia, e
            este parágrafo existia para dizer isso antes do clique — era o que
            impedia o estorno de daqui a doze meses.
            Não há mais desconto de cupom a explicar — o médico dá Sementinhas,
            não desconto —, então o que resta a avisar é o essencial: o preço é
            o mesmo na renovação. */}
        {oferta && plano === "annual" && (
          <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            Cobrança única de {brl(oferta.anualCentavos)}, renovada a cada 12 meses pelo mesmo
            valor. Você pode cancelar quando quiser.
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
