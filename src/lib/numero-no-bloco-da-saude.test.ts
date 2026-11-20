/**
 * O NÚMERO DELA CHEGA AO BLOCO DA SAÚDE — set/2026.
 *
 * ⚠️ ESTE RECURSO JÁ MORREU UMA VEZ, EM SILÊNCIO, e a forma como ele morreu é a
 * razão desta catraca existir.
 *
 * O dono pediu duas coisas para a aba Saúde: blocos que "preencham a tela
 * inteira" e o número dela dentro deles (o último peso, os chutes de hoje, as
 * contrações de hoje). As duas foram entregues — e o número só é desenhado
 * atrás de `preencherTela`, que em `HubSaude` era `itens.length === 4`.
 *
 * Dias depois, o estudo de navegação fez os CINCO ladrilhos aparecerem sempre
 * (no celular "Saúde da mulher" sumia por nove meses). `itens.length` virou
 * constante 5, `itens.length === 4` virou constante FALSA, e os dois pedidos do
 * dono deixaram de existir sem uma linha de erro: a grade voltou ao quadrado e
 * o número nunca mais apareceu. Pior, as TRÊS consultas ao banco que buscam
 * esses números continuaram saindo a cada abertura da aba — três idas a São
 * Paulo por visita, com o resultado jogado fora.
 *
 * É a classe que este repositório mais paga: duas metades certas sozinhas, e a
 * corrente quebrada entre elas. Nem `tsc`, nem lint, nem teste pegavam — a
 * expressão compila, e o que ela devolve é um booleano perfeitamente válido.
 *
 * O que esta catraca cobra é a CORRENTE, e não a grafia:
 *   1. o bloco grande é o único que desenha o número;
 *   2. `HubSaude` pede o bloco grande sem depender de uma CONTAGEM de ladrilhos;
 *   3. quem busca os números continua ligado a quem os desenha;
 *   4. a altura por linha é um PISO, e não uma altura fechada repartida — foi
 *      isso que cortava o rótulo quando a grade passou a ter três linhas.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "@/lib/sem-comentarios";

/* A prosa deste arquivo e a dos dois alvos CITAM o que proíbem ("itens.length
   === 4", "auto-rows-fr"). Sem tirar os comentários, a busca mentiria nas duas
   direções — aprovando o defeito documentado ou reprovando o conserto que o
   explica. */
/* ⚠️ **O APAGADOR PRÓPRIO NÃO RECONHECIA COMENTÁRIO DE JSX** — ele testava
   `t.startsWith("/*")`, e um comentário de JSX começa com `{`. Então
   um comentário de JSX sobrevivia inteiro, e a prosa nova podia REPROVAR
   código correto (ou aprovar o defeito documentado). A régua única é
   `src/lib/sem-comentarios.ts`, e ela existe justamente porque as duas formas
   ingênuas — a de regex e a de linha — mordem nos dois sentidos. */
const GRADE = semComentarios(readFileSync("src/components/grade-hub.tsx", "utf8"));
/**
 * ⚠️ O HUB saiu de `minha-conta.tsx` para cá (set/2026): ele era `export
 * function` num arquivo de ROTA, e isso o içava para o pedaço de ENTRADA que
 * toda página do site baixa. Só o CAMINHO mudou; a garantia, nenhuma linha.
 */
const HUB = semComentarios(readFileSync("src/components/hub-saude.tsx", "utf8"));

/**
 * O corpo de `HubSaude`, do `export function` até o fim.
 *
 * ⚠️ **Ele é a ÚLTIMA declaração do arquivo, e por isso a fatia vai até o
 * fim** — a âncora antiga (`\nconst CAT_STYLE`) era a declaração seguinte no
 * arquivo de rota, e uma âncora que não casa devolve −1, que `slice` lê como
 * "um caractere antes do fim": a fatia sairia quase VAZIA e as asserções
 * negativas ficariam verdes sobre nada. Daí a conferência de TAMANHO, e a de
 * que o corte não engoliu uma segunda função — é como uma fatia começa a
 * mentir.
 */
function corpoDoHub(): string {
  const i = HUB.indexOf("export function HubSaude");
  expect(i).toBeGreaterThan(0);
  const corpo = HUB.slice(i);
  expect(corpo.length).toBeGreaterThan(2000);
  expect(corpo).not.toContain("\nexport function ");
  return corpo;
}

describe("o número dela chega ao bloco da Saúde", () => {
  test("só o bloco grande desenha o número — é ele que precisa estar ligado", () => {
    expect(GRADE).toContain("preencherTela && dado");
  });

  test("HubSaude pede o bloco grande SEM depender de contagem de ladrilhos", () => {
    const hub = corpoDoHub();
    expect(hub).toContain("preencherTela");
    /* ⚠️ Uma CONTAGEM aqui é exatamente como o recurso morreu: os ladrilhos
       passaram a ser sempre cinco e a condição virou constante falsa. Se um dia
       a grade voltar a ter contagem variável, ela não pode decidir isto. */
    expect(hub).not.toMatch(/preencherTela=\{[^}]*itens\.length/);
    expect(hub).not.toMatch(/preencherTela=\{[^}]*\.length ===/);
  });

  test("quem BUSCA os números continua ligado a quem os DESENHA", () => {
    const hub = corpoDoHub();
    /* As três leituras existem para alimentar o `dado` de cada ladrilho. Se
       alguém desligar o desenho e esquecer as consultas, o app paga três idas
       ao banco por visita para não mostrar nada — foi o que aconteceu. */
    for (const tabela of ["health_logs", "kick_sessions", "contraction_logs"]) {
      expect(hub).toContain(tabela);
    }
    expect(hub).toContain("dado: dados[i.key] ?? null");
  });

  test("a altura por linha é um PISO, nunca uma altura fechada repartida", () => {
    /* Com `h-[…]` + `auto-rows-fr`, três linhas recebiam ~196px cada, o ícone
       sozinho pedia 144, e o `overflow-hidden` cortava o RÓTULO — o bloco
       mostrava o número e escondia o nome do que ele é. Medido a 393, 375, 320
       e 430px: com o piso por linha são 291px e nada corta. */
    const i = GRADE.indexOf("preencherTela\n          ?");
    const bloco = i > 0 ? GRADE.slice(i, i + 400) : GRADE;
    expect(bloco).toContain("auto-rows-[minmax(");
    expect(bloco).not.toContain("auto-rows-fr");
    expect(bloco).toContain("min-h-[calc(");
  });

  test("qualquer falha de leitura vira `null`, e `null` não desenha nada", () => {
    const hub = corpoDoHub();
    /* "Não consegui ler" e "ela nunca registrou" caem no mesmo lugar: um "0"
       afirmaria um fato que a tela não tem como saber. */
    expect(hub).toContain("r.error ? null");
    expect(GRADE).toContain("preencherTela && dado");
  });
});
