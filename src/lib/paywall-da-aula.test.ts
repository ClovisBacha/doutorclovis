import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * O PAYWALL DA AULA — e o comentário que inventava um canal de receita.
 *
 * O cabeçalho do `QuizPaywall` afirmava, por escrito: "pagamento assistido: PIX
 * + comprovante no WhatsApp e o consultório ativa o acesso (toggle no painel do
 * médico)". Não existe PIX, não existe link de WhatsApp e não existe
 * comprovante em lugar nenhum do `src/` — o caminho real é
 * `createSubscriptionCheckout` mais o resgate de código, com `podeComprarAqui`
 * decidindo se a compra pode acontecer.
 *
 * ⚠️ **Um comentário que inventa CANAL DE RECEITA não é detalhe de prosa.** Ele
 * faz o próximo leitor concluir que o app já sabe cobrar por fora da loja, e a
 * decisão de negócio seguinte é tomada em cima disso. É a terceira vez que
 * prosa desatualizada engana alguém neste repositório — as três constantes de
 * preço mortas ("parece autoridade, e alguém a usa achando que é a fonte") e o
 * comentário do avatar que continuava afirmando "já é data URL no banco" depois
 * de o editor passar a subir para o balde.
 */
const TELA = readFileSync("src/components/gestacao-path.tsx", "utf8");

/**
 * ⚠️ **AQUI NÃO SE POLICIA PROSA — e isso foi decidido depois de tentar.**
 *
 * A primeira versão deste arquivo tinha uma regra do tipo "se a palavra PIX
 * aparece, o código tem de tê-la". Ficou vermelha na hora, e por causa do
 * comentário que EU acabara de escrever explicando que o PIX não existe: para
 * dizer que a afirmação era falsa, é preciso citá-la.
 *
 * É a terceira vez que casar texto engana neste repositório, nos dois sentidos:
 * na catraca de portas a prosa aprovava função morta, no teste do "então e
 * agora" ela reprovava código certo. Teste que procura palavra é teste que
 * mente. O que sobra aqui é COMPORTAMENTO: por onde a compra passa, e que o
 * flag do fluxo assistido continua sem escritor.
 */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const CODIGO = semComentarios(TELA);

describe("o paywall da aula paga por um caminho só", () => {
  /**
   * ⚠️ **O portão de canal é `podeComprarAqui`.** Assinatura digital dentro do
   * app nativo tem de passar pela loja da Apple/Google (diretriz 3.1.1) — este
   * paywall já foi o único dos três que abria o Stripe direto.
   */
  test("⚠️ a compra passa pelo veredito de canal", () => {
    expect(CODIGO).toContain('podeComprarAqui("premium_paciente", nativo)');
    expect(CODIGO).toContain("createSubscriptionCheckout");
  });

  /**
   * ⚠️ **`dc-path-premium-pending` não pode ganhar um escritor de volta.**
   *
   * Ele era o flag de "comprovante enviado" do fluxo assistido — PIX e WhatsApp
   * — que o cabeçalho do `QuizPaywall` descrevia e que NÃO existe no `src/`. Um
   * comentário que inventa canal de receita faz o próximo leitor concluir que o
   * app já sabe cobrar por fora da loja, e a decisão de negócio seguinte sai
   * daí.
   *
   * Hoje as únicas linhas que tocam o flag são a leitura e a limpeza (gravando
   * `""`), que existe só para blob de jornada de versão antiga. Um `lsSet` com
   * valor de verdade significa que alguém religou METADE do fluxo — e meio
   * fluxo de pagamento é pior que nenhum, porque a paciente acha que pagou.
   */
  test("⚠️ o flag do fluxo assistido continua sem escritor", () => {
    const escritas = [
      ...CODIGO.matchAll(/lsSet\(\s*"dc-path-premium-pending"\s*,\s*([^)]*)\)/g),
    ].map((m) => m[1].trim());
    expect(escritas.length).toBeGreaterThan(0);
    for (const v of escritas) expect(v).toBe('""');
  });
});
