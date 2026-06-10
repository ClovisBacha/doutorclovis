/**
 * Componentes da experiência mobile do app autenticado:
 *   - AppBottomNav   – barra inferior com 5 abas de ícones
 *   - AppHomeScreen  – tela inicial estilo dashboard de app nativo
 *   - SectionHeader  – cabeçalho de categoria com botão voltar
 */
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
  | "Perfil";

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
   AppBottomNav
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
            className={`flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors duration-200 ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon
              className={`h-6 w-6 transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${active ? "scale-110" : "scale-100"}`}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>
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

const GRID: { Icon: LucideIcon; label: string; tab: AppTab; color: string }[] = [
  {
    Icon: Baby,
    label: "Bebê",
    tab: "Bebê",
    color: "bg-pink-50 text-pink-600 ring-pink-200",
  },
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
}: {
  firstName: string;
  babyName: string | null;
  gest: GestInfo;
  onNavigate: (tab: AppTab) => void;
}) {
  const baby = gest ? babyForWeek(gest.weeks) : null;
  const progress = gest ? Math.min(100, (gest.totalDays / 280) * 100) : null;

  return (
    <div className="space-y-5 pb-2">
      {/* Cabeçalho de boas-vindas */}
      <div className="rounded-3xl bg-[var(--gradient-warm)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Olá, {firstName} 💛
        </p>
        {gest && baby ? (
          <>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-serif text-3xl leading-none text-foreground">
                  Semana {gest.weeks}
                  <span className="ml-1 text-lg text-muted-foreground">e {gest.days}d</span>
                </p>
                {babyName && (
                  <p className="mt-1 text-sm text-muted-foreground">Acompanhando {babyName}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                    {baby.size}
                  </span>
                  <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                    {baby.weight}
                  </span>
                  <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                    🍓 {baby.fruit}
                  </span>
                </div>
              </div>
              <div className="w-24 shrink-0">
                <BabyIllustration week={gest.weeks} />
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                <span>Início</span>
                <span>{Math.round(progress ?? 0)}% concluído</span>
                <span>Parto</span>
              </div>
              <div className="h-2 w-full rounded-full bg-border/60">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">
              Configure sua data de gestação em <strong>Perfil</strong> para ver o desenvolvimento.
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

      {/* Grade de ícones */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Acesso rápido
        </p>
        <div className="grid grid-cols-4 gap-2">
          {GRID.map(({ Icon, label, tab, color }) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className="group flex flex-col items-center gap-1.5 rounded-2xl p-2.5 transition-all duration-200 active:scale-95 hover:bg-secondary"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 [transition-timing-function:var(--ease-spring)] group-active:scale-90 ${color}`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <span className="text-[10px] font-medium leading-tight text-center text-foreground/80">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Card do médico */}
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

      {/* Chat IA destaque */}
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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-primary active:scale-95"
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
