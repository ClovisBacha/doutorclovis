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
