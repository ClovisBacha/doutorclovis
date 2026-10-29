import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ **AS DUAS DO BLOCO C.**
 *
 * Encaminhar um story para uma conversa, e silenciar posts e stories
 * separadamente. As duas mexem no mesmo lugar — o que a paciente vê sem ter
 * pedido — e por isso são cobradas juntas.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const CONVERSA = readFileSync("src/components/rede-conversa.tsx", "utf8");

/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) =>
  t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p) => p);

function corpoDe(fonte: string, nome: string): string {
  const s = semProsa(fonte);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ silenciar posts e stories separadamente", () => {
  const C = corpoDe(FONTE, "silenciar");

  test("⚠️ AUSENTE cala os DOIS — o comportamento de sempre", () => {
    /**
     * Um `?? false` aqui faria "silenciar" sem escolha não calar nada: o botão
     * principal viraria um controle que não faz coisa nenhuma, e quem já tinha
     * silenciado alguém voltaria a ouvi-la sem ter pedido.
     */
    expect(C).toMatch(/cala_posts:\s*data\.calaPosts \?\? true/);
    expect(C).toMatch(/cala_stories:\s*data\.calaStories \?\? true/);
  });

  test("⚠️ e há DEGRAU: sem as colunas, cala os dois em vez de falhar", () => {
    /* Falhar aqui tiraria o silenciar inteiro de todo banco que ainda não rodou
       o SQL — um recurso que existe há meses, apagado por um que ainda não
       existe. */
    const i = C.indexOf("if (error) {");
    expect(i).toBeGreaterThan(-1);
    const recuo = C.slice(i, C.indexOf("return { ok: true as const, parcial: false }"));
    expect(recuo).toContain("{ quem_id: eu, silenciado_id: data.alvoId }");
    expect(recuo).not.toContain("cala_posts");
  });

  test("⚠️ e o recuo AVISA quando a escolha não pegou", () => {
    /**
     * Se ela pediu para calar só os stories e o banco calou os dois, dizer
     * "pronto" seria mentir sobre o alcance do próprio silêncio dela — e ela
     * concluiria que a amiga parou de publicar.
     */
    expect(C).toMatch(
      /const escolheu = data\.calaPosts === false \|\| data\.calaStories === false/,
    );
    expect(C).toContain("parcial: escolheu");
  });

  test("⚠️ e a TELA lê o `parcial` — senão o campo é enfeite", () => {
    /* É o defeito que este projeto já registrou: `parcial: true` devolvido pelo
       servidor e com ZERO leitores, com a tela dizendo "Salvo 💛" por cima. */
    const t = semProsa(TELA);
    const i = t.indexOf("async function silenciarPerfil");
    const corpo = t.slice(i, t.indexOf("\n  async function", i + 10));
    expect(corpo).toMatch(/"parcial" in r && r\.parcial/);
  });

  test("⚠️ desfazer NÃO manda a escolha — apaga a linha", () => {
    /* Um `upsert` com as duas colunas `false` deixaria a linha viva: quem
       "voltou a ouvir" continuaria na lista de silenciados, e o dia em que
       alguém acrescentasse uma terceira coisa a calar ela voltaria calada. */
    const i = C.indexOf("if (!data.silenciar)");
    expect(i).toBeGreaterThan(-1);
    expect(C.slice(i, i + 400)).toContain(".delete()");
  });
});

describe("⚠️ os dois conjuntos do contexto", () => {
  test("são DOIS, e cada um filtra a sua coluna", () => {
    /* Um conjunto só faria a escolha existir no banco e não existir no feed —
       ela silenciaria os stories e continuaria vendo os stories. */
    const s = semProsa(FONTE);
    const i = s.indexOf("silenciados: new Set(");
    const bloco = s.slice(i, i + 700);
    expect(bloco).toContain("x.cala_posts !== false");
    expect(bloco).toContain("x.cala_stories !== false");
  });

  test("⚠️ o teste é `!== false`, e nunca `=== true`", () => {
    /**
     * Num banco sem as colunas o valor é `undefined`, e `=== true` faria toda
     * linha existente deixar de calar: quem já tinha silenciado alguém voltaria
     * a ver tudo dela, em silêncio.
     */
    const s = semProsa(FONTE);
    const i = s.indexOf("silenciados: new Set(");
    expect(s.slice(i, i + 700)).not.toContain("=== true");
  });

  test("⚠️ e a LEITURA tem degrau — senão o silenciar que já existe PARA", () => {
    /**
     * ⚠️ **É uma REGRESSÃO que quase entrou.** `cala_posts`/`cala_stories`
     * nascem num `APLICAR_` que o dono roda à mão, e o deploy chega SEMPRE
     * antes: sem o recuo, o `42703` derruba o select inteiro, os dois conjuntos
     * saem vazios, e **o silenciar que funcionava há meses deixa de valer** — a
     * silenciada volta ao feed de todo mundo, sem erro nenhum na tela.
     */
    const s = semProsa(FONTE).replace(/\s+/g, " ");
    const i = s.indexOf('.from("rede_silenciados") .select("silenciado_id, cala_posts');
    expect(i).toBeGreaterThan(-1);
    const bloco = s.slice(i, i + 900);
    expect(bloco).toContain('.select("silenciado_id").eq("quem_id", eu)');
    /* ⚠️ E o recuo trata ausente como CALA OS DOIS, que é o que a linha
       existente sempre significou. */
    expect(bloco).toContain("cala_posts: true");
    expect(bloco).toContain("cala_stories: true");
  });

  test("⚠️ o feed de STORIES lê `silenciadosStories`", () => {
    const C = corpoDe(FONTE, "storiesDoFeed");
    expect(C).toContain("ctx.silenciadosStories.has(id)");
    expect(C).not.toMatch(/ctx\.silenciados\.has/);
  });

  test("⚠️ e o feed de POSTS continua lendo `silenciados`", () => {
    const C = corpoDe(FONTE, "meuFeed");
    expect(C).toMatch(/ctx\.silenciados\.has/);
  });
});

describe("⚠️ encaminhar um story", () => {
  test("a folha de mandar aceita post E story", () => {
    /* Uma segunda folha para story divergiria da primeira no primeiro ajuste —
       e é ela que carrega a trava de só oferecer conversas que já existem. */
    /**
     * ⚠️ **A GARANTIA É "uma folha serve os dois", e não a grafia do tipo.** Ela
     * travava `alvo: { tipo: "post" | "story"; id: string }` e ficou vermelha
     * quando a MESMA folha passou a servir também o encaminhar de mensagem —
     * uma união a mais no tipo, que só ampliou o que ela cobre.
     */
    const c = semProsa(CONVERSA);
    expect(c).toMatch(/tipo: "post" \| "story"/);
    expect(c).toContain("refTipo: alvo.tipo");
    /* E não nasceu uma segunda folha. */
    expect((c.match(/export function MandarPublicacao/g) ?? []).length).toBe(1);
  });

  test("⚠️ e o ✈ do story é do DONO, e só", () => {
    /**
     * Encaminhar o story de OUTRA pessoa entregaria a foto dela a quem ela não
     * escolheu — e passaria por cima da camada de visibilidade que o story
     * acabou de ganhar. O botão só existe no próprio story.
     */
    const t = semProsa(TELA);
    /* O portão é o EMBRULHO `{souEu && atual && ( … )}` do rodapé, e não uma
       condição na prop: quem passa `aoMandarStory` é a tela de fora, que não
       sabe de quem é o story aberto. Casar parênteses é o único jeito de provar
       que o botão está DENTRO do embrulho — um `indexOf` diria só que ele vem
       depois, e depois inclui "depois do bloco fechar". */
    const i = t.indexOf("{souEu && atual && (");
    expect(i).toBeGreaterThan(-1);
    let nivel = 0;
    let fim = i;
    for (let k = t.indexOf("(", i); k < t.length; k++) {
      if (t[k] === "(") nivel++;
      else if (t[k] === ")") {
        nivel--;
        if (nivel === 0) {
          fim = k;
          break;
        }
      }
    }
    const rodape = t.slice(i, fim);
    expect(rodape).toContain("aoMandarStory(atual.id)");
  });

  test("⚠️ a conversa mostra ↩ Story, e não 🖼 Publicação", () => {
    /* O story vive 24 h: quem abrir depois encontra um cartão que não resolve,
       e chamá-lo de "publicação" faria a paciente procurar um post que nunca
       existiu. */
    const conversa = readFileSync("src/lib/conversa.ts", "utf8");
    expect(conversa).toContain('if (m.refTipo === "story") return "↩ Story";');
  });
});
