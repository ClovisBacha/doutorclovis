/**
 * O QUE O BEBÊ BOLHA DIZ QUANDO NÃO HÁ RECADO.
 *
 * Pedido do dono: "quando não tiver notificações, o bebê bolha vai escrever
 * frases de conforto, motivação etc, motivando muitas vezes a usar o app de
 * algumas formas divertidas, principalmente a aba do game, para meditar,
 * aprender — algumas mensagens chamando a paciente pelo nome, outras sem".
 *
 * ─── UMA POR DIA, E NÃO UMA POR ABERTURA ───────────────────────────────────
 *
 * A home monta toda vez que ela toca em "Bebê". Falando a cada montagem, o
 * personagem viraria ruído em três dias — e aí ninguém lê o balão no dia em
 * que ele tiver algo urgente. `fraseDoDia` é determinística no dia: a mesma
 * frase o dia inteiro, outra amanhã. Companhia, não cutucão.
 *
 * ─── AS QUATRO REGRAS DE ESCRITA ───────────────────────────────────────────
 *
 *  1. **Nunca cobra.** Não existe "você não fez", "faltou", "sua sequência vai
 *     acabar". Este app fala com gestante de alto risco, e foi por isso que a
 *     carinha `preocupada` já saiu da personagem: cobrança disfarçada de
 *     fofura continua sendo cobrança.
 *  2. **Convida, não manda.** "Que tal", "se der vontade", "cabe em qualquer
 *     tarde". O convite pode ser recusado sem culpa; a ordem, não.
 *  3. **O conforto não pede nada em troca.** Metade das frases não leva a
 *     lugar nenhum do app. Se todas empurrassem para uma aba, isto seria
 *     marketing com cara de amiga.
 *  4. **Nada de promessa clínica.** Ela não diz que está tudo bem, não opina
 *     sobre sintoma e não manda descansar como quem receita.
 */

/** Faixa do dia, pela hora local. */
export type Periodo = "madrugada" | "manha" | "tarde" | "noite";

export function periodoDaHora(hora: number): Periodo {
  const h = Math.max(0, Math.min(23, Math.floor(hora)));
  if (h < 5) return "madrugada";
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

/**
 * O TEMPO LÁ FORA, em três estados — e só três.
 *
 * Pedido do dono: as frases também devem conversar com o clima, "que já tem
 * meio caminho andado" no cartão de saudação. O que vem da API é um `weather
 * code` da Open-Meteo com dezenas de valores; o que muda o QUE SE DIZ a uma
 * gestante são três situações:
 *
 *  · **chuva** — o convite muda de "caminhar" para "chá quentinho";
 *  · **calor** — água e sombra viram a única coisa que importa dizer;
 *  · **frio** — agasalho, e nada de mandar sair.
 *
 * Vinte estados climáticos dariam vinte frases quase iguais, e a paciente
 * leria a mesma coisa com sinônimos. O resto do tempo é `null`: dia comum, e a
 * frase fala do dia dela em vez de falar do céu.
 *
 * Os cortes de temperatura são os do senso comum brasileiro (28 °C e 15 °C), e
 * a chuva sai do MESMO limiar que o cartão de saudação usa (`code >= 51`) —
 * duas réguas para "está chovendo" na mesma tela é como o app começa a se
 * contradizer.
 */
export type Tempo = "chuva" | "calor" | "frio" | null;

export function tempoDoMomento(code: number | null, temp: number | null): Tempo {
  if (code != null && code >= 51) return "chuva";
  if (temp != null && temp >= 28) return "calor";
  if (temp != null && temp <= 15) return "frio";
  return null;
}

export type FraseDoMascote = {
  texto: string;
  /** Vazio = serve a qualquer hora. */
  periodos?: Periodo[];
  /**
   * Só entra com este tempo lá fora.
   *
   * Vazio = serve com qualquer clima. As frases de clima são MINORIA de
   * propósito: se toda frase falasse do tempo, o personagem viraria boletim
   * meteorológico com carinha.
   */
  tempo?: Exclude<Tempo, null>;
  /**
   * Recorte de HORA dentro do período, quando a frase cita o relógio.
   *
   * "Já são quase onze" é verdade às 22h40 e mentira às 18h05 — e as duas caem
   * no mesmo período `noite`, que vai das 18h à meia-noite. Um personagem que
   * erra a hora que ele mesmo anunciou perde a única coisa que ele tem, que é
   * parecer estar ali junto.
   *
   * `[de, ate)` na hora cheia local. Sem `hora` conhecida em `fraseDoDia`, a
   * frase com recorte simplesmente não entra: na dúvida, uma frase genérica.
   */
  horas?: [number, number];
  /**
   * Semana gestacional MÍNIMA para a frase fazer sentido.
   *
   * Existe por uma só: "Já sentiu o bebê hoje? Dá para contar os chutes". Ela
   * saía em qualquer semana, e a mulher de 11 semanas — que ainda não tem como
   * sentir nada, e sabe disso vagamente — lia todo dia um personagem
   * perguntando se ela já sentiu. Num app de alto risco, plantar "eu deveria
   * estar sentindo e não estou" é o oposto do que este balão existe para
   * fazer.
   *
   * A régua é a do PRÓPRIO app: o módulo do 3º trimestre é quem diz "é hora de
   * começar a contar os chutes (10 movimentos em 2 horas)". Sem semana
   * conhecida (sem DUM, pós-parto), a frase não entra: na dúvida, calar.
   */
  desde?: number;
  /**
   * Sobrevive ao Modo Cuidado.
   *
   * O padrão é **não**: no luto, quase tudo aqui é a coisa errada a dizer.
   * Marcar `noLuto` é uma decisão consciente frase a frase, e a lista de quem
   * passa é curta de propósito — nenhuma menciona o bebê, a semana, o jogo ou
   * qualquer conquista.
   */
  noLuto?: boolean;
};

/**
 * ⚠️ `{nome}` aqui NÃO leva vírgula no texto: quem monta é `comNome`, que
 * devolve ", Ana" ou string vazia. Escrever a vírgula fora deixaria "Bom dia, !"
 * na conta de quem não preencheu o perfil.
 */
export const FRASES: FraseDoMascote[] = [
  // ── Manhã ───────────────────────────────────────────────────────────────
  { texto: "Bom dia{nome} 💛 Que tal começar respirando fundo comigo?", periodos: ["manha"] },
  { texto: "Bom dia! Tem aula nova esperando por você no Caminho 🎓", periodos: ["manha"] },
  { texto: "Acordou! Eu também. Hoje é um bom dia para um movimento leve 🤸", periodos: ["manha"] },
  {
    texto: "Bom dia{nome}. Um dia de cada vez — este acabou de começar 🌅",
    periodos: ["manha"],
    noLuto: true,
  },

  // ── Tarde ───────────────────────────────────────────────────────────────
  { texto: "Bebeu água hoje{nome}? Eu pergunto porque me importo 💧", periodos: ["tarde"] },
  { texto: "Cinco minutinhos de meditação cabem em qualquer tarde 🌿", periodos: ["tarde"] },
  {
    texto: "Boa tarde! Se der vontade de aprender algo novo, estou no Caminho 📚",
    periodos: ["tarde"],
  },

  // ── Noite ───────────────────────────────────────────────────────────────
  {
    texto: "Boa noite{nome} 💛 Fechar o dia no Caminho leva dois minutinhos.",
    periodos: ["noite"],
  },
  { texto: "Que tal um alongamento devagar antes de deitar? 🌙", periodos: ["noite"] },
  {
    texto: "Boa noite. Hoje já foi — e você chegou até aqui 💛",
    periodos: ["noite"],
    noLuto: true,
  },

  // ── Fim da noite: a hora dita a frase ───────────────────────────────────
  {
    texto: "Já são quase onze{nome} 🌙 Que tal fechar o dia com uma respiração?",
    periodos: ["noite"],
    horas: [22, 24],
  },
  {
    texto: "Fim de noite. Uma meditação curta ajuda a soltar o dia 🌿",
    periodos: ["noite"],
    horas: [21, 24],
  },
  {
    texto: "Começou a noite{nome}. Cinco minutinhos para você antes do jantar? 🌿",
    periodos: ["noite"],
    horas: [18, 21],
  },

  // ── Madrugada ───────────────────────────────────────────────────────────
  {
    texto: "Acordada a essa hora? Estou aqui com você 🌙",
    periodos: ["madrugada"],
    noLuto: true,
  },
  {
    texto: "Se o sono não vem, respira comigo por um minuto. Sem pressa.",
    periodos: ["madrugada"],
    noLuto: true,
  },

  // ── Conforto, a qualquer hora ───────────────────────────────────────────
  { texto: "Dia difícil? Não precisa dar conta de tudo hoje 💛", noLuto: true },
  { texto: "Você está fazendo mais do que imagina{nome} 💛", noLuto: true },
  { texto: "Se hoje só der para respirar, já está ótimo.", noLuto: true },
  { texto: "Estou aqui do seu lado, no cantinho da tela. Sempre 💛", noLuto: true },
  { texto: "Não existe jeito certo de viver um dia difícil.", noLuto: true },

  // ── Com o tempo lá fora ─────────────────────────────────────────────────
  { texto: "Chuva lá fora 🌧️ Dia perfeito para uma meditação sem pressa.", tempo: "chuva" },
  {
    texto: "Está chovendo{nome} — chá quentinho e um cantinho macio 🌧️",
    tempo: "chuva",
    noLuto: true,
  },
  { texto: "Chovendo? O Caminho não molha 😄 Passa lá quando quiser.", tempo: "chuva" },
  { texto: "Calor hoje 🥵 Água por perto e sombra sempre que der.", tempo: "calor" },
  { texto: "Dia quente{nome}. Bebe uma água por nós dois? 💧", tempo: "calor" },
  { texto: "Friozinho hoje 🧣 Se agasalha bem antes de sair.", tempo: "frio" },
  { texto: "Está frio{nome} — manta, chá e um episódio bom 💛", tempo: "frio", noLuto: true },

  // ── Convite para o app, sem cobrança ────────────────────────────────────
  { texto: "Tem uma meditação novinha te esperando 🌿 Que tal agora?" },
  { texto: "Curiosidade do dia sobre o bebê? É só passar no Caminho 🎓" },
  { texto: "Sabia que dá para ver o bebê crescer semana a semana? Toque nele ☝️" },
  { texto: "Anotar seu peso hoje leva dez segundos — e o seu médico vê ⚖️" },
  { texto: "Já sentiu o bebê hoje{nome}? Dá para contar os chutes na aba Saúde 👣", desde: 28 },
];

/**
 * A frase de hoje — ou `null` quando não há nenhuma que sirva.
 *
 * `dia` é o número de dias inteiros desde a época; quem chama tira do relógio
 * LOCAL dela. É ele que faz a frase ser a mesma o dia todo e outra amanhã.
 *
 * ─── ⚠️ `dia % n`, E NADA DE PASSO "ESPERTO" ───────────────────────────────
 *
 * A primeira versão andava de 7 em 7 (`dia * 7 % n`), com a ideia de embaralhar
 * a ordem. O comentário dela dizia, com todas as letras, que 7 só funciona
 * quando `n` não é múltiplo de 7 — e a lista da MANHÃ tem exatamente 14 frases.
 * Resultado: a paciente que abre de manhã via duas frases, alternadas, para
 * sempre. O teste pegou; o comentário tinha previsto e eu escrevi assim mesmo.
 *
 * `dia % n` cobre a lista inteira em `n` dias, para qualquer `n`. A ordem fica
 * previsível — e ninguém decora a ordem de doze frases espalhadas por doze
 * dias.
 */
export function fraseDoDia(o: {
  dia: number;
  periodo: Periodo;
  nome?: string | null;
  careMode?: boolean;
  /** O tempo lá fora. `null`/ausente = dia comum, e as frases de clima saem. */
  tempo?: Tempo;
  /** Hora local cheia (0–23). Sem ela, as frases que citam o relógio saem. */
  hora?: number;
  /** Semana gestacional. Sem ela, as frases com `desde` saem. */
  semanas?: number | null;
}): string | null {
  const temNome = !!(o.nome ?? "").trim();
  const servem = FRASES.filter((f) => {
    if (o.careMode && !f.noLuto) return false;
    if (f.periodos && !f.periodos.includes(o.periodo)) return false;
    /* Frase de clima só com AQUELE clima. Sem o tempo conhecido (a API ainda
       não respondeu, ou ela negou a localização), elas simplesmente não
       entram: melhor uma frase genérica que uma frase sobre uma chuva que não
       está caindo. */
    if (f.tempo && f.tempo !== o.tempo) return false;
    /* Recorte de hora: "quase onze" às 18h05 é o personagem mentindo sobre a
       única coisa que ele podia saber com certeza. */
    if (f.horas) {
      if (o.hora == null) return false;
      const hh = Math.floor(o.hora);
      if (hh < f.horas[0] || hh >= f.horas[1]) return false;
    }
    /* Semana mínima: sem semana conhecida a frase sai. Ver `desde`. */
    if (f.desde != null && (o.semanas == null || o.semanas < f.desde)) return false;
    /* Frase que chama pelo nome só entra se houver nome. Trocar por vazio
       deixaria "Bebeu água hoje?" — que é outra frase, e pior. */
    if (!temNome && f.texto.includes("{nome}")) return false;
    return true;
  });
  if (servem.length === 0) return null;
  const i = Math.abs(Math.floor(o.dia)) % servem.length;
  return comNomeNaFrase(servem[i].texto, o.nome);
}

/**
 * `{nome}` vira ", Ana" — ou some.
 *
 * Mesma régua de `tutorial-do-mascote.comNome`, repetida aqui de propósito:
 * importar de lá amarraria as frases ao tutorial, e um dia um dos dois vai
 * querer outra pontuação. São dez caracteres; o acoplamento seria permanente.
 */
export function comNomeNaFrase(texto: string, nome?: string | null): string {
  const limpo = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return texto.replaceAll("{nome}", limpo ? `, ${limpo}` : "");
}

/** Dias inteiros desde a época, pelo calendário LOCAL de quem está lendo. */
export function diaLocalDe(agora: Date): number {
  return Math.floor(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86_400_000);
}
