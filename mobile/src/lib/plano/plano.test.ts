import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CARTAS } from "@/lib/cartas-do-bebe";
import { MOVIMENTOS } from "@/lib/exercicios";
import { semComentarios } from "@/lib/sem-comentarios";
import { temasDisponiveis } from "~/lib/jornada/meditacao";
import { ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";
import { APELIDOS, proximoApelido } from "~/lib/plano/apelidos";
import {
  aulasDoPlano,
  conteudoDoApp,
  curvaDoCuidado,
  diasDoPlano,
  linhaDoTempo,
  marcosDaCurva,
  minutosDoPlano,
  rotuloDoTempo,
} from "~/lib/plano/numeros";
import {
  falaDoPasso,
  linhasDoAcolhimento,
  O_QUE_O_APP_TEM,
  OPCOES_DA_AMIGA,
  OPCOES_DA_DATA,
  OPCOES_DA_FASE,
  OPCOES_DO_MOMENTO,
  OPCOES_DO_PILAR,
  OPCOES_DO_SENTIR,
  OPCOES_DO_TEMPO,
  opcoesDaPreocupacao,
  PASSOS,
  passoPronto,
  progressoDoPasso,
} from "~/lib/plano/passos";
import {
  contagemDoPlano,
  horaNaFrase,
  itensDaMontagem,
  linhasDaDiferenca,
  linhasDoQueMuda,
  pecasDoPlano,
  resumoDoPlano,
} from "~/lib/plano/vitrine";
import {
  alternarPreocupacao,
  lerRespostas,
  planoCompleto,
  RESPOSTAS_VAZIAS,
  type RespostasDoPlano,
  type Sentir,
} from "~/lib/plano/respostas";

/**
 * O FUNIL "MONTAR O MEU PLANO" (20/11/2026). As mesmas regras de voz da
 * Bolha (`bolha/conversa.test.ts`), e a regra que a referência do dono NÃO
 * seguia: todo número do plano se conta.
 */

const CONDUTA =
  /\b(m[eé]dic[oa]s?|consultas?|exames?|rem[eé]dios?|medica\w*|suplement\w*|vitaminas?|dieta|sintomas?|dores?|sangr\w*|contra[cç][aã]o|contra[cç][oõ]es|press[aã]o|glicemia|diagn[oó]stic\w*|procure|deve(ria)?|precisa|tratar|trata\w*|cura\w*|previne|preven\w*|reduz\w*|melhora\w*|garant\w*|saud[aá]vel|terapia|ansiedade|depress\w*|normal é|é normal)\b/i;

const HOJE = new Date(2026, 10, 20);

const base: RespostasDoPlano = {
  ...RESPOSTAS_VAZIAS,
  nome: "Marina Souza",
  fase: "gravida",
  modo: "dum",
  /* 30/05/2026 → 24 semanas e 6 dias em 20/11/2026. */
  data: "30/05/2026",
  bebe: "Helena",
};

function todasAsFrases(): string[] {
  const frases: string[] = [];
  const sentires: (Sentir | null)[] = [
    null,
    "tranquila",
    "animada",
    "cansada",
    "ansiosa",
    "de-tudo",
  ];
  for (const fase of ["gravida", "nasceu"] as const)
    for (const bebe of ["", "Helena"])
      for (const sentir of sentires) {
        const r: RespostasDoPlano = {
          ...base,
          fase,
          modo: fase === "nasceu" ? "nasceu" : "dum",
          bebe,
          sentir,
          primeira: true,
          minutos: 5,
          preocupacoes: ["tempo"],
        };
        for (const p of PASSOS) {
          const f = falaDoPasso(p, r);
          frases.push(f.pergunta, f.reacao ?? "", f.apoio ?? "");
        }
        frases.push(...linhasDoAcolhimento(r).flatMap((l) => [l.de, l.app]));
      }
  frases.push(
    ...Object.values(O_QUE_O_APP_TEM),
    ...[
      ...OPCOES_DA_FASE,
      ...OPCOES_DA_DATA,
      ...OPCOES_DO_SENTIR,
      ...opcoesDaPreocupacao("gravida"),
      ...opcoesDaPreocupacao("nasceu"),
      ...OPCOES_DO_PILAR,
      ...OPCOES_DO_TEMPO,
      ...OPCOES_DO_MOMENTO,
      ...OPCOES_DA_AMIGA,
    ].flatMap((o) => [o.rotulo, o.sub ?? ""]),
  );
  return frases.filter(Boolean);
}

describe("o funil: os passos", () => {
  test("começa pelo nome, revela a semana cedo e termina salvando (a conta)", () => {
    expect(PASSOS[0]).toBe("nome");
    expect(PASSOS.indexOf("semana")).toBeLessThan(PASSOS.indexOf("sentir"));
    expect(PASSOS.indexOf("montando")).toBeLessThan(PASSOS.indexOf("pronto"));
    expect(PASSOS.at(-1)).toBe("conta");
    expect(new Set(PASSOS).size).toBe(PASSOS.length);
  });

  test("a barra anda sempre para frente e chega ao fim na conta", () => {
    const f = PASSOS.map(progressoDoPasso);
    f.forEach((x, i) => i > 0 && expect(x).toBeGreaterThan(f[i - 1]!));
    expect(f.at(-1)).toBe(1);
  });

  test("o Continuar só libera com a resposta; o bebê e as vitrines nunca prendem", () => {
    expect(passoPronto("nome", { ...RESPOSTAS_VAZIAS, nome: " " })).toBe(false);
    expect(passoPronto("nome", { ...RESPOSTAS_VAZIAS, nome: "Ju" })).toBe(true);
    expect(passoPronto("preocupa", RESPOSTAS_VAZIAS)).toBe(false);
    expect(passoPronto("bebe", RESPOSTAS_VAZIAS)).toBe(true);
    expect(passoPronto("montando", RESPOSTAS_VAZIAS)).toBe(true);
    expect(passoPronto("data", { ...RESPOSTAS_VAZIAS, data: "30/05/2026" })).toBe(true);
  });

  test("'Nada disso' é exclusiva: tira as outras, e as outras a tiram", () => {
    expect(alternarPreocupacao(["tempo", "corpo"], "nenhuma")).toEqual(["nenhuma"]);
    expect(alternarPreocupacao(["nenhuma"], "tempo")).toEqual(["tempo"]);
    expect(alternarPreocupacao(["tempo"], "tempo")).toEqual([]);
  });
});

describe("o funil: a voz da Bolha", () => {
  test("nunca conduta, nunca promessa de efeito, nunca gênero para o bebê", () => {
    const fora = todasAsFrases().flatMap((f) => {
      const m = [
        ...(f.match(new RegExp(CONDUTA.source, "gi")) ?? []),
        ...(f.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
      ];
      return m.length ? [`${f} → ${m.join(", ")}`] : [];
    });
    expect(fora).toEqual([]);
  });

  test("sem travessão, sem emoji, sem exclamação em série", () => {
    const fora = todasAsFrases().filter(
      (f) => /—|–/.test(f) || /\p{Extended_Pictographic}/u.test(f) || /!.*!/.test(f),
    );
    expect(fora).toEqual([]);
  });

  test("o nome dela é só o primeiro, e o do bebê aparece quando existe", () => {
    expect(falaDoPasso("fase", base).pergunta).toBe("Marina, em que fase você está?");
    expect(falaDoPasso("primeira", base).reacao).toBe("Helena, que nome lindo!");
    expect(falaDoPasso("primeira", { ...base, bebe: "" }).reacao).toBeNull();
  });

  test("a Bolha reage ao que ela sentiu ANTES da pergunta, e toda pergunta é curta", () => {
    expect(falaDoPasso("preocupa", { ...base, sentir: "cansada" }).reacao).toContain("Obrigada");
    expect(falaDoPasso("preocupa", { ...base, sentir: "cansada" }).pergunta).toBe(
      "O que mais ocupa a sua cabeça agora?",
    );
    /* A pergunta é o título da tela, na serifada grande: até ~55 letras. */
    for (const p of PASSOS) {
      const f = falaDoPasso(p, { ...base, fase: "nasceu" });
      expect({ p, curta: f.pergunta.length <= 55 }).toEqual({ p, curta: true });
    }
  });
});

describe("o funil: os números são de verdade", () => {
  test("a semana e os dias até a data provável saem da mesma régua da trilha", () => {
    const t = linhaDoTempo(base, HOJE);
    expect(t?.modo).toBe("gravida");
    if (t?.modo !== "gravida") return;
    expect(t.totalDias).toBe(174);
    expect(t.semana).toBe(24);
    expect(t.trimestre).toBe(2);
    expect(t.diasAteADpp).toBe(106);
  });

  test("as aulas do plano: uma por dia, de hoje até a semana 40", () => {
    const t = linhaDoTempo(base, HOJE)!;
    expect(diasDoPlano(t)).toBe(107);
    expect(aulasDoPlano(t)).toBe(280 - 174 + 1);
  });

  test("passou da data provável: ainda há a aula de hoje, nunca um número negativo", () => {
    const t = linhaDoTempo({ ...base, data: "01/01/2026" }, HOJE)!;
    expect(aulasDoPlano(t)).toBeGreaterThanOrEqual(1);
    expect(diasDoPlano(t)).toBe(1);
  });

  test("depois do parto: as 12 primeiras semanas, com os desafios que existem (D 7–90)", () => {
    const t = linhaDoTempo({ ...base, fase: "nasceu", modo: "nasceu", data: "06/11/2026" }, HOJE);
    expect(t).toEqual({ modo: "nasceu", idadeDias: 14, semanasDeVida: 2, diasAte12Semanas: 70 });
    expect(aulasDoPlano(t!)).toBe(90 - 21 + 1);
  });

  test("os minutos somam o que ela escolheu, e o rótulo arredonda para baixo", () => {
    const t = linhaDoTempo(base, HOJE)!;
    expect(minutosDoPlano(t, 5)).toBe(107 * 5);
    expect(rotuloDoTempo(535)).toBe("8 horas");
    expect(rotuloDoTempo(59)).toBe("59 minutos");
    expect(rotuloDoTempo(60)).toBe("1 hora");
    const curva = curvaDoCuidado(t, 5);
    expect(curva[0]).toBe(0);
    expect(curva.at(-1)).toBe(107 * 5);
  });

  test("o conteúdo do app é contado das listas que as telas leem", () => {
    expect(conteudoDoApp({ posParto: false })).toMatchObject({
      meditacoes: temasDisponiveis({ cuidado: false, posParto: false }).length,
      sons: Object.keys(ROTULO_DO_SOM_NO_APP).length,
      movimentos: MOVIMENTOS.length,
      cartas: CARTAS.length,
    });
  });

  test("data que não vale não vira número", () => {
    expect(linhaDoTempo({ ...base, data: "31/02/2026" }, HOJE)).toBeNull();
    expect(linhaDoTempo({ ...base, data: "" }, HOJE)).toBeNull();
  });
});

describe("o funil: o que fica guardado", () => {
  test("lê tolerante: lixo vira vazio, e opção que não existe some", () => {
    expect(lerRespostas(null)).toEqual(RESPOSTAS_VAZIAS);
    expect(lerRespostas("x")).toEqual(RESPOSTAS_VAZIAS);
    const r = lerRespostas({
      nome: "Ana",
      sentir: "furiosa",
      preocupacoes: ["tempo", "x", "tempo"],
      minutos: 7,
    });
    expect(r.nome).toBe("Ana");
    expect(r.sentir).toBeNull();
    expect(r.preocupacoes).toEqual(["tempo"]);
    expect(r.minutos).toBeNull();
  });

  test("o plano só está completo com a fase, a data e o fim do funil", () => {
    expect(planoCompleto(base)).toBe(false);
    expect(planoCompleto({ ...base, completoEm: "2026-11-20T10:00:00Z" })).toBe(true);
    expect(planoCompleto({ ...base, data: "", completoEm: "2026-11-20T10:00:00Z" })).toBe(false);
  });

  test("o apelido nunca repete o anterior, e mora numa lista sem gênero de frase", () => {
    for (const a of APELIDOS) expect(proximoApelido(a, 0)).not.toBe(a);
    expect(APELIDOS).toContain(proximoApelido("", 0.999));
  });
});

/* ── A catraca das telas: nada de prova social inventada ───────────────── */

const RAIZ = join(import.meta.dir, "../..");
function arquivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir).flatMap((n) => arquivos(join(dir, n)));
}

describe("o funil não inventa número (CDC art. 37; Apple 2.3.1 e 5.6)", () => {
  const telas = [
    join(RAIZ, "app/(entrada)/plano.tsx"),
    join(RAIZ, "app/guardar-plano.tsx"),
    ...arquivos(join(RAIZ, "componentes/plano")),
  ].filter((f) => existsSync(f) && /\.tsx?$/.test(f));

  test("as telas do funil existem", () => {
    expect(telas.length).toBeGreaterThan(2);
  });

  test("sem 'mil mães', nota, avaliações, estrelas ou economia em reais escritas à mão", () => {
    const fora = telas.filter((f) =>
      /\d[\d.]*\s*(mil\s+)?m[ãa]es|avalia[çc](ão|ões|oes)|\b[0-5],\d\s*★|★|R\$\s?\d|economiz/i.test(
        semComentarios(readFileSync(f, "utf8")),
      ),
    );
    expect(fora.map((f) => relative(RAIZ, f))).toEqual([]);
  });
});

describe("o funil: as vitrines", () => {
  const t = linhaDoTempo(base, HOJE)!;
  const r: RespostasDoPlano = {
    ...base,
    minutos: 5,
    momento: "noite",
    pilares: ["vinculo"],
    preocupacoes: ["sozinha"],
    amiga: "depois",
  };
  const c = conteudoDoApp({ posParto: false });

  test("a voz das vitrines: sem conduta, sem gênero para o bebê, sem travessão", () => {
    const frases = [
      ...pecasDoPlano(r, t, 107, c).flatMap((p) => [p.titulo, p.quanto]),
      ...itensDaMontagem(r, t, 107, c),
      ...linhasDaDiferenca(r, t).flatMap((l) => [l.sem, l.com]),
      ...linhasDoQueMuda(r, t, 107, "21:00").flatMap((l) => [l.titulo, l.sub]),
      ...resumoDoPlano(r, t, 107).map((l) => l.texto),
    ];
    const fora = frases.filter(
      (f) =>
        CONDUTA.test(f) || /\b(ele|ela|dele|dela)\b/i.test(f) || /—|–/.test(f) || /!.*!/.test(f),
    );
    expect(fora).toEqual([]);
  });

  test("o pilar que ela marcou vem primeiro no plano pronto", () => {
    expect(pecasDoPlano(r, t, 107, c)[0]!.titulo).toBe("Cartas para Helena");
  });

  test("no fim do plano, nada de '1 aula' ou '0 desafios'", () => {
    expect(contagemDoPlano(t, 107)).toBe("107 aulas até a data provável");
    expect(contagemDoPlano(t, 1)).toBeNull();
    const velho = linhaDoTempo(
      { ...base, fase: "nasceu", modo: "nasceu", data: "01/06/2026" },
      HOJE,
    )!;
    expect(aulasDoPlano(velho)).toBe(0);
    const todas = [
      ...itensDaMontagem(r, velho, 0, c),
      ...pecasDoPlano(r, velho, 0, c).map((p) => p.quanto),
      ...linhasDoQueMuda(r, velho, 0, null).map((l) => l.sub),
      ...resumoDoPlano(r, velho, 0).map((l) => l.texto),
    ];
    expect(todas.filter((f) => /\b[01] (aula|aulas|desafio|desafios)\b/.test(f))).toEqual([]);
  });

  test("a hora na frase: 21h e 12h30", () => {
    expect(horaNaFrase("21:00")).toBe("21h");
    expect(horaNaFrase("12:30")).toBe("12h30");
  });

  test("os marcos do gráfico: hoje, semanas redondas no caminho e a data provável", () => {
    const m = marcosDaCurva(t, 5);
    expect(m[0]).toEqual({ rotulo: "Hoje", dias: 0, minutos: 0 });
    expect(m.at(-1)).toEqual({ rotulo: "Data provável", dias: 106, minutos: 107 * 5 });
    expect(m.slice(1, -1).map((x) => x.rotulo)).toEqual(["Semana 28", "Semana 32"]);
  });
});
