/**
 * A CONTA DO BYTE — as quatro decisões que baixam o custo de banda, e o que
 * cada uma quebra se for desfeita.
 *
 * Elas não têm nada em comum no código (uma é um TTL, outra um teto, outra um
 * `remove`, outra um número de qualidade) e têm tudo em comum no efeito: as
 * quatro existem porque a Comunidade paga EGRESSO, e egresso é o que cresce
 * junto com o número de pacientes. Um arquivo só, para quem for mexer em
 * qualquer uma delas encontrar o argumento das outras três.
 *
 * ⚠️ **O QUE SE COBRA É A GARANTIA, NUNCA O NÚMERO.** Todo valor abaixo é lido
 * da constante — travar "15" ou "0,72" aqui reprovaria o próximo ajuste sobre
 * código que continua certo, que é o erro que este repositório já pagou uma
 * dúzia de vezes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  VALIDADE_FOTO_SEG,
  VALIDADE_STORY_SEG,
  MARGEM_DE_RENOVACAO_SEG,
  aindaServe,
  separarGuardadas,
  expiraEmSegundos,
} from "./imagens.server";
import { BYTES_MAX, recadoDaRecusa } from "./video-do-post";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const REDE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const REDE_SEM = semComentarios(REDE);
const TELA_SEM = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));

/**
 * OS ARGUMENTOS DE UMA CHAMADA, com os parênteses BALANCEADOS.
 *
 * ⚠️ Uma regex `\([^)]*\)` para no primeiro `)`, e a chamada de
 * `storiesDoFeed` tem um `.flatMap((l) => [...])` no meio — a asserção "passa
 * a validade certa" ficava verde sem nunca ter chegado ao argumento. Contar
 * parênteses é exato e custa três linhas; medir distância seria a armadilha de
 * sempre.
 */
function argumentosDe(fonte: string, chamada: string): string {
  const i = fonte.indexOf(chamada);
  expect(i).toBeGreaterThan(-1);
  let nivel = 0;
  for (let j = i + chamada.length - 1; j < fonte.length; j++) {
    if (fonte[j] === "(") nivel++;
    else if (fonte[j] === ")" && --nivel === 0) return fonte.slice(i, j + 1);
  }
  throw new Error(`parênteses não fecham em ${chamada}`);
}

/**
 * A POSIÇÃO DE UM TRECHO — e ela nunca é −1.
 *
 * ⚠️ `indexOf` devolve **−1** quando a linha é APAGADA, e `-1 < qualquer` é
 * verdadeiro: uma asserção de ordem escrita com `indexOf` cru fica VERDE
 * exatamente na mutação que remove o passo. Foi assim que "lê os caminhos
 * antes do delete" aprovou um `apagarStory` sem leitura nenhuma.
 */
function onde(trecho: string, alvo: string): number {
  const i = trecho.indexOf(alvo);
  /* ⚠️ Sem a segunda mensagem: `expect(valor, "recado")` NÃO é tipado no
     `bun:test`, e o `tsc` da CI reprova — a mesma família do `toMatchObject`.
     Quem diz o que sumiu é o nome do teste. */
  expect(i).toBeGreaterThan(-1);
  return i;
}

function corpo(fonte: string, marca: string, ate = "\nexport const "): string {
  const i = fonte.indexOf(marca);
  expect(i).toBeGreaterThan(-1);
  const j = fonte.indexOf(ate, i + marca.length);
  return fonte.slice(i, j === -1 ? fonte.length : j);
}

describe("1 · a foto do feed é assinada por dias, e a URL é ESTÁVEL", () => {
  test("a validade da foto é muito maior que a de uma leitura de tela", () => {
    /* Uma hora era o padrão herdado: dentro de uma sessão a mesma foto já
       chegava com token novo, e token novo é CHAVE DE CACHE nova — o navegador
       rebaixava tudo. Dias fazem a segunda visita não custar banda nenhuma. */
    expect(VALIDADE_FOTO_SEG).toBeGreaterThanOrEqual(24 * 3600);
  });

  test("⚠️ o story NÃO herda a validade da foto — ele promete sumir em 24 h", () => {
    /* Uma URL de sete dias sobreviveria à promessa do formato: quem guardou o
       endereço continuaria abrindo a foto uma semana depois de ela ter sumido
       do visor de todo mundo. */
    expect(VALIDADE_STORY_SEG).toBeLessThanOrEqual(24 * 3600);
    expect(VALIDADE_STORY_SEG).toBeLessThan(VALIDADE_FOTO_SEG);
  });

  test("⚠️ o feed pede a validade LONGA, e a fileira de stories a CURTA", () => {
    /* Sem isto o TTL existe e ninguém o usa: o padrão de `urlsAssinadas`
       continua sendo uma hora, e a mudança inteira vira constante morta. */
    /* ⚠️ **ANCORADO NA CHAMADA, e nunca no nome solto.** A constante aparece
       também no `import` destruturado dentro da própria função — procurá-la no
       corpo deixa passar a mutação que a tira do ARGUMENTO, e aí o padrão de
       uma hora volta a valer com o teste verde. Décima vez que "outra
       ocorrência do mesmo nome" engana um teste nesta base. */
    expect(
      argumentosDe(corpo(REDE_SEM, "export async function montarPosts"), "urlsAssinadas("),
    ).toContain("VALIDADE_FOTO_SEG");
    expect(argumentosDe(corpo(REDE_SEM, "export const storiesDoFeed"), "urlsAssinadas(")).toContain(
      "VALIDADE_STORY_SEG",
    );
  });

  test("⚠️ uma URL guardada é REAPROVEITADA enquanto ainda dura", () => {
    /* O coração da mudança, e o que o TTL sozinho não entrega: `expiresIn` é
       RELATIVO, então re-assinar produz outro `exp`, outro token e outro
       endereço — o cache do navegador erra igual, com validade de sete dias ou
       de uma hora. Só a memória torna a URL estável, e quem decide se a
       guardada ainda vale é `aindaServe`. */
    const agora = 1_700_000_000;
    const comExp = (exp: number) =>
      `https://x/a.jpg?token=a.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.b`;

    expect(expiraEmSegundos(comExp(agora + 99))).toBe(agora + 99);
    expect(aindaServe(comExp(agora + VALIDADE_FOTO_SEG), agora)).toBe(true);
    /* Perto de vencer, ela é refeita — senão a foto quebraria no meio da
       rolagem de quem está com o feed aberto. */
    expect(aindaServe(comExp(agora + 60), agora)).toBe(false);
    /* E lixo não é reaproveitado: sem `exp` legível, vale re-assinar. */
    expect(aindaServe("https://x/a.jpg", agora)).toBe(false);
  });

  test("⚠️ COM VALIDADE DE UMA HORA A MEMÓRIA SERIA CÓDIGO MORTO", () => {
    /* O acoplamento que o TTL escondia, e a razão de as duas mudanças terem de
       andar juntas: a margem de renovação é de doze horas, então uma URL que
       nasce valendo uma hora JÁ NASCE dentro da margem — `aindaServe` responde
       `false` na leitura seguinte, e toda foto é re-assinada como antes. Subir
       o TTL sem a memória não muda nada; pôr a memória sem subir o TTL também
       não. */
    const agora = 1_700_000_000;
    const nasceValendo = (seg: number) =>
      aindaServe(
        `https://x/a.jpg?token=a.${Buffer.from(JSON.stringify({ exp: agora + seg })).toString(
          "base64url",
        )}.b`,
        agora,
      );
    expect(nasceValendo(3600)).toBe(false);
    expect(nasceValendo(VALIDADE_FOTO_SEG)).toBe(true);
    expect(nasceValendo(VALIDADE_STORY_SEG)).toBe(true);
    expect(VALIDADE_FOTO_SEG).toBeGreaterThan(MARGEM_DE_RENOVACAO_SEG);
    expect(VALIDADE_STORY_SEG).toBeGreaterThan(MARGEM_DE_RENOVACAO_SEG);
  });

  test("⚠️ a régua da memória: já guardada não vai ao servidor", () => {
    /* A decisão inteira, pura. Enterrada no `for` de `urlsAssinadas` ela só
       era asserível por TEXTO — e um `if (false && …)` passava por isso. */
    const agora = 1_700_000_000;
    const boa = (exp: number) =>
      `https://x?token=a.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.b`;
    const guardadas: Record<string, string> = {
      "a.jpg": boa(agora + VALIDADE_FOTO_SEG),
      "b.jpg": boa(agora + 60), // perto de vencer
      "c.jpg": "lixo sem token",
    };
    const r = separarGuardadas((c) => guardadas[c], ["a.jpg", "b.jpg", "c.jpg", "d.jpg"], agora);
    /* Só a que ainda dura é reaproveitada. */
    expect([...r.prontas.keys()]).toEqual(["a.jpg"]);
    expect(r.prontas.get("a.jpg")).toBe(guardadas["a.jpg"]);
    /* ⚠️ E as outras três vão para a assinatura — inclusive a que existe mas
       está perto de vencer, senão a foto quebraria no meio da rolagem. */
    expect(r.faltando).toEqual(["b.jpg", "c.jpg", "d.jpg"]);
  });

  test("⚠️ `urlsAssinadas` usa a régua, e assina só o que faltou", () => {
    /* A corrente: sem `faltando` na chamada ao Storage, a memória guarda e a
       ida continua trazendo tudo — a economia inteira jogada fora. E sem o
       teto, a memória de módulo cresce sem fim num servidor que não reinicia. */
    const F = corpo(
      semComentarios(readFileSync("src/lib/imagens.server.ts", "utf8")),
      "export async function urlsAssinadas",
      "\nexport ",
    );
    expect(F).toContain("separarGuardadas(");
    expect(F).toMatch(/createSignedUrls\(\s*faltando/);
    expect(F).toContain("memoriaDeUrls.set(");
    expect(F).toContain("TETO_DA_MEMORIA");
  });
});

describe("2 · o teto do vídeo", () => {
  test("é da ordem de dezenas de MB, e o recado DIZ o número", () => {
    /* 50 MB num story visto por vinte pessoas é 1 GB de egresso por
       publicação. O teto é o único freio, porque a duração sozinha não limita
       bitrate nenhum. */
    expect(BYTES_MAX).toBeLessThanOrEqual(20 * 1024 * 1024);
    expect(recadoDaRecusa("tamanho")).toContain(String(Math.round(BYTES_MAX / 1024 / 1024)));
  });
});

describe("3 · o story apagado leva o arquivo junto", () => {
  const APAGAR = corpo(REDE_SEM, "export const apagarStory");

  test("lê os caminhos ANTES do delete, e pela escada", () => {
    /* Depois do DELETE não há como saber que arquivos eram dela. E um `select`
       à mão com `imagens`/`video_path` falharia inteiro num banco atrasado. */
    expect(onde(APAGAR, "storiesCrus")).toBeLessThan(onde(APAGAR, ".delete()"));
  });

  test("remove do balde DEPOIS do delete", () => {
    /* Invertido, um `remove` bem-sucedido com o DELETE falhando deixaria a
       linha viva apontando para um arquivo que não existe. */
    expect(onde(APAGAR, '.from("rede")')).toBeGreaterThan(onde(APAGAR, ".delete()"));
    expect(APAGAR).toContain(".remove(");
  });

  test("recolhe as TRÊS origens de arquivo de um story", () => {
    /* Foto única, vídeo e carrossel. Esquecer `imagens` deixaria órfãos
       justamente os stories mais pesados. */
    for (const campo of ["imagem_path", "video_path", "imagens"]) {
      expect(APAGAR).toContain(campo);
    }
  });

  test("⚠️ falha no balde NÃO derruba o apagar", () => {
    /* Ela pediu para o story sumir. Um arquivo órfão é infinitamente melhor
       que um story que ela mandou apagar e continua na tela. */
    expect(APAGAR).toContain("try {");
    expect(APAGAR).toContain("console.warn");
  });

  test("⚠️ o caminho no balde continua sendo ÚNICO por upload", () => {
    /* A trava que torna o `remove` seguro: `guardarImagem` nomeia por
       `randomUUID`, nunca por hash do conteúdo, e o story feito a partir de um
       post SOBE UMA CÓPIA. No dia em que a nomeação virar endereçamento por
       conteúdo, apagar um story passa a apagar a foto da publicação junto — e
       este teste é onde isso aparece. */
    const guardar = corpo(
      semComentarios(readFileSync("src/lib/imagens.server.ts", "utf8")),
      "export async function guardarImagem",
      "\nexport ",
    );
    expect(guardar).toContain("crypto.randomUUID()");
    expect(guardar).not.toContain("createHash");
  });

  test("⚠️ o POST continua sendo ARQUIVADO, e nunca apagado do balde", () => {
    /* A diferença que justifica o bloco acima, e o nome da função mente sobre
       ela: `apagarPost` ARQUIVA — as reações apontam para a linha, e o arquivo
       tem de continuar existindo. Um `remove` ali seria o defeito, não a
       simetria. */
    expect(corpo(REDE_SEM, "export const apagarPost")).not.toContain(".remove(");
  });
});

describe("4 · a qualidade da foto", () => {
  test("é 0,72 ou menos, e vale para as TRÊS que sobem daqui", () => {
    /* Publicação, story e capa de vídeo aparecem no mesmo tamanho de tela.
       Três constantes divergiriam no primeiro ajuste. */
    const m = TELA_SEM.match(/const QUALIDADE_DA_FOTO = ([\d.]+);/);
    expect(m).not.toBeNull();
    const q = Number(m![1]);
    expect(q).toBeLessThanOrEqual(0.72);
    /* ⚠️ E não menos que 0,70: abaixo disso o JPEG mostra blocagem em pele e
       em céu, que é do que uma foto de gestação é feita. */
    expect(q).toBeGreaterThanOrEqual(0.7);
    expect(TELA_SEM.match(/toDataURL\("image\/jpeg", QUALIDADE_DA_FOTO\)/g)).toHaveLength(3);
    expect(TELA_SEM).not.toContain('toDataURL("image/jpeg", 0.8)');
  });

  test("⚠️ o LADO continua em 1080 — o corte é de qualidade, não de pixel", () => {
    /* 1080 é o que uma tela de densidade 3 pede a 393 pontos de largura.
       Reduzir aqui entregaria foto de bebê borrada, que é o que a paciente
       veio ver. */
    expect(TELA_SEM).toContain("const LADO_DA_FOTO = 1080;");
  });
});
