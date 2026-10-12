/**
 * /pub/<codigo> — UMA PUBLICAÇÃO, sem login.
 *
 * O perfil já tinha endereço (`/p/<codigo>`, a vitrine). Uma publicação sozinha
 * não tinha nenhum — não havia como mandar UMA foto para o WhatsApp da família.
 *
 * A régua do código mora em `src/lib/link-da-publicacao.ts`; os quatro portões
 * (código válido, link aberto, camada `publico`, autora na rede) moram em
 * `postPublicoPorCodigo`, e são explícitos porque aqui NÃO HÁ SESSÃO: não há
 * `contextoDe`, não há bloqueio a consultar, não há nada além do que o servidor
 * conferir.
 *
 * ⚠️ **Uma frase e nada mais quando não abre.** Código inexistente, link
 * fechado, publicação arquivada, camada fechada e Modo Cuidado respondem igual —
 * contar qual dos cinco foi, para quem colou o link no grupo da família, é o app
 * entregando por eliminação o que aconteceu com ela.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ConviteDoApp } from "@/components/convite-do-app";

type PostPublico = {
  autorNome: string;
  autorAvatar: string | null;
  texto: string | null;
  imagemUrl: string | null;
  imagens?: string[];
  videoUrl?: string | null;
  altTexto?: string | null;
  criadoEm: string;
};

export const Route = createFileRoute("/pub/$codigo")({
  /**
   * ⚠️ **`loader`, e nunca `useEffect` — é o que faz a prévia existir.**
   *
   * O WhatsApp, o Instagram e o Telegram NÃO RODAM JAVASCRIPT quando buscam o
   * cartão de um link: pedem o HTML e leem as `<meta>` que vierem nele. Com a
   * busca no cliente, o robô recebe página vazia e o cartão sai genérico — e
   * este link existe exatamente para ser colado numa conversa.
   */
  loader: async ({ params }): Promise<{ post: PostPublico | null }> => {
    try {
      const { postPublicoPorCodigo } = await import("@/lib/rede-social.functions");
      const r = await postPublicoPorCodigo({ data: { codigo: params.codigo } });
      return { post: (r.ok ? r.post : null) as PostPublico | null };
    } catch {
      /* Falha de rede vira "não disponível" — o MESMO desfecho dos outros,
         nunca uma tela de erro que conte que algo existe aqui. */
      return { post: null as PostPublico | null };
    }
  },
  component: Pagina,
  head: ({ loaderData }) => ({
    meta: [
      /* ⚠️ **Fora do índice.** A publicação é de UMA pessoa, e ela não pediu
         para virar resultado de busca. O link vive onde ela o colou.
         ⚠️ E `noindex` NÃO impede a prévia: o robô do WhatsApp não é buscador. */
      { name: "robots", content: "noindex" },
      ...metaDaPublicacao(loaderData?.post ?? null),
    ],
  }),
});

/**
 * As `og:` da publicação.
 *
 * ⚠️ **A LEGENDA NÃO ENTRA, e a foto também não.** O cartão de prévia é COPIADO
 * e fica guardado no histórico de toda conversa em que o link for colado —
 * muito depois de ela fechar o link. A legenda de uma foto de gestação pode ser
 * exatamente o que ela decide não deixar mais à mostra, e a foto é de barriga
 * ou de ultrassom. O que viaja é o primeiro nome e a marca do app; o resto
 * exige abrir a página, que ela fecha quando quiser.
 *
 * ⚠️ **E o MESMO cartão genérico para todos os silêncios** — ver o cabeçalho.
 */
function metaDaPublicacao(post: PostPublico | null) {
  if (!post) return [];
  const titulo = "Uma publicação no Obstétrica";
  const descricao = "Acompanhamento da gestação, semana a semana — do positivo ao pós-parto.";
  return [
    { property: "og:title", content: titulo },
    { property: "og:description", content: descricao },
    { name: "twitter:title", content: titulo },
    { name: "twitter:description", content: descricao },
  ];
}

function Pagina() {
  const { post } = Route.useLoaderData();

  if (!post) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-base text-muted-foreground">Esta publicação não está disponível.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <header className="flex items-center gap-2.5">
        {post.autorAvatar ? (
          <img src={post.autorAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="h-10 w-10 rounded-full bg-muted" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{post.autorNome}</span>
      </header>

      {/* ⚠️ `playsInline` e `controls`: sem o primeiro o iOS abre o player de
          tela cheia do sistema e a página some por baixo dele. */}
      {post.videoUrl ? (
        <video
          src={post.videoUrl}
          poster={post.imagemUrl ?? undefined}
          controls
          playsInline
          className="mt-3 w-full rounded-2xl"
        />
      ) : post.imagemUrl ? (
        /* ⚠️ O `alt` nunca é vazio: `alt=""` faz o leitor de tela PULAR a
           imagem, e quem navega assim não saberia que há uma foto aqui. */
        <img
          src={post.imagemUrl}
          alt={post.altTexto ?? `Publicação de ${post.autorNome}`}
          className="mt-3 w-full rounded-2xl object-cover"
        />
      ) : null}

      {post.texto && <p className="mt-3 whitespace-pre-wrap text-[15px]">{post.texto}</p>}

      {/* ⚠️ O convite fica no PÉ, e numa linha: a página é DELA, e quem abriu
          veio por causa dela — não para receber um anúncio na cara. É a mesma
          régua das quatro páginas públicas. */}
      <div className="mt-10">
        <ConviteDoApp onde="post" codigo={null} />
      </div>
    </div>
  );
}
