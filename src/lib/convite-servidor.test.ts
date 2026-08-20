import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * AS TRAVAS DE "QUEM CONVIDOU", lidas na fonte.
 *
 * ⚠️ Sem comentários antes de procurar — a prosa que EXPLICA uma decisão
 * contém, por definição, as palavras que o teste proíbe. Já custou um teste
 * vermelho sobre código certo, e um teste verde sobre código errado.
 */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const FONTE = readFileSync("src/lib/convite.functions.ts", "utf8");
const CODIGO = semComentarios(FONTE);

describe("o que é lido do banco", () => {
  /* ⚠️ O que não é lido não vaza. Semana, DPP, nome do bebê e sobrenome ficam
     de fora por construção — o `select` não os pede. */
  test("⚠️ o select da paciente pede TRÊS colunas, e nenhuma é clínica", () => {
    expect(CODIGO).toContain('.select("display_name, avatar_url, care_mode")');
    for (const proibida of [
      "lmp_date",
      "due_date",
      "baby_name",
      "reference_weeks",
      "doctor_id",
      "phone",
      "birth_date",
    ]) {
      expect(CODIGO).not.toContain(proibida);
    }
  });

  /* ⚠️ `care_mode` é conferido e NUNCA devolvido. */
  test("⚠️ `care_mode` entra só para ser conferido", () => {
    expect(CODIGO).toContain("if ((perfil as any).care_mode) return { quem: null };");
    /* E a resposta é a MESMA de "código não existe" — nenhum motivo, nenhuma
       distinção que entregue por eliminação o que aconteceu com ela. */
    expect(CODIGO).not.toContain('motivo: "cuidado"');
    expect(CODIGO).not.toContain("emCuidado:");
  });

  /* ⚠️ Só o PRIMEIRO nome sai daqui, e quem corta é a régua pura. */
  test("⚠️ o nome passa por `primeiroNome`", () => {
    const chamadas = (CODIGO.match(/primeiroNome\(/g) ?? []).length;
    expect(chamadas).toBe(2);
    expect(CODIGO).not.toContain("display_name as string");
  });
});

describe("a busca pelo código", () => {
  /* ⚠️ `eq`, nunca `ilike`: `%` e `_` são curinga no PostgREST, e um único
     caractere devolveria o primeiro nome de uma paciente qualquer. E a limpeza
     acontece ANTES, na régua pura. */
  test("⚠️ é `eq` e nunca `ilike`", () => {
    expect(CODIGO).toContain('.eq("referral_code", codigo)');
    expect(CODIGO).toContain('.eq("code", codigo)');
    expect(CODIGO).not.toContain(".ilike(");
  });

  test("⚠️ o código é limpo ANTES de qualquer consulta", () => {
    const i = CODIGO.indexOf("codigoLimpo(data.codigo)");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(CODIGO.indexOf(".from("));
  });

  /* ⚠️ Criadora desligada não atribui nada: anunciá-la seria prometer o que o
     servidor nega. */
  test("⚠️ só afiliada ATIVA aparece", () => {
    expect(CODIGO).toContain("!(linha as any).active");
  });

  /* ⚠️ O limitador é a defesa contra varredura de códigos curtos. */
  test("⚠️ há limitador por IP", () => {
    expect(CODIGO).toContain("makeRateLimiter(");
    expect(CODIGO).toContain("limitado(clientIp(req))");
  });
});

describe("a função é pública de propósito", () => {
  /* Ela responde a quem tem o CÓDIGO — uma capacidade, não um segredo. Exigir
     sessão aqui mataria o recurso: quem chega pelo link ainda não tem conta. */
  test("não pede accessToken", () => {
    expect(CODIGO).not.toContain("accessToken");
    expect(CODIGO).not.toContain("pacienteDaSessao");
  });
});
