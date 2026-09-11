/**
 * AS TRÊS QUE ESTAVAM PELA METADE.
 *
 * A verificação item a item dos 28 achou três recursos com servidor/régua
 * prontos e SEM tela — a mesma família das sete funções de servidor sem porta,
 * e do seletor de comentários que o componente desfazia.
 *
 * ⚠️ A catraca de réguas não pegou porque `conversa.ts` não estava na lista
 * dela: ela cobria onze módulos e a rede tem muito mais. Catraca com lista à
 * mão dá sensação de cobertura exatamente onde não há.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AUDIO_BYTES_MAX,
  AUDIO_SEGUNDOS_MAX,
  acharNaConversa,
  ordenarConversasComFixadas,
} from "./conversa";

const semProsa = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const TELA = semProsa(readFileSync("src/components/rede-conversa.tsx", "utf8"));
const SERV = semProsa(readFileSync("src/lib/conversa.functions.ts", "utf8"));

describe("⚠️ fixar conversa — gravava e a lista NÃO se mexia", () => {
  test("as fixadas sobem, e o resto mantém a ordem do servidor", () => {
    const l = [
      { id: "a", fixadaEm: null },
      { id: "b", fixadaEm: "2026-08-20T10:00:00Z" },
      { id: "c", fixadaEm: null },
    ];
    expect(ordenarConversasComFixadas(l).map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  test("⚠️ a ORDEM é aplicada no SERVIDOR, no retorno da lista", () => {
    /**
     * O ⋯ dizia "Fixar no topo", o servidor gravava a coluna e a leitura
     * devolvia `fixadaEm` — e a lista continuava ordenada só por `ultima_em`.
     * Cada metade estava certa sozinha; faltava a corrente.
     *
     * A garantia é que o valor devolvido seja o RETORNO da régua, nunca a lista
     * crua — e no servidor, porque ordenar na tela faria a lista pular depois
     * da primeira pintura.
     */
    expect(SERV).toMatch(/conversas: ordenarConversasComFixadas\(saida\)/);
    expect(SERV).toContain('await import("./conversa")');
  });

  test("sem nenhuma fixada, devolve a lista como veio", () => {
    const l = [{ id: "a", fixadaEm: null }, { id: "b" }];
    expect(ordenarConversasComFixadas(l).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("⚠️ busca na conversa — régua sem uma linha de tela", () => {
  test("acha por trecho, sem caixa e sem o que foi apagado", () => {
    const m = [
      { id: "1", texto: "Fui no PS ontem" },
      { id: "2", texto: "que susto", apagada: true },
      { id: "3", texto: "melhorou hoje" },
    ];
    expect(acharNaConversa(m, "ps").map((x) => x.id)).toEqual(["1"]);
    expect(acharNaConversa(m, "susto")).toEqual([]);
  });

  test("⚠️ termo curto demais não busca — senão tudo casa", () => {
    expect(acharNaConversa([{ id: "1", texto: "oi" }], "o")).toEqual([]);
  });

  test("⚠️ a busca é LOCAL: nenhuma função de servidor recebe o termo", () => {
    /**
     * Buscar no servidor mandaria o TERMO pela rede — e o termo é o que ela
     * está procurando numa conversa privada: "sangramento", o nome de um
     * hospital, o nome de uma pessoa.
     */
    expect(SERV).not.toContain("acharNaConversa");
    expect(SERV).not.toMatch(/termo:\s*z\./);
  });

  test("a tela chama a régua e DESTACA, sem filtrar a lista", () => {
    /* Esconder as outras arrancaria cada achado do redor que lhe dá sentido. */
    expect(TELA).toContain("acharNaConversa(mensagens, termo)");
    expect(TELA).toContain("achadasIds.has(m.id)");
    expect(TELA).toContain("{mensagens.map(");
  });
});

describe("⚠️ voz no direct — servidor pronto, ZERO tela", () => {
  test("a tela grava, sobe e envia", () => {
    expect(TELA).toContain("gravar()");
    expect(TELA).toContain("subirAudio(");
    expect(TELA).toMatch(/audioPath: caminho/);
    expect(TELA).toMatch(/duracaoSeg: duracao/);
  });

  test("⚠️ `gravar()` roda DENTRO do toque, sem `await` antes", () => {
    /**
     * `getUserMedia` exige gesto do usuário no iOS; depois de uma espera o
     * gesto já passou e a permissão é recusada em silêncio. É a mesma armadilha
     * do `destravar()` dos Sons para dormir.
     */
    const f = TELA.slice(TELA.indexOf("function comecarAGravar"));
    const corpo = f.slice(0, f.indexOf("\n  }"));
    expect(corpo).not.toContain("await");
    expect(corpo).toContain("gravar()");
  });

  test("⚠️ o áudio grande é recusado ANTES de enviar", () => {
    /**
     * Deixar passar faria o servidor recusar depois de ela ter falado — e o que
     * ela falou some. O recado tem de ser ESPECÍFICO ("ficou grande demais"),
     * não o genérico de falha de rede: só o primeiro diz o que fazer diferente.
     *
     * ⚠️ A âncora é o corpo de `pararEEnviar`, e não o arquivo: a mesma
     * comparação existe dentro de `subirAudio`, então um `toContain` solto
     * ficava VERDE com a checagem daqui apagada. Sétima vez que "outra
     * ocorrência do mesmo nome" engana um teste neste repositório.
     */
    const f = TELA.slice(TELA.indexOf("async function pararEEnviar"));
    const corpo = f.slice(0, f.indexOf("\n  }"));
    expect(corpo).toContain("audio.size > AUDIO_BYTES_MAX");
    expect(corpo).toMatch(/grande demais/);
    expect(AUDIO_BYTES_MAX).toBeGreaterThan(0);
  });

  test("⚠️ a gravação PARA sozinha no teto", () => {
    /* Um toque esquecido gravaria até estourar o tamanho. */
    expect(TELA).toMatch(/n \+ 1 >= AUDIO_SEGUNDOS_MAX/);
    expect(AUDIO_SEGUNDOS_MAX).toBe(120);
  });

  test("⚠️ o microfone só aparece onde o navegador GRAVA", () => {
    /* Microfone desenhado numa tela que não grava promete e não cumpre. */
    expect(TELA).toMatch(/temMicrofone && !texto\.trim\(\)/);
  });

  test("⚠️ e `podeGravar()` é lido DEPOIS DE MONTAR, nunca no render", () => {
    /**
     * ⚠️ **ISTO QUEBROU A HIDRATAÇÃO, e só o navegador pegou.** `podeGravar()`
     * toca `navigator`: no SSR devolve `false`, no cliente `true`. Chamado no
     * render, o HTML do servidor sai SEM o microfone e a primeira pintura do
     * cliente sai COM ele — o React descarta a árvore inteira. É o mesmo
     * defeito do `location.origin` no render, que este repositório já pagou
     * duas vezes, e o padrão certo estava a três arquivos de distância.
     */
    expect(TELA).toContain("useEffect(() => setTemMicrofone(podeGravar()), [])");
    expect(TELA).toContain("const [temMicrofone, setTemMicrofone] = useState(false)");
  });

  test("⚠️ e a bolha TOCA o áudio — sem player, ele chega e não abre", () => {
    expect(TELA).toContain("m.audioUrl && (");
    expect(TELA).toContain("controls");
    expect(TELA).toContain('preload="none"');
  });

  test("⚠️ e a BANCADA desenha uma mensagem de voz", () => {
    /**
     * A voz passou despercebida justamente porque a bancada não desenhava
     * nenhuma: sem um áudio na lista, a tela nunca mostrava o buraco. Bancada
     * que não consegue provar o recurso é bancada que aprova qualquer coisa.
     */
    const B = semProsa(readFileSync("src/routes/preview-instagram.tsx", "utf8"));
    expect(B).toContain("audioUrl:");
    expect(B).toMatch(/duracaoSeg: \d+/);
  });

  test("⚠️ o áudio sobe pela MESMA função da foto — a regra da pasta é uma só", () => {
    /**
     * A pasta (`pastaDe`, sha256 do uuid) é o que impede o id da paciente de
     * vazar na URL assinada. Duas funções divergiriam nela no primeiro conserto.
     */
    expect(TELA).toContain("mod.urlParaSubirNaConversa({");
    expect(SERV).toContain('z.enum(["jpg", "png", "webp", "m4a", "webm", "ogg"])');
  });
});
