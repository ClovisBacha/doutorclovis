/**
 * A HOME PINTA DO APARELHO ANTES DE A REDE RESPONDER — e só para quem pode.
 *
 * ⚠️ O retrato segue a MESMA regra do `liberarCedo`: paciente com âncora
 * gestacional e sem marca de médico. Fora disso ele não grava e não pinta.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  PREFIXO_RETRATO_DA_HOME,
  apagarRetratoDaHome,
  chaveDoRetrato,
  gravarRetratoDaHome,
  lerRetratoDaHome,
  podePintarDoRetrato,
  temAncoraGestacional,
} from "@/lib/retrato-da-home";

function armazemFalso() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    tamanho: () => m.size,
  };
}

const ANA = { id: "ana", full_name: "Ana", lmp_date: "2026-05-01", care_mode: false };

describe("a regra de quem pinta", () => {
  test("DUM, DPP ou ultrassom são âncora; nada disso não é", () => {
    expect(temAncoraGestacional({ lmp_date: "2026-05-01" })).toBe(true);
    expect(temAncoraGestacional({ due_date: "2027-02-05" })).toBe(true);
    expect(temAncoraGestacional({ reference_date: "2026-08-01" })).toBe(true);
    expect(temAncoraGestacional({ full_name: "Ana" })).toBe(false);
    expect(temAncoraGestacional(null)).toBe(false);
  });

  test("⚠️ a marca de médico na sessão barra o retrato, mesmo com âncora", () => {
    expect(podePintarDoRetrato(ANA, false)).toBe(true);
    expect(podePintarDoRetrato(ANA, true)).toBe(false);
    expect(podePintarDoRetrato({ id: "x" }, false)).toBe(false);
  });
});

describe("gravar e ler", () => {
  test("ida e volta, na chave da conta", () => {
    const s = armazemFalso();
    gravarRetratoDaHome("ana", ANA, s);
    expect(s.getItem(chaveDoRetrato("ana"))).toBeTruthy();
    expect(chaveDoRetrato("ana").startsWith(PREFIXO_RETRATO_DA_HOME)).toBe(true);
    expect(lerRetratoDaHome("ana", s)).toEqual(ANA);
  });

  test("⚠️ sem âncora não grava — a home dela é o ritual, não a semana", () => {
    const s = armazemFalso();
    gravarRetratoDaHome("bia", { id: "bia", full_name: "Bia" }, s);
    expect(s.tamanho()).toBe(0);
  });

  test("⚠️ a linha de OUTRA conta não entra nem sai", () => {
    const s = armazemFalso();
    gravarRetratoDaHome("ana", { ...ANA, id: "outra" }, s);
    expect(s.tamanho()).toBe(0);
    /* E mesmo que alguém grave à mão, a leitura confere o id. */
    s.setItem(
      chaveDoRetrato("ana"),
      JSON.stringify({ v: 1, em: 1, perfil: { ...ANA, id: "outra" } }),
    );
    expect(lerRetratoDaHome("ana", s)).toBeNull();
  });

  test("forma estranha, versão velha ou JSON quebrado valem nada", () => {
    const s = armazemFalso();
    s.setItem(chaveDoRetrato("ana"), "{isto não é json");
    expect(lerRetratoDaHome("ana", s)).toBeNull();
    s.setItem(chaveDoRetrato("ana"), JSON.stringify({ v: 0, perfil: ANA }));
    expect(lerRetratoDaHome("ana", s)).toBeNull();
    s.setItem(chaveDoRetrato("ana"), JSON.stringify([ANA]));
    expect(lerRetratoDaHome("ana", s)).toBeNull();
    expect(lerRetratoDaHome("", s)).toBeNull();
    expect(lerRetratoDaHome("ana", null)).toBeNull();
  });

  test("apagar tira, e não estoura sem storage", () => {
    const s = armazemFalso();
    gravarRetratoDaHome("ana", ANA, s);
    apagarRetratoDaHome("ana", s);
    expect(lerRetratoDaHome("ana", s)).toBeNull();
    expect(() => apagarRetratoDaHome("ana", null)).not.toThrow();
  });
});

describe("⚠️ e a home usa o retrato nos três pontos certos", () => {
  const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

  test("lê ANTES do getUser da abertura, com a marca de médico da SESSÃO", () => {
    /* A âncora é a abertura da home (`idDaSessao`), não o primeiro `getUser` do
       arquivo — há vários, em outras funções. */
    const abertura = CONTA.indexOf("const idDaSessao = s.session?.user?.id ?? null;");
    expect(abertura).toBeGreaterThan(-1);
    const leitura = CONTA.indexOf("lerRetratoDaHome(", abertura);
    const getUser = CONTA.indexOf("supabase.auth.getUser()", abertura);
    expect(leitura).toBeGreaterThan(abertura);
    expect(leitura).toBeLessThan(getUser);
    expect(CONTA).toContain("podePintarDoRetrato(retrato, marcaDeMedicoNaSessao)");
  });

  test("grava só no ponto em que libera cedo", () => {
    expect(CONTA).toMatch(
      /if \(liberarCedo\) \{\s*setLoading\(false\);\s*gravarRetratoDaHome\(u\.user\.id, data\);/,
    );
  });

  test("some no signOut, junto com a jornada local", () => {
    const saida = CONTA.slice(CONTA.indexOf("async function signOut()"));
    expect(saida.slice(0, 1200)).toContain("PREFIXO_RETRATO_DA_HOME");
  });
});
