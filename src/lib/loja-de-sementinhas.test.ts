/**
 * A LOJA DE SEMENTINHAS — a tela, não o catálogo.
 *
 * `pacotes-sementinhas.test.ts` cobre os números (preço, bônus, escala) e
 * `canal-de-venda.test.ts` cobre a regra de canal. Faltava o que o commit desta
 * tela existe para garantir, e que não tinha teste nenhum:
 *
 * ─── ⚠️ O LAYOUT É FUNCIONAL AGORA, COM A COMPRA FECHADA ────────────────────
 *
 * O dono pediu a tela com todas as letras — "tem que ficar exatamente dessa
 * forma, e que esse layout ele seja funcional" — e `IAP_ATIVO` é `false`,
 * porque o app ainda não está na App Store nem no Google Play.
 *
 * A versão anterior do componente trocava os TRÊS CARTÕES por uma caixa de
 * aviso quando a compra estava fechada. Ou seja: o layout que ele pediu não
 * existiria até o app entrar na loja. Hoje os cartões sempre aparecem e só o
 * BOTÃO muda — ele explica em vez de cobrar.
 *
 * Nada travava isso. Voltar a esconder os cartões passava verde em toda a
 * suíte, que é o padrão que este projeto já nomeou uma vez: a régua tem teste,
 * a ENTREGA não tem nenhum (`bonus-e-mesada.test.ts`).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { IAP_ATIVO } from "./canal-de-venda";
import { PACOTES } from "./pacotes-sementinhas";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const tela = semComentarios("src/components/loja-sementinhas.tsx");

describe("⚠️ os três cartões existem mesmo com a compra fechada", () => {
  test("a lista sai de PACOTES, sem nenhum portão antes", () => {
    /**
     * O `map` sobre `PACOTES` não pode estar dentro de um ramo condicional de
     * `podeComprar`/`IAP_ATIVO`. É a diferença entre "a compra está fechada" e
     * "a tela não existe".
     */
    const i = tela.indexOf("PACOTES.map(");
    expect(i).toBeGreaterThan(-1);
    /* O trecho ENTRE a abertura da `<ul>` e o `map` não decide nada: se
       houvesse um `IAP_ATIVO ?` ali, os cartões seriam condicionais. */
    const antes = tela.slice(tela.lastIndexOf("<ul", i), i);
    expect(antes).not.toContain("podeComprar");
    expect(antes).not.toContain("IAP_ATIVO");
    expect(antes).not.toContain("veredito");
  });

  test("só o BOTÃO muda — e ele explica em vez de cobrar", () => {
    expect(tela).toContain("podeComprar ? comprar(p) :");
    expect(tela).toContain("podeComprar ? c.botao :");
    /* O rótulo de acessibilidade conta o estado, senão quem usa leitor de tela
       ouve "comprar" num botão que não compra. */
    expect(tela).toContain("compra ainda não disponível");
  });

  test("hoje a compra está mesmo fechada — este é o estado que a paciente vê", () => {
    /* Se um dia isto virar `true`, o teste acima continua valendo e este aqui
       vira a nota de que o mundo mudou. */
    expect(IAP_ATIVO).toBe(false);
  });

  test("são três cartões, e a fita é de um só", () => {
    expect(PACOTES).toHaveLength(3);
    expect(PACOTES.filter((p) => p.destaque)).toHaveLength(1);
  });
});

describe("⚠️ e a loja não abre no Modo Cuidado", () => {
  test("o portão mora DENTRO da tela, não só em quem a abre", () => {
    /**
     * Os dois chamadores já fecham a porta antes (o Caminho deixa o saldo em
     * `null` e o botão nem existe; a aba de Recompensas devolve
     * `SilencioDoCuidado`). Mas isso é uma SEGUNDA RÉGUA — o que este projeto
     * proíbe desde `humorDaJornada` e `presenteRecente`. Um terceiro chamador
     * abriria vitrine de compra para quem acabou de perder a gestação sem
     * ninguém ter errado nada: bastaria não saber da regra.
     */
    expect(tela).toContain("careMode");
    expect(tela).toContain("if (!aberto || careMode) return null;");
  });

  test("e os dois chamadores passam a bandeira", () => {
    const jogo = semComentarios("src/components/gestacao-path.tsx");
    const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");
    for (const fonte of [jogo, conta]) {
      const i = fonte.indexOf("<LojaSementinhas");
      expect(i).toBeGreaterThan(-1);
      expect(fonte.slice(i, i + 260)).toContain("careMode={careMode}");
    }
  });
});

describe("contraste do que a paciente lê", () => {
  /** Luminância relativa da WCAG. */
  const lum = (hex: string) => {
    const c = (hex.replace("#", "").match(/../g) ?? []).map((h) => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const razao = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  test("⚠️ todo fundo de botão desta tela passa 4,5:1 com o branco", () => {
    /**
     * Nenhum texto da tela é "grande" pela WCAG (o corte é 18,66px em negrito;
     * o maior aqui é 17px), então o mínimo é 4,5 — não 3.
     *
     * Uma auditoria mediu quatro reprovações, e a pior era a mais grave: o
     * PREÇO, branco sobre o cinza do botão desabilitado, a **2,64:1**. É o
     * estado que 100% das pacientes veem hoje, justamente o que o dono pediu
     * que ficasse funcional agora.
     */
    const fundos = [...tela.matchAll(/#[0-9a-f]{6}/g)]
      .map((m) => m[0])
      .filter((hex) => tela.includes(`botao: "${hex}"`) || tela.includes(`: "${hex}" }`));
    const usados = [
      ...new Set([
        ...fundos,
        /* Os dois que não vivem em `PALETA.cartao`: a fita e o cinza de
           "ainda não dá para comprar". Escritos aqui porque são o alvo do
           defeito, e um teste que só varre a paleta os perderia. */
        ...(tela.match(/fita: "(#[0-9a-f]{6})"/)?.slice(1) ?? []),
        ...(tela.match(/podeComprar \? c\.botao : "(#[0-9a-f]{6})"/)?.slice(1) ?? []),
      ]),
    ];
    expect(usados.length).toBeGreaterThanOrEqual(5);
    for (const hex of usados) {
      const r = razao("#ffffff", hex);
      expect(`${hex} ${r.toFixed(2)}`).toBe(`${hex} ${Math.max(r, 4.5).toFixed(2)}`);
    }
  });
});
