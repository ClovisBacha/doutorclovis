// Fotografa telas do app na web (react-native-web), a 393×852 (iPhone 15 Pro),
// e lê o console de cada uma. Sem iPhone aqui, é a única forma de OLHAR o app.
//
//   bun run export:web            # gera dist-web/
//   node scripts/fotografar.mjs <pasta-de-saida> /rota?bancada=1 /outra?bancada=1&x=y ...
//
// Sai com código 1 se alguma tela der erro de JavaScript, erro de console ou
// abrir em branco. ⚠️ A área segura é ZERO no Chromium: o que fica atrás da
// ilha dinâmica num iPhone não aparece aqui — confira as bordas com isso em mente.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const raiz = resolve(new URL("..", import.meta.url).pathname, "dist-web");
const [saida, ...rotas] = process.argv.slice(2);
if (!saida || !rotas.length) {
  console.error("uso: node scripts/fotografar.mjs <pasta> /rota?bancada=1 ...");
  process.exit(2);
}
if (!existsSync(join(raiz, "index.html"))) {
  console.error("❌ dist-web/ não existe — rode `bun run export:web` antes.");
  process.exit(2);
}
mkdirSync(saida, { recursive: true });

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".json": "application/json", ".ico": "image/x-icon", ".mp3": "audio/mpeg" };
const servidor = createServer((req, res) => {
  const caminho = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let arquivo = join(raiz, caminho);
  if (!arquivo.startsWith(raiz) || !existsSync(arquivo) || statSync(arquivo).isDirectory()) arquivo = join(raiz, "index.html");
  res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream" });
  res.end(readFileSync(arquivo));
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const porta = servidor.address().port;

const exe = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const navegador = await chromium.launch({ executablePath: exe });
let falhas = 0;
for (const rota of rotas) {
  const pagina = await navegador.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
  const problemas = [];
  pagina.on("pageerror", (e) => problemas.push(`JS: ${e.message}`));
  pagina.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Chamadas ao servidor sem sessão real na bancada: esperadas e ruído aqui.
    if (/Failed to load resource|net::ERR|supabase\.co|obstetrica\.com\.br|CORS|fetch/i.test(t)) return;
    problemas.push(`console: ${t.slice(0, 300)}`);
  });
  await pagina.goto(`http://127.0.0.1:${porta}${rota}`, { waitUntil: "networkidle" }).catch((e) => problemas.push(`navegação: ${e.message}`));
  await pagina.waitForTimeout(1200);
  const texto = (await pagina.evaluate(() => document.body?.innerText ?? "").catch(() => "")).trim();
  if (texto.length < 3) problemas.push("tela em branco");
  const nome = rota.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 80) || "raiz";
  await pagina.screenshot({ path: join(saida, `${nome}.png`), fullPage: true });
  console.log(`${problemas.length ? "❌" : "✅"} ${rota} → ${nome}.png${problemas.length ? "\n   " + problemas.join("\n   ") : ""}`);
  if (problemas.length) falhas++;
  await pagina.close();
}
await navegador.close();
servidor.close();
process.exit(falhas ? 1 : 0);
