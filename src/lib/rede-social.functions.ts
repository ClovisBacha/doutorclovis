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
import { ehContaOficial, fileiraComOficial } from "@/lib/conta-oficial";
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
  hojeEmSaoPaulo,
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
  /**
   * O autor é a CONTA OFICIAL do consultório?
   *
   * ⚠️ **O selo precisa existir no POST, e não só na lista de gente.** Ele era
   * montado em `listaDeGente` e desenhado em UM lugar — a fileira de sugeridas.
   * No feed, onde a conta oficial de fato aparece, ela lia como uma paciente
   * qualquer chamada "Obstétrica": uma conta institucional publicando conselho
   * sem nada que a identifique como institucional é exatamente o que um selo
   * existe para impedir.
   *
   * ⚠️ Não confundir com o selo do OBSTETRA (`quemReagiuAoPost`), que é
   * resolvido pelo vínculo atual e só aparece na lista que a autora abre.
   */
  autorOficial: boolean;
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
   * Quantas pessoas viram este post — **só para a autora**, e `null` para todo
   * o resto.
   *
   * ⚠️ **NÚMERO, NUNCA LISTA.** O story tem "visto por" porque some em 24h e é
   * uma foto solta; o post é permanente e pode ser um desabafo. Entregar QUEM
   * leu produz a pergunta "por que a fulana viu e não reagiu?", que é
   * exatamente a leitura que esta aba não pode induzir.
   *
   * ⚠️ **E `null` para quem não é a autora** — não é `0`. Um zero na tela das
   * outras seria um contador público de audiência, que é a coisa que este app
   * decidiu não ter (ver `NUMEROS_PUBLICOS`).
   */
  vistas: number | null;
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
   * "Então e agora": os dois rótulos de semana, ou `null`.
   *
   * ⚠️ **Derivado na leitura**, e respeitando a chave `mostrar_semana` DE HOJE —
   * ver `entao-e-agora.ts`. A primeira foto do carrossel é o "então".
   */
  comparacao: { antes: string; agora: string } | null;
  /**
   * Quando a legenda foi editada, ou `null`.
   *
   * ⚠️ **É o SELO, não o histórico.** A tela precisa dizer "editado" — sem
   * isso, corrigir o texto vira reescrita silenciosa da história, e quem reagiu
   * ao que estava escrito antes não tem como saber que mudou.
   */
  editadoEm: string | null;
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
  /**
   * A vitrine na internet aberta (`/p/<codigo>`) está ligada?
   *
   * ⚠️ **Chave PRÓPRIA, e só a DONA a recebe.** Ela nunca viaja no perfil de
   * outra pessoa: se a vitrine está ligada, quem tem o link já descobre abrindo
   * o endereço — e quem não tem não precisa saber que ele existe.
   */
  vitrine?: boolean;
  /** O código dela, para a tela montar o endereço da vitrine. Só a DONA. */
  codigoDaVitrine?: string | null;
  /**
   * É a CONTA OFICIAL do consultório?
   *
   * ⚠️ Público por natureza — identifica uma conta institucional, não uma
   * relação clínica de ninguém. Não confundir com o selo do OBSTETRA, que é
   * resolvido pelo vínculo atual e só aparece na lista que a autora abre.
   */
  oficial?: boolean;
  /** `null` = não sigo. */
  meuVinculo: "ativo" | "pendente" | null;
  souEu: boolean;
  /**
   * Eu silenciei esta pessoa?
   *
   * ⚠️ **Só a MINHA lista chega aqui — nunca a dela.** Saber quem te silenciou
   * é exatamente o que transformaria um gesto privado numa briga, e é a mesma
   * razão pela qual o bloqueio é mudo. Sob a prévia é sempre `false`: a persona
   * é uma visitante inventada e não silenciou ninguém.
   */
  silenciado: boolean;
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
  /** A memória de perfis desta requisição. Ver `MemoriaDePerfis`. */
  perfis: Map<string, any>;
  sigo: Set<string>;
  bloqueio: ConjuntoDeBloqueio;
  amigas: Set<string>;
  /**
   * Quem ela silenciou.
   *
   * ⚠️ **Isto NÃO entra em `podeVerPost`, e é a decisão central do recurso.**
   * Silenciar não é uma régua de VISIBILIDADE — é uma preferência de FEED. A
   * diferença aparece quando ela visita o perfil da silenciada: lá as
   * publicações continuam à mostra, porque ela foi até lá para ver. Se
   * silenciar entrasse na régua de visibilidade, viraria um bloqueio de um lado
   * só, e a palavra passaria a mentir.
   *
   * ⚠️ E ele falha ABERTO de propósito, ao contrário do bloqueio: sem conseguir
   * ler a lista, o feed traz tudo. O pior caso é ela ver um post que preferia
   * não ver — contra o pior caso do bloqueio, que é vazamento.
   */
  silenciados: Set<string>;
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
  /* ⚠️ **AS CINCO NA MESMA LEVA.** O grafo de amizade era buscado DEPOIS destas
     quatro, em série — e não depende de nenhuma delas. Como `contextoDe` abre
     toda leitura da rede (feed, perfil, post, salvos, sugestões, atividade), a
     espera dobrada aparecia em todas elas de uma vez. */
  const [seg, meus, deles, calados, grafo] = await Promise.all([
    sb.from("rede_seguidores").select("seguido_id").eq("seguidor_id", eu).eq("estado", "ativo"),
    sb.from("rede_bloqueios").select("bloqueado_id").eq("quem_id", eu),
    sb.from("rede_bloqueios").select("quem_id").eq("bloqueado_id", eu),
    sb.from("rede_silenciados").select("silenciado_id").eq("quem_id", eu),
    (async () => {
      try {
        const { idsDasAmigas } = await import("@/lib/amigas.functions");
        return await idsDasAmigas(sb, eu);
      } catch {
        return null;
      }
    })(),
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
  /* ⚠️ **`degradada` é a lista SEM as amizades encerradas subtraídas**, e aqui
     isso não é um nome a mais na lista: `amigas` destranca a camada mais
     restrita (o desabafo de terça) e ATRAVESSA perfil privado, porque
     `alcancaOPerfil` aceita `somosAmigas`. A aba Amigas tolera a degradação de
     propósito (perder todas as amigas por uma consulta lenta é pior); a rede
     não pode. Aqui, sem certeza, o conjunto é VAZIO — e um erro na busca cai no
     mesmo lugar: sem o grafo, a camada `amigas` FECHA em vez de abrir. Errar
     para o lado de não mostrar é a única direção segura numa régua de
     visibilidade. */
  if (grafo && !grafo.degradada) {
    amigas = grafo.todas instanceof Set ? grafo.todas : new Set(grafo.todas as string[]);
  } else {
    amigasFalhou = true;
  }

  return {
    /* A memória nasce aqui e morre com a resposta — ver `MemoriaDePerfis`. */
    perfis: new Map<string, any>(),
    sigo: new Set((((seg as any).data ?? []) as { seguido_id: string }[]).map((s) => s.seguido_id)),
    bloqueio: conjuntoDeBloqueio(ids, bloqueioFalhou),
    amigas,
    /* ⚠️ Falha ABERTO (conjunto vazio), ao contrário do bloqueio — ver o tipo.
       E a tabela nasce num APLICAR_ que o dono roda à mão: sem o `?? []`, o
       feed inteiro quebraria na janela entre o deploy e o SQL por causa de uma
       preferência. */
    silenciados: new Set(
      (((calados as any).data ?? []) as { silenciado_id: string }[]).map((x) => x.silenciado_id),
    ),
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

/**
 * A vitrine pública dela está ligada?
 *
 * ⚠️ **Consulta PRÓPRIA, e não uma coluna a mais em `COLUNAS_DO_PERFIL`.** A
 * lista principal alimenta feed, busca, stories e salvos — e cada coluna nova
 * ali é mais um degrau de recuo a manter, para um dado que só a tela de ajustes
 * dela usa. Aqui a falha custa um interruptor nascendo desligado; lá custaria a
 * aba inteira.
 *
 * ⚠️ **E o erro vale FALSE, nunca `true`.** Banco sem a coluna é banco sem
 * consentimento: o pior caso é a vitrine não abrir, que é o lado seguro.
 */
async function vitrineLigada(
  sb: any,
  eu: string,
): Promise<{ ligada: boolean; codigo: string | null }> {
  const vazio = { ligada: false, codigo: null as string | null };
  try {
    const { data, error } = await sb
      .from("patient_profiles")
      .select("vitrine_publica, referral_code")
      .eq("id", eu)
      .maybeSingle();
    if (error) {
      /* Sem a coluna nova, ainda vale ler o código: a vitrine fica desligada e
         a tela continua sabendo qual seria o endereço dela. */
      const { data: so } = await sb
        .from("patient_profiles")
        .select("referral_code")
        .eq("id", eu)
        .maybeSingle();
      return { ligada: false, codigo: ((so as any)?.referral_code as string | null) ?? null };
    }
    return {
      ligada: !!(data as any)?.vitrine_publica,
      codigo: ((data as any)?.referral_code as string | null) ?? null,
    };
  } catch {
    return vazio;
  }
}

/**
 * A MEMÓRIA DE UMA REQUISIÇÃO SÓ — para o mesmo perfil não ser buscado duas
 * vezes na mesma resposta.
 *
 * ⚠️ **`verPerfil` chamava `perfisPorId` DUAS vezes com o mesmo id**: uma para
 * montar o cabeçalho e outra dentro de `montarPosts`, para o autor das
 * publicações — que é a mesma pessoa. Medido com uma bancada que conta as idas
 * ao banco: duas consultas a `patient_profiles` e duas renovações de URL
 * assinada, em ondas SERIAIS diferentes. O feed tem o mesmo padrão sempre que
 * um autor aparece em duas listas.
 *
 * ⚠️ **A memória vive UMA requisição, e é por isso que ela é um parâmetro e não
 * um módulo.** Um cache de módulo no servidor seria compartilhado entre
 * pacientes e entre requisições: a linha de `patient_profiles` carrega
 * `care_mode`, `perfil_publico` e as chaves do selo, e servir a versão velha
 * dessas colunas a outra pessoa é mostrar o perfil de quem acabou de entrar em
 * Modo Cuidado. Aqui o mapa nasce e morre dentro da mesma resposta.
 */
type MemoriaDePerfis = Map<string, any>;

/** Perfis por id, com o que a rede precisa. */
async function perfisPorId(sb: any, ids: string[], memoria?: MemoriaDePerfis) {
  if (ids.length === 0) return new Map<string, any>();
  /* O que já foi lido nesta requisição não é lido de novo. */
  const faltando = memoria ? ids.filter((id) => !memoria.has(id)) : ids;
  if (faltando.length === 0) {
    return new Map(ids.map((id) => [id, memoria!.get(id)]));
  }
  const { data, error } = await sb
    .from("patient_profiles")
    .select(COLUNAS_DO_PERFIL)
    .in("id", faltando);

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
  const linhas = error ? await semAColunaNova(sb, faltando) : ((data ?? []) as any[]);
  /* ⚠️ **O avatar é RENOVADO na leitura**, e é aqui que a promessa de
     `salvarPerfilSocial` ("a próxima leitura renova") vira código: ela era
     falsa, e no oitavo dia a foto de toda paciente respondia 403 no app
     inteiro. Um ponto só, porque `perfisPorId` alimenta feed, perfil, busca,
     stories, atividade e salvos — renovar em cada um deles seria seis lugares
     para esquecer o sétimo. */
  /* ⚠️ **EM LOTE, e não uma assinatura por perfil.** `renovarUrlAssinada`
     (singular) é uma ida à rede POR AVATAR: um feed de vinte autores custava
     vinte requisições ao Storage só para desenhar vinte fotinhas de 32px, e
     `perfisPorId` alimenta feed, perfil, busca, stories, atividade e salvos.
     `renovarUrlsAssinadas` manda um `POST` por balde — e, como o avatar é
     assinado por sete dias, o caso comum não manda nenhum: quem ainda tem mais
     de meio dia de validade é reaproveitado sem tocar na rede. */
  const { renovarUrlsAssinadas, VALIDADE_AVATAR_SEG } = await import("@/lib/imagens.server");
  /* ⚠️ **COM A VALIDADE DO AVATAR, e não com o padrão de uma hora.** Renovar
     para uma hora fazia a URL nascer JÁ dentro da margem de renovação: na
     leitura seguinte ela era renovada de novo, e a partir daí toda leitura da
     rede voltava a assinar todos os avatares, para sempre. E, no navegador, uma
     URL que muda a cada leitura é uma foto baixada de novo em cada tela. */
  const urls = await renovarUrlsAssinadas(
    linhas.map((p) => p.avatar_url),
    VALIDADE_AVATAR_SEG,
  );
  const saida = new Map<string, any>();
  linhas.forEach((p, i) => {
    const pronto = { ...p, avatar_url: urls[i] };
    saida.set(p.id, pronto);
    memoria?.set(p.id, pronto);
  });
  /* Os que já estavam na memória voltam junto — quem chamou pediu por TODOS. */
  if (memoria)
    for (const id of ids) if (!saida.has(id) && memoria.has(id)) saida.set(id, memoria.get(id));
  return saida;
}

/**
 * Quantos autores cabem num `.in()` — LIMITE DE URL, não de gosto.
 *
 * O `.in()` do PostgREST vai na query string, e cada uuid custa 37 caracteres:
 * 400 autores são ~15 kB de endereço, e o servidor recusa acima de alguns kB.
 * Duzentos são ~7,4 kB, com folga para o resto dos parâmetros, e é muito mais
 * gente do que qualquer paciente segue hoje.
 */
const AUTORES_NO_FEED = 200;

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
  "enquete_opcoes, aula, pergunta, comparacao_de, editado_em";

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
    comparacao_de: null,
    editado_em: null,
  }));
}

/** As colunas que a rede lê de `patient_profiles`. Uma lista só, dois selects. */
const COLUNAS_DO_PERFIL =
  "id, display_name, avatar_url, bio, perfil_publico, care_mode, " +
  "baby_name, mostrar_semana, mostrar_bebe, aceita_perguntas, conta_oficial, " +
  "lmp_date, reference_date, reference_weeks, reference_days, birth_date, doctor_id";

/**
 * A mesma lista sem `conta_oficial` — DERIVADA, nunca copiada à mão.
 *
 * ⚠️ **UM DEGRAU DE RECUO POR COLUNA, e este degrau nasceu de um defeito meu.**
 * `conta_oficial` (a conta do consultório) entrou na lista principal num
 * `APLICAR_` SEPARADO do das colunas do selo — então existe um banco real, o do
 * dono agora, que TEM `mostrar_semana`/`mostrar_bebe`/`aceita_perguntas` e ainda
 * NÃO tem `conta_oficial`. Com um recuo só, esse banco caía direto no degrau de
 * baixo e a rede INTEIRA perdia o selo da semana, o selo do bebê e a caixinha de
 * perguntas — três recursos que o dono já tinha ligado, apagados em silêncio por
 * uma coluna que ele nem sabia que existia.
 *
 * É a mesma lição de `marcarConsultaNoDia`, que precisou de um recuo POR COLUNA
 * (`patient_user_id` e `duration_minutes`, uma de cada vez) porque um recuo que
 * só soubesse tirar a primeira quebraria de novo assim que a segunda faltasse
 * num banco que só rodou meio SQL.
 *
 * Derivada e não copiada porque duas listas escritas à mão divergem no primeiro
 * ajuste — e aqui a divergência apareceria como recurso sumindo, sem erro.
 */
const COLUNAS_SEM_OFICIAL = COLUNAS_DO_PERFIL.replace("conta_oficial, ", "");

const COLUNAS_SEM_SELO =
  "id, display_name, avatar_url, bio, perfil_publico, care_mode, " +
  "baby_name, lmp_date, reference_date, reference_weeks, reference_days, birth_date, doctor_id";

/** Degrau 2: o banco tem o selo e ainda não tem a conta oficial. */
async function semAColunaNova(sb: any, ids: string[]): Promise<any[]> {
  const { data, error } = await sb
    .from("patient_profiles")
    .select(COLUNAS_SEM_OFICIAL)
    .in("id", ids);
  if (error) return semAsColunasDoSelo(sb, ids);
  console.warn("[rede] sem conta_oficial — rode APLICAR_CONTA_OFICIAL.sql");
  /* Ausente vale `false`: é o que `ehContaOficial` já assume, e o pior caso é a
     fileira de sugeridas ficar como era antes de a conta oficial existir. */
  return ((data ?? []) as any[]).map((p) => ({ ...p, conta_oficial: false }));
}

/** Degrau 3: o banco ainda não rodou o SQL do selo. */
async function semAsColunasDoSelo(sb: any, ids: string[]): Promise<any[]> {
  console.warn("[rede] sem mostrar_semana/mostrar_bebe — rode APLICAR_REDE_SOCIAL.sql");
  const { data } = await sb.from("patient_profiles").select(COLUNAS_SEM_SELO).in("id", ids);
  /* As chaves ausentes valem `false`: a paciente não pode ter ligado o que o
     banco ainda não sabe guardar. */
  return ((data ?? []) as any[]).map((p) => ({
    ...p,
    mostrar_semana: false,
    mostrar_bebe: false,
    conta_oficial: false,
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

/**
 * Quantas pessoas viram cada post — SÓ os meus.
 *
 * ⚠️ **O recorte é `autor_id === eu`, e ele acontece ANTES da consulta.** Pedir
 * a contagem de todos os posts visíveis e filtrar depois traria para a memória
 * do servidor a audiência dos posts das outras — e bastaria um `console.log`
 * ou um campo esquecido no retorno para ela viajar. O que não é lido não vaza.
 *
 * ⚠️ **E devolve CONTAGEM, nunca as linhas.** `quem_id` existe só para dedupar;
 * ele não sai desta função.
 *
 * ⚠️ Falha (inclusive `42P01`, antes de o dono rodar o SQL) devolve mapa vazio
 * — e a tela mostra `null`, que é "não sei", e não "ninguém viu".
 */
async function vistasDosMeus(
  sb: any,
  posts: { id: string; autor_id: string }[],
  eu: string,
): Promise<Map<string, number>> {
  const meus = posts.filter((p) => p.autor_id === eu).map((p) => p.id);
  const fora = new Map<string, number>();
  if (meus.length === 0) return fora;
  try {
    const { data, error } = await sb
      .from("rede_post_vistas")
      .select("post_id")
      .in("post_id", meus)
      .limit(5000);
    if (error) return fora;
    for (const l of (data ?? []) as { post_id: string }[]) {
      fora.set(l.post_id, (fora.get(l.post_id) ?? 0) + 1);
    }
  } catch {
    /* Sem a tabela, sem número — e a tela diz "não sei", nunca "ninguém". */
  }
  return fora;
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
  /**
   * A memória de perfis DESTA requisição.
   *
   * ⚠️ Opcional porque nem todo chamador de `montarPosts` monta um contexto
   * completo (o espelho fabrica um olho de mentira). Sem ela, `perfisPorId`
   * simplesmente busca como sempre buscou.
   */
  perfis?: Map<string, any>;
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
  bloqueio: { has(id: string): boolean },
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
    /* ⚠️ **E O BLOQUEIO TAMBÉM, que faltava.** O bloqueio vale nos DOIS
       sentidos e some com a pessoa inteira — mas a linha "com Fulana" embaixo
       da foto de uma terceira continuava dizendo o nome dela, e o toque abria
       o perfil. Bloquear não pode ser uma proteção que a marcação de outra
       pessoa desfaz. */
    if (bloqueio.has(l.quem_id)) continue;
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
  /* ⚠️ Com a memória do contexto: `verPerfil` já leu o perfil da dona para
     montar o cabeçalho, e o autor de todas as publicações dela é ela mesma. Sem
     isto eram duas consultas a `patient_profiles` e duas renovações de URL
     assinada, em ondas seriais diferentes. */
  const autores = await perfisPorId(
    sb,
    [...new Set(brutos.map((p) => p.autor_id))],
    (ctx as OlhoDeQuemVe).perfis,
  );

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
  const [{ porPost, minhas }, salvos, votos, marcadas, vistas] = await Promise.all([
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
      ctx.bloqueio,
    ),
    vistasDosMeus(sb, visiveis, eu),
  ]);

  /* ─── OS CARIMBOS DO "ENTÃO E AGORA" ───────────────────────────────────
     ⚠️ Uma consulta só para todos os posts comparados da página, e não uma por
     post: um feed de vinte comparações custaria vinte idas ao banco. */
  const comparacoes = new Map<string, { antes: string; agora: string }>();
  {
    const comCompar = visiveis.filter((p) => p.comparacao_de);
    if (comCompar.length) {
      try {
        const { data: antigos } = await sb
          .from("rede_posts")
          .select("id, criado_em")
          .in("id", [...new Set(comCompar.map((p) => p.comparacao_de as string))]);
        const quando = new Map(
          ((antigos ?? []) as { id: string; criado_em: string }[]).map((x) => [x.id, x.criado_em]),
        );
        const { computeGestation } = await import("@/lib/gestacao");
        const { carimboDaComparacao } = await import("@/lib/entao-e-agora");
        for (const p of comCompar) {
          const a = autores.get(p.autor_id);
          const antes = quando.get(p.comparacao_de as string);
          if (!a || !antes) continue;
          const base = {
            lmp: a.lmp_date ?? null,
            referenceDate: a.reference_date ?? null,
            referenceWeeks: a.reference_weeks ?? null,
            referenceDays: a.reference_days ?? null,
          };
          const c = carimboDaComparacao({
            /* ⚠️ A semana de CADA FOTO sai da mesma `computeGestation`, com o
               `today` na data daquele post — nunca de uma subtração de semanas
               entre as duas datas. A conta ingênua erra quem corrigiu a DUM. */
            semanaAntes: computeGestation({ ...base, today: new Date(antes) })?.weeks ?? null,
            semanaAgora: computeGestation({ ...base, today: new Date(p.criado_em) })?.weeks ?? null,
            mostrarSemana: !!a.mostrar_semana,
          });
          if (c) comparacoes.set(p.id, c);
        }
      } catch {
        /* Sem os carimbos, a comparação vira um carrossel comum de duas fotos —
           que é exatamente o desfecho certo. */
      }
    }
  }

  /* ⚠️ **AS FOTOS DE TODOS OS POSTS SÃO ASSINADAS DE UMA VEZ.** Era uma ida à
     rede POR FOTO: uma tela de perfil com doze publicações de até cinco fotos
     chegava a sessenta requisições ao Storage antes de a primeira imagem
     aparecer — e é literalmente o caminho que o dono descreveu ("clico na foto
     de quem publicou e demora cinco segundos"). Um `POST` só resolve o lote
     inteiro. As URLs do post continuam de vida curta (uma hora): quem manda no
     tempo é o parâmetro, não o lote. */
  const { urlsAssinadas } = await import("@/lib/imagens.server");
  const todosOsCaminhos = visiveis.flatMap(
    (p) => [p.imagem_path, ...((p.imagens ?? []) as string[])].filter(Boolean) as string[],
  );
  const assinadas = await urlsAssinadas("rede", todosOsCaminhos, 3600);
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
      const urls = caminhos.map((c) => assinadas.get(c)).filter(Boolean) as string[];
      return {
        id: p.id,
        autorId: p.autor_id,
        autorNome: (a?.display_name ?? "").trim() || "Alguém",
        autorAvatar: a?.avatar_url ?? null,
        autorOficial: ehContaOficial(a as any),
        texto: p.texto ?? null,
        imagemUrl: urls[0] ?? null,
        imagens: urls,
        visibilidade: p.visibilidade,
        criadoEm: p.criado_em,
        reacoes: porPost.get(p.id) ?? {},
        minhaReacao: minhas.get(p.id) ?? null,
        souAAutora: p.autor_id === eu,
        /* ⚠️ `null` para quem não é a autora — e não `0`. Um zero na tela das
           outras seria um contador público de audiência, que é a coisa que este
           app decidiu não ter. */
        vistas: p.autor_id === eu ? (vistas.get(p.id) ?? 0) : null,
        comparacao: comparacoes.get(p.id) ?? null,
        editadoEm: p.editado_em ?? null,
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
    const vitrine = await vitrineLigada(sb, eu);

    return {
      ok: true as const,
      perfil: {
        id: eu,
        nome: ((p as any)?.display_name ?? "").trim() || "Você",
        bio: (p as any)?.bio ?? null,
        avatarUrl: (p as any)?.avatar_url ?? null,
        publico: !!(p as any)?.perfil_publico,
        oficial: ehContaOficial(p as any),
        vitrine: vitrine.ligada,
        codigoDaVitrine: vitrine.codigo,
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
        /* ⚠️ A VITRINE NA INTERNET ABERTA (`/p/<codigo>`) — chave PRÓPRIA, e
           nunca a mesma de `publico`. A tela do perfil público promete
           "qualquer pessoa NO APP"; a vitrine abre fora dele, sem conta. */
        vitrine: z.boolean().optional(),
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
      ...(data.vitrine !== undefined ? { vitrine_publica: data.vitrine } : {}),
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
    /* Com a memória do contexto: as publicações desta tela são todas DELA, e
       `montarPosts` pediria o mesmo perfil de novo, numa onda serial a mais. */
    /* ⚠️ **O PERFIL E O VÍNCULO NA MESMA ONDA.** Os dois alimentam o portão de
       alcance logo abaixo, e nenhum depende do outro — eram duas esperas em
       fila para uma decisão só. */
    const [perfis, { data: vinculo }] = await Promise.all([
      perfisPorId(sb, [data.alvoId], ctx.perfis),
      sb
        .from("rede_seguidores")
        .select("estado")
        .eq("seguidor_id", eu)
        .eq("seguido_id", data.alvoId)
        .maybeSingle(),
    ]);
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
    /* ⚠️ **As publicações DELA saem junto com a busca das marcações.** Só a
       segunda consulta (os posts em que ela foi marcada) depende da primeira;
       a lista dos posts próprios não depende de nada. Eram três ondas em fila
       e viraram duas.

       ⚠️ E as duas rodam DEPOIS do portão de alcance, de propósito: ler as
       publicações de um perfil que a régua vai recusar é trabalho jogado fora e,
       pior, é a ordem que um dia alguém "otimiza" movendo o portão para baixo. */
    const [marcados, proprios] = await Promise.all([
      idsMarcadosDe(sb, data.alvoId),
      postsCrus(sb, (base) =>
        base
          .eq("autor_id", data.alvoId)
          .is("arquivado_em", null)
          .order("criado_em", { ascending: false })
          .limit(POSTS_POR_PAGINA),
      ),
    ]);
    const deMarcacao = marcados.length
      ? await postsCrus(sb, (base) =>
          base
            .in("id", marcados)
            .is("arquivado_em", null)
            .order("criado_em", { ascending: false })
            .limit(POSTS_POR_PAGINA),
        )
      : [];
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

    /* ⚠️ **AS QUATRO ÚLTIMAS ESPERAS VIRARAM UMA.** Selo, bebê, a pílula do
       código e "eu já tenho código?" eram quatro `await` em fila, no fim da
       função — e nenhum depende do outro. Medido: eram as ondas 20, 21 e 22 de
       22, ou seja, um terço da espera total gasto DEPOIS de a tela já ter tudo
       que precisa para desenhar.

       ⚠️ A pílula do código só faz sentido no perfil de OUTRA pessoa: no meu,
       ela ofereceria que eu me indicasse. E `ref_code` é fixado UMA VEZ, então
       a tela precisa saber se eu já tenho ANTES de oferecer o botão. */
    const [selo, bebe, codigo, jaTenhoCodigo, seguidores] = await Promise.all([
      seloDe(a),
      /* ⚠️ `souEu` REAL, e não o forjado: sob a prévia ela é uma visitante, e a
         aba tem de mostrar o que a visitante veria. */
      bebeDe(a, !persona && data.alvoId === eu),
      data.alvoId === eu ? Promise.resolve(null) : codigoDeEmbaixadora(sb, data.alvoId),
      tenhoRefCode(sb, eu),
      /* ⚠️ Era um `await` DENTRO do objeto literal, o que é uma quinta espera
         escondida no meio da montagem — e a mais fácil de não ver. */
      persona || data.alvoId !== eu ? Promise.resolve(null) : contarSeguidores(sb, eu),
    ]);

    const perfil: PerfilNaTela = {
      id: data.alvoId,
      nome: (a.display_name ?? "").trim() || "Alguém",
      bio: a.bio ?? null,
      avatarUrl: a.avatar_url ?? null,
      publico: !!a.perfil_publico,
      oficial: ehContaOficial(a as any),
      /* Sob a prévia, o vínculo é o da PERSONA — senão a tela mostraria
         "Editar perfil" no lugar de "Seguir" enquanto afirma ser a visão de
         uma estranha. */
      meuVinculo: persona
        ? persona === "estranha"
          ? null
          : ("ativo" as const)
        : (((vinculo as any)?.estado as "ativo" | "pendente") ?? null),
      souEu: persona ? false : data.alvoId === eu,
      silenciado: persona ? false : ctx.silenciados.has(data.alvoId),
      /* ⚠️ `null` para terceiros — não existe contador público de seguidores.
         Um placar de audiência num app de gestação de alto risco mede
         popularidade num momento em que ela já está sendo medida clinicamente. */
      /* ⚠️ Era `0` CRAVADO, e a tela dizia "0 seguidores" logo acima de uma
         lista que abre com doze pessoas. O número existe em `meuPerfilSocial`
         desde sempre e nunca chegava aqui. */
      meusSeguidores: seguidores,
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
        /**
         * "Então e agora": o id de uma publicação ANTERIOR DELA, cuja foto vira
         * a PRIMEIRA do carrossel.
         *
         * ⚠️ **A foto antiga NÃO é reenviada** — o post novo aponta para o mesmo
         * arquivo no balde. Reenviar duplicaria ~300 KB por comparação e criaria
         * uma segunda cópia que a exclusão de conta teria de aprender a varrer.
         */
        comparacaoCom: z.string().uuid().optional(),
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

    /* ─── "ENTÃO E AGORA" ──────────────────────────────────────────────────
       ⚠️ **O post antigo tem de ser DELA**, conferido no banco. Sem isso, um id
       no corpo do pedido puxaria a foto de qualquer paciente da plataforma para
       dentro do carrossel dela — e a foto apareceria no feed sem que a dona
       soubesse.

       ⚠️ **E a foto antiga NÃO é reenviada**: o post novo aponta para o MESMO
       caminho no balde. */
    let entao: string | null = null;
    let fotoDoEntao: string | null = null;
    if (data.comparacaoCom) {
      const { data: velho } = await sb
        .from("rede_posts")
        .select("id, autor_id, imagem_path")
        .eq("id", data.comparacaoCom)
        .maybeSingle();
      if (velho && (velho as any).autor_id === eu && (velho as any).imagem_path) {
        entao = (velho as any).id as string;
        fotoDoEntao = (velho as any).imagem_path as string;
      }
      /* Não achou, não é dela ou não tem foto: publica como post comum. Recusar
         a publicação inteira por causa de um enfeite seria perder o texto que
         ela escreveu. */
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

    /* ⚠️ O "ENTÃO" É A PRIMEIRA FOTO, e a de agora vem depois. A ordem é a
       leitura: quem desliza vê o antes e então o depois. Invertida, o carrossel
       conta a história ao contrário. */
    if (fotoDoEntao && caminho) {
      extras.unshift(caminho);
      caminho = fotoDoEntao;
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
        /* ⚠️ **E ISTO FALTAVA — o carimbo do "então e agora" era código morto.**
           `entao` era resolvido, conferido contra o dono e usado para pôr a
           foto antiga na frente do carrossel, e então DESCARTADO: a coluna
           nunca era escrita, então `montarPosts` (que já sabia ler
           `comparacao_de` e chamar `carimboDaComparacao`) nunca achava um post
           comparado. A comparação existia como duas fotos e o "28s → 34s" — que
           é o recurso inteiro — não aparecia para ninguém, sem erro nenhum. */
        comparacao_de: entao,
      })
      .select("id")
      .single();

    /* ⚠️ Recuo para banco sem `enquete_opcoes`/`aula`, como em `perfisPorId` e
       `publicarStory`: o deploy chega antes do SQL, e sem isto PUBLICAR pararia
       de funcionar para todo mundo — não só a enquete. */
    if (error) {
      console.warn("[rede] post sem enquete/aula/comparacao — rode APLICAR_REDE_SOCIAL.sql");
      /* ⚠️ O recuo publica SEM o carimbo, e não sem a comparação: as duas fotos
         continuam no carrossel, na ordem certa. O que se perde é o "28s → 34s",
         que é enfeite — perder a publicação inteira por causa dele seria a
         troca errada. */
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
        /* ⚠️ **`ctx.amigas`, e NUNCA `saoAmigas` direto — as duas metades do
           mesmo recurso falhavam para lados opostos.** `saoAmigas` responde
           pelo `referred_by`, que SOBREVIVE ao encerramento da amizade (o
           recibo fica de propósito), e não sabe nada de `amizades_encerradas`
           quando essa leitura falha. `ctx.amigas` já é a lista com as
           encerradas subtraídas e VAZIA quando degradada — a mesma régua que
           destranca a camada `amigas` do feed. Sem isto, B encerrava a amizade
           e A ainda punha o nome dela embaixo de uma foto de barriga, com uma
           linha em `rede_atividade` — exatamente o vínculo do qual B pediu
           distância, e sem aviso nenhum. */
        somosAmigas: id === eu ? false : ctx.amigas.has(id),
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

/**
 * EDITAR A LEGENDA DE UM POST JÁ PUBLICADO.
 *
 * Hoje o único conserto de um erro de digitação era apagar o post e perder as
 * reações — e é a falta mais básica que restava na aba.
 *
 * ⚠️ **A RÉGUA CLÍNICA RODA AQUI, e é a razão de esta função existir por
 * inteiro em vez de um `update` na tela.** Sem ela, editar seria a PORTA DOS
 * FUNDOS de `publicarPost`: bastava publicar "que fofo" e depois trocar por
 * "não precisa ir ao pronto-socorro" para o texto proibido entrar no feed sem
 * passar por nada. É o mesmo texto, o mesmo alcance e o mesmo nome de
 * consultório em volta.
 *
 * ⚠️ **`.eq("autor_id", eu)` é o portão**, como em `apagarPost`: o `postId` vem
 * do cliente, e sem ele qualquer uuid reescreveria a legenda de qualquer
 * paciente da plataforma.
 *
 * ⚠️ **Só o TEXTO muda.** Foto, enquete, visibilidade, marcações e comparação
 * ficam como estavam — editar a camada de quem vê depois de o post ter sido
 * lido não desfaz a leitura, e trocar a foto faria as reações apontarem para
 * uma imagem que ninguém viu.
 *
 * ⚠️ **Modo Cuidado NÃO impede editar.** Ele impede PUBLICAR; quem entrou em
 * luto e quer corrigir ou esvaziar o que escreveu antes precisa poder — barrar
 * aqui a deixaria presa ao texto de quando estava grávida.
 */
export const editarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        texto: z.string().max(LIMITE_DO_TEXTO).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const texto = data.texto?.trim() || null;

    /* A régua clínica, a MESMA de `publicarPost` — ver o cabeçalho. */
    const { triarTexto } = await import("@/lib/pergunta-clinica");
    const desfecho = triarTexto(texto ?? "");
    if (desfecho !== "publicavel") {
      return { ok: false as const, motivo: desfecho, recado: recadoDeConteudo(desfecho) };
    }

    /* ⚠️ **UM POST NÃO PODE FICAR VAZIO PELA EDIÇÃO.** `postEhValido` recusa
       texto vazio sem imagem; apagar a legenda de um post que é só texto
       deixaria uma linha no feed sem nada dentro. Quem quer tirar o post do ar
       usa arquivar, que é a porta certa e reversível. */
    /* ⚠️ **RECUO POR COLUNA AUSENTE, e aqui ele mente de um jeito específico.**
       `enquete_opcoes` nasce num `APLICAR_` que o dono roda à mão, e o PostgREST
       recusa o SELECT INTEIRO por causa dela: `antes` vinha `null` e a paciente
       recebia "esta publicação não é sua" **sobre o próprio post**. Um erro de
       banco vestido de acusação de propriedade é a pior tradução possível. */
    const lerAntes = async (colunas: string) =>
      await sb
        .from("rede_posts")
        .select(colunas)
        .eq("id", data.postId)
        .eq("autor_id", eu)
        .maybeSingle();
    let leitura = await lerAntes("imagem_path, enquete_opcoes");
    if (leitura.error) leitura = await lerAntes("imagem_path");
    /* Falha nas DUAS não é "não é seu": é banco. */
    if (leitura.error) return { ok: false as const, motivo: "banco" as const };
    const antes = leitura.data;
    if (!antes) return { ok: false as const, motivo: "nao_e_seu" as const };
    const temEnquete = (((antes as any).enquete_opcoes ?? []) as string[]).length > 0;
    if (!temEnquete && !postEhValido({ texto, temImagem: !!(antes as any).imagem_path })) {
      return { ok: false as const, motivo: "vazio" as const };
    }

    const gravar = async (campos: Record<string, unknown>) =>
      await sb.from("rede_posts").update(campos).eq("id", data.postId).eq("autor_id", eu);

    let r = await gravar({ texto, editado_em: new Date().toISOString() });
    /* ⚠️ Recuo por coluna ausente: `editado_em` nasce num APLICAR_ que o dono
       roda à mão. Sem ele, editar pararia de funcionar inteiro por causa do
       SELO — e o selo é o acessório, não a edição. */
    if (r.error) {
      console.warn("[rede] sem editado_em — rode APLICAR_REDE_SOCIAL.sql");
      r = await gravar({ texto });
    }
    if (r.error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
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

    /* ⚠️ **ISTO SEMPRE FOI ARQUIVAR, E A TELA CHAMAVA DE APAGAR.**
       Marca, não apaga: as reações apontam para o post, e um DELETE levaria
       junto o registro de quem esteve ali. Só que a paciente lia "apagar" e
       tomava uma decisão que ela achava irreversível — e "apaguei o post do chá
       de bebê sem querer" é o arrependimento clássico do formato. O nome da
       tela passou a dizer a verdade, e `desarquivarPost` deu a volta que o
       banco sempre permitiu.
       O `.eq("autor_id")` é o que impede mexer em post alheio — o id vem do
       cliente. */
    const { error } = await sb
      .from("rede_posts")
      .update({ arquivado_em: new Date().toISOString() })
      .eq("id", data.postId)
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * DESARQUIVAR — a volta que o banco sempre permitiu e a tela não oferecia.
 *
 * ⚠️ **`.eq("autor_id", eu)` é o portão**, como no arquivar: sem ele, um uuid no
 * corpo do pedido traria de volta ao feed o post que outra pessoa tirou de
 * circulação — e ela não teria como saber que voltou.
 */
export const desarquivarPost = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), postId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ **Modo Cuidado NÃO impede desarquivar**, pela mesma razão de editar:
       o que ela tirou do ar é dela, e devolver ao feed é decisão dela. Quem
       impede o post NOVO é `publicarPost`. */
    const { error } = await sb
      .from("rede_posts")
      .update({ arquivado_em: null })
      .eq("id", data.postId)
      .eq("autor_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * A GAVETA: os posts que ela tirou do ar.
 *
 * ⚠️ **Só os DELA, e só ela vê.** `.eq("autor_id", eu)` é o recorte inteiro —
 * não há régua de visibilidade a aplicar aqui, porque não há terceiro nesta
 * tela. Uma lista de arquivados de outra pessoa seria o registro do que ela
 * decidiu esconder, que é o oposto de arquivar.
 */
export const meusArquivados = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const brutos = await postsCrus(sb, (base) =>
      base
        .eq("autor_id", eu)
        .not("arquivado_em", "is", null)
        .order("arquivado_em", { ascending: false })
        .limit(POSTS_POR_PAGINA),
    );

    /* ⚠️ Passa por `montarPosts` como qualquer outra lista — é ele que assina as
       URLs das fotos e traz reações e marcações. Montar à mão aqui daria uma
       tela com foto quebrada, que é como o arquivado pareceria perdido. */
    const ctx = await contextoDe(sb, eu);
    const posts = await montarPosts(sb, eu, brutos, ctx);
    return { ok: true as const, posts };
  });

/**
 * SILENCIAR / VOLTAR A OUVIR.
 *
 * ⚠️ **É CALADO e reversível, e ninguém é avisado** — a mesma decisão do
 * bloqueio e da saída de amizade: contar transformaria um gesto privado numa
 * briga, e num app onde as pessoas se conhecem da vida real isso piora a
 * situação que o motivou.
 *
 * ⚠️ **E não desfaz vínculo nenhum.** Ela continua seguindo, continua amiga,
 * continua podendo abrir o perfil. O que muda é só o feed.
 */
export const silenciar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        alvoId: z.string().uuid(),
        /** `false` volta a ouvir. */
        silenciar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };
    /* Silenciar a si mesma não faz sentido e esconderia os próprios posts do
       próprio feed — o feed já se protege, mas recusar aqui é mais honesto. */
    if (data.alvoId === eu) return { ok: false as const, motivo: "indisponivel" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!data.silenciar) {
      const { error } = await sb
        .from("rede_silenciados")
        .delete()
        .eq("quem_id", eu)
        .eq("silenciado_id", data.alvoId);
      if (error) return { ok: false as const, motivo: "banco" as const };
      return { ok: true as const };
    }

    const { error } = await sb
      .from("rede_silenciados")
      .upsert({ quem_id: eu, silenciado_id: data.alvoId }, { onConflict: "quem_id,silenciado_id" });
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
    /* ⚠️ **O SILÊNCIO É APLICADO AQUI, e SÓ AQUI.** Ele não entra em
       `podeVerPost` de propósito: silenciar é preferência de FEED, não régua de
       visibilidade. Visitar o perfil da silenciada continua mostrando tudo —
       ela foi até lá para ver. Se entrasse na régua, viraria um bloqueio de um
       lado só e a palavra passaria a mentir.

       ⚠️ E `|| id === eu` protege o caso bobo: silenciar a si mesma (que a tela
       não oferece, mas um pedido montado à mão sim) não pode esconder os
       próprios posts do próprio feed. */
    const de = [...new Set([eu, ...ctx.sigo, ...ctx.amigas])].filter(
      (id) => id === eu || (!ctx.bloqueio.has(id) && !ctx.silenciados.has(id)),
    );

    /* ⚠️ **O `.in()` VAI NA QUERY STRING, e ela tem teto.** Cada uuid custa 37
       caracteres na URL: 400 autores são ~15 kB de endereço, e o PostgREST
       (como todo servidor HTTP) recusa acima de alguns kB. Numa paciente muito
       conectada isto pararia de carregar de vez — 414, sem nada na tela dizendo
       o quê. E seria justamente quem MAIS usa a aba.

       ⚠️ **`eu` PRIMEIRO, sempre**: o teto nunca pode cortar o que ela publicou
       do próprio feed. */
    const recorte = [eu, ...de.filter((id) => id !== eu)].slice(0, AUTORES_NO_FEED);

    const brutos = await postsCrus(sb, (base) => {
      const q = base
        .in("autor_id", recorte)
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

/** As colunas que a zona de sugestões lê da candidata. */
const COLUNAS_DA_CANDIDATA =
  "id, display_name, avatar_url, bio, perfil_publico, care_mode, last_seen_at, conta_oficial, " +
  /* ⚠️ **AS DATAS SERVEM PARA ORDENAR, E NUNCA VIAJAM.** A fase é calculada
     aqui, no servidor, e o que sai para o cliente é a LISTA já recortada — o
     número da semana de ninguém sai desta função. Ver `fase-parecida.ts`. */
  "lmp_date, reference_date, reference_weeks, reference_days, birth_date";

/**
 * As candidatas a sugestão, com recuo para banco sem `conta_oficial`.
 *
 * ⚠️ **Sem o recuo, acrescentar a coluna apagaria a zona INTEIRA.** Este select
 * não passa por `perfisPorId`, então ele não herda o recuo de lá: num banco sem
 * `conta_oficial` o `42703` devolve `data: null`, `candidatas` fica vazia e a
 * função retorna cedo — nem publicações sugeridas, nem fileira de pessoas, nem
 * o convite que mora no fim do feed. Nada na tela, nada no log.
 */
async function candidatasPublicas(sb: any): Promise<any[]> {
  const { data, error } = await sb
    .from("patient_profiles")
    .select(COLUNAS_DA_CANDIDATA)
    .eq("perfil_publico", true)
    .limit(400);
  if (!error) return (data ?? []) as any[];
  console.warn("[rede] candidatas sem conta_oficial — rode APLICAR_CONTA_OFICIAL.sql");
  const { data: velhas } = await sb
    .from("patient_profiles")
    .select(COLUNAS_DA_CANDIDATA.replace(", conta_oficial", ""))
    .eq("perfil_publico", true)
    .limit(400);
  return ((velhas ?? []) as any[]).map((p) => ({ ...p, conta_oficial: false }));
}

/** Uma candidata virando linha da fileira de sugeridas. */
function naFileira(perfil: any): PessoaNaLista {
  return {
    id: perfil.id,
    nome: (perfil?.display_name ?? "").trim() || "Alguém",
    bio: perfil?.bio ?? null,
    avatarUrl: perfil?.avatar_url ?? null,
    /* ⚠️ `sigo` é sempre `null` aqui: quem eu sigo não entra no pool. E o
       número de elos NÃO viaja para o cliente — ele ordenou, e acabou. */
    sigo: null,
    souEu: false,
    oficial: ehContaOficial(perfil as any),
  };
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
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /**
         * Só quem está numa fase parecida com a dela.
         *
         * ⚠️ Opcional e DESLIGADO por padrão: o recorte é uma escolha dela, e
         * um filtro ligado sozinho esconderia gente sem que ela soubesse por
         * quê.
         */
        mesmaFase: z.boolean().optional(),
      })
      .parse(i),
  )
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
    const publicos = await candidatasPublicas(sb);

    const podeAparecer = ((publicos ?? []) as any[]).filter(
      (p) =>
        !fora(p.id) &&
        podeAparecerNaBusca({ publico: !!p.perfil_publico, emCuidado: !!p.care_mode }),
    );

    /* ─── ⚠️ O RECORTE POR FASE ──────────────────────────────────────────────
       Fase é biografia; diagnóstico é prontuário — e por isso o filtro é por
       FASE e nunca por condição clínica (ver `fase-parecida.ts`).

       ⚠️ **A fase é calculada AQUI e não sai daqui.** As datas entram no select
       só para ordenar; o que viaja ao cliente é a lista já recortada, e o
       número da semana de ninguém acompanha. Um "grupo da reta final" com lista
       visível contaria a fase de cada uma que está lá, desfazendo pela lateral
       a chave `mostrar_semana`.

       ⚠️ **Ligado e sem ninguém é um resultado LEGÍTIMO**, e a tela explica.
       Cair de volta na lista completa faria o interruptor parecer quebrado — e,
       pior, entregaria justamente as pessoas que ela pediu para não ver. */
    const candidatas = !data.mesmaFase
      ? podeAparecer
      : await (async () => {
          const { computeGestation } = await import("@/lib/gestacao");
          const { faseDe, mesmaFase } = await import("@/lib/fase-parecida");
          const faseDaLinha = (p: any): ReturnType<typeof faseDe> => {
            const g = computeGestation({
              lmp: p?.lmp_date ?? null,
              referenceDate: p?.reference_date ?? null,
              referenceWeeks: p?.reference_weeks ?? null,
              referenceDays: p?.reference_days ?? null,
              today: hojeEmSaoPaulo(),
            });
            return faseDe(g?.weeks ?? null, !!p?.birth_date);
          };
          const eusPerfis = await perfisPorId(sb, [eu]);
          const minha = faseDaLinha(eusPerfis.get(eu));
          return podeAparecer.filter((p) => mesmaFase(minha, faseDaLinha(p)));
        })();
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

    const pessoas = ranking
      .slice(0, PESSOAS_SUGERIDAS)
      .map((p) => naFileira(candidatas.find((c) => c.id === p.id) ?? { id: p.id }));

    /* ⚠️ **A CONTA OFICIAL VEM FIXADA NO TOPO, e não ordenada junto.**
       `ordenarPessoas` classifica por elos em comum, e a conta oficial não tem
       elos com ninguém: ela cairia no fim exatamente na conta NOVA, que é a
       única para quem ela importa — e resolver o dia um é o ponto inteiro
       dela. A régua está em `conta-oficial.ts`.

       ⚠️ **E ela é procurada entre as CANDIDATAS, nunca entre as `pessoas`.**
       `pessoas` já é o recorte de `PESSOAS_SUGERIDAS` do ranking, e a conta
       oficial cai no FIM dele justamente por não ter elo nenhum: procurá-la ali
       era procurar no único lugar de onde ela sempre tinha acabado de ser
       cortada, e `comOficialNoTopo` virava no-op silencioso. Achada fora do
       recorte, ela é montada e entra na frente. */
    const perfilOficial = candidatas.find((c) => ehContaOficial(c as any)) ?? null;

    return {
      ok: true as const,
      posts,
      /* Os ids que a tela precisa rotular "Sugerido para você". */
      sugeridos: posts.map((p) => p.id),
      pessoas: fileiraComOficial(pessoas, perfilOficial ? naFileira(perfilOficial) : null),
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
  /**
   * É a conta oficial do consultório?
   *
   * ⚠️ **É o selo do CONSULTÓRIO, e não o do obstetra dela** — aquele é
   * resolvido pelo vínculo ATUAL e só aparece na lista que a autora abre, para
   * não contar a terceiros quem é a médica dela. Este identifica uma conta
   * institucional, e é público por natureza. Ver `conta-oficial.ts`.
   */
  oficial?: boolean;
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
          oficial: ehContaOficial(p as any),
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
   * A MINHA reação a este story, ou `null`.
   *
   * ⚠️ **Só a minha — nunca a lista de quem reagiu, nem a contagem.** Um número
   * de reações no story seria um placar público de uma coisa que some em 24h, e
   * a aba inteira foi desenhada sem placar. Quem publicou vê os nomes na
   * Atividade dela, um a um, que é onde o afago tem sentido.
   */
  minhaReacao: TipoDeReacao | null;
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
    /* ⚠️ **O SILÊNCIO É APLICADO AQUI, e SÓ AQUI.** Ele não entra em
       `podeVerPost` de propósito: silenciar é preferência de FEED, não régua de
       visibilidade. Visitar o perfil da silenciada continua mostrando tudo —
       ela foi até lá para ver. Se entrasse na régua, viraria um bloqueio de um
       lado só e a palavra passaria a mentir.

       ⚠️ E `|| id === eu` protege o caso bobo: silenciar a si mesma (que a tela
       não oferece, mas um pedido montado à mão sim) não pode esconder os
       próprios posts do próprio feed. */
    const de = [...new Set([eu, ...ctx.sigo, ...ctx.amigas])].filter(
      (id) => id === eu || (!ctx.bloqueio.has(id) && !ctx.silenciados.has(id)),
    );

    /* ⚠️ **O `.in()` VAI NA QUERY STRING, e ela tem teto.** Cada uuid custa 37
       caracteres na URL: 400 autores são ~15 kB de endereço, e o PostgREST
       (como todo servidor HTTP) recusa acima de alguns kB. Numa paciente muito
       conectada isto pararia de carregar de vez — 414, sem nada na tela dizendo
       o quê. E seria justamente quem MAIS usa a aba.

       ⚠️ **`eu` PRIMEIRO, sempre**: o teto nunca pode cortar o que ela publicou
       do próprio feed. */
    const recorte = [eu, ...de.filter((id) => id !== eu)].slice(0, AUTORES_NO_FEED);

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
          .in("autor_id", recorte)
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

    /* ⚠️ SÓ AS MINHAS. Nunca a contagem nem a lista — um número de reações num
       story seria um placar público de uma coisa que some em 24h, e a aba
       inteira foi desenhada sem placar. Quem publicou vê os nomes na Atividade,
       um a um, que é onde o afago tem sentido.
       Recuo por tabela ausente: sem ele a fileira de stories inteira quebraria
       na janela entre o deploy e o SQL. */
    const minhaReacaoNo = new Map<string, TipoDeReacao>();
    try {
      const { data: minhas } = await sb
        .from("rede_story_reacoes")
        .select("story_id, tipo")
        .in(
          "story_id",
          linhas.map((l: any) => l.id),
        )
        .eq("quem_id", eu);
      for (const r of (minhas ?? []) as { story_id: string; tipo: string }[]) {
        if (reacaoConhecida(r.tipo)) minhaReacaoNo.set(r.story_id, r.tipo);
      }
    } catch {
      /* Sem a tabela, o visor abre sem reação marcada — e reagir grava assim
         que o SQL rodar. */
    }

    /* ⚠️ **EM LOTE, e este laço era SEQUENCIAL.** O `await urlAssinada` morava
       dentro do `for`, então uma fileira de vinte stories eram vinte viagens em
       fila indiana — e a fileira é a primeira coisa que a aba desenha. */
    const { urlsAssinadas } = await import("@/lib/imagens.server");
    const capasDosStories = await urlsAssinadas(
      "rede",
      linhas.map((l: any) => l.imagem_path).filter(Boolean),
      3600,
    );
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
        imagemUrl: capasDosStories.get(l.imagem_path) ?? null,
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
        minhaReacao: minhaReacaoNo.get(l.id) ?? null,
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
/**
 * REAGIR A UM STORY.
 *
 * ⚠️ **No modelo, isto vira uma MENSAGEM DIRETA para quem publicou.** Este app
 * não tem mensagem direta — e não vai ter, porque conversa privada entre
 * pacientes é exatamente o canal que a decisão de fechar os comentários evitou
 * (de 1.098 respostas com conselho em fóruns de gestação, 5,5% eram
 * potencialmente danosas, e o grupo não se autocorrige). Aqui a reação cai na
 * caixa de Atividade da autora, com o nome de quem reagiu, e mais nada: é um
 * afago, não uma conversa.
 *
 * ⚠️ **O portão de visibilidade é o MESMO de `votarNoStory`** — quem não
 * enxerga o story não reage a ele. Sem isso, um uuid sorteado que respondesse
 * `ok` confirmaria a existência de um story privado.
 *
 * ⚠️ **E o story VENCIDO não recebe reação.** Ele some da tela em 24 h; aceitar
 * uma reação depois disso encheria a Atividade dela com afagos a uma coisa que
 * ninguém mais vê — e abriria um caminho para mexer com quem já parou de
 * publicar.
 */
export const reagirAoStory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        storyId: z.string().uuid(),
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
      const { error } = await sb
        .from("rede_story_reacoes")
        .delete()
        .eq("story_id", data.storyId)
        .eq("quem_id", eu);
      if (error) return { ok: false as const, motivo: "banco" as const };
      return { ok: true as const };
    }
    if (!reacaoConhecida(data.tipo)) return { ok: false as const, motivo: "tipo" as const };

    const { data: story } = await sb
      .from("rede_stories")
      .select("id, autor_id, expira_em")
      .eq("id", data.storyId)
      .maybeSingle();
    if (!story) return { ok: false as const, motivo: "indisponivel" as const };
    if (new Date((story as any).expira_em).getTime() < Date.now()) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    /* O MESMO portão de `votarNoStory`: só quem enxerga o story reage nele. */
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
      .from("rede_story_reacoes")
      .upsert(
        { story_id: data.storyId, quem_id: eu, tipo: data.tipo },
        { onConflict: "story_id,quem_id" },
      );
    if (error) return { ok: false as const, motivo: "banco" as const };

    /* ⚠️ O aviso é o PONTO INTEIRO. Uma reação que a autora nunca vê é um
       botão que não faz nada — e `registrarAtividade` já ignora quando dono e
       quem são a mesma pessoa. */
    await registrarAtividade(sb, {
      donoId: (story as any).autor_id,
      quemId: eu,
      especie: "reagiu_story",
      postId: data.storyId,
    });
    return { ok: true as const };
  });

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
    /* Em lote: trinta publicações da semana custavam trinta assinaturas. */
    const { urlsAssinadas } = await import("@/lib/imagens.server");
    const { montarRetrospectiva } = await import("@/lib/retrospectiva");
    const capas = await urlsAssinadas(
      "rede",
      brutos.map((p: any) => p.imagem_path).filter(Boolean),
      3600,
    );

    const posts = brutos.map((p: any) => ({
      id: p.id as string,
      criadoEm: p.criado_em as string,
      imagemUrl: p.imagem_path ? (capas.get(p.imagem_path) ?? null) : null,
      reacoes: totalDeReacoes(porPost.get(p.id) ?? {}),
    }));

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
    /* ⚠️ **`eu` ENTRA NA LISTA, e sem isso o selo do médico nunca aparecia.**
       O mapa era montado só com QUEM REAGIU, e logo abaixo se lia
       `perfis.get(eu)?.doctor_id` para descobrir quem é o obstetra dela — que
       só existiria no mapa se ela tivesse reagido ao próprio post. Na prática
       `meuMedico` era `null` sempre, e o selo, que é o ponto inteiro desta
       tela, não saía nunca. Custa um id a mais na MESMA consulta. */
    const perfis = await perfisPorId(sb, [eu, ...cruas.map((l) => l.quem_id)]);

    /* ─── O SELO DO MÉDICO ─────────────────────────────────────────────────
       ⚠️ **Resolvido pelo VÍNCULO ATUAL** (`patient_profiles.doctor_id` DELA),
       nunca por um campo vindo do cliente e nunca pelo que estava carimbado na
       linha da reação. Ela pode ter trocado de médico depois; o selo tem de
       dizer quem é o obstetra dela HOJE.

       ⚠️ **E ele só aparece AQUI**, numa lista que só a autora abre. Um selo
       visível no feed contaria a terceiros que aquela pessoa é a médica dela —
       e expor um vínculo clínico aos seguidores é exatamente o que o dono
       proibiu ("os seguidores dela não têm que saber isso").

       ⚠️ **O médico NÃO TEM linha em `patient_profiles`**, então `perfisPorId`
       não o acha e a reação dele SUMIRIA da lista — o mais importante dos
       reagentes seria o único invisível. O nome dele vem de `doctors`. */
    const meuMedico = ((perfis.get(eu) as any)?.doctor_id ?? null) as string | null;
    const nomesDeMedico = new Map<string, string>();
    const semPerfil = cruas.map((l) => l.quem_id).filter((id) => !perfis.has(id));
    if (semPerfil.length) {
      try {
        const { data: docs } = await sb
          .from("doctors")
          .select("id, display_name")
          .in("id", [...new Set(semPerfil)]);
        const { nomeDoMedico } = await import("@/lib/nome-do-medico");
        for (const d of (docs ?? []) as { id: string; display_name: string | null }[]) {
          nomesDeMedico.set(d.id, nomeDoMedico(d.display_name) ?? "Seu médico");
        }
      } catch {
        /* Sem a tabela, quem não tem perfil some — o comportamento de antes. */
      }
    }

    const gente = cruas
      .map((l) => {
        const p = perfis.get(l.quem_id);
        const nomeMedico = nomesDeMedico.get(l.quem_id);
        if (!p && !nomeMedico) return null;
        /* ⚠️ Tipo desconhecido (gravado por uma versão futura, ou por um banco
           com o CHECK largo) cai no coração em vez de sumir: perder a LINHA
           faria o número discordar da lista. */
        const tipo = reacaoConhecida(l.tipo) ? l.tipo : ("amei" as TipoDeReacao);
        return {
          id: l.quem_id,
          nome: nomeMedico ?? ((p!.display_name ?? "").trim() || "Alguém"),
          avatarUrl: p?.avatar_url ?? null,
          tipo,
          emoji: emojiDaReacao(tipo),
          /* O selo, e só quando for o médico DELA hoje. */
          ehMeuMedico: !!meuMedico && l.quem_id === meuMedico,
        };
      })
      .filter(Boolean) as {
      id: string;
      nome: string;
      avatarUrl: string | null;
      tipo: TipoDeReacao;
      emoji: string;
      ehMeuMedico: boolean;
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
      /* ⚠️ Em lote, e este laço também era SEQUENCIAL: a caixa do coração
         mostra até cinquenta linhas, e cada capa era uma viagem esperando a
         anterior. */
      const { urlsAssinadas } = await import("@/lib/imagens.server");
      const assinadas = await urlsAssinadas(
        "rede",
        ((ps ?? []) as any[]).map((p) => p.imagem_path).filter(Boolean),
        3600,
      );
      for (const p of (ps ?? []) as any[]) {
        const u = p.imagem_path ? assinadas.get(p.imagem_path) : null;
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
 * MARCA QUE EU VI ESTES POSTS.
 *
 * ─── O SILÊNCIO QUE FAZ ALGUÉM PARAR DE PUBLICAR ────────────────────────────
 *
 * O story tem "visto por" desde o começo; o post não tinha nada. Publicar sem
 * saber se alguém viu é falar para uma parede — e numa base pequena o silêncio
 * total lê como "ninguém se importa" mesmo quando trinta pessoas viram e
 * nenhuma reagiu.
 *
 * ⚠️ **SÓ O NÚMERO CHEGA À AUTORA, NUNCA A LISTA** — e a diferença em relação
 * ao story é deliberada. O story some em 24h e é uma foto solta; o post é
 * permanente e pode ser um desabafo. Entregar quem LEU o desabafo produz a
 * pergunta "por que a fulana viu e não reagiu?", que é exatamente o tipo de
 * leitura que esta aba não pode induzir. `quem_id` existe para contar UMA vez
 * por pessoa, é gravado e nunca devolvido — a mesma decisão da caixinha
 * anônima.
 *
 * ⚠️ **EM LOTE, e não uma chamada por post.** Um feed de vinte posts daria
 * vinte idas ao servidor enquanto ela rola — e a rolagem é justamente o
 * momento em que a linha principal não pode estar ocupada.
 *
 * ⚠️ **A MINHA PRÓPRIA visualização não conta.** Abrir o próprio perfil
 * inflaria o número de todos os posts dela de uma vez, e o número perderia o
 * único sentido que tem: quantas OUTRAS pessoas viram.
 *
 * ⚠️ **E ela nunca derruba nada.** Falha de rede, tabela ausente (`42P01`,
 * antes de o dono rodar o SQL) ou colisão de chave são silêncio: é métrica no
 * meio de uma rolagem.
 */
export const marcarPostsVistos = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /* Teto de 60: é mais que qualquer leva do feed, e impede um corpo
           montado à mão de mandar dez mil ids numa instrução só. */
        postIds: z.array(z.string().uuid()).min(1).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      /* ⚠️ `ignoreDuplicates`: quem dedupa é a chave primária, e `23505` aqui é
         sucesso repetido — ela já tinha visto. Tratar como erro faria a tela
         tentar de novo a cada rolagem. */
      const { error } = await sb.from("rede_post_vistas").upsert(
        data.postIds.map((post_id) => ({ post_id, quem_id: eu })),
        { onConflict: "post_id,quem_id", ignoreDuplicates: true },
      );
      /* ⚠️ **O erro é LIDO e engolido de propósito, e a diferença importa.**
         Engolir sem ler é o defeito que a catraca de escritas persegue (o
         webhook da Stripe: cinco escritas sem checagem e a médica pagando sem
         receber o plano). Aqui a decisão é o contrário e é explícita: isto é
         métrica no meio de uma rolagem, e derrubar a leitura do feed porque um
         contador não gravou seria a pior troca possível. O `warn` existe para
         o caso mais provável — a tabela ainda não aplicada. */
      if (error) console.warn("[rede] vistas do post não gravaram", error.code);
    } catch {
      /* Métrica: nunca derruba a rolagem. */
    }
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
    z
      .object({
        accessToken: z.string().min(10),
        postId: z.string().uuid(),
        /* Catálogo fechado — ver `denuncias.ts`. O zod aceita a string e quem
           decide é `motivoConhecido`, para a lista viver num lugar só. */
        motivo: z.string().max(20),
      })
      .parse(i),
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

    const { motivoConhecido } = await import("@/lib/denuncias");
    if (!motivoConhecido(data.motivo)) return { ok: false as const, motivo: "motivo" as const };

    /* ⚠️ O TRECHO É CONGELADO AQUI. Se ela editar ou arquivar o post depois, a
       fila continua sabendo o que foi denunciado — sem isso, a linha da
       administração apontaria para um texto que já não existe, e a denúncia
       viraria impossível de julgar. */
    const { error } = await sb.from("rede_denuncias").insert({
      alvo: "post",
      alvo_id: visivel.id,
      denunciada_id: visivel.autorId,
      quem_id: eu,
      motivo: data.motivo,
      trecho: (visivel.texto ?? "(sem legenda)").slice(0, 400),
    });
    /* Duplicata é SUCESSO REPETIDO: ela tocou duas vezes, e dizer "erro" a
       faria tentar de novo. */
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("[rede] denúncia não gravou", error);
      return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });

/**
 * A FILA DA PLATAFORMA — quem foi denunciada, e por quê.
 *
 * Pedido do dono: "a plataforma tem que ter o conhecimento dos perfis
 * denunciados, e por que foi denunciado".
 *
 * ⚠️ **Aqui o NOME da denunciada APARECE, ao contrário da fila da caixinha.** E
 * a diferença não é descuido: na caixinha o que se julga é uma pergunta anônima,
 * e revelar quem escreveu quebraria a promessa que faz a caixa existir. Aqui o
 * que se julga é uma CONTA — e agir sobre ela (avisar, suspender, remover) é
 * impossível sem saber qual é. É o que a diretriz 1.2 pede.
 *
 * ⚠️ **Quem DENUNCIOU continua invisível**, inclusive para o administrador. Ele
 * precisa do alvo, do motivo e da reincidência; saber quem apertou o botão só
 * abriria caminho para retaliação, e num app onde as pessoas se conhecem da
 * vida real isso é concreto.
 *
 * ⚠️ **A reincidência é contada por PESSOA e sobre a fila INTEIRA** (inclusive
 * as já resolvidas): uma conta com três denúncias resolvidas e uma nova não é
 * uma conta com uma denúncia. A régua está em `denuncias.ts`, testada.
 */
export const denunciasDaRede = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u.user?.email?.trim().toLowerCase();
    const permitidos = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !permitidos.includes(email)) {
      return { ok: false as const, motivo: "sem_acesso" as const };
    }

    const sb = supabaseAdmin as any;

    /* Todas as linhas servem para CONTAR a reincidência; só as abertas vão para
       a tela. Duas consultas seriam duas viagens para o mesmo dado. */
    const { data: linhas, error } = await sb
      .from("rede_denuncias")
      .select("id, alvo, alvo_id, denunciada_id, quem_id, motivo, trecho, criado_em, resolvido_em")
      .order("criado_em", { ascending: false })
      .limit(400);
    if (error) {
      /* ⚠️ Falha ao ler devolve ERRO, e nunca lista vazia: "está tudo limpo" é
         a frase mais perigosa que uma fila de denúncias pode dizer errado. É a
         mesma régua de `denunciasAbertas` na caixinha. */
      console.warn("[rede] sem rede_denuncias — rode APLICAR_REDE_SOCIAL.sql");
      return { ok: false as const, motivo: "banco" as const };
    }

    const todas = (linhas ?? []) as {
      id: string;
      alvo: "post" | "perfil";
      alvo_id: string;
      denunciada_id: string;
      quem_id: string;
      motivo: string;
      trecho: string | null;
      criado_em: string;
      resolvido_em: string | null;
    }[];

    const { ordenarFila, reincidenciasPorPessoa } = await import("@/lib/denuncias");
    const quantas = reincidenciasPorPessoa(
      todas.map((l) => ({ denunciadaId: l.denunciada_id, quemId: l.quem_id })),
    );

    const abertas = todas.filter((l) => !l.resolvido_em);
    const perfis = await perfisPorId(sb, [...new Set(abertas.map((l) => l.denunciada_id))]);

    const fila = abertas.map((l) => ({
      id: l.id,
      alvo: l.alvo,
      denunciadaId: l.denunciada_id,
      denunciadaNome: (perfis.get(l.denunciada_id)?.display_name ?? "").trim() || "Sem nome",
      motivo: l.motivo as never,
      trecho: l.trecho,
      quando: l.criado_em,
      reincidencias: quantas.get(l.denunciada_id) ?? 1,
    }));

    return { ok: true as const, fila: ordenarFila(fila) };
  });

/** Marcar uma denúncia como olhada. */
export const resolverDenunciaDaRede = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), denunciaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u.user?.email?.trim().toLowerCase();
    const permitidos = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !permitidos.includes(email)) {
      return { ok: false as const, motivo: "sem_acesso" as const };
    }

    const sb = supabaseAdmin as any;
    /* ⚠️ MARCA, não apaga: a linha resolvida continua contando para a
       reincidência da conta. Apagar faria a quinta denúncia parecer a
       primeira. */
    const { error } = await sb
      .from("rede_denuncias")
      .update({ resolvido_em: new Date().toISOString() })
      .eq("id", data.denunciaId);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * DENUNCIAR UM PERFIL.
 *
 * ⚠️ **Ele não existia, e é o canal que faltava.** Dava para denunciar um POST —
 * mas o problema quase nunca é uma publicação: é uma conta que insiste, que
 * copia foto de outra pessoa, ou que distribui conselho de saúde em toda parte.
 * Denunciar o post errado de quem faz isso não descreve o problema.
 *
 * ⚠️ **É CALADO**, como o bloqueio: a denunciada não é avisada. Anunciar
 * transformaria uma proteção num confronto, e num app onde as pessoas se
 * conhecem da vida real isso piora a situação que a motivou.
 */
export const denunciarPerfil = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        alvoId: z.string().uuid(),
        motivo: z.string().max(20),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    /* ⚠️ Denunciar a SI MESMA abriria um jeito barato de encher a fila. */
    if (data.alvoId === eu) return { ok: false as const, motivo: "indisponivel" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { motivoConhecido } = await import("@/lib/denuncias");
    if (!motivoConhecido(data.motivo)) return { ok: false as const, motivo: "motivo" as const };

    /* ⚠️ **O ALVO PRECISA EXISTIR**, e a conferência é a mesma da leitura de
       perfil. Sem ela, um uuid sorteado que respondesse `ok` confirmaria que
       aquela conta existe — o mesmo vazamento pela porta dos fundos que
       `denunciarPost` já evita. */
    const perfis = await perfisPorId(sb, [data.alvoId]);
    if (!perfis.get(data.alvoId)) return { ok: false as const, motivo: "indisponivel" as const };

    const { error } = await sb.from("rede_denuncias").insert({
      alvo: "perfil",
      alvo_id: data.alvoId,
      denunciada_id: data.alvoId,
      quem_id: eu,
      motivo: data.motivo,
      trecho: null,
    });
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("[rede] denúncia de perfil não gravou", error);
      return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });
