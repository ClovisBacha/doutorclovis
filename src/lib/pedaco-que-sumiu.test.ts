import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ehPedacoQueSumiu } from "./pedaco-que-sumiu";

describe("os textos que cada navegador realmente usa", () => {
  test("⚠️ Safari/iOS — o aparelho onde o app fica instalado", () => {
    /* É o que mais sofre com isto: PWA na tela de início, aberto por semanas,
       enquanto o servidor muda embaixo. E é o aparelho em que eu não consigo
       olhar — daí a régua ser testada por comportamento, e não lida no fonte. */
    for (const m of [
      "Importing a module script failed.",
      "TypeError: Importing a module script failed.",
    ]) {
      expect(ehPedacoQueSumiu({ message: m })).toBe(true);
    }
  });

  test("Chrome, Edge e Android", () => {
    for (const m of [
      "Failed to fetch dynamically imported module: https://app/assets/minha-conta-A1b2C3.js",
      "error loading dynamically imported module",
    ]) {
      expect(ehPedacoQueSumiu({ message: m })).toBe(true);
    }
  });

  test("Firefox e empacotadores", () => {
    expect(ehPedacoQueSumiu({ message: "error loading a module" })).toBe(true);
    expect(ehPedacoQueSumiu({ name: "ChunkLoadError", message: "Loading chunk 42 failed." })).toBe(
      true,
    );
  });
});

describe("⚠️ e o que NÃO pode virar recarga", () => {
  test("erro de aplicação comum", () => {
    /* Recarregar num erro de verdade esconde o defeito e devolve a paciente à
       mesma tela quebrada — com a diferença de que agora ela não sabe o que
       aconteceu. */
    for (const e of [
      { name: "TypeError", message: "Cannot read properties of undefined (reading 'nome')" },
      { name: "Error", message: "sessão expirada" },
      { message: "Failed to fetch" },
      { message: "NetworkError when attempting to fetch resource." },
      null,
      {},
      { message: "" },
    ]) {
      expect(ehPedacoQueSumiu(e)).toBe(false);
    }
  });
});

describe("⚠️ a recarga é UMA por sessão", () => {
  test("a tela de erro guarda o carimbo antes de recarregar", () => {
    /* Sem isto, um erro que se repete vira laço de F5 — e a tela de erro, que é
       o último recurso, deixa de aparecer. O carimbo vai no `sessionStorage`
       (morre com a aba), e não no `localStorage`: numa segunda visita legítima
       ela precisa poder se curar de novo. */
    const raiz = readFileSync("src/routes/__root.tsx", "utf8");
    expect(raiz).toContain("sessionStorage.setItem(CHAVE_RECARGA");
    expect(raiz).not.toContain("localStorage.setItem(CHAVE_RECARGA");
    const i = raiz.indexOf("sessionStorage.setItem(CHAVE_RECARGA");
    const j = raiz.indexOf("window.location.reload()");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });

  test("e ela usa a régua de `lib/`, não uma cópia", () => {
    const raiz = readFileSync("src/routes/__root.tsx", "utf8");
    expect(raiz).toContain('from "@/lib/pedaco-que-sumiu"');
    expect(raiz).not.toContain("function ehPedacoQueSumiu");
  });
});

describe("⚠️ a fronteira da ABA também se recupera do deploy (set/2026)", () => {
  /* A raiz se recuperava; a aba não. Depois de um deploy, tocar em Jogo ou
     Comunidade rejeitava o `import()`, e o botão "Tentar novamente" fazia
     `setState({error:null})` — que remonta e cai no MESMO `import()` já
     marcado como falho pelo navegador (`_status = 2`). Um botão que
     comprovadamente não fazia nada. */
  const BOUNDARY = readFileSync("src/components/tab-error-boundary.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const CONTA = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  test("ela usa a MESMA régua da raiz, e não uma cópia", () => {
    expect(BOUNDARY).toContain('from "@/lib/pedaco-que-sumiu"');
    expect(BOUNDARY).toContain("ehPedacoQueSumiu");
  });

  test("⚠️ e a MESMA chave de sessão — senão são duas recargas por sessão", () => {
    const raiz = readFileSync("src/routes/__root.tsx", "utf8");
    const chave = raiz.match(/CHAVE_RECARGA = "([^"]+)"/)?.[1];
    expect(chave).toBeTruthy();
    expect(BOUNDARY).toContain(`"${chave}"`);
  });

  test("⚠️ o botão RECARREGA quando o pedaço sumiu — remontar não adianta", () => {
    expect(BOUNDARY).toMatch(/ehPedacoQueSumiu\(error\)[\s\S]{0,80}location\.reload\(\)/);
  });

  test("⚠️ NADA disso acontece com a Central de Emergência aberta", () => {
    /* Uma recarga no meio de um envio de socorro o ABORTA: o GPS, o endereço
       e a chamada ao servidor morrem, e ela fica olhando um botão que já
       apertou. A aba quebrada pode esperar o desfecho. */
    expect(BOUNDARY).toContain("adiarRecarga");
    const i = BOUNDARY.indexOf("private talvezRecarregar");
    expect(i).toBeGreaterThan(-1);
    const corpo = BOUNDARY.slice(i, BOUNDARY.indexOf("\n  }", i));
    expect(corpo).toMatch(/adiarRecarga[\s\S]{0,20}return/);
    /* E os DOIS pontos de uso passam o estado real, nunca um `false` fixo. */
    expect([...CONTA.matchAll(/adiarRecarga=\{emergencyOpen\}/g)]).toHaveLength(2);
  });

  test("adiar não é desistir — a recarga acontece quando o SOS fecha", () => {
    expect(BOUNDARY).toContain("componentDidUpdate");
  });
});
