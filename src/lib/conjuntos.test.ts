/**
 * OS CONJUNTOS — três coisas que só um teste pega.
 *
 *  1. **Id que não existe.** Um conjunto cita `agua-golfino` (sem o "h") e ele
 *     nunca fecha. Ninguém descobre olhando: o selo simplesmente não vem, e a
 *     paciente conclui que comprou errado.
 *
 *  2. **Conjunto que muda de itens depois de publicado.** É a mesma lição que
 *     a Coroa da Coleção aprendeu: o app não pode tirar de volta o que já deu.
 *     Um quinto item num conjunto fechado faria o selo virar "4 de 5" da noite
 *     para o dia.
 *
 *  3. **A ordem da prateleira.** "Quase lá" no topo é o padrão de todo jogo
 *     comercial, e é justamente o que transforma a tela num lembrete do que
 *     falta. Aqui o topo mostra o que ela JÁ fez — e isso é fácil demais de
 *     inverter sem querer num `sort`.
 */

import { describe, expect, test } from "bun:test";
import {
  BONUS_POR_ITEM,
  CONJUNTOS,
  CONJUNTO_POR_ID,
  bonusDoConjunto,
  chaveDoBonus,
  conjuntosCompletos,
  conjuntosDoItem,
  conjuntosOrdenados,
  idsInvalidos,
  progressoDoConjunto,
} from "./conjuntos";
import { CANTINHO_BY_ID, CANTINHO_ITEMS } from "./cantinho";

describe("⚠️ todo item citado existe de verdade", () => {
  test("nenhum id inválido", () => {
    /* O defeito silencioso: um id com erro de digitação faz o conjunto nunca
       fechar, e nada na tela diz por quê. */
    expect(idsInvalidos()).toEqual([]);
  });

  test("os ids do conjunto do mar são os que o dono descreveu", () => {
    /* O pedido literal foi "golfinho e lago, dá pra juntar". Este é o conjunto
       que nasceu daquela frase — se alguém mexer nele, que seja de propósito. */
    const mar = CONJUNTO_POR_ID["mar"];
    expect(mar.itens).toContain("agua-golfinho");
    expect(mar.itens).toContain("fundo-mar");
  });
});

describe("o catálogo de conjuntos é coerente", () => {
  test("ids únicos", () => {
    const ids = CONJUNTOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("nenhum conjunto tem item repetido dentro de si", () => {
    for (const c of CONJUNTOS) {
      expect(new Set(c.itens).size).toBe(c.itens.length);
    }
  });

  test("todo conjunto tem pelo menos 3 itens", () => {
    /* Dois itens não é conjunto, é par — e o selo não valeria a pena. */
    for (const c of CONJUNTOS) expect(c.itens.length).toBeGreaterThanOrEqual(3);
  });

  test("nenhum conjunto passa de 4 itens", () => {
    /* Quanto maior, mais longe fica o fecho — e conjunto que não fecha é a
       mecânica funcionando ao contrário: vira lembrete permanente de dívida. */
    for (const c of CONJUNTOS) expect(c.itens.length).toBeLessThanOrEqual(4);
  });

  test("o emoji do conjunto não é o de NENHUM item do catálogo", () => {
    /* O conjunto representa a CENA. Usando o emoji de um dos itens, a
       prateleira mostraria o mesmo desenho duas vezes — e a paciente leria o
       selo como se fosse mais uma cópia daquele item. Foi o que a primeira
       versão fazia (🌊 para o mar, 🕯️ para as luzes).

       ⚠️ A checagem é contra o CATÁLOGO INTEIRO, e não só contra os itens do
       próprio conjunto: um selo com o emoji de um item de outra prateleira
       colide igual, e o catálogo cresce — a versão estreita passaria a mentir
       no primeiro item novo. */
    const emojisDeItens = new Set(CANTINHO_ITEMS.map((i) => i.emoji));
    for (const c of CONJUNTOS) {
      expect(emojisDeItens.has(c.emoji)).toBe(false);
    }
  });

  test("os emojis dos conjuntos não repetem entre si", () => {
    const es = CONJUNTOS.map((c) => c.emoji);
    expect(new Set(es).size).toBe(es.length);
  });

  test("descrição descreve a cena, não a mecânica", () => {
    for (const c of CONJUNTOS) {
      expect(c.descricao.length).toBeGreaterThan(15);
      expect(c.descricao.toLowerCase()).not.toContain("complete");
      expect(c.descricao.toLowerCase()).not.toContain("conjunto");
      expect(c.descricao.toLowerCase()).not.toContain("bônus");
    }
  });
});

describe("progresso e conclusão", () => {
  const mar = CONJUNTO_POR_ID["mar"];

  test("sem nada: zero de quatro", () => {
    const p = progressoDoConjunto(mar, []);
    expect(p.tem).toBe(0);
    expect(p.total).toBe(4);
    expect(p.completo).toBe(false);
    expect(p.faltando.length).toBe(4);
  });

  test("com tudo: completo e sem faltar nada", () => {
    const p = progressoDoConjunto(mar, mar.itens);
    expect(p.tem).toBe(4);
    expect(p.completo).toBe(true);
    expect(p.faltando).toEqual([]);
  });

  test("parcial conta certo", () => {
    const p = progressoDoConjunto(mar, [mar.itens[0], mar.itens[1]]);
    expect(p.tem).toBe(2);
    expect(p.completo).toBe(false);
  });

  test("item de fora não conta", () => {
    const p = progressoDoConjunto(mar, ["planta-suculenta", "objeto-cestinho"]);
    expect(p.tem).toBe(0);
  });

  test("`conjuntosCompletos` só devolve os fechados", () => {
    const donos = [...mar.itens, "planta-girassol"];
    expect(conjuntosCompletos(donos)).toEqual(["mar"]);
  });

  test("dona de tudo fecha todos", () => {
    const tudo = CANTINHO_ITEMS.map((i) => i.id);
    expect(conjuntosCompletos(tudo).length).toBe(CONJUNTOS.length);
  });
});

describe("⚠️ a ordem NÃO empurra o que falta", () => {
  test("os completos vêm primeiro", () => {
    const mar = CONJUNTO_POR_ID["mar"];
    const noite = CONJUNTO_POR_ID["noite"];
    /* Fecha o mar; do da noite tem três de quatro (o "quase lá"). */
    const donos = [...mar.itens, ...noite.itens.slice(0, 3)];
    const ordem = conjuntosOrdenados(donos);
    expect(ordem[0].conjunto.id).toBe("mar");
    expect(ordem[0].completo).toBe(true);
    /* O "quase lá" fica em segundo, e não em primeiro — é a diferença entre
       celebrar e cobrar. */
    expect(ordem[1].conjunto.id).toBe("noite");
  });

  test("entre incompletos, o mais adiantado vem antes", () => {
    const noite = CONJUNTO_POR_ID["noite"];
    const cha = CONJUNTO_POR_ID["cha"];
    const donos = [...noite.itens.slice(0, 3), cha.itens[0]];
    const ordem = conjuntosOrdenados(donos).filter((p) => !p.completo);
    expect(ordem[0].conjunto.id).toBe("noite");
  });

  test("todos os conjuntos sempre aparecem", () => {
    expect(conjuntosOrdenados([]).length).toBe(CONJUNTOS.length);
  });
});

describe("o bônus", () => {
  test("é proporcional ao tamanho", () => {
    for (const c of CONJUNTOS) {
      expect(bonusDoConjunto(c)).toBe(c.itens.length * BONUS_POR_ITEM);
    }
  });

  test("a chave de dedupe é uma por conjunto", () => {
    expect(chaveDoBonus("mar")).toBe("conjunto:mar");
    const chaves = CONJUNTOS.map((c) => chaveDoBonus(c.id));
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  test("⚠️ fechar tudo não paga mais que uma loja grátis", () => {
    /* O bônus é reconhecimento, não renda. Se fechar os conjuntos pagasse mais
       do que a loja inteira custa, a mecânica viraria a fonte principal de
       Sementinhas — e aí o cantinho deixaria de ser gasto e viraria
       investimento, que é outro jogo.

       ⚠️ O TETO É DERIVADO DO CATÁLOGO, e não um 704 escrito à mão. O número
       cravado veio de uma contagem de agosto e mentiu no primeiro item novo:
       a ampliação de +50% dobrou o que uma paciente sem assinatura consegue
       comprar, e o teste teria reprovado conjuntos perfeitamente saudáveis
       enquanto a proporção que ele existe para proteger só melhorava. */
    const lojaGratis = CANTINHO_ITEMS.filter((i) => !i.premium && i.price > 0).reduce(
      (s, i) => s + i.price,
      0,
    );
    const total = CONJUNTOS.reduce((s, c) => s + bonusDoConjunto(c), 0);
    expect(total).toBeLessThan(lojaGratis);
  });
});

describe("conjuntosDoItem", () => {
  test("o golfinho sabe que é do mar", () => {
    expect(conjuntosDoItem("agua-golfinho").map((c) => c.id)).toContain("mar");
  });

  test("item de nenhum conjunto devolve lista vazia", () => {
    expect(conjuntosDoItem("fundo-simples")).toEqual([]);
  });

  test("item que não existe não estoura", () => {
    expect(conjuntosDoItem("nao-existe")).toEqual([]);
  });
});
