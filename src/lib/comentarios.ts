/**
 * OS COMENTÁRIOS — régua.
 *
 * Eles ficaram deliberadamente fora por meses, e o número que os barrou
 * continua verdadeiro: de 1.098 respostas com conselho em fóruns de gestação,
 * **20,9% estavam erradas e 5,5% eram potencialmente danosas** — e o grupo
 * corrigiu só 5,2% delas. Num app que carrega o nome de um consultório,
 * "comigo foi assim, não precisa ir ao pronto-socorro" é responsabilidade do
 * médico.
 *
 * Entram por decisão do dono. O que muda é que eles entram COM a trava que a
 * caixinha já tinha — e com uma segunda que a caixinha não precisava.
 *
 * ⚠️ **A SEGUNDA TRAVA EXISTE PORQUE UM FILTRO DE "OFENSIVO" GENÉRICO ERRARIA
 * O ALVO AQUI.** O comentário que mais machuca numa foto de barriga não tem
 * palavrão nenhum: é "seu bebê tá pequeno demais pra essa idade", "isso não é
 * normal", "minha prima teve isso e perdeu". Um filtro treinado para xingamento
 * deixa passar exatamente o dano desta população — e o dano é alarme, não
 * insulto.
 */

import { triarTexto } from "./pergunta-clinica";

export type DesfechoDoComentario =
  /** Pode publicar. */
  | "publicavel"
  /** Conduta clínica — a régua da caixinha. Recusado. */
  | "clinico"
  /** Bandeira vermelha: a autora do comentário precisa de atendimento. */
  | "emergencia"
  /** Xingamento ou ataque à pessoa. Recusado. */
  | "ofensivo"
  /** Alarme sobre o bebê ou o corpo dela. Recusado. */
  | "alarmista";

/**
 * ⚠️ **REDUZ o risco, NUNCA o impede** — e o nome desta constante diz isso de
 * propósito. Lista de palavras pega o óbvio e perde o resto; quem escreve para
 * machucar contorna qualquer lista na segunda tentativa. O que sustenta a aba é
 * a soma disto com a denúncia, o bloqueio e a dona podendo apagar e fechar.
 */
export const REDUZ_OFENSA = new RegExp(
  [
    /* Ataque direto à pessoa. Formas com e sem acento, e o plural. */
    "\\b(idiota|burra|burro|imbecil|est[uú]pid[ao]|ret[aá]rdad[ao]|otári[ao])\\b",
    "\\b(vagabund[ao]|piranha|vadia|puta|prostitut[ao])\\b",
    "\\b(nojent[ao]|horr[íi]vel voc[êe]|voc[êe] [ée] horr[íi]vel)\\b",
    /* Ataque ao corpo — o mais comum em foto de gestante. */
    "\\b(gorda|baleia|obesa nojenta|que barriga feia|t[aá] muito gorda)\\b",
    /* Ataque à mãe. */
    "\\b(m[ãa]e horr[íi]vel|n[ãa]o merece ser m[ãa]e|coitad[ao] do beb[êe] com voc[êe])\\b",
    /* Morte e desejo de mal. */
    "\\b(morre|se mata|espero que voc[êe] perca|tomara que perca)\\b",
  ].join("|"),
  "i",
);

/**
 * ⚠️ **O ALARME É O DANO REAL DESTA POPULAÇÃO, e ele não tem palavrão.**
 *
 * Uma gestante de alto risco já vive num estado de vigilância clínica. Um
 * comentário que insinua que algo está errado com o bebê dela — sem exame, sem
 * dado, sem responsabilidade nenhuma — produz uma noite de pânico e às vezes
 * uma ida ao pronto-socorro. É a coisa mais frequente e mais invisível.
 *
 * ⚠️ E ELE NÃO É "MAL-INTENCIONADO": quase sempre vem de alguém tentando
 * ajudar. É por isso que a recusa tem de EXPLICAR, nunca acusar.
 */
export const ALARME_SOBRE_O_BEBE = new RegExp(
  [
    /* Julgar o tamanho ou o desenvolvimento a partir de uma foto. */
    "\\b(pequen[ao] demais|muito pequen[ao]|grande demais|t[aá] pequenin[ao] demais)\\b",
    "\\b(barriga (muito )?(pequena|baixa|estranha))\\b",
    /* Afirmar anormalidade. */
    "\\b(isso n[ãa]o [ée] normal|n[ãa]o parece normal|tem alguma coisa errada)\\b",
    "\\b(devia (j[aá] )?estar (maior|mexendo|nascendo))\\b",
    /* A história de terror alheia. */
    "\\b(minha (prima|irm[ãa]|amiga|m[ãa]e) teve isso e (perdeu|morreu))\\b",
    "\\b(conhe[cç]o um caso que (deu errado|perdeu|morreu))\\b",
    "\\b(cuidado (com )?isso pode ser)\\b",
  ].join("|"),
  "i",
);

/**
 * A triagem de um comentário.
 *
 * ⚠️ **A ORDEM É DELIBERADA, e cada degrau existe por um caso concreto:**
 *
 * 1 · **emergência** vence tudo — quem escreveu pode precisar de atendimento
 *     AGORA, e recusar por "ofensivo" mandaria embora quem está sangrando;
 * 2 · **ofensivo** vem antes de clínico: "sua burra, isso não é normal" é as
 *     duas coisas, e a pessoa precisa ouvir a razão certa;
 * 3 · **alarmista** antes de clínico pela mesma razão — a recusa explica o
 *     dano, e "é conduta clínica" não explica nada a quem só quis avisar;
 * 4 · **clínico** por último, com a régua que já existe.
 */
export function triarComentario(texto: string): DesfechoDoComentario {
  const t = (texto ?? "").trim();
  if (!t) return "publicavel";

  const clinico = triarTexto(t);
  /* ⚠️ A emergência vem da régua CLÍNICA, e vence tudo. */
  if (clinico === "emergencia") return "emergencia";

  if (REDUZ_OFENSA.test(t)) return "ofensivo";
  if (ALARME_SOBRE_O_BEBE.test(t)) return "alarmista";
  if (clinico === "clinica") return "clinico";
  return "publicavel";
}

/**
 * O recado da recusa.
 *
 * ⚠️ **ELE EXPLICA, NUNCA ACUSA — e isso não é gentileza, é eficácia.** Quem
 * escreve um alarme quase sempre está tentando ajudar; tratada como agressora,
 * a pessoa reescreve com raiva ou vai embora. Explicado o efeito, ela costuma
 * reescrever melhor.
 */
export function recadoDoComentario(d: DesfechoDoComentario): string | null {
  switch (d) {
    case "publicavel":
      return null;
    case "emergencia":
      return "Isso que você escreveu pede atendimento. Abra a Central de Emergência — ela avisa seu médico com a sua localização.";
    case "ofensivo":
      return "Este comentário não pode ser publicado.";
    case "alarmista":
      return "Aqui a gente não opina sobre o bebê ou o corpo de outra pessoa — mesmo com boa intenção, isso costuma virar uma noite de susto. Se você quer ajudar, conte a sua experiência sem dizer o que está errado com ela.";
    case "clinico":
      /* ⚠️ ELE ENSINA A SAÍDA, e não só nega. A régua recusa "comigo foi assim,
         foi tudo bem" — que é a tranquilização anedótica, os 20,9% de conselho
         errado dito com afeto. Mas contar a própria história SEM prever o
         desfecho dela continua passando, e o recado precisa dizer isso: negar
         sem saída faz a pessoa reescrever igual ou desistir de comentar. */
      return "Aqui não damos orientação de saúde nem dizemos como vai terminar — quem responde isso é o médico dela. Você pode contar a sua história sem dizer o que vai acontecer com ela.";
  }
}

/** Teto do texto. Comentário não é post. */
export const LIMITE_DO_COMENTARIO = 500;

/**
 * Teto por dia, por pessoa.
 *
 * ⚠️ Freio contra automação e contra o dedo preso, nunca contra conversa. Cem
 * comentários num dia é muito acima do que uma pessoa escreve e bem abaixo do
 * que um roteiro escreveria.
 */
export const COMENTARIOS_POR_DIA = 100;

/**
 * Quem pode apagar um comentário.
 *
 * ⚠️ **A DONA DO POST APAGA QUALQUER UM; a autora apaga o seu.** É a régua do
 * Instagram e é a certa: o post é o espaço dela, e ela precisa poder limpar sem
 * depender de denúncia — que é lenta por natureza.
 */
export function podeApagarComentario(v: {
  euId: string;
  autorDoComentario: string;
  donaDoPost: string;
}): boolean {
  return v.euId === v.autorDoComentario || v.euId === v.donaDoPost;
}
