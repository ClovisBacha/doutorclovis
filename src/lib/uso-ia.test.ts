/**
 * A medição de uso de IA.
 *
 * Duas classes de defeito, e as duas são silenciosas:
 *
 * · **Medir errado.** Uma linha de zeros derruba o custo médio por resposta —
 *   e é justamente o número que vai definir quantas mensagens cabem num plano.
 *   Errar aqui é errar o preço.
 * · **Atrapalhar a resposta.** Isto roda dentro do caminho da conversa de uma
 *   gestante. Um `await` esquecido ou um erro que sobe transforma telemetria em
 *   indisponibilidade.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { registrarUso } from "./uso-ia.server";

/** A fonte sem comentários — o texto que explica o defeito costuma citá-lo. */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

const uso = codigoDe("src/lib/uso-ia.server.ts");
const chat = codigoDe("src/routes/api/chat.ts");
const memoria = codigoDe("src/lib/chat-memory.server.ts");

describe("medir nunca derruba a resposta", () => {
  test("sem banco configurado, registrar não lança", () => {
    expect(() =>
      registrarUso({ especie: "chat", modelo: "x", inputTokens: 10, outputTokens: 5 }),
    ).not.toThrow();
  });

  test("a função devolve void — não dá para esperar por ela sem querer", () => {
    expect(uso).toContain("export function registrarUso(u: Uso): void");
  });

  test("quem chama não é obrigado a esperar — mas pode", () => {
    /* Duas portas de propósito: `registrarUso` para o caminho comum (não
       segura ninguém) e `registrarUsoAgora` para dentro do `onFinish`, onde
       NÃO esperar significa a gravação ser morta com a função. */
    expect(uso).toContain("void registrarUsoAgora(u);");
    expect(uso).toContain("export async function registrarUsoAgora(u: Uso): Promise<void>");
    expect(uso).toMatch(/catch \{/);
  });
});

describe("zero não vira linha — exceto quando a linha É a cota", () => {
  test("sem tokens, só o que NÃO é resposta é descartado", () => {
    /* Era `if (entrada === 0 && saida === 0) return;` para tudo, e isso tinha
       um custo escondido: a cota do médico conta LINHAS de `especie='chat'`,
       não tokens. Toda resposta em que o provedor não reportou `usage` sumia
       do medidor E não consumia o plano — sub-contagem silenciosa, na direção
       que dá prejuízo. Embedding e memória continuam sendo descartados: eles
       são custo, não unidade vendida. */
    expect(uso).toContain('if (entrada === 0 && saida === 0 && u.especie !== "chat") return;');
  });

  test("a coluna que não existe não pode levar a linha inteira junto", () => {
    /* `cobertura`/`similaridade` vieram numa migration recente. O PostgREST
       rejeita a linha TODA por uma coluna ausente (42703) e o supabase-js
       devolve {error} sem lançar — então `ai_usage` ficava vazia, a cota nunca
       estourava e quatro telas do painel morriam sem um log. */
    expect(uso).toContain("if (res?.error)");
    expect(uso).toContain('.from("ai_usage").insert(linha)');
    expect(uso).toContain("APLICAR_COBERTURA.sql");
  });

  test("tokens negativos ou fracionários não passam", () => {
    expect(uso).toContain("Math.max(0, Math.trunc(u.inputTokens ?? 0))");
    expect(uso).toContain("Math.max(0, Math.trunc(u.outputTokens ?? 0))");
  });
});

describe("as três chamadas que custam são contadas", () => {
  test("a conversa (chat)", () => {
    expect(chat).toContain('especie: "chat"');
    expect(chat).toContain("inputTokens: usage?.inputTokens");
  });

  test("a memória — a que some numa medição ingênua", () => {
    /* Ela roda a cada 6 mensagens, manda 40 de histórico e a paciente nunca a
       vê. Vale ~20% da conta. */
    expect(memoria).toContain('especie: "memoria"');
    expect(memoria).toContain("result.usage?.inputTokens");
  });

  test("a espécie 'embedding' existe no tipo, para quando valer a pena", () => {
    expect(uso).toContain('"chat" | "memoria" | "embedding"');
  });
});

describe("o canal anônimo também conta", () => {
  test("o onFinish roda mesmo sem paciente", () => {
    /* Antes ele era `persistFor ? … : undefined` — sem paciente, nada rodava.
       A conversa do site custa tokens igual, e um medidor que ignora um canal
       inteiro mede errado. */
    /* Sem prender a lista de parâmetros: ela cresce quando o handler passa
       a olhar mais coisa (o `finishReason`, por exemplo). O que importa aqui
       é o `async` — é ele que a SDK aguarda. */
    expect(chat).toMatch(/onFinish: async \(\{[^}]*\}\) => \{/);
    expect(chat).not.toContain("onFinish: persistFor");
  });

  test("o canal é distinguido — e agora são três", () => {
    /* 'app' consome o plano do médico; 'suporte' é da plataforma; 'site' é
       visitante anônimo. Sem separar, a pergunta "como funciona o app" entraria
       na cota dele. */
    expect(chat).toContain('canal: soSuporte ? "suporte" : patient ? "app" : "site"');
  });
});

describe("grava token, não real", () => {
  test("nenhuma coluna de custo em dinheiro", () => {
    /* Preço de token, câmbio e modelo mudam. Custo gravado congela a conta de
       hoje num número que estará errado no mês que vem — e ninguém percebe que
       envelheceu. Token é fato; real é interpretação, feita na leitura. */
    const sql = readFileSync("supabase/migrations/20260804120000_ai_usage.sql", "utf8");
    expect(sql).toContain("input_tokens integer");
    expect(sql).toContain("output_tokens integer");
    expect(sql).not.toMatch(/custo_centavos|custo_reais\s+numeric|preco/i);
  });

  test("nenhum texto de conversa na tabela de telemetria", () => {
    /* Já existe `chat_messages`, com a RLS dela. Duplicar conversa de gestante
       numa tabela de custo seria uma segunda cópia do dado mais sensível do
       produto para responder a uma pergunta de dinheiro. */
    const sql = readFileSync("supabase/migrations/20260804120000_ai_usage.sql", "utf8");
    expect(sql).not.toMatch(/\b(content|texto|mensagem|pergunta|resposta)\s+text/i);
  });

  test("apagar a conta da paciente não apaga o custo já pago", () => {
    /* `ON DELETE SET NULL`, não CASCADE: exclusão de conta é direito dela, e
       não pode reescrever o histórico financeiro do mês passado. */
    const sql = readFileSync("supabase/migrations/20260804120000_ai_usage.sql", "utf8");
    expect(sql).toContain("patient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL");
  });
});

describe("o bloco do cérebro tem teto de caracteres", () => {
  const brain = readFileSync("src/lib/secondbrain.server.ts", "utf8");

  test("existe um limite em CARACTERES, não só em contagem de entradas", () => {
    /* Seis entradas de qualquer tamanho fazia o custo variar 5× entre um médico
       que escreve muito e um que escreve pouco — na maior parcela variável do
       prompt, paga em toda mensagem. */
    expect(brain).toContain("const MAX_BLOCK_CHARS = 4000;");
    expect(brain).toContain("limitarPorCaracteres(selected)");
  });

  test("nunca corta uma entrada pela metade", async () => {
    /* Meia orientação clínica pode inverter o sentido: "não use X em caso de…"
       cortado no "não use X". */
    const { limitarPorCaracteres } = await import("./secondbrain.server");
    const entradas = Array.from({ length: 6 }, (_, i) => ({
      question: `P${i}`.padEnd(100, "."),
      answer: `R${i}`.padEnd(900, "."),
    }));
    const saida = limitarPorCaracteres(entradas, 2000);
    expect(saida.length).toBeLessThan(6);
    for (const e of saida) {
      expect(e.answer.length).toBe(900); // inteira, nunca truncada
    }
  });

  test("nunca devolve lista vazia se havia alguma", async () => {
    /* `selected.length > 0` define `hadCoverage`, e `hadCoverage` muda o que a
       IA DIZ à paciente. Zerar aqui transformaria uma otimização de custo numa
       mudança de comportamento clínico. */
    const { limitarPorCaracteres } = await import("./secondbrain.server");
    const gigante = [{ question: "P".repeat(500), answer: "R".repeat(9000) }];
    expect(limitarPorCaracteres(gigante, 100)).toHaveLength(1);
  });

  test("o caso comum passa inteiro — o teto corta só a cauda", async () => {
    const { limitarPorCaracteres } = await import("./secondbrain.server");
    const comuns = Array.from({ length: 6 }, () => ({
      question: "P".repeat(80),
      answer: "R".repeat(220),
    }));
    expect(limitarPorCaracteres(comuns)).toHaveLength(6);
  });
});

describe("pergunta de app é da plataforma, não do médico", () => {
  test("suporte puro vai pelo caminho enxuto", async () => {
    const { ehSoSuporte } = await import("./secondbrain.server");
    for (const q of [
      "como funciona o app?",
      "esqueci minha senha",
      "onde fica a aba de notificações no aplicativo",
      "o app travou ao carregar",
      "como faço para assinar o premium",
    ]) {
      expect(ehSoSuporte(q)).toBe(true);
    }
  });

  test("na dúvida é CLÍNICA — dois sinais, não um", async () => {
    /* O detector antigo casava com "app" em qualquer lugar da frase. Usado para
       DESLIGAR o cérebro, isso daria suporte técnico a uma queixa clínica: a
       paciente perderia toda a orientação do médico dela. */
    const { ehSoSuporte, isSuporteDoApp } = await import("./secondbrain.server");
    for (const q of [
      "estou com dor de cabeça, é normal? aliás o app travou",
      "no app não achei onde lançar minha pressão, que está 150/100",
      "a tela de contrações some quando o bebê mexe",
    ]) {
      expect(isSuporteDoApp(q)).toBe(true); // o antigo diria "suporte"
      expect(ehSoSuporte(q)).toBe(false); // o novo devolve ao caminho clínico
    }
  });

  test("pergunta puramente clínica nunca entra no caminho enxuto", async () => {
    const { ehSoSuporte } = await import("./secondbrain.server");
    for (const q of [
      "posso tomar dipirona?",
      "estou sangrando um pouco",
      "o bebê não mexeu hoje",
      "minha pressão deu 150 por 100",
    ]) {
      expect(ehSoSuporte(q)).toBe(false);
    }
  });

  test("o custo de suporte é separado no medidor", () => {
    /* Sem canal próprio, a pergunta de app entraria na cota do médico — que é o
       que esta mudança existe para evitar. */
    expect(chat).toContain('canal: soSuporte ? "suporte"');
  });

  test("o caminho enxuto vem ANTES do ramo clínico", () => {
    /* Se viesse depois, nada mudaria: o prompt clínico já teria sido montado. */
    const enxuto = chat.indexOf("if (soSuporte) {");
    const clinico = chat.indexOf("} else if (patient && patient.doctorId) {");
    expect(enxuto).toBeGreaterThan(0);
    expect(enxuto).toBeLessThan(clinico);
  });
});

/**
 * A eficiencia do Segundo Cerebro era uma pergunta sem resposta.
 *
 * O sinal existia (`hadCoverage`) e nao era gravado. E `brain_hits`, que parece
 * ser isso, nao e: ele registra sempre que um bloco nao-vazio e montado, e a
 * persona do medico sozinha ja faz o bloco nao ser vazio — um "hit" pode nao ter
 * tido cobertura nenhuma.
 */
describe("a cobertura do cérebro passa a ser medida", () => {
  const brain = readFileSync("src/lib/secondbrain.server.ts", "utf8");

  test("a similaridade do melhor acerto sobe junto com o contexto", () => {
    expect(brain).toContain("melhorSimilaridade: number | null;");
    expect(brain).toContain("melhorSimilaridade = Math.max(...achados.map((m) => m.similarity))");
  });

  test("a similaridade é capturada ANTES do corte", () => {
    /* Guardar só o que passou esconderia metade da informação: saber que a
       melhor entrada deu 0,52 é o que revela um corte apertado demais — e isso
       some se a gente só olhar o que virou cobertura. */
    const captura = brain.indexOf("melhorSimilaridade = Math.max");
    const corte = brain.indexOf("m.similarity >= SEMANTIC_MIN_SIMILARITY");
    expect(captura).toBeGreaterThan(0);
    expect(captura).toBeLessThan(corte);
  });

  test("nulo e `false` dizem coisas diferentes", () => {
    /* `false` = o cérebro olhou e não achou. Nulo = o cérebro nem foi
       consultado (suporte, site anônimo, paciente sem médico). Gravar `false`
       nesses casos afundaria a taxa de cobertura com perguntas que nunca
       deveriam entrar na conta. */
    expect(chat).toContain("let cobertura: boolean | undefined;");
    expect(uso).toContain("cobertura: u.cobertura ?? null,");
  });

  test("o cérebro remoto declara que não sabe, em vez de chutar", () => {
    expect(brain).toContain("melhorSimilaridade: null,");
  });

  test("os dois valores chegam ao medidor", () => {
    expect(chat).toContain("cobertura = brain.hadCoverage;");
    expect(chat).toContain("similaridade = brain.melhorSimilaridade;");
    expect(chat).toMatch(/cobertura,\s*\n\s*similaridade,/);
  });
});
