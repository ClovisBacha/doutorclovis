/**
 * A ÁRVORE DE "QUEM É QUEM" NA ENTRADA, COMO FUNÇÃO PURA.
 *
 * Antes ela vivia dentro de um `useEffect` em `auth.tsx`, com as duas perguntas
 * ao servidor em SÉRIE — e a única forma de provar a ordem era ler o fonte.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";
import { destinoDaSessao } from "@/lib/destino-da-sessao";

const ninguem = { isAdmin: false, temPerfilMedico: false, querSerMedico: false };

describe("o destino de quem já tem sessão", () => {
  test("paciente comum vai para o app dela", () => {
    expect(destinoDaSessao(ninguem)).toBe("/minha-conta");
  });

  test("perfil de médico vai para o painel, ativo ou não", () => {
    expect(destinoDaSessao({ ...ninguem, temPerfilMedico: true })).toBe("/painel");
  });

  test("cadastro de médico começado neste aparelho volta para o cadastro", () => {
    expect(destinoDaSessao({ ...ninguem, querSerMedico: true })).toBe("/medicos/cadastro");
  });

  test("⚠️ dono antes de médico — o e-mail dele também é 'equipe'", () => {
    expect(destinoDaSessao({ isAdmin: true, temPerfilMedico: true, querSerMedico: true })).toBe(
      "/admin",
    );
  });

  test("⚠️ médico antes da intenção de cadastro — quem já tem perfil não recadastra", () => {
    expect(destinoDaSessao({ ...ninguem, temPerfilMedico: true, querSerMedico: true })).toBe(
      "/painel",
    );
  });
});

describe("⚠️ e /auth pergunta as duas coisas ao servidor de uma vez", () => {
  const AUTH = semComentarios(readFileSync("src/routes/auth.tsx", "utf8"));

  test("as duas chamadas vão num Promise.all, e o destino vem da régua", () => {
    expect(AUTH).toMatch(/Promise\.all\(\[\s*checkIsAdmin\(/);
    expect(AUTH).toContain("destinoDaSessao(");
  });

  test("enquanto decide, a página não mostra o formulário de login", () => {
    /* Toda abertura da casca nativa passa por aqui com sessão viva: sem este
       estado, o formulário piscava antes de o app abrir. */
    expect(AUTH).toContain("setVerificando(true)");
    expect(AUTH).toMatch(/if \(verificando\) return/);
  });

  test("⚠️ e a espera tem saída: falhou o pedaço ou a rede, o formulário volta", () => {
    expect(AUTH).toMatch(/catch \{[\s\S]{0,400}setVerificando\(false\)/);
  });
});
