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
  /* Campos trocados: avalia o par NA ORDEM CERTA e mantém a gravidade dele.
     
     A primeira versão desta guarda devolvia sempre `atencao`, e isso rebaixava
     o caso que mata: 170/100 é pré-eclâmpsia grave, e digitado invertido
     (100/170) saía como amarelo, abaixo de qualquer vermelho na ordenação. Era
     o oposto do princípio aplicado à hipoglicemia três funções abaixo — a
     escala tem que estar ancorada na urgência, não no formato do dado. O
     inverso continua valendo: 80/120 é 120/80 lido ao contrário e segue
     normal. */
  if (sistolica < diastolica) {
    return {
      gravidade: faixaPressao(diastolica, sistolica),
      nota: `Valores parecem invertidos (lido como ${diastolica}/${sistolica})`,
    };
  }
  /* Sistólica IGUAL à diastólica é pressão de pulso zero — ausência de débito.
     Trocar não muda nada, então trocar aqui só produziria recursão infinita:
     é caso de valor implausível, não de campo invertido. */
  if (sistolica === diastolica) {
    return { gravidade: "atencao", nota: "Diferença implausível entre os dois valores" };
  }
  return {
    gravidade: faixaPressao(sistolica, diastolica),
    nota: notaPressao(sistolica, diastolica),
  };
}

/** Só a classificação por faixa — sem as guardas, para poder ser reusada. */
function faixaPressao(sistolica: number, diastolica: number): Gravidade {
  if (sistolica >= 160 || diastolica >= 110) return "grave";
  if (sistolica >= 140 || diastolica >= 90) return "atencao";
  /* Hipotensão sintomática existe, mas isolada num registro caseiro gera mais
     alarme do que ajuda — fica de fora de propósito. */
  return "normal";
}

function notaPressao(sistolica: number, diastolica: number): string {
  const g = faixaPressao(sistolica, diastolica);
  return g === "grave" ? "Pressão em faixa grave" : g === "atencao" ? "Pressão elevada" : "";
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
    /* `grave`, e não `atencao`: os dois cenários por trás deste número são
       graves. Ou é mmol/L (10,0 = 180 mg/dL, hiperglicemia) ou é mg/dL de
       verdade (15 = neuroglicopenia). O único falso-grave é a leitura mmol/L
       normal — e errar por excesso num de três é melhor que rebaixar dois de
       três, que era o efeito de `atencao`. */
    return { gravidade: "grave", nota: "Valor implausível — confira a unidade (mg/dL)" };
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

/**
 * A MESMA gravidade, dita para a paciente.
 *
 * O app dela tinha cópias inline destas faixas — e a cópia da glicemia calava
 * para baixo: 35 mg/dL, que é neuroglicopenia, saía rotulado "Normal" em verde,
 * enquanto o painel do médico dizia "Glicemia muito baixa". Não era ausência de
 * alerta, era alerta INVERTIDO, e é o pior que este arquivo pode produzir.
 *
 * A saída não é mostrar a ela o texto do médico: "Pressão em faixa grave" às 23h
 * manda gente ao pronto-socorro por medida caseira mal feita. A saída é uma
 * régua só e duas VOZES — a gravidade é a mesma, o texto é diferente, e o texto
 * dela sempre termina em uma ação que ela consegue executar.
 */
export function vozDaPaciente(
  s: Sinal | null,
  /** A conduta muda com a medida: repetir uma pressão e corrigir uma
      hipoglicemia não são a mesma frase, e a genérica não serve para nenhuma
      das duas. */
  tipo: "pressao" | "glicemia" = "pressao",
): { rotulo: string; orientacao: string } | null {
  if (!s || s.gravidade === "normal") return null;
  if (tipo === "glicemia") {
    /* Três condutas diferentes, e confundi-las é o mesmo erro de escala de
       antes: mandar conferir a unidade para uma glicemia de 250 real é tão
       inútil quanto mandar comer doce para uma leitura em mmol/L. */
    const implausivel = s.nota.includes("implausível");
    const baixa = s.nota.includes("baixa");
    if (implausivel) {
      return {
        rotulo: s.nota,
        orientacao:
          "Confira se o seu aparelho mede em mg/dL e refaça a medida. Se o número se repetir, avise seu médico hoje.",
      };
    }
    if (s.gravidade === "grave") {
      return {
        rotulo: s.nota,
        orientacao: baixa
          ? "Se estiver se sentindo mal, tome algo doce agora e meça de novo em 15 minutos. Avise seu médico hoje."
          : "Meça de novo daqui a pouco e avise seu médico hoje. Anote o que comeu antes.",
      };
    }
    return {
      rotulo: s.nota,
      orientacao: "Anote o horário e se foi antes ou depois de comer, e leve na próxima consulta.",
    };
  }
  if (s.gravidade === "grave") {
    return {
      rotulo: s.nota,
      orientacao:
        "Repita em 5 minutos, sentada e em repouso. Se vier parecido, ligue para o seu médico agora — e se não conseguir falar, procure a maternidade.",
    };
  }
  return {
    rotulo: s.nota,
    orientacao: "Vale repetir mais tarde e comentar na próxima consulta.",
  };
}
