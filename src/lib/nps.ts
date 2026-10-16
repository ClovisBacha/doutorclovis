/**
 * QUANDO PERGUNTAR "DE 0 A 10" — e quando calar.
 *
 * ⚠️ **O NPS INTEIRO NÃO TINHA COMO RECEBER UMA RESPOSTA.** `shouldAskNps` e
 * `submitNps` estavam escritas e testadas, `getNpsReport` tinha tela no admin —
 * e nenhuma das duas primeiras tinha chamador no app. O dono abria o relatório
 * e via zero para sempre, sem nada quebrado a que apontar.
 *
 * Esta régua é pura porque as decisões que importam aqui não são de servidor:
 * são sobre QUANDO é decente perguntar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **NUNCA EM MODO CUIDADO.** Perguntar "o quanto você recomendaria este app"
 * a quem acabou de perder a gestação é indefensável, e é o tipo de coisa que
 * uma pessoa conta para outras dez. O portão é o primeiro da função.
 *
 * ⚠️ **NUNCA DEPOIS DE UM MOMENTO BONITO.** A tentação óbvia é perguntar logo
 * após uma conquista, porque a nota sobe — e é exatamente por isso que não se
 * faz: **NPS é instrumento de medida**, e uma medida enviesada para cima é pior
 * que medida nenhuma, porque o dono toma decisão com ela achando que é real.
 * Por isso o cartão mora numa tela calma que ela ESCOLHEU abrir.
 *
 * ⚠️ **NUNCA NA PRIMEIRA SEMANA.** Perguntar no dia 1 é perguntar sobre nada: a
 * resposta mede a expectativa dela, não o produto. O servidor só oferecia o
 * corte de 90 dias desde a última resposta — quem criava a conta era perguntada
 * na primeira abertura.
 */

/** Dias de conta antes da primeira pergunta. */
export const DIAS_MINIMOS_DE_CONTA = 14;

/** Quanto tempo o "agora não" vale. */
export const DIAS_DE_ADIAMENTO = 90;

const DIA_MS = 24 * 60 * 60 * 1000;

export type EntradaDoNps = {
  /** O servidor já disse que não há resposta nos últimos 90 dias. */
  perguntar: boolean;
  /** ⚠️ `undefined` = ainda não sei. Ver abaixo. */
  careMode: boolean | undefined;
  /** ISO do "agora não" mais recente, ou `null`. */
  dispensadoEm: string | null;
  agora: Date;
};

/**
 * ⚠️ **"NÃO SEI" CALA.** Com `careMode` indefinido — o perfil ainda não chegou —
 * a resposta é `false`. O pior caso de calar é uma pesquisa que não aconteceu;
 * o de perguntar é a pergunta chegar a quem está de luto. Falha fechada, como
 * o resto do app.
 */
export function podeMostrarNps(e: EntradaDoNps): boolean {
  if (e.careMode !== false) return false;
  if (!e.perguntar) return false;
  if (!e.dispensadoEm) return true;
  const quando = new Date(e.dispensadoEm).getTime();
  /* Carimbo ilegível vale como "dispensado agora": o pior caso é ela não ser
     perguntada por um trimestre, e não o contrário. */
  if (Number.isNaN(quando)) return false;
  /* ⚠️ **Carimbo no FUTURO cala pela própria SUBTRAÇÃO, e não por uma guarda.**
     Um relógio adiantado deixa `agora - quando` negativo, e negativo nunca
     alcança o limiar. Eu tinha escrito um `if (quando > agora) return false`
     aqui com um comentário afirmando que ele protegia isso — e a mutação
     provou que ele não mudava resposta nenhuma: código morto com uma promessa
     em cima, que é armadilha para quem ler depois.

     O que NÃO pode entrar é um `Math.abs` — com ele, um carimbo cem dias no
     futuro passaria a liberar a pergunta. Há teste com esse caso exato. */
  return e.agora.getTime() - quando >= DIAS_DE_ADIAMENTO * DIA_MS;
}

/** A conta é nova demais para opinar? */
export function contaNovaDemais(criadaEm: string | null | undefined, agora: Date): boolean {
  if (!criadaEm) return true; // não sei há quanto tempo ela usa → não pergunto
  const q = new Date(criadaEm).getTime();
  if (Number.isNaN(q)) return true;
  return agora.getTime() - q < DIAS_MINIMOS_DE_CONTA * DIA_MS;
}

export type Classe = "promotora" | "neutra" | "detratora";

/** A régua canônica do NPS — a MESMA que `getNpsReport` usa para agregar. */
export function classificar(nota: number): Classe {
  if (nota >= 9) return "promotora";
  if (nota >= 7) return "neutra";
  return "detratora";
}

/**
 * ⚠️ **O AGRADECIMENTO NÃO MUDA COM A NOTA — e isso é decisão.** A tentação é
 * responder à detratora com "o que podemos melhorar?" e à promotora com "avalie
 * na loja". A segunda metade é o *review gating* que a App Store proíbe pela
 * diretriz 1.1.7, e a primeira ensina que a nota que ela deu mudou o tratamento
 * que ela recebe. Uma frase só, para todo mundo.
 */
export const AGRADECIMENTO = "Obrigado 💛 A sua resposta ajuda a melhorar o app.";

export const PERGUNTA = "De 0 a 10, o quanto você recomendaria este app a uma amiga grávida?";
