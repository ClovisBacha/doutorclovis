import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCompanionView, type CompanionView as Profile } from "@/lib/companion.functions";
import { ConviteDoApp } from "@/components/convite-do-app";
import {
  babyForWeek,
  computeGestation,
  dueDateFromLmp,
  retaFinalMensagemFor,
  trimesterForWeek,
} from "@/lib/gestacao";
import { getRecentPanicByToken } from "@/lib/escola.functions";
import { HeartbeatFeel } from "@/components/heartbeat-feel";

export const Route = createFileRoute("/acompanhar/$token")({
  head: () => ({ meta: [{ title: "Painel do Papai — Obstétrica" }] }),
  /**
   * ⚠️ **`?bancada=luto` existe porque esta tela era IMPOSSÍVEL DE OLHAR.**
   *
   * Ela nasce de um token de convite: para conferir qualquer coisa aqui era
   * preciso uma conta de gestante, um convite gerado e o link na mão — e para
   * conferir o Modo Cuidado, ligar o luto numa conta de verdade. Foi por isso
   * que o portão de luto ficou meses cobrindo só o batimento enquanto três
   * abas de gestação continuavam abertas.
   *
   * `q.bancada == null` e não `=== undefined`: o router serializa e revalida,
   * e na segunda passada chega `null` — a armadilha que `preview-saude` e
   * `preview-jogo` já documentam.
   */
  validateSearch: (q: Record<string, unknown>) => ({
    bancada: q.bancada == null ? "" : String(q.bancada),
  }),
  component: CompanionView,
});

const SUPPORT_TIPS: Record<
  1 | 2 | 3,
  { tasks: string[]; emotional: string[]; physical: string[] }
> = {
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
  /** O código dela, para o rodapé de convite. `null` em Modo Cuidado. */
  const [codigoDeConvite, setCodigoDeConvite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PapaiTab>("bebe");
  const { bancada } = Route.useSearch();
  const [panicEvent, setPanicEvent] = useState<{
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (bancada) {
          /* A bancada injeta o DADO nos MESMOS `useState` da produção, nunca o
             desenho — é a lição do `?streak=41` da folha da chama. */
          setProfile({
            display_name: "Marina Costa",
            baby_name: "Helena",
            lmp_date: "2026-02-10",
            due_date: null,
            reference_date: null,
            reference_weeks: null,
            reference_days: null,
            fetal_bpm: 146,
            fetal_bpm_at: "2026-08-01",
            care_mode: bancada === "luto",
          } as Profile);
          if (bancada === "sos") {
            setPanicEvent({
              created_at: "2026-08-28T02:14:00.000Z",
              lat: -23.5613,
              lng: -46.6565,
            } as any);
          }
          setLoading(false);
          return;
        }
        const res = await getCompanionView({ data: { token } });
        if (!res.ok) {
          setErr(
            res.reason === "expired"
              ? "Este convite expirou. Peça um novo link à gestante."
              : "Convite inválido.",
          );
          return;
        }
        setProfile(res.profile);
        setCodigoDeConvite(res.codigoDeConvite ?? null);
      } catch {
        // Falha de rede: sem isso a tela ficava em "Carregando…" p/ sempre.
        setErr("Não foi possível carregar. Verifique a conexão e recarregue.");
        return;
      } finally {
        setLoading(false);
      }
      // Alerta de pânico é secundário: falha dele não derruba o painel.
      try {
        const panicRes = await getRecentPanicByToken({ data: { token } });
        if (panicRes.ok && panicRes.event) setPanicEvent(panicRes.event as any);
      } catch {
        /* sem alerta */
      }
    })();
  }, [token]);

  if (loading)
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center text-muted-foreground">
        Carregando…
      </div>
    );
  if (err || !profile)
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center text-muted-foreground">
        {err ?? "Não encontrado."}
      </div>
    );

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
  const daysLeft = dueDate
    ? Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000))
    : null;
  // Reta final (40s+): evita "0 dias para a DPP" perpétuo também pro acompanhante.
  const reta = gest ? retaFinalMensagemFor({ weeks: gest.weeks, dueDate: due }) : null;

  /**
   * ⚠️ **NO MODO CUIDADO SOBRAM AS DUAS ABAS QUE CUIDAM DELA.**
   *
   * O portão anterior cobria só o batimento, com o comentário certo ("ele
   * ouviria o coração de um bebê que não existe mais") e alcance curto: a aba
   * "Bebê" continuava mostrando o TAMANHO e a descrição da semana, e a aba
   * "Para o parto" continuava ensinando o que fazer no dia do parto — para o
   * marido de uma mulher que acabou de perder a gestação, com ela sem estar do
   * lado para explicar.
   *
   * "Apoiar mamãe" e "Tarefas" FICAM, e é a mesma razão que o comentário do
   * batimento já dava: este painel é a rede de apoio dela, e é por aqui que
   * entra o contato de emergência. Tirar tudo isolaria as duas pessoas no pior
   * momento — a diferença é entre parar de falar do bebê e apagar o socorro.
   */
  /**
   * ⚠️ **NO MODO CUIDADO NÃO SOBRA ABA NENHUMA — e isso não é exagero.**
   *
   * O portão anterior cobria só o batimento, com o comentário certo ("ele
   * ouviria o coração de um bebê que não existe mais") e alcance curto. Lendo
   * as outras três: a aba "Bebê" mostra TAMANHO e descrição da semana; "Para o
   * parto" ensina o que fazer no dia do parto; e as dicas de "Apoiar mamãe" e
   * "Tarefas" são todas de gestação — "acompanhe às consultas do pré-natal",
   * "prepare lanches leves para combater o enjoo matinal".
   *
   * Nenhuma delas serve para o marido de uma mulher que acabou de perder a
   * gestação, com ela sem estar do lado para explicar.
   *
   * ⚠️ **O QUE FICA É A EMERGÊNCIA**, e ela já vive FORA das abas: o alerta de
   * SOS com localização e o botão do SAMU são desenhados antes delas. Era a
   * razão que o comentário do batimento dava para manter o resto — e ela vale
   * inteira sem uma única aba de gestação.
   */
  const TABS: { id: PapaiTab; label: string }[] = profile.care_mode
    ? []
    : [
        { id: "bebe", label: "Bebê" },
        { id: "apoiar", label: "Apoiar mamãe" },
        { id: "tarefas", label: "Tarefas" },
        { id: "parto", label: "Para o parto" },
      ];

  return (
    <section className="mx-auto max-w-2xl px-5 py-10">
      {panicEvent && (
        <div className="mb-6 rounded-2xl border-2 border-red-500 bg-red-50 p-5 animate-pulse">
          <p className="text-lg font-bold text-red-700">🚨 ALERTA DE EMERGÊNCIA</p>
          <p className="text-sm text-red-700 mt-1">
            {profile.display_name ?? "A gestante"} acionou o botão de pânico às{" "}
            {new Date(panicEvent.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {panicEvent.address && (
            <p className="text-xs text-red-600 mt-1">📍 {panicEvent.address}</p>
          )}
          {panicEvent.latitude && panicEvent.longitude && (
            <a
              href={`https://www.google.com/maps?q=${panicEvent.latitude},${panicEvent.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white"
            >
              Ver localização no mapa →
            </a>
          )}
          <div className="mt-3 flex gap-2">
            <a
              href="tel:192"
              className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-semibold text-white"
            >
              📞 SAMU 192
            </a>
            <button
              onClick={() => setPanicEvent(null)}
              className="rounded-full bg-secondary px-4 py-1.5 text-xs text-muted-foreground"
            >
              Dispensar
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <p className="font-serif text-[15px] font-semibold text-primary">Painel do Papai</p>
      {/* ⚠️ **O CABEÇALHO TAMBÉM É CONTEÚDO DE GESTAÇÃO.** No luto ele dizia
          "Helena de Marina Costa" e, na linha de baixo, "Semana 28 e 3 dias ·
          81 dias para a DPP" — o nome do bebê e a contagem regressiva para um
          parto que não vai acontecer, no topo da tela, para quem abrir o link.
          Foi a BANCADA que mostrou isto: eu tinha gateado as quatro abas e
          deixado o título em pé. */}
      <h1 className="mt-2 font-serif text-3xl">
        {profile.care_mode ? (
          <span className="text-primary">{profile.display_name ?? "—"}</span>
        ) : (
          <>
            {profile.baby_name ? `${profile.baby_name} de` : "Bebê de"}{" "}
            <span className="text-primary">{profile.display_name ?? "—"}</span>
          </>
        )}
      </h1>
      {gest && !profile.care_mode && (
        <p className="mt-1 text-muted-foreground">
          Semana <strong className="text-foreground">{gest.weeks}</strong>
          {gest.days > 0 && ` e ${gest.days} dias`}
          {reta ? (
            <>
              {" "}
              · <strong className="text-foreground">{reta.eyebrow}</strong>
            </>
          ) : (
            daysLeft !== null && (
              <>
                {" "}
                · <strong className="text-foreground">{daysLeft} dias</strong> para a DPP
              </>
            )
          )}
        </p>
      )}

      {/**
       * ⚠️ **O TEXTO NÃO CONTA O QUE ACONTECEU, e essa é a decisão difícil.**
       *
       * O Modo Cuidado pode ser ligado pelo MÉDICO, e quem tem este link pode
       * não saber de nada. Um painel que diz "ela perdeu a gestação" seria o
       * app dando, por ela, a notícia mais íntima que existe — para quem quer
       * que esteja com o celular na mão.
       *
       * Então ele diz o FATO sobre o próprio painel e para aí: as informações
       * da gestação estão pausadas. Sem motivo, sem emoji de luto, sem
       * conselho — e sem "está tudo bem", que é a frase que o repositório
       * proíbe em todo texto sensível.
       */}
      {profile.care_mode && (
        <div className="mt-6 card-material rounded-3xl p-5 text-sm leading-relaxed text-muted-foreground">
          As informações da gestação estão pausadas neste link.
          <br />
          Os avisos de emergência continuam chegando aqui normalmente.
        </div>
      )}

      {/* Tabs */}
      {TABS.length > 0 && (
        <div className="mt-6 flex gap-1 rounded-2xl border border-border bg-secondary/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 rounded-xl py-2 text-xs font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        {/* Tab: Bebê */}
        {/* ⚠️ O portão é repetido no CORPO, e não só na fita de abas: a aba
            inicial é `"bebe"` no `useState`, então sem esta condição o painel
            ABRIRIA na aba do bebê mesmo com ela fora da fita. */}
        {activeTab === "bebe" && !profile.care_mode && gest && baby && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-serif text-[15px] font-semibold text-primary">Esta semana</p>
                  <p className="mt-1 font-serif text-4xl">
                    {gest.weeks}
                    <span className="ml-1 text-xl text-muted-foreground">sem</span>
                  </p>
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

            {/* Sentir o coração: se o médico registrou o BPM real da consulta,
                vibra no ritmo EXATO do bebê; senão, usa o típico da semana
                gestacional (1º tri ~160, 2º ~145, 3º ~135).

                ⚠️ E ELE SOME NO MODO CUIDADO DELA. Sem este portão, o marido ou
                a mãe abria o link e OUVIA o batimento de um bebê que não existe
                mais — com ela sem estar do lado para explicar. O resto do painel
                fica: ele é a rede de apoio dela, e o contato de emergência entra
                por aqui. */}
            {!profile.care_mode && (
              <HeartbeatFeel
                defaultBpm={
                  profile.fetal_bpm ?? (trimester === 1 ? 160 : trimester === 2 ? 145 : 135)
                }
                babyName={profile.baby_name}
                sourceNote={
                  profile.fetal_bpm
                    ? `Ritmo real medido pelo médico${
                        profile.fetal_bpm_at
                          ? ` em ${new Date(profile.fetal_bpm_at + "T00:00:00").toLocaleDateString("pt-BR")}`
                          : ""
                      } 💗`
                    : undefined
                }
                compact
              />
            )}

            {due && (
              <div className="card-material rounded-2xl p-4 text-sm">
                <p className="text-muted-foreground">Data Provável do Parto</p>
                <p className="mt-1 font-serif text-xl">
                  {new Date(due + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                {reta ? (
                  <p className="mt-1 text-xs text-primary font-medium">{reta.titulo}</p>
                ) : (
                  daysLeft !== null && (
                    <p className="mt-1 text-xs text-primary font-medium">
                      Faltam {daysLeft} dias 🎉
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Apoiar mamãe */}
        {activeTab === "apoiar" && !profile.care_mode && (
          <div className="space-y-4">
            <div className="card-material rounded-3xl p-5">
              <p className="font-serif text-lg">Apoio emocional</p>
              <ul className="mt-3 space-y-2">
                {tips.emotional.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary">💛</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-material rounded-3xl p-5">
              <p className="font-serif text-lg">Suporte físico</p>
              <ul className="mt-3 space-y-2">
                {tips.physical.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary">🤝</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tab: Tarefas */}
        {activeTab === "tarefas" && !profile.care_mode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tarefas práticas recomendadas para o {trimester}º trimestre.
            </p>
            <div className="space-y-2">
              {tips.tasks.map((task, i) => (
                <TaskItem key={i} label={task} />
              ))}
            </div>
          </div>
        )}

        {/* Tab: Para o parto */}
        {activeTab === "parto" && !profile.care_mode && (
          <div className="space-y-4">
            <div className="card-material rounded-3xl p-5">
              <p className="font-serif text-lg">No dia do parto</p>
              <ul className="mt-3 space-y-3">
                {PARTO_TIPS.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
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

      {/* ⚠️ DEPOIS de tudo, no pé — ver `convite-do-app.ts`. Este painel é a
          ferramenta de quem cuida dela, e o convite é uma linha discreta no
          fim, nunca um bloco no meio do que ele veio ler. */}
      <div className="mx-auto max-w-md px-1">
        <ConviteDoApp onde="acompanhante" codigo={codigoDeConvite} />
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Acompanhamento médico · Obstetrícia e Alto Risco
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
        done
          ? "border-emerald-200 bg-emerald-50 text-muted-foreground line-through"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${done ? "border-emerald-500 bg-emerald-700 text-white" : "border-muted-foreground"}`}
      >
        {done && "✓"}
      </span>
      {label}
    </button>
  );
}
