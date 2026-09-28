import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  VALIDADE_DIAS,
  chaveDoRascunhoDeStory,
  ehRascunhoUtil,
  lerRascunhoDeStory,
  paraGuardar,
} from "./rascunho-do-story";

const AGORA = new Date("2026-08-25T12:00:00Z");
const base = {
  texto: "",
  enquete: null as string[] | null,
  perguntaAberta: false,
  carimbarSemana: false,
};

describe("o rascunho do story", () => {
  test("texto digitado vale a pena guardar", () => {
    expect(ehRascunhoUtil({ ...base, texto: "hoje foi o ultrassom", em: "" })).toBe(true);
  });

  test("opção de enquete digitada também", () => {
    expect(ehRascunhoUtil({ ...base, enquete: ["menino", "menina"], em: "" })).toBe(true);
  });

  test("⚠️ mas os DOIS interruptores sozinhos NÃO contam", () => {
    /**
     * `carimbarSemana` e `perguntaAberta` são um toque cada. Oferecer "você
     * tinha um rascunho" para devolver um booleano é a forma mais barata de a
     * tela perder a credibilidade — é a mesma razão pela qual a camada de
     * visibilidade não conta no rascunho do post. O que justifica a pergunta é
     * TEXTO digitado.
     */
    expect(ehRascunhoUtil({ ...base, carimbarSemana: true, perguntaAberta: true, em: "" })).toBe(
      false,
    );
  });

  test("enquete só com espaços não conta", () => {
    expect(ehRascunhoUtil({ ...base, enquete: ["  ", ""], em: "" })).toBe(false);
  });
});

describe("ida e volta", () => {
  test("guarda e lê de volta", () => {
    const r = paraGuardar({ ...base, texto: "oi", enquete: ["a", "b"] }, AGORA);
    expect(r.guardar).toBe(true);
    if (!r.guardar) return;
    const lido = lerRascunhoDeStory(r.texto, AGORA);
    expect(lido?.texto).toBe("oi");
    expect(lido?.enquete).toEqual(["a", "b"]);
  });

  test("⚠️ rascunho vazio APAGA em vez de gravar um vazio", () => {
    /* Se ela apagou tudo, desistiu daquele texto — reoferecê-lo depois seria
       devolver o que ela acabou de tirar da tela. */
    expect(paraGuardar(base, AGORA)).toEqual({ guardar: false });
  });

  test("⚠️ A FOTO NÃO É GRAVADA, mesmo se vier no objeto", () => {
    /**
     * A gravação é CAMPO A CAMPO, e nunca `{ ...r }` — é a lição já paga no
     * rascunho do post. Com espalhamento, uma foto acrescentada ao objeto do
     * compositor entraria no `localStorage` mesmo sem existir no TIPO, porque
     * `JSON.stringify` não conhece tipo nenhum. Num story a foto vai a 1,5 MB:
     * um terço da cota numa gravação só, e o que quebra quando ela estoura é a
     * próxima gravação do `journey_state`.
     *
     * ⚠️ **E o teste não pode olhar as chaves do próprio objeto que ele montou**
     * — foi assim que a versão anterior deste teste, no rascunho do post, ficou
     * tautológica. Ele olha o que SAIU da função.
     */
    const comFoto = { ...base, texto: "oi", imagem: "data:image/jpeg;base64,AAAA" };
    const r = paraGuardar(comFoto as never, AGORA);
    expect(r.guardar).toBe(true);
    if (!r.guardar) return;
    expect(r.texto).not.toContain("imagem");
    expect(r.texto).not.toContain("base64");
    expect(Object.keys(JSON.parse(r.texto)).sort()).toEqual([
      "carimbarSemana",
      "em",
      "enquete",
      "perguntaAberta",
      "texto",
    ]);
  });
});

describe("a validade", () => {
  test("⚠️ é de UM dia, e não de sete como a do post", () => {
    /**
     * Um story é uma coisa de HOJE: ele expira em 24 h depois de publicado. Um
     * texto de quatro dias atrás oferecido de volta não é memória, é confusão —
     * e pior aqui, porque ela pode publicá-lo sem reler achando que é o de
     * agora.
     */
    expect(VALIDADE_DIAS).toBe(1);
    const r = paraGuardar({ ...base, texto: "oi" }, AGORA);
    if (!r.guardar) throw new Error("devia guardar");

    const doisDias = new Date(AGORA.getTime() + 2 * 86_400_000);
    expect(lerRascunhoDeStory(r.texto, doisDias)).toBeNull();

    const doze = new Date(AGORA.getTime() + 12 * 3_600_000);
    expect(lerRascunhoDeStory(r.texto, doze)?.texto).toBe("oi");
  });

  test("⚠️ carimbo no FUTURO é recusado", () => {
    /* Relógio dessincronizado grava um `em` adiante; sem esta guarda o rascunho
       valeria para sempre. */
    const futuro = JSON.stringify({ texto: "oi", em: "2027-01-01T00:00:00.000Z" });
    expect(lerRascunhoDeStory(futuro, AGORA)).toBeNull();
  });
});

describe("lixo no armazenamento", () => {
  test("nada, texto quebrado e formato estranho viram `null`", () => {
    for (const x of [null, "", "{", "[]", '"oi"', "{}", '{"texto":123}']) {
      expect(lerRascunhoDeStory(x, AGORA)).toBeNull();
    }
  });

  test("campos de tipo errado não derrubam a leitura", () => {
    const bruto = JSON.stringify({
      texto: "oi",
      enquete: ["a", 42, null, "b"],
      perguntaAberta: "sim",
      carimbarSemana: 1,
      em: AGORA.toISOString(),
    });
    const lido = lerRascunhoDeStory(bruto, AGORA);
    expect(lido?.enquete).toEqual(["a", "b"]);
    /* ⚠️ `=== true`, e não coerção: `"sim"` e `1` são "verdadeiros" em
       JavaScript, e ligar um interruptor a partir de lixo é ligar sem ela
       pedir. */
    expect(lido?.perguntaAberta).toBe(false);
    expect(lido?.carimbarSemana).toBe(false);
  });
});

describe("a chave", () => {
  test("⚠️ carrega o id da conta, e não colide com a do POST", () => {
    /**
     * Aparelho compartilhado é o caso comum (o companheiro, a mãe, a irmã), e o
     * rascunho de um story sobre a gestação é texto íntimo.
     *
     * ⚠️ E as duas chaves não podem ser a mesma nem prefixo uma da outra: o
     * rascunho do post e o do story convivem, e uma colisão faria abrir o
     * compositor de story com o texto de um post.
     */
    const a = chaveDoRascunhoDeStory("u1");
    const b = chaveDoRascunhoDeStory("u2");
    expect(a).not.toBe(b);
    expect(a).toContain("u1");

    const doPost = readFileSync("src/lib/rascunho-do-post.ts", "utf8");
    const prefixoDoPost = /return `([^$]+)\$\{userId\}`/.exec(doPost)?.[1] ?? "";
    expect(prefixoDoPost).toBeTruthy();
    expect(a.startsWith(prefixoDoPost)).toBe(false);
  });
});
