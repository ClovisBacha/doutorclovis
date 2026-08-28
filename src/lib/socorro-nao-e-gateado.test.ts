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
