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
  estadoDaDupla,
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
async function saoAmigas(sb: any, eu: string, outra: string): Promise<boolean> {
  if (!outra || outra === eu) return false;
  const { data } = await sb
    .from("patient_profiles")
    .select("id, referred_by")
    .in("id", [eu, outra]);
  const linhas = (data ?? []) as { id: string; referred_by: string | null }[];
  const minha = linhas.find((l) => l.id === eu);
  const dela = linhas.find((l) => l.id === outra);
  if (!minha || !dela) return false;
  return minha.referred_by === outra || dela.referred_by === eu;
}

/** Os ids de todas as amigas — quem eu indiquei ∪ quem me indicou. */
async function idsDasAmigas(sb: any, eu: string): Promise<string[]> {
  const { data: minha } = await sb
    .from("patient_profiles")
    .select("referred_by")
    .eq("id", eu)
    .maybeSingle();
  const { data: trazidas } = await sb
    .from("patient_profiles")
    .select("id")
    .eq("referred_by", eu)
    .limit(200);

  const ids = new Set<string>();
  const quemMeTrouxe = (minha as { referred_by?: string | null } | null)?.referred_by;
  if (quemMeTrouxe) ids.add(quemMeTrouxe);
  for (const r of (trazidas ?? []) as { id: string }[]) ids.add(r.id);
  /* Filtro em vez de `ids.delete(eu)`: a catraca de "escrita no banco sem
     checagem de erro" (`travas-do-servidor.test.ts`) casa com `.delete(` por
     texto, e um `Set.delete` aqui entrava na conta como se fosse um DELETE de
     tabela. Inflar a dívida com falso positivo é pior que a linha extra —
     esconde a dívida real atrás de ruído. */
  return [...ids].filter((id) => id !== eu);
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

    const ids = await idsDasAmigas(sb, eu);
    if (ids.length === 0) {
      return { ok: true as const, careMode: false as const, amigas: [], dupla: null };
    }

    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id, display_name, baby_name, care_mode, created_at")
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
      };
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

    const ids = await idsDasAmigas(sb, eu);
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
      .select("id, display_name, baby_name, cantinho_fundo, created_at, journey_state")
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

    const perfil: PerfilDeAmiga = {
      id: p.id,
      nome: (p.display_name ?? "").trim() || "Amiga",
      bebe: (p.baby_name ?? "").trim() || null,
      sequencia: chamaDe(linhas, hoje),
      trofeus: trofeusDasChaves(
        linhas.map((l) => l.dedupe_key),
        WELLNESS,
      ),
      itens: possui.length,
      diasNoApp: p.created_at
        ? Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000))
        : 0,
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
    if (estado === "ativa") {
      const linhasDoLedger = await atividadesDe(sb, [eu, outra]);
      const agrupado = porPaciente(linhasDoLedger);
      sequencia = sequenciaDaDupla(
        diasDeAtividade(agrupado.get(eu) ?? []),
        diasDeAtividade(agrupado.get(outra) ?? []),
        diaLocal(new Date()),
      );
    }
    return {
      estado,
      amigaId: outra,
      nome: ((p as { display_name?: string } | null)?.display_name ?? "").trim() || "Amiga",
      sequencia,
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
    /* Erro conferido pelo mesmo motivo da recusa: desfazer que falha em
       silêncio deixa as duas ainda em dupla, com a tela dizendo que não. */
    const { error } = await sb
      .from("duplas")
      .delete()
      .or(`menor.eq.${eu},maior.eq.${eu}`)
      .eq("aceita", true);
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
        ganho += BONUS_DA_DUPLA;
      }
      return { ok: true as const, ganho };
    } catch {
      /* `APLICAR_DUPLAS.sql` ainda não rodou, ou a rede caiu: o bônus é
         secundário e a aba continua inteira sem ele. */
      return { ok: false as const, ganho: 0 };
    }
  });
