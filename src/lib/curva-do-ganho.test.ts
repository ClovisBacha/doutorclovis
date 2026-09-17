import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { conviteDaCurva, faltaParaACurva } from "@/lib/curva-do-ganho";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * ⚠️ ESTE ARQUIVO EXISTE POR UM ESTADO SEM SAÍDA, e ele era alcançável:
 * altura e peso pré-gestacional são campos INDEPENDENTES e opcionais do Perfil.
 * A curva exigia os dois (mais um peso registrado) e o convite que explica como
 * destravá-la era gateado só pelo peso pré-gestacional — então quem preenchia
 * só o peso não via NEM a curva NEM o convite. Nada desenhado, nada dizendo por
 * quê.
 */

const tab = semComentarios(readFileSync("src/components/health-tab.tsx", "utf8"));

const CHEIO = { alturaCm: 165, pesoPreKg: 62, registrosDePeso: 4 };

describe("faltaParaACurva", () => {
  test("com tudo, não falta nada — e é isso que libera a curva", () => {
    expect(faltaParaACurva(CHEIO)).toBeNull();
  });

  test("o estado SEM SAÍDA: peso pré-gestacional sim, altura não", () => {
    expect(faltaParaACurva({ ...CHEIO, alturaCm: null })).toBe("altura");
  });

  test("o inverso", () => {
    expect(faltaParaACurva({ ...CHEIO, pesoPreKg: null })).toBe("peso-pre");
  });

  test("nenhum dos dois", () => {
    expect(faltaParaACurva({ ...CHEIO, alturaCm: null, pesoPreKg: null })).toBe("os-dois");
  });

  test("os dois preenchidos e nenhum peso lançado", () => {
    expect(faltaParaACurva({ ...CHEIO, registrosDePeso: 0 })).toBe("registro-de-peso");
  });

  /* Zero e NaN não são "preenchido": `0` é falsy e passaria por um `!= null`
     ingênuo, e uma altura zero faria o IMC estourar. */
  test("zero e valor não-finito contam como ausente", () => {
    expect(faltaParaACurva({ ...CHEIO, alturaCm: 0 })).toBe("altura");
    expect(faltaParaACurva({ ...CHEIO, pesoPreKg: Number.NaN })).toBe("peso-pre");
  });
});

describe("o convite", () => {
  test("nomeia o que falta, e não pede o que ela já preencheu", () => {
    expect(conviteDaCurva("altura").texto).toContain("altura");
    expect(conviteDaCurva("altura").texto).toContain("já preencheu");
    expect(conviteDaCurva("peso-pre").texto).toContain("já preencheu");
    /* Faltando os dois não há nada a creditar a ela. */
    expect(conviteDaCurva("os-dois").texto).not.toContain("já preencheu");
  });

  /* ⚠️ O caso do peso não registrado NÃO manda ao Perfil: o formulário está
     logo abaixo, na mesma tela. Um alvo que leva ao lugar errado é pior que
     nenhum. */
  test("só há ação no Perfil quando o que falta MORA no Perfil", () => {
    for (const f of ["os-dois", "altura", "peso-pre"] as const) {
      expect(conviteDaCurva(f).acao).toBeTruthy();
    }
    expect(conviteDaCurva("registro-de-peso").acao).toBeNull();
  });
});

describe("a tela deriva as DUAS metades da mesma régua", () => {
  /* Era aqui que elas divergiam: `showIomChart` olhava três coisas e o convite
     olhava uma. Enquanto as duas saírem de `faltaParaACurva`, não há como uma
     mudar sem a outra. */
  /* ⚠️ ESTE TESTE JÁ TRAVOU A GRAFIA UMA VEZ — escrito com a linha inteira
     literal, ele reprovou o portão de pós-parto (`!jaPariu`), que só APERTA a
     garantia. Hoje cobra o que importa: a decisão SAI da régua e carrega o
     portão de luto; quantos termos a mais existam é problema de quem os põe. */
  test("`showIomChart` sai de faltaParaACurva e carrega o Modo Cuidado", () => {
    const linha = tab.match(/const showIomChart = [^;]+;/)?.[0] ?? "";
    expect(linha).toContain("faltaNaCurva === null");
    expect(linha).toContain("!careMode");
  });

  test("o convite sai da MESMA variável, e não de um campo solto", () => {
    const i = tab.indexOf("const showIomChart");
    expect(i).toBeGreaterThan(-1);
    const depois = tab.slice(i);
    expect(depois).toContain("faltaNaCurva != null");
    /* A condição antiga, que cobria UM dos três casos. */
    expect(depois).not.toContain("prePregW == null && (");
  });

  /* ⚠️ A CURVA É GESTACIONAL E PARAVA DE VALER SEM PARAR DE SER DESENHADA.
     `computeGestation` conta para sempre (teto em 42s), então os pesos do
     PUERPÉRIO seguiam plotados contra o corredor do IOM — e o peso cai depois
     do parto, de modo que a tela mostrava a puérpera "abaixo da faixa
     recomendada" sobre uma faixa que não descreve mais o corpo dela. */
  test("depois do parto a curva não é desenhada", () => {
    const linha = tab.match(/const showIomChart = [^;]+;/)?.[0] ?? "";
    expect(linha).toContain("!jaPariu");
    expect(tab).toContain("const jaPariu = !!profile?.birth_date;");
  });

  test("e o convite também some — não se oferece destravar o que não se aplica", () => {
    const i = tab.indexOf("faltaNaCurva != null");
    expect(i).toBeGreaterThan(-1);
    expect(tab.slice(Math.max(0, i - 220), i)).toContain("!jaPariu");
  });

  /* A OUTRA METADE, e é a que impede alguém de "consertar" o pós-parto ao custo
     da paciente: o Modo Cuidado e o parto barram a CURVA, nunca a medição do
     corpo dela — hipertensão de puerpério existe. */
  test("peso, pressão, glicemia e a lista NÃO dependem de jaPariu", () => {
    for (const ancora of ["Último peso", "Histórico de pressão arterial", "Novo registro"]) {
      const i = tab.indexOf(ancora);
      expect(i).toBeGreaterThan(-1);
      expect(tab.slice(Math.max(0, i - 200), i)).not.toContain("jaPariu");
    }
  });

  test("o Modo Cuidado barra os DOIS — a curva e o convite", () => {
    expect(tab).toMatch(/const showIomChart = !careMode/);
    const i = tab.indexOf("faltaNaCurva != null");
    expect(tab.slice(Math.max(0, i - 200), i)).toContain("!careMode");
  });

  /* ⚠️ A frase saiu porque era FALSA: a legenda só é desenhada quando a curva
     existe, ou seja quando altura e peso já estão preenchidos. Ela mandava
     configurar o que já estava configurado. */
  test("a legenda da curva não manda configurar o que já está configurado", () => {
    const i = tab.indexOf("Linha sólida = seu peso");
    expect(i).toBeGreaterThan(-1);
    expect(tab.slice(i, i + 300)).not.toContain("Configure");
  });
});

describe("o IMC vem da régua única, e a medida implausível não some em silêncio", () => {
  /**
   * ⚠️ **A TELA CALCULAVA O IMC À MÃO, E JÁ DIVERGIA.** `curva-de-ganho.ts`
   * exporta `imcPreGestacional` e `faixaDoImc` e afirma por escrito que a régua
   * mora lá "porque já são dois leitores". A cópia inline escrevia "peso
   * normal" e "abaixo do peso" onde a régua diz "peso adequado" e "baixo peso":
   * a mesma mulher lia dois nomes para a mesma faixa em duas telas do mesmo
   * app. E a cópia não tinha as GUARDAS de plausibilidade.
   */
  test("altura implausível não vira curva — vira convite que EXPLICA", () => {
    const f = faltaParaACurva({ alturaCm: 17, pesoPreKg: 62, registrosDePeso: 5 });
    expect(f).toBe("medida-implausivel");
    const c = conviteDaCurva(f!);
    expect(c.texto).toContain("não parecem certos");
    expect(c.acao).toBeTruthy();
  });

  test("peso implausível também", () => {
    expect(faltaParaACurva({ alturaCm: 165, pesoPreKg: 12, registrosDePeso: 5 })).toBe(
      "medida-implausivel",
    );
  });

  test("a medida boa continua passando", () => {
    expect(faltaParaACurva({ alturaCm: 165, pesoPreKg: 62, registrosDePeso: 5 })).toBe(null);
  });

  test("⚠️ a tela não redefine o IMC nem os rótulos de faixa", () => {
    /* A asserção que faltava: o nome do teste vizinho afirmava "uma régua só"
       sobre uma checagem que conferia um terço dela. */
    const tela = semComentarios(readFileSync("src/components/health-tab.tsx", "utf8"));
    expect(tela).toContain("imcPreGestacional(");
    expect(tela).toContain("faixaDoImc(");
    /* Nenhuma segunda conta de IMC, e nenhum rótulo de faixa escrito à mão. */
    expect(tela).not.toMatch(/heightM \* heightM/);
    expect(tela).not.toContain('"peso normal"');
    expect(tela).not.toContain('"abaixo do peso"');
  });
});
