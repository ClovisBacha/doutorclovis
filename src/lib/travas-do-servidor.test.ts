/**
 * AS TRAVAS MECÂNICAS.
 *
 * Este arquivo não testa uma funcionalidade — testa que dois padrões que já
 * mataram recursos inteiros nesta base não voltem a existir. Comentário
 * explicando "por que isto é errado" não impede ninguém: os dois padrões abaixo
 * foram diagnosticados, documentados em prosa longa, corrigidos… e
 * ressuscitaram em outro arquivo semanas depois.
 *
 * Um teste que CONTA é a única coisa que faz o número só poder cair.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Todo `.ts`/`.tsx` de `src/`, exceto os próprios testes. */
function arquivosDoProjeto(dir = "src", saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDoProjeto(caminho, saida);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/** Sem comentários: a prosa deste repo cita os padrões que ela condena. */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

/** Código que roda no SERVIDOR — é onde o congelamento acontece. */
const DO_SERVIDOR = arquivosDoProjeto().filter(
  (f) => /\.server\.ts$/.test(f) || /\.functions\.ts$/.test(f) || f.startsWith("src/routes/api/"),
);

describe("dispare-e-esqueça não volta ao servidor", () => {
  /**
   * `void (async () => {…})()` em servidor sem servidor é uma promessa que
   * ninguém guarda: a invocação congela quando a resposta sai, e o trabalho
   * morre antes de acontecer — sem erro, sem log, sem nada.
   *
   * Custou três recursos nesta base, um de cada vez:
   *
   *   · `curarLacunasSemVetor` — as lacunas nunca ganhavam vetor;
   *   · `backfillBrainEmbeddings` — as ENTRADAS nunca ganhavam vetor, e a
   *     busca semântica inteira ficou parada sem ninguém perceber;
   *   · `notifyDoctorOfGap` — o e-mail "sua IA tem perguntas sem resposta"
   *     disparava no instante mais próximo do congelamento.
   *
   * Os dois primeiros foram consertados com um comentário explicando o padrão.
   * O terceiro nasceu depois desse comentário, no mesmo arquivo.
   */
  test("todo dispare-e-esqueça de servidor é AUTORIZADO por escrito", () => {
    /* Não é proibição cega: telemetria pura (`logBrainHit`, o medidor de uso,
       a marca de chave usada) é exatamente onde disparar-e-esquecer está
       certo — perder uma linha não muda nada para ninguém, e aguardar poria
       uma escrita no caminho da resposta da paciente.
       O que o teste cobra é a DECISÃO EXPLÍCITA: quem escreve o padrão tem que
       declarar por que ele é seguro ali. Foi assim que o kit de partida do
       médico novo apareceu — ninguém decidiu que ele podia morrer, ele só
       herdou a forma do vizinho. */
    const semJustificativa = DO_SERVIDOR.filter((f) => {
      const bruto = readFileSync(f, "utf8");
      const marcas = (bruto.match(/DISPARA-E-ESQUECE AUTORIZADO/g) ?? []).length;
      /* DUAS FORMAS, e a regex só via uma. `void (async () => {…})()` é a que
         o repo escreveu três vezes; `void minhaFuncao(...)` faz exatamente a
         mesma coisa e passava livre — inclusive no `void avisarMedicoDaCota()`
         que eu tinha acabado de escrever no caminho quente do chat. */
      const codigo = codigoDe(f);
      const usos =
        (codigo.match(/void \(async \(\) =>/g) ?? []).length +
        (codigo.match(/^\s*void [a-zA-Z_$][\w$]*\(/gm) ?? []).length;
      return usos > marcas;
    });
    expect(semJustificativa).toEqual([]);
  });

  test("a lista de arquivos de servidor não está vazia (o teste testa algo)", () => {
    /* Se o filtro quebrar, o teste acima passa com zero arquivos e vira
       decoração — que é exatamente o tipo de teste que este arquivo existe
       para não ser. */
    expect(DO_SERVIDOR.length).toBeGreaterThan(20);
  });
});

describe("escrita no banco não pode falhar em silêncio", () => {
  /**
   * O `supabase-js` NÃO lança quando o Postgres recusa: devolve `{ error }`.
   * Uma escrita que ignora esse campo é uma escrita que pode não ter
   * acontecido, e o código segue como se tivesse.
   *
   * O caso mais caro foi o webhook do Stripe: cinco escritas sem checagem, o
   * `catch` que devolveria 500 nunca disparando, e a Stripe recebendo 200. A
   * médica pagava, o plano não era concedido, e não havia retry.
   *
   * A contagem abaixo é um teto que só pode DESCER. Não é uma meta de zero:
   * há escritas de enriquecimento onde silêncio é a decisão certa (telemetria,
   * `logBrainHit`). O que não pode é o número subir sem ninguém olhar.
   */
  const TETO = 66;

  function escritasSemChecagem(fonte: string): number {
    const linhas = fonte.split("\n");
    let n = 0;
    linhas.forEach((linha, i) => {
      if (!/\.(insert|upsert|update|delete)\(/.test(linha)) return;
      /* A checagem pode estar na mesma linha (`const { error } = await …`) ou
         logo abaixo (`if (error)`); oito linhas de janela cobrem as duas. */
      const janela = linhas.slice(Math.max(0, i - 6), i + 8).join("\n");
      if (/\berror\b/.test(janela) || /\bgravar\(/.test(janela)) return;
      n++;
    });
    return n;
  }

  test("o número de escritas sem checagem não sobe", () => {
    const total = DO_SERVIDOR.reduce((soma, f) => soma + escritasSemChecagem(codigoDe(f)), 0);
    /* Se este teste falhar porque você BAIXOU o número: abaixe o teto junto.
       É a única forma de a dívida não voltar a crescer em silêncio. */
    expect(total).toBeLessThanOrEqual(TETO);
  });

  test("no webhook de cobrança, toda CONCESSÃO é conferida", () => {
    /* Aqui quase toda linha é dinheiro ou acesso: assinatura, plano do médico,
       premium da paciente, comissão de afiliado, +30 dias de indicação. As
       oito CONCESSÕES passam por `gravar()`, que lança e faz o handler
       devolver 500 — fazendo a Stripe reenviar.

       Sobram três, e as três estão certas assim:
       · duas em `recordPaymentIncident` — registro de uma cobrança que JÁ
         falhou. Não concedem nada, e derrubar o webhook por causa do registro
         de um incidente faria a Stripe reenviar um evento cuja parte
         importante já foi aplicada.
       · uma é a reivindicação de `referral_rewarded`, que já FALHA SEGURO: o
         resultado é lido (`data: claimed`) e, sem linha de volta, a função
         retorna sem recompensar. Checar o `error` ali não mudaria nada. */
    expect(escritasSemChecagem(codigoDe("src/routes/api/stripe-webhook.ts"))).toBeLessThanOrEqual(
      3,
    );
  });
});
