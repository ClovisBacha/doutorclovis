import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { alcancaOPerfil } from "./selo-do-perfil";
import { NUMEROS_PUBLICOS } from "./medidas-instagram";

/**
 * ⚠️ **A LISTA DE SEGUIDORES ABRE, E É DECISÃO DO DONO.**
 *
 * Ela era do MEU perfil e de mais ninguém — a tela nem oferecia o toque em
 * perfil de terceiro, e o servidor lia sempre a lista da sessão. O argumento
 * era clínico: a lista de quem acompanha uma gestante de alto risco é o CÍRCULO
 * SOCIAL dela.
 *
 * O argumento que venceu é do dono, e é de produto: *"a lista de pessoas
 * seguindo também é para estar aparente; em nenhum momento vamos bloquear isso,
 * é pra usar as mesmas coisas que tem no Instagram."*
 *
 * ⚠️ **E "as mesmas coisas que tem no Instagram" é LITERAL, não uma abertura
 * geral** — é o que este arquivo trava. Lá, a lista de um perfil PÚBLICO abre
 * para qualquer um e a de um perfil PRIVADO só para quem já foi aceita. Quem
 * decide aqui é `alcancaOPerfil`, a MESMA régua de `verPerfil`: a chave de
 * privacidade que ela já controla continua valendo, e nenhuma porta nova nasce.
 */
const SERVIDOR = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");

const HANDLER = (() => {
  const i = SERVIDOR.indexOf("export const listaDeGente");
  const fins = [
    SERVIDOR.indexOf("\nexport const ", i + 10),
    SERVIDOR.indexOf("\n/**", i + 10),
  ].filter((n) => n > 0);
  return SERVIDOR.slice(i, Math.min(...fins));
})();

describe("⚠️ os NÚMEROS ficam à vista", () => {
  test("⚠️ seguidores e seguindo são públicos — nunca escondidos", () => {
    /* O dono já reverteu isto uma vez, e reafirmou: "vai ter contagem de
       seguidores sim, se tiver isso está errado". */
    expect(NUMEROS_PUBLICOS.seguidores).toBe(true);
    expect(NUMEROS_PUBLICOS.seguindo).toBe(true);
    expect(NUMEROS_PUBLICOS.publicacoes).toBe(true);
  });
});

describe("⚠️ a LISTA abre — com a régua do Instagram, e não sem régua", () => {
  test("a âncora existe (senão o describe passa em vazio)", () => {
    expect(HANDLER.length).toBeGreaterThan(800);
  });

  test("⚠️ ela aceita um ALVO — antes só sabia ler a da sessão", () => {
    expect(HANDLER).toContain("alvoId: z.string().uuid().optional()");
    expect(HANDLER).toContain("const alvo = data.alvoId ?? eu;");
    /* E a consulta recorta pelo ALVO, não por `eu` — sem isto o parâmetro seria
       aceito e ignorado, que é a pior forma de recurso pela metade. */
    expect(HANDLER).toContain(".eq(coluna, alvo)");
  });

  test("⚠️ e o PORTÃO é `alcancaOPerfil`, o mesmo de `verPerfil`", () => {
    /* Perfil público abre para qualquer uma; fechado, só para quem já foi
       aceita. É literalmente o comportamento do Instagram. */
    expect(HANDLER).toContain("alcancaOPerfil({");
    expect(HANDLER).toContain("perfilPublico: !!(dono as any).perfil_publico");
    expect(HANDLER).toContain("sigoAtivo: ctx.sigo.has(alvo)");
    expect(HANDLER).toContain("somosAmigas: ctx.amigas.has(alvo)");
  });

  test("⚠️ luto, pausa e bloqueio somem — sem contar o motivo", () => {
    /* Os três respondem o MESMO `indisponivel`: contar qual deles foi entregaria
       a perda dela, a pausa dela, ou o bloqueio calado. */
    const i = HANDLER.indexOf("if (alvo !== eu)");
    const portao = HANDLER.slice(i, HANDLER.indexOf("`seguidores` =", i));
    expect(portao).toContain("foraDaRede(dono)");
    expect(portao).toContain("ctx.bloqueio.has(alvo)");
    expect((portao.match(/motivo: "indisponivel" as const/g) ?? []).length).toBe(3);
  });

  test("⚠️ o portão só corre para TERCEIRO — a dona sempre vê a própria", () => {
    expect(HANDLER).toContain("if (alvo !== eu) {");
  });

  test("⚠️ a régua em si: público abre, fechado só para quem entrou", () => {
    const base = { souEu: false, sigoAtivo: false, somosAmigas: false };
    expect(alcancaOPerfil({ ...base, perfilPublico: true })).toBe(true);
    expect(alcancaOPerfil({ ...base, perfilPublico: false })).toBe(false);
    expect(alcancaOPerfil({ ...base, perfilPublico: false, sigoAtivo: true })).toBe(true);
    expect(alcancaOPerfil({ ...base, perfilPublico: false, somosAmigas: true })).toBe(true);
    /* E a dona alcança o próprio, inclusive fechado. */
    expect(alcancaOPerfil({ ...base, perfilPublico: false, souEu: true })).toBe(true);
  });
});

describe("⚠️ a tela oferece o toque em QUALQUER perfil", () => {
  test("⚠️ e não só no meu — era `perfil.souEu ? … : undefined`", () => {
    expect(TELA).toContain("aoAbrirLista={(tipo) => void abrirLista(tipo, perfil.id)}");
    expect(TELA).not.toContain("aoAbrirLista={perfil.souEu ?");
  });

  test("⚠️ a tela NÃO escreve uma segunda régua de visibilidade", () => {
    /* Ela diria "indisponível" sobre um perfil que o servidor abriria — ou o
       contrário, que é pior. */
    const i = TELA.indexOf("async function abrirLista(");
    const corpo = TELA.slice(i, TELA.indexOf("\n  }", i));
    expect(corpo).toContain("alvoId");
    /* ⚠️ Ancorado no PARÊNTESE — o que só existe como CHAMADA. O comentário que
       explica por que a tela não decide escreve `alcancaOPerfil` em crases, e um
       `not.toContain` sem o parêntese fica vermelho por causa da explicação.
       Décima segunda vez que a prosa quebra um teste de texto nesta base. */
    for (const proibido of ["perfil_publico", "alcancaOPerfil(", "publico ?"]) {
      expect(corpo).not.toContain(proibido);
    }
  });

  test("⚠️ o ESPELHO continua desligando o toque", () => {
    /* `agir()` zera toda ação na prévia de "ver como os outros veem" — sem isso
       a tela que se apresenta como inerte abriria uma lista de verdade. */
    expect(TELA).toContain("const abrirLista = agir(aoAbrirLista);");
  });
});
