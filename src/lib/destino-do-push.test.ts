import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { caminhoSeguroDoPush, DESTINO_PADRAO } from "./destino-do-push";

/**
 * ⚠️ O SERVIDOR MANDAVA O DESTINO E O APP JOGAVA FORA (set/2026).
 *
 * Todo push deste app carrega `url` (a consulta confirmada, a vaga liberada, o
 * presente, o resumo de domingo) — e o `notificationclick` do worker abria
 * `"/minha-conta"` cru, enquanto o app nativo não tinha ouvinte nenhum. Tocar
 * em "sua consulta é amanhã" abria a tela em que o app estava, e ela ficava
 * procurando o que o aviso dizia.
 *
 * ⚠️ **O caminho chega de FORA.** O corpo é montado pelo servidor, mas o que
 * alcança o aparelho passa pelo serviço da Apple/Google e é entregue como dado
 * arbitrário. Navegar para isso sem conferir abre a porta para `javascript:`
 * (execução na origem do app, com a sessão dela dentro) e para
 * `https://outro.site` (uma tela que PARECE o app pedindo a senha).
 *
 * ⚠️ **E EXISTEM DUAS IMPLEMENTAÇÕES**, porque `public/sw.js` é servido cru e
 * não pode importar um módulo. É este arquivo que impede as duas de divergirem:
 * a tabela de casos é UMA, e ela roda nas duas.
 */

/** Uma tabela só — é ela que amarra a régua do app à do worker. */
const CASOS: Array<[string, unknown, string]> = [
  ["o destino comum", "/minha-conta?tab=Consultas", "/minha-conta?tab=Consultas"],
  ["um caminho simples", "/gestacao", "/gestacao"],
  ["com fragmento", "/minha-conta#agenda", "/minha-conta#agenda"],
  ["vazio cai no padrão", "", DESTINO_PADRAO],
  ["ausente cai no padrão", undefined, DESTINO_PADRAO],
  ["não-string cai no padrão", 42, DESTINO_PADRAO],
  ["⚠️ endereço absoluto", "https://outro.site/senha", DESTINO_PADRAO],
  ["⚠️ sem esquema (`//`)", "//outro.site/senha", DESTINO_PADRAO],
  ["⚠️ javascript:", "javascript:alert(1)", DESTINO_PADRAO],
  ["⚠️ javascript: com barra", "/javascript:alert(1)", DESTINO_PADRAO],
  ["⚠️ esquema depois da barra", "/x:y", DESTINO_PADRAO],
  ["⚠️ data:", "data:text/html,<script>", DESTINO_PADRAO],
  ["⚠️ subir de diretório", "/../admin", DESTINO_PADRAO],
  ["⚠️ com espaço", "/minha conta", DESTINO_PADRAO],
  ["⚠️ com quebra de linha", "/x\njavascript:alert(1)", DESTINO_PADRAO],
  ["⚠️ relativo sem barra", "minha-conta", DESTINO_PADRAO],
  ["dois-pontos DEPOIS da query é aceito", "/x?u=a:b", "/x?u=a:b"],
];

/**
 * A régua do WORKER, extraída do arquivo cru e avaliada.
 *
 * ⚠️ Ela é EXECUTADA, não lida: um teste que só procurasse o texto ficaria
 * verde sobre uma cópia que mudou de comportamento — que é exatamente o risco
 * de haver duas.
 */
function reguaDoWorker(): (cru: unknown) => string {
  const sw = readFileSync("public/sw.js", "utf8");
  const i = sw.indexOf("function caminhoSeguroDoPush(");
  expect(i).toBeGreaterThan(-1);
  let n = 0;
  const abre = sw.indexOf("{", i);
  let fim = abre;
  for (let k = abre; k < sw.length; k++) {
    if (sw[k] === "{") n++;
    else if (sw[k] === "}") {
      n--;
      if (n === 0) {
        fim = k + 1;
        break;
      }
    }
  }
  const corpo = sw.slice(i, fim);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${corpo}; return caminhoSeguroDoPush;`)() as (c: unknown) => string;
}

describe("o destino de um aviso é limpo antes de virar navegação", () => {
  const doWorker = reguaDoWorker();

  for (const [nome, entrada, esperado] of CASOS) {
    test(`app · ${nome}`, () => {
      expect(caminhoSeguroDoPush(entrada)).toBe(esperado);
    });
    test(`worker · ${nome}`, () => {
      expect(doWorker(entrada)).toBe(esperado);
    });
  }

  test("⚠️ as duas implementações concordam em TODOS os casos", () => {
    /* É esta asserção que faz a duplicação ser segura. Sem ela, a cópia do
       worker envelheceria em silêncio — e o sintoma seria a paciente indo
       parar na tela errada, ou pior. */
    for (const [, entrada] of CASOS) {
      expect(doWorker(entrada)).toBe(caminhoSeguroDoPush(entrada));
    }
  });

  test("recusar cai no APP, nunca em lugar nenhum", () => {
    /* Um aviso que não abre nada é indistinguível de um aviso quebrado. */
    expect(DESTINO_PADRAO.startsWith("/")).toBe(true);
    expect(caminhoSeguroDoPush("https://outro.site")).toBe(DESTINO_PADRAO);
  });
});

describe("⚠️ o toque no aviso encontra a janela que já está aberta", () => {
  const SW = readFileSync("public/sw.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const i = SW.indexOf('addEventListener("notificationclick"');
  const bloco = SW.slice(i, SW.indexOf("\n});", i));

  test("procura a janela existente antes de abrir uma nova", () => {
    /* `openWindow` cru dava, no melhor caso, uma segunda aba do mesmo app — e
       no app instalado ele não abre nada: ela tocava no aviso e via a tela em
       que já estava. */
    expect(bloco).toContain("matchAll");
    expect(bloco).toContain("focus()");
    expect(bloco).toContain("navigate(");
  });

  test("e `openWindow` continua como recuo", () => {
    /* Sem janela aberta — o caso do app fechado — ele é o único caminho. */
    expect(bloco).toContain("openWindow");
  });

  test("⚠️ o destino passa pela régua, nunca cru", () => {
    expect(bloco).toContain("caminhoSeguroDoPush(");
    expect(bloco).not.toMatch(/data\.url\s*\|\|/);
  });
});

describe("⚠️ e o app NATIVO também ouve o toque", () => {
  /* No nativo não havia ouvinte nenhum: o servidor mandava o destino e o app
     abria onde estava. */
  const PUSH = readFileSync("src/lib/push-nativo.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const NATIVO = readFileSync("src/lib/nativo.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  test("o ouvinte existe e é do TOQUE, não do recebimento", () => {
    /* Mudar de tela sozinha, sem ela ter tocado em nada, é o oposto do que um
       aviso faz. */
    expect(PUSH).toContain("pushNotificationActionPerformed");
    expect(PUSH).not.toContain("pushNotificationReceived");
  });

  test("⚠️ e ele é LIGADO na abertura — senão é código morto", () => {
    /* É a família de `escadaDeTrofeus` e das sete funções da rede sem porta:
       escrita, testada, e alcançável em lugar nenhum. */
    expect(NATIVO).toContain("ligarToqueNoAviso");
    const i = NATIVO.indexOf("export function prepararNativo");
    expect(i).toBeGreaterThan(-1);
    expect(NATIVO.indexOf("ligarToqueNoAviso", i)).toBeGreaterThan(i);
  });

  test("⚠️ o destino passa pela MESMA régua, nunca cru", () => {
    const i = PUSH.indexOf("pushNotificationActionPerformed");
    const bloco = PUSH.slice(i, PUSH.indexOf("\n  } catch", i));
    expect(bloco).toContain("caminhoSeguroDoPush(");
  });

  test("navega por `history`, não recarregando a página inteira", () => {
    /* Este app é uma rota só com estado por cima: recarregar para trocar de
       aba custaria uma abertura completa, justamente no toque que deveria ser
       instantâneo. */
    const i = PUSH.indexOf("pushNotificationActionPerformed");
    const bloco = PUSH.slice(i, PUSH.indexOf("\n  } catch", i));
    expect(bloco).toContain("pushState");
    expect(bloco).toContain("popstate");
  });
});
