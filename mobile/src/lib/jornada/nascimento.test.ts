import { describe, expect, test } from "bun:test";
import { nascimentoDoSite } from "./nascimento";

describe("o nascimento que a trilha do site guardou", () => {
  test("a data declarada no site", () => {
    expect(nascimentoDoSite({ "dc-path-birth": { date: "2026-09-30" } }, "2026-10-18")).toBe(
      "2026-09-30",
    );
  });

  test("o 'desfazer' do site grava null: não há nascimento", () => {
    expect(nascimentoDoSite({ "dc-path-birth": null }, "2026-10-18")).toBeNull();
    expect(nascimentoDoSite({}, "2026-10-18")).toBeNull();
  });

  test("lixo e data no futuro não viram parto", () => {
    expect(nascimentoDoSite({ "dc-path-birth": { date: "30/09/2026" } }, "2026-10-18")).toBeNull();
    expect(nascimentoDoSite({ "dc-path-birth": "2026-09-30" }, "2026-10-18")).toBeNull();
    expect(nascimentoDoSite({ "dc-path-birth": { date: "2026-11-02" } }, "2026-10-18")).toBeNull();
  });
});
