/**
 * Componentes da experiência mobile do app autenticado:
 *   - AppBottomNav   – barra inferior com 5 abas e indicador pill ativo (#5)
 *   - AppHomeScreen  – dashboard com clima em tempo real, semana Apple Fitness,
 *                      modo madrugada, próxima consulta e coração pulsante (#6–10)
 *
 * Clima via Open-Meteo (gratuito, sem API key) com recomendações para gestantes.
 */
import { useState, useEffect } from "react";
import {
  Baby,
  ChevronRight,
  Gamepad2,
  LifeBuoy,
  Heart,
  UserRound,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { DOCTOR } from "@/lib/doctor.config";
import { BabyIllustration } from "@/components/baby-illustration";
import { SkyAmbience } from "@/components/sky-ambience";
import { SkyRain, forcaDaChuva } from "@/components/sky-rain";
import { SkyLayers, gradientFor, periodFor } from "@/components/weather-sky";
import skyManha from "@/assets/sky/manha.webp";
import skyMeioDia from "@/assets/sky/meio-dia.webp";
import skyTarde from "@/assets/sky/tarde.webp";
import skyGolden from "@/assets/sky/golden-hour.webp";
import skyEntardecer from "@/assets/sky/entardecer.webp";
/* `noite.webp` sai do bundle: a arte dele é crepúsculo, não noite — ver o
   comentário na tabela SKY_SLOTS. O arquivo continua no repositório. */
import skyMadrugada from "@/assets/sky/madrugada.webp";
import skyPreAmanhecer from "@/assets/sky/pre-amanhecer.webp";
import skyAmanhecer from "@/assets/sky/amanhecer.webp";
import skyAnoitecer from "@/assets/sky/anoitecer.webp";
import { babyForWeek, fruitEmojiForWeek } from "@/lib/gestacao";
import { hapticTap } from "@/lib/haptics";
import { barraDeStatus } from "@/lib/nativo";
import { getApproxLocation } from "@/lib/local.functions";

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
  /** Chuva da hora anterior, em mm. Só desempata a trovoada (ver forcaDaChuva). */
  mm: number;
  /* Nascer e pôr do sol NA LOCALIZAÇÃO da pessoa — é o que permite o céu do
     app seguir o céu de verdade em vez do relógio. `null` quando a API não
     respondeu, ou nos polos, onde o sol pode não nascer no dia. */
  sunrise: Date | null;
  sunset: Date | null;
};

function wmoToInfo(code: number, isDay = true): { condition: string; emoji: string } {
  // Céu limpo e pouca nuvem mudam de cara à noite. Um ☀️ às 19h29 — que foi
  // o que a paciente viu na tela — é simplesmente errado.
  if (code === 0) return { condition: "Céu limpo", emoji: isDay ? "☀️" : "🌙" };
  if (code === 1) return { condition: "Predominante claro", emoji: isDay ? "🌤️" : "🌙" };
  if (code === 2) return { condition: "Parcialmente nublado", emoji: isDay ? "⛅" : "☁️" };
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
    return { tipEmoji: "⛈️", tip: "Fique em casa hoje — bom momento para ouvir os batimentos." };
  if (code >= 80)
    return {
      tipEmoji: "🌧️",
      tip: "Relaxe com música calma para vocês duas.",
    };
  if (code >= 61) return { tipEmoji: "🌧️", tip: "Chá quentinho e descanso fazem muito bem." };
  if (code >= 51)
    return {
      tipEmoji: "🌦️",
      tip: "Um bom livro sobre maternidade combina com o dia.",
    };
  if (code >= 45)
    return { tipEmoji: "🌫️", tip: "Prefira ficar dentro de casa; meditação guiada cai bem." };
  if (temp > 35) return { tipEmoji: "🥵", tip: "Ambiente climatizado e água a cada 30 minutos." };
  if (temp > 30)
    return { tipEmoji: "☀️", tip: "Hidrate-se bastante e use protetor FPS 50+ se sair." };
  if (code === 3) return { tipEmoji: "☁️", tip: "Ótimo para uma caminhada leve de 20 minutos." };
  if (code === 2) return { tipEmoji: "⛅", tip: "Clima agradável para uma saída curta." };
  if (code <= 1 && temp > 22)
    return { tipEmoji: "☀️", tip: "Dia lindo! Caminhada de manhã com protetor FPS 50+ e chapéu." };
  if (code <= 1) return { tipEmoji: "🌤️", tip: "Perfeito para respirar ar fresco. Beba água!" };
  if (temp < 10)
    return { tipEmoji: "🧣", tip: "Agasalhe bem a barriga e prefira ficar dentro de casa." };
  if (temp < 15) return { tipEmoji: "🧥", tip: "Vista camadas e cuide da barriga." };
  return { tipEmoji: "🌸", tip: "Momento perfeito para descansar com o bebê." };
}

/** De onde saiu a localização usada — o app conta isso para a paciente. */
export type OrigemLocal = {
  /** gps = onde ela está agora · cadastro = onde ela mora · aprox = IP · padrao = clínica */
  tipo: "gps" | "cadastro" | "aprox" | "padrao";
  cidade: string | null;
};

/**
 * O CÉU DE AGORA — uma fonte só para o app inteiro.
 *
 * Existe porque a tela do jogo precisa mostrar exatamente o mesmo céu da home,
 * e "exatamente" só se garante compartilhando a decisão, não copiando-a: duas
 * cópias da mesma regra divergem no primeiro ajuste que alguém fizer numa
 * delas. Aqui as duas telas leem o MESMO slot, do MESMO arquivo, escolhido
 * pela MESMA conta de nascer/pôr do sol.
 *
 * Devolve `agora` como null até montar: no SSR o relógio é o do servidor (UTC
 * na Vercel) e a hidratação não corrige isso, então quem abrisse às 8h podia
 * ver o céu da noite.
 */
export function useSkyNow(homeCity?: { nome: string; lat: number; lon: number } | null) {
  const { weather, origem } = useWeather(homeCity);
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setAgora(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const slot = agora
    ? skySlotForSun(agora, weather?.sunrise ?? null, weather?.sunset ?? null)
    : skySlotFor(12);
  return { agora, weather, origem, slot, darkSky: slot.dark };
}

function useWeather(
  cidadeCadastro?: {
    nome: string;
    lat: number;
    lon: number;
  } | null,
): { weather: WeatherState | null; origem: OrigemLocal | null } {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [origemLocal, setOrigemLocal] = useState<OrigemLocal | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function load(lat: number, lon: number) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${lat.toFixed(4)}` +
            `&longitude=${lon.toFixed(4)}` +
            // `is_day` conserta o sol às 19h; `daily=sunrise,sunset` é o que
            // deixa o céu do app seguir o céu de verdade. Os dois vêm na MESMA
            // requisição que já existia — sem chamada extra, sem permissão nova.
            `&current=temperature_2m,weather_code,is_day,precipitation` +
            `&daily=sunrise,sunset` +
            `&timezone=auto&forecast_days=1`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          current: {
            temperature_2m: number;
            weather_code: number;
            is_day?: number;
            precipitation?: number;
          };
          daily?: { sunrise?: (string | null)[]; sunset?: (string | null)[] };
        };
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const isDay = data.current.is_day !== 0;
        const mm = Number(data.current.precipitation) || 0;
        const { condition, emoji } = wmoToInfo(code, isDay);
        const overlay = weatherOverlay(code, temp);
        const { tip, tipEmoji } = weatherTip(code, temp);
        // Com `timezone=auto` a API devolve "2026-07-26T17:38" SEM fuso, e o
        // JS lê isso como hora local do aparelho. É exatamente o que queremos:
        // quem está em São Paulo tem o aparelho no fuso de São Paulo.
        const parseHora = (t?: string | null) => {
          if (!t) return null;
          const d = new Date(t);
          return Number.isNaN(d.getTime()) ? null : d;
        };
        const sunrise = parseHora(data.daily?.sunrise?.[0]);
        const sunset = parseHora(data.daily?.sunset?.[0]);
        if (!cancelled)
          setWeather({ temp, code, condition, emoji, overlay, tip, tipEmoji, mm, sunrise, sunset });
      } catch {
        /* clima é enhancement — falha silenciosa */
      }
    }

    /* ── De onde vem a localização, em ordem de prioridade ──────────
       O céu, o clima e a chuva do app são a janela da paciente. Se o lugar
       estiver errado, TUDO mente junto: sol às 19h, entardecer em plena
       noite, chuva na tela num dia seco.

       1. GPS          — o dado real. Sempre vence, e assume assim que chega.
       2. IP da borda  — aproximado por cidade, de graça e instantâneo.
       3. Clínica (BH) — último recurso, para a tela nunca ficar vazia.

       A ordem de EXECUÇÃO é o contrário da de prioridade, e é isso que
       conserta o buraco: começa pelo aproximado, que responde na hora, e
       troca pelo GPS quando (e se) ele chegar. Antes o app pedia o GPS e
       ficava parado esperando — quem apenas IGNORA a caixa de permissão não
       dispara callback nenhum, então a tela passava até 8s sem clima e com o
       céu na faixa errada. */
    const CLINICA = { lat: -19.9167, lon: -43.9345 };
    let temGps = false;

    async function pisoAproximado() {
      // A cidade do cadastro ganha do IP: o IP erra em VPN, em viagem e quando
      // a operadora roteia por outro estado — e nesses casos a paciente
      // continua morando onde sempre morou. Também poupa a ida ao servidor.
      if (cidadeCadastro) {
        setOrigemLocal({ tipo: "cadastro", cidade: cidadeCadastro.nome });
        void load(cidadeCadastro.lat, cidadeCadastro.lon);
        return;
      }
      try {
        const aprox = await getApproxLocation();
        if (cancelled || temGps) return;
        if (aprox) {
          setOrigemLocal({ tipo: "aprox", cidade: aprox.cidade });
          void load(aprox.lat, aprox.lon);
          return;
        }
      } catch {
        /* sem borda (dev, ou provedor sem geo): cai na clínica */
      }
      if (cancelled || temGps) return;
      setOrigemLocal({ tipo: "padrao", cidade: null });
      void load(CLINICA.lat, CLINICA.lon);
    }
    void pisoAproximado();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          temGps = true;
          setOrigemLocal({ tipo: "gps", cidade: null });
          void load(coords.latitude, coords.longitude);
        },
        // Erro/negação/timeout: o piso já está na tela, não há o que fazer.
        () => {},
        { timeout: 8000, maximumAge: 300_000 },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [cidadeCadastro?.lat, cidadeCadastro?.lon, cidadeCadastro?.nome]);
  return { weather, origem: origemLocal };
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

/** Item comum da barra: ícone de contorno na cor do site + rótulo embaixo. */
function NavItem({
  label,
  color,
  compact,
  active = false,
  escura = false,
  onClick,
  Icon,
}: {
  label: string;
  color: string;
  compact: boolean;
  active?: boolean;
  /** Barra escura: o rótulo inverte. O ÍCONE não — a cor dele é significado
      (vermelho = SOS), e os cinco tons já leem sobre o vidro escuro. */
  escura?: boolean;
  onClick: () => void;
  Icon: LucideIcon;
}) {
  return (
    <button
      onClick={() => {
        hapticTap();
        onClick();
      }}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className="flex min-w-0 flex-1 flex-col items-center py-1"
    >
      <Icon
        className={`${color} transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
          compact ? "h-5 w-5" : "h-[22px] w-[22px]"
        } ${active ? "scale-110" : "scale-100"}`}
        strokeWidth={active ? 2.4 : 1.9}
      />
      <span
        className={`overflow-hidden text-[10px] transition-all duration-300 ${
          compact ? "max-h-0 opacity-0" : "mt-1 max-h-4 opacity-100"
        } ${
          active
            ? `${color} font-semibold`
            : escura
              ? "font-medium text-white/70"
              : "font-medium text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function AppBottomNav({
  activeSection,
  onSelect,
  onEmergency,
  escura = false,
}: {
  activeSection: BottomSection | null;
  onSelect: (s: BottomSection) => void;
  onEmergency?: () => void;
  /**
   * Vidro ESCURO. Verdadeiro só na home com céu de noite/madrugada.
   *
   * A barra vive em toda tela do app, e quase todas têm conteúdo claro — por
   * isso o padrão é vidro claro. A exceção é a home à noite: ali o céu é
   * escuro e uma barra clara vira a única coisa acesa da tela, com a foto
   * inteira atrás dela no escuro. Vidro é o que está atrás; quando o que está
   * atrás é noite, o vidro é noite.
   */
  escura?: boolean;
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
      style={{ bottom: "calc(var(--safe-bottom) + 10px)" }}
    >
      {/* Mesma receita de vidro dos cartões da home (`glass` em AppHomeScreen):
          verniz diagonal por cima de uma base clara, desfoque com saturação
          alta atrás, fio de luz na aresta de cima e sombra funda embaixo.
          A base fica em 0,58 e não mais baixa de propósito: esta barra vive
          em TODA tela do app, inclusive as de conteúdo claro e a home de
          madrugada. Vidro fino demais some no branco e escurece na noite —
          e aí o rótulo cinza de "Saúde" perde a leitura. Como no iOS, a
          barra é vidro CLARO: quem diz que é vidro é o desfoque e o fio de
          luz, não a falta de corpo. */}
      <div
        className={`pointer-events-auto flex items-center justify-around rounded-full transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
          compact ? "w-[64%] px-1.5 py-1" : "w-[92%] max-w-md px-2 py-1.5"
        }`}
        style={{
          /* Mesma receita nos dois, só que a base inverte: verniz diagonal,
             desfoque com saturação alta, fio de luz na aresta de cima e sombra
             funda embaixo. No escuro o fio de luz enfraquece — numa barra
             escura ele viraria um risco branco em vez de uma quina acesa. */
          background: escura
            ? "linear-gradient(158deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 48%)," +
              " rgba(26,22,44,0.62)"
            : "linear-gradient(158deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 48%)," +
              " rgba(255,253,252,0.58)",
          backdropFilter: "blur(22px) saturate(185%)",
          WebkitBackdropFilter: "blur(22px) saturate(185%)",
          border: `1px solid ${escura ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.72)"}`,
          boxShadow: escura
            ? "inset 0 1px 0 rgba(255,255,255,0.34)," +
              " inset 0 -14px 30px -20px rgba(0,0,0,0.5)," +
              " 0 12px 34px -14px rgba(0,0,0,0.5)"
            : "inset 0 1px 0 rgba(255,255,255,0.95)," +
              " inset 0 -14px 30px -20px rgba(120,92,110,0.26)," +
              " 0 12px 34px -14px rgba(48,40,60,0.32)",
        }}
      >
        {/* SOS no extremo ESQUERDO — vermelho, sempre visível. */}
        {onEmergency && (
          <NavItem
            label="SOS"
            color="text-rose-500"
            compact={compact}
            escura={escura}
            onClick={onEmergency}
            Icon={LifeBuoy}
          />
        )}

        {NAV_ITEMS.map(({ id, Icon, label, color }) =>
          id === "home" ? (
            /* ── Botão CENTRAL: o Bebê é o destino principal, então vira
               um círculo grande CENTRADO NA BORDA de cima da barra — metade
               dentro, metade fora, como no desenho de referência. O espaçador
               invisível reserva a mesma altura de um item comum para a barra
               não crescer por causa dele. */
            <button
              key={id}
              onClick={() => {
                hapticTap();
                onSelect(id);
              }}
              aria-current={activeSection === id ? "page" : undefined}
              aria-label={label}
              className="relative flex min-w-0 flex-1 flex-col items-center py-1"
            >
              <span aria-hidden className={compact ? "h-5 w-5" : "h-[22px] w-[22px]"} />
              <span
                aria-hidden
                className={`overflow-hidden text-[10px] ${compact ? "max-h-0" : "mt-1 max-h-4"}`}
              />
              <span
                data-nav-center
                className={`absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-pink-500 text-white transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${
                  compact ? "h-11 w-11" : "h-14 w-14"
                } ${activeSection === id ? "scale-105" : "scale-100"}`}
                style={{
                  /* O aro branco existe para o círculo não encostar na barra.
                     Sólido ele virava um disco opaco pousado sobre vidro —
                     lia como adesivo. Translúcido, ele continua separando e
                     deixa o cenário passar, como o resto da barra. */
                  boxShadow: `0 10px 22px -6px rgba(236,72,153,0.55), 0 0 0 5px ${
                    /* O aro separa o círculo da barra. Branco a 62% sobre
                       vidro escuro vira um anel aceso em volta do rosa; no
                       escuro ele precisa ser escuro. */
                    escura ? "rgba(26,22,44,0.55)" : "rgba(255,255,255,0.62)"
                  }`,
                }}
              >
                <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} strokeWidth={2.1} />
              </span>
            </button>
          ) : (
            <NavItem
              key={id}
              label={label}
              color={color}
              compact={compact}
              active={activeSection === id}
              escura={escura}
              onClick={() => onSelect(id)}
              Icon={Icon}
            />
          ),
        )}
      </div>
    </nav>
  );
}

/* ================================================================
   AppHomeScreen
   ================================================================ */

type GestInfo = { weeks: number; days: number; totalDays: number } | null;

/* A tabela de MARCOS POR SEMANA morava aqui e alimentava a faixa
   "SEMANA 20 · Janela do morfológico" no alto da home. A faixa saiu — o mesmo
   conteúdo já é a linha do tempo do pré-natal dentro do Calendário
   (`PRENATAL_MILESTONES`, em minha-conta), com data calculada e tudo, e manter
   duas listas do mesmo assunto significava mantê-las iguais para sempre. */

export type NextAppointment = { dateLabel: string; typeLabel: string };

// Grade de atalhos na tela do Bebê — o hub central. Cobre tudo que NÃO está na
// barra de baixo (Saúde/Exames/Nutrição etc. já são alcançados pelo ícone Saúde).
/**
 * A saudação da hero — agora a ÚNICA do app. A tela do jogo tinha uma cópia
 * dela; saiu de lá (era o mesmo "Boa noite, {bebê}" duas telas seguidas) e as
 * seis faixas que moravam naquela cópia vieram para cá, onde a saudação de
 * fato acontece uma vez só.
 *
 * Todas as faixas são ancoradas no RELÓGIO, e não no momento do céu, de
 * propósito: "bom dia" e "boa tarde" são convenção de relógio em português. O
 * céu chamado "meio-dia" começa às 10h42 em Belo Horizonte no inverno, e
 * amarrar a saudação a ele faria o app dizer "boa tarde" às dez e quarenta.
 *
 * A madrugada ganha frase própria porque quem abre o app às 3h quase sempre
 * está com desconforto ou insônia — não é o mesmo lugar de quem abre às 22h, e
 * "boa noite" nas duas horas trata igual o que não é igual.
 *
 * 05h–07h era um buraco: o céu ainda é noite fechada e a tela dizia "Bom dia".
 * "Amanhecendo" não afirma que o dia chegou nem trata como noite.
 *
 * 18h–20h: "boa noite" às 18h soa cedo e "boa tarde" às 19h30 soa errado.
 * "Boa noitinha" é o que se fala de verdade nessa faixa.
 */
function dayGreetingLabel(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 7) return "Amanhecendo";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  if (h < 20) return "Boa noitinha";
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

/**
 * As artes são SÓ CÉU — a bolha é desenhada aqui (`BabyOrb`), e é por isso que
 * ela fica sempre exatamente centrada no bebê, em qualquer tela, e pode
 * respirar. Na primeira leva a esfera vinha pintada dentro de cada imagem, em
 * posição e tamanho diferentes: o bebê não caía dentro dela em nenhuma, e
 * desenhar outra por cima dava duas esferas cruzadas.
 *
 * Se algum dia entrar uma arte COM esfera pintada, volte para `true` — senão a
 * bolha desenhada aparece por cima da pintada e o defeito volta.
 */
const ART_HAS_ORB = false;

/** A bolha desenhada pelo app: sempre centrada no bebê, com aro e respiração. */
function BabyOrb() {
  return (
    <span
      aria-hidden
      className="dc-orb pointer-events-none absolute rounded-[50%]"
      style={{
        // Presa à faixa do bebê: 94% da altura dela, nunca mais que isso —
        // é o que garante que a bola não toca as pílulas nem o cartão em
        // NENHUMA altura de tela (Safari com barra de endereço incluído).
        // Levemente mais alta que larga: a referência é ovo, não círculo.
        // Preenche a caixa comum; 97% de largura deixa o ovo da referência.
        inset: "0",
        width: "97%",
        height: "100%",
        margin: "auto",
        background: [
          // Brilho ESPECULAR no alto à esquerda: é a marca de esfera de vidro,
          // o ponto onde a fonte de luz se reflete. Sem ele a bolha vira disco.
          "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.55) 0%," +
            " rgba(255,255,255,0.14) 26%, rgba(255,255,255,0) 46%)",
          // Corpo do vidro: claro no miolo, morrendo antes da borda.
          "radial-gradient(circle at 50% 47%, rgba(255,252,254,0.26) 0%," +
            " rgba(255,247,251,0.14) 42%, rgba(255,255,255,0.04) 70%," +
            " rgba(255,255,255,0) 86%)",
          // Contra-luz na base: a parede oposta do vidro devolve luz de volta.
          "radial-gradient(circle at 62% 88%, rgba(255,255,255,0.22) 0%," +
            " rgba(255,255,255,0) 34%)",
        ].join(", "),
        // Véu: dentro da bolha o céu perde nitidez e cor, como atrás de vidro.
        // É o que a faz OCUPAR volume em vez de ser um decalque.
        backdropFilter: "blur(2.5px) saturate(0.88) brightness(1.05)",
        WebkitBackdropFilter: "blur(2.5px) saturate(0.88) brightness(1.05)",
        /* A PAREDE do vidro. A versão anterior deixava o aro em 0.12 para não
           virar "anel desenhado" — o problema real, porém, não era a força do
           aro e sim ele ser uniforme. Aro de espessura igual em toda a volta
           lê como círculo de caneta; vidro tem a parede acesa onde a luz bate
           e apagada no resto. Daí serem três sombras internas direcionais em
           vez de um contorno só. */
        boxShadow: [
          "inset 0 2px 3px -1px rgba(255,255,255,0.75)",
          "inset 6px 10px 22px -14px rgba(255,255,255,0.85)",
          "inset -8px -12px 26px -16px rgba(255,255,255,0.5)",
          "inset 0 0 0 1px rgba(255,255,255,0.20)",
          "0 0 46px 16px rgba(255,246,251,0.16)",
        ].join(", "),
      }}
    />
  );
}

/** Tema do céu da home. V2 = arte por período; V1 = o gradiente original. */
export type SkyThemeId = "v2" | "v1";

/**
 * Arte de fundo por FAIXA DE HORA (tema V2).
 *
 * Escala própria, mais fina que a do gradiente V1 (`periodFor`, 5 períodos):
 * com 5 faixas sobravam saltos de 5 a 7 horas em que o céu não mudava nada. As
 * oito faixas cobrem as transições que a paciente realmente percebe — o
 * primeiro clarão, o sol nascendo, o céu virando depois do pôr do sol.
 *
 * `dark` acompanha a ARTE, não o relógio: o amanhecer é claro apesar de cedo, e
 * o anoitecer é escuro apesar de ainda não ser noite fechada. É esse campo que
 * decide se os cartões usam vidro claro ou escuro.
 */
const SKY_SLOTS: { from: number; to: number; nome: string; src: string; dark: boolean }[] = [
  { from: 0, to: 4, nome: "madrugada", src: skyMadrugada, dark: true },
  { from: 4, to: 6, nome: "pré-amanhecer", src: skyPreAmanhecer, dark: true },
  { from: 6, to: 8, nome: "amanhecer", src: skyAmanhecer, dark: false },
  { from: 8, to: 11, nome: "manhã", src: skyManha, dark: false },
  { from: 11, to: 14, nome: "meio-dia", src: skyMeioDia, dark: false },
  { from: 14, to: 16, nome: "tarde", src: skyTarde, dark: false },
  { from: 16, to: 18, nome: "golden hour", src: skyGolden, dark: false },
  { from: 18, to: 19, nome: "entardecer", src: skyEntardecer, dark: false },
  { from: 19, to: 21, nome: "anoitecer", src: skyAnoitecer, dark: true },
  /* NOITE usa a arte de madrugada, e isso é intencional.
     O arquivo `noite.webp` é, na verdade, uma foto de CREPÚSCULO: tem o brilho
     alaranjado do sol ainda no horizonte. Ele servia enquanto o céu vinha de
     uma tabela de horas, mas a janela da "noite" começa 80 minutos depois do
     pôr do sol e vai até as 4h — às 22h fazia mais de quatro horas que
     escurecera, e o app mostrava o sol se pondo. Era o oposto do que o céu
     ancorado no sol veio prometer.
     Das dez artes, só duas são noite de verdade: `madrugada` (lua alta, via
     láctea) e `pre-amanhecer` (a mesma noite com o primeiro clarão frio no
     horizonte). A segunda não serve às 22h — aquele clarão é o dia chegando.
     Sobra a de madrugada, e ela está certa: entre as 21h e as 4h o céu
     realmente não muda. `noite.webp` fica no repositório como matéria-prima
     caso um dia entre uma arte própria para o começo da noite. */
  { from: 21, to: 24, nome: "noite", src: skyMadrugada, dark: true },
];

/** Só o relógio — o plano B de quando não se sabe onde a pessoa está. */
function skySlotFor(hour: number) {
  const h = Math.max(0, Math.min(23, hour));
  return SKY_SLOTS.find((s) => h >= s.from && h < s.to) ?? SKY_SLOTS[SKY_SLOTS.length - 1];
}

const porNome = (nome: string) => SKY_SLOTS.find((s) => s.nome === nome)!;

/**
 * O céu do app seguindo o CÉU DE VERDADE, ancorado no nascer e no pôr do sol
 * da localização da paciente.
 *
 * O relógio sozinho mente. Às 19h30 de julho, no Brasil, o sol se pôs há
 * quase duas horas e está escuro — mas a tabela de horas fixas mostrava o
 * entardecer alaranjado. Em dezembro, no mesmo 19h30, ainda é dia claro e ela
 * mostraria exatamente a mesma imagem. Uma das duas está sempre errada, e a
 * distância entre elas só cresce quanto mais longe do equador.
 *
 * As janelas do dia são FRAÇÕES da duração do dia, não minutos fixos: num dia
 * de 14h a manhã é mais longa que num de 10h, e é assim que se sente. Já os
 * crepúsculos são minutos fixos, porque a passagem do sol pelo horizonte dura
 * mais ou menos o mesmo tempo em qualquer estação (fora dos polos).
 *
 * "Madrugada" continua sendo a única faixa definida pelo relógio, e de
 * propósito: em português madrugada é a hora pequena da noite, não uma posição
 * do sol. Às 2h da manhã é madrugada mesmo no verão da Noruega.
 */
function skySlotForSun(agora: Date, sunrise: Date | null, sunset: Date | null) {
  if (!sunrise || !sunset) return skySlotFor(agora.getHours());
  const SR = sunrise.getTime();
  const SS = sunset.getTime();
  const t = agora.getTime();
  const dia = SS - SR;
  // Dia degenerado (sol da meia-noite, noite polar, resposta estranha):
  // o relógio erra menos que uma conta em cima de dado ruim.
  if (!(dia > 0) || dia > 22 * 3600_000) return skySlotFor(agora.getHours());

  const min = 60_000;
  const meioDia = SR + dia / 2;
  const bloco = dia * 0.14; // ~1h40 num dia de 12h

  // Antes do primeiro sinal de luz o céu é o mesmo o tempo todo — escuro. Quem
  // separa "noite" de "madrugada" aqui é o relógio, não o sol: às 23h de um dia
  // curto ainda é noite, e às 2h já é madrugada.
  if (t < SR - 90 * min) return porNome(agora.getHours() >= 21 ? "noite" : "madrugada");
  if (t < SR - 25 * min) return porNome("pré-amanhecer");
  if (t < SR + 50 * min) return porNome("amanhecer");
  if (t < meioDia - bloco) return porNome("manhã");
  if (t < meioDia + bloco) return porNome("meio-dia");
  if (t < SS - 90 * min) return porNome("tarde");
  if (t < SS - 25 * min) return porNome("golden hour");
  if (t < SS + 20 * min) return porNome("entardecer");
  if (t < SS + 80 * min) return porNome("anoitecer");
  // Depois disso é noite até o relógio virar para a madrugada.
  return porNome(agora.getHours() < 4 ? "madrugada" : "noite");
}

export function AppHomeScreen({
  firstName,
  babyName,
  gest,
  onNavigate,
  onOpenMenu,
  medico,
  babyTone = 0,
  careMode = false,
  skyTheme = "v2",
  homeCity = null,
  temNaoLidas = false,
  onOrigemLocal,
}: {
  firstName: string;
  babyName: string | null;
  gest: GestInfo;
  /** `sub` abre direto numa sub-aba do destino (ex.: Consultas → "parto"). */
  onNavigate: (tab: AppTab, sub?: string) => void;
  /** Abre o menu da conta (silhueta no topo): notificações, perfil, painel e sair. */
  onOpenMenu?: () => void;
  /** Tom de pele do bebê (índice na paleta BABY_TONES). */
  babyTone?: number;
  /** Modo Cuidado: silencia contagem, tamanho do bebê, streak e desafio. */
  careMode?: boolean;
  /** Tema do céu: "v2" (arte, padrão) ou "v1" (gradiente, comprado na Loja). */
  skyTheme?: SkyThemeId;
  /** Cidade do cadastro, quando preenchida — degrau entre o GPS e o IP. */
  homeCity?: { nome: string; lat: number; lon: number } | null;
  /**
   * O médico DA PACIENTE. Sem isto o cartão "Seu médico" mostrava sempre o
   * `doctor.config` — nome, especialidade, CRM e FOTO do dono da instalação —
   * para quem está vinculada a outro profissional e até para quem não tem
   * médico nenhum. Ela via um rosto que não é o dela rotulado como o dela.
   */
  medico?: { nome: string; title?: string; specialty?: string; crm?: string } | null;
  /** Acende o ponto vermelho na silhueta — há notificação por abrir. */
  temNaoLidas?: boolean;
  /**
   * Conta para fora DE ONDE veio a localização.
   *
   * Existe porque o convite de ativar o GPS deixou de ser um cartão na home e
   * virou notificação, e quem monta a lista de notificações é a página, não
   * esta tela. O dado nasce aqui dentro (`useWeather`), então precisa subir.
   */
  onOrigemLocal?: (origem: OrigemLocal | null) => void;
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
  /* A home lê o céu pelo MESMO hook que a tela do jogo. Antes ela tinha a
     conta própria aqui dentro; agora existe uma só, e as duas telas não têm
     como divergir. */
  const { agora, weather, origem: origemLocal, slot } = useSkyNow(homeCity);
  /* Repassa para a página. Depende do CONTEÚDO e não do objeto: `useWeather`
     devolve um objeto novo a cada render, e comparar por referência dispararia
     o efeito para sempre. */
  const origemChave = origemLocal ? `${origemLocal.tipo}|${origemLocal.cidade ?? ""}` : "";
  useEffect(() => {
    onOrigemLocal?.(
      origemChave
        ? {
            tipo: origemChave.split("|")[0] as OrigemLocal["tipo"],
            cidade: origemChave.split("|")[1] || null,
          }
        : null,
    );
    // `onOrigemLocal` fica fora: a página passa uma função nova a cada render
    // e incluí-la aqui recriaria o laço que a chave acima veio evitar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origemChave]);

  const h = agora ? agora.getHours() : 12;
  const isMadrugada = h < 5;
  const period = periodFor(h);
  // Céu escuro (noite/madrugada) pede texto claro. O entardecer TERMINA claro
  // na base do card (oklch ~0.8) — texto branco ali ficava ilegível, então ele
  // conta como céu claro para o texto (auditoria de contraste).
  const artTheme = skyTheme !== "v1";
  // Com a arte quem manda no claro/escuro é a FAIXA da arte (8 faixas), não o
  // período do gradiente (5): às 7h o gradiente ainda diz "manhã" enquanto o
  // amanhecer já está claro, e às 20h diz "noite" enquanto o anoitecer é
  // escuro. Sem arte, vale o período do gradiente.
  // Enquanto o clima não chegou (ou a pessoa negou a localização), vale o
  // relógio. Assim que o sol da cidade dela chega, a arte se corrige sozinha.
  // `slot` vem do `useSkyNow` lá em cima — o mesmo que a tela do jogo lê.
  const darkSky = artTheme ? slot.dark : period === "madrugada" || period === "noite";

  // Cores de texto adaptadas ao céu do momento
  const heroText = darkSky ? "text-white/95" : "text-foreground";
  const heroMuted = darkSky ? "text-white/65" : "text-muted-foreground";

  /* Vidro dos cartões. O conceito é um céu claro com cartões brancos; à noite
     o céu escurece e o mesmo branco cegaria — então o vidro inverte e o texto
     acompanha, mantendo o desenho e o contraste nos dois céus.

     Sobre a ARTE o vidro fecha mais: a foto tem contraste local (uma faixa de
     pôr do sol acesa bem atrás de um cartão) que o gradiente liso não tem, e
     com o vidro aberto o texto sumia justamente ali. */
  /* ── Liquid Glass ────────────────────────────────────────────────
     Vidro de verdade tem TRÊS coisas que plástico translúcido não tem:
     o cenário atravessa, a luz bate na quina de cima, e a base recebe
     sombra própria. A versão anterior tinha só a primeira, e mal: no céu
     claro o fundo ia a 0,88 de alfa — nuvem nenhuma passava, e os cartões
     liam como chapa branca colada sobre a arte.
     Os alfas (0,46 no céu claro, 0,56 no escuro) não são gosto: são o ponto
     em que a medição de contraste do texto sobre o PIXEL COMPOSTO passa de
     4,5:1 nos quatro céus. Abaixo disso a arte do meio-dia — um azul médio,
     não claro — deixava o cartão em meio-tom, e aí nem texto escuro nem
     branco funcionavam. Quem devolve a leitura sem engrossar mais o vidro é
     o conjunto: gradiente diagonal, rim claro no topo, sombra interna
     embaixo e sombra externa que descola o cartão do céu. */
  /* O botão da conta é uma ESFERA de vidro, não um disco: a luz entra pela
     quina de cima à esquerda e escapa pela de baixo à direita, e é esse par
     que dá volume.
     Fundo ainda mais transparente que o dos cartões — ele é ferramenta, tem
     que ser alcançável sem ser notado. */
  const glassLeve: React.CSSProperties = {
    background: darkSky
      ? "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 58%)," +
        " rgba(26,23,42,0.20)"
      : "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.14) 58%)," +
        " rgba(255,252,250,0.16)",
    backdropFilter: "blur(16px) saturate(170%)",
    WebkitBackdropFilter: "blur(16px) saturate(170%)",
    border: `1px solid ${darkSky ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.58)"}`,
    boxShadow: darkSky
      ? "inset 0 1.5px 0 rgba(255,255,255,0.45), inset 0 -8px 16px -12px rgba(0,0,0,0.5)," +
        " 0 6px 18px -10px rgba(0,0,0,0.45)"
      : "inset 0 1.5px 0 rgba(255,255,255,0.95), inset 0 -8px 16px -12px rgba(120,92,110,0.28)," +
        " 0 6px 18px -10px rgba(120,84,96,0.28)",
  };
  const glass: React.CSSProperties = {
    background: darkSky
      ? "linear-gradient(158deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 48%)," +
        " rgba(24,21,38,0.56)"
      : "linear-gradient(158deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.18) 48%)," +
        " rgba(255,252,250,0.46)",

    backdropFilter: "blur(20px) saturate(185%)",
    WebkitBackdropFilter: "blur(20px) saturate(185%)",
    border: `1px solid ${darkSky ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.66)"}`,
    boxShadow: darkSky
      ? "inset 0 1px 0 rgba(255,255,255,0.40), inset 0 -14px 30px -20px rgba(0,0,0,0.55)," +
        " 0 14px 36px -18px rgba(0,0,0,0.55)"
      : "inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -14px 30px -20px rgba(120,92,110,0.30)," +
        " 0 14px 36px -18px rgba(120,84,96,0.34)",
  };
  const cardText = darkSky ? "text-white" : "text-foreground";
  /* UMA classe de vidro para toda a tela, grande e pequeno. Ela não troca de
     cor conforme o céu: vidro é sempre a mesma parede translúcida, e quem
     garante a leitura nos dois casos é o bisel — ver `.dc-glass-text` no
     styles.css. */
  const glassText = "dc-glass-text";
  const glassSmall = glassText;
  /* O rótulo secundário é o que mais sofre com vidro transparente: ele já
     nasce de baixo contraste por ser secundário, e agora o céu passa por trás
     dele. Medido sobre o vidro novo, dava 2,36:1 no entardecer e 2,99:1 no
     meio-dia — o mínimo é 4,5.
     A saída foi escurecer o RÓTULO em vez de engrossar o vidro: engrossar
     desfaria justamente o efeito pedido. `foreground/70` continua lendo como
     secundário ao lado do texto principal, mas parte de um preto, não de um
     cinza médio. */
  const cardMuted = darkSky ? "text-white/85" : "text-foreground/80";
  /* Nome e etiqueta ficam SOBRE o céu, sem cartão atrás. Na arte isso pede
     sombra: o fundo atrás deles muda de luminosidade ao longo do dia. */
  const overArt: React.CSSProperties =
    artTheme && darkSky ? { textShadow: "0 2px 10px rgba(0,0,0,0.55)" } : {};

  /* Quem o cartão do médico mostra.
     
     SEM vínculo ele não nomeia ninguém. Antes o rótulo dizia "Encontre o seu
     médico" e as três linhas abaixo davam nome, especialidade, CRM e a FOTO do
     dono da instalação — convidava a procurar um médico enquanto afirmava um.
     
     COM vínculo, valem só os dados dele; a foto (que é do dono) aparece apenas
     quando o médico É o dono, senão entra a inicial do nome. Melhor uma
     inicial certa que um rosto errado. */
  const semMedico = !medico?.nome?.trim();
  const vinculadaAoDono = !semMedico && medico!.nome.trim() === DOCTOR.name;
  const medNome = semMedico ? "Você ainda não tem médico" : medico!.nome.trim();
  const medEspec = semMedico
    ? "Toque para encontrar um obstetra no app"
    : (medico!.specialty ?? medico!.title ?? "").trim();
  const medCrm = semMedico ? "" : (medico!.crm ?? "").trim();

  /* A MOLDURA do iOS em modo standalone.

     Fora da área segura — atrás do relógio, em volta do indicador de início — o
     iOS não pinta o conteúdo da página: pinta o fundo do DOCUMENTO. Como o
     `body` deste app é creme, sobrava uma faixa clara em cima e embaixo do céu,
     justamente no aparelho em que a imersão importa mais.

     Enquanto a home está montada, a raiz recebe a cor do céu do momento e volta
     ao que era ao sair — as outras telas têm fundo claro de propósito. É o
     `documentElement` e não o `body`: é a cor da raiz que o iOS propaga para
     essa moldura. */
  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.style.backgroundColor;
    /* `gradientFor` devolve um gradiente, e a moldura precisa de uma COR
       chapada. A primeira cor do gradiente é a do topo do céu, que é
       exatamente a borda que encosta na barra de status. */
    const grad = gradientFor(period, weather?.code ?? 1);
    const primeira = grad.match(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|oklch\([^)]+\)|hsla?\([^)]+\))/i);
    if (primeira) raiz.style.backgroundColor = primeira[0];
    /* No app nativo, o relógio e a bateria do SISTEMA ficam sobre este mesmo
       céu — e o céu muda com a hora. Ícones escuros somem no céu de madrugada;
       ícones claros somem no azul do meio-dia. Então quem decide a barra é a
       MESMA variável que decide a cor do texto do hero, e não uma cor fixa.
       Ao sair da home a barra volta ao padrão: as outras telas têm fundo claro
       de propósito. */
    barraDeStatus(darkSky);
    return () => {
      raiz.style.backgroundColor = antes;
      barraDeStatus(false);
    };
  }, [period, weather?.code, darkSky]);

  return (
    /* Sem `pb` aqui: a página que renderiza esta tela (minha-conta) já reserva
       `7rem + safe-area` no rodapé para a barra flutuante, e as duas folgas
       somavam ~216px. Com quatro cartões embaixo do bebê isso não aparecia;
       agora que sobrou só o médico, virou meia tela em branco. */
    <div className="space-y-4">
      {/* ── Hero imersivo: céu real do momento + bebê + clima ────────
          Full-bleed nas laterais (-mx-5 cancela o px-5 da página) e puxado
          para cima (-mt-2). Retângulo reto — sem cantos arredondados, o céu
          encosta nas quatro bordas para máxima imersão no celular. */}
      <div
        /* O céu sobe ATÉ O TOPO DA TELA, por baixo da barra de status.

           A página empurra o conteúdo para baixo pela altura da safe area
           (`pt-[calc(0.5rem+var(--safe-top))]`), e este bloco só subia
           8px — então no app instalado sobrava uma faixa branca acima do céu,
           bem onde fica o relógio. No Safari isso não aparecia porque a barra do
           navegador ocupava aquele espaço; em modo standalone, não ocupa.

           A margem negativa cancela a folga inteira e o padding devolve o mesmo
           tanto por dentro: a arte encosta no topo do aparelho, e o ícone do
           perfil e o clima continuam abaixo do relógio, onde dá para tocar. */
        className="shine relative -mx-5 flex flex-col overflow-hidden px-5 pb-6 transition-[background] duration-1000 -mt-[calc(0.5rem+var(--safe-top))] pt-[calc(0.5rem+var(--safe-top))]"
        style={{ background: gradientFor(period, weather?.code ?? 1) }}
      >
        {/* Arte do momento do dia (tema V2). Fica ACIMA do gradiente, que
            continua atrás como cor de espera enquanto a imagem carrega —
            assim nunca há um flash branco. `cover` recorta as sobras: a arte
            é vertical, então em telas largas sobra em cima e embaixo, e é lá
            que mora só céu. */}
        {/* UMA camada, em `cover`. Houve uma tentativa de recuar o fundo
            mostrando a arte em largura cheia sobre uma cópia desfocada dela
            mesma, com a emenda derretida por uma máscara de duas camadas
            (`mask-composite`). Funcionava no Chromium do teste e FALHAVA no
            Safari do iPhone: a máscara zerava, a arte nítida sumia inteira e
            sobrava só o borrão. Voltou para `cover`, que é suportado em toda
            parte. Se um dia valer a pena recuar o fundo de novo, tem que ser
            por um caminho sem `mask-composite` — e testado em iOS de verdade,
            não em Chromium. O recuo da CENA continua de pé: quem o dá é a
            bolha menor, não o enquadramento do céu. */}
        {artTheme && (
          <div
            aria-hidden
            className="dc-sky-breathe pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${slot.src})` }}
          />
        )}

        {/* Vida de fundo do momento do dia — detalhe, nunca protagonista. */}
        {artTheme && <SkyAmbience slot={slot.nome} careMode={careMode} />}

        {/* Chuva: entra DEPOIS do ambiente porque molha o cenário inteiro,
            inclusive os pássaros e as sementinhas. Continua abaixo do
            conteúdo — a chuva não pinga em cima do texto.
            Só no tema com arte: o Céu Clássico (V1) já desenha os próprios
            fios de chuva no SkyLayers, e as duas juntas dariam chuva dupla. */}
        {artTheme && (
          <SkyRain
            forca={weather ? forcaDaChuva(weather.code, weather.mm) : null}
            careMode={careMode}
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

        <div className="relative flex flex-col">
          {/* ── PRIMEIRA DOBRA: uma tela exata, do topo ao cartão da semana.
              O bebê é o protagonista e fica com TODO o espaço que sobrar —
              por isso `h-[100svh]` aqui e não `min-h`: o que não couber vai
              para a dobra de baixo em vez de espremer o bebê. ── */}
          <div className="flex h-[100svh] flex-col pt-[calc(0.5rem+var(--safe-top))] pb-[calc(var(--safe-bottom)+6rem)] short:pb-[calc(var(--safe-bottom)+5.5rem)]">
            {/* ── Barra de topo flutuante: menu + clima ─────────────── */}
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => {
                  hapticTap();
                  onOpenMenu?.();
                }}
                aria-label={temNaoLidas ? "Perfil — há notificações novas" : "Perfil"}
                className="press relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={glassLeve}
              >
                {/* O ponto fica FORA do círculo de vidro, encostado na borda:
                    dentro ele competiria com a silhueta num botão de 40px e
                    sumiria contra nuvem clara. O anel branco o descola do céu. */}
                {temNaoLidas && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white/85"
                  />
                )}
                {/* Silhueta de perfil no lugar do ☰. Três barras não dizem o
                    que há atrás delas — cabem notificações, ajustes, sair,
                    qualquer coisa. A silhueta diz: isto é a SUA conta. E é
                    o mesmo desenho que todo app usa para esse canto, então
                    ninguém precisa aprender nada.

                    O botão é irmão do número de graus, e ícone não aceita
                    `background-clip: text`. O material vira traço: linha
                    branca translúcida com as MESMAS sombras deslocadas do
                    vidro — claras para cima e à esquerda, escuras para baixo
                    e à direita. É o mesmo bisel, escrito em `drop-shadow`. */}
                <UserRound
                  className="h-5 w-5"
                  strokeWidth={2.1}
                  style={{
                    stroke: "rgba(255,255,255,0.9)",
                    filter:
                      "drop-shadow(-0.8px -1px 0 rgba(255,255,255,0.85))" +
                      " drop-shadow(0.8px 1.5px 0 rgba(26,40,76,0.44))" +
                      " drop-shadow(1.6px 3px 3px rgba(26,40,76,0.28))" +
                      " drop-shadow(0 8px 18px rgba(18,30,62,0.32))",
                  }}
                />
              </button>

              {/* Só o número. O ícone do tempo desceu para o cartão de
                  saudação, onde ele tem espaço para ser o ícone REAL da
                  condição em vez de um genérico — e o topo fica com dois
                  círculos do mesmo tamanho, um de cada lado, em vez de um
                  botão e uma pílula comprida. */}
              {weather && (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={glassLeve}
                  aria-label={`${weather.temp} graus, ${weather.condition}`}
                >
                  <span className={`text-[15px] font-bold leading-none ${cardText} ${glassSmall}`}>
                    {weather.temp}°
                  </span>
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
                {/* Só o nome. O rótulo "Acompanhando" saiu: ele ocupava uma
                    linha inteira para dizer o óbvio, e era o texto de menor
                    contraste da tela. Sem ele — e sem as pílulas — o nome pode
                    crescer e respirar, que é o que faz alguém LER em vez de só
                    reconhecer. */}
                {babyName && (
                  <div className="mt-5 short:mt-3 text-center" style={overArt}>
                    <p
                      className={`font-serif text-[clamp(1.8rem,8vw,2.35rem)] font-normal leading-none ${heroText} ${glassText}`}
                    >
                      {babyName} <span className="dc-sem-vidro align-middle text-[0.5em]">💜</span>
                    </p>
                  </div>
                )}

                {/* As pílulas de trimestre e de contagem regressiva saíram.
                    A data prevista do parto já aparece por extenso no cartão de
                    progresso, logo abaixo, e o trimestre é dedutível da semana
                    que está em letras garrafais no meio da tela. Duas pílulas
                    para repetir o que a tela já diz é justamente o que tirava
                    o ar do topo.
                    A mensagem de reta final (40s+) não se perde: título, corpo
                    e dica continuam na aba do Bebê — aqui só existia o rótulo. */}

                {/* Bebê protagonista dentro da bolha (o "ventre").
                  Toque abre a aba do Bebê com a semana detalhada — e pede a
                  sub-aba "semana" de propósito: a aba do Bebê agora abre numa
                  grade de seis, e este toque promete a semana, não um menu. */}
                <button
                  onClick={() => onNavigate("Bebê", "semana")}
                  aria-label="Ver a semana do bebê"
                  className="relative flex min-h-0 flex-1 items-center justify-center py-1.5 transition-transform active:scale-[0.97]"
                >
                  {/* UMA caixa manda em bola e bebê. Antes cada um tinha a sua
                    medida e em tela curta um escapava do outro. Ela cabe na
                    faixa (`h-full`), na largura (`76vw`) e tem teto — nessa
                    ordem, o que for menor vence. */}
                  {/* Recuada de ~25%: a bolha vinha ocupando 76vw — em 430px
                    são 327 de 430, quase a largura toda, e o que se sente é
                    lente colada no rosto. Em 57vw ela volta a ser um objeto
                    DENTRO de uma cena, com céu em volta para o objeto estar
                    dentro de quê. O céu que sobra não é vazio: é a distância. */}
                  <div className="relative aspect-square h-full max-h-[min(57vw,19.5rem)]">
                    {ART_HAS_ORB ? null : <BabyOrb />}
                    {/* `scale` porque o SVG tem margem interna larga: a tinta do
                      bebê é ~55% da caixa, e 1.43 leva ela a ~80% da bolha — a
                      proporção que a referência tem. Medido na tela, não
                      estimado: em 1.8 ela vazava (101% da bolha). O tamanho é o MESMO
                      em todas as semanas; o que muda é o desenho. */}
                    <BabyIllustration
                      week={gest.weeks}
                      tone={babyTone}
                      showSac={false}
                      showInfo={false}
                      className="absolute inset-0 h-full w-full origin-center scale-[1.43] drop-shadow-[0_14px_32px_rgba(120,70,90,0.26)]"
                    />
                  </div>
                </button>

                {/* ── Cartão da semana em degrau ──────────────────────
                  A aba do número SOBE do cartão, como no conceito. São dois
                  irmãos encostados (não empilhados): vidro sobre vidro
                  dobraria a opacidade e deixaria a emenda escura. */}
                <div className="mt-1 flex flex-col items-center">
                  <div
                    className="px-5 pb-1 pt-1.5 short:pt-1 text-center"
                    style={{ ...glass, borderBottom: "none", borderRadius: "24px 24px 0 0" }}
                  >
                    <p
                      /* Sem vidro aqui, e o motivo é físico: este número fica
                         DENTRO de um cartão de vidro, e vidro precisa de cena
                         atrás para existir. Sobre a chapa clara do cartão não
                         há o que atravessar — o "20" quase sumia. O material
                         só vale para texto que se apoia direto no céu. */
                      className={`leading-none ${cardText} ${glassSmall}`}
                      style={{
                        // `var(--font-serif)` e não "Nunito" fixo: preso assim,
                        // o maior número da tela era o único texto que NÃO
                        // seguia a fonte do sistema.
                        fontFamily: "var(--font-serif)",
                        fontSize: "clamp(2.5rem, 10.5vw, 3.2rem)",
                        fontWeight: 400,
                        letterSpacing: "-0.01em",
                        fontVariantNumeric: "tabular-nums lining-nums",
                      }}
                    >
                      {gest.weeks}
                    </p>
                    <p className={`mt-0.5 text-[15px] font-normal ${cardMuted} ${glassSmall}`}>
                      {gest.weeks === 1 ? "semana" : "semanas"}
                      {gest.days > 0 && ` e ${gest.days} ${gest.days === 1 ? "dia" : "dias"}`}
                    </p>
                  </div>

                  <div
                    className="w-full rounded-[24px] px-3.5 pb-3 pt-2.5 short:pb-2.5 short:pt-2"
                    style={glass}
                  >
                    {/* Medidas da semana (silenciadas no Modo Cuidado) */}
                    {!careMode && (
                      <>
                        {/* Divisor com coração — o mesmo traço do conceito */}
                        <div className="mt-1 flex items-center justify-center gap-2.5" aria-hidden>
                          <span
                            className="h-px w-16"
                            style={{
                              background: `linear-gradient(90deg, transparent, ${darkSky ? "rgba(255,255,255,0.34)" : "rgba(186,150,170,0.55)"})`,
                            }}
                          />
                          <span className="text-sm">💗</span>
                          <span
                            className="h-px w-16"
                            style={{
                              background: `linear-gradient(90deg, ${darkSky ? "rgba(255,255,255,0.34)" : "rgba(186,150,170,0.55)"}, transparent)`,
                            }}
                          />
                        </div>

                        <div className="mt-3 short:mt-2 grid grid-cols-3">
                          {[
                            { emoji: "📏", value: baby.size, label: "Comprimento" },
                            { emoji: "⚖️", value: baby.weight, label: "Peso" },
                            {
                              emoji: fruitEmojiForWeek(gest.weeks),
                              value: baby.fruit,
                              label: "Tamanho",
                            },
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
                              <span className="text-lg short:text-base leading-none">
                                {s.emoji}
                              </span>
                              <p
                                className={`mt-1 text-[14px] font-semibold leading-tight ${cardText} ${glassSmall}`}
                              >
                                {s.value}
                              </p>
                              {/* Sem `opacity-80` aqui: `cardMuted` JÁ é uma cor
                                  atenuada, e as duas camadas se multiplicavam —
                                  70% de opacidade dentro de um bloco a 80% dá
                                  56% na tela, e a medida caía para 2,8:1. */}
                              <p className={`text-[11px] font-normal ${cardMuted} ${glassSmall}`}>
                                {s.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* flex-1 centrado: sem isso o texto ficava colado no topo com
               ~380px de gradiente vazio abaixo (hero tem min-h de 66svh). */
              <div className="flex h-[100svh] flex-col items-center justify-center text-center">
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

          {/* ── SEGUNDA DOBRA: rola para ver. Progresso e recado do dia
              saíram da primeira tela para o bebê caber grande. ── */}
          {gest && baby && (
            <div className="pt-4">
              {/* ── Progresso em 3 colunas: a barra mora no MEIO, entre as
                  duas datas — é assim no conceito, não largura cheia. ── */}
              <div className="rounded-[22px] px-4 py-3 short:py-2" style={glass}>
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3">
                  <div className="text-left">
                    <p className={`text-[10px] font-medium ${cardMuted}`}>Início</p>
                    <p className={`text-[11px] font-bold ${cardText}`}>
                      {dateOffsetLabel(-(gest.totalDays ?? 0))}
                    </p>
                  </div>

                  <div>
                    <p className={`text-center text-[11px] font-bold ${cardMuted}`}>
                      {Math.round(progress ?? 0)}% concluído
                    </p>
                    {/* Trilho com o coração na posição de hoje */}
                    <div className="relative mt-1.5 h-5 short:h-4 short:mt-1">
                      <div
                        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                        style={{
                          background: darkSky ? "rgba(255,255,255,0.18)" : "rgba(150,110,130,0.16)",
                        }}
                      />
                      <div
                        className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-700"
                        style={{
                          width: `${progress ?? 0}%`,
                          background: "linear-gradient(90deg, #c4b5fd, #a855f7)",
                        }}
                      />
                      <span
                        aria-hidden
                        className="absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] shadow-md transition-all duration-700"
                        style={{ left: `${progress ?? 0}%`, background: "#fff" }}
                      >
                        💜
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-[10px] font-medium ${cardMuted}`}>Parto previsto</p>
                    <p className={`text-[11px] font-bold ${cardText}`}>
                      {dateOffsetLabel(daysLeft ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* O convite de ativar a localização saiu daqui.
                  Ele era o terceiro cartão empilhado no alto desta tela, e
                  três avisos ao mesmo tempo empurravam o bebê para fora da
                  primeira dobra. Agora vive na central de notificações, atrás
                  do ☰ — com a vantagem de não sumir para sempre quando ela
                  recusa: dá para voltar lá e ativar depois. A origem da
                  localização sobe pela `onOrigemLocal`. */}

              {/* ── Saudação do dia e o conselho ──────────────────────
                  O clima aparece UMA vez na tela, no chip lá em cima: é lá
                  que mora o dado (temperatura e condição), colado na arte do
                  céu que ele explica. Aqui fica só o conselho.
                  Antes havia repetição em três camadas: o chip dizia "Céu
                  limpo", esta linha trazia DOIS emojis de sol (um de cada
                  lado do nome) e a dica ainda abria com "Céu aberto —". */}
              {weather && (
                <div
                  className="mt-2.5 short:mt-2 flex items-start gap-3 rounded-[22px] px-4 py-3 short:py-2"
                  style={glass}
                >
                  {/* O ícone REAL da condição, que antes vivia no chip lá em cima.
                      Aqui ele tem espaço, e o chip fica só com o número. */}
                  <span className="mt-0.5 text-xl leading-none">{weather.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-[14px] font-extrabold ${cardText}`}>
                      {dayGreetingLabel()}
                      {babyName ? `, ${babyName}!` : "!"}
                    </p>
                    {/* Mesma cor do cartão de cima. `cardMuted` a 12px e peso
                        normal lia bem mais claro que o mesmo `cardMuted` a
                        11px em negrito do "% concluído" logo acima — mesma
                        cor no código, dois cinzas diferentes no olho. Aqui o
                        que separa título de dica é o PESO, não a cor. */}
                    <p className={`mt-0.5 text-[12px] leading-snug ${cardText}`}>{weather.tip}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Aqui moravam quatro blocos: Meu calendário (com o marco da semana
          dentro), Registros, Pós-parto e o link de Dúvidas frequentes. Todos
          foram para o menu da conta, atrás da silhueta do topo.

          A razão é o que esta segunda dobra virou: uma lista de portas. Quem
          rolava a home passava por quatro cartões cinza-rosa parecidos entre
          si para chegar no único que tem rosto. Agora a rolagem tem um destino
          só — o médico — e as portas ficam onde se procura por portas.

          Nada se perdeu de caminho: Consultas e Registros são as duas
          primeiras linhas do menu depois dos seus dados, a próxima consulta
          virou o subtítulo da linha de Consultas, Pós-parto continua
          aparecendo só a partir da semana 36, e o marco da semana já era
          repetição da linha do tempo do Calendário. */}

      {/* ── Card do médico ──────────────────────────────────────────── */}
      <button
        onClick={() => onNavigate("Médico")}
        className="shine group w-full rounded-3xl border border-border bg-card overflow-hidden text-left shadow-[var(--shadow-card)] transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] active:scale-[0.98]"
      >
        <div className="flex items-center gap-4 p-4">
          {/* A FOTO é do dono da instalação e não temos foto dos outros médicos:
              então ela só aparece quando o cartão é de fato dele. Para os
              demais entra a inicial do nome — melhor uma inicial certa que um
              rosto errado. */}
          {vinculadaAoDono ? (
            <img
              src={portrait}
              alt={medNome}
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/12 font-serif text-2xl text-primary ring-1 ring-primary/20">
              {semMedico ? "🔍" : medNome.replace(/^(Dr|Dra)\.?\s*/i, "").charAt(0) || "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              {semMedico ? "Encontre o seu médico" : "Seu médico"}
            </p>
            <p className="mt-0.5 font-serif text-lg leading-tight text-foreground">{medNome}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{medEspec}</p>
            {medCrm && <p className="mt-1 text-[10px] text-muted-foreground">{medCrm}</p>}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </button>
    </div>
  );
}
