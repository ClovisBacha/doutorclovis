/**
 * A DICA DA PLATAFORMA NÃO PODE APONTAR O PAINEL ERRADO.
 *
 * Uma sugestão errada é pior que nenhuma: ela tem exatamente a mesma cara da
 * certa. O médico abre a ficha, vê um painel marcado como "o dela" e manda — e
 * quem está em 30 semanas recebe o pedido do primeiro trimestre.
 */

import { describe, expect, test } from "bun:test";
import { exameSugerido, faixaDoTitulo } from "./exame-sugerido";

/* Os títulos REAIS dos painéis do produto. Copiados, e não inventados: o valor
   deste módulo é ler a faixa do título de verdade, então um título de mentira
   testaria outra coisa. */
const PAINEIS = [
  { title: "1º Trimestre — 8 a 13 semanas" },
  { title: "2º Trimestre — 18 a 28 semanas" },
  { title: "3º Trimestre — 32 a 37 semanas" },
];

describe("1. a faixa sai do título", () => {
  test("lê as três faixas do produto", () => {
    expect(faixaDoTitulo(PAINEIS[0].title)).toEqual({ de: 8, ate: 13 });
    expect(faixaDoTitulo(PAINEIS[1].title)).toEqual({ de: 18, ate: 28 });
    expect(faixaDoTitulo(PAINEIS[2].title)).toEqual({ de: 32, ate: 37 });
  });

  test("título sem faixa não vira faixa inventada", () => {
    expect(faixaDoTitulo("Painel de rotina")).toBeNull();
    /* Números sem a palavra "semanas" não são faixa gestacional. Sem essa
       exigência, um painel futuro chamado "Retorno 2 a 3 dias" viraria "da 2ª à
       3ª semana" e seria sugerido para uma gestante de 2 semanas. */
    expect(faixaDoTitulo("Retorno — 2 a 3 dias")).toBeNull();
  });

  test("faixa invertida é descartada, não usada de trás para frente", () => {
    /* "37 a 32" é erro de digitação. Aceitar e ordenar sozinho esconderia o
       erro no título, que é onde ele precisa ser visto e corrigido. */
    expect(faixaDoTitulo("3º Trimestre — 37 a 32 semanas")).toBeNull();
  });
});

describe("2. quem é sugerida para quem", () => {
  test("cada trimestre aponta o seu painel", () => {
    expect(exameSugerido(PAINEIS, 10)).toBe(0);
    expect(exameSugerido(PAINEIS, 26)).toBe(1);
    expect(exameSugerido(PAINEIS, 35)).toBe(2);
  });

  test("as bordas da faixa entram — os dois lados", () => {
    /* 8 e 13 fazem parte do primeiro trimestre. Um `>` no lugar do `>=` tiraria
       da sugestão justamente a semana em que o painel começa a valer. */
    expect(exameSugerido(PAINEIS, 8)).toBe(0);
    expect(exameSugerido(PAINEIS, 13)).toBe(0);
    expect(exameSugerido(PAINEIS, 18)).toBe(1);
    expect(exameSugerido(PAINEIS, 28)).toBe(1);
  });

  test("entre as faixas NÃO sugere nada — e isso é o ponto", () => {
    /**
     * 14 a 17 e 29 a 31 são vãos de verdade: nenhum painel de rotina é o certo
     * ali. Chutar o mais próximo devolveria uma sugestão com cara de certa.
     */
    expect(exameSugerido(PAINEIS, 15)).toBeNull();
    expect(exameSugerido(PAINEIS, 30)).toBeNull();
  });

  test("antes da primeira e depois da última também é nada", () => {
    expect(exameSugerido(PAINEIS, 4)).toBeNull();
    expect(exameSugerido(PAINEIS, 40)).toBeNull();
  });

  test("sem semana não há sugestão — e nada quebra", () => {
    /* Cadastro novo, puérpera, DUM não preenchida. */
    expect(exameSugerido(PAINEIS, null)).toBeNull();
    expect(exameSugerido(PAINEIS, undefined)).toBeNull();
    expect(exameSugerido(PAINEIS, NaN)).toBeNull();
  });

  test("painel sem faixa no título é pulado, não escolhido", () => {
    /* Se um painel novo entrar sem faixa, ele não pode virar a sugestão de
       todo mundo só por estar primeiro na lista. */
    const comExtra = [{ title: "Painel avulso" }, ...PAINEIS];
    expect(exameSugerido(comExtra, 10)).toBe(1);
    expect(exameSugerido(comExtra, 15)).toBeNull();
  });
});
