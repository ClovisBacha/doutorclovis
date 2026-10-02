/**
 * A RÉGUA PURA DA COMUNIDADE NO APP.
 *
 * Tudo aqui é função sem tela, sem react-native e sem expo — é o que o
 * `bun test` alcança. As telas só desenham o que estas funções decidem.
 *
 * ⚠️ O vocabulário (reações, visibilidades, motivos de denúncia, véu, @) NÃO
 * mora aqui: vem dos módulos do site (`@/lib/rede-social`, `@/lib/denuncias`,
 * `@/lib/conteudo-sensivel`, `@/lib/mencoes`). Duas cópias divergiriam no
 * primeiro ajuste, e o app e o site diriam coisas diferentes do mesmo post.
 */
import {
  aoReagir,
  REACAO_DO_TOQUE_DUPLO,
  type ContagemDeReacoes,
  type TipoDeReacao,
} from "@/lib/rede-social";
import { CARTOES_DA_COMUNIDADE, type CartaoDaComunidade } from "@/lib/onboarding-da-comunidade";
import type { ComentarioNaTela, PostNaTela } from "~/servidor/rede";

/* ── Limites que o app conhece ─────────────────────────────────────────── */

/** Teto do comentário. Mora em `@/lib/comentarios`, que arrasta a régua
 *  clínica inteira para o pacote — por isso o número é repetido aqui e uma
 *  catraca (`regras.test.ts`) confere que bate com o do site. */
export const LIMITE_DO_COMENTARIO = 500;
/** Respostas visíveis antes de "ver mais" (mesma razão do teto acima). */
export const RESPOSTAS_VISIVEIS = 3;
/** Fotos por publicação: a 1ª vai em `imagem`, as outras em `extras`. */
export const FOTOS_POR_POST = 4;
/** Lado maior da foto publicada e compressão do JPEG. */
export const LADO_MAXIMO_DA_FOTO = 1080;
export const COMPRESSAO_DA_FOTO = 0.72;
/** A foto de perfil é quadrada, 512. */
export const LADO_DO_AVATAR = 512;

/* ── Chamadas ao servidor ──────────────────────────────────────────────── */

export type FalhaDeRede = { ok: false; motivo: "rede"; recado?: null };

/**
 * A ponte LANÇA quando não há rede ou o servidor demora; as funções do site
 * devolvem `{ok:false}` numa resposta normal. A tela precisa de UM formato só
 * — senão um `try` esquecido vira tela branca, e um `ok` esquecido vira
 * "publicado" sobre uma recusa.
 */
export async function seguro<R extends { ok: boolean }>(
  chamada: () => Promise<R>,
): Promise<R | FalhaDeRede> {
  try {
    const r = await chamada();
    if (!r || typeof r !== "object" || typeof (r as { ok?: unknown }).ok !== "boolean") {
      return { ok: false, motivo: "rede" };
    }
    return r;
  } catch {
    return { ok: false, motivo: "rede" };
  }
}

export type Contexto = "post" | "perfil" | "comentario" | "acao";

/**
 * O que a tela diz quando o servidor recusa.
 *
 * ⚠️ O `recado` vem PRONTO do servidor (é a triagem clínica: ele recusa
 * conselho de saúde e emergência e diz o que fazer em vez disso) e é mostrado
 * como chegou — nunca reescrito aqui.
 *
 * ⚠️ "indisponivel" é UM SILÊNCIO SÓ. Ele cobre de propósito perfil que não
 * existe, bloqueio, luto, pausa e suspensão; dizer qual seria contar a perda
 * ou o bloqueio de alguém.
 */
export function mensagemDoErro(
  motivo: string,
  recado?: string | null,
  contexto: Contexto = "acao",
): string {
  if (recado && recado.trim()) return recado;
  switch (motivo) {
    case "indisponivel":
      if (contexto === "post") return "Esta publicação não está disponível.";
      if (contexto === "perfil") return "Este perfil não está disponível.";
      if (contexto === "comentario") return "Este comentário não está disponível.";
      return "Isso não está disponível.";
    case "sessao":
      return "Sua sessão terminou. Entre de novo para continuar.";
    case "vazio":
      return contexto === "comentario"
        ? "Escreva alguma coisa antes de enviar."
        : "Escreva alguma coisa ou escolha uma foto.";
    case "imagem":
      return "Não conseguimos usar essa foto. Tente outra.";
    case "fechados":
      return "Os comentários desta publicação estão fechados.";
    case "so_convidadas":
      return "Nesta publicação, só quem a autora escolheu pode comentar.";
    case "muitos":
      return "Você já comentou bastante hoje. Amanhã dá de novo.";
    case "alvo_invalido":
    case "nao_existe":
      return "Esse comentário não existe mais.";
    case "nao_e_seu":
      return "Só quem escreveu pode apagar.";
    case "motivo":
      return "Escolha um motivo.";
    case "clinica":
    case "clinico":
    case "emergencia":
    case "ofensivo":
    case "alarmista":
      return "Isso não pode ser publicado como está.";
    case "bio_clinica":
      return "A bio não pode trazer orientação de saúde.";
    case "curto":
      return "O @ precisa ter pelo menos uma letra.";
    case "longo":
      return "O @ pode ter até 30 caracteres.";
    case "caracteres":
      return "Use só letras sem acento, números, ponto e sublinhado.";
    case "so_pontos":
      return "O @ precisa ter pelo menos uma letra ou um número.";
    case "reservado":
      return "Esse @ é reservado. Escolha outro.";
    case "ocupado":
      return "Esse @ já é de outra pessoa. Escolha outro.";
    case "muitas_trocas":
      return "Você já trocou o @ duas vezes nos últimos 14 dias. Daqui a pouco dá de novo.";
    case "trancado":
      return "Este perfil não está disponível.";
    default:
      return "Não deu certo agora. Tente de novo.";
  }
}

/* ── Paginação ─────────────────────────────────────────────────────────── */

/**
 * Junta a página nova à lista, sem repetir post. O cursor `antesDe` pode
 * devolver um post que chegou entre duas leituras; repetir a chave quebra a
 * FlatList e mostra o mesmo post duas vezes.
 */
export function juntarPaginas<T extends { id: string }>(atual: T[], nova: T[]): T[] {
  const vistos = new Set(atual.map((p) => p.id));
  return [...atual, ...nova.filter((p) => !vistos.has(p.id))];
}

/**
 * Deve buscar a próxima página?
 *
 * ⚠️ Página VAZIA com `proximo` não nulo NÃO é o fim: o servidor filtra depois
 * de ler (bloqueio, luto, visibilidade) e uma página inteira pode sumir. O fim
 * é só `proximo === null`.
 */
export function temMais(proximo: string | null | undefined): boolean {
  return typeof proximo === "string" && proximo.length > 0;
}

/* ── Reações ───────────────────────────────────────────────────────────── */

/**
 * O post depois de ela reagir (atualização otimista). Uma reação por pessoa:
 * trocar tira um da antiga e põe um na nova; tirar só desconta.
 */
export function comReacao<P extends Pick<PostNaTela, "reacoes" | "minhaReacao">>(
  post: P,
  nova: TipoDeReacao | null,
): P {
  const reacoes: ContagemDeReacoes = { ...post.reacoes };
  const antiga = post.minhaReacao;
  if (antiga === nova) return post;
  if (antiga) {
    const n = (reacoes[antiga] ?? 0) - 1;
    if (n > 0) reacoes[antiga] = n;
    else delete reacoes[antiga];
  }
  if (nova) reacoes[nova] = (reacoes[nova] ?? 0) + 1;
  return { ...post, reacoes, minhaReacao: nova };
}

/** Tocar um emoji da fileira: o mesmo tira, outro troca. */
export function reacaoDoToque(atual: TipoDeReacao | null, tocada: TipoDeReacao) {
  return aoReagir(atual, tocada);
}

/**
 * O toque duplo na foto SÓ DÁ, nunca tira — como no site e no modelo. Devolve
 * a reação a gravar, ou `null` quando não há nada a mudar (já é ❤️). Se ela
 * tinha outra reação, vira ❤️: é o mesmo balde do coração da barra.
 */
export function reacaoDoToqueDuplo(atual: TipoDeReacao | null): TipoDeReacao | null {
  return atual === REACAO_DO_TOQUE_DUPLO ? null : REACAO_DO_TOQUE_DUPLO;
}

/* ── Comentários ───────────────────────────────────────────────────────── */

export type Conversa = { raiz: ComentarioNaTela; respostas: ComentarioNaTela[] };

const tempo = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Um nível de resposta: cada raiz com as respostas dela, em ordem de tempo.
 * Resposta órfã (a raiz sumiu) vira raiz — some a conversa, não a pessoa.
 * O comentário FIXADO (só raiz) sobe para o topo depois da ordenação.
 */
export function montarConversas(lista: ComentarioNaTela[]): Conversa[] {
  const raizes = new Map<string, Conversa>();
  for (const c of lista) if (!c.respondeA) raizes.set(c.id, { raiz: c, respostas: [] });
  const orfas: Conversa[] = [];
  for (const c of lista) {
    if (!c.respondeA) continue;
    const dona = raizes.get(c.respondeA);
    if (dona) dona.respostas.push(c);
    else orfas.push({ raiz: c, respostas: [] });
  }
  const saida = [...raizes.values(), ...orfas];
  saida.sort((a, b) => tempo(a.raiz.criadoEm) - tempo(b.raiz.criadoEm));
  for (const c of saida) c.respostas.sort((a, b) => tempo(a.criadoEm) - tempo(b.criadoEm));
  const fixada = saida.findIndex((c) => !!c.raiz.fixadoEm && !c.raiz.respondeA);
  if (fixada > 0) saida.unshift(...saida.splice(fixada, 1));
  return saida;
}

/** As respostas que aparecem, e quantas ficam atrás de "ver mais". */
export function respostasNaTela(
  respostas: ComentarioNaTela[],
  abertas: boolean,
): { visiveis: ComentarioNaTela[]; escondidas: number } {
  if (abertas || respostas.length <= RESPOSTAS_VISIVEIS) {
    return { visiveis: respostas, escondidas: 0 };
  }
  return {
    visiveis: respostas.slice(0, RESPOSTAS_VISIVEIS),
    escondidas: respostas.length - RESPOSTAS_VISIVEIS,
  };
}

/** O campo de comentar só existe quando os dois sinais dizem que pode. */
export function mostraCampoDeComentar(v: { abertos: boolean; possoComentar: boolean }): boolean {
  return v.abertos && v.possoComentar;
}

/** Curtir comentário, otimista. */
export function comCurtida(c: ComentarioNaTela, curtir: boolean): ComentarioNaTela {
  const atual = c.curtidas ?? 0;
  if (!!c.euCurti === curtir) return c;
  return { ...c, euCurti: curtir, curtidas: Math.max(0, atual + (curtir ? 1 : -1)) };
}

/* ── Fotos ─────────────────────────────────────────────────────────────── */

/**
 * O tamanho para redimensionar: lado maior ≤ `maximo`, proporção mantida.
 * Foto menor que o teto não cresce (aumentar só pesa, não melhora).
 */
export function tamanhoReduzido(
  largura: number,
  altura: number,
  maximo = LADO_MAXIMO_DA_FOTO,
): { width: number; height: number } | null {
  if (!(largura > 0) || !(altura > 0)) return null;
  const maior = Math.max(largura, altura);
  if (maior <= maximo) return null;
  const f = maximo / maior;
  return { width: Math.round(largura * f), height: Math.round(altura * f) };
}

/** O recorte quadrado central (foto de perfil). */
export function recorteQuadrado(
  largura: number,
  altura: number,
): { originX: number; originY: number; width: number; height: number } | null {
  if (!(largura > 0) || !(altura > 0)) return null;
  const lado = Math.min(largura, altura);
  if (largura === altura) return null;
  return {
    originX: Math.floor((largura - lado) / 2),
    originY: Math.floor((altura - lado) / 2),
    width: lado,
    height: lado,
  };
}

export function dataUrlJpeg(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}

/** As fotos escolhidas viram o que `publicarPost` espera. */
export function fotosParaPublicar(fotos: string[]): { imagem: string | null; extras: string[] } {
  const f = fotos.slice(0, FOTOS_POR_POST);
  return { imagem: f[0] ?? null, extras: f.slice(1) };
}

/** As fotos de um post, sem repetir e sem vazio (a capa é a 1ª). */
export function fotosDoPost(p: Pick<PostNaTela, "imagemUrl" | "imagens">): string[] {
  const todas = [...(p.imagens ?? [])];
  if (p.imagemUrl && !todas.includes(p.imagemUrl)) todas.unshift(p.imagemUrl);
  return todas.filter((u) => typeof u === "string" && u.length > 0);
}

/* ── Gente ─────────────────────────────────────────────────────────────── */

export function inicialDe(nome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  return (n[0] ?? "?").toLocaleUpperCase("pt-BR");
}

/** Cores da inicial — as famílias da marca, escolhidas pelo id (estável). */
export const CORES_DA_INICIAL = [
  "#ab5e5c",
  "#0369a1",
  "#c2410c",
  "#047857",
  "#4d7c0f",
  "#6d28d9",
  "#8f4b49",
] as const;

export function corDaInicial(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CORES_DA_INICIAL[h % CORES_DA_INICIAL.length];
}

/** "1.234" → "1,2 mil". Números pequenos ficam inteiros. */
export function contagemCurta(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 10_000) return n.toLocaleString("pt-BR");
  if (n < 1_000_000) {
    const mil = Math.floor(n / 100) / 10;
    return `${mil.toLocaleString("pt-BR")} mil`;
  }
  const mi = Math.floor(n / 100_000) / 10;
  return `${mi.toLocaleString("pt-BR")} mi`;
}

export type Vinculo = "ativo" | "pendente" | null;

export function rotuloDoBotaoSeguir(v: Vinculo): string {
  if (v === "ativo") return "Seguindo";
  if (v === "pendente") return "Pendente";
  return "Seguir";
}

/* ── Regras da Comunidade e boas-vindas ────────────────────────────────── */

/** "Já concordei com as Regras" — por conta (aparelho compartilhado). */
export function chaveDasRegras(uid: string | null | undefined): string {
  return `dc-regras-comunidade:${uid ?? "anon"}`;
}

/** "Já vi as boas-vindas" — por conta. */
export function chaveDasBoasVindas(uid: string | null | undefined): string {
  return `dc-comunidade-boas-vindas:${uid ?? "anon"}`;
}

/**
 * Os cartões de boas-vindas do site, ajustados ao que o APP tem.
 *
 * ⚠️ O texto mora em `@/lib/onboarding-da-comunidade` e é o que o dono
 * revisa — mas dois cartões descrevem coisas que nesta versão não existem:
 *  · "onde" fala da fileira ⊞, chá de bebê, amigas, álbum e atalhos da barra —
 *    nada disso está no app; mostrar seria apontar para botão que não há;
 *  · "clinico" termina dizendo que o SOS "avisa o seu médico" — o app não tem
 *    médico vinculado, e a promessa seria falsa. A frase vira o que o SOS do
 *    app faz de fato: 192 e o contato de emergência.
 */
export function cartoesDoApp(): CartaoDaComunidade[] {
  return CARTOES_DA_COMUNIDADE.filter((c) => c.id !== "onde").map((c) =>
    c.id === "clinico"
      ? {
          ...c,
          texto: c.texto.replace(
            /Ele avisa o seu médico e o seu contato de uma vez\.?/,
            "Ele liga para o 192 e avisa o seu contato de emergência.",
          ),
        }
      : c,
  );
}

/** Os três pontos que a folha das Regras precisa dizer (Apple 1.2). */
export const PONTOS_DAS_REGRAS: readonly { titulo: string; texto: string }[] = [
  {
    titulo: "Tolerância zero",
    texto:
      "Não é permitido conteúdo ofensivo, abusivo, de assédio, nem conselho de saúde perigoso. Aqui a gente conta a própria experiência — quem orienta é o obstetra de cada uma.",
  },
  {
    titulo: "Denúncias revistas em até 24 horas",
    texto:
      "Todo conteúdo denunciado é revisto pela equipe em até 24 horas. O que quebrar estas regras é removido, e a conta de quem o publicou pode ser removida também.",
  },
  {
    titulo: "Você tem o controle",
    texto:
      "Em toda publicação, perfil e comentário, o botão ⋯ tem Denunciar e Bloquear. Quem você bloqueia deixa de ver você e você deixa de ver essa pessoa.",
  },
];

/** Gestos que pedem as Regras antes da primeira vez. */
export type GestoQuePedeRegras = "publicar" | "comentar" | "reagir";
