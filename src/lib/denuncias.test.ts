import { describe, expect, test } from "bun:test";
import {
  MOTIVOS,
  motivoConhecido,
  ordenarFila,
  reincidenciasPorPessoa,
  rotuloDoMotivo,
  type DenunciaDaRede,
} from "./denuncias";

const linha = (mudar: Partial<DenunciaDaRede> = {}): DenunciaDaRede => ({
  id: "d1",
  alvo: "post",
  denunciadaId: "a",
  denunciadaNome: "Fulana",
  motivo: "assedio",
  trecho: null,
  quando: "2026-08-19T12:00:00Z",
  reincidencias: 1,
  ...mudar,
});

describe("o catálogo de motivos", () => {
  /* ⚠️ Campo aberto numa denúncia de app de gestação é onde alguém escreve a
     informação clínica de OUTRA pessoa — e esse texto iria parar numa tela de
     administração, gravado, sobre alguém que nunca soube. */
  test("⚠️ é FECHADO, e reconhece só o que está nele", () => {
    expect(motivoConhecido("assedio")).toBe(true);
    expect(motivoConhecido("ela teve um aborto")).toBe(false);
    expect(motivoConhecido("")).toBe(false);
    expect(motivoConhecido("livre")).toBe(false);
  });

  /* ⚠️ O motivo que só existe num app de saúde, e o mais grave da lista: a
     régua clínica pega o vocabulário, mas não a frase bem escrita que diz a
     coisa errada. */
  test("⚠️ existe um motivo para conselho de saúde perigoso", () => {
    expect(MOTIVOS.some((m) => m.motivo === "saude")).toBe(true);
  });

  test("todo motivo tem rótulo e explicação, e são únicos", () => {
    expect(new Set(MOTIVOS.map((m) => m.motivo)).size).toBe(MOTIVOS.length);
    expect(new Set(MOTIVOS.map((m) => m.rotulo)).size).toBe(MOTIVOS.length);
    for (const m of MOTIVOS) {
      expect(m.rotulo.trim().length).toBeGreaterThan(0);
      expect(m.explica.trim().length).toBeGreaterThan(0);
    }
  });

  test("motivo desconhecido não estoura na tela", () => {
    expect(rotuloDoMotivo("inventado")).toBe("Motivo desconhecido");
    expect(rotuloDoMotivo("assedio")).toBe("Assédio ou agressão");
  });
});

describe("a ordem da fila", () => {
  /* ⚠️ Ordenar só por data faria a conta reincidente descer na lista a cada dia
     sem que ninguém a visse. */
  test("⚠️ reincidência ANTES de recência", () => {
    const antiga = linha({ id: "velha", quando: "2026-08-01T00:00:00Z", reincidencias: 4 });
    const nova = linha({ id: "nova", quando: "2026-08-19T00:00:00Z", reincidencias: 1 });
    expect(ordenarFila([nova, antiga]).map((x) => x.id)).toEqual(["velha", "nova"]);
  });

  test("com a mesma reincidência, a mais nova primeiro", () => {
    const a = linha({ id: "a", quando: "2026-08-01T00:00:00Z" });
    const b = linha({ id: "b", quando: "2026-08-19T00:00:00Z" });
    expect(ordenarFila([a, b]).map((x) => x.id)).toEqual(["b", "a"]);
  });

  test("não muda a lista de fora", () => {
    const l = [linha({ id: "x", reincidencias: 1 }), linha({ id: "y", reincidencias: 9 })];
    ordenarFila(l);
    expect(l[0].id).toBe("x");
  });
});

describe("a contagem de reincidência", () => {
  /* ⚠️ A mesma pessoa denunciando o mesmo perfil cinco vezes é UMA pessoa
     incomodada, não cinco — e sem isso um único denunciante levaria qualquer
     conta ao topo da fila. */
  test("⚠️ conta QUEM DENUNCIOU, não linhas", () => {
    const m = reincidenciasPorPessoa([
      { denunciadaId: "alvo", quemId: "p1" },
      { denunciadaId: "alvo", quemId: "p1" },
      { denunciadaId: "alvo", quemId: "p1" },
    ]);
    expect(m.get("alvo")).toBe(1);
  });

  test("pessoas diferentes somam", () => {
    const m = reincidenciasPorPessoa([
      { denunciadaId: "alvo", quemId: "p1" },
      { denunciadaId: "alvo", quemId: "p2" },
      { denunciadaId: "outra", quemId: "p1" },
    ]);
    expect(m.get("alvo")).toBe(2);
    expect(m.get("outra")).toBe(1);
  });

  test("lista vazia devolve mapa vazio", () => {
    expect(reincidenciasPorPessoa([]).size).toBe(0);
  });
});
