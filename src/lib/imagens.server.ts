import crypto from "node:crypto";
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
/** As fotos e os vídeos das publicações e dos stories. */
export const BALDE_REDE = "rede";
/** As fotos trocadas no direct. */
export const BALDE_CONVERSAS = "conversas";

/** Vida da URL assinada. Uma hora cobre a sessão em que ele abre o laudo, e
    expira antes de virar link compartilhável por engano. */
const VALIDADE_SEGUNDOS = 3600;

/**
 * A PASTA DE CADA PESSOA — derivada, não o uuid cru.
 *
 * ─── O VAZAMENTO QUE ISTO FECHA ─────────────────────────────────────────────
 *
 * A primeira versão usava `${uuid de auth.users}/arquivo.jpg`. O caminho entra
 * na URL ASSINADA, e a URL assinada da foto do álbum vai para a tag `<img>` de
 * `/album/<token>` — ou seja, para o grupo da família inteiro, no DOM, no painel
 * de rede, no histórico e em qualquer print.
 *
 * Isso desfazia, por outro caminho, uma correção que está escrita a duas telas
 * daqui: `getAlbumByToken` teve o `select("*")` trocado por colunas nomeadas
 * exatamente para NÃO entregar `patient_user_id` a quem tem o link. O tipo
 * `AlbumPostPublico = Omit<AlbumPost, "patient_user_id">` existe para isso. A
 * migração de imagens reabriu o buraco pelo campo que ninguém estava olhando.
 *
 * ─── POR QUE SHA-256 E NÃO UM SEGREDO ───────────────────────────────────────
 *
 * O que se quer aqui é uma coisa só: que o caminho não REVELE o uuid. Um hash
 * determinístico resolve — e por ser determinístico, `apagarPastaDoDono` (a
 * varredura da LGPD) continua sabendo onde procurar a partir do uid, sem
 * guardar mapa nenhum e sem depender de mais um segredo em produção.
 *
 * Vale para os DOIS baldes, de propósito. O de exames só é servido a quem já
 * conhece o uuid dela, mas uma regra sem exceção é uma regra que não se erra —
 * e a exceção teria de ser lembrada por quem criar o terceiro balde.
 */
export function pastaDoDono(donoId: string): string {
  return crypto.createHash("sha256").update(donoId).digest("hex").slice(0, 32);
}

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
    const caminho = `${pastaDoDono(opts.donoId)}/${crypto.randomUUID()}.${img.extensao}`;
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
export async function apagarPastaDoDono(
  balde: string,
  donoId: string,
  /**
   * ⚠️ **DUAS CONVENÇÕES DE PASTA CONVIVEM NO PROJETO, e ignorar isso deixa
   * metade dos arquivos no disco.**
   *
   * `guardarImagem` põe tudo em `pastaDoDono` (sha256 do uuid) — é assim nos
   * baldes `exames`, `album` e nas FOTOS de publicação. Mas o VÍDEO do post e a
   * FOTO da conversa sobem por URL assinada, e ali a pasta é o **uuid cru**
   * (`${eu}/…`), porque quem monta o caminho é o handler do upload e não o
   * `guardarImagem`.
   *
   * Varrer só uma das duas apagaria as fotos e deixaria os vídeos — ou o
   * contrário. Por isso a pasta é um PARÂMETRO, e `apagarTudoDoDono` chama as
   * duas.
   */
  pasta: string = pastaDoDono(donoId),
): Promise<void> {
  if (!donoId?.trim()) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* O Storage não apaga pasta: só objeto. Lista e remove em lote. O `limit`
       alto cobre com folga o que uma pessoa acumula — e o laço continua
       enquanto vier página cheia, para não parar no meio de quem tem muitos. */
    for (;;) {
      const { data: arquivos, error } = await supabaseAdmin.storage
        .from(balde)
        .list(pasta, { limit: 100 });
      if (error || !arquivos?.length) return;
      const caminhos = arquivos.map((a) => `${pasta}/${a.name}`);
      const { error: eDel } = await supabaseAdmin.storage.from(balde).remove(caminhos);
      if (eDel) return;
      if (arquivos.length < 100) return;
    }
  } catch {
    /* ver o comentário acima */
  }
}

/**
 * RENOVA UMA URL ASSINADA QUE FOI GUARDADA NUMA COLUNA.
 *
 * ⚠️ **`avatar_url` guarda a URL, e URL assinada VENCE.** O avatar da rede era
 * assinado por sete dias e gravado na coluna, com um comentário dizendo "a
 * próxima leitura renova" — e nada renovava: `perfisPorId` lê a coluna e
 * repassa. No oitavo dia a foto de perfil de toda paciente passa a responder
 * 403, e não só na Comunidade: `minhasAmigas` lê a MESMA coluna, então a aba
 * Amigas quebra junto. Um defeito de app inteiro, com data marcada, invisível
 * em teste e em bancada.
 *
 * Aqui a promessa vira código. Recebe o que estiver na coluna e devolve algo
 * que carrega hoje:
 *
 *  · **data URL** (o que `campo-foto.tsx` e o ritual de boas-vindas gravam) —
 *    volta igual, não há o que assinar;
 *  · **URL assinada nossa** — o caminho do objeto está DENTRO dela
 *    (`/object/sign/<balde>/<caminho>?token=…`), então dá para assinar de novo
 *    sem coluna nova e sem migração;
 *  · **qualquer outra coisa** (link externo, `null`) — volta igual.
 *
 * ⚠️ E falhar ao renovar devolve a URL ANTIGA, nunca `null`: uma URL vencida
 * ainda pode estar dentro da validade no cache do navegador dela, e trocar uma
 * foto talvez-quebrada por um vazio garantido é piorar.
 */
export async function renovarUrlAssinada(
  guardada: string | null | undefined,
  segundos = VALIDADE_SEGUNDOS,
): Promise<string | null> {
  if (!guardada) return null;
  if (guardada.startsWith("data:")) return guardada;
  const m = guardada.match(/\/object\/sign\/([^/]+)\/([^?]+)/);
  if (!m) return guardada;
  const balde = decodeURIComponent(m[1]);
  const caminho = decodeURIComponent(m[2]);
  return (await urlAssinada(balde, caminho, segundos)) ?? guardada;
}

/* ══════════════════════════════════════════════════════════════════════════
   O LOTE — e por que assinar uma por uma custava segundos
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * QUANTO TEMPO SOBRANDO FAZ UMA URL VALER A PENA REAPROVEITAR.
 *
 * ⚠️ **A maior parte das assinaturas era desperdício puro.** `salvarPerfilSocial`
 * grava o avatar com SETE DIAS de validade, e `perfisPorId` re-assinava a URL a
 * cada leitura — feed, busca, stories, atividade, salvos, lista de amigas. Uma
 * URL com seis dias de vida pela frente era jogada fora e refeita, ao custo de
 * uma ida à rede, para produzir outra idêntica em efeito.
 *
 * Com doze horas de margem, o caso comum passa a custar ZERO requisições: só
 * quem está de fato perto de vencer é renovado.
 */
export const MARGEM_DE_RENOVACAO_SEG = 12 * 3600;

/**
 * A VALIDADE DO AVATAR — sete dias, a MESMA com que ele é gravado.
 *
 * ⚠️ **RENOVAR COM UMA HORA ERA UM DEFEITO, e ele se realimentava.**
 * `salvarPerfilSocial` grava a URL do avatar com sete dias. A renovação usava a
 * validade PADRÃO deste arquivo (uma hora) e não grava o resultado de volta na
 * coluna — então, a partir do dia em que a URL de sete dias entra na margem de
 * renovação, toda leitura produzia uma URL de UMA HORA, que na leitura seguinte
 * já estava dentro da margem e era renovada de novo. A partir daí, TODA leitura
 * da rede voltava a assinar TODOS os avatares, para sempre: a economia que a
 * margem existe para dar simplesmente parava de existir, com data marcada e sem
 * nada quebrado para avisar.
 *
 * ⚠️ **E há um segundo custo, no NAVEGADOR.** A URL assinada é a chave do cache
 * de imagem: se ela muda a cada leitura, o navegador baixa a mesma foto de novo
 * em toda abertura de tela. Uma validade longa e estável é o que faz a segunda
 * visita ser instantânea.
 */
export const VALIDADE_AVATAR_SEG = 7 * 24 * 3600;

/**
 * Quando esta URL assinada vence, em segundos-época — ou `null`.
 *
 * O token de uma URL assinada do Storage é um JWT cujo payload traz `exp`.
 * ⚠️ **Isto NÃO é verificação de assinatura, e não pode virar uma.** O `exp` é
 * lido só para decidir "vale a pena renovar?"; quem valida o token é o Storage,
 * do outro lado. Ler sem verificar aqui é seguro porque a resposta errada custa
 * no máximo uma renovação a mais — nunca acesso a nada.
 *
 * ⚠️ **Não decifrou vale RENOVAR** (devolve `null`, e quem chama re-assina): o
 * lado seguro é a foto que carrega, nunca a requisição economizada.
 */
export function expiraEmSegundos(assinada: string): number | null {
  try {
    const token = new URL(assinada, "https://x.invalid").searchParams.get("token");
    if (!token) return null;
    const corpo = token.split(".")[1];
    if (!corpo) return null;
    const json = Buffer.from(corpo.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const exp = (JSON.parse(json) as { exp?: unknown })?.exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/** Ainda dura o bastante para ser reaproveitada? */
function aindaServe(assinada: string, agoraSeg: number): boolean {
  const exp = expiraEmSegundos(assinada);
  return exp !== null && exp - agoraSeg > MARGEM_DE_RENOVACAO_SEG;
}

/**
 * ASSINA UM LOTE DE CAMINHOS DO MESMO BALDE — numa requisição só.
 *
 * ⚠️ **`createSignedUrl` (singular) é uma ida à rede POR ARQUIVO**, e é isso que
 * fazia abrir um perfil demorar. Uma tela de perfil com doze publicações de até
 * cinco fotos chega a sessenta assinaturas; um feed de vinte autores soma o
 * avatar de cada um. `createSignedUrls` (PLURAL) manda todos os caminhos num
 * `POST` só.
 *
 * ⚠️ **A resposta é casada por CAMINHO, nunca por índice.** A API devolve o
 * `path` de volta em cada item, e depender da ordem seria a classe de defeito
 * que silenciosamente entrega a foto de uma paciente no lugar da de outra.
 * O índice entra só como recuo, quando o `path` volta nulo.
 */
export async function urlsAssinadas(
  balde: string,
  caminhos: string[],
  segundos = VALIDADE_SEGUNDOS,
): Promise<Map<string, string>> {
  const saida = new Map<string, string>();
  const unicos = [...new Set(caminhos.filter(Boolean))];
  if (unicos.length === 0) return saida;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage
      .from(balde)
      .createSignedUrls(unicos, segundos);
    if (error || !data) return saida;
    data.forEach((item, i) => {
      const caminho = item?.path ?? unicos[i];
      if (caminho && item?.signedUrl) saida.set(caminho, item.signedUrl);
    });
    return saida;
  } catch {
    return saida;
  }
}

/**
 * RENOVA UM LOTE DE URLs GUARDADAS EM COLUNA — a versão em lote de
 * `renovarUrlAssinada`, com as mesmas regras e sem o custo por item.
 *
 * Três economias, nesta ordem:
 *
 *  1. **data URL, link externo e `null` não custam nada** — passam intactos, como
 *     na versão singular (é o que preserva quem gravou pelo `campo-foto`);
 *  2. **URL que ainda dura mais que `MARGEM_DE_RENOVACAO_SEG` é reaproveitada** —
 *     e este é o caso comum, porque o avatar é assinado por sete dias;
 *  3. **o que sobrou é assinado em LOTE**, uma requisição por balde.
 *
 * ⚠️ **A ORDEM DA SAÍDA É A DA ENTRADA.** Quem chama casa por índice
 * (`linhas.map`), e devolver fora de ordem trocaria o rosto de uma paciente pelo
 * de outra — o defeito mais grave que este arquivo poderia produzir.
 *
 * ⚠️ **Falha devolve o valor ANTIGO, nunca `null`** — a mesma decisão da versão
 * singular: uma URL talvez-vencida ainda pode estar no cache do navegador dela,
 * e trocá-la por um vazio garantido é piorar.
 */
export async function renovarUrlsAssinadas(
  guardadas: (string | null | undefined)[],
  segundos = VALIDADE_SEGUNDOS,
): Promise<(string | null)[]> {
  const agoraSeg = Math.floor(Date.now() / 1000);
  /* Por balde, os caminhos que de fato precisam de assinatura nova. */
  const pedidos = new Map<string, Set<string>>();
  /* Por índice, onde procurar o resultado depois. */
  const ondeBuscar: ({ balde: string; caminho: string } | null)[] = guardadas.map((g) => {
    if (!g || g.startsWith("data:")) return null;
    const m = g.match(/\/object\/sign\/([^/]+)\/([^?]+)/);
    if (!m) return null;
    if (aindaServe(g, agoraSeg)) return null;
    const balde = decodeURIComponent(m[1]);
    const caminho = decodeURIComponent(m[2]);
    if (!pedidos.has(balde)) pedidos.set(balde, new Set());
    pedidos.get(balde)!.add(caminho);
    return { balde, caminho };
  });

  if (pedidos.size === 0) return guardadas.map((g) => g ?? null);

  const assinadas = new Map<string, Map<string, string>>();
  await Promise.all(
    [...pedidos.entries()].map(async ([balde, caminhos]) => {
      assinadas.set(balde, await urlsAssinadas(balde, [...caminhos], segundos));
    }),
  );

  return guardadas.map((g, i) => {
    const alvo = ondeBuscar[i];
    if (!alvo) return g ?? null;
    return assinadas.get(alvo.balde)?.get(alvo.caminho) ?? g ?? null;
  });
}

/**
 * ⚠️ **APAGA TUDO O QUE É DELA NUM BALDE, nas DUAS convenções de pasta.**
 *
 * É o que a exclusão de conta chama. Ver `apagarPastaDoDono` para o porquê de
 * serem duas — e o porquê de varrer só uma ser pior que não varrer nenhuma:
 * o produto diria "apagamos" com metade dos arquivos ainda no disco.
 */
export async function apagarTudoDoDono(balde: string, donoId: string): Promise<void> {
  if (!donoId?.trim()) return;
  await apagarPastaDoDono(balde, donoId, pastaDoDono(donoId));
  /* A pasta crua só existe nos baldes que sobem por URL assinada; nos outros a
     varredura simplesmente não acha nada, e custa uma listagem vazia. */
  await apagarPastaDoDono(balde, donoId, donoId);
}
