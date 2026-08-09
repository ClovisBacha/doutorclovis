/**
 * AS IMAGENS SAEM DO POSTGRES SEM PERDER NENHUMA.
 *
 * ─── O QUE ESTÁ EM JOGO ─────────────────────────────────────────────────────
 *
 * O conteúdo é laudo de exame de gestante e foto de álbum de família. Uma
 * migração de armazenamento mal feita aqui não "degrada a performance": perde
 * o laudo que a paciente fotografou às onze da noite, e não há desfazer.
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
    for (const arq of ["src/lib/family.functions.ts", "src/lib/exame-do-chat.functions.ts"]) {
      expect(semComentarios(arq)).toContain("await gravarLinhaComImagem({");
    }
    /* E a leitura do laudo, do outro lado. */
    expect(semComentarios("src/lib/clinical.functions.ts")).toContain("await lerComCaminho<{");
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
       42703 e derruba tudo. O médico não veria laudo nenhum — nem os que estão
       em base64 e sempre funcionaram. */
    const i = mod.indexOf("export async function lerComCaminho");
    const corpo = mod.slice(i, i + 900);
    expect(corpo).toContain("if (!colunaAusente(primeira.error)) return primeira;");
    expect(corpo).toContain("aplicarFiltros(sb.from(tabela).select(colunas))");
  });

  test("o exame ainda é gravado quando o Storage não responde", () => {
    /* A asserção que descreve o pior caso: `guardarImagem` devolveu null e o
       insert continua acontecendo, com base64. Nenhum `if (!caminho) return`. */
    const exame = semComentarios("src/lib/exame-do-chat.functions.ts");
    const i = exame.indexOf("guardarImagem");
    const ate = exame.indexOf("if (error) return", i);
    expect(ate).toBeGreaterThan(i);
    expect(exame.slice(i, ate)).not.toMatch(/if \(!caminho\)\s*return/);
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

describe("4. laudo de exame não vaza pela URL assinada", () => {
  const clinical = semComentarios("src/lib/clinical.functions.ts");

  test("a URL só é gerada DEPOIS da checagem de vínculo", () => {
    /**
     * Uma URL assinada vale uma hora e sobrevive ao "não" que a função
     * devolve. Assiná-la antes de checar o vínculo criaria um link válido para
     * o laudo de uma paciente que não é dele — e o `return {ok:false}` depois
     * não desfaz nada, porque o link já existe.
     */
    const iVinculo = clinical.indexOf("pacientesAtuais(user.id)");
    expect(iVinculo).toBeGreaterThan(-1);
    /**
     * A PRIMEIRA assinatura do arquivo, não "alguma depois do vínculo".
     * Procurar a partir do índice do vínculo era uma asserção que não podia
     * falhar: inserir uma assinatura ANTES deixava a de depois no lugar, e o
     * mutante sobrevivia com o vazamento instalado.
     */
    const iAssina = clinical.indexOf("imagemDaLinha(");
    expect(iAssina).toBeGreaterThan(iVinculo);
    /**
     * E o MÓDULO inteiro só é tocado depois. Cobrar o nome da função deixava
     * escapar quem a importasse com outro nome — foi o que um mutante fez para
     * sobreviver. Nenhuma linha desta função tem motivo para falar com o
     * Storage antes de saber se a paciente é dele.
     */
    const iImport = clinical.indexOf("imagens.server");
    expect(iImport).toBeGreaterThan(iVinculo);
  });

  test("e depois da trilha de auditoria", () => {
    const iTrilha = clinical.indexOf('trilha(user, "exame.imagem"');
    const iAssina = clinical.indexOf("imagemDaLinha(BALDE_EXAMES", iTrilha);
    expect(iTrilha).toBeGreaterThan(-1);
    expect(iAssina).toBeGreaterThan(iTrilha);
  });
});

describe("5. apagar a linha apaga o arquivo", () => {
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

describe("6. os baldes são privados, e o SQL diz por quê", () => {
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

describe("7. o backfill é seguro por construção", () => {
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
