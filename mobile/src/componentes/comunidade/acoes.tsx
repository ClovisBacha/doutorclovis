import type { TipoDeReacao } from "@/lib/rede-social";
import { router } from "expo-router";
import { Archive, Ban, Flag } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { FolhaDeOpcoes, type Opcao } from "~/componentes/comunidade/folha";
import type { AcoesDoPost } from "~/componentes/comunidade/post";
import { FolhaDeBloqueio, FolhaDeDenuncia } from "~/componentes/comunidade/regras";
import { api } from "~/lib/comunidade/api";
import { comReacao, mensagemDoErro } from "~/lib/comunidade/regras";
import type { PostNaTela } from "~/servidor/rede";
import { cor } from "~/tema";

type Mudar = (f: (posts: PostNaTela[]) => PostNaTela[]) => void;

/**
 * O que se faz com um post, igual no feed, no perfil e na tela do post:
 * reagir (otimista, desfeito se o servidor recusar), salvar, e o ⋯ —
 * arquivar se é meu; denunciar e bloquear se não é.
 *
 * ⚠️ Escrita que falhou NUNCA fica com cara de sucesso: o servidor devolve
 * `{ok:false}` numa resposta normal, e a tela volta ao estado anterior e diz.
 */
export function useAcoesDosPosts({
  mudar,
  aviso,
  exigir,
  aoComentarios,
  aoArquivado,
}: {
  mudar: Mudar;
  aviso: (t: string, erro?: boolean) => void;
  exigir: (acao: () => void) => void;
  aoComentarios?: (post: PostNaTela) => void;
  aoArquivado?: (post: PostNaTela) => void;
}) {
  const [menu, setMenu] = useState<PostNaTela | null>(null);
  const [denunciando, setDenunciando] = useState<PostNaTela | null>(null);
  const [bloqueando, setBloqueando] = useState<PostNaTela | null>(null);
  const emCurso = useRef(new Set<string>());

  const trocarPost = useCallback(
    (id: string, f: (p: PostNaTela) => PostNaTela) => mudar((ps) => ps.map((p) => (p.id === id ? f(p) : p))),
    [mudar],
  );

  const aoReagir = useCallback(
    (post: PostNaTela, tipo: TipoDeReacao | null) => {
      exigir(() => {
        if (emCurso.current.has(post.id)) return;
        emCurso.current.add(post.id);
        const antes = post.minhaReacao;
        trocarPost(post.id, (p) => comReacao(p, tipo));
        void api.reagir(post.id, tipo).then((r) => {
          emCurso.current.delete(post.id);
          if (!r.ok) {
            trocarPost(post.id, (p) => comReacao(p, antes));
            aviso(mensagemDoErro(r.motivo, r.recado, "post"), true);
          }
        });
      });
    },
    [exigir, trocarPost, aviso],
  );

  const aoSalvar = useCallback(
    (post: PostNaTela) => {
      const salvar = !post.salvo;
      trocarPost(post.id, (p) => ({ ...p, salvo: salvar }));
      void api.salvarPost(post.id, salvar).then((r) => {
        if (!r.ok) {
          trocarPost(post.id, (p) => ({ ...p, salvo: !salvar }));
          aviso(mensagemDoErro(r.motivo, r.recado, "post"), true);
        } else {
          aviso(salvar ? "Salvo. Só você vê o que salvou." : "Tirado dos salvos.");
        }
      });
    },
    [trocarPost, aviso],
  );

  const acoes = useMemo<AcoesDoPost>(
    () => ({
      aoReagir,
      aoSalvar,
      aoMenu: setMenu,
      aoComentarios,
      aoPerfil: (id) => router.push(`/comunidade/perfil/${id}`),
    }),
    [aoReagir, aoSalvar, aoComentarios],
  );

  const opcoes: Opcao[] = menu
    ? menu.souAAutora
      ? [
          {
            rotulo: "Arquivar",
            sub: "Some do feed e do seu perfil. Não é apagar: dá para trazer de volta.",
            icone: <Archive size={22} color={cor.texto} />,
            aoTocar: () => {
              const alvo = menu;
              void api.arquivarPost(alvo.id).then((r) => {
                if (!r.ok) return aviso(mensagemDoErro(r.motivo, r.recado, "post"), true);
                mudar((ps) => ps.filter((p) => p.id !== alvo.id));
                aviso("Publicação arquivada.");
                aoArquivado?.(alvo);
              });
            },
          },
        ]
      : [
          {
            rotulo: "Denunciar",
            sub: "A equipe revê em até 24 horas.",
            icone: <Flag size={22} color={cor.urgente} />,
            perigo: true,
            aoTocar: () => {
              const alvo = menu;
              setTimeout(() => setDenunciando(alvo), 300);
            },
          },
          {
            rotulo: `Bloquear ${menu.autorNome}`,
            sub: "Vocês deixam de se ver na Comunidade.",
            icone: <Ban size={22} color={cor.urgente} />,
            perigo: true,
            aoTocar: () => {
              const alvo = menu;
              setTimeout(() => setBloqueando(alvo), 300);
            },
          },
        ]
    : [];

  const elementos = (
    <>
      <FolhaDeOpcoes aberta={!!menu} aoFechar={() => setMenu(null)} opcoes={opcoes} />
      <FolhaDeDenuncia
        aberta={!!denunciando}
        aoFechar={() => setDenunciando(null)}
        oQue="publicação"
        aoEnviar={(motivo) => {
          const alvo = denunciando;
          if (!alvo) return;
          void api.denunciarPost(alvo.id, motivo).then((r) => {
            if (!r.ok) return aviso(mensagemDoErro(r.motivo, r.recado, "post"), true);
            aviso("Denúncia enviada. A equipe revê em até 24 horas.");
          });
        }}
      />
      <FolhaDeBloqueio
        aberta={!!bloqueando}
        aoFechar={() => setBloqueando(null)}
        nome={bloqueando?.autorNome ?? ""}
        aoConfirmar={() => {
          const alvo = bloqueando;
          if (!alvo) return;
          void api.bloquear(alvo.autorId, true).then((r) => {
            if (!r.ok) return aviso(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
            mudar((ps) => ps.filter((p) => p.autorId !== alvo.autorId));
            aviso("Perfil bloqueado.");
          });
        }}
      />
    </>
  );

  return { acoes, elementos };
}
