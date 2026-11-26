import { describe, expect, test } from "bun:test";
import { festaDaBolha } from "~/lib/bolha/festa";
import type { Marco } from "~/lib/jornada/marcos";

/** O que a Bolha NUNCA diz: conduta, clínica, promessa de efeito (a régua de `conversa.test.ts`). */
const CONDUTA =
  /\b(m[eé]dic[oa]s?|consultas?|exames?|rem[eé]dios?|medica\w*|suplement\w*|vitaminas?|dieta|sintomas?|dores?|sangr\w*|contra[cç][aã]o|contra[cç][oõ]es|press[aã]o|glicemia|diagn[oó]stic\w*|procure|deve(ria)?|precisa|tratar|trata\w*|cura\w*|previne|preven\w*|reduz\w*|melhora\w*|garant\w*|saud[aá]vel|terapia|ansiedade|depress\w*|normal é|é normal|fortalec\w*|alivi\w*|recomend\w*|faz bem)\b/i;

const marco = (m: Partial<Marco> & Pick<Marco, "tipo">): Marco =>
  ({ sementinhas: 25, chave: "x", ...m }) as Marco;

/** Todos os marcos que o servidor paga, com e sem o nome do bebê. */
function todas() {
  const marcos: Marco[] = [];
  for (let s = 4; s <= 42; s++) marcos.push(marco({ tipo: "semana", semana: s }));
  marcos.push(
    marco({ tipo: "trimestre", trimestre: 1 }),
    marco({ tipo: "trimestre", trimestre: 2 }),
  );
  marcos.push(marco({ tipo: "nascimento" }));
  for (let n = 1; n <= 12; n++) marcos.push(marco({ tipo: "mes", meses: n }));
  return marcos.flatMap((m) => [festaDaBolha(m, "Helena"), festaDaBolha(m, null)]);
}

describe("a Bolha na festa dos marcos", () => {
  test("nunca conduta, nunca promessa de efeito, nunca gênero para o bebê", () => {
    const fora = todas().flatMap((f) =>
      [f.sobrelinha, f.titulo, f.dado ?? "", f.fala].flatMap((t) => {
        const m = [
          ...(t.match(new RegExp(CONDUTA.source, "gi")) ?? []),
          ...(t.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
        ];
        return m.length ? [`${t} → ${m.join(", ")}`] : [];
      }),
    );
    expect(fora).toEqual([]);
  });

  test("a voz do app: sem travessão, sem emoji, sem exclamação", () => {
    const fora = todas()
      .flatMap((f) => [f.sobrelinha, f.titulo, f.dado ?? "", f.fala])
      .filter((t) => /—|–|!/.test(t) || /\p{Extended_Pictographic}/u.test(t));
    expect(fora).toEqual([]);
  });

  test("a semana nova: a Bolha comemora na frente do número, e a fala liga a semana à aula", () => {
    const f = festaDaBolha(marco({ tipo: "semana", semana: 24 }), "Helena");
    expect(f).toMatchObject({ numero: 24, pose: "comemorando", titulo: "Semana 24" });
    expect(f.dado).toBe("Do tamanho de milho · 30\u00a0cm");
    for (let s = 4; s <= 42; s++)
      expect(festaDaBolha(marco({ tipo: "semana", semana: s }), null).fala).toMatch(/aula/);
  });

  test("a mesma semana, a mesma fala; a semana seguinte, outra", () => {
    const de = (s: number) => festaDaBolha(marco({ tipo: "semana", semana: s }), null).fala;
    expect(de(24)).toBe(de(24));
    for (let s = 4; s < 42; s++) expect(de(s)).not.toBe(de(s + 1));
  });

  test("o trimestre, o nascimento e os meses: a Bolha, e o número só onde há um", () => {
    const t1 = festaDaBolha(marco({ tipo: "trimestre", trimestre: 1 }), null);
    expect(t1).toMatchObject({ numero: 13, pose: "orgulhosa", titulo: "Fim do 1º trimestre" });
    expect(t1.fala).toContain("começa o segundo");
    expect(festaDaBolha(marco({ tipo: "trimestre", trimestre: 2 }), null).fala).toContain(
      "começa o terceiro",
    );
    const nasceu = festaDaBolha(marco({ tipo: "nascimento" }), "Helena");
    expect(nasceu).toMatchObject({ numero: null, pose: "apaixonado" });
    expect(nasceu.fala.startsWith("Helena chegou")).toBe(true);
    expect(festaDaBolha(marco({ tipo: "nascimento" }), null).fala.startsWith("O bebê chegou")).toBe(
      true,
    );
    const mes = festaDaBolha(marco({ tipo: "mes", meses: 2 }), null);
    expect(mes).toMatchObject({ numero: 2, titulo: "O bebê com 2 meses" });
    expect(festaDaBolha(marco({ tipo: "mes", meses: 1 }), "Helena").titulo).toBe(
      "Helena com 1 mês",
    );
  });
});
