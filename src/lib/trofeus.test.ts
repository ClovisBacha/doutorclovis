/**
 * TROFÉUS — o número do topo passou a significar alguma coisa.
 *
 * O troféu roxo mostrava `stickers.length` (figurinhas de álbum da semana). O
 * dono olhou e disse a coisa certa: "tenho três conquistas e ele marca oito,
 * não tem significado nenhum". Agora conta dias de CINCO ESTRELAS, e destranca
 * três itens da loja — o que transforma um número decorativo num motivo para
 * voltar amanhã.
 *
 * O que estes testes protegem, em ordem de gravidade:
 *  1. o número sai do LEDGER (servidor), nunca de `doneDays` (navegador);
 *  2. a compra é recusada NO SERVIDOR, senão o cadeado é decorativo;
 *  3. falha ao contar RECUSA, nunca libera.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ATIVIDADES_POR_TROFEU,
  PREFIXO_ATIVIDADE,
  TROFEUS_PARA,
  escadaDeTrofeus,
  faltamTrofeus,
  itemLiberado,
  proximoDesbloqueio,
  trofeusDasChaves,
  trofeusExigidos,
} from "./trofeus";
import { CANTINHO_BY_ID } from "./cantinho";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const cantinhoFns = semComentarios("src/lib/cantinho.functions.ts");
const sementinhas = semComentarios("src/lib/sementinhas.functions.ts");
const jogo = semComentarios("src/components/gestacao-path.tsx");
const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");
const css = readFileSync("src/styles.css", "utf8");

/** As quatro atividades de bem-estar, como o servidor as nomeia. */
const WELLNESS: readonly string[] = ["movement", "meditation", "bonding", "gratitude"];

describe("a escada dos três itens", () => {
  test("os três itens EXISTEM no catálogo", () => {
    /* Um id errado aqui não daria erro nenhum: o item simplesmente nunca
       pediria troféu, e o recurso não existiria para ninguém. */
    for (const id of Object.keys(TROFEUS_PARA)) {
      expect(CANTINHO_BY_ID[id]?.id).toBe(id);
    }
  });

  test("10 · 20 · 30, do mais barato ao mais caro", () => {
    expect(escadaDeTrofeus()).toEqual([
      { itemId: "bicho-borboleta", trofeus: 10 },
      { itemId: "fundo-deserto", trofeus: 20 },
      { itemId: "trilha-coracao", trofeus: 30 },
    ]);
  });

  test("a escada de troféus acompanha a de preço", () => {
    /* Pedir MAIS troféus por um item mais barato inverteria a leitura: a
       paciente veria o item caro abrir antes do barato. */
    const porTrofeu = escadaDeTrofeus().map((d) => CANTINHO_BY_ID[d.itemId].price);
    expect(porTrofeu).toEqual([...porTrofeu].sort((a, b) => a - b));
  });

  test("o troféu NÃO substitui o preço", () => {
    /* Ele diz QUANDO a prateleira aparece; a Sementinha continua pagando. Um
       item gratuito atrás de troféu seria uma segunda moeda escondida. */
    for (const id of Object.keys(TROFEUS_PARA)) {
      expect(CANTINHO_BY_ID[id].price).toBeGreaterThan(0);
    }
  });
});

describe("quantos faltam", () => {
  test("conta a diferença", () => {
    expect(faltamTrofeus("bicho-borboleta", 0)).toBe(10);
    expect(faltamTrofeus("bicho-borboleta", 6)).toBe(4);
    expect(faltamTrofeus("bicho-borboleta", 10)).toBe(0);
    expect(faltamTrofeus("bicho-borboleta", 99)).toBe(0);
  });

  test("item sem exigência está sempre liberado", () => {
    expect(trofeusExigidos("luz-vela")).toBe(0);
    expect(faltamTrofeus("luz-vela", 0)).toBe(0);
    expect(itemLiberado("luz-vela", 0)).toBe(true);
  });

  test("número torto não vira desbloqueio", () => {
    /* O contador vem de uma contagem que pode falhar e devolver `null`. */
    for (const v of [NaN, -5, undefined as unknown as number, null as unknown as number]) {
      expect(faltamTrofeus("bicho-borboleta", v)).toBe(10);
    }
  });

  test("o próximo desbloqueio é o horizonte, e acaba", () => {
    expect(proximoDesbloqueio(0)?.trofeus).toBe(10);
    expect(proximoDesbloqueio(10)?.trofeus).toBe(20);
    expect(proximoDesbloqueio(25)?.trofeus).toBe(30);
    /* Passou dos três: `null` em vez de uma quarta meta inventada. */
    expect(proximoDesbloqueio(30)).toBeNull();
  });
});

describe("a fonte é a PROVA, e não o recibo", () => {
  /* O dono fechou as cinco estrelas e o contador ficou em ZERO. A causa: a
     contagem lia `day_stars:`, gravada por UMA chamada, no instante exato do
     fechamento, dentro de um `try/catch` que engole erros. Rede oscilando ou
     app fechado antes da resposta e a linha nunca existe — sem rastro, sem
     segunda tentativa, troféu perdido para sempre.

     As linhas `wellness:` são gravadas uma por atividade, no momento em que
     cada uma é feita, e já eram o que `grantDayStarsBonus` consultava para
     decidir o bônus. Sempre foram a prova; `day_stars` era o recibo. */
  const chavesDoDia = (ciclo: string, dia: number, quais = WELLNESS) =>
    quais.map((a) => `${PREFIXO_ATIVIDADE}${a}:${ciclo}:${dia}`);

  test("quatro atividades no mesmo dia = um troféu", () => {
    expect(trofeusDasChaves(chavesDoDia("2026-03-07", 65), WELLNESS)).toBe(1);
  });

  test("três atividades NÃO valem troféu", () => {
    /* É o que separa "ela veio hoje" de "ela fechou o dia" — a chama mede o
       primeiro, o troféu mede o segundo. */
    expect(trofeusDasChaves(chavesDoDia("2026-03-07", 65, WELLNESS.slice(0, 3)), WELLNESS)).toBe(0);
  });

  test("dias diferentes somam", () => {
    const chaves = [
      ...chavesDoDia("2026-03-07", 63),
      ...chavesDoDia("2026-03-07", 64),
      ...chavesDoDia("2026-03-07", 65),
    ];
    expect(trofeusDasChaves(chaves, WELLNESS)).toBe(3);
  });

  test("o CICLO separa uma gestação da outra", () => {
    /* Sem o ciclo na chave do agrupamento, o dia 65 de duas gestações viraria
       um dia só — apagando um troféu de quem já teve outro bebê no app. */
    const chaves = [...chavesDoDia("2024-01-10", 65), ...chavesDoDia("2026-03-07", 65)];
    expect(trofeusDasChaves(chaves, WELLNESS)).toBe(2);
  });

  test("chave repetida não infla a conta", () => {
    const chaves = [...chavesDoDia("2026-03-07", 65), ...chavesDoDia("2026-03-07", 65)];
    expect(trofeusDasChaves(chaves, WELLNESS)).toBe(1);
  });

  test("atividade desconhecida não fecha o dia", () => {
    /* Se amanhã alguém gravar `wellness:banho:...`, o dia não pode passar a
       valer troféu com três atividades de verdade e uma inventada. */
    const chaves = [
      ...chavesDoDia("2026-03-07", 65, WELLNESS.slice(0, 3)),
      `${PREFIXO_ATIVIDADE}banho:2026-03-07:65`,
    ];
    expect(trofeusDasChaves(chaves, WELLNESS)).toBe(0);
  });

  test("outras linhas do ledger são ignoradas", () => {
    const chaves = [
      "checkin:2026-08-11",
      "day_stars:2026-03-07:65",
      "presente:med:pac:tok",
      "",
      null,
      undefined,
      ...chavesDoDia("2026-03-07", 65),
    ];
    expect(trofeusDasChaves(chaves, WELLNESS)).toBe(1);
  });

  test("dia que não é número é descartado", () => {
    const chaves = WELLNESS.map((a) => `${PREFIXO_ATIVIDADE}${a}:2026-03-07:hoje`);
    expect(trofeusDasChaves(chaves, WELLNESS)).toBe(0);
  });

  test("o servidor conta pelas chaves de atividade", () => {
    expect(PREFIXO_ATIVIDADE).toBe("wellness:");
    expect(ATIVIDADES_POR_TROFEU).toBe(4);
    expect(sementinhas).toMatch(/\.like\("dedupe_key", `\$\{PREFIXO_ATIVIDADE\}%`\)/);
    expect(sementinhas).toContain("trofeusDasChaves(");
  });

  test("o número de atividades sai da MESMA lista que grava", () => {
    /* Já foram seis, e depois cinco (a respiração virou tema da meditação).
       Um número cravado à mão faria o troféu parar de aparecer no dia em que
       a lista mudasse de novo. */
    expect(sementinhas).toMatch(/trofeusDasChaves\([\s\S]{0,120}WELLNESS_ACTIVITIES/);
    expect(ATIVIDADES_POR_TROFEU).toBe(WELLNESS.length);
  });

  test("nem a carteira nem a loja contam por doneDays", () => {
    expect(sementinhas).not.toMatch(/trofeus.*doneDays/);
    expect(cantinhoFns).not.toContain("journey_state");
  });

  test("a tela do Caminho recebe o número do servidor", () => {
    expect(jogo).toMatch(/setTrofeus\(w\.trofeus \?\? 0\)/);
    expect(jogo).not.toMatch(/text-violet-500">\{stickers\.length\}/);
  });
});

describe("o cadeado não pode ser decorativo", () => {
  test("a COMPRA confere no servidor", () => {
    expect(cantinhoFns).toContain("trofeusExigidos(item.id) > 0");
    expect(cantinhoFns).toContain("faltamTrofeus(item.id, trofeus)");
    expect(cantinhoFns).toMatch(/Faltam \$\{faltam\}/);
  });

  test("falha ao contar RECUSA a compra", () => {
    /* Liberar por não ter conseguido contar entrega o item a quem não o
       conquistou — e a Sementinha sairia do saldo dela do mesmo jeito. */
    const i = cantinhoFns.indexOf("if (falhou)");
    expect(i).toBeGreaterThan(-1);
    expect(cantinhoFns.slice(i, i + 160)).toContain("ok: false");
  });

  test("a checagem vem ANTES do débito", () => {
    const gate = cantinhoFns.indexOf("trofeusExigidos(item.id) > 0");
    const rpc = cantinhoFns.indexOf("buy_cantinho_item");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(rpc);
  });

  test("uma implementação só serve vitrine e compra", () => {
    /* Duas contagens para a mesma palavra é como o troféu do topo passou a
       discordar das conquistas — o defeito que abriu este trabalho. A loja
       DELEGA para `sementinhas.functions`, e não reimplementa a consulta. */
    expect(cantinhoFns).not.toContain('.like("dedupe_key"');
    expect(cantinhoFns).toContain('await import("@/lib/sementinhas.functions")');
    expect([...cantinhoFns.matchAll(/contarTrofeus\(supabaseAdmin, uid\)/g)]).toHaveLength(2);
  });

  test("a vitrine diz o que FALTA, não «bloqueado»", () => {
    expect(conta).toContain("faltam {faltamTrof} 🏆");
    expect(conta).toContain("1 troféu por dia de 5 estrelas");
  });
});

describe("o luto cala o troféu junto com o resto", () => {
  test("a carteira devolve zero em Modo Cuidado", () => {
    expect(sementinhas).toMatch(/careMode \? 0 : await contarTrofeus\(db, userId\)/);
  });

  test("e a loja também", () => {
    const i = cantinhoFns.indexOf("careMode: true as const");
    expect(i).toBeGreaterThan(-1);
    expect(cantinhoFns.slice(Math.max(0, i - 400), i)).toContain("trofeus: 0");
  });
});

describe("a comemoração dispara no fechamento do dia", () => {
  /* O defeito exato que o dono viu: ele fechou as cinco estrelas e NENHUMA
     animação apareceu. A festa estava condicionada a `novo > antes`, e a
     contagem daquele momento devolvia 0 — `0 > 0` é falso, e a tela
     simplesmente não existia. */
  test("nada de comparar números para decidir se comemora", () => {
    expect(jogo).not.toMatch(/if \(w\.trofeus > antes\)/);
    expect(jogo).not.toMatch(/trofeus > antes/);
  });

  test("`setTrofeuNovo` mora no bloco do dia fechado", () => {
    /* Esse bloco JÁ é o instante da conquista e JÁ roda uma vez por dia
       (`!doneDays.includes(D)`). Qualquer condição a mais entre ele e a tela é
       uma chance a mais de a conquista passar em branco. */
    /* ⚠️ Sem a guarda inteira: este teste cobra ONDE o troféu mora, não a
       forma exata da condição. Ele reprovou no dia em que a guarda ganhou um
       `!fechadosRef.current.has(D)` — sobre um código que continuava certo, e
       que na verdade estava CONSERTANDO um defeito (o fechamento do dia
       disparava duas vezes, dobrando confete, vibração e duas chamadas ao
       servidor). Teste que trava a assinatura em vez da intenção cobra
       manutenção sem dar proteção. */
    const i = jogo.indexOf("if (allDone && !doneDays.includes(D)");
    expect(i).toBeGreaterThan(-1);
    const bloco = jogo.slice(i, i + 2600);
    expect(bloco).toContain("setTrofeuNovo(agora)");
  });

  test("servidor caindo não engole a conquista", () => {
    /* Sem a rede o número sai errado por um; sem a rede E sem esta linha, a
       paciente fecha o dia e não vê nada. */
    expect(jogo).toMatch(/const agora = doServidor \?\? trofeus \+ 1;/);
  });

  test("e o efeito NÃO fica dentro do atualizador de estado", () => {
    /* React pode executar o atualizador duas vezes; duas execuções abririam a
       comemoração duas vezes. */
    expect(jogo).not.toMatch(/setTrofeus\(\(antes\) => \{[\s\S]{0,200}setTrofeuNovo/);
  });
});

describe("a animação do troféu", () => {
  test("roda UMA vez e para no último quadro", () => {
    /* Sem `forwards` a propriedade volta ao início e o troféu SOME no instante
       em que a última estrela acende — o quadro que a comemoração inteira
       existe para mostrar. */
    expect(css).toMatch(/dcTrofeuX 0\.83333s steps\(10, jump-none\) 6 forwards/);
    expect(css).toMatch(/dcTrofeuY 5s steps\(6, jump-none\) 1 forwards/);
  });

  test("o percurso fecha a grade 10×6 E PARA DENTRO DELA", () => {
    /* ⚠️ Este teste travava o defeito em vez de pegá-lo.
       A regra antiga — `to` em 100%·N/(N−1), 111,111% e 120% — vale para
       animação em LAÇO, onde nada é segurado no fim. Com `forwards`, o valor
       que fica é o `to` LITERAL, e ele está FORA da folha: `background-size:
       1000% 600%` só aceita 0–100%. Medido no navegador, aos 5,6 s a posição
       era `111.111% 120%` e o troféu estava invisível — meio segundo de
       comemoração vazia, e o quadro final nunca parado.

       `jump-none` reparte de 0% a 100% inclusive: os mesmos quadros durante a
       animação, e o último quadro no fim. O teste passa a cobrar o que
       importa: que o percurso TERMINE dentro da folha. */
    expect(css).toContain("background-position-x: 100%");
    expect(css).toMatch(/dcTrofeuY[\s\S]*?background-position-y: 100%/);
    expect(css).toContain("background-size: 1000% 600%");
  });

  test("o ÍCONE não roda em laço", () => {
    /* O quadro 0 da folha está 100% vazio (medido). Repetir a animação num
       ícone de 22px faria o troféu sumir e renascer a cada 5 s — lê como
       imagem quebrada, não como enfeite. */
    /* `lastIndexOf`: a classe aparece duas vezes — uma agrupada com
       `.dc-trofeu-anim` (fundo e grade, que são iguais nas duas) e outra
       sozinha, que é a que fixa o quadro. */
    const i = css.lastIndexOf(".dc-trofeu-fim {");
    expect(i).toBeGreaterThan(-1);
    const bloco = css.slice(i, css.indexOf("}", i));
    expect(bloco).toContain("background-position: 100% 100%");
    expect(bloco).not.toContain("animation");
  });

  test("tocar pula, e só fecha uma vez", () => {
    const trofeu = semComentarios("src/components/trofeu.tsx");
    expect(trofeu).toContain("onClick={fechar}");
    /* Dois toques rápidos chamariam `aoFechar` duas vezes. */
    expect(trofeu).toContain("if (fechado.current) return;");
  });

  test("MENOS MOVIMENTO mostra o troféu pronto, não some com a notícia", () => {
    /* Procura o bloco PELO SELETOR e não pela posição: `styles.css` tem vários
       `prefers-reduced-motion`, e o último é de outra tela. */
    const blocos = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g)]
      .map((m) => m[0])
      .filter((b) => b.includes(".dc-trofeu-anim"));
    expect(blocos).toHaveLength(1);
    expect(blocos[0]).toContain("animation: none");
    expect(blocos[0]).toContain("background-position: 100% 100%");
  });
});
