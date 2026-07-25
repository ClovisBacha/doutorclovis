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
  Baby,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  HelpCircle,
  LifeBuoy,
  Heart,
  Menu,
  MessageCircle,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { DOCTOR } from "@/lib/doctor.config";
import { BabyIllustration } from "@/components/baby-illustration";
import { SkyLayers, gradientFor, periodFor } from "@/components/weather-sky";
import skyManha from "@/assets/sky/manha.webp";
import skyDia from "@/assets/sky/dia.webp";
import skyEntardecer from "@/assets/sky/entardecer.webp";
import skyNoite from "@/assets/sky/noite.webp";
import skyMadrugada from "@/assets/sky/madrugada.webp";
import { babyForWeek, retaFinalMensagem } from "@/lib/gestacao";
import { hapticTap } from "@/lib/haptics";

/* ================================================================
   Tipos
   ================================================================ */

export type AppTab =
  | "Bebê"
  | "Caminho"
  | "Calendário"
  | "Registros"
  | "Saúde"
  | "Nutrição"
  | "Bem-estar"
  | "Alertas"
  | "Consultas"
  | "Acompanhante"
  | "FAQ"
  | "Carteirinha"
  | "Pós-parto"
  | "Recompensas"
  | "Saúde da mulher"
  | "Médico"
  | "Chat IA"
  | "Perfil"
  | "Exames";

// Barra de baixo enxuta (5 = Bebê + Jogo + Chat + Saúde + SOS). O "Bebê" é a
// tela principal (imagem + infos + grade de atalhos pra tudo). Jogo e Chat são
// destino de 1 toque; SOS continua como botão vermelho à parte (onEmergency).
export type BottomSection = "home" | "jogo" | "chat" | "saude";

const SECTION_TABS: Record<BottomSection, readonly AppTab[]> = {
  home: [],
  jogo: ["Caminho"],
  chat: ["Chat IA"],
  saude: ["Saúde", "Exames", "Nutrição", "Bem-estar", "Alertas", "Saúde da mulher"],
};

/**
 * Seção da barra de baixo correspondente à aba aberta — ou `null` quando a aba
 * é uma tela FILHA do hub (Calendário, Registros, Médico, FAQ…). Antes essas
 * telas devolviam "home" e acendiam a pílula "Bebê" com outra tela aberta, o
 * que confundia: o indicador dizia "você está no Bebê" fora do Bebê.
 */
export function tabToSection(t: AppTab): BottomSection | null {
  for (const [section, tabs] of Object.entries(SECTION_TABS) as [
    BottomSection,
    readonly AppTab[],
  ][]) {
    if ((tabs as string[]).includes(t)) return section;
  }
  return null;
}

/** Abas de uma seção do menu de baixo (uma barra só no celular). */
export function tabsForSection(section: BottomSection | null): readonly AppTab[] {
  return section ? SECTION_TABS[section] : [];
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

// Cada ícone com sua cor própria (sempre colorido, não só quando ativo) — deixa
// a barra mais divertida. `pill` é o fundo da mesma cor quando a aba está ativa.
const NAV_ITEMS: {
  id: BottomSection;
  Icon: LucideIcon;
  label: string;
  color: string;
  pill: string;
}[] = [
  // Ordem visual pedida (após o SOS, que é renderizado antes): Saúde · Bebê ·
  // Jogo · Chat. Com o SOS na frente fica: SOS · Saúde · Bebê · Jogo · Chat.
  {
    id: "saude",
    Icon: Heart,
    label: "Saúde",
    color: "text-emerald-500",
    pill: "bg-emerald-500/15",
  },
  { id: "home", Icon: Baby, label: "Bebê", color: "text-pink-500", pill: "bg-pink-500/15" },
  {
    id: "jogo",
    Icon: Gamepad2,
    label: "Jogo",
    color: "text-fuchsia-500",
    pill: "bg-fuchsia-500/15",
  },
  { id: "chat", Icon: MessageCircle, label: "Chat", color: "text-sky-500", pill: "bg-sky-500/15" },
];

export function AppBottomNav({
  activeSection,
  onSelect,
  onEmergency,
}: {
  activeSection: BottomSection | null;
  onSelect: (s: BottomSection) => void;
  onEmergency?: () => void;
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
        {/* SOS no extremo ESQUERDO (pedido do usuário) — vermelho, sempre visível. */}
        {onEmergency && (
          <button
            onClick={() => {
              hapticTap();
              onEmergency();
            }}
            aria-label="Emergência"
            className="flex min-w-0 flex-1 flex-col items-center py-1 transition-colors duration-200"
          >
            <div
              className={`flex items-center justify-center rounded-full transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                compact ? "h-9 w-9" : "h-9 w-12"
              }`}
            >
              <LifeBuoy className="h-5 w-5 text-rose-500" strokeWidth={1.9} />
            </div>
            <span
              className={`overflow-hidden text-[10px] font-medium text-rose-500 transition-all duration-300 ${
                compact ? "max-h-0 opacity-0" : "mt-0.5 max-h-4 opacity-100"
              }`}
            >
              SOS
            </span>
          </button>
        )}

        {NAV_ITEMS.map(({ id, Icon, label, color, pill }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => {
                hapticTap();
                onSelect(id);
              }}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className="flex min-w-0 flex-1 flex-col items-center py-1 transition-colors duration-200"
            >
              {/* Pill de fundo — na cor do ícone, expande com mola quando ativa */}
              <div
                key={active ? "on" : "off"}
                className={`flex items-center justify-center rounded-full transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                  compact ? "h-9 w-9" : "h-9 w-12"
                } ${active ? `pop-in ${pill} scale-105` : "scale-100"}`}
              >
                {/* Ícone SEMPRE colorido (mais divertido); cresce um tico quando ativo */}
                <Icon
                  className={`h-5 w-5 transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${color} ${
                    active ? "scale-110" : "scale-100"
                  }`}
                  strokeWidth={active ? 2.6 : 2.1}
                />
              </div>
              <span
                className={`overflow-hidden text-[10px] transition-all duration-300 ${
                  compact ? "max-h-0 opacity-0" : "mt-0.5 max-h-4 opacity-100"
                } ${active ? `${color} font-bold` : "font-medium text-muted-foreground"}`}
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
  /** Sub-aba do hub de Consultas em que o marco deve abrir (ex.: "parto"). */
  sub?: string;
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
    tab: "Registros",
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
    tab: "Registros",
  },
  {
    min: 31,
    max: 33,
    icon: "📋",
    title: "Hora de montar o plano de parto",
    text: "Registre suas preferências e converse com seu médico na próxima consulta.",
    tab: "Consultas",
    sub: "parto",
  },
  {
    min: 34,
    max: 36,
    icon: "🧳",
    title: "Prepare a mala da maternidade",
    text: "O checklist completo te guia peça por peça — deixe pronta até a semana 36.",
    tab: "Consultas",
    sub: "checklist",
  },
  {
    min: 37,
    max: 42,
    icon: "⏱️",
    title: "Reta final: conheça os sinais do trabalho de parto",
    text: "Registre as contrações — padrão 5-1-1 é hora de ir para a maternidade.",
    tab: "Registros",
  },
];

function milestoneForWeek(weeks: number) {
  return WEEK_MILESTONES.find((m) => weeks >= m.min && weeks <= m.max) ?? null;
}

export type NextAppointment = { dateLabel: string; typeLabel: string };

// Grade de atalhos na tela do Bebê — o hub central. Cobre tudo que NÃO está na
// barra de baixo (Saúde/Exames/Nutrição etc. já são alcançados pelo ícone Saúde).
/** "Bom dia" / "Boa tarde" / "Boa noite" pela hora local. */
function dayGreetingLabel(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** dd/mm/aaaa a N dias de hoje (N negativo = passado). Só para exibição. */
function dateOffsetLabel(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("pt-BR");
}

/**
 * Véu de sonho do tema V1: leva o gradiente de céu à paleta lavanda→rosa→
 * pêssego do conceito. A opacidade CRESCE para a base porque lá o céu diurno
 * é azul-esverdeado claro e, com véu fraco, o pêssego virava oliva.
 * No tema V2 (arte) o véu não entra — a foto já traz a atmosfera pronta.
 */
const DREAM_VEIL =
  "linear-gradient(180deg, rgba(183,158,255,0.66) 0%, rgba(247,176,213,0.62) 38%," +
  " rgba(255,193,158,0.74) 72%, rgba(255,224,199,0.82) 100%)";

/** Tema do céu da home. V2 = arte por período; V1 = o gradiente original. */
export type SkyThemeId = "v2" | "v1";

/** Arte de fundo de cada momento do dia (tema V2). */
const SKY_ART: Record<ReturnType<typeof periodFor>, string> = {
  madrugada: skyMadrugada,
  manha: skyManha,
  dia: skyDia,
  entardecer: skyEntardecer,
  noite: skyNoite,
};

export function AppHomeScreen({
  firstName,
  babyName,
  gest,
  onNavigate,
  onOpenMenu,
  nextAppointment,
  babyTone = 0,
  careMode = false,
  skyTheme = "v2",
}: {
  firstName: string;
  babyName: string | null;
  gest: GestInfo;
  /** `sub` abre direto numa sub-aba do destino (ex.: Consultas → "parto"). */
  onNavigate: (tab: AppTab, sub?: string) => void;
  /** Abre o menu (☰ do topo): perfil, painel e sair. */
  onOpenMenu?: () => void;
  nextAppointment?: NextAppointment | null;
  /** Tom de pele do bebê (índice na paleta BABY_TONES). */
  babyTone?: number;
  /** Modo Cuidado: silencia contagem, tamanho do bebê, streak e desafio. */
  careMode?: boolean;
  /** Tema do céu: "v2" (arte, padrão) ou "v1" (gradiente, comprado na Loja). */
  skyTheme?: SkyThemeId;
}) {
  const baby = gest ? babyForWeek(gest.weeks) : null;
  const progress = gest ? Math.min(100, (gest.totalDays / 280) * 100) : null;
  const daysLeft = gest ? Math.max(0, 280 - gest.totalDays) : null;
  // Reta final (40s+): substitui "É hoje!/Parto em 0 dias" perpétuo por acolhimento.
  const reta = gest ? retaFinalMensagem(gest.weeks) : null;
  const trimestre = gest
    ? gest.weeks < 14
      ? "1º trimestre"
      : gest.weeks < 28
        ? "2º trimestre"
        : "3º trimestre"
    : null;
  const weather = useWeather();

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
  const heroLabel = darkSky ? "text-white/60" : "text-primary";

  const artTheme = skyTheme !== "v1";

  /* Vidro dos cartões. O conceito é um céu claro com cartões brancos; à noite
     o céu escurece e o mesmo branco cegaria — então o vidro inverte e o texto
     acompanha, mantendo o desenho e o contraste nos dois céus.

     Sobre a ARTE o vidro fecha mais: a foto tem contraste local (uma faixa de
     pôr do sol acesa bem atrás de um cartão) que o gradiente liso não tem, e
     com o vidro aberto o texto sumia justamente ali. */
  const glassBg = darkSky
    ? artTheme
      ? "rgba(22,20,36,0.56)"
      : "rgba(255,255,255,0.13)"
    : artTheme
      ? "rgba(255,255,255,0.82)"
      : "rgba(255,255,255,0.72)";
  const glass: React.CSSProperties = {
    background: glassBg,
    backdropFilter: "blur(22px) saturate(170%)",
    WebkitBackdropFilter: "blur(22px) saturate(170%)",
    border: `1px solid ${darkSky ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.85)"}`,
    boxShadow: darkSky
      ? "inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 30px -14px rgba(0,0,0,0.5)"
      : "inset 0 1px 0 rgba(255,255,255,0.95), 0 12px 32px -16px rgba(120,80,90,0.45)",
  };
  const cardText = darkSky ? "text-white" : "text-foreground";
  const cardMuted = darkSky ? "text-white/60" : "text-muted-foreground";
  /* Nome e etiqueta ficam SOBRE o céu, sem cartão atrás. Na arte isso pede
     sombra: o fundo atrás deles muda de luminosidade ao longo do dia. */
  const overArt: React.CSSProperties = artTheme
    ? { textShadow: darkSky ? "0 2px 10px rgba(0,0,0,0.55)" : "0 1px 6px rgba(255,255,255,0.65)" }
    : {};

  return (
    <div className="space-y-4 pb-2">
      {/* ── Hero imersivo: céu real do momento + bebê + clima ────────
          Full-bleed nas laterais (-mx-5 cancela o px-5 da página) e puxado
          para cima (-mt-2). Retângulo reto — sem cantos arredondados, o céu
          encosta nas quatro bordas para máxima imersão no celular. */}
      <div
        className="shine relative -mx-5 -mt-2 flex min-h-[100svh] flex-col overflow-hidden px-5 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] transition-[background] duration-1000"
        style={{ background: gradientFor(period, weather?.code ?? 1) }}
      >
        {/* Arte do momento do dia (tema V2). Fica ACIMA do gradiente, que
            continua atrás como cor de espera enquanto a imagem carrega —
            assim nunca há um flash branco. `cover` recorta as sobras: a arte
            é vertical, então em telas largas sobra em cima e embaixo, e é lá
            que mora só céu. */}
        {artTheme && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{ backgroundImage: `url(${SKY_ART[period]})` }}
          />
        )}

        {/* Céu vivo (sol/lua, estrelas, nuvens, chuva) só no tema V1: sobre a
            arte ele brigaria com as nuvens já pintadas nela. */}
        {!artTheme && (
          <SkyLayers
            code={weather?.code ?? 1}
            isDark={period === "madrugada" || period === "noite"}
            mini
            period={period}
          />
        )}

        {/* Véu pastel: só no V1 e só no céu claro — à noite lavaria o escuro
            e as estrelas sumiriam. */}
        {!artTheme && !darkSky && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: DREAM_VEIL }}
          />
        )}

        <div className="relative flex flex-1 flex-col">
          {/* ── Barra de topo flutuante: menu + clima ─────────────── */}
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => {
                hapticTap();
                onOpenMenu?.();
              }}
              aria-label="Menu"
              className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={glass}
            >
              <Menu className={`h-5 w-5 ${cardText}`} strokeWidth={2.2} />
            </button>

            {weather && (
              <div
                className="flex items-center gap-2.5 rounded-3xl px-3.5 py-2"
                style={glass}
                aria-label={`${weather.temp} graus, ${weather.condition}`}
              >
                <span className="text-2xl leading-none">{weather.emoji}</span>
                <div className="leading-tight">
                  <p className={`text-[15px] font-extrabold ${cardText}`}>{weather.temp}°C</p>
                  <p className={`text-[10px] font-medium ${cardMuted}`}>{weather.condition}</p>
                </div>
              </div>
            )}
          </div>

          {isMadrugada && (
            <p className="mt-3 text-[11px] text-white/65">
              🌙 Madrugada — tente descansar um pouco
            </p>
          )}

          {gest && baby ? (
            <>
              {/* Nome do bebê — protagonista, logo abaixo da barra */}
              {babyName && (
                <div className="mt-4 text-center" style={overArt}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${heroLabel}`}>
                    Acompanhando
                  </p>
                  <p
                    className={`mt-0.5 font-serif text-[clamp(1.6rem,7.4vw,2.2rem)] font-bold leading-none ${heroText}`}
                  >
                    {babyName} <span className="align-middle text-[0.8em]">💜</span>
                  </p>
                </div>
              )}

              {/* Pílulas: trimestre + contagem regressiva, centralizadas */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <span
                  className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${cardText}`}
                  style={glass}
                >
                  🤰 {trimestre}
                </span>
                {careMode ? null : reta ? (
                  <span
                    className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${cardText}`}
                    style={glass}
                  >
                    💛 {reta.eyebrow}
                  </span>
                ) : (
                  daysLeft != null && (
                    <span
                      className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${cardText}`}
                      style={glass}
                    >
                      {daysLeft === 0 ? "🎉 É hoje!" : `📅 Parto em ${daysLeft} dias`}
                    </span>
                  )
                )}
              </div>

              {/* Bebê protagonista dentro de um halo de luz (o "ventre").
                  Toque abre a aba do Bebê com a semana detalhada. */}
              <button
                onClick={() => onNavigate("Bebê")}
                aria-label="Ver a semana do bebê"
                className="relative flex min-h-0 flex-1 items-center justify-center py-2 transition-transform active:scale-[0.97]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute h-[min(19rem,36svh)] w-[min(17rem,32svh)] rounded-[50%]"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(255,255,255,0.55) 0%," +
                      " rgba(255,232,240,0.34) 52%, rgba(255,255,255,0) 78%)",
                    filter: "blur(2px)",
                  }}
                />
                {/* Altura e largura EXPLÍCITAS: a className cai no <svg>, cujo
                    pai (dentro de BabyIllustration) não tem altura — com
                    `h-full` o SVG resolvia contra `auto` e virava 0px, ou seja,
                    o bebê sumia da tela. `min()` encolhe em aparelho curto sem
                    depender da altura do pai. */}
                <BabyIllustration
                  week={gest.weeks}
                  tone={babyTone}
                  showSac={false}
                  showInfo={false}
                  className="float-slow relative h-[min(16rem,30svh)] w-[min(16rem,30svh)] drop-shadow-[0_18px_44px_rgba(120,70,90,0.28)]"
                />
              </button>

              {/* ── Cartão da semana + medidas ─────────────────────── */}
              <div className="mt-1 rounded-[26px] px-4 pb-3 pt-4" style={glass}>
                <p
                  className={`text-center leading-none ${cardText}`}
                  style={{
                    fontFamily: "'Nunito', system-ui, sans-serif",
                    fontSize: "clamp(2.2rem, 10vw, 3rem)",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    fontVariantNumeric: "tabular-nums lining-nums",
                  }}
                >
                  {gest.weeks}
                </p>
                <p className={`mt-0.5 text-center text-[13px] font-semibold ${cardMuted}`}>
                  {gest.weeks === 1 ? "semana" : "semanas"}
                  {gest.days > 0 && ` e ${gest.days} ${gest.days === 1 ? "dia" : "dias"}`}
                </p>

                {/* Medidas da semana (silenciadas no Modo Cuidado) */}
                {!careMode && (
                  <>
                    {/* Divisor com coração — o mesmo traço do conceito */}
                    <div className="mt-2 flex items-center gap-2" aria-hidden>
                      <span
                        className="h-px flex-1"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${darkSky ? "rgba(255,255,255,0.3)" : "rgba(180,140,150,0.4)"})`,
                        }}
                      />
                      <span className="text-sm">💗</span>
                      <span
                        className="h-px flex-1"
                        style={{
                          background: `linear-gradient(90deg, ${darkSky ? "rgba(255,255,255,0.3)" : "rgba(180,140,150,0.4)"}, transparent)`,
                        }}
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-3">
                      {[
                        { emoji: "📏", value: baby.size, label: "Comprimento" },
                        { emoji: "⚖️", value: baby.weight, label: "Peso" },
                        { emoji: "🍅", value: baby.fruit, label: "Tamanho" },
                      ].map((s, i) => (
                        <div
                          key={s.label}
                          className={`flex flex-col items-center px-1 ${i < 2 ? "border-r" : ""}`}
                          style={{
                            borderColor: darkSky
                              ? "rgba(255,255,255,0.16)"
                              : "rgba(150,110,120,0.16)",
                          }}
                        >
                          <span className="text-xl leading-none">{s.emoji}</span>
                          <p
                            className={`mt-1 text-[13px] font-extrabold leading-tight ${cardText}`}
                          >
                            {s.value}
                          </p>
                          <p className={`text-[9px] font-medium ${cardMuted}`}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ── Cartão de progresso: início · % · parto previsto ── */}
              <div className="mt-2.5 rounded-[22px] px-4 py-3" style={glass}>
                <div className="flex items-end justify-between gap-2">
                  <div className="text-left">
                    <p className={`text-[10px] font-medium ${cardMuted}`}>Início</p>
                    <p className={`text-[11px] font-bold ${cardText}`}>
                      {dateOffsetLabel(-(gest.totalDays ?? 0))}
                    </p>
                  </div>
                  <p className={`pb-0.5 text-[11px] font-bold ${cardMuted}`}>
                    {Math.round(progress ?? 0)}% concluído
                  </p>
                  <div className="text-right">
                    <p className={`text-[10px] font-medium ${cardMuted}`}>Parto previsto</p>
                    <p className={`text-[11px] font-bold ${cardText}`}>
                      {dateOffsetLabel(daysLeft ?? 0)}
                    </p>
                  </div>
                </div>
                {/* Trilho com o coração na posição de hoje */}
                <div className="relative mt-2.5 h-2.5">
                  <div
                    className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
                    style={{
                      background: darkSky ? "rgba(255,255,255,0.18)" : "rgba(150,110,130,0.16)",
                    }}
                  />
                  <div
                    className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full transition-all duration-700"
                    style={{
                      width: `${progress ?? 0}%`,
                      background: "linear-gradient(90deg, #c4b5fd, #a855f7)",
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] shadow-md transition-all duration-700"
                    style={{ left: `${progress ?? 0}%`, background: "#fff" }}
                  >
                    💜
                  </span>
                </div>
              </div>

              {/* ── Saudação do dia com a dica do clima ─────────────── */}
              {weather && (
                <div
                  className="mt-2.5 flex items-start gap-3 rounded-[22px] px-4 py-3"
                  style={glass}
                >
                  <span className="mt-0.5 text-xl leading-none">{weather.tipEmoji}</span>
                  <div className="min-w-0">
                    <p className={`text-[14px] font-extrabold ${cardText}`}>
                      {dayGreetingLabel()}
                      {babyName ? `, ${babyName}!` : "!"}
                    </p>
                    <p className={`mt-0.5 text-[12px] leading-snug ${cardMuted}`}>{weather.tip}</p>
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

      {/* ── Marco da semana (silenciado no Modo Cuidado) ──── */}
      {gest &&
        !careMode &&
        (() => {
          const m = milestoneForWeek(gest.weeks);
          if (!m) return null;
          return (
            <button
              onClick={() => onNavigate(m.tab, m.sub)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-left transition-colors duration-300 active:scale-[0.99] hover:border-primary/35 hover:bg-primary/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-lg ring-1 ring-primary/15">
                {m.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/80">
                  Semana {gest.weeks}
                </p>
                <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                  {m.title}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-primary/60 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          );
        })()}

      {/* ── Meu calendário (consultas + marcos, tudo integrado dentro) ── */}
      <button
        onClick={() => onNavigate("Calendário")}
        className="shine group w-full rounded-3xl border border-primary/20 bg-primary/6 text-left shadow-[var(--shadow-card)] transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98] hover:border-primary/35 hover:bg-primary/10"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/20 transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-hover:scale-105 group-hover:-rotate-3">
            <CalendarDays className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Meu calendário
            </p>
            {nextAppointment ? (
              <>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  Próxima consulta · {nextAppointment.dateLabel}
                </p>
                <p className="text-xs text-muted-foreground">{nextAppointment.typeLabel}</p>
              </>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-foreground">
                Consultas, exames e marcos — tudo aqui
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary/50 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </button>

      {/* ── Registros (uso diário: diário, chutes, contrações) ── */}
      <button
        onClick={() => onNavigate("Registros")}
        className="shine group w-full rounded-3xl border border-primary/15 bg-primary/5 text-left transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98] hover:border-primary/30 hover:bg-primary/8"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-200">
            <NotebookPen className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Registros</p>
            <p className="text-xs text-muted-foreground">Diário, chutes e contrações</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary/40 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </button>

      {/* ── Pós-parto: aparece só na reta final (a partir da semana 36) ── */}
      {gest && gest.weeks >= 36 && !careMode && (
        <button
          onClick={() => onNavigate("Pós-parto")}
          className="shine group w-full rounded-3xl border border-rose-200 bg-rose-50/60 text-left transition-all duration-300 active:scale-[0.98] hover:bg-rose-50"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 ring-1 ring-rose-200">
              <Heart className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Pós-parto</p>
              <p className="text-xs text-muted-foreground">
                Cuidados com você e o bebê depois do parto
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-rose-400 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </button>
      )}

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

      {/* ── Rodapé discreto: Ajuda/FAQ (baixa frequência, fora da grade) ── */}
      <button
        onClick={() => onNavigate("FAQ")}
        className="mx-auto flex items-center gap-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Dúvidas frequentes
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
