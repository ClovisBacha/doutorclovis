import { describe, expect, test } from "bun:test";
import { podeAbrirPerfilPublico, POSTS_NA_VITRINE } from "./perfil-publico";

const ok = { existe: true, perfilPublico: true, emCuidado: false };

describe("o portão da página pública", () => {
  test("perfil público e vivo abre", () => {
    expect(podeAbrirPerfilPublico(ok)).toBe(true);
  });

  /* ⚠️ `perfil_publico` nasce FALSO. Não há caso em que uma página sem login
     mostre um perfil fechado — nem para quem tem o código. */
  test("⚠️ perfil FECHADO não abre, nem com o código em mãos", () => {
    expect(podeAbrirPerfilPublico({ ...ok, perfilPublico: false })).toBe(false);
  });

  /* ⚠️ Quem abriu o link da bio de uma criadora que acabou de perder a gestação
     não pode descobrir isso por eliminação: os três motivos devolvem a MESMA
     coisa. */
  test("⚠️ Modo Cuidado e código inexistente respondem igual a perfil fechado", () => {
    expect(podeAbrirPerfilPublico({ ...ok, emCuidado: true })).toBe(false);
    expect(podeAbrirPerfilPublico({ ...ok, existe: false })).toBe(false);
  });
});

describe("a vitrine", () => {
  /* ⚠️ Rolagem infinita numa página sem login convida a consumir o perfil
     inteiro sem nunca criar conta — o oposto do que ela existe para fazer. */
  test("⚠️ tem teto, e é pequeno", () => {
    expect(POSTS_NA_VITRINE).toBeLessThanOrEqual(12);
    expect(POSTS_NA_VITRINE).toBeGreaterThanOrEqual(6);
  });
});
