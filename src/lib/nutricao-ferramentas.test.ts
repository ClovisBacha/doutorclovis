/**
 * AS FERRAMENTAS DA NUTRICIONISTA — o que a frase montada pode e não pode dizer.
 *
 * ⚠️ O risco desta régua é de TEXTO: ela escreve a pergunta que vai para a
 * IA, e em Modo Cuidado a palavra "gestação" não pode entrar por aqui — a
 * saudação e o cartão de nutrientes já se calam, e a ferramenta seria a porta
 * dos fundos.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "./sem-comentarios";

import {
  ALIMENTO_MAX,
  ALIVIOS,
  INGREDIENTES_MAX,
  META_COPOS,
  PREFIXO_AGUA,
  PREFIXO_SUPLEMENTOS,
  REFEICOES,
  chaveDaAgua,
  chaveDosSuplementos,
  chavesDeAguaVencidas,
  chavesDeSuplementosVencidas,
  itensDaPrescricao,
  limparAlimento,
  limparIngredientes,
  perguntaDeAlivio,
  perguntaDoPrato,
  perguntaDoQueTenho,
  perguntaPossoComer,
  refeicaoDaHora,
  resumoDosSuplementos,
} from "./nutricao-ferramentas";

/** Os sete momentos que `momentoDoDia` produz — a fonte é `nutricao-perfil`. */
const MOMENTOS = [
  "café da manhã",
  "lanche da manhã",
  "almoço",
  "lanche da tarde",
  "jantar",
  "ceia",
  "madrugada",
] as const;

/**
 * ⚠️ A TELA PASSA POR `semComentarios`, e nunca por um apagador por regex.
 *
 * `nutricao-tab.tsx` tem `accept="image/(estrela)"` no seletor de foto, e a
 * barra-asterisco dentro dessa string faz um apagador ingênuo engolir centenas
 * de linhas. Medido: o cartão da câmera inteiro sumia do que o teste via, e
 * duas asserções deste arquivo, sobre código que não mudou, ficaram vermelhas.
 * Numa asserção NEGATIVA teria sido pior — ela ficaria verde em silêncio.
 *
 * A régua única ancora a abertura no COMEÇO DA LINHA, que é onde todo
 * comentário de bloco deste repositório começa. O porquê está lá.
 */
const TELA_CRUA = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));

describe("posso comer?", () => {
  test("fora do luto, a pergunta é sobre a gestação", () => {
    expect(perguntaPossoComer("sushi", false)).toMatch(/^Posso comer sushi na gestação\?/);
  });
  test("⚠️ em Modo Cuidado NENHUM modelo diz gestação, bebê ou parto", () => {
    const frases = [
      perguntaPossoComer("sushi", true),
      ...REFEICOES.map((r) => perguntaDoPrato(r)),
      ...ALIVIOS.map((a) => perguntaDeAlivio(a.frase)),
      ...MOMENTOS.map((m) => perguntaDoQueTenho("ovo, arroz", m)),
    ];
    for (const f of frases) expect(f).not.toMatch(/gesta|beb[êe]|parto|trimestre/i);
  });
  test("o que ela digita é limpo e tem teto", () => {
    expect(limparAlimento("  queijo   brie \n")).toBe("queijo brie");
    expect(limparAlimento("a")).toBeNull();
    expect(limparAlimento("")).toBeNull();
    expect(limparAlimento("x".repeat(200))!.length).toBe(ALIMENTO_MAX);
  });
});

describe("as frases leem como português", () => {
  test("⚠️ 'estou com sem apetite' não existe — o chip tem rótulo e frase", () => {
    for (const a of ALIVIOS) {
      const f = perguntaDeAlivio(a.frase);
      expect(f).toMatch(/^Estou com [a-zà-ú]/);
      expect(f).not.toMatch(/com sem /);
    }
  });
  test("a refeição entra em minúscula no meio da frase", () => {
    expect(perguntaDoPrato("Café da manhã")).toMatch(/^Monte um café da manhã/);
  });
});

describe("a água do dia", () => {
  test("uma chave por dia, e as dos outros dias saem", () => {
    const hoje = "2026-09-05";
    const chaves = [chaveDaAgua("2026-09-03"), chaveDaAgua(hoje), "dc-path-day-3", "outra"];
    expect(chavesDeAguaVencidas(chaves, hoje)).toEqual([chaveDaAgua("2026-09-03")]);
  });
  test("⚠️ a chave NÃO é `dc-path-` — essa viaja no blob e dispara push por escrita", () => {
    expect(PREFIXO_AGUA.startsWith("dc-path-")).toBe(false);
    expect(chaveDaAgua("2026-09-05").startsWith("dc-path-")).toBe(false);
  });
  test("8 copos é a referência, e a tela diz que é referência", () => {
    expect(META_COPOS).toBe(8);
    const TELA = TELA_CRUA;
    expect(TELA).toMatch(/Referência de cerca de 2 litros/);
  });
});

describe("a tela usa a régua, e não frases soltas", () => {
  const TELA = TELA_CRUA;
  test("as três ferramentas mandam pela régua", () => {
    expect(TELA).toMatch(/perguntar\(perguntaPossoComer\(a, careMode\)\)/);
    expect(TELA).toMatch(/perguntar\(perguntaDoPrato\(r\)\)/);
    expect(TELA).toMatch(/perguntar\(perguntaDeAlivio\(a\.frase\)\)/);
  });
  test("⚠️ a água é lida num EFEITO, nunca no render", () => {
    const i = TELA.indexOf("localStorage.getItem(chaveDaAgua");
    expect(i).toBeGreaterThan(-1);
    const antes = TELA.slice(Math.max(0, i - 260), i);
    expect(antes).toMatch(/useEffect\(\(\) => \{/);
  });
  test("o que ela digita passa por `limparAlimento` antes de virar pergunta", () => {
    expect(TELA).toMatch(/const a = limparAlimento\(alimento\);\s*if \(a\) perguntar/);
  });
});

describe("o que tenho em casa", () => {
  test("a receita sai SÓ do que ela listou", () => {
    const f = perguntaDoQueTenho("ovo, arroz, cenoura", "almoço");
    expect(f).toMatch(/ovo, arroz, cenoura/);
    /* ⚠️ Esta é a instrução inteira da ferramenta: sem ela o modelo
       acrescenta três compras e a resposta deixa de servir a quem abriu a
       geladeira no fim do mês. */
    expect(f).toMatch(/SÓ o que eu listei/);
  });
  test("⚠️ e a compra sugerida é OPCIONAL, nunca condição da receita", () => {
    const f = perguntaDoQueTenho("ovo", "jantar");
    expect(f).toMatch(/tem de funcionar sem ela/);
  });
  test("o momento entra na frase", () => {
    for (const m of MOMENTOS) {
      expect(perguntaDoQueTenho("ovo, arroz", m)).toContain(`opção de ${m}`);
    }
  });
  test("o que ela digita é limpo e tem teto", () => {
    expect(limparIngredientes("  ovo,   arroz \n feijão ")).toBe("ovo, arroz feijão");
    expect(limparIngredientes("ov")).toBeNull();
    expect(limparIngredientes("   ")).toBeNull();
    expect(limparIngredientes("x".repeat(400))!.length).toBe(INGREDIENTES_MAX);
  });
});

describe("o convite pela hora do dia", () => {
  test("⚠️ toda hora cai numa das QUATRO refeições que a ferramenta conhece", () => {
    for (let h = 0; h < 24; h++) {
      expect(REFEICOES).toContain(refeicaoDaHora(h));
    }
  });
  test("a refeição bate com a hora nos casos que decidem", () => {
    expect(refeicaoDaHora(8)).toBe("Café da manhã");
    expect(refeicaoDaHora(12)).toBe("Almoço");
    expect(refeicaoDaHora(16)).toBe("Lanche");
    expect(refeicaoDaHora(20)).toBe("Jantar");
  });
  test("⚠️ madrugada e ceia NÃO propõem uma refeição principal", () => {
    /* Às 3h e às 23h ninguém monta um jantar — a hora de comer alguma coisa
       leve é a única resposta honesta, e é a mesma decisão que
       `conviteDoMomento` toma para a madrugada. */
    expect(refeicaoDaHora(3)).toBe("Lanche");
    expect(refeicaoDaHora(23)).toBe("Lanche");
  });
});

describe("os suplementos que o médico prescreveu", () => {
  test("a prescrição vira itens, por vírgula, ponto e vírgula, linha ou 'e'", () => {
    expect(itensDaPrescricao("Ácido fólico, Sulfato ferroso; Vitamina D")).toEqual([
      "Ácido fólico",
      "Sulfato ferroso",
      "Vitamina D",
    ]);
    expect(itensDaPrescricao("Ferro e Cálcio")).toEqual(["Ferro", "Cálcio"]);
  });
  test("⚠️ campo vazio NÃO inventa suplemento nenhum", () => {
    /* O app nunca sugere: sem prescrição, a seção não existe. Um item
       inventado aqui viraria conduta. */
    expect(itensDaPrescricao(null)).toEqual([]);
    expect(itensDaPrescricao(undefined)).toEqual([]);
    expect(itensDaPrescricao("")).toEqual([]);
    expect(itensDaPrescricao(" , ; , ")).toEqual([]);
  });
  test("resto de separador não vira item, e o checklist tem teto", () => {
    expect(itensDaPrescricao("Ferro, a, Cálcio")).toEqual(["Ferro", "Cálcio"]);
    expect(
      itensDaPrescricao(Array.from({ length: 20 }, (_, i) => `Item${i}`).join(",")),
    ).toHaveLength(8);
  });
  test("⚠️ o resumo é FATO, nunca cobrança", () => {
    const frases = [
      resumoDosSuplementos(0, 3),
      resumoDosSuplementos(1, 3),
      resumoDosSuplementos(3, 3),
    ];
    for (const f of frases) {
      expect(f).not.toMatch(/falta|voc[êe] n[ãa]o|esqueceu|pendente|atras/i);
    }
    expect(resumoDosSuplementos(3, 3)).toMatch(/em dia/i);
    expect(resumoDosSuplementos(1, 3)).toBe("1 de 3 hoje");
    expect(resumoDosSuplementos(0, 1)).toBe("1 item do seu médico");
    expect(resumoDosSuplementos(0, 0)).toBe("");
  });
  test("a marca do dia vive numa chave própria, e as de ontem são varridas", () => {
    /* ⚠️ `dc-suplementos:`, NUNCA `dc-path-`: essa viaja no blob da jornada e
       dispara um push por escrita — um toque por item viraria um push por
       item. E a chave começa com o prefixo da ÁGUA? Não: são dois prefixos
       distintos, senão uma varredura levaria a outra junto. */
    expect(chaveDosSuplementos("2026-09-07")).toBe("dc-suplementos:2026-09-07");
    expect(PREFIXO_SUPLEMENTOS.startsWith(PREFIXO_AGUA)).toBe(false);
    expect(PREFIXO_AGUA.startsWith(PREFIXO_SUPLEMENTOS)).toBe(false);
    expect(
      chavesDeSuplementosVencidas(
        [
          chaveDosSuplementos("2026-09-06"),
          chaveDosSuplementos("2026-09-07"),
          chaveDaAgua("2026-09-06"),
          "journey_state",
        ],
        "2026-09-07",
      ),
    ).toEqual([chaveDosSuplementos("2026-09-06")]);
  });
});

describe("a tela desenha as três peças novas", () => {
  const TELA = TELA_CRUA;
  test("a geladeira manda pela régua, com o momento da hora", () => {
    expect(TELA).toMatch(/perguntar\(perguntaDoQueTenho\(ing, momentoDoDia\(hora \?\? 12\)\)\)/);
    expect(TELA).toMatch(/const ing = limparIngredientes\(temEmCasa\);/);
  });
  test("⚠️ sem prescrição, o checklist NÃO existe na tela", () => {
    expect(TELA).toMatch(/\{suplementos\.length > 0 && \(/);
  });
  test("⚠️ o convite da hora não aparece em Modo Cuidado, sem relógio nem sobre ferramenta aberta", () => {
    /* `hora` nasce `null` e só é preenchida num efeito: o relógio do servidor
       não é o dela, e ler `new Date()` no render diverge na hidratação. */
    expect(TELA).toMatch(
      /\{!careMode && hora != null && ferramenta === null && messages\.length <= 1 && \(/,
    );
    const i = TELA.indexOf("setHora(new Date().getHours())");
    expect(i).toBeGreaterThan(-1);
    expect(TELA.slice(Math.max(0, i - 200), i)).toMatch(/useEffect\(\(\) => \{/);
  });
  test("⚠️ a bolha respeita as quebras de linha da resposta", () => {
    /* O modelo responde em LINHAS — "para a próxima, duas ideias:" e depois
       duas linhas com marcador. Sem `whitespace-pre-wrap` elas colam num
       parágrafo só, e a foto da bancada mostrou a lista virando uma parede com
       os marcadores no meio da frase. O Chat IA já rendia assim; esta bolha
       tinha ficado de fora. */
    expect(TELA).toMatch(/max-w-\[80%\] whitespace-pre-wrap/);
  });

  test("marcar um suplemento varre as chaves vencidas antes de gravar", () => {
    const i = TELA.indexOf("function alternarSuplemento");
    expect(i).toBeGreaterThan(-1);
    const corpo = TELA.slice(i, TELA.indexOf("\n  function ", i + 10));
    expect(corpo).toMatch(/chavesDeSuplementosVencidas/);
    expect(corpo).toMatch(/removeItem/);
  });
});
