/**
 * A TELA QUE MEDE UM SINTOMA VERMELHO ANUNCIAVA A RÉGUA E NÃO A APLICAVA.
 *
 * ⚠️ Redução de movimentos fetais é um dos NOVE sintomas VERMELHOS de
 * `triage.ts` — o app inteiro trata isso como motivo de procurar atendimento.
 * O contador de chutes escreve, com todas as letras, "o ideal é sentir 10 em
 * até 2 horas"; conta até dez; e quando as duas horas passavam com quatro
 * movimentos o cronômetro simplesmente seguia correndo. A paciente lia
 * "4 / 10 chutes" e "02:15:00", e o app não dizia uma palavra sobre o que
 * aquilo quer dizer nem sobre o que fazer.
 *
 * ⚠️ E a comparação que dói é com a tela IRMÃ: o cronômetro de contrações, que
 * mede o outro sintoma vermelho desta aba, tem o botão do 192 desde sempre — e
 * este repositório já gastou uma noite garantindo que uma falha de rede não o
 * apague. A contagem de chutes não tinha caminho de socorro nenhum.
 *
 * ⚠️ **O CORTE NÃO É INVENTADO:** é o que a própria tela já anunciava, e é o
 * método de contagem até dez ensinado no pré-natal. A régua nova não cria
 * critério — ela põe num lugar só o critério que estava escrito na interface e
 * em nenhuma decisão. E ela mora em `sinais-clinicos.ts` porque o CLAUDE.md
 * proíbe duplicar limite clínico fora dela.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sinalMovimentosReduzidos } from "@/lib/sinais-clinicos";
import { RED_SYMPTOMS } from "@/lib/triage";

/** ⚠️ A prosa acima cita o que ela cobra — sai antes da busca. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

function corpoDaTela() {
  const i = CONTA.indexOf("function KicksTab(");
  expect(i).toBeGreaterThan(-1);
  const j = CONTA.indexOf("\nfunction ", i + 1);
  expect(j).toBeGreaterThan(i);
  return CONTA.slice(i, j);
}

describe("⚠️ a régua dos movimentos, exercitada", () => {
  test("duas horas com menos de dez movimentos é GRAVE", () => {
    const s = sinalMovimentosReduzidos({ semanas: 32, movimentos: 4, minutos: 120 });
    expect(s?.gravidade).toBe("grave");
    expect(s?.nota).toContain("Ligue para o seu médico");
  });

  test("dez movimentos não é sinal nenhum, mesmo passadas as duas horas", () => {
    /* ⚠️ O relógio aqui é 130, e não 118, DE PROPÓSITO: com 118 quem devolve
       `null` é o corte das duas horas, e a asserção passaria com o teste dos
       dez movimentos APAGADO. A mutação pegou exatamente isso — um caso que
       prova pelo guarda errado é um caso que não prova nada. */
    expect(sinalMovimentosReduzidos({ semanas: 32, movimentos: 10, minutos: 130 })).toBeNull();
    expect(sinalMovimentosReduzidos({ semanas: 32, movimentos: 14, minutos: 200 })).toBeNull();
  });

  test("antes de duas horas ela não alarma", () => {
    /* Alarmar antes do critério que a própria tela anuncia ensina a ignorar o
       alarme — e é a tela que a paciente abre quando já está preocupada. */
    expect(sinalMovimentosReduzidos({ semanas: 32, movimentos: 3, minutos: 90 })).toBeNull();
  });

  test("⚠️ antes da 28ª semana ela cala", () => {
    /* A contagem formal começa na 28ª, e o texto da tela diz isso. */
    expect(sinalMovimentosReduzidos({ semanas: 24, movimentos: 2, minutos: 150 })).toBeNull();
  });

  test("sem semana, sem contagem ou sem relógio, ela cala", () => {
    expect(sinalMovimentosReduzidos({ semanas: null, movimentos: 2, minutos: 150 })).toBeNull();
    expect(sinalMovimentosReduzidos({ semanas: 32, movimentos: null, minutos: 150 })).toBeNull();
    expect(sinalMovimentosReduzidos({ semanas: 32, movimentos: 2, minutos: null })).toBeNull();
    expect(
      sinalMovimentosReduzidos({ semanas: Number.NaN, movimentos: 2, minutos: 150 }),
    ).toBeNull();
  });

  test("o texto conta o que ELA viu, no singular e no plural", () => {
    expect(sinalMovimentosReduzidos({ semanas: 30, movimentos: 1, minutos: 130 })?.nota).toContain(
      "1 movimento em 2 horas",
    );
    expect(sinalMovimentosReduzidos({ semanas: 30, movimentos: 5, minutos: 130 })?.nota).toContain(
      "5 movimentos em 2 horas",
    );
  });
});

describe("⚠️ e a tela oferece o caminho, e não só o número", () => {
  test("ela usa a régua compartilhada, e não uma cópia local", () => {
    const c = corpoDaTela();
    expect(c).toContain("sinalMovimentosReduzidos(");
    /* Os três argumentos saem do estado real da sessão. */
    expect(c).toMatch(/semanas: weeks/);
    expect(c).toMatch(/movimentos: count/);
    expect(c).toMatch(/minutos: elapsed \/ 60000/);
    /* ⚠️ E nenhum limite clínico é reescrito aqui — nem o 10, nem as 2 horas. */
    expect(c).not.toMatch(/elapsed\s*[><]=?\s*7200000/);
    expect(c).not.toMatch(/minutos\s*[><]=?\s*120/);
  });

  test("⚠️ o 192 está na tela quando o sinal dispara", () => {
    const c = corpoDaTela();
    const i = c.indexOf("movimentosReduzidos && (");
    expect(i).toBeGreaterThan(-1);
    const bloco = c.slice(i, i + 1600);
    expect(bloco).toContain('href="tel:192"');
    /* E o caminho do médico dela, que é o primeiro a ser chamado. */
    expect(bloco).toContain('onNavigate?.("Consultas")');
    /* A frase é a da RÉGUA, e não um texto próprio que um dia diverge. */
    expect(bloco).toContain("{movimentosReduzidos.nota}");
  });

  test("⚠️ e a redução de movimentos continua sendo sintoma VERMELHO na triagem", () => {
    /* O vínculo que dá sentido a tudo acima: se um dia isto sair de
       `RED_SYMPTOMS`, a régua desta tela precisa ser reavaliada junto. */
    const texto = JSON.stringify(RED_SYMPTOMS).toLowerCase();
    expect(texto).toMatch(/movimento/);
  });
});
