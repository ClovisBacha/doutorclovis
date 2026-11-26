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
/**
 * ⚠️ As QUATRO grades de sub-telas e o HUB DA SAÚDE saíram de `minha-conta.tsx`
 * (set/2026): eram `export const`/`export function` num arquivo de ROTA, e isso
 * os içava para o pedaço de ENTRADA que toda página do site baixa.
 *
 * ⚠️ **E os três fontes são lidos JUNTOS de propósito.** A varredura de baixo
 * deriva as chaves que o luto tira do FILTRO escrito nas grades — lendo só a
 * conta ela passaria a enxergar uma grade em vez de duas, e a comparação das
 * três listas ficaria frouxa exatamente onde ela existe para ser apertada.
 */
const grades = readFileSync("src/components/grades-das-abas.tsx", "utf8");
const hubSaude = readFileSync("src/components/hub-saude.tsx", "utf8");
const fontes = conta + "\n" + grades + "\n" + hubSaude;

/** Os rótulos de `TABS`, lidos do fonte — o mapa não pode apontar para aba que não existe. */
function abasDoApp(): Set<string> {
  const i = conta.indexOf("const TABS");
  const j = conta.indexOf("] as const", i);
  const bloco = conta.slice(i, j);
  return new Set([...bloco.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((m) => m[1]));
}

/** As chaves de sub-tela de cada hub, lidas do fonte. */
function subTelasDe(hub: string): Set<string> {
  const i = fontes.indexOf(`const ${hub}`);
  /* ⚠️ Âncora que não casa devolve −1, e a fatia sairia quase vazia: o hub
     apareceria SEM sub-telas e as asserções passariam em branco. */
  expect(i).toBeGreaterThan(-1);
  const j = fontes.indexOf("\n]", i);
  const bloco = fontes.slice(i, j);
  return new Set([...bloco.matchAll(/key: "([^"]+)"/g)].map((m) => m[1]));
}

const HUB_DA_ABA: Record<string, string> = {
  "Meu dia a dia": "REGISTROS_SUBTABS",
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
    expect(idDaFuncao("Meu dia a dia", "chutes")).toBe("chutes");
    expect(idDaFuncao("Meu dia a dia", "diario")).toBe("diario");
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

describe("o mapa e as grades concordam sobre o que some no luto", () => {
  /**
   * ⚠️ **O MAPA ESCONDIA O CRONÔMETRO DE CONTRAÇÕES NO MODO CUIDADO — contra as
   * DUAS grades que o mantêm.** As grades filtram uma chave só
   * (`careMode && i.key === "chutes"`), pela razão escrita: quem perdeu a
   * gestação PODE ESTAR EM TRABALHO DE PARTO. O mapa marcava `noLuto: false` em
   * `contracoes` e tirava do luto justamente o cronômetro daquela noite.
   *
   * São três listas que precisam concordar (as duas grades e o mapa), e é a
   * mais nova que divergiu — que é sempre como isto acontece.
   */
  const chavesFiltradasNasGrades = () => {
    const chaves = new Set<string>();
    for (const m of fontes.matchAll(/careMode && i\.key === "([^"]+)"/g)) chaves.add(m[1]);
    return chaves;
  };

  test("as grades filtram exatamente as chaves que o mapa esconde", () => {
    const filtradas = chavesFiltradasNasGrades();
    /* Se o filtro das grades mudar de forma, este teste fica vazio e passaria
       em branco — a contagem é o que impede isso. */
    expect(filtradas.size).toBeGreaterThan(0);

    /* Só as funções que as grades de fato desenham entram na comparação:
       o mapa lista telas que não têm ladrilho nenhum. */
    const doHub = FUNCOES_DO_APP.filter((f) => f.sub != null && f.tab === "Meu dia a dia");
    expect(doHub.length).toBeGreaterThan(1);
    for (const f of doHub) {
      const escondidaNaGrade = filtradas.has(f.sub!);
      expect({ id: f.id, escondida: !f.noLuto }).toEqual({
        id: f.id,
        escondida: escondidaNaGrade,
      });
    }
  });

  test("⚠️ e o cronômetro de contrações continua alcançável no luto", () => {
    /* A asserção nomeada, porque este é o caso que custou: um cronômetro de
       trabalho de parto sumindo de quem pode estar em trabalho de parto. */
    const visiveis = funcoesVisiveis({ careMode: true, weeks: 30 }).map((f) => f.id);
    expect(visiveis).toContain("contracoes");
    expect(visiveis).not.toContain("chutes");
  });
});

describe("o rodapé do mapa conta a lista que ela está vendo", () => {
  test("⚠️ o total é o das VISÍVEIS, nunca o do catálogo", () => {
    /* Era `FUNCOES_DO_APP.length` — trinta e cinco anunciadas embaixo de vinte
       no Modo Cuidado, na tela que existe para dizer o que o app faz. */
    const tela = readFileSync("src/components/mapa-do-app.tsx", "utf8");
    const i = tela.indexOf("funções ·");
    expect(i).toBeGreaterThan(-1);
    const rodape = tela.slice(i - 200, i + 120);
    expect(rodape).toContain("{visiveis.length} funções");
    expect(rodape).not.toContain("FUNCOES_DO_APP.length");
  });

  test("e a lista de fato encolhe no luto — senão o conserto não teria efeito", () => {
    const cheia = funcoesVisiveis({ careMode: false, weeks: 30 }).length;
    const luto = funcoesVisiveis({ careMode: true, weeks: 30 }).length;
    expect(luto).toBeLessThan(cheia);
  });
});
