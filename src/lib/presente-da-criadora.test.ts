/**
 * O PRESENTE DA CRIADORA — as travas do servidor.
 *
 * Lê o fonte, como `rede-social-servidor.test.ts` e `presentes-servidor.test.ts`.
 * O que estas travas protegem é DINHEIRO e VÍNCULO: sem elas, um uuid no corpo
 * do pedido presenteia qualquer paciente da plataforma gastando o bolso de
 * outra criadora, e a parede da economia se move sem ninguém decidir.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MESADA_DA_INFLUENCIADORA,
  PRESENTE_DA_INFLUENCIADORA,
  RAZAO_PRESENTE_INFLUENCIADORA,
} from "./economia-sementinhas";
import { chaveDoPresenteDaCriadora } from "./influenciadora.functions";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FONTE = semComentarios("src/lib/influenciadora.functions.ts");
const corpo = (nome: string) => {
  const i = FONTE.indexOf(`export const ${nome} =`);
  expect(i).toBeGreaterThan(-1);
  const resto = FONTE.slice(i + 10);
  const j = resto.indexOf("\nexport ");
  return (j === -1 ? resto : resto.slice(0, j)).replace(/\s+/g, " ");
};

describe("a chave do presente da criadora", () => {
  test("carrega código, paciente e CICLO", () => {
    // Sem o ciclo, o presente seria um só para sempre; com ele, é um por mês.
    const k = chaveDoPresenteDaCriadora("MARINA10", "pac-9", "2026-08");
    expect(k).toBe("criadora:MARINA10:pac-9:2026-08");
    expect(k.split(":")).toHaveLength(4);
  });

  test("ciclos diferentes são chaves diferentes", () => {
    expect(chaveDoPresenteDaCriadora("C", "p", "2026-08")).not.toBe(
      chaveDoPresenteDaCriadora("C", "p", "2026-09"),
    );
  });
});

describe("as travas de `presentearIndicada`", () => {
  const C = corpo("presentearIndicada");

  test("⚠️ o VÍNCULO é conferido no servidor, e é o do CÓDIGO", () => {
    // Sem isto, qualquer uuid no corpo do pedido presentearia qualquer paciente
    // da plataforma, gastando o bolso de outra criadora. E o grafo é o do
    // código, não o de seguir — que é assimétrico e unilateral.
    expect(C).toContain("(alvo as any).ref_code !== criadora.code");
    expect(C).toContain('motivo: "sem_vinculo"');
    expect(C).not.toContain("rede_seguidores");
  });

  test("⚠️ a criadora sai da SESSÃO, nunca de um código do cliente", () => {
    // Bastaria trocar uma letra na requisição para gastar o bolso de outra.
    expect(C).toContain("criadoraDaSessao(sb, supabaseAdmin, data.accessToken)");
    expect(C).not.toMatch(/data\.codigo/);
  });

  test("⚠️ Modo Cuidado não recebe presente", () => {
    // Confete para quem acabou de perder a gestação é o que o Modo Cuidado
    // existe para impedir.
    expect(C).toContain("(alvo as any).care_mode");
    expect(C).toContain('motivo: "indisponivel"');
  });

  test("⚠️ o bolso é RELIDO antes de gravar, e o teto é conferido", () => {
    const leu = C.indexOf('.eq("reason", RAZAO_PRESENTE_INFLUENCIADORA)');
    const conferiu = C.indexOf("> MESADA_DA_INFLUENCIADORA");
    const gravou = C.indexOf("grantSementinhas(");
    expect(leu).toBeGreaterThan(-1);
    expect(conferiu).toBeGreaterThan(leu);
    expect(gravou).toBeGreaterThan(conferiu);
  });

  test("⚠️ RELÊ depois de gravar — nunca soma por fé", () => {
    // `grantSementinhas` faz upsert com `ignoreDuplicates` e engole a falha:
    // somar por fé mostraria "+30 🌱" sobre uma linha que não existe. É o mesmo
    // defeito que `cobrarBonusDaDupla` teve.
    const gravou = C.indexOf("grantSementinhas(");
    const releu = C.indexOf('.eq("dedupe_key", dedupeKey)');
    expect(releu).toBeGreaterThan(gravou);
    expect(C).toContain("if (!conferindo) return");
  });

  test("⚠️ NADA de push — nem aqui, nem em lote", () => {
    // Duzentos presentes seriam duzentos empurrões no mesmo canal por onde
    // chega o aviso de emergência. A entrega é o `AvisoDePresente` do Caminho.
    expect(C).not.toContain("sendPushToUser");
    expect(FONTE).not.toContain("sendPushToUser");
  });
});

describe("a lista de indicadas não é uma lista de pacientes", () => {
  const C = corpo("minhasIndicadas");

  test("⚠️ só o PRIMEIRO NOME sai — nada clínico", () => {
    expect(C).toContain('.select("id, display_name, care_mode")');
    expect(C).toContain(".split(/\\s+/)[0]");
    for (const proibido of ["lmp_date", "due_date", "baby_name", "avatar_url", "birth_date"]) {
      expect(C).not.toContain(proibido);
    }
  });

  test("⚠️ Modo Cuidado some da lista, sem anunciar", () => {
    expect(C).toContain("!l.care_mode");
  });

  test("⚠️ quem já recebeu é lido pelo `user_id` de QUEM RECEBE", () => {
    // `presenteadasNoCiclo` errou exatamente aqui uma vez: filtrou pelo id de
    // quem DÁ, nenhuma linha casava, e o botão reabilitava a cada visita.
    expect(C).toContain('.in("user_id", ids)');
    expect(C).toContain("l.user_id");
  });
});

describe("os números vieram da régua da economia", () => {
  test("não há valor escrito à mão no servidor", () => {
    // Duas cópias divergem no primeiro ajuste, e aqui a divergência é dinheiro.
    expect(FONTE).toContain("PRESENTE_DA_INFLUENCIADORA");
    expect(FONTE).toContain("MESADA_DA_INFLUENCIADORA");
    expect(FONTE).not.toMatch(/amount: 30\b/);
  });

  test("o bolso reparte em pelo menos dez presentes", () => {
    expect(MESADA_DA_INFLUENCIADORA / PRESENTE_DA_INFLUENCIADORA).toBeGreaterThanOrEqual(10);
  });

  test("a razão é própria, e não a da amiga", () => {
    expect(RAZAO_PRESENTE_INFLUENCIADORA).not.toBe("presente-de-amiga");
  });
});
