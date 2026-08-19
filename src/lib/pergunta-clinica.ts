/**
 * O QUE NÃO PODE VIRAR CONVERSA ENTRE PACIENTES — a régua, pura e testável.
 *
 * ─── POR QUE ELA SAIU DE `secondbrain.server.ts` ───────────────────────────
 *
 * As duas listas abaixo viviam dentro do roteador do chat, onde só o servidor
 * as alcançava. A caixinha de perguntas precisa das MESMAS: uma segunda cópia
 * divergiria no primeiro conserto, e a divergência apareceria como uma pergunta
 * clínica virando post público — que é exatamente o desfecho que esta régua
 * existe para impedir.
 *
 * `secondbrain.server.ts` passou a importar daqui. Uma lista, dois usos.
 *
 * ─── ⚠️ O NOME É "REDUZ RISCO", NUNCA "IMPEDE" ─────────────────────────────
 *
 * `TERMOS_CLINICOS` é uma ALLOWLIST, e allowlist de vocabulário clínico é uma
 * lista que nunca fica pronta: medido no chat, **61 de 85 termos comuns eram
 * invisíveis** — inclusive `aborto`, `pré-eclâmpsia`, `convulsão`, `desmaio`,
 * `visão embaçada`, `trombose`, `bolsa rota` e `depressão`.
 *
 * Chamar isto de "filtro que impede pergunta clínica" é o que faz alguém parar
 * de olhar. Ele REDUZ risco. O que segura o resto são as decisões de desenho ao
 * redor — a resposta é dela e passa pela régua também, a caixa é opt-in, há
 * teto diário, e há denúncia e bloqueio a partir de cada pergunta.
 */

/* Fronteiras que respeitam acento — `\b` do JavaScript é ASCII, e `dor` sem
   fronteira casa dentro de "aDORei". */
const PRE = "(?<![0-9a-zà-ÿ])";
const POS = "(?![a-zà-ÿ])";

function comFronteira(alternativas: string): string {
  return `${PRE}(?:${alternativas})${POS}`;
}

/**
 * BANDEIRAS VERMELHAS — vencem qualquer outra regra, sempre.
 *
 * Curta de propósito: só o que, aparecendo, torna a conversa clínica
 * independentemente de tudo mais que esteja escrito junto. Esta lista existe
 * para que a palavra que ninguém lembrou não vire incidente.
 */
export const BANDEIRA_VERMELHA = new RegExp(
  comFronteira(
    [
      "sangra\\w*|sangrando|hemorragi\\w*|aborto|abortei|natimort\\w*",
      "perdi (?:o|a|meu|minha) (?:beb(?:ê|e)|gesta(?:ç|c)(?:ã|a)o|gravidez|filh\\w*)|perda gestacional",
      "convuls(?:ã|a)\\w*|desmai\\w*|desmaiei|apagu(?:ei|ou)|conv(?:ú|u)ls\\w*",
      "pr(?:é|e)[- ]?ecl(?:â|a)mps\\w*|ecl(?:â|a)mps\\w*|press(?:ã|a)o (?:alta|nas alturas)",
      "vis(?:ã|a)o (?:embaçada|emba(?:ç|c)ada|turva|escura)|vendo (?:pontos|estrelas)",
      "falta de ar|n(?:ã|a)o (?:consigo|estou conseguindo) respirar|sufoca\\w*|dispnei\\w*",
      "trombos\\w*|emboli\\w*|infart\\w*|avc|derrame",
      "bolsa (?:rompeu|estourou|rota)|perdendo l(?:í|i)quido|contra(?:ç|c)(?:õ|o)es fortes",
      "beb(?:ê|e) n(?:ã|a)o (?:mexe|est(?:á|a) mexendo)|parou de mexer|n(?:ã|a)o sinto o beb",
      "quero morrer|me matar|me machucar|tirar minha vida|acabar com tudo|suic(?:í|i)d\\w*",
      "febre alta|39 graus|40 graus|convulsion\\w*|n(?:ã|a)o para de vomitar",
    ].join("|"),
  ),
  "i",
);

/** Vocabulário de corpo, exame e remédio. Allowlist — ver o cabeçalho. */
export const TERMOS_CLINICOS = new RegExp(
  comFronteira(
    [
      "dor(?:es)?|sang(?:r|u)[0-9a-zà-ÿ]*|c(?:ó|o)lica[0-9a-zà-ÿ]*|contra(?:ç|c)[0-9a-zà-ÿ]*|enjo[0-9a-zà-ÿ]*|n(?:á|a)usea[0-9a-zà-ÿ]*|v(?:ô|o)mit[0-9a-zà-ÿ]*|tontur[0-9a-zà-ÿ]*",
      "press(?:ã|a)o|glicem[0-9a-zà-ÿ]*|diabet[0-9a-zà-ÿ]*|incha[0-9a-zà-ÿ]*|edema|febre|corrim[0-9a-zà-ÿ]*|secre(?:ç|c)[0-9a-zà-ÿ]*",
      "beb(?:ê|e)|feto|mex(?:e|i|eu|em|endo)|chute[0-9a-zà-ÿ]*|movimento[0-9a-zà-ÿ]*|barriga|(?:ú|u)tero|placenta|l(?:í|i)quido",
      "exame[0-9a-zà-ÿ]*|ultrassom|ultrasso[0-9a-zà-ÿ]*|resultado[0-9a-zà-ÿ]*|hemogram[0-9a-zà-ÿ]*|urina|parto|ces(?:á|a)re[0-9a-zà-ÿ]*|amamenta[0-9a-zà-ÿ]*",
      "rem(?:é|e)dio[0-9a-zà-ÿ]*|medicament[0-9a-zà-ÿ]*|comprimido[0-9a-zà-ÿ]*|dose|tomar|s(?:í|i)ntoma[0-9a-zà-ÿ]*|sinto|senti|semana[0-9a-zà-ÿ]*",
    ].join("|"),
  ),
  "i",
);

/**
 * PEDIDO DE CONDUTA — a forma que torna qualquer texto perigoso.
 *
 * ⚠️ Isto é o que faltava, e é o caso que fechou os comentários: "**comigo foi
 * assim, não precisa ir ao pronto-socorro**" não tem bandeira vermelha nenhuma
 * e é a frase mais perigosa que uma paciente pode escrever para outra.
 *
 * O padrão não é o vocabulário — é a FORMA: conselho na segunda pessoa sobre o
 * que fazer ou não fazer. Ele pega tanto o pedido ("posso tomar?") quanto a
 * entrega ("pode tomar", "não precisa ir").
 */
export const PEDIDO_DE_CONDUTA = new RegExp(
  [
    /* Pedindo: "posso tomar", "devo ir", "é normal", "é perigoso" */
    "\\bposso\\b|\\bdevo\\b|\\bpreciso ir\\b|\\btenho que ir\\b",
    "(?:é|e) normal\\b|(?:é|e) perigos\\w*|(?:é|e) grave\\b|faz mal\\b|pode fazer mal\\b",
    /* Entregando: conselho na segunda pessoa */
    "\\b(?:pode|podes|n(?:ã|a)o precisa|n(?:ã|a)o precisas|tome|toma|n(?:ã|a)o tome|n(?:ã|a)o toma|v(?:á|a)|n(?:ã|a)o v(?:á|a)|espera|espere|fica em casa|n(?:ã|a)o vale a pena ir)\\b",
    "no seu lugar eu\\b|se fosse (?:eu|comigo)\\b|comigo foi\\b",
  ].join("|"),
  "i",
);

/**
 * SINTOMA EM PRIMEIRA PESSOA — o vocabulário clínico só roteia com ele.
 *
 * ⚠️ **`TERMOS_CLINICOS` sozinho NÃO serve para texto social**, e medi isto:
 * "vocês fizeram chá de bebê?" ia para a fila do médico, porque `bebê` está na
 * lista. Numa caixinha de gestante, `bebê`, `barriga`, `parto` e `semana` são o
 * assunto — rotear tudo isso mataria o recurso e afogaria o consultório.
 *
 * A lista foi escrita para o CHAT, onde incluir demais é barato: o custo de um
 * falso positivo lá é uma unidade de cota. Aqui o custo é a paciente receber
 * "mandei para o seu médico" sobre um chá de bebê, e parar de usar a caixa.
 *
 * O que importa não é falar de corpo — é falar do PRÓPRIO corpo AGORA. "Como
 * foi o seu parto?" é conversa; "estou com dor" é sintoma. A diferença está na
 * primeira pessoa do presente, e é ela que este padrão procura.
 */
export const SINTOMA_EM_PRIMEIRA_PESSOA = new RegExp(
  "(?:estou|to|tô|tenho|sinto|senti|apareceu|comecei a|acordei com|fiquei com)\\s+" +
    "(?:com\\s+|muita\\s+|muito\\s+|uma\\s+|um\\s+)*",
  "i",
);

export type DesfechoDaPergunta =
  /** Pode virar post: não pede conduta e não fala de corpo. */
  | "publicavel"
  /** Fala de corpo ou pede conduta — vai para o médico DE QUEM PERGUNTOU. */
  | "clinica"
  /** Bandeira vermelha — abre a Central de Emergência, agora. */
  | "emergencia";

/**
 * Para onde este texto vai.
 *
 * ⚠️ **A ordem é a régua.** Bandeira vermelha vence tudo; depois vem pedido de
 * conduta (que é FORMA, não vocabulário); e só então o vocabulário clínico —
 * e este último só conta acompanhado da primeira pessoa do presente.
 * Invertida, "não precisa ir ao pronto-socorro" cairia em `publicavel`, porque
 * não tem termo clínico nenhum.
 *
 * ⚠️ **E ela roda na RESPOSTA também.** O texto perigoso é a resposta, não a
 * pergunta: foi ele que fechou os comentários (de 1.098 respostas com conselho
 * em fóruns de gestação, 20,9% erradas e 5,5% potencialmente danosas).
 */
export function triarTexto(texto: string): DesfechoDaPergunta {
  const t = (texto ?? "").trim();
  if (!t) return "publicavel";
  if (BANDEIRA_VERMELHA.test(t)) return "emergencia";
  if (PEDIDO_DE_CONDUTA.test(t)) return "clinica";
  /* ⚠️ O vocabulário clínico só roteia junto com a primeira pessoa do
     presente — ver `SINTOMA_EM_PRIMEIRA_PESSOA`. Sozinho, ele mandaria "chá de
     bebê" para o consultório. */
  if (SINTOMA_EM_PRIMEIRA_PESSOA.test(t) && TERMOS_CLINICOS.test(t)) return "clinica";
  return "publicavel";
}

/**
 * O que a tela diz a quem escreveu.
 *
 * ⚠️ **Nunca o motivo detalhado.** Devolver "sua pergunta tem a palavra X"
 * ensina quais palavras passam, e quem quiser burlar precisa de duas tentativas.
 * A mensagem diz PARA ONDE foi, que é o que ela precisa saber.
 */
export function recadoDoDesfecho(d: DesfechoDaPergunta): string {
  if (d === "emergencia") {
    return "Isso precisa de atendimento agora, não de uma resposta aqui.";
  }
  if (d === "clinica") {
    return "Mandei a sua pergunta para o seu médico — é com ele que isso se resolve.";
  }
  return "Pergunta enviada 💛";
}

/** Teto diário de perguntas por pessoa. Sem ele, a caixa vira ferramenta de spam. */
export const PERGUNTAS_POR_DIA = 10;

/** Tamanho máximo. Uma caixinha é uma pergunta, não um desabafo. */
export const LIMITE_DA_PERGUNTA = 280;
