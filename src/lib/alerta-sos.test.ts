import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * O ALERTA DE SOS DO PAINEL — a tela de maior risco do produto.
 *
 * ⚠️ **Ela nunca tinha sido olhada.** Uma varredura de alcance (fecho
 * transitivo dos imports a partir de todas as `/preview-*`) achou 41
 * componentes que bancada nenhuma alcança, e o padrão é nítido: o app da
 * paciente tem bancadas, o painel do MÉDICO quase nenhuma. Para olhar esta era
 * preciso uma paciente de verdade apertando o botão de emergência — ou seja, na
 * prática ninguém olhava.
 *
 * E os dois defeitos achados no mesmo dia (as cotas que não nasciam, o link com
 * `location.origin`) estavam os dois em telas sem bancada.
 */
const TELA = readFileSync("src/components/alerta-sos-medico.tsx", "utf8");
/* Comentários fora antes de procurar — a prosa engana nos dois sentidos, e este
   arquivo tem um comentário que cita o texto antigo para explicá-lo. */
const codigo = TELA.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

describe("o aviso de SOS só cita o que está na tela", () => {
  /**
   * ⚠️ **O AVISO MANDAVA O MÉDICO USAR DOIS CAMINHOS QUE NÃO EXISTIAM.**
   *
   * Ele dizia "use o WhatsApp ou o contato de emergência abaixo". Só que o
   * botão do WhatsApp é gated pelo MESMO `telPaciente` que acabou de faltar
   * (então nunca aparece nesse ramo), e o contato de emergência vem da ficha,
   * que pode ser nula. Medido na bancada `?magro=1`: nenhum dos dois estava
   * desenhado.
   *
   * Numa tela de emergência isso não é texto impreciso — é o médico procurando
   * um botão que não existe enquanto uma paciente espera.
   */
  test("⚠️ o aviso não promete WhatsApp no ramo em que ele não pode existir", () => {
    const i = codigo.indexOf("Ela não cadastrou telefone");
    expect(i).toBeGreaterThan(0);
    const aviso = codigo.slice(i, codigo.indexOf("</p>", i));
    expect(aviso).not.toContain("WhatsApp");
  });

  /** O aviso se adapta ao que existe: contato de emergência, mapa, ou nada. */
  test("⚠️ o aviso tem os três casos", () => {
    const i = codigo.indexOf("Ela não cadastrou telefone");
    const bloco = codigo.slice(Math.max(0, i - 400), codigo.indexOf("</p>", i));
    expect(bloco).toContain("f.contatoTel ?");
    expect(bloco).toContain("mapa ?");
  });

  /**
   * ⚠️ **Fechar sem atender NÃO dispensa o alerta** — emergência não se
   * dispensa, e o texto do botão diz isso ("o aviso continua aqui").
   */
  test("⚠️ há duas saídas, e a de fechar não resolve o acionamento", () => {
    expect(codigo).toContain("o aviso continua aqui");
    expect(codigo).toContain("onAtender");
  });
});
