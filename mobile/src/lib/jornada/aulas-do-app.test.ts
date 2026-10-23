import { describe, expect, test } from "bun:test";
import SITE_BRUTO from "@/lib/daily-quizzes.data.json";
import type { DailyQuiz, QuizQuestion } from "@/lib/daily-quizzes";
import { carregarAulaDoDia, DIAS_COM_AULA_DO_APP } from "~/lib/jornada/aulas-do-app";
import T1 from "~/lib/jornada/aulas-do-app.t1.json";
import T2 from "~/lib/jornada/aulas-do-app.t2.json";

/**
 * O BANCO DE AULAS DO APP (fase 2: o app não é conselho médico).
 *
 * A catraca cobra, dia a dia: o mesmo número de perguntas do site (o servidor
 * paga por acerto até ele), o formato que a tela entende, nenhuma palavra de
 * conduta clínica — nem nas aulas do site que FICARAM no trimestre já trocado —
 * e nenhum enunciado repetido a menos de 14 dias, no banco que ela vê de fato
 * (o do app por cima do do site).
 */

const SITE = SITE_BRUTO as unknown as Record<string, DailyQuiz>;
const APP = { ...T1, ...T2 } as unknown as Record<string, DailyQuiz>;

/**
 * Os trimestres já trocados: neles, o banco inteiro (app + o que ficou do site)
 * é cobrado. Entra aqui o trimestre cujas aulas chegaram ao banco do app.
 */
const TROCADOS: readonly [number, number][] = [[7, 97]];

const PROIBIDAS =
  /\b(m[eé]dic[oa]s?|rem[eé]dios?|suplement\w*|[aá]cido f[oó]lico|vitaminas?|vacinas?|exames?|ultrass\w*|consultas?|consultar|aborto|abortamento|riscos?|sangr\w*|enj[oô]o\w*|n[aá]usea\w*|azia|dietas?|[aá]lcool|cigarros?|fumar|cafe[ií]na|doen[cç]as?|infec[cç]\w*|pr[eé]-ecl[aâ]mpsia|diabetes|glicemia|press[aã]o arterial|press[aã]o alta|sintomas?|viabilidade|malforma\w*|hormon\w*|progesterona|hcg|beta-?hcg)\b/i;

const textoDa = (a: DailyQuiz) =>
  [a.teach, a.funFact ?? "", ...a.questions.flatMap((q) => [q.q, ...q.o, q.why])].join(" \n ");

const efetiva = (D: number): DailyQuiz | undefined => APP[String(D)] ?? SITE[String(D)];

function errosDeFormato(D: number, a: DailyQuiz): string[] {
  const e: string[] = [];
  if (a.teach.length < 300 || a.teach.length > 950) e.push(`teach com ${a.teach.length}`);
  const f = a.funFact ?? "";
  if (f.length < 20 || f.length > 260) e.push(`funFact com ${f.length}`);
  if (!a.questions.some((q) => q.type === "multi")) e.push("sem multi");
  a.questions.forEach((q: QuizQuestion, i) => {
    const n = `pergunta ${i + 1}`;
    if (!q.q.trim() || !q.why.trim()) e.push(`${n} vazia`);
    if (q.type === "choice") {
      if (q.o.length < 2 || q.o.length > 4) e.push(`${n} choice com ${q.o.length} opções`);
      if (!Number.isInteger(q.a) || (q.a as number) < 0 || (q.a as number) >= q.o.length)
        e.push(`${n} gabarito inválido`);
    } else if (q.type === "multi") {
      const g = Array.isArray(q.a) ? q.a : [];
      if (q.o.length < 3 || q.o.length > 5) e.push(`${n} multi com ${q.o.length} opções`);
      if (g.length < 2 || g.length >= q.o.length) e.push(`${n} multi com ${g.length} corretas`);
      if (
        !g.every(
          (x, k) => Number.isInteger(x) && x >= 0 && x < q.o.length && (k === 0 || x > g[k - 1]!),
        )
      )
        e.push(`${n} gabarito multi fora de ordem ou fora da faixa`);
    } else e.push(`${n} sem type`);
    if (new Set(q.o.map((x) => x.trim().toLowerCase())).size !== q.o.length)
      e.push(`${n} opção repetida`);
  });
  return e.map((x) => `D${D}: ${x}`);
}

describe("o banco de aulas do app", () => {
  test("toda aula do app está na faixa do site e tem o MESMO número de perguntas (o servidor paga por acerto até ele)", () => {
    expect(DIAS_COM_AULA_DO_APP.length).toBe(Object.keys(APP).length);
    for (const D of DIAS_COM_AULA_DO_APP) {
      expect(D).toBeGreaterThanOrEqual(7);
      expect(D).toBeLessThanOrEqual(300);
      expect(APP[String(D)]!.questions.length).toBe(SITE[String(D)]!.questions.length);
    }
  });

  test("o formato que a tela entende: choice com um gabarito, 'marque todas' com 2+ corretas e nunca todas", () => {
    const erros = DIAS_COM_AULA_DO_APP.flatMap((D) => errosDeFormato(D, APP[String(D)]!));
    expect(erros).toEqual([]);
  });

  test("nos trimestres trocados, nenhuma aula que ela vê fala de conduta clínica — nem as que ficaram do site", () => {
    const comPalavra: string[] = [];
    for (const [de, ate] of TROCADOS)
      for (let D = de; D <= ate; D++) {
        const m = textoDa(efetiva(D)!).match(new RegExp(PROIBIDAS.source, "gi"));
        if (m)
          comPalavra.push(`D${D}${APP[String(D)] ? "" : " (site)"}: ${[...new Set(m)].join(", ")}`);
      }
    expect(comPalavra).toEqual([]);
  });

  test("nunca 'ele' ou 'ela' para o bebê nas aulas do app", () => {
    /* "quando ELA ainda é um bebê na barriga da própria mãe" fala da mulher, e
       não do bebê: por isso o "ainda" não entra na lista de verbos. */
    const achou = DIAS_COM_AULA_DO_APP.filter((D) =>
      /\bo bebê\b[^.!?]{0,60}\b(ele|ela)\b|\b(ele|ela) (já|vai|está|começa|consegue|ouve|sente|mexe)\b/i.test(
        textoDa(APP[String(D)]!),
      ),
    );
    expect(achou).toEqual([]);
  });

  test("nenhum enunciado se repete a menos de 14 dias, no banco que ela vê", () => {
    const repetidos: string[] = [];
    const visto = new Map<string, number>();
    for (let D = 7; D <= 300; D++) {
      for (const q of efetiva(D)?.questions ?? []) {
        const chave = q.q.trim().toLowerCase().replace(/\s+/g, " ");
        const antes = visto.get(chave);
        if (antes != null && D - antes < 14) repetidos.push(`D${antes} e D${D}: ${q.q}`);
        visto.set(chave, D);
      }
    }
    expect(repetidos).toEqual([]);
  });

  test("o carregador dá a aula do app no dia trocado e a do site no resto", async () => {
    const D = DIAS_COM_AULA_DO_APP[0];
    if (D != null) expect((await carregarAulaDoDia(D))?.teach).toBe(APP[String(D)]!.teach);
    expect((await carregarAulaDoDia(200))?.teach).toBe(SITE["200"]!.teach);
    expect(await carregarAulaDoDia(301)).toBeNull();
  });
});
