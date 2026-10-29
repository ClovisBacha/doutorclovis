import { describe, expect, test } from "bun:test";
import {
  metadadosDoAceite,
  precisaAceitar,
  VERSAO_DOS_TERMOS,
  versaoAceita,
} from "~/lib/juridico/aceite";

describe("o aceite dos termos do app, por versão", () => {
  test("sem aceite nenhum, ou só o carimbo antigo do cadastro (os termos do site), precisa aceitar", () => {
    expect(precisaAceitar(null)).toBe(true);
    expect(precisaAceitar({})).toBe(true);
    expect(precisaAceitar({ aceite_termos_em: "2026-10-01T12:00:00Z" })).toBe(true);
    expect(precisaAceitar({ termos_do_app: "lixo" })).toBe(true);
  });

  test("a versão em vigor vale; uma anterior pede o aceite de novo", () => {
    expect(precisaAceitar({ termos_do_app: VERSAO_DOS_TERMOS })).toBe(false);
    expect(precisaAceitar({ termos_do_app: "2026-01-01" })).toBe(true);
    expect(precisaAceitar({ termos_do_app: "2027-01-01" })).toBe(false);
    expect(versaoAceita({ termos_do_app: "2026-10-28" })).toBe("2026-10-28");
  });

  test("o aceite grava a versão, a hora, os 18 anos e o consentimento do dado de saúde", () => {
    const m = metadadosDoAceite(new Date("2026-10-28T15:00:00Z"));
    expect(m).toEqual({
      termos_do_app: VERSAO_DOS_TERMOS,
      termos_do_app_aceite_em: "2026-10-28T15:00:00.000Z",
      maior_de_18_confirmado_em: "2026-10-28T15:00:00.000Z",
      consentimento_dados_de_saude_em: "2026-10-28T15:00:00.000Z",
    });
    expect(precisaAceitar(m)).toBe(false);
  });
});
