import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ **COMPARTILHAR UMA PUBLICAÇÃO DENTRO DE UM STORY.**
 *
 * O risco inteiro é de VISIBILIDADE, e ele tem duas pontas:
 *
 *  - na ESCRITA, um story alcança todas as seguidoras dela. Deixar compartilhar
 *    uma publicação da camada `amigas` faria o story ser a porta dos fundos da
 *    visibilidade: o desabafo escrito para seis pessoas chegaria a trezentas.
 *  - na LEITURA, quem assiste pode ter bloqueado a autora, ou ela pode ter
 *    fechado o perfil depois. O quadro é resolvido com o contexto de QUEM ABRE.
 *
 * É o mesmo desenho do quadro de republicação — e é lá que este projeto já
 * pagou o preço de conferir a camada e esquecer o PERFIL.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
/** ⚠️ A prosa deste arquivo cita o que ele proíbe — tira-se antes de procurar. */
const semProsa = FONTE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const i = semProsa.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = semProsa.indexOf("\nexport const ", i + 10);
  return semProsa.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ a ESCRITA: só publicação pública, de perfil público", () => {
  const C = corpoDe("publicarStory");

  test("a camada é conferida", () => {
    expect(C).toContain('visibilidade === "publico"');
  });

  test("⚠️ e o PERFIL da autora também — a camada sozinha não basta", () => {
    /**
     * Um post `publico` de um perfil PRIVADO alcança apenas quem segue, e o
     * perfil NASCE privado. Conferir só a camada é exatamente o vazamento que o
     * quadro do repost teve — e que eu declarei "falso" antes de ter conferido
     * a régua inteira.
     */
    const i = C.indexOf("const vale =");
    expect(i).toBeGreaterThan(-1);
    const regra = C.slice(i, C.indexOf(";", i));
    /* ⚠️ A regex aceita `dono.x` e `(dono as any).x` — travar UMA grafia
       reprovaria uma limpeza de tipos que não muda garantia nenhuma. É o
       defeito que já custou quatro testes nesta base. */
    expect(regra).toMatch(/dono[^)]*\)?\.perfil_publico/);
    expect(regra).toMatch(/dono[^)]*\)?\.care_mode/);
  });

  test("⚠️ e `!!dono` vem na FRENTE, para o portão não fechar por acidente", () => {
    /* Sem ele, `!dono?.care_mode` com `dono` indefinido dá `true` e o que
       segurava a corrente seria o termo anterior dar `false`. Depender de
       acidente é como um portão reabre no próximo conserto. */
    const i = C.indexOf("const vale =");
    const regra = C.slice(i, C.indexOf(";", i));
    const iDono = regra.indexOf("!!dono &&");
    const iCuidado = regra.search(/!\(?dono/);
    expect(iDono).toBeGreaterThan(-1);
    expect(iDono).toBeLessThan(iCuidado);
  });

  test("⚠️ arquivada não vale", () => {
    const i = C.indexOf("const vale =");
    expect(C.slice(i, C.indexOf(";", i))).toContain("arquivado_em");
  });

  test("⚠️ e RECUSA em vez de publicar sem o quadro", () => {
    /* Ela escolheu compartilhar AQUELA publicação; um story sem o quadro é
       outro story. */
    expect(C).toContain('motivo: "repost_invalido"');
  });

  test("⚠️ sem a coluna E com escolha, RECUSA — nunca um 'ok' mudo", () => {
    /**
     * Descer o degrau publicaria um story diferente do que ela montou.
     *
     * ⚠️ A primeira versão travava a string `erroComPost && postDe` — e reprovou
     * o dia em que a CAMADA entrou na mesma condição, que é uma razão ainda mais
     * forte para recusar: sem a coluna, um story marcado "só amigas" sairia
     * ABERTO. Hoje se cobra a GARANTIA: a escolha dela entra na decisão de
     * descer, de qualquer jeito que esteja escrita.
     */
    const i = C.indexOf("if (erroComPost");
    expect(i).toBeGreaterThan(-1);
    const cond = C.slice(i, C.indexOf(")", C.indexOf("(", i + 3)));
    expect(cond).toContain("postDe");
    expect(C).toContain('motivo: "sem_suporte"');
  });

  test("⚠️ e a CAMADA escolhida também impede o degrau", () => {
    /* Sem a coluna, um story marcado "só amigas" seria publicado ABERTO — o
       oposto exato do que ela pediu, e o tipo de falha que ela só descobre
       quando a pessoa errada comenta. */
    const i = C.indexOf("if (erroComPost");
    const cond = C.slice(i, C.indexOf("{", i));
    expect(cond).toContain("camada");
    expect(cond).toContain("VISIBILIDADE_DO_STORY_PADRAO");
  });
});

describe("⚠️ a LEITURA: o quadro é de quem ASSISTE", () => {
  const C = corpoDe("storiesDoFeed");

  test("passa por `montarPosts` com o MEU contexto", () => {
    /**
     * É `montarPosts` que aplica `podeVerPost`. Montar o quadro à mão a partir
     * da linha do banco seria a segunda régua — e a divergência apareceria como
     * publicação de perfil fechado dentro do story de outra pessoa.
     */
    const i = C.indexOf("const quadros");
    expect(i).toBeGreaterThan(-1);
    const bloco = C.slice(i, i + 1200);
    expect(bloco).toContain("montarPosts(sb, eu, crus, ctx)");
    expect(bloco).toContain("postsCrus(");
  });

  test("⚠️ em LOTE, e fora do laço", () => {
    /* Uma consulta por story seriam vinte idas na fileira que a aba desenha
       primeiro. */
    const i = C.indexOf("const quadros");
    const j = C.indexOf("for (const l of linhas)");
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(C.slice(i, j)).toContain('.in("id", ids)');
  });

  test("⚠️ falha ao ler NÃO derruba a fileira", () => {
    /* Sem os quadros, os stories aparecem inteiros e sem o cartão — o estado de
       antes do recurso. Derrubar a fileira trocaria um enfeite por uma tela
       vazia. */
    const i = C.indexOf("const quadros");
    expect(C.slice(i, i + 1400)).toContain("catch");
  });

  test("⚠️ e a coluna nova tem DEGRAU no topo da escada de leitura", () => {
    /* `post_de` nasce no `APLICAR_FIXAR_E_STORY_DE_POST.sql`, que o dono roda à
       mão — e o deploy chega antes. Sem o degrau, o `42703` devolveria a
       fileira com uma bolinha só. */
    expect(C).toContain("post_de");
    expect(C).toContain("APLICAR_FIXAR_E_STORY_DE_POST.sql");
  });
});

describe("⚠️ o banco guarda SÓ o id", () => {
  const SQL = readFileSync("supabase/APLICAR_FIXAR_E_STORY_DE_POST.sql", "utf8");

  test("`post_de` é chave estrangeira com `ON DELETE SET NULL`", () => {
    /**
     * Sem o `SET NULL`, arquivar/apagar o post referido derrubaria o story
     * inteiro por violação de chave — e o story é de OUTRA pessoa, que não tem
     * nada a ver com a decisão de quem apagou.
     */
    expect(SQL).toMatch(/post_de uuid REFERENCES public\.rede_posts\(id\) ON DELETE SET NULL/);
  });

  test("⚠️ e NENHUMA cópia do post entra na tabela", () => {
    /* Copiar texto, caminho de foto ou nome faria o quadro sobreviver à decisão
       de quem escreveu: ela edita a legenda, ou fecha o perfil, e a versão
       antiga continuaria circulando dentro do story. É a mesma decisão do
       carimbo da semana (derivado na leitura, nunca guardado). */
    const i = SQL.indexOf("ADD COLUMN IF NOT EXISTS post_de");
    const bloco = SQL.slice(i, i + 200);
    for (const proibido of ["post_texto", "post_imagem", "post_autor_nome"]) {
      expect(bloco).not.toContain(proibido);
    }
  });
});
