import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * AS TRAVAS DO "COMPARTILHE ESSA VITÓRIA", lidas na fonte.
 *
 * ⚠️ Sem comentários antes de procurar — a prosa que explica uma decisão contém
 * as palavras que o teste proíbe. Já custou um teste vermelho sobre código
 * certo e um verde sobre código errado.
 */
function semComentarios(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const FOLHA = semComentarios(readFileSync("src/components/compartilhar-momento.tsx", "utf8"));
const CAMINHO = semComentarios(readFileSync("src/components/gestacao-path.tsx", "utf8"));
const CARTAO = semComentarios(readFileSync("src/lib/share-card.ts", "utf8"));

describe("a folha de compartilhar", () => {
  /* ⚠️ O portão de Modo Cuidado mora em `momentoDe`, que devolve `null` — e a
     folha nem chega a existir. Um segundo portão aqui é a segunda régua que
     este projeto proíbe desde `humorDaJornada`. */
  test("⚠️ NÃO tem régua de luto própria — ela recebe o momento pronto", () => {
    expect(FOLHA).toContain("if (!momento) return null;");
    expect(FOLHA).not.toContain("careMode");
    expect(FOLHA).not.toContain("emCuidado");
  });

  /* ⚠️ A folha tem DUAS saídas e não publica nada sozinha. Publicar direto
     seria o app pondo no feed, com o nome dela, um texto que ela não escolheu. */
  test("⚠️ o caminho de dentro ABRE o compositor, nunca publica", () => {
    expect(FOLHA).toContain("aoPublicarNaComunidade");
    expect(FOLHA).not.toContain("publicarPost");
    expect(FOLHA).toContain("Nada é publicado sozinho");
  });

  /* ⚠️ `downloaded` precisa ser dito: sem a frase, o toque não produz nada
     visível e ela conclui que o botão quebrou. */
  test("⚠️ o caso 'baixou' vira mensagem na tela", () => {
    expect(FOLHA).toContain('r === "downloaded"');
    expect(FOLHA).toContain("Imagem salva");
  });

  /* ⚠️ Não existe emoji de compartilhar que renderize igual nos dois sistemas
     — mesma lição do 📞 preto no iOS. */
  test("⚠️ o ícone é desenhado, não emoji", () => {
    expect(FOLHA).toContain("<svg");
    for (const emoji of ["📤", "🔗", "↗️", "📲"]) expect(FOLHA).not.toContain(emoji);
  });
});

describe("o cartão", () => {
  /* ⚠️ Nada em `share-card.ts` escolhe o que dizer nem confere luto: quem faz
     as duas coisas é `momentoDe`. Uma segunda régua aqui faria o cartão dizer
     o que o app proíbe, no arquivo que o exporta para fora. */
  test("⚠️ desenha, e não decide", () => {
    expect(CARTAO).not.toContain("careMode");
    expect(CARTAO).not.toContain("emCuidado");
    expect(CARTAO).not.toContain("momentoDe(");
  });

  /* ⚠️ O código de indicação é uma capacidade, e o cartão vai para o story de
     quem quiser ver: impresso ali, seria a indicação dela distribuída a
     estranhos — e `attributeReferral` prende no PRIMEIRO código que chegar. */
  test("⚠️ a marca NÃO leva o código de indicação", () => {
    expect(CARTAO).toContain("obstetrica.com.br");
    expect(CARTAO).not.toContain("referral");
    expect(CARTAO).not.toContain("linkDeIndicacao");
    expect(CARTAO).not.toContain("amiga=");
  });

  /* ⚠️ `publicarPost` tem teto por imagem; o PNG deste cartão passa de 1 MB em
     base64 e a publicação seria recusada sobre um cartão que ela acabou de ver
     na tela. */
  test("⚠️ o que vai para o post é JPEG, e o que sai do app é PNG", () => {
    expect(CARTAO).toContain('toDataURL("image/jpeg"');
    expect(CARTAO).toContain('{ type: "image/png" }');
  });

  /* Cancelar a folha do sistema é decisão dela, não falha. */
  test("AbortError conta como compartilhado", () => {
    expect((CARTAO.match(/AbortError/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("⚠️ os três sprites do dia passaram a ter portão de luto", () => {
  /* O confete das cinco estrelas sempre teve `!careMode`; o check, a estrela e
     as cinco animadas nasciam em `handleEarn` sem portão nenhum — e quem
     acabou de perder a gestação via as estrelas acendendo. Achado pelo
     mapeamento, e consertado ANTES de pendurar o botão de compartilhar nelas. */
  test("⚠️ `handleEarn` confere `careMode` antes de acender qualquer sprite", () => {
    const i = CAMINHO.indexOf("setRecemFeito(key)");
    expect(i).toBeGreaterThan(-1);
    const antes = CAMINHO.slice(Math.max(0, i - 400), i);
    expect(antes).toContain("if (!careMode) {");
  });

  test("e o `setCincoNovas` / `setEstrelaNova` ficam DENTRO do portão", () => {
    const i = CAMINHO.indexOf("if (!careMode) {");
    const bloco = CAMINHO.slice(i, CAMINHO.indexOf("setTimeout(refresh, 500)", i));
    expect(bloco).toContain("setCincoNovas(true)");
    expect(bloco).toContain("setEstrelaNova(halves)");
  });
});

describe("o bilhete que atravessa as abas", () => {
  /* ⚠️ Guarda o MOMENTO, nunca a imagem: uma foto em base64 encostaria na cota
     de ~5 MB do `localStorage`, e o que quebra quando ela estoura é a PRÓXIMA
     gravação de qualquer coisa — inclusive o `journey_state`. */
  test("⚠️ o Caminho guarda o momento, e não o cartão", () => {
    expect(CAMINHO).toContain("guardarMomentoParaPublicar(m)");
    expect(CAMINHO).not.toContain("momentoComoDataUrl");
  });
});
