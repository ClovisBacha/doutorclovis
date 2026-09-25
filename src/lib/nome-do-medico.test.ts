/**
 * O NOME DO MÉDICO — os dois erros simétricos que esta régua existe para matar.
 *
 * Os dois aconteceram no MESMO recurso (o aviso de presente), no mesmo dia:
 *
 *   · a tela montava `Dr(a). ${display_name}` → "Dr(a). Dr. Clóvis Bacha";
 *   · o push pegava `split(" ")[0]` para encurtar → "Dr. te mandou um presente".
 *
 * A causa dos dois é a mesma: `doctors.display_name` é campo LIVRE e quase todo
 * mundo escreve o título dentro dele. Quem não souber disso erra para um lado
 * ou para o outro, e nenhum dos dois erros dá exceção — só chega esquisito na
 * paciente.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { inicialDoMedico, nomeDoMedico } from "./nome-do-medico";
import { semComentarios } from "./sem-comentarios";

/** Todo `.ts`/`.tsx` de produção do app. */
function arquivosDoApp(dir = "src", out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) arquivosDoApp(p, out);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

describe("título dentro do display_name", () => {
  test("não duplica o título", () => {
    expect(nomeDoMedico("Dr. Clóvis Bacha")).toBe("Dr. Clóvis");
  });

  test("nem devolve o título sozinho", () => {
    /* `split(" ")[0]` devolveria "Dr.". Um título pelado no lugar do nome é
       pior que nome nenhum: parece bug, não parece formalidade. */
    expect(nomeDoMedico("Dr. Clóvis Bacha")).not.toBe("Dr.");
    expect(nomeDoMedico("Dr.")).toBeNull();
    expect(nomeDoMedico("Dra")).toBeNull();
  });

  test("médica é atendida pela mesma régua", () => {
    expect(nomeDoMedico("Dra. Ana Paula Ribeiro")).toBe("Dra. Ana");
    expect(nomeDoMedico("Drª Beatriz Lima")).toBe("Drª Beatriz");
    expect(nomeDoMedico("dra. ana")).toBe("dra. ana");
  });
});

describe("cadastro sem título", () => {
  test("fica só o primeiro nome", () => {
    expect(nomeDoMedico("Clóvis Bacha")).toBe("Clóvis");
    expect(nomeDoMedico("Ana Paula Ribeiro")).toBe("Ana");
  });

  test("um nome só continua valendo", () => {
    expect(nomeDoMedico("Clóvis")).toBe("Clóvis");
  });
});

describe("vazio devolve null, e não uma frase", () => {
  test("nulo, indefinido e espaço em branco", () => {
    /* O fallback é de quem chama: "O seu médico" no aviso do presente e
       "Assistente IA" no cabeçalho do chat são telas diferentes, e nenhuma das
       duas frases cabe dentro desta função. */
    for (const v of [null, undefined, "", "   ", "\n\t"]) {
      expect(nomeDoMedico(v)).toBeNull();
    }
  });
});

describe("espaçamento torto do cadastro não vaza", () => {
  test("espaços extras e quebras somem", () => {
    expect(nomeDoMedico("  Dr.   Clóvis   Bacha  ")).toBe("Dr. Clóvis");
  });
});

describe("⚠️ a INICIAL do círculo, e o 'a' minúsculo que ela conserta", () => {
  test("uma obstetra não vira 'a'", () => {
    /* O defeito: cinco telas usavam a alternância `(Dr|Dra)` como prefixo, que
       é resolvida da esquerda para a direita — "Dra. Marina" perdia só o "Dr",
       sobrava "a. Marina", e o círculo desenhava um "a" minúsculo no lugar do
       nome dela. Quem viu foi a foto da bancada da home. */
    expect(inicialDoMedico("Dra. Marina Costa")).toBe("M");
    expect(inicialDoMedico("Dra Marina Costa")).toBe("M");
    expect(inicialDoMedico("DRA. MARINA")).toBe("M");
    expect(inicialDoMedico("Drª. Marina")).toBe("M");
  });

  test("o título masculino continua saindo", () => {
    expect(inicialDoMedico("Dr. Clóvis Bacha")).toBe("C");
    expect(inicialDoMedico("Dr Clóvis")).toBe("C");
  });

  test("⚠️ e ela não come nome de gente", () => {
    /* "Drauzio" não é título. Um prefixo solto o transformaria em "uzio". */
    expect(inicialDoMedico("Drauzio Varella")).toBe("D");
    expect(inicialDoMedico("Draco Silva")).toBe("D");
  });

  test("sempre MAIÚSCULA — duas das cinco cópias esqueciam o toUpperCase", () => {
    expect(inicialDoMedico("marina costa")).toBe("M");
  });

  test("só o vazio devolve interrogação", () => {
    for (const v of [null, undefined, "", "   "]) expect(inicialDoMedico(v)).toBe("?");
    /* Um "Dra." pelado ainda é melhor que um ponto de interrogação no rosto. */
    expect(inicialDoMedico("Dra.")).toBe("D");
  });
});

describe("⚠️ catraca: nenhuma tela volta a tirar o título por conta própria", () => {
  test("a alternância como PREFIXO não existe mais no app", () => {
    const culpados: string[] = [];
    for (const arq of arquivosDoApp()) {
      const codigo = semComentarios(readFileSync(arq, "utf8"));
      /* ⚠️ O que se proíbe é a forma DEFEITUOSA, e não a alternância em si.
         Com o espaço OBRIGATÓRIO (`\\s+`) a expressão acerta: "Dra." força o
         retrocesso, porque casar só "Dr" deixaria um "a" onde o espaço é
         exigido. Com o espaço OPCIONAL não há retrocesso — ela para em "Dr" e
         devolve "a. Marina". É essa segunda que existia nas cinco telas.

         A primeira versão desta catraca acusava as duas e reprovava um arquivo
         CORRETO (`crm-conferencia`), que é como uma catraca vira ruído e alguém
         a desliga. */
      if (/\(\s*dr\s*\|\s*dra\s*\)[^/]*?\\s\*/i.test(codigo)) culpados.push(arq);
    }
    expect(culpados).toEqual([]);
  });

  test("⚠️ e a diferença entre as duas formas é MEDIDA, não afirmada", () => {
    /* Sem esta prova, a regex acima seria uma regra de texto que ninguém
       consegue conferir — e a distinção que ela codifica é justamente a que
       me fez acusar um arquivo correto. */
    const comEspacoOpcional = "Dra. Marina Costa".replace(/^(dr|dra)\.?\s*/i, "");
    expect(comEspacoOpcional).toBe("a. Marina Costa");

    const comEspacoObrigatorio = "Dra. Marina Costa".replace(/^(dr|dra)\.?\s+/i, "");
    expect(comEspacoObrigatorio).toBe("Marina Costa");

    /* E a régua da casa acerta os dois, mais o caso que nenhuma das duas pega. */
    expect(inicialDoMedico("Dra. Marina Costa")).toBe("M");
    expect(inicialDoMedico("Drauzio Varella")).toBe("D");
    expect("Drauzio Varella".replace(/^(dr|dra)\.?\s+/i, "")).toBe("Drauzio Varella");
  });
});
