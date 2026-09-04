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
