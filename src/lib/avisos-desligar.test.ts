/**
 * DESLIGAR OS AVISOS — a porta que faltava, e as três garantias dela.
 *
 * ⚠️ **`unsubscribeFromPush` existia desde que o push nasceu e NENHUMA tela a
 * chamava.** Parar de receber só era possível pelas Configurações do sistema,
 * que silenciam o app INTEIRO — o mesmo canal por onde chegam a confirmação da
 * consulta e o lembrete de 24h. Este arquivo trava as três coisas que fazem o
 * botão novo valer alguma coisa:
 *
 * 1. a escolha PERSISTE (senão `renovar` a desfaz na abertura seguinte);
 * 2. ela só é gravada quando o cancelamento DEU CERTO;
 * 3. não conseguir ler a marca vale LIGADO — nunca o contrário.
 *
 * ⚠️ **SEM `mock.module`.** Ele escreve num registro compartilhado entre
 * arquivos de teste, e todos são importados antes de qualquer um rodar: um
 * teste que muda de resposta conforme a ordem é pior que teste nenhum. Aqui os
 * globais do navegador são forjados e restaurados, que é o que o código de
 * fato lê.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  ativarAvisos,
  avisosDesligadosNesteAparelho,
  desligarAvisos,
  renovarAvisosSeJaAutorizado,
} from "@/lib/avisos";

const FONTE = readFileSync("src/lib/avisos.ts", "utf8");
const semComentarios = (t: string) =>
  t.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[\s"'`([{,;:])\/\/.*$/gm, "$1");

type Global = Record<string, unknown>;
const g = globalThis as unknown as Global;
const guardados: Array<[string, PropertyDescriptor | undefined]> = [];

function definir(nome: string, valor: unknown) {
  guardados.push([nome, Object.getOwnPropertyDescriptor(globalThis, nome)]);
  Object.defineProperty(globalThis, nome, { configurable: true, writable: true, value: valor });
}
function definirGetter(nome: string, get: () => unknown) {
  guardados.push([nome, Object.getOwnPropertyDescriptor(globalThis, nome)]);
  Object.defineProperty(globalThis, nome, { configurable: true, get });
}
afterEach(() => {
  for (const [nome, d] of guardados.reverse()) {
    if (d) Object.defineProperty(globalThis, nome, d);
    else delete g[nome];
  }
  guardados.length = 0;
});

function memoria() {
  const m = new Map<string, string>();
  definir("localStorage", {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}

/** Um navegador sem inscrição de push: "não há o que desligar" = sucesso. */
function navegadorSemInscricao() {
  definir("navigator", {
    serviceWorker: { getRegistration: async () => undefined },
  });
}

describe("a marca de desligado", () => {
  test("responde ao que está gravado", () => {
    const m = memoria();
    expect(avisosDesligadosNesteAparelho()).toBe(false);
    m.set("dc-avisos-desligados", "1");
    expect(avisosDesligadosNesteAparelho()).toBe(true);
  });

  test("⚠️ não conseguir LER vale LIGADO — nunca o contrário", () => {
    definir("localStorage", {
      getItem: () => {
        throw new Error("modo privado");
      },
    });
    /* O pior caso de um `false` errado é um push que ela não queria; o de um
       `true` errado é o silêncio de um canal que carrega o lembrete da
       consulta, e esse não deixa rastro nenhum. */
    expect(avisosDesligadosNesteAparelho()).toBe(false);
  });

  test("sem `localStorage` nenhum (SSR) também vale LIGADO", () => {
    guardados.push(["localStorage", Object.getOwnPropertyDescriptor(globalThis, "localStorage")]);
    delete g.localStorage;
    expect(avisosDesligadosNesteAparelho()).toBe(false);
  });
});

describe("desligar", () => {
  test("grava a escolha quando o cancelamento deu certo", async () => {
    const m = memoria();
    navegadorSemInscricao();
    const r = await desligarAvisos();
    expect(r.ok).toBe(true);
    expect(m.get("dc-avisos-desligados")).toBe("1");
  });

  test("⚠️ NÃO grava — e não diz ok — quando o cancelamento falhou", async () => {
    const m = memoria();
    definir("navigator", {
      serviceWorker: {
        getRegistration: async () => {
          throw new Error("sem rede");
        },
      },
    });
    const r = await desligarAvisos();
    /* A linha continua no banco: o push continua saindo. Gravar a marca aqui
       deixaria o pior estado possível — o canal tocando, a tela dizendo que
       está desligado, e `renovar` impedido de renovar. */
    expect(r.ok).toBe(false);
    expect(m.has("dc-avisos-desligados")).toBe(false);
  });
});

describe("a renovação da abertura respeita a escolha", () => {
  test("⚠️ com a marca, NÃO toca no push", async () => {
    const m = memoria();
    m.set("dc-avisos-desligados", "1");
    let tocou = false;
    definirGetter("Notification", () => {
      tocou = true;
      return { permission: "granted", requestPermission: async () => "granted" };
    });
    await renovarAvisosSeJaAutorizado();
    /* Sem este portão o botão de desligar seria decorativo: ela desligaria e o
       app a re-inscreveria na próxima abertura. */
    expect(tocou).toBe(false);
  });

  test("sem a marca, segue o caminho de sempre", async () => {
    memoria();
    let tocou = false;
    definirGetter("Notification", () => {
      tocou = true;
      return { permission: "granted", requestPermission: async () => "granted" };
    });
    await renovarAvisosSeJaAutorizado();
    expect(tocou).toBe(true);
  });
});

describe("religar", () => {
  test("⚠️ a marca só sai quando a inscrição DEU CERTO", async () => {
    const m = memoria();
    m.set("dc-avisos-desligados", "1");
    /* Sem `Notification`, `subscribeToPush` não tem como inscrever. */
    guardados.push(["Notification", Object.getOwnPropertyDescriptor(globalThis, "Notification")]);
    delete g.Notification;
    const r = await ativarAvisos();
    expect(r.ok).toBe(false);
    /* Limpá-la aqui deixaria o aparelho sem inscrição E sem a marca — ou seja,
       `renovar` voltaria a inscrever sozinho, refazendo uma escolha que ela
       não tomou. */
    expect(m.get("dc-avisos-desligados")).toBe("1");
  });
});

describe("a porta existe", () => {
  /* ⚠️ Esta é a catraca que faltava: `unsubscribeFromPush` viveu escrita e sem
     chamador desde que o push nasceu. Bancada NÃO conta — é exatamente onde as
     sete funções da rede social viveram enquanto ninguém as alcançava. */
  const APP = ["src/components/avisos-do-app.tsx"];
  test("⚠️ e o componente é MONTADO pelo app — não basta ele existir", () => {
    /* ⚠️ Duas pontas, e nenhuma sozinha basta: um componente que chama
       `desligarAvisos` e que nenhuma tela monta é a mesma órfã de antes com
       mais arquivos. `preview-avisos` NÃO conta — bancada é exatamente onde as
       sete funções da rede social viveram enquanto ninguém as alcançava. */
    const tela = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
    expect(tela).toContain("<AvisosDoApp");
  });

  test("⚠️ desligar os avisos é alcançável a partir do app", () => {
    /* ⚠️ **O IMPORT É APAGADO INTEIRO, e ele é MULTI-LINHA.** A primeira versão
       desta catraca filtrava linha a linha o que começa com `import` — e
       `  desligarAvisos,`, no meio de um import de quatro nomes, não começa.
       Ela passou VERDE sobre a mutação que apaga a chamada, que é exatamente o
       defeito que ela existe para pegar: importar sem chamar É o defeito. */
    const semImports = (t: string) => t.replace(/import\s[\s\S]*?from\s*["'][^"']+["'];?/g, " ");
    const telas = APP.map((f) => semImports(semComentarios(readFileSync(f, "utf8"))));
    for (const nome of ["desligarAvisos", "avisosDesligadosNesteAparelho"]) {
      const usos = telas.filter((t) => new RegExp(`\\b${nome}\\b`).test(t));
      expect(usos.length).toBeGreaterThan(0);
    }
  });

  test("⚠️ e ela chega no cancelamento de verdade, nos DOIS caminhos", () => {
    const fonte = semComentarios(FONTE);
    /* navegador e casca nativa não se substituem: um `unsubscribeFromPush`
       sozinho deixaria o app instalado sem desligar nada. */
    expect(fonte).toContain("unsubscribeFromPush");
    expect(fonte).toContain("cancelarPushNativo");
    expect(fonte).toMatch(
      /ehNativo\(\)\s*\n?\s*\?\s*await \(await import\("@\/lib\/push-nativo"\)\)\.cancelarPushNativo/,
    );
  });
});

describe("a forma do código", () => {
  test("⚠️ cancela ANTES de marcar", () => {
    const corpo = semComentarios(FONTE);
    const i = corpo.indexOf("export async function desligarAvisos");
    expect(i).toBeGreaterThan(-1);
    const fim = corpo.indexOf("\nexport ", i + 10);
    const trecho = corpo.slice(i, fim > i ? fim : undefined);
    expect(trecho.length).toBeGreaterThan(80);
    const cancela = Math.max(
      trecho.indexOf("cancelarPushNativo"),
      trecho.indexOf("unsubscribeFromPush"),
    );
    const marca = trecho.indexOf("setItem");
    expect(cancela).toBeGreaterThan(-1);
    expect(marca).toBeGreaterThan(cancela);
    /* e o desfecho do cancelamento decide */
    expect(trecho).toMatch(/if\s*\(!r\.ok\)\s*return r/);
  });

  test("⚠️ o erro do DELETE decide o retorno de unsubscribeFromPush", () => {
    /* A linha de `push_subscriptions` é o que o servidor lê na hora de enviar:
       enquanto ela estiver lá o push CONTINUA chegando. Esta é a metade do
       desligar que nenhum teste de comportamento alcança sem forjar o cliente
       do Supabase — e forjá-lo por módulo contaminaria os outros arquivos. */
    const corpo = semComentarios(readFileSync("src/lib/push.ts", "utf8"));
    const i = corpo.indexOf("export async function unsubscribeFromPush");
    expect(i).toBeGreaterThan(-1);
    const fim = corpo.indexOf("\nexport ", i + 10);
    const trecho = corpo.slice(i, fim > i ? fim : undefined);
    expect(trecho.length).toBeGreaterThan(200);
    expect(trecho).toMatch(/const\s*\{\s*error\s*\}\s*=\s*await/);
    expect(trecho).toMatch(/if\s*\(error\)\s*return\s*\{\s*ok:\s*false/);
  });

  test("⚠️ o portão da escolha vem ANTES de tudo em renovar", () => {
    const corpo = semComentarios(FONTE);
    const i = corpo.indexOf("export async function renovarAvisosSeJaAutorizado");
    const trecho = corpo.slice(i, i + 400);
    expect(trecho).toMatch(/if\s*\(avisosDesligadosNesteAparelho\(\)\)\s*return;/);
    expect(trecho.indexOf("avisosDesligadosNesteAparelho")).toBeLessThan(trecho.indexOf("try"));
  });
});
