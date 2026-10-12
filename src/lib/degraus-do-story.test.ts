import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { storiesCrus, inserirDescendo, semAsColunas } from "./rede-social.functions";

/**
 * ⚠️ **DOIS VAZAMENTOS DE VISIBILIDADE EM `rede_stories`, e os dois estavam de
 * pé com a suíte inteira verde.**
 *
 * 1. **A fileira nunca leu `visibilidade`.** A escada de leitura era escrita à
 *    mão, quatro degraus, e nenhum pedia a coluna: todos cravavam
 *    `visibilidade: "seguidores"`. O story marcado "só amigas" era entregue, na
 *    fileira, a TODA seguidora — ela abria, lia e via a foto. O portão existia
 *    em `storyQueEuVejo`, que é o caminho da AÇÃO (votar, reagir, denunciar);
 *    o caminho de VER ficou de fora.
 *
 * 2. **`publicarStory` gravava DUAS VEZES.** Um `insert` com uma leva de
 *    colunas e, logo abaixo, outro com uma leva diferente, sem conferir se o
 *    primeiro tinha dado certo. Num banco com as duas levas os dois passavam —
 *    e a segunda cópia, sem `visibilidade`, caía no `DEFAULT 'seguidores'`.
 *
 * ⚠️ O segundo é uma MINA: hoje não dispara porque o dono ainda não rodou
 * `APLICAR_CONTEUDO_DA_REDE.sql`. Ele se arma no instante em que ele rodar o
 * SQL que a documentação manda rodar.
 *
 * Estes testes RODAM as duas funções contra um Supabase de mentira. O defeito
 * só existe num banco que rodou meio SQL, então provar por leitura de fonte não
 * serve: o que importa é o que a função FAZ.
 */

/** Um Supabase de mentira que só aceita as colunas que ele conhece. */
function bancoQueLe(conhecidas: string[], valores: Record<string, unknown> = {}) {
  const pedidos: string[] = [];
  const linha: Record<string, unknown> = {};
  for (const c of conhecidas) linha[c] = c in valores ? valores[c] : `v:${c}`;
  return {
    pedidos,
    from() {
      return {
        select(cols: string) {
          pedidos.push(cols);
          const faltando = cols
            .split(",")
            .map((c) => c.trim())
            .filter((c) => !conhecidas.includes(c));
          /* O Postgres reprova o select INTEIRO por uma coluna que falta. */
          if (faltando.length) {
            return { data: null, error: { code: "42703", message: `sem ${faltando[0]}` } };
          }
          return { data: [{ ...linha }], error: null };
        },
      };
    },
  };
}

/** Um Supabase de mentira que CONTA quantos inserts de verdade gravaram. */
function bancoQueGrava(conhecidas: string[]) {
  const gravadas: Record<string, unknown>[] = [];
  const tentativas: Record<string, unknown>[] = [];
  return {
    gravadas,
    tentativas,
    from() {
      return {
        insert(linha: Record<string, unknown>) {
          tentativas.push(linha);
          const faltando = Object.keys(linha).filter((c) => !conhecidas.includes(c));
          const responde = () =>
            faltando.length
              ? { data: null, error: { code: "PGRST204", message: `sem ${faltando[0]}` } }
              : (gravadas.push(linha), { data: { id: `id-${gravadas.length}` }, error: null });
          return { select: () => ({ maybeSingle: async () => responde() }) };
        },
      };
    },
  };
}

/** As colunas da leitura — DERIVADAS do fonte, nunca escritas à mão. */
const TODAS = (() => {
  const fonte = readFileSync("src/lib/rede-social.functions.ts", "utf8");
  const i = fonte.indexOf("const COLUNAS_DO_STORY =");
  const lista = fonte.slice(i, fonte.indexOf(";", i));
  return [...lista.matchAll(/"([^"]+)"/g)]
    .flatMap((m) => m[1].split(","))
    .map((c) => c.trim())
    .filter(Boolean);
})();

const ler = (sb: any) => storiesCrus(sb, (b: any) => b);

describe("⚠️ a fileira LÊ a camada do story", () => {
  test("⚠️ `visibilidade` está na lista de colunas — o vazamento era ela faltar", () => {
    expect(TODAS).toContain("visibilidade");
  });

  test("⚠️ com a coluna no banco, quem manda é o BANCO e não um padrão cravado", async () => {
    const sb = bancoQueLe(TODAS, { visibilidade: "amigas" });
    const [l] = await ler(sb);
    /* Antes desta correção o valor era SEMPRE "seguidores", viesse o que
       viesse — e é isso que entregava o story fechado a toda seguidora. */
    expect(l.visibilidade).toBe("amigas");
  });

  test("banco em dia: UMA consulta só, e o vídeo vem junto", async () => {
    const sb = bancoQueLe(TODAS);
    const [l] = await ler(sb);
    expect(sb.pedidos.length).toBe(1);
    expect(l.video_path).toBe("v:video_path");
  });

  test("⚠️ SEM a coluna do vídeo (o banco do dono hoje) a CAMADA sobrevive", async () => {
    const sb = bancoQueLe(
      TODAS.filter((c) => !["video_path", "sensivel", "motivo_sensivel"].includes(c)),
      { visibilidade: "amigas" },
    );
    const [l] = await ler(sb);
    expect(l.video_path).toBeNull();
    /* O degrau de cima não pode levar a camada junto: seria o vazamento de
       volta, agora por causa de uma coluna que ninguém ainda usa. */
    expect(l.visibilidade).toBe("amigas");
    /* E `sensivel` cai para `false`, nunca `null`: a coluna é booleana. */
    expect(l.sensivel).toBe(false);
  });

  test("⚠️ sem a coluna da CAMADA, todo story vale `seguidores` — o estado de antes", async () => {
    const sb = bancoQueLe(TODAS.filter((c) => !["visibilidade", "destacado_em"].includes(c)));
    const [l] = await ler(sb);
    /* Fechar por não saber esconderia da fileira o story de quem sempre o viu:
       aqui o lado seguro é o comportamento anterior ao recurso. */
    expect(l.visibilidade).toBe("seguidores");
  });

  test("⚠️ nenhum degrau pede uma coluna INVENTADA", async () => {
    /* A invariante que vale para qualquer ordem de lista: descendo a escada
       inteira, tudo que se pede continua sendo uma coluna de verdade. */
    const sb = bancoQueLe([]);
    await ler(sb);
    for (const pedido of sb.pedidos) {
      for (const c of pedido.split(",").map((x: string) => x.trim())) {
        expect(TODAS).toContain(c);
      }
    }
  });
});

describe("⚠️ gravar desce a escada — e grava UMA vez só", () => {
  const cheia = { autor_id: "a", imagem_path: "p", visibilidade: "amigas", imagens: ["p"] };
  const DEGRAUS = [
    { aviso: "carrossel", colunas: ["imagens"], exigido: false },
    { aviso: "camada", colunas: ["visibilidade"], exigido: false },
  ];

  test("⚠️ BANCO EM DIA GRAVA EXATAMENTE UM — era isto que dobrava", async () => {
    const sb = bancoQueGrava(Object.keys(cheia));
    const r = await inserirDescendo(sb, "rede_stories", cheia, DEGRAUS);
    expect(r).toEqual({ ok: true, id: "id-1" });
    expect(sb.gravadas.length).toBe(1);
    /* E a única linha gravada leva a camada que ela escolheu. */
    expect(sb.gravadas[0].visibilidade).toBe("amigas");
  });

  test("⚠️ banco atrasado grava UM também — nunca um por degrau", async () => {
    const sb = bancoQueGrava(["autor_id", "imagem_path"]);
    const r = await inserirDescendo(sb, "rede_stories", cheia, DEGRAUS);
    expect(r.ok).toBe(true);
    expect(sb.gravadas.length).toBe(1);
    /* Tentou três vezes, gravou uma: é a escada funcionando. */
    expect(sb.tentativas.length).toBe(3);
  });

  test("⚠️ descer por cima de uma ESCOLHA dela é recusa, nunca um ok mudo", async () => {
    const sb = bancoQueGrava(["autor_id", "imagem_path"]);
    const r = await inserirDescendo(sb, "rede_stories", cheia, [
      { aviso: "carrossel", colunas: ["imagens"], exigido: false },
      /* Ela marcou "só amigas": publicar sem a camada é publicar ABERTO. */
      { aviso: "camada", colunas: ["visibilidade"], exigido: true },
    ]);
    expect(r).toEqual({ ok: false, motivo: "sem_suporte" });
    expect(sb.gravadas.length).toBe(0);
  });

  test("nem o piso responde: `banco`, e nada gravado", async () => {
    const sb = bancoQueGrava([]);
    const r = await inserirDescendo(sb, "rede_stories", cheia, DEGRAUS);
    expect(r).toEqual({ ok: false, motivo: "banco" });
    expect(sb.gravadas.length).toBe(0);
  });
});

describe("⚠️ `publicarStory` usa a escada única", () => {
  const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
  /* ⚠️ Sem os comentários: a prosa deste arquivo CITA o defeito que ele
     descreve, e um `not.toContain` sobre o fonte cru ficaria vermelho
     exatamente por causa da explicação. Já aconteceu dez vezes nesta base. */
  const semProsa = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const corpo = (() => {
    const i = semProsa.indexOf("export const publicarStory");
    return semProsa.slice(i, semProsa.indexOf("\nexport ", i + 10));
  })();

  test("o corpo existe (a âncora não silenciou o teste)", () => {
    expect(corpo.length).toBeGreaterThan(500);
  });

  test("⚠️ NENHUM `.insert(` solto — só a escada, que grava uma vez", () => {
    expect(corpo).toContain('inserirDescendo(sb, "rede_stories"');
    expect(corpo).not.toContain('.from("rede_stories").insert(');
  });

  test("⚠️ a camada e o vídeo são degraus EXIGIDOS", () => {
    const semEspaco = corpo.replace(/\s+/g, " ");
    expect(semEspaco).toContain(
      'colunas: ["visibilidade"], exigido: camada !== VISIBILIDADE_DO_STORY_PADRAO',
    );
    expect(semEspaco).toContain("exigido: !!video || sensivel");
  });

  test("⚠️ o caminho do vídeo é conferido contra a PASTA dela", () => {
    /* Sem isto, um corpo montado à mão penduraria no story dela o vídeo de
       outra paciente. */
    expect(corpo).toContain("caminhoEhDoDono(data.video.caminho, eu)");
  });
});

describe("⚠️ `semAsColunas` — a fronteira que impede uma coluna INVENTADA", () => {
  /* ⚠️ **Este é o par adversarial, e ele existe porque a escada do story era
     segura por ACIDENTE.** `motivo_sensivel` calha de ser a última coluna da
     lista dela, então o padrão sem fronteira não achava a vírgula que o arma —
     e a mutação que tira o `\b` passava verde. A prova mora aqui, sobre a
     função, onde a ordem é escolhida para expor o defeito. */
  test("⚠️ tirar `sensivel` NÃO come o miolo de `motivo_sensivel`", () => {
    const lista = "id, lugar, sensivel, motivo_sensivel, video_legenda, ciclo";
    expect(semAsColunas(lista, ["sensivel"])).toBe(
      "id, lugar, motivo_sensivel, video_legenda, ciclo",
    );
  });

  test("⚠️ e nunca produz `motivo_video_legenda`", () => {
    const lista = "id, lugar, sensivel, motivo_sensivel, video_legenda, ciclo";
    expect(semAsColunas(lista, ["sensivel"])).not.toContain("motivo_video_legenda");
  });

  test("tira do meio, do fim e do começo", () => {
    expect(semAsColunas("a, b, c", ["b"])).toBe("a, c");
    expect(semAsColunas("a, b, c", ["c"])).toBe("a, b");
    expect(semAsColunas("a, b, c", ["a"])).toBe("b, c");
  });

  test("⚠️ nunca deixa vírgula solta — o `select` viraria erro de SINTAXE", () => {
    /* Um `, ` sobrando faria o recuo passar a falhar por sintaxe em vez de por
       coluna, e a escada inteira desceria ao piso. */
    for (const alvo of ["a", "b", "c"]) {
      const r = semAsColunas("a, b, c", [alvo]);
      expect(r).not.toMatch(/,\s*$/);
      expect(r).not.toMatch(/^\s*,/);
      expect(r).not.toContain(",,");
    }
  });

  test("coluna que não está na lista não muda nada", () => {
    expect(semAsColunas("a, b", ["z"])).toBe("a, b");
  });
});
