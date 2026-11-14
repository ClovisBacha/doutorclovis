/**
 * O SOS NÃO VAZA PELO LINK DO ÁLBUM.
 *
 * `companion_invites` tem DOIS tokens na mesma linha, com privilégios
 * diferentes, e este teste existe para que ninguém os troque de lugar sem
 * perceber:
 *
 *   · `token`        — painel do acompanhante E os SOS dos últimos 30 minutos,
 *                      com latitude e longitude. Vai só para quem ela designar.
 *   · `album_token`  — só o álbum do bebê. É o link que ela manda para o grupo
 *                      da família — e, numa influenciadora, para muito mais.
 *
 * ⚠️ Isto já foi UM token só, e o comentário da criação do convite dizia com
 * todas as letras: "dá acesso ao painel do papai, álbum e alerta de pânico".
 * Era desenho conhecido; o que o tornou errado foi o álbum virar link de
 * circulação ampla.
 *
 * Pedido do dono, sobre uma influenciadora que chama seguidores para o app:
 * "se ela tiver um SOS, os seguidores dela NÃO têm que saber isso. Somente o
 * médico e o contato de emergência que ela deixou."
 *
 * Um teste de fonte porque o que precisa ser garantido é QUAL COLUNA cada
 * função consulta — um mock devolveria o que eu mandasse ele devolver.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const FAMILY = semComentarios(readFileSync("src/lib/family.functions.ts", "utf8"));
const ESCOLA = semComentarios(readFileSync("src/lib/escola.functions.ts", "utf8"));
const COMPANION = semComentarios(readFileSync("src/lib/companion.functions.ts", "utf8"));
const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

/** Trecho de uma função exportada, do nome até o próximo `export`. */
function corpoDe(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export const ${nome} =`);
  expect(i).toBeGreaterThan(-1);
  const resto = fonte.slice(i + 10);
  const j = resto.indexOf("\nexport ");
  return (j === -1 ? resto : resto.slice(0, j)).replace(/\s+/g, " ");
}

describe("o que o link do ÁLBUM abre", () => {
  test("⚠️ `getAlbumByToken` consulta `album_token`, nunca `token`", () => {
    const c = corpoDe(FAMILY, "getAlbumByToken");
    expect(c).toContain('.eq("album_token", data.token)');
    expect(c).not.toContain('.eq("token", data.token)');
  });

  test("⚠️ `addAlbumPostPublic` também", () => {
    // A leitura e a ESCRITA precisam do mesmo recorte: separar uma e esquecer
    // a outra deixaria o token antigo continuar postando no álbum — e é
    // exatamente o tipo de correção que já precisou ser feita duas vezes neste
    // arquivo (`select("*")` em `getPublicNameSession` e no irmão).
    const c = corpoDe(FAMILY, "addAlbumPostPublic");
    expect(c).toContain('.eq("album_token", data.token)');
    expect(c).not.toContain('.eq("token", data.token)');
  });
});

describe("o que o link do ACOMPANHANTE abre", () => {
  test("⚠️ `getRecentPanicByToken` continua no `token` de maior privilégio", () => {
    // Se um dia alguém "uniformizar" isto para `album_token`, a localização
    // dela numa emergência volta a sair no link do grupo da família.
    const c = corpoDe(ESCOLA, "getRecentPanicByToken");
    expect(c).toContain('.eq("token", data.token)');
    expect(c).not.toContain("album_token");
  });

  test("`getCompanionView` idem", () => {
    const c = corpoDe(COMPANION, "getCompanionView");
    expect(c).toContain('.eq("token", data.token)');
    expect(c).not.toContain("album_token");
  });
});

describe("a criação do convite", () => {
  test("⚠️ gera OS DOIS tokens, com valores diferentes", () => {
    // Um convite criado com um valor só reabriria o buraco na linha nova, e o
    // SQL de rotação só conserta as linhas antigas.
    expect(CONTA).toContain('const token = crypto.randomUUID().replace(/-/g, "");');
    expect(CONTA).toContain('const albumToken = crypto.randomUUID().replace(/-/g, "");');
    expect(CONTA).toContain("album_token: albumToken,");
  });

  test("⚠️ o link do álbum NUNCA carrega o token do acompanhante", () => {
    /* ⚠️ **ESTA ASSERÇÃO JÁ MENTIU, e ela guardava exatamente este defeito.**
     *
     * Ela era `slice(i, i + 90)).toContain("album_token")` — e o código
     * defeituoso era `${invites[0].album_token ?? invites[0].token}`, que
     * CONTÉM a string "album_token". O teste passava verde sobre o vazamento
     * que ele existia para impedir: o link que ela cola no grupo da família
     * carregando o token que abre o SOS com latitude e longitude.
     *
     * Duas lições, e as duas já estão catalogadas no CLAUDE.md:
     * "outra ocorrência do mesmo nome" e "cobre a GARANTIA, nunca a grafia".
     * Aqui elas se somaram — e o custo foi um teste com o nome certo dando
     * cobertura a um defeito de privacidade em produção.
     *
     * Hoje o que se cobra é o que importa: o `token` do acompanhante não pode
     * chegar à URL do álbum, por caminho nenhum. */
    const i = CONTA.indexOf("/album/${");
    expect(i).toBeGreaterThan(-1);
    const naUrl = CONTA.slice(i, CONTA.indexOf("`", i + 9));
    expect(naUrl).not.toMatch(/invites\[0\]\.token/);
    expect(naUrl).not.toMatch(/\?\?/);

    /* E o valor que ENTRA na URL tem de vir de `album_token`, direto. */
    const bloco = CONTA.slice(CONTA.indexOf('.from("companion_invites")'), i);
    expect(bloco).toMatch(/album_token/);
    expect(bloco).not.toMatch(/\.select\("token"\)/);
  });
});
