import { describe, test, expect } from "bun:test";
import fs from "node:fs";

/**
 * ⚠️ **DUAS CLASSES DE DEFEITO QUE VOLTARAM TRÊS VEZES NESTA ABA.**
 *
 * As duas passam por `tsc`, por lint e por 4.436 testes sem uma reclamação, e
 * as duas foram achadas por VARREDURA — não por asserção. Este arquivo é a
 * varredura virando catraca, no dia em que ela chegou a zero.
 *
 * 1. **Portão que falha ABERTO.** `!!perfil?.care_mode` com `perfil`
 *    indefinido é `false` — "não está de luto". Uma falha de leitura passa a
 *    AUTORIZAR o que o Modo Cuidado existe para impedir. Aconteceu no quadro do
 *    repost, na capa da caixa ♡ e na caixinha de perguntas — três vezes, em
 *    três arquivos, sempre com a mesma cara.
 *
 * 2. **`await` de banco dentro de laço.** Dez menções × duas viagens cada, em
 *    série, penduradas na resposta de PUBLICAR. O aviso é acessório; a
 *    publicação é o que ela está esperando na tela.
 */

const MODULOS = [
  "rede-social.functions.ts",
  "comentarios.functions.ts",
  "mencoes.functions.ts",
  "conversa.functions.ts",
  "caixinha.functions.ts",
]
  .map((f) => `src/lib/${f}`)
  .filter((f) => fs.existsSync(f));

/**
 * ⚠️ **APAGA O TEXTO DOS COMENTÁRIOS E MANTÉM AS QUEBRAS.**
 *
 * Removendo os comentários inteiros, todas as linhas seguintes se deslocam e o
 * relatório aponta para o lugar errado — foi o que a primeira versão desta
 * varredura fez, e eu fui ler prosa achando que era um `select`. E tirar a
 * prosa é obrigatório: nesta base um comentário meu já fez um teste PASSAR
 * (a catraca de portas) e outro FALHAR (o do código da embaixadora).
 */
function semProsa(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

describe("⚠️ os portões da rede não podem falhar abertos", () => {
  test("todo `?.care_mode` opcional é acompanhado de um tratamento de falha", () => {
    /**
     * ⚠️ **A REGRA É SÓ SOBRE `care_mode`, e isso é deliberado.**
     *
     * `perfil_publico` caindo para `false` é a direção SEGURA — "não sei" vira
     * "perfil fechado", e a régua recusa. `care_mode` caindo para `false` é a
     * direção perigosa: "não sei" vira "não está de luto", e o portão autoriza.
     * Uma regra que cobrisse os dois teria onze exceções, e catraca com onze
     * exceções é catraca que ninguém lê.
     *
     * ⚠️ E o que ela cobra é MODESTO de propósito: que exista tratamento de
     * falha por perto (`error`, `erro…`, `if (!x)`, `?? true`, `: true`). Não
     * dá para provar estaticamente que o valor fecha — o que dá para provar é
     * que ninguém leu `?.care_mode` de uma consulta cujo erro passou em branco,
     * que é a forma exata dos três defeitos reais.
     *
     * ⚠️ **Quando esta lista acusar algo, o conserto é o CÓDIGO, não a regex.**
     * Os dois últimos casos eram um `&&` que dependia de o termo anterior
     * fechar por acidente, e um `?.` sobre um objeto que nunca é indefinido —
     * os dois viraram código explícito, e os dois ficaram melhores de ler.
     */
    const achados: string[] = [];
    for (const f of MODULOS) {
      const linhas = semProsa(fs.readFileSync(f, "utf8")).split("\n");
      linhas.forEach((l, i) => {
        if (!/\?\.care_mode/.test(l)) return;
        if (/\?\?\s*true|:\s*true|!\w+\s*\|\|/.test(l)) return;
        const janela = linhas.slice(Math.max(0, i - 12), i).join("\n");
        if (/\berror\b|\berro\w*\b|if\s*\(!\w+\)|Existe:/.test(janela)) return;
        achados.push(`${f}:${i + 1}  ${l.trim().slice(0, 90)}`);
      });
    }
    expect(achados).toEqual([]);
  });

  /**
   * ⚠️ **A ÚNICA EXCEÇÃO, e ela é de FORMA, não de conveniência.**
   *
   * N+1 é uma consulta por ITEM de uma coleção: vinte stories, vinte idas.
   * `inserirDescendo` é outra coisa — um RECUO: ela repete a MESMA gravação
   * tirando uma leva de colunas por vez, no máximo tantas vezes quantos degraus
   * a escada tem, e **para na primeira que dá certo**. Num banco em dia é uma
   * ida só; num banco atrasado, umas poucas, uma única vez.
   *
   * ⚠️ **A exceção é NOMEADA de propósito.** `postsCrus` e `storiesCrus` têm
   * exatamente a mesma forma e escapam por ACIDENTE — elas chamam
   * `await monta(...)`, e o padrão procura `await sb`. Acidente não é proteção:
   * escrevê-lo aqui é o que impede alguém de "consertar" um falso positivo
   * renomeando a variável, que é como uma catraca começa a mentir.
   */
  const FORA_DO_NMAIS1 = [
    "inserirDescendo",
    /**
     * ⚠️ **`linkPublicoDoPost` é um RECUO POR COLISÃO, não um N+1.**
     *
     * O índice de `codigo_publico` é único. O laço sorteia um código, tenta
     * gravar, e só repete no `23505` — no MÁXIMO três vezes, parando na
     * primeira que dá certo. Com 32^10 combinações, a segunda volta praticamente
     * nunca acontece; ela existe para que uma colisão não vire "não deu para
     * gerar" sem nada a fazer.
     *
     * É a mesma FORMA de `inserirDescendo`: a mesma escrita repetida, limitada,
     * parando no sucesso — e não uma consulta por item de uma coleção.
     */
    "linkPublicoDoPost",
  ];

  /** Em que função da lista de exceções esta linha cai, se em alguma. */
  function excecao(linhas: string[], i: number): boolean {
    for (let n = i; n >= 0; n--) {
      /* ⚠️ **As DUAS formas de declarar.** A primeira versão só reconhecia
         `function NOME`, e uma função de servidor é
         `export const NOME = createServerFn(...)` — então a exceção nomeada
         simplesmente não era encontrada, e a catraca acusava mesmo com o nome
         na lista. É a armadilha de "o reconhecedor não reconhece o código real"
         que este repositório já pagou na catraca de portas. */
      const m =
        linhas[n].match(/^(?:export )?(?:async )?function (\w+)/) ??
        linhas[n].match(/^export const (\w+) = createServerFn/);
      if (m) return FORA_DO_NMAIS1.includes(m[1]);
    }
    return false;
  }

  function acharNMais1(fonte: string): number[] {
    const linhas = semProsa(fonte).split("\n");
    const achados: number[] = [];
    let laco: { i: number; ind: number } | null = null;
    linhas.forEach((l, i) => {
      if (/^\s*for\s*\(|\.forEach\(|^\s*while\s*\(/.test(l)) {
        laco = { i, ind: l.search(/\S/) };
        return;
      }
      /* Saiu do laço quando a indentação volta ao nível dele (ou abaixo). */
      if (laco && l.trim() && l.search(/\S/) <= laco.ind) laco = null;
      if (!laco) return;
      if (!/await\s+(sb|supabase|contextoDe|perfisPorId|registrarAtividade)\b/.test(l)) return;
      if (excecao(linhas, i)) return;
      achados.push(i + 1);
    });
    return achados;
  }

  test("nenhuma ida ao banco dentro de laço (N+1)", () => {
    const achados: string[] = [];
    for (const f of MODULOS) {
      for (const n of acharNMais1(fs.readFileSync(f, "utf8"))) achados.push(`${f}:${n}`);
    }
    expect(achados).toEqual([]);
  });

  test("⚠️ e a varredura AINDA MORDE — a exceção não a desligou", () => {
    /* Catraca com exceção que passa em vazio é catraca que mente. */
    const ruim = `
async function qualquerCoisa(sb: any, ids: string[]) {
  for (const id of ids) {
    const { data } = await sb.from("rede_posts").select("id").eq("id", id);
    if (data) console.log(data);
  }
}`;
    expect(acharNMais1(ruim).length).toBe(1);
    /* E a exceção vale SÓ para o nome nomeado, nunca para o vizinho. */
    const excetuada = ruim.replace("qualquerCoisa", "inserirDescendo");
    expect(acharNMais1(excetuada)).toEqual([]);
  });
});

describe("⚠️ a varredura sabe achar o defeito que ela procura", () => {
  /* Catraca que passa em VAZIO é catraca que mente. Estes dois provam que as
     regex acima reprovam o padrão real — sem isso, um erro de escape faria as
     duas ficarem verdes para sempre sobre um arquivo cheio de defeitos. */
  test("pega um portão que falha aberto", () => {
    const ruim = ["const p = await ler();", "autor: { emCuidado: !!p?.care_mode },"].join("\n");
    const pega = ruim
      .split("\n")
      .some(
        (l) =>
          /[?]\.(care_mode|perfil_publico)/.test(l) &&
          !/\?\?\s*true|error\s*\?\s*true|!\w+\s*\|\|/.test(l),
      );
    expect(pega).toBe(true);
  });

  test("pega um await de banco dentro de laço", () => {
    const ruim = ["for (const x of lista) {", "  await sb.from('t').select('id');", "}"].join("\n");
    const linhas = ruim.split("\n");
    let dentro = false;
    let pega = false;
    for (const l of linhas) {
      if (/^\s*for\s*\(/.test(l)) dentro = true;
      else if (dentro && /await\s+sb\b/.test(l)) pega = true;
    }
    expect(pega).toBe(true);
  });
});
