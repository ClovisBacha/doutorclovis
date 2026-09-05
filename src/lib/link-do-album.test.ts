/**
 * O LINK DO ÁLBUM NÃO PODE CARREGAR O TOKEN DO ACOMPANHANTE.
 *
 * ⚠️ **Os dois vivem na MESMA LINHA de `companion_invites` e têm privilégios
 * OPOSTOS.** `token` abre o painel do acompanhante E `getRecentPanicByToken`,
 * que devolve os SOS dos últimos 30 minutos **com latitude e longitude**.
 * `album_token` abre só o álbum.
 *
 * O link do álbum é o que ela cola no grupo da família — numa influenciadora,
 * para muito mais gente. Trocar um pelo outro publica a localização dela em
 * tempo real de emergência.
 *
 * O defeito real era de UMA palavra: o `select` pedia só `token`, então
 * `album_token` era sempre `undefined`, o `??` caía sempre no recuo, e o
 * comentário ao lado afirmava o contrário. Nada quebrava visivelmente — o
 * álbum simplesmente não abria (o servidor busca por `album_token`), e o GPS
 * ia junto no link.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

/**
 * O bloco que monta o link do álbum — do `from` até o `setShareUrl`.
 *
 * ⚠️ **Delimitado por ÂNCORAS, e nunca por uma janela de N caracteres.** Medir
 * distância é a armadilha que este repositório já pagou meia dúzia de vezes: a
 * janela passa a mentir no dia em que alguém acrescenta um comentário ou uma
 * linha no meio, e o teste fica verde sobre um defeito reintroduzido.
 */
function trechoDoAlbum(): string {
  const i = CONTA.indexOf('.from("companion_invites")');
  expect(i).toBeGreaterThan(-1);
  const j = CONTA.indexOf("setShareUrl(", i);
  expect(j).toBeGreaterThan(i);
  const fim = CONTA.indexOf("\n", j);
  return CONTA.slice(i, fim === -1 ? CONTA.length : fim);
}

describe("o link que vai para o grupo da família", () => {
  test("⚠️ `album_token` é PEDIDO no select", () => {
    /* Sem isto o campo é `undefined` e todo recuo abaixo vira o caminho de
       todo mundo — que foi exatamente o defeito. */
    expect(trechoDoAlbum()).toContain("album_token");
    expect(trechoDoAlbum()).not.toMatch(/\.select\("token"\)/);
  });

  test("⚠️ NUNCA cai no `token` do acompanhante", () => {
    /* O recuo perigoso tinha esta forma exata. Ele trocava um álbum que não
       abre por um vazamento de GPS — as duas pontas erradas de uma vez. */
    const t = trechoDoAlbum();
    expect(t).not.toMatch(/album_token\s*\?\?\s*invites\[0\]\.token/);
    expect(t).not.toMatch(/album\/\$\{invites\[0\]\.token\}/);
  });

  test("sem `album_token`, o link simplesmente não sai", () => {
    /* O álbum ficar indisponível até o SQL rodar é recuperável; o GPS
       espalhado no WhatsApp não é. */
    expect(trechoDoAlbum()).toMatch(/const doAlbum = invites\[0\]\.album_token/);
    expect(trechoDoAlbum()).toMatch(/doAlbum \?[\s\S]{0,80}: ""/);
  });

  test("⚠️ a tela EXPLICA quando não há link, em vez de calar", () => {
    /* Existe convite e não existe link: o silêncio lê como app quebrado, e ela
       tentaria mandar o outro link. */
    expect(CONTA).toContain("inviteToken && !shareUrl");
  });

  test("⚠️ a tela não ensina que os dois links são o mesmo", () => {
    /* A frase antiga dizia "a família acessa o álbum com o MESMO link do
       acompanhante" — o texto ensinava o defeito. */
    expect(CONTA).not.toContain("mesmo link do acompanhante");
  });

  test("o servidor continua buscando o álbum por `album_token`", () => {
    /* Se ele passasse a aceitar `token`, o vazamento voltaria pela outra
       ponta: o link do acompanhante abriria o álbum e ninguém veria problema
       em espalhá-lo. */
    /* ⚠️ **AS DUAS leituras do álbum, e não "existe alguma".** São dois
       handlers (`getFamilyAlbum` e o irmão que grava); com `toContain` solto,
       trocar UMA delas por `token` passava verde — a segunda ocorrência
       satisfazia a asserção. É a armadilha de "outra ocorrência do mesmo
       nome", pela enésima vez nesta base. */
    const familia = semComentarios(readFileSync("src/lib/family.functions.ts", "utf8"));
    const porAlbum = familia.match(/\.eq\("album_token", data\.token\)/g) ?? [];
    expect(porAlbum.length).toBeGreaterThanOrEqual(2);
    /* E nenhuma delas pode aceitar o token do acompanhante: se aceitasse, o
       vazamento voltaria pela outra ponta — o link do acompanhante abriria o
       álbum, e ninguém veria problema em espalhá-lo. */
    expect(familia).not.toMatch(/companion_invites[\s\S]{0,300}\.eq\("token", data\.token\)/);
  });
});
