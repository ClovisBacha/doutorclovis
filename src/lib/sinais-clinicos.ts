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
  /* ⚠️ SÓ O PISO É IMPLAUSÍVEL — NÃO HÁ TETO (set/2026, decisão do dono: "vai
     que a pessoa tem mais de 350 kg, tire esse limite e outros que podem
     existir").

     E aqui o teto era pior que um formulário chato: com ele, um 320/190 REAL
     caía nesta linha como "atenção — implausível" e era REBAIXADO abaixo de
     qualquer vermelho na fila de trabalho do médico. Sem ele, cai em
     `faixaPressao` e sai GRAVE, que é o que ele é. Errar para o lado de
     alarmar é o único lado seguro de uma régua clínica. */
  if (sistolica < 50 || diastolica < 20) {
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
  /* Sem teto, pela mesma razão da pressão: com `> 900`, uma glicemia de 950 —
     que é cetoacidose — saía "implausível/atenção" e ordenava abaixo de um 185
     rotulado GRAVE. O piso fica: zero e negativo não são medida. */
  if (valor <= 0) {
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
 * Saturação de oxigênio.
 *
 * Existe porque o dado atravessava o sistema inteiro — a paciente registra, a
 * view emite, o tipo declara — e chegava à tela do médico como a palavra
 * "Medida", sem número: não havia régua, então saía `normal` e o resumo não
 * imprimia nada. Uma gestante com pneumonia registrando 88% virava uma bolinha
 * cinza.
 *
 * Na gestação a demanda de oxigênio sobe e a reserva cai: 94% já pede atenção
 * onde em não-gestante passaria.
 */
export function sinalSaturacao(valor?: number | null): Sinal | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  if (valor < 50 || valor > 100) {
    return { gravidade: "atencao", nota: "Valor de saturação implausível" };
  }
  if (valor < 92) return { gravidade: "grave", nota: `Saturação ${valor}%` };
  if (valor < 95) return { gravidade: "atencao", nota: `Saturação ${valor}%` };
  return { gravidade: "normal", nota: "" };
}

/**
 * CONTRAÇÕES REGULARES ANTES DAS 37 SEMANAS.
 *
 * ─── POR QUE ESTA RÉGUA PRECISAVA EXISTIR ───────────────────────────────────
 *
 * O app já declarava "contrações regulares antes de 37 semanas" como sintoma
 * VERMELHO em `triage.ts` — o mesmo quadro que, na triagem, manda procurar
 * atendimento agora. Mas o cronômetro de contrações recebia a semana
 * gestacional e a DESCARTAVA: ele só olhava intervalo e duração médios.
 *
 * Resultado medido: uma paciente de 28 semanas com contrações a cada 12
 * minutos por 40 segundos lia "Padrão normal"; a cada 8 minutos, "Atenção —
 * padrão irregular, monitore de perto". A mesma paciente, respondendo a
 * triagem, receberia "procure atendimento agora". Duas telas do mesmo app
 * dizendo coisas opostas sobre o mesmo quadro — e a que ela abre com o
 * cronômetro na mão é a que tranquiliza.
 *
 * ─── O CORTE ────────────────────────────────────────────────────────────────
 *
 * 37 semanas é a fronteira do termo, e é a mesma escrita em `triage.ts`.
 * "Regular" aqui é intervalo médio ≤ 10 minutos — o mesmo limiar que o
 * cronômetro já usava para sair de "normal", só que agora ele PROMOVE em vez
 * de tranquilizar quando a gestação ainda não chegou ao termo.
 *
 * Sem semana conhecida devolve `null`: sem saber em que semana ela está, não há
 * como afirmar prematuridade, e inventar aqui seria alarmar quem está de 39.
 */
export function sinalContracoesPrematuras(o: {
  semanas?: number | null;
  /** Intervalo médio entre o início de uma contração e a seguinte, em minutos. */
  intervaloMin?: number | null;
}): Sinal | null {
  const s = o.semanas;
  const iv = o.intervaloMin;
  if (s == null || !Number.isFinite(s) || iv == null || !Number.isFinite(iv)) return null;
  if (s >= 37) return null;
  if (iv > 10) return null;
  return {
    gravidade: "grave",
    nota: `Contrações regulares antes das 37 semanas (você está com ${Math.floor(s)}). Ligue para o seu médico agora.`,
  };
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

/* ──────────────────────────────────────────────────────────────────────────
   VALIDAÇÃO NA ENTRADA

   As guardas de implausibilidade acima existem porque números impossíveis
   CHEGAVAM ao banco: o formulário testava `if (form.systolic)` e a string "0"
   é truthy, então zero era gravado como pressão e depois lido como medida.
   Marcar na leitura conserta a tela; não conserta o prontuário.

   A régua é a MESMA das faixas de implausibilidade — e agora também a mesma dos
   CHECKs do banco. Se divergirem, o banco recusa e a paciente lê "erro ao
   salvar, tente novamente", que é conselho errado: repetir o mesmo número falha
   para sempre.
   ────────────────────────────────────────────────────────────────────────── */

export type CampoClinico =
  | "systolic"
  | "diastolic"
  | "glucose_mg_dl"
  | "weight_kg"
  | "spo2"
  | "heart_rate_bpm"
  | "sleep_hours"
  | "steps";

export type FaixaDeEntrada = {
  /** O piso, INCLUSIVO — salvo com `acimaDe`, que o torna exclusivo. */
  min: number;
  /** Torna o piso exclusivo: `> min` em vez de `>= min`. Serve ao peso. */
  acimaDe?: true;
  /**
   * Ausente = SEM TETO, e isso é o padrão.
   *
   * ⚠️ Só existe onde o máximo é DEFINIÇÃO da grandeza, nunca plausibilidade:
   * saturação não passa de 100% porque 100% é "todo o oxigênio", e um dia não
   * tem mais de 24 horas. Peso, pressão, glicemia e passos não têm teto — o
   * corpo de alguém não é um argumento para recusar o número dela.
   */
  max?: number;
  nome: string;
  unidade: string;
};

/* ⚠️ SEM TETO DE PLAUSIBILIDADE (set/2026). Os tetos daqui nasceram de chute
   ("que peso é razoável?") e o dono os derrubou depois de a paciente ver
   "O peso precisa ficar entre 25 e 350 kg" ao digitar o peso dela. Um app de
   saúde que RECUSA o número de uma pessoa real está errado duas vezes: ela não
   consegue registrar, e o médico não vê o dado que mais importaria. */
export const FAIXAS: Record<CampoClinico, FaixaDeEntrada> = {
  systolic: { min: 50, nome: "A sistólica", unidade: "mmHg" },
  diastolic: { min: 20, nome: "A diastólica", unidade: "mmHg" },
  glucose_mg_dl: { min: 20, nome: "A glicemia", unidade: "mg/dL" },
  weight_kg: { min: 0, acimaDe: true, nome: "O peso", unidade: "kg" },
  spo2: { min: 50, max: 100, nome: "A saturação", unidade: "%" },
  heart_rate_bpm: { min: 30, nome: "A frequência cardíaca", unidade: "bpm" },
  sleep_hours: { min: 0, max: 24, nome: "O sono", unidade: "h" },
  steps: { min: 0, nome: "Os passos", unidade: "" },
};

/** A frase que a paciente lê. Sem teto ela fala só do piso. */
export function fraseDaFaixa(f: FaixaDeEntrada): string {
  const un = f.unidade ? ` ${f.unidade}` : "";
  if (f.max != null) {
    return `${f.nome} precisa ficar entre ${f.min} e ${f.max}${un}. Confira o número.`;
  }
  if (f.acimaDe) return `${f.nome} precisa ser maior que ${f.min}${un}. Confira o número.`;
  return `${f.nome} precisa ser ${f.min}${un} ou mais. Confira o número.`;
}

/** A régua, num lugar só — a tela da paciente e a do médico leem esta. */
export function foraDaFaixa(f: FaixaDeEntrada, n: number): boolean {
  if (f.acimaDe ? n <= f.min : n < f.min) return true;
  if (f.max != null && n > f.max) return true;
  return false;
}

/** `null` quando está tudo bem; a frase para a paciente quando não está. */
export function validaEntrada(campo: CampoClinico, bruto: string): string | null {
  const texto = (bruto ?? "").trim();
  if (texto === "") return null;
  const n = Number(texto.replace(",", "."));
  const f = FAIXAS[campo];
  if (!Number.isFinite(n)) return `${f.nome} precisa ser um número.`;
  /* O caso da glicemia em mmol/L merece frase própria: dizer "fora da faixa"
     para quem digitou 5,4 num aparelho importado não explica nada, e ela vai
     tentar de novo com o mesmo número. */
  if (campo === "glucose_mg_dl" && n > 0 && n < 20) {
    return "Esse valor parece estar em mmol/L. O app usa mg/dL — multiplique por 18 (ex.: 5,4 → 97).";
  }
  if (foraDaFaixa(f, n)) return fraseDaFaixa(f);
  return null;
}

/**
 * Valida um registro inteiro e devolve a PRIMEIRA frase a mostrar.
 *
 * Também cobre o que campo isolado não vê: pressão pela metade. O banco agora
 * tem `num_nonnulls(systolic, diastolic) <> 1`, então sem esta checagem o
 * insert seria recusado e a paciente leria o toast genérico.
 */
export function validaRegistro(campos: Partial<Record<CampoClinico, string>>): string | null {
  const s = (campos.systolic ?? "").trim();
  const d = (campos.diastolic ?? "").trim();
  if ((s === "") !== (d === "")) {
    return "A pressão precisa dos dois números — sistólica e diastólica.";
  }
  for (const [campo, valor] of Object.entries(campos) as [CampoClinico, string][]) {
    const erro = validaEntrada(campo, valor);
    if (erro) return erro;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════════════
   A PACIENTE COMPARADA COM ELA MESMA

   As faixas acima são absolutas: 140/90 é 140/90 para qualquer gestante. Elas
   respondem "este número é alto?" e não respondem "este número é alto PARA
   ELA?".

   Quem sempre teve 100/60 e chega a 132/86 está dentro de toda faixa de
   referência — e subiu 32 na sistólica. Numa gestação de alto risco isso é
   exatamente o tipo de coisa que se quer ver antes de virar 160/110.

   ─── O QUE ISTO É, E O QUE NÃO É ──────────────────────────────────────────

   Não é diagnóstico, e não substitui a régua absoluta: a gravidade final é
   sempre a MAIOR das duas. Um delta pequeno nunca rebaixa um 165/105.

   O corte de +30 sistólica / +15 diastólica sobre a média dela é o critério de
   "hipertensão relativa" clássico da obstetrícia. Ele saiu da definição formal
   de pré-eclâmpsia (ACOG, anos 2000) e continua largamente usado como sinal de
   VIGILÂNCIA — que é exatamente o papel dele aqui. Nunca sobe além de
   "atenção", e a nota descreve o que aconteceu ("subiu 32 sobre a média dela"),
   sem nomear doença.

   ⚠️ Clóvis: estes dois números são o padrão que escolhi e estão num lugar só.
   Se você quiser outro corte, é esta constante que muda.
   ════════════════════════════════════════════════════════════════════════════ */

export const DELTA_PRESSAO = { sistolica: 30, diastolica: 15 } as const;

/** Quantas medidas fazem uma linha de base. Menos que isso é ruído. */
export const MINIMO_PARA_BASE = 3;

export type BasePessoal = { sistolica: number; diastolica: number; medidas: number };

/**
 * A linha de base dela: a média das PRIMEIRAS medidas do acompanhamento.
 *
 * As primeiras, e não as últimas: se a média fosse móvel, uma subida lenta
 * arrastaria a própria referência junto e o delta nunca dispararia — o defeito
 * que faz um alarme de tendência ser inútil justamente na tendência lenta.
 *
 * `null` com menos de três pares: duas medidas não são uma linha de base, e
 * fingir que são faria o alerta disparar pela variação normal do dia.
 */
export function baseDePressao(
  pares: { sistolica: number; diastolica: number }[],
): BasePessoal | null {
  const validos = pares.filter(
    (p) =>
      Number.isFinite(p.sistolica) &&
      Number.isFinite(p.diastolica) &&
      /* Descarta implausíveis com a MESMA régua absoluta — um 0/0 na base
         puxaria a média para baixo e faria tudo parecer subida. */
      sinalPressao(p.sistolica, p.diastolica)?.nota !== "Valor de pressão implausível",
  );
  if (validos.length < MINIMO_PARA_BASE) return null;
  const usados = validos.slice(0, 6);
  const soma = usados.reduce((a, p) => ({ s: a.s + p.sistolica, d: a.d + p.diastolica }), {
    s: 0,
    d: 0,
  });
  return {
    sistolica: Math.round(soma.s / usados.length),
    diastolica: Math.round(soma.d / usados.length),
    medidas: usados.length,
  };
}

/**
 * A pressão dela contra a régua absoluta E contra ela mesma.
 *
 * A gravidade devolvida é a MAIOR das duas. Sem isso, um delta "normal"
 * rebaixaria um 165/105 — que é o erro que transforma um alerta em ruído no
 * caso exato em que ele precisa funcionar.
 */
export function sinalPressaoComBase(
  sistolica?: number | null,
  diastolica?: number | null,
  base?: BasePessoal | null,
): Sinal | null {
  const absoluto = sinalPressao(sistolica, diastolica);
  if (!absoluto || !base || sistolica == null || diastolica == null) return absoluto;
  /* Já grave pela régua absoluta: o delta não acrescenta nada e a nota dele
     competiria com "pressão em faixa grave", que é a que importa ler. */
  if (absoluto.gravidade === "grave") return absoluto;

  const ds = sistolica - base.sistolica;
  const dd = diastolica - base.diastolica;
  const subiu = ds >= DELTA_PRESSAO.sistolica || dd >= DELTA_PRESSAO.diastolica;
  if (!subiu) return absoluto;

  const qual =
    ds >= DELTA_PRESSAO.sistolica && dd >= DELTA_PRESSAO.diastolica
      ? `+${ds} e +${dd}`
      : ds >= DELTA_PRESSAO.sistolica
        ? `+${ds} na sistólica`
        : `+${dd} na diastólica`;
  return {
    /* Nunca passa de "atenção". Descreve o que aconteceu; não nomeia doença. */
    gravidade: "atencao",
    nota: `${qual} sobre a média dela (${base.sistolica}/${base.diastolica})`,
  };
}
