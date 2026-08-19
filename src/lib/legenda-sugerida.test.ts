import { describe, expect, test } from "bun:test";
import {
  aplicarSugestao,
  lerSugestoes,
  promptDaLegenda,
  SUGESTOES_MAX,
  LADO_PARA_A_IA,
} from "./legenda-sugerida";
import { LIMITE_DO_TEXTO } from "./rede-social";

const CTX = { semana: 28, nomeDoBebe: "Helena", mostrarSemana: true };

describe("o prompt da legenda", () => {
  test("leva a semana e o nome quando ela os mostra", () => {
    const p = promptDaLegenda(CTX);
    expect(p).toContain("28 semanas");
    expect(p).toContain("Helena");
  });

  /* ⚠️ O TESTE MAIS IMPORTANTE DESTE ARQUIVO.
     A chave `mostrar_semana` do perfil existe para esconder a semana das outras
     pessoas. Se ela estiver desligada e a semana entrar no prompt, o modelo
     escreve o número — e a legenda publica, com o dedo dela no botão,
     exatamente o dado que a chave esconde. */
  test("⚠️ com a chave desligada, a semana NÃO entra no prompt", () => {
    const p = promptDaLegenda({ ...CTX, mostrarSemana: false });
    expect(p).not.toContain("28");
    expect(p).not.toContain("semanas de gestação");
    /* O nome do bebê tem chave própria e não é afetado por esta. */
    expect(p).toContain("Helena");
  });

  test("sem gestação e sem nome, o prompt continua válido", () => {
    const p = promptDaLegenda({ semana: null, nomeDoBebe: null, mostrarSemana: true });
    expect(p).toContain("legendas");
    expect(p).not.toContain("null");
    expect(p).not.toContain("undefined");
  });

  /* ⚠️ As três proibições são o produto, não o estilo — ver o comentário de
     `promptDaLegenda`. Se alguém as remover "para a legenda ficar mais bonita",
     este teste cai. */
  test("⚠️ proíbe conteúdo clínico, invenção e hashtag", () => {
    const p = promptDaLegenda(CTX).toLocaleLowerCase("pt-BR");
    expect(p).toContain("nunca diga nada sobre saúde");
    expect(p).toContain("nunca afirme que está tudo bem");
    expect(p).toContain("não invente fatos");
    expect(p).toContain("sem hashtag");
  });

  test("pede tons diferentes, não três versões da mesma frase", () => {
    expect(promptDaLegenda(CTX)).toContain("DIFERENTES");
  });
});

describe("lerSugestoes", () => {
  test("uma por linha, como pedido", () => {
    expect(lerSugestoes("Primeira.\nSegunda.\nTerceira.")).toEqual([
      "Primeira.",
      "Segunda.",
      "Terceira.",
    ]);
  });

  test("⚠️ aguenta numeração, traço, aspas e bloco de código", () => {
    // Recusar isso devolveria lista vazia sobre uma resposta boa.
    const bruto = ["```", '1. "Primeira."', "- Segunda.", "• Terceira.", "```"].join("\n");
    expect(lerSugestoes(bruto)).toEqual(["Primeira.", "Segunda.", "Terceira."]);
  });

  test("não repete a mesma legenda", () => {
    expect(lerSugestoes("Igual.\nIGUAL.\nOutra.")).toEqual(["Igual.", "Outra."]);
  });

  test("⚠️ descarta o que não caberia no post", () => {
    // Oferecer o que a tela recusa faria o botão prometer e não cumprir.
    const gigante = "a".repeat(LIMITE_DO_TEXTO + 1);
    expect(lerSugestoes(`${gigante}\nCabe.`)).toEqual(["Cabe."]);
  });

  test("nunca devolve mais que o teto", () => {
    const muitas = Array.from({ length: 9 }, (_, i) => `Legenda ${i}`).join("\n");
    expect(lerSugestoes(muitas)).toHaveLength(SUGESTOES_MAX);
  });

  test("resposta vazia ou lixo devolve lista vazia, sem estourar", () => {
    expect(lerSugestoes("")).toEqual([]);
    expect(lerSugestoes("\n\n   \n")).toEqual([]);
    expect(lerSugestoes(undefined as unknown as string)).toEqual([]);
  });
});

describe("aplicarSugestao", () => {
  /* ⚠️ Mesma decisão da transcrição do diário: o que volta é RASCUNHO, e apagar
     o que ela já escreveu por causa de um toque num botão OPCIONAL é a pior
     troca possível. */
  test("⚠️ acrescenta ao que já estava escrito, nunca apaga", () => {
    expect(aplicarSugestao("O que eu escrevi", "A sugestão")).toBe("O que eu escrevi\nA sugestão");
  });

  test("com o campo vazio, a sugestão vira o texto", () => {
    expect(aplicarSugestao("", "A sugestão")).toBe("A sugestão");
    expect(aplicarSugestao("   \n ", "A sugestão")).toBe("A sugestão");
  });
});

describe("a foto que sai do aparelho", () => {
  /* ⚠️ Menor que os 1080 do post: é foto de gestação, às vezes ultrassom, e
     quanto menos sai do aparelho, melhor. */
  test("⚠️ é reduzida antes de ir para a IA", () => {
    expect(LADO_PARA_A_IA).toBeLessThan(1080);
    expect(LADO_PARA_A_IA).toBeGreaterThanOrEqual(384);
  });
});
