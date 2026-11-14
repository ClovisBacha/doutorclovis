/**
 * ⚠️ O GRUPO NÃO AVISAVA NINGUÉM — e por isso era um canal onde ninguém
 * responde.
 *
 * Uma mensagem para até sete pessoas fazia exatamente duas escritas (a linha e
 * o `ultima_em`) e parava. Sem push, e sem acender o emblema da aba Mensagens
 * — que conta só `rede_conversas`, os pares de duas. A bolinha do grupo existe,
 * e vive DENTRO da lista de grupos: ou seja, o aviso só chegava a quem já tinha
 * ido olhar por conta própria.
 *
 * O direct de DUAS já mandava push desde o primeiro dia. O de OITO, não.
 *
 * ⚠️ **E o push respeita `silenciado_em`, por membro.** Este é o mesmo canal
 * por onde chega o aviso de emergência: um push de grupo impossível de calar é
 * como uma paciente desliga a notificação do app inteiro — e leva o SOS junto.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const GRUPO = semComentarios(readFileSync("src/lib/grupo.functions.ts", "utf8"));

/** O corpo de `mandarNoGrupo`, até a próxima função exportada. */
const MANDAR = (() => {
  const i = GRUPO.indexOf("export const mandarNoGrupo");
  expect(i).toBeGreaterThan(-1);
  const j = GRUPO.indexOf("\nexport ", i + 1);
  return GRUPO.slice(i, j === -1 ? undefined : j);
})();

describe("a mensagem de grupo avisa", () => {
  test("⚠️ manda push", () => {
    expect(MANDAR).toContain("sendPushToUser");
  });

  test("⚠️ e ele é CALÁVEL — `silenciado_em` por membro", () => {
    /* Sem a coluna de silêncio este bloco não deveria existir. */
    expect(MANDAR).toContain("silenciado_em");
    expect(MANDAR).toMatch(/!m\.silenciado_em/);
  });

  test("⚠️ quem escreveu não recebe o próprio aviso", () => {
    expect(MANDAR).toMatch(/m\.quem_id !== eu/);
  });

  test("⚠️ quem SAIU do grupo não recebe", () => {
    /* A linha fica (as mensagens dela são das outras); o aviso, não. */
    const i = MANDAR.indexOf("rede_grupo_membros");
    expect(i).toBeGreaterThan(-1);
    expect(MANDAR.slice(i, i + 400)).toMatch(/\.is\("saiu_em", null\)/);
  });

  test("⚠️ o TEXTO não vai no push", () => {
    /* Ele chega na tela de bloqueio, e quem estiver ao lado lê — a mesma
       decisão do resumo semanal da rede. */
    expect(MANDAR).toMatch(/body: "Nova mensagem no grupo"/);
    expect(MANDAR).not.toMatch(/body: texto/);
  });

  test("⚠️ o aviso vem DEPOIS da gravação, e não a derruba", () => {
    /* Avisar sobre uma mensagem que não gravou manda sete pessoas abrirem uma
       conversa vazia; e um push que falha não pode apagar a mensagem. */
    expect(MANDAR.indexOf("sendPushToUser")).toBeGreaterThan(
      MANDAR.indexOf(".insert({ grupo_id: data.grupoId"),
    );
    expect(MANDAR).toMatch(/catch \{[\s\S]{0,80}\}\s*\}\)\(\);/);
  });

  test("⚠️ é `await`, nunca `void` — no servidor a invocação congela", () => {
    /* Esta base já perdeu três recursos para a promessa que ninguém guarda. */
    expect(MANDAR).toMatch(/await \(async \(\) => \{/);
    expect(MANDAR).not.toMatch(/void \(async \(\) => \{/);
  });
});

describe("o emblema da aba Mensagens conta o grupo", () => {
  const REDE = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));
  const CONTAR = (() => {
    const i = REDE.indexOf("const contarNaoLidas");
    expect(i).toBeGreaterThan(-1);
    return REDE.slice(i, REDE.indexOf("}, []);", i));
  })();

  test("⚠️ soma as duas fontes", () => {
    expect(CONTAR).toContain("meusGrupos");
    expect(CONTAR).toMatch(/deConversas \+ deGrupos/);
  });

  test("⚠️ uma falha numa fonte não zera a outra", () => {
    /* Com um `if (r.ok && g.ok)`, uma leitura de grupos instável apagaria o
       emblema das conversas — e ela deixaria de abrir a mensagem que existe. */
    expect(CONTAR).toMatch(/if \(r\.ok \|\| g\.ok\)/);
  });
});
