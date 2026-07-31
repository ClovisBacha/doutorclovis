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
import { computeGestation } from "./gestacao";
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

/**
 * Registra QUEM leu o prontuário de QUEM.
 *
 * Uma auditoria de dado clínico não começa perguntando se a RLS está certa —
 * começa pedindo o log de acesso ao prontuário. `audit_log` existe neste
 * produto desde sempre e era escrita só por ações de super-admin: nenhuma das
 * funções clínicas passava por ela. Não havia como responder "quem abriu a
 * ficha da paciente X em 12 de maio", nem como PROVAR que ninguém abriu.
 *
 * COM `await`, e isso é o ponto delicado. A primeira versão disparava um
 * `void (async () => ...)()` para não custar latência à leitura do médico — e
 * seria perda silenciosa: na Vercel a instância congela quando a resposta é
 * devolvida, então uma promessa solta depois do `return` muitas vezes nunca
 * chega a rodar. Uma trilha que some sob carga é PIOR que trilha nenhuma: ela
 * responde "ninguém abriu a ficha dela" quando na verdade ninguém sabe.
 *
 * Esperar é seguro porque `writeAudit` já engole qualquer erro — tabela
 * ausente, rede caída, RLS — e nunca lança. O custo é um insert a mais numa
 * função que já faz quatro idas ao banco.
 *
 * O `meta` guarda só ids. O log de acesso não pode virar uma segunda cópia do
 * prontuário — seria trocar um problema por outro maior.
 */
async function trilha(
  user: { id: string; email?: string | null },
  acao: string,
  pacienteId: string,
): Promise<void> {
  try {
    const { writeAudit } = await import("./audit.server");
    await writeAudit({ id: user.id, email: user.email }, acao, pacienteId, null);
  } catch {
    /* trilha é auxiliar */
  }
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
      await trilha(user, "prontuario.ler", data.pacienteId);
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
  /* DELEGA. Esta função tinha a própria aritmética, e ela divergia da do app da
     paciente por UM DIA todo fim de tarde:

       `new Date("2026-01-10")`             → 00:00 UTC   (o que estava aqui)
       `new Date("2026-01-10T00:00:00")`    → 00:00 LOCAL (o que o app usa)

     Em America/Sao_Paulo (UTC-3) a diferença é de 3 horas, então das 21h à
     meia-noite a ficha do médico ficava um dia À FRENTE do app dela. Medido:
     ficha 33s2d contra app 33s1d, e a fronteira do termo caindo em 37s0d de um
     lado e 36s6d do outro.

     O cabeçalho deste arquivo diz que "em obstetrícia os DIAS decidem conduta —
     corticoide, viabilidade, 36+6 versus 37+0". Duas réguas para essa pergunta
     é uma a mais, e alinhar os números não resolve: elas voltariam a divergir na
     próxima edição. `computeGestation` (src/lib/gestacao.ts) é a régua do
     produto — inclusive a precedência do ultrassom sobre a DUM, que era o
     motivo desta função existir e que ela já implementa. */
  const g = computeGestation({
    lmp: p.lmp_date as string | null,
    referenceDate: p.reference_date as string | null,
    referenceWeeks: p.reference_weeks as number | null,
    referenceDays: p.reference_days as number | null,
  });
  return g?.totalDays ?? null;
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

    await trilha(user, "ficha.ler", data.pacienteId);
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

/* ════════════════════════════════════════════════════════════════════════════
   A CONSULTA, E O QUE MUDOU DESDE ELA

   "O que mudou desde a última consulta?" é a pergunta que o obstetra faz toda
   vez, e o sistema não conseguia responder — não por falta de tela, por falta
   de âncora. `appointment_requests` é um PEDIDO de horário e nem aponta para a
   conta da paciente (identifica por e-mail digitado em formulário), e nota
   clínica só existia em teleconsulta.
   ════════════════════════════════════════════════════════════════════════════ */

export type Consulta = {
  id: string;
  occurred_at: string;
  kind: string;
  achados: string | null;
  conduta: string | null;
  systolic: number | null;
  diastolic: number | null;
  weight_kg: number | null;
  fundal_height_cm: number | null;
  fetal_bpm: number | null;
  resumo_paciente: string | null;
};

const CONSULTA_COLS =
  "id,occurred_at,kind,achados,conduta,systolic,diastolic,weight_kg,fundal_height_cm,fetal_bpm,resumo_paciente";

/**
 * O que aconteceu com ela desde a última vez que ele a viu.
 *
 * Puro de propósito: recebe os eventos e a data-âncora e devolve o que a tela
 * mostra. Dá para testar sem banco — e é justamente aqui que mora a lógica que
 * erra em silêncio se ninguém olhar.
 */
export type Mudanca = {
  /** Quantos registros ela fez no período. Zero é informação, não ausência. */
  registros: number;
  /** Os que pediram atenção, do pior para o mais recente. */
  alteracoes: EventoClinico[];
  /** Episódios: SOS, triagem de alerta, ida de urgência. */
  episodios: EventoClinico[];
  /** Perguntas dela ainda sem resposta. */
  perguntasAbertas: EventoClinico[];
  /** Exames enviados no período. */
  exames: EventoClinico[];
  /** Variação de peso desde a consulta, em kg. `null` sem os dois pontos. */
  deltaPeso: number | null;
};

export function mudancasDesde(
  eventos: EventoClinico[],
  desde: string | null,
  /** Peso aferido na consulta anterior — a base da comparação. */
  pesoNaConsulta?: number | null,
): Mudanca {
  /* Sem consulta anterior, "desde" é o começo: tudo o que existe é novidade
     para ele. É o caso da primeira consulta, e mostrar vazio ali seria esconder
     justamente o histórico que ela trouxe. */
  const corte = desde ? new Date(desde).getTime() : 0;
  const depois = eventos.filter((e) => {
    const t = new Date(e.ocorrido_em).getTime();
    return Number.isFinite(t) && t >= corte;
  });

  /* ORDENA AQUI. A função é exportada e documentada como pura — nada na
     assinatura dizia que a ordem de entrada importava, e `pesos[0]` assumia
     "mais recente primeiro". Com a lista invertida, +4,1 kg virava +1,6 kg. */
  const porRecencia = [...depois].sort((a, b) => b.ocorrido_em.localeCompare(a.ocorrido_em));
  const pesos = porRecencia.map((e) => Number(e.dados.weight_kg)).filter((v) => Number.isFinite(v));
  const deltaPeso =
    pesoNaConsulta != null && pesos.length > 0
      ? Math.round((pesos[0] - Number(pesoNaConsulta)) * 10) / 10
      : null;

  const peso = (g: Gravidade) => (g === "grave" ? 0 : g === "atencao" ? 1 : 2);
  return {
    registros: depois.length,
    /* `sintoma` fora daqui também: a triagem vermelha já é episódio, e contá-la
       nos dois lugares inflava o alarme com o mesmo evento — exatamente o que o
       teste protege para `emergencia`. */
    alteracoes: depois
      .filter(
        (e) => e.gravidade !== "normal" && e.especie !== "emergencia" && e.especie !== "sintoma",
      )
      .sort(
        (a, b) =>
          peso(a.gravidade) - peso(b.gravidade) || b.ocorrido_em.localeCompare(a.ocorrido_em),
      ),
    episodios: depois.filter(
      (e) => e.especie === "emergencia" || (e.especie === "sintoma" && e.gravidade !== "normal"),
    ),
    perguntasAbertas: depois.filter(
      (e) => e.especie === "pergunta" && e.dados.respondida === false,
    ),
    exames: depois.filter((e) => e.especie === "exame"),
    deltaPeso,
  };
}

/** As consultas dela, mais recente primeiro. */
export const consultasDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        pacienteId: z.string().uuid(),
        limite: z.number().int().min(1).max(50).default(10),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, consultas: [] as Consulta[] };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ...vazio, ok: false as const };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ...vazio, ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      /* `doctor_id` NO FILTRO. Sem ele, no instante em que a paciente aceita
         vínculo com outro consultório, o novo médico passava a ler `achados` e
         `conduta` escritos pelo anterior — o prontuário privado dele, que a
         própria migration descreve como "escrito para outro médico, com
         hipótese que assustaria sem contexto". Prontuário não é dado da
         plataforma: é documento de um profissional, e transferi-lo exige
         consentimento, não um clique de vínculo. `emissoesDaPaciente` e
         `lerDesfechos` já filtravam; aqui tinha escapado. */
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("consultations")
        .select(CONSULTA_COLS)
        .eq("user_id", data.pacienteId)
        .eq("doctor_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(data.limite);
      // Tabela ainda não criada: ficha sem consultas, não ficha quebrada.
      if (error) return vazio;
      return { ok: true as const, consultas: (rows ?? []) as Consulta[] };
    } catch {
      return vazio;
    }
  });

/** Registra (ou corrige) uma consulta. */
export const salvarConsulta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid().optional(),
        pacienteId: z.string().uuid(),
        ocorridaEm: z.string().min(4).optional(),
        tipo: z.enum(["presencial", "teleconsulta", "retorno", "urgencia"]).default("presencial"),
        achados: z.string().max(8000).optional(),
        conduta: z.string().max(8000).optional(),
        resumoPaciente: z.string().max(4000).optional(),
        /* As faixas repetem as de `sinais-clinicos.ts` e as do CHECK do banco.
           Validar aqui é o que faz o médico ver "a diastólica precisa ficar
           entre 20 e 200" em vez do erro genérico do Postgres. */
        systolic: z.number().int().min(50).max(300).nullable().optional(),
        diastolic: z.number().int().min(20).max(200).nullable().optional(),
        pesoKg: z.number().min(25).max(350).nullable().optional(),
        alturaUterinaCm: z.number().min(5).max(60).nullable().optional(),
        bpmFetal: z.number().int().min(60).max(220).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const, id: null };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ok: false as const, id: null };

    // O par de pressão é tudo-ou-nada, igual ao CHECK do banco. Sem isto o
    // insert volta erro cru e o médico perde o que digitou.
    const temS = data.systolic != null;
    const temD = data.diastolic != null;
    if (temS !== temD) return { ok: false as const, id: null, motivo: "pa_incompleta" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linha = {
      doctor_id: user.id,
      user_id: data.pacienteId,
      occurred_at: data.ocorridaEm ?? new Date().toISOString(),
      kind: data.tipo,
      achados: data.achados ?? null,
      conduta: data.conduta ?? null,
      resumo_paciente: data.resumoPaciente ?? null,
      systolic: data.systolic ?? null,
      diastolic: data.diastolic ?? null,
      weight_kg: data.pesoKg ?? null,
      fundal_height_cm: data.alturaUterinaCm ?? null,
      fetal_bpm: data.bpmFetal ?? null,
    };
    try {
      if (data.id) {
        /* `doctor_id` no WHERE: consulta de outro consultório não é afetada,
           sem checagem separada que abriria corrida. */
        /* `user_id` também no WHERE: sem ele, um `id` da consulta da Ana com o
           `pacienteId` da Bia transferia achados, conduta e o resumo que a Ana
           já leu para o prontuário da Bia. Não há caminho de UI para isso hoje,
           mas a server function é um endpoint HTTP. */
        const { data: mexeu, error } = await (supabaseAdmin as any)
          .from("consultations")
          .update(linha)
          .eq("id", data.id)
          .eq("doctor_id", user.id)
          .eq("user_id", data.pacienteId)
          .select("id");
        if (error || !mexeu?.length) return { ok: false as const, id: null };
        return { ok: true as const, id: data.id };
      }
      const { data: nova, error } = await (supabaseAdmin as any)
        .from("consultations")
        .insert(linha)
        .select("id")
        .single();
      if (error) {
        const code = (error as { code?: string }).code;
        /* A tela dizia "Confira os valores e tente de novo" quando o problema
           era a tabela não existir. Ele conferia os valores, redigitava, tentava
           de novo — e nada nunca ia dizer que faltava rodar o SQL. */
        if (code === "42P01" || code === "PGRST205") {
          return { ok: false as const, id: null, motivo: "banco_desatualizado" as const };
        }
        // Índice único: a mesma consulta já foi registrada.
        if (code === "23505") {
          return { ok: false as const, id: null, motivo: "duplicada" as const };
        }
        return { ok: false as const, id: null };
      }
      if (!nova) return { ok: false as const, id: null };
      return { ok: true as const, id: nova.id as string };
    } catch {
      return { ok: false as const, id: null };
    }
  });

/**
 * As consultas dela, do lado DELA.
 *
 * Devolve `occurred_at`, o tipo e SÓ o `resumo_paciente`. `achados` e `conduta`
 * nunca saem daqui — são o prontuário, escrito para outro médico, e o que
 * tranquiliza numa conversa de consultório pode assustar lido sozinho às onze
 * da noite.
 *
 * É por isso que a paciente não tem policy de leitura em `consultations`: o
 * Postgres não faz RLS por coluna, então uma policy entregaria o prontuário
 * cru junto. O recorte acontece aqui, e a tabela fica fechada.
 */
export type ConsultaDaPaciente = {
  id: string;
  occurred_at: string;
  kind: string;
  resumo: string;
  medico: string | null;
};

export const minhasConsultas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, consultas: [] as ConsultaDaPaciente[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ...vazio, ok: false as const };
    try {
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("consultations")
        .select("id,occurred_at,kind,resumo_paciente,doctor_id")
        .eq("user_id", u.user.id)
        /* Só as que TÊM resumo. Uma consulta sem o campo preenchido não vira
           uma linha vazia na tela dela: ele não escreveu nada para ela, e
           mostrar a data sozinha só levantaria a pergunta "e o que ele disse?"
           sem ter resposta. */
        .not("resumo_paciente", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(30);
      if (error) return vazio;

      const linhas = (rows ?? []) as Record<string, string>[];
      const ids = Array.from(new Set(linhas.map((r) => r.doctor_id).filter(Boolean)));
      const nomes = new Map<string, string>();
      if (ids.length) {
        const { data: docs } = await (supabaseAdmin as any)
          .from("doctors")
          .select("id,display_name")
          .in("id", ids);
        for (const d of (docs ?? []) as Record<string, string>[]) {
          nomes.set(d.id, d.display_name ?? "");
        }
      }
      return {
        ok: true as const,
        consultas: linhas
          .filter((r) => (r.resumo_paciente ?? "").trim() !== "")
          .map((r) => ({
            id: r.id,
            occurred_at: r.occurred_at,
            kind: r.kind,
            resumo: r.resumo_paciente,
            medico: nomes.get(r.doctor_id) || null,
          })),
      };
    } catch {
      return vazio;
    }
  });

/* ════════════════════════════════════════════════════════════════════════════
   EXAMES — o ciclo que estava aberto no meio

   O painel tem "Solicitação de Exames". Ela fotografa o laudo do TOTG, do
   Doppler, da urocultura, e sobe no app. E não existe UMA tela do médico que
   leia `exam_files` — ele pede o exame e continua pedindo que ela leve
   impresso, com o sistema já tendo o arquivo.
   ════════════════════════════════════════════════════════════════════════════ */

export type ExameRecebido = {
  id: string;
  user_id: string;
  paciente: string | null;
  nome: string;
  categoria: string;
  semana: number | null;
  notas: string | null;
  created_at: string;
  /** Quando ele registrou que leu. `null` = ainda esperando. */
  visto_em: string | null;
};

/**
 * Exames que as pacientes dele enviaram.
 *
 * `image_data` fica DE FORA da listagem de propósito: é base64 de JPEG inteiro,
 * e trinta exames numa resposta seriam dezenas de megabytes trafegados para
 * desenhar uma lista de nomes. A imagem vem sob demanda, quando ele abre um.
 */
export const examesRecebidos = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        dias: z.number().int().min(1).max(400).default(120),
        apenasNaoVistos: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    /* `incompleto` é o que separa "não há exame" de "não consegui ler". Sem
       ele, uma falha de banco virava a tela dizendo "Nenhuma paciente enviou
       exame" — o médico lendo que não há laudo quando há. */
    const vazio = { ok: true as const, exames: [] as ExameRecebido[], incompleto: false };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ...vazio, ok: false as const };
    try {
      const pacientes = await pacientesAtuais(user.id);
      const ids = [...pacientes.keys()];
      if (ids.length === 0) return vazio;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const desde = new Date(Date.now() - data.dias * 86400000).toISOString();
      const linhas: Record<string, unknown>[] = [];
      // Lotes de 100: `.in()` viaja na URL e uma lista longa volta 414, que aqui
      // viraria "nenhum exame" em silêncio.
      for (let i = 0; i < ids.length; i += LOTE) {
        const { data: rows, error } = await (supabaseAdmin as any)
          .from("exam_files")
          .select("id,user_id,name,category,week,notes,created_at")
          .in("user_id", ids.slice(i, i + LOTE))
          .gte("created_at", desde)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) return { ...vazio, incompleto: true };
        linhas.push(...((rows ?? []) as Record<string, unknown>[]));
      }

      const vistos = await lerDesfechos(user.id);
      const exames = linhas
        .map((r) => ({
          id: String(r.id),
          user_id: String(r.user_id),
          paciente: pacientes.get(String(r.user_id)) || null,
          nome: String(r.name ?? ""),
          categoria: String(r.category ?? "outros"),
          semana: (r.week as number) ?? null,
          notas: (r.notes as string) ?? null,
          created_at: String(r.created_at),
          visto_em: vistos.get(`${r.user_id}:exam_files:${r.id}`) ?? null,
        }))
        .filter((e) => !data.apenasNaoVistos || !e.visto_em)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { ok: true as const, exames, incompleto: false };
    } catch {
      return { ...vazio, incompleto: true };
    }
  });

/** A imagem de UM exame. Separada da lista porque é o que pesa. */
export const imagemDoExame = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), exameId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    /* TRÊS RESPOSTAS DIFERENTES, e não uma só.
    
       Antes, falha de leitura, "não é sua paciente" e "a linha não tem imagem"
       colapsavam em `{ok:false, imagem:null}` — e a tela mostrava, para os
       três, "Este registro não tem imagem anexada". Ela fotografou o laudo; ele
       lia que não havia laudo, marcava como visto e seguia. */
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const, imagem: null, motivo: "sessao" as const };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await (supabaseAdmin as any)
        .from("exam_files")
        .select("user_id,image_data")
        .eq("id", data.exameId)
        .maybeSingle();
      if (error) return { ok: false as const, imagem: null, motivo: "falha" as const };
      /* "não existe" e "não é sua paciente" respondem IGUAL — as outras doze
         funções já faziam assim. Distinguir permitia a um médico confirmar, com
         um uuid qualquer, que ele é um laudo real de paciente de outro
         consultório. Uuid não se adivinha, mas vaza por URL, log e screenshot. */
      if (!row) return { ok: false as const, imagem: null, motivo: "nao_encontrado" as const };
      /* Vínculo ATUAL depois de saber de quem é o exame: quem trocou de médico
         não tem os laudos dela abertos para o consultório anterior. */
      const pacientes = await pacientesAtuais(user.id);
      if (!pacientes.has(String(row.user_id))) {
        return { ok: false as const, imagem: null, motivo: "nao_encontrado" as const };
      }
      await trilha(user, "exame.imagem", String(row.user_id));
      const img = (row.image_data as string) ?? null;
      return {
        ok: true as const,
        imagem: img,
        motivo: img ? ("ok" as const) : ("sem_imagem" as const),
      };
    } catch {
      return { ok: false as const, imagem: null, motivo: "falha" as const };
    }
  });

/**
 * Devolutiva do exame: ele leu e conta a ela o que viu.
 *
 * Marca como visto E entrega o recado — as duas coisas juntas, porque marcar
 * sem devolver deixa o ciclo aberto exatamente onde ele estava: ela mandou o
 * laudo e nunca soube se alguém olhou.
 *
 * A entrega usa a aba Perguntas dela, que já sabe renderizar resposta do
 * médico. Uma caixa de entrada nova seria outro lugar para ela ter de aprender
 * a olhar.
 */
export const devolutivaDoExame = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        exameId: z.string().uuid(),
        pacienteId: z.string().uuid(),
        nomeDoExame: z.string().min(1).max(200),
        recado: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const agora = new Date().toISOString();

    const { error } = await (supabaseAdmin as any).from("clinical_acks").upsert(
      {
        doctor_id: user.id,
        fonte: "exam_files",
        fonte_id: data.exameId,
        user_id: data.pacienteId,
        visto_em: agora,
        conduta: data.recado ?? null,
      },
      { onConflict: "doctor_id,fonte,fonte_id" },
    );
    if (error) return { ok: false as const };

    const recado = (data.recado ?? "").trim();
    if (!recado) return { ok: true as const, avisou: false as const };

    /* O ERRO DO INSERT PRECISA SER CHECADO.
    
       `supabase-js` não lança — devolve `{ error }`. Sem checar, o push saía
       ("Seu médico viu o seu exame") sobre uma escrita que podia ter falhado,
       e o painel dizia "Devolutiva enviada ✓". Ela recebia a notificação, abria
       o app e não achava nada — e o texto não existia em lugar nenhum. */
    let escreveu = false;
    try {
      let { error: errIns } = await (supabaseAdmin as any).from("doctor_questions").insert({
        user_id: data.pacienteId,
        doctor_id: user.id,
        question: `Sobre o exame que você enviou: ${data.nomeDoExame}`,
        answer: recado,
        answered: true,
        answered_at: agora,
      });
      /* `colunaAusente` cobre os DOIS códigos. Antes era só `42703`, que é o
         que o Postgres devolve numa LEITURA — num INSERT o PostgREST devolve
         `PGRST204` e nem chega ao banco. O recuo nunca rodava: o texto que o
         médico escreveu para a paciente não era gravado, `escreveu` ficava
         false, e a tela mostrava "Marcado como lido ✓" e fechava o modal. */
      const { colunaAusente } = await import("./postgrest");
      if (colunaAusente(errIns)) {
        // Banco sem as colunas de resposta: grava o que dá.
        ({ error: errIns } = await (supabaseAdmin as any).from("doctor_questions").insert({
          user_id: data.pacienteId,
          doctor_id: user.id,
          question: `Sobre o exame que você enviou: ${data.nomeDoExame} — ${recado}`,
          answered: true,
        }));
      }
      escreveu = !errIns;
    } catch {
      escreveu = false;
    }
    // Sem escrita, sem aviso: notificar sobre um texto que não existe é pior
    // que não notificar.
    if (!escreveu) return { ok: true as const, avisou: false as const };

    let entregue = 0;
    try {
      const { sendPushToUser } = await import("./push.server");
      const r = await sendPushToUser(data.pacienteId, {
        title: "Seu médico viu o seu exame",
        // Neutro: achado clínico não vai para a tela bloqueada dela.
        body: "Toque para ler o que ele escreveu.",
        url: "/minha-conta?tab=Consultas&sub=perguntas",
      });
      entregue = r?.sent ?? 0;
    } catch {
      /* a devolutiva está na aba dela mesmo sem push */
    }
    /* `avisou` passa a significar "chegou um aviso", e não "não deu exceção".
       `sendPushToUser` devolve `{sent:0}` sem lançar quando o VAPID não está
       configurado ou quando ela não tem inscrição — e o painel dizia "enviada"
       do mesmo jeito. */
    return { ok: true as const, avisou: entregue > 0, salvou: true as const };
  });

/* ════════════════════════════════════════════════════════════════════════════
   O QUE O MÉDICO EMITE — receita, pedido de exame, orientação

   A aba Ferramentas tinha os modelos prontos e fazia duas coisas: copiar e
   imprimir. A receita existia só no papel que ela levava, e o sistema — que tem
   a caixa onde o laudo volta — nunca soube que o exame tinha sido pedido.
   ════════════════════════════════════════════════════════════════════════════ */

export type TipoDeEmissao = "prescricao" | "exame" | "orientacao";

export type Emissao = {
  id: string;
  user_id: string;
  paciente: string | null;
  kind: TipoDeEmissao;
  titulo: string;
  conteudo: string;
  nota: string | null;
  cumprido_em: string | null;
  created_at: string;
};

const EMISSAO_COLS = "id,user_id,kind,titulo,conteudo,nota,cumprido_em,created_at";

const ROTULO_EMISSAO: Record<TipoDeEmissao, string> = {
  prescricao: "Receita",
  exame: "Pedido de exame",
  orientacao: "Orientação",
};

/**
 * Emite e entrega.
 *
 * As duas coisas juntas, e não em passos separados: emitir sem entregar
 * reproduz o que já acontecia — o documento existe e ela não sabe. A entrega
 * usa a aba Perguntas dela, que já sabe renderizar recado do médico.
 */
export const emitirParaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        pacienteId: z.string().uuid(),
        tipo: z.enum(["prescricao", "exame", "orientacao"]),
        titulo: z.string().min(2).max(200),
        conteudo: z.string().min(2).max(8000),
        nota: z.string().max(2000).optional(),
        consultaId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await trilha(user, "emissao.criar", data.pacienteId);
    const { data: nova, error } = await (supabaseAdmin as any)
      .from("doctor_orders")
      .insert({
        doctor_id: user.id,
        user_id: data.pacienteId,
        kind: data.tipo,
        titulo: data.titulo,
        conteudo: data.conteudo,
        nota: data.nota ?? null,
        consultation_id: data.consultaId ?? null,
      })
      .select("id")
      .single();
    if (error || !nova) return { ok: false as const };

    /* Avisa. Best-effort: o documento já está gravado e ela o encontra na aba
       dela — uma falha de push não pode desfazer a emissão. */
    let entregue = 0;
    try {
      const { sendPushToUser } = await import("./push.server");
      const r = await sendPushToUser(data.pacienteId, {
        title: `${ROTULO_EMISSAO[data.tipo]} do seu médico`,
        /* NEUTRO. `titulo` é o nome do modelo — "Hipertensão gestacional /
           pré-eclâmpsia", "Diabetes gestacional". Push aparece na tela
           bloqueada, no relógio, no notebook pareado: é diagnóstico exposto a
           quem estiver perto do celular dela, inclusive numa gravidez que ela
           ainda não contou. Os outros avisos do produto já são neutros; este
           tinha regredido. */
        body: "Toque para ver o que ele enviou.",
        // `agenda`, e não `perguntas`: é onde `MeusPedidos` é renderizado.
        url: "/minha-conta?tab=Consultas&sub=agenda",
      });
      entregue = r?.sent ?? 0;
    } catch {
      /* sem push; o documento está lá */
    }
    return { ok: true as const, id: nova.id as string, avisou: entregue > 0 };
  });

/** O que ele emitiu para uma paciente. */
export const emissoesDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), pacienteId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, emissoes: [] as Emissao[] };
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ...vazio, ok: false as const };
    const pacientes = await pacientesAtuais(user.id);
    if (!pacientes.has(data.pacienteId)) return { ...vazio, ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("doctor_orders")
        .select(EMISSAO_COLS)
        .eq("user_id", data.pacienteId)
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return vazio;
      return {
        ok: true as const,
        emissoes: ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          user_id: String(r.user_id),
          paciente: pacientes.get(String(r.user_id)) || null,
          kind: String(r.kind) as TipoDeEmissao,
          titulo: String(r.titulo),
          conteudo: String(r.conteudo),
          nota: (r.nota as string) ?? null,
          cumprido_em: (r.cumprido_em as string) ?? null,
          created_at: String(r.created_at),
        })),
      };
    } catch {
      return vazio;
    }
  });

/**
 * Responder uma pergunta da paciente, ali mesmo.
 *
 * Hoje a aba Perguntas só tem um botão de "marcar respondida": para ESCREVER a
 * resposta o médico precisa ir à aba Cérebro, achar o oitavo card do treinador
 * de IA e responder lá. O ato clínico mais frequente do produto está enterrado
 * dentro de uma tela de treinamento de modelo.
 *
 * E `answerAndTrain`, que é o caminho de lá, grava a resposta e **não avisa
 * ninguém** — ela descobre se abrir o app por acaso.
 *
 * `treinar` vem ligado por padrão de propósito, e é a alavanca da estratégia:
 * cada resposta que também vira conhecimento é uma pergunta que a IA responde
 * sozinha da próxima vez, para outra paciente, às três da manhã. Desligar é
 * possível — resposta muito específica de UMA gestação não deve virar conduta
 * geral —, mas o padrão é acumular.
 */
export const responderPergunta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        perguntaId: z.string().uuid(),
        resposta: z.string().min(2).max(4000),
        /* DESLIGADO por padrão. A pergunta da paciente pode conter o nome do
           marido, um diagnóstico que ela não contou a ninguém, o remédio que
           toma escondido. Ligado por padrão, isso virava contexto do assistente
           de OUTRA paciente com um clique — e o caminho antigo
           (`answerAndTrain`) protegia exatamente contra isso, obrigando o
           médico a reescrever a pergunta antes. Eu tinha removido a proteção. */
        treinar: z.boolean().default(false),
        /* A pergunta GENERALIZADA. Sem ela, não treina: o que vira conhecimento
           reutilizável nunca carrega o texto cru dela. */
        perguntaGeneralizada: z.string().min(8).max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* `doctor_id` no próprio WHERE: pergunta de outro consultório não é
       afetada, sem checagem separada que abriria corrida. */
    const { data: pergunta } = await sb
      .from("doctor_questions")
      .select("id,user_id,question")
      .eq("id", data.perguntaId)
      .eq("doctor_id", user.id)
      .maybeSingle();
    if (!pergunta) return { ok: false as const };

    /* VÍNCULO ATUAL — esta era a única função do médico sem esta checagem.

       `.eq("doctor_id", user.id)` acima é o carimbo HISTÓRICO da linha, não a
       relação de hoje. Sem o recorte, um médico de quem a paciente se
       desvinculou — inclusive porque teve motivo — continuava lendo a pergunta
       dela, gravando texto arbitrário na resposta e disparando push no celular
       dela assinado "Seu médico respondeu". É um canal de mensagem para uma
       ex-paciente, com a marca do produto por cima. */
    const pacientesDele = await pacientesAtuais(user.id);
    if (!pacientesDele.has(String(pergunta.user_id))) return { ok: false as const };

    const agora = new Date().toISOString();
    /* `.eq("answered", false)` no WHERE: duplo clique, duas abas ou um retry
       depois de timeout não geram segunda resposta, segundo push e segunda
       entrada no cérebro. O caminho antigo tinha essa guarda; a minha versão
       não tinha. */
    const { data: mexeu, error } = await sb
      .from("doctor_questions")
      .update({ answered: true, answer: data.resposta, answered_at: agora })
      .eq("id", data.perguntaId)
      .eq("answered", false)
      .select("id");

    if (error) {
      /* COLUNA AUSENTE NÃO PODE VIRAR SUCESSO.

         O recuo antigo gravava só `{answered: true}` — descartando o TEXTO da
         resposta — e mesmo assim disparava o push e devolvia ok. A paciente
         recebia "Seu médico respondeu", abria a aba e encontrava a pergunta
         marcada como respondida, sem resposta nenhuma.

         E o código do PostgREST para coluna ausente no PAYLOAD é `PGRST204`,
         não `42703` — então o recuo nem entrava: o médico lia "Não consegui
         enviar" para sempre, que é o estado do banco de produção hoje. */
      const code = (error as { code?: string } | null)?.code;
      if (code === "PGRST204" || code === "42703") {
        return { ok: false as const, motivo: "banco_desatualizado" as const };
      }
      return { ok: false as const };
    }
    // Zero linhas: já estava respondida. Não é erro, e não avisa de novo.
    if (!mexeu?.length) return { ok: true as const, treinou: false, jaEstava: true as const };

    /* O aviso. Sem ele, responder é escrever para uma gaveta: o produto conta
       com ela abrindo o app por acaso no dia certo. */
    try {
      const { sendPushToUser } = await import("./push.server");
      await sendPushToUser(String(pergunta.user_id), {
        title: "Seu médico respondeu",
        /* NEUTRO, como os outros dois pushes deste arquivo. Este mandava o
           TEXTO CRU da pergunta dela — e push aparece na tela bloqueada, para
           quem estiver perto do celular. "Sangramento marrom é normal?" na
           tela do aparelho dela, no ônibus, não é notificação: é a vida dela
           exposta. Ela sabe o que perguntou; o que ela precisa saber é que
           chegou resposta. */
        body: "Toque para ler o que ele escreveu.",
        url: "/minha-conta?tab=Consultas&sub=perguntas",
      });
    } catch {
      /* sem push; a resposta está na aba dela */
    }

    // Vira conhecimento da IA. Best-effort: a paciente já foi respondida.
    let treinou = false;
    /* Só treina com a pergunta REESCRITA. O texto cru dela fica em
       `doctor_questions`, que é dela; o que entra no cérebro reutilizável é o
       que o médico escreveu para ser reutilizado. */
    const perguntaParaOCerebro = (data.perguntaGeneralizada ?? "").trim();
    if (data.treinar && perguntaParaOCerebro.length >= 8) {
      try {
        const { data: entry } = await sb
          .from("brain_entries")
          .insert({
            doctor_id: user.id,
            question: perguntaParaOCerebro,
            answer: data.resposta,
            source: "pergunta",
            approved: true,
          })
          .select("id")
          .single();
        if (entry) {
          const { embedBrainEntry } = await import("./embeddings.server");
          await embedBrainEntry(entry.id, perguntaParaOCerebro, data.resposta);
          treinou = true;
        }
      } catch {
        /* sem treino desta vez; a resposta chegou */
      }
    }
    return { ok: true as const, treinou };
  });
