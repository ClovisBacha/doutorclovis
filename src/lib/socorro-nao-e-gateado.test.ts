/**
 * O MODO CUIDADO NÃO PODE DESLIGAR O SOCORRO.
 *
 * ⚠️ **A folha do SOS não abria para quem está em luto.** A condição era
 * `{emergencyOpen && !careMode && <EmergencySheet …/>}`: a paciente tocava no
 * botão de emergência da barra — que continua ACESO —, o estado virava `true`,
 * e a folha simplesmente não montava. O botão não fazia nada.
 *
 * Quem acabou de perder uma gestação está em risco clínico ALTO — hemorragia,
 * infecção, pré-eclâmpsia de pós-parto — e em risco psiquiátrico. **É
 * exatamente quem mais precisa do botão.**
 *
 * ⚠️ **E a decisão já estava escrita DENTRO da própria folha**, no comentário
 * do som do alarme: "`podeSoar` deixa passar mesmo com o som desligado e mesmo
 * em Modo Cuidado — quem perdeu a gestação continua podendo passar mal". O
 * componente sabia; a tela que o monta fazia o oposto. É a forma mais cara de
 * defeito deste repositório: a regra documentada, e o chamador a contrariando.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A regra que fica: **o Modo Cuidado existe para o app parar de falar do bebê,
 * nunca para parar de socorrer.** Ele governa CONTEÚDO — o que a tela diz —, e
 * nunca o acesso a um caminho de emergência.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/**
 * ⚠️ Os comentários saem ANTES da busca. Este arquivo e o da conta CITAM a
 * condição defeituosa para explicar por que ela é proibida — sem tirar a prosa,
 * a catraca acusaria justamente a documentação do conserto. É a armadilha que
 * este repositório já pagou nas duas direções.
 */
const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
const FOLHA = semComentarios(readFileSync("src/components/emergency-sheet.tsx", "utf8"));

describe("a folha do SOS abre sempre", () => {
  test("⚠️ a montagem NÃO passa por `careMode`", () => {
    /* A forma exata do defeito, e as variações plausíveis de quem for
       "reintroduzir com cuidado". */
    expect(CONTA).toMatch(/\{emergencyOpen && \(/);
    expect(CONTA).not.toMatch(/emergencyOpen && !careMode/);
    expect(CONTA).not.toMatch(/!careMode && emergencyOpen/);
    expect(CONTA).not.toMatch(/careMode \? null : <EmergencySheet/);
  });

  test("⚠️ o componente da folha não conhece `careMode`", () => {
    /* Se ele passasse a receber a bandeira, o portão voltaria por dentro — e
       ficaria invisível para a asserção acima. A folha decide o que MOSTRAR
       pelos dados que recebe (`weekLabel` nulo quando não há gestação), nunca
       por um interruptor de luto. */
    expect(FOLHA).not.toMatch(/\bcareMode\b/);
    expect(FOLHA).not.toMatch(/\bcare_mode\b/);
  });

  test("o botão do SOS na barra também não é gateado", () => {
    /* Um botão escondido seria o mesmo defeito com outra cara: ela procuraria
       o socorro e não acharia. */
    /* ⚠️ A barra CONHECE `careMode` (ela o usa para outras coisas), então a
       asserção não pode ser "a barra não conhece" — seria falso positivo. O
       que se cobra é que o item do SOS não esteja dentro de uma condição de
       luto: ele é renderizado ANTES dos quatro destinos, sem portão. */
    const barra = semComentarios(readFileSync("src/components/app-mobile-shell.tsx", "utf8"));
    expect(barra).not.toMatch(/!careMode[\s\S]{0,120}"sos"/);
    expect(barra).not.toMatch(/"sos"[\s\S]{0,120}!careMode/);
  });
});

describe("o alarme sonoro do SOS também atravessa", () => {
  test("⚠️ o som do SOS ignora preferência, Modo Cuidado e teto", () => {
    /* Quem está em luto e passa mal precisa do mesmo aviso sonoro de quem não
       está. A régua vive em `som-de-ui`; aqui se cobra que a folha continue
       pedindo as duas espécies de ALARME. */
    /* ⚠️ Ancorado na CHAMADA `tocarSomDeUI(...)`, e não no nome solto: a
       string "sos-falhou" aparece três vezes no arquivo, uma delas dentro de
       um comentário que explica a régua. Com `toMatch("sos-falhou")` solto, a
       mutação que troca a CHAMADA por um som comum passava verde — a
       ocorrência da prosa satisfazia a asserção. */
    const chamadas = FOLHA.match(/tocarSomDeUI\(([^)]*)\)/g) ?? [];
    expect(chamadas.join(" ")).toContain('"sos"');
    expect(chamadas.join(" ")).toContain('"sos-falhou"');
  });
});

/**
 * ⚠️ A FICHA QUE O SOCORRISTA LÊ — o outro lado da mesma régua.
 *
 * O bloco acima garante que a folha ABRE no luto. Este garante o que ela DIZ
 * quando abre: a ficha começava em "FICHA DE EMERGÊNCIA - GESTANTE", com o
 * NOME DO BEBÊ e a DPP, para quem acabou de perder a gestação — na tela que
 * ela abre justamente quando alguma coisa está errada.
 *
 * ⚠️ **E o conserto não é apagar a ficha.** Quem perdeu uma gestação continua
 * sendo paciente obstétrica, e é por isso que este arquivo cobra as DUAS
 * metades ao mesmo tempo: o que sai (bebê e DPP, que além de dolorosos são
 * informação FALSA para quem vai atendê-la) e o que **não pode sair** (tipo
 * sanguíneo, alergias, medicações, contato de emergência).
 *
 * Uma catraca que cobrasse só a primeira metade aprovaria alguém "consertando"
 * o luto ao custo do socorro, que é o defeito no sentido contrário.
 */
describe("a ficha que o socorrista lê", () => {
  /** O objeto `info={{ … }}` do ponto de montagem, por contagem de chaves. */
  const infoDaFicha = (() => {
    const i = CONTA.indexOf("info={{");
    expect(i).toBeGreaterThan(-1);
    let n = 0;
    for (let j = i + "info=".length; j < CONTA.length; j++) {
      if (CONTA[j] === "{") n++;
      else if (CONTA[j] === "}" && --n === 0) return CONTA.slice(i, j + 1);
    }
    throw new Error("o objeto `info` não fecha");
  })();

  test("⚠️ o nome do bebê e a DPP saem em Modo Cuidado", () => {
    /* Cobra o TERMO na decisão de cada campo, e não a grafia de um ternário:
       `careMode ? null : x` e `!careMode && x` valem os dois. */
    const campo = (nome: string) => {
      const i = infoDaFicha.indexOf(`${nome}:`);
      expect(i).toBeGreaterThan(-1);
      /* até o próximo campo de primeiro nível, ou o fim do objeto */
      const resto = infoDaFicha.slice(i);
      const fim = resto.search(/\n {12}\w+:/);
      return fim === -1 ? resto : resto.slice(0, fim);
    };
    expect(campo("babyName")).toMatch(/\bcareMode\b/);
    expect(campo("dpp")).toMatch(/\bcareMode\b/);
    expect(campo("weekLabel")).toMatch(/\bcareMode\b/);
  });

  test("⚠️ o que o socorrista precisa NÃO é gateado por luto", () => {
    /* A metade que impede o conserto de virar o defeito oposto. */
    for (const nome of [
      "bloodType",
      "allergies",
      "medications",
      "emergencyContact",
      "emergencyPhone",
    ]) {
      const i = infoDaFicha.indexOf(`${nome}:`);
      expect(i).toBeGreaterThan(-1);
      const resto = infoDaFicha.slice(i);
      const fim = resto.search(/\n {12}\w+:/);
      const linha = fim === -1 ? resto : resto.slice(0, fim);
      expect(linha).not.toMatch(/\bcareMode\b/);
    }
  });

  test("⚠️ o cabeçalho deixa de afirmar uma gestação em curso", () => {
    expect(CONTA).toMatch(/tituloDaFicha=\{careMode \?/);
    /* E o padrão continua sendo o texto de hoje: a paciente grávida não perde
       a palavra que o socorrista brasileiro lê primeiro. */
    expect(FOLHA).toMatch(/tituloDaFicha \?\? "FICHA DE EMERGÊNCIA - GESTANTE"/);
  });

  test("⚠️ o portão chega como STRING, nunca como booleano de luto", () => {
    /* Esta é a razão de o título ser um texto e não um `emLuto`: um booleano
       de luto dentro da folha seria, um dia, um `if (emLuto) return null` — o
       defeito que o primeiro bloco deste arquivo existe para impedir. Uma
       string não tem como desligar nada. */
    expect(FOLHA).toMatch(/tituloDaFicha\?: string;/);
    expect(FOLHA).not.toMatch(/\bemLuto\b/);
    expect(FOLHA).not.toMatch(/\bluto\b/);
  });
});
