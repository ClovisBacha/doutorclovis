import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { tagDaBusca } from "./mencoes";
import { TAMANHO_DA_NOTA } from "./conversa";

/**
 * ⚠️ **AS MAIS DEZ.** Denúncia de story · filtro de palavras no direct ·
 * editar comentário · conversa não lida · notas · favoritos · coleções ·
 * título do destaque · marcação em story · busca de hashtag.
 */

const REDE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const CONVERSA = readFileSync("src/lib/conversa.functions.ts", "utf8");
const COMENTARIOS = readFileSync("src/lib/comentarios.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-instagram.tsx", "utf8");
const TELA_CONVERSA = readFileSync("src/components/rede-conversa.tsx", "utf8");
const TELA_COMENTARIOS = readFileSync("src/components/rede-comentarios.tsx", "utf8");
const SQL = readFileSync("supabase/APLICAR_MAIS_DEZ_DA_REDE.sql", "utf8");

/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(fonte: string, nome: string): string {
  const s = semProsa(fonte);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ 1 · denunciar um story", () => {
  const C = corpoDe(REDE, "denunciarStory");

  test("só denuncia quem ENXERGA — e pela régua ÚNICA", () => {
    /* Um `storyId` sorteado que respondesse `ok` confirmaria a existência de um
       story fechado: vazamento pela porta dos fundos. */
    expect(C).toContain("storyQueEuVejo(sb, data.storyId, eu");
  });

  test("⚠️ o TRECHO é congelado — e aqui isso é o recurso", () => {
    /* O story some em 24 h; sem a cópia, a linha da administração apontaria
       para uma coisa que não existe mais e a denúncia seria impossível de
       julgar. */
    expect(C).toMatch(/trecho:.*slice\(0, 400\)/s);
    /* ⚠️ Sem texto, o rótulo diz que era foto — nunca vazio, que lê como
       falha. */
    expect(C).toContain('"(story sem texto)"');
  });

  test("⚠️ sem o CHECK novo, a tela SABE — e não promete 'fica registrada'", () => {
    /* `23514` é a violação do CHECK: o banco recusa o alvo `story`. Prometer
       registro sobre uma linha que não gravou é a promessa que este app já
       quebrou uma vez. */
    expect(C).toContain('=== "23514"');
    expect(C).toContain('motivo: "sem_suporte"');
    expect(semProsa(TELA)).toContain("A denúncia de story ainda não está disponível aqui.");
  });

  test("o CHECK do SQL traz a lista COMPLETA", () => {
    /* Uma lista cumulativa parcial apagaria os alvos anteriores no dia em que
       alguém re-rodasse o arquivo — o defeito que `rede_atividade_especie_check`
       já teve aqui. */
    for (const alvo of ["post", "perfil", "comentario", "pergunta", "mensagem", "story"]) {
      expect(SQL).toContain(`'${alvo}'`);
    }
  });
});

describe("⚠️ 2 · o filtro de palavras no direct", () => {
  const C = corpoDe(CONVERSA, "mensagensDaConversa");

  test("usa a MESMA lista e a MESMA régua dos comentários", () => {
    /* Duas listas divergiriam no primeiro conserto, e a divergência apareceria
       como a palavra escondida num lugar e à mostra no outro. */
    expect(C).toContain("palavras_ocultas");
    expect(C).toContain("temPalavraOculta(");
    expect(C).toContain("limparPalavrasOcultas(");
  });

  test("⚠️ o texto NÃO viaja quando está recolhido", () => {
    /* Mandar o texto com uma marca "esconda isto" deixaria a palavra dentro da
       resposta da rede — visível para quem abrisse o inspetor. */
    expect(C).toMatch(/texto: m\.apagada_em \|\| escondeu\(m\) \? null :/);
  });

  test("⚠️ e NÃO vale para o que EU escrevi", () => {
    /* Ela sabe o que digitou; esconder a própria mensagem seria o app
       escondendo dela a própria voz. */
    const i = C.indexOf("const escondeu =");
    expect(C.slice(i, i + 300)).toContain("m.autor_id !== eu");
  });

  test("⚠️ falha ao ler a lista NÃO esconde nada", () => {
    /* O pior caso é ela ver uma palavra que preferia não ver, contra o caso
       oposto: a conversa inteira recolhida por uma falha de rede. */
    const i = C.indexOf("const palavras = await");
    expect(C.slice(i, i + 800)).toContain("return [] as string[]");
  });

  test("a tela recolhe a LINHA, e não a apaga", () => {
    /* Diferente do comentário: a conversa é de duas pessoas, e uma mensagem que
       desaparece faria a conversa deixar de fazer sentido. */
    const t = semProsa(TELA_CONVERSA);
    expect(t).toContain("Mensagem escondida pelo seu filtro de palavras.");
    expect(t).toContain("Ver mesmo assim");
    /* ⚠️ Estado LOCAL e por mensagem: revelar uma não revela as outras. */
    expect(t).toContain("setReveladas((v) => new Set(v).add(m.id))");
  });
});

describe("⚠️ 3 · editar um comentário", () => {
  const C = corpoDe(COMENTARIOS, "editarComentario");

  test("só quem ESCREVEU edita — nem a dona do post", () => {
    /* Ela pode APAGAR, que é a decisão dela sobre a própria conversa;
       reescrever a frase de outra pessoa é pôr palavras na boca dela. */
    expect(C).toMatch(/\(c as any\)\.autor_id !== eu/);
    expect(C).toContain('.eq("autor_id", eu)');
  });

  test("⚠️ a RÉGUA CLÍNICA roda de novo — é o ponto todo", () => {
    /* Sem ela, editar seria a porta dos fundos do `comentar`: publica-se "que
       lindo" e troca-se depois por "no seu lugar eu não iria ao PS". */
    expect(C).toContain("triarComentario(data.texto)");
    expect(C).toContain('motivo: "clinico"');
  });

  test("⚠️ SÓ O TEXTO muda", () => {
    /* Um `update` largo seria a porta para mover um comentário de uma
       publicação para outra. */
    const i = C.indexOf(".update({ texto: data.texto");
    expect(i).toBeGreaterThan(-1);
    const upd = C.slice(i, C.indexOf("}", i));
    expect(upd).not.toContain("post_id");
    expect(upd).not.toContain("responde_a");
    expect(upd).not.toContain("autor_id");
  });

  test("⚠️ sem a coluna do selo, a edição VALE — só o carimbo falta", () => {
    /* Recusar seria tirar uma correção por causa de um carimbo. */
    expect(C).toContain("semSelo: true");
  });

  test("o selo aparece na tela", () => {
    /* Quem respondeu respondeu ao texto que estava lá; sem ele, uma edição
       posterior faz as respostas parecerem sem sentido. */
    expect(semProsa(TELA_COMENTARIOS)).toContain("· editado");
  });
});

describe("⚠️ 4 · marcar a conversa como não lida", () => {
  const C = corpoDe(CONVERSA, "marcarConversaNaoLida");

  test("⚠️ é a LIMPEZA do carimbo — não há coluna nova", () => {
    /* Um booleano ao lado seria uma segunda verdade sobre a mesma coisa: no dia
       em que os dois discordassem, o emblema diria um número e a lista outro. */
    expect(C).toContain("minhaColunaDeLeitura(eu, c.a_id)");
    expect(C).toContain("[coluna]: null");
    expect(SQL).not.toContain("nao_lida");
  });

  test("⚠️ só do MEU lado", () => {
    /* Invertida, ela marcaria a conversa da OUTRA como não lida, e o celular da
       amiga acenderia sozinho. */
    expect(C).not.toContain("colunaDoOutro(");
    expect(C).toContain("minhaConversa(sb, data.conversaId, eu)");
  });

  test("a tela desfaz quando o servidor recusa", () => {
    const t = semProsa(TELA_CONVERSA);
    const i = t.indexOf("async function marcarNaoLida");
    const corpo = t.slice(i, t.indexOf("\n  async function", i + 10));
    expect(corpo).toContain("naoLida: false");
  });
});

describe("⚠️ 5 · as notas", () => {
  test("são CURTAS por desenho", () => {
    /* Com 200 caracteres a nota vira um post pequeno — e aí concorre com o
       post, que é o lugar certo para um texto longo. */
    expect(TAMANHO_DA_NOTA).toBe(60);
  });

  test("⚠️ passam pela RÉGUA CLÍNICA", () => {
    /* É texto curto e público para o círculo dela — o formato em que "toma
       buscopan que passa" cabe inteiro. */
    const C = corpoDe(CONVERSA, "escreverNota");
    expect(C).toContain("triarTexto(limpo)");
    expect(C).toContain('motivo: "clinico"');
  });

  test("⚠️ quem está FORA DA REDE não escreve nota", () => {
    const C = corpoDe(CONVERSA, "escreverNota");
    expect(C).toContain("foraDaRede(perfis.get(eu))");
  });

  test("⚠️ a validade é CALCULADA no upsert, e não deixada no DEFAULT", () => {
    /* O `DEFAULT` só vale no INSERT: num `upsert` que atualiza, a nota nova
       herdaria o `expira_em` da anterior e sumiria antes da hora. */
    const C = corpoDe(CONVERSA, "escreverNota");
    expect(C).toMatch(/expira_em: new Date\(Date\.now\(\) \+ 24 \* 3600 \* 1000\)/);
  });

  test("⚠️ UMA por pessoa — a chave primária é o autor", () => {
    /* Uma lista viraria um segundo feed, e o valor dela é ser uma frase só. */
    expect(SQL).toMatch(/autor_id\s+uuid PRIMARY KEY/);
  });

  test("⚠️ a leitura recorta pelo GRAFO, e as vencidas não são apagadas", () => {
    /* Vinda de uma desconhecida, uma frase solta não diz nada e ocupa o topo do
       direct. E apagar numa consulta de tela transformaria abrir o direct numa
       escrita. */
    const C = corpoDe(CONVERSA, "notasDeQuemEuSigo");
    expect(C).toContain("ctx.sigo");
    expect(C).toContain("ctx.amigas");
    expect(C).toContain('.gt("expira_em"');
    expect(C).not.toContain(".delete(");
  });

  test("⚠️ e quem entrou em luto ou pausou some da fileira", () => {
    const C = corpoDe(CONVERSA, "notasDeQuemEuSigo");
    expect(C).toContain("foraDaRede(perfis.get(l.autor_id))");
  });
});

describe("⚠️ 6 · favoritos", () => {
  const C = corpoDe(REDE, "favoritar");

  test("é CALADO e não avisa ninguém", () => {
    expect(C).not.toContain("sendPushToUser");
    expect(C).not.toContain("registrarAtividade");
  });

  test("⚠️ NÃO reordena o feed — abre uma lista à parte", () => {
    /**
     * O feed continua cronológico, e isso é decisão escrita: um feed por
     * "relevância" precisaria de engajamento como sinal, e numa base de alto
     * risco o post que mais engaja é o da EMERGÊNCIA.
     */
    const feed = corpoDe(REDE, "meuFeed");
    expect(feed).toContain("data.soFavoritas");
    /* A ordenação do feed não conhece favoritas. */
    expect(semProsa(REDE)).not.toMatch(/ordenarFeed\([^)]*favorit/i);
  });

  test("⚠️ a lista das favoritas NÃO inclui os meus posts", () => {
    /* No feed normal eles entram; aqui a pergunta é "o que as minhas favoritas
       publicaram", e eu não sou favorita minha. */
    const feed = corpoDe(REDE, "meuFeed");
    const i = feed.indexOf("data.soFavoritas");
    expect(feed.slice(i, i + 200)).toContain("[...ctx.favoritas]");
  });

  test("⚠️ o contexto falha ABERTO (conjunto vazio)", () => {
    /* O pior caso é a lista aparecer vazia, contra esconder o feed inteiro por
       causa de um acessório. */
    const s = semProsa(REDE);
    const i = s.indexOf("favoritas: new Set(");
    expect(s.slice(i, i + 200)).toContain("?? []");
  });
});

describe("⚠️ 7 · coleções nos salvos", () => {
  test("é um RÓTULO, e não uma tabela de coleções", () => {
    /* Uma tabela exigiria criar a pasta antes de salvar, e o gesto de salvar
       tem de continuar sendo um toque só. */
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS colecao text");
    expect(SQL).not.toContain("CREATE TABLE IF NOT EXISTS public.rede_colecoes");
  });

  test("⚠️ sem a coluna, SALVAR continua funcionando — só sem pasta", () => {
    const C = corpoDe(REDE, "salvarPost");
    expect(C).toContain("semColecao: true");
  });

  test("⚠️ e a leitura também tem degrau", () => {
    const C = corpoDe(REDE, "meusSalvos");
    expect(C).toContain('lerSalvos("post_id, criado_em")');
  });

  test("⚠️ a coleção viaja À PARTE, e não dentro do post", () => {
    /* `PostNaTela` é o mesmo tipo do feed: um campo "colecao" ali sugeriria que
       a pasta é propriedade da PUBLICAÇÃO — ela é da linha de salvos, e é
       privada dela. */
    const C = corpoDe(REDE, "meusSalvos");
    expect(C).toContain("colecaoDe");
  });
});

describe("⚠️ 8 · o título do destaque", () => {
  const C = corpoDe(REDE, "destacarStory");

  test("⚠️ tirar do destaque LIMPA o título", () => {
    /* Guardá-lo faria o nome antigo reaparecer no dia em que ela destacasse
       outra coisa — e o título é o que a pessoa lê antes de tocar. */
    expect(C).toMatch(/const titulo = data\.destacar \? .* : null/);
  });

  test("⚠️ sem a coluna, destacar continua funcionando — só sem nome", () => {
    expect(C).toContain("semTitulo: true");
  });

  test("⚠️ e a tela pede o nome numa FOLHA, nunca em `window.prompt`", () => {
    /* No app instalado o diálogo do sistema abre com o nome do domínio em cima
       — a cara de "site embrulhado" que a diretriz 4.2 da Apple reprova. */
    const t = semProsa(TELA);
    expect(t).toContain("Nome do destaque");
    expect(t).not.toContain("window.prompt");
  });
});

describe("⚠️ 9 · marcar alguém num story", () => {
  test("a régua de permissão é a MESMA do post", () => {
    /* Copiá-la faria as duas divergirem, e a divergência apareceria como o nome
       de quem encerrou a amizade voltando a aparecer numa foto de barriga. */
    const s = semProsa(REDE);
    const i = s.indexOf("async function gravarMarcacoes");
    const corpo = s.slice(i, i + 3000);
    expect(corpo).toContain("marcadasPermitidas(candidatas)");
    expect(corpo).toContain('alvo === "story" ? "rede_story_marcacoes" : "rede_marcacoes"');
  });

  test("⚠️ o story NÃO grava linha na caixa ♡", () => {
    /* Ele vive 24 h, e um aviso permanente sobre uma coisa que some no dia
       seguinte deixaria a caixa cheia de linhas que não resolvem em nada. */
    const s = semProsa(REDE);
    const i = s.indexOf("async function gravarMarcacoes");
    const corpo = s.slice(i, i + 3000);
    const iAtividade = corpo.indexOf('especie: "marcou"');
    const iSaida = corpo.indexOf('if (alvo === "story") return;');
    expect(iSaida).toBeGreaterThan(-1);
    expect(iSaida).toBeLessThan(iAtividade);
  });

  test("⚠️ o `id` volta do INSERT, e não de uma leitura depois", () => {
    /* Reler "o story mais novo dela" seria uma corrida: dois aparelhos
       publicando no mesmo instante marcariam a pessoa no story errado. */
    /* ⚠️ A garantia é o id vir de QUEM GRAVOU, e não de uma leitura posterior.
       Ele mudou de casa quando a escada virou `inserirDescendo` — a asserção
       segue a garantia, e o `.select("id")` é cobrado onde ele mora. */
    const C = corpoDe(REDE, "publicarStory");
    expect(C).toContain("const novoId = gravado.id");
    const escada = semProsa(REDE);
    const i = escada.indexOf("export async function inserirDescendo");
    expect(escada.slice(i, escada.indexOf("\nexport ", i + 10))).toContain('.select("id")');
  });

  test("⚠️ marca DEPOIS de o story existir, e a falha não derruba a publicação", () => {
    const C = corpoDe(REDE, "publicarStory");
    const iInsert = C.indexOf("inserirDescendo(");
    const iMarcar = C.indexOf('gravarMarcacoes(sb, eu, novoId, data.marcadas ?? [], "story")');
    expect(iMarcar).toBeGreaterThan(iInsert);
    expect(C.slice(iMarcar, iMarcar + 200)).not.toContain("return { ok: false");
  });

  test("⚠️ e a leitura filtra por Modo Cuidado, pausa e BLOQUEIO", () => {
    const s = semProsa(REDE);
    const i = s.indexOf("async function marcacoesDe");
    const corpo = s.slice(i, i + 2000);
    expect(corpo).toContain("foraDaRede(p)");
    expect(corpo).toContain("bloqueio.has(l.quem_id)");
  });
});

describe("⚠️ 10 · a busca de hashtag", () => {
  test("aceita o que É tag, com e sem `#`", () => {
    expect(tagDaBusca("trigemeas")).toBe("trigemeas");
    expect(tagDaBusca("#Trigemeas")).toBe("trigemeas");
    /* ⚠️ Acento preservado: `#gestação` e `#gêmeos` são como elas escrevem. */
    expect(tagDaBusca("#gestação")).toBe("gestação");
  });

  test("⚠️ recusa o que NÃO pode ser tag", () => {
    /* Só número não é assunto (`#2026` viraria a tag mais usada do app), e o
       que não casa o formato não vira link para uma página vazia. */
    for (const lixo of ["", "  ", "2026", "#2026", "maria costa", "a b", "#"]) {
      expect(tagDaBusca(lixo)).toBe(null);
    }
  });

  test("⚠️ e ela NÃO consulta o servidor", () => {
    /* Uma consulta "existe esta tag?" por tecla digitada seria uma ida ao banco
       para uma pergunta que a própria página da tag responde melhor. */
    const fonte = readFileSync("src/lib/mencoes.ts", "utf8");
    const i = fonte.indexOf("export function tagDaBusca");
    const corpo = fonte.slice(i, fonte.indexOf("\n}", i));
    expect(corpo).not.toContain("await");
    expect(corpo).not.toContain("sb");
  });

  test("a tela oferece a linha da tag", () => {
    const t = semProsa(TELA);
    expect(t).toContain("tagDaBusca(termo)");
    expect(t).toContain("Ver publicações com esta tag");
  });
});
