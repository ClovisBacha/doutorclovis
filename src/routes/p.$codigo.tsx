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
import { useEffect, useState } from "react";
import { ConviteDoApp } from "@/components/convite-do-app";
import type { PerfilPublico } from "@/lib/perfil-publico";

export const Route = createFileRoute("/p/$codigo")({
  component: Pagina,
  head: () => ({
    meta: [
      /* ⚠️ **Fora do índice.** Esta página é o cartão de visita de UMA pessoa,
         e ela não pediu para virar resultado de busca do Google. O link vive na
         bio dela e no story dela — que é onde ela o pôs. */
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Pagina() {
  const { codigo } = Route.useParams();
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { perfilPublicoPorCodigo } = await import("@/lib/convite.functions");
        const r = await perfilPublicoPorCodigo({ data: { codigo } });
        if (vivo) setPerfil(r.perfil);
      } catch {
        if (vivo) setPerfil(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [codigo]);

  if (carregando) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-12">
        <div className="skeleton mx-auto h-24 w-24 rounded-full" />
        <div className="skeleton mx-auto h-6 w-40 rounded-xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

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
      <ConviteDoApp onde="perfil" codigo={perfil.codigoDeConvite} />
    </div>
  );
}
