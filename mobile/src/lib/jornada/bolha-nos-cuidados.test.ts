import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  falaDaLeitura,
  falaDaMeditacao,
  falaDoDiaQuePassou,
  falaDoMexer,
  falaNaSessaoDoMexer,
  todasAsFalasDosCuidados,
} from "./bolha-nos-cuidados";
import { cuidadosDoDia } from "./hoje";

/**
 * OS CUIDADOS COMO BEM-ESTAR, COM A BOLHA GUIANDO (19/11/2026). O dono quer
 * um app de bem-estar materno, e bem-estar NÃO é conselho médico: a Bolha
 * acompanha e convida, e a linha de cada cuidado diz o que ela ganha de
 * momento, nunca um efeito de saúde.
 */

/** Promessa de efeito, indicação ou assunto clínico: nada disso é bem-estar. */
const CONDUTA =
  /\b(reduz\w*|melhora\w*|alivi\w*|fortalec\w*|previn\w*|saudáve\w*|faz bem|recomend\w*|procure|você deve|você precisa|médic\w*|remédio|suplement\w*|dieta|sintoma\w*|exame\w*|tratamento)\b/i;
/** O bebê sem gênero. */
const GENERO = /\b(ele|ela|dele|dela)\b/i;

const CUIDADOS = [
  cuidadosDoDia({ flags: {}, semana: 24, nomeDoBebe: "Helena", assuntoDaAula: "O sono" }),
  cuidadosDoDia({ flags: {}, semana: 8, nomeDoBebe: null }),
].flat();

describe("a Bolha nos cuidados", () => {
  test("nenhuma fala da Bolha nem linha de cuidado promete efeito, manda ou dá gênero ao bebê", () => {
    const textos = [...todasAsFalasDosCuidados(), ...CUIDADOS.flatMap((c) => [c.titulo, c.sub])];
    expect(textos.filter((t) => CONDUTA.test(t))).toEqual([]);
    expect(textos.filter((t) => GENERO.test(t))).toEqual([]);
  });

  test("texto de gente: sem travessão, sem emoji e curto", () => {
    const fora = todasAsFalasDosCuidados().filter(
      (t) => /—/.test(t) || /\p{Extended_Pictographic}/u.test(t) || t.length > 120,
    );
    expect(fora).toEqual([]);
  });

  test("a Bolha fala na primeira pessoa (é ela quem acompanha)", () => {
    expect(falaDoMexer({ jaFeita: false, cuidado: false, energia: null })).toMatch(/\bEu\b/);
    expect(falaNaSessaoDoMexer({ indice: 0, total: 7, troca: false })).toMatch(/\bEu conto\b/);
    expect(falaDaLeitura({ linha: 0, total: 6 })).toMatch(/\bEu fico\b/);
  });

  test("a sessão do Mexer muda de fala só nas trocas que importam, e pular sempre vale", () => {
    const falas = Array.from({ length: 7 }, (_, indice) =>
      falaNaSessaoDoMexer({ indice, total: 7, troca: false }),
    );
    expect(falas[0]).toMatch(/Pode pular/);
    expect(falas[3]).toMatch(/^Metade feita/);
    expect(falas[6]).toMatch(/^Último movimento/);
    expect(falas.filter((f) => /pular/i.test(f)).length).toBeGreaterThanOrEqual(5);
    expect(falaNaSessaoDoMexer({ indice: 2, total: 7, troca: true })).toMatch(/posição/);
  });

  test("a escolha de energia muda a fala, e o Modo Cuidado não festeja nem fala do bebê", () => {
    const cansada = falaDoMexer({ jaFeita: false, cuidado: false, energia: "cansada" });
    expect(cansada).toMatch(/mais leve/);
    const luto = [
      falaDoMexer({ jaFeita: false, cuidado: true, energia: null }),
      falaDaMeditacao({ cuidado: true, jaFeita: false, seguidos: 4, diaDoPrograma: null }),
    ];
    expect(luto.filter((t) => /bebê|vocês dois|!/.test(t))).toEqual([]);
  });

  test("o dia que passou mostra o que foi feito, sem cobrar o que faltou", () => {
    expect(falaDoDiaQuePassou(5, 5)).toMatch(/os 5 cuidados/);
    expect(falaDoDiaQuePassou(2, 5)).toBe(
      "Nesse dia você fez 2 de 5 cuidados. Hoje é um dia novo.",
    );
    expect(falaDoDiaQuePassou(0, 5)).not.toMatch(/faltou|não fez|perdeu/);
  });
});

describe("as telas dos cuidados (catraca do fonte)", () => {
  const RAIZ = join(import.meta.dir, "..", "..");
  const fonte = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));
  const TELAS = ["mexer", "meditar", "bebe", "gratidao", "casal", "dormir", "dia"].map((t) => ({
    t,
    codigo: fonte("app", "jornada", `${t}.tsx`),
  }));

  test("nenhuma tela dos cuidados promete efeito de saúde", () => {
    /* "reduzido" é o "reduzir movimento" do código, e não promessa. */
    const EFEITO =
      /\b(reduz(?!ido)\w*|alivi\w*|fortalec\w*|previn\w*|saudáve\w*|faz bem|bastam para)\b/i;
    const fora = TELAS.filter(({ codigo }) => EFEITO.test(codigo)).map(({ t }) => t);
    expect(fora).toEqual([]);
    /* "A sua voz é o som preferido do bebê" era afirmação sobre o bebê. */
    expect(fonte("app", "jornada", "bebe.tsx")).not.toMatch(/som preferido/);
  });

  test("a Bolha guia: cada atividade a mostra falando na abertura, e nada vai atrás dela", () => {
    for (const { t, codigo } of TELAS.filter((x) => x.t !== "dia"))
      expect({ t, bolha: /<BolhaComBalao\b/.test(codigo) }).toEqual({ t, bolha: true });
    /* A regra da bolha: sem brilho, sem disco atrás dela. */
    const atividade = fonte("componentes", "jornada", "atividade.tsx");
    const bolha = /export function BolhaComBalao[\s\S]*?\n}\n/.exec(atividade)?.[0] ?? "";
    expect(bolha).not.toMatch(/<Brilho\b/);
  });

  test("a folha do dia é o cuidado de hoje pela Bolha: o cérebro escolhe a fala e o próximo", () => {
    const dia = fonte("app", "jornada", "dia.tsx");
    expect(dia).toMatch(/O seu cuidado de hoje/);
    expect(dia).toMatch(/\bsugestao\(/);
    expect(dia).toMatch(/\bcuidadosDoDia\(/);
    expect(dia).not.toMatch(/recadoDaBolhaNoApp|META_DAS_ATIVIDADES/);
  });
});
