/* ═══════════════════════════════════════════════════════════════════════════
   O QUE ESTE ARQUIVO GUARDA — e por que o áudio precisou de regra própria.

   Até ago/2026 a lista de tipos cacheados era `js|css|woff2|svg|png|ico|
   webmanifest|jpg|jpeg|webp`. O `.mp3` estava FORA — e a meditação tem 16 MB
   de voz gravada. Toda sessão dependia de rede, e sem rede a tela andava muda.
   Baixar para ouvir offline é recurso PAGO no Calm e no Headspace; aqui era
   uma linha de regex.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ⚠️ SÃO DOIS CACHES, E ISSO É DECISÃO, NÃO ARRUMAÇÃO.
   O nome do cache carrega a versão, e `activate` apaga tudo que não é a versão
   atual — então subir de v4 para v5 por causa de uma linha de CSS jogaria fora
   16 MB de voz que continuam VÁLIDOS: os nomes dos mp3 têm hash de conteúdo e
   são idênticos entre um deploy e o seguinte. A paciente re-baixaria a
   meditação inteira, na rede que estivesse, por uma mudança que não tem nada a
   ver com áudio. O cache de áudio não tem versão e sobrevive às trocas. */
const CACHE = "obstetricia-v4";
const CACHE_AUDIO = "obstetricia-audio";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/og.png",
  "/robots.txt",
];
const STATIC_RE = /\.(js|css|woff2?|svg|png|ico|webmanifest|jpg|jpeg|webp)(\?|$)/;
const AUDIO_RE = /\.(mp3|m4a|aac|ogg|wav)(\?|$)/;

/* ⚠️ ARQUIVO EM `/assets/` NÃO SE REVALIDA — e a régua é a MESMA do servidor.
   O Vite carimba o conteúdo no nome (`gestacao-path-CdiOkjf8.js`), e a Vercel
   serve todo o `/assets/` com `max-age=31536000, immutable` (ver
   `.vercel/output/config.json`). O stale-while-revalidate genérico buscava
   tudo de novo, em segundo plano, a cada visita: no 4G, o bundle inteiro
   baixado toda vez para ser jogado fora.
   Uma tentativa anterior desta regra tentava reconhecer o HASH
   (`-[A-Za-z0-9_-]{8,}`) e era pior: um `logo-consultorio.png` colocado em
   `public/assets/` casaria com ela e ficaria congelado para sempre no aparelho
   da paciente. Duas réguas diferentes para a mesma pergunta é como elas
   divergem. Esta diz o mesmo que o cabeçalho HTTP — nem mais, nem menos. */
const IMUTAVEL_RE = /^\/assets\//;

/**
 * A folha de "sem conexão" do APP.
 *
 * ⚠️ Escrita AQUI, e não buscada de um arquivo: ela existe justamente para o
 * momento em que não há rede, e um recuo que precisa de rede não é recuo. Fica
 * curta de propósito — é uma tela de espera, não uma página.
 *
 * A cor de fundo é a mesma `--background` do app em tema claro, para a
 * transição não piscar branco.
 */
const FOLHA_SEM_REDE = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão — Obstétrica</title>
<style>
 body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
 background:#fdf6f3;color:#2b2320;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
 .c{max-width:22rem;text-align:center}
 h1{font-size:1.35rem;margin:0 0 .5rem}
 p{margin:0 0 1.5rem;color:#6b5f5a;font-size:.95rem}
 button{border:0;border-radius:999px;background:#a85c58;color:#fff;font-size:.95rem;
 font-weight:600;padding:.75rem 1.75rem;min-height:44px}
</style></head><body><div class="c">
<h1>Sem conexão</h1>
<p>O app precisa de internet para carregar. Seus registros estão salvos — nada se perdeu.</p>
<button onclick="location.reload()">Tentar de novo</button>
</div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE && k !== CACHE_AUDIO).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Guarda sem nunca derrubar o pedido: cota cheia é motivo para não cachear. */
function guardar(nomeDoCache, chave, res) {
  return caches
    .open(nomeDoCache)
    .then((c) => c.put(chave, res))
    .catch(() => {});
}

/**
 * Recorta uma resposta INTEIRA no pedaço que o `<audio>` pediu.
 *
 * ⚠️ É isto que faz o áudio tocar no Safari com service worker no meio.
 * O elemento de mídia pede `Range: bytes=0-`, e responder 200 com o arquivo
 * completo a um pedido com Range é o que faz o Safari desistir da faixa em
 * silêncio — o mesmo sintoma de "o arquivo não existe". E não dá para
 * simplesmente guardar o 206 que a rede devolve: a Cache API RECUSA respostas
 * parciais (`cache.put` lança em status 206). Por isso o caminho é sempre
 * guardar o arquivo inteiro e fatiar aqui.
 *
 * Um caso fica de fora de propósito: FAIXA MÚLTIPLA (`bytes=0-50,100-150`).
 * A resposta certa seria `multipart/byteranges`, que exige montar um corpo
 * MIME inteiro — e nenhum navegador pede isso para um mp3 de 150 KB tocado do
 * começo ao fim. Responder o arquivo inteiro é permitido pela RFC 9110 (o
 * servidor pode ignorar o Range) e é o que fazemos; é o único caso em que 200
 * é a resposta a um pedido com faixa.
 */
async function recorte(resposta, cabecalho) {
  /* Tolerante a `BYTES=`, a espaços e à vírgula solta: quem escreve o
     cabeçalho é o navegador, e a norma não obriga uma grafia só. */
  const bruto = String(cabecalho).trim().toLowerCase().replace(/\s+/g, "");
  if (bruto.includes(",")) return resposta; // faixa múltipla — ver o comentário
  const m = /^bytes=(\d*)-(\d*)$/.exec(bruto);
  if (!m || (m[1] === "" && m[2] === "")) return resposta;

  const corpo = await resposta.arrayBuffer();
  const total = corpo.byteLength;
  const naoDa = () =>
    new Response(null, { status: 416, headers: { "content-range": `bytes */${total}` } });

  let inicio;
  let fim;
  if (m[1] === "") {
    // Forma sufixo: "os últimos N bytes".
    const n = Number(m[2]);
    if (!n) return naoDa();
    inicio = Math.max(0, total - n);
    fim = total - 1;
  } else {
    inicio = Number(m[1]);
    fim = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (!(inicio >= 0) || inicio > fim || inicio >= total) return naoDa();

  const pedaco = corpo.slice(inicio, fim + 1);
  return new Response(pedaco, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "content-type": resposta.headers.get("content-type") || "audio/mpeg",
      "content-length": String(pedaco.byteLength),
      "content-range": `bytes ${inicio}-${fim}/${total}`,
      "accept-ranges": "bytes",
    },
  });
}

/**
 * ⚠️ UM DOWNLOAD POR ARQUIVO, mesmo com dois pedidos ao mesmo tempo.
 *
 * O elemento de mídia costuma sondar o arquivo antes de tocar, e `preparar()`
 * (em `src/lib/voz.ts`) já pode ter pedido o mesmo mp3. Sem esta fila, os dois
 * erram o cache, os dois baixam e os dois guardam — o dobro do 4G dela na
 * mudança cujo propósito inteiro é parar de gastar 4G.
 */
const emVoo = new Map();

function arquivoInteiro(chave) {
  const jaVai = emVoo.get(chave);
  if (jaVai) return jaVai;
  const p = (async () => {
    /* Pedido NOVO, sem os cabeçalhos do original: é o que garante 200 (e não
       206) e, portanto, uma resposta que a Cache API aceita guardar. */
    const res = await fetch(chave);
    if (!res || res.status !== 200) return null;
    /* ⚠️ CONFERE O TIPO ANTES DE GUARDAR.
       Um mp3 que não existe mais no servidor cai na função de SSR e volta como
       PÁGINA HTML. Guardar isso sob o nome do áudio deixaria a paciente com uma
       página inteira no lugar de uma fala — e, como áudio não revalida, ela
       ficaria lá até a próxima troca de versão do cache. */
    const tipo = res.headers.get("content-type") || "";
    if (!tipo.startsWith("audio/")) return res;
    await guardar(CACHE_AUDIO, chave, res.clone());
    return res;
  })();
  emVoo.set(chave, p);
  /* Sai da fila de qualquer jeito: uma falha de rede não pode deixar o arquivo
     marcado como "já está vindo" para sempre. */
  p.catch(() => {}).then(() => emVoo.delete(chave));
  return p;
}

/**
 * Áudio: cache-first de verdade, e é ele que faz a meditação funcionar sem rede.
 *
 * A primeira sessão baixa; da segunda em diante o arquivo sai do disco — e
 * continua saindo no elevador, no carro e na sala de espera do hospital, que é
 * onde ela mais precisa. Guarda só o que ela de fato tocou: pré-carregar os
 * 16 MB seria gastar o 4G dela por uma sessão que talvez não aconteça.
 *
 * ⚠️ CUSTO CONHECIDO: no primeiro toque de cada arquivo, o worker baixa o
 * INTEIRO antes de devolver o primeiro byte — antes disso o navegador
 * transmitia progressivamente. No pior arquivo (156 KB) isso é ~3 s no link de
 * 400 kbps em que a latência da voz foi medida, contra 0,97–1,80 s de antes.
 * Quem paga essa conta é o `preparar()` de `voz.ts`, que busca a primeira fala
 * enquanto ela ainda escolhe a sessão e a próxima com 2,5 s de antecedência —
 * e a partir da segunda vez o arquivo é instantâneo, para sempre. Fatiar sem
 * ter o arquivo inteiro é impossível, e responder 200 a um pedido com Range é
 * justamente o que emudece o Safari.
 */
async function audioGuardado(request) {
  const cache = await caches.open(CACHE_AUDIO);
  /* ⚠️ A CHAVE É A URL, NUNCA O `request`.
     O pedido de mídia carrega `Range`, e guardar por ele criaria uma entrada
     por faixa pedida — além de sujeitar o casamento a um `Vary: Range`. */
  const chave = new URL(request.url).href;
  const faixa = request.headers.get("range");

  const guardada = await cache.match(chave);
  if (guardada) return faixa ? recorte(guardada, faixa) : guardada;

  let cheia;
  try {
    cheia = await arquivoInteiro(chave);
  } catch {
    cheia = null;
  }
  /* Offline e nunca tocado: devolve erro em vez de estourar. A tela já sabe
     seguir muda quando falta o arquivo — nunca com a voz errada. */
  if (!cheia) return new Response(null, { status: 504 });

  const copia = cheia.clone();
  return faixa ? recorte(copia, faixa) : copia;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth")
  )
    return;

  if (AUDIO_RE.test(url.pathname)) {
    event.respondWith(audioGuardado(request));
  } else if (STATIC_RE.test(url.pathname)) {
    if (IMUTAVEL_RE.test(url.pathname)) {
      // Nome com hash: o que está no cache É o arquivo. Rede só na primeira vez.
      event.respondWith(
        caches.match(request).then(
          (cached) =>
            cached ??
            fetch(request).then((res) => {
              if (res.ok) guardar(CACHE, request, res.clone());
              return res;
            }),
        ),
      );
    } else {
      // Nome fixo (ícones, manifesto): serve do cache e atualiza por trás.
      event.respondWith(
        caches.match(request).then((cached) => {
          const revalidate = fetch(request).then((res) => {
            if (res.ok) guardar(CACHE, request, res.clone());
            return res;
          });
          return cached ?? revalidate;
        }),
      );
    }
  } else if (request.mode === "navigate") {
    /* Network-first para navegação. O que muda é o FALLBACK.
     *
     * ⚠️ **SEM REDE, O APP VIRAVA O SITE.** O recuo era `caches.match("/")`
     * para qualquer navegação — então uma oscilação de rede a caminho de
     * `/minha-conta`, dentro do app instalado, entregava a HOME INSTITUCIONAL:
     * cabeçalho, rodapé, "Criar minha conta". Do lado dela o app não ficou
     * offline, ele virou outra coisa — e foi exatamente o que o dono viu e
     * descreveu ("ele volta pra como se fosse uma aba do site").
     *
     * A home continua sendo o recuo certo para quem navegava NO SITE: ali ela
     * é a página que a pessoa esperava mesmo.
     *
     * ⚠️ E o recuo do app NÃO é a home nem `/auth`: é uma folha própria, que
     * diz o que houve e oferece tentar de novo. Servir `/auth` sem rede seria
     * pedir login que não tem como acontecer, e ela concluiria que foi
     * desconectada. */
    const doApp = url.pathname.startsWith("/minha-conta") || url.pathname.startsWith("/painel");
    event.respondWith(
      fetch(request).catch(() =>
        doApp
          ? new Response(FOLHA_SEM_REDE, {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          : caches.match("/").then((r) => r ?? Response.error()),
      ),
    );
  }
});

// Notificações push
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, icon, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/minha-conta";
  event.waitUntil(clients.openWindow(url));
});
