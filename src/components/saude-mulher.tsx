/**
 * SAÚDE DA MULHER — o ciclo e os preventivos.
 *
 * ⚠️ É a metade da grade da Saúde que **some por nove meses**
 * (`mostrarSaudeDaMulher`), e por isso era a mais difícil de olhar: numa conta
 * de gestante ela não existe, e numa conta sem gestação os preventivos só
 * ficam interessantes depois de meses de registro. Enquanto morava num arquivo
 * de ROTA, importá-la de uma bancada poria o código no pedaço da árvore de
 * rotas que TODA página do site carrega (`rotas-sem-export-solto`).
 *
 * O corpo saiu de `minha-conta.tsx` byte a byte (conferido por SHA-256): um
 * move que também "melhora" é uma reescrita, e a mudança de comportamento se
 * esconde num diff de quatrocentas linhas.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CicloMenstrualTab } from "@/components/ciclo-menstrual-tab";
import { Fade } from "@/components/motion-primitives";
import { NaoConsegueLer } from "@/components/nao-consegui-ler";
import { TabSkeleton } from "@/components/tab-skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  getPreventiveReminders,
  setPreventiveReminder,
  type MenstrualCycle,
  type PreventiveReminder,
} from "@/lib/saudefeminina.functions";

const SAUDE_MULHER_SUBTABS = [
  { key: "ciclo", label: "Ciclo menstrual" },
  { key: "preventivos", label: "Preventivos" },
] as const;

/** Hub "Saúde da mulher": Ciclo Menstrual + Preventivos numa tela só. */
export function SaudeMulherHub({
  weeks,
  initialSub,
  bancada,
}: {
  weeks: number | null;
  /** Abre direto numa sub-tela — é o que a bancada usa para fotografar os
      preventivos sem um toque, e o mesmo mecanismo que os outros hubs têm. */
  initialSub?: (typeof SAUDE_MULHER_SUBTABS)[number]["key"];
  bancada?: {
    cycles?: MenstrualCycle[];
    reminders?: PreventiveReminder[];
    instavel?: boolean;
  };
}) {
  const [sub, setSub] = useState<(typeof SAUDE_MULHER_SUBTABS)[number]["key"]>(
    initialSub ?? "ciclo",
  );
  return (
    <div className="space-y-5">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto">
        {SAUDE_MULHER_SUBTABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              sub === s.key
                ? "bg-primary text-primary-foreground"
                : /* ⚠️ `/60`, e não `/55`: medido, `/55` dá 3,88:1 — abaixo do mínimo de
                     4,5 para um controle ATIVO (desabilitado seria isento; este não é).
                     É o mesmo defeito que os chips de categoria da Loja já
                     tiveram, no mesmo tom, noutro arquivo. E não sobe mais que
                     isso: o chip ESCOLHIDO mede 4,72, e `/65` daria mais
                     contraste ao que ela NÃO escolheu. */
                  "border border-border text-foreground/60 hover:text-foreground/80"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Fade key={sub}>
        {sub === "ciclo" && (
          <CicloMenstrualTab
            gestante={weeks != null}
            bancada={
              bancada && { cycles: bancada.cycles ?? [], instavel: bancada.instavel ?? false }
            }
          />
        )}
        {sub === "preventivos" && (
          <PreventivosTab
            bancada={
              bancada && { reminders: bancada.reminders ?? [], instavel: bancada.instavel ?? false }
            }
          />
        )}
      </Fade>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 40b — Preventivos
───────────────────────────────────────────────────────── */

type ExamDef = {
  key: string;
  name: string;
  emoji: string;
  frequency: string;
  frequencyMonths: number;
  description: string;
};

/* ⚠️ **NÃO EXISTE `ageFrom` AQUI, e a ausência é a decisão.** O campo existia,
   estava preenchido em dois exames (mamografia 40, TSH 35) e era lido em
   LUGAR NENHUM. Três coisas o tornavam pior que inútil:

   1. **Ele nunca poderá ser lido.** O app não conhece a idade da paciente —
      `patient_profiles.birth_date` é a data de nascimento do BEBÊ, do Portal
      Pós-parto. Sem o dado, não há filtro possível.
   2. **Ele SUGERIA uma proteção que não existe.** Quem lê a lista conclui que
      ela se recorta por idade; ela nunca se recortou.
   3. **No TSH ele era a ÚNICA sinalização de faixa etária** — o texto que a
      paciente lê não diz nada sobre 35 anos. A informação existia só num campo
      que ninguém consultava, o que é o mesmo que não existir.

   ⚠️ E o conserto NÃO foi mover "a partir dos 35" para o texto: isso seria
   afirmar uma faixa clínica com base num número que ninguém verificou. A
   mamografia continua dizendo a idade no rótulo e na descrição, que é onde a
   paciente lê; o TSH continua sem afirmar faixa nenhuma. Se um dia a idade da
   paciente existir no perfil, o filtro nasce com ela — e com a régua clínica
   revisada, não com este número herdado. */

const PREVENTIVE_EXAMS: ExamDef[] = [
  {
    key: "papanicolau",
    name: "Papanicolau",
    emoji: "🔬",
    frequency: "Anual",
    frequencyMonths: 12,
    description:
      "Rastreamento do câncer de colo do útero. Após 2 exames normais seguidos, pode ser feito a cada 3 anos.",
  },
  {
    key: "mamografia",
    name: "Mamografia",
    emoji: "🩻",
    frequency: "Anual (40+)",
    frequencyMonths: 12,
    description:
      "Rastreamento do câncer de mama. A partir de 40 anos ou 35 anos em caso de histórico familiar.",
  },
  {
    key: "ultrassom_tv",
    name: "Ultrassom Pélvico",
    emoji: "📡",
    frequency: "Anual",
    frequencyMonths: 12,
    description:
      "Avaliação dos ovários, útero e endométrio. Detecta cistos, miomas e outras alterações.",
  },
  {
    key: "glicemia",
    name: "Glicemia em Jejum",
    emoji: "🩸",
    frequency: "Anual",
    frequencyMonths: 12,
    description: "Rastreamento de diabetes e pré-diabetes.",
  },
  {
    key: "colesterol",
    name: "Perfil Lipídico",
    emoji: "💉",
    frequency: "A cada 5 anos",
    frequencyMonths: 60,
    description: "Colesterol total, HDL, LDL e triglicérides. Risco cardiovascular.",
  },
  {
    key: "tsh",
    name: "TSH / T4 Livre",
    emoji: "🦋",
    frequency: "A cada 2 anos",
    frequencyMonths: 24,
    description: "Função da tireoide. Importante para mulheres em idade fértil.",
  },
  {
    key: "pressao_arterial",
    name: "Pressão Arterial",
    emoji: "💊",
    frequency: "Semestral",
    frequencyMonths: 6,
    description:
      "Controle da pressão arterial. Hipertensão é silenciosa — medir regularmente é fundamental.",
  },
  {
    key: "dentista",
    name: "Dentista",
    emoji: "🦷",
    frequency: "Semestral",
    frequencyMonths: 6,
    description:
      "Saúde bucal com impacto direto na saúde geral. Cáries e inflamações gengivas elevam risco sistêmico.",
  },
  {
    key: "dermatologista",
    name: "Mapeamento de Pintas",
    emoji: "☀️",
    frequency: "Anual",
    frequencyMonths: 12,
    description: "Dermatoscopia para rastreamento do melanoma e outros cânceres de pele.",
  },
  {
    key: "oftalmologista",
    name: "Oftalmologista",
    emoji: "👁️",
    frequency: "A cada 2 anos",
    frequencyMonths: 24,
    description: "Avaliação da visão, pressão intraocular e saúde ocular.",
  },
];

function nextDueDate(lastDone: string | null, frequencyMonths: number): Date | null {
  if (!lastDone) return null;
  const d = new Date(lastDone + "T00:00:00");
  d.setMonth(d.getMonth() + frequencyMonths);
  return d;
}

export function PreventivosTab({
  bancada,
}: {
  bancada?: { reminders?: PreventiveReminder[]; instavel?: boolean };
}) {
  const [reminders, setReminders] = useState<PreventiveReminder[]>(bancada?.reminders ?? []);
  const [loading, setLoading] = useState(!bancada);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  /** A leitura FALHOU — não é o mesmo que ela nunca ter registrado exame. */
  const [instavel, setInstavel] = useState(bancada?.instavel ?? false);
  /* ⚠️ BOOLEANO, e não o objeto: literal remontado a cada render faria o
     efeito re-rodar em toda pintura. */
  const ehBancada = bancada != null;

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await getPreventiveReminders({ data: { accessToken: s.session.access_token } });
    /* ⚠️ O `res.ok` já era conferido — o que faltava era o servidor DIZER a
       verdade: ele devolvia `ok: true` sobre uma leitura que falhou. Agora que
       ele distingue, a tela precisa distinguir também: com a lista vazia por
       falha, todo exame cai em "nunca registrado" e o contador de atraso
       zera. */
    if (res.ok) {
      setInstavel(false);
      setReminders(res.reminders);
    } else setInstavel(true);
    setLoading(false);
  }

  useEffect(() => {
    if (ehBancada) return;
    load();
  }, [ehBancada]);

  async function handleSave() {
    if (!editingKey) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setSaving(false);
      return;
    }
    /* ⚠️ O RETORNO ERA DESCARTADO, e ele chega numa resposta 200 NORMAL —
       nenhum `try/catch` pegaria. O painel fechava, a lista recarregava sem a
       data que ela acabou de digitar, e a leitura razoável é que ela errou o
       campo. Numa tela de preventivos, isso vira um exame que ela acha que
       registrou e o app não conhece. */
    const r = await setPreventiveReminder({
      data: {
        accessToken: s.session.access_token,
        examKey: editingKey,
        lastDoneDate: editDate || null,
        notes: editNotes || null,
      },
    });
    setSaving(false);
    if (!r.ok) {
      /* Fica ABERTO com o que ela digitou: fechar perderia o texto. */
      toast.error("Não consegui salvar agora. Confira a conexão e toque em salvar de novo.");
      return;
    }
    setEditingKey(null);
    await load();
  }

  if (loading) return <TabSkeleton />;

  /* ⚠️ A falha vem ANTES de qualquer contagem. Com a lista vazia por erro, os
     três números do topo mentem juntos: "Em atraso: 0" é o mais perigoso,
     porque é exatamente o que ela veio conferir. */
  if (instavel)
    return (
      <NaoConsegueLer
        oQue="os seus preventivos"
        sossego="As datas que você registrou continuam salvas."
        aoTentar={() => void load()}
      />
    );

  const reminderMap = Object.fromEntries(reminders.map((r) => [r.exam_key, r]));
  const today = new Date();

  // Group: overdue, due soon (within 60 days), ok
  const examGroups = PREVENTIVE_EXAMS.map((exam) => {
    const r = reminderMap[exam.key];
    const nextDue = r?.last_done_date ? nextDueDate(r.last_done_date, exam.frequencyMonths) : null;
    const daysUntil = nextDue ? Math.round((nextDue.getTime() - today.getTime()) / 86400000) : null;
    let status: "overdue" | "soon" | "ok" | "never" = "never";
    if (r?.last_done_date) {
      if (daysUntil !== null) {
        if (daysUntil < 0) status = "overdue";
        else if (daysUntil <= 60) status = "soon";
        else status = "ok";
      }
    }
    return { exam, r, nextDue, daysUntil, status };
  });

  const overdueCount = examGroups.filter((e) => e.status === "overdue").length;
  const soonCount = examGroups.filter((e) => e.status === "soon").length;
  const neverCount = examGroups.filter((e) => e.status === "never").length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Em atraso",
            value: overdueCount,
            /* ⚠️ `-700`: `red-600` sobre `red-50` mede 4,36:1, abaixo do mínimo
               para 13px. É a mesma decisão da varredura de botões — escurecer o
               tom, mantendo a cor que codifica o estado. */
            color: "text-red-700 bg-red-50 border-red-200",
          },
          {
            label: "Em breve",
            value: soonCount,
            /* ⚠️ ÂMBAR, e não o rosa da marca. Duas razões, e a segunda é a
               que decide: `text-primary` sobre `bg-primary/6` mede 4,21:1 a
               13px — abaixo do mínimo —, e escurecer não é possível sem mexer
               no tom da marca inteira. E o rosa não CODIFICA urgência: os três
               contadores viram vermelho / rosa / cinza, onde o do meio deveria
               dizer "atenção". Vermelho = venceu · âmbar = está chegando ·
               cinza = nunca registrado. */
            color: "text-amber-700 bg-amber-50 border-amber-200",
          },
          {
            label: "Não registrado",
            value: neverCount,
            color: "text-muted-foreground bg-secondary border-border",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Exam list */}
      <div className="space-y-3">
        {examGroups.map(({ exam, r, nextDue, daysUntil, status }) => {
          const isEditing = editingKey === exam.key;
          const statusColor =
            status === "overdue"
              ? "border-red-200 bg-red-50"
              : status === "soon"
                ? "border-primary/20 bg-primary/6"
                : status === "ok"
                  ? "border-green-200 bg-green-50"
                  : "border-border bg-card";
          const statusEmoji =
            status === "overdue" ? "⚠️" : status === "soon" ? "🔔" : status === "ok" ? "✅" : "📋";

          return (
            <div key={exam.key} className={`rounded-2xl border p-4 ${statusColor}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xl shrink-0 mt-0.5">{exam.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{exam.name}</p>
                      <span className="text-sm">{statusEmoji}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{exam.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Frequência recomendada: {exam.frequency}
                    </p>
                    {r?.last_done_date && (
                      <p className="text-xs mt-1">
                        Último:{" "}
                        {new Date(r.last_done_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {nextDue && ` · Próximo: ${nextDue.toLocaleDateString("pt-BR")} `}
                        {daysUntil !== null && (
                          <span
                            className={
                              /* ⚠️ `-700` nos três: medido a 13px, `red-600`
                                 dá 4,36:1 e `green-600` fica pior ainda —
                                 abaixo do mínimo de 4,5. E é justamente aqui
                                 que mora "(396 dias em atraso)", a frase que
                                 diz que um rastreamento venceu. */
                              daysUntil < 0
                                ? "text-red-700 font-medium"
                                : daysUntil <= 60
                                  ? "text-primary font-medium"
                                  : "text-green-700"
                            }
                          >
                            {daysUntil < 0
                              ? `(${Math.abs(daysUntil)} dias em atraso)`
                              : daysUntil === 0
                                ? "(hoje)"
                                : `(em ${daysUntil} dias)`}
                          </span>
                        )}
                      </p>
                    )}
                    {r?.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.notes}"</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingKey(isEditing ? null : exam.key);
                    setEditDate(r?.last_done_date ?? "");
                    setEditNotes(r?.notes ?? "");
                  }}
                  className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                >
                  {isEditing ? "Fechar" : r?.last_done_date ? "Atualizar" : "Registrar"}
                </button>
              </div>
              {isEditing && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Data do último exame</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Observações</label>
                      <input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Resultado, local, médico…"
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {saving ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ⚠️ **A ATRIBUIÇÃO NOMINAL SAIU.** O texto dizia "Frequências baseadas
          nas diretrizes da FEBRASGO e CFM" — uma afirmação de PROCEDÊNCIA, sem
          diretriz nomeada e sem ano, num app médico. É a mesma classe do
          "Coração do bebê — o batimento dele, do doppler", que era um
          oscilador: numa base de alto risco, uma afirmação que a paciente não
          pode conferir ensina que este app afirma coisas sem evidência, e a
          próxima afirmação que ela vai desacreditar é a que importa.
          O que ficou é verdadeiro: são frequências de REFERÊNCIA, e quem
          define a dela é o médico dela. Para a atribuição voltar ela precisa
          da diretriz e do ano — como o painel do médico já faz
          ("protocolos FEBRASGO/SBD/SBH 2022–2024"). */}
      <p className="text-xs text-center text-muted-foreground pb-4">
        Estas são frequências de referência para rastreamento na mulher adulta. Quem define as suas
        é o seu médico.
      </p>
    </div>
  );
}
