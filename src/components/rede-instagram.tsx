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
import { useEffect, useMemo, useState } from "react";
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
import { emojiDaReacao, REACOES, totalDeReacoes, type TipoDeReacao } from "@/lib/rede-social";
import type { PerfilNaTela, PostNaTela } from "@/lib/rede-social.functions";

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

      {post.imagemUrl && (
        /* ⚠️ TETO DE 4:5, e não a altura natural da foto.
           O Instagram corta o post do feed nessa proporção, e a razão é
           medida: sem teto, uma foto de celular em pé (9:16) vira um post de
           ~700px num aparelho de 393 — a pessoa rola a tela inteira e vê UM
           post. A bancada mostrou isso com fotos 3:4, que já ficaram altas
           demais; com 9:16 seria o dobro.
           `object-cover` corta o excedente pelo centro, que é o que eles
           fazem. `RAZAO_DO_POST` é a proporção publicada, 1080×1350. */
        <div
          className="w-full overflow-hidden bg-muted/40"
          style={{ aspectRatio: String(RAZAO_DO_POST) }}
        >
          <img src={post.imagemUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

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
}) {
  const doAlgoritmo = useMemo(() => new Set(sugeridos), [sugeridos]);

  return (
    <div className="px-4">
      <header className="flex h-11 items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Comunidade</h1>
        {/* Ações à direita, como no modelo: publicar primeiro, seções depois. */}
        <div className="flex items-center gap-3">
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

      <FileiraDeStories stories={stories} />

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
}: {
  perfil: PerfilNaTela;
  posts: PostNaTela[];
  seguindo?: number;
  aoSeguir?: () => void;
  aoVoltar?: () => void;
  aoAbrirPost?: (id: string) => void;
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
                <Numero valor={perfil.meusSeguidores ?? 0} rotulo="seguidores" />
                <Numero valor={seguindo} rotulo="seguindo" />
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
export function RedeNoApp({
  careMode = false,
  onAbrirSecoes,
}: {
  careMode?: boolean;
  onAbrirSecoes?: () => void;
}) {
  const [posts, setPosts] = useState<PostNaTela[]>([]);
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(null);
  const [doPerfil, setDoPerfil] = useState<PostNaTela[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function token() {
    const { supabase } = await import("@/integrations/supabase/client");
    const s = await supabase.auth.getSession();
    return s.data.session?.access_token ?? null;
  }

  async function carregarFeed() {
    try {
      const t = await token();
      if (!t) return;
      const { meuFeed } = await import("@/lib/rede-social.functions");
      const r = await meuFeed({ data: { accessToken: t } });
      if (r.ok) setPosts(r.posts);
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
    setAbertoEm(id);
    setPerfil(null);
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
        setAbertoEm(null);
      }
    } catch {
      setAbertoEm(null);
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

  if (careMode) return null;

  if (abertoEm && perfil) {
    return (
      <TelaDePerfil
        perfil={perfil}
        posts={doPerfil}
        aoVoltar={() => setAbertoEm(null)}
        aoSeguir={seguir}
      />
    );
  }

  if (carregando) return <div className="skeleton h-80 rounded-2xl" />;

  return <TelaPrincipal posts={posts} aoReagir={reagir} aoAbrirPerfil={abrirPerfil} />;
}
