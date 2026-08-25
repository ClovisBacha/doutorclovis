/**
 * A JUNÇÃO DA SONDAGEM.
 *
 * ⚠️ **Ela mora no componente, e por isso este teste importa do `.tsx`.** É a
 * exceção que o projeto normalmente proíbe (régua pura em `lib/`), e ela se
 * sustenta porque `juntarMensagens` não toca em `document`, em `sonner` nem em
 * nenhum `.webp` — é uma função sobre arrays que só existe para servir a UM
 * componente. Se um dia um segundo lugar precisar dela, ela muda de casa.
 */
import { describe, expect, test } from "bun:test";
import { juntarMensagens } from "@/components/rede-conversa";
import type { MensagemNaTela } from "@/lib/conversa.functions";

function m(id: string, min: number, extra: Partial<MensagemNaTela> = {}): MensagemNaTela {
  return {
    id,
    souEu: false,
    texto: id,
    criadaEm: `2026-08-24T10:${String(min).padStart(2, "0")}:00Z`,
    apagada: false,
    ...extra,
  };
}

describe("juntarMensagens", () => {
  test("⚠️ a página nova NÃO apaga as antigas já carregadas", () => {
    /* É o defeito que a sondagem criaria: ela devolve só as últimas 50, e
       sobrescrever faria a conversa encolher a cada seis segundos para quem
       tinha subido para ler o começo. */
    const jaNaTela = [m("velha", 0), m("meio", 10)];
    const daSondagem = [m("meio", 10), m("nova", 20)];
    expect(juntarMensagens(jaNaTela, daSondagem).map((x) => x.id)).toEqual([
      "velha",
      "meio",
      "nova",
    ]);
  });

  test("⚠️ a versão NOVA de cada id vence", () => {
    /* Uma mensagem apagada pela outra pessoa volta como `apagada: true`:
       mantendo a antiga, o texto que ela apagou continuaria na tela de quem já
       o tinha carregado. */
    const antes = [m("x", 5, { texto: "segredo", apagada: false })];
    const depois = [m("x", 5, { texto: null, apagada: true })];
    const r = juntarMensagens(antes, depois);
    expect(r).toHaveLength(1);
    /* ⚠️ **`toMatchObject` NÃO É TIPADO no `bun:test`, e o `tsc` da CI reprova.**
       Já estava escrito em `lacunas-parecidas.test.ts` e eu reintroduzi — o
       `tsc` local passou porque este contêiner tem um `node_modules` remendado,
       e a CI instala limpo. Comparar campo a campo é equivalente e não prende o
       teste ao formato inteiro do objeto. */
    expect(r[0]?.apagada).toBe(true);
    expect(r[0]?.texto).toBeNull();
  });

  test("⚠️ e o ✓✓ que chega depois também vence", () => {
    /* O recibo de leitura muda DEPOIS do envio: sem a nova vencer, a mensagem
       ficaria com um ✓ para sempre e a paciente concluiria que a amiga nunca
       leu. */
    const antes = [m("x", 5, { souEu: true, lidaPelaOutra: false })];
    const depois = [m("x", 5, { souEu: true, lidaPelaOutra: true })];
    expect(juntarMensagens(antes, depois)[0]?.lidaPelaOutra).toBe(true);
  });

  test("ordena pelo tempo, mesmo com as páginas fora de ordem", () => {
    /* "Ver anteriores" junta na ordem inversa (antigas + atuais), e a sondagem
       junta na ordem normal. As duas passam pela mesma função. */
    expect(juntarMensagens([m("b", 10)], [m("a", 5), m("c", 20)]).map((x) => x.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("com a tela vazia, devolve a página como veio", () => {
    /* ⚠️ **`toEqual`, e NÃO `toBe`.** A primeira versão cobrava a IDENTIDADE do
       array, e com isso reprovava a versão sem o atalho — que devolve uma cópia
       ordenada e é comportamentalmente idêntica (o servidor já manda em ordem).
       Um teste que reprova código igualmente correto é um teste que ensina a
       relaxá-lo, e é assim que ele começa a mentir. O atalho fica por ser mais
       barato, não por ser exigido. */
    const novas = [m("a", 1), m("b", 2)];
    expect(juntarMensagens([], novas)).toEqual(novas);
  });

  test("nunca repete um id", () => {
    const r = juntarMensagens([m("a", 1), m("b", 2)], [m("b", 2), m("b", 2), m("c", 3)]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("⚠️ a URL da foto sobrevive à sondagem", () => {
  test("a URL antiga é preservada quando a nova também tem foto", () => {
    /* O servidor reassina toda foto a cada leitura, e a sondagem refaz a página
       de 6 em 6 segundos. URL nova é chave de cache nova: sem preservar, o
       navegador baixa a foto de novo para sempre numa conversa aberta. */
    const antes = [m("x", 5, { imagemUrl: "assinada-A" })];
    const depois = [m("x", 5, { imagemUrl: "assinada-B" })];
    expect(juntarMensagens(antes, depois)[0]?.imagemUrl).toBe("assinada-A");
  });

  test("⚠️ mas o RESTO do objeto continua vindo do novo", () => {
    /* É assim que a mensagem apagada pela outra pessoa chega como apagada e que
       o ✓✓ acende. Preservar o objeto inteiro seria congelar a conversa. */
    const antes = [m("x", 5, { imagemUrl: "A", souEu: true, lidaPelaOutra: false })];
    const depois = [m("x", 5, { imagemUrl: "B", souEu: true, lidaPelaOutra: true })];
    const r = juntarMensagens(antes, depois)[0];
    expect(r?.lidaPelaOutra).toBe(true);
    expect(r?.imagemUrl).toBe("A");
  });

  test("⚠️ e a foto NÃO é preservada quando a mensagem foi apagada", () => {
    /* Apagada não tem foto — manter a antiga deixaria na tela a imagem que a
       outra pessoa acabou de tirar do ar. */
    const antes = [m("x", 5, { imagemUrl: "A" })];
    const depois = [m("x", 5, { imagemUrl: null, apagada: true, texto: null })];
    expect(juntarMensagens(antes, depois)[0]?.imagemUrl).toBeNull();
  });

  test("uma mensagem só de texto não ganha foto do nada", () => {
    const antes = [m("x", 5, { imagemUrl: null })];
    const depois = [m("x", 5, { imagemUrl: "B" })];
    expect(juntarMensagens(antes, depois)[0]?.imagemUrl).toBe("B");
  });
});
