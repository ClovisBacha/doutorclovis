/**
 * O SERVICE WORKER, RODANDO DE VERDADE.
 *
 * `public/sw.js` não é importável (fala com `self`, `caches`, `clients`), então
 * o teste monta esses três de mentira e EXECUTA o arquivo. É a única forma de
 * cobrir um arquivo que, quando quebra, quebra calado: um service worker com
 * defeito não estoura na tela — o áudio simplesmente não toca, e só no aparelho
 * de quem já tinha o worker antigo instalado.
 *
 * O que ele passou a fazer (ago/2026): guardar o áudio da meditação. Eram 16 MB
 * de voz fora da lista de tipos cacheados — toda sessão dependia de rede.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const FONTE = readFileSync("public/sw.js", "utf8");
const ORIGEM = "https://www.obstetrica.com.br";

type Ouvintes = Record<string, (e: unknown) => void>;

/** Cache API de mentira, com o mesmo contrato que o worker usa. */
function montarCaches(cotaCheia = false) {
  const lojas = new Map<string, Map<string, Response>>();
  const chave = (r: string | Request) => (typeof r === "string" ? new URL(r).href : r.url);
  const loja = (nome: string) => {
    if (!lojas.has(nome)) lojas.set(nome, new Map());
    return lojas.get(nome)!;
  };
  const guardadas: Response[] = [];
  return {
    guardadas,
    lojas,
    api: {
      open: async (nome: string) => ({
        match: async (r: string | Request) => loja(nome).get(chave(r))?.clone(),
        put: async (r: string | Request, res: Response) => {
          /* A Cache API RECUSA resposta parcial — e é por isso que o worker
             guarda o arquivo inteiro e fatia depois. O mock recusa igual: sem
             isto o teste aprovaria um worker que quebra no primeiro iPhone. */
          if (res.status === 206) throw new TypeError("Partial response not allowed");
          if (cotaCheia) throw new DOMException("Quota exceeded", "QuotaExceededError");
          guardadas.push(res);
          loja(nome).set(chave(r), res);
        },
        addAll: async (urls: string[]) => {
          for (const u of urls) loja(nome).set(new URL(u, ORIGEM).href, new Response("shell"));
        },
      }),
      match: async (r: string | Request) => {
        for (const m of lojas.values()) {
          const achou = m.get(chave(r));
          if (achou) return achou.clone();
        }
        return undefined;
      },
      keys: async () => [...lojas.keys()],
      delete: async (k: string) => lojas.delete(k),
    },
  };
}

/**
 * Carrega o worker com dependências controladas e devolve o que preciso para
 * disparar um `fetch` nele.
 */
function carregar(rede: (url: string) => Promise<Response>, cotaCheia = false) {
  const ouvintes: Ouvintes = {};
  const caches = montarCaches(cotaCheia);
  const chamadas: string[] = [];
  const avisos: string[] = [];
  const self = {
    addEventListener: (nome: string, fn: (e: unknown) => void) => {
      ouvintes[nome] = fn;
    },
    location: { origin: ORIGEM },
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() },
    registration: {
      showNotification: (t: string) => {
        avisos.push(t);
        return Promise.resolve();
      },
    },
  };
  const fetch = (r: string | Request) => {
    const url = typeof r === "string" ? r : r.url;
    chamadas.push(url);
    return rede(url);
  };
  new Function("self", "caches", "fetch", "clients", FONTE)(self, caches.api, fetch, {});

  /** Dispara qualquer outro evento do ciclo de vida e espera o `waitUntil`. */
  async function evento(nome: string, extra: Record<string, unknown> = {}) {
    const caixa: { p: Promise<unknown> | null } = { p: null };
    ouvintes[nome]?.({
      ...extra,
      waitUntil: (p: Promise<unknown>) => {
        caixa.p = p;
      },
    });
    if (caixa.p) await caixa.p;
  }

  /** Dispara o evento de fetch e devolve o que o worker respondeu (ou null). */
  async function pedir(caminho: string, init?: RequestInit) {
    const req = new Request(new URL(caminho, ORIGEM).href, init);
    /* Caixa em vez de variável: atribuição dentro de callback não é rastreada
       pelo TS, e uma `let` seria estreitada para `null`. */
    const caixa: { p: Promise<Response> | null } = { p: null };
    ouvintes.fetch?.({
      request: req,
      respondWith: (p: Promise<Response>) => {
        caixa.p = p;
      },
    });
    return caixa.p ? await caixa.p : null;
  }

  return { pedir, evento, chamadas, caches, avisos };
}

const MP3 = "/assets/med/prog-1-1-CdiOkjf8.mp3";
const corpoMp3 = () => new Uint8Array([...Array(100).keys()]);
const redeNormal = async (url: string) =>
  url.endsWith(".mp3")
    ? new Response(corpoMp3(), { status: 200, headers: { "content-type": "audio/mpeg" } })
    : new Response("conteudo", { status: 200 });

describe("o áudio da meditação passou a ser guardado", () => {
  test("primeiro pedido busca na rede e guarda; o segundo NÃO toca na rede", async () => {
    /* É este o recurso: da segunda sessão em diante a voz sai do disco — e
       continua saindo sem rede nenhuma. */
    const sw = carregar(redeNormal);
    const um = await sw.pedir(MP3);
    expect(um?.status).toBe(200);
    expect(sw.chamadas.length).toBe(1);

    const dois = await sw.pedir(MP3);
    expect(dois?.status).toBe(200);
    expect(new Uint8Array(await dois!.arrayBuffer()).length).toBe(100);
    expect(sw.chamadas.length).toBe(1); // não voltou à rede
  });

  test("offline e nunca tocado devolve 504 em vez de estourar", async () => {
    const sw = carregar(async () => {
      throw new TypeError("sem rede");
    });
    const r = await sw.pedir(MP3);
    expect(r?.status).toBe(504);
  });

  test("offline com o arquivo guardado toca igual", async () => {
    let online = true;
    const sw = carregar(async (url) => {
      if (!online) throw new TypeError("sem rede");
      return redeNormal(url);
    });
    await sw.pedir(MP3);
    online = false;
    const r = await sw.pedir(MP3);
    expect(r?.status).toBe(200);
    expect(new Uint8Array(await r!.arrayBuffer()).length).toBe(100);
  });
});

describe("⚠️ o pedido com Range — o que faz o Safari tocar", () => {
  test("bytes=0- devolve 206 com o arquivo inteiro e Content-Range", async () => {
    /* Responder 200 a um pedido com Range é resposta errada, e o Safari desiste
       da faixa em silêncio: o mesmo sintoma de arquivo inexistente. */
    const sw = carregar(redeNormal);
    const r = await sw.pedir(MP3, { headers: { range: "bytes=0-" } });
    expect(r?.status).toBe(206);
    expect(r?.headers.get("content-range")).toBe("bytes 0-99/100");
    expect(r?.headers.get("accept-ranges")).toBe("bytes");
    expect(r?.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await r!.arrayBuffer()).length).toBe(100);
  });

  test("faixa no meio devolve exatamente os bytes pedidos", async () => {
    const sw = carregar(redeNormal);
    const r = await sw.pedir(MP3, { headers: { range: "bytes=10-19" } });
    expect(r?.status).toBe(206);
    expect(r?.headers.get("content-range")).toBe("bytes 10-19/100");
    expect([...new Uint8Array(await r!.arrayBuffer())]).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
  });

  test("forma sufixo (os últimos N bytes)", async () => {
    const sw = carregar(redeNormal);
    const r = await sw.pedir(MP3, { headers: { range: "bytes=-5" } });
    expect(r?.headers.get("content-range")).toBe("bytes 95-99/100");
    expect([...new Uint8Array(await r!.arrayBuffer())]).toEqual([95, 96, 97, 98, 99]);
  });

  test("fim além do arquivo é aparado, não recusado", async () => {
    const sw = carregar(redeNormal);
    const r = await sw.pedir(MP3, { headers: { range: "bytes=90-9999" } });
    expect(r?.status).toBe(206);
    expect(r?.headers.get("content-range")).toBe("bytes 90-99/100");
  });

  test("começo fora do arquivo devolve 416", async () => {
    const sw = carregar(redeNormal);
    const r = await sw.pedir(MP3, { headers: { range: "bytes=500-" } });
    expect(r?.status).toBe(416);
  });

  test("⚠️ o que vai para o cache é SEMPRE a resposta inteira, nunca a fatia", async () => {
    /* `cache.put` lança em status 206 — a Cache API recusa resposta parcial.
       Guardar a fatia quebraria o cache inteiro na primeira sessão do iPhone. */
    const sw = carregar(redeNormal);
    await sw.pedir(MP3, { headers: { range: "bytes=0-" } });
    expect(sw.caches.guardadas.map((r) => r.status)).toEqual([200]);
  });
});

describe("arquivo com hash no nome não se revalida", () => {
  test("o mesmo bundle não é buscado duas vezes", async () => {
    /* O nome carrega o conteúdo: o deploy seguinte gera outro nome. Revalidar
       era baixar o bundle inteiro a cada visita para jogar fora. */
    const sw = carregar(redeNormal);
    const js = "/assets/gestacao-path-CdiOkjf8.js";
    await sw.pedir(js);
    await sw.pedir(js);
    await sw.pedir(js);
    expect(sw.chamadas.filter((u) => u.endsWith(js)).length).toBe(1);
  });

  test("nome FIXO, FORA de /assets, continua revalidando por trás", async () => {
    /* O ícone e o manifesto mudam sem mudar de nome — se não revalidassem,
       ficariam presos na versão que a paciente instalou. É o outro lado da
       régua: sem este par, uma regra que congelasse o site inteiro passaria. */
    const sw = carregar(redeNormal);
    for (const fixo of ["/icon-192.png", "/manifest.webmanifest"]) {
      await sw.pedir(fixo);
      await sw.pedir(fixo);
      expect({ fixo, n: sw.chamadas.filter((u) => u.endsWith(fixo)).length }).toEqual({
        fixo,
        n: 2,
      });
    }
  });
});

describe("o que o worker não pode tocar", () => {
  test("/api/ e /auth passam direto", async () => {
    const sw = carregar(redeNormal);
    expect(await sw.pedir("/api/chat")).toBe(null);
    expect(await sw.pedir("/auth")).toBe(null);
  });

  test("POST passa direto", async () => {
    const sw = carregar(redeNormal);
    expect(await sw.pedir(MP3, { method: "POST" })).toBe(null);
  });

  test("áudio de outro domínio passa direto", async () => {
    /* `new URL(absoluta, base)` ignora a base — o pedido sai mesmo para fora.
       Interceptar áudio de terceiros encheria nosso cache com arquivo alheio. */
    const sw = carregar(redeNormal);
    expect(await sw.pedir("https://outro.com/a.mp3")).toBe(null);
    expect(sw.chamadas.length).toBe(0);
  });
});

describe("⚠️ o que NUNCA pode entrar no cache", () => {
  test("resposta de erro não é guardada como se fosse o arquivo", async () => {
    /* Um mp3 que não existe mais cai na função de SSR e volta como PÁGINA — e,
       como áudio não revalida, ela ficaria ali no lugar de uma fala até a
       próxima troca de versão do cache. */
    const sw = carregar(async () => new Response("<html>não achei</html>", { status: 404 }));
    const r = await sw.pedir(MP3);
    expect(r?.status).toBe(504);
    expect(sw.caches.guardadas.length).toBe(0);
  });

  test("HTML com status 200 no lugar do áudio também não entra", async () => {
    /* O 404 acima é o que nos salva HOJE, e ele depende de o roteador carimbar
       o status certo. O tipo é a segunda tranca, e é a que não depende de
       ninguém: se não é `audio/`, não é a fala dela. */
    const sw = carregar(
      async () => new Response("<html>ops</html>", { headers: { "content-type": "text/html" } }),
    );
    await sw.pedir(MP3);
    expect(sw.caches.guardadas.length).toBe(0);
  });

  test("cota cheia não guarda, não estoura, e ainda toca", async () => {
    /* Vale para as três rotas: áudio e os dois caminhos de estático. Uma
       rejeição não tratada aqui derruba o worker inteiro. */
    const sw = carregar(redeNormal, true);
    expect((await sw.pedir(MP3))?.status).toBe(200);
    expect((await sw.pedir("/assets/app-CdiOkjf8.js"))?.status).toBe(200);
    expect((await sw.pedir("/icon-192.png"))?.status).toBe(200);
    await new Promise((ok) => setTimeout(ok, 10)); // deixa qualquer rejeição aparecer
    expect(sw.caches.guardadas.length).toBe(0);
  });

  test("⚠️ um download por arquivo, mesmo com dois pedidos ao mesmo tempo", async () => {
    /* O elemento de mídia sonda antes de tocar, e `preparar()` já pode ter
       pedido o mesmo mp3: sem fila, os dois baixam — o dobro do 4G dela na
       mudança cujo propósito é parar de gastar 4G. */
    const sw = carregar(redeNormal);
    const [a, b] = await Promise.all([sw.pedir(MP3), sw.pedir(MP3)]);
    expect([a?.status, b?.status]).toEqual([200, 200]);
    expect(sw.chamadas.filter((u) => u.endsWith(".mp3")).length).toBe(1);
  });
});

describe("⚠️ a troca de versão não pode jogar fora os 16 MB de voz", () => {
  test("o áudio vive num cache SEM versão, e o activate o poupa", async () => {
    /* Os nomes dos mp3 têm hash de conteúdo: são idênticos entre um deploy e o
       seguinte. Subir de v4 para v5 por causa de uma linha de CSS faria a
       paciente re-baixar a meditação inteira, na rede que estivesse. */
    const sw = carregar(redeNormal);
    await sw.pedir(MP3);
    sw.caches.lojas.set("obstetricia-v3", new Map()); // sobra de um deploy antigo
    await sw.evento("activate");
    expect([...sw.caches.lojas.keys()].includes("obstetricia-v3")).toBe(false);
    expect([...sw.caches.lojas.keys()].includes("obstetricia-audio")).toBe(true);
    /* E continua tocando do disco, sem rede. */
    const chamadasAntes = sw.chamadas.length;
    expect((await sw.pedir(MP3))?.status).toBe(200);
    expect(sw.chamadas.length).toBe(chamadasAntes);
  });

  test("o install guarda o esqueleto", async () => {
    const sw = carregar(redeNormal);
    await sw.evento("install");
    const shell = sw.caches.lojas.get("obstetricia-v4");
    expect(shell?.size).toBeGreaterThan(5);
    expect([...(shell?.keys() ?? [])].some((k) => k.endsWith("/manifest.webmanifest"))).toBe(true);
  });

  test("o push ainda mostra a notificação", async () => {
    /* Este arquivo é o mesmo que entrega o aviso de emergência — nenhuma
       mudança de cache pode calar o push sem o teste perceber. */
    const sw = carregar(redeNormal);
    await sw.evento("push", {
      data: { json: () => ({ title: "Sua consulta é amanhã", body: "10:00", url: "/" }) },
    });
    expect(sw.avisos).toEqual(["Sua consulta é amanhã"]);
  });
});

describe("a lista de tipos", () => {
  test("mp3 está no AUDIO_RE — era exatamente esta a falta", () => {
    const re = /const AUDIO_RE = ([^\n]+);/.exec(FONTE)?.[1] ?? "";
    expect(re).toContain("mp3");
    expect(re).toContain("wav"); // os Sons para dormir tocam WAV de blob
  });

  test("⚠️ nada sem hash pode morar em `public/assets/`", () => {
    /* A regra de imutabilidade é o prefixo `/assets/` inteiro — a mesma que a
       Vercel já carimba com `immutable` no cabeçalho HTTP. Um arquivo colocado
       à mão em `public/assets/` cairia nela e ficaria congelado PARA SEMPRE no
       aparelho da paciente: nem recarregar, nem reinstalar, resolveria. */
    expect(existsSync("public/assets")).toBe(false);
  });
});
