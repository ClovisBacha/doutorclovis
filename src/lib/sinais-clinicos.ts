/**
 * O que num número pede atenção — e o que o silêncio dela quer dizer.
 *
 * Hoje o painel mostra 150/100 na mesma cor de 110/70, e mostra igualmente a
 * paciente que registrou pressão ontem e a que não abre o app há três semanas.
 * Isso transforma um painel clínico em arquivo: tudo está lá e nada se destaca,
 * então ler vira trabalho de garimpo, e garimpo ninguém faz todo dia.
 *
 * Duas ressalvas que valem mais que o código:
 *
 * 1. **Isto não é diagnóstico.** São faixas de referência conhecidas, usadas
 *    para ORDENAR a atenção do médico — nunca para concluir nada. A decisão é
 *    dele, e a tela nunca diz o que ele deve fazer.
 *
 * 2. **Silêncio não é sinal clínico**, é sinal de engajamento. Uma paciente
 *    pode estar ótima e sem paciência para o app. Por isso o texto fala em
 *    "sem registro" e não em "sem acompanhamento".
 */

export type Gravidade = "normal" | "atencao" | "grave";

export type Sinal = {
  gravidade: Gravidade;
  /** Frase curta, do jeito que um obstetra falaria. */
  nota: string;
};

/**
 * Pressão arterial. Referência de hipertensão na gestação (FEBRASGO/ACOG):
 * ≥140 sistólica OU ≥90 diastólica; faixa grave a partir de 160/110.
 *
 * O `ou` é essencial e é o erro clássico de quem implementa isto: 138/95 é
 * hipertensão, e um `e` deixaria passar.
 */
export function sinalPressao(sistolica?: number | null, diastolica?: number | null): Sinal | null {
  if (sistolica == null || diastolica == null) return null;
  /* IMPLAUSÍVEL ≠ NORMAL. Sem esta guarda, "0/0" — que chega ao banco porque o
     formulário testa `if (form.systolic)` e a string "0" é truthy — passava
     pelos dois `if` abaixo e saía como `normal`, sem etiqueta, ocupando na
     ficha o lugar da última medida de verdade. Um número que não pode existir
     tem que dizer que não pode existir. */
  if (!Number.isFinite(sistolica) || !Number.isFinite(diastolica)) return null;
  if (sistolica < 50 || sistolica > 300 || diastolica < 20 || diastolica > 200) {
    return { gravidade: "atencao", nota: "Valor de pressão implausível" };
  }
  /* Campos trocados. 80/120 batia em `120 >= 110` e virava "faixa grave": um
     alarme de crise hipertensiva em cima de uma pressão perfeitamente normal
     digitada nos campos invertidos. Alarme falso repetido é o que faz o médico
     aprender a ignorar a cor. */
  if (sistolica <= diastolica) {
    return { gravidade: "atencao", nota: "Sistólica e diastólica parecem invertidas" };
  }
  if (sistolica >= 160 || diastolica >= 110) {
    return { gravidade: "grave", nota: "Pressão em faixa grave" };
  }
  if (sistolica >= 140 || diastolica >= 90) {
    return { gravidade: "atencao", nota: "Pressão elevada" };
  }
  /* Hipotensão sintomática existe, mas isolada num registro caseiro gera mais
     alarme do que ajuda — fica de fora de propósito. */
  return { gravidade: "normal", nota: "" };
}

/**
 * Glicemia capilar. Alvos de rastreio na gestação: jejum <95, pós-prandial
 * <140 (1h) / <120 (2h).
 *
 * Como o app NÃO pergunta se foi em jejum ou depois de comer, usamos o limite
 * mais permissivo — 140 — para não marcar como alterada uma glicemia normal
 * medida depois do almoço. Marcar demais é tão ruim quanto não marcar: o médico
 * aprende a ignorar a cor.
 */
export function sinalGlicemia(valor?: number | null): Sinal | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  /* Abaixo de 20 mg/dL ninguém está consciente para digitar o número. O caso
     real é o glicosímetro em mmol/L: 10,0 mmol (= 180 mg/dL, GRAVE) vira 10 na
     coluna inteira e saía rotulado "Glicemia baixa" — o alerta exatamente
     oposto ao correto. Aqui a gente admite que não sabe. */
  if (valor > 0 && valor < 20) {
    return { gravidade: "atencao", nota: "Valor implausível — confira a unidade (mg/dL)" };
  }
  if (valor <= 0 || valor > 900) {
    return { gravidade: "atencao", nota: "Valor de glicemia implausível" };
  }
  /* Hipoglicemia grave vem ANTES do teto alto: 25 mg/dL é neuroglicopenia,
     emergência imediata, e ordenava abaixo de uma glicemia de 185 porque a
     escala estava ancorada no número e não na urgência. */
  if (valor < 50) return { gravidade: "grave", nota: "Glicemia muito baixa" };
  if (valor >= 180) return { gravidade: "grave", nota: "Glicemia alta" };
  if (valor >= 140) return { gravidade: "atencao", nota: "Glicemia acima do alvo" };
  if (valor < 60) return { gravidade: "atencao", nota: "Glicemia baixa" };
  return { gravidade: "normal", nota: "" };
}

/**
 * Silêncio: há quanto tempo ela não registra nada no app.
 *
 * Os cortes são de produto, não clínicos. Duas semanas é o intervalo em que uma
 * gestante engajada some sem um motivo trivial; um mês já é alguém que
 * praticamente abandonou o app — e vale saber antes de a consulta chegar.
 */
export function sinalSilencio(
  ultimaAtividade?: string | null,
  /**
   * Até onde o servidor foi buscar atividade. Sem registro DENTRO da janela não
   * é "nunca registrou": é "não registrou nos últimos N dias", e essa é a única
   * frase que a gente pode assinar. Dizer "nunca" sobre uma paciente que usa o
   * app há meses é a tela mentindo com cara de dado.
   */
  janelaDias = 45,
): Sinal | null {
  if (!ultimaAtividade) {
    /* "há mais de N dias" afirmaria que ela existia há N dias. O que a gente
       de fato sabe é que não houve registro DENTRO da janela — e isso vale
       tanto para quem sumiu quanto para quem se cadastrou ontem. Quem chama
       filtra as recém-chegadas antes; a frase, sozinha, é verdadeira nos dois
       casos. */
    return { gravidade: "grave", nota: `Nenhum registro nos últimos ${janelaDias} dias` };
  }
  const t = new Date(ultimaAtividade).getTime();
  /* Data corrompida some da lista se cair no ramo "normal", e é o contrário do
     que uma lista de "quem sumiu" deve fazer. Sem data legível, ela aparece. */
  if (!Number.isFinite(t)) {
    return { gravidade: "atencao", nota: "Sem data de último registro" };
  }
  const dias = Math.floor((Date.now() - t) / 86400000);
  if (dias >= 30) return { gravidade: "grave", nota: `Sem registro há ${dias} dias` };
  if (dias >= 14) return { gravidade: "atencao", nota: `Sem registro há ${dias} dias` };
  return { gravidade: "normal", nota: "" };
}

/** Quantos dias de silêncio — para desempatar a ordem dentro da mesma cor. */
export function diasDeSilencio(ultimaAtividade?: string | null, janelaDias = 45): number {
  if (!ultimaAtividade) return janelaDias + 1;
  const t = new Date(ultimaAtividade).getTime();
  if (!Number.isFinite(t)) return janelaDias + 1;
  return Math.floor((Date.now() - t) / 86400000);
}

/** A pior gravidade de um conjunto — é ela que ordena a lista. */
export function piorSinal(...sinais: (Sinal | null)[]): Gravidade {
  if (sinais.some((s) => s?.gravidade === "grave")) return "grave";
  if (sinais.some((s) => s?.gravidade === "atencao")) return "atencao";
  return "normal";
}

/** Classes da etiqueta, por gravidade. */
export const ESTILO_SINAL: Record<Gravidade, string> = {
  grave: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  atencao: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  normal: "bg-secondary text-muted-foreground",
};

/** Peso para ordenação: grave primeiro. */
export const PESO_SINAL: Record<Gravidade, number> = { grave: 0, atencao: 1, normal: 2 };
