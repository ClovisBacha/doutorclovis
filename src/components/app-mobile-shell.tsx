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
  AlertTriangle,
  Baby,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Footprints,
  Map,
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
  | "Caminho"
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
    "Caminho",
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
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function load(lat: number, lon: number) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${lat.toFixed(4)}` +
            `&longitude=${lon.toFixed(4)}` +
            `&current=temperature_2m,weather_code` +
            `&timezone=auto&forecast_days=1`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          current: { temperature_2m: number; weather_code: number };
        };
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const { condition, emoji } = wmoToInfo(code);
        const overlay = weatherOverlay(code, temp);
        const { tip, tipEmoji } = weatherTip(code, temp);
        if (!cancelled) setWeather({ temp, code, condition, emoji, overlay, tip, tipEmoji });
      } catch {
        /* clima é enhancement — falha silenciosa */
      }
    }

    // Fallback: Belo Horizonte. Sem ele, quem nega a localização perdia o
    // strip de clima inteiro (dado "sumido" relatado na auditoria de design).
    const FALLBACK = { lat: -19.9167, lon: -43.9345 };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => load(coords.latitude, coords.longitude),
        () => load(FALLBACK.lat, FALLBACK.lon),
        { timeout: 8000, maximumAge: 300_000 },
      );
    } else {
      load(FALLBACK.lat, FALLBACK.lon);
    }
    return () => {
      cancelled = true;
    };
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
  // Estilo Instagram: rolando para BAIXO (lendo conteúdo) a barra encolhe e
  // some com os rótulos; rolando para CIMA (procurando navegação) ela volta ao
  // tamanho cheio. Perto do topo fica sempre expandida.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < 48) setCompact(false);
        else if (delta > 6) setCompact(true);
        else if (delta < -6) setCompact(false);
        lastY = y;
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <nav
      aria-label="Navegação do app"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center md:hidden print:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      <div
        className={`pointer-events-auto flex items-center justify-around rounded-full border border-border/60 bg-background/85 shadow-[0_10px_36px_rgba(0,0,0,0.14)] backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
          compact ? "w-[64%] px-1.5 py-1" : "w-[92%] max-w-md px-2 py-1.5"
        }`}
      >
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className="flex min-w-0 flex-1 flex-col items-center py-1 transition-colors duration-200"
            >
              {/* Pill de fundo — expande com mola quando ativa (key retrigger do pop-in) */}
              <div
                key={active ? "on" : "off"}
                className={`flex items-center justify-center rounded-full transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                  compact ? "h-9 w-9" : "h-9 w-12"
                } ${active ? "pop-in bg-primary/12 scale-105" : "scale-100"}`}
              >
                <Icon
                  className={`h-5 w-5 transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                    active ? "text-primary scale-110" : "text-muted-foreground scale-100"
                  }`}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>
              <span
                className={`overflow-hidden text-[10px] font-medium transition-all duration-300 ${
                  compact ? "max-h-0 opacity-0" : "mt-0.5 max-h-4 opacity-100"
                } ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ================================================================
   AppHomeScreen
   ================================================================ */

type GestInfo = { weeks: number; days: number; totalDays: number } | null;

/**
 * Marcos proativos por semana: o app INICIA o cuidado ("você entrou na semana
 * 28 — hora de contar os movimentos") em vez de esperar a paciente procurar.
 * Faixas em ordem; a primeira que contém a semana atual vence.
 */
const WEEK_MILESTONES: {
  min: number;
  max: number;
  icon: string;
  title: string;
  text: string;
  tab: AppTab;
}[] = [
  {
    min: 6,
    max: 10,
    icon: "🩺",
    title: "Hora do primeiro ultrassom",
    text: "O exame inicial (6–9 semanas) data a gestação. Já agendou a primeira consulta?",
    tab: "Consultas",
  },
  {
    min: 11,
    max: 13,
    icon: "🔬",
    title: "Janela do morfológico do 1º trimestre",
    text: "Entre 11 e 14 semanas — guarde o resultado na aba Exames.",
    tab: "Exames",
  },
  {
    min: 16,
    max: 19,
    icon: "🦶",
    title: "Os primeiros chutes estão chegando",
    text: "Entre 18 e 22 semanas você deve começar a sentir — registre os movimentos.",
    tab: "Chutes",
  },
  {
    min: 20,
    max: 23,
    icon: "🔬",
    title: "Janela do morfológico do 2º trimestre",
    text: "Entre 20 e 24 semanas — o ultrassom mais detalhado do bebê.",
    tab: "Exames",
  },
  {
    min: 24,
    max: 27,
    icon: "🍬",
    title: "Época do teste de glicose (TOTG)",
    text: "Entre 24 e 28 semanas — rastreio de diabetes gestacional. Combine com seu médico.",
    tab: "Exames",
  },
  {
    min: 28,
    max: 30,
    icon: "👶",
    title: "Comece a contagem de movimentos",
    text: "No 3º trimestre, o padrão diário dos chutes é o melhor sinal de bem-estar do bebê.",
    tab: "Chutes",
  },
  {
    min: 31,
    max: 33,
    icon: "📋",
    title: "Hora de montar o plano de parto",
    text: "Registre suas preferências e converse com seu médico na próxima consulta.",
    tab: "Plano de Parto",
  },
  {
    min: 34,
    max: 36,
    icon: "🧳",
    title: "Prepare a mala da maternidade",
    text: "O checklist completo te guia peça por peça — deixe pronta até a semana 36.",
    tab: "Checklist",
  },
  {
    min: 37,
    max: 42,
    icon: "⏱️",
    title: "Reta final: conheça os sinais do trabalho de parto",
    text: "Registre as contrações — padrão 5-1-1 é hora de ir para a maternidade.",
    tab: "Contrações",
  },
];

function milestoneForWeek(weeks: number) {
  return WEEK_MILESTONES.find((m) => weeks >= m.min && weeks <= m.max) ?? null;
}

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
    Icon: Heart,
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
    Icon: Map,
    label: "Jornada",
    tab: "Caminho",
    color: "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-200",
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

/**
 * Lê do cache local da jornada (dc-path-*) a chama e o estado do desafio de
 * hoje. Leitura duplicada de propósito: não puxa o módulo pesado do jogo.
 */
function readJourneyStats(totalDays: number | null): { streak: number; todayDone: boolean } {
  if (typeof window === "undefined" || totalDays == null) return { streak: 0, todayDone: false };
  try {
    const doneDays: number[] = JSON.parse(localStorage.getItem("dc-path-done-days") ?? "[]");
    const todayD = Math.max(7, Math.min(300, totalDays));
    const set = new Set(doneDays);
    let s = 0;
    let d = set.has(todayD) ? todayD : todayD - 1;
    while (set.has(d)) {
      s++;
      d--;
    }
    return { streak: s, todayDone: set.has(todayD) };
  } catch {
    return { streak: 0, todayDone: false };
  }
}

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
  const daysLeft = gest ? Math.max(0, 280 - gest.totalDays) : null;
  const trimestre = gest
    ? gest.weeks < 14
      ? "1º trimestre"
      : gest.weeks < 28
        ? "2º trimestre"
        : "3º trimestre"
    : null;
  const weather = useWeather();
  const [journey] = useState(() => readJourneyStats(gest?.totalDays ?? null));

  const h = new Date().getHours();
  const isMadrugada = h < 5;
  const period = periodFor(h);
  // Céu escuro (noite/madrugada) pede texto claro. O entardecer TERMINA claro
  // na base do card (oklch ~0.8) — texto branco ali ficava ilegível, então ele
  // conta como céu claro para o texto (auditoria de contraste).
  const darkSky = period === "madrugada" || period === "noite";

  // Cores de texto adaptadas ao céu do momento
  const heroText = darkSky ? "text-white/95" : "text-foreground";
  const heroMuted = darkSky ? "text-white/65" : "text-muted-foreground";
  const heroBadge = darkSky ? "bg-white/15 text-white/90" : "bg-card/80 text-foreground";
  const heroLabel = darkSky ? "text-white/60" : "text-primary";

  return (
    <div className="space-y-4 pb-2">
      {/* ── Hero card: céu real do momento + bebê + clima ──────────── */}
      <div
        className="shine relative flex min-h-[66svh] flex-col overflow-hidden rounded-3xl p-5 transition-[background] duration-1000"
        style={{ background: gradientFor(period, weather?.code ?? 1) }}
      >
        {/* Céu vivo: sol/lua, estrelas à noite, nuvens à deriva, chuva */}
        <SkyLayers
          code={weather?.code ?? 1}
          isDark={period === "madrugada" || period === "noite"}
          mini
          period={period}
        />

        <div className="relative flex flex-1 flex-col">
          {isMadrugada && (
            <p className="text-[11px] text-white/65">🌙 Madrugada — tente descansar um pouco</p>
          )}

          {gest && baby ? (
            <>
              {/* Dados de topo: trimestre + contagem regressiva p/ o parto */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${heroBadge}`}
                >
                  {trimestre}
                </span>
                {daysLeft != null && (
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${heroBadge}`}
                  >
                    {daysLeft === 0 ? "É hoje! 🎉" : `Parto em ${daysLeft} dias 💛`}
                  </span>
                )}
              </div>

              {/* Bebê protagonista — GRANDE, flutuando, dono da tela */}
              <div className="float-slow flex flex-1 items-center justify-center py-2">
                <BabyIllustration
                  week={gest.weeks}
                  showSac={false}
                  showInfo={false}
                  className="h-56 w-56 drop-shadow-[0_14px_36px_rgba(0,0,0,0.16)]"
                />
              </div>

              {/* Número de semana — lente de vidro líquido translúcida */}
              <div className="mt-1 flex flex-col items-center">
                <p
                  className="leading-none"
                  style={{
                    fontFamily: "'Nunito', system-ui, sans-serif",
                    fontSize: "3.7rem",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums lining-nums",
                    // Vidro líquido legível nos DOIS céus: claro no escuro,
                    // escuro-quente no claro (contraste auditado).
                    backgroundImage: darkSky
                      ? "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.45) 100%)"
                      : "linear-gradient(180deg, rgba(62,38,28,0.9) 0%, rgba(62,38,28,0.55) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    color: "transparent",
                    textShadow: darkSky
                      ? [
                          "0 -1px 1px rgba(255,255,255,0.55)",
                          "0 1px 1px rgba(255,255,255,0.25)",
                          "0 4px 10px rgba(0,0,0,0.18)",
                        ].join(", ")
                      : ["0 -1px 1px rgba(255,255,255,0.6)", "0 4px 10px rgba(0,0,0,0.08)"].join(
                          ", ",
                        ),
                  }}
                >
                  {gest.weeks}
                </p>
                <p
                  className={`mt-1.5 text-[11px] font-semibold uppercase opacity-70 ${heroMuted}`}
                  style={{ fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: "0.18em" }}
                >
                  semanas{gest.days > 0 ? ` · ${gest.days} dias` : ""}
                </p>
              </div>

              {babyName && (
                <p className={`mt-1 text-center text-xs ${heroMuted}`}>Acompanhando {babyName}</p>
              )}

              {/* Badges liquid glass */}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {[baby.size, baby.weight, `🍓 ${baby.fruit}`].map((label) => (
                  <span
                    key={label}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide"
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid rgba(255,255,255,0.35)",
                      boxShadow:
                        "0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.20)",
                      color: darkSky ? "rgba(255,255,255,0.93)" : "rgba(30,20,14,0.82)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Barra de progresso */}
              <div className="mt-4">
                <div className={`mb-1.5 flex justify-between text-[10px] ${heroMuted}`}>
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

              {/* Strip de clima — com fallback de cidade, sempre chega */}
              {weather && (
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
            /* flex-1 centrado: sem isso o texto ficava colado no topo com
               ~380px de gradiente vazio abaixo (hero tem min-h de 66svh). */
            <div className="mt-3 flex flex-1 flex-col items-center justify-center text-center">
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

      {/* ── Jornada do dia: o game em destaque (acesso principal) ───── */}
      {gest && (
        <button
          onClick={() => onNavigate("Caminho")}
          className="group w-full overflow-hidden rounded-3xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 p-[2px] text-left shadow-[var(--shadow-card)] transition-all duration-300 active:scale-[0.98]"
        >
          <div className="flex items-center gap-3.5 rounded-[calc(1.5rem-2px)] bg-gradient-to-r from-pink-500/95 to-violet-500/95 px-4 py-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-inner">
              {journey.todayDone ? "✅" : "🎁"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                Jornada diária · Jogo
              </p>
              <p className="mt-0.5 text-[15px] font-extrabold leading-tight text-white">
                {journey.todayDone
                  ? "Desafio de hoje completo! 🎉"
                  : "Seu desafio de hoje te espera!"}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-white/85">
                🔥 {journey.streak} {journey.streak === 1 ? "dia seguido" : "dias seguidos"} · 📚
                lições e figurinhas no caminho
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-fuchsia-600 shadow-md transition-transform duration-300 group-hover:scale-105">
              Jogar
            </span>
          </div>
        </button>
      )}

      {/* ── Marco da semana: o app INICIA o cuidado (proatividade) ──── */}
      {gest &&
        (() => {
          const m = milestoneForWeek(gest.weeks);
          if (!m) return null;
          return (
            <button
              onClick={() => onNavigate(m.tab)}
              className="shine group w-full rounded-3xl border border-primary/25 bg-primary/6 text-left shadow-[var(--shadow-card)] transition-all duration-300 active:scale-[0.98] hover:border-primary/40 hover:bg-primary/10"
            >
              <div className="flex items-center gap-3.5 px-4 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-2xl ring-1 ring-primary/20">
                  {m.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    Marco da semana {gest.weeks}
                  </p>
                  <p className="mt-0.5 text-[14px] font-bold leading-tight text-foreground">
                    {m.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.text}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })()}

      {/* ── Próxima consulta (#10) ──────────────────────────────────── */}
      {nextAppointment ? (
        <button
          onClick={() => onNavigate("Consultas")}
          className="shine group w-full rounded-3xl border border-primary/20 bg-primary/6 text-left transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98] hover:border-primary/35 hover:bg-primary/10 shadow-[var(--shadow-card)]"
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
          className="shine group w-full rounded-3xl border border-primary/12 bg-primary/5 text-left transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98] hover:border-primary/25 hover:bg-primary/8"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15 text-primary transition-transform duration-300 group-hover:scale-105">
              <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Minhas consultas</p>
              <p className="text-xs text-muted-foreground">Agende ou acompanhe suas consultas</p>
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
          {GRID.map(({ Icon, label, tab, color }, i) => {
            const isHeartIcon = Icon === Heart;
            return (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                style={{ animationDelay: `${i * 45}ms` }}
                className="card-3d fade-slide-up spotlight-card group flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card p-2.5 hover:border-primary/30"
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
        className="shine group w-full rounded-3xl border border-border bg-card overflow-hidden text-left shadow-[var(--shadow-card)] transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98]"
      >
        <div className="flex items-center gap-4 p-4">
          <img
            src={portrait}
            alt={DOCTOR.name}
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary transition-all duration-200 hover:bg-primary/15 active:scale-95"
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
