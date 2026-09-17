import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ O REALCE E O RETORNO AO TOQUE ANDAM JUNTOS (set/2026).
 *
 * O retângulo cinza que o navegador pinta ao tocar é o tell número um de
 * "isto é uma página". Tirá-lo é uma linha — e sozinha ela deixaria a MAIORIA
 * dos botões do app muda ao dedo: medido em oito bancadas, só 245 dos 801
 * alvos têm `.press`, o retorno ao toque do app.
 *
 * Esta catraca existe para as duas linhas nunca se separarem. Quem apagar o
 * `:active` amanhã, tentando "limpar CSS", fica vermelho aqui em vez de
 * descobrir pelo aparelho de uma paciente.
 *
 * E ela cobra a GARANTIA, nunca a escrita: qualquer seletor serve, desde que
 * o controle escureça, o desabilitado fique de fora, o campo continue
 * selecionável e o telefone continue com o menu do sistema.
 */

/** Sem os comentários — a prosa do arquivo cita tudo o que ela proíbe. */
const CSS = readFileSync("src/styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** O bloco `@media` que carrega a regra do toque, contado por chaves. */
function blocoDoToque(): string {
  const marca = CSS.indexOf("-webkit-tap-highlight-color");
  expect(marca).toBeGreaterThan(-1);
  /* Anda para trás até o `@media` que o contém, e daí conta as chaves —
     medir por distância mentiria no dia em que a regra crescer. */
  const abreMedia = CSS.lastIndexOf("@media", marca);
  expect(abreMedia).toBeGreaterThan(-1);
  const abre = CSS.indexOf("{", abreMedia);
  let n = 0;
  for (let k = abre; k < CSS.length; k++) {
    if (CSS[k] === "{") n++;
    else if (CSS[k] === "}") {
      n--;
      if (n === 0) return CSS.slice(abreMedia, k + 1);
    }
  }
  throw new Error("o bloco do toque não fecha");
}

describe("o toque responde como no aparelho", () => {
  test("⚠️ tirar o realce e repor o retorno são a MESMA regra", () => {
    const b = blocoDoToque();
    expect(b).toContain("-webkit-tap-highlight-color");
    /* O que entra no lugar: controle escurece enquanto o dedo está nele. */
    expect(b).toMatch(/:active\b[\s\S]*\{[^}]*opacity:/);
  });

  test("⚠️ o retorno é `opacity`, NUNCA `transform`", () => {
    /* Um `transform` num ancestral vira bloco de contenção para descendente
       `fixed` — e este app tem folha `fixed inset-0` dentro de botão. O
       `.press` paga esse risco em 245 elementos, por ser opt-in; a regra
       global não pode pagá-lo em 801. */
    const b = blocoDoToque();
    const regraAtiva = b.slice(b.indexOf(":active"));
    const corpo = regraAtiva.slice(regraAtiva.indexOf("{"), regraAtiva.indexOf("}") + 1);
    expect(corpo).toContain("opacity");
    expect(corpo).not.toContain("transform");
    expect(corpo).not.toContain("scale");
  });

  test("⚠️ o botão DESABILITADO não escurece — ele clarearia", () => {
    /* Botão desabilitado vive em `opacity-50`, e esta regra (fora de @layer)
       venceria a utilitária: ao toque ele iria a 0,62 e ficaria MAIS claro,
       dizendo que está disponível. Medido em `/preview-convites?estado=
       esgotada`: fica em 0,4 e nenhum clareia. */
    const b = blocoDoToque();
    const ativa = b.slice(b.indexOf(":active"));
    const seletor = ativa.slice(0, ativa.indexOf("{"));
    const antes = b.slice(0, b.indexOf(":active"));
    const todo = antes.slice(antes.lastIndexOf("}") + 1) + seletor;
    expect(todo).toContain(":disabled");
    expect(todo).toContain('aria-disabled="true"');
  });

  test("⚠️ rótulo de controle não é texto para copiar — e campo continua sendo", () => {
    const b = blocoDoToque();
    expect(b).toMatch(/user-select:\s*none/);
    /* E a exceção existe: o que ela digita nunca perde a seleção. */
    expect(b).toMatch(/user-select:\s*text/);
    const excecao = b.slice(b.lastIndexOf("input"));
    expect(excecao).toContain("textarea");
    expect(excecao).toMatch(/user-select:\s*text/);
  });

  test("⚠️ `a[href]` fica FORA da trava de seleção", () => {
    /* `tel:` e `wa.me` da Central de Emergência precisam do menu do sistema
       no toque longo. Medido: 11 de 11 links de telefone e WhatsApp seguem
       com `-webkit-touch-callout` liberado. */
    const b = blocoDoToque();
    const i = b.indexOf("user-select: none");
    expect(i).toBeGreaterThan(-1);
    const seletorDaTrava = b.slice(
      b.lastIndexOf("}", i) + 1,
      b.indexOf("{", b.lastIndexOf("}", i)),
    );
    expect(seletorDaTrava).not.toContain("a[href]");
  });

  test("o dedo não faz o navegador esperar o toque duplo", () => {
    expect(blocoDoToque()).toMatch(/touch-action:\s*manipulation/);
  });

  test("⚠️ conter a rolagem DA PÁGINA não vale no navegador comum", () => {
    /* No navegador o puxar-para-atualizar é dele e fica; instalado ou na
       casca, quem atualiza é o `PullToRefresh` — e ele se liga pelo MESMO par
       de recortes (`standalone` OU nativo).
       ⚠️ A âncora é a regra de `html`/`body`, nunca a primeira ocorrência
       de `overscroll-behavior` no arquivo: a contenção das LISTAS vem antes
       e vale em todo lugar, e um `indexOf` solto passaria a medi-la. */
    const i = CSS.search(/html,\s*\n?\s*body\s*\{[^}]*overscroll-behavior/);
    expect(i).toBeGreaterThan(-1);
    const media = CSS.slice(CSS.lastIndexOf("@media", i), i);
    expect(media).toContain("display-mode: standalone");
  });

  test("⚠️ a regra vive FORA de @layer, para vencer as utilitárias", () => {
    /* `opacity-50`, `select-text` e afins são utilitárias em @layer: dentro
       de uma camada, esta regra perderia para elas e não valeria nada.
       Mesma razão do piso de 16px dos campos. */
    const marca = CSS.indexOf("-webkit-tap-highlight-color");
    /* Percorre até a marca guardando a PILHA de blocos abertos. Contar a
       profundidade não serviria: o número muda quando a regra é
       reestruturada, e o que importa é o TIPO do que está aberto. */
    const pilha: string[] = [];
    let inicio = 0;
    for (let k = 0; k < marca; k++) {
      if (CSS[k] === "{") {
        pilha.push(CSS.slice(inicio, k).trim().split("\n").pop()?.trim() ?? "");
        inicio = k + 1;
      } else if (CSS[k] === "}") {
        pilha.pop();
        inicio = k + 1;
      }
    }
    expect(pilha.some((p) => p.startsWith("@layer"))).toBe(false);
  });
});

describe("a rolagem para onde a lista acaba", () => {
  test("⚠️ a contenção é uma REGRA, não 50 edições", () => {
    /* Medido: 50 contêineres roláveis no app da paciente e três com
       `overscroll-contain` escrito à mão. A 51ª lista nasceria sem ela. */
    const b = blocoDoToque();
    expect(b).toMatch(/\[class\*="overflow-y-auto"\]/);
    expect(b).toMatch(/overscroll-behavior-y:\s*contain/);
  });

  test("⚠️ só o eixo Y — o X tiraria o voltar por deslize do Android", () => {
    const b = blocoDoToque();
    const i = b.indexOf('[class*="overflow-y-auto"]');
    const regra = b.slice(i, b.indexOf("}", i) + 1);
    expect(regra).not.toContain("overflow-x-auto");
    expect(regra).not.toMatch(/overscroll-behavior-x/);
    expect(regra).not.toMatch(/overscroll-behavior:\s*contain/);
  });
});

describe("⚠️ `standalone` não pode ser o único portão — ele é FALSO na casca", () => {
  /* Num WKWebView do Capacitor o display-mode é `browser` e
     `navigator.standalone` é indefinido. Com o portão sozinho, o app instalado
     como PWA teria mais gesto de app que o app NATIVO. A prova de que
     standalone é falso lá está em `src/lib/avisos.ts` e `src/lib/push.ts`. */
  const PTR = readFileSync("src/components/pull-to-refresh.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  test("a contenção da página também vale para `html.nativo`", () => {
    const i = CSS.search(/html,\s*\n?\s*body\s*\{[^}]*overscroll-behavior/);
    expect(i).toBeGreaterThan(-1);
    /* A marca que `prepararNativo()` põe de forma síncrona, antes de hidratar. */
    expect(CSS).toMatch(/html\.nativo[\s\S]{0,80}overscroll-behavior-y:\s*contain/);
  });

  test("o puxar-para-atualizar liga na casca também", () => {
    expect(PTR).toContain("ehNativo()");
    const i = PTR.indexOf("setEnabled(");
    expect(i).toBeGreaterThan(-1);
    const chamada = PTR.slice(i, PTR.indexOf(";", i));
    expect(chamada).toContain("standalone");
    expect(chamada).toContain("ehNativo()");
  });

  test('⚠️ o convite "Instalar o app" NÃO aparece dentro do app instalado', () => {
    /* `navigator.standalone` é indefinido na casca, então o ramo do iPhone
       dava `true` lá dentro: a paciente que baixou o app da loja recebia, na
       primeira tela, um cartão mandando "toque em compartilhar ↑" — numa tela
       sem barra de navegador. */
    const ROOT = readFileSync("src/routes/__root.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const i = ROOT.indexOf("function PWAInstallBanner()");
    expect(i).toBeGreaterThan(-1);
    const corpo = ROOT.slice(i, ROOT.indexOf("\n}", i));
    expect(corpo).toMatch(/ehAppInstalado\(\)[\s\S]{0,20}return/);
  });

  test("⚠️ ...e CONTINUA no Safari comum do iPhone", () => {
    /* É lá que instalar destrava o push, que é o canal do aviso de consulta e
       do retorno do SOS. Esconder ali tiraria dela o caminho da emergência —
       por isso a régua é "já está instalado", nunca "é iPhone". */
    const NATIVO = readFileSync("src/lib/nativo.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const i = NATIVO.indexOf("export function ehAppInstalado()");
    const corpo = NATIVO.slice(i, NATIVO.indexOf("\n}", i));
    expect(corpo).toContain("ehNativo()");
    expect(corpo).toContain("display-mode: standalone");
    expect(corpo).toContain("standalone");
    /* E ela não olha o user agent: iPhone no Safari não é "instalado". */
    expect(corpo).not.toContain("userAgent");
  });

  test("⚠️ e a decisão continua num EFEITO, nunca no render", () => {
    /* `ehNativo()` lê um global que não existe no servidor: no render, ele
       trocaria um gesto faltando por uma quebra de hidratação. */
    const i = PTR.indexOf("ehNativo()");
    const efeito = PTR.lastIndexOf("useEffect(", i);
    expect(efeito).toBeGreaterThan(-1);
    expect(efeito).toBeLessThan(i);
  });
});

describe("⚠️ o carrossel do feed declara o gesto que ele consome", () => {
  /* Esta `div` tem toque duplo PRÓPRIO (janela de 320 ms, que dá ❤️). Sem
     `touch-action`, o navegador continua com o direito de ler os mesmos dois
     toques como ZOOM: a paciente toca duas vezes na ultrassom para curtir e a
     página amplia. A regra do bloco `pointer: coarse` alcança botão e afins;
     uma `div` fica de fora. */
  const REDE = readFileSync("src/components/rede-instagram.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  test("o carrossel do post declara `manipulation`", () => {
    const i = REDE.indexOf("snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]");
    expect(i).toBeGreaterThan(-1);
    /* A âncora é a MESMA `div`: o `style` dela vem logo abaixo do className. */
    const bloco = REDE.slice(i, REDE.indexOf(">", i));
    expect(bloco).toContain('touchAction: "manipulation"');
  });

  test("⚠️ e nunca `none` — mataria a rolagem lateral do próprio carrossel", () => {
    const i = REDE.indexOf("snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]");
    const bloco = REDE.slice(i, REDE.indexOf(">", i));
    expect(bloco).not.toContain('touchAction: "none"');
  });

  test("⚠️ o viewport NÃO trava a escala — a pinça é acessibilidade", () => {
    /* `user-scalable=no`/`maximum-scale` matariam o zoom por pinça, que é
       falha de WCAG e é o que a paciente com pouca visão usa para ler o
       telefone do 192. `manipulation` tira só o toque duplo. */
    const ROOT = readFileSync("src/routes/__root.tsx", "utf8");
    expect(ROOT).toContain("width=device-width");
    expect(ROOT).not.toContain("user-scalable=no");
    expect(ROOT).not.toContain("maximum-scale");
  });
});
