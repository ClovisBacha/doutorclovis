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

/* ══════════════════════════════════════════════════════════════════════════
   RESPONDER, CURTIR, RESTRINGIR E FILTRAR — as quatro que entraram depois
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A RAIZ DE UMA RESPOSTA — e é ela que mantém a árvore com UM nível.
 *
 * ⚠️ **Responder a uma resposta entra na MESMA linha da conversa**, como no
 * Instagram. Sem esta função, `responde_a` apontaria para a resposta e a árvore
 * cresceria sem fim: num celular de 393px, o quarto nível tem 40px de largura e
 * ninguém lê. Um nível também é o que faz "responder" ser um gesto de UMA
 * decisão — a quem eu respondo é sempre a conversa, nunca a linha exata.
 *
 * ⚠️ **A trava é do SERVIDOR, não da tela.** A coluna aceita qualquer uuid; um
 * pedido montado à mão criaria o segundo nível, e a tela desenharia uma resposta
 * órfã que nenhuma raiz mostra.
 */
export function raizDoComentario(alvo: { id: string; respondeA: string | null }): string {
  return alvo.respondeA ?? alvo.id;
}

/**
 * Quantas respostas a tela mostra antes de "ver mais".
 *
 * ⚠️ **Três, e não todas.** Uma conversa de vinte respostas empurraria os
 * outros comentários para fora da tela — e num post sobre um susto, a resposta
 * que importa costuma ser a da AUTORA, que fica no meio delas.
 */
export const RESPOSTAS_VISIVEIS = 3;

/**
 * ⚠️ **A CURTIDA DO COMENTÁRIO TEM UM TIPO SÓ, e o post tem treze.**
 *
 * Não é economia: treze emojis embaixo de cada comentário viraria uma parede, e
 * o comentário JÁ É a resposta com nuance — quem quer dizer mais escreve. O
 * coração aqui é o "eu li e agradeço" que permite à autora reconhecer dez
 * comentários sem escrever dez respostas. Sem ele, ou ela responde a todos ou
 * ignora todos, e no segundo caso a comunidade esfria.
 *
 * ⚠️ **O TIPO `ComentarioNaTela` MORA EM `comentarios.functions.ts`**, onde já
 * existia — este arquivo NÃO o redeclara. Dois tipos com o mesmo nome é a
 * segunda régua que este projeto proíbe desde `podeVerPost`, e aqui a
 * divergência apareceria como campo que a tela lê e o servidor nunca manda.
 */
export const CURTIDA_DO_COMENTARIO = "coracao" as const;

/**
 * ⚠️ O FILTRO DE PALAVRAS — normalização.
 *
 * Tira acento e caixa, porque quem escreve "PERDI" e "perdí" está escrevendo a
 * mesma palavra, e uma paciente que precisou esconder uma palavra não deveria
 * ter de listar as quatro grafias dela.
 */
export function normalizarParaFiltro(t: string): string {
  return (
    t
      .normalize("NFD")
      /* ⚠️ **A faixa das marcas combinantes vai por ESCAPE, nunca com os
         caracteres literais.** Elas são INVISÍVEIS no editor: coladas aqui, a
         próxima pessoa que reformatar o arquivo pode apagá-las sem ver, e o
         filtro passa a errar todo acento sem nada na tela dizendo por quê. */
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  );
}

/**
 * Este texto contém alguma das palavras que ela escondeu?
 *
 * ⚠️ **CASA PALAVRA INTEIRA, e essa é a decisão que faz o recurso servir.** Com
 * `includes`, esconder "parto" esconderia "departamento" e "aparto"; esconder
 * "mal" esconderia "mala", "malha", "animal". A paciente veria comentários
 * sumindo sem entender por quê e desligaria o filtro — que é o mesmo que não
 * tê-lo, só que depois de ela ter confiado nele.
 *
 * ⚠️ **A borda é NÃO-LETRA, e não `\b`.** `\b` do JavaScript é ASCII: em
 * "gestação", o `ç` já é borda, e `\bmal\b` não casaria "mal-estar" do jeito
 * esperado em vários casos acentuados. Como o texto e a palavra passam os dois
 * por `normalizarParaFiltro`, sobra ASCII — mas a borda explícita continua
 * sendo mais previsível que confiar no que `\b` considera letra.
 *
 * ⚠️ **Uma expressão que a paciente digitou com espaço é FRASE**, e casa como
 * frase: "perdi o bebê" só esconde essa sequência, não cada palavra.
 */
export function temPalavraOculta(texto: string, palavras: readonly string[]): boolean {
  const alvo = normalizarParaFiltro(texto);
  for (const bruta of palavras) {
    const p = normalizarParaFiltro(bruta).trim();
    if (!p) continue;
    const escapada = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${escapada}([^a-z0-9]|$)`).test(alvo)) return true;
  }
  return false;
}

/** Teto da lista. */
export const PALAVRAS_OCULTAS_MAX = 60;
/** Teto de cada expressão — é palavra ou frase curta, nunca um parágrafo. */
export const PALAVRA_OCULTA_MAX = 40;

/**
 * Limpa a lista que veio da tela.
 *
 * ⚠️ **Não recusa a lista inteira por causa de uma entrada ruim.** Ela digita
 * separando por vírgula ou por linha; recusar tudo porque uma ficou vazia faria
 * o botão de salvar não fazer nada, sem dizer qual.
 */
export function limparPalavrasOcultas(bruto: readonly string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const b of bruto) {
    const p = String(b ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, PALAVRA_OCULTA_MAX);
    if (!p) continue;
    const chave = normalizarParaFiltro(p);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(p);
    if (saida.length >= PALAVRAS_OCULTAS_MAX) break;
  }
  return saida;
}

/**
 * QUEM VÊ ESTE COMENTÁRIO — a régua única.
 *
 * ⚠️ **`souAAutoraDoComentario` VEM PRIMEIRO, e a ordem é o recurso inteiro.**
 * Quem foi restringida tem de continuar vendo o próprio comentário exatamente
 * como antes: é isso que a impede de descobrir. Com a checagem depois, ela
 * escreveria, o comentário sumiria da tela dela, e ela saberia na hora.
 *
 * ⚠️ **A DONA DO POST VÊ, mas MARCADO.** Esconder dela seria pior que não ter o
 * recurso: um comentário que ninguém pode ler e nem ela sabe que existe é um
 * canal cego — e ela precisa poder apagar, denunciar ou mudar de ideia.
 *
 * ⚠️ **O filtro de palavras é da PESSOA QUE OLHA, nunca do post.** Cada uma tem
 * a lista dela, e a mesma linha some para uma e aparece para outra.
 */
export function verDoComentario(v: {
  euId: string;
  autorDoComentario: string;
  donaDoPost: string;
  /** Eu (quem olha) restrinjo a autora deste comentário? */
  restringiOAutor: boolean;
  /** A dona do post restringe a autora deste comentário? */
  donaRestringeOAutor: boolean;
  /** O texto bate com alguma palavra que EU escondi? */
  batePalavraMinha: boolean;
}): {
  /** Aparece na conversa, com o texto à mostra. */
  mostra: boolean;
  marca: "restrito" | "palavra" | null;
  /** Aparece RECOLHIDO, e ela pode abrir se quiser. Só para a dona do post. */
  revelavel: boolean;
} {
  /* 1. É meu: vejo sempre, sem marca. É o silêncio que sustenta o recurso. */
  if (v.euId === v.autorDoComentario) return { mostra: true, marca: null, revelavel: false };

  /* ⚠️ **A DONA NÃO LÊ O QUE ELA MANDOU ESCONDER — ela decide se quer ler.**
     A primeira versão devolvia `mostra: true` com uma etiqueta embaixo, e isso
     contradizia a própria razão do recurso, escrita duas linhas acima: se ela
     escondeu "perdi", o app não pode entregar "perdi" com um aviso de que
     aquilo devia estar escondido. Entregar o texto e avisar depois é o pior
     desfecho possível de um filtro — ela já leu.

     E vale igual para a restrição: quem restringe uma pessoa não quer o texto
     dela na frente, quer poder conferir. Recolhido é `mostra: false` com
     `revelavel: true`; a tela abre no toque. Para terceiros nada disso existe —
     nem a linha recolhida —, e é esse silêncio que separa restringir de
     bloquear. */
  if (v.batePalavraMinha) {
    return v.euId === v.donaDoPost
      ? { mostra: false, marca: "palavra", revelavel: true }
      : { mostra: false, marca: null, revelavel: false };
  }

  if (v.donaRestringeOAutor) {
    return v.euId === v.donaDoPost
      ? { mostra: false, marca: "restrito", revelavel: true }
      : { mostra: false, marca: null, revelavel: false };
  }

  /* E a MINHA restrição esconde de mim, mesmo no post de outra pessoa —
     restringir é sobre não ler aquela pessoa, não só sobre o meu post. */
  if (v.restringiOAutor) return { mostra: false, marca: null, revelavel: false };

  return { mostra: true, marca: null, revelavel: false };
}
