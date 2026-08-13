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
 * Quantos dias seguidos, terminando em `hoje` (ou em `hoje - 1`).
 *
 * `dias` são dias gestacionais (`D = semana * 7 + diaDaSemana`) já concluídos,
 * em qualquer ordem e com repetições — é um blob sincronizado entre aparelhos,
 * e vem como veio.
 */
export function sequenciaDeDias(dias: readonly number[], hoje: number): number {
  if (dias.length === 0) return 0;
  const feitos = new Set(dias);

  /* Começa em hoje se hoje já está fechado; senão em ontem. Nunca antes: um dia
     em branco no meio quebra a sequência, que é o que a torna uma sequência. */
  let d = feitos.has(hoje) ? hoje : hoje - 1;
  let n = 0;
  /* Teto de segurança. `dias` vem de armazenamento local que já chegou
     corrompido nesta base; sem o limite, um blob com números negativos gira
     para sempre e trava a aba em vez de mostrar um número errado. */
  const teto = feitos.size;
  while (feitos.has(d) && n < teto) {
    n++;
    d--;
  }
  return n;
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
