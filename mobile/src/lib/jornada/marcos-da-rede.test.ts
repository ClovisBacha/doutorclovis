import { describe, expect, test } from "bun:test";
import { MARCOS_DA_REDE, marcosFeitosAgora, marcosNaTela } from "~/lib/jornada/marcos-da-rede";

const nada = { amigas: 0, recordeDaDupla: 0, convites: 0, publicacoes: 0 };

describe("os marcos da rede", () => {
  test("cada marco pelo ato que o nome diz", () => {
    expect(marcosFeitosAgora(nada)).toEqual([]);
    expect(marcosFeitosAgora({ ...nada, amigas: 1 })).toEqual(["primeira-amiga"]);
    expect(marcosFeitosAgora({ ...nada, amigas: 3 })).toEqual(["primeira-amiga", "roda-de-amigas"]);
    expect(marcosFeitosAgora({ ...nada, convites: 1 })).toEqual(["convite-aceito"]);
    expect(marcosFeitosAgora({ ...nada, recordeDaDupla: 7 })).toEqual([
      "dupla-acesa",
      "uma-semana-juntas",
    ]);
    expect(marcosFeitosAgora({ ...nada, publicacoes: 1 })).toEqual(["primeira-publicacao"]);
  });

  test("leitura que falhou não faz nem desfaz marco", () => {
    expect(
      marcosFeitosAgora({ amigas: null, recordeDaDupla: null, convites: null, publicacoes: null }),
    ).toEqual([]);
    const tela = marcosNaTela({ agora: [], guardados: ["primeira-amiga"], pos: false });
    expect(tela.find((m) => m.chave === "primeira-amiga")?.ganho).toBe(true);
  });

  test("marco ganho não se perde, e só é novo na primeira vez", () => {
    const tela = marcosNaTela({
      agora: ["primeira-amiga"],
      guardados: ["dupla-acesa"],
      pos: false,
    });
    expect(tela.find((m) => m.chave === "dupla-acesa")).toMatchObject({ ganho: true, novo: false });
    expect(tela.find((m) => m.chave === "primeira-amiga")).toMatchObject({
      ganho: true,
      novo: true,
    });
    expect(tela.find((m) => m.chave === "convite-aceito")).toMatchObject({
      ganho: false,
      novo: false,
    });
  });

  test("no pós-parto, os da dupla só aparecem se já foram ganhos", () => {
    const sem = marcosNaTela({ agora: [], guardados: [], pos: true }).map((m) => m.chave);
    expect(sem).not.toContain("dupla-acesa");
    expect(sem).not.toContain("uma-semana-juntas");
    const com = marcosNaTela({ agora: [], guardados: ["dupla-acesa"], pos: true }).map(
      (m) => m.chave,
    );
    expect(com).toContain("dupla-acesa");
    expect(com).not.toContain("uma-semana-juntas");
  });

  test("nenhum marco conta seguidoras, nem fala de saúde ou dá gênero ao bebê", () => {
    for (const m of MARCOS_DA_REDE) {
      expect(`${m.titulo} ${m.texto}`).not.toMatch(/seguidor|curtid|famosa|placar/i);
      expect(`${m.titulo} ${m.texto}`).not.toMatch(/saúde|médic|consulta|\bele\b|\bdele\b/i);
    }
  });
});

describe("os marcos na aba das Conquistas", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const RAIZ = join(import.meta.dir, "..", "..");
  const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");

  test("depois das conquistas do servidor, e calados no Modo Cuidado (a aba inteira se cala antes)", () => {
    const aba = ler("componentes", "recompensas", "conquistas.tsx");
    const silencio = aba.indexOf("return <SilencioDoCuidado />;");
    const marcos = aba.indexOf("<MarcosDaRede />");
    expect(silencio).toBeGreaterThan(0);
    expect(marcos).toBeGreaterThan(silencio);
  });

  test("a tela diz que não valem sementinhas, e guarda o que foi ganho por conta (dc-)", () => {
    const tela = ler("componentes", "recompensas", "marcos-da-rede.tsx");
    expect(tela).toContain("Estes não valem sementinhas");
    expect(tela).toContain("`dc-marcos-da-rede:${uid}`");
    expect(tela).not.toMatch(/resgatarConquista|grantWellnessReward|sementinhas_ledger/);
  });
});
