/**
 * Componentes da experiência mobile do app autenticado:
 *   - AppBottomNav   – barra inferior com 5 abas e indicador pill ativo (#5)
 *   - AppHomeScreen  – dashboard com clima em tempo real, semana Apple Fitness,
 *                      modo madrugada, próxima consulta e coração pulsante (#6–10)
 *   - SectionHeader  – cabeçalho de categoria com botão voltar
 *
 * Clima via Open-Meteo (gratuito, sem API key) com recomendações para gestantes.
 */
import { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  Baby,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Footprints,
  GraduationCap,
  Heart,
  Home,
  MessageCircle,
  NotebookPen,
  Sparkles,
  Stethoscope,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { DOCTOR } from "@/lib/doctor.config";
import { BabyIllustration } from "@/components/baby-illustration";
import { SkyLayers, gradientFor, periodFor } from "@/components/weather-sky";
import { babyForWeek } from "@/lib/gestacao";

/* ================================================================
   Tipos
   ================================================================ */

export type AppTab =
  | "Bebê"
  | "Carta do Bebê"
  | "Calendário"
  | "Linha do Tempo"
  | "Diário"
  | "Humor"
  | "Chutes"
  | "Contrações"
  | "Saúde"
  | "Nutrição"
  | "Meditações"
  | "Sons"
  | "Exercícios"
  | "Quartinho"
  | "Clima"
  | "Alertas"
  | "Pré-consulta"
  | "Perguntas"
  | "Checklist"
  | "Consultas"
  | "Teleconsulta"
  | "Acompanhante"
  | "Conta Regressiva"
  | "Álbum"
  | "Nome do Bebê"
  | "Escola"
  | "FAQ"
  | "Pânico"
  | "Carteirinha"
  | "Pós-parto"
  | "Conquistas"
  | "Loja"
  | "Consulta Particular"
  | "Ciclo Menstrual"
  | "Preventivos"
  | "Médico"
  | "Chat IA"
  | "Perfil"
  | "Exames"
  | "Plano de Parto"
  | "Apoio Emocional";

export type BottomSection = "home" | "gestacao" | "saude" | "consultas" | "eu";

const SECTION_TABS: Record<BottomSection, readonly AppTab[]> = {
  home: [],
  gestacao: [
    "Bebê",
    "Carta do Bebê",
    "Calendário",
    "Linha do Tempo",
    "Chutes",
    "Contrações",
    "Conta Regressiva",
    "Carteirinha",
  ],
  saude: [
    "Saúde",
    "Exames",
    "Nutrição",
    "Meditações",
    "Sons",
    "Exercícios",
    "Clima",
    "Alertas",
    "Ciclo Menstrual",
    "Preventivos",
  ],
  consultas: [
    "Pré-consulta",
    "Plano de Parto",
    "Perguntas",
    "Checklist",
    "Consultas",
    "Teleconsulta",
    "Consulta Particular",
  ],
  eu: [
    "Diário",
    "Humor",
    "Acompanhante",
    "Quartinho",
    "Álbum",
    "Nome do Bebê",
    "Pós-parto",
    "Apoio Emocional",
    "Escola",
    "FAQ",
    "Pânico",
    "Conquistas",
    "Loja",
    "Médico",
    "Chat IA",
    "Perfil",
  ],
};

export function tabToSection(t: AppTab): BottomSection {
  for (const [section, tabs] of Object.entries(SECTION_TABS) as [
    BottomSection,
    readonly AppTab[],
  ][]) {
    if ((tabs as string[]).includes(t)) return section;
  }
  return "gestacao";
}

/* ================================================================
   Clima em tempo real — Open-Meteo (gratuito, sem API key)
   ================================================================ */

type WeatherState = {
  temp: number;
  code: number;
  condition: string;
  emoji: string;
  overlay: string;
  tip: string;
  tipEmoji: string;
};

function wmoToInfo(code: number): { condition: string; emoji: string } {
  if (code === 0) return { condition: "Céu limpo", emoji: "☀️" };
  if (code === 1) return { condition: "Predominante claro", emoji: "🌤️" };
  if (code === 2) return { condition: "Parcialmente nublado", emoji: "⛅" };
  if (code === 3) return { condition: "Nublado", emoji: "☁️" };
  if (code >= 45 && code <= 48) return { condition: "Névoa", emoji: "🌫️" };
  if (code >= 51 && code <= 55) return { condition: "Garoa", emoji: "🌦️" };
  if (code >= 61 && code <= 65) return { condition: "Chuva", emoji: "🌧️" };
  if (code >= 71 && code <= 75) return { condition: "Neve", emoji: "❄️" };
  if (code >= 80 && code <= 82) return { condition: "Pancadas de chuva", emoji: "🌧️" };
  if (code >= 95) return { condition: "Trovoada", emoji: "⛈️" };
  return { condition: "Parcialmente nublado", emoji: "⛅" };
}

/** Gradiente radial sobreposto ao hero — muda a "vibe" visual do card conforme o clima. */
function weatherOverlay(code: number, temp: number): string {
  if (code >= 95)
    return "radial-gradient(ellipse at 30% 0%, oklch(0.38 0.05 255 / 0.55), transparent 68%)";
  if (code >= 80)
    return "radial-gradient(ellipse at 20% 0%, oklch(0.58 0.04 222 / 0.45), transparent 68%)";
  if (code >= 61)
    return "radial-gradient(ellipse at 15% 0%, oklch(0.65 0.035 220 / 0.4), transparent 68%)";
  if (code >= 51)
    return "radial-gradient(ellipse at 20% 0%, oklch(0.72 0.02 215 / 0.32), transparent 68%)";
  if (code >= 45)
    return "radial-gradient(ellipse at 20% 0%, oklch(0.75 0.018 285 / 0.32), transparent 68%)";
  if (code === 3)
    return "radial-gradient(ellipse at 30% 0%, oklch(0.8 0.01 240 / 0.28), transparent 68%)";
  if (code === 0 && temp > 28)
    return "radial-gradient(ellipse at 72% 8%, oklch(0.88 0.14 72 / 0.48), transparent 55%)";
  if (code <= 1)
    return "radial-gradient(ellipse at 72% 5%, oklch(0.92 0.09 68 / 0.38), transparent 60%)";
  return "radial-gradient(ellipse at 60% 5%, oklch(0.94 0.045 55 / 0.28), transparent 62%)";
}

/** Dica contextual de bem-estar para gestantes baseada no clima atual. */
function weatherTip(code: number, temp: number): { tip: string; tipEmoji: string } {
  if (code >= 95)
    return { tipEmoji: "⛈️", tip: "Fique em casa — ótimo para ouvir os batimentos do bebê." };
  if (code >= 80)
    return {
      tipEmoji: "🌧️",
      tip: "Pancadas — relaxe com música calma para vocês duas.",
    };
  if (code >= 61)
    return { tipEmoji: "🌧️", tip: "Dia de chuva — chá quentinho e descanso fazem muito bem." };
  if (code >= 51)
    return {
      tipEmoji: "🌦️",
      tip: "Garoa hoje. Um bom livro sobre maternidade combina perfeitamente.",
    };
  if (code >= 45)
    return { tipEmoji: "🌫️", tip: "Névoa — prefira indoor. Meditação guiada é ótima opção." };
  if (temp > 35)
    return { tipEmoji: "🥵", tip: "Calor extremo! Ambiente climatizado e água a cada 30 min." };
  if (temp > 30)
    return { tipEmoji: "☀️", tip: "Calor forte — hidrate-se bastante! Protetor FPS 50+ se sair." };
  if (code === 3)
    return { tipEmoji: "☁️", tip: "Nublado e fresco — ótimo para uma caminhada leve de 20 min." };
  if (code === 2)
    return { tipEmoji: "⛅", tip: "Parcialmente nublado — clima agradável para uma saída curta." };
  if (code <= 1 && temp > 22)
    return { tipEmoji: "☀️", tip: "Dia lindo! Caminhada de manhã com protetor FPS 50+ e chapéu." };
  if (code <= 1)
    return { tipEmoji: "🌤️", tip: "Céu aberto — perfeito para respirar ar fresco. Beba água!" };
  if (temp < 10)
    return { tipEmoji: "🧣", tip: "Frio intenso — agasalhe bem a barriga e prefira indoor." };
  if (temp < 15) return { tipEmoji: "🧥", tip: "Frio hoje — vista camadas e cuide da barriga." };
  return { tipEmoji: "🌸", tip: "Clima tranquilo — momento perfeito para descansar com o bebê." };
}

function useWeather(): WeatherState | null {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast` +
              `?latitude=${coords.latitude.toFixed(4)}` +
              `&longitude=${coords.longitude.toFixed(4)}` +
              `&current=temperature_2m,weather_code` +
              `&timezone=auto&forecast_days=1`,
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            current: { temperature_2m: number; weather_code: number };
          };
          const temp = Math.round(data.current.temperature_2m);
          const code = data.current.weather_code;
          const { condition, emoji } = wmoToInfo(code);
          const overlay = weatherOverlay(code, temp);
          const { tip, tipEmoji } = weatherTip(code, temp);
          setWeather({ temp, code, condition, emoji, overlay, tip, tipEmoji });
        } catch {
          /* clima é enhancement — falha silenciosa */
        }
      },
      () => {},
      { timeout: 8000, maximumAge: 300_000 },
    );
  }, []);
  return weather;
}

/* ================================================================
   AppBottomNav — indicador pill ativo estilo iOS (#5)
   ================================================================ */

const NAV_ITEMS: { id: BottomSection; Icon: LucideIcon; label: string }[] = [
  { id: "home", Icon: Home, label: "Início" },
  { id: "gestacao", Icon: Baby, label: "Gestação" },
  { id: "saude", Icon: Heart, label: "Saúde" },
  { id: "consultas", Icon: CalendarDays, label: "Consultas" },
  { id: "eu", Icon: UserCircle, label: "Eu" },
];

export function AppBottomNav({
  activeSection,
  onSelect,
}: {
  activeSection: BottomSection;
  onSelect: (s: BottomSection) => void;
}) {
  return (
    <nav
      aria-label="Navegação do app"
      className="fixed inset-x-0 bottom-0 z-40 flex md:hidden items-center justify-around border-t border-border/70 bg-background/90 backdrop-blur-xl backdrop-saturate-150 print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {NAV_ITEMS.map(({ id, Icon, label }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors duration-200"
          >
            {/* Pill de fundo — expande quando ativo, desaparece quando inativo */}
            <div
              className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                active ? "bg-primary/12 scale-105" : "scale-100"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                  active ? "text-primary scale-110" : "text-muted-foreground scale-100"
                }`}
                strokeWidth={active ? 2.5 : 1.8}
              />
            </div>
            <span
              className={`text-[9px] font-medium transition-colors duration-200 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/* ================================================================
   AppHomeScreen
   ================================================================ */

type GestInfo = { weeks: number; days: number; totalDays: number } | null;

export type NextAppointment = { dateLabel: string; typeLabel: string };

const GRID: { Icon: LucideIcon; label: string; tab: AppTab; color: string }[] = [
  { Icon: Baby, label: "Bebê", tab: "Bebê", color: "bg-pink-50 text-pink-600 ring-pink-200" },
  {
    Icon: Footprints,
    label: "Chutes",
    tab: "Chutes",
    color: "bg-violet-50 text-violet-600 ring-violet-200",
  },
  {
    Icon: CalendarDays,
    label: "Calendário",
    tab: "Calendário",
    color: "bg-blue-50 text-blue-600 ring-blue-200",
  },
  {
    Icon: CreditCard,
    label: "Carteirinha",
    tab: "Carteirinha",
    color: "bg-amber-50 text-amber-600 ring-amber-200",
  },
  {
    Icon: Activity,
    label: "Saúde",
    tab: "Saúde",
    color: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  },
  {
    Icon: AlertTriangle,
    label: "Alertas",
    tab: "Alertas",
    color: "bg-rose-50 text-rose-600 ring-rose-200",
  },
  {
    Icon: FileText,
    label: "Pré-consulta",
    tab: "Pré-consulta",
    color: "bg-sky-50 text-sky-600 ring-sky-200",
  },
  {
    Icon: NotebookPen,
    label: "Diário",
    tab: "Diário",
    color: "bg-orange-50 text-orange-600 ring-orange-200",
  },
  {
    Icon: GraduationCap,
    label: "Escola",
    tab: "Escola",
    color: "bg-teal-50 text-teal-600 ring-teal-200",
  },
  {
    Icon: Stethoscope,
    label: "Médico",
    tab: "Médico",
    color: "bg-primary/10 text-primary ring-primary/20",
  },
  {
    Icon: MessageCircle,
    label: "Chat IA",
    tab: "Chat IA",
    color: "bg-indigo-50 text-indigo-600 ring-indigo-200",
  },
  {
    Icon: UserCircle,
    label: "Perfil",
    tab: "Perfil",
    color: "bg-secondary text-secondary-foreground ring-border",
  },
];

export function AppHomeScreen({
  firstName,
  babyName,
  gest,
  onNavigate,
  nextAppointment,
}: {
  firstName: string;
  babyName: string | null;
  gest: GestInfo;
  onNavigate: (tab: AppTab) => void;
  nextAppointment?: NextAppointment | null;
}) {
  const baby = gest ? babyForWeek(gest.weeks) : null;
  const progress = gest ? Math.min(100, (gest.totalDays / 280) * 100) : null;
  const weather = useWeather();

  const h = new Date().getHours();
  const isMadrugada = h < 5;
  const period = periodFor(h);
  // Céu escuro (noite/madrugada) ou de transição (entardecer) pede texto claro
  const darkSky = period === "madrugada" || period === "noite" || period === "entardecer";

  // Cores de texto adaptadas ao céu do momento
  const heroText = darkSky ? "text-white/95" : "text-foreground";
  const heroMuted = darkSky ? "text-white/65" : "text-muted-foreground";
  const heroBadge = darkSky ? "bg-white/15 text-white/90" : "bg-card/80 text-foreground";
  const heroLabel = darkSky ? "text-white/60" : "text-primary";

  return (
    <div className="space-y-4 pb-2">
      {/* ── Hero card: céu real do momento + bebê + clima ──────────── */}
      <div
        className="rounded-3xl relative overflow-hidden p-5 transition-[background] duration-1000"
        style={{ background: gradientFor(period, weather?.code ?? 1) }}
      >
        {/* Céu vivo: sol/lua, estrelas à noite, nuvens à deriva, chuva */}
        <SkyLayers
          code={weather?.code ?? 1}
          isDark={period === "madrugada" || period === "noite"}
          mini
          period={period}
        />

        <div className="relative">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${heroLabel}`}>
            Olá, {firstName} 💛
          </p>

          {isMadrugada && (
            <p className="mt-1 text-[11px] text-white/40">
              🌙 Madrugada — tente descansar um pouco
            </p>
          )}

          {gest && baby ? (
            <>
              {/* Bebê protagonista — centralizado, sem o círculo do saco */}
              <div className="mt-1 flex justify-center">
                <BabyIllustration
                  week={gest.weeks}
                  showSac={false}
                  showInfo={false}
                  className="h-40 w-40 drop-shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                />
              </div>

              {/* Número de semana estilo Apple Fitness — centralizado sob o bebê */}
              <div className="mt-1 flex items-baseline justify-center gap-1.5">
                <p className={`font-serif text-[3.4rem] leading-none tracking-tight ${heroText}`}>
                  {gest.weeks}
                </p>
                <div className="mb-1">
                  <p className={`text-xs font-semibold leading-tight ${heroMuted}`}>semanas</p>
                  <p className={`text-xs ${heroMuted}`}>{gest.days} dias</p>
                </div>
              </div>

              {babyName && (
                <p className={`mt-0.5 text-center text-xs ${heroMuted}`}>Acompanhando {babyName}</p>
              )}

              <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ${heroBadge}`}
                >
                  {baby.size}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ${heroBadge}`}
                >
                  {baby.weight}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ${heroBadge}`}
                >
                  🍓 {baby.fruit}
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="mt-4">
                <div className={`mb-1 flex justify-between text-[10px] ${heroMuted}`}>
                  <span>Início</span>
                  <span>{Math.round(progress ?? 0)}% concluído</span>
                  <span>Parto</span>
                </div>
                <div
                  className={`h-2 w-full rounded-full ${darkSky ? "bg-white/20" : "bg-border/60"}`}
                >
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${darkSky ? "bg-white/70" : "bg-primary"}`}
                    style={{ width: `${progress ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Strip de clima — só aparece quando dados chegam */}
              {!isMadrugada && weather && (
                <div
                  className={`mt-3 rounded-2xl backdrop-blur-sm px-3 py-2 flex items-start gap-2.5 ${
                    darkSky ? "bg-white/15" : "bg-white/40"
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">{weather.emoji}</span>
                  <div className="min-w-0">
                    <p
                      className={`text-[11px] font-semibold ${darkSky ? "text-white/90" : "text-foreground/80"}`}
                    >
                      {weather.temp}°C · {weather.condition}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 leading-snug ${darkSky ? "text-white/70" : "text-foreground/65"}`}
                    >
                      {weather.tipEmoji} {weather.tip}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-3">
              <p className={`text-sm ${heroMuted}`}>
                Configure sua data de gestação em <strong>Perfil</strong> para ver o
                desenvolvimento.
              </p>
              <button
                onClick={() => onNavigate("Perfil")}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Configurar perfil
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Próxima consulta (#10) ──────────────────────────────────── */}
      {nextAppointment ? (
        <button
          onClick={() => onNavigate("Consultas")}
          className="group w-full rounded-3xl border border-primary/20 bg-primary/6 text-left transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98] hover:border-primary/35 hover:bg-primary/10 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/20 transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-105 group-hover:-rotate-3">
              <CalendarDays className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                Próxima consulta
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {nextAppointment.dateLabel}
              </p>
              <p className="text-xs text-muted-foreground">{nextAppointment.typeLabel}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-primary/50 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </button>
      ) : (
        <button
          onClick={() => onNavigate("Consultas")}
          className="group w-full rounded-3xl border border-dashed border-primary/25 bg-primary/4 text-left transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98] hover:border-primary/40 hover:bg-primary/8"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15 text-primary transition-transform duration-300 group-hover:scale-105">
              <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Agendar consulta</p>
              <p className="text-xs text-muted-foreground">Nenhuma consulta agendada</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-primary/40 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </button>
      )}

      {/* ── Grade de ícones ─────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Acesso rápido
        </p>
        <div className="grid grid-cols-4 gap-2">
          {GRID.map(({ Icon, label, tab, color }) => {
            const isHeartIcon = Icon === Heart;
            return (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                className="spotlight-card group flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card p-2.5 transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-95 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-3 group-active:scale-90 ${color}`}
                >
                  <Icon
                    className={`h-5 w-5 ${isHeartIcon ? "heartbeat-icon" : ""}`}
                    strokeWidth={1.8}
                  />
                </div>
                <span className="text-[10px] font-medium leading-tight text-center text-foreground/80">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Card do médico ──────────────────────────────────────────── */}
      <button
        onClick={() => onNavigate("Médico")}
        className="group w-full rounded-3xl border border-border bg-card overflow-hidden text-left shadow-[var(--shadow-card)] transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98]"
      >
        <div className="flex items-center gap-4 p-4">
          <img
            src={portrait}
            alt="Dr. Clóvis Bacha"
            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Seu médico
            </p>
            <p className="mt-0.5 font-serif text-lg leading-tight text-foreground">{DOCTOR.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{DOCTOR.specialty}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{DOCTOR.crm}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </button>

      {/* ── Chat IA destaque ─────────────────────────────────────────── */}
      <button
        onClick={() => onNavigate("Chat IA")}
        className="group w-full rounded-3xl bg-[var(--gradient-primary)] p-5 text-left transition-all duration-300 active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-serif text-lg text-primary-foreground">Chat com IA</p>
            <p className="text-xs text-primary-foreground/80">Tire dúvidas a qualquer hora</p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-primary-foreground/70 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </button>
    </div>
  );
}

/* ================================================================
   SectionHeader
   ================================================================ */

export function SectionHeader({
  title,
  subtitle,
  onHome,
}: {
  title: string;
  subtitle?: string;
  onHome: () => void;
}) {
  return (
    <div className="mb-5 flex items-center gap-3 md:hidden">
      <button
        onClick={onHome}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary transition-all duration-200 hover:bg-primary/15 active:scale-95"
        aria-label="Voltar ao início"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div>
        <p className="font-serif text-xl leading-tight text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
