/**
 * QUATRO SINAIS DE "SITE EMBRULHADO" QUE A CASCA PERDEU.
 *
 * Nenhum exige aparelho para ser cobrado no fonte; todos exigem aparelho para
 * ser visto. O que fica travado aqui é o fio.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";

const NATIVO = semComentarios(readFileSync("src/lib/nativo.ts", "utf8"));
const CSS = readFileSync("src/styles.css", "utf8");
const CHAT = semComentarios(readFileSync("src/components/chat-tab.tsx", "utf8"));
const ROOT = semComentarios(readFileSync("src/routes/__root.tsx", "utf8"));
const CONTA = semComentarios(readFileSync("src/components/excluir-conta.tsx", "utf8"));

describe("⚠️ a página não dá zoom dentro do app", () => {
  test("a meta de viewport ganha `user-scalable=no` só na casca, antes de hidratar", () => {
    const i = NATIVO.indexOf('classList.add("nativo")');
    const j = NATIVO.indexOf("user-scalable=no");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    /* E a do SITE continua permitindo zoom — acessibilidade do navegador. */
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).not.toContain("user-scalable=no");
  });

  test("o CSS reforça com touch-action em `.nativo`", () => {
    expect(CSS).toMatch(/\.nativo,\s*\.nativo body \{\s*touch-action: pan-x pan-y;/);
  });
});

describe("⚠️ o chat com o médico não tem controle que não faz nada", () => {
  test("o microfone 'em breve' saiu, e o Enviar fica desabilitado sem texto", () => {
    expect(CHAT).not.toContain("em breve");
    expect(CHAT).not.toContain('aria-label="Mensagem de voz"');
    expect(CHAT).toContain("disabled={loading || !input.trim()}");
  });
});

describe("⚠️ página pública aberta de dentro do app tem volta", () => {
  test("a barra existe, só na casca, e não nas telas do próprio app", () => {
    expect(ROOT).toContain("function VoltarAoApp()");
    expect(ROOT).toContain("{!semChromePublico && !semVoltaAoApp && <VoltarAoApp />}");
    for (const p of ["/minha-conta", "/painel", "/admin", "/auth"]) {
      expect(ROOT).toContain(`"${p}"`);
    }
    expect(CSS).toMatch(/\.voltar-ao-app \{\s*display: none;/);
    expect(CSS).toMatch(/\.nativo \.voltar-ao-app \{\s*display: flex;/);
  });

  test("ela leva a /auth, que despacha cada papel para a sua área", () => {
    const i = ROOT.indexOf("function VoltarAoApp()");
    expect(ROOT.slice(i)).toContain('to="/auth"');
  });
});

describe("⚠️ excluir a conta termina no login, sem falar em 'site'", () => {
  test("o destino é /auth", () => {
    expect(CONTA).toContain('window.location.href = "/auth"');
    expect(CONTA).not.toContain('window.location.href = "/"');
  });

  test("o texto do médico não manda para 'o site' de dentro do app", () => {
    expect(CONTA).not.toContain("pelo site");
  });
});
