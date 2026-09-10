/**
 * A RÉGUA DA SAÚDE DA FILA CLÍNICA — testada por COMPORTAMENTO.
 *
 * ⚠️ Estas decisões viviam dentro do handler, e ali a única forma de cobrá-las
 * seria procurar o texto do arquivo. Aqui cada desfecho é EXECUTADO — inclusive
 * o que a leva de set/2026 destapou: a view velha que deixa as doze fontes
 * verdes e o campo clínico calado.
 */
import { describe, expect, test } from "bun:test";

import {
  CAMPOS_CLINICOS,
  conferidas,
  estadoDaFonte,
  estadoDoCampo,
  FONTES_CLINICAS,
  podeDizerQueEstaCerto,
  type Sonda,
} from "@/lib/saude-clinica";

const tem = (n: number): Sonda => ({ n, ausente: false, semColuna: false });
const semTabela: Sonda = { n: null, ausente: true, semColuna: false };
const semColuna: Sonda = { n: null, ausente: false, semColuna: true };
const ilegivel: Sonda = { n: null, ausente: false, semColuna: false };

describe("a fonte está na view?", () => {
  test("tem linha e a view devolve → ok", () => {
    expect(estadoDaFonte(tem(37), tem(37), true)).toBe("ok");
  });

  test("⚠️ tem linha e a view NÃO devolve → fora_da_view (view velha)", () => {
    expect(estadoDaFonte(tem(37), tem(0), true)).toBe("fora_da_view");
  });

  test("⚠️ tabela vazia NUNCA vira ok — não prova nada sobre a view", () => {
    expect(estadoDaFonte(tem(0), tem(0), true)).toBe("indeterminado");
  });

  test("⚠️ leitura que falhou NUNCA vira ok", () => {
    expect(estadoDaFonte(ilegivel, tem(9), true)).toBe("ilegivel");
    expect(estadoDaFonte(tem(9), ilegivel, true)).toBe("ilegivel");
  });

  test("sem a view, nada abaixo dela vale", () => {
    expect(estadoDaFonte(tem(9), ilegivel, false)).toBe("ilegivel");
  });

  test("tabela ausente é OUTRA pendência que leitura falhada", () => {
    expect(estadoDaFonte(semTabela, ilegivel, true)).toBe("ausente");
  });
});

describe("a view projeta o campo?", () => {
  test("⚠️ O CASO QUE MOTIVOU ISTO: a fonte prova ok e o campo prova view velha", () => {
    /* `kick_sessions` está na view desde jul/2026 — a comparação fonte-a-fonte
       responde `ok` com a view antiga. Só a do CAMPO acusa. */
    expect(estadoDaFonte(tem(92), tem(92), true)).toBe("ok");
    expect(estadoDoCampo(tem(92), tem(0), true)).toBe("fora_da_view");
  });

  test("a view traz o campo → ok", () => {
    expect(estadoDoCampo(tem(92), tem(88), true)).toBe("ok");
  });

  test("⚠️ nenhuma linha ainda produz o campo NUNCA vira ok", () => {
    expect(estadoDoCampo(tem(0), tem(0), true)).toBe("indeterminado");
  });

  test("⚠️ coluna de origem ausente é uma pendência PRÓPRIA, não view velha", () => {
    /* Confundir as duas mandaria o dono rodar o arquivo errado e concluir que
       a tela mente. */
    expect(estadoDoCampo(semColuna, tem(0), true)).toBe("coluna_ausente");
  });

  test("⚠️ a ordem é a do CONSERTO: sem a tabela não se fala da coluna", () => {
    const semAsDuas: Sonda = { n: null, ausente: true, semColuna: true };
    expect(estadoDoCampo(semAsDuas, ilegivel, true)).toBe("tabela_ausente");
  });

  test("⚠️ leitura que falhou NUNCA vira ok, nos dois lados", () => {
    expect(estadoDoCampo(ilegivel, tem(9), true)).toBe("ilegivel");
    expect(estadoDoCampo(tem(9), ilegivel, true)).toBe("ilegivel");
    /* Se o PostgREST recusar o filtro de jsonb, cai aqui — nunca em "ok". */
    expect(estadoDoCampo(tem(9), ilegivel, false)).toBe("ilegivel");
  });
});

describe("o catálogo dos campos", () => {
  test("⚠️ `colunaDaTabela` é a coluna de ORIGEM, nunca o nome do campo", () => {
    /* `duracao_min` não existe em `kick_sessions`: ele nasce de
       `ended_at - started_at` na própria view. Sondar pelo nome do campo seria
       sondar uma coluna que nunca existiu — e devolver `coluna_ausente` para
       sempre. */
    for (const c of CAMPOS_CLINICOS) {
      expect(c.colunaDaTabela).not.toBe(c.campo);
    }
  });

  test("os dois campos da leva de set/2026 estão cobertos", () => {
    const chaves = CAMPOS_CLINICOS.map((c) => `${c.fonte}.${c.campo}`);
    expect(chaves).toContain("kick_sessions.duracao_min");
    expect(chaves).toContain("kick_sessions.forca");
  });

  test("⚠️ todo campo aponta para uma fonte que a view de fato une", () => {
    const fontes = new Set<string>(FONTES_CLINICAS.map((f) => f.tabela));
    for (const c of CAMPOS_CLINICOS) expect(fontes.has(c.fonte)).toBe(true);
  });

  test("só a `forca` tem SQL de coluna própria — a duração é calculada na view", () => {
    const forca = CAMPOS_CLINICOS.find((c) => c.campo === "forca");
    const duracao = CAMPOS_CLINICOS.find((c) => c.campo === "duracao_min");
    expect(forca?.sqlDaColuna).toBe("APLICAR_FORCA_DO_MOVIMENTO.sql");
    expect(duracao?.sqlDaColuna).toBeNull();
  });
});

describe("a tela pode dizer que está tudo certo?", () => {
  const base = { viewExiste: true, foraDaView: 0, camposForaDaView: 0 };

  test("as duas comparações limpas, e a view de pé", () => {
    expect(podeDizerQueEstaCerto(base)).toBe(true);
  });

  test("⚠️ um CAMPO fora da view cala a caixa verde", () => {
    /* Sem isto, o verde apareceria a um centímetro do alarme vermelho. */
    expect(podeDizerQueEstaCerto({ ...base, camposForaDaView: 1 })).toBe(false);
  });

  test("uma FONTE fora da view cala a caixa verde", () => {
    expect(podeDizerQueEstaCerto({ ...base, foraDaView: 1 })).toBe(false);
  });

  test("sem a view não há o que aprovar", () => {
    expect(podeDizerQueEstaCerto({ ...base, viewExiste: false })).toBe(false);
  });
});

describe("quantas comparações provaram alguma coisa", () => {
  const f = (estado: string) => ({ tabela: "t", nome: "n", peso: "p", estado }) as any;
  const c = (estado: string) =>
    ({ fonte: "f", campo: "k", nome: "n", peso: "p", sqlDaColuna: null, estado }) as any;

  test("⚠️ `indeterminado` NÃO conta — é assim que uma base vazia vira um verde", () => {
    const d = {
      fontes: [f("ok"), f("indeterminado"), f("ausente"), f("ilegivel")],
      campos: [c("indeterminado"), c("coluna_ausente")],
    };
    expect(conferidas(d)).toEqual({ fontes: 1, campos: 0 });
  });

  test("`fora_da_view` conta: ele provou — provou que está errado", () => {
    const d = { fontes: [f("fora_da_view")], campos: [c("fora_da_view"), c("ok")] };
    expect(conferidas(d)).toEqual({ fontes: 1, campos: 2 });
  });
});
