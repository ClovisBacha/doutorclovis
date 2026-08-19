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
      /* ⚠️ **MOVIMENTO REDUZIDO, e não só ausente.** A lista pegava "não mexe"
         e "parou de mexer" — e deixava passar "mexeu bem menos hoje", que é a
         frase que a paciente de verdade escreve e o motivo obstétrico número um
         para ir ser monitorada. Medido. */
      "mex\\w*\\s+(?:bem\\s+|muito\\s+)?menos|diminu(?:í|i)\\w*\\s+(?:os\\s+)?movimento",
      "menos movimento|pouco movimento|quase n(?:ã|a)o (?:mexe|sinto)",
      /* ⚠️ "perdi líquido" — a lista tinha só "perdendo líquido". */
      "perdi\\s+(?:um pouco de\\s+)?l(?:í|i)quido|perdendo l(?:í|i)quido|molhou a calcinha",
      /* ⚠️ A VISTA, em linguagem de gente: a lista pedia "embaçada/turva". */
      "vista\\s+(?:\\w+\\s+){0,2}?(?:estranha|escura|escurec\\w*|emba(?:ç|c)\\w*|turva)",
      /* Ideação por eufemismo. ⚠️ "não aguento mais" fica de FORA de propósito:
         é hipérbole cotidiana ("não aguento mais essa azia"), e abrir a Central
         de Emergência nela ensinaria a ignorar o alarme. Só as inequívocas. */
      "penso em sumir|queria sumir|sumir do mapa|desaparecer para sempre",
      "n(?:ã|a)o quero mais viver|acabar comigo|dar um fim em mim",
    ].join("|"),
  ),
  "i",
);

/** Vocabulário de corpo, exame e remédio. Allowlist — ver o cabeçalho. */
/**
 * PRESSÃO EM NÚMEROS — bandeira vermelha por conta própria.
 *
 * ⚠️ **"minha pressão deu 15 por 10" não tinha NADA que a régua reconhecesse**:
 * a bandeira listava "pressão alta" por extenso, e ninguém escreve assim. Numa
 * gestação de alto risco esse número é o assunto.
 *
 * Duas formas, e as duas evitam data: a palavra `pressão` perto de um par de
 * números, ou o par escrito com **"por"** por extenso — que é como se fala
 * pressão e não é como se escreve data.
 */
export const PRESSAO_EM_NUMEROS = new RegExp(
  [
    "(?:press(?:ã|a)o|\\bpa\\b)[^0-9]{0,20}\\d{1,3}\\s*(?:por|x|\\/)\\s*\\d{1,3}",
    "\\d{1,3}\\s*por\\s*\\d{1,3}",
  ].join("|"),
  "i",
);

/**
 * O QUE PEDE MÉDICO, MAS NÃO É A CENTRAL DE EMERGÊNCIA.
 *
 * ⚠️ Categoria própria porque os dois desfechos têm CUSTOS opostos. Barriga
 * endurecendo é conversa diária de terceiro trimestre — mandar cada uma para a
 * Central ensinaria a ignorar o alarme; deixá-la virar post público deixaria
 * "endureceu 10 vezes comigo e não fui" circular com o nome do consultório em
 * volta. O meio-termo é o médico dela.
 */
export const SINAL_QUE_PEDE_MEDICO = new RegExp(
  [
    "barriga\\s+(?:muito\\s+)?endurec|endurec\\w*\\s+(?:a\\s+)?barriga|barriga dura",
    "contra(?:ç|c)(?:õ|o)es|contraindo",
    /* Uterotônico e abortivo caseiro: nunca vira post, sempre vai ao médico. */
    "misoprostol|cytotec|(?:ó|o)leo de r(?:í|i)cino|ch(?:á|a) de canela|ch(?:á|a) de buchinha",
    "\\bcolo\\b.{0,15}(?:curto|dilat)|dilatada|tamp(?:ã|a)o mucoso",
    /* Números de exame ditos sem primeira pessoa. */
    "glicem\\w*[^0-9]{0,20}\\d{2,3}|glicose[^0-9]{0,20}\\d{2,3}|\\d{2,3}\\s*em jejum",
  ].join("|"),
  "i",
);

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
 * ENTREGA DE CONDUTA — dizer à outra o que fazer, ou o que não precisar fazer.
 *
 * ⚠️ **É esta a forma que carrega o risco, e ela é INCONDICIONAL.** "Comigo foi
 * assim, não precisa ir ao pronto-socorro" não tem bandeira vermelha nenhuma e
 * é a frase mais perigosa que uma paciente pode escrever para outra — foi ela
 * que fechou os comentários deste app.
 *
 * ⚠️ **A primeira versão pegava só a forma EXATA.** Medido rodando a função
 * contra frases que uma gestante escreveria: "no meu caso eu não fui",
 * "ficaria em casa e observaria", "melhor esperar amanhã", "eu não precisei de
 * médico", "deixa pra amanhã" — TODAS passavam como publicáveis. São a mesma
 * frase parafraseada, e nenhuma variante natural era pega. O padrão dominante
 * é o **relato de conduta na primeira pessoa do passado** ("eu não fui e deu
 * tudo certo"), que é justamente o que soa mais confiável para quem lê.
 */
/**
 * ⚠️ **DUAS SUBLISTAS, porque as duas perguntas são diferentes.**
 *
 * `TERMOS_CLINICOS` é a lista do CHAT e fica intacta — lá incluir demais é
 * barato. Aqui ela é larga demais para decidir sozinha, e por dois motivos
 * medidos e opostos:
 *
 *  · `parto`, `bebê`, `barriga` e `semana` são o ASSUNTO desta comunidade, e
 *    mandavam "posso levar minha mãe na sala de parto?" ao consultório;
 *  · `tomar` é verbo comum, e mandava "estou com saudade de tomar cerveja kkk".
 *
 * Então cada ramo da triagem pergunta o que é dele: quem PEDE conduta precisa
 * de algo que se tome ou se faça; quem relata sintoma precisa de um SINAL DO
 * CORPO.
 */
export const SINTOMAS_DO_CORPO = new RegExp(
  comFronteira(
    [
      "dor(?:es)?|c(?:ó|o)lica[0-9a-zà-ÿ]*|enjo[0-9a-zà-ÿ]*|n(?:á|a)usea[0-9a-zà-ÿ]*",
      "v(?:ô|o)mit[0-9a-zà-ÿ]*|tontur[0-9a-zà-ÿ]*|incha[0-9a-zà-ÿ]*|edema|febre",
      "press(?:ã|a)o|glicem[0-9a-zà-ÿ]*|corrim[0-9a-zà-ÿ]*|secre(?:ç|c)[0-9a-zà-ÿ]*",
      "sang(?:r|u)[0-9a-zà-ÿ]*|contra(?:ç|c)[0-9a-zà-ÿ]*|ard(?:ê|e)ncia|coceira",
      "queimac(?:ã|a)o|azia|falta de ar|c(?:ã|a)imbra[0-9a-zà-ÿ]*",
    ].join("|"),
  ),
  "i",
);

export const COISAS_DE_CONDUTA = new RegExp(
  comFronteira(
    [
      "rem(?:é|e)dio[0-9a-zà-ÿ]*|medicament[0-9a-zà-ÿ]*|comprimido[0-9a-zà-ÿ]*|dose|tomar",
      "exame[0-9a-zà-ÿ]*|ultrassom|ultrasso[0-9a-zà-ÿ]*|hemogram[0-9a-zà-ÿ]*|urina",
      "ces(?:á|a)re[0-9a-zà-ÿ]*|inje(?:ç|c)[0-9a-zà-ÿ]*|vacina[0-9a-zà-ÿ]*|antibi(?:ó|o)tic[0-9a-zà-ÿ]*",
      "hospital|pronto[- ]socorro|matern(?:i|í)dade|internar|internada",
    ].join("|"),
  ),
  "i",
);

export const ENTREGA_DE_CONDUTA = new RegExp(
  [
    /* Conselho direto na segunda pessoa. */
    "\\b(?:n(?:ã|a)o precisa|n(?:ã|a)o precisas|n(?:ã|a)o vale a pena ir|fica em casa|" +
      "fique em casa|n(?:ã|a)o v(?:á|a)|n(?:ã|a)o vai n(?:ã|a)o|espera passar|" +
      "espere passar|deixa pra (?:amanh(?:ã|a)|depois)|deixe pra (?:amanh(?:ã|a)|depois)|" +
      "melhor esperar|d(?:á|a) pra esperar|n(?:ã|a)o tome|n(?:ã|a)o toma)\\b",
    /* Relato de conduta na primeira pessoa do passado — o mais persuasivo. */
    "\\b(?:eu\\s+)?n(?:ã|a)o (?:fui|precisei|liguei|corri|procurei|internei)\\b",
    "\\bno meu caso\\b|\\bcomigo foi\\b|\\bcomigo aconteceu\\b|\\bnem precisei\\b",
    "\\bpassou sozinh|\\bdeu tudo certo\\b|\\bn(?:ã|a)o deu nada\\b",
    /* Condicional de conselho. */
    "\\b(?:no seu lugar|se fosse (?:eu|comigo))\\b",
    "\\b(?:ficaria|esperaria|deixaria|iria|n(?:ã|a)o iria|tomaria|n(?:ã|a)o tomaria)\\b",
  ].join("|"),
  "i",
);

/**
 * PEDIDO DE CONDUTA — "posso tomar?", "devo ir?", "é normal?".
 *
 * ⚠️ **Só roteia ACOMPANHADO de vocabulário clínico**, e a razão é medida:
 * `posso`, `tenho que ir` e `é normal` são as três aberturas mais comuns de
 * qualquer pergunta em português — numa CAIXINHA DE PERGUNTAS. Incondicionais,
 * elas mandavam ao consultório "posso levar minha mãe na sala de parto?" e "é
 * normal chorar assistindo comercial?", que é como um recurso morre.
 *
 * O objeto é que decide, não o verbo: "posso tomar dipirona?" é do médico,
 * "posso levar minha mãe?" não é.
 */
export const PEDIDO_DE_CONDUTA = new RegExp(
  [
    "\\bposso\\b|\\bdevo\\b|\\bpreciso ir\\b|\\btenho que ir\\b|\\bpode tomar\\b",
    "(?:é|e) normal\\b|(?:é|e) perigos\\w*|(?:é|e) grave\\b|faz mal\\b|pode fazer mal\\b",
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
 * foi o seu parto?" é conversa; "estou com dor" é sintoma.
 */
export const SINTOMA_EM_PRIMEIRA_PESSOA = new RegExp(
  "(?:estou|to|tô|tenho|sinto|senti|apareceu|comecei a|acordei com|fiquei com)\\s+" +
    "(?:com\\s+|muita\\s+|muito\\s+|uma\\s+|um\\s+)*",
  "i",
);

/**
 * Há vocabulário clínico ALÉM da abertura em primeira pessoa?
 *
 * ⚠️ **O `&&` entre os dois padrões era VAZIO**, e o defeito é sutil: `sinto` e
 * `senti` estão nas DUAS listas. A mesma palavra satisfazia os dois lados
 * sozinha, então toda frase com "sinto"/"senti" virava assunto de médico —
 * incluindo os dois posts mais valiosos que este app pode receber ("senti muito
 * amor quando vi o rostinho dele", "sinto que o tempo está passando rápido
 * demais"). Medido.
 *
 * O conserto não é tirar `sinto` de `TERMOS_CLINICOS` — a lista serve TAMBÉM ao
 * chat, onde incluir demais é barato e onde tirar abriria um buraco. O conserto
 * é exigir que o termo clínico apareça FORA do trecho que casou a abertura.
 */
export function temTermoClinicoAlemDaAbertura(texto: string): boolean {
  const m = texto.match(SINTOMA_EM_PRIMEIRA_PESSOA);
  if (!m) return false;
  const resto = texto.slice(0, m.index ?? 0) + " " + texto.slice((m.index ?? 0) + m[0].length);
  /* ⚠️ `SINTOMAS_DO_CORPO` e não `TERMOS_CLINICOS`: relatar sintoma pede um
     SINAL, e a lista larga fazia "estou com saudade de tomar cerveja" virar
     caso clínico por causa do verbo `tomar`. */
  return SINTOMAS_DO_CORPO.test(resto);
}

/**
 * ⚠️ **O TIPO E OS TEXTOS MORAM EM `caixinha-tela.ts`**, e não aqui.
 *
 * A tela precisava de um número e de uma função que devolve string; importou
 * daqui, e arrastou as regex deste arquivo para o bundle do NAVEGADOR — com o
 * `(?<!` de fronteira junto, que o Safari anterior ao 16.4 recusa com
 * `SyntaxError` na carga do módulo. A rota inteira caía.
 *
 * Este arquivo é do SERVIDOR. O que a tela usa fica do lado dela.
 */
import type { DesfechoDaPergunta } from "@/lib/caixinha-tela";
export type { DesfechoDaPergunta };
export { LIMITE_DA_PERGUNTA, recadoDoDesfecho } from "@/lib/caixinha-tela";

/** Teto diário de perguntas por pessoa. Sem ele, a caixa vira ferramenta de spam. */
export const PERGUNTAS_POR_DIA = 10;

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

  /* 1 · A Central de Emergência vence tudo. */
  if (BANDEIRA_VERMELHA.test(t)) return "emergencia";
  if (PRESSAO_EM_NUMEROS.test(t)) return "emergencia";

  /* 2 · ENTREGAR conduta é incondicional — é a forma que fechou os comentários,
     e ela costuma não ter termo clínico nenhum ("não precisa ir"). */
  if (ENTREGA_DE_CONDUTA.test(t)) return "clinica";

  /* 3 · O que pede médico sem ser emergência (contração, uterotônico caseiro,
     número de exame). */
  if (SINAL_QUE_PEDE_MEDICO.test(t)) return "clinica";

  /* 4 · PEDIR conduta só roteia com vocabulário clínico junto: `posso`, `devo`
     e `é normal` são as aberturas mais comuns do português, e sozinhas mandavam
     "posso levar minha mãe na sala de parto?" para o consultório. */
  if (PEDIDO_DE_CONDUTA.test(t) && (COISAS_DE_CONDUTA.test(t) || SINTOMAS_DO_CORPO.test(t)))
    return "clinica";

  /* 5 · Sintoma no PRÓPRIO corpo, agora — e o termo clínico tem de estar FORA
     da abertura, senão "senti muito amor" viraria caso clínico. */
  if (temTermoClinicoAlemDaAbertura(t)) return "clinica";

  return "publicavel";
}
