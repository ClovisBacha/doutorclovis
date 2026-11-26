import { describe, expect, test } from "bun:test";
import { pedeSocorro, RESPOSTA_DO_SOCORRO } from "@/lib/socorro-na-nutricao";
import { socorroDeExemplo } from "./exemplo-da-bancada";
import { FAIXAS_DA_NUTRICAO, FAIXAS_DO_POS_PARTO } from "@/lib/nutricao-da-semana";
import { fraseDoTopo, semGeneroDoBebe } from "./frase-do-topo";
import { perguntasProntas } from "./perguntas-prontas";
import { MEIO_DO_SOCORRO_NO_APP, RESPOSTA_DO_SOCORRO_NO_APP } from "./socorro";

describe("o socorro no app", () => {
  test("o texto do site ainda tem a forma esperada (3 parágrafos, o do meio fala do botão)", () => {
    const p = RESPOSTA_DO_SOCORRO.split("\n\n");
    expect(p.length).toBe(3);
    expect(p[1]).toMatch(/botão vermelho/);
  });

  test("não promete médico (o app não tem médico vinculado) e manda ligar 192", () => {
    expect(RESPOSTA_DO_SOCORRO_NO_APP).not.toMatch(/médico/i);
    expect(RESPOSTA_DO_SOCORRO_NO_APP).toContain("192");
    expect(RESPOSTA_DO_SOCORRO_NO_APP).toContain(MEIO_DO_SOCORRO_NO_APP);
    expect(RESPOSTA_DO_SOCORRO_NO_APP).toMatch(/Não espere resposta por aqui/);
  });

  test("a régua do site acusa os sinais e deixa passar as perguntas de comida", () => {
    expect(pedeSocorro("estou sangrando muito")).toBe(true);
    expect(pedeSocorro("minha pressão deu 16 por 11")).toBe(true);
    expect(pedeSocorro("Posso comer sushi?")).toBe(false);
    expect(pedeSocorro("Tenho arroz, feijão e ovo — o que faço?")).toBe(false);
    expect(pedeSocorro("O que comer para enjoo?")).toBe(false);
  });

  test("a pergunta de exemplo da bancada é mesmo um socorro (a bancada mostra o que a régua faz)", () => {
    expect(pedeSocorro(socorroDeExemplo()[0].texto)).toBe(true);
  });

  test("nenhuma pergunta pronta dispara o socorro", () => {
    for (const p of [...perguntasProntas(false), ...perguntasProntas(true)]) expect(pedeSocorro(p)).toBe(false);
  });
});

describe("Modo Cuidado", () => {
  const gestante = { lmp_date: "2026-04-01" };
  const hoje = new Date(2026, 9, 2);

  test("sem frase da semana (ela fala do bebê)", () => {
    expect(fraseDoTopo(gestante, false, hoje)).not.toBeNull();
    expect(fraseDoTopo(gestante, true, hoje)).toBeNull();
    expect(fraseDoTopo({ birth_date: "2026-09-20" }, true, hoje)).toBeNull();
  });

  test("pós-parto usa a frase do pós-parto, nunca a da semana", () => {
    const f = fraseDoTopo({ birth_date: "2026-09-20", lmp_date: "2025-12-01" }, false, hoje);
    expect(f).not.toBeNull();
  });

  test("sem data, sem frase", () => {
    expect(fraseDoTopo({}, false, hoje)).toBeNull();
    expect(fraseDoTopo(null, false, hoje)).toBeNull();
  });

  test("nenhuma frase do topo crava o gênero do bebê (varre todas as faixas do site)", () => {
    const todas = [...FAIXAS_DA_NUTRICAO, ...FAIXAS_DO_POS_PARTO];
    expect(todas.length).toBeGreaterThan(5);
    for (const f of todas) {
      for (const t of [semGeneroDoBebe(f.titulo), semGeneroDoBebe(f.texto)]) {
        expect(t).not.toMatch(/(?<![\p{L}])(ele|dele|nele|ela|dela)(?![\p{L}])/iu);
      }
    }
    expect(semGeneroDoBebe("Ele está fazendo o próprio sangue")).toBe("O bebê está fazendo o próprio sangue");
    expect(semGeneroDoBebe("A quantidade de sangue dele e a sua")).toBe("A quantidade de sangue do bebê e a sua");
    /* Palavras que CONTÊM "ele" ficam: elegante, tele, vele. */
    expect(semGeneroDoBebe("Um prato elegante e o telefone")).toBe("Um prato elegante e o telefone");
    /* E a frase que a tela recebe já vem trocada. */
    const f = fraseDoTopo(gestante, false, hoje);
    expect(`${f?.titulo} ${f?.texto}`).not.toMatch(/(?<![\p{L}])(ele|dele)(?![\p{L}])/iu);
  });

  test("as perguntas prontas do luto não falam de enjoo", () => {
    expect(perguntasProntas(true).join(" ")).not.toMatch(/enjoo|bebê|gesta/i);
  });
});
