/**
 * A GRADE DE CONQUISTAS — que estado cada cartão mostra.
 *
 * Como no Duolingo: o servidor DESBLOQUEIA (`checkAndAwardAchievements`), e a
 * conquista ESPERA o toque para pagar (`resgatarConquista`).
 *
 * ⚠️ `resgatadas: null` é FALHA DE LEITURA, não "nenhuma resgatada". Mostrar
 * "Resgatar" em tudo nesse caso convidaria a resgatar de novo o que já foi
 * pago — e o servidor diria "repetido" a cada toque. O estado é neutro.
 * Sem react-native aqui: é testado pelo bun.
 */

import {
  CONQUISTAS,
  RARIDADES,
  type CategoriaConquista,
  type ConquistaDef,
} from "@/lib/conquistas";
import type { ConquistaDesbloqueada } from "~/servidor/economia";

/**
 * OS TEXTOS DAS CONQUISTAS COMO O APP OS ESCREVE — o catálogo do site
 * (`@/lib/conquistas`, congelado), com dez trocas (21/10/2026: o app não é
 * conselho médico, e nunca dá gênero ao bebê).
 *
 * "Ele Ouviu Você" ia para o cartão dos Stories; "Bebê Ativo" punha um rótulo
 * no bebê a partir da contagem de movimentos; e as de dado de saúde que ficam
 * visíveis para quem já as ganhou no site ("Saúde em Dia", "Primeira Mamada",
 * "Primeira vacina do bebê registrada") falam de um registro que o app não tem.
 * Só o texto muda: a chave, a raridade e o pagamento seguem os do site.
 */
export const TEXTO_DAS_CONQUISTAS_NO_APP: Readonly<
  Record<
    string,
    {
      site: Pick<ConquistaDef, "title" | "description">;
      app: Partial<Pick<ConquistaDef, "title" | "description" | "emoji">>;
    }
  >
> = {
  carta_1: {
    site: { title: "Ele Ouviu Você", description: "Leu a primeira carta em voz alta pro bebê" },
    app: { title: "Carta Entregue" },
  },
  carta_10: {
    site: { title: "A Voz Preferida", description: "10 cartas lidas pro bebê" },
    app: { title: "Dez Cartas de Amor" },
  },
  first_kicks: {
    site: { title: "Primeiros Chutes!", description: "Registrou a primeira sessão de movimentos" },
    app: { title: "Primeiro Encontro" },
  },
  kicks_10: {
    site: { title: "Bebê Ativo", description: "10 sessões de contagem de chutes" },
    app: { title: "Dez Encontros", description: "10 sessões de movimentos do bebê", emoji: "👣" },
  },
  first_vaccine: {
    site: { title: "Protegido", description: "Primeira vacina do bebê registrada" },
    app: { title: "Mais um Passo", description: "Guardou um registro do bebê", emoji: "🌟" },
  },
  first_health_log: {
    site: { title: "Saúde em Dia", description: "Registrou o primeiro dado de saúde" },
    app: { title: "Primeiro Registro", description: "Guardou o primeiro registro" },
  },
  health_7_days: {
    site: { title: "Semana Saudável", description: "7 registros de saúde realizados" },
    app: { title: "Semana de Registros", description: "7 registros guardados" },
  },
  first_breastfeeding: {
    site: { title: "Primeira Mamada", description: "Registrou a primeira amamentação" },
    app: { title: "Primeiro Momento", description: "Guardou o primeiro momento do bebê" },
  },
  first_baby_weight: {
    site: { title: "Crescendo!", description: "Registrou o primeiro peso do bebê" },
    app: { description: "Guardou uma lembrança do bebê", emoji: "🌱" },
  },
  prenatal_done: {
    site: { title: "Pré-natal Concluído!", description: "Checklist completo — parabéns!" },
    app: { title: "Lista Completa!" },
  },
};

export function comTextoDoApp(d: ConquistaDef): ConquistaDef {
  const t = TEXTO_DAS_CONQUISTAS_NO_APP[d.key];
  return t && t.site.title === d.title && t.site.description === d.description
    ? { ...d, ...t.app }
    : d;
}

/** O catálogo do site, com os textos do app. */
export const CONQUISTAS_NO_APP: readonly ConquistaDef[] = CONQUISTAS.map(comTextoDoApp);

/** A conquista pela chave, com o texto do app (no lugar de `conquistaPorChave`). */
export function conquistaNoApp(key: string): ConquistaDef | undefined {
  return CONQUISTAS_NO_APP.find((d) => d.key === key);
}

export type EstadoDaConquista = "bloqueada" | "resgatar" | "resgatada" | "desbloqueada";

export type Cartao = {
  def: ConquistaDef;
  estado: EstadoDaConquista;
  quando: string | null;
  sementinhas: number;
};

export function estadoDe(
  key: string,
  desbloqueadas: Map<string, string>,
  resgatadas: Set<string> | null,
): EstadoDaConquista {
  if (!desbloqueadas.has(key)) return "bloqueada";
  if (resgatadas === null) return "desbloqueada";
  return resgatadas.has(key) ? "resgatada" : "resgatar";
}

/**
 * As conquistas que o app NÃO tem como dar: o servidor as desbloqueia por
 * tabelas que só telas do site escrevem (convite de acompanhante, álbum da
 * família, checklist do pré-natal, os registros do bebê). Trancadas, elas
 * apareciam "bloqueadas" para sempre e contavam no "X de 39" — uma meta que
 * ela não tinha como cumprir. Saem da grade enquanto trancadas; quem já as
 * ganhou (no site) continua vendo a sua. Quando a tela existir no app, a
 * chave sai daqui.
 *
 * ⚠️ 21/10/2026, decisão do dono (rede social + gamificação, não conselho
 * médico): saíram o registro de peso, pressão e glicemia e a altura e o peso
 * de antes no Perfil. As três conquistas que pagavam por isso ("Saúde em
 * Dia", "Semana Saudável" e "Perfil Completo", que o servidor só dá com altura
 * e peso) ficam aqui — o jogo não premia mais dado de saúde.
 */
export const SEM_CAMINHO_NO_APP: ReadonlySet<string> = new Set([
  "first_health_log",
  "health_7_days",
  "profile_complete",
  "companion_invited",
  "album_post",
  "prenatal_done",
  "first_breastfeeding",
  "first_baby_weight",
  "first_vaccine",
  "first_baby_milestone",
]);

/**
 * A descrição como o APP a diz. O catálogo é do site e fala em "portal";
 * no app, a conta foi criada aqui.
 */
const DESCRICAO_NO_APP: Record<string, string> = {
  first_login: "Criou sua conta",
};

export function descricaoNoApp(def: ConquistaDef): string {
  return DESCRICAO_NO_APP[def.key] ?? def.description;
}

export function montarGrade(
  unlocked: readonly ConquistaDesbloqueada[],
  resgatadas: readonly string[] | null,
  catalogo: readonly ConquistaDef[] = CONQUISTAS_NO_APP,
): Cartao[] {
  const mapa = new Map(unlocked.map((u) => [u.achievement_key, u.unlocked_at] as const));
  const res = resgatadas === null ? null : new Set(resgatadas);
  return catalogo
    .map((def) => ({
      def,
      estado: estadoDe(def.key, mapa, res),
      quando: mapa.get(def.key) ?? null,
      sementinhas: RARIDADES[def.raridade].sementinhas,
    }))
    .filter((c) => !(c.estado === "bloqueada" && SEM_CAMINHO_NO_APP.has(c.def.key)));
}

export function paraResgatar(grade: readonly Cartao[]): number {
  return grade.filter((c) => c.estado === "resgatar").length;
}

/**
 * As seções da aba, NA ORDEM E COM OS EMOJIS DO SITE (conquistas-tab.tsx). Os
 * cartões ficam na ordem do catálogo, sem reordenar: as do pós-parto aparecem
 * no fim da categoria delas, e a nota do resumo explica que elas esperam o
 * nascimento.
 */
export const SECOES: readonly { chave: CategoriaConquista; rotulo: string; emoji: string }[] = [
  { chave: "bebe", rotulo: "Bebê", emoji: "👶" },
  { chave: "saude", rotulo: "Bem-estar", emoji: "🌿" },
  { chave: "diario", rotulo: "Diário", emoji: "📝" },
  { chave: "educacao", rotulo: "Educação", emoji: "🎓" },
  { chave: "familia", rotulo: "Família", emoji: "👨‍👩‍👧" },
];

export function secoes(
  grade: readonly Cartao[],
): { chave: CategoriaConquista; rotulo: string; emoji: string; cartoes: Cartao[] }[] {
  return SECOES.map((s) => ({
    ...s,
    cartoes: grade.filter((c) => c.def.category === s.chave),
  })).filter((s) => s.cartoes.length > 0);
}

/**
 * O cartão "Suas conquistas" do site: X de TODAS (as 39, com as do pós-parto),
 * a porcentagem, e a nota "N destas só acontecem depois que o bebê nascer"
 * enquanto nenhuma do pós-parto foi desbloqueada.
 */
export function resumo(grade: readonly Cartao[]) {
  const feitas = grade.filter((c) => c.estado !== "bloqueada").length;
  const total = grade.length;
  const posPartoTotal = grade.filter((c) => c.def.posParto).length;
  const posPartoFeitas = grade.filter((c) => c.def.posParto && c.estado !== "bloqueada").length;
  return {
    feitas,
    total,
    pct: total ? Math.round((feitas / total) * 100) : 0,
    posPartoTotal,
    mostrarNotaDoNascimento: posPartoFeitas === 0 && posPartoTotal > 0,
  };
}

/** "12 de 37" — o teto da gestante não conta as do pós-parto. */
export function placar(
  grade: readonly Cartao[],
  posParto: boolean,
): { feitas: number; total: number } {
  const daFase = grade.filter((c) => posParto || !c.def.posParto);
  return { feitas: daFase.filter((c) => c.estado !== "bloqueada").length, total: daFase.length };
}
