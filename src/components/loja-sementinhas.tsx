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
  gastavelDoPacote,
  type PacoteSementinhas,
} from "@/lib/pacotes-sementinhas";
import { podeComprarAqui } from "@/lib/canal-de-venda";
import { ehNativo } from "@/lib/nativo";
import { useVoltar } from "@/lib/use-voltar";
import heroiDaLoja from "@/assets/loja/heroi-fundo.webp";
import pacoteGrande from "@/assets/pacotes/pacote-grande.webp";
import pacoteMedio from "@/assets/pacotes/pacote-medio.webp";
import pacotePequeno from "@/assets/pacotes/pacote-pequeno.webp";

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
  /* A faixa da área segura, acima do herói: a MÉDIA MEDIDA da primeira linha
     da arte (y=155 da referência, o novo topo do recorte).

     ⚠️ REMEDIR AO MEXER NO RECORTE. Esta cor já esteve em `#a8baf3`, que era a
     primeira linha do recorte ANTIGO (y=0) — a faixa da barra de status do
     mockup. Com o herói passando a começar em y=155, aquele tom ficou 25%
     mais azul que o céu de verdade, e a emenda apareceria como uma listra
     exatamente atrás do relógio do sistema. */
  topoDaArte: "#c3d8e7",
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

/* ⚠️ `FAISCAS` E `Bolha` SAÍRAM DAQUI.
   As faíscas eram `<span>` brancos borrados imitando o bokeh do jardim, e a
   `Bolha` era a personagem `feliz` no lugar da bolha com broto. As duas viviam
   sobre o gradiente que substituía a arte — com o herói virando colagem, o
   bokeh e a bolha vêm pintados, no lugar exato em que o ilustrador os pôs. */

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
      {/* ── HERÓI ──────────────────────────────────────────────────────────
          ⚠️ É UMA COLAGEM DA REFERÊNCIA, e isso é uma decisão, não preguiça.

          A versão anterior reconstruía este herói em CSS: um `linear-gradient`
          de onze paradas amostradas no lugar do jardim pintado, a bolha `feliz`
          no lugar da bolha com broto, faíscas em `<span>` no lugar do bokeh. Era
          fiel de cor e completamente diferente de resultado — o dono comparou as
          duas telas e resumiu: "uma tem cara de feita aqui, a outra de
          profissional".

          A pergunta dele foi a certa: "você só não consegue colar ela, já que é
          o mesmo modelo de proporção, e depois atribuir as funções?". Consegue.
          Tudo neste herói é ESTÁTICO — jardim, título, frase, selo e bolha são
          iguais para todas as pacientes, para sempre. Recompor em CSS cinco
          peças que nunca mudam é trabalho para chegar num resultado pior.

          ⚠️ E A LINHA DIVISÓRIA É O DADO. O saldo e os PREÇOS ficam em código:
          um preço pintado numa imagem vira mentira no dia em que ele mudar, e
          preço errado é o defeito mais caro que existe. Por isso os cartões
          continuam montados, com as ilustrações recortadas.

          ⚠️ O texto do herói vira `alt` — quem usa leitor de tela não perde o
          título nem a frase só porque eles são pixels agora.

          ⚠️ E OS CONTROLES DESENHADOS FORAM RECORTADOS FORA DA ARTE. Este
          comentário dizia que os controles de verdade eram "desenhados
          exatamente por cima e cobrem" o botão e a pílula que o ilustrador
          pintou. NÃO COBRIAM: medido no navegador, o botão pintado ia de 21,6
          a 68,6 px dentro da arte e o real de 9,8 a 53,8 — sobrava uma
          meia-lua branca embaixo dele, e outra sob a pílula. O dono viu no
          aparelho ("o enquadramento está muito sobrepondo").

          Casar dois retângulos em toda largura de tela é frágil por natureza —
          2px de erro e a meia-lua volta. `scripts/loja-heroi-do-drive.mjs`
          passou a recortar a partir de y=155, abaixo dos controles pintados e
          acima do título: some a duplicata, e some junto a faixa de barra de
          status do mockup, que estava duplicando com a `--safe-top`. */}
      {/* ─── ⚠️ A FAIXA DA ÁREA SEGURA ─────────────────────────────────────
          Esta tela é `fixed inset-0` e NUNCA compensou a área segura: no app
          instalado, o relógio e a bateria do iOS pousavam em cima do ← e da
          pílula de saldo, e o título pintado do herói ficava por baixo deles.
          O dono viu no aparelho — "está muito sobrepondo, a gente tem que dar
          uma baixada nesses elementos".

          ⚠️ E NO NAVEGADOR DE DESENVOLVIMENTO ISSO É INVISÍVEL:
          `env(safe-area-inset-top)` vale zero ali, então a tela parece
          perfeita em toda máquina em que se trabalha. É a mesma armadilha que
          fez os pesos dos espaçadores da home terem de ser medidos com a área
          segura INJETADA à mão.

          A faixa empurra a arte para baixo em vez de recuar os controles: os
          controles estão desenhados DENTRO da ilustração (é uma colagem), e
          descê-los sozinhos os descolaria do lugar onde o ilustrador os pôs.

          A cor é a MÉDIA MEDIDA da primeira linha da arte, para a emenda não
          virar uma aresta — a mesma solução da `corDeBaixo` do céu da home. */}
      {/* ─── ⚠️ A BARRA DOS CONTROLES, ACIMA DA ARTE ───────────────────────
          Ela resolve DUAS coisas que se atrapalhavam.

          1. A ÁREA SEGURA. Esta tela é `fixed inset-0` e nunca a compensou: no
             app instalado, o relógio e a bateria do iOS pousavam em cima do ←
             e da pílula de saldo. O dono viu no aparelho — "está muito
             sobrepondo, a gente tem que dar uma baixada nesses elementos". ⚠️ E
             no navegador de desenvolvimento isso é INVISÍVEL, porque
             `env(safe-area-inset-top)` vale zero ali: a tela parece perfeita em
             toda máquina em que se trabalha. Mesma armadilha que obrigou os
             espaçadores da home a serem medidos com a área segura injetada.

          2. O CÉU QUE ACABOU. Os controles flutuavam DENTRO da arte, e o
             recorte novo (que tirou os controles pintados da referência —
             ver `loja-heroi-do-drive.mjs`) deixou só ~48px de céu acima do
             título. Um botão de 44px ali encostava em "Loja de".

          ⚠️ A COR É A DA PRIMEIRA LINHA DA ARTE (medida), então a barra lê como
          continuação do céu e não como uma tarja: os controles continuam
          parecendo flutuar sobre o jardim, que é o desenho do dono. Remedir ao
          mexer no recorte — a cor anterior era a da barra de status do mockup e
          ficou 25% azul demais quando o topo mudou. */}
      <div
        className="flex items-start justify-between px-[4.4%] pb-2"
        style={{ background: PALETA.topoDaArte, paddingTop: "calc(var(--safe-top) + 0.5rem)" }}
      >
        <button
          onClick={onFechar}
          aria-label="Voltar"
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 text-xl text-slate-700 shadow-md backdrop-blur"
        >
          ←
        </button>
        {saldo !== null && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 shadow-md backdrop-blur">
            <span className="text-lg leading-none">🌱</span>
            <span className="text-lg font-extrabold tabular-nums text-emerald-700">
              {numeroBR(saldo)}
            </span>
          </span>
        )}
      </div>

      {/* A arte, sozinha e sem nada por cima — os controles moram na barra
          acima. Sem sobreposição não há mais nada que precise de `relative`. */}
      <img
        src={heroiDaLoja}
        alt="Loja de Sementinhas — use suas sementinhas para decorar e evoluir seu cenário. Compra 100% segura."
        /* `w-full h-auto`: a arte escala pela LARGURA e a altura acompanha,
           então a composição fica idêntica em qualquer celular. `cover` numa
           caixa de altura fixa cortaria as laterais no aparelho estreito. */
        className="block w-full"
        draggable={false}
      />

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
        {/* ⚠️ O AVISO "a compra abre em breve" SAIU — pedido do dono. Ele já
            tinha encolhido de uma caixa de quatro parágrafos para uma linha, e
            agora sai de vez: a referência não tem aviso nenhum, e ele empurrava
            o primeiro cartão para baixo numa tela que existe para mostrar
            cartões.

            ⚠️ A INFORMAÇÃO NÃO SE PERDEU, e é por isso que isto pode sair sem
            enganar ninguém: `podeComprar` continua barrando o toque e o
            `toast` continua explicando por extenso no momento em que ela tenta
            comprar — que é quando ela de fato precisa da explicação. */}
        <ul className="space-y-3">
          {PACOTES.map((p) => {
            const c = PALETA.cartao[p.cor];
            /* ⚠️ O NÚMERO GRANDE É O GASTÁVEL, e não a soma dos dois bolsos.
               Ver `pacotes-sementinhas.ts`: o bônus só presenteia, então somar
               prometeria poder de compra que não existe. Palavras do dono: "o
               pacote mais caro vai dar dez mil sementinhas, e um bônus de duas
               mil e quinhentas" — dois números, ditos separados. */
            const gastavel = gastavelDoPacote(p);
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
                    className="pointer-events-none absolute -left-[52px] top-[26px] z-10 w-[168px] -rotate-45 py-1.5 text-center text-xs font-extrabold uppercase leading-tight tracking-wide text-white shadow-sm"
                    style={{ background: PALETA.fita }}
                  >
                    Melhor
                    <br />
                    valor
                  </span>
                )}
                {/* ⚠️ A ALTURA DO CARTÃO É MEDIDA CONTRA A REFERÊNCIA.
                    Lá o cartão mede 769×410 (proporção 0,533); o meu estava em
                    0,621 — 16% mais alto —, e o efeito era o primeiro cartão
                    não caber na dobra junto com o herói. Ajustado no
                    espaçamento, não na tipografia: os números grandes são o que
                    dá a cara da tela. */}
                <div className="flex items-center gap-1 p-3">
                  <img
                    src={ARTE[p.id]}
                    alt=""
                    aria-hidden
                    /* ⚠️ A LARGURA DA ILUSTRAÇÃO É O QUE DECIDE A ALTURA DO CARTÃO.
                       Com 150px a coluna de texto ficava estreita e "Total:
                       15.000 sementinhas" quebrava em DUAS linhas — 51px onde a
                       referência gasta 26. Foi por aí que o cartão ficou 16%
                       mais alto que ela, e não pelo espaçamento. */
                    className="h-[112px] w-[128px] shrink-0 object-contain sm:h-[128px] sm:w-[148px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-serif text-[34px] font-bold leading-none tabular-nums sm:text-[40px]"
                      style={{ color: TOM_NUMERO[p.cor] }}
                    >
                      {numeroBR(gastavel)}
                    </p>
                    <p
                      className="mt-0.5 text-[15px] font-semibold"
                      style={{ color: TOM_NUMERO[p.cor] }}
                    >
                      sementinhas
                    </p>
                    {/* ⚠️ A PÍLULA DIZ PARA QUE SERVE, e não só o número.
                        "Bônus: +2.500" ao lado de "10.000 sementinhas" é lido
                        como 12.500 de saldo por qualquer pessoa — a soma
                        acontece na cabeça de quem lê, mesmo sem estar escrita.
                        O que impede isso é a frase, não o layout. */}
                    <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      <span aria-hidden>🎁</span> +{numeroBR(p.bonusParaPresentear)} para presentear
                    </p>
                    <p className="mt-1.5 border-t border-dashed border-black/10 pt-1.5 text-xs leading-snug text-slate-600">
                      {numeroBR(gastavel)} para o seu Cantinho · {numeroBR(p.bonusParaPresentear)}{" "}
                      só para dar às suas amigas
                    </p>
                    <button
                      onClick={() =>
                        podeComprar ? comprar(p) : toast(veredito.pode ? "" : veredito.texto)
                      }
                      disabled={indo !== null}
                      /* O leitor de tela recebe os DOIS bolsos, ditos como
                         duas coisas — é a mesma regra do cartão, e quem não vê
                         a tela depende inteiramente desta frase. */
                      aria-label={
                        (podeComprar ? "Comprar " : "") +
                        `${numeroBR(gastavel)} Sementinhas mais ${numeroBR(
                          p.bonusParaPresentear,
                        )} de bônus para presentear amigas, por ${precoBRL(p)}` +
                        (podeComprar ? "" : " — compra ainda não disponível")
                      }
                      className="press mt-2 w-full rounded-full py-2 text-[17px] font-extrabold text-white shadow-sm disabled:opacity-60"
                      /* Sem cor quando não dá para comprar: o botão continua
                           mostrando o preço (é o layout), mas para de parecer
                           um botão que cobra.

                           ⚠️ `#5f6368` e não `#9aa0a6`. O cinza claro dava
                           **2,64:1** com o branco — o texto MENOS legível da
                           tela inteira era justamente o PREÇO, e neste estado
                           (a compra ainda não abriu) ele é o que 100% das
                           pacientes veem. Cinza mais escuro continua lendo como
                           "desligado" e leva a 6,05:1. */
                      /* ⚠️ A COR DO CARTÃO SEMPRE, mesmo com a compra fechada.
                         O cinza era meu ("para de parecer um botão que cobra"),
                         e ele destruía o layout que o dono desenhou — o preço
                         em cinza é a coisa mais apagada de uma tela que existe
                         para mostrar preço. O que impede a cobrança indevida
                         não é a cor: é `podeComprar`, que continua barrando o
                         toque e explicando. */
                      style={{ background: c.botao }}
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

        {/* ⚠️ O BLOCO VERDE DO "caminho gratuito" SAIU — pedido do dono.
            Ele dizia quanto se ganha jogando por dia, e a intenção era boa
            (loja de moeda que esconde o caminho grátis é a que faz a pessoa
            achar que comprar é a única saída).

            O que segura a decisão de tirá-lo é o parágrafo que FICA, logo
            abaixo: o limite ético do produto — "Sementinhas compram só
            enfeites; nenhuma aula, exame, alerta ou orientação do seu médico
            depende delas" — continua na tela, e é ele que impede a loja de
            parecer que vende cuidado. Esse não sai. */}

        {/* Extrato — de onde vieram as que ela já tem. Recolhido: numa tela
            cujo assunto é comprar, uma lista de movimentações rouba o olho do
            que ela veio ver. */}
        {extrato !== null && extrato.length > 0 && (
          <div className="mx-auto mt-4 max-w-[24rem]">
            <button
              onClick={() => setVerExtrato((v) => !v)}
              aria-expanded={verExtrato}
              className="press w-full rounded-2xl border border-border bg-white px-4 py-2.5 text-xs font-semibold text-slate-600"
            >
              {verExtrato ? "Esconder" : "Ver"} minhas últimas movimentações
            </button>
            {verExtrato && (
              <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-white">
                {extrato.slice(0, 8).map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {l.reason ?? "Movimentação"}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-bold tabular-nums ${
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
        <p className="mx-auto mt-4 max-w-[24rem] text-center text-xs leading-relaxed text-slate-600">
          Sementinhas compram só enfeites do Meu Cantinho. Nenhuma aula, exame, alerta ou orientação
          do seu médico depende delas.
        </p>
      </div>
    </div>
  );
}
