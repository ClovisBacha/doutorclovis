/**
 * QUINZE ABAS VIRAM CINCO SEM PERDER NENHUMA TELA.
 *
 * ─── O RISCO REAL DESTA MUDANÇA ─────────────────────────────────────────────
 *
 * Fundir abas parece cosmético e não é. Duas coisas podem sumir no caminho, e
 * as duas são invisíveis em revisão:
 *
 *  1. uma TELA que fica sem grupo — implementada, renderizável e inalcançável.
 *     Esta base já teve quatro assim, inclusive a única de receituário;
 *  2. um CONTADOR que fica sem dono. Hoje o número em "Perguntas" é o que faz
 *     o médico ir até lá. Se ele não subir para o grupo, a fusão que era para
 *     revelar as telas passa a esconder o sinal que fazia alguém abri-las.
 *
 * É isso que este arquivo cobra — não o desenho.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  FORA_DA_FITA,
  GRUPOS,
  PANEL_TABS,
  abaDeEntradaDoGrupo,
  abasNaFita,
  grupoDe,
  somaDoGrupo,
} from "./abas-do-painel";

describe("1. o pedido do dono: no máximo cinco", () => {
  test("são cinco grupos", () => {
    expect(GRUPOS.length).toBeLessThanOrEqual(5);
    expect(GRUPOS.length).toBe(5);
  });

  test("e o Cérebro é o primeiro", () => {
    /* Decisão de produto, não de layout: o painel de números diz o que
       ACONTECEU; o cérebro é onde ele MUDA o que vai acontecer. */
    expect(GRUPOS[0].chave).toBe("cerebro");
  });
});

describe("2. nenhuma tela fica sem caminho", () => {
  test("toda aba está num grupo OU declarada fora da fita", () => {
    const semCaminho = PANEL_TABS.filter((t) => !grupoDe(t) && !FORA_DA_FITA.includes(t));
    expect(semCaminho).toEqual([]);
  });

  test("as que ficam fora da fita são só as duas do menu do perfil", () => {
    /* "Fora da fita" não pode virar um saco onde se joga o que não coube: são
       exatamente as duas que o menu da bolinha alcança. */
    expect([...FORA_DA_FITA].sort()).toEqual(["Clínica 🏥", "Meu Perfil"]);
  });

  test("nenhuma aba aparece em dois grupos", () => {
    /**
     * Duas casas para a mesma tela significa dois lugares onde ela pode ser
     * atualizada — e a fita destacaria o grupo errado dependendo de qual
     * `setTab` a levou até lá.
     */
    const vistas = abasNaFita();
    expect(vistas.length).toBe(new Set(vistas).size);
  });

  test("e nenhum grupo está vazio", () => {
    for (const g of GRUPOS) expect(g.filhas.length).toBeGreaterThan(0);
  });

  test("todo nome de filha é uma aba que existe de verdade", () => {
    /* Um typo aqui ("Exame" em vez de "Exames") criaria um grupo apontando
       para o nada: o botão existe, o corpo não renderiza, e não há erro. */
    for (const g of GRUPOS) {
      for (const f of g.filhas) expect(PANEL_TABS).toContain(f);
    }
  });
});

describe("3. o grupo é DERIVADO da aba — não é um segundo estado", () => {
  test("cada aba da fita resolve para o grupo que a contém", () => {
    for (const g of GRUPOS) {
      for (const f of g.filhas) expect(grupoDe(f)).toBe(g.chave);
    }
  });

  test("as de fora da fita não resolvem para grupo nenhum", () => {
    for (const t of FORA_DA_FITA) expect(grupoDe(t)).toBeNull();
  });

  test("cada grupo abre na primeira filha", () => {
    for (const g of GRUPOS) expect(abaDeEntradaDoGrupo(g.chave)).toBe(g.filhas[0]);
  });

  test("um grupo inexistente falha ALTO, não devolve undefined", () => {
    /**
     * A alternativa seria `!` e um `undefined` virando `tab` — tela em branco
     * sem erro nenhum, que é o defeito mais caro de achar depois.
     */
    // @ts-expect-error — de propósito: o teste é sobre o caminho de erro
    expect(() => abaDeEntradaDoGrupo("inexistente")).toThrow();
  });
});

describe("4. o contador sobe para o grupo", () => {
  test("a soma junta as filhas", () => {
    /* Pacientes = Pacientes + Pré-consultas + Exames. */
    expect(somaDoGrupo("pacientes", { "Pacientes 👩‍🍼": 2, "Pré-consultas": 3, Exames: 1 })).toBe(6);
  });

  test("aba sem contador conta zero, não estraga a soma", () => {
    expect(somaDoGrupo("pacientes", { Exames: 4 })).toBe(4);
    expect(somaDoGrupo("pacientes", {})).toBe(0);
  });

  test("o contador de Perguntas chega em Cérebro — o caso que motivou tudo", () => {
    /**
     * É a asserção que descreve o defeito da fusão. "Perguntas" tinha o número
     * que fazia o médico clicar; empurrada para dentro de Cérebro, o número
     * sumiria da fita. Se esta linha cair, a fusão está escondendo trabalho.
     */
    expect(somaDoGrupo("cerebro", { Perguntas: 7 })).toBe(7);
  });

  test("e um contador de OUTRO grupo não vaza para este", () => {
    /* Somar tudo indiscriminadamente daria o mesmo número em todos os grupos —
       cinco emblemas iguais não dizem nada. */
    expect(somaDoGrupo("cerebro", { Exames: 9 })).toBe(0);
  });
});

describe("5. e o painel de fato ENTREGA os contadores", () => {
  /**
   * `somaDoGrupo` estar certa não serve de nada se ninguém lhe passar números.
   *
   * Esta era a lacuna que um mutante encontrou: apagar `Perguntas: pendingQs`
   * do painel deixava tudo verde — a função somava corretamente um objeto
   * vazio. O emblema sumia da fita, que é exatamente o defeito que a fusão
   * podia introduzir e que estes testes existem para impedir.
   */
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
  const bloco = painel.slice(
    painel.indexOf("<AbasDoPainel"),
    painel.indexOf("<AbasDoPainel") + 900,
  );

  test("a fita é montada com o estado da aba atual", () => {
    expect(bloco).toContain("aba={tab}");
    expect(bloco).toContain("onEscolher={setTab}");
  });

  for (const [aba, fonte] of [
    ["Perguntas", "pendingQs"],
    ["Pacientes 👩‍🍼", "novasPacientes"],
    ["Pré-consultas", "unseenForms"],
    ["Teleconsultas", "sala_aberta"],
  ] as const) {
    test(`o contador de «${aba}» chega à fita`, () => {
      expect(bloco).toContain(fonte);
    });
  }
});
