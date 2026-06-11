/**
 * Mockups de iPhone com telas reais do app — usados na home do site
 * para mostrar o produto antes do cadastro.
 *
 * As telas replicam fielmente o visual do app (AppHomeScreen e abas),
 * em versão estática para marketing.
 */
import {
  Activity,
  Baby,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Footprints,
  Heart,
  MessageCircle,
  Mic,
  Send,
  Stethoscope,
  Video,
} from "lucide-react";
import { BabyIllustration } from "@/components/baby-illustration";

/** Moldura de iPhone com Dynamic Island. Conteúdo via children. */
export function PhoneFrame({
  children,
  className = "",
  tilt = "none",
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: "left" | "right" | "none";
}) {
  const tiltClass =
    tilt === "left"
      ? "md:-rotate-3 md:hover:rotate-0"
      : tilt === "right"
        ? "md:rotate-3 md:hover:rotate-0"
        : "";
  return (
    <div
      className={`relative w-[270px] shrink-0 transition-transform duration-700 [transition-timing-function:var(--ease-out-expo)] ${tiltClass} ${className}`}
    >
      {/* corpo do telefone */}
      <div className="relative rounded-[2.8rem] border-[10px] border-[oklch(0.2_0.01_270)] bg-[oklch(0.2_0.01_270)] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)]">
        {/* dynamic island */}
        <div className="absolute left-1/2 top-2.5 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-[oklch(0.2_0.01_270)]" />
        {/* tela */}
        <div className="relative h-[560px] overflow-hidden rounded-[2.1rem] bg-background">
          {/* status bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-3 text-[10px] font-semibold text-foreground">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-[2px] bg-foreground/70" />
              <span className="inline-block h-2.5 w-4 rounded-[3px] border border-foreground/70 p-px">
                <span className="block h-full w-3/4 rounded-[1px] bg-foreground/70" />
              </span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Tela Home do app — semana, bebê, clima, progresso, próxima consulta. */
export function AppHomeMockupScreen() {
  return (
    <div className="space-y-2.5 px-3 pt-2">
      {/* hero card com gradiente de fim de tarde + clima */}
      <div
        className="relative overflow-hidden rounded-3xl p-4"
        style={{
          background:
            "linear-gradient(160deg, oklch(0.93 0.05 75), oklch(0.9 0.07 45) 55%, oklch(0.87 0.06 25))",
        }}
      >
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-primary">
          Olá, Mariana 💛
        </p>
        <div className="mt-1.5 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1">
              <p className="font-serif text-[2.6rem] leading-none tracking-tight text-foreground">
                24
              </p>
              <div>
                <p className="text-[9px] font-semibold leading-tight text-muted-foreground">
                  semanas
                </p>
                <p className="text-[9px] text-muted-foreground">3 dias</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["30 cm", "600 g", "🌽 espiga de milho"].map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-card/80 px-1.5 py-0.5 text-[8px] font-medium text-foreground shadow-sm"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div className="w-16 shrink-0 scale-[0.45] origin-top-right">
            <BabyIllustration week={24} />
          </div>
        </div>
        {/* progresso */}
        <div className="mt-2">
          <div className="mb-0.5 flex justify-between text-[7px] text-muted-foreground">
            <span>Início</span>
            <span>60% concluído</span>
            <span>Parto</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border/60">
            <div className="h-1.5 w-[60%] rounded-full bg-primary" />
          </div>
        </div>
        {/* strip de clima */}
        <div className="mt-2 flex items-start gap-1.5 rounded-2xl bg-white/40 px-2 py-1.5 backdrop-blur-sm">
          <span className="text-sm leading-none">⛅</span>
          <div>
            <p className="text-[8px] font-semibold text-foreground/80">
              24°C · Parcialmente nublado
            </p>
            <p className="text-[8px] leading-snug text-foreground/65">
              ⛅ Clima agradável para uma caminhada curta
            </p>
          </div>
        </div>
      </div>

      {/* próxima consulta */}
      <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 px-2.5 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <CalendarDays className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-blue-500">
            Próxima consulta
          </p>
          <p className="text-[9px] font-medium text-foreground">Sexta, 19 de junho · 14h30</p>
        </div>
        <ChevronRight className="h-3 w-3 text-blue-400" />
      </div>

      {/* grade de acesso rápido */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { icon: Footprints, label: "Chutes", color: "bg-rose-50 text-rose-500" },
          { icon: Activity, label: "Saúde", color: "bg-emerald-50 text-emerald-600" },
          { icon: MessageCircle, label: "Chat IA", color: "bg-violet-50 text-violet-600" },
          { icon: BookOpen, label: "Escola", color: "bg-amber-50 text-amber-600" },
          { icon: Video, label: "Teleconsulta", color: "bg-sky-50 text-sky-600" },
          { icon: Heart, label: "Diário", color: "bg-pink-50 text-pink-500" },
          { icon: Stethoscope, label: "Pré-consulta", color: "bg-teal-50 text-teal-600" },
          { icon: Baby, label: "Semana", color: "bg-orange-50 text-orange-500" },
        ].map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-card px-1 py-2"
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[7px] font-medium text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tela do Chat IA. */
export function AppChatMockupScreen() {
  return (
    <div className="flex h-full flex-col px-3 pt-2">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-foreground">Assistente Obstétrica</p>
          <p className="flex items-center gap-1 text-[8px] text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> disponível 24h
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-2 py-3">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-2.5 py-1.5">
          <p className="text-[9px] leading-relaxed text-primary-foreground">
            Estou com 24 semanas e senti uma dor leve embaixo da barriga, é normal?
          </p>
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-2.5 py-1.5">
          <p className="text-[9px] leading-relaxed text-foreground">
            Pode ser a <strong>dor do ligamento redondo</strong> — comum no 2º trimestre quando o
            útero cresce. Geralmente é uma pontada breve ao mudar de posição. 💛
          </p>
          <p className="mt-1 text-[9px] leading-relaxed text-foreground">
            <strong>Procure atendimento se:</strong> a dor for intensa, contínua, com sangramento ou
            febre.
          </p>
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-2.5 py-1.5">
          <p className="text-[9px] text-muted-foreground">
            Quer que eu registre esse sintoma no seu diário de saúde?
          </p>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2">
        <p className="flex-1 text-[9px] text-muted-foreground">Escreva sua dúvida...</p>
        <Mic className="h-3 w-3 text-muted-foreground" />
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Send className="h-2.5 w-2.5 text-primary-foreground" />
        </span>
      </div>
    </div>
  );
}

/** Tela de Saúde — gráficos de peso e pressão. */
export function AppSaudeMockupScreen() {
  // pontos do gráfico de peso (svg polyline)
  const weights = [62, 62.4, 63.1, 63.8, 64.2, 65, 65.6, 66.3];
  const min = 61.5;
  const max = 67;
  const pts = weights
    .map((w, i) => `${8 + i * 32},${72 - ((w - min) / (max - min)) * 58}`)
    .join(" ");
  return (
    <div className="space-y-2.5 px-3 pt-2">
      <p className="font-serif text-base text-foreground">Minha saúde</p>

      <div className="rounded-3xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Peso (kg)
          </p>
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-medium text-emerald-600">
            ganho adequado ✓
          </span>
        </div>
        <svg viewBox="0 0 240 80" className="mt-1 w-full">
          <polyline
            points={pts}
            fill="none"
            stroke="oklch(0.57 0.1 22)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {weights.map((w, i) => (
            <circle
              key={i}
              cx={8 + i * 32}
              cy={72 - ((w - min) / (max - min)) * 58}
              r="3"
              fill="oklch(0.57 0.1 22)"
            />
          ))}
        </svg>
        <p className="text-right text-[8px] text-muted-foreground">últimas 8 semanas</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-2.5">
          <p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Pressão</p>
          <p className="mt-0.5 font-serif text-lg text-foreground">
            110<span className="text-xs text-muted-foreground">/</span>72
          </p>
          <p className="text-[8px] text-emerald-600">✓ dentro do esperado</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-2.5">
          <p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
            Chutes hoje
          </p>
          <p className="mt-0.5 font-serif text-lg text-foreground">
            12 <span className="text-xs">👣</span>
          </p>
          <p className="text-[8px] text-emerald-600">✓ bebê ativo</p>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-2.5">
        <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-rose-500">
          Triagem inteligente
        </p>
        <p className="mt-1 text-[9px] leading-snug text-foreground">
          Seus registros estão saudáveis. Qualquer sintoma de alerta, o app avisa você — e o Dr.
          Clóvis também. 💛
        </p>
      </div>
    </div>
  );
}
