import type { TipoDeReacao, Visibilidade } from "@/lib/rede-social";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import * as B from "~/lib/comunidade/bancada";
import { seguro } from "~/lib/comunidade/regras";
import * as rede from "~/servidor/rede";

/**
 * O caminho ÚNICO das telas da Comunidade até o servidor.
 *
 *  · tudo passa por `seguro` — a ponte que lança vira `{ok:false, motivo:"rede"}`;
 *  · na BANCADA (web, `?bancada=1`) nada sai para a rede: cada função devolve
 *    o dado de exemplo com a MESMA forma da resposta do servidor, e ele entra
 *    nos mesmos estados da tela de produção.
 *
 * Parâmetros da bancada: `estado=vazio|instavel`, `recusa=1` (o servidor
 * recusa publicar/comentar com o recado da triagem).
 */

const ok = <T extends object>(v: T) => Promise.resolve({ ok: true as const, ...v });
const okVazio = () => Promise.resolve({ ok: true as const });
const estado = () => parametroDaBancada("estado");

const RECADO_DE_EXEMPLO =
  "Aqui a gente conta a própria experiência, sem dizer o que a outra deve fazer. Quem orienta é o médico dela.";

export const api = {
  meuPerfilSocial() {
    if (ehBancada()) {
      return ok({
        perfil: B.perfilDaBancadaSocial(B.EU_NA_BANCADA),
        emCuidado: parametroDaBancada("luto") === "1",
        pausada: false,
        suspensa: false,
        pedidos: B.pedidosDaBancada(),
      });
    }
    return seguro(() => rede.meuPerfilSocial({}));
  },

  salvarPerfilSocial(entrada: Parameters<typeof rede.salvarPerfilSocial>[0] & object) {
    if (ehBancada()) return ok({ parcial: false });
    return seguro(() => rede.salvarPerfilSocial(entrada));
  },

  verPerfil(alvoId: string, antesDe?: string | null) {
    if (ehBancada()) {
      if (estado() === "indisponivel") {
        return Promise.resolve({ ok: false as const, motivo: "indisponivel" as const });
      }
      const perfil = B.perfilDaBancadaSocial(alvoId === "eu" ? B.EU_NA_BANCADA : alvoId);
      return ok({ perfil, posts: antesDe ? [] : B.postsDoPerfilDaBancada(alvoId), proximo: null });
    }
    return seguro(() => rede.verPerfil({ alvoId, antesDe: antesDe ?? null }));
  },

  seguir(alvoId: string) {
    if (ehBancada()) return ok({ estado: "pendente" as const });
    return seguro(() => rede.seguir({ alvoId }));
  },

  deixarDeSeguir(alvoId: string) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.deixarDeSeguir({ alvoId }));
  },

  responderPedido(seguidorId: string, aceitar: boolean) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.responderPedido({ seguidorId, aceitar }));
  },

  publicarPost(entrada: {
    texto: string | null;
    imagem: string | null;
    extras?: string[];
    altTexto?: string | null;
    sensivel?: boolean;
    motivoSensivel?: string | null;
    visibilidade: Visibilidade;
  }) {
    if (ehBancada()) {
      if (parametroDaBancada("recusa") === "1") {
        return Promise.resolve({
          ok: false as const,
          motivo: "clinica" as const,
          recado: RECADO_DE_EXEMPLO,
        });
      }
      return ok({ postId: "novo" });
    }
    return seguro(() => rede.publicarPost(entrada));
  },

  arquivarPost(postId: string) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.arquivarPost({ postId }));
  },

  meuFeed(antesDe?: string | null) {
    if (ehBancada()) {
      if (estado() === "instavel") {
        return Promise.resolve({ ok: false as const, motivo: "instavel" as const });
      }
      const vazio = estado() === "vazio" || parametroDaBancada("luto") === "1";
      return ok({ posts: vazio || antesDe ? [] : B.postsDaBancada(), proximo: null });
    }
    return seguro(() => rede.meuFeed({ antesDe: antesDe ?? null }));
  },

  sugestoesDoFeed() {
    if (ehBancada()) {
      if (estado() === "vazio" || parametroDaBancada("luto") === "1") {
        return ok({ posts: [], sugeridos: [] as string[], pessoas: [] });
      }
      const s = B.sugestoesDaBancada();
      return ok({ posts: s.posts, sugeridos: s.posts.map((p) => p.id), pessoas: s.pessoas });
    }
    return seguro(() => rede.sugestoesDoFeed({}));
  },

  reagir(postId: string, tipo: TipoDeReacao | null) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.reagir({ postId, tipo }));
  },

  bloquear(alvoId: string, bloquear: boolean) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.bloquear({ alvoId, bloquear }));
  },

  buscarPerfis(termo: string) {
    if (ehBancada()) {
      if (estado() === "instavel") {
        return Promise.resolve({ ok: false as const, motivo: "instavel" as const });
      }
      return ok({ perfis: estado() === "vazio" ? [] : B.buscaDaBancada(termo) });
    }
    return seguro(() => rede.buscarPerfis({ termo }));
  },

  verPost(postId: string) {
    if (ehBancada()) {
      if (estado() === "indisponivel") {
        return Promise.resolve({ ok: false as const, motivo: "indisponivel" as const });
      }
      const todos = [...B.postsDaBancada(), ...B.sugestoesDaBancada().posts];
      const p = todos.find((x) => x.id === postId) ?? todos[0];
      return ok({ post: p });
    }
    return seguro(() => rede.verPost({ postId }));
  },

  minhaAtividade() {
    if (ehBancada()) {
      if (estado() === "instavel") {
        return Promise.resolve({ ok: false as const, motivo: "instavel" as const });
      }
      return ok(estado() === "vazio" ? { itens: [], novas: 0 } : B.atividadeDaBancada());
    }
    return seguro(() => rede.minhaAtividade({}));
  },

  marcarAtividadeVista() {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.marcarAtividadeVista({}));
  },

  denunciarPost(postId: string, motivo: string) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.denunciarPost({ postId, motivo }));
  },

  denunciarPerfil(alvoId: string, motivo: string) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.denunciarPerfil({ alvoId, motivo }));
  },

  meusBloqueados() {
    if (ehBancada()) return ok({ pessoas: B.bloqueadosDaBancada() });
    return seguro(() => rede.meusBloqueados({}));
  },

  salvarPost(postId: string, salvar: boolean) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.salvarPost({ postId, salvar }));
  },

  comentariosDoPost(postId: string) {
    if (ehBancada()) {
      return ok({
        comentarios: B.comentariosDaBancada(),
        abertos: true,
        souADona: false,
        possoComentar: true,
      });
    }
    return seguro(() => rede.comentariosDoPost({ postId }));
  },

  comentar(postId: string, texto: string, respondeA?: string) {
    if (ehBancada()) {
      if (parametroDaBancada("recusa") === "1") {
        return Promise.resolve({
          ok: false as const,
          motivo: "clinico" as const,
          recado: RECADO_DE_EXEMPLO,
        });
      }
      return okVazio();
    }
    return seguro(() => rede.comentar({ postId, texto, ...(respondeA ? { respondeA } : {}) }));
  },

  apagarComentario(id: string) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.apagarComentario({ id }));
  },

  denunciarComentario(id: string, motivo: string) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.denunciarComentario({ id, motivo }));
  },

  curtirComentario(comentarioId: string, curtir: boolean) {
    if (ehBancada()) return okVazio();
    return seguro(() => rede.curtirComentario({ comentarioId, curtir }));
  },

  escolherHandle(handle: string) {
    if (ehBancada()) return ok({ handle: handle.trim().toLowerCase() });
    return seguro(() => rede.escolherHandle({ handle }));
  },
};
