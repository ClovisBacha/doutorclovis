/**
 * A CAMADA DE ÁUDIO GRAVADO — o caminho para o som deixar de ser sintetizado.
 *
 * Os 32 sons do app são sintetizados em tempo real, e isso foi a decisão certa
 * para chegar até aqui: custa zero byte de download, escala sem limite e é
 * mensurável. Mas a auditoria de qualidade encontrou o teto dessa escolha, e
 * ele é real: **nenhum aplicativo desta categoria usa síntese pura para som de
 * natureza.** Calm, Headspace e Endel usam gravação de campo, e não por
 * preguiça — chuva, fogo e passarinho são as texturas que síntese erra.
 *
 * As medidas dizem onde dói. Por família:
 *
 * | família        | síntese entrega          | precisa de gravação? |
 * | -------------- | ------------------------ | -------------------- |
 * | O quieto       | EXATO (ruído é ruído)    | não, nunca           |
 * | Tons           | é a natureza da coisa    | não                  |
 * | Ar (máquinas)  | filtro + harmônico basta | não                  |
 * | Águas          | bom, não ótimo           | melhora muito        |
 * | Fogo           | fraco (o corpo do fogo)  | SIM                  |
 * | Vida (bichos)  | o pior (canto de pássaro)| SIM, sem alternativa |
 *
 * ⚠️ **POR ISSO ESTE ARQUIVO NÃO SUBSTITUI O MOTOR — ELE O COMPLEMENTA.**
 * Trocar tudo por arquivo seria piorar metade: ruído branco gravado é ruído
 * branco com o chiado do microfone junto, e um pad gravado é um pad que não
 * pode mudar de duração. A gravação entra ONDE a medição disse que a síntese
 * perde, som a som, e o resto continua como está.
 *
 * ⚠️ **OS OITO SÃO CC0 DE VERDADE**, baixados pelo Openverse (que agrega o
 * Freesound) e conferidos duas vezes — no filtro da consulta e no resultado.
 * A procedência de cada um está em `public/sons/CREDITOS.json`; CC0 não exige
 * atribuição, mas sem o registro ninguém prova daqui a um ano que podia usar.
 * Baixar de novo: `node scripts/sons/do-openverse.mjs`.
 */

import type { SomKey } from "./som-receitas";

/**
 * Onde mora cada gravação, e o ganho MEDIDO dela.
 *
 * ⚠️ **O GANHO É MEDIDO, NUNCA CHUTADO** — é a mesma lei de `NIVEL_AO_VIVO`.
 * Sem ele, trocar de um som sintetizado para um gravado no meio da sessão dá
 * o salto de nível que aquela tabela existe para matar (foram 34,1 dB de
 * espalhamento antes dela). Quem mede é `node scripts/ouvir.mjs --niveis`.
 *
 * ⚠️ **O ARQUIVO VAI EM `public/sons/`, e NÃO em `src/assets/`.** Um `import`
 * de áudio entra no grafo do bundler e o Vite o carimba com hash — o que é
 * ótimo para imagem e péssimo aqui: o service worker guarda áudio num cache
 * PRÓPRIO e sem versão (`obstetricia-audio`), justamente para 16 MB de voz não
 * serem jogados fora a cada deploy. Caminho estável é o que torna esse cache
 * possível.
 */
export const GRAVADOS: Partial<Record<SomKey, { arquivo: string; ganho: number }>> = {
  /* ⚠️ O GANHO FECHA O QUE O `loudnorm` NÃO PÔDE FECHAR NO ARQUIVO.
     Os oito foram normalizados a −20 LUFS em duas passadas, mas a fogueira
     parou em −30,7: levá-la ao alvo dentro do arquivo exigiria comprimir, e
     comprimir fogo apaga justamente a diferença entre o estalo e o corpo dele.
     O arquivo fica limpo e a correção acontece AQUI, no player, onde o Web
     Audio trabalha em float e tem folga de sobra. Medido com
     `ebur128`; espalhamento no arquivo 11,5 LU → ~0 depois destes números. */
  fogueira: { arquivo: "/sons/fogueira.webm", ganho: 3.428 },
  lareira: { arquivo: "/sons/lareira.webm", ganho: 1.122 },
  passaros: { arquivo: "/sons/passaros.webm", ganho: 0.912 },
  sapos: { arquivo: "/sons/sapos.webm", ganho: 1.288 },
  cigarras: { arquivo: "/sons/cigarras.webm", ganho: 1.012 },
  "floresta-noite": { arquivo: "/sons/floresta-noite.webm", ganho: 0.977 },
  riacho: { arquivo: "/sons/riacho.webm", ganho: 1.514 },
  cachoeira: { arquivo: "/sons/cachoeira.webm", ganho: 1.288 },
};

/**
 * O ganho MEDIDO da gravação, ou 1 quando não há arquivo.
 *
 * ⚠️ Existe como função, e não como tabela separada, para não haver duas
 * listas que precisem concordar: o ganho mora ao lado do caminho do arquivo, e
 * o teste cobra os dois juntos. Uma segunda tabela divergiria no primeiro som
 * novo — e a divergência apareceria como um som entrando alto demais.
 */
export function ganhoGravado(k: SomKey): number {
  return GRAVADOS[k]?.ganho ?? 1;
}

/** Existe gravação para este som? */
export function temGravacao(k: SomKey): boolean {
  return !!GRAVADOS[k];
}

/**
 * ⚠️ **O CRUZAMENTO QUE FECHA O LAÇO — e ele é a razão de isto não ser só um
 * `<audio loop>`.**
 *
 * Um arquivo gravado NÃO emenda sozinho: o último quadro não continua o
 * primeiro, e o ouvido ouve o corte a cada volta — que é exatamente o defeito
 * que o motor sintetizado gastou uma rodada inteira para eliminar (a
 * auto-similaridade da chuva caiu de 0,997 para −0,002 quando o laço passou de
 * 2 s para 10 s).
 *
 * A conta é a MESMA de `costurar` em `som-continuo.ts`, e de propósito: o
 * trecho útil vira `L − C` quadros, e os `C` primeiros recebem o fim do
 * arquivo desbotando por cima. Duas implementações do mesmo cruzamento
 * divergiriam no primeiro ajuste, e a divergência apareceria como um estalo
 * que só acontece num dos dois caminhos.
 *
 * ⚠️ **`C` é PROPORCIONAL, com teto.** Um cruzamento fixo de 2 s numa gravação
 * de 8 s comeria um quarto dela; um de 50 ms numa de 60 s não fecha emenda
 * nenhuma. E o teto existe porque cruzamento longo demais vira eco: o mesmo
 * som tocando duas vezes, defasado.
 */
export function fecharLaco(
  canal: Float32Array<ArrayBuffer>,
  taxa: number,
): Float32Array<ArrayBuffer> {
  const L = canal.length;
  const C = Math.min(Math.floor(L * 0.15), Math.floor(taxa * 1.5));
  /* Arquivo curto demais para cruzar sem se comer: devolve como está. Melhor
     uma emenda audível que um trecho de meio segundo em laço. */
  if (C < taxa * 0.05 || C >= L / 2) return canal;
  const util = L - C;
  const saida = canal.slice(0, util);
  for (let i = 0; i < C; i++) {
    const w = i / C;
    saida[i] = saida[i] * w + canal[util + i] * (1 - w);
  }
  return saida;
}

/**
 * O buffer já costurado, guardado por contexto.
 *
 * ⚠️ **GUARDA A PROMESSA, NÃO O RESULTADO.** Dois toques rápidos no mesmo som
 * chegam antes de o primeiro `fetch` resolver, e guardando o resultado os dois
 * baixariam o arquivo. É a mesma lição da fila `emVoo` do service worker e do
 * `bancoEmVoo` das aulas.
 */
const emVoo = new WeakMap<BaseAudioContext, Map<SomKey, Promise<AudioBuffer | null>>>();

/**
 * Busca, decodifica e costura a gravação. `null` quando não há arquivo, quando
 * a rede falhou ou quando o áudio não decodifica.
 *
 * ⚠️ **FALHA SEMPRE PARA `null`, NUNCA PARA EXCEÇÃO.** Quem chama usa isto para
 * decidir entre gravação e síntese; uma exceção subindo daqui derrubaria o som
 * inteiro em vez de cair na síntese, que é o oposto do objetivo. Som que existe
 * é melhor que o som perfeito que não veio.
 */
export async function carregarGravado(
  ctx: BaseAudioContext,
  k: SomKey,
): Promise<AudioBuffer | null> {
  const alvo = GRAVADOS[k];
  if (!alvo) return null;

  let porContexto = emVoo.get(ctx);
  if (!porContexto) {
    porContexto = new Map();
    emVoo.set(ctx, porContexto);
  }
  const jaPedido = porContexto.get(k);
  if (jaPedido) return jaPedido;

  const pedido = (async () => {
    try {
      const r = await fetch(alvo.arquivo);
      if (!r.ok) return null;
      const cru = await ctx.decodeAudioData(await r.arrayBuffer());

      /* ⚠️ O cruzamento é aplicado em CADA canal com o MESMO comprimento.
         Costurar os canais em tamanhos diferentes desalinharia o estéreo — a
         imagem andaria para um lado a cada volta do laço. */
      const canais: Float32Array<ArrayBuffer>[] = [];
      for (let c = 0; c < cru.numberOfChannels; c++) {
        /* `getChannelData` é tipado com `ArrayBufferLike` (pode ser
           `SharedArrayBuffer`); `copyToChannel` exige `ArrayBuffer`. A cópia
           resolve o tipo e é barata — roda uma vez por arquivo, não por
           quadro. */
        const canal = new Float32Array(cru.getChannelData(c));
        canais.push(fecharLaco(canal, cru.sampleRate));
      }
      const util = Math.min(...canais.map((c) => c.length));
      if (util <= 0) return null;

      const pronto = ctx.createBuffer(cru.numberOfChannels, util, cru.sampleRate);
      for (let c = 0; c < canais.length; c++) pronto.copyToChannel(canais[c].subarray(0, util), c);
      return pronto;
    } catch {
      return null;
    }
  })();

  porContexto.set(k, pedido);
  return pedido;
}
