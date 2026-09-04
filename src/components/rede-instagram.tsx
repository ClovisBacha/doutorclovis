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
import { OnboardingDaComunidade } from "@/components/onboarding-da-comunidade";
import { codificarFoto } from "@/lib/codificar-imagem";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { intercalarDescobertas } from "@/lib/sugestoes";
import {
  MOTIVOS_SENSIVEIS,
  deveBorrar,
  rotuloDoMotivo,
  veuDoPost,
  type RazaoDoVeu,
} from "@/lib/conteudo-sensivel";
import {
  chaveDoRascunhoDeStory,
  lerRascunhoDeStory,
  paraGuardar as guardarRascunhoDeStory,
  type RascunhoDoStory,
} from "@/lib/rascunho-do-story";
import { type Filho, diasEntre, linhaDoPerfil, mesesEntre } from "@/lib/filhos";
import { marcosSugeridos, mesversarioDeHoje, textoDoMarco } from "@/lib/marcos";
import { SEGUNDOS_MAX, recadoDaRecusa, recusaDoVideo } from "@/lib/video-do-post";
import { MAXIMO_DE_FILHOS } from "@/lib/filhos.functions";
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
  LINK_DA_BIO_MAX,
  LIMITE_DO_TEXTO,
  MINIMO_DA_BUSCA,
  postEhValido,
  principaisReacoes,
  REACAO_DO_TOQUE_DUPLO,
  REACOES,
  textoDoAviso,
  totalDeReacoes,
  VISIBILIDADES,
  QUEM_COMENTA,
  QUEM_COMENTA_PADRAO,
  apertarQuemComenta,
  type QuemComenta,
  type AulaNoPost,
  type TipoDeReacao,
  type Visibilidade,
  TEXTO_DO_STORY_MAX,
  VISIBILIDADES_DO_STORY,
  VISIBILIDADE_DO_STORY_PADRAO,
  camadaDoStory,
  type VisibilidadeDoStory,
} from "@/lib/rede-social";
import { LIMITE_DA_PERGUNTA, recadoDoDesfecho, type DesfechoDaPergunta } from "@/lib/caixinha-tela";
import { publicarAtalhos, type AtalhoDaAba } from "@/lib/atalhos-da-aba";
import { MaisDaComunidade, type GrupoDoMais } from "./mais-da-comunidade";
import { CaixaDeEntrada, Conversa, MandarPublicacao, subirFoto } from "@/components/rede-conversa";
import { Comentarios } from "@/components/rede-comentarios";
import type { ConversaNaTela } from "@/lib/conversa.functions";
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
import { tagDaBusca } from "@/lib/mencoes";
import { BUSCAS_RECENTES_MAX, chaveDasBuscasRecentes, comBuscaNova } from "@/lib/sugestoes";
import { ChamarParaGrupo, ConversaDoGrupo, CriarGrupo, MeusGrupos } from "@/components/rede-grupo";
import type { GrupoNaTela } from "@/lib/grupo.functions";
import { CELULA_DA_GRADE, LADO_DA_MINIATURA, urlDaGrade, valeMiniatura } from "@/lib/miniatura";
import { criarPilhaDeTelas } from "@/lib/pilha-de-telas";
import { useVoltar } from "@/lib/use-voltar";
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
  StoryArquivado,
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
      <span className="w-full truncate text-center text-xs leading-tight text-foreground/80">
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
  aoAbrirMais,
}: {
  stories: Story[];
  aoTocar?: (id: string) => void;
  /**
   * A PRIMEIRA bolinha da fileira: ⊞ "Mais", que abre o hub de portas (Chá de
   * bebê, Amigas, Álbum, Nome, Acompanhante).
   *
   * ⚠️ Ela mora AQUI, e não num cabeçalho, porque o cabeçalho do feed saiu a
   * pedido do dono ("o primeiro elemento da aba será os stories"). Sem ela, o
   * hub só se alcançava tocando de novo no ícone da barra — um gesto que nada
   * anuncia — e as cinco portas ficavam a quatro toques atrás de um segredo
   * (estudo de navegação, set/2026).
   *
   * ⚠️ PRIMEIRA, não última: com cinco stories ela caía fora da tela (medido:
   * x=544 num viewport de 393) — uma porta que só aparece rolando é o defeito
   * que ela veio consertar.
   */
  aoAbrirMais?: () => void;
}) {
  if (stories.length === 0 && !aoAbrirMais) return null;
  return (
    <div className="-mx-4 border-b border-border">
      {/* Rola na horizontal e sangra nas laterais — a última bolinha tem de
          encostar na borda da tela, senão a fileira parece ter acabado. */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {aoAbrirMais && (
          <button
            type="button"
            onClick={aoAbrirMais}
            aria-label="Mais da Comunidade: chá de bebê, amigas, álbum e acompanhante"
            className="press flex shrink-0 flex-col items-center gap-1"
            style={{ width: CAIXA_DO_STORY + 12 }}
          >
            <span
              className="flex items-center justify-center rounded-full border-2 border-dashed border-primary/50 bg-primary/5 text-primary"
              style={{ width: CAIXA_DO_STORY, height: CAIXA_DO_STORY }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
                <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
                <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
                <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
              </svg>
            </span>
            <span className="w-full truncate text-center text-xs text-muted-foreground">Mais</span>
          </button>
        )}
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
 * ⚠️ `EscolherMotivo` MUDOU DE ARQUIVO — ver `escolher-motivo.tsx`.
 *
 * Ela é usada pela Comunidade E pela fila do painel, e importá-la daqui puxava
 * `rede-instagram.tsx` inteiro para o pacote do painel — junto com a régua
 * clínica, que tem `(?<!` nas fronteiras e não pode viajar para lá. A catraca
 * "a régua clínica não entra no pacote do navegador" pegou na hora.
 *
 * A re-exportação existe para não quebrar quem já a importava daqui.
 */
import { EscolherMotivo } from "@/components/escolher-motivo";
export { EscolherMotivo };

/**
 * O PINO.
 *
 * ⚠️ **DESENHADO, e não 📌.** O emoji sai com cores próprias em cada sistema
 * (vermelho no iOS, cinza-azulado no Android) e não tem dois estados — e aqui
 * ele PRECISA distinguir "fixado" de "fixar", que é a diferença entre um toque
 * inofensivo e desfixar sem querer. É a mesma lição do 📞 da emergência e do
 * marcador de salvar.
 */
/**
 * O ícone de "pôr no story" — um retângulo de story com um ⊕.
 *
 * ⚠️ Desenhado, e não um emoji: nenhum emoji quer dizer "story", e os
 * candidatos (📖, ➕, 🔄) já significam outra coisa em outro lugar desta mesma
 * fileira.
 */
function IconeStoryDePost() {
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
      <rect x="4" y="2.5" width="16" height="19" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function IconePino({ aceso }: { aceso: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[17px] w-[17px]"
      /* Cheio quando aceso: a silhueta preenchida lê como "está ligado" à
         primeira vista, sem depender só da cor — que é o que falta para quem
         não distingue bem os tons. */
      fill={aceso ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3h6l-1 5 3.5 3.5H6.5L10 8z" />
      <path d="M12 11.5V21" />
    </svg>
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
  altTexto,
  autorNome,
}: {
  urls: string[];
  aoToqueDuplo?: () => void;
  /** "Então e agora": os rótulos das DUAS primeiras fotos. */
  comparacao?: { antes: string; agora: string } | null;
  /** A descrição que a autora escreveu. Ver o `alt` abaixo. */
  altTexto?: string | null;
  /** Para o `alt` genérico quando não há descrição. */
  autorNome?: string;
}) {
  const [i, setI] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  /* Muda a cada toque duplo: é a CHAVE do elemento, e trocar a chave é o que
     reinicia a animação. Sem isso, o segundo toque duplo seguido não desenha
     coração nenhum — o elemento já existe e o CSS não recomeça sozinho. */
  const [batida, setBatida] = useState(0);
  const desce = useRef({ x: 0, y: 0 });
  const ultimo = useRef(0);
  /**
   * ⚠️ **ATÉ QUE FOTO DO CARROSSEL JÁ PODE BAIXAR** — e este número existe
   * porque `loading="lazy"` NÃO resolve o eixo horizontal.
   *
   * Medido no Chromium, numa página com o mesmo formato deste carrossel: em
   * seis publicações de cinco fotos, ele baixa **três fotos de cada uma das
   * cinco primeiras** — quinze arquivos — enquanto a paciente vê UMA. O `lazy`
   * funciona descendo (as publicações lá embaixo não vêm) e não funciona para
   * o lado: as fotos 2 e 3 estão fora da tela e vêm assim mesmo.
   * `width`/`height` no `<img>` não muda nada — medido com e sem.
   *
   * ⚠️ **A REGRA É "a da vez MAIS a seguinte", e não só a da vez.** Segurar
   * tudo menos a primeira economizaria mais e cobraria em outra moeda: a foto
   * seguinte apareceria EM BRANCO durante o deslize, numa rede ruim, e o
   * deslize é justamente o gesto com que ela descobre que há mais foto. Numa
   * publicação de ultrassom isso é péssimo. Com a vizinha pronta, o carrossel
   * continua instantâneo e ainda assim são DUAS em vez de três.
   *
   * A conta com o tamanho real de uma foto nossa em WebP: um carrossel de
   * cinco custa **170 kB em vez de 255**, sem tirar nitidez de nada.
   *
   * Ele só SOBE (`Math.max`): voltar para a primeira não pode descarregar o
   * que já veio, senão folhear para trás baixaria tudo de novo.
   */
  const [ate, setAte] = useState(0);

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
          /* Libera a vizinha assim que o dedo começa a andar — o `scroll`
             dispara no primeiro pixel, muito antes de o encaixe terminar. */
          setAte((v) => Math.max(v, n + 1));
        }}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ aspectRatio: String(RAZAO_DO_POST) }}
      >
        {urls.map((u, n) => (
          <div key={n} className="relative w-full shrink-0 snap-center overflow-hidden bg-muted/40">
            {/* ⚠️ **`alt` NUNCA VAZIO, e a diferença é entre "existe uma foto
                aqui" e silêncio.** `alt=""` faz o leitor de tela PULAR a imagem:
                quem navega assim nem saberia que há uma publicação com foto. Com
                descrição, ela é lida; sem, entra o genérico com o nome de quem
                publicou — que é pouco, mas é verdade. */}
            <img
              /* ⚠️ Sem `src` a imagem não é pedida — é isso que segura o
                 download. O `<div>` continua ocupando a largura inteira, então
                 a geometria do encaixe não muda e o carrossel não pula. */
              src={n <= ate + 1 ? u : undefined}
              alt={
                altTexto?.trim()
                  ? urls.length > 1
                    ? `${altTexto.trim()} (foto ${n + 1} de ${urls.length})`
                    : altTexto.trim()
                  : `Publicação de ${autorNome ?? "alguém"}${urls.length > 1 ? `, foto ${n + 1} de ${urls.length}` : ""}`
              }
              className="h-full w-full object-cover"
              loading="lazy"
            />
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
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
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
/**
 * O véu do conteúdo sensível.
 *
 * ⚠️ **BORRA, NUNCA ESCONDE — e essa é a diferença que importa.** Esconder
 * seria o app decidindo que aquilo não deve ser lido, e a experiência de quem
 * perdeu uma gestação é exatamente o que esta comunidade não pode calar. O que
 * ele faz é dar UM SEGUNDO para a leitora decidir.
 *
 * ⚠️ **O rótulo diz o ASSUNTO sem contar a história** (catálogo fechado, ver
 * `conteudo-sensivel.ts`): é o que ela lê ANTES de escolher.
 */
function Sensivel({
  motivo,
  razao,
  aoRevelar,
  children,
}: {
  motivo: string | null | undefined;
  /**
   * Por que está recolhido.
   *
   * ⚠️ **`"palavra"` NÃO diz QUAL palavra**, e isso é o recurso: ela escondeu
   * aquilo de propósito, e escrever a palavra no rótulo entregaria exatamente o
   * que o filtro existe para não entregar.
   */
  razao?: RazaoDoVeu;
  aoRevelar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* `select-none` e `pointer-events-none`: sob o véu nada é tocável nem
          copiável — senão o toque atravessaria para o carrossel por baixo. */}
      <div className="pointer-events-none select-none blur-2xl" aria-hidden>
        {children}
      </div>
      <button
        type="button"
        onClick={aoRevelar}
        className="press absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/40 px-6 text-center"
      >
        <span className="text-[13px] font-semibold">
          {razao === "palavra" ? "Escondido pelo seu filtro de palavras" : rotuloDoMotivo(motivo)}
        </span>
        <span className="text-xs text-muted-foreground">Toque para ver</span>
      </button>
    </div>
  );
}

export const PostInstagram = memo(function PostInstagram({
  post,
  aoReagir,
  aoAbrirPerfil,
  aoSalvar,
  aoRepublicar,
  aoCompartilhar,
  aoLinkPublico,
  aoStoryComPost,
  aoAbrirTag,
  aoMandarParaConversa,
  aoAbrirArroba,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoTirarMarcacao,
  aoVerQuemReagiu,
  aoEditar,
  aoFixar,
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
  /** Republicar. Só chega onde cabe — ver o comentário do botão. */
  aoRepublicar?: (post: PostNaTela) => void;
  /** Compartilhar para fora. Só a própria — ver `compartilhar-post.ts`. */
  aoCompartilhar?: (post: PostNaTela) => void;
  /**
   * Abre (ou fecha) o LINK PÚBLICO desta publicação.
   *
   * ⚠️ **É OUTRA coisa que o ↗.** O ↗ tira a FOTO do app (`navigator.share`
   * com o arquivo); isto entrega um ENDEREÇO que abre sem conta nenhuma — é
   * assim que uma publicação chega ao WhatsApp da família.
   *
   * ⚠️ **Só na própria, e só na camada `publico`** — quem confere é o servidor.
   * Um link para um post `amigas` seria a porta dos fundos da visibilidade: o
   * desabafo escrito para seis pessoas passaria a abrir sem conta nenhuma.
   */
  aoLinkPublico?: (post: PostNaTela) => void;
  /** Levar esta publicação para o compositor de story. */
  aoStoryComPost?: (post: PostNaTela) => void;
  /** Abrir a página de uma `#`. */
  aoAbrirTag?: (tag: string) => void;

  /** Abre a folha de mandar esta publicação para uma conversa. */
  aoMandarParaConversa?: (post: PostNaTela) => void;
  /** Abrir o perfil por trás de um `@`. Ver `TextoComLinks`. */
  aoAbrirArroba?: (handle: string) => void;
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
  /** Fixar (ou soltar) no topo do perfil. Só no post dela. */
  aoFixar?: (post: PostNaTela, fixar: boolean) => void;
  /** Ver quem reagiu. Só no post DELA — ver a nota na linha de ações. */
  aoVerQuemReagiu?: (post: PostNaTela) => void;
  /** Veio do algoritmo, não de quem ela segue. */
  sugerido?: boolean;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /**
   * ⚠️ **"REVELADO" É POR LEITURA, e NUNCA é gravado.**
   *
   * Guardar que ela já revelou faria o aviso valer uma vez só — e o segundo
   * encontro com o mesmo post, numa noite pior, chegaria sem aviso nenhum.
   */
  const [revelado, setRevelado] = useState(false);
  /**
   * A régua mora em `conteudo-sensivel.ts`, e ela tem DUAS razões: a marca da
   * autora e o FILTRO DE PALAVRAS dela.
   *
   * ⚠️ **O filtro não alcançava o feed** — protegia comentários e direct, e a
   * palavra que ela escondeu a atingia rolando, no lugar mais exposto do app. O
   * véu é o mesmo (caixa do tamanho da foto, sem mídia no DOM); o que muda é o
   * rótulo, e é ele que ela lê antes de decidir.
   */
  const razaoDoVeu = veuDoPost({
    sensivel: !!post.sensivel,
    batePalavra: !!post.batePalavraMinha,
    souAAutora: !!post.souAAutora,
    revelado,
  });
  const borrar = razaoDoVeu !== null;
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
              <span className="block text-xs leading-tight text-muted-foreground">
                Sugerido para você
              </span>
            )}
            {/* ⚠️ "com Marina e Carol" — até dois nomes por extenso, do terceiro
                em diante contagem. Cinco nomes estouram a largura de um iPhone
                e empurram a hora do post para a linha de baixo. Régua em
                `marcacoes.ts`, testada. */}
            {textoDeMarcadas(post.marcadas.map((m) => m.nome)) && (
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {textoDeMarcadas(post.marcadas.map((m) => m.nome))}
              </span>
            )}
            {/* ⚠️ **O LUGAR É TEXTO, e NÃO um link para um mapa.** O rótulo é o
                que ela escreveu; transformá-lo em endereço convidaria a tela a
                resolver a localização — e é exatamente isso que este campo
                existe para não fazer. */}
            {post.lugar && (
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                📍 {post.lugar}
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
        {/* 📌 Fixar — só no post DELA, e ao lado do lápis pela mesma razão:
            é um CONSERTO da vitrine, não uma ação de fim de linha. A grade do
            perfil é cronológica pura, e é isso que faz o primeiro ultrassom
            afundar embaixo de trezentas fotos.

            ⚠️ **Aceso quando já está fixado**, com o rótulo dizendo o que o
            toque faz: um pino que parece igual nos dois estados obriga a tocar
            para descobrir — e aqui descobrir custa desfixar sem querer. */}
        {post.souAAutora && aoFixar && (
          <button
            type="button"
            onClick={() => aoFixar(post, !post.fixadoEm)}
            aria-label={post.fixadoEm ? "Soltar do topo do perfil" : "Fixar no topo do perfil"}
            aria-pressed={!!post.fixadoEm}
            className={`press grid h-11 w-9 shrink-0 place-items-center ${
              post.fixadoEm ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <IconePino aceso={!!post.fixadoEm} />
          </button>
        )}
        {((post.souAAutora && aoApagar) ||
          (!post.souAAutora && aoDenunciar) ||
          (post.souMarcada && aoTirarMarcacao)) && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label="Opções da publicação"
            className="press grid h-11 w-11 shrink-0 place-items-center text-lg leading-none text-muted-foreground"
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
            className="press inline-flex min-h-[44px] items-center text-xs font-medium text-muted-foreground underline underline-offset-2"
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

      {/* ⚠️ `!post.videoUrl` — o vídeo tem prioridade e o carrossel se cala.
          Ver o comentário do player, logo abaixo. */}
      {/* ⚠️ **SOB O VÉU NÃO HÁ IMAGEM NENHUMA — nem borrada.**
          Borrar a foto de verdade com CSS ainda a BAIXA e a deixa no DOM: quem
          quisesse a leria pelo inspetor, e o 4G dela pagaria por uma foto que
          ela decidiu não ver. Aqui entra uma caixa do MESMO tamanho, e o
          carrossel só é montado quando ela toca — a foto nem sai do servidor.

          ⚠️ E o tamanho tem de bater (`aspect-[4/5]`, o teto do feed): com uma
          caixa menor, revelar empurraria o feed inteiro para baixo e ela
          perderia o lugar onde estava lendo. */}
      {post.imagemUrl && !post.videoUrl && borrar ? (
        <Sensivel
          motivo={post.motivoSensivel}
          razao={razaoDoVeu ?? undefined}
          aoRevelar={() => setRevelado(true)}
        >
          <div className="aspect-[4/5] w-full bg-muted" />
        </Sensivel>
      ) : null}
      {post.imagemUrl && !post.videoUrl && !borrar && (
        <Carrossel
          urls={fotos}
          comparacao={post.comparacao}
          altTexto={post.altTexto}
          autorNome={post.autorNome}
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
            /* ⚠️ 44px de ALTURA: a fileira de emojis desenha 22px, e é ela que
               a autora toca para ver quem respondeu ao post dela. */
            className="press flex min-h-[44px] min-w-0 items-center gap-1.5"
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
        {/* ⚠️ **REPUBLICAR SÓ APARECE ONDE ELE CABE**, e as três condições são
            as três formas de o botão mentir: no post DELA seria uma cópia de si
            mesma; num post que não é público, republicar ampliaria a audiência
            que a autora escolheu; e num post que JÁ é republicação, o quadro
            apontaria para outro quadro. O servidor confere as três de novo. */}
        {aoRepublicar && !post.souAAutora && post.visibilidade === "publico" && !post.ehRepost && (
          <button
            type="button"
            onClick={() => aoRepublicar(post)}
            aria-label="Republicar"
            className="press ml-auto flex h-11 w-11 items-center justify-center leading-none text-[15px]"
          >
            ↻
          </button>
        )}
        {/* ⚠️ **COMPARTILHAR SÓ A PRÓPRIA PUBLICAÇÃO.** A régua está em
            `compartilhar-post.ts`, e a razão é que aqui não existe página
            pública de post: o que sairia é a FOTO, e foto que sai do app não
            volta. Compartilhar a ultrassom de outra paciente no WhatsApp da
            família é tirar dela a decisão de onde a imagem circula. */}
        {aoCompartilhar && post.souAAutora && (
          <button
            type="button"
            onClick={() => aoCompartilhar(post)}
            aria-label="Compartilhar"
            className="press ml-auto flex h-11 w-11 items-center justify-center leading-none text-[15px]"
          >
            ↗
          </button>
        )}
        {/* ⚠️ O LINK só aparece na PRÓPRIA publicação e na camada `publico` — e
            o servidor reconfere as duas coisas. */}
        {aoLinkPublico && post.souAAutora && post.visibilidade === "publico" && (
          <button
            type="button"
            onClick={() => aoLinkPublico(post)}
            aria-label="Link da publicação"
            className="press flex h-11 w-11 items-center justify-center leading-none text-[15px]"
          >
            🔗
          </button>
        )}
        {/* 📖 **ADICIONAR AO SEU STORY.**

            ⚠️ **A régua é a do ↻ republicar, e NÃO a do ↗ compartilhar.** O ↗
            tira a FOTO do app e a solta no mundo, e por isso só vale na própria
            publicação; isto aqui põe o ENDEREÇO dela dentro de um story, onde
            quem abrir passa por `podeVerPost` como em qualquer outro lugar — se
            a pessoa não podia ver, continua não podendo.

            ⚠️ **Só publicação PÚBLICA**, e o servidor reconfere (camada E perfil
            da autora). Um story alcança todas as seguidoras: deixar
            compartilhar a camada `amigas` faria o story ser a porta dos fundos
            da visibilidade — o desabafo escrito para seis chegaria a trezentas.

            ⚠️ **E não vale na própria**: para a dela existe o ↗ e o próprio
            compositor. Oferecer os dois no mesmo cartão faria a paciente
            escolher entre duas coisas que ela não tem como distinguir. */}
        {aoStoryComPost &&
          !post.souAAutora &&
          post.visibilidade === "publico" &&
          !post.ehRepost && (
            <button
              type="button"
              onClick={() => aoStoryComPost(post)}
              aria-label="Adicionar ao seu story"
              className="press flex h-11 w-11 items-center justify-center text-[15px] leading-none"
            >
              <IconeStoryDePost />
            </button>
          )}
        {/* ⚠️ **MANDAR PARA UMA AMIGA VALE PARA QUALQUER PUBLICAÇÃO — inclusive
            a de outra pessoa — e isso NÃO contradiz a régua do ↗ acima.** São
            duas coisas diferentes: o ↗ tira a FOTO do app e a solta no mundo
            (irreversível, e por isso só a própria); este manda o ENDEREÇO do
            post para dentro de uma conversa, onde quem abrir passa por
            `postQueEuVejo` como em qualquer outro lugar. Se a pessoa não podia
            ver o post, continua não podendo. */}
        {aoMandarParaConversa && (
          <button
            type="button"
            onClick={() => aoMandarParaConversa(post)}
            aria-label="Mandar para uma conversa"
            className="press flex h-11 w-11 items-center justify-center leading-none text-[15px]"
          >
            ✈
          </button>
        )}
        {aoSalvar && (
          <button
            type="button"
            onClick={() => aoSalvar(post, !post.salvo)}
            aria-label={post.salvo ? "Tirar dos salvos" : "Salvar"}
            aria-pressed={post.salvo}
            /* ⚠️ 44px: o marcador desenha 22×22 e o alvo media o desenho. */
            className={`press flex h-11 w-11 items-center justify-center leading-none ${
              aoRepublicar && !post.souAAutora && post.visibilidade === "publico" && !post.ehRepost
                ? "ml-1"
                : "ml-auto"
            }`}
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
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
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
            <p className="pt-0.5 text-xs text-muted-foreground">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

      {/* ⚠️ **A ORIGINAL VEM NUM QUADRO, e o que ela NÃO tem importa.** Sem
          reações, sem botão de salvar, sem comentário: quem interage é a
          republicação. Repetir os controles faria a paciente reagir ao quadro
          achando que reage à autora original — e o número iria para o lugar
          errado.

          ⚠️ E "publicação não disponível" NÃO é uma falha a esconder: é o
          estado de quando a autora arquivou. Mostrar uma cópia do texto faria a
          republicação sobreviver à decisão dela de tirar do ar. */}
      {post.ehRepost && (
        <div className="mx-4 mt-2 rounded-xl border border-border p-3">
          {post.repost ? (
            <>
              <button
                type="button"
                onClick={() => aoAbrirPerfil?.(post.repost!.autorId)}
                className="press text-xs font-semibold"
              >
                {post.repost.autorNome}
              </button>
              {post.repost.texto && (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug">
                  {post.repost.texto}
                </p>
              )}
              {post.repost.imagemUrl && (
                <img
                  src={post.repost.imagemUrl}
                  alt=""
                  className="mt-2 w-full rounded-lg object-cover"
                />
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Publicação não disponível.</p>
          )}
        </div>
      )}

      {/* ⚠️ **O VÍDEO SUBSTITUI O CARROSSEL, nunca convive com ele.** Um post
          é uma coisa ou outra; deixar os dois faria a paciente rolar fotos e
          encontrar um vídeo tocando no meio, com o som do anterior ainda
          rodando. O compositor já impede escolher os dois. */}

      {/* ⚠️ `playsInline` É OBRIGATÓRIO — sem ele o iPhone abre o vídeo em TELA
          CHEIA ao tocar, tirando a paciente do feed. `muted` porque autoplay
          com som é recusado por todo navegador e, aqui, seria pior se
          funcionasse: som saindo sozinho numa sala de espera. `preload` só dos
          metadados: o feed não pode baixar todo vídeo que passa pela tela no
          4G dela. */}
      {post.videoUrl &&
        (borrar ? (
          <Sensivel
            motivo={post.motivoSensivel}
            razao={razaoDoVeu ?? undefined}
            aoRevelar={() => setRevelado(true)}
          >
            <div className="mt-1 aspect-[4/5] w-full bg-black" />
          </Sensivel>
        ) : (
          <>
            <video
              src={post.videoUrl}
              className="mt-1 w-full bg-black"
              controls
              loop
              muted
              playsInline
              preload="metadata"
            />
            {/* ⚠️ **A LEGENDA FICA ABAIXO, e não numa faixa sobre o vídeo.**
                Sobreposta, ela cobre justamente o que a paciente está olhando —
                e num vídeo de barriga o centro do quadro é o assunto. Aqui ela
                serve aos dois casos que motivaram o recurso: quem usa leitor de
                tela, e a mãe que assiste sem som com o bebê dormindo no colo. */}
            {post.videoLegenda && (
              <p className="mx-4 mt-1.5 text-[13px] leading-snug text-muted-foreground">
                {post.videoLegenda}
              </p>
            )}
          </>
        ))}

      {/* ⚠️ O MARCO É CALCULADO NA PINTURA, a partir dos DIAS que o banco
          guarda — nunca de um texto gravado. Um "3 meses" salvo continuaria
          dizendo "3 meses" daqui a um ano, e o álbum inteiro passaria a mentir
          a idade. Aqui o post de um ano atrás segue contando a idade que o bebê
          tinha naquele dia. */}
      {post.marco && textoDoMarco(post.marco.tipo, post.marco.dias) && (
        <div className="mx-4 mt-2 rounded-xl bg-primary/10 px-3 py-2">
          <p className="text-[13px] font-semibold leading-snug">
            {textoDoMarco(post.marco.tipo, post.marco.dias)}
          </p>
        </div>
      )}

      {/* ⚠️ **O TEXTO TAMBÉM ENTRA NO VÉU, e não só a mídia.** Numa publicação
          sobre uma perda, é a LEGENDA que carrega a notícia — borrar a foto e
          deixar a frase à mostra entregaria exatamente o que o aviso existe para
          poupar. O NOME fica de fora: quem publicou não é a parte sensível, e
          escondê-lo faria o post parecer anônimo. */}
      {post.texto && (
        <p className="px-4 pt-1.5 text-[14px] leading-snug">
          <span className="font-semibold">{post.autorNome}</span>
          {post.autorOficial && <SeloOficial />}
          {post.autorPremium && <SeloPremium />}{" "}
          {borrar ? (
            <button
              type="button"
              onClick={() => setRevelado(true)}
              className="press italic text-muted-foreground"
            >
              {rotuloDoMotivo(post.motivoSensivel)} — toque para ler
            </button>
          ) : (
            <TextoComLinks
              texto={post.texto}
              aoAbrirArroba={aoAbrirArroba}
              aoAbrirTag={aoAbrirTag}
            />
          )}
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
      <p className="px-4 pt-1 text-xs text-muted-foreground">
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
/**
 * O cartão da MEMÓRIA — "há um ano, você publicou isto".
 *
 * ⚠️ **NÃO HÁ CONDIÇÃO NENHUMA AQUI.** Quem decide se esta memória pode existir
 * é `memoriaDeHoje`, com as CINCO travas, no servidor. Uma segunda régua nesta
 * tela é como a foto da barriga de uma gestação que terminou volta na abertura
 * do app — e este é o recurso da aba que mais pode machucar com um acerto de
 * calendário.
 *
 * ⚠️ **O texto NÃO COMEMORA.** "Que ano incrível!" cai numa mulher que pode ter
 * passado o ano no hospital. `textoDaMemoria` diz o FATO e para aí, e ele vem
 * pronto do servidor — escrevê-lo aqui abriria a porta para o adjetivo.
 */
function CartaoDaMemoria({
  memoria,
  aoVer,
}: {
  memoria: { post: PostNaTela; texto: string };
  aoVer?: (postId: string) => void;
}) {
  /* ⚠️ **A marca de "vista" sai daqui, do MONTAR — e não do servidor.** A tela
     mostra um cartão de cada vez, então uma memória suprimida pela retrospectiva
     seria queimada sem nunca ter aparecido. E a Trava 4 vale para a vida toda:
     ela não voltaria.
     ⚠️ `useRef` porque o efeito pode rodar duas vezes em desenvolvimento, e o
     `id` nas deps porque a memória do dia seguinte é outra. */
  const marcada = useRef<string | null>(null);
  useEffect(() => {
    if (marcada.current === memoria.post.id) return;
    marcada.current = memoria.post.id;
    aoVer?.(memoria.post.id);
  }, [memoria.post.id, aoVer]);

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-border">
      <p className="bg-muted px-3 py-2 text-[13px] font-semibold text-foreground">
        {memoria.texto}
      </p>
      {/* ⚠️ **16:10, e não o 4:5 do feed — a razão é a DOBRA, e foi medida.**
          Com a proporção do feed o cartão dava ~460px e empurrava o primeiro
          post para y=839 num aparelho de 852: treze pixels de publicação
          visível, ou seja, o feed inteiro fora da dobra. É exatamente o arranjo
          que o dono pediu para corrigir, e a razão pela qual só um cartão
          aparece por vez.
          ⚠️ E `cover`, não `contain`: num recorte de 245px o `contain` deixaria
          a foto vertical com 160px de largura no meio de 393, cercada de vazio.
          O recorte CENTRAL de uma foto de barriga mostra a barriga. */}
      {memoria.post.imagemUrl && (
        <img
          src={memoria.post.miniaturaUrl ?? memoria.post.imagemUrl}
          alt={memoria.post.altTexto ?? "A sua publicação de um ano atrás"}
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      {memoria.post.texto && (
        <p className="px-3 py-2 text-[13px] text-muted-foreground">{memoria.post.texto}</p>
      )}
    </div>
  );
}

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
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sua semana</p>
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
  aoAbrirSecoes,
  pausada = false,
  suspensa = false,
  aoReativar,
  soSeguindo = false,
  stories = [],
  sugestoes = [],
  pessoas = [],
  aoSeguirPessoa,
  aoReagir,
  aoSalvar,
  aoRepublicar,
  aoCompartilhar,
  aoAbrirTag,
  instavel,
  aoTentarDeNovo,
  aoMandarParaConversa,
  aoAbrirArroba,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoTirarMarcacao,
  aoEditar,
  aoFixar,
  aoStoryComPost,
  aoVerQuemReagiu,
  retro,
  aoFecharRetro,
  memoria,
  aoVerMemoria,
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
  /** Abre o hub de portas da Comunidade — a bolinha ⊞ "Mais" da fileira. */
  aoAbrirSecoes?: () => void;
  /**
   * A leitura do feed FALHOU — diferente de "não há nada".
   *
   * ⚠️ Os dois são a mesma imagem e conclusões opostas: no vazio ela convida
   * uma amiga; na falha ela acha que as amigas sumiram. O servidor distingue
   * (`ctx.degradado`), e esta prop é o outro lado.
   */
  instavel?: boolean;
  /** Refaz a leitura. Sem a prop, o botão de tentar de novo não aparece. */
  aoTentarDeNovo?: () => void;
  /**
   * A conta dela está pausada na rede.
   *
   * ⚠️ **A FAIXA É OBRIGATÓRIA, senão o interruptor parece quebrado.** A pausa
   * esconde ela dos OUTROS — e o feed é o que ela vê, então sem a faixa nada
   * muda na tela dela e a conclusão razoável é que a pausa não pegou. Aí ela
   * publica imaginando que está invisível.
   */
  pausada?: boolean;
  /**
   * ⚠️ **Decisão da PLATAFORMA, e não dela.** As três (luto, pausa, suspensão)
   * escondem a pessoa pela mesma régua; o que as separa é quem decidiu — e por
   * isso esta é a ÚNICA em que o app FALA. Uma conta que some da Comunidade sem
   * uma palavra faz a paciente concluir que o app quebrou.
   */
  suspensa?: boolean;
  /** Sem a prop, a faixa avisa e não oferece o caminho de volta. */
  aoReativar?: () => void;
  posts: PostNaTela[];
  /** `true` = a paciente pediu para ver só quem ela segue. Ver `feed_so_seguindo`. */
  soSeguindo?: boolean;
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
  /** Republicar. Só chega onde cabe — ver o comentário do botão. */
  aoRepublicar?: (post: PostNaTela) => void;
  /** Compartilhar para fora. Só a própria — ver `compartilhar-post.ts`. */
  aoCompartilhar?: (post: PostNaTela) => void;
  /** O link público desta publicação — ver `PostInstagram`. */
  aoLinkPublico?: (post: PostNaTela) => void;
  /** Abrir a página de uma `#`. */
  aoAbrirTag?: (tag: string) => void;
  /** Abre a folha de mandar esta publicação para uma conversa. */
  aoMandarParaConversa?: (post: PostNaTela) => void;
  /** Abrir o perfil por trás de um `@`. Ver `TextoComLinks`. */
  aoAbrirArroba?: (handle: string) => void;
  aoApagar?: (post: PostNaTela) => void;
  /** Denunciar o post de outra pessoa. Ver `PostInstagram`. */
  aoDenunciar?: (post: PostNaTela, motivo: MotivoDaDenuncia) => void;
  aoVotar?: (post: PostNaTela, opcao: number) => void;
  /** Tirar a PRÓPRIA marcação — ver `PostInstagram`. */
  aoTirarMarcacao?: (post: PostNaTela) => void;
  /** Salvar a legenda editada — ver `PostInstagram`. */
  aoEditar?: (post: PostNaTela, texto: string) => Promise<boolean>;
  aoFixar?: (post: PostNaTela, fixar: boolean) => void;
  aoStoryComPost?: (post: PostNaTela) => void;
  /** Ver quem reagiu. Só no post DELA. */
  aoVerQuemReagiu?: (post: PostNaTela) => void;
  /** O resumo da semana, ou `null`. Ver `CartaoDaSemana`. */
  retro?: Retrospectiva | null;
  /**
   * A memória do dia — "há um ano, você publicou isto".
   *
   * ⚠️ Quem DECIDE se ela existe é `memoriaDeHoje` (pura, com as CINCO travas),
   * no servidor. Aqui só se desenha: uma condição a mais nesta tela seria a
   * segunda régua do recurso mais perigoso da aba.
   */
  memoria?: { post: PostNaTela; texto: string } | null;
  /** Marca a memória como vista. Chamada quando o cartão MONTA. */
  aoVerMemoria?: (postId: string) => void;
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
  /**
   * ⚠️ O CONJUNTO, e não `sugestoes.some(...)` dentro do laço: com 20 postagens
   * e 10 descobertas isso seriam 200 comparações a cada pintura do feed, e o
   * feed repinta a cada reação.
   */
  const idsSugeridos = useMemo(() => new Set(sugestoes.map((p) => p.id)), [sugestoes]);

  /**
   * O QUE VAI À TELA.
   *
   * ⚠️ No modo fechado a lista é a dela e nada mais — costurar descobertas ali
   * seria ignorar a configuração que ela ligou.
   */
  const naTela = useMemo(
    (): PostNaTela[] => (soSeguindo ? posts : intercalarDescobertas(posts, sugestoes)),
    [soSeguindo, posts, sugestoes],
  );

  /**
   * ⚠️ **A ZONA DE "PUBLICAÇÕES SUGERIDAS" NO RODAPÉ SAIU — ela não tinha
   * estado válido nenhum.**
   *
   * Ela nasceu no arranjo do "você está em dia": as descobertas só apareciam
   * DEPOIS que o feed de quem ela segue acabava, abaixo de um divisor. Esse
   * arranjo foi revertido a pedido do dono (ver o cabeçalho de `sugestoes.ts`)
   * e hoje `naTela` INTERLAÇA — e `intercalarDescobertas` empurra as sobras
   * todas para o fim, então **no modo padrão as sugestões já estão inteiras na
   * tela** quando a paciente chega ao rodapé.
   *
   * Os dois modos, e nenhum deles quer a zona:
   *
   * - **misturado (o padrão)**: repetir ali mostrava a MESMA publicação duas
   *   vezes na mesma rolagem — uma interlaçada e outra no rodapé. E chave
   *   repetida derruba a lista inteira do React.
   * - **"Só quem eu sigo" ligado**: a tela promete por escrito "Seu feed
   *   mostra apenas quem você segue", e a zona entregava exatamente o
   *   contrário. O interruptor tornava as estranhas MAIS visíveis.
   *
   * ⚠️ **A fileira de PESSOAS fica**, e a distinção é a do texto: ela é
   * descoberta de gente para seguir, não conteúdo do feed. Sem ela, quem ligou
   * a chave nunca teria como fazer o feed fechado ter conteúdo.
   *
   * ⚠️ **E o convite ganhou condição PRÓPRIA.** Ele vivia pendurado na mesma
   * condição da zona: tirando `sobrouSugestao` de lá, ele sumiria junto para
   * quem não tem nenhuma pessoa sugerida — que é justamente quem mais precisa
   * trazer alguém.
   */

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
      {/* ⚠️ **A FAIXA DA PAUSA VEM ANTES DE TUDO**, inclusive do desafio: ela
          muda o significado de tudo que vem abaixo — publicar, comentar e
          reagir continuam funcionando, e ninguém vai ver. Enterrada no meio da
          rolagem, seria um aviso que ela encontra depois de já ter publicado. */}
      {/* ⚠️ **A SUSPENSÃO VEM ANTES DA PAUSA, e nunca as duas juntas.** Ela
          muda mais coisa: a pausa ela desfaz num toque, a suspensão não. Ver as
          duas faria ela tocar em "Reativar" e não acontecer nada.

          ⚠️ **E o texto NÃO acusa.** Ele diz o FATO e o caminho — quem lê isto
          é uma gestante, e um texto de tribunal numa tela de app de saúde é uma
          crueldade desnecessária. O motivo detalhado vai por outro canal, com
          nome e voz humana. */}
      {suspensa && (
        <div className="mb-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-[13px] font-semibold">Sua conta da Comunidade está indisponível</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Você não aparece na Comunidade por enquanto, e o que você publicou não foi apagado. Isso
            vale só para esta aba: as suas consultas, os seus registros e a conversa com o seu
            médico continuam normais.
          </p>
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            Se você acha que houve um engano, fale com o consultório — a gente revê.
          </p>
        </div>
      )}

      {!suspensa && pausada && (
        <div className="mb-3 rounded-2xl border border-border bg-muted/60 p-3">
          <p className="text-[13px] font-semibold">Sua conta está pausada</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Ninguém te encontra e as suas publicações não aparecem para mais ninguém. Nada foi
            apagado.
          </p>
          {aoReativar && (
            <button
              type="button"
              onClick={aoReativar}
              className="press mt-2 min-h-[44px] rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
            >
              Reativar a minha conta
            </button>
          )}
        </div>
      )}

      {desafio && (
        <CartaoDoDesafio
          desafio={desafio}
          aoEntrar={aoEntrarNoDesafio}
          aoIrParaOJogo={aoIrParaOJogo}
        />
      )}

      <FileiraDeStories stories={stories} aoTocar={aoTocarStory} aoAbrirMais={aoAbrirSecoes} />

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

      {/* ⚠️ **UM CARTÃO DE CADA VEZ, e a ordem é por QUEM VOLTA.** Três podem
          cair no mesmo dia, e empilhados entre os stories e o primeiro post
          empurram o feed inteiro para fora da dobra — o arranjo que o dono
          pediu para corrigir.

          A retrospectiva ganha de todos: ela só existe aos domingos. A MEMÓRIA
          vem em seguida, e nunca depois do lembrete: ela tem janela de três
          dias e **não volta nunca** (a Trava 4 vale para a vida toda), enquanto
          o lembrete do "então e agora" reaparece por conta própria. Perder a
          memória é perder para sempre; perder o lembrete é adiá-lo. */}
      {!retro && memoria && <CartaoDaMemoria memoria={memoria} aoVer={aoVerMemoria} />}

      {!retro && !memoria && lembreteEntao && aoCompararAgora && aoDispensarEntao && (
        <CartaoDoEntaoEAgora
          foto={lembreteEntao.imagemUrl}
          criadoEm={lembreteEntao.criadoEm}
          aoComparar={aoCompararAgora}
          aoDispensar={aoDispensarEntao}
        />
      )}

      {posts.length === 0 && sugestoes.length === 0 && pessoas.length === 0 ? (
        instavel ? (
          /* ⚠️ **A TELA DO "NÃO CARREGOU", e ela não existia.** O vazio dizia
              "Ainda não há nada por aqui 💛" para os dois casos — e oferecia o
              convite, ou seja, mandava a paciente trazer uma amiga por causa de
              uma falha de rede. Aqui ela tem o que fazer: tentar de novo. */
          <div className="pb-4 pt-12 text-center">
            <p className="text-sm text-muted-foreground">Não consegui carregar o feed agora.</p>
            {aoTentarDeNovo && (
              <button
                type="button"
                onClick={aoTentarDeNovo}
                className="press mt-3 min-h-[44px] rounded-full pill-3d px-5 text-[14px] font-semibold"
              >
                Tentar de novo
              </button>
            )}
          </div>
        ) : (
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
        )
      ) : (
        naTela.map((p) => (
          <PostInstagram
            key={p.id}
            post={p}
            /* ⚠️ O RÓTULO SOBREVIVEU À MISTURA, e ele é a proteção inteira.
               Interlaçar desconhecidas sem avisar faria a paciente ler um
               relato duro sem saber se veio de uma amiga ou de uma estranha —
               é a única versão desta mudança que eu não faria. */
            sugerido={idsSugeridos.has(p.id)}
            /* ⚠️ AS MESMAS REFERÊNCIAS PARA TODOS OS CARTÕES — nunca um fecho
               por post. É isto que faz o `memo` do cartão valer alguma coisa;
               com `(t) => aoReagir(p, t)` as props mudam a cada pintura e o
               `memo` nunca acerta. O portão de quem pode apagar/denunciar
               mudou-se para DENTRO do cartão, que já tem `post.souAAutora`. */
            aoReagir={aoReagir}
            aoSalvar={aoSalvar}
            aoRepublicar={aoRepublicar}
            aoCompartilhar={aoCompartilhar}
            aoAbrirTag={aoAbrirTag}
            aoMandarParaConversa={aoMandarParaConversa}
            aoAbrirArroba={aoAbrirArroba}
            aoApagar={aoApagar}
            aoDenunciar={aoDenunciar}
            aoVotar={aoVotar}
            aoTirarMarcacao={aoTirarMarcacao}
            aoEditar={aoEditar}
            aoFixar={aoFixar}
            aoStoryComPost={aoStoryComPost}
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
      {!temMais && (pessoas.length > 0 || mesmaFase || !!convite) && (
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
    <div className="my-3 flex items-center gap-3 rounded-2xl card-material p-3">
      <img
        src={foto}
        alt=""
        className="h-16 w-16 shrink-0 rounded-xl object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug">Faz {quando} desde esta foto</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
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
    <div className="my-6 rounded-3xl card-material p-5 text-center">
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
          className="press min-h-[44px] rounded-full pill-3d px-4 text-[14px] font-medium"
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
          className="press mb-3 flex w-full items-center gap-2.5 rounded-full pill-3d px-3 py-2 text-left"
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
          <span className="min-w-0 flex-1 truncate text-xs">{ROTULO_DO_FILTRO}</span>
        </button>
      )}

      {/* ⚠️ Ligado e sem ninguém é um resultado LEGÍTIMO, e o vazio EXPLICA a
          régua — como o vazio da busca. Cair de volta na lista completa faria o
          interruptor parecer quebrado e entregaria justamente quem ela pediu
          para não ver. */}
      {mesmaFase && pessoas.length === 0 && (
        <p className="pb-2 text-xs leading-snug text-muted-foreground">{VAZIO_DO_FILTRO}</p>
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
                <p className="line-clamp-1 w-full text-center text-xs leading-tight text-muted-foreground">
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
                  jaSegue ? "pill-3d" : "btn-3d bg-primary text-primary-foreground"
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
      <span className="text-xs leading-tight text-muted-foreground">{rotulo}</span>
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
        className="press mt-2 w-full rounded-lg pill-3d py-1.5 text-[14px] font-medium"
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
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
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
      <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
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
  album,
  aoSeguir,
  aoVoltar,
  aoAbrirPost,
  aoChegarNoFim,
  temMais = false,
  aoAbrirLista,
  aoAbrirSalvos,
  aoAbrirCurtidos,
  aoAbrirEscondidos,
  aoEsconderStory,
  aoBloquear,
  aoDenunciarPerfil,
  aoFavoritar,
  parecidas,
  aoSeguirParecida,
  aoVerParecida,
  aoSilenciar,
  aoRestringir,
  aoAbrirEspelho,
  aoAplicarCodigo,
  aoPerguntar,
  aoAbrirSOS,
  somenteLeitura = false,
  aoMandarMensagem,
}: {
  perfil: PerfilNaTela;
  posts: PostNaTela[];
  /**
   * O álbum da gestação — as MESMAS publicações, do começo, por semana.
   *
   * ⚠️ **Só no perfil DELA.** Agrupar por semana carimba uma linha do tempo
   * gestacional em cada publicação; num perfil que outra pessoa abre, os
   * títulos "22 semanas" publicariam a semana de TODO post, por cima da chave
   * `mostrar_semana`. Quem monta é `meuAlbum`, no servidor, que não tem
   * `alvoId` — aqui a lista simplesmente não chega para terceiros.
   */
  album?: { chave: string; titulo: string; posts: PostNaTela[] }[] | null;
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
  /** Abre "o que eu reagi". Só no próprio perfil, como os salvos. */
  aoAbrirCurtidos?: () => void;
  /** Abre a lista de quem NÃO vê o meu story. Só no próprio perfil. */
  aoAbrirEscondidos?: () => void;
  /**
   * Esconde o meu story DESTA pessoa — o "Ocultar story de" do Instagram.
   *
   * ⚠️ `undefined` no próprio perfil: esconder de si mesma tiraria a fileira
   * dela da tela dela, e o servidor recusa de qualquer jeito.
   */
  aoEsconderStory?: () => void;
  /** Só no perfil de terceiro. */
  aoBloquear?: () => void;
  /** Denunciar ESTE perfil para a plataforma. Ver `EscolherMotivo`. */
  aoDenunciarPerfil?: (motivo: MotivoDaDenuncia) => void;
  /** Favoritar (ou tirar). O estado atual vem em `perfil.favorita`. */
  aoFavoritar?: (favoritar: boolean) => void;
  /**
   * Contas para descobrir depois de seguir alguém.
   *
   * ⚠️ **Elas NÃO derivam do perfil aberto** — ver o comentário no ponto de uso.
   * A lista de seguidores deste app não é pública, e "parecidas com a Ana" seria
   * a lista de amigas da Ana com outro nome.
   */
  parecidas?: PessoaNaLista[];
  aoSeguirParecida?: (id: string) => void;
  /** Abre o perfil de uma sugerida. Sem a prop, o cartão só oferece "Seguir". */
  aoVerParecida?: (id: string) => void;
  /** Silenciar (ou voltar a ouvir). O estado atual vem em `perfil.silenciado`. */
  aoSilenciar?: (silenciar: boolean, quais?: { calaPosts: boolean; calaStories: boolean }) => void;
  /**
   * Restringir (ou liberar) os comentários desta pessoa.
   *
   * ⚠️ **NÃO é o bloqueio nem o silenciar.** Silenciar tira as publicações dela
   * do MEU feed; bloquear corta os dois lados e ela descobre. Restringir não
   * muda nada do que ela vê — só quem LÊ o comentário dela nas minhas fotos.
   * O estado atual vem em `perfil.restrito`.
   */
  aoRestringir?: (restringir: boolean) => void;
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
  /**
   * Abrir conversa com esta pessoa.
   *
   * ⚠️ Opcional de propósito: sob o espelho e nas bancadas o botão não existe,
   * e `somenteLeitura` já o desliga. Duas travas porque este é o único controle
   * do perfil que CRIA uma linha nova no banco a partir do perfil de terceiro.
   */
  aoMandarMensagem?: (id: string) => void;
}) {
  const [aba, setAba] = useState<AbaDoPerfil>("grade");
  /**
   * Grade ou álbum.
   *
   * ⚠️ **Um seletor DENTRO de "Publicações", e não uma terceira aba.** Uma aba
   * que só existe no perfil dela mudaria a barra entre um perfil e outro — e
   * este repositório já decidiu que a barra tem DUAS abas, porque "três abas
   * vazias ao lado de uma cheia entregam a sensação de um app pela metade". O
   * álbum é a MESMA coleção lida de outro jeito, que é exatamente a relação que
   * o seletor de ordem dos comentários já modela.
   */
  const [comoAlbum, setComoAlbum] = useState(false);
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
  /**
   * ⚠️ **O ⋯ NÃO PODE SER GATEADO POR `bloquear`.** Ele era — e por isso
   * "Story escondido de…", que é uma lista sobre os MEUS stories, morava
   * dentro de um menu que só existe no perfil DOS OUTROS: no meu, onde ela
   * é oferecida, não havia ⋯ nenhum. Recurso escrito, testado e sem porta.
   *
   * Achado abrindo a bancada — `tsc`, lint e a suíte inteira estavam verdes,
   * porque o botão É renderizado no código; ele só nunca aparece onde importa.
   */
  const temOpcoes = !!(
    bloquear ||
    agir(aoEsconderStory) ||
    agir(aoAbrirEscondidos) ||
    aoSilenciar ||
    aoFavoritar ||
    aoRestringir ||
    aoDenunciarPerfil
  );
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
            className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl leading-none"
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
        {/* ⚠️ **"O que eu reagi" é OUTRA coisa que os salvos**, e por isso tem
            botão próprio: salvar é um gesto DELIBERADO de guardar; reagir é o
            gesto rápido de quem passou por ali. É por esta lista que se
            reencontra a publicação que ela viu, achou linda, e não guardou. */}
        {agir(aoAbrirCurtidos) && (
          <button
            type="button"
            onClick={aoAbrirCurtidos}
            aria-label="O que você reagiu"
            className="press flex h-11 w-11 items-center justify-center text-[15px] leading-none"
          >
            ♡
          </button>
        )}
        {temOpcoes && (
          <button
            type="button"
            onClick={() => setConfirmandoBloqueio((v) => !v)}
            aria-label="Opções deste perfil"
            /* ⚠️ 44px: media 26×18 — e é a porta ÚNICA de bloquear, silenciar,
               restringir e denunciar. O alvo mais importante da tela era o
               menor. */
            className="press -mr-2 flex h-11 w-11 items-center justify-center text-lg leading-none text-muted-foreground"
          >
            ⋯
          </button>
        )}
      </header>

      {/* ⚠️ Bloquear é o único gesto de SEGURANÇA desta tela, e ele diz o que
          faz antes de fazer: desfaz o seguir nos dois sentidos e some com um
          do outro. Um "Bloquear" sem essa frase parece reversível — e é, mas
          o vínculo que ele desfez não volta sozinho. */}
      {confirmandoBloqueio && temOpcoes && (
        <div className="mx-4 mt-2 rounded-2xl border border-border bg-muted/40 p-3">
          {/* ⚠️ **A CONFIRMAÇÃO DE BLOQUEIO É A ÚNICA PARTE QUE EXIGE
              `bloquear`** — no meu próprio perfil o painel abre sem ela, com
              as opções que são minhas. */}
          {bloquear && (
            <>
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
            </>
          )}

          {/* ⚠️ **SILENCIAR É O DEGRAU DE BAIXO, e ele faltava.** Só existia
              bloquear — que desfaz o seguir nos dois sentidos e que a própria
              tela descreve como coisa séria. Numa rede em que as pessoas se
              conhecem da vida real (a irmã, a cunhada, a amiga do trabalho),
              não ter o meio-termo faz alguém bloquear a irmã, ou desistir da
              aba. Aqui o vínculo CONTINUA: some só do feed. */}
          {/* ⚠️ **POSTS E STORIES, SEPARADOS — antes calava os dois de uma
              vez.** Quem quer só descansar dos stories de alguém (o formato mais
              frequente e mais invasivo) perdia as publicações junto, e acabava
              não silenciando ninguém.

              ⚠️ **E "silenciar tudo" continua sendo UM toque**, na primeira
              linha: a escolha fina é para quem quer, e obrigar todo mundo a
              decidir entre duas caixas transformaria um gesto de alívio numa
              configuração. */}
          {/* ⚠️ **FAVORITAR É O OPOSTO DE SILENCIAR, e fica ao lado dele.**
              Num feed cronológico, quem segue trinta pessoas perde a publicação
              da amiga que está passando por alguma coisa. E ele é CALADO, como
              o silenciar — o rótulo diz isso, senão ela hesita. */}
          {aoFavoritar && (
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                aoFavoritar(!perfil.favorita);
              }}
              className="press block min-h-[44px] w-full text-left text-[14px]"
            >
              {perfil.favorita ? "Tirar dos favoritos" : "Adicionar aos favoritos"}
            </button>
          )}
          {/* ⚠️ **ESCONDER O STORY é o degrau entre "nada" e "silenciar".** A
              camada (`seguidores`/`amigas`) é grossa; isto é o "não quero que
              ESTA pessoa veja". E o texto diz que é calado — sem a frase, ela
              imagina que a pessoa é avisada, e não esconde. */}
          {agir(aoEsconderStory) && (
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                aoEsconderStory?.();
              }}
              className="press mt-2 min-h-[44px] w-full rounded-xl border border-border text-[13px] font-medium"
            >
              Esconder meus stories de {perfil.nome}
            </button>
          )}
          {agir(aoAbrirEscondidos) && (
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                aoAbrirEscondidos?.();
              }}
              className="press mt-2 min-h-[44px] w-full rounded-xl border border-border text-[13px] font-medium"
            >
              Story escondido de…
            </button>
          )}
          {aoSilenciar &&
            (perfil.silenciado ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmandoBloqueio(false);
                  aoSilenciar(false);
                }}
                className="press mt-2 min-h-[44px] w-full rounded-xl border border-border text-[13px] font-medium"
              >
                Voltar a ver {perfil.nome}
              </button>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmandoBloqueio(false);
                    aoSilenciar(true);
                  }}
                  className="press min-h-[44px] w-full rounded-xl border border-border text-[13px] font-medium"
                >
                  Silenciar {perfil.nome}
                </button>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmandoBloqueio(false);
                      aoSilenciar(true, { calaPosts: true, calaStories: false });
                    }}
                    className="press min-h-[44px] flex-1 rounded-xl border border-border text-xs"
                  >
                    Só as publicações
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmandoBloqueio(false);
                      aoSilenciar(true, { calaPosts: false, calaStories: true });
                    }}
                    className="press min-h-[44px] flex-1 rounded-xl border border-border text-xs"
                  >
                    Só os stories
                  </button>
                </div>
              </div>
            ))}
          {aoSilenciar && (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {perfil.silenciado
                ? "As publicações dela voltam a aparecer no seu feed."
                : "Você continua seguindo, e o perfil dela continua aqui — só o feed para de trazer as publicações. Ela não é avisada."}
            </p>
          )}

          {/* ⚠️ **RESTRINGIR É O DEGRAU ENTRE SILENCIAR E BLOQUEAR, e ele
              resolve um caso que os outros dois não resolvem.** Silenciar tira
              as publicações DELA do meu feed; bloquear corta tudo e ela
              descobre. Restringir não faz nem um nem outro: ela continua
              seguindo e continua vendo tudo — o que muda é que o COMENTÁRIO
              dela nas minhas fotos só aparece para ela.

              É a saída para a cunhada que comenta demais: bloquear tem custo
              social (vira briga de família) e é justamente esse custo que faz a
              paciente não usar o bloqueio e continuar recebendo o que a
              machuca. */}
          {aoRestringir && (
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                aoRestringir(!perfil.restrito);
              }}
              className="press mt-2 min-h-[44px] w-full rounded-xl border border-border text-[13px] font-medium"
            >
              {perfil.restrito
                ? `Deixar de restringir ${perfil.nome}`
                : `Restringir ${perfil.nome}`}
            </button>
          )}
          {aoRestringir && (
            /* ⚠️ **O TEXTO DIZ QUE ELA NÃO É AVISADA, e diz o que NÃO muda.**
               Sem a segunda metade, a paciente lê "restringir" como "bloquear
               parcial" e não usa — ou usa achando que a pessoa para de ver as
               fotos dela, o que seria uma promessa falsa. */
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {perfil.restrito
                ? "Os comentários dela voltam a aparecer para todo mundo."
                : "Os comentários dela nas suas publicações passam a aparecer só para ela — e para você, marcados. Ela continua seguindo, continua vendo tudo, e não é avisada."}
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
              className="press mt-2 w-full text-xs font-medium text-muted-foreground underline underline-offset-2"
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
            {/* ⚠️ OS NÚMEROS SÃO PÚBLICOS AGORA, por decisão do dono. Antes
                apareciam só no próprio perfil, e a razão (clínica) está guardada
                em `NUMEROS_PUBLICOS` para quem reabrir o assunto.

                ⚠️ `!= null` e não `?? 0`: `null` quer dizer "não sei" (perfil
                fora de alcance, ou a busca, que não conta de propósito). Um zero
                no lugar do desconhecido afirmaria que ninguém a segue. */}
            {perfil.seguidores != null && (
              <button type="button" onClick={() => abrirLista?.("seguidores")} className="press">
                <Numero valor={perfil.seguidores} rotulo="seguidores" />
              </button>
            )}
            {(perfil.souEu ? (perfil.euSigo ?? perfil.seguindo) : perfil.seguindo) != null && (
              <button type="button" onClick={() => abrirLista?.("seguindo")} className="press">
                <Numero
                  valor={(perfil.souEu ? (perfil.euSigo ?? perfil.seguindo) : perfil.seguindo) ?? 0}
                  rotulo="seguindo"
                />
              </button>
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
        {/* ⚠️ A LINHA DOS FILHOS FICA ACIMA DOS SELOS, e a ordem é a vida dela.
            O selo da semana morre no dia do parto; esta linha continua verdade
            por anos — "Mãe da Helena, 3 meses", "Mãe de 2, grávida do terceiro".
            É ela que faz o perfil ter assunto depois que a barriga acaba, e por
            isso vem primeiro. */}
        {perfil.linhaDosFilhos && (
          <p className="mt-2 text-[13px] font-medium leading-snug">{perfil.linhaDosFilhos}</p>
        )}

        {/* ⚠️ **O `@` FICA ABAIXO DO NOME, e é texto — não botão.** Ele é o
            ENDEREÇO desta pessoa, e quem já está no perfil dela não tem para
            onde ir tocando nele. Some inteiro sem `@`: quem nunca escolheu não
            precisa ver um espaço vazio, e a linha nunca vira "sem apelido". */}
        {perfil.handle && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">@{perfil.handle}</p>
        )}

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
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-foreground">
                🤰 {perfil.seloSemana}
              </span>
            )}
            {perfil.seloBebe && (
              <span className="rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium">
                💛 {perfil.seloBebe}
              </span>
            )}
          </div>
        )}

        {perfil.bio && <p className="mt-3 text-[14px] leading-snug">{perfil.bio}</p>}

        {/* ⚠️ **O LINK DA BIO, e ele é o único lugar do app onde texto de uma
            paciente vira um `href` na tela de outra.** Quem limpa é o SERVIDOR
            (`limparLinkDaBio`, na gravação): só `http`/`https` chegam aqui. Uma
            segunda conferência nesta linha divergiria da primeira, e a
            divergência aparece como `javascript:` clicável.

            ⚠️ `rel="noopener noreferrer nofollow"` e `target="_blank"`: sem
            `noopener`, a página aberta ganha `window.opener` e pode navegar a
            NOSSA aba para onde quiser — com a paciente achando que continua no
            app. E o texto mostra o endereço SEM o esquema, que é como as
            pessoas leem um link. */}
        {/* ⚠️ **SÓ DEPOIS DE SEGUIR, e nunca antes.** A fileira existe para o
            momento em que ela acabou de escolher alguém — mostrá-la num perfil
            que ela ainda está decidindo se acompanha transforma a tela numa
            vitrine de outras pessoas, e a decisão que ela veio tomar fica em
            segundo plano. */}
        {perfil.meuVinculo === "ativo" && !perfil.souEu && (parecidas ?? []).length > 0 && (
          <section className="mt-3">
            <h3 className="text-[13px] font-semibold">Talvez você conheça</h3>
            {/* ⚠️ A régua é DITA: sem a frase, ela lê a fileira como "parecidas
                com esta pessoa" — e este app não deriva nada do grafo de
                terceiro. */}
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Contas abertas com gente em comum com você.
            </p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {(parecidas ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex w-[104px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-border p-2"
                >
                  <button
                    type="button"
                    onClick={() => aoVerParecida?.(p.id)}
                    className="press flex flex-col items-center gap-1"
                  >
                    <Foto url={p.avatarUrl} nome={p.nome} lado={44} />
                    <span className="w-full truncate text-center text-xs font-medium">
                      {p.nome}
                    </span>
                  </button>
                  {aoSeguirParecida && (
                    <button
                      type="button"
                      onClick={() => aoSeguirParecida(p.id)}
                      className="press min-h-[44px] w-full rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground"
                    >
                      Seguir
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {perfil.bioLink && (
          <a
            href={perfil.bioLink}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="press mt-1 block min-h-[44px] truncate text-[14px] font-medium text-primary"
          >
            🔗 {perfil.bioLink.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        )}

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
            <p className="text-xs text-muted-foreground">Código de embaixadora</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-wide">
              {perfil.codigoDeEmbaixadora}
            </p>
            {perfil.possoAplicarOCodigo && aoAplicarCodigo && !somenteLeitura && (
              <>
                {!confirmandoCodigo ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoCodigo(true)}
                    className="press mt-2 w-full rounded-lg pill-3d py-1.5 text-[13px] font-semibold"
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
                    <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
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
                    <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
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

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={seguir}
            disabled={perfil.souEu || perfil.meuVinculo === "pendente"}
            className={`press flex-1 rounded-lg py-1.5 text-[14px] font-semibold ${
              perfil.meuVinculo || perfil.souEu
                ? "pill-3d"
                : "btn-3d bg-primary text-primary-foreground"
            }`}
          >
            {rotuloDoBotao}
          </button>

          {/* ⚠️ **"MENSAGEM" SÓ APARECE ONDE A CONVERSA PODE EXISTIR.**
              Nunca no próprio perfil, nunca sob o espelho (onde a tela finge
              ser a visão de uma estranha e todo controle é inerte), e nunca em
              perfil fora de alcance — ali o servidor recusaria, e um botão que
              promete e devolve erro é pior que a ausência dele.

              ⚠️ E ele NÃO some quando ela não me segue: aí a conversa nasce
              como PEDIDO, que é o desenho. Escondê-lo faria a caixa de pedidos
              existir sem nenhuma porta que a alimentasse. */}
          {!perfil.souEu && !somenteLeitura && aoMandarMensagem && (
            <button
              type="button"
              onClick={() => aoMandarMensagem(perfil.id)}
              className="press flex-1 rounded-lg pill-3d py-1.5 text-[14px] font-semibold"
            >
              Mensagem
            </button>
          )}
        </div>

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
            className="press mt-2 w-full rounded-lg pill-3d py-1.5 text-[14px] font-medium"
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
        <>
          {/* ⚠️ **O SELETOR SÓ APARECE QUANDO MUDA ALGUMA COISA.** Com menos de
              duas seções o álbum é a grade com um título em cima, e um controle
              que não muda nada ensina que os controles desta tela não valem —
              a mesma régua do "Hoje eu não desço ao chão" e do seletor de ordem
              dos comentários. */}
          {(album?.length ?? 0) >= 2 && (
            <div className="flex gap-1 px-3 pt-3">
              {[
                { v: false, r: "Grade" },
                { v: true, r: "Álbum" },
              ].map((o) => (
                <button
                  key={o.r}
                  type="button"
                  onClick={() => setComoAlbum(o.v)}
                  aria-pressed={comoAlbum === o.v}
                  className={`press min-h-[44px] rounded-full px-4 text-[13px] font-medium ${
                    comoAlbum === o.v
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {o.r}
                </button>
              ))}
            </div>
          )}
          {comoAlbum && album ? (
            /* ⚠️ **A MESMA `GradeDePosts` por seção**, e nunca uma grade nova:
                a proporção da célula já mudou uma vez (1:1 → 3:4, em 2025), e
                duas cópias divergiriam na próxima.
                ⚠️ E sem sentinela aqui — o álbum vem inteiro do servidor numa
                consulta só; a paginação é da grade cronológica. */
            <div>
              {album.map((s) => (
                <section key={s.chave}>
                  <h2 className="px-3 pb-1 pt-4 text-[13px] font-semibold text-muted-foreground">
                    {s.titulo}
                  </h2>
                  <GradeDePosts posts={s.posts} vazio="" aoAbrirPost={abrirPost} />
                </section>
              ))}
            </div>
          ) : (
            /* A grade é a MESMA dos salvos (`GradeDePosts`) — duas cópias
               divergiriam na primeira vez que a proporção da célula mudasse. */
            <GradeDePosts
              posts={naGrade}
              vazio="Nenhuma publicação ainda."
              aoAbrirPost={abrirPost}
              aoChegarNoFim={aoChegarNoFim}
              temMais={temMais}
            />
          )}
        </>
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
          <p className="mt-4 text-xs leading-snug text-muted-foreground">
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
  | { t: "arquivo-stories" }
  | { t: "bloqueados" }
  /** De quem eu escondi o meu story — o "Ocultar story de" do Instagram. */
  | { t: "escondidos" }
  /** O que eu reagi. É a lista que faltava ao lado dos salvos. */
  | { t: "curtidos" }
  /** O que aconteceu com o que eu denunciei. */
  | { t: "desfechos" }
  | { t: "favoritas" }
  | { t: "busca" }
  | { t: "caixinha" }
  | { t: "conversas" }
  | { t: "conversa" }
  | { t: "explorar" }
  | { t: "grupo" }
  | { t: "grupo-novo" }
  | { t: "grupo-chamar" }
  | { t: "tag"; tag: string }
  | { t: "espelho" };

export function RedeNoApp({
  careMode = false,
  bancadaOnboarding,
  adiarOnboarding = false,
  onAbrirSecoes,
  onIrParaOJogo,
  onAbrirSOS,
  aulaDeHoje,
  sinalDeVoltarAoFeed = 0,
}: {
  careMode?: boolean;
  /** Só a bancada: força os quatro cartões sem tocar no blob da jornada. */
  bancadaOnboarding?: boolean;
  /**
   * O ritual de boas-vindas está na tela — segure os quatro cartões.
   *
   * ⚠️ Duas telas cheias no primeiro minuto seriam dois tutoriais. Ele NÃO
   * some: quem adiou encontra o tutorial na abertura seguinte, com o app já
   * personalizado — a mesma decisão do tutorial do mascote.
   */
  adiarOnboarding?: boolean;
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

  /* ═══ O VOLTAR DO ANDROID DENTRO DA COMUNIDADE (set/2026) ═══
     Esta aba tem 25 destinos e 67 chamadas de `setOnde` — e nenhuma delas era
     um passo que o botão de voltar do aparelho soubesse desfazer. Medido: de
     um perfil aberto, o voltar do Android minimizava o app.

     ⚠️ A PILHA É OBSERVADA, e não escrita em cada `setOnde`. Empilhar no ponto
     de uso exigiria tocar nas 67 chamadas, e a 68ª — escrita amanhã — nasceria
     sem. Um efeito que olha `onde` mudar pega TODAS, inclusive as que ainda
     não existem. É a mesma lição do piso de 16px dos campos.

     ⚠️ A RÉGUA MORA EM `src/lib/pilha-de-telas.ts` — o teto, o zerar na raiz e
     o "o passo do próprio voltar não é empilhado". Aqui ficam só os fios,
     porque `RedeNoApp` NÃO TEM BANCADA: `/preview-instagram` monta as telas
     internas direto, nunca ele. Enterrada neste arquivo, esta lógica não teria
     como ser exercitada em lugar nenhum. */
  const pilhaDeTelas = useRef(criarPilhaDeTelas<Onde>((o) => o.t === "feed"));
  const ondeAnterior = useRef<Onde>(onde);
  useEffect(() => {
    const anterior = ondeAnterior.current;
    ondeAnterior.current = onde;
    pilhaDeTelas.current.andou(anterior, onde);
  }, [onde]);

  /* ⚠️ No FEED ela NÃO se registra — e é isso que faz a subida de aba de
     `minha-conta` assumir a vez. Registrada sempre, esta aba engoliria o
     voltar para sempre e a paciente ficaria presa na Comunidade. */
  useVoltar(onde.t !== "feed", () => {
    setOnde(pilhaDeTelas.current.voltar() ?? { t: "feed" });
  });

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
  /** `null` = ainda carregando · `[]` = ela não publicou nenhum. Ver o handler. */
  const [arquivoStories, setArquivoStories] = useState<StoryArquivado[] | null>(null);
  const [arquivoStoriesInstavel, setArquivoStoriesInstavel] = useState(false);
  const [proximoArquivo, setProximoArquivo] = useState<string | null>(null);
  /** `null` = carregando · `[]` = ela não bloqueou ninguém · `"erro"` = não deu. */
  const [escondidos, setEscondidos] = useState<PessoaNaLista[] | null>(null);
  const [curtidos, setCurtidos] = useState<PostNaTela[] | null>(null);
  const [desfechos, setDesfechos] = useState<
    { id: string; alvo: string; motivo: string; em: string; desfecho: string | null }[] | null
  >(null);
  const [bloqueados, setBloqueados] = useState<PessoaNaLista[] | "erro" | null>(null);
  /** A lista "ver primeiro". `"erro"` = a leitura falhou; `null` = carregando. */
  const [favoritas, setFavoritas] = useState<PostNaTela[] | "erro" | null>(null);
  /** O story que está sendo mandado para uma conversa. */
  const [mandandoStory, setMandandoStory] = useState<string | null>(null);
  const [grupoAberto, setGrupoAberto] = useState<GrupoNaTela | null>(null);
  /** A grade do Explorar. `"erro"` = a leitura falhou; `null` = carregando. */
  const [explorar, setExplorar] = useState<
    | {
        posts: PostNaTela[];
        tags: { tag: string; quantas: number }[];
      }
    | "erro"
    | null
  >(null);
  const [encaminhando, setEncaminhando] = useState<{
    deConversaId: string;
    mensagemId: string;
  } | null>(null);
  /**
   * ⚠️ **A CONTA PAUSADA PRECISA DE UM AVISO, senão o botão parece quebrado.**
   * Ela pausa nas configurações, volta ao feed e tudo continua igual — porque a
   * pausa esconde ela dos OUTROS, e o feed é o que ela vê. Sem a faixa, a
   * conclusão razoável é que a pausa não pegou, e ela publicaria imaginando que
   * está invisível.
   *
   * ⚠️ **E ela continua LENDO enquanto pausada, de propósito.** Cortar a leitura
   * derrubaria conversas abertas com quem está apoiando ela — e é o mesmo
   * desenho que o Modo Cuidado já tem: o que some é ela na rede dos outros, não
   * a rede para ela.
   */
  const [pausada, setPausada] = useState(false);
  /** ⚠️ Decisão da PLATAFORMA, e não dela — por isso ela é avisada. */
  const [suspensa, setSuspensa] = useState(false);
  const [sugestoes, setSugestoes] = useState<PostNaTela[]>([]);
  /** Quantas conversas pedem resposta. Alimenta o emblema do atalho. */
  const [msgsNaoLidas, setMsgsNaoLidas] = useState(0);
  /**
   * A primeira linha, já escrita, quando a conversa nasce de uma sugestão.
   *
   * ⚠️ **Mora AQUI e não dentro de `Conversa`.** Aquele componente é montado e
   * desmontado ao trocar de tela; com o rascunho lá dentro, voltar do perfil da
   * pessoa e reabrir a conversa reescreveria a frase por cima do que ela já
   * tivesse digitado. É a mesma lição do passo do tutorial e do `sub` do
   * `RegistrosHub`.
   */
  const [rascunhoDaConversa, setRascunhoDaConversa] = useState<string | null>(null);
  /** A publicação que ela está mandando para alguém. `null` = folha fechada. */
  const [mandandoPost, setMandandoPost] = useState<string | null>(null);
  /** A leitura do feed falhou — diferente de "não há nada". */
  const [feedInstavel, setFeedInstavel] = useState(false);
  const [conversaAberta, setConversaAberta] = useState<ConversaNaTela | null>(null);
  /** A publicação que ela está republicando, enquanto o compositor está aberto. */
  const [repostando, setRepostando] = useState<PostNaTela | null>(null);
  /**
   * A escolha dela: `true` = só quem eu sigo.
   *
   * ⚠️ **NASCE `false`, e o padrão é o aberto.** Uma rede social que abre vazia
   * para quem acabou de chegar não dá a ninguém motivo para voltar — e conta
   * nova não segue ninguém. Quem quiser o fechado liga nas configurações.
   */
  const [soSeguindo, setSoSeguindo] = useState(false);
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

  /**
   * A memória do dia, ou `null`.
   *
   * ⚠️ Quem decide é o SERVIDOR (`memoriaDeHoje`, com as cinco travas). A tela
   * só desenha o que vier — e falha de rede vira `null`, que é o lado seguro
   * deste recurso: um agrado que não aconteceu, contra devolver a foto de uma
   * perda.
   */
  const [memoria, setMemoria] = useState<{ post: PostNaTela; texto: string } | null>(null);
  /**
   * O álbum da gestação — só do MEU perfil.
   *
   * ⚠️ Quem monta é `meuAlbum`, que não tem `alvoId`: mesmo que esta tela
   * pedisse o álbum de outra pessoa, o servidor devolveria o dela. Aqui a
   * consulta nem sai quando o perfil aberto não é o meu.
   */
  const [album, setAlbum] = useState<
    { chave: string; titulo: string; posts: PostNaTela[] }[] | null
  >(null);
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
  /**
   * O vídeo do story, já subido, esperando publicar.
   *
   * ⚠️ **Ele sobe no instante em que ela escolhe o arquivo, e não no publicar.**
   * Um vídeo de 50 MB no botão "Publicar" deixaria a tela parada meio minuto
   * depois do gesto que ela lê como "acabou" — e o compositor já tem a capa na
   * frente dela enquanto o arquivo viaja.
   */
  const [videoDoStory, setVideoDoStory] = useState<{
    caminho: string;
    segundos: number;
  } | null>(null);
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
    fixar: (_p: PostNaTela, _v: boolean) => {},
    storyComPost: (_p: PostNaTela) => {},
    editar: async (_p: PostNaTela, _t: string) => false,
    verQuemReagiu: (_p: PostNaTela) => {},
    abrirPerfil: (_id: string) => {},
    abrirArroba: (_handle: string) => {},
    abrirTag: (_tag: string) => {},
    mandarParaConversa: (_p: PostNaTela) => {},
    republicar: (_p: PostNaTela) => {},
    compartilhar: (_p: PostNaTela) => {},
    linkPublico: (_p: PostNaTela) => {},
    tocarStory: (_autorId: string) => {},
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
    fixar: (p, v) => void fixarNoPerfil(p, v),
    storyComPost: (p) => void storyComPost(p),
    editar: (p, t) => editarLegenda(p, t),
    verQuemReagiu: (p) => void verQuemReagiu(p),
    abrirPerfil: (id) => void abrirPerfil(id),
    abrirArroba: (h) => void abrirPorArroba(h),
    abrirTag: (t) => void abrirTag(t),
    mandarParaConversa: (p) => setMandandoPost(p.id),
    republicar: (p) => republicar(p),
    compartilhar: (p) => void compartilhar(p),
    linkPublico: (p) => void abrirLinkPublico(p),
    tocarStory: (id) => void verStory(id),
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
      /* ⚠️ Estável, como as irmãs — ver o bloco abaixo sobre o `memo`. */
      fixar: (p: PostNaTela, v: boolean) => ultimas.current.fixar(p, v),
      storyComPost: (p: PostNaTela) => ultimas.current.storyComPost(p),
      verQuemReagiu: (p: PostNaTela) => ultimas.current.verQuemReagiu(p),
      abrirPerfil: (id: string) => ultimas.current.abrirPerfil(id),
      /* ⚠️ **Referência estável, como as irmãs.** Um fecho novo por render
         faria o `memo` do cartão errar em TODO post do feed — e a legenda com
         `@` e `#` está em cada um deles. É o mesmo defeito que já custou
         232 ms por reação nesta lista. */
      abrirArroba: (h: string) => ultimas.current.abrirArroba(h),
      abrirTag: (t: string) => ultimas.current.abrirTag(t),
      mandarParaConversa: (p: PostNaTela) => ultimas.current.mandarParaConversa(p),
      /**
       * ⚠️ **AS TRÊS ÚLTIMAS ENTRARAM AQUI PORQUE O `memo` NUNCA ACERTAVA.**
       *
       * `republicar`, `compartilhar` e `verStory` são declarações de função no
       * corpo de `RedeNoApp` — identidade NOVA a cada pintura — e eram passadas
       * a `TelaPrincipal` fora deste objeto. `PostInstagram` e
       * `FileiraDeStories` são `memo` sem comparador próprio: uma prop com
       * identidade nova basta para a comparação rasa falhar, e ela falhava em
       * TODO cartão do feed, a cada render.
       *
       * É o mesmo defeito que já custou 232 ms por reação nesta lista e que o
       * dono relatou como "bugado e lerdo".
       */
      republicar: (p: PostNaTela) => ultimas.current.republicar(p),
      compartilhar: (p: PostNaTela) => ultimas.current.compartilhar(p),
      /* ⚠️ Pelo objeto estável, como as irmãs: um fecho novo por render faria o
         `memo` errar em todo cartão do feed. */
      linkPublico: (p: PostNaTela) => ultimas.current.linkPublico(p),
      tocarStory: (autorId: string) => ultimas.current.tocarStory(autorId),
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
   * A MEMÓRIA DO DIA.
   *
   * ⚠️ **Uma ida por abertura do FEED, e nada é decidido aqui.** As cinco
   * travas moram em `memoriaDeHoje`, no servidor: uma condição nesta tela seria
   * a segunda régua do recurso que mais pode machucar nesta aba.
   *
   * ⚠️ E falha vira `null` — o lado seguro deste recurso, ao contrário de quase
   * todo o resto da rede: o pior caso de calar é um agrado que não aconteceu; o
   * pior caso de mostrar é devolver a foto de uma perda.
   */
  useEffect(() => {
    if (onde.t !== "feed" || !euId) return;
    let vivo = true;
    void (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { memoriaDoFeed } = await import("@/lib/rede-social.functions");
        const r = await memoriaDoFeed({ data: { accessToken: t } });
        if (!vivo) return;
        setMemoria(r.ok ? (r.memoria ?? null) : null);
      } catch {
        if (vivo) setMemoria(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onde.t, euId]);

  /**
   * O ÁLBUM — buscado só quando o perfil aberto é o MEU.
   *
   * ⚠️ **A consulta nem sai para o perfil de terceiro**, e isso é cinto sobre
   * suspensório: `meuAlbum` não tem `alvoId`, então ela devolveria o MEU álbum
   * de qualquer jeito — e desenhá-lo no perfil de outra pessoa seria pior que
   * não tê-lo. Aqui a corrente fecha nos dois lados.
   */
  useEffect(() => {
    if (onde.t !== "perfil" || !perfil?.souEu) {
      setAlbum(null);
      return;
    }
    let vivo = true;
    void (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { meuAlbum } = await import("@/lib/rede-social.functions");
        const r = await meuAlbum({ data: { accessToken: t } });
        if (!vivo) return;
        setAlbum(r.ok ? r.secoes : null);
      } catch {
        if (vivo) setAlbum(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [onde.t, perfil?.souEu, perfil?.id]);

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
    let doAparelho: RascunhoDoPost | null = null;
    try {
      doAparelho = lerRascunho(localStorage.getItem(chaveDoRascunho(euId)), new Date());
    } catch {
      doAparelho = null;
    }
    setRascunho(doAparelho);
    /**
     * ⚠️ **O DO APARELHO VENCE, sempre — e o do servidor só entra quando não há
     * nenhum.**
     *
     * O do servidor pode ser de meia hora atrás, escrito no outro celular;
     * sobrepô-lo ao que ela acabou de digitar aqui seria trocar o texto de agora
     * pelo de antes, sem ela pedir. Ele existe para o caso que o `localStorage`
     * não cobre: ela escreve no celular, o celular acaba, e ela abre no
     * computador.
     */
    if (doAparelho) return;
    let vivo = true;
    void (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { meuRascunho } = await import("@/lib/rede-social.functions");
        const r = await meuRascunho({ data: { accessToken: t } });
        if (!vivo || !r.ok || !r.rascunho) return;
        /* ⚠️ Só o que o servidor guarda: os outros campos vêm do tipo, e
           inventar enquete/marcadas a partir de um rascunho que não as tem
           ofereceria de volta algo que ela nunca escreveu. */
        setRascunho({
          texto: r.rascunho.texto,
          visibilidade: (r.rascunho.visibilidade ?? "amigas") as Visibilidade,
          enquete: null,
          comAula: false,
          marcadas: [],
          em: r.rascunho.em,
        });
      } catch {
        /* Sem rede: fica o que o aparelho tem, que é o caso normal. */
      }
    })();
    return () => {
      vivo = false;
    };
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
      /**
       * ⚠️ **E O SERVIDOR TAMBÉM — é a rede de segurança da TROCA DE CELULAR.**
       *
       * O rascunho do aparelho é mais rápido (não espera rede) e guarda o que o
       * do servidor não guarda; ele CONTINUA sendo quem manda na tela. O do
       * servidor existe para o caso que o `localStorage` não cobre: ela escreve
       * no celular, o celular acaba, e ela abre no computador.
       *
       * ⚠️ **Sem `await`, e sem recado na tela.** O texto já está guardado no
       * aparelho e está escrito na frente dela: um erro sobre uma rede de
       * segurança faria ela achar que perdeu o que está vendo.
       */
      void (async () => {
        try {
          const t = await token();
          if (!t) return;
          const { salvarRascunho } = await import("@/lib/rede-social.functions");
          await salvarRascunho({
            data: {
              accessToken: t,
              texto: r?.texto ?? null,
              visibilidade: r?.visibilidade ?? null,
              /* ⚠️ O LUGAR não está no rascunho do aparelho (`RascunhoDoPost`
                 guarda texto, camada, enquete, aula e marcadas). Mandar `null`
                 aqui é honesto — a coluna existe para quando ele entrar, e
                 inventar um campo que o tipo não tem só quebraria o `tsc`. */
              lugar: null,
            },
          });
        } catch {
          /* Idem: o do aparelho já guardou. */
        }
      })();
    },
    [euId],
  );

  /**
   * O RASCUNHO DO STORY — mesmo desenho do rascunho do post, e por isso mesmo
   * com identificadores PRÓPRIOS.
   *
   * ⚠️ **`guardarRascunhoDoStory`, e nunca `guardarRascunho`.** O do post está
   * dez linhas acima com o nome curto; reusá-lo aqui gravaria o story na chave
   * da publicação e apagaria o rascunho dela ao publicar um story. Foi só
   * olhar a lista de ocorrências que isso apareceu.
   *
   * ⚠️ **`useCallback` com `[euId]`**, pela mesma razão do irmão: a referência
   * entra num `useEffect` lá dentro do compositor, e uma nova a cada pintura
   * reiniciaria o relógio de 700 ms a cada letra — ou seja, nunca gravaria.
   */
  const guardarRascunhoDoStory = useCallback(
    (r: Omit<RascunhoDoStory, "em"> | null) => {
      if (!euId) return;
      try {
        const chave = chaveDoRascunhoDeStory(euId);
        if (!r) {
          localStorage.removeItem(chave);
          return;
        }
        const saida = guardarRascunhoDeStory(r, new Date());
        if (saida.guardar) localStorage.setItem(chave, saida.texto);
        else localStorage.removeItem(chave);
      } catch {
        /* sem armazenamento, ou cota cheia: o compositor segue funcionando */
      }
    },
    [euId],
  );

  /**
   * O que estava guardado, lido quando a conferência ABRE.
   *
   * ⚠️ Lido no instante em que a tela abre, e não num `useState` inicial: o
   * compositor de story é montado e desmontado a cada foto escolhida, e um
   * inicializador leria uma vez só, na primeira.
   */
  const [rascunhoDeStory, setRascunhoDeStory] = useState<RascunhoDoStory | null>(null);
  /**
   * A publicação que vai dentro do story que está sendo montado.
   *
   * ⚠️ Estado do PAI, e não do compositor: `ConferirStory` é montado e
   * desmontado a cada foto escolhida, e guardar ali faria a referência sumir
   * numa remontagem — publicando um story com a foto da publicação e sem o
   * quadro que explica de quem ela é.
   */
  const [postNoStory, setPostNoStory] = useState<string | null>(null);
  useEffect(() => {
    if (!conferindoStory || !euId) return;
    try {
      setRascunhoDeStory(
        lerRascunhoDeStory(localStorage.getItem(chaveDoRascunhoDeStory(euId)), new Date()),
      );
    } catch {
      setRascunhoDeStory(null);
    }
  }, [conferindoStory, euId]);

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
  /**
   * FIXAR (ou soltar) no topo do perfil.
   *
   * ⚠️ **A tela pinta DEPOIS do servidor, e não antes.** O teto de três é
   * conferido lá com o que o BANCO tem — entre a abertura da tela e o toque
   * cabem outros aparelhos —, e uma pintura otimista mostraria o pino aceso
   * numa quarta fixada que foi recusada. É o oposto da reação, onde pintar na
   * hora vale porque nada pode recusar.
   *
   * ⚠️ **E o recado do teto vem com o NÚMERO**, que o servidor manda: "no
   * máximo 3" diz o que fazer; "não foi possível fixar" não diz nada.
   */
  /**
   * LEVAR UMA PUBLICAÇÃO PARA O COMPOSITOR DE STORY.
   *
   * ⚠️ **A FOTO DO POST VIRA O FUNDO DO STORY, e a cópia é deliberada.** O
   * banco guarda só o id (`post_de`), e o quadro é resolvido na leitura — mas o
   * FUNDO precisa ser um arquivo do story, porque a publicação pode ser
   * arquivada a qualquer momento e a coluna é `ON DELETE SET NULL`. Sem a
   * cópia, o story de outra pessoa ficaria em branco por uma decisão que não é
   * dela. É o mesmo desenho do Instagram, e pela mesma razão.
   *
   * ⚠️ **Sem foto, não vai.** Publicação só de texto não tem o que virar fundo,
   * e um story de fundo cinza com um cartão em cima não é o que ela pediu — a
   * saída certa aí é o ✈ (mandar para uma conversa), que já existe.
   */
  async function storyComPost(post: PostNaTela) {
    const { toast } = await import("sonner");
    const url = post.imagemUrl;
    if (!url) {
      toast.error("Esta publicação não tem foto para virar story.");
      return;
    }
    try {
      /* ⚠️ Passa pelo MESMO `prepararFotoDoPost` de sempre — ele reduz e
         normaliza o formato. Mandar a URL assinada crua faria o servidor
         receber um endereço em vez de uma imagem. */
      const r = await fetch(url);
      const blob = await r.blob();
      const dataUrl = await prepararFotoDoPost(
        new File([blob], "story.jpg", { type: blob.type || "image/jpeg" }),
      );
      if (!dataUrl) {
        toast.error("Não deu para preparar a foto.");
        return;
      }
      setPostNoStory(post.id);
      setConferindoStory(dataUrl);
    } catch {
      toast.error("Não deu para abrir o compositor agora.");
    }
  }

  async function fixarNoPerfil(post: PostNaTela, fixar: boolean) {
    try {
      const t = await token();
      if (!t) return;
      const { fixarPost } = await import("@/lib/rede-social.functions");
      const r = await fixarPost({ data: { accessToken: t, postId: post.id, fixar } });
      const { toast } = await import("sonner");
      if (!r.ok) {
        toast.error(
          r.motivo === "cheio"
            ? `Você já tem ${"teto" in r ? r.teto : 3} publicações fixadas. Solte uma para fixar outra.`
            : r.motivo === "sem_suporte"
              ? "Fixar ainda não está pronto no servidor."
              : "Não deu para fixar agora.",
        );
        return;
      }
      /* ⚠️ A grade RECARREGA, e a tela não reordena sozinha: a posição das
         fixadas é decidida no servidor (consulta à parte, fora da paginação), e
         reproduzir essa ordem aqui seria a segunda régua que um dia diverge. */
      const carimbo = fixar ? new Date().toISOString() : null;
      setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, fixadoEm: carimbo } : p)));
      /* ⚠️ A grade do perfil tem estado PRÓPRIO (`doPerfil`), separado do feed:
         sem esta linha o pino acenderia no feed e a grade — que é justamente
         onde a fixação aparece — continuaria mostrando o estado velho até uma
         recarga. */
      setDoPerfil((ps) => ps.map((p) => (p.id === post.id ? { ...p, fixadoEm: carimbo } : p)));
      toast.success(fixar ? "Fixada no topo do seu perfil." : "Solta do topo.");
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para fixar agora.");
    }
  }

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
        setFeedInstavel(false);
      } else if ("motivo" in r && r.motivo === "instavel") {
        /* ⚠️ **"NÃO CARREGOU" NÃO PODE TER A CARA DE "NÃO HÁ NADA".** São a
           mesma imagem e conclusões opostas: no primeiro ela convida uma amiga,
           no segundo ela acha que as amigas sumiram. O servidor agora distingue
           (ver `ctx.degradado`); esta linha é o outro lado. */
        setFeedInstavel(true);
      }
      if (st.ok) setBolhas(st.bolhas);
      if (meu.ok) {
        setEuId(meu.perfil.id);
        setPausada(!!(meu as { pausada?: boolean }).pausada);
        setSuspensa(!!(meu as { suspensa?: boolean }).suspensa);
        setMeuAvatar(meu.perfil.avatarUrl ?? null);
        setSemanaDoCarimbo(meu.semanaDoCarimbo);
        /* ⚠️ A preferência chega JUNTO com o feed, na mesma rodada. Buscá-la
           depois faria a tela abrir misturada e, um instante depois, encolher
           para o modo fechado — as publicações sumindo debaixo do dedo de quem
           justamente pediu para não ver estranhas. */
        setSoSeguindo(meu.perfil.feedSoSeguindo);
      }
      if (at.ok) {
        setAvisos(at.itens);
        setNaoVistas(at.novas);
      }
      /* O emblema das mensagens, na mesma abertura. Ver `contarNaoLidas`. */
      void contarNaoLidas();
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
  /**
   * REATIVAR — o caminho de volta, a um toque da faixa.
   *
   * ⚠️ **A faixa precisa DESTE botão, e não de "vá nas configurações".** Quem
   * pausou e quer voltar já está olhando o feed; mandá-la procurar um
   * interruptor três telas adiante é como uma pausa vira uma saída.
   */
  /**
   * A LISTA DAS FAVORITAS — cronológica, como o feed.
   *
   * ⚠️ Ela reusa `meuFeed` com um recorte, e não uma consulta própria: uma
   * segunda montagem de post repetiria `podeVerPost`, as assinaturas de URL e as
   * reações — e a divergência apareceria como post vazando numa lista e não na
   * outra.
   */
  async function marcarFavorita(alvoId: string, ligar: boolean) {
    /* Pinta antes, como o silenciar: é um toque num menu. */
    setPerfil((p) => (p && p.id === alvoId ? { ...p, favorita: ligar } : p));
    try {
      const t = await token();
      if (!t) return;
      const { favoritar } = await import("@/lib/rede-social.functions");
      const r = await favoritar({ data: { accessToken: t, alvoId, favoritar: ligar } });
      const { toast } = await import("sonner");
      if (!r.ok) throw new Error("recusado");
      toast.success(
        ligar ? "Adicionada aos favoritos. Ela não é avisada." : "Tirada dos favoritos.",
      );
    } catch {
      setPerfil((p) => (p && p.id === alvoId ? { ...p, favorita: !ligar } : p));
    }
  }

  async function abrirFavoritas() {
    setOnde({ t: "favoritas" });
    setFavoritas(null);
    try {
      const t = await token();
      if (!t) return;
      const { meuFeed } = await import("@/lib/rede-social.functions");
      const r = await meuFeed({ data: { accessToken: t, soFavoritas: true } });
      /* ⚠️ "Você não tem favoritas" sobre uma falha de leitura a faria
         favoritar de novo alguém que já está lá. */
      setFavoritas(r.ok ? r.posts : "erro");
    } catch {
      setFavoritas("erro");
    }
  }

  async function denunciarUmStory(storyId: string, motivo: MotivoDaDenuncia) {
    try {
      const t = await token();
      if (!t) return;
      const { denunciarStory } = await import("@/lib/rede-social.functions");
      const r = await denunciarStory({ data: { accessToken: t, storyId, motivo } });
      const { toast } = await import("sonner");
      /* ⚠️ **`sem_suporte` NÃO pode virar "fica registrada".** Sem o CHECK novo
         o banco recusa o alvo `story`, e prometer registro sobre uma linha que
         não gravou é a promessa que este app já quebrou uma vez, com
         `denunciado_em` escrito e nunca lido. */
      if (!r.ok) {
        toast.error(
          "motivo" in r && r.motivo === "sem_suporte"
            ? "A denúncia de story ainda não está disponível aqui."
            : "Não deu para denunciar agora.",
        );
        return;
      }
      toast.success("Denúncia registrada. A gente vai olhar.");
    } catch {
      /* Sem rede, a folha fecha e nada é prometido. */
    }
  }

  /**
   * O EXPLORAR — e ele NÃO é um feed por relevância.
   *
   * ⚠️ **A grade sai de `sugestoesDoFeed`, que já é a régua desta aba:** perfil
   * público, publicação pública, `podeVerPost` por cima, e ordenação por elos em
   * comum e recência — nunca por engajamento. Uma consulta própria aqui abriria
   * a porta para "o que está bombando", e numa base de alto risco o que mais
   * engaja é o post da EMERGÊNCIA.
   */
  async function abrirExplorar() {
    setOnde({ t: "explorar" });
    setExplorar(null);
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/rede-social.functions");
      /* Grade e tags na MESMA onda: são independentes, e em série a lista de
         assuntos só apareceria depois da grade inteira. */
      const [sug, tg] = await Promise.all([
        mod.sugestoesDoFeed({ data: { accessToken: t } }),
        mod.tagsEmAlta({ data: { accessToken: t } }),
      ]);
      /* ⚠️ "Não há nada para descobrir" e "não carregou" são a mesma imagem e
         conclusões opostas — a primeira faz ela convidar uma amiga, a segunda
         faz ela achar que a rede morreu. */
      if (!sug.ok) {
        setExplorar("erro");
        return;
      }
      setExplorar({ posts: sug.posts, tags: tg.ok ? tg.tags : [] });
    } catch {
      setExplorar("erro");
    }
  }

  /**
   * ⚠️ **O RECADO DIZ QUE ELA VOLTA.** Sem isso, "Arquivada" lê como o "Sair"
   * que está logo acima no mesmo menu — e a paciente que queria só limpar a
   * caixa acha que encerrou a conversa.
   */
  async function arquivarEstaConversa(conversaId: string, arquivar: boolean) {
    try {
      const t = await token();
      if (!t) return;
      const { arquivarConversa } = await import("@/lib/conversa.functions");
      const r = await arquivarConversa({ data: { accessToken: t, conversaId, arquivar } });
      const { toast } = await import("sonner");
      if (!r.ok) {
        toast.error("Não deu para arquivar agora.");
        return;
      }
      toast.success(arquivar ? "Arquivada. Volta se ela escrever." : "De volta para as mensagens.");
      setOnde({ t: "conversas" });
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para arquivar agora.");
    }
  }

  async function fixarEstaConversa(conversaId: string, fixar: boolean) {
    try {
      const t = await token();
      if (!t) return;
      const { fixarConversa } = await import("@/lib/conversa.functions");
      const r = await fixarConversa({ data: { accessToken: t, conversaId, fixar } });
      const { toast } = await import("sonner");
      /* ⚠️ `sem_suporte` = o banco ainda não tem a coluna. Dizer "fixado" sobre
         uma conversa que não vai subir é a tela mentindo sobre a própria
         lista. */
      if (!r.ok) {
        toast.error("Não deu para fixar agora.");
        return;
      }
      toast.success(fixar ? "Fixada no topo. Só na sua lista." : "Tirada do topo.");
      setConversaAberta((c) =>
        c && c.id === conversaId ? { ...c, fixadaEm: fixar ? new Date().toISOString() : null } : c,
      );
    } catch {
      /* Sem rede, o menu fecha e nada é prometido. */
    }
  }

  async function denunciarEstaConversa(conversaId: string, motivo: string) {
    try {
      const t = await token();
      if (!t) return;
      const { denunciarConversa } = await import("@/lib/conversa.functions");
      const r = await denunciarConversa({
        data: { accessToken: t, conversaId, motivo: motivo as never },
      });
      const { toast } = await import("sonner");
      /* ⚠️ **`sem_suporte` NÃO pode virar "fica registrada".** Sem o CHECK novo
         o banco recusa o alvo `conversa`, e prometer registro sobre uma linha
         que não gravou é a promessa que este app já quebrou uma vez. */
      if (!r.ok) {
        toast.error(
          "motivo" in r && r.motivo === "sem_suporte"
            ? "A denúncia de conversa ainda não está disponível aqui."
            : "Não deu para denunciar agora.",
        );
        return;
      }
      toast.success("Denúncia registrada. A gente vai olhar.");
    } catch {
      /* Sem rede, a folha fecha e nada é prometido. */
    }
  }

  async function reativarMinhaConta() {
    try {
      const t = await token();
      if (!t) return;
      const { pausarMinhaRede } = await import("@/lib/rede-social.functions");
      const r = await pausarMinhaRede({ data: { accessToken: t, pausar: false } });
      const { toast } = await import("sonner");
      if (!r.ok) {
        toast.error("Não deu para reativar agora.");
        return;
      }
      setPausada(false);
      toast.success("Sua conta voltou 💛");
      void carregarFeed();
    } catch {
      /* Sem rede, a faixa continua — que é a verdade. */
    }
  }

  async function silenciarPerfil(
    alvoId: string,
    calar: boolean,
    quais?: { calaPosts: boolean; calaStories: boolean },
  ) {
    setPerfil((p) => (p && p.id === alvoId ? { ...p, silenciado: calar } : p));
    try {
      const t = await token();
      if (!t) return;
      const { silenciar } = await import("@/lib/rede-social.functions");
      const r = await silenciar({
        data: {
          accessToken: t,
          alvoId,
          silenciar: calar,
          calaPosts: quais?.calaPosts,
          calaStories: quais?.calaStories,
        },
      });
      const { toast } = await import("sonner");
      if (r.ok) {
        /* ⚠️ **`parcial` diz que a ESCOLHA não pegou**, e a tela precisa contar:
           se ela pediu para calar só os stories e o banco (sem as colunas) calou
           os dois, dizer "pronto" seria mentir sobre o alcance do próprio
           silêncio dela. */
        if ("parcial" in r && r.parcial) {
          toast.success("Silenciada — por enquanto, publicações e stories.");
        } else {
          toast.success(
            !calar
              ? "Voltou para o seu feed."
              : quais && !quais.calaPosts
                ? "Stories silenciados. Ela não é avisada."
                : quais && !quais.calaStories
                  ? "Publicações silenciadas. Ela não é avisada."
                  : "Silenciada. Ela não é avisada.",
          );
        }
        void carregarFeed();
      } else {
        setPerfil((p) => (p && p.id === alvoId ? { ...p, silenciado: !calar } : p));
        toast.error("Não deu para mudar agora.");
      }
    } catch {
      setPerfil((p) => (p && p.id === alvoId ? { ...p, silenciado: !calar } : p));
    }
  }

  /**
   * RESTRINGIR — e a tela pinta ANTES, como o silenciar.
   *
   * ⚠️ **NÃO recarrega o feed.** Silenciar muda o que aparece no feed e por isso
   * o recarrega; restringir não tira nada do feed — muda só quem lê o comentário
   * dela. Recarregar aqui seria uma volta ao servidor por nada, na tela mais
   * pesada do app.
   */
  async function restringirPerfil(alvoId: string, restringirAgora: boolean) {
    setPerfil((p) => (p && p.id === alvoId ? { ...p, restrito: restringirAgora } : p));
    try {
      const t = await token();
      if (!t) return;
      const { restringir } = await import("@/lib/comentarios.functions");
      const r = await restringir({
        data: { accessToken: t, alvoId, restringir: restringirAgora },
      });
      const { toast } = await import("sonner");
      if (r.ok) {
        toast.success(
          restringirAgora
            ? "Restringida. Ela não é avisada."
            : "Os comentários dela voltam a aparecer.",
        );
      } else {
        setPerfil((p) => (p && p.id === alvoId ? { ...p, restrito: !restringirAgora } : p));
        toast.error(
          r.motivo === "sem_suporte"
            ? "Restringir ainda não está pronto no servidor."
            : "Não deu para mudar agora.",
        );
      }
    } catch {
      setPerfil((p) => (p && p.id === alvoId ? { ...p, restrito: !restringirAgora } : p));
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
       vive em `perfil.seguidores`, e sem isto a lista mostraria 11 pessoas
       embaixo de um "12 seguidores". */
    setGente((g) => g.filter((p) => p.id !== quemId));
    setPerfil((p) =>
      p && p.seguidores != null ? { ...p, seguidores: Math.max(0, p.seguidores - 1) } : p,
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
     ali a fileira de pessoas é a única coisa útil na tela.

     ⚠️ **E NO MODO MISTURADO ELAS SÃO PEDIDAS JÁ NA ABERTURA** (`!soSeguindo`),
     não ao chegar no fim. A costura precisa das descobertas em mãos desde a
     primeira pintura; esperar o fim da rolagem faria o feed abrir puro e as
     desconhecidas aparecerem de repente no meio do que ela já estava lendo,
     empurrando o post para baixo do dedo. */
  useEffect(() => {
    if (careMode) return;
    if (!soSeguindo) {
      void carregarSugestoes();
      return;
    }
    if (carregando || proximo) return;
    void carregarSugestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode, carregando, proximo, soSeguindo]);

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

  /**
   * Quantas conversas pedem resposta.
   *
   * ⚠️ Vem JUNTO com o feed, na abertura — o emblema é o que faz alguém tocar
   * no atalho. Buscando só ao abrir a caixa, o número nasceria sempre zerado e
   * ninguém saberia que tem mensagem. É a mesma razão pela qual a atividade já
   * vem junto.
   */
  /**
   * Abre (ou cria) a conversa com alguém, a partir do perfil.
   *
   * ⚠️ **QUEM DECIDE SE PODE É O SERVIDOR**, e a tela só conta o desfecho. Uma
   * régua aqui divergiria de `podeIniciarConversa` no primeiro ajuste — e a
   * divergência apareceria como um botão que abre uma tela vazia, ou como um
   * botão escondido de quem tinha direito a ele.
   */
  /**
   * ⚠️ **LIMPA A REPUBLICAÇÃO AO SAIR DO COMPOSITOR, e num EFEITO.**
   *
   * Sem isto, a publicação seguinte nasceria republicando algo que ninguém
   * pediu. E a primeira versão fazia `setRepostando(null)` no meio do render —
   * o `tsc` pegou pelo lado errado (a comparação já estava estreitada), mas o
   * defeito real é outro: mudar estado durante a pintura é anti-padrão do React
   * e custa um render a mais em toda troca de tela.
   */
  useEffect(() => {
    if (onde.t !== "novo") setRepostando(null);
  }, [onde.t]);

  /**
   * COMPARTILHAR A PRÓPRIA PUBLICAÇÃO PARA FORA.
   *
   * ⚠️ **ENTREGA O ARQUIVO AO SISTEMA, e cai para o texto quando não dá.** Um
   * `share({files})` num navegador que só aceita texto falha DEPOIS de a
   * paciente tocar, com a folha do sistema já aberta — `comoCompartilhar`
   * pergunta antes.
   *
   * ⚠️ **A IMAGEM É BAIXADA DA URL ASSINADA, e por isso pode falhar.** Ela tem
   * validade, e a rede dela pode estar ruim. Falhou o arquivo, vai o texto: o
   * pior caso é a amiga receber o link sem a foto, e não um botão que não faz
   * nada.
   */
  async function compartilhar(post: PostNaTela) {
    const { comoCompartilhar, podeCompartilharPost, textoDoCompartilhamento } =
      await import("@/lib/compartilhar-post");
    /* A régua de novo aqui, e não só no botão: o botão some para post alheio,
       mas quem garante é isto. */
    if (
      podeCompartilharPost({
        souAAutora: post.souAAutora,
        temImagem: !!post.imagemUrl,
        temVideo: !!post.videoUrl,
        temTexto: !!post.texto,
      })
    ) {
      return;
    }

    const modo = comoCompartilhar(navigator as never);
    if (modo === "nenhum") return;

    const texto = textoDoCompartilhamento(post.texto, linkDeIndicacao(meuCodigo));

    if (modo === "arquivo" && post.imagemUrl) {
      try {
        const r = await fetch(post.imagemUrl);
        if (r.ok) {
          const blob = await r.blob();
          const arq = new File([blob], "obstetrica.jpg", { type: blob.type || "image/jpeg" });
          if (navigator.canShare?.({ files: [arq] })) {
            await navigator.share({ files: [arq], text: texto });
            return;
          }
        }
      } catch {
        /* Cai para o texto, logo abaixo. */
      }
    }
    try {
      await navigator.share({ text: texto });
    } catch {
      /* Ela cancelou a folha do sistema — não é erro. */
    }
  }

  /**
   * REPUBLICAR — abre o compositor já com a original anexada.
   *
   * ⚠️ **NÃO PUBLICA DIRETO.** Republicar sem escrever nada é o gesto que enche
   * o feed de cópias sem contexto; o compositor obriga a passar pela tela, e é
   * ali que ela decide o texto e a camada da própria publicação. E é o mesmo
   * caminho de qualquer post, então a régua clínica e a triagem continuam
   * valendo — um repost sem compositor as pularia.
   */
  function republicar(post: PostNaTela) {
    setRepostando(post);
    setOnde({ t: "novo" });
  }

  async function abrirConversaCom(alvoId: string, rascunho?: string) {
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/conversa.functions");
      const r = await mod.abrirConversa({ data: { accessToken: t, alvoId } });
      if (!r.ok) {
        /* ⚠️ Bloqueio e fora-de-alcance dizem a MESMA coisa na tela. Separar os
           dois contaria que o bloqueio existe — a mesma razão pela qual o
           servidor confere o bloqueio antes do alcance. */
        /* ⚠️ `sonner` entra por import DINÂMICO, como em todo este arquivo:
           estático ele toca `document` ao carregar e derruba o `bun test`
           inteiro — a lição de `assinatura.ts`. */
        const { toast } = await import("sonner");
        toast.error("Não é possível enviar mensagem para esta pessoa.");
        return;
      }
      const { minhasConversas } = await import("@/lib/conversa.functions");
      const lista = await minhasConversas({ data: { accessToken: t } });
      const c = lista.ok ? lista.conversas.find((x) => x.id === r.id) : null;
      if (!c) return;
      setRascunhoDaConversa(rascunho ?? null);
      setConversaAberta(c);
      setOnde({ t: "conversa" });
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para abrir a conversa agora.");
    }
  }

  /**
   * RESPONDER AO STORY — vira mensagem direta, com o story anexado.
   *
   * ⚠️ **NÃO abre a conversa.** No modelo, responder a um story manda e devolve
   * a pessoa ao story seguinte: ela está assistindo, não conversando. Abrir a
   * caixa aqui tiraria a paciente do meio de uma sequência que ela escolheu ver.
   *
   * ⚠️ **A recusa é DITA, e nunca em silêncio.** A trava de uma-mensagem-antes-
   * do-aceite vale aqui também: quem não é seguida de volta manda uma e espera.
   * Sem o recado, o "Enviado 💛" já pintado na tela viraria mentira.
   */
  async function responderAoStory(
    autorId: string,
    storyId: string,
    texto: string,
    foto?: File | null,
  ) {
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/conversa.functions");
      const abriu = await mod.abrirConversa({ data: { accessToken: t, alvoId: autorId } });
      const { toast } = await import("sonner");
      if (!abriu.ok) {
        toast.error("Não é possível enviar mensagem para esta pessoa.");
        return;
      }
      /* ⚠️ **A foto sobe DEPOIS de a conversa existir, e não antes.** O caminho
         no balde é conferido contra a conversa (`minhaConversa`) — sem o id não
         há como pedir a URL assinada. E se ela falhar, a mensagem SAI mesmo
         assim, só sem a foto: perder o texto que ela escreveu por causa do
         anexo seria o pior desfecho, e o story some em 24 h. */
      let imagemPath: string | undefined;
      if (foto) {
        const caminho = await subirFoto(t, abriu.id, foto);
        if (caminho) imagemPath = caminho;
        else toast.error("A foto não subiu — mandei só o texto.");
      }
      const r = await mod.enviarMensagem({
        data: {
          accessToken: t,
          conversaId: abriu.id,
          texto,
          imagemPath,
          refTipo: "story",
          refId: storyId,
        },
      });
      if (!r.ok) {
        toast.error(
          r.motivo === "aguardando_aceite"
            ? "Você já mandou uma mensagem. Espere a resposta."
            : r.motivo === "emergencia"
              ? "Isso precisa de atendimento. Use o botão de emergência."
              : "Não deu para enviar agora.",
        );
        return;
      }
      void contarNaoLidas();
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para enviar agora.");
    }
  }

  const contarNaoLidas = useCallback(async () => {
    try {
      const t = await token();
      if (!t) return;
      /* ⚠️ **O EMBLEMA CONTAVA SÓ AS CONVERSAS DE DUAS.** Uma mensagem de
         grupo não acendia número nenhum: a bolinha do grupo existe, e vive
         DENTRO da lista de grupos, que só se vê depois de já ter aberto a aba
         Mensagens. Ou seja, o aviso só chegava a quem já tinha ido olhar. */
      const [{ minhasConversas }, { meusGrupos }] = await Promise.all([
        import("@/lib/conversa.functions"),
        import("@/lib/grupo.functions"),
      ]);
      const [r, g] = await Promise.all([
        minhasConversas({ data: { accessToken: t } }),
        meusGrupos({ data: { accessToken: t } }),
      ]);
      /* ⚠️ Cada metade conta a sua. Uma falha na leitura dos grupos não pode
         zerar o número das conversas — o emblema some e ela deixa de abrir a
         mensagem que existe. */
      const deConversas = r.ok ? r.naoLidas : 0;
      const deGrupos = g.ok ? g.grupos.filter((x) => x.naoLida).length : 0;
      if (r.ok || g.ok) setMsgsNaoLidas(deConversas + deGrupos);
    } catch {
      /* Sem o número o atalho fica sem emblema, que é o estado de quem não tem
         mensagem — nunca um erro na tela. */
    }
  }, []);

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

  /**
   * O `@` DE UMA MENÇÃO VIRA UM PERFIL.
   *
   * ⚠️ **A resolução é do SERVIDOR, e um `@` que não existe não é erro de
   * app.** Legenda é texto livre: qualquer pessoa escreve `@` seguido de
   * qualquer coisa, e transformar isso num alerta vermelho faria a tela gritar
   * por causa de uma palavra. Um aviso curto e a tela fica onde estava.
   */
  async function abrirPorArroba(handle: string) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { perfilPorHandle } = await import("@/lib/mencoes.functions");
      const r = await perfilPorHandle({ data: { accessToken: token, handle } });
      if (r.ok) {
        void abrirPerfil(r.id);
        return;
      }
      const { toast } = await import("sonner");
      toast(r.motivo === "nao_achei" ? `Não encontrei @${handle}.` : "Não deu para abrir agora.");
    } catch {
      /* Sem rede, o toque não leva a lugar nenhum — e é melhor que um erro. */
    }
  }

  async function abrirTag(tag: string) {
    setOnde({ t: "tag", tag });
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
        /**
         * ⚠️ **A RESTRIÇÃO VEM NUMA CONSULTA PRÓPRIA, e não em `verPerfil`.**
         *
         * Aquela função monta o perfil que QUALQUER pessoa vê, e um campo
         * "você me restringe?" ali viajaria no perfil de terceiro — que é
         * exatamente o vazamento que destruiria o recurso: o silêncio é a única
         * coisa que separa restringir de bloquear.
         *
         * ⚠️ E ela roda DEPOIS de o perfil estar na tela, num `try` próprio: o
         * botão nasce em "Restringir" (o estado de quem não restringiu) e se
         * corrige; uma falha aqui não pode segurar a abertura do perfil.
         */
        void (async () => {
          try {
            const { minhasRestricoes } = await import("@/lib/comentarios.functions");
            const rr = await minhasRestricoes({ data: { accessToken: t } });
            if (rr.ok) {
              setPerfil((p) => (p && p.id === id ? { ...p, restrito: rr.ids.includes(id) } : p));
            }
          } catch {
            /* O botão fica em "Restringir", que é o estado mais comum. */
          }
        })();
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

  /**
   * ABRE O LINK PÚBLICO e o entrega pronto para colar.
   *
   * ⚠️ **Vai o LINK para a área de transferência, e não uma URL crua num
   * `share` de arquivo.** Colado no WhatsApp, um endereço sozinho já diz o que
   * é (o cartão do link mostra a foto); e é o mesmo caminho do convite das
   * Amigas, que aprendeu isso da forma cara.
   */
  async function abrirLinkPublico(post: PostNaTela) {
    try {
      const t = await token();
      if (!t) return;
      const { linkPublicoDoPost } = await import("@/lib/rede-social.functions");
      const r = await linkPublicoDoPost({ data: { accessToken: t, postId: post.id, abrir: true } });
      const { toast } = await import("sonner");
      if (!r.ok) {
        /* ⚠️ Cada recusa tem recado PRÓPRIO: "não deu" sobre uma publicação que
           ela fechou para as amigas não diz o que fazer diferente. */
        return toast.error(
          r.motivo === "nao_e_publico"
            ? "Só publicação aberta a todo mundo tem link."
            : r.motivo === "arquivado"
              ? "Esta publicação está arquivada."
              : "Não deu para gerar o link agora.",
        );
      }
      const { linkDaPublicacao } = await import("@/lib/link-da-publicacao");
      const url = linkDaPublicacao(r.codigo);
      if (!url) return toast.error("Não deu para gerar o link agora.");
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado. Qualquer pessoa com ele abre esta publicação.");
      } catch {
        /* ⚠️ Sem área de transferência (navegador antigo, permissão negada), o
           link NÃO se perde: ele aparece no recado para ela copiar à mão. */
        toast.success(url);
      }
    } catch {
      /* Sem rede: o botão continua ali. */
    }
  }

  async function abrirEscondidos() {
    setEscondidos(null);
    setOnde({ t: "escondidos" });
    try {
      const t = await token();
      if (!t) return;
      const { meusEscondidosDoStory } = await import("@/lib/rede-social.functions");
      const r = await meusEscondidosDoStory({ data: { accessToken: t } });
      /* ⚠️ Falha vira `"erro"`, e NUNCA lista vazia: "você não escondeu de
         ninguém" faria ela esconder de novo, ou desistir. */
      setEscondidos(r.ok ? r.gente : ("erro" as any));
    } catch {
      setEscondidos("erro" as any);
    }
  }

  async function mostrarStoryDeNovo(alvoId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { esconderStoryDe } = await import("@/lib/rede-social.functions");
      const r = await esconderStoryDe({ data: { accessToken: t, alvoId, esconder: false } });
      const { toast } = await import("sonner");
      if (!r.ok) return toast.error("Não deu para desfazer agora.");
      /* A lista se corrige na tela sem esperar outra ida à rede. */
      setEscondidos((v) => (Array.isArray(v) ? v.filter((p) => p.id !== alvoId) : v));
      toast.success("Ela volta a ver seus stories.");
    } catch {
      /* Fica como está; o botão continua ali. */
    }
  }

  async function esconderMeuStoryDe(alvoId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { esconderStoryDe } = await import("@/lib/rede-social.functions");
      const r = await esconderStoryDe({ data: { accessToken: t, alvoId, esconder: true } });
      const { toast } = await import("sonner");
      /* ⚠️ O recado NÃO nomeia ninguém e diz que é calado: sem a segunda
         frase, ela imagina que a pessoa foi avisada — e não esconde. */
      if (!r.ok) return toast.error("Não deu para esconder agora.");
      toast.success("Pronto. Ela não é avisada.");
    } catch {
      /* Idem. */
    }
  }

  async function abrirCurtidos() {
    setCurtidos(null);
    setOnde({ t: "curtidos" });
    try {
      const t = await token();
      if (!t) return;
      const { meusCurtidos } = await import("@/lib/rede-social.functions");
      const r = await meusCurtidos({ data: { accessToken: t } });
      setCurtidos(r.ok ? r.posts : ("erro" as any));
    } catch {
      setCurtidos("erro" as any);
    }
  }

  async function abrirDesfechos() {
    setDesfechos(null);
    setOnde({ t: "desfechos" });
    try {
      const t = await token();
      if (!t) return;
      const { meusDesfechos } = await import("@/lib/rede-social.functions");
      const r = await meusDesfechos({ data: { accessToken: t } });
      setDesfechos(r.ok ? r.desfechos : ("erro" as any));
    } catch {
      setDesfechos("erro" as any);
    }
  }

  async function abrirLista(tipo: "seguidores" | "seguindo", alvoId?: string) {
    setGente([]);
    setOnde({ t: "lista", tipo });
    try {
      const t = await token();
      if (!t) return;
      const { listaDeGente } = await import("@/lib/rede-social.functions");
      /* ⚠️ O alvo vai como está; quem confere se ela pode ver é o SERVIDOR
         (`alcancaOPerfil`). Uma segunda régua aqui diria "indisponível" sobre um
         perfil que o servidor abriria — ou o contrário, que é pior. */
      const r = await listaDeGente({ data: { accessToken: t, tipo, alvoId } });
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
        /* ⚠️ **O RETORNO ERA DESCARTADO — e o ramo LOGO ABAIXO, na MESMA
         * funcao, le o dele.** `{ ok: false }` chega num 200 NORMAL, entao o
         * `catch` nao pega: o botao virava "Seguir", ela saia da tela achando
         * que tinha deixado de seguir, e na proxima abertura estava seguindo de
         * novo. Nao ha erro, nao ha log — so o app desfazendo uma decisao dela.
         *
         * A regra ja estava aplicada dois ramos abaixo (`if (r.ok) setPerfil`);
         * o que faltava era valer para os dois. */
        const r = await mod.deixarDeSeguir({ data: { accessToken: t, alvoId: perfil.id } });
        if (r.ok) setPerfil({ ...perfil, meuVinculo: null });
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
    bioLink?: string | null;
    avatar?: string | null;
  }): Promise<boolean> {
    try {
      const t = await token();
      if (!t) return false;
      const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await salvarPerfilSocial({ data: { accessToken: t, ...m } });
      if (!r.ok) {
        /* ⚠️ **A RECUSA DA BIO PRECISA SER DITA.** Devolver `false` mudo faz o
           botão de salvar não fazer nada — e ela não tem como adivinhar que a
           descrição foi recusada por falar de sintoma. */
        if ("recado" in r && r.recado) {
          const { toast } = await import("sonner");
          toast.error(r.recado);
        }
        return false;
      }
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
    /** A descrição da foto, para leitores de tela. */
    altTexto?: string | null;
    /** ⚠️ Um RÓTULO que ela escreve, nunca coordenada. */
    lugar?: string | null;
    texto: string | null;
    fotos: string[];
    /** A versão de 480px da primeira foto. `null` é normal — ver `miniatura.ts`. */
    miniatura?: string | null;
    visibilidade: Visibilidade;
    quemComenta?: QuemComenta;
    enquete: string[];
    aula: AulaNoPost | null;
    /** O marco do bebê, com a idade em DIAS. Ver `marcos.ts`. */
    marco?: { tipo: string; dias: number | null } | null;
    /** O vídeo JÁ SUBIDO ao Storage — só o caminho viaja. Ver `video-do-post.ts`. */
    video?: { caminho: string; segundos: number | null } | null;
    /** A publicação republicada. Conferida no servidor. */
    repostDe?: string | null;
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
          quemComenta: p.quemComenta,
          enquete: p.enquete,
          aula: p.aula,
          marco: p.marco ?? null,
          video: p.video ?? null,
          repostDe: p.repostDe ?? null,
          marcadas: p.marcadas,
          comparacaoCom: p.comparacaoCom ?? undefined,
          altTexto: p.altTexto ?? undefined,
          lugar: p.lugar ?? undefined,
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

  /**
   * O ARQUIVO DE STORIES.
   *
   * ⚠️ **Estado próprio, e não o de `arquivados`.** São duas listas de tipos
   * diferentes (`StoryArquivado` contra `PostNaTela`), e reusar o estado faria a
   * tela dos posts arquivados desenhar stories na volta de uma navegação.
   *
   * ⚠️ E `null` é "ainda não carregou", `[]` é "não publicou nenhum": juntar os
   * dois faria a tela dizer "você ainda não publicou stories" enquanto a lista
   * vem — para quem tem trinta.
   */
  /**
   * A LISTA DE QUEM EU BLOQUEEI.
   *
   * ⚠️ `"erro"` é um estado PRÓPRIO, e não uma lista vazia: "você não bloqueou
   * ninguém" faria ela concluir que o bloqueio não pegou — e talvez bloquear de
   * novo, ou desistir de bloquear.
   */
  async function abrirBloqueados() {
    setBloqueados(null);
    setOnde({ t: "bloqueados" });
    try {
      const t = await token();
      if (!t) return;
      const { meusBloqueados } = await import("@/lib/rede-social.functions");
      const r = await meusBloqueados({ data: { accessToken: t } });
      setBloqueados(r.ok ? r.pessoas : "erro");
    } catch {
      setBloqueados("erro");
    }
  }

  /** Desbloquear, da própria lista. */
  async function desbloquear(id: string) {
    const antes = bloqueados;
    setBloqueados((b) => (Array.isArray(b) ? b.filter((p) => p.id !== id) : b));
    try {
      const t = await token();
      if (!t) return;
      const { bloquear } = await import("@/lib/rede-social.functions");
      const r = await bloquear({ data: { accessToken: t, alvoId: id, bloquear: false } });
      if (!r.ok) {
        setBloqueados(antes);
        const { toast } = await import("sonner");
        toast.error("Não deu para desbloquear agora.");
      }
    } catch {
      setBloqueados(antes);
    }
  }

  async function abrirArquivoDeStories() {
    setArquivoStories(null);
    setArquivoStoriesInstavel(false);
    setOnde({ t: "arquivo-stories" });
    try {
      const t = await token();
      if (!t) return;
      const { meuArquivoDeStories } = await import("@/lib/rede-social.functions");
      const r = await meuArquivoDeStories({ data: { accessToken: t } });
      if (r.ok) {
        setArquivoStories(r.stories);
        setProximoArquivo(r.proximo);
        return;
      }
      /* ⚠️ **"NÃO CARREGOU" NÃO PODE TER A CARA DE "NÃO HÁ NADA"** — a mesma
         lição do feed instável. Aqui é pior: "você nunca publicou um story" é a
         frase mais errada que esta tela pode dizer a quem publicou trinta. */
      setArquivoStoriesInstavel(true);
    } catch {
      setArquivoStoriesInstavel(true);
    }
  }

  /** A próxima leva do arquivo. */
  async function maisDoArquivoDeStories() {
    if (!proximoArquivo) return;
    try {
      const t = await token();
      if (!t) return;
      const { meuArquivoDeStories } = await import("@/lib/rede-social.functions");
      const r = await meuArquivoDeStories({ data: { accessToken: t, antesDe: proximoArquivo } });
      if (!r.ok) return;
      /* ⚠️ Junta SEM repetir por id: duas páginas podem se sobrepor, e chave
         repetida derruba a lista inteira do React. */
      setArquivoStories((ps) => {
        const vistos = new Set((ps ?? []).map((x) => x.id));
        return [...(ps ?? []), ...r.stories.filter((x) => !vistos.has(x.id))];
      });
      setProximoArquivo(r.proximo);
    } catch {
      /* A lista que já está na tela continua. */
    }
  }

  /**
   * Destacar (ou soltar) um story.
   *
   * ⚠️ **Pinta DEPOIS do servidor**, como o fixar: o teto é conferido lá com o
   * que o banco tem, e uma pintura otimista acenderia o selo num destaque que
   * foi recusado.
   */
  async function destacarNoPerfil(storyId: string, destacar: boolean, titulo?: string | null) {
    try {
      const t = await token();
      if (!t) return;
      const { destacarStory } = await import("@/lib/rede-social.functions");
      const r = await destacarStory({ data: { accessToken: t, storyId, destacar, titulo } });
      const { toast } = await import("sonner");
      if (!r.ok) {
        toast.error(
          r.motivo === "cheio"
            ? `Você já tem ${"teto" in r ? r.teto : 10} stories em destaque. Solte um para destacar outro.`
            : r.motivo === "sem_suporte"
              ? "Destacar ainda não está pronto no servidor."
              : "Não deu para destacar agora.",
        );
        return;
      }
      setArquivoStories((ps) =>
        (ps ?? []).map((x) => (x.id === storyId ? { ...x, destacado: destacar } : x)),
      );
      toast.success(destacar ? "No destaque do seu perfil." : "Fora do destaque.");
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para destacar agora.");
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
      const r = await desarquivarPost({ data: { accessToken: t, postId: post.id } });
      /* ⚠️ **O `try/catch` NÃO PEGA ISTO**, e era o engano: a função devolve
         `{ ok: false }` numa resposta 200 NORMAL — não lança. Com o resultado
         descartado, a publicação sumia da gaveta (a pintura otimista da linha
         de cima), não voltava ao feed, e ela ficava sem ela nas DUAS listas,
         sem nenhum recado. Concluiria que perdeu a publicação. */
      if (!r.ok) {
        const { toast } = await import("sonner");
        toast.error("Não deu para trazer de volta agora.");
        void abrirArquivados();
        return;
      }
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
    texto: string,
    camada: VisibilidadeDoStory,
    carimbar: boolean,
    enquete: string[],
    perguntaAberta: boolean,
    marcadas: string[],
    maisFotos: string[],
  ) {
    setConferindoStory(null);
    /* ⚠️ Lido ANTES de zerar: o `setPostNoStory(null)` abaixo é assíncrono, e
       ler o estado depois dele mandaria `null` para o servidor — o story sairia
       sem o quadro, com a foto de outra pessoa e nada dizendo de quem é.
       ⚠️ E o VÍDEO tem exatamente o mesmo perigo, com uma diferença: o arquivo
       já está no balde. Ler depois de zerar publicaria um story de capa
       PARADA, e o vídeo que ela gravou ficaria órfão no Storage. */
    const comPost = postNoStory;
    const comVideo = videoDoStory;
    setPostNoStory(null);
    setVideoDoStory(null);
    try {
      const t = await token();
      if (!t) return;
      const { publicarStory: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({
        data: {
          accessToken: t,
          imagem: dataUrl,
          /* ⚠️ Vazio vira `null`, e não `""`: a coluna é anulável e um string
             vazio faria a leitura desenhar uma faixa de texto sem texto por
             cima da foto. */
          texto: texto.trim() || null,
          carimbarSemana: carimbar,
          enquete,
          perguntaAberta,
          postDe: comPost,
          visibilidade: camada,
          marcadas,
          maisFotos,
          video: comVideo,
        },
      });
      if (r.ok) {
        /* ⚠️ Publicou, o rascunho some — senão a próxima abertura oferece de
           volta o story que ela ACABOU de publicar.
           ⚠️ E o nome é `guardarRascunhoDoStory`, NUNCA `guardarRascunho`: esse
           já existe neste arquivo e é o do POST. Reusá-lo aqui apagaria o
           rascunho da publicação dela ao publicar um story. */
        guardarRascunhoDoStory(null);
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
  /* A folha "Mais" da Comunidade — ver `MaisDaComunidade`. Fecha sozinha ao
     sair do feed: os itens dela agem sobre o feed, e uma folha aberta por cima
     de outra tela ofereceria "Salvos" em cima do perfil de alguém. */
  const [maisAberto, setMaisAberto] = useState(false);
  useEffect(() => {
    if (onde.t !== "feed") setMaisAberto(false);
  }, [onde.t]);

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
    /* ⚠️ **QUATRO de uso diário e a bolinha "Mais" — nunca a lista inteira.**
       O leque chegou a CATORZE bolinhas numa coluna: passava por cima do
       relógio do celular, repetia ícones e misturava uso diário com segurança
       (pedido do dono, com a foto: "muitas opções e muito confuso"). O resto
       mora em `MaisDaComunidade`, em três grupos com ícone próprio. Função
       nova entra LÁ, num grupo — não aqui. */
    const atalhos: AtalhoDaAba[] = [
      {
        id: "atividade",
        rotulo: "Atividade",
        icone: "coracao",
        emblema: naoVistas,
        aoTocar: () => void abrirAtividade(),
      },
      /* ⚠️ A CAIXA DE ENTRADA FICA AO LADO DA ATIVIDADE, e não no cabeçalho:
         ele foi removido a pedido do dono ("cada aba não precisa ocupar esse
         espaço que é precioso"), e as ações viraram estas bolinhas. Pôr um
         ícone de mensagem no topo desfaria aquela decisão. */
      {
        id: "mensagens",
        rotulo: "Mensagens",
        icone: "balao",
        emblema: msgsNaoLidas,
        aoTocar: () => setOnde({ t: "conversas" }),
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
      {
        id: "mais",
        rotulo: "Mais",
        icone: "pontos",
        /* O emblema da caixinha sobe para a bolinha "Mais": sem isso, uma
           pergunta sem resposta ficaria invisível até ela abrir a folha. */
        emblema: naCaixa,
        aoTocar: () => setMaisAberto(true),
      },
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
        <div className="rounded-3xl card-material p-8 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            O feed está em pausa enquanto o Modo Cuidado estiver ligado.
          </p>
          {onAbrirSecoes && (
            <button
              type="button"
              onClick={onAbrirSecoes}
              className="press mt-4 rounded-full pill-3d px-5 py-2 text-xs font-semibold text-foreground"
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
        aoCancelar={() => {
          setConferindoStory(null);
          /* ⚠️ Desistiu, a referência some: sem isto, a PRÓXIMA foto que ela
             escolhesse sairia com o quadro de uma publicação que ela já tinha
             largado. E o vídeo junto, pela mesma razão: a próxima FOTO sairia
             com o vídeo de antes pendurado nela. */
          setPostNoStory(null);
          setVideoDoStory(null);
        }}
        aoPublicar={({ texto, camada, carimbar, enquete, perguntaAberta, marcadas, maisFotos }) =>
          void publicarStory(
            conferindoStory,
            texto,
            camada,
            carimbar,
            enquete,
            perguntaAberta,
            marcadas,
            maisFotos,
          )
        }
        /* A MESMA lista do compositor de post — nunca uma busca. */
        amigasParaMarcar={paraMarcar}
        rascunho={rascunhoDeStory}
        aoGuardarRascunho={guardarRascunhoDoStory}
        temVideo={!!videoDoStory}
      />
    );
  }

  if (vendoStory) {
    return (
      <VisorDeStory
        /* ⚠️ Fecha o visor ANTES de abrir a publicação: o visor é `fixed
           inset-0`, e navegar por baixo dele deixaria a paciente na tela do
           post sem conseguir vê-la. */
        aoMandarStory={(id) => setMandandoStory(id)}
        aoAbrirPublicacao={(id) => {
          setVendoStory(null);
          acoes.ver(id);
        }}
        aoVotarNoStory={votarNoStory}
        aoReagirAoStory={reagirNoStory}
        aoResponderStory={(a, sid, t, f) => void responderAoStory(a, sid, t, f)}
        aoPerguntarNoStory={perguntarNoStory}
        bolha={vendoStory}
        aoFechar={() => setVendoStory(null)}
        aoVer={marcarVisto}
        souEu={vendoStory.autorId === euId}
        aoQuemViu={quemViu}
        aoApagarStory={apagarStory}
        /* ⚠️ A denúncia é do story DELA — `souEu` já esconde o botão, e o
           servidor recusa o próprio de qualquer forma. */
        aoDenunciarStory={(id, motivo) => void denunciarUmStory(id, motivo)}
      />
    );
  }

  if (onde.t === "novo") {
    return (
      <NovoPost
        /* ⚠️ A original vai ao compositor, e sai de lá ao fechar: sem limpar,
           a próxima publicação nasceria republicando algo sem ninguém pedir. */
        repostando={repostando}
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

  if (onde.t === "conversa" && conversaAberta) {
    return (
      <Conversa
        conversa={conversaAberta}
        rascunho={rascunhoDaConversa}
        aoFixar={(v) => void fixarEstaConversa(conversaAberta.id, v)}
        aoArquivar={(v) => void arquivarEstaConversa(conversaAberta.id, v)}
        aoDenunciarConversa={(m) => void denunciarEstaConversa(conversaAberta.id, m)}
        /* ⚠️ Guarda a mensagem e abre a folha de escolher PARA ONDE: a lista de
           conversas é a mesma de `MandarPublicacao`, e reusá-la evita uma
           segunda régua de "com quem eu posso falar". */
        aoEncaminhar={(mensagemId) =>
          setEncaminhando({ deConversaId: conversaAberta.id, mensagemId })
        }
        /* ⚠️ Só o POST abre. O story vive 24 h e o id dele deixa de resolver —
           levar a paciente a uma tela de "não existe mais" é pior que um cartão
           que só conta o que aconteceu. */
        aoAbrirRef={(tipo, id) => {
          if (tipo === "post") abrirPost(id);
        }}
        aoVoltar={() => {
          setConversaAberta(null);
          setRascunhoDaConversa(null);
          setOnde({ t: "conversas" });
          /* ⚠️ Recarrega o emblema ao SAIR da conversa, não ao entrar: quem
             acabou de ler não pode voltar para a lista com o ponto ainda
             aceso. */
          void contarNaoLidas();
        }}
        aoAbrirPerfil={abrirPerfil}
      />
    );
  }

  if (onde.t === "grupo" && grupoAberto) {
    return (
      <ConversaDoGrupo
        grupo={grupoAberto}
        aoVoltar={() => setOnde({ t: "conversas" })}
        aoConvidar={() => setOnde({ t: "grupo-chamar" })}
      />
    );
  }

  if (onde.t === "grupo-novo") {
    return (
      <CriarGrupo
        /* ⚠️ A MESMA lista de `amigasParaMarcar` — nunca uma busca por nome. */
        candidatas={paraMarcar ?? []}
        aoFechar={() => setOnde({ t: "conversas" })}
        aoCriado={() => setOnde({ t: "conversas" })}
      />
    );
  }

  if (onde.t === "grupo-chamar" && grupoAberto) {
    return (
      <ChamarParaGrupo
        grupo={grupoAberto}
        candidatas={paraMarcar ?? []}
        aoFechar={() => setOnde({ t: "grupo" })}
        aoChamou={() => setOnde({ t: "conversas" })}
      />
    );
  }

  if (onde.t === "conversas") {
    return (
      <CaixaDeEntrada
        /* ⚠️ **A LISTA DE GRUPOS VIVE DENTRO DA CAIXA DE ENTRADA**, e não numa
           aba própria: um grupo é uma conversa, e separá-los faria a paciente
           procurar em dois lugares a mesma pergunta ("quem falou comigo?"). */
        grupos={
          <MeusGrupos
            aoAbrir={(g) => {
              setGrupoAberto(g);
              setOnde({ t: "grupo" });
            }}
            aoCriar={() => setOnde({ t: "grupo-novo" })}
          />
        }
        aoVoltar={() => setOnde({ t: "feed" })}
        aoAbrir={(c) => {
          setConversaAberta(c);
          setOnde({ t: "conversa" });
        }}
        /* ⚠️ **O RASCUNHO CAI NO CAMPO, e o app NUNCA manda sozinho.** Escrever
           para uma estranha é o degrau que faz a maioria desistir, e oferecer a
           primeira linha derruba esse degrau; mandar por ela seria pôr o nome
           dela numa frase que ela não escolheu — a mesma decisão do
           agradecimento do chá de bebê e da transcrição do diário. */
        aoFalarCom={(id, rascunho) => void abrirConversaCom(id, rascunho)}
      />
    );
  }

  if (onde.t === "tag") {
    return (
      <TelaDaTag
        tag={onde.tag}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoAbrirPost={abrirPost}
        acoes={acoes}
      />
    );
  }

  if (onde.t === "busca") {
    return (
      <TelaDeBusca
        aoVoltar={() => setOnde({ t: "feed" })}
        aoBuscar={buscar}
        aoAbrirPerfil={abrirPerfil}
        aoAbrirTag={acoes.abrirTag}
        euId={euId}
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

  if (onde.t === "explorar") {
    return (
      <div className="mx-auto max-w-md pb-24">
        <header className="sticky top-0 z-20 flex items-center gap-1 bg-background/95 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => setOnde({ t: "feed" })}
            aria-label="Voltar"
            className="press -ml-2 flex h-11 w-11 items-center justify-center text-lg leading-none"
          >
            ‹
          </button>
          <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Explorar</h1>
          <button
            type="button"
            onClick={() => setOnde({ t: "busca" })}
            aria-label="Buscar"
            className="press flex h-11 w-11 items-center justify-center text-[16px]"
          >
            🔍
          </button>
        </header>

        {/* ⚠️ **A RÉGUA É DITA, e ela é o recurso.** Sem a frase, a paciente lê o
            Explorar como "o que está bombando" — e este app decidiu não ter isso:
            numa base de alto risco, o post que mais engaja é o da EMERGÊNCIA. */}
        <p className="px-1 pb-3 text-[13px] leading-snug text-muted-foreground">
          Publicações de quem deixou o perfil aberto. Nada aqui é escolhido por número de reações.
        </p>

        {explorar === "erro" ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Não deu para carregar agora.</p>
            <button
              type="button"
              onClick={() => void abrirExplorar()}
              className="press mt-3 min-h-[44px] rounded-full pill-3d px-5 text-[13px] font-semibold"
            >
              Tentar de novo
            </button>
          </div>
        ) : explorar === null ? (
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="dc-esqueleto aspect-[3/4] w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* ⚠️ **AS TAGS VÊM ANTES DA GRADE**, e não depois: elas são o
                caminho para um assunto, e a grade é o acaso. Quem abre o
                Explorar com uma pergunta na cabeça encontra a pergunta
                primeiro. */}
            {explorar.tags.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {explorar.tags.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => acoes.abrirTag(t.tag)}
                    className="press min-h-[44px] shrink-0 rounded-full pill-3d px-3 text-[13px]"
                  >
                    #{t.tag}{" "}
                    {/* ⚠️ O número é o de PUBLICAÇÕES, e ele bate com o que a
                        página da tag entrega — a contagem passa pela mesma
                        régua de visibilidade. */}
                    <span className="tabular-nums text-muted-foreground">{t.quantas}</span>
                  </button>
                ))}
              </div>
            )}

            {explorar.posts.length === 0 ? (
              <p className="px-6 py-16 text-center text-[13px] leading-snug text-muted-foreground">
                Ainda não há nada para descobrir. Só aparece aqui quem deixou o perfil aberto.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {explorar.posts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => acoes.ver(p.id)}
                    className="press relative aspect-[3/4] w-full overflow-hidden bg-muted"
                  >
                    {p.miniaturaUrl || p.imagemUrl ? (
                      <img
                        src={p.miniaturaUrl ?? p.imagemUrl ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      /* ⚠️ Post só de texto existe (`postEhValido`), e sem este
                         ramo ele viraria um quadrado cinza vazio na grade. */
                      <span className="line-clamp-4 block p-2 text-left text-xs leading-snug">
                        {p.texto}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (onde.t === "favoritas") {
    return (
      <div className="mx-auto max-w-md pb-24">
        <header className="sticky top-0 z-20 flex items-center gap-1 bg-background/95 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => setOnde({ t: "feed" })}
            aria-label="Voltar"
            className="press -ml-2 flex h-11 w-11 items-center justify-center text-lg leading-none"
          >
            ‹
          </button>
          <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Favoritas</h1>
        </header>
        {/* ⚠️ A régua é DITA: sem a frase, quem favoritou alguém e não vê nada
            conclui que o recurso quebrou, quando ela só não publicou ainda. E a
            segunda frase é a que impede o mal-entendido de sempre — favoritar
            NÃO avisa ninguém. */}
        <p className="px-1 pb-3 text-[13px] leading-snug text-muted-foreground">
          Só quem você marcou como favorita, na ordem do tempo. Ninguém é avisada.
        </p>
        {favoritas === "erro" ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Não deu para carregar agora.</p>
            <button
              type="button"
              onClick={() => void abrirFavoritas()}
              className="press mt-3 min-h-[44px] rounded-full pill-3d px-5 text-[13px] font-semibold"
            >
              Tentar de novo
            </button>
          </div>
        ) : favoritas === null ? (
          <div className="space-y-3 px-1">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="dc-esqueleto h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : favoritas.length === 0 ? (
          <p className="px-1 py-16 text-center text-sm text-muted-foreground">
            Você ainda não marcou ninguém como favorita. No perfil de alguém, toque em ⋯.
          </p>
        ) : (
          /* ⚠️ **AS AÇÕES SÃO AS MESMAS DO FEED, e vêm do objeto ESTÁVEL.**
             Passar fechos inline aqui faria o `memo` do cartão errar em toda
             pintura — o defeito que já custou 232 ms por reação nesta lista. E
             um cartão sem ações seria uma publicação que ela vê e não pode
             tocar, o que lê como app quebrado. */
          favoritas.map((p) => (
            <PostInstagram
              key={p.id}
              post={p}
              aoReagir={acoes.reagir}
              aoSalvar={acoes.guardar}
              aoAbrirPerfil={acoes.abrirPerfil}
              aoVer={acoes.ver}
              aoAbrirArroba={acoes.abrirArroba}
              aoAbrirTag={acoes.abrirTag}
              aoDenunciar={acoes.denunciar}
              aoVotar={acoes.votar}
              aoMandarParaConversa={acoes.mandarParaConversa}
            />
          ))
        )}
      </div>
    );
  }

  if (onde.t === "escondidos") {
    /* ⚠️ **Sem esta tela o esconder é um beco sem saída.** Ele é CALADO e a
       pessoa some da fileira dela, então desfazer exigiria lembrar de quem foi.
       É o mesmo defeito que o bloqueio teve até ganhar a lista de bloqueados. */
    return (
      <ListaDeBloqueados
        titulo="Story escondido de"
        /* ⚠️ **O TEXTO PADRÃO É O DO BLOQUEIO, e aqui ele MENTE**: quem está
           nesta lista continua vendo o perfil, as publicações e tudo o mais —
           o que ela não vê é o story. Herdar "não vê você na Comunidade" faria
           a paciente achar que escondeu muito mais do que escondeu. */
        explicacao="Quem está aqui não vê os seus stories. O resto continua igual, e ninguém é avisada."
        vazio="Você não escondeu seu story de ninguém."
        rotuloDaAcao="Voltar a mostrar"
        pessoas={escondidos}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoDesbloquear={(id) => void mostrarStoryDeNovo(id)}
        aoTentarDeNovo={() => void abrirEscondidos()}
      />
    );
  }

  if (onde.t === "curtidos") {
    return (
      <GradeSimples
        titulo="O que você reagiu"
        vazio="Você ainda não reagiu a nada."
        posts={curtidos}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoAbrirPost={(id) => void abrirPost(id)}
        aoTentarDeNovo={() => void abrirCurtidos()}
      />
    );
  }

  if (onde.t === "desfechos") {
    return (
      <MeusDesfechos
        desfechos={desfechos}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoTentarDeNovo={() => void abrirDesfechos()}
      />
    );
  }

  if (onde.t === "bloqueados") {
    return (
      <ListaDeBloqueados
        pessoas={bloqueados}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoDesbloquear={(id) => void desbloquear(id)}
        aoTentarDeNovo={() => void abrirBloqueados()}
      />
    );
  }

  if (onde.t === "arquivo-stories") {
    return (
      <ArquivoDeStories
        stories={arquivoStories}
        instavel={arquivoStoriesInstavel}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoDestacar={(id, v, titulo) => void destacarNoPerfil(id, v, titulo)}
        aoChegarNoFim={() => void maisDoArquivoDeStories()}
        temMais={!!proximoArquivo}
        aoTentarDeNovo={() => void abrirArquivoDeStories()}
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
        aoAbrirTag={acoes.abrirTag}
        aoAbrirArroba={acoes.abrirArroba}
        /* ⚠️ **AS TRÊS FALTAVAM AQUI, e esta é a tela que a GRADE abre.** O
           componente aceitava as props e as repassava ao cartão; o único
           chamador não as passava. Quem chega ao post pelo perfil — o caminho
           mais comum depois do feed — não tinha republicar, compartilhar nem
           mandar para uma conversa, e nada na tela explicava a diferença. */
        aoRepublicar={acoes.republicar}
        aoCompartilhar={acoes.compartilhar}
        aoLinkPublico={acoes.linkPublico}
        aoMandarParaConversa={acoes.mandarParaConversa}
        aoReagir={acoes.reagir}
        aoSalvar={acoes.guardar}
        aoVotar={acoes.votar}
        aoApagar={acoes.apagar}
        aoDenunciar={acoes.denunciar}
        aoTirarMarcacao={acoes.tirarMarcacao}
        aoEditar={acoes.editar}
        aoFixar={acoes.fixar}
        aoStoryComPost={acoes.storyComPost}
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
        album={perfil.souEu ? album : null}
        aoChegarNoFim={maisDoPerfil}
        temMais={!!proximoDoPerfil}
        aoMandarMensagem={(id) => void abrirConversaCom(id)}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoSeguir={perfil.souEu ? () => setOnde({ t: "editar" }) : seguir}
        /**
         * ⚠️ **"CONTAS PARECIDAS" AQUI NÃO DERIVA DO PERFIL ABERTO, e essa é a
         * decisão inteira.**
         *
         * O Instagram monta essa fileira a partir de quem a pessoa que você
         * acabou de seguir segue — e isso, aqui, VAZARIA O GRAFO DELA. A lista
         * de seguidores deste app não é pública de propósito: num app de
         * gestação de alto risco, quem acompanha quem é o círculo social da
         * pessoa, e "parecidas com a Ana" é a lista de amigas da Ana com outro
         * nome.
         *
         * O que chega aqui são as sugeridas do MEU feed — as mesmas de
         * `sugestoesDoFeed`, ordenadas por elos COMIGO e nunca por audiência. É
         * menos preciso e é o único que não conta a vida de terceiro.
         */
        parecidas={pessoas.filter((p) => p.id !== perfil.id).slice(0, 6)}
        aoSeguirParecida={(id) => void seguirPessoa(id)}
        aoVerParecida={(id) => void abrirPerfil(id)}
        aoAbrirPost={abrirPost}
        /* ⚠️ **A LISTA ABRE EM QUALQUER PERFIL QUE ELA CONSEGUE VER** — decisão
           do dono: "é pra usar as mesmas coisas que tem no Instagram". Ela era
           oferecida só no próprio perfil. Quem decide de verdade é
           `alcancaOPerfil`, no SERVIDOR: perfil público abre para qualquer uma,
           fechado só para quem já foi aceita. */
        aoAbrirLista={(tipo) => void abrirLista(tipo, perfil.id)}
        aoAbrirSalvos={perfil.souEu ? abrirSalvos : undefined}
        aoAbrirCurtidos={perfil.souEu ? () => void abrirCurtidos() : undefined}
        aoAbrirEscondidos={perfil.souEu ? () => void abrirEscondidos() : undefined}
        /* ⚠️ Só no perfil de TERCEIRO: esconder de si mesma tiraria a fileira
           dela da tela dela, e o servidor recusa de qualquer jeito. */
        aoEsconderStory={perfil.souEu ? undefined : () => void esconderMeuStoryDe(perfil.id)}
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
        aoSilenciar={
          perfil.souEu ? undefined : (v, quais) => void silenciarPerfil(perfil.id, v, quais)
        }
        aoFavoritar={perfil.souEu ? undefined : (v) => void marcarFavorita(perfil.id, v)}
        aoRestringir={perfil.souEu ? undefined : (v) => void restringirPerfil(perfil.id, v)}
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
      {/* ⚠️ **SÓ SOBRE O FEED, e não sobre a aba inteira.** Esta linha está
          DEPOIS de todos os `if (onde.t === …) return`, então o tutorial nunca
          abre por cima do perfil, do direct ou da caixinha — telas para as
          quais a paciente NAVEGOU, e onde quatro cartões de boas-vindas seriam
          uma interrupção do que ela foi fazer. */}
      {!adiarOnboarding && (
        <OnboardingDaComunidade careMode={careMode} bancada={bancadaOnboarding} />
      )}
      <input
        ref={arquivoDoStory}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const { toast } = await import("sonner");
          if (f.type.startsWith("video/")) {
            /* ⚠️ **A CAPA VEM ANTES DA RECUSA**, e é dela que sai a duração: o
               `size` e o `type` dão para conferir na hora, mas quantos segundos
               o arquivo tem só o decodificador sabe. */
            const capa = await capaDoVideo(f);
            if (!capa) {
              toast.error("Não deu para ler esse vídeo.");
              return;
            }
            const { recusaDoVideo, recadoDaRecusa } = await import("@/lib/video-do-post");
            const recusa = recusaDoVideo({
              tipo: f.type,
              bytes: f.size,
              segundos: capa.segundos,
            });
            if (recusa) {
              toast.error(recadoDaRecusa(recusa));
              return;
            }
            const t = await token();
            if (!t) return;
            const { urlParaSubirVideo } = await import("@/lib/rede-social.functions");
            const r = await urlParaSubirVideo({ data: { accessToken: t, tipo: f.type } });
            if (!r.ok) {
              toast.error("Não deu para enviar o vídeo agora.");
              return;
            }
            const { supabase } = await import("@/integrations/supabase/client");
            /* ⚠️ **VAI DIRETO PARA O STORAGE**, com o token assinado — o mesmo
               caminho do vídeo do post. Passar 50 MB pelo servidor seria a
               função inteira estourando o limite de corpo. */
            const up = await supabase.storage.from("rede").uploadToSignedUrl(r.caminho, r.token, f);
            if (up.error) {
              toast.error("Não deu para enviar o vídeo agora.");
              return;
            }
            setVideoDoStory({ caminho: r.caminho, segundos: capa.segundos });
            setConferindoStory(capa.capa);
            return;
          }
          /* ⚠️ `prepararFotoDoStory`, e não `prepararAvatar`: aquele corta um
             QUADRADO de 512px no centro, e o story é 9:16 exibido inteiro. */
          const d = await prepararFotoDoStory(f);
          if (d) setConferindoStory(d);
        }}
      />
      {maisAberto && (
        <MaisDaComunidade
          onFechar={() => setMaisAberto(false)}
          grupos={
            [
              {
                id: "minhas",
                titulo: "Minhas coisas",
                itens: [
                  {
                    id: "salvos",
                    rotulo: "Salvos",
                    descricao: "As publicações que você guardou",
                    icone: "salvos",
                    aoTocar: () => void abrirSalvos(),
                  },
                  {
                    id: "arquivados",
                    rotulo: "Arquivados",
                    descricao: "Publicações que você tirou do ar",
                    icone: "arquivados",
                    aoTocar: () => void abrirArquivados(),
                  },
                  {
                    /* ⚠️ **Com nome que o separa de "Arquivados"**: os dois
                       guardam o que saiu do ar; "Meus stories" diz o formato,
                       que é a única coisa que os distingue. */
                    id: "arquivo-stories",
                    rotulo: "Meus stories",
                    descricao: "Tudo o que você já publicou por 24 horas",
                    icone: "stories",
                    aoTocar: () => void abrirArquivoDeStories(),
                  },
                  {
                    /* ⚠️ **"VER PRIMEIRO" É UMA LISTA À PARTE, e não uma
                       reordenação do feed** — a razão está em `favoritar`. */
                    id: "favoritas",
                    rotulo: "Favoritas",
                    descricao: "O que as pessoas que você marcou publicaram",
                    icone: "favoritas",
                    aoTocar: () => void abrirFavoritas(),
                  },
                ],
              },
              {
                id: "descobrir",
                titulo: "Descobrir",
                itens: [
                  {
                    id: "explorar",
                    rotulo: "Explorar",
                    descricao: "Publicações públicas e assuntos em alta",
                    icone: "explorar",
                    aoTocar: () => void abrirExplorar(),
                  },
                  {
                    id: "buscar",
                    rotulo: "Buscar",
                    descricao: "Pessoas com perfil público e #assuntos",
                    icone: "buscar",
                    aoTocar: () => setOnde({ t: "busca" }),
                  },
                ],
              },
              {
                id: "seguranca",
                titulo: "Segurança",
                itens: [
                  {
                    /* ⚠️ **SEM ESTA PORTA, BLOQUEAR ERA UM BECO SEM SAÍDA**: a
                       única entrada era o ⋯ do perfil, e o bloqueio esconde o
                       perfil. */
                    id: "bloqueados",
                    rotulo: "Bloqueados",
                    descricao: "Quem você bloqueou, e desbloquear",
                    icone: "bloqueados",
                    aoTocar: () => void abrirBloqueados(),
                  },
                  {
                    /* ⚠️ Denúncia sem retorno é a que ninguém faz duas vezes. */
                    id: "desfechos",
                    rotulo: "Suas denúncias",
                    descricao: "O que aconteceu com cada uma",
                    icone: "denuncias",
                    aoTocar: () => void abrirDesfechos(),
                  },
                  {
                    id: "caixinha",
                    rotulo: "Caixinha",
                    descricao: "Perguntas anônimas que você recebeu",
                    icone: "caixinha",
                    /* ⚠️ Conta as SEM RESPOSTA, e não o total — mesma régua do
                       contador da fita do painel. */
                    emblema: naCaixa,
                    aoTocar: () => setOnde({ t: "caixinha" }),
                  },
                ],
              },
            ] satisfies GrupoDoMais[]
          }
        />
      )}
      <TelaPrincipal
        posts={posts}
        aoAbrirSecoes={onAbrirSecoes}
        soSeguindo={soSeguindo}
        aoRepublicar={acoes.republicar}
        aoCompartilhar={acoes.compartilhar}
        aoLinkPublico={acoes.linkPublico}
        stories={fileira}
        aoReagir={acoes.reagir}
        aoSalvar={acoes.guardar}
        aoApagar={acoes.apagar}
        aoDenunciar={acoes.denunciar}
        aoVotar={acoes.votar}
        aoTirarMarcacao={acoes.tirarMarcacao}
        aoVerQuemReagiu={acoes.verQuemReagiu}
        aoAbrirPerfil={acoes.abrirPerfil}
        aoAbrirArroba={acoes.abrirArroba}
        aoAbrirTag={acoes.abrirTag}
        aoMandarParaConversa={acoes.mandarParaConversa}
        /* ⚠️ **SEM ESTAS DUAS, A TELA DO "NÃO CARREGOU" NUNCA APARECERIA** — e
           eu teria trocado um vazio silencioso por outro. É a mesma falta que a
           auditoria achou em `aoEditar` e nas três ações da tela do post. */
        instavel={feedInstavel}
        aoTentarDeNovo={() => void carregarFeed()}
        pausada={pausada}
        suspensa={suspensa}
        aoReativar={() => void reativarMinhaConta()}
        /* ⚠️ **O LÁPIS NUNCA CHEGAVA AO FEED.** `TelaPrincipal` declarava a
           prop e a repassava aos cartões; o único chamador não a passava. E
           `meuFeed` põe os posts DELA primeiro, com comentário explícito de que
           o teto nunca pode cortar o que ela publicou — então o post editável
           está ali, com o lápis invisível. O ⋯ do post próprio só oferece
           "tirar do ar", que é a decisão oposta. */
        aoEditar={acoes.editar}
        aoFixar={acoes.fixar}
        aoStoryComPost={acoes.storyComPost}
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
        aoTocarStory={acoes.tocarStory}
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
        memoria={memoria}
        aoVerMemoria={(postId) => {
          void (async () => {
            const t = await token();
            if (!t) return;
            const { marcarMemoriaVista } = await import("@/lib/rede-social.functions");
            await marcarMemoriaVista({ data: { accessToken: t, postId } });
          })();
        }}
        aoFecharRetro={() => {
          setRetro(null);
          try {
            if (euId) localStorage.setItem(chaveDaRetrospectiva(euId, new Date()), "1");
          } catch {
            /* sem armazenamento: ele volta na próxima abertura, e tudo bem */
          }
        }}
      />
      {/* ⚠️ **A FOLHA VIVE FORA da `<TelaPrincipal>`, como as irmãs.** Ela é
          `fixed inset-0`; dentro da lista, um `overflow` de qualquer ancestral
          a recortaria — e ela apareceria pela metade, sem erro nenhum. */}
      {mandandoPost && (
        <MandarPublicacao
          alvo={{ tipo: "post", id: mandandoPost }}
          aoFechar={() => setMandandoPost(null)}
        />
      )}
      {/* ⚠️ A MESMA folha do post — duas divergiriam no primeiro ajuste, e a
          régua que importa (só conversas que JÁ existem) precisaria ser escrita
          duas vezes. */}
      {/* ⚠️ A MESMA folha do mandar publicação/story — a lista de para-quem é a
          mesma, e é ela que carrega a trava de só oferecer conversas que já
          existem. */}
      {encaminhando && (
        <MandarPublicacao
          alvo={{
            tipo: "mensagem",
            id: encaminhando.mensagemId,
            deConversaId: encaminhando.deConversaId,
          }}
          aoFechar={() => setEncaminhando(null)}
        />
      )}

      {mandandoStory && (
        <MandarPublicacao
          alvo={{ tipo: "story", id: mandandoStory }}
          aoFechar={() => setMandandoStory(null)}
        />
      )}

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
    return codificarFoto(canvas, 0.82);
  } catch {
    return null;
  }
}

/**
 * OS FILHOS, NA TELA DE EDITAR O PERFIL.
 *
 * ⚠️ **É AQUI QUE A ABA DEIXA DE MORRER NO PARTO.** Enquanto a identidade saía
 * de `lmp_date`, a conta perdia o assunto no dia do nascimento. Com a lista de
 * filhos, ela deixa de ser "grávida de 28 semanas" e passa a ser "mãe da
 * Helena, de 3 meses" — que continua verdade por anos.
 *
 * ⚠️ **A LINHA É MOSTRADA ENQUANTO ELA DIGITA**, e não só depois de salvar. É a
 * única forma de ela entender que a lista de filhos VIRA a frase do perfil: sem
 * o espelho, "cadastrar filho" parece burocracia sem efeito visível.
 */
/**
 * A data de hoje em São Paulo, como `YYYY-MM-DD`.
 *
 * ⚠️ **NÃO É `new Date().toISOString()`.** Aquele devolve UTC, e das 21h à
 * meia-noite ele já está no dia seguinte — a idade do bebê apareceria um dia a
 * mais para quem abre o app à noite, que é justamente quando as mães abrem.
 */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function MeusFilhos({ hoje, bancada }: { hoje: string; bancada?: Filho[] }) {
  const [filhos, setFilhos] = useState<Filho[] | null>(bancada ?? null);
  const [erro, setErro] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function token() {
    const { supabase } = await import("@/integrations/supabase/client");
    const s = await supabase.auth.getSession();
    return s.data.session?.access_token ?? null;
  }

  const recarregar = useCallback(async () => {
    /* ⚠️ A BANCADA NÃO FALA COM O SERVIDOR. Sem sessão, `meusFilhos` devolve
       "sessao" e a tela mostraria só o erro — que é exatamente o estado que ela
       NÃO precisa provar. O dado é fabricado; o desenho é o de produção. */
    if (bancada) return;
    try {
      const t = await token();
      if (!t) return;
      const { meusFilhos } = await import("@/lib/filhos.functions");
      const r = await meusFilhos({ data: { accessToken: t } });
      /* ⚠️ `null` e `[]` são coisas DIFERENTES, e a tela precisa distinguir:
         lista vazia é "ela não cadastrou ninguém" e mostra o convite; falha de
         leitura é "não sei" e não pode desenhar uma mãe de três como se ela não
         tivesse filhos. */
      if (r.ok) {
        setFilhos(r.filhos);
        setErro(false);
      } else {
        setErro(true);
      }
    } catch {
      setErro(true);
    }
  }, [bancada]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function mexer(fn: () => Promise<unknown>) {
    if (bancada || ocupado) return;
    setOcupado(true);
    try {
      await fn();
      await recarregar();
    } finally {
      setOcupado(false);
    }
  }

  async function acrescentar(comoGestacao: boolean) {
    await mexer(async () => {
      const t = await token();
      if (!t) return;
      const { salvarFilho } = await import("@/lib/filhos.functions");
      await salvarFilho({
        data: {
          accessToken: t,
          /* ⚠️ Nasce SEM data e sem nome. Pedir tudo de uma vez num formulário
             modal é o que faz a paciente desistir no primeiro campo; ela
             preenche o que quiser, na linha, depois. */
          ...(comoGestacao ? {} : { nascidoEm: hoje }),
        },
      });
    });
  }

  async function mudar(id: string, campos: Record<string, unknown>) {
    await mexer(async () => {
      const t = await token();
      if (!t) return;
      const { salvarFilho } = await import("@/lib/filhos.functions");
      await salvarFilho({ data: { accessToken: t, id, ...campos } as never });
    });
  }

  async function remover(id: string) {
    await mexer(async () => {
      const t = await token();
      if (!t) return;
      const { removerFilho } = await import("@/lib/filhos.functions");
      await removerFilho({ data: { accessToken: t, id } });
    });
  }

  const linha = filhos ? linhaDoPerfil(filhos, hoje) : null;

  return (
    <section className="mt-6 border-t border-border pt-5">
      <h2 className="text-[15px] font-semibold">Meus filhos</h2>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        É daqui que sai a frase do seu perfil. Nome e sexo são opcionais.
      </p>

      {/* ⚠️ O ESPELHO DA FRASE. Sem ele, cadastrar filho parece burocracia sem
          efeito — e é justamente o efeito que faz valer a pena preencher. */}
      {linha && (
        <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-[13px] font-medium">{linha}</p>
      )}

      {erro && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Não consegui carregar agora. Tente de novo daqui a pouco.
        </p>
      )}

      {filhos?.map((f) => (
        <div key={f.id} className="mt-3 rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <input
              value={f.nome ?? ""}
              onChange={(e) =>
                setFilhos(
                  (l) => l?.map((x) => (x.id === f.id ? { ...x, nome: e.target.value } : x)) ?? l,
                )
              }
              onBlur={(e) => void mudar(f.id, { nome: e.target.value.slice(0, 40) || null })}
              placeholder="Nome (opcional)"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              aria-label="Remover"
              disabled={ocupado}
              onClick={() => void remover(f.id)}
              className="press shrink-0 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground"
            >
              Remover
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* ⚠️ TRÊS estados, e "não sei" é um deles — não um vazio sem nome.
                O sexo só existe aqui para a concordância ("gêmeas"), e obrigar
                a escolher faria a tela pedir um dado que muita gente não tem. */}
            {(["f", "m", null] as const).map((s) => (
              <button
                key={String(s)}
                type="button"
                disabled={ocupado}
                onClick={() => void mudar(f.id, { sexo: s })}
                className={`press rounded-full px-3 py-1 text-xs ${
                  f.sexo === s ? "btn-3d bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {s === "f" ? "Menina" : s === "m" ? "Menino" : "Não sei"}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-muted-foreground">
              {f.nascidoEm ? "Nasceu em" : "Previsto para"}
            </label>
            <input
              type="date"
              value={(f.nascidoEm ?? f.previstoPara ?? "").slice(0, 10)}
              onChange={(e) =>
                void mudar(
                  f.id,
                  f.nascidoEm ? { nascidoEm: e.target.value } : { previstoPara: e.target.value },
                )
              }
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
            />
          </div>

          {/* ⚠️ O NASCIMENTO É UM BOTÃO, e é o momento que o app inteiro
              esperava. Ele troca `previsto_para` por `nascido_em` — e é essa
              troca que muda a frase do perfil de "grávida" para "mãe". */}
          {!f.nascidoEm && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void mudar(f.id, { nascidoEm: hoje, previstoPara: null })}
              className="press mt-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Já nasceu 💛
            </button>
          )}
        </div>
      ))}

      {(filhos?.length ?? 0) < MAXIMO_DE_FILHOS && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void acrescentar(true)}
            className="press rounded-full pill-3d px-3 py-1.5 text-[13px]"
          >
            + Estou esperando
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void acrescentar(false)}
            className="press rounded-full pill-3d px-3 py-1.5 text-[13px]"
          >
            + Já nasceu
          </button>
        </div>
      )}
    </section>
  );
}

export function EditarPerfil({
  perfil,
  aoSalvar,
  aoFechar,
  filhosDeMentira,
}: {
  perfil: PerfilNaTela;
  /** Só a bancada preenche. Ver `MeusFilhos`. */
  filhosDeMentira?: Filho[];
  aoSalvar: (m: {
    nome?: string;
    bio?: string | null;
    bioLink?: string | null;
    avatar?: string | null;
  }) => Promise<boolean>;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [bio, setBio] = useState(perfil.bio ?? "");
  const [bioLink, setBioLink] = useState(perfil.bioLink ?? "");
  const [avatar, setAvatar] = useState<string | null>(perfil.avatarUrl);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    const ok = await aoSalvar({
      nome: nome.trim() || undefined,
      bio: bio.trim() || null,
      /* ⚠️ Vazio vira `null`, e não `""`: a coluna é anulável, e um string
         vazio faria o perfil desenhar um link para lugar nenhum. */
      bioLink: bioLink.trim() || null,
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
          <span className="text-xs text-muted-foreground">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value.slice(0, 60))}
            className="mt-1 w-full border-b border-border bg-transparent pb-1.5 text-[15px] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, LIMITE_DA_BIO))}
            rows={2}
            className="mt-1 w-full resize-none border-b border-border bg-transparent pb-1.5 text-[15px] outline-none"
          />
          <span className="mt-0.5 block text-right text-xs tabular-nums text-muted-foreground">
            {bio.length}/{LIMITE_DA_BIO}
          </span>
        </label>

        {/* ⚠️ **CAMPO PRÓPRIO, e não um link solto DENTRO da bio.** Varrer a bio
            atrás de `http` transformaria qualquer texto com endereço num link —
            inclusive o que ela escreveu sem querer que fosse clicável.

            ⚠️ E a tela NÃO valida nada: quem limpa é `limparLinkDaBio`, no
            servidor. Uma régua aqui recusaria o que o servidor aceita (ou o
            contrário), e o `href` é o único lugar do app onde texto de uma
            paciente vira comportamento na tela de outra. */}
        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted-foreground">Link</span>
          <input
            value={bioLink}
            onChange={(e) => setBioLink(e.target.value.slice(0, LINK_DA_BIO_MAX))}
            inputMode="url"
            placeholder="instagram.com/seu-perfil"
            className="mt-1 w-full border-b border-border bg-transparent pb-1.5 text-[15px] outline-none"
          />
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
            Aparece no seu perfil, embaixo da descrição. Pode deixar em branco.
          </span>
        </label>

        {/* ⚠️ OS FILHOS FICAM ABAIXO DA BIO, e a ordem importa: a bio é o que
            ela escreve, os filhos são o que o app DERIVA. Invertido, a tela
            pediria o dado estruturado antes de ela ter entendido que existe uma
            frase automática — e o espelho da frase é o que faz preencher valer
            a pena. */}
        <MeusFilhos hoje={hojeEmSaoPaulo()} bancada={filhosDeMentira} />
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
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
                      <span className="block truncate text-xs leading-tight text-muted-foreground">
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
                  className="absolute -bottom-0.5 -right-1 grid h-[20px] w-[20px] place-items-center rounded-full bg-card text-xs leading-none ring-1 ring-border/70"
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
                  <span className="block text-xs font-semibold leading-tight text-primary">
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

/**
 * O TEXTO COM `@` E `#` VIRANDO LINK.
 *
 * ⚠️ **NÃO USA `dangerouslySetInnerHTML`.** A legenda é texto de terceiro — a
 * única forma segura de destacar pedaços dela é quebrar em nós de React, nunca
 * montar HTML a partir do que a paciente escreveu.
 *
 * ⚠️ **E O `@` VIRA LINK MESMO SEM SABER SE O PERFIL EXISTE.** Conferir cada
 * menção contra o banco custaria uma consulta por publicação do feed; quem
 * descobre que não existe é a tela de destino, que já sabe dizer "perfil
 * indisponível". O pior caso é um toque que não leva a lugar nenhum — contra
 * uma legenda que carrega o feed inteiro.
 */
/**
 * ⚠️ **EXPORTADA para o COMENTÁRIO, e não copiada.** O `@` já virava link na
 * legenda do post e continuava texto cru embaixo dela — no lugar onde a menção
 * é mais usada. Uma segunda implementação divergiria da primeira, e a
 * divergência apareceria como o mesmo `@` sendo link num lugar e não no outro.
 */
export function TextoComLinks({
  texto,
  aoAbrirArroba,
  aoAbrirTag,
}: {
  texto: string;
  /**
   * ⚠️ **RECEBE O `@`, NUNCA UM id — e por isso é prop PRÓPRIA.** A primeira
   * versão reaproveitava `aoAbrirPerfil`, que espera um uuid: o toque numa
   * menção pediria ao servidor o perfil de id "marina" e a tela responderia
   * "indisponível", que é o pior desfecho possível — a menção existe, a pessoa
   * existe, e o app diz que não. Quem traduz `@` em id é `perfilPorHandle`.
   */
  aoAbrirArroba?: (handle: string) => void;
  aoAbrirTag?: (tag: string) => void;
}) {
  const pedacos = texto.split(/(@[a-z0-9._]{1,30}|#[\p{L}\p{N}_]{1,60})/giu);
  return (
    <span className="whitespace-pre-wrap">
      {pedacos.map((p, i) => {
        if (/^@/.test(p) && aoAbrirArroba) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => aoAbrirArroba(p.slice(1).toLowerCase())}
              className="press font-semibold text-primary"
            >
              {p}
            </button>
          );
        }
        if (/^#/.test(p) && aoAbrirTag) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => aoAbrirTag(p.slice(1).toLowerCase())}
              className="press font-semibold text-primary"
            >
              {p}
            </button>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

export function TelaDoPost({
  post,
  aoReagir,
  aoSalvar,
  aoRepublicar,
  aoCompartilhar,
  aoAbrirTag,
  aoMandarParaConversa,
  aoAbrirArroba,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoTirarMarcacao,
  aoEditar,
  aoFixar,
  aoStoryComPost,
  aoVerQuemReagiu,
  aoVoltar,
  aoAbrirPerfil,
}: {
  post: PostNaTela;
  /* As ações carregam o POST — ver a nota de desempenho em `PostInstagram`. */
  aoReagir: (post: PostNaTela, t: TipoDeReacao | null) => void;
  aoSalvar?: (post: PostNaTela, salvar: boolean) => void;
  /** Republicar. Só chega onde cabe — ver o comentário do botão. */
  aoRepublicar?: (post: PostNaTela) => void;
  /** Compartilhar para fora. Só a própria — ver `compartilhar-post.ts`. */
  aoCompartilhar?: (post: PostNaTela) => void;
  /** O link público desta publicação — ver `PostInstagram`. */
  aoLinkPublico?: (post: PostNaTela) => void;
  /** Abrir a página de uma `#`. */
  aoAbrirTag?: (tag: string) => void;
  /** Abre a folha de mandar esta publicação para uma conversa. */
  aoMandarParaConversa?: (post: PostNaTela) => void;
  /** Abrir o perfil por trás de um `@`. Ver `TextoComLinks`. */
  aoAbrirArroba?: (handle: string) => void;
  aoApagar?: (post: PostNaTela) => void;
  /** Denunciar o post de outra pessoa. Ver `PostInstagram`. */
  aoDenunciar?: (post: PostNaTela, motivo: MotivoDaDenuncia) => void;
  aoVotar?: (post: PostNaTela, opcao: number) => void;
  /** Tirar a PRÓPRIA marcação — ver `PostInstagram`. */
  aoTirarMarcacao?: (post: PostNaTela) => void;
  /** Salvar a legenda editada — ver `PostInstagram`. */
  aoEditar?: (post: PostNaTela, texto: string) => Promise<boolean>;
  aoFixar?: (post: PostNaTela, fixar: boolean) => void;
  aoStoryComPost?: (post: PostNaTela) => void;
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Publicação</h1>
      </header>
      <PostInstagram
        post={post}
        aoReagir={aoReagir}
        aoSalvar={aoSalvar}
        aoRepublicar={aoRepublicar}
        aoCompartilhar={aoCompartilhar}
        aoAbrirTag={aoAbrirTag}
        aoMandarParaConversa={aoMandarParaConversa}
        aoAbrirArroba={aoAbrirArroba}
        aoApagar={aoApagar}
        aoDenunciar={aoDenunciar}
        aoVotar={aoVotar}
        aoTirarMarcacao={aoTirarMarcacao}
        aoEditar={aoEditar}
        aoFixar={aoFixar}
        aoStoryComPost={aoStoryComPost}
        aoVerQuemReagiu={aoVerQuemReagiu}
        aoAbrirPerfil={aoAbrirPerfil}
      />
      {/* ⚠️ **OS COMENTÁRIOS SÓ EXISTEM NA TELA DO POST, nunca no feed.**
          No feed eles custariam uma consulta por publicação a cada rolagem, e
          transformariam a leitura num mural de opinião — que é exatamente o que
          o número dos 20,9% recomenda evitar. Quem quer comentar abre o post,
          e esse toque a mais é uma trava barata contra o comentário impulsivo. */}
      <Comentarios postId={post.id} aoAbrirPerfil={aoAbrirPerfil} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O VISOR DE STORY — tela cheia
   ══════════════════════════════════════════════════════════════════════════ */

/** Quanto cada story fica na tela antes de passar sozinho. */
const DURACAO_DO_STORY = 5000;

/**
 * O ARQUIVO DE STORIES — tudo o que ela já publicou.
 *
 * ⚠️ **Grade quadrada, e não a 3:4 do perfil.** A grade do perfil imita o
 * Instagram porque ali as células são recortes de FOTOS DE POST; aqui cada
 * célula é um story inteiro (9:16), e um recorte 3:4 sobre uma imagem vertical
 * come a metade de cima — que num story de gestação é justamente onde fica o
 * texto que ela escreveu.
 */
export function ArquivoDeStories({
  stories,
  instavel,
  aoVoltar,
  aoDestacar,
  aoChegarNoFim,
  temMais = false,
  aoTentarDeNovo,
}: {
  /** `null` = ainda carregando. `[]` = ela não publicou nenhum. */
  stories: StoryArquivado[] | null;
  instavel?: boolean;
  aoVoltar: () => void;
  aoDestacar?: (storyId: string, destacar: boolean, titulo?: string | null) => void;
  aoChegarNoFim?: () => void;
  temMais?: boolean;
  aoTentarDeNovo?: () => void;
}) {
  /** O story que está ganhando nome. `null` = a folha está fechada. */
  const [nomeando, setNomeando] = useState<{ id: string; titulo: string } | null>(null);
  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-1 bg-background/95 py-2 backdrop-blur">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-lg leading-none"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Meus stories</h1>
      </header>

      {/* ⚠️ A explicação vem ANTES da grade, e diz as duas coisas que a paciente
          não tem como adivinhar: que o app guardou tudo, e que ninguém mais vê
          isto. Sem a segunda, ela olha a lista achando que aquilo continua no
          ar. */}
      <p className="px-1 pb-3 text-[13px] leading-snug text-muted-foreground">
        Tudo o que você publicou fica guardado aqui — só para você. Toque na estrela para deixar um
        no seu perfil.
      </p>

      {instavel ? (
        /* ⚠️ **"Não carregou" NUNCA tem a cara de "não há nada".** "Você ainda
           não publicou stories" é a frase mais errada que esta tela pode dizer a
           quem publicou trinta. */
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Não deu para carregar seus stories agora.</p>
          {aoTentarDeNovo && (
            <button
              type="button"
              onClick={aoTentarDeNovo}
              className="press mt-3 min-h-[44px] rounded-full pill-3d px-5 text-[13px] font-semibold"
            >
              Tentar de novo
            </button>
          )}
        </div>
      ) : stories === null ? (
        <div className="grid grid-cols-3 gap-0.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="dc-esqueleto aspect-square w-full" />
          ))}
        </div>
      ) : stories.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Você ainda não publicou nenhum story.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-0.5">
            {stories.map((st) => (
              <div key={st.id} className="relative aspect-square overflow-hidden bg-muted/60">
                {st.imagemUrl ? (
                  <img
                    src={st.imagemUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="line-clamp-4 block p-2 text-left text-xs leading-snug text-foreground/70">
                    {st.texto}
                  </span>
                )}

                {/* ⚠️ **"No ar" é a informação que muda o que ela faz.** Um story
                    ainda dentro das 24 h pode ser apagado do visor; um que já
                    saiu, não. Sem a pílula, as duas células são idênticas. */}
                {st.noAr && (
                  <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-xs font-semibold text-white">
                    no ar
                  </span>
                )}

                {/* ⚠️ **O NOME DO DESTAQUE, e ele é o recurso.** Sem ele o
                    perfil mostra uma grade de imagens: "Ultrassons" e "Chá de
                    bebê" são o que faz alguém tocar. */}
                {st.destacado && st.destaqueTitulo && (
                  <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-full bg-black/55 px-1.5 py-0.5 text-center text-xs font-semibold text-white">
                    {st.destaqueTitulo}
                  </span>
                )}

                {aoDestacar && (
                  <button
                    type="button"
                    onClick={() => {
                      /* ⚠️ **O NOME É PEDIDO NO ATO DE DESTACAR, e nunca depois.**
                         Um segundo passo ("agora dê um nome") é um passo que a
                         maioria pula — e aí o destaque volta a ser uma grade de
                         imagens. Nomear continua OPCIONAL: um destaque sem nome
                         é melhor que nenhum.

                         ⚠️ E é uma folha da PRÓPRIA tela, nunca `window.prompt`:
                         no app instalado o diálogo do sistema abre com o nome do
                         domínio em cima, que é a cara de "site embrulhado" que a
                         diretriz 4.2 da Apple reprova. */
                      if (st.destacado) {
                        aoDestacar(st.id, false, null);
                        return;
                      }
                      setNomeando({ id: st.id, titulo: st.texto ?? "" });
                    }}
                    aria-label={st.destacado ? "Tirar do destaque" : "Deixar no perfil"}
                    aria-pressed={st.destacado}
                    /* ⚠️ 44px de alvo com o desenho pequeno: a célula tem ~130px
                       e um botão de 44 visível cobriria a foto. O `after`
                       estende a área do dedo sem mover o desenho — a mesma
                       solução do × da linha de comentário. */
                    className="press absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white after:absolute after:-inset-2.5 after:content-['']"
                  >
                    <IconeEstrela cheia={st.destacado} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {aoChegarNoFim && temMais && (
            <SentinelaDaGrade aoChegar={aoChegarNoFim} quantos={stories.length} />
          )}
        </>
      )}

      {nomeando && aoDestacar && (
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1rem+var(--safe-area-inset-bottom,0px))]">
          <p className="text-[14px] font-semibold">Nome do destaque</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            É o que aparece no seu perfil — "Ultrassons", "Chá de bebê". Pode deixar em branco.
          </p>
          <input
            value={nomeando.titulo}
            onChange={(e) => setNomeando({ ...nomeando, titulo: e.target.value.slice(0, 24) })}
            maxLength={24}
            placeholder="Ultrassons"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-[14px]"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNomeando(null)}
              className="press min-h-[44px] text-[13px] text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                aoDestacar(nomeando.id, true, nomeando.titulo.trim() || null);
                setNomeando(null);
              }}
              className="press min-h-[44px] rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
            >
              Deixar no perfil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A estrela do destaque.
 *
 * ⚠️ Desenhada, e não ⭐: o emoji tem cor própria em cada sistema e não tem dois
 * estados — e aqui ele precisa distinguir "está no perfil" de "pôr no perfil".
 * Mesma lição do pino e do 📞 da emergência.
 */
function IconeEstrela({ cheia }: { cheia: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[13px] w-[13px]"
      fill={cheia ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}

export function VisorDeStory({
  bolha,
  aoFechar,
  aoVer,
  souEu = false,
  aoQuemViu,
  aoApagarStory,
  aoDenunciarStory,
  aoVotarNoStory,
  aoPerguntarNoStory,
  aoReagirAoStory,
  aoResponderStory,
  aoAbrirPublicacao,
  aoMandarStory,
}: {
  bolha: BolhaDeStory;
  aoFechar: () => void;
  aoVer?: (storyId: string) => void;
  /** É o meu story? Só então aparecem "visto por" e a lixeira. */
  souEu?: boolean;
  /** `null` = não deu para ler (nunca "ninguém viu") — ver `quemViu`. */
  aoQuemViu?: (storyId: string) => Promise<PessoaNaLista[] | null>;
  /** Abrir a publicação compartilhada dentro do story. */
  aoAbrirPublicacao?: (postId: string) => void;
  /** Mandar este story para uma conversa. */
  aoMandarStory?: (storyId: string) => void;
  aoApagarStory?: (storyId: string) => void;
  /** `undefined` = é o story dela, ou a tela de fora não liga a denúncia. */
  aoDenunciarStory?: (storyId: string, motivo: MotivoDaDenuncia) => void;
  /** Votar na enquete deste story. */
  aoVotarNoStory?: (storyId: string, opcao: number) => void;
  /** Mandar uma pergunta pela caixinha aberta neste story. */
  aoPerguntarNoStory?: (donaId: string, texto: string, storyId: string) => Promise<string | null>;
  /** Reagir a este story. `null` tira a reação. */
  aoReagirAoStory?: (storyId: string, tipo: TipoDeReacao | null) => void;
  /**
   * Manda a resposta como mensagem direta, com o story anexado.
   *
   * ⚠️ A FOTO é opcional e vai pelo MESMO caminho da foto da conversa — nunca
   * um segundo jeito de subir, que divergiria na regra da pasta.
   */
  aoResponderStory?: (autorId: string, storyId: string, texto: string, foto?: File | null) => void;
}) {
  const [i, setI] = useState(0);
  const [resposta, setResposta] = useState("");
  /**
   * A foto que ela anexou à resposta, ainda não enviada.
   *
   * ⚠️ **Anexar PARA o story** (ver o efeito do relógio). Sem isso o story
   * avança enquanto ela olha a prévia, e a foto sairia grudada num story que ela
   * já não está vendo — o anexo apontaria para outra coisa. É o mesmo motivo
   * pelo qual a enquete e a folha de "visto por" param o relógio.
   */
  const [fotoDaResposta, setFotoDaResposta] = useState<File | null>(null);
  const escolherFoto = useRef<HTMLInputElement>(null);
  /** Por story: já respondi este? A bolha tem vários. */
  const [respondido, setRespondido] = useState<Record<string, boolean>>({});
  /* O voto que ela acabou de dar, para a tela responder na hora sem esperar a
     rede — a mesma decisão otimista da reação. */
  const [voteiAgora, setVoteiAgora] = useState<Record<string, number>>({});
  /**
   * O véu do aviso de conteúdo — POR STORY, e morre ao trocar de story.
   *
   * ⚠️ **Revelar um não revela os outros.** Ela marcou aquele; o seguinte pode
   * ser outra coisa, e uma decisão que vaza para o story de baixo desfaz o
   * aviso pela lateral. Mesma régua do filtro de palavras nos comentários.
   */
  const [reveladoStory, setReveladoStory] = useState<string | null>(null);
  /**
   * Quanto dura o vídeo deste story, em ms — lido do próprio arquivo.
   *
   * ⚠️ **`null` até o metadado chegar**, e aí vale o padrão de cinco segundos:
   * cravar a duração antes de saber cortaria o vídeo, e esperar por ela
   * deixaria o story parado se o arquivo nunca carregasse.
   */
  const [duracaoDoVideo, setDuracaoDoVideo] = useState<number | null>(null);

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
  const [denunciando, setDenunciando] = useState(false);
  /* ⚠️ Trocou de story: a duração do vídeo anterior não vale mais, e o véu
     revelado também não — ela marcou AQUELE, e o de baixo pode ser outra
     coisa. */
  useEffect(() => {
    setDuracaoDoVideo(null);
    /* ⚠️ E a foto anexada some junto: ela a escolheu para AQUELE story. Mantê-la
       faria o anexo seguir para o próximo, e o `refId` da mensagem apontaria
       para uma coisa que ela nunca quis responder. */
    setFotoDaResposta(null);
  }, [i]);

  /**
   * O endereço local da prévia.
   *
   * ⚠️ **`URL.createObjectURL` PRECISA de `revokeObjectURL`**: sem isso cada
   * foto trocada deixa o arquivo inteiro preso na memória da aba até ela
   * fechar o app — e numa fileira de stories ela troca várias vezes.
   */
  const [previaDaFoto, setPreviaDaFoto] = useState<string | null>(null);
  useEffect(() => {
    if (!fotoDaResposta) {
      setPreviaDaFoto(null);
      return;
    }
    const url = URL.createObjectURL(fotoDaResposta);
    setPreviaDaFoto(url);
    return () => URL.revokeObjectURL(url);
  }, [fotoDaResposta]);

  const atual = bolha.stories[i];
  /**
   * ⚠️ **A régua é `deveBorrar`, a MESMA do post — nunca uma condição escrita
   * aqui.** Duas réguas para "esconder ou não" divergiriam no primeiro ajuste,
   * e a divergência apareceria como o véu valendo no feed e não no story.
   */
  const borrado = deveBorrar({
    sensivel: !!atual?.sensivel,
    /* ⚠️ `souEu` é a prop de "esta bolha é a MINHA", e uma bolha é de uma
       autora só — então ela responde exatamente "sou a autora deste story".
       Ela nunca vê o próprio borrado: sabe o que publicou, e borrar seria
       tratá-la como quem precisa ser protegida do que decidiu contar. */
    souAAutora: souEu,
    revelado: reveladoStory === atual?.id,
  });

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
    /* ⚠️ **A FOTO ANEXADA PARA O STORY.** Sem isto ele avança enquanto ela olha
       a prévia, e a foto sairia grudada num story que ela já não está vendo — o
       anexo apontaria para outra coisa, para sempre. Mesma razão da enquete e
       da folha de "visto por". */
    if (pausado || quemViu || confirmando || enqueteEsperando || fotoDaResposta || !atual) return;
    /* ⚠️ **O VÍDEO MANDA NO RELÓGIO, e o véu também.** Cinco segundos cravados
       cortariam ao meio um vídeo de vinte — e ela nunca veria o fim daquilo que
       a amiga gravou. E um story marcado como sensível não pode passar sozinho
       enquanto ela decide se quer ver: o véu SEGURA o relógio, senão a decisão
       que a tela pede acontece com o story já trocando. */
    if (borrado) return;
    /* ⚠️ **A duração é do story ATUAL.** Ela é zerada na troca (abaixo): sem
       isso, o story seguinte — que pode ser uma foto — herdaria o relógio do
       vídeo de vinte segundos que veio antes. */
    const duracao = duracaoDoVideo ?? DURACAO_DO_STORY;
    const t = setTimeout(() => {
      if (i + 1 < bolha.stories.length) setI(i + 1);
      else aoFechar();
    }, duracao);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    i,
    pausado,
    quemViu,
    confirmando,
    atual?.id,
    voteiAgora,
    borrado,
    duracaoDoVideo,
    fotoDaResposta,
  ]);

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
                /* ⚠️ **LONGHANDS, e NUNCA o atalho `animation`.** Misturar o
                   atalho com `animationPlayState` no mesmo objeto de estilo faz
                   o React avisar ("don't mix shorthand and non-shorthand
                   properties") — e o aviso é sobre um defeito real: numa
                   repintura o atalho REESCREVE o `animation-play-state`, e a
                   barra volta a correr sozinha enquanto o dedo a segura. Era
                   exatamente o travamento que o comentário abaixo diz impedir.
                   Achado varrendo a Comunidade com INTERAÇÃO, não só carga. */
                animationName: n === i ? "dc-story-barra" : undefined,
                animationDuration: n === i ? `${DURACAO_DO_STORY}ms` : undefined,
                animationTimingFunction: n === i ? "linear" : undefined,
                animationFillMode: n === i ? "forwards" : undefined,
                /* A barrinha para JUNTO com o relógio — se ela continuasse
                   correndo, chegaria ao fim antes de a foto trocar, que lê
                   como travamento. */
                animationPlayState:
                  pausado ||
                  quemViu ||
                  confirmando ||
                  fotoDaResposta ||
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
        {/* ⚠️ **ROLAGEM NATIVA com `scroll-snap`, e NUNCA `transform` por
            estado.** É a mesma decisão do carrossel do post: o deslizar tem
            inércia e resistência de borda que o sistema calcula, e
            reimplementar dá sempre um arrasto que parece quase certo e nunca é.

            ⚠️ E o carrossel do story tem uma trava a mais: ele vive DENTRO de
            uma tela cujas metades avançam e voltam o story. `stopPropagation`
            no contêiner é o que impede um deslize horizontal de virar um
            avanço — sem ele, folhear as fotos pularia o story inteiro. */}
        {borrado ? (
          /* ⚠️ **SOB O VÉU NÃO HÁ MÍDIA NENHUMA NO DOM — nem borrada.** Borrar
              com CSS ainda BAIXA o arquivo e o deixa na página: quem quisesse o
              leria pelo inspetor, e o 4G dela pagaria por um vídeo que ela
              decidiu não ver. Aqui não existe `<img>` nem `<video>` até ela
              tocar. É a mesma decisão do véu do feed.
              ⚠️ E o TEXTO entra junto: num story sobre uma perda é a frase que
              carrega a notícia. */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReveladoStory(atual.id);
            }}
            /* ⚠️ **`z-20`, acima das metades invisíveis de avançar/voltar.**
                Sem isto o botão "Próximo" (`inset-y-0 right-0 w-2/3`) fica POR
                CIMA do véu e engole o toque: ela toca querendo decidir, o story
                AVANÇA, e o seguinte aparece sem véu nenhum — a decisão que a
                tela pede nunca acontece. É a mesma trava que a enquete e a
                caixinha já têm, e o véu nasceu sem ela; quem pegou foi a foto
                da bancada, não o `tsc`. */
            className="absolute inset-0 z-20 flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-900 px-8 text-center"
          >
            {atual.motivoSensivel && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs text-white">
                {atual.motivoSensivel}
              </span>
            )}
            <span className="text-[15px] font-semibold text-white">Toque para ver</span>
            <span className="text-xs text-white/70">
              Quem publicou marcou este story como sensível.
            </span>
          </button>
        ) : atual.videoUrl ? (
          /* ⚠️ **`playsInline` e `autoPlay` MUDO.** Sem `playsInline` o iPhone
              abre o vídeo no player de tela cheia do sistema e o story
              desaparece por baixo dele; sem `muted` o navegador recusa tocar
              sozinho, e a paciente veria um quadro parado sem saber que era
              vídeo. O som ela liga nos controles. */
          <video
            key={atual.id}
            src={atual.videoUrl}
            poster={atual.imagemUrl ?? undefined}
            autoPlay
            muted
            playsInline
            controls
            onClick={(e) => e.stopPropagation()}
            onLoadedMetadata={(e) => {
              const d = (e.target as HTMLVideoElement).duration;
              /* ⚠️ Só um número FINITO manda no relógio: `Infinity` (stream sem
                 duração) faria o story nunca avançar. */
              setDuracaoDoVideo(Number.isFinite(d) && d > 0 ? d * 1000 : null);
            }}
            className="h-full w-full object-contain"
          />
        ) : (atual.imagens ?? []).length > 1 ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          >
            {(atual.imagens ?? []).map((u, i) => (
              <img
                key={`${u}-${i}`}
                src={u}
                alt=""
                className="h-full w-full shrink-0 snap-center object-contain"
              />
            ))}
          </div>
        ) : (
          atual.imagemUrl && (
            <img src={atual.imagemUrl} alt="" className="h-full w-full object-contain" />
          )
        )}
        {/* ⚠️ Os pontinhos ficam ABAIXO da barrinha do tempo, e não no lugar
            dela: as duas contam coisas diferentes (quantas fotos × quanto falta
            do story), e juntá-las faria a paciente ler uma como a outra. */}
        {!borrado && (atual.imagens ?? []).length > 1 && !atual.videoUrl && (
          <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center gap-1">
            {(atual.imagens ?? []).map((_, i) => (
              <span key={i} className="h-1 w-1 rounded-full bg-white/70" />
            ))}
          </div>
        )}
        {!borrado && atual.texto && (
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

        {/* ⚠️ **O QUADRO DA PUBLICAÇÃO COMPARTILHADA.**

            Ele vem RESOLVIDO PARA QUEM ASSISTE — o servidor passa a publicação
            por `podeVerPost` com o contexto de quem abriu, e quando a régua
            recusa o campo chega `null` e o story continua inteiro. A tela nunca
            decide isso: uma segunda régua aqui seria a divergência que aparece
            como publicação de perfil fechado dentro do story de outra pessoa.

            ⚠️ **`z-20`, acima das metades invisíveis de avançar/voltar** — sem
            isso, tocar no quadro avançaria o story em vez de abrir a
            publicação, e o cartão seria um desenho que ninguém consegue usar. É
            a mesma lição da enquete, três blocos abaixo.

            ⚠️ **E o toque PAUSA o relógio antes de navegar**: sem isso o story
            avança por baixo enquanto a publicação abre, e ao voltar ela está
            noutro lugar da fileira. */}
        {atual.postCompartilhado && (
          <button
            type="button"
            onClick={() => {
              /* Pausa o relógio ANTES de navegar: sem isso o story avança por
                 baixo enquanto a publicação abre, e ao voltar ela está noutro
                 lugar da fileira. */
              setPausado(true);
              aoAbrirPublicacao?.(atual.postCompartilhado!.id);
            }}
            className="press absolute inset-x-6 bottom-24 z-20 flex items-center gap-3 rounded-2xl bg-black/55 p-2.5 text-left backdrop-blur-sm"
          >
            {atual.postCompartilhado.imagemUrl ? (
              <img
                src={atual.postCompartilhado.imagemUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 text-lg">
                🖼
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-white">
                {atual.postCompartilhado.autorNome}
              </span>
              {atual.postCompartilhado.texto && (
                <span className="line-clamp-2 block text-xs leading-snug text-white/80">
                  {atual.postCompartilhado.texto}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs font-semibold text-white/90">Ver</span>
          </button>
        )}

        {/* ⚠️ A ENQUETE E A CAIXINHA vivem ACIMA das metades invisíveis
            (`z-20`): sem isso, tocar numa opção cairia no "avançar story", e a
            enquete seria um desenho que ninguém consegue usar.
            ⚠️ E as duas PAUSAM o relógio enquanto estão na tela — responder uma
            pergunta leva mais que os cinco segundos do story. */}
        {!borrado && atual.enquete && (
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
              <p className="text-center text-xs text-white/75">
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
        {/* ⚠️ **E NUNCA SOB O VÉU.** A foto da bancada pegou: com o aviso de
            conteúdo em pé, a fileira de emojis continuava à mostra — ela
            reagiria a um story que não viu, e o afago chegaria à caixa da
            autora vindo de quem não leu nada. Sob o véu a tela pede UMA
            decisão, e mais nada é oferecido. */}
        {!borrado && !souEu && aoReagirAoStory && !atual.enquete && !atual.perguntaAberta && (
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
            {/* ⚠️ Diz PARA ONDE VAI. Sem esta frase ela acha que mandou um
                recado que ninguém vai ler. */}
            <p className="mt-1 text-center text-xs text-white/75">
              {(reagiAgora[atual.id] ?? atual.minhaReacao)
                ? "Ela vai ver na caixa dela 💛"
                : "Toque para reagir — ela vê o seu nome"}
            </p>

            {/* ─── RESPONDER AO STORY ────────────────────────────────────────
                ⚠️ **É A ORIGEM Nº 1 DE MENSAGEM DIRETA no modelo, e ela não
                existia.** O direct só nascia pelo botão do PERFIL — ou seja,
                ela precisava decidir escrever ANTES de ter assunto. Aqui o
                assunto está na tela: é a foto que a amiga acabou de publicar.

                ⚠️ **A mensagem carrega o STORY como anexo** (`ref_tipo`), e não
                o texto "sobre o seu story de hoje": em 24 h o story some, e uma
                frase solta na conversa perderia o contexto para sempre. */}
            {!borrado && aoResponderStory && (
              <div className="mt-2">
                {respondido[atual.id] ? (
                  <p className="rounded-full bg-black/45 px-4 py-2 text-center text-xs text-white backdrop-blur-sm">
                    Enviado 💛
                  </p>
                ) : (
                  <>
                    <input
                      ref={escolherFoto}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        if (f) setFotoDaResposta(f);
                      }}
                    />
                    {/* ⚠️ **A PRÉVIA É OBRIGATÓRIA.** Sem ela, escolher a foto
                        mandaria a mensagem às cegas: ela não veria o que
                        anexou, e não teria como desistir. E o × devolve a
                        resposta ao texto puro — e destrava o relógio. */}
                    {previaDaFoto && (
                      <div className="mb-2 flex items-center gap-2 rounded-2xl bg-black/45 p-2 backdrop-blur-sm">
                        <img
                          src={previaDaFoto}
                          alt="A foto que vai junto com a sua resposta"
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                        <span className="flex-1 text-xs text-white/85">
                          Vai junto com a sua resposta
                        </span>
                        <button
                          type="button"
                          aria-label="Tirar a foto da resposta"
                          onClick={() => setFotoDaResposta(null)}
                          className="press -m-2 flex h-11 w-11 items-center justify-center text-xl leading-none text-white"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 rounded-full bg-black/40 p-1 backdrop-blur-sm">
                      {/* ⚠️ Desenhado, e não 📷: o emoji tem cor própria em cada
                          sistema, e este fica sobre a foto de outra pessoa. */}
                      <button
                        type="button"
                        aria-label="Anexar uma foto à resposta"
                        onClick={() => escolherFoto.current?.click()}
                        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        >
                          <rect x="3" y="6" width="18" height="14" rx="3" />
                          <circle cx="12" cy="13" r="3.2" />
                          <path d="M8.5 6 10 3.6h4L15.5 6" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <input
                        value={resposta}
                        onChange={(e) => setResposta(e.target.value.slice(0, 500))}
                        placeholder="Responder…"
                        aria-label={`Responder ao story de ${bolha.autorNome}`}
                        className="min-h-[44px] flex-1 rounded-full bg-transparent px-3 text-[13px] text-white placeholder:text-white/60 focus:outline-none"
                      />
                      {/* ⚠️ **A FOTO SOZINHA JÁ É MENSAGEM** — o servidor aceita
                          corpo só com imagem. Exigir texto faria o anexo virar
                          um enfeite de uma frase obrigatória. */}
                      <button
                        type="button"
                        disabled={!resposta.trim() && !fotoDaResposta}
                        onClick={() => {
                          const t = resposta.trim();
                          const f = fotoDaResposta;
                          if (!t && !f) return;
                          /* ⚠️ Marca ANTES de a rede responder: a paciente
                             precisa ver que o toque valeu, e o story continua
                             correndo. */
                          setRespondido((r) => ({ ...r, [atual.id]: true }));
                          setResposta("");
                          setFotoDaResposta(null);
                          aoResponderStory(bolha.autorId, atual.id, t, f);
                        }}
                        className="press min-h-[44px] shrink-0 rounded-full bg-white/90 px-3.5 text-[13px] font-semibold text-black disabled:opacity-40"
                      >
                        Enviar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {!borrado && atual.perguntaAberta && !souEu && aoPerguntarNoStory && (
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
                <p className="px-1 pb-1.5 text-xs text-white/85">
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
                {recado && <p className="px-1 pt-1.5 text-xs leading-snug text-white">{recado}</p>}
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
          {/* ✈ **MANDAR O STORY PARA UMA CONVERSA.**

              ⚠️ **SÓ O MEU, e a restrição é de VISIBILIDADE, não de escopo.**
              Encaminhar o story de outra pessoa é o uso mais comum num app de
              fotos — e aqui seria a porta dos fundos da camada que os stories
              acabaram de ganhar: um story marcado "só amigas" chegaria a quem
              não é amiga dela, pela mão de quem é. O post pode ser mandado
              porque quem abrir passa por `podeVerPost`; o story não tem esse
              caminho de leitura por id.

              ⚠️ E ele importa MAIS que no post: o story expira em 24 h, então
              mandar é justamente o que o salva. */}
          {aoMandarStory && (
            <button
              type="button"
              onClick={() => {
                /* Pausa antes de abrir a folha, senão o story avança por baixo
                   dela e ao voltar ela está noutro. */
                setPausado(true);
                aoMandarStory(atual.id);
              }}
              aria-label="Mandar este story para uma conversa"
              className="press text-[15px] text-white/85"
            >
              ✈
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

      {/* ⚠️ **DENUNCIAR — e o story era a ÚLTIMA superfície sem isto.**
          Post, perfil, comentário, pergunta e mensagem já tinham. E aqui pesa
          mais que em todas: o story EXPIRA em 24 h, então o que não for
          denunciado agora nunca chega à plataforma — a próxima paciente recebe
          a mesma coisa da mesma pessoa, e ninguém soube. Bloquear existe, e
          bloquear não deixa rastro nenhum.

          ⚠️ Só no story DELA: denunciar o próprio não quer dizer nada. */}
      {/* ⚠️ **"com Fulana" no story, e é a MESMA régua do post** — quem está em
          Modo Cuidado, quem pausou e quem ela bloqueou já saíram da lista no
          servidor. Aqui é só o desenho. */}
      {atual && (atual.marcadas ?? []).length > 0 && (
        <span className="pointer-events-none absolute inset-x-4 bottom-16 z-10 truncate rounded-full bg-black/45 px-3 py-1 text-center text-xs text-white">
          com {(atual.marcadas ?? []).map((m) => m.nome).join(", ")}
        </span>
      )}

      {!souEu && atual && aoDenunciarStory && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center px-4 pb-[calc(1rem+var(--safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={() => {
              setPausado(true);
              setDenunciando(true);
            }}
            className="press ml-auto min-h-[44px] text-[13px] text-white/70"
          >
            Denunciar
          </button>
        </div>
      )}

      {denunciando && atual && aoDenunciarStory && (
        <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-card p-4">
          <p className="text-[14px] font-semibold">Denunciar este story?</p>
          {/* ⚠️ A tela NÃO promete o que vai acontecer com a pessoa — a fila é
              da plataforma, e prometer remoção seria prometer o que ninguém
              garante. Mesma decisão das outras cinco denúncias. */}
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            A gente vai olhar. O story some em 24 horas; a denúncia fica.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m.motivo}
                type="button"
                onClick={() => {
                  aoDenunciarStory(atual.id, m.motivo);
                  setDenunciando(false);
                  setPausado(false);
                }}
                className="press min-h-[44px] rounded-full pill-3d px-3 text-xs"
              >
                {m.rotulo}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setDenunciando(false);
              setPausado(false);
            }}
            className="press mt-3 min-h-[44px] text-[13px] text-muted-foreground"
          >
            Cancelar
          </button>
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
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
                      className="press rounded-lg pill-3d px-2.5 py-1.5 text-xs"
                    >
                      Agora não
                    </button>
                    <button
                      type="button"
                      onClick={() => aoResponder(a.quemId, true)}
                      className="press rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
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
/**
 * A QUALIDADE DE TODA FOTO QUE SOBE DAQUI — publicação, story e capa de vídeo.
 *
 * ⚠️ **0,72, e desceu de 0,80 por causa da conta de banda.** Medido, codificando
 * a mesma imagem no canvas do navegador: **266 KB a 0,80 contra 197 KB a 0,72**
 * — 26% a menos numa foto que a paciente vê a 393 pontos de largura. A
 * diferença entre as duas existe num monitor, com a imagem ampliada; na tela
 * onde esta foto de fato aparece, não.
 *
 * ⚠️ **Abaixo de 0,70 o JPEG começa a mostrar blocagem em PELE e em CÉU**, que
 * é exatamente do que uma foto de gestação é feita — por isso 0,72 e não menos.
 * O ganho seguinte não vem de espremer mais: vem de mandar menos PIXELS para
 * quem tem tela de densidade 2, que é a escada de versões.
 *
 * ⚠️ **Um número só para as três**: publicação, story e capa de vídeo aparecem
 * no mesmo tamanho de tela, e três constantes divergiriam no primeiro ajuste.
 */
const QUALIDADE_DA_FOTO = 0.72;

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
    return codificarFoto(canvas, QUALIDADE_DA_FOTO);
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
    return codificarFoto(canvas, 0.75);
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
    return codificarFoto(canvas, 0.72);
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
    return codificarFoto(canvas, QUALIDADE_DA_FOTO);
  } catch {
    return null;
  }
}

/**
 * A CAPA do story de vídeo, tirada do próprio arquivo.
 *
 * ⚠️ **`imagem_path` é `NOT NULL` em `rede_stories`, então a capa não é
 * enfeite** — sem ela o story de vídeo simplesmente não grava. E ela é o que a
 * BOLINHA da fileira desenha: a decisão de tocar acontece ali, e um quadrado
 * preto no convite é um story que ninguém abre.
 *
 * ⚠️ **O quadro é o de 0,1 s, e nunca o de zero.** Em muitos arquivos o
 * primeiro quadro é preto (fade de abertura do próprio celular), e a capa
 * sairia toda escura — exatamente o defeito que ela veio evitar.
 *
 * Devolve `null` quando não dá: o chamador recusa o vídeo em vez de publicar um
 * story sem capa.
 */
async function capaDoVideo(file: File): Promise<{ capa: string; segundos: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.src = url;
    const pronto = await new Promise<boolean>((ok) => {
      /* ⚠️ Teto de tempo: um arquivo que o navegador não consegue decodificar
         deixaria a tela presa em "enviando" para sempre, sem erro nenhum. */
      const desiste = setTimeout(() => ok(false), 8000);
      v.onerror = () => {
        clearTimeout(desiste);
        ok(false);
      };
      v.onloadeddata = () => {
        clearTimeout(desiste);
        ok(true);
      };
      v.onseeked = () => {
        clearTimeout(desiste);
        ok(true);
      };
      /* Pedir o segundo 0,1 dispara `seeked`; se o arquivo for mais curto que
         isso, `loadeddata` responde antes. */
      v.currentTime = 0.1;
    });
    if (!pronto || !v.videoWidth) return null;
    const escala = Math.min(
      1,
      LADO_DO_STORY.largura / v.videoWidth,
      LADO_DO_STORY.altura / v.videoHeight,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * escala);
    canvas.height = Math.round(v.videoHeight * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const segundos = Number.isFinite(v.duration) ? v.duration : 0;
    return { capa: codificarFoto(canvas, QUALIDADE_DA_FOTO), segundos };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Teto de fotos por publicação — o mesmo do servidor (a primeira + nove). */
const FOTOS_POR_POST = 10;

export function NovoPost({
  aoFechar,
  aoPublicar,
  repostando,
  aulaDeHoje,
  filhosDeMentira,
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
  /** Só a bancada preenche — a tira de marcos precisa de um bebê nascido. */
  filhosDeMentira?: Filho[];
  /** A publicação sendo republicada, quando o compositor abriu por ela. */
  repostando?: PostNaTela | null;
  aoPublicar: (p: {
    texto: string | null;
    /** ⚠️ Um RÓTULO que ela escreve, nunca coordenada — ver o campo na tela. */
    lugar?: string | null;
    fotos: string[];
    /** A versão de 480px da primeira foto. `null` é normal — ver `miniatura.ts`. */
    miniatura?: string | null;
    visibilidade: Visibilidade;
    quemComenta?: QuemComenta;
    enquete: string[];
    aula: AulaNoPost | null;
    /** O marco do bebê, com a idade em DIAS. Ver `marcos.ts`. */
    marco?: { tipo: string; dias: number | null } | null;
    /** O vídeo JÁ SUBIDO ao Storage — só o caminho viaja. Ver `video-do-post.ts`. */
    video?: { caminho: string; segundos: number | null } | null;
    /** A publicação republicada. Conferida no servidor. */
    repostDe?: string | null;
    /** Os ids de quem estava junto. O servidor confere cada um. */
    marcadas: string[];
    /** O post antigo que vira a primeira foto, ou `null`. */
    comparacaoCom: string | null;
    /** A descrição da foto, para leitores de tela. */
    altTexto?: string | null;
    /** A autora marcou como sensível — ver `conteudo-sensivel.ts`. */
    sensivel?: boolean;
    motivoSensivel?: string | null;
    /** A legenda do vídeo, para quem assiste sem som ou com leitor de tela. */
    videoLegenda?: string | null;
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
  /**
   * A descrição da foto, para leitores de tela.
   *
   * ⚠️ **Recolhida por padrão.** É acessibilidade, não legenda: quem precisa
   * sabe o que é, e um segundo campo aberto entre a foto e o botão faria parte
   * das pacientes achar que precisa preencher os dois.
   */
  const [altTexto, setAltTexto] = useState("");
  /**
   * ⚠️ **QUEM MARCA É QUEM PUBLICA, e o app NUNCA marca sozinho.**
   *
   * A tentação é marcar o que a régua clínica reconhece, ou todo post de quem
   * está em luto. A segunda contaria o luto dela para quem visse a marca. Ver
   * `MARCA_AUTOMATICA` em `conteudo-sensivel.ts`.
   */
  const [sensivel, setSensivel] = useState(false);
  const [motivoSensivel, setMotivoSensivel] = useState<string>(MOTIVOS_SENSIVEIS[0].id);
  const [videoLegenda, setVideoLegenda] = useState("");
  const [lugar, setLugar] = useState("");
  const [altAberto, setAltAberto] = useState(false);
  const [fotos, setFotos] = useState<string[]>(() => {
    if (!momentoInicial || typeof document === "undefined") return [];
    const url = cartaoDoMomento(momentoInicial);
    return url ? [url] : [];
  });
  /* ⚠️ O padrão é o mais FECHADO. O erro possível aqui é publicar para menos
     gente do que ela queria — nunca para mais. */
  const [quemComenta, setQuemComenta] = useState<QuemComenta>(QUEM_COMENTA_PADRAO);
  const [vis, setVis] = useState<Visibilidade>("amigas");
  /* `null` = sem enquete. Duas opções vazias é o estado inicial de quem abriu
     a enquete e ainda não escreveu — e não uma enquete inválida na tela. */
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const [comAula, setComAula] = useState(false);

  /**
   * O BEBÊ MAIS NOVO QUE JÁ NASCEU — é dele que o marco fala.
   *
   * ⚠️ **O MAIS NOVO, e não o primeiro da lista.** Uma mãe de dois publica o
   * mesversário do caçula; oferecer "3 meses" quando o bebê de 3 meses é o
   * segundo filho, e a lista devolve o mais velho, poria a idade errada num
   * post que a família inteira vai ver.
   */
  const [filhosDela, setFilhosDela] = useState<Filho[]>(filhosDeMentira ?? []);
  /** O vídeo já subido: `{caminho, segundos}`. `null` = publicação de foto. */
  const [video, setVideo] = useState<{ caminho: string; segundos: number | null } | null>(null);
  const [subindoVideo, setSubindoVideo] = useState(false);
  const arquivoDeVideo = useRef<HTMLInputElement>(null);
  const [marco, setMarco] = useState<string | null>(null);

  useEffect(() => {
    if (filhosDeMentira) return;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const t = (await supabase.auth.getSession()).data.session?.access_token;
        if (!t) return;
        const { meusFilhos } = await import("@/lib/filhos.functions");
        const r = await meusFilhos({ data: { accessToken: t } });
        if (r.ok) setFilhosDela(r.filhos);
      } catch {
        /* Sem filhos carregados o compositor fica como sempre foi: a tira de
           marcos não aparece, e publicar continua funcionando. */
      }
    })();
  }, [filhosDeMentira]);

  const hojeStr = hojeEmSaoPaulo();
  const caculaNascido = (() => {
    const nascidos = filhosDela.filter((f) => f.nascidoEm);
    if (nascidos.length === 0) return null;
    return nascidos.reduce((a, b) => ((a.nascidoEm ?? "") > (b.nascidoEm ?? "") ? a : b));
  })();
  const bebeNascido = !!caculaNascido;
  const diasDoBebe = caculaNascido?.nascidoEm ? diasEntre(caculaNascido.nascidoEm, hojeStr) : null;
  const mesesDoBebe = caculaNascido?.nascidoEm
    ? (mesesEntre(caculaNascido.nascidoEm, hojeStr) ?? 0)
    : 0;
  const mesversarioHoje = caculaNascido?.nascidoEm
    ? mesversarioDeHoje(caculaNascido.nascidoEm, hojeStr)
    : null;
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
  /* ⚠️ O campo da descrição segue as FOTOS, e não o vídeo: um vídeo não tem
     `alt`, e oferecer o campo ali prometeria uma acessibilidade que o
     elemento não entrega. */
  const temFoto = fotos.length > 0;
  const temVideo = !!video;
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
      lugar: lugar.trim() || null,
      fotos,
      miniatura,
      visibilidade: vis,
      /* ⚠️ Apertada AQUI também, e não só no servidor: a tela pode ter a camada
         `todos` guardada de quando a visibilidade era `publico` e ela tê-la
         fechado depois — mandar `todos` faria o servidor apertar em silêncio, e
         a autora acharia que abriu a conversa. */
      quemComenta: apertarQuemComenta({ visibilidade: vis, quemComenta }),
      enquete: opcoes ? opcoesLimpas : [],
      aula: comAula ? (aulaDeHoje ?? null) : null,
      /* ⚠️ Os DIAS vão junto, e é isso que faz o post não envelhecer: a tela
         recalcula "3 meses" a cada pintura, em vez de repetir um texto salvo. */
      marco: marco && bebeNascido ? { tipo: marco, dias: diasDoBebe } : null,
      video,
      repostDe: repostando?.id ?? null,
      marcadas,
      comparacaoCom: entao,
      altTexto: altTexto.trim() || null,
      sensivel,
      /* O motivo só viaja com a marca ligada — senão fica um rótulo pendurado
         num post que não borra. */
      motivoSensivel: sensivel ? motivoSensivel : null,
      videoLegenda: videoLegenda.trim() || null,
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
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
            <p className="min-w-0 flex-1 text-xs leading-snug">
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
              className="press shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
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
          <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
            {LIMITE_DO_TEXTO - texto.length}
          </p>
        )}

        {/* ─── A DESCRIÇÃO DA FOTO ────────────────────────────────────────
            ⚠️ **SÓ COM FOTO, e RECOLHIDA.** É acessibilidade, não legenda: quem
            precisa dela sabe o que é, e quem não precisa não deve ter um campo
            a mais entre a foto e o botão de publicar. Um segundo campo aberto
            aqui faria parte das pacientes achar que precisa preencher os dois.

            ⚠️ **E não é opcional por preguiça.** A diretriz de acessibilidade da
            Apple cobra isto na revisão, e o app é instalado por quem usa leitor
            de tela: sem descrição, a foto do ultrassom de uma amiga é uma
            lacuna silenciosa no meio do feed. */}
        {/* ⚠️ **O LUGAR É UM RÓTULO QUE ELA ESCREVE, e nunca coordenada nem
            autocompletar.** Guardar latitude e longitude de uma gestante — e
            devolvê-las a quem abre o post — é dado de localização precisa numa
            base de alto risco. E um catálogo de endereços transformaria o campo
            numa lista de maternidades com as pacientes de cada uma, que é
            exatamente o cruzamento que a régua de "nada clínico no perfil"
            existe para impedir. */}
        <input
          value={lugar}
          onChange={(e) => setLugar(e.target.value.slice(0, 60))}
          placeholder="📍 Onde? (opcional)"
          aria-label="O lugar desta publicação"
          className="mt-2 min-h-[44px] w-full rounded-2xl border border-border bg-background px-3 text-[13px]"
        />

        {/* ⚠️ **A MARCA É DELA, e o app nunca a põe sozinho.** Marcar
            automaticamente o que a régua clínica reconhece — ou todo post de
            quem está em luto — seria o app decidindo que a história dela é
            sensível, e a segunda contaria o luto dela para quem visse a marca.

            ⚠️ E o texto diz o que a marca FAZ ("borra, não esconde"): sem isso
            ela hesita, achando que o post vai sumir do feed. */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setSensivel((v) => !v)}
            aria-pressed={sensivel}
            className="press min-h-[36px] text-xs font-medium text-muted-foreground"
          >
            {sensivel ? "✓ Marcado como sensível" : "Marcar como conteúdo sensível"}
          </button>
          {sensivel && (
            <>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {MOTIVOS_SENSIVEIS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMotivoSensivel(m.id)}
                    aria-pressed={motivoSensivel === m.id}
                    className={`press min-h-[36px] rounded-full border px-3 text-xs ${
                      motivoSensivel === m.id
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {m.rotulo}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                A publicação continua no feed. Ela aparece borrada, com este aviso, e quem quiser
                toca para ver.
              </p>
            </>
          )}
        </div>

        {/* ⚠️ **A LEGENDA DO VÍDEO só aparece com vídeo escolhido.** Um campo de
            legenda ao lado de uma foto promete um recurso que o elemento não
            entrega — a mesma razão pela qual a descrição da foto só aparece com
            foto. */}
        {temVideo && (
          <div className="mt-2">
            <input
              value={videoLegenda}
              onChange={(e) => setVideoLegenda(e.target.value.slice(0, 600))}
              placeholder="O que é dito no vídeo"
              aria-label="Legenda do vídeo"
              className="min-h-[44px] w-full rounded-2xl border border-border bg-background px-3 text-[13px]"
            />
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Para quem assiste sem som e para quem usa leitor de tela.
            </p>
          </div>
        )}

        {temFoto && (
          <div className="mt-2">
            {!altAberto ? (
              <button
                type="button"
                onClick={() => setAltAberto(true)}
                className="press min-h-[36px] text-xs font-medium text-muted-foreground"
              >
                {altTexto.trim() ? "✓ Descrição escrita" : "Descrever a foto (acessibilidade)"}
              </button>
            ) : (
              <>
                <input
                  value={altTexto}
                  onChange={(e) => setAltTexto(e.target.value.slice(0, 300))}
                  placeholder="O que a foto mostra"
                  aria-label="Descrição da foto para leitores de tela"
                  className="min-h-[44px] w-full rounded-2xl border border-border bg-background px-3 text-[13px]"
                />
                {/* ⚠️ Diz PARA QUEM serve. Sem a frase, ela escreve uma segunda
                    legenda — e o leitor de tela lê as duas, uma atrás da
                    outra. */}
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Lida em voz alta por quem usa leitor de tela. Descreva o que aparece, sem repetir
                  a legenda.
                </p>
              </>
            )}
          </div>
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
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                A foto é enviada só para escrever a sugestão, e não fica guardada.
              </p>
            )}

            {sugestoes !== null && sugestoes.length === 0 && !pensando && (
              <p className="mt-1.5 text-xs text-muted-foreground">
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
                <p className="pt-0.5 text-xs text-muted-foreground">
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
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">
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
                <p className="px-1 pb-1.5 text-xs text-muted-foreground">
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
                <p className="px-1 pb-1.5 text-xs text-muted-foreground">
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
                className="press text-xs text-muted-foreground"
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
                className="press mt-1 inline-flex min-h-[44px] items-center text-[13px] font-medium text-primary"
              >
                + opção
              </button>
            )}
            {/* ⚠️ O aviso do voto único aparece ANTES de publicar, e não só
                para quem vota: quem cria a enquete precisa saber que não dá
                para corrigir depois — post não se edita. */}
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              Cada pessoa vota uma vez, e o voto não muda. Você vê só os números — nunca quem votou
              em quê.
            </p>
            {!enqueteOk && opcoesLimpas.length > 0 && (
              <p className="mt-1 text-xs text-destructive">
                {opcoesLimpas.length < OPCOES_MIN
                  ? `Escreva pelo menos ${OPCOES_MIN} opções.`
                  : "As opções precisam ser diferentes entre si."}
              </p>
            )}
          </div>
        )}

        {/* ─── O MARCO DO BEBÊ ──────────────────────────────────────────
            ⚠️ **SÓ APARECE PARA QUEM TEM BEBÊ NASCIDO.** Oferecer "primeiro
            sorriso" a uma gestante é oferecer um botão que não tem como ser
            usado — e, pior, num app onde nem toda gestação termina bem.

            ⚠️ E A LISTA NÃO ESCONDE NADA: `marcosSugeridos` REORDENA pela idade
            e mantém o catálogo inteiro. Um bebê que anda aos vinte meses tem de
            achar "primeiros passos" na tela. */}
        {bebeNascido && (
          <div className="mt-3">
            <p className="text-[13px] font-medium">Um marco de hoje?</p>
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {marcosSugeridos(mesesDoBebe).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMarco((v) => (v === m.id ? null : m.id))}
                  aria-pressed={marco === m.id}
                  className={`press shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
                    marco === m.id ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  {m.emoji}{" "}
                  {m.id === "mesversario" && mesversarioHoje
                    ? `${mesversarioHoje} ${mesversarioHoje === 1 ? "mês" : "meses"}`
                    : m.titulo}
                </button>
              ))}
            </div>
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
          <p className="text-xs font-medium text-muted-foreground">Quem vai ver</p>
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
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            {VISIBILIDADES.find((v) => v.chave === vis)?.sub}
          </p>
        </div>

        {/* ⚠️ **QUEM PODE COMENTAR — a camada que faltava.**

            Até agora era tudo ou nada: fechar os comentários para todo mundo.
            Num app cuja decisão central foi limitar conselho de leiga, "só
            amigas podem comentar" é a peça que deixa a publicação visível e
            restringe QUEM opina.

            ⚠️ **A lista é APERTADA contra a camada de visibilidade.** Um post
            `amigas` com "todo mundo pode comentar" é combinação sem sentido —
            as pessoas a quem "todo mundo" se refere não veem a publicação —, e
            oferecê-la faria a autora acreditar que abriu a conversa quando não
            abriu nada. A régua é `apertarQuemComenta`, e não um `filter` escrito
            aqui. */}
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Quem pode comentar</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUEM_COMENTA.filter(
              (q) => apertarQuemComenta({ visibilidade: vis, quemComenta: q.chave }) === q.chave,
            ).map((q) => (
              <button
                key={q.chave}
                type="button"
                onClick={() => setQuemComenta(q.chave)}
                className={`press rounded-full px-3 py-1.5 text-[13px] ${
                  apertarQuemComenta({ visibilidade: vis, quemComenta }) === q.chave
                    ? "bg-primary/15 font-semibold text-primary"
                    : "bg-muted/60"
                }`}
              >
                {q.rotulo}
              </button>
            ))}
          </div>
        </div>

        {/* ⚠️ A ORIGINAL À VISTA NO COMPOSITOR. Sem ela, a paciente escreve
            sem lembrar o que está republicando — e o quadro só apareceria
            depois de publicado, quando não dá mais para mudar de ideia. */}
        {repostando && (
          <div className="mt-3 rounded-xl border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Republicando</p>
            <p className="mt-0.5 text-xs font-semibold">{repostando.autorNome}</p>
            {repostando.texto && (
              <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug">{repostando.texto}</p>
            )}
          </div>
        )}

        {/* ⚠️ **VÍDEO OU FOTO, nunca os dois.** O cartão desenha um ou outro, e
            deixar escolher ambos faria a paciente montar um post que a tela não
            sabe pintar. O botão some quando já há foto, e vice-versa. */}
        {fotos.length === 0 && (
          <button
            type="button"
            disabled={subindoVideo}
            onClick={() => arquivoDeVideo.current?.click()}
            className={`press mt-3 w-full rounded-xl border py-2 text-[14px] font-medium ${
              video ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            {subindoVideo
              ? "Enviando o vídeo…"
              : video
                ? "Vídeo anexado ✓ (tocar para trocar)"
                : `🎬 Anexar um vídeo (até ${SEGUNDOS_MAX}s)`}
          </button>
        )}

        <input
          ref={arquivoDeVideo}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setErro(null);

            /* ⚠️ A DURAÇÃO É MEDIDA ANTES DE SUBIR. Subir 40 MB para descobrir
               que passa de um minuto é gastar o 4G dela para nada — e a recusa
               chegaria depois da espera, que é a pior ordem possível. */
            const segundos = await new Promise<number | null>((ok) => {
              try {
                const v = document.createElement("video");
                v.preload = "metadata";
                v.onloadedmetadata = () => ok(Number.isFinite(v.duration) ? v.duration : null);
                v.onerror = () => ok(null);
                v.src = URL.createObjectURL(f);
              } catch {
                ok(null);
              }
            });

            const recusa = recusaDoVideo({ tipo: f.type, bytes: f.size, segundos });
            if (recusa) {
              setErro(recadoDaRecusa(recusa));
              return;
            }

            setSubindoVideo(true);
            try {
              /* ⚠️ Sessão lida AQUI: o `token()` do `RedeNoApp` não alcança
                 este componente, e importar por prop só para isto acrescentaria
                 uma assinatura a um compositor que já tem quinze. */
              const { supabase: sb } = await import("@/integrations/supabase/client");
              const t = (await sb.auth.getSession()).data.session?.access_token;
              if (!t) return;
              const { urlParaSubirVideo } = await import("@/lib/rede-social.functions");
              const r = await urlParaSubirVideo({ data: { accessToken: t, tipo: f.type } });
              if (!r.ok) {
                setErro("Não deu para enviar o vídeo agora.");
                return;
              }
              const { supabase } = await import("@/integrations/supabase/client");
              /* ⚠️ **VAI DIRETO PARA O STORAGE**, com o token assinado — não
                 passa pelo servidor. É o ponto todo desta mudança. */
              const up = await supabase.storage
                .from("rede")
                .uploadToSignedUrl(r.caminho, r.token, f);
              if (up.error) {
                setErro("Não deu para enviar o vídeo agora.");
                return;
              }
              setVideo({ caminho: r.caminho, segundos });
            } catch {
              setErro("Não deu para enviar o vídeo agora.");
            } finally {
              setSubindoVideo(false);
            }
          }}
        />

        {/* ⚠️ A ORIGINAL À VISTA NO COMPOSITOR. Sem ela, a paciente escreve
            sem lembrar o que está republicando — e o quadro só apareceria
            depois de publicado, quando não dá mais para mudar de ideia. */}
        {repostando && (
          <div className="mt-3 rounded-xl border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Republicando</p>
            <p className="mt-0.5 text-xs font-semibold">{repostando.autorNome}</p>
            {repostando.texto && (
              <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug">{repostando.texto}</p>
            )}
          </div>
        )}

        {/* ⚠️ **VÍDEO OU FOTO, nunca os dois.** O cartão desenha um ou outro, e
            deixar escolher ambos faria a paciente montar um post que a tela não
            sabe pintar. O botão some quando já há foto, e vice-versa. */}
        {fotos.length === 0 && (
          <button
            type="button"
            disabled={subindoVideo}
            onClick={() => arquivoDeVideo.current?.click()}
            className={`press mt-3 w-full rounded-xl border py-2 text-[14px] font-medium ${
              video ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            {subindoVideo
              ? "Enviando o vídeo…"
              : video
                ? "Vídeo anexado ✓ (tocar para trocar)"
                : `🎬 Anexar um vídeo (até ${SEGUNDOS_MAX}s)`}
          </button>
        )}

        <input
          ref={arquivoDeVideo}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setErro(null);

            /* ⚠️ A DURAÇÃO É MEDIDA ANTES DE SUBIR. Subir 40 MB para descobrir
               que passa de um minuto é gastar o 4G dela para nada — e a recusa
               chegaria depois da espera, que é a pior ordem possível. */
            const segundos = await new Promise<number | null>((ok) => {
              try {
                const v = document.createElement("video");
                v.preload = "metadata";
                v.onloadedmetadata = () => ok(Number.isFinite(v.duration) ? v.duration : null);
                v.onerror = () => ok(null);
                v.src = URL.createObjectURL(f);
              } catch {
                ok(null);
              }
            });

            const recusa = recusaDoVideo({ tipo: f.type, bytes: f.size, segundos });
            if (recusa) {
              setErro(recadoDaRecusa(recusa));
              return;
            }

            setSubindoVideo(true);
            try {
              /* ⚠️ Sessão lida AQUI: o `token()` do `RedeNoApp` não alcança
                 este componente, e importar por prop só para isto acrescentaria
                 uma assinatura a um compositor que já tem quinze. */
              const { supabase: sb } = await import("@/integrations/supabase/client");
              const t = (await sb.auth.getSession()).data.session?.access_token;
              if (!t) return;
              const { urlParaSubirVideo } = await import("@/lib/rede-social.functions");
              const r = await urlParaSubirVideo({ data: { accessToken: t, tipo: f.type } });
              if (!r.ok) {
                setErro("Não deu para enviar o vídeo agora.");
                return;
              }
              const { supabase } = await import("@/integrations/supabase/client");
              /* ⚠️ **VAI DIRETO PARA O STORAGE**, com o token assinado — não
                 passa pelo servidor. É o ponto todo desta mudança. */
              const up = await supabase.storage
                .from("rede")
                .uploadToSignedUrl(r.caminho, r.token, f);
              if (up.error) {
                setErro("Não deu para enviar o vídeo agora.");
                return;
              }
              setVideo({ caminho: r.caminho, segundos });
            } catch {
              setErro("Não deu para enviar o vídeo agora.");
            } finally {
              setSubindoVideo(false);
            }
          }}
        />

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
              <span className="line-clamp-4 block p-2 text-left text-xs leading-snug text-foreground/70">
                {p.texto}
              </span>
            )}
            {/* ⚠️ **O PINO NA CÉLULA, e ele é para QUEM VISITA.** Sem marca
                nenhuma, as três primeiras simplesmente parecem as mais
                recentes — e quem abre o perfil não tem como saber que aquilo é
                um recorte escolhido. É a mesma razão do rótulo "Sugerido para
                você": o que muda a ordem tem de se anunciar.

                Sobre o canto e com sombra, porque pousa em cima da FOTO: um
                ícone sem contorno some numa foto clara. */}
            {p.fixadoEm && (
              <span
                className="pointer-events-none absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/45 text-white"
                aria-label="Fixada no topo"
              >
                <IconePino aceso />
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Salvos</h1>
      </header>
      {/* ⚠️ O texto diz que ninguém vê esta lista, e isso não é enfeite: no
          modelo, "salvo" é a única coleção privada de verdade, e quem não sabe
          disso usa o marcador com o mesmo cuidado de uma curtida pública. */}
      <p className="px-4 pb-2 text-xs leading-snug text-muted-foreground">
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
   A PÁGINA DE UMA #
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O QUE UMA `#` REÚNE.
 *
 * ⚠️ **SÓ POST PÚBLICO, por decisão explícita do dono.** É o ponto inteiro da
 * régua: a `#` é um lugar aberto, e quem chega nela não segue ninguém. Um post
 * de camada `amigas` aparecendo aqui seria a porta dos fundos da visibilidade —
 * o recorte está na CONSULTA (`postsDaTag`), antes de `montarPosts`, e nunca
 * num filtro depois.
 *
 * ⚠️ **E É GRADE, NÃO FEED.** Uma tag reúne desconhecidas por assunto; em
 * formato de feed, com legenda e reações à mostra, ela leria como "pessoas que
 * eu sigo" — que é exatamente a confusão que o rótulo "Sugerido para você"
 * existe para impedir. A grade é uma vitrine: quem quiser ler, abre.
 */
export function TelaDaTag({
  tag,
  aoVoltar,
  aoAbrirPost,
  acoes,
}: {
  tag: string;
  aoVoltar: () => void;
  aoAbrirPost?: (id: string) => void;
  /** Só para a bancada poder injetar posts sem servidor. */
  acoes?: unknown;
}) {
  const [posts, setPosts] = useState<PostNaTela[] | null>(null);
  void acoes;

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const s = await supabase.auth.getSession();
        const token = s.data.session?.access_token;
        if (!token) {
          if (vivo) setPosts([]);
          return;
        }
        const { postsDaTag } = await import("@/lib/mencoes.functions");
        const r = await postsDaTag({ data: { accessToken: token, tag } });
        if (vivo) setPosts(r.ok ? (r.posts as PostNaTela[]) : []);
      } catch {
        if (vivo) setPosts([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tag]);

  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
        >
          ‹
        </button>
        <h1 className="truncate text-[16px] font-semibold">#{tag}</h1>
      </header>
      {/* ⚠️ A régua é DITA. Sem esta linha, quem publicou para as amigas e não
          se vê aqui conclui que a tag está quebrada — e quem publicou em
          público não sabe que a foto dela virou vitrine aberta. */}
      <p className="px-4 pb-2 text-xs leading-snug text-muted-foreground">
        Aqui aparecem só as publicações abertas a qualquer pessoa no app.
      </p>
      {posts === null ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">Carregando…</p>
      ) : (
        <GradeDePosts
          posts={posts}
          vazio={`Ninguém publicou em #${tag} ainda.`}
          aoAbrirPost={aoAbrirPost}
        />
      )}
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Arquivados</h1>
      </header>
      {/* ⚠️ Diz que NINGUÉM MAIS VÊ, e diz que as reações continuam lá. As duas
          coisas são a razão de arquivar ser diferente de apagar, e nenhuma das
          duas é adivinhável. */}
      <p className="px-4 pb-3 text-xs leading-snug text-muted-foreground">
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
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-muted/50 px-1 text-center text-xs leading-tight text-muted-foreground">
                  {(p.texto ?? "").slice(0, 28) || "sem texto"}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{p.texto ?? "Sem legenda"}</span>
                <span className="block text-xs text-muted-foreground">
                  {haQuantoPublicou(p.criadoEm, Date.now())}
                </span>
              </span>
              <button
                type="button"
                onClick={() => aoDesarquivar(p)}
                className="press min-h-[44px] shrink-0 rounded-full pill-3d px-3 text-xs font-medium"
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
  aoAbrirTag,
  euId,
}: {
  /** Só para a chave do histórico local — ver `chaveDasBuscasRecentes`. */
  euId?: string | null;
  aoVoltar: () => void;
  aoBuscar: (termo: string) => Promise<PessoaNaLista[]>;
  aoAbrirPerfil?: (id: string) => void;
  /** Abre a página da tag. Sem a prop, a linha da `#` não aparece. */
  aoAbrirTag?: (tag: string) => void;
}) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<PessoaNaLista[]>([]);
  const [buscando, setBuscando] = useState(false);
  /**
   * ⚠️ **AS BUSCAS RECENTES FICAM NO APARELHO, e nunca no servidor.**
   *
   * O que ela procura é o nome de pessoas e de assuntos — e num app de gestação
   * de alto risco, "quem eu procurei" é um dado que não precisa existir em lugar
   * nenhum além da tela dela. É a mesma decisão da busca DENTRO da conversa.
   *
   * ⚠️ E a chave carrega o id da conta: o aparelho é compartilhado, e a lista de
   * quem a mãe procurou não pode aparecer para a filha que usa o mesmo celular.
   */
  const [recentes, setRecentes] = useState<string[]>([]);
  useEffect(() => {
    if (!euId) return;
    try {
      const cru = localStorage.getItem(chaveDasBuscasRecentes(euId));
      setRecentes(cru ? (JSON.parse(cru) as string[]).slice(0, BUSCAS_RECENTES_MAX) : []);
    } catch {
      /* Storage bloqueado (janela privada) — a busca funciona sem histórico. */
    }
  }, [euId]);

  function guardarBusca(t: string) {
    if (!euId) return;
    const nova = comBuscaNova(recentes, t);
    setRecentes(nova);
    try {
      localStorage.setItem(chaveDasBuscasRecentes(euId), JSON.stringify(nova));
    } catch {
      /* Sem storage, o histórico vive só nesta sessão. */
    }
  }
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
      /* ⚠️ **GUARDA SÓ O QUE ACHOU ALGUÉM.** Guardar toda tecla digitada encheria
         o histórico com prefixos ("a", "an", "ana") — e o histórico existe para
         ela voltar a uma busca que valeu. */
      if (r.length > 0) guardarBusca(t);
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
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

      {/* ⚠️ **A BUSCA ACHAVA PERFIL E MAIS NADA.** Quem ouviu falar de
          `#trigemeas` numa conversa não tinha caminho nenhum até lá — a página
          da tag existia e só se chegava nela tocando numa legenda que já a
          continha: só quem já a tinha encontrado conseguia encontrá-la.

          ⚠️ E ela NÃO consulta o servidor: `tagDaBusca` responde pelo FORMATO do
          termo. Uma consulta "existe esta tag?" por tecla digitada seria uma ida
          ao banco para uma pergunta que a própria página da tag responde melhor
          — com o vazio dela, que explica a régua ("só publicações públicas"). */}
      {tagDaBusca(termo) && aoAbrirTag && (
        <button
          type="button"
          onClick={() => aoAbrirTag(tagDaBusca(termo)!)}
          className="press flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-[18px] font-semibold">
            #
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold leading-tight">
              #{tagDaBusca(termo)}
            </span>
            <span className="block truncate text-xs leading-tight text-muted-foreground">
              Ver publicações com esta tag
            </span>
          </span>
        </button>
      )}

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
        <>
          {/* ⚠️ **O HISTÓRICO SÓ APARECE COM O CAMPO VAZIO.** Enquanto ela
              digita, o que importa é o resultado — e uma lista de buscas antigas
              embaixo de "ninguém com esse nome" competiria com a explicação que
              ensina a régua. */}
          {!termo.trim() && recentes.length > 0 && (
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Recentes</span>
                <button
                  type="button"
                  onClick={() => {
                    setRecentes([]);
                    try {
                      if (euId) localStorage.removeItem(chaveDasBuscasRecentes(euId));
                    } catch {
                      /* Sem storage, some só desta sessão. */
                    }
                  }}
                  className="press min-h-[44px] text-xs text-muted-foreground"
                >
                  Limpar
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {recentes.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTermo(r)}
                    className="press min-h-[44px] rounded-full pill-3d px-3 text-[13px]"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="px-6 py-10 text-center text-[13px] leading-snug text-muted-foreground">
            {termo.trim()
              ? "Ninguém com esse nome por aqui. Só aparece na busca quem deixou o perfil público."
              : "Procure por alguém que você já conhece."}
          </p>
        </>
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
                    <span className="block truncate text-xs leading-tight text-muted-foreground">
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
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl"
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
              className={`press flex-1 rounded-xl px-2 py-2 text-xs font-semibold ${
                p.chave === persona ? "bg-primary text-primary-foreground" : "bg-muted/60"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{escolhida?.sub}</p>
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

      <p className="px-6 pb-8 pt-2 text-center text-xs leading-snug text-muted-foreground">
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
  amigasParaMarcar,
  rascunho,
  aoGuardarRascunho,
  temVideo,
}: {
  /** Data URL da foto já reduzida. */
  imagem: string;
  /** "28 semanas", ou `null` quando não há o que carimbar. */
  semana: string | null;
  aoCancelar: () => void;
  aoPublicar: (opts: {
    texto: string;
    camada: VisibilidadeDoStory;
    carimbar: boolean;
    enquete: string[];
    perguntaAberta: boolean;
    marcadas: string[];
    maisFotos: string[];
  }) => void;
  /**
   * Quem ela pode marcar — a MESMA lista do compositor de post.
   *
   * ⚠️ **Só dentro do grafo já conectado, e NUNCA uma busca.** Buscar por nome
   * transformaria a base de pacientes numa lista navegável, e num app de
   * gestação de alto risco esse é o dado que menos pode vazar.
   */
  amigasParaMarcar?: { id: string; nome: string; avatar: string | null }[] | null;
  /** O rascunho guardado, quando há um. Ver `rascunho-do-story.ts`. */
  rascunho?: RascunhoDoStory | null;
  /** Guardar o que ela digitou. Recebe `null` quando não há mais nada a guardar. */
  aoGuardarRascunho?: (r: Omit<RascunhoDoStory, "em"> | null) => void;
  /**
   * O story é de VÍDEO — a `imagem` é a capa tirada do arquivo.
   *
   * ⚠️ **Com vídeo, o carrossel não é oferecido.** Um story é ou o vídeo, ou a
   * sequência de fotos: `imagem_path` é a capa nos dois casos, e acrescentar
   * fotos a um vídeo faria a segunda foto virar um story que nunca aparece.
   * Botão que promete e não entrega é pior que botão ausente.
   */
  temVideo?: boolean;
}) {
  const [carimbar, setCarimbar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [abrindoMarcar, setAbrindoMarcar] = useState(false);
  /**
   * As fotos do carrossel além da primeira.
   *
   * ⚠️ **Quatro, e não nove como o post.** O story é folheado com o dedo em pé,
   * com a barrinha correndo: cinco já é uma sequência que muita gente não
   * termina, e o formato existe para ser rápido.
   */
  const [maisFotos, setMaisFotos] = useState<string[]>([]);
  const arquivoExtra = useRef<HTMLInputElement>(null);
  /* `null` = sem enquete. Duas vazias é o estado de quem abriu e ainda não
     escreveu — a mesma forma do compositor de post. */
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const [caixinha, setCaixinha] = useState(false);
  /**
   * ⚠️ **O CAMPO DE TEXTO NÃO EXISTIA, e o servidor esperava por ele desde o
   * primeiro dia.** `publicarStory` aceita 200 caracteres, passa a régua
   * clínica neles e grava a coluna — e a tela mandava `texto: null` cravado.
   * Era o gênero inteiro faltando: um story sem legenda é uma foto muda.
   */
  const [texto, setTexto] = useState("");
  /**
   * ⚠️ **O STORY ERA O ÚNICO CONTEÚDO SEM CAMADA — e é o mais íntimo.** Ele ia
   * sempre para o público mais largo que ela tem. A régua e o padrão vivem em
   * `rede-social.ts`: `seguidores`, que é o comportamento que os stories já
   * tinham — fechar por padrão mudaria o alcance de quem não pediu nada.
   */
  const [camada, setCamada] = useState<VisibilidadeDoStory>(VISIBILIDADE_DO_STORY_PADRAO);
  /* ⚠️ **OFERECE, NUNCA PREENCHE SOZINHO** — a decisão do rascunho do post,
     pela mesma razão: encher o campo com o texto de ontem no momento em que ela
     abre para publicar outra coisa é como um story sai errado, e story não se
     edita depois de publicado. */
  const [ofereceu, setOfereceu] = useState(false);
  const temRascunho = !!rascunho && !ofereceu;

  /**
   * Guarda o que ela digitou, com atraso.
   *
   * ⚠️ **O `return` da primeira pintura é obrigatório, e a falta dele APAGAVA o
   * rascunho ao abrir** — é o defeito que o compositor de post já pagou. Sem
   * ele o efeito roda na montagem com os campos vazios e, 700 ms depois,
   * `paraGuardar` devolve `guardar: false` (a regra certa: rascunho vazio
   * apaga). A faixa continuava na tela porque o texto já estava em memória,
   * então quem tocasse em "Recuperar" na hora não via nada de errado — e quem
   * voltasse depois perdia o texto para sempre, com a única prova sumindo
   * junto.
   */
  const primeiraPintura = useRef(true);
  useEffect(() => {
    if (primeiraPintura.current) {
      primeiraPintura.current = false;
      return;
    }
    if (!aoGuardarRascunho) return;
    const t = setTimeout(() => {
      aoGuardarRascunho({
        texto,
        enquete: opcoes,
        perguntaAberta: caixinha,
        carimbarSemana: carimbar,
        camada,
      });
    }, 700);
    return () => clearTimeout(t);
  }, [texto, opcoes, caixinha, carimbar, camada, aoGuardarRascunho]);

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
      {/* ⚠️ **`overflow-hidden` NÃO É ENFEITE — sem ele a foto cobre o painel.**
          O `max-h-full` da imagem resolve contra a altura do contêiner, e num
          item flexível essa altura só fica definida DEPOIS do layout: no
          instante em que o painel de baixo cresceu (o campo de texto e a faixa
          do rascunho entraram), a imagem passou a pintar por cima da primeira
          coisa do painel. Medido: a faixa "Você tinha começado um story"
          aparecia cortada ao meio, e o botão "Recuperar" ficava INALCANÇÁVEL —
          a foto interceptava o toque. Foi a bancada que mostrou; nenhuma
          asserção estava perto disso. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
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
        {temRascunho && (
          /* ⚠️ Pergunta, e não preenche. E o "Descartar" some com o rascunho de
             vez: sem ele, dizer não uma vez faria a faixa voltar na abertura
             seguinte, para sempre. */
          <div className="flex items-center gap-2 rounded-2xl bg-white/12 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-white">
              Você tinha começado um story.
            </p>
            <button
              type="button"
              onClick={() => {
                setTexto(rascunho?.texto ?? "");
                setOpcoes(rascunho?.enquete ?? null);
                setCaixinha(!!rascunho?.perguntaAberta);
                setCarimbar(!!rascunho?.carimbarSemana);
                /* ⚠️ A camada volta pelo mesmo caminho: sem isto, ela escreve um
                   story marcado "só amigas", é interrompida, recupera — e
                   publica ABERTO sem reparar. */
                setCamada(camadaDoStory(rascunho?.camada));
                setOfereceu(true);
              }}
              className="press min-h-[44px] shrink-0 rounded-full bg-white px-3 text-[13px] font-semibold text-black"
            >
              Recuperar
            </button>
            <button
              type="button"
              onClick={() => {
                setOfereceu(true);
                aoGuardarRascunho?.(null);
              }}
              className="press min-h-[44px] shrink-0 px-2 text-[13px] text-white/80"
            >
              Descartar
            </button>
          </div>
        )}

        {/* ⚠️ O contador aparece a partir de 140 e não desde o zero: um número
            piscando ao lado de cada letra transforma escrever numa prova. */}
        <div className="relative">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, TEXTO_DO_STORY_MAX))}
            rows={2}
            placeholder="Escreva alguma coisa (opcional)"
            className="w-full resize-none rounded-2xl bg-white/95 px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground"
          />
          {texto.length >= 140 && (
            <span className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums text-muted-foreground">
              {TEXTO_DO_STORY_MAX - texto.length}
            </span>
          )}
        </div>

        {/* ⚠️ **QUEM VÊ, e a escolha é por PUBLICAÇÃO.** Duas opções e não três:
            `publico` fica de fora porque a fileira de bolinhas não tem rótulo de
            procedência nenhum — a paciente abriria achando que é de alguém que
            ela segue. O post pode ser público porque toda publicação de fora
            carrega "Sugerido para você"; o story não carrega. */}
        <div className="flex gap-2">
          {VISIBILIDADES_DO_STORY.map((v) => (
            <button
              key={v.chave}
              type="button"
              role="radio"
              aria-checked={camada === v.chave}
              onClick={() => setCamada(v.chave)}
              className={`press min-h-[44px] flex-1 rounded-2xl px-3 text-left ${
                camada === v.chave ? "bg-white text-black" : "bg-white/12 text-white"
              }`}
            >
              <span className="block text-[13px] font-semibold">{v.rotulo}</span>
              <span className="block text-xs opacity-70">{v.sub}</span>
            </button>
          ))}
        </div>

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
          <p className="text-center text-xs text-white/60">
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
                className="press text-xs text-white/80 underline underline-offset-2"
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
          <p className="text-center text-xs leading-snug text-white/75">
            Quem responder não aparece para você — a caixinha é anônima.
          </p>
        )}

        {/* ⚠️ **O CARROSSEL DE STORY, com teto de cinco.** O botão some quando
            elas acabam — um botão que não faz nada ensina que os botões desta
            tela não valem. */}
        <input
          ref={arquivoExtra}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f || maisFotos.length >= 4) return;
            /* ⚠️ **`prepararFotoDoStory`, e não a do post.** O story é 9:16 e o
               post é 4:5 — usar a preparação errada faria a foto extra sair com
               enquadramento diferente das outras do mesmo carrossel. */
            const pronta = await prepararFotoDoStory(f);
            if (pronta) setMaisFotos((v) => [...v, pronta]);
          }}
        />
        {/* ⚠️ Com vídeo, a faixa DIZ o que está indo. A tela mostra a capa
            PARADA, e sem esta linha ela pareceria um story de foto — e ela
            publicaria achando que o vídeo não entrou. */}
        {temVideo && (
          <p className="mb-2 rounded-2xl bg-white/15 px-3 py-2 text-[13px] text-white">
            🎬 Vídeo — a capa é o primeiro quadro
          </p>
        )}
        {/* ⚠️ **Com vídeo, o carrossel NÃO é oferecido.** Um story é ou o
            vídeo, ou a sequência de fotos: `imagem_path` é a capa nos dois
            casos, e a segunda foto viraria um story que nunca aparece. Botão
            que promete e não entrega é pior que botão ausente. */}
        {!temVideo && maisFotos.length < 4 && (
          <button
            type="button"
            onClick={() => arquivoExtra.current?.click()}
            className="press mb-2 min-h-[44px] w-full rounded-2xl bg-white/15 px-3 text-left text-[13px] text-white"
          >
            {maisFotos.length === 0
              ? "🖼 Juntar mais fotos"
              : `🖼 ${maisFotos.length + 1} fotos (tocar para mais)`}
          </button>
        )}

        {/* ⚠️ **MARCAR ALGUÉM NO STORY — e a lista é a MESMA do post.** Só quem
            ela já conhece; não há busca por nome, e nunca haverá. */}
        {amigasParaMarcar && amigasParaMarcar.length > 0 && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setAbrindoMarcar((v) => !v)}
              className="press min-h-[44px] w-full rounded-2xl bg-white/15 px-3 text-left text-[13px] text-white"
            >
              {marcadas.length === 0
                ? "👭 Marcar alguém"
                : `👭 ${marcadas.length} marcada${marcadas.length > 1 ? "s" : ""}`}
            </button>
            {abrindoMarcar && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-2xl bg-black/40 p-1">
                {amigasParaMarcar.map((a) => {
                  const marcada = marcadas.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setMarcadas((v) => (marcada ? v.filter((x) => x !== a.id) : [...v, a.id]))
                      }
                      className={`press flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2 text-left text-[13px] ${
                        marcada ? "bg-white/20 text-white" : "text-white/85"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                      {marcada && <span aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={enviando || (opcoes !== null && !enqueteValida(limparOpcoes(opcoes)))}
          onClick={() => {
            setEnviando(true);
            aoPublicar({
              texto: texto.trim(),
              camada,
              marcadas,
              maisFotos,
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
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
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
          {doGrupo && <p className="mt-0.5 text-xs text-muted-foreground">{doGrupo}</p>}
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
            className="press -ml-2 flex h-11 w-11 items-center justify-center text-xl leading-none"
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
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
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
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
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
          <h2 className="mx-4 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sem resposta
          </h2>
          <ul className="mt-1.5 flex flex-col gap-2 px-4">
            {semResposta.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border p-3">
                <p className="whitespace-pre-wrap text-[14px] leading-snug">{p.texto}</p>
                <p className="mt-1 text-xs text-muted-foreground">
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
                    <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                      {texto.length}/{LIMITE_DO_TEXTO}
                    </div>

                    {/* A mesma camada do compositor — a resposta é um post. */}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {VISIBILIDADES.map((v) => (
                        <button
                          key={v.chave}
                          type="button"
                          onClick={() => setVisibilidade(v.chave)}
                          className={`press rounded-full px-2.5 py-1 text-xs ${
                            visibilidade === v.chave
                              ? "btn-3d bg-primary text-primary-foreground"
                              : "pill-3d"
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
                      <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs leading-snug">
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
                      className="press flex h-11 min-w-[44px] items-center justify-center rounded-xl border border-border px-3 text-[15px] leading-none text-muted-foreground"
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
          <h2 className="mx-4 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                    className="press mt-1 inline-flex min-h-[44px] items-center text-[13px] font-medium text-primary"
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
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          {live.aoVivo ? "Ao vivo agora" : "Próxima live"}
        </p>
        <p className="truncate text-[14px] font-semibold leading-tight">{live.titulo}</p>
        {!live.aoVivo && (
          <p className="text-xs leading-tight text-muted-foreground">
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

/**
 * A LISTA DE QUEM ELA BLOQUEOU.
 *
 * ⚠️ **COMPONENTE PRÓPRIO por causa da BANCADA.** Ela era a única tela de
 * segurança da aba sem bancada — e os três estados que mais importam (falhou,
 * carregando, ninguém) não se fabricam numa conta de teste: seria preciso
 * bloquear alguém de verdade, ou derrubar a rede na hora certa. Enquanto vivia
 * dentro de `RedeNoApp`, olhar para ela era impossível.
 *
 * ⚠️ E ela NÃO busca nada: recebe tudo por prop, como o alerta de SOS e o
 * prontuário. É o que torna a bancada possível sem uma linha de mudança no
 * comportamento.
 */
/**
 * A lista de quem foi tirada de perto — bloqueadas, ou com o story escondido.
 *
 * ⚠️ **UMA tela para as duas, e não duas cópias.** O desenho é idêntico (lista
 * com foto, nome e um botão de desfazer) e as duas existem pela MESMA razão:
 * bloquear e esconder são gestos CALADOS, então sem uma lista a pessoa some e
 * desfazer exigiria lembrar de quem foi. Duas cópias divergiriam no primeiro
 * ajuste — e o estado que mais importa aqui (`"erro"`, que nunca pode virar
 * "você não tem ninguém") ficaria certo numa e errado na outra.
 */
/**
 * Uma grade com cabeçalho — os salvos, o que ela reagiu.
 *
 * ⚠️ **A grade é a MESMA `GradeDePosts` de todo lugar**, e não uma nova: a
 * proporção da célula já mudou uma vez (1:1 → 3:4, em 2025), e duas cópias
 * divergiriam na próxima.
 */
export function GradeSimples({
  titulo,
  vazio,
  posts,
  aoVoltar,
  aoAbrirPost,
  aoTentarDeNovo,
}: {
  titulo: string;
  vazio: string;
  /** `null` = carregando. `"erro"` = a leitura falhou. `[]` = nada. */
  posts: PostNaTela[] | "erro" | null;
  aoVoltar: () => void;
  aoAbrirPost: (id: string) => void;
  aoTentarDeNovo: () => void;
}) {
  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-1 bg-background/95 py-2 backdrop-blur">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-lg leading-none"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">{titulo}</h1>
      </header>
      {posts === "erro" ? (
        /* ⚠️ "Você não reagiu a nada" sobre uma falha de leitura é a frase mais
           errada possível para quem reagiu a duzentas publicações. */
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Não deu para carregar agora.</p>
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="press mt-3 min-h-[44px] rounded-full pill-3d px-5 text-[13px] font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      ) : posts === null ? (
        <div className="grid grid-cols-3 gap-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dc-esqueleto aspect-[3/4] w-full" />
          ))}
        </div>
      ) : (
        <GradeDePosts posts={posts} vazio={vazio} aoAbrirPost={aoAbrirPost} />
      )}
    </div>
  );
}

/**
 * O QUE ACONTECEU COM O QUE ELA DENUNCIOU.
 *
 * ⚠️ **A tela prometia "fica registrada para a gente olhar" e o desfecho nunca
 * voltava.** Denúncia sem retorno é a que ninguém faz duas vezes — e aqui a
 * alternativa é o bloqueio cego, que não deixa rastro nenhum para a plataforma:
 * a reincidente segue reincidindo, e a próxima paciente recebe a mesma coisa.
 *
 * ⚠️ **NADA aqui nomeia a pessoa denunciada.** Nem o nome, nem a foto, nem o
 * texto. Devolver quem foi transformaria a denúncia num canal de confronto — e
 * a denúncia é justamente o caminho de quem NÃO quer confrontar.
 */
export function MeusDesfechos({
  desfechos,
  aoVoltar,
  aoTentarDeNovo,
}: {
  desfechos:
    | { id: string; alvo: string; motivo: string; em: string; desfecho: string | null }[]
    | "erro"
    | null;
  aoVoltar: () => void;
  aoTentarDeNovo: () => void;
}) {
  const oQueFoi = (d: string | null) =>
    d === "removido"
      ? "A publicação saiu do ar."
      : d === "avisado"
        ? "A conta foi avisada."
        : d === "sem_acao"
          ? "Olhamos e não encontramos motivo para agir."
          : /* ⚠️ Sem a coluna do desfecho (banco antes do SQL), a linha continua
               à mostra — só sem o "o que aconteceu". Esconder as denúncias
               resolvidas por causa de um campo novo seria pior. */
            "Já foi analisada.";
  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-1 bg-background/95 py-2 backdrop-blur">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-lg leading-none"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Suas denúncias</h1>
      </header>
      <p className="px-1 pb-3 text-[13px] leading-snug text-muted-foreground">
        O que a gente fez com o que você denunciou. Ninguém sabe que foi você.
      </p>
      {desfechos === "erro" ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Não deu para carregar agora.</p>
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="press mt-3 min-h-[44px] rounded-full pill-3d px-5 text-[13px] font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      ) : desfechos === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dc-esqueleto h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : desfechos.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nada por aqui. O que você denunciar aparece assim que a gente olhar.
        </p>
      ) : (
        <ul className="space-y-2">
          {desfechos.map((d) => (
            <li key={d.id} className="rounded-xl border border-border p-3">
              <p className="text-[13px] font-semibold">{oQueFoi(d.desfecho)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {d.alvo === "perfil" ? "Perfil" : d.alvo === "story" ? "Story" : "Publicação"} ·{" "}
                {haQuantoPublicou(d.em, Date.now())}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ListaDeBloqueados({
  pessoas,
  aoVoltar,
  aoDesbloquear,
  aoTentarDeNovo,
  titulo = "Bloqueados",
  explicacao = "Quem está aqui não vê você na Comunidade, e não é avisada de nada.",
  vazio = "Você não bloqueou ninguém.",
  rotuloDaAcao = "Desbloquear",
}: {
  /** `null` = carregando. `"erro"` = a leitura falhou. `[]` = ninguém. */
  pessoas: PessoaNaLista[] | "erro" | null;
  aoVoltar: () => void;
  aoDesbloquear: (id: string) => void;
  aoTentarDeNovo: () => void;
  titulo?: string;
  /** ⚠️ Diz o que a lista faz E o que ela NÃO faz — é o que separa a proteção
      do confronto. Sem a frase, ela hesita em usar com alguém que conhece. */
  explicacao?: string;
  vazio?: string;
  rotuloDaAcao?: string;
}) {
  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-1 bg-background/95 py-2 backdrop-blur">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-lg leading-none"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">{titulo}</h1>
      </header>
      {/* ⚠️ A explicação diz o que o bloqueio faz e o que ele NÃO faz — a
          pessoa bloqueada nunca é avisada, e isso é o que separa a proteção do
          confronto. Sem a frase, ela hesita em bloquear alguém que conhece da
          vida real. */}
      <p className="px-1 pb-3 text-[13px] leading-snug text-muted-foreground">{explicacao}</p>
      {pessoas === "erro" ? (
        /* ⚠️ "Você não bloqueou ninguém" sobre uma falha de leitura a faria
           bloquear de novo — ou desistir de bloquear. */
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Não deu para carregar a lista agora.</p>
          <button
            type="button"
            onClick={aoTentarDeNovo}
            className="press mt-3 min-h-[44px] rounded-full pill-3d px-5 text-[13px] font-semibold"
          >
            Tentar de novo
          </button>
        </div>
      ) : pessoas === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dc-esqueleto h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : pessoas.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul>
          {pessoas.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 py-2">
              <Foto url={p.avatarUrl} nome={p.nome} lado={40} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{p.nome}</span>
              <button
                type="button"
                onClick={() => aoDesbloquear(p.id)}
                className="press min-h-[44px] shrink-0 rounded-full pill-3d px-4 text-[13px] font-semibold"
              >
                {rotuloDaAcao}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
