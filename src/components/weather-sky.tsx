/**
 * WeatherSky — céu animado em tempo real para o hero do site.
 *
 * Usa a MESMA API do app (Open-Meteo, gratuita, sem chave): o céu que a
 * visitante vê no site é o clima real de agora, igual ao hero do app.
 *
 * Elementos por condição:
 *  - Dia limpo: sol com glow pulsante + céu azul
 *  - Parcialmente nublado: sol + nuvens à deriva
 *  - Nublado: camada densa de nuvens
 *  - Chuva: nuvens + fios de chuva animados
 *  - Noite: lua, estrelas com cintilação, céu profundo
 *  - Madrugada/entardecer: paletas próprias de transição
 */
import { useEffect, useState } from "react";

export type SkyTheme = {
  /** true quando o céu é escuro (noite/madrugada) — texto do hero deve ser claro */
  isDark: boolean;
  /** gradiente CSS do céu */
  gradient: string;
  /** dados do clima, null enquanto carrega ou se falhar */
  weather: { temp: number; code: number; condition: string; emoji: string } | null;
  /** período do dia */
  period: "madrugada" | "manha" | "dia" | "entardecer" | "noite";
};

const BH = { lat: -19.92, lon: -43.94 }; // Belo Horizonte — fallback

function conditionFor(code: number): { condition: string; emoji: string } {
  if (code === 0) return { condition: "Céu limpo", emoji: "☀️" };
  if (code <= 2) return { condition: "Parcialmente nublado", emoji: "⛅" };
  if (code === 3) return { condition: "Nublado", emoji: "☁️" };
  if (code === 45 || code === 48) return { condition: "Neblina", emoji: "🌫️" };
  if (code >= 51 && code <= 67) return { condition: "Chuva", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { condition: "Neve", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { condition: "Pancadas de chuva", emoji: "🌦️" };
  if (code >= 95) return { condition: "Tempestade", emoji: "⛈️" };
  return { condition: "Tempo estável", emoji: "🌤️" };
}

export function periodFor(h: number): SkyTheme["period"] {
  if (h < 5) return "madrugada";
  if (h < 10) return "manha";
  if (h < 17) return "dia";
  if (h < 19) return "entardecer";
  return "noite";
}

export function gradientFor(period: SkyTheme["period"], code: number): string {
  const cloudy = code === 3 || code === 45 || code === 48;
  const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 99);
  switch (period) {
    case "madrugada":
      return "linear-gradient(180deg, oklch(0.18 0.04 270), oklch(0.24 0.05 280) 55%, oklch(0.3 0.05 300))";
    case "manha":
      if (rainy)
        return "linear-gradient(180deg, oklch(0.72 0.03 250), oklch(0.8 0.025 230) 60%, oklch(0.88 0.02 80))";
      if (cloudy)
        return "linear-gradient(180deg, oklch(0.78 0.025 240), oklch(0.85 0.02 220) 60%, oklch(0.92 0.02 70))";
      return "linear-gradient(180deg, oklch(0.8 0.07 230), oklch(0.88 0.05 210) 50%, oklch(0.95 0.05 85))";
    case "dia":
      if (rainy)
        return "linear-gradient(180deg, oklch(0.65 0.035 250), oklch(0.75 0.03 240) 60%, oklch(0.85 0.02 230))";
      if (cloudy)
        return "linear-gradient(180deg, oklch(0.75 0.03 240), oklch(0.84 0.025 230) 55%, oklch(0.9 0.02 220))";
      return "linear-gradient(180deg, oklch(0.7 0.11 240), oklch(0.82 0.07 225) 55%, oklch(0.93 0.035 210))";
    case "entardecer":
      if (rainy)
        return "linear-gradient(180deg, oklch(0.5 0.05 270), oklch(0.6 0.08 320) 55%, oklch(0.7 0.1 40))";
      return "linear-gradient(180deg, oklch(0.55 0.1 265), oklch(0.68 0.13 330) 50%, oklch(0.8 0.13 55))";
    case "noite":
      return "linear-gradient(180deg, oklch(0.15 0.04 265), oklch(0.22 0.05 275) 55%, oklch(0.3 0.06 290))";
  }
}

export function useWeatherSky(override?: SkyTheme["period"] | null): SkyTheme {
  // Período calculado só no cliente para evitar mismatch SSR (servidor usa UTC).
  // Antes da montagem, renderiza o céu de "dia" neutro.
  const [autoPeriod, setAutoPeriod] = useState<SkyTheme["period"]>("dia");
  useEffect(() => {
    setAutoPeriod(periodFor(new Date().getHours()));
  }, []);
  const period = override ?? autoPeriod;
  const isDark = period === "madrugada" || period === "noite";

  const [weather, setWeather] = useState<SkyTheme["weather"]>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchWeather(lat: number, lon: number) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          current: { temperature_2m: number; weather_code: number };
        };
        if (cancelled) return;
        const code = data.current.weather_code;
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          code,
          ...conditionFor(code),
        });
      } catch {
        /* clima é enhancement — falha silenciosa */
      }
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(BH.lat, BH.lon),
        { timeout: 4000, maximumAge: 600000 },
      );
    } else {
      fetchWeather(BH.lat, BH.lon);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const code = weather?.code ?? 1;
  return { isDark, gradient: gradientFor(period, code), weather, period };
}

/* ── Camadas visuais ──────────────────────────────────────────────── */

function Stars() {
  // posições determinísticas para evitar mismatch SSR/cliente
  const stars = Array.from({ length: 42 }, (_, i) => ({
    left: (i * 37) % 100,
    top: ((i * 23) % 60) + 2,
    size: 1 + (i % 3) * 0.7,
    delay: (i % 7) * 0.6,
  }));
  return (
    <div className="absolute inset-0" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-[twinkle_3.5s_ease-in-out_infinite]"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function Moon({ small }: { small?: boolean }) {
  return (
    <div
      className={`absolute right-[10%] top-[8%] rounded-full ${
        small ? "h-8 w-8" : "right-[14%] top-[12%] h-16 w-16 md:h-20 md:w-20"
      }`}
      style={{
        background: "radial-gradient(circle at 38% 35%, #fdfbf3, #e8e4d8 70%)",
        boxShadow: small
          ? "0 0 20px 6px rgba(253, 251, 243, 0.25)"
          : "0 0 40px 12px rgba(253, 251, 243, 0.25)",
      }}
      aria-hidden
    />
  );
}

function Sun({ low, small }: { low?: boolean; small?: boolean }) {
  return (
    <div
      className={`absolute rounded-full animate-[sunPulse_5s_ease-in-out_infinite] ${
        small
          ? `right-[8%] ${low ? "top-[30%]" : "top-[6%]"} h-10 w-10`
          : `right-[12%] ${low ? "top-[38%]" : "top-[10%]"} h-20 w-20 md:h-28 md:w-28`
      }`}
      style={{
        background: "radial-gradient(circle at 40% 38%, #fff8e1, #ffd54f 65%, #ffb300)",
        boxShadow: small
          ? "0 0 28px 10px rgba(255, 213, 79, 0.35)"
          : "0 0 60px 20px rgba(255, 213, 79, 0.35)",
      }}
      aria-hidden
    />
  );
}

function Clouds({ density }: { density: "light" | "heavy" }) {
  const blobs =
    density === "heavy"
      ? [
          { top: 8, scale: 1.3, dur: 95, delay: 0, opacity: 0.95 },
          { top: 22, scale: 1, dur: 75, delay: -30, opacity: 0.85 },
          { top: 38, scale: 1.5, dur: 110, delay: -60, opacity: 0.9 },
          { top: 4, scale: 0.8, dur: 65, delay: -15, opacity: 0.8 },
          { top: 52, scale: 1.1, dur: 88, delay: -45, opacity: 0.75 },
        ]
      : [
          { top: 10, scale: 1, dur: 95, delay: 0, opacity: 0.8 },
          { top: 30, scale: 0.75, dur: 120, delay: -50, opacity: 0.65 },
          { top: 18, scale: 1.2, dur: 105, delay: -80, opacity: 0.7 },
        ];
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {blobs.map((c, i) => (
        <div
          key={i}
          className="absolute animate-[cloudDrift_linear_infinite]"
          style={{
            top: `${c.top}%`,
            left: "-30%",
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            opacity: c.opacity,
          }}
        >
          <div className="relative h-16 w-44" style={{ transform: `scale(${c.scale})` }}>
            <span className="absolute left-0 top-4 h-12 w-24 rounded-full bg-white/90 blur-md" />
            <span className="absolute left-12 top-0 h-14 w-28 rounded-full bg-white/95 blur-md" />
            <span className="absolute left-24 top-5 h-10 w-20 rounded-full bg-white/85 blur-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Rain() {
  const drops = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 53) % 100,
    delay: (i % 9) * 0.18,
    dur: 0.7 + (i % 4) * 0.12,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {drops.map((d, i) => (
        <span
          key={i}
          className="absolute top-[-10%] h-5 w-px bg-gradient-to-b from-transparent via-white/50 to-white/20 animate-[rainFall_linear_infinite]"
          style={{
            left: `${d.left}%`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Camadas de clima reutilizáveis (sem gradiente de fundo) — para usar
 * dentro de cards menores, como o hero do app. `mini` reduz a escala.
 */
export function SkyLayers({
  code,
  isDark,
  mini = false,
  period,
}: {
  code: number;
  isDark: boolean;
  mini?: boolean;
  /** quando informado, renderiza também sol (dia) ou lua (noite) */
  period?: SkyTheme["period"];
}) {
  const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 99);
  const heavyClouds = code === 3 || code === 45 || code === 48 || rainy;
  const someClouds = code >= 1 && code <= 2;
  const clear = code === 0;
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${mini ? "opacity-70" : ""}`}
      aria-hidden
    >
      {isDark && <Stars />}
      {period && isDark && !heavyClouds && <Moon small={mini} />}
      {period && !isDark && (clear || someClouds) && (
        <Sun low={period === "entardecer"} small={mini} />
      )}
      {(someClouds || heavyClouds) && <Clouds density={heavyClouds ? "heavy" : "light"} />}
      {rainy && <Rain />}
    </div>
  );
}

/**
 * Canvas do céu — renderiza o fundo absoluto do hero.
 * Deve estar dentro de um container `relative overflow-hidden`.
 */
export function SkyCanvas({ sky }: { sky: SkyTheme }) {
  const code = sky.weather?.code ?? 1;
  const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 99);
  const heavyClouds = code === 3 || code === 45 || code === 48 || rainy;
  const someClouds = code >= 1 && code <= 2;
  const clear = code === 0;

  return (
    <div
      className="absolute inset-0 transition-[background] duration-1000"
      style={{ background: sky.gradient }}
      aria-hidden
    >
      {sky.isDark && <Stars />}
      {sky.isDark && !heavyClouds && <Moon />}
      {!sky.isDark && (clear || someClouds) && <Sun low={sky.period === "entardecer"} />}
      {(someClouds || heavyClouds) && <Clouds density={heavyClouds ? "heavy" : "light"} />}
      {rainy && <Rain />}
      {/* fade para o fundo do site na base */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
