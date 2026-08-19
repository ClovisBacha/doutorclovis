import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A CATRACA DOS ZERO-CHAMADORES.
 *
 * ─── POR QUE ESTE TESTE EXISTE ─────────────────────────────────────────────
 *
 * A rede social nasceu de trás para a frente: primeiro o servidor, depois a
 * régua, depois as telas. Funcionou — e produziu, sem ninguém notar, o defeito
 * que este repositório já pagou duas vezes antes:
 *
 *  · `proximoDesbloqueio`/`escadaDeTrofeus`, escritas e testadas, com ZERO
 *    chamadores: a escada de troféus existia e nunca foi mostrada a ninguém.
 *  · `first_course`/`course_5`/`course_complete`, conquistas que liam uma
 *    tabela que nada escrevia — impossíveis, para sempre, aparecendo como
 *    "🔒 bloqueada" numa grade que a paciente lê como "o que ainda dá pra
 *    fazer".
 *
 * Na rede a mesma coisa tinha acontecido com SETE funções de servidor de uma
 * vez. `publicarPost` não tinha porta nenhuma no app: dava para ler o feed e
 * era impossível publicar. `apagarPost` também não: dava para publicar (pela
 * bancada) e nunca apagar. E `responderPedido` era a pior das três, porque o
 * perfil nasce FECHADO (`PERFIL_PUBLICO_PADRAO = false`) — todo seguir virava
 * "pendente" e ninguém, em lugar nenhum do app, podia aceitar. A rede inteira
 * estava morta por construção, e nada ficava vermelho.
 *
 * O teste não conta chamadas nem julga a tela. Ele cobra uma coisa só: **toda
 * função de servidor da rede é alcançável a partir do app**. Bancada não vale
 * — `/preview-*` existe para OLHAR uma tela, e uma função que só a bancada
 * chama é exatamente a que a paciente nunca alcança.
 */

/**
 * ⚠️ **É uma LISTA, e ela cresce junto com a aba.** `caixinha.functions.ts`
 * nasceu num módulo próprio para `rede-social.functions.ts` parar de crescer —
 * e um módulo novo fora desta lista é exatamente o buraco que a catraca existe
 * para fechar: cinco funções escritas, testadas e inalcançáveis, sem nada
 * ficando vermelho.
 */
const FONTES = ["src/lib/rede-social.functions.ts", "src/lib/caixinha.functions.ts"];

/** Onde o APP mora. Bancadas e testes ficam de fora — ver o cabeçalho. */
const PASTAS = ["src/components", "src/routes", "src/lib"];

/** O nome de módulo que aparece num `import()` — `src/lib/x.functions.ts` → `x.functions`. */
function moduloDe(fonte: string): string {
  return fonte.replace(/^src\/lib\//, "").replace(/\.ts$/, "");
}

function arquivosDoApp(modulos: string[]): string[] {
  const out: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) {
        anda(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(nome)) continue;
      if (nome.endsWith(".test.ts") || nome.endsWith(".test.tsx")) continue;
      if (nome.startsWith("preview-")) continue;
      if (FONTES.includes(p)) continue;
      /* ⚠️ **Só os arquivos que IMPORTAM o módulo da rede.**
         Com o repositório inteiro, o teste passa por homonímia: `bloquear` não
         tinha porta nenhuma no app e passava mesmo assim, porque a palavra
         aparece em `bloquearPeriodo` (grade de horários do médico), em
         `entitlements.ts` e em meia dúzia de comentários em português. Nome de
         função é palavra comum; o que não é comum é o import. */
      const src = readFileSync(p, "utf8");
      if (!modulos.some((m) => src.includes(m))) continue;
      out.push(p);
    }
  };
  for (const d of PASTAS) anda(d);
  return out;
}

/**
 * Tira comentários antes de procurar.
 *
 * ⚠️ Sem isto o teste se auto-satisfaz com PROSA: `publicarPost` voltou a
 * passar no instante em que escrevi, num comentário, que ele tinha ficado sem
 * porta. Um teste que aceita o próprio texto explicando o defeito é um teste
 * que fica verde exatamente quando o defeito está documentado.
 */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function funcoesDeServidor(): string[] {
  return FONTES.flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/export const (\w+) = createServerFn/g)].map((m) => m[1]),
  );
}

describe("toda função de servidor da rede tem porta no app", () => {
  const nomes = funcoesDeServidor();
  const codigo = arquivosDoApp(FONTES.map(moduloDe))
    .map((f) => semComentarios(readFileSync(f, "utf8")))
    .join("\n");

  test("o inventário não está vazio (senão o teste passa por acidente)", () => {
    expect(nomes.length).toBeGreaterThan(15);
    expect(codigo.length).toBeGreaterThan(10_000);
  });

  for (const nome of nomes) {
    test(`\`${nome}\` é chamada de alguma tela do app`, () => {
      /* A chamada é sempre por `import()` dinâmico com desestruturação, então
         o nome aparece literalmente — inclusive quando é renomeado
         (`{ publicarStory: chamar }`). */
      /* ⚠️ Com BORDA DE PALAVRA, e não `includes`. A primeira versão usava
         `includes` e deu passe livre a `bloquear`, que não tinha porta
         nenhuma: a palavra existe em `bloquearPeriodo`/`desbloquearPeriodo`,
         da grade de horários do médico, num arquivo que nada tem a ver com a
         rede. Um teste que casa pedaço de palavra encontra qualquer coisa. */
      expect(new RegExp(`\\b${nome}\\b`).test(codigo)).toBe(true);
    });
  }
});
