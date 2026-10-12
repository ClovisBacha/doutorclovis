import type { TipoDeReacao, Visibilidade } from "@/lib/rede-social";
import { funcaoDoServidor } from "~/servidor/ponte";

/**
 * A Comunidade (rede social) — as MESMAS funções do site, com as mesmas
 * travas: triagem clínica no servidor, bloqueio nos dois sentidos, Modo
 * Cuidado, perfil que nasce fechado. Contratos de src/lib/rede-social.functions.ts,
 * src/lib/comentarios.functions.ts e src/lib/mencoes.functions.ts.
 *
 * Regras que valem para TODAS:
 *  - erro é `{ ok:false, motivo, recado? }`; o `recado` vem pronto do servidor
 *    e é mostrado como chegou;
 *  - "indisponivel" cobre de propósito perfil inexistente, bloqueio, luto,
 *    pausa, suspensão e post invisível — a tela NUNCA distingue esses casos;
 *  - "instavel" (feed, sugestões, busca) é falha de leitura: mostrar "tentar
 *    de novo", nunca a tela de vazio.
 */

type Erro<M extends string = string> = { ok: false; motivo: M | "sessao"; recado?: string | null };

export type PostNaTela = {
  id: string;
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  autorOficial: boolean;
  autorPremium: boolean;
  texto: string | null;
  imagemUrl: string | null;
  miniaturaUrl: string | null;
  imagens: string[];
  visibilidade: Visibilidade;
  criadoEm: string;
  reacoes: Partial<Record<TipoDeReacao, number>>;
  minhaReacao: TipoDeReacao | null;
  souAAutora: boolean;
  vistas: number | null;
  marcadas: { id: string; nome: string }[];
  souMarcada: boolean;
  editadoEm: string | null;
  fixadoEm: string | null;
  quemComenta: "todos" | "seguidores" | "amigas";
  enquete: { opcoes: string[]; votos: number[]; meuVoto: number | null } | null;
  altTexto?: string | null;
  sensivel?: boolean;
  motivoSensivel?: string | null;
  batePalavraMinha?: boolean;
  lugar?: string | null;
  videoUrl: string | null;
  ehRepost: boolean;
  repost: {
    id: string;
    autorNome: string;
    autorId: string;
    texto: string | null;
    imagemUrl: string | null;
  } | null;
  salvo: boolean;
};

export type PerfilNaTela = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  publico: boolean;
  oficial?: boolean;
  meuVinculo: "ativo" | "pendente" | null;
  souEu: boolean;
  seguidores: number | null;
  seguindo: number | null;
  handle?: string | null;
  seloSemana: string | null;
  seloBebe: string | null;
  mostrarSemana: boolean;
  mostrarBebe: boolean;
  bioLink?: string | null;
  silenciado?: boolean;
  favorita?: boolean;
  linhaDosFilhos?: string | null;
};

export type PessoaNaLista = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  sigo: "ativo" | "pendente" | null;
  souEu: boolean;
  oficial?: boolean;
};

export type EspecieDeAviso =
  | "seguiu"
  | "pediu_para_seguir"
  | "reagiu"
  | "aceitou"
  | "marcou"
  | "reagiu_story"
  | "comentou"
  | "mencionou";

export type AtividadeNaTela = {
  id: string;
  especie: EspecieDeAviso;
  quemId: string;
  quemNome: string;
  quemAvatar: string | null;
  postId: string | null;
  postCapa: string | null;
  criadoEm: string;
  visto: boolean;
  pendente: boolean;
};

export type ComentarioNaTela = {
  id: string;
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  texto: string;
  criadoEm: string;
  possoApagar: boolean;
  respondeA?: string | null;
  curtidas?: number;
  euCurti?: boolean;
  recolhido?: boolean;
  fixadoEm?: string | null;
  souOAutor?: boolean;
  editadoEm?: string | null;
};

export const meuPerfilSocial = funcaoDoServidor<
  Record<string, never>,
  | {
      ok: true;
      perfil: PerfilNaTela;
      emCuidado: boolean;
      pausada: boolean;
      suspensa: boolean;
      pedidos: { id: string; nome: string; avatarUrl: string | null }[];
    }
  | Erro<"indisponivel">
>("src/lib/rede-social.functions.ts", "meuPerfilSocial");

export const salvarPerfilSocial = funcaoDoServidor<
  {
    publico?: boolean;
    mostrarSemana?: boolean;
    mostrarBebe?: boolean;
    bio?: string | null;
    nome?: string;
    avatar?: string | null;
  },
  { ok: true; parcial: boolean } | Erro<"imagem" | "bio_clinica" | "banco">
>("src/lib/rede-social.functions.ts", "salvarPerfilSocial");

export const verPerfil = funcaoDoServidor<
  { alvoId: string; antesDe?: string | null },
  | { ok: true; perfil: PerfilNaTela; posts: PostNaTela[]; proximo: string | null }
  | Erro<"indisponivel" | "trancado">
>("src/lib/rede-social.functions.ts", "verPerfil");

export const seguir = funcaoDoServidor<
  { alvoId: string },
  { ok: true; estado: "ativo" | "pendente" } | Erro<"indisponivel" | "banco">
>("src/lib/rede-social.functions.ts", "seguir");

export const deixarDeSeguir = funcaoDoServidor<{ alvoId: string }, { ok: true } | Erro<"banco">>(
  "src/lib/rede-social.functions.ts",
  "deixarDeSeguir",
);

export const responderPedido = funcaoDoServidor<
  { seguidorId: string; aceitar: boolean },
  { ok: true } | Erro<"banco">
>("src/lib/rede-social.functions.ts", "responderPedido");

export const publicarPost = funcaoDoServidor<
  {
    texto: string | null;
    imagem: string | null;
    miniatura?: string | null;
    extras?: string[];
    altTexto?: string | null;
    sensivel?: boolean;
    motivoSensivel?: string | null;
    visibilidade: Visibilidade;
  },
  | { ok: true; postId: string }
  | Erro<"indisponivel" | "clinica" | "emergencia" | "enquete" | "vazio" | "imagem" | "banco">
>("src/lib/rede-social.functions.ts", "publicarPost");

/** "Apagar" no servidor ARQUIVA (tem volta). A tela diz "arquivar". */
export const arquivarPost = funcaoDoServidor<{ postId: string }, { ok: true } | Erro<"banco">>(
  "src/lib/rede-social.functions.ts",
  "apagarPost",
);

export const meuFeed = funcaoDoServidor<
  { antesDe?: string | null },
  { ok: true; posts: PostNaTela[]; proximo: string | null } | Erro<"instavel">
>("src/lib/rede-social.functions.ts", "meuFeed");

export const sugestoesDoFeed = funcaoDoServidor<
  Record<string, never>,
  | { ok: true; posts: PostNaTela[]; sugeridos?: string[]; pessoas: PessoaNaLista[] }
  | Erro<"instavel">
>("src/lib/rede-social.functions.ts", "sugestoesDoFeed");

export const reagir = funcaoDoServidor<
  { postId: string; tipo: TipoDeReacao | null },
  { ok: true } | Erro<"tipo" | "indisponivel" | "banco">
>("src/lib/rede-social.functions.ts", "reagir");

export const bloquear = funcaoDoServidor<
  { alvoId: string; bloquear: boolean },
  { ok: true } | Erro<"indisponivel" | "banco">
>("src/lib/rede-social.functions.ts", "bloquear");

export const buscarPerfis = funcaoDoServidor<
  { termo: string },
  { ok: true; perfis: PerfilNaTela[] } | Erro<"instavel">
>("src/lib/rede-social.functions.ts", "buscarPerfis");

export const verPost = funcaoDoServidor<
  { postId: string },
  { ok: true; post: PostNaTela } | Erro<"indisponivel">
>("src/lib/rede-social.functions.ts", "verPost");

export const minhaAtividade = funcaoDoServidor<
  Record<string, never>,
  { ok: true; itens: AtividadeNaTela[]; novas: number } | Erro
>("src/lib/rede-social.functions.ts", "minhaAtividade");

export const marcarAtividadeVista = funcaoDoServidor<
  Record<string, never>,
  { ok: true } | Erro<"banco">
>("src/lib/rede-social.functions.ts", "marcarAtividadeVista");

export const denunciarPost = funcaoDoServidor<
  { postId: string; motivo: string },
  { ok: true } | Erro<"indisponivel" | "motivo" | "banco">
>("src/lib/rede-social.functions.ts", "denunciarPost");

export const denunciarPerfil = funcaoDoServidor<
  { alvoId: string; motivo: string },
  { ok: true } | Erro<"indisponivel" | "motivo" | "banco">
>("src/lib/rede-social.functions.ts", "denunciarPerfil");

export const meusBloqueados = funcaoDoServidor<
  Record<string, never>,
  { ok: true; pessoas: PessoaNaLista[] } | Erro<"banco">
>("src/lib/rede-social.functions.ts", "meusBloqueados");

export const salvarPost = funcaoDoServidor<
  { postId: string; salvar: boolean },
  { ok: true } | Erro<"indisponivel" | "banco">
>("src/lib/rede-social.functions.ts", "salvarPost");

export const listaDeGente = funcaoDoServidor<
  { tipo: "seguidores" | "seguindo"; alvoId?: string },
  { ok: true; gente: PessoaNaLista[] } | Erro<"indisponivel">
>("src/lib/rede-social.functions.ts", "listaDeGente");

export const comentariosDoPost = funcaoDoServidor<
  { postId: string; ordem?: "recentes" | "relevantes" },
  | {
      ok: true;
      comentarios: ComentarioNaTela[];
      abertos: boolean;
      souADona: boolean;
      possoComentar: boolean;
    }
  | Erro<"indisponivel" | "banco">
>("src/lib/comentarios.functions.ts", "comentariosDoPost");

export const comentar = funcaoDoServidor<
  { postId: string; texto: string; respondeA?: string },
  | { ok: true }
  | Erro<
      | "vazio"
      | "clinico"
      | "emergencia"
      | "ofensivo"
      | "alarmista"
      | "indisponivel"
      | "fechados"
      | "so_convidadas"
      | "banco"
      | "muitos"
      | "alvo_invalido"
      | "sem_suporte"
    >
>("src/lib/comentarios.functions.ts", "comentar");

export const apagarComentario = funcaoDoServidor<
  { id: string },
  { ok: true } | Erro<"banco" | "nao_existe" | "nao_e_seu">
>("src/lib/comentarios.functions.ts", "apagarComentario");

export const denunciarComentario = funcaoDoServidor<
  { id: string; motivo: string },
  { ok: true } | Erro<"motivo" | "indisponivel" | "banco">
>("src/lib/comentarios.functions.ts", "denunciarComentario");

export const curtirComentario = funcaoDoServidor<
  { comentarioId: string; curtir: boolean },
  { ok: true } | Erro<"banco" | "indisponivel" | "sem_suporte">
>("src/lib/comentarios.functions.ts", "curtirComentario");

export const escolherHandle = funcaoDoServidor<
  { handle: string },
  | { ok: true; handle: string }
  | Erro<
      | "curto"
      | "longo"
      | "caracteres"
      | "so_pontos"
      | "reservado"
      | "banco"
      | "muitas_trocas"
      | "ocupado"
    >
>("src/lib/mencoes.functions.ts", "escolherHandle");
