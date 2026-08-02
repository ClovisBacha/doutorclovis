/**
 * A bolha, travada em teste.
 *
 * Duas coisas aqui não têm como ser verificadas olhando: o acoplamento entre
 * dois arquivos e a física das curvas. As duas falham em silêncio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O ACOPLAMENTO
 *
 * `DURACAO_ACAO` (TypeScript) decide quando a classe SAI. `animation-duration`
 * (CSS) decide quanto a animação DURA. São arquivos diferentes e nada os
 * mantém juntos.
 *
 * Se o CSS ficar mais longo que o JS, a animação é cortada no meio — a bolha
 * congela no ar e volta ao repouso de um quadro para o outro. Se ficar mais
 * curto, ela termina e fica parada esperando a classe sair, sem flutuar.
 * Nenhum dos dois quebra nada: só fica feio, e ninguém liga um ao outro
 * olhando o resultado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A FÍSICA
 *
 * Os princípios que separam "se mexe" de "está viva" são verificáveis nos
 * números dos keyframes:
 *
 *  · ANTECIPAÇÃO — todo movimento começa para o lado contrário
 *  · VOLUME CONSTANTE — ao achatar em Y tem que alargar em X
 *  · AMORTECIMENTO — cada oscilação menor que a anterior
 *
 * Sem teste, qualquer um deles some numa edição de "ajustar o timing" e o
 * resultado continua parecendo uma animação — só que morta.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DURACAO_ACAO, type Acao } from "./bolha";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** A `animation-duration` declarada para uma classe de ação, em ms. */
function duracaoNoCss(acao: Acao): number[] {
  const achados: number[] = [];
  const re = new RegExp(`\\.bolha-${acao}[^{]*\\{[^}]*animation:[^;]*?(\\d+)ms`, "g");
  for (const m of css.matchAll(re)) achados.push(Number(m[1]));
  return achados;
}

/** Os quadros de um `@keyframes`, como pares [porcentagem, corpo]. */
function quadros(nome: string): Array<[number, string]> {
  const bloco = css.match(new RegExp(`@keyframes ${nome}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!bloco) throw new Error(`@keyframes ${nome} não existe`);
  const saida: Array<[number, string]> = [];
  /* Um seletor pode listar várias porcentagens ("0%, 100% {"), e prettier as
     quebra em linhas. Por isso o casamento é sobre o bloco inteiro. */
  for (const m of bloco[1].matchAll(/([\d%,\s]+)\{([^}]*)\}/g)) {
    const corpo = m[2];
    for (const p of m[1].matchAll(/([\d.]+)%/g)) saida.push([Number(p[1]), corpo]);
  }
  return saida.sort((a, b) => a[0] - b[0]);
}

/** `scale(x, y)` de um corpo de quadro. */
function escala(corpo: string): { x: number; y: number } | null {
  const m = corpo.match(/scale\(([-\d.]+),\s*([-\d.]+)\)/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** `translateY(v%)` de um corpo de quadro. */
function transY(corpo: string): number | null {
  const m = corpo.match(/translateY\(([-\d.]+)%\)/);
  return m ? Number(m[1]) : null;
}

/** `rotate(v deg)` de um corpo de quadro. */
function giro(corpo: string): number | null {
  const m = corpo.match(/rotate\(([-\d.]+)deg\)/);
  return m ? Number(m[1]) : null;
}

describe("o JS e o CSS concordam sobre quanto dura cada ação", () => {
  for (const acao of Object.keys(DURACAO_ACAO) as Acao[]) {
    test(`${acao}`, () => {
      const noCss = duracaoNoCss(acao);
      expect(noCss.length).toBeGreaterThan(0);
      /* TODAS as camadas daquela ação têm que durar o mesmo. Uma sombra de
         900ms sob um corpo de 700ms deixa a sombra se mexendo sozinha por
         200ms, com a bolha já parada — o efeito é de sombra descolada. */
      for (const d of noCss) expect(d).toBe(DURACAO_ACAO[acao]);
    });
  }
});

describe("ANTECIPAÇÃO — todo movimento começa para o lado contrário", () => {
  test("o pulo agacha antes de subir", () => {
    const q = quadros("bolhaPulo").map(([p, c]) => [p, transY(c)] as const);
    const antes = q.find(([p]) => p > 0 && p < 20);
    const apice = q.find(([p]) => p >= 40 && p <= 50);
    expect(antes?.[1]).toBeGreaterThan(0); // desce (agacha)
    expect(apice?.[1]).toBeLessThan(0); // depois sobe
  });

  test("o corpo do pulo achata antes de esticar", () => {
    const q = quadros("bolhaPuloCorpo");
    const agacha = escala(q.find(([p]) => p > 0 && p < 20)![1])!;
    const impulso = escala(q.find(([p]) => p >= 20 && p < 35)![1])!;
    expect(agacha.y).toBeLessThan(1); // baixa
    expect(impulso.y).toBeGreaterThan(1); // depois alta
  });

  test("o negar recua antes de negar", () => {
    const q = quadros("bolhaNao").map(([p, c]) => [p, giro(c)] as const);
    const primeiro = q.find(([p]) => p > 0 && p < 20)!;
    const segundo = q.find(([p]) => p >= 20 && p < 40)!;
    expect(Math.sign(primeiro[1]!)).not.toBe(Math.sign(segundo[1]!));
    /* E o recuo é MENOR que a negativa: antecipação que rouba a cena deixa de
       ser preparação e vira o movimento principal. */
    expect(Math.abs(primeiro[1]!)).toBeLessThan(Math.abs(segundo[1]!));
  });

  test("o cutucão também prepara", () => {
    const q = quadros("bolhaAtencao").map(([p, c]) => [p, transY(c)] as const);
    expect(q.find(([p]) => p > 0 && p < 15)?.[1]).toBeGreaterThan(0);
  });
});

describe("VOLUME CONSTANTE — achatar alarga, esticar afina", () => {
  for (const nome of ["bolhaToque", "bolhaPuloCorpo"]) {
    test(nome, () => {
      for (const [p, corpo] of quadros(nome)) {
        const e = escala(corpo);
        if (!e || (e.x === 1 && e.y === 1)) continue;
        /* O produto x·y perto de 1 é o volume se conservando. Achatar nos dois
           eixos ao mesmo tempo leria como encolher, não como amassar. */
        expect(Math.abs(e.x * e.y - 1)).toBeLessThan(0.06);
        expect(Math.sign(e.x - 1)).not.toBe(Math.sign(e.y - 1));
        expect(p).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

describe("AMORTECIMENTO — cada oscilação menor que a anterior", () => {
  test("o toque assenta em quiques decrescentes", () => {
    const desvios = quadros("bolhaToque")
      .map(([, c]) => escala(c))
      .filter(Boolean)
      .map((e) => Math.abs(e!.y - 1))
      .filter((d) => d > 0.001);
    expect(desvios.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < desvios.length; i++) expect(desvios[i]).toBeLessThan(desvios[i - 1]);
  });

  test("o negar perde amplitude a cada volta", () => {
    const graus = quadros("bolhaNao")
      .map(([, c]) => giro(c))
      .filter((g): g is number => g !== null && g !== 0)
      .slice(1) // o primeiro é a antecipação, que é pequena de propósito
      .map(Math.abs);
    for (let i = 1; i < graus.length; i++) expect(graus[i]).toBeLessThan(graus[i - 1]);
  });

  test("o pulo assenta em dois quiques cada vez menores", () => {
    const alturas = quadros("bolhaPulo")
      .filter(([p]) => p > 68)
      .map(([, c]) => transY(c))
      .filter((v): v is number => v !== null && v < 0)
      .map(Math.abs);
    expect(alturas.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < alturas.length; i++) expect(alturas[i]).toBeLessThan(alturas[i - 1]);
  });
});

describe("PESO — a sombra responde à altura, sempre ao contrário", () => {
  test("no ápice do pulo a sombra quase some", () => {
    const s = quadros("bolhaPuloSombra").find(([p]) => p >= 40 && p <= 50)![1];
    expect(Number(s.match(/opacity:\s*([\d.]+)/)![1])).toBeLessThan(0.4);
  });

  test("no impacto ela espalha e escurece", () => {
    const s = quadros("bolhaPuloSombra").find(([p]) => p >= 65 && p <= 75)![1];
    expect(Number(s.match(/scale\(([\d.]+)/)![1])).toBeGreaterThan(1.1);
    expect(Number(s.match(/opacity:\s*([\d.]+)/)![1])).toBeGreaterThan(0.9);
  });

  test("toda ação que translada tem sombra própria", () => {
    /* Uma ação que move a bolha sem mexer na sombra deixa o objeto deslizando
       sobre uma mancha fixa — o defeito que faz tudo parecer adesivo. */
    for (const nome of ["bolhaPulo", "bolhaAtencao", "bolhaChega", "bolhaToque"]) {
      expect(() => quadros(`${nome}Sombra`)).not.toThrow();
    }
  });
});

describe("OCIOSIDADE que não se repete", () => {
  test("os três períodos ambientes são incomensuráveis", () => {
    /* Se dois deles tivessem razão inteira, o par voltaria a coincidir logo e o
       olho acharia o laço. Décimos diferentes garantem que não. */
    const periodos = [...css.matchAll(/animation:\s*bolha(?:Sobe|Olha|Iris)\s+([\d.]+)s/g)].map(
      (m) => Number(m[1]),
    );
    expect(periodos.length).toBe(3);
    for (let i = 0; i < periodos.length; i++)
      for (let j = i + 1; j < periodos.length; j++) {
        const razao = periodos[j] / periodos[i];
        expect(Math.abs(razao - Math.round(razao))).toBeGreaterThan(0.05);
      }
  });
});

describe("MENOS MOVIMENTO desliga o ambiente e preserva a resposta", () => {
  const bloco = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));

  test("o que é ambiente some", () => {
    for (const alvo of ["bolha-flutua", "bolha-iris"]) expect(bloco).toContain(alvo);
  });

  test("o que responde a um gesto dela continua, com amplitude menor", () => {
    /* Sumir com a resposta ao toque faria a tela parecer travada — pior que o
       movimento para quem tem enxaqueca. Reduzir a amplitude resolve os dois. */
    expect(bloco).toContain("bolhaPuloSuave");
    expect(bloco).toContain("bolhaNaoSuave");
    const suave = quadros("bolhaPuloSuave")
      .map(([, c]) => transY(c))
      .filter((v): v is number => v !== null);
    const bravo = quadros("bolhaPulo")
      .map(([, c]) => transY(c))
      .filter((v): v is number => v !== null);
    expect(Math.abs(Math.min(...suave))).toBeLessThan(Math.abs(Math.min(...bravo)) / 3);
  });
});
