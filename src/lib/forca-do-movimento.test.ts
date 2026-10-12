import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { avaliar } from "./clinical.functions";
import { FORCA_PADRAO, NIVEIS_DE_FORCA, nivelDeForca } from "./forca-do-movimento";
import { semComentarios } from "./sem-comentarios";

const fonte = (p: string) => readFileSync(p, "utf8");

describe("o catálogo da força", () => {
  test("tem os três níveis do CHECK do banco, e só eles", () => {
    expect(NIVEIS_DE_FORCA.map((n) => n.valor)).toEqual([1, 2, 3]);
  });

  test("⚠️ o nível do MEIO não se anuncia — nem chip, nem frase", () => {
    /* "Como sempre" é o padrão. Escrevê-lo em toda linha do histórico e em
       toda linha do prontuário afogaria as duas únicas que carregam notícia. */
    const meio = nivelDeForca(2);
    expect(meio?.rotulo).toBe("Como sempre");
    expect(meio?.chip).toBeNull();
    expect(meio?.frase).toBeNull();
  });

  test("os dois extremos falam, nos dois vocabulários", () => {
    for (const valor of [1, 3]) {
      const n = nivelDeForca(valor);
      expect(typeof n?.chip).toBe("string");
      expect(typeof n?.frase).toBe("string");
    }
  });

  test("⚠️ fora do catálogo devolve null, NUNCA o padrão", () => {
    /* Quem escolhe o que exibir na ausência de escolha é a tela, num lugar
       só. Cravar o padrão aqui faria o leitor AFIRMAR uma escolha que ela não
       fez — é a mesma régua da leitura da sessão guardada. */
    for (const v of [null, undefined, 0, 4, -1, 2.5, Number.NaN]) {
      expect(nivelDeForca(v as number)).toBeNull();
    }
  });

  test("o padrão da tela é um nível que existe", () => {
    expect(nivelDeForca(FORCA_PADRAO)).not.toBeNull();
  });
});

describe("⚠️ os DOIS leitores leem o mesmo catálogo", () => {
  /* A força é escrita pela paciente e lida por ela E pelo médico. Duas tabelas
     de rótulo divergiriam no primeiro ajuste, e a divergência apareceria como
     o painel chamando de outra coisa o que ela marcou. */
  const paciente = semComentarios(fonte("src/components/kicks-tab.tsx"));
  /* ⚠️ **A RÉGUA MUDOU DE ARQUIVO, E A GARANTIA NÃO.** `resumo()` saiu de
       `prontuario-paciente.tsx` para `linha-do-tempo-clinica.ts` (set/2026)
       para poder ser EXECUTADA num teste em vez de lida por texto. O que estes
       testes cobram continua sendo o mesmo: o que o médico lê. */
  const medico = semComentarios(fonte("src/lib/linha-do-tempo-clinica.ts"));

  test("a tela dela monta os botões e o chip a partir do módulo", () => {
    expect(paciente).toContain("NIVEIS_DE_FORCA");
    expect(paciente).toContain("nivelDeForca(s.strength)");
    expect(paciente).toContain("forca-do-movimento");
  });

  test("⚠️ o prontuário LÊ a força — sem isto a coluna é escrita e nunca vista", () => {
    expect(medico).toContain("forca-do-movimento");
    expect(medico).toMatch(/nivelDeForca\(d\.forca\)/);
    /* E a linha existe mesmo quando só a força veio. */
    expect(medico).toMatch(/d\.chutes != null \|\| d\.forca != null/);
  });

  test("nenhum dos dois reescreve a régua com número solto", () => {
    for (const [nome, src] of [
      ["a tela dela", paciente],
      ["o prontuário", medico],
    ] as const) {
      expect(nome + ":" + src).not.toContain("strength === 1");
      expect(nome + ":" + src).not.toContain("strength === 3");
      expect(nome + ":" + src).not.toContain("forca === 3");
    }
  });
});

describe("⚠️ as DUAS montagens da view projetam a força", () => {
  /* Elas montam a MESMA `clinical_events`, e a migration tinha divergido: num
     banco erguido só por migrations a coluna era gravada, o chip aparecia na
     tela da paciente e o prontuário mostrava só a contagem — sem erro nenhum,
     porque a view continua válida. */
  const arquivos = {
    "APLICAR_EVENTOS_CLINICOS.sql": "supabase/APLICAR_EVENTOS_CLINICOS.sql",
    "migration de eventos clínicos": "supabase/migrations/20260731000000_eventos_clinicos.sql",
  };

  const blocoDeChutes = (caminho: string) => {
    const sql = fonte(caminho);
    const i = sql.indexOf("IF to_regclass('public.kick_sessions')");
    expect(i).toBeGreaterThan(-1);
    const j = sql.indexOf("END IF;", i);
    expect(j).toBeGreaterThan(i);
    return sql.slice(i, j);
  };

  for (const [nome, caminho] of Object.entries(arquivos)) {
    test(`${nome} põe 'forca' no jsonb`, () => {
      expect(blocoDeChutes(caminho)).toContain("'forca'");
    });

    test(`${nome} confere a coluna antes de citá-la`, () => {
      /* `k.strength` cru quebraria o CREATE VIEW INTEIRO num banco sem a
         coluna, e com ele as onze fontes. */
      const bloco = blocoDeChutes(caminho);
      expect(bloco).toContain("information_schema.columns");
      expect(bloco).toContain("'strength'");
      expect(bloco).toContain("NULL::smallint");
    });

    test(`${nome} declara forca_col antes de usar`, () => {
      const sql = fonte(caminho);
      expect(sql).toContain("forca_col text := 'NULL::smallint'");
      expect(sql.indexOf("forca_col text :=")).toBeLessThan(sql.indexOf("INTO forca_col"));
    });
  }
});

describe("o tipo do evento carrega a força", () => {
  test("`DadosEvento` tem o campo — sem ele o dado chega e é descartado", () => {
    const t = semComentarios(fonte("src/lib/clinical.functions.ts"));
    const i = t.indexOf("export type DadosEvento = {");
    expect(i).toBeGreaterThan(-1);
    const bloco = t.slice(i, t.indexOf("};", i));
    expect(bloco).toContain("forca?: number | null;");
  });
});

describe("⚠️ a linha do tempo da conta", () => {
  const conta = semComentarios(fonte("src/routes/_authenticated/minha-conta.tsx"));

  test("carrega a DURAÇÃO — ela é o dado clínico, não a contagem", () => {
    /* "10 chutes" em doze minutos e "10 chutes" em duas horas são notícias
       opostas, e a linha dizia exatamente a mesma coisa das duas. */
    expect(conta).toMatch(/chutes em \$\{min\} min/);
    expect(conta).not.toContain("chutes registrados");
  });

  test("lê a força pelo catálogo, e o nível do meio cala", () => {
    /* ⚠️ A âncora é o USO na linha, e não o nome da função em qualquer lugar
       do arquivo: a primeira versão deste teste ficava VERDE com a leitura
       apagada, porque a chamada aparecia duas vezes e a mutação só tirava
       uma. É a armadilha de "outra ocorrência do mesmo nome", de novo. */
    expect(conta).toContain("const forcaDaNoite = nivelDeForca(r.strength)?.frase;");
    expect(conta).toMatch(/detail: forcaDaNoite \?/);
  });

  test("⚠️ o select de `strength` tem DEGRAU — senão a coluna nova apaga a seção", () => {
    const i = conta.indexOf("async function lerChutesDaLinha");
    expect(i).toBeGreaterThan(-1);
    const corpo = conta.slice(i, conta.indexOf("\n}", i));
    expect(corpo).toContain("colunaAusente");
    /* O degrau de baixo NÃO pede a coluna nova. */
    expect(corpo).toContain('consulta("id, started_at, ended_at, kick_count")');
  });

  test("o ponto da linha segue a identidade azul da aba, e não o rosa do marco", () => {
    expect(conta).toMatch(/chutes: \{ dot: "bg-sky-\d+"/);
  });
});

describe("⚠️ a DURAÇÃO chega ao médico, e com ela a noite do alarme", () => {
  /* O que se mede aqui é o TEMPO ATÉ 10 MOVIMENTOS. Sem a duração, "4
     movimentos" no prontuário é indistinguível de uma sessão de cinco minutos
     E do cartão vermelho que a tela dela mostra a partir de duas horas. */

  test("duas horas sem chegar a dez fica GRAVE", () => {
    const { g, notas } = avaliar("movimento", { chutes: 4, duracao_min: 130 });
    expect(g).toBe("grave");
    expect(notas.join(" ")).toContain("4 movimentos em 130 min");
  });

  test("⚠️ a nota é a do MÉDICO, nunca a frase escrita para a paciente", () => {
    /* Repeti-la aqui seria o app mandando o médico ligar para o médico dele. */
    const { notas } = avaliar("movimento", { chutes: 4, duracao_min: 130 });
    expect(notas.join(" ").toLowerCase()).not.toContain("ligue para o seu médico");
    expect(notas.join(" ").toLowerCase()).not.toContain("você sentiu");
  });

  test("a sessão curta e a que chegou a dez continuam normais", () => {
    expect(avaliar("movimento", { chutes: 4, duracao_min: 8 }).g).toBe("normal");
    expect(avaliar("movimento", { chutes: 10, duracao_min: 130 }).g).toBe("normal");
  });

  test("⚠️ sem duração NÃO alarma — é o estado de todo banco antes do SQL novo", () => {
    expect(avaliar("movimento", { chutes: 4 }).g).toBe("normal");
  });

  test("⚠️ a régua é a de `sinais-clinicos`, e nunca um limite escrito aqui", () => {
    const t = semComentarios(fonte("src/lib/clinical.functions.ts"));
    const i = t.indexOf('if (especie === "movimento")');
    expect(i).toBeGreaterThan(-1);
    const bloco = t.slice(i, t.indexOf("\n  }", i));
    expect(bloco).toContain("sinalMovimentosReduzidos");
    /* Nenhum número clínico solto: os dois limites moram na régua. */
    expect(bloco).not.toMatch(/\b(120|10)\b/);
    /* ⚠️ A semana é NULA de propósito: a que se tem aqui é a de HOJE, e uma
       sessão de dois meses atrás aconteceu noutra. */
    expect(bloco).toContain("semanas: null");
  });

  test("as DUAS montagens da view projetam a duração", () => {
    for (const caminho of [
      "supabase/APLICAR_EVENTOS_CLINICOS.sql",
      "supabase/migrations/20260731000000_eventos_clinicos.sql",
    ]) {
      const sql = fonte(caminho);
      const i = sql.indexOf("IF to_regclass('public.kick_sessions')");
      const bloco = sql.slice(i, sql.indexOf("END IF;", i));
      expect(caminho).toBeTruthy();
      expect(bloco).toContain("'duracao_min'");
      /* Sessão aberta ou instante invertido viram NULL — "-3 min" no
         prontuário é pior que campo ausente. */
      expect(bloco).toContain("k.ended_at > k.started_at");
    }
  });

  test("o prontuário mostra a duração na mesma frase da contagem", () => {
    const medico = semComentarios(fonte("src/lib/linha-do-tempo-clinica.ts"));
    expect(medico).toMatch(/em \$\{d\.duracao_min\} min/);
  });
});
