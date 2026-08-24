import { describe, expect, test } from "bun:test";
import { anunciarMidia, estadoDaMidia, type SessaoDeMidia } from "./media-session";

function fakeSessao() {
  const handlers = new Map<string, (() => void) | null>();
  const ms: SessaoDeMidia & { handlers: typeof handlers } = {
    metadata: null,
    playbackState: "none",
    setActionHandler: (a, fn) => handlers.set(a, fn),
    handlers,
  };
  return ms;
}

describe("o card da tela bloqueada", () => {
  test("anuncia pausa, play e stop", () => {
    const ms = fakeSessao();
    let pausou = 0;
    anunciarMidia({ titulo: "Meditação · Calma", aoPausar: () => pausou++ }, ms);
    expect([...ms.handlers.keys()].sort()).toEqual(["pause", "play", "stop"]);
    ms.handlers.get("pause")?.();
    expect(pausou).toBe(1);
  });

  test("⚠️ desfazer limpa TODOS os handlers", () => {
    /* Eles são globais. Um handler de pausa esquecido faz o botão do fone
       pausar uma sessão que já terminou — e chamar `setState` num componente
       desmontado, que é erro de console em produção. */
    const ms = fakeSessao();
    const desfazer = anunciarMidia({ titulo: "x", aoPausar: () => {} }, ms);
    desfazer();
    expect([...ms.handlers.values()].every((v) => v === null)).toBe(true);
    expect(ms.metadata).toBe(null);
    expect(ms.playbackState).toBe("none");
  });

  test("sem a API, tudo vira no-op e nada estoura", () => {
    expect(() => anunciarMidia({ titulo: "x" }, null)()).not.toThrow();
    expect(() => estadoDaMidia("playing", null)).not.toThrow();
  });

  test("navegador que recusa a ação não derruba a tela", () => {
    /* Alguns navegadores anunciam `mediaSession` e lançam em ações que não
       suportam. A meditação não pode morrer por causa do card. */
    const ms: SessaoDeMidia = {
      metadata: null,
      setActionHandler: () => {
        throw new Error("não suportado");
      },
    };
    expect(() => anunciarMidia({ titulo: "x", aoPausar: () => {} }, ms)).not.toThrow();
  });

  test("o estado troca ▶︎ por ⏸", () => {
    const ms = fakeSessao();
    estadoDaMidia("paused", ms);
    expect(ms.playbackState).toBe("paused");
    estadoDaMidia("playing", ms);
    expect(ms.playbackState).toBe("playing");
  });
});
