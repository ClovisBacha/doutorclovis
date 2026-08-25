import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { sugerirConversas } from "./conversa-sugerida";

/**
 * ⚠️ **O SILÊNCIO TEM QUATRO PORTAS, E ELE SÓ FECHAVA DUAS.**
 *
 * Silenciar alguém tira as publicações dela do feed e os stories da fileira —
 * isso funcionava, e está documentado nos dois blocos "O SILÊNCIO É APLICADO
 * AQUI". O que ninguém tinha olhado é que o feed tem outras entradas:
 *
 *  - a zona de **publicações sugeridas** (`sugestoesDoFeed`),
 *  - a **fileira de pessoas** (a mesma função, mesmo predicado),
 *  - a fileira de **conversas sugeridas** (a porta do direct).
 *
 * As três ofereciam de volta exatamente quem ela pediu para não ouvir. E a
 * porta por onde o defeito entra é a pior: a fileira sugere quem ela NÃO segue,
 * então o caso comum não é "silenciei e continuo seguindo" — é "silenciei
 * alguém da zona de descoberta", e a resposta do app era insistir.
 *
 * ⚠️ **O perfil continua de fora, e isso é deliberado**: visitar o perfil da
 * silenciada mostra tudo, porque ela foi até lá para ver. Silenciar é
 * preferência de FEED, não régua de visibilidade — se entrasse em
 * `podeVerPost`, viraria um bloqueio de um lado só e a palavra passaria a
 * mentir.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const semProsa = FONTE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const i = semProsa.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = semProsa.indexOf("\nexport const ", i + 10);
  return semProsa.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ o silêncio fecha as três portas do FEED", () => {
  test("o feed principal recorta pelas silenciadas", () => {
    expect(corpoDe("meuFeed")).toContain("ctx.silenciados.has(id)");
  });

  test("a fileira de stories também", () => {
    expect(corpoDe("storiesDoFeed")).toContain("ctx.silenciados.has(id)");
  });

  test("⚠️ e a zona de SUGERIDOS, que era o buraco", () => {
    /* ⚠️ Um predicado `fora` só governa as DUAS listas de `sugestoesDoFeed`
       (publicações e pessoas) — é por isso que um termo fecha as duas. Duas
       condições separadas divergiriam no primeiro ajuste, e a divergência
       apareceria como a silenciada sumindo de uma e ficando na outra. */
    const c = corpoDe("sugestoesDoFeed");
    expect(c).toContain("ctx.silenciados.has(id)");
    const i = c.indexOf("const fora =");
    expect(i).toBeGreaterThan(-1);
    const pred = c.slice(i, c.indexOf(";", i));
    for (const termo of ["id === eu", "ctx.sigo", "ctx.bloqueio", "ctx.silenciados", "jaPedi"]) {
      expect(pred).toContain(termo);
    }
  });

  test("⚠️ mas NÃO entra na régua de visibilidade", () => {
    /* Se entrasse em `podeVerPost`, silenciar viraria um bloqueio de um lado só
       e o perfil da silenciada apareceria vazio para quem foi até lá ver. */
    const regua = readFileSync("src/lib/rede-social.ts", "utf8");
    expect(regua).not.toContain("silenciad");
  });
});

describe("⚠️ e a quarta porta: a conversa sugerida", () => {
  const base = {
    euId: "eu",
    minhaFase: "t2" as const,
    jaConverso: { has: () => false },
  };
  const gente = (ids: string[]) =>
    ids.map((id) => ({
      id,
      nome: id,
      avatarUrl: null,
      fase: "t2" as const,
      ultimaVez: "2026-08-25T10:00:00Z",
    }));

  test("quem está no conjunto de fora NÃO é sugerida", () => {
    const todas = sugerirConversas({
      ...base,
      candidatas: gente(["a", "b", "c"]),
      foraDaSugestao: { has: () => false },
    });
    expect(todas.map((x) => x.id).sort()).toEqual(["a", "b", "c"]);

    const semB = sugerirConversas({
      ...base,
      candidatas: gente(["a", "b", "c"]),
      foraDaSugestao: { has: (id) => id === "b" },
    });
    expect(semB.map((x) => x.id)).not.toContain("b");
  });

  test("⚠️ o campo se chama `foraDaSugestao`, e o nome é o conserto", () => {
    /**
     * Com `bloqueadas`, quem lesse a chamada concluiria que só o bloqueio
     * recorta — e foi exatamente assim que a silenciada continuou sendo
     * oferecida aqui depois de o feed e os stories já a terem tirado. Renomear
     * quebrou o `tsc` em todos os chamadores, que é o ponto: obriga cada um a
     * ser relido.
     */
    const regua = readFileSync("src/lib/conversa-sugerida.ts", "utf8");
    expect(regua).toContain("foraDaSugestao");
    expect(regua.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain("bloqueadas");
  });

  test("⚠️ a UNIÃO é por proxy, e nunca um `Set` novo", () => {
    /**
     * `ctx.bloqueio` é `ConjuntoDeBloqueio`, que FALHA FECHADO: leitura
     * degradada responde `true` para todo mundo e ninguém é sugerido.
     * Espalhá-lo num `Set` perderia isso — o embrulho degradado não tem
     * membros para espalhar, então o `Set` sairia VAZIO e responderia `false`
     * para todas, que é o oposto exato.
     */
    const chamada = readFileSync("src/lib/conversa.functions.ts", "utf8");
    const i = chamada.indexOf("foraDaSugestao:");
    expect(i).toBeGreaterThan(-1);
    const trecho = chamada.slice(i, i + 220);
    expect(trecho).toContain("ctx.bloqueio.has(id)");
    expect(trecho).toContain("ctx.silenciados.has(id)");
    expect(trecho).not.toContain("new Set");

    /* E a propriedade em si, exercitada: um conjunto que diz `true` para todo
       mundo tem de zerar a sugestão. */
    expect(
      sugerirConversas({
        ...base,
        candidatas: gente(["a", "b", "c"]),
        foraDaSugestao: { has: () => true },
      }),
    ).toEqual([]);
  });
});
