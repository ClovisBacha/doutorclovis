/**
 * A SIMULAÇÃO NÃO PODE INVENTAR CONDUTA.
 *
 * ─── O DEFEITO QUE ISTO DESCREVE ────────────────────────────────────────────
 *
 * Existia no repositório uma vitrine do Segundo Cérebro (`brain-showcase.tsx`)
 * com este balão, escrito à mão:
 *
 *     “Posso tomar dipirona na gestação?”
 *     “A Dra. orienta que sim, na dose certa — e explica quando evitar.”
 *
 * O kit de partida, no arquivo ao lado, manda EVITAR dipirona — especialmente
 * no 3º trimestre. Duas condutas opostas na mesma base de código, e a que ia
 * para o público era a errada, assinada por uma médica que nunca disse aquilo.
 *
 * O componente estava morto (nenhum arquivo o importava), então nunca chegou a
 * ninguém. Mas “ninguém importou ainda” não é uma salvaguarda: bastava alguém
 * achar a vitrine bonita.
 *
 * ─── A REGRA QUE SUBSTITUIU O BOM SENSO ─────────────────────────────────────
 *
 * Toda resposta de `cobertura` sai de `BRAIN_STARTER_PACK`. Não é uma resposta
 * PARECIDA com a que o médico daria — é literalmente o rascunho que ele
 * receberia para aprovar. `respostaConsolidada` estoura se a pergunta não
 * estiver lá, e é isso que este arquivo cobra: escrever conduta à mão na
 * simulação tem de ser impossível, não desaconselhado.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BRAIN_STARTER_PACK } from "./brain-starter-pack";
import {
  AVISO_DA_SIMULACAO,
  CASOS_SIMULADOS,
  ROTULO_DO_VEREDICTO,
  respostaConsolidada,
} from "./simulacao-do-cerebro";

describe("1. conduta só sai do que o médico aprovaria", () => {
  test("toda resposta de cobertura é, palavra por palavra, a do kit de partida", () => {
    const cobertura = CASOS_SIMULADOS.filter((c) => c.veredicto === "cobertura");
    expect(cobertura.length).toBeGreaterThan(0);
    for (const c of cobertura) {
      const doKit = BRAIN_STARTER_PACK.find((e) => e.question === c.pergunta);
      if (!doKit) throw new Error(`"${c.pergunta}" não está no kit de partida`);
      expect(c.resposta).toBe(doKit.answer);
    }
  });

  test("uma pergunta fora do kit não vira resposta — estoura", () => {
    /* A asserção que descreve a vitrine morta: ela respondia sobre dipirona
       sem que ninguém tivesse aprovado aquela frase. Aqui, tentar isso falha
       na hora de montar o módulo. */
    expect(() => respostaConsolidada("Posso tomar dipirona na gestação?")).toThrow(
      /kit de partida/,
    );
  });

  test("e o kit continua mandando EVITAR dipirona", () => {
    /**
     * O ponto que a vitrine errou. Se algum dia a conduta do kit mudar, que
     * mude por decisão clínica no arquivo certo — e que este teste caia junto,
     * obrigando quem mudou a olhar para cá.
     */
    const linha = BRAIN_STARTER_PACK.find((e) => e.question.includes("dipirona"));
    if (!linha) throw new Error("o kit perdeu a entrada de analgésico");
    expect(linha.answer).toContain("dipirona deve ser evitada");
  });
});

describe("2. mostra o cérebro se calando, não só respondendo", () => {
  test("os três comportamentos estão na simulação", () => {
    /* Só `cobertura` venderia um chat genérico. O que convence um obstetra são
       os outros dois — e por isso nenhum pode sumir da lista. */
    const vistos = new Set(CASOS_SIMULADOS.map((c) => c.veredicto));
    expect([...vistos].sort()).toEqual(["cobertura", "limite", "urgencia"]);
  });

  test("a maioria dos exemplos é a IA NÃO respondendo", () => {
    const recusas = CASOS_SIMULADOS.filter((c) => c.veredicto !== "cobertura").length;
    expect(recusas).toBeGreaterThanOrEqual(CASOS_SIMULADOS.length - recusas);
  });

  test("nenhum «limite» dá remédio, dose ou laudo", () => {
    /**
     * É o critério que `brain-eval` cobra do cérebro de verdade. A simulação
     * promete esse comportamento ao médico; prometer e demonstrar o contrário
     * seria pior do que não demonstrar nada.
     */
    const proibido = [/\bmg\b/i, /\bcomprimido/i, /\bdose de\b/i, /\btome\b/i, /\buse\s+\d/i];
    for (const c of CASOS_SIMULADOS.filter((x) => x.veredicto === "limite")) {
      for (const p of proibido) expect(c.resposta).not.toMatch(p);
    }
  });

  test("a urgência manda procurar atendimento — e logo, sem acalmar antes", () => {
    /**
     * Cobrar só "cita 192 em algum lugar" deixava passar uma resposta que
     * abrisse com "fique tranquila, costuma passar sozinho" e mencionasse a
     * maternidade três linhas depois — um mutante sobreviveu exatamente assim.
     * Numa tela de celular às duas da manhã, o que ela lê é a primeira frase;
     * o resto ela lê se a primeira não a tiver convencido a esperar.
     */
    /* Sem "espere" solto na lista: ele casava com "NÃO espere passar", que é
       justamente a instrução certa. Um teste que reprova a frase correta é
       pior que nenhum — o próximo a mexer aprende a contorná-lo. */
    const minimiza = /fique tranquila|costuma passar|não se preocupe|deve ser normal/i;
    for (const c of CASOS_SIMULADOS.filter((x) => x.veredicto === "urgencia")) {
      expect(c.resposta).toMatch(/maternidade|pronto-socorro|192/);
      /* A ordem: o encaminhamento tem de vir no começo, não no rodapé. */
      expect(c.resposta.search(/maternidade|pronto-socorro|192/)).toBeLessThan(160);
      const abertura = c.resposta.slice(0, 160);
      expect(abertura).not.toMatch(minimiza);
    }
  });
});

describe("3. a simulação se declara simulação", () => {
  test("o aviso diz que não é o cérebro dele e que não gasta mensagem", () => {
    /* Uma demonstração que se disfarça de produto é uma promessa que o produto
       não fez — e o primeiro a cobrá-la é o médico que assinou por causa dela. */
    expect(AVISO_DA_SIMULACAO).toContain("Simulação");
    expect(AVISO_DA_SIMULACAO).toContain("não consome mensagens");
  });

  test("a tela mostra o aviso, e não some com ele num canto", () => {
    const tela = readFileSync("src/components/simulacao-do-cerebro.tsx", "utf8");
    /* `toContain("AVISO_DA_SIMULACAO")` era satisfeito pela linha do `import`:
       trocar o aviso renderizado por `{null}` deixava o teste verde. A
       asserção que vale é a do JSX que sai na tela. */
    expect(tela).toContain("{AVISO_DA_SIMULACAO}</p>");
    /* E nada de `hidden`/`sr-only` no parágrafo do aviso. */
    expect(tela).not.toMatch(/sr-only[^\n]*AVISO_DA_SIMULACAO/);
  });

  test("todo veredicto tem rótulo — nenhum cai como «undefined» na tela", () => {
    for (const c of CASOS_SIMULADOS) {
      const r = ROTULO_DO_VEREDICTO[c.veredicto];
      expect(r?.titulo?.length ?? 0).toBeGreaterThan(0);
      expect(r?.explica?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("4. ela custa zero — é o motivo de existir", () => {
  test("nem o módulo nem a tela chamam rede", () => {
    /**
     * A simulação nasceu no lugar do teste ao vivo no Free, que era a nossa
     * chave gastando por quem não paga, sem teto: bastava continuar
     * perguntando. Se um dia alguém "melhorar" a simulação plugando o modelo
     * de verdade, o buraco volta inteiro — com o nome de demonstração.
     */
    for (const arq of [
      "src/lib/simulacao-do-cerebro.ts",
      "src/components/simulacao-do-cerebro.tsx",
    ]) {
      const codigo = readFileSync(arq, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(codigo).not.toContain("fetch(");
      expect(codigo).not.toContain("/api/");
      expect(codigo).not.toContain("streamText");
    }
  });

  test("a vitrine que inventava conduta não existe mais", () => {
    /* Morta, mas a um `import` de distância de ir ao ar. */
    expect(() => readFileSync("src/components/brain-showcase.tsx", "utf8")).toThrow();
  });
});

describe("5. está onde o médico sem plano bate", () => {
  const semComentarios = (p: string) =>
    readFileSync(p, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  test("no painel, junto da tranca do Cérebro", () => {
    /**
     * A tranca sozinha dizia "você não tem" e mostrava uma parede. É o único
     * lugar do produto onde o médico no Free procura o cérebro de propósito —
     * mostrar a simulação em qualquer outro lugar é mostrá-la a quem não
     * perguntou.
     */
    const painel = semComentarios("src/routes/_authenticated/painel.tsx");
    const i = painel.indexOf('tab === "Cérebro 🧠" && !podeIA');
    expect(i).toBeGreaterThan(-1);
    expect(painel.slice(i, i + 900)).toContain("<SimulacaoDoCerebro");
  });

  test("e no site, antes do preço", () => {
    /* Ver a IA se recusar a receitar é o que derruba a objeção; ver o preço
       antes disso é pedir a decisão antes do argumento. */
    const vendas = semComentarios("src/routes/medicos.tsx");
    const iSim = vendas.indexOf("<SimulacaoDoCerebro");
    const iEscada = vendas.indexOf("<EscadaDeMensagens");
    expect(iSim).toBeGreaterThan(-1);
    expect(iEscada).toBeGreaterThan(-1);
    expect(iSim).toBeLessThan(iEscada);
  });
});
