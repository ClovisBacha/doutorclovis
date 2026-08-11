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
  PREFIXO_TROFEU,
  TROFEUS_PARA,
  escadaDeTrofeus,
  faltamTrofeus,
  itemLiberado,
  proximoDesbloqueio,
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

describe("a fonte é o LEDGER, e não o navegador", () => {
  test("a contagem lê as linhas `day_stars:`", () => {
    /* `doneDays` mora no localStorage e sobe no blob do `journey_state` — quem
       o escreve é o navegador, e ele destrancaria item pago. A linha
       `day_stars:` só é gravada pelo servidor, e só depois de o ledger
       confirmar as cinco atividades do dia. */
    expect(PREFIXO_TROFEU).toBe("day_stars:");
    expect(sementinhas).toContain('grantSementinhas(db, uid, [{ amount, reason: "5 estrelas');
    expect(sementinhas).toMatch(/const dedupeKey = `day_stars:\$\{cycle\}:\$\{data\.day\}`/);
  });

  test("nem a carteira nem a loja contam por doneDays", () => {
    expect(sementinhas).not.toMatch(/trofeus.*doneDays/);
    expect(cantinhoFns).not.toContain("journey_state");
  });

  test("a tela do Caminho recebe o número do servidor", () => {
    expect(jogo).toMatch(/setTrofeus\(w\.trofeus \?\? 0\)/);
    /* E o topo não mostra mais figurinhas de álbum no lugar de troféu. */
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

  test("uma contagem só serve vitrine e compra", () => {
    /* Duas contagens para a mesma palavra é como o troféu do topo passou a
       discordar das conquistas — o defeito que abriu este trabalho. */
    expect([
      ...cantinhoFns.matchAll(/\.like\("dedupe_key", `\$\{PREFIXO_TROFEU\}%`\)/g),
    ]).toHaveLength(1);
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

describe("a animação do troféu", () => {
  test("roda UMA vez e para no último quadro", () => {
    /* Sem `forwards` a propriedade volta ao início e o troféu SOME no instante
       em que a última estrela acende — o quadro que a comemoração inteira
       existe para mostrar. */
    expect(css).toMatch(/dcTrofeuX 0\.83333s steps\(10\) 6 forwards/);
    expect(css).toMatch(/dcTrofeuY 5s steps\(6\) 1 forwards/);
  });

  test("o percurso fecha a grade 10×6", () => {
    /* Para N colunas, `steps(N)` amostra em i/N — o percurso tem de ir a
       100%·N/(N−1) para os pontos caírem em 0…100%. 10 colunas → 111.111%;
       6 linhas → 120%. Errar engole o último quadro e repete o primeiro. */
    expect(css).toContain("background-position-x: 111.1111%");
    expect(css).toMatch(/dcTrofeuY[\s\S]*?background-position-y: 120%/);
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
