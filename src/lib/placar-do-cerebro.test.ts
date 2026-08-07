/**
 * O PLACAR DO CÉREBRO NÃO PODE MENTIR PARA O MÉDICO.
 *
 * Ele é a prova de valor do produto: "sua IA cobriu 91% das dúvidas". É com
 * esse número que o médico decide se o Segundo Cérebro está funcionando — e se
 * vale continuar pagando.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cerebro = readFileSync("src/lib/secondbrain.server.ts", "utf8");
const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
/* SEM COMENTÁRIOS, para as asserções POSICIONAIS. Uma janela medida em bytes a
   partir de um marcador encolhe a própria cobertura quando o código ganha
   explicação: este arquivo já reprovou uma vez por isso, sem nada ter
   quebrado. E asserções sobre o texto casam com a prosa em vez do código. */
const painelSemComentarios = painel
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("a mesma mensagem não conta como acerto E como lacuna", () => {
  /**
   * Era "bloco não-vazio → registra o hit". Mas o bloco nasce não-vazio só com
   * persona, frases ou regras preenchidas — que é o que o produto pede no
   * primeiro acesso. Então, para todo médico que configurou o estilo, QUALQUER
   * pergunta contava um acerto, inclusive as que não casaram com nada. E a
   * mesma mensagem já tinha agendado uma lacuna algumas linhas acima.
   *
   * `hits / (hits + lacunas)`: a mesma pergunta nos dois lados da fração. A
   * cobertura subia sozinha conforme ele preenchia a persona, sem uma única
   * entrada de conhecimento.
   */
  /* ─── O CONSERTO ANTERIOR PAROU NO MEIO ────────────────────────────────
     `selected.length > 0` matou o caso do médico com persona preenchida e
     conhecimento zero, mas não tornou os dois lados COMPLEMENTARES: a lacuna é
     gravada quando `!podeAtribuir`, e `selected.length > 0` é estritamente mais
     fraca que `podeAtribuir`. Toda pergunta da faixa 0,62–0,74 e todo o caminho
     por palavras continuavam nos dois lados — e é justamente nessa faixa que a
     IA diz à gestante que "registrou para ele confirmar". */
  test("o hit é o complemento EXATO da lacuna", () => {
    expect(cerebro).toContain(
      'if (podeAtribuir && channel !== "teste") logBrainHit(target, channel);',
    );
  });

  test("e a lacuna é a outra metade da mesma partição", () => {
    /* Se um dos dois lados mudar de critério sozinho, a fração volta a mentir —
       agora subestimando em vez de inflar. */
    expect(cerebro).toContain('if (!podeAtribuir && channel !== "teste") {');
  });

  test("o teste do próprio médico não entra em nenhum dos dois lados", () => {
    /* Sem o `channel !== "teste"` no hit, o médico inflaria a própria cobertura
       clicando em "testar o cérebro" — e a lacuna já excluía o canal, então os
       dois lados discordariam de novo. */
    const i = cerebro.indexOf("logBrainHit(target, channel);");
    expect(cerebro.slice(Math.max(0, i - 120), i)).toContain('channel !== "teste"');
  });

  test("`hadCoverage` CONTINUA sendo `selected.length > 0` — e não é contradição", () => {
    /* Ela responde outra pergunta: "alguma orientação dele entrou no prompt?",
       que é o que o `chat.ts` usa para escolher o tom. O placar mede quem
       respondeu. Confundir as duas foi o que produziu as duas versões erradas
       deste contador. */
    expect(cerebro).toContain("hadCoverage: selected.length > 0");
  });

  test("o hit não é mais registrado só por o bloco existir", () => {
    expect(cerebro).not.toMatch(/^\s*logBrainHit\(target, channel\);$/m);
  });
});

describe("o contador da faixa desce quando o médico trabalha", () => {
  /**
   * `onContar` só era chamado no CARREGAMENTO. O médico resolvia a fila
   * inteira e o badge "O que está esperando você" continuava no número de
   * quando ele abriu a tela, até recarregar. Um número que não responde ao
   * trabalho ensina a ignorar o número.
   */
  test("resolver uma lacuna recontabiliza a fila", () => {
    const i = painel.indexOf("setSoParaEla(false);");
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(i, i + 400)).toContain("onContar?.(restantes.length)");
  });

  test("ignorar também", () => {
    const i = painel.indexOf('else toast.error("Não foi possível ignorar.");');
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(Math.max(0, i - 500), i)).toContain("onContar?.(restantes.length)");
  });

  test("treinar uma pergunta desce o total exato", () => {
    /* `totalQ` vem de uma contagem exata do servidor: a tela mostra 50 e o
       cabeçalho diz quantas existem. Sem descer, ele responde as 50 e o número
       fica igual. */
    const i = painel.indexOf("setTotalQ((n) => Math.max(0, n - 1));");
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(i, i + 200)).toContain("onContar?.(Math.max(0, totalQ - 1))");
  });
});

describe('a caixa "só para ela" é do item, não da tela', () => {
  test("cancelar e abrir OUTRA lacuna também limpam", () => {
    /* Um verificador apontou que só o caminho de sucesso limpava — e o
       comentário afirmava o contrário. Cancelar deixava a caixa marcada, e
       abrir a lacuna seguinte a herdava: ele responderia em modo individual sem
       saber, ou seria recusado sem entender por quê. */
    expect(painel).toContain("setSoParaEla(false); // cancelar também limpa");
    const i = painelSemComentarios.indexOf("setAnswering(g.id);");
    expect(i).toBeGreaterThan(-1);
    expect(painelSemComentarios.slice(i, i + 600)).toContain("setSoParaEla(false)");
  });

  test("ela é desmarcada ao terminar uma lacuna", () => {
    /* Ficar marcada faria a PRÓXIMA lacuna ser respondida em modo individual
       sem ele perceber — e aí o conhecimento que ele achou que estava criando
       simplesmente não existe. */
    const i = painelSemComentarios.indexOf("async function resolve(gapId: string)");
    expect(i).toBeGreaterThan(-1);
    expect(painelSemComentarios.slice(i, i + 3200)).toContain("setSoParaEla(false)");
  });
});
