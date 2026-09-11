/**
 * A HORA DE UM REGISTRO, ESCRITA UMA VEZ SÓ.
 *
 * ⚠️ **`toLocaleString` NO RENDER É MISMATCH DE HIDRATAÇÃO, e ele foi MEDIDO
 * nas duas telas clínicas.** O servidor deste app roda em UTC e o aparelho da
 * paciente em `America/Sao_Paulo`: a mesma sessão de chutes saía "05/09/2026,
 * 04:40" no HTML do servidor e "05/09/2026, 01:40" na primeira pintura do
 * cliente, e a mesma contração saía "17:20" contra "14:20". O React descarta a
 * árvore inteira quando isso acontece — é a classe de defeito que já deixou
 * este app SEM ABRIR.
 *
 * ⚠️ E o guarda `typeof window === "undefined"` NÃO resolve: ele evita o
 * CRASH no servidor e não evita a DIVERGÊNCIA, porque as duas execuções são
 * exatamente as que precisam concordar.
 *
 * ─── POR QUE O FUSO É CRAVADO, E NÃO O DO APARELHO ──────────────────────────
 *
 * Porque o horário de um registro clínico não é um relógio de parede: é a
 * marca que o obstetra vai ler no prontuário. `clinical_events` une
 * `kick_sessions` e `contraction_logs`, e o painel do médico monta a linha do
 * tempo dela no fuso do consultório. Com o fuso do aparelho, a paciente que
 * viaja veria "22:10" e o médico, "18:10" — a mesma contração, dois horários,
 * numa conversa em que o horário é o dado.
 *
 * Cravar o fuso resolve as duas coisas de uma vez: servidor e cliente
 * concordam por construção, e a tela dela concorda com a tela dele.
 *
 * ⚠️ Se um dia o app atender fora do Brasil, o conserto NÃO é voltar ao fuso do
 * aparelho — é o fuso do CONSULTÓRIO virar dado, e continuar sendo um só por
 * paciente.
 */

/** O fuso do consultório. Um lugar só — duas cópias divergem no primeiro ajuste. */
export const FUSO_DO_REGISTRO = "America/Sao_Paulo";

function emData(quando: string | number | Date): Date | null {
  const d = quando instanceof Date ? quando : new Date(quando);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "14:20" — a hora de uma contração, de um toque, de um registro do dia. */
export function horaCurta(quando: string | number | Date): string {
  const d = emData(quando);
  if (!d) return "—";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_DO_REGISTRO,
  });
}

/** "05/09" — o eixo de um gráfico, onde a hora não cabe e não importa. */
export function diaCurto(quando: string | number | Date): string {
  const d = emData(quando);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FUSO_DO_REGISTRO,
  });
}

/** O dia civil no fuso do consultório — é a chave de "isto foi hoje?". */
function chaveDoDia(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO_DO_REGISTRO });
}

/**
 * ⚠️ **"14:20" NUMA LISTA QUE ATRAVESSA DIAS AFIRMA QUE FOI HOJE.**
 *
 * A lista de contrações mostra as DEZ últimas, e elas são registradas em
 * episódios: quem cronometrou uma noite de Braxton-Hicks na semana passada e
 * voltou a cronometrar hoje vê as duas misturadas, com a hora sozinha em cada
 * linha. Ela lê a lista para contar ao médico quando começaram — e reportar
 * como de hoje uma contração de outro dia é errar o dado que a conversa
 * inteira gira em torno.
 *
 * Hoje continua curto (é o caso de quase toda linha, e a lista é densa); o que
 * não é de hoje carrega a data. A comparação é do dia CIVIL no fuso do
 * consultório, nunca `getDate()` — o servidor roda em UTC, e das 21h à
 * meia-noite ele já está no dia seguinte.
 */
export function rotuloDoInstante(quando: string | number | Date, agora: number): string {
  const d = emData(quando);
  if (!d) return "—";
  const hoje = emData(agora);
  /* Sem um "agora" legível, o rótulo LONGO — errar para o lado de dizer o
     dia é melhor que afirmar que foi hoje. */
  if (!hoje) return `${diaCurto(d)} ${horaCurta(d)}`;
  if (chaveDoDia(d) === chaveDoDia(hoje)) return horaCurta(d);
  /* ⚠️ **SEM O ANO, e a foto é quem decidiu isto.** Com `dataHoraCurta`
     ("04/09/2026, 00:20") a linha quebrava em duas e a altura ia de 48 para
     66px, com a terceira coluna quebrando junto — numa lista das dez últimas
     contrações o ano é a parte que nunca informa nada e é a que custa o
     espaço. */
  return `${diaCurto(d)} ${horaCurta(d)}`;
}

/**
 * ⚠️ **"intervalo 1340min" ENTRE DOIS EPISÓDIOS É RUÍDO COM CARA DE MEDIDA.**
 *
 * O intervalo entre duas contrações é o dado que decide ir para a maternidade,
 * e ele só quer dizer alguma coisa DENTRO de um episódio: a própria análise
 * clínica desta tela olha as duas últimas horas e nada além
 * (`analyzeContractions`). Acima disso, o número em minutos é uma soma de
 * horas de sono escrita na unidade do alarme.
 *
 * ⚠️ E o corte é de TEMPO, nunca de dia do calendário: um trabalho de parto às
 * 23h50 e à 00h10 são vinte minutos, e uma régua por data os separaria.
 */
export function intervaloCurto(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 0) return "—";
  const m = Math.round(minutos);
  if (m < 120) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
