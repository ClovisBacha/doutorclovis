/**
 * O QUE A BOLHA DIZ NA FOLHA DO DIA.
 *
 * O balão do mascote tinha UM texto fixo de 118 caracteres — cinco linhas, que
 * comiam a primeira dobra da tela e diziam a mesma coisa todo santo dia.
 * Agora são 33 frases aprovadas pelo dono, repartidas por situação.
 *
 * ─── AS TRÊS REGRAS QUE ESTE ARQUIVO EXISTE PARA GARANTIR ───────────────────
 *
 * 1. **A frase certa para o momento, nunca sorteada.** A escolha sai do DIA da
 *    jornada (`dia % tamanho`), e não de `Math.random()`: sorteio faria o
 *    servidor escolher uma frase e o cliente outra, e a tela trocaria de texto
 *    sozinha na hidratação. Pelo dia, ela vê uma frase nova quase toda vez que
 *    volta, e sempre a mesma dentro do mesmo dia.
 *
 * 2. **Modo Cuidado tem lista PRÓPRIA, e o portão é aqui.** Quem perdeu a
 *    gestação não pode receber "vocês dois", "{bebê} está crescendo aí dentro"
 *    nem convite a comemorar. Deixar isso para o chamador filtrar é como o app
 *    já errou antes: nove pontos de uso lembram e o décimo esquece.
 *
 * 3. **Nenhum buraco fica à mostra.** Uma frase que pede `{bebe}` só entra no
 *    sorteio se houver nome; uma que pede `{semana}` só entra se houver semana
 *    e a paciente não estiver no pós-parto. "Semana 41" para quem já teve o
 *    bebê, ou um literal "{bebe}" na tela, são os dois modos de esta tela
 *    parecer quebrada.
 */

/** As sete faixas do dia. O relógio basta: aqui não há arte para casar. */
export type FaixaDoDia =
  | "madrugada"
  | "cedo"
  | "manha"
  | "meiodia"
  | "tarde"
  | "fimdetarde"
  | "noite";

export function faixaDaHora(hora: number): FaixaDoDia {
  const h = Math.max(0, Math.min(23, Math.floor(hora)));
  if (h < 5) return "madrugada";
  if (h < 8) return "cedo";
  if (h < 12) return "manha";
  if (h < 14) return "meiodia";
  if (h < 18) return "tarde";
  if (h < 20) return "fimdetarde";
  return "noite";
}

type Frase = {
  texto: string;
  /** Precisa do nome do bebê para fazer sentido. */
  pedeBebe?: boolean;
  /** Precisa da semana gestacional. */
  pedeSemana?: boolean;
  /** Fala do bebê na barriga — não vale depois que ele nasceu. */
  soGestacao?: boolean;
};

const f = (texto: string, extra: Omit<Frase, "texto"> = {}): Frase => ({ texto, ...extra });

/** A — ela abriu e ainda não fez nada. É o primeiro "oi" do dia. */
const ABERTURA: Frase[] = [
  f("💗 Que bom te ver por aqui. Vamos com calma, do seu jeito."),
  f("💗 Oi, você. Reservei cinco minutinhos só pra vocês dois. 💜", { soGestacao: true }),
  f("💗 Respira fundo. A gente começa quando você quiser. 💜"),
  f("💗 Só de você ter aberto, o dia já começou bem. 💜"),
];

/** B — começou e não fechou. O papel aqui é tirar pressa, não cobrar. */
const NO_MEIO: Frase[] = [
  f("✨ {feitos} de 6, e cada um deles conta. Segue no seu ritmo. 💗"),
  f("✨ Você já começou — essa é a parte difícil. O resto vem. 💜"),
  f("✨ Falta pouquinho pra fechar o dia. Mas sem pressa, tá? 💗"),
  f("✨ Um de cada vez. Ninguém aqui está contando o relógio. 💜"),
];

/** C — os seis fechados. */
const COMPLETO: Frase[] = [
  f("🌟 Dia completo! O que você fez hoje fica com vocês dois. 💜", { soGestacao: true }),
  f("🌟 Fechou tudo. Agora descansa — você cuidou bem de vocês. 💗"),
  f("🌟 Seis de seis. Que dia bonito o de vocês hoje. 💜"),
  f("🌟 Pronto por hoje. Amanhã a gente recomeça, sem cobrança. 💗"),
];

/** D — o vínculo: a semana andada e o bebê. */
const VINCULO: Frase[] = [
  f("🌱 Semana {semana}. Olha só o caminho que você já andou. 💜", {
    pedeSemana: true,
    soGestacao: true,
  }),
  f("💜 {bebe} está crescendo aí dentro, no ritmo de vocês dois.", {
    pedeBebe: true,
    soGestacao: true,
  }),
  f("💜 Quando você desacelera, {bebe} sente. Respira comigo? 💗", {
    pedeBebe: true,
    soGestacao: true,
  }),
  f("💗 Cuidar de você hoje é cuidar dele também — as duas coisas juntas."),
];

/**
 * E — pela hora.
 *
 * A MADRUGADA é a faixa mais delicada da lista e por isso as duas frases dela
 * não pedem NADA: gestante acordada às 3h quase nunca está ali por escolha, e
 * um convite a "fazer uma atividade" nessa hora lê como cobrança. Elas só
 * fazem companhia.
 */
const POR_HORA: Record<FaixaDoDia, Frase[]> = {
  madrugada: [
    f("🌙 Não consegue dormir? Fica aqui comigo um pouquinho. 💜"),
    f("🌙 Madrugada é longa. Respira devagar que ela passa. 💗"),
  ],
  cedo: [
    f("🌅 Bom dia bem cedo. Que tal acordar devagar com {bebe}? 💜", {
      pedeBebe: true,
      soGestacao: true,
    }),
    f("🌅 O dia mal começou e você já veio. Que carinho. 💗"),
  ],
  manha: [
    f("☀️ Bom dia! Que tal começar respirando fundo com {bebe}? 💜", {
      pedeBebe: true,
      soGestacao: true,
    }),
    f("☀️ Cinco minutinhos agora rendem o dia inteiro. 💜"),
    f("☀️ Manhã boa pra começar leve. Escolhe um e vem. 💗"),
  ],
  meiodia: [
    f("🌞 Meio do dia. Antes de seguir, um respiro por vocês dois. 💜", { soGestacao: true }),
    f("🌞 Já comeu? Depois passa aqui pra desacelerar um pouco. 💗"),
  ],
  tarde: [
    f("🌤️ Boa tarde. Faz uma pausa comigo, nem que seja curtinha. 💗"),
    f("🌤️ Tarde é ótima pra alongar. {bebe} gosta quando você se mexe. 💜", {
      pedeBebe: true,
      soGestacao: true,
    }),
  ],
  fimdetarde: [
    f("🌆 Fim de tarde. O corpo pesa mais agora — vai com jeitinho. 💜"),
    f("🌆 Antes da noite chegar, um minutinho só pra você. 💗"),
  ],
  noite: [
    f("🌙 Boa noite. Faz um bem devagarinho e vai dormir tranquila. 💜"),
    f("🌙 Se hoje não deu, tudo bem. Amanhã também é de vocês. 💗"),
    f("🌙 O dia foi o que foi. Aqui você pode só respirar. 💜"),
    f("🌙 Antes de deitar, deixa uma coisa boa guardada no diário. 💗"),
  ],
};

/**
 * MODO CUIDADO — lista à parte, e curta de propósito.
 *
 * Nenhuma fala do bebê, nenhuma fala em "vocês dois", nenhuma pede tarefa.
 * O texto que estava aqui antes tinha 86 caracteres e quatro linhas; estas
 * seguem o mesmo teto das outras.
 */
const CUIDADO: Frase[] = [
  f("💗 Que bom te ver por aqui. Hoje, cuidar de você já basta. 💜"),
  f("💗 No seu tempo, do seu jeito. Não tem nada a cumprir aqui."),
  f("💜 Fica o quanto quiser. Estou aqui com você."),
];

export type EstadoDoRecado = {
  /** Quantos dos 6 momentos do dia já foram feitos. */
  feitos: number;
  /** Dia da jornada — é ele que gira a frase, e nunca o acaso. */
  dia: number;
  /**
   * Hora local (0–23), ou `null` quando ainda não se sabe.
   *
   * `null` NÃO é erro: é o primeiro quadro, antes de o cliente ler o relógio.
   * Sem hora, as frases de hora simplesmente não entram no sorteio — o texto
   * sai das outras listas em vez de a tela ficar vazia.
   */
  hora?: number | null;
  /** Nome do bebê, quando ela deu um. */
  bebe?: string | null;
  /** Semana gestacional. */
  semana?: number | null;
  /** O bebê já nasceu — o Caminho virou pós-parto. */
  posParto?: boolean;
  careMode?: boolean;
};

/** Só o primeiro nome: "Maria Eduarda Ferreira" estouraria as três linhas. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

function preencher(texto: string, e: EstadoDoRecado): string {
  return texto
    .replace("{feitos}", String(e.feitos))
    .replace("{semana}", String(e.semana ?? ""))
    .replace(/\{bebe\}/g, e.bebe ? primeiroNome(e.bebe) : "");
}

function serve(fr: Frase, e: EstadoDoRecado): boolean {
  if (fr.pedeBebe && !(e.bebe && primeiroNome(e.bebe))) return false;
  if (fr.pedeSemana && !(typeof e.semana === "number" && e.semana > 0)) return false;
  if (fr.soGestacao && e.posParto) return false;
  return true;
}

/**
 * A FRASE DO MOMENTO.
 *
 * A ordem das perguntas é a prioridade: luto primeiro, depois o dia fechado
 * (uma frase de "vamos começar" lida depois de ela ter feito tudo ensina que o
 * app não repara no que ela fez), depois o meio do caminho.
 *
 * Só na ABERTURA — nada feito ainda — é que as listas se juntam: as quatro de
 * boas-vindas, as quatro de vínculo e as da faixa de hora atual entram no mesmo
 * bolo. É o momento em que qualquer uma das três cabe, e é onde a variedade
 * mais importa, porque é a primeira coisa que ela lê ao abrir.
 */
export function recadoDaBolha(e: EstadoDoRecado): string {
  const lista = (() => {
    if (e.careMode) return CUIDADO;
    if (e.feitos >= 6) return COMPLETO;
    if (e.feitos > 0) return NO_MEIO;
    const daHora = typeof e.hora === "number" ? POR_HORA[faixaDaHora(e.hora)] : [];
    return [...ABERTURA, ...VINCULO, ...daHora];
  })();

  const cabem = lista.filter((fr) => serve(fr, e));
  /* `ABERTURA[0]` e as duas primeiras de cada outra lista não pedem nada, então
     `cabem` nunca fica vazia. O retorno abaixo é cinto de segurança para uma
     edição futura que remova a última frase incondicional de uma lista. */
  if (cabem.length === 0) return preencher(ABERTURA[0].texto, e);

  const i = ((Math.floor(e.dia) % cabem.length) + cabem.length) % cabem.length;
  return preencher(cabem[i].texto, e);
}

/** Só para o teste: todas as frases, para varrer regras que valem para todas. */
export const TODAS_AS_FRASES: Frase[] = [
  ...ABERTURA,
  ...NO_MEIO,
  ...COMPLETO,
  ...VINCULO,
  ...Object.values(POR_HORA).flat(),
  ...CUIDADO,
];
