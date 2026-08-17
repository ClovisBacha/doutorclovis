import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * MINHA ASSINATURA — a tela que não existia.
 *
 * ─── O BURACO QUE ELA FECHA ─────────────────────────────────────────────────
 *
 * `openBillingPortal` e `getMyBilling` estavam escritas em `billing.functions.ts`
 * há meses. O ÚNICO chamador do portal era `painel.tsx`, o painel do MÉDICO, e
 * `getMyBilling` não tinha chamador nenhum.
 *
 * ⚠️ A PACIENTE ASSINAVA, ERA COBRADA TODO MÊS, E O APP NÃO TINHA UMA TELA QUE
 * DISSESSE QUANTO ELA PAGA, QUANDO RENOVA, NEM COMO PARAR. Isso é três coisas
 * ao mesmo tempo: quebra de confiança (quem não acha como cancelar faz
 * chargeback em vez de cancelar), risco de conformidade (o CDC espera que
 * cancelar seja tão fácil quanto contratar) e, quando o IAP entrar, um item que
 * a revisão da Apple cobra.
 *
 * ─── ⚠️ A ORIGEM DECIDE O BOTÃO ─────────────────────────────────────────────
 *
 * `getMyBilling` devolve `source`. Assinatura feita pelo Stripe se gerencia no
 * portal do Stripe; assinatura feita pela loja da Apple/Google **não** — o
 * portal não a enxerga, e um botão que abre um portal vazio é pior que nenhum
 * botão, porque ela conclui que o app está quebrado em vez de procurar no lugar
 * certo. Por isso a tela lê a origem antes de decidir o que oferecer.
 *
 * ─── ⚠️ QUEM NÃO ASSINA NÃO VÊ UM VAZIO ────────────────────────────────────
 *
 * A linha não some do menu para quem está no plano gratuito: ela abre esta
 * tela dizendo em que plano ela está e o que o Premium muda. Esconder a porta
 * de quem não assina é o mesmo erro de esconder o caminho grátis na loja de
 * moeda — a pessoa fica sem saber o que existe.
 */

/** Uma linha de `subscriptions`, como o servidor devolve. */
type Assinatura = {
  product?: string | null;
  plan?: string | null;
  status?: string | null;
  source?: string | null;
  current_period_end?: string | null;
};

/** O status em português, e o que ele significa para ela. */
const STATUS: Record<string, { rotulo: string; cor: string; fundo: string }> = {
  active: { rotulo: "Ativa", cor: "#166534", fundo: "#e7f6ec" },
  trialing: { rotulo: "Período de teste", cor: "#166534", fundo: "#e7f6ec" },
  past_due: { rotulo: "Pagamento pendente", cor: "#9a3412", fundo: "#ffedd5" },
  unpaid: { rotulo: "Pagamento pendente", cor: "#9a3412", fundo: "#ffedd5" },
  canceled: { rotulo: "Cancelada", cor: "#6b7280", fundo: "#f3f4f6" },
  incomplete: { rotulo: "Não concluída", cor: "#9a3412", fundo: "#ffedd5" },
};

/** "12 de agosto de 2026" — a data que importa é quando ela é cobrada de novo. */
function dataLonga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * O ENDEREÇO OFICIAL DE ASSINATURAS DA APPLE e da Google.
 *
 * ⚠️ LINK, E NÃO INSTRUÇÃO ESCRITA. A primeira versão desta tela dizia
 * "use Ajustes → Apple ID → Assinaturas" em texto — e mandar alguém navegar
 * quatro níveis de menu do sistema, de cabeça, é o mesmo tipo de atrito que faz
 * a paciente desistir e pedir estorno no cartão em vez de cancelar. A Apple
 * publica um endereço que abre a tela de assinaturas direto, e a Google também.
 *
 * ⚠️ E É `https://`, NUNCA `itms-apps://`. O esquema nativo não existe no
 * navegador nem no Android — num app instalado como PWA, um link `itms-apps`
 * simplesmente não faz nada, sem erro nenhum. O endereço `https` da Apple
 * redireciona para a tela nativa quando aberto no iPhone e continua sendo uma
 * página útil em qualquer outro lugar.
 */
const ASSINATURAS_DA_LOJA = {
  apple: "https://apps.apple.com/account/subscriptions",
  google: "https://play.google.com/store/account/subscriptions",
} as const;

/**
 * ⚠️ SÓ O STRIPE ABRE PORTAL. Qualquer outra origem (`apple`, `google`, ou um
 * valor que ainda não existe) cai no texto que manda ela ao lugar certo — e o
 * `null`/vazio conta como Stripe porque é o que as assinaturas antigas têm
 * gravado, e são todas de checkout web.
 */
function gerenciaNoStripe(source: string | null | undefined): boolean {
  const s = (source ?? "").toLowerCase();
  return s === "" || s === "stripe" || s === "site";
}

export function AssinaturaTab({
  onNavigate,
  bancada,
}: {
  onNavigate?: (t: string) => void;
  /**
   * ⚠️ SÓ PARA A BANCADA. Sem sessão o servidor não devolve assinatura nenhuma
   * e a tela cai sempre no "plano gratuito" — os três estados que importam
   * (ativa pelo Stripe, ativa pela loja, cancelada) só existiriam numa conta
   * real que estivesse naquele estado exato.
   */
  bancada?: Assinatura[];
}) {
  const [carregando, setCarregando] = useState(!bancada);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>(bancada ?? []);
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    if (bancada) return;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const { getMyBilling } = await import("@/lib/billing.functions");
        const r = await getMyBilling({ data: { accessToken: s.session.access_token } });
        if (r.ok) setAssinaturas((r.subscriptions ?? []) as Assinatura[]);
      } catch {
        /* sem rede → cai no estado "plano gratuito", que ainda mostra o caminho */
      } finally {
        setCarregando(false);
      }
    })();
  }, [bancada]);

  /* A que vale é a ATIVA mais recente; o servidor já devolve ordenado por
     `updated_at`. Uma conta pode ter linhas antigas canceladas, e mostrar a
     primeira da lista sem filtrar diria "cancelada" para quem acabou de
     reassinar. */
  const viva =
    assinaturas.find((a) => a.status === "active" || a.status === "trialing") ??
    assinaturas[0] ??
    null;

  async function abrirPortal() {
    setAbrindo(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { openBillingPortal } = await import("@/lib/billing.functions");
      const r = await openBillingPortal({
        data: { accessToken: s.session.access_token, returnPath: "/minha-conta" },
      });
      if (r.ok && r.url) {
        window.location.href = r.url;
        return;
      }
      /* Cada recusa com a sua frase: "não foi possível" faria ela tentar de
         novo contra uma parede que não vai ceder. */
      toast(
        r.error === "sem_assinatura"
          ? "Não encontrei uma assinatura paga nesta conta."
          : r.error === "pagamento_indisponivel"
            ? "O pagamento está sendo configurado. Tente em instantes."
            : "Não consegui abrir agora. Tente de novo em alguns minutos.",
        { duration: 6000 },
      );
    } catch {
      toast("Não consegui abrir agora. Tente de novo em alguns minutos.");
    } finally {
      setAbrindo(false);
    }
  }

  if (carregando) return <div className="skeleton h-56 rounded-3xl" />;

  const st = viva?.status ? STATUS[viva.status] : null;
  const renova = dataLonga(viva?.current_period_end);
  /** Ela ainda PAGA — é isto que decide se há o que gerenciar ou cancelar. */
  const ativa = viva?.status === "active" || viva?.status === "trialing";
  /**
   * ⚠️ ELA AINDA TEM ACESSO — e isto NÃO é a mesma coisa que `ativa`.
   *
   * A bancada pegou o defeito: uma assinatura CANCELADA com período pago até
   * setembro aparecia com o título "Plano gratuito" e, logo abaixo, "seu acesso
   * vai até 16 de setembro". As duas frases na mesma tela se contradizem — ela
   * é Premium até lá, só não vai renovar.
   *
   * Um único booleano fazia dois trabalhos: "está pagando?" e "pode usar?".
   * Enquanto o período pago não vence, a resposta da segunda é sim.
   */
  const fimDoPeriodo = viva?.current_period_end ? new Date(viva.current_period_end).getTime() : 0;
  const temAcesso = ativa || (fimDoPeriodo > Date.now() && viva?.status === "canceled");
  /** Nunca assinou — nem hoje, nem antes. Muda o que a tela tem a dizer. */
  const nuncaAssinou = !viva;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12">
            <CreditCard className="h-[21px] w-[21px] text-primary" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl leading-tight">
              {temAcesso ? "Premium" : "Plano gratuito"}
            </p>
            {st && (
              <span
                className="mt-1.5 inline-block rounded-full px-2.5 py-1 text-[12px] font-bold"
                style={{ background: st.fundo, color: st.cor }}
              >
                {st.rotulo}
              </span>
            )}
          </div>
        </div>

        {/* ⚠️ A DATA É DITA COM A PALAVRA CERTA. "Renova em" e "acesso até" são
            fatos diferentes: numa assinatura ativa a data é quando ela será
            COBRADA de novo; numa cancelada, é até quando ela ainda TEM acesso.
            Trocar as duas é a diferença entre ela achar que vai pagar e achar
            que não vai. */}
        {renova && (
          <p className="mt-4 text-[13.5px] leading-snug text-muted-foreground">
            {ativa ? (
              <>
                Renova automaticamente em <strong className="font-semibold">{renova}</strong>.
              </>
            ) : (
              <>
                Seu acesso vai até <strong className="font-semibold">{renova}</strong>.
              </>
            )}
          </p>
        )}

        {nuncaAssinou && (
          <p className="mt-4 text-[13.5px] leading-snug text-muted-foreground">
            Você está no plano gratuito. O Premium abre as aulas completas, o cérebro do seu médico
            e a loja inteira do Cantinho.
          </p>
        )}

        <div className="mt-5">
          {/* ⚠️ CANCELADA COM ACESSO NÃO PODE SER UM BECO SEM SAÍDA.
              Separar "paga" de "tem acesso" consertou o título e criou um
              estado novo: cancelada, ainda Premium até o fim do período, e sem
              botão nenhum na tela. É exatamente a pessoa mais provável de
              querer voltar atrás — e o portal do Stripe reativa. Sem esta
              linha ela teria de assinar de novo do zero, ou escrever para o
              suporte. */}
          {temAcesso && gerenciaNoStripe(viva?.source) && (
            <>
              <button
                onClick={() => void abrirPortal()}
                disabled={abrindo}
                className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {abrindo ? "Abrindo…" : ativa ? "Gerenciar ou cancelar" : "Reativar assinatura"}
                {!abrindo && <ExternalLink className="h-4 w-4" strokeWidth={2.2} />}
              </button>
              <p className="mt-2 text-center text-[11.5px] leading-snug text-muted-foreground">
                {ativa
                  ? "Abre a área segura de pagamento, onde você troca o cartão, vê as faturas ou cancela quando quiser."
                  : "Abre a área segura de pagamento. Sua assinatura volta a renovar e você não perde nada do que já tem."}
              </p>
            </>
          )}

          {/* ⚠️ ASSINATURA DA LOJA NÃO ABRE PORTAL — ver `gerenciaNoStripe`. */}
          {temAcesso && !gerenciaNoStripe(viva?.source) && (
            <>
              {/* ⚠️ POR REGRA DA APPLE/GOOGLE, SÓ A LOJA CANCELA. O app não tem
                  como fazer isso — e é por isso que aqui não há botão de
                  cancelar, e sim um caminho para onde ela consegue. */}
              <a
                href={
                  (viva?.source ?? "").toLowerCase().includes("google")
                    ? ASSINATURAS_DA_LOJA.google
                    : ASSINATURAS_DA_LOJA.apple
                }
                target="_blank"
                rel="noopener noreferrer"
                className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                Gerenciar na{" "}
                {(viva?.source ?? "").toLowerCase().includes("google") ? "Play Store" : "App Store"}
                <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
              </a>
              <p className="mt-2 text-center text-[11.5px] leading-snug text-muted-foreground">
                Esta assinatura foi feita pela loja do seu celular — por regra dela, é lá que se
                troca o pagamento ou se cancela.
              </p>
            </>
          )}

          {!temAcesso && onNavigate && (
            <button
              onClick={() => onNavigate("Caminho")}
              className="press min-h-11 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground"
            >
              Conhecer o Premium
            </button>
          )}
        </div>
      </div>

      {/* ⚠️ ESTA CAIXA NÃO É ENFEITE. É a frase que a paciente procura quando
          está insegura sobre um débito recorrente, e ela precisa estar na
          mesma tela do botão — não num link de termos. */}
      <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.9} />
        {/* ⚠️ A PRIMEIRA FRASE SÓ APARECE PARA QUEM PAGA. "Cancelar é imediato"
            não diz nada a quem nunca assinou — e uma tela que responde a uma
            pergunta que a pessoa não fez ensina que o texto daqui é enfeite. A
            SEGUNDA frase fica sempre: é o limite ético do produto, e ela vale
            ainda mais para quem está decidindo se assina. */}
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {ativa && "Cancelar é imediato e você mantém o acesso até o fim do período já pago. "}
          <strong className="font-semibold text-foreground">
            Nada do seu cuidado depende da assinatura
          </strong>{" "}
          — diário, registros, SOS, conversa com o seu médico e os lembretes continuam funcionando
          no plano gratuito.
        </p>
      </div>
    </div>
  );
}
