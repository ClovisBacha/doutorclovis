/**
 * A divisão de quem compra onde é uma regra de COMPLIANCE, não de produto:
 * errar para um lado reprova o app na loja, errar para o outro paga comissão
 * onde não precisava. Estes testes existem para a regra não voltar a divergir
 * entre telas — que foi exatamente o que aconteceu quando ela morava em seis
 * lugares.
 */

import { describe, expect, test } from "bun:test";
import { CANAL_DE, IAP_ATIVO, podeComprar, podeComprarAqui, type Produto } from "./canal-de-venda";

const TODOS: Produto[] = ["premium_paciente", "sementinhas", "plano_medico", "consulta"];

describe("a divisão", () => {
  test("o que a PACIENTE compra é vendido no app", () => {
    expect(CANAL_DE.premium_paciente).toBe("app");
    expect(CANAL_DE.sementinhas).toBe("app");
  });

  test("o plano do MÉDICO é vendido no site", () => {
    expect(CANAL_DE.plano_medico).toBe("site");
  });

  test("consulta é serviço do mundo real — nenhuma loja reivindica", () => {
    expect(CANAL_DE.consulta).toBe("qualquer");
    expect(podeComprar("consulta", "app").pode).toBe(true);
    expect(podeComprar("consulta", "site").pode).toBe(true);
  });

  test("todo produto tem canal declarado", () => {
    for (const p of TODOS) expect(CANAL_DE[p]).toBeTruthy();
  });
});

describe("o plano do médico nunca passa pela loja", () => {
  /* Se passasse, a comissão comeria a margem de um produto B2B que a loja não
     tem direito nenhum de cobrar. */
  test("bloqueado dentro do app, em qualquer estado do IAP", () => {
    const v = podeComprar("plano_medico", "app");
    expect(v.pode).toBe(false);
    if (!v.pode) expect(v.motivo).toBe("canal_errado");
  });

  test("liberado no site", () => {
    expect(podeComprar("plano_medico", "site").pode).toBe(true);
  });

  test("o texto manda para o site e lembra que é a mesma conta", () => {
    const v = podeComprar("plano_medico", "app");
    if (!v.pode) {
      expect(v.texto).toContain("site");
      expect(v.texto.toLowerCase()).toContain("mesma conta");
    }
  });
});

describe("a compra da paciente nunca passa pelo Stripe", () => {
  /* Este é o lado que REPROVA o app: conteúdo digital consumido dentro do app
     tem de passar pela loja. O checkout do Stripe é, por definição, o canal
     "site" — então bloquear aqui é o que impede a compra de escapar. */
  test("Premium e Sementinhas são bloqueados no canal site", () => {
    /* ⚠️ O que este teste garante é o BLOQUEIO (`pode === false`). O motivo
       depende de a loja estar ligada, e as duas respostas são corretas:
       · com IAP ligado, "canal_errado" — vá comprar no app;
       · com IAP desligado, "iap_indisponivel" — ainda não dá em canal nenhum,
         que é a verdade e é o que a paciente de hoje precisa ler.
       A versão anterior cravava "canal_errado" e reprovava a correção que fez a
       frase parar de mandar a paciente procurar o app numa loja onde ele não
       está. Teste que cobra o TEXTO de um estado transitório vira âncora. */
    for (const p of ["premium_paciente", "sementinhas"] as Produto[]) {
      const v = podeComprar(p, "site");
      expect(v.pode).toBe(false);
      if (!v.pode) expect(v.motivo).toBe(IAP_ATIVO ? "canal_errado" : "iap_indisponivel");
    }
  });

  test("⚠️ e a paciente de HOJE nunca é mandada a uma loja onde o app não está", () => {
    /**
     * `ehNativo()` é falso para todas as pacientes de hoje (o app é um PWA),
     * então o canal delas é "site". Com a ordem antiga, a tela dizia "esta
     * compra acontece dentro do aplicativo, pela loja da Apple ou do Google"
     * — logo abaixo de "A compra ainda não está aberta", e sobre um app que
     * não está em loja nenhuma. Quem lesse ia procurar e não ia achar.
     */
    if (IAP_ATIVO) return;
    const v = podeComprar("sementinhas", "site");
    expect(v.pode).toBe(false);
    if (!v.pode) {
      expect(v.texto.toLowerCase()).not.toContain("apple");
      expect(v.texto.toLowerCase()).not.toContain("google");
    }
  });
});

describe("enquanto o IAP não existe", () => {
  test("a compra da paciente fica indisponível, no canal certo", () => {
    for (const p of ["premium_paciente", "sementinhas"] as Produto[]) {
      const v = podeComprar(p, "app");
      if (IAP_ATIVO) {
        expect(v.pode).toBe(true);
      } else {
        expect(v.pode).toBe(false);
        if (!v.pode) expect(v.motivo).toBe("iap_indisponivel");
      }
    }
  });

  test("a mensagem não culpa a paciente nem oferece caminho proibido", () => {
    const v = podeComprar("premium_paciente", "app");
    if (!v.pode) {
      /* "compre pelo site" dentro do app é exatamente o que a loja proíbe. */
      expect(v.texto.toLowerCase()).not.toContain("site");
      expect(v.texto.toLowerCase()).not.toContain("navegador");
    }
  });

  test("o plano do médico NÃO é afetado pelo IAP", () => {
    /* O médico compra no site, e o site não depende de loja nenhuma. */
    expect(podeComprar("plano_medico", "site").pode).toBe(true);
  });
});

describe("o atalho do cliente concorda com a regra", () => {
  test("estaNoApp mapeia para o canal certo", () => {
    for (const p of TODOS) {
      expect(podeComprarAqui(p, true)).toEqual(podeComprar(p, "app"));
      expect(podeComprarAqui(p, false)).toEqual(podeComprar(p, "site"));
    }
  });
});
