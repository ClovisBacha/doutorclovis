import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { criarPilhaDeTelas, TETO_DA_PILHA } from "./pilha-de-telas";

type T = { t: string };
const feed: T = { t: "feed" };
const raiz = (x: T) => x.t === "feed";

/** Anda por um caminho, como o efeito do componente faria. */
function caminhar(p: ReturnType<typeof criarPilhaDeTelas<T>>, telas: T[]) {
  for (let i = 1; i < telas.length; i++) p.andou(telas[i - 1], telas[i]);
}

describe("a pilha de telas da aba", () => {
  test("volta um passo de cada vez, na ordem em que ela andou", () => {
    const perfil = { t: "perfil" };
    const post = { t: "post" };
    const p = criarPilhaDeTelas<T>(raiz);
    caminhar(p, [feed, perfil, post]);
    expect(p.tamanho()).toBe(2);
    expect(p.voltar()).toBe(perfil);
    p.andou(post, perfil);
    expect(p.voltar()).toBe(feed);
  });

  test("⚠️ o passo do PRÓPRIO voltar não é empilhado", () => {
    /* Sem isso, voltar de `post` para `perfil` empilharia `post` — e o voltar
       seguinte reabriria a tela que este acabou de fechar. A paciente ficaria
       presa indo e voltando entre as duas. */
    const perfil = { t: "perfil" };
    const post = { t: "post" };
    const p = criarPilhaDeTelas<T>(raiz);
    caminhar(p, [feed, perfil, post]);
    const alvo = p.voltar();
    p.andou(post, alvo!);
    expect(p.tamanho()).toBe(1);
    expect(p.voltar()).toBe(feed);
  });

  test("⚠️ chegar à RAIZ zera o caminho", () => {
    const p = criarPilhaDeTelas<T>(raiz);
    caminhar(p, [feed, { t: "perfil" }, { t: "post" }, feed]);
    expect(p.tamanho()).toBe(0);
    expect(p.voltar()).toBeNull();
  });

  test("⚠️ voltar com a pilha vazia devolve `null` — e ainda assim marca", () => {
    /* Quem chamou manda a tela para a raiz nesse caso, e esse passo também não
       pode ser empilhado: senão a raiz entraria na pilha e o voltar seguinte
       sairia da raiz para a raiz. */
    const p = criarPilhaDeTelas<T>(raiz);
    const perfil = { t: "perfil" };
    p.andou(feed, perfil);
    p.voltar();
    expect(p.voltar()).toBeNull();
    p.andou(perfil, feed);
    expect(p.tamanho()).toBe(0);
  });

  test("o teto descarta o passo mais VELHO", () => {
    const p = criarPilhaDeTelas<T>(raiz, 3);
    const telas = [feed, { t: "a" }, { t: "b" }, { t: "c" }, { t: "d" }, { t: "e" }];
    caminhar(p, telas);
    expect(p.tamanho()).toBe(3);
    /* O topo continua sendo o passo mais NOVO — perder o novo tornaria o
       voltar imprevisível. */
    expect(p.voltar()).toBe(telas[4]);
  });

  test("andar para a mesma tela não empilha nada", () => {
    const p = criarPilhaDeTelas<T>(raiz);
    const perfil = { t: "perfil" };
    p.andou(feed, perfil);
    p.andou(perfil, perfil);
    expect(p.tamanho()).toBe(1);
  });

  test("o teto padrão é 20", () => {
    expect(TETO_DA_PILHA).toBe(20);
  });
});

/** Sem os comentários — a prosa cita tudo o que estes testes procuram. */
function semComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("⚠️ o voltar do Android sobe um nível em vez de fechar o app", () => {
  const CONTA = semComentarios("src/routes/_authenticated/minha-conta.tsx");
  const REDE = semComentarios("src/components/rede-instagram.tsx");

  test("a subida de aba é a MESMA `voltarDaBarra` da seta", () => {
    /* Uma segunda régua faria a seta desenhada e o botão do aparelho
       discordarem, e o defeito apareceria como "às vezes ele volta para outro
       lugar". */
    expect(CONTA).toContain("useVoltarDeFundo(!mobileHome, voltarDaBarra)");
  });

  test("⚠️ na RAIZ ela não se registra — o app tem de poder sair", () => {
    /* Registrada em `mobileHome`, a paciente ficaria presa dentro do app sem
       saída pelo gesto do sistema. */
    const i = CONTA.indexOf("useVoltarDeFundo(");
    expect(i).toBeGreaterThan(-1);
    expect(CONTA.slice(i, CONTA.indexOf(")", i))).toContain("!mobileHome");
  });

  test("⚠️ a Comunidade assume a vez SÓ fora do feed", () => {
    /* Registrada sempre, ela engoliria o voltar para sempre e a subida de aba
       nunca aconteceria — a paciente ficaria presa na Comunidade. */
    const i = REDE.indexOf("useVoltar(");
    expect(i).toBeGreaterThan(-1);
    expect(REDE.slice(i, REDE.indexOf(",", i))).toContain('onde.t !== "feed"');
  });

  test("⚠️ a Comunidade usa a pilha, e não um salto direto para o feed", () => {
    /* Saltar para o feed perderia um nível: de um post aberto a partir de um
       perfil, o voltar tem de devolver o PERFIL. */
    expect(REDE).toContain("criarPilhaDeTelas");
    const i = REDE.indexOf("useVoltar(");
    const corpo = REDE.slice(i, REDE.indexOf("});", i));
    expect(corpo).toContain(".voltar()");
  });
});

describe("⚠️ abrir uma tela da Comunidade começa no começo dela", () => {
  /* O reset de rolagem de `minha-conta` depende de `[tab, mobileHome,
     hubAberto]`, e dentro da Comunidade `tab` continua sendo "Feed" nos 25
     destinos — ele nunca disparava aqui. Medido a 393×852: lendo o feed em
     3.000 px e abrindo um perfil, o navegador clampa em 1.361 — o RODAPÉ do
     perfil, sem avatar nem nome à vista.
     ⚠️ Não dá para exercitar isto de ponta a ponta: `RedeNoApp` não tem
     bancada (`/preview-instagram` monta as telas internas direto). O que se
     cobra aqui são as três decisões que, erradas, desfazem o conserto. */
  const REDE = semComentarios("src/components/rede-instagram.tsx");
  const i = REDE.indexOf("useLayoutEffect(");
  const efeito = REDE.slice(i, REDE.indexOf("}, [onde]);", i));

  test("existe, e é de LAYOUT — não um efeito comum", () => {
    /* Com `useEffect` o navegador chega a PINTAR o rodapé da tela nova antes
       de saltar: o pisca que ele veio tirar. */
    expect(i).toBeGreaterThan(-1);
    expect(efeito).toContain("scrollTo");
  });

  test("⚠️ o FEED é a exceção — senão atropela o lugar guardado", () => {
    /* Quem restaura onde ela parou de ler é `lugar-no-feed.ts`. Sem esta
       linha, o app esqueceria isso toda vez que ela voltasse ao feed. */
    expect(efeito).toMatch(/onde\.t === "feed"[\s\S]{0,30}return/);
    expect(REDE).toContain("lugar-no-feed");
  });

  test("⚠️ `instant`, nunca `auto` — o `<html>` tem `scroll-behavior: smooth`", () => {
    expect(efeito).toContain('"instant"');
    expect(efeito).not.toContain('"smooth"');
  });
});

describe('⚠️ "Seguir" no perfil responde no toque', () => {
  /* O mesmo botão na fileira de sugeridas já respondia na hora; no perfil ele
     esperava a ida à rede, e a paciente tocava de novo achando que não tinha
     pegado. */
  const REDE = semComentarios("src/components/rede-instagram.tsx");
  const i = REDE.indexOf("async function seguir()");
  const corpo = REDE.slice(i, REDE.indexOf("\n  async function", i + 10));

  test("o rótulo muda ANTES da rede", () => {
    const pinta = corpo.indexOf("setPerfil(");
    const rede = corpo.indexOf("await ");
    expect(pinta).toBeGreaterThan(-1);
    expect(pinta).toBeLessThan(rede);
  });

  test("⚠️ o estado provisório sai da MESMA régua do rótulo", () => {
    /* `perfil.publico` decide entre seguir e pedir para seguir — um palpite
       aqui faria o botão dizer "Seguindo" num perfil privado, ou seja,
       prometer o que a régua recusa. */
    expect(corpo).toMatch(/perfil\.publico[\s\S]{0,60}"ativo"[\s\S]{0,40}"pendente"/);
  });

  test("⚠️ desfaz quando `r.ok` é falso — e não só no `catch`", () => {
    /* `{ ok: false }` chega numa resposta 200 NORMAL, que nenhum `try/catch`
       pega. É o defeito que este mesmo ramo já pagou uma vez. */
    expect([...corpo.matchAll(/r\.ok \? [^:]+: antes/g)].length).toBeGreaterThanOrEqual(2);
    expect(corpo).toMatch(/catch \{[\s\S]{0,120}meuVinculo: antes/);
  });

  test("⚠️ um toque por vez — o segundo dispararia a ação oposta", () => {
    /* ⚠️ A âncora é a GUARDA, não o nome: `seguindoEmVoo.current` aparece
       também no `finally`, então procurar o nome ficava verde com a guarda
       apagada. */
    expect(corpo).toMatch(/if \(seguindoEmVoo\.current\)\s*return/);
    expect(corpo).toMatch(/seguindoEmVoo\.current = true/);
    expect(corpo).toContain("finally");
    /* E a guarda vem ANTES de qualquer ida à rede. */
    expect(corpo.indexOf("seguindoEmVoo.current = true")).toBeLessThan(corpo.indexOf("await "));
    /* `useRef`, nunca estado: um estado só valeria no render seguinte. */
    expect(REDE).toContain("const seguindoEmVoo = useRef(false)");
  });

  test("⚠️ e o CONTEÚDO nunca é pintado por otimismo", () => {
    /* Só `meuVinculo` muda. Pintar publicação de perfil privado antes do
       aceite seria mostrar o que a régua existe para recusar. */
    const pintadas = [...corpo.matchAll(/setPerfil\(\{ \.\.\.perfil, ([a-zA-Z]+):/g)].map(
      (m) => m[1],
    );
    expect(new Set(pintadas)).toEqual(new Set(["meuVinculo"]));
  });
});
