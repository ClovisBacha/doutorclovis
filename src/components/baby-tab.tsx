/**
 * A aba Bebê — a tela que a paciente abre para ver o bebê da semana.
 *
 * MOVIDA de `minha-conta.tsx` sem uma linha do corpo alterada: os cinco blocos
 * são byte a byte os que estavam lá, conferidos por SHA-256. O arquivo tinha
 * 18.637 linhas, e o que ele mais cobra é justamente isto — nenhuma destas
 * telas podia ter bancada, porque exportá-las de um arquivo de ROTA põe o
 * código no pedaço da árvore de rotas, que TODA página do site carrega.
 *
 * ⚠️ É POR ISSO QUE O CORTE VEIO ANTES DO DESENHO. O dono disse que "as
 * informações do bebê não estão cem por cento" — e não havia como fotografar
 * esta tela: ela exige conta, perfil com DUM e médico vinculado. Julgar layout
 * por descrição é exatamente o que a skill `/tela` existe para impedir.
 *
 * ⚠️ E É UM MOVE, E NADA MAIS. Melhorar junto faria a mudança de comportamento
 * se esconder num diff de seiscentas linhas — e o hash deixaria de provar
 * qualquer coisa. O desenho vem depois, num commit que só faça isso.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import drPortrait from "@/assets/dr-clovis-portrait.jpg";
import { BabyIllustration } from "@/components/baby-illustration";
import { CompartilharMomento } from "@/components/compartilhar-momento";
import { HeartbeatFeel } from "@/components/heartbeat-feel";
import { Stagger, StaggerItem } from "@/components/motion-primitives";
import { supabase } from "@/integrations/supabase/client";
import { DOCTOR } from "@/lib/doctor.config";
import {
  babyForWeek,
  consultaForWeek,
  dueDateFromLmp,
  fruitEmojiForWeek,
  retaFinalMensagemFor,
} from "@/lib/gestacao";
import { hapticTap } from "@/lib/haptics";
import { MOOD_LABEL, dayGreeting } from "@/lib/humor-e-saudacao";
import { momentoDe } from "@/lib/momento";
import { guardarMomentoParaPublicar } from "@/lib/momento-para-publicar";
/* ⚠️ `import type` é APAGADO na compilação, então não há ciclo em tempo de
   execução com o arquivo de rota — é o mesmo caminho que `onboarding-ritual`
   já usa para `Profile`. */
import type { Gest, Profile } from "@/routes/_authenticated/minha-conta";

function WeeklyRecapCard({ profile, gest }: { profile: Profile; gest: NonNullable<Gest> }) {
  const [moods, setMoods] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA");
      const { data } = await (supabase as any)
        .from("journal_entries")
        .select("mood, entry_date")
        .gte("entry_date", since)
        .order("entry_date", { ascending: true });
      setMoods(
        ((data ?? []) as { mood: string | null }[]).map((d) => d.mood ?? "").filter(Boolean),
      );
      setLoaded(true);
    })();
  }, []);

  const week = gest.weeks;
  const baby = babyForWeek(week);
  const nextBaby = babyForWeek(week + 1);

  // Humor predominante da semana
  const counts: Record<string, number> = {};
  moods.forEach((m) => (counts[m] = (counts[m] ?? 0) + 1));
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Sua semana em resumo
      </p>

      {/* Humor da semana */}
      <div className="mt-4">
        <p className="text-sm font-semibold text-foreground">Como foi seu humor</p>
        {!loaded ? (
          <div className="skeleton mt-2 h-6 w-40 rounded-full" />
        ) : moods.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Você ainda não registrou seu humor esta semana — o check-in no topo leva 1 toque. 💛
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {moods.map((m, i) => (
                <span key={i} className="text-xl">
                  {m}
                </span>
              ))}
            </div>
            {dominant && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                No geral, você se sentiu{" "}
                <strong>{(MOOD_LABEL[dominant] ?? "bem").toLowerCase()}</strong> nesta semana.
              </p>
            )}
          </>
        )}
      </div>

      {/* Bebê agora */}
      <div className="mt-5 rounded-2xl bg-secondary/50 p-4">
        <p className="text-sm font-semibold text-foreground">
          {profile.baby_name ? profile.baby_name : "Seu bebê"} nesta semana
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{baby.desc}</p>
      </div>

      {/* Próxima semana */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-lg">🔜</span>
        <span className="text-muted-foreground">
          Semana <strong className="text-foreground">{week + 1}</strong> chegando —{" "}
          {profile.baby_name ? "ele" : "seu bebê"} vai ter o tamanho de{" "}
          <strong className="text-foreground">{nextBaby.fruit.toLowerCase()}</strong>.
        </span>
      </div>
    </div>
  );
}

/** Saudação pela hora do dia — deixa a home viva e pessoal. */

const MOOD_CHOICES = [
  { emoji: "😊", label: "Bem", phrase: "Hoje me sinto bem." },
  { emoji: "😌", label: "Tranquila", phrase: "Hoje me sinto tranquila." },
  { emoji: "😴", label: "Cansada", phrase: "Hoje estou cansada." },
  { emoji: "😟", label: "Ansiosa", phrase: "Hoje estou um pouco ansiosa." },
  { emoji: "😢", label: "Pra baixo", phrase: "Hoje não está sendo um bom dia." },
] as const;

/**
 * Check-in de humor de 1 toque na home. Registra o humor do dia no diário
 * (alimenta o cérebro do paciente, que lê só o rótulo do humor). Uma vez por
 * dia (marcador no localStorage) — some depois de responder.
 */
function HomeMoodCheckin({ name }: { name: string }) {
  const today = new Date().toLocaleDateString("en-CA");
  const key = `mood-checkin:${today}`;
  const [done, setDone] = useState(() => {
    try {
      return !!localStorage.getItem(key);
    } catch {
      return false;
    }
  });
  const [saving, setSaving] = useState(false);

  if (done) return null;

  async function pick(m: (typeof MOOD_CHOICES)[number]) {
    hapticTap();
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await (supabase as any).from("journal_entries").insert({
          user_id: u.user.id,
          mood: m.emoji,
          content: m.phrase,
          entry_date: today,
        });
      }
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* modo privado */
      }
      setDone(true);
      toast("Obrigado por compartilhar como você está 💛");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-sm font-semibold text-foreground">
        Como você está se sentindo agora{name ? `, ${name}` : ""}?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {MOOD_CHOICES.map((m) => (
          <button
            key={m.label}
            disabled={saving}
            onClick={() => pick(m)}
            className="press flex min-w-[64px] flex-col items-center gap-1 rounded-2xl border border-border px-3 py-2 transition-colors hover:border-primary disabled:opacity-50"
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-[11px] text-muted-foreground">{m.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Fica só no seu diário e ajuda seu médico a te entender melhor.
      </p>
    </div>
  );
}

/**
 * Presença do médico — a "integração real" sentida. Um selo vivo de que o
 * médico acompanha a gestação e, quando ele registrou o batimento do bebê
 * recentemente, uma "novidade" acolhedora com o coração pulsando.
 *
 * A identidade vem do médico VINCULADO à paciente; o `doctor.config` só entra
 * quando não há vínculo (aí o médico é o dono da instalação, que é quem de
 * fato atende). O sinal do
 * batimento é real (profile.fetal_bpm_at, gravado pelo médico) — nada é
 * inventado: sem batimento recente, mostra só o selo de acompanhamento.
 */
function DoctorPresenceCard({
  profile,
  onNavigate,
  careMode = false,
  medico,
}: {
  profile: Profile | null;
  onNavigate: (tab: string) => void;
  careMode?: boolean;
  /** O médico DA PACIENTE. Sem ele o cartão afirmava, com a foto e o nome do
      dono da instalação, que "Dr. Clóvis ouviu o coração do seu bebê" — para
      quem é paciente de outro profissional e para quem não tem médico. */
  medico?: { nome: string; title?: string; specialty?: string } | null;
}) {
  const bpm = profile?.fetal_bpm ?? null;
  const at = profile?.fetal_bpm_at ?? null;
  const baby = profile?.baby_name ? profile.baby_name : "seu bebê";

  let whenLabel: string | null = null;
  let recent = false;
  if (at) {
    const days = Math.floor((Date.now() - new Date(at + "T00:00:00").getTime()) / 86400000);
    recent = days >= 0 && days <= 30;
    whenLabel = days <= 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`;
  }
  // Em Modo Cuidado nunca mostra a novidade do batimento do bebê (pode ser
  // doloroso); fica só o selo de acompanhamento, que é acolhedor.
  const showBpm = bpm != null && at != null && recent && !careMode;
  /* Quem este cartão nomeia. A foto é do dono da instalação, então só aparece
     quando o médico É ele; para os demais, a inicial do nome.

     Sem vínculo NÃO cai no fundador: o cartão dizia "Dr. Clóvis Bacha está
     acompanhando sua gestação" com a foto dele para quem não escolheu médico
     nenhum. Agora vira um convite para escolher. */
  const nomeMedico = medico?.nome?.trim() ?? "";
  const semMedico = !nomeMedico;
  const ehODono = nomeMedico === DOCTOR.name;

  return (
    <button
      onClick={() => onNavigate("Consultas")}
      className="flex w-full items-center gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:border-primary/40"
    >
      <span className="relative shrink-0">
        {ehODono ? (
          <img
            src={drPortrait}
            alt={nomeMedico}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 font-serif text-xl text-primary ring-2 ring-primary/20">
            {nomeMedico.replace(/^(Dr|Dra)\.?\s*/i, "").charAt(0) || "?"}
          </span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground ring-2 ring-card">
          ✓
        </span>
      </span>
      <span className="min-w-0 flex-1">
        {showBpm ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="heartbeat-icon text-rose-500">💓</span>
              {semMedico
                ? `O coração de ${baby} foi ouvido`
                : `${nomeMedico.split(" ").slice(0, 2).join(" ")} ouviu o coração de ${baby}`}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {bpm} bpm · {whenLabel} · toque para sentir o batimento
            </span>
          </>
        ) : (
          <>
            <span className="block text-sm font-semibold text-foreground">
              {/* Sem médico vinculado o cartão renderizava " está acompanhando
                  sua gestação" — frase sem sujeito. Vira um convite. */}
              {semMedico
                ? "Escolha o seu obstetra"
                : `${nomeMedico} está acompanhando sua gestação`}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Você não está sozinha — seu médico acompanha cada semana por aqui. 💛
            </span>
          </>
        )}
      </span>
    </button>
  );
}

export function BabyTab({
  profile,
  medico,
  gest,
  onNavigate,
  onBabyTap,
  careMode = false,
}: {
  profile: Profile | null;
  /** Médico da paciente — o cartão de presença fala em nome dele. */
  medico?: { nome: string; title?: string; specialty?: string } | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
  /** Toque na foto do bebê → Jornada do Bebê (gatilho Premium). */
  onBabyTap?: () => void;
  careMode?: boolean;
}) {
  if (!profile || !gest) {
    return (
      <div className="glass-card glass-pink rounded-3xl p-10 text-center">
        <p className="text-5xl mb-4">🌸</p>
        <p className="font-serif text-xl text-pink-700">Configure seu perfil</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure a data da sua última menstruação ou os dados do ultrassom em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            Perfil
          </button>{" "}
          para começar o acompanhamento.
        </p>
      </div>
    );
  }
  const baby = babyForWeek(gest.weeks);
  const trimestre =
    gest.weeks < 14 ? "1º trimestre" : gest.weeks < 28 ? "2º trimestre" : "3º trimestre";
  const progress = Math.min(100, (gest.totalDays / 280) * 100);
  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  const daysToDue = due
    ? Math.max(0, Math.ceil((new Date(due + "T00:00:00").getTime() - Date.now()) / 86400000))
    : null;
  const exam = consultaForWeek(gest.weeks);
  const babyLabel = profile.baby_name ? profile.baby_name : "seu bebê";
  // Reta final (semanas 40-42+): substitui a contagem regressiva por acolhimento.
  // Usa âncora unificada (idade gestacional + DPP) para nunca sobrar estado sem mensagem.
  const reta = retaFinalMensagemFor({ weeks: gest.weeks, dueDate: due });

  const bpmDefault = profile.fetal_bpm ?? (gest.weeks < 14 ? 160 : gest.weeks < 28 ? 145 : 135);

  return (
    <Stagger className="space-y-6">
      {/* ── Check-in de humor de 1 toque (home viva) ─────────────────── */}
      <StaggerItem>
        <HomeMoodCheckin name={profile.display_name?.split(" ")[0] ?? ""} />
      </StaggerItem>

      {/* ── Hero imersivo: o bebê é o protagonista ─────────────────────── */}
      <StaggerItem className="relative overflow-hidden rounded-3xl border border-border bg-[image:var(--gradient-warm)] p-6 shadow-[var(--shadow-card)] md:p-10">
        {/* brilhos suaves ao fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-14 h-64 w-64 rounded-full bg-rose-200/40 blur-3xl"
        />

        <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr] md:gap-12">
          {/* Bebê grande, flutuando devagar — toque abre a Jornada */}
          <button
            onClick={() => {
              hapticTap();
              onBabyTap?.();
            }}
            aria-label="Ver a jornada do bebê"
            className="float-slow mx-auto transition-transform active:scale-[0.97]"
          >
            <BabyIllustration
              week={gest.weeks}
              tone={profile.baby_skin_tone ?? 0}
              showInfo={false}
              className="h-60 w-60 drop-shadow-[0_18px_44px_rgba(168,90,68,0.22)] md:h-80 md:w-80"
            />
          </button>

          <div className="text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {trimestre} · {babyLabel} esta semana
            </p>
            <h2 className="mt-2 font-serif leading-none">
              <span className="text-6xl md:text-7xl">{gest.weeks}</span>
              <span className="ml-2 text-xl text-muted-foreground md:text-2xl">
                semanas{gest.days > 0 ? ` e ${gest.days}d` : ""}
              </span>
            </h2>

            {/* Chips: tamanho · peso · comparação (silenciados no Modo Cuidado) */}
            {!careMode && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                {[
                  { icon: "📏", label: baby.size },
                  ...(baby.weight !== "—" ? [{ icon: "⚖️", label: baby.weight }] : []),
                  /* ⚠️ O EMOJI VEM DA SEMANA, e estava CRAVADO em "🍓".
                     Ele nunca mudava: a paciente de 28 semanas lia "🍓 Abóbora"
                     e a de 40, "🍓 Abóbora moranga" — o desenho contradizendo a
                     palavra ao lado dele, na pílula principal desta tela.
                     `fruitEmojiForWeek` já estava importada e já era usada no
                     cartão de compartilhar dez linhas abaixo: a função certa
                     existia e só esta pílula não a chamava.
                     ⚠️ E ela recebe `gest.weeks`, a MESMA fonte de `baby`
                     (linha do `babyForWeek` acima) — qualquer segunda fonte
                     aqui é como o desenho volta a discordar da palavra. */
                  { icon: fruitEmojiForWeek(gest.weeks), label: baby.fruit },
                ].map((c) => (
                  <span
                    key={c.label}
                    className="rounded-full border border-primary/15 bg-card/70 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur"
                  >
                    {c.icon} {c.label}
                  </span>
                ))}
              </div>
            )}

            {!careMode && (
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-foreground md:mx-0 md:text-base">
                {baby.desc}
              </p>
            )}

            {/* ⚠️ O MESMO cartão do marco, pela mesma régua — e não uma
                segunda chamada a `shareMilestoneCard`. `momentoDe` devolve
                `null` no Modo Cuidado, então o portão deixou de ser um `if` na
                tela e passou a ser a régua: é a lição de `humorDaJornada`
                aplicada ao compartilhamento. */}
            <div className="mt-4 max-w-xs">
              <CompartilharMomento
                momento={momentoDe({
                  especie: "semana",
                  numero: gest.weeks,
                  rotulo: `${profile.baby_name || "Meu bebê"} do tamanho de ${baby.fruit.toLocaleLowerCase("pt-BR")}`,
                  emoji: fruitEmojiForWeek(gest.weeks),
                  emCuidado: !!careMode,
                })}
                nomeDaMae={profile.display_name?.split(" ")[0] ?? null}
                aoPublicarNaComunidade={(m) => {
                  guardarMomentoParaPublicar(m);
                  onNavigate("Feed");
                }}
                compacto
              />
            </div>

            {/* Progresso da jornada (silenciado no Modo Cuidado) */}
            {!careMode && (
              <div className="mt-5">
                <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Início</span>
                  <span className="text-primary">{progress.toFixed(0)}% da jornada</span>
                  <span>Parto</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-card/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {reta ? (
                  <p className="mt-1.5 text-xs font-medium text-primary">{reta.titulo}</p>
                ) : (
                  daysToDue != null && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {daysToDue === 0
                        ? "É hoje! 🎉"
                        : daysToDue === 1
                          ? "Amanhã! 🎉"
                          : `Faltam ${daysToDue} dias para conhecer ${babyLabel} 💛`}
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* ── Presença do médico (integração real sentida) ─────────────── */}
      <StaggerItem>
        <DoctorPresenceCard
          profile={profile}
          onNavigate={onNavigate}
          careMode={careMode}
          medico={medico}
        />
      </StaggerItem>

      {/* ── Linha de cards: DPP · próxima consulta · exame ─────────────── */}
      <StaggerItem className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">
            DPP — Data provável do parto
          </p>
          <p className="mt-2 font-serif text-2xl">
            {due
              ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
          {/* ⚠️ A CONTAGEM NÃO SE REPETE AQUI. "Faltam 139 dias" aparecia neste
              cartão E na barra da jornada, a duzentos pixels de distância — a
              mesma variável, o mesmo número, duas vezes. Quem fica com ela é a
              BARRA, porque lá a frase tem o nome do bebê e é o desfecho do que a
              barra mede; aqui seria a data de cima repetida noutra unidade.
              A janela do parto FICA: o texto dela diz outra coisa, e é o único
              momento em que este cartão precisa falar além da data. */}
          {careMode ? null : reta ? (
            <p className="mt-1 text-sm text-primary">Você está na janela do parto 💛</p>
          ) : null}
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          {/* ⚠️ O TÍTULO DIZIA "PRÓXIMA CONSULTA" E O TEXTO É UMA REGRA GERAL.
              O cartão prometia o compromisso DELA — que o app tem
              (`getMyAppointments`, o Calendário, os lembretes de 24h e 4h) — e
              entregava o ritmo da fase. Prometer específico e entregar genérico
              é como uma tela perde a credibilidade das outras informações.
              O título passou a dizer o que o texto de fato diz. Ligar a consulta
              real é função nova (uma prop vinda de `minha-conta`), e não um
              conserto de rótulo: fica como decisão, não como remendo. */}
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Ritmo das consultas</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {gest.weeks < 28
              ? "Consultas mensais — agende sua próxima visita."
              : gest.weeks < 36
                ? "Consultas quinzenais a partir de agora."
                : "Consultas semanais — acompanhamento próximo."}
          </p>
        </div>
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Exame desta semana
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{exam}</p>
        </div>
      </StaggerItem>

      {/* ── Sentir o coração: vibra no ritmo do bebê (BPM real se o médico
             registrou na consulta; senão, o típico do trimestre)

             ⚠️ E ELE FICA DENTRO DO MODO CUIDADO. O portão `!careMode` existia
             três linhas ABAIXO, e este bloco estava fora dele: quem acabou de
             perder a gestação abria a aba do Bebê e encontrava "O coração de
             {nome}", com som lub-dub a 140 bpm e vibração no ritmo. É a coisa
             mais dolorosa que este app consegue fazer. ─────────────────── */}
      {!careMode && (
        <StaggerItem>
          <HeartbeatFeel
            defaultBpm={bpmDefault}
            babyName={profile.baby_name}
            sourceNote={
              profile.fetal_bpm
                ? `Ritmo real medido pelo seu médico${
                    profile.fetal_bpm_at
                      ? ` em ${new Date(profile.fetal_bpm_at + "T00:00:00").toLocaleDateString("pt-BR")}`
                      : ""
                  } 💗`
                : undefined
            }
            compact
          />
        </StaggerItem>
      )}

      {!careMode && (
        <StaggerItem>
          <WeeklyRecapCard profile={profile} gest={gest} />
        </StaggerItem>
      )}

      {/* Segunda gestação: historical alerts */}
      {(profile.pregnancy_number ?? 1) >= 2 && (
        <StaggerItem className="col-span-full rounded-3xl border border-primary/25 bg-primary/8 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            🔁 2ª Gestação — Histórico da anterior
          </p>
          <div className="space-y-2 text-sm">
            {profile.prior_bp_elevated && (
              <div className="flex items-start gap-2 rounded-xl bg-card/80 p-3">
                <span className="text-red-500 text-base">⚠️</span>
                <p>
                  Na gestação anterior, você teve <strong>pressão elevada</strong>
                  {profile.prior_bp_week ? ` a partir da semana ${profile.prior_bp_week}` : ""}.
                  {gest.weeks >= (profile.prior_bp_week ?? 28) - 2
                    ? " Estamos nessa janela — monitore sua pressão com mais frequência."
                    : " Vamos monitorar de perto conforme a semana se aproxima."}
                </p>
              </div>
            )}
            {profile.prior_gestational_diabetes && (
              <div className="flex items-start gap-2 rounded-xl bg-card/80 p-3">
                <span className="text-primary text-base">🍬</span>
                <p>
                  Você teve <strong>diabetes gestacional</strong> anteriormente. O risco de
                  recorrência é maior — converse com seu médico sobre o teste de glicemia antecipado
                  (semanas 20–24).
                </p>
              </div>
            )}
            {profile.prior_preterm && (
              <div className="flex items-start gap-2 rounded-xl bg-card/80 p-3">
                <span className="text-primary text-base">👶</span>
                <p>
                  Histórico de <strong>parto prematuro</strong>. Seu médico acompanhará o
                  comprimento cervical com mais frequência nesta gestação.
                </p>
              </div>
            )}
            {profile.prior_cesarean && (
              <div className="flex items-start gap-2 rounded-xl bg-card/80 p-3">
                <span className="text-primary text-base">🏥</span>
                <p>
                  Cesariana anterior registrada. A via de parto desta gestação será planejada em
                  conjunto com o seu médico.
                </p>
              </div>
            )}
            {!profile.prior_bp_elevated &&
              !profile.prior_gestational_diabetes &&
              !profile.prior_preterm &&
              !profile.prior_cesarean && (
                <p className="text-primary">
                  Nenhuma complicação registrada na gestação anterior. Continue preenchendo seu
                  histórico em{" "}
                  <button
                    type="button"
                    onClick={() => onNavigate("Perfil")}
                    className="font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    Perfil → 2ª Gestação
                  </button>
                  .
                </p>
              )}
            {profile.prior_notes && (
              <div className="flex items-start gap-2 rounded-xl bg-card/80 p-3">
                <span className="text-base">📋</span>
                <p>
                  <strong>Observações:</strong> {profile.prior_notes}
                </p>
              </div>
            )}
          </div>
        </StaggerItem>
      )}
    </Stagger>
  );
}
