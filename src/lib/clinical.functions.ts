/**
 * O prontuário longitudinal, do lado do médico.
 *
 * Antes disto o painel enxergava SEIS tabelas. Triagem de sintomas, contrações
 * cronometradas, acionamento de SOS, exames enviados, glicemia, rastreio de
 * depressão e a série pós-parto inteira eram gravados pela paciente e nunca
 * lidos por ninguém — a triagem VERMELHA, que é o app dizendo a ela "procure
 * atendimento agora", morria no INSERT.
 *
 * Aqui existe UMA leitura: a view `clinical_events` entrega os números crus de
 * todas as fontes com um contrato só, e a gravidade sai de `sinais-clinicos.ts`
 * — a mesma régua que a paciente vê. Nenhum limite clínico mora neste arquivo,
 * de propósito: régua duplicada foi a causa do pior defeito que este produto
 * teve, um app que chamava 35 mg/dL de "Normal" em verde.
 *
 * Recorte: sempre pelo vínculo ATUAL (`patient_profiles.doctor_id`), nunca por
 * um `doctor_id` carimbado na linha de origem. Quem deixou de ser paciente dele
 * some da leitura no mesmo instante — mesmo que o evento tenha nascido na época
 * em que era. A linha continua no banco (retenção de prontuário é obrigação
 * legal); o que se corta é o acesso pela interface.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  piorSinal,
  sinalGlicemia,
  sinalPressao,
  sinalSaturacao,
  type Gravidade,
  type Sinal,
} from "./sinais-clinicos";

/** Como a tela agrupa. Mesmo vocabulário da view. */
export type EspecieEvento =
  | "medida"
  | "sintoma"
  | "emergencia"
  | "exame"
  | "contracao"
  | "humor"
  | "movimento"
  | "consulta"
  | "pergunta";

/**
 * Os números de um evento, já normalizados entre as fontes.
 *
 * Campos explícitos e não `Record<string, unknown>`: o validador de
 * serialização do TanStack recusa `unknown`, e — o que importa mais — um
 * formato frouxo aqui viraria uma tela que exibe o que vier, incluindo o que
 * mudou de nome no meio do caminho.
 */
export type DadosEvento = {
  systolic?: number | null;
  diastolic?: number | null;
  glucose_mg_dl?: number | null;
  weight_kg?: number | null;
  spo2?: number | null;
  heart_rate_bpm?: number | null;
  momento?: string | null;
  nivel?: string | null;
  sintomas?: string[] | null;
  medicamentos?: string | null;
  emocional?: string | null;
  semana?: number | null;
  categoria?: string | null;
  nome?: string | null;
  intensidade?: number | null;
  duracao_seg?: number | null;
  chutes?: number | null;
  humor?: string | null;
  epds?: number | null;
  epds_q10?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  respondida?: boolean | null;
};

export type EventoClinico = {
  fonte: string;
  fonte_id: string;
  user_id: string;
  ocorrido_em: string;
  especie: EspecieEvento;
  dados: DadosEvento;
  texto: string | null;
  /** Calculada na leitura, nunca gravada — ver o cabeçalho. */
  gravidade: Gravidade;
  /** As frases dos sinais que dispararam, para a tela não ter que deduzir. */
  notas: string[];
  /** O médico já registrou desfecho para este evento? */
  tratado_em: string | null;
};

const COLS = "fonte,fonte_id,user_id,ocorrido_em,especie,dados,texto";

/* ────────────────────────────────────────────────────────────────────────────
   GRAVIDADE

   Um evento pode carregar mais de um número (a triagem traz pressão E nível;
   a medida traz pressão E glicemia). A gravidade do evento é a PIOR delas —
   é ela que ordena a fila do médico, e ordenar por média esconderia justamente
   o caso que não pode esperar.
   ──────────────────────────────────────────────────────────────────────────── */
function avaliar(especie: EspecieEvento, d: DadosEvento): { g: Gravidade; notas: string[] } {
  const sinais: (Sinal | null)[] = [
    sinalPressao(d.systolic, d.diastolic),
    sinalGlicemia(d.glucose_mg_dl),
    sinalSaturacao(d.spo2),
  ];

  /* A triagem já vem classificada pelo motor de sintomas do app — o mesmo que
     disse a ela "procure atendimento agora". Rebaixar isso aqui seria a tela
     do médico discordando, em silêncio, do que a paciente já leu. */
  if (d.nivel === "vermelho") sinais.push({ gravidade: "grave", nota: "Triagem vermelha" });
  else if (d.nivel === "amarelo") sinais.push({ gravidade: "atencao", nota: "Triagem amarela" });

  /* EPDS ≥13 é o corte de rastreio positivo para depressão; a questão 10 é
     ideação de autoagressão e não tem corte — qualquer resposta positiva é
     grave, e é por isso que ela é avaliada separada do escore total. */
  if (d.epds_q10 != null && d.epds_q10 > 0) {
    sinais.push({ gravidade: "grave", nota: "EPDS: questão 10 positiva" });
  } else if (d.epds != null && d.epds >= 13) {
    sinais.push({ gravidade: "grave", nota: `EPDS ${d.epds} — rastreio positivo` });
  } else if (d.epds != null && d.epds >= 10) {
    sinais.push({ gravidade: "atencao", nota: `EPDS ${d.epds}` });
  }

  // SOS é emergência por definição: ela apertou o botão.
  if (especie === "emergencia") sinais.push({ gravidade: "grave", nota: "Acionou o SOS" });

  return {
    g: piorSinal(...sinais),
    notas: sinais.filter((s): s is Sinal => !!s && !!s.nota).map((s) => s.nota),
  };
}

async function medicoDaSessao(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  if (!u.user) return null;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", u.user.id)
    .maybeSingle();
  return doc && doc.active !== false ? u.user : null;
}

/** Pacientes que são dele AGORA. O recorte de tudo neste arquivo. */
async function pacientesAtuais(doctorId: string): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("patient_profiles")
    .select("id,display_name")
    .eq("doctor_id", doctorId);
  return new Map(
    ((data ?? []) as { id: string; display_name: string | null }[]).map((p) => [
      p.id,
      p.display_name ?? "",
    ]),
  );
}

/**
 * `.in()` viaja na query string e uma lista longa estoura o buffer do proxy,
 * voltando 414 — que numa lista clínica viraria "nenhum evento", em silêncio.
 * Cem por vez, sempre.
 */
const LOTE = 100;

async function lerEventos(
  ids: string[],
  filtro: (q: any) => any,
): Promise<{ linhas: Record<string, unknown>[]; incompleto: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const linhas: Record<string, unknown>[] = [];
  let incompleto = false;
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await filtro(
      (supabaseAdmin as any)
        .from("clinical_events")
        .select(COLS)
        .in("user_id", ids.slice(i, i + LOTE)),
    );
    if (error) {
      // View ainda não criada (SQL pendente): tela vazia, não painel quebrado.
      incompleto = true;
      continue;
    }
    linhas.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return { linhas, incompleto };
}

function montar(linhas: Record<string, unknown>[], tratados: Map<string, string>): EventoClinico[] {
  return linhas.map((r) => {
    const dados = (r.dados ?? {}) as DadosEvento;
    const especie = String(r.especie) as EspecieEvento;
    const { g, notas } = avaliar(especie, dados);
    return {
      fonte: String(r.fonte),
      fonte_id: String(r.fonte_id),
      user_id: String(r.user_id),
      ocorrido_em: String(r.ocorrido_em),
      especie,
      dados,
      texto: (r.texto as string) ?? null,
      gravidade: g,
      notas,
      tratado_em: tratados.get(`${r.user_id}:${r.fonte}:${r.fonte_id}`) ?? null,
    };
  });
}

/**
 * Eventos que pedem olhar — de todas as pacientes dele.
 *
 * É a matéria-prima da fila de trabalho. Só o que está fora de faixa e ainda
 * sem desfecho registrado: uma lista que inclui o normal vira arquivo, e
 * arquivo ninguém lê todo dia.
 */
export const eventosQuePedemOlhar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        dias: z.number().int().min(1).max(90).default(14),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = {
      ok: true as const,
      eventos: [] as EventoClinico[],
      nomes: {} as Record<string, string>,
      incompleto: false,
    };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ...vazio, ok: false as const };
    try {
      const pacientes = await pacientesAtuais(user.id);
      const ids = [...pacientes.keys()];
      if (ids.length === 0) return vazio;

      const desde = new Date(Date.now() - data.dias * 86400000).toISOString();
      const { linhas, incompleto } = await lerEventos(ids, (q) =>
        q
          /* Humor e movimento ficam de fora daqui de propósito: são sinais de
             engajamento, não de deterioração, e enchiam a fila de itens que
             não mudam conduta. Eles continuam na ficha da paciente. */
          /* `humor` ENTRA — é onde mora o EPDS, e a questão 10 é ideação de
             autoagressão. O rótulo de humor do diário não vaza junto porque
             não tem régua: sai `normal` e o filtro abaixo o descarta.

             `contracao` SAI: não há régua para intensidade, então toda linha
             saía normal — mas era buscada, e uma noite de trabalho de parto
             grava centenas de linhas que consumiam o teto de 400 e empurravam
             para fora a pressão alterada de outra paciente, sem nenhum sinal.

             `emergencia` e `consulta` SAEM porque SOS e pré-consulta já têm
             item próprio na fila, com marcador de resolução próprio
             (`atendido_em`, `seen_by_doctor`). Mantendo os dois, o item que o
             médico acabou de resolver de um lado continuava vivo do outro. */
          .in("especie", ["medida", "sintoma", "humor"])
          .gte("ocorrido_em", desde)
          .order("ocorrido_em", { ascending: false })
          .limit(400),
      );

      const tratados = await lerDesfechos(user.id);
      const eventos = montar(linhas, tratados)
        .filter((e) => e.gravidade !== "normal" && !e.tratado_em)
        .sort((a, b) => {
          const peso = (g: Gravidade) => (g === "grave" ? 0 : g === "atencao" ? 1 : 2);
          const p = peso(a.gravidade) - peso(b.gravidade);
          if (p !== 0) return p;
          // Dentro da mesma cor, o mais RECENTE primeiro: um valor grave de
          // hoje pede mais que um de dez dias atrás que já passou.
          return b.ocorrido_em.localeCompare(a.ocorrido_em);
        });

      return {
        ok: true as const,
        eventos,
        nomes: Object.fromEntries(pacientes),
        incompleto,
      };
    } catch {
      /* `vazio` tem `incompleto: false`, e devolvê-lo aqui transformava uma
         falha de leitura em "nada esperando por você" — a boa notícia que o
         médico lê antes de fechar o painel. */
      return { ...vazio, incompleto: true };
    }
  });

async function lerDesfechos(doctorId: string): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { data } = await (supabaseAdmin as any)
      .from("clinical_acks")
      .select("fonte,fonte_id,user_id,visto_em")
      .eq("doctor_id", doctorId)
      .order("visto_em", { ascending: false })
      .limit(1000);
    return new Map(
      (
        (data ?? []) as { fonte: string; fonte_id: string; user_id: string; visto_em: string }[]
      ).map((a) => [`${a.user_id}:${a.fonte}:${a.fonte_id}`, a.visto_em]),
    );
  } catch {
    return new Map();
  }
}

/**
 * A linha do tempo clínica de UMA paciente — o prontuário.
 *
 * Sem janela de 14 dias como no relatório antigo: uma medida de 20 dias atrás
 * aparecia como "—", que o médico lia como "ela não registra" quando o certo
 * era "a última foi há 20 dias". Aqui a janela é escolhida por quem chama, e o
 * padrão cobre a gestação inteira.
 */
export const prontuarioDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        pacienteId: z.string().uuid(),
        dias: z.number().int().min(1).max(400).default(300),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, eventos: [] as EventoClinico[], incompleto: false };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ...vazio, ok: false as const };
    try {
      const pacientes = await pacientesAtuais(user.id);
      // Vínculo atual antes de qualquer leitura.
      if (!pacientes.has(data.pacienteId)) return { ...vazio, ok: false as const };

      const desde = new Date(Date.now() - data.dias * 86400000).toISOString();
      const { linhas, incompleto } = await lerEventos([data.pacienteId], (q) =>
        q.gte("ocorrido_em", desde).order("ocorrido_em", { ascending: false }).limit(1000),
      );
      const tratados = await lerDesfechos(user.id);
      return { ok: true as const, eventos: montar(linhas, tratados), incompleto };
    } catch {
      // Idem: "nenhum registro dela no período" não pode ser o rosto de uma
      // falha de rede — o modal diria que ela não usa o app.
      return { ...vazio, incompleto: true };
    }
  });

/**
 * Registra o desfecho de um evento.
 *
 * Não é "visto" — é "eu resolvi isto". A diferença importa: numa lista clínica,
 * marcar como lido faz o item sumir sem que nada tenha sido feito, e o próximo
 * médico não tem como saber se houve conduta.
 */
export const registrarDesfecho = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        fonte: z.string().min(1).max(60),
        fonteId: z.string().uuid(),
        pacienteId: z.string().uuid(),
        conduta: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("clinical_acks").upsert(
      {
        doctor_id: user.id,
        fonte: data.fonte,
        fonte_id: data.fonteId,
        user_id: data.pacienteId,
        visto_em: new Date().toISOString(),
        conduta: data.conduta ?? null,
      },
      { onConflict: "doctor_id,fonte,fonte_id" },
    );
    return { ok: !error };
  });

/* ════════════════════════════════════════════════════════════════════════════
   A FICHA — o que um obstetra procura primeiro

   A ficha da paciente no painel era, literalmente, um desenho do bebê e o log
   do chatbot. Nenhuma pressão, nenhum peso, nenhuma medicação — e os quatro
   fatores de risco da gestação anterior, que decidem conduta em alto risco,
   eram lidos SÓ pelo prompt da IA. A IA sabia que a paciente teve pré-eclâmpsia
   na gestação passada; a tela do médico, não.
   ════════════════════════════════════════════════════════════════════════════ */

export type FichaClinica = {
  nome: string | null;
  bebe: string | null;
  /** Idade gestacional em dias. Em obstetrícia os DIAS decidem conduta —
      corticoide, viabilidade, 36+6 versus 37+0 —, então a tela nunca deve
      arredondar para semanas. */
  gestDias: number | null;
  dpp: string | null;
  gestacaoNumero: number | null;
  tipoSanguineo: string | null;
  alergias: string | null;
  medicamentos: string | null;
  alturaCm: number | null;
  pesoPreGestacional: number | null;
  telefone: string | null;
  contatoEmergencia: string | null;
  telefoneEmergencia: string | null;
  /** Os quatro que hoje só a IA lê. */
  riscos: string[];
  observacoesPrevias: string | null;
  modoCuidado: boolean;
  /** O banco não tinha as colunas do perfil rico: campos ausentes são
      DESCONHECIDOS, não vazios. */
  degradada: boolean;
};

const PERFIL_COLS =
  "display_name,baby_name,lmp_date,due_date,reference_date,reference_weeks,reference_days," +
  "pregnancy_number,prior_bp_elevated,prior_bp_week,prior_gestational_diabetes,prior_preterm," +
  "prior_cesarean,prior_notes,blood_type,allergies,medications,height_cm," +
  "pre_pregnancy_weight_kg,emergency_contact,emergency_phone,care_mode,phone";

/**
 * Dias de gestação hoje.
 *
 * `reference_*` tem precedência sobre a DUM porque é a correção feita pelo
 * ultrassom — que é o padrão-ouro quando existe. Usar a DUM tendo o ultrassom
 * é o erro clássico e desloca a idade gestacional em semanas.
 */
function diasDeGestacao(p: Record<string, unknown>): number | null {
  const ref = p.reference_date as string | null;
  const rw = p.reference_weeks as number | null;
  const rd = p.reference_days as number | null;
  if (ref && rw != null) {
    const passados = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
    return rw * 7 + (rd ?? 0) + passados;
  }
  const dum = p.lmp_date as string | null;
  if (!dum) return null;
  return Math.floor((Date.now() - new Date(dum).getTime()) / 86400000);
}

export const fichaClinica = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), pacienteId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const, ficha: null };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ok: false as const, ficha: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    /* Escada de colunas: um banco sem as migrations de perfil rico devolve
       42703 para a consulta INTEIRA, não só para a coluna que falta — então
       uma coluna ausente apagaria a ficha toda em vez de um campo. */
    let perfil: Record<string, unknown> | null = null;
    let degradada = false;
    for (const cols of [PERFIL_COLS, "display_name,baby_name,lmp_date,due_date"]) {
      if (cols !== PERFIL_COLS) degradada = true;
      const { data: row, error } = await sb
        .from("patient_profiles")
        .select(cols)
        .eq("id", data.pacienteId)
        .maybeSingle();
      if (!error) {
        perfil = row as Record<string, unknown> | null;
        break;
      }
    }
    if (!perfil) return { ok: false as const, ficha: null };

    const riscos: string[] = [];
    if (perfil.prior_bp_elevated) {
      const s = perfil.prior_bp_week as number | null;
      riscos.push(`Pressão alta em gestação anterior${s ? ` (a partir de ${s}s)` : ""}`);
    }
    if (perfil.prior_gestational_diabetes) riscos.push("Diabetes gestacional anterior");
    if (perfil.prior_preterm) riscos.push("Parto prematuro anterior");
    if (perfil.prior_cesarean) riscos.push("Cesariana anterior");

    /* O telefone dela mora em `patient_profiles.phone`, e não em
       `auth.users.phone`: as pacientes entram por e-mail, então a coluna do
       Auth nunca é preenchida. Lendo de lá, o link de ligação da ficha — que
       existe justamente para uma emergência — nunca apareceria. */
    const telefone = (perfil.phone as string) || null;

    const ficha: FichaClinica = {
      nome: (perfil.display_name as string) ?? null,
      bebe: (perfil.baby_name as string) ?? null,
      gestDias: diasDeGestacao(perfil),
      dpp: (perfil.due_date as string) ?? null,
      gestacaoNumero: (perfil.pregnancy_number as number) ?? null,
      tipoSanguineo: (perfil.blood_type as string) ?? null,
      alergias: (perfil.allergies as string) ?? null,
      medicamentos: (perfil.medications as string) ?? null,
      alturaCm: (perfil.height_cm as number) ?? null,
      pesoPreGestacional: (perfil.pre_pregnancy_weight_kg as number) ?? null,
      telefone,
      contatoEmergencia: (perfil.emergency_contact as string) ?? null,
      telefoneEmergencia: (perfil.emergency_phone as string) ?? null,
      riscos,
      observacoesPrevias: (perfil.prior_notes as string) ?? null,
      modoCuidado: !!perfil.care_mode,
      /* Sem isto a ficha reduzida era indistinguível de uma paciente sem
         alergias e sem história de risco — a tela afirmando o oposto por
         omissão, numa gestante com pré-eclâmpsia anterior. */
      degradada,
    };
    return { ok: true as const, ficha };
  });

/* ════════════════════════════════════════════════════════════════════════════
   TENDÊNCIA

   Hipertensão gestacional se diagnostica por tendência, não por um valor; ganho
   ponderal súbito é sinal de pré-eclâmpsia. O painel mostrava o último ponto e
   contava os pontos — três pressões subindo em dez dias eram invisíveis.

   Mora aqui e não numa server function porque a série já vem no prontuário: um
   cálculo derivado que exige ida ao banco é um cálculo que a tela vai deixar de
   fazer.
   ════════════════════════════════════════════════════════════════════════════ */

export type Serie = {
  rotulo: string;
  unidade: string;
  pontos: { em: string; valor: number }[];
  /** Positivo = subindo. Em unidades por semana, para ser legível. */
  variacaoSemanal: number | null;
  ultimo: number | null;
};

export function serieDe(
  eventos: EventoClinico[],
  campo: "systolic" | "diastolic" | "glucose_mg_dl" | "weight_kg",
  rotulo: string,
  unidade: string,
): Serie {
  const pontos = eventos
    .map((e) => ({ em: e.ocorrido_em, valor: e.dados[campo] }))
    .filter((p): p is { em: string; valor: number } => typeof p.valor === "number")
    .sort((a, b) => a.em.localeCompare(b.em));

  /* Regressão simples sobre os últimos 60 dias. Dois pontos não fazem
     tendência — com menos de três a resposta honesta é "não sei", e uma seta
     desenhada a partir de duas medidas é a tela inventando conteúdo. */
  const corte = Date.now() - 60 * 86400000;
  const recentes = pontos.filter((p) => new Date(p.em).getTime() >= corte);
  let variacaoSemanal: number | null = null;
  if (recentes.length >= 3) {
    const t0 = new Date(recentes[0].em).getTime();
    const xs = recentes.map((p) => (new Date(p.em).getTime() - t0) / (7 * 86400000));
    const ys = recentes.map((p) => p.valor);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
    if (den > 0) variacaoSemanal = Math.round((num / den) * 10) / 10;
  }

  return {
    rotulo,
    unidade,
    pontos,
    variacaoSemanal,
    ultimo: pontos.length ? pontos[pontos.length - 1].valor : null,
  };
}
