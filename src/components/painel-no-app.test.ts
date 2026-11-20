/**
 * O resumo do médico no app é uma tela de TRIAGEM: ele olha, e decide se
 * precisa abrir o computador. Por isso o defeito mais caro aqui não é layout —
 * é um número que diz zero quando há alguém esperando. O médico acredita,
 * fecha o app, e a paciente segue esperando.
 *
 * Estes testes leem o componente e travam as duas regras que impedem isso.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "@/lib/sem-comentarios";

const fonte = readFileSync("src/components/painel-no-app.tsx", "utf8");

describe("o resumo não inventa zero", () => {
  /* ⚠️ ESTE BLOCO TRAVAVA A GRAFIA DE UM CAMPO MORTO, e as três asserções
     citavam `examesNovos` pelo nome. Ele foi declarado, lido em três lugares e
     passado por NINGUÉM desde que o envio de exame saiu do produto — então as
     três ficavam VERDES sobre um cartão que nunca era desenhado, e ficariam
     VERMELHAS sobre a remoção correta dele.

     A LIÇÃO continua valendo inteira e é o que se cobra agora: nenhum contador
     desta tela pode mostrar um número que o shell não carregou. O que mudou é
     que ela deixou de estar amarrada a um nome de campo. */

  /** Os campos declarados no tipo `ResumoDoDia`, com a marca de opcional. */
  function camposDoResumo(): { nome: string; opcional: boolean }[] {
    const i = fonte.indexOf("export type ResumoDoDia = {");
    expect(i).toBeGreaterThan(-1);
    const fim = fonte.indexOf("\n};", i);
    expect(fim).toBeGreaterThan(i);
    const corpo = semComentarios(fonte.slice(i, fim));
    return [...corpo.matchAll(/^ {2}(\w+)(\??):/gm)].map((m) => ({
      nome: m[1],
      opcional: m[2] === "?",
    }));
  }

  test("o tipo tem campos de verdade — a extração não passa em vazio", () => {
    const campos = camposDoResumo();
    expect(campos.length).toBeGreaterThanOrEqual(5);
    expect(campos.map((c) => c.nome)).toContain("sosAbertos");
  });

  /* A GARANTIA, e não a grafia: um contador só pode mostrar um número que o
     chamador foi OBRIGADO a passar. Campo opcional é um contador que pode
     nascer em zero sem ninguém ter olhado — e um zero falso nesta tela faz o
     médico fechar o app com alguém esperando. */
  test("todo contador lê um campo OBRIGATÓRIO, ou é gateado por !== undefined", () => {
    const opcionais = new Set(
      camposDoResumo()
        .filter((c) => c.opcional)
        .map((c) => c.nome),
    );
    const limpo = semComentarios(fonte);
    const lidos = [...limpo.matchAll(/n=\{resumo\.(\w+)\}/g)].map((m) => m[1]);
    /* Três contadores na grade hoje (perguntas, agendamentos, pré-consultas):
       o piso existe para a varredura não passar em VAZIO, e um `matchAll` que
       não casa nada deixaria o laço abaixo sem exercitar uma linha sequer. */
    expect(lidos.length).toBeGreaterThanOrEqual(3);
    for (const campo of lidos) {
      if (!opcionais.has(campo)) continue;
      expect(limpo).toContain(`resumo.${campo} !== undefined &&`);
    }
  });

  test('"nada esperando" soma TODOS os contadores desenhados', () => {
    const limpo = semComentarios(fonte);
    const lidos = new Set([...limpo.matchAll(/n=\{resumo\.(\w+)\}/g)].map((m) => m[1]));
    const i = limpo.indexOf("const nada =");
    expect(i).toBeGreaterThan(-1);
    const bloco = limpo.slice(i, limpo.indexOf(";", i));
    /* Um contador fora desta soma faz a tela dizer "nada esperando" com ele
       aceso logo abaixo — a contradição na mesma tela. */
    for (const campo of lidos) expect(bloco).toContain(`resumo.${campo}`);
  });
});

describe("a ordem de urgência", () => {
  test("o SOS vem antes da teleconsulta, e a teleconsulta antes dos contadores", () => {
    const sos = fonte.indexOf("resumo.sosAbertos > 0");
    const tele = fonte.indexOf("resumo.salasAbertas > 0");
    const grade = fonte.indexOf("grid grid-cols-2");
    expect(sos).toBeGreaterThan(0);
    expect(sos).toBeLessThan(tele);
    expect(tele).toBeLessThan(grade);
  });

  test("o SOS entra na conta do 'nada esperando'", () => {
    /* Se ficasse de fora, a tela diria "nada esperando por você" com um SOS
       aberto logo acima. */
    expect(fonte).toContain("resumo.sosAbertos === 0 &&");
  });
});

describe("as duas explicações que o Clóvis pediu ficam PARADAS na tela", () => {
  test("o plano no site não é toast — é bloco fixo", () => {
    expect(fonte).toContain("O plano se contrata no site");
    /* E o texto vem da regra única, não escrito à mão aqui. */
    expect(fonte).toContain("veredito.texto");
    expect(fonte).toContain('podeComprarAqui("plano_medico"');
  });

  test("diz que é a mesma conta do computador", () => {
    expect(fonte).toContain("É a mesma conta:");
  });

  test("não esconde as outras abas — só diz onde o trabalho a fundo se faz", () => {
    expect(fonte).toContain("continuam todos aqui");
  });
});
