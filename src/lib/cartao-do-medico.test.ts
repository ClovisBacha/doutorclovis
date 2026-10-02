import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cartaoDoMedico, podeAfirmarSemMedico } from "./cartao-do-medico";
import { semComentarios } from "./sem-comentarios";

/* ⚠️ O fonte SEM a prosa: este arquivo e os dois componentes CITAM as frases
   que proíbem, para explicar por quê — e um teste que casa a própria
   explicação fica verde exatamente quando o defeito está documentado. */
const SHELL = semComentarios(readFileSync("src/components/app-mobile-shell.tsx", "utf8"));
const SOS = semComentarios(readFileSync("src/components/emergency-sheet.tsx", "utf8"));
const SERVIDOR = semComentarios(readFileSync("src/lib/patientlink.functions.ts", "utf8"));

describe("a régua: o que a tela tem o direito de dizer", () => {
  test("só afirma 'sem médico' quando o servidor RESPONDEU que não há", () => {
    expect(podeAfirmarSemMedico(false, "respondeu")).toBe(true);
    /* Os dois casos em que a frase é falsa — e eram os dois em que ela saía. */
    expect(podeAfirmarSemMedico(false, "perguntando")).toBe(false);
    expect(podeAfirmarSemMedico(false, "ilegivel")).toBe(false);
  });

  test("cada desfecho tem uma tela própria", () => {
    expect(cartaoDoMedico(false, "perguntando")).toBe("carregando");
    expect(cartaoDoMedico(false, "ilegivel")).toBe("ilegivel");
    expect(cartaoDoMedico(false, "respondeu")).toBe("sem");
    expect(cartaoDoMedico(true, "respondeu")).toBe("com");
  });

  test("⚠️ ter o nome na mão JÁ É a resposta — nenhum estado apaga o médico da tela", () => {
    /* Apagar o nome por causa de um estado atrasado seria o pisca ao contrário:
       o cartão mostra a médica e a esconde um render depois. */
    for (const e of ["perguntando", "respondeu", "ilegivel"] as const) {
      expect(cartaoDoMedico(true, e)).toBe("com");
      expect(podeAfirmarSemMedico(true, e)).toBe(false);
    }
  });

  test("sem estado, vale o comportamento de hoje — e nunca o esqueleto eterno", () => {
    expect(cartaoDoMedico(false)).toBe("sem");
    expect(cartaoDoMedico(true)).toBe("com");
  });
});

describe("a corrente: quem decide o texto é a régua, nos DOIS", () => {
  /** O corpo de uma chamada, contando parênteses — `\([^)]*\)` para no primeiro
      `)` e deixa verde uma asserção que nunca chegou ao argumento. */
  function argumentosDe(fonte: string, nome: string): string | null {
    const i = fonte.indexOf(`${nome}(`);
    if (i < 0) return null;
    let nivel = 0;
    for (let j = i + nome.length; j < fonte.length; j++) {
      if (fonte[j] === "(") nivel++;
      else if (fonte[j] === ")" && --nivel === 0) return fonte.slice(i + nome.length + 1, j);
    }
    return null;
  }

  test("o cartão da home chama a régua, e passa o ESTADO", () => {
    const args = argumentosDe(SHELL, "cartaoDoMedico");
    expect(args).not.toBeNull();
    /* Chamar com o vínculo e esquecer o estado é o defeito de volta: a régua
       cairia no padrão "respondeu" e voltaria a afirmar. */
    expect(args!.includes("estadoDoMedico")).toBe(true);
  });

  test("a Central chama a MESMA régua", () => {
    expect(argumentosDe(SOS, "cartaoDoMedico")).not.toBeNull();
  });

  test("⚠️ o cartão não reintroduz a régua por conta própria", () => {
    /* A forma exata do defeito: decidir o texto por um booleano de vínculo. */
    expect(/const\s+semMedico\s*=\s*!medico/.test(SHELL)).toBe(false);
  });

  /** As props de UM elemento JSX, contando chaves até o `/>` dele.
   *
   * ⚠️ Procurar `estadoDoMedico={estadoDoMedico}` no arquivo inteiro fica VERDE
   * com a prop apagada da home, porque a Central recebe a MESMA — a armadilha
   * de "outra ocorrência do mesmo nome", que a mutação pegou. */
  function propsDe(fonte: string, tag: string): string | null {
    const i = fonte.indexOf(`<${tag}`);
    if (i < 0) return null;
    let nivel = 0;
    for (let j = i; j < fonte.length; j++) {
      if (fonte[j] === "{") nivel++;
      else if (fonte[j] === "}") nivel--;
      else if (nivel === 0 && fonte.startsWith("/>", j)) return fonte.slice(i, j);
    }
    return null;
  }

  test("a home RECEBE o estado de quem o conhece", () => {
    const conta = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
    const props = propsDe(conta, "AppHomeScreen");
    expect(props).not.toBeNull();
    expect(props!.includes("estadoDoMedico=")).toBe(true);
    /* E a Central também — as duas telas precisam concordar. */
    expect(/estadoDoMedico=\{estadoDoMedico\}/.test(conta)).toBe(true);
    /* E `medicoResolvido` continua existindo — a Central sempre o consumiu —,
       mas DERIVADO, para não haver dois estados que precisem concordar. */
    expect(/const\s+medicoResolvido\s*=\s*estadoDoMedico\s*!==/.test(conta)).toBe(true);
  });
});

describe("o servidor: falha não é 'ela não tem médico'", () => {
  test("⚠️ o catch devolve ok:false, e não o vazio de sucesso", () => {
    /* Até set/2026 ele devolvia `vazio` (ok: true) — e o app negava, para
       sempre e sem erro nenhum, o vínculo de que o SOS depende. */
    const i = SERVIDOR.indexOf("export const getMyDoctorContact");
    expect(i).toBeGreaterThan(0);
    const corpo = SERVIDOR.slice(i, SERVIDOR.indexOf("\nexport ", i + 10));
    const catchPos = corpo.lastIndexOf("} catch {");
    expect(catchPos).toBeGreaterThan(0);
    const dentro = corpo.slice(catchPos, catchPos + 220);
    expect(dentro.includes("ok: false")).toBe(true);
    expect(/return\s+vazio/.test(dentro)).toBe(false);
  });

  test("sessão que não resolve também não vira 'sem médico'", () => {
    const i = SERVIDOR.indexOf("export const getMyDoctorContact");
    const corpo = SERVIDOR.slice(i, SERVIDOR.indexOf("\nexport ", i + 10));
    const j = corpo.indexOf("if (!user)");
    expect(j).toBeGreaterThan(0);
    expect(corpo.slice(j, j + 120).includes("ok: false")).toBe(true);
  });

  test("os vazios LEGÍTIMOS continuam sendo sucesso", () => {
    const i = SERVIDOR.indexOf("export const getMyDoctorContact");
    const corpo = SERVIDOR.slice(i, SERVIDOR.indexOf("\nexport ", i + 10));
    /* "não tem doctor_id" e "o médico não preencheu o cadastro" são fatos
       sobre o cadastro dela, e continuam respondendo `vazio`. */
    expect(/if \(!prof\?\.doctor_id\) return vazio;/.test(corpo)).toBe(true);
    expect(/if \(!d\?\.display_name\) return vazio;/.test(corpo)).toBe(true);
  });
});
