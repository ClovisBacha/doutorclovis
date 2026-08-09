/**
 * QUEM PAROU DE REGISTRAR — e quando isso merece um telefonema.
 *
 * ─── A DECISÃO QUE ESTE ARQUIVO RESPEITA ────────────────────────────────────
 *
 * `sinais-clinicos.ts` declara, no cabeçalho: "silêncio NÃO é sinal clínico, é
 * sinal de engajamento. Uma paciente pode estar ótima e sem paciência para o
 * app. Por isso o texto fala em 'sem registro' e não em 'sem acompanhamento'."
 *
 * Isso continua valendo, e é por isso que esta régua mora AQUI e não lá: ela
 * não classifica gravidade clínica. Ela responde uma pergunta operacional —
 * "de quem eu deveria ter notícia a esta altura e não tenho?" — e o texto que
 * ela produz nunca afirma nada sobre a saúde da paciente.
 *
 * ─── POR QUE ISSO AINDA IMPORTA ─────────────────────────────────────────────
 *
 * A aba Engajamento já sabe quem está inativa. Mas ela vive longe da fila de
 * trabalho, não cruza com idade gestacional, e ninguém abre uma aba de métrica
 * no meio do dia. Uma gestante de 37 semanas sem notícia há dez dias é uma
 * ligação, e a ligação não acontece porque o número está numa tela que ele não
 * abre.
 *
 * ─── O PRAZO DEPENDE DE QUÃO PERTO ELA ESTÁ ─────────────────────────────────
 *
 * Três semanas de silêncio em 12 semanas de gestação é normal. As mesmas três
 * semanas em 38 é outra conversa. O corte acompanha a idade gestacional, e não
 * um número único que seria frouxo no fim e chato no começo.
 */

export type PacienteQuieta = {
  id: string;
  nome: string | null;
  /** Semanas de gestação, quando conhecidas. */
  semanas: number | null;
  /** Último registro dela no app. `null` = nunca registrou. */
  ultimoEm: string | null;
  /** Quando a conta dela nasceu. */
  criadaEm: string | null;
};

export type Quietude = {
  paciente: PacienteQuieta;
  dias: number;
  /** O prazo que ela ultrapassou. Vai para o texto. */
  prazo: number;
};

/**
 * Quantos dias de silêncio ainda são normais, na semana em que ela está.
 *
 * Números escolhidos para ficarem do lado do "não incomodar" no começo: no
 * primeiro e segundo trimestres a gestação é longa e o app não precisa de uso
 * diário. Perto do fim, e no pós-parto imediato, a coisa muda.
 *
 * ⚠️ Clóvis: são estes três números. Estão num lugar só, e é aqui que mudam.
 */
export function prazoDeSilencio(semanas: number | null): number {
  if (semanas == null) return 21;
  if (semanas >= 36) return 7;
  if (semanas >= 28) return 12;
  return 21;
}

/**
 * Quantos dias inteiros entre dois instantes. `null` quando não dá para saber.
 */
function diasEntre(de: string | null, ate: Date): number | null {
  if (!de) return null;
  const t = new Date(de).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((ate.getTime() - t) / 86400_000);
}

/**
 * Quem está quieta além do prazo dela.
 *
 * ─── QUEM NÃO ENTRA, E POR QUÊ ──────────────────────────────────────────────
 *
 * **Quem acabou de se cadastrar.** "Nenhum registro na janela" era
 * indistinguível entre a paciente que sumiu e a que criou a conta ontem — um
 * defeito que a aba de Engajamento já teve, e que colocava a recém-chegada na
 * lista de sumidas no dia seguinte ao cadastro. Sem `criadaEm`, ela não entra:
 * na dúvida, não incomoda.
 *
 * **Quem nunca registrou nada, mas se cadastrou há pouco.** O prazo conta a
 * partir do cadastro nesse caso — é o tempo que ela teve para usar o app.
 */
export function quemEstaQuieta(pacientes: PacienteQuieta[], agora = new Date()): Quietude[] {
  const saida: Quietude[] = [];
  for (const p of pacientes) {
    const prazo = prazoDeSilencio(p.semanas);
    /* Sem registro nenhum, o relógio corre do CADASTRO. Sem cadastro também,
       não há de onde contar — e inventar "hoje" faria toda paciente antiga
       aparecer como quieta no dia em que este código subisse. */
    const desde = p.ultimoEm ?? p.criadaEm;
    const dias = diasEntre(desde, agora);
    if (dias === null) continue;
    /* Data no futuro (fuso invertido em algum lugar) daria negativo. */
    if (dias < 0) continue;
    if (dias < prazo) continue;
    saida.push({ paciente: p, dias, prazo });
  }
  /* Mais quieta primeiro — e, no empate, quem está mais perto do fim. */
  return saida.sort((a, b) => {
    const porFolga = b.dias - b.prazo - (a.dias - a.prazo);
    if (porFolga !== 0) return porFolga;
    return (b.paciente.semanas ?? 0) - (a.paciente.semanas ?? 0);
  });
}

/**
 * O texto do item na fila.
 *
 * Fala em REGISTRO, nunca em acompanhamento ou em saúde: ela pode estar ótima e
 * sem paciência para o app, e um item que sugere o contrário faria o médico
 * ligar com a pergunta errada.
 */
export function textoDaQuietude(q: Quietude): { titulo: string; detalhe: string } {
  const nome = (q.paciente.nome ?? "").trim() || "Paciente";
  const semana = q.paciente.semanas != null ? `${q.paciente.semanas} semanas · ` : "";
  return {
    titulo: `${nome} sem registro há ${q.dias} dias`,
    detalhe: `${semana}o esperado nesta fase é ter notícia a cada ${q.prazo} dias. Ela pode estar bem e sem usar o app — vale um recado.`,
  };
}
