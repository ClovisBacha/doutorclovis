/**
 * O LINK DE INDICAÇÃO — e o defeito que estes testes existem para não deixar
 * voltar.
 *
 * A aba das Amigas tinha um botão "Convidar" que mandava `${origin}/auth`. O
 * grafo de amizade deste app É o de indicação (`referred_by`), então a amiga
 * que entrasse por aquele link criava a conta e **nunca virava amiga dela**:
 * não aparecia na lista, não dava para formar dupla, não dava para presentear,
 * e as 100 🌱 não eram pagas a ninguém.
 *
 * O botão da tela cujo assunto inteiro é trazer alguém era o único caminho do
 * app que não trazia — e falhava em silêncio, semanas depois, sem nada a que
 * apontar.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PARAM_INDICACAO, SITE, linkDeIndicacao, mensagemDeConvite } from "./indicacao";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("o link carrega o código", () => {
  test("monta com o parâmetro que o app captura", () => {
    expect(linkDeIndicacao("ABC2345", "https://x.com")).toBe("https://x.com/?amiga=ABC2345");
  });

  test("normaliza caixa e espaço — o código veio de um campo, não de um cofre", () => {
    expect(linkDeIndicacao("  abc2345 ", "https://x.com")).toBe("https://x.com/?amiga=ABC2345");
  });

  test("sem origem, cai no domínio de produção", () => {
    expect(linkDeIndicacao("ABC2345")).toBe(`${SITE}/?amiga=ABC2345`);
  });

  test("barra sobrando na origem não vira barra dupla", () => {
    expect(linkDeIndicacao("ABC2345", "https://x.com/")).toBe("https://x.com/?amiga=ABC2345");
  });

  test("⚠️ sem código válido devolve null, nunca um link «quase certo»", () => {
    /* Um convite sem indicação é indistinguível de um bom para quem manda e
       para quem recebe. Só o vínculo não acontece — e ninguém descobre. */
    for (const ruim of [
      "",
      "  ",
      null,
      undefined,
      "AB",
      "COM ESPACO",
      "ABCDEFGHIJKLM",
      "abc-123",
    ]) {
      expect(`${ruim}: ${linkDeIndicacao(ruim as string | null, "https://x.com")}`).toBe(
        `${ruim}: null`,
      );
    }
  });
});

describe("⚠️ o parâmetro é o MESMO que o app captura", () => {
  test("`__root.tsx` lê exatamente `PARAM_INDICACAO`", () => {
    /* `?amiga=` está escrito na captura, na atribuição e nas telas que montam o
       link. Trocar o nome em três lugares e esquecer o quarto quebraria a
       indicação inteira sem erro nenhum: todo mundo continuaria funcionando, e
       nenhuma amiga seria atribuída de novo. */
    const root = semComentarios("src/routes/__root.tsx");
    expect(root).toContain(`get("${PARAM_INDICACAO}")`);
  });
});

describe("⚠️ as DUAS telas usam o mesmo construtor", () => {
  const amigas = semComentarios("src/components/amigas.tsx");
  const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");

  test("a aba das Amigas convida COM o código", () => {
    expect(amigas).toContain("linkDeIndicacao(codigo");
    /* E busca o código — sem isso a chamada acima passa `null` para sempre. */
    expect(amigas).toContain("getReferral");
  });

  test("⚠️ e NUNCA mais manda `/auth` puro", () => {
    /**
     * Este é o defeito, escrito como assertion. `/auth` é o login: um link
     * para lá cria a conta e não liga ninguém a ninguém.
     */
    expect(amigas).not.toContain("/auth`");
    expect(amigas).not.toContain('"/auth"');
  });

  test("sem código o convite NÃO sai", () => {
    /* Mandar assim gasta o convite dela — ela só tem a atenção da amiga uma
       vez — e o vínculo some sem deixar rastro. */
    const i = amigas.indexOf("async function convidar");
    const corpo = amigas.slice(i, i + 900);
    expect(corpo).toContain("if (!url)");
    expect(corpo).toContain("return;");
  });

  test("o cartão do Cantinho monta pelo mesmo lugar", () => {
    /* As duas telas montavam o link à mão, e a mais nova divergiu. */
    expect(conta).toContain("linkDeIndicacao(");
    expect(conta).not.toContain("`/?amiga=${code}`");
  });

  test("as duas compartilham o TEXTO do convite", () => {
    /* Não é estética: o texto é o que faz a amiga abrir, e ele carrega o link
       dentro. Duas versões divergem no primeiro ajuste. */
    expect(amigas).toContain("mensagemDeConvite(");
    expect(conta).toContain("mensagemDeConvite(");
  });

  test("⚠️ o que vai para a área de transferência é o TEXTO, não a URL crua", () => {
    /* Colado no WhatsApp, um "https://..." sozinho não diz de quem veio nem o
       que é — e é aí que a amiga decide se abre. */
    expect(amigas).toContain("clipboard.writeText(texto)");
    expect(conta).toContain("clipboard.writeText(msg)");
  });
});

describe("a mensagem do convite", () => {
  test("carrega o link dentro", () => {
    const l = linkDeIndicacao("ABC2345", "https://x.com")!;
    expect(mensagemDeConvite(l)).toContain(l);
  });

  test("⚠️ não promete desfecho clínico", () => {
    /**
     * Quem recebe é uma amiga grávida, e o app é de gestação de ALTO RISCO.
     * "Vai dar tudo certo" numa mensagem que a própria paciente assina é a
     * promessa que este produto nunca faz — nem no mascote, nem na gratidão,
     * nem aqui.
     */
    const m = mensagemDeConvite("https://x.com/?amiga=ABC2345").toLowerCase();
    for (const proibido of ["tudo certo", "vai dar certo", "sem riscos", "seguro", "garant"]) {
      expect(`${proibido}: ${m.includes(proibido)}`).toBe(`${proibido}: false`);
    }
  });
});
