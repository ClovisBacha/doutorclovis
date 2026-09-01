import { createFileRoute } from "@tanstack/react-router";
import { codificarFoto } from "@/lib/codificar-imagem";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAlbumByToken, addAlbumPostPublic, type AlbumPostPublico } from "@/lib/family.functions";
import { ConviteDoApp } from "@/components/convite-do-app";

export const Route = createFileRoute("/album/$token")({
  head: () => ({
    meta: [
      { title: "Álbum Familiar — Obstétrica" },
      { name: "description", content: "Álbum de memórias da gestação." },
    ],
  }),
  component: AlbumPage,
});

function AlbumPage() {
  const { token } = Route.useParams();
  const [posts, setPosts] = useState<AlbumPostPublico[]>([]);
  /** O código dela, para o rodapé de convite. `null` em Modo Cuidado. */
  const [codigoDeConvite, setCodigoDeConvite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState("");
  const [caption, setCaption] = useState("");
  const [emoji, setEmoji] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [token]);

  async function load() {
    setLoading(true);
    try {
      const res = await getAlbumByToken({ data: { token } });
      if (!res.ok) {
        setError(res.error ?? "Erro desconhecido.");
        return;
      }
      setPosts(res.posts);
      setCodigoDeConvite(res.codigoDeConvite ?? null);
    } catch {
      // Falha de rede: sem isso a tela ficava em "Carregando álbum…" p/ sempre.
      setError("Não foi possível carregar o álbum. Verifique a conexão e recarregue.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageData(codificarFoto(canvas, 0.75));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!authorName.trim()) return;
    setSubmitting(true);
    try {
      const res = await addAlbumPostPublic({
        data: {
          token,
          authorName: authorName.trim(),
          caption: caption || null,
          imageData,
          emoji: emoji || null,
        },
      });
      if (res.ok) {
        setCaption("");
        setEmoji("");
        setImageData(null);
        if (fileRef.current) fileRef.current.value = "";
        setSubmitted(true);
        await load();
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        toast.error(res.error ?? "Não foi possível publicar. Tente de novo.");
      }
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      // Antes, um throw deixava o botão preso em "Salvando..." para sempre.
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando álbum…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-3xl border border-border bg-card p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="font-serif text-xl font-semibold mb-2">Link inválido</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/60 to-background px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center">
          <p className="text-4xl mb-2">📷</p>
          <h1 className="font-serif text-3xl font-semibold">Álbum Familiar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Um espaço privado para memórias especiais desta gestação
          </p>
        </div>

        {/* Add post form */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Adicionar memória</h2>
          <div className="space-y-3">
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Seu nome *"
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
            />
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary"
            />
            {imageData && (
              <div className="relative inline-block">
                <img
                  src={imageData}
                  alt="pré-visualização da imagem"
                  className="h-32 rounded-xl object-cover"
                />
                <button
                  onClick={() => {
                    setImageData(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            )}
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Legenda (opcional)..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {["💕", "🤰", "👶", "🌸", "⭐", "🎀", "💙", "🌈"].map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(emoji === e ? "" : e)}
                  className={`rounded-xl p-2 text-xl transition-colors ${emoji === e ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-secondary"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {submitted && (
              <p className="text-sm text-green-600 font-medium">
                ✓ Memória adicionada com sucesso!
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || !authorName.trim() || (!caption && !imageData && !emoji)}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? "Salvando..." : "Publicar memória"}
            </button>
          </div>
        </div>

        {/* Posts */}
        <div>
          <h2 className="font-semibold mb-4">
            {posts.length} {posts.length === 1 ? "memória" : "memórias"}
          </h2>
          {posts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <p className="text-3xl mb-2">📷</p>
              <p>Seja o primeiro a adicionar uma memória!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden"
                >
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt={post.caption ?? "Foto"}
                      className="w-full object-cover max-h-80"
                    />
                  )}
                  <div className="p-4">
                    {post.emoji && <span className="text-2xl">{post.emoji}</span>}
                    {post.caption && <p className="mt-1 text-sm">{post.caption}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {post.author_name} · {new Date(post.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* ⚠️ DEPOIS das fotos, no pé — ver `convite-do-app.ts`. O álbum é da
              família dela, e um cartão no meio das memórias seria o app se
              convidando para a sala. */}
          <ConviteDoApp onde="album" codigo={codigoDeConvite} />
        </div>
      </div>
    </div>
  );
}
