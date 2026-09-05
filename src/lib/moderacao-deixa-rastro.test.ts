/**
 * AS DUAS AÇÕES MAIS GRAVES DO ADMIN NÃO DEIXAVAM RASTRO.
 *
 * ⚠️ Trocar o plano de um médico, criar um cupom, cadastrar uma afiliada,
 * publicar um comunicado, ligar uma flag — **tudo isso grava em `audit_log`**.
 * **Tirar uma paciente da Comunidade e remover o que ela publicou, não.**
 *
 * Isso importa em três momentos concretos:
 *
 *   · quando ela pergunta por que sumiu — e ninguém sabe quem decidiu, quando,
 *     nem por quê;
 *   · quando é preciso reverter — e não há o que reverter para;
 *   · numa disputa, onde **a ausência de linha é lida como "a ação não
 *     aconteceu"** — que é exatamente o que o log existe para desmentir. O
 *     próprio `audit.server` já diz isso por escrito: "um log de auditoria que
 *     não grava é PIOR que nenhum".
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const MOD = semComentarios(readFileSync("src/lib/moderacao.functions.ts", "utf8"));
const REDE = semComentarios(readFileSync("src/lib/rede-social.functions.ts", "utf8"));

function corpoDe(fonte: string, assinatura: string, depois: readonly string[] = []): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  let de = i;
  for (const marca of depois) {
    de = fonte.indexOf(marca, de);
    if (de < 0) return "";
    de += marca.length;
  }
  const abre = fonte.indexOf("{", de);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

const SUSPENDER = corpoDe(MOD, "export const suspenderDaComunidade", [".handler(", "=>"]);
const RESOLVER = corpoDe(REDE, "export const resolverDenunciaDaRede", [".handler(", "=>"]);

describe("suspender uma conta deixa linha", () => {
  test("⚠️ `writeAudit` é chamada", () => {
    expect(SUSPENDER.length).toBeGreaterThan(0);
    expect(SUSPENDER).toContain('import("./audit.server")');
    expect(SUSPENDER).toContain("await writeAudit(");
  });

  test("⚠️ a ação distingue SUSPENDER de REATIVAR", () => {
    /* Uma linha só para as duas faria o log dizer que a conta foi suspensa
       quando ela foi devolvida — e é justamente a reversão que alguém vai
       querer provar depois. */
    expect(SUSPENDER).toContain('"comunidade.suspender"');
    expect(SUSPENDER).toContain('"comunidade.reativar"');
  });

  test("⚠️ e o log vem DEPOIS da gravação", () => {
    /* Antes, ele registraria uma ação que pode não ter acontecido — que é a
       mesma mentira, na direção oposta. */
    const iUpdate = SUSPENDER.indexOf("rede_suspensa_em");
    const iLog = SUSPENDER.indexOf("await writeAudit(");
    expect(iUpdate).toBeGreaterThan(-1);
    expect(iLog).toBeGreaterThan(iUpdate);
  });

  test("o motivo entra no LOG, e some na reativação", () => {
    /* Reativar não tem motivo: carimbar o antigo faria o log afirmar que ela
       foi devolvida POR aquele motivo.

       ⚠️ Ancorado DENTRO da chamada de `writeAudit`: a mesma expressão aparece
       também no `update` da coluna, e sobre o corpo inteiro a mutação que a
       apagava DO LOG passava verde. Enésima vez que "outra ocorrência do mesmo
       texto" engana — aqui, o próprio script de mutação. */
    const iLog = SUSPENDER.indexOf("await writeAudit(");
    expect(iLog).toBeGreaterThan(-1);
    const chamada = SUSPENDER.slice(iLog, SUSPENDER.indexOf(");", iLog) + 2);
    expect(chamada).toContain('motivo: data.suspender ? (data.motivo ?? "outro") : null');
  });
});

describe("resolver uma denúncia deixa linha", () => {
  test("⚠️ `writeAudit` é chamada, com o DESFECHO", () => {
    /* Sem o desfecho a linha diria só "ele mexeu na denúncia" — e o que
       importa é se o conteúdo saiu do ar. */
    expect(RESOLVER.length).toBeGreaterThan(0);
    expect(RESOLVER).toContain("await writeAudit(");
    expect(RESOLVER).toContain('"moderacao.resolver"');
    expect(RESOLVER).toContain("desfecho,");
  });

  test("⚠️ e depois da gravação do desfecho", () => {
    const iUpdate = RESOLVER.indexOf("resolvido_em: agora, desfecho");
    const iLog = RESOLVER.indexOf("await writeAudit(");
    expect(iUpdate).toBeGreaterThan(-1);
    expect(iLog).toBeGreaterThan(iUpdate);
  });
});

describe("a fila da caixinha deixa a MESMA linha", () => {
  /* ⚠️ As duas filas vivem na mesma tela do admin. Deixar o resolver da rede
     com rastro e o da caixinha sem faria a ausência de linha da caixinha ser
     lida como "ninguém nunca olhou" — a mentira exata que o log desmente. */
  const CX = semComentarios(readFileSync("src/lib/caixinha.functions.ts", "utf8"));
  const RESOLVER_CX = corpoDe(CX, "export const resolverDenuncia ", [".handler(", "=>"]);

  test("⚠️ `writeAudit` é chamada, DEPOIS do update", () => {
    expect(RESOLVER_CX.length).toBeGreaterThan(0);
    expect(RESOLVER_CX).toContain('"moderacao.resolver_caixinha"');
    const iUpdate = RESOLVER_CX.indexOf("resolvido_em: new Date().toISOString()");
    const iLog = RESOLVER_CX.indexOf("await writeAudit(");
    expect(iUpdate).toBeGreaterThan(-1);
    expect(iLog).toBeGreaterThan(iUpdate);
  });
});

describe("o log continua sendo best-effort", () => {
  test("⚠️ `writeAudit` NUNCA lança — uma falha de log não derruba a ação", () => {
    /* Se ela passasse a lançar, uma tabela de auditoria ausente impediria
       suspender alguém — e a moderação pararia por causa do registro dela. */
    const audit = readFileSync("src/lib/audit.server.ts", "utf8");
    expect(audit).toContain("try {");
    expect(audit).toContain("} catch (e) {");
    expect(audit).not.toMatch(/throw /);
  });

  test("⚠️ mas a falha é REGISTRADA — silêncio total é o que a catraca proíbe", () => {
    const audit = readFileSync("src/lib/audit.server.ts", "utf8");
    expect(audit).toMatch(/\[auditoria\] ação NÃO registrada/);
  });
});
