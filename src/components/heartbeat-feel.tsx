import { useEffect, useRef, useState } from "react";
import { Heart, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { pararVibracao, tocarPadrao } from "@/lib/nativo";

/**
 * "Sentir o coração" — vibração háptica no ritmo do batimento fetal (lub-dub),
 * com coração pulsando na tela e som sintetizado em sincronia.
 *
 * Inspirado no app Trellis (o médico envia o ultrassom e o app vira um loop
 * háptico do coração do bebê). Aqui a fonte do ritmo é o BPM da última
 * consulta/ultrassom, digitado pela família.
 *
 * Suporte à vibração: Android e, agora, iPhone — mas só no APP NATIVO. O
 * Safari nunca expôs `navigator.vibrate`, então no site o iOS segue com som +
 * pulsação visual e o aviso transparente. Dentro do app, `tocarPadrao` cai nos
 * impactos do Haptics e o batimento finalmente se sente. Quem editar isto:
 * não volte a chamar `navigator.vibrate` direto — é o que deixava metade das
 * pacientes sem a única coisa que esta tela promete.
 */
export function HeartbeatFeel({
  defaultBpm = 140,
  babyName,
  compact = false,
  sourceNote,
}: {
  defaultBpm?: number;
  babyName?: string | null;
  compact?: boolean;
  /** Origem do ritmo (ex.: "Medido pelo médico em 12/07") — some o hint de ajuste. */
  sourceNote?: string;
}) {
  // Clamp igual ao do servidor (60–220): um BPM real de 200 registrado pelo
  // médico não pode virar 180 silenciosamente.
  const [bpm, setBpm] = useState(() => Math.min(220, Math.max(60, defaultBpm)));
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const [canVibrate, setCanVibrate] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    // Detecção honesta: a API existe em desktops que não vibram, mas o alvo
    // real (Android) é onde ela funciona. iOS nem expõe a função.
    setCanVibrate(typeof navigator !== "undefined" && "vibrate" in navigator);
    return () => stop();
  }, []);

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

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    pararVibracao();
    setPlaying(false);
  }

  function start(atBpm: number) {
    stop();
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    // Safari iOS às vezes cria o contexto já "suspended" mesmo dentro do
    // gesto — resume() garante o som na primeira tentativa.
    ctx.resume?.().catch(() => {});
    ctxRef.current = ctx;
    setPlaying(true);
    const tick = () => {
      /* lub-dub: pulso forte + pulso curto ~140ms depois, como no Doppler.
         Pela ponte — no iPhone o `navigator.vibrate` não existe, e o batimento
         que não se SENTE é justamente o que esta tela promete. */
      tocarPadrao([70, 80, 45]);
      if (soundRef.current) {
        const t = ctx.currentTime;
        beat(ctx, t, 70, 0.6); // lub
        beat(ctx, t + 0.14, 55, 0.4); // dub
      }
    };
    tick();
    timerRef.current = setInterval(tick, 60000 / atBpm);
  }

  function setBpmLive(next: number) {
    setBpm(next);
    if (playing) start(next); // reinicia o loop no ritmo novo
  }

  const beatSeconds = 60 / bpm;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <style>{`
        @keyframes hb-lubdub {
          0% { transform: scale(1); }
          12% { transform: scale(1.18); }
          24% { transform: scale(1.02); }
          36% { transform: scale(1.1); }
          50%, 100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hb-anim { animation: none !important; }
        }
      `}</style>

      <div className="flex flex-col items-center text-center">
        {!compact && (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Sinta na palma da mão
          </p>
        )}
        <p className="mt-2 font-serif text-2xl">
          {babyName ? `O coração de ${babyName}` : "O coração do bebê"}
        </p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Segure o celular na mão: ele vibra no ritmo do coraçãozinho, batida por batida.
        </p>

        <button
          type="button"
          onClick={() => (playing ? stop() : start(bpm))}
          aria-label={playing ? "Parar" : "Sentir os batimentos"}
          className="mt-6 flex h-36 w-36 items-center justify-center rounded-full bg-primary/10 transition-colors hover:bg-primary/15"
        >
          <Heart
            fill="currentColor"
            className={`h-20 w-20 text-primary ${playing ? "hb-anim" : ""}`}
            style={playing ? { animation: `hb-lubdub ${beatSeconds}s ease-in-out infinite` } : {}}
          />
        </button>

        <p className="mt-4 font-serif text-3xl text-primary">
          {bpm} <span className="text-sm text-muted-foreground">bpm</span>
        </p>

        <input
          type="range"
          min={Math.min(110, bpm)}
          max={Math.max(170, bpm)}
          value={bpm}
          onChange={(e) => setBpmLive(Number(e.target.value))}
          aria-label="Batimentos por minuto"
          className="mt-3 w-full max-w-xs accent-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {sourceNote ?? "Ajuste para o valor da última consulta ou ultrassom."}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (playing ? stop() : start(bpm))}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {playing ? (
              <>
                <Pause className="h-4 w-4" /> Parar
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Sentir agora
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSound((s) => !s)}
            aria-label={sound ? "Desligar som" : "Ligar som"}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {sound ? "Som ligado" : "Som desligado"}
          </button>
        </div>

        {!canVibrate && (
          <p className="mt-4 max-w-sm rounded-xl bg-secondary/60 px-4 py-2 text-xs text-muted-foreground">
            Neste aparelho o navegador não permite vibração (iPhone e computadores) — sinta pelo som
            e pela pulsação na tela. Em celulares Android, a vibração funciona.
          </p>
        )}
      </div>
    </div>
  );
}
