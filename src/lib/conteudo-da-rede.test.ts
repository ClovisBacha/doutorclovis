import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  FIGURINHAS,
  FIGURINHAS_POR_ID,
  figurinhaDoTexto,
  previaDaFigurinha,
  textoDaFigurinha,
} from "./figurinhas";
import { previaDaMensagem } from "./conversa";

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const CONVERSA = readFileSync("src/components/rede-conversa.tsx", "utf8");
const SQL = readFileSync("supabase/APLICAR_CONTEUDO_DA_REDE.sql", "utf8");
/**
 * ⚠️ **A PROSA DO SQL CITA O QUE ELE PROÍBE, e o teste caiu nisso.** O
 * comentário de `lugar` explica por que NÃO se guarda latitude e longitude — e a
 * busca por "latitude" achava justamente a explicação. Décima vez que a prosa
 * quebra um teste de texto nesta base.
 */
const SQL_SEM_PROSA = SQL.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^--.*$/gm, " ");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const s = semProsa(FONTE);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ o carrossel de story", () => {
  test("o teto é CINCO, e não dez como o post", () => {
    /* O story é folheado com o dedo em pé, com a barrinha correndo: cinco já é
       uma sequência que muita gente não termina, e o formato existe para ser
       rápido. */
    expect(SQL).toContain("array_length(imagens, 1) <= 5");
    expect(corpoDe("publicarStory")).toContain("max(4)");
  });

  test("⚠️ o carrossel é um DEGRAU PRÓPRIO, e o mais alto", () => {
    /**
     * ⚠️ **A primeira versão pôs `imagens` no `base` — e o `base` é o que o
     * degrau MÍNIMO insere.** Num banco sem a coluna, publicar story falharia
     * INTEIRO, inclusive o de foto única, que é o caso de todo mundo hoje. O
     * teste dos três degraus pegou.
     */
    const c = corpoDe("publicarStory").replace(/\s+/g, " ");
    expect(c).toContain("const base = { autor_id: eu, imagem_path: caminho, texto: data.texto }");
    /**
     * ⚠️ **A GARANTIA É "o degrau mínimo não pede a coluna nova", e não a ordem
     * entre os degraus.** Duas tentativas anteriores mediram posição relativa —
     * a primeira ancorada num `pergunta_aberta` que aparece antes, na validação
     * da enquete; a segunda numa ordem que a sonda de `post_de` já ocupava. A
     * distância e a ordem nunca foram a garantia: o que quebra a publicação num
     * banco atrasado é `imagens` estar no objeto que o ÚLTIMO insert manda.
     */
    const iCarrossel = c.indexOf("...base, ...carrossel,");
    const iMinimo = c.indexOf(".insert(base)");
    expect(iCarrossel).toBeGreaterThan(-1);
    expect(iMinimo).toBeGreaterThan(iCarrossel);
    /* E o `base` — o que o mínimo insere — não carrega `imagens`. */
    const iBase = c.indexOf("const base = {");
    expect(c.slice(iBase, c.indexOf(";", iBase))).not.toContain("imagens");
  });

  test("⚠️ `imagem_path` continua sendo a PRIMEIRA", () => {
    /* Todo código que já lê o story continua funcionando, e um story de foto
       única nunca precisa olhar o array. */
    expect(corpoDe("publicarStory")).toContain("imagens: [caminho, ...extras]");
  });

  test("⚠️ uma foto que não sobe RECUSA o story inteiro", () => {
    /* Um carrossel com buraco é pior que foto única: ela escolheu quatro,
       veria três, e não saberia qual sumiu. */
    /* ⚠️ **ACHATADO antes de medir a distância.** A primeira versão contava 400
       caracteres do texto com indentação e comentários virados em espaço — e a
       distância nunca foi a garantia. É o mesmo defeito que o degrau da citação
       já pagou nesta base. */
    const c = corpoDe("publicarStory").replace(/\s+/g, " ");
    const i = c.indexOf("const extras: string[] = []");
    expect(i).toBeGreaterThan(-1);
    expect(c.slice(i, i + 320)).toContain("if (!caminhoExtra) return");
  });

  test("⚠️ e as URLs saem na MESMA onda de assinatura", () => {
    /* Uma segunda chamada ao Storage por story dobraria a espera da fileira que
       abre em toda visita à aba. */
    const c = corpoDe("storiesDoFeed");
    expect(c).toContain("flatMap");
    expect(c).toContain("...((l.imagens ?? []) as string[])");
  });

  test("⚠️ o deslize horizontal NÃO avança o story", () => {
    /**
     * O carrossel vive dentro de uma tela cujas metades avançam e voltam. Sem o
     * `stopPropagation`, folhear as fotos pularia o story inteiro.
     */
    /* ⚠️ **ANCORADO NO CARROSSEL DO STORY**, e não no primeiro `snap-x` do
       arquivo: o do POST vem antes e não precisa da trava — ele não vive dentro
       de uma tela cujas metades avançam. */
    const t = semProsa(TELA);
    const iVisor = t.indexOf("export function VisorDeStory");
    expect(iVisor).toBeGreaterThan(-1);
    const i = t.indexOf("snap-x snap-mandatory", iVisor);
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(Math.max(0, i - 260), i)).toContain("e.stopPropagation()");
  });
});

describe("⚠️ o lugar", () => {
  test("é um RÓTULO, e o SQL não guarda coordenada", () => {
    /**
     * Guardar latitude e longitude de uma gestante — e devolvê-las a quem abre o
     * post — é dado de localização precisa numa base de alto risco: é o que
     * permite a alguém saber onde ela mora.
     */
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS lugar text");
    for (const proibido of ["latitude", "longitude", "geography", "point"]) {
      expect({ proibido, tem: SQL_SEM_PROSA.toLowerCase().includes(proibido) }).toEqual({
        proibido,
        tem: false,
      });
    }
  });

  test("⚠️ e NÃO há autocompletar de lugares", () => {
    /* Um catálogo de endereços transformaria o campo numa lista de maternidades
       com as pacientes de cada uma. */
    const t = semProsa(TELA);
    expect(t).not.toContain("places.googleapis");
    expect(t).not.toContain("nominatim");
    expect(t).not.toContain("geolocation");
  });

  test("⚠️ tem degrau, e ele é o MAIS ALTO", () => {
    /* Um recuo que pulasse daqui para o fundo apagaria recursos antigos por
       causa da coluna mais nova. */
    const s = semProsa(FONTE);
    const i = s.indexOf("const DEGRAUS_DO_POST");
    const primeiro = s.slice(i, i + 420);
    expect(primeiro).toContain('colunas: ["lugar"]');
  });

  test("⚠️ na tela é TEXTO, e não link para mapa", () => {
    /* Transformá-lo em endereço convidaria a tela a resolver a localização — e é
       isso que este campo existe para não fazer. */
    const t = semProsa(TELA);
    const i = t.indexOf("📍 {post.lugar}");
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(Math.max(0, i - 400), i)).not.toContain("<a href");
  });
});

describe("⚠️ as figurinhas são NOSSAS", () => {
  test("não há host externo de GIF", () => {
    /**
     * Giphy exigiria abrir a CSP para um host externo, tem custo por chamada e —
     * o que decide — entrega conteúdo NÃO MODERADO: a busca por "grávida" lá
     * devolve piada de parto e imagem de teor sexual.
     */
    const fonte = readFileSync("src/lib/figurinhas.ts", "utf8");
    for (const host of ["giphy", "tenor", "http://", "https://"]) {
      expect({ host, tem: fonte.includes(host) }).toEqual({ host, tem: false });
    }
  });

  test("⚠️ nenhuma fala de CORPO, EXAME ou CONDUTA", () => {
    /**
     * Um catálogo de gestação tenta naturalmente incluir "contração", "pressão
     * alta", "dilatação" — e uma figurinha é um jeito de dizer uma coisa sem
     * escrever, o que a torna o pior formato possível para conteúdo clínico.
     */
    const proibidas = [
      "contracao",
      "contração",
      "pressao",
      "pressão",
      "dilata",
      "exame",
      "remedio",
      "remédio",
      "sangr",
    ];
    for (const f of FIGURINHAS) {
      const alvo = `${f.id} ${f.rotulo}`.toLowerCase();
      for (const p of proibidas) {
        expect({ f: f.id, p, tem: alvo.includes(p) }).toEqual({ f: f.id, p, tem: false });
      }
    }
  });

  test("⚠️ e nenhuma é 😱 ou 😢", () => {
    /* O primeiro devolve pânico a quem está com medo; o segundo lê como PENA —
       a mesma lista de proibidos das reações do post. */
    for (const f of FIGURINHAS) {
      expect(["😱", "😢", "👎"]).not.toContain(f.arte);
    }
  });

  test("o catálogo é PEQUENO de propósito", () => {
    /* Um catálogo grande vira busca, busca vira campo de texto, e aí o formato
       deixou de ser o gesto rápido que ele existe para ser. */
    expect(FIGURINHAS.length).toBeLessThanOrEqual(24);
    expect(FIGURINHAS_POR_ID.size).toBe(FIGURINHAS.length);
  });

  test("⚠️ a mensagem tem de ser SÓ o marcador", () => {
    /* Aceitar "oi :dc-fig:abraco:" faria a tela ter de decidir como desenhar
       texto e figurinha juntos — e o formato existe para ser um gesto. */
    expect(figurinhaDoTexto(textoDaFigurinha("abraco"))?.id).toBe("abraco");
    expect(figurinhaDoTexto("  :dc-fig:abraco:  ")?.id).toBe("abraco");
    expect(figurinhaDoTexto("oi :dc-fig:abraco:")).toBe(null);
    expect(figurinhaDoTexto(":dc-fig:naoexiste:")).toBe(null);
    expect(figurinhaDoTexto("oi")).toBe(null);
    expect(figurinhaDoTexto(null)).toBe(null);
  });

  test("⚠️ a LISTA nunca mostra o marcador cru", () => {
    /* Sem isto, a paciente veria `:dc-fig:abraco:` onde deveria ver o que a
       amiga mandou. */
    expect(previaDaFigurinha(textoDaFigurinha("coracao"))).toContain("coração");
    expect(previaDaMensagem(textoDaFigurinha("abraco"), false)).not.toContain(":dc-fig:");
    expect(previaDaMensagem(textoDaFigurinha("abraco"), false)).toContain("abraço");
  });

  test("⚠️ e a APAGADA vence a figurinha", () => {
    /* Nada da mensagem apagada viaja — nem a figurinha. */
    expect(previaDaMensagem(textoDaFigurinha("abraco"), true)).toBe("Mensagem apagada");
  });

  test("a voz também tem prévia", () => {
    /* Sem ela, uma mensagem que é só voz aparecia como linha em branco na lista
       — o mesmo defeito que a foto já teve. */
    expect(previaDaMensagem(null, false, undefined, { audio: true })).toContain("voz");
  });

  test("⚠️ na tela, a figurinha SUBSTITUI a bolha", () => {
    /* Um emoji de 44px dentro de um balão com fundo lê como texto grande;
       solto, lê como figurinha. */
    const c = semProsa(CONVERSA);
    expect(c).toContain("figurinhaDoTexto(m.texto)");
    expect(c).toContain("bg-transparent");
  });
});
