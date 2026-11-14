/**
 * SUGERIDO PARA VOCÊ — quem entra no feed sem ela ter pedido, e em que ordem.
 *
 * Pedido do dono: "faça mostrar sugeridos para você, pense e aplique o modelo
 * do Instagram". A parte de PENSAR é a que importa aqui, porque o modelo do
 * Instagram tem uma peça que neste app seria perigosa, e ela não vem junto.
 *
 * ─── O QUE NÃO FOI COPIADO, E É A DECISÃO CENTRAL ──────────────────────────
 *
 * ⚠️ **ENGAJAMENTO NÃO É SINAL AQUI. NENHUM.** Não entra número de reações,
 * não entra velocidade de reação, não entra nada que meça repercussão.
 *
 * É o que o Instagram usa acima de tudo, e é exatamente o que não pode ser
 * usado numa comunidade de gestação de alto risco: o post que gera mais reação
 * numa base assim é o da EMERGÊNCIA — o sangramento, o susto, a internação. Um
 * ranqueamento que aprende engajamento aprende a pôr o pior dia de uma paciente
 * como a primeira coisa que todas as outras veem, e a fazer isso justamente com
 * quem elas NÃO conhecem. O feed de quem ela segue já é cronológico por essa
 * mesma razão (ver a régua da rede); a zona de sugestões seria a porta dos
 * fundos dessa decisão.
 *
 * ⚠️ **E NÃO ENTRA "MESMO MÉDICO".** `patient_profiles.doctor_id` está ali,
 * daria um sinal ótimo e é dado de SAÚDE. Montar grafo social a partir de com
 * quem ela se trata é usar o prontuário para sugerir amizade — mesmo que a tela
 * nunca diga o motivo, o efeito é esse.
 *
 * ─── O QUE ENTRA ───────────────────────────────────────────────────────────
 *
 * 1. **Elos em comum** — quantas pessoas que EU sigo seguem aquela autora. É o
 *    sinal de verdade do Instagram ("seguido por fulana e mais 3"), e é o único
 *    que responde "por que esta pessoa, e não outra?" sem medir repercussão.
 *    ⚠️ Ele ordena e **nunca vai à tela**: escrever "seguida por Marina" entrega
 *    quem eu sigo a quem só abriu o feed, e a lista de seguidores deste app não
 *    é pública de propósito.
 * 2. **Recência**, dentro de cada faixa de elos.
 *
 * O pool de candidatas é montado no servidor e é estreito: perfil PÚBLICO (a
 * chave que diz, com todas as letras, "qualquer pessoa no app pode te achar e
 * te acompanhar"), post na camada PÚBLICO, e a régua `podeVerPost` por cima —
 * uma régua só, como sempre.
 */

/** Uma publicação que PODERIA ser sugerida, já filtrada pela régua. */
export type CandidataASugestao = {
  postId: string;
  autorId: string;
  /** ISO, como vem do banco. */
  criadoEm: string;
  /**
   * Quantas pessoas que eu sigo também seguem esta autora.
   *
   * ⚠️ Ordena e não aparece. Ver o cabeçalho.
   */
  elosEmComum: number;
};

/**
 * Quantos elos ainda fazem diferença na ordem.
 *
 * Acima disto tanto faz: uma autora com trinta elos e outra com quatro são as
 * duas "gente do meu círculo", e deixar o número correr solto faria a mais
 * conectada da base ocupar o topo da zona de sugestões de todo mundo, todo dia.
 */
export const ELOS_QUE_CONTAM = 3;

/**
 * Teto de publicações por autora numa mesma leva.
 *
 * ⚠️ Sem ele, uma pessoa pública que publica muito enche a zona inteira — e
 * numa base pequena isso não lê como "sugestão", lê como "o app está me
 * empurrando essa desconhecida". Duas dão para conhecer a voz de alguém.
 */
export const POSTS_POR_AUTORA = 2;

/** Quantas sugestões por leva. */
export const SUGESTOES_POR_LEVA = 10;

/**
 * Idade máxima de uma publicação sugerida.
 *
 * ⚠️ Trinta dias, e o corte é de gestação, não de rede social: quatro meses
 * atrás é OUTRO TRIMESTRE. Sugerir a uma gestante de 30 semanas o desabafo que
 * uma desconhecida escreveu no primeiro trimestre é entregar uma conversa que
 * já não é a dela. O feed de quem ela segue não tem esse corte de propósito —
 * lá são pessoas que ela escolheu, e o passado delas interessa.
 */
export const DIAS_DE_VALIDADE = 30;

/** A publicação ainda está dentro da janela? */
export function aindaVale(criadoEm: string, agora: number): boolean {
  const t = new Date(criadoEm).getTime();
  if (!Number.isFinite(t)) return false;
  return agora - t <= DIAS_DE_VALIDADE * 24 * 3600 * 1000;
}

/**
 * A ordem da zona de sugestões, e o teto por autora.
 *
 * Faixa de elos primeiro, recência dentro da faixa. Depois o teto por autora,
 * aplicado NA ORDEM — assim a autora com mais elos mantém as duas melhores
 * dela, e as excedentes não voltam por baixo.
 */
export function ordenarSugestoes(
  candidatas: CandidataASugestao[],
  agora: number,
  limite: number = SUGESTOES_POR_LEVA,
): CandidataASugestao[] {
  const vivas = candidatas.filter((c) => aindaVale(c.criadoEm, agora));

  const ordenadas = [...vivas].sort((a, b) => {
    const ea = Math.min(a.elosEmComum, ELOS_QUE_CONTAM);
    const eb = Math.min(b.elosEmComum, ELOS_QUE_CONTAM);
    if (ea !== eb) return eb - ea;
    return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });

  const quantas = new Map<string, number>();
  const saida: CandidataASugestao[] = [];
  for (const c of ordenadas) {
    const n = quantas.get(c.autorId) ?? 0;
    if (n >= POSTS_POR_AUTORA) continue;
    quantas.set(c.autorId, n + 1);
    saida.push(c);
    if (saida.length >= limite) break;
  }
  return saida;
}

/** Uma pessoa que poderia ser sugerida. */
export type PessoaSugerida = {
  id: string;
  elosEmComum: number;
  /** Última vez que apareceu no app, ISO — ou `null`. */
  ultimaVez: string | null;
};

/** Quantas pessoas a fileira de "Sugestões para você" mostra. */
export const PESSOAS_SUGERIDAS = 12;

/**
 * Quantas autoras entram na consulta de publicações.
 *
 * ⚠️ **É um teto de URL, não de gosto.** O PostgREST recebe o `in(...)` na
 * QUERY STRING: 400 uuids são ~15 KB de endereço, e proxy nenhum garante isso.
 * Sessenta cabem com folga.
 *
 * ⚠️ E o corte é feito DEPOIS de ordenar por elos — as sessenta mais próximas
 * dela, nunca as sessenta primeiras que o banco devolveu. Numa base grande,
 * uma publicação nova de alguém fora dessas sessenta não é sugerida naquela
 * leva; é o preço, e ele é pago pelo lado certo (quem tem elo com ela).
 */
export const AUTORAS_CONSULTADAS = 60;

/**
 * A ordem da fileira de pessoas.
 *
 * Elos primeiro, e depois **quem apareceu por último no app** — nunca quem tem
 * mais seguidoras. Sugerir por audiência transformaria a fileira num ranking de
 * popularidade, que é a coisa que este app decidiu não ter (não existe contador
 * público de seguidores). Quem esteve aqui ontem responde a outra pergunta:
 * seguir alguém que sumiu há seis meses é seguir um perfil parado.
 *
 * ⚠️ Sem `ultimaVez` a pessoa não é penalizada a ponto de sumir — ela vai para
 * o fim da faixa dela, e não para o fim da lista. `last_seen_at` só passou a
 * ser gravado em ago/2026: quem não abriu o app desde então tem `NULL`, e isso
 * não é sinal de conta abandonada, é sinal de coluna nova.
 */
export function ordenarPessoas(
  pessoas: PessoaSugerida[],
  limite: number = PESSOAS_SUGERIDAS,
): PessoaSugerida[] {
  return [...pessoas]
    .sort((a, b) => {
      const ea = Math.min(a.elosEmComum, ELOS_QUE_CONTAM);
      const eb = Math.min(b.elosEmComum, ELOS_QUE_CONTAM);
      if (ea !== eb) return eb - ea;
      const ta = a.ultimaVez ? new Date(a.ultimaVez).getTime() : 0;
      const tb = b.ultimaVez ? new Date(b.ultimaVez).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limite);
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * O FEED MISTURADO  (ago/2026)
 *
 * Pedido do dono: mostrar publicações de quem ela segue E de quem ela não
 * segue, com uma configuração para voltar ao fechado.
 *
 * ⚠️ **ISTO REVERTE O ARRANJO DO "VOCÊ ESTÁ EM DIA", e o argumento antigo fica
 * registrado porque ele não era estético.** A zona de sugestões só abria depois
 * que o feed de quem ela segue acabava, e a razão era: interlaçar desconhecidas
 * entre as pessoas que ela escolheu, num app de gestação de alto risco, faz a
 * paciente ler um relato duro sem saber se veio de uma amiga ou de uma estranha.
 *
 * O que venceu é de produto, e é do dono: um feed que só mostra quem ela já
 * segue não tem como crescer, e conta nova abre vazia.
 *
 * ⚠️ **MAS O RÓTULO NÃO SAIU** — e ele é a proteção que sobrevive à mistura.
 * Cada publicação de fora continua marcada "Sugerido para você". Misturar sem
 * avisar seria a única versão desta mudança que eu não faria.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Uma descoberta a cada quantas publicações de quem ela segue.
 *
 * Quatro é o que mantém a sensação de "meu feed com tempero" em vez de "feed de
 * estranhos com algumas amigas". Um número menor inverte o dono da tela.
 */
export const CADENCIA_DA_DESCOBERTA = 4;

/**
 * Costura as descobertas dentro do feed de quem ela segue.
 *
 * ⚠️ **NUNCA NA PRIMEIRA POSIÇÃO.** Abrir o aplicativo e a primeira coisa ser
 * uma desconhecida é o pior caso desta mudança: ela vem ver as amigas e recebe
 * um estranho na cara. A primeira leva pertence a quem ela escolheu, sempre.
 *
 * ⚠️ **E AS SOBRAS VÃO PARA O FIM, nunca descartadas.** Quem segue duas pessoas
 * tem duas publicações e vinte descobertas; jogar fora dezoito deixaria a tela
 * quase vazia justamente para quem mais precisa descobrir gente.
 */
export function intercalarDescobertas<T>(
  seguidos: readonly T[],
  descobertas: readonly T[],
  cadencia: number = CADENCIA_DA_DESCOBERTA,
): T[] {
  if (descobertas.length === 0) return [...seguidos];
  if (seguidos.length === 0) return [...descobertas];
  const passo = Math.max(1, Math.floor(cadencia));

  const saida: T[] = [];
  let fila = 0;
  for (let i = 0; i < seguidos.length; i++) {
    saida.push(seguidos[i]);
    /* `i + 1` para contar publicações JÁ colocadas: com `i`, a primeira
       descoberta entraria na posição 1 quando a cadência fosse 1. */
    if ((i + 1) % passo === 0 && fila < descobertas.length) {
      saida.push(descobertas[fila++]);
    }
  }
  for (; fila < descobertas.length; fila++) saida.push(descobertas[fila]);
  return saida;
}

/* ══════════════════════════════════════════════════════════════════════════
   AS TAGS EM ALTA
   ══════════════════════════════════════════════════════════════════════════ */

export type TagEmAlta = { tag: string; quantas: number };

/**
 * ⚠️ **"EM ALTA" AQUI É FREQUÊNCIA, e NUNCA engajamento.**
 *
 * É a mesma linha que a zona de sugestões traçou: numa base de gestação de alto
 * risco, o post que mais engaja é o da EMERGÊNCIA — o sangramento, o susto, a
 * internação. Uma lista de assuntos ordenada por reação poria o pior dia de
 * alguém como "o que está bombando", e para desconhecidas.
 *
 * O que conta é quantas PUBLICAÇÕES usaram a tag. Uma tag é um assunto; quantas
 * pessoas escreveram sobre ele é a única pergunta que a lista responde.
 *
 * ⚠️ **E há um PISO de duas publicações.** Uma tag usada uma vez não é assunto —
 * é uma frase de uma pessoa, e pô-la numa lista de "em alta" a expõe a
 * desconhecidas por acidente.
 */
export const MINIMO_PARA_ESTAR_EM_ALTA = 2;

/**
 * ⚠️ **A ORDEM DESEMPATA PELA TAG, e isso não é detalhe.** Sem desempate fixo, a
 * mesma lista troca de ordem entre duas aberturas — e uma lista que se mexe
 * sozinha ensina que ela não significa nada.
 */
export function ordenarTagsEmAlta(
  contagem: ReadonlyMap<string, number> | Record<string, number>,
  teto = 12,
): TagEmAlta[] {
  const entradas =
    contagem instanceof Map ? [...contagem.entries()] : Object.entries(contagem ?? {});
  return entradas
    .map(([tag, quantas]) => ({ tag, quantas }))
    .filter((t) => t.tag.trim().length > 0 && t.quantas >= MINIMO_PARA_ESTAR_EM_ALTA)
    .sort((a, b) => (b.quantas === a.quantas ? a.tag.localeCompare(b.tag) : b.quantas - a.quantas))
    .slice(0, teto);
}

/* ══════════════════════════════════════════════════════════════════════════
   AS BUSCAS RECENTES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **AS BUSCAS RECENTES FICAM NO APARELHO, e nunca no servidor.**
 *
 * O que ela procura na busca é o nome de pessoas e o nome de assuntos — e num
 * app de gestação de alto risco, "quem eu procurei" é um dado que não precisa
 * existir em lugar nenhum além da tela dela. É a mesma decisão da busca DENTRO
 * da conversa, que roda local pelo mesmo motivo.
 *
 * ⚠️ **E a chave carrega o id da conta**: o aparelho é compartilhado, e a lista
 * de quem a mãe procurou não pode aparecer para a filha que usa o mesmo
 * celular.
 */
export const BUSCAS_RECENTES_MAX = 8;

export function chaveDasBuscasRecentes(euId: string): string {
  return `dc-rede-buscas-${euId}`;
}

/**
 * ⚠️ **O TERMO NOVO VAI PARA O TOPO, e o repetido SOBE em vez de duplicar.**
 * Sem a deduplicação, procurar "ana" três vezes enche a lista inteira com a
 * mesma palavra — e o resto do histórico some por causa do teto.
 */
export function comBuscaNova(recentes: readonly string[], termo: string): string[] {
  const t = termo.trim();
  if (t.length < 2) return [...recentes];
  const semEle = recentes.filter((r) => r.toLowerCase() !== t.toLowerCase());
  return [t, ...semEle].slice(0, BUSCAS_RECENTES_MAX);
}
