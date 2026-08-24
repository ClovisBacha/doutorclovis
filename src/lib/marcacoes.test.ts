import { describe, expect, test } from "bun:test";
import {
  MARCADAS_MAX,
  marcadasPermitidas,
  podeSerMarcada,
  textoDeMarcadas,
  type CandidataAMarcar,
} from "./marcacoes";

const boa = (id: string, mudar: Partial<CandidataAMarcar> = {}): CandidataAMarcar => ({
  id,
  souEu: false,
  somosAmigas: true,
  bloqueio: false,
  emCuidado: false,
  ...mudar,
});

describe("podeSerMarcada", () => {
  test("amiga sem bloqueio e sem luto: pode", () => {
    expect(podeSerMarcada(boa("a"))).toBe(true);
  });

  /* ⚠️ O grafo fechado é o que torna esta aba segura SEM moderação. Marcar
     quem não é amiga poria o nome de uma desconhecida embaixo de uma foto de
     gestação. */
  test("⚠️ quem não é amiga NÃO pode ser marcada", () => {
    expect(podeSerMarcada(boa("a", { somosAmigas: false }))).toBe(false);
  });

  /* ⚠️ Sai da lista sem anunciar — a mesma decisão da aba de Amigas: "Fulana
     saiu" contaria a perda dela para outra pessoa. */
  test("⚠️ quem está em Modo Cuidado não aparece para ser marcada", () => {
    expect(podeSerMarcada(boa("a", { emCuidado: true }))).toBe(false);
  });

  test("bloqueio dos dois lados recusa", () => {
    expect(podeSerMarcada(boa("a", { bloqueio: true }))).toBe(false);
  });

  test("eu mesma não me marco", () => {
    expect(podeSerMarcada(boa("a", { souEu: true }))).toBe(false);
  });
});

describe("marcadasPermitidas", () => {
  test("devolve só quem passa", () => {
    expect(marcadasPermitidas([boa("a"), boa("b", { somosAmigas: false }), boa("c")])).toEqual([
      "a",
      "c",
    ]);
  });

  test("não repete o mesmo id", () => {
    expect(marcadasPermitidas([boa("a"), boa("a")])).toEqual(["a"]);
  });

  test("respeita o teto", () => {
    const muitas = Array.from({ length: 12 }, (_, i) => boa(`p${i}`));
    expect(marcadasPermitidas(muitas)).toHaveLength(MARCADAS_MAX);
  });

  test("lista vazia devolve vazia", () => {
    expect(marcadasPermitidas([])).toEqual([]);
  });
});

describe("textoDeMarcadas", () => {
  test("um nome", () => {
    expect(textoDeMarcadas(["Marina"])).toBe("com Marina");
  });

  test("dois nomes por extenso", () => {
    expect(textoDeMarcadas(["Marina", "Carol"])).toBe("com Marina e Carol");
  });

  /* ⚠️ Cinco nomes estourariam a largura de um iPhone e empurrariam a hora do
     post para a linha de baixo. A linha é para ser lida de relance. */
  test("⚠️ do terceiro em diante, vira contagem", () => {
    expect(textoDeMarcadas(["Marina", "Carol", "Ana"])).toBe("com Marina e mais 2");
    expect(textoDeMarcadas(["A", "B", "C", "D", "E"])).toBe("com A e mais 4");
  });

  test("sem ninguém, a linha não existe", () => {
    expect(textoDeMarcadas([])).toBeNull();
    expect(textoDeMarcadas(["   "])).toBeNull();
  });
});
