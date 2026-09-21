/**
 * O PAINEL DE SOS DIZIA "NENHUMA EMERGÊNCIA" QUANDO NÃO CONSEGUIA OLHAR.
 *
 * `pacientesAtuais` (em `acionamentos.functions.ts`) lia
 * `patient_profiles.select("id").eq("doctor_id", ...)` sem conferir o
 * `error`. `supabase-js` não lança — devolve `{ data, error }` — e um `data`
 * nulo por timeout/RLS/rede virava `[]` do mesmo jeito que "este médico não
 * tem paciente nenhuma". `listarAcionamentos` e `acionamentosDaPaciente`
 * liam esse array vazio e devolviam `vazio` (`ok: true`), e o painel — o
 * único caminho pelo qual o médico sabe que uma paciente apertou o botão de
 * emergência, com a localização e a ficha clínica congelada — apagava o
 * aviso em vez de dizer que não conseguiu confirmar.
 *
 * A mesma classe já tinha sido fechada em `clinical.functions.ts`
 * (`pacientesAtuaisComEstado`) e em `secondbrain.functions.ts`
 * (`listUnansweredQuestions`, para a fila de perguntas). Aqui ficou de pé.
 *
 * ⚠️ E o `if (error) return vazio` do `panic_events` tinha o mesmo problema,
 * um degrau abaixo: ele existia para degradar graciosamente quando uma
 * coluna/tabela ainda não chegou a este banco (migração pendente), mas
 * engolia QUALQUER erro — inclusive um timeout de verdade — do mesmo jeito.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const FONTE = semComentarios(readFileSync("src/lib/acionamentos.functions.ts", "utf8"));

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

/* ⚠️ O tipo de retorno é `Promise<{ ids: string[]; falhou: boolean }>` — a
   primeira `{` depois da assinatura é a do TIPO, não a do corpo. `"}> "`
   pula o fecho do tipo de retorno antes de procurar a chave real. */
const VINCULO = corpoDe(FONTE, "async function pacientesAtuaisComEstado(", ["}> "]);
const LISTAR = corpoDe(FONTE, "export const listarAcionamentos", [".handler(", "=>"]);
const DA_PACIENTE = corpoDe(FONTE, "export const acionamentosDaPaciente", [".handler(", "=>"]);

describe("pacientesAtuaisComEstado distingue vazio de falha", () => {
  test("o corpo existe e foi encontrado", () => {
    expect(VINCULO.length).toBeGreaterThan(0);
  });

  test("lê o `error` da leitura, e não só o `data`", () => {
    expect(VINCULO).toMatch(/const\s*\{\s*data,\s*error\s*\}\s*=\s*await/);
  });

  test("devolve `falhou` derivado do error — nunca um booleano fixo", () => {
    expect(VINCULO).toMatch(/falhou:\s*!!error/);
  });
});

describe("listarAcionamentos fecha a falha, não abre", () => {
  test("o handler existe e foi encontrado", () => {
    expect(LISTAR.length).toBeGreaterThan(0);
  });

  test("confere `vinculoFalhou` ANTES de decidir que a lista está vazia", () => {
    const iVinculo = LISTAR.indexOf("vinculoFalhou");
    const iAtuaisVazio = LISTAR.indexOf("atuais.length === 0");
    expect(iVinculo).toBeGreaterThan(-1);
    expect(iAtuaisVazio).toBeGreaterThan(-1);
    expect(iVinculo).toBeLessThan(iAtuaisVazio);
  });

  test("o vínculo falho devolve `ok: false`, nunca o `vazio` de `ok: true`", () => {
    expect(LISTAR).toMatch(/if\s*\(vinculoFalhou\)\s*\{[^}]*return falhouAoOlhar/);
  });

  test("`faltaNoBanco` separa migração pendente de falha de verdade", () => {
    expect(LISTAR).toContain("faltaNoBanco(error)");
    // A degradação legítima ainda existe — só não vale mais para qualquer erro.
    expect(LISTAR).toMatch(/if\s*\(faltaNoBanco\(error\)\)\s*return vazio/);
    expect(LISTAR).toContain("return falhouAoOlhar");
  });

  test("uma exceção não pega também fecha, e não abre", () => {
    // A última cláusula do try/catch da função não pode voltar a devolver `vazio`.
    const doCatch = LISTAR.slice(LISTAR.lastIndexOf("} catch"));
    expect(doCatch).toContain("falhouAoOlhar");
    expect(doCatch).not.toMatch(/catch[^{]*\{\s*return vazio;?\s*\}/);
  });
});

describe("acionamentosDaPaciente fecha a falha, não abre", () => {
  test("o handler existe e foi encontrado", () => {
    expect(DA_PACIENTE.length).toBeGreaterThan(0);
  });

  test("confere `vinculoFalhou` ANTES do `.includes(data.pacienteId)`", () => {
    const iVinculo = DA_PACIENTE.indexOf("vinculoFalhou");
    const iIncludes = DA_PACIENTE.indexOf(".includes(data.pacienteId)");
    expect(iVinculo).toBeGreaterThan(-1);
    expect(iIncludes).toBeGreaterThan(-1);
    expect(iVinculo).toBeLessThan(iIncludes);
  });

  test("o vínculo falho devolve `ok: false`, nunca o `vazio` de `ok: true`", () => {
    expect(DA_PACIENTE).toMatch(/if\s*\(vinculoFalhou\)\s*\{[^}]*return falhouAoOlhar/);
  });

  test("`faltaNoBanco` separa migração pendente de falha de verdade", () => {
    expect(DA_PACIENTE).toContain("faltaNoBanco(error)");
    expect(DA_PACIENTE).toMatch(/if\s*\(faltaNoBanco\(error\)\)\s*return vazio/);
  });

  test("uma exceção não pega também fecha, e não abre", () => {
    const doCatch = DA_PACIENTE.slice(DA_PACIENTE.lastIndexOf("} catch"));
    expect(doCatch).toContain("falhouAoOlhar");
    expect(doCatch).not.toMatch(/catch[^{]*\{\s*return vazio;?\s*\}/);
  });
});

describe("a função antiga não voltou por acidente", () => {
  test("`pacientesAtuais` (sem estado) não existe mais neste arquivo", () => {
    // A função velha ignorava o `error` por construção; se ela reaparecer,
    // algum chamador voltou a lê-la em vez de `pacientesAtuaisComEstado`.
    expect(FONTE).not.toMatch(/async function pacientesAtuais\(/);
  });
});
