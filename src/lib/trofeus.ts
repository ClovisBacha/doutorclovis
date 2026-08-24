/**
 * TROFÉUS — um por dia de cinco estrelas.
 *
 * ─── O QUE ERA, E POR QUE MUDOU ─────────────────────────────────────────────
 *
 * O troféu roxo do topo mostrava `stickers.length`: as figurinhas de ÁLBUM DA
 * SEMANA. O dono olhou e disse a coisa certa — "tenho três conquistas e ele
 * marca oito, não tem significado nenhum". E não tinha mesmo: figurinha de
 * semana e troféu são coisas diferentes, e o mesmo desenho contando as duas só
 * ensinava a ignorar o número.
 *
 * Agora o troféu conta o que o desenho promete: **dias em que ela fechou as
 * cinco estrelas**.
 *
 * ─── A FONTE É O LEDGER, E ISSO NÃO É DETALHE ───────────────────────────────
 *
 * Não é `doneDays.length`. `doneDays` mora no `localStorage` e sobe no blob do
 * `journey_state` — quem escreve é o navegador, e ele desbloquearia itens da
 * loja. A fonte é a linha `day_stars:<ciclo>:<dia>` que `grantDayStarsBonus`
 * grava **depois de o próprio ledger confirmar as cinco atividades**. Uma linha
 * por dia fechado, escrita só pelo servidor, e que já existia.
 *
 * Por isso o número não zera ao trocar de aparelho, e por isso ele pode
 * destrancar item pago sem virar porta dos fundos.
 */

/**
 * O prefixo das linhas que PROVAM cada atividade de bem-estar do dia.
 *
 * ─── POR QUE NÃO É MAIS `day_stars:` ────────────────────────────────────────
 *
 * A primeira versão contava as linhas `day_stars:<ciclo>:<dia>`, gravadas por
 * `grantDayStarsBonus`. Parecia a escolha óbvia — uma linha por dia fechado,
 * escrita só pelo servidor — e estava errada por um motivo que só apareceu com
 * o app na mão do dono: **ele fechou as cinco estrelas e o contador ficou em
 * zero**.
 *
 * `grantDayStarsBonus` é chamada UMA vez, no instante exato em que a quinta
 * estrela fecha, dentro de um `try/catch` que engole qualquer erro. Rede
 * oscilando, sessão expirada, app fechado antes da resposta, dia terminado
 * offline — a estrela acende no aparelho (é `localStorage`) e a linha nunca é
 * gravada. Não há segunda tentativa, e não sobra rastro: o troféu daquele dia
 * deixa de existir para sempre, em silêncio.
 *
 * As linhas `wellness:<atividade>:<ciclo>:<dia>` não têm esse problema. Cada
 * atividade grava a sua no momento em que é feita, e são elas que
 * `grantDayStarsBonus` já consultava para decidir se pagava o bônus — ou seja,
 * **sempre foram a prova; `day_stars` era só o recibo**. Contar a prova em vez
 * do recibo tem três efeitos:
 *
 *  · o troféu aparece mesmo quando o recibo se perdeu;
 *  · dias antigos entram RETROATIVAMENTE, sem migration;
 *  · a força anti-fraude é a mesma — quem escreve continua sendo só o servidor.
 *
 * `day_stars` continua existindo e continua pagando os 20 🌱 do dia. O que
 * mudou é quem responde "quantos troféus ela tem".
 */
export const PREFIXO_ATIVIDADE = "wellness:";

/**
 * Quantas atividades fecham um dia — e por que o número mora aqui.
 *
 * São as quatro de bem-estar (`WELLNESS_ACTIVITIES`). A aula é a quinta
 * estrela da TELA, mas não deixa linha `wellness:`, então o troféu conta
 * quatro. Já foram seis, e depois cinco (a respiração virou tema da
 * meditação): um número cravado noutro arquivo faria o troféu parar de
 * aparecer no dia em que a lista mudasse de novo — exatamente o defeito que
 * o comentário de `WELLNESS_ACTIVITIES` narra ter acontecido com o bônus.
 */
export const ATIVIDADES_POR_TROFEU = 4;

/**
 * OS ITENS QUE SÓ ABREM COM TROFÉU.
 *
 * Escolhidos pelo dono, e a escada segue o preço deles: o mais barato pede
 * menos. Troféu não substitui a Sementinha — ela continua pagando o item. O
 * troféu diz QUANDO a prateleira aparece, e é isso que o transforma num motivo
 * para voltar amanhã em vez de um número enfeitando o topo da tela.
 *
 * Dez dias completos é cerca de duas semanas de uso real (ninguém fecha os
 * cinco todo santo dia), o que põe o primeiro desbloqueio perto do momento em
 * que a loja grátis acaba — que é exatamente onde a economia precisa de um
 * novo horizonte.
 */
export const TROFEUS_PARA: Readonly<Record<string, number>> = {
  /* ⚠️ SEM PREÇO ESCRITO AQUI. As três linhas diziam "Borboleta — 74 🌱",
     "Fim de tarde no deserto — 240 🌱" e "Bolinhas Coração — 400 🌱"; o
     reajuste de ago/2026 levou os itens a 65, 550 e 1.000 e a prosa ficou. Não
     era narrativa histórica: os três números ERAM o argumento da escada ("a
     escada segue o preço deles"), e o argumento passou a se apoiar em valores
     que não existem mais. O preço mora em `cantinho.ts`, num lugar só. */
  /** Borboleta — o mais barato dos três. */
  "bicho-borboleta": 10,
  /** Fim de tarde no deserto — o do meio. */
  "fundo-deserto": 20,
  /** Bolinhas Coração — o mais caro. */
  "trilha-coracao": 30,
};

/**
 * OS TROFÉUS, A PARTIR DAS CHAVES DO LEDGER.
 *
 * Recebe as `dedupe_key` cruas (`wellness:<atividade>:<ciclo>:<dia>`) e conta
 * quantos DIAS têm as quatro atividades. Função pura para poder ser testada —
 * quem lê o banco é o servidor.
 *
 * Agrupa por `<ciclo>:<dia>` e não só por `<dia>`: o ciclo distingue uma
 * gestação da seguinte, e sem ele o dia 65 de duas gestações viraria um dia só,
 * apagando um troféu de quem já teve outro bebê no app.
 *
 * A mesma chave repetida não infla nada (`Set`), e uma atividade fora da lista
 * conhecida não conta — se amanhã alguém gravar `wellness:banho:...`, o dia não
 * passa a valer troféu por engano.
 */
export function trofeusDasChaves(
  chaves: readonly (string | null | undefined)[],
  atividadesValidas: readonly string[],
): number {
  const porDia = new Map<string, Set<string>>();
  const validas = new Set(atividadesValidas);
  for (const k of chaves) {
    const p = (k ?? "").split(":");
    /* `wellness:<atividade>:<ciclo>:<dia>` — quatro campos, e o ciclo pode ser
       uma data ISO (`2026-03-07`) ou `x`; nenhum dos dois tem `:`. */
    if (p.length !== 4 || p[0] !== "wellness") continue;
    const [, atividade, ciclo, dia] = p;
    if (!validas.has(atividade) || !ciclo || !/^\d+$/.test(dia)) continue;
    const chaveDoDia = `${ciclo}:${dia}`;
    const set = porDia.get(chaveDoDia) ?? new Set<string>();
    set.add(atividade);
    porDia.set(chaveDoDia, set);
  }
  let n = 0;
  for (const feitas of porDia.values()) {
    if (feitas.size >= ATIVIDADES_POR_TROFEU) n++;
  }
  return n;
}

/** Quantos troféus o item exige. `0` = não exige nenhum. */
export function trofeusExigidos(itemId: string): number {
  return TROFEUS_PARA[itemId] ?? 0;
}

/**
 * Quantos FALTAM. Zero quer dizer liberado — inclusive para item sem exigência.
 *
 * Devolver o que falta, e não só um booleano, é o que deixa a loja dizer
 * "faltam 4 troféus" em vez de "bloqueado". A segunda frase não dá o que fazer
 * a seguir, e é ela que faz a paciente achar que o item é pago em dinheiro.
 */
export function faltamTrofeus(itemId: string, trofeus: number): number {
  return Math.max(0, trofeusExigidos(itemId) - Math.max(0, Math.floor(trofeus || 0)));
}

export function itemLiberado(itemId: string, trofeus: number): boolean {
  return faltamTrofeus(itemId, trofeus) === 0;
}

/**
 * Os três, em ordem de escada — para a loja e a tela de troféus listarem sem
 * reordenar por conta própria.
 */
export function escadaDeTrofeus(): { itemId: string; trofeus: number }[] {
  return Object.entries(TROFEUS_PARA)
    .map(([itemId, trofeus]) => ({ itemId, trofeus }))
    .sort((a, b) => a.trofeus - b.trofeus);
}

/**
 * O PRÓXIMO DESBLOQUEIO — o que a tela do troféu mostra como horizonte.
 *
 * `null` quando ela já passou dos três. Nesse dia o número vira só placar, e
 * está tudo bem: inventar uma quarta meta que não existe seria pior.
 */
export function proximoDesbloqueio(trofeus: number): { itemId: string; trofeus: number } | null {
  return escadaDeTrofeus().find((d) => d.trofeus > trofeus) ?? null;
}
