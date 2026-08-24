/**
 * AS DUAS TELAS NO MODELO INSTAGRAM — o feed e o perfil.
 *
 * Pedido do dono: "vamos copiar exatamente o modelo do Instagram — a tela
 * principal, onde mostra todo mundo que você segue e às vezes gente que você
 * não segue, e a tela do perfil".
 *
 * As medidas moram em `src/lib/medidas-instagram.ts`, com a origem de cada uma
 * e um teste que cobra as relações (o anel fora da foto, a grade 3:4, a
 * hierarquia de tamanho dos avatares). Aqui fica o desenho.
 *
 * ─── O QUE FOI COPIADO, E O QUE NÃO ────────────────────────────────────────
 *
 * COPIADO: a estrutura inteira. Barra de topo com marca à esquerda e ações à
 * direita; fileira de stories com anel; post de imagem inteira com a linha de
 * ações embaixo e a legenda abaixo dela; perfil com avatar grande, números,
 * bio, botões e grade de três colunas com abas.
 *
 * NÃO COPIADO, e são três, todas deliberadas:
 *
 *  1. **O degradê do anel.** Laranja-rosa-roxo é a marca deles. A estrutura
 *     (anel aceso = tem coisa nova) é convenção; a cor é identidade.
 *  2. **Quatro abas viram duas.** Eles têm quatro tipos de conteúdo; este app
 *     tem um. Três abas vazias entregam a sensação de um app pela metade.
 *  3. **Seguidores e seguindo não são públicos.** A única divergência de
 *     produto, e está pesquisada — ver `NUMEROS_PUBLICOS`.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABAS_DO_PERFIL,
  ANEL_NOVO,
  ANEL_VISTO,
  AVATAR_DO_PERFIL,
  AVATAR_DO_POST,
  CAIXA_DO_STORY,
  ESPESSURA_DO_ANEL,
  FOTO_DO_STORY,
  NUMEROS_PUBLICOS,
  RAZAO_DA_GRADE,
  RAZAO_DO_POST,
  VAO_DA_GRADE,
  VAO_DO_ANEL,
  type AbaDoPerfil,
} from "@/lib/medidas-instagram";
import { PERSONAS, type Persona } from "@/lib/selo-do-perfil";
import { ATIVIDADES_DO_DESAFIO, fraseDoGrupo } from "@/lib/desafio-em-grupo";
import type { DesafioNaTela } from "@/lib/desafio-em-grupo.functions";
import {
  emojiDaReacao,
  enqueteValida,
  haQuantoPublicou,
  limparOpcoes,
  LIMITE_DA_OPCAO,
  OPCOES_MAX,
  OPCOES_MIN,
  rotuloDeVotos,
  LIMITE_DA_BIO,
  LIMITE_DO_TEXTO,
  MINIMO_DA_BUSCA,
  postEhValido,
  principaisReacoes,
  REACAO_DO_TOQUE_DUPLO,
  REACOES,
  textoDoAviso,
  totalDeReacoes,
  VISIBILIDADES,
  type AulaNoPost,
  type TipoDeReacao,
  type Visibilidade,
} from "@/lib/rede-social";
import { LIMITE_DA_PERGUNTA, recadoDoDesfecho, type DesfechoDaPergunta } from "@/lib/caixinha-tela";
import { publicarAtalhos, type AtalhoDaAba } from "@/lib/atalhos-da-aba";
import { linkDeIndicacao, linkDoWhatsApp, mensagemDeConvite, SITE } from "@/lib/indicacao";
/* Import ESTÁTICO: régua pura, sem servidor e sem DOM — ver `lugar-no-feed.ts`. */
import {
  chaveDoLugar,
  deveRestaurar,
  lerLugar,
  paraGuardar as lugarParaGuardar,
} from "@/lib/lugar-no-feed";
/* Import ESTÁTICO pela mesma razão: régua pura, sem servidor e sem DOM. */
import { chaveDoLembrete, legendaSugerida, lembreteDoEntao } from "@/lib/entao-e-agora";
import type { Momento } from "@/lib/momento";
import { SELO_OFICIAL } from "@/lib/conta-oficial";
import { SELO_PREMIUM } from "@/lib/assinatura";
import { liveDoTopo, quandoAcontece, type LiveNoTopo } from "@/lib/proxima-live";
import { ROTULO_DO_FILTRO, VAZIO_DO_FILTRO } from "@/lib/fase-parecida";
import { esquecerMomento, lerMomentoParaPublicar } from "@/lib/momento-para-publicar";
import { momentoComoDataUrl } from "@/lib/share-card";
import { hapticTap } from "@/lib/haptics";
import { aplicarSugestao, LADO_PARA_A_IA } from "@/lib/legenda-sugerida";
import { MARCADAS_MAX, textoDeMarcadas } from "@/lib/marcacoes";
import { MOTIVOS, type MotivoDaDenuncia } from "@/lib/denuncias";
import { CELULA_DA_GRADE, LADO_DA_MINIATURA, urlDaGrade, valeMiniatura } from "@/lib/miniatura";
import {
  esquecerDoCache,
  guardarNoCache,
  lerDoCache,
  VALIDADE_DO_PERFIL_MS,
} from "@/lib/cache-do-feed";
import {
  esbocoDoAutor,
  QUADRADOS_DO_ESQUELETO,
  type EsbocoDePerfil,
  type PreviaDoAutor,
} from "@/lib/esboco-de-perfil";
import {
  chaveDaRetrospectiva,
  ehDomingo,
  fraseDaRetrospectiva,
  type Retrospectiva,
} from "@/lib/retrospectiva";
/* Import ESTÁTICO: `rascunho-do-post.ts` é régua pura — não toca em servidor,
   em `document` nem em regex com lookbehind. É seguro no pacote da paciente. */
import {
  chaveDoRascunho,
  lerRascunho,
  paraGuardar,
  type RascunhoDoPost,
} from "@/lib/rascunho-do-post";
import type {
  AtividadeNaTela,
  BolhaDeStory,
  PerfilNaTela,
  PostNaTela,
} from "@/lib/rede-social.functions";

/* ══════════════════════════════════════════════════════════════════════════
   PEÇAS
   ══════════════════════════════════════════════════════════════════════════ */

function Foto({ url, nome, lado }: { url: string | null; nome: string; lado: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="rounded-full object-cover"
        style={{ width: lado, height: lado }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: lado, height: lado, fontSize: Math.round(lado * 0.4) }}
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** A bolinha com anel. `novo` acende; visto fica cinza. */
export function BolinhaDeStory({
  url,
  nome,
  rotulo,
  novo = true,
  aoTocar,
}: {
  url: string | null;
  nome: string;
  rotulo: string;
  novo?: boolean;
  aoTocar?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      className="press flex shrink-0 flex-col items-center gap-1"
      style={{ width: CAIXA_DO_STORY + 12 }}
    >
      {/* O anel é o fundo; o vão é o padding branco; a foto vem por cima.
          Três camadas, como no original — não uma borda no `<img>`, que
          encostaria na imagem e leria como moldura. */}
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: CAIXA_DO_STORY,
          height: CAIXA_DO_STORY,
          padding: ESPESSURA_DO_ANEL,
          background: novo
            ? `linear-gradient(135deg, ${ANEL_NOVO[0]}, ${ANEL_NOVO[1]})`
            : ANEL_VISTO,
        }}
      >
        <span
          className="flex items-center justify-center rounded-full bg-background"
          style={{
            width: FOTO_DO_STORY + VAO_DO_ANEL * 2,
            height: FOTO_DO_STORY + VAO_DO_ANEL * 2,
          }}
        >
          <Foto url={url} nome={nome} lado={FOTO_DO_STORY} />
        </span>
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight text-foreground/80">
        {rotulo}
      </span>
    </button>
  );
}

export type Story = { id: string; nome: string; avatarUrl: string | null; novo: boolean };

/**
 * ⚠️ **`memo`, e a razão é medida.**
 *
 * A fileira repintava INTEIRA a cada toque no feed — vinte dos trinta e oito
 * renders lógicos de uma única reação eram as bolinhas, que não mudaram nada.
 * Ela é o primeiro elemento da aba e o mais caro por render (uma imagem redonda
 * por pessoa), então é o pior lugar possível para repintar à toa.
 *
 * ⚠️ E `memo` só acerta se as PROPS forem estáveis: a lista vem de um `useMemo`
 * e `aoTocar` do objeto `acoes`, que tem referência fixa. Um fecho inline aqui
 * desfaria o `memo` por completo e em silêncio — é o defeito que já custou
 * 232 ms no cartão do post.
 */
export const FileiraDeStories = memo(function FileiraDeStories({
  stories,
  aoTocar,
}: {
  stories: Story[];
  aoTocar?: (id: string) => void;
}) {
  if (stories.length === 0) return null;
  return (
    <div className="-mx-4 border-b border-border">
      {/* Rola na horizontal e sangra nas laterais — a última bolinha tem de
          encostar na borda da tela, senão a fileira parece ter acabado. */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((s) => (
          <BolinhaDeStory
            key={s.id}
            url={s.avatarUrl}
            nome={s.nome}
            rotulo={s.nome}
            novo={s.novo}
            aoTocar={() => aoTocar?.(s.id)}
          />
        ))}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   O CARROSSEL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Várias fotos num post.
 *
 * ⚠️ **Rolagem nativa com `scroll-snap`, e não um `transform` controlado por
 * estado.** O deslizar do dedo tem inércia, resistência na borda e velocidade
 * que o sistema calcula — reimplementar isso em JavaScript dá sempre um
 * arrasto que parece quase certo e nunca é. O navegador já faz, e faz melhor.
 *
 * ⚠️ E os pontinhos saem do `scrollLeft`, não de um índice que o toque
 * incrementa: com índice próprio, arrastar até a metade e soltar deixaria o
 * ponto num lugar e a foto noutro.
 */
/**
 * O CORAÇÃO DO TOQUE DUPLO — desenhado, nunca ❤️.
 *
 * A mesma lição do 📞 preto no iOS e do 📅 com data dentro do glifo: emoji é um
 * caractere que cada fabricante desenha do jeito dele. Este aqui precisa
 * aparecer BRANCO sobre a foto, com sombra, e crescer — e um emoji herda a cor
 * e o desenho do sistema, então em metade dos aparelhos ele sairia vermelho
 * chapado no meio de uma ultrassom.
 */
function CoracaoDoToque() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-24 w-24 drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
      fill="#ffffff"
    >
      <path d="M12 21s-7.5-4.7-9.6-9A5.6 5.6 0 0 1 12 6.1 5.6 5.6 0 0 1 21.6 12c-2.1 4.3-9.6 9-9.6 9z" />
    </svg>
  );
}

/**
 * O CORAÇÃO VAZIO da linha de ações — o convite da tela.
 *
 * ⚠️ Era 🤍 (emoji). Ele sai CINZA no Android, quase invisível no modo escuro
 * do iOS e com desenho diferente em cada fabricante — e este é o botão que a
 * tela inteira existe para fazer alguém tocar. Contorno desenhado: mesma
 * espessura do marcador de salvar, ao lado do qual ele vive.
 */
/**
 * O LÁPIS de editar — desenhado, nunca ✏️.
 *
 * ⚠️ A mesma lição do 📞 preto no iOS, do 📅 com data dentro do glifo e do 🤍
 * cinza no Android: emoji é um caractere que cada fabricante desenha do jeito
 * dele, e este vive na mesma linha que o ⋯, que é um traço da cor do texto. Um
 * lápis amarelo-e-marrom ao lado dele lê como adesivo colado ali.
 */
/**
 * O SELETOR DE MOTIVO — usado no post e no perfil.
 *
 * ⚠️ **Catálogo fechado, e nunca campo livre.** A razão está em `denuncias.ts`:
 * texto aberto num app de gestação é onde alguém escreve a informação clínica
 * de OUTRA pessoa, e esse texto iria para uma tela de administração, gravado,
 * sobre quem nunca soube.
 *
 * ⚠️ **Um componente só, e não duas cópias.** As duas portas (post e perfil)
 * precisam oferecer exatamente os mesmos motivos — duas listas divergiriam no
 * primeiro ajuste, e a fila passaria a receber motivos que a tela do outro lado
 * não sabe nomear.
 */
export function EscolherMotivo({
  titulo,
  aviso,
  aoCancelar,
  aoEnviar,
}: {
  titulo: string;
  aviso: string;
  aoCancelar: () => void;
  aoEnviar: (motivo: MotivoDaDenuncia) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoDaDenuncia | null>(null);
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3">
      <p className="text-[13px] font-semibold leading-snug">{titulo}</p>
      {/* ⚠️ Diz que é CALADO: sem isso ela hesita achando que a outra vai
          saber — a mesma razão pela qual o bloqueio é mudo. */}
      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{aviso}</p>

      <div className="mt-2.5 space-y-1">
        {MOTIVOS.map((m) => (
          <button
            key={m.motivo}
            type="button"
            onClick={() => setMotivo(m.motivo)}
            aria-pressed={motivo === m.motivo}
            className={`press block min-h-[44px] w-full rounded-xl border px-3 py-1.5 text-left ${
              motivo === m.motivo ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <span className="block text-[13px] font-medium">{m.rotulo}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              {m.explica}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={aoCancelar}
          className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
        >
          Cancelar
        </button>
        <button
          type="button"
          /* ⚠️ Só habilita com motivo escolhido: sem isso a fila recebe
             "outro" por omissão, e o campo que existe para dizer POR QUÊ passa
             a não dizer nada. */
          disabled={!motivo}
          onClick={() => motivo && aoEnviar(motivo)}
          className="press flex-1 rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground disabled:opacity-45"
        >
          Denunciar
        </button>
      </div>
    </div>
  );
}

function IconeLapis() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[17px] w-[17px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L8.5 17.5 4 19l1.5-4.5z" />
    </svg>
  );
}

function CoracaoVazio() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[26px] w-[26px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7-4.4-9-8.4A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9 5.5c-2 4-9 8.4-9 8.4z" />
    </svg>
  );
}

function Carrossel({
  urls,
  aoToqueDuplo,
  comparacao,
}: {
  urls: string[];
  aoToqueDuplo?: () => void;
  /** "Então e agora": os rótulos das DUAS primeiras fotos. */
  comparacao?: { antes: string; agora: string } | null;
}) {
  const [i, setI] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  /* Muda a cada toque duplo: é a CHAVE do elemento, e trocar a chave é o que
     reinicia a animação. Sem isso, o segundo toque duplo seguido não desenha
     coração nenhum — o elemento já existe e o CSS não recomeça sozinho. */
  const [batida, setBatida] = useState(0);
  const desce = useRef({ x: 0, y: 0 });
  const ultimo = useRef(0);

  if (urls.length === 0) return null;

  /**
   * ⚠️ **Duas travas, e as duas existem porque a foto TAMBÉM desliza.**
   *
   * 1. Se o dedo ANDOU mais de 12px entre descer e subir, foi arrasto de
   *    carrossel — não conta como toque. Sem isso, deslizar duas fotos rápido
   *    virava "amei" numa publicação que ela só estava folheando.
   * 2. O relógio zera depois de disparar, para o TERCEIRO toque de uma
   *    sequência não formar um segundo par com o segundo.
   */
  function aoSoltar(e: React.PointerEvent) {
    if (!aoToqueDuplo) return;
    const andou = Math.hypot(e.clientX - desce.current.x, e.clientY - desce.current.y);
    if (andou > 12) return;
    const agora = e.timeStamp;
    if (ultimo.current && agora - ultimo.current < 320) {
      ultimo.current = 0;
      setBatida((n) => n + 1);
      aoToqueDuplo();
      return;
    }
    ultimo.current = agora;
  }

  return (
    <div className="relative">
      <div
        ref={caixa}
        onPointerDown={(e) => {
          desce.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={aoSoltar}
        onScroll={(e) => {
          const el = e.currentTarget;
          const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (n !== i) setI(n);
        }}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ aspectRatio: String(RAZAO_DO_POST) }}
      >
        {urls.map((u, n) => (
          <div key={n} className="relative w-full shrink-0 snap-center overflow-hidden bg-muted/40">
            <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
            {/* ⚠️ O carimbo pousa DENTRO da foto, e não numa faixa em volta:
                quem salva a imagem para mandar no WhatsApp leva a semana junto,
                que é metade do valor do formato. E só nas DUAS primeiras — as
                demais do carrossel não fazem parte da comparação. */}
            {comparacao && n <= 1 && (
              <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1.5 text-[15px] font-bold text-white backdrop-blur-sm">
                {n === 0 ? comparacao.antes : comparacao.agora}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ⚠️ `pointer-events-none`: ele nasce EM CIMA da foto, e sem isso o
          próximo toque acertaria o coração em vez do carrossel — o duplo toque
          deixaria de funcionar logo depois de funcionar uma vez. */}
      {batida > 0 && (
        <div
          key={batida}
          className="dc-coracao-estoura pointer-events-none absolute inset-0 grid place-items-center"
        >
          <CoracaoDoToque />
        </div>
      )}

      {urls.length > 1 && (
        <>
          {/* O contador no canto, como eles fazem — é o que diz de cara que
              há mais de uma foto, antes de a pessoa tentar deslizar. */}
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {i + 1}/{urls.length}
          </span>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {urls.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  n === i ? "bg-primary" : "bg-foreground/25"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O POST — no formato deles
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O MARCADOR — desenhado, nunca 🔖.
 *
 * Mesma lição do 📞 da Central de Emergência e do 📅 da fita: emoji é um
 * caractere que cada fabricante desenha do jeito dele, e este aqui precisa ter
 * DOIS estados que se distingam de longe — vazio e cheio. O contorno com
 * `fill="none"` e o cheio com `fill="currentColor"` são a mesma silhueta, então
 * a troca não mexe no arranjo da linha.
 */
/**
 * A lupa da busca — desenhada, e pela razão de sempre.
 *
 * ⚠️ 🔍 é emoji COLORIDO em todo sistema, e ela senta ao lado de duas marcas
 * monocromáticas (o ♡ e o ＋). Medido na bancada: um ícone azul-e-cinza no meio
 * de dois traços da cor do texto lê como adesivo colado ali, não como a
 * terceira ação da mesma barra.
 */
function IconeLupa() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[21px] w-[21px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    >
      <circle cx="10.6" cy="10.6" r="6.4" />
      <path d="M15.4 15.4 20 20" />
    </svg>
  );
}

function IconeMarcador({ cheio }: { cheio: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[22px] w-[22px]"
      fill={cheio ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M6 3.6h12c.6 0 1 .4 1 1v15.6l-7-4.4-7 4.4V4.6c0-.6.4-1 1-1z" />
    </svg>
  );
}

/**
 * ⚠️ AS AÇÕES RECEBEM O POST — e essa assinatura existe por DESEMPENHO.
 *
 * Elas eram `(t) => void`, e a lista montava um fecho por post e por ação:
 * `aoReagir={(t) => aoReagir(p, t)}`. Cinco funções novas por post a cada
 * pintura — então `memo` neste componente não valeria nada, porque as props
 * mudam de identidade mesmo quando o post não muda.
 *
 * Medido em `/preview-instagram`, com 19 posts e a CPU estrangulada em 6×:
 * escolher uma reação custava **232 ms** do toque à pintura, porque
 * `setPosts` devolve uma lista nova e TODOS os cartões redesenhavam. Acima de
 * 100 ms o toque deixa de parecer instantâneo — e o feed só cresce.
 *
 * Com o post de volta pelo argumento, quem chama passa a MESMA referência para
 * todos os cartões, e `aplicar` já preserva a identidade de quem não mudou
 * (`if (p.id !== post.id) return p`). Aí `memo` funciona: repinta um cartão.
 */
export const PostInstagram = memo(function PostInstagram({
  post,
  aoReagir,
  aoAbrirPerfil,
  aoSalvar,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoTirarMarcacao,
  aoVerQuemReagiu,
  aoEditar,
  aoVer,
  sugerido = false,
}: {
  post: PostNaTela;
  aoReagir: (post: PostNaTela, t: TipoDeReacao | null) => void;
  aoAbrirPerfil?: (id: string) => void;
  /**
   * O cartão entrou na tela — conta como visto.
   *
   * ⚠️ **UMA REFERÊNCIA para todos os cartões**, como `aoReagir`: um fecho por
   * post faz as props mudarem a cada pintura e o `memo` nunca acertar.
   *
   * ⚠️ E ele dispara UMA VEZ por montagem: o observador se desliga no primeiro
   * cruzamento. Sem isso, rolar para cima e para baixo mandaria o mesmo id dez
   * vezes — a chave primária dedupa no banco, mas o tráfego seria real.
   */
  aoVer?: (id: string) => void;
  /** Guardar/desguardar. Sem ele o marcador não aparece. */
  aoSalvar?: (post: PostNaTela, salvar: boolean) => void;
  /** Só faz sentido no post DELA — a tela confere `souAAutora`. */
  aoApagar?: (post: PostNaTela) => void;
  /**
   * Denunciar. Só no post de OUTRA pessoa.
   *
   * ⚠️ Era a lacuna que fechava o círculo: a caixinha tinha denúncia e o FEED
   * não — o canal com mais alcance era o único sem canal de reporte. A régua
   * clínica agora roda em `publicarPost`; o que sobra são as coisas que régua
   * nenhuma pega (assédio, mentira, foto de outra pessoa), e para essas o único
   * caminho é uma pessoa olhar.
   */
  aoDenunciar?: (post: PostNaTela, motivo: MotivoDaDenuncia) => void;
  /** Votar na enquete. Sem ele as opções aparecem inertes. */
  aoVotar?: (post: PostNaTela, opcao: number) => void;
  /** Tirar a PRÓPRIA marcação. Só aparece quando `post.souMarcada`. */
  aoTirarMarcacao?: (post: PostNaTela) => void;
  /**
   * Salvar a legenda editada. Devolve `true` quando gravou.
   *
   * ⚠️ Devolve BOOLEANO porque a régua clínica pode recusar: o campo só fecha
   * quando gravou, senão o texto dela sumiria junto com a recusa.
   */
  aoEditar?: (post: PostNaTela, texto: string) => Promise<boolean>;
  /** Ver quem reagiu. Só no post DELA — ver a nota na linha de ações. */
  aoVerQuemReagiu?: (post: PostNaTela) => void;
  /** Veio do algoritmo, não de quem ela segue. */
  sugerido?: boolean;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /** `null` = não está editando. String = o texto em edição. */
  const [editando, setEditando] = useState<string | null>(null);
  const [salvandoTexto, setSalvandoTexto] = useState(false);
  const total = totalDeReacoes(post.reacoes);
  /* Post antigo (anterior ao carrossel) tem `imagens` vazio e só
     `imagemUrl` — o recuo faz os dois terem a mesma forma aqui. */
  const fotos = post.imagens?.length ? post.imagens : post.imagemUrl ? [post.imagemUrl] : [];

  /* ─── O CARTÃO ENTROU NA TELA ────────────────────────────────────────────
     ⚠️ **`IntersectionObserver`, e não um ouvinte de `scroll`** — a aba vive
     dentro de `minha-conta`, e quem rola pode ser a janela ou um contêiner
     interno. É a mesma razão da sentinela da paginação.

     ⚠️ **Metade do cartão visível, e não um pixel.** Um post que só encostou na
     borda enquanto ela rolava rápido não foi VISTO por ninguém, e contar isso
     transformaria o número em "quantas vezes o cartão passou pela tela" com
     nome de "quantas pessoas viram".

     ⚠️ **Desliga no primeiro cruzamento.** Rolar para cima e para baixo mandaria
     o mesmo id dez vezes: a chave primária dedupa no banco, mas o tráfego seria
     real, e ele acontece durante a rolagem. */
  const caixa = useRef<HTMLElement>(null);
  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo || !aoVer) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          aoVer(post.id);
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [aoVer, post.id]);

  return (
    /* ⚠️ `data-post` é a ÂNCORA de "onde ela parou" — ver `lugar-no-feed.ts`. O
       lugar é guardado por ID de post, e não em pixels: as fotos chegam por URL
       assinada DEPOIS da primeira pintura, então a altura da lista muda embaixo
       de qualquer número de rolagem. */
    <article data-post={post.id} ref={caixa} className="-mx-4 border-b border-border pb-3">
      <header className="flex items-center gap-2.5 px-4 py-2.5">
        <button
          type="button"
          onClick={() => aoAbrirPerfil?.(post.autorId)}
          className="press flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Foto url={post.autorAvatar} nome={post.autorNome} lado={AVATAR_DO_POST} />
          <span className="min-w-0">
            {/* ⚠️ **O SELO DO CONSULTÓRIO VIVE AQUI, no cabeçalho do cartão.**
                Ele era montado no servidor e desenhado só na fileira de
                sugeridas — ou seja, no lugar onde a paciente passa uma vez, e
                não no lugar onde a conta oficial de fato aparece. Sem ele no
                post, uma conta institucional publicando orientação lia como
                mais uma paciente chamada "Obstétrica", que é exatamente o que
                um selo existe para impedir.

                ⚠️ `truncate` fica no NOME, e o selo é irmão dele: dentro do
                mesmo `span` truncado, o selo some junto com o fim de um nome
                comprido — e o selo é a informação, não o enfeite. */}
            <span className="flex min-w-0 items-center text-[13px] font-semibold leading-tight">
              <span className="truncate">{post.autorNome}</span>
              {post.autorOficial && <SeloOficial />}
              {post.autorPremium && <SeloPremium />}
            </span>
            {/* ⚠️ "Sugerido para você" é OBRIGATÓRIO quando o post não veio de
                quem ela segue. Sem o rótulo, o feed passa a misturar estranhos
                sem avisar — e num app de gestação de alto risco a pessoa
                precisa saber se está lendo uma amiga ou uma desconhecida. */}
            {sugerido && (
              <span className="block text-[11px] leading-tight text-muted-foreground">
                Sugerido para você
              </span>
            )}
            {/* ⚠️ "com Marina e Carol" — até dois nomes por extenso, do terceiro
                em diante contagem. Cinco nomes estouram a largura de um iPhone
                e empurram a hora do post para a linha de baixo. Régua em
                `marcacoes.ts`, testada. */}
            {textoDeMarcadas(post.marcadas.map((m) => m.nome)) && (
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {textoDeMarcadas(post.marcadas.map((m) => m.nome))}
              </span>
            )}
          </span>
        </button>
        {/* O ⋯ tem uma ação por lado: apagar no post DELA, denunciar no de
            outra pessoa. No modelo ele abre um menu com oito itens; aqui é uma
            só de cada lado, e um menu de um item é um botão com uma etapa a
            mais. */}
        {/* ✏️ Editar — só no post DELA, e separado do ⋯: apagar/denunciar são
            ações de fim de linha, editar é conserto. Misturar as três faria a
            mais frequente (corrigir uma vírgula) ficar atrás de um menu que
            existe para as outras duas. */}
        {post.souAAutora && aoEditar && (
          <button
            type="button"
            onClick={() => setEditando(post.texto ?? "")}
            aria-label="Editar a legenda"
            className="press grid h-11 w-9 shrink-0 place-items-center text-muted-foreground"
          >
            <IconeLapis />
          </button>
        )}
        {((post.souAAutora && aoApagar) ||
          (!post.souAAutora && aoDenunciar) ||
          (post.souMarcada && aoTirarMarcacao)) && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label="Opções da publicação"
            className="press grid h-11 w-9 shrink-0 place-items-center text-lg leading-none text-muted-foreground"
          >
            ⋯
          </button>
        )}
      </header>

      {/* ⚠️ A confirmação é uma MENSAGEM separada, e não o mesmo botão virando
          "tem certeza?" — é a mesma decisão do cancelar consulta.

          ⚠️ **E ela passou a dizer a verdade.** A ação sempre foi ARQUIVAR (o
          servidor marca `arquivado_em`, nunca deleta — as reações apontam para
          o post), mas a tela chamava de "apagar": a paciente tomava uma decisão
          que ela achava irreversível, e "apaguei o post do chá de bebê sem
          querer" é o arrependimento clássico do formato. A palavra mudou e a
          volta ganhou tela. */}
      {/* ⚠️ A SAÍDA DE QUEM FOI MARCADA é um botão PRÓPRIO, e não mais um item
          na mesma confirmação: apagar e denunciar são sobre o post da outra
          pessoa; tirar a marcação é sobre o NOME DELA. Misturar as três faria a
          ação mais provável (tirar o próprio nome) ficar atrás de uma pergunta
          escrita para outra coisa. */}
      {post.souMarcada && aoTirarMarcacao && !confirmando && (
        <div className="px-4 pt-1">
          <button
            type="button"
            onClick={() => aoTirarMarcacao(post)}
            className="press text-[12px] font-medium text-muted-foreground underline underline-offset-2"
          >
            Tirar minha marcação
          </button>
        </div>
      )}

      {/* ⚠️ EDITA NO LUGAR, e não numa tela nova. Sair do feed para corrigir uma
          vírgula perde o contexto do que ela estava lendo — e o post inteiro
          continua à vista enquanto ela escreve. */}
      {editando !== null && (
        <div className="mx-4 mb-2 rounded-2xl border border-border bg-muted/30 p-3">
          <textarea
            value={editando}
            onChange={(e) => setEditando(e.target.value.slice(0, LIMITE_DO_TEXTO))}
            rows={3}
            autoFocus
            aria-label="Legenda"
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[14px] leading-snug"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvandoTexto}
              onClick={async () => {
                setSalvandoTexto(true);
                const ok = await aoEditar?.(post, editando);
                setSalvandoTexto(false);
                /* ⚠️ Só fecha se GRAVOU. Fechando de qualquer jeito, uma recusa
                   da régua clínica sumiria com o texto que ela escreveu — e ela
                   não teria como ler o recado nem tentar de novo. */
                if (ok) setEditando(null);
              }}
              className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {salvandoTexto ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ Duas telas diferentes atrás do mesmo ⋯, e de propósito: arquivar é
          uma pergunta de sim/não sobre o post DELA; denunciar precisa do
          MOTIVO, porque sem ele a fila da plataforma não sabe o que julgar. */}
      {confirmando && post.souAAutora && (
        <div className="mx-4 mb-2 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-[13px] leading-snug">
            Tirar esta publicação do ar? Ela vai para os arquivados, e você pode trazer de volta
            quando quiser.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                aoApagar?.(post);
              }}
              /* ⚠️ Vermelho só para DENUNCIAR. Arquivar é reversível, e pintar
                 de destrutivo o que se desfaz num toque ensina a ter medo do
                 botão errado. */
              className="press flex-1 rounded-xl bg-foreground/85 py-1.5 text-[13px] font-semibold text-background"
            >
              Sim, arquivar
            </button>
          </div>
        </div>
      )}

      {confirmando && !post.souAAutora && (
        <div className="mx-4 mb-2">
          <EscolherMotivo
            titulo="Por que você está denunciando esta publicação?"
            aviso="Ela fica registrada para a gente olhar, e quem publicou não é avisada."
            aoCancelar={() => setConfirmando(false)}
            aoEnviar={(m) => {
              setConfirmando(false);
              aoDenunciar?.(post, m);
            }}
          />
        </div>
      )}

      {post.imagemUrl && (
        <Carrossel
          urls={fotos}
          comparacao={post.comparacao}
          /* ⚠️ O toque duplo SEMPRE dá coração, e nunca TIRA. É assim no modelo,
             e o motivo é o gesto: quem toca duas vezes está dizendo "gostei",
             não "mudei de ideia". Se ele alternasse, tocar duas vezes num post
             já curtido apagaria a reação com uma animação de coração — a tela
             mostraria o oposto do que acabou de acontecer. */
          aoToqueDuplo={() => {
            hapticTap();
            if (post.minhaReacao !== REACAO_DO_TOQUE_DUPLO) aoReagir(post, REACAO_DO_TOQUE_DUPLO);
          }}
        />
      )}

      {/* A linha de ações vem LOGO ABAIXO da imagem, antes da legenda — é a
          ordem deles, e ela existe porque a ação é o que a tela quer que
          aconteça primeiro. */}
      <div className="flex items-center gap-2.5 px-4 pt-2.5">
        <button
          type="button"
          onClick={() => {
            hapticTap();
            setEscolhendo((v) => !v);
          }}
          aria-label={post.minhaReacao ? "Trocar a reação" : "Reagir"}
          aria-expanded={escolhendo}
          className="press grid h-11 w-11 -ml-2 place-items-center leading-none"
        >
          {post.minhaReacao ? (
            /* Já reagiu: o emoji DELA, com o pulo de quem acabou de escolher. */
            <span key={post.minhaReacao} className="dc-pop text-[26px] leading-none">
              {emojiDaReacao(post.minhaReacao)}
            </span>
          ) : (
            /* ⚠️ Vazio é um coração DESENHADO, e não 🤍. O emoji do coração
               branco sai cinza no Android e quase invisível no modo escuro do
               iOS — e ele é o convite da tela inteira. */
            <CoracaoVazio />
          )}
        </button>
        {/* ⚠️ O RESUMO SÓ É BOTÃO NO POST DELA. A lista de quem reagiu a um post
            de gestação é o círculo social — a mesma razão pela qual este app
            não tem lista pública de seguidores. Para as outras, o resumo
            continua sendo texto, e não um botão que promete e recusa. */}
        {total > 0 && post.souAAutora && aoVerQuemReagiu ? (
          <button
            type="button"
            onClick={() => aoVerQuemReagiu(post)}
            className="press flex min-w-0 items-center gap-1.5"
            aria-label={`Ver quem reagiu — ${total}`}
          >
            <span aria-hidden className="flex -space-x-1.5 text-[15px] leading-none">
              {principaisReacoes(post.reacoes).map((t) => (
                <span
                  key={t}
                  className="grid h-[22px] w-[22px] place-items-center rounded-full bg-card ring-1 ring-border/70"
                >
                  {emojiDaReacao(t)}
                </span>
              ))}
            </span>
            <span className="text-[13px] font-semibold tabular-nums underline underline-offset-2">
              {total}
            </span>
          </button>
        ) : total > 0 ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {/* ⚠️ Os emojis que o post DE FATO recebeu, e não um número seco.
                "12 reações" conta a mesma história para doze corações e doze
                risadas, que são notícias diferentes. Régua em
                `principaisReacoes`, testada — inclusive o desempate, que
                precisa ser estável para o post não trocar de cara entre duas
                aberturas. */}
            <span aria-hidden className="flex -space-x-1.5 text-[15px] leading-none">
              {principaisReacoes(post.reacoes).map((t) => (
                <span
                  key={t}
                  className="grid h-[22px] w-[22px] place-items-center rounded-full bg-card ring-1 ring-border/70"
                >
                  {emojiDaReacao(t)}
                </span>
              ))}
            </span>
            <span className="text-[13px] font-semibold tabular-nums">{total}</span>
            <span className="sr-only">{total === 1 ? "reação" : "reações"}</span>
          </span>
        ) : null}
        {/* O marcador fica na PONTA DIREITA, separado das reações pelo vão que
            sobra — é o arranjo deles, e ele diz uma coisa verdadeira: guardar é
            gesto privado (ninguém vê, nem a autora), reagir é gesto social. */}
        {aoSalvar && (
          <button
            type="button"
            onClick={() => aoSalvar(post, !post.salvo)}
            aria-label={post.salvo ? "Tirar dos salvos" : "Salvar"}
            aria-pressed={post.salvo}
            className="press ml-auto leading-none"
          >
            <IconeMarcador cheio={post.salvo} />
          </button>
        )}
      </div>

      {/* ⚠️ UMA FILEIRA QUE ROLA, e não uma grade que quebra em linhas.
          Eram treze pílulas com "emoji + rótulo" em `flex-wrap`: três linhas de
          etiquetas, que leem como formulário. A fileira única é o formato que
          todo mundo já conhece do iMessage e do WhatsApp — e treze alvos de
          44px somam 572px, mais que a largura de um iPhone, então ela rola de
          propósito. O rótulo virou `aria-label`: quem enxerga reconhece o
          emoji, e quem não enxerga continua ouvindo "Que carinho". */}
      {escolhendo && (
        <div className="px-3 pt-2">
          <div
            role="group"
            aria-label="Escolha uma reação"
            className="flex items-center gap-0.5 overflow-x-auto rounded-full border border-border/60 px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              background: "rgba(255,253,252,0.72)",
              backdropFilter: "blur(14px) saturate(170%)",
              WebkitBackdropFilter: "blur(14px) saturate(170%)",
              boxShadow: "0 10px 26px -14px rgba(48,40,60,0.4)",
            }}
          >
            {REACOES.map((r, n) => (
              <button
                key={r.tipo}
                type="button"
                aria-label={r.rotulo}
                aria-pressed={post.minhaReacao === r.tipo}
                onClick={() => {
                  hapticTap();
                  aoReagir(post, post.minhaReacao === r.tipo ? null : r.tipo);
                  setEscolhendo(false);
                }}
                /* A escada é o que faz a barra parecer uma coisa que ABRIU. */
                style={{ ["--dc-atraso" as string]: `${n * 22}ms` }}
                className={`dc-reacao-entra press grid h-11 w-11 shrink-0 place-items-center rounded-full text-[25px] leading-none transition-transform ${
                  post.minhaReacao === r.tipo ? "scale-110 bg-primary/15" : ""
                }`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ⚠️ A ENQUETE vem antes da legenda e depois das ações: é o único
          elemento do post que PEDE alguma coisa de quem lê, e enterrá-la
          embaixo do texto faria a maioria rolar direto. */}
      {post.enquete && (
        <div className="mt-1 space-y-1.5 px-4">
          {post.enquete.opcoes.map((op, i) => {
            const meu = post.enquete!.meuVoto;
            const jaVotou = meu !== null;
            const votos = post.enquete!.votos[i] ?? 0;
            const total = post.enquete!.votos.reduce((a, b) => a + b, 0);
            /* A barra é proporcional; o RÓTULO é número absoluto — "67%" são
               dois votos de três, e numa base pequena a porcentagem transforma
               três pessoas numa maioria. */
            const fatia = total > 0 ? Math.round((votos / total) * 100) : 0;
            return (
              <button
                key={i}
                type="button"
                disabled={jaVotou || !aoVotar}
                onClick={() => {
                  hapticTap();
                  aoVotar?.(post, i);
                }}
                aria-pressed={meu === i}
                /* ⚠️ `rounded-full` e altura de 40px, não um retângulo de
                    borda fina. Empilhadas, três caixas retangulares idênticas
                    leem como formulário — foi o que o dono viu na foto do
                    aparelho ("cara de vibe code"). A pílula é a forma que o
                    resto do app já usa para "toque aqui". */
                className={`press relative block min-h-[40px] w-full overflow-hidden rounded-full border text-left text-[13px] transition-colors ${
                  meu === i
                    ? "border-primary/70 bg-primary/5 font-semibold"
                    : jaVotou
                      ? "border-border/70"
                      : "border-border hover:border-primary/40"
                } disabled:cursor-default`}
              >
                {jaVotou && (
                  /* A barra CRESCE até a fatia (`dc-fatia`, com `scaleX`), e
                     não aparece pronta: é a animação que faz o resultado ser
                     lido como resposta ao toque dela. `scaleX` roda no
                     compositor — animar `width` repintaria a linha a cada
                     quadro. */
                  <span
                    aria-hidden
                    className="dc-fatia absolute inset-y-0 left-0 w-full rounded-full bg-primary/15"
                    style={{ transform: `scaleX(${fatia / 100})` }}
                  />
                )}
                <span className="relative flex items-center gap-2 px-3.5 py-2">
                  <span className="min-w-0 flex-1 truncate">{op}</span>
                  {meu === i && (
                    /* O ✓ na escolhida — sem ele, "a minha" e "a mais votada"
                       viram a mesma pílula quando coincidem. */
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-primary"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  )}
                  {jaVotou && (
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">
                      {fatia}%
                      {/* ⚠️ A PORCENTAGEM e o NÚMERO, os dois. "67%" são dois
                          votos de três, e numa base pequena a porcentagem
                          sozinha transforma três pessoas numa maioria — foi
                          por isso que o rótulo absoluto existia. Tirá-lo para
                          pôr a porcentagem teria trocado um problema por
                          outro; eles vivem juntos. */}
                      <span className="ml-1 font-normal opacity-70">({rotuloDeVotos(votos)})</span>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {post.enquete.meuVoto === null && (
            /* ⚠️ Ela precisa saber ANTES que o voto não se troca — a PK do
               banco garante um por pessoa, e descobrir isso tocando é o tipo de
               surpresa que faz alguém desconfiar do app inteiro. */
            <p className="pt-0.5 text-[11px] text-muted-foreground">
              Toque para votar — o voto não muda depois.
            </p>
          )}
        </div>
      )}

      {/* ⚠️ A PERGUNTA vem ANTES do texto, e citada. Ela é a metade que dá
          sentido à outra: "Sim, foi na 20ª" solto no feed não quer dizer nada,
          e era exatamente isso que o feed mostrava enquanto a coluna existia
          sem leitor. Sem NADA sobre quem perguntou — a caixinha é anônima, e
          continua anônima depois de respondida. */}
      {post.pergunta && (
        <div className="mx-4 mt-2 rounded-xl border-l-2 border-primary/40 bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Perguntaram
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug">{post.pergunta}</p>
        </div>
      )}

      {/* ⚠️ A aula anexada mostra o TEMA, e nunca o dia: o dia gestacional é a
          semana dela disfarçada (D = semana × 7 + diaDaSemana), e publicá-lo
          passaria por cima da chave `mostrar_semana`. Nunca a nota, tampouco —
          seria o placar público que a aba das Amigas gastou um arquivo inteiro
          para não ter. */}
      {post.aula && (
        <div className="mx-4 mt-2 rounded-xl bg-muted/50 px-3 py-2">
          <p className="text-[13px] font-medium leading-snug">
            📚 Fiz a aula de hoje — sobre <span className="font-semibold">{post.aula.tema}</span>
          </p>
        </div>
      )}

      {post.texto && (
        <p className="px-4 pt-1.5 text-[14px] leading-snug">
          <span className="font-semibold">{post.autorNome}</span>
          {post.autorOficial && <SeloOficial />}
          {post.autorPremium && <SeloPremium />}{" "}
          <span className="whitespace-pre-wrap">{post.texto}</span>
        </p>
      )}

      {/* ⚠️ A HORA, embaixo da legenda — é onde o modelo a põe, e ela estava
          faltando em TODO post. Sem ela, uma publicação de três semanas atrás
          lê como notícia de hoje, e aqui as notícias têm data biológica: o
          ultrassom de quem estava com 28 semanas naquela semana é outra frase
          hoje, com 31. */}
      {/* ⚠️ Sem caixa alta: "3 h" virava "3 H" e "18 de agosto de 2026" virava
          um berro de duas linhas. O modelo mudou para minúscula anos atrás, e
          em português a versão em caixa alta lê pior que em inglês. */}
      <p className="px-4 pt-1 text-[11px] text-muted-foreground">
        {/* ⚠️ **QUANTAS VIRAM — só no post DELA, e só o número.** O servidor
            devolve `null` para quem não é a autora, então esta linha não pode
            virar um contador público de audiência nem por engano.

            ⚠️ **E não é botão.** O story abre a lista de quem viu porque some
            em 24h e é uma foto solta; o post é permanente e pode ser um
            desabafo — entregar QUEM leu produz a pergunta "por que a fulana viu
            e não reagiu?", que é a leitura que esta aba não pode induzir.

            ⚠️ Vem ANTES da hora, e não depois: o que ela abre o app para saber
            é se alguém viu; a data ela já sabe. */}
        {post.vistas !== null && (
          <>
            <strong className="font-semibold tabular-nums">{post.vistas}</strong>
            {post.vistas === 1 ? " pessoa viu" : " pessoas viram"}
            {" · "}
          </>
        )}
        {haQuantoPublicou(post.criadoEm, Date.now())}
        {/* ⚠️ O selo existe para quem LÊ, não para quem escreveu: sem ele,
            corrigir o texto vira reescrita silenciosa da história, e quem
            reagiu ao que estava escrito antes não tem como saber que mudou.
            Discreto de propósito — é uma nota de rodapé, não uma acusação. */}
        {post.editadoEm && <span className="opacity-70"> · editado</span>}
      </p>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   A TELA PRINCIPAL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O CARTÃO DA SEMANA — montado sozinho, aos domingos.
 *
 * ⚠️ **Dispensável, e o "já vi" é por DOMINGO** — dispensar o de hoje não pode
 * esconder o da semana que vem.
 *
 * ⚠️ **Mosaico de até quatro fotos**, e a grade se adapta: uma foto ocupa tudo,
 * duas ficam lado a lado, três ou quatro fecham o quadrado. Uma grade fixa de
 * 2×2 com uma foto só deixaria três buracos cinza.
 */
export function CartaoDaSemana({
  retro,
  aoFechar,
}: {
  retro: Retrospectiva;
  aoFechar: () => void;
}) {
  const n = retro.fotos.length;
  return (
    <section
      className="dc-reacao-entra relative -mx-4 mb-2 overflow-hidden border-b border-border bg-gradient-to-b from-primary/8 to-transparent px-4 py-3"
      aria-label="Sua semana"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Sua semana
          </p>
          <p className="mt-0.5 text-[14px] leading-snug">{fraseDaRetrospectiva(retro)}</p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Dispensar o resumo da semana"
          className="press -mr-1 shrink-0 px-1.5 text-[18px] leading-none text-muted-foreground"
        >
          ×
        </button>
      </div>

      {n > 0 && (
        <div
          className={`mt-2.5 grid gap-1 overflow-hidden rounded-2xl ${
            n === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {retro.fotos.map((u, i) => (
            <img
              key={i}
              src={u}
              alt=""
              loading="lazy"
              className={`w-full object-cover ${
                n === 1
                  ? "aspect-[4/3]"
                  : n === 3 && i === 0
                    ? "row-span-2 h-full"
                    : "aspect-square"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TelaPrincipal({
  posts,
  stories = [],
  sugestoes = [],
  pessoas = [],
  aoSeguirPessoa,
  aoReagir,
  aoSalvar,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoTirarMarcacao,
  aoEditar,
  aoVerQuemReagiu,
  retro,
  aoFecharRetro,
  aoAbrirPerfil,
  aoVer,
  aoTocarStory,
  aoChegarNoFim,
  temMais = false,
  desafio,
  live,
  mesmaFase = false,
  aoTrocarFase,
  aoEntrarNoDesafio,
  aoIrParaOJogo,
  convite,
  lembreteEntao,
  aoCompararAgora,
  aoDispensarEntao,
}: {
  posts: PostNaTela[];
  stories?: Story[];
  /**
   * A ZONA DE SUGESTÕES — publicações de quem ela NÃO segue.
   *
   * ⚠️ Lista própria, e não ids misturados na de cima. É o que garante que
   * estranhas nunca apareçam no meio das pessoas que ela escolheu: elas entram
   * DEPOIS do aviso de "você está em dia", que é o modelo do Instagram e é o
   * único arranjo em que "sugerido" significa alguma coisa.
   */
  sugestoes?: PostNaTela[];
  /** Pessoas sugeridas, a fileira do modelo. */
  pessoas?: PessoaNaLista[];
  /**
   * O convite pelo WhatsApp — `null` quando não há código (ou no luto).
   *
   * ⚠️ **É PROP, e não uma consulta daqui.** O código de indicação já é
   * carregado uma vez por `RedeNoApp`; buscar de novo nesta lista seria uma
   * segunda ida ao servidor por pintura do feed.
   */
  convite?: { codigo: string | null } | null;
  /**
   * O lembrete do "então e agora" — `null` quando não há.
   *
   * ⚠️ Quem DECIDE é `lembreteDoEntao` (pura, com o portão do Modo Cuidado
   * dentro); esta tela só desenha o que recebeu.
   */
  lembreteEntao?: { id: string; imagemUrl: string; criadoEm: string } | null;
  aoCompararAgora?: () => void;
  aoDispensarEntao?: () => void;
  aoSeguirPessoa?: (id: string) => void;
  aoReagir: (post: PostNaTela, t: TipoDeReacao | null) => void;
  aoSalvar?: (post: PostNaTela, salvar: boolean) => void;
  aoApagar?: (post: PostNaTela) => void;
  /** Denunciar o post de outra pessoa. Ver `PostInstagram`. */
  aoDenunciar?: (post: PostNaTela, motivo: MotivoDaDenuncia) => void;
  aoVotar?: (post: PostNaTela, opcao: number) => void;
  /** Tirar a PRÓPRIA marcação — ver `PostInstagram`. */
  aoTirarMarcacao?: (post: PostNaTela) => void;
  /** Salvar a legenda editada — ver `PostInstagram`. */
  aoEditar?: (post: PostNaTela, texto: string) => Promise<boolean>;
  /** Ver quem reagiu. Só no post DELA. */
  aoVerQuemReagiu?: (post: PostNaTela) => void;
  /** O resumo da semana, ou `null`. Ver `CartaoDaSemana`. */
  retro?: Retrospectiva | null;
  aoFecharRetro?: () => void;
  aoAbrirPerfil?: (id: string) => void;
  /**
   * Toque numa bolinha da fileira. Recebe o id do AUTOR, não do story.
   *
   * ⚠️ As outras ações desta tela (publicar, buscar, atividade, perfil, as
   * seções da Comunidade) NÃO são props daqui: elas viraram as bolinhas da
   * barra de baixo, publicadas por `RedeNoApp`. Foi assim que o primeiro
   * elemento da aba passou a ser a fileira de stories.
   */
  aoTocarStory?: (autorId: string) => void;
  /**
   * O fim da lista apareceu — hora de buscar as mais antigas.
   *
   * ⚠️ Quem se protege de chamar duas vezes é QUEM RECEBE: a sentinela pode
   * entrar e sair da tela num tranco de rolagem, e o observador dispara nas
   * duas vezes. A trava mora no contêiner, que é quem sabe se já há um pedido
   * no ar.
   */
  /** O cartão entrou na tela. Referência estável — ver `PostInstagram`. */
  aoVer?: (id: string) => void;
  /** A próxima live do médico dela — ver `proxima-live.ts`. `null` é o normal. */
  live?: LiveNoTopo | null;
  /** O recorte por fase nas sugeridas — ver `fase-parecida.ts`. */
  mesmaFase?: boolean;
  aoTrocarFase?: (v: boolean) => void;
  aoChegarNoFim?: () => void;
  /** Ainda há página seguinte. Sem isso a sentinela ficaria armada para sempre. */
  temMais?: boolean;
  /** O desafio da semana da criadora que a trouxe, se houver. */
  desafio?: DesafioNaTela | null;
  aoEntrarNoDesafio?: (entrar: boolean) => void;
  /** Leva ao Caminho, onde a atividade acontece. */
  aoIrParaOJogo?: () => void;
}) {
  const fim = useRef<HTMLDivElement>(null);

  /* ⚠️ A sentinela é um `IntersectionObserver`, e não um ouvinte de `scroll`:
     a aba vive dentro de `minha-conta`, e quem rola pode ser a janela ou um
     contêiner interno — um ouvinte de `scroll` precisaria saber qual, e erraria
     no dia em que o invólucro mudasse. O observador não precisa saber. */
  useEffect(() => {
    const alvo = fim.current;
    if (!alvo || !aoChegarNoFim || !temMais) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) aoChegarNoFim();
      },
      /* Uma tela de antecedência: a página seguinte chega antes de ela bater no
         fundo, que é o que faz a rolagem parecer infinita em vez de emendada. */
      { rootMargin: "600px" },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [aoChegarNoFim, temMais, posts.length]);

  return (
    <div className="px-4">
      {/* ⚠️ **NÃO HÁ CABEÇALHO AQUI, e a falta dele é o recurso.**
          Pedido do dono, com a foto do aparelho: "toda essa parte de cima deve
          sumir, não precisamos que cada aba ocupe esse espaço que é precioso…
          o primeiro elemento da aba será os stories, assim como no Instagram".

          Havia DUAS barras empilhadas antes desta linha — a do app (‹ Feed ⚙
          Sair) e a desta tela (Comunidade 🔍 ♡ ＋ ⊞) —, e as duas juntas
          comiam a primeira dobra inteira de um iPhone. As ações não sumiram:
          viraram as bolinhas que sobem ao tocar de novo no ícone da Comunidade
          na barra de baixo (`publicarAtalhos`, em `RedeNoApp`). */}
      {desafio && (
        <CartaoDoDesafio
          desafio={desafio}
          aoEntrar={aoEntrarNoDesafio}
          aoIrParaOJogo={aoIrParaOJogo}
        />
      )}

      <FileiraDeStories stories={stories} aoTocar={aoTocarStory} />

      {/* ⚠️ **A PRÓXIMA LIVE, e ela vem DEPOIS dos stories.** Acima deles
          empurraria a fileira para fora da primeira dobra — o arranjo exato que
          o dono pediu para corrigir ("o primeiro elemento da aba será os
          stories"). E antes do primeiro post, porque um aviso com hora marcada
          embaixo de cinco publicações é um aviso que chega depois da hora.

          A régua (qual live, e se aparece) está em `proxima-live.ts`; aqui só
          se desenha. */}
      {live && <CartaoDaLive live={live} />}

      {/* ⚠️ DEPOIS dos stories e ANTES do primeiro post. Acima dos stories ele
          empurraria a fileira para fora da primeira dobra — que é justamente o
          arranjo que o dono pediu para corrigir ("o primeiro elemento da aba
          será os stories"). */}
      {retro && aoFecharRetro && <CartaoDaSemana retro={retro} aoFechar={aoFecharRetro} />}

      {/* ⚠️ **UM CARTÃO DE CADA VEZ.** A retrospectiva de domingo e o lembrete
          podem cair no mesmo dia, e dois cartões empilhados entre os stories e
          o primeiro post empurram o feed inteiro para fora da dobra — que é
          exatamente o arranjo que o dono pediu para corrigir. A retrospectiva
          ganha: ela só existe aos domingos, e o lembrete volta na semana
          seguinte por conta própria. */}
      {!retro && lembreteEntao && aoCompararAgora && aoDispensarEntao && (
        <CartaoDoEntaoEAgora
          foto={lembreteEntao.imagemUrl}
          criadoEm={lembreteEntao.criadoEm}
          aoComparar={aoCompararAgora}
          aoDispensar={aoDispensarEntao}
        />
      )}

      {posts.length === 0 && sugestoes.length === 0 && pessoas.length === 0 ? (
        <>
          <p className="pb-4 pt-12 text-center text-sm text-muted-foreground">
            Ainda não há nada por aqui 💛
          </p>
          {/* ⚠️ **O CONVITE MORA NO VAZIO, e é aqui que ele vale.** Uma paciente
              que abre a Comunidade e não vê nada tem duas saídas: seguir
              alguém que ela não conhece, ou trazer quem ela conhece. A segunda
              é a que faz a aba existir para ela — e é a que traz gente nova
              para o app. O mesmo cartão fecha o feed lá embaixo. */}
          {convite && <ConvidarPeloWhatsApp codigo={convite.codigo} />}
        </>
      ) : (
        posts.map((p) => (
          <PostInstagram
            key={p.id}
            post={p}
            /* ⚠️ AS MESMAS REFERÊNCIAS PARA TODOS OS CARTÕES — nunca um fecho
               por post. É isto que faz o `memo` do cartão valer alguma coisa;
               com `(t) => aoReagir(p, t)` as props mudam a cada pintura e o
               `memo` nunca acerta. O portão de quem pode apagar/denunciar
               mudou-se para DENTRO do cartão, que já tem `post.souAAutora`. */
            aoReagir={aoReagir}
            aoSalvar={aoSalvar}
            aoApagar={aoApagar}
            aoDenunciar={aoDenunciar}
            aoVotar={aoVotar}
            aoTirarMarcacao={aoTirarMarcacao}
            aoEditar={aoEditar}
            aoVerQuemReagiu={aoVerQuemReagiu}
            aoAbrirPerfil={aoAbrirPerfil}
            aoVer={aoVer}
          />
        ))
      )}

      {temMais && (
        <div ref={fim} className="py-6">
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      )}

      {/* ─── A ZONA DE SUGESTÕES ────────────────────────────────────────────
          ⚠️ Ela só abre quando o feed de quem ela segue ACABOU (`!temMais`).
          Este é o arranjo do "você está em dia" do Instagram, e aqui ele não é
          estética: interlaçar desconhecidas no meio das pessoas que ela
          escolheu, num app de gestação de alto risco, faz a paciente ler um
          relato duro sem saber se veio de uma amiga ou de uma estranha. Com o
          aviso no meio, tudo que está abaixo dele tem procedência. */}
      {/* ⚠️ `mesmaFase` entra nas DUAS condições, e isso não é detalhe: com o
          filtro ligado e ninguém correspondendo, `pessoas` fica vazia — e sem
          esta cláusula a fileira INTEIRA sumia, levando junto o interruptor que
          a desligaria. Beco sem saída, exatamente o que a aba de assinatura já
          pagou uma vez. */}
      {!temMais && (pessoas.length > 0 || sugestoes.length > 0 || mesmaFase) && (
        <>
          {posts.length > 0 && <EmDia />}

          {(pessoas.length > 0 || mesmaFase) && (
            <FileiraDePessoas
              pessoas={pessoas}
              aoSeguir={aoSeguirPessoa}
              aoAbrirPerfil={aoAbrirPerfil}
              mesmaFase={mesmaFase}
              aoTrocarFase={aoTrocarFase}
            />
          )}

          {sugestoes.length > 0 && (
            <>
              <h2 className="px-0 pb-1 pt-4 text-[14px] font-semibold">Publicações sugeridas</h2>
              {sugestoes.map((p) => (
                <PostInstagram
                  key={p.id}
                  post={p}
                  /* O rótulo é OBRIGATÓRIO — ver `PostInstagram`. */
                  sugerido
                  aoReagir={aoReagir}
                  aoSalvar={aoSalvar}
                  aoVotar={aoVotar}
                  aoTirarMarcacao={aoTirarMarcacao}
                  aoEditar={aoEditar}
                  /* ⚠️ **E ISTO FALTAVA, justamente aqui.** Esta zona é o ÚNICO
                     lugar do app onde aparece publicação de quem ela não
                     escolheu seguir — e era o único sem o ⋯ de denunciar. O
                     post de estranha é exatamente o que a diretriz 1.2 exige
                     que se possa denunciar, e o feed de quem ela segue, que é o
                     caso menos provável, tinha o botão. */
                  aoDenunciar={aoDenunciar}
                  aoVerQuemReagiu={aoVerQuemReagiu}
                  aoAbrirPerfil={aoAbrirPerfil}
                />
              ))}
            </>
          )}

          {/* ⚠️ **E O CONVITE FECHA O FEED.** Quem chegou até aqui viu tudo que
              a rede dela tem — é o instante em que "trazer mais alguém"
              responde à falta que ela acabou de sentir, e não uma interrupção
              no meio da leitura. */}
          {convite && <ConvidarPeloWhatsApp codigo={convite.codigo} />}
        </>
      )}
    </div>
  );
}

/**
 * O LEMBRETE DO "ENTÃO E AGORA".
 *
 * ⚠️ **Ele existe porque o recurso estava escondido.** A escolha da foto antiga
 * vive atrás do botão de comparar, DENTRO da tela de publicar: quem não souber
 * que ele existe nunca esbarra nele. Este cartão é o único lugar em que o app
 * diz que aquela foto de quatro semanas atrás pode virar alguma coisa.
 *
 * ⚠️ **Ele MOSTRA a foto, e é isso que o faz funcionar.** "Que tal um então e
 * agora?" em texto é mais uma frase; a barriga dela de quatro semanas atrás na
 * tela é a coisa inteira, e responde sozinha se vale a pena.
 *
 * ⚠️ **E ele NÃO diz a semana daquela foto.** A semana pública tem chave
 * própria (`mostrar_semana`), e este cartão é privado — só ela o vê —, mas
 * escrever o número aqui criaria uma segunda régua para "que semana era",
 * ao lado de `carimboDaComparacao`, que é quem responde isso na publicação. O
 * tempo em dias/semanas corridas não é dado clínico e basta para decidir.
 */
function CartaoDoEntaoEAgora({
  foto,
  criadoEm,
  aoComparar,
  aoDispensar,
}: {
  foto: string;
  criadoEm: string;
  aoComparar: () => void;
  aoDispensar: () => void;
}) {
  const dias = Math.floor((Date.now() - Date.parse(criadoEm)) / 86_400_000);
  const semanas = Math.floor(dias / 7);
  const quando =
    semanas >= 1 ? `${semanas} ${semanas === 1 ? "semana" : "semanas"}` : `${dias} dias`;

  return (
    <div className="my-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
      <img
        src={foto}
        alt=""
        className="h-16 w-16 shrink-0 rounded-xl object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug">Faz {quando} desde esta foto</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          Dá para pôr as duas lado a lado.
        </p>
        <button
          type="button"
          onClick={aoComparar}
          /* ⚠️ 44px medidos, e não 36: a primeira versão saiu com 188×36 e
             37×40, os dois abaixo do mínimo do projeto. Medido no navegador,
             não estimado. */
          className="press mt-2 min-h-[44px] rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          Fazer o então e agora
        </button>
      </div>
      {/* ⚠️ Alvo de 44px: é o botão de recusar, e recusar tem de ser tão fácil
          quanto aceitar — senão o cartão vira armadilha. */}
      <button
        type="button"
        onClick={aoDispensar}
        aria-label="Dispensar"
        className="press -mr-1 flex min-h-[44px] min-w-[44px] shrink-0 items-start justify-center self-start pt-2 text-base leading-none text-muted-foreground"
      >
        ×
      </button>
    </div>
  );
}

/**
 * CONVIDAR PELO WHATSAPP — com o link de indicação dentro.
 *
 * ⚠️ **O LINK CARREGA O CÓDIGO, e é isso que separa este botão do defeito que
 * `indicacao.ts` existe para não deixar voltar.** A aba das Amigas já teve um
 * "Convidar" que mandava `/auth` puro: a amiga criava a conta e nunca virava
 * amiga dela — não aparecia na lista, não dava para formar dupla, e as 100 🌱
 * não eram pagas a ninguém. Aqui é a MESMA `linkDeIndicacao`, e por isso o
 * convite da Comunidade paga a indicação como o das Amigas.
 *
 * ⚠️ **SEM CÓDIGO, O CARTÃO NÃO APARECE.** Um convite sem indicação é
 * indistinguível de um bom para quem manda e para quem recebe; só o vínculo
 * não acontece, semanas depois, sem nada a que apontar. E ela só tem a atenção
 * da amiga uma vez.
 *
 * ⚠️ **NADA DISTO EM MODO CUIDADO** (o portão está em `RedeNoApp`, que é quem
 * monta o `convite`). A mensagem é escrita na primeira pessoa e diz "na minha
 * gestação": mandá-la é uma afirmação que ela pode não querer mais fazer, e o
 * app não põe essas palavras na boca de quem acabou de perder a gestação.
 */
function ConvidarPeloWhatsApp({ codigo }: { codigo: string | null }) {
  if (!codigo) return null;

  /* ⚠️ **O DOMÍNIO DE PRODUÇÃO, e nunca `location.origin`.** Duas razões, e a
     primeira apareceu como aviso do React na primeira foto desta tela: o
     servidor renderiza sem `window` e o cliente com ele, então o `href` nascia
     diferente dos dois lados e a hidratação reclamava. A segunda é pior — em
     `/preview-*` e em qualquer deploy de preview o link sairia apontando para
     um endereço que a amiga não consegue abrir, e o convite dela morreria sem
     ninguém entender por quê. */
  const link = linkDeIndicacao(codigo, SITE);
  if (!link) return null;
  const texto = mensagemDeConvite(link);

  return (
    <div className="my-6 rounded-3xl border border-border bg-card p-5 text-center shadow-[var(--shadow-card)]">
      <p className="text-[15px] font-semibold">Chame quem já está com você</p>
      <p className="mx-auto mt-1 max-w-[30ch] text-[13px] leading-snug text-muted-foreground">
        Sua irmã, a amiga do trabalho, a prima que está grávida junto. Quem entra pelo seu link já
        chega ligada a você.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {/* ⚠️ `<a>` e não `window.open`: num PWA instalado o `open` abre uma
            visão que toma a tela inteira e não tem botão de voltar — o defeito
            que a Central de Emergência pagou. O link normal deixa o sistema
            decidir, e é ele que abre o aplicativo do WhatsApp. */}
        <a
          href={linkDoWhatsApp(texto)}
          target="_blank"
          rel="noopener noreferrer"
          className="press flex min-h-[44px] items-center justify-center rounded-full bg-[#25D366] px-4 text-[15px] font-semibold text-white"
        >
          Convidar pelo WhatsApp
        </a>
        <button
          type="button"
          onClick={async () => {
            /* ⚠️ O TEXTO INTEIRO, e não só a URL: colado em qualquer lugar, um
               "https://…" sozinho não diz de quem veio nem o que é — e é aí
               que a amiga decide se abre. Mesma decisão da aba das Amigas. */
            const { toast } = await import("sonner");
            try {
              await navigator.clipboard.writeText(texto);
              toast.success("Convite copiado 💌");
            } catch {
              /* ⚠️ Copiar recusa em contexto inseguro e com permissão negada, e
                 os dois chegam aqui — dizer nada faria o botão parecer morto. */
              toast.error("Não deu para copiar. Tente pelo WhatsApp.");
            }
          }}
          className="press min-h-[44px] rounded-full border border-border px-4 text-[14px] font-medium"
        >
          Copiar o convite
        </button>
      </div>
    </div>
  );
}

/**
 * "Você está em dia" — o divisor do modelo.
 *
 * Ele responde à pergunta que a paciente faria ao ver uma desconhecida no feed
 * ("de onde veio isso?") ANTES de ela fazer a pergunta.
 */
function EmDia() {
  return (
    <div className="flex flex-col items-center gap-1.5 border-b border-border py-8 text-center">
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-foreground/70 text-xl"
      >
        ✓
      </span>
      <p className="text-[15px] font-semibold">Você está em dia</p>
      <p className="max-w-[16rem] text-[13px] leading-snug text-muted-foreground">
        Você viu tudo de quem acompanha. Daqui para baixo são pessoas que você ainda não segue.
      </p>
    </div>
  );
}

/**
 * A fileira de pessoas sugeridas.
 *
 * ⚠️ **Nenhum cartão diz POR QUE aquela pessoa está ali.** O modelo escreve
 * "seguida por fulana e mais 3", e aqui isso entregaria quem ela segue a quem
 * só abriu o feed — a lista de seguidores deste app não é pública de propósito.
 * O motivo ordena a fileira e fica no servidor.
 */
function FileiraDePessoas({
  pessoas,
  aoSeguir,
  aoAbrirPerfil,
  mesmaFase = false,
  aoTrocarFase,
}: {
  pessoas: PessoaNaLista[];
  aoSeguir?: (id: string) => void;
  aoAbrirPerfil?: (id: string) => void;
  /** O recorte por fase está ligado? Ver `fase-parecida.ts`. */
  mesmaFase?: boolean;
  /** Sem ele o interruptor não aparece — nunca um botão que não faz nada. */
  aoTrocarFase?: (v: boolean) => void;
}) {
  /* Quem ela acabou de seguir. ⚠️ O cartão NÃO some: sumir no toque tira da
     tela a única confirmação de que o toque funcionou, e ela toca de novo. */
  const [seguidas, setSeguidas] = useState<Set<string>>(new Set());

  return (
    <section className="border-b border-border py-4">
      <h2 className="pb-2 text-[14px] font-semibold">Sugestões para você</h2>

      {/* ⚠️ **O RÓTULO FALA DA FASE DELA, nunca das outras.** "Gestantes do 3º
          trimestre" anunciaria, para quem lesse a tela por cima do ombro dela,
          em que trimestre ela está — e `mostrar_semana` existe exatamente para
          essa decisão ser dela. "Parecida com a sua" diz a mesma coisa e não
          conta nada de ninguém.

          ⚠️ E NINGUÉM É ROTULADO na fileira: a fase recorta o que ela vê, e não
          aparece em cartão nenhum. É a diferença entre um recorte e um GRUPO. */}
      {aoTrocarFase && (
        <button
          type="button"
          role="switch"
          aria-checked={mesmaFase}
          onClick={() => aoTrocarFase(!mesmaFase)}
          className="press mb-3 flex w-full items-center gap-2.5 rounded-full border border-border px-3 py-2 text-left"
        >
          <span
            aria-hidden
            className={`h-5 w-9 shrink-0 rounded-full transition-colors ${
              mesmaFase ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                mesmaFase ? "translate-x-[18px] translate-y-0.5" : "translate-x-0.5 translate-y-0.5"
              }`}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px]">{ROTULO_DO_FILTRO}</span>
        </button>
      )}

      {/* ⚠️ Ligado e sem ninguém é um resultado LEGÍTIMO, e o vazio EXPLICA a
          régua — como o vazio da busca. Cair de volta na lista completa faria o
          interruptor parecer quebrado e entregaria justamente quem ela pediu
          para não ver. */}
      {mesmaFase && pessoas.length === 0 && (
        <p className="pb-2 text-[12.5px] leading-snug text-muted-foreground">{VAZIO_DO_FILTRO}</p>
      )}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pessoas.map((p) => {
          const jaSegue = seguidas.has(p.id);
          return (
            <div
              key={p.id}
              className="flex w-[148px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-border p-3"
            >
              <button type="button" onClick={() => aoAbrirPerfil?.(p.id)} className="press">
                <Foto url={p.avatarUrl} nome={p.nome} lado={64} />
              </button>
              <p className="line-clamp-2 text-center text-[13px] font-semibold leading-tight">
                {p.nome}
                {/* ⚠️ **DESENHADO, e não o emoji ✅.** Ele sai verde no Android,
                    azul no iOS e como caixinha em parte dos aparelhos antigos —
                    e este é o selo que diz "esta conta é do consultório". Mesma
                    lição do 📞 preto no iOS. */}
                {p.oficial && <SeloOficial />}
                {p.premium && <SeloPremium />}
              </p>
              {p.bio && (
                <p className="line-clamp-1 w-full text-center text-[11px] leading-tight text-muted-foreground">
                  {p.bio}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setSeguidas((s) => new Set(s).add(p.id));
                  aoSeguir?.(p.id);
                }}
                disabled={jaSegue}
                /* ⚠️ `mt-auto` alinha os botões pelo PÉ do cartão. Os cartões
                   já têm a mesma altura (o `flex` estica), mas quem tem bio e
                   nome de duas linhas empurrava o botão para baixo do da
                   vizinha — uma fileira de botões em degrau. */
                className={`press mt-auto w-full rounded-lg py-1.5 text-[13px] font-semibold ${
                  jaSegue ? "border border-border" : "bg-primary text-primary-foreground"
                }`}
              >
                {jaSegue ? "Seguindo" : "Seguir"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-[15px] font-semibold tabular-nums leading-tight">{valor}</span>
      <span className="text-[12px] leading-tight text-muted-foreground">{rotulo}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A CAIXINHA — o lado de quem PERGUNTA
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O campo que vive no perfil de quem abriu a caixa.
 *
 * ⚠️ **Três estados, e o terceiro não é um aviso — é uma porta.** Bandeira
 * vermelha não devolve "não posso responder isso": devolve o botão do SOS, que
 * avisa o médico e o contato de emergência dela com localização. Uma tela que
 * apenas recusasse deixaria quem escreveu "estou sangrando" sozinha, olhando um
 * texto de erro.
 */
export function CaixinhaNoPerfil({
  nome,
  aoPerguntar,
  aoAbrirSOS,
  inerte = false,
}: {
  nome: string;
  aoPerguntar?: (texto: string) => Promise<DesfechoDaPergunta | null>;
  aoAbrirSOS?: () => void;
  inerte?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [desfecho, setDesfecho] = useState<DesfechoDaPergunta | null>(null);

  const primeiroNome = nome.trim().split(/\s+/)[0] || nome;

  if (!aberta) {
    return (
      <button
        type="button"
        onClick={() => !inerte && setAberta(true)}
        className="press mt-2 w-full rounded-lg border border-border py-1.5 text-[14px] font-medium"
      >
        💬 Mandar uma pergunta
      </button>
    );
  }

  if (desfecho) {
    return (
      <div className="mt-2 rounded-xl bg-muted/50 p-3">
        <p className="text-[13px] leading-snug">{recadoDoDesfecho(desfecho)}</p>
        {desfecho === "emergencia" && aoAbrirSOS && (
          <button
            type="button"
            onClick={aoAbrirSOS}
            className="press mt-2.5 w-full rounded-xl bg-destructive py-2 text-[14px] font-semibold text-destructive-foreground"
          >
            Abrir a Central de Emergência
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setDesfecho(null);
            setTexto("");
            setAberta(false);
          }}
          className="press mt-2 w-full rounded-xl border border-border py-1.5 text-[13px]"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-muted/50 p-3">
      <label htmlFor="dc-pergunta" className="text-[13px] font-semibold">
        Perguntar para {primeiroNome}
      </label>
      {/* ⚠️ A tela DIZ que é anônima, e diz também o limite. As duas frases
          existem por razões opostas: sem a primeira ninguém pergunta, e sem a
          segunda a caixinha vira o lugar onde se pede conduta médica a uma
          leiga — que é o que fechou os comentários deste app. */}
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Ela não vê quem perguntou. Para dúvidas do seu corpo, quem responde é o seu médico — mande
        por aqui mesmo que eu levo até ele.
      </p>
      <textarea
        id="dc-pergunta"
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DA_PERGUNTA))}
        rows={3}
        placeholder="Sua pergunta…"
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background p-2 text-[14px]"
      />
      <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
        {texto.length}/{LIMITE_DA_PERGUNTA}
      </div>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAberta(false);
            setTexto("");
          }}
          className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
        >
          Agora não
        </button>
        <button
          type="button"
          disabled={!texto.trim() || enviando || inerte || !aoPerguntar}
          onClick={async () => {
            if (!aoPerguntar) return;
            setEnviando(true);
            const d = await aoPerguntar(texto.trim());
            setEnviando(false);
            /* `null` é falha de envio: o `toast` do chamador já contou, e
               manter o texto no campo é o que permite tentar de novo sem
               reescrever. */
            if (d) setDesfecho(d);
          }}
          className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

/**
 * ⚠️ A TELA DE ESPERA DO PERFIL — o conserto da lentidão que o dono relatou.
 *
 * Antes, `onde.t === "perfil"` com `perfil` ainda nulo não casava com ramo
 * nenhum e a árvore caía de volta no FEED. Do lado de quem usa: toca no avatar,
 * a tela não muda, e vários segundos depois salta para o perfil. Isso não lê
 * como "carregando" — lê como "travou", e a reação natural é tocar de novo, o
 * que dispara outra busca e piora o que já estava ruim.
 *
 * ⚠️ **O cabeçalho mostra SÓ nome, foto e selo** — os três que já estavam
 * desenhados no cartão em que ela tocou. Semana, bebê, bio, contadores e
 * publicações ficam de fora até o servidor responder, porque quem decide o que
 * aparece num perfil é `verPerfil`, cruzando Modo Cuidado, bloqueio nos dois
 * sentidos e a camada de cada post. Um esboço que mostrasse mais seria uma
 * segunda régua de visibilidade. Ver `src/lib/esboco-de-perfil.ts`.
 *
 * ⚠️ **Componente exportado, e não JSX solto dentro do ramo.** Sem isso a
 * bancada não alcança esta tela — e uma tela de espera que só existe por meio
 * segundo é justamente a que ninguém consegue parar para olhar.
 */
/**
 * O que a Comunidade guarda para a próxima volta à aba.
 *
 * ⚠️ **Só o que a primeira dobra precisa.** Salvos, gaveta, sugeridos, grade do
 * perfil e caixinha ficam de fora: eles são buscados quando ela abre cada um, e
 * guardá-los aqui encheria a memória com telas que ela talvez nem visite.
 */
type CacheDoFeed = {
  posts: PostNaTela[];
  proximo: string | null;
  bolhas: BolhaDeStory[];
  avisos: AtividadeNaTela[];
  naoVistas: number;
  euId: string | null;
  meuAvatar: string | null;
  semanaDoCarimbo: string | null;
};

/** Uma chave só: `limparCacheDoFeed()` no logout apaga tudo de qualquer forma. */
const CHAVE_DO_FEED = "comunidade:feed";

/**
 * A chave do perfil de UMA pessoa.
 *
 * ⚠️ Por id, e não uma chave só: guardar "o último perfil aberto" faria a
 * segunda abertura pintar o perfil de OUTRA pessoa por um instante — o mesmo
 * defeito que a bolinha "Seu story" teve quando lia `perfil` em vez de
 * `meuAvatar`.
 */
const chaveDoPerfil = (id: string) => `comunidade:perfil:${id}`;

export function PerfilCarregando({
  esboco,
  aoVoltar,
}: {
  esboco: EsbocoDePerfil | null;
  aoVoltar?: () => void;
}) {
  return (
    <div className="pb-24">
      <header className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 flex h-10 w-10 items-center justify-center rounded-full"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="truncate font-semibold">{esboco?.nome ?? "Perfil"}</p>
        {esboco?.oficial && <SeloOficial />}
      </header>

      <div className="flex items-center gap-4 px-4">
        {esboco?.avatarUrl ? (
          <img
            src={esboco.avatarUrl}
            alt=""
            width={86}
            height={86}
            className="h-[86px] w-[86px] shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="dc-esqueleto h-[86px] w-[86px] shrink-0 rounded-full" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="dc-esqueleto h-4 w-2/3 rounded" />
          <div className="dc-esqueleto h-4 w-1/3 rounded" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-0.5 px-0.5">
        {Array.from({ length: QUADRADOS_DO_ESQUELETO }, (_, i) => (
          <div key={i} className="dc-esqueleto aspect-[3/4] w-full" />
        ))}
      </div>
      <p className="sr-only" role="status">
        Carregando o perfil
      </p>
    </div>
  );
}

export function TelaDePerfil({
  perfil,
  posts,
  aoSeguir,
  aoVoltar,
  aoAbrirPost,
  aoChegarNoFim,
  temMais = false,
  aoAbrirLista,
  aoAbrirSalvos,
  aoBloquear,
  aoDenunciarPerfil,
  aoSilenciar,
  aoAbrirEspelho,
  aoAplicarCodigo,
  aoPerguntar,
  aoAbrirSOS,
  somenteLeitura = false,
}: {
  perfil: PerfilNaTela;
  posts: PostNaTela[];
  aoSeguir?: () => void;
  aoVoltar?: () => void;
  aoAbrirPost?: (id: string) => void;
  /** Pede a próxima página da grade deste perfil. */
  aoChegarNoFim?: () => void;
  /** Ainda há página seguinte — ver a sentinela. */
  temMais?: boolean;
  /**
   * Tocar nos números abre a lista.
   *
   * ⚠️ `undefined` para perfil de terceiro, e isso é o portão: no Instagram
   * qualquer um abre a lista de seguidores de um perfil público. Aqui não — a
   * lista de quem acompanha uma gestante de alto risco é o CÍRCULO SOCIAL
   * dela, e expô-la entrega de quem ela é próxima a quem só quis olhar um
   * perfil. Só a dona abre as duas listas dela.
   */
  aoAbrirLista?: (tipo: "seguidores" | "seguindo") => void;
  /** Só no próprio perfil — a coleção é privada e não existe a de ninguém. */
  aoAbrirSalvos?: () => void;
  /** Só no perfil de terceiro. */
  aoBloquear?: () => void;
  /** Denunciar ESTE perfil para a plataforma. Ver `EscolherMotivo`. */
  aoDenunciarPerfil?: (motivo: MotivoDaDenuncia) => void;
  /** Silenciar (ou voltar a ouvir). O estado atual vem em `perfil.silenciado`. */
  aoSilenciar?: (silenciar: boolean) => void;
  /** Abre "ver como os outros veem". Só no próprio perfil. */
  aoAbrirEspelho?: () => void;
  /** Aplica o código de embaixadora deste perfil. Irreversível — ver a tela. */
  aoAplicarCodigo?: (codigo: string) => void;
  /**
   * Manda uma pergunta para a caixinha dela. Devolve o desfecho da triagem, ou
   * `null` quando não deu para enviar.
   *
   * ⚠️ **Quem tria é o SERVIDOR**, e a tela só desenha o que ele respondeu. Uma
   * segunda régua aqui diria "mandei para o seu médico" sobre um texto que o
   * servidor publicou — ou pior, publicaria um que ele teria roteado.
   */
  aoPerguntar?: (texto: string) => Promise<DesfechoDaPergunta | null>;
  /** A Central de Emergência, para quando a triagem achar bandeira vermelha. */
  aoAbrirSOS?: () => void;
  /**
   * O ESPELHO: a tela desenha, e nada nela age.
   *
   * ⚠️ **O desligamento é feito AQUI, num lugar só, e não pelo chamador.** A
   * prévia tem hoje cinco controles (seguir, abrir post, abrir lista, salvos,
   * bloquear); o sexto que alguém acrescentar amanhã nasce LIGADO se quem
   * desliga for o chamador — e um dos previstos, o "aplicar código de
   * embaixadora", grava um campo que nunca é reescrito. Um toque numa tela que
   * o app apresenta como inerte queimaria a indicação da médica dela, sem erro
   * e sem volta.
   */
  somenteLeitura?: boolean;
}) {
  const [aba, setAba] = useState<AbaDoPerfil>("grade");
  const [confirmandoBloqueio, setConfirmandoBloqueio] = useState(false);
  const [denunciandoPerfil, setDenunciandoPerfil] = useState(false);
  const [confirmandoCodigo, setConfirmandoCodigo] = useState(false);

  /* A trava do espelho: toda ação vira `undefined` de uma vez. */
  const agir = <T,>(f: T | undefined): T | undefined => (somenteLeitura ? undefined : f);
  const seguir = agir(aoSeguir);
  const abrirPost = agir(aoAbrirPost);
  const abrirLista = agir(aoAbrirLista);
  const abrirSalvos = agir(aoAbrirSalvos);
  const bloquear = agir(aoBloquear);
  const perguntar = agir(aoPerguntar);

  /* Só os POSTS aparecem na grade; o "Do bebê" é a aba própria. */
  const naGrade = aba === "grade" ? posts : [];

  const rotuloDoBotao = perfil.souEu
    ? "Editar perfil"
    : perfil.meuVinculo === "ativo"
      ? "Seguindo"
      : perfil.meuVinculo === "pendente"
        ? "Pedido enviado"
        : perfil.publico
          ? "Seguir"
          : "Pedir para seguir";

  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        {aoVoltar && (
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Voltar"
            className="press -ml-1 text-xl leading-none"
          >
            ‹
          </button>
        )}
        <h1 className="flex min-w-0 flex-1 items-center text-[16px] font-semibold">
          <span className="truncate">{perfil.nome}</span>
          {/* ⚠️ O selo é IRMÃO do nome, e não filho do `truncate`: dentro dele
              ele some junto com o fim de um nome comprido, e o selo é a
              informação. */}
          {perfil.oficial && <SeloOficial />}
          {perfil.premium && <SeloPremium />}
        </h1>
        {/* No modelo, os salvos moram atrás do ☰ do próprio perfil. O ícone é
            o MESMO marcador do post — é o que liga o gesto ao lugar onde ele
            guarda. */}
        {abrirSalvos && (
          <button type="button" onClick={abrirSalvos} aria-label="Salvos" className="press">
            <IconeMarcador cheio={false} />
          </button>
        )}
        {bloquear && (
          <button
            type="button"
            onClick={() => setConfirmandoBloqueio((v) => !v)}
            aria-label="Opções deste perfil"
            className="press px-1 text-lg leading-none text-muted-foreground"
          >
            ⋯
          </button>
        )}
      </header>

      {/* ⚠️ Bloquear é o único gesto de SEGURANÇA desta tela, e ele diz o que
          faz antes de fazer: desfaz o seguir nos dois sentidos e some com um
          do outro. Um "Bloquear" sem essa frase parece reversível — e é, mas
          o vínculo que ele desfez não volta sozinho. */}
      {confirmandoBloqueio && bloquear && (
        <div className="mx-4 mt-2 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-[13px] leading-snug">
            Bloquear {perfil.nome}? Vocês deixam de se ver por aqui, e quem seguia quem deixa de
            seguir.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmandoBloqueio(false)}
              className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                bloquear();
              }}
              className="press flex-1 rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground"
            >
              Bloquear
            </button>
          </div>

          {/* ⚠️ **SILENCIAR É O DEGRAU DE BAIXO, e ele faltava.** Só existia
              bloquear — que desfaz o seguir nos dois sentidos e que a própria
              tela descreve como coisa séria. Numa rede em que as pessoas se
              conhecem da vida real (a irmã, a cunhada, a amiga do trabalho),
              não ter o meio-termo faz alguém bloquear a irmã, ou desistir da
              aba. Aqui o vínculo CONTINUA: some só do feed. */}
          {aoSilenciar && (
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                aoSilenciar(!perfil.silenciado);
              }}
              className="press mt-2 min-h-[44px] w-full rounded-xl border border-border text-[13px] font-medium"
            >
              {perfil.silenciado
                ? `Voltar a ver ${perfil.nome} no feed`
                : `Silenciar ${perfil.nome} no feed`}
            </button>
          )}
          {aoSilenciar && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {perfil.silenciado
                ? "As publicações dela voltam a aparecer no seu feed."
                : "Você continua seguindo, e o perfil dela continua aqui — só o feed para de trazer as publicações. Ela não é avisada."}
            </p>
          )}

          {/* ⚠️ **DENUNCIAR MORA AO LADO DE BLOQUEAR, e são coisas diferentes.**
              Bloquear resolve para ELA e não conta a ninguém; denunciar leva o
              caso à plataforma. Sem esta porta, a única saída de quem encontra
              uma conta que insiste, copia foto ou distribui conselho de saúde
              era bloquear — e a conta seguia fazendo o mesmo com as outras.
              Era a metade que faltava para a diretriz 1.2 da App Store. */}
          {aoDenunciarPerfil && (
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                setDenunciandoPerfil(true);
              }}
              className="press mt-2 w-full text-[12px] font-medium text-muted-foreground underline underline-offset-2"
            >
              Denunciar este perfil para a plataforma
            </button>
          )}
        </div>
      )}

      {denunciandoPerfil && aoDenunciarPerfil && (
        <div className="mx-4 mt-2">
          <EscolherMotivo
            titulo={`Por que você está denunciando ${perfil.nome}?`}
            aviso="A denúncia vai para a plataforma olhar, e essa pessoa não é avisada."
            aoCancelar={() => setDenunciandoPerfil(false)}
            aoEnviar={(m) => {
              setDenunciandoPerfil(false);
              aoDenunciarPerfil(m);
            }}
          />
        </div>
      )}

      <div className="px-4">
        {/* Avatar à esquerda, números à direita — o arranjo deles. */}
        <div className="flex items-center gap-6">
          <Foto url={perfil.avatarUrl} nome={perfil.nome} lado={AVATAR_DO_PERFIL} />
          <div className="flex flex-1 justify-around">
            {NUMEROS_PUBLICOS.publicacoes && (
              <Numero
                valor={posts.length}
                rotulo={posts.length === 1 ? "publicação" : "publicações"}
              />
            )}
            {/* ⚠️ Os dois números de AUDIÊNCIA só no próprio perfil. É a única
                divergência deliberada do modelo, e ela está pesquisada em
                `NUMEROS_PUBLICOS`: um placar público mede popularidade num
                momento em que ela já está sendo medida clinicamente. */}
            {perfil.souEu && (
              <>
                <button type="button" onClick={() => abrirLista?.("seguidores")} className="press">
                  <Numero valor={perfil.meusSeguidores ?? 0} rotulo="seguidores" />
                </button>
                <button type="button" onClick={() => abrirLista?.("seguindo")} className="press">
                  <Numero valor={perfil.euSigo ?? 0} rotulo="seguindo" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ⚠️ Os dois selos são PEÇAS SEPARADAS, porque as chaves são duas e uma
            delas pode estar ligada sozinha. Uma string só ("Helena · 28
            semanas") obrigaria a desmontá-la para desenhar o caso de uma chave
            só — e é assim que nasce a vírgula solta no começo da linha.

            ⚠️ E eles NÃO entram no cabeçalho do post: lá o carimbo seria a
            semana de HOJE sobre um post de seis semanas atrás, que é o defeito
            que `haQuantoPublicou` acabou de consertar. */}
        {(perfil.seloSemana || perfil.seloBebe) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* ⚠️ `text-primary` sobre `primary/12` media 3,87:1 — abaixo do piso
                de 4,5 que este projeto já cobrou de si mesmo na Loja de
                Sementinhas. 12px em peso 600 não é "texto grande" pela WCAG (o
                corte é 18,66px), e este é justamente o número que a função
                inteira existe para publicar: o texto menos legível da tela era o
                único conteúdo novo dela.

                ⚠️ E o comentário fica AQUI, fora do `{cond && (…)}` — dentro
                dele, um comentário JSX vira o segundo filho da expressão e
                custa um `TS1005` que aponta para a linha do `<span>`. Já está
                escrito no CLAUDE.md, e eu caí nele de novo. */}
            {perfil.seloSemana && (
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-[12px] font-semibold text-foreground">
                🤰 {perfil.seloSemana}
              </span>
            )}
            {perfil.seloBebe && (
              <span className="rounded-full bg-muted/70 px-2.5 py-1 text-[12px] font-medium">
                💛 {perfil.seloBebe}
              </span>
            )}
          </div>
        )}

        {perfil.bio && <p className="mt-3 text-[14px] leading-snug">{perfil.bio}</p>}

        {/* ─── O CÓDIGO DA EMBAIXADORA ──────────────────────────────────────
            ⚠️ **Nunca num toque só.** `ref_code` é gravado UMA VEZ e nunca
            reescrito — e o MESMO campo carrega o código da médica dela. Um
            toque curioso aqui queimaria a indicação da médica para sempre, sem
            erro e sem volta, e nenhuma tela do app poderia desfazer.

            Por isso a confirmação é uma MENSAGEM separada que diz o que o
            toque faz — a mesma decisão do cancelar consulta e do apagar
            publicação. */}
        {perfil.codigoDeEmbaixadora && (
          <div className="mt-3 rounded-2xl border border-border p-3">
            <p className="text-[12px] text-muted-foreground">Código de embaixadora</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-wide">
              {perfil.codigoDeEmbaixadora}
            </p>
            {perfil.possoAplicarOCodigo && aoAplicarCodigo && !somenteLeitura && (
              <>
                {!confirmandoCodigo ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoCodigo(true)}
                    className="press mt-2 w-full rounded-lg border border-border py-1.5 text-[13px] font-semibold"
                  >
                    Usar este código
                  </button>
                ) : (
                  <div className="mt-2 rounded-xl bg-muted/50 p-3">
                    <p className="text-[13px] leading-snug">
                      Usar o código{" "}
                      <span className="font-semibold">{perfil.codigoDeEmbaixadora}</span> como quem
                      te trouxe ao app? Você ganha 150 🌱 de boas-vindas.
                    </p>
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
                      Isso vale uma vez só e não dá para trocar depois — é o mesmo campo onde entra
                      o código da sua médica, se ela te passou um.
                    </p>
                    {/* ⚠️ **O CONSENTIMENTO PRECISA DIZER O QUE ACONTECE.** O
                        código faz o primeiro nome dela aparecer numa lista da
                        criadora, e as duas telas que pediam o código falavam só
                        das 150 🌱. Isso é "expor a paciente sem ela saber" — e o
                        que fica exposto não é um nome qualquer: é "esta pessoa é
                        paciente de um app de gestação de alto risco", que é dado
                        de saúde por inferência. */}
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
                      Quem te trouxe passa a ver o seu primeiro nome numa lista, para poder te
                      presentear. Nada mais do seu acompanhamento aparece para ela.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmandoCodigo(false)}
                        className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                      >
                        Agora não
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmandoCodigo(false);
                          aoAplicarCodigo(perfil.codigoDeEmbaixadora!);
                        }}
                        className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground"
                      >
                        Sim, usar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={seguir}
          disabled={perfil.souEu || perfil.meuVinculo === "pendente"}
          className={`press mt-3 w-full rounded-lg py-1.5 text-[14px] font-semibold ${
            perfil.meuVinculo || perfil.souEu
              ? "border border-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {rotuloDoBotao}
        </button>

        {/* ⚠️ A caixinha aparece a QUEM VISITA, nunca à dona — no perfil dela o
            que existe é a caixa cheia, que mora no hub. E ela nasce do campo
            que o servidor devolve: um botão desenhado por conta própria
            prometeria uma caixa fechada. */}
        {perfil.aceitaPerguntas && !perfil.souEu && (
          <CaixinhaNoPerfil
            nome={perfil.nome}
            aoPerguntar={perguntar}
            aoAbrirSOS={aoAbrirSOS}
            inerte={somenteLeitura}
          />
        )}

        {/* ⚠️ O espelho vive no PRÓPRIO perfil, e não numa tela de ajustes: a
            pergunta que ele responde ("o que os outros veem?") só ocorre a
            alguém que está olhando o próprio perfil. Escondido nos ajustes,
            ele seria mais um controle que existe e ninguém acha — que é o
            defeito que a catraca de portas foi escrita para pegar. */}
        {aoAbrirEspelho && !somenteLeitura && (
          <button
            type="button"
            onClick={aoAbrirEspelho}
            className="press mt-2 w-full rounded-lg border border-border py-1.5 text-[14px] font-medium"
          >
            👁 Ver como os outros veem
          </button>
        )}
      </div>

      {/* As abas, com o traço embaixo da ativa — a assinatura da tela deles. */}
      <div className="mt-4 flex border-b border-border">
        {ABAS_DO_PERFIL.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            className={`press h-11 flex-1 text-[13px] font-medium ${
              aba === a.chave
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "grade" ? (
        /* A grade é a MESMA dos salvos (`GradeDePosts`) — duas cópias
           divergiriam na primeira vez que a proporção da célula mudasse, e ela
           já mudou uma vez (1:1 → 3:4, em 2025). */
        <GradeDePosts
          posts={naGrade}
          vazio="Nenhuma publicação ainda."
          aoAbrirPost={abrirPost}
          aoChegarNoFim={aoChegarNoFim}
          temMais={temMais}
        />
      ) : perfil.bebe ? (
        /* ⚠️ Esta aba existia VAZIA desde o primeiro dia, prometendo "os marcos
            da gestação vão aparecer aqui 💛" — em qualquer perfil, inclusive o
            de terceiro. Era a única promessa não paga da rede.

            ⚠️ E o que entrou é tudo DERIVADO da semana: quem sabe que ela está
            de 28 semanas já sabe o tamanho do bebê. É o mesmo fato em outras
            palavras, e a tabela é igual para toda gestante — por isso obedece à
            mesma chave, sem virar uma segunda decisão de privacidade.

            ⚠️ NADA de marco de exame. `consultaForWeek` devolve TOTG,
            morfológico e hemograma: a agenda clínica dela. */
        <div className="px-4 py-6">
          <div className="flex items-center gap-4">
            <span aria-hidden className="text-5xl leading-none">
              {perfil.bebe.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-[17px] font-semibold leading-tight">{perfil.bebe.fruta}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                {perfil.bebe.tamanho}
                {perfil.bebe.peso && perfil.bebe.peso !== "—" ? ` · ${perfil.bebe.peso}` : ""}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-snug">{perfil.bebe.sobre}</p>
          <p className="mt-4 text-[12px] leading-snug text-muted-foreground">
            O tamanho é uma média da semana — cada bebê cresce no ritmo dele.
          </p>
        </div>
      ) : (
        /* Sem semana pública, a aba não promete: ela diz o que é. */
        <p className="px-8 py-16 text-center text-sm leading-snug text-muted-foreground">
          {perfil.souEu
            ? "Quando a data da sua última menstruação estiver no perfil, o tamanho do bebê aparece aqui 💛"
            : "Esta pessoa não mostra a semana da gestação no perfil."}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O CONTÊINER — busca, e alterna entre feed e perfil
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A rede dentro do app: o feed, e o perfil de quem ela tocar.
 *
 * Duas telas e um estado — `abertoEm` guarda o id de quem está sendo visto, e
 * `null` é o feed. Um router aqui seria um endereço novo por perfil, e a aba
 * inteira vive dentro de `minha-conta`, que já governa a navegação.
 */
/**
 * A rede dentro do app — cinco telas e um estado.
 *
 * `onde` diz o que desenhar: o feed, um perfil, a edição do próprio perfil,
 * uma lista de gente, ou um post sozinho. Um router aqui daria um endereço por
 * tela, e a aba inteira vive dentro de `minha-conta`, que já governa a
 * navegação.
 *
 * ⚠️ **A pilha é rasa de propósito: `voltar` sempre cai no feed ou no perfil
 * anterior, nunca numa cadeia.** Uma pilha de verdade precisaria de histórico
 * próprio, e o botão físico de voltar do Android já governa a aba — duas
 * pilhas concorrentes é como a seta passa a levar para o lugar errado, que é
 * o defeito que `voltarDaBarra` já teve de consertar três vezes neste app.
 */
type Onde =
  | { t: "feed" }
  | { t: "perfil"; id: string }
  | { t: "editar" }
  | { t: "lista"; tipo: "seguidores" | "seguindo" }
  | { t: "post"; id: string }
  | { t: "novo" }
  | { t: "atividade" }
  | { t: "salvos" }
  | { t: "arquivados" }
  | { t: "busca" }
  | { t: "caixinha" }
  | { t: "espelho" };

export function RedeNoApp({
  careMode = false,
  onAbrirSecoes,
  onIrParaOJogo,
  onAbrirSOS,
  aulaDeHoje,
  sinalDeVoltarAoFeed = 0,
}: {
  careMode?: boolean;
  onAbrirSecoes?: () => void;
  /**
   * A Central de Emergência.
   *
   * ⚠️ **PROP, e não um evento global.** Quem governa a folha do SOS é
   * `minha-conta`, e um `CustomEvent` criaria um segundo dono para o mesmo
   * estado — o defeito que este app já pagou com `voltarDaBarra` e com o passo
   * do tutorial. Sem a prop, a bandeira vermelha ainda mostra o recado; o que
   * some é o botão.
   */
  onAbrirSOS?: () => void;
  /** Leva ao Caminho — é lá que a atividade do desafio acontece. */
  onIrParaOJogo?: () => void;
  /**
   * A aula que ela fez hoje, se fez — quem sabe disso é o Caminho, e ele passa
   * por `minha-conta`. Sem ela, o compositor simplesmente não oferece o anexo.
   */
  aulaDeHoje?: AulaNoPost | null;
  /**
   * Sobe a cada toque no ícone da Comunidade na barra de baixo.
   *
   * ⚠️ **É um CONTADOR, nunca um booleano.** Precisa disparar de novo a cada
   * toque, e um booleano só dispararia uma vez. Ver `onSelect` em
   * `minha-conta`: de dentro de uma sub-tela o toque caía num `setTab("Feed")`
   * que já era "Feed", e a tela não se mexia.
   */
  sinalDeVoltarAoFeed?: number;
}) {
  const [posts, setPosts] = useState<PostNaTela[]>([]);
  const [onde, setOnde] = useState<Onde>({ t: "feed" });

  const [perfil, setPerfil] = useState<PerfilNaTela | null>(null);
  /**
   * O CABEÇALHO PROVISÓRIO, com o que o feed já sabia.
   *
   * ⚠️ Ele nunca vira o perfil: é substituído pela resposta real e some inteiro
   * quando ela é `indisponivel` (bloqueio, Modo Cuidado e perfil inexistente
   * respondem a mesma palavra, e a tela não conta qual foi). Ver
   * `src/lib/esboco-de-perfil.ts`.
   */
  const [esboco, setEsboco] = useState<EsbocoDePerfil | null>(null);
  const [doPerfil, setDoPerfil] = useState<PostNaTela[]>([]);
  /**
   * O cursor da grade do perfil aberto.
   *
   * ⚠️ Ele mora aqui, e não dentro de `TelaDePerfil`: a tela é remontada a cada
   * abertura, e o cursor precisa acompanhar a lista — que também mora aqui.
   */
  const [proximoDoPerfil, setProximoDoPerfil] = useState<string | null>(null);
  const buscandoDoPerfil = useRef(false);
  const [gente, setGente] = useState<PessoaNaLista[]>([]);
  const [oPost, setOPost] = useState<PostNaTela | null>(null);
  const [bolhas, setBolhas] = useState<BolhaDeStory[]>([]);
  const [vendoStory, setVendoStory] = useState<BolhaDeStory | null>(null);
  const [euId, setEuId] = useState<string | null>(null);
  /** A MINHA foto. Ver a fileira de stories — `perfil` é o último perfil ABERTO. */
  const [meuAvatar, setMeuAvatar] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<AtividadeNaTela[]>([]);
  const [naoVistas, setNaoVistas] = useState(0);
  const [salvos, setSalvos] = useState<PostNaTela[]>([]);
  /** A gaveta: o que ela tirou do ar. */
  const [arquivados, setArquivados] = useState<PostNaTela[]>([]);
  const [sugestoes, setSugestoes] = useState<PostNaTela[]>([]);
  /**
   * O código de indicação dela — o que faz o convite TRAZER alguém.
   *
   * ⚠️ Carregado UMA vez, e não por pintura do feed: `getReferral` cria o
   * código se ele ainda não existir, então é escrita, não só leitura.
   */
  const [meuCodigo, setMeuCodigo] = useState<string | null>(null);

  /**
   * O LEMBRETE do "então e agora".
   *
   * ⚠️ **Um recurso escondido no compositor não acontece.** A escolha da foto
   * antiga vive atrás do botão de comparar, dentro da tela de publicar: quem
   * não souber que ele existe nunca esbarra nele. O cartão é o único lugar em
   * que o app diz que aquela foto de quatro semanas atrás pode virar alguma
   * coisa.
   */
  /**
   * O "então" que o lembrete escolheu, entregue ao compositor.
   *
   * ⚠️ **Zerado ao FECHAR o compositor.** Sem isso, a próxima publicação
   * comum — dias depois — nasceria com a comparação ligada, e ela publicaria
   * um "então e agora" que não pediu.
   */
  const [entaoEscolhido, setEntaoEscolhido] = useState<string | null>(null);

  const [lembreteEntao, setLembreteEntao] = useState<{
    id: string;
    imagemUrl: string;
    criadoEm: string;
  } | null>(null);

  /**
   * O toque no ícone da Comunidade volta ao começo.
   *
   * ⚠️ **A primeira passada não faz nada** (o efeito roda na montagem, quando
   * ela ACABOU de chegar por outro caminho — pelo hub, por um deep-link, pelo
   * cartão de presente). Sem a guarda, abrir a aba já num perfil a jogaria
   * para o feed no primeiro quadro.
   *
   * Estando já no feed, só rola para o topo — que é o gesto do modelo, e a
   * única resposta possível a um toque que "não muda de tela".
   */
  const primeiroSinal = useRef(true);
  useEffect(() => {
    if (primeiroSinal.current) {
      primeiroSinal.current = false;
      return;
    }
    setOnde({ t: "feed" });
    setVendoStory(null);
    /* ⚠️ O toque no ícone APAGA o lugar guardado, e isto não é limpeza: ele é
       um pedido explícito de voltar ao começo. Sem apagar, a próxima abertura
       da aba a devolveria ao ponto que ela acabou de dizer que não queria. */
    esquecerOLugar();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinalDeVoltarAoFeed]);

  /* ══════════════════════════════════════════════════════════════════════
     ONDE ELA PAROU DE LER — ver `lugar-no-feed.ts` para o porquê de tudo.
     ══════════════════════════════════════════════════════════════════════ */

  function esquecerOLugar() {
    try {
      if (euId) sessionStorage.removeItem(chaveDoLugar(euId));
    } catch {
      /* sem armazenamento: o feed abre no topo, como sempre abriu */
    }
  }

  /**
   * Guarda o post que está no alto da tela.
   *
   * ⚠️ **`sessionStorage`, e não `localStorage`.** "Onde eu parei" morre com a
   * aba: guardar entre sessões devolveria a paciente ao meio de um feed que
   * mudou inteiro, e é justamente o que apareceu de novo que ela quer ver ao
   * abrir o app de manhã. A validade de trinta minutos da régua é a segunda
   * defesa, para a aba que fica aberta o dia todo.
   */
  const guardarOLugar = useCallback(() => {
    if (!euId || typeof document === "undefined") return;
    try {
      const artigos = [...document.querySelectorAll<HTMLElement>("article[data-post]")];
      /* O primeiro cuja base ainda não passou do alto da tela: é o que ela
         está lendo, e não o que já ficou para trás. */
      const alvo = artigos.find((a) => a.getBoundingClientRect().bottom > 0);
      const id = alvo?.dataset.post;
      if (!id) return;
      const t = lugarParaGuardar(id, new Date());
      if (t) sessionStorage.setItem(chaveDoLugar(euId), t);
    } catch {
      /* idem */
    }
  }, [euId]);

  /* Guarda ao SAIR do feed (para uma sub-tela) e ao esconder a página — o
     caminho de quem troca de aba no app ou sai dele. `visibilitychange` é o
     único evento confiável no iOS; `beforeunload` não dispara lá. */
  useEffect(() => {
    if (onde.t !== "feed") {
      guardarOLugar();
      return;
    }
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") guardarOLugar();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      /* Desmontar a aba (trocar para Bebê, Jogo…) também é sair do feed. */
      guardarOLugar();
    };
  }, [onde.t, guardarOLugar]);

  /**
   * Volta para o lugar — UMA vez por montagem.
   *
   * ⚠️ **Uma vez, e o `ref` é o que garante isso.** O efeito depende de `posts`,
   * que muda a cada página carregada pela rolagem infinita: sem a trava, cada
   * página nova puxaria a tela de volta para o mesmo post — a paciente rolando
   * para baixo e o app puxando para cima.
   */
  const jaVoltei = useRef(false);
  useEffect(() => {
    if (jaVoltei.current || onde.t !== "feed" || !euId || posts.length === 0) return;
    try {
      const lugar = lerLugar(sessionStorage.getItem(chaveDoLugar(euId)), new Date());
      if (
        !deveRestaurar(
          lugar,
          posts.map((p) => p.id),
        )
      ) {
        jaVoltei.current = true;
        return;
      }
      const alvo = document.querySelector<HTMLElement>(`article[data-post="${lugar!.postId}"]`);
      if (!alvo) return;
      jaVoltei.current = true;
      /* ⚠️ **`instant`, e NUNCA `auto`.** Medido no navegador: `styles.css` põe
         `scroll-behavior: smooth` no `<html>`, e `auto` quer dizer "use o que o
         CSS mandar" — então a volta ao lugar saía como uma rolagem ANIMADA de
         dois mil e quinhentos pixels na abertura da aba, que lê como o app se
         movendo sozinho. `instant` ignora o CSS. */
      alvo.scrollIntoView({ block: "start", behavior: "instant" });
    } catch {
      jaVoltei.current = true;
    }
  }, [onde.t, euId, posts]);
  const [persona, setPersona] = useState<Persona>("estranha");
  /** A foto escolhida, esperando a conferência antes de virar story. */
  const [conferindoStory, setConferindoStory] = useState<string | null>(null);
  /** A semana que ela pode carimbar — do servidor, e `null` quando não há. */
  const [semanaDoCarimbo, setSemanaDoCarimbo] = useState<string | null>(null);
  const [desafio, setDesafio] = useState<DesafioNaTela | null>(null);
  /* ─── A PRÓXIMA LIVE ────────────────────────────────────────────────────
     ⚠️ **Consulta PRÓPRIA e best-effort.** `listLivesPublic` já recorta pelo
     médico dela; aqui só se escolhe qual entra (`liveDoTopo`). Falha, tabela
     ausente ou lista vazia devolvem `null`, que é o caso NORMAL — na maioria
     dos dias não há live marcada, e o topo do feed é dos stories. */
  const [live, setLive] = useState<LiveNoTopo | null>(null);
  /* O recorte por fase nas sugeridas. ⚠️ Desligado por padrão: o recorte é uma
     escolha dela, e um filtro ligado sozinho esconderia gente sem que ela
     soubesse por quê. */
  const [mesmaFase, setMesmaFase] = useState(false);
  /* A caixinha: as perguntas dela e a chave. `naCaixa` alimenta o emblema da
     bolinha, e por isso é carregado JUNTO com o feed — um número que só
     chegasse ao abrir a caixa nasceria sempre zerado, e ninguém abriria. */
  const [perguntasDaCaixa, setPerguntasDaCaixa] = useState<PerguntaNaTela[]>([]);
  const [caixaAberta, setCaixaAberta] = useState(false);
  const [naCaixa, setNaCaixa] = useState(0);
  const [previa, setPrevia] = useState<{
    perfil: PerfilNaTela | null;
    posts: PostNaTela[];
    trancado: boolean;
    carregando: boolean;
  }>({ perfil: null, posts: [], trancado: false, carregando: true });
  const [pessoas, setPessoas] = useState<PessoaNaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  /** Cursor da página seguinte do feed. `null` = acabou. */
  const [proximo, setProximo] = useState<string | null>(null);
  /* ⚠️ `useRef` e não `useState`: a sentinela pode disparar duas vezes no mesmo
     tranco de rolagem, e um estado só valeria no render seguinte — as duas
     chamadas leriam `false` e a mesma página entraria duas vezes na lista. */
  const buscandoMais = useRef(false);
  /** Já pedi as sugestões nesta visita? Ver `carregarSugestoes`. */
  const sugestoesPedidas = useRef(false);
  const arquivoDoStory = useRef<HTMLInputElement>(null);

  /**
   * ⚠️ AS AÇÕES DA LISTA, COM REFERÊNCIA FIXA — e sem isto o `memo` do cartão
   * não vale nada.
   *
   * `reagir`, `guardar`, `votar` e as outras são declaradas no corpo deste
   * componente: cada pintura cria funções NOVAS. Passadas direto, todo cartão
   * recebe props diferentes a cada `setPosts` e redesenha, mesmo o post que
   * não mudou uma vírgula.
   *
   * Aqui o objeto é criado UMA vez (`useMemo` com lista vazia) e cada método
   * encaminha para a versão mais recente, guardada num `ref` que é reescrito a
   * cada render. Referência estável por fora, fecho fresco por dentro — sem
   * `useCallback` em cascata, que obrigaria a memoizar tudo que elas leem.
   *
   * ⚠️ O `ref` é atualizado no CORPO do render, não num efeito: um efeito roda
   * DEPOIS da pintura, e o toque que acontecer entre as duas chamaria a versão
   * anterior — com o estado anterior nos fechos.
   */
  const ultimas = useRef({
    reagir: (_p: PostNaTela, _t: TipoDeReacao | null) => {},
    guardar: (_p: PostNaTela, _v: boolean) => {},
    votar: (_p: PostNaTela, _i: number) => {},
    apagar: (_p: PostNaTela) => {},
    denunciar: (_p: PostNaTela, _m: MotivoDaDenuncia) => {},
    tirarMarcacao: (_p: PostNaTela) => {},
    editar: async (_p: PostNaTela, _t: string) => false,
    verQuemReagiu: (_p: PostNaTela) => {},
    abrirPerfil: (_id: string) => {},
    ver: (_id: string) => {},
  });
  /* ─── O LOTE DE "VISTOS" ─────────────────────────────────────────────────
     ⚠️ **UMA chamada por leva, e não uma por post.** Vinte cartões entrando na
     tela durante uma rolagem dariam vinte idas ao servidor — no exato momento
     em que a linha principal não pode estar ocupada. Os ids se acumulam num
     `Set` e saem juntos meio segundo depois de o último entrar.

     ⚠️ **`useRef` e não `useState`**: o observador dispara várias vezes dentro
     do mesmo quadro, e um estado só valeria no render seguinte — os primeiros
     ids se perderiam. É a mesma razão da trava da sentinela de paginação.

     ⚠️ **E o `jaMandados` impede o reenvio na volta.** O cartão desmonta ao sair
     da lista (troca de aba, nova página) e remonta depois; sem esta memória, o
     mesmo post sairia de novo a cada volta. */
  const pendentes = useRef<Set<string>>(new Set());
  const jaMandados = useRef<Set<string>>(new Set());
  const relogioDoLote = useRef<ReturnType<typeof setTimeout> | null>(null);

  function marcarPostVisto(id: string) {
    if (jaMandados.current.has(id)) return;
    jaMandados.current.add(id);
    pendentes.current.add(id);
    if (relogioDoLote.current) clearTimeout(relogioDoLote.current);
    relogioDoLote.current = setTimeout(() => {
      const ids = [...pendentes.current];
      pendentes.current.clear();
      if (ids.length === 0) return;
      void (async () => {
        try {
          const t = await token();
          if (!t) return;
          const { marcarPostsVistos } = await import("@/lib/rede-social.functions");
          /* Teto de 60 no servidor — a leva do feed é bem menor, mas uma
             rolagem longa pode acumular. */
          for (let i = 0; i < ids.length; i += 60) {
            await marcarPostsVistos({ data: { accessToken: t, postIds: ids.slice(i, i + 60) } });
          }
        } catch {
          /* Métrica: nunca derruba a rolagem. */
        }
      })();
    }, 500);
  }

  ultimas.current = {
    reagir: (p, t) => void reagir(p, t),
    guardar: (p, v) => void guardar(p, v),
    votar: (p, i) => void votar(p, i),
    apagar: (p) => void apagar(p),
    denunciar: (p, m) => void denunciarPost(p, m),
    tirarMarcacao: (p) => void tirarMarcacao(p),
    editar: (p, t) => editarLegenda(p, t),
    verQuemReagiu: (p) => void verQuemReagiu(p),
    abrirPerfil: (id) => void abrirPerfil(id),
    ver: (id) => marcarPostVisto(id),
  };
  useEffect(() => {
    if (careMode) return;
    let vivo = true;
    void (async () => {
      try {
        const t = await token();
        const { listLivesPublic } = await import("@/lib/lives.functions");
        const r = await listLivesPublic({ data: t ? { accessToken: t } : {} });
        if (!vivo || !r.ok) return;
        setLive(liveDoTopo(r.lives, Date.now(), careMode));
      } catch {
        /* Sem live, a aba é a de sempre. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [careMode]);

  const acoes = useMemo(
    () => ({
      reagir: (p: PostNaTela, t: TipoDeReacao | null) => ultimas.current.reagir(p, t),
      guardar: (p: PostNaTela, v: boolean) => ultimas.current.guardar(p, v),
      votar: (p: PostNaTela, i: number) => ultimas.current.votar(p, i),
      apagar: (p: PostNaTela) => ultimas.current.apagar(p),
      denunciar: (p: PostNaTela, m: MotivoDaDenuncia) => ultimas.current.denunciar(p, m),
      tirarMarcacao: (p: PostNaTela) => ultimas.current.tirarMarcacao(p),
      editar: (p: PostNaTela, t: string) => ultimas.current.editar(p, t),
      verQuemReagiu: (p: PostNaTela) => ultimas.current.verQuemReagiu(p),
      abrirPerfil: (id: string) => ultimas.current.abrirPerfil(id),
      ver: (id: string) => ultimas.current.ver(id),
    }),
    [],
  );

  /**
   * Pede três legendas para a foto da capa.
   *
   * ⚠️ **Reduz ANTES de mandar** (`LADO_PARA_A_IA`, 512px). A foto do post tem
   * 1080 em JPEG 0,8, ~300 KB — mandar isso é gastar o 4G dela num botão
   * opcional e, sobretudo, fazer sair do aparelho mais imagem do que o
   * necessário. É foto de gestação, às vezes ultrassom.
   */
  /**
   * Votar na enquete de um story.
   *
   * ⚠️ Otimista e SEM recarregar a fileira: o visor está aberto por cima de
   * tudo, e recarregar trocaria o story debaixo do dedo dela.
   */
  /**
   * Reagir a um story.
   *
   * ⚠️ **Silencioso em caso de falha, e de propósito.** A tela já pintou a
   * reação (o visor guarda o estado local), e um `toast` de erro por cima de um
   * story em tela cheia, com relógio correndo, é ruído — ela toca de novo se
   * quiser. É o oposto do publicar, onde a recusa PRECISA chegar.
   */
  async function reagirNoStory(storyId: string, tipo: TipoDeReacao | null) {
    try {
      const t = await token();
      if (!t) return;
      const { reagirAoStory } = await import("@/lib/rede-social.functions");
      await reagirAoStory({ data: { accessToken: t, storyId, tipo } });
    } catch {
      /* ver o cabeçalho */
    }
  }

  async function votarNoStory(storyId: string, opcao: number) {
    try {
      const t = await token();
      if (!t) return;
      const { votarNoStory: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, storyId, opcao } });
    } catch {
      /* O voto local já apareceu; a próxima abertura traz a verdade. */
    }
  }

  /**
   * A pergunta mandada de dentro de um story.
   *
   * ⚠️ **É a MESMA `perguntarPara` da caixinha** — mesma tabela, mesma
   * `decidirPergunta`, mesmo encaminhamento ao médico quando há sinal clínico.
   * O story é outra PORTA, nunca uma segunda caixinha. Devolve o recado da
   * recusa (ou `null` quando foi).
   */
  async function perguntarNoStory(
    donaId: string,
    texto: string,
    storyId: string,
  ): Promise<string | null> {
    /* ⚠️ Sem `toast` aqui: o visor é tela cheia com relógio correndo, e o
       recado precisa aparecer DENTRO da caixinha, onde o dedo dela está. */
    const r = await enviarPergunta(donaId, texto, storyId);
    if (!r.ok) return r.recado;
    return r.desfecho === "publicavel" ? null : recadoDoDesfecho(r.desfecho);
  }

  /* O resumo de domingo. `null` = não há (ou já foi dispensado). */
  const [retro, setRetro] = useState<Retrospectiva | null>(null);

  useEffect(() => {
    if (!euId) return;
    const agora = new Date();
    /* ⚠️ O DIA DA SEMANA É CONFERIDO NO CLIENTE, e de propósito: "é domingo"
       depende do fuso DELA, e o servidor roda em UTC. Um domingo calculado em
       UTC mostraria o cartão no sábado à noite para quem está no Brasil. */
    if (!ehDomingo(agora)) return;
    let vivo = true;
    (async () => {
      try {
        const chave = chaveDaRetrospectiva(euId, agora);
        if (localStorage.getItem(chave)) return;
        const t = await token();
        if (!t) return;
        const { minhaSemana } = await import("@/lib/rede-social.functions");
        const r = await minhaSemana({ data: { accessToken: t } });
        if (vivo && r.ok) setRetro(r.retrospectiva);
      } catch {
        /* sem resumo é o caso comum — nada na tela */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [euId]);

  /* Quem reagiu ao post aberto na folha. `null` = folha fechada. */
  const [quemReagiu, setQuemReagiu] = useState<{
    postId: string;
    gente: QuemReagiu[] | null;
  } | null>(null);

  /**
   * Abre a folha de quem reagiu.
   *
   * ⚠️ **Abre VAZIA e só depois preenche** (`gente: null` = carregando). Esperar
   * a resposta antes de abrir faria o toque parecer que não funcionou, que é o
   * defeito que a rodada de desempenho acabou de consertar em outro lugar.
   */
  async function verQuemReagiu(post: PostNaTela) {
    setQuemReagiu({ postId: post.id, gente: null });
    try {
      const t = await token();
      if (!t) return setQuemReagiu({ postId: post.id, gente: [] });
      const { quemReagiuAoPost } = await import("@/lib/rede-social.functions");
      const r = await quemReagiuAoPost({ data: { accessToken: t, postId: post.id } });
      /* ⚠️ Só aplica se a folha ainda for DESTE post: dois toques rápidos em
         posts diferentes trariam a lista errada para a folha aberta. */
      setQuemReagiu((atual) =>
        atual && atual.postId === post.id ? { postId: post.id, gente: r.ok ? r.gente : [] } : atual,
      );
    } catch {
      setQuemReagiu((atual) =>
        atual && atual.postId === post.id ? { postId: post.id, gente: [] } : atual,
      );
    }
  }

  /**
   * As publicações antigas dela que servem de "então".
   *
   * ⚠️ Sai dos posts DO PERFIL DELA que já estão carregados quando dá, e da
   * rede quando não dá — mas sempre pela régua de `entao-e-agora.ts`, nunca por
   * um filtro escrito aqui.
   */
  const [paraComparar, setParaComparar] = useState<
    { id: string; imagemUrl: string; criadoEm: string }[] | null
  >(null);

  useEffect(() => {
    /* ⚠️ Também no FEED, e não só no compositor: é o feed que mostra o
       lembrete, e a mesma consulta serve os dois — o guarda `!== null` impede
       a segunda ida quando ela abre o compositor logo depois. */
    if ((onde.t !== "novo" && onde.t !== "feed") || !euId || paraComparar !== null) return;
    let vivo = true;
    (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { verPerfil } = await import("@/lib/rede-social.functions");
        const r = await verPerfil({ data: { accessToken: t, alvoId: euId } });
        if (!vivo) return;
        if (!r.ok) return setParaComparar([]);
        const { candidatosAoEntao } = await import("@/lib/entao-e-agora");
        setParaComparar(
          candidatosAoEntao(
            r.posts.map((p) => ({ id: p.id, criadoEm: p.criadoEm, imagemUrl: p.imagemUrl })),
            new Date(),
          )
            .filter((c) => !!c.imagemUrl)
            .map((c) => ({ id: c.id, imagemUrl: c.imagemUrl as string, criadoEm: c.criadoEm })),
        );
      } catch {
        if (vivo) setParaComparar([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onde.t, euId, paraComparar]);

  useEffect(() => {
    if (onde.t !== "feed" || !euId || !paraComparar) return;
    try {
      const chave = chaveDoLembrete(euId);
      const escolhida = lembreteDoEntao({
        candidatos: paraComparar,
        ultimoEm: localStorage.getItem(chave),
        agora: new Date(),
        /* ⚠️ O portão do luto mora DENTRO da régua; aqui só se entrega o fato. */
        emCuidado: careMode,
      });
      if (!escolhida || !escolhida.imagemUrl) return;
      /* ⚠️ **O carimbo é escrito AGORA, no instante em que ele aparece — e não
         quando ela dispensa.** Ignorar é a resposta mais comum a qualquer
         cartão, e contado pela dispensa o lembrete voltaria em toda abertura da
         aba para quem simplesmente rolou por cima dele. */
      localStorage.setItem(chave, new Date().toISOString());
      setLembreteEntao({
        id: escolhida.id,
        imagemUrl: escolhida.imagemUrl,
        criadoEm: escolhida.criadoEm,
      });
    } catch {
      /* sem armazenamento: nenhum lembrete, e nada quebra */
    }
  }, [onde.t, euId, paraComparar, careMode]);

  /**
   * O RASCUNHO — lido do aparelho ao abrir o compositor, e só uma vez.
   *
   * ⚠️ **Lido no ABRIR, e não a cada render**: o compositor reescreve o
   * rascunho enquanto ela digita, e reler a cada pintura devolveria o que ela
   * acabou de escrever como se fosse "um rascunho antigo".
   */
  const [rascunho, setRascunho] = useState<RascunhoDoPost | null>(null);

  /**
   * A VITÓRIA que ela mandou publicar de outra aba.
   *
   * ⚠️ Lida no ABRIR do compositor, e ESQUECIDA no mesmo instante: o bilhete é
   * de uso único. Sem apagar, sair do compositor e voltar traria o cartão de
   * novo — sobre a foto que ela estava publicando desta vez.
   */
  const [momentoParaPublicar, setMomentoParaPublicar] = useState<Momento | null>(null);

  useEffect(() => {
    /* ⚠️ **O bilhete também ABRE o compositor**, e não só o preenche. Ela vem
       do Caminho tocando em "Publicar na Comunidade": chegar no FEED e ter de
       achar o ＋ sozinha seria o botão prometer uma coisa e entregar outra.
       Por isso o efeito olha os dois estados — no feed ele navega, no
       compositor ele preenche. */
    if (onde.t !== "novo" && onde.t !== "feed") return;
    const m = lerMomentoParaPublicar();
    if (!m) return;
    /* ⚠️ Esquecido no MESMO instante: o bilhete é de uso único. Sem apagar,
       sair do compositor e voltar traria o cartão de novo — sobre a foto que
       ela estava publicando desta vez. */
    esquecerMomento();
    setMomentoParaPublicar(m);
    if (onde.t === "feed") setOnde({ t: "novo" });
  }, [onde.t]);

  useEffect(() => {
    if (onde.t !== "novo" || !euId) return;
    try {
      setRascunho(lerRascunho(localStorage.getItem(chaveDoRascunho(euId)), new Date()));
    } catch {
      setRascunho(null);
    }
    /* Só ao ENTRAR na tela: `euId` não muda dentro dela. */
  }, [onde.t, euId]);

  /**
   * Guarda (ou apaga) o rascunho.
   *
   * ⚠️ **Estável (`useCallback` vazio)**: ela é dependência do efeito com atraso
   * lá dentro do compositor, e uma referência nova a cada pintura reiniciaria o
   * relógio de 700 ms a cada letra — ou seja, nunca gravaria.
   *
   * ⚠️ **E a cota é engolida em silêncio.** `setItem` estoura quando o
   * armazenamento enche, e derrubar o compositor por causa de um rascunho seria
   * trocar um conforto por um defeito.
   */
  const guardarRascunho = useCallback(
    (r: Omit<RascunhoDoPost, "em"> | null) => {
      if (!euId) return;
      try {
        const chave = chaveDoRascunho(euId);
        if (!r) {
          localStorage.removeItem(chave);
          return;
        }
        const saida = paraGuardar(r, new Date());
        if (saida.guardar) localStorage.setItem(chave, saida.texto);
        else localStorage.removeItem(chave);
      } catch {
        /* sem armazenamento, ou cota cheia: o compositor segue funcionando */
      }
    },
    [euId],
  );

  /**
   * Quem eu posso marcar — carregada UMA vez, ao abrir o compositor.
   *
   * ⚠️ `null` até responder, e por isso o botão só aparece depois: mostrar um
   * seletor vazio enquanto a lista vem faria a paciente concluir que não tem
   * amiga nenhuma no app.
   */
  const [paraMarcar, setParaMarcar] = useState<
    { id: string; nome: string; avatar: string | null }[] | null
  >(null);

  useEffect(() => {
    if (onde.t !== "novo" || paraMarcar !== null) return;
    let vivo = true;
    (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { amigasParaMarcar } = await import("@/lib/rede-social.functions");
        const r = await amigasParaMarcar({ data: { accessToken: t } });
        if (vivo && r.ok) setParaMarcar(r.amigas);
      } catch {
        if (vivo) setParaMarcar([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onde.t, paraMarcar]);

  /**
   * Tirar a MINHA marcação de um post.
   *
   * ⚠️ Otimista, e some da tela na hora: o gesto é "não quero meu nome aqui", e
   * um nome que continua na tela por um segundo depois do toque é exatamente o
   * segundo que ela não quer.
   */
  async function tirarMarcacao(post: PostNaTela) {
    const aplicar = (ps: PostNaTela[]) =>
      ps.map((x) =>
        x.id === post.id
          ? { ...x, souMarcada: false, marcadas: x.marcadas.filter((m) => m.id !== euId) }
          : x,
      );
    setPosts(aplicar);
    setDoPerfil(aplicar);
    setSugestoes(aplicar);
    setOPost((x) => (x ? aplicar([x])[0] : x));
    try {
      const t = await token();
      if (!t) return;
      const { tirarMinhaMarcacao } = await import("@/lib/rede-social.functions");
      const r = await tirarMinhaMarcacao({ data: { accessToken: t, postId: post.id } });
      /* ⚠️ **RECUSA NÃO É SILÊNCIO AQUI.** A tela já tinha tirado o nome dela do
         post (otimista, que é o certo), e um `ok: false` deixava a mentira na
         tela: ela via "com Fulana" sem o próprio nome e ia embora achando que
         tinha saído da foto. Tirar uma marcação é a defesa dela contra aparecer
         onde não quer — é o único lugar da tela onde falhar em silêncio é
         pior que um toast. */
      if (!r.ok) {
        const { toast } = await import("sonner");
        toast.error("Não deu para tirar a marcação. Tente de novo.");
        void carregarFeed();
      }
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para tirar a marcação. Tente de novo.");
      void carregarFeed();
    }
  }

  /**
   * Salvar a legenda editada.
   *
   * ⚠️ **Devolve BOOLEANO e mostra o recado da régua clínica.** Sem o recado,
   * quem escreveu "não precisa ir ao pronto-socorro" recebe um "não deu" mudo,
   * reescreve a mesma frase e tenta de novo para sempre — o mesmo defeito que
   * `publicar` já tinha resolvido. O texto vem do SERVIDOR: decidir aqui por
   * que foi recusado seria uma segunda régua clínica no navegador.
   */
  async function editarLegenda(post: PostNaTela, texto: string): Promise<boolean> {
    try {
      const t = await token();
      if (!t) return false;
      const { editarPost } = await import("@/lib/rede-social.functions");
      const r = await editarPost({ data: { accessToken: t, postId: post.id, texto } });
      if (!r.ok) {
        const { toast } = await import("sonner");
        if ("recado" in r && r.recado) toast.error(r.recado, { duration: 7000 });
        else if (r.motivo === "vazio")
          toast.error("A legenda não pode ficar vazia. Para tirar do ar, use arquivar.");
        else toast.error("Não deu para salvar. Tente de novo.");
        return false;
      }
      /* Otimista DEPOIS de gravar: o selo "editado" aparece junto com o texto
         novo, e não antes — senão o post diria "editado" sobre a legenda velha
         numa falha de rede. */
      const limpo = texto.trim() || null;
      const aplicar = (ps: PostNaTela[]) =>
        ps.map((x) =>
          x.id === post.id ? { ...x, texto: limpo, editadoEm: new Date().toISOString() } : x,
        );
      setPosts(aplicar);
      setDoPerfil(aplicar);
      setSugestoes(aplicar);
      setOPost((x) => (x ? aplicar([x])[0] : x));
      return true;
    } catch {
      return false;
    }
  }

  async function sugerirLegenda(foto: string): Promise<string[]> {
    const t = await token();
    if (!t) return [];
    const menor = await reduzirParaIA(foto);
    if (!menor) return [];
    try {
      const r = await fetch("/api/legenda-da-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ foto: menor }),
      });
      const dados = (await r.json().catch(() => null)) as {
        ok?: boolean;
        sugestoes?: string[];
      } | null;
      if (!r.ok || !dados?.ok) return [];
      return dados.sugestoes ?? [];
    } catch {
      return [];
    }
  }

  async function token() {
    const { supabase } = await import("@/integrations/supabase/client");
    const s = await supabase.auth.getSession();
    return s.data.session?.access_token ?? null;
  }

  async function carregarFeed() {
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/rede-social.functions");
      /* Feed e stories em PARALELO: são duas consultas independentes, e em
         série a fileira só apareceria depois de o feed inteiro chegar. */
      const [r, st, meu, at] = await Promise.all([
        mod.meuFeed({ data: { accessToken: t } }),
        mod.storiesDoFeed({ data: { accessToken: t } }),
        mod.meuPerfilSocial({ data: { accessToken: t } }),
        /* ⚠️ A atividade vem JUNTO, e não quando ela toca no ♡: o emblema é o
           que faz alguém tocar. Buscando só na abertura da caixa, o coração
           nasceria sempre sem número e a caixa só seria aberta por acaso. */
        mod.minhaAtividade({ data: { accessToken: t } }),
      ]);
      if (r.ok) {
        setPosts(r.posts);
        setProximo(r.proximo);
      }
      if (st.ok) setBolhas(st.bolhas);
      if (meu.ok) {
        setEuId(meu.perfil.id);
        setMeuAvatar(meu.perfil.avatarUrl ?? null);
        setSemanaDoCarimbo(meu.semanaDoCarimbo);
      }
      if (at.ok) {
        setAvisos(at.itens);
        setNaoVistas(at.novas);
      }
      /* ⚠️ Guardado só quando o FEED veio: com `r.ok` falso o cache gravaria
         uma tela vazia e a próxima volta pintaria "nada por aqui" na hora,
         sobre uma conta que tem publicações. */
      if (r.ok) {
        guardarNoCache(CHAVE_DO_FEED, {
          posts: r.posts,
          proximo: r.proximo,
          bolhas: st.ok ? st.bolhas : [],
          avisos: at.ok ? at.itens : [],
          naoVistas: at.ok ? at.novas : 0,
          euId: meu.ok ? meu.perfil.id : null,
          meuAvatar: meu.ok ? (meu.perfil.avatarUrl ?? null) : null,
          semanaDoCarimbo: meu.ok ? meu.semanaDoCarimbo : null,
        } satisfies CacheDoFeed);
      }
      void carregarDesafio();
      void carregarCaixinha();
    } catch {
      /* Feed vazio é melhor que erro: ela não veio buscar um erro. */
    } finally {
      setCarregando(false);
    }
  }

  /**
   * A CAIXINHA.
   *
   * ⚠️ Carregada JUNTO com o feed pelo mesmo motivo da atividade: o emblema é o
   * que faz alguém abrir. Buscando só na abertura da caixa, a bolinha nasceria
   * sempre sem número e a caixa só seria aberta por acaso — que é como uma
   * pergunta fica dias sem resposta numa caixa cujo dono não sabe que ela tem
   * algo dentro.
   */
  async function carregarCaixinha() {
    try {
      const t = await token();
      if (!t) return;
      const { minhaCaixinha } = await import("@/lib/caixinha.functions");
      const r = await minhaCaixinha({ data: { accessToken: t } });
      if (!r.ok) return;
      setPerguntasDaCaixa(r.perguntas);
      setCaixaAberta(r.aceita);
      setNaCaixa(r.novas);
    } catch {
      /* Sem a caixa ela perde a caixa, não a aba. */
    }
  }

  async function alternarCaixa(aberta: boolean) {
    const t = await token();
    if (!t) return;
    const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
    const r = await salvarPerfilSocial({ data: { accessToken: t, aceitaPerguntas: aberta } });
    const { toast } = await import("sonner");
    if (!r.ok) {
      toast.error("Não deu para mudar agora. Tente de novo.");
      return;
    }
    /* ⚠️ `parcial` = o banco não tem a coluna, e o recuo salvou só o resto.
       Acender a chave aqui faria a tela afirmar que a caixa está aberta
       enquanto o servidor recusa toda pergunta. */
    if ("parcial" in r && r.parcial) {
      toast.error("A caixinha ainda não está pronta no servidor.");
      return;
    }
    setCaixaAberta(aberta);
  }

  /**
   * Perguntar para outra pessoa.
   *
   * ⚠️ **Devolve o desfecho do SERVIDOR, cru.** A tela desenha o recado a
   * partir dele; decidir aqui qual das três coisas aconteceu seria uma segunda
   * régua clínica no navegador, e ela discordaria da primeira no dia em que uma
   * das listas mudasse.
   */
  /**
   * O envio, uma vez só, para as DUAS portas (o perfil e o story).
   *
   * ⚠️ **O texto da recusa vem do SERVIDOR.** Escrevê-lo aqui seria uma segunda
   * régua: a tela diria "você já mandou bastante hoje" para um teto POR PESSOA,
   * que é outra coisa — e divergiria no primeiro ajuste.
   */
  async function enviarPergunta(
    donaId: string,
    texto: string,
    storyId?: string,
  ): Promise<{ ok: true; desfecho: DesfechoDaPergunta } | { ok: false; recado: string }> {
    const generico = "Não deu para enviar agora. Tente de novo.";
    try {
      const t = await token();
      if (!t) return { ok: false as const, recado: generico };
      const { perguntar } = await import("@/lib/caixinha.functions");
      /* ⚠️ `storyId` é o CONSENTIMENTO daquela publicação — sem ele o servidor
         cai na chave permanente do perfil, que nasce desligada, e a caixinha
         que ela acabou de abrir no story recusaria todo mundo. */
      const r = await perguntar({ data: { accessToken: t, donaId, texto, storyId } });
      if (!r.ok) {
        return { ok: false as const, recado: (("recado" in r && r.recado) || generico) as string };
      }
      return { ok: true as const, desfecho: r.desfecho };
    } catch {
      return { ok: false as const, recado: generico };
    }
  }

  async function perguntarPara(donaId: string, texto: string): Promise<DesfechoDaPergunta | null> {
    const r = await enviarPergunta(donaId, texto);
    if (r.ok) return r.desfecho;
    const { toast } = await import("sonner");
    toast.error(r.recado);
    return null;
  }

  /** Responder. `null` = publicou; string = a recusa, com o recado do servidor. */
  async function responderDaCaixa(
    id: string,
    resposta: string,
    visibilidade: Visibilidade,
  ): Promise<string | null> {
    try {
      const t = await token();
      if (!t) return "Sua sessão expirou. Entre de novo.";
      const { responderPergunta } = await import("@/lib/caixinha.functions");
      const r = await responderPergunta({
        data: { accessToken: t, perguntaId: id, resposta, visibilidade },
      });
      if (!r.ok) {
        return ("recado" in r && r.recado) || "Não deu para publicar agora. Tente de novo.";
      }
      /* A caixa e o FEED, os dois: a resposta virou post, e não vê-lo aparecer
         faria ela publicar de novo. */
      await carregarCaixinha();
      void carregarFeed();
      return null;
    } catch {
      return "Não deu para publicar agora. Tente de novo.";
    }
  }

  async function denunciarPost(post: PostNaTela, motivo: MotivoDaDenuncia) {
    /* Some da tela na hora, como o apagar: ela acabou de denunciar, e um post
       que continua ali lê como "não foi". */
    setPosts((ps) => ps.filter((x) => x.id !== post.id));
    setSugestoes((ps) => ps.filter((x) => x.id !== post.id));
    if (onde.t === "post") setOnde({ t: "feed" });
    try {
      const t = await token();
      if (!t) return;
      const { denunciarPost: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({ data: { accessToken: t, postId: post.id, motivo } });
      const { toast } = await import("sonner");
      if (r.ok) toast.success("Denunciada. A gente vai olhar.");
      else toast.error("Não deu para denunciar agora.");
    } catch {
      /* Ela vê o post voltar na próxima carga. */
    }
  }

  /**
   * Denunciar um PERFIL.
   *
   * ⚠️ **Não some da tela, ao contrário do post denunciado.** Denunciar um
   * perfil não é dizer "não quero mais ver" — para isso existe bloquear, que é
   * outro botão a dois toques dali. Sumir com o perfil aqui faria a paciente
   * achar que denunciar bloqueia, e ela deixaria de usar o botão certo.
   */
  /**
   * Silenciar, ou voltar a ouvir.
   *
   * ⚠️ **O feed é recarregado, e o perfil aberto NÃO muda.** Silenciar tira do
   * feed; a tela em que ela está é o perfil da pessoa, e sumir com o que está
   * ali no momento do toque faria "silenciar" parecer "bloquear" — que é
   * exatamente a confusão que este botão existe para desfazer.
   */
  async function silenciarPerfil(alvoId: string, calar: boolean) {
    setPerfil((p) => (p && p.id === alvoId ? { ...p, silenciado: calar } : p));
    try {
      const t = await token();
      if (!t) return;
      const { silenciar } = await import("@/lib/rede-social.functions");
      const r = await silenciar({ data: { accessToken: t, alvoId, silenciar: calar } });
      const { toast } = await import("sonner");
      if (r.ok) {
        toast.success(calar ? "Silenciada. Ela não é avisada." : "Voltou para o seu feed.");
        void carregarFeed();
      } else {
        setPerfil((p) => (p && p.id === alvoId ? { ...p, silenciado: !calar } : p));
        toast.error("Não deu para mudar agora.");
      }
    } catch {
      setPerfil((p) => (p && p.id === alvoId ? { ...p, silenciado: !calar } : p));
    }
  }

  async function denunciarUmPerfil(alvoId: string, motivo: MotivoDaDenuncia) {
    try {
      const t = await token();
      if (!t) return;
      const { denunciarPerfil } = await import("@/lib/rede-social.functions");
      const r = await denunciarPerfil({ data: { accessToken: t, alvoId, motivo } });
      const { toast } = await import("sonner");
      if (r.ok) toast.success("Denunciado. A gente vai olhar.");
      else toast.error("Não deu para denunciar agora.");
    } catch {
      /* silencioso: a tela não mudou, então não há o que desfazer */
    }
  }

  async function removerSeguidor(quemId: string) {
    /* ⚠️ Some da lista na hora, e o CONTADOR do perfil desce junto: o número
       vive em `perfil.meusSeguidores`, e sem isto a lista mostraria 11 pessoas
       embaixo de um "12 seguidores". */
    setGente((g) => g.filter((p) => p.id !== quemId));
    setPerfil((p) =>
      p && p.meusSeguidores != null
        ? { ...p, meusSeguidores: Math.max(0, p.meusSeguidores - 1) }
        : p,
    );
    try {
      const t = await token();
      if (!t) return;
      const { removerSeguidor: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, quemId } });
    } catch {
      /* A próxima abertura da lista corrige. */
    }
  }

  async function arquivarDaCaixa(id: string) {
    const t = await token();
    if (!t) return;
    const { arquivarPergunta } = await import("@/lib/caixinha.functions");
    const r = await arquivarPergunta({ data: { accessToken: t, perguntaId: id } });
    if (r.ok) await carregarCaixinha();
  }

  async function denunciarDaCaixa(id: string, bloquear: boolean) {
    const t = await token();
    if (!t) return;
    const { denunciarPergunta } = await import("@/lib/caixinha.functions");
    const r = await denunciarPergunta({ data: { accessToken: t, perguntaId: id, bloquear } });
    const { toast } = await import("sonner");
    /* ⚠️ O aviso NUNCA nomeia ninguém — a caixa é anônima, e um "bloqueamos
       Fulana" aqui devolveria por texto o que o servidor recusou por campo. */
    if (r.ok) toast.success(bloquear ? "Denunciada e bloqueada." : "Denunciada.");
    else toast.error("Não deu para concluir agora. Tente de novo.");
    await carregarCaixinha();
  }

  useEffect(() => {
    if (careMode) {
      setCarregando(false);
      return;
    }
    /* ⚠️ **MOSTRA O VELHO, BUSCA O NOVO.** As abas de `minha-conta` são
       montadas com `{tab === "X" && <X/>}` — o que é bom (aba fora da tela não
       custa render) e tem um preço que ninguém tinha pago: trocar de aba
       DESMONTA este componente e joga o estado fora. Ir ao Bebê e voltar
       refazia o feed inteiro, e a paciente esperava de novo por uma tela que
       ela viu dez segundos atrás. É a metade da lentidão que mais irrita: não é
       a primeira abertura, é a quinta. */
    const guardado = lerDoCache<CacheDoFeed>(CHAVE_DO_FEED);
    if (guardado) {
      setPosts(guardado.posts);
      setProximo(guardado.proximo);
      setBolhas(guardado.bolhas);
      setAvisos(guardado.avisos);
      setNaoVistas(guardado.naoVistas);
      setEuId(guardado.euId);
      setMeuAvatar(guardado.meuAvatar);
      setSemanaDoCarimbo(guardado.semanaDoCarimbo);
      setCarregando(false);
    }
    void carregarFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode]);

  /* O feed acabou (não há página seguinte) → a zona de sugestões pode nascer.
     Também cobre a conta NOVA, em que o feed nasce vazio e `proximo` é `null`:
     ali a fileira de pessoas é a única coisa útil na tela. */
  useEffect(() => {
    if (careMode || carregando || proximo) return;
    void carregarSugestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode, carregando, proximo]);

  /**
   * A zona de sugestões.
   *
   * ⚠️ **Pedido à parte, e só quando o feed de quem ela segue acabou.** Junto
   * com o feed, ela pagaria a consulta mais cara da tela em toda abertura — e
   * quem tem muita gente para ler nunca chega no fim para vê-la. E uma vez só
   * por visita: `carregadas` guarda o pedido feito, não o resultado, porque um
   * resultado vazio é resposta legítima (base pequena, ela já segue todo mundo)
   * e sem isso a tela pediria de novo a cada rolagem.
   */
  /**
   * O desafio da semana, e o bônus.
   *
   * ⚠️ **A cobrança roda JUNTO com a leitura**, e é idempotente: a chave carrega
   * o desafio e a pessoa, e `cobrarBonusDoDesafio` só paga o VIGENTE — ligar o
   * recurso não retroage. É o mesmo desenho de `cobrarBonusDaDupla`, que passou
   * meses só pagando quem abria a aba Amigas.
   */
  async function carregarDesafio() {
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/desafio-em-grupo.functions");
      const [r] = await Promise.all([
        mod.meuDesafioDaSemana({ data: { accessToken: t } }),
        mod.cobrarBonusDoDesafio({ data: { accessToken: t } }).catch(() => null),
      ]);
      if (r.ok) setDesafio(r.desafio);
    } catch {
      /* Sem desafio a aba fica como estava. */
    }
  }

  async function entrarNoDesafio(entrar: boolean) {
    if (!desafio) return;
    /* Otimista: o cartão responde na hora, e a próxima carga corrige. */
    setDesafio({ ...desafio, souParticipante: entrar });
    try {
      const t = await token();
      if (!t) return;
      const { entrarNoDesafio: chamar } = await import("@/lib/desafio-em-grupo.functions");
      await chamar({ data: { accessToken: t, desafioId: desafio.id, entrar } });
      await carregarDesafio();
    } catch {
      void carregarDesafio();
    }
  }

  async function carregarSugestoes(fase = mesmaFase) {
    /* ⚠️ A trava é de PRIMEIRA CARGA, e trocar o filtro precisa furá-la: sem
       isso o interruptor mudaria a chave e a lista continuaria a mesma, que é
       um botão que não faz nada. */
    if (sugestoesPedidas.current && fase === mesmaFase) return;
    sugestoesPedidas.current = true;
    try {
      const t = await token();
      if (!t) return;
      const { sugestoesDoFeed } = await import("@/lib/rede-social.functions");
      const r = await sugestoesDoFeed({ data: { accessToken: t, mesmaFase: fase } });
      if (!r.ok) return;
      setSugestoes(r.posts);
      setPessoas(r.pessoas);
    } catch {
      /* Sem sugestão a tela fica só com o feed dela, que é o estado normal de
         quem já segue todo mundo. */
    }
  }

  async function seguirPessoa(alvoId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { seguir: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, alvoId } });
      /* ⚠️ NÃO recarrega o feed aqui. O post dela só passa a valer no próximo
         carregamento, e refazer a lista embaixo do dedo tiraria da tela o que
         ela estava lendo. A fileira já mostra "Seguindo". */
    } catch {
      /* O botão volta ao normal na próxima abertura. */
    }
  }

  async function maisAntigas() {
    if (!proximo || buscandoMais.current) return;
    buscandoMais.current = true;
    try {
      const t = await token();
      if (!t) return;
      const { meuFeed } = await import("@/lib/rede-social.functions");
      const r = await meuFeed({ data: { accessToken: t, antesDe: proximo } });
      if (!r.ok) return;
      /* ⚠️ Junta SEM REPETIR por id. A régua filtra depois de ler, então duas
         páginas podem se sobrepor — e uma chave repetida no React derruba a
         lista inteira, não só o item. */
      setPosts((ps) => {
        const vistos = new Set(ps.map((p) => p.id));
        return [...ps, ...r.posts.filter((p) => !vistos.has(p.id))];
      });
      setProximo(r.proximo);
    } catch {
      /* Fica onde está; a sentinela tenta de novo na próxima rolagem. */
    } finally {
      buscandoMais.current = false;
    }
  }

  /**
   * O QUE A TELA JÁ SABE sobre quem publicou, sem perguntar ao servidor.
   *
   * ⚠️ **Ela procura nas listas que já estão em memória** — feed, sugeridos,
   * grade do perfil aberto, salvos, gaveta, fileira de stories, lista de gente
   * e caixa de atividade. Todos esses já DESENHARAM o nome e a foto da pessoa
   * na tela anterior, então reaproveitá-los não revela nada novo: é a mesma
   * informação, para a mesma pessoa, no mesmo instante.
   *
   * ⚠️ E `aoAbrirPerfil` continua recebendo só o `id`. Passar a prévia por prop
   * obrigaria a mudar as seis chamadas e, pior, criaria fecho novo a cada
   * pintura em `acoes` — que é exatamente o que faz `memo()` nunca acertar e o
   * feed inteiro repintar a cada reação (o defeito já custou 232 ms aqui).
   */
  function previaDoAutor(id: string): PreviaDoAutor | null {
    for (const lista of [posts, sugestoes, doPerfil, salvos, arquivados]) {
      const p = lista.find((x) => x.autorId === id);
      if (p) return { id, nome: p.autorNome, avatarUrl: p.autorAvatar, oficial: p.autorOficial };
    }
    for (const lista of [pessoas, gente]) {
      const g = lista.find((x) => x.id === id);
      if (g) return { id, nome: g.nome, avatarUrl: g.avatarUrl, oficial: g.oficial };
    }
    const b = bolhas.find((x) => x.autorId === id);
    if (b) return { id, nome: b.autorNome, avatarUrl: b.autorAvatar };
    const a = avisos.find((x) => x.quemId === id);
    if (a) return { id, nome: a.quemNome, avatarUrl: a.quemAvatar ?? null };
    return null;
  }

  async function abrirPerfil(id: string) {
    setPerfil(null);
    /* ⚠️ O ESBOÇO ANTES DA IDA AO SERVIDOR. Sem ele, `onde.t === "perfil"` com
       `perfil` nulo não casava com ramo nenhum e a árvore caía de volta no
       FEED: a paciente tocava no avatar e a tela não mudava, por segundos. */
    setEsboco(esbocoDoAutor(previaDoAutor(id)));
    setOnde({ t: "perfil", id });
    /* ⚠️ **MOSTRA O GUARDADO E BUSCA O NOVO.** Reabrir o mesmo perfil pagava as
       dez esperas outra vez — e "abrir, voltar, abrir de novo" é o padrão real
       de quem está olhando o feed. Com o guardado, a segunda abertura é
       instantânea; a busca continua acontecendo por trás e corrige o que mudou.

       ⚠️ A janela é mais curta que a do feed (45 s): o que está aqui é bio,
       selo, nome do bebê e as publicações dela — e se ela BLOQUEAR quem está
       olhando entre uma abertura e a outra, o guardado mostraria por um instante
       um perfil que já não pode ser visto. A janela é o tamanho do estrago. */
    const chave = chaveDoPerfil(id);
    const guardado = lerDoCache<{
      perfil: PerfilNaTela;
      posts: PostNaTela[];
      proximo: string | null;
    }>(chave, Date.now(), VALIDADE_DO_PERFIL_MS);
    if (guardado) {
      setPerfil(guardado.perfil);
      setDoPerfil(guardado.posts);
      setProximoDoPerfil(guardado.proximo);
    }
    try {
      const t = await token();
      /* ⚠️ Sem sessão a espera não acaba nunca: o esqueleto ficaria na tela para
         sempre, que é pior que o defeito que ele veio consertar. */
      if (!t) return void setOnde({ t: "feed" });
      const { verPerfil } = await import("@/lib/rede-social.functions");
      const r = await verPerfil({ data: { accessToken: t, alvoId: id } });
      if (r.ok) {
        setPerfil(r.perfil);
        setDoPerfil(r.posts);
        setProximoDoPerfil(r.proximo);
        guardarNoCache(chave, { perfil: r.perfil, posts: r.posts, proximo: r.proximo });
      } else {
        /* `indisponivel` cobre bloqueio, Modo Cuidado e perfil inexistente com
           a mesma resposta — e a tela não conta qual foi.
           ⚠️ E o guardado É APAGADO: sem isto, a entrada continuaria válida pelo
           resto da janela e a tela voltaria a pintá-la na próxima abertura,
           depois de o servidor já ter dito não. */
        esquecerDoCache(chave);
        setOnde({ t: "feed" });
      }
    } catch {
      setOnde({ t: "feed" });
    }
  }

  /**
   * A PRÓXIMA PÁGINA DA GRADE DO PERFIL.
   *
   * ⚠️ **É a MESMA `verPerfil`, com o cursor** — e não uma função que só busca
   * posts. Uma segunda função teria de repetir o portão de alcance, e um portão
   * duplicado é um portão que um dia diverge: aqui a divergência apareceria como
   * back door para ler as publicações de um perfil que a régua recusa.
   *
   * ⚠️ **A trava é `useRef`, e não `useState`.** A sentinela pode disparar duas
   * vezes no mesmo tranco de rolagem, e um estado só valeria no render seguinte
   * — as duas chamadas sairiam. É a mesma trava da paginação do feed.
   */
  async function maisDoPerfil() {
    if (!proximoDoPerfil || buscandoDoPerfil.current) return;
    const alvo = onde.t === "perfil" ? onde.id : null;
    if (!alvo) return;
    buscandoDoPerfil.current = true;
    try {
      const t = await token();
      if (!t) return;
      const { verPerfil } = await import("@/lib/rede-social.functions");
      const r = await verPerfil({
        data: { accessToken: t, alvoId: alvo, antesDe: proximoDoPerfil },
      });
      if (!r.ok) return;
      /* ⚠️ Junta SEM repetir por id: a régua filtra depois de ler, e duas
         páginas podem se sobrepor — chave repetida derruba a lista inteira no
         React. É a mesma junção da paginação do feed. */
      setDoPerfil((ps) => {
        const vistos = new Set(ps.map((p) => p.id));
        return [...ps, ...r.posts.filter((p) => !vistos.has(p.id))];
      });
      setProximoDoPerfil(r.proximo);
    } catch {
      /* Fica onde está; a sentinela tenta de novo na próxima rolagem. */
    } finally {
      buscandoDoPerfil.current = false;
    }
  }

  async function abrirLista(tipo: "seguidores" | "seguindo") {
    setGente([]);
    setOnde({ t: "lista", tipo });
    try {
      const t = await token();
      if (!t) return;
      const { listaDeGente } = await import("@/lib/rede-social.functions");
      const r = await listaDeGente({ data: { accessToken: t, tipo } });
      if (r.ok) setGente(r.gente);
    } catch {
      /* Lista vazia; a tela já diz "ninguém por aqui ainda". */
    }
  }

  async function abrirPost(id: string) {
    setOPost(null);
    setOnde({ t: "post", id });
    try {
      const t = await token();
      if (!t) return;
      const { verPost } = await import("@/lib/rede-social.functions");
      const r = await verPost({ data: { accessToken: t, postId: id } });
      if (r.ok) setOPost(r.post);
      else setOnde({ t: "feed" });
    } catch {
      setOnde({ t: "feed" });
    }
  }

  async function reagir(post: PostNaTela, tipo: TipoDeReacao | null) {
    const aplicar = (ps: PostNaTela[]) =>
      ps.map((p) => {
        if (p.id !== post.id) return p;
        const c = { ...p.reacoes };
        if (p.minhaReacao) c[p.minhaReacao] = Math.max(0, (c[p.minhaReacao] ?? 1) - 1);
        if (tipo) c[tipo] = (c[tipo] ?? 0) + 1;
        return { ...p, reacoes: c, minhaReacao: tipo };
      });
    setPosts(aplicar);
    setDoPerfil(aplicar);
    /* ⚠️ **`sugestoes` é uma QUARTA lista, e ela era esquecida aqui e em
       `guardar`.** `votar`, logo abaixo, lembra — e a divergência era invisível
       na bancada, porque os handlers de mentira dela não têm estado. Na zona
       "Publicações sugeridas" o servidor gravava e a tela não mudava: ela
       tocava no coração e nada acontecia. */
    setSugestoes(aplicar);
    setOPost((p) => (p ? aplicar([p])[0] : p));
    try {
      const t = await token();
      if (!t) return;
      const { reagir: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, postId: post.id, tipo } });
    } catch {
      void carregarFeed();
    }
  }

  async function seguir() {
    if (!perfil || perfil.souEu) return;
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/rede-social.functions");
      if (perfil.meuVinculo === "ativo") {
        await mod.deixarDeSeguir({ data: { accessToken: t, alvoId: perfil.id } });
        setPerfil({ ...perfil, meuVinculo: null });
      } else if (!perfil.meuVinculo) {
        const r = await mod.seguir({ data: { accessToken: t, alvoId: perfil.id } });
        if (r.ok) setPerfil({ ...perfil, meuVinculo: r.estado });
      }
    } catch {
      /* O botão volta ao estado real na próxima abertura do perfil. */
    }
  }

  async function salvarPerfil(m: {
    nome?: string;
    bio?: string | null;
    avatar?: string | null;
  }): Promise<boolean> {
    try {
      const t = await token();
      if (!t) return false;
      const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await salvarPerfilSocial({ data: { accessToken: t, ...m } });
      if (!r.ok) return false;
      /* Recarrega do servidor em vez de aplicar o que eu mandei: a foto volta
         como URL ASSINADA do balde, e não como a data URL que subiu — pintar a
         data URL aqui deixaria a tela certa e o banco diferente. */
      if (perfil) await abrirPerfil(perfil.id);
      return true;
    } catch {
      return false;
    }
  }

  async function publicar(p: {
    /** Quem estava junto — o servidor confere cada id. */
    marcadas: string[];
    /** O post antigo que vira a primeira foto do "então e agora". */
    comparacaoCom: string | null;
    texto: string | null;
    fotos: string[];
    /** A versão de 480px da primeira foto. `null` é normal — ver `miniatura.ts`. */
    miniatura?: string | null;
    visibilidade: Visibilidade;
    enquete: string[];
    aula: AulaNoPost | null;
  }): Promise<boolean> {
    try {
      const t = await token();
      if (!t) return false;
      const { publicarPost } = await import("@/lib/rede-social.functions");
      const r = await publicarPost({
        data: {
          accessToken: t,
          texto: p.texto,
          /* A PRIMEIRA vai em `imagem` e as demais em `extras` — é a forma do
             servidor, que guardou a capa numa coluna própria desde antes de o
             carrossel existir. */
          imagem: p.fotos[0] ?? null,
          miniatura: p.miniatura ?? null,
          extras: p.fotos.slice(1),
          visibilidade: p.visibilidade,
          enquete: p.enquete,
          aula: p.aula,
          marcadas: p.marcadas,
          comparacaoCom: p.comparacaoCom ?? undefined,
        },
      });
      if (!r.ok) {
        /* ⚠️ **O recado da régua clínica precisa CHEGAR.** Sem ele, quem
           escreveu "não precisa ir ao pronto-socorro" recebe um "não deu para
           publicar" genérico, reescreve a mesma frase e tenta de novo para
           sempre. O texto vem do SERVIDOR — decidir aqui por que foi recusado
           seria uma segunda régua clínica no navegador. */
        if ("recado" in r && r.recado) {
          const { toast } = await import("sonner");
          toast.error(r.recado, { duration: 7000 });
        }
        return false;
      }
      /* Recarrega em vez de enfiar o post na lista: a URL da foto volta
         ASSINADA do balde, e a data URL que subiu não é a que o feed mostra. */
      await carregarFeed();
      return true;
    } catch {
      return false;
    }
  }

  async function apagar(post: PostNaTela) {
    /* Some da tela na hora, das TRÊS listas: ela acabou de mandar apagar, e um
       post que continua ali por meio segundo lê como "não apagou". */
    setPosts((ps) => ps.filter((x) => x.id !== post.id));
    setDoPerfil((ps) => ps.filter((x) => x.id !== post.id));
    setSalvos((ps) => ps.filter((x) => x.id !== post.id));
    if (onde.t === "post") setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" });
    try {
      const t = await token();
      if (!t) return;
      const { apagarPost } = await import("@/lib/rede-social.functions");
      const r = await apagarPost({ data: { accessToken: t, postId: post.id } });
      if (!r.ok) await carregarFeed();
    } catch {
      void carregarFeed();
    }
  }

  async function votar(post: PostNaTela, opcao: number) {
    if (!post.enquete || post.enquete.meuVoto !== null) return;
    /* Otimista: o voto é o gesto mais leve da tela, e esperar o servidor faz o
       botão parecer travado. Se falhar, a próxima carga corrige. */
    const aplicar = (ps: PostNaTela[]) =>
      ps.map((x) => {
        if (x.id !== post.id || !x.enquete) return x;
        const votos = [...x.enquete.votos];
        votos[opcao] = (votos[opcao] ?? 0) + 1;
        return { ...x, enquete: { ...x.enquete, votos, meuVoto: opcao } };
      });
    setPosts(aplicar);
    setDoPerfil(aplicar);
    setSugestoes(aplicar);
    setOPost((x) => (x ? aplicar([x])[0] : x));
    try {
      const t = await token();
      if (!t) return;
      const { votar: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, postId: post.id, opcao } });
    } catch {
      void carregarFeed();
    }
  }

  async function guardar(post: PostNaTela, salvar: boolean) {
    const aplicar = (ps: PostNaTela[]) =>
      ps.map((x) => (x.id === post.id ? { ...x, salvo: salvar } : x));
    setPosts(aplicar);
    setDoPerfil(aplicar);
    /* ⚠️ E a zona de SUGERIDOS também, que ficava de fora: o servidor gravava
       e o marcador do cartão não mudava. Salvar a publicação de uma
       desconhecida é justamente o gesto que a zona existe para provocar, e a
       tela respondia como se nada tivesse acontecido. */
    setSugestoes(aplicar);
    setOPost((x) => (x ? aplicar([x])[0] : x));
    /* Tirar dos salvos com a lista aberta some da lista; guardar não a
       preenche, porque a lista vem ordenada do servidor. */
    if (!salvar) setSalvos((ps) => ps.filter((x) => x.id !== post.id));
    try {
      const t = await token();
      if (!t) return;
      const { salvarPost } = await import("@/lib/rede-social.functions");
      await salvarPost({ data: { accessToken: t, postId: post.id, salvar } });
    } catch {
      void carregarFeed();
    }
  }

  /**
   * O espelho.
   *
   * ⚠️ Chama a MESMA `verPerfil` da tela real, com `comoVisitante` — nada é
   * montado aqui. E `motivo: "trancado"` não é erro: é a resposta certa para a
   * maioria das pacientes, cujo perfil nasce fechado.
   */
  async function verComo(p: Persona) {
    setPersona(p);
    setPrevia((v) => ({ ...v, carregando: true }));
    try {
      const t = await token();
      if (!t || !euId) return;
      const { verPerfil } = await import("@/lib/rede-social.functions");
      const r = await verPerfil({ data: { accessToken: t, alvoId: euId, comoVisitante: p } });
      if (r.ok) {
        setPrevia({ perfil: r.perfil, posts: r.posts, trancado: false, carregando: false });
      } else {
        setPrevia({
          perfil: null,
          posts: [],
          trancado: r.motivo === "trancado",
          carregando: false,
        });
      }
    } catch {
      setPrevia({ perfil: null, posts: [], trancado: false, carregando: false });
    }
  }

  async function abrirSalvos() {
    setSalvos([]);
    setOnde({ t: "salvos" });
    try {
      const t = await token();
      if (!t) return;
      const { meusSalvos } = await import("@/lib/rede-social.functions");
      const r = await meusSalvos({ data: { accessToken: t } });
      if (r.ok) setSalvos(r.posts);
    } catch {
      /* Lista vazia; a tela já diz "você ainda não guardou nada". */
    }
  }

  async function abrirArquivados() {
    setArquivados([]);
    setOnde({ t: "arquivados" });
    try {
      const t = await token();
      if (!t) return;
      const { meusArquivados } = await import("@/lib/rede-social.functions");
      const r = await meusArquivados({ data: { accessToken: t } });
      if (r.ok) setArquivados(r.posts);
    } catch {
      /* Lista vazia; a tela já diz que ela não tirou nada do ar. */
    }
  }

  /**
   * Trazer de volta.
   *
   * ⚠️ **Some da gaveta NA HORA, e o feed é recarregado.** Sem recarregar, o
   * post volta ao banco e não aparece no feed até a próxima abertura — e ela
   * concluiria que "trazer de volta" não funcionou.
   */
  async function desarquivar(post: PostNaTela) {
    setArquivados((ps) => ps.filter((x) => x.id !== post.id));
    try {
      const t = await token();
      if (!t) return;
      const { desarquivarPost } = await import("@/lib/rede-social.functions");
      await desarquivarPost({ data: { accessToken: t, postId: post.id } });
      void carregarFeed();
    } catch {
      void abrirArquivados();
    }
  }

  async function abrirAtividade() {
    setOnde({ t: "atividade" });
    /* ⚠️ O emblema zera JÁ, sem esperar o servidor: ela está olhando a caixa
       neste instante, e um número que continua aceso enquanto ela lê é o
       número deixando de significar. Se a gravação falhar, ele volta na
       próxima abertura do app — e voltar é melhor que nunca ter zerado. */
    setNaoVistas(0);
    setAvisos((as) => as.map((a) => ({ ...a, visto: true })));
    try {
      const t = await token();
      if (!t) return;
      const { marcarAtividadeVista } = await import("@/lib/rede-social.functions");
      await marcarAtividadeVista({ data: { accessToken: t } });
    } catch {
      /* Fica não vista no banco; a próxima abertura mostra de novo. */
    }
  }

  async function buscar(termo: string): Promise<PessoaNaLista[]> {
    try {
      const t = await token();
      if (!t) return [];
      const { buscarPerfis } = await import("@/lib/rede-social.functions");
      const r = await buscarPerfis({ data: { accessToken: t, termo } });
      if (!r.ok) return [];
      return r.perfis.map((p) => ({
        id: p.id,
        nome: p.nome,
        bio: p.bio,
        avatarUrl: p.avatarUrl,
        sigo: p.meuVinculo,
        souEu: false,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Aplica o código de embaixadora de um perfil.
   *
   * ⚠️ Quem confere tudo é `atribuirInfluenciadora`: e-mail confirmado, código
   * ATIVO, e `ref_code` ainda nulo (com `.is("ref_code", null)` na condição do
   * UPDATE, para o checkout não perder a corrida). A tela não repete nenhuma
   * dessas réguas — uma segunda diria "pronto" sobre o que o servidor recusou.
   */
  async function aplicarCodigo(codigo: string) {
    try {
      const t = await token();
      if (!t) return;
      const { atribuirInfluenciadora } = await import("@/lib/influenciadora.functions");
      const r = await atribuirInfluenciadora({ data: { accessToken: t, codigo } });
      const { toast } = await import("sonner");
      if (r.ok && r.atribuido) {
        toast.success(r.bonus ? `Pronto! +${r.bonus} 🌱 de boas-vindas` : "Pronto 💛");
        /* Recarrega o perfil: a pílula some, porque agora eu tenho código. */
        if (perfil) await abrirPerfil(perfil.id);
      } else if (r.ok && (r as { jaTinha?: boolean }).jaTinha) {
        toast.error("Você já tem um código guardado.");
      } else if (r.ok && (r as { invalido?: boolean }).invalido) {
        toast.error("Esse código não está mais ativo.");
      } else {
        toast.error("Não deu para usar o código agora.");
      }
    } catch {
      /* Nada mudou; o botão continua lá. */
    }
  }

  async function bloquear(alvoId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { bloquear: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({ data: { accessToken: t, alvoId, bloquear: true } });
      if (!r.ok) return;
      /* Volta ao feed e recarrega: bloquear desfaz o seguir nos dois sentidos
         e tira os posts dela da minha vista — ficar no perfil de quem acabei
         de bloquear seria a tela contradizendo o gesto. */
      setOnde({ t: "feed" });
      await carregarFeed();
    } catch {
      /* O perfil continua como está; ela vê que nada mudou e tenta de novo. */
    }
  }

  async function responder(seguidorId: string, aceitar: boolean) {
    setAvisos((as) =>
      as.filter((a) => !(a.especie === "pediu_para_seguir" && a.quemId === seguidorId)),
    );
    try {
      const t = await token();
      if (!t) return;
      const { responderPedido } = await import("@/lib/rede-social.functions");
      await responderPedido({ data: { accessToken: t, seguidorId, aceitar } });
    } catch {
      /* O pedido volta na próxima abertura. */
    }
  }

  async function publicarStory(
    dataUrl: string,
    carimbar: boolean,
    enquete: string[],
    perguntaAberta: boolean,
  ) {
    setConferindoStory(null);
    try {
      const t = await token();
      if (!t) return;
      const { publicarStory: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({
        data: {
          accessToken: t,
          imagem: dataUrl,
          texto: null,
          carimbarSemana: carimbar,
          enquete,
          perguntaAberta,
        },
      });
      if (r.ok) {
        void carregarFeed();
        return;
      }
      /* ⚠️ **A RECUSA PRECISA CHEGAR, e ela era engolida.** O story passa pela
         MESMA régua clínica do post — e o `!r.ok` caía num `if` sem `else`: a
         tela de conferência fechava, a fileira não mudava, e nada dizia nada.
         Ela concluía que o app tinha travado e mandava de novo, com o mesmo
         texto, para sempre. O recado vem do SERVIDOR pela mesma razão do
         publicar: decidir aqui por que foi recusado seria uma segunda régua. */
      const { toast } = await import("sonner");
      toast.error(("recado" in r && r.recado) || "Não deu para publicar o story. Tente de novo.");
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para publicar o story. Tente de novo.");
    }
  }

  /**
   * Quem viu o meu story.
   *
   * ⚠️ **`null` é FALHA e `[]` é "ninguém viu" — e os dois eram a mesma coisa.**
   * Com o 4G oscilando, a folha abria afirmando "Ninguém viu ainda" sobre um
   * story que oito pessoas já tinham visto: a única recompensa de publicar
   * virava a informação errada, sem nada que a distinguisse de uma falha. É a
   * mesma régua de `chavesResgatadas` e de `contarTrofeus` — falha ao LER
   * nunca pode virar "não tem". */
  /**
   * Carrega o código de indicação, uma vez.
   *
   * ⚠️ **Nunca em Modo Cuidado.** A mensagem do convite é escrita na primeira
   * pessoa e diz "na minha gestação": mandá-la é uma afirmação que ela pode não
   * querer mais fazer, e o app não põe essas palavras na boca de quem acabou de
   * perder a gestação. Como o portão mora aqui, nenhuma das duas aparições do
   * cartão precisa lembrar disso.
   */
  useEffect(() => {
    if (careMode) {
      setMeuCodigo(null);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { getReferral } = await import("@/lib/referral.functions");
        const r = await getReferral({ data: { accessToken: t } });
        if (vivo && r.ok) setMeuCodigo(r.code ?? null);
      } catch {
        /* Sem código o cartão não aparece — e é o certo: um convite sem
           indicação não liga ninguém a ninguém. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [careMode]);

  async function quemViu(storyId: string): Promise<PessoaNaLista[] | null> {
    try {
      const t = await token();
      if (!t) return null;
      const { quemViuMeuStory } = await import("@/lib/rede-social.functions");
      const r = await quemViuMeuStory({ data: { accessToken: t, storyId } });
      return r.ok ? r.gente : null;
    } catch {
      return null;
    }
  }

  async function apagarStory(storyId: string) {
    /* Fecha o visor na hora: continuar olhando o story que ela acabou de mandar
       apagar é a tela contradizendo o gesto. */
    setVendoStory(null);
    try {
      const t = await token();
      if (!t) return;
      const { apagarStory: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, storyId } });
    } catch {
      /* Continua lá; a fileira mostra de novo na próxima abertura. */
    } finally {
      void carregarFeed();
    }
  }

  async function verStory(autorId: string) {
    const b = bolhas.find((x) => x.autorId === autorId);
    /* ⚠️ Tocar na MINHA bolinha sem story nenhum abre o seletor de foto, não
       um visor vazio. É a bolinha do "adicionar", e é assim que publicar um
       story deixa de ser função escondida. */
    if (!b || b.stories.length === 0) {
      if (autorId === euId) arquivoDoStory.current?.click();
      return;
    }
    setVendoStory(b);
  }

  async function marcarVisto(storyId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { marcarStoryVisto } = await import("@/lib/rede-social.functions");
      await marcarStoryVisto({ data: { accessToken: t, storyId } });
      /* O anel apaga na hora, sem esperar recarga — quem acabou de ver não
         deve encontrar o anel aceso ao fechar. */
      setBolhas((bs) =>
        bs.map((b) =>
          b.stories.some((x) => x.id === storyId)
            ? {
                ...b,
                stories: b.stories.map((x) => (x.id === storyId ? { ...x, visto: true } : x)),
                novo: b.stories.some((x) => x.id !== storyId && !x.visto),
              }
            : b,
        ),
      );
    } catch {
      /* Não visto continua não visto; a próxima abertura corrige. */
    }
  }

  /**
   * OS ATALHOS DA ABA — as bolinhas que sobem da barra de baixo.
   *
   * ⚠️ Elas são o que o cabeçalho da tela deixou de ser. O feed abre agora nos
   * stories, e as ações moram a um toque no ícone da Comunidade — pedido do
   * dono: "as funções adicionais devem abrir quando a pessoa está na aba e toca
   * no ícone de novo; aí abrem várias bolinhas pra cima".
   *
   * ⚠️ **Só quando ela está NO FEED.** Dentro de uma tela filha (o perfil de
   * alguém, a busca, o compositor) as bolinhas ofereceriam "Publicar" por cima
   * de uma tela que já é outra coisa — e o botão de fechar dela está ali do
   * lado, na seta.
   *
   * ⚠️ E o `useEffect` depende do EMBLEMA (`naoVistas`): sem ele, o número de
   * atividades novas congelaria no valor da montagem, e a bolinha diria "3"
   * depois de ela ter lido as três.
   */
  useEffect(() => {
    if (onde.t !== "feed") return;
    /* ⚠️ **Em Modo Cuidado as bolinhas NÃO somem — elas encolhem.** Sumindo,
       tocar de novo no ícone da Comunidade não fazia nada e o hub ficava
       inalcançável; sobra a porta para o que `portasDaComunidade` mantém de
       propósito (Amigas, Acompanhante, Álbum). Publicar, buscar, atividade,
       perfil, salvos e caixinha ficam de fora — são a rede em volta. */
    if (careMode) {
      return publicarAtalhos(
        "comunidade",
        onAbrirSecoes
          ? [
              {
                id: "secoes",
                rotulo: "Amigas, álbum…",
                icone: "grade" as const,
                aoTocar: onAbrirSecoes,
              },
            ]
          : [],
      );
    }
    const atalhos: AtalhoDaAba[] = [
      { id: "buscar", rotulo: "Buscar", icone: "buscar", aoTocar: () => setOnde({ t: "busca" }) },
      {
        id: "atividade",
        rotulo: "Atividade",
        icone: "coracao",
        emblema: naoVistas,
        aoTocar: () => void abrirAtividade(),
      },
      { id: "publicar", rotulo: "Publicar", icone: "mais", aoTocar: () => setOnde({ t: "novo" }) },
      {
        id: "perfil",
        rotulo: "Meu perfil",
        icone: "pessoa",
        aoTocar: () => {
          if (euId) void abrirPerfil(euId);
        },
      },
      { id: "salvos", rotulo: "Salvos", icone: "marcador", aoTocar: () => void abrirSalvos() },
      {
        id: "arquivados",
        rotulo: "Arquivados",
        icone: "grade",
        aoTocar: () => void abrirArquivados(),
      },
      {
        id: "caixinha",
        rotulo: "Caixinha",
        icone: "balao",
        /* ⚠️ O emblema conta as SEM RESPOSTA, e não o total: uma caixa com
           quarenta perguntas já respondidas diria "40" para sempre, e o número
           deixaria de significar trabalho. Mesma régua do contador da fita do
           painel. */
        emblema: naCaixa,
        aoTocar: () => setOnde({ t: "caixinha" }),
      },
      ...(onAbrirSecoes
        ? [
            {
              id: "secoes",
              rotulo: "Chá de bebê, álbum…",
              icone: "grade" as const,
              aoTocar: onAbrirSecoes,
            },
          ]
        : []),
    ];
    return publicarAtalhos("comunidade", atalhos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode, onde.t, naoVistas, naCaixa, euId, onAbrirSecoes]);

  /* ⚠️ **ANTES DE QUALQUER `return` ANTECIPADO.** Este `useMemo` estava lá
     embaixo, depois de `if (careMode) return …` e de uma dezena de ramos por
     destino — ou seja, era chamado CONDICIONALMENTE, e a ordem dos hooks mudava
     conforme a tela. É erro de `rules-of-hooks`, não estilo: o React casa hooks
     por POSIÇÃO, e uma ordem que muda entre renders faz um hook ler o estado de
     outro. O eslint pegou; sem ele isso viraria um defeito que só aparece ao
     trocar de tela. */
  /* ⚠️ **`useMemo`, senão o `memo` da fileira nunca acerta.** A lista era
     remontada a cada render do feed — array novo, referência nova, e a fileira
     repintava inteira mesmo sem nada ter mudado. Memoizar o COMPONENTE sem
     estabilizar a PROP é trabalho perdido. */
  const fileira: Story[] = useMemo(
    () => [
      ...(euId && !bolhas.some((b) => b.autorId === euId)
        ? [
            {
              id: euId,
              nome: "Seu story",
              /* ⚠️ **`perfil` é o ÚLTIMO PERFIL ABERTO, e não o meu.** Ele não é
               limpo no voltar, então abrir o perfil da Marina e voltar ao feed
               deixava a primeira bolinha — a "Seu story" — com a foto dela.
               `meuAvatar` é carregado por `meuPerfilSocial`, junto com o feed. */
              avatarUrl: meuAvatar,
              novo: false,
            },
          ]
        : []),
      ...bolhas.map((b) => ({
        id: b.autorId,
        nome: b.autorId === euId ? "Seu story" : b.autorNome,
        avatarUrl: b.autorAvatar,
        novo: b.novo,
      })),
    ],
    [euId, bolhas, meuAvatar],
  );

  /* ⚠️ **`return null` DEIXAVA A ABA EM BRANCO, e sem saída.**
     A barra de baixo abre "Feed", e o único caminho para o hub é o atalho ⊞ que
     esta MESMA tela publica — e o efeito dos atalhos retorna cedo em Modo
     Cuidado. Então a paciente que perdeu a gestação tocava em Comunidade (o
     ícone continua aceso), via uma tela VAZIA, tocava de novo e nada subia. Ela
     conclui que o app quebrou, na semana em que menos tem paciência para isso.

     E `portasDaComunidade` mantém Amigas, Acompanhante e Álbum de propósito —
     "tirá-las seria isolá-la no pior momento" —, então as três ficavam sem
     porta nenhuma. O silêncio tem de ter uma porta. */
  if (careMode) {
    return (
      <div className="px-4 py-10">
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            O feed está em pausa enquanto o Modo Cuidado estiver ligado.
          </p>
          {onAbrirSecoes && (
            <button
              type="button"
              onClick={onAbrirSecoes}
              className="press mt-4 rounded-full border border-border px-5 py-2 text-xs font-semibold text-foreground"
            >
              Ver Amigas, Álbum e Acompanhante
            </button>
          )}
        </div>
      </div>
    );
  }

  /* A conferência vem ANTES de tudo: ela é tela cheia e a escolha já foi feita. */
  if (conferindoStory) {
    return (
      <ConferirStory
        imagem={conferindoStory}
        /* ⚠️ A semana vem do MEU perfil, que a tela já carregou — e `null`
           quando não há o que carimbar (sem DUM, pós-parto, Modo Cuidado). */
        semana={semanaDoCarimbo}
        aoCancelar={() => setConferindoStory(null)}
        aoPublicar={({ carimbar, enquete, perguntaAberta }) =>
          void publicarStory(conferindoStory, carimbar, enquete, perguntaAberta)
        }
      />
    );
  }

  if (vendoStory) {
    return (
      <VisorDeStory
        aoVotarNoStory={votarNoStory}
        aoReagirAoStory={reagirNoStory}
        aoPerguntarNoStory={perguntarNoStory}
        bolha={vendoStory}
        aoFechar={() => setVendoStory(null)}
        aoVer={marcarVisto}
        souEu={vendoStory.autorId === euId}
        aoQuemViu={quemViu}
        aoApagarStory={apagarStory}
      />
    );
  }

  if (onde.t === "novo") {
    return (
      <NovoPost
        aoSugerirLegenda={sugerirLegenda}
        amigasParaMarcar={paraMarcar}
        rascunho={rascunho}
        aoMudarRascunho={guardarRascunho}
        paraComparar={paraComparar}
        entaoInicial={entaoEscolhido}
        momentoInicial={momentoParaPublicar}
        aoFechar={() => {
          setEntaoEscolhido(null);
          setMomentoParaPublicar(null);
          setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" });
        }}
        aoPublicar={publicar}
        aulaDeHoje={aulaDeHoje}
      />
    );
  }

  if (onde.t === "espelho") {
    return (
      <EspelhoDoPerfil
        persona={persona}
        aoTrocarPersona={verComo}
        perfil={previa.perfil}
        posts={previa.posts}
        trancado={previa.trancado}
        carregando={previa.carregando}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
      />
    );
  }

  if (onde.t === "busca") {
    return (
      <TelaDeBusca
        aoVoltar={() => setOnde({ t: "feed" })}
        aoBuscar={buscar}
        aoAbrirPerfil={abrirPerfil}
      />
    );
  }

  if (onde.t === "salvos") {
    return (
      <TelaDosSalvos
        posts={salvos}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoAbrirPost={abrirPost}
      />
    );
  }

  if (onde.t === "arquivados") {
    return (
      <TelaDosArquivados
        posts={arquivados}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoDesarquivar={desarquivar}
      />
    );
  }

  if (onde.t === "caixinha") {
    return (
      <TelaDaCaixinha
        perguntas={perguntasDaCaixa}
        aceita={caixaAberta}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoAlternarCaixa={(v) => void alternarCaixa(v)}
        aoResponder={responderDaCaixa}
        aoArquivar={(id) => void arquivarDaCaixa(id)}
        aoDenunciar={(id, b) => void denunciarDaCaixa(id, b)}
        aoAbrirPost={abrirPost}
      />
    );
  }

  if (onde.t === "atividade") {
    return (
      <TelaDeAtividade
        itens={avisos}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoAbrirPerfil={abrirPerfil}
        aoAbrirPost={abrirPost}
        aoResponder={responder}
      />
    );
  }

  if (onde.t === "editar" && perfil) {
    return (
      <EditarPerfil
        perfil={perfil}
        aoSalvar={salvarPerfil}
        aoFechar={() => setOnde({ t: "perfil", id: perfil.id })}
      />
    );
  }

  if (onde.t === "lista") {
    return (
      <ListaDeGente
        titulo={onde.tipo === "seguidores" ? "Seguidores" : "Seguindo"}
        gente={gente}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoAbrirPerfil={abrirPerfil}
        /* ⚠️ Só em SEGUIDORES: em "Seguindo", quem sai é ela, e para isso já
           existe o botão do perfil. */
        aoRemover={onde.tipo === "seguidores" ? (id) => void removerSeguidor(id) : undefined}
      />
    );
  }

  /* ⚠️ **O MESMO defeito da tela do perfil, na tela do post.** `onde.t ===
     "post"` sem `oPost` também não casava com ramo nenhum: tocar num quadrado
     da grade deixava a tela parada até a resposta chegar. Aqui o esqueleto é
     só a moldura — a foto e a legenda são exatamente o que o servidor precisa
     dizer se ela pode ver. */
  if (onde.t === "post" && !oPost) {
    return (
      <div className="pb-24">
        <header className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
            aria-label="Voltar"
            className="press -ml-1 flex h-10 w-10 items-center justify-center rounded-full"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="font-semibold">Publicação</p>
        </header>
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <div className="dc-esqueleto h-8 w-8 rounded-full" />
          <div className="dc-esqueleto h-4 w-32 rounded" />
        </div>
        <div className="dc-esqueleto aspect-[4/5] w-full" />
        <div className="space-y-2 px-4 py-3">
          <div className="dc-esqueleto h-4 w-3/4 rounded" />
          <div className="dc-esqueleto h-4 w-1/2 rounded" />
        </div>
        <p className="sr-only" role="status">
          Carregando a publicação
        </p>
      </div>
    );
  }

  if (onde.t === "post" && oPost) {
    return (
      <TelaDoPost
        post={oPost}
        aoReagir={acoes.reagir}
        aoSalvar={acoes.guardar}
        aoVotar={acoes.votar}
        aoApagar={acoes.apagar}
        aoDenunciar={acoes.denunciar}
        aoTirarMarcacao={acoes.tirarMarcacao}
        aoEditar={acoes.editar}
        /* ⚠️ **Faltava, e este é o caminho mais provável do recurso.** A autora
           abre a grade do próprio perfil e toca num post de duas semanas atrás:
           é AQUI que ela quer saber quem reagiu. Sem a prop, o resumo com os
           emojis vinha desenhado como texto morto — ela tocava no número e nada
           acontecia —, e o único caminho vivo era achar o mesmo post rolando o
           feed cronológico, que depois de algumas páginas não existe mais. */
        aoVerQuemReagiu={acoes.verQuemReagiu}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoAbrirPerfil={abrirPerfil}
      />
    );
  }

  /**
   * ⚠️ A TELA DE ESPERA DO PERFIL — e ela é o conserto que o dono pediu.
   *
   * Antes, `onde.t === "perfil"` com `perfil` ainda nulo não casava com ramo
   * nenhum e a árvore caía de volta no FEED. Do lado de quem usa: toca no
   * avatar, a tela não muda, e vários segundos depois salta para o perfil. Isso
   * não lê como "carregando" — lê como "travou", e a reação natural é tocar de
   * novo, o que dispara outra busca e piora o que já estava ruim.
   *
   * ⚠️ O cabeçalho mostra SÓ nome, foto e selo — os três que já estavam
   * desenhados no cartão em que ela tocou. Semana, bebê, bio, contadores e
   * publicações ficam de fora até o servidor responder, porque quem decide o
   * que aparece num perfil é `verPerfil`, cruzando Modo Cuidado, bloqueio e as
   * camadas. Ver `src/lib/esboco-de-perfil.ts`.
   */
  if (onde.t === "perfil" && !perfil) {
    return <PerfilCarregando esboco={esboco} aoVoltar={() => setOnde({ t: "feed" })} />;
  }

  if (onde.t === "perfil" && perfil) {
    return (
      <TelaDePerfil
        perfil={perfil}
        posts={doPerfil}
        aoChegarNoFim={maisDoPerfil}
        temMais={!!proximoDoPerfil}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoSeguir={perfil.souEu ? () => setOnde({ t: "editar" }) : seguir}
        aoAbrirPost={abrirPost}
        aoAbrirLista={perfil.souEu ? abrirLista : undefined}
        aoAbrirSalvos={perfil.souEu ? abrirSalvos : undefined}
        aoAbrirEspelho={
          perfil.souEu
            ? () => {
                setOnde({ t: "espelho" });
                void verComo(persona);
              }
            : undefined
        }
        aoBloquear={perfil.souEu ? undefined : () => bloquear(perfil.id)}
        aoDenunciarPerfil={perfil.souEu ? undefined : (m) => void denunciarUmPerfil(perfil.id, m)}
        aoSilenciar={perfil.souEu ? undefined : (v) => void silenciarPerfil(perfil.id, v)}
        aoAplicarCodigo={aplicarCodigo}
        aoPerguntar={(texto) => perguntarPara(perfil.id, texto)}
        /* ⚠️ Bandeira vermelha abre a Central de Emergência — a MESMA que a
           barra de baixo abre, e nunca uma tela nova. Ela avisa o médico e o
           contato dela com localização; um segundo caminho para "socorro"
           divergiria dela no primeiro conserto. */
        aoAbrirSOS={onAbrirSOS}
      />
    );
  }

  if (carregando) return <div className="skeleton h-80 rounded-2xl" />;

  /* A MINHA bolinha entra sempre, mesmo sem story — é o convite para publicar.
     Se o servidor já a devolveu (porque tenho story vivo), ela não é
     duplicada. */

  return (
    <>
      <input
        ref={arquivoDoStory}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          /* ⚠️ `prepararFotoDoStory`, e não `prepararAvatar`: aquele corta um
             QUADRADO de 512px no centro, e o story é 9:16 exibido inteiro. */
          const d = await prepararFotoDoStory(f);
          if (d) setConferindoStory(d);
        }}
      />
      <TelaPrincipal
        posts={posts}
        stories={fileira}
        aoReagir={acoes.reagir}
        aoSalvar={acoes.guardar}
        aoApagar={acoes.apagar}
        aoDenunciar={acoes.denunciar}
        aoVotar={acoes.votar}
        aoTirarMarcacao={acoes.tirarMarcacao}
        aoVerQuemReagiu={acoes.verQuemReagiu}
        aoAbrirPerfil={acoes.abrirPerfil}
        /* ⚠️ Referência estável, como as outras: um fecho por post faria o
           `memo` do cartão nunca acertar — e este é o feed, a lista mais longa
           do app. */
        aoVer={acoes.ver}
        aoChegarNoFim={maisAntigas}
        temMais={!!proximo}
        desafio={desafio}
        live={live}
        mesmaFase={mesmaFase}
        aoTrocarFase={(v) => {
          setMesmaFase(v);
          void carregarSugestoes(v);
        }}
        aoEntrarNoDesafio={entrarNoDesafio}
        aoIrParaOJogo={onIrParaOJogo}
        sugestoes={sugestoes}
        pessoas={pessoas}
        aoSeguirPessoa={seguirPessoa}
        aoTocarStory={verStory}
        convite={{ codigo: meuCodigo }}
        lembreteEntao={lembreteEntao}
        aoCompararAgora={() => {
          if (!lembreteEntao) return;
          setEntaoEscolhido(lembreteEntao.id);
          setLembreteEntao(null);
          setOnde({ t: "novo" });
        }}
        aoDispensarEntao={() => setLembreteEntao(null)}
        retro={retro}
        aoFecharRetro={() => {
          setRetro(null);
          try {
            if (euId) localStorage.setItem(chaveDaRetrospectiva(euId, new Date()), "1");
          } catch {
            /* sem armazenamento: ele volta na próxima abertura, e tudo bem */
          }
        }}
      />
      {/* ⚠️ FORA da `<TelaPrincipal>`: a folha é `fixed` e cobre a tela inteira,
          e dentro da lista ela herdaria o empilhamento do cartão. */}
      {quemReagiu && (
        <FolhaDeQuemReagiu
          gente={quemReagiu.gente}
          carregando={quemReagiu.gente === null}
          aoFechar={() => setQuemReagiu(null)}
          aoAbrirPerfil={(id) => {
            setQuemReagiu(null);
            void abrirPerfil(id);
          }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   EDITAR PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

/** Reduz a foto no celular. Mesmo lado do resto do app. */
const LADO_DO_AVATAR = 512;
async function prepararAvatar(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    /* Corta o QUADRADO CENTRAL antes de reduzir — o avatar é exibido em
       círculo, e uma foto retangular esticada num círculo deforma o rosto. É o
       mesmo recorte de `campo-foto.tsx`. */
    const lado = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - lado) / 2;
    const sy = (bitmap.height - lado) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = LADO_DO_AVATAR;
    canvas.height = LADO_DO_AVATAR;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, LADO_DO_AVATAR, LADO_DO_AVATAR);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

export function EditarPerfil({
  perfil,
  aoSalvar,
  aoFechar,
}: {
  perfil: PerfilNaTela;
  aoSalvar: (m: { nome?: string; bio?: string | null; avatar?: string | null }) => Promise<boolean>;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [bio, setBio] = useState(perfil.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(perfil.avatarUrl);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    const ok = await aoSalvar({
      nome: nome.trim() || undefined,
      bio: bio.trim() || null,
      /* ⚠️ Só manda a foto se ela MUDOU. Reenviar a mesma URL a cada
         salvamento subiria um arquivo novo no balde toda vez, e o antigo
         ficaria órfão lá dentro — cem edições de bio viram cem fotos. */
      avatar: avatar !== perfil.avatarUrl ? avatar : undefined,
    });
    setSalvando(false);
    if (ok) aoFechar();
  }

  return (
    <div>
      <header className="flex h-11 items-center justify-between px-4">
        <button type="button" onClick={aoFechar} className="press text-[15px]">
          Cancelar
        </button>
        <h1 className="text-[16px] font-semibold">Editar perfil</h1>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="press text-[15px] font-semibold text-primary disabled:opacity-50"
        >
          {salvando ? "…" : "Salvar"}
        </button>
      </header>

      <div className="flex flex-col items-center gap-2 py-5">
        <Foto url={avatar} nome={nome} lado={AVATAR_DO_PERFIL} />
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const d = await prepararAvatar(f);
            if (d) setAvatar(d);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => arquivo.current?.click()}
          className="press text-[14px] font-semibold text-primary"
        >
          Trocar foto
        </button>
      </div>

      <div className="space-y-4 px-4">
        <label className="block">
          <span className="text-[12px] text-muted-foreground">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value.slice(0, 60))}
            className="mt-1 w-full border-b border-border bg-transparent pb-1.5 text-[15px] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted-foreground">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, LIMITE_DA_BIO))}
            rows={2}
            className="mt-1 w-full resize-none border-b border-border bg-transparent pb-1.5 text-[15px] outline-none"
          />
          <span className="mt-0.5 block text-right text-[11px] tabular-nums text-muted-foreground">
            {bio.length}/{LIMITE_DA_BIO}
          </span>
        </label>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A LISTA DE GENTE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **ESTE TIPO É UMA SEGUNDA CÓPIA, e ela já mordeu.**
 *
 * `rede-social.functions.ts` exporta um `PessoaNaLista` com o mesmo nome, e é
 * ELE que o servidor devolve. Este aqui é o que a tela declara — e como o nome é
 * igual, acrescentar um campo lá e esquecer daqui não dá erro de importação:
 * dá um `Property does not exist` numa linha distante, que foi exatamente o que
 * aconteceu ao ligar o selo de assinante.
 *
 * Os dois precisam andar juntos. O certo seria a tela importar o do servidor;
 * enquanto isso não acontece, quem mexer num mexe no outro.
 */
export type PessoaNaLista = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  sigo: "ativo" | "pendente" | null;
  souEu: boolean;
  /** A conta oficial do consultório — ver `conta-oficial.ts`. */
  oficial?: boolean;
  /** Assinante ativa — ver `temSeloPremium`. Forma DIFERENTE da oficial. */
  premium?: boolean;
};

export function ListaDeGente({
  titulo,
  gente,
  aoVoltar,
  aoAbrirPerfil,
  aoRemover,
}: {
  titulo: string;
  gente: PessoaNaLista[];
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
  /**
   * Tirar alguém de perto sem bloquear. Só na lista de SEGUIDORES.
   *
   * ⚠️ A saída do meio que faltava: a lista só oferecia "seguir/deixar de
   * seguir", que é sobre quem EU sigo. Para tirar quem me segue, a única opção
   * era bloquear — nuclear, e que a própria tela descreve como reversível.
   */
  aoRemover?: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">{titulo}</h1>
      </header>
      {gente.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Ninguém por aqui ainda.</p>
      ) : (
        <ul>
          {gente.map((p) => (
            <li key={p.id}>
              <div className="flex items-center gap-1 pr-3">
                <button
                  type="button"
                  onClick={() => aoAbrirPerfil?.(p.id)}
                  className="press flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left"
                >
                  <Foto url={p.avatarUrl} nome={p.nome} lado={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold leading-tight">
                      {p.nome}
                    </span>
                    {p.bio && (
                      <span className="block truncate text-[12px] leading-tight text-muted-foreground">
                        {p.bio}
                      </span>
                    )}
                  </span>
                </button>
                {aoRemover && (
                  <button
                    type="button"
                    onClick={() => setConfirmando((c) => (c === p.id ? null : p.id))}
                    aria-label={`Opções de ${p.nome}`}
                    className="press shrink-0 px-2 text-[15px] leading-none text-muted-foreground"
                  >
                    ⋯
                  </button>
                )}
              </div>
              {/* ⚠️ Confirmação em MENSAGEM separada, e dizendo o que acontece —
                  a mesma decisão do cancelar consulta e do bloquear. E a frase
                  diz que é CALADO: sem isso, ela hesita achando que a outra vai
                  ser avisada. */}
              {confirmando === p.id && aoRemover && (
                <div className="mx-4 mb-2 rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-[13px] leading-snug">
                    Tirar {p.nome} dos seus seguidores? Ela deixa de ver o que você publica, e não é
                    avisada.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmando(null);
                        aoRemover(p.id);
                      }}
                      className="press flex-1 rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground"
                    >
                      Tirar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O POST SOZINHO — o que a grade abre
   ══════════════════════════════════════════════════════════════════════════ */

export type QuemReagiu = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  emoji: string;
  /**
   * É o obstetra DELA?
   *
   * ⚠️ **Resolvido no servidor pelo vínculo ATUAL**, e visível SÓ nesta lista,
   * que só a autora abre. Um selo no feed contaria a terceiros que aquela
   * pessoa é a médica dela — e expor um vínculo clínico aos seguidores é
   * exatamente o que o dono proibiu.
   */
  ehMeuMedico?: boolean;
};

/**
 * QUEM REAGIU — a folha.
 *
 * ⚠️ **Uma FOLHA e não uma tela**: ela abre por cima do feed e fecha no mesmo
 * lugar. Trocar de tela para ver quem reagiu tiraria a paciente do post que ela
 * estava lendo, e a volta cairia no topo do feed.
 *
 * ⚠️ **O emoji fica NO AVATAR, num círculo pequeno** — é assim que a informação
 * "quem" e "com quê" vira uma linha só. Numa coluna à parte, o olho lê duas
 * listas.
 */
export function FolhaDeQuemReagiu({
  gente,
  carregando,
  aoFechar,
  aoAbrirPerfil,
}: {
  gente: QuemReagiu[] | null;
  carregando: boolean;
  aoFechar: () => void;
  aoAbrirPerfil?: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal>
      <button
        type="button"
        aria-label="Fechar"
        onClick={aoFechar}
        className="absolute inset-0 bg-foreground/30"
      />
      <div
        className="relative max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-4"
        style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-2 text-[15px] font-semibold">Quem reagiu</h2>

        {carregando && <div className="skeleton h-16 rounded-2xl" />}

        {!carregando && gente && gente.length === 0 && (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            Ninguém ainda. Também tudo bem 💛
          </p>
        )}

        {!carregando &&
          gente?.map((g) => (
            <button
              key={`${g.id}-${g.emoji}`}
              type="button"
              onClick={() => aoAbrirPerfil?.(g.id)}
              className="press flex min-h-[52px] w-full items-center gap-3 text-left"
            >
              <span className="relative shrink-0">
                <Foto url={g.avatarUrl} nome={g.nome} lado={40} />
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-1 grid h-[20px] w-[20px] place-items-center rounded-full bg-card text-[12px] leading-none ring-1 ring-border/70"
                >
                  {g.emoji}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{g.nome}</span>
                {/* ⚠️ O selo é TEXTO e não um emoji de estetoscópio: ele
                    precisa dizer o que é sem depender de o desenho ser
                    reconhecido, e é a informação mais valiosa da lista. */}
                {g.ehMeuMedico && (
                  <span className="block text-[11px] font-semibold leading-tight text-primary">
                    Seu obstetra
                  </span>
                )}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}

export function TelaDoPost({
  post,
  aoReagir,
  aoSalvar,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoTirarMarcacao,
  aoEditar,
  aoVerQuemReagiu,
  aoVoltar,
  aoAbrirPerfil,
}: {
  post: PostNaTela;
  /* As ações carregam o POST — ver a nota de desempenho em `PostInstagram`. */
  aoReagir: (post: PostNaTela, t: TipoDeReacao | null) => void;
  aoSalvar?: (post: PostNaTela, salvar: boolean) => void;
  aoApagar?: (post: PostNaTela) => void;
  /** Denunciar o post de outra pessoa. Ver `PostInstagram`. */
  aoDenunciar?: (post: PostNaTela, motivo: MotivoDaDenuncia) => void;
  aoVotar?: (post: PostNaTela, opcao: number) => void;
  /** Tirar a PRÓPRIA marcação — ver `PostInstagram`. */
  aoTirarMarcacao?: (post: PostNaTela) => void;
  /** Salvar a legenda editada — ver `PostInstagram`. */
  aoEditar?: (post: PostNaTela, texto: string) => Promise<boolean>;
  /** Ver quem reagiu. Só no post DELA. */
  aoVerQuemReagiu?: (post: PostNaTela) => void;
  /** O resumo da semana, ou `null`. Ver `CartaoDaSemana`. */
  retro?: Retrospectiva | null;
  aoFecharRetro?: () => void;
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
}) {
  return (
    <div className="px-4">
      <header className="flex h-11 items-center gap-2">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Publicação</h1>
      </header>
      <PostInstagram
        post={post}
        aoReagir={aoReagir}
        aoSalvar={aoSalvar}
        aoApagar={aoApagar}
        aoDenunciar={aoDenunciar}
        aoVotar={aoVotar}
        aoTirarMarcacao={aoTirarMarcacao}
        aoEditar={aoEditar}
        aoVerQuemReagiu={aoVerQuemReagiu}
        aoAbrirPerfil={aoAbrirPerfil}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O VISOR DE STORY — tela cheia
   ══════════════════════════════════════════════════════════════════════════ */

/** Quanto cada story fica na tela antes de passar sozinho. */
const DURACAO_DO_STORY = 5000;

export function VisorDeStory({
  bolha,
  aoFechar,
  aoVer,
  souEu = false,
  aoQuemViu,
  aoApagarStory,
  aoVotarNoStory,
  aoPerguntarNoStory,
  aoReagirAoStory,
}: {
  bolha: BolhaDeStory;
  aoFechar: () => void;
  aoVer?: (storyId: string) => void;
  /** É o meu story? Só então aparecem "visto por" e a lixeira. */
  souEu?: boolean;
  /** `null` = não deu para ler (nunca "ninguém viu") — ver `quemViu`. */
  aoQuemViu?: (storyId: string) => Promise<PessoaNaLista[] | null>;
  aoApagarStory?: (storyId: string) => void;
  /** Votar na enquete deste story. */
  aoVotarNoStory?: (storyId: string, opcao: number) => void;
  /** Mandar uma pergunta pela caixinha aberta neste story. */
  aoPerguntarNoStory?: (donaId: string, texto: string, storyId: string) => Promise<string | null>;
  /** Reagir a este story. `null` tira a reação. */
  aoReagirAoStory?: (storyId: string, tipo: TipoDeReacao | null) => void;
}) {
  const [i, setI] = useState(0);
  /* O voto que ela acabou de dar, para a tela responder na hora sem esperar a
     rede — a mesma decisão otimista da reação. */
  const [voteiAgora, setVoteiAgora] = useState<Record<string, number>>({});
  /* A reação que ela acabou de dar, para a tela responder sem esperar a rede. */
  const [reagiAgora, setReagiAgora] = useState<Record<string, TipoDeReacao | null>>({});
  const [pergunta, setPergunta] = useState("");
  const [mandando, setMandando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [mandada, setMandada] = useState(false);
  const [pausado, setPausado] = useState(false);
  /** `null` = folha fechada · `"erro"` = não deu para ler · lista = a verdade. */
  const [quemViu, setQuemViu] = useState<PessoaNaLista[] | "erro" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const atual = bolha.stories[i];

  /* ⚠️ Marca como visto ao ENTRAR no story, não ao sair. Quem fecha o app no
     meio já viu aquele — e marcar na saída deixaria o anel aceso para sempre
     em quem sempre fecha antes do fim, que é a maioria. */
  useEffect(() => {
    if (atual) aoVer?.(atual.id);
  }, [atual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* O relógio que passa sozinho. Pausa enquanto o dedo está na tela — é o
     gesto que todo mundo já conhece de segurar para ler. */
  useEffect(() => {
    /* ⚠️ A folha de "visto por" e a confirmação PARAM o relógio. Sem isso o
       story passa por baixo da folha e ela fecha a lista para ler a foto
       seguinte — ou pior, a confirmação de apagar fica em pé sobre um story que
       já não é o que ela mandou apagar. */
    /* ⚠️ **A ENQUETE PAUSA O RELÓGIO enquanto ela não votou** — o comentário do
       bloco da enquete prometia isso e nada o fazia: só a caixinha pausava, no
       `onFocus` do campo. Ler quatro opções e escolher leva mais que os cinco
       segundos do story, e a enquete trocava de foto debaixo do dedo dela.
       Depois do voto o relógio volta: ela já viu o resultado, e travar a tela
       para sempre seria trocar um defeito por outro. As metades de avançar
       continuam funcionando, então nunca há como ficar presa. */
    const enqueteEsperando =
      !!atual?.enquete && (voteiAgora[atual.id] ?? atual.enquete.meuVoto) == null;
    if (pausado || quemViu || confirmando || enqueteEsperando || !atual) return;
    const t = setTimeout(() => {
      if (i + 1 < bolha.stories.length) setI(i + 1);
      else aoFechar();
    }, DURACAO_DO_STORY);
    return () => clearTimeout(t);
  }, [i, pausado, quemViu, confirmando, atual?.id, voteiAgora]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!atual) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      {/* As barrinhas de progresso, uma por story — a assinatura do formato. */}
      <div className="flex gap-1 px-2 pt-2" style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}>
        {bolha.stories.map((s, n) => (
          <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <span
              className="block h-full bg-white"
              style={{
                width: n < i ? "100%" : n === i ? undefined : "0%",
                /* A do ATUAL anima; as passadas ficam cheias e as futuras
                   vazias. `animationPlayState` é o que faz o dedo pausar a
                   barra junto com o relógio — sem isso a barra correria
                   sozinha e chegaria ao fim antes da foto trocar. */
                animation:
                  n === i ? `dc-story-barra ${DURACAO_DO_STORY}ms linear forwards` : undefined,
                /* A barrinha para JUNTO com o relógio — se ela continuasse
                   correndo, chegaria ao fim antes de a foto trocar, que lê
                   como travamento. */
                animationPlayState:
                  pausado ||
                  quemViu ||
                  confirmando ||
                  (!!atual?.enquete && (voteiAgora[atual.id] ?? atual.enquete.meuVoto) == null)
                    ? "paused"
                    : "running",
              }}
            />
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <Foto url={bolha.autorAvatar} nome={bolha.autorNome} lado={30} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
          {bolha.autorNome}
        </span>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="press text-2xl leading-none text-white"
        >
          ×
        </button>
      </div>

      {/* A foto ocupa o resto. `object-contain` e não `cover`: um story é uma
          composição inteira, e cortar as bordas engole texto que a pessoa
          escreveu na foto. */}
      <div className="relative min-h-0 flex-1">
        {atual.imagemUrl && (
          <img src={atual.imagemUrl} alt="" className="h-full w-full object-contain" />
        )}
        {atual.texto && (
          <p className="absolute inset-x-0 bottom-8 px-6 text-center text-[16px] font-medium text-white drop-shadow-lg">
            {atual.texto}
          </p>
        )}

        {/* ⚠️ O carimbo é DERIVADO na leitura, nunca tinta no JPEG: o banco
            guarda só um booleano. Queimado no pixel, ele sobreviveria à decisão
            dela — o arquivo no balde ficaria com "28 semanas" para sempre, e o
            app não teria como apagá-lo se ela entrasse em Modo Cuidado.

            Ele mora ACIMA do texto (`bottom-20` contra `bottom-8`) para os dois
            nunca se sobreporem: os dois são opcionais e podem coexistir.

            ⚠️ E fica ancorado no CONTÊINER, ao contrário da tela de
            conferência: aqui o visor é preto de ponta a ponta e a pílula sobre
            a tarja continua legível — enquanto lá a tarja é a moldura do
            editor, e o carimbo na moldura em vez de na foto era o defeito. */}
        {atual.carimbo && (
          <span className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-[15px] font-semibold text-white backdrop-blur-sm">
            🤰 {atual.carimbo}
          </span>
        )}

        {/* ⚠️ A ENQUETE E A CAIXINHA vivem ACIMA das metades invisíveis
            (`z-20`): sem isso, tocar numa opção cairia no "avançar story", e a
            enquete seria um desenho que ninguém consegue usar.
            ⚠️ E as duas PAUSAM o relógio enquanto estão na tela — responder uma
            pergunta leva mais que os cinco segundos do story. */}
        {atual.enquete && (
          <div className="absolute inset-x-6 bottom-24 z-20 space-y-2">
            {(() => {
              const meu = voteiAgora[atual.id] ?? atual.enquete!.meuVoto;
              const jaVotou = meu !== null && meu !== undefined;
              const total =
                atual.enquete!.votos.reduce((a, b) => a + b, 0) +
                (voteiAgora[atual.id] != null && atual.enquete!.meuVoto === null ? 1 : 0);
              return atual.enquete!.opcoes.map((op, n) => {
                const votos =
                  (atual.enquete!.votos[n] ?? 0) +
                  (voteiAgora[atual.id] === n && atual.enquete!.meuVoto === null ? 1 : 0);
                const fatia = total > 0 ? Math.round((votos / total) * 100) : 0;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={jaVotou || !aoVotarNoStory}
                    onClick={() => {
                      hapticTap();
                      setVoteiAgora((v) => ({ ...v, [atual.id]: n }));
                      aoVotarNoStory?.(atual.id, n);
                    }}
                    className={`press relative block min-h-[46px] w-full overflow-hidden rounded-full border text-left text-[15px] font-medium text-white backdrop-blur-sm disabled:cursor-default ${
                      meu === n ? "border-white bg-white/25" : "border-white/60 bg-black/35"
                    }`}
                  >
                    {jaVotou && (
                      <span
                        aria-hidden
                        className="dc-fatia absolute inset-y-0 left-0 w-full rounded-full bg-white/25"
                        style={{ transform: `scaleX(${fatia / 100})` }}
                      />
                    )}
                    <span className="relative flex items-center gap-2 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate">{op}</span>
                      {jaVotou && (
                        /* ⚠️ **NÚMERO junto da porcentagem, e não a porcentagem
                           sozinha.** "67%" são dois votos de três, e numa base
                           pequena a porcentagem transforma três pessoas numa
                           maioria. O post do feed já dizia os dois desde o
                           primeiro dia; o story dizia só a fração — a mesma
                           enquete contando duas histórias em duas telas. */
                        <span className="shrink-0 text-[13px] tabular-nums opacity-90">
                          {fatia}%
                          <span className="ml-1 font-normal opacity-75">
                            ({rotuloDeVotos(votos)})
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                );
              });
            })()}
            {(voteiAgora[atual.id] ?? atual.enquete.meuVoto) === null && (
              <p className="text-center text-[11px] text-white/75">
                Toque para votar — o voto não muda depois.
              </p>
            )}
          </div>
        )}

        {/* ─── REAGIR ────────────────────────────────────────────────────────
            ⚠️ **NÃO aparece no MEU story.** Reagir ao próprio é vazio, e ali o
            rodapé já é do "visto por" e da lixeira.

            ⚠️ **E só quando NÃO há enquete nem caixinha abertas.** Os três
            ocupam o mesmo pedaço da tela, e a régua "um de cada vez" já valia
            para os dois primeiros: com os três, o dedo em pânico acertaria o
            errado.

            ⚠️ `z-20`, acima das metades invisíveis de avançar/voltar — sem
            isso, tocar num emoji avançaria o story. */}
        {!souEu && aoReagirAoStory && !atual.enquete && !atual.perguntaAberta && (
          <div className="absolute inset-x-3 bottom-24 z-20">
            <div className="flex items-center gap-0.5 overflow-x-auto rounded-full bg-black/45 px-1.5 py-1 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {REACOES.map((r, n) => {
                const minha = (reagiAgora[atual.id] ?? atual.minhaReacao) === r.tipo;
                return (
                  <button
                    key={r.tipo}
                    type="button"
                    aria-label={r.rotulo}
                    aria-pressed={minha}
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticTap();
                      /* Tocar na mesma TIRA — a mesma régua da reação ao post. */
                      const nova = minha ? null : r.tipo;
                      setReagiAgora((m) => ({ ...m, [atual.id]: nova }));
                      aoReagirAoStory(atual.id, nova);
                    }}
                    style={{ ["--dc-atraso" as string]: `${n * 18}ms` }}
                    className={`dc-reacao-entra press grid h-11 w-11 shrink-0 place-items-center rounded-full text-[24px] leading-none transition-transform ${
                      minha ? "scale-110 bg-white/25" : ""
                    }`}
                  >
                    {r.emoji}
                  </button>
                );
              })}
            </div>
            {/* ⚠️ Diz PARA ONDE VAI. No modelo a reação vira mensagem direta;
                aqui não existe mensagem direta, e sem esta frase ela acha que
                mandou um recado que ninguém vai ler. */}
            <p className="mt-1 text-center text-[11px] text-white/75">
              {(reagiAgora[atual.id] ?? atual.minhaReacao)
                ? "Ela vai ver na caixa dela 💛"
                : "Toque para reagir — ela vê o seu nome"}
            </p>
          </div>
        )}

        {atual.perguntaAberta && !souEu && aoPerguntarNoStory && (
          <div className="absolute inset-x-6 bottom-24 z-20">
            {mandada ? (
              /* ⚠️ Não repete a pergunta na tela depois de enviada: a caixinha é
                 ANÔNIMA, e mostrar o texto de volta por cima do story de outra
                 pessoa é o começo de ela achar que ficou público. */
              <p className="rounded-2xl bg-black/45 px-4 py-3 text-center text-[14px] text-white backdrop-blur-sm">
                Mandei pra ela, sem o seu nome 💛
              </p>
            ) : (
              <div className="rounded-2xl bg-black/40 p-2.5 backdrop-blur-sm">
                <p className="px-1 pb-1.5 text-[12px] text-white/85">
                  Pergunte o que quiser — ela não vê quem perguntou.
                </p>
                <div className="flex items-end gap-2">
                  <textarea
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value.slice(0, LIMITE_DA_PERGUNTA))}
                    onFocus={() => setPausado(true)}
                    onBlur={() => setPausado(false)}
                    rows={2}
                    placeholder="Escreva aqui…"
                    className="min-w-0 flex-1 resize-none rounded-xl bg-white/95 px-3 py-2 text-[14px] leading-snug text-foreground"
                  />
                  <button
                    type="button"
                    disabled={!pergunta.trim() || mandando}
                    onClick={async () => {
                      setMandando(true);
                      setRecado(null);
                      const r = await aoPerguntarNoStory(atual.autorId, pergunta.trim(), atual.id);
                      setMandando(false);
                      if (r) setRecado(r);
                      else {
                        setMandada(true);
                        setPergunta("");
                      }
                    }}
                    className="press shrink-0 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-foreground disabled:opacity-50"
                  >
                    {mandando ? "…" : "Enviar"}
                  </button>
                </div>
                {recado && (
                  <p className="px-1 pt-1.5 text-[12px] leading-snug text-white">{recado}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* As duas metades invisíveis: esquerda volta, direita avança. Segurar
            pausa. É o gesto do formato, e ele não tem rótulo em lugar nenhum
            porque todo mundo já sabe. */}
        <button
          type="button"
          aria-label="Anterior"
          onPointerDown={() => setPausado(true)}
          onPointerUp={() => {
            setPausado(false);
            if (i > 0) setI(i - 1);
          }}
          onPointerLeave={() => setPausado(false)}
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          aria-label="Próximo"
          onPointerDown={() => setPausado(true)}
          onPointerUp={() => {
            setPausado(false);
            if (i + 1 < bolha.stories.length) setI(i + 1);
            else aoFechar();
          }}
          onPointerLeave={() => setPausado(false)}
          className="absolute inset-y-0 right-0 w-2/3"
        />
      </div>

      {/* ⚠️ O rodapé só existe no MEU story. No modelo é ali que mora "visto
          por" — e é a única recompensa de publicar um: sem ele, publicar um
          story é falar sozinha para uma parede que some em 24 h. */}
      {souEu && atual && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}
        >
          {aoQuemViu && (
            <button
              type="button"
              onClick={async () => setQuemViu((await aoQuemViu(atual.id)) ?? "erro")}
              className="press flex-1 text-left text-[13px] text-white/85"
            >
              👁 Ver quem viu
            </button>
          )}
          {aoApagarStory && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label="Apagar story"
              className="press text-[15px] text-white/85"
            >
              🗑
            </button>
          )}
        </div>
      )}

      {confirmando && (
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-card p-4">
          <p className="text-[14px] leading-snug">
            Apagar este story? Ele sairia sozinho em 24 horas.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="press flex-1 rounded-xl border border-border py-2 text-[14px]"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                if (atual) aoApagarStory?.(atual.id);
              }}
              className="press flex-1 rounded-xl bg-destructive py-2 text-[14px] font-semibold text-destructive-foreground"
            >
              Sim, apagar
            </button>
          </div>
        </div>
      )}

      {quemViu && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-3xl bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">
              {quemViu === "erro"
                ? "Quem viu"
                : quemViu.length === 1
                  ? "1 pessoa viu"
                  : `${quemViu.length} pessoas viram`}
            </h2>
            <button
              type="button"
              onClick={() => setQuemViu(null)}
              aria-label="Fechar"
              className="press text-xl leading-none"
            >
              ×
            </button>
          </div>
          {quemViu === "erro" ? (
            /* ⚠️ Diz que NÃO CONSEGUIU, e nunca "ninguém viu" — as duas frases
               são notícias opostas, e a errada é a que desanima quem publicou. */
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Não deu para carregar agora. Tente de novo daqui a pouco.
            </p>
          ) : quemViu.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">Ninguém viu ainda.</p>
          ) : (
            <ul className="mt-2">
              {quemViu.map((g) => (
                <li key={g.id} className="flex items-center gap-3 py-2">
                  <Foto url={g.avatarUrl} nome={g.nome} lado={36} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{g.nome}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A ATIVIDADE — a aba do coração
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaDeAtividade({
  itens,
  aoVoltar,
  aoAbrirPerfil,
  aoAbrirPost,
  aoResponder,
}: {
  itens: AtividadeNaTela[];
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
  aoAbrirPost?: (id: string) => void;
  /**
   * Aceitar ou recusar um pedido de seguir, aqui mesmo.
   *
   * ⚠️ É AQUI que o pedido é respondido, e não só nas configurações. O perfil
   * nasce FECHADO (`PERFIL_PUBLICO_PADRAO = false`), então todo seguir vira um
   * pedido — e enquanto a única porta esteve enterrada numa seção de ajustes,
   * a rede inteira ficava parada esperando uma tela que ninguém abria.
   */
  aoResponder?: (seguidorId: string, aceitar: boolean) => void;
}) {
  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Atividade</h1>
      </header>

      {itens.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Quando alguém reagir ou começar a te acompanhar, aparece aqui 💛
        </p>
      ) : (
        <ul>
          {itens.map((a) => (
            <li key={a.id}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  a.visto ? "" : "bg-primary/[0.06]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => aoAbrirPerfil?.(a.quemId)}
                  className="press shrink-0"
                >
                  <Foto url={a.quemAvatar} nome={a.quemNome} lado={40} />
                </button>
                <p className="min-w-0 flex-1 text-[13px] leading-snug">
                  <span className="font-semibold">{a.quemNome}</span>{" "}
                  {/* O texto vem de `textoDoAviso`, a MESMA função que o push
                      usa — duas redações da mesma frase divergiriam, e a
                      paciente leria uma no aviso e outra na tela. */}
                  {textoDoAviso(a.especie, "").trim()}
                </p>
                {/* O pedido AINDA DE PÉ ganha os dois botões; o já respondido
                    vira uma linha comum, sem botão que não faz nada. */}
                {a.especie === "pediu_para_seguir" && a.pendente && aoResponder && (
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => aoResponder(a.quemId, false)}
                      className="press rounded-lg border border-border px-2.5 py-1.5 text-[12px]"
                    >
                      Agora não
                    </button>
                    <button
                      type="button"
                      onClick={() => aoResponder(a.quemId, true)}
                      className="press rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground"
                    >
                      Aceitar
                    </button>
                  </span>
                )}
                {a.postCapa && (
                  <button
                    type="button"
                    onClick={() => a.postId && aoAbrirPost?.(a.postId)}
                    className="press shrink-0"
                  >
                    <img
                      src={a.postCapa}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   NOVA PUBLICAÇÃO — o que o ＋ abre
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Reduz a foto do POST antes de subir.
 *
 * ⚠️ 1080 e não 512, que é o lado do avatar. O avatar aparece num círculo de
 * 44px; a foto do post ocupa a largura inteira da tela, e num iPhone de
 * densidade 3 são ~1180 pixels reais — mandar 512 é entregar uma foto
 * visivelmente mole justamente na peça que a tela existe para mostrar. A
 * qualidade 0,8 mantém o data URL bem abaixo do teto de 1,5 MB do servidor.
 *
 * A proporção é PRESERVADA, ao contrário do avatar: o modelo aceita retrato,
 * paisagem e quadrado, e recortar aqui decidiria pelo enquadramento dela.
 */
const LADO_DA_FOTO = 1080;
async function prepararFotoDoPost(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_DA_FOTO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/**
 * A MINIATURA DA GRADE — a mesma foto a 480px.
 *
 * ⚠️ **Gerada AQUI, no aparelho dela, e não no servidor.** O arquivo grande já
 * está no navegador nesse instante: reduzir aqui custa um `drawImage` e não
 * custa upload, banda nem função de servidor. Gerar depois obrigaria a BAIXAR
 * de volta a foto que acabou de subir.
 *
 * ⚠️ E ela é da PRIMEIRA foto só. A grade e as capas pequenas mostram a capa;
 * as demais do carrossel só existem dentro da publicação aberta, onde a foto
 * cheia é a certa.
 *
 * Ver `src/lib/miniatura.ts` para a conta que decidiu o 480.
 */
async function prepararMiniatura(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const maior = Math.max(bitmap.width, bitmap.height);
    /* Foto que já é pequena não vira um segundo arquivo do mesmo peso. */
    if (!valeMiniatura(maior)) return null;
    const escala = LADO_DA_MINIATURA / maior;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    /* 0,75 e não 0,8: num quadrado de 130px o olho não distingue, e a diferença
       de peso é real. */
    return canvas.toDataURL("image/jpeg", 0.75);
  } catch {
    /* Sem miniatura a grade cai na foto cheia — nunca se perde a publicação. */
    return null;
  }
}

/**
 * Reduz a foto do STORY.
 *
 * ⚠️ **Ela subia por `prepararAvatar`** — 512px QUADRADOS, com recorte central.
 * Num formato 9:16 exibido com `object-contain`, isso é duas perdas ao mesmo
 * tempo: a foto perde as pontas de cima e de baixo no recorte, e o que sobra é
 * exibido em 512px numa tela que pede ~1080. A moldura da semana viria carimbar
 * uma foto que já saía errada.
 *
 * Aqui não há recorte: a foto cabe inteira em 1080×1920, preservando a
 * proporção dela — que é o que `object-contain` do visor espera.
 */
/**
 * Reduz a foto SÓ PARA A SUGESTÃO DE LEGENDA.
 *
 * ⚠️ Ela não substitui a foto do post — a que vai publicada continua em 1080.
 * Esta é uma cópia menor, criada para sair do aparelho e ser descartada.
 */
async function reduzirParaIA(dataUrl: string): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const escala = Math.min(1, LADO_PARA_A_IA / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}

/**
 * O cartão da vitória, como data URL.
 *
 * ⚠️ `require`-like por `import()` não serve aqui: o estado inicial é síncrono.
 * `share-card.ts` é canvas puro e não puxa nada pesado, então ele entra como
 * import estático no topo do arquivo.
 */
function cartaoDoMomento(m: Momento): string | null {
  return momentoComoDataUrl(m);
}

const LADO_DO_STORY = { largura: 1080, altura: 1920 };
async function prepararFotoDoStory(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(
      1,
      LADO_DO_STORY.largura / bitmap.width,
      LADO_DO_STORY.altura / bitmap.height,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/** Teto de fotos por publicação — o mesmo do servidor (a primeira + nove). */
const FOTOS_POR_POST = 10;

export function NovoPost({
  aoFechar,
  aoPublicar,
  aulaDeHoje,
  aoSugerirLegenda,
  amigasParaMarcar,
  rascunho,
  aoMudarRascunho,
  paraComparar,
  entaoInicial,
  momentoInicial,
}: {
  aoFechar: () => void;
  /** Devolve `true` quando publicou. A tela só fecha nesse caso. */
  aoPublicar: (p: {
    texto: string | null;
    fotos: string[];
    /** A versão de 480px da primeira foto. `null` é normal — ver `miniatura.ts`. */
    miniatura?: string | null;
    visibilidade: Visibilidade;
    enquete: string[];
    aula: AulaNoPost | null;
    /** Os ids de quem estava junto. O servidor confere cada um. */
    marcadas: string[];
    /** O post antigo que vira a primeira foto, ou `null`. */
    comparacaoCom: string | null;
  }) => Promise<boolean>;
  /**
   * A aula que ela fez hoje, para anexar com um toque.
   *
   * ⚠️ Só o dia e o título chegam aqui: nota, enunciado e gabarito ficam de
   * fora — o primeiro seria um placar público, os outros vazam conteúdo
   * premium e estragam a aula de quem está uma semana atrás.
   */
  aulaDeHoje?: AulaNoPost | null;
  /**
   * Pede à IA três legendas para a primeira foto. `null` = o recurso não está
   * ligado (a bancada sem ele, por exemplo) e o botão nem aparece.
   *
   * ⚠️ Quem faz a REDE é a tela de cima (`RedeNoApp`), que tem o token — este
   * componente continua sendo só desenho, como já era para `aoPublicar`.
   */
  aoSugerirLegenda?: (foto: string) => Promise<string[]>;
  /**
   * As amigas que ela pode marcar. `null` = o recurso não está ligado.
   *
   * ⚠️ **É uma LISTA, e nunca uma busca.** Para aparecer aqui, uma das duas já
   * convidou a outra — é o grafo fechado que torna a marcação segura sem
   * moderação. A régua e o porquê estão em `marcacoes.ts`.
   */
  amigasParaMarcar?: { id: string; nome: string; avatar: string | null }[] | null;
  /**
   * O rascunho guardado no aparelho, ou `null`.
   *
   * ⚠️ **A tela OFERECE, nunca preenche sozinha.** Encher o campo com um texto
   * de três dias atrás no momento em que ela abre o compositor para postar
   * outra coisa é como uma publicação sai errada. A régua e o porquê estão em
   * `rascunho-do-post.ts`.
   */
  rascunho?: RascunhoDoPost | null;
  /** Guarda o que ela está escrevendo. Quem escreve no aparelho é a tela de cima. */
  aoMudarRascunho?: (r: Omit<RascunhoDoPost, "em"> | null) => void;
  /**
   * As publicações antigas dela que servem como "então".
   *
   * ⚠️ Só as com foto e com pelo menos quatro semanas — a régua e o porquê
   * estão em `entao-e-agora.ts`. `null` = ainda carregando; `[]` = não há.
   */
  paraComparar?: { id: string; imagemUrl: string; criadoEm: string }[] | null;
  /** O "então" já escolhido pelo lembrete do feed — ver `entao-e-agora.ts`. */
  entaoInicial?: string | null;
  /**
   * A vitória que ela mandou publicar de outra aba — ver `momento.ts`.
   *
   * ⚠️ O compositor REDESENHA o cartão a partir do momento; o bilhete que
   * atravessa as abas guarda o dado, nunca a imagem (ver
   * `momento-para-publicar.ts`).
   */
  momentoInicial?: Momento | null;
}) {
  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState<string[] | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  /** O id do post antigo escolhido como "então", ou `null`. */
  /* ⚠️ Nasce com o que o LEMBRETE escolheu, quando ela veio por ele. Sem isto,
     tocar em "Comparar" no cartão abriria o compositor com a comparação
     desligada e ela teria de achar o botão e a foto de novo — o cartão
     prometeria uma coisa e entregaria outra. */
  const [entao, setEntao] = useState<string | null>(entaoInicial ?? null);
  const [escolhendoQuem, setEscolhendoQuem] = useState(false);
  /* A faixa "você tinha um rascunho". Some ao recuperar ou ao descartar — e
     `null` (o padrão) é "ainda não decidiu". */
  const [ofereceu, setOfereceu] = useState(false);
  const [pensando, setPensando] = useState(false);
  /* Uma LISTA, e a primeira é a capa. Um estado para "a foto" e outro para "as
     outras" divergiria na hora de remover a primeira. */
  /**
   * ⚠️ O cartão da vitória é desenhado NA INICIALIZAÇÃO, e não num efeito.
   *
   * Num efeito, o compositor abriria vazio e a foto apareceria um quadro
   * depois — e o efeito com atraso do rascunho já teria gravado um rascunho
   * sem ela. Desenhar é síncrono e custa milissegundos: `momentoComoDataUrl`
   * é canvas puro, sem rede.
   */
  const [fotos, setFotos] = useState<string[]>(() => {
    if (!momentoInicial || typeof document === "undefined") return [];
    const url = cartaoDoMomento(momentoInicial);
    return url ? [url] : [];
  });
  /* ⚠️ O padrão é o mais FECHADO. O erro possível aqui é publicar para menos
     gente do que ela queria — nunca para mais. */
  const [vis, setVis] = useState<Visibilidade>("amigas");
  /* `null` = sem enquete. Duas opções vazias é o estado inicial de quem abriu
     a enquete e ainda não escreveu — e não uma enquete inválida na tela. */
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const [comAula, setComAula] = useState(false);
  /**
   * A miniatura da PRIMEIRA foto.
   *
   * ⚠️ Guardada em estado próprio, e não derivada de `fotos`: o `File` original
   * só existe no instante em que ela escolhe, e reduzir a partir do data URL já
   * reduzido seria reduzir duas vezes. `null` é normal — foto pequena, canvas
   * indisponível, ou a foto veio de um cartão de momento.
   */
  const [miniatura, setMiniatura] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  /* ⚠️ A régua de "dá para publicar isto?" é a MESMA do servidor
     (`postEhValido`). Uma segunda condição escrita aqui aceitaria o que o
     servidor recusa, e ela levaria um erro depois de escrever o texto. */
  /* ⚠️ A enquete conta como conteúdo — um post que é SÓ a enquete é legítimo
     ("menino ou menina?" não precisa de foto nem de legenda). É a mesma régua
     do servidor, e as duas concordam de propósito. */
  const opcoesLimpas = limparOpcoes(opcoes ?? []);
  const enqueteOk = opcoes === null || enqueteValida(opcoesLimpas);
  const temConteudo =
    postEhValido({ texto, temImagem: fotos.length > 0 }) || opcoesLimpas.length >= OPCOES_MIN;
  const podeEnviar = temConteudo && enqueteOk && !enviando;

  /* ⚠️ GUARDA COM ATRASO (700 ms). Sem isso, cada letra digitada seria uma
     gravação no `localStorage` — que é SÍNCRONA e bloqueia a linha principal.
     Num texto de trezentos caracteres seriam trezentas gravações, e o teclado
     começa a engasgar antes do fim da frase. */
  /* ⚠️ **A PRIMEIRA PASSADA NÃO GRAVA — e sem isto o compositor APAGAVA o
     rascunho ao abrir.** O efeito roda na montagem com os campos vazios;
     700 ms depois `paraGuardar` devolvia `guardar: false` (rascunho vazio
     apaga, que é a regra certa) e o `localStorage` era limpo. A faixa "você
     tinha um rascunho" continuava na tela porque o texto já estava em memória
     — então quem tocasse em "Recuperar" na hora não via nada de errado, e quem
     fechasse a tela para voltar depois perdia o texto para sempre. O defeito
     mais silencioso possível: a única prova sumia junto. */
  const primeiraPintura = useRef(true);
  useEffect(() => {
    if (!aoMudarRascunho) return;
    if (primeiraPintura.current) {
      primeiraPintura.current = false;
      return;
    }
    const id = setTimeout(() => {
      aoMudarRascunho({
        texto,
        visibilidade: vis,
        enquete: opcoes,
        comAula,
        marcadas,
      });
    }, 700);
    return () => clearTimeout(id);
  }, [texto, vis, opcoes, comAula, marcadas, aoMudarRascunho]);

  async function pedirLegendas() {
    if (!aoSugerirLegenda || !fotos[0] || pensando) return;
    setPensando(true);
    setSugestoes(null);
    try {
      /* A CAPA. Sugerir a partir da terceira foto de um carrossel descreveria
         o que a maioria nem vê primeiro. */
      setSugestoes(await aoSugerirLegenda(fotos[0]));
    } catch {
      setSugestoes([]);
    } finally {
      setPensando(false);
    }
  }

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    const ok = await aoPublicar({
      texto: texto.trim() || null,
      fotos,
      miniatura,
      visibilidade: vis,
      enquete: opcoes ? opcoesLimpas : [],
      aula: comAula ? (aulaDeHoje ?? null) : null,
      marcadas,
      comparacaoCom: entao,
    });
    setEnviando(false);
    if (ok) {
      /* ⚠️ APAGA O RASCUNHO ANTES de fechar. Fechando primeiro, o efeito de
         guardar ainda tem 700 ms de vida e regravaria o texto que acabou de ser
         publicado — e ela reabriria o compositor com o post de novo dentro. */
      aoMudarRascunho?.(null);
      aoFechar();
    } else setErro("Não deu para publicar. Tente de novo.");
  }

  return (
    <div>
      {/* A barra de cima com "Compartilhar" à direita é a tela de legenda
          deles, e ela resolve uma coisa: a ação de confirmar mora onde o
          polegar já está, no alto, e não some quando o teclado sobe. */}
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Nova publicação</h1>
        <button
          type="button"
          onClick={enviar}
          disabled={!podeEnviar}
          className="press text-[14px] font-semibold text-primary disabled:opacity-40"
        >
          {enviando ? "Publicando…" : "Compartilhar"}
        </button>
      </header>

      <div className="px-4">
        {/* ⚠️ OFERECE, e some assim que ela decide. Uma faixa que fica na tela
            depois de recuperada vira ruído; uma que preenche sozinha publica o
            texto errado. */}
        {rascunho && !ofereceu && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2">
            <p className="min-w-0 flex-1 text-[12px] leading-snug">
              Você tinha começado a escrever aqui.
            </p>
            <button
              type="button"
              onClick={() => {
                setTexto(rascunho.texto);
                setVis(rascunho.visibilidade);
                setOpcoes(rascunho.enquete);
                setComAula(rascunho.comAula);
                setMarcadas(rascunho.marcadas);
                setOfereceu(true);
              }}
              className="press shrink-0 rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={() => {
                /* Descartar apaga de verdade — senão a faixa volta na próxima
                   abertura, oferecendo o que ela já recusou. */
                aoMudarRascunho?.(null);
                setOfereceu(true);
              }}
              aria-label="Descartar o rascunho"
              className="press shrink-0 px-1 text-[16px] leading-none text-muted-foreground"
            >
              ×
            </button>
          </div>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DO_TEXTO))}
          rows={4}
          placeholder="Escreva uma legenda…"
          className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-[14px] leading-snug"
        />
        {/* O contador só aparece perto do fim: um número piscando a cada letra
            desde a primeira transforma escrever num exercício de caber. */}
        {texto.length > LIMITE_DO_TEXTO - 80 && (
          <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
            {LIMITE_DO_TEXTO - texto.length}
          </p>
        )}

        {/* ⚠️ SÓ COM FOTO. É uma legenda PARA a imagem: sem imagem o modelo não
            teria do que falar, e um botão que aparece antes da foto promete o
            que não pode entregar. */}
        {aoSugerirLegenda && fotos.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={pedirLegendas}
              disabled={pensando}
              className="press inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 text-[13px] font-medium text-primary disabled:opacity-60"
            >
              {pensando ? "Pensando…" : "✨ Sugerir legenda"}
            </button>

            {/* ⚠️ ESTA FRASE NÃO SAI. A foto vai para um serviço de fora, e num
                app de gestação isso é dela saber ANTES de tocar — não depois,
                numa política. Dizer também que não fica guardada é o que separa
                "mandaram minha ultrassom para alguém" de uma escolha
                informada. */}
            {sugestoes === null && !pensando && (
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                A foto é enviada só para escrever a sugestão, e não fica guardada.
              </p>
            )}

            {sugestoes !== null && sugestoes.length === 0 && !pensando && (
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                Não consegui pensar em nada para esta foto. Escreva do seu jeito 💛
              </p>
            )}

            {sugestoes !== null && sugestoes.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {sugestoes.map((sug, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      hapticTap();
                      /* ACRESCENTA, nunca apaga — a régua mora em
                         `legenda-sugerida.ts`, testada. */
                      setTexto(aplicarSugestao(texto, sug).slice(0, LIMITE_DO_TEXTO));
                      setSugestoes(null);
                    }}
                    style={{ ["--dc-atraso" as string]: `${n * 45}ms` }}
                    className="dc-reacao-entra press block w-full rounded-2xl border border-border bg-muted/40 px-3 py-2 text-left text-[13px] leading-snug"
                  >
                    {sug}
                  </button>
                ))}
                <p className="pt-0.5 text-[11px] text-muted-foreground">
                  Toque para usar — dá para editar depois.
                </p>
              </div>
            )}
          </div>
        )}

        {fotos.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fotos.map((f, n) => (
              <div key={n} className="relative shrink-0">
                <img
                  src={f}
                  alt=""
                  className="h-24 w-24 rounded-xl object-cover"
                  loading="lazy"
                  decoding="async"
                />
                {/* A PRIMEIRA leva o selo — sem ele ninguém sabe qual vai
                    aparecer na grade do perfil. */}
                {n === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
                    capa
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setFotos((fs) => fs.filter((_, k) => k !== n))}
                  aria-label="Tirar esta foto"
                  className="press absolute right-1 top-1 rounded-full bg-black/60 px-1.5 leading-none text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ─── QUEM ESTAVA JUNTO ───────────────────────────────────────────
            ⚠️ Só aparece quando HÁ amigas. Um botão que abre uma folha vazia
            ensina que os botões desta tela não valem — e a maioria das contas
            novas não tem ninguém no grafo ainda. */}
        {amigasParaMarcar && amigasParaMarcar.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setEscolhendoQuem((v) => !v)}
              aria-expanded={escolhendoQuem}
              className="press mt-3 w-full rounded-xl border border-border py-2 text-[14px] font-medium"
            >
              {marcadas.length === 0
                ? "👭 Marcar quem estava junto"
                : `👭 ${marcadas.length} marcada${marcadas.length > 1 ? "s" : ""}`}
            </button>

            {escolhendoQuem && (
              <div className="mt-2 rounded-2xl border border-border p-2">
                {/* ⚠️ Diz o TETO na tela. Descobrir o limite só ao tocar na
                    sexta amiga é o tipo de recusa que parece defeito. */}
                <p className="px-1 pb-1.5 text-[11px] text-muted-foreground">
                  Até {MARCADAS_MAX} pessoas, entre as suas amigas do app.
                </p>
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {amigasParaMarcar.map((a) => {
                    const marcada = marcadas.includes(a.id);
                    const cheio = marcadas.length >= MARCADAS_MAX && !marcada;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={cheio}
                        aria-pressed={marcada}
                        onClick={() => {
                          hapticTap();
                          setMarcadas((m) =>
                            m.includes(a.id) ? m.filter((x) => x !== a.id) : [...m, a.id],
                          );
                        }}
                        className={`press flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-2 text-left text-[14px] disabled:opacity-40 ${
                          marcada ? "bg-primary/10 font-semibold" : ""
                        }`}
                      >
                        <Foto url={a.avatar} nome={a.nome} lado={32} />
                        <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                        {marcada && (
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            className="h-4 w-4 shrink-0 text-primary"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m5 12.5 4.5 4.5L19 7.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── ENTÃO E AGORA ───────────────────────────────────────────────
            ⚠️ Só aparece quando ela TEM uma publicação antiga com foto — e só
            faz sentido junto com a foto de HOJE, que é a segunda metade da
            comparação. Um botão sem as duas pontas prometeria o que não pode
            entregar. */}
        {paraComparar && paraComparar.length > 0 && fotos.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                const proximo = entao ? null : (paraComparar[0]?.id ?? null);
                setEntao(proximo);
                /* ⚠️ **O `setTexto` fica FORA do updater de `setEntao`.**
                   Escrevi dentro primeiro, e a bancada mostrou o resultado na
                   hora: a legenda entrava DUAS vezes por toque. Um updater de
                   estado é chamado mais de uma vez de propósito (o React
                   reexecuta para conferir pureza), então efeito colateral lá
                   dentro roda em dobro. Vale para qualquer `setX(prev => …)`
                   deste arquivo.

                   ⚠️ **E só quando a legenda está VAZIA.** `aplicarSugestao`
                   ACRESCENTA — que é o certo para o botão da IA, onde ela PEDE
                   a sugestão. Aqui a oferta é automática, e acrescentar
                   empilhava uma cópia a cada liga/desliga (medido: quatro
                   linhas iguais em três toques). Oferecer, nunca preencher por
                   cima do que ela escreveu.

                   ⚠️ **O carimbo é SEMPRE `null` aqui, de propósito.**
                   `CandidatoAoEntao` não carrega semana, e não deve carregar:
                   as duas semanas saem de `lmp_date`, que NUNCA viaja para o
                   navegador — é o que sustenta a chave `mostrar_semana`. Quem
                   monta "12s e 28s" é o servidor, na LEITURA, com
                   `carimboDaComparacao`. Mandar a semana para cá "para
                   melhorar a sugestão" publicaria o dado clínico pela porta
                   dos fundos da tela que existe para fechá-la. */
                if (proximo && !texto.trim()) {
                  setTexto(aplicarSugestao("", legendaSugerida(null)).slice(0, LIMITE_DO_TEXTO));
                }
              }}
              aria-pressed={!!entao}
              className={`press mt-3 w-full rounded-xl border py-2 text-[14px] font-medium ${
                entao ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              ↔️ Então e agora
            </button>

            {entao && (
              <div className="mt-2 rounded-2xl border border-border p-2">
                <p className="px-1 pb-1.5 text-[11px] text-muted-foreground">
                  Escolha a foto de antes. As semanas entram sozinhas.
                </p>
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {paraComparar.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEntao(c.id)}
                      aria-pressed={entao === c.id}
                      className={`press shrink-0 overflow-hidden rounded-xl border-2 ${
                        entao === c.id ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img
                        src={c.imagemUrl}
                        alt=""
                        className="h-20 w-20 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── A ENQUETE ────────────────────────────────────────────────── */}
        {opcoes === null ? (
          <button
            type="button"
            onClick={() => setOpcoes(["", ""])}
            className="press mt-3 w-full rounded-xl border border-border py-2 text-[14px] font-medium"
          >
            📊 Fazer uma enquete
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">Enquete</p>
              <button
                type="button"
                onClick={() => setOpcoes(null)}
                className="press text-[12px] text-muted-foreground"
              >
                tirar
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {opcoes.map((op, i) => (
                <input
                  key={i}
                  value={op}
                  onChange={(e) =>
                    setOpcoes((os) =>
                      (os ?? []).map((o, k) =>
                        k === i ? e.target.value.slice(0, LIMITE_DA_OPCAO) : o,
                      ),
                    )
                  }
                  placeholder={`Opção ${i + 1}`}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[14px]"
                />
              ))}
            </div>
            {opcoes.length < OPCOES_MAX && (
              <button
                type="button"
                onClick={() => setOpcoes((os) => [...(os ?? []), ""])}
                className="press mt-2 text-[13px] font-medium text-primary"
              >
                + opção
              </button>
            )}
            {/* ⚠️ O aviso do voto único aparece ANTES de publicar, e não só
                para quem vota: quem cria a enquete precisa saber que não dá
                para corrigir depois — post não se edita. */}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Cada pessoa vota uma vez, e o voto não muda. Você vê só os números — nunca quem votou
              em quê.
            </p>
            {!enqueteOk && opcoesLimpas.length > 0 && (
              <p className="mt-1 text-[12px] text-destructive">
                {opcoesLimpas.length < OPCOES_MIN
                  ? `Escreva pelo menos ${OPCOES_MIN} opções.`
                  : "As opções precisam ser diferentes entre si."}
              </p>
            )}
          </div>
        )}

        {/* ─── A AULA DE HOJE ───────────────────────────────────────────── */}
        {aulaDeHoje && (
          <button
            type="button"
            onClick={() => setComAula((v) => !v)}
            aria-pressed={comAula}
            className={`press mt-3 w-full rounded-xl border py-2 text-[14px] font-medium ${
              comAula ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            📚 {comAula ? "Aula anexada" : "Anexar a aula de hoje"}
          </button>
        )}

        {/* ⚠️ A camada fica À VISTA, e não atrás de um menu. Escondida, ela
            publica no padrão sem perceber — e num app de gestação a diferença
            entre "as amigas" e "qualquer pessoa" é a diferença entre contar
            uma notícia e publicá-la. */}
        <div className="mt-3">
          <p className="text-[12px] font-medium text-muted-foreground">Quem vai ver</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VISIBILIDADES.map((v) => (
              <button
                key={v.chave}
                type="button"
                onClick={() => setVis(v.chave)}
                className={`press rounded-full px-3 py-1.5 text-[13px] ${
                  vis === v.chave ? "bg-primary/15 font-semibold text-primary" : "bg-muted/60"
                }`}
              >
                {v.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
            {VISIBILIDADES.find((v) => v.chave === vis)?.sub}
          </p>
        </div>

        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            /* O teto é conferido AQUI e não só no servidor: recusar o post
               inteiro depois de ela escolher onze fotos é pior que não deixar
               escolher a décima primeira. */
            if (fotos.length >= FOTOS_POR_POST) {
              setErro(`No máximo ${FOTOS_POR_POST} fotos por publicação.`);
              return;
            }
            const d = await prepararFotoDoPost(f);
            if (!d) setErro("Não consegui ler essa imagem.");
            else {
              setErro(null);
              /* ⚠️ A miniatura é da PRIMEIRA foto, e é gerada AQUI porque o
                 arquivo já está em mãos. Fora daqui seria preciso guardar o
                 `File` — e ela pode trocar a ordem das fotos antes de publicar.
                 `null` quando a original já é pequena, ou quando o canvas
                 falhou: a grade cai na foto cheia. */
              if (fotos.length === 0) setMiniatura(await prepararMiniatura(f));
              setFotos((fs) => [...fs, d]);
            }
          }}
        />
        <button
          type="button"
          onClick={() => arquivo.current?.click()}
          className="press mt-3 w-full rounded-xl border border-border py-2 text-[14px] font-medium"
        >
          📷 {fotos.length > 0 ? `Adicionar outra (${fotos.length})` : "Adicionar foto"}
        </button>

        {erro && <p className="mt-2 text-[13px] text-destructive">{erro}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   OS SALVOS
   ══════════════════════════════════════════════════════════════════════════ */

/** A grade de três colunas — a mesma do perfil e a dos salvos. */
export function GradeDePosts({
  posts,
  vazio,
  aoAbrirPost,
  aoChegarNoFim,
  temMais = false,
}: {
  posts: PostNaTela[];
  vazio: string;
  aoAbrirPost?: (id: string) => void;
  /** Pede a próxima página. Ausente = a grade não pagina (salvos, gaveta). */
  aoChegarNoFim?: () => void;
  /** ⚠️ Sem isto a sentinela ficaria armada para sempre, pedindo página atrás
      de página vazia — a mesma trava do feed. */
  temMais?: boolean;
}) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{vazio}</p>;
  }
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: VAO_DA_GRADE }}>
        {posts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => aoAbrirPost?.(p.id)}
            /* ⚠️ `aspect-ratio` de 3:4, a proporção NOVA da grade. A antiga era
             quadrada, e mudou em 2025 — quem construir 1:1 hoje corta a foto
             vertical, que é a maioria. */
            style={{ aspectRatio: String(RAZAO_DA_GRADE) }}
            className="press relative overflow-hidden bg-muted/60"
          >
            {urlDaGrade(p) ? (
              /* ⚠️ **`width`/`height` são o que faz o `loading="lazy"` FUNCIONAR.**
               Sem as dimensões o navegador não sabe a altura de cada célula, não
               consegue calcular o que está fora da tela e pede as vinte imagens
               de uma vez. Medido: 21 de 21 requisições saíam na abertura, com 8
               células visíveis. Quem dimensiona na tela continua sendo o CSS —
               estes números só declaram a PROPORÇÃO. */
              <img
                src={urlDaGrade(p) ?? undefined}
                alt=""
                width={CELULA_DA_GRADE.largura}
                height={CELULA_DA_GRADE.altura}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              /* Post só de texto na grade: mostra o texto, não um buraco. */
              <span className="line-clamp-4 block p-2 text-left text-[11px] leading-snug text-foreground/70">
                {p.texto}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* ⚠️ **A GRADE PARAVA NA VIGÉSIMA PUBLICAÇÃO, e não havia como pedir mais.**
          `verPerfil` devolvia uma página e mais nada: uma paciente com cem
          publicações só via as vinte primeiras do PRÓPRIO perfil, e as outras
          oitenta não tinham caminho nenhum no app. Não era lentidão — era
          capacidade faltando, e em silêncio.

          A sentinela é a MESMA do feed: `IntersectionObserver` e não ouvinte de
          `scroll`, porque a aba vive dentro de `minha-conta` e quem rola pode ser
          a janela ou um contêiner interno. */}
      {aoChegarNoFim && temMais && (
        <SentinelaDaGrade aoChegar={aoChegarNoFim} quantos={posts.length} />
      )}
    </>
  );
}

/**
 * A sentinela da grade.
 *
 * ⚠️ Componente próprio para o `useEffect` não precisar viver dentro de um
 * `return` condicional da grade — que é onde a regra dos hooks quebra (e já
 * quebrou, no `useMemo` da fileira de stories).
 */
function SentinelaDaGrade({ aoChegar, quantos }: { aoChegar: () => void; quantos: number }) {
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const alvo = fim.current;
    if (!alvo) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) aoChegar();
      },
      /* Uma tela de antecedência, como no feed: a página seguinte chega antes de
         ela bater no fundo. */
      { rootMargin: "600px" },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [aoChegar, quantos]);
  return <div ref={fim} className="h-1" aria-hidden />;
}

export function TelaDosSalvos({
  posts,
  aoVoltar,
  aoAbrirPost,
}: {
  posts: PostNaTela[];
  aoVoltar: () => void;
  aoAbrirPost?: (id: string) => void;
}) {
  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Salvos</h1>
      </header>
      {/* ⚠️ O texto diz que ninguém vê esta lista, e isso não é enfeite: no
          modelo, "salvo" é a única coleção privada de verdade, e quem não sabe
          disso usa o marcador com o mesmo cuidado de uma curtida pública. */}
      <p className="px-4 pb-2 text-[12px] leading-snug text-muted-foreground">
        Só você vê o que guardou aqui — nem quem publicou fica sabendo.
      </p>
      {/* Sem padding lateral, como a grade do perfil: a célula da grade encosta
          na borda no modelo, e uma das duas com respiro faria a mesma grade
          parecer duas. */}
      <GradeDePosts posts={posts} vazio="Você ainda não guardou nada." aoAbrirPost={aoAbrirPost} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   OS ARQUIVADOS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A GAVETA — o que ela tirou do ar.
 *
 * ⚠️ **Ela é uma LISTA, e não a grade dos salvos.** Na grade só cabe a foto, e
 * aqui cada linha precisa de um botão ("Trazer de volta") — a decisão de
 * arquivar só vira reversível de verdade quando a volta está à mão, e não atrás
 * de abrir o post.
 */
export function TelaDosArquivados({
  posts,
  aoVoltar,
  aoDesarquivar,
}: {
  posts: PostNaTela[];
  aoVoltar: () => void;
  aoDesarquivar: (post: PostNaTela) => void;
}) {
  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Arquivados</h1>
      </header>
      {/* ⚠️ Diz que NINGUÉM MAIS VÊ, e diz que as reações continuam lá. As duas
          coisas são a razão de arquivar ser diferente de apagar, e nenhuma das
          duas é adivinhável. */}
      <p className="px-4 pb-3 text-[12px] leading-snug text-muted-foreground">
        Ninguém mais vê o que está aqui. As reações e a data continuam guardadas — se você trouxer
        de volta, volta como estava.
      </p>

      {posts.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
          Você não tirou nenhuma publicação do ar.
        </p>
      ) : (
        <ul className="space-y-2 px-4 pb-6">
          {posts.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border p-2">
              {p.imagemUrl ? (
                <img
                  src={p.imagemUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                /* Post só de texto: um quadrado com a primeira linha, para a
                   lista não ter buraco cinza. */
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-muted/50 px-1 text-center text-[10px] leading-tight text-muted-foreground">
                  {(p.texto ?? "").slice(0, 28) || "sem texto"}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{p.texto ?? "Sem legenda"}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {haQuantoPublicou(p.criadoEm, Date.now())}
                </span>
              </span>
              <button
                type="button"
                onClick={() => aoDesarquivar(p)}
                className="press min-h-[44px] shrink-0 rounded-full border border-border px-3 text-[12px] font-medium"
              >
                Trazer de volta
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A BUSCA
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaDeBusca({
  aoVoltar,
  aoBuscar,
  aoAbrirPerfil,
}: {
  aoVoltar: () => void;
  aoBuscar: (termo: string) => Promise<PessoaNaLista[]>;
  aoAbrirPerfil?: (id: string) => void;
}) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<PessoaNaLista[]>([]);
  const [buscando, setBuscando] = useState(false);
  /* ⚠️ Descarta resposta ATRASADA: quem digita "ana" dispara três buscas, e a
     de "an" pode voltar depois da de "ana". Mesma trava do `contatoDaPaciente`
     no painel do médico. */
  const daVez = useRef(0);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < MINIMO_DA_BUSCA) {
      setAchados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const meu = ++daVez.current;
    /* Espera meio segundo depois da última tecla: sem isso são cinco idas ao
       servidor para escrever um nome de cinco letras. */
    const id = setTimeout(async () => {
      const r = await aoBuscar(t);
      if (daVez.current !== meu) return;
      setAchados(r);
      setBuscando(false);
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value.slice(0, 60))}
          placeholder="Buscar"
          autoFocus
          className="h-9 min-w-0 flex-1 rounded-xl bg-muted/60 px-3 text-[14px]"
        />
      </header>

      {termo.trim().length > 0 && termo.trim().length < MINIMO_DA_BUSCA ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Escreva pelo menos {MINIMO_DA_BUSCA} letras.
        </p>
      ) : buscando ? (
        <div className="space-y-2 px-4 py-3">
          <div className="skeleton h-12 rounded-xl" />
          <div className="skeleton h-12 rounded-xl" />
        </div>
      ) : achados.length === 0 ? (
        /* ⚠️ O vazio EXPLICA, e a explicação é a régua do produto: só quem
           abriu o perfil aparece na busca. Sem isso, procurar a irmã e não
           achar lê como app quebrado — quando na verdade a irmã está protegida
           exatamente como escolheu. */
        <p className="px-6 py-10 text-center text-[13px] leading-snug text-muted-foreground">
          {termo.trim()
            ? "Ninguém com esse nome por aqui. Só aparece na busca quem deixou o perfil público."
            : "Procure por alguém que você já conhece."}
        </p>
      ) : (
        <ul>
          {achados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aoAbrirPerfil?.(p.id)}
                className="press flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <Foto url={p.avatarUrl} nome={p.nome} lado={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-tight">
                    {p.nome}
                  </span>
                  {p.bio && (
                    <span className="block truncate text-[12px] leading-tight text-muted-foreground">
                      {p.bio}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O ESPELHO — "ver como os outros veem"
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A tela que responde "o que aparece de mim para quem?".
 *
 * Pedido do dono: "não podemos expor a paciente sem ela saber". Uma chave de
 * privacidade sem esta tela é uma promessa; com ela, é uma verificação.
 *
 * ⚠️ **As personas são ABSTRATAS.** "Ver como a Marina me vê" seria um
 * verificador de bloqueio e revelaria por tabela quem segue quem — e a lista de
 * seguidores deste app não é pública de propósito.
 *
 * ⚠️ **E o perfil desenhado aqui vem do SERVIDOR, pela mesma função da tela
 * real** (`verPerfil` com `comoVisitante`). Uma prévia montada no navegador
 * afirmaria o que a paciente quer ouvir, e não o que o servidor entrega — que é
 * o único jeito de esta tela ser pior que não existir.
 */
export function EspelhoDoPerfil({
  persona,
  aoTrocarPersona,
  perfil,
  posts,
  trancado,
  carregando,
  aoVoltar,
}: {
  persona: Persona;
  aoTrocarPersona: (p: Persona) => void;
  perfil: PerfilNaTela | null;
  posts: PostNaTela[];
  /** A estranha bateu numa conta fechada. */
  trancado: boolean;
  carregando: boolean;
  aoVoltar: () => void;
}) {
  const escolhida = PERSONAS.find((p) => p.chave === persona);

  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">Como os outros veem</h1>
      </header>

      <div className="border-b border-border px-4 pb-3">
        <div className="flex gap-1.5">
          {PERSONAS.map((p) => (
            <button
              key={p.chave}
              type="button"
              onClick={() => aoTrocarPersona(p.chave)}
              className={`press flex-1 rounded-xl px-2 py-2 text-[12px] font-semibold ${
                p.chave === persona ? "bg-primary text-primary-foreground" : "bg-muted/60"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{escolhida?.sub}</p>
      </div>

      {carregando ? (
        <div className="space-y-2 p-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      ) : trancado ? (
        /* ⚠️ Este é o estado da MAIORIA das pacientes, e não um caso de borda:
            o perfil nasce fechado. Dizer isso em voz alta é a informação mais
            útil que a tela dá — a de que ela não está exposta a ninguém. */
        <div className="px-6 py-16 text-center">
          <p className="text-[15px] font-semibold">Ela não consegue abrir o seu perfil</p>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            O seu perfil está fechado: só quem você aceitar consegue te acompanhar, e você não
            aparece na busca de quem não te conhece.
          </p>
        </div>
      ) : perfil ? (
        /* A MESMA `TelaDePerfil` da tela real, em modo inerte. Uma segunda
           montagem divergiria dela e passaria a mentir no primeiro conserto. */
        <TelaDePerfil perfil={perfil} posts={posts} somenteLeitura />
      ) : (
        <p className="px-6 py-16 text-center text-[13px] text-muted-foreground">
          Não consegui montar a prévia agora.
        </p>
      )}

      <p className="px-6 pb-8 pt-2 text-center text-[12px] leading-snug text-muted-foreground">
        Nada do seu acompanhamento aparece aqui para ninguém — peso, pressão, exames e consultas são
        só seus e do seu médico.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CONFERIR O STORY ANTES DE PUBLICAR — Fase 3
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A foto, a moldura da semana, e o botão de publicar.
 *
 * ─── POR QUE ELA VÊ ANTES ──────────────────────────────────────────────────
 *
 * Até aqui, escolher a foto PUBLICAVA — sem prévia, sem cancelar, sem nada.
 * Com o carimbo isso deixou de ser aceitável: o app passaria a escrever a
 * semana de gestação dela numa foto que ela nunca viu montada.
 *
 * ⚠️ **O carimbo é uma SOBREPOSIÇÃO, não tinta no JPEG.** Queimado no pixel,
 * ele sobrevive à decisão dela: o arquivo no balde guarda "28 semanas" para
 * sempre, e quem printou fica com a semana. Derivado, ele morre sozinho — a
 * régua cala em Modo Cuidado, depois do parto e sem DUM.
 *
 * ⚠️ **E ele NÃO vem ligado.** Carimbar sozinho porque a chave do perfil está
 * ligada seria o app decidindo o que vai na foto dela.
 */
export function ConferirStory({
  imagem,
  semana,
  aoCancelar,
  aoPublicar,
}: {
  /** Data URL da foto já reduzida. */
  imagem: string;
  /** "28 semanas", ou `null` quando não há o que carimbar. */
  semana: string | null;
  aoCancelar: () => void;
  aoPublicar: (opts: { carimbar: boolean; enquete: string[]; perguntaAberta: boolean }) => void;
}) {
  const [carimbar, setCarimbar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  /* `null` = sem enquete. Duas vazias é o estado de quem abriu e ainda não
     escreveu — a mesma forma do compositor de post. */
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const [caixinha, setCaixinha] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <header
        className="flex h-12 shrink-0 items-center gap-2 px-4"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <button
          type="button"
          onClick={aoCancelar}
          aria-label="Cancelar"
          className="press text-2xl leading-none text-white"
        >
          ×
        </button>
        <h1 className="min-w-0 flex-1 text-[15px] font-semibold text-white">Seu story</h1>
      </header>

      {/* `object-contain`, como o visor: um story é uma composição inteira, e
          cortar as bordas engole o que a pessoa escreveu na foto. */}
      {/* ⚠️ O carimbo pousa na FOTO, não no contêiner. Com `object-contain` a
          foto não preenche a caixa, e um `absolute bottom-5` no contêiner
          desenhava a pílula na tarja preta abaixo da imagem — a moldura ficava
          fora da moldura. A caixa de dentro encolhe até a foto, e o carimbo se
          posiciona contra ela. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative max-h-full">
          <img src={imagem} alt="" className="block max-h-full w-auto object-contain" />
          {carimbar && semana && (
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-[15px] font-semibold text-white backdrop-blur-sm">
              🤰 {semana}
            </span>
          )}
        </div>
      </div>

      <div
        className="shrink-0 space-y-3 px-4 pb-4 pt-3"
        style={{ paddingBottom: "max(1rem, var(--safe-bottom))" }}
      >
        {semana ? (
          <button
            type="button"
            role="switch"
            aria-checked={carimbar}
            onClick={() => setCarimbar((v) => !v)}
            className={`press flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${
              carimbar ? "bg-white text-black" : "bg-white/12 text-white"
            }`}
          >
            <span className="text-[14px] font-semibold">🤰 {semana}</span>
            <span className="text-[13px] opacity-70">
              {carimbar ? "no story" : "tocar para pôr"}
            </span>
          </button>
        ) : (
          /* Sem semana não há carimbo, e a tela não finge que há: sem DUM,
             depois do parto ou em Modo Cuidado, o controle simplesmente não
             existe. */
          <p className="text-center text-[12px] text-white/60">
            Sem a data da última menstruação no perfil, não dá para carimbar a semana.
          </p>
        )}

        {/* ⚠️ UM DE CADA VEZ. Enquete e caixinha ocupam o MESMO pedaço da tela
            no visor (a faixa de baixo), e empilhadas sobrariam ~120px de foto —
            que é o conteúdo. Escolher uma desliga a outra. */}
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={opcoes !== null}
            onClick={() => {
              setOpcoes((v) => (v === null ? ["", ""] : null));
              setCaixinha(false);
            }}
            className={`press min-h-[44px] flex-1 rounded-2xl px-3 text-[13px] font-semibold ${
              opcoes !== null ? "bg-white text-black" : "bg-white/12 text-white"
            }`}
          >
            📊 Enquete
          </button>
          <button
            type="button"
            aria-pressed={caixinha}
            onClick={() => {
              setCaixinha((v) => !v);
              setOpcoes(null);
            }}
            className={`press min-h-[44px] flex-1 rounded-2xl px-3 text-[13px] font-semibold ${
              caixinha ? "bg-white text-black" : "bg-white/12 text-white"
            }`}
          >
            💬 Caixinha
          </button>
        </div>

        {opcoes !== null && (
          <div className="space-y-2">
            {opcoes.map((o, n) => (
              <input
                key={n}
                value={o}
                onChange={(e) =>
                  setOpcoes((v) =>
                    (v ?? []).map((x, k) => (k === n ? e.target.value.slice(0, 60) : x)),
                  )
                }
                placeholder={`Opção ${n + 1}`}
                className="w-full rounded-xl bg-white/95 px-3 py-2.5 text-[14px] text-foreground"
              />
            ))}
            {opcoes.length < OPCOES_MAX && (
              <button
                type="button"
                onClick={() => setOpcoes((v) => [...(v ?? []), ""])}
                className="press text-[12px] text-white/80 underline underline-offset-2"
              >
                Mais uma opção
              </button>
            )}
          </div>
        )}

        {caixinha && (
          /* ⚠️ Diz que é ANÔNIMA aqui também, e não só do lado de quem
              pergunta: publicar a caixinha sem saber que as respostas vêm sem
              nome muda o que ela decide perguntar — e o que ela decide
              publicar. */
          <p className="text-center text-[12px] leading-snug text-white/75">
            Quem responder não aparece para você — a caixinha é anônima.
          </p>
        )}

        <button
          type="button"
          disabled={enviando || (opcoes !== null && !enqueteValida(limparOpcoes(opcoes)))}
          onClick={() => {
            setEnviando(true);
            aoPublicar({
              carimbar: carimbar && !!semana,
              /* ⚠️ A MESMA `limparOpcoes` do post — nunca um `filter` escrito
                 aqui, que aceitaria o que o servidor recusa. */
              enquete: opcoes ? limparOpcoes(opcoes) : [],
              perguntaAberta: caixinha,
            });
          }}
          className="press w-full rounded-2xl bg-white py-3 text-[15px] font-semibold text-black disabled:opacity-60"
        >
          {enviando ? "Publicando…" : "Publicar story"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O DESAFIO DA SEMANA — Fase 5
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O convite da criadora, no topo do feed.
 *
 * ⚠️ **Ela ENTRA — não é inscrita.** Agrupar automaticamente por `ref_code`
 * recriaria por fora o grupo compulsório que o código foi tirado do grafo de
 * amizade para não criar, e do qual não haveria como sair.
 *
 * ⚠️ **O contador é NÚMERO, e some abaixo de duas pessoas.** "3 de 300
 * fecharam" diz ao grupo que quase ninguém veio; "1 fechou" é ela mesma se
 * olhando no espelho. E nunca a lista de quem fechou — nem a de quem não.
 *
 * ⚠️ **E o texto não cobra.** É a mesma regra do empurrão da dupla: "você vai
 * perder" é o texto de todo app de streak e aqui cairia numa gestante que pode
 * estar internada.
 */
export function CartaoDoDesafio({
  desafio,
  aoEntrar,
  aoIrParaOJogo,
}: {
  desafio: DesafioNaTela;
  aoEntrar?: (entrar: boolean) => void;
  aoIrParaOJogo?: () => void;
}) {
  const a = ATIVIDADES_DO_DESAFIO.find((x) => x.chave === desafio.atividade);
  const fechei = desafio.meusDias >= desafio.diasAlvo;
  const doGrupo = fraseDoGrupo(desafio.quantasFecharam ?? 0);

  return (
    <section className="-mx-4 mb-2 border-b border-border bg-primary/[0.04] px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-primary">
        Desafio da semana
      </p>
      <p className="mt-1 text-[15px] font-semibold leading-snug">
        {a?.emoji} {a?.rotulo} em {desafio.diasAlvo} dias
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
        {desafio.deQuem} propôs para quem chegou pelo código dela.
      </p>

      {desafio.souParticipante ? (
        <>
          <p className="mt-2 text-[13px]">
            {fechei ? (
              <span className="font-semibold text-primary">Você fechou esta semana 💛</span>
            ) : (
              <>
                Você já fez <strong className="font-semibold">{desafio.meusDias}</strong> de{" "}
                {desafio.diasAlvo} dias.
              </>
            )}
          </p>
          {doGrupo && <p className="mt-0.5 text-[12px] text-muted-foreground">{doGrupo}</p>}
          <div className="mt-2 flex gap-2">
            {!fechei && aoIrParaOJogo && (
              <button
                type="button"
                onClick={aoIrParaOJogo}
                className="press flex-1 rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground"
              >
                Fazer agora
              </button>
            )}
            {aoEntrar && (
              <button
                type="button"
                onClick={() => aoEntrar(false)}
                className="press rounded-xl border border-border px-3 py-2 text-[13px]"
              >
                Sair
              </button>
            )}
          </div>
        </>
      ) : (
        aoEntrar && (
          <button
            type="button"
            onClick={() => aoEntrar(true)}
            className="press mt-2 w-full rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground"
          >
            Entrar no desafio
          </button>
        )
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A CAIXINHA — o lado de quem RESPONDE
   ══════════════════════════════════════════════════════════════════════════ */

export type PerguntaNaTela = {
  id: string;
  texto: string;
  criadoEm: string;
  resposta: string | null;
  postId: string | null;
};

/**
 * A caixa dela.
 *
 * ⚠️ **Nenhuma linha tem rosto, nome ou inicial** — e isso não é economia de
 * layout: é o recurso. A caixa ser anônima é o que faz alguém perguntar, e
 * qualquer pista de identidade aqui (uma inicial, uma cor derivada do id, um
 * "há 2 minutos" ao lado de quem acabou de seguir) devolve por dedução o que o
 * servidor recusou devolver por campo.
 *
 * ⚠️ **E a hora é GROSSA de propósito** (`haQuantoPublicou`, que passa a data
 * cheia depois de quatro semanas). Um carimbo de minuto exato numa caixa
 * anônima é o suficiente para cruzar com quem estava online.
 */
export function TelaDaCaixinha({
  perguntas,
  aceita,
  aoVoltar,
  aoAlternarCaixa,
  aoResponder,
  aoArquivar,
  aoDenunciar,
  aoAbrirPost,
}: {
  perguntas: PerguntaNaTela[];
  aceita: boolean;
  aoVoltar?: () => void;
  aoAlternarCaixa?: (aberta: boolean) => void;
  /** Devolve o recado do servidor quando a resposta é recusada, ou `null`. */
  aoResponder?: (id: string, resposta: string, v: Visibilidade) => Promise<string | null>;
  aoArquivar?: (id: string) => void;
  aoDenunciar?: (id: string, bloquear: boolean) => void;
  aoAbrirPost?: (postId: string) => void;
}) {
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("seguidores");
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [denunciando, setDenunciando] = useState<string | null>(null);

  const semResposta = perguntas.filter((p) => !p.resposta);
  const respondidas = perguntas.filter((p) => p.resposta);

  function fecharComposicao() {
    setRespondendo(null);
    setTexto("");
    setRecado(null);
  }

  return (
    <div className="pb-10">
      <header className="flex h-11 items-center gap-2 px-4">
        {aoVoltar && (
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Voltar"
            className="press -ml-1 text-xl leading-none"
          >
            ‹
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">Caixinha de perguntas</h1>
      </header>

      {/* ⚠️ O interruptor mora AQUI, e não numa tela de ajustes: quem quer
          fechar a caixa está olhando para o que chegou nela. */}
      <div className="mx-4 mt-1 rounded-2xl border border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Aceitar perguntas</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              Quem abre o seu perfil pode te mandar uma pergunta sem se identificar. Você responde
              quando quiser — e a resposta vira uma publicação sua.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={aceita}
            aria-label="Aceitar perguntas"
            onClick={() => aoAlternarCaixa?.(!aceita)}
            className={`press mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
              aceita ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-background transition-transform ${
                aceita ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
        {/* ⚠️ Fechar a caixa NÃO apaga o que já chegou, e a tela diz isso: sem
            a frase, quem fecha acha que perdeu as perguntas e não fecha. */}
        <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
          Fechando, ninguém manda perguntas novas — as que já chegaram continuam aqui.
        </p>
      </div>

      {perguntas.length === 0 && (
        <p className="mx-4 mt-6 text-center text-[13px] leading-snug text-muted-foreground">
          {aceita
            ? "Nenhuma pergunta ainda. Ela aparece aqui assim que alguém escrever."
            : "A caixinha está fechada. Ligue acima para começar a receber."}
        </p>
      )}

      {semResposta.length > 0 && (
        <>
          <h2 className="mx-4 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sem resposta
          </h2>
          <ul className="mt-1.5 flex flex-col gap-2 px-4">
            {semResposta.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border p-3">
                <p className="whitespace-pre-wrap text-[14px] leading-snug">{p.texto}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {haQuantoPublicou(p.criadoEm, Date.now())}
                </p>

                {respondendo === p.id ? (
                  <div className="mt-2">
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DO_TEXTO))}
                      rows={3}
                      placeholder="Sua resposta…"
                      aria-label="Sua resposta"
                      className="w-full resize-none rounded-lg border border-border bg-background p-2 text-[14px]"
                    />
                    <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                      {texto.length}/{LIMITE_DO_TEXTO}
                    </div>

                    {/* A mesma camada do compositor — a resposta é um post. */}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {VISIBILIDADES.map((v) => (
                        <button
                          key={v.chave}
                          type="button"
                          onClick={() => setVisibilidade(v.chave)}
                          className={`press rounded-full px-2.5 py-1 text-[12px] ${
                            visibilidade === v.chave
                              ? "bg-primary text-primary-foreground"
                              : "border border-border"
                          }`}
                        >
                          {v.rotulo}
                        </button>
                      ))}
                    </div>

                    {/* ⚠️ O recado vem do SERVIDOR e não é reescrito aqui: ele é
                        o único lugar que sabe por que a resposta foi recusada, e
                        um texto local divergiria da régua no primeiro ajuste. */}
                    {recado && (
                      <p className="mt-2 rounded-lg bg-muted/60 p-2 text-[12px] leading-snug">
                        {recado}
                      </p>
                    )}

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={fecharComposicao}
                        className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!texto.trim() || enviando || !aoResponder}
                        onClick={async () => {
                          if (!aoResponder) return;
                          setEnviando(true);
                          const r = await aoResponder(p.id, texto.trim(), visibilidade);
                          setEnviando(false);
                          /* `null` = publicou. Qualquer string é a recusa, e o
                             texto FICA no campo: ela precisa reescrever, não
                             recomeçar. */
                          if (r) setRecado(r);
                          else fecharComposicao();
                        }}
                        className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {enviando ? "Publicando…" : "Publicar resposta"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        fecharComposicao();
                        setRespondendo(p.id);
                        setMenu(null);
                      }}
                      className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground"
                    >
                      Responder
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenu((m) => (m === p.id ? null : p.id))}
                      aria-label="Opções desta pergunta"
                      className="press rounded-xl border border-border px-3 text-[15px] leading-none text-muted-foreground"
                    >
                      ⋯
                    </button>
                  </div>
                )}

                {menu === p.id && denunciando !== p.id && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        aoArquivar?.(p.id);
                      }}
                      className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                    >
                      Tirar da caixa
                    </button>
                    <button
                      type="button"
                      onClick={() => setDenunciando(p.id)}
                      className="press flex-1 rounded-xl border border-border py-1.5 text-[13px] text-destructive"
                    >
                      Denunciar
                    </button>
                  </div>
                )}

                {/* ⚠️ Denunciar e BLOQUEAR moram juntos porque a caixa é
                    anônima: pedir que ela "descubra quem foi e bloqueie no
                    perfil" é pedir o impossível, e sem esta porta a anonimidade
                    viraria impunidade. Ela continua sem saber quem é — a tela
                    não mostra nome nem inicial, nem antes nem depois. */}
                {denunciando === p.id && (
                  <div className="mt-2 rounded-xl bg-muted/60 p-3">
                    <p className="text-[13px] leading-snug">
                      Denunciar esta pergunta? Ela sai da sua caixa e fica registrada para a gente
                      olhar.
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDenunciando(null);
                          setMenu(null);
                          aoDenunciar?.(p.id, true);
                        }}
                        className="press w-full rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground"
                      >
                        Denunciar e bloquear quem escreveu
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDenunciando(null);
                          setMenu(null);
                          aoDenunciar?.(p.id, false);
                        }}
                        className="press w-full rounded-xl border border-border py-1.5 text-[13px]"
                      >
                        Só denunciar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDenunciando(null)}
                        className="press w-full rounded-xl py-1 text-[13px] text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {respondidas.length > 0 && (
        <>
          <h2 className="mx-4 mt-6 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Respondidas
          </h2>
          <ul className="mt-1.5 flex flex-col gap-2 px-4">
            {respondidas.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border p-3">
                <p className="whitespace-pre-wrap text-[13px] leading-snug text-muted-foreground">
                  {p.texto}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-snug">{p.resposta}</p>
                {p.postId && aoAbrirPost && (
                  <button
                    type="button"
                    onClick={() => aoAbrirPost(p.postId!)}
                    className="press mt-2 text-[13px] font-medium text-primary"
                  >
                    Ver a publicação
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * A PRÓXIMA LIVE, no topo do feed.
 *
 * ⚠️ **Ele NÃO promete conteúdo clínico nem desfecho.** É um aviso de horário:
 * o que acontece na live é o médico quem decide, e o cartão que a anuncia não
 * pode prometer em nome dele. Mesma proibição do rodapé de convite e das
 * frases do mascote.
 *
 * ⚠️ **Sem link, ele ainda vale** — anuncia a hora e some o botão. Um botão que
 * não leva a lugar nenhum é pior que a ausência dele, e a live pode ser
 * cadastrada com data antes de o endereço da sala existir.
 */
function CartaoDaLive({ live }: { live: LiveNoTopo }) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-3.5 py-3">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          live.aoVivo ? "animate-pulse bg-red-500" : "bg-primary/60"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
          {live.aoVivo ? "Ao vivo agora" : "Próxima live"}
        </p>
        <p className="truncate text-[14px] font-semibold leading-tight">{live.titulo}</p>
        {!live.aoVivo && (
          <p className="text-[12px] leading-tight text-muted-foreground">
            {quandoAcontece(live.quando, Date.now())}
          </p>
        )}
      </div>
      {live.link && (
        <a
          href={live.link}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          {live.aoVivo ? "Entrar" : "Ver"}
        </a>
      )}
    </div>
  );
}

/**
 * O selo da CONTA OFICIAL do consultório.
 *
 * ⚠️ Não confundir com o selo do OBSTETRA (em `quemReagiuAoPost`): aquele é
 * resolvido pelo vínculo atual e só aparece na lista que a autora abre, para
 * não contar a terceiros quem é a médica dela. Este identifica uma conta
 * institucional, e é público por natureza. Ver `conta-oficial.ts`.
 */
/**
 * O SELO DE ASSINANTE.
 *
 * ⚠️ **Precisa NÃO parecer o selo do consultório**, e é por isso que ele é uma
 * forma diferente e não a mesma estrela com outra cor: a oficial é um selo
 * recortado com um ✓ dentro (identifica a CLÍNICA); esta é uma folhinha —
 * a mesma família visual da Sementinha, que é a moeda do app. Se os dois
 * convergirem, a paciente lê "conta oficial" onde está escrito "assinante", e o
 * selo institucional deixa de valer alguma coisa.
 *
 * ⚠️ E ele NUNCA aparece sozinho: quem tem os dois vê os dois, na ordem
 * oficial → assinante, porque a identidade da clínica vem antes do plano.
 */
function SeloPremium() {
  return (
    <svg
      role="img"
      aria-label={SELO_PREMIUM}
      viewBox="0 0 24 24"
      className="ml-1 inline-block h-[13px] w-[13px] align-[-2px] text-emerald-600"
      fill="currentColor"
    >
      <title>{SELO_PREMIUM}</title>
      <path d="M20 3c-6.6 0-12 3.1-12 9 0 1.5.4 2.8 1.1 3.9L6 19l1.4 1.4 3.1-3.1c1.1.7 2.4 1.1 3.9 1.1 5.9 0 9-5.4 9-12 0-.7 0-1.4-.1-2-.7-.3-1.5-.4-2.3-.4Z" />
    </svg>
  );
}

function SeloOficial() {
  return (
    <svg
      role="img"
      aria-label={SELO_OFICIAL}
      viewBox="0 0 24 24"
      className="ml-1 inline-block h-[14px] w-[14px] align-[-2px]"
      fill="currentColor"
    >
      <title>{SELO_OFICIAL}</title>
      <path
        className="text-primary"
        fill="currentColor"
        d="M12 1.5 14.4 4l3.4-.4.9 3.3 3 1.7-1.4 3.1 1.4 3.1-3 1.7-.9 3.3-3.4-.4L12 22.5 9.6 20l-3.4.4-.9-3.3-3-1.7L4.7 12 3.3 8.9l3-1.7.9-3.3 3.4.4L12 1.5Z"
      />
      <path d="m10.8 15.3-3-3 1.3-1.3 1.7 1.7 4.1-4.1 1.3 1.3-5.4 5.4Z" fill="#fff" />
    </svg>
  );
}
