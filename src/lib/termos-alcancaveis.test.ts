/**
 * OS TERMOS DE USO SÃO ALCANÇÁVEIS, E O CADASTRO PEDE O ACEITE.
 *
 * ⚠️ `/termos` existia e NENHUM link do app chegava nela; o cadastro não
 * mencionava termos. Um app com conteúdo de usuária (a Comunidade) precisa de
 * termos aceitos — e a revisão procura o caminho.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";

describe("⚠️ os Termos têm caminho", () => {
  test("o cadastro diz que criar a conta é concordar, com os dois links", () => {
    const auth = semComentarios(readFileSync("src/routes/auth.tsx", "utf8"));
    const i = auth.indexOf("Ao criar a conta, você concorda");
    expect(i).toBeGreaterThan(-1);
    const bloco = auth.slice(i, i + 600);
    expect(bloco).toContain('href="/termos"');
    expect(bloco).toContain('href="/privacidade"');
    /* Só no cadastro: quem entra já concordou quando criou a conta. */
    expect(auth.slice(Math.max(0, i - 400), i)).toContain('mode === "signup" && (');
  });

  test("o menu da conta leva aos Termos e à Privacidade", () => {
    const menu = semComentarios(readFileSync("src/components/menu-conta.tsx", "utf8"));
    expect(menu).toContain('href="/termos"');
    expect(menu).toContain('href="/privacidade"');
  });

  test("a rota dos Termos continua existindo", () => {
    expect(readFileSync("src/routes/termos.tsx", "utf8")).toContain('createFileRoute("/termos")');
  });
});
