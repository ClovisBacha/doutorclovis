/**
 * O DESAFIO DA SEMANA EM GRUPO — o servidor.
 *
 * A régua pura mora em `desafio-em-grupo.ts`; aqui ficam as travas e o banco.
 *
 * ⚠️ **Nada aqui agrupa por `ref_code`.** A criadora PROPÕE (o desafio nasce
 * com o código dela, que é como as indicadas o encontram), mas quem entra é
 * cada paciente, uma por uma. O código foi tirado do grafo de amizade para uma
 * criadora não virar amiga de três mil gestantes; agrupá-las automaticamente
 * recriaria o mesmo grupo por fora, e `ref_code` é fixado uma vez — não haveria
 * como sair.
 *
 * ⚠️ **E o contador nunca é coluna.** Ele é derivado das linhas `wellness:` do
 * `sementinhas_ledger`, pela mesma razão que o troféu conta o ledger e não
 * `doneDays`: contador materializado vira "3 fecharam" numa tela e "5" na outra
 * na primeira corrida.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { grantSementinhas } from "@/lib/sementinhas.functions";
import { DESAFIO_DA_SEMANA } from "@/lib/economia-sementinhas";
import { diasDeAtividade } from "@/lib/amigas";
import {
  atividadeConhecida,
  chaveDoDesafio,
  diasNaJanela,
  DIAS_ALVO_MAX,
  DIAS_ALVO_MIN,
  DIAS_ALVO_PADRAO,
  domingoDaSemana,
  fechou,
  MINIMO_PARA_CONTAR,
  segundaDaSemana,
  type AtividadeDoDesafio,
} from "@/lib/desafio-em-grupo";

export const RAZAO_DESAFIO = "desafio-em-grupo";

/** Hoje no fuso da paciente — a base é brasileira, e o servidor roda em UTC. */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A criadora da sessão — nunca um código vindo do cliente. */
async function criadoraDaSessao(sb: any, supabaseAdmin: any, accessToken: string) {
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  const email = u.user?.email?.trim().toLowerCase();
  if (!email) return null;
  try {
    const { data } = await sb
      .from("affiliates")
      .select("code,name,active")
      .ilike("email", email)
      .maybeSingle();
    return data?.active ? (data as { code: string; name: string }) : null;
  } catch {
    return null;
  }
}

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * A criadora PROPÕE o desafio da semana.
 *
 * ⚠️ A atividade vem de catálogo fechado — ver a régua. E o `dias_alvo` tem
 * faixa: zero seria um desafio já fechado, oito nunca fecharia.
 */
export const proporDesafio = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        atividade: z.string().max(20),
        diasAlvo: z.number().int().min(DIAS_ALVO_MIN).max(DIAS_ALVO_MAX).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const criadora = await criadoraDaSessao(sb, supabaseAdmin, data.accessToken);
    if (!criadora) return { ok: false as const, motivo: "nao_afiliada" as const };
    if (!atividadeConhecida(data.atividade)) {
      return { ok: false as const, motivo: "atividade" as const };
    }

    const hoje = hojeEmSaoPaulo();
    const inicio = segundaDaSemana(hoje);
    const fim = domingoDaSemana(hoje);

    const { error } = await sb.from("desafios_em_grupo").insert({
      affiliate_code: criadora.code,
      atividade: data.atividade,
      inicio,
      fim,
      dias_alvo: data.diasAlvo ?? DIAS_ALVO_PADRAO,
    });
    /* Colidir no índice único é "já existe o desta semana" — sucesso repetido,
       não erro: devolver erro faria a tela pedir que ela tentasse de novo. */
    if (error && !String(error.code ?? "").startsWith("23")) {
      return { ok: false as const, motivo: "banco" as const };
    }
    return { ok: true as const };
  });

export type DesafioNaTela = {
  id: string;
  atividade: AtividadeDoDesafio;
  inicio: string;
  fim: string;
  diasAlvo: number;
  /** Quem propôs — o nome, para a paciente saber de quem é o convite. */
  deQuem: string;
  /** Eu entrei? */
  souParticipante: boolean;
  /** Quantos dias EU já fiz nesta semana. */
  meusDias: number;
  /** Quantas já fecharam — `null` abaixo do mínimo, ver a régua. */
  quantasFecharam: number | null;
};

/**
 * O desafio da semana da criadora que me trouxe — se houver.
 *
 * ⚠️ **A paciente só enxerga o desafio de quem ela já conhece** (a criadora do
 * `ref_code` dela). Não há descoberta de desafio de estranhas: seria convite em
 * massa de quem ela nunca ouviu falar.
 */
export const meuDesafioDaSemana = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: perfil } = await sb
      .from("patient_profiles")
      .select("ref_code, care_mode")
      .eq("id", eu)
      .maybeSingle();
    /* ⚠️ Modo Cuidado não vê desafio — como não vê dupla, nem convite, nem
       festa. E "sem código" é o caso mais comum, nunca um erro. */
    if (!perfil || (perfil as any).care_mode || !(perfil as any).ref_code) {
      return { ok: true as const, desafio: null };
    }
    const codigo = (perfil as any).ref_code as string;

    const hoje = hojeEmSaoPaulo();
    const { data: d } = await sb
      .from("desafios_em_grupo")
      .select("id, atividade, inicio, fim, dias_alvo, affiliate_code")
      .eq("affiliate_code", codigo)
      .lte("inicio", hoje)
      .gte("fim", hoje)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!d) return { ok: true as const, desafio: null };

    const [{ data: aff }, { data: minha }] = await Promise.all([
      sb.from("affiliates").select("name").eq("code", codigo).maybeSingle(),
      sb
        .from("desafio_participantes")
        .select("user_id")
        .eq("desafio_id", (d as any).id)
        .eq("user_id", eu)
        .is("saiu_em", null)
        .maybeSingle(),
    ]);

    const meusDias = await diasFeitos(sb, eu, (d as any).inicio, (d as any).fim);
    const quantas = await quantasFecharamNoDesafio(sb, d as any);

    return {
      ok: true as const,
      desafio: {
        id: (d as any).id,
        atividade: (d as any).atividade,
        inicio: (d as any).inicio,
        fim: (d as any).fim,
        diasAlvo: (d as any).dias_alvo,
        deQuem: ((aff as any)?.name ?? "").trim().split(/\s+/)[0] || "Quem te trouxe",
        souParticipante: !!minha,
        meusDias,
        quantasFecharam: quantas,
      } satisfies DesafioNaTela,
    };
  });

/** Dias de calendário em que ela fez alguma atividade, dentro da janela. */
async function diasFeitos(sb: any, userId: string, inicio: string, fim: string): Promise<number> {
  const { data } = await sb
    .from("sementinhas_ledger")
    .select("dedupe_key, created_at")
    .eq("user_id", userId)
    .like("dedupe_key", "wellness:%")
    /* Folga de um dia nas duas pontas: `created_at` é UTC e a janela é local. */
    .gte("created_at", `${inicio}T00:00:00Z`)
    .lte("created_at", `${fim}T23:59:59Z`)
    .limit(500);
  /* ⚠️ `diasDeAtividade` é a MESMA função da dupla das Amigas: uma segunda
     régua faria a dupla e o desafio discordarem sobre o mesmo dia. */
  return diasNaJanela(diasDeAtividade((data ?? []) as any[]), inicio, fim);
}

/**
 * Quantas participantes já fecharam.
 *
 * ⚠️ Derivado, e devolve `null` abaixo do mínimo — "1 fechou" num desafio em
 * grupo é a pessoa se olhando no espelho.
 */
async function quantasFecharamNoDesafio(sb: any, d: any): Promise<number | null> {
  const { data: parts } = await sb
    .from("desafio_participantes")
    .select("user_id")
    .eq("desafio_id", d.id)
    .is("saiu_em", null)
    .limit(500);
  const ids = ((parts ?? []) as { user_id: string }[]).map((p) => p.user_id);
  if (ids.length === 0) return null;

  const { data: linhas } = await sb
    .from("sementinhas_ledger")
    .select("user_id, dedupe_key, created_at")
    .in("user_id", ids)
    .like("dedupe_key", "wellness:%")
    .gte("created_at", `${d.inicio}T00:00:00Z`)
    .lte("created_at", `${d.fim}T23:59:59Z`)
    .limit(5000);

  const porPessoa = new Map<string, { dedupe_key: string; created_at: string }[]>();
  for (const l of (linhas ?? []) as any[]) {
    const arr = porPessoa.get(l.user_id) ?? [];
    arr.push(l);
    porPessoa.set(l.user_id, arr);
  }
  let n = 0;
  for (const [, ls] of porPessoa) {
    if (fechou(diasNaJanela(diasDeAtividade(ls), d.inicio, d.fim), d.dias_alvo)) n += 1;
  }
  return n >= MINIMO_PARA_CONTAR ? n : null;
}

/**
 * ENTRAR ou SAIR do desafio.
 *
 * ⚠️ Sair MARCA, nunca apaga: apagar faria "ela nunca entrou" e "ela saiu"
 * serem a mesma linha ausente, e ela seria reconvidada como se nada tivesse
 * acontecido.
 */
export const entrarNoDesafio = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        desafioId: z.string().uuid(),
        entrar: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ O desafio tem de ser o da criadora DELA: sem esta conferência, um
       `desafioId` sorteado a poria no grupo de qualquer criadora da
       plataforma. */
    const [{ data: perfil }, { data: d }] = await Promise.all([
      sb.from("patient_profiles").select("ref_code, care_mode").eq("id", eu).maybeSingle(),
      sb
        .from("desafios_em_grupo")
        .select("id, affiliate_code, arquivado_em")
        .eq("id", data.desafioId)
        .maybeSingle(),
    ]);
    if (!perfil || !d) return { ok: false as const, motivo: "indisponivel" as const };
    if ((perfil as any).care_mode) return { ok: false as const, motivo: "indisponivel" as const };
    if ((d as any).arquivado_em) return { ok: false as const, motivo: "indisponivel" as const };
    if ((d as any).affiliate_code !== (perfil as any).ref_code) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }

    const { error } = data.entrar
      ? await sb
          .from("desafio_participantes")
          .upsert(
            { desafio_id: data.desafioId, user_id: eu, saiu_em: null },
            { onConflict: "desafio_id,user_id" },
          )
      : await sb
          .from("desafio_participantes")
          .update({ saiu_em: new Date().toISOString() })
          .eq("desafio_id", data.desafioId)
          .eq("user_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * COBRA o bônus da semana fechada.
 *
 * ⚠️ **Cada sessão paga SÓ A SI MESMA**, como `cobrarBonusDaDupla`: creditar as
 * outras a partir da minha sessão poria Sementinhas na conta delas sem nenhuma
 * tela dizendo de onde vieram.
 *
 * ⚠️ **E NÃO RETROAGE.** Confere só o desafio VIGENTE — ligar o recurso pagando
 * todas as semanas passadas seria uma injeção de moeda que ninguém decidiu, na
 * economia mais calibrada do app.
 */
export const cobrarBonusDoDesafio = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: perfil } = await sb
      .from("patient_profiles")
      .select("ref_code, care_mode")
      .eq("id", eu)
      .maybeSingle();
    if (!perfil || (perfil as any).care_mode || !(perfil as any).ref_code) {
      return { ok: true as const, ganho: 0 };
    }

    const hoje = hojeEmSaoPaulo();
    const { data: d } = await sb
      .from("desafios_em_grupo")
      .select("id, inicio, fim, dias_alvo, affiliate_code")
      .eq("affiliate_code", (perfil as any).ref_code)
      .lte("inicio", hoje)
      .gte("fim", hoje)
      .is("arquivado_em", null)
      .maybeSingle();
    if (!d) return { ok: true as const, ganho: 0 };

    const { data: souParte } = await sb
      .from("desafio_participantes")
      .select("user_id")
      .eq("desafio_id", (d as any).id)
      .eq("user_id", eu)
      .is("saiu_em", null)
      .maybeSingle();
    if (!souParte) return { ok: true as const, ganho: 0 };

    const meus = await diasFeitos(sb, eu, (d as any).inicio, (d as any).fim);
    if (!fechou(meus, (d as any).dias_alvo)) return { ok: true as const, ganho: 0 };

    const dedupeKey = chaveDoDesafio((d as any).id, eu);
    try {
      await grantSementinhas(typedDb(supabaseAdmin), eu, [
        { amount: DESAFIO_DA_SEMANA, reason: RAZAO_DESAFIO, dedupeKey },
      ]);
    } catch (e) {
      console.error("[desafio] bônus não creditado", eu, e);
      return { ok: true as const, ganho: 0 };
    }

    /* ⚠️ RELÊ antes de dizer que ganhou: `grantSementinhas` faz upsert com
       `ignoreDuplicates` e engole a falha — somar por fé mostraria "+15 🌱"
       sobre uma linha que não existe, o defeito que `cobrarBonusDaDupla` teve. */
    const { data: conferindo } = await sb
      .from("sementinhas_ledger")
      .select("dedupe_key, created_at")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (!conferindo) return { ok: true as const, ganho: 0 };

    /* Já estava lá de antes? Então não é ganho DESTA visita — a tela não
       comemora duas vezes a mesma semana. */
    const agora = Date.now();
    const quando = new Date((conferindo as any).created_at as string).getTime();
    const novo = Number.isFinite(quando) && agora - quando < 60_000;
    return { ok: true as const, ganho: novo ? DESAFIO_DA_SEMANA : 0 };
  });
