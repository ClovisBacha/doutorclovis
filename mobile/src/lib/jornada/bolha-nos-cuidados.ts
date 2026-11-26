/**
 * A BOLHA NOS CUIDADOS (19/11/2026) — o que a Bolha diz DENTRO de cada
 * atividade: na abertura, nas trocas importantes da sessão e no fim.
 *
 * O dono: "o bebê bolha será esse guia neste caminho [...] trabalhe isso em
 * todas as telas possíveis". A conversa da aba do Bebê (`lib/bolha/conversa.ts`)
 * convida para o cuidado; aqui a Bolha ACOMPANHA o cuidado por dentro, sempre
 * na primeira pessoa, curta, e nunca no lugar de quem cuida da saúde dela.
 *
 * As regras deste arquivo (a catraca está em `bolha-nos-cuidados.test.ts`):
 * - **bem-estar, nunca conduta**: a Bolha conta o tempo, convida, comemora.
 *   Não promete efeito ("reduz", "melhora", "alivia", "faz bem"), não manda
 *   ("você deve", "procure") e não interpreta o que ela sente;
 * - **o bebê sem gênero**: nada de "ele/ela/dele/dela";
 * - **texto de TELA**: a meditação, o Mexer, "Para vocês dois" e as
 *   histórias têm voz gravada, e a voz não muda de texto. Nada daqui é lido
 *   em voz alta, e nada daqui substitui uma fala gravada;
 * - **Modo Cuidado** (o luto): a Bolha fica quieta e gentil, sem festa e sem
 *   falar do bebê.
 */

/* ── Mexer ────────────────────────────────────────────────────────────── */

export type EnergiaDoMexer = "com-energia" | "cansada";

/** A abertura do Mexer: muda com o que ela já contou. */
export function falaDoMexer(o: {
  jaFeita: boolean;
  cuidado: boolean;
  energia: EnergiaDoMexer | null;
}): string {
  if (o.cuidado)
    return "Movimentos leves, sem ir ao chão. Eu conto o tempo, você vai no seu ritmo.";
  if (o.jaFeita) return "Você já se mexeu hoje. Se o corpo pedir, eu conto o tempo de novo.";
  if (o.energia === "cansada")
    return "Combinado, hoje vai mais leve. Eu separo os movimentos mais calmos.";
  if (o.energia === "com-energia") return "Que bom! Agora me diz quanto tempo você tem.";
  return "Me conta como está a sua energia e quanto tempo você tem. Eu monto a sequência.";
}

/**
 * Durante a sessão: a fala muda só nas trocas que importam (o começo, a
 * troca de posição, a metade e o último), e no resto lembra que pular vale.
 */
export function falaNaSessaoDoMexer(o: { indice: number; total: number; troca: boolean }): string {
  if (o.troca) return "Muda de posição com calma. O próximo já vem.";
  if (o.indice <= 0)
    return "Eu conto o tempo, você acompanha a figura. Pode pular o que não for confortável.";
  if (o.indice >= o.total - 1) return "Último movimento. Sem pressa.";
  if (o.total >= 4 && o.indice === Math.floor(o.total / 2))
    return "Metade feita. Pode pular o que não couber hoje.";
  return "No seu ritmo. Pode pular o que não for confortável.";
}

/** O fim do Mexer. */
export function falaDoFimDoMexer(o: { cuidado: boolean }): string {
  if (o.cuidado) return "Esse tempo foi seu. Volte quando quiser.";
  return "Cuidar de você é cuidar de vocês dois. Amanhã tem outra sequência.";
}

/* ── Respirar (a meditação) ───────────────────────────────────────────── */

/** A abertura da meditação: o programa dos sete dias, a sequência, ou o convite. */
export function falaDaMeditacao(o: {
  cuidado: boolean;
  jaFeita: boolean;
  /** Dias seguidos com meditação (`sequenciaDeDatas`). */
  seguidos: number;
  /** O dia do programa que abre a tela, quando ele abre. */
  diaDoPrograma: { dia: number; de: number } | null;
}): string {
  if (o.cuidado) return "Alguns minutos só seus. Eu conto o tempo, você só respira.";
  if (o.diaDoPrograma)
    return `Hoje é o dia ${o.diaDoPrograma.dia} de ${o.diaDoPrograma.de}. Eu guio, você só acompanha a respiração.`;
  if (o.jaFeita) return "Você já respirou comigo hoje. Se quiser, a gente faz mais um pouco.";
  if (o.seguidos >= 2) return `${o.seguidos} dias seguidos respirando comigo. Vamos mais um pouco?`;
  return "Respira comigo? Você escolhe o tempo e eu conto com você.";
}

/** O ciclo sem fala gravada: a Bolha, de olhos fechados, respira junto. */
export const RESPIRA_COMIGO = "Respira comigo.";

/** O véu da pausa. */
export function falaDaPausa(motivo: "toque" | "fundo" | null): string {
  if (motivo === "fundo") return "O app saiu da tela e eu pausei aqui. Está tudo guardado.";
  return "Pausei. Quando você quiser, a gente continua daqui.";
}

/** "Como você está agora?": a Bolha pergunta sem esperar resposta certa. */
export const FALA_DO_REFLEXO =
  "Terminamos. Não tem resposta certa, é só para você perceber como ficou.";

/** O fim da meditação quando ela pulou a pergunta (a resposta tem a fala gravada dela). */
export const FIM_DA_MEDITACAO_SEM_RESPOSTA =
  "Volte quando quiser. Eu conto o tempo de novo com você.";

/* ── Ler para o bebê ──────────────────────────────────────────────────── */

/** A Bolha ouvindo a leitura: uma fala no começo, uma no meio, uma no fim. */
export function falaDaLeitura(o: { linha: number; total: number }): string {
  if (o.linha <= 0) return "Pode começar. Eu fico aqui ouvindo.";
  if (o.linha >= o.total - 1) return "Última linha. Sem pressa.";
  return "No seu ritmo. Toque à esquerda para voltar uma linha.";
}

/* ── Para vocês dois ──────────────────────────────────────────────────── */

export const FALA_DO_CASAL = {
  abertura: "Chama quem vai estar com você no parto. São dez minutos, uma parte de cada vez.",
  pausa: "Pausei. Quando vocês quiserem, a gente continua.",
  fim: "Foi bonito ver vocês dois juntos. Dá para repetir quando quiserem.",
  aindaNao: (semana: number) =>
    `Esta sessão abre na ${semana}ª semana, quando o parto já está mais perto.`,
  foraDaTrilha:
    "Esta sessão não faz parte da sua trilha de hoje. Respirar e escrever continuam aqui.",
} as const;

/* ── Os sons da noite ─────────────────────────────────────────────────── */

export const FALA_DOS_SONS = "Escolhe um som e pode apagar a tela. Eu desligo na hora marcada.";

/* ── A folha do dia ───────────────────────────────────────────────────── */

/** Um dia que já passou: a Bolha mostra o que foi feito, sem cobrar o que faltou. */
export function falaDoDiaQuePassou(feitos: number, total: number): string {
  if (feitos >= total) return `Nesse dia você fez os ${total} cuidados. Ficou guardado aqui.`;
  if (feitos <= 0) return "Esse dia já passou. Hoje é um dia novo, e eu estou aqui.";
  return `Nesse dia você fez ${feitos} de ${total} cuidados. Hoje é um dia novo.`;
}

/** Todas as frases deste arquivo (para a catraca de conteúdo). */
export function todasAsFalasDosCuidados(): string[] {
  const frases = new Set<string>();
  for (const cuidado of [false, true])
    for (const jaFeita of [false, true])
      for (const energia of [null, "com-energia", "cansada"] as const)
        frases.add(falaDoMexer({ cuidado, jaFeita, energia }));
  for (let total = 1; total <= 9; total++)
    for (let indice = 0; indice < total; indice++)
      for (const troca of [false, true]) frases.add(falaNaSessaoDoMexer({ indice, total, troca }));
  for (const cuidado of [false, true]) frases.add(falaDoFimDoMexer({ cuidado }));
  for (const cuidado of [false, true])
    for (const jaFeita of [false, true])
      for (const seguidos of [0, 1, 2, 9])
        for (const diaDoPrograma of [null, { dia: 3, de: 7 }])
          frases.add(falaDaMeditacao({ cuidado, jaFeita, seguidos, diaDoPrograma }));
  frases.add(RESPIRA_COMIGO);
  for (const m of ["toque", "fundo", null] as const) frases.add(falaDaPausa(m));
  frases.add(FALA_DO_REFLEXO);
  frases.add(FIM_DA_MEDITACAO_SEM_RESPOSTA);
  for (let total = 1; total <= 6; total++)
    for (let linha = 0; linha < total; linha++) frases.add(falaDaLeitura({ linha, total }));
  frases.add(FALA_DO_CASAL.abertura);
  frases.add(FALA_DO_CASAL.pausa);
  frases.add(FALA_DO_CASAL.fim);
  frases.add(FALA_DO_CASAL.aindaNao(28));
  frases.add(FALA_DO_CASAL.foraDaTrilha);
  frases.add(FALA_DOS_SONS);
  for (let n = 0; n <= 5; n++) frases.add(falaDoDiaQuePassou(n, 5));
  return [...frases];
}
