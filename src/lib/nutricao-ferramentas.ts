/**
 * AS FERRAMENTAS DA NUTRICIONISTA — as perguntas que só ela recebe.
 *
 * Pedido do dono: a Nutrição estava "muito vibe codado" — um chat genérico com
 * quatro chips. O que separa uma nutricionista de um chat é o que se pergunta a
 * ela, e as três perguntas mais frequentes da gestação têm FORMA fixa:
 *
 *   "posso comer X?"      → a de segurança alimentar (sushi, queijo, café…)
 *   "o que eu como agora?" → a do prato da próxima refeição
 *   "estou com enjoo"      → a do alívio por alimentação
 *
 * As três viram botões que MONTAM a pergunta e a mandam para a MESMA conversa.
 * Nada aqui responde: quem responde é `/api/nutrition`, com a régua de Modo
 * Cuidado e a cota de sempre. O que este arquivo faz é escrever a pergunta
 * direito — e é por isso que ele é puro e testado.
 *
 * ⚠️ EM MODO CUIDADO NENHUM MODELO DIZ "GESTAÇÃO". A ferramenta continua
 * existindo (comer bem é dela, não do bebê), mas a frase que ela manda não
 * pode carregar a palavra que o Modo Cuidado existe para calar. Há teste.
 */

export const REFEICOES = ["Café da manhã", "Almoço", "Lanche", "Jantar"] as const;
export type Refeicao = (typeof REFEICOES)[number];

/** Rótulo do chip e a forma que entra na frase ("estou com sem apetite" não existe). */
export const ALIVIOS = [
  { rotulo: "Enjoo", frase: "enjoo" },
  { rotulo: "Azia", frase: "azia" },
  { rotulo: "Prisão de ventre", frase: "prisão de ventre" },
  { rotulo: "Sem apetite", frase: "pouco apetite" },
  { rotulo: "Vontade de doce", frase: "muita vontade de doce" },
] as const;

/** O que ela digita em "Posso comer?" entra numa frase — limpo e curto. */
export const ALIMENTO_MAX = 60;
export function limparAlimento(texto: string): string | null {
  const t = texto.replace(/\s+/g, " ").trim().slice(0, ALIMENTO_MAX);
  return t.length >= 2 ? t : null;
}

export function perguntaPossoComer(alimento: string, careMode: boolean): string {
  const onde = careMode ? "" : " na gestação";
  return `Posso comer ${alimento}${onde}? Se sim, como preparar e com que frequência; se não, por quê e o que colocar no lugar.`;
}

/**
 * O momento do dia vira uma das QUATRO refeições que `perguntaDoPrato` aceita.
 *
 * ⚠️ `momentoDoDia` tem sete valores (inclui ceia e madrugada) porque ele
 * escreve o CONVITE; `REFEICOES` tem quatro porque é o que a paciente escolhe
 * na ferramenta. Sem esta conversão o convite da ceia mandaria uma refeição que
 * o modelo não conhece — e "monte um ceia" não é português.
 */
export function refeicaoDaHora(hora: number): Refeicao {
  if (hora < 5) return "Lanche";
  if (hora < 11) return "Café da manhã";
  if (hora < 14) return "Almoço";
  if (hora < 18) return "Lanche";
  if (hora < 21) return "Jantar";
  return "Lanche";
}

export function perguntaDoPrato(refeicao: Refeicao): string {
  return `Monte um ${refeicao.toLowerCase()} equilibrado para mim hoje, com as porções e uma opção simples de preparar.`;
}

export function perguntaDeAlivio(frase: string): string {
  return `Estou com ${frase}. O que comer e o que evitar para aliviar, e como distribuir as refeições ao longo do dia?`;
}

/* ─── O QUE TENHO EM CASA ────────────────────────────────────────────────────
   ⚠️ A pergunta que nenhum app grande faz e que é a do Brasil real: fim do mês,
   geladeira do jeito que está, e a resposta tem de sair DALI. Um app que só
   sabe sugerir salmão e quinoa é um app que ela fecha. */
export const INGREDIENTES_MAX = 200;

export function limparIngredientes(texto: string): string | null {
  const t = texto.replace(/\s+/g, " ").trim().slice(0, INGREDIENTES_MAX);
  return t.length >= 3 ? t : null;
}

export function perguntaDoQueTenho(ingredientes: string, momento: string): string {
  /* ⚠️ "só com o que eu listei" é a instrução inteira: sem ela o modelo
     acrescenta três compras à lista e a resposta deixa de servir. */
  return `Tenho em casa: ${ingredientes}. Monte uma opção de ${momento} usando SÓ o que eu listei (pode faltar tempero, tudo bem). Se der para melhorar com uma coisa barata que eu possa comprar depois, diga no fim — mas a receita tem de funcionar sem ela.`;
}

/* ─── OS SUPLEMENTOS QUE O MÉDICO PRESCREVEU ────────────────────────────────
   ⚠️ O app NUNCA sugere suplemento — ele acompanha o que já foi prescrito.
   A lista sai de `patient_profiles.medications`, que é campo livre escrito por
   ela ou pelo consultório; aqui só se separa em itens para virar checklist.

   ⚠️ E o que fazemos com "tomei hoje" é MARCAR, nunca cobrar: quem esquece o
   ferro numa gestação de alto risco já tem quem cobre. */
export const SEPARADORES = /[,;\n]|\s+e\s+/;

export function itensDaPrescricao(medications: string | null | undefined): string[] {
  if (!medications) return [];
  return (
    medications
      .split(SEPARADORES)
      .map((s) => s.replace(/\s+/g, " ").trim())
      /* ⚠️ Item de uma letra é resto de separador, não remédio. E o teto de
       oito existe porque um checklist de vinte linhas não se marca. */
      .filter((s) => s.length >= 2)
      .slice(0, 8)
  );
}

export const PREFIXO_SUPLEMENTOS = "dc-suplementos:";
export function chaveDosSuplementos(diaLocal: string): string {
  return `${PREFIXO_SUPLEMENTOS}${diaLocal}`;
}
export function chavesDeSuplementosVencidas(chaves: readonly string[], diaLocal: string): string[] {
  const deHoje = chaveDosSuplementos(diaLocal);
  return chaves.filter((k) => k.startsWith(PREFIXO_SUPLEMENTOS) && k !== deHoje);
}

/** A frase do rodapé do checklist — o FATO, nunca cobrança. Há teste. */
export function resumoDosSuplementos(marcados: number, total: number): string {
  if (total === 0) return "";
  if (marcados === 0) return `${total} ${total === 1 ? "item" : "itens"} do seu médico`;
  if (marcados >= total) return "Tudo em dia hoje 💛";
  return `${marcados} de ${total} hoje`;
}

/* ─── A ÁGUA DO DIA ─────────────────────────────────────────────────────────
   Um contador, não uma meta clínica: 8 copos (~2 litros) é REFERÊNCIA, e a
   tela diz isso. Vive no `localStorage` do aparelho, UMA chave por dia local.
   ⚠️ Chave `dc-agua:`, NUNCA `dc-path-`: essa viaja no blob da jornada e
   dispara um push por escrita — oito toques por dia virariam oito pushes. E
   as chaves de outros dias são apagadas a cada escrita: neste app, estourar a
   cota do `localStorage` derruba a PRÓXIMA gravação de qualquer coisa. */
export const META_COPOS = 8;
export const PREFIXO_AGUA = "dc-agua:";
export function chaveDaAgua(diaLocal: string): string {
  return `${PREFIXO_AGUA}${diaLocal}`;
}
export function chavesDeAguaVencidas(chaves: readonly string[], diaLocal: string): string[] {
  const deHoje = chaveDaAgua(diaLocal);
  return chaves.filter((k) => k.startsWith(PREFIXO_AGUA) && k !== deHoje);
}
