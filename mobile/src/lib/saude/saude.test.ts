import { describe, expect, test } from "bun:test";
import { contracoesDeExemplo, sessaoEmCursoDeExemplo } from "./bancada";
import {
  chaveDaSessaoDeChutes,
  chutesDeHoje,
  encerrarDescarta,
  isoNormal,
  pacoteDaSessao,
  sanearSessao,
} from "./chutes";
import { fecharContracao, linhasDaLista, novaContracao, resumoDeContracoes } from "./contracoes";
import {
  chaveDaFilaDeChutes,
  chaveDaFilaDeContracoes,
  contracaoPronta,
  ehContracaoPendente,
  ehSessaoPendente,
  filaDoBruto,
  inserirComRecuo,
  sincronizarFila,
  type ContracaoPendente,
} from "./fila";
import { duracaoFalada, numeroBR, relogio } from "./formato";

const UID = "00000000-0000-4000-8000-000000000001";

/** Um disco de mentira, para exercitar o laço de subida. */
function disco<T>(inicial: T[]) {
  let fila = [...inicial];
  return {
    ler: async () => [...fila],
    gravar: async (f: T[]) => {
      fila = [...f];
    },
    agora: () => fila,
    trocar: (f: T[]) => {
      fila = f;
    },
  };
}

const AGORA = new Date(2026, 9, 2, 15, 0, 0).getTime();
const contr = (min: number, fechada = true, tentativas = 0): ContracaoPendente => {
  const ini = AGORA - min * 60000;
  return {
    id: `local-${ini}`,
    started_at: new Date(ini).toISOString(),
    ended_at: fechada ? new Date(ini + 50000).toISOString() : null,
    intensity: 2,
    tentativas,
  };
};

describe("fila offline", () => {
  test("as chaves levam o uid e o prefixo dc-", () => {
    for (const c of [
      chaveDaFilaDeChutes(UID),
      chaveDaFilaDeContracoes(UID),
      chaveDaSessaoDeChutes(UID),
    ]) {
      expect(c.startsWith("dc-")).toBe(true);
      expect(c.endsWith(UID)).toBe(true);
    }
    expect(chaveDaFilaDeChutes(UID)).toBe(`dc-fila-chutes:${UID}`);
    expect(chaveDaFilaDeContracoes(UID)).toBe(`dc-fila-contracoes:${UID}`);
  });

  test("o disco saneia lixo, poda o vencido e ordena", () => {
    const velha = {
      ...contr(0),
      id: "local-1",
      started_at: new Date(AGORA - 9 * 86400000).toISOString(),
    };
    const bruto = [contr(5), { lixo: true }, contr(20), velha, "x"];
    const f = filaDoBruto(bruto, ehContracaoPendente, AGORA);
    expect(f.length).toBe(2);
    expect(new Date(f[0].started_at).getTime()).toBeLessThan(new Date(f[1].started_at).getTime());
    expect(filaDoBruto({ nao: "lista" }, ehContracaoPendente, AGORA)).toEqual([]);
  });

  test("sessão de chutes sem fim não entra na fila", () => {
    expect(
      ehSessaoPendente({
        id: "local-1",
        started_at: "x",
        ended_at: null,
        kick_count: 3,
        strength: 2,
        tentativas: 0,
      }),
    ).toBe(false);
    expect(
      ehSessaoPendente({
        id: "local-1",
        started_at: "x",
        ended_at: "y",
        kick_count: 3,
        strength: 2,
        tentativas: 0,
      }),
    ).toBe(true);
    expect(
      ehSessaoPendente({
        id: "uuid",
        started_at: "x",
        ended_at: "y",
        kick_count: 3,
        strength: 2,
        tentativas: 0,
      }),
    ).toBe(false);
  });

  test("sobe as encerradas e deixa a aberta", async () => {
    const d = disco([contr(30), contr(10), contr(1, false)]);
    const inseridas: string[] = [];
    const r = await sincronizarFila({
      ler: d.ler,
      gravar: d.gravar,
      pronto: contracaoPronta,
      conferir: async () => "nao-esta",
      inserir: async (p) => {
        inseridas.push(p.started_at);
        return true;
      },
      agora: () => AGORA,
    });
    expect(r.subiram).toBe(2);
    expect(inseridas.length).toBe(2);
    expect(d.agora().length).toBe(1);
    expect(d.agora()[0].ended_at).toBeNull();
  });

  test("falha no insert fica na fila com a tentativa marcada", async () => {
    const d = disco([contr(10)]);
    await sincronizarFila({
      ler: d.ler,
      gravar: d.gravar,
      pronto: contracaoPronta,
      conferir: async () => "nao-esta",
      inserir: async () => false,
      agora: () => AGORA,
    });
    expect(d.agora().length).toBe(1);
    expect(d.agora()[0].tentativas).toBe(1);
  });

  test("da 2ª tentativa em diante confere por started_at e não duplica", async () => {
    const d = disco([contr(10, true, 1)]);
    let inseriu = false;
    const r = await sincronizarFila({
      ler: d.ler,
      gravar: d.gravar,
      pronto: contracaoPronta,
      conferir: async () => "ja-esta",
      inserir: async () => {
        inseriu = true;
        return true;
      },
      agora: () => AGORA,
    });
    expect(inseriu).toBe(false);
    expect(d.agora().length).toBe(0);
    expect(r.subiram).toBe(1);
  });

  test("falha ao conferir não insere (adiar é melhor que duplicar)", async () => {
    const d = disco([contr(10, true, 2)]);
    let inseriu = false;
    await sincronizarFila({
      ler: d.ler,
      gravar: d.gravar,
      pronto: contracaoPronta,
      conferir: async () => "falhou",
      inserir: async () => {
        inseriu = true;
        return true;
      },
      agora: () => AGORA,
    });
    expect(inseriu).toBe(false);
    expect(d.agora().length).toBe(1);
  });

  test("na 1ª tentativa não confere", async () => {
    const d = disco([contr(10)]);
    let conferiu = false;
    await sincronizarFila({
      ler: d.ler,
      gravar: d.gravar,
      pronto: contracaoPronta,
      conferir: async () => {
        conferiu = true;
        return "nao-esta";
      },
      inserir: async () => true,
      agora: () => AGORA,
    });
    expect(conferiu).toBe(false);
  });

  test("uma contração nova começada durante a subida não é apagada", async () => {
    const d = disco([contr(10)]);
    const nova = contr(0, false);
    await sincronizarFila({
      ler: d.ler,
      gravar: d.gravar,
      pronto: contracaoPronta,
      conferir: async () => "nao-esta",
      inserir: async () => {
        d.trocar([...d.agora(), nova]);
        return true;
      },
      agora: () => AGORA,
    });
    expect(d.agora().map((c) => c.id)).toEqual([nova.id]);
  });

  test("sem a coluna strength (PGRST204), repete sem ela", async () => {
    const chamadas: Record<string, unknown>[] = [];
    const r = await inserirComRecuo(
      async (linha) => {
        chamadas.push(linha);
        return { error: "strength" in linha ? { code: "PGRST204" } : null };
      },
      { user_id: UID, kick_count: 10, strength: 2 },
      "strength",
    );
    expect(r.error).toBeNull();
    expect(chamadas.length).toBe(2);
    expect("strength" in chamadas[1]).toBe(false);
    expect(chamadas[1].kick_count).toBe(10);
  });

  test("outro erro não repete", async () => {
    let n = 0;
    const r = await inserirComRecuo(
      async () => {
        n++;
        return { error: { code: "42501" } };
      },
      { strength: 2 },
      "strength",
    );
    expect(n).toBe(1);
    expect(r.error?.code).toBe("42501");
  });
});

describe("contagem de movimentos", () => {
  test("sessão vence em 4 h, e no futuro também", () => {
    const ini = new Date(AGORA - 30 * 60000).toISOString();
    expect(sanearSessao({ startedAt: ini, count: 3 }, AGORA)?.count).toBe(3);
    expect(
      sanearSessao({ startedAt: new Date(AGORA - 5 * 3600000).toISOString(), count: 3 }, AGORA),
    ).toBeNull();
    expect(
      sanearSessao({ startedAt: new Date(AGORA + 3600000).toISOString(), count: 3 }, AGORA),
    ).toBeNull();
    expect(sanearSessao({ count: 3 }, AGORA)).toBeNull();
    expect(sanearSessao(null, AGORA)).toBeNull();
  });

  test("força fora do catálogo vira 'não marcou', nunca 'como sempre'", () => {
    const ini = new Date(AGORA - 60000).toISOString();
    expect(sanearSessao({ startedAt: ini, count: 1, forca: 9 }, AGORA)?.forca).toBeUndefined();
    expect(sanearSessao({ startedAt: ini, count: 1, forca: 1 }, AGORA)?.forca).toBe(1);
  });

  test("o pacote nasce encerrado, com id local e o padrão de força", () => {
    const ini = new Date(AGORA - 18 * 60000).toISOString();
    const p = pacoteDaSessao({ startedAt: ini, count: 10 }, AGORA, 2);
    expect(ehSessaoPendente(p)).toBe(true);
    expect(p.strength).toBe(2);
    expect(p.started_at).toBe(ini);
    expect(p.tentativas).toBe(0);
  });

  test("zero movimentos antes de 2 h descarta; zero em 2 h é dado e sobe", () => {
    expect(
      encerrarDescarta({ startedAt: new Date(AGORA - 60000).toISOString(), count: 0 }, AGORA),
    ).toBe(true);
    expect(
      encerrarDescarta({ startedAt: new Date(AGORA - 121 * 60000).toISOString(), count: 0 }, AGORA),
    ).toBe(false);
    expect(
      encerrarDescarta({ startedAt: new Date(AGORA - 60000).toISOString(), count: 1 }, AGORA),
    ).toBe(false);
  });

  test("chutes de hoje somam só o que começou hoje", () => {
    const hoje = new Date(2026, 9, 2, 8, 0).toISOString();
    const ontem = new Date(2026, 9, 1, 22, 0).toISOString();
    expect(
      chutesDeHoje(
        [
          { started_at: hoje, ended_at: hoje, kick_count: 12 },
          { started_at: ontem, ended_at: ontem, kick_count: 10 },
        ],
        AGORA,
      ),
    ).toBe(12);
  });

  test("o started_at do servidor e o do aparelho se reconhecem", () => {
    expect(isoNormal("2026-10-02T18:15:03.123+00:00")).toBe("2026-10-02T18:15:03.123Z");
  });

  test("a bancada não tem mais contagem 'em alerta': o app não julga a contagem", () => {
    const agora = Date.now();
    expect(sessaoEmCursoDeExemplo(agora, "alerta")).toBeNull();
    expect(sessaoEmCursoDeExemplo(agora, "contando")?.count).toBe(6);
  });
});

describe("contrações", () => {
  test("a bancada traz três de hoje e duas de ontem, sem régua nenhuma", () => {
    const agora = Date.now();
    const lista = contracoesDeExemplo(agora);
    expect(lista.length).toBe(5);
    expect(resumoDeContracoes(lista, agora)).toMatch(/^3 hoje · última às \d\d:\d\d$/);
  });

  test("nasce aberta no aparelho e fecha com a intensidade", () => {
    const c = novaContracao(AGORA);
    expect(ehContracaoPendente(c)).toBe(true);
    expect(contracaoPronta(c)).toBe(false);
    const f = fecharContracao(c, AGORA + 62000, 3);
    expect(contracaoPronta(f)).toBe(true);
    expect(f.intensity).toBe(3);
  });

  test("a lista mede de início a início, e a mais recente vem primeiro", () => {
    const a = {
      id: "a",
      started_at: new Date(AGORA - 600000).toISOString(),
      ended_at: new Date(AGORA - 540000).toISOString(),
      intensity: 2,
    };
    const b = {
      id: "b",
      started_at: new Date(AGORA - 300000).toISOString(),
      ended_at: new Date(AGORA - 255000).toISOString(),
      intensity: 3,
    };
    const linhas = linhasDaLista([a, b]);
    expect(linhas[0].id).toBe("b");
    expect(linhas[0].intervaloSeg).toBe(300);
    expect(linhas[0].duracaoSeg).toBe(45);
    expect(linhas[0].intensidade).toBe("Forte");
    expect(linhas[1].intervaloSeg).toBeNull();
  });

  test("o resumo do hub conta as de hoje e diz a hora da última", () => {
    const h = (hh: number, mm: number, dia = 2) => ({
      id: `${hh}${mm}`,
      started_at: new Date(2026, 9, dia, hh, mm).toISOString(),
      ended_at: null,
      intensity: 2,
    });
    expect(resumoDeContracoes([h(9, 5), h(14, 20), h(11, 40), h(22, 0, 1)], AGORA)).toBe(
      "3 hoje · última às 14:20",
    );
    expect(resumoDeContracoes([h(22, 0, 1)], AGORA)).toBeNull();
  });
});

describe("formato", () => {
  test("número, relógio e duração", () => {
    expect(numeroBR(68.4)).toBe("68,4");
    expect(numeroBR(68)).toBe("68");
    expect(relogio(65000)).toBe("01:05");
    expect(relogio(3725000)).toBe("1:02:05");
    expect(duracaoFalada(45)).toBe("45 s");
    expect(duracaoFalada(65)).toBe("1 min 05 s");
    expect(duracaoFalada(18 * 60)).toBe("18 min");
  });
});

describe("os sinais do SOS", () => {
  test("na gestação, todos; no Modo Cuidado e depois do parto, sem os da gestação", async () => {
    const { sinaisDeSocorro } = await import("./triagem-local");
    const ids = (o: { cuidado: boolean; nasceu: boolean }) => sinaisDeSocorro(o).map((s) => s.id);
    expect(ids({ cuidado: false, nasceu: false })).toContain("movimentos");
    for (const o of [
      { cuidado: true, nasceu: false },
      { cuidado: false, nasceu: true },
    ]) {
      expect(ids(o)).not.toContain("movimentos");
      expect(ids(o)).not.toContain("contracoes");
      expect(ids(o)).toContain("sangramento");
    }
  });
});
