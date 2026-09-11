import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ A CASCA DO APP É GUARDADA NA BORDA — e isso só é seguro enquanto ela NÃO
 * tiver nada por usuária (set/2026).
 *
 * `/minha-conta` é o `start_url` do app instalado, e o HTML dela passou a ser
 * guardado pela rede de distribuição da Vercel (`isr` no `vite.config.ts`),
 * para a abertura não esperar uma função fria em Washington.
 *
 * **A resposta guardada é servida para TODAS as pacientes.** Se alguém um dia
 * puser um `loader` ou um `beforeLoad` nessa rota que leia a sessão, o HTML de
 * UMA paciente passa a ser entregue às outras — num app de saúde, o pior
 * vazamento possível, e ele não daria erro nenhum: a tela simplesmente
 * mostraria o nome errado.
 *
 * Esta catraca é o que impede isso de acontecer em silêncio.
 *
 * O que a torna segura HOJE, conferido na produção antes de ligar:
 *   · a rota não tem `loader` nem `beforeLoad`
 *   · o `head()` é fixo
 *   · o portão de login roda no TELEFONE (`getSession` lê o disco)
 *   · a resposta não traz `Set-Cookie` nem `Vary`
 *   · `/minha-conta` e `/minha-conta?tab=Caminho` devolvem o MESMO HTML
 *     (medido: diferem só num carimbo de tempo do router)
 */

/** Sem os comentários — a prosa deste repositório cita o que ela proíbe. */
function semComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const CONFIG = semComentarios("vite.config.ts");
const CONTA = semComentarios("src/routes/_authenticated/minha-conta.tsx");
const PORTAO = semComentarios("src/routes/_authenticated/route.tsx");

/** O objeto passado ao `createFileRoute` da tela, e só ele. */
function rotaDaConta(): string {
  const i = CONTA.indexOf('createFileRoute("/_authenticated/minha-conta")({');
  expect(i).toBeGreaterThan(-1);
  /* Conta chaves a partir do `({` para pegar o objeto inteiro e parar nele —
     medir por distância mentiria no dia em que o `head()` crescer. */
  const abre = CONTA.indexOf("{", CONTA.indexOf("({", i) + 1);
  let n = 0;
  for (let k = abre; k < CONTA.length; k++) {
    if (CONTA[k] === "{") n++;
    else if (CONTA[k] === "}") {
      n--;
      if (n === 0) return CONTA.slice(abre, k + 1);
    }
  }
  throw new Error("objeto da rota não fecha");
}

describe("a casca guardada continua sendo a mesma para todas", () => {
  test("⚠️ a rota do app NÃO busca nada no servidor", () => {
    const rota = rotaDaConta();
    /* `loader` e `beforeLoad` rodam no servidor e podem ler a sessão: com a
       resposta guardada, o resultado de uma paciente iria para as outras. */
    expect(rota).not.toMatch(/\bloader\s*:/);
    expect(rota).not.toMatch(/\bbeforeLoad\s*:/);
    expect(rota).not.toMatch(/\bloaderDeps\s*:/);
    /* E o que sobra é só o título fixo e o componente. */
    expect(rota).toMatch(/\bhead\s*:/);
    expect(rota).toMatch(/\bcomponent\s*:/);
  });

  test("⚠️ o título e a descrição da casca são FIXOS", () => {
    const rota = rotaDaConta();
    const head = rota.slice(rota.indexOf("head:"), rota.indexOf("component:"));
    /* Um `${...}` aqui seria conteúdo por usuária dentro do HTML guardado. */
    expect(head).not.toContain("${");
  });

  test("⚠️ o portão de login roda no TELEFONE, não no servidor", () => {
    /* É isso que faz a casca não precisar saber quem está abrindo. Trocar por
       uma checagem de servidor exigiria tirar o `isr` no mesmo commit. */
    expect(PORTAO).toContain("getSession()");
    expect(PORTAO).not.toContain("createServerFn");
  });

  test("⚠️ a função roda em São Paulo, onde o banco está", () => {
    /* O banco é `sa-east-1`. Com a função em `iad1` (o padrão da Vercel), toda
       chamada de dado atravessava o continente duas vezes — e a função da
       carteira faz sete consultas EM SÉRIE, pagando a travessia em cada uma.
       Se um dia alguém tirar isto, tem de saber que está devolvendo essa
       conta. */
    expect(CONFIG).toMatch(/regions:\s*\["gru1"\]/);
  });

  test("a regra da borda está no build, e é por publicação", () => {
    expect(CONFIG).toContain('routeRules: { "/minha-conta"');
    expect(CONFIG).toMatch(/isr:\s*\{\s*expiration:\s*false\s*\}/);
    /* Só a casca do app. O site é renderizado no servidor (é o que os
       buscadores leem) e o painel do médico não entra nesta conta. */
    expect(CONFIG).not.toContain('"/painel"');
    expect(CONFIG).not.toMatch(/routeRules:\s*\{\s*"\/"/);
  });
});
