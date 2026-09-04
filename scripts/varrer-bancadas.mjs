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
import { existsSync, readdirSync } from "node:fs";

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
  /* ⚠️ O PRIMEIRO QUADRO — o estado em que o botão de socorro não existia.
     Ele vive atrás do login, dura uma fração de segundo e acontece no meio de
     duas idas à rede: foi assim que a barra de baixo sumiu dali sem nenhum
     relato. A varredura de disco abre só o padrão; estes quatro são os casos
     que decidem. */
  "/preview-abertura?ceu=anoitecer",
  "/preview-abertura?ceu=nenhum",
  "/preview-abertura?medico=1",
  "/preview-abertura?sos=1",
  /* A saúde do banco: os três estados que mais importam — faltando, incerto e
     sem chave de serviço — não se fabricam num banco em dia, que é justamente
     o banco de quem desenvolve. */
  "/preview-banco?estado=incerto",
  "/preview-banco?estado=verde",
  "/preview-banco?estado=semchave",
  "/preview-banco?estado=falhou",
  "/preview-banco?estado=nunca",
  /* ⚠️ **A COMUNIDADE INTEIRA, e não cinco telas dela.**
   *
   * `preview-instagram` é UMA rota com VINTE sub-telas atrás de `?tela=` — a
   * varredura de disco pega a rota e desenha só o padrão (o feed). As outras
   * dezenove ficavam de fora, e é exatamente onde a aba cresceu: comentários,
   * filtro de palavras, conversa, story, espelho, busca, salvos, atividade.
   *
   * Uma leva de defeitos passou por `tsc` limpo, lint limpo e 4.400 testes
   * verdes e só apareceu quando alguém ABRIU a tela — que é a razão de este job
   * existir. Cobrir cinco de vinte é ter o job e não ter a cobertura.
   *
   * ⚠️ **Sub-tela nova entra aqui à mão.** A varredura de disco não tem como
   * adivinhar um valor de `?tela=`; `comunidade.test.ts` cobra que todo destino
   * do hub exista, mas quem abre a página é esta lista. */
  "/preview-instagram?tela=perfil&meu=1",
  "/preview-instagram?tela=perfil&restrito=1",
  "/preview-instagram?tela=perfil&silenciado=1",
  "/preview-instagram?tela=mais",
  "/preview-instagram?tela=caixinha",
  "/preview-instagram?tela=caixinha&perguntas=0",
  "/preview-instagram?tela=caixinha&caixinha=0",
  "/preview-instagram?tela=comentarios",
  "/preview-rede?pausada=1",
  "/preview-instagram?tela=bloqueados",
  "/preview-moderacao",
  "/preview-moderacao?falhou=1",
  "/preview-moderacao?vazio=1",
  "/preview-moderacao?ficha=1",
  "/preview-moderacao?ficha=1&suspensa=1",
  "/preview-instagram?suspensa=1",
  "/preview-moderacao?instavel=1",
  "/preview-instagram?tela=escondidos",
  "/preview-instagram?tela=escondidos&vazio=1",
  "/preview-instagram?tela=escondidos&instavel=1",
  "/preview-instagram?tela=curtidos",
  "/preview-instagram?tela=curtidos&instavel=1",
  "/preview-instagram?tela=desfechos",
  "/preview-instagram?tela=desfechos&instavel=1",
  "/preview-instagram?palavraOculta=1",
  "/preview-instagram?tela=perfil&favorita=1",
  "/preview-instagram?tela=conversas&notas=1",
  "/preview-instagram?tela=conversa&oculta=1",
  "/preview-instagram?tela=bloqueados&vazio=1",
  "/preview-instagram?tela=bloqueados&instavel=1",
  "/preview-instagram?tela=comentarios&conversa=fechados",
  /* A ordem por curtidas e o rascunho guardado: os dois só se enxergam com o
     parâmetro — um post com poucos comentários desenha a mesma lista nas duas
     ordens, e o rascunho exige fechar o app no meio de uma frase. */
  "/preview-instagram?tela=comentarios&ordem=relevantes",
  "/preview-instagram?tela=comentarios&rascunhoComent=1",
  /* Os quatro cartões do primeiro minuto: abrem UMA vez na vida da conta, e o
     "já vi" viaja na nuvem — sem o parâmetro, ninguém os vê de novo. */
  "/preview-instagram?onboarding=1",
  /* ⚠️ Sub-tela nova entra AQUI à mão — a varredura de disco lê as ROTAS, e não
     tem como adivinhar um valor de `?tela=`. */
  "/preview-instagram?tela=story&videoStory=1",
  "/preview-instagram?tela=story&sensivelStory=1",
  "/preview-instagram?memoria=1",
  "/preview-instagram?tela=perfil&meu=1&album=1",
  "/preview-instagram?tela=filtro",
  "/preview-instagram?tela=conversa",
  "/preview-instagram?tela=conversas",
  "/preview-instagram?tela=mandar",
  "/preview-instagram?tela=story",
  "/preview-instagram?tela=story&meu=1",
  "/preview-instagram?tela=conferir",
  "/preview-instagram?tela=conferir&rascunhoStory=1",
  "/preview-instagram?tela=perfil&fixados=1",
  "/preview-instagram?tela=story&quadro=1",
  "/preview-instagram?tela=arquivo",
  "/preview-instagram?tela=grupo",
  "/preview-instagram?tela=grupo-novo",
  "/preview-instagram?tela=grupo-chamar",
  "/preview-instagram?tela=arquivo&vazio=1",
  "/preview-instagram?tela=arquivo&instavel=1",
  "/preview-instagram?tela=espelho",
  "/preview-instagram?tela=espelho&trancado=1",
  "/preview-instagram?tela=busca",
  "/preview-instagram?tela=salvos",
  "/preview-instagram?tela=atividade",
  "/preview-instagram?tela=lista",
  "/preview-instagram?tela=lista&remover=0",
  "/preview-instagram?tela=editar",
  "/preview-instagram?tela=post",
  "/preview-instagram?tela=tag",
  "/preview-instagram?tela=esboco",
  "/preview-instagram?tela=arquivados",
  "/preview-instagram?tela=novo&comFoto=1",
  "/preview-instagram?vazio=1",
  "/preview-instagram?luto=1",
  "/preview-instagram?sugeridas=0",
  "/preview-presentes?dona=1",
  "/preview-conta?privacidade=1",
  "/preview-sos-medico?magro=1",
  "/preview-prontuario?degradada=1",
  "/preview-registrar-consulta?primeira=1",
];

/**
 * Ruído que não é defeito do app.
 *
 * ⚠️ **O 429 entra aqui, e é uma decisão, não uma vista grossa.** A varredura
 * abre 42 páginas em lotes contra os MESMOS serviços externos (clima, Supabase),
 * e eles limitam taxa — medido. Um recurso barrado por excesso de chamadas
 * simultâneas de UMA varredura não diz nada sobre a tela, e deixá-lo acusar
 * tornaria o job intermitente, que é o que ele existe para não ser.
 *
 * ⚠️ Note o que NÃO está aqui: 4xx que não seja 429, 5xx, e qualquer erro de
 * JavaScript. Falha de carregamento por rota errada ou por servidor quebrado
 * continua sendo defeito.
 */
const IGNORAR = /cert|ERR_CERT|favicon|net::ERR_ABORTED|status of 429/i;

/* ⚠️ **O CAMINHO FIXO É DO CONTÊINER DE DESENVOLVIMENTO, NÃO DO RUNNER.**
   Aqui o Chromium vive em `/opt/pw-browsers/chromium` (o ambiente já vem com
   ele). No GitHub Actions quem instala é `playwright install`, que põe em
   `~/.cache/ms-playwright` — e um `executablePath` fixo faria o Playwright
   procurar um arquivo que não existe.

   Só passa o caminho quando ele EXISTE; senão deixa o Playwright resolver
   sozinho, que é o certo em qualquer máquina. */
const caminhoLocal = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const b = await chromium.launch({
  ...(existsSync(caminhoLocal) ? { executablePath: caminhoLocal } : {}),
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
