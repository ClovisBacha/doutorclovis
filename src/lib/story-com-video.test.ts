import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ **O VÍDEO NO STORY, e as travas que ele precisou.**
 *
 * O story só aceitava foto. O vídeo entra pelo MESMO caminho do vídeo do post —
 * URL assinada, arquivo direto para o Storage, `recusaDoVideo` decidindo o que
 * o app aceita — porque duas réguas para "que vídeo cabe aqui" divergiriam no
 * primeiro ajuste.
 *
 * ⚠️ **A CAPA NÃO É ENFEITE.** `imagem_path` é `NOT NULL` em `rede_stories`:
 * sem ela o story de vídeo simplesmente não grava. E é ela que a BOLINHA da
 * fileira desenha — a decisão de tocar acontece ali, e um quadrado preto no
 * convite é um story que ninguém abre.
 */
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");

/**
 * ⚠️ **ESTE ARQUIVO NÃO APAGA OS COMENTÁRIOS, e a decisão é medida.**
 *
 * Apagar prosa antes de procurar é a regra desta base — ela cita o que proíbe e
 * o que exige, e um teste de texto fica verde ou vermelho pela explicação. Mas
 * num `.tsx` de treze mil linhas os dois jeitos de fazer isso QUEBRAM:
 *
 * 1. **Por regex** (`/\/\*[\s\S]*?\*\//g`): `accept="image/*,video/*"` tem um
 *    `/*` DENTRO de uma string. O padrão abre um "comentário" ali e o fecha no
 *    próximo fim de comentário de verdade, centenas de linhas abaixo. Medido: o bloco
 *    inteiro do vídeo do story sumia, e sete asserções ficavam vermelhas sobre
 *    código correto.
 * 2. **Por varredor que conhece strings**: em JSX, `'` e `"` aparecem como TEXTO
 *    ("a capa é o primeiro quadro", `d'água`), e o varredor abre uma string ali,
 *    engolindo o que vier até a próxima aspa. Medido: o `z-20` do véu
 *    desaparecia da varredura estando no arquivo.
 *
 * Acertar isso pede um analisador de verdade. O que serve aqui é mais barato e
 * mais honesto: **ancorar em texto que só existe no CÓDIGO** — um `className=`,
 * uma condição de JSX, uma chamada com os parênteses. A prosa não escreve
 * `className="absolute inset-0 z-20`; ela fala de `z-20`.
 *
 * ⚠️ Por isso este arquivo só faz asserção POSITIVA. Um `not.toContain` aqui
 * seria exatamente o caso em que a prosa mente, e ele não existe de propósito.
 */
const semProsa = TELA;

const SQL = readFileSync("supabase/APLICAR_NOVE_DA_REDE.sql", "utf8");

describe("⚠️ o vídeo do story", () => {
  test("⚠️ a capa sai do PRÓPRIO arquivo, e não de uma segunda escolha", () => {
    /* Pedir uma foto de capa além do vídeo seria dois passos para publicar uma
       coisa só — e a maioria pula o segundo. */
    expect(semProsa).toContain("async function capaDoVideo(file: File)");
    expect(semProsa).toContain("setConferindoStory(capa.capa)");
  });

  test("⚠️ o quadro da capa é o de 0,1 s, e nunca o de ZERO", () => {
    /* Em muitos arquivos o primeiro quadro é preto (fade de abertura do próprio
       celular), e a capa sairia toda escura — o defeito que ela veio evitar. */
    const i = semProsa.indexOf("async function capaDoVideo");
    const c = semProsa.slice(i, semProsa.indexOf("\n}", i));
    expect(c).toContain("v.currentTime = 0.1");
  });

  test("⚠️ e ela tem TETO DE TEMPO — arquivo que não decodifica não trava a tela", () => {
    /* Sem o teto, um arquivo que o navegador não consegue ler deixaria a tela
       presa em "enviando" para sempre, sem erro nenhum. */
    const i = semProsa.indexOf("async function capaDoVideo");
    const c = semProsa.slice(i, semProsa.indexOf("\n}", i));
    expect(c).toMatch(/setTimeout\(\(\) => ok\(false\), \d+\)/);
  });

  test("⚠️ capa impossível RECUSA o vídeo — nunca um story sem capa", () => {
    /* ⚠️ Ancorado DENTRO da guarda, e não numa janela larga: a primeira versão
       procurava `return` em 900 caracteres e ficava verde com o `return` da
       guarda apagado — havia outro logo abaixo. Mutação conferida. */
    const i = semProsa.indexOf("if (!capa) {");
    expect(i).toBeGreaterThan(-1);
    const guarda = semProsa.slice(i, semProsa.indexOf("\n            }", i));
    expect(guarda).toContain("return;");
  });

  test("⚠️ a régua do arquivo é a MESMA do post, e não uma segunda", () => {
    /* Duas réguas para "que vídeo cabe aqui" divergiriam no primeiro ajuste, e
       a divergência apareceria como o app aceitando no story o que recusa no
       post. */
    const i = semProsa.indexOf('if (f.type.startsWith("video/"))');
    const c = semProsa.slice(i, i + 1400);
    expect(c).toContain('await import("@/lib/video-do-post")');
    expect(c).toContain("recusaDoVideo({");
  });

  test("⚠️ a DURAÇÃO vem do decodificador, e a recusa roda DEPOIS dela", () => {
    /* `size` e `type` dão para conferir na hora; quantos segundos o arquivo tem
       só o decodificador sabe — então a capa (que devolve a duração) vem
       primeiro, e a recusa depois. */
    const i = semProsa.indexOf('if (f.type.startsWith("video/"))');
    const c = semProsa.slice(i, i + 1400);
    expect(c.indexOf("capaDoVideo(f)")).toBeLessThan(c.indexOf("recusaDoVideo({"));
    expect(c).toContain("segundos: capa.segundos");
  });

  test("⚠️ o arquivo vai DIRETO para o Storage, com URL assinada", () => {
    /* 50 MB pelo servidor seria a função inteira estourando o limite de corpo. */
    const i = semProsa.indexOf('if (f.type.startsWith("video/"))');
    const c = semProsa.slice(i, i + 1800);
    expect(c).toContain("urlParaSubirVideo({");
    expect(c).toContain("uploadToSignedUrl(r.caminho, r.token, f)");
  });

  test("⚠️ o vídeo é LIDO antes de zerar o estado, como o quadro do post", () => {
    /* Ler depois de zerar publicaria um story de capa PARADA, e o vídeo que ela
       gravou ficaria órfão no balde. */
    /* ⚠️ Recortado até o FIM da função, e não por um número de caracteres: a
       distância nunca foi a garantia, e uma janela curta reprova código certo
       assim que alguém acrescenta um comentário. Já custou uma volta aqui. */
    const i = semProsa.indexOf("async function publicarStory(");
    const c = semProsa.slice(i, semProsa.indexOf("\n  }", i));
    expect(c.indexOf("const comVideo = videoDoStory")).toBeLessThan(
      c.indexOf("setVideoDoStory(null)"),
    );
    expect(c).toContain("video: comVideo");
  });

  test("⚠️ desistir limpa o vídeo — a PRÓXIMA foto não sai com ele pendurado", () => {
    const i = semProsa.indexOf("aoCancelar={() => {");
    const c = semProsa.slice(i, semProsa.indexOf("}}", i));
    expect(c).toContain("setVideoDoStory(null)");
  });

  test("⚠️ com vídeo, o carrossel NÃO é oferecido", () => {
    /* Um story é ou o vídeo, ou a sequência de fotos: `imagem_path` é a capa nos
       dois casos, e a segunda foto viraria um story que nunca aparece. Botão que
       promete e não entrega é pior que botão ausente. */
    expect(semProsa).toContain("{!temVideo && maisFotos.length < 4 && (");
  });
});

describe("⚠️ o visor, e o que o VÉU tem de esconder", () => {
  const i = semProsa.indexOf("export function VisorDeStory");
  const C = semProsa.slice(i, semProsa.indexOf("\nexport function ", i + 10));

  test("o corpo existe (a âncora não silenciou o teste)", () => {
    expect(C.length).toBeGreaterThan(2000);
  });

  test("⚠️ `playsInline` e `muted` — sem os dois o vídeo não toca no iPhone", () => {
    /* Sem `playsInline` o iOS abre o player de tela cheia do sistema e o story
       some por baixo dele; sem `muted` o navegador recusa tocar sozinho, e ela
       veria um quadro parado sem saber que era vídeo. */
    /* ⚠️ **Ancorado em `src={atual.videoUrl}`, e NUNCA em `<video`.** A prosa
       logo acima escreve `<video>` para explicar por que o véu não o monta — e
       a fatia começava DENTRO do comentário, engolindo o elemento inteiro. A
       mutação que tirava `playsInline` passava verde. Terceira forma da mesma
       armadilha neste arquivo. */
    const iv = C.indexOf("src={atual.videoUrl}");
    expect(iv).toBeGreaterThan(-1);
    const v = C.slice(iv, C.indexOf("/>", iv));
    expect(v).toContain("playsInline");
    expect(v).toContain("muted");
    expect(v).toContain("autoPlay");
    /* E a capa vira o `poster`: é o que a tela mostra enquanto o arquivo carrega. */
    expect(v).toContain("poster={atual.imagemUrl");
  });

  test("⚠️ o VÍDEO manda no relógio, e só se a duração for FINITA", () => {
    /* Cinco segundos cravados cortariam ao meio um vídeo de vinte. E `Infinity`
       (stream sem duração) faria o story nunca avançar. */
    expect(C).toContain("const duracao = duracaoDoVideo ?? DURACAO_DO_STORY");
    expect(C).toContain("Number.isFinite(d) && d > 0 ? d * 1000 : null");
  });

  test("⚠️ trocar de story ZERA a duração", () => {
    /* Senão o story seguinte — que pode ser uma foto — herdaria o relógio do
       vídeo de vinte segundos que veio antes. */
    const i2 = C.indexOf("setDuracaoDoVideo(null)");
    expect(i2).toBeGreaterThan(-1);
    expect(C.slice(i2, i2 + 60)).toContain("}, [i])");
  });

  test("⚠️ o VÉU segura o relógio", () => {
    /* Um story marcado como sensível não pode passar sozinho enquanto ela
       decide se quer ver: a decisão que a tela pede aconteceria com o story já
       trocando. */
    const i2 = C.indexOf("if (borrado) return;");
    const j = C.indexOf("const duracao =");
    expect(i2).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i2);
  });

  test("⚠️ a régua do véu é `deveBorrar`, e nunca uma condição escrita aqui", () => {
    /* Duas réguas para "esconder ou não" divergiriam no primeiro ajuste, e a
       divergência apareceria como o véu valendo no feed e não no story. */
    expect(C).toContain("const borrado = deveBorrar({");
    expect(C).toContain("souAAutora: souEu");
  });

  test("⚠️ o véu fica ACIMA das metades invisíveis de avançar/voltar", () => {
    /**
     * ⚠️ **Foi a FOTO da bancada que pegou.** Sem `z-20`, o botão "Próximo"
     * (`inset-y-0 right-0 w-2/3`) fica por cima do véu e engole o toque: ela
     * toca querendo decidir, o story AVANÇA, e o seguinte aparece sem véu
     * nenhum. A decisão que a tela pede nunca acontece. É a mesma trava que a
     * enquete e a caixinha já tinham, e o véu nasceu sem ela.
     */
    const i2 = C.indexOf("setReveladoStory(atual.id)");
    expect(i2).toBeGreaterThan(-1);
    /* Ancorado no `className=` inteiro: a prosa acima FALA de `z-20`, e um
       `toContain("z-20")` ficaria verde por causa dela. */
    expect(C.slice(i2, i2 + 900)).toContain('className="absolute inset-0 z-20');
  });

  test("⚠️ sob o véu NÃO se reage, não se vota, não se pergunta e não se responde", () => {
    /**
     * ⚠️ **Também achado na FOTO.** Com o aviso em pé, a fileira de emojis
     * continuava à mostra: ela reagiria a um story que não viu, e o afago
     * chegaria à caixa da autora vindo de quem não leu nada. Sob o véu a tela
     * pede UMA decisão, e mais nada é oferecido.
     */
    for (const gate of [
      "{!borrado && !souEu && aoReagirAoStory",
      "{!borrado && atual.enquete && (",
      "{!borrado && atual.perguntaAberta && !souEu",
      "{!borrado && aoResponderStory && (",
      "{!borrado && atual.texto && (",
    ]) {
      expect(C).toContain(gate);
    }
  });
});

describe("⚠️ o SQL do vídeo no story", () => {
  test("⚠️ a coluna nasce por ALTER, e nunca dentro do CREATE TABLE", () => {
    /* `rede_stories` já existe no banco do dono: num `CREATE TABLE IF NOT
       EXISTS` a coluna nova NUNCA nasce, e re-rodar o SQL não conserta. Foi
       exatamente assim que `carimbo_semana` passou a existir só no papel. */
    expect(SQL).toContain(
      "ALTER TABLE public.rede_stories ADD COLUMN IF NOT EXISTS video_path text",
    );
    /* ⚠️ E a checagem que importa: `video_path` NÃO aparece dentro de nenhum
       `CREATE TABLE`. A primeira versão desta asserção contava blocos e não
       provava nada — contar não é conferir. */
    for (const bloco of SQL.split("CREATE TABLE").slice(1)) {
      const corpo = bloco.slice(0, bloco.indexOf(");"));
      expect(corpo).not.toContain("video_path");
    }
  });
});
