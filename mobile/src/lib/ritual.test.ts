import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  falaDaRevelacao,
  falaDoRitual,
  ordemDoRitual,
  resumoDaData,
  revelaASemana,
  semanaDaRevelacao,
  type ContextoDoRitual,
} from "~/lib/ritual";

/**
 * O RITUAL DE BOAS-VINDAS (18/11/2026, a vistoria): no mesmo céu da entrada,
 * um passo por tela, sem o médico quando o SOS está desligado, e com a
 * revelação da semana no fim do primeiro ritual.
 *
 * 19/11/2026: a Bolha conduz (cada pergunta é fala dela, com a resposta
 * anterior do lado), e a revelação é a Bolha comemorando na frente do número
 * da semana, sem ilustração de bebê.
 */

const RAIZ = join(import.meta.dir, "..");
const fonte = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

describe("os passos do ritual", () => {
  test("com o SOS desligado, o contato e o médico saem; a amiga só no primeiro ritual", () => {
    expect(ordemDoRitual(6, false)).toEqual([0, 1, 2, 5]);
    expect(ordemDoRitual(5, false)).toEqual([0, 1, 2]);
  });

  test("com o SOS ligado, os seis passos voltam", () => {
    expect(ordemDoRitual(6, true)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ordemDoRitual(5, true)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("a revelação da semana no fim do primeiro ritual", () => {
  test("só no primeiro ritual da gestação, e nunca no Modo Cuidado", () => {
    expect(revelaASemana({ editar: false, modo: "dum", cuidado: false })).toBe(true);
    expect(revelaASemana({ editar: false, modo: "us", cuidado: false })).toBe(true);
    expect(revelaASemana({ editar: true, modo: "dum", cuidado: false })).toBe(false);
    expect(revelaASemana({ editar: false, modo: "nasceu", cuidado: false })).toBe(false);
    expect(revelaASemana({ editar: false, modo: "dum", cuidado: true })).toBe(false);
  });

  test("a semana sai da mesma régua da trilha (DUM ou ultrassom)", () => {
    const hoje = new Date(2026, 10, 18);
    /* 172 dias desde a DUM: 24 semanas e 4 dias. */
    expect(semanaDaRevelacao({ modo: "dum", ymd: "2026-05-30" }, hoje)).toBe(24);
    /* O ultrassom de 1º de outubro dizia 12s2d: 48 dias depois, 19s1d. */
    expect(
      semanaDaRevelacao({ modo: "us", ymd: "2026-10-01", semanasUs: 12, diasUs: 2 }, hoje),
    ).toBe(19);
    /* Bem no começo, a trilha começa na semana 1. */
    expect(semanaDaRevelacao({ modo: "dum", ymd: "2026-11-15" }, hoje)).toBe(1);
  });

  test("sem data, ou depois do parto, não há o que revelar", () => {
    expect(semanaDaRevelacao({ modo: "dum", ymd: null })).toBeNull();
    expect(semanaDaRevelacao({ modo: "nasceu", ymd: "2026-10-01" })).toBeNull();
  });

  test("o ritual pergunta pela regra antes de revelar, e a revelação mora no céu da entrada", () => {
    const ritual = fonte("app", "ritual.tsx");
    expect(ritual).toContain("revelaASemana({");
    expect(ritual).toContain("<RevelacaoDaSemana");
    expect(ritual).toContain("<FundoDaEntrada");
    expect(ritual).toContain("ordemDoRitual(total, SOS_NO_APP)");
    expect(ritual).not.toMatch(/arte-do-bebe|ceu-do-bebe/);
  });

  test("a revelação é a Bolha comemorando na frente do número, sem ilustração de bebê", () => {
    /* O dono, 19/11/2026: "eu quero tirar as imagens dos bebês [...] o número
       24 ali estava muito bacana". */
    const revelacao = fonte("componentes", "revelacao-da-semana.tsx");
    expect(revelacao).toMatch(/<BolhaViva humor="comemorando"/);
    expect(revelacao).toMatch(/\{semana\}/);
    expect(revelacao).toContain("falaDaRevelacao(semana, nome)");
    expect(revelacao).not.toMatch(
      /arte-do-bebe|arteDoBebe|ceu-do-bebe|bebe-da-semana|assets\/bebes?\/|RECEM_NASCIDO|\bBEBE\b/,
    );
    /* Ela lê no tempo dela: nada de fechar sozinha. */
    expect(revelacao).not.toMatch(/setTimeout\(\(\) => (fim|aoTerminar)/);
  });

  test("o aceite mora no mesmo céu, sem a página clara", () => {
    const aceite = fonte("app", "aceite.tsx");
    expect(aceite).toContain("<FundoDaEntrada");
    expect(aceite).not.toMatch(/<Tela\b/);
  });
});

/* ── A Bolha conduz o ritual (19/11/2026) ─────────────────────────────── */

const BASE: ContextoDoRitual = {
  passo: 0,
  editar: false,
  modo: "dum",
  nome: "Marina Costa",
  data: "30/05/2026",
  semanasUs: "",
  diasUs: "",
  bebe: "Helena",
  anterior: null,
};

/** As falas de todos os passos que ela vê, nos modos e caminhos possíveis. */
function todasAsFalas(): { passo: number; texto: string; dela: string | null }[] {
  const fora: { passo: number; texto: string; dela: string | null }[] = [];
  for (const editar of [false, true])
    for (const modo of ["dum", "us", "nasceu"] as const)
      for (const nome of ["Marina Costa", ""])
        for (const bebe of ["Helena", ""]) {
          const ordem = ordemDoRitual(editar ? 5 : 6, false);
          ordem.forEach((passo, i) => {
            const f = falaDoRitual({
              ...BASE,
              passo,
              editar,
              modo,
              nome,
              bebe,
              semanasUs: "12",
              diasUs: "2",
              anterior: i > 0 ? ordem[i - 1]! : null,
            });
            fora.push({ passo, texto: f.texto, dela: f.dela });
          });
        }
  for (const semana of [4, 24, 40])
    for (const nome of ["Marina", null])
      fora.push({ passo: -1, texto: falaDaRevelacao(semana, nome), dela: null });
  return fora;
}

/** O que a Bolha NUNCA diz: conduta, clínica, promessa de efeito (a régua de `conversa.test.ts`). */
const CONDUTA =
  /\b(m[eé]dic[oa]s?|consultas?|exames?|rem[eé]dios?|medica\w*|suplement\w*|vitaminas?|dieta|sintomas?|dores?|sangr\w*|contra[cç][aã]o|contra[cç][oõ]es|press[aã]o|glicemia|diagn[oó]stic\w*|procure|deve(ria)?|precisa|tratar|trata\w*|cura\w*|previne|preven\w*|reduz\w*|melhora\w*|garant\w*|saud[aá]vel|terapia|ansiedade|depress\w*|normal é|é normal|faz bem|alivia\w*|fortalec\w*)\b/i;

describe("a Bolha conduz o ritual", () => {
  test("cada pergunta é fala da Bolha, e a resposta anterior aparece do lado dela", () => {
    const ordem = ordemDoRitual(6, false);
    const fala = (passo: number) =>
      falaDoRitual({ ...BASE, passo, anterior: ordem[ordem.indexOf(passo) - 1] ?? null });
    expect(fala(0).dela).toBeNull();
    expect(fala(0).texto).toContain("como você quer que eu te chame?");
    /* Só o primeiro nome, e a resposta inteira do lado dela. */
    expect(fala(1).texto).toContain("Prazer, Marina!");
    expect(fala(1).dela).toBe("Marina Costa");
    expect(fala(2).dela).toBe("Última menstruação em 30/05/2026");
    expect(fala(5).dela).toBe("Helena");
    expect(fala(5).texto).toContain("Helena, que nome bonito!");
  });

  test("corrigindo a data, a Bolha vai direto ao ponto", () => {
    const f = falaDoRitual({ ...BASE, passo: 1, editar: true, anterior: 0 });
    expect(f.texto).toBe("Vamos acertar a data. Em que fase você está?");
    expect(f.dela).toBeNull();
  });

  test("a resposta da data, como ela diria", () => {
    expect(resumoDaData({ modo: "nasceu", data: "01/10/2026", semanasUs: "", diasUs: "" })).toBe(
      "Nasceu em 01/10/2026",
    );
    expect(resumoDaData({ modo: "us", data: "01/10/2026", semanasUs: "12", diasUs: "2" })).toBe(
      "Ultrassom em 01/10/2026, com 12 semanas e 2 dias",
    );
    expect(resumoDaData({ modo: "us", data: "01/10/2026", semanasUs: "12", diasUs: "1" })).toBe(
      "Ultrassom em 01/10/2026, com 12 semanas e 1 dia",
    );
    /* A data pela metade não vira resposta. */
    expect(resumoDaData({ modo: "dum", data: "30/05", semanasUs: "", diasUs: "" })).toBeNull();
  });

  test("nunca conduta, nunca promessa de efeito, nunca gênero para o bebê", () => {
    const fora = todasAsFalas().flatMap(({ texto }) => {
      const m = [
        ...(texto.match(new RegExp(CONDUTA.source, "gi")) ?? []),
        ...(texto.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
      ];
      return m.length ? [`${texto} → ${m.join(", ")}`] : [];
    });
    expect(fora).toEqual([]);
  });

  test("a voz do app: sem travessão, sem emoji, sem exclamação em série", () => {
    const fora = todasAsFalas()
      .flatMap(({ texto, dela }) => [texto, dela ?? ""])
      .filter((f) => /—|–/.test(f) || /\p{Extended_Pictographic}/u.test(f) || /!.*!.*!/.test(f));
    expect(fora).toEqual([]);
  });

  test("a revelação dá as boas-vindas ao cuidado, com o primeiro nome e a semana", () => {
    expect(falaDaRevelacao(24, "Marina Costa")).toBe(
      "Marina, você está na semana 24. A partir de hoje, cuidar de você faz parte do dia, e eu vou junto.",
    );
    expect(falaDaRevelacao(24, null)).toMatch(/^Você está na semana 24\./);
  });

  test("a tela desenha a fala da regra, e a Bolha sai do alto para a conversa", () => {
    const ritual = fonte("app", "ritual.tsx");
    expect(ritual).toContain("falaDoRitual({");
    expect(ritual).toContain("<FalaDaBolha");
    expect(ritual).toContain("<RespostaDela");
    /* As perguntas não são mais títulos soltos: quem pergunta é a Bolha. */
    expect(ritual).not.toMatch(/<TituloNoVeu|function Cabeca/);
  });
});
