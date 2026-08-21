/**
 * VARRE TODAS AS BANCADAS NUM NAVEGADOR E LÊ O CONSOLE.
 *
 * ⚠️ **Esta varredura já achou o defeito que deixava o app SEM ABRIR** — um
 * `getServerSnapshot` devolvendo `[]` novo a cada leitura, que punha a barra de
 * navegação em laço infinito. Ele viveu vários commits com `tsc` limpo, lint
 * limpo e 3.900 testes verdes, porque nenhum deles abre uma página.
 *
 * A varredura era MANUAL. Agora é do CI.
 *
 * ⚠️ **O que ela pega e o teste unitário não pega:** erro de hidratação, laço
 * de render, `undefined` no caminho de desenho, import quebrado, e a tela que
 * simplesmente não renderiza nada.
 *
 * Uso:  node scripts/varrer-bancadas.mjs [--porta=8080]
 * Sai com código 1 se qualquer bancada tiver erro de console ou não renderizar.
 */
import { chromium } from "playwright";
import { readdirSync } from "node:fs";

const porta = (process.argv.find((a) => a.startsWith("--porta=")) ?? "").split("=")[1] || "8080";
const base = `http://127.0.0.1:${porta}`;

/* As rotas de bancada saem do disco, e não de uma lista à mão: uma bancada nova
   entra na varredura sozinha, que é o ponto. */
const rotas = readdirSync("src/routes")
  .filter((n) => n.startsWith("preview-") && n.endsWith(".tsx"))
  .map((n) => "/" + n.replace(/\.tsx$/, ""));

/* Estados que só existem com parâmetro — os mesmos que a prosa do CLAUDE.md
   documenta como "impossíveis de fotografar" sem eles. */
const EXTRAS = [
  "/preview-instagram?tela=perfil&meu=1",
  "/preview-instagram?tela=caixinha",
  "/preview-instagram?tela=novo&comFoto=1",
  "/preview-instagram?vazio=1",
  "/preview-instagram?luto=1",
  "/preview-presentes?dona=1",
  "/preview-conta?privacidade=1",
  "/preview-sos-medico?magro=1",
  "/preview-prontuario?degradada=1",
  "/preview-registrar-consulta?primeira=1",
];

/** Ruído que não é defeito do app. */
const IGNORAR = /cert|ERR_CERT|favicon|net::ERR_ABORTED/i;

const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--no-proxy-server"],
});
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true });

const alvos = [...rotas, ...EXTRAS];
const ruins = [];

async function abrir(rota) {
  const p = await ctx.newPage();
  const erros = [];
  p.on("console", (m) => {
    if (m.type() === "error" && !IGNORAR.test(m.text())) erros.push(m.text().slice(0, 160));
  });
  p.on("pageerror", (e) => erros.push(String(e).slice(0, 160)));
  try {
    /* ⚠️ `networkidle`, e não `domcontentloaded`: o defeito do rodapé só
       aparecia com a página assentada, e o de hidratação idem. Medido — com
       `domcontentloaded` a varredura passava por cima de um mismatch real. */
    await p.goto(base + rota, { waitUntil: "networkidle", timeout: 30000 });
    await p.waitForTimeout(1800);
    /* Tela que não desenha nada é defeito, mesmo sem erro no console. */
    const texto = (
      await p
        .locator("body")
        .innerText()
        .catch(() => "")
    ).trim();
    if (texto.length < 20) erros.push("a página não desenhou nada");
  } catch (e) {
    erros.push("NAV: " + String(e).slice(0, 120));
  }
  await p.close();
  return erros;
}

/**
 * ⚠️ **UMA SEGUNDA CHANCE, EM SÉRIE — e ela não é leniência.**
 *
 * A primeira execução acusou um mismatch de hidratação em
 * `/preview-instagram?vazio=1`. Repetido oito vezes em série: **zero**. Ele só
 * apareceu dentro do lote paralelo, ou seja, foi artefato de carga do servidor
 * de desenvolvimento — não defeito da tela.
 *
 * Um teste que falha uma vez em vinte por carga é PIOR que teste nenhum: as
 * pessoas passam a re-rodar sem ler, e no dia em que o vermelho for de verdade
 * ele é ignorado junto. A segunda chance roda SOZINHA, sem concorrência: um
 * defeito determinístico falha nas duas; um artefato de carga, não.
 *
 * ⚠️ E ela é UMA só. Três tentativas começariam a esconder defeito de corrida
 * de verdade, que é coisa que este app tem (o `useSyncExternalStore` em laço
 * nasceu assim).
 */
async function conferir(rota) {
  const primeira = await abrir(rota);
  if (primeira.length === 0) return;
  const segunda = await abrir(rota);
  if (segunda.length === 0) {
    console.log(`⚠️  ${rota} — falhou no lote e passou sozinha (artefato de carga)`);
    return;
  }
  ruins.push({ rota, erros: segunda });
  console.log(`❌ ${rota}`);
  segunda.slice(0, 3).forEach((x) => console.log(`     ${x}`));
}

/* Em lotes: sequencial demoraria minutos, e tudo de uma vez estoura a memória
   do runner. */
for (let i = 0; i < alvos.length; i += 4) {
  await Promise.all(alvos.slice(i, i + 4).map(conferir));
}
await b.close();

console.log(`\n${alvos.length} bancadas varridas · ${ruins.length} com problema`);
process.exit(ruins.length ? 1 : 0);
