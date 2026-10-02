/**
 * A VASSOURA DOS RASTROS LOCAIS PASSA NA SAÍDA E NA EXCLUSÃO DA CONTA.
 *
 * ⚠️ A exclusão da conta saía da sessão e deixava no aparelho a jornada local e
 * o retrato da home (a linha do perfil dela); só o `signOut` da conta varria, e
 * por um laço copiado que ninguém lembrou de copiar para o outro lugar.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";
import { ehRastroDaConta, limparRastrosLocaisDaConta } from "@/lib/rastros-locais";
import { chaveDoRetrato } from "@/lib/retrato-da-home";

function armazemFalso(chaves: string[]) {
  const m = new Map(chaves.map((k) => [k, "x"]));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => {
      m.delete(k);
    },
    restantes: () => [...m.keys()],
  };
}

describe("o que é rastro da conta", () => {
  test("jornada local, marcador de sincronia e retrato da home", () => {
    expect(ehRastroDaConta("dc-path-gratidao")).toBe(true);
    expect(ehRastroDaConta("dc-journey-synced-at")).toBe(true);
    expect(ehRastroDaConta(chaveDoRetrato("ana"))).toBe(true);
  });

  test("o resto do aparelho fica: preferências que não são da conta", () => {
    expect(ehRastroDaConta("dc-ceu-localizacao")).toBe(false);
    expect(ehRastroDaConta("dc-avisos-desligados")).toBe(false);
    expect(ehRastroDaConta("sb-auth-token")).toBe(false);
  });
});

describe("a vassoura", () => {
  test("tira só o que é da conta, e diz quantas", () => {
    const s = armazemFalso([
      "dc-path-a",
      "dc-path-b",
      "dc-journey-synced-at",
      chaveDoRetrato("ana"),
      "dc-ceu-localizacao",
    ]);
    expect(limparRastrosLocaisDaConta(s)).toBe(4);
    expect(s.restantes()).toEqual(["dc-ceu-localizacao"]);
  });

  test("sem storage, ou com storage que lança, não estoura", () => {
    expect(limparRastrosLocaisDaConta(null)).toBe(0);
    const quebrado = {
      get length(): number {
        throw new Error("bloqueado");
      },
      key: () => null,
      removeItem: () => {},
    };
    expect(limparRastrosLocaisDaConta(quebrado)).toBe(0);
  });
});

describe("⚠️ e ela passa nos DOIS lugares", () => {
  test("na saída da conta", () => {
    const conta = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
    const saida = conta.slice(conta.indexOf("async function signOut()"));
    expect(saida.slice(0, 900)).toContain("limparRastrosLocaisDaConta()");
    /* O laço antigo não pode voltar a ser copiado. */
    expect(conta).not.toContain('k.startsWith("dc-path-")');
  });

  test("na exclusão da conta, depois do signOut", () => {
    const tela = semComentarios(readFileSync("src/components/excluir-conta.tsx", "utf8"));
    const i = tela.indexOf("await supabase.auth.signOut();");
    expect(i).toBeGreaterThan(-1);
    expect(tela.slice(i, i + 400)).toContain("limparRastrosLocaisDaConta()");
  });
});
