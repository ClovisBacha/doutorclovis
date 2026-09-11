import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import { semComentarios } from "@/lib/sem-comentarios";

/**
 * AS GARANTIAS DA ABA SAÚDE — set/2026.
 *
 * ⚠️ Cada bloco aqui cobre uma GARANTIA, nunca uma grafia. É a décima sétima
 * vez que este repositório registra o mesmo aprendizado: um teste que trava
 * COMO o código está escrito um dia reprova o conserto, e quem edita um teste
 * vermelho com pressa apaga a asserção em vez de entendê-la.
 *
 * ⚠️ E os comentários saem ANTES de qualquer busca — a prosa destes arquivos
 * cita justamente o que eles proíbem, e ela já quebrou teste de texto nos dois
 * sentidos nesta base.
 */

const saude = semComentarios(readFileSync("src/components/health-tab.tsx", "utf8"));
const hub = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
const grade = semComentarios(readFileSync("src/components/grade-hub.tsx", "utf8"));
const ciclo = semComentarios(readFileSync("src/components/ciclo-menstrual-tab.tsx", "utf8"));

/** O corpo de uma função, da assinatura até a próxima do mesmo nível. */
function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) throw new Error(`âncora não encontrada: ${assinatura}`);
  const resto = fonte.slice(i + assinatura.length);
  const fim = resto.search(/\n {2}(?:async )?function |\n}\n/);
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe("o apagar de um registro clínico", () => {
  /* ⚠️ O que havia era um `<button>` cujo único conteúdo era o glifo `×`:
     medido a 393px, 8×18 pixels, apagando peso/pressão/glicemia na hora. As
     duas abas irmãs resolveram isto com a linha que ABRE. */
  test("não é um glifo solto — o × sumiu", () => {
    expect(saude).not.toContain(">\n                ×\n              </button>");
    expect(saude).not.toContain('aria-label="Apagar este registro"');
  });

  test("mora atrás de um toque que ABRE a linha", () => {
    expect(saude).toMatch(/aria-expanded=\{aberta\}/);
    expect(saude).toMatch(/setAbertoId\(aberta \? null : l\.id\)/);
  });

  test("tem alvo de 44px e diz o que apagar", () => {
    const bloco = saude.slice(saude.indexOf("Apagar este registro"));
    expect(saude).toMatch(/min-h-11[^"]*"\s*>\s*Apagar este registro/);
    expect(bloco).toContain("Apague só o que não aconteceu");
  });

  /* Fechar a linha antes do banco confirmar diria "pronto" sobre uma exclusão
     que não aconteceu. */
  test("só fecha a linha depois de o banco confirmar", () => {
    const corpo = corpoDe(saude, "async function remove(id: string) {");
    const erro = corpo.indexOf("toast.error");
    const fecha = corpo.indexOf("setAbertoId(null)");
    expect(erro).toBeGreaterThan(-1);
    expect(fecha).toBeGreaterThan(erro);
  });
});

describe("o Modo Cuidado na tela de peso, pressão e glicemia", () => {
  test("a curva de ganho GESTACIONAL não é desenhada", () => {
    const linha = saude.match(/const showIomChart = [^;]+;/)?.[0] ?? "";
    expect(linha).toContain("!careMode");
  });

  test("o convite que existe só para destravá-la sai junto", () => {
    expect(saude).toMatch(/!careMode &&\s*\n?\s*prePregW == null/);
  });

  /* ⚠️ A OUTRA METADE, e ela é a que importa: o Modo Cuidado faz o app parar de
     FALAR DO BEBÊ, nunca de MEDIR a paciente. Um teste que só cobrisse o
     portão aprovaria alguém "consertando" o luto ao custo dos números dela. */
  test("peso, pressão, glicemia e a lista NÃO são gateados", () => {
    for (const ancora of [
      "Último peso",
      "Histórico de pressão arterial",
      "Histórico de glicemia",
      "Ver e corrigir meus registros",
      "Novo registro",
    ]) {
      const i = saude.indexOf(ancora);
      if (i < 0) throw new Error(`âncora não encontrada: ${ancora}`);
      /* nada de `careMode` nas duzentas posições anteriores à âncora */
      expect(saude.slice(Math.max(0, i - 200), i)).not.toContain("careMode");
    }
  });

  test("a tela recebe o portão de quem o governa", () => {
    expect(hub).toMatch(/<HealthTab[^>]*careMode=\{careMode\}/);
  });
});

describe("o número do bloco no hub da Saúde", () => {
  /* ⚠️ Contar só o servidor faz o bloco afirmar um número MENOR do que ela
     cronometrou, num dia de trabalho de parto — as duas abas guardam registro
     no aparelho desde set/2026. */
  test("mescla a fila local nas duas fontes", () => {
    expect(hub).toContain("lerFilaDeChutes(uid");
    expect(hub).toContain("lerFilaDeContracoes(uid");
    /* uma mescla para cada bloco */
    expect(hub.match(/mesclarRegistros\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  /* A fila guarda sete dias; somá-la inteira poria terça no contador de hoje. */
  test("recorta as pendentes pelo MESMO dia da consulta", () => {
    expect(hub).toMatch(
      /pendentesDeContracoes\.filter\(\(c\) => c\.started_at >= desdeMeiaNoite\)/,
    );
  });

  /* `getUser` seria uma quarta ida à REDE na frente de um número; `getSession`
     lê do disco e cabe na onda que já existe. */
  test("a sessão sai do disco e na mesma onda das consultas", () => {
    const bloco = hub.slice(
      hub.indexOf("const [saude, chutes, contr, sessao] = await Promise.all(["),
    );
    expect(bloco.slice(0, 2000)).toContain("supabase.auth.getSession()");
    expect(bloco.slice(0, 2000)).not.toContain("auth.getUser()");
  });
});

describe("a grade dos hubs", () => {
  /* Medido a 393px: com o subtítulo de uma linha, a arte (`flex-1`) devolvia
     16px e TUDO abaixo dela descia — rótulo em top=219 num bloco e 236 no
     vizinho da mesma linha. */
  test("reserva duas linhas ao subtítulo, em unidade de linha", () => {
    const sub = grade.slice(grade.indexOf("line-clamp-2 block min-h-"));
    expect(sub.slice(0, 200)).toContain("min-h-[2lh]");
  });
});

describe("o convite do ciclo", () => {
  /* ⚠️ Ele era inalcançável: a condição de fora exigia `mostraPrevisao`, que já
     exige `model != null` — e o ramo do `else` é justamente o de quem ainda não
     tem modelo. Medido nos três estados da bancada: não aparecia em nenhum. */
  test("não depende mais de mostraPrevisao", () => {
    expect(ciclo).not.toContain("!mostraPrevisao ? null :");
  });

  test("é barrado pela gestação, pelo histórico velho e pela FALHA de leitura", () => {
    const cond = ciclo.match(/\n\s*gestante \|\|[^?]*\?/)?.[0] ?? "";
    expect(cond).toContain("gestante");
    expect(cond).toContain("historicoVelho");
    /* sem isto, "Registre seu período abaixo" é dito a quem tem meses de
       histórico e só teve uma falha de rede — e a faixa de "não consegui ler"
       apareceria logo abaixo, contradizendo o convite */
    expect(cond).toContain("instavel");
  });
});
