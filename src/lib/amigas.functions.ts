/**
 * A ABA DAS AMIGAS — servidor.
 *
 * ─── O GRAFO É O DA INDICAÇÃO, NOS DOIS SENTIDOS ────────────────────────────
 *
 * Amiga é quem eu indiquei (`referred_by = eu`) ou quem me indicou
 * (`meu referred_by`). Não há busca, não há pedido de estranho, não há
 * aceitar/recusar amizade — para duas contas se enxergarem aqui foi preciso
 * que uma mandasse o convite para a outra FORA do app.
 *
 * Isso não é economia de trabalho: é o que torna a aba segura sem moderação.
 * Num app de gestação, uma lista de desconhecidas trocando mensagens é um
 * problema de conselho médico de leiga e de assédio ao mesmo tempo — e nenhum
 * dos dois se resolve depois.
 *
 * ─── O VÍNCULO É CONFERIDO ANTES DE TODA LEITURA ────────────────────────────
 *
 * Toda função que recebe um `amigaId` do cliente passa por `saoAmigas` antes de
 * ler qualquer coisa. Sem isso, qualquer uuid no corpo do pedido devolveria o
 * Cantinho e o perfil de qualquer paciente da plataforma — o mesmo defeito que
 * `contatoDaPaciente` teve no painel do médico.
 *
 * ─── MODO CUIDADO TIRA A PESSOA DA ABA, SEM ANUNCIAR ────────────────────────
 *
 * Quem está em Modo Cuidado não aparece na lista das outras, não recebe
 * presente e não tem perfil visitável. E o texto que sobra nunca diz por quê —
 * "Fulana saiu" contaria a perda dela para todo mundo. Ela simplesmente não
 * está lá, como quem não entrou ainda.
 */
import { createServerFn } from "@tanstack/react-start";
import { BONUS_DA_DUPLA } from "@/lib/economia-sementinhas";
import { z } from "zod";
import { PREFIXO_ATIVIDADE, trofeusDasChaves } from "@/lib/trofeus";
import {
  diaLocal,
  diasDeAtividade,
  diasJuntas,
  diasSemAparecer,
  estadoDaDupla,
  maiorSequenciaDaDupla,
  parOrdenado,
  saneiaEnfeites,
  sequenciaDaDupla,
} from "@/lib/amigas";
import type { EstadoDaDupla, PerfilDeAmiga } from "@/lib/amigas";

const WELLNESS = ["movement", "meditation", "bonding", "gratitude"];

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(accessToken);
  return data.user?.id ?? null;
}

/** Modo Cuidado — a aba inteira se cala para quem está nele. */
async function emLuto(sb: any, uid: string): Promise<boolean> {
  const { isCareModeActive } = await import("@/lib/care-mode.functions");
  return isCareModeActive(sb, uid);
}

/**
 * SÃO AMIGAS? Indicação nos dois sentidos, e nunca consigo mesma.
 *
 * Lê os dois perfis numa consulta só e compara — mais barato que duas idas ao
 * banco e, o que importa mais, impossível de responder "sim" por metade.
 */
export async function saoAmigas(sb: any, eu: string, outra: string): Promise<boolean> {
  if (!outra || outra === eu) return false;

  /* ⚠️ QUEM ENCERROU NÃO É AMIGA, e esta é a primeira pergunta — antes das
     duas fontes. Sem isto, `perfilDaAmiga`, `convidarDupla` e o presente
     continuariam atravessando uma saída que a lista já respeita. */
  if ((await encerradasCom(sb, eu)).fora.has(outra)) return false;

  const { data } = await sb
    .from("patient_profiles")
    .select("id, referred_by")
    .in("id", [eu, outra]);
  const linhas = (data ?? []) as { id: string; referred_by: string | null }[];
  const minha = linhas.find((l) => l.id === eu);
  const dela = linhas.find((l) => l.id === outra);
  if (minha && dela && (minha.referred_by === outra || dela.referred_by === eu)) return true;

  /* ⚠️ O SEGUNDO GRAFO CONTA IGUAL. `saoAmigas` é o portão de TUDO (perfil,
     Cantinho, dupla, presente): se ele só conhecesse a indicação, a amiga que
     entrou por pedido+aceite apareceria na lista e seria recusada em todas as
     ações — uma amiga de segunda classe, com botões que não funcionam. */
  return (await amizadesAceitas(sb, eu)).has(outra);
}

/**
 * Os ids de todas as amigas — quem eu indiquei ∪ quem me indicou ∪ quem
 * ACEITOU um convite meu (ou de quem eu aceitei).
 *
 * ⚠️ Devolve as duas coisas: a UNIÃO (quem aparece na lista) e o subconjunto
 * que EU trouxe. Só este último pode receber presente meu — `presentearAmiga`
 * exige `.eq("referred_by", uid)` —, e sem separar os dois a tela desenhava o
 * 🎁 na linha de quem me trouxe, para o servidor recusar com uma frase falsa.
 */
export async function idsDasAmigas(
  sb: any,
  eu: string,
): Promise<{ todas: string[]; trazidasPorMim: Set<string>; degradada: boolean }> {
  /* ⚠️ **AS QUATRO CONSULTAS NUMA ONDA SÓ.** Elas eram SEQUENCIAIS — quem me
     trouxe, depois quem eu trouxe, depois as amizades aceitas, depois as
     encerradas — e nenhuma depende da anterior: as quatro são recortadas pelo
     MESMO `eu`. Medido com uma bancada que conta as idas ao banco: abrir um
     perfil custava 24 viagens em 18 ondas seriais, e QUATRO dessas ondas eram
     estas. Como `idsDasAmigas` é chamada por `contextoDe`, que abre toda
     leitura da rede, a espera aparecia no feed, no perfil, no post, nos salvos,
     nos sugeridos e na atividade. */
  const [{ data: minha }, { data: trazidas }, aceitas, encerradasR] = await Promise.all([
    sb.from("patient_profiles").select("referred_by").eq("id", eu).maybeSingle(),
    sb.from("patient_profiles").select("id").eq("referred_by", eu).limit(200),
    amizadesAceitas(sb, eu),
    encerradasCom(sb, eu),
  ]);

  const ids = new Set<string>();
  const quemMeTrouxe = (minha as { referred_by?: string | null } | null)?.referred_by;
  if (quemMeTrouxe) ids.add(quemMeTrouxe);
  const trazidasPorMim = new Set<string>();
  for (const r of (trazidas ?? []) as { id: string }[]) {
    ids.add(r.id);
    trazidasPorMim.add(r.id);
  }

  /* ─── O SEGUNDO GRAFO ────────────────────────────────────────────────
     A indicação liga quem entrou pelo link de alguém; ela não tem como ligar
     duas contas que já existiam. `amizades` é o pedido+aceite entre contas
     existentes, e as duas fontes somam — uma amiga pode ter chegado por
     qualquer uma das duas portas, e da lista para baixo elas são iguais. */
  for (const outra of aceitas) ids.add(outra);

  /* ─── ⚠️ AS AMIZADES ENCERRADAS SAEM AQUI ────────────────────────────
     No SERVIDOR, e antes de qualquer leitura — é a mesma regra do Modo
     Cuidado: filtrar na tela deixaria o nome e o Cantinho dela viajarem pela
     rede de alguém de quem ela pediu distância.

     E sai dos DOIS lados: a linha é do par, não de quem pediu. Uma saída que
     só esconde de quem pediu deixa a outra continuar convidando para dupla e
     presenteando — ou seja, não é saída nenhuma. */
  /* ⚠️ FILTRO, e não `ids.delete(...)`. A catraca de "escrita no banco sem
     checagem de erro" (`travas-do-servidor.test.ts`) casa com `.delete(` por
     TEXTO, então um `Set.delete` entra na conta como se fosse um DELETE de
     tabela — é a mesma armadilha que a linha logo abaixo já documenta, e eu
     caí nela de novo ao escrever este bloco. */
  const { fora: encerradas, falhou: degradada } = encerradasR;
  const vivas = [...ids].filter((id) => !encerradas.has(id));
  const trazidasVivas = new Set([...trazidasPorMim].filter((id) => !encerradas.has(id)));
  /* Filtro em vez de `ids.delete(eu)`: a catraca de "escrita no banco sem
     checagem de erro" (`travas-do-servidor.test.ts`) casa com `.delete(` por
     texto, e um `Set.delete` aqui entrava na conta como se fosse um DELETE de
     tabela. Inflar a dívida com falso positivo é pior que a linha extra —
     esconde a dívida real atrás de ruído. */
  return { todas: vivas.filter((id) => id !== eu), trazidasPorMim: trazidasVivas, degradada };
}

/**
 * COM QUEM EU JÁ ENCERREI A AMIZADE.
 *
 * ⚠️ Falha de leitura devolve conjunto VAZIO, e aqui isso é o lado ERRADO por
 * construção — sem a lista, a amiga encerrada reaparece. Não há como fazer
 * melhor sem transformar uma falha de rede em "a aba inteira sumiu", que é
 * pior: a paciente perderia todas as amigas por causa de uma consulta lenta.
 *
 * O que fechava o buraco não era este `catch`, era o SERVIDOR: `presentearAmiga`
 * e `convidarDupla` conferem o vínculo por conta própria, então o pior caso na
 * aba Amigas é um nome reaparecendo na lista por uma abertura.
 *
 * ⚠️ **ESSA JUSTIFICATIVA DEIXOU DE VALER NO DIA EM QUE A REDE SOCIAL PASSOU A
 * CONSUMIR `idsDasAmigas`.** Lá não há segunda conferência: `ctx.amigas` É a
 * régua final, e ela decide duas coisas graves — quem enxerga a camada
 * `amigas` (a mais restrita, o desabafo de terça) e quem ATRAVESSA um perfil
 * privado (`alcancaOPerfil` aceita `somosAmigas`). Uma amiga encerrada
 * reaparecendo ali não é um nome na lista: é o post fechado dela sendo lido por
 * quem ela pediu distância.
 *
 * Por isso a falha passou a ser DECLARADA (`degradada`), e cada chamador
 * escolhe: a aba Amigas continua tolerante (perder todas as amigas por uma
 * consulta lenta é pior), e a rede fecha.
 *
 * A tabela pode não existir (`APLICAR_AMIZADES.sql` é do dono): o `catch`
 * cobre isso, e a aba continua inteira sem ela.
 */
async function encerradasCom(sb: any, eu: string): Promise<{ fora: Set<string>; falhou: boolean }> {
  try {
    const { data, error } = await sb
      .from("amizades_encerradas")
      .select("menor, maior")
      .or(`menor.eq.${eu},maior.eq.${eu}`)
      .limit(500);
    if (error || !data) return { fora: new Set(), falhou: true };
    const fora = new Set<string>();
    for (const l of data as { menor: string; maior: string }[]) {
      fora.add(l.menor === eu ? l.maior : l.menor);
    }
    return { fora, falhou: false };
  } catch {
    return { fora: new Set(), falhou: true };
  }
}

/**
 * QUEM JÁ GANHOU PRESENTE MEU NESTE CICLO.
 *
 * ⚠️ Sai do LEDGER, e não da memória da tela. A chave é
 * `amiga:<eu>:<amiga>:<ciclo>` — a MESMA que `presentearAmiga` grava —, então
 * não há duas verdades: o que a tela desenha é o que o servidor vai aceitar.
 *
 * Falha de leitura devolve conjunto VAZIO, e aqui isso é o lado seguro: o 🎁
 * continua à mostra e, se ela tocar, o servidor recusa com a frase certa
 * ("já presenteou neste mês"). O contrário — esconder por não ter conseguido
 * ler — tiraria dela uma ação legítima sem explicar por quê.
 */
async function presenteadasNoCiclo(sb: any, eu: string): Promise<Set<string>> {
  try {
    const { inicioDoCiclo } = await import("@/lib/cota-ia.server");
    const ciclo = inicioDoCiclo().toISOString().slice(0, 7);
    const prefixo = `amiga:${eu}:`;
    /* ⚠️ SEM `.eq("user_id", eu)` — E ESTE FILTRO ZERAVA A FUNÇÃO INTEIRA.
       A linha do presente é gravada com `user_id` de quem RECEBE
       (`grantSementinhas(db, data.amigaId, …)`), não de quem dá. Filtrando por
       mim, nenhuma linha casava: o `Set` voltava sempre vazio, `jaPresenteada`
       era sempre `false`, e o 🎁 reabilitava a cada visita para o servidor
       recusar com "você já presenteou Fulana neste mês".

       Ou seja: era exatamente o defeito que esta função foi escrita para
       consertar, reintroduzido pelo lado de dentro. A irmã `lerMesadaDaAmiga`
       sempre leu certo (ela não filtra `user_id`) — os dois leitores do mesmo
       dado discordavam.

       Quem recorta é o PREFIXO `amiga:<eu>:`, que já carrega o meu id. */
    const { data, error } = await sb
      .from("sementinhas_ledger")
      .select("dedupe_key")
      .like("dedupe_key", `${prefixo}%`)
      .limit(1000);
    if (error || !data) return new Set();
    const fora = new Set<string>();
    for (const r of data as { dedupe_key: string | null }[]) {
      const k = r.dedupe_key ?? "";
      if (!k.startsWith(prefixo) || !k.endsWith(`:${ciclo}`)) continue;
      fora.add(k.slice(prefixo.length, k.length - ciclo.length - 1));
    }
    return fora;
  } catch {
    return new Set();
  }
}

/** As linhas de bem-estar de várias pacientes, para chama e troféus. */
async function atividadesDe(sb: any, ids: string[]) {
  if (ids.length === 0) return [] as { user_id: string; dedupe_key: string; created_at: string }[];
  const { data } = await sb
    .from("sementinhas_ledger")
    .select("user_id, dedupe_key, created_at")
    .in("user_id", ids)
    .like("dedupe_key", `${PREFIXO_ATIVIDADE}%`)
    .limit(20000);
  return (data ?? []) as { user_id: string; dedupe_key: string; created_at: string }[];
}

/** Agrupa por paciente — uma consulta, N perfis. */
function porPaciente<T extends { user_id: string }>(linhas: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of linhas) {
    const lista = m.get(l.user_id) ?? [];
    lista.push(l);
    m.set(l.user_id, lista);
  }
  return m;
}

/** A chama individual de alguém, contada pelo CALENDÁRIO (ver `amigas.ts`). */
function chamaDe(linhas: { dedupe_key: string; created_at: string }[], hoje: string): number {
  const dias = diasDeAtividade(linhas);
  return sequenciaDaDupla(dias, dias, hoje);
}

/* ══════════════════════════ A LISTA ══════════════════════════ */

export const minhasAmigas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* Quem está em Modo Cuidado não vê a aba, do mesmo jeito que não vê a loja
       nem o saldo. A lista volta vazia e a tela mostra o estado de silêncio. */
    if (await emLuto(sb, eu)) {
      return { ok: true as const, careMode: true as const, amigas: [], dupla: null };
    }

    const { todas: ids, trazidasPorMim: trazidasIds } = await idsDasAmigas(sb, eu);
    if (ids.length === 0) {
      return { ok: true as const, careMode: false as const, amigas: [], dupla: null };
    }

    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id, display_name, baby_name, care_mode, created_at, avatar_url, last_seen_at")
      .in("id", ids);

    /* As em luto saem AQUI, e não na tela: um filtro de cliente deixaria o
       nome viajar pela rede, e o simples fato de ela ter sumido da lista já
       diria à amiga o que aconteceu. */
    const visiveis = ((perfis ?? []) as any[]).filter((p) => !p.care_mode);
    const linhas = await atividadesDe(
      sb,
      visiveis.map((p) => p.id),
    );
    const agrupado = porPaciente(linhas);
    const hoje = diaLocal(new Date());

    /* ─── QUEM EU POSSO PRESENTEAR, E QUEM JÁ GANHOU ─────────────────────
       Duas perguntas que a TELA não tem como responder sozinha, e que ela
       precisava responder para não desenhar um 🎁 que o servidor recusa.
       Ver `possoPresentear` e `jaPresenteada` em `PerfilDeAmiga`. */
    const jaGanharam = await presenteadasNoCiclo(sb, eu);
    const aceitas = await amizadesAceitas(sb, eu);

    const amigas: PerfilDeAmiga[] = visiveis.map((p) => {
      const dela = agrupado.get(p.id) ?? [];
      return {
        id: p.id,
        nome: (p.display_name ?? "").trim() || "Amiga",
        bebe: (p.baby_name ?? "").trim() || null,
        sequencia: chamaDe(dela, hoje),
        trofeus: trofeusDasChaves(
          dela.map((l) => l.dedupe_key),
          WELLNESS,
        ),
        itens: 0,
        diasNoApp: p.created_at
          ? Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000))
          : 0,
        /* ⚠️ Os DOIS grafos. Era só `trazidasIds` (quem eu indiquei), e com o
           convite entre contas existentes isso deixaria metade das amigas sem
           o 🎁 — na lista, mas impossíveis de presentear. `presentearAmiga`
           confere pela mesma régua (`saoAmigasParaPresente`), então a tela e o
           servidor não podem discordar. */
        avatarUrl: (p.avatar_url as string | null) ?? null,
        vistaEm: (p.last_seen_at as string | null) ?? null,
        possoPresentear: trazidasIds.has(p.id) || aceitas.has(p.id),
        jaPresenteada: jaGanharam.has(p.id),
      };
    });
    /* ⚠️ **O avatar da rede é URL ASSINADA, e ela VENCE.** `salvarPerfilSocial`
       grava sete dias na coluna; no oitavo a foto responde 403 — e não só na
       Comunidade: esta lista lê a MESMA coluna. `renovarUrlAssinada` devolve
       data URL e link externo intactos, então quem gravou pelo `campo-foto` não
       é tocada.

       ⚠️ **E EM LOTE.** Este laço era `for … await`: SEQUENCIAL, uma ida à rede
       por amiga, uma esperando a anterior. Vinte amigas eram vinte viagens em
       fila indiana antes de a aba desenhar. `renovarUrlsAssinadas` manda uma
       requisição por balde — e nenhuma para quem ainda está longe de vencer. */
    const { renovarUrlsAssinadas, VALIDADE_AVATAR_SEG } = await import("@/lib/imagens.server");
    /* Com a validade do AVATAR — ver `VALIDADE_AVATAR_SEG`. */
    const urls = await renovarUrlsAssinadas(
      amigas.map((a) => a.avatarUrl),
      VALIDADE_AVATAR_SEG,
    );
    amigas.forEach((a, i) => {
      a.avatarUrl = urls[i];
    });

    /* Ordem: a chama mais alta primeiro. Não é placar — é a lista de quem está
       ativa, que é quem faz sentido convidar para a dupla hoje. */
    amigas.sort((a, b) => b.sequencia - a.sequencia);

    return { ok: true as const, careMode: false as const, amigas, dupla: await lerDupla(sb, eu) };
  });

/**
 * SÓ O NÚMERO — para o contador da fita do Caminho.
 *
 * Separada de `minhasAmigas` porque a fita aparece em TODA abertura do Caminho,
 * e a lista completa calcula chama e troféus de cada amiga (uma varredura do
 * ledger de todas elas). Pagar isso para desenhar um número de dois dígitos
 * seria caro na tela mais visitada do app.
 *
 * Conta o MESMO conjunto que a lista mostra — as em Modo Cuidado ficam de fora
 * dos dois lados. Um contador que diz 5 e uma lista que mostra 4 é o tipo de
 * discordância que faz a paciente procurar a amiga que sumiu, e é justamente
 * o sumiço que não pode ser perguntado.
 */
export const contarAmigas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, amigas: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    /* No luto a fita não mostra número nenhum, como não mostra saldo. */
    if (await emLuto(sb, eu)) return { ok: true as const, amigas: 0 };

    const { todas: ids } = await idsDasAmigas(sb, eu);
    if (ids.length === 0) return { ok: true as const, amigas: 0 };
    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id, care_mode")
      .in("id", ids);
    const n = ((perfis ?? []) as { care_mode?: boolean }[]).filter((p) => !p.care_mode).length;
    return { ok: true as const, amigas: n };
  });

/* ══════════════════════════ O PERFIL + O CANTINHO ══════════════════════════ */

export const perfilDaAmiga = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), amigaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, error: "sem_permissao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ ESTA ERA A ÚNICA FUNÇÃO DA DUPLA SEM PORTÃO DE MODO CUIDADO.
       `convidarDupla`, `lerDupla` e `cobrarBonusDaDupla` têm o seu; aqui
       faltava, então quem entrou em luto ainda podia ACEITAR um convite
       pendente e voltar a ter uma chama a segurar. O cabeçalho do arquivo diz
       que a aba inteira se cala para quem está nele. */
    if (await emLuto(sb, eu)) return { ok: false as const, error: "indisponivel" as const };

    /* O VÍNCULO ANTES DE TUDO. Sem esta linha, qualquer uuid no corpo do pedido
       devolveria o Cantinho e o perfil de qualquer paciente da plataforma. */
    if (!(await saoAmigas(sb, eu, data.amigaId))) {
      return { ok: false as const, error: "sem_vinculo" as const };
    }
    if (await emLuto(sb, data.amigaId)) {
      /* Não diz por quê. "Ela está em Modo Cuidado" contaria a perda dela. */
      return { ok: false as const, error: "indisponivel" as const };
    }

    const { data: p } = await sb
      .from("patient_profiles")
      /* ⚠️ **`journey_state` NÃO É COLUNA de `patient_profiles` — é TABELA.**
         Ela estava neste `select` e o PostgREST responde `42703` a coluna
         desconhecida: o `{ data: p }` descarta o erro, `p` vem `null`, e a
         função devolvia `sem_vinculo`. Ou seja, **abrir o perfil de uma amiga
         nunca funcionou** — a tela dizia "não foi possível abrir este perfil"
         para todo mundo, sem erro e sem log.
         O blob da jornada é lido vinte linhas abaixo, da TABELA certa, e sempre
         foi de lá que o Cantinho dela saiu. Achado por
         `colunas-que-existem.test.ts`. */
      .select(
        "id, display_name, baby_name, cantinho_fundo, created_at, referred_by, avatar_url, last_seen_at",
      )
      .eq("id", data.amigaId)
      .maybeSingle();
    if (!p) return { ok: false as const, error: "sem_vinculo" as const };

    const { data: itens } = await sb
      .from("cantinho_items")
      .select("item_id")
      .eq("user_id", data.amigaId)
      .limit(500);
    const possui = ((itens ?? []) as { item_id: string }[]).map((r) => r.item_id);

    const linhas = await atividadesDe(sb, [data.amigaId]);
    const hoje = diaLocal(new Date());

    /* O LAYOUT do Cantinho dela vem do `journey_state`, que é blob do
       navegador dela. Só o que decora entra — nunca o blob inteiro: ele carrega
       o progresso da jornada, os dias feitos e as notas das aulas, que não são
       da conta de mais ninguém. */
    const { data: js } = await sb
      .from("journey_state")
      .select("data")
      .eq("user_id", data.amigaId)
      .maybeSingle();
    const blob = ((js as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<
      string,
      unknown
    >;
    const decor = blob["dc-path-decor"] as { items?: unknown[] } | undefined;
    const skin = typeof blob["dc-path-skin"] === "string" ? (blob["dc-path-skin"] as string) : null;

    /* Mesma renovação da lista — ver o comentário em `minhasAmigas`. */
    const { renovarUrlAssinada, VALIDADE_AVATAR_SEG } = await import("@/lib/imagens.server");
    const perfil: PerfilDeAmiga = {
      id: p.id,
      nome: (p.display_name ?? "").trim() || "Amiga",
      bebe: (p.baby_name ?? "").trim() || null,
      avatarUrl: await renovarUrlAssinada(
        (p.avatar_url as string | null) ?? null,
        VALIDADE_AVATAR_SEG,
      ),
      vistaEm: (p.last_seen_at as string | null) ?? null,
      sequencia: chamaDe(linhas, hoje),
      trofeus: trofeusDasChaves(
        linhas.map((l) => l.dedupe_key),
        WELLNESS,
      ),
      itens: possui.length,
      diasNoApp: p.created_at
        ? Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000))
        : 0,
      /* ⚠️ As MESMAS duas perguntas da lista, respondidas aqui também: o botão
         "Presentear" do perfil é a segunda porta, e uma porta que a lista já
         sabe estar fechada não pode aparecer aberta ao lado. `possoPresentear`
         é `referred_by = eu`, exatamente o que `presentearAmiga` exige. */
      possoPresentear: (p.referred_by ?? null) === eu || (await amizadesAceitas(sb, eu)).has(p.id),
      jaPresenteada: (await presenteadasNoCiclo(sb, eu)).has(p.id),
    };

    return {
      ok: true as const,
      perfil,
      cantinho: {
        possui,
        fundo: (p.cantinho_fundo as string | null) ?? null,
        skin,
        /* Saneado: o blob é escrito pelo navegador DELA, e desenhar a tela de
           alguém com dado que ninguém validou é como um `s: 900` viraria um
           enfeite cobrindo a tela inteira. Ver `saneiaEnfeites`. */
        postos: saneiaEnfeites(decor?.items),
      },
    };
  });

/* ══════════════════════════ A DUPLA ══════════════════════════ */

type LinhaDupla = {
  menor: string;
  maior: string;
  quem_convidou: string;
  aceita: boolean;
};

export type DuplaNaTela = {
  estado: EstadoDaDupla;
  /** A outra pessoa, quando existe alguma. */
  amigaId: string | null;
  nome: string | null;
  /** Dias seguidos em que as DUAS apareceram. Só quando `estado === "ativa"`. */
  sequencia: number;
  /**
   * A MAIOR sequência que elas já tiveram — inclusive uma já quebrada.
   *
   * `sequencia` zera quando a chama quebra, e deve mesmo. Mas uma dupla que
   * segurou sessenta dias e parou numa semana de internação ficava com zero,
   * como se nunca tivesse existido — e o vínculo é o ponto desta aba.
   */
  recorde: number;
  /** Quantos dias, no total, as duas apareceram no mesmo dia. */
  juntas: number;
  /**
   * Há quantos dias a OUTRA não aparece. `null` = ela nunca apareceu.
   *
   * ⚠️ A tela usa isto para dizer que a chama está em PAUSA, e NUNCA para
   * dizer por quê. O app não sabe o motivo, e o motivo mais provável de um
   * sumiço longo numa gestação de alto risco é o que ninguém tem o direito de
   * insinuar.
   */
  paradaHa: number | null;
};

/**
 * Lê a dupla da paciente e já calcula a chama compartilhada.
 *
 * Falha de leitura devolve `null` — sem dupla, e nunca uma dupla inventada. A
 * tabela pode não existir ainda (`APLICAR_DUPLAS.sql` é do dono), e a aba
 * inteira tem de continuar de pé sem ela.
 */
async function lerDupla(sb: any, eu: string): Promise<DuplaNaTela | null> {
  try {
    const { data } = await sb
      .from("duplas")
      .select("menor, maior, quem_convidou, aceita")
      .or(`menor.eq.${eu},maior.eq.${eu}`)
      .limit(10);
    const linhas = (data ?? []) as LinhaDupla[];
    if (linhas.length === 0) return null;

    /* A ativa manda; entre convites, o mais recente que a tabela devolver.
       Uma ativa e um convite pendente convivem: o convite fica esperando. */
    const linha = linhas.find((l) => l.aceita) ?? linhas[0];
    const outra = linha.menor === eu ? linha.maior : linha.menor;
    const estado = estadoDaDupla(linha, eu);

    const { data: p } = await sb
      .from("patient_profiles")
      .select("display_name, care_mode")
      .eq("id", outra)
      .maybeSingle();
    /* A outra entrou em Modo Cuidado: a dupla some da tela dela E da minha, sem
       dizer por quê. A linha continua no banco — quando ela voltar, a dupla
       volta com a chama que tinham. */
    if ((p as { care_mode?: boolean } | null)?.care_mode) return null;

    let sequencia = 0;
    let recorde = 0;
    let juntas = 0;
    let paradaHa: number | null = null;
    if (estado === "ativa") {
      const linhasDoLedger = await atividadesDe(sb, [eu, outra]);
      const agrupado = porPaciente(linhasDoLedger);
      const minhas = diasDeAtividade(agrupado.get(eu) ?? []);
      const dela = diasDeAtividade(agrupado.get(outra) ?? []);
      const hoje = diaLocal(new Date());
      sequencia = sequenciaDaDupla(minhas, dela, hoje);
      /* A MEMÓRIA. Sai da mesma interseção, sem coluna nova e retroativa —
         ver `maiorSequenciaDaDupla` em `amigas.ts`. */
      recorde = maiorSequenciaDaDupla(minhas, dela);
      juntas = diasJuntas(minhas, dela);
      paradaHa = diasSemAparecer(dela, hoje);
    }
    return {
      estado,
      amigaId: outra,
      nome: ((p as { display_name?: string } | null)?.display_name ?? "").trim() || "Amiga",
      sequencia,
      recorde,
      juntas,
      paradaHa,
    };
  } catch {
    /* `APLICAR_DUPLAS.sql` ainda não rodou: o resto da aba funciona. */
    return null;
  }
}

export const convidarDupla = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), amigaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, error: "sem_permissao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!(await saoAmigas(sb, eu, data.amigaId))) {
      return { ok: false as const, error: "sem_vinculo" as const };
    }
    if ((await emLuto(sb, eu)) || (await emLuto(sb, data.amigaId))) {
      return { ok: false as const, error: "indisponivel" as const };
    }

    const { menor, maior } = parOrdenado(eu, data.amigaId);
    /* `upsert` com o par ordenado: convidar de novo é REENVIO, não uma segunda
       linha. Quem já tinha convite meu continua com o mesmo. */
    const { error } = await sb
      .from("duplas")
      .upsert(
        { menor, maior, quem_convidou: eu },
        { onConflict: "menor,maior", ignoreDuplicates: true },
      );
    if (error) return { ok: false as const, error: "falhou" as const };

    /* Avisa a outra. Best-effort: o convite já está gravado, e um push que não
       sai não pode desfazê-lo. */
    try {
      const { sendPushToUser } = await import("@/lib/push.server");
      const { data: mim } = await sb
        .from("patient_profiles")
        .select("display_name")
        .eq("id", eu)
        .maybeSingle();
      const nome =
        ((mim?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "Uma amiga";
      await sendPushToUser(data.amigaId, {
        title: `${nome} te chamou para uma dupla 🔥`,
        body: "Vocês seguram a mesma chama: o dia conta quando as duas aparecem.",
        url: "/minha-conta?tab=Amigas",
      });
    } catch {
      /* best-effort */
    }
    return { ok: true as const };
  });

export const responderDupla = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        amigaId: z.string().uuid(),
        aceitar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, error: "sem_permissao" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { menor, maior } = parOrdenado(eu, data.amigaId);

    if (!data.aceitar) {
      /* Recusar APAGA a linha em vez de marcar recusada: sem isso, um convite
         negado ficaria para sempre bloqueando um convite futuro entre as duas
         (a chave única é o par), e a amiga que mudasse de ideia não teria como.

         E o erro é CONFERIDO: uma recusa que falha deixa o convite pendente
         enquanto a tela diz que sumiu, e no próximo carregamento ele volta —
         que é o jeito de a paciente achar que o app não a ouviu. */
      const { error } = await sb.from("duplas").delete().eq("menor", menor).eq("maior", maior);
      if (error) return { ok: false as const, error: "falhou" as const };
      return { ok: true as const, aceita: false };
    }

    /* Só quem RECEBEU pode aceitar. Sem `neq`, a convidadora aceitaria o
       próprio convite e a dupla nasceria sem a outra ter concordado. */
    const { data: linha, error } = await sb
      .from("duplas")
      .update({ aceita: true, aceita_em: new Date().toISOString() })
      .eq("menor", menor)
      .eq("maior", maior)
      .neq("quem_convidou", eu)
      .select("menor")
      .maybeSingle();
    if (error || !linha) return { ok: false as const, error: "falhou" as const };
    return { ok: true as const, aceita: true };
  });

export const desfazerDupla = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    /* ⚠️ SEM `.eq("aceita", true)` — E ESSE FILTRO ERA UMA ARMADILHA
       PERMANENTE.

       Com ele, `desfazerDupla` só apagava dupla ACEITA. Quem convidasse uma
       amiga que nunca abre o app ficava com um convite pendente para sempre:
       a tela mostra "Esperando ela aceitar" SEM nenhum botão, e os chips de
       convidar só aparecem em `estado === "sem"` — ou seja, ela não podia
       desfazer nem convidar outra pessoa. A dupla, que é a mecânica mais
       social da aba, ficava trancada por uma amiga que talvez nunca volte.

       Apagar o convite pendente é seguro: `recusar` já apaga a linha pelo
       mesmo motivo (marcar "recusada" bloquearia o par para sempre pela chave
       única), e cancelar um convite que EU mandei não tira nada de ninguém.

       Erro conferido pelo mesmo motivo da recusa: desfazer que falha em
       silêncio deixa as duas ainda em dupla, com a tela dizendo que não. */
    const { error } = await sb.from("duplas").delete().or(`menor.eq.${eu},maior.eq.${eu}`);
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

/* ═══════════════════════════════════════════════════════════════════════════
   A OFENSIVA PAGA — o bônus que faltava

   Pedido do dono, ago/2026: "a gente vai ter a aba que você consegue chamar as
   amigas pra uma ofensiva, e dentro dessa ofensiva, se estiver completando,
   vocês ganham mais sementinhas juntas".

   Até aqui a dupla dava só a CHAMA compartilhada — nenhuma Sementinha. O
   incentivo existia no desenho e não existia na carteira.

   ⚠️ TRÊS DECISÕES QUE ESTE BÔNUS CARREGA:

   1. **Só paga quando AS DUAS fecharam o dia.** É a definição de ofensiva, e é
      o que faz o convite ter sentido: sozinha ela não alcança este ganho.

   2. **NÃO é corrida: as duas têm direito ao MESMO dia.** A `dedupe_key` é do
      PAR (`dupla:<menor>:<maior>:<dia>`) e a conferência é por `user_id` +
      chave, então cada uma cobra a sua ao abrir a aba, sem uma tirar da outra.
      Um bônus que fosse só de quem fecha por último transformaria a dupla numa
      corrida — e a aba inteira existe para não ser placar.
      ⚠️ Cada sessão paga SÓ a si mesma. Creditar a amiga a partir da minha
      sessão poria Sementinhas na conta dela sem nenhuma tela dizendo de onde
      vieram — é exatamente o defeito que o presente do médico teve por meses
      ("saldo que sobe sozinho é indistinguível de bug").

   3. ⚠️ **NÃO retroage.** Ele confere HOJE (e ontem, pelo mesmo perdão da
      meia-noite que a chama tem), nunca a sequência inteira. Sem isso, ligar o
      recurso pagaria de uma vez todos os dias que a dupla já tinha somado —
      uma injeção de moeda que ninguém decidiu, na economia mais calibrada do
      app.
   ═══════════════════════════════════════════════════════════════════════════ */

/* O valor mora em `economia-sementinhas.ts`, com todo número da economia —
   ver a razão no comentário de lá. Aqui só se usa. */

/** A chave do dia, por PAR — as duas pontas gravam a mesma, e cada uma a sua. */
function chaveDoBonusDaDupla(menor: string, maior: string, dia: string): string {
  return `dupla:${menor}:${maior}:${dia}`;
}

/**
 * Confere os dois últimos dias e paga o que estiver fechado dos dois lados.
 *
 * Chamada quando a aba das Amigas abre. Idempotente pela `dedupe_key`, então
 * abrir a aba dez vezes no mesmo dia paga uma.
 *
 * ⚠️ Dois dias e não um: quem fecha o dia às 23h50 e abre a aba no dia
 * seguinte perderia o bônus de ontem para sempre. É o mesmo motivo pelo qual a
 * recuperação do bônus das cinco estrelas olha hoje e ontem.
 */
export const cobrarBonusDaDupla = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const eu = await pacienteDaSessao(data.accessToken);
      if (!eu) return { ok: false as const, ganho: 0 };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;

      const dupla = await lerDupla(sb, eu);
      if (!dupla || dupla.estado !== "ativa" || !dupla.amigaId) {
        return { ok: true as const, ganho: 0 };
      }
      /* `lerDupla` já devolve `null` se a OUTRA estiver em Modo Cuidado. Falta
         conferir a minha — o portão vale para os dois lados. */
      if (await emLuto(sb, eu)) return { ok: true as const, ganho: 0 };

      const linhas = await atividadesDe(sb, [eu, dupla.amigaId]);
      const agrupado = porPaciente(linhas);
      const minhas = diasDeAtividade(agrupado.get(eu) ?? []);
      const dela = diasDeAtividade(agrupado.get(dupla.amigaId) ?? []);

      const hoje = diaLocal(new Date());
      const ontem = (() => {
        const [a, m, d] = hoje.split("-").map(Number);
        const t = new Date(Date.UTC(a, m - 1, d) - 86400000);
        return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
          t.getUTCDate(),
        ).padStart(2, "0")}`;
      })();

      const { parOrdenado } = await import("@/lib/amigas");
      const { menor, maior } = parOrdenado(eu, dupla.amigaId);
      const { typedDb } = await import("@/integrations/supabase/types.extended");
      const { grantSementinhas } = await import("@/lib/sementinhas.functions");
      const db = typedDb(supabaseAdmin);

      let ganho = 0;
      for (const dia of [hoje, ontem]) {
        if (!minhas.has(dia) || !dela.has(dia)) continue;
        const dedupeKey = chaveDoBonusDaDupla(menor, maior, dia);
        const { data: paga } = await db
          .from("sementinhas_ledger")
          .select("amount")
          .eq("user_id", eu)
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();
        if (paga) continue;
        await grantSementinhas(db, eu, [
          {
            amount: BONUS_DA_DUPLA,
            reason: `Ofensiva com ${dupla.nome ?? "sua amiga"} 🔥`,
            dedupeKey,
          },
        ]);
        /* ⚠️ CONFERE QUE GRAVOU, em vez de somar por fé.
           `grantSementinhas` faz `upsert` com `ignoreDuplicates` e engole falha
           num `console.error` — não lança e não devolve nada. Somando direto, a
           perdedora de uma corrida entre duas abas (ou qualquer falha de
           escrita) recebia `ganho: 10`, o toast "+10 🌱" e o saldo subindo na
           tela sobre uma linha que não existe; no carregamento seguinte o
           número voltava atrás sozinho, que é indistinguível de bug.
           A irmã `presentearAmiga` relê pelo mesmo motivo. */
        const { data: gravou } = await db
          .from("sementinhas_ledger")
          .select("amount")
          .eq("user_id", eu)
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();
        if (gravou) ganho += BONUS_DA_DUPLA;
      }
      /* ─── ⚠️ O EMPURRÃO QUE FAZ A DUPLA FUNCIONAR ────────────────────
         Se EU fechei hoje e ELA ainda não, ela recebe um aviso. É o mecanismo
         do Duolingo, e é o único que faz a dupla existir fora do app: sem ele,
         as duas só descobrem que a outra apareceu se abrirem a aba por conta
         própria — e aí a dupla não convida ninguém a voltar.

         ⚠️ A DIREÇÃO IMPORTA. Avisar quem JÁ fechou seria parabéns; avisar
         quem AINDA NÃO é convite. E só um por par por dia (`avisada_em`),
         porque este é o mesmo canal por onde chega o aviso de emergência —
         gastá-lo com repetição ensina a ignorá-lo. */
      await avisarQueFecheiODia(sb, { eu, ela: dupla.amigaId, menor, maior, hoje, minhas, dela });

      return { ok: true as const, ganho };
    } catch {
      /* `APLICAR_DUPLAS.sql` ainda não rodou, ou a rede caiu: o bônus é
         secundário e a aba continua inteira sem ele. */
      return { ok: false as const, ganho: 0 };
    }
  });

/**
 * "A Marina já fechou o dia de vocês 🔥" — para quem ainda não fechou.
 *
 * ⚠️ TRÊS CONDIÇÕES, e as três existem por um motivo próprio:
 *
 *  1. **eu fechei e ela não.** Invertido, o aviso vira cobrança de quem já
 *     fez a parte dela;
 *  2. **ninguém avisou este par hoje** (`avisada_em`). O push é o mesmo canal
 *     do aviso de emergência: repetição aqui custa a atenção lá;
 *  3. **ela não está em Modo Cuidado.** `lerDupla` já devolveu `null` nesse
 *     caso, então quem chega aqui passou pelo portão — mas o `emLuto` explícito
 *     é barato e esta é a única função que MANDA alguma coisa para a outra.
 *
 * ⚠️ E O CARIMBO VAI ANTES DO ENVIO. Um push perdido é melhor que um push por
 * abertura de tela: é a mesma decisão dos lembretes de consulta, escrita no
 * mesmo lugar.
 *
 * Best-effort inteiro: o bônus já foi pago, e um aviso que não sai não pode
 * desfazer isso.
 */
async function avisarQueFecheiODia(
  sb: any,
  ctx: {
    eu: string;
    ela: string;
    menor: string;
    maior: string;
    hoje: string;
    minhas: Set<string>;
    dela: Set<string>;
  },
): Promise<void> {
  try {
    if (!ctx.minhas.has(ctx.hoje) || ctx.dela.has(ctx.hoje)) return;
    if (await emLuto(sb, ctx.ela)) return;

    /* Grava PRIMEIRO, e só manda se a escrita disser que hoje ainda não tinha
       aviso. `neq` na condição faz a corrida entre dois crons/abas ser
       resolvida pelo banco: a segunda não encontra linha para atualizar. */
    const { data: marcou, error: erroDoCarimbo } = await sb
      .from("duplas")
      .update({ avisada_em: ctx.hoje })
      .eq("menor", ctx.menor)
      .eq("maior", ctx.maior)
      .or(`avisada_em.is.null,avisada_em.neq.${ctx.hoje}`)
      .select("id");
    /* Erro aqui quase sempre é `APLICAR_AMIZADES.sql` não aplicado (coluna
       inexistente). Sem carimbo não há como impedir a repetição, e um push por
       abertura de tela é pior que push nenhum — então não manda. */
    if (erroDoCarimbo || !marcou || marcou.length === 0) return;

    const { data: mim } = await sb
      .from("patient_profiles")
      .select("display_name")
      .eq("id", ctx.eu)
      .maybeSingle();
    const nome = ((mim?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "Sua dupla";

    const { sendPushToUser } = await import("@/lib/push.server");
    await sendPushToUser(ctx.ela, {
      title: `${nome} já fechou o dia de vocês 🔥`,
      /* ⚠️ Não cobra e não ameaça. "Você vai perder a sequência" é o texto que
         todo app de streak usa, e aqui ele cairia numa gestante que pode estar
         internada. A chama da dupla é um bônus que aparece, nunca uma dívida
         que cobra — está escrito no SQL da tabela. */
      body: "Uma atividade sua e o dia conta para as duas.",
      url: "/minha-conta?tab=Caminho",
    });
  } catch {
    /* sem a coluna `avisada_em` (SQL não aplicado) ou sem push: segue sem aviso */
  }
}

/* ══════════════════════════ SAIR DA AMIZADE ══════════════════════════

   Até aqui não havia como desfazer um vínculo. O grafo é o da INDICAÇÃO, que é
   fixada uma vez e nunca reescrita — e isso está certo: é ela que prova quem
   trouxe quem e que pagou as 100 🌱. Mas "quem me trouxe para o app" e "com
   quem eu quero jogar" são coisas diferentes, e a segunda pode mudar. A única
   saída era apagar a conta.

   ⚠️ A INDICAÇÃO NÃO É APAGADA. `referred_by = NULL` faria o app esquecer uma
   recompensa já paga — e, pior, `attributeReferral` só escreve quando o campo
   está nulo, então o vínculo poderia ser RECLAMADO DE NOVO por outro código,
   pagando duas vezes pela mesma amiga. A amizade sai de cena; o recibo fica.

   Ver `supabase/APLICAR_AMIZADES.sql`.
   ══════════════════════════════════════════════════════════════════════ */
export const encerrarAmizade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), amigaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const eu = await pacienteDaSessao(data.accessToken);
      if (!eu) return { ok: false as const, error: "sessao" as const };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;

      /* ⚠️ O VÍNCULO É CONFERIDO ANTES DE ESCREVER. Sem isto, um uuid forjado
         no corpo do pedido separaria duas pacientes DESCONHECIDAS — a linha é
         do par, e o efeito vale para os dois lados. É o mesmo defeito que
         `contatoDaPaciente` teve no painel do médico. */
      if (!(await saoAmigas(sb, eu, data.amigaId))) {
        return { ok: false as const, error: "sem_vinculo" as const };
      }

      const { parOrdenado } = await import("@/lib/amigas");
      const { menor, maior } = parOrdenado(eu, data.amigaId);
      const { error } = await sb
        .from("amizades_encerradas")
        .upsert(
          { menor, maior, quem_pediu: eu },
          { onConflict: "menor,maior", ignoreDuplicates: true },
        );
      if (error) return { ok: false as const, error: "falhou" as const };

      /* A DUPLA CAI JUNTO. Deixá-la de pé faria a chama continuar contando com
         alguém que não está mais na lista — e a tela mostraria o nome de quem
         ela pediu para não ver mais. `desfazerDupla` já apaga a linha (marcar
         "recusada" bloquearia o par para sempre pela chave única). */
      try {
        const { error: erroDaDupla } = await sb
          .from("duplas")
          .delete()
          .eq("menor", menor)
          .eq("maior", maior);
        /* Não desfaz o encerramento: a amizade já saiu de cena e a dupla ficou
           órfã de uma amiga que a lista não mostra mais. Registrar é o que
           permite alguém investigar; abortar aqui desfaria a saída que ela
           pediu por causa de um efeito colateral. */
        if (erroDaDupla) console.error("[amizade] dupla não caiu junto", menor, maior, erroDaDupla);
      } catch {
        /* sem a tabela de duplas o resto continua valendo */
      }

      /* ⚠️ E NINGUÉM É AVISADO. "Fulana te removeu" transforma um gesto privado
         numa briga; a outra simplesmente deixa de ver, como no Modo Cuidado.
         Nenhum push aqui, de propósito. */
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "falhou" as const };
    }
  });

/* ══════════════════════ CONVITE ENTRE CONTAS QUE JÁ EXISTEM ══════════════════

   ─── O BURACO ─────────────────────────────────────────────────────────────

   O grafo de amizade era EXCLUSIVAMENTE o da indicação: para duas contas se
   enxergarem, uma tinha de mandar o link ANTES de a outra existir. Ficava de
   fora o caso mais comum — **as duas já usam o app**. Duas grávidas do mesmo
   obstetra que se conheceram na sala de espera e baixaram o app cada uma por
   conta própria não tinham caminho nenhum, e nada na tela explicava por quê.

   ─── ⚠️ CÓDIGO OU E-MAIL. NUNCA NOME ──────────────────────────────────────

   Busca por nome transformaria a base de pacientes numa lista navegável:
   qualquer conta enumeraria grávidas por nome, e num app de gestação de alto
   risco esse é o dado que menos pode vazar.

   O código é uma CAPACIDADE (`referral_code`, 7 caracteres num alfabeto de 32
   — 34 bilhões de combinações): só se tem se a outra tiver dado. O e-mail
   exige saber o e-mail, que é a mesma prova que o WhatsApp pede.

   ─── ⚠️ E O E-MAIL NUNCA REVELA SE A CONTA EXISTE ─────────────────────────

   `achou` volta `null` no caminho do e-mail, com ou sem acerto. Sem isso o
   campo vira um verificador de contas — dá para descobrir se uma pessoa
   específica é paciente daqui, e isso é informação de saúde.

   O código PODE revelar, e é o que o torna gostoso de usar: quem digita um
   código só o tem porque a dona deu.
   ══════════════════════════════════════════════════════════════════════════ */

/** Quantos convites uma conta pode disparar por dia. */
const CONVITES_POR_DIA = 20;

/** As amizades ACEITAS entre contas existentes — o segundo grafo. */
async function amizadesAceitas(sb: any, eu: string): Promise<Set<string>> {
  try {
    const { data, error } = await sb
      .from("amizades")
      .select("menor, maior, aceita")
      .or(`menor.eq.${eu},maior.eq.${eu}`)
      .eq("aceita", true)
      .limit(500);
    if (error || !data) return new Set();
    const fora = new Set<string>();
    for (const l of data as { menor: string; maior: string }[]) {
      fora.add(l.menor === eu ? l.maior : l.menor);
    }
    return fora;
  } catch {
    /* `APLICAR_AMIZADES_ENTRE_CONTAS.sql` ainda não rodou: o grafo da
       indicação continua valendo sozinho, como sempre valeu. */
    return new Set();
  }
}

export const convidarAmiga = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), termo: z.string().min(3).max(120) }).parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const eu = await pacienteDaSessao(data.accessToken);
      if (!eu) return { ok: false as const, error: "sessao" as const };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;

      /* Modo Cuidado: quem está nele não convida ninguém, como não presenteia
         e não aparece na lista das outras. */
      if (await emLuto(sb, eu)) return { ok: false as const, error: "indisponivel" as const };

      const bruto = data.termo.trim();
      const porEmail = bruto.includes("@");

      /* ⚠️ TETO DIÁRIO. Sem ele o campo de e-mail vira uma ferramenta de spam:
         um roteiro dispara mil convites e mil pessoas recebem push de alguém
         que elas não conhecem. Vinte é muito mais do que qualquer paciente
         convida num dia e pouco para servir a um roteiro. */
      const desde = new Date(Date.now() - 86400000).toISOString();
      const { count } = await sb
        .from("amizades")
        .select("id", { count: "exact", head: true })
        .eq("quem_convidou", eu)
        .gte("criada_em", desde);
      if ((count ?? 0) >= CONVITES_POR_DIA) {
        return { ok: false as const, error: "muitos_convites" as const };
      }

      let alvo: string | null = null;
      if (porEmail) {
        /* O e-mail mora em `auth.users`, que só o servidor lê. */
        const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const alvoEmail = bruto.toLowerCase();
        alvo =
          (lista?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === alvoEmail)?.id ?? null;
      } else {
        const codigo = bruto
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 12);
        if (codigo.length < 4) return { ok: false as const, error: "termo_curto" as const };
        const { data: p } = await sb
          .from("patient_profiles")
          .select("id")
          .eq("referral_code", codigo)
          .maybeSingle();
        alvo = (p as { id?: string } | null)?.id ?? null;
      }

      /* ⚠️ A RESPOSTA DO E-MAIL É A MESMA COM E SEM ACERTO. Ver o cabeçalho:
         revelar aqui transformaria o campo num verificador de contas. */
      const anonima = { ok: true as const, achou: null, nome: null as string | null };
      if (!alvo || alvo === eu) {
        if (porEmail) return anonima;
        return { ok: false as const, error: "nao_encontrada" as const };
      }

      /* A outra em Modo Cuidado responde como quem não existe — nunca o
         motivo. É a mesma régua de `perfilDaAmiga`. */
      if (await emLuto(sb, alvo)) {
        return porEmail ? anonima : { ok: false as const, error: "nao_encontrada" as const };
      }

      const { parOrdenado } = await import("@/lib/amigas");
      const { menor, maior } = parOrdenado(eu, alvo);

      /* Já encerraram? O convite não ressuscita a amizade por fora: a saída
         some da lista dos dois lados e reabri-la é uma decisão de quem saiu. */
      if ((await encerradasCom(sb, eu)).fora.has(alvo)) {
        return porEmail ? anonima : { ok: false as const, error: "nao_encontrada" as const };
      }

      const { error } = await sb
        .from("amizades")
        .upsert(
          { menor, maior, quem_convidou: eu },
          { onConflict: "menor,maior", ignoreDuplicates: true },
        );
      if (error) return { ok: false as const, error: "falhou" as const };

      /* Avisa a convidada. Best-effort: o pedido já está gravado. */
      try {
        const { data: mim } = await sb
          .from("patient_profiles")
          .select("display_name")
          .eq("id", eu)
          .maybeSingle();
        const nome =
          ((mim?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "Uma paciente";
        const { sendPushToUser } = await import("@/lib/push.server");
        await sendPushToUser(alvo, {
          title: `${nome} quer ser sua amiga aqui 💛`,
          body: "Aceite para visitarem o Cantinho uma da outra e jogarem juntas.",
          url: "/minha-conta?tab=Amigas",
        });
      } catch {
        /* best-effort */
      }

      if (porEmail) return anonima;
      const { data: alvoPerfil } = await sb
        .from("patient_profiles")
        .select("display_name")
        .eq("id", alvo)
        .maybeSingle();
      return {
        ok: true as const,
        achou: true,
        nome: ((alvoPerfil?.display_name as string | null) ?? "").trim() || "Amiga",
      };
    } catch {
      return { ok: false as const, error: "falhou" as const };
    }
  });

/** Os pedidos de amizade que EU recebi e ainda não respondi. */
export const pedidosDeAmizade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const eu = await pacienteDaSessao(data.accessToken);
      if (!eu) return { ok: false as const, pedidos: [] };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      if (await emLuto(sb, eu)) return { ok: true as const, pedidos: [] };

      const { data: linhas, error } = await sb
        .from("amizades")
        .select("menor, maior, quem_convidou, aceita")
        .or(`menor.eq.${eu},maior.eq.${eu}`)
        .eq("aceita", false)
        .limit(100);
      if (error || !linhas) return { ok: true as const, pedidos: [] };

      /* Só os que EU recebi: quem convidou vê "esperando ela aceitar", e não um
         botão "Aceitar" no próprio convite — é o mesmo defeito que os quatro
         estados da dupla existem para evitar. */
      const deles = (linhas as { menor: string; maior: string; quem_convidou: string }[]).filter(
        (l) => l.quem_convidou !== eu,
      );
      if (deles.length === 0) return { ok: true as const, pedidos: [] };

      const ids = deles.map((l) => (l.menor === eu ? l.maior : l.menor));
      const { data: perfis } = await sb
        .from("patient_profiles")
        .select("id, display_name, care_mode, created_at")
        .in("id", ids);

      const pedidos = ((perfis ?? []) as any[])
        /* Em Modo Cuidado ela some do pedido também, sem dizer por quê. */
        .filter((p) => !p.care_mode)
        .map((p) => ({
          id: p.id as string,
          nome: ((p.display_name as string | null) ?? "").trim() || "Uma paciente",
          diasNoApp: p.created_at
            ? Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000))
            : 0,
        }));
      return { ok: true as const, pedidos };
    } catch {
      return { ok: true as const, pedidos: [] };
    }
  });

export const responderAmizade = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        amigaId: z.string().uuid(),
        aceitar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const eu = await pacienteDaSessao(data.accessToken);
      if (!eu) return { ok: false as const, error: "sessao" as const };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;

      const { parOrdenado } = await import("@/lib/amigas");
      const { menor, maior } = parOrdenado(eu, data.amigaId);

      /* ⚠️ SÓ A DESTINATÁRIA ACEITA. `quem_convidou.neq` é o que impede quem
         mandou o convite de aceitá-lo sozinha — sem isso, o aceite é
         decorativo e qualquer conta entra na lista de qualquer outra. */
      if (data.aceitar) {
        const { data: aceitou, error } = await sb
          .from("amizades")
          .update({ aceita: true, aceita_em: new Date().toISOString() })
          .eq("menor", menor)
          .eq("maior", maior)
          .eq("aceita", false)
          .neq("quem_convidou", eu)
          .select("id");
        if (error) return { ok: false as const, error: "falhou" as const };
        if (!aceitou || aceitou.length === 0) {
          return { ok: false as const, error: "sem_pedido" as const };
        }

        /* Avisa quem convidou — é o fecho do laço, e é o que a traz de volta
           para encontrar a amiga nova na lista. */
        try {
          const { data: mim } = await sb
            .from("patient_profiles")
            .select("display_name")
            .eq("id", eu)
            .maybeSingle();
          const nome = ((mim?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "Ela";
          const { sendPushToUser } = await import("@/lib/push.server");
          await sendPushToUser(data.amigaId, {
            title: `${nome} aceitou o seu convite 💛`,
            body: "Vocês já podem visitar o Cantinho uma da outra.",
            url: "/minha-conta?tab=Amigas",
          });
        } catch {
          /* best-effort */
        }
        return { ok: true as const };
      }

      /* RECUSAR APAGA a linha, como na dupla: marcar "recusada" bloquearia o
         par para sempre pela chave única, e uma recusa de hoje não pode
         impedir um convite de daqui a seis meses.
         ⚠️ E não avisa ninguém — recusa que notifica vira constrangimento. */
      const { error: erroAoRecusar } = await sb
        .from("amizades")
        .delete()
        .eq("menor", menor)
        .eq("maior", maior)
        .eq("aceita", false)
        .neq("quem_convidou", eu);
      if (erroAoRecusar) return { ok: false as const, error: "falhou" as const };
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "falhou" as const };
    }
  });

/**
 * O portão de amizade, exposto para quem vive noutro arquivo.
 *
 * ⚠️ `saoAmigas` é `function` de módulo e a régua dos DOIS grafos mora nela.
 * `presentearAmiga` conferia por conta própria (`referred_by = uid`) e por isso
 * divergiu duas vezes: primeiro recusando quem me trouxe, depois recusaria
 * todas as amizades criadas por pedido+aceite. Uma régua, um lugar.
 *
 * Recebe o TOKEN e resolve a sessão aqui dentro, em vez de aceitar um `uid` —
 * um `uid` vindo do chamador seria uma porta para conferir a amizade de duas
 * outras pessoas.
 */
export async function saoAmigasParaPresente(
  accessToken: string,
  amigaId: string,
): Promise<boolean> {
  const eu = await pacienteDaSessao(accessToken);
  if (!eu) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return saoAmigas(supabaseAdmin as any, eu, amigaId);
}

/**
 * CARIMBA QUE ELA APARECEU.
 *
 * ⚠️ NÃO É PRESENÇA AO VIVO, e a diferença importa: isto grava um instante
 * quando o app abre, e a lista mostra "há 2h". Não existe ponto verde de
 * "Online" — presença ao vivo exigiria conexão persistente, e um ponto que na
 * verdade quer dizer "abriu nos últimos cinco minutos" induz a amiga a concluir
 * "ela está online e não me respondeu".
 *
 * ⚠️ E ESCREVE NO MÁXIMO UMA VEZ POR HORA. Sem o corte, toda montagem da aba
 * viraria um UPDATE — a tela remonta a cada troca de aba, e a granularidade que
 * a lista mostra é de hora em hora de qualquer forma.
 *
 * Best-effort inteiro: é um enfeite social. Falhar aqui não pode atrapalhar
 * nada, e por isso nem devolve erro.
 */
export const carimbarQueApareceu = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const eu = await pacienteDaSessao(data.accessToken);
      if (!eu) return { ok: false as const };
      /* ⚠️ **A VARREDURA DO LEMBRETE DE MEDITAÇÃO PEGA CARONA AQUI.**
         `vercel.json` agenda só o `push-weekly-tick`; o `meditacao-tick`
         depende de cron EXTERNO e, sem ele, o lembrete diário NUNCA sai. Esta
         função é o melhor gancho que existe: roda na abertura do app, para
         toda paciente, e já é naturalmente rara.

         É a mesma redundância proposital da fila de espera — "assim ela
         progride mesmo que o cron não esteja configurado" — e o que a torna
         segura é o CARIMBO, não a varredura: o registro é gravado antes do
         envio e a régua conta em horas, então chamar dez vezes manda uma.

         ⚠️ **E É `await`, NUNCA `void (async () => …)()`.** Escrevi
         dispare-e-esqueça primeiro e a catraca `travas-do-servidor` reprovou —
         com razão: no servidor a invocação CONGELA quando a resposta sai, e a
         promessa que ninguém guarda morre antes de rodar, sem erro e sem log.
         Esta base já perdeu três recursos exatamente assim
         (`curarLacunasSemVetor`, `backfillBrainEmbeddings`, `notifyDoctorOfGap`).
         O conserto teria ficado bonito no diff e não teria mandado um lembrete
         sequer.

         O custo de esperar é pequeno porque o estrangulador faz quase toda
         chamada voltar `null` na hora: só uma a cada dez minutos toca o banco.
         E vem DEPOIS do carimbo, que é o trabalho desta função — um lembrete
         que falha não pode fazer a paciente sumir da lista de amigas. */
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      const limite = new Date(Date.now() - 3600_000).toISOString();
      const { error } = await sb
        .from("patient_profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", eu)
        .or(`last_seen_at.is.null,last_seen_at.lt.${limite}`);
      const carimbou = !error;

      try {
        const { varrerLembretesDeMeditacao } = await import("@/lib/meditacao.server");
        await varrerLembretesDeMeditacao();
      } catch {
        /* lembrete é secundário à presença — nunca derruba o carimbo */
      }

      return carimbou ? { ok: true as const } : { ok: false as const };
    } catch {
      /* coluna ainda não existe (SQL não aplicado): a lista mostra a linha sem
         "há 2h", e mais nada muda */
      return { ok: false as const };
    }
  });
