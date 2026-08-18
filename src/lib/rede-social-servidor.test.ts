/**
 * AS TRAVAS DO SERVIDOR DA REDE SOCIAL.
 *
 * Lê o fonte, como `travas-do-servidor.test.ts` e `presentes-servidor.test.ts`.
 * Aqui o motivo é mais forte que nos outros dois: o que estas funções
 * protegem é **quem vê o quê**, e uma falha não aparece como erro — aparece
 * como post da camada restrita chegando em quem não devia, sem ninguém notar.
 *
 * ⚠️ Todas as asserções deste arquivo foram verificadas POR MUTAÇÃO: eu quebrei
 * o código de propósito e conferi que o teste ficou vermelho. Duas asserções da
 * primeira versão do teste do chá de bebê passavam sobre código quebrado
 * porque procuravam PALAVRA em vez de GUARDA, e a lição valeu para este.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");

function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const CODIGO = semComentarios(FONTE);

function corpoDe(nome: string): string {
  const i = CODIGO.indexOf(`export const ${nome} =`);
  expect(i).toBeGreaterThan(-1);
  const resto = CODIGO.slice(i + 10);
  const j = resto.indexOf("\nexport ");
  return j === -1 ? resto : resto.slice(0, j);
}

function funcaoInterna(nome: string): string {
  const i = CODIGO.indexOf(`async function ${nome}`);
  expect(i).toBeGreaterThan(-1);
  return CODIGO.slice(i, CODIGO.indexOf("\n}\n", i));
}

describe("a régua de visibilidade é chamada, e é a de lib/", () => {
  test("⚠️ `montarPosts` filtra por `podeVerPost` — não por conta própria", () => {
    // Se um dia alguém "otimizar" isto para um filtro em SQL, a régua passa a
    // existir em dois lugares e as duas divergem no primeiro conserto — com a
    // divergência aparecendo como post vazando.
    const c = funcaoInterna("montarPosts").replace(/\s+/g, " ");
    expect(c).toContain("brutos.filter(");
    expect(c).toContain("podeVerPost({");
    // E recebe os quatro sinais, nenhum cravado.
    for (const campo of ["bloqueado:", "sigoAtivo:", "somosAmigas:", "emCuidado:"]) {
      expect(c).toContain(campo);
    }
    expect(c).not.toMatch(/bloqueado: false|sigoAtivo: true|somosAmigas: true/);
  });

  test("⚠️ a régua vem de `rede-social.ts`, nunca reescrita aqui", () => {
    expect(FONTE).toContain('from "@/lib/rede-social"');
    expect(CODIGO).not.toContain("function podeVerPost");
  });

  test("⚠️ o grafo de amigas é o que JÁ EXISTE", () => {
    // Duas réguas de "quem é amiga" divergiriam, e aqui a divergência
    // apareceria como post da camada restrita vazando.
    expect(funcaoInterna("contextoDe")).toContain("idsDasAmigas");
  });
});

describe("o bloqueio", () => {
  test("⚠️ entra nos DOIS sentidos no mesmo Set", () => {
    // Guardar só o meu deixaria quem me bloqueou continuar aparecendo no meu
    // feed — e "bloquear" promete que nenhuma das duas vê a outra.
    const c = funcaoInterna("contextoDe").replace(/\s+/g, " ");
    expect(c).toContain('.eq("quem_id", eu)');
    expect(c).toContain('.eq("bloqueado_id", eu)');
    expect(c).toContain("bloqueio.add(b.bloqueado_id)");
    expect(c).toContain("bloqueio.add(b.quem_id)");
  });

  test("⚠️ bloquear DESFAZ o seguir nos dois sentidos", () => {
    // Sem isso a linha fica viva e ressuscita o vínculo no dia em que o
    // bloqueio for desfeito — a pessoa voltaria a receber os posts sem nunca
    // ter pedido de novo.
    const c = corpoDe("bloquear").replace(/\s+/g, " ");
    expect(c).toContain('.from("rede_seguidores")');
    expect(c).toContain("seguidor_id.eq.${eu},seguido_id.eq.${data.alvoId}");
    expect(c).toContain("seguidor_id.eq.${data.alvoId},seguido_id.eq.${eu}");
  });

  test("⚠️ e desfaz o seguir ANTES de gravar o bloqueio", () => {
    // A ORDEM É A GARANTIA, e ela substitui um rollback. São duas escritas sem
    // transação entre elas; gravar o bloqueio primeiro deixa alcançável o
    // estado que não pode existir — bloqueio de pé com a linha de seguir viva,
    // ressuscitando o vínculo no dia em que ela desbloquear. Meio bloqueio é
    // pior que nenhum, porque ela acha que está protegida.
    //
    // Invertida, a falha do segundo passo é inofensiva: ela deixou de seguir e
    // não bloqueou — o gesto MENOR, e com erro na tela.
    //
    // ⚠️ Este teste nasceu de uma mutação que passou verde: inverter a ordem
    // não quebrava nada, porque nenhuma asserção falava de ordem.
    const c = corpoDe("bloquear").replace(/\s+/g, " ");
    const desfezSeguir = c.indexOf('.from("rede_seguidores") .delete()');
    const gravouBloqueio = c.indexOf('.from("rede_bloqueios") .upsert(');
    expect(desfezSeguir).toBeGreaterThan(-1);
    expect(gravouBloqueio).toBeGreaterThan(-1);
    expect(gravouBloqueio).toBeGreaterThan(desfezSeguir);
    // E não há rollback: um rollback é mais uma escrita que pode falhar, e
    // falhando deixa exatamente o estado que veio evitar.
    expect(c).not.toMatch(/erroSeguir\) \{ await sb/);
  });

  test("⚠️ o bloqueio é CALADO — nenhum push, nenhum aviso", () => {
    // Anunciar transforma o bloqueio num ato de confronto, e num app onde as
    // pessoas se conhecem da vida real isso piora a situação que o motivou.
    expect(corpoDe("bloquear")).not.toContain("sendPushToUser");
  });
});

describe("Modo Cuidado", () => {
  test("⚠️ `publicarPost` tem a GUARDA, não só a palavra", () => {
    // O portão da tela some, mas um pedido montado à mão não passa pela tela.
    const c = corpoDe("publicarPost").replace(/\s+/g, " ");
    expect(c).toContain(
      'if ((meu as any)?.care_mode) return { ok: false as const, motivo: "indisponivel" as const };',
    );
  });

  test("⚠️ `verPerfil` recusa com o MESMO motivo nos três casos", () => {
    // Distinguir contaria à bloqueada que ela foi bloqueada, e contaria a
    // perda de quem entrou em luto.
    const c = corpoDe("verPerfil").replace(/\s+/g, " ");
    expect(c).toContain(
      "if (!a || a.care_mode || (ctx.bloqueio.has(data.alvoId) && data.alvoId !== eu))",
    );
    expect(c).toContain('motivo: "indisponivel" as const');
    expect(c).not.toMatch(/motivo: ["'`](luto|bloqueada|cuidado)/);
  });

  test("⚠️ quem está em Modo Cuidado some da fila de PEDIDOS", () => {
    expect(corpoDe("meuPerfilSocial")).toContain("q.care_mode");
  });
});

describe("reagir", () => {
  test("⚠️ CONFERE que eu podia ver o post antes de gravar", () => {
    // Sem isso, um `postId` sorteado que respondesse 200 confirmaria a
    // existência de um post privado — vazamento pela porta dos fundos.
    const c = corpoDe("reagir").replace(/\s+/g, " ");
    const conferiu = c.indexOf("podeVerPost({");
    const gravou = c.indexOf('.from("rede_reacoes") .upsert(');
    expect(conferiu).toBeGreaterThan(-1);
    expect(gravou).toBeGreaterThan(conferiu);
    expect(c).toContain("if (!pode) return");
  });

  test("⚠️ o tipo é validado pelo CATÁLOGO, não pelo cliente", () => {
    // O CHECK do banco é a segunda defesa; esta é a primeira, e é a que dá
    // mensagem em vez de erro 500.
    expect(corpoDe("reagir")).toContain("reacaoConhecida(data.tipo)");
  });
});

describe("os avisos", () => {
  test("⚠️ SÓ o pedido para seguir manda push", () => {
    // O push deste app é o mesmo canal do aviso de emergência. Um coraçãozinho
    // de madrugada gasta o canal que um dia vai avisar de uma consulta.
    expect(corpoDe("reagir")).not.toContain("sendPushToUser");
    expect(corpoDe("publicarPost")).not.toContain("sendPushToUser");
    const c = corpoDe("seguir").replace(/\s+/g, " ");
    expect(c).toContain('if (estado === "pendente") {');
    expect(c.indexOf("sendPushToUser")).toBeGreaterThan(c.indexOf('if (estado === "pendente")'));
  });
});

describe("a busca", () => {
  test("⚠️ `perfil_publico` é filtrado na CONSULTA, não depois", () => {
    // Quem não abriu o perfil não pode nem viajar pela rede. É o portão que
    // preserva o desenho original da aba — o grafo fechado por indicação.
    expect(corpoDe("buscarPerfis")).toContain('.eq("perfil_publico", true)');
  });

  test("e o resultado ainda passa pela régua e pelo bloqueio", () => {
    const c = corpoDe("buscarPerfis").replace(/\s+/g, " ");
    expect(c).toContain("podeAparecerNaBusca(");
    expect(c).toContain("ctx.bloqueio.has(p.id)");
  });
});

describe("o que é dela", () => {
  test("⚠️ `apagarPost` recorta pelo autor", () => {
    // O id vem do cliente: sem o recorte, ela arquivaria post alheio.
    const c = corpoDe("apagarPost").replace(/\s+/g, " ");
    expect(c).toContain('.eq("autor_id", eu)');
    expect(c).toContain("arquivado_em");
    expect(c).not.toContain(".delete(");
  });

  test("⚠️ o contador de seguidores é `null` para terceiros", () => {
    // Não existe placar público de audiência: ele mede popularidade num
    // momento em que ela já está sendo medida clinicamente.
    expect(corpoDe("verPerfil").replace(/\s+/g, " ")).toContain(
      "meusSeguidores: data.alvoId === eu ? 0 : null",
    );
    expect(corpoDe("buscarPerfis")).toContain("meusSeguidores: null");
  });

  test("todas as funções exigem sessão", () => {
    for (const f of [
      "meuPerfilSocial",
      "salvarPerfilSocial",
      "verPerfil",
      "seguir",
      "deixarDeSeguir",
      "responderPedido",
      "publicarPost",
      "apagarPost",
      "meuFeed",
      "reagir",
      "bloquear",
      "buscarPerfis",
    ]) {
      const c = corpoDe(f);
      expect(c).toContain("pacienteDaSessao");
      expect(c).toContain('"sessao"');
    }
  });
});

describe("higiene", () => {
  test('nenhum `select("*")`', () => {
    expect(CODIGO).not.toMatch(/select\(\s*["'`]\*/);
  });

  test("⚠️ e não existe comentário em lugar nenhum", () => {
    // Decisão do dono sobre a pesquisa: 20,9% das respostas com conselho em
    // fóruns de gestação estavam erradas, e o grupo não se autocorrige.
    expect(CODIGO).not.toContain("rede_comentarios");
    expect(CODIGO).not.toMatch(/\bcomentar\b|\bcomentario\b/i);
  });

  test("⚠️ cada DELETE do arquivo é deliberado, e eles são seis", () => {
    // Contar não basta — um número solto passa a mentir no dia em que alguém
    // troca um MARCA por um APAGA e ajusta o total. Cada um é nomeado, com o
    // motivo, e o total confere para pegar o sexto que aparecer sem revisão.
    //
    //  1. deixarDeSeguir       — guardar faria a chave única impedir de seguir de novo
    //  2. responderPedido      — recusar apaga; "recusado" bloquearia o par para sempre
    //  3. reagir (tipo null)   — tirar a reação é tirar, não marcar como tirada
    //  4. bloquear (desfazer)  — idem: guardar impediria bloquear de novo
    //  5. bloquear (o seguir)  — a linha viva ressuscitaria o vínculo depois
    //  6. salvarPost (tirar)   — desmarcar é desmarcar; um "salvo cancelado"
    //                            não é fato que alguém precise consultar
    expect(corpoDe("deixarDeSeguir")).toContain(".delete(");
    expect(corpoDe("responderPedido")).toContain(".delete(");
    expect(corpoDe("reagir")).toContain(".delete(");
    expect((corpoDe("bloquear").match(/\.delete\(/g) ?? []).length).toBe(2);

    expect(corpoDe("salvarPost")).toContain(".delete(");

    expect((CODIGO.match(/\.delete\(/g) ?? []).length).toBe(6);
  });

  test("⚠️ e o POST nunca é apagado, só arquivado", () => {
    // As reações apontam para ele: um DELETE levaria junto o registro de quem
    // esteve ali.
    expect(CODIGO).not.toMatch(/from\("rede_posts"\)[\s\S]{0,120}\.delete\(/);
  });
});
