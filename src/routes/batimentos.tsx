import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart, Pause, Play } from "lucide-react";
import { AppCtaBanner } from "@/components/app-cta-banner";
import { HeartbeatFeel } from "@/components/heartbeat-feel";
import { Reveal } from "@/components/reveal";

export const Route = createFileRoute("/batimentos")({
  head: () => ({
    meta: [
      { title: "Sinta e ouça o coração do bebê — Obstétrica" },
      {
        name: "description",
        content:
          "Sinta os batimentos do bebê na palma da mão: o celular vibra no ritmo do coração fetal. E ouça a simulação em cada trimestre da gestação.",
      },
      { property: "og:title", content: "Sinta o coração do bebê na palma da mão" },
      {
        property: "og:description",
        content: "O celular vibra no ritmo do batimento fetal, batida por batida.",
      },
    ],
  }),
  component: BatimentosPage,
});

const trimestres = [
  {
    label: "1º trimestre",
    bpm: 160,
    semanas: "6-13s",
    desc: "Batimentos rápidos, aceleram rapidamente nas primeiras semanas.",
  },
  {
    label: "2º trimestre",
    bpm: 145,
    semanas: "14-27s",
    desc: "Ritmo se estabiliza. É quando ouvimos com facilidade no Doppler.",
  },
  {
    label: "3º trimestre",
    bpm: 135,
    semanas: "28-40s",
    desc: "Tende a se aproximar do ritmo do recém-nascido.",
  },
];

/**
 * ⚠️ ESTA PÁGINA É PÚBLICA, E ERA O TERCEIRO LUGAR QUE TOCAVA O BATIMENTO.
 *
 * Os outros dois (a aba do Bebê e o painel do acompanhante) ganharam portão de
 * Modo Cuidado; este não tinha nenhum — e ele está no cabeçalho do site, a um
 * toque de distância de dentro do app.
 *
 * O cenário: paciente em Modo Cuidado sai da área logada ou toca "Batimentos"
 * no menu, e ouve o coração fetal a 140 bpm com vibração no ritmo. É a mesma
 * coisa que a prosa da aba do Bebê chama de "a coisa mais dolorosa que este app
 * consegue fazer", só que pela porta da frente.
 *
 * ⚠️ Não dá para resolver com um `!careMode` local: aqui não há sessão no
 * servidor. A página PERGUNTA ao cliente se há alguém logado e, se essa pessoa
 * estiver em Modo Cuidado, não desenha nem o `HeartbeatFeel` nem o player por
 * trimestre. Visitante sem conta continua vendo tudo, que é o público desta
 * página.
 *
 * A leitura é otimista: enquanto ela não volta, nada é desenhado. Um instante a
 * mais de página vazia custa muito menos que o batimento tocando uma vez.
 */
function BatimentosPage() {
  const [luto, setLuto] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (vivo) setLuto(false);
          return;
        }
        /* ⚠️ O cast é o mesmo de todo o repositório: `src/integrations/supabase/
           types.ts` cobre 27 das 112 tabelas e nem conhece `user_id` em
           `patient_profiles`. Está documentado no CLAUDE.md, junto com o
           comando que regenera. */
        const { data: perfil } = await (supabase as any)
          .from("patient_profiles")
          .select("care_mode")
          /* ⚠️ `id`, e NÃO `user_id`. A chave de `patient_profiles` É o id do
             usuário — escrever `user_id` aqui não daria erro: o PostgREST
             devolveria 42703, o `data` viria nulo, `luto` ficaria `false` e o
             batimento tocaria no luto. Um teste do repositório já vigia isso e
             foi ele que pegou. */
          .eq("id", data.user.id)
          .maybeSingle();
        if (vivo) setLuto(Boolean((perfil as { care_mode?: boolean } | null)?.care_mode));
      } catch {
        /* Sem sessão, sem rede, sem tabela: é uma página pública, e o visitante
           sem conta é o caso comum. Falhar para "não é luto" aqui é o certo —
           quem está em luto TEM conta e a leitura acima responde. */
        if (vivo) setLuto(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  const [active, setActive] = useState<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => stop(), []);

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setActive(null);
  }

  function beat(ctx: AudioContext, when: number, freq: number, gainPeak: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gainPeak, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.2);
  }

  function play(i: number) {
    stop();
    const bpm = trimestres[i].bpm;
    const interval = 60000 / bpm;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;
    setActive(i);
    const tick = () => {
      const t = ctx.currentTime;
      beat(ctx, t, 70, 0.6); // lub
      beat(ctx, t + 0.14, 55, 0.4); // dub
    };
    tick();
    timerRef.current = setInterval(tick, interval);
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <Reveal variant="up">
        <p className="glass-chip text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Som do coração
        </p>
        <h1 className="mt-3 font-serif text-4xl">Sinta e ouça os batimentos do bebê</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Anote o valor do BPM na próxima consulta ou ultrassom, ajuste abaixo e{" "}
          <strong>segure o celular</strong>: ele vibra no ritmo exato do coraçãozinho — para você,
          para o papai e para os avós, mesmo à distância.
        </p>
      </Reveal>

      {luto === false && (
        <div className="mx-auto mt-10 max-w-lg">
          <HeartbeatFeel defaultBpm={140} />
        </div>
      )}

      {/* ⚠️ O player por trimestre é um SEGUNDO motor de batimento, próprio
          desta página — `AudioContext` mais `setInterval` tocando lub-dub —,
          fora do sistema de som do app e de qualquer noção de luto. Ele
          entra no mesmo portão. */}
      {luto === false && (
        <>
          <h2 className="mt-14 font-serif text-2xl">O ritmo em cada trimestre</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Uma simulação suave do ritmo cardíaco fetal. O som real é ouvido no Doppler a partir da
            10ª-12ª semana.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {trimestres.map((t, i) => (
              <div
                key={t.label}
                className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <Heart className={`h-8 w-8 text-primary ${active === i ? "animate-pulse" : ""}`} />
                <p className="mt-3 font-serif text-2xl">{t.label}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {t.semanas}
                </p>
                <p className="mt-3 font-serif text-3xl text-primary">
                  {t.bpm} <span className="text-sm text-muted-foreground">bpm</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
                <button
                  type="button"
                  onClick={() => (active === i ? stop() : play(i))}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {active === i ? (
                    <>
                      <Pause className="h-4 w-4" /> Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Ouvir
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-8 text-xs text-muted-foreground">
        * Simulação educativa via síntese de áudio. Não substitui a ausculta clínica.
      </p>
      <AppCtaBanner />
    </section>
  );
}
