/**
 * OS MARCOS DA REDE (fase 3: conquistas por atos sociais).
 *
 * O catálogo de conquistas é do site, e só o servidor paga conquista — e
 * nenhuma das 39 é por ato social (primeira amiga, convite aceito, dupla,
 * primeira publicação). O app não pode criar conquista paga. Então os atos
 * sociais viram MARCOS do app: calculados do que o servidor já devolve, sem
 * sementinhas, e a tela diz isso.
 *
 * ⚠️ Marco ganho não se perde: a dupla desfeita ou a amiga que saiu não
 * "desconquistam" nada (a tela guarda o que já foi feito, por conta).
 * ⚠️ Nenhum marco conta seguidoras: número de seguidores vira placar, e a
 * Comunidade daqui não é placar (como a lista das amigas).
 *
 * Sem react-native: é testado pelo bun.
 */

export type DadosDaRede = {
  /** Quantas amigas (`minhasAmigas`); `null` se a leitura falhou. */
  amigas: number | null;
  /** O maior número de dias seguidos da dupla (`dupla.recorde`). */
  recordeDaDupla: number | null;
  /** Quantas amigas entraram pelo código dela (`getReferral`). */
  convites: number | null;
  /** Quantas publicações ela tem (a primeira página do perfil basta). */
  publicacoes: number | null;
};

export type DefDoMarco = {
  chave: string;
  emoji: string;
  titulo: string;
  texto: string;
  /** Marco da dupla: no pós-parto a dupla não existe, então só aparece se já foi feito. */
  daDupla?: boolean;
  feito: (d: DadosDaRede) => boolean;
};

const pelo = (n: number | null, minimo: number) => n != null && n >= minimo;

export const MARCOS_DA_REDE: readonly DefDoMarco[] = [
  {
    chave: "primeira-amiga",
    emoji: "👭",
    titulo: "Primeira amiga",
    texto: "Uma amiga aqui dentro, para dividir o caminho.",
    feito: (d) => pelo(d.amigas, 1),
  },
  {
    chave: "roda-de-amigas",
    emoji: "💞",
    titulo: "Roda de amigas",
    texto: "Três amigas no app.",
    feito: (d) => pelo(d.amigas, 3),
  },
  {
    chave: "convite-aceito",
    emoji: "💌",
    titulo: "Convite aceito",
    texto: "Uma amiga entrou pelo seu convite.",
    feito: (d) => pelo(d.convites, 1),
  },
  {
    chave: "dupla-acesa",
    emoji: "🔥",
    titulo: "Dupla acesa",
    texto: "O primeiro dia de chama com a sua dupla.",
    daDupla: true,
    feito: (d) => pelo(d.recordeDaDupla, 1),
  },
  {
    chave: "uma-semana-juntas",
    emoji: "🏅",
    titulo: "Uma semana juntas",
    texto: "Sete dias seguidos de chama em dupla.",
    daDupla: true,
    feito: (d) => pelo(d.recordeDaDupla, 7),
  },
  {
    chave: "primeira-publicacao",
    emoji: "📝",
    titulo: "Primeira publicação",
    texto: "Você contou algo seu na Comunidade.",
    feito: (d) => pelo(d.publicacoes, 1),
  },
];

/** As chaves feitas com os dados de agora. */
export function marcosFeitosAgora(d: DadosDaRede): string[] {
  return MARCOS_DA_REDE.filter((m) => m.feito(d)).map((m) => m.chave);
}

export type MarcoNaTela = DefDoMarco & { ganho: boolean; novo: boolean };

/**
 * Os marcos como a tela os mostra: ganho se foi feito agora OU já tinha sido
 * (guardado); novo se foi feito agora pela primeira vez. No pós-parto, os da
 * dupla só aparecem se já foram ganhos.
 */
export function marcosNaTela(o: {
  agora: readonly string[];
  guardados: readonly string[];
  pos: boolean;
}): MarcoNaTela[] {
  return MARCOS_DA_REDE.map((m) => {
    const ganho = o.agora.includes(m.chave) || o.guardados.includes(m.chave);
    return { ...m, ganho, novo: o.agora.includes(m.chave) && !o.guardados.includes(m.chave) };
  }).filter((m) => !(o.pos && m.daDupla && !m.ganho));
}
