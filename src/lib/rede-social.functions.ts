/**
 * A REDE SOCIAL — o lado do servidor.
 *
 * As réguas moram em `rede-social.ts`, testadas sem banco. Aqui fica o que
 * exige o servidor: provar quem é quem, montar o contexto de visibilidade, e
 * nunca devolver mais do que quem pergunta pode ver.
 *
 * ─── ⚠️ POR QUE A LEITURA NÃO É RLS ────────────────────────────────────────
 *
 * Saber se eu posso ver um post cruza QUATRO coisas: o Modo Cuidado do autor, o
 * bloqueio nos dois sentidos, o seguir, e o grafo de amizade que já existe. Uma
 * policy de RLS que fizesse isso duplicaria `podeVerPost` em SQL, e as duas
 * divergiriam no primeiro conserto — com a divergência aparecendo como POST
 * VAZANDO, não como erro. Aqui a régua é chamada uma vez, do TypeScript.
 *
 * ─── ⚠️ O CONTEXTO É CARREGADO UMA VEZ, NÃO POR POST ───────────────────────
 *
 * `contextoDe` lê de uma vez: quem eu sigo, quem me bloqueou, quem eu bloqueei
 * e quem são minhas amigas. Perguntar isso por post faria um feed de vinte
 * posts custar oitenta consultas — e o feed é a tela mais aberta do app.
 */
import { createServerFn } from "@tanstack/react-start";
import { trechoParaLike } from "@/lib/like-seguro";
import { z } from "zod";
import {
  aoSeguir,
  avisoMandaPush,
  LIMITE_DA_BIO,
  LIMITE_DO_TEXTO,
  MINIMO_DA_BUSCA,
  normalizarBusca,
  ordenarFeed,
  podeAparecerNaBusca,
  podeVerPost,
  POSTS_POR_PAGINA,
  aulaValida,
  conjuntoDeBloqueio,
  enqueteValida,
  limparOpcoes,
  postEhValido,
  reacaoConhecida,
  emojiDaReacao,
  totalDeReacoes,
  REACOES,
  type AulaNoPost,
  type ConjuntoDeBloqueio,
  type ContagemDeReacoes,
  type TipoDeReacao,
  type EspecieDeAviso,
  type Visibilidade,
} from "@/lib/rede-social";
import {
  alcancaOPerfil,
  bebeDoPerfil,
  contextoDaPersona,
  entradaDoSelo,
  olharDe,
  seloDoPerfil,
  semanaParaCarimbo,
  type BebeNoPerfil,
  type Persona,
} from "@/lib/selo-do-perfil";
import {
  AUTORAS_CONSULTADAS,
  ordenarPessoas,
  ordenarSugestoes,
  PESSOAS_SUGERIDAS,
  SUGESTOES_POR_LEVA,
} from "@/lib/sugestoes";

export type PostNaTela = {
  id: string;
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  texto: string | null;
  /** A PRIMEIRA foto — é ela que a grade e a prévia usam. */
  imagemUrl: string | null;
  /**
   * O carrossel inteiro, a primeira inclusa.
   *
   * ⚠️ Sempre preenchido quando há foto: um post de foto única é um carrossel
   * de uma. A tela decide mostrar os pontinhos por `length > 1`, e nunca por
   * um segundo campo booleano que um dia discordaria da lista.
   */
  imagens: string[];
  visibilidade: Visibilidade;
  criadoEm: string;
  reacoes: ContagemDeReacoes;
  /** A minha, para o botão já nascer aceso. */
  minhaReacao: TipoDeReacao | null;
  souAAutora: boolean;
  /**
   * Quem estava junto.
   *
   * ⚠️ **Só o id e o nome — nunca mais que isso.** A linha embaixo do autor é
   * "com Marina": um avatar por marcada empilharia foto de gente que não
   * publicou nada, e um link para o perfil já existe pelo próprio nome.
   *
   * ⚠️ **E marcar NÃO amplia a visibilidade.** Este campo é decoração da
   * leitura; quem decide se o post aparece continua sendo `podeVerPost`, sobre
   * a camada de QUEM PUBLICOU.
   */
  marcadas: { id: string; nome: string }[];
  /** Fui EU a marcada aqui? É o que acende o "tirar minha marcação". */
  souMarcada: boolean;
  /**
   * A pergunta anônima que este post responde, ou `null`.
   *
   * ⚠️ **Ela viaja com o POST, e não só na caixinha dela.** O post vai para o
   * feed inteiro: ler "Sim, foi na 20ª" sem saber o que foi perguntado entrega
   * um texto solto que ninguém entende — e o ponto inteiro da caixinha se perde
   * exatamente no caminho que funciona. (O recuo por banco antigo cita a
   * pergunta dentro do texto e por isso acertava; o caminho feliz gravava na
   * coluna e a tela nunca a lia.)
   *
   * ⚠️ Continua sem QUEM perguntou — a coluna nem é lida.
   */
  pergunta: string | null;
  /** A enquete, ou `null`. Os votos são NÚMEROS — nunca quem votou. */
  enquete: {
    opcoes: string[];
    votos: number[];
    /** O índice em que EU votei, ou `null`. Só o meu. */
    meuVoto: number | null;
  } | null;
  /** A aula que ela anexou — só dia e título. */
  aula: AulaNoPost | null;
  /**
   * Guardei este post?
   *
   * ⚠️ Vem do servidor junto com o post, e não de uma segunda consulta que a
   * tela faria depois. Sem ele o marcador nasceria apagado em toda abertura e
   * quem já tinha salvado salvaria de novo — o `upsert` aguenta, mas a tela
   * estaria mentindo sobre o que ela já fez.
   */
  salvo: boolean;
};

export type PerfilNaTela = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  publico: boolean;
  /** `null` = não sigo. */
  meuVinculo: "ativo" | "pendente" | null;
  souEu: boolean;
  /** ⚠️ Só a DONA vê. Não existe contador público de seguidores — ver a régua. */
  meusSeguidores: number | null;
  /**
   * "28 semanas", ou `null` — a régua inteira mora em `selo-do-perfil.ts`.
   *
   * ⚠️ DOIS campos e não um: as chaves são independentes, e uma delas pode
   * estar ligada sozinha. Uma string só ("Helena · 28 semanas") obrigaria a
   * tela a desmontá-la para desenhar o caso de uma chave só.
   */
  seloSemana: string | null;
  seloBebe: string | null;
  /**
   * O código de embaixadora DESTA pessoa, quando ela é uma — e está ativa.
   *
   * ⚠️ É identidade COMERCIAL, e por isso pode ser pública: ela se cadastrou
   * como afiliada para que o código circulasse. Nada de clínico vai junto.
   */
  codigoDeEmbaixadora: string | null;
  /**
   * Eu posso aplicar esse código?
   *
   * ⚠️ **Falso sob a PRÉVIA, sempre.** `ref_code` é gravado UMA VEZ e nunca
   * reescrito, e o mesmo campo carrega o código da MÉDICA dela: um toque numa
   * tela que o app apresenta como inerte queimaria a indicação para sempre, sem
   * erro e sem volta. O `somenteLeitura` da tela já desliga o botão; isto é o
   * cinto, porque a tela e o servidor discordarem aqui custa caro.
   */
  possoAplicarOCodigo: boolean;
  /** As chaves, para a tela dela desenhar os interruptores no estado certo. */
  mostrarSemana: boolean;
  mostrarBebe: boolean;
  /**
   * A aba "Do bebê" — `null` quando não há o que mostrar.
   *
   * ⚠️ Tudo aqui é DERIVADO da semana, e por isso obedece à mesma chave: quem
   * sabe que ela está de 28 semanas já sabe o tamanho do bebê. Um dado que não
   * saia da semana precisa de chave própria.
   */
  bebe: BebeNoPerfil | null;
  /**
   * A caixinha de perguntas está aberta?
   *
   * ⚠️ Vale para QUALQUER pessoa que abra o perfil, e não só para a dona —
   * diferente de `mostrarSemana`/`mostrarBebe`, que são as chaves dela. Aqui o
   * campo não é uma configuração exposta: é o botão "mandar uma pergunta"
   * existir ou não, e sem ele a visitante não teria como saber que pode.
   */
  aceitaPerguntas: boolean;
  /**
   * Quantas pessoas EU acompanho — só no meu próprio perfil.
   *
   * ⚠️ Viaja com o perfil, e não como prop solta da tela: `seguindo` era uma
   * prop de `TelaDePerfil` que NENHUM chamador de produção passava, então o
   * número nascia `0` e a lista abria com doze pessoas embaixo dele.
   */
  euSigo: number | null;
};

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(accessToken);
  return data.user?.id ?? null;
}

/** Tudo que a visibilidade precisa, numa leva só. */
type Contexto = {
  sigo: Set<string>;
  bloqueio: ConjuntoDeBloqueio;
  amigas: Set<string>;
  /**
   * Alguma das leituras falhou.
   *
   * ⚠️ Quem lê isto devolve ERRO, e nunca a tela de "não há nada": um feed
   * vazio e um feed que não carregou são a mesma imagem e conclusões opostas.
   * O contexto continua seguro sozinho (ver `Bloqueio`) — isto é para a tela
   * não mentir.
   */
  degradado: boolean;
};

async function contextoDe(sb: any, eu: string): Promise<Contexto> {
  const [seg, meus, deles] = await Promise.all([
    sb.from("rede_seguidores").select("seguido_id").eq("seguidor_id", eu).eq("estado", "ativo"),
    sb.from("rede_bloqueios").select("bloqueado_id").eq("quem_id", eu),
    sb.from("rede_bloqueios").select("quem_id").eq("bloqueado_id", eu),
  ]);

  /* ⚠️ O bloqueio entra nos DOIS sentidos no mesmo conjunto. Guardar só o meu
     deixaria quem me bloqueou continuar aparecendo no meu feed — e a palavra
     "bloquear" promete que nenhuma das duas vê a outra. */
  const ids = new Set<string>();
  for (const b of ((meus as any).data ?? []) as { bloqueado_id: string }[]) ids.add(b.bloqueado_id);
  for (const b of ((deles as any).data ?? []) as { quem_id: string }[]) ids.add(b.quem_id);
  const bloqueioFalhou = !!(meus as any).error || !!(deles as any).error;

  /* O grafo de amizade é o que JÁ EXISTE. Reusar `idsDasAmigas` em vez de
     recriar: duas réguas de "quem é amiga" divergiriam, e aqui a divergência
     apareceria como post da camada restrita vazando. */
  let amigas = new Set<string>();
  let amigasFalhou = false;
  try {
    const { idsDasAmigas } = await import("@/lib/amigas.functions");
    const r = await idsDasAmigas(sb, eu);
    /* ⚠️ **`degradada` é a lista SEM as amizades encerradas subtraídas**, e aqui
       isso não é um nome a mais na lista: `amigas` destranca a camada mais
       restrita (o desabafo de terça) e ATRAVESSA perfil privado, porque
       `alcancaOPerfil` aceita `somosAmigas`. A aba Amigas tolera a degradação
       de propósito (perder todas as amigas por uma consulta lenta é pior); a
       rede não pode. Aqui, sem certeza, o conjunto é VAZIO. */
    if (!r.degradada) {
      amigas = r.todas instanceof Set ? r.todas : new Set(r.todas as string[]);
    } else {
      amigasFalhou = true;
    }
  } catch {
    /* Sem o grafo, a camada `amigas` fecha em vez de abrir. Errar para o lado
       de não mostrar é a única direção segura numa régua de visibilidade. */
    amigasFalhou = true;
  }

  return {
    sigo: new Set((((seg as any).data ?? []) as { seguido_id: string }[]).map((s) => s.seguido_id)),
    bloqueio: conjuntoDeBloqueio(ids, bloqueioFalhou),
    amigas,
    degradado: bloqueioFalhou || amigasFalhou || !!(seg as any).error,
  };
}

/**
 * Quantas pessoas me acompanham.
 *
 * ⚠️ Só para a DONA — não existe contador público de seguidores neste app, e a
 * razão está em `NUMEROS_PUBLICOS`: um placar de audiência mede popularidade
 * num momento em que ela já está sendo medida clinicamente.
 */
async function contarSeguidores(sb: any, eu: string): Promise<number> {
  const { count } = await sb
    .from("rede_seguidores")
    .select("seguidor_id", { count: "exact", head: true })
    .eq("seguido_id", eu)
    .eq("estado", "ativo");
  return count ?? 0;
}

/** Quantas pessoas eu acompanho. */
async function contarSeguindo(sb: any, eu: string): Promise<number> {
  const { count } = await sb
    .from("rede_seguidores")
    .select("seguido_id", { count: "exact", head: true })
    .eq("seguidor_id", eu)
    .eq("estado", "ativo");
  return count ?? 0;
}

/**
 * QUEM CHAMA ESTÁ EM MODO CUIDADO?
 *
 * ⚠️ **As quatro leituras do feed não perguntavam isso**, e o único portão era
 * a prop `careMode` da tela — derivada de `profile?.care_mode`, que chega
 * DEPOIS de duas rodadas de rede (o próprio CLAUDE.md documenta a ordem).
 * `carregarFeed()` dispara na primeira renderização com `careMode === false`,
 * então se o feed voltasse antes do perfil havia um FLASH do feed completo —
 * ultrassons, selos de "28 semanas", enquetes de nome — para quem acabou de
 * perder a gestação.
 *
 * Todo o resto da aba respeita "o portão mora no servidor". Este, que é o mais
 * doloroso, não respeitava.
 *
 * ⚠️ Falha de leitura conta como EM CUIDADO. É a única direção segura: o custo
 * de errar para um lado é um feed vazio por uma abertura; para o outro, é a
 * tela que o Modo Cuidado inteiro existe para impedir.
 */
async function euEmCuidado(sb: any, eu: string): Promise<boolean> {
  const { data, error } = await sb
    .from("patient_profiles")
    .select("care_mode")
    .eq("id", eu)
    .maybeSingle();
  if (error) return true;
  return !!(data as any)?.care_mode;
}

/** Perfis por id, com o que a rede precisa. */
async function perfisPorId(sb: any, ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const { data, error } = await sb.from("patient_profiles").select(COLUNAS_DO_PERFIL).in("id", ids);

  /* ⚠️ **RECUO PARA BANCO SEM AS COLUNAS DO SELO.**
     `mostrar_semana`/`mostrar_bebe` nascem num `APLICAR_` que o dono roda à
     mão, e o deploy chega antes. Sem este recuo, o select inteiro falha com
     `42703` e `perfisPorId` devolve um Map VAZIO — e como `montarPosts`
     descarta todo post cujo autor não está no Map, a aba Comunidade inteira
     fica preta em silêncio: feed vazio, nenhum perfil abre, busca sem
     resultado, e `verPerfil` respondendo `indisponivel` para a própria dona,
     que é a mesma palavra de "bloqueada" e "em luto".

     É a mesma família do `pre_consultation_forms` que custou um pedido de
     pré-consulta nunca enviado, e o mesmo recuo que `marcarConsultaNoDia` já
     tem para `patient_user_id`/`duration_minutes`. Sem as colunas, as duas
     chaves valem `false` — que é o padrão delas de qualquer forma. */
  const linhas = error ? await semAsColunasDoSelo(sb, ids) : ((data ?? []) as any[]);
  /* ⚠️ **O avatar é RENOVADO na leitura**, e é aqui que a promessa de
     `salvarPerfilSocial` ("a próxima leitura renova") vira código: ela era
     falsa, e no oitavo dia a foto de toda paciente respondia 403 no app
     inteiro. Um ponto só, porque `perfisPorId` alimenta feed, perfil, busca,
     stories, atividade e salvos — renovar em cada um deles seria seis lugares
     para esquecer o sétimo. */
  const { renovarUrlAssinada } = await import("@/lib/imagens.server");
  const renovadas = await Promise.all(
    linhas.map(async (p) => ({ ...p, avatar_url: await renovarUrlAssinada(p.avatar_url) })),
  );
  return new Map(renovadas.map((p) => [p.id, p]));
}

/**
 * As colunas que a rede lê de `rede_posts`.
 *
 * ⚠️ **Uma lista só, e é o que impede o recurso de sumir numa tela só.** Havia
 * CINCO cópias desta lista (feed, perfil, sugestões, post avulso, salvos), e
 * acrescentar uma coluna significava lembrar das cinco: esquecer uma fazia a
 * enquete existir no feed e desaparecer na grade do perfil, sem erro nenhum.
 */
const COLUNAS_DO_POST =
  "id, autor_id, texto, imagem_path, imagens, visibilidade, criado_em, " +
  "enquete_opcoes, aula, pergunta";

/** A mesma lista sem as colunas que o dono ainda pode não ter aplicado. */
const COLUNAS_DO_POST_ANTIGAS =
  "id, autor_id, texto, imagem_path, imagens, visibilidade, criado_em";

/**
 * TODA leitura de post passa por aqui — e o motivo é o raio de dano.
 *
 * ⚠️ **Uma lista única resolveu a divergência entre cinco telas e criou um
 * ponto único de falha.** As cinco leituras (`verPerfil`, `meuFeed`,
 * `sugestoesDoFeed`, `verPost`, `meusSalvos`) descartavam o `error`, e num banco
 * sem `enquete_opcoes`/`aula` o `42703` devolve `data: null` nas CINCO ao mesmo
 * tempo: feed vazio, todo perfil vazio, zona de sugeridos vazia, post avulso
 * "indisponivel" e salvos vazio — sem erro na tela e sem log. A aba inteira
 * preta, e a paciente sem ver nem os próprios posts.
 *
 * `publicarPost` já tinha recuo; a LEITURA não tinha. E o deploy chega sempre
 * antes de o dono rodar o SQL — é a mesma família do `perfisPorId`, que já
 * documenta este defeito uma fase atrás.
 *
 * O recuo devolve as colunas velhas e preenche as novas com `null`: sem
 * enquete, sem aula e sem a pergunta respondida, que é exatamente o que um
 * banco sem elas tem a dizer.
 */
async function postsCrus(sb: any, monta: (base: any) => any): Promise<any[]> {
  const { data, error } = await monta(sb.from("rede_posts").select(COLUNAS_DO_POST));
  if (!error) return (data ?? []) as any[];
  console.warn("[rede] posts sem enquete/aula/pergunta — rode APLICAR_REDE_SOCIAL.sql");
  const { data: velhos } = await monta(sb.from("rede_posts").select(COLUNAS_DO_POST_ANTIGAS));
  return ((velhos ?? []) as any[]).map((p) => ({
    ...p,
    enquete_opcoes: null,
    aula: null,
    pergunta: null,
  }));
}

/** As colunas que a rede lê de `patient_profiles`. Uma lista só, dois selects. */
const COLUNAS_DO_PERFIL =
  "id, display_name, avatar_url, bio, perfil_publico, care_mode, " +
  "baby_name, mostrar_semana, mostrar_bebe, aceita_perguntas, " +
  "lmp_date, reference_date, reference_weeks, reference_days, birth_date";

const COLUNAS_SEM_SELO =
  "id, display_name, avatar_url, bio, perfil_publico, care_mode, " +
  "baby_name, lmp_date, reference_date, reference_weeks, reference_days, birth_date";

async function semAsColunasDoSelo(sb: any, ids: string[]): Promise<any[]> {
  console.warn("[rede] sem mostrar_semana/mostrar_bebe — rode APLICAR_REDE_SOCIAL.sql");
  const { data } = await sb.from("patient_profiles").select(COLUNAS_SEM_SELO).in("id", ids);
  /* As chaves ausentes valem `false`: a paciente não pode ter ligado o que o
     banco ainda não sabe guardar. */
  return ((data ?? []) as any[]).map((p) => ({
    ...p,
    mostrar_semana: false,
    mostrar_bebe: false,
  }));
}

/**
 * O selo de um perfil, a partir da linha que `perfisPorId` já leu.
 *
 * ⚠️ A idade gestacional sai de `computeGestation` — a régua ÚNICA do app, a
 * mesma que o prontuário, as conquistas e a emergência usam. Subtrair datas
 * aqui faria a rede social discordar do consultório sobre a semana da mesma
 * paciente.
 */
/**
 * "Hoje" no fuso da paciente.
 *
 * A base inteira é brasileira, e o app já toma essa decisão em outros lugares
 * (o cron do lembrete de meditação, a contagem de dias distintos das
 * conquistas). Sem isto, a semana do perfil discorda da semana da home por
 * três horas todo dia.
 */
function hojeEmSaoPaulo(): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  /* Meio-dia, e não meia-noite: `computeGestation` monta a data da DUM com
     `T00:00:00` local do processo, e comparar duas meias-noites de fusos
     diferentes erra por um dia inteiro na direção errada. */
  return new Date(`${partes}T12:00:00`);
}

async function seloDe(p: any) {
  const { computeGestation } = await import("@/lib/gestacao");
  const g = computeGestation({
    lmp: p?.lmp_date ?? null,
    referenceDate: p?.reference_date ?? null,
    referenceWeeks: p?.reference_weeks ?? null,
    referenceDays: p?.reference_days ?? null,
    /* ⚠️ **O dia é o de SÃO PAULO, não o do contêiner.** O servidor roda em
       UTC; das 21h à meia-noite ele já está no dia seguinte, e num dia de cada
       sete isso é a virada de semana: o perfil mostraria "28 semanas" enquanto
       a home da mesma paciente, na mesma sessão, mostra 27 em corpo gigante —
       porque a home calcula no navegador dela. Medido pela verificação. */
    today: hojeEmSaoPaulo(),
  });
  /* ⚠️ O mapeamento linha→entrada é PURO e mora em `selo-do-perfil.ts`: uma
     mutação que cravava `mostrarSemana: true` aqui — desligando o
     consentimento inteiro — passava com os 3.149 testes verdes, porque a única
     cobertura deste trecho era um `toContain` sobre o texto do fonte. */
  return seloDoPerfil(entradaDoSelo(p, g?.totalDays ?? null));
}

/**
 * O código de embaixadora de um perfil — ou `null`.
 *
 * ⚠️ **Só o código ATIVO.** Um código desligado não atribui e não paga: mostrá-lo
 * faria a visitante aplicar, ver "pronto" e nunca receber nada — e a criadora
 * nunca receber a comissão. `atribuirInfluenciadora` já recusa; a tela não pode
 * oferecer o que o servidor vai negar.
 *
 * ⚠️ O e-mail mora em `auth.users` e é lido só aqui, no servidor: ele é a chave
 * que liga a paciente à linha de `affiliates`, e não vai para tela nenhuma.
 */
async function codigoDeEmbaixadora(sb: any, perfilId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(perfilId);
    const email = u?.user?.email?.trim().toLowerCase();
    if (!email) return null;
    const { data: aff } = await sb
      .from("affiliates")
      .select("code, active")
      .eq("email", email)
      .maybeSingle();
    return aff?.active ? ((aff.code as string) ?? null) : null;
  } catch {
    /* Sem a tabela (banco sem o SQL de afiliadas) ou sem e-mail: sem código.
       O perfil continua inteiro — a pílula é que não aparece. */
    return null;
  }
}

/** Eu já tenho um código de indicação gravado? */
async function tenhoRefCode(sb: any, eu: string): Promise<boolean> {
  const { data } = await sb.from("patient_profiles").select("ref_code").eq("id", eu).maybeSingle();
  /* ⚠️ Erro de leitura vale COMO SE tivesse: oferecer o botão sem saber faria
     a paciente tocar e o servidor recusar em silêncio — e ela ficaria achando
     que aplicou. Errar para o lado de não oferecer. */
  return data ? !!(data as any).ref_code : true;
}

/** A semana do carimbo do story, da linha de perfil já lida. */
async function carimboDe(p: any): Promise<string | null> {
  const { computeGestation } = await import("@/lib/gestacao");
  const g = computeGestation({
    lmp: p?.lmp_date ?? null,
    referenceDate: p?.reference_date ?? null,
    referenceWeeks: p?.reference_weeks ?? null,
    referenceDays: p?.reference_days ?? null,
    today: hojeEmSaoPaulo(),
  });
  return semanaParaCarimbo(entradaDoSelo(p, g?.totalDays ?? null));
}

/**
 * A aba "Do bebê" — Fase 2.
 *
 * ⚠️ A tabela vem de `gestacao.ts` (`babyForWeek`/`fruitEmojiForWeek`), a mesma
 * que a aba do Bebê da paciente já usa. Uma segunda tabela faria o perfil
 * social dizer "berinjela" enquanto a home diz "abacaxi" na mesma semana.
 */
async function bebeDe(p: any, souEu: boolean) {
  const { babyForWeek, computeGestation, fruitEmojiForWeek, WEEK_MAX, WEEK_MIN } =
    await import("@/lib/gestacao");
  const g = computeGestation({
    lmp: p?.lmp_date ?? null,
    referenceDate: p?.reference_date ?? null,
    referenceWeeks: p?.reference_weeks ?? null,
    referenceDays: p?.reference_days ?? null,
    today: hojeEmSaoPaulo(),
  });
  return bebeDoPerfil(
    entradaDoSelo(p, g?.totalDays ?? null),
    { souEu },
    /* ⚠️ Fora da faixa devolve `null` em vez de deixar `babyForWeek` CLAMPAR:
       ele responde a semana 2 com os dados da 4 e a 50 com os da 40, sem
       avisar — e a aba mostraria uma fruta que não é a dela. */
    (semana) => (semana < WEEK_MIN || semana > WEEK_MAX ? null : babyForWeek(semana)),
    fruitEmojiForWeek,
  );
}

/** Reações de vários posts, agrupadas. */
async function reacoesDe(sb: any, postIds: string[], eu: string) {
  if (postIds.length === 0) {
    return {
      porPost: new Map<string, ContagemDeReacoes>(),
      minhas: new Map<string, TipoDeReacao>(),
    };
  }
  const { data } = await sb
    .from("rede_reacoes")
    .select("post_id, quem_id, tipo")
    .in("post_id", postIds);

  const porPost = new Map<string, ContagemDeReacoes>();
  const minhas = new Map<string, TipoDeReacao>();
  for (const r of (data ?? []) as { post_id: string; quem_id: string; tipo: TipoDeReacao }[]) {
    const c = porPost.get(r.post_id) ?? {};
    c[r.tipo] = (c[r.tipo] ?? 0) + 1;
    porPost.set(r.post_id, c);
    if (r.quem_id === eu) minhas.set(r.post_id, r.tipo);
  }
  return { porPost, minhas };
}

/**
 * Os votos de várias enquetes, agrupados.
 *
 * ⚠️ Devolve CONTAGEM por opção e o MEU voto — nunca a lista de quem votou. No
 * Instagram a autora vê quem votou em quê, e esse é exatamente o dado que este
 * app decidiu não expor (a mesma razão de `rede_salvos` ser privado inclusive
 * para a autora do post).
 */
async function votosDe(sb: any, postIds: string[], eu: string) {
  const vazio = { porPost: new Map<string, number[]>(), meus: new Map<string, number>() };
  if (postIds.length === 0) return vazio;
  const { data } = await sb
    .from("rede_votos")
    .select("post_id, quem_id, opcao")
    .in("post_id", postIds);

  const porPost = new Map<string, number[]>();
  const meus = new Map<string, number>();
  for (const v of (data ?? []) as { post_id: string; quem_id: string; opcao: number }[]) {
    const c = porPost.get(v.post_id) ?? [0, 0, 0, 0];
    if (v.opcao >= 0 && v.opcao < 4) c[v.opcao] += 1;
    porPost.set(v.post_id, c);
    if (v.quem_id === eu) meus.set(v.post_id, v.opcao);
  }
  return { porPost, meus };
}

/** Quais destes eu já guardei. Uma consulta só, como a das reações. */
async function salvosDe(sb: any, postIds: string[], eu: string): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data } = await sb
    .from("rede_salvos")
    .select("post_id")
    .eq("quem_id", eu)
    .in("post_id", postIds);
  return new Set(((data ?? []) as { post_id: string }[]).map((l) => l.post_id));
}

/** Monta os posts para a tela, já filtrados pela régua. */
/**
 * O que `montarPosts` precisa saber.
 *
 * ⚠️ `bloqueio` é ESTRUTURAL (`{ has }`) e não `Set`: o contexto real entrega um
 * `Bloqueio`, que responde `true` para todo mundo quando a leitura falhou, e o
 * espelho entrega um `Set` vazio de propósito (bloqueio é outra pergunta, e a
 * prévia não é o lugar de simulá-la). Amarrar o tipo a `Set` obrigaria um dos
 * dois a mentir.
 */
type OlhoDeQuemVe = {
  sigo: Set<string>;
  amigas: Set<string>;
  bloqueio: { has(id: string): boolean };
};

/**
 * Quem foi marcada em cada post.
 *
 * ⚠️ **Recuo por tabela ausente.** `rede_marcacoes` nasce num `APLICAR_` que o
 * dono roda à mão; sem o recuo, TODO o feed quebraria na janela entre o deploy
 * e o SQL — por causa de uma linha decorativa embaixo do nome.
 */
/**
 * Os posts em que ALGUÉM foi marcada.
 *
 * ⚠️ Teto igual ao da página: sem ele, um perfil com centenas de marcações
 * mandaria centenas de uuids na query string do `in()` — a mesma armadilha de
 * URL que `sugestoes.ts` documenta com o teto de 60 autoras.
 */
async function idsMarcadosDe(sb: any, quem: string): Promise<string[]> {
  const { data, error } = await sb
    .from("rede_marcacoes")
    .select("post_id")
    .eq("quem_id", quem)
    .order("criado_em", { ascending: false })
    .limit(POSTS_POR_PAGINA);
  if (error) return [];
  return ((data ?? []) as { post_id: string }[]).map((l) => l.post_id);
}

async function marcacoesDe(
  sb: any,
  postIds: string[],
): Promise<Map<string, { id: string; nome: string }[]>> {
  const fora = new Map<string, { id: string; nome: string }[]>();
  if (postIds.length === 0) return fora;
  const { data, error } = await sb
    .from("rede_marcacoes")
    .select("post_id, quem_id")
    .in("post_id", postIds);
  if (error) {
    console.warn("[rede] sem rede_marcacoes — rode APLICAR_REDE_SOCIAL.sql");
    return fora;
  }
  const linhas = (data ?? []) as { post_id: string; quem_id: string }[];
  if (linhas.length === 0) return fora;

  const perfis = await perfisPorId(sb, [...new Set(linhas.map((l) => l.quem_id))]);
  for (const l of linhas) {
    const p = perfis.get(l.quem_id);
    /* ⚠️ MODO CUIDADO TIRA O NOME DA LINHA, sem apagar a marcação. Quando ela
       voltar, a marcação volta com ela — é a mesma decisão da dupla das Amigas,
       que some dos dois lados sem apagar a linha. */
    if (!p || p.care_mode) continue;
    const nome = (p.display_name ?? "").trim() || "Alguém";
    fora.set(l.post_id, [...(fora.get(l.post_id) ?? []), { id: l.quem_id, nome }]);
  }
  return fora;
}

async function montarPosts(
  sb: any,
  eu: string,
  brutos: any[],
  ctx: OlhoDeQuemVe,
): Promise<PostNaTela[]> {
  const autores = await perfisPorId(sb, [...new Set(brutos.map((p) => p.autor_id))]);

  const visiveis = brutos.filter((p) => {
    const a = autores.get(p.autor_id);
    if (!a) return false;
    return podeVerPost({
      post: { autorId: p.autor_id, visibilidade: p.visibilidade },
      euId: eu,
      autor: { emCuidado: !!a.care_mode, publico: !!a.perfil_publico },
      bloqueado: ctx.bloqueio.has(p.autor_id),
      sigoAtivo: ctx.sigo.has(p.autor_id),
      somosAmigas: ctx.amigas.has(p.autor_id),
    });
  });

  /* Reações e salvos em PARALELO: duas consultas independentes, e em série a
     segunda só sairia depois de a primeira voltar. */
  const [{ porPost, minhas }, salvos, votos, marcadas] = await Promise.all([
    reacoesDe(
      sb,
      visiveis.map((p) => p.id),
      eu,
    ),
    salvosDe(
      sb,
      visiveis.map((p) => p.id),
      eu,
    ),
    votosDe(
      sb,
      visiveis.map((p) => p.id),
      eu,
    ),
    marcacoesDe(
      sb,
      visiveis.map((p) => p.id),
    ),
  ]);

  const { urlAssinada } = await import("@/lib/imagens.server");
  return Promise.all(
    visiveis.map(async (p) => {
      const a = autores.get(p.autor_id);
      /* ⚠️ `imagem_path` é a primeira e `imagens` são as DEMAIS — a coluna
         nasceu depois, e os posts antigos têm o array vazio. Juntar aqui é o
         que faz o post antigo e o novo terem a mesma forma na tela; sem isso a
         tela precisaria de um `if` para cada caso. */
      const caminhos = [p.imagem_path, ...((p.imagens ?? []) as string[])].filter(
        Boolean,
      ) as string[];
      const urls = (await Promise.all(caminhos.map((c) => urlAssinada("rede", c, 3600)))).filter(
        Boolean,
      ) as string[];
      return {
        id: p.id,
        autorId: p.autor_id,
        autorNome: (a?.display_name ?? "").trim() || "Alguém",
        autorAvatar: a?.avatar_url ?? null,
        texto: p.texto ?? null,
        imagemUrl: urls[0] ?? null,
        imagens: urls,
        visibilidade: p.visibilidade,
        criadoEm: p.criado_em,
        reacoes: porPost.get(p.id) ?? {},
        minhaReacao: minhas.get(p.id) ?? null,
        souAAutora: p.autor_id === eu,
        marcadas: marcadas.get(p.id) ?? [],
        souMarcada: (marcadas.get(p.id) ?? []).some((m) => m.id === eu),
        salvo: salvos.has(p.id),
        /* ⚠️ A enquete só existe se houver opções: um array vazio (o padrão da
           coluna) é "post sem enquete", nunca "enquete de zero opções". */
        enquete: (p.enquete_opcoes ?? []).length
          ? {
              opcoes: p.enquete_opcoes as string[],
              votos: (votos.porPost.get(p.id) ?? [0, 0, 0, 0]).slice(
                0,
                (p.enquete_opcoes as string[]).length,
              ),
              meuVoto: votos.meus.get(p.id) ?? null,
            }
          : null,
        aula: aulaValida(p.aula) ? p.aula : null,
        pergunta: typeof p.pergunta === "string" && p.pergunta.trim() ? p.pergunta : null,
      };
    }),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

/** As configurações do meu perfil social. */
export const meuPerfilSocial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ O perfil sai de `perfisPorId`, e não de um select próprio: era a
       SEGUNDA leitura de `patient_profiles` deste arquivo, com a mesma lista de
       colunas escrita à mão — e sem o recuo para banco sem as colunas do selo,
       que é justamente o que deixaria ESTA tela (a que liga as chaves) sem
       perfil nenhum. Uma leitura só, um recuo só. */
    const [meus, { count: seguidores }, { data: pendentes }] = await Promise.all([
      perfisPorId(sb, [eu]),
      sb
        .from("rede_seguidores")
        .select("id", { count: "exact", head: true })
        .eq("seguido_id", eu)
        .eq("estado", "ativo"),
      sb
        .from("rede_seguidores")
        .select("seguidor_id, criado_em")
        .eq("seguido_id", eu)
        .eq("estado", "pendente")
        .order("criado_em", { ascending: false })
        .limit(50),
    ]);

    const p = meus.get(eu);
    if (!p) return { ok: false as const, motivo: "indisponivel" as const };

    const quemPediu = await perfisPorId(
      sb,
      ((pendentes ?? []) as { seguidor_id: string }[]).map((x) => x.seguidor_id),
    );

    const selo = await seloDe(p);

    return {
      ok: true as const,
      perfil: {
        id: eu,
        nome: ((p as any)?.display_name ?? "").trim() || "Você",
        bio: (p as any)?.bio ?? null,
        avatarUrl: (p as any)?.avatar_url ?? null,
        publico: !!(p as any)?.perfil_publico,
        meuVinculo: null,
        souEu: true,
        meusSeguidores: seguidores ?? 0,
        /* A tela dela precisa do selo (para mostrar como ficou) E das chaves
           (para os interruptores nascerem no estado certo). */
        seloSemana: selo.semana,
        seloBebe: selo.bebe,
        mostrarSemana: !!(p as any)?.mostrar_semana,
        mostrarBebe: !!(p as any)?.mostrar_bebe,
        bebe: await bebeDe(p, true),
      } as PerfilNaTela,
      emCuidado: !!(p as any)?.care_mode,
      /**
       * A semana que ela PODE carimbar num story.
       *
       * ⚠️ Campo próprio, e não `perfil.seloSemana`: aquele é gated pela chave
       * PERMANENTE do perfil, e o carimbo é escolha por publicação. Amarrar os
       * dois obrigaria quem quer mandar uma foto com a semana a publicá-la no
       * perfil para sempre. `null` quando não há o que carimbar.
       */
      semanaDoCarimbo: await carimboDe(p),
      pedidos: ((pendentes ?? []) as { seguidor_id: string }[])
        .map((x) => {
          const q = quemPediu.get(x.seguidor_id);
          /* Quem entrou em Modo Cuidado some da fila de pedidos, sem aviso. */
          if (!q || q.care_mode) return null;
          return {
            id: x.seguidor_id,
            nome: (q.display_name ?? "").trim() || "Alguém",
            avatarUrl: q.avatar_url ?? null,
          };
        })
        .filter(Boolean),
    };
  });

/** Ligar/desligar o perfil público e escrever a bio. */
export const salvarPerfilSocial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        publico: z.boolean().optional(),
        /* As duas chaves do selo. Opcionais e independentes: o update é
           parcial, então mandar uma não mexe na outra. */
        mostrarSemana: z.boolean().optional(),
        mostrarBebe: z.boolean().optional(),
        /* A caixinha. Opcional como as outras duas — o update é parcial. */
        aceitaPerguntas: z.boolean().optional(),
        bio: z.string().max(LIMITE_DA_BIO).nullable().optional(),
        nome: z.string().max(60).optional(),
        /** Data URL. O cliente já corta o quadrado e reduz para 512px. */
        avatar: z.string().max(1_500_000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ A foto vai para o balde `rede`, como as dos posts — e NÃO como data
       URL na coluna. `avatar_url` já aceita data URL neste app (é assim que o
       `campo-foto.tsx` grava), mas uma foto de perfil viaja em TODA leitura de
       lista: `minhasAmigas`, a lista de seguidores, cada post do feed. Em base64
       ela custa ~35% a mais e vai inteira em cada linha; como caminho no balde,
       vai uma URL assinada. */
    let avatarUrl: string | null | undefined = undefined;
    if (data.avatar !== undefined) {
      if (data.avatar === null) {
        avatarUrl = null;
      } else {
        const { guardarImagem, urlAssinada } = await import("@/lib/imagens.server");
        const caminho = await guardarImagem({
          balde: "rede",
          donoId: eu,
          dataUrl: data.avatar,
        });
        if (!caminho) return { ok: false as const, motivo: "imagem" as const };
        /* Validade longa: o avatar aparece em toda tela, e uma URL de 1h faria
           a foto sumir no meio da sessão. Uma semana, e a próxima leitura
           renova. */
        avatarUrl = await urlAssinada("rede", caminho, 7 * 24 * 3600);
      }
    }

    /* O que existe em qualquer banco. */
    const antigas = {
      ...(data.publico !== undefined ? { perfil_publico: data.publico } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.nome !== undefined && data.nome.trim() ? { display_name: data.nome.trim() } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    };
    /* As chaves que nasceram num `APLICAR_` que o dono roda à mão. */
    const novas = {
      ...(data.mostrarSemana !== undefined ? { mostrar_semana: data.mostrarSemana } : {}),
      ...(data.mostrarBebe !== undefined ? { mostrar_bebe: data.mostrarBebe } : {}),
      ...(data.aceitaPerguntas !== undefined ? { aceita_perguntas: data.aceitaPerguntas } : {}),
    };

    const { error } = await sb
      .from("patient_profiles")
      .update({ ...antigas, ...novas })
      .eq("id", eu);

    /* ⚠️ **RECUO PARA BANCO SEM AS COLUNAS NOVAS**, a mesma família de
       `perfisPorId` e `publicarPost` — e aqui ele faltava. O deploy chega antes
       do SQL, e sem isto um `42703` numa coluna de CHAVE derrubava o
       salvamento INTEIRO: ela trocava a foto, mudava a bio, tocava em salvar e
       recebia "não foi possível", sem nada na tela dizendo que o que quebrou
       foi um interruptor que ela nem mexeu.

       O recuo grava o que dá e devolve `ok`. ⚠️ Com `parcial: true`, para a
       tela não afirmar que o interruptor pegou: um botão que volta ao estado
       anterior é ruim, um botão que diz "salvo" e não salvou é pior. */
    if (error) {
      if (Object.keys(antigas).length === 0) {
        console.warn("[rede] chaves do perfil sem coluna — rode APLICAR_REDE_SOCIAL.sql");
        return { ok: false as const, motivo: "banco" as const };
      }
      const { error: erro2 } = await sb.from("patient_profiles").update(antigas).eq("id", eu);
      if (erro2) return { ok: false as const, motivo: "banco" as const };
      console.warn("[rede] chaves do perfil sem coluna — rode APLICAR_REDE_SOCIAL.sql");
      return { ok: true as const, parcial: true as const };
    }
    return { ok: true as const, parcial: false as const };
  });

/** O perfil de outra pessoa, com os posts que eu posso ver. */
/**
 * O PERFIL — e o ESPELHO.
 *
 * ─── "VER MEU PERFIL COMO VISITANTE" ───────────────────────────────────────
 *
 * Pedido do dono: "não podemos expor a paciente sem ela saber". O espelho é o
 * que transforma isso de promessa em verificação: ela vê a MESMA tela que uma
 * estranha, uma seguidora ou uma amiga veem.
 *
 * ⚠️ **É um MODO desta função, e não uma segunda montagem.** Uma tela de prévia
 * que montasse o perfil por conta própria divergiria desta no primeiro
 * conserto — e divergiria em silêncio, afirmando que uma visitante vê o que ela
 * não vê (ou pior: escondendo o que ela vê). Tudo que a prévia mostra passa
 * pelos MESMOS `podeVerPost`, `seloDe` e `montarPosts` da tela real.
 *
 * ⚠️ **E só funciona sobre o PRÓPRIO perfil.** `comoVisitante` com o id de
 * outra pessoa é ignorado — senão o espelho vira um jeito de perguntar ao
 * servidor "o que a Fulana esconde de mim?", que é o oposto do que ele existe
 * para fazer.
 */
export const verPerfil = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        alvoId: z.string().uuid(),
        /** O espelho. Só vale quando `alvoId` sou eu. */
        comoVisitante: z.enum(["estranha", "seguidora", "amiga"]).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);
    const perfis = await perfisPorId(sb, [data.alvoId]);
    const a = perfis.get(data.alvoId);

    /* ⚠️ A persona só vale sobre o meu próprio perfil — ver o cabeçalho. */
    const persona: Persona | null =
      data.comoVisitante && data.alvoId === eu ? (data.comoVisitante as Persona) : null;

    /* ⚠️ As três recusas devolvem o MESMO `indisponivel`: perfil inexistente,
       bloqueio e Modo Cuidado. Distinguir contaria à bloqueada que ela foi
       bloqueada, e contaria a perda de quem entrou em luto. */
    if (!a || a.care_mode || (ctx.bloqueio.has(data.alvoId) && data.alvoId !== eu)) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const { data: vinculo } = await sb
      .from("rede_seguidores")
      .select("estado")
      .eq("seguidor_id", eu)
      .eq("seguido_id", data.alvoId)
      .maybeSingle();

    /* ⚠️ **O PORTÃO DE ALCANCE, e ele vale para o visitante DE VERDADE.**
       Até a Fase 1 esta função nunca conferiu `perfil_publico`: com o uuid em
       mãos — e ele viaja em toda reação, todo story visto, todo pedido de
       seguir — qualquer paciente abria qualquer perfil, fechado ou não. A mesma
       Fase 1 pôs ali a idade gestacional e o nome do bebê, e o espelho passou a
       AFIRMAR uma tranca que não existia.

       A recusa é o MESMO `indisponivel` de bloqueio e Modo Cuidado: distinguir
       contaria à visitante que aquele perfil existe e está fechado. */
    const vinculoAtivo = ((vinculo as any)?.estado ?? null) === "ativo";
    const olho = persona ? olharDe(persona) : null;
    const alcanca = alcancaOPerfil({
      perfilPublico: !!a.perfil_publico,
      souEu: persona ? false : data.alvoId === eu,
      sigoAtivo: olho ? olho.sigoAtivo : vinculoAtivo,
      somosAmigas: olho ? olho.somosAmigas : ctx.amigas.has(data.alvoId),
    });
    if (!alcanca) {
      /* ⚠️ Só o ESPELHO distingue "trancado" de "indisponivel" — e ele só existe
         sobre o meu próprio perfil, então a distinção nunca vaza para terceiros.
         É o que permite a tela dizer "ela não consegue abrir" em vez de "não
         consegui montar a prévia". */
      return persona
        ? { ok: false as const, motivo: "trancado" as const }
        : { ok: false as const, motivo: "indisponivel" as const };
    }

    /* ⚠️ **O PERFIL MOSTRA TAMBÉM O QUE ELA FOI MARCADA** — é o ponto inteiro
       da marcação ("o post aparece nos dois perfis"). São duas consultas e não
       um `or()`: o PostgREST não faz junção de tabela dentro de `or`, e trazer
       as marcações por sub-select devolveria linhas duplicadas quando houvesse
       mais de uma marcada.

       ⚠️ E o que decide se cada post APARECE continua sendo `podeVerPost`, sobre
       a camada de QUEM PUBLICOU: estar marcada não amplia visibilidade
       nenhuma. Quem abre o perfil dela e não podia ver o post continua sem
       ver. */
    const marcados = await idsMarcadosDe(sb, data.alvoId);
    const [proprios, deMarcacao] = await Promise.all([
      postsCrus(sb, (base) =>
        base
          .eq("autor_id", data.alvoId)
          .is("arquivado_em", null)
          .order("criado_em", { ascending: false })
          .limit(POSTS_POR_PAGINA),
      ),
      marcados.length
        ? postsCrus(sb, (base) =>
            base
              .in("id", marcados)
              .is("arquivado_em", null)
              .order("criado_em", { ascending: false })
              .limit(POSTS_POR_PAGINA),
          )
        : Promise.resolve([]),
    ]);
    const porId = new Map<string, any>();
    for (const p of [...proprios, ...deMarcacao]) porId.set(p.id, p);
    const brutos = [...porId.values()]
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
      .slice(0, POSTS_POR_PAGINA);

    /* ⚠️ O olho da prévia é um SENTINELA, nunca o meu id: `podeVerPost`
       curto-circuita em `euId === post.autorId` ("a dona sempre vê os dela"), e
       com o meu id TODO post passaria — inclusive os da camada `amigas`. A tela
       afirmaria que uma seguidora vê o desabafo de terça, sem erro e sem log. */
    const previa = persona ? contextoDaPersona(persona, data.alvoId) : null;
    const posts = previa
      ? await montarPosts(sb, previa.euId, brutos, {
          sigo: previa.sigo,
          amigas: previa.amigas,
          bloqueio: previa.bloqueio,
        })
      : await montarPosts(sb, eu, brutos, ctx);

    const selo = await seloDe(a);
    /* ⚠️ `souEu` REAL, e não o forjado: sob a prévia ela é uma visitante, e a
       aba tem de mostrar o que a visitante veria. */
    const bebe = await bebeDe(a, !persona && data.alvoId === eu);

    /* A pílula do código só faz sentido no perfil de OUTRA pessoa: no meu, ela
       ofereceria que eu me indicasse. */
    const codigo = data.alvoId === eu ? null : await codigoDeEmbaixadora(sb, data.alvoId);
    /* ⚠️ `ref_code` é fixado UMA VEZ — quem já tem não pode aplicar outro, e a
       tela precisa saber disso ANTES de oferecer o botão. */
    const jaTenhoCodigo = await tenhoRefCode(sb, eu);

    const perfil: PerfilNaTela = {
      id: data.alvoId,
      nome: (a.display_name ?? "").trim() || "Alguém",
      bio: a.bio ?? null,
      avatarUrl: a.avatar_url ?? null,
      publico: !!a.perfil_publico,
      /* Sob a prévia, o vínculo é o da PERSONA — senão a tela mostraria
         "Editar perfil" no lugar de "Seguir" enquanto afirma ser a visão de
         uma estranha. */
      meuVinculo: persona
        ? persona === "estranha"
          ? null
          : ("ativo" as const)
        : (((vinculo as any)?.estado as "ativo" | "pendente") ?? null),
      souEu: persona ? false : data.alvoId === eu,
      /* ⚠️ `null` para terceiros — não existe contador público de seguidores.
         Um placar de audiência num app de gestação de alto risco mede
         popularidade num momento em que ela já está sendo medida clinicamente. */
      /* ⚠️ Era `0` CRAVADO, e a tela dizia "0 seguidores" logo acima de uma
         lista que abre com doze pessoas. O número existe em `meuPerfilSocial`
         desde sempre e nunca chegava aqui. */
      meusSeguidores: persona ? null : data.alvoId === eu ? await contarSeguidores(sb, eu) : null,
      /* ⚠️ Os selos passam pela MESMA régua na prévia e na tela real. Eles não
         dependem de quem olha — dependem das chaves —, e é justamente por isso
         que precisam estar aqui: era o campo que uma prévia feita só sobre
         `podeVerPost` desenharia sem nunca ter filtrado. */
      seloSemana: selo.semana,
      seloBebe: selo.bebe,
      /* ⚠️ As chaves são DELA, e só ela as recebe — a mesma régua do
         `meusSeguidores` logo acima. Num perfil de terceiro, `mostrarSemana:
         true` com `seloSemana: null` só acontece por três causas (o bebê
         nasceu, a DUM sumiu, passou de 42 semanas), e as três são informação
         que ninguém pediu para publicar. */
      codigoDeEmbaixadora: codigo,
      /* ⚠️ Nunca sob a prévia — ver o tipo. */
      possoAplicarOCodigo: !persona && !!codigo && !jaTenhoCodigo && data.alvoId !== eu,
      mostrarSemana: !persona && data.alvoId === eu ? !!a.mostrar_semana : false,
      mostrarBebe: !persona && data.alvoId === eu ? !!a.mostrar_bebe : false,
      bebe,
      /* ⚠️ Sob a PRÉVIA ele continua verdadeiro: a caixinha é exatamente o que
         uma visitante vê, e escondê-la do espelho faria a prévia mentir sobre
         a única porta que estranhos têm para escrever para ela. */
      aceitaPerguntas: !!a.aceita_perguntas,
      euSigo: persona ? null : data.alvoId === eu ? await contarSeguindo(sb, eu) : null,
    };

    return { ok: true as const, perfil, posts: ordenarFeed(posts) };
  });

/* ══════════════════════════════════════════════════════════════════════════
   SEGUIR
   ══════════════════════════════════════════════════════════════════════════ */

export const seguir = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), alvoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);
    const a = (await perfisPorId(sb, [data.alvoId])).get(data.alvoId);
    if (!a) return { ok: false as const, motivo: "indisponivel" as const };

    const estado = aoSeguir({
      euId: eu,
      alvo: {
        id: data.alvoId,
        nome: a.display_name ?? "",
        bio: null,
        avatarUrl: null,
        publico: !!a.perfil_publico,
        emCuidado: !!a.care_mode,
      },
      fuiBloqueada: ctx.bloqueio.has(data.alvoId),
    });
    if (!estado) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb.from("rede_seguidores").upsert(
      {
        seguidor_id: eu,
        seguido_id: data.alvoId,
        estado,
        aceito_em: estado === "ativo" ? new Date().toISOString() : null,
      },
      { onConflict: "seguidor_id,seguido_id" },
    );
    if (error) return { ok: false as const, motivo: "banco" as const };

    /* ⚠️ Só o PEDIDO manda push — reação e "começou a te seguir" não mandam.
       O push deste app é o mesmo canal do aviso de emergência, e quem desliga
       as notificações por causa de um coraçãozinho desliga o resto junto. */
    const especie = estado === "ativo" ? ("seguiu" as const) : ("pediu_para_seguir" as const);
    await registrarAtividade(sb, { donoId: data.alvoId, quemId: eu, especie });

    /* ⚠️ **Pela régua, e não por um `if` local.** `avisoMandaPush` existia com
       a decisão escrita e ZERO chamadores, enquanto aqui morava um
       `estado === "pendente"` que dizia a mesma coisa por acaso. Duas réguas
       para "isto merece push?" divergem no primeiro aviso novo — e a divergência
       gasta o canal por onde chega o aviso de emergência. */
    if (avisoMandaPush(especie)) {
      try {
        const { sendPushToUser } = await import("@/lib/push.server");
        const meu = (await perfisPorId(sb, [eu])).get(eu);
        await sendPushToUser(data.alvoId, {
          title: "Novo pedido",
          body: `${(meu?.display_name ?? "Alguém").trim()} quer te acompanhar`,
          url: "/minha-conta?tab=Comunidade",
        });
      } catch {
        /* Push é enfeite aqui: o pedido já está gravado e aparece na tela. */
      }
    }

    return { ok: true as const, estado };
  });

export const deixarDeSeguir = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), alvoId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Aqui o DELETE é o certo, e é a única exceção do arquivo: "deixei de
       seguir" não é um fato que alguém precise consultar depois, e guardar a
       linha faria a chave única impedir de seguir de novo. */
    const { error } = await sb
      .from("rede_seguidores")
      .delete()
      .eq("seguidor_id", eu)
      .eq("seguido_id", data.alvoId);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** Ela responde a um pedido de perfil privado. */
export const responderPedido = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        seguidorId: z.string().uuid(),
        aceitar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (data.aceitar) {
      const { error } = await sb
        .from("rede_seguidores")
        .update({ estado: "ativo", aceito_em: new Date().toISOString() })
        .eq("seguidor_id", data.seguidorId)
        .eq("seguido_id", eu)
        .eq("estado", "pendente");
      if (error) return { ok: false as const, motivo: "banco" as const };
      /* Quem pediu fica sabendo que foi aceita. */
      await registrarAtividade(sb, {
        donoId: data.seguidorId,
        quemId: eu,
        especie: "aceitou",
      });
    } else {
      /* ⚠️ Recusar APAGA. Marcar "recusado" bloquearia o par para sempre pela
         chave única, e quem pediu de novo depois de um mal-entendido nunca
         mais conseguiria. Mesma decisão de `APLICAR_DUPLAS.sql`. */
      const { error } = await sb
        .from("rede_seguidores")
        .delete()
        .eq("seguidor_id", data.seguidorId)
        .eq("seguido_id", eu)
        .eq("estado", "pendente");
      if (error) return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   POSTS E FEED
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O que a tela diz quando a régua clínica recusa um post, um story ou uma
 * opção de enquete.
 *
 * ⚠️ **Diz o que fazer em vez disso, e NUNCA qual palavra barrou.** Devolver
 * "sua publicação tem a palavra X" ensina a burlar em duas tentativas — e a
 * frase de emergência precisa oferecer o caminho que serve, não uma recusa.
 */
function recadoDeConteudo(d: "clinica" | "emergencia"): string {
  if (d === "emergencia") {
    return "Isso é assunto de atendimento agora — abra o SOS em vez de publicar.";
  }
  return "Aqui a gente conta a própria experiência, sem dizer o que a outra deve fazer. Quem orienta é o médico dela.";
}

export const publicarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        texto: z.string().max(LIMITE_DO_TEXTO).nullable(),
        /** Data URL. O cliente já reduz para 512px antes de mandar. */
        imagem: z.string().max(1_500_000).nullable(),
        /** As DEMAIS do carrossel. Até nove — a primeira vai em `imagem`. */
        extras: z.array(z.string().max(1_500_000)).max(9).optional(),
        visibilidade: z.enum(["publico", "seguidores", "amigas"]),
        /** 2 a 4 opções curtas, ou nada. */
        enquete: z.array(z.string().max(80)).max(6).optional(),
        /**
         * ⚠️ **`{ tema }`, e NUNCA `{ dia }`** — e este validador dizia o
         * contrário, o que quebrava publicar por completo.
         *
         * `AulaNoPost` é `{ tema }` desde que a régua decidiu que o dia
         * gestacional (D = semana × 7 + diaDaSemana) não sai do aparelho dela;
         * o compositor manda `{ tema }`; e o zod pedia `dia` obrigatório. O
         * `.parse()` é do objeto INTEIRO, então quem tocasse em "📚 Anexar a
         * aula de hoje" perdia a publicação inteira, com um "não deu para
         * publicar" que se repetiria para sempre.
         *
         * Nem `tsc` nem teste viam: `inputValidator` recebe `unknown`, e o
         * contrato de entrada era o único lugar do repo que ainda falava em
         * `dia`. Agora a validação é a MESMA régua da leitura (`aulaValida`).
         */
        aula: z
          .object({ tema: z.string().max(40) })
          .nullable()
          .optional(),
        /**
         * Quem estava junto.
         *
         * ⚠️ **O teto do zod NÃO é a régua** — é só um freio contra um corpo
         * absurdo. Quem decide é `marcadasPermitidas`, no servidor, com o que o
         * BANCO respondeu sobre cada uma (amizade, bloqueio, Modo Cuidado). Um
         * id forjado aqui poria o nome de qualquer paciente da plataforma
         * embaixo de uma foto que ela nunca viu.
         */
        marcadas: z.array(z.string().uuid()).max(20).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Modo Cuidado NÃO publica. O portão da tela some, mas um pedido montado
       à mão não passa pela tela.
       ⚠️ **Pela `euEmCuidado`, que falha FECHADO.** A versão anterior lia a
       coluna aqui e descartava o `error`: um timeout devolvia `data: null`,
       `?.care_mode` virava `undefined`, e a paciente em luto PUBLICAVA. Um
       portão que falha aberto é o mesmo que não existir — e este é o portão que
       o Modo Cuidado inteiro existe para ter. */
    if (await euEmCuidado(sb, eu)) return { ok: false as const, motivo: "indisponivel" as const };

    /* ⚠️ A enquete conta como conteúdo: um post que é SÓ a enquete é legítimo
       ("menino ou menina?" não precisa de foto nem de legenda), e sem isto ele
       seria recusado como vazio. */
    /* ⚠️ **A RÉGUA CLÍNICA RODA AQUI, e ela não rodava.**
       `pergunta-clinica.ts` protegia a caixinha e deixava o canal PRINCIPAL
       aberto — mesmo público, mesma tela, mesmo nome de consultório em volta, e
       com mais alcance que um comentário teria. Quem quisesse dar o conselho
       perigoso não usava a caixinha: publicava. Pior: a resposta triada da
       caixinha vira uma linha em `rede_posts`, a MESMA tabela que qualquer um
       escrevia sem triagem nenhuma.

       ⚠️ E vale para CADA OPÇÃO DA ENQUETE, não só para o texto. Uma enquete
       "[Vai pro PS agora · Espera passar · Liga pro médico]" faz catorze
       desconhecidas emitirem uma conduta obstétrica COM PLACAR — estritamente
       pior que um comentário, que é a opinião de uma pessoa. `desafio-em-grupo`
       já tinha tomado a decisão certa para o mesmo risco (catálogo fechado); a
       enquete repetiu o erro que o desafio evitou. */
    const opcoes = limparOpcoes(data.enquete ?? []);
    const { triarTexto } = await import("@/lib/pergunta-clinica");
    for (const trecho of [data.texto ?? "", ...opcoes]) {
      const desfecho = triarTexto(trecho);
      if (desfecho !== "publicavel") {
        return { ok: false as const, motivo: desfecho, recado: recadoDeConteudo(desfecho) };
      }
    }

    const temEnquete = opcoes.length > 0;
    if (temEnquete && !enqueteValida(opcoes)) {
      return { ok: false as const, motivo: "enquete" as const };
    }
    if (!temEnquete && !postEhValido({ texto: data.texto, temImagem: !!data.imagem })) {
      return { ok: false as const, motivo: "vazio" as const };
    }

    let caminho: string | null = null;
    const extras: string[] = [];
    if (data.imagem) {
      const { guardarImagem } = await import("@/lib/imagens.server");
      caminho = await guardarImagem({ balde: "rede", donoId: eu, dataUrl: data.imagem });
      /* Falhar aqui RECUSA o post inteiro. Publicar só o texto de um post que
         ela montou com foto entregaria uma coisa diferente da que ela mandou,
         e ela só descobriria olhando o feed. */
      if (!caminho) return { ok: false as const, motivo: "imagem" as const };

      /* ⚠️ E o mesmo vale para as DEMAIS: se a terceira de cinco falhar, o post
         inteiro é recusado. Publicar quatro de cinco entregaria um carrossel
         com um buraco no meio, e ela não teria como saber qual sumiu. */
      for (const extra of data.extras ?? []) {
        const c = await guardarImagem({ balde: "rede", donoId: eu, dataUrl: extra });
        if (!c) return { ok: false as const, motivo: "imagem" as const };
        extras.push(c);
      }
    }

    const { data: post, error } = await sb
      .from("rede_posts")
      .insert({
        autor_id: eu,
        texto: data.texto?.trim() || null,
        imagem_path: caminho,
        imagens: extras,
        visibilidade: data.visibilidade,
        enquete_opcoes: opcoes,
        /* ⚠️ Passa pela mesma régua de leitura: um `aula` malformado vindo do
           cliente não pode virar linha no banco que `aulaValida` depois
           recusaria — o post ficaria com uma coluna que ninguém desenha. */
        aula: data.aula && aulaValida(data.aula) ? data.aula : null,
      })
      .select("id")
      .single();

    /* ⚠️ Recuo para banco sem `enquete_opcoes`/`aula`, como em `perfisPorId` e
       `publicarStory`: o deploy chega antes do SQL, e sem isto PUBLICAR pararia
       de funcionar para todo mundo — não só a enquete. */
    if (error) {
      console.warn("[rede] post sem enquete/aula/pergunta — rode APLICAR_REDE_SOCIAL.sql");
      const { data: p2, error: erro2 } = await sb
        .from("rede_posts")
        .insert({
          autor_id: eu,
          texto: data.texto?.trim() || null,
          imagem_path: caminho,
          imagens: extras,
          visibilidade: data.visibilidade,
        })
        .select("id")
        .single();
      if (erro2 || !p2) return { ok: false as const, motivo: "banco" as const };
      await gravarMarcacoes(sb, eu, p2.id, data.marcadas ?? []);
      return { ok: true as const, postId: p2.id };
    }
    if (!post) return { ok: false as const, motivo: "banco" as const };

    /* ⚠️ DEPOIS de o post existir, e sem derrubá-lo se falhar: a publicação já
       aconteceu, e devolver "não deu para publicar" por causa de uma linha
       decorativa faria ela tentar de novo e publicar duas vezes. */
    await gravarMarcacoes(sb, eu, post.id, data.marcadas ?? []);

    return { ok: true as const, postId: post.id };
  });

/**
 * Grava as marcações de um post recém-publicado.
 *
 * ⚠️ **A LISTA DO CLIENTE É SÓ UM PEDIDO.** Cada id é conferido contra o BANCO:
 * o vínculo de amizade nos dois sentidos (`saoAmigas`), o bloqueio e o Modo
 * Cuidado. A régua está em `marcacoes.ts`, pura e testada; aqui só se coleta o
 * que ela precisa saber.
 *
 * ⚠️ **E ela NUNCA derruba a publicação.** Falhar aqui deixa o post sem a linha
 * "com Fulana", e nada mais.
 */
async function gravarMarcacoes(
  sb: any,
  eu: string,
  postId: string,
  pedidas: string[],
): Promise<void> {
  if (pedidas.length === 0) return;
  try {
    const { saoAmigas } = await import("@/lib/amigas.functions");
    const { marcadasPermitidas } = await import("@/lib/marcacoes");
    /* ⚠️ O conjunto de bloqueio vem do MESMO caminho que o feed usa
       (`contextoDe`), e não de uma consulta escrita à mão aqui — duas leituras
       do mesmo grafo divergem no primeiro conserto. */
    const ctx = await contextoDe(sb, eu);
    const perfis = await perfisPorId(sb, [...new Set(pedidas)]);

    const candidatas = [];
    for (const id of [...new Set(pedidas)]) {
      const p = perfis.get(id);
      candidatas.push({
        id,
        souEu: id === eu,
        somosAmigas: id === eu ? false : await saoAmigas(sb, eu, id),
        bloqueio: ctx.bloqueio.has(id),
        /* Perfil que não veio conta como indisponível — falhar FECHADO. */
        emCuidado: !p || !!p.care_mode,
      });
    }

    const ok = marcadasPermitidas(candidatas);
    if (ok.length === 0) return;
    const { error } = await sb
      .from("rede_marcacoes")
      .insert(ok.map((quem_id) => ({ post_id: postId, quem_id })));
    if (error) {
      console.warn("[rede] sem rede_marcacoes — rode APLICAR_REDE_SOCIAL.sql");
      return;
    }
    for (const quem of ok) {
      await registrarAtividade(sb, { donoId: quem, quemId: eu, especie: "marcou", postId });
    }
  } catch (e) {
    console.error("[rede] marcações não gravaram", e);
  }
}

/**
 * TIRAR A PRÓPRIA MARCAÇÃO.
 *
 * ⚠️ **É a marcada quem tira, e SÓ ela.** Ter o próprio nome numa foto de
 * gestação de outra pessoa não é decisão de quem publicou — sem esta saída, a
 * única defesa dela seria pedir à amiga que apagasse o post inteiro.
 *
 * ⚠️ **E o `eq("quem_id", eu)` É O PORTÃO.** Sem ele, qualquer `postId` +
 * `quemId` no corpo do pedido tiraria a marcação de outra pessoa — e a amiga
 * marcada sumiria do post sem nunca ter pedido.
 *
 * ⚠️ **Ninguém é avisado.** Quem publicou não recebe "Fulana tirou a marcação":
 * é a mesma decisão do bloqueio e da saída de amizade — transformar um gesto
 * privado num aviso transforma uma escolha numa briga.
 */
export const tirarMinhaMarcacao = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { error } = await sb
      .from("rede_marcacoes")
      .delete()
      .eq("post_id", data.postId)
      .eq("quem_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * Quem eu posso marcar — a lista que abre no compositor.
 *
 * ⚠️ **NUNCA UMA BUSCA.** É a lista do grafo que já existe, e é ela que torna a
 * marcação segura sem moderação: para aparecer aqui, uma das duas já convidou a
 * outra. Busca por nome transformaria a base de pacientes numa lista navegável.
 *
 * ⚠️ **Quem está em Modo Cuidado não aparece, e a tela não diz por quê** — do
 * lado de quem marca, a amiga simplesmente não está na lista. É a mesma decisão
 * da aba de Amigas: "Fulana saiu" contaria a perda dela para outra pessoa.
 */
export const amigasParaMarcar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      const { idsDasAmigas } = await import("@/lib/amigas.functions");
      const r = await idsDasAmigas(sb, eu);
      /* ⚠️ Grafo degradado devolve lista VAZIA, nunca "todo mundo". Numa régua
         de quem pode ser exposta, errar para o lado de não oferecer é a única
         direção segura. */
      if ((r as any).degradada) return { ok: true as const, amigas: [] };
      const ids = [...((r as any).todas as Iterable<string>)].filter((x) => x !== eu);
      if (ids.length === 0) return { ok: true as const, amigas: [] };

      const ctx = await contextoDe(sb, eu);
      const perfis = await perfisPorId(sb, ids);
      const amigas = ids
        .map((id) => ({ id, p: perfis.get(id) }))
        .filter(({ id, p }) => p && !p.care_mode && !ctx.bloqueio.has(id))
        .map(({ id, p }) => ({
          id,
          nome: (p!.display_name ?? "").trim() || "Alguém",
          avatar: (p as any)!.avatar_url ?? null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return { ok: true as const, amigas };
    } catch {
      return { ok: true as const, amigas: [] };
    }
  });

export const apagarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Marca, não apaga: as reações apontam para o post, e um DELETE levaria
       junto o registro de quem esteve ali. O `.eq("autor_id")` é o que impede
       apagar post alheio — o id vem do cliente. */
    const { error } = await sb
      .from("rede_posts")
      .update({ arquivado_em: new Date().toISOString() })
      .eq("id", data.postId)
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** O feed: posts de quem eu sigo, das minhas amigas, e os meus. */
export const meuFeed = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        antesDe: z.string().max(40).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ O portão do Modo Cuidado de QUEM LÊ — ver `euEmCuidado`. */
    if (await euEmCuidado(sb, eu)) {
      return { ok: true as const, posts: [] as PostNaTela[], proximo: null };
    }
    const ctx = await contextoDe(sb, eu);
    const de = [...new Set([eu, ...ctx.sigo, ...ctx.amigas])].filter(
      (id) => !ctx.bloqueio.has(id) || id === eu,
    );

    const brutos = await postsCrus(sb, (base) => {
      const q = base
        .in("autor_id", de)
        .is("arquivado_em", null)
        .order("criado_em", { ascending: false })
        /* Puxa mais do que cabe na página: a régua ainda vai FILTRAR (Modo
           Cuidado, perfil fechado depois de publicar), e sem folga uma página
           voltaria com três posts. */
        .limit(POSTS_POR_PAGINA * 2);
      return data.antesDe ? q.lt("criado_em", data.antesDe) : q;
    });
    const posts = await montarPosts(sb, eu, brutos, ctx);
    const pagina = ordenarFeed(posts).slice(0, POSTS_POR_PAGINA);

    return {
      ok: true as const,
      posts: pagina,
      /* O cursor sai do ÚLTIMO da página, não do último bruto: senão a página
         seguinte pularia os que a régua filtrou. */
      proximo: pagina.length === POSTS_POR_PAGINA ? pagina[pagina.length - 1].criadoEm : null,
    };
  });

/* ══════════════════════════════════════════════════════════════════════════
   REAÇÕES
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
   SUGERIDO PARA VOCÊ
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Quantas pessoas que EU sigo seguem cada uma destas.
 *
 * ⚠️ **Uma consulta só, e nunca uma por candidata.** Com uma por pessoa, uma
 * zona de dez sugestões custaria dez idas ao banco — e a zona abre no fim de
 * todo feed. A régua da ordem mora em `sugestoes.ts`; aqui é só a contagem.
 */
async function elosEmComum(sb: any, quemEuSigo: string[]): Promise<Map<string, number>> {
  const elos = new Map<string, number>();
  if (quemEuSigo.length === 0) return elos;
  const { data } = await sb
    .from("rede_seguidores")
    .select("seguido_id")
    .in("seguidor_id", quemEuSigo)
    .eq("estado", "ativo")
    .limit(2000);
  for (const l of (data ?? []) as { seguido_id: string }[]) {
    elos.set(l.seguido_id, (elos.get(l.seguido_id) ?? 0) + 1);
  }
  return elos;
}

/**
 * A ZONA DE SUGESTÕES — publicações e pessoas que ela ainda não segue.
 *
 * ⚠️ **O pool é estreito de propósito, e são três filtros, não um.** Perfil
 * PÚBLICO (a chave que diz, na tela dela, "qualquer pessoa no app pode te achar
 * e te acompanhar"), publicação na camada PÚBLICO (as duas são separadas, e a
 * separação é o recurso: perfil aberto com post `amigas` é o caso normal), e a
 * régua `podeVerPost` por cima de tudo — uma régua só, sempre.
 *
 * ⚠️ **Não aparece quem ela já segue, nem quem tem pedido pendente.** Sugerir
 * alguém para quem ela já mandou pedido é o app esquecendo o que ela acabou de
 * fazer.
 *
 * ⚠️ **Modo Cuidado e bloqueio saem pelos dois lados**, como no feed. E ela
 * nunca é sugerida para si mesma.
 */
export const sugestoesDoFeed = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Mesmo portão do feed — ver `euEmCuidado`. */
    if (await euEmCuidado(sb, eu)) {
      return { ok: true as const, posts: [] as PostNaTela[], pessoas: [] as PessoaNaLista[] };
    }
    const ctx = await contextoDe(sb, eu);

    /* Pedido pendente também tira da lista — ver o cabeçalho. */
    const { data: pendentesMeus } = await sb
      .from("rede_seguidores")
      .select("seguido_id")
      .eq("seguidor_id", eu)
      .eq("estado", "pendente");
    const jaPedi = new Set(
      ((pendentesMeus ?? []) as { seguido_id: string }[]).map((l) => l.seguido_id),
    );

    const fora = (id: string) =>
      id === eu || ctx.sigo.has(id) || ctx.bloqueio.has(id) || jaPedi.has(id);

    /* As candidatas a autora: perfil público, fora do meu círculo, sem Modo
       Cuidado. `podeAparecerNaBusca` é a MESMA régua da busca — quem não pode
       ser encontrada também não pode ser sugerida, senão a sugestão vira a
       porta dos fundos da busca. */
    const { data: publicos } = await sb
      .from("patient_profiles")
      .select("id, display_name, avatar_url, bio, perfil_publico, care_mode, last_seen_at")
      .eq("perfil_publico", true)
      .limit(400);

    const candidatas = ((publicos ?? []) as any[]).filter(
      (p) =>
        !fora(p.id) &&
        podeAparecerNaBusca({ publico: !!p.perfil_publico, emCuidado: !!p.care_mode }),
    );
    if (candidatas.length === 0) {
      return { ok: true as const, posts: [], sugeridos: [] as string[], pessoas: [] };
    }

    const elos = await elosEmComum(sb, [...ctx.sigo]);

    /* O ranking das autoras sai UMA vez e serve às duas coisas: a fileira de
       pessoas (as primeiras) e o recorte da consulta de publicações (todas). */
    const ranking = ordenarPessoas(
      candidatas.map((p) => ({
        id: p.id,
        elosEmComum: elos.get(p.id) ?? 0,
        ultimaVez: p.last_seen_at ?? null,
      })),
      AUTORAS_CONSULTADAS,
    );
    const ids = ranking.map((p) => p.id);

    const brutos = await postsCrus(sb, (base) =>
      base
        .in("autor_id", ids)
        .eq("visibilidade", "publico")
        .is("arquivado_em", null)
        .order("criado_em", { ascending: false })
        /* Folga: a régua ainda filtra, e o teto por autora ainda poda. */
        .limit(SUGESTOES_POR_LEVA * 6),
    );

    const escolhidas = ordenarSugestoes(
      brutos.map((p) => ({
        postId: p.id,
        autorId: p.autor_id,
        criadoEm: p.criado_em,
        elosEmComum: elos.get(p.autor_id) ?? 0,
      })),
      Date.now(),
    );
    const porId = new Map(((brutos ?? []) as any[]).map((p) => [p.id, p]));
    /* ⚠️ `montarPosts` DE NOVO, e não um atalho: é ela que aplica `podeVerPost`,
       assina as URLs das fotos e traz reações e salvos. Montar o post à mão aqui
       seria a segunda régua de visibilidade do arquivo. */
    const posts = await montarPosts(
      sb,
      eu,
      escolhidas.map((c) => porId.get(c.postId)).filter(Boolean),
      ctx,
    );
    /* A ORDEM da régua, não a do banco: `montarPosts` devolve na ordem que
       recebeu, mas `ordenarFeed` (cronológica) desfaria o ranqueamento. */
    const ordem = new Map(escolhidas.map((c, n) => [c.postId, n]));
    posts.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));

    const pessoas = ranking.slice(0, PESSOAS_SUGERIDAS).map((p) => {
      const perfil = candidatas.find((c) => c.id === p.id);
      return {
        id: p.id,
        nome: (perfil?.display_name ?? "").trim() || "Alguém",
        bio: perfil?.bio ?? null,
        avatarUrl: perfil?.avatar_url ?? null,
        /* ⚠️ `sigo` é sempre `null` aqui: quem eu sigo não entra no pool. E o
           número de elos NÃO viaja para o cliente — ele ordenou, e acabou. */
        sigo: null,
        souEu: false,
      } satisfies PessoaNaLista;
    });

    return {
      ok: true as const,
      posts,
      /* Os ids que a tela precisa rotular "Sugerido para você". */
      sugeridos: posts.map((p) => p.id),
      pessoas,
    };
  });

export const reagir = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        /** `null` tira a reação. */
        tipo: z.string().max(20).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (data.tipo === null) {
      /* Falhar em silêncio deixaria a reação lá: a tela apagaria o botão, o
         banco manteria a linha, e a próxima abertura a traria de volta. */
      const { error } = await sb
        .from("rede_reacoes")
        .delete()
        .eq("post_id", data.postId)
        .eq("quem_id", eu);
      if (error) return { ok: false as const, motivo: "banco" as const };
      return { ok: true as const };
    }

    if (!reacaoConhecida(data.tipo)) return { ok: false as const, motivo: "tipo" as const };

    /* ⚠️ REAGIR EXIGE PODER VER O POST, e essa conferência não é formalidade:
       sem ela, um `postId` sorteado que respondesse 200 confirmaria a
       existência de um post privado — vazamento pela porta dos fundos. */
    const { data: post } = await sb
      .from("rede_posts")
      .select("id, autor_id, visibilidade")
      .eq("id", data.postId)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    const ctx = await contextoDe(sb, eu);
    const a = (await perfisPorId(sb, [(post as any).autor_id])).get((post as any).autor_id);
    const pode =
      !!a &&
      podeVerPost({
        post: { autorId: (post as any).autor_id, visibilidade: (post as any).visibilidade },
        euId: eu,
        autor: { emCuidado: !!a.care_mode, publico: !!a.perfil_publico },
        bloqueado: ctx.bloqueio.has((post as any).autor_id),
        sigoAtivo: ctx.sigo.has((post as any).autor_id),
        somosAmigas: ctx.amigas.has((post as any).autor_id),
      });
    if (!pode) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb
      .from("rede_reacoes")
      .upsert(
        { post_id: data.postId, quem_id: eu, tipo: data.tipo },
        { onConflict: "post_id,quem_id" },
      );
    if (error) return { ok: false as const, motivo: "banco" as const };

    await registrarAtividade(sb, {
      donoId: (post as any).autor_id,
      quemId: eu,
      especie: "reagiu",
      postId: data.postId,
    });
    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   BLOQUEIO E DESCOBERTA
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * VOTAR numa enquete.
 *
 * ⚠️ **Confere que eu podia VER o post antes de gravar**, pela mesma razão de
 * `reagir`: sem isso, um `postId` sorteado que respondesse 200 confirmaria a
 * existência de um post privado.
 *
 * ⚠️ **E o voto NÃO se troca.** A PK `(post_id, quem_id)` garante um por
 * pessoa, e aqui o `insert` com `ignoreDuplicates` faz a segunda tentativa ser
 * um não-evento silencioso: uma enquete cujo voto se troca vira um placar que
 * muda de dono no último minuto, e quem já votou não tem por que voltar.
 */
export const votar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        opcao: z.number().int().min(0).max(3),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: post } = await sb
      .from("rede_posts")
      .select("id, autor_id, visibilidade, enquete_opcoes")
      .eq("id", data.postId)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    /* A opção precisa existir NESTA enquete — não basta caber no CHECK. */
    const opcoes = ((post as any).enquete_opcoes ?? []) as string[];
    if (data.opcao >= opcoes.length) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const ctx = await contextoDe(sb, eu);
    const a = (await perfisPorId(sb, [(post as any).autor_id])).get((post as any).autor_id);
    const pode =
      !!a &&
      podeVerPost({
        post: { autorId: (post as any).autor_id, visibilidade: (post as any).visibilidade },
        euId: eu,
        autor: { emCuidado: !!a.care_mode, publico: !!a.perfil_publico },
        bloqueado: ctx.bloqueio.has((post as any).autor_id),
        sigoAtivo: ctx.sigo.has((post as any).autor_id),
        somosAmigas: ctx.amigas.has((post as any).autor_id),
      });
    if (!pode) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb
      .from("rede_votos")
      .insert({ post_id: data.postId, quem_id: eu, opcao: data.opcao });
    /* Colidir na PK é SUCESSO REPETIDO: ela já votou, e devolver erro faria a
       tela pedir que tentasse de novo. Mesma decisão da `idem_key` do chá. */
    if (error && !String(error.code ?? "").startsWith("23")) {
      return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });

export const bloquear = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        alvoId: z.string().uuid(),
        bloquear: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    if (eu === data.alvoId) return { ok: false as const, motivo: "indisponivel" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!data.bloquear) {
      await sb.from("rede_bloqueios").delete().eq("quem_id", eu).eq("bloqueado_id", data.alvoId);
      return { ok: true as const };
    }

    /* ⚠️ **A ORDEM AQUI É A GARANTIA, e ela substitui um rollback.**
       Bloquear são DUAS escritas — desfazer o seguir e gravar o bloqueio — e
       não há transação entre elas. A primeira versão gravava o bloqueio antes
       e desfazia o seguir depois, com um rollback no erro; mas um rollback é
       mais uma escrita que pode falhar, e falhando ela deixa exatamente o
       estado que veio evitar.

       Desfazer o seguir PRIMEIRO torna o rollback desnecessário, porque os
       dois estados intermediários passam a ser assimétricos:

         · falha no seguir  → nada foi escrito. Ela vê o erro e tenta de novo.
         · falha no bloqueio → ela deixou de seguir e não bloqueou. Chato, e
           inofensivo: é o gesto MENOR, e ela vê o erro.

       O estado que não pode existir — bloqueio gravado com a linha de seguir
       viva, ressuscitando o vínculo no dia em que ela desbloquear — deixou de
       ser alcançável. Meio bloqueio é pior que nenhum, porque ela acha que
       está protegida. */
    const { error: erroSeguir } = await sb
      .from("rede_seguidores")
      .delete()
      .or(
        `and(seguidor_id.eq.${eu},seguido_id.eq.${data.alvoId}),and(seguidor_id.eq.${data.alvoId},seguido_id.eq.${eu})`,
      );
    if (erroSeguir) return { ok: false as const, motivo: "banco" as const };

    const { error } = await sb
      .from("rede_bloqueios")
      .upsert({ quem_id: eu, bloqueado_id: data.alvoId }, { onConflict: "quem_id,bloqueado_id" });
    if (error) return { ok: false as const, motivo: "banco" as const };

    return { ok: true as const };
  });

/** A busca — só perfil público. */
export const buscarPerfis = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), termo: z.string().max(60) }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const termo = normalizarBusca(data.termo);
    if (termo.length < MINIMO_DA_BUSCA) return { ok: true as const, perfis: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ `.eq("perfil_publico", true)` na CONSULTA, não num filtro depois: quem
       não abriu o perfil não pode nem viajar pela rede. É o portão que preserva
       o desenho original da aba — o grafo fechado por indicação. */
    const { data: linhas } = await sb
      .from("patient_profiles")
      .select("id, display_name, avatar_url, bio, perfil_publico, care_mode")
      .eq("perfil_publico", true)
      .ilike("display_name", trechoParaLike(data.termo.trim()))
      .limit(20);

    const ctx = await contextoDe(sb, eu);
    return {
      ok: true as const,
      perfis: ((linhas ?? []) as any[])
        .filter(
          (p) =>
            p.id !== eu &&
            !ctx.bloqueio.has(p.id) &&
            podeAparecerNaBusca({ publico: !!p.perfil_publico, emCuidado: !!p.care_mode }),
        )
        .map((p) => ({
          id: p.id,
          nome: (p.display_name ?? "").trim() || "Alguém",
          bio: p.bio ?? null,
          avatarUrl: p.avatar_url ?? null,
          publico: true,
          meuVinculo: (ctx.sigo.has(p.id) ? "ativo" : null) as "ativo" | null,
          souEu: false,
          meusSeguidores: null,
        })),
    };
  });

/** O catálogo, para a tela não reescrever os emojis. */
export const CATALOGO_DE_REACOES = REACOES;

/* ══════════════════════════════════════════════════════════════════════════
   AS LISTAS DE GENTE — seguidores e seguindo
   ══════════════════════════════════════════════════════════════════════════ */

export type PessoaNaLista = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Eu sigo esta pessoa? Para o botão da linha já nascer certo. */
  sigo: "ativo" | "pendente" | null;
  souEu: boolean;
};

/**
 * Quem segue alguém, ou quem alguém segue.
 *
 * ⚠️ **Só a DONA vê as listas dela.** No Instagram qualquer um abre a lista de
 * seguidores de um perfil público; aqui não, e é a mesma razão pela qual o
 * contador não é público: a lista de quem acompanha uma gestante de alto risco
 * é o círculo social dela, e expô-la a estranhos é entregar de quem ela é
 * próxima para quem só quis olhar um perfil.
 *
 * A dona vê as duas listas — é informação dela sobre a rede dela, e é o que
 * torna possível remover alguém que ela não quer mais por perto.
 */
export const listaDeGente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        tipo: z.enum(["seguidores", "seguindo"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const ctx = await contextoDe(sb, eu);

    /* `seguidores` = quem tem `seguido_id = eu`; `seguindo` = o inverso. */
    const coluna = data.tipo === "seguidores" ? "seguido_id" : "seguidor_id";
    const outra = data.tipo === "seguidores" ? "seguidor_id" : "seguido_id";

    const { data: linhas } = await sb
      .from("rede_seguidores")
      .select(`${outra}, criado_em`)
      .eq(coluna, eu)
      .eq("estado", "ativo")
      .order("criado_em", { ascending: false })
      .limit(200);

    const ids = ((linhas ?? []) as any[]).map((l) => l[outra]).filter(Boolean);
    const perfis = await perfisPorId(sb, ids);

    const gente: PessoaNaLista[] = ids
      .map((id: string) => {
        const p = perfis.get(id);
        /* ⚠️ Modo Cuidado e bloqueio somem da lista, sem anunciar — a mesma
           régua de `minhasAmigas`. Quem entrou em luto não vira uma linha
           faltando com explicação; vira uma linha que não está lá. */
        if (!p || p.care_mode || ctx.bloqueio.has(id)) return null;
        return {
          id,
          nome: (p.display_name ?? "").trim() || "Alguém",
          bio: p.bio ?? null,
          avatarUrl: p.avatar_url ?? null,
          sigo: ctx.sigo.has(id) ? ("ativo" as const) : null,
          souEu: id === eu,
        };
      })
      .filter(Boolean) as PessoaNaLista[];

    return { ok: true as const, gente };
  });

/**
 * Um post só, para a tela que abre ao tocar na grade.
 *
 * ⚠️ Passa pela MESMA `podeVerPost` do feed. Sem isso, um id de post
 * adivinhado devolveria conteúdo da camada restrita de qualquer pessoa — o
 * caminho mais óbvio para vazar o que o feed protege.
 */
export const verPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [bruto] = await postsCrus(sb, (base) =>
      base.eq("id", data.postId).is("arquivado_em", null).limit(1),
    );
    if (!bruto) return { ok: false as const, motivo: "indisponivel" as const };

    const ctx = await contextoDe(sb, eu);
    const [post] = await montarPosts(sb, eu, [bruto], ctx);
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    return { ok: true as const, post };
  });

/* ══════════════════════════════════════════════════════════════════════════
   STORIES — a foto que some em 24 horas
   ══════════════════════════════════════════════════════════════════════════ */

export type StoryNaTela = {
  id: string;
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  imagemUrl: string | null;
  texto: string | null;
  criadoEm: string;
  visto: boolean;
  /**
   * "28 semanas" no canto da foto, ou `null`.
   *
   * ⚠️ **DERIVADO na leitura, nunca guardado.** O banco tem só um booleano: a
   * semana sai da régua no instante em que alguém abre o story. Guardar o
   * texto faria a semana sobreviver à decisão dela — e uma paciente que entra
   * em Modo Cuidado depois de publicar teria a semana pendurada num arquivo
   * que o app não sabe mais apagar.
   */
  carimbo: string | null;
  /** A enquete de duas a quatro opções, ou `null`. */
  enquete: EnqueteDoStory | null;
  /**
   * A caixinha aberta neste story.
   *
   * ⚠️ **Não é uma segunda caixinha.** A pergunta cai na MESMA `rede_perguntas`
   * e passa pela MESMA `decidirPergunta` — o story é só outra porta para a
   * caixinha que já existe, e é a porta com a menor barreira (um toque).
   */
  perguntaAberta: boolean;
};

/** Um autor e os stories vivos dele — é assim que a fileira desenha. */
export type EnqueteDoStory = {
  opcoes: string[];
  /** Só NÚMEROS — nunca quem votou. É a mesma decisão da enquete do post. */
  votos: number[];
  /** O índice em que EU votei, ou `null`. Só o meu. */
  meuVoto: number | null;
};

export type BolhaDeStory = {
  autorId: string;
  autorNome: string;
  autorAvatar: string | null;
  /** Algum ainda não visto? É o que acende o anel. */
  novo: boolean;
  stories: StoryNaTela[];
};

export const publicarStory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        imagem: z.string().max(1_500_000),
        texto: z.string().max(200).nullable(),
        /** A semana no canto da foto. Escolha POR PUBLICAÇÃO — ver a régua. */
        carimbarSemana: z.boolean().optional(),
        /** 2 a 4 opções curtas, ou nada. A régua é a MESMA do post. */
        enquete: z.array(z.string().max(60)).max(6).optional(),
        /** Abrir a caixinha neste story. */
        perguntaAberta: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Modo Cuidado não publica — o mesmo portão de `publicarPost`, e pelo mesmo
       motivo: um pedido montado à mão não passa pela tela. E pela MESMA função,
       que falha fechado. */
    if (await euEmCuidado(sb, eu)) return { ok: false as const, motivo: "indisponivel" as const };

    /* ⚠️ A MESMA régua do post — o story tem texto, e some em 24h, o que o
       torna MAIS atraente para quem quer dar conselho e não quer o registro. */
    {
      const { triarTexto } = await import("@/lib/pergunta-clinica");
      const desfecho = triarTexto(data.texto ?? "");
      if (desfecho !== "publicavel") {
        return { ok: false as const, motivo: desfecho, recado: recadoDeConteudo(desfecho) };
      }
    }

    const { guardarImagem } = await import("@/lib/imagens.server");
    const caminho = await guardarImagem({ balde: "rede", donoId: eu, dataUrl: data.imagem });
    if (!caminho) return { ok: false as const, motivo: "imagem" as const };

    /* ⚠️ A RÉGUA DA ENQUETE É A MESMA DO POST (`limparOpcoes` +
       `enqueteValida`) — nunca uma segunda condição escrita aqui, que aceitaria
       o que a outra tela recusa. */
    const opcoes = limparOpcoes(data.enquete ?? []);
    const enquete = enqueteValida(opcoes) ? opcoes : null;

    /* ⚠️ E A TRIAGEM CLÍNICA CORRE NAS OPÇÕES TAMBÉM, como já corria no texto:
       "menino ou menina?" é inofensivo, "posso tomar buscopan?" não é — e uma
       enquete é exatamente o formato que faz meia dúzia de leigas responderem. */
    if (enquete) {
      const { triarTexto } = await import("@/lib/pergunta-clinica");
      for (const o of enquete) {
        const d = triarTexto(o);
        if (d !== "publicavel") {
          return { ok: false as const, motivo: d, recado: recadoDeConteudo(d) };
        }
      }
    }

    const base = { autor_id: eu, imagem_path: caminho, texto: data.texto };
    /* ⚠️ TRÊS DEGRAUS, um por leva de colunas — o mesmo desenho da leitura.
       Um recuo que pulasse direto para o mínimo faria quem já rodou o SQL do
       carimbo perdê-lo por causa do SQL da enquete. */
    const { error } = await sb.from("rede_stories").insert({
      ...base,
      carimbo_semana: data.carimbarSemana === true,
      enquete_opcoes: enquete,
      pergunta_aberta: data.perguntaAberta === true,
    });
    if (error) {
      console.warn("[rede] story sem enquete/pergunta — rode APLICAR_REDE_SOCIAL.sql");
      const { error: erro2 } = await sb
        .from("rede_stories")
        .insert({ ...base, carimbo_semana: data.carimbarSemana === true });
      if (erro2) {
        console.warn("[rede] story sem carimbo_semana — rode APLICAR_REDE_SOCIAL.sql");
        const { error: erro3 } = await sb.from("rede_stories").insert(base);
        if (erro3) return { ok: false as const, motivo: "banco" as const };
      }
    }
    return { ok: true as const };
  });

/**
 * A fileira de bolinhas.
 *
 * ⚠️ **A MINHA vem primeiro, sempre — mesmo sem story.** É a bolinha do
 * "adicionar", e o Instagram faz assim porque ela é o convite: sem ela na
 * primeira posição, publicar um story vira uma função escondida.
 *
 * ⚠️ E os expirados NÃO são apagados aqui. A consulta filtra por `expira_em`;
 * a linha morta fica no banco até alguém varrer. Apagar na leitura faria uma
 * consulta de tela virar escrita, e uma tela que apaga dado é uma tela que
 * apaga dado quando não devia.
 */
export const storiesDoFeed = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Mesmo portão do feed — ver `euEmCuidado`. */
    if (await euEmCuidado(sb, eu)) return { ok: true as const, bolhas: [] as BolhaDeStory[] };
    const ctx = await contextoDe(sb, eu);
    const de = [...new Set([eu, ...ctx.sigo, ...ctx.amigas])].filter(
      (id) => !ctx.bloqueio.has(id) || id === eu,
    );

    const agora = new Date().toISOString();
    /* ⚠️ **RECUO, como o de `publicarStory` — e ele faltava justamente aqui.**
       `carimbo_semana` nasceu DENTRO do `CREATE TABLE IF NOT EXISTS`, então num
       banco que já tinha `rede_stories` a coluna nunca foi criada (e re-rodar o
       SQL não a criava: o `CREATE` vira no-op). Sem o recuo, o `42703`
       devolvia `data: null` e a fileira ficava com uma bolinha só — a "Seu
       story", que o cliente sintetiza —, para sempre, sem erro na tela. */
    const linhas = await (async (): Promise<any[]> => {
      const monta = (base: any) =>
        base
          .in("autor_id", de)
          .gt("expira_em", agora)
          .order("criado_em", { ascending: true })
          .limit(200);
      /* ⚠️ TRÊS DEGRAUS DE RECUO, um por leva de colunas — e não um só. Um
         recuo que pulasse direto para o mínimo apagaria o carimbo da semana de
         quem já rodou aquele SQL, só porque o SQL da enquete ainda não rodou.
         Cada degrau tira exatamente o que faltou. */
      const cheio = await monta(
        sb
          .from("rede_stories")
          .select(
            "id, autor_id, imagem_path, texto, criado_em, carimbo_semana, enquete_opcoes, pergunta_aberta",
          ),
      );
      if (!cheio.error) return (cheio.data ?? []) as any[];

      console.warn("[rede] stories sem enquete/pergunta — rode APLICAR_REDE_SOCIAL.sql");
      const comCarimbo = await monta(
        sb
          .from("rede_stories")
          .select("id, autor_id, imagem_path, texto, criado_em, carimbo_semana"),
      );
      if (!comCarimbo.error) {
        return ((comCarimbo.data ?? []) as any[]).map((l) => ({
          ...l,
          enquete_opcoes: null,
          pergunta_aberta: false,
        }));
      }

      console.warn("[rede] stories sem carimbo_semana — rode APLICAR_REDE_SOCIAL.sql");
      const { data: velhos } = await monta(
        sb.from("rede_stories").select("id, autor_id, imagem_path, texto, criado_em"),
      );
      return ((velhos ?? []) as any[]).map((l) => ({
        ...l,
        carimbo_semana: false,
        enquete_opcoes: null,
        pergunta_aberta: false,
      }));
    })();
    const perfis = await perfisPorId(sb, [...new Set(linhas.map((l) => l.autor_id))]);

    const { data: vistos } = await sb
      .from("rede_stories_vistos")
      .select("story_id")
      .eq("quem_id", eu)
      .in(
        "story_id",
        linhas.map((l) => l.id),
      );
    const jaVi = new Set(((vistos ?? []) as { story_id: string }[]).map((v) => v.story_id));

    /* Os votos das enquetes, de todos os stories da fileira de uma vez. */
    const votosPorStory = new Map<string, number[]>();
    const meuVotoNo = new Map<string, number>();
    try {
      const { data: vs } = await sb
        .from("rede_story_votos")
        .select("story_id, quem_id, opcao")
        .in(
          "story_id",
          linhas.map((l) => l.id),
        );
      for (const v of (vs ?? []) as { story_id: string; quem_id: string; opcao: number }[]) {
        const atual = votosPorStory.get(v.story_id) ?? [0, 0, 0, 0];
        if (v.opcao >= 0 && v.opcao < atual.length) atual[v.opcao] += 1;
        votosPorStory.set(v.story_id, atual);
        if (v.quem_id === eu) meuVotoNo.set(v.story_id, v.opcao);
      }
    } catch {
      /* Sem a tabela ainda, a enquete aparece zerada em vez de sumir: o desenho
         que ela publicou continua na tela, e o voto passa a contar quando o SQL
         rodar. */
    }

    const { urlAssinada } = await import("@/lib/imagens.server");
    const porAutor = new Map<string, BolhaDeStory>();

    for (const l of linhas) {
      const p = perfis.get(l.autor_id);
      /* Modo Cuidado tira os stories da fileira, como tira tudo o mais. */
      if (!p || p.care_mode) continue;
      const b: BolhaDeStory = porAutor.get(l.autor_id) ?? {
        autorId: l.autor_id,
        autorNome: (p.display_name ?? "").trim() || "Alguém",
        autorAvatar: p.avatar_url ?? null,
        novo: false,
        stories: [],
      };
      const visto = jaVi.has(l.id);
      b.novo = b.novo || !visto;
      b.stories.push({
        id: l.id,
        autorId: l.autor_id,
        autorNome: b.autorNome,
        autorAvatar: b.autorAvatar,
        imagemUrl: await urlAssinada("rede", l.imagem_path, 3600),
        texto: l.texto ?? null,
        criadoEm: l.criado_em,
        visto,
        /* O carimbo nasce aqui, da régua, e só quando ela pediu naquele
           story. Os silêncios (luto, pós-parto, sem DUM) vêm de graça. */
        carimbo: l.carimbo_semana ? await carimboDe(p) : null,
        /* ⚠️ Array vazio é "sem enquete", nunca "enquete de zero opções" — a
           mesma leitura da enquete do post. */
        enquete: (l.enquete_opcoes ?? []).length
          ? {
              opcoes: l.enquete_opcoes as string[],
              votos: (votosPorStory.get(l.id) ?? [0, 0, 0, 0]).slice(
                0,
                (l.enquete_opcoes as string[]).length,
              ),
              meuVoto: meuVotoNo.has(l.id) ? (meuVotoNo.get(l.id) as number) : null,
            }
          : null,
        perguntaAberta: !!l.pergunta_aberta,
      });
      porAutor.set(l.autor_id, b);
    }

    /* ⚠️ A ordem: EU primeiro, depois os NÃO VISTOS, depois o resto. É a régua
       do Instagram, e ela é útil — quem tem coisa nova para mostrar fica onde
       o polegar alcança sem rolar. */
    const bolhas = [...porAutor.values()].sort((a, b) => {
      if (a.autorId === eu) return -1;
      if (b.autorId === eu) return 1;
      if (a.novo !== b.novo) return a.novo ? -1 : 1;
      return 0;
    });

    return { ok: true as const, bolhas };
  });

/**
 * VOTAR NA ENQUETE DE UM STORY.
 *
 * ⚠️ **`ignoreDuplicates` e NUNCA `upsert` que sobrescreve.** A chave primária
 * é `(story_id, quem_id)`, e é ela que permite a tela dizer "o voto não muda
 * depois" sem depender de o cliente se comportar. Um `upsert` que atualizasse
 * transformaria a promessa da tela em mentira.
 *
 * ⚠️ **Colidir na chave é SUCESSO REPETIDO, não erro.** Devolver erro faria ela
 * tentar de novo achando que falhou — a mesma decisão da reserva do chá de bebê
 * e do presente do médico.
 *
 * ⚠️ **E o story precisa ser VISÍVEL para ela.** Sem essa conferência, um
 * `storyId` sorteado que respondesse `ok` confirmaria a existência do story de
 * alguém — vazamento pela porta dos fundos, o mesmo cuidado que `reagir` já tem.
 */
export const votarNoStory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        storyId: z.string().uuid(),
        opcao: z.number().int().min(0).max(3),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: story } = await sb
      .from("rede_stories")
      .select("id, autor_id, enquete_opcoes, expira_em")
      .eq("id", data.storyId)
      .maybeSingle();
    if (!story) return { ok: false as const, motivo: "indisponivel" as const };

    const opcoes = ((story as any).enquete_opcoes ?? []) as string[];
    if (data.opcao >= opcoes.length) return { ok: false as const, motivo: "indisponivel" as const };
    if (new Date((story as any).expira_em).getTime() < Date.now()) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    /* O portão de visibilidade: só quem enxerga o story vota nele. A autora
       sempre enxerga o próprio. */
    if ((story as any).autor_id !== eu) {
      const ctx = await contextoDe(sb, eu);
      const perfis = await perfisPorId(sb, [(story as any).autor_id]);
      const autor = perfis.get((story as any).autor_id);
      const podeVer =
        !!autor &&
        !autor.care_mode &&
        !ctx.bloqueio.has((story as any).autor_id) &&
        (ctx.sigo.has((story as any).autor_id) || ctx.amigas.has((story as any).autor_id));
      if (!podeVer) return { ok: false as const, motivo: "indisponivel" as const };
    }

    const { error } = await sb
      .from("rede_story_votos")
      .insert({ story_id: data.storyId, quem_id: eu, opcao: data.opcao }, { count: "exact" });
    /* Chave repetida (23505) = ela já votou: sucesso, com `repetido`. */
    if (error && (error as any).code !== "23505") {
      return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const, repetido: !!error };
  });

export const marcarStoryVisto = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), storyId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* `ignoreDuplicates`: ver o mesmo story duas vezes é o caso comum, e a
       chave primária composta já recusa a segunda linha. */
    const { error } = await sb
      .from("rede_stories_vistos")
      .upsert({ story_id: data.storyId, quem_id: eu }, { onConflict: "story_id,quem_id" });
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   SALVAR
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * QUEM VIU MEU STORY.
 *
 * ⚠️ **Só a AUTORA, e a conferência é a primeira coisa.** Sem ela, um id de
 * story sorteado devolveria a lista de quem viu o story de qualquer pessoa da
 * plataforma — e essa lista é o círculo social dela, o mesmo dado que fez a
 * lista de seguidores não ser pública aqui.
 *
 * ⚠️ E ela NÃO é filtrada por Modo Cuidado nem por bloqueio, ao contrário da
 * caixa de atividade. A diferença é o que a linha significa: lá é um gesto
 * dirigido a ela ("Fulana reagiu"), aqui é o registro de que a foto DELA foi
 * vista — esconder uma linha faria o número na tela discordar da lista logo
 * abaixo dele, e ela contaria as duas.
 */
/**
 * QUEM REAGIU AO MEU POST — e COM QUÊ.
 *
 * Pedido do dono (ideia 7). Existia "quem viu meu story" e não existia isto: a
 * curiosidade número um depois de publicar ficava sem resposta, e o número
 * sozinho ("12") não diz quem.
 *
 * ⚠️ **SÓ A AUTORA, e a conferência vem ANTES da leitura.** A lista de quem
 * reagiu a um post de gestação é o CÍRCULO SOCIAL dela — a mesma razão pela
 * qual este app não tem lista pública de seguidores (`NUMEROS_PUBLICOS`). Um
 * `postId` no corpo do pedido não pode devolver a lista do post de outra
 * pessoa, e por isso o dono é conferido antes de qualquer consulta de reações.
 *
 * ⚠️ **NÃO filtra por Modo Cuidado nem por bloqueio** — ao contrário da caixa
 * de Atividade, e pela mesma razão de `quemViuMeuStory`: lá a linha é um gesto
 * dirigido a ela; aqui é o REGISTRO de quem reagiu ao post dela. Esconder uma
 * linha faria o número (que já foi mostrado, e que continua contando todo
 * mundo) discordar da lista logo abaixo — e um contador que não bate com a
 * lista é o tipo de coisa que faz a paciente desconfiar do app inteiro.
 */
/**
 * A RETROSPECTIVA DA SEMANA — o que o cartão de domingo precisa.
 *
 * ⚠️ **A régua mora em `retrospectiva.ts`, pura e testada**; aqui só se colhe o
 * que ela pede. Decidir "tem retrospectiva?" no servidor e "o que ela diz?" na
 * tela seria a mesma pergunta respondida em dois lugares.
 *
 * ⚠️ **A semana de SETE DIAS ATRÁS sai da mesma `computeGestation`**, com
 * `today` recuado — nunca de "semanaAtual − 1". A conta ingênua erra quem
 * corrigiu a DUM, quem tem data de referência de ultrassom, e quem passou do
 * termo.
 */
export const minhaSemana = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const perfis = await perfisPorId(sb, [eu]);
    const meu = perfis.get(eu);
    /* ⚠️ Falha ao ler o perfil fecha: sem saber se ela está em Modo Cuidado, o
       cartão mais festivo da aba não aparece. */
    if (!meu || meu.care_mode) return { ok: true as const, retrospectiva: null };

    const { computeGestation } = await import("@/lib/gestacao");
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 86_400_000);
    const base = {
      lmp: (meu as any).lmp_date ?? null,
      referenceDate: (meu as any).reference_date ?? null,
      referenceWeeks: (meu as any).reference_weeks ?? null,
      referenceDays: (meu as any).reference_days ?? null,
    };
    const agoraG = computeGestation({ ...base, today: agora });
    const antesG = computeGestation({ ...base, today: seteDiasAtras });

    const brutos = await postsCrus(sb, (b: any) =>
      b
        .eq("autor_id", eu)
        .is("arquivado_em", null)
        .gte("criado_em", seteDiasAtras.toISOString())
        .order("criado_em", { ascending: false })
        .limit(30),
    );

    const ids = brutos.map((p: any) => p.id);
    const { porPost } = await reacoesDe(sb, ids, eu);
    const { urlAssinada } = await import("@/lib/imagens.server");
    const { montarRetrospectiva } = await import("@/lib/retrospectiva");

    const posts = await Promise.all(
      brutos.map(async (p: any) => ({
        id: p.id as string,
        criadoEm: p.criado_em as string,
        imagemUrl: p.imagem_path ? await urlAssinada("rede", p.imagem_path, 3600) : null,
        reacoes: totalDeReacoes(porPost.get(p.id) ?? {}),
      })),
    );

    return {
      ok: true as const,
      retrospectiva: montarRetrospectiva({
        posts,
        agora,
        semanaAgora: agoraG ? agoraG.weeks : null,
        semanaHaSeteDias: antesG ? antesG.weeks : null,
        emCuidado: false,
      }),
    };
  });

export const quemReagiuAoPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* O PORTÃO, antes de tudo — ver o cabeçalho. */
    const { data: post } = await sb
      .from("rede_posts")
      .select("id, autor_id")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post || (post as any).autor_id !== eu) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const { data: linhas } = await sb
      .from("rede_reacoes")
      .select("quem_id, tipo, criado_em")
      .eq("post_id", data.postId)
      .order("criado_em", { ascending: false })
      .limit(200);

    const cruas = (linhas ?? []) as { quem_id: string; tipo: string }[];
    const perfis = await perfisPorId(
      sb,
      cruas.map((l) => l.quem_id),
    );
    const gente = cruas
      .map((l) => {
        const p = perfis.get(l.quem_id);
        if (!p) return null;
        /* ⚠️ Tipo desconhecido (gravado por uma versão futura, ou por um banco
           com o CHECK largo) cai no coração em vez de sumir: perder a LINHA
           faria o número discordar da lista. */
        const tipo = reacaoConhecida(l.tipo) ? l.tipo : ("amei" as TipoDeReacao);
        return {
          id: l.quem_id,
          nome: (p.display_name ?? "").trim() || "Alguém",
          avatarUrl: p.avatar_url ?? null,
          tipo,
          emoji: emojiDaReacao(tipo),
        };
      })
      .filter(Boolean) as {
      id: string;
      nome: string;
      avatarUrl: string | null;
      tipo: TipoDeReacao;
      emoji: string;
    }[];

    return { ok: true as const, gente };
  });

export const quemViuMeuStory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), storyId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: story } = await sb
      .from("rede_stories")
      .select("id, autor_id")
      .eq("id", data.storyId)
      .maybeSingle();
    if (!story || (story as any).autor_id !== eu) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const { data: linhas } = await sb
      .from("rede_stories_vistos")
      .select("quem_id, visto_em")
      .eq("story_id", data.storyId)
      .order("visto_em", { ascending: false })
      .limit(200);

    const ids = ((linhas ?? []) as { quem_id: string }[]).map((l) => l.quem_id);
    const perfis = await perfisPorId(sb, ids);
    const gente: PessoaNaLista[] = ids
      .map((id) => {
        const p = perfis.get(id);
        if (!p) return null;
        return {
          id,
          nome: (p.display_name ?? "").trim() || "Alguém",
          bio: null,
          avatarUrl: p.avatar_url ?? null,
          sigo: null,
          souEu: false,
        };
      })
      .filter(Boolean) as PessoaNaLista[];

    return { ok: true as const, gente };
  });

/**
 * Apagar um story antes das 24 horas.
 *
 * ⚠️ Publicar sem poder apagar é o defeito que `apagarPost` tinha, e num story
 * ele é pior: a foto sai sozinha em 24 h, então quem se arrependeu do que
 * publicou fica olhando o relógio. O `eq("autor_id", eu)` é o portão — sem ele,
 * um id qualquer apagaria o story de qualquer pessoa.
 */
export const apagarStory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), storyId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* A linha some, e com ela as de `rede_stories_vistos` (ON DELETE CASCADE).
       O arquivo continua no balde — é o mesmo caminho de `apagarPost`, e a
       varredura de exclusão de conta é quem limpa o balde. */
    const { error } = await sb
      .from("rede_stories")
      .delete()
      .eq("id", data.storyId)
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

export const salvarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        salvar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!data.salvar) {
      const { error } = await sb
        .from("rede_salvos")
        .delete()
        .eq("quem_id", eu)
        .eq("post_id", data.postId);
      if (error) return { ok: false as const, motivo: "banco" as const };
      return { ok: true as const };
    }

    /* ⚠️ Salvar exige poder VER o post, pela mesma razão de `reagir`: sem a
       conferência, um id sorteado que respondesse 200 confirmaria a existência
       de um post privado. */
    const { data: post } = await sb
      .from("rede_posts")
      .select("id, autor_id, visibilidade")
      .eq("id", data.postId)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!post) return { ok: false as const, motivo: "indisponivel" as const };

    const ctx = await contextoDe(sb, eu);
    const a = (await perfisPorId(sb, [(post as any).autor_id])).get((post as any).autor_id);
    const pode =
      !!a &&
      podeVerPost({
        post: { autorId: (post as any).autor_id, visibilidade: (post as any).visibilidade },
        euId: eu,
        autor: { emCuidado: !!a.care_mode, publico: !!a.perfil_publico },
        bloqueado: ctx.bloqueio.has((post as any).autor_id),
        sigoAtivo: ctx.sigo.has((post as any).autor_id),
        somosAmigas: ctx.amigas.has((post as any).autor_id),
      });
    if (!pode) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb
      .from("rede_salvos")
      .upsert({ quem_id: eu, post_id: data.postId }, { onConflict: "quem_id,post_id" });
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** Os posts que ela salvou. Ninguém mais vê esta lista — nem a autora deles. */
export const meusSalvos = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: linhas } = await sb
      .from("rede_salvos")
      .select("post_id, criado_em")
      .eq("quem_id", eu)
      .order("criado_em", { ascending: false })
      .limit(100);

    const ids = ((linhas ?? []) as { post_id: string }[]).map((l) => l.post_id);
    if (ids.length === 0) return { ok: true as const, posts: [] };

    const brutos = await postsCrus(sb, (base) => base.in("id", ids).is("arquivado_em", null));

    const ctx = await contextoDe(sb, eu);
    /* ⚠️ Passa pela régua DE NOVO na leitura: ela pode ter salvado um post e a
       autora ter fechado o perfil, entrado em Modo Cuidado ou bloqueado depois.
       Salvo não é uma cópia — é um marcador, e o marcador não sobrevive à
       decisão de quem escreveu. */
    const posts = await montarPosts(sb, eu, (brutos ?? []) as any[], ctx);
    return { ok: true as const, posts: ordenarFeed(posts) };
  });

/* ══════════════════════════════════════════════════════════════════════════
   ATIVIDADE — a aba do coração
   ══════════════════════════════════════════════════════════════════════════ */

export type AtividadeNaTela = {
  id: string;
  especie: EspecieDeAviso;
  quemId: string;
  quemNome: string;
  quemAvatar: string | null;
  postId: string | null;
  /** A capa do post, para a linha mostrar do que se trata. */
  postCapa: string | null;
  criadoEm: string;
  visto: boolean;
  /**
   * O pedido de seguir ainda está DE PÉ?
   *
   * ⚠️ Só faz sentido em `pediu_para_seguir`, e existe porque a linha da
   * atividade não sabe o desfecho: ela é gravada quando o pedido chega e nunca
   * mais muda. Sem este campo, um pedido já aceito continuaria mostrando
   * "Aceitar" para sempre — um botão que promete uma ação e não faz nada,
   * porque o `update` filtra por `estado = "pendente"` e não acha mais linha.
   */
  pendente: boolean;
};

/**
 * Registra um gesto na caixa de alguém.
 *
 * ⚠️ **Engole o erro de propósito.** É enriquecimento: quem reagiu já reagiu, e
 * derrubar a reação porque o aviso não gravou trocaria uma coisa que funciona
 * por uma que não. É a mesma decisão de `try/catch` do bônus das cinco
 * estrelas.
 */
async function registrarAtividade(
  sb: any,
  opts: { donoId: string; quemId: string; especie: EspecieDeAviso; postId?: string | null },
) {
  if (opts.donoId === opts.quemId) return;
  try {
    /* ⚠️ **`insert`, e NUNCA `upsert` com `onConflict`.** O índice único do
       banco é de EXPRESSÃO — `(dono_id, quem_id, especie, coalesce(post_id,
       dono_id))` —, e ele é assim de propósito: `post_id` é nulo em "seguiu" e
       "aceitou", e no Postgres cada NULL é distinto, então um índice de colunas
       simples não deduparia nada. Só que `ON CONFLICT (…, post_id)` não INFERE
       um índice cuja quarta chave é uma expressão: o Postgres devolve `42P10`,
       e o erro caía no `console.warn` abaixo.
       Efeito: a caixa ♡ SEMPRE vazia e o emblema sempre zero — nenhuma reação,
       nenhum "começou a te seguir", nenhum pedido. E como Aceitar/Recusar mora
       lá dentro, a porta do pedido sumia junto.
       Com `insert`, quem dedupa é o índice: a segunda gravação é recusada com
       `23505`, que aqui é SUCESSO REPETIDO e não erro. */
    const { error } = await sb.from("rede_atividade").insert({
      dono_id: opts.donoId,
      quem_id: opts.quemId,
      especie: opts.especie,
      post_id: opts.postId ?? null,
    });
    /* `23505` é a dedupe funcionando — tirar e pôr a reação cinco vezes não
       enche a caixa dela com cinco avisos. */
    if (error && (error as { code?: string }).code === "23505") return;
    /* ⚠️ NÃO derruba o gesto, mas também não some sem deixar rastro. A catraca
       de `travas-do-servidor.test.ts` existe para forçar esta pergunta, e a
       resposta aqui é a do meio: silêncio para a paciente (a reação dela já
       valeu), registro para quem for investigar por que a caixa de alguém
       está vazia. Silêncio TOTAL é o que a catraca proíbe. */
    if (error) console.warn("[atividade] não gravou", error.code, error.message);
  } catch (e) {
    console.warn("[atividade] não gravou", e);
  }
}

export const minhaAtividade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Mesmo portão do feed — ver `euEmCuidado`. A caixa ♡ é a rede em volta,
       e ela para junto. */
    if (await euEmCuidado(sb, eu)) {
      return { ok: true as const, itens: [] as AtividadeNaTela[], novas: 0 };
    }

    const { data: linhas } = await sb
      .from("rede_atividade")
      .select("id, quem_id, especie, post_id, criado_em, visto_em")
      .eq("dono_id", eu)
      .order("criado_em", { ascending: false })
      .limit(80);

    const brutas = (linhas ?? []) as any[];
    const ctx = await contextoDe(sb, eu);
    const perfis = await perfisPorId(sb, [...new Set(brutas.map((l) => l.quem_id))]);

    /* As capas dos posts citados, para a linha mostrar do que se trata. */
    const postIds = [...new Set(brutas.map((l) => l.post_id).filter(Boolean))] as string[];
    const capas = new Map<string, string>();
    if (postIds.length) {
      const { data: ps } = await sb
        .from("rede_posts")
        .select("id, imagem_path")
        .in("id", postIds)
        .is("arquivado_em", null);
      const { urlAssinada } = await import("@/lib/imagens.server");
      for (const p of (ps ?? []) as any[]) {
        if (!p.imagem_path) continue;
        const u = await urlAssinada("rede", p.imagem_path, 3600);
        if (u) capas.set(p.id, u);
      }
    }

    /* Quem ainda está esperando resposta. Uma consulta só, para todas as
       linhas de pedido da caixa. */
    const { data: esperando } = await sb
      .from("rede_seguidores")
      .select("seguidor_id")
      .eq("seguido_id", eu)
      .eq("estado", "pendente");
    const pendentes = new Set(
      ((esperando ?? []) as { seguidor_id: string }[]).map((l) => l.seguidor_id),
    );

    const itens: AtividadeNaTela[] = brutas
      .map((l) => {
        const p = perfis.get(l.quem_id);
        /* ⚠️ Modo Cuidado e bloqueio somem da caixa, sem anunciar. Uma linha
           "Fulana reagiu" de quem entrou em luto contaria a perda dela pela
           porta dos fundos — e uma de quem ela bloqueou traria a pessoa de
           volta à tela justamente depois de ela ter pedido para não ver. */
        if (!p || p.care_mode || ctx.bloqueio.has(l.quem_id)) return null;
        return {
          id: l.id,
          especie: l.especie as EspecieDeAviso,
          quemId: l.quem_id,
          quemNome: (p.display_name ?? "").trim() || "Alguém",
          quemAvatar: p.avatar_url ?? null,
          postId: l.post_id ?? null,
          postCapa: l.post_id ? (capas.get(l.post_id) ?? null) : null,
          criadoEm: l.criado_em,
          visto: !!l.visto_em,
          pendente: l.especie === "pediu_para_seguir" && pendentes.has(l.quem_id),
        };
      })
      .filter(Boolean) as AtividadeNaTela[];

    return { ok: true as const, itens, novas: itens.filter((i) => !i.visto).length };
  });

/** Marca a caixa inteira como vista — é o que abre a aba faz. */
export const marcarAtividadeVista = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Aqui abrir a aba MARCA TUDO, ao contrário da central de recados, em
       que o toque em cada item é quem marca. A diferença é o que está em jogo:
       lá são recados do app que podem exigir ação dela (uma pré-consulta, uma
       vaga liberada), e perder o rastro de cinco de uma vez custa caro. Aqui
       são coraçõezinhos — nada a fazer, nada a perder. */
    const { error } = await sb
      .from("rede_atividade")
      .update({ visto_em: new Date().toISOString() })
      .eq("dono_id", eu)
      .is("visto_em", null);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * TIRAR ALGUÉM DE PERTO — sem bloquear.
 *
 * ⚠️ **Faltava a saída do meio.** `listaDeGente` mostrava os seguidores e só
 * oferecia "seguir/deixar de seguir" — o que é sobre QUEM EU SIGO, não sobre
 * quem me segue. A única forma de tirar alguém de dentro era BLOQUEAR, que é
 * nuclear e que a própria tela descreve como reversível. Quem abriu o perfil
 * quando era pública e depois o fechou ficava com os antigos seguidores dentro,
 * para sempre.
 *
 * ⚠️ **E é CALADO**, como o bloqueio. "Fulana te removeu" transforma um gesto
 * privado numa briga, e num app onde as pessoas se conhecem da vida real isso
 * piora exatamente a situação que motivou o gesto. Ela simplesmente deixa de
 * ver os posts novos — do lado dela é o mesmo que a pessoa ter parado de
 * publicar.
 *
 * ⚠️ **`.eq("seguido_id", eu)` é o portão**: sem ele, um id no corpo do pedido
 * desfaria o seguir entre duas outras pessoas.
 */
export const removerSeguidor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), quemId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("rede_seguidores")
      .delete()
      .eq("seguidor_id", data.quemId)
      .eq("seguido_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * DENUNCIAR UM POST.
 *
 * ⚠️ **Era a lacuna que fechava o círculo**: a caixinha tinha denúncia e o
 * FEED não — o canal com mais alcance era o único sem canal de reporte. Com a
 * régua clínica agora rodando em `publicarPost`, o que sobra são as coisas que
 * régua nenhuma pega (assédio, mentira, foto de outra pessoa), e para essas o
 * único caminho é uma pessoa olhar.
 *
 * ⚠️ **Reaproveita `rede_perguntas`**, e isso é decisão e não preguiça: a fila
 * que o Painel já lê é essa, e uma segunda tabela significaria uma segunda
 * fila — que é como uma delas passa meses sem ninguém abrir. A linha nasce
 * denunciada e arquivada, com o texto do post copiado; `dona_id` é quem
 * PUBLICOU (é sobre ela que a denúncia fala) e `quem_id` é quem denunciou.
 */
export const denunciarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Só dá para denunciar o que eu POSSO VER — a mesma régua da leitura.
       Sem isto, um uuid sorteado que respondesse `ok` confirmaria a existência
       de um post privado, que é vazamento pela porta dos fundos (é o mesmo
       cuidado que `reagir` já tem). */
    const [bruto] = await postsCrus(sb, (base) =>
      base.eq("id", data.postId).is("arquivado_em", null).limit(1),
    );
    if (!bruto) return { ok: false as const, motivo: "indisponivel" as const };
    const ctx = await contextoDe(sb, eu);
    const [visivel] = await montarPosts(sb, eu, [bruto], ctx);
    if (!visivel) return { ok: false as const, motivo: "indisponivel" as const };

    /* ⚠️ Denunciar o PRÓPRIO post não faz sentido, e abriria um jeito barato de
       encher a fila do administrador. */
    if (visivel.autorId === eu) return { ok: false as const, motivo: "indisponivel" as const };

    const agora = new Date().toISOString();
    const { error } = await sb.from("rede_perguntas").insert({
      dona_id: visivel.autorId,
      quem_id: eu,
      texto: `[publicação] ${visivel.texto ?? "(sem legenda)"}`,
      desfecho: "publicavel",
      denunciado_em: agora,
      arquivado_em: agora,
    });
    /* Duplicata é SUCESSO REPETIDO: ela tocou duas vezes, e dizer "erro" a
       faria tentar de novo. */
    if (error && (error as { code?: string }).code !== "23505") {
      return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });
