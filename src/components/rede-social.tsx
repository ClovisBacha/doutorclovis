/**
 * A REDE SOCIAL — as telas.
 *
 * Feed, publicar, reagir, perfil e busca. As réguas moram em
 * `src/lib/rede-social.ts` (testadas) e as travas em
 * `rede-social.functions.ts` (testadas por mutação). Aqui fica o desenho.
 *
 * ⚠️ **Não existe caixa de comentário em lugar nenhum desta tela**, e é
 * decisão de produto: de 1.098 respostas com conselho em fóruns de gestação,
 * 20,9% estavam erradas e 5,5% eram potencialmente danosas. Reação dá quase
 * toda a sensação de comunidade com uma fração do risco.
 *
 * ⚠️ **E não existe contador de seguidores na tela de ninguém além da dona.**
 * Placar de audiência num app de gestação de alto risco mede popularidade num
 * momento em que ela já está sendo medida clinicamente.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  emojiDaReacao,
  LIMITE_DA_BIO,
  LIMITE_DO_TEXTO,
  postEhValido,
  REACOES,
  resumoDeReacoes,
  totalDeReacoes,
  VISIBILIDADES,
  type TipoDeReacao,
  type Visibilidade,
} from "@/lib/rede-social";
import type { PerfilNaTela, PostNaTela } from "@/lib/rede-social.functions";

/** Reduz a foto no celular antes de subir — 512px é o padrão do app. */
const LADO = 512;
async function prepararFoto(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `${d} dias`;
}

function Avatar({
  url,
  nome,
  tamanho = 40,
}: {
  url: string | null;
  nome: string;
  tamanho?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O CARTÃO DO POST
   ══════════════════════════════════════════════════════════════════════════ */

export function CartaoDoPost({
  post,
  aoReagir,
  aoApagar,
  aoAbrirPerfil,
}: {
  post: PostNaTela;
  aoReagir: (tipo: TipoDeReacao | null) => void;
  aoApagar?: () => void;
  aoAbrirPerfil?: (id: string) => void;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const total = totalDeReacoes(post.reacoes);
  const resumo = resumoDeReacoes(post.reacoes);
  const rotuloVis = VISIBILIDADES.find((v) => v.chave === post.visibilidade)?.rotulo ?? "";

  return (
    <article className="rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2.5 p-3.5">
        <button
          type="button"
          onClick={() => aoAbrirPerfil?.(post.autorId)}
          className="press flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Avatar url={post.autorAvatar} nome={post.autorNome} />
          <span className="min-w-0">
            <span className="block truncate font-semibold leading-tight">{post.autorNome}</span>
            <span className="block text-xs text-muted-foreground">
              {haQuanto(post.criadoEm)}
              {/* A camada aparece SÓ para a autora: quem lê não precisa saber
                  que aquilo era "só para as amigas" — saber disso muda como se
                  lê o post, e é informação dela sobre a rede dela. */}
              {post.souAAutora && rotuloVis ? ` · ${rotuloVis}` : ""}
            </span>
          </span>
        </button>
        {post.souAAutora && aoApagar && (
          <button
            type="button"
            onClick={aoApagar}
            aria-label="Apagar publicação"
            className="press shrink-0 rounded-full px-2 py-1 text-lg leading-none text-muted-foreground"
          >
            ×
          </button>
        )}
      </header>

      {post.imagemUrl && (
        <img src={post.imagemUrl} alt="" className="w-full object-cover" loading="lazy" />
      )}

      {post.texto && (
        <p className="whitespace-pre-wrap px-3.5 pt-3 text-[15px] leading-snug">{post.texto}</p>
      )}

      {/* ─── AS REAÇÕES ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-3.5">
        <button
          type="button"
          onClick={() => setEscolhendo((v) => !v)}
          className={`press flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
            post.minhaReacao
              ? "border-primary/40 bg-primary/10 font-semibold text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          <span className="text-base leading-none">
            {post.minhaReacao ? emojiDaReacao(post.minhaReacao) : "🤍"}
          </span>
          {post.minhaReacao ? REACOES.find((r) => r.tipo === post.minhaReacao)?.rotulo : "Reagir"}
        </button>

        {total > 0 && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="text-base leading-none">{resumo.join("")}</span>
            <span className="tabular-nums">{total}</span>
          </span>
        )}
      </div>

      {escolhendo && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3.5 py-3">
          {REACOES.map((r) => (
            <button
              key={r.tipo}
              type="button"
              onClick={() => {
                /* Tocar na mesma TIRA — é `aoReagir` da régua, e é o que
                   impede alguém de encher um post com cinco emojis. */
                aoReagir(post.minhaReacao === r.tipo ? null : r.tipo);
                setEscolhendo(false);
              }}
              className={`press flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm ${
                post.minhaReacao === r.tipo ? "bg-primary/15 font-semibold" : "bg-muted/60"
              }`}
            >
              <span className="text-base leading-none">{r.emoji}</span>
              {r.rotulo}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PUBLICAR
   ══════════════════════════════════════════════════════════════════════════ */

export function Publicar({ aoPublicar }: { aoPublicar: () => void }) {
  const [texto, setTexto] = useState("");
  /* Uma LISTA, e a primeira é a capa. Um estado só para "a foto" e outro para
     "as outras" divergiria na hora de remover a primeira. */
  const [fotos, setFotos] = useState<string[]>([]);
  const [vis, setVis] = useState<Visibilidade>("amigas");
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const podeEnviar = postEhValido({ texto, temImagem: fotos.length > 0 }) && !enviando;

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { publicarPost } = await import("@/lib/rede-social.functions");
      const r = await publicarPost({
        data: {
          accessToken: token,
          texto: texto.trim() || null,
          imagem: fotos[0] ?? null,
          extras: fotos.slice(1),
          visibilidade: vis,
        },
      });
      if (!r.ok) {
        toast.error(
          r.motivo === "imagem"
            ? "Não deu para subir a foto. Tente de novo."
            : "Não deu para publicar.",
        );
        return;
      }
      setTexto("");
      setFotos([]);
      aoPublicar();
      toast.success("Publicado 💛");
    } catch {
      toast.error("Não deu para publicar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DO_TEXTO))}
        rows={2}
        placeholder="Como você está hoje?"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />

      {fotos.length > 0 && (
        /* Fila horizontal com as escolhidas. A PRIMEIRA leva o selo "capa" —
           sem ele, ninguém saberia qual vai aparecer na grade do perfil. */
        <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {fotos.map((f, n) => (
            <div key={n} className="relative shrink-0">
              <img src={f} alt="" className="h-24 w-24 rounded-xl object-cover" />
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

      {/* ⚠️ A camada é escolhida ANTES de publicar, e fica à vista. Um seletor
          escondido atrás de um menu faz a pessoa publicar no padrão sem
          perceber — e aqui o padrão é o mais fechado (`amigas`), então o erro
          seria publicar para menos gente do que ela queria, nunca para mais. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {VISIBILIDADES.map((v) => (
          <button
            key={v.chave}
            type="button"
            onClick={() => setVis(v.chave)}
            className={`press rounded-full px-2.5 py-1 text-xs ${
              vis === v.chave ? "bg-primary/15 font-semibold text-primary" : "bg-muted/60"
            }`}
          >
            {v.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const d = await prepararFoto(f);
            if (!d) toast.error("Não consegui ler essa imagem.");
            /* Teto de dez, como no original — e conferido AQUI, porque o
               servidor recusa o post inteiro se passar, e recusar depois de
               ela escolher onze é pior que não deixar escolher a décima
               primeira. */ else if (fotos.length >= 10) toast.error("Dez fotos por publicação.");
            else setFotos((fs) => [...fs, d]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => arquivo.current?.click()}
          className="press rounded-xl border border-border px-3 py-2 text-sm"
        >
          📷 {fotos.length > 0 ? `Foto (${fotos.length})` : "Foto"}
        </button>
        <button
          type="button"
          onClick={enviar}
          disabled={!podeEnviar}
          className="press flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {enviando ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O FEED
   ══════════════════════════════════════════════════════════════════════════ */

export type BancadaDaRede = {
  posts: PostNaTela[];
  perfil?: PerfilNaTela;
  pedidos?: { id: string; nome: string; avatarUrl: string | null }[];
};

export function FeedDaRede({
  careMode = false,
  bancada,
  aoAbrirPerfil,
}: {
  careMode?: boolean;
  bancada?: BancadaDaRede;
  aoAbrirPerfil?: (id: string) => void;
}) {
  const [posts, setPosts] = useState<PostNaTela[]>(bancada?.posts ?? []);
  const [carregando, setCarregando] = useState(!bancada);

  async function recarregar() {
    if (bancada) return;
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { meuFeed } = await import("@/lib/rede-social.functions");
      const r = await meuFeed({ data: { accessToken: token } });
      if (r.ok) setPosts(r.posts);
    } catch {
      /* Feed vazio é melhor que erro na tela: ela não veio buscar um erro. */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (bancada || careMode) {
      setCarregando(false);
      return;
    }
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode, bancada]);

  async function reagir(post: PostNaTela, tipo: TipoDeReacao | null) {
    /* Otimista: a reação é o gesto mais leve da tela e esperar o servidor faz
       o botão parecer travado. Se falhar, a próxima recarga corrige. */
    setPosts((ps) =>
      ps.map((p) => {
        if (p.id !== post.id) return p;
        const c = { ...p.reacoes };
        if (p.minhaReacao) c[p.minhaReacao] = Math.max(0, (c[p.minhaReacao] ?? 1) - 1);
        if (tipo) c[tipo] = (c[tipo] ?? 0) + 1;
        return { ...p, reacoes: c, minhaReacao: tipo };
      }),
    );
    if (bancada) return;
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { reagir: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: token, postId: post.id, tipo } });
    } catch {
      void recarregar();
    }
  }

  async function apagar(post: PostNaTela) {
    setPosts((ps) => ps.filter((p) => p.id !== post.id));
    if (bancada) return;
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { apagarPost } = await import("@/lib/rede-social.functions");
      await apagarPost({ data: { accessToken: token, postId: post.id } });
    } catch {
      void recarregar();
    }
  }

  if (careMode) return null;

  return (
    <div className="space-y-4">
      <Publicar aoPublicar={recarregar} />

      {carregando && <div className="skeleton h-64 rounded-3xl" />}

      {!carregando && posts.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Ainda não há nada por aqui. Publique alguma coisa, ou siga alguém 💛
        </p>
      )}

      {posts.map((p) => (
        <CartaoDoPost
          key={p.id}
          post={p}
          aoReagir={(t) => reagir(p, t)}
          aoApagar={() => apagar(p)}
          aoAbrirPerfil={aoAbrirPerfil}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AS CONFIGURAÇÕES DO PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

export function ConfiguracoesDoPerfil({
  careMode = false,
  bancada,
}: {
  careMode?: boolean;
  bancada?: BancadaDaRede;
}) {
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(bancada?.perfil ?? null);
  const [pedidos, setPedidos] = useState(bancada?.pedidos ?? []);
  const [bio, setBio] = useState(bancada?.perfil?.bio ?? "");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    if (bancada) return;
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { meuPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await meuPerfilSocial({ data: { accessToken: token } });
      if (r.ok) {
        setPerfil(r.perfil);
        setBio(r.perfil.bio ?? "");
        setPedidos(r.pedidos as typeof pedidos);
      }
    } catch {
      /* Sem perfil a seção some. */
    }
  }

  useEffect(() => {
    if (careMode) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode]);

  const totalPedidos = useMemo(() => pedidos.length, [pedidos]);

  if (careMode || !perfil) return null;

  async function salvar(mudanca: { publico?: boolean; bio?: string | null }) {
    setSalvando(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await salvarPerfilSocial({ data: { accessToken: token, ...mudanca } });
      if (!r.ok) {
        toast.error("Não deu para salvar.");
        return;
      }
      setPerfil((p) => (p ? { ...p, ...mudanca, bio: mudanca.bio ?? p.bio } : p));
      toast.success("Salvo 💛");
    } catch {
      toast.error("Não deu para salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function responder(seguidorId: string, aceitar: boolean) {
    setPedidos((ps) => ps.filter((p) => p.id !== seguidorId));
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { responderPedido } = await import("@/lib/rede-social.functions");
      await responderPedido({ data: { accessToken: token, seguidorId, aceitar } });
    } catch {
      void carregar();
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <Avatar url={perfil.avatarUrl} nome={perfil.nome} tamanho={52} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{perfil.nome}</p>
            {/* ⚠️ O número de seguidores aparece SÓ aqui, na tela dela. Nunca no
                perfil que os outros veem — placar público de audiência mede
                popularidade num momento em que ela já está sendo medida
                clinicamente. */}
            <p className="text-xs text-muted-foreground">
              {perfil.meusSeguidores === 1
                ? "1 pessoa te acompanha"
                : `${perfil.meusSeguidores ?? 0} pessoas te acompanham`}
            </p>
          </div>
        </div>

        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, LIMITE_DA_BIO))}
          onBlur={() => bio !== (perfil.bio ?? "") && salvar({ bio: bio || null })}
          rows={2}
          placeholder="Uma linha sobre você"
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">Perfil público</h3>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {perfil.publico
                ? "Qualquer pessoa no app pode te achar e te acompanhar. Cada publicação continua com a camada que você escolher."
                : "Só quem você aceitar te acompanha, e você não aparece na busca."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={perfil.publico}
            disabled={salvando}
            onClick={() => salvar({ publico: !perfil.publico })}
            className={`press mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
              perfil.publico ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                perfil.publico ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {totalPedidos > 0 && (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold">
            {totalPedidos === 1 ? "1 pedido" : `${totalPedidos} pedidos`}
          </h3>
          <ul className="mt-2 space-y-2">
            {pedidos.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <Avatar url={p.avatarUrl} nome={p.nome} tamanho={36} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nome}</span>
                <button
                  type="button"
                  onClick={() => responder(p.id, false)}
                  className="press shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs"
                >
                  Agora não
                </button>
                <button
                  type="button"
                  onClick={() => responder(p.id, true)}
                  className="press shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
