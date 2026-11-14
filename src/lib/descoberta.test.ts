import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BUSCAS_RECENTES_MAX,
  MINIMO_PARA_ESTAR_EM_ALTA,
  chaveDasBuscasRecentes,
  comBuscaNova,
  ordenarTagsEmAlta,
} from "./sugestoes";

/**
 * ⚠️ **A DESCOBERTA — e a linha que ela NÃO cruza.**
 *
 * Explorar, tags em alta e contas parecidas são as três peças que, no modelo do
 * Instagram, saem de ENGAJAMENTO. Aqui nenhuma sai: numa base de gestação de
 * alto risco, o post que mais engaja é o da EMERGÊNCIA, e um ranking que aprende
 * isso põe o pior dia de uma paciente como a primeira coisa que as outras veem.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const SUGESTOES = readFileSync("src/lib/sugestoes.ts", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const s = semProsa(FONTE);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ as tags em alta", () => {
  test("ordenam por FREQUÊNCIA, e nunca por reação", () => {
    const r = ordenarTagsEmAlta({ enjoo: 5, trigemeas: 9, sono: 2 });
    expect(r.map((t) => t.tag)).toEqual(["trigemeas", "enjoo", "sono"]);
  });

  test("⚠️ há um PISO de duas publicações", () => {
    /* Uma tag usada uma vez não é assunto — é a frase de uma pessoa, e pô-la
       numa lista de "em alta" a expõe a desconhecidas por acidente. */
    expect(MINIMO_PARA_ESTAR_EM_ALTA).toBe(2);
    expect(ordenarTagsEmAlta({ sozinha: 1, dupla: 2 }).map((t) => t.tag)).toEqual(["dupla"]);
  });

  test("⚠️ o empate desempata pela TAG", () => {
    /* Sem desempate fixo, a mesma lista troca de ordem entre duas aberturas — e
       uma lista que se mexe sozinha ensina que ela não significa nada. */
    expect(ordenarTagsEmAlta({ zebra: 3, abelha: 3 }).map((t) => t.tag)).toEqual([
      "abelha",
      "zebra",
    ]);
  });

  test("⚠️ e o arquivo da régua NÃO fala de reação", () => {
    /* É a mesma catraca que a zona de sugestões já tem: "em alta" por
       engajamento é o ranking que este app decidiu não ter. */
    const s = semProsa(SUGESTOES).toLowerCase();
    const i = s.indexOf("export function ordenartagsemalta");
    const corpo = s.slice(i, i + 900);
    for (const proibido of ["reacao", "reação", "curtida", "engajamento"]) {
      expect({ proibido, tem: corpo.includes(proibido) }).toEqual({ proibido, tem: false });
    }
  });
});

describe("⚠️ o servidor das tags", () => {
  const C = corpoDe("tagsEmAlta");

  test("só conta publicação que ELA poderia ver", () => {
    /**
     * Uma contagem sobre a tabela inteira diria "#trigemeas (14)" e a página da
     * tag mostraria três — as outras onze são de perfis fechados, de quem a
     * bloqueou ou de quem está em luto. O número tem de bater com o que a
     * página entrega.
     */
    expect(C).toContain("montarPosts(sb, eu, crus, ctx)");
    expect(C).toContain("visiveis.has(l.post_id)");
  });

  test("⚠️ e a janela é de 30 dias", () => {
    /* O corte é de gestação: um assunto de quatro meses atrás é de OUTRO
       trimestre. */
    expect(C).toContain("30 * 24 * 3600 * 1000");
  });

  test("⚠️ Modo Cuidado não vê tags em alta", () => {
    expect(C).toContain("euEmCuidado(sb, eu)");
  });

  test("⚠️ e falha vira lista vazia, nunca erro na tela", () => {
    /* É um acessório do Explorar: derrubá-lo por causa dele seria trocar uma
       fileira por uma tela quebrada. */
    expect((C.match(/return \{ ok: true as const, tags: \[\] \}/g) ?? []).length).toBeGreaterThan(
      2,
    );
  });
});

describe("⚠️ o Explorar", () => {
  const T = semProsa(TELA);

  test("a grade sai de `sugestoesDoFeed`, e não de uma consulta própria", () => {
    /**
     * `sugestoesDoFeed` JÁ é a régua desta aba: perfil público, publicação
     * pública, `podeVerPost` por cima, e ordenação por elos e recência. Uma
     * consulta própria aqui abriria a porta para "o que está bombando".
     */
    const i = T.indexOf("async function abrirExplorar");
    const corpo = T.slice(i, T.indexOf("\n  async function", i + 10));
    expect(corpo).toContain("mod.sugestoesDoFeed(");
    expect(corpo).toContain("mod.tagsEmAlta(");
  });

  test("⚠️ a régua é DITA na tela", () => {
    /* Sem a frase, a paciente lê o Explorar como "o que está bombando". */
    expect(T).toContain("Nada aqui é escolhido por número de");
  });

  test("⚠️ e o vazio distingue 'não há nada' de 'não carregou'", () => {
    /* São a mesma imagem e conclusões opostas: a primeira faz ela convidar uma
       amiga, a segunda faz ela achar que a rede morreu. */
    const i = T.indexOf('onde.t === "explorar"');
    const bloco = T.slice(i, i + 4200);
    expect(bloco).toContain('explorar === "erro"');
    expect(bloco).toContain("Não deu para carregar agora.");
    expect(bloco).toContain("Ainda não há nada para descobrir");
  });

  test("⚠️ post só de texto NÃO vira quadrado cinza", () => {
    /* `postEhValido` aceita post sem foto, e sem este ramo ele apareceria como
       um quadrado vazio na grade. */
    const i = T.indexOf('onde.t === "explorar"');
    expect(T.slice(i, i + 4600)).toContain("line-clamp-4");
  });
});

describe("⚠️ as buscas recentes", () => {
  test("ficam no APARELHO, e a chave carrega a conta", () => {
    /**
     * "Quem eu procurei" é um dado que não precisa existir em lugar nenhum além
     * da tela dela. E o aparelho é compartilhado: a lista da mãe não pode
     * aparecer para a filha que usa o mesmo celular.
     */
    expect(chaveDasBuscasRecentes("abc")).toContain("abc");
    expect(semProsa(FONTE)).not.toContain("buscas_recentes");
  });

  test("o termo novo vai para o TOPO, e o repetido SOBE", () => {
    /* Sem a deduplicação, procurar "ana" três vezes enche a lista com a mesma
       palavra — e o resto do histórico some por causa do teto. */
    expect(comBuscaNova(["bruna", "ana"], "ana")).toEqual(["ana", "bruna"]);
    expect(comBuscaNova(["bruna"], "ANA")).toEqual(["ANA", "bruna"]);
  });

  test("⚠️ menos de duas letras não entra", () => {
    expect(comBuscaNova(["ana"], "a")).toEqual(["ana"]);
    expect(comBuscaNova(["ana"], "  ")).toEqual(["ana"]);
  });

  test("respeita o teto", () => {
    const cheia = Array.from({ length: BUSCAS_RECENTES_MAX }, (_, i) => `t${i}`);
    expect(comBuscaNova(cheia, "nova")).toHaveLength(BUSCAS_RECENTES_MAX);
    expect(comBuscaNova(cheia, "nova")[0]).toBe("nova");
  });

  test("⚠️ e a tela só guarda o que ACHOU alguém", () => {
    /* Guardar toda tecla encheria o histórico com prefixos ("a", "an", "ana") —
       e ele existe para ela voltar a uma busca que valeu. */
    const T = semProsa(TELA);
    const i = T.indexOf("if (r.length > 0) guardarBusca(t)");
    expect(i).toBeGreaterThan(-1);
  });
});

describe("⚠️ contas parecidas — e a linha que elas NÃO cruzam", () => {
  const T = semProsa(TELA);

  test("NÃO derivam do perfil aberto", () => {
    /**
     * O Instagram monta a fileira a partir de quem a pessoa que você seguiu
     * segue — e isso aqui VAZARIA O GRAFO DELA. A lista de seguidores deste app
     * não é pública de propósito: "parecidas com a Ana" é a lista de amigas da
     * Ana com outro nome.
     */
    expect(T).toContain("parecidas={pessoas.filter((p) => p.id !== perfil.id)");
    expect(T).not.toContain("parecidasDe(");
    expect(semProsa(FONTE)).not.toContain("contasParecidasCom");
  });

  test("⚠️ só aparecem DEPOIS de seguir", () => {
    /* Num perfil que ela ainda está decidindo se acompanha, a fileira vira uma
       vitrine de outras pessoas e a decisão fica em segundo plano. */
    expect(T).toContain('perfil.meuVinculo === "ativo" && !perfil.souEu && (parecidas ?? [])');
  });

  test("⚠️ e a régua é dita", () => {
    expect(T).toContain("Contas abertas com gente em comum com você.");
  });
});
