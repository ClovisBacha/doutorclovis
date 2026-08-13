/**
 * A NOITE — histórias para dormir e a sessão para dois.
 *
 * O que estes testes protegem: 65 arquivos de voz que custaram 38,70 créditos
 * para existir. Um `id` renomeado órfã um arquivo; um bloco novo sem áudio faz
 * a história andar em silêncio. Os dois são invisíveis sem teste.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  duracaoAproximada,
  HISTORIAS,
  historiaPorChave,
  pausaDepoisDo,
  todosOsBlocos,
} from "./historias-para-dormir";
import { ROTULO_DO_ALVO, SESSAO_DO_CASAL, duracaoDaSessaoDoCasal } from "./sessao-do-casal";

const arquivosDe = (dir: string) =>
  new Set(
    readdirSync(`src/assets/audio/${dir}`)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.slice(0, -4)),
  );

describe("todo bloco tem voz, e toda voz tem bloco", () => {
  test("as histórias", () => {
    /* Um bloco sem mp3 anda em silêncio; um mp3 sem bloco é crédito jogado
       fora e ninguém percebe. */
    const arquivos = arquivosDe("dormir");
    const ids = todosOsBlocos().map((b) => b.id);
    expect(ids.filter((id) => !arquivos.has(id))).toEqual([]);
    expect([...arquivos].filter((f) => !ids.includes(f))).toEqual([]);
  });

  test("a sessão do casal", () => {
    const arquivos = arquivosDe("casal");
    const ids = SESSAO_DO_CASAL.blocos.map((b) => b.id);
    expect(ids.filter((id) => !arquivos.has(id))).toEqual([]);
    expect([...arquivos].filter((f) => !ids.includes(f))).toEqual([]);
  });

  test("nenhum id se repete entre as duas histórias", () => {
    const ids = todosOsBlocos().map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("⚠️ o que faz uma história SERVIR para dormir", () => {
  test("nenhuma pergunta — pergunta acorda", () => {
    /* Uma pergunta convoca a cabeça a responder, e é o contrário do que a tela
       existe para fazer. */
    for (const h of HISTORIAS) {
      const comPergunta = h.blocos.filter((b) => b.texto.includes("?"));
      expect({ h: h.chave, ids: comPergunta.map((b) => b.id) }).toEqual({ h: h.chave, ids: [] });
    }
  });

  test("o silêncio CRESCE do começo ao fim", () => {
    /* É a curva que faz a voz se afastar. Pausas iguais fariam um audiolivro
       lido devagar, que não é a mesma coisa. */
    for (const h of HISTORIAS) {
      const p = h.blocos.map((_, i) => pausaDepoisDo(i, h.blocos.length));
      expect({ h: h.chave, cresce: p.every((v, i) => i === 0 || v >= p[i - 1]) }).toEqual({
        h: h.chave,
        cresce: true,
      });
      expect(p[0]).toBeLessThan(p[p.length - 1]);
      expect(p[p.length - 1]).toBeGreaterThanOrEqual(15);
    }
  });

  test("⚠️ as duas atravessam o Modo Cuidado", () => {
    /* É o único conteúdo do app que serve a quem acabou de perder a gestação
       sem precisar de ressalva — e só serve porque não cita nada disso. A
       noite de quem está de luto é exatamente uma noite ruim. */
    const proibido = /\b(beb[êe]|barriga|gr[áa]vid|gesta[çc]|parto|filh[oa])\b/i;
    for (const h of HISTORIAS) {
      expect({ h: h.chave, noLuto: h.noLuto }).toEqual({ h: h.chave, noLuto: true });
      const cita = h.blocos.filter((b) => proibido.test(b.texto)).map((b) => b.id);
      expect({ h: h.chave, cita }).toEqual({ h: h.chave, cita: [] });
    }
  });

  test("cada história passa dos oito minutos", () => {
    /* Abaixo disso ela acaba antes de a pessoa desligar, e o silêncio súbito
       acorda quem estava quase lá. */
    for (const h of HISTORIAS) {
      expect({ h: h.chave, min: duracaoAproximada(h) >= 8 }).toEqual({ h: h.chave, min: true });
    }
  });

  test("a primeira fala já dá permissão de dormir no meio", () => {
    for (const h of HISTORIAS) {
      expect(h.blocos[0].texto.toLowerCase()).toMatch(/dormir|interrompid|at[ée] o fim/);
    }
  });

  test("historiaPorChave acha e não inventa", () => {
    expect(historiaPorChave("casa-do-mar")?.titulo).toBe("A casa junto ao mar");
    expect(historiaPorChave("inexistente")).toBe(null);
  });
});

describe("⚠️ a sessão do casal não pode constranger ninguém", () => {
  test("o acompanhante NUNCA tem gênero", () => {
    /* Pode ser o pai, a companheira, a mãe dela ou a irmã. "Ele" exclui três
       desses quatro na primeira frase. */
    const gen = SESSAO_DO_CASAL.blocos.filter((b) =>
      /\b(ele|dele|marido|papai|esposo)\b/i.test(b.texto),
    );
    expect(gen.map((b) => b.id)).toEqual([]);
  });

  test("nada pede que alguém SINTA — só instrução concreta", () => {
    /* "Sinta o amor entre vocês" é o que faz um casal adulto fechar o app. */
    const piegas = /\b(sinta[m]? o|energia|conex[ãa]o m[áa]gica|amor flu)\b/i;
    expect(SESSAO_DO_CASAL.blocos.filter((b) => piegas.test(b.texto)).map((b) => b.id)).toEqual([]);
  });

  test("todo bloco diz A QUEM fala, e os três alvos aparecem", () => {
    const alvos = new Set(SESSAO_DO_CASAL.blocos.map((b) => b.alvo));
    expect([...alvos].sort()).toEqual(["dois", "ela", "par"]);
    expect(Object.keys(ROTULO_DO_ALVO).sort()).toEqual(["dois", "ela", "par"]);
  });

  test("as três técnicas de parto estão lá, na ordem", () => {
    const t = SESSAO_DO_CASAL.blocos.map((b) => b.texto).join(" ");
    const ordem = ["ritmo da respiração dela", "base da coluna", "escolham uma palavra"];
    let ultimo = -1;
    for (const marca of ordem) {
      const i = t.indexOf(marca);
      expect({ marca, achou: i >= 0, depois: i > ultimo }).toEqual({
        marca,
        achou: true,
        depois: true,
      });
      ultimo = i;
    }
  });

  test("a pressão é dita como PRESSÃO, não como carinho", () => {
    /* É a manobra com melhor evidência de alívio de dor lombar no trabalho de
       parto, e ela só funciona com força de verdade. */
    const bloco = SESSAO_DO_CASAL.blocos.find((b) => b.id === "casal-07");
    expect(bloco?.texto).toContain("Não é carinho: é pressão");
  });

  test("dura entre 8 e 14 minutos", () => {
    const m = duracaoDaSessaoDoCasal();
    expect(m).toBeGreaterThanOrEqual(8);
    expect(m).toBeLessThanOrEqual(14);
  });

  test("as figuras declaradas são as que a tela sabe desenhar", () => {
    const fonte = readFileSync("src/components/sessao-do-casal.tsx", "utf8");
    for (const b of SESSAO_DO_CASAL.blocos) {
      if (!b.figura) continue;
      expect({ id: b.id, desenha: fonte.includes(`tipo === "${b.figura}"`) }).toEqual({
        id: b.id,
        desenha: true,
      });
    }
  });
});

describe("as telas", () => {
  const noite = readFileSync("src/components/historia-da-noite.tsx", "utf8");
  const sons = readFileSync("src/components/sons-para-dormir.tsx", "utf8");
  const casal = readFileSync("src/components/sessao-do-casal.tsx", "utf8");

  test("⚠️ a história NÃO mostra o texto na tela", () => {
    /* Ler acorda. A tela existe para o contrário. */
    expect(noite).toContain("O texto NÃO aparece");
    expect(noite).not.toContain("{bloco.texto}");
  });

  test("a tela escurece sozinha e o toque REARMA o relógio", () => {
    /* Sem rearmar, o primeiro toque acenderia a tela para o resto da noite. */
    expect(noite).toContain("setTimeout(() => setEscuro(true), 20_000)");
    expect(noite).toContain("onTouchStart={acender}");
  });

  test("⚠️ abrir a história destrava o som contínuo NO MESMO TOQUE", () => {
    /* A entrega acontece onze minutos depois, sem gesto nenhum — no iOS ela
       seria recusada se o elemento não tivesse sido destravado antes. */
    const fn = sons.slice(
      sons.indexOf("function abrirHistoria("),
      sons.indexOf("const entregarAoSom"),
    );
    expect(fn).toContain("tocador.current?.destravar()");
  });

  test("a história termina entregando ao som, não ao silêncio", () => {
    expect(sons).toContain('tocador.current?.tocar("chuva")');
    expect(sons).toContain("aoTerminar={() => void entregarAoSom()}");
  });

  test("a sessão do casal mantém a tela ACESA — o contrário da história", () => {
    /* Os dois estão de mãos ocupadas por dez minutos e ninguém vai tocar no
       celular. */
    expect(casal).toContain("return manterTelaAcesa();");
    expect(noite).not.toContain("manterTelaAcesa");
  });

  test("a narração da história é arrastada, e sem mudar a voz", () => {
    expect(noite).toContain("const RITMO = 0.92");
    expect(noite).toContain("preservesPitch = true");
  });
});
