import { describe, expect, test } from "bun:test";
import {
  aplicarSugestao,
  contextoDaLegenda,
  lerSugestoes,
  promptDaLegenda,
  SUGESTOES_MAX,
  LADO_PARA_A_IA,
} from "./legenda-sugerida";
import type { EntradaDoSelo } from "./selo-do-perfil";
import { LIMITE_DO_TEXTO } from "./rede-social";

const CTX = { semana: "28 semanas", nomeDoBebe: "Helena" };

const entrada = (mudar: Partial<EntradaDoSelo> = {}): EntradaDoSelo => ({
  totalDias: 28 * 7,
  nasceu: false,
  emCuidado: false,
  mostrarSemana: true,
  mostrarBebe: true,
  nomeDoBebe: "Helena",
  ...mudar,
});

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
    const p = promptDaLegenda({ ...CTX, semana: null });
    expect(p).not.toContain("28");
    expect(p).not.toContain("semanas de gestação");
    /* O nome do bebê tem chave própria e não é afetado por esta. */
    expect(p).toContain("Helena");
  });

  test("sem gestação e sem nome, o prompt continua válido", () => {
    const p = promptDaLegenda({ semana: null, nomeDoBebe: null });
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

/* ══════════════════════════════════════════════════════════════════════════
   ⚠️ A RÉGUA É A MESMA DO SELO — e esta suíte nasceu de um defeito real.
   A primeira versão desta tela levava `semana: number` + `mostrarSemana` e
   conferia só a chave: passavam pelo prompt a paciente que já pariu e a de
   DUM corrigida acima de 42 semanas. Os dois silêncios já existiam em
   `semanaPublica`; faltava CHAMAR a régua.
   ══════════════════════════════════════════════════════════════════════════ */
describe("contextoDaLegenda", () => {
  test("com a chave ligada, a frase é a mesma do selo", () => {
    expect(contextoDaLegenda(entrada()).semana).toBe("28 semanas");
  });

  test("⚠️ depois do parto a semana some — o modelo não escreve na voz de grávida", () => {
    const c = contextoDaLegenda(entrada({ nasceu: true }));
    expect(c.semana).toBeNull();
    /* A régua fixa do prompt cita "gestação" numa linha de instrução; o que não
       pode existir é a FRASE de contexto que afirma a semana dela. */
    expect(promptDaLegenda(c)).not.toContain("A pessoa está com");
  });

  /* ⚠️ E o NOME do bebê também some depois do parto: uma legenda que espera
     quem já chegou é o mesmo defeito com outra palavra. */
  test("⚠️ depois do parto o nome do bebê também some", () => {
    expect(contextoDaLegenda(entrada({ nasceu: true })).nomeDoBebe).toBeNull();
  });

  test("⚠️ acima de 42 semanas a régua cala", () => {
    expect(contextoDaLegenda(entrada({ totalDias: 50 * 7 })).semana).toBeNull();
  });

  test("⚠️ Modo Cuidado cala os dois", () => {
    const c = contextoDaLegenda(entrada({ emCuidado: true }));
    expect(c.semana).toBeNull();
    expect(c.nomeDoBebe).toBeNull();
  });

  test("a chave desligada cala a semana e deixa o nome — são duas decisões", () => {
    const c = contextoDaLegenda(entrada({ mostrarSemana: false }));
    expect(c.semana).toBeNull();
    expect(c.nomeDoBebe).toBe("Helena");
  });

  test("sem DUM, silêncio — nunca 0 semanas", () => {
    expect(contextoDaLegenda(entrada({ totalDias: null })).semana).toBeNull();
  });

  test("nome vazio vira null, não string em branco no prompt", () => {
    expect(contextoDaLegenda(entrada({ nomeDoBebe: "   " })).nomeDoBebe).toBeNull();
  });
});
