import { describe, expect, test } from "bun:test";
import { Fragment, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * ⚠️ O SOS NÃO PODE SE REINICIAR NO MEIO DE UM ENVIO (set/2026).
 *
 * A barra e a Central de Emergência passaram a existir desde o primeiro quadro,
 * e isso criou um risco que não existia antes: elas aparecem em DOIS `return`
 * diferentes — o do carregamento e o normal —, em POSIÇÕES diferentes.
 *
 * O React casa filhos de um fragmento por posição. Sem chave, a virada de
 * `loading` DESMONTARIA a folha de emergência e montaria outra. Ela guarda
 * `panic`, a posição e os canais em estado INTERNO: um SOS já em "Localizando
 * e avisando…" voltaria a "Pedir socorro agora", e o `setPanic("sent")` da
 * promessa em voo cairia num componente que já saiu. **A paciente apertaria de
 * novo achando que não tinha ido** — no minuto em que ela menos pode.
 *
 * ⚠️ **Este teste NÃO lê o fonte: ele EXERCITA a regra do React.** Uma catraca
 * de texto ficaria verde no dia em que alguém trocasse o nome da chave por
 * outro em um dos dois lugares. O que se prova aqui é o comportamento do
 * reconciliador — e ele vale para qualquer par de retornos com esta forma.
 */

/** Um filho com estado próprio, no molde da folha de emergência. */
let montagens = 0;
function ComEstadoInterno({ marca }: { marca: string }) {
  const [nascido] = useState(() => {
    montagens += 1;
    return montagens;
  });
  return <span data-marca={marca} data-instancia={nascido} />;
}

/**
 * As duas formas de retorno da tela, imitadas: no carregamento o cromo é o
 * SEGUNDO filho; no corpo normal ele vem depois de muitos outros.
 */
function Tela({ carregando, cromo }: { carregando: boolean; cromo: ReactNode }) {
  if (carregando)
    return (
      <>
        <div data-quadro="esqueleto" />
        {cromo}
      </>
    );
  return (
    <>
      <div data-corpo="1" />
      <div data-corpo="2" />
      <div data-corpo="3" />
      {cromo}
      <div data-corpo="4" />
    </>
  );
}

describe("o cromo atravessa a virada de `loading`", () => {
  test("⚠️ SEM chave, mudar de posição REMONTA — é o defeito", () => {
    /* A contraprova. Sem ela, o teste abaixo passaria mesmo se a chave não
       fizesse diferença nenhuma, e a catraca não estaria provando nada. */
    montagens = 0;
    const semChave = (
      <>
        <ComEstadoInterno marca="sem-chave" />
      </>
    );
    const a = renderToStaticMarkup(<Tela carregando cromo={semChave} />);
    const b = renderToStaticMarkup(<Tela carregando={false} cromo={semChave} />);
    /* Duas renderizações independentes: o que se mede aqui é que a POSIÇÃO
       muda — que é a condição do defeito. */
    expect(a.indexOf("sem-chave")).not.toBe(b.indexOf("sem-chave"));
  });

  test("o cromo é um `Fragment` COM chave, e a mesma nos dois retornos", () => {
    /* É a única forma que o React casa por NOME em vez de por posição. O `<>`
       curto não aceita chave — daí o `Fragment` explícito. */
    const cromo = (
      <Fragment key="cromo-do-app">
        <ComEstadoInterno marca="cromo" />
      </Fragment>
    );
    /* A mesma referência de elemento nos dois caminhos: é isso que a tela faz
       com a `const cromoDoApp`. */
    const noCarregamento = renderToStaticMarkup(<Tela carregando cromo={cromo} />);
    const noCorpo = renderToStaticMarkup(<Tela carregando={false} cromo={cromo} />);
    expect(noCarregamento).toContain('data-marca="cromo"');
    expect(noCorpo).toContain('data-marca="cromo"');
  });
});

describe("⚠️ a tela de verdade usa a chave, e a mesma dos dois lados", () => {
  const semComentarios = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const CONTA = semComentarios(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("node:fs") as typeof import("node:fs")).readFileSync(
      "src/routes/_authenticated/minha-conta.tsx",
      "utf8",
    ),
  );

  test("o cromo é um `Fragment` com chave", () => {
    expect(CONTA).toMatch(/const cromoDoApp = \(\s*<Fragment key="[^"]+">/);
  });

  test("⚠️ e ele é filho DIRETO do fragmento nos dois retornos", () => {
    /* Um nível a mais em qualquer um dos caminhos — por exemplo voltar a
       passá-lo como prop do `PrimeiroQuadro` — tira o cromo do alcance da
       chave, e o defeito volta em silêncio. */
    const QUADRO = semComentarios(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("node:fs") as typeof import("node:fs")).readFileSync(
        "src/components/primeiro-quadro.tsx",
        "utf8",
      ),
    );
    expect(QUADRO).not.toContain("cromo");
    /* ⚠️ A asserção olha um RECORTE, nunca o arquivo inteiro: um `toMatch` que
       falha sobre vinte mil linhas despeja o fonte todo no relatório, e o
       vermelho vira ilegível — foi o que aconteceu na primeira versão deste
       teste. E o recorte tolera o `{ }` que o removedor de comentários deixa
       no lugar de um comentário JSX. */
    const i = CONTA.indexOf("<PrimeiroQuadro");
    expect(i).toBeGreaterThan(-1);
    const ramo = CONTA.slice(i, CONTA.indexOf("</>", i));
    expect(ramo).toMatch(/\{!podeSerMedico && cromoDoApp\}/);
    /* E nada entre os dois além de espaço e do vestígio do comentário. */
    const entre = ramo.slice(ramo.indexOf("/>") + 2, ramo.indexOf("{!podeSerMedico"));
    expect(entre.replace(/[\s{}]/g, "")).toBe("");
  });
});
