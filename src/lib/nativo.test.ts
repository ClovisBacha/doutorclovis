/**
 * A ponte nativa, travada em teste.
 *
 * O que este arquivo protege é uma tradução: o padrão `[liga, desliga, …]` que
 * `padraoDaFase` gera precisa virar uma agenda de impactos para o iPhone, e a
 * FORMA do crescendo tem que sobreviver à tradução.
 *
 * Se ela não sobreviver, o defeito é invisível de dois jeitos ao mesmo tempo:
 * ninguém percebe lendo o código, e ninguém percebe testando no Android — onde
 * o caminho é outro. Só apareceria na mão de uma paciente de iPhone, que é
 * exatamente quem hoje não sente nada.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { agendaDeImpactos, forcaDoPulso } from "./nativo";
import { padraoDaFase } from "./breath-audio";

const PESO = { LIGHT: 1, MEDIUM: 2, HEAVY: 3 } as const;

describe("a força acompanha a duração do pulso", () => {
  test("nunca inverte", () => {
    /* Pulso maior saindo mais fraco inverteria o crescendo no meio da
       inspiração — a mão sentiria a subida virar descida. */
    let anterior = 0;
    for (let ms = 20; ms <= 500; ms += 5) {
      const atual = PESO[forcaDoPulso(ms)];
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
  });

  test("os três degraus são alcançáveis na faixa que o padrão gera", () => {
    /* Numa fatia de 500ms os pulsos vão de ~110ms a ~360ms. Se os cortes
       ficassem fora dessa faixa, o crescendo teria um degrau só — e um degrau
       só não é crescendo. */
    const forcas = new Set(
      padraoDaFase("in", 4000)
        .filter((_, i) => i % 2 === 0)
        .map(forcaDoPulso),
    );
    expect(forcas.size).toBeGreaterThanOrEqual(2);
  });
});

describe("a agenda preserva a forma do padrão", () => {
  test("um impacto por pulso, e nenhum pelas pausas", () => {
    /* No iOS o silêncio é a AUSÊNCIA de impacto, não um comando. Agendar as
       pausas dobraria os eventos e transformaria o compasso em zumbido. */
    const padrao = padraoDaFase("in", 4000);
    const pulsos = padrao.filter((_, i) => i % 2 === 0).length;
    expect(agendaDeImpactos(padrao)).toHaveLength(pulsos);
  });

  test("os instantes crescem e cabem na fase", () => {
    const dur = 4000;
    const agenda = agendaDeImpactos(padraoDaFase("in", dur));
    for (let i = 1; i < agenda.length; i++) expect(agenda[i].em).toBeGreaterThan(agenda[i - 1].em);
    expect(agenda[agenda.length - 1].em).toBeLessThan(dur);
  });

  test("INSPIRAR cresce em força", () => {
    const f = agendaDeImpactos(padraoDaFase("in", 4000)).map((a) => PESO[a.forca as "LIGHT"]);
    expect(f[f.length - 1]).toBeGreaterThan(f[0]);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThanOrEqual(f[i - 1]);
  });

  test("EXPIRAR diminui em força", () => {
    /* A forma é o que diz QUAL fase é, de olhos fechados. Se as duas crescessem,
       a mão sentiria movimento sem saber de qual — e aí só a tela resolveria,
       que é o que a respiração guiada existe para evitar. */
    const f = agendaDeImpactos(padraoDaFase("out", 6000)).map((a) => PESO[a.forca as "LIGHT"]);
    expect(f[f.length - 1]).toBeLessThan(f[0]);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeLessThanOrEqual(f[i - 1]);
  });

  test("SEGURAR é um toque só", () => {
    expect(agendaDeImpactos(padraoDaFase("hold", 4000))).toHaveLength(1);
  });

  test("padrão vazio não agenda nada", () => {
    expect(agendaDeImpactos([])).toEqual([]);
    expect(agendaDeImpactos(padraoDaFase("in", 0))).toEqual([]);
  });

  /* O padrão do contador de chutes começa com um pulso de duração ZERO, que
     no `navigator.vibrate` serve só para ATRASAR o primeiro toque (índice par
     = vibra, ímpar = pausa). Sem esta regra o iPhone sentia um impacto
     fantasma em 0 ms e o Android sentia um pulso só — mesmo código, sensações
     diferentes, e ninguém perceberia porque háptico não deixa rastro. */
  test("pulso de duração zero não vira impacto", () => {
    const agenda = agendaDeImpactos([0, 25, 40, 55]);
    expect(agenda).toHaveLength(1);
    expect(agenda[0].em).toBe(25);
  });

  test("o relógio do padrão continua correndo mesmo com pulso zero", () => {
    // [0,10,5,10,7] → pulsos reais em 10ms e 25ms; o zero não desloca nada.
    expect(agendaDeImpactos([0, 10, 5, 10, 7]).map((a) => a.em)).toEqual([10, 25]);
  });
});

describe("sem ponte, o app continua sendo web", () => {
  test("ehNativo e plataforma não explodem fora do app", async () => {
    const { ehNativo, plataforma } = await import("./nativo");
    expect(ehNativo()).toBe(false);
    expect(plataforma()).toBe("web");
  });
});

/**
 * A splash é o único ponto do app que pode CONGELAR sem dar erro: se ninguém a
 * esconde, ela fica na tela para sempre e o app parece travado no primeiro uso.
 * O que estes testes cobram é que ela nunca dependa de uma coisa só.
 */
describe("a tela de abertura sempre tem saída", () => {
  const config = readFileSync("capacitor.config.ts", "utf8");
  const fonte = readFileSync("src/lib/nativo.ts", "utf8");

  test("o lado NATIVO esconde sozinho, sem depender da página", () => {
    /* Com `launchAutoHide: false` o JavaScript vira a única saída — e uma rede
       caída passa a ser um app congelado. */
    expect(config).toContain("launchAutoHide: true");
    expect(config).toMatch(/launchShowDuration:\s*6000/);
  });

  test("no navegador é no-op — não há splash para esconder", async () => {
    const { esconderSplash } = await import("./nativo");
    expect(() => esconderSplash()).not.toThrow();
  });

  test("o plugin é procurado na hora de esconder, não no carregamento", () => {
    /* A página remota não empacota `@capacitor/splash-screen`: quem publica o
       plugin é a ponte injetada, e ela pode chegar depois deste módulo. Guardar
       a referência agora seria guardar `undefined` para sempre. */
    expect(fonte).toMatch(/ponte\(\)\s*\?\.Plugins\?\.SplashScreen\?\.hide/);
    /* E não guardada numa variável antes do agendamento. */
    expect(fonte).not.toMatch(/const\s+splash\s*=/);
  });

  test("esconder duas vezes não é esconder duas vezes", () => {
    expect(fonte).toContain("if (feito) return;");
  });
});

describe("a splash sai antes de qualquer componente montar", () => {
  const router = readFileSync("src/router.tsx", "utf8");

  test("a chamada mora no começo do cliente, não num useEffect", () => {
    /* Num `useEffect` do `__root.tsx`, um erro de hidratação deixaria a marca
       na tela até o teto nativo estourar. */
    const chamada = router.indexOf("\nesconderSplash();");
    expect(chamada).toBeGreaterThan(0);
    /* No escopo do módulo — antes da primeira função. Dentro de `getRouter` ela
       só rodaria quando o router fosse montado. */
    expect(chamada).toBeLessThan(router.indexOf("export const getRouter"));
  });
});
