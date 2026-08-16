import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PainelDaInfluenciadora } from "@/lib/influenciadora.functions";

/**
 * O PAINEL DA EMBAIXADORA — no SITE, não no app.
 *
 * ─── POR QUE ESTA TELA PRECISOU EXISTIR ─────────────────────────────────────
 *
 * O motor já rodava inteiro há meses: `?ref=CODIGO`, atribuição, metadata na
 * Stripe, 50% de comissão creditados por fatura paga em `affiliate_earnings`.
 *
 * ⚠️ E AS ÚNICAS TELAS QUE LIAM ISSO ERAM O `/admin` E O `/painel` DA EQUIPE. O
 * dinheiro da criadora estava sendo contado corretamente para alguém que não
 * tinha como olhar o próprio saldo. É a mesma família de defeito do presente do
 * médico, que chegava na paciente sem nenhum aviso: do lado de quem dá parecia
 * inteiro; do lado de quem recebe, não existia.
 *
 * ─── NO SITE, E NÃO NO APP ──────────────────────────────────────────────────
 *
 * Decisão do dono: "o perfil da influenciadora deve ser unicamente através do
 * site". Faz sentido — ela não é gestante, não tem semana, não tem bebê, e o
 * app inteiro é construído em volta disso. Uma aba de comissão dentro do app da
 * gestante seria um corpo estranho.
 *
 * ⚠️ NÃO HÁ "CADASTRE-SE COMO EMBAIXADORA" AQUI, de propósito. Quem cria código
 * de afiliada é a equipe, no `/admin` — é uma parceria comercial com comissão de
 * 50%, não um formulário aberto. Quem chega sem convite vê o convite para
 * conversar, não um botão que promete o que ninguém aprovou.
 */
export const Route = createFileRoute("/influenciadora")({
  head: () => ({
    meta: [
      { title: "Painel da Embaixadora — Obstétrica" },
      /* Fora do índice: é uma tela de parceira, não conteúdo do site. */
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PainelDaEmbaixadora,
});

/** "R$ 1.234,56" a partir de centavos INTEIROS — dinheiro nunca em float. */
function brl(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PainelDaEmbaixadora() {
  const [carregando, setCarregando] = useState(true);
  const [semSessao, setSemSessao] = useState(false);
  const [painel, setPainel] = useState<PainelDaInfluenciadora | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) {
          setSemSessao(true);
          return;
        }
        const { meuPainelDeInfluenciadora } = await import("@/lib/influenciadora.functions");
        const r = await meuPainelDeInfluenciadora({
          data: { accessToken: s.session.access_token },
        });
        if (r.ok) setPainel(r.painel);
      } catch {
        /* cai no estado "não é embaixadora", que já explica o caminho */
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const link = painel ? `https://www.obstetrica.com.br/?ref=${painel.codigo}` : "";

  async function copiar(texto: string, oQue: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${oQue} copiado ✓`);
    } catch {
      toast("Não consegui copiar. Selecione e copie à mão.");
    }
  }

  if (carregando) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-16">
        <div className="skeleton h-64 rounded-3xl" />
      </section>
    );
  }

  if (semSessao) {
    return (
      <section className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-5xl">💛</p>
        <h1 className="mt-5 font-serif text-3xl">Painel da Embaixadora</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Entre com o e-mail que você cadastrou na parceria para ver quantas gestantes você trouxe e
          quanto já ganhou.
        </p>
        <Link
          to="/auth"
          className="press mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground"
        >
          Entrar
        </Link>
      </section>
    );
  }

  /* ⚠️ ESTE É O CAMINHO MAIS COMUM — qualquer pessoa logada que abrir a URL. Por
     isso ele não é uma tela de erro: é um convite, e diz o que fazer a seguir. */
  if (!painel) {
    return (
      <section className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-5xl">🌱</p>
        <h1 className="mt-5 font-serif text-3xl">Quer ser embaixadora?</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Esta conta ainda não tem um código de embaixadora. A parceria é conversada uma a uma — se
          você cria conteúdo sobre gestação e maternidade, fale com a gente.
        </p>
        <a
          href="mailto:obstetrica.app@gmail.com?subject=Quero%20ser%20embaixadora"
          className="press mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground"
        >
          Falar com a gente
        </a>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Embaixadora</p>
      <h1 className="mt-2 font-serif text-3xl">Olá, {painel.nome} 💛</h1>

      {/* ⚠️ CÓDIGO DESLIGADO É DITO EM VOZ ALTA, e no topo. Sem isto ela
          continuaria divulgando um link que não atribui mais nada — e só
          descobriria pelo silêncio dos números, semanas depois. */}
      {!painel.ativa && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-snug text-amber-900 ring-1 ring-amber-200">
          <strong className="font-semibold">Seu código está pausado.</strong> Novas indicações não
          estão sendo contadas. Fale com a gente para reativar.
        </p>
      )}

      {/* ── OS TRÊS NÚMEROS ─────────────────────────────────────────────────
          Cadastros primeiro: é a pergunta que toda criadora faz antes de
          perguntar de dinheiro, e é a que o app não sabia responder até o
          `ref_code` passar a ser escrito no cadastro. */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          {
            rotulo: "Gestantes",
            valor: String(painel.cadastros),
            cor: "#6b21a8",
            fundo: "#f3e8fd",
          },
          {
            rotulo: "Últimos 30 dias",
            valor: brl(painel.mesCentavos),
            cor: "#166534",
            fundo: "#e7f6ec",
          },
          { rotulo: "Total", valor: brl(painel.totalCentavos), cor: "#9d174d", fundo: "#fce7f3" },
        ].map((c) => (
          <div
            key={c.rotulo}
            className="rounded-2xl p-3.5 text-center"
            style={{ background: c.fundo }}
          >
            <p className="text-[19px] font-extrabold tabular-nums" style={{ color: c.cor }}>
              {c.valor}
            </p>
            <p
              className="mt-0.5 text-[11.5px] font-semibold"
              style={{ color: c.cor, opacity: 0.8 }}
            >
              {c.rotulo}
            </p>
          </div>
        ))}
      </div>

      {/* ── O LINK E O CÓDIGO ───────────────────────────────────────────────
          Os DOIS, porque servem a caminhos diferentes: o link atribui sozinho
          para quem clica, e o código salva a indicação de quem viu o vídeo no
          computador e depois baixou o app pela busca da loja. */}
      <div className="mt-6 rounded-3xl border border-border bg-card p-5">
        <p className="font-serif text-lg">Seu link e seu código</p>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          Quem entra pelo link já chega com o código aplicado. Quem baixa o app pela busca da loja
          digita o código no cadastro — e você não perde a indicação.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-full bg-secondary px-4 py-2.5 text-[13px]">
            {link}
          </code>
          <button
            onClick={() => void copiar(link, "Link")}
            className="press min-h-11 shrink-0 rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground"
          >
            Copiar
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 rounded-full bg-secondary px-4 py-2.5 font-mono text-[15px] font-bold tracking-widest">
            {painel.codigo}
          </code>
          <button
            onClick={() => void copiar(painel.codigo, "Código")}
            className="press min-h-11 shrink-0 rounded-full border border-border px-4 text-[13px] font-semibold"
          >
            Copiar
          </button>
        </div>

        <p className="mt-3 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-[12.5px] leading-snug text-muted-foreground">
          Você recebe <strong className="font-semibold">{painel.comissaoPct}%</strong> de cada
          mensalidade paga por quem veio pelo seu código —{" "}
          <strong className="font-semibold">todo mês, enquanto ela continuar assinando</strong>.
        </p>
      </div>

      {/* ── O EXTRATO ───────────────────────────────────────────────────────
          ⚠️ Sem linha nenhuma, o texto NÃO diz "nenhuma comissão ainda" e para
          aí: ela precisa saber que a comissão nasce da ASSINATURA, não do
          cadastro. Sem essa frase, uma criadora com 40 gestantes e R$ 0 acha
          que o sistema está quebrado. */}
      <div className="mt-6">
        <h2 className="px-1 font-serif text-lg">Suas comissões</h2>
        {painel.ultimos.length === 0 ? (
          <p className="mt-2 rounded-3xl border border-dashed border-border p-6 text-center text-[13px] leading-snug text-muted-foreground">
            Ainda não há comissão. Ela entra quando uma gestante que veio pelo seu código{" "}
            <strong className="font-semibold">assina o Premium</strong> — e se repete a cada
            mensalidade que ela pagar.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-3xl border border-border bg-card">
            {painel.ultimos.map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[12.5px] text-muted-foreground">
                  {new Date(g.quando).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  assinatura de {brl(g.pagoCentavos)}
                </span>
                <span className="text-[14px] font-bold tabular-nums text-emerald-700">
                  +{brl(g.comissaoCentavos)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        Os valores acima são o que já foi apurado das mensalidades pagas. O pagamento é combinado
        direto com a gente — qualquer dúvida, escreva para obstetrica.app@gmail.com.
      </p>
    </section>
  );
}
