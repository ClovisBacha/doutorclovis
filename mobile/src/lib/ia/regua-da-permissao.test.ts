import { describe, expect, test } from "bun:test";
import {
  chaveDaPermissao,
  FOLHA_DA_PERMISSAO,
  permissaoVale,
  registroDaPermissao,
  VERSAO_DA_PERMISSAO,
} from "./regua-da-permissao";

describe("a régua da permissão de IA", () => {
  test("a chave é por uid e começa com dc- (sai junto no 'sair da conta')", () => {
    expect(chaveDaPermissao("abc")).toBe("dc-ia-permissao:abc");
    expect(chaveDaPermissao("abc")).not.toBe(chaveDaPermissao("xyz"));
  });

  test("o registro gravado vale", () => {
    const r = registroDaPermissao(new Date("2026-10-02T12:00:00Z"));
    expect(r).toEqual({ versao: 1, em: "2026-10-02T12:00:00.000Z" });
    expect(permissaoVale(r)).toBe(true);
    expect(permissaoVale(JSON.parse(JSON.stringify(r)))).toBe(true);
  });

  test("nada guardado, lixo ou data ilegível = ainda não perguntamos", () => {
    for (const b of [null, undefined, "", "sim", true, 1, {}, { versao: 1 }, { versao: 1, em: "" }, { versao: 1, em: "ontem" }]) {
      expect(permissaoVale(b)).toBe(false);
    }
  });

  test("versão diferente da atual NÃO vale — um sim antigo não cobre o que mudou", () => {
    expect(permissaoVale({ versao: VERSAO_DA_PERMISSAO - 1, em: new Date().toISOString() })).toBe(false);
    expect(permissaoVale({ versao: VERSAO_DA_PERMISSAO + 1, em: new Date().toISOString() })).toBe(false);
    expect(permissaoVale({ versao: String(VERSAO_DA_PERMISSAO), em: new Date().toISOString() })).toBe(false);
  });
});

describe("o texto da folha diz o que a diretriz 5.1.2(i) exige", () => {
  const tudo = [
    FOLHA_DA_PERMISSAO.intro,
    ...FOLHA_DA_PERMISSAO.vai,
    ...FOLHA_DA_PERMISSAO.garantias,
  ].join(" ");

  test("nomeia o destino: o Gemini, do Google", () => {
    expect(tudo).toContain("Gemini");
    expect(tudo).toContain("Google");
  });

  test("diz QUE dados vão: conversa, foto e medidas do perfil", () => {
    expect(tudo).toMatch(/escrever na conversa/);
    expect(tudo).toMatch(/foto/);
    for (const dado of ["semana", "alergias", "medicações", "peso", "pressão"]) expect(tudo).toContain(dado);
  });

  test("promete o que é verdade: sem publicidade, foto não guardada, não substitui atendimento", () => {
    expect(tudo).toMatch(/publicidade/);
    expect(tudo).toMatch(/não fica guardada/);
    expect(tudo).toMatch(/não substitui/);
    expect(tudo).toContain("192");
  });

  test("os dois botões existem e não prometem médico", () => {
    expect(FOLHA_DA_PERMISSAO.permitir).toBe("Permitir");
    expect(FOLHA_DA_PERMISSAO.agoraNao).toBe("Agora não");
    expect(tudo).not.toMatch(/seu médico (vai|recebe|vê)/i);
  });
});
