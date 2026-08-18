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
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  emojiDaReacao,
  LIMITE_DA_BIO,
  REACOES,
  textoDoAviso,
  totalDeReacoes,
  type TipoDeReacao,
} from "@/lib/rede-social";
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

export function FileiraDeStories({
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
}

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
function Carrossel({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  if (urls.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={caixa}
        onScroll={(e) => {
          const el = e.currentTarget;
          const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (n !== i) setI(n);
        }}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ aspectRatio: String(RAZAO_DO_POST) }}
      >
        {urls.map((u, n) => (
          <div key={n} className="w-full shrink-0 snap-center overflow-hidden bg-muted/40">
            <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>

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

export function PostInstagram({
  post,
  aoReagir,
  aoAbrirPerfil,
  sugerido = false,
}: {
  post: PostNaTela;
  aoReagir: (t: TipoDeReacao | null) => void;
  aoAbrirPerfil?: (id: string) => void;
  /** Veio do algoritmo, não de quem ela segue. */
  sugerido?: boolean;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const total = totalDeReacoes(post.reacoes);
  /* Post antigo (anterior ao carrossel) tem `imagens` vazio e só
     `imagemUrl` — o recuo faz os dois terem a mesma forma aqui. */
  const fotos = post.imagens?.length ? post.imagens : post.imagemUrl ? [post.imagemUrl] : [];

  return (
    <article className="-mx-4 border-b border-border pb-3">
      <header className="flex items-center gap-2.5 px-4 py-2.5">
        <button
          type="button"
          onClick={() => aoAbrirPerfil?.(post.autorId)}
          className="press flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Foto url={post.autorAvatar} nome={post.autorNome} lado={AVATAR_DO_POST} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-tight">
              {post.autorNome}
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
          </span>
        </button>
      </header>

      {post.imagemUrl && <Carrossel urls={fotos} />}

      {/* A linha de ações vem LOGO ABAIXO da imagem, antes da legenda — é a
          ordem deles, e ela existe porque a ação é o que a tela quer que
          aconteça primeiro. */}
      <div className="flex items-center gap-3 px-4 pt-2.5">
        <button
          type="button"
          onClick={() => setEscolhendo((v) => !v)}
          aria-label="Reagir"
          className="press text-[22px] leading-none"
        >
          {post.minhaReacao ? emojiDaReacao(post.minhaReacao) : "🤍"}
        </button>
        {total > 0 && (
          <span className="text-[13px] font-semibold tabular-nums">
            {total} {total === 1 ? "reação" : "reações"}
          </span>
        )}
      </div>

      {escolhendo && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-2">
          {REACOES.map((r) => (
            <button
              key={r.tipo}
              type="button"
              onClick={() => {
                aoReagir(post.minhaReacao === r.tipo ? null : r.tipo);
                setEscolhendo(false);
              }}
              className={`press rounded-full px-2.5 py-1 text-[13px] ${
                post.minhaReacao === r.tipo ? "bg-primary/15 font-semibold" : "bg-muted/60"
              }`}
            >
              {r.emoji} {r.rotulo}
            </button>
          ))}
        </div>
      )}

      {post.texto && (
        <p className="px-4 pt-1.5 text-[14px] leading-snug">
          <span className="font-semibold">{post.autorNome}</span>{" "}
          <span className="whitespace-pre-wrap">{post.texto}</span>
        </p>
      )}
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A TELA PRINCIPAL
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaPrincipal({
  posts,
  stories = [],
  sugeridos = [],
  aoReagir,
  aoAbrirPerfil,
  aoPublicar,
  aoAbrirSecoes,
  aoTocarStory,
  aoAbrirAtividade,
  novasAtividades = 0,
}: {
  posts: PostNaTela[];
  stories?: Story[];
  /** Ids dos posts que vieram do algoritmo, não de quem ela segue. */
  sugeridos?: string[];
  aoReagir: (post: PostNaTela, t: TipoDeReacao | null) => void;
  aoAbrirPerfil?: (id: string) => void;
  aoPublicar?: () => void;
  /**
   * As outras seções da Comunidade — chá de bebê, álbum, amigas, nome do bebê.
   *
   * ⚠️ Elas saíram da primeira tela e viraram um botão porque o dono pediu que
   * a aba abrisse no FEED. É a régua do Instagram, e ela está certa: uma aba
   * social que abre num menu de seções cobra um toque a mais para chegar na
   * única coisa que muda sozinha. O que estava ali continua a um toque, do
   * outro lado do cabeçalho.
   */
  aoAbrirSecoes?: () => void;
  /** Toque numa bolinha da fileira. Recebe o id do AUTOR, não do story. */
  aoTocarStory?: (autorId: string) => void;
  aoAbrirAtividade?: () => void;
  /** Quantas não vistas. O emblema mostra o NÚMERO, não um ponto — a pergunta
      que ela faz é quantas, não se há. Mesma régua do mascote da home. */
  novasAtividades?: number;
}) {
  const doAlgoritmo = useMemo(() => new Set(sugeridos), [sugeridos]);

  return (
    <div className="px-4">
      <header className="flex h-11 items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Comunidade</h1>
        {/* Ações à direita, como no modelo: publicar primeiro, seções depois. */}
        <div className="flex items-center gap-3">
          {aoAbrirAtividade && (
            <button
              type="button"
              onClick={aoAbrirAtividade}
              aria-label={novasAtividades > 0 ? `Atividade, ${novasAtividades} novas` : "Atividade"}
              className="press relative text-xl leading-none"
            >
              ♡
              {novasAtividades > 0 && (
                <span
                  aria-hidden
                  className="absolute -right-1.5 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white"
                >
                  {novasAtividades > 9 ? "9+" : novasAtividades}
                </span>
              )}
            </button>
          )}
          {aoPublicar && (
            <button
              type="button"
              onClick={aoPublicar}
              aria-label="Publicar"
              className="press text-2xl leading-none"
            >
              ＋
            </button>
          )}
          {aoAbrirSecoes && (
            <button
              type="button"
              onClick={aoAbrirSecoes}
              aria-label="Outras seções da comunidade"
              className="press text-xl leading-none"
            >
              ⊞
            </button>
          )}
        </div>
      </header>

      <FileiraDeStories stories={stories} aoTocar={aoTocarStory} />

      {posts.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ainda não há nada por aqui 💛
        </p>
      ) : (
        posts.map((p) => (
          <PostInstagram
            key={p.id}
            post={p}
            sugerido={doAlgoritmo.has(p.id)}
            aoReagir={(t) => aoReagir(p, t)}
            aoAbrirPerfil={aoAbrirPerfil}
          />
        ))
      )}
    </div>
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

export function TelaDePerfil({
  perfil,
  posts,
  seguindo = 0,
  aoSeguir,
  aoVoltar,
  aoAbrirPost,
  aoAbrirLista,
}: {
  perfil: PerfilNaTela;
  posts: PostNaTela[];
  seguindo?: number;
  aoSeguir?: () => void;
  aoVoltar?: () => void;
  aoAbrirPost?: (id: string) => void;
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
}) {
  const [aba, setAba] = useState<AbaDoPerfil>("grade");

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
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{perfil.nome}</h1>
      </header>

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
                <button
                  type="button"
                  onClick={() => aoAbrirLista?.("seguidores")}
                  className="press"
                >
                  <Numero valor={perfil.meusSeguidores ?? 0} rotulo="seguidores" />
                </button>
                <button type="button" onClick={() => aoAbrirLista?.("seguindo")} className="press">
                  <Numero valor={seguindo} rotulo="seguindo" />
                </button>
              </>
            )}
          </div>
        </div>

        {perfil.bio && <p className="mt-3 text-[14px] leading-snug">{perfil.bio}</p>}

        <button
          type="button"
          onClick={aoSeguir}
          disabled={perfil.souEu || perfil.meuVinculo === "pendente"}
          className={`press mt-3 w-full rounded-lg py-1.5 text-[14px] font-semibold ${
            perfil.meuVinculo || perfil.souEu
              ? "border border-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {rotuloDoBotao}
        </button>
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
        naGrade.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma publicação ainda.
          </p>
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: VAO_DA_GRADE }}
          >
            {naGrade.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => aoAbrirPost?.(p.id)}
                /* ⚠️ `aspect-ratio` de 3:4, a proporção NOVA da grade. A antiga
                   era quadrada, e mudou em 2025 — quem construir 1:1 hoje corta
                   a foto vertical, que é a maioria. */
                style={{ aspectRatio: String(RAZAO_DA_GRADE) }}
                className="press relative overflow-hidden bg-muted/60"
              >
                {p.imagemUrl ? (
                  <img
                    src={p.imagemUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
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
        )
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Os marcos da gestação vão aparecer aqui 💛
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
  | { t: "post"; id: string };

export function RedeNoApp({
  careMode = false,
  onAbrirSecoes,
}: {
  careMode?: boolean;
  onAbrirSecoes?: () => void;
}) {
  const [posts, setPosts] = useState<PostNaTela[]>([]);
  const [onde, setOnde] = useState<Onde>({ t: "feed" });
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(null);
  const [doPerfil, setDoPerfil] = useState<PostNaTela[]>([]);
  const [gente, setGente] = useState<PessoaNaLista[]>([]);
  const [oPost, setOPost] = useState<PostNaTela | null>(null);
  const [bolhas, setBolhas] = useState<BolhaDeStory[]>([]);
  const [vendoStory, setVendoStory] = useState<BolhaDeStory | null>(null);
  const [euId, setEuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const arquivoDoStory = useRef<HTMLInputElement>(null);

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
      const [r, st, meu] = await Promise.all([
        mod.meuFeed({ data: { accessToken: t } }),
        mod.storiesDoFeed({ data: { accessToken: t } }),
        mod.meuPerfilSocial({ data: { accessToken: t } }),
      ]);
      if (r.ok) setPosts(r.posts);
      if (st.ok) setBolhas(st.bolhas);
      if (meu.ok) setEuId(meu.perfil.id);
    } catch {
      /* Feed vazio é melhor que erro: ela não veio buscar um erro. */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (careMode) {
      setCarregando(false);
      return;
    }
    void carregarFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode]);

  async function abrirPerfil(id: string) {
    setPerfil(null);
    setOnde({ t: "perfil", id });
    try {
      const t = await token();
      if (!t) return;
      const { verPerfil } = await import("@/lib/rede-social.functions");
      const r = await verPerfil({ data: { accessToken: t, alvoId: id } });
      if (r.ok) {
        setPerfil(r.perfil);
        setDoPerfil(r.posts);
      } else {
        /* `indisponivel` cobre bloqueio, Modo Cuidado e perfil inexistente com
           a mesma resposta — e a tela não conta qual foi. */
        setOnde({ t: "feed" });
      }
    } catch {
      setOnde({ t: "feed" });
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

  async function publicarStory(dataUrl: string) {
    try {
      const t = await token();
      if (!t) return;
      const { publicarStory: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({ data: { accessToken: t, imagem: dataUrl, texto: null } });
      if (r.ok) void carregarFeed();
    } catch {
      /* A fileira não muda; ela tenta de novo. */
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

  if (careMode) return null;

  if (vendoStory) {
    return (
      <VisorDeStory bolha={vendoStory} aoFechar={() => setVendoStory(null)} aoVer={marcarVisto} />
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
      />
    );
  }

  if (onde.t === "post" && oPost) {
    return (
      <TelaDoPost
        post={oPost}
        aoReagir={(t) => reagir(oPost, t)}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoAbrirPerfil={abrirPerfil}
      />
    );
  }

  if (onde.t === "perfil" && perfil) {
    return (
      <TelaDePerfil
        perfil={perfil}
        posts={doPerfil}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoSeguir={perfil.souEu ? () => setOnde({ t: "editar" }) : seguir}
        aoAbrirPost={abrirPost}
        aoAbrirLista={perfil.souEu ? abrirLista : undefined}
      />
    );
  }

  if (carregando) return <div className="skeleton h-80 rounded-2xl" />;

  /* A MINHA bolinha entra sempre, mesmo sem story — é o convite para publicar.
     Se o servidor já a devolveu (porque tenho story vivo), ela não é
     duplicada. */
  const fileira: Story[] = [
    ...(euId && !bolhas.some((b) => b.autorId === euId)
      ? [{ id: euId, nome: "Seu story", avatarUrl: perfil?.avatarUrl ?? null, novo: false }]
      : []),
    ...bolhas.map((b) => ({
      id: b.autorId,
      nome: b.autorId === euId ? "Seu story" : b.autorNome,
      avatarUrl: b.autorAvatar,
      novo: b.novo,
    })),
  ];

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
          const d = await prepararAvatar(f);
          if (d) void publicarStory(d);
        }}
      />
      <TelaPrincipal
        posts={posts}
        stories={fileira}
        aoReagir={reagir}
        aoAbrirPerfil={abrirPerfil}
        aoAbrirSecoes={onAbrirSecoes}
        aoTocarStory={verStory}
      />
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

export type PessoaNaLista = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  sigo: "ativo" | "pendente" | null;
  souEu: boolean;
};

export function ListaDeGente({
  titulo,
  gente,
  aoVoltar,
  aoAbrirPerfil,
}: {
  titulo: string;
  gente: PessoaNaLista[];
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
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
        <h1 className="text-[16px] font-semibold">{titulo}</h1>
      </header>
      {gente.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Ninguém por aqui ainda.</p>
      ) : (
        <ul>
          {gente.map((p) => (
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
   O POST SOZINHO — o que a grade abre
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaDoPost({
  post,
  aoReagir,
  aoVoltar,
  aoAbrirPerfil,
}: {
  post: PostNaTela;
  aoReagir: (t: TipoDeReacao | null) => void;
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
      <PostInstagram post={post} aoReagir={aoReagir} aoAbrirPerfil={aoAbrirPerfil} />
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
}: {
  bolha: BolhaDeStory;
  aoFechar: () => void;
  aoVer?: (storyId: string) => void;
}) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
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
    if (pausado || !atual) return;
    const t = setTimeout(() => {
      if (i + 1 < bolha.stories.length) setI(i + 1);
      else aoFechar();
    }, DURACAO_DO_STORY);
    return () => clearTimeout(t);
  }, [i, pausado, atual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
                animationPlayState: pausado ? "paused" : "running",
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
}: {
  itens: AtividadeNaTela[];
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
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
                {a.postCapa && (
                  <button
                    type="button"
                    onClick={() => a.postId && aoAbrirPost?.(a.postId)}
                    className="press shrink-0"
                  >
                    <img src={a.postCapa} alt="" className="h-10 w-10 rounded object-cover" />
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
