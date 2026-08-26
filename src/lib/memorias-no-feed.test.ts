import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ **AS MEMÓRIAS — o recurso mais perigoso da aba, ligado de ponta a ponta.**
 *
 * A régua (`memorias.ts`) já existia com as travas e os testes; faltavam o
 * servidor e a tela. Este arquivo cobre a CORRENTE: que o handler obedeça a
 * régua em vez de reescrevê-la, que a marca de "vista" saia do lugar certo, e
 * que a tela não invente uma segunda condição.
 *
 * ⚠️ Ancorado em texto que só existe no CÓDIGO, e só com asserção POSITIVA —
 * ver a razão medida em `story-com-video.test.ts`.
 */
const SERVIDOR = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const REGUA = readFileSync("src/lib/memorias.ts", "utf8");

/**
 * Recorta uma função, **sem o bloco de doc do vizinho**.
 *
 * ⚠️ A primeira versão fatiava até o próximo `export const` — e o bloco `/**`
 * que EXPLICA a função seguinte fica antes dela, dentro da fatia. Quando
 * `meuAlbum` nasceu ao lado, o comentário dele ("NÃO EXISTE `alvoId`") entrou
 * no corpo de `memoriaDoFeed` e reprovou um `not.toContain("alvoId")` sobre
 * código que está correto. É a décima primeira vez que a prosa quebra um teste
 * de texto nesta base, agora pela porta do VIZINHO.
 */
const corpo = (fonte: string, abre: string, fecha: string) => {
  const i = fonte.indexOf(abre);
  if (i < 0) return "";
  const fins = [fonte.indexOf(fecha, i + 10), fonte.indexOf("\n/**", i + 10)].filter((n) => n > 0);
  return fonte.slice(i, fins.length ? Math.min(...fins) : undefined);
};

const HANDLER = corpo(SERVIDOR, "export const memoriaDoFeed", "\nexport const ");
const MARCAR = corpo(SERVIDOR, "export const marcarMemoriaVista", "\nexport const ");
const CARTAO = corpo(TELA, "function CartaoDaMemoria(", "\nexport function ");

describe("⚠️ o servidor OBEDECE a régua — nunca a reescreve", () => {
  test("as âncoras existem (senão o arquivo passa em vazio)", () => {
    expect(HANDLER.length).toBeGreaterThan(800);
    expect(MARCAR.length).toBeGreaterThan(300);
    expect(CARTAO.length).toBeGreaterThan(500);
  });

  test("⚠️ quem escolhe é `memoriaDeHoje`, e ela recebe as CINCO entradas", () => {
    /* Uma condição escrita no handler seria a segunda régua do recurso que mais
       pode machucar nesta aba — e a divergência apareceria como a foto da
       barriga de uma gestação que terminou voltando na abertura do app. */
    expect(HANDLER).toContain("memoriaDeHoje({");
    for (const campo of ["cicloAtual:", "careMode:", "nascimento:", "agora:", "posts:"]) {
      expect(HANDLER).toContain(campo);
    }
  });

  test("⚠️ o ciclo vem de `cicloParaCarimbo`, que devolve `null` no lugar de `x`", () => {
    /* No ledger `"x"` é chave válida; numa memória, "não sei de que gestação
       isto é" tem de significar NÃO MOSTRAR — senão as publicações de todas as
       gestações sem marco caem no mesmo balde e voltam umas para as outras. */
    expect(HANDLER).toContain("cicloParaCarimbo(perfil)");
  });

  test("⚠️ `careMode` vira `undefined` sem perfil — e a régua cala nesse caso", () => {
    /* Aqui só não se pode MENTIR o valor: `!!perfil.care_mode` com perfil nulo
       daria `false`, que a régua leria como "não está de luto". */
    expect(HANDLER).toContain("careMode: perfil ? !!perfil.care_mode : undefined");
  });

  test("⚠️ o ARQUIVADO sai na CONSULTA — senão a Trava 3 fica morta", () => {
    /* `COLUNAS_DO_POST` não traz `arquivado_em`: sem o filtro, `arquivada`
       viraria `false` para todo mundo e o que ela tirou do ar voltaria como
       memória. */
    expect(HANDLER).toContain('.is("arquivado_em", null)');
  });

  test("⚠️ SÓ AS MINHAS: não existe alvo vindo do cliente", () => {
    /* Um parâmetro aqui seria a porta para ler o passado de qualquer paciente
       trocando um uuid. */
    expect(HANDLER).toContain('.eq("autor_id", eu)');
    expect(HANDLER).not.toContain("alvoId");
  });

  test("⚠️ falha ao ler as VISTAS cala — nunca repete a memória todo dia", () => {
    expect(HANDLER).toContain("naoSeiAsVistas");
    expect(HANDLER).toContain("if (naoSeiAsVistas) return { ok: true as const, memoria: null }");
  });

  test("⚠️ o HANDLER não marca nada como vista", () => {
    /**
     * ⚠️ A tela mostra UM cartão de cada vez, e a retrospectiva de domingo ganha
     * da memória. Marcando no CÁLCULO, uma memória suprimida pela tela seria
     * queimada sem nunca ter aparecido — e a Trava 4 vale para a vida toda,
     * então ela não voltaria nunca.
     */
    expect(HANDLER).not.toContain('.from("rede_memorias_vistas").insert');
    expect(HANDLER).not.toContain('rede_memorias_vistas")\n      .insert');
  });

  test("⚠️ quem marca é `marcarMemoriaVista`, com o `eu` do SERVIDOR", () => {
    expect(MARCAR).toContain('.from("rede_memorias_vistas")');
    expect(MARCAR).toContain("insert({ quem_id: eu, post_id: data.postId })");
    /* Colidir na chave é sucesso repetido, nunca erro. */
    expect(MARCAR).toContain('!== "23505"');
  });
});

describe("⚠️ a tela desenha, e não decide", () => {
  test("⚠️ o cartão não tem condição nenhuma sobre luto, ciclo ou idade", () => {
    for (const proibido of ["careMode", "care_mode", "ciclo", "IDADE_MINIMA", "JANELA_DIAS"]) {
      expect(CARTAO).not.toContain(proibido);
    }
  });

  test("⚠️ a marca sai do MONTAR, com trava de repetição", () => {
    /* O efeito pode rodar duas vezes em desenvolvimento, e a memória do dia
       seguinte é outra — daí o `useRef` com o id. */
    expect(CARTAO).toContain("const marcada = useRef<string | null>(null)");
    expect(CARTAO).toContain("if (marcada.current === memoria.post.id) return");
    expect(CARTAO).toContain("aoVer?.(memoria.post.id)");
    expect(CARTAO).toContain("}, [memoria.post.id, aoVer]);");
  });

  test("⚠️ o texto vem PRONTO do servidor — a tela não escreve adjetivo", () => {
    /* "Que ano incrível!" cai numa mulher que pode ter passado o ano no
       hospital. `textoDaMemoria` diz o fato e para aí. */
    expect(CARTAO).toContain("{memoria.texto}");
    expect(REGUA).toContain("export function textoDaMemoria");
  });

  test("⚠️ e o `alt` nunca é vazio", () => {
    /* `alt=""` faz o leitor de tela PULAR a imagem. */
    expect(CARTAO).toContain('altTexto ?? "A sua publicação de um ano atrás"');
  });

  test("⚠️ UM CARTÃO DE CADA VEZ, e a memória vence o lembrete", () => {
    /**
     * ⚠️ **A ordem é por QUEM VOLTA.** A memória tem janela de três dias e não
     * volta NUNCA (a Trava 4 vale para a vida toda); o lembrete do "então e
     * agora" reaparece por conta própria. Perder a memória é perder para
     * sempre. E a retrospectiva ganha das duas: ela só existe aos domingos.
     */
    /* ⚠️ Por regex, e não pela abertura literal: o prettier junta o JSX numa
       linha só quando ele cabe, e travar `(` reprovaria uma formatação. */
    expect(TELA).toMatch(/\{!retro && memoria && </);
    expect(TELA).toMatch(/\{!retro && !memoria && lembreteEntao &&/);
  });

  test("⚠️ falha de rede vira `null` — o lado seguro DESTE recurso", () => {
    /* Ao contrário de quase toda a rede, onde "não consegui ler" tem de virar
       ERRO: aqui o pior caso de calar é um agrado que não aconteceu, e o de
       mostrar é devolver a foto de uma perda. */
    const efeito = corpo(TELA, "const { memoriaDoFeed } = await import", "}, [onde.t, euId]);");
    expect(efeito).toContain("setMemoria(r.ok ? (r.memoria ?? null) : null)");
    expect(efeito).toContain("if (vivo) setMemoria(null)");
  });
});

describe("⚠️ a Trava 5, e por que ela nasceu", () => {
  test("⚠️ o sinal é POSITIVO (nascimento), nunca a ausência de Modo Cuidado", () => {
    /**
     * ⚠️ **Modo Cuidado é OPT-IN.** Uma mulher que perdeu a gestação e não
     * contou ao app fica com o `lmp_date` intacto: o ciclo continua o mesmo, a
     * Trava 2 não morde, e ~300 dias depois ela receberia "Há um ano, você
     * publicou isto" com a foto da barriga.
     */
    expect(REGUA).toContain("if (!entrada.nascimento) return null;");
    expect(HANDLER).toContain("nascimento: (perfil?.birth_date ?? null) as string | null");
  });

  test("⚠️ e ela vem ANTES da Trava 2 — a ordem é a de custo", () => {
    const f = corpo(REGUA, "export function memoriaDeHoje", "\n  const hoje");
    expect(f.indexOf("careMode !== false")).toBeLessThan(f.indexOf("!entrada.nascimento"));
    expect(f.indexOf("!entrada.nascimento")).toBeLessThan(f.indexOf("!entrada.cicloAtual"));
  });
});
