import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCompanionView, type CompanionView as Profile } from "@/lib/companion.functions";
import { babyForWeek, computeGestation, dueDateFromLmp, trimesterForWeek } from "@/lib/gestacao";

export const Route = createFileRoute("/acompanhar/$token")({
  head: () => ({ meta: [{ title: "Painel do Papai — Dr. Clóvis Bacha" }] }),
  component: CompanionView,
});

const SUPPORT_TIPS: Record<1 | 2 | 3, { tasks: string[]; emotional: string[]; physical: string[] }> = {
  1: {
    tasks: [
      "Acompanhe às consultas do pré-natal e ao primeiro ultrassom",
      "Assuma tarefas com cheiros fortes (lixo, cozinha, pets)",
      "Pesquise juntos sobre gestação — leia o que ela lê",
      "Prepare lanches leves para combater o enjoo matinal",
      "Organize uma pasta com documentos para as consultas",
    ],
    emotional: [
      "Ela pode estar exausta mesmo sem parecer — valide o cansaço",
      "Pergunte como ela está todos os dias, de verdade",
      "Evite dar opiniões não pedidas sobre o que ela come ou faz",
      "Comemore cada marco com ela — mesmo os pequenos",
    ],
    physical: [
      "Assuma as tarefas que exigem esforço físico",
      "Garanta que ela não fique em pé por muito tempo seguido",
      "Deixe o quarto mais arejado se ela estiver com enjoo",
      "Garanta que ela tenha água sempre por perto",
    ],
  },
  2: {
    tasks: [
      "Acompanhe o ultrassom morfológico — você vai ver o bebê em detalhes",
      "Comecem a escolher o nome juntos (use a votação de nomes!)",
      "Planeje e comece a preparar o quarto do bebê",
      "Façam o curso de gestantes juntos — ele é para você também",
      "Monte a lista do enxoval e ajude a organizar as compras",
    ],
    emotional: [
      "Ela está sentindo o bebê mexer — pergunte como foi cada vez",
      "Coloque a mão na barriga sempre que ela convidar",
      "Ouça histórias do bebê com genuíno interesse",
      "Esse trimestre costuma ser mais leve — aproveitem juntos",
    ],
    physical: [
      "Ajude com massagem nas costas e nos pés ao final do dia",
      "Incentive caminhadas leves juntos (30 min, ritmo suave)",
      "Observe se o tornozelo ou os pés dela estão inchando",
      "Se ela estiver com câimbras à noite, massageie a panturrilha",
    ],
  },
  3: {
    tasks: [
      "Treine o trajeto para a maternidade em diferentes horários",
      "Mantenha o carro com o tanque sempre acima da metade",
      "Prepare a mala da maternidade juntos até a semana 36",
      "Leia sobre o trabalho de parto para entender o que esperar",
      "Defina um plano B para chegar à maternidade se necessário",
    ],
    emotional: [
      "Ela pode estar ansiosa — isso é normal e precisa de acolhimento",
      "Valide os medos dela sem minimizá-los ('vai passar' não ajuda)",
      "Reforce que você estará lá, presente, no parto",
      "Peça para ela te dizer o que ela precisa de você no parto",
    ],
    physical: [
      "Aprenda técnicas de massagem lombar para as contrações",
      "Mantenha lanches saudáveis disponíveis a qualquer hora",
      "Ajude a ajustar os travesseiros para ela dormir de lado",
      "Observe sinais de trabalho de parto e saiba quando ir à maternidade",
    ],
  },
};

const PARTO_TIPS = [
  "Cronometre as contrações: app ou relógio — início, duração, intervalo",
  "Leve a mala e os documentos quando saírem de casa",
  "No parto, frases curtas: 'Você consegue. Estou aqui. Respira comigo.'",
  "Ofereça água, gelo e massagem lombar entre as contrações",
  "Mantenha o celular carregado e câmera pronta para o primeiro contato",
  "Peça informações à equipe se tiver dúvidas — você tem esse direito",
];

type PapaiTab = "bebe" | "apoiar" | "tarefas" | "parto";

function CompanionView() {
  const { token } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PapaiTab>("bebe");

  useEffect(() => {
    (async () => {
      const res = await getCompanionView({ data: { token } });
      if (!res.ok) {
        setErr(
          res.reason === "expired"
            ? "Este convite expirou. Peça um novo link à gestante."
            : "Convite inválido.",
        );
        setLoading(false);
        return;
      }
      setProfile(res.profile);
      setLoading(false);
    })();
  }, [token]);

  if (loading)
    return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-muted-foreground">Carregando...</div>;
  if (err || !profile)
    return <div className="mx-auto max-w-2xl px-5 py-20 text-center text-muted-foreground">{err ?? "Não encontrado."}</div>;

  const gest = computeGestation({
    lmp: profile.lmp_date,
    referenceDate: profile.reference_date,
    referenceWeeks: profile.reference_weeks,
    referenceDays: profile.reference_days,
  });
  const baby = gest ? babyForWeek(gest.weeks) : null;
  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  const trimester = gest ? trimesterForWeek(gest.weeks) : 2;
  const tips = SUPPORT_TIPS[trimester as 1 | 2 | 3];

  const dueDate = due ? new Date(due + "T00:00:00") : null;
  const today = new Date();
  const daysLeft = dueDate ? Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000)) : null;

  const TABS: { id: PapaiTab; label: string }[] = [
    { id: "bebe", label: "Bebê" },
    { id: "apoiar", label: "Apoiar mamãe" },
    { id: "tarefas", label: "Tarefas" },
    { id: "parto", label: "Para o parto" },
  ];

  return (
    <section className="mx-auto max-w-2xl px-5 py-10">
      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Painel do Papai</p>
      <h1 className="mt-2 font-serif text-3xl">
        {profile.baby_name ? `${profile.baby_name} de` : "Bebê de"}{" "}
        <span className="text-primary">{profile.display_name ?? "—"}</span>
      </h1>
      {gest && (
        <p className="mt-1 text-muted-foreground">
          Semana <strong className="text-foreground">{gest.weeks}</strong>
          {gest.days > 0 && ` e ${gest.days} dias`}
          {daysLeft !== null && (
            <> · <strong className="text-foreground">{daysLeft} dias</strong> para a DPP</>
          )}
        </p>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-2xl border border-border bg-secondary/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-xl py-2 text-xs font-medium transition-colors ${
              activeTab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {/* Tab: Bebê */}
        {activeTab === "bebe" && gest && baby && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-primary">Esta semana</p>
                  <p className="mt-1 font-serif text-4xl">{gest.weeks}<span className="ml-1 text-xl text-muted-foreground">sem</span></p>
                </div>
                <div className="text-5xl">{baby.fruit}</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-background/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Tamanho</p>
                  <p className="font-medium">{baby.size}</p>
                </div>
                <div className="rounded-xl bg-background/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Peso aprox.</p>
                  <p className="font-medium">{baby.weight}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{baby.desc}</p>
            </div>
            {due && (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="text-muted-foreground">Data Provável do Parto</p>
                <p className="mt-1 font-serif text-xl">
                  {new Date(due + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                {daysLeft !== null && (
                  <p className="mt-1 text-xs text-primary font-medium">Faltam {daysLeft} dias 🎉</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Apoiar mamãe */}
        {activeTab === "apoiar" && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="font-serif text-lg">Apoio emocional</p>
              <ul className="mt-3 space-y-2">
                {tips.emotional.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary">💛</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="font-serif text-lg">Suporte físico</p>
              <ul className="mt-3 space-y-2">
                {tips.physical.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary">🤝</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tab: Tarefas */}
        {activeTab === "tarefas" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Tarefas práticas recomendadas para o {trimester}º trimestre.</p>
            <div className="space-y-2">
              {tips.tasks.map((task, i) => (
                <TaskItem key={i} label={task} />
              ))}
            </div>
          </div>
        )}

        {/* Tab: Para o parto */}
        {activeTab === "parto" && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="font-serif text-lg">No dia do parto</p>
              <ul className="mt-3 space-y-3">
                {PARTO_TIPS.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm">
              <p className="font-semibold text-rose-700">🚨 Quando ir para a maternidade</p>
              <ul className="mt-2 space-y-1 text-rose-600">
                <li>• Contrações a cada 5 min, por 1 min, por 1 hora (regra 5-1-1)</li>
                <li>• Bolsa rompeu (mesmo sem contrações)</li>
                <li>• Sangramento intenso ou dor aguda</li>
                <li>• Bebê sem movimentos por mais de 2 horas</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Acompanhamento médico com Dr. Clóvis Bacha · Obstetrícia e Alto Risco
      </p>
    </section>
  );
}

function TaskItem({ label }: { label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => setDone((v) => !v)}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm transition-all ${
        done ? "border-emerald-200 bg-emerald-50 text-muted-foreground line-through" : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground"}`}>
        {done && "✓"}
      </span>
      {label}
    </button>
  );
}
