import { describe, expect, test } from "bun:test";
import { CONTATO_EMAIL } from "~/config";
import { ehCopiaDosDados, nomeDaCopia, recadoDaCopia } from "~/lib/juridico/copia-dos-dados";

describe("a cópia dos dados", () => {
  test("o nome do arquivo é a data do aparelho, sem o nome dela", () => {
    /* 23h30 no relógio dela — em São Paulo, já é amanhã em UTC: o arquivo diz
       o dia do aparelho, e não o do UTC (que `toISOString` daria). */
    const noite = new Date(2026, 9, 28, 23, 30);
    expect(nomeDaCopia(noite)).toBe("obstetrica-meus-dados-2026-10-28.json");
    expect(ehCopiaDosDados(nomeDaCopia(noite))).toBe(true);
    expect(ehCopiaDosDados("ViewShot-123.png")).toBe(false);
  });

  test("um arquivo com falhas nunca é dito completo", () => {
    const r = recadoDaCopia({ ok: true, arquivo: { falhas: ["journal_entries"] } });
    expect(r.erro).toBe(true);
    expect(r.texto).toContain("sem uma parte");
    expect(r.texto).toContain(CONTATO_EMAIL);
    expect(recadoDaCopia({ ok: true, arquivo: { falhas: ["a", "b"] } }).texto).toContain(
      "2 fontes",
    );
  });

  test("o arquivo inteiro avisa que tem dado de saúde", () => {
    const r = recadoDaCopia({ ok: true, arquivo: { falhas: [] } });
    expect(r.erro).toBe(false);
    expect(r.texto).toContain("informações de saúde");
  });

  test("cada recusa do servidor tem o seu recado", () => {
    expect(recadoDaCopia({ ok: false, motivo: "sessao" }).texto).toContain("sessão expirou");
    expect(recadoDaCopia({ ok: false, motivo: "medico" }).texto).toContain("suporte");
    expect(recadoDaCopia({ ok: false, motivo: "qualquer" }).erro).toBe(true);
  });
});
