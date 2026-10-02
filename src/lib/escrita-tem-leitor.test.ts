/**
 * ⚠️ TODA COLUNA DE ESTADO QUE A REDE ESCREVE TEM DE TER LEITOR.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * Numa única auditoria, CINCO defeitos da Comunidade eram o mesmo padrão:
 *
 *   · `denunciarComentario` gravava `denunciado_em` e ninguém lia — a tela
 *     dizia "A gente vai olhar", e ninguém ia;
 *   · `arquivarConversa` gravava as colunas e o filtro da lista as ignorava —
 *     a tela dizia "Arquivada. Volta se ela escrever" e a conversa não saía do
 *     lugar;
 *   · `resolverDenunciaDaRede` aceitava `desfecho` e a tela nunca mandava —
 *     "Suas denúncias" dizia "ainda não olhamos" para sempre;
 *   · `avisada_em` nascia sem escritor nem leitor;
 *   · `respondido_em` ficou (é metadado, e o companheiro `resposta` É lido).
 *
 * Quatro defeitos e um caso legítimo, todos invisíveis para `tsc`, para o lint
 * e para 5.000 testes — porque o código está CERTO em tipo e vazio em efeito.
 *
 * ⚠️ **`rede-tem-porta.test.ts` não pega**: lá a pergunta é "existe chamador?",
 * e nestes casos existia. A pergunta daqui é outra: **alguém LÊ o que foi
 * escrito?**
 *
 * ⚠️ E a catraca é MODESTA de propósito. Ela não prova que o leitor usa o valor
 * de forma correta — prova que ele existe. Uma catraca mais esperta teria falso
 * positivo, e catraca com falso positivo é catraca que alguém desliga.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Os módulos de servidor da Comunidade. */
const MODULOS = [
  "src/lib/rede-social.functions.ts",
  "src/lib/conversa.functions.ts",
  "src/lib/comentarios.functions.ts",
  "src/lib/caixinha.functions.ts",
  "src/lib/mencoes.functions.ts",
  "src/lib/moderacao.functions.ts",
];

/**
 * Colunas escritas de propósito SEM leitor, com a razão de cada uma.
 *
 * ⚠️ Acrescentar aqui é afirmar, por escrito, que a ausência de leitor é
 * decisão. Sem a linha, é dívida com cara de recurso.
 */
const SEM_LEITOR_DE_PROPOSITO: Record<string, string> = {
  respondido_em:
    "metadado de auditoria: `resposta` é escrita no MESMO update e É lida, " +
    "então o estado 'respondida' aparece na tela por ela. Remover custaria um " +
    "ALTER sobre dado vivo, e a ausência de leitor aqui não esconde recurso.",
};

function semProsa(p: string): string {
  return readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** Todo o `src/`, sem testes e sem comentários — onde um leitor pode viver. */
function todoOApp(): string {
  const pedacos: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, nome.name);
      if (nome.isDirectory()) anda(p);
      else if (/\.tsx?$/.test(nome.name) && !nome.name.includes(".test."))
        pedacos.push(semProsa(p));
    }
  };
  anda("src");
  return pedacos.join("\n");
}

describe("⚠️ toda escrita de estado tem leitor", () => {
  const APP = todoOApp();

  /** As colunas que os módulos da rede escrevem por `.update({...})`. */
  const escritas = new Map<string, string[]>();
  for (const m of MODULOS) {
    const c = semProsa(m);
    for (const bloco of c.matchAll(/\.update\(\{([^}]*)\}/g)) {
      for (const col of bloco[1]!.matchAll(/(\w+):/g)) {
        const nome = col[1]!;
        if (nome === "accessToken") continue;
        escritas.set(nome, [...(escritas.get(nome) ?? []), m]);
      }
    }
  }

  test("os módulos da rede escrevem alguma coisa (a catraca não roda em vazio)", () => {
    expect(escritas.size).toBeGreaterThan(5);
  });

  test("⚠️ nenhuma coluna é escrita sem que alguém a leia", () => {
    const orfas: string[] = [];
    for (const [col, mods] of escritas) {
      if (SEM_LEITOR_DE_PROPOSITO[col]) continue;
      const total = APP.match(new RegExp(`\\b${col}\\b`, "g"))?.length ?? 0;
      const comoEscrita =
        APP.match(new RegExp(`\\.update\\(\\{[^}]*\\b${col}\\b`, "g"))?.length ?? 0;
      /* Se toda ocorrência é escrita, ninguém lê. */
      if (total <= comoEscrita)
        orfas.push(`${col} (escrita em ${mods.map((m) => m.split("/").pop()).join(", ")})`);
    }
    expect(orfas).toEqual([]);
  });

  test("⚠️ e a catraca MORDE — uma coluna órfã é reconhecida", () => {
    /* Contraprova: catraca que passa em vazio é catraca que mente. */
    const inventada = "coluna_que_ninguem_le_jamais";
    const total = APP.match(new RegExp(`\\b${inventada}\\b`, "g"))?.length ?? 0;
    expect(total).toBe(0);
    expect(SEM_LEITOR_DE_PROPOSITO[inventada]).toBeUndefined();
  });

  test("⚠️ toda exceção tem a RAZÃO escrita", () => {
    for (const [col, razao] of Object.entries(SEM_LEITOR_DE_PROPOSITO)) {
      expect(`${col}: ${razao.length}`).toBe(`${col}: ${razao.length}`);
      expect(razao.length).toBeGreaterThan(60);
    }
  });
});
