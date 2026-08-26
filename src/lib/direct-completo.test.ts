import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MEMBROS_DO_GRUPO_MAX,
  mensagemVisivelNoGrupo,
  nomeDoGrupo,
  podeConvidarParaGrupo,
} from "./grupo-da-conversa";
import {
  AUDIO_SEGUNDOS_MAX,
  AUDIO_TIPOS,
  acharNaConversa,
  duracaoEmTexto,
  extensaoDoAudio,
  ordenarConversasComFixadas,
} from "./conversa";

/**
 * ⚠️ **O DIRECT COMPLETO: grupo, voz, busca, fixar, encaminhar e denunciar.**
 */

const GRUPO = readFileSync("src/lib/grupo.functions.ts", "utf8");
const CONVERSA = readFileSync("src/lib/conversa.functions.ts", "utf8");
const SQL = readFileSync("supabase/APLICAR_DIRECT_COMPLETO.sql", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(fonte: string, nome: string): string {
  const s = semProsa(fonte);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ o grupo é apertado, e cada trava responde a um jeito de dar errado", () => {
  const base = {
    euId: "dona",
    criadoraId: "dona",
    alvoId: "amiga",
    sigoAtivo: true,
    somosAmigas: false,
    bloqueio: false,
    emCuidado: false,
    jaSaoMembros: 2,
  };

  test("só a CRIADORA convida", () => {
    /* Sem isso, uma pessoa entra e traz outras cinco que ninguém conhece — e a
       conversa deixa de ser entre quem se escolheu. */
    expect(podeConvidarParaGrupo(base)).toBe(true);
    expect(podeConvidarParaGrupo({ ...base, euId: "outra" })).toBe(false);
  });

  test("⚠️ e só de dentro do GRAFO dela", () => {
    /* Nada de busca por nome, nada de uuid solto no corpo do pedido: numa base
       de gestantes de alto risco, uma lista navegável de pessoas é o dado que
       menos pode vazar. */
    expect(podeConvidarParaGrupo({ ...base, sigoAtivo: false, somosAmigas: false })).toBe(false);
    expect(podeConvidarParaGrupo({ ...base, sigoAtivo: false, somosAmigas: true })).toBe(true);
  });

  test("⚠️ bloqueio e Modo Cuidado fecham a porta", () => {
    expect(podeConvidarParaGrupo({ ...base, bloqueio: true })).toBe(false);
    expect(podeConvidarParaGrupo({ ...base, emCuidado: true })).toBe(false);
  });

  test("⚠️ o teto é OITO", () => {
    /* Acima disso ninguém lê tudo, e o que sobra é quem fala mais alto. */
    expect(MEMBROS_DO_GRUPO_MAX).toBe(8);
    expect(podeConvidarParaGrupo({ ...base, jaSaoMembros: 7 })).toBe(true);
    expect(podeConvidarParaGrupo({ ...base, jaSaoMembros: 8 })).toBe(false);
  });
});

describe("⚠️ quem entra vê a partir de quando ENTROU", () => {
  const entrouEm = "2026-08-20T12:00:00Z";

  test("o que veio antes NÃO aparece", () => {
    /**
     * É a régua que separa "entrar num grupo" de "ler a conversa dos outros".
     * O que veio antes pode ser um susto, um resultado ou uma perda — e quem
     * escreveu escolheu contar para quem estava lá naquele momento.
     */
    expect(
      mensagemVisivelNoGrupo({ criadaEm: "2026-08-19T23:59:00Z", entrouEm, saiuEm: null }),
    ).toBe(false);
    expect(
      mensagemVisivelNoGrupo({ criadaEm: "2026-08-20T12:00:01Z", entrouEm, saiuEm: null }),
    ).toBe(true);
  });

  test("⚠️ e quem SAIU para de ver a partir dali", () => {
    /* O histórico do período em que ela estava continua dela; o que veio
       depois, não. */
    const saiuEm = "2026-08-22T10:00:00Z";
    expect(mensagemVisivelNoGrupo({ criadaEm: "2026-08-21T10:00:00Z", entrouEm, saiuEm })).toBe(
      true,
    );
    expect(mensagemVisivelNoGrupo({ criadaEm: "2026-08-23T10:00:00Z", entrouEm, saiuEm })).toBe(
      false,
    );
  });

  test("data quebrada NÃO mostra", () => {
    /* Falhar aberto aqui entregaria o histórico inteiro por causa de um campo
       corrompido. */
    expect(mensagemVisivelNoGrupo({ criadaEm: "não é data", entrouEm, saiuEm: null })).toBe(false);
  });
});

describe("o nome do grupo", () => {
  test("⚠️ sem nome, vira a LISTA de quem está dentro", () => {
    /* "Grupo" não responde a pergunta que ela tem ao olhar a lista: "com quem
       eu falo aqui?". */
    expect(nomeDoGrupo(null, [{ nome: "Ana" }, { nome: "Bruna" }])).toBe("Ana e Bruna");
    expect(nomeDoGrupo("", [{ nome: "Ana" }, { nome: "Bruna" }, { nome: "Carol" }])).toBe(
      "Ana, Bruna e mais 1",
    );
    expect(nomeDoGrupo("Turma da 32ª", [{ nome: "Ana" }])).toBe("Turma da 32ª");
  });
});

describe("⚠️ o servidor do grupo", () => {
  test("todo handler passa pelo portão `meuGrupo`", () => {
    /* Sem ele, um `grupoId` no corpo do pedido leria (ou escreveria) numa
       conversa de oito pessoas que não me conhecem. */
    for (const fn of ["convidarParaGrupo", "sairDoGrupo", "mandarNoGrupo", "mensagensDoGrupo"]) {
      expect({
        fn,
        temPortao: corpoDe(GRUPO, fn).includes("meuGrupo(sb, data.grupoId, eu)"),
      }).toEqual({ fn, temPortao: true });
    }
  });

  test("⚠️ o portão vem ANTES de qualquer escrita", () => {
    for (const fn of ["convidarParaGrupo", "mandarNoGrupo"]) {
      const c = corpoDe(GRUPO, fn);
      const iPortao = c.indexOf("meuGrupo(sb, data.grupoId, eu)");
      const iEscrita = Math.min(
        ...[c.indexOf(".insert("), c.indexOf(".upsert("), c.indexOf(".update(")].filter(
          (n) => n > -1,
        ),
      );
      expect({ fn, ordem: iEscrita > iPortao }).toEqual({ fn, ordem: true });
    }
  });

  test("⚠️ a RÉGUA CLÍNICA vale no grupo, e é a MESMA do direct", () => {
    /**
     * É por isso que a tabela de mensagens foi reusada. Uma cópia que
     * divergisse apareceria como conduta passando no grupo e sendo recusada no
     * direct — no canal que tem OITO leitoras em vez de uma.
     */
    const c = corpoDe(GRUPO, "mandarNoGrupo");
    expect(c).toContain("triarTexto(texto)");
    expect(c).toContain('motivo: "emergencia"');
  });

  test("⚠️ o recorte do histórico é aplicado na CONSULTA", () => {
    /* Filtrar na aplicação traria o texto anterior pela rede — e o que não é
       lido não vaza. */
    expect(corpoDe(GRUPO, "mensagensDoGrupo")).toContain('.gte("criada_em", meu.membro.entrou_em)');
  });

  test("⚠️ a criadora saindo ENCERRA, e encerrar MARCA", () => {
    /* Um grupo sem dona é um grupo sem ninguém responsável por quem entra. E as
       mensagens ficam: elas são o que as OUTRAS escreveram. */
    const c = corpoDe(GRUPO, "sairDoGrupo");
    expect(c).toContain("encerrado_em: agora");
    expect(c).not.toContain('.from("rede_mensagens").delete()');
  });

  test("⚠️ quem é reconvidada VOLTA vendo a partir de agora", () => {
    /* Sem reescrever `entrou_em`, ela veria o histórico do período em que
       esteve fora — que é exatamente o que sair deveria ter fechado. */
    const c = corpoDe(GRUPO, "convidarParaGrupo");
    expect(c).toContain("entrou_em: new Date().toISOString()");
    expect(c).toContain("saiu_em: null");
  });

  test("⚠️ e quem SAIU não ocupa vaga", () => {
    /* Senão um grupo que perdeu metade nunca mais aceitaria ninguém. */
    expect(corpoDe(GRUPO, "convidarParaGrupo")).toContain("filter((m) => !m.saiu_em)");
  });

  test("⚠️ sem a tabela, a lista não tem grupos — nunca um erro na tela", () => {
    expect(corpoDe(GRUPO, "meusGrupos")).toContain("grupos: [] as GrupoNaTela[]");
  });

  test("⚠️ e a tabela de mensagens é a MESMA, com um destino só", () => {
    expect(SQL).toContain("CHECK ((conversa_id IS NULL) <> (grupo_id IS NULL))");
    expect(SQL).not.toContain("CREATE TABLE IF NOT EXISTS public.rede_grupo_mensagens");
  });

  test("⚠️ e as tabelas do grupo não têm policy para `authenticated`", () => {
    /* A lista de quem conversa com quem é o mapa social da base inteira. */
    expect(SQL).toContain("ALTER TABLE public.rede_grupos ENABLE ROW LEVEL SECURITY");
    expect(SQL).not.toMatch(/CREATE POLICY[\s\S]*rede_grupo/);
  });
});

describe("⚠️ a mensagem de voz", () => {
  test("`audio/mp4` é o PRIMEIRO da lista", () => {
    /* É o único que o Safari do iPhone grava. Uma lista começando em `webm`
       funciona em toda máquina de desenvolvimento e falha no aparelho onde o
       app é instalado. */
    expect(AUDIO_TIPOS[0]).toBe("audio/mp4");
    expect(extensaoDoAudio("audio/mp4;codecs=mp4a")).toBe("m4a");
  });

  test("⚠️ dois minutos, e o teto separa recado de monólogo", () => {
    expect(AUDIO_SEGUNDOS_MAX).toBe(120);
    expect(corpoDe(CONVERSA, "enviarMensagem")).toContain("max(AUDIO_SEGUNDOS_MAX)");
  });

  test("a duração vem em minuto:segundo", () => {
    expect(duracaoEmTexto(0)).toBe("0:00");
    expect(duracaoEmTexto(9)).toBe("0:09");
    expect(duracaoEmTexto(75)).toBe("1:15");
    expect(duracaoEmTexto(null)).toBe("0:00");
  });

  test("⚠️ o áudio passa pela MESMA trava de pasta da foto", () => {
    /**
     * O caminho vem do CLIENTE (ele sobe pela URL assinada); sem a conferência,
     * uma paciente aponta para a pasta de outra e a mensagem passa a TOCAR,
     * dentro de uma conversa privada, um áudio que não é dela.
     */
    expect(corpoDe(CONVERSA, "enviarMensagem")).toContain(
      "fotoEhDeQuemMandou(data.audioPath, pastaDe(eu))",
    );
  });

  test("⚠️ sem a coluna, a mensagem de VOZ é RECUSADA — nunca vira bolha vazia", () => {
    /* Uma linha sem áudio seria uma bolha em branco, e ela acharia que
       mandou. */
    const c = corpoDe(CONVERSA, "enviarMensagem");
    const i = c.indexOf("if (error && data.audioPath)");
    expect(i).toBeGreaterThan(-1);
    expect(c.slice(i, i + 160)).toContain('motivo: "sem_suporte"');
  });

  test("⚠️ e o áudio da apagada NÃO viaja", () => {
    expect(corpoDe(CONVERSA, "mensagensDaConversa")).toContain("audioUrl: m.apagada_em ? null :");
  });
});

describe("⚠️ fixar, buscar e encaminhar", () => {
  test("fixar é da MINHA coluna", () => {
    /* Uma coluna só faria a escolha de uma valer para a outra: a amiga abriria
       o direct e encontraria uma conversa presa no topo que ela nunca fixou. */
    const c = corpoDe(CONVERSA, "fixarConversa");
    expect(c).toContain('minhaColuna("fixada", eu, c.a_id)');
    expect(c).not.toContain("colunaDoOutro(");
  });

  test("a fixada sobe, e o resto NÃO reordena", () => {
    const lista = [
      { id: "a", fixadaEm: null },
      { id: "b", fixadaEm: "2026-08-20T10:00:00Z" },
      { id: "c", fixadaEm: null },
    ];
    expect(ordenarConversasComFixadas(lista).map((c) => c.id)).toEqual(["b", "a", "c"]);
    const sem = lista.map((c) => ({ ...c, fixadaEm: null }));
    expect(ordenarConversasComFixadas(sem).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  test("⚠️ a busca é LOCAL, e não acha o que está apagado", () => {
    /**
     * Buscar no servidor mandaria o TERMO pela rede — e o termo é o que ela
     * está procurando numa conversa privada. "sangramento", o nome de um
     * hospital: tão sensível quanto o que ela escreveu.
     */
    const msgs = [
      { texto: "o ultrassom foi bom", apagada: false },
      { texto: "ULTRASSOM de novo", apagada: false },
      { texto: "ultrassom", apagada: true },
      { texto: null, apagada: false },
    ];
    expect(acharNaConversa(msgs, "ultrassom")).toHaveLength(2);
    /* Menos de duas letras não busca: casaria com a conversa inteira. */
    expect(acharNaConversa(msgs, "u")).toHaveLength(0);
  });

  test("⚠️ encaminhar confere as DUAS pontas, e a de ORIGEM primeiro", () => {
    /* Sem a origem, um `mensagemId` de uma conversa de terceiros seria copiado
       para a minha. */
    const c = corpoDe(CONVERSA, "encaminharMensagem");
    const iDe = c.indexOf("minhaConversa(sb, data.deConversaId, eu)");
    const iPara = c.indexOf("minhaConversa(sb, data.paraConversaId, eu)");
    const iInsert = c.indexOf(".insert(");
    expect(iDe).toBeGreaterThan(-1);
    expect(iPara).toBeGreaterThan(iDe);
    expect(iInsert).toBeGreaterThan(iPara);
    /* E a mensagem tem de ser DESTA conversa. */
    expect(c).toContain("conversa_id !== data.deConversaId");
  });

  test("⚠️ encaminhar é SÓ TEXTO, e sem autoria", () => {
    /**
     * A foto que alguém me mandou numa conversa privada não sai dali — é a
     * mesma razão do ✈ do story ser do dono. E "Fulana disse:" transformaria o
     * encaminhar num print.
     */
    const c = corpoDe(CONVERSA, "encaminharMensagem");
    expect(c).toContain('motivo: "so_texto"');
    expect(c).not.toContain("imagem_path");
    expect(c).not.toContain("audio_path");
    expect(c).not.toContain("autorNome");
  });

  test("⚠️ e a régua clínica roda DE NOVO no destino", () => {
    /* Sem ela, encaminhar seria a porta dos fundos de `triarTexto`. */
    expect(corpoDe(CONVERSA, "encaminharMensagem")).toContain("triarTexto(texto)");
  });
});

describe("⚠️ denunciar a conversa inteira", () => {
  const C = corpoDe(CONVERSA, "denunciarConversa");

  test("o trecho leva SÓ as mensagens dela", () => {
    /**
     * As minhas não são prova de nada contra ela — e mandá-las para a fila
     * entregaria o meu lado de uma conversa privada a quem não precisa dele.
     */
    expect(C).toContain('.eq("autor_id", outro)');
  });

  test("⚠️ e leva VÁRIAS, porque o que caracteriza assédio é o PADRÃO", () => {
    /* Vinte mensagens que, uma a uma, não dizem nada. Uma frase solta faz quem
       julga arquivar. */
    expect(C).toMatch(/\.limit\(10\)/);
    expect(C).toMatch(/slice\(0, 500\)/);
  });

  test("⚠️ sem o CHECK novo, a tela SABE", () => {
    expect(C).toContain('=== "23514"');
    expect(C).toContain('motivo: "sem_suporte"');
  });

  test("o CHECK do SQL traz a lista COMPLETA", () => {
    for (const alvo of [
      "post",
      "perfil",
      "comentario",
      "pergunta",
      "mensagem",
      "story",
      "conversa",
    ]) {
      expect(SQL).toContain(`'${alvo}'`);
    }
  });
});
