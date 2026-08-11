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

  test("esconder duas vezes não é esconder duas vezes", () => {
    expect(fonte).toContain("if (feito) return;");
  });
});

/**
 * ESTE É O TESTE MAIS IMPORTANTE DO ARQUIVO.
 *
 * A primeira versão da ponte falava com `window.Capacitor.Plugins.X`. Parecia
 * elegante — sem importar nada, sem engordar o bundle da web — e não fazia
 * absolutamente nada: `Capacitor.Plugins` só é preenchido pelo `registerPlugin`
 * do `@capacitor/core`, que roda quando a PÁGINA importa o pacote. A ponte
 * injetada publica `PluginHeaders` e `nativeCallback`, não os plugins. O
 * próprio `native-bridge.js` avisa `"App plugin not installed"` quando precisa
 * de um.
 *
 * O defeito não deixava rastro: `?.` engolia a chamada, nada dava erro, e a
 * paciente de iPhone continuava sem sentir a respiração guiada — que era a
 * única razão de a ponte existir.
 */
describe("os plugins vêm de import de verdade, não do global", () => {
  const fonte = readFileSync("src/lib/nativo.ts", "utf8");
  /* Sem comentários: o cabeçalho deste arquivo EXPLICA o defeito e cita
     `Capacitor.Plugins` várias vezes. O que se cobra é o código. */
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  test("nada neste arquivo lê `Capacitor.Plugins`", () => {
    expect(codigo).not.toContain(".Plugins");
  });

  test("cada plugin usado é importado do seu pacote", () => {
    for (const pkg of ["haptics", "splash-screen", "status-bar"]) {
      expect(fonte).toContain(`import("@capacitor/${pkg}")`);
    }
  });

  test("o import é dinâmico — o navegador não baixa código nativo", () => {
    /* Import estático colocaria os quatro pacotes no bundle de todo visitante
       do site. Dinâmico, o Vite separa num pedaço que só a casca busca. */
    expect(fonte).not.toMatch(/^import \{[^}]*\} from "@capacitor\//m);
  });

  test("uma falha de rede num pacote não derruba os outros", () => {
    expect(fonte.match(/\.catch\(\(\) => null\)/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("a barra de status e a inversão que engana quem revisa", () => {
  test('fundo escuro pede estilo "DARK" — que no Capacitor quer dizer TEXTO CLARO', async () => {
    /* Se alguém "corrigir" isto para o que parece intuitivo, o relógio do
       sistema fica preto sobre o céu de madrugada e some. É invisível na
       revisão de código e só aparece no aparelho, à noite. */
    const { estiloDaBarra } = await import("./nativo");
    expect(estiloDaBarra(true)).toBe("DARK");
    expect(estiloDaBarra(false)).toBe("LIGHT");
  });
});

describe("o boot nativo acontece antes de qualquer componente montar", () => {
  const router = readFileSync("src/router.tsx", "utf8");

  test("a chamada mora no começo do cliente, não num useEffect", () => {
    /* Num `useEffect` do `__root.tsx`, um erro de hidratação deixaria a marca
       na tela até o teto nativo estourar — e o menu do SITE apareceria por um
       quadro dentro do app. */
    const chamada = router.indexOf("\nprepararNativo();");
    expect(chamada).toBeGreaterThan(0);
    /* No escopo do módulo — antes da primeira função. Dentro de `getRouter` ela
       só rodaria quando o router fosse montado. */
    expect(chamada).toBeLessThan(router.indexOf("export const getRouter"));
  });

  test("a classe `.nativo` é posta antes de qualquer await", () => {
    const fonte = readFileSync("src/lib/nativo.ts", "utf8");
    const classe = fonte.indexOf('classList.add("nativo")');
    const carga = fonte.indexOf("void carregar().then");
    expect(classe).toBeGreaterThan(0);
    expect(classe).toBeLessThan(carga);
  });
});

describe("o SOS não pode prender a paciente numa tela sem saída", () => {
  /**
   * O DEFEITO, como o dono viu: depois de acionar o SOS, o app ficava numa
   * tela verde "Abrindo o WhatsApp…" para sempre, e só saía fechando e
   * reabrindo o app inteiro.
   *
   * ─── A CORREÇÃO ERRADA, E POR QUE ELA ERA ERRADA ──────────────────────
   *
   * Minha primeira tentativa foi NÃO abrir a tela no app instalado. Isso
   * apagava o defeito e apagava junto o recurso: o WhatsApp deixava de abrir
   * sozinho, e o dono foi claro — "estava funcionando perfeitamente, tinha que
   * continuar abrindo e enviando; única coisa é que essa tela fica infinita".
   *
   * ─── A CORREÇÃO CERTA ─────────────────────────────────────────────────
   *
   * A tela continua abrindo, e passa a SE RETIRAR. O que muda é como ela
   * entrega ao WhatsApp: pelo ESQUEMA do aplicativo (`whatsapp://`), que não
   * navega a página. Navegando para `wa.me` ela saía do nosso alcance — e era
   * isso que a deixava para sempre. Viva, ela percebe o WhatsApp assumir
   * (`visibilitychange`) e fecha, para que ao voltar a paciente encontre o app.
   */
  const sos = readFileSync("src/components/emergency-sheet.tsx", "utf8");
  const tel = readFileSync("src/lib/telefone.ts", "utf8");

  test("a tela de passagem CONTINUA sendo aberta — o recurso não foi apagado", () => {
    expect(sos).toContain('window.open("", "_blank")');
    /* Sem guarda de plataforma: o comportamento que funcionava vale para
       todo mundo. */
    const i = sos.indexOf('window.open("", "_blank")');
    expect(sos.slice(Math.max(0, i - 200), i)).not.toContain("emTelaCheia");
  });

  test("a entrega usa o ESQUEMA do aplicativo, que não navega a página", () => {
    /* É o que mantém a tela viva para poder sair. Com `wa.me` ela navega e
       fica fora do alcance de quem a abriu. */
    expect(tel).toContain("export function esquemaWhatsApp");
    expect(tel).toMatch(/whatsapp:\/\/send\?phone=/);
    expect(sos).toContain("esquemaWhatsApp(info.emergencyPhone, r.mensagem)");
    expect(sos).toContain("filha.__abrir(url, esquema)");
  });

  test("e ela fecha quando o WhatsApp assume", () => {
    /* `document.hidden` é o sinal de que ela cumpriu o papel. */
    expect(sos).toContain('document.addEventListener("visibilitychange"');
    expect(sos).toMatch(/if \(document\.hidden\) setTimeout\(fecha, 500\);/);
  });

  test("o ouvinte é armado ANTES de `__abrir`, não dentro dele", () => {
    /* Entre abrir a tela e o servidor responder passam alguns segundos. Se o
       ouvinte só existisse dentro de `__abrir`, sair do app nesse meio
       deixaria a paciente voltando para a tela verde. */
    const ouvinte = sos.indexOf('document.addEventListener("visibilitychange"');
    const abrir = sos.indexOf("window.__abrir = function");
    expect(ouvinte).toBeGreaterThan(-1);
    expect(abrir).toBeGreaterThan(-1);
    expect(ouvinte).toBeLessThan(abrir);
  });

  test("sem WhatsApp instalado, cai na página web em vez de travar", () => {
    expect(sos).toMatch(/if \(!document\.hidden && !saiu\) window\.location\.href = web;/);
    expect(sos).toMatch(/\}, 1800\);/);
  });

  test("e ainda há porta manual e cão de guarda", () => {
    /* Três redes para três falhas diferentes: o esquema que não existe, a
       página que não carrega, e o envio que nunca responde. */
    expect(sos).toContain("Voltar ao app");
    expect(sos).toMatch(/cachorro = window\.setTimeout/);
    expect(sos).toMatch(/\}, 12000\);/);
  });

  test("o cão de guarda é desarmado nos dois desfechos", () => {
    /* Armado depois de navegar, fecharia a tela 12 s depois — no meio do
       caminho de quem não tem WhatsApp e caiu na página web. */
    expect([...sos.matchAll(/window\.clearTimeout\(cachorro\)/g)]).toHaveLength(2);
  });

  test("NENHUMA crase dentro do script injetado", () => {
    /* Ele mora dentro de um template literal do TypeScript: uma crase ali
       fecha a string, e o arquivo inteiro deixa de compilar. Custou uma
       volta. */
    const i = sos.indexOf("<script>");
    const j = sos.indexOf("</script>", i);
    expect(i).toBeGreaterThan(-1);
    expect(sos.slice(i, j)).not.toContain("`");
  });
});
