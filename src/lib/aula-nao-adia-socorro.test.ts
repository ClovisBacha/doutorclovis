/**
 * A AULA DIÁRIA MANDAVA A GESTANTE ESPERAR — e mandava nas semanas em que
 * esperar custa mais caro.
 *
 * ⚠️ Quatro dias da trilha (189, 206, 255 e 276 — semanas 27, 29, 36 e 39)
 * ensinavam o mesmo passo a passo: "percebeu os movimentos diminuídos? coma
 * algo, beba algo gelado, deite de lado e observe; SE AINDA ASSIM estiverem
 * reduzidos, procure no mesmo dia". A frase parece cuidadosa e é o contrário:
 * ela põe um degrau de espera entre a paciente perceber a mudança e ela pedir
 * ajuda, exatamente na janela de maior risco de natimortalidade.
 *
 * ⚠️ E a diretriz é explícita sobre ESTE passo, não sobre a contagem em geral:
 * PSANZ/Stillbirth CRE, Rec. 2 — "presentation should not be delayed through
 * efforts to stimulate the baby with food or drink". O Count the Kicks, que é
 * o app de referência do gênero, RETIROU essa orientação do próprio material
 * pelo mesmo motivo. E uma análise de conteúdo de apps de movimentação achou
 * que um quarto deles ATRASA o atendimento — quase sempre por esta frase.
 *
 * ⚠️ O app já dizia a coisa certa no dia 290 ("não espere amanhecer nem tente
 * truques em casa para o bebê acordar"): a régua existia e valia num dia só.
 *
 * ─── O QUE ESTA CATRACA OLHA, E O QUE ELA DELIBERADAMENTE NÃO OLHA ──────────
 *
 * ⚠️ Ela lê SÓ o que a aula apresenta como CERTO — o texto, a curiosidade, a
 * explicação e as alternativas marcadas no gabarito. O distrator errado PODE e
 * DEVE dizer "tomar algo gelado e esperar": é justamente assim que a aula
 * ensina que aquilo não se faz. Uma varredura sobre o arquivo inteiro
 * reprovaria a aula consertada — é a armadilha de casar texto que este
 * repositório já pagou dez vezes, nas duas direções.
 */
import { describe, expect, test } from "bun:test";
import QUIZZES from "@/lib/daily-quizzes.data.json";

/* ⚠️ `as Record<string, Dia>` direto NÃO passa no tsc: o tipo inferido do JSON
   é uma união de 294 formas literais, e ele recusa a conversão como "provável
   engano". A ponte é `unknown`. */
const AULAS = QUIZZES as unknown as Record<string, Dia>;

type Pergunta = { type?: string; q: string; o: string[]; a: number | number[]; why?: string };
type Dia = { teach?: string; funFact?: string; questions?: Pergunta[] };

/** O passo de estimular: VERBO no imperativo/infinitivo mais o que se ingere. */
const MANDA_ESTIMULAR =
  /\b(coma|comer|beba|beber|tome|tomar|ingira|ingerir)\b[^.;!?]{0,40}\b(algo|alguma coisa|l[íi]quido|suco|doce|gelad\w*)\b/i;

const FALA_DE_MOVIMENTO = /\b(movimento\w*|mexe\w*|mexer|chute\w*)\b/i;

/**
 * O que a aula AFIRMA: prosa, explicação e as alternativas do gabarito.
 *
 * ⚠️ Cada afirmação viaja com o CONTEXTO dela — o enunciado da pergunta —, e
 * não sozinha. A explicação que estava no ar ("Comer, deitar-se com atenção e
 * algo gelado costumam despertar o bebê") não contém a palavra "movimento": só
 * o enunciado logo acima continha. Casando frase a frase, a varredura passava
 * verde exatamente sobre a frase que ela existe para pegar.
 */
function afirmacoes(dia: Dia): { texto: string; contexto: string }[] {
  const fora: { texto: string; contexto: string }[] = [];
  if (dia.teach) fora.push({ texto: dia.teach, contexto: dia.teach });
  if (dia.funFact) fora.push({ texto: dia.funFact, contexto: dia.funFact });
  for (const q of dia.questions ?? []) {
    if (q.why) fora.push({ texto: q.why, contexto: `${q.q} ${q.why}` });
    const certas = Array.isArray(q.a) ? q.a : [q.a];
    for (const i of certas) if (q.o[i]) fora.push({ texto: q.o[i], contexto: `${q.q} ${q.o[i]}` });
  }
  return fora;
}

describe("⚠️ nenhuma aula manda estimular o bebê antes de procurar ajuda", () => {
  test("as 294 aulas", () => {
    const culpados: string[] = [];
    for (const [dia, conteudo] of Object.entries(AULAS)) {
      for (const { texto, contexto } of afirmacoes(conteudo)) {
        if (FALA_DE_MOVIMENTO.test(contexto) && MANDA_ESTIMULAR.test(texto)) {
          culpados.push(`dia ${dia}: ${texto.slice(0, 120)}`);
        }
      }
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e a varredura MORDE — as quatro frases que estavam no ar reprovam", () => {
    /* Contraprova: catraca que passa em vazio é catraca que mente. Estas são
       as frases literais que a trilha servia até set/2026. */
    const eram: { texto: string; contexto: string }[] = [
      {
        texto:
          "Se você perceber uma diminuição clara, deite de lado, beba algo gelado e preste atenção nos movimentos",
        contexto: "",
      },
      {
        texto:
          "Se os movimentos diminuírem de forma clara, tome um líquido gelado, deite de lado e observe",
        contexto: "",
      },
      {
        texto:
          "Se notar uma diminuição clara, coma algo, deite de lado e preste atenção nos movimentos",
        contexto: "",
      },
      {
        /* ⚠️ Esta é a que só o CONTEXTO pega: a explicação não diz "movimento",
           quem dizia era o enunciado. */
        texto: "Comer, deitar-se com atenção e algo gelado costumam despertar o bebê",
        contexto: "O que pode ajudar a estimular e sentir os movimentos do bebê?",
      },
    ];
    for (const { texto, contexto } of eram) {
      const ctx = `${contexto} ${texto}`;
      expect(FALA_DE_MOVIMENTO.test(ctx) && MANDA_ESTIMULAR.test(texto)).toBe(true);
    }
  });

  test("⚠️ e ela NÃO morde o texto que NEGA o passo — nem o distrator errado", () => {
    /* O dia 290 já dizia o certo antes desta rodada, e o distrator do 276
       existe para ser marcado como errado. Reprovar os dois seria trocar um
       defeito por outro. */
    const certos = [
      "não espere amanhecer nem tente truques em casa para o bebê acordar",
      "não tente antes 'acordar' o bebê com comida ou bebida gelada, porque isso só adia a avaliação",
      "sem tentar antes 'acordá-lo' com algo gelado ou doce, porque isso só atrasa a avaliação",
      "Tentar 'acordar' o bebê com algo gelado só adia a avaliação",
    ];
    for (const frase of certos) {
      expect(MANDA_ESTIMULAR.test(frase)).toBe(false);
    }
  });
});

describe("⚠️ e o piso de segurança continua sendo um gatilho de LIGAR", () => {
  test("o dia que ensina o 10 em 2 horas manda procurar, e não recontar", () => {
    const d189 = AULAS["189"];
    expect(d189.teach).toContain("2 horas sem 10 movimentos");
    expect(d189.teach).toMatch(/ligue para o seu m[ée]dico|procure a maternidade/i);
    /* ⚠️ E a alternativa CERTA da pergunta do piso é a de procurar. */
    const q = (d189.questions ?? []).find((x) => /2 horas/.test(x.q));
    /* ⚠️ `toBeDefined` é proibido neste repo: ele não é tipado no `bun:test` e
       reprova o tsc da CI com o portão local verde. */
    expect(q == null).toBe(false);
    const certa = q!.o[Array.isArray(q!.a) ? q!.a[0] : q!.a];
    expect(certa).toMatch(/ligar|procurar a maternidade/i);
  });
});
