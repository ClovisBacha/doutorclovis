/**
 * A LOJA DE SEMENTINHAS — o layout que o dono desenhou.
 *
 * Abre ao tocar no saldo, em qualquer lugar do app que mostre Sementinhas.
 *
 * ─── O QUE VEM DA IMAGEM E O QUE VEM DO CÓDIGO ──────────────────────────────
 *
 * O dono mandou a tela inteira numa imagem e pediu que ficasse "exatamente
 * dessa forma". A divisão que eu fiz:
 *
 * · **Recortado da imagem dele**: as três ilustrações (saco, pote, frasco).
 *   São a única coisa que eu não consigo reproduzir. Saíram em PNG com fundo
 *   transparente por `scripts/pacotes-do-drive.mjs`.
 * · **Reconstruído em CSS**: todo o resto — cores, gradientes, fita, botões,
 *   tipografia. Precisa ser código porque preço e saldo vêm do servidor, o
 *   texto tem de ser lido por leitor de tela, e a tela roda de um iPhone SE a
 *   um tablet.
 *
 * As cores foram MEDIDAS na referência, não estimadas — ver `PALETA`.
 *
 * ─── O QUE A TELA CONTINUA DIZENDO, E POR QUÊ ───────────────────────────────
 *
 * 1. **Jogar continua rendendo.** Loja de moeda que esconde o caminho gratuito
 *    é a que faz a pessoa achar que comprar é a única saída.
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
  numeroBR,
  precoBRL,
  totalDoPacote,
  type PacoteSementinhas,
} from "@/lib/pacotes-sementinhas";
import { podeComprarAqui } from "@/lib/canal-de-venda";
import { ehNativo } from "@/lib/nativo";
import { useVoltar } from "@/lib/use-voltar";
import { Bolha } from "@/components/bolha";
import pacoteGrande from "@/assets/pacotes/pacote-grande.png";
import pacoteMedio from "@/assets/pacotes/pacote-medio.png";
import pacotePequeno from "@/assets/pacotes/pacote-pequeno.png";

/** Uma linha do extrato: o que entrou ou saiu, e quando. */
type Lancamento = { amount: number; reason: string | null; created_at: string };

/**
 * As cores, amostradas pixel a pixel na referência do Drive.
 *
 * ⚠️ Medidas, não estimadas. O céu do herói, por exemplo, começa num lilás
 * (#b0bbf6) que ninguém adivinharia olhando — chutar "azul claro" daria uma
 * tela parecida e errada, que é o pior resultado possível quando o pedido foi
 * "exatamente dessa forma".
 */
const PALETA = {
  pagina: "#f7f7f8",
  heroi:
    "linear-gradient(180deg,#b0bbf6 0%,#b6cbf3 14%,#bdddee 26%,#bfdee4 36%,#8ead91 50%,#c8c598 62%,#7d9b72 74%,#607d4a 84%,#b6c8a1 93%,#dbe5cf 100%)",
  cartao: {
    /* ⚠️ `#4c721f`, e não o `#5a8629` amostrado da referência. Medido: o verde
       da imagem dá 4,31:1 com o branco do rótulo — abaixo dos 4,5 da WCAG para
       texto que não é grande. Escurecer 8% do tom mantém a família de cor da
       referência e leva a 5,62:1. O azul (6,18) e o roxo (7,74) já passavam,
       então só este mudou: fidelidade à referência é o objetivo, mas um preço
       que a paciente não consegue ler não é fidelidade a nada. */
    verde: { fundo: "linear-gradient(180deg,#f1f3d7,#f3f5dd 55%,#eff2df)", botao: "#4c721f" },
    azul: { fundo: "linear-gradient(180deg,#ecedf8,#e8eaf9 55%,#d7ddf1)", botao: "#3261a6" },
    roxo: { fundo: "linear-gradient(180deg,#f4edf7,#f3ebf7 55%,#f9f8fa)", botao: "#614390" },
  },
  /* Idem para a fita "MELHOR VALOR": `#63822c` dava 4,41:1 — reprova por pouco,
     e ela carrega três palavras em caixa alta pequena. `#4f6a20` dá 6,15:1. */
  fita: "#4f6a20",
} as const;

const ARTE: Record<string, string> = {
  "sem-10000": pacoteGrande,
  "sem-5000": pacoteMedio,
  "sem-1000": pacotePequeno,
};

/** O tom do NÚMERO grande de cada cartão — o botão é escuro demais para texto. */
const TOM_NUMERO: Record<PacoteSementinhas["cor"], string> = {
  verde: "#4a7222",
  azul: "#2c5490",
  roxo: "#553a80",
};

/**
 * As faíscas do herói.
 *
 * ⚠️ Posições CRAVADAS, e não `Math.random()`: a tela é renderizada no
 * servidor, e um sorteio daria posições diferentes no servidor e no cliente —
 * o React reclama de hidratação no console de todo mundo. É a mesma lição das
 * estrelas do céu da home.
 */
const FAISCAS = [
  { x: 12, y: 18, s: 7, o: 0.75 },
  { x: 31, y: 9, s: 4, o: 0.6 },
  { x: 74, y: 13, s: 9, o: 0.8 },
  { x: 88, y: 27, s: 5, o: 0.65 },
  { x: 61, y: 6, s: 5, o: 0.55 },
  { x: 22, y: 39, s: 5, o: 0.5 },
  { x: 93, y: 47, s: 7, o: 0.6 },
  { x: 8, y: 52, s: 4, o: 0.45 },
];

export function LojaSementinhas({
  aberto,
  onFechar,
  saldo,
  careMode = false,
}: {
  aberto: boolean;
  onFechar: () => void;
  saldo: number | null;
  /**
   * ⚠️ O PORTÃO MORA AQUI, e não só em quem abre a loja.
   *
   * Hoje os dois chamadores já fecham a porta antes — o Caminho deixa o saldo
   * em `null` no luto e o botão nem existe; a aba de Recompensas devolve
   * `SilencioDoCuidado`. Mas isso é uma SEGUNDA RÉGUA, exatamente o que o
   * projeto proíbe em `humorDaJornada` e em `presenteRecente`: um terceiro
   * chamador (um deep-link, um atalho novo na home) abriria uma vitrine de
   * compra para quem acabou de perder a gestação, e ninguém precisaria ter
   * errado nada — bastaria não saber da regra.
   */
  careMode?: boolean;
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
  const [verExtrato, setVerExtrato] = useState(false);
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

  /* ⚠️ DEPOIS dos hooks (a ordem de chamada não pode mudar entre renders) e
     JUNTO do `!aberto`: no Modo Cuidado esta tela simplesmente não existe. */
  if (!aberto || careMode) return null;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loja de Sementinhas"
      className="fixed inset-0 z-[70] overflow-y-auto"
      style={{ background: PALETA.pagina }}
    >
      {/* ── HERÓI ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: PALETA.heroi }}>
        {/* Véu claro: o jardim da referência é BORRADO, e sem isto o gradiente
            fica saturado demais por baixo do texto escuro do título. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 30%, rgba(255,255,255,0.62), rgba(255,255,255,0.12) 60%, rgba(255,255,255,0) 100%)",
          }}
          aria-hidden
        />
        {FAISCAS.map((f, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full bg-white"
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              width: f.s,
              height: f.s,
              opacity: f.o,
              filter: "blur(0.5px)",
            }}
            aria-hidden
          />
        ))}

        <div
          className="relative px-5 pb-6"
          style={{ paddingTop: "max(0.9rem, var(--safe-top, 0.9rem))" }}
        >
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={onFechar}
              aria-label="Voltar"
              className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/90 text-xl text-slate-700 shadow-md backdrop-blur"
            >
              ←
            </button>
            {saldo !== null && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-4 py-2 shadow-md backdrop-blur">
                <span className="text-lg leading-none">🌱</span>
                <span className="text-lg font-extrabold tabular-nums text-emerald-700">
                  {numeroBR(saldo)}
                </span>
              </span>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-serif text-[34px] font-bold leading-[1.05] text-slate-800 sm:text-[40px]">
                Loja de
                <br />
                <span style={{ color: "#3f7a1f" }}>Sementinhas</span>
              </h1>
              <p className="mt-2 max-w-[18rem] text-[15px] leading-snug text-slate-700">
                Use suas sementinhas para decorar e evoluir seu cenário!
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                  <path
                    d="M12 2.6 5 5.4v5.3c0 4.4 2.9 8.5 7 9.7 4.1-1.2 7-5.3 7-9.7V5.4L12 2.6Z"
                    fill="none"
                    stroke="#3f7a1f"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m9 12 2.2 2.2L15.4 10"
                    fill="none"
                    stroke="#3f7a1f"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[13px] font-semibold text-slate-700">Compra 100% segura</span>
              </span>
            </div>
            {/* A MESMA personagem do resto do app, e não um desenho novo: é ela
                que fala em toda tela que precisa de uma voz. */}
            <div className="shrink-0 -mb-1">
              <Bolha tamanho={132} humor="feliz" careMode={false} />
            </div>
          </div>
        </div>
      </div>

      {/* ── OS TRÊS PACOTES ────────────────────────────────────────────── */}
      <div className="px-4 pb-10 pt-5">
        {/* ⚠️ OS CARTÕES APARECEM SEMPRE, mesmo com a compra indisponível.

            A venda de moeda virtual só pode acontecer pela loja da Apple/Google
            (`canal-de-venda.ts`), e o IAP ainda não está no ar. A versão
            anterior desta tela trocava os três cartões por uma caixa de aviso —
            ou seja, o layout que o dono desenhou simplesmente não existia até o
            app ser publicado.

            Esconder a vitrine também não protege ninguém: o que não pode
            acontecer é COBRAR fora da loja, e isso continua barrado no botão.
            O aviso vem uma vez, em cima, em vez de repetido em cada cartão. */}
        {!podeComprar && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[13px] font-semibold text-amber-900">
              A compra ainda não está aberta
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">
              {!veredito.pode && veredito.texto}
            </p>
            <p className="mt-2 text-[12.5px] font-medium text-emerald-800">
              Jogando, você continua ganhando normalmente. 💛
            </p>
          </div>
        )}
        <ul className="space-y-4">
          {PACOTES.map((p) => {
            const c = PALETA.cartao[p.cor];
            const total = totalDoPacote(p);
            return (
              <li
                key={p.id}
                className="relative overflow-hidden rounded-[26px] shadow-[0_6px_18px_rgba(0,0,0,0.07)]"
                style={{ background: c.fundo }}
              >
                {p.destaque && (
                  /* A fita diagonal do canto. Ela é CSS e não parte do
                       recorte: precisa acompanhar o cartão quando ele muda de
                       largura, e o texto precisa ser texto. */
                  <span
                    className="pointer-events-none absolute -left-[52px] top-[26px] z-10 w-[168px] -rotate-45 py-1.5 text-center text-[11px] font-extrabold uppercase leading-tight tracking-wide text-white shadow-sm"
                    style={{ background: PALETA.fita }}
                  >
                    Melhor
                    <br />
                    valor
                  </span>
                )}
                <div className="flex items-center gap-1 p-3.5">
                  <img
                    src={ARTE[p.id]}
                    alt=""
                    aria-hidden
                    className="h-[124px] w-[142px] shrink-0 object-contain sm:h-[142px] sm:w-[162px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-serif text-[34px] font-bold leading-none tabular-nums sm:text-[40px]"
                      style={{ color: TOM_NUMERO[p.cor] }}
                    >
                      {numeroBR(total)}
                    </p>
                    <p
                      className="mt-0.5 text-[15px] font-semibold"
                      style={{ color: TOM_NUMERO[p.cor] }}
                    >
                      sementinhas
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-semibold text-slate-700">
                      <span aria-hidden>🎁</span> Bônus: +{numeroBR(p.bonus)}
                    </p>
                    <p className="mt-2 border-t border-dashed border-black/10 pt-2 text-[12.5px] text-slate-600">
                      <span aria-hidden>🌱</span> Total: {numeroBR(total)} sementinhas
                    </p>
                    <button
                      onClick={() =>
                        podeComprar ? comprar(p) : toast(veredito.pode ? "" : veredito.texto)
                      }
                      disabled={indo !== null}
                      aria-label={
                        podeComprar
                          ? `Comprar ${numeroBR(total)} Sementinhas por ${precoBRL(p)}`
                          : `${numeroBR(total)} Sementinhas por ${precoBRL(p)} — compra ainda não disponível`
                      }
                      className="press mt-2.5 w-full rounded-full py-2.5 text-[17px] font-extrabold text-white shadow-sm disabled:opacity-60"
                      /* Sem cor quando não dá para comprar: o botão continua
                           mostrando o preço (é o layout), mas para de parecer
                           um botão que cobra.

                           ⚠️ `#5f6368` e não `#9aa0a6`. O cinza claro dava
                           **2,64:1** com o branco — o texto MENOS legível da
                           tela inteira era justamente o PREÇO, e neste estado
                           (a compra ainda não abriu) ele é o que 100% das
                           pacientes veem. Cinza mais escuro continua lendo como
                           "desligado" e leva a 6,05:1. */
                      style={{ background: podeComprar ? c.botao : "#5f6368" }}
                    >
                      {indo === p.id ? "…" : precoBRL(p)}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mx-auto mt-6 max-w-[22rem] text-center text-[13px] leading-snug text-slate-500">
          As sementinhas te ajudam a criar um cenário único para o seu bebê!
        </p>

        {/* O caminho GRATUITO, dito por extenso. Loja de moeda que esconde
            quanto se ganha jogando é a que faz a pessoa achar que comprar é a
            única saída. */}
        <p className="mx-auto mt-3 max-w-[24rem] rounded-2xl bg-emerald-50 px-4 py-3 text-center text-[12.5px] leading-relaxed text-emerald-900">
          Você ganha Sementinhas todo dia jogando — check-in, aula, meditação e as estrelas do dia
          somam até <strong>70 por dia</strong>. Os pacotes são atalho pra quem quiser, nunca
          condição pra nada.
        </p>

        {/* Extrato — de onde vieram as que ela já tem. Recolhido: numa tela
            cujo assunto é comprar, uma lista de movimentações rouba o olho do
            que ela veio ver. */}
        {extrato !== null && extrato.length > 0 && (
          <div className="mx-auto mt-4 max-w-[24rem]">
            <button
              onClick={() => setVerExtrato((v) => !v)}
              aria-expanded={verExtrato}
              className="press w-full rounded-2xl border border-border bg-white px-4 py-2.5 text-[12.5px] font-semibold text-slate-600"
            >
              {verExtrato ? "Esconder" : "Ver"} minhas últimas movimentações
            </button>
            {verExtrato && (
              <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-white">
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
            )}
          </div>
        )}

        {/* ⚠️ `slate-600` e não `slate-400`. Este parágrafo é o que traça o
            limite ético do produto — "nenhuma aula, exame, alerta ou orientação
            do seu médico depende delas" — e estava a **2,46:1**, o pior
            contraste da tela. A frase que mais importa não pode ser a mais
            apagada; `slate-600` dá 7,58:1 e continua discreta ao lado do resto. */}
        <p className="mx-auto mt-4 max-w-[24rem] text-center text-[11px] leading-relaxed text-slate-600">
          Sementinhas compram só enfeites do Meu Cantinho. Nenhuma aula, exame, alerta ou orientação
          do seu médico depende delas.
        </p>
      </div>
    </div>
  );
}
