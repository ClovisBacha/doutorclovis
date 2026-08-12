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
  Menu,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { DOCTOR } from "@/lib/doctor.config";
import { BabyIllustration } from "@/components/baby-illustration";
import { SkyRain, forcaDaChuva } from "@/components/sky-rain";
import { SkyLayers, gradientFor, periodFor } from "@/components/weather-sky";
import { CeuDoDia, ceuPelaHora, ceuPeloSol } from "@/components/ceu-do-dia";
import { CeuEfeitos } from "@/components/ceu-efeitos";
import { MascoteDaHome } from "@/components/mascote-da-home";
import { humorDaJornada } from "@/components/bolha";
import { diaLocalDe, fraseDoDia, periodoDaHora } from "@/lib/frases-do-mascote";
import { babyForWeek } from "@/lib/gestacao";
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
  /* Antes de montar vale o meio-dia, e é de propósito: no SSR o relógio é o do
     servidor (UTC na Vercel), então sortear o céu ali mostraria a noite para
     quem abre às 8h da manhã. O céu do dia é o mais neutro para essa espera de
     um quadro — e é claro, como a maioria das horas em que o app é aberto. */
  const slot = agora
    ? ceuPeloSol(agora, weather?.sunrise ?? null, weather?.sunset ?? null)
    : ceuPelaHora(12);
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
  destacado = false,
  escura = false,
  onClick,
  Icon,
}: {
  label: string;
  color: string;
  compact: boolean;
  active?: boolean;
  /** O tutorial está falando deste item agora. */
  destacado?: boolean;
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
      className={`relative flex min-w-0 flex-1 flex-col items-center py-1 ${
        destacado ? "dc-nav-destaque" : ""
      }`}
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
  destaque = null,
}: {
  activeSection: BottomSection | null;
  onSelect: (s: BottomSection) => void;
  onEmergency?: () => void;
  /**
   * Qual item o tutorial está explicando AGORA — ele ganha um anel pulsando.
   *
   * `"sos"` não é uma `BottomSection`: o SOS não abre aba nenhuma, ele abre a
   * Central de Emergência. Por isso o tipo é a união, e não `BottomSection`
   * sozinho — o primeiro item que a paciente precisa conhecer seria justamente
   * o único que o tutorial não conseguiria apontar.
   */
  destaque?: BottomSection | "sos" | null;
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
          /* A BASE ABRIU DE 0,58 PARA 0,38 (ago/2026).
             Em 0,58 a barra lia como chapa branca colada: o céu não
             atravessava nada, e ela era o único elemento OPACO de uma tela
             que virou toda de vidro. Pedido do dono, comparando com a
             referência: "garanta que o fundo roxo da tela transpareça
             suavemente através da navbar pill".
             O que devolve a leitura do rótulo cinza não é o corpo do vidro —
             é o desfoque (que apaga o detalhe atrás) mais o fio de luz na
             aresta de cima. Mesma receita dos botões do topo, e agora no
             mesmo nível de transparência que eles. */
          background: escura
            ? "linear-gradient(158deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 48%)," +
              " rgba(26,22,44,0.42)"
            : "linear-gradient(158deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.14) 48%)," +
              " rgba(255,253,252,0.38)",
          backdropFilter: "blur(18px) saturate(180%)",
          WebkitBackdropFilter: "blur(18px) saturate(180%)",
          border: `1px solid ${escura ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.5)"}`,
          boxShadow: escura
            ? "inset 0 1px 0 rgba(255,255,255,0.3)," +
              " inset 0 -14px 30px -20px rgba(0,0,0,0.45)," +
              " 0 10px 30px -14px rgba(0,0,0,0.42)"
            : "inset 0 1px 0 rgba(255,255,255,0.8)," +
              " inset 0 -14px 30px -20px rgba(120,92,110,0.2)," +
              " 0 10px 30px -14px rgba(48,40,60,0.24)",
        }}
      >
        {/* SOS no extremo ESQUERDO — vermelho, sempre visível. */}
        {onEmergency && (
          <NavItem
            label="SOS"
            color="text-rose-500"
            compact={compact}
            escura={escura}
            destacado={destaque === "sos"}
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
              className={`relative flex min-w-0 flex-1 flex-col items-center py-1 ${
                destaque === id ? "dc-nav-destaque" : ""
              }`}
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
              destacado={destaque === id}
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

/* O interruptor `ART_HAS_ORB` saiu (ago/2026). Ele existia porque a primeira
   leva de artes `.webp` trazia a esfera PINTADA dentro da imagem, em posição e
   tamanho diferentes em cada uma — e desenhar outra por cima dava duas esferas
   cruzadas. Aquelas artes não existem mais: as cenas de `ceu-do-dia.tsx` são
   só céu, por construção, e a bolha é sempre desenhada aqui. */

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
        /* ─── SEIS CAMADAS DE LUZ, E O CORPO QUASE SUMINDO (ago/2026) ─────
           Pedido do dono: "coloca mais reflexos na bola, deixe ela mais
           transparente". As duas coisas puxam para lados opostos se forem
           feitas no mesmo lugar — clarear o CORPO é o que tira a
           transparência, e era ele que carregava quase toda a luz (0,26 de
           branco chapado no miolo).

           A saída foi trocar UM brilho grande e um corpo forte por VÁRIOS
           reflexos pequenos e um corpo fraco: o corpo caiu de 0,26 para 0,10
           (o céu passa) e a luz voltou repartida em pontos que uma esfera de
           vidro de verdade tem — o ponto duro da fonte, o lençol que ele
           espalha, o reflexo da segunda janela, a contra-luz da parede de
           baixo e a cáustica.

           A ordem importa: a primeira camada fica POR CIMA. O ponto duro vem
           primeiro justamente para não ser lavado pelo lençol. */
        background: [
          // 1. O PONTO DURO — a fonte de luz refletida na parede de vidro.
          //    Pequeno e quase branco: é o que faz o olho ler "esfera" em vez
          //    de "disco". Elipse e não círculo porque a parede é curva e o
          //    reflexo chega achatado.
          //    O miolo cai rápido (0,9 → 0,3 em 36%) porque reflexo de vidro
          //    tem NÚCLEO: com queda mansa a mancha lê como algodão.
          "radial-gradient(ellipse 12.5% 8.5% at 29% 19%, rgba(255,255,255,0.92) 0%," +
            " rgba(255,255,255,0.3) 36%, rgba(255,255,255,0.08) 62%," +
            " rgba(255,255,255,0) 84%)",
          // 2. O LENÇOL que esse ponto espalha em volta, largo e fraco.
          "radial-gradient(ellipse 33% 26% at 33% 25%, rgba(255,255,255,0.3) 0%," +
            " rgba(255,255,255,0.09) 52%, rgba(255,255,255,0) 82%)",
          // 3. O SEGUNDO REFLEXO, alto e do lado oposto: vidro reflete o
          //    ambiente inteiro, não só a lâmpada principal.
          "radial-gradient(ellipse 10% 6.5% at 71% 26%, rgba(255,255,255,0.28) 0%," +
            " rgba(255,255,255,0) 76%)",
          // 4. CONTRA-LUZ na base: a parede oposta devolve luz para dentro.
          "radial-gradient(ellipse 30% 18% at 62% 87%, rgba(255,255,255,0.28) 0%," +
            " rgba(255,255,255,0) 70%)",
          // 5. CÁUSTICA: o arco que a luz desenha ao atravessar e reencontrar
          //    a parede, embaixo e do lado de onde ela entrou.
          "radial-gradient(ellipse 20% 12% at 25% 75%, rgba(255,242,250,0.18) 0%," +
            " rgba(255,255,255,0) 72%)",
          // 6. O CORPO — o que sobrou dele. Era 0,26 no miolo; agora 0,10.
          //    É esta linha, e não os reflexos, que decide o quanto de céu
          //    atravessa a bolha.
          "radial-gradient(circle at 50% 47%, rgba(255,252,254,0.1) 0%," +
            " rgba(255,247,251,0.05) 46%, rgba(255,255,255,0.015) 72%," +
            " rgba(255,255,255,0) 88%)",
        ].join(", "),
        /* Véu: dentro da bolha o céu perde nitidez e cor, como atrás de vidro.
           É o que a faz OCUPAR volume em vez de ser um decalque.
           Afrouxado junto com o corpo (era blur 2,5px / brightness 1,05): véu
           forte é opacidade por outro caminho — ele apaga o desenho do céu
           atrás da bolha tanto quanto uma camada branca apagaria. */
        backdropFilter: "blur(1.5px) saturate(0.95) brightness(1.02)",
        WebkitBackdropFilter: "blur(1.5px) saturate(0.95) brightness(1.02)",
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
          /* O ARO ACESO DA PARTE DE BAIXO, fino e nítido. Numa esfera de
             vidro a parede mais brilhante não é a que a luz toca: é a
             OPOSTA, onde o raio sai depois de atravessar. Curto (-8px de
             spread) para virar um fio de luz, não um segundo halo. */
          "inset -3px -5px 9px -7px rgba(255,255,255,0.85)",
          /* O aro uniforme desceu de 0,20 para 0,15: com o corpo mais fraco,
             o mesmo contorno passava a ser a coisa mais forte da bolha e ela
             lia como círculo desenhado a caneta. */
          "inset 0 0 0 1px rgba(255,255,255,0.15)",
          "0 0 46px 16px rgba(255,246,251,0.16)",
        ].join(", "),
      }}
    />
  );
}

/** Tema do céu da home. `v2` = as quatro cenas novas (padrão); `v1` = o Céu
 *  Clássico, item pago da Loja. */
export type SkyThemeId = "v2" | "v1";

/* ─── OS DEZ CÉUS VIRARAM QUATRO (ago/2026) ────────────────────────────────
   A tabela que morava aqui tinha dez faixas de hora apontando para dez
   arquivos `.webp` (700 KB). Pedido do dono: "a gente vai remover o que está
   atualmente, que são várias versões ali, porém que no final não ficou bom o
   suficiente... vai ficar muito mais simples".
   As quatro cenas novas — amanhecer, dia, pôr do sol e anoitecer — são SVG e
   moram em `ceu-do-dia.tsx`, junto com a régua de qual mostrar. A escolha
   continua ancorada no sol de verdade da cidade da paciente, com o relógio
   como plano B; o que mudou foi quantas cenas existem para escolher. */

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
  naoLidas = 0,
  mascoteCalado = false,
  onOpenRecados,
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
  /**
   * Há notificação por abrir.
   *
   * ⚠️ **O ponto saiu do ☰ e foi para o mascote** (ago/2026), e isso não é
   * mudança de gosto: quando o bebê bolha virou a voz dos recados, um ponto no
   * menu e outro no personagem seriam DOIS avisos para a mesma coisa — e o
   * segundo pior resultado possível é a paciente lê-los como assuntos
   * diferentes ("o menu tem algo" e "a bolha tem algo"). O acesso pelo ☰ não
   * mudou: a central continua lá dentro.
   */
  temNaoLidas?: boolean;
  /**
   * QUANTOS recados por abrir.
   *
   * O emblema mostra o número, e não um ponto. É o que separa "tem coisa" de
   * "tem uma coisa": um ponto obriga a abrir para descobrir se vale a pena, e
   * numa gestação de alto risco a pergunta que ela faz é quantos, não se.
   */
  naoLidas?: number;
  /**
   * Segura o balão do mascote (o emblema continua).
   *
   * Hoje só o TUTORIAL liga isto: com ele aberto, o personagem do canto também
   * falava, atrás do véu — dois balões do mesmo personagem dizendo coisas
   * diferentes na mesma tela.
   */
  mascoteCalado?: boolean;
  /**
   * Abre a central de recados DIRETO, sem passar pelo menu.
   *
   * É o toque do mascote. Sem isto ele cairia no `onOpenMenu` e a paciente
   * teria de achar as notificações dentro da lista da conta — dois toques a
   * mais para chegar no que o personagem acabou de anunciar.
   */
  onOpenRecados?: () => void;
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
  /**
   * A CARA DO MASCOTE NA HOME.
   *
   * Passa pela MESMA régua da jornada (`humorDaJornada`), e não por um `if`
   * escrito aqui: o portão de Modo Cuidado e a ordem de prioridade emocional
   * moram lá dentro, e uma segunda régua divergiria no primeiro ajuste — com
   * o sintoma aparecendo no pior lugar possível, que é uma carinha festiva
   * para quem perdeu a gestação.
   *
   * A home não sabe se o dia foi fechado (isso é do Caminho), então o que ela
   * informa é o que ela tem: a hora. De madrugada ele se espanta de bom; no
   * resto do dia, sorri.
   */
  const humorDoMascote = humorDaJornada({ madrugada: isMadrugada, careMode });

  /**
   * O QUE ELE DIZ QUANDO NÃO HÁ RECADO.
   *
   * Pedido do dono: sem notificação, o personagem escreve conforto e motivação
   * — inclusive chamando para o Caminho, para meditar e para aprender.
   *
   * É UMA POR DIA, e não uma por montagem: esta tela remonta toda vez que ela
   * toca em "Bebê", e um balão novo a cada toque viraria letreiro. A régua
   * (com o filtro de Modo Cuidado e o uso do nome) mora em
   * `lib/frases-do-mascote.ts`, testada.
   *
   * ⚠️ Só entra quando NÃO há recado. O `MascoteDaHome` já dá precedência à
   * `fala` explícita, então mandar as duas faria a frase de conforto ENGOLIR o
   * aviso de que o médico escreveu — exatamente o contrário da prioridade.
   */
  const conforto =
    temNaoLidas || !agora
      ? null
      : fraseDoDia({
          dia: diaLocalDe(agora),
          periodo: periodoDaHora(h),
          nome: firstName,
          careMode,
        });
  /** O tema pago da Loja. `v2` (as quatro cenas novas) é o padrão de todo mundo. */
  const ceuClassico = skyTheme === "v1";
  const period = periodFor(h);
  /* Quem manda no claro/escuro é a CENA, nunca o relógio: o amanhecer é claro
     apesar de cedo, e o anoitecer é escuro apesar de ainda não ser noite
     fechada. É esta variável que decide a cor do texto do hero, o vidro dos
     cartões e a barra de status do iOS.
     Enquanto o clima não chegou (ou a paciente negou a localização), a cena
     vem do relógio; assim que o sol da cidade dela chega, ela se corrige
     sozinha. `slot` vem do `useSkyNow` — o mesmo que a tela do jogo lê.
     No Céu Clássico quem decide é o período do gradiente, que é a régua com
     que aquele tema foi desenhado. */
  const darkSky = ceuClassico ? period === "madrugada" || period === "noite" : slot.dark;
  /* ─── O TOPO TEM RÉGUA PRÓPRIA ────────────────────────────────────────────
     Duas cenas INVERTEM o brilho entre a faixa de cima e a de baixo: o pôr do
     sol abre em violeta escuro e termina em pêssego claro; o anoitecer abre em
     azul-marinho e termina em lavanda média.
     Com `darkSky` sozinho decidindo a tela inteira, o nome do bebê no pôr do
     sol saía em texto escuro sobre violeta escuro — 3,43:1 medido, contra os
     4,5 que este app cobra. `topoEscuro` manda no que encosta no topo (barra
     de status, vidro do menu e da pílula, nome); `darkSky` manda no resto. */
  const topoEscuro = ceuClassico ? darkSky : slot.topoEscuro;

  /* ─── CORES DE TEXTO, MEDIDAS PIXEL A PIXEL SOBRE AS QUATRO CENAS ─────────
     Nada aqui é escolha de gosto: cada valor é o que passou de 4,5:1 (texto
     normal) ou 3:1 (o número, que é grande) contra o PIXEL COMPOSTO do
     gradiente atrás dele, não contra uma cor média inventada.

     As opacidades que existiam antes eram justamente as que falhavam:
     `foreground/75` dava 3,77 no pôr do sol e `white/75` dava 3,41 no
     anoitecer. Um rótulo secundário se diferencia pelo TAMANHO e pelo peso,
     que ele já tem — atenuar a cor por cima disso foi o que o derrubou. */
  /* Índigo profundo, não o marrom do `foreground`: são os valores exatos que
     a referência traz (`#352968` no nome, `#3D3570` no número e no rótulo).
     O par claro/escuro continua — em céu escuro nenhum índigo se lê. */
  const INDIGO_TOPO = "#352968";
  const INDIGO_CORPO = "#3D3570";
  const textoDoTopo = topoEscuro ? "text-white" : "";
  const corDoTopo = topoEscuro ? undefined : INDIGO_TOPO;
  const heroText = darkSky ? "text-white/95" : "";
  const corDoCorpo = darkSky ? undefined : INDIGO_CORPO;
  /* No anoitecer o rótulo cai sobre lavanda média (#9370da) — um meio-tom em
     que NENHUMA cor de texto chega a 4,5:1 sozinha (branco cheio dá 3,79).
     Quem resolve é o halo em `overArt`, e é por isso que ele é obrigatório
     ali: sem a sombra, este rótulo não tem correção possível. */
  const heroMuted = darkSky ? "text-white/[0.98]" : "";

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
  /* ─── O VIDRO SAIU DA TELA COM O QUE ELE VESTIA (ago/2026) ────────────────
     Aqui moravam três materiais: `glassLeve` (a pastilha do botão de menu),
     `glass` (os cartões da segunda dobra) e `tracoDeVidro` (o bisel do ícone).
     Os três dependiam de CÉU ATRAVESSANDO para existir — é o que separa vidro
     de plástico translúcido, e é a mesma razão pela qual a barra de progresso
     largou o `glass` ao descer para a área clara.

     Sobre a arte sobraram só a bolha e o traço do menu, e o dono pediu
     justamente para "maneirar" esse traço. O resto do conteúdo desceu para o
     fundo claro da página, onde o material certo é o do cartão — vidro sobre
     fundo chapado vira um retângulo cinza.

     Do bisel ficou o essencial: a sombra que descola o traço do céu. */
  const tracoDoMenu: React.CSSProperties = {
    stroke: topoEscuro ? "rgba(255,255,255,0.94)" : INDIGO_TOPO,
    filter: topoEscuro
      ? "drop-shadow(0 1px 3px rgba(10,20,50,0.45)) drop-shadow(0 2px 10px rgba(10,20,50,0.35))"
      : "drop-shadow(0 1px 3px rgba(255,255,255,0.75)) drop-shadow(0 0 8px rgba(255,255,255,0.55))",
  };
  /* ─── O HALO NÃO É ENFEITE: É O QUE SUSTENTA O CONTRASTE ─────────────────
     Texto sobre a cena não tem cartão atrás, e a cena tem contraste LOCAL: uma
     crista de onda acesa passando exatamente atrás da base dos glifos. No
     anoitecer, medido pixel a pixel, o pior ponto do "20" caía a 1,4:1 onde
     cruzava a crista clara (#ddcef8); uma sombra de camada só levava aquele
     ponto a 2,65 — passa na mediana e falha no pior pixel. São TRÊS camadas
     (curta e opaca, média, larga e difusa), com alfas baixos e raios largos:
     a sombra não desenha contorno, ela apaga o céu atrás do texto. Halo duro
     lê como relevo de gravação, e foi metade do "muito grosseira" do dono.

     São DOIS halos: `overArt` para o corpo da cena (o número da semana e o
     rótulo, que voltaram para cima da arte a pedido do dono) e `overArtTopo`
     para o nome, que encosta no topo — onde a régua é `topoEscuro` e não
     `darkSky`. O piso continua medido, não estimado:
     `scripts/contraste-hero.mjs` reprova qualquer céu abaixo do mínimo, e
     `scripts/centragem-hero.mjs` mede a centragem óptica. */
  const overArt: React.CSSProperties = darkSky
    ? {
        textShadow:
          "0 1px 3px rgba(10,4,30,0.55), 0 2px 9px rgba(10,4,30,0.5)," +
          " 0 4px 20px rgba(10,4,30,0.42)",
      }
    : {
        /* Em céu CLARO o texto é índigo, e quem levanta o contraste de um
           texto escuro é um halo CLARO — a sombra escura empurrava para o lado
           errado. Medido no pôr do sol: "semanas" ficava em 4,37:1 (mínimo
           4,5) e passa a 6,1 com o halo branco. */
        textShadow:
          "0 0 4px rgba(255,255,255,0.62), 0 1px 8px rgba(255,255,255,0.5)," +
          " 0 2px 16px rgba(255,255,255,0.36)",
      };
  const overArtTopo: React.CSSProperties = topoEscuro
    ? {
        textShadow:
          "0 1px 2px rgba(10,4,30,0.9), 0 2px 6px rgba(10,4,30,0.75)," +
          " 0 3px 14px rgba(10,4,30,0.6)",
      }
    : {
        textShadow:
          "0 0 2px rgba(255,255,255,0.9), 0 1px 5px rgba(255,255,255,0.75)," +
          " 0 2px 12px rgba(255,255,255,0.5)",
      };

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
    /* A moldura precisa de uma COR CHAPADA, e ela tem de ser exatamente a do
       topo da cena — é essa borda que encosta na barra de status. Cada céu
       declara a sua (`corDeTopo`), ao lado do gradiente de onde ela saiu:
       separadas em dois arquivos, elas divergiriam na primeira troca de
       paleta e a emenda apareceria como uma linha de cor errada. */
    raiz.style.backgroundColor = slot.corDeTopo;
    /* No app nativo, o relógio e a bateria do SISTEMA ficam sobre este mesmo
       céu — e o céu muda com a hora. Ícones escuros somem no céu de madrugada;
       ícones claros somem no azul do meio-dia. Então quem decide a barra é a
       MESMA variável que decide a cor do texto do hero, e não uma cor fixa.
       Ao sair da home a barra volta ao padrão: as outras telas têm fundo claro
       de propósito. */
    barraDeStatus(topoEscuro);
    return () => {
      raiz.style.backgroundColor = antes;
      barraDeStatus(false);
    };
  }, [slot.corDeTopo, topoEscuro]);

  return (
    /* Sem `pb` aqui: a página que renderiza esta tela (minha-conta) já reserva
       `7rem + safe-area` no rodapé para a barra flutuante, e as duas folgas
       somavam ~216px. Com quatro cartões embaixo do bebê isso não aparecia;
       agora que sobrou só o médico, virou meia tela em branco. */
    <div className="space-y-4">
      {/* ─── O CÉU E A EMENDA DELE VIVEM JUNTOS ───────────────────────────
          Este invólucro existe só para que a faixa de emenda encoste no pé do
          céu: irmãos diretos do `space-y-4` ganham 16px de margem entre si, e
          16px do creme da página no meio é exatamente o que a faixa serve para
          não deixar acontecer. */}
      <div>
        {/* ── Hero imersivo: céu real do momento + bebê ────────────────
            Full-bleed nas laterais (-mx-5 cancela o px-5 da página) e puxado
            para cima. Retângulo reto — sem cantos arredondados, o céu encosta
            nas quatro bordas para máxima imersão no celular. */}
        <div
          /* O céu sobe ATÉ O TOPO DA TELA, por baixo da barra de status.

           A página empurra o conteúdo para baixo pela altura da safe area
           (`pt-[calc(0.5rem+var(--safe-top))]`), e este bloco só subia
           8px — então no app instalado sobrava uma faixa branca acima do céu,
           bem onde fica o relógio. No Safari isso não aparecia porque a barra do
           navegador ocupava aquele espaço; em modo standalone, não ocupa.

           A margem negativa cancela a folga inteira e o padding devolve o mesmo
           tanto por dentro: a arte encosta no topo do aparelho, e o ícone do
           perfil e o clima continuam abaixo do relógio, onde dá para tocar.

           O `-mt` TEM QUE SER O DA PÁGINA (1,5rem), e o `pt` NÃO. São coisas
           diferentes: o `-mt` cancela a folga do container para o céu encostar
           no topo do aparelho — errado ali, sobrava uma faixa creme de 16px
           bem onde fica o relógio do sistema. O `pt` é a folga do CONTEÚDO
           dentro do céu, e o pedido é que ele fique colado na área segura:
           meio rem, não um e meio. Se a folga da página mudar, só o `-mt` muda.
           A bancada replica a geometria da página de propósito — com `pt-2`
           ela casava por acaso com um `-mt` errado e escondia a faixa. */
          /* ─── O HERO TEM O TAMANHO DA IMAGEM (ago/2026) ────────────────────
           ─── A CAIXA É UMA TELA CHEIA, E NÃO A PROPORÇÃO DA ARTE ────────
           Ela chegou a ser `aspect-[853/1844]`, a proporção exata do arquivo,
           para atender "sem expandir a imagem, ela já está no tamanho exato que
           quero". O dono olhou no aparelho dele e devolveu o defeito: "embaixo
           ainda não está totalmente preenchido".

           E ele está certo — as duas coisas só são compatíveis num aparelho
           cuja tela tenha EXATAMENTE a proporção da arte, e nenhum iPhone tem.
           A arte é 2,1618; um 15 Pro é 2,168, um 16 Pro é 2,174. Presa à
           própria proporção, a caixa fecha alguns pixels antes do fim da tela e
           o creme da página aparece por baixo do céu — uma faixa clara que não
           é decisão de ninguém.

           Uma tela cheia fecha essa fresta, e o preço é ínfimo: o
           `object-cover` amplia a arte 0,3% num 15 Pro. Isso não é "esticar a
           imagem", que era o que o pedido original barrava — aquilo era a arte
           puxada para cobrir um hero de altura arbitrária, com a lua saindo
           cortada pela borda.

           ⚠️ **"Uma tela cheia" NÃO é `100svh`** — ver `.dc-hero-tela` no
           `styles.css`. Com `svh` a faixa creme voltou a aparecer no aparelho
           do dono, e a conta só fecha de um jeito: naquele iOS o `svh` é menor
           que a tela visível. A classe usa `lvh` com `svh` de reserva.

           ⚠️ Nada de `aspect-ratio` aqui de novo: além da fresta, `aspect-ratio`
           com `max-height` e largura `auto` encolhe a LARGURA (o iPhone SE
           nasceu com 308px em vez de 375).

           `pb` saiu junto: a folga do pé pertencia à segunda dobra, que não
           mora mais aqui dentro. */
          className="shine dc-hero-tela relative -mx-5 overflow-hidden px-5 transition-[background] duration-1000 -mt-[calc(1.5rem+var(--safe-top))] pt-[calc(0.5rem+var(--safe-top))]"
          /* Cor de espera enquanto o `.webp` não decodifica. Agora é a do TOPO e
           não a do pé: a caixa acabou junto com a imagem, então não há mais
           "depois da arte" para o pé continuar — e o que apareceria sem esta
           cor é justamente a faixa atrás do relógio do sistema. */
          style={{
            background: ceuClassico ? gradientFor(period, weather?.code ?? 1) : slot.corDeTopo,
          }}
        >
          {/* A CENA DO MOMENTO — amanhecer, dia, pôr do sol ou anoitecer.
            SEM `dc-sky-breathe`: aquele respiro era um zoom de 4% a 7,5%, isto
            é, recorte lento de uma arte que o dono disse estar no tamanho
            exato. A vida da cena ficou toda em `CeuEfeitos`, que anima o que
            está por CIMA da arte sem mexer no enquadramento dela. */}
          {!ceuClassico && (
            <>
              <CeuDoDia nome={slot.nome} />
              {/* A vida por cima da arte: estrelas, cadentes e a luz do astro
                respirando. Fica FORA do `dc-sky-breathe` de propósito — o zoom
                lento arrastaria as cadentes junto e o risco sairia torto. */}
              <CeuEfeitos nome={slot.nome} careMode={careMode} />
            </>
          )}

          {/* ─── O CÉU CLÁSSICO CONTINUA DE PÉ ───────────────────────────
            Ele é item PAGO da Loja (150 🌱). As dez artes que saíram em
            ago/2026 eram o tema padrão; este é a alternativa que alguém
            comprou, e apagá-la tiraria da paciente uma coisa que ela pagou —
            decisão de produto, não de refator. Continua sendo o gradiente com
            sol, lua, estrelas e nuvens desenhados, como sempre foi. */}
          {ceuClassico && (
            <>
              <SkyLayers code={weather?.code ?? 1} isDark={darkSky} mini period={period} />
              {!darkSky && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ background: DREAM_VEIL }}
                />
              )}
            </>
          )}

          {/* Chuva: entra DEPOIS da cena porque molha o cenário inteiro, e
            continua abaixo do conteúdo — a chuva não pinga em cima do texto.
            Só no céu novo: o Clássico já desenha os próprios fios de chuva no
            `SkyLayers`, e as duas juntas dariam chuva dupla. */}
          {!ceuClassico && (
            <SkyRain
              forca={weather ? forcaDaChuva(weather.code, weather.mm) : null}
              careMode={careMode}
            />
          )}

          {/* ── SOBRE A IMAGEM SÓ FICAM DUAS COISAS ───────────────────────
            A barra de topo (menu + nome do bebê) e a bolha do bebê, centrada.
            Tudo o mais desceu para o fundo claro da página — pedido do dono:
            "além disso deve ficar fora dessa nova imagem de fundo, outros
            elementos vão ficar embaixo com o fundo rosa claro". ── */}
          <div className="relative">
            {/* ── BARRA DE TOPO: menu · nome ────────────────────────────
                O nome fica no CENTRO ÓPTICO da tela — não no centro do espaço
                que sobra ao lado do botão. Por isso ele é posicionado em
                `absolute` com `-translate-x-1/2` em vez de entrar no fluxo: o
                botão da esquerda mede 40px, e num `justify-between` o nome
                nasceria 16px fora do eixo. */}
            <div className="relative flex h-10 items-center justify-between gap-3">
              <button
                onClick={() => {
                  hapticTap();
                  onOpenMenu?.();
                }}
                aria-label={temNaoLidas ? "Menu — há notificações novas" : "Menu"}
                /* ─── O BOTÃO PERDEU A PASTILHA DE VIDRO (ago/2026) ──────
                   Pedido do dono: "maneirar o elemento dos 3 hambúrgueres".
                   Ele era um disco de vidro de 40px com fundo, borda e sombra
                   — quatro camadas de material para abrir um menu, ao lado de
                   uma tela cujo assunto é o bebê.

                   Ficou só o traço. O ALVO continua com 40px: quem some é o
                   desenho do botão, não a área que o dedo acerta — encolher o
                   toque para o tamanho do ícone seria "maneirar" cobrando o
                   preço no lugar errado. */
                className="press relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              >
                {/* ⚠️ O PONTO VERMELHO SAIU DAQUI (ago/2026) e foi para o
                    mascote, do outro lado da barra. Ele só quis dizer uma
                    coisa a vida inteira — "há recado na central" —, e a central
                    agora tem um anunciante com rosto, que mostra QUANTOS. Dois
                    avisos para o mesmo fato competem entre si e, pior, lêem
                    como assuntos diferentes: "o menu tem algo" e "a bolha tem
                    algo". O acesso pelo ☰ não mudou. */}
                {/* Sem a pastilha atrás, o traço passa a se separar do céu
                    sozinho — daí a sombra, que continua sendo a MESMA régua do
                    `topoEscuro`: branco sobre topo escuro, índigo sobre topo
                    claro. Um traço branco fixo ficaria invisível no amanhecer,
                    que é justamente a cena de topo mais claro. */}
                <Menu
                  className="h-[22px] w-[22px]"
                  strokeWidth={1.9}
                  style={tracoDoMenu}
                  aria-hidden
                />
              </button>

              {/* O NOME DO BEBÊ, no eixo da tela. `pointer-events-none` porque
                  ele atravessa a faixa inteira: sem isso a metade invisível do
                  bloco cobriria o botão do menu. */}
              {babyName && (
                <p
                  /* O teto é o que SOBRA depois dos cantos, não uma fração da
                     linha. `52%` era metade da faixa — mas a faixa tem um
                     botão de 40px de um lado, e em 320px de largura um nome
                     comprido ("Ana Beatriz…") passava por baixo dele. Medido.
                     Eram 11rem enquanto a pílula do clima ocupava o canto
                     direito; com ela fora, sobra só o botão a reservar, e o
                     nome ganhou 4rem de folga — que é justamente o que faz o
                     canto vazio valer a pena. O reserva continua SIMÉTRICO
                     porque o bloco é centrado: encolher só a esquerda tiraria
                     o nome do eixo. */
                  className={`pointer-events-none absolute left-1/2 max-w-[calc(100%-7rem)] -translate-x-1/2 truncate text-center text-[clamp(1.125rem,4.8vw,1.25rem)] leading-none ${textoDoTopo}`}
                  style={{
                    ...overArtTopo,
                    color: corDoTopo,
                    /* ─── O NOME SEGUE A MESMA RÉGUA DO NÚMERO DA SEMANA ────
                       Medido, os dois maiores textos da tela estavam em pesos
                       diferentes: o número em 500 (Medium) e o nome em 600.
                       Semi-Bold empasta pelo mesmo motivo que empastava no
                       número — e aqui é pior, porque o nome do filho dela é a
                       única palavra do topo.
                       O tracking acompanha a MESMA lógica, não o mesmo valor:
                       o número usa −0,03em porque tem 90px, e texto grande
                       precisa de tracking negativo. Em 20px, −0,03em fecharia
                       as letras; −0,01em é o passo equivalente nesse corpo. */
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {/* ─── O CORAÇÃO GÊMEO INVISÍVEL ──────────────────────────
                      O 💜 é decoração e fica só à direita, mas o bloco todo é
                      que está centrado — então ele empurrava a PALAVRA para a
                      esquerda. Medido: o nome saía com o centro em 202,5 numa
                      tela cujo eixo é 215. 12,5px, contra os 2px que o "20"
                      tinha antes de eu corrigir.
                      A cópia invisível à esquerda devolve a palavra ao eixo, e
                      é o único jeito que funciona em qualquer aparelho: a
                      largura de um emoji muda com a fonte do sistema (Apple
                      Color Emoji, Noto), então qualquer compensação escrita em
                      px ou em `em` estaria certa num celular e errada no
                      seguinte. O gêmeo mede sempre exatamente o mesmo que o
                      original, porque É o original. */}
                  <span aria-hidden className="align-middle text-[0.72em] opacity-0">
                    💜
                  </span>{" "}
                  {babyName}{" "}
                  <span aria-hidden className="align-middle text-[0.72em]">
                    💜
                  </span>
                </p>
              )}

              {/* ─── A PÍLULA DO CLIMA SAIU (ago/2026) ────────────────────
                  Ficava aqui, à direita: ícone do céu + graus. Saiu por
                  decisão do dono, e a razão está registrada porque ela vale
                  para o que quiser ocupar este canto depois — "17°" com um
                  ícone é a informação MENOS útil da tela ocupando o segundo
                  lugar mais visível dela. Numa tela cujo assunto é o bebê, o
                  canto tinha de dizer algo sobre ele, ou não dizer nada.
                  Ficou não dizendo nada, e o céu voltou a ocupar o espaço.

                  O CLIMA em si NÃO saiu do produto: `useWeather` continua de
                  pé porque a chuva do céu (`SkyRain`) e o cartão de saudação
                  da segunda dobra leem dele. O que saiu foi só o mostrador.

                  ─── E QUEM MORA NELE AGORA (ago/2026) ────────────────────
                  O BEBÊ BOLHA. Ele é a voz do app: avisa quantos recados
                  existem, leva à central com um toque, e é por ele que o
                  tutorial do primeiro acesso vai falar. Quando não há nada a
                  dizer, fica quieto — que é o que faz a fala valer alguma coisa
                  quando aparece. Ver `mascote-da-home.tsx`, inclusive para as
                  três coisas que impedem a paciente de confundi-lo com a bolha
                  do CENTRO, que é o bebê dela.

                  Ele cumpre a régua que a pílula do clima não cumpria: o canto
                  voltou a dizer algo, e o que ele diz é sobre ela. */}
              <MascoteDaHome
                humor={humorDoMascote}
                fala={conforto ? { texto: conforto, aria: "Abrir recados" } : null}
                /* `temNaoLidas` continua mandando no SE, e `naoLidas` só no
                   QUANTOS. Quem passa só o booleano (a bancada, e qualquer
                   chamador antigo) recebe 1 em vez de zero — senão o mascote
                   ficaria mudo justamente quando o app disse que há recado. */
                recados={temNaoLidas ? Math.max(1, naoLidas) : 0}
                calado={mascoteCalado}
                careMode={careMode}
                onAbrir={onOpenRecados ?? onOpenMenu}
              />
            </div>

            {isMadrugada && (
              <p className="mt-3 text-center text-[11px] text-white/65">
                🌙 Madrugada — tente descansar um pouco
              </p>
            )}
          </div>

          {gest && baby ? (
            /* ─── A BOLHA, CENTRADA NA IMAGEM (ago/2026) ───────────────────
             Pedido do dono, ao mandar a arte nova: "você vai deixar a bolha do
             bebê centralizada nessa imagem".

             Centrada NA IMAGEM, e não no que sobra da tela: por isso é uma
             camada `absolute inset-0` do hero — que tem a proporção da arte —,
             e não mais um item de coluna entre espaçadores.

             `inset-0` no filho de um container com padding pega a CAIXA DE
             PREENCHIMENTO inteira — o `px-5`/`pt` do hero não desloca o
             centro, que é o que faz o eixo da bolha bater com o eixo da arte.

             ⚠️ A BOLHA E O NÚMERO SÃO DUAS CAMADAS, e não uma coluna com
             espaçadores. Tentei a coluna primeiro — dois `flex-1` em volta da
             bolha, com o `pb` da barra flutuante dentro do item de baixo — e o
             resultado foi a bolha 65px ACIMA do centro, medido. O motivo: num
             flex, `flex-basis: 0%` mede a caixa de CONTEÚDO, e o padding entra
             POR FORA — então os 130px reservados para a barra viraram 130px a
             mais no item de baixo. Padding não é neutro num item flexível.

             `pointer-events-none` na camada e `auto` no botão: a camada cobre a
             barra de topo, e sem isso ela engoliria o toque do menu. */
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {/* Bebê protagonista dentro da bolha (o "ventre").
                Toque abre a aba do Bebê com a semana detalhada — e pede a
                sub-aba "semana" de propósito: a aba do Bebê agora abre numa
                grade de seis, e este toque promete a semana, não um menu. */}
              <button
                onClick={() => onNavigate("Bebê", "semana")}
                aria-label="Ver a semana do bebê"
                className="press pointer-events-auto relative flex shrink-0 items-center justify-center transition-transform active:scale-[0.97]"
              >
                {/* A caixa que manda em bolha e bebê. TRÊS tetos, e o menor
                      vence: 60% da largura, 19,5rem de teto absoluto, e 38% da
                      ALTURA da tela.

                      O termo em `svh` é o que conserta o celular deitado. Sem
                      ele a bolha era medida só pela largura enquanto a
                      variante `short` disparava pela altura — numa tela
                      larga-e-baixa (667×375) ela recebia o tamanho de uma tela
                      estreita, a coluna não cabia, e o "20" terminava 54px
                      ABAIXO do viewport, atrás da barra. Medido.

                      Com os três termos o `short:` na largura fica
                      desnecessário, e some junto o degrau que ele criava: em
                      849px a bolha saltava 25% de uma vez, e a tela MAIOR
                      ficava mais apertada que a menor. */}
                <div className="relative aspect-square w-[min(60vw,19.5rem,38svh)]">
                  <BabyOrb />
                  {/* `scale` porque o SVG do bebê tem margem interna larga.
                      O valor anterior (1.43) vinha de uma medição ERRADA: ela
                      media a CAIXA do SVG, não a tinta. Medido pixel a pixel
                      na tela — contando só o que é pele contra o azul da
                      bolha —, em 1.43 o bebê ocupava 55,8% da altura da
                      bolha, e a referência do rebranding traz ~80%. Daí a
                      leitura de "bola COM um bebê" em vez de "bebê DENTRO".
                      O que limita não é a caixa (ela pode transbordar à
                      vontade, é margem vazia): é a TINTA encostar na parede
                      de vidro.

                      ─── POR QUE 1,65 E NÃO 2 ────────────────────────────
                      A escala é a MESMA em todas as semanas, mas o DESENHO
                      cresce com a gestação — é o ponto do produto. Então o
                      teto não é a semana 20 da referência: é a 40. Medido
                      (altura da tinta sobre a altura da bolha):

                        escala   s8      s20     s32     s40
                        1,43    34,5%   55,8%   71,6%   80,8%
                        2,00    49,6%   78,1%   ENCOSTA ENCOSTA
                        1,65    39,7%   64,5%   82,6%   93,2%

                      Em 2,00 a semana 20 chega aos 80% da referência, mas a
                      32 e a 40 batem na parede de vidro. 1,65 é o maior valor
                      em que as quatro ainda cabem. Mexer aqui obriga a medir
                      a 40 de novo, nunca só a 20. */}
                  <BabyIllustration
                    week={gest.weeks}
                    tone={babyTone}
                    showSac={false}
                    showInfo={false}
                    /* `dc-bebe-deriva` anima `transform`; o `scale-[1.65]`
                         do Tailwind v4 escreve na propriedade `scale`, que é
                         OUTRA. As duas compõem sem se atropelar — se a escala
                         viesse por `transform`, a animação a apagaria e o bebê
                         encolheria de volta ao tamanho antigo. */
                    className="dc-bebe-deriva absolute inset-0 h-full w-full origin-center scale-[1.65] drop-shadow-[0_14px_32px_rgba(120,70,90,0.26)]"
                  />
                </div>
              </button>
            </div>
          ) : null}

          {/* ── A SEMANA, NO MEIO ENTRE A BOLHA E A BARRA ────────────────────
            Pedido do dono: "coloque o número 20 semanas ali no meio entre a
            bolha e a navbar". Ela tinha descido para o fundo claro na volta
            anterior; volta para a arte, e agora com um lugar DEFINIDO.

            ─── POR QUE ESTA CAMADA COMEÇA NA METADE DA ARTE ──────────────
            `top-1/2` é o CENTRO da bolha, e daí para baixo a caixa é fixa
            (`bottom-0`): num bloco posicionado com topo E base presos, o
            padding não muda o tamanho de fora — ele só encolhe o miolo. Então
            o `pt` de meia bolha e o `pb` da barra flutuante recortam
            exatamente o vão entre as duas, e `items-center` põe o número no
            meio dele. É a mesma reserva que, dentro de um item flex, tinha
            arrastado a bolha para cima.

            Medido no iPhone 15 Pro: bolha termina em 542,7 · número centrado
            em 631,2 · barra começa em 719,6.

            O `min(60vw,19.5rem,38svh)` é o MESMO da caixa da bolha, e tem de
            continuar sendo: é meia bolha que este `pt` reserva. Mudar o
            tamanho da bolha sem mudar aqui faz o número subir por cima dela.

            O halo (`overArt`) volta junto e não é enfeite: aqui o fundo é a
            arte, e a do dia tem a faixa amarela do horizonte passando bem
            atrás dos dígitos. */}
          {gest && baby && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 flex items-center justify-center pt-[calc(min(60vw,19.5rem,38svh)/2)] pb-[calc(var(--safe-bottom)+6rem)] short:pb-[calc(var(--safe-bottom)+5.5rem)]"
              style={overArt}
            >
              <div className="flex flex-col items-center">
                <p
                  className={`leading-[0.92] ${heroText}`}
                  style={{
                    color: corDoCorpo,
                    /* HERDA a face do corpo, que é a geométrica do sistema (SF
                       Pro Text no Apple, DM Sans de reserva). A `--font-serif`
                       deste projeto é na verdade a ARREDONDADA — bonita nos
                       títulos, mas a referência traz o número numa geométrica
                       reta. Preso a uma fonte fixa, o maior número da tela era
                       o único texto que NÃO seguia a fonte do sistema. */
                    fontFamily: "inherit",
                    /* O termo em `svh` é irmão do que dimensiona a bolha: só
                       pela LARGURA, o número ficava com 104px numa tela de
                       375px de altura (celular deitado) e empurrava a coluna
                       para fora da dobra. Em retrato o `21vw` vence, então
                       nada muda no aparelho de pé. */
                    fontSize: "clamp(2.75rem, min(21vw, 11.5svh), 6rem)",
                    /* 500 (Medium) e não 600. Em 90px o Semi-Bold empasta: a
                       contra-forma do "0" fecha e o número lê como bloco — foi
                       o "muito grosseira" do dono. */
                    fontWeight: 500,
                    letterSpacing: "-0.03em",
                    /* ─── POR QUE NÃO `tabular-nums` AQUI ─────────────────
                       Figura tabular existe para alinhar COLUNA de números:
                       dá a todo dígito a mesma largura de avanço, o que obriga
                       o "1" a nadar num vão largo e desloca a tinta dentro da
                       caixa. Medido: com tabular, a tinta do "20" caía 2,25px
                       à direita do centro enquanto a de "semanas" caía 0,75px
                       à esquerda — 3px de desencontro entre duas linhas
                       empilhadas. Sem tabular, e com o `textIndent` abaixo, o
                       desencontro cai para 0,15px
                       (`scripts/centragem-hero.mjs`).

                       `textIndent` corrige o que sobra: `letter-spacing` entra
                       DEPOIS de cada caractere, inclusive o último, e esse vão
                       fantasma no fim empurra a tinta para o lado. Metade do
                       valor, com sinal trocado, devolve a tinta ao eixo. */
                    fontVariantNumeric: "lining-nums",
                    textIndent: "-0.015em",
                  }}
                >
                  {gest.weeks}
                </p>
                <p
                  className={`-mt-0.5 text-[clamp(0.85rem,min(4.8vw,2.8svh),1.375rem)] font-medium leading-none ${heroMuted}`}
                  style={{ color: corDoCorpo }}
                >
                  {gest.weeks === 1 ? "semana" : "semanas"}
                </p>
              </div>
            </div>
          )}

          {/* Sem gestação configurada não há bolha nem número, e o recado ocupa o
            lugar dos dois — centrado na arte, pela mesma régua. */}
          {!(gest && baby) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
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

        {/* ── A EMENDA ENTRE O CÉU E A PÁGINA ──────────────────────────────
            O céu tem de acabar em algum lugar, e até aqui ele acabava num
            CORTE: a última linha da arte e, encostado nela, o creme da página.
            Foi assim que o dono viu a "faixa embaixo" — o que salta aos olhos
            não é a faixa existir, é ela ser uma aresta.

            Esta é a segunda defesa, e ela vale mesmo que a primeira falhe: se
            um aparelho ainda fechar o céu antes do fim da tela, o que aparece
            ali embaixo é a COR DO PÉ DA CENA continuando, e não creme. Some a
            aresta, some o defeito — e num aparelho em que a altura fecha certo,
            esta faixa só se vê ao rolar, que é quando a página começa mesmo.

            `corDeBaixo` é o último pixel da arte, amostrado dela e não
            estimado, então a emenda começa exatamente na cor em que a cena
            termina. O degradê vai a `--background` explícito e não a
            `transparent`: `transparent` é preto-transparente, e o meio do
            caminho sairia acinzentado.

            O Céu Clássico fica de fora porque ele não tem `corDeBaixo` — é um
            gradiente desenhado, não uma foto amostrada. Inventar uma cor para
            ele seria pintar uma emenda de cor errada, que é pior que a aresta
            que já existia. */}
        {!ceuClassico && (
          <div
            aria-hidden
            className="-mx-5 h-32 short:h-24"
            style={{
              background:
                `linear-gradient(to bottom, ${slot.corDeBaixo} 0%,` +
                ` ${slot.corDeBaixo} 22%, var(--background) 100%)`,
            }}
          />
        )}
      </div>

      {/* A semana VOLTOU para cima da arte (ago/2026), no meio entre a bolha
          e a barra de baixo — ver o bloco dela dentro do hero. Ela chegou a
          morar aqui, no fundo claro, por uma volta só. */}

      {/* ── Saudação do dia e o conselho ──────────────────────────────────
          Desceu junto com a semana, pelo mesmo pedido, e por isso trocou o
          `glass` pelo material do cartão: vidro precisa de céu atravessando
          para existir, e aqui embaixo o fundo é o creme da página — o mesmo
          motivo pelo qual a barra de progresso largou o vidro quando desceu.

          O clima aparece UMA vez na tela. Antes havia repetição em três
          camadas: uma pílula lá em cima dizia "Céu limpo", esta linha trazia
          DOIS emojis de sol (um de cada lado do nome) e a dica ainda abria com
          "Céu aberto —". */}
      {gest && baby && weather && (
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
          <span className="mt-0.5 text-xl leading-none">{weather.emoji}</span>
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-foreground">
              {dayGreetingLabel()}
              {babyName ? `, ${babyName}!` : "!"}
            </p>
            {/* O que separa título de dica é o PESO, não a cor: o mesmo
                `muted` a 12px e peso normal lia bem mais claro que o `muted` a
                11px em negrito do "% concluído" — mesma cor no código, dois
                cinzas diferentes no olho. */}
            <p className="mt-0.5 text-[12px] leading-snug text-foreground">{weather.tip}</p>
          </div>
        </div>
      )}

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

      {/* ── PROGRESSO ─────────────────────────────────────────────────
          Início · % concluído · Parto previsto.

          ─── POR QUE AQUI, E NÃO NA PRIMEIRA DOBRA ────────────────────
          Pedido do dono, e ele teve de repetir porque eu errei na primeira
          vez: "não era tirar esse elemento, e sim posicionar mais embaixo
          para ficar fora da vista da tela principal, antes dessa área do seu
          médico, porém já nessa outra parte onde o fundo é mais claro".

          A primeira dobra é do bebê: a bolha, o número da semana, e nada
          mais. Quem rola encontra o resto — e é aí que uma porcentagem cabe,
          porque quem rolou escolheu olhar.

          ─── E POR QUE ELE NÃO USA MAIS O `glass` ─────────────────────
          O vidro existe para ter céu atravessando. Aqui embaixo o fundo é o
          creme da página, e vidro sobre fundo chapado vira um retângulo
          cinza. Este cartão passa a usar o mesmo material do cartão do
          médico, que é o vizinho dele. */}
      {gest && baby && (
        <div className="mb-3 rounded-3xl border border-border bg-card px-4 py-3.5 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3">
            <div className="text-left">
              <p className="text-[10px] font-medium text-muted-foreground">Início</p>
              <p className="text-[11px] font-bold text-foreground">
                {dateOffsetLabel(-(gest.totalDays ?? 0))}
              </p>
            </div>

            <div>
              <p className="text-center text-[11px] font-bold text-muted-foreground">
                {Math.round(progress ?? 0)}% concluído
              </p>
              {/* Trilho com o coração na posição de hoje */}
              <div className="relative mt-1.5 h-5">
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
                <div
                  className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-700"
                  style={{
                    width: `${progress ?? 0}%`,
                    background: "linear-gradient(90deg, #c4b5fd, #a855f7)",
                  }}
                />
                <span
                  aria-hidden
                  className="absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] shadow-md transition-all duration-700"
                  style={{ left: `${progress ?? 0}%` }}
                >
                  💜
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-medium text-muted-foreground">Parto previsto</p>
              <p className="text-[11px] font-bold text-foreground">
                {dateOffsetLabel(daysLeft ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}

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
