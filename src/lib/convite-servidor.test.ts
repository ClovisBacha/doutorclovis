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
const TODO = semComentarios(FONTE);

/**
 * Só o corpo de UMA função de servidor.
 *
 * ⚠️ **Estas asserções varriam o arquivo INTEIRO, e quebraram no dia em que ele
 * ganhou a segunda função.** `perfilPublicoPorCodigo` lê `lmp_date`,
 * `birth_date` e `baby_name` de propósito — é a vitrine, e a semana passa pela
 * régua do selo. Sem o recorte, o teste que protege `quemConvidou` reprovaria
 * código correto do vizinho; e, pior, no dia seguinte alguém o afrouxaria e ele
 * pararia de proteger as duas. */
function corpoDe(nome: string): string {
  const i = TODO.indexOf(`export const ${nome} = createServerFn`);
  expect(i).toBeGreaterThan(-1);
  const resto = TODO.slice(i + 10);
  const j = resto.indexOf("\nexport ");
  return j === -1 ? resto : resto.slice(0, j);
}

const CODIGO = corpoDe("quemConvidou");

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
  test("⚠️ há limitador por IP, e ele vale nas DUAS funções", () => {
    /* A fábrica vive no topo do módulo, fora de qualquer corpo — por isso ela
       é procurada no arquivo, e o USO dentro de cada função. */
    expect(TODO).toContain("makeRateLimiter(");
    expect(CODIGO).toContain("limitado(clientIp(req))");
    expect(corpoDe("perfilPublicoPorCodigo")).toContain("limitado(clientIp(req))");
  });
});

describe("a vitrine pública", () => {
  const corpo = corpoDe("perfilPublicoPorCodigo");

  /* ⚠️ O portão é a régua pura, com os três motivos devolvendo a mesma coisa —
     perfil fechado, Modo Cuidado e código inexistente. */
  test("⚠️ o portão sai de `podeAbrirPerfilPublico`", () => {
    expect(corpo).toContain("podeAbrirPerfilPublico({");
    expect(corpo).toContain("perfilPublico: !!p?.perfil_publico");
    expect(corpo).toContain("emCuidado: !!p?.care_mode");
    expect(corpo).toContain("existe: !!p");
  });

  /* ⚠️ Sem `birth_date`, `computeGestation` conta para sempre e uma mãe que
     pariu na 39ª apareceria como "47 semanas" numa página aberta ao mundo — o
     mesmo defeito que a legenda sugerida teve. */
  test("⚠️ a semana passa pela régua do selo, com `birth_date` no select", () => {
    expect(corpo).toContain("birth_date");
    expect(corpo).toContain("seloDoPerfil(entradaDoSelo(");
    expect(corpo).toContain("today: hojeEmSaoPaulo()");
  });

  /* ⚠️ Só a camada `publico`, e o filtro está na CONSULTA: filtrar depois de
     ler seria trazer para a memória do servidor o que a página não pode
     mostrar. */
  test("⚠️ só posts públicos, e o filtro está na consulta", () => {
    expect(corpo).toContain('.eq("visibilidade", "publico")');
    expect(corpo).toContain('.is("arquivado_em", null)');
    expect(corpo).toContain("POSTS_NA_VITRINE");
  });

  /* ⚠️ Não existe contador público de seguidores neste app, e uma página aberta
     ao mundo é o último lugar onde ele poderia nascer. */
  test("⚠️ nenhum contador, nenhuma lista de quem segue", () => {
    expect(corpo).not.toContain("rede_seguidores");
    expect(corpo).not.toContain("seguidores");
    expect(corpo).not.toContain("count");
  });
});

describe("a função é pública de propósito", () => {
  /* Ela responde a quem tem o CÓDIGO — uma capacidade, não um segredo. Exigir
     sessão aqui mataria o recurso: quem chega pelo link ainda não tem conta. */
  test("não pede accessToken", () => {
    /* Vale para as DUAS: quem chega pelo link ainda não tem conta. */
    expect(TODO).not.toContain("accessToken");
    expect(TODO).not.toContain("pacienteDaSessao");
  });
});
