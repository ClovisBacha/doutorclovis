import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buscarFuncoes,
  CHAVE_DICA,
  CHAVE_VISITADAS,
  DIAS_ENTRE_DICAS,
  dicaDaSemana,
  falaDaDica,
  FUNCOES_DO_APP,
  funcoesVisiveis,
  GRUPOS_DO_MAPA,
  idDaFuncao,
} from "./mapa-do-app";

const conta = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

/** Os rótulos de `TABS`, lidos do fonte — o mapa não pode apontar para aba que não existe. */
function abasDoApp(): Set<string> {
  const i = conta.indexOf("const TABS");
  const j = conta.indexOf("] as const", i);
  const bloco = conta.slice(i, j);
  return new Set([...bloco.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((m) => m[1]));
}

/** As chaves de sub-tela de cada hub, lidas do fonte. */
function subTelasDe(hub: string): Set<string> {
  const i = conta.indexOf(`const ${hub}`);
  const j = conta.indexOf("\n];", i);
  const bloco = conta.slice(i, j);
  return new Set([...bloco.matchAll(/key: "([^"]+)"/g)].map((m) => m[1]));
}

const HUB_DA_ABA: Record<string, string> = {
  Registros: "REGISTROS_SUBTABS",
  Bebê: "BEBE_SUBTABS",
  Consultas: "CONSULTAS_SUBTABS",
  "Bem-estar": "BEMESTAR_SUBTABS",
  Recompensas: "RECOMPENSAS_SUBTABS",
};

const DIA = 86_400_000;
const AGORA = Date.UTC(2026, 8, 4, 12);
const ninguem = new Set<string>();

describe("o catálogo aponta para telas que existem", () => {
  test("toda aba está em TABS", () => {
    const abas = abasDoApp();
    expect(abas.size).toBeGreaterThan(20);
    const fora = FUNCOES_DO_APP.filter((f) => !abas.has(f.tab)).map((f) => `${f.id}→${f.tab}`);
    expect(fora).toEqual([]);
  });

  test("toda sub-tela existe no hub da aba", () => {
    const fora: string[] = [];
    for (const f of FUNCOES_DO_APP) {
      if (!f.sub) continue;
      const hub = HUB_DA_ABA[f.tab];
      if (!hub) {
        fora.push(`${f.id}: a aba ${f.tab} não tem hub conhecido`);
        continue;
      }
      if (!subTelasDe(hub).has(f.sub)) fora.push(`${f.id}→${f.tab}/${f.sub}`);
    }
    expect(fora).toEqual([]);
  });

  test("ids únicos, grupos conhecidos", () => {
    expect(new Set(FUNCOES_DO_APP.map((f) => f.id)).size).toBe(FUNCOES_DO_APP.length);
    const grupos = new Set(GRUPOS_DO_MAPA.map((g) => g.id));
    expect(FUNCOES_DO_APP.filter((f) => !grupos.has(f.grupo))).toEqual([]);
    /* Todo grupo tem pelo menos duas funções — um grupo de uma só é um título
       para uma linha. */
    for (const g of GRUPOS_DO_MAPA) {
      expect(FUNCOES_DO_APP.filter((f) => f.grupo === g.id).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("a dica é falada pela bolha, e segue as regras dela", () => {
  test("nunca cobra, nunca promete clínica", () => {
    const proibido =
      /você (ainda )?não|não perca|falta[m]? |está tudo bem|vai passar|precisa fazer|deveria/i;
    const ruins = FUNCOES_DO_APP.filter((f) => proibido.test(f.dica)).map((f) => f.id);
    expect(ruins).toEqual([]);
  });

  test("cabe num balão", () => {
    for (const f of FUNCOES_DO_APP) {
      expect(f.dica.length).toBeLessThanOrEqual(120);
      expect(f.dica.endsWith("?")).toBe(true);
    }
    const fala = falaDaDica(FUNCOES_DO_APP[0]);
    expect(fala.texto.startsWith("Você sabia? ")).toBe(true);
    expect(fala.aria).toContain(FUNCOES_DO_APP[0].titulo);
  });
});

describe("o Modo Cuidado e a semana recortam", () => {
  test("no luto somem as funções que falam da chegada do bebê", () => {
    const ids = new Set(funcoesVisiveis({ careMode: true, weeks: 30 }).map((f) => f.id));
    for (const proibida of [
      "nome",
      "cha",
      "contagem",
      "enxoval",
      "carta",
      "semana",
      "feed",
      "cantinho",
    ]) {
      expect(ids.has(proibida)).toBe(false);
    }
    /* E ficam as que cuidam DELA: a triagem, a carteirinha, o médico, o apoio. */
    for (const fica of ["sintomas", "carteirinha", "medico", "bem-estar", "album"]) {
      expect(ids.has(fica)).toBe(true);
    }
  });

  test("o pós-parto só abre a partir da 36ª", () => {
    expect(funcoesVisiveis({ careMode: false, weeks: 20 }).some((f) => f.id === "pos-parto")).toBe(
      false,
    );
    expect(funcoesVisiveis({ careMode: false, weeks: 36 }).some((f) => f.id === "pos-parto")).toBe(
      true,
    );
    expect(
      funcoesVisiveis({ careMode: false, weeks: null }).some((f) => f.id === "pos-parto"),
    ).toBe(false);
  });
});

describe("dicaDaSemana", () => {
  test("nunca no Modo Cuidado", () => {
    expect(
      dicaDaSemana({ visitadas: ninguem, careMode: true, weeks: 20, agora: AGORA, ultima: null }),
    ).toBeNull();
  });

  test("uma por semana: dentro dos sete dias, silêncio", () => {
    const ultima = { id: "sons", em: AGORA - 3 * DIA };
    expect(
      dicaDaSemana({ visitadas: ninguem, careMode: false, weeks: 20, agora: AGORA, ultima }),
    ).toBeNull();
    const velha = { id: "sons", em: AGORA - (DIAS_ENTRE_DICAS + 1) * DIA };
    expect(
      dicaDaSemana({ visitadas: ninguem, careMode: false, weeks: 20, agora: AGORA, ultima: velha }),
    ).not.toBeNull();
  });

  test("nunca uma que ela já abriu, nunca a última mostrada", () => {
    const visiveis = funcoesVisiveis({ careMode: false, weeks: 20 });
    const quaseTodas = new Set(visiveis.slice(0, -2).map((f) => f.id));
    const [penultima, ultimaF] = visiveis.slice(-2);
    const d = dicaDaSemana({
      visitadas: quaseTodas,
      careMode: false,
      weeks: 20,
      agora: AGORA,
      ultima: { id: ultimaF.id, em: AGORA - 30 * DIA },
    });
    expect(d?.id).toBe(penultima.id);
  });

  test("tudo aberto: nada a dizer", () => {
    const todas = new Set(FUNCOES_DO_APP.map((f) => f.id));
    expect(
      dicaDaSemana({ visitadas: todas, careMode: false, weeks: 20, agora: AGORA, ultima: null }),
    ).toBeNull();
  });

  test("determinística no dia, e gira pela semana", () => {
    const a = dicaDaSemana({
      visitadas: ninguem,
      careMode: false,
      weeks: 20,
      agora: AGORA,
      ultima: null,
    });
    const b = dicaDaSemana({
      visitadas: ninguem,
      careMode: false,
      weeks: 20,
      agora: AGORA + 3600_000,
      ultima: null,
    });
    expect(a?.id).toBe(b?.id);
    const c = dicaDaSemana({
      visitadas: ninguem,
      careMode: false,
      weeks: 20,
      agora: AGORA + DIAS_ENTRE_DICAS * DIA,
      ultima: null,
    });
    expect(c?.id).not.toBe(a?.id);
  });
});

describe("idDaFuncao e a busca", () => {
  test("o mais específico vence; a aba sem sub cai na entrada sem sub", () => {
    expect(idDaFuncao("Registros", "chutes")).toBe("chutes");
    expect(idDaFuncao("Registros", "diario")).toBe("diario");
    expect(idDaFuncao("Bebê", null)).toBe("semana");
    expect(idDaFuncao("Bem-estar", null)).toBe("bem-estar");
    expect(idDaFuncao("Bem-estar", "sons")).toBe("sons");
    expect(idDaFuncao("Painel", null)).toBeNull();
  });

  test("busca sem acento e sem caixa", () => {
    const l = funcoesVisiveis({ careMode: false, weeks: 20 });
    expect(buscarFuncoes("CARTEIRINHA", l).map((f) => f.id)).toEqual(["carteirinha"]);
    expect(buscarFuncoes("gravar voz", l)).toEqual([]);
    expect(buscarFuncoes("falar", l).map((f) => f.id)).toContain("diario");
    expect(buscarFuncoes("", l).length).toBe(l.length);
  });

  test("as chaves viajam no journey_state", () => {
    expect(CHAVE_VISITADAS.startsWith("dc-path-")).toBe(true);
    expect(CHAVE_DICA.startsWith("dc-path-")).toBe(true);
  });
});
