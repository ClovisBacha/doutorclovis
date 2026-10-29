import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "./sem-comentarios";

/**
 * ⚠️ **A VARREDURA DE ACESSIBILIDADE FALHAVA ABERTA DE TRÊS JEITOS, e os três
 * davam PERMISSÃO — que é o pior desfecho possível para um instrumento de
 * verificação.**
 *
 *  1. **Aprovava sem ter medido nada.** Com o servidor de dev no chão, as 22
 *     rotas devolviam `ERR_CONNECTION_REFUSED` e o relatório saía
 *     `22 telas · contraste 0 · alvo 0`, com código de saída ZERO. Medido.
 *  2. **Contava a moldura do SITE.** Toda `/preview-*` é rota do site
 *     institucional, então o cabeçalho e o rodapé dele aparecem em cada
 *     bancada — e `/minha-conta`, que é o app, os ESCONDE. Eram 17 controles ×
 *     22 telas = **374 dos 473 achados**: a dívida de verdade (75) ficava
 *     invisível no meio do ruído, e um relatório de 474 linhas não é lido.
 *  3. **Reprovava o que está certo** — o link de salto (`sr-only`, 1×1 até
 *     receber foco) e a caixinha de um checkbox envolvido por um `<label>` de
 *     44, que é justamente o conserto que este repositório já tinha feito.
 *
 * A contraprova das duas primeiras foi rodada à mão e está registrada no
 * CLAUDE.md: `BASE_DA_VARREDURA` apontado para uma porta morta sai **1**, e uma
 * bancada que deixou de existir (404) sai **1**.
 *
 * ⚠️ E a prosa é tirada antes de procurar: os comentários deste conserto CITAM
 * `header,footer,nav` e `sr-only` para explicar por que não são usados — um
 * teste que casasse o arquivo cru ficaria verde exatamente sobre o defeito.
 */
const VARREDURA = semComentarios(readFileSync("scripts/acessibilidade.mjs", "utf8"));

describe("⚠️ a varredura não aprova o que ela não mediu", () => {
  test("só conta a tela DEPOIS de medir, e diz quantas de quantas", () => {
    const i = VARREDURA.indexOf("const r = await p.evaluate(MEDIR)");
    const j = VARREDURA.indexOf("abriram++");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(VARREDURA).toMatch(/de \$\{ROTAS\.length\} telas MEDIDAS/);
  });

  test("uma tela que não abriu REPROVA a execução inteira", () => {
    expect(VARREDURA).toMatch(/naoAbriram\.push\(rota\)/);
    const i = VARREDURA.indexOf("if (naoAbriram.length)");
    expect(i).toBeGreaterThan(-1);
    expect(VARREDURA.slice(i)).toContain("process.exit(1)");
  });

  test("⚠️ o código HTTP é conferido — um 404 DESENHA uma tela", () => {
    expect(VARREDURA).toMatch(/resp\.status\(\) >= 400/);
  });

  test("⚠️ tela que abriu e não desenhou nada também não foi medida", () => {
    const i = VARREDURA.indexOf("document.body.innerText");
    expect(i).toBeGreaterThan(-1);
    expect(VARREDURA.slice(i, i + 220)).toContain("throw new Error");
  });

  test("a contraprova existe: o endereço é parametrizável", () => {
    expect(VARREDURA).toMatch(/process\.env\.BASE_DA_VARREDURA/);
  });
});

describe("⚠️ a varredura separa o app da moldura do site", () => {
  test("o separador é `.chrome-publico`, o mesmo que /minha-conta esconde", () => {
    expect(VARREDURA).toMatch(/moldura: !!alvo\.closest\("\.chrome-publico"\)/);
  });

  /* ⚠️ A heurística foi TENTADA e mordeu para o lado perigoso: o cartão de
     publicação da Comunidade é um `<header>` de verdade, então os botões de
     editar e fixar — dois alvos reais de 36 de largura — sumiam para o balde do
     site. Uma varredura que move defeito do app para a lista "não é comigo" é
     pior que uma que o conta duas vezes. */
  test("⚠️ NUNCA por `header,footer,nav` — o post da Comunidade é um <header>", () => {
    expect(VARREDURA).not.toMatch(/closest\(\s*["']header/);
  });

  test("o total do app não soma a moldura, e ela é dita à parte", () => {
    expect(VARREDURA).toMatch(/total\.alvo \+= r\.alvo\.filter\(\(x\) => !x\.moldura\)\.length/);
    expect(VARREDURA).toMatch(/alvoDaMoldura/);
  });
});

describe("⚠️ a varredura não reprova o que está certo", () => {
  test("o link de salto (`sr-only`) não é alvo de toque", () => {
    const i = VARREDURA.indexOf(
      "querySelectorAll('button,a[href],[role=\"button\"],input,select')",
    );
    expect(i).toBeGreaterThan(-1);
    expect(VARREDURA.slice(i, i + 900)).toMatch(/includes\("sr-only"\)[\s\S]{0,20}continue/);
  });

  test("o alvo de um campo dentro de um <label> é o LABEL", () => {
    expect(VARREDURA).toMatch(/const alvo = el\.closest\("label"\) \?\? el/);
  });
});

/**
 * ⚠️ **OS CONTROLES QUE MEDIAM O GLIFO.** Um botão sem caixa mede o DESENHO —
 * e `×` é um glifo estreito, `🔊` é um emoji. Os números abaixo foram MEDIDOS a
 * 393px, não estimados.
 *
 * ⚠️ E o que se cobra é a GARANTIA (existe caixa de 44 declarada), aceitando
 * mais de uma grafia: este repositório já teve teste reprovando `min-h-[44px]`
 * por exigir `min-h-11`, que é a outra escrita do mesmo alvo.
 */
const REDE = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));
const CAMINHO = semComentarios(readFileSync("src/components/gestacao-path.tsx", "utf8"));

/** A classe do primeiro botão cujo bloco contém a âncora dada. */
function classeDoBotao(fonte: string, ancora: string): string {
  const i = fonte.indexOf(ancora);
  /* ⚠️ Âncora que não casa devolve −1, e uma fatia a partir de −1 é UM
     caractere: o `toMatch` seguinte ficaria vermelho pelo motivo errado, ou
     (numa negativa) verde sobre nada. Ela é conferida, e o nome vai na
     mensagem do próprio matcher. */
  if (i < 0) throw new Error(`âncora não encontrada no fonte: ${ancora}`);
  /* O `className` do MESMO elemento: entre a âncora e o fim da tag. */
  const fim = fonte.indexOf(">", i);
  const trecho = fonte.slice(Math.max(0, i - 600), fim);
  const m = [...trecho.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].pop();
  if (!m) throw new Error(`sem className perto de: ${ancora}`);
  return (m[1] ?? m[2] ?? "") as string;
}

const ALTURA = /(^|\s)(h-11|min-h-11|min-h-\[44px\]|after:-inset-\[5px\])(\s|$)/;
const LARGURA = /(^|\s)(w-11|min-w-11|min-w-\[44px\]|after:-inset-\[5px\])(\s|$)/;

describe("⚠️ os controles de ícone e os destrutivos têm caixa de 44", () => {
  /* ⚠️ Um laço, e NÃO `test.each`: ele não é tipado no `bun:test` e o `tsc` da
     CI reprova com `TS2339` — a quarta forma da mesma armadilha, e a catraca de
     `matchers-do-bun` passou a cobri-la depois de ela me pegar aqui. */
  const MEDIDOS: Array<[string, string, string]> = [
    ['aria-label="Descartar o rascunho"', REDE, "18×16 — e ele APAGA o que ela escreveu"],
    ['aria-label="Dispensar o resumo da semana"', REDE, "23×18"],
    ['aria-label="Editar a legenda"', REDE, "36 de largura"],
    ['aria-label="Trocar o som de fundo"', CAMINHO, "25×20"],
  ];
  for (const [ancora, fonte, medida] of MEDIDOS) {
    test(`${ancora} — media ${medida}`, () => {
      const cls = classeDoBotao(fonte, ancora);
      expect(cls).toMatch(ALTURA);
      expect(cls).toMatch(LARGURA);
    });
  }

  test("o `Recuperar` ao lado do × também, senão o par continua desigual", () => {
    expect(classeDoBotao(REDE, ">\n              Recuperar")).toMatch(ALTURA);
  });

  /* ⚠️ `-inset-1` sobre um botão COM BORDA dá 42, e não 44: um absoluto se
     posiciona contra o PADDING BOX do pai. Medido no `getComputedStyle` do
     `::after` — a conta é `tamanho − 2×borda + 2×inset`. */
  test("⚠️ a pausa cresce a ÁREA pelo `after`, com o inset que fecha os 44", () => {
    const cls = classeDoBotao(CAMINHO, 'aria-label={pausada ? "Continuar" : "Pausar"}');
    expect(cls).toContain("relative");
    expect(cls).toMatch(/after:-inset-\[5px\]/);
    expect(cls).not.toMatch(/after:-inset-1(\s|$)/);
  });
});
