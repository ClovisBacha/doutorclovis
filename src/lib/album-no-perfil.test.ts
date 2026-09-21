import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ **O ÁLBUM DA GESTAÇÃO — e a razão de ele ser SÓ DELA não é preferência.**
 *
 * Agrupar por semana carimba uma linha do tempo GESTACIONAL em cada publicação.
 * Num perfil que outra pessoa abre, os títulos "22 semanas" / "30 semanas"
 * publicariam a semana de TODO post — passando por cima da chave
 * `mostrar_semana`, que existe exatamente para essa decisão ser dela, por
 * publicação.
 *
 * A corrente fecha em TRÊS pontos, e este arquivo cobre os três: o servidor não
 * aceita alvo, a tela não pede o álbum de terceiro, e a prop não é passada
 * quando o perfil aberto não é o dela.
 *
 * ⚠️ Ancorado em texto que só existe no CÓDIGO, e só com asserção POSITIVA —
 * ver a razão medida em `story-com-video.test.ts`.
 */
const SERVIDOR = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const REGUA = readFileSync("src/lib/album-da-gestacao.ts", "utf8");

const HANDLER = (() => {
  const i = SERVIDOR.indexOf("export const meuAlbum");
  return SERVIDOR.slice(i, SERVIDOR.indexOf("\nexport const ", i + 10));
})();

describe("⚠️ o servidor: sem alvo, e a semana nunca sai dele", () => {
  test("a âncora existe (senão o describe passa em vazio)", () => {
    expect(HANDLER.length).toBeGreaterThan(600);
  });

  test("⚠️ NÃO existe `alvoId` — o recorte é a sessão e nada mais", () => {
    expect(HANDLER).not.toContain("alvoId");
    expect(HANDLER).toContain('.eq("autor_id", eu)');
  });

  test("⚠️ a DUM não viaja: quem monta as seções é quem a tem em mãos", () => {
    /* `lmp_date` nunca chega ao navegador — é o que sustenta a chave
       `mostrar_semana`. A tela recebe TÍTULOS prontos. */
    expect(HANDLER).toContain("perfil?.lmp_date");
    expect(HANDLER).toContain("montarAlbum(");
    const t = TELA.slice(TELA.indexOf("const { meuAlbum } = await import"));
    expect(t.slice(0, 400)).not.toContain("lmp");
  });

  test("⚠️ NADA em Modo Cuidado nem com a conta pausada", () => {
    /* As publicações dela continuam na grade — esconder o que ela escreveu
       seria o app apagar o bebê dela. O que não é oferecido é o app ORGANIZAR
       aquilo numa narrativa gestacional. */
    expect(HANDLER).toContain("if (foraDaRede(perfil)) return { ok: true as const, secoes: [] }");
  });

  test("⚠️ sem DUM não há álbum, e o arquivado sai na consulta", () => {
    expect(HANDLER).toContain("if (!lmp) return { ok: true as const, secoes: [] }");
    expect(HANDLER).toContain('.is("arquivado_em", null)');
  });

  test("⚠️ passa por `montarPosts` — a régua de visibilidade e as URLs assinadas", () => {
    /* Montar o cartão à mão a partir da linha do banco seria a segunda régua, e
       aqui ela entregaria a foto sem URL assinada. */
    expect(HANDLER).toContain("montarPosts(sb, eu, crus,");
  });
});

describe("⚠️ a tela: três pontos, e a corrente fecha nos três", () => {
  test("⚠️ a consulta NEM SAI quando o perfil aberto não é o meu", () => {
    const efeito = TELA.slice(
      TELA.indexOf('if (onde.t !== "perfil" || !perfil?.souEu)'),
      TELA.indexOf("}, [onde.t, perfil?.souEu, perfil?.id]);"),
    );
    expect(efeito.length).toBeGreaterThan(200);
    expect(efeito).toContain("setAlbum(null);");
    expect(efeito).toContain("meuAlbum({ data: { accessToken: t } })");
  });

  test("⚠️ e a prop também não é passada — cinto sobre suspensório", () => {
    expect(TELA).toContain("album={perfil.souEu ? album : null}");
  });

  test("⚠️ um SELETOR dentro de Publicações, e não uma terceira aba", () => {
    /* Uma aba que só existe no perfil dela mudaria a barra entre um perfil e
       outro — e este repositório já decidiu que a barra tem DUAS abas. */
    const ABAS = readFileSync("src/lib/medidas-instagram.ts", "utf8");
    const i = ABAS.indexOf("export const ABAS_DO_PERFIL");
    expect(ABAS.slice(i, ABAS.indexOf("] as const;", i))).not.toContain("album");
  });

  test("⚠️ o seletor só aparece quando MUDA alguma coisa", () => {
    /* Com menos de duas seções o álbum é a grade com um título em cima, e um
       controle que não muda nada ensina que os controles desta tela não valem. */
    expect(TELA).toContain("{(album?.length ?? 0) >= 2 && (");
  });

  test("⚠️ começa em GRADE — o álbum é a escolha, não o padrão", () => {
    expect(TELA).toContain("const [comoAlbum, setComoAlbum] = useState(false);");
  });

  test("⚠️ a MESMA `GradeDePosts` por seção, nunca uma grade nova", () => {
    /* A proporção da célula já mudou uma vez (1:1 → 3:4, em 2025), e duas
       cópias divergiriam na próxima. */
    const i = TELA.indexOf("{comoAlbum && album ? (");
    expect(i).toBeGreaterThan(-1);
    expect(TELA.slice(i, i + 900)).toContain("<GradeDePosts posts={s.posts}");
  });
});

describe("⚠️ a régua não afirma o que não sabe", () => {
  test('⚠️ "Depois", e NUNCA "Pós-parto"', () => {
    /* O app não sabe se houve parto — só que a publicação nasceu passada a 42ª
       semana. Nomear o desfecho é o tipo de afirmação que este app não faz.
       ⚠️ Conferido também no navegador, e ali a primeira verificação varria a
       PÁGINA INTEIRA e acusou o rodapé do site ("do positivo ao pós-parto"):
       a asserção certa olha os títulos das seções, não o documento. */
    const semProsa = REGUA.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(semProsa).toContain('titulo: "Depois"');
    expect(semProsa).not.toContain("Pós-parto");
  });

  test("⚠️ e a régua não conhece sessão, alvo nem banco", () => {
    const semProsa = REGUA.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const proibido of ["alvoId", "accessToken", "supabase", "createServerFn"]) {
      expect(semProsa).not.toContain(proibido);
    }
  });
});
