/**
 * O BOLÃO DO NASCIMENTO — o lado do servidor.
 *
 * A régua (faixas, pontuação, ranking, empate, portão do Modo Cuidado) mora em
 * `bolao.ts` e é testada sem banco. Aqui fica só o que exige o servidor: provar
 * quem é quem, provar o vínculo, e escrever.
 *
 * ─── AS TRÊS CONFERÊNCIAS, E POR QUE NENHUMA PODE FALTAR ───────────────────
 *
 * 1. **Sessão.** Todo `donaId` que chega do cliente é um uuid que qualquer um
 *    pode digitar. Sem isto, um corpo de pedido forjado leria o bolão de
 *    qualquer gestante da plataforma — o mesmo defeito que `contatoDaPaciente`
 *    teve no painel do médico.
 *
 * 2. **Vínculo.** Ver o bolão de outra pessoa exige ser amiga dela
 *    (`saoAmigas`, o mesmo portão do perfil e do Cantinho). O bolão carrega o
 *    NOME de todo mundo que palpitou — é uma lista de pessoas próximas de uma
 *    gestante, e vazá-la é vazar o círculo social dela.
 *
 * 3. **Modo Cuidado.** ⚠️ Conferido ANTES de qualquer leitura, e sobre a DONA
 *    do bolão. Uma lista de pessoas queridas apostando alegremente numa data
 *    que não vai chegar é o pior artefato que este app conseguiria produzir.
 *    Filtrar na tela não serve: os palpites já teriam viajado pela rede.
 *
 * ⚠️ **E o motivo NUNCA é dito.** Quem consulta um bolão indisponível recebe
 * `indisponivel`, igual ao perfil das Amigas. "Ela está em Modo Cuidado"
 * contaria a perda dela para toda a torcida.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  bolaoDisponivel,
  PESO_MAXIMO,
  PESO_MINIMO,
  ranking,
  validarPalpite,
  type NascimentoReal,
  type PalpiteDoBolao,
} from "@/lib/bolao";

/** Uma linha do bolão como a tela precisa dela. */
export type PalpiteNaTela = PalpiteDoBolao & {
  autorId: string;
  autorNome: string;
  /** É o meu? A tela abre o formulário já preenchido. */
  meu: boolean;
};

export type BolaoNaTela = {
  donaId: string;
  donaNome: string;
  bebeNome: string | null;
  /** DPP, para a tela sugerir a data e a régua conferir a faixa. */
  dpp: string | null;
  palpites: PalpiteNaTela[];
  /** O que aconteceu. `null` enquanto o bebê não nasceu. */
  resultado: NascimentoReal | null;
  /** Só a dona registra o nascimento — a tela usa isto para mostrar o botão. */
  souADona: boolean;
};

const PalpiteSchema = z.object({
  accessToken: z.string().min(10),
  donaId: z.string().uuid(),
  dia: z.string(),
  pesoGramas: z.number().int().min(PESO_MINIMO).max(PESO_MAXIMO),
  horaMinutos: z.number().int().min(0).max(1439).nullable(),
});

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(accessToken);
  return data.user?.id ?? null;
}

/**
 * Posso ver o bolão desta gestante?
 *
 * Eu mesma sempre posso. Para os outros, o portão é `saoAmigas` — o MESMO de
 * `amigas.functions.ts`, importado e não recopiado: duas réguas de "quem é
 * amiga" divergiriam no primeiro conserto, e a divergência aqui seria
 * silenciosa (o bolão simplesmente apareceria para quem não devia).
 */
async function podeVer(sb: any, eu: string, dona: string): Promise<boolean> {
  if (eu === dona) return true;
  const { saoAmigas } = await import("@/lib/amigas.functions");
  return saoAmigas(sb, eu, dona);
}

/** A dona está em Modo Cuidado? Nesse caso o bolão não existe para ninguém. */
async function bolaoNoAr(sb: any, dona: string): Promise<{ ok: boolean; dpp: string | null }> {
  const { data } = await sb
    .from("patient_profiles")
    .select("care_mode, due_date")
    .eq("id", dona)
    .maybeSingle();
  const p = (data ?? null) as { care_mode?: boolean; due_date?: string | null } | null;
  const dpp = p?.due_date ?? null;
  /* `temGestacao` sai da DPP: sem data prevista não há o que palpitar. Uma
     conta sem DPP ainda não abriu bolão nenhum. */
  return {
    ok: bolaoDisponivel({ careMode: !!p?.care_mode, temGestacao: !!dpp }),
    dpp,
  };
}

/**
 * O bolão de alguém — o meu, ou o de uma amiga.
 *
 * Devolve `{ ok: false, motivo: "indisponivel" }` tanto para "não sou amiga"
 * quanto para "ela está em Modo Cuidado" quanto para "ela não tem DPP". Os três
 * casos são a mesma resposta de propósito: distinguir contaria à torcida uma
 * coisa sobre a gestação dela que ela não pediu para contar.
 */
export const verBolao = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), donaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!(await podeVer(sb, eu, data.donaId))) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }
    const noAr = await bolaoNoAr(sb, data.donaId);
    if (!noAr.ok) return { ok: false as const, motivo: "indisponivel" as const };

    const [{ data: perfil }, { data: linhas }, { data: res }] = await Promise.all([
      sb
        .from("patient_profiles")
        .select("display_name, baby_name")
        .eq("id", data.donaId)
        .maybeSingle(),
      sb
        .from("bolao_palpites")
        .select("autor_id, autor_nome, dia, peso_gramas, hora_minutos")
        .eq("dona_id", data.donaId),
      sb
        .from("bolao_resultado")
        .select("dia, peso_gramas, hora_minutos")
        .eq("dona_id", data.donaId)
        .maybeSingle(),
    ]);

    const p = (perfil ?? null) as { display_name?: string; baby_name?: string } | null;
    const brutos = (linhas ?? []) as {
      autor_id: string;
      autor_nome: string;
      dia: string;
      peso_gramas: number;
      hora_minutos: number | null;
    }[];
    const r = (res ?? null) as {
      dia: string;
      peso_gramas: number;
      hora_minutos: number | null;
    } | null;

    const bolao: BolaoNaTela = {
      donaId: data.donaId,
      donaNome: (p?.display_name ?? "").trim() || "Ela",
      bebeNome: (p?.baby_name ?? "").trim() || null,
      dpp: noAr.dpp,
      palpites: brutos.map((l) => ({
        autorId: l.autor_id,
        autorNome: l.autor_nome,
        dia: l.dia,
        pesoGramas: l.peso_gramas,
        horaMinutos: l.hora_minutos,
        meu: l.autor_id === eu,
      })),
      resultado: r ? { dia: r.dia, pesoGramas: r.peso_gramas, horaMinutos: r.hora_minutos } : null,
      souADona: eu === data.donaId,
    };

    /* O RANKING é calculado aqui, e não na tela, para o push do resultado e a
       lista usarem exatamente o mesmo número — a régua é a mesma função pura
       dos dois lados, mas rodá-la em dois lugares com dois recortes de dados é
       como duas telas começam a discordar. */
    const classificacao = bolao.resultado
      ? ranking(bolao.palpites, bolao.resultado).map((l) => ({
          autorId: l.palpite.autorId,
          posicao: l.posicao,
          nota: l.nota,
        }))
      : null;

    return { ok: true as const, bolao, classificacao };
  });

/**
 * Palpitar — ou corrigir o palpite.
 *
 * ⚠️ É `upsert` na chave `(dona_id, autor_id)`, e é isso que faz o palpite ser
 * EDITÁVEL até o parto sem virar duas linhas. Ver `bolao.ts`: travar no
 * primeiro envio faz quem palpitou na 20ª semana nunca mais voltar, e voltar é
 * o produto inteiro desta função.
 *
 * ⚠️ E ele é RECUSADO depois que o bebê nasce. Sem isso, quem abrisse o app no
 * dia seguinte ao parto poderia "palpitar" a data que já está na tela e ganhar
 * o bolão — o que estragaria a única coisa que o bolão tem de fazer direito.
 */
export const palpitar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PalpiteSchema.parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (!(await podeVer(sb, eu, data.donaId))) {
      return { ok: false as const, motivo: "indisponivel" as const };
    }
    const noAr = await bolaoNoAr(sb, data.donaId);
    if (!noAr.ok) return { ok: false as const, motivo: "indisponivel" as const };

    const palpite: PalpiteDoBolao = {
      dia: data.dia,
      pesoGramas: data.pesoGramas,
      horaMinutos: data.horaMinutos,
    };
    const erro = validarPalpite(palpite, noAr.dpp);
    if (erro) return { ok: false as const, motivo: erro };

    const { data: jaNasceu } = await sb
      .from("bolao_resultado")
      .select("dona_id")
      .eq("dona_id", data.donaId)
      .maybeSingle();
    if (jaNasceu) return { ok: false as const, motivo: "fechado" as const };

    /* O nome é CONGELADO no envio, e não lido do perfil na hora de mostrar:
       quem palpitou como "Vó Ana" continua "Vó Ana" no bolão mesmo que troque
       o nome do perfil depois. O bolão é registro do que aconteceu. */
    const { data: meu } = await sb
      .from("patient_profiles")
      .select("display_name")
      .eq("id", eu)
      .maybeSingle();
    const nome = ((meu as { display_name?: string } | null)?.display_name ?? "").trim() || "Alguém";

    const { error } = await sb.from("bolao_palpites").upsert(
      {
        dona_id: data.donaId,
        autor_id: eu,
        autor_nome: nome,
        dia: data.dia,
        peso_gramas: data.pesoGramas,
        hora_minutos: data.horaMinutos,
        editado_em: new Date().toISOString(),
      },
      { onConflict: "dona_id,autor_id" },
    );
    if (error) return { ok: false as const, motivo: "banco" as const };

    return { ok: true as const };
  });

/**
 * O bebê nasceu — e o bolão fecha.
 *
 * ⚠️ **Só a DONA registra**, e a conferência é a igualdade com a sessão: não há
 * `donaId` no corpo do pedido de propósito. O resultado é dado dela sobre o
 * parto dela, e um parâmetro aqui seria um convite para alguém da torcida
 * "fechar" o bolão de outra pessoa.
 */
export const registrarNascimento = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        dia: z.string(),
        pesoGramas: z.number().int().min(PESO_MINIMO).max(PESO_MAXIMO),
        horaMinutos: z.number().int().min(0).max(1439).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* A faixa é conferida contra a DPP dela, como qualquer palpite — quem
       registra o nascimento também erra o dedo, e um "340 g" aqui contaminaria
       a pontuação de todo mundo de uma vez. */
    const { data: perfil } = await sb
      .from("patient_profiles")
      .select("due_date")
      .eq("id", eu)
      .maybeSingle();
    const dpp = ((perfil as { due_date?: string | null } | null)?.due_date ?? null) as
      | string
      | null;

    const erro = validarPalpite(
      { dia: data.dia, pesoGramas: data.pesoGramas, horaMinutos: data.horaMinutos },
      dpp,
    );
    if (erro) return { ok: false as const, motivo: erro };

    const { error } = await sb.from("bolao_resultado").upsert(
      {
        dona_id: eu,
        dia: data.dia,
        peso_gramas: data.pesoGramas,
        hora_minutos: data.horaMinutos,
      },
      { onConflict: "dona_id" },
    );
    if (error) return { ok: false as const, motivo: "banco" as const };

    return { ok: true as const };
  });
