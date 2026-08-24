/**
 * O RESUMO ENTRA NO PRONTUÁRIO — E PRONTUÁRIO NÃO PODE MENTIR.
 *
 * Dois riscos, e os dois são caros. O primeiro é atribuir ao médico uma
 * aferição que a paciente fez em casa: `consultas.systolic` é lido como medida
 * de consultório por qualquer pessoa que abra o registro depois, inclusive num
 * processo. O segundo é o de sempre nesta base — compor uma sistólica de um dia
 * com uma diastólica de outro e escrever o par inventado.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resumoParaAchados } from "./resumo-da-consulta";
import type { EventoClinico } from "./clinical.functions";

const ev = (p: Partial<EventoClinico>): EventoClinico =>
  ({
    fonte: "health_logs",
    fonte_id: Math.random().toString(36).slice(2),
    user_id: "u1",
    ocorrido_em: "2026-08-10T10:00:00Z",
    especie: "medida",
    dados: {},
    texto: null,
    gravidade: "normal",
    tratado_em: null,
    ...p,
  }) as EventoClinico;

const AGORA = new Date("2026-08-20T12:00:00Z");
const DESDE = "2026-08-01T10:00:00Z";

describe("1. o recorte do período", () => {
  test("só entra o que aconteceu DEPOIS da última consulta", () => {
    /* O que ele já viu na consulta anterior não é novidade — repetir enche o
       campo de achados de coisa velha e o médico para de ler o bloco. */
    const r = resumoParaAchados(
      [
        ev({ ocorrido_em: "2026-07-20T10:00:00Z", dados: { weight_kg: 60 } }),
        ev({ ocorrido_em: "2026-08-10T10:00:00Z", dados: { weight_kg: 62 } }),
      ],
      DESDE,
      AGORA,
    );
    expect(r).toContain("62 kg");
    expect(r).not.toContain("60");
  });

  test("nada no período devolve string VAZIA, e não um texto vazio de conteúdo", () => {
    /**
     * Um cabeçalho sozinho ("Desde a última consulta…") sem nenhuma linha faria
     * o médico apagar à mão em toda consulta de paciente que não usa o app.
     */
    expect(resumoParaAchados([], DESDE, AGORA)).toBe("");
    expect(
      resumoParaAchados(
        [ev({ ocorrido_em: "2026-07-01T10:00:00Z", dados: { weight_kg: 60 } })],
        DESDE,
        AGORA,
      ),
    ).toBe("");
  });

  test("sem consulta anterior, pega tudo — e o cabeçalho não inventa uma data", () => {
    const r = resumoParaAchados([ev({ dados: { weight_kg: 62 } })], null, AGORA);
    expect(r).toContain("Registrado por ela no app");
    expect(r).not.toContain("última consulta");
  });

  test("o futuro não entra", () => {
    /* Data digitada errada pela paciente, ou fuso invertido em algum lugar. */
    expect(
      resumoParaAchados(
        [ev({ ocorrido_em: "2026-09-30T10:00:00Z", dados: { weight_kg: 62 } })],
        DESDE,
        AGORA,
      ),
    ).toBe("");
  });
});

describe("2. a pressão sai como PAR, do mesmo registro", () => {
  test("usa a última medida completa e conta as fora de faixa", () => {
    const r = resumoParaAchados(
      [
        ev({
          ocorrido_em: "2026-08-05T10:00:00Z",
          dados: { systolic: 118, diastolic: 76 },
          gravidade: "normal",
        }),
        ev({
          ocorrido_em: "2026-08-12T10:00:00Z",
          dados: { systolic: 148, diastolic: 95 },
          gravidade: "atencao",
        }),
      ],
      DESDE,
      AGORA,
    );
    expect(r).toContain("148/95");
    expect(r).toContain("1 fora da faixa");
    expect(r).toContain("2 registros");
  });

  test("registro com METADE da pressão não vira par", () => {
    /**
     * O defeito clássico desta base, agora com consequência escrita: uma
     * sistólica solta emparelhada com a diastólica de outro dia entraria no
     * prontuário como um valor aferido que nunca existiu.
     */
    const r = resumoParaAchados(
      [
        ev({ ocorrido_em: "2026-08-05T10:00:00Z", dados: { systolic: 160 } }),
        ev({ ocorrido_em: "2026-08-12T10:00:00Z", dados: { diastolic: 70 } }),
      ],
      DESDE,
      AGORA,
    );
    expect(r).not.toContain("160");
    expect(r).not.toContain("PA em casa");
  });

  test("todas na faixa é dito, e não omitido", () => {
    /* "Ela mediu seis vezes e estava tudo bem" é informação clínica: significa
       que ela está aderente. Omitir faria parecer que ela não mediu. */
    const r = resumoParaAchados(
      [ev({ dados: { systolic: 118, diastolic: 76 }, gravidade: "normal" })],
      DESDE,
      AGORA,
    );
    expect(r).toContain("todas na faixa");
  });
});

describe("3. o peso", () => {
  test("com dois pesos, diz a variação do período", () => {
    const r = resumoParaAchados(
      [
        ev({ ocorrido_em: "2026-08-05T10:00:00Z", dados: { weight_kg: 66.6 } }),
        ev({ ocorrido_em: "2026-08-15T10:00:00Z", dados: { weight_kg: 68.4 } }),
      ],
      DESDE,
      AGORA,
    );
    expect(r).toContain("68.4 kg");
    expect(r).toContain("+1.8 kg no período");
  });

  test("com UM peso, não fala em variação", () => {
    /**
     * "Variou 0 kg" seria uma afirmação sobre um período que não foi medido — e
     * escrita no prontuário, viraria "peso estável" na leitura de quem vier
     * depois.
     */
    const r = resumoParaAchados([ev({ dados: { weight_kg: 68.4 } })], DESDE, AGORA);
    expect(r).toContain("68.4 kg");
    expect(r).not.toContain("no período");
  });

  test("perda de peso aparece com o sinal", () => {
    const r = resumoParaAchados(
      [
        ev({ ocorrido_em: "2026-08-05T10:00:00Z", dados: { weight_kg: 70 } }),
        ev({ ocorrido_em: "2026-08-15T10:00:00Z", dados: { weight_kg: 68.5 } }),
      ],
      DESDE,
      AGORA,
    );
    expect(r).toContain("-1.5 kg");
  });
});

describe("4. sintomas e emergência", () => {
  test("o que ela relatou entra com a data", () => {
    const r = resumoParaAchados(
      [
        ev({
          especie: "sintoma",
          texto: "dor de cabeça forte",
          ocorrido_em: "2026-08-12T10:00:00Z",
        }),
      ],
      DESDE,
      AGORA,
    );
    expect(r).toContain("dor de cabeça forte");
    expect(r).toContain("12/08");
  });

  test("a emergência entra SEMPRE, e por último", () => {
    /**
     * Por último para ficar no fim do bloco, visível mesmo com o textarea
     * rolado. É a linha que não pode ser cortada.
     */
    const r = resumoParaAchados(
      [
        ev({ dados: { weight_kg: 68 } }),
        ev({ especie: "emergencia", ocorrido_em: "2026-08-14T10:00:00Z" }),
      ],
      DESDE,
      AGORA,
    );
    const linhas = r.split("\n");
    expect(linhas[linhas.length - 1]).toContain("emergência");
    expect(linhas[linhas.length - 1]).toContain("14/08");
  });
});

describe("5. a linha que não se cruza", () => {
  test("o resumo NÃO preenche campo de medida da consulta", () => {
    /**
     * `consultas.systolic` é o que o MÉDICO aferiu. Preenchê-lo com a pressão
     * que ela mediu em casa faria o prontuário afirmar uma aferição que não
     * aconteceu — e é assim que ela é lida por outro profissional meses depois.
     *
     * Este teste lê o CÓDIGO porque a regra não é sobre o valor de retorno: é
     * sobre o formulário nunca receber esses campos daqui.
     */
    const fonte = readFileSync("src/components/registrar-consulta.tsx", "utf8");

    /* ─── A ÂNCORA É A FUNÇÃO, E NÃO A PALAVRA ────────────────────────────
       A primeira versão fazia `indexOf("resumoParaAchados")` — e casava com a
       LINHA DE IMPORT, no topo do arquivo. Um mutante que preenchia
       `systolic:` dentro do `abrir()` passou por ela inteirinho, porque a
       janela de 400 caracteres em volta do import não alcança a função.
       É a mesma armadilha que já pegou quatro testes desta base: a asserção
       satisfeita por outra ocorrência do mesmo nome. */
    const i = fonte.indexOf("function abrir()");
    expect(i).toBeGreaterThan(-1);
    const fim = fonte.indexOf("\n  }", i);
    expect(fim).toBeGreaterThan(i);
    const corpoDoAbrir = fonte.slice(i, fim);

    /* A função tem de USAR o resumo — senão o teste abaixo passa por vazio. */
    expect(corpoDoAbrir).toContain("resumoParaAchados(");
    /* E não pode escrever nenhum campo de medida a partir dele. */
    for (const campo of ["systolic:", "diastolic:", "pesoKg:", "bpmFetal:", "alturaUterinaCm:"]) {
      expect(corpoDoAbrir).not.toContain(campo);
    }
  });

  test("o texto diz de onde veio", () => {
    /* É esta frase que impede o bloco de ser lido como aferição de consultório
       quando alguém abrir o prontuário daqui a três anos. */
    const r = resumoParaAchados([ev({ dados: { weight_kg: 68 } })], DESDE, AGORA);
    expect(r).toContain("por ela no app");
  });
});
