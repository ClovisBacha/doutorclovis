/**
 * A SEQUÊNCIA DE DIAS — o "streak" da trilha.
 *
 * ─── POR QUE ISTO VIROU ARQUIVO ─────────────────────────────────────────────
 *
 * A mesma contagem estava escrita DUAS vezes dentro de `gestacao-path.tsx`, em
 * `useMemo` soltos a cinco mil linhas de distância: uma para a gestação
 * (`doneDays`) e outra para o pós-parto (`posDone`). Idênticas, e nenhuma com
 * teste — o que significa que o número que a paciente mais olha na tela era o
 * único sem uma linha de prova.
 *
 * Duas cópias de uma regra de contagem divergem no primeiro conserto: alguém
 * arruma a virada da meia-noite na gestação e o pós-parto continua errado por
 * meses, porque ninguém abre as duas telas no mesmo dia.
 *
 * ─── A REGRA, E A DECISÃO QUE ELA CARREGA ───────────────────────────────────
 *
 * Conta para trás a partir de HOJE — ou de ONTEM, se hoje ainda não foi
 * fechado. Esse "ou" é o coração da coisa: sem ele, a sequência de quem tem 40
 * dias seguidos zeraria à meia-noite e só voltaria quando ela terminasse o dia.
 * Ela abriria o app de manhã, veria **0**, e a sequência que a fez voltar 40
 * vezes teria sido apagada por não ter feito nada ainda às 7 da manhã.
 *
 * O dia só entra na lista quando os CINCO momentos dele são fechados
 * (`TOTAL_DO_DIA`) — quem grava é `markDayTask`. Abrir o app não conta: a
 * sequência mede cuidado feito, não visita.
 */

/**
 * ─── ⚠️ O PERDÃO, E POR QUE ELE É CLÍNICO ───────────────────────────────────
 *
 * Até agosto de 2026 um único dia em branco zerava tudo. Numa gestação de alto
 * risco isso não é rigor de jogo: é a paciente que passou a noite no
 * pronto-socorro perdendo 40 dias por causa da internação. O app teria
 * transformado o pior dia dela no dia em que ele também a puniu.
 *
 * A régua: **um dia perdido é perdoado, e ganha-se um perdão a cada sete dias
 * já contados.** As duas metades importam.
 *
 *  · **Um dia**, e não dois: se ela sumiu por dois dias seguidos, a sequência
 *    acabou mesmo — e dizer o contrário seria o número deixar de significar
 *    "eu vim quase todo dia".
 *  · **Proporcional**, e não um perdão fixo: quem tem três dias não precisa de
 *    proteção nenhuma; quem tem duzentos precisa muito. Assim o perdão cresce
 *    com o que há a perder, que é exatamente onde a punição doeria mais.
 *
 * O saldo é conferido contra o que já foi contado NESTE trecho (`n`), então
 * quem alterna um dia sim, um dia não nunca chega a lugar nenhum: no primeiro
 * buraco `n` vale 1, `floor(1/7)` é 0, e a conta para em 1. Há teste.
 *
 * ⚠️ A mudança só faz sequência SUBIR, nunca descer — ninguém acorda com um
 * número menor do que o de ontem. Voltar atrás é trocar `DIAS_POR_PERDAO` por
 * `Infinity`.
 */
export const DIAS_POR_PERDAO = 7;

/**
 * O TRECHO INTEIRO — dias contados, perdões gastos e saldo.
 *
 * ─── ⚠️ A PRIMEIRA VERSÃO DO PERDÃO NÃO PERDOAVA NADA ───────────────────────
 *
 * Ela andava para trás dia a dia e, ao achar um buraco, conferia o saldo contra
 * `n` — o que já tinha sido ANDADO. Só que o buraco que importa é o mais
 * recente, e nele `n` ainda vale 0 ou 1: `perdoados >= Math.floor(0/7)` é
 * verdadeiro, e o laço quebrava.
 *
 * Medido com a função de verdade, paciente com 40 dias seguidos que perde UM:
 *
 *   sequenciaDeDias([1..40], 42)      → 0   (devia ser 40)
 *   sequenciaDeDias([1..40, 42], 42)  → 1   (devia ser 41)
 *
 * Ou seja: o perdão funcionava só para buracos que já tinham sete dias
 * contados DEPOIS deles — nunca para o dia que ela acabou de perder, que é
 * literalmente o único caso para o qual a régua foi escrita (a noite no
 * pronto-socorro). E a `FolhaDaChama` dizia por escrito "você pode ficar até 5
 * dias de fora sem perder nada" enquanto a conta zerava.
 *
 * Os sete testes que eu tinha escrito punham o buraco 10+ dias atrás de hoje,
 * então todos passavam. O caso do produto não tinha teste.
 *
 * ─── COMO FUNCIONA AGORA ────────────────────────────────────────────────────
 *
 * A régua deixou de ser "posso atravessar este buraco?" e passou a ser uma
 * afirmação sobre o trecho inteiro:
 *
 *   **a sequência é o MAIOR trecho terminando em hoje (ou ontem) em que os
 *   dias vazios são no máximo `floor(diasFeitos / 7)`, e nenhum vazio tem dois
 *   dias seguidos.**
 *
 * Por isso a varredura primeiro junta os BLOCOS de dias feitos (separados por
 * buracos de exatamente um dia) e só depois pergunta quantos blocos cabem no
 * saldo. O saldo passa a ser conferido contra o total do trecho, que é o que
 * a paciente entende por "minha sequência".
 */
type TrechoDaSequencia = {
  /** Dias feitos dentro do trecho. É a sequência. */
  dias: number;
  /** Buracos de um dia atravessados. */
  perdoesUsados: number;
  /** `floor(dias / 7)` — quantos ela poderia ter gasto ao todo. */
  saldo: number;
};

const TRECHO_VAZIO: TrechoDaSequencia = { dias: 0, perdoesUsados: 0, saldo: 0 };

function trechoDaSequencia(dias: readonly number[], hoje: number): TrechoDaSequencia {
  if (dias.length === 0) return TRECHO_VAZIO;
  const feitos = new Set(dias);

  /* Começa em hoje se hoje já está fechado; senão em ontem — sem isso, quem
     tem 40 dias abre o app às 7 da manhã e vê zero. */
  let d = feitos.has(hoje) ? hoje : hoje - 1;

  /* Blocos contíguos de dias feitos, do mais recente para trás.
     `pontesAntes` vale 1 quando o PRÓPRIO ponto de partida está vazio — ela
     perdeu ontem e hoje ainda não fez nada. Nunca passa de 1: depois de
     atravessar um vazio, o dia seguinte é feito por construção (foi ele que
     autorizou a travessia). */
  const blocos: number[] = [];
  let pontesAntes = 0;
  let atual = 0;
  /* Teto de segurança: `dias` vem de armazenamento local que já chegou
     corrompido nesta base, e sem o limite um blob com números negativos gira
     para sempre e trava a aba. Cada passo consome um dia feito ou um vazio. */
  const teto = feitos.size * 2 + 4;
  for (let passos = 0; passos < teto; passos++) {
    if (feitos.has(d)) {
      atual++;
      d--;
      continue;
    }
    /* Dois vazios seguidos: ela sumiu de verdade, e aí a sequência acabou
       mesmo. É o que impede o número de deixar de significar "eu vim quase
       todo dia". */
    if (!feitos.has(d - 1)) break;
    if (atual > 0) {
      blocos.push(atual);
      atual = 0;
    } else {
      pontesAntes++;
    }
    d--;
  }
  if (atual > 0) blocos.push(atual);
  if (blocos.length === 0) return TRECHO_VAZIO;

  /* Quantos blocos cabem: levar `m` blocos custa `pontesAntes + (m - 1)`
     perdões e rende a soma deles.

     ⚠️ Percorre TODOS os m e fica com o maior que serve, em vez de parar no
     primeiro que falha: o saldo cresce em degraus de sete, então um bloco
     grande logo atrás pode pagar uma ponte que o bloco pequeno da frente não
     pagava. Parar cedo devolveria um número menor que o próprio critério
     admite — errar contra a paciente, e sem motivo. */
  let total = 0;
  let melhor = TRECHO_VAZIO;
  for (let m = 1; m <= blocos.length; m++) {
    total += blocos[m - 1];
    const pontes = pontesAntes + (m - 1);
    const saldo = Math.floor(total / DIAS_POR_PERDAO);
    if (pontes <= saldo && total > melhor.dias) {
      melhor = { dias: total, perdoesUsados: pontes, saldo };
    }
  }
  return melhor;
}

/**
 * Quantos dias seguidos, terminando em `hoje` (ou em `hoje - 1`).
 *
 * `dias` são dias gestacionais (`D = semana * 7 + diaDaSemana`) já concluídos,
 * em qualquer ordem e com repetições — é um blob sincronizado entre aparelhos,
 * e vem como veio.
 */
export function sequenciaDeDias(dias: readonly number[], hoje: number): number {
  return trechoDaSequencia(dias, hoje).dias;
}

/**
 * Quantos dias ela AINDA pode perder sem apagar a chama.
 *
 * ⚠️ Existe para a `FolhaDaChama` não ter uma segunda régua. A tela mostrava
 * `Math.floor(streak / 7)` — o saldo TOTAL, ignorando o que já foi gasto — e
 * prometia folga que a conta não daria. Aqui sai da mesma varredura que conta
 * a sequência, então os dois números nunca podem discordar.
 */
export function perdoesRestantes(dias: readonly number[], hoje: number): number {
  const t = trechoDaSequencia(dias, hoje);
  return Math.max(0, t.saldo - t.perdoesUsados);
}

/**
 * OS DIAS EM QUE ELA FEZ ALGUMA COISA — e por que não são os dias "completos".
 *
 * A chama contava `doneDays`: dias com os CINCO momentos fechados. O dono fez
 * um exercício, a chama não acendeu, e ele estava certo em estranhar — um dia
 * em que ela abriu o app e cuidou de si é um dia em que ela veio, e a sequência
 * mede exatamente isso. Exigir os cinco transforma o gancho em cobrança: quem
 * fez três de cinco fica com o mesmo zero de quem não abriu.
 *
 * ─── POR QUE NÃO BASTOU MUDAR `doneDays` ────────────────────────────────────
 *
 * Porque `doneDays` não é da chama: ele pinta o nó da trilha como concluído,
 * solta a figurinha da semana e alimenta o total da jornada. Marcar o dia como
 * feito por causa de um exercício daria estrela e figurinha por um quinto do
 * trabalho — e aí o placar de cinco pontinhos passaria a mentir.
 *
 * Então são duas perguntas com duas fontes: `doneDays` responde "fechou o dia?"
 * e esta função responde "ela veio hoje?".
 *
 * ─── LÊ O QUE JÁ ESTÁ GRAVADO, EM VEZ DE UMA LISTA NOVA ─────────────────────
 *
 * Cada dia já guarda o seu estado em `dc-path-day-<D>`. Derivar daí sai de
 * graça e, o que importa mais, sai RETROATIVO: o dia que a paciente fez antes
 * desta mudança conta na mesma hora. Uma lista nova começaria vazia e apagaria
 * a sequência de todo mundo no dia do deploy.
 *
 * Recebe as entradas em vez de ler `localStorage` aqui dentro para poder ser
 * testada — quem varre o armazenamento é o componente.
 */
export function diasComAlgumMomento(
  entradas: Iterable<readonly [string, string | null]>,
  prefixo: string,
): number[] {
  const dias: number[] = [];
  for (const [chave, bruto] of entradas) {
    if (!chave.startsWith(prefixo)) continue;
    /* O resto da chave tem de ser SÓ dígitos. `dc-path-day-` é prefixo de
       `dc-path-day-12`, mas também casaria com uma chave futura como
       `dc-path-day-notas` — que viraria `NaN` e, sem esta guarda, um dia. */
    const resto = chave.slice(prefixo.length);
    if (!/^\d+$/.test(resto)) continue;
    try {
      const v = JSON.parse(bruto ?? "null");
      if (v && typeof v === "object" && Object.values(v).some(Boolean)) dias.push(Number(resto));
    } catch {
      /* chave corrompida: não conta como dia, e não derruba a contagem */
    }
  }
  return dias;
}

/**
 * A MESMA CONTAGEM, sobre datas do calendário.
 *
 * O registro da meditação guarda `"2026-08-11"` em vez de dia gestacional —
 * ela acontece fora da trilha e não tem número de jornada. Era a TERCEIRA
 * cópia deste laço no mesmo arquivo, com o mesmo perdão da meia-noite escrito
 * de novo à mão, e é a que mais sofreria se alguém consertasse só as outras
 * duas: a paciente vê a sequência da meditação na tela de fim de sessão, logo
 * depois de meditar, que é o pior momento para um número errado.
 *
 * Converte para dias inteiros desde a época e reusa a régua acima. A conversão
 * é feita em UTC a partir de ano/mês/dia LOCAIS de propósito: quem escreve o
 * registro (`diaISO`) usa o dia local, e passar a string por `new Date(...)`
 * cru a leria como UTC — em São Paulo, tudo antes das 21h viraria o dia
 * anterior, e a sequência quebraria sozinha todo fim de tarde.
 */
export function numeroDoDia(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
}

export function sequenciaDeDatas(dias: readonly string[], hoje: Date = new Date()): number {
  const numeros: number[] = [];
  for (const s of dias) {
    const n = numeroDoDia(s);
    if (n !== null) numeros.push(n);
  }
  const hojeN = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 86400000;
  return sequenciaDeDias(numeros, hojeN);
}

/**
 * A MESMA sequência, para quem sabe o dia mas NÃO tem o relógio dela.
 *
 * O cron do lembrete roda em UTC e precisa da sequência no calendário DA
 * PACIENTE: `sequenciaDeDatas` leria `getFullYear()` do servidor e mandaria
 * "3 dias seguidos" para quem está em 4. Aqui o dia de hoje chega pronto, já
 * calculado com o deslocamento dela (`diaDela`, em `lembrete-de-meditacao.ts`).
 * A régua da sequência continua sendo uma só — é a mesma `sequenciaDeDias`.
 */
export function sequenciaAteODia(dias: readonly string[], hojeIso: string): number {
  const hojeN = numeroDoDia(hojeIso);
  if (hojeN === null) return 0;
  const numeros: number[] = [];
  for (const s of dias) {
    const n = numeroDoDia(s);
    if (n !== null) numeros.push(n);
  }
  return sequenciaDeDias(numeros, hojeN);
}

/**
 * A sequência está VIVA? É isto que acende a chama.
 *
 * Uma função e não `> 0` espalhado pela tela: hoje as duas coisas coincidem,
 * mas "acender o fogo" e "ter algum dia feito" são perguntas diferentes, e a
 * primeira é a que a tela faz. No dia em que a chama passar a exigir três dias,
 * ou a apagar depois de um lapso, muda aqui — e muda nos dois lugares que a
 * desenham.
 */
export function sequenciaAcesa(sequencia: number): boolean {
  return sequencia > 0;
}
