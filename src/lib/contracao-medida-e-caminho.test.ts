import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { analyzeContractions, tendenciaDaIntensidade } from "@/lib/analise-de-contracoes";
import {
  INTENSIDADE_PADRAO,
  NIVEIS_DE_INTENSIDADE,
  nivelDeIntensidade,
} from "@/lib/intensidade-da-contracao";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * A INTENSIDADE VIROU MEDIDA, E A TELA GANHOU CAMINHO.
 *
 * Este arquivo guarda a leva de set/2026 do cronômetro de contrações, medida
 * antes de ser escrita:
 *
 *  · a intensidade era escolhida ANTES da contração (previsão, não medida) e o
 *    seletor sumia enquanto ela acontecia;
 *  · não havia como corrigir nem apagar UMA contração — só o histórico inteiro;
 *  · o bloco que manda "procurar a maternidade agora" era texto puro, sem
 *    telefone, e o 192 só existia no caso `urgente` da análise;
 *  · a intensidade era coletada, desenhada como altura na fita, e NUNCA lida:
 *    sete "Forte" numa hora produziam o mesmo texto que sete "Leve";
 *  · o botão do cronômetro caía FORA da dobra (medido: y=876, 864 e 868 num
 *    viewport de 852).
 *
 * ⚠️ Tudo que lê fonte passa por `semComentarios`: a prosa deste repositório
 * cita o que ela proíbe, e um `toContain` sobre um comentário já ficou verde
 * sobre o defeito que ele existia para pegar — dez vezes.
 */

const TELA = semComentarios(readFileSync("src/components/contracoes-tab.tsx", "utf8"));
const REGUA = semComentarios(readFileSync("src/lib/analise-de-contracoes.ts", "utf8"));

/** O corpo de uma função do componente, da assinatura até a próxima. */
function corpoDe(nome: string): string {
  const i = TELA.indexOf(`function ${nome}(`);
  expect(i).toBeGreaterThan(0);
  const j = TELA.indexOf("\n  async function ", i + 10);
  const k = TELA.indexOf("\n  function ", i + 10);
  const fins = [j, k].filter((n) => n > 0);
  const fim = fins.length ? Math.min(...fins) : TELA.length;
  const corpo = TELA.slice(i, fim);
  /* Uma fatia que engoliu a função seguinte deixa de provar o que diz. */
  expect(corpo.length).toBeLessThan(2600);
  return corpo;
}

const t = (min: number, intensidade: number) => ({
  started_at: new Date(Date.UTC(2026, 8, 5, 12, min)).toISOString(),
  ended_at: new Date(Date.UTC(2026, 8, 5, 12, min, 40)).toISOString(),
  intensity: intensidade,
});

describe("o catálogo da intensidade é um só", () => {
  test("os TRÊS níveis falam — ao contrário da força do movimento", () => {
    /* Lá o nível do meio é "como sempre", a ausência de notícia, e cala. Aqui
       "Moderada" é uma medida que ela tomou: calá-la mostraria buraco onde há
       dado. É a diferença deliberada entre os dois catálogos. */
    for (const n of NIVEIS_DE_INTENSIDADE) {
      expect(n.chip.length).toBeGreaterThan(0);
      expect(n.frase.length).toBeGreaterThan(0);
      expect(n.plural.length).toBeGreaterThan(0);
    }
  });

  test("fora do catálogo é `null`, nunca o padrão", () => {
    /* Cravar "moderada" aqui faria o leitor AFIRMAR uma medida que ela não
       tomou — a mesma régua de `nivelDeForca`. */
    expect(nivelDeIntensidade(0)).toBeNull();
    expect(nivelDeIntensidade(4)).toBeNull();
    expect(nivelDeIntensidade(null)).toBeNull();
    expect(nivelDeIntensidade(undefined)).toBeNull();
    expect(nivelDeIntensidade(2)?.rotulo).toBe("Moderada");
  });

  test("o padrão é o nível do MEIO", () => {
    /* A intensidade é marcada DURANTE a contração: abrir em "Leve" ou "Forte"
       empurraria o autorrelato de quem não mexeu. */
    expect(INTENSIDADE_PADRAO).toBe(2);
  });

  test("a tela e o prontuário leem o MESMO catálogo", () => {
    /* O defeito: o catálogo morava dentro do componente, então ela via "Forte"
       e o médico lia "intensidade 3". */
    /* ⚠️ A régua do que o médico lê mora em `lib/` desde set/2026 — ela saiu
       do componente para poder ser EXECUTADA num teste. */
    const prontuario = semComentarios(readFileSync("src/lib/linha-do-tempo-clinica.ts", "utf8"));
    expect(TELA).toContain("intensidade-da-contracao");
    expect(prontuario).toContain("intensidade-da-contracao");
    /* E ninguém pode ter reintroduzido uma tabela local de rótulos. */
    expect(TELA).not.toContain("INTENSITY_LABEL");
    /* ⚠️ A asserção é sobre a GARANTIA — quem decide a palavra é o catálogo —,
       e não sobre a grafia: o número cru CONTINUA no arquivo como recuo para
       um valor fora do catálogo, e uma busca por ele reprovaria o conserto.
       É a décima sexta vez que essa armadilha aparece neste repositório. */
    expect(prontuario).toContain("nivelDeIntensidade(d.intensidade)");
    expect(prontuario).toMatch(/contração \$\{nivel\?\.frase/);
  });
});

describe("a intensidade é uma MEDIDA, não uma previsão", () => {
  test("o seletor NÃO vive atrás de `!active`", () => {
    /* Era `{!active && (…seletor…)}`: ela escolhia antes de sentir, e o
       seletor sumia justamente enquanto a contração acontecia. */
    expect(TELA).not.toMatch(/\{!active && \(\s*<div className="mt-4 flex justify-center/);
    expect(TELA).toContain("NIVEIS_DE_INTENSIDADE.map");
  });

  test("o encerrar grava a intensidade junto com `ended_at`", () => {
    const corpo = corpoDe("stopContraction");
    expect(corpo).toMatch(/\.update\(\{\s*ended_at:[^}]*intensity/);
  });

  test("a contração restaurada traz a intensidade dela de volta", () => {
    /* Sem isto, uma contração retomada (troca de aba, app fechado no meio)
       seria encerrada com o PADRÃO por cima do que ela marcou. */
    const corpo = corpoDe("load");
    expect(corpo).toContain("nivelDeIntensidade(open.intensity)");
    expect(corpo).toContain("setIntensity");
  });
});

describe("dá para corrigir e apagar UMA contração", () => {
  test("apagar recorta por `id`, e nunca por `user_id`", () => {
    /* `user_id` é o que `clearSession` usa para apagar TUDO: um engano aqui
       transformaria "apagar esta" em "apagar o histórico inteiro". */
    const corpo = corpoDe("apagarContracao");
    expect(corpo).toContain('.eq("id", id)');
    expect(corpo).not.toContain("user_id");
  });

  test("apagar a contração EM CURSO para o cronômetro", () => {
    /* Senão ele continuaria correndo sobre uma linha que já não existe, e o
       encerrar gravaria num id apagado. */
    const corpo = corpoDe("apagarContracao");
    expect(corpo).toContain("active?.id === id");
    expect(corpo).toContain("setActive(null)");
  });

  test("corrigir DESFAZ a pintura quando o servidor recusa", () => {
    /* `{ error }` chega numa resposta 200 normal — um `try/catch` não pega.
       É a régua que os marcos do bebê pagaram. */
    const corpo = corpoDe("corrigirIntensidade");
    expect(corpo).toContain("if (error)");
    expect(corpo).toContain("setContractions(antes)");
  });

  test('o botão não diz mais "Limpar sessão" sobre um apagar total', () => {
    expect(TELA).not.toContain("Limpar sessão");
    expect(TELA).toContain("Apagar histórico");
  });
});

describe("o caminho de socorro não depende do estado da análise", () => {
  test("o bloco das quatro bandeiras tem o 192 tocável", () => {
    /* Elas são a régua de IR AO HOSPITAL da ACOG e NENHUMA depende do
       cronômetro — então o telefone delas não pode viver dentro do `urgente`,
       que é onde o 192 morava. */
    const i = TELA.indexOf("Procure a maternidade agora se:");
    expect(i).toBeGreaterThan(0);
    const bloco = TELA.slice(i, i + 1600);
    expect(bloco).toContain('href="tel:192"');
    /* ⚠️ E aqui NÃO se repete "falar com o meu médico": dois botões com o
       mesmo rótulo e destinos diferentes é o defeito que o contador de
       movimentos já pagou. */
    expect(bloco).not.toContain("Falar com o meu médico");
  });

  test("o cronômetro é desenhado ANTES da análise", () => {
    /* Medido a 393×852: como quinto bloco, o botão caía em y=876/864/868 —
       fora da dobra — e na produção há o cabeçalho da grade acima. */
    const cron = TELA.indexOf("Cronômetro de contrações");
    const analise = TELA.indexOf("{analysis.label}");
    const bandeiras = TELA.indexOf("Procure a maternidade agora se:");
    expect(cron).toBeGreaterThan(0);
    expect(analise).toBeGreaterThan(cron);
    expect(bandeiras).toBeGreaterThan(analise);
  });
});

describe("a tendência da intensidade é FATO, nunca limiar", () => {
  test("precisa de quatro contrações — com três, cala", () => {
    /* Com duas ou três, "subiu" é ruído: uma contração pior que a anterior
       acontece o tempo todo. */
    expect(tendenciaDaIntensidade([t(0, 1), t(10, 2), t(20, 3)])).toBeNull();
  });

  test("meia-metade acima de meio nível vira frase", () => {
    const frase = tendenciaDaIntensidade([t(0, 1), t(10, 1), t(20, 3), t(30, 3)]);
    expect(frase).toContain("mais fortes");
    /* A frase dá a SAÍDA, e o par é literalmente o que a ACOG ensina. */
    expect(frase).toContain("mais juntas");
  });

  test("NÃO existe a frase inversa", () => {
    /* "Elas estão ficando mais fracas" seria tranquilização a partir de um
       dado que não a sustenta — e é na queda que ela para de cronometrar. */
    expect(tendenciaDaIntensidade([t(0, 3), t(10, 3), t(20, 1), t(30, 1)])).toBeNull();
    expect(REGUA).not.toContain("mais fracas");
  });

  test("intensidade constante não diz nada", () => {
    expect(tendenciaDaIntensidade([t(0, 3), t(10, 3), t(20, 3), t(30, 3)])).toBeNull();
  });

  test("ela NÃO muda o status — nem para cima", () => {
    /* Intensidade é autorrelato de dor, não tem corte em diretriz nenhuma, e
       um "3 fortes seguidas = alerta" seria limite clínico escrito fora de
       `sinais-clinicos.ts`. */
    const agora = Date.UTC(2026, 8, 5, 13, 0);
    const espacadas = [t(0, 1), t(12, 1), t(24, 3), t(36, 3)];
    const mesmasFracas = espacadas.map((c) => ({ ...c, intensity: 1 }));
    const a = analyzeContractions(espacadas, 39, agora);
    const b = analyzeContractions(mesmasFracas, 39, agora);
    expect(a.status).toBe(b.status);
    expect(a.label).toBe(b.label);
    /* O que muda é SÓ a nota. */
    expect(a.notaDaIntensidade).toContain("mais fortes");
    expect(b.notaDaIntensidade).toBeNull();
  });

  test("no caso `urgente` a nota NÃO entra", () => {
    /* Ali o texto já manda ligar agora, e uma cauda sobre tendência dilui a
       única frase que importa. */
    const agora = Date.UTC(2026, 8, 5, 13, 0);
    const subindoEUrgente = [t(0, 1), t(3, 1), t(6, 3), t(9, 3), t(12, 3)];
    const r = analyzeContractions(subindoEUrgente, 31, agora);
    expect(r.status).toBe("urgente");
    expect(r.notaDaIntensidade).toBeNull();
  });

  test("a nota alcança TODO caminho de retorno da régua", () => {
    /* Ela é acrescentada por um invólucro justamente porque `analisar` tem
       vários `return`: colada à mão em cada um, faltaria em algum. */
    expect(REGUA).toContain("notaDaIntensidade: nota");
    expect(REGUA.match(/notaDaIntensidade:/g)?.length).toBe(2);
  });
});
