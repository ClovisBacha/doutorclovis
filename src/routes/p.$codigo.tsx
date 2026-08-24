/**
 * /p/<codigo> — O PERFIL PÚBLICO, sem login.
 *
 * A régua inteira (o portão, o teto da vitrine, o que fica de fora) mora em
 * `src/lib/perfil-publico.ts`; a leitura, em `convite.functions.ts`.
 *
 * ⚠️ **Uma frase e nada mais quando não abre.** Perfil fechado, Modo Cuidado e
 * código inexistente respondem igual — contar qual dos três foi, para quem
 * abriu o link da bio de uma criadora, é o app entregando por eliminação o que
 * aconteceu com ela.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ConviteDoApp } from "@/components/convite-do-app";
import { primeiroNome } from "@/lib/quem-convidou";
import type { PerfilPublico } from "@/lib/perfil-publico";

export const Route = createFileRoute("/p/$codigo")({
  /**
   * ⚠️ **A LEITURA MUDOU DE `useEffect` PARA `loader`, e é isso que faz a
   * prévia existir.**
   *
   * O WhatsApp, o Instagram e o Telegram NÃO RODAM JAVASCRIPT quando buscam o
   * cartão de um link: eles pedem o HTML e leem as `<meta>` que vierem nele.
   * Com a busca no `useEffect`, o robô recebia uma página vazia e o cartão saía
   * genérico — no link que a criadora põe na bio para milhares de pessoas, e
   * que é a única superfície de conversão que este app tem fora dele mesmo.
   *
   * De quebra, some o esqueleto: quem abre já recebe a página montada.
   */
  loader: async ({ params }) => {
    try {
      const { perfilPublicoPorCodigo } = await import("@/lib/convite.functions");
      const r = await perfilPublicoPorCodigo({ data: { codigo: params.codigo } });
      return { perfil: r.perfil };
    } catch {
      /* Falha de rede vira "não disponível" — o MESMO desfecho dos outros
         três, e nunca uma tela de erro que conte que algo existe aqui. */
      return { perfil: null as PerfilPublico | null };
    }
  },
  component: Pagina,
  head: ({ loaderData }) => ({
    meta: [
      /* ⚠️ **Fora do índice.** Esta página é o cartão de visita de UMA pessoa,
         e ela não pediu para virar resultado de busca do Google. O link vive na
         bio dela e no story dela — que é onde ela o pôs.

         ⚠️ E `noindex` NÃO impede a prévia: o robô do WhatsApp não é buscador,
         ele lê as `og:` e monta o cartão do mesmo jeito. São duas coisas
         diferentes, e este arquivo precisa das duas. */
      { name: "robots", content: "noindex" },
      ...metaDaVitrine(loaderData?.perfil ?? null),
    ],
  }),
});

/**
 * As `og:` da vitrine.
 *
 * ⚠️ **O MESMO CARTÃO PARA OS QUATRO SILÊNCIOS.** Código inexistente, perfil
 * fechado, vitrine desligada e Modo Cuidado devolvem `perfil: null`, e todos
 * caem no cartão genérico do app — que é exatamente o que o `__root` já
 * publica. Um cartão que dissesse "perfil indisponível" contaria, para quem
 * colou o link no grupo da família, que ali existe alguém; e num app de
 * gestação de alto risco a diferença entre "não existe" e "não está disponível
 * agora" é uma informação que ninguém tem o direito de deduzir.
 *
 * ⚠️ **A BIO NÃO ENTRA, e a foto dela também não.** A página é pública — ela
 * ligou a chave —, mas o cartão de prévia é COPIADO e fica guardado no
 * histórico de toda conversa em que o link for colado, muito depois de ela
 * desligar a chave. O que viaja é o primeiro nome e a marca do app; o resto
 * exige abrir a página, que ela pode fechar quando quiser.
 */
function metaDaVitrine(perfil: PerfilPublico | null) {
  if (!perfil) return [];
  /* ⚠️ **`primeiroNome` DE VERDADE, e não uma segunda régua que só se parece
     com ela.** Aqui havia um `split(/\s+/)[0] || "Alguém"` com um comentário
     afirmando ser "a mesma régua" — e não era: `primeiroNome` RECUSA nome de um
     caractere (lixo de cadastro) e devolve `null`, enquanto o `||` transformava
     tudo que sobrasse no placeholder.

     E o placeholder não era hipotético: `perfilPublicoPorCodigo` já grava
     `nome: display_name?.trim() || "Alguém"`, e `display_name` é preenchido
     pelo gatilho com o trecho antes do @ do e-mail. Então saíam títulos como
     "Alguém está no Obstétrica" — a frase que esta leva proibiu por escrito,
     porque soa como erro de sistema — e "bachaclovis está no Obstétrica".

     ⚠️ **E isso não se conserta depois.** O título é o que o WhatsApp COPIA e
     guarda no histórico de toda conversa em que o link foi colado: desligar a
     chave amanhã não tira de lá.

     Sem primeiro nome utilizável, a página cai no cartão genérico do site (o
     `<head>` do root) — que apresenta o app sem afirmar nada sobre ninguém. */
  const nome = primeiroNome(perfil.nome);
  if (!nome) return [];
  const titulo = `${nome} está no Obstétrica`;
  const descricao = "Acompanhamento da gestação, semana a semana — do positivo ao pós-parto.";
  return [
    { property: "og:title", content: titulo },
    { property: "og:description", content: descricao },
    { name: "twitter:title", content: titulo },
    { name: "twitter:description", content: descricao },
  ];
}

function Pagina() {
  const { codigo } = Route.useParams();
  const { perfil } = Route.useLoaderData();

  if (!perfil) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-base text-muted-foreground">Este perfil não está disponível.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <header className="flex flex-col items-center text-center">
        {perfil.avatarUrl ? (
          <img
            src={perfil.avatarUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/15 text-[32px] font-bold text-primary"
          >
            {perfil.nome.trim()[0]?.toUpperCase() ?? "?"}
          </span>
        )}
        <h1 className="mt-3 font-serif text-2xl">{perfil.nome}</h1>

        {/* ⚠️ DUAS pílulas e não uma string montada: as chaves `mostrar_semana`
            e `mostrar_bebe` são independentes, e uma pode estar ligada sozinha. */}
        {(perfil.seloSemana || perfil.seloBebe) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {perfil.seloSemana && (
              <span className="rounded-full bg-muted px-3 py-1 text-[12px] font-medium">
                🤰 {perfil.seloSemana}
              </span>
            )}
            {perfil.seloBebe && (
              <span className="rounded-full bg-muted px-3 py-1 text-[12px] font-medium">
                💛 {perfil.seloBebe}
              </span>
            )}
          </div>
        )}

        {perfil.bio && (
          <p className="mt-3 max-w-[32ch] text-[14px] leading-snug text-muted-foreground">
            {perfil.bio}
          </p>
        )}
      </header>

      {/* ⚠️ Grade de 3, gap 2 — as mesmas medidas do perfil de dentro do app
          (`medidas-instagram.ts`): quem chega aqui e depois cria conta encontra
          a mesma tela, e não uma parecida. */}
      {perfil.posts.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-0.5">
          {perfil.posts.map((post) =>
            post.imagemUrl ? (
              <img
                key={post.id}
                src={post.imagemUrl}
                alt={post.texto ?? ""}
                className="aspect-[3/4] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                key={post.id}
                className="flex aspect-[3/4] w-full items-center justify-center bg-muted p-2 text-center text-[10px] leading-snug text-muted-foreground"
              >
                {(post.texto ?? "").slice(0, 80)}
              </div>
            ),
          )}
        </div>
      )}

      {/* ⚠️ **UM bloco de convite, e não dois.** A primeira versão desta tela
          tinha um cartão "Este é o Obstétrica" E o rodapé — dois blocos dizendo
          a mesma coisa, um embaixo do outro. O componente compartilhado já é o
          convite, com o código DELA: quem cria conta por aqui vira indicação
          dela, como nas outras páginas públicas. */}
      <ConviteDoApp onde="perfil" codigo={perfil.codigoDeConvite} nome={perfil.nome} />
    </div>
  );
}
