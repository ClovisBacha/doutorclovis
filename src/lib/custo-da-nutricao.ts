/**
 * QUANTO CUSTA UMA CONVERSA COM A NUTRICIONISTA — medido, não estimado.
 *
 * ⚠️ **ISTO É CÓDIGO, E NÃO PROSA, DE PROPÓSITO.** Este repositório já teve
 * três constantes de preço mortas e um comentário que inventava um canal de
 * receita inexistente; a lição escrita no CLAUDE.md é que **preço não se
 * escreve em prosa** — alguém lê o número seis meses depois e decide com ele.
 * Aqui o número é derivado dos tamanhos REAIS dos prompts e da MESMA tabela de
 * preço que o painel de Custo do admin usa (`custo-da-plataforma.ts`), então
 * ele não pode divergir dela sem o teste reprovar.
 *
 * ─── O QUE FOI MEDIDO, E COMO ───────────────────────────────────────────────
 *
 * Os tamanhos abaixo saíram de contar os caracteres dos prompts que estão no
 * ar (`wc -c` sobre os literais, e a régua pura executada com uma paciente
 * típica), não de estimativa:
 *
 * | peça                                        | caracteres |
 * | ------------------------------------------- | ---------- |
 * | `NUTRITION_SYSTEM`                          | ~14.600    |
 * | bloco da paciente (alergia + medicação)     | 562        |
 * | bloco do médico (teto de `MAX_BLOCK_CHARS`) | até 4.000  |
 * | a pergunta dela                             | ~120       |
 * | a resposta                                  | ~1.600     |
 *
 * ⚠️ **A SURPRESA DA MEDIÇÃO: A FOTO É MAIS BARATA QUE O TEXTO.** A intuição
 * diz o contrário — imagem parece cara. Mas o texto carrega catorze mil
 * caracteres de instrução MAIS o histórico inteiro a cada volta, e a foto
 * carrega um prompt de 132 caracteres e nenhum histórico. Foi por medir que
 * isto apareceu; sem medir, o teto da foto teria sido apertado no lugar
 * errado.
 */

import { DOLAR_EM_REAIS, custoEmCentavos } from "./custo-da-plataforma";

/**
 * Caracteres por token, em português.
 *
 * ⚠️ **É UMA APROXIMAÇÃO, e o arquivo diz isso em voz alta.** O tokenizador
 * do Gemini não está aqui para ser consultado; 3,7 é o meio da faixa de 3,5 a
 * 4,0 que se observa em português. O número REAL de cada chamada é gravado em
 * `ai_usage.input_tokens`, e o painel de Custo soma os de verdade — esta
 * constante serve para PLANEJAR (que preço, que teto), nunca para faturar.
 */
export const CHARS_POR_TOKEN = 3.7;

/** Os tamanhos medidos, em caracteres. Remexer num prompt obriga a remedir. */
export const TAMANHOS = {
  sistema: 14_600,
  blocoDaPaciente: 562,
  /** `MAX_BLOCK_CHARS` do Segundo Cérebro, mais a instrução que vem colada. */
  blocoDoMedico: 4_250,
  pergunta: 120,
  resposta: 1_600,
  /** O prompt da foto é minúsculo — é isso que a torna barata. */
  promptDaFoto: 132,
} as const;

/**
 * Tokens de uma imagem de 1024px.
 *
 * ⚠️ **NÚMERO DO FORNECEDOR, e não medido aqui.** O Gemini cobra imagem por
 * ladrilho: até 384px são 258 tokens; acima disso a imagem é recortada em
 * ladrilhos de 768×768, a 258 cada. Uma foto de 1024×1024 (`FOTO_LADO_MAX`)
 * dá 2×2 ladrilhos = 1.032. Se a Google mudar a regra, é esta linha que muda.
 */
export const TOKENS_DA_FOTO = 1_032;

const tokens = (chars: number) => Math.round(chars / CHARS_POR_TOKEN);

/** O modelo que os dois endpoints usam quando `CHAT_MODEL` não é trocado. */
export const MODELO_PADRAO = "gemini-2.5-flash";

/**
 * O custo de UMA pergunta de texto, em centavos de real.
 *
 * `turnosAnteriores` é o que faz o número crescer dentro de uma conversa: cada
 * volta anterior volta inteira no histórico. É por isso que a décima pergunta
 * custa mais que a primeira — e por que o teto diário é o limite que importa.
 */
export function custoDaMensagem(turnosAnteriores = 4, modelo = MODELO_PADRAO): number {
  const historico = turnosAnteriores * (TAMANHOS.pergunta + TAMANHOS.resposta);
  const entrada = tokens(
    TAMANHOS.sistema +
      TAMANHOS.blocoDaPaciente +
      TAMANHOS.blocoDoMedico +
      TAMANHOS.pergunta +
      historico,
  );
  return (
    custoEmCentavos({ modelo, input_tokens: entrada, output_tokens: tokens(TAMANHOS.resposta) }) ??
    0
  );
}

/** O custo de UMA foto (prato ou rótulo), em centavos de real. */
export function custoDaFoto(modelo = MODELO_PADRAO): number {
  const entrada = TOKENS_DA_FOTO + tokens(TAMANHOS.promptDaFoto + TAMANHOS.blocoDaPaciente);
  /* A resposta da foto tem teto de 700 e sai perto da metade dele. */
  return custoEmCentavos({ modelo, input_tokens: entrada, output_tokens: 350 }) ?? 0;
}

export type Cenario = {
  /** O que a paciente paga por mês, em reais. */
  precoMensal: number;
  /** Fatia que a loja fica: 0,15 (Small Business) ou 0,30 (padrão). */
  taxaDaLoja: number;
  /** Perguntas por dia. */
  porDia: number;
  /** Dias de uso no mês. */
  diasNoMes?: number;
};

export type Margem = {
  /** Receita líquida depois da loja, em reais. */
  liquido: number;
  /** Custo de modelo no mês, em reais. */
  custoDeIA: number;
  /** Custo de infraestrutura da paciente (docs/custo-de-infraestrutura.md). */
  custoDeInfra: number;
  /** O que sobra, em reais. */
  sobra: number;
  /** Fatia da receita líquida que a IA come. */
  fracaoDeIA: number;
};

/**
 * Infra por paciente ativa por mês, em reais.
 *
 * ⚠️ **Vem de `docs/custo-de-infraestrutura.md`, e não de um chute novo.** O
 * mesmo número que `entitlements.ts` já cita: banco, egresso e funções
 * somados. Recalculá-lo aqui faria duas contas para a mesma coisa.
 */
export const INFRA_POR_PACIENTE = 0.024;

/**
 * A margem de um cenário.
 *
 * ⚠️ **A conta usa o pior caso do teto**, e é essa a pergunta que interessa:
 * "se ela usar TUDO o que eu prometi, eu ainda ganho?". Precificar pela média
 * é como um plano de dados fica no vermelho no mês em que todo mundo assiste
 * vídeo.
 */
export function margemMensal(c: Cenario): Margem {
  const dias = c.diasNoMes ?? 30;
  const liquido = c.precoMensal * (1 - c.taxaDaLoja);
  /* Uma conversa típica tem umas cinco voltas, então a 5ª pergunta é a média
     honesta do custo por mensagem dentro de um dia. */
  const custoDeIA = (custoDaMensagem(4) / 100) * c.porDia * dias;
  const sobra = liquido - custoDeIA - INFRA_POR_PACIENTE;
  return {
    liquido,
    custoDeIA,
    custoDeInfra: INFRA_POR_PACIENTE,
    sobra,
    fracaoDeIA: liquido > 0 ? custoDeIA / liquido : 1,
  };
}

/** Só para relatório: o custo em dólares, que é como o fornecedor cobra. */
export function emDolares(centavosDeReal: number): number {
  return centavosDeReal / 100 / DOLAR_EM_REAIS;
}
