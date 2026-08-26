/**
 * A MENSAGEM DIRETA — servidor.
 *
 * A régua (quem pode escrever para quem, e quantas vezes) mora em `conversa.ts`,
 * pura e testada. Aqui ela vira lei.
 *
 * ⚠️ **NADA AQUI CONFIA NO CLIENTE.** `conversaId` e `alvoId` vêm do corpo do
 * pedido; toda leitura e toda escrita conferem que quem pergunta é uma das duas
 * pontas. Sem isso, um uuid montado à mão leria a conversa privada de duas
 * pacientes — e conversa é o dado mais íntimo desta aba.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { alcancaOPerfil } from "./selo-do-perfil";
import {
  LIMITE_DA_MENSAGEM,
  MENSAGENS_POR_DIA,
  MENSAGENS_POR_PAGINA,
  colunaDoOutro,
  foiLidaPeloOutro,
  fotoEhDeQuemMandou,
  minhaColuna,
  minhaColunaDeLeitura,
  parOrdenado,
  podeEnviar,
  podeIniciarConversa,
  previaDaMensagem,
  temNaoLida,
  textoDaCitacao,
  alvoDaCitacao,
  reacaoDeMensagemConhecida,
  TAMANHO_DA_NOTA,
  AUDIO_SEGUNDOS_MAX,
} from "./conversa";

export type ConversaNaTela = {
  id: string;
  /** A outra ponta. */
  comId: string;
  comNome: string;
  comAvatar: string | null;
  previa: string;
  ultimaEm: string | null;
  naoLida: boolean;
  /** `true` = ainda é pedido, esperando ela aceitar. */
  pedido: boolean;
  /** Fui eu quem puxou conversa. Decide o texto da tela do pedido. */
  euIniciei: boolean;
  /**
   * Fixada no topo POR MIM. `null` = não fixada.
   *
   * ⚠️ É a MINHA coluna: fixar é preferência de quem olha a lista, e uma coluna
   * só faria a escolha de uma valer para a outra.
   */
  fixadaEm?: string | null;
};

export type MensagemNaTela = {
  id: string;
  souEu: boolean;
  texto: string | null;
  criadaEm: string;
  apagada: boolean;
  /** A voz, em URL assinada. `null` quando a mensagem não tem áudio. */
  audioUrl?: string | null;
  /** ⚠️ GRAVADA, e não medida na leitura — sem ela a bolha pula ao carregar. */
  duracaoSeg?: number | null;
  /**
   * Recolhida pelo FILTRO DE PALAVRAS dela — a linha existe, o texto não.
   *
   * ⚠️ Vale só para o que a OUTRA escreveu: esconder a própria mensagem seria o
   * app escondendo dela a própria voz.
   */
  recolhida?: boolean;
  /** Já assinada, e só por uma hora. `null` quando a mensagem é só texto. */
  imagemUrl?: string | null;
  /** O que ela anexa, quando nasceu de dentro do app. */
  refTipo?: "post" | "story" | null;
  refId?: string | null;
  /**
   * A outra já leu ESTA mensagem? Ver `foiLidaPeloOutro`.
   *
   * ⚠️ Sempre `false` nas mensagens dela — desenhar ✓✓ do lado de lá seria o
   * app afirmando que EU li, informação que ela não tem como conferir.
   */
  lidaPelaOutra?: boolean;
  /**
   * A mensagem citada, já resolvida — ou `null`.
   *
   * ⚠️ **Resolvida no SERVIDOR, e o texto vem CORTADO.** A citação existe para
   * lembrar QUAL mensagem, não para reler; e mandar o texto inteiro faria a
   * mensagem apagada voltar pela citação de outra.
   */
  citacao?: { id: string; deQuem: "eu" | "ela"; trecho: string } | null;
  /** As reações desta mensagem: o emoji e quantas. */
  reacoes?: { tipo: string; quantas: number }[];
  /** A MINHA reação, ou `null`. */
  minhaReacao?: string | null;
};

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).auth.getUser(accessToken);
  return data?.user?.id ?? null;
}

/**
 * A conversa, conferindo que sou uma das pontas.
 *
 * ⚠️ **DEVOLVE `null` TANTO PARA "NÃO EXISTE" QUANTO PARA "NÃO É MINHA".**
 * Distinguir os dois diria a quem sondasse uuids quais conversas existem no
 * sistema — e a existência de uma conversa entre duas pessoas já é informação
 * sobre elas.
 */
/**
 * A conversa, se ela for MINHA.
 *
 * ⚠️ **Recuo de coluna, e ele é a diferença entre um recurso novo e uma avaria.**
 * Esta função é a porta de TODAS as outras (ler, enviar, silenciar, sair, subir
 * foto). Sem o recuo, um banco sem `silenciada_*`/`saiu_*` faria o `42703`
 * devolver `null` aqui — e o app inteiro responderia "esta conversa não é sua"
 * para as duas donas dela.
 */
async function minhaConversa(sb: any, id: string, eu: string): Promise<any | null> {
  const BASE = "id, a_id, b_id, iniciada_por, aceita, ultima_em, lida_a, lida_b";
  const ler = (colunas: string) =>
    sb.from("rede_conversas").select(colunas).eq("id", id).maybeSingle();

  let { data, error } = await ler(
    `${BASE}, silenciada_a, silenciada_b, saiu_a, saiu_b, fixada_a, fixada_b`,
  );
  /* ⚠️ Um degrau por SQL — ver `minhasConversas`. */
  if (error) ({ data, error } = await ler(`${BASE}, silenciada_a, silenciada_b, saiu_a, saiu_b`));
  if (error) ({ data, error } = await ler(BASE));
  if (error || !data) return null;
  if (data.a_id !== eu && data.b_id !== eu) return null;
  return data;
}

/** Quem, entre estes ids, me segue de verdade. */
async function quemMeSegue(sb: any, eu: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await sb
    .from("rede_seguidores")
    .select("seguidor_id")
    .eq("seguido_id", eu)
    .eq("estado", "ativo")
    .in("seguidor_id", ids);
  /* ⚠️ Falha FECHADA: sem saber quem me segue, a conversa nasce como PEDIDO.
     O pior caso é um toque a mais para aceitar; o inverso seria uma estranha
     entrando direto na caixa principal por causa de um erro de rede. */
  if (error) return new Set();
  return new Set(((data ?? []) as any[]).map((r) => r.seguidor_id));
}

export const minhasConversas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Recuo de coluna, como toda leitura desta aba: `saiu_*`/`silenciada_*`
       nascem num `APLICAR_` que o dono roda à mão, e o deploy chega antes. Sem
       ele, a LISTA DE CONVERSAS inteira sumiria — um recurso que já funcionava,
       apagado por colunas que ninguém sabia que existiam. */
    const lerLista = (colunas: string) =>
      sb
        .from("rede_conversas")
        .select(colunas)
        .or(`a_id.eq.${eu},b_id.eq.${eu}`)
        .order("ultima_em", { ascending: false })
        .limit(100);
    const BASE = "id, a_id, b_id, iniciada_por, aceita, ultima_em, lida_a, lida_b";
    let { data: linhas, error } = await lerLista(
      `${BASE}, silenciada_a, silenciada_b, saiu_a, saiu_b, fixada_a, fixada_b`,
    );
    /* ⚠️ **UM DEGRAU POR SQL.** `fixada_*` nasce no `APLICAR_DIRECT_COMPLETO` e
       `silenciada_*`/`saiu_*` no `APLICAR_CONVERSA_SILENCIAR` — dois arquivos, e
       um recuo de dois passos apagaria o SILENCIAR (que já funciona) por causa
       de uma coluna de fixar. */
    if (error) {
      ({ data: linhas, error } = await lerLista(
        `${BASE}, silenciada_a, silenciada_b, saiu_a, saiu_b`,
      ));
      console.warn("[conversa] sem fixada_* — rode APLICAR_DIRECT_COMPLETO.sql");
    }
    if (error) {
      ({ data: linhas, error } = await lerLista(BASE));
      console.warn("[conversa] sem saiu_*/silenciada_* — rode APLICAR_CONVERSA_SILENCIAR.sql");
    }
    if (error) return { ok: false as const, motivo: "banco" as const };

    const conversas = ((linhas ?? []) as any[]).filter((c) => {
      /* ⚠️ **QUEM SAIU SÓ VOLTA A VER SE A OUTRA ESCREVER DEPOIS.** Filtrar por
         "saiu" apenas esconderia a conversa para sempre — e o gênero inteiro
         faz o contrário: sair é limpar a lista, não bloquear. Quem quer que a
         pessoa não escreva mais tem o bloqueio, com o nome certo. */
      const saiuEm = c[minhaColuna("saiu", eu, c.a_id)];
      if (!saiuEm) return true;
      return new Date(c.ultima_em).getTime() > new Date(saiuEm).getTime();
    });
    if (conversas.length === 0) {
      return { ok: true as const, conversas: [] as ConversaNaTela[], naoLidas: 0 };
    }

    const outros = conversas.map((c) => (c.a_id === eu ? c.b_id : c.a_id));
    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    /* A última mensagem de cada conversa, numa consulta só. */
    const lerUltimas = (colunas: string) =>
      sb
        .from("rede_mensagens")
        .select(colunas)
        .in(
          "conversa_id",
          conversas.map((c) => c.id),
        )
        .order("criada_em", { ascending: false })
        /**
         * ⚠️ **TETO DE LINHAS, e ele não existia.**
         *
         * Esta consulta lia TODAS as mensagens de até 100 conversas para pegar
         * a ÚLTIMA de cada uma. Uma dupla que se escreve todo dia passa de mil
         * mensagens em poucos meses; cem conversas assim são cem mil linhas
         * atravessando a rede a cada abertura da caixa de entrada — e o
         * PostgREST corta em `db-max-rows` sem avisar, então as conversas mais
         * antigas simplesmente perderiam a prévia.
         *
         * ⚠️ **A irmã `mensagensDaConversa` já tinha teto** (`MENSAGENS_POR_PAGINA
         * + 1`, com comentário explicando por que pede uma a mais em vez de
         * contar o total). A assimetria era literal.
         *
         * 100 conversas × 3 mensagens é folga de sobra para achar a última de
         * cada uma, mesmo com várias seguidas na mesma conversa.
         */
        .limit(conversas.length * 3);
    /**
     * ⚠️ **`imagem_path` E `ref_tipo` PRECISAM VIR — e este defeito era MEU.**
     *
     * A prévia da lista caía em `""` para toda mensagem que é SÓ foto ou só
     * anexo: a linha saía com avatar, nome, hora e NADA no meio, e ela não
     * tinha como saber se era defeito ou mensagem vazia.
     *
     * `previaDaMensagem` já sabia responder "📷 Foto" desde o primeiro dia — o
     * parâmetro `carrega` existia, o único chamador de produção não o passava,
     * e a suíte ficava VERDE sobre um ramo que só os testes exercitavam.
     *
     * ⚠️ E com recuo de coluna: sem ele, um banco sem `imagem_path` derrubaria
     * a LISTA DE CONVERSAS inteira — um recurso que já funcionava, apagado por
     * causa de uma prévia.
     */
    /* ⚠️ **UM DEGRAU POR SQL.** `audio_path` nasce no `APLICAR_DIRECT_COMPLETO`
       e `imagem_path` no `APLICAR_CONVERSA_E_COMENTARIOS` — um recuo de dois
       passos apagaria a prévia da FOTO por causa de uma coluna de voz. */
    const comAudio = await lerUltimas(
      "conversa_id, autor_id, texto, criada_em, apagada_em, imagem_path, audio_path, ref_tipo",
    );
    const comCorpo = comAudio.error
      ? await lerUltimas(
          "conversa_id, autor_id, texto, criada_em, apagada_em, imagem_path, ref_tipo",
        )
      : comAudio;
    const msgs = comCorpo.error
      ? (await lerUltimas("conversa_id, autor_id, texto, criada_em, apagada_em")).data
      : comCorpo.data;
    const ultima = new Map<string, any>();
    for (const m of (msgs ?? []) as any[]) {
      if (!ultima.has(m.conversa_id)) ultima.set(m.conversa_id, m);
    }

    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id, display_name, avatar_url")
      .in("id", outros);
    const porId = new Map(((perfis ?? []) as any[]).map((p) => [p.id, p]));

    const { renovarUrlsAssinadas, VALIDADE_AVATAR_SEG } = await import("@/lib/imagens.server");
    const avatares = await renovarUrlsAssinadas(
      outros.map((id) => porId.get(id)?.avatar_url ?? null),
      VALIDADE_AVATAR_SEG,
    );

    const saida: ConversaNaTela[] = [];
    conversas.forEach((c, i) => {
      const outro = c.a_id === eu ? c.b_id : c.a_id;
      /* ⚠️ BLOQUEIO SOME DA LISTA, dos dois lados e em silêncio — a mesma
         decisão do feed. Uma conversa que continua visível depois do bloqueio
         é a pessoa bloqueada ainda ocupando espaço na tela dela. */
      if (ctx.bloqueio.has(outro)) return;
      const m = ultima.get(c.id);
      const p = porId.get(outro);
      saida.push({
        id: c.id,
        comId: outro,
        comNome: ((p?.display_name ?? "") as string).trim() || "Alguém",
        comAvatar: avatares[i] ?? null,
        previa: previaDaMensagem(m?.texto ?? null, !!m?.apagada_em, undefined, {
          imagem: !!m?.imagem_path,
          audio: !!m?.audio_path,
          ref: (m?.ref_tipo ?? null) as "post" | "story" | null,
        }),
        ultimaEm: c.ultima_em ?? null,
        naoLida: temNaoLida({
          ultimaEm: c.ultima_em ?? null,
          minhaLeitura: (c[minhaColunaDeLeitura(eu, c.a_id)] as string | null) ?? null,
          ultimoAutor: m?.autor_id ?? null,
          euId: eu,
        }),
        /* ⚠️ A MINHA coluna, por `minhaColuna` — a dela não é da minha conta, e
           invertida a lista mostraria no topo o que a OUTRA fixou. */
        fixadaEm: ((c as any)[minhaColuna("fixada", eu, c.a_id)] ?? null) as string | null,
        pedido: !c.aceita,
        euIniciei: c.iniciada_por === eu,
      });
    });

    /* ⚠️ O emblema conta só o que EU preciso responder: pedido que EU mandei
       não é novidade minha, é espera. */
    const naoLidas = saida.filter((c) => c.naoLida && !(c.pedido && c.euIniciei)).length;
    return { ok: true as const, conversas: saida, naoLidas };
  });

export const abrirConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), alvoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    const { data: alvo, error: erroAlvo } = await sb
      .from("patient_profiles")
      .select("id, perfil_publico")
      .eq("id", data.alvoId)
      .maybeSingle();
    if (erroAlvo) return { ok: false as const, motivo: "banco" as const };

    const meSegue = await quemMeSegue(sb, eu, [data.alvoId]);
    const veredito = podeIniciarConversa({
      euId: eu,
      alvoId: data.alvoId,
      temBloqueio: ctx.bloqueio.has(data.alvoId),
      /* ⚠️ A MESMA régua do perfil — ver o cabeçalho de `conversa.ts`. */
      alcancaOPerfil: alcancaOPerfil({
        perfilPublico: !!alvo?.perfil_publico,
        souEu: false,
        sigoAtivo: ctx.sigo.has(data.alvoId),
        somosAmigas: ctx.amigas.has(data.alvoId),
      }),
      alvoMeSegue: meSegue.has(data.alvoId),
    });
    if (!veredito.pode) return { ok: false as const, motivo: veredito.motivo };

    const { a, b } = parOrdenado(eu, data.alvoId);
    const { data: existente } = await sb
      .from("rede_conversas")
      .select("id")
      .eq("a_id", a)
      .eq("b_id", b)
      .maybeSingle();
    if (existente?.id) return { ok: true as const, id: existente.id as string };

    const { data: nova, error } = await sb
      .from("rede_conversas")
      .insert({ a_id: a, b_id: b, iniciada_por: eu, aceita: !veredito.comoPedido })
      .select("id")
      .maybeSingle();
    if (error || !nova?.id) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const, id: nova.id as string };
  });

export const mensagensDaConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        antes: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    /* ⚠️ **RECUO DE COLUNA, como toda leitura desta aba.** `imagem_path`,
       `ref_tipo` e `ref_id` nascem num `APLICAR_` que o dono roda à mão, e o
       deploy chega SEMPRE antes: sem o recuo, o `42703` derrubaria a conversa
       inteira — a paciente abriria um direct que já funcionava e veria uma tela
       vazia, por causa de colunas que ela nem sabe que existem. */
    const buscar = async (colunas: string) => {
      let q = sb
        .from("rede_mensagens")
        .select(colunas)
        .eq("conversa_id", data.conversaId)
        .order("criada_em", { ascending: false })
        .limit(MENSAGENS_POR_PAGINA + 1);
      if (data.antes) q = q.lt("criada_em", data.antes);
      return q;
    };
    let { data: linhas, error } = await buscar(
      "id, autor_id, texto, criada_em, apagada_em, imagem_path, audio_path, duracao_seg, " +
        "ref_tipo, ref_id, responde_a",
    );
    let semCorpo = false;
    /* ⚠️ Degrau NOVO, no topo: `responde_a` nasce no `APLICAR_DEZ_DA_REDE.sql`.
       Sem a coluna a conversa continua inteira — só a citação some, que é o
       estado de antes do recurso. Sem este degrau, o `42703` derrubaria a
       leitura e a conversa pararia de abrir. */
    /* ⚠️ **UM DEGRAU POR SQL, e o do ÁUDIO é o mais alto.** `audio_path` nasce
       no `APLICAR_DIRECT_COMPLETO` e `responde_a` no `APLICAR_DEZ_DA_REDE` —
       dois arquivos, e existe um banco que rodou o segundo e não o primeiro. Um
       recuo de dois passos apagaria a CITAÇÃO por causa de uma coluna de voz. */
    if (error) {
      ({ data: linhas, error } = await buscar(
        "id, autor_id, texto, criada_em, apagada_em, imagem_path, ref_tipo, ref_id, responde_a",
      ));
      if (!error)
        linhas = ((linhas ?? []) as any[]).map((l) => ({
          ...l,
          audio_path: null,
          duracao_seg: null,
        }));
      else console.warn("[conversa] sem audio_path — rode APLICAR_DIRECT_COMPLETO.sql");
    }
    if (error) {
      ({ data: linhas, error } = await buscar(
        "id, autor_id, texto, criada_em, apagada_em, imagem_path, ref_tipo, ref_id",
      ));
      if (!error)
        linhas = ((linhas ?? []) as any[]).map((l) => ({
          ...l,
          responde_a: null,
          audio_path: null,
          duracao_seg: null,
        }));
      else console.warn("[conversa] sem responde_a — rode APLICAR_DEZ_DA_REDE.sql");
    }
    if (error) {
      ({ data: linhas, error } = await buscar("id, autor_id, texto, criada_em, apagada_em"));
      if (!error) linhas = ((linhas ?? []) as any[]).map((l) => ({ ...l, responde_a: null }));
      semCorpo = true;
      console.warn("[conversa] sem imagem_path/ref — rode APLICAR_DIRECT_COMPLETO.sql");
    }
    if (error) return { ok: false as const, motivo: "banco" as const };

    /* ⚠️ **PEDE UMA A MAIS PARA SABER SE HÁ MAIS, e não conta o total.** Um
       `count: exact` numa conversa longa varre a tabela a cada abertura; a
       linha extra responde a mesma pergunta com uma leitura só. Ela é cortada
       antes de virar tela — senão a página mostraria 51 e a próxima repetiria
       uma. */
    const brutas = ((linhas ?? []) as any[]).slice(0, MENSAGENS_POR_PAGINA);
    const temMais = ((linhas ?? []) as any[]).length > MENSAGENS_POR_PAGINA;

    /* ⚠️ **O CARIMBO DE LEITURA DA OUTRA, para o ✓✓.** É a coluna que sempre
       existiu e ninguém lia deste lado: quem escreve "acho que estou sentindo
       contração" e não sabe se a outra viu fica olhando uma tela que não
       responde. */
    const leituraDoOutro = (c as any)[colunaDoOutro("lida", eu, c.a_id)] ?? null;

    /* As fotos viram URL assinada aqui, uma vez por página. */
    const comFoto = brutas.filter((m) => m.imagem_path && !m.apagada_em);
    /* ⚠️ **O ÁUDIO ENTRA NA MESMA ONDA DE ASSINATURA da foto.** Uma segunda
       chamada ao Storage por conversa dobraria a espera da tela que a paciente
       abre mais que qualquer outra — e `createSignedUrls` aceita a lista
       inteira de uma vez. */
    const comAudio = brutas.filter((m: any) => !!m.audio_path && !m.apagada_em);
    const assinadas = new Map<string, string>();
    if (comAudio.length) {
      const { data: urls } = await sb.storage.from("conversas").createSignedUrls(
        comAudio.map((m: any) => m.audio_path as string),
        60 * 60,
      );
      for (const [i, u] of ((urls ?? []) as any[]).entries()) {
        const caminho = comAudio[i]?.audio_path;
        if (u?.signedUrl && caminho) assinadas.set(caminho, u.signedUrl);
      }
    }
    if (comFoto.length) {
      const { data: urls } = await sb.storage.from("conversas").createSignedUrls(
        comFoto.map((m) => m.imagem_path as string),
        60 * 60,
      );
      for (const [i, u] of ((urls ?? []) as any[]).entries()) {
        const caminho = comFoto[i]?.imagem_path;
        if (u?.signedUrl && caminho) assinadas.set(caminho, u.signedUrl);
      }
    }

    /**
     * AS CITAÇÕES E AS REAÇÕES — em LOTE, e fora do `.map()`.
     *
     * ⚠️ Uma consulta por mensagem seriam cinquenta idas ao banco por página, na
     * tela que a paciente abre mais vezes que qualquer outra desta aba.
     *
     * ⚠️ **As citadas são buscadas por id, e SEM filtrar por conversa —
     * porque o `.in()` já vem dos `responde_a` das mensagens DESTA conversa.**
     * Um id forjado num `responde_a` seria de outra conversa; por isso o
     * servidor confere no ENVIO (ver `enviarMensagem`), que é onde a coluna é
     * escrita. Aqui, se por qualquer razão uma citada de fora aparecesse, ela é
     * descartada logo abaixo pelo `daConversa`.
     */
    const idsCitados = [
      ...new Set(brutas.map((m: any) => m.responde_a).filter(Boolean)),
    ] as string[];
    const citadas = new Map<string, any>();
    if (idsCitados.length) {
      const { data: cs } = await sb
        .from("rede_mensagens")
        .select("id, conversa_id, autor_id, texto, apagada_em, imagem_path, ref_tipo")
        .in("id", idsCitados);
      for (const c2 of (cs ?? []) as any[]) {
        /* ⚠️ **A citada TEM de ser desta conversa.** Sem esta linha, um
           `responde_a` apontando para outra conversa faria o trecho de uma
           mensagem privada de terceiros aparecer aqui. */
        if (c2.conversa_id !== data.conversaId) continue;
        citadas.set(c2.id, c2);
      }
    }

    /* As reações, em uma consulta só. ⚠️ Falha de leitura vira mapa VAZIO: sem
       as reações a conversa continua inteira, e derrubá-la por um enfeite seria
       trocar um agrado por uma tela vazia. */
    const reacoesPor = new Map<string, Map<string, number>>();
    const minhaReacaoEm = new Map<string, string>();
    {
      const { data: rs } = await sb
        .from("rede_mensagem_reacoes")
        .select("mensagem_id, quem_id, tipo")
        .in(
          "mensagem_id",
          brutas.map((m: any) => m.id),
        );
      for (const r of (rs ?? []) as any[]) {
        const m = reacoesPor.get(r.mensagem_id) ?? new Map<string, number>();
        m.set(r.tipo, (m.get(r.tipo) ?? 0) + 1);
        reacoesPor.set(r.mensagem_id, m);
        if (r.quem_id === eu) minhaReacaoEm.set(r.mensagem_id, r.tipo);
      }
    }

    /**
     * ⚠️ **O FILTRO DE PALAVRAS PASSOU A VALER NO DIRECT — e ele é mais
     * necessário aqui do que nos comentários.**
     *
     * A lista que ela escreveu ("perdi", o nome de um hospital) existia só para
     * a conversa PÚBLICA embaixo das fotos. A mensagem privada é justamente
     * onde o texto duro chega — e onde ela não tem como saber o que vem antes
     * de abrir. É a MESMA lista e a MESMA régua (`temPalavraOculta`), nunca uma
     * segunda: duas divergiriam no primeiro conserto, e a divergência
     * apareceria como a palavra escondida num lugar e à mostra no outro.
     *
     * ⚠️ **ESCONDE, NUNCA APAGA, e o texto NÃO viaja recolhido.** Diferente do
     * comentário (onde a linha recolhida some para terceiros), aqui a conversa
     * é de duas pessoas: a linha continua, sem o texto, e ela abre no toque se
     * quiser. Mandar o texto com uma marca "esconda isto" deixaria a palavra
     * dentro da resposta da rede.
     *
     * ⚠️ **E o filtro NÃO vale para o que EU escrevi.** Ela sabe o que digitou;
     * esconder a própria mensagem seria o app escondendo dela a própria voz.
     */
    const palavras = await (async () => {
      try {
        const { data: p } = await sb
          .from("patient_profiles")
          .select("palavras_ocultas")
          .eq("id", eu)
          .maybeSingle();
        const { limparPalavrasOcultas } = await import("./comentarios");
        return limparPalavrasOcultas(((p as any)?.palavras_ocultas ?? []) as string[]);
      } catch {
        /* ⚠️ Falha ao ler a lista NÃO esconde nada — o pior caso é ela ver uma
           palavra que preferia não ver, contra o caso oposto, que é a conversa
           inteira recolhida por uma falha de rede. */
        return [] as string[];
      }
    })();
    const { temPalavraOculta } = await import("./comentarios");
    const escondeu = (m: any) =>
      m.autor_id !== eu &&
      !m.apagada_em &&
      palavras.length > 0 &&
      temPalavraOculta((m.texto ?? "") as string, palavras);

    const mensagens: MensagemNaTela[] = brutas
      .map((m) => ({
        id: m.id,
        souEu: m.autor_id === eu,
        /* ⚠️ O TEXTO DA APAGADA NÃO VIAJA. Mandá-lo com um `apagada: true` para
           a tela esconder deixaria a mensagem apagada dentro da resposta da
           rede — visível para quem abrisse o inspetor. */
        texto: m.apagada_em || escondeu(m) ? null : (m.texto ?? null),
        criadaEm: m.criada_em,
        apagada: !!m.apagada_em,
        /** Recolhida pelo filtro de palavras DELA. O texto não viaja. */
        recolhida: escondeu(m),
        /* ⚠️ A foto da apagada também não viaja — mesma decisão do texto. */
        imagemUrl: m.apagada_em ? null : (assinadas.get(m.imagem_path) ?? null),
        /* ⚠️ O áudio da apagada também não viaja — mesma decisão do texto e da
           foto: nada da mensagem apagada sai daqui. */
        audioUrl: m.apagada_em ? null : (assinadas.get(m.audio_path) ?? null),
        duracaoSeg: m.apagada_em ? null : ((m.duracao_seg ?? null) as number | null),
        refTipo: m.apagada_em ? null : ((m.ref_tipo ?? null) as "post" | "story" | null),
        refId: m.apagada_em ? null : ((m.ref_id ?? null) as string | null),
        lidaPelaOutra: foiLidaPeloOutro({
          souEu: m.autor_id === eu,
          criadaEm: m.criada_em,
          leituraDoOutro,
        }),
        /* ⚠️ A citação some quando a PRÓPRIA mensagem é apagada — junto com o
           texto e a foto, e pela mesma razão: nada da mensagem apagada viaja. */
        citacao:
          !m.apagada_em && m.responde_a && citadas.has(m.responde_a)
            ? (() => {
                const c2 = citadas.get(m.responde_a);
                return {
                  id: c2.id as string,
                  deQuem: (c2.autor_id === eu ? "eu" : "ela") as "eu" | "ela",
                  trecho: textoDaCitacao({
                    texto: c2.texto ?? null,
                    apagada: !!c2.apagada_em,
                    /* ⚠️ Só o SINAL de que havia foto, nunca a URL: a citação não
                       precisa carregar a imagem, e assiná-la seria uma viagem ao
                       Storage por citação. */
                    imagemUrl: c2.imagem_path ? "x" : null,
                    refTipo: c2.ref_tipo ?? null,
                  }),
                };
              })()
            : null,
        reacoes: [...(reacoesPor.get(m.id) ?? new Map()).entries()].map(([tipo, quantas]) => ({
          tipo,
          quantas: quantas as number,
        })),
        minhaReacao: minhaReacaoEm.get(m.id) ?? null,
      }))
      .reverse();

    return {
      ok: true as const,
      mensagens,
      /* O cursor da página seguinte: a mais ANTIGA que veio. */
      antesDe: temMais ? (brutas[brutas.length - 1]?.criada_em ?? null) : null,
      semCorpo,
      pedido: !c.aceita,
      euIniciei: c.iniciada_por === eu,
      comId: (c.a_id === eu ? c.b_id : c.a_id) as string,
      /* ⚠️ Vem do SERVIDOR, e não de um estado da tela: a paciente pode ter
         silenciado no outro aparelho, e um interruptor que nasce desligado
         faria ela silenciar duas vezes e continuar recebendo push. */
      silenciada: !!(c as any)[minhaColuna("silenciada", eu, c.a_id)],
    };
  });

export const enviarMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        /* ⚠️ **`min(0)`, e não `min(1)`: a mensagem pode ser SÓ FOTO.** Com o
           mínimo de 1, mandar uma ultrassom sem legenda voltava recusada pelo
           validador — antes de qualquer régua, sem mensagem de erro útil. */
        texto: z.string().max(LIMITE_DA_MENSAGEM).optional(),
        /** O caminho do áudio no balde `conversas`. Conferido como a foto. */
        audioPath: z.string().max(300).optional(),
        /** ⚠️ GRAVADA, e não medida na leitura — ver `duracaoEmTexto`. */
        duracaoSeg: z.number().int().min(1).max(AUDIO_SEGUNDOS_MAX).optional(),
        imagemPath: z.string().max(300).optional(),
        refTipo: z.enum(["post", "story"]).optional(),
        refId: z.string().uuid().optional(),
        /** A mensagem citada. ⚠️ Conferida no handler: um nível só, e da MESMA conversa. */
        respondeA: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const texto = (data.texto ?? "").trim();
    const temCorpo = !!texto || !!data.imagemPath || !!data.refId || !!data.audioPath;
    if (!temCorpo) return { ok: false as const, motivo: "vazia" as const };

    /* ⚠️ **A FOTO TEM DE SER DA PASTA DE QUEM MANDA.** O caminho vem do
       cliente (ele sobe pela URL assinada), então sem esta conferência uma
       paciente aponta para a pasta de outra e a mensagem passa a exibir, dentro
       de uma conversa privada, um arquivo que não é dela. Mesma trava do vídeo
       do post. */
    /* ⚠️ **A PASTA ESPERADA É A DERIVADA, e quem a calcula é o SERVIDOR.** A
       régua vive em `conversa.ts`, que roda no navegador também — e
       `pastaDoDono` usa `node:crypto`. Passar a pasta pronta mantém a régua
       pura e testável, e é ela que impede alguém de anexar à mensagem uma foto
       que subiu para a pasta de OUTRA pessoa. */
    const { pastaDoDono: pastaDe } = await import("@/lib/imagens.server");
    /* ⚠️ **O ÁUDIO PASSA PELA MESMA TRAVA DA FOTO.** O caminho vem do CLIENTE
       (ele sobe pela URL assinada); sem a conferência, uma paciente aponta para
       a pasta de outra e a mensagem passa a TOCAR, dentro de uma conversa
       privada, um áudio que não é dela. */
    if (data.audioPath && !fotoEhDeQuemMandou(data.audioPath, pastaDe(eu))) {
      return { ok: false as const, motivo: "foto_invalida" as const };
    }
    if (data.imagemPath && !fotoEhDeQuemMandou(data.imagemPath, pastaDe(eu))) {
      return { ok: false as const, motivo: "foto_invalida" as const };
    }
    /* Anexo pela metade não existe: os dois campos andam juntos. */
    if (!!data.refTipo !== !!data.refId) {
      return { ok: false as const, motivo: "anexo_invalido" as const };
    }

    /**
     * ⚠️ **A RÉGUA CLÍNICA RODA AQUI, E ELA NÃO RODAVA.**
     *
     * O comentário passa por `triarTexto`; a caixinha passa; a mensagem direta
     * — que é o canal MAIS íntimo e o mais provável de carregar "no seu lugar
     * eu esperava" — não passava por nada. É exatamente o cenário dos 5,5% de
     * respostas potencialmente danosas: a conversa de duas em que uma
     * tranquiliza a outra sobre um sintoma que precisava de avaliação.
     *
     * ⚠️ **E O DESFECHO AQUI É DIFERENTE DO DO COMENTÁRIO.** Lá a régua
     * RECUSA. Aqui ela só recusa a EMERGÊNCIA — porque uma conversa privada
     * entre duas pessoas que se escolheram não é um comentário público, e
     * bloquear "toma chá de camomila" numa conversa privada seria o app
     * censurando duas adultas. O que ele faz é o que pode fazer sem mentir:
     * manda a mensagem e AVISA quem escreveu.
     */
    let avisoClinico: "conduta" | null = null;
    if (texto) {
      try {
        const { triarTexto } = await import("./pergunta-clinica");
        const desfecho = triarTexto(texto);
        if (desfecho === "emergencia") {
          return { ok: false as const, motivo: "emergencia" as const };
        }
        if (desfecho !== "publicavel") avisoClinico = "conduta";
      } catch {
        /* ⚠️ Falha ao TRIAR não impede a mensagem. A régua é uma proteção
           adicional, não a condição de existir da conversa — derrubar o direct
           inteiro porque um módulo não carregou seria trocar um risco por uma
           avaria certa. */
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };
    const outro = c.a_id === eu ? c.b_id : c.a_id;

    const { contextoDe } = await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);

    /* Quantas EU já mandei nesta conversa — a trava das mensagens antes do
       aceite. Contada no banco, nunca na tela. */
    const { count: minhas, error: erroConta } = await sb
      .from("rede_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("conversa_id", data.conversaId)
      .eq("autor_id", eu);
    if (erroConta) return { ok: false as const, motivo: "banco" as const };

    const veredito = podeEnviar({
      souODono: true,
      aceita: !!c.aceita,
      euIniciei: c.iniciada_por === eu,
      minhasMensagens: minhas ?? 0,
      temBloqueio: ctx.bloqueio.has(outro),
    });
    if (!veredito.pode) return { ok: false as const, motivo: veredito.motivo! };

    /* O teto diário, contra o dedo preso e contra automação. */
    const ontem = new Date(Date.now() - 86400_000).toISOString();
    const { count: hoje, error: erroHoje } = await sb
      .from("rede_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("autor_id", eu)
      .gte("criada_em", ontem);
    if (erroHoje) return { ok: false as const, motivo: "banco" as const };
    if ((hoje ?? 0) >= MENSAGENS_POR_DIA) return { ok: false as const, motivo: "muitas" as const };

    /* ⚠️ **RECUO POR COLUNA, uma de cada vez.** O banco que ainda não rodou o
       `APLICAR_` recusa `imagem_path`/`ref_tipo` com `PGRST204` — e sem o
       recuo, ENVIAR pararia de funcionar para todo mundo por causa de um
       recurso novo. É a mesma lição de `marcarConsultaNoDia`. */
    /**
     * A CITAÇÃO — conferida aqui, porque a coluna aceita qualquer uuid.
     *
     * ⚠️ **DA MESMA CONVERSA, e a checagem é obrigatória.** Um `respondeA`
     * apontando para outra conversa faria o trecho de uma mensagem privada de
     * terceiros aparecer citado aqui. A leitura também confere (cinto e
     * suspensório), mas quem grava é este ponto.
     *
     * ⚠️ **E UM NÍVEL SÓ**: `alvoDaCitacao` puxa a resposta de uma resposta de
     * volta para a mensagem original. Sem isso, o segundo nível ficaria gravado
     * e a tela — que só desenha um — deixaria a citação órfã.
     *
     * ⚠️ **Alvo inválido NÃO recusa a mensagem**: a citação é um enfeite de
     * contexto, e derrubar o envio por causa dela seria perder o texto que ela
     * escreveu. Vai sem citação.
     */
    let respondeA: string | null = null;
    if (data.respondeA) {
      const { data: alvo } = await sb
        .from("rede_mensagens")
        .select("id, conversa_id, responde_a")
        .eq("id", data.respondeA)
        .maybeSingle();
      if (alvo && (alvo as any).conversa_id === data.conversaId) {
        respondeA = alvoDaCitacao({
          id: (alvo as any).id,
          respondeA: ((alvo as any).responde_a ?? null) as string | null,
        });
      }
    }

    /* ⚠️ Sem texto (a mensagem é só voz ou só foto), a coluna vai `null` — ela
       deixou de ser `NOT NULL` no `APLICAR_DIRECT_COMPLETO`. */
    const base = { conversa_id: data.conversaId, autor_id: eu, texto: texto || null };
    let { error } = await sb.from("rede_mensagens").insert({
      ...base,
      imagem_path: data.imagemPath ?? null,
      audio_path: data.audioPath ?? null,
      duracao_seg: data.duracaoSeg ?? null,
      ref_tipo: data.refTipo ?? null,
      ref_id: data.refId ?? null,
      responde_a: respondeA,
    });
    /* ⚠️ **DEGRAU DO ÁUDIO, e ele vem PRIMEIRO.** `audio_path` nasce no
       `APLICAR_DIRECT_COMPLETO`; sem ela, uma mensagem de VOZ não pode virar uma
       linha sem áudio — seria uma bolha vazia, e ela acharia que mandou. Recusa
       com `sem_suporte`, que a tela sabe explicar. */
    if (error && data.audioPath) {
      return { ok: false as const, motivo: "sem_suporte" as const };
    }
    /* ⚠️ Degrau: `responde_a` nasce no `APLICAR_DEZ_DA_REDE.sql`. Sem ela, a
       mensagem vai SEM a citação — e isso é aceitável porque a citação é
       contexto, não conteúdo: o texto que ela escreveu chega inteiro. */
    if (error) {
      ({ error } = await sb.from("rede_mensagens").insert({
        ...base,
        imagem_path: data.imagemPath ?? null,
        ref_tipo: data.refTipo ?? null,
        ref_id: data.refId ?? null,
      }));
    }
    if (error) {
      /* ⚠️ Sem as colunas, uma mensagem que é SÓ foto viraria uma linha em
         branco — pior que a recusa, porque ela acha que mandou. */
      if (!texto) return { ok: false as const, motivo: "sem_suporte" as const };
      ({ error } = await sb.from("rede_mensagens").insert(base));
    }
    if (error) return { ok: false as const, motivo: "banco" as const };

    /**
     * ⚠️ **RESPONDER ACEITA A CONVERSA.** Quem recebeu o pedido e respondeu já
     * disse sim; deixar `aceita = false` manteria a conversa na caixa de
     * pedidos DELA depois de ela ter escrito nela.
     */
    const aceitaAgora = c.aceita || c.iniciada_por !== eu;
    const { error: erroToque } = await sb
      .from("rede_conversas")
      .update({ ultima_em: new Date().toISOString(), aceita: aceitaAgora })
      .eq("id", data.conversaId);
    if (erroToque) return { ok: false as const, motivo: "banco" as const };

    /**
     * ⚠️ **A MENSAGEM MANDA PUSH, e é a única coisa desta aba que manda além do
     * pedido para seguir.**
     *
     * A regra do app é explícita e está em `avisoMandaPush`: *push é para o que
     * fica esperando resposta*. Reação não manda, marcação não manda, comentário
     * não manda — nenhum deles prende uma decisão dela. Uma mensagem direta
     * prende: alguém escreveu e está esperando.
     *
     * ⚠️ **E O PEDIDO NÃO MANDA.** Este é o ponto delicado: uma desconhecida
     * poderia acordar a paciente às três da manhã com uma mensagem que ela
     * nunca pediu. O pedido aparece no emblema e espera; só a conversa ACEITA
     * empurra. Sem essa distinção, a trava de uma-mensagem viraria uma trava de
     * um-push, que não é a mesma coisa.
     *
     * ⚠️ **O TEXTO NÃO VAI NA NOTIFICAÇÃO.** Ela aparece na tela bloqueada, e
     * uma conversa entre duas gestantes é o conteúdo mais íntimo desta aba —
     * quem estiver do lado do celular leria. Só o nome de quem escreveu.
     *
     * ⚠️ E vai DEPOIS de tudo ter gravado. Avisar de uma mensagem que não
     * gravou é o defeito que o presente do médico já teve.
     */
    /**
     * ⚠️ **O SILÊNCIO É DO LADO DE QUEM RECEBE, e é ele que decide o push.**
     *
     * Sem esta leitura, "silenciar" seria um interruptor decorativo: a conversa
     * ficaria marcada como silenciada na tela dela e o celular continuaria
     * tocando — que é pior que não ter o botão, porque ela para de procurar
     * outra saída achando que resolveu.
     *
     * ⚠️ E é a coluna DA OUTRA (`colunaDoOutro`), não a minha: quem silenciou a
     * conversa foi quem vai receber o aviso. Com `minhaColuna` aqui, eu
     * silenciaria o celular dela ao silenciar o meu.
     */
    const outroSilenciou = !!(c as any)[colunaDoOutro("silenciada", eu, c.a_id)];

    if (aceitaAgora && !outroSilenciou) {
      try {
        const [{ sendPushToUser }, { data: quem }] = await Promise.all([
          import("./push.server"),
          sb.from("patient_profiles").select("display_name").eq("id", eu).maybeSingle(),
        ]);
        const nome = ((quem?.display_name ?? "") as string).trim() || "Alguém";
        await sendPushToUser(outro, {
          title: nome,
          body: "te mandou uma mensagem",
          url: "/minha-conta?tab=Comunidade",
        });
      } catch {
        /* A mensagem está gravada; o aviso é o acessório. */
      }
    }

    return { ok: true as const, avisoClinico };
  });

/**
 * A URL ASSINADA PARA SUBIR A FOTO.
 *
 * ⚠️ **O CAMINHO É MONTADO NO SERVIDOR, sempre.** Deixar o cliente escolher
 * seria dar a ele a chave de escrever em qualquer pasta do balde — inclusive na
 * de outra paciente. Mesma decisão de `urlParaSubirVideo`.
 *
 * ⚠️ **E A CONVERSA É CONFERIDA ANTES DE EMITIR A URL.** Sem isso, qualquer
 * paciente autenticada pediria espaço no balde privado das conversas sem ter
 * conversa nenhuma — armazenamento de graça pago pelo app, e uma pasta cheia de
 * arquivos que nenhuma mensagem referencia.
 */
export const urlParaSubirFotoDaConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        extensao: z.enum(["jpg", "png", "webp"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    /* ⚠️ O nome do arquivo é sorteado no servidor, e a pasta é a de quem manda —
       é o par que faz `fotoEhDeQuemMandou` valer alguma coisa no envio. */
    /* ⚠️ **A PASTA É DERIVADA, e nunca o uuid cru** — a mesma regra do balde de
       exames, que `imagens.test.ts` cobra: o caminho vaza para a URL assinada, e
       um uuid de paciente ali é identificador exposto. */
    const { pastaDoDono } = await import("@/lib/imagens.server");
    const caminho = `${pastaDoDono(eu)}/${crypto.randomUUID()}.${data.extensao}`;
    const { data: assinada, error } = await sb.storage
      .from("conversas")
      .createSignedUploadUrl(caminho);
    if (error || !assinada?.signedUrl) return { ok: false as const, motivo: "banco" as const };
    return {
      ok: true as const,
      url: assinada.signedUrl as string,
      token: (assinada.token ?? null) as string | null,
      caminho,
    };
  });

/**
 * SILENCIAR — e só do MEU lado.
 *
 * ⚠️ **A coluna é escolhida por `minhaColuna`, nunca por um `? :` escrito à
 * mão.** Invertida, ela silencia a conversa da OUTRA pessoa: a amiga para de
 * receber aviso sem ter pedido nada, e não há nada na tela dela que explique.
 *
 * ⚠️ **E ninguém é avisado.** É a mesma decisão do silenciar do feed e do
 * bloqueio: anunciar transforma um gesto privado numa briga, e num app onde as
 * pessoas se conhecem da vida real isso piora a situação que a motivou.
 */
export const silenciarConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        silenciar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    const coluna = minhaColuna("silenciada", eu, c.a_id);
    const { error } = await sb
      .from("rede_conversas")
      .update({ [coluna]: data.silenciar ? new Date().toISOString() : null })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const };
  });

/**
 * SAIR DA CONVERSA — esconder, nunca apagar.
 *
 * ⚠️ **APAGAR AS MENSAGENS APAGARIA AS DELA JUNTO.** O texto que a outra pessoa
 * escreveu, no aparelho dela, sumindo porque eu limpei a minha lista. A linha
 * fica; o que muda é a minha tela.
 *
 * ⚠️ **E A CONVERSA VOLTA SE A OUTRA ESCREVER.** É o comportamento do gênero, e
 * é o certo: "sair" não é bloquear. Quem quer que a pessoa não escreva mais tem
 * o bloqueio, que a tela oferece ao lado — com o nome certo.
 */
export const sairDaConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), conversaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    const coluna = minhaColuna("saiu", eu, c.a_id);
    const { error } = await sb
      .from("rede_conversas")
      .update({ [coluna]: new Date().toISOString() })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const };
  });

export const marcarConversaLida = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), conversaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    const { error } = await sb
      .from("rede_conversas")
      .update({ [minhaColunaDeLeitura(eu, c.a_id)]: new Date().toISOString() })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * APAGAR UMA MENSAGEM.
 *
 * ⚠️ **MARCA, e não `delete`.** A linha some da conversa mas o lugar dela fica:
 * sem isso, a última mensagem apagada faria a lista voltar a mostrar a anterior,
 * e a paciente concluiria que a mensagem que ela viu chegar não existiu.
 *
 * ⚠️ E o TEXTO é apagado de verdade (`texto: ""`), não só marcado — deixar o
 * texto na linha manteria a mensagem legível para qualquer consulta futura.
 */
/**
 * REAGIR A UMA MENSAGEM (ou tirar a reação).
 *
 * Numa conversa de apoio — "estou com medo" às duas da manhã — um ❤️ custa nada
 * e diz muito. Hoje ou ela escreve, ou fica em silêncio.
 *
 * ⚠️ **UMA POR PESSOA POR MENSAGEM, e quem garante é a chave primária.** Trocar
 * a reação é um `upsert`; sem a chave, tocar em dois emojis seguidos deixaria os
 * dois, e a conversa viraria um placar.
 *
 * ⚠️ **NÃO manda push.** É o mesmo canal do aviso de emergência, e um coração
 * de madrugada é exatamente o que faz alguém desligar as notificações — e
 * desligar leva junto o aviso da consulta e o retorno do SOS. Ela vê ao abrir a
 * conversa, que é onde a reação tem sentido.
 */
export const reagirAMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        mensagemId: z.string().uuid(),
        /** `null` tira a reação. */
        tipo: z.string().max(8).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    if (data.tipo !== null && !reacaoDeMensagemConhecida(data.tipo)) {
      return { ok: false as const, motivo: "tipo" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ **A CONVERSA É MINHA — conferido ANTES de qualquer escrita.** Sem isto,
       um uuid de mensagem no corpo do pedido poria uma reação numa conversa de
       terceiros, e a outra veria um emoji de alguém que não está ali. */
    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    /* ⚠️ **E a mensagem tem de ser DESTA conversa.** `minhaConversa` prova que a
       conversa é minha; sem esta segunda leitura, um `mensagemId` de outra
       conversa passaria com um `conversaId` legítimo. */
    const { data: msg, error: erroMsg } = await sb
      .from("rede_mensagens")
      .select("id, conversa_id, apagada_em")
      .eq("id", data.mensagemId)
      .maybeSingle();
    if (erroMsg) return { ok: false as const, motivo: "banco" as const };
    if (!msg || (msg as any).conversa_id !== data.conversaId) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }
    /* Reagir a mensagem apagada é reagir ao que não existe mais. */
    if ((msg as any).apagada_em) return { ok: false as const, motivo: "indisponivel" as const };

    if (data.tipo === null) {
      const { error } = await sb
        .from("rede_mensagem_reacoes")
        .delete()
        .eq("mensagem_id", data.mensagemId)
        .eq("quem_id", eu);
      /* ⚠️ Este é um DELETE deliberado, e é o único do arquivo: tirar a própria
         reação não deixa rastro nenhum a preservar. A linha nem é dela — é o
         gesto dela sobre a mensagem de outra pessoa. */
      if (error) return { ok: false as const, motivo: "sem_suporte" as const };
      return { ok: true as const, tipo: null };
    }

    const { error } = await sb
      .from("rede_mensagem_reacoes")
      .upsert(
        { mensagem_id: data.mensagemId, quem_id: eu, tipo: data.tipo },
        { onConflict: "mensagem_id,quem_id" },
      );
    /* ⚠️ Sem a tabela, a tela DIZ que não está pronto — nunca um "reagiu" mudo
       sobre uma gravação que não aconteceu. */
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const, tipo: data.tipo };
  });

/**
 * DENUNCIAR UMA MENSAGEM.
 *
 * ⚠️ **O DIRECT ERA O ÚNICO CANAL SEM DENÚNCIA — e é o mais privado.** Post,
 * comentário, perfil e caixinha já tinham. Bloquear existe, mas bloquear não
 * deixa rastro para a plataforma: a próxima paciente recebe a mesma coisa da
 * mesma pessoa, e ninguém nunca soube.
 *
 * ⚠️ **O TRECHO É CONGELADO aqui**, como na denúncia de post: se ela apagar a
 * mensagem depois, a fila continua sabendo o que foi denunciado. É a única cópia
 * do texto que sai da conversa, e ela existe para a fila poder julgar.
 *
 * ⚠️ **E quem lê a fila NÃO recebe a conversa inteira** — só esta linha. A
 * denúncia é sobre uma mensagem, e entregar o histórico seria a plataforma lendo
 * uma conversa privada por causa de uma frase.
 */
export const denunciarMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        mensagemId: z.string().uuid(),
        motivo: z.enum(["assedio", "saude", "imagem", "spam", "outro"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    const { data: msg, error: erroMsg } = await sb
      .from("rede_mensagens")
      .select("id, conversa_id, autor_id, texto")
      .eq("id", data.mensagemId)
      .maybeSingle();
    if (erroMsg) return { ok: false as const, motivo: "banco" as const };
    if (!msg || (msg as any).conversa_id !== data.conversaId) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }
    /* ⚠️ Denunciar a própria mensagem não quer dizer nada, e encheria a fila com
       linhas que ninguém tem o que julgar. */
    if ((msg as any).autor_id === eu)
      return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb.from("rede_denuncias").insert({
      alvo: "mensagem",
      alvo_id: data.mensagemId,
      denunciada_id: (msg as any).autor_id,
      quem_id: eu,
      motivo: data.motivo,
      trecho: ((msg as any).texto ?? "").slice(0, 500) || null,
    });
    /* ⚠️ Sem o CHECK novo, o banco recusa o alvo `mensagem` — e a tela DIZ, em
       vez de prometer "fica registrada" sobre uma linha que não gravou. Esta é
       a promessa que o app já quebrou uma vez, com `denunciado_em`. */
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const };
  });

export const apagarMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("rede_mensagens")
      .update({ apagada_em: new Date().toISOString(), texto: "" })
      .eq("id", data.id)
      /* ⚠️ Só a AUTORA apaga a própria mensagem. O id vem do cliente. */
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * "ESTÃO NA MESMA FASE QUE VOCÊ" — a fileira da caixa de entrada.
 *
 * O diferencial pedido pelo dono: *por que elas conversariam aqui e não no
 * Instagram ou no WhatsApp?* No WhatsApp não há como achar alguém que esteja na
 * mesma fase da gestação; no Instagram há uma hashtag e um oceano de
 * desconhecidas. Aqui o app sabe — e é a única coisa que ele sabe e as outras
 * duas redes não têm como saber.
 *
 * ⚠️ **O RECORTE DE PERFIL PÚBLICO ESTÁ NA CONSULTA, antes de tudo** — decisão
 * do dono, e a mesma régua da busca e das sugestões do feed. Filtrar depois de
 * ler é como um perfil vaza; e `podeAparecerNaBusca` é reaproveitada de
 * propósito: quem não pode ser achada não pode ser sugerida, senão a fileira
 * vira a porta dos fundos da busca e o Modo Cuidado volta pela lateral.
 *
 * ⚠️ **A FASE É CALCULADA AQUI E O NÚMERO DA SEMANA NÃO SAI DESTA FUNÇÃO.** Nem
 * no retorno, nem para ordenar. Ver `conversa-sugerida.ts`.
 */
export const conversasSugeridas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [{ sugerirConversas }, { faseDe }, { podeAparecerNaBusca }, { contextoDe }] =
      await Promise.all([
        import("./conversa-sugerida"),
        import("./fase-parecida"),
        import("./rede-social"),
        import("./rede-social.functions"),
      ]);

    /* A minha linha, para saber a minha fase. */
    const { data: minha } = await sb
      .from("patient_profiles")
      .select("lmp_date, reference_date, reference_weeks, reference_days, birth_date, care_mode")
      .eq("id", eu)
      .maybeSingle();
    /* ⚠️ Modo Cuidado tira a fileira inteira — quem acabou de perder a gestação
       não recebe do app um convite para conversar com quem está na fase dela. */
    if (!minha || minha.care_mode) return { ok: true as const, sugeridas: [] };

    const faseDaLinha = async (p: any) => {
      const { computeGestation } = await import("@/lib/gestacao");
      const g = computeGestation({
        lmp: p?.lmp_date ?? null,
        referenceDate: p?.reference_date ?? null,
        referenceWeeks: p?.reference_weeks ?? null,
        referenceDays: p?.reference_days ?? null,
        today: hojeEmSaoPauloLocal(),
      });
      /* ⚠️ Os meses do bebê saem da data de nascimento, e não de `g` — sem
         isso `faseDe` devolvia "pos" para a mãe de dois anos e a fileira
         juntaria recém-nascido com criança. Mesma correção do filtro do feed. */
      /**
       * ⚠️ **`mesesEntre`, e NUNCA uma divisão por 30,44 — este defeito era MEU.**
       *
       * Eu escrevi aqui a segunda régua para "quantos meses o bebê tem": média
       * de dias por mês contra meses de CALENDÁRIO, que é o que `filhos.ts`
       * calcula e o que as outras três leituras do app usam (o feed, o perfil e
       * a linha dos filhos).
       *
       * As duas discordam perto das bordas — e as bordas são justamente os
       * cortes de `fasePosParto` (3 e 12 meses). A mesma mãe podia estar em
       * "pos_recem" para a fileira de conversa e em "pos_bebe" para o feed, e
       * nenhuma tela explicaria por quê.
       */
      const { mesesEntre } = await import("./filhos");
      const hoje = hojeEmSaoPauloLocal();
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
        hoje.getDate(),
      ).padStart(2, "0")}`;
      const meses = p?.birth_date ? mesesEntre(p.birth_date as string, hojeStr) : null;
      return faseDe(g?.weeks ?? null, !!p?.birth_date, meses);
    };

    const minhaFase = await faseDaLinha(minha);
    if (!minhaFase) return { ok: true as const, sugeridas: [] };

    /* ⚠️ **`perfil_publico` NA CONSULTA.** E o teto de 200 é de URL e de
       memória, não de gosto: a régua corta para três, e ler a base inteira para
       devolver três seria pagar por uma varredura a cada abertura da caixa. */
    const { data: linhas, error } = await sb
      .from("patient_profiles")
      .select(
        "id, display_name, avatar_url, perfil_publico, care_mode, last_seen_at, " +
          "lmp_date, reference_date, reference_weeks, reference_days, birth_date",
      )
      .eq("perfil_publico", true)
      .neq("id", eu)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(200);
    /* ⚠️ Falha de leitura devolve fileira VAZIA, nunca erro: esta é uma
       sugestão dentro da caixa de entrada, e derrubar a lista de conversas
       inteira por causa dela seria trocar um enfeite por uma avaria. */
    if (error) return { ok: true as const, sugeridas: [] };

    const candidatas = [];
    for (const p of (linhas ?? []) as any[]) {
      if (!podeAparecerNaBusca({ publico: !!p.perfil_publico, emCuidado: !!p.care_mode })) continue;
      candidatas.push({
        id: p.id as string,
        nome: ((p.display_name ?? "") as string).trim() || "Alguém",
        avatarUrl: (p.avatar_url ?? null) as string | null,
        fase: await faseDaLinha(p),
        ultimaVez: (p.last_seen_at ?? null) as string | null,
      });
    }

    const ctx = await contextoDe(sb, eu);

    /* Com quem eu JÁ converso — sugerir alguém que está três linhas abaixo, na
       própria tela, faz o app parecer que não sabe o que já aconteceu. */
    const { data: minhasConv } = await sb
      .from("rede_conversas")
      .select("a_id, b_id")
      .or(`a_id.eq.${eu},b_id.eq.${eu}`)
      .limit(200);
    const jaConverso = new Set<string>(
      ((minhasConv ?? []) as any[]).map((c) => (c.a_id === eu ? c.b_id : c.a_id)),
    );

    return {
      ok: true as const,
      sugeridas: sugerirConversas({
        euId: eu,
        minhaFase,
        candidatas,
        /**
         * ⚠️ **UNIÃO POR PROXY, e NUNCA `new Set([...bloqueio, ...silenciados])`.**
         *
         * `ctx.bloqueio` é `ConjuntoDeBloqueio`, que FALHA FECHADO: quando a
         * leitura degrada ele responde `true` para todo mundo e ninguém é
         * sugerido. Espalhá-lo num `Set` novo perderia exatamente isso — o
         * embrulho degradado não tem membros para espalhar, então o `Set`
         * sairia vazio e responderia `false` para todas, que é o oposto. Um
         * objeto com `.has` que consulta os dois preserva a propriedade, e é
         * por isso que a assinatura da régua aceita `{ has }` e não `Set`.
         */
        foraDaSugestao: {
          has: (id: string) => ctx.bloqueio.has(id) || ctx.silenciados.has(id),
        },
        jaConverso,
      }),
    };
  });

/** O "hoje" de São Paulo, como o resto do app. Nunca o do contêiner, que é UTC. */
function hojeEmSaoPauloLocal(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

/**
 * MARCAR COMO NÃO LIDA — e ela NÃO precisou de coluna nenhuma.
 *
 * ⚠️ **É a LIMPEZA do carimbo de leitura**, e não um booleano novo. `lida_a`/
 * `lida_b` guardam o INSTANTE da última leitura; apagá-lo é literalmente o que
 * "não lida" significa, e um booleano ao lado seria uma segunda verdade sobre a
 * mesma coisa — no dia em que os dois discordassem, o emblema diria um número e
 * a lista mostraria outro.
 *
 * ⚠️ **E o caso de uso é o desta base:** ela lê uma mensagem às três da manhã,
 * não consegue responder, e quer lembrar. Sem isto, o emblema zera no instante
 * em que ela abre — e a conversa some do topo da cabeça dela junto.
 *
 * ⚠️ **Só do MEU lado**, por `minhaColuna`: invertida, ela marcaria a conversa
 * da OUTRA como não lida, e o celular da amiga acenderia sozinho.
 */
export const marcarConversaNaoLida = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), conversaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    const coluna = minhaColunaDeLeitura(eu, c.a_id);
    const { error } = await sb
      .from("rede_conversas")
      .update({ [coluna]: null })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * AS NOTAS — o recado curto que vive 24 h no topo do direct.
 *
 * ⚠️ **É o formato de MENOR risco da aba, e ele faltava.** "Não consigo dormir
 * 😅" às três da manhã é exatamente o que ninguém publica como POST — post é
 * para sempre e tem plateia —, e é o que começa uma conversa numa comunidade de
 * gestação. O custo de escrever é uma frase; o de ler, um relance.
 *
 * ⚠️ **UMA POR PESSOA: a nota SUBSTITUI a anterior.** Uma lista viraria um
 * segundo feed, e o valor dela é justamente ser uma frase só.
 *
 * ⚠️ **E ELA PASSA PELA RÉGUA CLÍNICA.** É texto curto e público para o círculo
 * dela — o formato em que "toma buscopan que passa" cabe inteiro. A recusa é a
 * mesma do comentário: não publica, e diz por quê.
 */
export const escreverNota = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /** `null` apaga a nota. */
        texto: z.string().max(TAMANHO_DA_NOTA).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ **Modo Cuidado e pausa NÃO escrevem nota.** A régua é a mesma de tudo
       nesta aba: quem está fora da rede não aparece nela. */
    const { foraDaRede, perfisPorId } = await import("./rede-social.functions");
    const perfis = await perfisPorId(sb, [eu]);
    if (foraDaRede(perfis.get(eu))) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const limpo = (data.texto ?? "").trim();
    if (!limpo) {
      const { error } = await sb.from("rede_notas").delete().eq("autor_id", eu);
      if (error) return { ok: false as const, motivo: "sem_suporte" as const };
      return { ok: true as const };
    }

    const { triarTexto } = await import("./pergunta-clinica");
    const desfecho = triarTexto(limpo);
    if (desfecho !== "publicavel") {
      return { ok: false as const, motivo: "clinico" as const };
    }

    const { error } = await sb.from("rede_notas").upsert(
      {
        autor_id: eu,
        texto: limpo,
        criada_em: new Date().toISOString(),
        /* ⚠️ **A validade é CALCULADA aqui, e não deixada no `DEFAULT`.** O
           `DEFAULT` só vale no INSERT: num `upsert` que atualiza, a nota nova
           herdaria o `expira_em` da anterior e sumiria antes da hora. */
        expira_em: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
      { onConflict: "autor_id" },
    );
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const };
  });

/** Uma nota, já pronta para a fileira do topo do direct. */
export type NotaNaTela = {
  autor: { id: string; nome: string; avatarUrl: string | null };
  texto: string;
  criadaEm: string;
  souEu: boolean;
};

/**
 * AS NOTAS DE QUEM ELA CONHECE.
 *
 * ⚠️ **O RECORTE É O GRAFO, e nunca "todo mundo".** Uma nota é uma frase solta
 * sem contexto nenhum; vinda de uma desconhecida, ela não diz nada e ainda
 * ocupa o topo do direct. Só quem ela SEGUE ou de quem é AMIGA — e a dela
 * primeiro, para ela ver o que escreveu.
 *
 * ⚠️ **E as vencidas nunca são APAGADAS na leitura.** Apagar numa consulta de
 * tela transformaria abrir o direct numa escrita — a mesma decisão de
 * `storiesDoFeed` com os stories expirados. Elas ficam, e o filtro é a data.
 */
export const notasDeQuemEuSigo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { contextoDe, perfisPorId, foraDaRede, naFileira } =
      await import("./rede-social.functions");
    const ctx = await contextoDe(sb, eu);
    const de = [...new Set([eu, ...ctx.sigo, ...ctx.amigas])].filter(
      (id) => id === eu || (!ctx.bloqueio.has(id) && !ctx.silenciados.has(id)),
    );

    const { data: linhas, error } = await sb
      .from("rede_notas")
      .select("autor_id, texto, criada_em")
      .in("autor_id", de.slice(0, 200))
      .gt("expira_em", new Date().toISOString())
      .order("criada_em", { ascending: false })
      .limit(50);
    /* ⚠️ Sem a tabela, a fileira simplesmente não existe — nunca um erro na
       tela por causa de um recurso que aquele banco ainda não tem. */
    if (error) return { ok: true as const, notas: [] };

    const ids = ((linhas ?? []) as any[]).map((l) => l.autor_id as string);
    const perfis = await perfisPorId(sb, ids);
    const notas = ((linhas ?? []) as any[])
      /* ⚠️ Quem entrou em luto ou pausou some daqui como some de tudo. */
      .filter((l) => !foraDaRede(perfis.get(l.autor_id)))
      .map((l) => ({
        autor: naFileira(perfis.get(l.autor_id)),
        texto: l.texto as string,
        criadaEm: l.criada_em as string,
        souEu: l.autor_id === eu,
      }));
    /* A minha primeiro: é ela que abre o campo de escrever. */
    notas.sort((a, b) => (a.souEu === b.souEu ? 0 : a.souEu ? -1 : 1));
    return { ok: true as const, notas };
  });

/**
 * FIXAR A CONVERSA NO TOPO — e é preferência de quem OLHA a lista.
 *
 * ⚠️ **Por isso são DUAS colunas, escolhidas por `minhaColuna`.** Uma coluna só
 * faria a escolha de uma valer para a outra: a amiga abriria o direct e
 * encontraria uma conversa presa no topo que ela nunca fixou.
 */
export const fixarConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        fixar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };

    const coluna = minhaColuna("fixada", eu, c.a_id);
    const { error } = await sb
      .from("rede_conversas")
      .update({ [coluna]: data.fixar ? new Date().toISOString() : null })
      .eq("id", data.conversaId);
    if (error) return { ok: false as const, motivo: "sem_suporte" as const };
    return { ok: true as const };
  });

/**
 * DENUNCIAR A CONVERSA INTEIRA.
 *
 * ⚠️ **Denunciar mensagem a mensagem não serve para assédio, e é isso que
 * faltava.** O que caracteriza assédio é o PADRÃO — vinte mensagens que, uma a
 * uma, não dizem nada, e juntas dizem tudo. A denúncia da conversa leva um
 * trecho das últimas para a fila poder VER o padrão; sem isso, quem julga recebe
 * uma frase solta e arquiva.
 *
 * ⚠️ **Só as mensagens DELA entram no trecho.** As minhas não são prova de nada
 * contra ela — e mandá-las para a fila entregaria o meu lado de uma conversa
 * privada a quem não precisa dele.
 */
export const denunciarConversa = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        conversaId: z.string().uuid(),
        motivo: z.enum(["assedio", "saude", "imagem", "spam", "outro"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const c = await minhaConversa(sb, data.conversaId, eu);
    if (!c) return { ok: false as const, motivo: "nao_e_minha" as const };
    const outro = c.a_id === eu ? c.b_id : c.a_id;

    const { data: linhas } = await sb
      .from("rede_mensagens")
      .select("texto, criada_em, autor_id")
      .eq("conversa_id", data.conversaId)
      .eq("autor_id", outro)
      .is("apagada_em", null)
      .order("criada_em", { ascending: false })
      .limit(10);

    /* ⚠️ **O TRECHO É CONGELADO**, como em toda denúncia desta aba: se ela
       apagar as mensagens depois, a fila continua sabendo o que foi denunciado.
       E é cortado — a fila precisa do padrão, não do histórico inteiro. */
    const trecho =
      ((linhas ?? []) as { texto: string | null }[])
        .map((l) => (l.texto ?? "").trim())
        .filter(Boolean)
        .reverse()
        .join(" / ")
        .slice(0, 500) || "(sem texto)";

    const { error } = await sb.from("rede_denuncias").insert({
      alvo: "conversa",
      alvo_id: data.conversaId,
      denunciada_id: outro,
      quem_id: eu,
      motivo: data.motivo,
      trecho,
    });
    if (error && (error as { code?: string }).code !== "23505") {
      /* ⚠️ Sem o CHECK novo o banco recusa o alvo `conversa` com `23514` — e a
         tela DIZ, em vez de prometer "fica registrada". É a promessa que este
         app já quebrou uma vez, com `denunciado_em` gravado e nunca lido. */
      if ((error as { code?: string }).code === "23514") {
        return { ok: false as const, motivo: "sem_suporte" as const };
      }
      return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });

/**
 * ENCAMINHAR UMA MENSAGEM para outra conversa.
 *
 * ⚠️ **SÓ TEXTO, e essa é a regra inteira.** Encaminhar a FOTO que alguém me
 * mandou numa conversa privada é tirar dela a decisão de onde a imagem circula —
 * é a mesma razão pela qual `compartilhar-post.ts` só deixa compartilhar a
 * própria publicação, e pela qual o ✈ do story é do dono. Foto que sai de uma
 * conversa privada não volta.
 *
 * ⚠️ **E O TEXTO VAI SEM AUTORIA.** "Fulana disse: …" transformaria o
 * encaminhar num print — e print de conversa privada é o formato em que uma
 * frase dita a uma pessoa vira uma frase dita ao grupo. Quem encaminha assume o
 * que está mandando; se quiser dizer de quem é, escreve.
 *
 * ⚠️ **A régua clínica roda DE NOVO no destino.** Sem ela, encaminhar seria a
 * porta dos fundos de `triarTexto`: "no seu lugar eu não iria ao PS" seria
 * recusado ao ser escrito e aceito ao ser repassado.
 */
export const encaminharMensagem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /** De onde ela vem — confere que eu estou nessa conversa. */
        deConversaId: z.string().uuid(),
        mensagemId: z.string().uuid(),
        /** Para onde vai — confere que eu estou nessa também. */
        paraConversaId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ **AS DUAS PONTAS SÃO CONFERIDAS, e a de ORIGEM primeiro.** Sem a
       origem, um `mensagemId` de uma conversa de terceiros seria copiado para a
       minha — o texto de duas pessoas que não me conhecem, na minha tela e na
       de quem eu escolher. */
    const de = await minhaConversa(sb, data.deConversaId, eu);
    if (!de) return { ok: false as const, motivo: "nao_e_minha" as const };
    const para = await minhaConversa(sb, data.paraConversaId, eu);
    if (!para) return { ok: false as const, motivo: "nao_e_minha" as const };

    const { data: m } = await sb
      .from("rede_mensagens")
      .select("id, conversa_id, texto, apagada_em")
      .eq("id", data.mensagemId)
      .maybeSingle();
    /* ⚠️ E a mensagem tem de ser DESTA conversa: `minhaConversa` prova que a
       conversa é minha, não que a mensagem é dela. */
    if (!m || (m as any).conversa_id !== data.deConversaId) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }
    if ((m as any).apagada_em) return { ok: false as const, motivo: "indisponivel" as const };

    const texto = (((m as any).texto ?? "") as string).trim();
    /* Sem texto, não há o que encaminhar — a foto e o áudio ficam onde estão. */
    if (!texto) return { ok: false as const, motivo: "so_texto" as const };

    const { triarTexto } = await import("./pergunta-clinica");
    if (triarTexto(texto) === "emergencia") {
      return { ok: false as const, motivo: "emergencia" as const };
    }

    const { error } = await sb
      .from("rede_mensagens")
      .insert({ conversa_id: data.paraConversaId, autor_id: eu, texto });
    if (error) return { ok: false as const, motivo: "banco" as const };

    const { error: erroOrdem } = await sb
      .from("rede_conversas")
      .update({ ultima_em: new Date().toISOString() })
      .eq("id", data.paraConversaId);
    /* A mensagem já foi; o que falha aqui é a ORDEM da lista. Silêncio para a
       paciente, registro para quem investigar. */
    if (erroOrdem) console.warn("[conversa] ordem não atualizou", erroOrdem.code);
    return { ok: true as const };
  });
