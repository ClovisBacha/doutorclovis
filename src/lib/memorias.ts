/**
 * AS MEMÓRIAS — "há um ano você publicou isto".
 *
 * ⚠️ **ESTE É O RECURSO MAIS PERIGOSO DA ABA, e a razão não é privacidade.**
 *
 * Num app comum, uma memória é um agrado. Aqui ela pode devolver à paciente a
 * foto da barriga de uma gestação QUE TERMINOU — sem ela pedir, na abertura do
 * app, num dia qualquer. Nenhum outro recurso desta aba consegue causar esse
 * dano com um acerto de calendário.
 *
 * As CINCO travas abaixo existem por isso, e nenhuma é enfeite. Se alguma
 * delas não puder ser garantida, o recurso não deve existir.
 */

/** Quantos dias de tolerância em volta do aniversário da publicação. */
export const JANELA_DIAS = 3;

/** Abaixo disto não é memória, é o feed de ontem. */
export const IDADE_MINIMA_DIAS = 300;

export type CandidataAMemoria = {
  id: string;
  /** ISO. */
  criadoEm: string;
  /**
   * O ciclo gestacional em que a publicação nasceu.
   *
   * ⚠️ `null` = publicação anterior a esta coluna existir. A régua trata como
   * "não sei" e NÃO mostra — errar para o lado de não lembrar.
   */
  ciclo: string | null;
  /** Já mostrei esta a ela? */
  vista: boolean;
  /** Arquivada pela autora depois de publicar. */
  arquivada: boolean;
};

/**
 * Escolhe a memória do dia, ou `null`.
 *
 * ⚠️ **TRAVA 1 — NUNCA EM MODO CUIDADO.** Quem perdeu a gestação não abre o app
 * para reencontrar a foto da barriga. Este é o portão mais importante, e ele
 * fecha na primeira linha.
 *
 * ⚠️ **TRAVA 2 — SÓ DO CICLO ATUAL.** É ela que impede o pior caso: uma
 * publicação de uma gestação anterior voltando como se fosse a de agora. Sem
 * `cicloAtual` conhecido, ou com a publicação sem ciclo, a resposta é `null`.
 *
 * ⚠️ **TRAVA 3 — O QUE ELA ARQUIVOU NÃO VOLTA.** Arquivar é o gesto de tirar
 * algo do ar; devolvê-lo como memória seria desfazer a decisão dela.
 *
 * ⚠️ **TRAVA 4 — UMA VEZ SÓ.** `vista` impede a mesma memória de voltar todo
 * dia da janela e virar cobrança.
 *
 * ⚠️ **TRAVA 5 — SÓ PARA QUEM REGISTROU O NASCIMENTO.**
 *
 * As quatro primeiras não fecham o pior caso, e isto foi achado relendo a
 * promessa deste arquivo. **Modo Cuidado é OPT-IN.** Uma mulher que perdeu a
 * gestação e não contou ao app fica com o `lmp_date` intacto: o ciclo continua
 * o mesmo, a Trava 2 não morde, e ~300 dias depois ela receberia
 * "Há um ano, você publicou isto" com a foto da barriga. **Nenhum outro recurso
 * desta aba causa esse dano com um acerto de calendário** — é a frase que abre
 * este arquivo, e ela obriga a fechar isto.
 *
 * O conserto não é esperar que ela ligue o Modo Cuidado: é exigir um sinal
 * POSITIVO de que a gestação terminou em nascimento. `birth_date` é isso, e é
 * escrito à mão por ela no Perfil.
 *
 * ⚠️ E ele não estreita o recurso: uma memória precisa de 300 dias, e uma
 * gestação dura ~280 — então a única pessoa que já pode ter memória do ciclo
 * ATUAL é justamente quem já pariu. A trava torna explícito o que a aritmética
 * já dizia, e fecha o caso em que a aritmética se enganava.
 *
 * ⚠️ E **UMA POR DIA**, a mais antiga entre as elegíveis: duas memórias na
 * mesma abertura transformam o feed num álbum, e o feed é do presente.
 */
export function memoriaDeHoje(entrada: {
  posts: readonly CandidataAMemoria[];
  cicloAtual: string | null;
  careMode: boolean | undefined;
  /**
   * A data de nascimento registrada por ela, ou `null`.
   *
   * ⚠️ É o sinal POSITIVO da Trava 5 — nunca a ausência de Modo Cuidado.
   */
  nascimento: string | null;
  agora: Date;
}): CandidataAMemoria | null {
  /* TRAVA 1. `!== false` e não `=== true`: enquanto o perfil não chegou, o
     valor é `undefined` — e "não sei" tem de significar NÃO MOSTRAR. */
  if (entrada.careMode !== false) return null;
  /* TRAVA 5. Sem o registro do nascimento, nenhuma memória — ver acima. */
  if (!entrada.nascimento) return null;
  /* TRAVA 2, primeira metade: sem ciclo atual não há como comparar. */
  if (!entrada.cicloAtual) return null;

  const hoje = entrada.agora.getTime();
  const elegiveis = entrada.posts.filter((p) => {
    if (p.vista) return false; /* TRAVA 4 */
    if (p.arquivada) return false; /* TRAVA 3 */
    if (p.ciclo !== entrada.cicloAtual) return false; /* TRAVA 2 */
    const nascida = Date.parse(p.criadoEm);
    if (!Number.isFinite(nascida)) return false;
    const dias = (hoje - nascida) / 86_400_000;
    if (dias < IDADE_MINIMA_DIAS) return false;
    /* A distância até o aniversário mais próximo, em dias. */
    const desvio = Math.abs((dias % 365.25) - 0);
    const perto = Math.min(desvio, 365.25 - desvio);
    return perto <= JANELA_DIAS;
  });

  if (elegiveis.length === 0) return null;
  /* A mais antiga primeiro: é a que tem mais chance de sumir da janela. */
  return [...elegiveis].sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm))[0]!;
}

/**
 * O texto do cartão.
 *
 * ⚠️ **NÃO COBRA E NÃO COMEMORA.** "Que ano incrível!" cai numa mulher que
 * pode ter passado o ano no hospital. O cartão diz o FATO e para aí — a mesma
 * régua da pausa gentil das Amigas.
 */
export function textoDaMemoria(anos: number): string {
  if (anos <= 1) return "Há um ano, você publicou isto.";
  return `Há ${anos} anos, você publicou isto.`;
}
