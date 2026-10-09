/**
 * O GPS DO CÉU NÃO É PEDIDO AO MONTAR A HOME.
 *
 * ⚠️ Na casca nativa, a primeira caixa de diálogo do app era a de localização —
 * com o texto do SOS — no primeiro segundo da home, para pintar o clima. Agora
 * ela só aparece quando a paciente toca em "Ativar localização", e a resposta
 * fica lembrada neste aparelho.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  CHAVE_LOCALIZACAO_DO_CEU,
  anunciarLocalizacao,
  aoReceberLocalizacao,
  localizacaoJaAutorizada,
  marcarLocalizacaoAutorizada,
  permissaoDeLocalizacao,
  podePedirAoMontar,
} from "@/lib/localizacao-do-ceu";

function armazemFalso() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
}

describe("⚠️ o GPS ao montar só sai com um sim anterior", () => {
  test("o sistema já autorizou → lê", () => {
    expect(podePedirAoMontar("granted", false)).toBe(true);
  });

  test("o sistema negou → não lê, mesmo com a lembrança local", () => {
    expect(podePedirAoMontar("denied", true)).toBe(false);
  });

  test("sem resposta do sistema → só se ela autorizou pelo cartão aqui", () => {
    expect(podePedirAoMontar("prompt", false)).toBe(false);
    expect(podePedirAoMontar("desconhecido", false)).toBe(false);
    expect(podePedirAoMontar("prompt", true)).toBe(true);
    expect(podePedirAoMontar("desconhecido", true)).toBe(true);
  });
});

describe("a lembrança local", () => {
  test("nasce vazia e vira verdadeira depois do cartão", () => {
    const s = armazemFalso();
    expect(localizacaoJaAutorizada(s)).toBe(false);
    marcarLocalizacaoAutorizada(s);
    expect(localizacaoJaAutorizada(s)).toBe(true);
    expect(s.getItem(CHAVE_LOCALIZACAO_DO_CEU)).toBe("1");
  });

  test("armazenamento bloqueado não estoura — vale 'não'", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(() => marcarLocalizacaoAutorizada(quebrado)).not.toThrow();
    expect(localizacaoJaAutorizada(quebrado)).toBe(false);
    expect(localizacaoJaAutorizada(null)).toBe(false);
  });
});

describe("a permissão do sistema, sem nunca lançar", () => {
  const nav = (query: () => Promise<unknown>) =>
    ({ permissions: { query } }) as unknown as Pick<Navigator, "permissions">;

  test("sem navigator, sem permissions, ou com query que lança → desconhecido", async () => {
    expect(await permissaoDeLocalizacao(undefined)).toBe("desconhecido");
    expect(await permissaoDeLocalizacao({} as Pick<Navigator, "permissions">)).toBe("desconhecido");
    expect(await permissaoDeLocalizacao(nav(() => Promise.reject(new Error("não sei"))))).toBe(
      "desconhecido",
    );
  });

  test("o estado do sistema, quando ele responde", async () => {
    expect(await permissaoDeLocalizacao(nav(async () => ({ state: "granted" })))).toBe("granted");
    expect(await permissaoDeLocalizacao(nav(async () => ({ state: "denied" })))).toBe("denied");
    expect(await permissaoDeLocalizacao(nav(async () => ({ state: "prompt" })))).toBe("prompt");
    expect(await permissaoDeLocalizacao(nav(async () => ({ state: "outra" })))).toBe(
      "desconhecido",
    );
  });
});

describe("o cartão entrega a coordenada por evento, e o céu troca no lugar", () => {
  test("quem escuta recebe, e para de receber quando pede", () => {
    const alvo = new EventTarget();
    const recebidas: Array<{ lat: number; lon: number }> = [];
    const parar = aoReceberLocalizacao((c) => recebidas.push(c), alvo);
    anunciarLocalizacao({ lat: -19.92, lon: -43.93 }, alvo);
    expect(recebidas).toEqual([{ lat: -19.92, lon: -43.93 }]);
    parar();
    anunciarLocalizacao({ lat: 0, lon: 0 }, alvo);
    expect(recebidas).toHaveLength(1);
  });

  test("coordenada inválida é ignorada; sem janela nada estoura", () => {
    const alvo = new EventTarget();
    const recebidas: unknown[] = [];
    aoReceberLocalizacao((c) => recebidas.push(c), alvo);
    anunciarLocalizacao({ lat: Number.NaN, lon: -43.93 }, alvo);
    expect(recebidas).toEqual([]);
    expect(() => anunciarLocalizacao({ lat: 1, lon: 2 }, null)).not.toThrow();
    expect(typeof aoReceberLocalizacao(() => {}, null)).toBe("function");
  });
});

describe("⚠️ e a home obedece à régua", () => {
  const SHELL = semComentarios(readFileSync("src/components/app-mobile-shell.tsx", "utf8"));
  const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

  test("o céu pergunta antes de ler o GPS ao montar, e escuta o cartão", () => {
    expect(SHELL).toContain("podePedirAoMontar(");
    expect(SHELL).toContain("aoReceberLocalizacao(");
  });

  test("o cartão anuncia a coordenada em vez de recarregar a página", () => {
    expect(CONTA).toContain("anunciarLocalizacao(");
    expect(CONTA).toContain("marcarLocalizacaoAutorizada(");
    expect(CONTA).not.toContain("ajustes do navegador");
  });

  test("⚠️ o cartão é a única porta, então vale também para quem tem cidade no cadastro", () => {
    expect(CONTA).toContain('origemLocal.tipo === "cadastro"');
  });
});
