/**
 * OS PAPÉIS DA TELA DE ENTRADA — e as duas armadilhas que já custaram caro aqui.
 *
 * O app tem quatro perfis, e três deles passam por `/auth`:
 * paciente e médico CRIAM CONTA; o acompanhante NÃO — ele entra pelo convite
 * que a gestante gera (`companion_invites` → `/acompanhar/<token>`).
 *
 * A influenciadora fica de fora de propósito: decisão do dono ("o perfil da
 * influenciadora deve ser unicamente através do site"), e a tela dela é
 * `/influenciadora`.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const auth = semComentarios("src/routes/auth.tsx");

describe("os três papéis do app", () => {
  test("paciente, médico e acompanhante — nesta ordem", () => {
    const i = auth.indexOf('key: "paciente"');
    const j = auth.indexOf('key: "medico"');
    const k = auth.indexOf('key: "acompanhante"');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(k).toBeGreaterThan(j);
  });

  test("⚠️ a influenciadora NÃO entra aqui", () => {
    /* Ela não é gestante, não tem semana, não tem bebê — e o app inteiro é
       construído em volta disso. A tela dela é `/influenciadora`, no site. */
    expect(auth).not.toContain("influenciadora");
    expect(auth).not.toContain("embaixadora");
  });
});

describe("⚠️ o formulário de senha, e o login do médico que quase quebrou", () => {
  const condicao = (() => {
    const i = auth.indexOf('mode === "login" || (mode === "signup"');
    return auth.slice(Math.max(0, i - 120), i + 90);
  })();

  test("o MÉDICO continua logando pelo formulário comum", () => {
    /**
     * ⚠️ ESTE TESTE EXISTE POR UM ERRO QUE EU COMETI E PEGUEI NA MEDIÇÃO.
     *
     * Ao excluir o acompanhante do formulário, colapsei a condição num
     * `role !== "medico"` solto. Isso tira o formulário de LOGIN do médico —
     * ele deixaria de conseguir entrar, e o painel do consultório ficaria
     * inalcançável. Só o CADASTRO dele tem fluxo próprio (CRM, perfil).
     *
     * A forma da condição é o que importa: `signup && role !== "medico"`, com o
     * `login` livre.
     */
    expect(condicao).toContain('mode === "login" || (mode === "signup" && role !== "medico")');
  });

  test("o acompanhante NUNCA vê campo de senha", () => {
    /* Ele não tem conta. Um campo de e-mail e senha ali prometeria um cadastro
       que não existe. */
    expect(condicao).toContain('role !== "acompanhante"');
  });
});

describe("o convite do acompanhante", () => {
  test("aceita link inteiro ou código solto, e limpa query e fragmento", () => {
    /* Quem recebe um link no WhatsApp copia o LINK. Pedir que ele extraia o
       código do fim da URL é atrito que faz o pai desistir. E link de WhatsApp
       vem com `?utm_...` grudado, que não bate com nenhuma linha da tabela. */
    const i = auth.indexOf("function tokenDoConvite");
    expect(i).toBeGreaterThan(-1);
    const corpo = auth.slice(i, auth.indexOf("function abrirConvite"));
    expect(corpo).toContain("split(/[?#]/)");
    expect(corpo).toContain('split("/")');
  });

  test("⚠️ não valida o token no cliente", () => {
    /* Quem confere é `getCompanionView`, no servidor, que já distingue
       "inválido" de "expirado". Uma segunda régua aqui só poderia divergir —
       e diria "código inválido" para um convite que o servidor aceitaria. */
    expect(auth).not.toContain("companion_invites");
  });

  test("vai para a rota pública do convite", () => {
    expect(auth).toContain("/acompanhar/${t}");
  });
});
