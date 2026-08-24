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
import { DURACAO_ACAO, humorDaJornada, type Acao } from "./bolha";

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
  for (const nome of ["bolhaToque", "bolhaPuloCorpo", "bolhaChega"]) {
    test(nome, () => {
      for (const [p, corpo] of quadros(nome)) {
        const e = escala(corpo);
        /* A entrada em cena parte do nada — `scale(0.2, 0.2)` uniforme e
           chegada, nao deformacao. So os quadros ja "presentes" contam. */
        if (!e || (e.x === 1 && e.y === 1) || (e.x < 0.6 && e.y < 0.6)) continue;
        /* O produto x·y perto de 1 é o volume se conservando. Achatar nos dois
           eixos ao mesmo tempo leria como encolher, não como amassar. */
        expect(Math.abs(e.x * e.y - 1)).toBeLessThan(0.06);
        expect(Math.sign(e.x - 1)).not.toBe(Math.sign(e.y - 1));
        expect(p).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

/**
 * Razão entre oscilações consecutivas.
 *
 * "Cada uma menor que a anterior" é fraco demais: uma lista de números que
 * descem passa, e descer não é amortecer. Corpo perdendo energia tem
 * coeficiente de restituição FIXO, então a razão entre amplitudes consecutivas
 * é constante — decaimento exponencial. A auditoria mediu razões variando até
 * 7,5x e o olho lia "movimentos deliberados e depois um desligamento", não uma
 * coisa perdendo energia.
 */
function razoes(amplitudes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < amplitudes.length; i++) r.push(amplitudes[i] / amplitudes[i - 1]);
  return r;
}

/** Dispersão das razões: max/min. 1,0 é decaimento exponencial perfeito. */
function dispersao(rs: number[]): number {
  return Math.max(...rs) / Math.min(...rs);
}

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

/**
 * O bloco de `prefers-reduced-motion` QUE GOVERNA A BOLHA.
 *
 * Antes isto era `css.lastIndexOf(...)` — "o último do arquivo" — e funcionava
 * só enquanto a Bolha fosse a última coisa do styles.css. No dia em que outra
 * tela ganhou o próprio bloco de menos-movimento (os círculos guiados da
 * respiração e da meditação), os quatro testes daqui passaram a ler o bloco
 * errado e falharam sem que nada da Bolha tivesse mudado.
 * Ancorar na regra da própria Bolha é mais preciso, não mais frouxo.
 */
function blocoMenosMovimentoDaBolha(): string {
  let i = -1;
  for (const m of css.matchAll(/@media \(prefers-reduced-motion: reduce\)/g)) {
    const trecho = css.slice(m.index!, m.index! + 2000);
    if (trecho.includes("bolha-")) i = m.index!;
  }
  if (i < 0) throw new Error("nenhum bloco de prefers-reduced-motion menciona .bolha-");
  return css.slice(i);
}

describe("MENOS MOVIMENTO desliga o ambiente e preserva a resposta", () => {
  const bloco = blocoMenosMovimentoDaBolha();

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

describe("MODO CUIDADO — no luto, festa e cobranca somem", () => {
  /* O pior defeito possivel deste app: a paciente perdeu a gestacao, ligou o
     Modo Cuidado exatamente para nao levar tapa na cara, e ao terminar a
     respiracao uma bolha com cara de bebe pula de alegria. Aconteceu: o ponto
     de uso escrevia `{!careMode && <ConfettiBurst />}` numa linha e
     `<Bolha humor="comemorando" entrada="pulo" />` na linha seguinte. */

  test("nunca comemora", () => {
    expect(humorDaJornada({ comemorando: true, careMode: true })).not.toBe("comemorando");
  });

  test("nunca cobra — e agora nao ha COMO cobrar", () => {
    /* O humor `preocupada` saiu do app (ago/2026). O teste que sobrava aqui
       provava que ele nao aparecia no luto; este prova algo mais forte, que e
       o que passou a valer: a cara negativa nao existe mais em lugar nenhum,
       para nenhuma paciente.

       A checagem e no TIPO e no IMPORT, e nao na palavra solta: o arquivo
       explica em prosa por que ela saiu, e apagar essa explicacao para o teste
       passar seria trocar a memoria do projeto por um `grep` feliz. */
    const fonte = readFileSync(new URL("./bolha.tsx", import.meta.url), "utf8");
    expect(fonte).not.toMatch(/from "@\/assets\/bolha\/preocupada/);
    expect(fonte).not.toMatch(/export type Humor =[^;]*preocupada/);
    expect(fonte).not.toMatch(/const ARTE[^;]*preocupada/);
  });

  test("dormir continua — nao e festa, e companhia", () => {
    expect(humorDaJornada({ noite: true, diaFeito: true, careMode: true })).toBe("dormindo");
  });

  test("no luto a surpresa da madrugada tambem some", () => {
    /* "Olha quem apareceu!" as 3h da manha, para quem perdeu a gestacao, e o
       mesmo defeito de comemorar com o sinal trocado. */
    expect(humorDaJornada({ madrugada: true, careMode: true })).toBe("feliz");
    expect(humorDaJornada({ ritmoIncomum: true, careMode: true })).toBe("feliz");
  });

  test("sem Modo Cuidado nada muda", () => {
    expect(humorDaJornada({ comemorando: true })).toBe("comemorando");
    expect(humorDaJornada({ madrugada: true })).toBe("surpresa");
    expect(humorDaJornada({ ritmoIncomum: true })).toBe("surpresa");
  });

  test("a piscadinha do dia fechado ganha da surpresa", () => {
    /* Quem fechou o dia merece o reconhecimento, e nao o espanto: a surpresa e
       para o que ainda esta acontecendo. */
    expect(humorDaJornada({ diaFeito: true, ritmoIncomum: true })).toBe("orgulhosa");
    expect(humorDaJornada({ diaFeito: true, madrugada: true })).toBe("orgulhosa");
  });

  test("o portao mora no componente, nao no ponto de uso", () => {
    const fonte = readFileSync(new URL("./bolha.tsx", import.meta.url), "utf8");
    /* Confiar no chamador ja falhou uma vez. Estas linhas sao o backstop: as
       artes proibidas rebaixadas e o pulo engolido, dentro do componente.

       ⚠️ A lista virou `PROIBIDAS_NO_LUTO` quando `apaixonado` entrou nela: a
       arte de coracao nos olhos e usada com `humorFixo` na abertura de
       "Momento com o bebe", e `humorFixo` pula `humorDaJornada` — que e onde o
       portao de luto morava. Medido na bancada: com o luto ligado, a bolha
       aparecia apaixonada sobre "Pra voce, que eu ainda nao vi". */
    expect(fonte).toMatch(/PROIBIDAS_NO_LUTO/);
    expect(fonte).toMatch(/careMode && PROIBIDAS_NO_LUTO\.includes\(humor\)/);
    expect(fonte).toMatch(/careMode && qual === "pulo"/);
  });

  test("⚠️ as duas artes que nao podem aparecer no luto estao na lista", () => {
    /**
     * `comemorando` tem confete DESENHADO nela; `apaixonado` e coracao nos
     * olhos, e a unica tela que a usa e a do bebe. Nenhuma das duas tem versao
     * suavizada — nao e a animacao que ofende, e a imagem.
     */
    const fonte = readFileSync(new URL("./bolha.tsx", import.meta.url), "utf8");
    const i = fonte.indexOf("const PROIBIDAS_NO_LUTO");
    /* ⚠️ Ate o `];` do literal, e nao ate o primeiro `]`: a ANOTACAO de tipo
       (`readonly Humor[]`) vem antes do array e fechava a fatia num trecho
       vazio — o teste olhava a declaracao, nao o conteudo. */
    const lista = fonte.slice(i, fonte.indexOf("];", i));
    expect(lista).toContain('"comemorando"');
    expect(lista).toContain('"apaixonado"');
  });

  test("todo ponto de uso que pode comemorar passa careMode", () => {
    const jogo = readFileSync(new URL("./gestacao-path.tsx", import.meta.url), "utf8");
    for (const m of jogo.matchAll(/<Bolha[^>]*>/g)) {
      const tag = m[0];
      /* `humor="comemorando"` literal ou qualquer `entrada=`. O cabecalho usa
         `humorDaJornada`, que recebe `careMode` por dentro — outro caminho, e
         coberto pelos testes de cima. */
      if (/humor="comemorando"|entrada=/.test(tag)) expect(tag).toContain("careMode");
    }
  });
});

describe("MENOS MOVIMENTO nao pode virar SALTO", () => {
  /* `styles.css` tem uma regra universal que zera TODA transicao com
     `!important` sob prefers-reduced-motion. Estilo inline nao vence
     `!important` de folha, entao a escala da respiracao acontecia por inteiro
     num quadro so: 27px de corte seco numa bolha de 104, 15 vezes por sessao.
     Quem pediu menos movimento recebia o estimulo mais agressivo da tela.

     Medido no navegador depois do conserto: duracao 4s preservada e amplitude
     1,056 em vez de 1,16. */

  test("a duracao da respiracao e reafirmada com !important", () => {
    const bloco = css.match(
      /\.bolha-respira \.bolha-corpo,\n\.bolha-respira \.bolha-sombra \{[^}]*\}/,
    )!;
    expect(bloco[0]).toMatch(/transition-duration:\s*var\(--respiro-ms[^)]*\)\s*!important/);
  });

  test("a amplitude cai, mas nao some", () => {
    const reduce = blocoMenosMovimentoDaBolha();
    expect(reduce).toContain("--respiro-escala-suave");
    const fonte = readFileSync(new URL("./bolha.tsx", import.meta.url), "utf8");
    const fator = Number(
      fonte.match(/--respiro-escala-suave":\s*1 \+ \(escala - 1\) \* ([\d.]+)/)![1],
    );
    expect(fator).toBeGreaterThan(0.15); // some = exercicio sem guia visual
    expect(fator).toBeLessThan(0.5); // inteira = enjoo
  });
});

describe("AMORTECIMENTO é EXPONENCIAL, não só decrescente", () => {
  /* O limite de 1,25 de dispersão é folgado de propósito: os keyframes moram em
     porcentagens inteiras do tempo, então o arredondamento sozinho já move a
     razão. O que ele proíbe é o que estava lá — 0,173 seguido de 0,333, que é
     o primeiro quique perdendo energia demais e o segundo de menos. */
  test("o pulo quica com restituição fixa", () => {
    const alturas = quadros("bolhaPulo")
      .map(([, c]) => transY(c))
      .filter((v): v is number => v !== null && v < 0)
      .map(Math.abs);
    expect(alturas.length).toBeGreaterThanOrEqual(3);
    expect(dispersao(razoes(alturas))).toBeLessThan(1.25);
  });

  test("o negar perde energia a taxa constante", () => {
    const graus = quadros("bolhaNao")
      .map(([, c]) => giro(c))
      .filter((g): g is number => g !== null && g !== 0)
      .slice(1)
      .map(Math.abs);
    expect(graus.length).toBeGreaterThanOrEqual(3);
    expect(dispersao(razoes(graus))).toBeLessThan(1.25);
  });

  test("o toque assenta a taxa constante", () => {
    const desvios = quadros("bolhaToque")
      .map(([, c]) => escala(c))
      .filter(Boolean)
      .map((e) => Math.abs(e!.y - 1))
      .filter((d) => d > 0.001);
    expect(desvios.length).toBeGreaterThanOrEqual(3);
    expect(dispersao(razoes(desvios))).toBeLessThan(1.25);
  });
});

describe("ARCO — nenhum corpo salta em linha reta aprumado", () => {
  test("o pulo inclina, e a inclinação alterna de lado", () => {
    /* Tres das quatro acoes percorriam uma reta vertical perfeita com o corpo
       em 0,00° do primeiro ao ultimo quadro — o mais mecanico do conjunto. E a
       camada que gira ficava OCIOSA justo no pulo, porque o React tira o
       flutuar durante a acao. */
    const g = quadros("bolhaPuloGiro")
      .map(([, c]) => giro(c))
      .filter((v): v is number => v !== null);
    expect(Math.max(...g.map(Math.abs))).toBeGreaterThan(2);
    const sinais = g.filter((v) => v !== 0).map(Math.sign);
    expect(new Set(sinais).size).toBe(2); // inclina para os DOIS lados
  });
});

describe("SOBREPOSIÇÃO — vem dos extremos escalonados, não de atraso de fase", () => {
  test("a sombra de contato NÃO atrasa", () => {
    /* Eu tinha posto 45ms de `animation-delay` achando que era sobreposição.
       Sobreposição vale para apêndice com INÉRCIA — orelha, cauda, cabelo.
       Sombra de contato é projeção geométrica: não tem massa, não pode chegar
       depois. Os 45ms eram o chão informando por 2,7 quadros uma altura que o
       corpo já não tinha. */
    const bloco = css.match(/\.bolha-pulo \.bolha-sombra \{[^}]*\}/)![0];
    expect(bloco).not.toContain("animation-delay");
  });

  test("os extremos das camadas do pulo caem em quadros diferentes", () => {
    /* A sobreposição real: rotação, translação, escala e sombra atingem seus
       picos em porcentagens distintas do mesmo intervalo. */
    const pico = (nome: string, ler: (c: string) => number | null) => {
      const q = quadros(nome)
        .map(([p, c]) => [p, ler(c)] as const)
        .filter(([, v]) => v !== null && v !== 0);
      return q.reduce((a, b) => (Math.abs(b[1]!) > Math.abs(a[1]!) ? b : a))[0];
    };
    const picos = [
      pico("bolhaPuloGiro", giro),
      pico("bolhaPulo", transY),
      pico("bolhaPuloCorpo", (c) => {
        const e = escala(c);
        return e ? e.y - 1 : null;
      }),
    ];
    expect(new Set(picos).size).toBe(picos.length); // nenhum coincide
  });
});

describe("MENOS MOVIMENTO nao pode deixar a acao INERTE", () => {
  test("as acoes reafirmam a duracao com !important", () => {
    /* A regra universal poe `animation-duration: 0.001ms !important`, que vence
       um `animation-name` sozinho. Medido antes do conserto: 1 quadro distinto
       em 300ms nas quatro acoes. Os keyframes suaves eram codigo morto e o
       comentario afirmava o contrario do que o navegador fazia. */
    const reduce = blocoMenosMovimentoDaBolha();
    const comDuracao = [...reduce.matchAll(/animation-duration:\s*\d+ms\s*!important/g)];
    expect(comDuracao.length).toBeGreaterThanOrEqual(3);
  });
});
