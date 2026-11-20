/**
 * ⚠️ A CLASSE MAIS REPETIDA DESTE REPOSITÓRIO: o app AFIRMA um fato que não
 * conferiu, e a paciente age sobre ele.
 *
 * A régua de triagem, que já separou dezenas de candidatos:
 *
 *   **"Se esta leitura voltar vazia, o app afirma alguma coisa que ela não tem
 *   como saber que é falsa, e que muda o que ela faz a seguir?"**
 *
 * Este arquivo cobre os dois casos de set/2026 que não couberam em régua pura —
 * a decisão mora dentro de um componente, e o que se pode exercitar é a
 * CORRENTE. Os testes leem o fonte sem os comentários (a prosa cita as frases
 * proibidas para explicá-las, e um teste que casa a própria explicação fica
 * verde exatamente quando o defeito está documentado).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "./sem-comentarios";

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
const BEBE = semComentarios(readFileSync("src/components/baby-tab.tsx", "utf8"));

/** O corpo de uma função/handler, contando chaves a partir de uma âncora. */
function corpoApos(fonte: string, ancora: string, limite = 2600): string {
  const i = fonte.indexOf(ancora);
  if (i < 0) return "";
  return fonte.slice(i, i + limite);
}

describe("o botão que tira a paciente do beco de médico", () => {
  /* ⚠️ Ele é a ÚNICA saída de um beco sem volta: quem tocou em "Criar conta
     grátis" na página de médicos por curiosidade fica com a marca `role` e é
     barrada dos DOIS lados. Mentir ali a deixa presa sem ter o que apontar. */
  const trecho = corpoApos(CONTA, "Não sou médico(a)");

  test("⚠️ lê o erro do updateUser — ele NÃO lança", () => {
    /* `supabase.auth.updateUser` devolve `{ error }` numa resposta normal: o
       `catch` em volta só pega falha de transporte. Descartando o retorno, a
       tela dizia "Pronto" e recarregava para a MESMA tela de bloqueio. */
    const antes = CONTA.slice(0, CONTA.indexOf("Não sou médico(a)"));
    const i = antes.lastIndexOf("updateUser({ data: { role: null } })");
    expect(i).toBeGreaterThan(0);
    const bloco = antes.slice(i - 220, i + 320);
    expect(/const \{ error \} = await supabase\.auth\.updateUser/.test(bloco)).toBe(true);
    expect(/if \(error\)/.test(bloco)).toBe(true);
  });

  test("e não diz 'Pronto' antes de conferir", () => {
    const antes = CONTA.slice(0, CONTA.indexOf("Não sou médico(a)"));
    const iErro = antes.lastIndexOf("if (error)");
    const iPronto = antes.lastIndexOf("Pronto — abrindo o app da gestante");
    expect(iErro).toBeGreaterThan(0);
    expect(iPronto).toBeGreaterThan(iErro);
  });

  test("o trecho existe — a âncora não caiu em vazio", () => {
    expect(trecho.length).toBeGreaterThan(40);
  });
});

describe("o resumo da semana da aba Bebê", () => {
  test("⚠️ distingue 'não consegui ler' de 'ela não registrou'", () => {
    /* Com `data ?? []` sobre um erro descartado, a seção afirmava "Você ainda
       não registrou seu humor esta semana" para quem registrou todos os dias —
       e ela registrava de novo. */
    const i = BEBE.indexOf('.from("journal_entries")');
    expect(i).toBeGreaterThan(0);
    const leitura = BEBE.slice(i - 260, i + 420);
    expect(/const \{ data, error \}/.test(leitura)).toBe(true);
    expect(/if \(error\) setInstavel\(true\)/.test(leitura)).toBe(true);
  });

  test("a tela tem o ramo da falha, ANTES do vazio", () => {
    const iInstavel = BEBE.indexOf("instavel ? (");
    const iVazio = BEBE.indexOf("Você ainda não registrou seu humor");
    expect(iInstavel).toBeGreaterThan(0);
    expect(iVazio).toBeGreaterThan(iInstavel);
  });

  test("e o texto da falha não convida a registrar de novo", () => {
    const i = BEBE.indexOf("Não consegui carregar seus check-ins");
    expect(i).toBeGreaterThan(0);
    const frase = BEBE.slice(i, i + 200);
    expect(/check-in no topo|leva 1 toque/.test(frase)).toBe(false);
  });
});
