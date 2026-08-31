/**
 * O PORTÃO NÃO PODE FALHAR ABERTO — nem reprovar por motivo alheio ao código.
 *
 * `scripts/verificar.sh` é a única coisa entre uma edição e a produção (esta
 * branch É o que www.obstetrica.com.br serve). Ele tinha os DOIS defeitos que
 * este repositório passou a noite consertando no produto, no próprio
 * instrumento:
 *
 * ⚠️ **FALHA ABERTA.** O passo do lint era `npx eslint . | grep -c " error "`.
 * Se o eslint QUEBRA — configuração inválida, plugin faltando, falta de
 * memória — a saída não tem nenhuma linha com " error ", a contagem dá ZERO, e
 * o portão dizia **ok**. A checagem de lint desligava sozinha exatamente quando
 * o lint parava de funcionar. Medido: com a config trocada por um import
 * inexistente, o portão antigo passava; o novo diz "o eslint quebrou".
 *
 * ⚠️ **FALSO VERMELHO.** O passo do `tsc` julgava por "a saída está vazia?", e
 * o `npx` imprime aviso de atualização em stderr. Isso já reprovou este portão
 * DUAS vezes sem nada de errado no código — e um portão que reprova à toa é um
 * portão que a pessoa aprende a ignorar, junto com o vermelho de verdade.
 *
 * ⚠️ E ele rodava `bun test src/` TRÊS vezes: triplicava o tempo e permitia que
 * as execuções DISCORDASSEM num teste intermitente.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const SH = readFileSync("scripts/verificar.sh", "utf8");
/** Sem os comentários: eles CITAM os padrões proibidos para explicá-los. */
const CODIGO = SH.split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");

describe("o portão sai com erro — é a razão de ele existir", () => {
  test("⚠️ `exit $falhou` no fim, e nenhum `exit 0` cravado", () => {
    /* Encadear `... && git commit` verifica o git, não as checagens: elas
       imprimem o problema e seguem com código 0. Foi assim que dois commits
       vermelhos passaram. */
    expect(CODIGO).toContain("exit $falhou");
    expect(CODIGO).not.toMatch(/^\s*exit 0\s*$/m);
  });

  test("as quatro checagens estão lá", () => {
    for (const p of ["tsc", "lint", "testes", "git"]) {
      expect(CODIGO).toContain(`passo "${p}"`);
    }
  });
});

describe("nenhum passo falha ABERTO", () => {
  test("⚠️ o lint distingue 'limpo' de 'o eslint quebrou'", () => {
    /* A forma exata do defeito era decidir SÓ pela contagem de linhas. Hoje o
       código de saída manda: 0 limpo, 1 achou problema, qualquer outro = quebrou
       — e quebrado nunca é "ok". */
    expect(CODIGO).toMatch(/saida=\$\(npx eslint \. 2>&1\); rc=\$\?/);
    expect(CODIGO).toMatch(/elif \[ "\$rc" = "1" \]/);
    expect(CODIGO).toMatch(/o eslint quebrou/);
    /* O padrão antigo: a contagem SOZINHA decidindo. */
    expect(CODIGO).not.toMatch(/\[ "\$n" = "0" \] && echo "ok"/);
  });

  test("⚠️ os testes: sem linha de resumo é VERMELHO, nunca 'nenhum falhou'", () => {
    /* Se o `bun` morre antes do resumo (falta de memória, import quebrado), não
       há `0 fail` nem `N pass` — e isso não pode ser lido como suíte limpa. */
    expect(CODIGO).toMatch(/grep -qE "\^ \[0-9\]\+ pass"/);
    expect(CODIGO).toMatch(/a suíte não rodou inteira/);
  });

  test("⚠️ a trava do git continua conferindo a árvore ATRASADA", () => {
    /* O contêiner restaura instantâneos antigos; commitar por cima reverte a
       sessão com um diff que parece legítimo. */
    expect(CODIGO).toContain("merge-base --is-ancestor HEAD");
    expect(CODIGO).toContain("NÃO COMMITE");
  });
});

describe("nenhum passo reprova por motivo alheio ao código", () => {
  test("⚠️ o `tsc` é julgado pelo CÓDIGO DE SAÍDA, não por 'imprimiu algo?'", () => {
    /* `npm notice` em stderr entrava na captura e virava erro de tipo. */
    expect(CODIGO).toMatch(/saida=\$\(npx tsc --noEmit 2>&1\); rc=\$\?/);
    expect(CODIGO).toMatch(/if \[ "\$rc" = "0" \]; then echo "ok"/);
    expect(CODIGO).not.toMatch(/\[ -z "\$out" \] && echo "ok"/);
  });

  test("o ruído do gerenciador de pacotes é filtrado antes de aparecer", () => {
    expect(CODIGO).toMatch(/limpo\(\)/);
    expect(CODIGO).toMatch(/npm \(notice\|warn\)/);
  });
});

describe("uma execução por ferramenta", () => {
  test("⚠️ `bun test` roda UMA vez — três execuções podiam discordar", () => {
    /* Além de triplicar o tempo do portão, num teste intermitente as três
       rodadas podiam divergir, e o veredito passava a depender de qual delas
       alguém olhasse. */
    expect((CODIGO.match(/bun test src\//g) ?? []).length).toBe(1);
    expect((CODIGO.match(/npx eslint \./g) ?? []).length).toBe(1);
    expect((CODIGO.match(/npx tsc --noEmit/g) ?? []).length).toBe(1);
  });
});
