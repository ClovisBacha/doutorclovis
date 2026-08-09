/**
 * IMAGENS FORA DO POSTGRES.
 *
 * ─── O QUE ESTAVA ACONTECENDO ───────────────────────────────────────────────
 *
 * Foto do álbum da família e laudo de exame eram gravados como base64 numa
 * coluna TEXT — `family_album_posts.image_data` e `exam_files.image_data`.
 *
 * Três contas que isso quebra:
 *
 *  · **Tamanho.** base64 infla o binário em ~33%. Um JPEG de 200 KB ocupa 266 KB
 *    de linha. Mil pacientes mandando um exame por semana enchem os 8 GB do
 *    plano Pro em pouco mais de um ano — e disco de banco custa US$ 0,125/GB
 *    contra US$ 0,021/GB de Storage: seis vezes mais caro pelo mesmo byte.
 *  · **Backup.** O dump do Postgres carrega as imagens junto. Todo backup fica
 *    seis vezes maior, e restaurar passa a ser uma operação de horas.
 *  · **Leitura.** `select` que toque a coluna traz o arquivo inteiro pela
 *    rede. `clinical.functions.ts` já tinha um comentário avisando disso e
 *    excluindo `image_data` da listagem à mão — o sintoma sendo tratado
 *    enquanto a causa ficava.
 *
 * ─── POR QUE OS BALDES SÃO PRIVADOS E SEM NENHUMA POLICY ────────────────────
 *
 * Toda escrita e toda leitura de imagem neste produto passa pelo SERVIDOR, com
 * a chave de serviço (`supabaseAdmin`), que ignora RLS. O navegador nunca fala
 * com o Storage.
 *
 * Então o desenho mais seguro é o mais simples: baldes privados, ZERO policies.
 * Sem policy não há policy mal escrita — e laudo de exame exposto por uma
 * cláusula errada é o pior acidente possível neste produto. O acesso continua
 * sendo decidido onde já era: nas funções que checam o vínculo médico-paciente
 * e escrevem na trilha de auditoria.
 *
 * A tela recebe uma URL ASSINADA de vida curta, gerada a cada leitura.
 *
 * ─── E POR QUE A GRAVAÇÃO NUNCA FALHA POR CAUSA DISTO ───────────────────────
 *
 * O banco de produção está atrás do repositório — é assim há meses e está
 * escrito no CLAUDE.md. Se este código subir antes de o balde existir, um
 * upload que estourasse levaria junto o exame da paciente.
 *
 * Por isso `guardarImagem` NUNCA lança e nunca é obrigatória: quando o Storage
 * não responde, ela devolve `null` e quem chamou grava o base64 como sempre
 * gravou. O produto continua igual; só deixa de economizar. Quando o balde
 * aparece, a economia começa sozinha, sem novo deploy.
 */

/** Os dois baldes. Nomes curtos porque entram no caminho de todo arquivo. */
export const BALDE_ALBUM = "album";
export const BALDE_EXAMES = "exames";

/** Vida da URL assinada. Uma hora cobre a sessão em que ele abre o laudo, e
    expira antes de virar link compartilhável por engano. */
const VALIDADE_SEGUNDOS = 3600;

type Decodificada = { bytes: Uint8Array; tipo: string; extensao: string };

/**
 * Quebra uma data URL (`data:image/jpeg;base64,...`) em bytes.
 *
 * Devolve `null` para qualquer coisa que não seja isso — inclusive para uma
 * URL http, que é o que uma linha JÁ MIGRADA carrega. Sem essa recusa, migrar
 * duas vezes gravaria a string "https://..." dentro de um arquivo .jpg.
 */
export function decodificarDataUrl(dataUrl: string): Decodificada | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!m) return null;
  const tipo = m[1].toLowerCase();
  try {
    const bin = Buffer.from(m[2], "base64");
    /* Um base64 inválido não estoura no Buffer — ele devolve o que conseguiu
       ler, às vezes zero byte. Gravar zero byte cria um arquivo que a tela
       exibe como imagem quebrada, e aí a foto original já foi descartada. */
    if (bin.length === 0) return null;
    const extensao =
      tipo === "image/png"
        ? "png"
        : tipo === "image/webp"
          ? "webp"
          : tipo === "image/gif"
            ? "gif"
            : "jpg";
    return { bytes: new Uint8Array(bin), tipo, extensao };
  } catch {
    return null;
  }
}

/**
 * Sobe a imagem e devolve o CAMINHO dentro do balde — ou `null` se não deu.
 *
 * `null` não é erro a tratar: é a instrução para gravar base64 como antes.
 */
export async function guardarImagem(opts: {
  balde: string;
  /** Pasta do dono. Sempre o uuid de `auth.users`, para o caminho já dizer de
      quem é o arquivo mesmo olhando só o Storage. */
  donoId: string;
  dataUrl: string | null | undefined;
}): Promise<string | null> {
  if (!opts.dataUrl) return null;
  const img = decodificarDataUrl(opts.dataUrl);
  if (!img) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* `crypto.randomUUID` e não o id da linha: a linha ainda não existe na
       hora do upload, e um nome adivinhável somado a um balde mal configurado
       no futuro seria a diferença entre privado e enumerável. */
    const caminho = `${opts.donoId}/${crypto.randomUUID()}.${img.extensao}`;
    const { error } = await supabaseAdmin.storage
      .from(opts.balde)
      .upload(caminho, img.bytes, { contentType: img.tipo, upsert: false });
    if (error) return null;
    return caminho;
  } catch {
    return null;
  }
}

/**
 * Grava a linha com a imagem — e sobrevive ao banco que ainda não tem a coluna.
 *
 * ─── O DEFEITO QUE ISTO EVITA, E QUE JÁ ESTEVE NO AR ────────────────────────
 *
 * `guardarImagem` já recuava quando o BALDE não existia. Faltava o outro lado:
 * a COLUNA. E aí o desenho "seguro" tinha um buraco no meio.
 *
 * O PostgREST não ignora uma coluna desconhecida no payload — ele recusa o
 * INSERT inteiro com PGRST204. Como `image_path` nasce num APLICAR que o banco
 * de produção ainda não viu, mandar a coluna junto não deixava de economizar
 * disco: **não gravava o exame da paciente**. Ela fotografa o laudo às onze da
 * noite, a tela diz que falhou, e não há nada em lugar nenhum.
 *
 * O mesmo vale para a leitura (42703), tratada em `lerComCaminho`.
 *
 * O recuo devolve o base64 para `image_data` — senão a linha entraria sem
 * imagem alguma — e apaga o arquivo que subiu, que sem referência seria órfão
 * puro, pago e invisível.
 */
export async function gravarLinhaComImagem(opts: {
  tabela: string;
  balde: string;
  donoId: string;
  dataUrl: string | null | undefined;
  /** Os outros campos da linha, sem nada de imagem. */
  resto: Record<string, unknown>;
}): Promise<{ error: { message?: string } | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const caminho = await guardarImagem({
    balde: opts.balde,
    donoId: opts.donoId,
    dataUrl: opts.dataUrl,
  });

  const { error } = await sb.from(opts.tabela).insert({
    ...opts.resto,
    /* Uma coisa OU outra: gravar as duas manteria o peso que esta mudança
       existe para tirar. */
    image_data: caminho ? null : (opts.dataUrl ?? null),
    image_path: caminho,
  });
  if (!error) return { error: null };

  const { colunaAusente } = await import("./postgrest");
  if (!colunaAusente(error)) return { error };

  /* Banco sem a coluna: volta ao formato antigo, com a imagem inteira. */
  await apagarImagem(opts.balde, caminho);
  const { error: erro2 } = await sb
    .from(opts.tabela)
    .insert({ ...opts.resto, image_data: opts.dataUrl ?? null });
  return { error: erro2 };
}

/**
 * Lê uma linha pedindo `image_path`; se a coluna não existir, lê sem ela.
 *
 * Um `select` que cita coluna ausente volta 42703 e derruba a consulta INTEIRA
 * — o médico não veria laudo nenhum, nem os que estão em base64 e sempre
 * funcionaram. `colunas` deve trazer os campos SEM `image_path`; ele é
 * acrescentado aqui e removido no recuo.
 */
export async function lerComCaminho<T = any>(
  tabela: string,
  colunas: string,
  aplicarFiltros: (q: any) => any,
): Promise<{ data: T | null; error: { message?: string } | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const primeira = await aplicarFiltros(sb.from(tabela).select(`${colunas},image_path`));
  if (!primeira.error) return primeira;
  const { colunaAusente } = await import("./postgrest");
  if (!colunaAusente(primeira.error)) return primeira;
  return await aplicarFiltros(sb.from(tabela).select(colunas));
}

/** URL assinada de vida curta. `null` se o objeto não existe ou o balde não. */
export async function urlAssinada(
  balde: string,
  caminho: string,
  segundos = VALIDADE_SEGUNDOS,
): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage
      .from(balde)
      .createSignedUrl(caminho, segundos);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * O que a tela deve mostrar, dado o par (caminho novo, base64 antigo).
 *
 * A ordem importa e é o coração da convivência: caminho PRIMEIRO. Enquanto o
 * backfill não terminar as duas colunas coexistem, e uma linha já migrada que
 * ainda carregue `image_data` precisa servir o ARQUIVO — não a cópia velha que
 * está para ser apagada.
 *
 * O balde vem por parâmetro em vez de ser deduzido do caminho: "uuid/uuid.jpg"
 * não diz de onde veio, e adivinhar erraria calado. Quem sabe é quem lê.
 *
 * Se a assinatura falhar (balde apagado, chave trocada) e ainda houver base64,
 * mostra a foto velha — melhor que uma imagem quebrada na tela do médico.
 */
export async function imagemDaLinha(
  balde: string,
  linha: { image_path?: string | null; image_data?: string | null },
): Promise<string | null> {
  const caminho = linha.image_path?.trim();
  if (caminho) {
    const url = await urlAssinada(balde, caminho);
    if (url) return url;
  }
  return linha.image_data?.trim() || null;
}

/** Apaga o arquivo de uma linha que foi removida. Best-effort: um órfão no
    balde custa centavos; uma exclusão que estoura impede a paciente de apagar
    a própria foto, o que é problema de LGPD. */
export async function apagarImagem(balde: string, caminho: string | null | undefined) {
  if (!caminho?.trim()) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(balde).remove([caminho.trim()]);
  } catch {
    /* silêncio proposital — ver comentário acima */
  }
}

/**
 * Apaga TUDO o que é de uma pessoa dentro de um balde.
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ──────────────────────────────────────────
 *
 * `excluirMinhaConta` apaga as tabelas da IA à mão e deixa o resto sair pelos
 * `ON DELETE CASCADE` do `deleteUser`. Isso derrubava as LINHAS de `exam_files`
 * e `family_album_posts` — e, enquanto o laudo morava DENTRO da linha, derrubar
 * a linha era derrubar a imagem.
 *
 * Ao mover os bytes para o Storage, essa equivalência se quebrou em silêncio: a
 * linha some, o arquivo fica. A paciente pede a exclusão da conta, o produto
 * responde que apagou, e o laudo dela continua no nosso disco — o que torna a
 * LGPD inexequível pelo caminho que a própria migração criou.
 *
 * Achado por revisão adversarial do diff, e é a segunda vez que a migração de
 * imagens deixa uma ponta assim: a primeira foi a paciente perder o acesso ao
 * próprio exame.
 *
 * Best-effort de propósito: se o Storage não responder, a exclusão da CONTA não
 * pode parar por causa disso — negar a exclusão seria um problema de LGPD
 * maior que o órfão. O que fica é registro, para dar para varrer depois.
 */
export async function apagarPastaDoDono(balde: string, donoId: string): Promise<void> {
  if (!donoId?.trim()) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* O Storage não apaga pasta: só objeto. Lista e remove em lote. O `limit`
       alto cobre com folga o que uma pessoa acumula — e o laço continua
       enquanto vier página cheia, para não parar no meio de quem tem muitos. */
    for (;;) {
      const { data: arquivos, error } = await supabaseAdmin.storage
        .from(balde)
        .list(donoId, { limit: 100 });
      if (error || !arquivos?.length) return;
      const caminhos = arquivos.map((a) => `${donoId}/${a.name}`);
      const { error: eDel } = await supabaseAdmin.storage.from(balde).remove(caminhos);
      if (eDel) return;
      if (arquivos.length < 100) return;
    }
  } catch {
    /* ver o comentário acima */
  }
}
