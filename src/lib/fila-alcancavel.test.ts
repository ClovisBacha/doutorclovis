/**
 * A FILA DE DENÚNCIAS TEM DE ESTAR ONDE QUEM PODE LÊ-LA CHEGA.
 *
 * ⚠️ **Era uma corrente fechada, e as duas pontas estavam certas sozinhas.**
 *
 *   · `denunciasAbertas` só admite quem está em `ADMIN_EMAILS` — correto: a
 *     fila mistura o texto denunciado de pacientes de vários médicos, e
 *     "qualquer médico" ali seria vazamento.
 *   · `/painel` REDIRECIONA o super-admin para `/admin` — correto: a conta da
 *     plataforma não é médico, e o lugar dela é o console.
 *
 * Somadas: a única pessoa autorizada a ver a fila era expulsa da única tela que
 * a mostrava. Toda denúncia de paciente entrava num lugar inalcançável, com o
 * app prometendo "fica registrada para a gente olhar".
 *
 * É a mesma família das sete funções de servidor sem chamador — só que aqui o
 * chamador existia e ficava do lado errado da porta.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const ADMIN = semComentarios(readFileSync("src/routes/_authenticated/admin.tsx", "utf8"));
const PAINEL = semComentarios(readFileSync("src/routes/_authenticated/painel.tsx", "utf8"));
const SERVIDOR = semComentarios(readFileSync("src/lib/caixinha.functions.ts", "utf8"));

describe("a fila mora onde o super-admin chega", () => {
  test("⚠️ `/admin` desenha a fila", () => {
    expect(ADMIN).toContain("<FilaDeDenuncias />");
    expect(ADMIN).toContain('key: "moderacao"');
  });

  test("⚠️ `/painel` NÃO a desenha mais", () => {
    /* Deixar as duas seria pior que uma: o médico comum veria uma caixa que o
       servidor recusa, e o vazio dela leria como "não há denúncias". */
    expect(PAINEL).not.toContain("<FilaDeDenuncias");
    expect(PAINEL).not.toContain('from "@/components/fila-de-denuncias"');
  });

  test("⚠️ o portão do servidor continua sendo `ADMIN_EMAILS`", () => {
    /* Se alguém "consertasse" a corrente afrouxando o servidor, o vazamento
       entraria pela outra ponta: a fila carrega texto denunciado de pacientes
       de vários médicos. */
    expect(SERVIDOR).toContain("ADMIN_EMAILS");
  });

  test("⚠️ e `/painel` continua mandando o super-admin para `/admin`", () => {
    /* Este redirect é o que fecha a corrente. Se ele sumir, a fila volta a
       ficar num lugar que quem pode lê-la não visita. */
    expect(PAINEL).toMatch(/isSuperAdmin[\s\S]{0,200}replace\("\/admin"\)/);
  });
});

/**
 * ─── OS NÚMEROS DA COMUNIDADE, pela MESMA porta ─────────────────────────────
 *
 * ⚠️ A mesma forma do defeito da fila, pago uma segunda vez:
 * `NumerosDaComunidade` montava SÓ no /painel — e o painel redireciona o
 * super-admin para /admin antes de desenhar qualquer coisa. O dono era a única
 * pessoa sem os números da aba mais movimentada do app, numa tela cujo
 * comentário dizia existir "para o dono responder 'ela está viva?'".
 *
 * E a bancada da moderação SEMPRE montou números + fila juntos: ela aprovava
 * uma composição que a produção nunca teve — bancada certa, produção errada, a
 * direção inversa da mentira usual.
 */
describe("os números chegam ao super-admin", () => {
  const ADMIN = readFileSync("src/routes/_authenticated/admin.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  test("⚠️ a aba Moderação monta números E fila", () => {
    const i = ADMIN.indexOf('tab === "moderacao"');
    expect(i).toBeGreaterThan(-1);
    /* Contenção: os dois entre esta condição e a próxima aba. */
    const fim = ADMIN.indexOf('tab === "', i + 10);
    const bloco = ADMIN.slice(i, fim > 0 ? fim : i + 1200);
    expect(bloco).toContain("<NumerosDaComunidade />");
    expect(bloco).toContain("<FilaDeDenuncias />");
  });

  test("o /painel continua montando — os ADMIN_EMAILS médicos vivem lá", () => {
    const PAINEL = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
    expect(PAINEL).toContain("<NumerosDaComunidade />");
  });
});
