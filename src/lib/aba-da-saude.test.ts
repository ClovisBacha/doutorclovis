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
const conta = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
/**
 * ⚠️ O HUB saiu de `minha-conta.tsx` para cá (set/2026): ele era `export
 * function` num arquivo de ROTA, e isso o içava para o pedaço de ENTRADA que
 * toda página do site baixa. Só o CAMINHO mudou; a garantia, nenhuma linha.
 */
const hub = semComentarios(readFileSync("src/components/hub-saude.tsx", "utf8"));
const grade = semComentarios(readFileSync("src/components/grade-hub.tsx", "utf8"));
const ciclo = semComentarios(readFileSync("src/components/ciclo-menstrual-tab.tsx", "utf8"));

/**
 * OS INTERVALOS DE TEXTO QUE UM TERMO GATEIA NO JSX.
 *
 * ⚠️ **ISTO SUBSTITUI UMA JANELA DE 200 CARACTERES, e a janela deixava passar
 * o pior mutante que este arquivo podia ter:** envolver a tela clínica INTEIRA
 * num `{!careMode && (…)}` e apagar peso, pressão, glicemia e a lista para quem
 * está em luto. A distância nunca é a garantia — o guarda de um bloco pode
 * estar a mil caracteres das âncoras que ele engole, e esta base já pagou isso
 * mais de dez vezes.
 *
 * Ela acha cada `cond && (` que fale do termo e mede o ALCANCE dele contando
 * parênteses. Quem cair dentro está gateado, more o guarda onde morar.
 */
function guardasAbertosEm(fonte: string, pos: number): string[] {
  const pilha: number[] = [];
  for (let i = 0; i < pos; i++) {
    const c = fonte[i];
    if (c === "(") pilha.push(i);
    else if (c === ")") pilha.pop();
  }
  /* O CABEÇALHO de cada parêntese ainda aberto: é onde o guarda mora
     (`{cond && (`, `cond ? (`). Cento e vinte caracteres cobrem uma condição
     quebrada em três linhas pelo prettier. */
  return pilha.map((i) => fonte.slice(Math.max(0, i - 120), i));
}

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
  /* ⚠️ **ERA COM A INDENTAÇÃO EXATA** — dezesseis espaços antes do × e catorze
     antes do `</button>` —, ou seja, ela só reconhecia o defeito se ele
     voltasse formatado do mesmo jeito. Qualquer reformatação do prettier o
     deixava passar. O que se cobra é a FORMA: nenhum botão cujo conteúdo seja
     só o glifo. */
  test("não é um glifo solto — o × sumiu", () => {
    expect(saude).not.toMatch(/>\s*×\s*<\/button>/);
    expect(saude).not.toContain('aria-label="Apagar este registro"');
  });

  test("mora atrás de um toque que ABRE a linha", () => {
    expect(saude).toMatch(/aria-expanded=\{aberta\}/);
    expect(saude).toMatch(/setAbertoId\(aberta \? null : l\.id\)/);
  });

  test("tem alvo de 44px e diz o que apagar", () => {
    const bloco = saude.slice(saude.indexOf("Apagar este registro"));
    /* ⚠️ **AS DUAS FORMAS QUE O REPOSITÓRIO USA PARA O MESMO ALVO DE 44px.**
       Travar `min-h-11` reprovava `min-h-[44px]`, que é a grafia de outros
       arquivos daqui — e um teste que reprova a forma equivalente é um teste
       que ensina alguém a relaxá-lo. */
    expect(saude).toMatch(/(?:min-h-11|min-h-\[44px\])[^"]*"\s*>\s*Apagar este registro/);
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

  /* ⚠️ ESTE TESTE TRAVAVA `prePregW == null`, a condição ANTIGA do convite —
     e ela era o defeito: cobria um dos três casos que a curva exige, deixando
     um estado SEM SAÍDA (peso sim, altura não → nem curva nem convite). O que
     se cobra é a garantia: o convite é barrado pelo Modo Cuidado, more a
     condição de dados onde morar. */
  test("o convite que existe só para destravá-la sai junto", () => {
    const i = saude.indexOf("faltaNaCurva != null");
    expect(i).toBeGreaterThan(-1);
    expect(saude.slice(Math.max(0, i - 220), i)).toContain("!careMode");
  });

  /* ⚠️ A OUTRA METADE, e ela é a que importa: o Modo Cuidado faz o app parar de
     FALAR DO BEBÊ, nunca de MEDIR a paciente. Um teste que só cobrisse o
     portão aprovaria alguém "consertando" o luto ao custo dos números dela. */
  test("peso, pressão, glicemia e a lista NÃO são gateados", () => {
    /* ⚠️ **ERA UMA JANELA DE 200 CARACTERES ANTES DA ÂNCORA — e ela deixava
       passar o pior mutante possível:** envolver a tela clínica inteira num
       `{!careMode && (…)}`, que apaga peso, pressão, glicemia, os gráficos e a
       lista para quem está em luto. O guarda fica longe das âncoras, e a janela
       não o via. Agora se mede o ALCANCE do guarda, contando parênteses. */
    for (const ancora of [
      "Último peso",
      "Histórico de pressão arterial",
      "Histórico de glicemia",
      "Ver e corrigir meus registros",
      "Novo registro",
    ]) {
      const i = saude.indexOf(ancora);
      if (i < 0) throw new Error(`âncora não encontrada: ${ancora}`);
      const gateada = guardasAbertosEm(saude, i).some((g) => /\bcareMode\b/.test(g));
      expect({ ancora, gateada }).toEqual({ ancora, gateada: false });
    }
  });

  test("a tela recebe o portão de quem o governa", () => {
    expect(conta).toMatch(/<HealthTab[^>]*careMode=\{careMode\}/);
  });
});

describe("o número do bloco no hub da Saúde", () => {
  /* ⚠️ Contar só o servidor faz o bloco afirmar um número MENOR do que ela
     cronometrou, num dia de trabalho de parto — as duas abas guardam registro
     no aparelho desde set/2026. */
  /* ⚠️ **AS TRÊS ASSERÇÕES ANTERIORES PROCURAVAM NOMES, NUNCA A CORRENTE** —
     passar `[]` no lugar das pendentes deixava as três strings no arquivo e o
     teste verde. É a armadilha "o nome continua sendo chamado" pela enésima
     vez: o que importa é o RESULTADO da fila chegar à mescla. */
  test("mescla a fila local nas duas fontes", () => {
    const pendentes = {
      chutes: hub.match(/const (\w+) = uid \? lerFilaDeChutes\(uid/)?.[1],
      contracoes: hub.match(/const (\w+) = uid \? lerFilaDeContracoes\(uid/)?.[1],
    };
    expect(pendentes.chutes).toBeTruthy();
    expect(pendentes.contracoes).toBeTruthy();

    /* Cada mescla recebe a variável que a fila produziu — e não uma lista
       vazia, nem a outra fila. */
    const mesclas = [...hub.matchAll(/mesclarRegistros\(([\s\S]*?)\n {6}\)/g)].map((m) => m[1]);
    expect(mesclas.length).toBeGreaterThanOrEqual(2);
    expect(mesclas.some((m) => m.includes(pendentes.chutes!))).toBe(true);
    expect(mesclas.some((m) => m.includes(pendentes.contracoes!))).toBe(true);
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
    const i = hub.indexOf("const [saude, chutes, contr, sessao] = await Promise.all([");
    /* ⚠️ Sem esta linha, uma âncora que não casa devolve −1 e `slice(-1)` dá UM
       caractere: o `not.toContain` abaixo ficaria verde sobre nada. */
    expect(i).toBeGreaterThan(0);
    const bloco = hub.slice(i);
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

  /* ⚠️ **A REGEX EXIGIA `gestante` COMO PRIMEIRO TERMO** — trocar a ordem dos
     três, que é uma reescrita sem mudança de comportamento, reprovava. O que se
     cobra é que os três estejam na MESMA condição, em qualquer ordem. */
  test("é barrado pela gestação, pelo histórico velho e pela FALHA de leitura", () => {
    /* A condição do CONVITE é a que termina em `? null :` — ela existe para
       BARRAR, e o convite mora no ramo de baixo. Encontrada pelos termos, em
       qualquer ordem. */
    const cond =
      ciclo.match(/\n\s*[^\n]*\binstavel\b[^\n]*\?\s*null\s*:/)?.[0] ??
      ciclo.match(/\n\s*[^\n]*\bgestante\b[^\n]*\?\s*null\s*:/)?.[0] ??
      "";
    expect(cond).toContain("gestante");
    expect(cond).toContain("historicoVelho");
    /* sem isto, "Registre seu período abaixo" é dito a quem tem meses de
       histórico e só teve uma falha de rede — e a faixa de "não consegui ler"
       apareceria logo abaixo, contradizendo o convite */
    expect(cond).toContain("instavel");
  });
});
