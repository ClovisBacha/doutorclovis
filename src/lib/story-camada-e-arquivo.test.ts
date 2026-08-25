import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  VISIBILIDADES_DO_STORY,
  VISIBILIDADE_DO_STORY_PADRAO,
  camadaDoStory,
  storyAlcanca,
} from "./rede-social";

/**
 * ⚠️ **O STORY ERA O ÚNICO CONTEÚDO SEM CAMADA — e é o mais íntimo.**
 *
 * O post escolhe entre três camadas desde o primeiro dia. O story não escolhia
 * nada: ia sempre para `sigo ∪ amigas`, ou seja, para o público MAIS LARGO que
 * ela tem. Num app de gestação de alto risco isso é o contrário do que a
 * natureza do formato pede — o story é onde ela põe a ultrassom que acabou de
 * sair e o dia ruim, coisas que se contam para seis pessoas e não para
 * trezentas.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = FONTE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const i = semProsa.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = semProsa.indexOf("\nexport const ", i + 10);
  return semProsa.slice(i, j < 0 ? undefined : j);
}

describe("a régua da camada", () => {
  test("⚠️ o padrão é `seguidores` — o comportamento que os stories já tinham", () => {
    /**
     * Fechar por padrão faria as publicações futuras dela alcançarem menos gente
     * que as de ontem sem ela ter pedido — e ela descobriria pelo silêncio.
     *
     * ⚠️ É o CONTRÁRIO do padrão do post (`amigas`), e a diferença é
     * deliberada: lá a camada nasceu com o recurso e nasceu fechada; aqui ela
     * está chegando a um formato que já era aberto.
     */
    expect(VISIBILIDADE_DO_STORY_PADRAO).toBe("seguidores");
  });

  test("⚠️ NÃO existe camada `publico` no story", () => {
    /**
     * Um story público seria visto por quem ela não conhece — e a fileira de
     * bolinhas não tem rótulo de procedência nenhum: a paciente abriria achando
     * que é de alguém que ela segue. O post pode ser público porque toda
     * publicação de fora carrega "Sugerido para você"; o story não carrega.
     */
    expect(VISIBILIDADES_DO_STORY.map((v) => v.chave)).toEqual(["seguidores", "amigas"]);
  });

  test("⚠️ desconhecido cai no PADRÃO, nunca no mais aberto", () => {
    for (const lixo of [undefined, null, "", "publico", "todo mundo", 42, {}]) {
      expect(camadaDoStory(lixo)).toBe(VISIBILIDADE_DO_STORY_PADRAO);
    }
    expect(camadaDoStory("amigas")).toBe("amigas");
  });
});

describe("⚠️ quem alcança — e o recorte por AUTORA não basta", () => {
  const base = { euId: "eu", autorId: "ela", somosAmigas: false };

  test("story de `seguidores` alcança quem está no recorte", () => {
    expect(storyAlcanca({ ...base, camada: "seguidores" })).toBe(true);
  });

  test("⚠️ story de `amigas` NÃO alcança quem só segue", () => {
    /**
     * Este é o caso inteiro. A leitura da fileira monta a lista de autoras
     * (`sigo ∪ amigas`) e busca os stories delas — mas dentro dessa lista há
     * gente que eu SIGO sem ser amiga, e é dessa gente que o story `amigas` tem
     * de se esconder. Filtrar só por autora entregaria o story fechado à fileira
     * inteira.
     */
    expect(storyAlcanca({ ...base, camada: "amigas" })).toBe(false);
    expect(storyAlcanca({ ...base, camada: "amigas", somosAmigas: true })).toBe(true);
  });

  test("⚠️ a AUTORA sempre vê o próprio, inclusive o fechado", () => {
    /* Sem isto, publicar em "só amigas" faria o story sumir da fileira dela
       mesma, e ela concluiria que a publicação falhou. */
    expect(
      storyAlcanca({ euId: "ela", autorId: "ela", camada: "amigas", somosAmigas: false }),
    ).toBe(true);
  });
});

describe("⚠️ o servidor aplica a camada em TODOS os portões", () => {
  test("a fileira filtra por story, e não só por autora", () => {
    const C = corpoDe("storiesDoFeed");
    expect(C).toContain("storyAlcanca({");
    expect(C).toContain("camadaDoStory(l.visibilidade)");
  });

  test("⚠️ e reagir e votar também — a fileira escondia, o servidor aceitava", () => {
    /**
     * Sem a camada nestes portões, quem SEGUE a autora sem ser amiga podia
     * reagir/votar num story marcado "só amigas": a fileira já o escondia dela,
     * mas o servidor aceitava a ação, e o afago chegava à caixa ♡ da autora
     * vindo de alguém que nunca devia ter visto aquilo.
     */
    for (const fn of ["reagirAoStory", "votarNoStory"]) {
      expect(corpoDe(fn)).toContain("storyAlcanca({");
    }
  });

  test("⚠️ a leitura dos portões tem DEGRAU — senão reagir para de funcionar", () => {
    /* Sem a coluna, o `42703` derrubaria o `select` inteiro e reagir a QUALQUER
       story pararia — por causa de um recurso que ainda não existe no banco. */
    const i = semProsa.indexOf("async function storyParaPortao");
    expect(i).toBeGreaterThan(-1);
    const corpo = semProsa.slice(i, semProsa.indexOf("\n}", i));
    expect(corpo).toContain("VISIBILIDADE_DO_STORY_PADRAO");
  });
});

describe("⚠️ o arquivo de stories", () => {
  const C = corpoDe("meuArquivoDeStories");

  test("⚠️ é PRIVADO: não existe alvo vindo do cliente", () => {
    /**
     * Um `alvoId` aqui seria a porta para ler o arquivo de qualquer paciente
     * trocando um uuid — incluindo os stories que ela publicou em "só amigas" e
     * os que já expiraram para todo mundo. O recorte é a sessão, e nada mais.
     */
    expect(C).toContain('.eq("autor_id", eu)');
    const validador = C.slice(0, C.indexOf(".handler("));
    expect(validador).not.toContain("alvoId");
  });

  test("⚠️ falha de leitura devolve ERRO, e nunca arquivo vazio", () => {
    /* "Você nunca publicou nada" é a frase mais errada que esta tela pode dizer
       a quem publicou trinta stories. */
    expect(C).toContain('motivo: "banco"');
  });

  test("Modo Cuidado fecha o arquivo", () => {
    /* Rolar os stories de uma gestação que acabou de terminar é exatamente o que
       o modo existe para impedir — e `euEmCuidado` falha FECHADO. */
    expect(C).toContain("euEmCuidado(sb, eu)");
  });

  test('⚠️ "no ar" é DERIVADO, e nunca guardado', () => {
    /* Um booleano gravado ficaria mentindo 24 h depois. */
    expect(C).toContain("noAr:");
    expect(C).toContain("expira_em");
  });
});

describe("⚠️ destacar", () => {
  const C = corpoDe("destacarStory");

  test("só a autora, e a conferência vem ANTES da escrita", () => {
    const iDono = C.indexOf('.eq("id", data.storyId)');
    const iUpdate = C.indexOf(".update(");
    expect(iDono).toBeGreaterThan(-1);
    expect(iUpdate).toBeGreaterThan(iDono);
    expect(C).toContain("autor_id !== eu");
    expect(C.slice(iUpdate)).toContain('.eq("autor_id", eu)');
  });

  test("⚠️ falha ao contar o teto RECUSA, nunca libera", () => {
    /* Liberar por não ter conseguido contar é como o teto deixa de existir — a
       mesma régua de `contarTrofeus` e de `fixarPost`. */
    expect(C).toMatch(/erroConta \|\| typeof count !== "number"/);
  });

  test("⚠️ NÃO mexe em `expira_em`", () => {
    /**
     * Duas colunas dizendo quanto tempo a coisa vive divergiriam no primeiro
     * ajuste. Quem decide se o story aparece na FILEIRA continua sendo
     * `expira_em`; quem decide se ele aparece no PERFIL é `destacado_em`. São
     * duas perguntas, e um story destacado sai da fileira em 24 h como qualquer
     * outro — o que ele ganha é uma segunda casa.
     */
    expect(C.slice(C.indexOf(".update("))).not.toContain("expira_em");
  });
});

describe("⚠️ o rascunho guarda a camada", () => {
  test("senão ela recupera e publica ABERTO sem reparar", () => {
    /**
     * O pior desfecho possível de um recurso de conveniência: ela escreve um
     * story marcado "só amigas", é interrompida, recupera o rascunho — e
     * publica para todo mundo sem nada avisar.
     */
    const r = readFileSync("src/lib/rascunho-do-story.ts", "utf8");
    expect(r).toContain("camada");
    const tela = readFileSync("src/components/rede-instagram.tsx", "utf8");
    expect(tela).toContain("setCamada(camadaDoStory(rascunho?.camada))");
  });
});
