/**
 * O CORTE QUE AVISA "VOCÊ JÁ ESCREVEU ISSO".
 *
 * ─── POR QUE O AVISO EXISTE ─────────────────────────────────────────────────
 *
 * `addBrainEntry` inseria sem `onConflict` e sem nenhuma checagem de
 * semelhança. E a faixa do meio EMPURRA para a duplicata: material próximo não
 * assina o nome dele → vira lacuna → ele responde → nasce uma SEGUNDA entrada
 * sobre o mesmo assunto, competindo com a primeira na busca vetorial.
 *
 * As lacunas se agrupam por vetor desde sempre. As entradas — que são o ativo,
 * o que ele de fato escreveu — não tinham nada. Com o tempo o cérebro passa a
 * ter duas verdades sobre o mesmo tema e nada escolhe entre elas: a busca
 * devolve a que estiver por um fio mais perto, inclusive a versão velha que ele
 * teria corrigido se soubesse que existia.
 *
 * ─── POR QUE UM CORTE PRÓPRIO, MAIS ALTO ────────────────────────────────────
 *
 * Aqui o custo do falso positivo é diferente de todos os outros cortes do
 * sistema: interromper o médico no meio de um trabalho legítimo. "Enjoo no
 * primeiro trimestre" e "azia no terceiro" casam em torno de 0,65 e são coisas
 * diferentes — avisar ali ensina o médico a ignorar o aviso, que é o mesmo
 * que não ter aviso.
 */

import { describe, expect, test } from "bun:test";
import {
  ATRIBUICAO_MIN_SIMILARITY,
  DUPLICATA_MIN_SIMILARITY,
  SEMANTIC_MIN_SIMILARITY,
} from "./secondbrain.server";

describe("o corte de duplicata", () => {
  test("é 0,80 — literal, e não derivado de outro corte", () => {
    /* Literal de propósito. Um teste que só compara constantes entre si passa
       verde quando alguém mexe em todas juntas — foi medido nesta base: trocar
       os dois cortes de similaridade por 0,99 mantinha a suíte inteira verde. */
    expect(DUPLICATA_MIN_SIMILARITY).toBe(0.8);
  });

  test("fica ACIMA do corte que assina o nome do médico", () => {
    /* Se fosse abaixo, o sistema seria incoerente consigo mesmo: um par que o
       chat considera bom o bastante para responder COMO SE FOSSE ELE seria
       tratado aqui como assunto distinto o bastante para virar entrada nova. */
    expect(DUPLICATA_MIN_SIMILARITY).toBeGreaterThan(ATRIBUICAO_MIN_SIMILARITY);
  });

  test("fica bem acima do corte que só injeta o material", () => {
    /* `SEMANTIC` (0,62) é "vale a pena mostrar isto ao modelo". Usar o mesmo
       número aqui faria o aviso disparar em assuntos vizinhos — 1º e 3º
       trimestre — e o médico aprenderia a clicar em "criar mesmo assim" sem
       ler. Um aviso que ninguém lê é pior que nenhum: dá a sensação de que o
       problema está coberto. */
    expect(DUPLICATA_MIN_SIMILARITY - SEMANTIC_MIN_SIMILARITY).toBeGreaterThanOrEqual(0.15);
  });

  test("não chega a exigir texto idêntico", () => {
    /* Acima de ~0,95 só casaria a mesma frase escrita igual — e é justamente a
       mesma pergunta escrita de OUTRO jeito que produz a duplicata que ninguém
       percebe. Um corte alto demais devolve o defeito original com um aviso
       que nunca aparece. */
    expect(DUPLICATA_MIN_SIMILARITY).toBeLessThan(0.9);
  });
});

describe("a ordem dos três cortes conta uma história coerente", () => {
  test("injetar < assinar < avisar de duplicata", () => {
    /* Cada degrau exige mais confiança que o anterior, e cada um autoriza uma
       coisa mais forte: usar o material, assinar o nome dele, e afirmar que é
       a mesma coisa que ele já escreveu. */
    expect(SEMANTIC_MIN_SIMILARITY).toBeLessThan(ATRIBUICAO_MIN_SIMILARITY);
    expect(ATRIBUICAO_MIN_SIMILARITY).toBeLessThan(DUPLICATA_MIN_SIMILARITY);
  });
});
