/**
 * "NÃO TEM NADA" E "NÃO CONSEGUI OLHAR" SÃO COISAS DIFERENTES.
 *
 * ─── A CLASSE DE DEFEITO ────────────────────────────────────────────────────
 *
 * `supabase-js` NUNCA lança: devolve `{ data, error }`. Uma auditoria contou 54
 * leituras neste produto que descartam o `error` — e todas produzem o mesmo
 * resultado: lista vazia, com cara de boa notícia.
 *
 * Num painel clínico isso não é um detalhe de UX. As duas frases levam o médico
 * a AÇÕES OPOSTAS:
 *
 *  · "Nada esperando por você" → ele fecha o painel. Se foi um timeout, pode
 *    haver uma pressão alterada esperando do outro lado.
 *  · "Ninguém na fila de espera" → ele para de oferecer vaga. Do outro lado há
 *    gestantes esperando um horário que ele acha que ninguém quer.
 *
 * Este arquivo cobra os dois casos que foram fechados, e a razão de cada um.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const clinical = semComentarios("src/lib/clinical.functions.ts");
const admin = semComentarios("src/lib/admin.functions.ts");
const painel = semComentarios("src/routes/_authenticated/painel.tsx");

describe("1. o recorte de pacientes diz quando não conseguiu ler", () => {
  test("a leitura passou a olhar o `error`", () => {
    const i = clinical.indexOf("async function pacientesAtuaisComEstado");
    const corpo = clinical.slice(i, clinical.indexOf("async function pacientesAtuais(", i));
    expect(corpo).toContain("const { data, error }");
    expect(corpo).toContain("falhou: !!error");
  });

  test("mas o Map vazio continua sendo o comportamento SEGURO", () => {
    /**
     * A falha não pode virar "mostra tudo". Quem não sabe de quem é a paciente
     * não mostra nada de ninguém — falha fechando. O que muda é só a MENSAGEM.
     */
    const i = clinical.indexOf("async function pacientesAtuais(");
    const corpo = clinical.slice(i, i + 240);
    /* O COMPORTAMENTO, não a sintaxe: ele devolve o mapa e não faz nada de
       diferente quando `falhou` — quem precisa distinguir usa a outra função.
       Cobrar a linha exata matava até um mutante equivalente (a mesma coisa
       escrita em duas linhas), o que é sinal de teste preso à forma. */
    expect(corpo).toContain("pacientesAtuaisComEstado(doctorId)");
    expect(corpo).toContain(".mapa");
    expect(corpo).not.toContain("falhou");
  });

  test("e a fila clínica distingue vazio de falha", () => {
    /* Era `if (ids.length === 0) return vazio;` — os dois casos no mesmo
       `return`, e a tela afirmando que não há nada. */
    expect(clinical).toContain(
      "if (ids.length === 0) return falhou ? { ...vazio, incompleto: true } : vazio;",
    );
  });

  test("o painel de fato acende o aviso com esse campo", () => {
    /* Sem isto o servidor diria a verdade e a tela continuaria calada. */
    expect(painel).toContain("setFonteFalhou((f) => ({ ...f, eventos: r.incompleto }))");
  });
});

describe("2. a fila de espera não afirma vazio quando não leu", () => {
  test("o servidor devolve `ok: false` quando a leitura falha", () => {
    /* Ancorado na FUNÇÃO, não na tabela: o `const { data, error }` vem antes do
       `.from(...)` na mesma expressão, então cortar a partir do nome da tabela
       deixava a asserção olhando para depois do que ela queria ver. */
    const i = admin.indexOf("export const getDoctorWaitlist");
    const corpo = admin.slice(i, i + 1600);
    expect(corpo).toContain("const { data: rows, error }");
    expect(corpo).toContain("if (error) return { ok: false as const");
  });

  test("a tela mostra a faixa, e NÃO um zero", () => {
    /**
     * Mostrar "0" seria a mesma mentira com outro tipo: um número é uma
     * afirmação. O traço não afirma nada.
     */
    const i = painel.indexOf("function WaitlistSection");
    const bloco = painel.slice(i, i + 2600);
    expect(bloco).toContain("setFalhou(!res.ok)");
    expect(bloco).toContain('{falhou ? "—" : entries.length}');
    expect(bloco).toContain("Não consegui ler a fila de espera agora");
  });

  test("e a faixa diz o que NÃO concluir", () => {
    /* "Erro ao carregar" faria o médico atualizar e seguir. A frase precisa
       impedir a conclusão errada, que é o dano real. */
    expect(painel).toContain("não</strong> quer dizer que ela");
  });
});
