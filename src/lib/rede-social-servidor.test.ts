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
    /* As DUAS consultas — só o fato de existirem duas linhas é o que a fonte
       pode provar. O que acontece com o resultado delas é testado por
       COMPORTAMENTO, em `conjuntoDeBloqueio` (`rede-social.test.ts`): esta
       asserção já quebrou uma vez por renomeação de variável, que é o cheiro
       de teste que lê fonte para provar comportamento. */
    expect(c).toContain('.eq("quem_id", eu)');
    expect(c).toContain('.eq("bloqueado_id", eu)');
    /* ⚠️ E a falha de leitura tem de ser LIDA. Sem `error`, `data ?? []` vira
       conjunto vazio e o bloqueio falha ABERTO — quem ela bloqueou volta ao
       feed. Ver `conjuntoDeBloqueio`. */
    expect(c).toContain("bloqueioFalhou");
    expect(c).toContain("conjuntoDeBloqueio(ids, bloqueioFalhou)");
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
    /* ⚠️ E pela `euEmCuidado`, que FALHA FECHADO. A versão anterior lia a
       coluna aqui e descartava o `error`: um timeout devolvia `data: null`,
       `?.care_mode` virava `undefined`, e a paciente em luto PUBLICAVA. Um
       portão que falha aberto é o mesmo que não existir. */
    for (const nome of ["publicarPost", "publicarStory"]) {
      const c = corpoDe(nome).replace(/\s+/g, " ");
      expect(c).toContain(
        'if (await euEmCuidado(sb, eu)) return { ok: false as const, motivo: "indisponivel" as const };',
      );
      expect(c).not.toContain("(meu as any)?.care_mode");
      /* E ANTES de qualquer escrita. */
      const portao = c.indexOf("euEmCuidado");
      const escreveu = c.indexOf(".insert(");
      expect(portao).toBeGreaterThan(-1);
      expect(escreveu).toBeGreaterThan(portao);
    }
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
    /* ⚠️ **Pela RÉGUA, e não por um `if` local.** `avisoMandaPush` existia com a
       decisão escrita e ZERO chamadores, enquanto aqui morava um
       `estado === "pendente"` que dizia a mesma coisa por acaso — duas réguas
       para "isto merece push?", que divergem no primeiro aviso novo. O QUE ela
       decide está testado por comportamento em `rede-social.test.ts`; aqui só se
       cobra que o servidor não tenha uma segunda opinião. */
    expect(c).toContain("if (avisoMandaPush(especie)) {");
    expect(c).not.toContain('if (estado === "pendente") {');
    expect(c.indexOf("sendPushToUser")).toBeGreaterThan(c.indexOf("avisoMandaPush(especie)"));
    /* E a espécie que vai para o push é a MESMA que foi para a caixa — não uma
       segunda derivação do estado. */
    expect(c).toContain(
      "await registrarAtividade(sb, { donoId: data.alvoId, quemId: eu, especie })",
    );
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

  test("⚠️ o contador de seguidores é `null` para terceiros — e para o espelho", () => {
    // Não existe placar público de audiência: ele mede popularidade num
    // momento em que ela já está sendo medida clinicamente.
    //
    // ⚠️ Este teste ficou VERMELHO quando o espelho nasceu, e a tentação era
    // afrouxá-lo. A afirmação que ele guarda não mudou — só ganhou um caso: o
    // número continua saindo apenas no MEU perfil, e agora nem nele quando a
    // tela está fingindo ser a de uma visitante (senão a prévia mostraria à
    // "estranha" um contador que ela nunca veria).
    const c = corpoDe("verPerfil").replace(/\s+/g, " ");
    /* ⚠️ O que importa é o `null` nos DOIS casos de terceiro (visitante e
       espelho) — o número real só existe no ramo do meio. A asserção antiga
       cravava o literal `0`, e por isso continuava verde sobre o defeito que
       ela deveria ter pegado: o contador REAL nunca chegava à tela, e o perfil
       dizia "0 seguidores" logo acima de uma lista com doze pessoas. */
    expect(c).toMatch(/meusSeguidores: persona \? null : data\.alvoId === eu \? [^:]+ : null/);
    expect(c).not.toContain("meusSeguidores: persona ? null : data.alvoId === eu ? 0 : null");
    expect(c).toMatch(/euSigo: persona \? null : data\.alvoId === eu \? [^:]+ : null/);
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

describe("editar a legenda", () => {
  /* ⚠️ O TESTE QUE JUSTIFICA A FUNÇÃO EXISTIR.
     Sem a régua clínica aqui, editar seria a PORTA DOS FUNDOS de
     `publicarPost`: bastava publicar "que fofo" e trocar depois por "não
     precisa ir ao pronto-socorro" para o texto proibido entrar no feed sem
     passar por nada — mesmo alcance, mesmo nome de consultório em volta. */
  test("⚠️ a régua clínica roda no texto NOVO, e RECUSA antes de gravar", () => {
    const c = corpoDe("editarPost");
    const limpo = c.replace(/\s+/g, " ");
    expect(limpo).toContain('await import("@/lib/pergunta-clinica")');
    expect(limpo).toContain('triarTexto(texto ?? "")');
    /* A recusa acontece ANTES de qualquer `.update(` — é isso que impede o
       texto de entrar. Comparar posições e não só existência: com o `triarTexto`
       depois do update, as duas strings continuariam no arquivo. */
    const ondeTria = limpo.indexOf("triarTexto(");
    const ondeGrava = limpo.indexOf(".update(");
    expect(ondeTria).toBeGreaterThan(-1);
    expect(ondeGrava).toBeGreaterThan(-1);
    expect(ondeTria).toBeLessThan(ondeGrava);
    expect(limpo).toContain('desfecho !== "publicavel"');
    expect(limpo).toContain("recadoDeConteudo(desfecho)");
  });

  /* ⚠️ O `postId` vem do cliente. Sem o portão, qualquer uuid reescreveria a
     legenda de qualquer paciente da plataforma. */
  test("⚠️ só a AUTORA edita — nas duas consultas", () => {
    const c = corpoDe("editarPost").replace(/\s+/g, " ");
    /* Uma vez na leitura de conferência, outra no update. */
    expect((c.match(/\.eq\("autor_id", eu\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  /* ⚠️ Apagar a legenda de um post que é só texto deixaria uma linha no feed
     sem nada dentro. Quem quer tirar do ar usa arquivar, que é reversível. */
  test("⚠️ um post não pode ficar vazio pela edição", () => {
    const c = corpoDe("editarPost").replace(/\s+/g, " ");
    expect(c).toContain("postEhValido({");
    expect(c).toContain('motivo: "vazio"');
  });

  /* ⚠️ Foto, enquete, visibilidade, marcações e comparação NÃO mudam: editar a
     camada de quem vê depois de o post ter sido lido não desfaz a leitura, e
     trocar a foto faria as reações apontarem para uma imagem que ninguém viu. */
  test("⚠️ só o TEXTO muda", () => {
    const c = corpoDe("editarPost");
    for (const proibido of ["visibilidade:", "imagem_path:", "enquete_opcoes:", "comparacao_de:"]) {
      /* O `select` de conferência pode citar as colunas; o que não pode é
         gravá-las. Por isso a busca é pelo trecho do `update`. */
      const gravacao = c.slice(c.indexOf("const gravar ="));
      expect(gravacao).not.toContain(proibido);
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

  test("⚠️ cada DELETE do arquivo é deliberado, e eles são nove", () => {
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
    //  7. apagarStory          — o story some em 24 h de qualquer jeito;
    //                            arquivar guardaria para sempre o que ela
    //                            pediu para tirar do ar antes da hora
    //
    // ⚠️ O POST é a exceção e continua sendo: ele é ARQUIVADO, nunca apagado,
    // porque as reações apontam para ele (o teste abaixo cobra isso).
    expect(corpoDe("deixarDeSeguir")).toContain(".delete(");
    expect(corpoDe("responderPedido")).toContain(".delete(");
    expect(corpoDe("reagir")).toContain(".delete(");
    expect((corpoDe("bloquear").match(/\.delete\(/g) ?? []).length).toBe(2);

    expect(corpoDe("salvarPost")).toContain(".delete(");
    // E o do story é recortado pela AUTORA — sem isso um id qualquer apagaria
    // o story de qualquer pessoa.
    const st = corpoDe("apagarStory").replace(/\s+/g, " ");
    expect(st).toContain(".delete(");
    expect(st).toContain('.eq("autor_id", eu)');

    /* ⚠️ E o OITAVO: tirar alguém de perto sem bloquear. É a saída do meio que
       faltava — a lista só oferecia "seguir/deixar de seguir", que é sobre quem
       EU sigo; para tirar quem me segue, a única opção era bloquear, que é
       nuclear e que a própria tela descreve como reversível.
       `.eq("seguido_id", eu)` é o portão: sem ele, um id no corpo do pedido
       desfaria o seguir entre duas OUTRAS pessoas. */
    const rm = corpoDe("removerSeguidor").replace(/\s+/g, " ");
    expect(rm).toContain(".delete(");
    expect(rm).toContain('.eq("seguido_id", eu)');
    expect(rm).toContain('.eq("seguidor_id", data.quemId)');

    /* ⚠️ E o NONO: tirar a PRÓPRIA marcação. Ter o próprio nome numa foto de
       gestação de outra pessoa não é decisão de quem publicou — sem esta saída,
       a única defesa dela seria pedir à amiga que apagasse o post inteiro.
       `.eq("quem_id", eu)` é o portão: sem ele, um `postId` + `quemId` no corpo
       do pedido tiraria a marcação de OUTRA pessoa, e a amiga marcada sumiria
       do post sem nunca ter pedido. */
    const mm = corpoDe("tirarMinhaMarcacao").replace(/\s+/g, " ");
    expect(mm).toContain(".delete(");
    expect(mm).toContain('.eq("post_id", data.postId)');
    expect(mm).toContain('.eq("quem_id", eu)');

    expect((CODIGO.match(/\.delete\(/g) ?? []).length).toBe(9);
  });

  test("⚠️ denunciar um post confere a VISIBILIDADE antes de gravar", () => {
    /* Sem isso, um uuid sorteado que respondesse `ok` confirmaria a existência
       de um post privado — vazamento pela porta dos fundos, o mesmo cuidado que
       `reagir` já tem. E denunciar o PRÓPRIO post é recusado: abriria um jeito
       barato de encher a fila do administrador. */
    const c = corpoDe("denunciarPost").replace(/\s+/g, " ");
    const conferiu = c.indexOf("montarPosts(sb, eu, [bruto], ctx)");
    const gravou = c.indexOf('.from("rede_denuncias").insert(');
    expect(conferiu).toBeGreaterThan(-1);
    expect(gravou).toBeGreaterThan(conferiu);
    expect(c).toContain("if (visivel.autorId === eu)");
    /* ⚠️ O MOTIVO é conferido contra o catálogo fechado. Sem isso, um corpo
       montado à mão gravaria texto livre num campo que vai para a tela de
       administração — e texto livre numa denúncia de app de gestação é onde
       alguém escreve a informação clínica de OUTRA pessoa. */
    expect(c).toContain("motivoConhecido(data.motivo)");
    const conferiuMotivo = c.indexOf("motivoConhecido(data.motivo)");
    expect(conferiuMotivo).toBeGreaterThan(-1);
    expect(gravou).toBeGreaterThan(conferiuMotivo);
    /* ⚠️ O TRECHO é congelado aqui: se ela editar ou arquivar o post depois, a
       fila continua sabendo o que foi denunciado. */
    expect(c).toContain("trecho:");
  });

  test("⚠️ denunciar um PERFIL confere que o alvo existe, e não sou eu", () => {
    /* Sem a conferência, um uuid sorteado que respondesse `ok` confirmaria que
       aquela conta existe — o mesmo vazamento pela porta dos fundos que a
       denúncia de post já evitava. E denunciar a si mesma abriria um jeito
       barato de encher a fila. */
    const c = corpoDe("denunciarPerfil").replace(/\s+/g, " ");
    expect(c).toContain("if (data.alvoId === eu)");
    const conferiu = c.indexOf("perfisPorId(sb, [data.alvoId])");
    const gravou = c.indexOf('.from("rede_denuncias").insert(');
    expect(conferiu).toBeGreaterThan(-1);
    expect(gravou).toBeGreaterThan(conferiu);
    expect(c).toContain("motivoConhecido(data.motivo)");
  });

  test("⚠️ a fila da plataforma é de ADMIN, e falha ao ler devolve ERRO", () => {
    /* "está tudo limpo" é a frase mais perigosa que uma fila de denúncias pode
       dizer errado — e é o que uma lista vazia diria numa falha de banco. */
    for (const nome of ["denunciasDaRede", "resolverDenunciaDaRede"]) {
      const c = corpoDe(nome).replace(/\s+/g, " ");
      expect(c).toContain("process.env.ADMIN_EMAILS");
      expect(c).toContain('motivo: "sem_acesso"');
    }
    const leitura = corpoDe("denunciasDaRede").replace(/\s+/g, " ");
    expect(leitura).toContain('return { ok: false as const, motivo: "banco" as const };');
    /* ⚠️ Quem DENUNCIOU não sai daqui: o `quem_id` é lido para CONTAR a
       reincidência e morre no servidor. Saber quem apertou o botão abriria
       caminho para retaliação. */
    expect(leitura).not.toContain("quemId: l.quem_id,");
    expect(leitura).toContain("reincidenciasPorPessoa(");
  });

  test("⚠️ resolver MARCA, nunca apaga", () => {
    /* A linha resolvida continua contando para a reincidência da conta. Apagar
       faria a quinta denúncia parecer a primeira. */
    const c = corpoDe("resolverDenunciaDaRede").replace(/\s+/g, " ");
    expect(c).toContain(".update({ resolvido_em:");
    expect(c).not.toContain(".delete(");
  });

  test("⚠️ e o POST nunca é apagado, só arquivado", () => {
    // As reações apontam para ele: um DELETE levaria junto o registro de quem
    // esteve ali.
    expect(CODIGO).not.toMatch(/from\("rede_posts"\)[\s\S]{0,120}\.delete\(/);
  });
});

describe("o que a tela precisa saber vem do servidor, e não de um chute", () => {
  test("⚠️ `salvo` sai de uma consulta MINHA, não do post", () => {
    // Um `salvo` que viesse do post seria o mesmo para todo mundo — o marcador
    // de uma acenderia na tela das outras. A consulta é recortada por
    // `quem_id = eu`, e é isso que torna a coleção privada.
    const c = funcaoInterna("salvosDe").replace(/\s+/g, " ");
    expect(c).toContain('from("rede_salvos")');
    expect(c).toContain('.eq("quem_id", eu)');
    expect(c).toContain('.in("post_id", postIds)');
    // E o post recebe o valor DA CONSULTA, nunca um literal.
    const m = funcaoInterna("montarPosts").replace(/\s+/g, " ");
    expect(m).toContain("salvo: salvos.has(p.id)");
    expect(m).not.toMatch(/salvo: (true|false)/);
  });

  test("⚠️ `pendente` exige pedido VIVO, e só em `pediu_para_seguir`", () => {
    // Sem as duas metades, a caixa mostra "Aceitar" num pedido já aceito — um
    // botão que promete uma ação e não faz nada, porque o `update` filtra por
    // `estado = "pendente"` e não acha mais linha.
    const c = corpoDe("minhaAtividade").replace(/\s+/g, " ");
    expect(c).toContain('.eq("seguido_id", eu)');
    expect(c).toContain('.eq("estado", "pendente")');
    expect(c).toContain('pendente: l.especie === "pediu_para_seguir" && pendentes.has(l.quem_id)');
  });
});

describe("quem viu meu story", () => {
  test("⚠️ a lista é da AUTORA, e a conferência vem ANTES da leitura", () => {
    // Sem ela, um id de story sorteado devolveria o círculo social de qualquer
    // pessoa da plataforma — o mesmo dado que fez a lista de seguidores não ser
    // pública aqui.
    const c = corpoDe("quemViuMeuStory").replace(/\s+/g, " ");
    const dono = c.indexOf("autor_id !== eu");
    const lista = c.indexOf('from("rede_stories_vistos")');
    expect(dono).toBeGreaterThan(-1);
    expect(lista).toBeGreaterThan(-1);
    expect(dono).toBeLessThan(lista);
    expect(c).toContain('motivo: "indisponivel"');
  });

  /* ⚠️ A MESMA ORDEM em "quem reagiu", e pela mesma razão: a lista de quem
     reagiu a um post de gestação é o CÍRCULO SOCIAL dela. Um `postId` no corpo
     do pedido não pode devolver a lista do post de outra pessoa — e a única
     coisa entre isso e o vazamento é a conferência do dono vir ANTES da
     consulta de reações. */
  test("⚠️ quem reagiu confere o DONO antes de ler as reações", () => {
    const c = corpoDe("quemReagiuAoPost").replace(/\s+/g, " ");
    const dono = c.indexOf("autor_id !== eu");
    const lista = c.indexOf('from("rede_reacoes")');
    expect(dono).toBeGreaterThan(-1);
    expect(lista).toBeGreaterThan(-1);
    expect(dono).toBeLessThan(lista);
    expect(c).toContain('motivo: "indisponivel"');
  });
});

describe("sugerido para você — o pool é estreito, e o estreitamento é o recurso", () => {
  const C = corpoDe("sugestoesDoFeed").replace(/\s+/g, " ");

  test("⚠️ os DOIS filtros: perfil público E publicação pública", () => {
    // As duas camadas são separadas de propósito — perfil aberto com post
    // `amigas` é o caso normal. Sugerir por uma só entregaria a estranhos o
    // post que ela escreveu para as amigas.
    expect(C).toContain('.eq("perfil_publico", true)');
    expect(C).toContain('.eq("visibilidade", "publico")');
  });

  test("⚠️ ninguém do círculo dela entra — nem quem ela já pediu para seguir", () => {
    // Sugerir alguém para quem ela acabou de mandar pedido é o app esquecendo
    // o que ela fez cinco minutos atrás.
    expect(C).toContain("id === eu || ctx.sigo.has(id) || ctx.bloqueio.has(id) || jaPedi.has(id)");
    expect(C).toContain('.eq("estado", "pendente")');
  });

  test("⚠️ quem não pode ser ACHADA não pode ser sugerida — a mesma régua da busca", () => {
    // Sem isso a sugestão vira a porta dos fundos da busca, e o Modo Cuidado
    // volta à tela de estranhas pela lateral.
    expect(C).toContain("podeAparecerNaBusca({");
    expect(C).toContain("emCuidado: !!p.care_mode");
  });

  test("⚠️ o post é montado por `montarPosts`, nunca à mão", () => {
    // É ela que aplica `podeVerPost`, assina as URLs e traz reações e salvos.
    // Montar aqui seria a segunda régua de visibilidade do arquivo.
    expect(C).toContain("await montarPosts(");
    expect(C).not.toContain("imagem_path: ");
  });

  test("⚠️ a ordem é a da RÉGUA, não a do banco", () => {
    // `montarPosts` devolve na ordem que recebeu; qualquer reordenação
    // cronológica aqui desfaria o ranqueamento inteiro em silêncio.
    expect(C).toContain("ordenarSugestoes(");
    expect(C).toContain("posts.sort(");
    expect(C).not.toContain("ordenarFeed(posts)");
  });

  test("⚠️ o número de elos NÃO viaja para o cliente", () => {
    // Ele ordena e acaba aqui. "Seguida por Marina e mais 3" entregaria quem
    // ela segue a quem só abriu o feed.
    const retorno = C.slice(C.lastIndexOf("return {"));
    expect(retorno).not.toContain("elos");
  });
});

describe("o espelho — 'ver como os outros veem'", () => {
  const C = corpoDe("verPerfil").replace(/\s+/g, " ");

  test("⚠️ a persona só vale sobre o PRÓPRIO perfil", () => {
    // Sem esta condição o espelho vira um jeito de perguntar ao servidor "o que
    // a Fulana esconde de mim?", que é o oposto do que ele existe para fazer.
    expect(C).toContain("data.comoVisitante && data.alvoId === eu");
  });

  test("⚠️ o olho da prévia é o SENTINELA, nunca o meu id", () => {
    // `podeVerPost` curto-circuita em `euId === post.autorId`: com o meu id
    // TODO post passaria, inclusive os da camada `amigas`, e a tela afirmaria
    // que uma seguidora vê o desabafo de terça. Sem erro e sem log.
    // ⚠️ A escolha do olho e o contexto forjado são PUROS agora
    // (`contextoDaPersona`), e cobertos por comportamento em
    // `selo-do-perfil.test.ts` — uma mutação que montasse a prévia da estranha
    // com o meu id passava verde enquanto isto era só texto de fonte.
    expect(C).toContain("contextoDaPersona(persona, data.alvoId)");
    expect(C).toContain("montarPosts(sb, previa.euId,");
    expect(C).toContain("sigo: previa.sigo");
    expect(C).toContain("bloqueio: previa.bloqueio");
  });

  test("⚠️ sob a prévia eu não sou eu", () => {
    // Com `souEu` verdadeiro a tela desenharia "Editar perfil" e os controles
    // da dona enquanto afirma ser a visão de uma estranha.
    expect(C).toContain("souEu: persona ? false : data.alvoId === eu");
  });

  test("⚠️ o portão de alcance vale para o VISITANTE DE VERDADE, não só para a prévia", () => {
    // ⚠️ Este teste nasceu de um achado confirmado: `verPerfil` NUNCA conferia
    // `perfil_publico`. Com o uuid em mãos — e ele viaja em toda reação, todo
    // story visto, todo pedido de seguir — qualquer paciente abria qualquer
    // perfil, fechado ou não. E o espelho AFIRMAVA a tranca que não existia:
    // a paciente lia "ela não consegue abrir o seu perfil" e ligava o selo
    // confiando naquilo.
    expect(C).toContain("alcancaOPerfil({");
    // O vínculo REAL entra quando não há persona — `olho` é null no caminho real.
    expect(C).toContain("sigoAtivo: olho ? olho.sigoAtivo : vinculoAtivo");
    expect(C).toContain("somosAmigas: olho ? olho.somosAmigas : ctx.amigas.has(data.alvoId)");
    expect(C).toContain("if (!alcanca)");
    // E a recusa do caminho real é a MESMA das outras: distinguir contaria à
    // visitante que aquele perfil existe e está fechado.
    expect(C).toContain('return persona ? { ok: false as const, motivo: "trancado" as const }');
    expect(C).toContain(': { ok: false as const, motivo: "indisponivel" as const };');
  });

  test("⚠️ o SELO passa pela mesma régua na prévia e na tela real", () => {
    // Era o campo que uma prévia feita só sobre `podeVerPost` desenharia sem
    // nunca ter filtrado: os selos são campos de `PerfilNaTela`, montados a
    // partir do perfil, e não passam pelo filtro dos posts.
    expect(C).toContain("await seloDe(a)");
    expect(C).toContain("seloSemana: selo.semana");
    expect(C).toContain("seloBebe: selo.bebe");
    // E a régua é a de `lib/`, nunca reescrita aqui.
    expect(CODIGO).not.toContain("function seloDoPerfil");
    expect(FONTE).toContain('from "@/lib/selo-do-perfil"');
  });

  test("⚠️ a idade gestacional sai de `computeGestation`, a régua única", () => {
    // Subtrair datas aqui faria a rede social discordar do consultório sobre a
    // semana da mesma paciente.
    const c = funcaoInterna("seloDe").replace(/\s+/g, " ");
    expect(c).toContain("computeGestation({");
    // ⚠️ E o "hoje" é o de SÃO PAULO, não o do contêiner: o servidor roda em
    // UTC e, das 21h à meia-noite, já está no dia seguinte — num dia de cada
    // sete isso é a virada de semana, e o perfil discordaria da home da mesma
    // paciente, na mesma sessão.
    expect(c).toContain("today: hojeEmSaoPaulo()");
    // O mapeamento linha→entrada é puro e testado por comportamento.
    expect(c).toContain("seloDoPerfil(entradaDoSelo(p,");
    expect(c).not.toMatch(/new Date\(.*86400000/);
  });
});

describe("o carimbo do story — Fase 3", () => {
  test("⚠️ a semana é DERIVADA na leitura, e o banco guarda só um booleano", () => {
    // Guardar o texto (ou queimá-lo no JPEG) faria a semana sobreviver à
    // decisão dela: o arquivo no balde ficaria com "28 semanas" para sempre, e
    // uma paciente que entra em Modo Cuidado depois de publicar teria a semana
    // pendurada num arquivo que o app não sabe mais desenhar.
    const c = corpoDe("storiesDoFeed").replace(/\s+/g, " ");
    expect(c).toContain("carimbo: l.carimbo_semana ? await carimboDe(p) : null");
    const pub = corpoDe("publicarStory").replace(/\s+/g, " ");
    expect(pub).toContain("carimbo_semana: data.carimbarSemana === true");
    // Nada de texto de semana indo para o banco.
    expect(pub).not.toMatch(/semana: .*(semanas|seloSemana)/);
  });

  test("⚠️ publicar não quebra em banco sem as colunas, e são TRÊS degraus", () => {
    // O deploy chega antes do SQL: sem o recuo, publicar um story passaria a
    // falhar INTEIRO — não só o carimbo.
    //
    // ⚠️ E são três degraus, um por LEVA de colunas: o cheio (enquete +
    // pergunta), o do meio (só o carimbo) e o mínimo. Um recuo que pulasse
    // direto para o mínimo apagaria o carimbo de quem já rodou AQUELE SQL, só
    // porque o SQL da enquete ainda não rodou.
    const pub = corpoDe("publicarStory").replace(/\s+/g, " ");
    expect(pub).toContain("const base = { autor_id: eu, imagem_path: caminho, texto: data.texto }");
    expect(pub).toContain("enquete_opcoes: enquete");
    expect(pub).toContain(".insert({ ...base, carimbo_semana: data.carimbarSemana === true })");
    expect(pub).toContain(".insert(base)");
    /* A ordem dos degraus: do mais completo ao mínimo. Os marcadores são os
       que distinguem um insert do outro — `enquete_opcoes` só existe no
       primeiro, e o segundo fecha as chaves logo depois do carimbo. */
    const cheio = pub.indexOf("pergunta_aberta: data.perguntaAberta === true");
    const meio = pub.indexOf(".insert({ ...base, carimbo_semana: data.carimbarSemana === true })");
    const minimo = pub.indexOf(".insert(base)");
    expect(cheio).toBeGreaterThan(-1);
    expect(meio).toBeGreaterThan(cheio);
    expect(minimo).toBeGreaterThan(meio);
  });

  /* ⚠️ A enquete do story passa pela MESMA régua do post e pela MESMA triagem
     clínica. "Menino ou menina?" é inofensivo; "posso tomar buscopan?" não é —
     e uma enquete é exatamente o formato que faz meia dúzia de leigas
     responderem com conduta. */
  test("⚠️ a enquete do story usa a régua do post e passa pela triagem", () => {
    const pub = corpoDe("publicarStory").replace(/\s+/g, " ");
    expect(pub).toContain("limparOpcoes(data.enquete ?? [])");
    expect(pub).toContain("enqueteValida(opcoes)");
    const triagem = pub.indexOf("for (const o of enquete)");
    const grava = pub.indexOf("const base = {");
    expect(triagem).toBeGreaterThan(-1);
    expect(triagem).toBeLessThan(grava);
  });

  test("⚠️ o carimbo NÃO passa pela chave do perfil", () => {
    // Amarrar os dois obrigaria quem quer mandar UMA foto com a semana a
    // publicá-la no perfil para sempre. A régua (e os silêncios) é a mesma.
    const c = funcaoInterna("carimboDe").replace(/\s+/g, " ");
    expect(c).toContain("semanaParaCarimbo(entradaDoSelo(p,");
    expect(c).toContain("today: hojeEmSaoPaulo()");
    expect(c).not.toContain("mostrar_semana");
  });
});

describe("o código de embaixadora no perfil — Fase 5", () => {
  const C = corpoDe("verPerfil").replace(/\s+/g, " ");

  test("⚠️ NUNCA aplicável sob a prévia", () => {
    // `ref_code` é gravado UMA VEZ e nunca reescrito, e o mesmo campo carrega o
    // código da MÉDICA dela: um toque numa tela que o app apresenta como inerte
    // queimaria a indicação para sempre, sem erro e sem volta.
    expect(C).toContain(
      "possoAplicarOCodigo: !persona && !!codigo && !jaTenhoCodigo && data.alvoId !== eu",
    );
  });

  test("⚠️ e nunca no MEU próprio perfil", () => {
    // No meu, a pílula ofereceria que eu me indicasse.
    expect(C).toContain("data.alvoId === eu ? null : await codigoDeEmbaixadora(sb, data.alvoId)");
  });

  test("⚠️ só código ATIVO aparece", () => {
    // Um código desligado não atribui e não paga: mostrá-lo faria a visitante
    // aplicar, ver "pronto" e nunca receber nada.
    const c = funcaoInterna("codigoDeEmbaixadora").replace(/\s+/g, " ");
    expect(c).toContain('.select("code, active")');
    expect(c).toContain("aff?.active ?");
  });

  test("⚠️ falha ao saber se já tenho código vale COMO SE tivesse", () => {
    // Oferecer o botão sem saber faria a paciente tocar, o servidor recusar em
    // silêncio, e ela ficar achando que aplicou.
    const c = funcaoInterna("tenhoRefCode").replace(/\s+/g, " ");
    expect(c).toContain("data ? !!(data as any).ref_code : true");
  });

  test("⚠️ a tela NÃO reescreve as réguas de `atribuirInfluenciadora`", () => {
    // E-mail confirmado, código ativo e `ref_code` nulo são conferidos lá. Uma
    // segunda régua na tela diria "pronto" sobre o que o servidor recusou.
    /* ⚠️ SEM COMENTÁRIOS. A primeira versão deste teste ficou vermelha por
       causa da minha própria prosa: o comentário de `aplicarCodigo` explica que
       o servidor usa `.is("ref_code", null)` na condição do UPDATE, e o
       `not.toContain` casou com a explicação. É a mesma lição da catraca de
       portas, chegando pelo lado oposto — lá a prosa fazia o teste PASSAR. */
    const tela = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));
    expect(tela).toContain("atribuirInfluenciadora");
    expect(tela).not.toContain("email_confirmed_at");
    expect(tela).not.toContain('.is("ref_code"');
  });
});

describe("⚠️ a régua clínica roda no CANAL PRINCIPAL", () => {
  test("`publicarPost` tria o texto E cada opção da enquete", () => {
    /* O raciocínio que fechou os comentários (20,9% erradas, 5,5% danosas) vale
       palavra por palavra para um post — mesmo público, mesma tela, mesmo nome
       de consultório em volta, e com MAIS alcance que um comentário teria.
       A régua protegia a caixinha e deixava a porta da frente aberta: quem
       quisesse dar o conselho perigoso não usava a caixinha, publicava. */
    const c = corpoDe("publicarPost").replace(/\s+/g, " ");
    expect(c).toContain("triarTexto");
    expect(c).toContain('for (const trecho of [data.texto ?? "", ...opcoes])');
    expect(c).toContain('desfecho !== "publicavel"');
    /* E RECUSA antes de gravar — depois do insert seria um post publicado com
       erro na tela. */
    const triou = c.indexOf("triarTexto");
    const gravou = c.indexOf('.from("rede_posts") .insert(');
    expect(triou).toBeGreaterThan(-1);
    expect(gravou).toBeGreaterThan(triou);
  });

  test("`publicarStory` também", () => {
    /* O story some em 24h, o que o torna MAIS atraente para quem quer dar
       conselho e não quer o registro. */
    const c = corpoDe("publicarStory").replace(/\s+/g, " ");
    expect(c).toContain("triarTexto");
    expect(c).toContain('desfecho !== "publicavel"');
  });

  test("⚠️ o recado NÃO ensina qual palavra barrou", () => {
    /* Devolver "sua publicação tem a palavra X" faz quem quiser burlar precisar
       de duas tentativas. */
    const r = semComentarios(FONTE);
    const i = r.indexOf("function recadoDeConteudo");
    expect(i).toBeGreaterThan(-1);
    const corpo = r.slice(i, r.indexOf("\n}", i));
    expect(corpo).not.toMatch(/palavra|termo|cont(é|e)m|proibid/i);
    expect(corpo).toContain("SOS");
  });
});

describe("⚠️ Modo Cuidado de QUEM LÊ, no servidor", () => {
  test("as quatro leituras do feed conferem `euEmCuidado`", () => {
    /* O único portão era a prop `careMode` da tela, derivada de um perfil que
       chega DEPOIS de duas rodadas de rede. `carregarFeed()` dispara na
       primeira renderização com `careMode === false`, então o feed voltando
       antes do perfil dava um FLASH do feed completo — ultrassons, selos de
       "28 semanas", enquetes de nome — para quem acabou de perder a gestação.
       Todo o resto da aba respeita "o portão mora no servidor". */
    for (const nome of ["meuFeed", "storiesDoFeed", "sugestoesDoFeed", "minhaAtividade"]) {
      const c = corpoDe(nome).replace(/\s+/g, " ");
      const gate = c.indexOf("await euEmCuidado(sb, eu)");
      expect(gate).toBeGreaterThan(-1);
      /* E ANTES de ler qualquer conteúdo. */
      const leu = c.indexOf(".from(");
      expect(leu === -1 || gate < leu).toBe(true);
    }
  });

  test("⚠️ falha ao ler o `care_mode` conta como EM CUIDADO", () => {
    /* A única direção segura: errar para um lado é um feed vazio por uma
       abertura; para o outro, é a tela que o Modo Cuidado existe para impedir. */
    const i = CODIGO.indexOf("async function euEmCuidado");
    expect(i).toBeGreaterThan(-1);
    const corpo = CODIGO.slice(i, CODIGO.indexOf("\n}", i));
    expect(corpo).toContain("if (error) return true;");
  });
});
