/**
 * AS IMAGENS SAEM DO POSTGRES SEM PERDER NENHUMA.
 *
 * ─── O QUE ESTÁ EM JOGO ─────────────────────────────────────────────────────
 *
 * O conteúdo ativo é foto de álbum de família — a plataforma parou de aceitar
 * envio de laudo de exame (ago/2026, "não vamos ter essa responsabilidade em
 * guardar os exames"), mas os laudos já enviados antes continuam no banco e
 * no Storage, e `imagens.server.ts` continua servindo os dois baldes: a
 * exclusão de conta (LGPD) ainda precisa varrer o balde de exames órfão. Uma
 * migração de armazenamento mal feita aqui não "degrada a performance": perde
 * a foto que a família mandou, e não há desfazer.
 *
 * Por isso o desenho inteiro é de recuo seguro, e é isso que este arquivo
 * cobra — não a economia de disco, que é só a razão de existir.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BALDE_ALBUM, BALDE_EXAMES, decodificarDataUrl } from "./imagens.server";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/* Um GIF 1×1 de verdade, para o decodificador ter bytes reais com que lidar. */
const GIF_1x1 = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

describe("1. o decodificador só aceita o que é imagem", () => {
  test("uma data URL de imagem vira bytes", () => {
    const r = decodificarDataUrl(GIF_1x1);
    expect(r).not.toBeNull();
    expect(r!.tipo).toBe("image/gif");
    expect(r!.extensao).toBe("gif");
    expect(r!.bytes.length).toBeGreaterThan(20);
  });

  test("uma URL http NÃO vira bytes", () => {
    /**
     * É o defeito que a segunda rodada de migração criaria: uma linha já
     * migrada carrega uma URL, não base64. Sem esta recusa, o script gravaria
     * a string "https://..." dentro de um arquivo .jpg — um arquivo que
     * existe, tem tamanho, e não é uma imagem. A tela mostraria ícone
     * quebrado e o base64 original já teria sido descartado.
     */
    expect(decodificarDataUrl("https://exemplo.com/foto.jpg")).toBeNull();
    expect(decodificarDataUrl("/presentes/semente.svg")).toBeNull();
  });

  test("base64 que decodifica para NADA não vira arquivo de zero byte", () => {
    /**
     * `Buffer.from` não estoura com base64 inválido — ele ignora os caracteres
     * que não pertencem ao alfabeto e devolve o que sobrou, às vezes zero
     * byte. Gravar zero byte cria um arquivo que a tela exibe como imagem
     * quebrada, e aí a foto original já foi descartada.
     *
     * O caso tem de ser um base64 NÃO VAZIO: com a string vazia quem barra é a
     * regex (que exige `.+`), e a guarda de tamanho nunca roda. Foi assim que
     * um mutante que apagava a guarda sobreviveu — o teste testava a regex
     * achando que testava a guarda.
     */
    expect(decodificarDataUrl("data:image/jpeg;base64,!!!!")).toBeNull();
    expect(decodificarDataUrl("data:image/jpeg;base64,===")).toBeNull();
    /* E a string vazia continua barrada, pela regex. */
    expect(decodificarDataUrl("data:image/jpeg;base64,")).toBeNull();
  });

  test("não é imagem, não passa", () => {
    expect(decodificarDataUrl("data:application/pdf;base64,QQ==")).toBeNull();
    expect(decodificarDataUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(decodificarDataUrl("")).toBeNull();
  });

  test("a extensão segue o tipo, não o palpite", () => {
    expect(decodificarDataUrl("data:image/png;base64,iVBORw0KGgo=")?.extensao).toBe("png");
    expect(decodificarDataUrl("data:image/webp;base64,UklGRg==")?.extensao).toBe("webp");
    /* Qualquer outro tipo de imagem cai em jpg — inclusive image/jpeg. */
    expect(decodificarDataUrl("data:image/jpeg;base64,/9j/4AAQ")?.extensao).toBe("jpg");
  });
});

describe("2. o upload nunca derruba a gravação", () => {
  const mod = semComentarios("src/lib/imagens.server.ts");

  test("`guardarImagem` não deixa exceção escapar", () => {
    /**
     * O banco de produção está atrás do repositório há meses — está escrito no
     * CLAUDE.md. Se este código subir antes de o balde existir e o upload
     * estourasse, levaria junto o exame da paciente. `null` não é erro a
     * tratar: é a instrução para gravar base64 como sempre.
     */
    const i = mod.indexOf("export async function guardarImagem");
    const fim = mod.indexOf("export async function urlAssinada");
    const corpo = mod.slice(i, fim);
    expect(corpo).toContain("try {");
    expect(corpo).toContain("catch {");
    expect(corpo).toContain("return null");
  });

  test("grava UMA coisa ou OUTRA, nunca as duas", () => {
    /**
     * Gravar o base64 junto do caminho manteria exatamente o peso que esta
     * mudança existe para tirar — a migração ficaria só no nome.
     *
     * A decisão mora num lugar só (`gravarLinhaComImagem`), e é por isso que a
     * asserção mudou de endereço: as duas escritas do álbum e a do exame
     * passaram a chamar a mesma função, em vez de repetirem o ternário três
     * vezes e divergirem na primeira correção.
     */
    expect(mod).toContain("image_data: caminho ? null : (opts.dataUrl ?? null)");
    expect(mod).toContain("image_path: caminho");
    /* A CHAMADA, não o import: trocar só a linha do `import` deixava o teste
       verde enquanto a escrita voltava a mandar a coluna crua. */
    expect(semComentarios("src/lib/family.functions.ts")).toContain("await gravarLinhaComImagem({");
  });

  test("coluna ausente NÃO impede a gravação — recua para base64", () => {
    /**
     * O buraco no meio do desenho "seguro", achado por auditoria depois de já
     * estar no ar. `guardarImagem` recuava quando o BALDE não existia; faltava
     * a COLUNA.
     *
     * O PostgREST não ignora coluna desconhecida no payload — recusa o INSERT
     * inteiro com PGRST204. Como `image_path` nasce num APLICAR que produção
     * ainda não viu, mandar a coluna junto não deixava de economizar disco:
     * NÃO GRAVAVA o exame. Ela fotografa o laudo às onze da noite, a tela diz
     * que falhou, e não há nada em lugar nenhum.
     */
    const i = mod.indexOf("export async function gravarLinhaComImagem");
    const corpo = mod.slice(i, mod.indexOf("export async function lerComCaminho"));
    /* A LINHA que governa o recuo, não a menção ao nome: um mutante que
       devolvia o erro antes dela sobreviveu cobrando só `toContain`. */
    expect(corpo).toContain("if (!colunaAusente(error)) return { error };");
    /* O recuo devolve a imagem para `image_data` — senão a linha entraria sem
       imagem nenhuma, que é o mesmo desastre com outro nome. */
    expect(corpo).toContain("image_data: opts.dataUrl ?? null");
    /* E apaga o arquivo que subiu: sem referência, é órfão puro. */
    expect(corpo).toContain("apagarImagem(opts.balde, caminho)");
  });

  test("e a LEITURA também recua — 42703 derruba a consulta inteira", () => {
    /* Um `select` citando coluna ausente não devolve a linha sem o campo: volta
       42703 e derruba tudo. O médico não veria a foto nenhuma — nem as que
       estão em base64 e sempre funcionaram. */
    const i = mod.indexOf("export async function lerComCaminho");
    const corpo = mod.slice(i, i + 900);
    expect(corpo).toContain("if (!colunaAusente(primeira.error)) return primeira;");
    expect(corpo).toContain("aplicarFiltros(sb.from(tabela).select(colunas))");
  });
});

describe("3. a leitura prefere o arquivo, mas nunca mostra tela quebrada", () => {
  const mod = semComentarios("src/lib/imagens.server.ts");

  test("caminho primeiro, base64 só como reserva", () => {
    /**
     * A ordem é o coração da convivência. Enquanto o backfill não termina, as
     * duas colunas coexistem — e uma linha JÁ migrada que ainda carregue
     * `image_data` precisa servir o ARQUIVO, não a cópia velha que está para
     * ser apagada.
     */
    const i = mod.indexOf("export async function imagemDaLinha");
    const corpo = mod.slice(i);
    expect(corpo.indexOf("image_path")).toBeLessThan(corpo.indexOf("image_data"));
  });

  test("se a assinatura falhar e houver base64, mostra o base64", () => {
    const i = mod.indexOf("export async function imagemDaLinha");
    const corpo = mod.slice(i, i + 700);
    /* `if (url) return url` e não `return url`: com `return url` direto, um
       balde fora do ar apagaria da tela fotos que ainda existem na coluna. */
    expect(corpo).toContain("if (url) return url");
    expect(corpo).toContain("image_data");
  });
});

describe("4. apagar a linha apaga o arquivo", () => {
  const family = semComentarios("src/lib/family.functions.ts");

  test("o caminho é lido ANTES do delete", () => {
    /* Depois do delete a linha não existe, e o arquivo ficaria no balde para
       sempre — pago e invisível. */
    const iSelect = family.indexOf("lerComCaminho<{ image_path");
    const iDelete = family.indexOf(".delete()", iSelect);
    expect(iSelect).toBeGreaterThan(-1);
    expect(iDelete).toBeGreaterThan(iSelect);
  });

  test("e a leitura do caminho é recortada pela dona", () => {
    /**
     * Sem `.eq(patient_user_id)`, um id de outra pessoa devolveria o caminho da
     * foto dela — e o arquivo seria apagado por quem não podia. O DELETE tem o
     * filtro; a leitura ao lado precisa do mesmo.
     *
     * Recortado à PRÓPRIA leitura — até o `.maybeSingle()` que a fecha. Uma
     * janela de caracteres alcançava o DELETE logo abaixo, que tem o filtro:
     * apagar o `.eq` da leitura deixava o teste verde na conta do vizinho.
     */
    const i = family.indexOf("lerComCaminho<{ image_path");
    const consulta = family.slice(i, family.indexOf(".maybeSingle()", i));
    expect(consulta).toContain('.eq("patient_user_id"');
  });

  test("mas a exclusão do arquivo não pode derrubar a exclusão da linha", () => {
    /* Um órfão no balde custa centavos; uma exclusão que estoura impede a
       paciente de apagar a própria foto, o que é problema de LGPD. */
    const mod = semComentarios("src/lib/imagens.server.ts");
    const i = mod.indexOf("export async function apagarImagem");
    expect(mod.slice(i)).toContain("catch {");
  });
});

describe("5. os baldes são privados, e o SQL diz por quê", () => {
  const sql = readFileSync("supabase/APLICAR_IMAGENS_NO_STORAGE.sql", "utf8");

  test("os dois baldes entram com public = false", () => {
    for (const b of [BALDE_ALBUM, BALDE_EXAMES]) {
      expect(sql).toContain(`values ('${b}', '${b}', false)`);
    }
    /* E o `on conflict` reforça, em vez de deixar passar: um balde criado à
       mão como público em algum momento volta a privado ao rodar isto. */
    expect(sql).toContain("on conflict (id) do update set public = false");
  });

  test("nenhuma policy de storage é criada", () => {
    /**
     * Deliberado. Toda leitura e escrita passa pelo servidor com a chave de
     * serviço, que ignora RLS — o navegador nunca fala com o Storage. Sem
     * policy não existe policy mal escrita, e laudo exposto por uma cláusula
     * errada é o pior acidente possível neste produto.
     */
    expect(sql).not.toMatch(/create\s+policy/i);
    expect(sql).not.toMatch(/on\s+storage\.objects/i);
  });

  test("o SQL é idempotente", () => {
    /* O dono roda estes arquivos à mão no SQL Editor, às vezes duas vezes. */
    expect(sql).toContain("add column if not exists image_path");
    expect(sql).toContain("create index if not exists");
  });

  test("e NÃO apaga base64 nenhum", () => {
    /* A limpeza é da segunda passada do script, que confere o arquivo antes.
       Um UPDATE ... SET image_data = null solto neste arquivo apagaria laudo
       sem conferir nada — e o dono roda este arquivo inteiro de uma vez. */
    const semRodape = sql.split("DEPOIS DO BACKFILL")[0];
    expect(semRodape).not.toMatch(/update .* set image_data/i);
    expect(semRodape).not.toMatch(/drop column/i);
  });
});

describe("6. o backfill é seguro por construção", () => {
  const script = readFileSync("scripts/migrar-imagens.mjs", "utf8");

  test("subir NÃO apaga o base64", () => {
    /* No pior caso sobra um arquivo órfão, que custa centavos. */
    const i = script.indexOf("async function subir");
    const fim = script.indexOf("async function limpar");
    expect(script.slice(i, fim)).not.toMatch(/image_data:\s*null/);
  });

  test("limpar confere o arquivo antes de apagar", () => {
    /**
     * É o que separa "gravei um caminho" de "o arquivo está lá e é este". Sem
     * o download de volta, a segunda passada seria exclusão às cegas.
     */
    const i = script.indexOf("async function limpar");
    const corpo = script.slice(i);
    expect(corpo).toContain(".download(caminho)");
    expect(corpo).toContain("baixado.length !== original.bytes.length");
    const iConfere = corpo.indexOf("baixado.length !== original.bytes.length");
    const iApaga = corpo.indexOf("image_data: null");
    expect(iApaga).toBeGreaterThan(iConfere);
  });

  test("e exige --confirmar para apagar de verdade", () => {
    /* Um comando que apaga dado de paciente não pode disparar por engano ao
       apertar seta-para-cima no terminal. */
    const i = script.indexOf("async function limpar");
    expect(script.slice(i)).toContain("if (!confirmar) {");
  });

  test("um upload cujo caminho não gravou é desfeito", () => {
    /* Sem a linha apontando para ele o arquivo é órfão puro — e na próxima
       rodada subiríamos outro, pagando duas vezes pela mesma foto. */
    const i = script.indexOf("caminho não gravou");
    expect(script.slice(i, i + 300)).toContain(".remove([caminho])");
  });
});

describe("7. excluir a conta apaga os ARQUIVOS, não só as linhas", () => {
  /**
   * ─── A SEGUNDA PONTA SOLTA DA MIGRAÇÃO, ACHADA POR REVISÃO ────────────────
   *
   * `excluirMinhaConta` apaga as tabelas da IA à mão e deixa o resto sair pelos
   * `ON DELETE CASCADE` do `deleteUser` — o que derruba as LINHAS de
   * `exam_files` e `family_album_posts`.
   *
   * Enquanto o laudo morava DENTRO da linha, derrubar a linha era derrubar a
   * imagem. Ao mover os bytes para o Storage, essa equivalência se quebrou em
   * silêncio: a linha some, o arquivo fica.
   *
   * Ela pede a exclusão, o produto responde que apagou, e o laudo dela continua
   * no nosso disco — a LGPD deixa de ser exequível pelo caminho que a própria
   * migração criou. É a segunda ponta assim; a primeira foi a paciente perder o
   * acesso ao próprio exame.
   */
  const conta = semComentarios("src/lib/conta.functions.ts");
  /* `mod` mora no escopo do describe 2 — aqui precisa do seu próprio. */
  const mod = semComentarios("src/lib/imagens.server.ts");

  test("os dois baldes são varridos", () => {
    expect(conta).toContain("apagarPastaDoDono(BALDE_EXAMES, uid)");
    expect(conta).toContain("apagarPastaDoDono(BALDE_ALBUM, uid)");
  });

  test("e ANTES do deleteUser, não depois", () => {
    /**
     * Com a linha já apagada não há mais como saber quais arquivos eram dela: o
     * caminho carrega o uuid, mas quem relaciona uuid a pessoa é a linha que
     * acabou de sumir.
     */
    const iArquivos = conta.indexOf("apagarPastaDoDono(BALDE_EXAMES, uid)");
    const iDelete = conta.indexOf("auth.admin.deleteUser(uid)");
    expect(iArquivos).toBeGreaterThan(-1);
    expect(iDelete).toBeGreaterThan(iArquivos);
  });

  test("a varredura não pode DERRUBAR a exclusão da conta", () => {
    /* Negar a exclusão por causa de um órfão seria um problema de LGPD maior
       que o órfão. */
    const i = mod.indexOf("export async function apagarPastaDoDono");
    const corpo = mod.slice(i);
    expect(corpo).toContain("try {");
    expect(corpo).toContain("catch {");
  });

  test("e pagina, para não parar no meio de quem tem muitos arquivos", () => {
    /* O Storage lista com teto. Sem o laço, quem tem mais de 100 arquivos ficava
       com o resto no balde — o mesmo defeito, só que mais difícil de ver. */
    const i = mod.indexOf("export async function apagarPastaDoDono");
    const corpo = mod.slice(i);
    expect(corpo).toContain("for (;;)");
    expect(corpo).toContain("if (arquivos.length < 100) return;");
  });
});

describe("8. o script de migração não gira, não exclui e respeita o recorte", () => {
  /**
   * Três defeitos achados por revisão adversarial, todos no comando que o DONO
   * vai rodar à mão contra o banco de produção.
   */
  const script = readFileSync("scripts/migrar-imagens.mjs", "utf8");

  test("`subir` para quando uma página não traz nada NOVO", () => {
    /**
     * O laço relê sempre o mesmo filtro. Uma linha não atualizada volta na
     * página seguinte — e com falha sistêmica (balde ainda não criado, que é
     * justamente o cenário que o desenho de recuo existe para cobrir) o script
     * girava para sempre nas mesmas 25 linhas, imprimindo erro sem avançar.
     */
    const i = script.indexOf("async function subir");
    const corpo = script.slice(i, script.indexOf("async function limpar"));
    /**
     * CURSOR, e não um conjunto de já-tentados.
     *
     * A primeira tentativa guardava os ids tentados e parava quando a página
     * não trazia nada novo. A revisão adversarial mostrou que isso trocou um
     * defeito por outro: PDFs nunca são marcados, então voltam sempre — e
     * bastavam 25 deles (um lote) para a PRIMEIRA página ser toda de PDF. A
     * segunda repetia os mesmos 25, a conta dava zero, e o script encerrava
     * ANUNCIANDO QUE TERMINOU sem nunca ter chegado às imagens seguintes.
     *
     * Um cursor crescente por `id` avança de verdade: o que foi pulado fica
     * para trás e não bloqueia o resto.
     */
    expect(corpo).toContain('.gt("id", cursor)');
    expect(corpo).toContain('.order("id", { ascending: true })');
    expect(corpo).toContain("cursor = linhas[linhas.length - 1].id;");
    /* E o mecanismo antigo não pode voltar junto. */
    expect(corpo).not.toContain("const tentados = new Set();");
  });

  test("e NÃO marca a linha que não soube converter", () => {
    /**
     * A versão anterior gravava `image_path: ""` para tirar a linha do filtro —
     * o que a excluía da migração para SEMPRE. O caso mais comum é o laudo em
     * PDF: aceito de propósito pelo produto, entregue assim por todo
     * laboratório, e o arquivo mais pesado da tabela (~4 MB). Ou seja,
     * justamente o alvo principal da economia de disco era o que ficava de
     * fora, permanentemente.
     */
    /* Sem comentários: a explicação do conserto CITA `image_path: ""` para
       dizer o que era feito antes, e a asserção casava com o próprio texto. */
    const semCom = script.replace(/\/\*[\s\S]*?\*\//g, "");
    const i = semCom.indexOf("async function subir");
    const corpo = semCom.slice(i, semCom.indexOf("async function limpar"));
    expect(corpo).not.toContain('image_path: ""');
    expect(corpo).toContain("pulados++");
  });

  test("`limpar` respeita `--tabela`", () => {
    /**
     * A flag era aceita e VALIDADA na entrada, respeitada por `subir`, e
     * ignorada no ÚNICO comando que apaga. Quem migrou só `exam_files` e
     * rodasse `limpar --tabela=exam_files --confirmar` acreditando estar
     * restrito disparava também a limpeza do álbum.
     */
    expect(script).toContain("async function limpar(confirmar, sóTabela)");
    expect(script).toContain("await limpar(confirmar, sóTabela)");
    const i = script.indexOf("async function limpar");
    expect(script.slice(i, i + 700)).toContain("if (sóTabela && tabela !== sóTabela) continue;");
  });
});

describe("9. o caminho no balde NÃO carrega o uuid da paciente", () => {
  /**
   * ─── O VAZAMENTO QUE A REVISÃO COMPLETA ACHOU ─────────────────────────────
   *
   * A primeira versão usava `${uuid de auth.users}/arquivo.jpg`. O caminho entra
   * na URL ASSINADA, e a URL assinada da foto do álbum vai para a tag `<img>`
   * de `/album/<token>` — ou seja, para o grupo da família inteiro: no DOM, no
   * painel de rede, no histórico, em qualquer print.
   *
   * Isso desfazia, por outro caminho, uma correção escrita a duas telas dali:
   * `getAlbumByToken` teve o `select("*")` trocado por colunas nomeadas
   * exatamente para não entregar `patient_user_id` a quem tem o link, e o tipo
   * `AlbumPostPublico = Omit<AlbumPost, "patient_user_id">` existe para isso.
   *
   * A migração reabriu o buraco pelo campo que ninguém estava olhando.
   */
  const mod = semComentarios("src/lib/imagens.server.ts");
  const script = readFileSync("scripts/migrar-imagens.mjs", "utf8");

  test("a pasta é derivada, não o uuid cru", () => {
    expect(mod).toContain("export function pastaDoDono(donoId: string): string {");
    expect(mod).toContain('crypto.createHash("sha256").update(donoId).digest("hex").slice(0, 32)');
  });

  test("e TODO caminho passa por ela — upload, listagem e exclusão", () => {
    expect(mod).toContain("`${pastaDoDono(opts.donoId)}/${crypto.randomUUID()}");
    expect(mod).toContain(".list(pastaDoDono(donoId), { limit: 100 })");
    expect(mod).toContain("`${pastaDoDono(donoId)}/${a.name}`");
    /* Nenhum resquício do uuid cru montando caminho. */
    expect(mod).not.toContain("`${opts.donoId}/");
    expect(mod).not.toContain("`${donoId}/");
  });

  test("o backfill deriva IGUAL — senão a varredura da LGPD não acha nada", () => {
    /**
     * `apagarPastaDoDono` procura pela pasta derivada. Se o script gravasse com
     * o uuid cru, os arquivos migrados ficariam fora do alcance da exclusão de
     * conta — o defeito de LGPD de volta, só que mais difícil de ver.
     */
    expect(script).toContain('createHash("sha256").update(String(id)).digest("hex").slice(0, 32)');
    expect(script).toContain("${pastaDoDono(linha[cfg.dono])}/");
  });
});
