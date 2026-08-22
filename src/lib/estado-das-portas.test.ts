import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PORTAS } from "./comunidade";
import {
  emblemaDaPorta,
  fraseDaPorta,
  novidadesDasPortas,
  ordenarPortas,
  temNovidade,
  type EstadoDasPortas,
} from "./estado-das-portas";

/**
 * ⚠️ A ABA DA COMUNIDADE ERA UM MENU, NÃO UM HUB.
 *
 * Pedido do dono: ela "não tem o acabamento que a aba do Instagram tem".
 * Fotografadas lado a lado, a diferença não é de estilo — é de INFORMAÇÃO: a do
 * Instagram mostra stories, a próxima live com horário e "você entrou na 29ª
 * semana, publicou 3 vezes e recebeu 12 reações"; a Comunidade mostrava seis
 * cartões idênticos que nunca mudavam.
 */
describe("'não consegui ler' nunca vira zero", () => {
  /**
   * ⚠️ **A DECISÃO CENTRAL DO ARQUIVO.** Um contador que falha e mostra `0`
   * AFIRMA que não há nada atrás da porta, e ela deixa de abrir onde havia. É a
   * mesma régua da fila de denúncias, da disponibilidade da agenda e do saldo
   * do chá de bebê.
   */
  test("⚠️ `null` não desenha emblema nem frase", () => {
    expect(emblemaDaPorta({ quantas: null })).toBeNull();
    expect(emblemaDaPorta({ quantas: null, frase: null })).toBeNull();
    expect(temNovidade({ quantas: null })).toBe(false);
  });

  test("⚠️ `null` é diferente de zero, e os dois calam", () => {
    /* Zero também não desenha — porta sem novidade é porta em paz —, mas por
       outra razão, e o servidor precisa poder distinguir os dois. */
    expect(emblemaDaPorta({ quantas: 0 })).toBeNull();
    expect(emblemaDaPorta({ quantas: null })).toBeNull();
    expect(novidadesDasPortas({ cha: { quantas: null }, amigas: { quantas: 0 } })).toBe(0);
  });

  test("⚠️ a soma da aba ignora o que não é número", () => {
    const r: EstadoDasPortas = {
      cha: { quantas: 3 },
      amigas: { quantas: null },
      album: { quantas: 0 },
      nome: { quantas: 2 },
    };
    /* Só 3 + 2: o `null` não entra (não sei) e o 0 não soma. */
    expect(novidadesDasPortas(r)).toBe(5);
  });
});

describe("o emblema não contradiz a frase", () => {
  /**
   * ⚠️ **O TETO `9+` ERA MENTIRA, e a bancada mostrou.** O cartão do Álbum saía
   * com o emblema **9+** ao lado da frase **"12 fotos no álbum"** — dois
   * números para a mesma coisa, se contradizendo a um centímetro de distância.
   */
  test("⚠️ 12 aparece como 12, não como 9+", () => {
    expect(emblemaDaPorta({ quantas: 12 })).toBe("12");
    expect(emblemaDaPorta({ quantas: 99 })).toBe("99");
  });

  /* O teto continua existindo por LARGURA: são dois cartões por linha. */
  test("acima de 99 o teto entra", () => {
    expect(emblemaDaPorta({ quantas: 100 })).toBe("99+");
    expect(emblemaDaPorta({ quantas: 4000 })).toBe("99+");
  });
});

describe("a ordem não vira placar", () => {
  const portas = PORTAS.map((p) => ({ key: p.key }));

  /**
   * ⚠️ **O que tem novidade sobe, e o resto MANTÉM a ordem.** Não é ordenação
   * por contagem: reordenar por tamanho transforma o hub num placar, que é
   * exatamente a comparação que a aba das Amigas gastou um arquivo inteiro para
   * não ter.
   */
  test("⚠️ 7 e 2 não trocam de lugar entre si", () => {
    const iAmigas = portas.findIndex((p) => p.key === "amigas");
    const iAlbum = portas.findIndex((p) => p.key === "album");
    expect(iAmigas).toBeLessThan(iAlbum);
    const r = ordenarPortas(portas, {
      amigas: { quantas: 2 },
      album: { quantas: 7 },
    });
    const nova = r.map((p) => p.key);
    /* Amigas continua antes de Álbum, apesar de ter MENOS. */
    expect(nova.indexOf("amigas")).toBeLessThan(nova.indexOf("album"));
  });

  test("quem tem novidade vem antes de quem não tem", () => {
    const r = ordenarPortas(portas, { nome: { quantas: 3 } });
    expect(r[0].key).toBe("nome");
  });

  test("sem novidade nenhuma, a ordem é a original", () => {
    const r = ordenarPortas(portas, {});
    expect(r.map((p) => p.key)).toEqual(portas.map((p) => p.key));
  });
});

describe("nenhum texto do hub cobra", () => {
  /**
   * ⚠️ Num app de gestação de alto risco, um hub que cobra é um hub que ela
   * fecha. Os números são FATOS sobre o que outras pessoas fizeram por ela —
   * nunca dívida.
   */
  test("⚠️ as frases do servidor não têm cobrança", () => {
    const src = readFileSync("src/lib/estado-das-portas.functions.ts", "utf8");
    /* Só as strings entre aspas, para a prosa dos comentários não contar. */
    const frases = [...src.matchAll(/`([^`]*\$\{n\}[^`]*)`|"([^"]{10,})"/g)]
      .map((m) => (m[1] || m[2] || "").toLowerCase())
      .join(" | ");
    for (const proibido of ["falta", "você não", "não perca", "ainda não", "está sumida"]) {
      expect(frases).not.toContain(proibido);
    }
  });

  test("a frase só existe quando há fato", () => {
    expect(fraseDaPorta({ quantas: 0 })).toBeNull();
    expect(fraseDaPorta({ quantas: null })).toBeNull();
    expect(fraseDaPorta({ quantas: 2, frase: "  " })).toBeNull();
    expect(fraseDaPorta({ quantas: 2, frase: "2 amigas com você" })).toBe("2 amigas com você");
  });
});

describe("o servidor", () => {
  const SRV = readFileSync("src/lib/estado-das-portas.functions.ts", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    " ",
  );

  /** ⚠️ Modo Cuidado antes das contagens — nunca depois. */
  test("⚠️ o Modo Cuidado sai antes de contar", () => {
    expect(SRV).toContain("care_mode");
    expect(SRV.indexOf("care_mode")).toBeLessThan(SRV.indexOf("Promise.all"));
  });

  /** ⚠️ Uma porta que falha não derruba as outras cinco. */
  test("⚠️ cada leitura falha sozinha, em null", () => {
    expect(SRV).toContain("Promise.all");
    expect(SRV).toContain("return null");
  });

  /** O feed fica de fora de propósito — ver o comentário no servidor. */
  test("o feed não tem contador", () => {
    expect(SRV).not.toContain("feed:");
  });
});

describe("o contador de amigas usa a régua do app, não uma consulta própria", () => {
  const SRV = readFileSync("src/lib/estado-das-portas.functions.ts", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    " ",
  );

  /**
   * ⚠️ **O GRAFO DE AMIGAS TEM DOIS LADOS.** A indicação (`referred_by`) e a
   * amizade aceita, menos as encerradas — `idsDasAmigas` resolve os três.
   * Contar `amizades` direto daria um número MENOR do que a lista que ela
   * encontra ao abrir a porta, e emblema que não bate com a tela é pior que
   * emblema nenhum.
   *
   * ⚠️ **E a primeira versão inventou os nomes das colunas** (`de_id`,
   * `para_id`, `estado`). Elas se chamam `menor`, `maior` e `aceita`. A
   * consulta teria voltado `42703`, o contador viraria `null`, e o recurso
   * ficaria invisível sem nunca dar erro.
   */
  test("⚠️ reusa `idsDasAmigas` e não consulta `amizades` direto", () => {
    expect(SRV).toContain("idsDasAmigas");
    expect(SRV).not.toContain('from("amizades")');
  });

  /** `degradada` (não consegui ler) vira `null`, nunca zero. */
  test("⚠️ grafo degradado não vira zero", () => {
    expect(SRV).toContain("degradada ? null");
  });

  /**
   * ⚠️ `companion_invites` tem `expires_at`, não `revoked_at` — outra coluna
   * que eu inventei. Conferido no schema: a tabela tem `token`,
   * `companion_name`, `created_at` e `expires_at`, e mais nada.
   */
  test("⚠️ o convite do acompanhante filtra pela coluna que existe", () => {
    expect(SRV).toContain("expires_at");
    expect(SRV).not.toContain("revoked_at");
  });
});
