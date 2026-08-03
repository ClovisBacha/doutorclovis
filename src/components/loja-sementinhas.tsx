/**
 * Folha dos pacotes de Sementinhas — abre ao tocar no saldo.
 *
 * Duas coisas ficam ditas na tela, e as duas de propósito:
 *
 * 1. **Jogar continua rendendo.** O primeiro texto da folha diz quanto se
 *    ganha por dia jogando. Loja de moeda que esconde o caminho gratuito é a
 *    que faz a pessoa achar que comprar é a única saída.
 * 2. **A Sementinha não compra cuidado.** Nenhuma aula, exame, alerta ou
 *    conduta está atrás dela — só enfeite. Numa clínica de alto risco isso não
 *    é detalhe de copy, é o limite do negócio.
 *
 * Sem contador, sem "só hoje", sem pacote que some. Vender pressa para
 * gestante de alto risco é o oposto do que este app é.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PACOTES,
  precoBRL,
  vantagemSobreMenor,
  type PacoteSementinhas,
} from "@/lib/pacotes-sementinhas";
import { podeComprarAqui } from "@/lib/canal-de-venda";
import { ehNativo } from "@/lib/nativo";
import { useVoltar } from "@/lib/use-voltar";

/** Uma linha do extrato: o que entrou ou saiu, e quando. */
type Lancamento = { amount: number; reason: string | null; created_at: string };

export function LojaSementinhas({
  aberto,
  onFechar,
  saldo,
}: {
  aberto: boolean;
  onFechar: () => void;
  saldo: number | null;
}) {
  /* O botão de voltar do Android fecha a folha em vez de fechar o app.
     Ver `src/lib/voltar.ts`. */
  useVoltar(aberto, onFechar);

  const [indo, setIndo] = useState<string | null>(null);
  /* Extrato. O servidor já devolvia os últimos 20 lançamentos com motivo e
     data (`walletPayload`), e o app jogava fora: a paciente via o número mudar
     e nunca sabia por quê. Uma moeda cujo saldo se move sem explicação é a
     receita para ela achar que perdeu alguma coisa. */
  const [extrato, setExtrato] = useState<Lancamento[] | null>(null);
  /* `ehNativo()` lê um global do Capacitor, então só vale no cliente — no SSR
     ele devolveria `false` e a folha renderizaria o caminho errado por um
     frame. O `useState` inicial + efeito resolvem sem hidratação divergente. */
  const [nativo, setNativo] = useState(false);
  useEffect(() => setNativo(ehNativo()), []);

  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", h);
    };
  }, [aberto, onFechar]);

  /* `getWallet` (só lê, não concede) já existia exportada e não era chamada em
     lugar nenhum do app. Aqui é o lugar dela. */
  useEffect(() => {
    if (!aberto || extrato !== null) return;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return setExtrato([]);
        const { getWallet } = await import("@/lib/sementinhas.functions");
        const w = await getWallet({ data: { accessToken: s.session.access_token } });
        setExtrato(w.ok ? ((w.recent ?? []) as Lancamento[]) : []);
      } catch {
        setExtrato([]);
      }
    })();
  }, [aberto, extrato]);

  if (!aberto) return null;

  const veredito = podeComprarAqui("sementinhas", nativo);
  const podeComprar = veredito.pode;

  async function comprar(p: PacoteSementinhas) {
    if (indo) return;
    setIndo(p.id);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Entre na sua conta para comprar.");
        setIndo(null);
        return;
      }
      const { createSementinhasCheckout } = await import("@/lib/loja-sementinhas.functions");
      const res = await createSementinhasCheckout({
        data: {
          accessToken: s.session.access_token,
          pacoteId: p.id,
          returnPath: "/minha-conta",
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
    setIndo(null);
  }

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
        aria-label="Pacotes de Sementinhas"
        className="dc-sheet-up relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,var(--safe-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-xl text-foreground">Sementinhas</h2>
          {saldo !== null && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold tabular-nums text-emerald-800">
              🌱 {saldo}
            </span>
          )}
        </div>

        {/* O caminho gratuito vem PRIMEIRO. */}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Você ganha Sementinhas todo dia jogando — check-in, aula, respiração, meditação e as três
          estrelas do dia somam até <strong className="text-foreground">70 por dia</strong>. Os
          pacotes abaixo são atalho pra quem quiser, nunca condição pra nada.
        </p>

        {podeComprar ? (
          <div className="mt-4 space-y-2">
            {PACOTES.map((p) => {
              const bonus = vantagemSobreMenor(p);
              const maior = p === PACOTES.at(-1);
              return (
                <button
                  key={p.id}
                  onClick={() => comprar(p)}
                  disabled={indo !== null}
                  className={`press flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left disabled:opacity-60 ${
                    maior ? "border-primary/40 bg-primary/6" : "border-border bg-background"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-lg tabular-nums text-foreground">
                      {p.quantidade.toLocaleString("pt-BR")} 🌱
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {p.rotulo}
                      {bonus > 0 && (
                        <span className="ml-1.5 font-semibold text-emerald-700">
                          +{bonus}% por real
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                    {indo === p.id ? "…" : precoBRL(p)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* App nativo: Apple (3.1.1) e Google exigem que moeda virtual passe
             pela loja deles. Abrir o Stripe aqui dentro reprova o app na
             revisão — então a tela diz o motivo, em vez de oferecer um botão
             que não deveria existir. */
          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="text-sm font-semibold text-foreground">Ainda não dá para comprar aqui</p>
            {/* Texto vindo de `canal-de-venda.ts`: a regra e a frase moram no
                mesmo lugar, senão uma tela diverge da outra — que foi o que já
                aconteceu quando cada uma tinha a sua cópia. */}
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {!veredito.pode && veredito.texto}
            </p>
            <p className="mt-2 text-[13px] font-medium text-emerald-800">
              Jogando, você continua ganhando normalmente. 💛
            </p>
          </div>
        )}

        {/* Extrato — de onde vieram as que ela já tem. */}
        {extrato !== null && extrato.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Últimas movimentações
            </p>
            <ul className="mt-2 divide-y divide-border/60 rounded-2xl border border-border bg-background">
              {extrato.slice(0, 8).map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                    {l.reason ?? "Movimentação"}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <span
                    className={`shrink-0 text-[12px] font-bold tabular-nums ${
                      l.amount >= 0 ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    {l.amount >= 0 ? "+" : ""}
                    {l.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Sementinhas compram só enfeites do Meu Cantinho. Nenhuma aula, exame, alerta ou orientação
          do seu médico depende delas.
        </p>

        <button
          onClick={onFechar}
          className="mt-3 w-full py-2 text-center text-xs font-medium text-muted-foreground"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
