/**
 * O SITE PÚBLICO É UMA SUPERFÍCIE DE CUSTO ABERTA.
 *
 * O widget responde a qualquer pessoa, sem conta. O limitador que existia é por
 * IP — 20/min — e isso protege contra um visitante insistente, não contra o
 * problema: IPs são infinitos e baratos. Um raspador com mil endereços gera
 * vinte mil respostas por minuto na nossa chave, e a conta é da plataforma
 * (`doctor_id` nulo, cota de ninguém).
 *
 * O teto global é a única coisa que limita o PIOR caso. A troca é deliberada:
 * num pico de abuso o widget degrada, e o widget é vitrine — o chat da paciente
 * logada passa por outro balde e não é afetado.
 */

import { describe, expect, test } from "bun:test";
import { TETO_ANONIMO_POR_MINUTO, criarTetoAnonimo } from "@/routes/api/chat";

/** Um minuto cheio, em milissegundos, começando num instante conhecido. */
const T0 = 1_770_000_000_000;

describe("o teto global do site anônimo", () => {
  test("deixa passar até o teto", () => {
    const estourado = criarTetoAnonimo(3);
    expect([estourado(T0), estourado(T0), estourado(T0)]).toEqual([false, false, false]);
  });

  test("barra a partir da primeira acima do teto", () => {
    const estourado = criarTetoAnonimo(3);
    for (let i = 0; i < 3; i++) estourado(T0);
    expect(estourado(T0)).toBe(true);
  });

  test("o minuto seguinte zera", () => {
    /* Janela fixa, não deslizante: um abuso não pune o minuto inteiro seguinte.
       Uma janela que não zera transformaria um pico de dez segundos em um site
       fora do ar. */
    const estourado = criarTetoAnonimo(3);
    for (let i = 0; i < 5; i++) estourado(T0);
    expect(estourado(T0 + 60_000)).toBe(false);
  });

  test("voltar no tempo também troca de janela, sem contagem negativa", () => {
    /* Relógio de máquina em serverless pode andar para trás entre instâncias.
       O importante é não travar: qualquer minuto diferente reinicia. */
    const estourado = criarTetoAnonimo(3);
    for (let i = 0; i < 5; i++) estourado(T0);
    expect(estourado(T0 - 60_000)).toBe(false);
  });

  test("o teto padrão é 60 por minuto — literal", () => {
    /* Literal, e não derivado: um teste que só reafirma a constante passa verde
       quando alguém a troca por 1.000.000, que é o mesmo que não ter teto. */
    expect(TETO_ANONIMO_POR_MINUTO).toBe(60);
  });

  test("cada contador é independente", () => {
    /* Um estado de módulo compartilhado faria o teste de um vazar no outro — e,
       em produção, faria dois usos diferentes do limitador se atrapalharem. */
    const a = criarTetoAnonimo(1);
    const b = criarTetoAnonimo(1);
    a(T0);
    expect(a(T0)).toBe(true);
    expect(b(T0)).toBe(false);
  });
});
