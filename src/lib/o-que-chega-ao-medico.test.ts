/**
 * O QUE CHEGA AO MÉDICO NÃO PODE CHEGAR EM CÓDIGO.
 *
 * Três defeitos da MESMA família, e ela já tinha sido consertada duas vezes
 * nesta base — "intensidade 2" na contração e a força do movimento. As duas
 * vezes o conserto foi o mesmo: o catálogo único traduz, e o `??` deixa passar
 * cru o que saiu dele. Nas duas vezes o vizinho ficou de pé.
 *
 *   · A TRIAGEM chegava como ID. E não é cosmético: dois dos NOVE SINTOMAS
 *     VERMELHOS perdem o QUALIFICADOR no id — `movimentos` é o id de "Redução
 *     dos movimentos do bebê" e lê como uma menção neutra a movimentos;
 *     `contracoes` é o id de "Contrações regulares antes de 37 semanas". O
 *     médico podia ler a linha mais grave do prontuário como anotação banal.
 *   · O HUMOR chegava como EMOJI. Metade da tabela é indecifrável sem o
 *     catálogo: 💛 é "Conectada", e 😴 ("Cansada") não se distingue de 🥱 ("Com
 *     sono") a olho.
 *   · E o RASCUNHO DE ACHADOS — o texto que ele assina — nunca nomeava um
 *     único sintoma que ela marcou, em nenhum caso; e a triagem SEM nota
 *     desaparecia inteira dele.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import type { EventoClinico } from "./clinical.functions";
import { itensDaLinha } from "./linha-do-tempo-clinica";
import { resumoParaAchados } from "./resumo-da-consulta";
import { semComentarios } from "./sem-comentarios";

const ev = (p: Partial<EventoClinico>): EventoClinico =>
  ({
    fonte: "health_logs",
    fonte_id: Math.random().toString(36).slice(2),
    user_id: "u1",
    ocorrido_em: "2026-08-10T10:00:00Z",
    especie: "medida",
    dados: {},
    texto: null,
    gravidade: "normal",
    tratado_em: null,
    ...p,
  }) as EventoClinico;

const resumoDe = (e: EventoClinico) => itensDaLinha([e])[0]?.resumo ?? "";

describe("a triagem chega com o nome que ela marcou", () => {
  const triagem = (sintomas: string[], extra: Partial<EventoClinico> = {}) =>
    ev({
      fonte: "triage_logs",
      especie: "sintoma",
      gravidade: "grave",
      dados: { sintomas, nivel: "vermelho" },
      ...extra,
    });

  test("os dois sintomas que perdem o qualificador no id saem inteiros", () => {
    const r = resumoDe(triagem(["movimentos", "contracoes"]));
    expect(r).toContain("Redução dos movimentos do bebê");
    expect(r).toContain("Contrações regulares antes de 37 semanas");
    /* ⚠️ E o ID não sobra como ITEM da lista — "movimentos, Redução dos
       movimentos do bebê" seria a mesma linha duas vezes. A asserção é sobre
       o item, e não sobre a palavra: "movimentos" existe DENTRO do rótulo, e
       casar a palavra solta reprovaria o conserto. */
    const itens = r.split(" · ")[0].split(", ");
    expect(itens).not.toContain("movimentos");
    expect(itens).not.toContain("contracoes");
  });

  test("id fora do catálogo continua aparecendo CRU, nunca some da linha", () => {
    /* Triagem antiga, sintoma removido do catálogo: perder o sintoma é pior
       que mostrá-lo em código. */
    expect(resumoDe(triagem(["sangramento", "sintoma_que_saiu"]))).toContain("sintoma_que_saiu");
  });

  test("⚠️ a FONTE desempata: a pré-consulta guarda LABELS e não pode ser traduzida", () => {
    /* `preconsulta_forms.symptoms` guarda o texto em português, e a view
       projeta os dois vocabulários na MESMA chave. Passar este pelo `Map`
       seria passar um texto que ele não conhece. */
    const r = resumoDe(
      ev({
        fonte: "preconsulta_forms",
        especie: "consulta",
        dados: { sintomas: ["Náuseas ou vômitos", "Redução de movimentos"] },
      }),
    );
    expect(r).toContain("Náuseas ou vômitos");
    expect(r).toContain("Redução de movimentos");
  });
});

describe("o humor chega com a palavra que ela escolheu", () => {
  const humor = (mood: string) =>
    ev({ fonte: "journal_entries", especie: "humor", dados: { humor: mood } });

  test("o emoji do catálogo vira rótulo", () => {
    expect(resumoDe(humor("💛"))).toContain("Conectada");
    expect(resumoDe(humor("💛"))).not.toContain("💛");
    expect(resumoDe(humor("🙏"))).toContain("Gratidão");
  });

  test("emoji fora do catálogo continua aparecendo", () => {
    expect(resumoDe(humor("🫠"))).toContain("🫠");
  });
});

describe("o rascunho de achados nomeia os sintomas", () => {
  const AGORA = new Date("2026-08-20T12:00:00Z");
  const DESDE = "2026-08-01T10:00:00Z";
  const triagem = (sintomas: string[], texto: string | null) =>
    ev({
      fonte: "triage_logs",
      especie: "sintoma",
      gravidade: "grave",
      dados: { sintomas },
      texto,
    });

  test("⚠️ a triagem SEM nota não desaparece — e ela é a mais comum", () => {
    /* A nota é opcional (`note: z.string().optional()`). Uma triagem VERMELHA
       em que ela marcou sangramento e cefaleia e não escreveu nada sumia por
       completo do texto que o médico assina. */
    const r = resumoParaAchados([triagem(["sangramento", "cefaleia_visao"], null)], DESDE, AGORA);
    expect(r).toContain("Sangramento vaginal");
    expect(r).toContain("Dor de cabeça forte com visão turva");
  });

  test("com nota, os dois aparecem — o sintoma e o que ela escreveu", () => {
    const r = resumoParaAchados([triagem(["sangramento"], "começou de manhã")], DESDE, AGORA);
    expect(r).toContain("Sangramento vaginal");
    expect(r).toContain("começou de manhã");
  });

  test("o rótulo sai do MESMO catálogo da linha do tempo", () => {
    const r = resumoParaAchados([triagem(["movimentos"], null)], DESDE, AGORA);
    expect(r).toContain("Redução dos movimentos do bebê");
  });

  test("o teto de quatro fica — é um campo que ele lê em pé", () => {
    const muitas = Array.from({ length: 9 }, (_, i) => triagem(["sangramento"], `nota ${i}`));
    const r = resumoParaAchados(muitas, DESDE, AGORA);
    expect(r).toContain("nota 8");
    expect(r).not.toContain("nota 4");
  });
});

describe("o registro só com anotação entra na view", () => {
  /**
   * ⚠️ **O `OR` DA NOTA VAI NOS DOIS ARQUIVOS.** O `APLICAR_` e a migration
   * montam a MESMA view, e um deles divergindo é o defeito que a leva do
   * movimento já pagou: num banco erguido só por migrations o dado era gravado,
   * aparecia na tela dela, e o painel não recebia nada — sem erro nenhum,
   * porque a view continua válida.
   */
  for (const arquivo of [
    "supabase/APLICAR_EVENTOS_CLINICOS.sql",
    "supabase/migrations/20260731000000_eventos_clinicos.sql",
  ]) {
    test(`${arquivo}: a nota entra no critério`, () => {
      const sql = readFileSync(arquivo, "utf8");
      const i = sql.indexOf("FROM public.health_logs h");
      expect(i).toBeGreaterThan(-1);
      const ramo = sql.slice(i, sql.indexOf("$sql$,", i));
      expect(ramo).toContain("num_nonnulls(%s) > 0");
      /* ⚠️ O `btrim`/`nullif` importa: sem ele, uma nota de espaços em branco
         vira evento clínico. */
      expect(ramo).toMatch(/OR\s+nullif\(btrim\(h\.notes\), ''\) IS NOT NULL/);
    });
  }

  test("⚠️ e a aba do admin sabe perguntar por este caso", () => {
    /* Sem a conferência, o conserto é invisível: nada quebra, a view velha
       continua válida, e o recurso simplesmente não existe. */
    const regua = semComentarios(readFileSync("src/lib/saude-clinica.ts", "utf8"));
    const i = regua.indexOf('fonte: "health_logs"');
    expect(i).toBeGreaterThan(-1);
    const item = regua.slice(i, regua.indexOf("},", i));
    expect(item).toContain('colunaDaTabela: "notes"');
    expect(item).toContain('colunaNaView: "texto"');
    expect(item).toContain("exigeNulos");
  });

  test("⚠️ o filtro é COMPOSTO nos DOIS lados — sem isso a sonda falha ABERTA", () => {
    /* Contar só "tem nota" incluiria as linhas com número, que a view VELHA já
       devolve: a tela diria "ok" sobre ela. */
    const srv = semComentarios(readFileSync("src/lib/saude-clinica.functions.ts", "utf8"));
    const i = srv.indexOf("CAMPOS_CLINICOS.map(");
    expect(i).toBeGreaterThan(-1);
    const bloco = srv.slice(i, srv.indexOf("const [fontes, campos]", i));
    /* ⚠️ **CADA LADO É RECORTADO E COBRADO SOZINHO** — e a primeira versão
       desta asserção passou verde numa mutação que apagava o filtro da VIEW.
       Ela contava `exigeNulos` no bloco inteiro e pedia "pelo menos 2"; o termo
       aparece DUAS vezes em cada ramo (`"exigeNulos" in c ? c.exigeNulos`), de
       modo que apagar um ramo inteiro ainda deixava dois. É a armadilha de
       contar ocorrências num escopo largo, pela enésima vez nesta base. */
    const iTabela = bloco.indexOf("contar(sb, c.fonte,");
    const iView = bloco.indexOf('contar(sb, "clinical_events"');
    expect(iTabela).toBeGreaterThan(-1);
    expect(iView).toBeGreaterThan(iTabela);
    const ramoTabela = bloco.slice(iTabela, iView);
    const ramoView = bloco.slice(iView);
    for (const ramo of [ramoTabela, ramoView]) {
      expect(ramo).toContain("exigeNulos");
      /* Não basta NOMEAR a lista: ela tem de virar filtro. */
      expect(ramo).toMatch(/for \(const col of[\s\S]*?\.is\(/);
    }
    /* ⚠️ E o ALVO da consulta é derivado, não a chave de `dados` cravada — a
       nota vive numa COLUNA da view. Ancorar em `colunaNaView` solto no ramo
       passava verde, porque o `onde:` do retorno também o cita. */
    expect(ramoView).toMatch(/const alvo =[^;]*colunaNaView/);
  });
});
