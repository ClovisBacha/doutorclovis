import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { subtabPermitida, subtabsDoBebe } from "@/lib/subtabs-do-bebe";
import { nivelDaEpds, respostaDaQuestao10 } from "@/lib/epds";
import { codificarFoto } from "@/lib/codificar-imagem";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect as useLayoutEffectReact,
  useMemo,
  useRef,
  useState,
} from "react";

/* `useLayoutEffect` avisa no servidor, onde não existe layout para medir. No
   servidor ele vira `useEffect` (que também não roda), e no navegador é o de
   verdade — é o padrão isomórfico usual. */
const useLayoutEffect = typeof window !== "undefined" ? useLayoutEffectReact : useEffect;
import {
  AppBottomNav,
  AppHomeScreen,
  tabToSection,
  type AppTab,
  type BottomSection,
  type DestaqueDoTutorial,
  type NextAppointment,
} from "@/components/app-mobile-shell";
import { TabErrorBoundary } from "@/components/tab-error-boundary";
import { TabSkeleton } from "@/components/tab-skeleton";
import { BabyJourneyModal, PremiumUpsellModal } from "@/components/baby-journey";
import { supabase } from "@/integrations/supabase/client";
import { avisoQuePodeAparecer, lerLinhaDoStream, passoDaDigitacao } from "@/lib/chat-stream";
import { formatarDinheiro } from "@/lib/dinheiro";
import { DOCTOR } from "@/lib/doctor.config";
import drPortrait from "@/assets/dr-clovis-portrait.jpg";
/* Os ícones 3D da aba Saúde (set/2026). Gerados numa família só — vidro, cor
   natural do objeto, luz ambiente — e recortados por `scripts/bebes/do-drive.mjs`
   (PSNR 46–50 dB). Substituem os traços do Lucide nos blocos grandes: um bloco
   de 300px pedia um objeto com volume, não um contorno de 1,7px. */
import icSaude from "@/assets/saude/saude.webp";
import icChutes from "@/assets/saude/chutes.webp";
import icContracoes from "@/assets/saude/contracoes.webp";
import icNutricao from "@/assets/saude/nutricao.webp";
import icMulher from "@/assets/saude/mulher.webp";
import { ymdLocal } from "@/lib/utils";
import { getMyDoctor } from "@/lib/doctors.functions";
import { minhasConsultas, type ConsultaDaPaciente } from "@/lib/clinical.functions";
import {
  getMyAppointments,
  respondToProposedTime,
  type MyAppointment,
} from "@/lib/appointments.functions";
import {
  joinWaitlist,
  getMyWaitlist,
  leaveWaitlist,
  respondWaitlistOffer,
  mondayOf,
  WAITLIST_RESPONSE_HOURS,
  type WaitlistEntry,
} from "@/lib/waitlist.functions";
import { HeartbeatFeel } from "@/components/heartbeat-feel";
import { Stagger, StaggerItem, Fade } from "@/components/motion-primitives";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { PesquisaNps } from "@/components/pesquisa-nps";
import { ConsultoriosDoMedico } from "@/components/consultorios-do-medico";
import { EmergencySheet } from "@/components/emergency-sheet";
import { NaoConsegueLer } from "@/components/nao-consegui-ler";
import { CicloMenstrualTab } from "@/components/ciclo-menstrual-tab";
import { SilencioDoCuidado } from "@/components/silencio-do-cuidado";
import { ConquistasTab } from "@/components/conquistas-tab";
import { CantinhoTab } from "@/components/cantinho-tab";
import { triggerAchievementsCheck } from "@/lib/checar-conquistas";
import {
  PHASE_META,
  WEEKDAYS_PT,
  addDays,
  avgCycleLength,
  avgPeriodLength,
  buildCycleModel,
  classifyDay,
  cycleDayFor,
  cycleLengthDays,
  diffDays,
  fromYmd,
  phaseForCycleDay,
  startOfDay,
  upcomingMarks,
  ymd,
} from "@/lib/ciclo-menstrual";
import type { CycleModel, CyclePhase } from "@/lib/ciclo-menstrual";
import { OnboardingRitual } from "@/components/onboarding-ritual";
import { hapticKick, hapticTap } from "@/lib/haptics";
import { createBreathAudio } from "@/lib/breath-audio";
import { CompartilharMomento } from "@/components/compartilhar-momento";
import {
  CONVITE_DA_COMUNIDADE,
  ofereceAComunidade,
  TEXTO_PERFIL_PUBLICO,
} from "@/lib/chaves-do-perfil";
import { momentoDe, type Momento } from "@/lib/momento";
import { guardarMomentoParaPublicar } from "@/lib/momento-para-publicar";
import { motion, AnimatePresence } from "motion/react";
import { fireConfetti, celebrateChime, celebrateHaptic } from "@/lib/celebrate";
import { carimbarModoCuidado, tocarSomDeUI } from "@/lib/tocar-som-de-ui";
import { creditarSementinhas, ouvirSementinhas } from "@/lib/evento-sementinhas";
import { BONUS_INFLUENCIADORA } from "@/lib/economia-sementinhas";
import { ouvirConquistasAResgatar, publicarConquistasAResgatar } from "@/lib/evento-conquistas";
import { ativarAvisos, renovarAvisosSeJaAutorizado } from "@/lib/avisos";
import { ExcluirConta } from "@/components/excluir-conta";
import { ExportarDados } from "@/components/exportar-dados";
import { apagarMinhasConversas } from "@/lib/conta.functions";
import { sendTestPushToMe } from "@/lib/push.functions";
import {
  minhasDuvidasRegistradas,
  submitBrainFeedback,
  type DuvidaRegistrada,
} from "@/lib/secondbrain.functions";
import { toast } from "sonner";
import { MOOD_LABEL, dayGreeting } from "@/lib/humor-e-saudacao";
import { BabyTab } from "@/components/baby-tab";
import {
  sinalContracoesPrematuras,
  sinalGlicemia,
  sinalPressao,
  validaRegistro,
  vozDaPaciente,
} from "@/lib/sinais-clinicos";
import { checkIsAdmin } from "@/lib/admin.functions";
import {
  babyForWeek,
  fruitEmojiForWeek,
  computeGestation,
  consultaForWeek,
  dueDateFromLmp,
  retaFinalMensagemFor,
  trimesterForWeek,
} from "@/lib/gestacao";
import { faltamTrofeus, trofeusExigidos } from "@/lib/trofeus";
import { BabyIllustration, BABY_TONES } from "@/components/baby-illustration";
import { assessSymptoms, saveTriageLog } from "@/lib/triage.functions";
import { RED_SYMPTOMS, YELLOW_SYMPTOMS, type RiskLevel } from "@/lib/triage";
import {
  submitPreConsulta,
  getMyPreConsultas,
  type PreConsultaForm,
} from "@/lib/preconsulta.functions";
import {
  getMyTeleconsultas,
  savePatientNotes,
  type TeleconsultaSession,
} from "@/lib/teleconsulta.functions";
import {
  getMyAlbumPosts,
  createAlbumPost,
  deleteAlbumPost,
  getOrCreateNameSession,
  addNameByPatient,
  toggleNameSession,
  removeNameEntry,
  type AlbumPost,
  type NameEntry,
  type NameSession,
} from "@/lib/family.functions";
import { getCourseProgress, type CourseProgress } from "@/lib/escola.functions";
import { COURSE_MODULES } from "@/lib/course-modules";
import {
  checkAndAwardAchievements,
  ACHIEVEMENT_DEFS,
  type AchievementDef,
} from "@/lib/achievements.functions";
import { RARIDADES } from "@/lib/conquistas";
import { CONJUNTO_POR_ID, conjuntosDoItem, conjuntosOrdenados } from "@/lib/conjuntos";
import { claimDailyAndGetWallet } from "@/lib/sementinhas.functions";
import {
  CANTINHO_ITEMS,
  CANTINHO_CATEGORIES,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_COMPLETION_MIN,
  cantinhoCategoriasCompletas,
  isCantinhoCollectionComplete,
  type CantinhoType,
} from "@/lib/cantinho";
import {
  getCantinho,
  buyCantinhoItem,
  setCantinhoFundo,
  setSkyTheme,
} from "@/lib/cantinho.functions";
import { getInstagramShare, setInstagramHandle } from "@/lib/instagram.functions";
import { getRatingReward, claimRatingReward } from "@/lib/rating.functions";
import {
  getMyTestimonial,
  submitTestimonial,
  type TestimonialStatus,
} from "@/lib/testimonials.functions";
import { getReferral, attributeReferral } from "@/lib/referral.functions";
import { linkDeIndicacao, mensagemDeConvite } from "@/lib/indicacao";
import { AmigasTab } from "@/components/amigas";
import { ComunidadeTab } from "@/components/comunidade";
import { ChaDeBebe } from "@/components/cha-de-bebe";
import { CabecalhoDaPorta } from "@/components/comunidade";
import { ConfiguracoesDoPerfil } from "@/components/rede-social";
import { aulaDeHojeParaCompartilhar } from "@/lib/aula-compartilhavel";
import type { AulaNoPost } from "@/lib/rede-social";
import { AssinaturaTab } from "@/components/assinatura-tab";
/* A busca do DIRETÓRIO, a mesma da página pública: ranqueada por plano, com
   cidade, tempo de experiência e selo. A busca que morava aqui era uma RPC
   alfabética que só devolvia nome e especialidade — e exigia selo, então
   nenhum médico recém-cadastrado aparecia. Duas buscas com regras diferentes
   para a mesma pergunta é uma a mais do que o app precisa. */
import { searchDoctors as buscarDiretorio, type DirectoryDoctor } from "@/lib/doctors.functions";
import {
  storedReferralCode,
  clearStoredReferralCode,
  storedAffiliateCode,
  clearStoredAffiliateCode,
} from "@/routes/__root";
import { setCareMode } from "@/lib/care-mode.functions";
/**
 * ⚠️ `GestacaoPath` É `lazy()`, e o motivo é medido.
 *
 * O componente do jogo é o maior do app: 892 KB crus / 264 KB comprimidos,
 * contando o banco de aulas que morava dentro dele. Importado direto, ele
 * descia junto com a tela de Minha Conta INTEIRA — para toda paciente, toda
 * visita, mesmo quando ela só ia ver a próxima consulta e sair.
 *
 * `lsGet`/`lsSet`/`ensureInitialJourneyPull` vêm de `journey-sync` e não mais
 * daqui: enquanto viessem do componente, o `lazy()` não separaria nada — o
 * import estático de UMA função traz o módulo inteiro junto, e era exatamente
 * isso que acontecia.
 */
const GestacaoPath = lazy(() =>
  import("@/components/gestacao-path").then((m) => ({ default: m.GestacaoPath })),
);

/**
 * ⚠️ **A COMUNIDADE TAMBÉM É `lazy()`, e pelo mesmo motivo medido.**
 *
 * `rede-instagram.tsx` são ~120 kB crus / ~31 kB gzip, e era import ESTÁTICO —
 * ou seja, descia para TODA paciente que abre Minha Conta, inclusive quem nunca
 * toca na aba. É a mesma conta que fez `GestacaoPath` virar `lazy()` (264 → 91
 * kB) e que tirou o chatbot do chunk de entrada (255 kB).
 *
 * ⚠️ E, como lá, o que separa de verdade é o import estático NÃO EXISTIR: puxar
 * uma única função ou um único tipo deste módulo por `import` estático traria os
 * 120 kB de volta junto.
 */
const RedeNoApp = lazy(() =>
  import("@/components/rede-instagram").then((m) => ({ default: m.RedeNoApp })),
);
import { ensureInitialJourneyPull, lsGet, lsSet } from "@/lib/journey-sync";
import {
  CHAVE_DICA,
  CHAVE_VISITADAS,
  dicaDaSemana,
  falaDaDica,
  idDaFuncao,
  type DicaMostrada,
  type FuncaoDoApp,
} from "@/lib/mapa-do-app";
import { MapaDoApp } from "@/components/mapa-do-app";
import { ChatTab } from "@/components/chat-tab";
import { Bolha } from "@/components/bolha";
import { SKIN_KEY } from "@/lib/trilha-skins";
import { useSkyNow } from "@/components/app-mobile-shell";
import { NotificacoesSheet } from "@/components/notificacoes-sheet";
import { MenuDaConta } from "@/components/menu-conta";
import { TutorialDaBolha } from "@/components/tutorial-da-bolha";
import {
  chaveDoPassoDoTutorial,
  chaveDoTutorial,
  lerPassoDoTutorial,
} from "@/lib/tutorial-do-mascote";
import { GradeHub, VoltarDaGrade } from "@/components/grade-hub";
import arteGrade_agenda from "@/assets/grades/agenda.webp";
import arteGrade_preparo from "@/assets/grades/preparo.webp";
import arteGrade_perguntas from "@/assets/grades/perguntas.webp";
import arteGrade_checklist from "@/assets/grades/checklist.webp";
import arteGrade_parto from "@/assets/grades/parto.webp";
import arteGrade_tele from "@/assets/grades/tele.webp";
import arteGrade_particular from "@/assets/grades/particular.webp";
import arteGrade_meditacoes from "@/assets/grades/meditacoes.webp";
import arteGrade_sons from "@/assets/grades/sons.webp";
import arteGrade_exercicios from "@/assets/grades/exercicios.webp";
import arteGrade_humor from "@/assets/grades/humor.webp";
import arteGrade_apoio from "@/assets/grades/apoio.webp";
import arteGrade_diario from "@/assets/grades/diario.webp";
import arteGrade_timeline from "@/assets/grades/timeline.webp";
import arteBebe_semana from "@/assets/bebe/semana.webp";
import arteBebe_contagem from "@/assets/bebe/contagem.webp";
import arteBebe_album from "@/assets/bebe/album.webp";
import arteBebe_nome from "@/assets/bebe/nome.webp";
import arteBebe_carta from "@/assets/bebe/carta.webp";
import arteBebe_quartinho from "@/assets/bebe/quartinho.webp";
import {
  contarNaoLidas,
  lerLidas,
  marcarLidas,
  ordenar,
  visiveis,
  type Lidas,
  type Notificacao,
} from "@/lib/notificacoes";
import type { OrigemLocal } from "@/components/app-mobile-shell";
import {
  AudioLines,
  Baby,
  CalendarCheck,
  ChevronLeft,
  ClipboardList,
  Flower2,
  Gift,
  HeartPulse,
  IdCard,
  Footprints,
  HeartHandshake,
  History,
  Image as ImageIcon,
  Images,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MessageCircleQuestion,
  NotebookPen,
  PersonStanding,
  Ribbon,
  Salad,
  Scroll,
  Settings,
  ShoppingBag,
  Smile,
  Sparkles,
  Stethoscope,
  Timer,
  TriangleAlert,
  UserRound,
  Users,
  Video,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  requestDoctor,
  getMyDoctorLink,
  getMyDoctorContact,
  type DoctorContato,
  cancelDoctorRequest,
  getMyDoctorPix,
  type DoctorPublic,
  type MyDoctorLink,
} from "@/lib/patientlink.functions";
import {
  requestPrivateConsultation,
  getMyPrivateConsultations,
  markPaymentSent,
  CONSULT_TYPES,
  type PrivateConsultation,
} from "@/lib/consultaparticular.functions";
import {
  logCycleStart,
  updateCycleEnd,
  deleteCycle,
  getRecentCycles,
  setPreventiveReminder,
  getPreventiveReminders,
  type MenstrualCycle,
  type PreventiveReminder,
} from "@/lib/saudefeminina.functions";
import { joinCorporate } from "@/lib/corporativo.functions";
import { OfertaPremium } from "@/components/oferta-premium";
import { LojaSementinhas } from "@/components/loja-sementinhas";
import { manterTelaAcesa } from "@/lib/tela-acesa";
import {
  savePpdScreening,
  getMyPpdScreenings,
  startBreastfeeding,
  endBreastfeeding,
  getBreastfeedingLogs,
  setMilestone,
  getMilestones,
  removeMilestone,
  addBabyWeight,
  getBabyWeights,
  markVaccineGiven,
  getBabyVaccines,
  removeVaccine,
  type PpdScreening,
  type BreastfeedingLog,
  type BabyMilestone,
  type BabyWeight,
  type BabyVaccine,
} from "@/lib/postpartum.functions";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Obstétrica" },
      { name: "description", content: "Acompanhe semana a semana o desenvolvimento do seu bebê." },
    ],
  }),
  component: MinhaContaPage,
});

/* ⚠️ Exportado para `onboarding-ritual.tsx` — `export type` é apagado na
   compilação, então não pesa no pacote nem fecha ciclo. */
export type Profile = {
  id: string;
  /** Céu da home: null/"v2" = arte por período; "v1" = gradiente original. */
  sky_theme?: string | null;
  display_name: string | null;
  baby_name: string | null;
  lmp_date: string | null;
  due_date: string | null;
  reference_date: string | null;
  reference_weeks: number | null;
  reference_days: number | null;
  blood_type?: string | null;
  allergies?: string | null;
  /* Cidade do cadastro — o degrau entre o GPS e o IP na cadeia de localização. */
  home_city?: string | null;
  home_lat?: number | null;
  home_lon?: number | null;
  phone?: string | null;
  emergency_contact?: string | null;
  emergency_email?: string | null;
  emergency_phone?: string | null;
  height_cm?: number | null;
  pre_pregnancy_weight_kg?: number | null;
  medications?: string | null;
  birth_date?: string | null;
  pregnancy_number?: number | null;
  prior_bp_elevated?: boolean | null;
  prior_bp_week?: number | null;
  prior_gestational_diabetes?: boolean | null;
  prior_preterm?: boolean | null;
  prior_cesarean?: boolean | null;
  prior_notes?: string | null;
  corporate_account_id?: string | null;
  quiz_premium?: boolean | null;
  doctor_id?: string | null;
  /** Tom de pele do bebê nas ilustrações (0–4, paleta BABY_TONES). */
  baby_skin_tone?: number | null;
  /** BPM fetal medido pelo médico na consulta ("Sentir o coração"). */
  fetal_bpm?: number | null;
  fetal_bpm_at?: string | null;
  /** Foto da paciente (data URL comprimida). */
  avatar_url?: string | null;
};

type JournalEntry = {
  id: string;
  entry_date: string;
  mood: string | null;
  content: string;
  created_at: string;
};
type KickSession = { id: string; started_at: string; ended_at: string | null; kick_count: number };
type ChecklistItem = { id: string; category: string; label: string; done: boolean };

type HealthLog = {
  id: string;
  log_date: string;
  weight_kg: number | null;
  systolic: number | null;
  diastolic: number | null;
  glucose_mg_dl: number | null;
  spo2: number | null;
  heart_rate_bpm: number | null;
  steps: number | null;
  sleep_hours: number | null;
  notes: string | null;
};
type BirthPlan = {
  id?: string;
  birth_type: string;
  pain_relief: string[];
  who_present: string;
  cord_cutting: string;
  skin_to_skin: boolean;
  breastfeeding: string;
  lighting: string;
  music: string;
  notes: string;
};
type DoctorQ = {
  id: string;
  question: string;
  answered: boolean;
  created_at: string;
  /** Resposta escrita pelo médico (volta para a paciente na aba Perguntas). */
  answer?: string | null;
  answered_at?: string | null;
};
type Invite = { id: string; token: string; companion_name: string | null; created_at: string };

/* ⚠️ EXPORTADO COMO TIPO, e a distinção importa: `rotas-sem-export-solto`
   proíbe `export function|const|class` num arquivo de rota, porque isso põe o
   código no pedaço da árvore de rotas que toda página carrega. `export type` é
   APAGADO na compilação — não custa um byte ao pacote. */
export type Gest = ReturnType<typeof computeGestation>;

// ── Cache curto da lista de consultas ────────────────────────────────────────
// A tela unificada (Calendário + Consultas) e o card da home pediam a MESMA
// lista 3x ao abrir. Cache de 30s no módulo; ações que mudam a agenda passam
// force=true para revalidar na hora.
let apptsCache: { at: number; appointments: MyAppointment[] } | null = null;
/**
 * ⚠️ **`instavel` EXISTE PORQUE `[]` ERA UMA AFIRMAÇÃO, E ELA PODIA SER FALSA.**
 *
 * Numa falha de primeira carga esta função devolvia lista vazia, e as telas
 * escreviam **"Nenhuma consulta marcada ainda"** e **"Você ainda não tem
 * consultas por aqui — agende a primeira"**. Quem tem consulta confirmada para
 * amanhã abria o app para conferir a hora e lia que não tinha consulta nenhuma.
 *
 * Falta em consultório de alto risco é vaga perdida duas vezes — é a frase que
 * abre o desenho dos lembretes de 24 h e 4 h. Este defeito produzia exatamente
 * a perda que aquele sistema inteiro existe para impedir, e do lado de dentro.
 *
 * ⚠️ **A bandeira sobe SÓ quando o vazio vem de falha.** Servindo cache — dado
 * de verdade, no máximo alguns segundos velho — a lista não mente, e um aviso
 * sobre ela seria ruído que ensina a ignorar o aviso.
 */
type ListaDeConsultas = { appointments: MyAppointment[]; instavel: boolean };

async function fetchAppointmentsCached(force = false): Promise<ListaDeConsultas> {
  if (!force && apptsCache && Date.now() - apptsCache.at < 30_000)
    return { appointments: apptsCache.appointments, instavel: false };
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return { appointments: apptsCache?.appointments ?? [], instavel: !apptsCache };
  const res = await getMyAppointments({ data: { accessToken: s.session.access_token } });
  if (!res.ok) return { appointments: apptsCache?.appointments ?? [], instavel: !apptsCache };
  apptsCache = { at: Date.now(), appointments: res.appointments };
  return { appointments: res.appointments, instavel: false };
}

const TABS = [
  "Bebê",
  "Caminho",
  /* ⚠️ A COMUNIDADE assumiu o lugar do Chat na barra de baixo (ago/2026).
     Pedido do dono: o chat é a única função da barra que não atravessa
     fronteira ("hoje a gente só está usando ele no Brasil"), e a barra é o mapa
     do app. Ele não perdeu nada — a porta virou o bebê bolha do alto da home.

     Esta aba REÚNE o que já existia solto: Amigas, o Álbum Familiar
     (`/album/<token>`), a votação de nomes e o painel do acompanhante. Nenhum
     dos quatro tinha porta no app; viviam cada um no seu link. "Amigas"
     continua na lista porque é destino de verdade (a tela cheia de uma amiga),
     só deixou de ser a única porta. */
  "Comunidade",
  "Amigas",
  "Chá de bebê",
  "Feed",
  "Calendário",
  "Registros",
  "Saúde",
  "Nutrição",
  "Bem-estar",
  "Alertas",
  "Consultas",
  "Acompanhante",
  "FAQ",
  "Carteirinha",
  "Pós-parto",
  "Recompensas",
  "Saúde da mulher",
  "Médico",
  "Chat IA",
  /* ⚠️ A LOJA DE PRODUTOS É UM DESTINO PRÓPRIO (ago/2026), e não mais uma
     sub-aba de "Recompensas". Ver `LojaTab`: ela vende suplemento, conforto e
     enxoval por DINHEIRO, e vivia como terceira pílula ao lado do Cantinho,
     que vende enfeite por Sementinhas. Fica ao lado do Perfil, que é onde o
     dono disse que ela mora. */
  "Loja",
  "Perfil",
  /* ⚠️ A ASSINATURA DELA — e ela não existia (ago/2026).
     `openBillingPortal` e `getMyBilling` estavam escritas em
     `billing.functions.ts` há meses; o ÚNICO chamador do portal era o painel do
     MÉDICO, e `getMyBilling` não tinha chamador nenhum. A paciente assinava,
     era cobrada todo mês, e dentro do app não havia tela que dissesse quanto
     ela paga, quando renova, nem como parar. */
  "Assinatura",
] as const;
/* ⚠️ Exportado para `silencio-do-cuidado.tsx` — `export type` é apagado na
   compilação, então não pesa no pacote nem fecha ciclo. */
export type Tab = (typeof TABS)[number];

const CATEGORIES: { label: string; tabs: readonly Tab[] }[] = [
  {
    label: "Gestação",
    tabs: ["Bebê", "Caminho", "Calendário", "Registros", "Carteirinha"],
  },
  {
    label: "Saúde",
    tabs: ["Saúde", "Nutrição", "Bem-estar", "Alertas", "Saúde da mulher"],
  },
  {
    label: "Família",
    /* A Comunidade primeiro: no computador, onde não existe barra de baixo,
       esta é a ÚNICA porta dela. Acompanhante e Amigas continuam listadas
       porque são destinos de verdade e alguém pode querer ir direto. */
    tabs: ["Comunidade", "Feed", "Chá de bebê", "Acompanhante", "Amigas", "Pós-parto"],
  },
  {
    label: "Consultas",
    tabs: ["Consultas", "Médico"],
  },
  {
    label: "Aprender",
    tabs: ["FAQ", "Recompensas"],
  },
  {
    label: "Conta",
    /* ⚠️ A Loja entra AQUI, e não em "Aprender" (onde está Recompensas): é a
       porta do COMPUTADOR para ela. No celular quem abre a loja é o menu ☰
       (`MenuDaConta`), que não existe em `md:` — sem esta linha, tirar a
       pílula da fita deixaria a loja inalcançável no desktop. */
    tabs: ["Chat IA", "Loja", "Assinatura", "Perfil"],
  },
];

/* ══════════════════ Hub da Saúde (celular) ══════════════════
   A seção Saúde tem seis abas e elas moravam numa fileira de pílulas que
   rolava na horizontal. Numa tela de 390px cabiam quatro: "Alertas" e "Saúde
   da mulher" ficavam além da borda, sem nenhum sinal de que existiam — e as
   quatro visíveis eram alvos de 36px de altura espremidos entre o título e o
   conteúdo.

   Viraram seis quadrados grandes, dois por linha. É a mesma navegação, mas
   cada destino ganha nome, uma linha dizendo o que tem dentro, um ícone e um
   alvo do tamanho do polegar — e, principalmente, todos aparecem de uma vez.

   ─── O QUE ENTROU E O QUE SAIU DAQUI (ago/2026) ──────────────────────────
   A aba se chamava Saúde e as DUAS ferramentas de automonitoramento com mais
   peso clínico da gestação estavam fora dela: contar movimentos do bebê e
   cronometrar contrações moravam em Registros, dentro do grupo Gestação.

   Isso era pior que uma escolha de arrumação, porque a triagem de sintomas
   mora AQUI e cita as duas pelo nome: "redução dos movimentos do bebê" e
   "contrações regulares antes de 37 semanas" são dois dos nove sintomas
   VERMELHOS. Uma paciente que sente o bebê parado abria Saúde, encontrava a
   pergunta, e não tinha como contar dali.

   Entraram como ATALHOS, não como cópias: os dois ladrilhos abrem
   `Registros` já na sub-tela certa. Duas implementações de contagem de
   chutes divergiriam no primeiro conserto.

   E "Saúde da mulher" saiu da grade enquanto ela está grávida — ver
   `mostrarSaudeDaMulher`.

   `aspect-square` de propósito: é o que garante "dois quadrados grandes por
   linha" em qualquer largura, de um iPhone SE a um tablet em retrato. */
type LadrilhoDaSaude = {
  key: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  /** Ícone 3D; quando presente, `GradeHub` desenha a imagem no lugar do Lucide. */
  imagem?: string;
  caixa: string;
  tinta: string;
  /** Aba de destino. Nem todo ladrilho é uma aba de mesmo nome. */
  destino: Tab;
  /** Sub-tela dentro do destino — é o que faz Chutes abrir em Chutes. */
  subDestino?: string;
};

/* ─── QUATRO LADRILHOS, E NÃO SEIS (ago/2026) ─────────────────────────────
   Pedido do dono: "nessa tela eu não quero que tenha as funções de alertas, e
   nem de bem-estar — tudo que é do bem-estar está dentro da aba do jogo".

   Ele está certo sobre o Jogo: o Caminho tem os quatro momentos do dia
   (`MovementBlock`, `MeditationBlock`, `BondingBlock`, `GratitudeBlock`), então
   Meditar e Mexer já vivem lá, com implementação própria.

   E os nove sintomas VERMELHOS que a triagem lista continuam no SOS, que é o
   primeiro botão da barra — `emergency-sheet` os mostra sob "Procure
   atendimento agora se sentir". A grade perdeu um atalho, não o conteúdo.

   A ordem que ficou é clínica: primeiro "estou bem?" (números), depois "e o
   bebê?" (chutes, contrações), e por fim o que se come. */
const HUB_SAUDE: LadrilhoDaSaude[] = [
  {
    key: "Saúde",
    imagem: icSaude,
    label: "Saúde",
    sub: "Peso, pressão e glicemia",
    Icon: HeartPulse,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
    destino: "Saúde",
  },
  {
    key: "chutes",
    imagem: icChutes,
    label: "Chutes",
    sub: "Contar os movimentos",
    Icon: Footprints,
    caixa: "border-sky-200/70 from-sky-50 to-cyan-50/60",
    tinta: "text-sky-600",
    destino: "Registros",
    subDestino: "chutes",
  },
  {
    key: "contracoes",
    imagem: icContracoes,
    label: "Contrações",
    sub: "Cronometrar e ver o padrão",
    Icon: Timer,
    caixa: "border-orange-200/70 from-orange-50 to-amber-50/60",
    tinta: "text-orange-600",
    destino: "Registros",
    subDestino: "contracoes",
  },
  {
    key: "Nutrição",
    imagem: icNutricao,
    label: "Nutrição",
    sub: "O que comer hoje",
    Icon: Salad,
    caixa: "border-lime-200/70 from-lime-50 to-amber-50/60",
    tinta: "text-lime-600",
    destino: "Nutrição",
  },
  {
    key: "Saúde da mulher",
    imagem: icMulher,
    label: "Saúde da mulher",
    sub: "Ciclo, mamas e colo",
    Icon: Ribbon,
    caixa: "border-pink-200/70 from-pink-50 to-rose-50/60",
    tinta: "text-pink-600",
    destino: "Saúde da mulher",
  },
];

/**
 * A GRADE MOSTRA "SAÚDE DA MULHER"?
 *
 * Dois dos cinco quadrados da aba eram para uma mulher que NÃO está grávida:
 * "Ciclo menstrual" não tem o que mostrar por nove meses, e os preventivos que
 * ele lembra — Papanicolau, mamografia, perfil lipídico — em geral não se faz
 * durante a gestação. Não são recursos ruins; estavam na hora errada, ocupando
 * 40% da tela mais clínica do app.
 *
 * A régua é a mesma do Portal Pós-parto: aparece quando FAZ SENTIDO. Sem
 * gestação em andamento, é a aba certa; a partir da 36ª semana o pós-parto
 * entra no horizonte e ela volta.
 *
 * ⚠️ **Hoje ela decide só a LEGENDA do ladrilho, nunca a presença dele.** A
 * primeira versão tirava o ladrilho e afirmava que "a aba continua listada no
 * menu (`SECOES`)" — esse menu era o de computador (`hidden md:flex`), e no
 * celular a função sumia por nove meses. Uma garantia escrita que o aparelho
 * não cumpre é pior que nenhuma: quem lê acredita que preservou o acesso.
 */
export function mostrarSaudeDaMulher(weeks: number | null | undefined): boolean {
  return weeks == null || weeks >= 36;
}

/** O número dela num bloco da Saúde: o valor grande e a legenda pequena. */
type Dado = { valor: string; legenda?: string };

/**
 * O cabeçalho das três telas que o hub da Saúde abre como ABA (Saúde,
 * Nutrição, Saúde da mulher) — Chutes e Contrações já passam pelo cabeçalho de
 * `Registros`. Sem seta: a barra de cima é quem volta ao hub (`voltarDaBarra`).
 * Lê o MESMO `HUB_SAUDE` que desenha o bloco, então o coração verde de lá é o
 * coração verde daqui por construção.
 */
function CabecalhoDaSaude({ chave }: { chave: string }) {
  const item = HUB_SAUDE.find((i) => i.key === chave);
  if (!item) return null;
  return <VoltarDaGrade rotulo={item.label} ladrilho={item} />;
}

export function HubSaude({
  onAbrir,
  weeks,
  bancada,
  cabecalhos,
}: {
  onAbrir: (t: Tab, sub?: string) => void;
  /** Semana gestacional — `null` quando não há gestação configurada. */
  weeks: number | null;
  /**
   * Só a `/preview-saude`: os números prontos, sem sessão. Sem isto a bancada
   * mostraria sempre o bloco VAZIO — o único estado que ela não precisava provar.
   * Injeta o DADO no mesmo estado da produção, nunca um desenho à parte.
   */
  bancada?: Record<string, Dado | null>;
  /** Só a `/preview-saude`: em vez da grade, os cinco cabeçalhos de sub-tela, para fotografar. */
  cabecalhos?: boolean;
}) {
  /* Usa a MESMA grade das sub-abas (`GradeHub`). Antes esta tela tinha uma
     cópia do desenho; duas cópias do mesmo quadrado significam duas chances de
     elas divergirem no próximo ajuste. */
  /* ⚠️ OS NÚMEROS DELA DENTRO DOS BLOCOS. O dono pediu blocos que "preencham a
     tela inteira" e eles preenchiam com gradiente vazio; o que dá sentido ao
     tamanho é o dado. Três leituras em paralelo (uma onda, não três), e
     ⚠️ QUALQUER FALHA VIRA `null` — que não desenha nada. "Não consegui ler" e
     "ela nunca registrou" precisam cair no mesmo lugar, porque um "0" afirmaria
     um fato que a tela não sabe. Nutrição não tem número: fica sem, e isso
     também é informação (é conteúdo, não medição). */
  const [dados, setDados] = useState<Record<string, Dado | null>>(bancada ?? {});
  const ehBancada = !!bancada;
  useEffect(() => {
    if (ehBancada) return;
    let vivo = true;
    (async () => {
      const hoje = ymdLocal();
      const [saude, chutes, contr] = await Promise.all([
        supabase
          .from("health_logs")
          .select("weight_kg, systolic, diastolic, log_date")
          .order("log_date", { ascending: false })
          .limit(1)
          .then((r) => (r.error ? null : (r.data?.[0] ?? null))),
        supabase
          .from("kick_sessions")
          .select("kick_count, started_at")
          .not("ended_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .then((r) => (r.error ? null : (r.data?.[0] ?? null))),
        supabase
          .from("contraction_logs")
          .select("started_at")
          .gte("started_at", `${hoje}T00:00:00`)
          .order("started_at", { ascending: false })
          .limit(50)
          .then((r) => (r.error ? null : (r.data ?? null))),
      ]);
      if (!vivo) return;
      const d: Record<string, Dado | null> = {};
      if (saude) {
        const peso =
          saude.weight_kg != null ? `${String(saude.weight_kg).replace(".", ",")} kg` : null;
        const pa =
          saude.systolic != null && saude.diastolic != null
            ? `${saude.systolic}/${saude.diastolic}`
            : null;
        /* O peso é o valor grande; a pressão vai na legenda. Sem peso, a
           pressão sobe para o valor — o bloco nunca fica com legenda solta. */
        d["Saúde"] = peso
          ? { valor: peso, legenda: pa ? `pressão ${pa}` : undefined }
          : pa
            ? { valor: pa, legenda: "pressão" }
            : null;
      }
      if (chutes && chutes.kick_count != null) {
        const dia = String(chutes.started_at).slice(0, 10);
        const quando =
          dia === hoje
            ? "hoje"
            : dia === ymdLocal(new Date(Date.now() - 86400000))
              ? "ontem"
              : null;
        d["chutes"] = quando
          ? { valor: String(chutes.kick_count), legenda: `chutes ${quando}` }
          : null;
      }
      if (contr && contr.length > 0) {
        const ult = new Date(contr[0].started_at);
        const hh = String(ult.getHours()).padStart(2, "0");
        const mm = String(ult.getMinutes()).padStart(2, "0");
        d["contracoes"] = { valor: `${contr.length} hoje`, legenda: `última às ${hh}:${mm}` };
      }
      setDados(d);
    })().catch(() => {
      /* silêncio: sem dado, o bloco volta ao rótulo, que sempre foi verdade */
    });
    return () => {
      vivo = false;
    };
  }, [ehBancada]);
  /* ⚠️ Os cinco ladrilhos aparecem SEMPRE. Antes "Saúde da mulher" saía da
     grade durante a gestação, com um comentário garantindo que "a aba
     continua listada no menu" — e esse menu é o de computador, escondido no
     celular. No aparelho a função sumia por nove meses (estudo de navegação,
     set/2026). O que muda com a fase é a LEGENDA, não a porta. */
  const itens = HUB_SAUDE.map((i) => ({
    ...i,
    sub:
      i.key === "Saúde da mulher" && !mostrarSaudeDaMulher(weeks)
        ? "O que fica para depois do parto"
        : i.sub,
    dado: dados[i.key] ?? null,
  }));
  if (cabecalhos) {
    return (
      <div className="space-y-3">
        {itens.map((i) => (
          <VoltarDaGrade key={i.key} rotulo={i.label} ladrilho={i} onVoltar={() => {}} />
        ))}
      </div>
    );
  }
  return (
    <GradeHub
      itens={itens}
      /* Quatro é o caso da gestação (Saúde da mulher sai de cena): dois por
         linha, preenchendo a tela. Com cinco — fora da gestação — volta ao
         quadrado, senão a quinta ficaria sozinha numa linha esticada. */
      preencherTela={itens.length === 4}
      onAbrir={(k) => {
        const item = itens.find((i) => i.key === k);
        if (item) onAbrir(item.destino, item.subDestino);
      }}
    />
  );
}

const CAT_STYLE: Record<string, { pill: string; glass: string; accent: string; emoji: string }> = {
  Gestação: {
    pill: "bg-pink-100/90 text-pink-700 shadow-[0_0_0_1px_rgba(244,114,182,0.25)]",
    glass: "glass-card glass-pink",
    accent: "text-pink-600",
    emoji: "🌸",
  },
  Saúde: {
    pill: "bg-emerald-100/90 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]",
    glass: "glass-card glass-emerald",
    accent: "text-emerald-600",
    emoji: "🌿",
  },
  Família: {
    pill: "bg-violet-100/90 text-violet-700 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]",
    glass: "glass-card glass-violet",
    accent: "text-violet-600",
    emoji: "💜",
  },
  Consultas: {
    pill: "bg-blue-100/90 text-blue-700 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]",
    glass: "glass-card glass-blue",
    accent: "text-blue-600",
    emoji: "📋",
  },
  Aprender: {
    pill: "bg-teal-100/90 text-teal-700 shadow-[0_0_0_1px_rgba(20,184,166,0.25)]",
    glass: "glass-card glass-teal",
    accent: "text-teal-600",
    emoji: "✨",
  },
  Médico: {
    pill: "bg-primary/10 text-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_20%,transparent)]",
    glass: "glass-card glass-rose",
    accent: "text-primary",
    emoji: "🩺",
  },
  Conta: {
    pill: "bg-indigo-100/90 text-indigo-700 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]",
    glass: "glass-card glass-indigo",
    accent: "text-indigo-600",
    emoji: "💫",
  },
};

function categoryOfTab(t: Tab): string {
  return CATEGORIES.find((c) => (c.tabs as readonly string[]).includes(t))?.label ?? "Gestação";
}

/**
 * Dispara a checagem de conquistas após uma ação premiável (fire-and-forget).
 * Falhas são silenciosas.
 *
 * ⚠️ **TETO DE TRÊS TOASTS.** Um `for` sobre `newlyAwarded` era o que havia
 * aqui, e ele nasceu num mundo em que a checagem só rodava depois de UMA ação
 * (salvar uma pressão) e trazia uma conquista de cada vez. Duas coisas
 * mudaram: a lista foi a 39, e o Caminho passou a chamar — então a primeira
 * checagem de uma paciente que já joga há meses libera de uma vez tudo o que
 * ela já tinha conquistado e nunca recebeu. Vinte toasts empilhados cobrem a
 * tela inteira, e ela estava no meio de uma atividade.
 *
 * Três, e o resto vira uma linha só. O que ela perde é a lista; o que ela
 * ganha continua igual, e a aba Conquistas mostra todas com calma.
 *
 * ⚠️ E ele NÃO credita mais Sementinhas. O prêmio da conquista passou a
 * depender do toque dela na aba Conquistas (`resgatarConquista`), então
 * creditar aqui mostraria o saldo subindo por um pagamento que o servidor
 * ainda não fez.
 */

/**
 * ⚠️ O QUE IMPEDE O LAÇO — e ele é REAL, não teórico.
 *
 * O ouvinte de `dc-sementinhas` agenda esta checagem; esta checagem termina em
 * `creditarSementinhas`, que dispara `dc-sementinhas`. O que fecha o ciclo é a
 * expectativa de que a próxima checagem devolva `newlyAwarded` vazio — e essa
 * expectativa tem um caminho de falha ESCRITO no código: em
 * `achievements.functions.ts`, o `upsert` de `patient_achievements` é seguido
 * de `if (error) console.error(...)`, com um comentário admitindo que "na
 * próxima checagem ela é nova de novo". A resposta continua trazendo a lista
 * cheia.
 *
 * Isso era inofensivo enquanto a "próxima checagem" era a próxima ação da
 * paciente (salvar uma pressão). Depois que o Caminho passou a disparar, a
 * próxima checagem é 1,5 s depois, automática, para sempre: uma ida ao
 * servidor a cada segundo e meio, com toasts, enquanto a tela estiver aberta.
 *
 * A trava é local e não depende do banco: uma conquista só é COMEMORADA e
 * CREDITADA uma vez por sessão. Sem chave nova, não há crédito; sem crédito,
 * não há evento; sem evento, não há laço. E o teto é o tamanho do catálogo.
 *
 * De quebra conserta o que o comentário de lá descreve: a mesma medalha
 * aparecendo repetidamente quando a escrita falha.
 *
 * ⚠️ Vive FORA do componente de propósito — o ouvinte remonta a cada troca de
 * aba, e um `useRef` reiniciaria a trava junto.
 */

function MinhaContaPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Deep-link opcional ?tab=<Aba> (usado pela varredura do super-admin)
  const initialTab = ((): Tab => {
    if (typeof window === "undefined") return "Bebê";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t && (TABS as readonly string[]).includes(t) ? (t as Tab) : "Bebê";
  })();
  /* ⚠️ "Bebê" é a aba PADRÃO e também o nome da aba do bebê — então
     `initialTab === "Bebê"` não distingue "abriu o app" de "pediu ?tab=Bebê".
     Sem esta bandeira o deep link para a aba do Bebê caía na home, e a grade
     dela (contagem, álbum, nomes, carta, enxoval) ficava sem porta por link. */
  const tabPedidaNaUrl =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tab");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDoctor, setIsDoctor] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [milestoneWeek, setMilestoneWeek] = useState<number | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /* ── ⚠️ AS CONQUISTAS DO JOGO NUNCA ERAM CONCEDIDAS ────────────────────
     `triggerAchievementsCheck` rodava em cinco lugares: quatro telas de
     REGISTRO (pressão, chutes, diário, pergunta ao médico) e a própria aba
     Conquistas. O Caminho não chamava em lugar nenhum — e é lá que ela medita,
     escreve a gratidão, lê a carta ao bebê, fecha o dia e ganha troféu.

     Ou seja: as conquistas de meditação, gratidão, carta, exercício e troféu,
     mais o marco semanal de 25 🌱 e os dois de trimestre, só chegavam quando
     ela por acaso abria a aba Conquistas ou registrava uma pressão. Quem só
     jogasse não recebia nada disso — e o jogo é a parte do app desenhada para
     ser aberta todo dia.

     O gatilho é o mesmo recado que faz o saldo subir: "o servidor acabou de
     conceder Sementinhas" é, por definição, o instante em que uma conquista
     pode ter mudado de estado.

     ⚠️ Com espera de 1,5 s: fechar o dia dispara quatro concessões seguidas
     (uma por atividade) mais o bônus, e sem isso seriam cinco varreduras
     completas do ledger em poucos segundos, cada uma repetindo o trabalho da
     anterior. A checagem é idempotente (dedupe por chave), então adiar não
     perde nada. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const parar = ouvirSementinhas(() => {
      if (t) clearTimeout(t);
      t = setTimeout(triggerAchievementsCheck, 1500);
    });
    return () => {
      if (t) clearTimeout(t);
      parar();
    };
  }, []);

  // Puxar-para-atualizar: recarrega o perfil e remonta o conteúdo da aba atual
  // (que refaz seus próprios fetches). Soft refresh, sem reload da página.
  async function refreshAll() {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data } = await (supabase as any)
          .from("patient_profiles")
          .select("*")
          .eq("id", u.user.id)
          .maybeSingle();
        if (data) setProfile(data);
      }
    } catch {
      /* rede instável: ainda assim remonta a aba abaixo */
    }
    // Card "Próxima consulta" da home também atualiza no pull-to-refresh.
    await loadNextAppt(true).catch(() => {});
    setRefreshKey((k) => k + 1);
  }
  // Mobile-only: true = dashboard home screen (se veio deep-link de aba, abre nela)
  const [mobileHome, setMobileHome] = useState(initialTab === "Bebê" && !tabPedidaNaUrl);
  /* Hub da seção Saúde (só no celular). A seção tem SEIS abas e elas viviam
     numa fileira de pílulas que rolava na horizontal: cabiam quatro, então
     "Alertas" e "Saúde da mulher" ficavam fora da tela — existiam sem que
     nada na tela dissesse que existiam. Viraram uma grade de seis quadrados
     grandes, dois por linha, que é a tela de entrada da seção. Nulo = está
     dentro de uma das abas. */
  const [hubAberto, setHubAberto] = useState<BottomSection | null>(null);

  /* Toda navegação DENTRO do app volta ao topo — inclusive entrar no app.
     `tab` é estado do React, não rota: trocar de aba não muda a URL, então o
     reset de scroll do __root — que depende de `location.pathname` — nunca
     disparava aqui. A rolagem da tela anterior simplesmente sobrevivia: quem
     estava no fim da trilha do jogo tocava em "Saúde" e caía no rodapé de uma
     tela que nunca tinha visto, tendo que subir na mão. Valia para toda aba.
     Sem guarda de primeira renderização, de propósito: chegar por link ou por
     "voltar" também tem que abrir no começo, porque a posição guardada é de
     outra aba qualquer. Quem garante que ninguém disputa é o `router.tsx`,
     que desliga a restauração nesta rota.
     `instant` de propósito: o CSS global usa `scroll-behavior: smooth`, e
     animar a subida de dez mil pixels é pior que o próprio defeito.

     E `useLayoutEffect`, não `useEffect`: este é o "pisca" que ela via ao
     trocar de tela. `useEffect` roda DEPOIS que o navegador pinta, então a
     tela nova aparecia por um quadro na rolagem da tela ANTERIOR e só então
     saltava para o topo — que é exatamente a impressão de "voltou para a
     tela de trás e depois carregou". `useLayoutEffect` roda antes da pintura:
     ninguém vê o estado intermediário. */
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab, mobileHome, hubAberto]);

  /** Menu do ☰ da home — guarda as ações que ficavam na barra de topo. */
  const [homeMenu, setHomeMenu] = useState(false);
  /* ─── O MAPA DO APP e o "VOCÊ SABIA?" (set/2026) ───────────────────────────
     `visitadas` é o conjunto de funções que ela JÁ abriu (ids de
     `FUNCOES_DO_APP`), gravado em chave `dc-path-` para viajar no
     `journey_state`. Quem alimenta é `goToTab`, o único ponto por onde toda
     navegação passa. A dica é calculada DEPOIS de montar (num efeito), nunca no
     render: ela lê `localStorage` e `Date.now()`, e os dois divergem entre
     servidor e cliente — a classe de defeito que já derrubou o app inteiro. */
  const [mapaAberto, setMapaAberto] = useState(false);
  const [visitadas, setVisitadas] = useState<Set<string>>(() => new Set());
  const [dicaDaBolha, setDicaDaBolha] = useState<FuncaoDoApp | null>(null);

  /* ── O TUTORIAL DO PRIMEIRO ACESSO ──────────────────────────────────────
     Quem apresenta o app é o bebê bolha, pela barra de baixo. O estado do
     DESTAQUE mora aqui porque a barra mora aqui: o tutorial diz de qual item
     está falando, e quem acende é o `AppBottomNav`. */
  const [tutorialAberto, setTutorialAberto] = useState(false);
  const [destaqueDaBarra, setDestaqueDaBarra] = useState<DestaqueDoTutorial>(null);
  /* ⚠️ O PASSO MORA AQUI, e não dentro do tutorial. A barra continua clicável
     durante a aula: tocar em "Jogo" troca a aba, tira a home do ar e desmonta
     o componente — e com o índice lá dentro, voltar recomeçava do primeiro
     cartão. Foi o defeito que o dono viu. Guardado aqui ele sobrevive à ida e
     volta; guardado também no `localStorage`, sobrevive a fechar o app. */
  const [passoDoTutorial, setPassoDoTutorial] = useState(0);

  /* A aula que ela acabou de fazer, para o compositor da Comunidade oferecer. */
  const [aulaDeHoje, setAulaDeHoje] = useState<AulaNoPost | null>(null);
  useEffect(() => {
    /* ⚠️ Relido a cada entrada no Feed, e não uma vez na montagem: ela faz a
       aula no Caminho e vai para a Comunidade na MESMA sessão — lendo só na
       montagem, o anexo só apareceria na próxima abertura do app. */
    if (tab !== "Feed") return;
    setAulaDeHoje(aulaDeHojeParaCompartilhar());
  }, [tab]);
  /* ⚠️ QUEM ESCONDE A BARRA NO COMPUTADOR É CSS, NÃO ESTADO.
     `mobileHome` continua verdadeiro num monitor — a home e a barra somem por
     `md:hidden`. O tutorial abria por cima de uma tela sem barra nenhuma,
     apontando para ícones invisíveis, e no fim gravava "já viu": quem entrou
     pelo computador perdia o tutorial do celular para sempre.
     Começa `false` e só é lido no efeito: `window` não existe no SSR, e uma
     leitura no render daria hidratação divergente. */
  const [ehCelular, setEhCelular] = useState(false);
  useEffect(() => {
    /* 768px é o `md` do Tailwind — o MESMO corte do `md:hidden` que esconde a
       barra. Um número próprio aqui divergiria no primeiro ajuste de tema. */
    const mq = window.matchMedia("(max-width: 767px)");
    const ver = () => setEhCelular(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);

  function avancarTutorial() {
    setPassoDoTutorial((v) => {
      const proximo = v + 1;
      try {
        localStorage.setItem(chaveDoPassoDoTutorial(userId), String(proximo));
      } catch {
        /* modo privado: continua funcionando dentro da sessão, que é o caso
           que o dono relatou. */
      }
      return proximo;
    });
  }

  function fecharTutorial() {
    setTutorialAberto(false);
    setDestaqueDaBarra(null);
    try {
      /* ⚠️ `userId` (o id do Auth) e NÃO `profile?.id`: a leitura, lá no
         carregamento, usa `u.user.id`. Com `profile` nulo — que é estado
         alcançável: quem se cadastrou como médico não tem linha em
         `patient_profiles`, e o botão "não sou médico" não a cria — a escrita
         caía em `:anon` e a leitura procurava `:<uid>`. O tutorial então
         recomeçava em TODA abertura, para sempre. */
      localStorage.setItem(chaveDoTutorial(userId), "1");
      localStorage.removeItem(chaveDoPassoDoTutorial(userId));
    } catch {
      /* modo privado: ele volta na próxima abertura. Chato, não quebra — e
         quem está em modo privado sabe que nada é lembrado. */
    }
  }
  /* ── Central de notificações ──────────────────────────────────────────
     `lidas` começa VAZIA e só é preenchida ao montar. Ler o localStorage
     durante o render faria o servidor (que não tem storage) e o navegador
     produzirem marcações diferentes, e a hidratação do React não corrige
     isso — a bolinha piscaria em quem já leu tudo. */
  const [notifOpen, setNotifOpen] = useState(false);
  /* `Map` e não `Set`: o valor é o INSTANTE da leitura, e é ele que faz a
     notificação lida sumir da caixa depois de sete dias. `has()` continua
     sendo a mesma chamada, então a folha não mudou. */
  const [lidas, setLidas] = useState<Lidas>(() => new Map());
  const [origemLocal, setOrigemLocal] = useState<OrigemLocal | null>(null);
  /* A barra de baixo escurece SÓ na home com céu de noite. Nas outras abas o
     conteúdo é claro e uma barra escura destoaria — e a tela do jogo é uma
     sobreposição em portal, com a barra atrás dela, então nem aparece.
     O mesmo hook da home: uma fonte só decide o que é noite. */
  const { slot: ceuAgora } = useSkyNow(
    profile?.home_city && profile.home_lat != null && profile.home_lon != null
      ? { nome: profile.home_city, lat: profile.home_lat, lon: profile.home_lon }
      : null,
  );
  const barraEscura = mobileHome && profile?.sky_theme !== "v1" && ceuAgora.dark;

  useEffect(() => {
    setLidas(lerLidas(profile?.id ?? null));
  }, [profile?.id]);

  /* As notificações DERIVADAS: nascem do estado da conta, não de uma tabela.
     Cada uma some sozinha quando a situação que a criou se resolve — vincular
     um médico apaga as duas primeiras, dar a permissão apaga a terceira.
     `enviadas` está vazia porque a tabela de recados do médico ainda não
     existe; `ordenar` já a recebe para o dia em que existir. */
  const notificacoes: Notificacao[] = useMemo(() => {
    const derivadas: Notificacao[] = [];
    const semMedico = !!profile && !profile.doctor_id && !isDoctor && !isAdmin;

    if (semMedico) {
      derivadas.push({
        id: "medico-ausente",
        icone: "👩‍⚕️",
        titulo: "Você ainda não tem um médico no app",
        corpo:
          "Encontre um obstetra por experiência, formação e cidade — ele passa a te acompanhar por aqui.",
        acao: {
          rotulo: "Encontrar um obstetra",
          executar: () => navigate({ to: "/encontrar-medico" }),
        },
      });
      derivadas.push({
        id: "convide-medico",
        icone: "🎁",
        titulo: "Convide o seu médico e ganhe 1 ano de Premium",
        corpo:
          "Pelo seu link ele ganha 15% de desconto extra em qualquer plano — e, quando assinar, você ganha 1 ano de Premium grátis.",
        /* Leva à mesma página, onde o convite com WhatsApp e "copiar" já vive
           em destaque. Duplicar aquela lógica aqui só criaria um segundo lugar
           para o link do convite quebrar. */
        acao: { rotulo: "Pegar meu link", executar: () => navigate({ to: "/encontrar-medico" }) },
      });
    }

    if (origemLocal && (origemLocal.tipo === "aprox" || origemLocal.tipo === "padrao")) {
      derivadas.push({
        /* O id carrega a CIDADE: quando o app passa a errar outra cidade, é
           um aviso novo e a bolinha volta — que é o comportamento certo, já
           que a informação mudou. */
        id: `local:${origemLocal.cidade ?? "aprox"}`,
        icone: "📍",
        titulo: origemLocal.cidade
          ? `Mostrando o tempo de ${origemLocal.cidade}`
          : "Mostrando o tempo de uma cidade aproximada",
        corpo:
          "Com a sua localização, o céu e a chuva do app ficam iguais aos da sua janela. Toque para ativar.",
        acao: {
          rotulo: "Ativar localização",
          executar: () => {
            navigator.geolocation?.getCurrentPosition(
              () => window.location.reload(),
              () => toast("Ative a localização nos ajustes do navegador para este site."),
              { timeout: 8000 },
            );
          },
        },
      });
    }

    /* Contato de emergência incompleto.
       
       Fica no TOPO da lista (data futura força a primeira posição) porque é a
       única notificação daqui cuja falta só aparece na hora em que já é tarde:
       ela aciona o SOS achando que a família vai ser avisada e nada sai. As
       outras — médico, localização — se resolvem no dia seguinte sem custo.
       
       O e-mail é o que pesa: sem ele o app não tem NENHUM canal automático
       até a família. Nome e telefone sozinhos ainda deixam o WhatsApp pronto,
       mas dependem de ela conseguir apertar enviar. */
    const emergenciaIncompleta =
      !!profile && (!profile.emergency_email?.trim() || !profile.emergency_contact?.trim());
    if (emergenciaIncompleta) {
      const soFaltaEmail = !!profile?.emergency_contact?.trim();
      derivadas.push({
        id: "emergencia-incompleta",
        icone: "🆘",
        titulo: soFaltaEmail
          ? "Falta o e-mail do seu contato de emergência"
          : "Complete o seu contato de emergência",
        corpo:
          "É para quem o app manda socorro, com a sua localização e a sua ficha, no segundo em que você aperta o SOS. Sem o e-mail, ninguém da sua família é avisado automaticamente.",
        acao: {
          rotulo: "Preencher agora",
          executar: () => goToTab("Perfil"),
        },
        data: new Date(Date.now() + 60_000).toISOString(),
      });
      /* ⚠️ `ordenar` só ordena as ENVIADAS por data — as derivadas entram na
         ordem em que foram empurradas. O comentário acima prometia "fica no
         topo (data futura força a primeira posição)" e ela caía em ÚLTIMO,
         abaixo do convite promocional de Premium. Como o `push` é condicional
         e no fim do memo, quem resolve é tirá-la da fila. */
      derivadas.unshift(derivadas.pop()!);
    }

    return ordenar([], derivadas);
  }, [profile, isDoctor, isAdmin, origemLocal, navigate]);

  /**
   * A caixa de entrada como a paciente a vê: sem o que ela leu há mais de sete
   * dias.
   *
   * Fica separada de `notificacoes` de propósito. A lista crua continua sendo
   * a verdade do estado da conta — é dela que nascem as derivadas —, e a poda
   * é uma decisão de APRESENTAÇÃO. Misturar as duas faria a notificação lida
   * "deixar de existir" para quem lê o código, quando ela só deixou de ser
   * mostrada.
   */
  const caixaDeEntrada = useMemo(() => visiveis(notificacoes, lidas), [notificacoes, lidas]);

  /** Some quando ela preenche — é o que apaga o ponto vermelho do Perfil. */
  const perfilPendente =
    !!profile && (!profile.emergency_email?.trim() || !profile.emergency_contact?.trim());

  /* A CAIXA é a lista já podada: a lida há mais de sete dias sai de cena.
     O emblema conta sobre ESTA lista, e não sobre a crua — senão uma
     notificação invisível continuaria puxando o número, e ela abriria a caixa
     procurando um recado que não está lá. */
  const naoLidas = contarNaoLidas(caixaDeEntrada, lidas);

  /**
   * ⚠️ ABRIR A CAIXA NÃO É MAIS LER TUDO.
   *
   * Era: a gaveta abria e marcava a lista inteira como lida. Pedido do dono
   * com o bebê bolha: "se a pessoa abrir a mensagem, clicando nela, conta como
   * lida". A diferença importa — quem abre a caixa e vê cinco recados sem
   * tempo de ler perdia o rastro de todos os cinco de uma vez, e o emblema
   * zerava sem que nada tivesse sido lido de verdade.
   *
   * Agora quem marca é o toque em CADA item (`marcarUmaLida`, passado à
   * folha). O que abrir a caixa faz é só abrir a caixa.
   */
  function abrirNotificacoes() {
    setHomeMenu(false);
    setNotifOpen(true);
  }

  /** Um toque, um recado lido. */
  function marcarUmaLida(id: string) {
    setLidas(marcarLidas(profile?.id ?? null, [id]));
  }
  // Jornada do Bebê (toque na foto do bebê) + popup do Premium (gatilho)
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  // Navegação disparada de DENTRO de uma aba (ex.: "Configure em Perfil") —
  // troca a aba e sai da home mobile, senão o destino fica escondido no celular.
  // Sub-aba pedida no destino (hoje só o hub de Consultas usa): o marco da
  // semana "plano de parto" abre direto em Plano de parto, e "mala da
  // maternidade" direto no Checklist, em vez de cair sempre na Agenda.
  /* Sub-aba pedida por quem navegou até aqui (o toque no bebê pede "semana",
     um marco pede "checklist"). Vale para QUALQUER hub com grade — antes era
     só das Consultas. */
  /* Deep link também da SUB-aba: `?tab=Consultas&sub=perguntas`.
  
     Sem isto, o push "seu médico respondeu" levava a paciente para a grade de
     Consultas e ela ainda tinha de achar Perguntas — e um aviso que não leva ao
     que ele anuncia é pior que aviso nenhum, porque ensina a ignorá-lo. */
  const [consultasSub, setConsultasSub] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("sub");
  });
  /**
   * De onde a paciente veio — um nível só de histórico.
   *
   * A seta de voltar fazia sempre `setMobileHome(true)`: caía no Bebê viesse
   * de onde viesse. Quem estava no Caminho, abria a lojinha e voltava, era
   * despejado noutra tela — perdia o lugar na trilha e tinha de navegar de
   * novo até onde estava.
   *
   * Um nível basta, e é o que ela espera: entra numa tela a partir de outra e
   * volta para aquela. Pilha maior cria o problema oposto — apertar voltar
   * cinco vezes sem sair do lugar.
   *
   * `null` = veio da home (ou de um destino da barra de baixo), e aí voltar é
   * mesmo ir para a home.
   */
  const [origem, setOrigem] = useState<Tab | null>(null);

  /**
   * A seta deve voltar para um HUB, e não para uma aba.
   *
   * Nasceu com os atalhos de Chutes e Contrações na grade da Saúde: eles abrem
   * `Registros`, que é uma aba de OUTRA seção. Sem isto, a seta não encontra
   * nada — `tabToSection("Registros")` não é "saude" e `origem` fica vazia,
   * porque o hub troca a aba direto — e cai na regra do fim, despejando a
   * paciente na tela do bebê. É o mesmo defeito que a regra 2 do `voltarDaBarra`
   * existe para consertar, só que por um caminho novo.
   */
  const [voltarAoHub, setVoltarAoHub] = useState<BottomSection | null>(null);

  /* O sinal de "voltar ao começo da Comunidade" — ver `onSelect`. */
  const [voltarAoFeed, setVoltarAoFeed] = useState(0);

  const goToTab = (t: string, sub?: string) => {
    /* Só guarda origem quando existe uma: na home mobile não há "tela
       anterior", e guardar a aba que estava por baixo faria o voltar pular
       para um lugar que ela não estava vendo. E nunca guarda a si mesma. */
    setOrigem(!mobileHome && tab !== (t as Tab) ? (tab as Tab) : null);
    setVoltarAoHub(null);
    setTab(t as Tab);
    setMobileHome(false);
    setHubAberto(null);
    /* A folha de recados é renderizada dentro do bloco da home mobile, mas o
       estado é da rota: uma notificação que NAVEGA (ex.: "Complete o seu
       contato de emergência" → Perfil) desmontava a folha com `notifOpen`
       ainda verdadeiro, e ela reabria sozinha ao voltar para o Bebê. */
    setNotifOpen(false);
    setConsultasSub(sub ?? null);
    /* "Já abriu": o id mais específico do destino, gravado uma vez. */
    const idAberto = idDaFuncao(t, sub);
    if (idAberto && !visitadas.has(idAberto)) {
      const prox = new Set(visitadas);
      prox.add(idAberto);
      setVisitadas(prox);
      lsSet(CHAVE_VISITADAS, [...prox]);
    }
  };

  // Modo Cuidado 🤍 — lido do perfil; pausa a gamificação globalmente.
  const careMode = Boolean((profile as { care_mode?: boolean } | null)?.care_mode);
  useEffect(() => {
    if (!profile) return;
    let vivo = true;
    /* ⚠️ O PULL DA NUVEM VEM ANTES de ler e de gravar: `lsSet` numa chave
       `dc-path-` agenda um PUSH do blob da jornada, e empurrar antes do pull
       sobrescreve a jornada real por um blob incompleto — a mesma regra que o
       onboarding da Comunidade já paga. */
    void ensureInitialJourneyPull()
      .catch(() => false)
      .then(() => {
        if (!vivo) return;
        const abertas = new Set(lsGet<string[]>(CHAVE_VISITADAS, []));
        setVisitadas(abertas);
        const ultima = lsGet<DicaMostrada | null>(CHAVE_DICA, null);
        const agora = Date.now();
        const d = dicaDaSemana({
          visitadas: abertas,
          careMode,
          weeks: gest?.weeks ?? null,
          agora,
          ultima,
        });
        setDicaDaBolha(d);
        /* Marcada como MOSTRADA no instante em que é decidida — não no toque:
           quem leu e não tocou não pode reencontrá-la amanhã, senão a bolha
           vira letreiro da mesma dica por sete dias. */
        if (d) lsSet(CHAVE_DICA, { id: d.id, em: agora } satisfies DicaMostrada);
      });
    return () => {
      vivo = false;
    };
    /* Só na primeira leitura do perfil: reler a cada mudança de aba
       recalcularia a dica no MESMO dia e a marcaria de novo. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
  /**
   * ⚠️ CARIMBA O MODO CUIDADO PARA O SOM — e isto fecha um portão que nenhuma
   * prop alcançava.
   *
   * `creditarSementinhas` é o funil de dezessete pontos de concessão, num
   * módulo que de propósito não importa nada: a moeda tocaria sem saber do
   * luto. Passar `careMode` por dezessete chamadas seria a "segunda régua no
   * chamador" que este projeto já pagou várias vezes — e a décima oitava
   * chamada, escrita amanhã, esqueceria.
   *
   * Com o carimbo, o portão do luto passa a ser fechado POR PADRÃO: quem não
   * passa nada herda o estado real, e quem passa continua mandando.
   */
  useEffect(() => {
    carimbarModoCuidado(careMode);
  }, [careMode]);
  async function toggleCareMode(on: boolean) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) return;
    const res = await setCareMode({ data: { accessToken: s.session.access_token, on } });
    if (res.ok) setProfile((p) => (p ? ({ ...p, care_mode: on } as Profile) : p));
  }

  // Próxima consulta confirmada → card na home mobile (fecha o ciclo
  // médico→paciente também na primeira tela do app).
  const [nextAppt, setNextAppt] = useState<NextAppointment | null>(null);
  /* O médico DA PACIENTE, lido do cadastro dele. Alimenta a Central de
     Emergência e a carteirinha — as duas telas que dizem para quem ligar. Sem
     vínculo (ou sem a tabela `doctors` no banco), fica `null` e as telas usam
     o `doctor.config`, que é o dono da instalação. */
  const [meuMedico, setMeuMedico] = useState<DoctorContato | null>(null);
  /* Se JÁ SABEMOS a resposta. `null` sem esta flag é ambíguo: pode ser "ela não
     tem médico" ou "a resposta ainda não chegou". O SOS está clicável desde o
     primeiro pixel, então tocar nele antes da ida-e-volta — ou com a rede ruim,
     que é justamente uma emergência — fazia a tela AFIRMAR "você ainda não tem
     um médico vinculado" e esconder os dois botões de ligar para ele. Uma frase
     falsa, não uma degradação. */
  const [medicoResolvido, setMedicoResolvido] = useState(false);
  /** Cadastro profissional começado neste aparelho e ainda sem perfil. */
  const [querSerMedicoAqui, setQuerSerMedicoAqui] = useState(false);
  useEffect(() => {
    // `isDoctor` já cobre quem TEM perfil: o aviso é só para quem não tem.
    if (isDoctor) return;
    void import("@/lib/intencao-medico").then((m) => setQuerSerMedicoAqui(m.querSerMedico()));
  }, [isDoctor]);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) {
          if (vivo) setMedicoResolvido(true);
          return;
        }
        const r = await getMyDoctorContact({ data: { accessToken: s.session.access_token } });
        if (vivo && r.ok) {
          setMeuMedico(r.doctor);
          setMedicoResolvido(true);
        }
      } catch {
        /* Uma falha de transporte não pode deixar a tela em "carregando" para
           sempre: o SOS ficaria eternamente sem os botões de ligar para ele.
           Uma tentativa a mais e, se falhar de novo, damos a resposta que
           temos — que é "não sei de médico nenhum". */
        try {
          await new Promise((r) => setTimeout(r, 1500));
          const { data: s2 } = await supabase.auth.getSession();
          if (!vivo) return;
          if (s2.session) {
            const r2 = await getMyDoctorContact({
              data: { accessToken: s2.session.access_token },
            });
            if (vivo && r2.ok) setMeuMedico(r2.doctor);
          }
        } catch {
          /* segunda falha: segue para o `finally` */
        } finally {
          if (vivo) setMedicoResolvido(true);
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [profile?.id]);
  async function loadNextAppt(force = false) {
    try {
      const { appointments } = await fetchAppointmentsCached(force);
      const today = ymdLocal();
      const next = appointments
        .filter((a) => a.status === "confirmed" && (a.confirmed_date ?? "") >= today)
        .sort((a, b) =>
          (a.confirmed_date! + (a.confirmed_time ?? "")).localeCompare(
            b.confirmed_date! + (b.confirmed_time ?? ""),
          ),
        )[0];
      setNextAppt(
        next
          ? {
              dateLabel: `${formatApptDate(next.confirmed_date!)} · ${next.confirmed_time ?? ""}`,
              typeLabel: next.reason,
            }
          : null,
      );
    } catch {
      /* card é enhancement — sem consulta, sem card */
    }
  }
  useEffect(() => {
    loadNextAppt();
  }, []);

  // Baixa a jornada da nuvem e arma a barreira anti-push logo no mount da
  // página, independente da aba ativa: abas como Sons/Quartinho gravam chaves
  // dc-path- sem montar a aba Caminho, então o pull inicial precisa acontecer
  // antes de qualquer push para não sobrescrever a jornada real na conta (P1).
  useEffect(() => {
    ensureInitialJourneyPull();
  }, []);

  // Indicação de amiga: se veio por um link ?amiga=CODE, atribui na 1ª visita
  // logada (idempotente) e credita 100 🌱 à indicadora. Limpa o código quando
  // resolve (só mantém enquanto o perfil da amiga ainda não existe).
  useEffect(() => {
    (async () => {
      const code = storedReferralCode();
      if (!code) return;
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      try {
        const res = await attributeReferral({
          data: { accessToken: s.session.access_token, code },
        });
        if (res.ok && !("retry" in res && res.retry)) clearStoredReferralCode();
        if (res.ok && "attributed" in res && res.attributed) {
          toast.success("Você entrou pela indicação de uma amiga 💛");
        }
      } catch {
        /* tenta de novo na próxima visita */
      }
    })();
  }, []);

  /* ─── CÓDIGO DA INFLUENCIADORA ────────────────────────────────────────────
     Mesmo desenho da indicação de amiga logo acima, e é de propósito que sejam
     dois efeitos e não um: são COLUNAS diferentes (`ref_code` × `referred_by`),
     bônus diferentes e destinatários diferentes — o da amiga paga quem indicou,
     o da influenciadora paga quem CHEGOU. Ver `influenciadora.functions.ts`.

     ⚠️ O código do navegador NÃO é limpo quando o servidor devolve `repetir`
     (perfil ainda não criado, e-mail não confirmado): é justamente o caso em que
     ele precisa sobreviver até a próxima abertura. */
  useEffect(() => {
    (async () => {
      const codigo = storedAffiliateCode();
      if (!codigo) return;
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      try {
        const { atribuirInfluenciadora } = await import("@/lib/influenciadora.functions");
        const r = await atribuirInfluenciadora({
          data: { accessToken: s.session.access_token, codigo },
        });
        if (r.ok && !("repetir" in r && r.repetir)) clearStoredAffiliateCode();
        if (r.ok && "atribuido" in r && r.atribuido && r.bonus > 0) {
          toast.success(`Bem-vinda! Você começou com ${r.bonus} Sementinhas 🌱`);
          /* O saldo do topo é lido por este evento — sem ele o número só
             mudaria na próxima abertura, e o presente ficaria invisível. */
          creditarSementinhas(r.bonus);
        }
      } catch {
        /* tenta de novo na próxima visita */
      }
    })();
  }, []);

  // Retorno do checkout do Stripe: o webhook libera o acesso em segundos.
  // Reconsulta o perfil até o premium refletir e avisa a paciente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const st = new URLSearchParams(window.location.search).get("assinatura");
    if (!st) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (st === "cancelada") {
      toast("Pagamento não concluído. Você pode tentar de novo quando quiser.");
      return;
    }
    if (st !== "sucesso") return;
    toast.success("Pagamento recebido! Ativando seu acesso…");
    let tries = 0;
    const tick = async () => {
      tries++;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await (supabase as any)
        .from("patient_profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      if (data?.quiz_premium) {
        setProfile(data);
        toast.success("Premium ativado! Aproveite 💛");
        return;
      }
      if (tries < 6) setTimeout(tick, 2000);
      else if (data) setProfile(data);
    };
    setTimeout(tick, 1500);
  }, []);

  useEffect(() => {
    (async () => {
      /* ── ⚠️ QUATRO IDAS À REDE VIRARAM DUAS RODADAS (ago/2026) ────────────
         A abertura do app fazia, EM SÉRIE: getUser → perfil → getSession +
         checkIsAdmin → getMyDoctor. Quatro esperas encadeadas antes de a tela
         liberar, cada uma somando a latência da anterior. Era metade do
         "demora e parece estragado" que o dono relatou.

         O que de fato depende de quê:
           · o perfil precisa do `user.id` (vem do getUser)
           · checkIsAdmin e getMyDoctor precisam do TOKEN (vem do getSession)
           · o perfil e o papel NÃO dependem um do outro

         Então são duas rodadas em vez de quatro esperas: primeiro
         getUser+getSession juntos, depois perfil+papel juntos.

         ⚠️ `getMyDoctor` passou a sair SEMPRE, e antes só saía quando o
         `checkIsAdmin` dissesse que não é admin. É uma leitura, e o resultado
         continua sendo IGNORADO para admin logo abaixo — a semântica de quem
         vê o quê não mudou, só a hora do pedido. Trocar uma ida à rede em
         série por uma leitura extra que o admin descarta é o negócio certo:
         admin é raro e gestante é todo mundo. */
      /* ── ⚠️ O PERFIL SAI NA PRIMEIRA RODADA, E NÃO NA SEGUNDA (set/2026) ──
         O dono, no aparelho: "a primeira tela está demorando muito para
         carregar". Medido no código: o perfil esperava o `getUser` — que é
         uma ida ao servidor de auth — só para ter o `user.id`. Mas o id já
         está na SESSÃO, que é local e responde em milissegundos. O `getUser`
         continua saindo (é ele que VALIDA o token no servidor, e sem usuário
         válido a tela não abre), só deixou de estar na frente do perfil.
         A RLS de `patient_profiles` continua sendo quem decide o que a
         consulta devolve — o id da sessão só aponta a linha. */
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      const idDaSessao = s.session?.user?.id ?? null;
      /* ⚠️ `Promise.resolve(...)` de propósito: o construtor de consulta do
         PostgREST é PREGUIÇOSO — só dispara a requisição quando alguém chama
         o `then`. Guardado cru na variável, ele só sairia no `await` lá
         embaixo, DEPOIS do `getUser`, e a rodada "junta" seria em série de
         novo, com o comentário dizendo o contrário. */
      const perfilEmVoo = idDaSessao
        ? Promise.resolve(
            (supabase as any)
              .from("patient_profiles")
              .select("*")
              .eq("id", idDaSessao)
              .maybeSingle(),
          )
        : null;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      /* ─── ⚠️ "ELA APARECEU" — sem isto, a aba das Amigas mente por omissão ──
         `last_seen_at` é o que vira "há 2h" na lista de amigas. Se ninguém
         carimbar, a coluna fica NULL para sempre, `ultimaVez` devolve `null`
         e a linha de status que a tela desenha simplesmente nunca existe —
         recurso construído inteiro e morto na produção, que é a mesma família
         de defeito do presente do médico que chegava sem aviso.

         ⚠️ SOLTO DE PROPÓSITO (sem `await` e com `catch` vazio): é um carimbo,
         não um dado que a tela espera. Pendurá-lo no `Promise.all` acima faria
         a abertura do app depender de uma escrita que não muda nada do que ela
         vai ver. E o servidor já grava no máximo uma vez por hora. */
      if (token) {
        void import("@/lib/amigas.functions")
          .then((m) => m.carimbarQueApareceu({ data: { accessToken: token } }))
          .catch(() => {});
      }

      /* O papel (admin? médico?) são DUAS idas ao servidor de funções, e a
         gestante com DUM não precisa esperar por elas para ver a home — ver
         `liberarCedo` abaixo. Quem ainda precisa esperar é quem NÃO tem
         âncora gestacional: é ali que mora o médico sem marca, e a espera é o
         que impede o painel dele de piscar como app de gestante. */
      const papelEmVoo = (async () => {
        if (!token) return null;
        try {
          const [admin, medico] = await Promise.all([
            checkIsAdmin({ data: { accessToken: token } }),
            /* `catch` PRÓPRIO: conta sem perfil de médico é o caso comum
                 (é uma gestante), e sem isto o `Promise.all` derrubaria a
                 resolução de papel inteira por causa do caminho normal. */
            getMyDoctor({ data: { accessToken: token } }).catch(() => null),
          ]);
          return { admin, medico };
        } catch {
          return null;
        }
      })();
      const perfilRes =
        perfilEmVoo && idDaSessao === u.user.id
          ? await perfilEmVoo
          : await (supabase as any)
              .from("patient_profiles")
              .select("*")
              .eq("id", u.user.id)
              .maybeSingle();
      const { data } = perfilRes as { data: any };
      setProfile(data);
      setUserId(u.user.id);

      /* ── ⚠️ A GESTANTE COM DUM NÃO ESPERA O PAPEL ──────────────────────
         Quem tem âncora gestacional (DUM, DPP ou ultrassom) e não carrega a
         marca de médico É paciente — as duas idas ao servidor de funções
         (`checkIsAdmin`, `getMyDoctor`) só podem CONFIRMAR isso. Esperá-las
         era pôr a home de toda gestante atrás de duas funções serverless que
         acordam frias. A resposta continua sendo aplicada quando chega: admin
         vira admin, e a obstetra grávida continua com o app dela como antes.
         Quem NÃO tem âncora espera como sempre — é o caso do médico sem marca,
         e é para ele que a espera existia. */
      const marcaDeMedico = (u.user.user_metadata as { role?: string } | null)?.role === "doctor";
      const ancora = !!(data?.lmp_date || data?.due_date || data?.reference_date);
      const liberarCedo = ancora && !marcaDeMedico;
      if (liberarCedo) setLoading(false);
      const papel = await papelEmVoo;

      // Para quem NÃO foi liberada acima, o papel vem ANTES de liberar o
      // render: sem isso o médico via o app da gestante piscar por 2-3
      // round-trips até o bloqueio assumir.
      let roleIsPatient = true;

      /* A MARCA DO AUTH VEM PRIMEIRO, antes de qualquer chamada de rede.
         
         Ela é local (está no token que já temos em mãos) e não pode falhar.
         Estava depois do `checkIsAdmin`, que é um ida-e-volta ao servidor: se
         aquela chamada caísse, a leitura da marca nunca acontecia e o médico
         recebia o app da gestante inteiro — exatamente o bug que a marca
         existe para evitar, ressuscitado por uma falha de rede.
         
         E há a válvula de escape: marca de médico SEM linha em `doctors` e com
         gestação em curso é quase certamente alguém que se marcou por engano
         (passou pela tela de cadastro de médico e não seguiu). Nesse caso a
         marca é apagada em vez de trancá-la fora dos dois apps — sem isto, um
         clique errado não tinha desfazer em nenhum lugar do sistema. */
      const papelMarcado = (u.user.user_metadata as { role?: string } | null)?.role;
      const temAncoraGestacional = !!(data?.lmp_date || data?.due_date || data?.reference_date);
      if (papelMarcado === "doctor") {
        if (temAncoraGestacional) {
          try {
            await supabase.auth.updateUser({ data: { role: null } });
          } catch {
            /* se não der, o pior caso é ela ver a tela de médico e falar comigo */
          }
        } else {
          setIsDoctor(true);
          roleIsPatient = false;
        }
      }

      /* As duas respostas de papel já chegaram (saíram junto com o perfil).
         Aqui só se APLICA — e na mesma ordem de antes, que é o que mantém a
         regra de quem vê o quê idêntica. */
      try {
        if (papel) {
          const r = papel.admin;
          setIsAdmin(r.isAdmin);
          if (r.isAdmin) roleIsPatient = false;
          // Médico cadastrado (ativo OU não) é médico — não usa o app da
          // gestante (o render abaixo troca o app pela tela de redirecionamento
          // ao /painel). Admin nunca entra aqui: continua vendo tudo p/ testar.
          if (!r.isAdmin) {
            /* `getMyDoctor` é a segunda fonte: cobre as contas criadas antes
               da marca existir. A primeira fonte (o metadata) já rodou lá
               acima, fora de qualquer chamada de rede.
               `me` é null quando a chamada falhou ou não há perfil de médico —
               os dois casos querem dizer "é gestante, segue no app". */
            const me = papel.medico;
            /* Linha em `doctors` E âncora gestacional = ela é as DUAS coisas.

               Uma obstetra grávida existe, e antes ela perdia o próprio app
               no instante em que criava o perfil profissional: diário, chutes,
               álbum e jornada continuavam no banco e inalcançáveis por
               qualquer tela, sem nenhum caminho de volta dentro do produto —
               só SQL. A separação que o produto quer é entre CONTAS, não entre
               pessoas: quem tem gestação em curso continua com o app dela, e o
               painel segue aberto pelo menu. */
            if (me?.ok && me.doctor && !temAncoraGestacional) {
              setIsDoctor(true);
              roleIsPatient = false;
            }
          }
        }
      } catch {
        /* Falha de rede na resolução de papel. `roleIsPatient` já carrega o que
           a marca do Auth disse lá acima, então uma queda aqui não transforma
           mais um médico em gestante — era o que acontecia quando este `try`
           não tinha `catch` nenhum e a exceção escapava. */
      } finally {
        setLoading(false);
      }

      // Ritual de boas-vindas: só pra paciente que ainda não tem âncora de
      // gestação (sem DUM, DPP ou ultrassom) e que não dispensou o convite.
      if (roleIsPatient) {
        const hasAnchor = !!(data?.lmp_date || data?.due_date || data?.reference_date);
        let dismissed = false;
        try {
          dismissed = !!localStorage.getItem(`onboarded:${u.user.id}`);
        } catch {
          /* modo privado: sem persistência do "pular" */
        }
        if (!hasAnchor && !dismissed) setShowOnboarding(true);

        /* ── O TUTORIAL DO BEBÊ BOLHA ────────────────────────────────────
           Só para paciente, só uma vez, e só em quem já passou pelo ritual de
           boas-vindas: duas telas cheias empilhadas no primeiro minuto seriam
           dois tutoriais, não um. Quem ainda vai ver o ritual encontra o
           tutorial na próxima abertura, com o app já personalizado — e aí a
           barra que ele explica leva a telas com o nome dela dentro. */
        let jaViu = false;
        try {
          jaViu = !!localStorage.getItem(chaveDoTutorial(u.user.id));
        } catch {
          /* modo privado: ele volta. Ver `fecharTutorial`. */
        }
        if (!jaViu && (hasAnchor || dismissed)) {
          /* Retoma de onde ela parou — inclusive depois de fechar o app. */
          setPassoDoTutorial(lerPassoDoTutorial(u.user.id));
          setTutorialAberto(true);
        }
      }
    })();
  }, []);

  // Comemoração de nova semana de gestação: quando a semana avança em relação
  // à última vista (guardada por usuário no localStorage), abre o modal de
  // marco com confete. Nunca em Modo Cuidado. Não dispara no 1º carregamento
  // (só registra a semana atual).
  useEffect(() => {
    if (!userId || !profile) return;
    const g = computeGestation({
      lmp: profile.lmp_date,
      referenceDate: profile.reference_date,
      referenceWeeks: profile.reference_weeks,
      referenceDays: profile.reference_days,
    });
    if (!g) return;
    const careOn = Boolean((profile as { care_mode?: boolean }).care_mode);
    const key = `lastWeek:${userId}`;
    let stored: number | null = null;
    try {
      const v = localStorage.getItem(key);
      stored = v ? Number(v) : null;
    } catch {
      /* modo privado */
    }
    if (stored !== null && g.weeks > stored && !careOn) setMilestoneWeek(g.weeks);
    try {
      localStorage.setItem(key, String(g.weeks));
    } catch {
      /* modo privado */
    }
  }, [userId, profile]);

  async function signOut() {
    /* ⚠️ **O cache da Comunidade some ANTES da sessão.** Ele guarda fotos,
       textos e nomes de OUTRAS pacientes; num aparelho compartilhado — que num
       consultório é o caso comum, não a exceção — a próxima conta a entrar não
       pode encontrar o feed da anterior na tela. Ele mora só na memória e nunca
       no disco, exatamente por isso. */
    (await import("@/lib/cache-do-feed")).limparCacheDoFeed();
    await supabase.auth.signOut();
    // Limpa a jornada local (dc-path-*) e o marcador de sync: num aparelho
    // compartilhado, a próxima conta NÃO pode ver nem re-subir os dados de
    // saúde da conta anterior (vazamento entre contas).
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("dc-path-") || k === "dc-journey-synced-at")) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      /* modo privado/quota: sem cache local a limpar */
    }
    navigate({ to: "/" });
  }

  if (loading)
    return (
      <>
        {/* ESQUELETO NO FORMATO DA HOME DO CELULAR.
            O anterior era uma grade de oito quadradinhos com 5 colunas — o
            desenho da versão de computador. No celular a tela trocava de
            SILHUETA ao carregar: primeiro uma grade cinza, depois um céu de
            borda a borda com o bebê no meio. Era metade do "pisca" que ela
            relatava; a outra metade era a rolagem.
            Agora o vulto é o mesmo: bloco alto sangrando nas laterais (o céu),
            cartão da semana em degrau e a fileira de medidas. O conteúdo
            aparece DENTRO do lugar onde já estava, em vez de empurrar tudo. */}
        <div className="md:hidden">
          <div className="skeleton -mx-5 -mt-2 h-[62vh] rounded-none" />
          <div className="mx-auto -mt-10 w-[86%] space-y-2">
            <div className="skeleton mx-auto h-16 w-32 rounded-t-3xl" />
            <div className="skeleton h-28 rounded-[26px]" />
          </div>
        </div>
        <div className="mx-auto hidden max-w-5xl px-5 py-8 space-y-4 md:block">
          <div className="skeleton h-52 rounded-3xl" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[72px] rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-16 rounded-3xl" />
          <div className="skeleton h-24 rounded-3xl" />
        </div>
      </>
    );

  /* ─── EM MODO CUIDADO, A IDADE GESTACIONAL DEIXA DE EXISTIR NA TELA ──────
   *
   * Eu tinha consertado isto tapando buraco: escondi a semana na saudação do
   * Chat IA e da Nutrição, e escrevi no commit que "eram as únicas duas abas
   * que não recebiam `careMode`". Era falso. Um verificador adversarial listou
   * o que sobrou:
   *
   *   · o CABEÇALHO do desktop — "Acompanhando Lucas · 24s 3d de gestação" —
   *     em cima de TODA aba, inclusive das que eu tinha "consertado";
   *   · o DIÁRIO, que é onde uma mulher em luto escreve, abrindo com
   *     "como você está se sentindo hoje? / Semana 24 — 2º trimestre";
   *   · a carteirinha de emergência com "GESTANTE", nome do bebê e IG;
   *   · o corpo inteiro da Nutrição ("Formação óssea do bebê");
   *   · o contexto que o cliente manda ao servidor na primeira mensagem
   *     ("Estou na semana 24... o nome do meu bebê é Lucas");
   *   · e mais sete abas.
   *
   * Quinze lugares. Gatear um por um sempre deixaria o décimo sexto — e o
   * décimo sexto é uma mulher lendo o nome do bebê que ela perdeu.
   *
   * `gest` é a FONTE de todos eles. Nula, a idade gestacional some da tela
   * inteira de uma vez, e cada `{gest && ...}` que já existe passa a fazer a
   * coisa certa sozinho. O servidor não depende disto: ele recalcula do perfil
   * e já trata o Modo Cuidado em `buildClinicalBlock`.
   */
  const gest =
    profile && !careMode
      ? computeGestation({
          lmp: profile.lmp_date,
          referenceDate: profile.reference_date,
          referenceWeeks: profile.reference_weeks,
          referenceDays: profile.reference_days,
        })
      : null;

  const firstName = profile?.display_name?.split(" ")[0] ?? "mamãe";

  // Mobile navigation helpers
  // `null` = tela filha do hub (Calendário, Registros, Médico…): nenhuma pílula
  // acesa, em vez de acender "Bebê" fora do Bebê.
  const activeSection: BottomSection | null = mobileHome ? "home" : tabToSection(tab as AppTab);

  function mobileNavigate(t: AppTab, sub?: string) {
    setTab(t as Tab);
    setMobileHome(false);
    setConsultasSub(sub ?? null);
  }

  function handleBottomNav(section: BottomSection) {
    /* A barra de baixo é destino, não aprofundamento: ir para "Jogo" por ela
       apaga a origem, senão o voltar levaria de volta a uma tela que a
       paciente já abandonou por outro caminho. Vale igual para o hub guardado:
       quem saiu da Saúde pela barra não quer voltar para a grade dela. */
    setOrigem(null);
    setVoltarAoHub(null);
    /* ⚠️ ANTES do ramo da home. Ele sai com `return`, então só o caminho de
       baixo limpava: tocar em Saúde e depois no círculo do Bebê voltava à home
       com `hubAberto` ainda aceso, e o toque seguinte em Bebê abria a grade da
       Saúde em vez da tela do bebê. */
    setHubAberto(null);
    setNotifOpen(false);
    if (section === "home") {
      setMobileHome(true);
      return;
    }
    setMobileHome(false);
    // Jogo/Comunidade têm uma aba só e abrem DIRETO nela. Saúde tem seis: abre
    // no hub, a grade de quadrados. (Bebê = home, tratado acima.)
    const sectionMap: Record<Exclude<BottomSection, "home">, Tab> = {
      jogo: "Caminho",
      /* ⚠️ A barra abre o FEED, e não o hub de portas.
         Pedido do dono: "essa é a primeira tela que tem que ter quando se
         entra na aba da comunidade — a tela do feed, mostrando as
         publicações". É a régua do Instagram e ela está certa: uma aba social
         que abre num menu de seções faz a pessoa dar um toque a mais para
         chegar na única coisa que muda sozinha. O hub continua alcançável
         pelo botão ⊞ do cabeçalho do feed. */
      comunidade: "Feed",
      saude: "Saúde",
    };
    setTab(sectionMap[section]);
    /* ⚠️ **TOCAR NO ÍCONE DA COMUNIDADE ESTANDO DENTRO DELA NÃO FAZIA NADA.**
       A aba tem sub-telas próprias (perfil, salvos, caixinha, arquivados,
       busca), e a barra só publica atalhos quando ela está no FEED — então
       de dentro de uma sub-tela o toque caía num `setTab("Feed")` que já era
       "Feed", e a tela não se mexia. A paciente ficava presa num perfil sem
       nenhuma pista de como voltar ao feed além da seta.
       O sinal é um CONTADOR e não um booleano: ele precisa disparar de novo a
       cada toque, e um booleano só dispararia uma vez. Estando já no feed, o
       efeito só rola para o topo — que é o gesto do modelo. */
    if (section === "comunidade") setVoltarAoFeed((n) => n + 1);
    setHubAberto(section === "saude" ? "saude" : null);
  }

  /* A seta da barra de cima.
     Três níveis, do mais específico para o mais genérico:
       1. dentro de uma aba da Saúde → volta para o hub da seção (antes pulava
          dois níveis de uma vez e caía na home);
       2. veio de outra aba → volta para ELA. Era o que faltava: a seta fazia
          sempre `setMobileHome(true)`, então quem estava no Caminho, abria a
          lojinha e voltava, era despejado na tela do Bebê e perdia o lugar na
          trilha;
       3. não veio de lugar nenhum → home. */
  function voltarDaBarra() {
    /* Antes da regra 1, e não depois: quem veio de um hub para uma aba de
       fora da seção dele (Chutes, Contrações) volta para o hub. A regra 1 não
       pega esse caso porque ela olha a SEÇÃO da aba atual, e a aba atual é
       Registros. */
    if (!hubAberto && voltarAoHub) {
      setHubAberto(voltarAoHub);
      setVoltarAoHub(null);
      setConsultasSub(null);
      return;
    }
    if (!hubAberto && tabToSection(tab as AppTab) === "saude") {
      setHubAberto("saude");
      return;
    }
    setHubAberto(null);
    if (origem) {
      setTab(origem);
      setOrigem(null);
      setConsultasSub(null);
      return;
    }
    setMobileHome(true);
  }

  // Médico (não-admin) NÃO usa o app da gestante: bebê, diário, jogo e afins
  // são exclusivos das pacientes. O espaço dele é o /painel. A conta admin
  // (ADMIN_EMAILS) segue vendo tudo para testar — isDoctor só é setado quando
  // o usuário não é admin (ver efeito de carga acima).
  if (isDoctor) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <p className="text-5xl">🩺</p>
        <h1 className="mt-4 font-serif text-2xl">Esta área é da gestante</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sua conta é de médico — o bebê, o diário e a jornada são exclusivos das pacientes. O seu
          espaço de trabalho é o painel do consultório.
        </p>
        <Link
          to="/painel"
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ir para o meu painel →
        </Link>
        {/* SAÍDA. Sem ela havia um beco sem volta real: quem tocasse em "Criar
            conta grátis" na página de médicos por curiosidade — uma gestante,
            inclusive — ficava marcada como médica, sem linha em `doctors`, com
            este bloqueio de um lado e "Área restrita" do outro. Sair e entrar de
            novo não resolvia (a marca é do servidor) e nenhuma tela do produto
            a apagava. Este botão apaga, e só quando não existe perfil médico —
            então não tira o painel de médico nenhum. */}
        <button
          onClick={async () => {
            try {
              const { data: s } = await supabase.auth.getSession();
              if (!s.session) return;
              const me = await getMyDoctor({ data: { accessToken: s.session.access_token } });
              if (me.ok && me.doctor) {
                toast.error("Sua conta tem perfil de médico — o seu espaço é o painel.");
                return;
              }
              await supabase.auth.updateUser({ data: { role: null } });
              toast.success("Pronto — abrindo o app da gestante.");
              window.location.reload();
            } catch {
              toast.error("Sem conexão para trocar agora. Tente de novo em instantes.");
            }
          }}
          className="mt-4 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground"
        >
          Não sou médico(a) — abrir o app da gestante
        </button>
        <button
          onClick={signOut}
          className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Sair da conta
        </button>
      </section>
    );
  }

  return (
    <>
      {/* ── Cadastro de médico pela metade ───────────────────────────
          Última rede: se a pessoa começou um cadastro profissional neste
          aparelho e ainda não tem perfil de médico, ela chegou aqui por um
          desvio (link de confirmação de e-mail, sessão viva num reload). Antes
          isso era silencioso — o app pedia o nome do bebê a um obstetra e não
          havia nenhuma porta de volta. */}
      {querSerMedicoAqui && (
        <div className="mx-auto mb-3 max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">Seu cadastro de médico está incompleto</p>
          <p className="mt-1 text-[13px] leading-snug text-amber-900/80">
            Você começou a criar uma conta profissional neste aparelho. Termine o perfil para abrir
            o painel do consultório.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/medicos/cadastro"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Continuar o cadastro de médico →
            </Link>
            <button
              onClick={() => {
                void import("@/lib/intencao-medico").then((m) => {
                  m.esquecerIntencaoMedico();
                  setQuerSerMedicoAqui(false);
                });
              }}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground"
            >
              Não era isso, sou gestante
            </button>
          </div>
        </div>
      )}

      {/* ── O bebê bolha apresentando a barra de baixo ────────────
          Só na home do celular: ele explica a barra, e a barra só existe ali.
          E nunca em Modo Cuidado — quem acabou de perder a gestação não abre o
          app para um passeio guiado pelas funcionalidades.

          ⚠️ `ehCelular` é OBRIGATÓRIO ao lado de `mobileHome`, e não uma
          redundância: `mobileHome` é ESTADO (a aba escolhida), enquanto quem
          esconde a home e a barra no computador é a classe `md:hidden`, que é
          CSS. Num monitor, o estado continuava verdadeiro e o tutorial abria
          apontando com holofote e setas para uma barra que não está na tela —
          sete cartões falando de ícones invisíveis, e a marca de "já viu"
          gravada no fim. Quem entrou pelo computador perdia o tutorial do
          celular para sempre. */}
      {tutorialAberto && mobileHome && ehCelular && !careMode && !showOnboarding && (
        <TutorialDaBolha
          nome={profile?.display_name ?? null}
          passo={passoDoTutorial}
          onAvancar={avancarTutorial}
          onPasso={(d) => setDestaqueDaBarra(d as DestaqueDoTutorial)}
          onFechar={fecharTutorial}
        />
      )}

      {/* ── Ritual de boas-vindas (primeiro acesso) ─────────────── */}
      {showOnboarding && (
        <OnboardingRitual
          initialName={profile?.display_name?.split(" ")[0] ?? ""}
          onClose={(saved) => {
            if (saved) setProfile(saved);
            try {
              if (userId) localStorage.setItem(`onboarded:${userId}`, "1");
            } catch {
              /* modo privado */
            }
            setShowOnboarding(false);
          }}
        />
      )}

      {/* ── Marco: nova semana de gestação (com confete) ────────── */}
      {milestoneWeek !== null && (
        <WeekMilestoneModal
          week={milestoneWeek}
          babyName={profile?.baby_name ?? null}
          motherName={profile?.display_name?.split(" ")[0] ?? ""}
          tone={profile?.baby_skin_tone ?? 0}
          careMode={careMode}
          onClose={() => setMilestoneWeek(null)}
          aoPublicarNaComunidade={(m) => {
            guardarMomentoParaPublicar(m);
            setMilestoneWeek(null);
            goToTab("Feed");
          }}
        />
      )}

      {/**
       * ── Central de emergência (aberta pelo SOS da barra) ──────
       *
       * ⚠️ **NÃO HÁ PORTÃO DE MODO CUIDADO AQUI, E ISSO É A REGRA.**
       *
       * Esta condição era `emergencyOpen && !careMode`: a paciente em luto
       * tocava no SOS da barra — que continua ACESO —, `emergencyOpen` virava
       * `true`, e a folha simplesmente não montava. O botão de emergência do
       * app não fazia nada, exatamente para quem mais precisa dele.
       *
       * Quem acabou de perder uma gestação está em risco clínico ALTO
       * (hemorragia, infecção, pré-eclâmpsia de pós-parto) e em risco
       * psiquiátrico. O Modo Cuidado existe para o app parar de falar do bebê
       * — nunca para parar de socorrer.
       *
       * E a decisão já estava escrita DENTRO da própria folha, no comentário do
       * som do alarme: "`podeSoar` deixa passar mesmo com o som desligado e
       * mesmo em Modo Cuidado — quem perdeu a gestação continua podendo passar
       * mal". O componente sabia; a tela que o monta fazia o contrário.
       *
       * O que o luto muda é o CONTEÚDO, não a porta: `weekLabel` chega `null`
       * quando não há gestação em curso, e a folha já não desenha a linha da
       * semana nesse caso. Gatear a folha inteira para não mostrar uma linha é
       * apagar o socorro para esconder um rótulo.
       */}
      {emergencyOpen && (
        <EmergencySheet
          /* A triagem de sintomas perdeu o ladrilho da grade da Saúde e ficou
             sem caminho nenhum no celular — as fileiras de categorias que a
             listam são `hidden md:flex`. Esta é a porta dela agora, e é a
             porta certa: quem lê a lista vermelha e fica em dúvida está a um
             toque de responder. */
          onTriagem={() => {
            setEmergencyOpen(false);
            goToTab("Alertas");
          }}
          /* ⚠️ A FICHA QUE O SOCORRISTA LÊ, E O ÚNICO PORTÃO DE MODO CUIDADO
             DELA — que vive AQUI, e não dentro da folha.

             Em Modo Cuidado a ficha dizia "FICHA DE EMERGÊNCIA - GESTANTE",
             com o NOME DO BEBÊ e a DPP. Ela abre o SOS — a tela que ela abre
             quando alguma coisa está errada — e lê o nome do bebê que ela
             perdeu e uma data de parto que não vai acontecer.

             ⚠️ **O que NÃO se faz aqui é apagar a ficha.** Quem perdeu uma
             gestação continua sendo paciente obstétrica: hemorragia,
             infecção, pré-eclâmpsia de pós-parto e trombose são justamente os
             riscos dela, e o socorrista precisa saber disso. Tipo sanguíneo,
             alergias, medicações, contato e médico ficam INTEIROS.

             O que sai é o que é falso: um bebê que não vai nascer e uma DPP
             que não existe — que não são só dolorosos, são informação ERRADA
             para quem vai atendê-la. E "GESTANTE" vira "PACIENTE OBSTÉTRICA",
             que continua sinalizando obstetrícia na triagem sem afirmar uma
             gestação em curso.

             ⚠️ A idade gestacional sai junto, e esta é a única linha em que se
             troca informação por exatidão: "28s 3d" afirma uma gestação de
             hoje. Se o dono quiser a semana de volta, ela precisa vir com
             outro rótulo — é decisão clínica dele, não minha. */
          tituloDaFicha={careMode ? "FICHA DE EMERGÊNCIA - PACIENTE OBSTÉTRICA" : undefined}
          info={{
            name: profile?.display_name?.split(" ")[0] ?? null,
            weekLabel: careMode || !gest ? null : `${gest.weeks}s ${gest.days}d`,
            bloodType: profile?.blood_type ?? null,
            allergies: profile?.allergies ?? null,
            emergencyContact: profile?.emergency_contact ?? null,
            emergencyPhone: profile?.emergency_phone ?? null,
            babyName: careMode ? null : (profile?.baby_name ?? null),
            dpp: careMode
              ? null
              : (() => {
                  const due =
                    profile?.due_date ??
                    (profile?.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
                  return due ? new Date(`${due}T00:00:00`).toLocaleDateString("pt-BR") : null;
                })(),
            medications: profile?.medications ?? null,
          }}
          medico={meuMedico}
          medicoResolvido={medicoResolvido}
          onClose={() => setEmergencyOpen(false)}
          onOpenCard={() => {
            setEmergencyOpen(false);
            goToTab("Carteirinha");
          }}
        />
      )}

      {/* ── App bottom nav (mobile only) ─────────────────────── */}
      <AppBottomNav
        activeSection={activeSection}
        onSelect={handleBottomNav}
        /* O SOS NÃO é gated por Modo Cuidado — e isto é uma correção, não um
           esquecimento. O Modo Cuidado existe para calar gamificação,
           comemoração e cobrança; esconder o botão de emergência era o
           contrário de cuidado, ainda mais porque quem está em Modo Cuidado
           costuma estar num momento em que precisa MAIS dele. Era, também, a
           única porta de entrada do SOS no app inteiro. */
        onEmergency={() => setEmergencyOpen(true)}
        escura={barraEscura}
        destaque={destaqueDaBarra}
      />

      {/* ── Jornada do Bebê (toque na foto) + popup Premium ─────── */}
      {journeyOpen && gest && (
        <BabyJourneyModal
          currentWeek={gest.weeks}
          tone={profile?.baby_skin_tone ?? 0}
          premium={!!profile?.quiz_premium}
          onClose={() => setJourneyOpen(false)}
          onWantPremium={() => setPremiumOpen(true)}
        />
      )}
      {premiumOpen && (
        <PremiumUpsellModal
          onClose={() => setPremiumOpen(false)}
          onUnlocked={async () => {
            // Cupom aplicado: recarrega o perfil para o premium refletir já.
            const { data: u } = await supabase.auth.getUser();
            if (!u.user) return;
            const { data } = await (supabase as any)
              .from("patient_profiles")
              .select("*")
              .eq("id", u.user.id)
              .maybeSingle();
            if (data) setProfile(data);
          }}
        />
      )}

      {/* pb: folga p/ a barra flutuante + área segura do iPhone não cobrirem o fim */}
      <PullToRefresh onRefresh={refreshAll}>
        <section className="mx-auto max-w-5xl px-5 pt-[calc(1.5rem+var(--safe-top))] pb-[calc(7rem+var(--safe-bottom))] md:py-12">
          {/* ── Desktop header ───────────────────────────────────── */}
          <div className="hidden md:flex flex-wrap items-end justify-between gap-3 mb-2">
            <div>
              <p className="font-serif text-[15px] font-semibold text-primary">Minha conta</p>
              <h1 className="mt-2 font-serif text-3xl md:text-4xl">
                {dayGreeting()}, {firstName} 💛
              </h1>
              {/* O nome do bebê some junto. `gest` nulo já tira a semana, mas
            "Acompanhando Lucas" sozinho é pior que a semana. */}
              {!careMode && (profile?.baby_name || gest) && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {profile?.baby_name && <>Acompanhando {profile.baby_name}</>}
                  {profile?.baby_name && gest && <span className="mx-2 opacity-40">·</span>}
                  {gest && (
                    <>
                      {gest.weeks}s {gest.days}d de gestação
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* DONO e MÉDICO são identidades diferentes, e o botão precisa
                  dizer qual é qual.

                  Antes os dois caíam no mesmo link: o dono da plataforma via
                  "Painel do médico" e chegava no consultório — a tela de agenda
                  e prontuário —, enquanto o console dele, com faturamento e
                  cupons, não tinha link nenhum no app inteiro.

                  O `isAdmin` vem primeiro de propósito: o e-mail do dono também
                  está em ADMIN_EMAILS como equipe do consultório, então testar
                  `isDoctor` antes o mandaria para o lugar errado. */}
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
                >
                  Painel Admin
                </Link>
              ) : isDoctor ? (
                <Link
                  to="/painel"
                  className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
                >
                  Painel do médico
                </Link>
              ) : null}
              <button
                onClick={signOut}
                className="rounded-full border border-border/70 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                Sair
              </button>
            </div>
          </div>

          {/* ── Mobile top bar ─────────────────────────────────────
              Na home ela some: o herói imersivo tem a própria barra flutuante
              sobre o céu (☰ + clima), e estas mesmas ações moram no ☰.

              ⚠️ **E no FEED ela some também** — pedido do dono, com a foto do
              aparelho: "toda essa parte de cima deve sumir, não precisamos que
              cada aba do app ocupe esse espaço que é precioso… o primeiro
              elemento da aba será os stories, assim como no Instagram". Ali
                eram DUAS barras empilhadas (esta e a da própria tela), e as duas
              juntas comiam a primeira dobra inteira de um iPhone.

              ⚠️ O que ela perde é a SETA e o "Sair", e as duas continuam
              alcançáveis: a barra de baixo troca de aba a um toque (é ela que
              faz o papel de voltar numa aba raiz), e "Sair" mora no ☰ e no
              Perfil. Por isso a barra saiu SÓ do Feed, e não das outras abas:
              nas telas filhas (Registros, Calendário) a seta é o único caminho
              de volta, e `voltarDaBarra` tem três regras que existem por
              defeito medido. */}
          <div
            className={`${mobileHome || tab === "Feed" ? "hidden" : "flex"} md:hidden items-center justify-between gap-2 mb-4`}
          >
            {/* Voltar + nome da aba, juntos. O nome aparecia DUAS vezes em toda
                tela — aqui e de novo logo abaixo, num cabeçalho próprio com a
                seta ("Caminho" / "Caminho"). Sobrou uma vez só, e a seta subiu
                para junto dele: a linha que se repetia era espaço morto no alto
                de cada tela do app.
                O ternário do título também saiu: esta barra é `hidden` quando
                `mobileHome`, então o ramo da saudação nunca renderizava. */}
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                onClick={voltarDaBarra}
                aria-label={origem ? `Voltar para ${origem}` : "Voltar"}
                className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary transition-colors hover:bg-primary/15"
              >
                <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
              <p className="truncate font-serif text-xl leading-tight text-foreground">
                {hubAberto ? "Sua saúde" : tab}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(isAdmin || isDoctor) && (
                <Link
                  to="/painel"
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
                >
                  Painel
                </Link>
              )}
              {/* Perfil/ajustes — engrenagem no topo (saiu da grade de atalhos). */}
              <button
                onClick={() => {
                  setTab("Perfil");
                  setMobileHome(false);
                }}
                aria-label="Perfil e ajustes"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                <Settings className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </button>
              <button
                onClick={signOut}
                className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                Sair
              </button>
            </div>
          </div>

          {/* Os dois cartões que ficavam aqui — "você ainda não tem um médico"
              e "convide o seu médico" — viraram notificações.
              Eles apareciam SEMPRE JUNTOS (a condição dos dois é a mesma:
              sem `doctor_id`) e, com o convite da localização, davam três
              avisos empilhados acima do bebê. A primeira coisa que a paciente
              via ao abrir o app eram três pedidos, nenhum deles o filho dela.
              Continuam existindo, e agora com uma vantagem: dispensar não
              apaga mais para sempre — estão na central, atrás do ☰. */}

          {/* ── Mobile: home screen ──────────────────────────────── */}
          {mobileHome && (
            <div className="md:hidden">
              {/* ⚠️ O BANNER DO MODO CUIDADO VEM DEPOIS DO HERO, e não antes.
                  Ele ficava aqui em cima, e o hero — que cancela a folga da
                  página com `-mt-[calc(1.5rem+var(--safe-top))]` para encostar
                  no topo do aparelho — subia POR CIMA dele. Medido no
                  navegador (393×852, safe-top 59): o banner ia até 403 e o céu
                  começava em 336, guilhotinando 67px; `elementFromPoint` no
                  centro de "Sair do Modo Cuidado" devolvia a div do hero, ou
                  seja, o botão não recebia toque. E o estrago cresce 1:1 com o
                  notch, então o pior caso é o app instalado — que é onde o Modo
                  Cuidado é usado.

                  A margem negativa é um cancelamento CEGO do `pt` da página, e
                  só está certa enquanto o hero for o primeiro filho em fluxo.
                  Pôr o banner depois dele resolve sem tocar na régua do céu, e
                  ainda o coloca no fundo claro, que é onde moram os cartões. */}
              {/* ⚠️ **A TELA DO BEBÊ FICAVA FORA DE QUALQUER PROTEÇÃO.** O
                  `TabErrorBoundary` só envolve o conteúdo das ABAS, e esta é a
                  primeira dobra do app — a que toda paciente vê ao abrir, e a
                  que mais depende de dado real (semana, perfil, médico,
                  recados, clima). Um `undefined` inesperado ali derrubava a
                  rota INTEIRA e virava "Algo deu errado" em cima do app, sem
                  nenhum caminho de volta.
                  Com o portão, o pior caso passa a ser um cartão quebrado
                  dentro de um app que abre — e o erro fica LEGÍVEL, que é o que
                  faltava para achar este defeito. */}
              <TabErrorBoundary tabName="tela inicial">
                <AppHomeScreen
                  firstName={firstName}
                  babyName={profile?.baby_name ?? null}
                  gest={gest}
                  onNavigate={mobileNavigate}
                  onOpenMenu={() => setHomeMenu(true)}
                  medico={
                    meuMedico
                      ? {
                          nome: meuMedico.nome,
                          title: meuMedico.title,
                          specialty: meuMedico.specialty,
                          crm: meuMedico.crm,
                        }
                      : null
                  }
                  temNaoLidas={naoLidas > 0}
                  naoLidas={naoLidas}
                  /* O mascote leva DIRETO à central, sem passar pelo menu: ele
                   acabou de anunciar o recado, e fazer a paciente procurá-lo
                   dentro da lista da conta desmentiria o anúncio. */
                  onOpenRecados={() => setNotifOpen(true)}
                  /* O chat saiu da barra de baixo e a bolha virou a porta dele.
                   Nenhuma funcionalidade do chat mudou — só quem o abre. */
                  onOpenChat={() => goToTab("Chat IA")}
                  /* Durante o tutorial ele fala pelo cartão, não pelo canto.
                   A MESMA condição que desenha o tutorial (`&& ehCelular`):
                   com só `tutorialAberto`, uma janela larga calava o mascote
                   por causa de um tutorial que não está na tela. */
                  mascoteCalado={tutorialAberto && ehCelular}
                  dica={
                    dicaDaBolha && !careMode
                      ? {
                          ...falaDaDica(dicaDaBolha),
                          aoTocar: () => goToTab(dicaDaBolha.tab, dicaDaBolha.sub),
                        }
                      : null
                  }
                  onOrigemLocal={setOrigemLocal}
                  babyTone={profile?.baby_skin_tone ?? 0}
                  careMode={careMode}
                  skyTheme={profile?.sky_theme === "v1" ? "v1" : "v2"}
                  /* Só entra na cadeia se as TRÊS partes existirem: nome sem
                   coordenada não serve para consultar clima nenhum. */
                  homeCity={
                    profile?.home_city && profile.home_lat != null && profile.home_lon != null
                      ? { nome: profile.home_city, lat: profile.home_lat, lon: profile.home_lon }
                      : null
                  }
                />
              </TabErrorBoundary>
              {careMode && (
                <div className="mt-4">
                  <CareModeBanner onExit={() => toggleCareMode(false)} onNavigate={goToTab} />
                </div>
              )}

              {/* Menu do ☰: as ações que viviam na barra de topo da home
                  (saudação, Painel, Perfil e Sair) continuam todas aqui. */}
              {homeMenu && (
                <MenuDaConta
                  careMode={careMode}
                  nome={firstName}
                  saudacao={dayGreeting()}
                  foto={profile?.avatar_url ?? null}
                  gest={gest ? { weeks: gest.weeks, days: gest.days } : null}
                  proximaConsulta={
                    nextAppt ? `Próxima: ${nextAppt.dateLabel} · ${nextAppt.typeLabel}` : null
                  }
                  naoLidas={naoLidas}
                  perfilPendente={perfilPendente}
                  mostrarPainel={isAdmin || isDoctor}
                  ehDono={isAdmin}
                  onNotificacoes={abrirNotificacoes}
                  onMapa={() => {
                    setHomeMenu(false);
                    setMapaAberto(true);
                  }}
                  onNavegar={(t, subAba) => {
                    setHomeMenu(false);
                    goToTab(t, subAba);
                  }}
                  onSair={() => {
                    setHomeMenu(false);
                    signOut();
                  }}
                  onFechar={() => setHomeMenu(false)}
                />
              )}

              {mapaAberto && (
                <MapaDoApp
                  careMode={careMode}
                  weeks={gest?.weeks ?? null}
                  visitadas={visitadas}
                  onNavegar={(t, sub) => {
                    setMapaAberto(false);
                    goToTab(t, sub);
                  }}
                  onFechar={() => setMapaAberto(false)}
                />
              )}
              {notifOpen && (
                <NotificacoesSheet
                  lista={caixaDeEntrada}
                  lidas={lidas}
                  onLer={marcarUmaLida}
                  onFechar={() => setNotifOpen(false)}
                />
              )}
            </div>
          )}

          {/* ── Desktop & mobile (when tab selected): category nav + tabs ── */}
          <div className={mobileHome ? "hidden md:block" : "block"}>
            {/* A fileira de pílulas que ficava aqui saiu. Ela só existia para a
              seção Saúde (Jogo e Chat têm uma aba só), rolava na horizontal e
              escondia duas das seis abas fora da borda da tela. O hub abaixo
              faz o mesmo trabalho mostrando as seis de uma vez. */}

            {/* Desktop: seletor de categorias (tem espaço de sobra) */}
            <div className="print:hidden mt-6 hidden gap-1.5 overflow-x-auto pb-1 md:flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {CATEGORIES.map((cat) => {
                const active = categoryOfTab(tab) === cat.label;
                const cs = CAT_STYLE[cat.label] ?? CAT_STYLE["Gestação"];
                return (
                  <button
                    key={cat.label}
                    onClick={() => {
                      /* ⚠️ `goToTab`, não `setTab` cru — a MESMA lição da
                         pílula das Recompensas, no botão ao lado. `setTab`
                         sozinho não limpa `consultasSub`, que é o estado ÚNICO
                         de sub-tela: quem tivesse aberto Chutes (ou a Loja)
                         voltava a cair nela toda vez que trocasse de categoria
                         nesta fita, e a tela de entrada da categoria ficava
                         inalcançável por aqui. */
                      if (!active) goToTab(cat.tabs[0]);
                      setMobileHome(false);
                    }}
                    className={`press flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
                      active
                        ? `${cs.pill} font-semibold`
                        : "text-foreground/60 hover:text-foreground/80"
                    }`}
                  >
                    {active ? `${cs.emoji} ` : ""}
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop: linha de abas da categoria ativa */}
            <div className="print:hidden mt-3 hidden gap-0 overflow-x-auto md:flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex min-w-full gap-1">
                {CATEGORIES.find((c) => c.label === categoryOfTab(tab))?.tabs.map((t) => {
                  const cs = CAT_STYLE[categoryOfTab(tab)] ?? CAT_STYLE["Gestação"];
                  return (
                    <button
                      key={t}
                      /* ⚠️ `goToTab`, não `setTab` cru. Este botão fazia
                         `setTab` + `setMobileHome(false)` e mais nada — em
                         especial NÃO limpava `consultasSub`, que é a sub-aba
                         pedida por quem navegou até aqui. Resultado medido: uma
                         vez aberta uma sub-aba por deep link, toda visita
                         seguinte àquele hub pelo desktop reabria a MESMA
                         sub-aba, para sempre. `goToTab` limpa. */
                      onClick={() => goToTab(t)}
                      className={`press flex-shrink-0 rounded-full px-3.5 py-2 text-sm transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
                        tab === t
                          ? `${cs.pill} font-semibold`
                          : "text-foreground/60 hover:text-foreground/80"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {careMode && (
              <CareModeBanner onExit={() => toggleCareMode(false)} onNavigate={goToTab} />
            )}
            {/* ── Celular: hub da Saúde — seis quadrados, dois por linha ──── */}
            {hubAberto === "saude" && (
              <div className="mt-5 md:hidden">
                <HubSaude
                  weeks={gest?.weeks ?? null}
                  onAbrir={(t, sub) => {
                    setHubAberto(null);
                    /* Só quando o destino sai da seção: dentro dela a regra 1
                       do `voltarDaBarra` já resolve, e guardar aqui também
                       seria um segundo caminho para o mesmo lugar. */
                    setVoltarAoHub(tabToSection(t as AppTab) === "saude" ? null : "saude");
                    setTab(t);
                    /* O MESMO estado de sub-tela que Consultas e Bebê já usam.
                       É ele que faz o ladrilho "Chutes" abrir em Chutes, e não
                       na grade de Registros — sem isso o atalho custaria dois
                       toques a mais que o caminho antigo, e a mudança
                       inteira perderia o sentido. */
                    setConsultasSub(sub ?? null);
                  }}
                />
              </div>
            )}

            {/* Com o hub aberto o conteúdo da aba fica escondido NO CELULAR e
                continua no desktop, que tem as duas fileiras de abas e nunca
                viu o hub. */}
            <div
              key={`${tab}-${refreshKey}`}
              className={`mt-6 tab-enter ${hubAberto ? "hidden md:block" : ""}`}
            >
              <TabErrorBoundary tabName={tab}>
                {tab === "Bebê" && (
                  <BebeHub
                    profile={profile}
                    gest={gest}
                    proximaConsulta={nextAppt}
                    onNavigate={goToTab}
                    onBabyTap={() => setJourneyOpen(true)}
                    careMode={careMode}
                    initialSub={consultasSub}
                    medico={
                      meuMedico
                        ? {
                            nome: meuMedico.nome,
                            title: meuMedico.title,
                            specialty: meuMedico.specialty,
                          }
                        : null
                    }
                  />
                )}
                {tab === "Caminho" && (
                  /* A espera é a BOLHA, não um spinner: ela é a personagem
                     desta aba, e quem abriu o jogo reconhece quem a recebe.
                     Um spinner genérico aqui leria como "o app travou". */
                  <Suspense
                    fallback={
                      <div className="flex flex-col items-center py-20">
                        <Bolha humor="feliz" tamanho={120} careMode={careMode} />
                        <p className="mt-4 text-sm font-bold text-foreground/50">
                          Abrindo o seu caminho…
                        </p>
                      </div>
                    }
                  >
                    <GestacaoPath
                      profile={profile}
                      gest={gest}
                      quizPremium={!!profile?.quiz_premium}
                      careMode={careMode}
                      onOpenShop={() => goToTab("Recompensas")}
                      onOpenAmigas={() => goToTab("Amigas")}
                      /* ⚠️ A vitória vai para a Comunidade pelo MESMO caminho
                         que a aula do dia já usa: o Caminho deixa um bilhete
                         (`guardarMomentoParaPublicar`) e a Comunidade o lê ao
                         abrir. Aqui só se troca de aba — quem sabe do momento é
                         a folha que o gerou, e quem sabe desenhar o cartão é o
                         compositor. */
                      onPublicarNaComunidade={() => goToTab("Feed")}
                    />
                  </Suspense>
                )}
                {tab === "Comunidade" && (
                  <div className="space-y-5">
                    <ConfiguracoesDoPerfil careMode={careMode} />
                    <ComunidadeTab
                      careMode={careMode}
                      /* As portas são ATALHOS: abrem a tela onde ela já mora.
                         `subDestino` vai pelo mesmo caminho que o hub da Saúde
                         usa para Chutes e Contrações. */
                      onAbrir={(destino, sub) => {
                        goToTab(destino as Tab);
                        /* `consultasSub` é o estado ÚNICO de sub-tela que
                           `BebeHub`, `RegistrosHub` e `ConsultasHub` já
                           compartilham — o mesmo que o hub da Saúde usa para
                           abrir Chutes direto. Depois do `goToTab`, que o
                           limpa. */
                        setConsultasSub(sub ?? null);
                      }}
                    />
                  </div>
                )}
                {tab === "Chá de bebê" && (
                  <div className="space-y-5">
                    <CabecalhoDaPorta chave="cha" />
                    <ChaDeBebe careMode={careMode} />
                  </div>
                )}
                {/* ⚠️ A tela do FEED é a do modelo Instagram (`RedeNoApp`), e
                    as CONFIGURAÇÕES ficam acima dela — perfil público, bio e a
                    fila de pedidos. Elas não são parte do modelo copiado: o
                    Instagram as esconde num menu, e aqui o perfil público é uma
                    decisão de exposição que uma gestante de alto risco toma uma
                    vez e precisa achar sem procurar. */}
                {tab === "Feed" && (
                  <Suspense
                    fallback={
                      <div className="space-y-4 py-6">
                        {/* A espera tem a FORMA do feed — a mesma decisão do
                            esqueleto do perfil: meio segundo de tela imóvel lê
                            como app travado. */}
                        <div className="flex gap-3 px-4">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="dc-esqueleto h-[72px] w-[72px] rounded-full" />
                          ))}
                        </div>
                        <div className="dc-esqueleto aspect-[4/5] w-full" />
                      </div>
                    }
                  >
                    <RedeNoApp
                      careMode={careMode}
                      /* ⚠️ **O TUTORIAL DA ABA ESPERA O RITUAL DE BOAS-VINDAS.**
                       Duas telas cheias no primeiro minuto seriam dois
                       tutoriais — é a mesma decisão que `TutorialDaBolha` já
                       toma com `!showOnboarding`. E aqui era alcançável de
                       verdade: o ritual não tem portão de aba nenhum, então uma
                       paciente recém-criada que tocasse em Comunidade antes de
                       terminá-lo receberia os quatro cartões por baixo dele. */
                      adiarOnboarding={showOnboarding}
                      /* Ver `onSelect`: sobe a cada toque no ícone da barra. */
                      sinalDeVoltarAoFeed={voltarAoFeed}
                      onAbrirSecoes={() => goToTab("Comunidade")}
                      /* ⚠️ O bilhete que o Caminho deixou ao terminar a aula — lido
                       AQUI, e não dentro do compositor, porque quem sabe quando
                       a aba abriu é esta tela. Ler no compositor pegaria o
                       estado de quando a Comunidade montou, e ela pode ter feito
                       a aula depois disso, na mesma sessão. */
                      aulaDeHoje={aulaDeHoje}
                      /* O desafio acontece no Caminho: sem esta porta, o cartão
                       convidaria para uma atividade sem dizer onde ela é. */
                      onIrParaOJogo={() => goToTab("Caminho")}
                      /* ⚠️ A MESMA folha do SOS da barra de baixo, e não uma
                       segunda: a triagem da caixinha de perguntas pode achar
                       bandeira vermelha no que alguém escreveu, e o que ela tem
                       a oferecer nesse caso é o caminho que avisa o médico e o
                       contato de emergência com localização. */
                      onAbrirSOS={() => setEmergencyOpen(true)}
                    />
                  </Suspense>
                )}
                {tab === "Amigas" && <AmigasTab careMode={careMode} />}
                {/* Calendário e Consultas agora são uma tela só (unificada). */}
                {(tab === "Calendário" || tab === "Consultas") && (
                  <PrenatalCalendarTab
                    profile={profile}
                    gest={gest}
                    onNavigate={goToTab}
                    consultasSub={consultasSub}
                  />
                )}
                {tab === "Registros" && (
                  <RegistrosHub
                    profile={profile}
                    gest={gest}
                    careMode={careMode}
                    onNavigate={goToTab}
                    initialSub={consultasSub}
                  />
                )}
                {tab === "Saúde" && (
                  <div className="space-y-5">
                    <CabecalhoDaSaude chave="Saúde" />
                    <HealthTab gest={gest} profile={profile} onNavigate={goToTab} />
                  </div>
                )}
                {tab === "Nutrição" && (
                  <div className="space-y-5">
                    <CabecalhoDaSaude chave="Nutrição" />
                    <NutricaoTab profile={profile} gest={gest} careMode={careMode} />
                  </div>
                )}
                {tab === "Bem-estar" && (
                  <BemEstarHub gest={gest} onNavigate={goToTab} careMode={careMode} />
                )}
                {tab === "Alertas" && <AlertsTab weeks={gest?.weeks ?? null} />}
                {tab === "Acompanhante" && (
                  <div className="space-y-5">
                    <CabecalhoDaPorta chave="acompanhante" />
                    <CompanionTab babyName={profile?.baby_name ?? null} />
                  </div>
                )}
                {tab === "FAQ" && <FAQTab gest={gest} onNavigate={goToTab} />}
                {tab === "Carteirinha" && (
                  <CardTab profile={profile} gest={gest} onNavigate={goToTab} medico={meuMedico} />
                )}
                {tab === "Pós-parto" && (
                  <PosPartoTab profile={profile} onNavigate={goToTab} careMode={careMode} />
                )}
                {tab === "Recompensas" && (
                  <RecompensasHub
                    careMode={careMode}
                    gest={gest}
                    onNavigate={goToTab}
                    skyTheme={profile?.sky_theme === "v1" ? "v1" : "v2"}
                    onSkyChange={(t) => setProfile((p) => (p ? { ...p, sky_theme: t } : p))}
                    initialSub={consultasSub}
                  />
                )}
                {/* A loja de PRODUTOS (dinheiro), longe da de enfeites
                    (Sementinhas) — ver o cabeçalho de `RECOMPENSAS_SUBTABS`. */}
                {tab === "Loja" && <LojaTab gest={gest} careMode={careMode} onNavigate={goToTab} />}
                {tab === "Assinatura" && <AssinaturaTab onNavigate={goToTab} />}
                {tab === "Saúde da mulher" && (
                  <div className="space-y-5">
                    <CabecalhoDaSaude chave="Saúde da mulher" />
                    <SaudeMulherHub />
                  </div>
                )}
                {tab === "Médico" && <MédicoTab />}
                {tab === "Chat IA" && (
                  <ChatTab
                    profile={profile}
                    gest={gest}
                    careMode={careMode}
                    onVoltar={voltarDaBarra}
                  />
                )}
                {tab === "Perfil" && (
                  <ProfileTab
                    profile={profile}
                    onSaved={setProfile}
                    careMode={careMode}
                    onToggleCare={toggleCareMode}
                    onNavigate={goToTab}
                    ehMedico={isDoctor}
                  />
                )}
              </TabErrorBoundary>
            </div>
          </div>
        </section>
      </PullToRefresh>
    </>
  );
}

/* ---------- Marco de nova semana (comemoração) ---------- */

/**
 * Modal celebrativo quando a gestação avança de semana. Confete dispara ao
 * montar (visual); som + vibração vão no clique do botão (política de autoplay
 * e Vibration API exigem gesto do usuário). Nunca é aberto em Modo Cuidado —
 * quem decide isso é o gatilho, não este componente.
 */
function WeekMilestoneModal({
  week,
  babyName,
  motherName,
  tone,
  careMode,
  onClose,
  aoPublicarNaComunidade,
}: {
  /**
   * ⚠️ `careMode` entrou como PROP, e não por confiar em quem abre.
   *
   * A regra do `celebrate.ts` sempre foi "quem chama decide", e a revisão
   * adversarial achou o preço disso: chamadores que não decidiam. Aqui a festa
   * dispara no FECHAR do modal, longe de onde ele é aberto — e "está gateado lá
   * atrás" é o tipo de garantia que sobrevive até alguém mover o `setState`.
   */
  careMode: boolean;
  week: number;
  babyName: string | null;
  motherName: string;
  tone: number;
  onClose: () => void;
  /** Leva o cartão ao compositor da Comunidade. */
  aoPublicarNaComunidade?: (m: Momento) => void;
}) {
  const baby = babyForWeek(week);
  const [sound, setSound] = useState(false);
  const audioRef = useRef<ReturnType<typeof createBreathAudio> | null>(null);

  useEffect(() => {
    /**
     * ⚠️ O SOM ESTAVA NO MOMENTO ERRADO — e a inversão saltava aos olhos.
     *
     * O confete estourava AQUI, na abertura, e o chime só tocava quando ela
     * FECHAVA o modal. Ou seja: o clímax visual acontecia em silêncio, e a nota
     * chegava no gesto de sair. Agora os dois estão no mesmo instante.
     *
     * O `handleClose` continua com háptico — sair merece um toque, não uma
     * festa.
     */
    fireConfetti();
    celebrateChime(2, careMode);
    return () => {
      audioRef.current?.stop();
    };
  }, [careMode]);

  function toggleSound() {
    if (sound) {
      audioRef.current?.stop();
      audioRef.current = null;
      setSound(false);
    } else {
      audioRef.current = createBreathAudio();
      audioRef.current.start();
      setSound(true);
    }
  }

  function handleClose() {
    audioRef.current?.stop();
    /* ⚠️ A festa agora acontece na ABERTURA — ver o efeito acima. Aqui fica só
       o háptico: sair merece um toque, não um arpejo. */
    celebrateHaptic();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center overflow-y-auto bg-[image:var(--gradient-warm)] p-6 text-center">
      {/* brilhos ambiente */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl"
      />

      {/* botão de som (canto) */}
      <button
        onClick={toggleSound}
        aria-label={sound ? "Desligar som" : "Ligar som ambiente"}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 text-lg backdrop-blur"
      >
        {sound ? "🔊" : "🔈"}
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex max-w-sm flex-col items-center"
      >
        <p className="font-serif text-[15px] font-semibold text-primary">
          {motherName ? `${motherName}, chegou um novo marco` : "Chegou um novo marco"}
        </p>

        <div className="float-slow mt-6">
          <BabyIllustration
            week={week}
            tone={tone}
            showInfo={false}
            className="h-52 w-52 drop-shadow-[0_18px_44px_rgba(168,90,68,0.22)] md:h-64 md:w-64"
          />
        </div>

        <h2 className="mt-6 font-serif leading-none">
          <span className="text-6xl">{week}</span>
          <span className="ml-2 text-2xl text-muted-foreground">semanas</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-foreground">
          {babyName ? `${babyName} agora` : "Seu bebê agora"} tem o tamanho de{" "}
          <span className="font-semibold">{baby.fruit.toLowerCase()}</span>. {baby.desc}
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3">
          {/* ⚠️ **UM CARTÃO SÓ, e ele passa por `momentoDe`.** Este botão
              chamava `shareMilestoneCard` direto — um caminho de imagem que não
              conhecia a Comunidade nem o convite, e que não passava pelo portão
              de Modo Cuidado da régua (aqui isso não mordia, porque o marco não
              abre no luto, mas era a segunda régua de sempre). O desenho é o
              MESMO: chapéu, fruta, número gigante, unidade e a frase do
              tamanho. O que ele ganha é a segunda saída — publicar na
              Comunidade — que é o pedido do dono ("compartilhar ali na
              comunidade, compartilhar ali o nosso Instagram"). */}
          <CompartilharMomento
            momento={momentoDe({
              especie: "semana",
              numero: week,
              rotulo: `${babyName || "Meu bebê"} do tamanho de ${baby.fruit.toLocaleLowerCase("pt-BR")}`,
              emoji: fruitEmojiForWeek(week),
              emCuidado: false,
            })}
            nomeDaMae={motherName}
            aoPublicarNaComunidade={aoPublicarNaComunidade}
          />
          <button
            onClick={handleClose}
            className="press rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            Que alegria! 💛
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Bebê ---------- */
/**
 * A peça 3D de cada quadrado das três grades — `GradeHub` a desenha no lugar
 * do traço no círculo. Chutes e Contrações REUSAM a arte da Saúde: são o mesmo
 * destino (o hub da Saúde abre `Registros` já na sub-tela certa), e duas artes
 * para a mesma coisa ensinariam que são coisas diferentes.
 *
 * ⚠️ MORA ANTES DA PRIMEIRA GRADE que o lê. `const` de módulo não é içado:
 * declarado depois de `BEMESTAR_SUBTABS`, o módulo inteiro estourava no SSR
 * ("antes de inicializar") e TODA página do app respondia 500 — medido.
 */
const ARTE_GRADE = {
  agenda: arteGrade_agenda,
  preparo: arteGrade_preparo,
  perguntas: arteGrade_perguntas,
  checklist: arteGrade_checklist,
  parto: arteGrade_parto,
  tele: arteGrade_tele,
  particular: arteGrade_particular,
  meditacoes: arteGrade_meditacoes,
  sons: arteGrade_sons,
  exercicios: arteGrade_exercicios,
  humor: arteGrade_humor,
  apoio: arteGrade_apoio,
  diario: arteGrade_diario,
  timeline: arteGrade_timeline,
  chutes: icChutes,
  contracoes: icContracoes,
} as const;

/**
 * Hub "Bem-estar": autocuidado numa tela só (sub-abas) — Meditações, Sons,
 * Exercícios, Humor e Apoio Emocional. Antes eram 5 abas.
 */
export const BEMESTAR_SUBTABS = [
  {
    key: "meditacoes",
    label: "Meditações",
    sub: "Meditar com voz e som",
    Icon: Flower2,
    imagem: ARTE_GRADE.meditacoes,
    caixa: "border-violet-200/70 from-violet-50 to-fuchsia-50/60",
    tinta: "text-violet-600",
  },
  {
    key: "sons",
    label: "Sons",
    sub: "Relaxar e dormir",
    Icon: AudioLines,
    imagem: ARTE_GRADE.sons,
    caixa: "border-sky-200/70 from-sky-50 to-blue-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "exercicios",
    label: "Exercícios",
    sub: "Movimentos leves",
    Icon: PersonStanding,
    imagem: ARTE_GRADE.exercicios,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
  },
  {
    key: "humor",
    label: "Humor",
    sub: "Como você está hoje",
    Icon: Smile,
    imagem: ARTE_GRADE.humor,
    caixa: "border-amber-200/70 from-amber-50 to-yellow-50/60",
    tinta: "text-amber-600",
  },
  {
    key: "apoio",
    label: "Apoio emocional",
    sub: "Quando o peso é grande",
    Icon: HeartHandshake,
    imagem: ARTE_GRADE.apoio,
    caixa: "border-rose-200/70 from-rose-50 to-pink-50/60",
    tinta: "text-rose-600",
  },
] as const;

function BemEstarHub({
  gest,
  onNavigate,
  careMode = false,
}: {
  gest: Gest;
  onNavigate: (tab: string) => void;
  careMode?: boolean;
}) {
  const [sub, setSub] = useState<(typeof BEMESTAR_SUBTABS)[number]["key"] | null>(null);
  /**
   * ⚠️ AS MEDITAÇÕES SAEM DA GRADE NO MODO CUIDADO.
   *
   * Seis dos sete roteiros desta aba citam o bebê ou o parto — e ela os manda
   * para o `speechSynthesis`, ou seja o aparelho **lê em voz alta**: "Seu bebê
   * já te ouve", "pense no nome que você escolheu", "Você é muito esperado".
   * Filtrar por conteúdo deixaria uma meditação só; isso não é filtrar, é
   * fechar a porta — então ela fecha de verdade.
   *
   * ⚠️ E ela NÃO fica sem meditação: a do Caminho tem tratamento próprio de
   * luto (roteiro limpo, cor da música que não desce, portão em
   * `humorDaJornada`) e continua ali. É a mesma decisão de `portasDaComunidade`
   * tirar "Nome do bebê" e manter Amigas — o que sai é o que fala no presente
   * sobre um bebê que vai nascer.
   */
  const itens = careMode
    ? BEMESTAR_SUBTABS.filter((x) => x.key !== "meditacoes")
    : BEMESTAR_SUBTABS;
  const atual = itens.find((s) => s.key === sub);
  if (!sub || !atual) {
    return (
      <GradeHub
        itens={itens}
        onAbrir={(k) => setSub(k as (typeof BEMESTAR_SUBTABS)[number]["key"])}
      />
    );
  }
  return (
    <div className="space-y-5">
      <VoltarDaGrade rotulo={atual.label} ladrilho={atual} onVoltar={() => setSub(null)} />
      <Fade key={sub}>
        {sub === "meditacoes" && <MeditacoesTab gest={gest} careMode={careMode} />}
        {sub === "sons" && <SonsBebêTab gest={gest} careMode={careMode} onNavigate={onNavigate} />}
        {sub === "exercicios" && <ExerciciosTab gest={gest} />}
        {sub === "humor" && <HumorTab />}
        {sub === "apoio" && <ApoioEmocionalTab onNavigate={onNavigate} />}
      </Fade>
    </div>
  );
}

/**
 * Hub "Registros": tudo que a paciente registra numa tela só (sub-abas) —
 * Diário, Chutes, Contrações e Linha do Tempo. Antes eram 4 abas.
 */
export const REGISTROS_SUBTABS = [
  {
    key: "diario",
    label: "Diário",
    sub: "Escrever sobre o dia",
    Icon: NotebookPen,
    imagem: ARTE_GRADE.diario,
    caixa: "border-amber-200/70 from-amber-50 to-orange-50/60",
    tinta: "text-amber-600",
  },
  {
    /* ⚠️ Chutes e Contrações têm a MESMA família (cor e arte) que no hub da
       Saúde: são o mesmo destino por duas portas, e quem toca no bloco azul
       de Chutes na Saúde tem de chegar numa tela azul — não numa rosa. */
    key: "chutes",
    label: "Chutes",
    sub: "Contar os movimentos",
    Icon: Footprints,
    imagem: ARTE_GRADE.chutes,
    caixa: "border-sky-200/70 from-sky-50 to-cyan-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "contracoes",
    label: "Contrações",
    sub: "Cronometrar e ver o padrão",
    Icon: Timer,
    imagem: ARTE_GRADE.contracoes,
    caixa: "border-orange-200/70 from-orange-50 to-amber-50/60",
    tinta: "text-orange-600",
  },
  {
    key: "timeline",
    label: "Linha do tempo",
    sub: "Tudo que já aconteceu",
    Icon: History,
    imagem: ARTE_GRADE.timeline,
    caixa: "border-sky-200/70 from-sky-50 to-cyan-50/60",
    tinta: "text-sky-600",
  },
] as const;

type SubDeRegistros = (typeof REGISTROS_SUBTABS)[number]["key"];

function RegistrosHub({
  profile,
  gest,
  careMode = false,
  onNavigate,
  initialSub = null,
}: {
  profile: Profile | null;
  gest: Gest;
  careMode?: boolean;
  onNavigate?: (t: Tab) => void;
  /**
   * Sub-tela para abrir direto, como em `ConsultasHub` e `BebeHub`.
   *
   * É o que faz os ladrilhos "Chutes" e "Contrações" da aba Saúde caírem na
   * tela certa. Valor desconhecido é ignorado em silêncio (cai na grade), e
   * não é preguiça: `initialSub` vem do mesmo estado que a navegação inteira
   * usa, então um dia ele vai chegar aqui com a sub-tela de OUTRA aba.
   */
  initialSub?: string | null;
}) {
  const [sub, setSub] = useState<SubDeRegistros | null>(
    () => REGISTROS_SUBTABS.find((s) => s.key === initialSub)?.key ?? null,
  );
  /* ⚠️ O valor inicial de `useState` só vale na MONTAGEM. Voltando ao hub da
     Saúde e tocando no outro atalho, a aba continua sendo "Registros" — o
     componente não remonta, e a paciente que pediu Contrações caía em Chutes,
     a sub-tela da vez anterior. O efeito é o que faz o segundo pedido valer. */
  useEffect(() => {
    const pedida = REGISTROS_SUBTABS.find((s) => s.key === initialSub)?.key;
    if (pedida) setSub(pedida);
  }, [initialSub]);
  const atual = REGISTROS_SUBTABS.find((s) => s.key === sub);
  if (!sub || !atual) {
    return (
      <GradeHub
        itens={REGISTROS_SUBTABS}
        onAbrir={(k) => setSub(k as (typeof REGISTROS_SUBTABS)[number]["key"])}
      />
    );
  }
  return (
    <div className="space-y-5">
      <VoltarDaGrade rotulo={atual.label} ladrilho={atual} onVoltar={() => setSub(null)} />
      <Fade key={sub}>
        {sub === "diario" && <JournalTab profile={profile} gest={gest} />}
        {sub === "chutes" && (
          <KicksTab
            weeks={gest?.weeks ?? null}
            babyName={profile?.baby_name ?? null}
            careMode={careMode}
            onNavigate={onNavigate}
          />
        )}
        {sub === "contracoes" && <ContracoesTab weeks={gest?.weeks ?? null} />}
        {sub === "timeline" && <TimelineTab profile={profile} gest={gest} />}
      </Fade>
    </div>
  );
}

/**
 * Hub "Bebê": junta numa tela só (com sub-abas) tudo que é sobre o bebê —
 * a semana, a contagem regressiva, o álbum, os nomes, a carta e o enxoval.
 * Antes eram 6 abas separadas; agora é 1 (menos poluição visual).
 */
/** A peça 3D de cada quadrado da aba Bebê — `GradeHub` a desenha no lugar do Lucide. */
const ARTE_BEBE = {
  semana: arteBebe_semana,
  contagem: arteBebe_contagem,
  album: arteBebe_album,
  nome: arteBebe_nome,
  carta: arteBebe_carta,
  quartinho: arteBebe_quartinho,
} as const;

export const BEBE_SUBTABS = [
  {
    key: "semana",
    label: "Semana",
    sub: "O que mudou agora",
    Icon: Baby,
    imagem: ARTE_BEBE.semana,
    caixa: "border-pink-200/70 from-pink-50 to-rose-50/60",
    tinta: "text-pink-600",
  },
  {
    key: "contagem",
    label: "Contagem",
    sub: "Quanto falta",
    Icon: Timer,
    imagem: ARTE_BEBE.contagem,
    caixa: "border-violet-200/70 from-violet-50 to-fuchsia-50/60",
    tinta: "text-violet-600",
  },
  {
    key: "album",
    label: "Álbum",
    sub: "As fotos da barriga",
    Icon: Images,
    imagem: ARTE_BEBE.album,
    caixa: "border-sky-200/70 from-sky-50 to-blue-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "nome",
    label: "Nomes",
    sub: "Escolher e votar",
    Icon: Sparkles,
    imagem: ARTE_BEBE.nome,
    caixa: "border-amber-200/70 from-amber-50 to-yellow-50/60",
    tinta: "text-amber-600",
  },
  {
    key: "carta",
    label: "Carta",
    sub: "Escrever para o bebê",
    Icon: Mail,
    imagem: ARTE_BEBE.carta,
    caixa: "border-rose-200/70 from-rose-50 to-orange-50/60",
    tinta: "text-rose-600",
  },
  {
    key: "quartinho",
    label: "Enxoval",
    sub: "A lista do quartinho",
    Icon: ShoppingBag,
    imagem: ARTE_BEBE.quartinho,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
  },
] as const;

function BebeHub({
  profile,
  medico,
  gest,
  onNavigate,
  onBabyTap,
  careMode,
  proximaConsulta = null,
  initialSub = null,
}: {
  profile: Profile | null;
  /** Médico da paciente — repassado ao cartão de presença. */
  medico?: { nome: string; title?: string; specialty?: string } | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
  onBabyTap: () => void;
  careMode: boolean;
  /** A próxima consulta CONFIRMADA dela, já resolvida pela página. */
  proximaConsulta?: { dateLabel: string; typeLabel: string } | null;
  /* O toque no bebê da home promete "a semana detalhada" — então ele pede
     `semana` e cai direto lá, sem passar pela grade. Quem chega pela barra de
     baixo continua vendo a grade. */
  initialSub?: string | null;
}) {
  type SubBebe = (typeof BEBE_SUBTABS)[number]["key"];
  /**
   * ⚠️ **A GRADE NÃO CONHECIA O MODO CUIDADO.** `BEBE_SUBTABS` era usada crua:
   * no luto a paciente continuava vendo "Contagem" (a contagem regressiva para
   * o parto), "Nomes" (a votação do nome) e "Enxoval". O componente já RECEBIA
   * `careMode` e o repassava para dentro de duas sub-telas; o que faltava era a
   * própria grade olhar para ele — a mesma forma do portão do batimento no
   * painel do acompanhante.
   *
   * O Álbum FICA: as fotos são a memória do que houve, e escondê-las seria o
   * app apagar o bebê dela.
   */
  const visiveis = subtabsDoBebe(BEBE_SUBTABS, careMode);
  const [sub, setSub] = useState<SubBebe | null>(
    subtabPermitida(BEBE_SUBTABS, careMode, initialSub) as SubBebe | null,
  );
  useEffect(() => {
    /* ⚠️ Passa pela MESMA régua: `initialSub` vem de fora (o toque no bebê da
       home, o hub da Saúde), e sem o filtro um pedido de tela barrada abriria
       exatamente o que o luto acabou de tirar da grade — o portão pareceria
       funcionar e não funcionaria. */
    const ok = subtabPermitida(BEBE_SUBTABS, careMode, initialSub) as SubBebe | null;
    if (ok) setSub(ok);
  }, [initialSub, careMode]);
  const atual = visiveis.find((s) => s.key === sub);
  if (!sub || !atual) {
    return <GradeHub itens={visiveis} onAbrir={(k) => setSub(k as SubBebe)} />;
  }
  return (
    <div className="space-y-5">
      <VoltarDaGrade rotulo={atual.label} ladrilho={atual} onVoltar={() => setSub(null)} />
      <Fade key={sub}>
        {sub === "semana" && (
          <BabyTab
            profile={profile}
            medico={medico}
            gest={gest}
            onNavigate={onNavigate}
            onBabyTap={onBabyTap}
            careMode={careMode}
            proximaConsulta={proximaConsulta}
          />
        )}
        {sub === "contagem" && (
          <CountdownTab profile={profile} gest={gest} onNavigate={onNavigate} careMode={careMode} />
        )}
        {sub === "album" && <AlbumTab profile={profile} />}
        {sub === "nome" && <NomeTab profile={profile} />}
        {sub === "carta" && <CartaBebêTab profile={profile} gest={gest} onNavigate={onNavigate} />}
        {sub === "quartinho" && <QuartinhoTab gest={gest} />}
      </Fade>
    </div>
  );
}

/**
 * Resumo da semana — uma retrospectiva acolhedora que a paciente espera:
 * o humor da semana, o que está acontecendo com o bebê agora e o que vem na
 * próxima semana. Retenção: dá um motivo pra voltar. Lê o humor do próprio
 * diário (LGPD). Suprimido no Modo Cuidado por quem chama.
 */

/* ---------- Diário ---------- */

const JOURNAL_PROMPTS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Como estou me sentindo com esta gestação?",
    "O que mais me emociona nesse início?",
    "Quais são meus maiores medos agora?",
    "Uma mensagem para o meu bebê hoje.",
  ],
  2: [
    "Senti o bebê se mexer hoje?",
    "O que estou preparando para receber o bebê?",
    "Como está meu corpo nesta fase?",
    "Uma memória especial desta semana.",
  ],
  3: [
    "Estou pronta para o parto?",
    "Como está minha ansiedade agora?",
    "O que quero lembrar deste momento?",
    "Uma mensagem para o bebê antes de nascer.",
  ],
};

function JournalTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("😊");

  const trimester = gest ? trimesterForWeek(gest.weeks) : 1;
  const prompts = JOURNAL_PROMPTS[trimester];
  const firstName = profile?.display_name?.split(" ")[0];

  /* ⚠️ Falha de leitura NÃO é lista vazia — ver `NaoConsegueLer`. */
  const [instavel, setInstavel] = useState(false);

  async function load() {
    const { data, error } = await (supabase as any)
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });
    /* ⚠️ "Seu diário começará aqui" AFIRMA que ela nunca escreveu nada. Numa
       paciente em rastreio de depressão perinatal, ler que meses de registro
       sumiram não é frustração de interface. E repare na assimetria que estava
       aqui: `add()` e `remove()` já avisavam quando falhavam; só a LEITURA
       calava — e `add()` chama `load()` no fim, então ela salvava, o texto
       sumia do campo e nada aparecia na lista. */
    if (error || !data) {
      setInstavel(true);
      return;
    }
    setInstavel(false);
    setEntries(data);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!content.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("journal_entries").insert({
      user_id: u.user.id,
      content: content.trim(),
      mood,
      entry_date: new Date().toLocaleDateString("en-CA"),
    });
    if (error) {
      toast.error("Não foi possível salvar o registro. Tente novamente.");
      return;
    }
    setContent("");
    load();
    triggerAchievementsCheck();
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("journal_entries").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o registro. Tente novamente.");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">
          {firstName
            ? `${firstName}, como você está se sentindo hoje?`
            : "Como você está se sentindo hoje?"}
        </p>
        {gest && (
          <p className="mt-1 text-xs text-muted-foreground">
            Semana {gest.weeks} —{" "}
            {trimester === 1 ? "1º trimestre" : trimester === 2 ? "2º trimestre" : "3º trimestre"}
          </p>
        )}

        {/* Prompt suggestions — carrossel horizontal */}
        <div className="mt-3 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => setContent((c) => (c ? c + "\n" + p : p))}
              className="flex-shrink-0 rounded-2xl bg-primary/8 px-4 py-2.5 text-xs text-primary/90 transition-all duration-300 hover:bg-primary/12 active:scale-95"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {["😊", "🥰", "😴", "🤢", "😢", "😰"].map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`rounded-full px-3 py-2 text-xl transition-all duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-110 active:scale-95 ${
                mood === m ? "scale-110 bg-primary/15 ring-2 ring-primary" : "bg-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Escreva uma memória, um pensamento, um sonho…"
          className="mt-4 w-full rounded-md border border-input bg-background p-3 text-sm"
        />
        <button
          onClick={add}
          className="mt-3 rounded-full px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 active:scale-95 hover:opacity-90"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 80%, white), var(--primary) 70%)",
          }}
        >
          Salvar no diário
        </button>
      </div>

      <div className="space-y-3">
        {instavel ? (
          <NaoConsegueLer
            oQue="seu diário"
            sossego="O que você escreveu continua salvo."
            aoTentar={() => void load()}
          />
        ) : (
          entries.length === 0 && (
            <p className="text-sm text-muted-foreground">Seu diário começará aqui ✨</p>
          )
        )}
        {entries.map((e) => (
          <div key={e.id} className="rounded-2xl card-material p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {e.mood} · {new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
              <button
                onClick={() => remove(e.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                excluir
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{e.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Chutes ---------- */
function KicksTab({
  weeks,
  babyName,
  careMode = false,
  onNavigate,
}: {
  weeks: number | null;
  babyName: string | null;
  careMode?: boolean;
  onNavigate?: (t: Tab) => void;
}) {
  const [active, setActive] = useState<KickSession | null>(null);
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<KickSession[]>([]);
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  const label = babyName ?? "o bebê";
  const isMonitoringPhase = weeks != null && weeks >= 28;

  async function load() {
    const { data } = await (supabase as any)
      .from("kick_sessions")
      .select("*")
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(10);
    setHistory(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  async function start() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await (supabase as any)
      .from("kick_sessions")
      .insert({ user_id: u.user.id, kick_count: 0 })
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível iniciar a sessão. Tente novamente.");
      return;
    }
    setActive(data);
    setCount(0);
    startRef.current = Date.now();
    setElapsed(0);
  }

  async function tap() {
    if (!active) return;
    hapticKick(); // vínculo tátil: o bebê "chuta de volta"
    const next = count + 1;
    setCount(next);
    if (next >= 10) {
      await stop(next);
    }
  }

  async function stop(finalCount = count) {
    if (!active) return;
    const { error } = await (supabase as any)
      .from("kick_sessions")
      .update({ ended_at: new Date().toISOString(), kick_count: finalCount })
      .eq("id", active.id);
    if (error) {
      toast.error("Não foi possível salvar a sessão. Tente novamente.");
      return;
    }
    setActive(null);
    setCount(0);
    load();
    triggerAchievementsCheck();
  }

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  // Stats from history
  const completeSessions = history.filter((s) => s.kick_count >= 10);
  const avgMins =
    completeSessions.length > 0
      ? Math.round(
          completeSessions.reduce((acc, s) => {
            const dur = s.ended_at
              ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
              : 0;
            return acc + dur;
          }, 0) / completeSessions.length,
        )
      : null;

  /* Modo Cuidado: a aba inteira se cala. Ela oferecia "conte 10
     movimentos de {nome do bebê}" — o convite mais doloroso possível para
     quem acabou de perder a gestação. */
  /* Tela acesa durante a contagem. É a atividade mais longa do app — a
     paciente pode ficar até duas horas esperando o bebê se mexer, sem tocar no
     aparelho, e é justamente por não tocar que a tela apaga. */
  useEffect(() => {
    if (!active) return;
    return manterTelaAcesa();
  }, [active]);

  if (careMode) return <SilencioDoCuidado onNavigate={onNavigate} />;
  return (
    <div className="space-y-6">
      {/* Context banner */}
      {weeks != null && !isMonitoringPhase && (
        <div className="glass-card glass-violet rounded-2xl p-4 text-sm text-violet-800">
          <span className="mr-1.5">{weeks < 20 ? "🌱" : "🤗"}</span>
          {weeks < 20
            ? `Semana ${weeks} — os movimentos começam a ser sentidos entre as semanas 18 e 25. Continue o pré-natal normalmente.`
            : `Semana ${weeks} — você já pode perceber os movimentos de ${label}! A contagem formal de chutes começa na semana 28.`}
        </div>
      )}

      <div className="glass-card glass-violet rounded-3xl p-8 text-center">
        <p className="text-4xl mb-3">👶🦵</p>
        <p className="font-serif text-xl text-violet-700">Contador de chutes</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isMonitoringPhase
            ? `A partir da semana 28, conte 10 movimentos de ${label}. O ideal é sentir 10 em até 2 horas.`
            : "A contagem de movimentos é recomendada a partir da 28ª semana de gestação."}
        </p>
        {!active ? (
          <button
            onClick={start}
            className="mt-6 rounded-full px-8 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 active:scale-95 hover:opacity-90"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 80%, white), var(--primary) 70%)",
            }}
          >
            Iniciar sessão
          </button>
        ) : (
          <div className="mt-6">
            <button
              onClick={tap}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 78%, white), var(--primary) 70%)",
              }}
            >
              <div>
                <div key={count} className="pop-in font-serif text-5xl">
                  {count}
                </div>
                <div className="text-xs uppercase tracking-widest opacity-80">/ 10 chutes</div>
              </div>
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </p>
            <button
              onClick={() => stop()}
              className="mt-3 text-xs text-muted-foreground hover:text-destructive"
            >
              Encerrar sessão
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {history.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl card-material p-5 text-center">
            <p className="font-serif text-[15px] font-semibold text-primary">Sessões registradas</p>
            <p className="mt-2 font-serif text-3xl">{history.length}</p>
          </div>
          <div className="rounded-2xl card-material p-5 text-center">
            <p className="font-serif text-[15px] font-semibold text-primary">Sessões completas</p>
            <p className="mt-2 font-serif text-3xl">{completeSessions.length}</p>
          </div>
          <div className="rounded-2xl card-material p-5 text-center">
            <p className="font-serif text-[15px] font-semibold text-primary">
              Tempo médio (10 chutes)
            </p>
            <p className="mt-2 font-serif text-3xl">{avgMins != null ? `${avgMins} min` : "—"}</p>
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 font-serif text-[15px] font-semibold text-muted-foreground">Histórico</p>
        <div className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
          )}
          {history.map((s) => {
            const dur = s.ended_at
              ? Math.round(
                  (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
                )
              : 0;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm"
              >
                <span>
                  {new Date(s.started_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {s.kick_count >= 10 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      ✓ completo
                    </span>
                  )}
                  {s.kick_count} chutes · {dur} min
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Checklist ---------- */
const DEFAULT_ITEMS: { category: string; label: string }[] = [
  // Mamãe — documentos e identificação
  { category: "mae", label: "RG e CPF (originais)" },
  { category: "mae", label: "Cartão do convênio / SUS" },
  { category: "mae", label: "Carteira da gestante (pré-natal)" },
  { category: "mae", label: "Plano de parto impresso" },
  { category: "mae", label: "Exames recentes (ultrassom, sangue)" },
  // Mamãe — roupas e conforto
  { category: "mae", label: "2–3 camisolas com abertura frontal" },
  { category: "mae", label: "Roupão de algodão" },
  { category: "mae", label: "Chinelos fechados antiderrapantes" },
  { category: "mae", label: "Meias confortáveis (3 pares)" },
  { category: "mae", label: "Sutiã de amamentação (2 peças)" },
  { category: "mae", label: "Absorventes pós-parto (pacote)" },
  { category: "mae", label: "Calcinha descartável (pós-parto)" },
  // Mamãe — higiene e conforto
  { category: "mae", label: "Escova de dente e pasta" },
  { category: "mae", label: "Shampoo, sabonete e desodorante" },
  { category: "mae", label: "Creme para mamilos (lanolina)" },
  { category: "mae", label: "Protetor de seios (for breastfeeding)" },
  { category: "mae", label: "Travesseiro extra de amamentação" },
  { category: "mae", label: "Fones de ouvido + playlist relaxante" },
  { category: "mae", label: "Bolacha de água e sal / lanche leve" },
  // Bebê — roupas
  { category: "bebe", label: "5 bodies manga curta tamanho RN" },
  { category: "bebe", label: "5 macacões / mijões tamanho RN" },
  { category: "bebe", label: "2–3 mesinhas de algodão" },
  { category: "bebe", label: "2 toucas de RN" },
  { category: "bebe", label: "2 luvinhas para RN" },
  // Bebê — cuidados
  { category: "bebe", label: "Fraldas RN (1 pacote pequeno)" },
  { category: "bebe", label: "Lenços umedecidos sem perfume" },
  { category: "bebe", label: "Manta de algodão (2 peças)" },
  { category: "bebe", label: "Saída de maternidade (roupa especial)" },
  { category: "bebe", label: "Bebê conforto / cadeirinha de carro" },
  { category: "bebe", label: "Creme para assaduras" },
  // Acompanhante
  { category: "acompanhante", label: "2 trocas de roupa confortável" },
  { category: "acompanhante", label: "Itens de higiene pessoal" },
  { category: "acompanhante", label: "Lanches e snacks energéticos" },
  { category: "acompanhante", label: "Garrafa d'água" },
  { category: "acompanhante", label: "Carregador de celular + cabo" },
  { category: "acompanhante", label: "Cartão de crédito / dinheiro" },
  { category: "acompanhante", label: "Câmera ou celular com boa câmera" },
];

function ChecklistTab({ gest }: { gest: Gest }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("mae");

  const weeks = gest?.weeks ?? 0;
  const urgencyBanner =
    weeks >= 37
      ? { text: "Semana 37+ — Sua mala deve estar completamente pronta!", color: "rose" }
      : weeks >= 34
        ? { text: `Semana ${weeks} — É hora de preparar a mala da maternidade.`, color: "amber" }
        : weeks >= 30
          ? { text: `Semana ${weeks} — Comece a separar os itens aos poucos.`, color: "blue" }
          : null;

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await (supabase as any)
      .from("checklist_items")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar o checklist.");
      return;
    }
    // Semeia os itens padrão só uma vez por usuário — quem apagou tudo fica com
    // a lista vazia. A flag "já semeei" vive na CONTA (patient_profiles.
    // checklist_seeded), não no localStorage: assim um aparelho novo não
    // re-semeia itens que a paciente apagou de propósito. Degrada com elegância
    // se a coluna ainda não foi aplicada (trata como não-semeado).
    let alreadySeeded = false;
    try {
      const { data: prof } = await (supabase as any)
        .from("patient_profiles")
        .select("checklist_seeded")
        .eq("id", u.user.id)
        .maybeSingle();
      alreadySeeded = !!prof?.checklist_seeded;
    } catch {
      /* coluna ausente — segue como não-semeado */
    }
    async function markSeeded() {
      try {
        await (supabase as any)
          .from("patient_profiles")
          .update({ checklist_seeded: true })
          .eq("id", u.user!.id);
      } catch {
        /* coluna ausente — ignora */
      }
    }
    if ((!data || data.length === 0) && !alreadySeeded) {
      const seed = DEFAULT_ITEMS.map((d) => ({ ...d, user_id: u.user!.id, done: false }));
      const { error: seedError } = await (supabase as any).from("checklist_items").insert(seed);
      if (seedError) {
        toast.error("Não foi possível criar a lista inicial.");
        setItems([]);
        return;
      }
      await markSeeded();
      const { data: again } = await (supabase as any)
        .from("checklist_items")
        .select("*")
        .order("created_at", { ascending: true });
      setItems(again ?? []);
    } else {
      if (data && data.length > 0 && !alreadySeeded) {
        await markSeeded();
      }
      setItems(data ?? []);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(it: ChecklistItem) {
    const nextDone = !it.done;
    // Optimista: marca na hora; reverte se o servidor recusar.
    setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, done: nextDone } : x)));
    const { error } = await (supabase as any)
      .from("checklist_items")
      .update({ done: nextDone })
      .eq("id", it.id);
    if (error) {
      setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, done: it.done } : x)));
      toast.error("Não consegui salvar agora. Tente de novo.");
    }
  }
  async function add() {
    if (!label.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any)
      .from("checklist_items")
      .insert({ user_id: u.user.id, label: label.trim(), category });
    setLabel("");
    load();
  }
  async function remove(id: string) {
    // Optimista: some da lista na hora; restaura se falhar.
    const prev = items;
    setItems((arr) => arr.filter((x) => x.id !== id));
    const { error } = await (supabase as any).from("checklist_items").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("Não consegui remover agora. Tente de novo.");
    }
  }

  const groups = useMemo(() => {
    const g: Record<string, ChecklistItem[]> = { mae: [], bebe: [], acompanhante: [] };
    items.forEach((it) => {
      (g[it.category] = g[it.category] ?? []).push(it);
    });
    return g;
  }, [items]);

  const groupLabels: Record<string, string> = {
    mae: "Para a mamãe",
    bebe: "Para o bebê",
    acompanhante: "Para o acompanhante",
  };
  const total = items.length;
  const done = items.filter((i) => i.done).length;

  return (
    <div className="space-y-6">
      {urgencyBanner && (
        <div
          className={`rounded-2xl border p-4 text-sm font-medium ${
            urgencyBanner.color === "rose"
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : urgencyBanner.color === "amber"
                ? "border-primary/25 bg-primary/8 text-foreground"
                : "border-primary/25 bg-secondary/60 text-foreground"
          }`}
        >
          {urgencyBanner.text}
        </div>
      )}

      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-[15px] font-semibold text-primary">Mala da maternidade</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {done} de {total} itens prontos
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
        {done === total && total > 0 && (
          <p className="mt-2 text-sm font-medium text-emerald-600">Tudo pronto! 🎉</p>
        )}
      </div>

      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat} className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">{groupLabels[cat] ?? cat}</p>
          <ul className="mt-3 space-y-1">
            {list.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-secondary/60"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() => toggle(it)}
                    className="h-4 w-4"
                  />
                  <span className={it.done ? "text-muted-foreground line-through" : ""}>
                    {it.label}
                  </span>
                </label>
                <button
                  onClick={() => remove(it.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-3xl bg-card p-6">
        <p className="text-sm font-medium">Adicionar item</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="mae">Mamãe</option>
            <option value="bebe">Bebê</option>
            <option value="acompanhante">Acompanhante</option>
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: protetor de seios"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Modo Cuidado 🤍 ---------- */
function CareModeBanner({
  onExit,
  onNavigate,
}: {
  onExit: () => void;
  onNavigate: (t: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
      <p className="font-serif text-[15px] font-semibold text-slate-500">Modo Cuidado 🤍</p>
      <p className="mt-2 font-serif text-lg text-foreground">Estamos aqui com você.</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Pausamos as comemorações, contagens e a pontuação. Tudo o que você construiu está guardado —
        nada se perdeu. No seu tempo. 💛
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onNavigate("Bem-estar")}
          className="press rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
        >
          Apoio emocional
        </button>
        <button
          onClick={() => onNavigate("Médico")}
          className="press rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Falar com o consultório
        </button>
        <button
          onClick={onExit}
          className="press rounded-full px-4 py-2 text-sm font-medium text-slate-500 underline"
        >
          Sair do Modo Cuidado
        </button>
      </div>
    </div>
  );
}

function CareModeToggle({
  careMode,
  onToggle,
}: {
  careMode: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-card p-6">
      <p className="font-serif text-[15px] font-semibold text-slate-500">Modo Cuidado 🤍</p>
      {careMode ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            O Modo Cuidado está ativo. Comemorações, contagens e pontos estão pausados, e tudo o que
            você construiu segue guardado.
          </p>
          <button
            onClick={() => onToggle(false)}
            className="press mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Desativar quando estiver pronta
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Passando por um momento difícil — uma perda, uma complicação, ou só precisa de uma
            pausa? O Modo Cuidado silencia as comemorações, contagens e pontos, e mantém com carinho
            tudo o que você já construiu.
          </p>
          <button
            onClick={() => onToggle(true)}
            className="press mt-4 rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Ativar Modo Cuidado
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- Perfil ---------- */
/** Resumo da agenda dentro do Perfil: próxima consulta + avisos + atalhos. */
function ProfileAgendaCard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [appts, setAppts] = useState<MyAppointment[]>([]);
  /* ⚠️ "não consegui ler" NÃO é "você não tem consulta" — ver
     `fetchAppointmentsCached`. */
  const [instavel, setInstavel] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const r = await fetchAppointmentsCached();
      setAppts(r.appointments);
      setInstavel(r.instavel);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;
  const today = ymdLocal();
  const next = appts
    .filter((a) => a.status === "confirmed" && (a.confirmed_date ?? "") >= today)
    .sort((a, b) =>
      (a.confirmed_date! + (a.confirmed_time ?? "")).localeCompare(
        b.confirmed_date! + (b.confirmed_time ?? ""),
      ),
    )[0];
  const needsResponse = appts.some((a) => a.status === "counter_proposed");
  const pendingCount = appts.filter((a) => a.status === "pending").length;

  return (
    <div className="rounded-3xl card-material p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-serif text-lg">Minha agenda</p>
        <a href="/agendamento" className="press text-xs font-bold text-primary">
          Agendar +
        </a>
      </div>
      {needsResponse && (
        <button
          onClick={() => onNavigate("Consultas")}
          className="press mt-3 w-full rounded-2xl border-2 border-violet-300 bg-violet-50/70 p-3 text-left"
        >
          <span className="text-sm font-bold text-violet-700">
            🗓️ O médico sugeriu um horário — toque para responder
          </span>
        </button>
      )}
      {next ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Próxima consulta
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {formatApptDate(next.confirmed_date!)} · {next.confirmed_time}
          </p>
        </div>
      ) : (
        !needsResponse && (
          <p className="mt-3 text-sm text-muted-foreground">
            {pendingCount > 0
              ? `Você tem ${pendingCount} pedido(s) aguardando confirmação do médico.`
              : instavel
                ? "Não consegui carregar sua agenda agora — se você tem consulta marcada, ela continua marcada."
                : "Nenhuma consulta marcada ainda."}
          </p>
        )
      )}
      <button
        onClick={() => onNavigate("Consultas")}
        className="press mt-3 w-full rounded-full border border-border py-2 text-xs font-bold text-muted-foreground"
      >
        Abrir Consultas (agenda, fila de espera, gravações)
      </button>
    </div>
  );
}

function ProfileTab({
  profile,
  onSaved,
  careMode,
  onToggleCare,
  onNavigate,
  ehMedico = false,
}: {
  profile: Profile | null;
  onSaved: (p: Profile) => void;
  careMode: boolean;
  onToggleCare: (on: boolean) => void;
  onNavigate: (tab: string) => void;
  /** Muda o que a caixa de excluir conta oferece — ver `ExcluirConta`. */
  ehMedico?: boolean;
}) {
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    avatar_url: profile?.avatar_url ?? "",
    baby_name: profile?.baby_name ?? "",
    baby_skin_tone: profile?.baby_skin_tone ?? 0,
    lmp_date: profile?.lmp_date ?? "",
    reference_date: profile?.reference_date ?? "",
    reference_weeks: profile?.reference_weeks?.toString() ?? "",
    reference_days: profile?.reference_days?.toString() ?? "",
    blood_type: profile?.blood_type ?? "",
    allergies: profile?.allergies ?? "",
    home_city: profile?.home_city ?? "",
    home_lat: profile?.home_lat ?? null,
    home_lon: profile?.home_lon ?? null,
    phone: profile?.phone ?? "",
    emergency_contact: profile?.emergency_contact ?? "",
    emergency_email: profile?.emergency_email ?? "",
    emergency_phone: profile?.emergency_phone ?? "",
    height_cm: profile?.height_cm?.toString() ?? "",
    pre_pregnancy_weight_kg: profile?.pre_pregnancy_weight_kg?.toString() ?? "",
    medications: profile?.medications ?? "",
    birth_date: profile?.birth_date ?? "",
    pregnancy_number: profile?.pregnancy_number?.toString() ?? "1",
    prior_bp_elevated: profile?.prior_bp_elevated ?? false,
    prior_bp_week: profile?.prior_bp_week?.toString() ?? "",
    prior_gestational_diabetes: profile?.prior_gestational_diabetes ?? false,
    prior_preterm: profile?.prior_preterm ?? false,
    prior_cesarean: profile?.prior_cesarean ?? false,
    prior_notes: profile?.prior_notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /* O bloco de emergência muda de moldura por causa disto: vermelho quando
     falta, verde quando está pronto. */
  const faltaEmergencia = !form.emergency_email.trim() || !form.emergency_contact.trim();
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [corporateCode, setCorporateCode] = useState("");
  /* ⚠️ O DESFECHO É UM BOOLEANO, NUNCA O PRIMEIRO CARACTERE DO TEXTO.
     Isto era `corporateMsg.startsWith("✅")` decidindo a COR: o estado de
     sucesso morava dentro da frase que a paciente lê. Quem editasse o texto
     — tirar o emoji, começar por "Pronto!" — pintava de VERMELHO um vínculo
     que deu certo, sem erro nenhum e sem nada quebrado para apontar. */
  const [corporateMsg, setCorporateMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [joiningCorporate, setJoiningCorporate] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
    /* Já autorizou antes? Garante que o registro existe no banco — permissão
       concedida com banco vazio não entrega nada, e é um estado comum (trocar
       de aparelho, limpar dados, reinstalar o app).
       Passa por `renovarAvisosSeJaAutorizado` e não por `subscribeToPush` para
       cobrir também o app nativo, onde não existe `Notification.permission`
       nem chave VAPID: quem sabe da permissão ali é o sistema. */
    void renovarAvisosSeJaAutorizado();
  }, []);

  // Completion percentage
  const completionFields = [
    form.display_name,
    form.lmp_date || form.reference_date,
    form.blood_type,
    form.phone,
    form.emergency_contact,
    form.emergency_email,
    form.emergency_phone,
    form.height_cm,
    form.pre_pregnancy_weight_kg,
  ];
  const completed = completionFields.filter(Boolean).length;
  const completionPct = Math.round((completed / completionFields.length) * 100);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sua sessão expirou — entre novamente.");
        return;
      }
      const payload: any = {
        id: u.user.id,
        display_name: form.display_name || null,
        avatar_url: form.avatar_url || null,
        baby_name: form.baby_name || null,
        baby_skin_tone: form.baby_skin_tone,
        lmp_date: form.lmp_date || null,
        due_date: form.lmp_date ? dueDateFromLmp(form.lmp_date) : null,
        reference_date: form.reference_date || null,
        reference_weeks: form.reference_weeks ? Number(form.reference_weeks) : null,
        reference_days: form.reference_days ? Number(form.reference_days) : null,
        blood_type: form.blood_type || null,
        allergies: form.allergies || null,
        home_city: form.home_city || null,
        home_lat: form.home_lat,
        home_lon: form.home_lon,
        phone: form.phone || null,
        emergency_contact: form.emergency_contact || null,
        emergency_email: form.emergency_email || null,
        emergency_phone: form.emergency_phone || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        pre_pregnancy_weight_kg: form.pre_pregnancy_weight_kg
          ? Number(form.pre_pregnancy_weight_kg)
          : null,
        medications: form.medications || null,
        birth_date: form.birth_date || null,
        pregnancy_number: form.pregnancy_number ? Number(form.pregnancy_number) : 1,
        prior_bp_elevated: form.prior_bp_elevated,
        prior_bp_week: form.prior_bp_week ? Number(form.prior_bp_week) : null,
        prior_gestational_diabetes: form.prior_gestational_diabetes,
        prior_preterm: form.prior_preterm,
        prior_cesarean: form.prior_cesarean,
        prior_notes: form.prior_notes || null,
        updated_at: new Date().toISOString(),
      };
      let { data, error } = await (supabase as any)
        .from("patient_profiles")
        .upsert(payload)
        .select()
        .single();
      if (error && String(error.message || "").includes("baby_skin_tone")) {
        // Coluna do tom ainda não migrada no banco: salva o resto mesmo assim.
        delete payload.baby_skin_tone;
        ({ data, error } = await (supabase as any)
          .from("patient_profiles")
          .upsert(payload)
          .select()
          .single());
      }
      if (error) {
        setMsg(error.message);
      } else {
        onSaved(data);
        setMsg("Salvo com sucesso ✓");
        toast.success("Perfil salvo com sucesso!");
      }
    } finally {
      setSaving(false);
    }
  }

  // Foto da paciente: comprime pra ~256px (data URL leve) e guarda no form.
  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 256;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setForm((f) => ({ ...f, avatar_url: codificarFoto(canvas, 0.8) }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      {/* Convidar acompanhante — ação ocasional, vive aqui no Perfil */}
      <button
        onClick={() => onNavigate("Acompanhante")}
        className="flex w-full items-center gap-3 rounded-3xl border border-violet-200 bg-violet-50/50 px-4 py-3 text-left transition-colors hover:bg-violet-50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg ring-1 ring-violet-200">
          👥
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Acompanhante</p>
          <p className="text-xs text-muted-foreground">
            Convide seu par ou família pra acompanhar a gestação
          </p>
        </div>
        <span className="shrink-0 text-violet-400">›</span>
      </button>

      {/* Foto + nome da paciente */}
      <div className="flex items-center gap-4 rounded-3xl card-material p-5">
        <label className="press relative shrink-0 cursor-pointer">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-secondary ring-2 ring-primary/20">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Sua foto" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl">🙂</span>
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow">
            📷
          </span>
          <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        </label>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg">
            {form.display_name || "Sua foto e seus dados"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toque na foto para {form.avatar_url ? "trocar" : "adicionar"}. Não esqueça de{" "}
            <strong>salvar</strong> no fim.
          </p>
        </div>
      </div>

      {/* Minha agenda (próximas consultas) — junto do perfil */}
      <ProfileAgendaCard onNavigate={onNavigate} />

      {/* ─── A PESQUISA QUE O DONO NÃO TINHA COMO RECEBER ──────────────────
          `shouldAskNps` e `submitNps` estavam escritas, testadas e sem chamador
          nenhum: o relatório do admin ficava em ZERO para sempre.

          ⚠️ Ela mora AQUI, e nunca depois de uma conquista. A tentação óbvia é
          perguntar logo após um momento bonito porque a nota sobe — e é por
          isso que não se faz: NPS é instrumento de MEDIDA, e uma medida
          enviesada para cima é pior que medida nenhuma. O Perfil é uma tela
          calma que ela escolheu abrir.

          ⚠️ `careMode` indefinido CALA (ver `podeMostrarNps`). */}
      <PesquisaNps
        tokenFn={async () => (await supabase.auth.getSession()).data.session?.access_token ?? ""}
        /* ⚠️ `profile === null` É o "não sei", e é ele que precisa chegar como
           `undefined`: a prop `careMode` desta aba é `boolean` puro, então
           antes de o perfil carregar ela vale `false` — "não está de luto" —, e
           o portão de `podeMostrarNps` não protegeria nada. */
        careMode={profile ? careMode : undefined}
      />

      {/* Completion card */}
      <div className="glass-card glass-indigo rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-serif text-[15px] font-semibold text-indigo-600">
              💫 Perfil completo
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {completionPct < 100
                ? "Complete seu perfil para aproveitar todas as funcionalidades."
                : "Seu perfil está completo! 🎉"}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-indigo-200 text-sm font-bold text-indigo-600">
            {completionPct}%
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Suas informações</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Seu nome"
            value={form.display_name}
            onChange={(v) => setForm({ ...form, display_name: v })}
          />
          <Field
            label="Nome do bebê (opcional)"
            value={form.baby_name}
            onChange={(v) => setForm({ ...form, baby_name: v })}
          />
        </div>

        {/* Tom de pele do bebê nas ilustrações — toda família se vê no app */}
        <div className="mt-4">
          <p className="mb-2 block text-sm font-medium">Tom de pele do bebê nas ilustrações</p>
          <div className="flex flex-wrap items-center gap-3">
            {BABY_TONES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setForm({ ...form, baby_skin_tone: i })}
                title={t.label}
                aria-label={`Tom ${t.label}`}
                aria-pressed={form.baby_skin_tone === i}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${
                  form.baby_skin_tone === i
                    ? "scale-110 border-primary ring-2 ring-primary/30"
                    : "border-border hover:scale-105"
                }`}
                style={{ backgroundColor: t.swatch }}
              />
            ))}
            <div className="ml-1">
              <BabyIllustration
                week={30}
                tone={form.baby_skin_tone}
                showSac={false}
                showInfo={false}
                className="h-14 w-14"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {BABY_TONES[form.baby_skin_tone]?.label ?? "Claro"} — muda o bebê em todas as telas. Dá
            para trocar quando quiser.
          </p>
        </div>
      </div>

      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Idade gestacional</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use a DUM (data da última menstruação) <strong>ou</strong> os dados informados pelo médico
          no ultrassom.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="DUM — Data da última menstruação"
            type="date"
            value={form.lmp_date}
            onChange={(v) => setForm({ ...form, lmp_date: v })}
          />
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">— ou —</p>
          <p className="mt-1 text-sm">Idade gestacional informada pelo médico</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field
              label="Data da consulta/USG"
              type="date"
              value={form.reference_date}
              onChange={(v) => setForm({ ...form, reference_date: v })}
            />
            <Field
              label="Semanas"
              type="number"
              value={form.reference_weeks}
              onChange={(v) => setForm({ ...form, reference_weeks: v })}
            />
            <Field
              label="Dias"
              type="number"
              value={form.reference_days}
              onChange={(v) => setForm({ ...form, reference_days: v })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Dados clínicos & emergência</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Tipo sanguíneo (ex: O+)"
            value={form.blood_type}
            onChange={(v) => setForm({ ...form, blood_type: v })}
          />
          <Field
            label="Alergias"
            value={form.allergies}
            onChange={(v) => setForm({ ...form, allergies: v })}
          />
          <Field
            label="Medicamentos em uso"
            value={form.medications}
            onChange={(v) => setForm({ ...form, medications: v })}
            placeholder="Ex: sulfato ferroso, ácido fólico…"
          />
          <CampoCidade
            cidade={form.home_city}
            onEscolher={(c) =>
              setForm({ ...form, home_city: c.nome, home_lat: c.lat, home_lon: c.lon })
            }
            onLimpar={() => setForm({ ...form, home_city: "", home_lat: null, home_lon: null })}
          />
        </div>

        {/* ── Quem o SOS avisa ───────────────────────────────────────────
            Este bloco saiu do meio dos "dados clínicos" e virou uma caixa
            própria, com moldura vermelha enquanto estiver incompleto.

            A razão do destaque: é o único campo do perfil cuja falta só
            aparece na hora em que já é tarde. Tipo sanguíneo em branco se
            resolve na consulta; contato de emergência em branco se descobre
            com ela apertando o SOS e ninguém sendo avisado. */}
        <div
          className={`mt-5 rounded-2xl border p-4 ${
            faltaEmergencia
              ? "border-rose-300 bg-rose-50/70 dark:bg-rose-500/10"
              : "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-500/10"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-lg leading-none">{faltaEmergencia ? "🆘" : "✅"}</span>
            <div className="min-w-0">
              <p
                className={`text-sm font-bold ${
                  faltaEmergencia
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {faltaEmergencia
                  ? "Quem o SOS vai avisar por você"
                  : "Seu contato de emergência está pronto"}
              </p>
              <p className="mt-1 text-xs leading-snug text-foreground/75">
                No segundo em que você apertar o SOS, esta pessoa recebe a sua localização e a sua
                ficha — tipo sanguíneo, alergias, medicamentos — sem você precisar escrever nada.
                {faltaEmergencia ? " Sem o e-mail, esse aviso não sai." : ""}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field
                label="Seu telefone (WhatsApp)"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="(31) 98888-1111"
              />
              {/* Vai no aviso do SOS. É o primeiro número que quem recebe o
                  socorro tenta — antes de sair de casa, antes de ligar para o
                  hospital, a pessoa liga para ela para saber se atende. */}
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                Quem receber o pedido de socorro liga para cá primeiro.
              </p>
            </div>
            <Field
              label="Nome do contato de emergência"
              value={form.emergency_contact}
              onChange={(v) => setForm({ ...form, emergency_contact: v })}
              placeholder="Ex: Marcos (marido)"
            />
            <Field
              label="Telefone (WhatsApp)"
              value={form.emergency_phone}
              onChange={(v) => setForm({ ...form, emergency_phone: v })}
              placeholder="(31) 98888-7777"
            />
            <div className="md:col-span-2">
              <Field
                label="E-mail do contato de emergência"
                type="email"
                value={form.emergency_email}
                onChange={(v) => setForm({ ...form, emergency_email: v })}
                placeholder="marcos@email.com"
              />
              {/* É o único canal que o app dispara SOZINHO até alguém de fora.
                  O WhatsApp abre com a mensagem escrita, mas ainda depende de
                  ela conseguir apertar enviar — e quem aperta o SOS nem sempre
                  consegue. */}
              <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                É o único aviso que sai sozinho, mesmo que você não consiga mexer no celular depois.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Pós-parto</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha após o nascimento do bebê para ativar o Portal Pós-parto.
        </p>
        <div className="mt-4">
          <Field
            label="Data de nascimento do bebê"
            type="date"
            value={form.birth_date}
            onChange={(v) => setForm({ ...form, birth_date: v })}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Deixe em branco enquanto a gestação está em curso — preencha só quando o bebê nascer.
          </p>
        </div>
      </div>

      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Dados corporais</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Usados para calcular seu IMC pré-gestacional e a curva de ganho de peso recomendada (IOM
          2009).
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Altura (cm)"
            type="number"
            value={form.height_cm}
            onChange={(v) => setForm({ ...form, height_cm: v })}
          />
          <Field
            label="Peso pré-gestacional (kg)"
            type="number"
            value={form.pre_pregnancy_weight_kg}
            onChange={(v) => setForm({ ...form, pre_pregnancy_weight_kg: v })}
          />
        </div>
      </div>

      {/* Feature 19: Second pregnancy */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Histórico gestacional</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Se esta é sua segunda gestação (ou mais), registre as complicações anteriores para
          monitoramento personalizado.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Nº desta gestação</label>
            <select
              value={form.pregnancy_number}
              onChange={(e) => setForm({ ...form, pregnancy_number: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="1">1ª gestação</option>
              <option value="2">2ª gestação</option>
              <option value="3">3ª gestação</option>
              <option value="4">4ª gestação ou mais</option>
            </select>
          </div>
        </div>
        {Number(form.pregnancy_number) >= 2 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Complicações na gestação anterior:
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_bp_elevated}
                onChange={(e) => setForm({ ...form, prior_bp_elevated: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Pressão arterial elevada / pré-eclâmpsia</span>
            </label>
            {form.prior_bp_elevated && (
              <div className="ml-7">
                <Field
                  label="A partir de qual semana?"
                  type="number"
                  value={form.prior_bp_week}
                  onChange={(v) => setForm({ ...form, prior_bp_week: v })}
                  placeholder="Ex: 32"
                />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_gestational_diabetes}
                onChange={(e) => setForm({ ...form, prior_gestational_diabetes: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Diabetes gestacional</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_preterm}
                onChange={(e) => setForm({ ...form, prior_preterm: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Parto prematuro (antes de 37 semanas)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_cesarean}
                onChange={(e) => setForm({ ...form, prior_cesarean: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Cesárea anterior</span>
            </label>
            <div>
              <label className="block text-sm font-medium mb-1">
                Outras observações (opcional)
              </label>
              <textarea
                value={form.prior_notes}
                onChange={(e) => setForm({ ...form, prior_notes: e.target.value })}
                rows={2}
                placeholder="Ex: bebê GIG, internação por DPP…"
                className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Feature 17: Push notifications */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Dicas semanais</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Receba uma dica personalizada baseada na sua semana gestacional toda segunda-feira.
        </p>
        <div className="mt-4">
          {notifPermission === "granted" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 p-4">
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="text-sm font-medium text-green-700">Notificações ativas</p>
                  <p className="text-xs text-green-600">
                    Você receberá dicas semanais personalizadas.
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const { data: s } = await supabase.auth.getSession();
                  if (!s.session?.access_token) return;
                  const res = await sendTestPushToMe({
                    data: { accessToken: s.session.access_token },
                  });
                  if (res.ok) toast.success("Enviei uma notificação de teste 🔔");
                  else if (res.reason === "not-configured")
                    toast("As notificações ainda estão sendo configuradas. Já já ficam ativas 💛");
                  else if (res.reason === "no-subscription")
                    toast("Reative os lembretes neste aparelho para receber o teste.");
                  else toast("Não consegui enviar o teste agora.");
                }}
                className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                Enviar notificação de teste
              </button>
            </div>
          ) : notifPermission === "denied" ? (
            <div className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
              Notificações bloqueadas neste navegador. Para ativar, vá nas configurações do
              navegador e permita notificações para este site.
            </div>
          ) : (
            <button
              onClick={async () => {
                /* Sem o `Notification in window` como porteiro: dentro da
                   casca nativa quem entrega é o sistema, e essa API pode nem
                   existir. `ativarAvisos` escolhe o caminho. */
                const res = await ativarAvisos();
                if (res.ok) {
                  setNotifPermission("granted");
                  toast.success("Lembretes ativados 🔔");
                } else if (res.reason === "denied") {
                  setNotifPermission("denied");
                } else if (res.reason === "ios-not-installed") {
                  toast(
                    "No iPhone, adicione o app à Tela de Início primeiro (botão Compartilhar → Adicionar à Tela de Início) para receber lembretes.",
                  );
                } else if (res.reason === "no-key") {
                  // Chaves de push ainda não configuradas no ambiente: mantém o
                  // comportamento antigo (só pede permissão) para não regredir.
                  const perm = await Notification.requestPermission();
                  setNotifPermission(perm);
                  if (perm === "granted" && "serviceWorker" in navigator) {
                    navigator.serviceWorker.register("/sw.js").catch(() => {});
                  }
                } else {
                  toast("Não consegui ativar os lembretes agora. Tente novamente.");
                }
              }}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white"
            >
              🔔 Ativar dicas semanais
            </button>
          )}
        </div>
      </div>

      {/* Feature 50: Corporate */}
      {/* Excluir a conta. Fica no fim do Perfil de propósito: é o último item,
          depois de tudo que a paciente pode QUERER mexer. Ver
          `src/components/excluir-conta.tsx`. */}
      {/* ─── APAGAR SÓ AS CONVERSAS ────────────────────────────────────────
          Vem ANTES de excluir a conta, e é isso que faz sentido: apagar o que
          ela escreveu para a IA não pode custar a gestação inteira.
          Passamos a avisá-la de que o médico lê essas conversas. Um aviso sem
          um botão é uma armadilha educada — informa a pessoa de algo que ela
          não pode mudar. */}
      <ApagarConversas />

      {/* ⚠️ ANTES da caixa de excluir, de propósito: muita gente que chega
          aqui quer o DADO, não o fim da conta. Oferecer a saída não-destrutiva
          primeiro é o que evita uma exclusão que ela não queria — e até agora
          este lugar só tinha a destrutiva. */}
      <ExportarDados ehMedico={ehMedico} />
      <ExcluirConta ehMedico={ehMedico} />

      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Benefício Corporativo</p>
        {profile?.corporate_account_id ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary/5 border border-primary/20 p-4">
            <span className="text-2xl">🏢</span>
            <div>
              <p className="text-sm font-medium text-primary">Acesso corporativo ativo</p>
              <p className="text-xs text-muted-foreground">
                Seu plano é custeado pela sua empresa.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sua empresa oferece o portal como benefício? Insira o código fornecido pelo RH.
            </p>
            <div className="flex gap-2">
              <input
                value={corporateCode}
                onChange={(e) => setCorporateCode(e.target.value.toUpperCase())}
                placeholder="Código da empresa (ex: ABC123)"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-mono uppercase tracking-wider"
                maxLength={12}
              />
              <button
                onClick={async () => {
                  if (!corporateCode.trim()) return;
                  setJoiningCorporate(true);
                  setCorporateMsg(null);
                  const { data: s } = await supabase.auth.getSession();
                  if (!s.session?.access_token) {
                    setJoiningCorporate(false);
                    return;
                  }
                  const res = await joinCorporate({
                    data: { accessToken: s.session.access_token, accessCode: corporateCode.trim() },
                  });
                  if (res.ok) {
                    setCorporateMsg({
                      ok: true,
                      texto: `Vinculado a ${res.companyName}. Salve o perfil para confirmar.`,
                    });
                    onSaved({
                      ...profile!,
                      corporate_account_id: "pending",
                    } as NonNullable<typeof profile>);
                  } else {
                    setCorporateMsg({ ok: false, texto: res.error ?? "Código inválido." });
                  }
                  setJoiningCorporate(false);
                }}
                disabled={joiningCorporate || !corporateCode.trim()}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {joiningCorporate ? "Aplicando…" : "Aplicar"}
              </button>
            </div>
            {corporateMsg && (
              <p className={`text-sm ${corporateMsg.ok ? "text-green-600" : "text-red-500"}`}>
                {corporateMsg.texto}
              </p>
            )}
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>

      {/* Último elemento do Perfil, depois de Salvar: o Modo Cuidado é para um
          momento difícil, não para o uso do dia a dia. No topo ele recebia a
          gestante com a hipótese de uma perda toda vez que ela vinha só trocar
          a foto; aqui embaixo continua fácil de achar para quem precisa. */}
      <CareModeToggle careMode={careMode} onToggle={onToggleCare} />
    </div>
  );
}

/**
 * Onde a paciente mora — o degrau do meio da cadeia de localização.
 *
 * A ordem é GPS → esta cidade → IP da borda → clínica. O IP acerta quase
 * sempre, mas erra em VPN, em viagem e quando a operadora roteia o tráfego
 * por outro estado; nesses casos é aqui que o app descobre a cidade certa.
 * O GPS continua ganhando quando existe, porque é o único que sabe onde ela
 * está AGORA — este campo diz onde ela MORA, que não é a mesma pergunta.
 *
 * A busca resolve as coordenadas UMA vez, ao escolher, e guarda junto do
 * nome. Sem isso, toda abertura do app pagaria uma geocodificação para
 * redescobrir a mesma cidade.
 *
 * Mostra estado e país na lista de propósito: "Santa Cruz" devolve quatro
 * resultados em quatro países, e "Belo Horizonte" existe em Angola também.
 */
function CampoCidade({
  cidade,
  onEscolher,
  onLimpar,
}: {
  cidade: string;
  onEscolher: (c: { nome: string; lat: number; lon: number }) => void;
  onLimpar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<
    { id: number; nome: string; lat: number; lon: number }[] | null
  >(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 3) {
      setItens(null);
      return;
    }
    // Espera a digitação parar: sem isto seria uma requisição por tecla.
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          "https://geocoding-api.open-meteo.com/v1/search?count=6&language=pt&format=json&name=" +
            encodeURIComponent(termo),
        );
        const j = (await r.json()) as {
          results?: {
            id: number;
            name: string;
            admin1?: string;
            country?: string;
            latitude: number;
            longitude: number;
          }[];
        };
        if (!vivo) return;
        setItens(
          (j.results ?? []).map((x) => ({
            id: x.id,
            nome: [x.name, x.admin1, x.country].filter(Boolean).join(", "),
            lat: x.latitude,
            lon: x.longitude,
          })),
        );
      } catch {
        if (vivo) setItens([]);
      } finally {
        if (vivo) setCarregando(false);
      }
    }, 450);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busca]);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">Onde você mora</label>
      {cidade ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
          <span className="min-w-0 truncate text-sm">📍 {cidade}</span>
          <button
            type="button"
            onClick={() => {
              onLimpar();
              setBusca("");
              setItens(null);
            }}
            className="press shrink-0 text-xs font-semibold text-muted-foreground underline"
          >
            trocar
          </button>
        </div>
      ) : (
        <>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite sua cidade…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {carregando && <p className="mt-1.5 text-xs text-muted-foreground">Procurando…</p>}
          {itens && itens.length === 0 && !carregando && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Nenhuma cidade encontrada com esse nome.
            </p>
          )}
          {itens && itens.length > 0 && (
            <ul className="mt-1.5 overflow-hidden rounded-xl border border-border">
              {itens.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onEscolher(c);
                      setBusca("");
                      setItens(null);
                    }}
                    className="press block w-full px-3 py-2 text-left text-sm hover:bg-secondary/60"
                  >
                    {c.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        Usada para o clima e o céu do app quando a localização do aparelho não está disponível.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

/* ---------- Saúde (peso + pressão) ---------- */
// IOM 2009 expected weight gain corridor at gestational week w, given pre-pregnancy BMI
function iomGain(week: number, bmi: number): { min: number; max: number } {
  let rMin: number, rMax: number;
  if (bmi < 18.5) {
    rMin = 0.44;
    rMax = 0.58;
  } else if (bmi < 25) {
    rMin = 0.35;
    rMax = 0.5;
  } else if (bmi < 30) {
    rMin = 0.23;
    rMax = 0.33;
  } else {
    rMin = 0.17;
    rMax = 0.27;
  }

  if (week <= 12) {
    const f = week / 12;
    return { min: f * 0.5, max: f * 2.0 };
  }
  return { min: 0.5 + (week - 12) * rMin, max: 2.0 + (week - 12) * rMax };
}

function HealthTab({
  gest,
  profile,
  onNavigate,
}: {
  gest: Gest;
  profile: Profile | null;
  onNavigate: (tab: string) => void;
}) {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [form, setForm] = useState({
    weight_kg: "",
    systolic: "",
    diastolic: "",
    glucose_mg_dl: "",
    spo2: "",
    heart_rate_bpm: "",
    steps: "",
    sleep_hours: "",
    notes: "",
  });
  /* `showWearable` saiu junto com o bloco que ele abria. Os campos do
     formulário (`form.spo2` e companhia) continuam no estado e no `payload`:
     o INSERT segue aceitando as colunas, e um registro antigo aberto para
     correção não perde os valores por passar por aqui. */

  async function load() {
    const { data } = await (supabase as any)
      .from("health_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .limit(60);
    setLogs(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (
      !form.weight_kg &&
      !form.systolic &&
      !form.diastolic &&
      !form.glucose_mg_dl &&
      !form.spo2 &&
      !form.heart_rate_bpm &&
      !form.steps &&
      !form.sleep_hours &&
      !form.notes
    ) {
      toast.error("Preencha ao menos um campo para registrar.");
      return;
    }
    /* VALIDAÇÃO ANTES DE GRAVAR — e agora o banco também recusa.

       Marcar o número impossível na LEITURA conserta a tela; não conserta o
       prontuário. E com os CHECKs aplicados, sem esta checagem aqui o insert
       volta erro e a paciente lê "Erro ao salvar. Tente novamente." — conselho
       errado, porque repetir o mesmo número falha para sempre. */
    const erroFaixa = validaRegistro({
      weight_kg: form.weight_kg,
      systolic: form.systolic,
      diastolic: form.diastolic,
      glucose_mg_dl: form.glucose_mg_dl,
      spo2: form.spo2,
      heart_rate_bpm: form.heart_rate_bpm,
      steps: form.steps,
      sleep_hours: form.sleep_hours,
    });
    if (erroFaixa) {
      toast.error(erroFaixa);
      return;
    }

    // Envia apenas os campos preenchidos (colunas extras podem não existir
    // no banco ainda sem as migrations pendentes) e a data local do navegador.
    const payload: Record<string, unknown> = {
      user_id: u.user.id,
      log_date: new Date().toLocaleDateString("en-CA"),
    };
    if (form.weight_kg !== "") payload.weight_kg = Number(String(form.weight_kg).replace(",", "."));
    if (form.systolic !== "") payload.systolic = Number(String(form.systolic).replace(",", "."));
    if (form.diastolic !== "") payload.diastolic = Number(String(form.diastolic).replace(",", "."));
    if (form.glucose_mg_dl !== "")
      payload.glucose_mg_dl = Number(String(form.glucose_mg_dl).replace(",", "."));
    if (form.spo2 !== "") payload.spo2 = Number(String(form.spo2).replace(",", "."));
    if (form.heart_rate_bpm !== "")
      payload.heart_rate_bpm = Number(String(form.heart_rate_bpm).replace(",", "."));
    if (form.steps !== "") payload.steps = Number(String(form.steps).replace(",", "."));
    if (form.sleep_hours !== "")
      payload.sleep_hours = Number(String(form.sleep_hours).replace(",", "."));
    if (form.notes) payload.notes = form.notes;
    const { error } = await (supabase as any).from("health_logs").insert(payload);
    if (error) {
      toast.error("Erro ao salvar o registro. Tente novamente.");
      return;
    }
    triggerAchievementsCheck();
    setForm({
      weight_kg: "",
      systolic: "",
      diastolic: "",
      glucose_mg_dl: "",
      spo2: "",
      heart_rate_bpm: "",
      steps: "",
      sleep_hours: "",
      notes: "",
    });
    load();
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("health_logs").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o registro. Tente novamente.");
      return;
    }
    load();
  }

  const last = logs[0];
  const allWeightLogs = logs.filter((l) => l.weight_kg != null).reverse();
  const weights = allWeightLogs.slice(-12);

  // Stats
  const firstWeight = allWeightLogs[0]?.weight_kg ? Number(allWeightLogs[0].weight_kg) : null;
  const lastWeight = allWeightLogs[allWeightLogs.length - 1]?.weight_kg
    ? Number(allWeightLogs[allWeightLogs.length - 1].weight_kg)
    : null;
  const totalGain =
    firstWeight != null && lastWeight != null ? (lastWeight - firstWeight).toFixed(1) : null;

  /* A MESMA RÉGUA DO PAINEL DO MÉDICO.

     Aqui havia uma cópia inline dos cortes. Os números batiam por sorte, mas as
     GUARDAS não existiam: "0/0" saía como "PA normal" em verde (e o número ao
     lado saía como "—", porque aquele teste é truthy — o mesmo card afirmava
     duas coisas incompatíveis), e pressão de pulso zero também passava. Uma
     régua só, duas vozes: a gravidade vem de `sinalPressao`, o texto de ação
     vem de `vozDaPaciente`. */
  const lastBp = logs.find((l) => l.systolic != null && l.diastolic != null);
  const bpSinal = sinalPressao(lastBp?.systolic, lastBp?.diastolic);
  const bpVoz = vozDaPaciente(bpSinal);
  const bpStatus = bpSinal
    ? {
        label: bpSinal.gravidade === "normal" ? "PA normal" : bpSinal.nota,
        color:
          bpSinal.gravidade === "grave"
            ? "rose"
            : bpSinal.gravidade === "atencao"
              ? "amber"
              : "emerald",
        orientacao: bpVoz?.orientacao ?? null,
      }
    : null;

  // IOM weight curve — Feature #9
  const prePregW = profile?.pre_pregnancy_weight_kg
    ? Number(profile.pre_pregnancy_weight_kg)
    : null;
  const heightM = profile?.height_cm ? profile.height_cm / 100 : null;
  const bmi = prePregW && heightM ? prePregW / (heightM * heightM) : null;

  // Map each weight log to gestational week at that date
  type WeightPoint = { week: number; weight: number };
  const weightByWeek: WeightPoint[] = [];
  if (bmi != null && prePregW != null) {
    allWeightLogs.forEach((l) => {
      const g = computeGestation({
        lmp: profile?.lmp_date,
        referenceDate: profile?.reference_date,
        referenceWeeks: profile?.reference_weeks,
        referenceDays: profile?.reference_days,
        today: new Date(l.log_date + "T00:00:00"),
      });
      if (g && g.weeks >= 0 && g.weeks <= 42 && l.weight_kg) {
        weightByWeek.push({ week: g.weeks, weight: Number(l.weight_kg) });
      }
    });
  }

  // Build SVG IOM chart
  const showIomChart = bmi != null && prePregW != null && weightByWeek.length > 0;
  const iomChartW = 400,
    iomChartH = 180;
  let iomMinY: number, iomMaxY: number;
  if (showIomChart) {
    const corridor = [0, 10, 20, 30, 40].map((w) => {
      const g = iomGain(w, bmi!);
      return { min: prePregW! + g.min, max: prePregW! + g.max };
    });
    const allY = [...corridor.flatMap((c) => [c.min, c.max]), ...weightByWeek.map((p) => p.weight)];
    iomMinY = Math.min(...allY) - 1;
    iomMaxY = Math.max(...allY) + 1;
  } else {
    iomMinY = 50;
    iomMaxY = 90;
  }
  const yRange = Math.max(iomMaxY - iomMinY, 1);

  function toSvgX(week: number) {
    return (week / 42) * iomChartW;
  }
  function toSvgY(w: number) {
    return iomChartH - ((w - iomMinY) / yRange) * (iomChartH - 20) - 10;
  }

  const bandMinPts = Array.from(
    { length: 43 },
    (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).min)}`,
  ).join(" ");
  const bandMaxPts = Array.from(
    { length: 43 },
    (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).max)}`,
  ).join(" ");
  const bandPolygon =
    bandMinPts +
    " " +
    Array.from(
      { length: 43 },
      (_, i) => `${toSvgX(42 - i)},${toSvgY(prePregW! + iomGain(42 - i, bmi!).max)}`,
    ).join(" ");
  const actualPts = weightByWeek.map((p) => `${toSvgX(p.week)},${toSvgY(p.weight)}`).join(" ");

  const bmiLabel =
    bmi == null
      ? null
      : bmi < 18.5
        ? "abaixo do peso"
        : bmi < 25
          ? "peso normal"
          : bmi < 30
            ? "sobrepeso"
            : "obesidade";

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        <div className="press glass-card glass-emerald rounded-3xl p-5">
          <p className="font-serif text-[15px] font-semibold text-emerald-600">⚖️ Último peso</p>
          <p className="mt-2 font-serif text-3xl">
            {last?.weight_kg ? `${last.weight_kg} kg` : "—"}
          </p>
        </div>
        <div className="press glass-card glass-teal rounded-3xl p-5">
          <p className="font-serif text-[15px] font-semibold text-teal-600">📈 Ganho total</p>
          <p className="mt-2 font-serif text-3xl">
            {totalGain != null ? `${Number(totalGain) > 0 ? "+" : ""}${totalGain} kg` : "—"}
          </p>
        </div>
        <div
          className={`press rounded-3xl p-5 ${bpStatus?.color === "rose" ? "glass-card glass-rose" : bpStatus?.color === "amber" ? "glass-card glass-amber" : "glass-card glass-blue"}`}
        >
          <p
            className={`font-serif text-[15px] font-semibold ${bpStatus?.color === "rose" ? "text-rose-600" : bpStatus?.color === "amber" ? "text-amber-600" : "text-blue-600"}`}
          >
            🩺 Última PA
          </p>
          <p className="mt-2 font-serif text-3xl">
            {lastBp?.systolic != null && lastBp?.diastolic != null
              ? `${lastBp.systolic}/${lastBp.diastolic}`
              : "—"}
          </p>
          {bpStatus && (
            <p
              className={`mt-1 text-xs font-medium ${bpStatus.color === "rose" ? "text-rose-700" : bpStatus.color === "amber" ? "text-amber-700" : "text-emerald-700"}`}
            >
              {bpStatus.label}
            </p>
          )}
          {/* A etiqueta sozinha é meia informação. "PA muito elevada" sem o que
              fazer produz susto às 23h; com a próxima ação, produz conduta. */}
          {bpStatus?.orientacao && (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{bpStatus.orientacao}</p>
          )}
        </div>
        {(() => {
          const lastGlucose = logs.find((l) => l.glucose_mg_dl != null);
          const gv = lastGlucose?.glucose_mg_dl;
          /* A escala antiga só olhava para CIMA: 35 mg/dL — neuroglicopenia —
             saía rotulado "Normal", em verde, enquanto o painel do médico dizia
             "Glicemia muito baixa". Não era falta de alerta, era o alerta
             invertido, e para uma gestante em insulina isso é a diferença entre
             comer agora e desmaiar. Mesma função do painel. */
          const gSinal = sinalGlicemia(gv);
          const gVoz = vozDaPaciente(gSinal, "glicemia");
          const gColor =
            gSinal == null
              ? null
              : gSinal.gravidade === "grave"
                ? "rose"
                : gSinal.gravidade === "atencao"
                  ? "amber"
                  : "emerald";
          const gLabel =
            gSinal == null ? null : gSinal.gravidade === "normal" ? "Normal" : gSinal.nota;
          return (
            <div
              className={`press rounded-3xl p-5 ${gColor === "rose" ? "glass-card glass-rose" : gColor === "amber" ? "glass-card glass-amber" : "glass-card glass-sky"}`}
            >
              <p
                className={`font-serif text-[15px] font-semibold ${gColor === "rose" ? "text-rose-600" : gColor === "amber" ? "text-amber-600" : "text-sky-600"}`}
              >
                🍬 Glicemia
              </p>
              <p className="mt-2 font-serif text-3xl">{gv != null ? `${gv} mg/dL` : "—"}</p>
              {gLabel && (
                <p
                  className={`mt-1 text-xs font-medium ${gColor === "rose" ? "text-rose-700" : gColor === "amber" ? "text-amber-700" : "text-emerald-700"}`}
                >
                  {gLabel}
                </p>
              )}
              {gVoz?.orientacao && (
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{gVoz.orientacao}</p>
              )}
            </div>
          );
        })()}
        {/* ─── O CARTÃO DE SpO₂ / FC SAIU (ago/2026) ────────────────────────
            Ele mostrava o que a paciente tinha DIGITADO À MÃO, copiando do
            Apple Health. Saiu junto com o formulário que o alimentava, e a
            razão é a mesma: SpO₂, frequência, passos e sono não mudam conduta
            obstétrica. Era o pior formato possível de recurso — trabalho dela,
            decisão de ninguém —, ocupando um dos cinco lugares mais visíveis
            da tela mais clínica do app.

            Os valores JÁ REGISTRADOS não sumiram: as colunas continuam em
            `health_logs`, aparecem na lista de correção mais abaixo e seguem
            para o `clinical_events` que o médico lê. Parar de pedir é uma
            decisão; apagar o que ela já mandou seria outra. */}
      </div>

      {/* IOM weight corridor chart — Feature #9 */}
      {showIomChart ? (
        <div className="rounded-3xl card-material p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-[15px] font-semibold text-primary">
                Curva de ganho de peso (IOM 2009)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                IMC pré-gestacional: {bmi!.toFixed(1)} ({bmiLabel}) · Faixa recomendada em verde
              </p>
            </div>
          </div>
          <svg viewBox={`0 0 ${iomChartW} ${iomChartH}`} className="mt-3 h-44 w-full">
            {/* Corridor band */}
            <polygon points={bandPolygon} fill="var(--primary)" fillOpacity="0.12" />
            {/* Min line */}
            <polyline
              points={bandMinPts}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            {/* Max line */}
            <polyline
              points={bandMaxPts}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            {/* Actual weight line */}
            {weightByWeek.length > 1 && (
              <polyline
                points={actualPts}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            )}
            {/* Data points */}
            {weightByWeek.map((p, i) => (
              <circle
                key={i}
                cx={toSvgX(p.week)}
                cy={toSvgY(p.weight)}
                r="4"
                fill="var(--primary)"
              />
            ))}
            {/* X-axis labels */}
            {[0, 10, 20, 28, 36, 40].map((w) => (
              <text
                key={w}
                x={toSvgX(w)}
                y={iomChartH - 1}
                fontSize="8"
                fill="var(--muted-foreground)"
                textAnchor="middle"
              >
                {w}s
              </text>
            ))}
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">
            Linha sólida = seu peso · Faixa = zona saudável para seu IMC. Configure altura e peso
            pré-gestacional em{" "}
            <button
              type="button"
              onClick={() => onNavigate("Perfil")}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              Perfil
            </button>
            .
          </p>
        </div>
      ) : (
        prePregW == null && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
            Configure sua <strong>altura</strong> e <strong>peso pré-gestacional</strong> em{" "}
            <button
              type="button"
              onClick={() => onNavigate("Perfil")}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              Perfil
            </button>{" "}
            para ver a curva de ganho de peso recomendada pelo IOM.
          </div>
        )
      )}

      {/* Gráfico histórico de PA */}
      {(() => {
        const bpHistory = logs
          .filter((l) => l.systolic != null && l.diastolic != null)
          .reverse()
          .slice(-15);
        if (bpHistory.length < 2) return null;
        const W = 400,
          H = 140;
        const allY = bpHistory.flatMap((l) => [l.systolic!, l.diastolic!]);
        const minY = Math.min(...allY, 50) - 5;
        const maxY = Math.max(...allY, 160) + 5;
        const sy = (v: number) => H - 10 - ((v - minY) / (maxY - minY)) * (H - 20);
        const sx = (i: number) => 10 + (i / (bpHistory.length - 1)) * (W - 20);
        const systPts = bpHistory.map((l, i) => `${sx(i)},${sy(l.systolic!)}`).join(" ");
        const diasPts = bpHistory.map((l, i) => `${sx(i)},${sy(l.diastolic!)}`).join(" ");
        return (
          <div className="rounded-3xl card-material p-6">
            <p className="font-serif text-[15px] font-semibold text-primary">
              Histórico de pressão arterial
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Linha vermelha = sistólica · Linha azul = diastólica · Limite em tracejado
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-36 w-full">
              {/* threshold 140 sistólica */}
              <line
                x1="10"
                y1={sy(140)}
                x2={W - 10}
                y2={sy(140)}
                stroke="#f87171"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />
              <text x="12" y={sy(140) - 3} fontSize="7" fill="#f87171" opacity="0.8">
                140
              </text>
              {/* threshold 90 diastólica */}
              <line
                x1="10"
                y1={sy(90)}
                x2={W - 10}
                y2={sy(90)}
                stroke="#60a5fa"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />
              <text x="12" y={sy(90) - 3} fontSize="7" fill="#60a5fa" opacity="0.8">
                90
              </text>
              <polyline
                points={systPts}
                fill="none"
                stroke="#f87171"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <polyline
                points={diasPts}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {bpHistory.map((l, i) => (
                <g key={i}>
                  <circle cx={sx(i)} cy={sy(l.systolic!)} r="3.5" fill="#f87171" />
                  <circle cx={sx(i)} cy={sy(l.diastolic!)} r="3.5" fill="#60a5fa" />
                </g>
              ))}
            </svg>
          </div>
        );
      })()}

      {/* Gráfico histórico de glicemia */}
      {(() => {
        const glHistory = logs
          .filter((l) => l.glucose_mg_dl != null)
          .reverse()
          .slice(-15);
        if (glHistory.length < 2) return null;
        const W = 400,
          H = 130;
        const allY = glHistory.map((l) => l.glucose_mg_dl!);
        const minY = Math.min(...allY, 70) - 5;
        const maxY = Math.max(...allY, 180) + 5;
        const sy = (v: number) => H - 10 - ((v - minY) / (maxY - minY)) * (H - 20);
        const sx = (i: number) => 10 + (i / (glHistory.length - 1)) * (W - 20);
        const pts = glHistory.map((l, i) => `${sx(i)},${sy(l.glucose_mg_dl!)}`).join(" ");
        return (
          <div className="rounded-3xl card-material p-6">
            <p className="font-serif text-[15px] font-semibold text-primary">
              Histórico de glicemia
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Referência em jejum: &lt; 95 mg/dL · Pós-prandial: &lt; 140 mg/dL
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-32 w-full">
              {/* zona verde < 95 */}
              <rect
                x="10"
                y={sy(95)}
                width={W - 20}
                height={sy(minY) - sy(95)}
                fill="#4ade80"
                opacity="0.08"
              />
              <line
                x1="10"
                y1={sy(95)}
                x2={W - 10}
                y2={sy(95)}
                stroke="#4ade80"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
              />
              <text x="12" y={sy(95) - 3} fontSize="7" fill="#4ade80" opacity="0.9">
                95
              </text>
              {/* threshold 140 */}
              <line
                x1="10"
                y1={sy(140)}
                x2={W - 10}
                y2={sy(140)}
                stroke="#fb923c"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
              />
              <text x="12" y={sy(140) - 3} fontSize="7" fill="#fb923c" opacity="0.9">
                140
              </text>
              <polyline
                points={pts}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {glHistory.map((l, i) => (
                <circle
                  key={i}
                  cx={sx(i)}
                  cy={sy(l.glucose_mg_dl!)}
                  r="3.5"
                  fill={(() => {
                    /* Terceira cópia da escala, agora removida: os pontos do
                       gráfico pintavam de verde exatamente os mesmos valores
                       baixos que o card. */
                    const g = sinalGlicemia(l.glucose_mg_dl)?.gravidade;
                    return g === "grave"
                      ? "#f87171"
                      : g === "atencao"
                        ? "#fb923c"
                        : "var(--primary)";
                  })()}
                />
              ))}
            </svg>
          </div>
        );
      })()}

      {/* ─── O WEARABLE SAIU INTEIRO (ago/2026) ────────────────────────────
          Aqui moravam duas coisas: quatro cartões de SpO₂ / FC / Passos / Sono
          e um guia ensinando a ABRIR o Apple Health, LER os números e DIGITAR
          cada um deles aqui.

          Nenhum dos quatro muda conduta obstétrica. O que este bloco pedia era
          trabalho manual e diário da paciente para produzir um dado que nenhuma
          decisão do médico consulta — e o guia deixava isso explícito ao
          admitir que "a integração automática requer aplicativo nativo".

          Não confundir com a pressão e a glicemia, que ficam: aquelas são
          aferições que ELA faz com aparelho próprio e que entram na régua
          clínica. A diferença não é o esforço, é quem lê o resultado.

          As colunas continuam em `health_logs` e o que já foi registrado
          aparece na lista de correção — parar de pedir é uma decisão; apagar o
          que ela já mandou seria outra. */}

      {/* New log form */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Novo registro</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Field
            label="Peso (kg)"
            type="number"
            value={form.weight_kg}
            onChange={(v) => setForm({ ...form, weight_kg: v })}
          />
          <Field
            label="Sistólica"
            type="number"
            value={form.systolic}
            onChange={(v) => setForm({ ...form, systolic: v })}
          />
          <Field
            label="Diastólica"
            type="number"
            value={form.diastolic}
            onChange={(v) => setForm({ ...form, diastolic: v })}
          />
          <Field
            label="Glicemia (mg/dL)"
            type="number"
            value={form.glucose_mg_dl}
            onChange={(v) => setForm({ ...form, glucose_mg_dl: v })}
          />
          <Field
            label="Notas"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
        </div>
        {/* Os quatro campos de wearable ficavam aqui, atrás de um botão que os
            revelava. Ver a nota acima — e note que o rótulo dele não aparece
            nem em comentário: `hub-da-saude.test.ts` procura a string no
            arquivo inteiro, e citá-la aqui reprovaria o teste que existe para
            impedir o bloco de voltar. */}
        <button
          onClick={add}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Adicionar
        </button>
      </div>

      {/* ─── A LISTA VIROU "CORRIGIR", E ISSO É O QUE ELA SEMPRE FOI ───────
          Ela era a TERCEIRA cópia dos mesmos números na mesma tela: cinco
          cartões dizem "como estou", os gráficos dizem "para onde isso vai", e
          a lista repetia tudo mais uma vez, crua.

          Mas apagá-la seria tirar uma capacidade, não uma repetição: é o único
          lugar com o × que apaga um registro. Quem digitou 1200 em vez de 120
          precisa dele — e num app cujo painel do médico pinta a gravidade
          desses números, um valor errado que não se pode apagar vira alarme
          falso no consultório.

          Então ela recolhe. Fechada não ocupa tela; aberta é o que a paciente
          procura quando quer arrumar alguma coisa — e o rótulo passa a dizer
          isso, em vez de fingir ser um resumo. */}
      <details className="rounded-2xl card-material">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium">
          ✏️ Ver e corrigir meus registros
          {logs.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({logs.length})
            </span>
          )}
        </summary>
        <div className="space-y-2 px-3 pb-3">
          {logs.length === 0 && (
            <p className="px-2 pb-1 text-sm text-muted-foreground">
              Você ainda não registrou nada.
            </p>
          )}
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4 text-sm"
            >
              <span className="shrink-0 text-muted-foreground">
                {new Date(l.log_date + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
              <span className="flex flex-1 flex-wrap gap-x-3 gap-y-0.5 px-3 text-xs">
                {l.weight_kg && <span>⚖️ {l.weight_kg} kg</span>}
                {l.systolic && l.diastolic && (
                  <span>
                    💓 {l.systolic}/{l.diastolic}
                  </span>
                )}
                {l.glucose_mg_dl && <span>🩸 {l.glucose_mg_dl} mg/dL</span>}
                {/* Os quatro de wearable continuam aqui de propósito: o app
                    parou de PEDIR, mas quem já registrou tem de conseguir ver
                    (e apagar) o que mandou. */}
                {l.spo2 && <span>🫁 {l.spo2}% SpO₂</span>}
                {l.heart_rate_bpm && <span>❤️ {l.heart_rate_bpm}bpm</span>}
                {l.steps && <span>🚶 {l.steps} passos</span>}
                {l.sleep_hours && <span>🌙 {l.sleep_hours}h sono</span>}
                {l.notes && <span className="text-muted-foreground">{l.notes}</span>}
              </span>
              <button
                onClick={() => remove(l.id)}
                aria-label="Apagar este registro"
                className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

/* ---------- Perguntas para o médico ---------- */

const SUGGESTED_QUESTIONS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Que suplementos devo tomar no 1º trimestre?",
    "Quais alimentos devo evitar?",
    "Posso fazer exercícios físicos?",
    "O que é a translucência nucal?",
  ],
  2: [
    "Como interpretar o resultado do ultrassom morfológico?",
    "O que é o teste de glicose?",
    "Posso viajar nesta fase?",
    "Como posso estimular o bebê?",
  ],
  3: [
    "Quando devo ir para a maternidade?",
    "Quais são os sinais de trabalho de parto?",
    "Como é decidido entre parto normal e cesárea?",
    "O que é o plano de parto?",
  ],
};

function QuestionsTab({ gest }: { gest: Gest }) {
  const [items, setItems] = useState<DoctorQ[]>([]);
  const [text, setText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const trimester = gest ? trimesterForWeek(gest.weeks) : 1;
  const suggestions = SUGGESTED_QUESTIONS[trimester];

  async function load() {
    const { data } = await (supabase as any)
      .from("doctor_questions")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  /* ─── O QUE A IA DISSE TER REGISTRADO ────────────────────────────────────
     A IA promete "registrei aqui para ele ver" — e até agora não havia um
     único lugar no app dela onde isso aparecesse. A linha em
     `doctor_questions` só nasce quando o médico RESPONDE; entre a promessa e a
     resposta existia o nada, e a frase da IA era indistinguível de consolo.
     Ler (em vez de gravar a linha na hora do registro) é o que impede a
     pergunta de aparecer DUAS vezes quando a resposta chega. */
  const [registradas, setRegistradas] = useState<DuvidaRegistrada[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return;
        const res = await minhasDuvidasRegistradas({
          data: { accessToken: s.session.access_token },
        });
        if (res.ok) setRegistradas(res.duvidas);
      } catch {
        /* sem o aviso ela perde o aviso, não a aba */
      }
    })();
  }, [items]);

  async function add(question?: string) {
    const q = (question ?? text).trim();
    if (!q) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      return;
    }
    // Carimba o médico vinculado para o assinante ver a pergunta da SUA paciente.
    const { data: prof } = await (supabase as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", u.user.id)
      .maybeSingle();
    const { error } = await (supabase as any)
      .from("doctor_questions")
      .insert({ user_id: u.user.id, question: q, doctor_id: prof?.doctor_id ?? null });
    if (error) {
      toast.error("Não foi possível salvar a pergunta. Tente novamente.");
      return;
    }
    setText("");
    load();
    triggerAchievementsCheck();
  }
  async function toggle(q: DoctorQ) {
    const { error } = await (supabase as any)
      .from("doctor_questions")
      .update({ answered: !q.answered })
      .eq("id", q.id);
    if (error) {
      toast.error("Não foi possível atualizar a pergunta. Tente novamente.");
      return;
    }
    setItems((arr) => arr.map((x) => (x.id === q.id ? { ...x, answered: !x.answered } : x)));
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("doctor_questions").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover a pergunta. Tente novamente.");
      return;
    }
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  const pending = items.filter((q) => !q.answered);
  const answered = items.filter((q) => q.answered);

  return (
    <div className="space-y-6">
      {registradas.length > 0 && (
        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
          <p className="font-serif text-lg">Sua dúvida está com o seu médico</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando você perguntou no chat, a IA registrou aqui para ele. Assim que ele responder, a
            resposta aparece na lista abaixo — e você recebe um aviso.
          </p>
          <ul className="mt-4 space-y-2">
            {registradas.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-background/70 px-3 py-2"
              >
                {/* Sem o texto dela guardado (banco antes da migration), mostra
                    uma frase neutra em vez de cair para o enunciado da lacuna —
                    que é o texto cru da PRIMEIRA paciente que fez aquela dúvida. */}
                <span className="min-w-0 flex-1 text-sm">
                  {d.pergunta || "Uma dúvida que você mandou pelo chat"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  registrada em {new Date(d.quando).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Anote para a próxima consulta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquela dúvida que sempre esquece na hora — registre aqui.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ex: posso fazer exercícios físicos?"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => add()}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
          >
            Adicionar
          </button>
        </div>

        {/* Suggested questions by trimester */}
        <div className="mt-4">
          <button
            onClick={() => setShowSuggestions((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showSuggestions
              ? "▲ Ocultar sugestões"
              : "▼ Ver perguntas comuns do " +
                (trimester === 1 ? "1º" : trimester === 2 ? "2º" : "3º") +
                " trimestre"}
          </button>
          {showSuggestions && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => add(s)}
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 font-serif text-[15px] font-semibold text-muted-foreground">
          Pendentes ({pending.length})
        </p>
        <div className="space-y-2">
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma pergunta pendente.</p>
          )}
          {pending.map((q) => (
            <div key={q.id} className="flex items-start gap-3 rounded-2xl card-material p-4">
              <input
                type="checkbox"
                checked={q.answered}
                onChange={() => toggle(q)}
                className="mt-1 h-4 w-4"
              />
              <p className="flex-1 text-sm">{q.question}</p>
              <button
                onClick={() => remove(q.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {answered.length > 0 && (
        <div>
          <p className="mb-2 font-serif text-[15px] font-semibold text-muted-foreground">
            Respondidas ({answered.length})
          </p>
          <div className="space-y-2">
            {answered.map((q) => (
              <div key={q.id} className="rounded-2xl card-material p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggle(q)}
                    className="mt-1 h-4 w-4"
                  />
                  <p className={`flex-1 text-sm ${q.answer ? "" : "line-through"}`}>{q.question}</p>
                  <button
                    onClick={() => remove(q.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
                {/* Resposta do médico — volta para a paciente aqui */}
                {q.answer && (
                  <div className="ml-7 mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      💬 Resposta do seu médico
                      {q.answered_at
                        ? ` · ${new Date(q.answered_at).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground">{q.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Acompanhante ---------- */
function CompanionTab({ babyName }: { babyName: string | null }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const { data } = await (supabase as any)
      .from("companion_invites")
      .select("*")
      .order("created_at", { ascending: false });
    setInvites(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Token criptográfico (não-enumerável) — dá acesso ao painel do papai,
    // álbum e alerta de pânico. Validade de 1 ano cobre gestação + pós-parto;
    // o backend já rejeita convites vencidos (expires_at) e o "Revogar" segue
    // sendo o controle imediato.
    /* ⚠️ DOIS tokens, com privilégios diferentes, e nunca o mesmo valor.
       `token` abre o painel do acompanhante e os SOS recentes — vai só para
       quem ela designar. `album_token` abre SÓ o álbum, e é o que ela manda
       para o grupo da família. Ver APLICAR_SOS_SO_PARA_QUEM_DEVE.sql. */
    const token = crypto.randomUUID().replace(/-/g, "");
    const albumToken = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await (supabase as any).from("companion_invites").insert({
      user_id: u.user.id,
      token,
      album_token: albumToken,
      companion_name: name || null,
      expires_at: expiresAt,
    });
    setName("");
    load();
  }
  async function revoke(id: string) {
    await (supabase as any).from("companion_invites").delete().eq("id", id);
    load();
  }

  const babyLabel = babyName ? babyName : "o nosso bebê";
  function inviteMessage(url: string): string {
    return `Oi! 💛 Criei um espaço pra você acompanhar comigo a gestação ${
      babyName ? `de ${babyName}` : "do nosso bebê"
    } — dá pra ver a evolução semana a semana, o tamanho do bebê e os momentos. É só abrir: ${url}`;
  }
  async function copyLink(url: string) {
    hapticTap();
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado 💛");
    } catch {
      toast("Copie o link manualmente 💛");
    }
  }
  function shareWhatsApp(url: string) {
    hapticTap();
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage(url))}`, "_blank");
  }
  async function shareNative(url: string) {
    hapticTap();
    const nav = navigator as Navigator & { share?: (d: unknown) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Acompanhe nossa gestação 💛", text: inviteMessage(url) });
      } catch {
        /* usuária cancelou */
      }
    } else {
      copyLink(url);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Convidar acompanhante</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Traga o papai, a vovó ou alguém especial pra viver essa fase com você. Com o link, a
          pessoa acompanha a evolução {babyLabel === "o nosso bebê" ? "do bebê" : `de ${babyName}`}{" "}
          semana a semana — só visualização, você controla e pode revogar quando quiser.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>👶 Semana e tamanho do bebê</span>
          <span>📸 Álbum</span>
          <span>💗 Batimentos</span>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do acompanhante (opcional)"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm"
          />
          <button
            onClick={() => {
              hapticTap();
              create();
            }}
            className="press rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Gerar convite
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum convite ainda — gere um acima e mande no WhatsApp. 💛
          </p>
        )}
        {invites.map((i) => {
          const url = `${window.location.origin}/acompanhar/${i.token}`;
          return (
            <div key={i.id} className="rounded-2xl card-material p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{i.companion_name ?? "Acompanhante"}</p>
                <button
                  onClick={() => revoke(i.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  revogar
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  onClick={() => shareWhatsApp(url)}
                  className="press col-span-2 flex items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white sm:col-span-1"
                >
                  <span>💬</span> WhatsApp
                </button>
                <button
                  onClick={() => copyLink(url)}
                  className="press rounded-full border border-border px-4 py-2.5 text-sm font-medium"
                >
                  Copiar link
                </button>
                <button
                  onClick={() => shareNative(url)}
                  className="press rounded-full border border-border px-4 py-2.5 text-sm font-medium"
                >
                  Compartilhar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Alertas / triagem de sintomas ---------- */
function AlertsTab({ weeks }: { weeks: number | null }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * ⚠️ **A GRAVAÇÃO DA TRIAGEM ERA MUDA NOS DOIS SENTIDOS.**
   *
   * `saveTriageLog` era chamada com `void … .catch(() => {})`, e o servidor
   * devolve `{ ok: false }` (resposta 200 normal) quando o INSERT falha — então
   * nem a exceção nem o desfecho chegavam a lugar nenhum.
   *
   * Isso importa porque `triage_logs` é uma das onze fontes de
   * `clinical_events`, e é por ela que uma triagem vermelha ou amarela entra em
   * `eventosQuePedemOlhar` — a fila de trabalho do painel. Sem a linha,
   * "sangramento" ou "redução dos movimentos do bebê" (dois dos nove sintomas
   * VERMELHOS de `triage.ts`) não chegam ao obstetra, e **nem ela nem ele têm
   * como saber**.
   *
   * ⚠️ O "não atrapalha a orientação" do comentário antigo estava CERTO e
   * continua: a conduta aparece inteira na tela, com o 192 no vermelho, mesmo
   * que a gravação falhe. O que mudou é ela saber que o registro não foi.
   */
  const [registrou, setRegistrou] = useState<boolean | null>(null);
  const [result, setResult] = useState<{
    level: RiskLevel;
    reasons: string[];
    message: string;
  } | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function avaliar() {
    setLoading(true);
    setResult(null);
    try {
      /* A sessão vai junto: sem ela a orientação continua saindo (a régua é de
         regra, não de IA), mas escrita à mão em vez de gerada. Ver o cabeçalho
         de `assessSymptoms`. */
      const { data: sess } = await supabase.auth.getSession();
      const res = await assessSymptoms({
        data: {
          accessToken: sess.session?.access_token,
          symptoms: [...selected],
          systolic: sys ? Number(sys) : null,
          diastolic: dia ? Number(dia) : null,
          note: note || undefined,
          weeks,
        },
      });
      setResult(res);
      // Grava a triagem na CONTA da paciente (histórico + dashboard do médico).
      // Fire-and-forget: falha de rede/tabela ausente NÃO atrapalha a orientação.
      try {
        const { data: s } = await supabase.auth.getSession();
        if (s.session?.access_token) {
          /* ⚠️ `await` e LEITURA do desfecho — ver o comentário de `registrou`.
             `{ ok: false }` vem num 200, então `.catch` sozinho não bastaria:
             era preciso olhar o valor. */
          const gravou = await saveTriageLog({
            data: {
              accessToken: s.session.access_token,
              level: res.level,
              symptoms: [...selected],
              systolic: sys ? Number(sys) : null,
              diastolic: dia ? Number(dia) : null,
              note: note || null,
            },
          }).catch(() => ({ ok: false as const }));
          setRegistrou(gravou.ok);
        } else {
          /* Sem sessão não há onde gravar, e isso não é falha a anunciar: a
             triagem funciona para visitante, e ela não tem conta para ver o
             histórico. */
          setRegistrou(null);
        }
      } catch {
        /* sessão indisponível — a triagem já foi mostrada, seguimos */
      }
    } catch {
      toast.error(
        "Não foi possível avaliar os sintomas. Tente novamente ou ligue para o consultório.",
      );
    } finally {
      setLoading(false);
    }
  }

  const styles: Record<RiskLevel, { box: string; dot: string; titulo: string }> = {
    vermelho: {
      box: "border-rose-300 bg-rose-50",
      dot: "bg-rose-500",
      titulo: "Procure atendimento agora",
    },
    amarelo: {
      box: "border-primary/25 bg-primary/8",
      dot: "bg-primary",
      titulo: "Atenção — fale com o consultório",
    },
    verde: {
      box: "border-emerald-300 bg-emerald-50",
      dot: "bg-emerald-500",
      titulo: "Sem sinais de alerta",
    },
  };

  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm text-foreground">
        Esta triagem é uma orientação e <strong>não substitui avaliação médica</strong>. Em
        emergência, ligue <strong>192 (SAMU)</strong> ou vá ao pronto-socorro.
      </div>
      {weeks != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Avaliação para semana {weeks} de gestação.
        </p>
      )}

      <p className="mt-5 text-sm font-medium">Marque o que você está sentindo:</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[...RED_SYMPTOMS, ...YELLOW_SYMPTOMS].map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              selected.has(s.id) ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="accent-[oklch(0.5_0.11_18)]"
            />
            {s.label}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Pressão (opcional):</label>
          <input
            value={sys}
            onChange={(e) => setSys(e.target.value)}
            inputMode="numeric"
            placeholder="120"
            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <span>/</span>
          <input
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            inputMode="numeric"
            placeholder="80"
            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Quer descrever algo? (opcional)"
        className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />

      <button
        onClick={avaliar}
        disabled={loading}
        className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Avaliando…" : "Avaliar sintomas"}
      </button>

      {result && (
        <div className={`mt-6 rounded-2xl border p-5 ${styles[result.level].box}`}>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${styles[result.level].dot}`} />
            <p className="font-serif text-lg">{styles[result.level].titulo}</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground">{result.message}</p>
          {result.reasons.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Sinais considerados: {result.reasons.join(", ")}.
            </p>
          )}
          {result.level === "vermelho" && (
            <a
              href="tel:192"
              className="mt-4 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          )}
          {/* ⚠️ **SÓ quando a triagem NÃO é verde.** Numa triagem verde o
              registro é histórico, e avisar sobre uma falha de gravação
              assustaria sem dar nada a fazer. No amarelo e no vermelho é o
              contrário: é justamente a triagem que deveria entrar na fila do
              médico, e ela precisa saber que não entrou — senão fica esperando
              um retorno que ninguém vai dar.

              E é texto NA CAIXA, nunca um `toast`: ela rola a tela lendo a
              orientação, e um aviso que some em cinco segundos é um aviso que
              não aconteceu. */}
          {registrou === false && result.level !== "verde" && (
            <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[13px] leading-snug text-amber-900">
              Não consegui registrar isto na sua conta — então seu médico não vai ver por aqui. A
              orientação acima vale do mesmo jeito. Se puder, fale com o consultório.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Carteirinha digital (feat 43 — evoluída) ---------- */
function CardTab({
  profile,
  gest,
  onNavigate,
  medico,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
  /** Médico da paciente; `null` = usa o dono da instalação. */
  medico?: DoctorContato | null;
}) {
  /* Tudo-ou-nada, e sem fundador.
  
     Esta carteirinha é o documento que ela mostra no pronto-socorro. Enquanto
     "sem médico vinculado" caía em `DOCTOR.name` / `DOCTOR.crm`, o cartão
     impresso, o QR e o texto de copiar afirmavam "Dr. Clóvis Bacha · CRM-MG
     22.333" para a paciente de qualquer outro médico — uma identidade médica
     falsa num documento clínico. Sem vínculo, a linha do médico simplesmente
     não existe. */
  const temMedicoVinculado = !!medico?.nome?.trim();
  const medNome = temMedicoVinculado ? medico!.nome.trim() : "";
  const medCrm = temMedicoVinculado ? (medico!.crm ?? "").trim() : "";
  const medEspec = temMedicoVinculado ? (medico!.specialty ?? medico!.title ?? "").trim() : "";
  /** Linha "Médico" pronta, ou vazia quando não há vínculo. */
  const medLinha = [medNome, medCrm].filter(Boolean).join(" · ");
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const due = profile
    ? (profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null))
    : null;
  const updatedAt = new Date().toLocaleString("pt-BR");

  const cardText = profile
    ? [
        `🚨 CARTEIRINHA DE EMERGÊNCIA — GESTANTE`,
        `Paciente: ${profile.display_name ?? "—"}`,
        `Bebê: ${profile.baby_name ?? "—"}`,
        `IG: ${gest ? `${gest.weeks}s ${gest.days}d` : "—"}`,
        `DPP: ${due ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR") : "—"}`,
        `Tipo sanguíneo: ${profile.blood_type ?? "—"}`,
        `Alergias: ${profile.allergies ?? "Nenhuma"}`,
        `Medicamentos: ${profile.medications ?? "Nenhum"}`,
        `Contato de emergência: ${profile.emergency_contact ?? "—"} — ${profile.emergency_phone ?? "—"}`,
        // Sem vínculo a linha sai fora do QR: melhor o hospital não ver
        // médico nenhum do que ver o nome errado.
        medLinha ? `Médico: ${medLinha}` : null,
        `Atualizado: ${updatedAt}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  // QR gerado localmente: dados de saúde não saem do aparelho e funciona offline
  useEffect(() => {
    if (!cardText) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(cardText, { width: 480, margin: 1 }))
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cardText]);

  if (!profile)
    return <p className="text-sm text-muted-foreground">Preencha seu perfil primeiro.</p>;

  function copyCard() {
    navigator.clipboard.writeText(cardText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Main card */}
      <div className="rounded-3xl bg-[image:var(--gradient-warm)] p-8 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-serif text-[15px] font-semibold text-primary">
              Carteirinha de emergência
            </p>
            <h2 className="mt-1.5 font-serif text-2xl">{profile.display_name ?? "—"}</h2>
            {profile.baby_name && (
              <p className="text-sm text-muted-foreground">Bebê: {profile.baby_name}</p>
            )}
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            GESTANTE
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="IG atual" value={gest ? `${gest.weeks}s ${gest.days}d` : "—"} />
          <Info
            label="DPP"
            value={due ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
          />
          <Info label="Tipo sanguíneo" value={profile.blood_type ?? "—"} />
          <Info label="Alergias" value={profile.allergies || "Nenhuma"} />
          <Info label="Medicamentos" value={profile.medications || "Nenhum"} />
          <Info label="Contato emergência" value={profile.emergency_contact ?? "—"} />
          {profile.emergency_phone && (
            <Info label="Tel. emergência" value={profile.emergency_phone} />
          )}
          {medLinha ? <Info label="Médico" value={medLinha} /> : null}
        </div>

        <div className="mt-5 rounded-xl bg-card/60 p-3 text-xs text-muted-foreground">
          Atualizado em: {updatedAt}
        </div>

        <div className="mt-6 flex flex-col items-center border-t border-primary/20 pt-5">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="QR Code de emergência"
              className="h-48 w-48 rounded-lg bg-white p-2"
            />
          ) : (
            <div className="skeleton h-48 w-48 rounded-lg" />
          )}
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Escaneie para ver todos os dados em caso de emergência
          </p>
          {medNome ? (
            <p className="mt-2 text-xs font-medium text-primary">
              {[medNome, medEspec].filter(Boolean).join(" — ")}
            </p>
          ) : (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Escolha seu obstetra no app para o nome e o CRM dele entrarem aqui.
            </p>
          )}
        </div>
      </div>

      {/* Emergency numbers */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-3">
          Números de emergência
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "SAMU", number: "192" },
            { label: "Bombeiros", number: "193" },
            { label: "SIATE/Resgate", number: "192" },
            { label: "CVV (apoio emocional)", number: "188" },
          ].map(({ label, number }) => (
            <a
              key={label}
              href={`tel:${number}`}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm"
            >
              <span className="text-lg">📞</span>
              <div>
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-sm font-bold text-red-600">{number}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={copyCard}
        className="w-full rounded-2xl bg-primary py-3 text-sm font-medium text-white"
      >
        {copied ? "✓ Copiado!" : "Copiar dados para enviar por WhatsApp"}
      </button>

      <button
        onClick={() => window.print()}
        className="print:hidden w-full rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
      >
        🖨️ Imprimir carteirinha
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Mantenha seus dados atualizados em{" "}
        <button
          type="button"
          onClick={() => onNavigate("Perfil")}
          className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
        >
          Perfil
        </button>{" "}
        — o QR Code atualiza automaticamente.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/60 p-3 backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function ApagarConversas() {
  const [apagando, setApagando] = useState(false);
  const [pronto, setPronto] = useState(false);
  /**
   * ⚠️ **A CONFIRMAÇÃO VIVE NA TELA, e não num `window.confirm`.**
   *
   * Duas razões, e as duas são concretas:
   *
   *  1. **No app instalado, o diálogo do sistema abre com
   *     "www.obstetrica.com.br diz:"** — o nome do domínio, dentro do app. É a
   *     cara de navegador embrulhado que a diretriz 4.2 da Apple reprova, numa
   *     tela que a paciente só visita quando está apagando algo.
   *  2. **É a decisão que o dono já tomou**, explicitamente, para o cancelar
   *     consulta: confirmação em MENSAGEM separada, com Sim/Não — nunca o mesmo
   *     botão virando "tem certeza?".
   *
   * O comentário lá em cima nesta mesma tela já dizia isso sobre um `alert()`
   * ("num app instalado, isso é um diálogo modal"). A lição foi aprendida uma
   * vez e não foi aplicada aos outros três.
   */
  const [confirmando, setConfirmando] = useState(false);

  async function apagar() {
    if (apagando) return;
    setConfirmando(false);
    setApagando(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const res = await apagarMinhasConversas({
        data: { accessToken: s.session.access_token },
      });
      if (res.ok) {
        setPronto(true);
        toast.success("Conversas apagadas.");
      } else {
        /* "Apagamos" sem ter apagado é a mentira que a exclusão de conta
           contava. Aqui ela sabe que não foi, e pode tentar de novo. */
        toast.error("Não foi possível apagar agora. Tente de novo.");
      }
    } catch {
      toast.error("Não foi possível apagar agora. Tente de novo.");
    } finally {
      setApagando(false);
    }
  }

  return (
    <div className="rounded-3xl card-material p-6">
      <p className="font-serif text-lg">Suas conversas com a IA</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Elas ficam guardadas para a IA dar continuidade — e o seu médico pode lê-las no painel dele.
        Você pode apagar tudo quando quiser, sem perder nada do resto: a gestação, o diário, os
        exames e as respostas dele continuam.
      </p>
      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          disabled={apagando || pronto}
          className="press mt-4 min-h-11 rounded-full border border-border px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pronto ? "Apagadas ✓" : apagando ? "Apagando…" : "Apagar minhas conversas"}
        </button>
      ) : (
        /* ⚠️ A confirmação é uma MENSAGEM separada com Sim/Não — nunca o mesmo
           botão virando "tem certeza?". É o padrão que o dono pediu
           explicitamente no cancelar consulta, e o que ela lê aqui é o que o
           `window.confirm` dizia: o que sai e o que FICA. */
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-3">
          <p className="text-[13px] leading-snug text-rose-900">
            Apagar todas as suas conversas com a IA? Isto <strong>não</strong> apaga sua conta, seu
            diário, seus exames nem as respostas do seu médico.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={apagar}
              className="press min-h-11 flex-1 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white"
            >
              Sim, apagar
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="press min-h-11 flex-1 rounded-full border border-border px-4 text-sm font-medium"
            >
              Não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Chat IA ---------- */
type ChatMsg = { role: "user" | "assistant"; content: string };

/* ---------- Calendário do Pré-natal ---------- */

type Milestone = {
  week: number;
  type: "exam" | "consult" | "vaccine" | "milestone";
  label: string;
  detail?: string;
};

const PRENATAL_MILESTONES: Milestone[] = [
  {
    week: 6,
    type: "consult",
    label: "1ª consulta pré-natal",
    detail: "Confirmação da gestação, exames iniciais e início do ácido fólico.",
  },
  {
    week: 8,
    type: "exam",
    label: "Exames iniciais (sangue e urina)",
    detail: "Hemograma, sorologias, tipagem sanguínea, urina EAS.",
  },
  {
    week: 11,
    type: "exam",
    label: "Translucência nucal",
    detail: "Ultrassom entre 11s–13s6d + PAPP-A e beta-hCG.",
  },
  {
    week: 12,
    type: "milestone",
    label: "Fim do 1º trimestre 🎉",
    detail: "Risco de aborto reduz significativamente.",
  },
  { week: 14, type: "consult", label: "Consulta mensal" },
  { week: 16, type: "consult", label: "Consulta mensal" },
  {
    week: 18,
    type: "exam",
    label: "Ultrassom morfológico",
    detail: "Avaliação detalhada da anatomia fetal. Entre 18–22 semanas.",
  },
  {
    week: 20,
    type: "milestone",
    label: "Metade da gestação! 🌟",
    detail: "Bebê começa a ser sentido com mais frequência.",
  },
  {
    week: 24,
    type: "exam",
    label: "Curva glicêmica (TOTG)",
    detail: "Rastreio de diabetes gestacional. Jejum de 8h.",
  },
  { week: 26, type: "consult", label: "Consulta mensal" },
  { week: 26, type: "exam", label: "Hemograma e exames de rotina" },
  {
    week: 28,
    type: "milestone",
    label: "Início do 3º trimestre",
    detail: "Conte os movimentos diariamente a partir de agora.",
  },
  {
    week: 30,
    type: "consult",
    label: "Consultas quinzenais",
    detail: "A partir da 30ª semana, consultas a cada 2 semanas.",
  },
  {
    week: 32,
    type: "exam",
    label: "Ultrassom de crescimento fetal",
    detail: "Avaliação de crescimento e Doppler quando indicado.",
  },
  { week: 34, type: "consult", label: "Consulta quinzenal" },
  {
    week: 35,
    type: "exam",
    label: "Cultura Streptococcus Grupo B",
    detail: "Swab vaginal/retal entre 35–37 semanas.",
  },
  {
    week: 36,
    type: "consult",
    label: "Consultas semanais",
    detail: "A partir da 36ª semana, consultas semanais.",
  },
  {
    week: 37,
    type: "milestone",
    label: "A TERMO! Bebê pronto para nascer 🎉",
    detail: "Semana 37 marca o início do período a termo.",
  },
  {
    week: 38,
    type: "exam",
    label: "Cardiotocografia (CTG)",
    detail: "Avaliação do bem-estar fetal e planejamento do parto.",
  },
  { week: 40, type: "milestone", label: "DPP — Data Provável do Parto 👶" },
];

const TYPE_COLOR: Record<Milestone["type"], string> = {
  exam: "bg-secondary text-primary border-border",
  consult: "bg-primary/10 text-primary border-primary/20",
  vaccine: "bg-primary/10 text-primary border-primary/20",
  milestone: "bg-primary/10 text-primary border-primary/20",
};
const TYPE_LABEL: Record<Milestone["type"], string> = {
  exam: "Exame",
  consult: "Consulta",
  vaccine: "Vacina",
  milestone: "Marco",
};

function weekToDate(targetWeek: number, profile: Profile): Date | null {
  if (profile.reference_date && profile.reference_weeks != null) {
    const ref = new Date(profile.reference_date + "T00:00:00");
    const gestDaysSoFar = profile.reference_weeks * 7 + (profile.reference_days ?? 0);
    const lmpEquiv = new Date(ref.getTime() - gestDaysSoFar * 86400000);
    return new Date(lmpEquiv.getTime() + targetWeek * 7 * 86400000);
  }
  if (profile.lmp_date) {
    const lmp = new Date(profile.lmp_date + "T00:00:00");
    return new Date(lmp.getTime() + targetWeek * 7 * 86400000);
  }
  return null;
}

function toGoogleCalUrl(label: string, date: Date) {
  const ymd = ymdLocal(date).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Pré-natal: ${label}`,
    dates: `${ymd}/${ymd}`,
    details: "Acompanhamento pré-natal — Obstétrica",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Rótulo/cor do status da consulta, mostrado no calendário.
const APPT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Aguardando confirmação", cls: "bg-amber-100 text-amber-700" },
  counter_proposed: { label: "Novo horário proposto", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-700" },
  done: { label: "Realizada", cls: "bg-secondary text-muted-foreground" },
};

function PrenatalCalendarTab({
  profile,
  gest,
  onNavigate,
  consultasSub = null,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
  /** Sub-aba inicial do hub de Consultas (deep link vindo do marco da semana). */
  consultasSub?: string | null;
}) {
  // Suas consultas reais entram na MESMA linha do tempo dos marcos do pré-natal
  // (o calendário vira o lugar único: marcos recomendados + suas consultas).
  const [appts, setAppts] = useState<MyAppointment[]>([]);
  // Visão do mês (grade tipo Google) x Lista (linha do tempo). Mês é o padrão.
  const [mode, setMode] = useState<"mes" | "lista">("mes");
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedYmd, setSelectedYmd] = useState<string>(() => ymdLocal());
  useEffect(() => {
    (async () => {
      setAppts((await fetchAppointmentsCached()).appointments);
    })();
  }, []);

  if (!profile || (!profile.lmp_date && !profile.reference_date)) {
    return (
      <div className="rounded-3xl card-material p-8 text-center">
        <p className="text-muted-foreground">
          Configure a DUM ou os dados do ultrassom em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            Perfil
          </button>{" "}
          para gerar o calendário personalizado.
        </p>
      </div>
    );
  }

  const today = new Date();

  function downloadAllIcs() {
    const events: string[] = [];
    // DTSTAMP é obrigatório no VEVENT (RFC 5545); DTEND de evento all-day é
    // EXCLUSIVO — precisa ser o dia seguinte, senão o evento tem duração zero
    // e alguns clientes o descartam.
    const dtstamp = `${ymdLocal().replace(/-/g, "")}T000000Z`;
    PRENATAL_MILESTONES.forEach((m) => {
      const d = weekToDate(m.week, profile!);
      if (!d) return;
      const ymd = ymdLocal(d).replace(/-/g, "");
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const ymdEnd = ymdLocal(next).replace(/-/g, "");
      const lines = [
        "BEGIN:VEVENT",
        `UID:prenatal-${m.week}-${m.label.slice(0, 10).replace(/\s/g, "")}@doutorclovis`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${ymd}`,
        `DTEND;VALUE=DATE:${ymdEnd}`,
        `SUMMARY:Pré-natal S${m.week}: ${m.label}`,
        m.detail ? `DESCRIPTION:${m.detail}` : "",
        "END:VEVENT",
      ].filter(Boolean);
      events.push(...lines);
    });
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Obstetrica//Prenatal Calendar//PT-BR",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "prenatal-obstetrica.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Linha do tempo unificada: marcos do pré-natal + suas consultas reais,
  // ordenados por data (consultas canceladas/recusadas ficam de fora).
  type TLItem =
    | { kind: "milestone"; date: Date | null; m: Milestone }
    | { kind: "appt"; date: Date | null; a: MyAppointment };
  const items: TLItem[] = [
    ...PRENATAL_MILESTONES.map(
      (m): TLItem => ({ kind: "milestone", date: weekToDate(m.week, profile), m }),
    ),
    ...appts
      .filter((a) => a.status !== "cancelled" && a.status !== "declined")
      .map((a): TLItem => {
        const ds = a.confirmed_date ?? a.proposed_date ?? a.preferred_date;
        return { kind: "appt", date: ds ? new Date(`${ds}T00:00:00`) : null, a };
      }),
  ].sort((x, y) => {
    if (!x.date) return 1;
    if (!y.date) return -1;
    return x.date.getTime() - y.date.getTime();
  });

  // Eventos por dia (chave = YYYY-MM-DD local) para a grade do mês.
  const byDay = new Map<string, TLItem[]>();
  for (const it of items) {
    if (!it.date) continue;
    const key = ymdLocal(it.date);
    const arr = byDay.get(key);
    if (arr) arr.push(it);
    else byDay.set(key, [it]);
  }

  // Grade do mês visível: semanas começando no domingo (padrão Google/pt-BR).
  const yr = viewMonth.getFullYear();
  const mo = viewMonth.getMonth();
  const firstWeekday = new Date(yr, mo, 1).getDay(); // 0=dom
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayYmd = ymdLocal(today);
  const selectedEvents = byDay.get(selectedYmd) ?? [];

  function shiftMonth(delta: number) {
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className="space-y-5">
      {/* ── A grade das sete sub-telas vem PRIMEIRO (set/2026). Ela ficava no
          fim, depois de ~440 linhas de calendário: plano de parto, mala da
          maternidade, perguntas ao médico e teleconsulta só apareciam para
          quem rolava tudo — o padrão que o próprio arquivo já tinha registrado
          como defeito ("existiam sem que nada na tela dissesse que existiam"). */}
      <div>
        <p className="mb-4 font-serif text-[15px] font-semibold text-primary">Minhas consultas</p>
        <ConsultasHub profile={profile} gest={gest} initialSub={consultasSub} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-5">
        <div>
          <p className="font-serif text-[15px] font-semibold text-primary">Meu Calendário</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Marcos do pré-natal e suas consultas, no dia certo.
          </p>
        </div>
        <button
          onClick={downloadAllIcs}
          className="shrink-0 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          ↓ .ics
        </button>
      </div>

      {/* Alternância Mês / Lista */}
      <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-semibold">
        {(["mes", "lista"] as const).map((mkey) => (
          <button
            key={mkey}
            onClick={() => setMode(mkey)}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              mode === mkey ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {mkey === "mes" ? "Mês" : "Lista"}
          </button>
        ))}
      </div>

      {mode === "mes" ? (
        <>
          {/* Cabeçalho do mês + navegação */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Mês anterior"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary"
            >
              ‹
            </button>
            <p className="font-serif text-lg capitalize text-foreground">
              {viewMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Próximo mês"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary"
            >
              ›
            </button>
          </div>

          {/* Grade do mês */}
          <div className="rounded-3xl card-material p-3">
            <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const ymd = ymdLocal(new Date(yr, mo, day));
                const evs = byDay.get(ymd);
                const isToday = ymd === todayYmd;
                const isSelected = ymd === selectedYmd;
                const hasAppt = evs?.some((e) => e.kind === "appt");
                const hasMs = evs?.some((e) => e.kind === "milestone");
                return (
                  <button
                    key={ymd}
                    onClick={() => setSelectedYmd(ymd)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold"
                        : isToday
                          ? "bg-primary/10 font-bold text-primary"
                          : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    {day}
                    {evs && (
                      <span className="absolute bottom-1 flex gap-0.5">
                        {hasAppt && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`}
                          />
                        )}
                        {hasMs && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground/70" : "bg-emerald-500"}`}
                          />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Legenda */}
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Consulta
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Marco do pré-natal
              </span>
            </div>
          </div>

          {/* Eventos do dia selecionado */}
          <div>
            <p className="mb-2 text-sm font-semibold capitalize text-foreground">
              {new Date(`${selectedYmd}T00:00:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
            {selectedEvents.length === 0 ? (
              <p className="rounded-2xl card-material px-4 py-3 text-sm text-muted-foreground">
                Nada marcado neste dia.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((it, idx) => {
                  if (it.kind === "appt") {
                    const a = it.a;
                    const time = a.confirmed_time ?? a.proposed_time ?? a.preferred_time;
                    const st = APPT_STATUS[a.status] ?? APPT_STATUS.pending;
                    return (
                      <div
                        key={`d-appt-${a.id}`}
                        className="block w-full rounded-2xl border border-primary/40 bg-primary/5 p-3 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                            Sua consulta
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}
                          >
                            {st.label}
                          </span>
                          {time && (
                            <span className="text-xs text-muted-foreground">
                              {time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {a.reason || "Consulta"}
                        </p>
                      </div>
                    );
                  }
                  const m = it.m;
                  return (
                    <div key={`d-ms-${idx}`} className="rounded-2xl card-material p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TYPE_COLOR[m.type]}`}
                        >
                          {TYPE_LABEL[m.type]}
                        </span>
                        <span className="text-xs text-muted-foreground">Semana {m.week}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{m.label}</p>
                      {m.detail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{m.detail}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="relative space-y-3 pl-6">
          {/* Vertical line */}
          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />

          {items.map((it, idx) => {
            // ── Sua consulta real ──────────────────────────────────────
            if (it.kind === "appt") {
              const a = it.a;
              const time = a.confirmed_time ?? a.proposed_time ?? a.preferred_time;
              const st = APPT_STATUS[a.status] ?? APPT_STATUS.pending;
              return (
                <div
                  key={`appt-${a.id}`}
                  className="relative block w-full rounded-2xl border border-primary/40 bg-primary/5 p-4 text-left shadow-sm"
                >
                  <div className="absolute -left-4 top-5 h-3 w-3 rounded-full border-2 border-primary bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                      Sua consulta
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {a.reason || "Consulta"}
                  </p>
                  {it.date && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {it.date.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                      {time ? ` · ${time.slice(0, 5)}` : ""}
                    </p>
                  )}
                </div>
              );
            }

            // ── Marco do pré-natal ─────────────────────────────────────
            const m = it.m;
            const date = it.date;
            const isPast = date != null && date < today;
            const isUpcoming =
              !isPast && date != null && date.getTime() - today.getTime() < 21 * 86400000;

            return (
              <div
                key={`ms-${idx}`}
                className={`relative rounded-2xl border p-4 transition-all ${
                  isPast
                    ? "border-border bg-card opacity-60"
                    : isUpcoming
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border bg-card"
                }`}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute -left-4 top-5 h-3 w-3 rounded-full border-2 ${
                    isPast
                      ? "border-border bg-background"
                      : isUpcoming
                        ? "border-primary bg-primary"
                        : "border-primary/40 bg-background"
                  }`}
                />

                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TYPE_COLOR[m.type]}`}
                      >
                        {TYPE_LABEL[m.type]}
                      </span>
                      <span className="text-xs text-muted-foreground">Semana {m.week}</span>
                      {isPast && <span className="text-xs text-emerald-600">✓ concluído</span>}
                      {isUpcoming && !isPast && (
                        <span className="text-xs font-medium text-primary">Em breve!</span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-sm font-medium ${isPast ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {m.label}
                    </p>
                    {m.detail && <p className="mt-0.5 text-xs text-muted-foreground">{m.detail}</p>}
                    {date && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {date.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  {date && !isPast && (
                    <a
                      href={toGoogleCalUrl(m.label, date)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full border border-primary/30 px-3 py-1 text-xs text-primary hover:bg-primary/5"
                    >
                      + Agenda
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Contrações ---------- */

type Contraction = {
  id: string;
  started_at: string;
  ended_at: string | null;
  intensity: number;
};

const INTENSITY_LABEL = ["", "Leve", "Moderada", "Forte"];
const INTENSITY_COLOR = [
  "",
  "bg-secondary text-primary",
  "bg-primary/10 text-primary",
  "bg-rose-100 text-rose-700",
];

/**
 * ⚠️ `weeks` NÃO É DECORATIVO — ele era descartado, e isso custava caro.
 *
 * A função só olhava intervalo e duração médios. Uma paciente de 28 semanas com
 * contrações a cada 12 minutos lia "Padrão normal"; a cada 8, "Atenção — monitore
 * de perto". E `triage.ts` lista "Contrações regulares antes de 37 semanas" como
 * sintoma VERMELHO: a mesma paciente, respondendo a triagem, receberia "procure
 * atendimento agora". Duas telas do mesmo app dizendo coisas opostas sobre o
 * mesmo quadro — e a que ela abre com o cronômetro na mão era a que
 * tranquilizava.
 *
 * A régua nova mora em `sinais-clinicos.ts`, com as outras, porque CLAUDE.md é
 * explícito: nunca duplique um limite clínico fora daquele arquivo.
 */
function analyzeContractions(
  list: Contraction[],
  weeks: number | null,
): {
  status: "normal" | "atencao" | "alerta" | "urgente";
  label: string;
  detail: string;
} {
  if (list.length < 2)
    return {
      status: "normal",
      label: "Monitorando",
      detail: "Registre mais contrações para análise do padrão.",
    };

  const completed = list.filter((c) => c.ended_at != null);
  if (completed.length < 2)
    return { status: "normal", label: "Monitorando", detail: "Continue registrando." };

  // Average duration (seconds)
  const avgDur =
    completed.reduce((sum, c) => {
      const dur = (new Date(c.ended_at!).getTime() - new Date(c.started_at).getTime()) / 1000;
      return sum + dur;
    }, 0) / completed.length;

  // Average interval between contractions (minutes)
  const sorted = [...list].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const interval =
      (new Date(sorted[i].started_at).getTime() - new Date(sorted[i - 1].started_at).getTime()) /
      60000;
    intervals.push(interval);
  }
  const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;

  /* ─── PREMATURIDADE VEM ANTES DE TUDO ────────────────────────────────────
     Antes das 37 semanas, contração regular é sinal vermelho independentemente
     de quão "leve" o padrão parece — e é justamente o padrão leve que a régua
     de trabalho de parto classificaria como normal. Por isso este teste vem
     PRIMEIRO: ele não pode ser alcançado só depois de a paciente passar pelos
     cortes de parto ativo. */
  const prematuro = sinalContracoesPrematuras({ semanas: weeks, intervaloMin: avgInterval });
  if (prematuro)
    return {
      status: "urgente",
      label: "⚠️ Ligue para o seu médico agora",
      detail: `${prematuro.nota} Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s.`,
    };

  if (avgInterval <= 3 && avgDur >= 60)
    return {
      status: "urgente",
      label: "⚠️ Vá para a maternidade agora",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — trabalho de parto avançado.`,
    };
  if (avgInterval <= 5 && avgDur >= 45)
    return {
      status: "alerta",
      label: "Trabalho de parto ativo",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — ligue para o consultório.`,
    };
  if (avgInterval <= 10 && avgDur >= 30)
    return {
      status: "atencao",
      label: "Atenção — padrão irregular",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — monitore de perto.`,
    };
  return {
    status: "normal",
    label: "Padrão normal",
    detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s.`,
  };
}

function ContracoesTab({ weeks }: { weeks: number | null }) {
  /* `weeks` é lido de verdade agora — ver `analyzeContractions`. */
  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [active, setActive] = useState<Contraction | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [intensity, setIntensity] = useState(2);
  const startRef = useRef<number>(0);
  /* ⚠️ A LEITURA FALHANDO SUPRIMIA O BOTÃO DO 192.
     `data ?? []` transformava erro de rede em "ela não cronometrou nada", e o
     banner de análise — que é o que mostra "Ligar 192 (SAMU)" no caso urgente
     — vive atrás de `analysisWindow.length >= 2`. Com a lista vazia ele
     simplesmente não renderiza: o alerta de emergência era silenciado por uma
     falha de rede, em trabalho de parto.
     E a contração ABERTA não era retomada: o cronômetro voltava para "Iniciar"
     com uma contração em curso no banco. */
  const [instavel, setInstavel] = useState(false);

  async function load() {
    const { data, error } = await (supabase as any)
      .from("contraction_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(30);
    if (error || !data) {
      setInstavel(true);
      return;
    }
    setInstavel(false);
    setContractions(data);
    // Resume active contraction if exists (no ended_at)
    const open = (data as Contraction[]).find((c) => !c.ended_at);
    if (open) {
      setActive(open);
      startRef.current = new Date(open.started_at).getTime();
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  async function startContraction() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await (supabase as any)
      .from("contraction_logs")
      .insert({ user_id: u.user.id, intensity })
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível registrar a contração. Tente novamente.");
      return;
    }
    setActive(data);
    startRef.current = Date.now();
    setElapsed(0);
    load();
  }

  async function stopContraction() {
    if (!active) return;
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) {
      toast.error("Não foi possível salvar a contração. Tente novamente.");
      return;
    }
    setActive(null);
    setElapsed(0);
    /**
     * ⚠️ O TIQUE DO FIM DA CONTRAÇÃO, e ele é o caso de mão ocupada.
     *
     * Ela está cronometrando DOR: olhar a tela para confirmar que o toque
     * pegou é exatamente o que ela menos consegue fazer nesse minuto. Um tique
     * de cinquenta milissegundos diz "marquei" sem pedir os olhos.
     *
     * ⚠️ A espécie existia declarada, justificada e SEM NENHUM CHAMADOR — a
     * mesma família de `proximoDesbloqueio` e `escadaDeTrofeus`. Uma revisão
     * adversarial a achou.
     *
     * `emSessao` porque o cronômetro É uma sessão que ela abriu: o toque que
     * marca o fim é dela, mas o portão de gesto é generoso demais para
     * depender de milissegundos aqui.
     */
    /* ⚠️ Sem `careMode` aqui: este componente não o recebe, e o cronômetro de
       contrações é justamente uma tela que continua valendo no Modo Cuidado —
       quem perdeu a gestação pode estar em trabalho de parto. `podeSoar` já
       barra o resto; este som é sobre o corpo dela, não sobre o bebê. */
    tocarSomDeUI("intervalo", { emSessao: true });
    load();
  }

  /* ⚠️ A confirmação vive na TELA — ver `ApagarConversas`, que carrega a razão
     inteira: no app instalado o `window.confirm` abre com o nome do domínio, e
     a decisão do dono é confirmação em mensagem separada. */
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

  async function clearSession() {
    setConfirmandoLimpar(false);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .delete()
      .eq("user_id", u.user.id);
    if (error) {
      toast.error("Não foi possível limpar o histórico. Tente novamente.");
      return;
    }
    setActive(null);
    load();
  }

  const elapsedSecs = Math.floor(elapsed / 1000);
  const elapsedMins = Math.floor(elapsedSecs / 60);
  const recentContractions = contractions.slice(0, 10);
  // Análise/banner consideram apenas contrações das últimas 2 horas,
  // para não manter alertas urgentes presos com dados antigos.
  const ANALYSIS_WINDOW_MS = 2 * 3600000;
  const analysisWindow = contractions
    .filter((c) => Date.now() - new Date(c.started_at).getTime() < ANALYSIS_WINDOW_MS)
    .slice(0, 10);
  const analysis = analyzeContractions(analysisWindow, weeks);

  const statusStyle: Record<string, string> = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
    atencao: "border-primary/20 bg-primary/6 text-foreground",
    alerta: "border-rose-200 bg-rose-50 text-rose-800",
    urgente: "border-rose-400 bg-rose-100 text-rose-900",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm text-foreground">
        Use este diário se sentir contrações regulares.{" "}
        <strong>Em dúvida, ligue para o consultório.</strong> Em emergência, ligue{" "}
        <strong>192 (SAMU)</strong>.
      </div>

      {/* ⚠️ O AVISO QUE SUBSTITUI O SILÊNCIO.
          Sem ele, a falha de leitura apagava o banner de análise — inclusive o
          caso `urgente`, que é o único lugar desta tela com o botão do SAMU. O
          app não pode INVENTAR uma análise que não tem; o que ele pode, e
          deve, é dizer que não conseguiu ler E dar o caminho que a análise
          daria. Errar para o lado de mandar ligar é o único lado seguro aqui. */}
      {instavel && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900">
          <p className="font-semibold">Não consegui carregar suas contrações agora</p>
          <p className="mt-0.5 text-sm">
            Isso é a nossa conexão — o que você já cronometrou continua salvo.{" "}
            <strong>
              Se as contrações estão regulares e fortes, não espere o app: ligue para o seu médico
              ou para o 192.
            </strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void load()}
              className="min-h-11 rounded-full border border-rose-300 px-5 py-2 text-sm font-medium"
            >
              Tentar de novo
            </button>
            <a
              href="tel:192"
              className="inline-flex min-h-11 items-center rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          </div>
        </div>
      )}

      {/* Analysis banner */}
      {!instavel && analysisWindow.length >= 2 && (
        <div className={`rounded-2xl border p-4 ${statusStyle[analysis.status]}`}>
          <p className="font-semibold">{analysis.label}</p>
          <p className="mt-0.5 text-sm">{analysis.detail}</p>
          {analysis.status === "urgente" && (
            <a
              href="tel:192"
              className="mt-3 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          )}
        </div>
      )}

      {/* Main button */}
      <div className="rounded-3xl card-material p-8 text-center">
        <p className="font-serif text-[15px] font-semibold text-primary">
          Cronômetro de contrações
        </p>

        {/* Intensity selector */}
        {!active && (
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setIntensity(i)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  intensity === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {INTENSITY_LABEL[i]}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {active ? (
            <div>
              <button
                onClick={stopContraction}
                className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-300 active:scale-95"
                style={{
                  background: "radial-gradient(circle at 30% 25%, #fb7185, #e11d48 70%)",
                }}
              >
                <div>
                  <div className="font-serif text-4xl">
                    {String(elapsedMins).padStart(2, "0")}:
                    {String(elapsedSecs % 60).padStart(2, "0")}
                  </div>
                  <div className="text-xs uppercase tracking-widest opacity-80 mt-1">
                    Toque p/ parar
                  </div>
                </div>
              </button>
              <p className="mt-3 text-sm font-medium text-rose-600 animate-pulse">
                Contração ativa…
              </p>
            </div>
          ) : (
            <button
              onClick={startContraction}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 78%, white), var(--primary) 70%)",
              }}
            >
              <div>
                <div className="text-lg font-medium">Iniciar</div>
                <div className="text-xs uppercase tracking-widest opacity-80 mt-1">contração</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* History table */}
      {recentContractions.length > 0 && (
        <div className="rounded-3xl card-material p-6">
          <div className="flex items-center justify-between">
            <p className="font-serif text-[15px] font-semibold text-muted-foreground">
              Últimas contrações
            </p>
            <button
              onClick={() => setConfirmandoLimpar(true)}
              className="press min-h-11 px-1 text-xs text-muted-foreground hover:text-destructive"
            >
              Limpar sessão
            </button>
          </div>
          {confirmandoLimpar && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3">
              <p className="text-[13px] leading-snug text-rose-900">
                Apagar todo o histórico de contrações? Isto não tem volta.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={clearSession}
                  className="press min-h-11 flex-1 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white"
                >
                  Sim, apagar
                </button>
                <button
                  onClick={() => setConfirmandoLimpar(false)}
                  className="press min-h-11 flex-1 rounded-full border border-border px-4 text-sm font-medium"
                >
                  Não
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {recentContractions.map((c, idx) => {
              const dur = c.ended_at
                ? Math.round(
                    (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000,
                  )
                : null;
              const interval =
                idx < recentContractions.length - 1
                  ? Math.round(
                      (new Date(c.started_at).getTime() -
                        new Date(recentContractions[idx + 1].started_at).getTime()) /
                        60000,
                    )
                  : null;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(c.started_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${INTENSITY_COLOR[c.intensity] ?? ""}`}
                  >
                    {INTENSITY_LABEL[c.intensity] ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {dur != null ? `${dur}s` : "ativa"}
                    {interval != null && ` · intervalo ${interval}min`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Pré-consulta Inteligente ---------- */

const PRE_CONSULT_SYMPTOMS = [
  "Náuseas ou vômitos",
  "Dor de cabeça",
  "Inchaço nos pés",
  "Dor lombar",
  "Sangramento",
  "Redução de movimentos",
  "Tontura",
  "Febre",
  "Dificuldade para dormir",
  "Cansaço excessivo",
];

const EMOTIONAL_OPTIONS = [
  { value: "otima", label: "Ótima 😊" },
  { value: "bem", label: "Bem 🙂" },
  { value: "ansiosa", label: "Ansiosa 😰" },
  { value: "cansada", label: "Cansada 😴" },
  { value: "triste", label: "Triste 😢" },
];

function PreConsultaTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const [form, setForm] = useState({
    weight: "",
    systolic: "",
    diastolic: "",
    symptoms: [] as string[],
    medications: "",
    questions: "",
    emotional_state: "",
    other_notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<PreConsultaForm[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  async function loadHistory() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const forms = await getMyPreConsultas({ data: { accessToken: s.session.access_token } });
    setHistory(forms);
  }
  useEffect(() => {
    loadHistory();
  }, []);

  function toggleSymptom(s: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s) ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const res = await submitPreConsulta({
        data: {
          accessToken: s.session.access_token,
          weeks: gest?.weeks ?? null,
          ...form,
        },
      });
      if (!res.ok) {
        toast.error("Não foi possível enviar. Tente novamente.");
        return;
      }
      setDone(true);
      loadHistory();
    } catch {
      toast.error("Não foi possível enviar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-10 text-center">
        <p className="text-4xl">✓</p>
        <h2 className="mt-3 font-serif text-2xl text-emerald-800">Formulário enviado!</h2>
        <p className="mt-2 text-sm text-emerald-700">
          Seu médico receberá seu resumo antes da consulta. Pode chegar com tranquilidade!
        </p>
        <button
          onClick={() => {
            setDone(false);
            setForm({
              weight: "",
              systolic: "",
              diastolic: "",
              symptoms: [],
              medications: "",
              questions: "",
              emotional_state: "",
              other_notes: "",
            });
          }}
          className="mt-5 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white"
        >
          Preencher novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <strong>Para o seu médico:</strong> preencha antes de cada consulta. Seu resumo chega
        formatado para o médico — sem precisar lembrar de tudo na hora!
        {gest && (
          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Semana {gest.weeks}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Emotional state */}
        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Como você está se sentindo?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EMOTIONAL_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, emotional_state: o.value }))}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  form.emotional_state === o.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vitals */}
        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Medidas desta semana</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field
              label="Peso atual (kg)"
              type="number"
              value={form.weight}
              onChange={(v) => setForm((f) => ({ ...f, weight: v }))}
            />
            <Field
              label="Pressão sistólica"
              type="number"
              value={form.systolic}
              onChange={(v) => setForm((f) => ({ ...f, systolic: v }))}
            />
            <Field
              label="Pressão diastólica"
              type="number"
              value={form.diastolic}
              onChange={(v) => setForm((f) => ({ ...f, diastolic: v }))}
            />
          </div>
        </div>

        {/* Symptoms */}
        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Sintomas desde a última consulta</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PRE_CONSULT_SYMPTOMS.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  form.symptoms.includes(s) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.symptoms.includes(s)}
                  onChange={() => toggleSymptom(s)}
                  className="h-4 w-4"
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        {/* Open questions */}
        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Medicamentos em uso</p>
          <textarea
            value={form.medications}
            onChange={(e) => setForm((f) => ({ ...f, medications: e.target.value }))}
            rows={2}
            placeholder="Ex.: Sulfato ferroso, ácido fólico, vitamina D…"
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Perguntas para o médico</p>
          <textarea
            value={form.questions}
            onChange={(e) => setForm((f) => ({ ...f, questions: e.target.value }))}
            rows={3}
            placeholder="Anote suas dúvidas aqui — elas chegam direto para o seu médico antes da consulta."
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Algo mais a relatar?</p>
          <textarea
            value={form.other_notes}
            onChange={(e) => setForm((f) => ({ ...f, other_notes: e.target.value }))}
            rows={2}
            placeholder="Algo incomum que notou, mudança no bebê, preocupação específica…"
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Enviando…" : "Enviar para o médico"}
        </button>
      </form>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showHistory ? "▲ Ocultar" : "▼ Ver"} formulários anteriores ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-3">
              {history.map((h) => (
                <div key={h.id} className="rounded-2xl card-material p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      Semana {h.weeks_at_submission ?? "—"} —{" "}
                      {new Date(h.submitted_at).toLocaleDateString("pt-BR")}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${h.seen_by_doctor ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}
                    >
                      {h.seen_by_doctor ? "Visualizado ✓" : "Aguardando"}
                    </span>
                  </div>
                  {h.questions && <p className="mt-2 text-muted-foreground">{h.questions}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Nutrição Tab ---------- */

const NUTRIENT_TIPS: Record<1 | 2 | 3, { nutrient: string; why: string; foods: string }[]> = {
  1: [
    {
      nutrient: "Ácido Fólico",
      why: "Previne defeitos do tubo neural",
      foods: "Feijão, lentilha, espinafre, brócolis",
    },
    {
      nutrient: "Ferro",
      why: "Suporte ao volume de sangue",
      foods: "Carne vermelha magra, feijão + vitamina C",
    },
    { nutrient: "Vitamina B6", why: "Alivia enjoo matinal", foods: "Banana, batata, frango, atum" },
    {
      nutrient: "Água",
      why: "Hidratação e redução do enjoo",
      foods: "8–10 copos/dia; água de coco, chás claros",
    },
  ],
  2: [
    {
      nutrient: "Cálcio",
      why: "Formação óssea do bebê",
      foods: "Leite, iogurte, sardinha, brócolis",
    },
    {
      nutrient: "Ômega-3",
      why: "Desenvolvimento do cérebro fetal",
      foods: "Salmão, sardinha, sementes de chia, linhaça",
    },
    {
      nutrient: "Proteína",
      why: "Crescimento muscular e placentário",
      foods: "Ovos, frango, leguminosas, queijos pasteurizados",
    },
    {
      nutrient: "Vitamina D",
      why: "Absorção de cálcio e imunidade",
      foods: "Ovos, cogumelos, exposição solar moderada",
    },
  ],
  3: [
    {
      nutrient: "Fibras",
      why: "Combate a constipação",
      foods: "Aveia, ameixa, mamão, folhas verdes",
    },
    {
      nutrient: "Magnésio",
      why: "Reduz câimbras nas pernas",
      foods: "Castanha-do-pará, banana, sementes de abóbora",
    },
    {
      nutrient: "Ferro",
      why: "Preparo para o parto",
      foods: "Fígado (cozido), feijão preto, espinafre",
    },
    {
      nutrient: "Vitamina C",
      why: "Aumenta absorção do ferro",
      foods: "Acerola, laranja, morango, kiwi",
    },
  ],
};

const NUTRITION_CHIPS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Como controlar o enjoo com alimentação?",
    "Quais alimentos evitar no 1º trimestre?",
    "Posso tomar suplemento de ácido fólico junto com a alimentação?",
    "O que comer quando não tenho apetite?",
  ],
  2: [
    "Quanta proteína preciso por dia?",
    "Posso comer salmão? Qual a frequência ideal?",
    "Como garantir cálcio suficiente sem laticínios?",
    "O que comer antes e depois de uma caminhada?",
  ],
  3: [
    "Como evitar a constipação no final da gestação?",
    "Tenho muita azia — o que posso comer?",
    "Qual o melhor lanche noturno para não acordar com fome?",
    "Posso comer tâmara para preparar o parto?",
  ],
};

/** Mesma preferência que o chat principal respeita. */
function semAnimacaoNutricao(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function NutricaoTab({
  profile,
  gest,
  careMode = false,
}: {
  profile: Profile | null;
  gest: Gest;
  /** Mesma razão do Chat IA: em Modo Cuidado, nada de semana nem trimestre. */
  careMode?: boolean;
}) {
  const trimester = gest ? trimesterForWeek(gest.weeks) : 2;
  const tips = NUTRIENT_TIPS[trimester as 1 | 2 | 3];
  const chips = NUTRITION_CHIPS[trimester as 1 | 2 | 3];
  const firstName = profile?.display_name?.split(" ")[0];

  const greeting = [
    firstName ? `Olá, ${firstName}!` : "Olá!",
    // Mesma regra do Chat IA: em Modo Cuidado, nada de semana nem trimestre.
    !careMode && gest
      ? `No ${trimester}º trimestre, vou focar nas necessidades da semana ${gest.weeks}.`
      : "",
    careMode
      ? "Sou sua nutricionista virtual. Estou aqui para o que você precisar sobre alimentação."
      : "Sou sua nutricionista gestacional virtual. Como posso ajudar com sua alimentação hoje?",
  ]
    .filter(Boolean)
    .join(" ");

  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /* ─── O 👎 QUE NÃO EXISTIA AQUI ────────────────────────────────────────────
     Este chat clínico não tinha nenhum caminho de correção: o que saísse errado
     ficava entre a IA e a paciente, para sempre. O chat principal tem
     `submitBrainFeedback` em três lugares; este tinha zero.
     Mesma função, mesma fila de revisão do médico — o 👎 daqui chega no mesmo
     lugar que o de lá, e é isso que fecha o ciclo. */
  /* ⚠️ TRÊS ESTADOS, e não um booleano. `true` = 👍; `false` = 👎 que o
     servidor NÃO confirmou ter enfileirado; `"fila"` = 👎 que chegou ao
     médico. A tela prometia "seu médico vai ver" incondicionalmente — e
     `submitBrainFeedback` devolve `{ ok: false }` numa resposta 200 NORMAL, e
     só enfileira quando há `entryId` (a cota pode ter estourado, o cérebro
     pode estar desligado, a pergunta pode ser suporte puro). Ela reclamava de
     uma orientação alimentar errada, lia que o médico ia ver, e o item podia
     não ter entrado em fila nenhuma.
     ⚠️ O chat principal já tinha exatamente esta correção, com o comentário do
     conserto à vista — a régua aplicada num lugar e deixada de pé no vizinho. */
  const [votos, setVotos] = useState<Record<number, boolean | "fila">>({});

  async function votar(indice: number, gostou: boolean) {
    if (votos[indice] !== undefined) return;
    setVotos((v) => ({ ...v, [indice]: gostou }));
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const r = await submitBrainFeedback({
        data: {
          accessToken: sess.session.access_token,
          /* A PERGUNTA DELA, não a resposta: é ela que o médico precisa ler
             para entender o que foi perguntado e onde o cérebro falhou. */
          question: messages[indice - 1]?.content ?? "",
          answer: messages[indice]?.content ?? "",
          helpful: gostou,
        },
      });
      /* Só promete quando o servidor confirma que enfileirou. */
      if (!gostou && r?.ok && "chegouAoMedico" in r && r.chegouAoMedico) {
        setVotos((v) => ({ ...v, [indice]: "fila" }));
        toast("Anotado — seu médico vai ver 💛");
      } else if (!gostou) {
        toast("Anotado 💛");
      }
    } catch {
      /* O voto já está na tela; insistir com um erro sobre um 👍 seria pior
         que perder o 👍. */
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const uiMessages = next.map((m, i) => ({
        id: String(i),
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }));
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // O endpoint agora exige sessão: era proxy aberto para o Gemini.
          Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ messages: uiMessages }),
      });
      /* `res.ok` ANTES do corpo — e isto era um "..." eterno.
         O código checava só `!res.body`, e 429 (limitador), 401 (sessão) e o
         500 de chave ausente TÊM corpo: o laço lia texto sem prefixo `data: `,
         `acc` ficava vazio, e a bolha renderizava `{m.content || "…"}` para
         sempre — sem erro, sem retry, sem nada dizendo o que houve. É o mesmo
         defeito que o chat principal e o widget do site já corrigiram; este
         ficou. */
      if (!res.ok) {
        const corpo = await res.text().catch(() => "");
        throw new Error(avisoQuePodeAparecer(corpo) ?? "");
      }
      if (!res.body) throw new Error("");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let erroNoFluxo = "";
      let buffer = "";
      setMessages([...next, { role: "assistant", content: "" }]);

      /* A MESMA CADÊNCIA DO CHAT PRINCIPAL.
         A paciente usa Chat IA e Nutrição na MESMA tela, trocando de aba —
         dois ritmos diferentes leem como dois produtos. E aqui o texto vinha
         em bloco por pedaço, que é exatamente o "nada, nada, parágrafo
         inteiro" que a régua existe para consertar. */
      let mostrado = 0;
      let aberto = true;
      let quadro: number | null = null;
      const desenhar = () => {
        const passo = passoDaDigitacao(acc.length - mostrado, aberto);
        if (passo > 0) {
          mostrado = Math.min(acc.length, mostrado + passo);
          setMessages([...next, { role: "assistant", content: acc.slice(0, mostrado) }]);
        }
        quadro = aberto || mostrado < acc.length ? requestAnimationFrame(desenhar) : null;
      };
      if (!semAnimacaoNutricao()) quadro = requestAnimationFrame(desenhar);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        /* BUFFER de linha, como no chat principal. Sem `{stream: true}` e sem
           carry-over, um `data:` partido entre dois `read()` some do meio da
           resposta — e acento partido vira "�". */
        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split("\n");
        buffer = linhas.pop() ?? "";
        /* O MESMO leitor do chat principal. Duas cópias de um parser divergem,
           e foi assim que a parte `error` ficou sem ser lida aqui: falha do
           provedor depois do HTTP 200 continuava virando bolha vazia. */
        linhas.forEach((line) => {
          const parte = lerLinhaDoStream(line);
          if (parte.tipo === "texto") acc += parte.texto;
          else if (parte.tipo === "erro") erroNoFluxo = parte.texto;
        });
        if (semAnimacaoNutricao()) {
          mostrado = acc.length;
          setMessages([...next, { role: "assistant", content: acc }]);
        }
      }
      (buffer + decoder.decode()).split("\n").forEach((line) => {
        const parte = lerLinhaDoStream(line);
        if (parte.tipo === "texto") acc += parte.texto;
        else if (parte.tipo === "erro") erroNoFluxo = parte.texto;
      });
      aberto = false;
      if (erroNoFluxo && !acc.trim()) {
        if (quadro !== null) cancelAnimationFrame(quadro);
        throw new Error(erroNoFluxo);
      }
      /* Espera o texto terminar de aparecer antes de liberar o "digitando" —
         senão o indicador some com a bolha pela metade. */
      await new Promise<void>((r) => {
        const conferir = () => (mostrado >= acc.length ? r() : setTimeout(conferir, 60));
        conferir();
      });
      setMessages([...next, { role: "assistant", content: acc }]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          /* O aviso do servidor manda quando existe: ele sabe o que houve
             (limite de mensagens, sessão vencida) e a tela não. */
          content: (e as Error)?.message?.trim() || "Desculpe, ocorreu um erro. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── O CARTÃO DE NUTRIENTES SOME EM MODO CUIDADO ──────────────────
          "Formação óssea do bebê" e "Desenvolvimento do cérebro fetal" são o
          conteúdo dele. Eu tinha calado só a saudação e deixado a tela inteira
          falando do bebê logo abaixo. */}
      {!careMode && (
        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Nutrientes em destaque — {trimester}º trimestre</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {tips.map((t) => (
              <div
                key={t.nutrient}
                className="rounded-2xl border border-border bg-secondary/40 p-3"
              >
                <p className="text-sm font-semibold text-primary">{t.nutrient}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.why}</p>
                <p className="mt-1 text-xs">{t.foods}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex flex-col rounded-3xl card-material" style={{ height: "55vh" }}>
        <div className="border-b border-border p-4">
          <p className="font-serif text-lg">Nutricionista Virtual</p>
          <p className="text-xs text-muted-foreground">
            {careMode
              ? "Orientações de alimentação para você — não substitui avaliação nutricional individual."
              : "Orientações personalizadas para sua gestação — não substitui avaliação nutricional individual."}
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {m.content || "…"}
                {/* Só nas respostas da IA, e não na saudação (i > 0). */}
                {m.role === "assistant" && i > 0 && m.content && (
                  <div className="mt-1.5 flex items-center gap-2">
                    {votos[i] !== undefined ? (
                      <span className="text-xs text-muted-foreground">
                        {votos[i] === true
                          ? "Obrigada 💛"
                          : votos[i] === "fila"
                            ? "Anotado — seu médico vai ver"
                            : "Anotado 💛"}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => votar(i, true)}
                          aria-label="Esta resposta ajudou"
                          className="text-xs opacity-50 hover:opacity-100"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => votar(i, false)}
                          aria-label="Esta resposta não ajudou"
                          className="text-xs opacity-50 hover:opacity-100"
                        >
                          👎
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões: em Modo Cuidado somem. NUTRITION_CHIPS traz "Posso comer
            tâmara para preparar o parto?" e coisas do tipo. */}
        {!careMode && messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:bg-secondary/70"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 border-t border-border p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={
              careMode ? "Pergunte sobre alimentação…" : "Pergunte sobre alimentação na gestação…"
            }
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm"
          />
          <button
            onClick={() => send()}
            disabled={loading}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Consultas Tab (Feature #2 — Transcrição IA) ---------- */

type ConsultaNote = {
  id: string;
  recorded_at: string;
  title: string | null;
  raw_transcript: string | null;
  orientacoes: string | null;
  medicamentos: string | null;
  proximos_exames: string | null;
  proxima_consulta: string | null;
};

type TranscribeResult = {
  ok: boolean;
  transcript?: string;
  titulo?: string;
  orientacoes?: string[];
  medicamentos?: string[];
  proximos_exames?: string[];
  proxima_consulta?: string | null;
  error?: string;
};

/* Rótulo/estilo por status da consulta — o mesmo vocabulário do painel. */
const APPT_STATUS_UI: Record<
  MyAppointment["status"],
  { label: string; cls: string; emoji: string }
> = {
  confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-700", emoji: "✅" },
  pending: { label: "Aguardando confirmação", cls: "bg-amber-100 text-amber-700", emoji: "⏳" },
  done: { label: "Realizada", cls: "bg-slate-100 text-slate-500", emoji: "✔️" },
  cancelled: { label: "Não confirmada", cls: "bg-rose-100 text-rose-600", emoji: "✖️" },
  counter_proposed: {
    label: "Horário sugerido — responda",
    cls: "bg-violet-100 text-violet-700",
    emoji: "🗓️",
  },
  declined: { label: "Você recusou", cls: "bg-rose-100 text-rose-600", emoji: "✖️" },
};

function formatApptDate(ymd: string): string {
  const s = new Date(ymd + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  // Só a primeira letra maiúscula ("Sexta-feira, 17 de julho") — a classe
  // capitalize deixaria cada palavra maiúscula ("17 De Julho").
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Fila de espera: quando não há horário na semana, a paciente entra na fila.
 * Se abrir vaga (alguém cancela), ela recebe uma OFERTA com prazo de resposta —
 * aceita ou recusa aqui. Se não responder no prazo, passa pra próxima.
 */
/**
 * Hub "Consultas": junta agenda + preparo + teleconsulta numa tela só, com
 * sub-abas. Antes: Consultas, Pré-consulta, Perguntas, Checklist, Plano de
 * Parto, Teleconsulta (6 abas). Agora: 1.
 */

export const CONSULTAS_SUBTABS = [
  {
    key: "agenda",
    label: "Agenda",
    sub: "Marcar e remarcar",
    Icon: CalendarCheck,
    imagem: ARTE_GRADE.agenda,
    caixa: "border-sky-200/70 from-sky-50 to-blue-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "preparo",
    label: "Preparar",
    sub: "O que levar e contar",
    Icon: ClipboardList,
    imagem: ARTE_GRADE.preparo,
    caixa: "border-violet-200/70 from-violet-50 to-fuchsia-50/60",
    tinta: "text-violet-600",
  },
  {
    key: "perguntas",
    label: "Perguntas",
    sub: "Anote para a consulta",
    Icon: MessageCircleQuestion,
    imagem: ARTE_GRADE.perguntas,
    caixa: "border-amber-200/70 from-amber-50 to-yellow-50/60",
    tinta: "text-amber-600",
  },
  {
    key: "checklist",
    label: "Checklist",
    sub: "A mala da maternidade",
    Icon: ListChecks,
    imagem: ARTE_GRADE.checklist,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
  },
  {
    key: "parto",
    label: "Plano de parto",
    sub: "Suas preferências",
    Icon: Scroll,
    imagem: ARTE_GRADE.parto,
    caixa: "border-pink-200/70 from-pink-50 to-rose-50/60",
    tinta: "text-pink-600",
  },
  {
    key: "tele",
    label: "Teleconsulta",
    sub: "Consulta por vídeo",
    Icon: Video,
    imagem: ARTE_GRADE.tele,
    caixa: "border-indigo-200/70 from-indigo-50 to-violet-50/60",
    tinta: "text-indigo-600",
  },
  {
    key: "particular",
    label: "Particular",
    sub: "Particular e pagamento",
    Icon: Wallet,
    imagem: ARTE_GRADE.particular,
    caixa: "border-teal-200/70 from-teal-50 to-emerald-50/60",
    tinta: "text-teal-600",
  },
] as const;

type ConsultasSub = (typeof CONSULTAS_SUBTABS)[number]["key"];

function isConsultasSub(v: unknown): v is ConsultasSub {
  return CONSULTAS_SUBTABS.some((s) => s.key === v);
}

function ConsultasHub({
  profile,
  gest,
  initialSub = null,
}: {
  profile: Profile | null;
  gest: Gest;
  initialSub?: string | null;
}) {
  /* Começa NA GRADE, e não na Agenda: o calendário logo acima já mostra o que
     a Agenda mostraria, e abrir direto nela escondia as outras seis telas
     exatamente como a fileira de pílulas escondia. Deep link continua abrindo
     na sub-aba pedida. */
  const [sub, setSub] = useState<ConsultasSub | null>(
    isConsultasSub(initialSub) ? initialSub : null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  // Deep link (marco da semana → "Plano de parto"/"Checklist"): troca a sub-aba
  // e rola até o hub, senão a paciente abre o calendário e não vê que mudou.
  useEffect(() => {
    if (!isConsultasSub(initialSub)) return;
    setSub(initialSub);
    const t = setTimeout(
      () => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      120,
    );
    return () => clearTimeout(t);
  }, [initialSub]);
  const atual = CONSULTAS_SUBTABS.find((s) => s.key === sub);
  if (!sub || !atual) {
    return (
      <div ref={rootRef}>
        <GradeHub itens={CONSULTAS_SUBTABS} onAbrir={(k) => setSub(k as ConsultasSub)} />
      </div>
    );
  }
  return (
    <div ref={rootRef} className="space-y-5">
      <VoltarDaGrade rotulo={atual.label} ladrilho={atual} onVoltar={() => setSub(null)} />
      <Fade key={sub}>
        {sub === "agenda" && <ConsultasTab />}
        {sub === "preparo" && <PreConsultaTab profile={profile} gest={gest} />}
        {sub === "perguntas" && <QuestionsTab gest={gest} />}
        {sub === "checklist" && <ChecklistTab gest={gest} />}
        {sub === "parto" && <PlanoPártoTab profile={profile} />}
        {sub === "tele" && <TeleconsultaTab profile={profile} />}
        {sub === "particular" && <ConsultaParticularTab profile={profile} />}
      </Fade>
    </div>
  );
}

function WaitlistCard() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [week, setWeek] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await getMyWaitlist({ data: { accessToken: s.session.access_token } });
    if (res.ok) setEntries(res.entries);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function join() {
    if (busy || !week) return;
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setBusy(false);
      return;
    }
    const res = await joinWaitlist({
      data: { accessToken: s.session.access_token, weekStart: mondayOf(week) },
    });
    if (res.ok) {
      toast(res.already ? "Você já estava na fila dessa semana." : "Você entrou na fila 💛");
      setWeek("");
      await load();
    } else {
      toast(res.error ?? "Não foi possível entrar na fila");
    }
    setBusy(false);
  }

  async function leave(id: string) {
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    if (s.session) {
      const res = await leaveWaitlist({ data: { accessToken: s.session.access_token, id } });
      /* Recarregar a lista já mostraria a verdade — mas só para quem repara
         que o item continuou lá. Um aviso é o que separa "não funcionou" de
         "achei que tinha saído". */
      if (!res?.ok) toast("Não foi possível sair da fila. Tente de novo.");
      await load();
    }
    setBusy(false);
  }

  async function respond(id: string, accept: boolean) {
    if (busy) return;
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setBusy(false);
      return;
    }
    const res = await respondWaitlistOffer({
      data: { accessToken: s.session.access_token, id, accept },
    });
    if (res.ok) toast(accept ? "Vaga confirmada! ✅" : "Vaga recusada.");
    else toast(res.error ?? "Não foi possível responder");
    await load();
    setBusy(false);
  }

  if (!loaded) return null;

  const offers = entries.filter((e) => e.status === "offered");
  const waiting = entries.filter((e) => e.status === "waiting");

  return (
    <div className="rounded-3xl card-material p-6">
      <p className="font-serif text-lg">Fila de espera</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Sem horário na semana que você quer? Entre na fila — se abrir vaga, a gente te avisa aqui e
        por e-mail.
      </p>

      {offers.map((e) => (
        <div
          key={e.id}
          className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4"
        >
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            🎉 Abriu uma vaga!
          </span>
          <p className="mt-2 text-base font-extrabold text-emerald-800">
            {e.offer_date ? formatApptDate(e.offer_date) : "—"} · {e.offer_time}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Responda em até {WAITLIST_RESPONSE_HOURS}h
            {e.offer_deadline
              ? ` (até ${new Date(e.offer_deadline).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})`
              : ""}{" "}
            — depois passa pra próxima.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => respond(e.id, true)}
              disabled={busy}
              className="press flex-1 rounded-full bg-emerald-700 py-2 text-xs font-extrabold text-white disabled:opacity-40"
            >
              Aceitar vaga
            </button>
            <button
              onClick={() => respond(e.id, false)}
              disabled={busy}
              className="press rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground disabled:opacity-40"
            >
              Recusar
            </button>
          </div>
        </div>
      ))}

      {waiting.map((e) => (
        <div
          key={e.id}
          className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-border bg-background p-3"
        >
          <span className="text-sm">
            ⏳ Na fila — semana de{" "}
            <strong>{new Date(e.week_start + "T00:00:00").toLocaleDateString("pt-BR")}</strong>
          </span>
          <button
            onClick={() => leave(e.id)}
            disabled={busy}
            className="press text-xs font-bold text-muted-foreground hover:text-rose-600 disabled:opacity-40"
          >
            Sair
          </button>
        </div>
      ))}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border/60 pt-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            Escolha um dia da semana desejada
          </label>
          <input
            type="date"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={join}
          disabled={busy || !week}
          className="press rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
        >
          Entrar na fila dessa semana
        </button>
      </div>
    </div>
  );
}

/**
 * O que o médico escreveu PARA ELA depois da consulta.
 *
 * Antes disto ela saía do consultório anotando à mão o que ele disse — e o que
 * ela anota é o que ela lembrou. O texto aqui é o campo que ele escolheu
 * escrever para ela; o prontuário (achados, conduta) fica com ele, e nunca
 * trafega até este navegador.
 */
function ResumosDasConsultas() {
  const [itens, setItens] = useState<ConsultaDaPaciente[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token;
        if (!tk) return;
        const r = await minhasConsultas({ data: { accessToken: tk } });
        if (r.ok) setItens(r.consultas);
      } catch {
        /* sem resumos; a agenda abaixo continua */
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  // Nada a mostrar não vira caixa vazia: ela ainda não teve consulta registrada.
  if (carregando || itens.length === 0) return null;

  return (
    <div className="rounded-3xl card-material p-5">
      <p className="font-serif text-lg">📋 Depois das suas consultas</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        O que o seu médico deixou escrito para você.
      </p>
      <ul className="mt-3 space-y-2">
        {itens.map((c) => (
          <li key={c.id} className="rounded-2xl bg-secondary/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {new Date(c.occurred_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {c.medico ? ` · ${c.medico}` : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-foreground">
              {c.resumo}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Receitas, pedidos de exame e orientações que o médico enviou.
 *
 * Lida direto do banco pelo navegador: a tabela tem policy de SELECT para a
 * dona da linha, e o GRANT de UPDATE é só na coluna `cumprido_em` — ela marca
 * que fez, e não consegue reescrever a posologia da própria receita.
 */
function MeusPedidos() {
  type Pedido = {
    id: string;
    kind: string;
    titulo: string;
    conteudo: string;
    nota: string | null;
    cumprido_em: string | null;
    created_at: string;
  };
  const [itens, setItens] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [marcando, setMarcando] = useState<string | null>(null);

  const ROT: Record<string, string> = {
    prescricao: "💊 Receita",
    exame: "🧾 Pedido de exame",
    orientacao: "📋 Orientação",
  };

  async function carregar() {
    try {
      const { data } = await (supabase as any)
        .from("doctor_orders")
        .select("id,kind,titulo,conteudo,nota,cumprido_em,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setItens((data ?? []) as Pedido[]);
    } catch {
      /* tabela ainda não aplicada: seção some, o resto da aba continua */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function marcarFeito(id: string) {
    setMarcando(id);
    try {
      const { error } = await (supabase as any)
        .from("doctor_orders")
        .update({ cumprido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setItens((xs) =>
        xs.map((x) => (x.id === id ? { ...x, cumprido_em: new Date().toISOString() } : x)),
      );
      toast.success("Marcado como feito ✓");
    } catch {
      toast.error("Não consegui marcar agora. Tente de novo.");
    } finally {
      setMarcando(null);
    }
  }

  if (carregando || itens.length === 0) return null;

  return (
    <div className="rounded-3xl card-material p-5">
      <p className="font-serif text-lg">Do seu médico</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Receitas, pedidos de exame e orientações. Marque o que já fez.
      </p>
      <ul className="mt-3 space-y-2">
        {itens.map((p) => (
          <li
            key={p.id}
            className={`rounded-2xl p-3 ${p.cumprido_em ? "bg-secondary/40" : "bg-secondary/70"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ROT[p.kind] ?? p.kind} · {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{p.titulo}</p>
              </div>
              {p.cumprido_em ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  ✓ feito
                </span>
              ) : (
                <button
                  onClick={() => marcarFeito(p.id)}
                  disabled={marcando === p.id}
                  className="press shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold disabled:opacity-50"
                >
                  {marcando === p.id ? "…" : "Já fiz"}
                </button>
              )}
            </div>
            <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[13px] leading-snug text-foreground">
              {p.conteudo}
            </pre>
            {p.nota && (
              <p className="mt-1.5 rounded-xl bg-card px-3 py-2 text-xs leading-snug">
                <span className="font-semibold">Recado dele: </span>
                {p.nota}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConsultasTab() {
  const [appts, setAppts] = useState<MyAppointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  /* ⚠️ "não consegui ler" NÃO é "você não tem consulta" — ver
     `fetchAppointmentsCached`. */
  const [apptsInstavel, setApptsInstavel] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<ConsultaNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [activeNoteTab, setActiveNoteTab] = useState<
    "transcript" | "orientacoes" | "medicamentos" | "exames"
  >("transcript");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("audio/webm");

  /* Nomeada para o botão "Tentar de novo" poder chamá-la: um estado de falha
     sem saída é o vazio silencioso outra vez, só que honesto — e ela continua
     sem saber se tem consulta. E `force`, senão o cache de 30 s devolveria a
     mesma lista vazia sem tocar na rede. */
  async function loadAppts() {
    setLoadingAppts(true);
    try {
      const r = await fetchAppointmentsCached(true);
      setAppts(r.appointments);
      setApptsInstavel(r.instavel);
    } finally {
      setLoadingAppts(false);
    }
  }

  useEffect(() => {
    loadNotes();
    void loadAppts();
  }, []);

  /* ⚠️ Falha de leitura NÃO é lista vazia — ver `NaoConsegueLer`. */
  const [notesInstavel, setNotesInstavel] = useState(false);

  async function loadNotes() {
    setLoadingNotes(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await (supabase as any)
        .from("consultation_notes")
        .select("*")
        .eq("user_id", u.user.id)
        .order("recorded_at", { ascending: false });
      /* ⚠️ Ela abre isto para reler a posologia que o médico ditou. "Nenhuma
         consulta salva ainda" sobre uma falha de leitura faz ela tomar o
         remédio errado, ou nenhum. */
      if (error || !data) {
        setNotesInstavel(true);
        return;
      }
      setNotesInstavel(false);
      setNotes(data);
    } finally {
      setLoadingNotes(false);
    }
  }

  async function startRecording() {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/mp4", "audio/webm"].find(
        (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t),
      );
      const mr = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      mimeRef.current = (mr.mimeType || preferred || "audio/webm").split(";")[0];
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      const mediaStream = stream;
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        setAudioBlob(blob);
        // Revoga a URL anterior antes de criar outra (evita vazar blobs).
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        mediaStream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setResult(null);
      setAudioBlob(null);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setSavedMsg(null);
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      /* ⚠️ `toast`, e não `alert`. Num app instalado o diálogo do sistema abre
         com "www.obstetrica.com.br diz:" — parece navegador, não app, que é
         exatamente a impressão que a diretriz 4.2 da Apple pune. E ele TRAVA a
         linha principal até alguém tocar em OK.

         O texto também mudou: "permissões do navegador" não ajuda quem está no
         app instalado, onde o caminho é Ajustes → Obstétrica → Microfone. */
      toast.error(
        err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Não consegui usar o microfone. Libere o acesso nos ajustes do seu celular."
          : "Este aparelho não grava áudio por aqui. Você pode digitar normalmente.",
      );
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function transcribe() {
    if (!audioBlob) return;
    setTranscribing(true);
    setResult(null);
    try {
      const fd = new FormData();
      const ext = audioBlob.type.includes("mp4")
        ? "m4a"
        : audioBlob.type.includes("ogg")
          ? "ogg"
          : "webm";
      fd.append("audio", audioBlob, `consulta.${ext}`);
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
        // O endpoint agora exige sessão: aceitava 20 MB de áudio de qualquer um.
        headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
      });
      const json: TranscribeResult = await res.json();
      /* ─── O GANCHO NÃO É DELA ────────────────────────────────────────────
         Quando o 402 vem, quem não tem plano é o MÉDICO — e mandar a gestante
         "assinar a partir de R$ 29,90" seria cobrar dela um plano que não é
         dela. A mensagem do servidor é escrita para o painel dele; aqui ela é
         trocada por uma que faça sentido do lado de cá. */
      if (res.status === 402) {
        setResult({
          ok: false,
          error:
            "A transcrição não está disponível no acompanhamento do seu médico. Você pode escrever a sua dúvida normalmente 💛",
        });
        return;
      }
      setResult(json);
    } catch {
      setResult({ ok: false, error: "Falha ao transcrever. Tente novamente." });
    } finally {
      setTranscribing(false);
    }
  }

  async function saveNote() {
    if (!result?.ok) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setSavedMsg("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const { error } = await (supabase as any).from("consultation_notes").insert({
        user_id: u.user.id,
        title: result.titulo ?? "Consulta",
        raw_transcript: result.transcript ?? null,
        orientacoes: result.orientacoes?.join("\n") ?? null,
        medicamentos: result.medicamentos?.join("\n") ?? null,
        proximos_exames: result.proximos_exames?.join("\n") ?? null,
        proxima_consulta: result.proxima_consulta ?? null,
      });
      if (error) {
        setSavedMsg("Erro ao salvar: " + error.message);
      } else {
        setSavedMsg("Nota salva com sucesso ✓");
        setResult(null);
        setAudioBlob(null);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        loadNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  async function respondProposal(id: string, approve: boolean) {
    if (respondingId) return;
    setRespondingId(id);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setRespondingId(null);
      return;
    }
    const res = await respondToProposedTime({
      data: { accessToken: s.session.access_token, id, approve },
    });
    if (res.ok) {
      toast(approve ? "Horário confirmado! ✅" : "Horário recusado.");
      const rec = await fetchAppointmentsCached(true);
      setAppts(rec.appointments);
      setApptsInstavel(rec.instavel);
    } else {
      toast(res.error ?? "Não foi possível responder");
    }
    setRespondingId(null);
  }

  // Ordenação: confirmadas futuras primeiro (mais próxima no topo), depois
  // pendentes, depois histórico (realizadas/não confirmadas) mais recente antes.
  const today = ymdLocal();
  const proposed = appts.filter((a) => a.status === "counter_proposed");
  const upcoming = appts
    .filter((a) => a.status === "confirmed" && (a.confirmed_date ?? "") >= today)
    .sort((a, b) =>
      (a.confirmed_date! + (a.confirmed_time ?? "")).localeCompare(
        b.confirmed_date! + (b.confirmed_time ?? ""),
      ),
    );
  const pending = appts
    .filter((a) => a.status === "pending")
    .sort((a, b) => a.preferred_date.localeCompare(b.preferred_date));
  const history = appts
    .filter(
      (a) =>
        a.status === "done" ||
        a.status === "cancelled" ||
        (a.status === "confirmed" && (a.confirmed_date ?? "") < today),
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* O que ele escreveu para ela vem PRIMEIRO: é a única coisa nesta tela
          que ela não podia saber sozinha. O status do agendamento ela já sabe —
          foi ela que pediu. */}
      <MeusPedidos />
      <ResumosDasConsultas />

      {/* ── Minhas consultas: o ciclo médico→paciente fecha AQUI ────── */}
      <div className="rounded-3xl card-material p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg">Minhas consultas</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Acompanhe o status dos seus agendamentos.
            </p>
          </div>
          <a
            href="/agendamento"
            className="press rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Agendar nova consulta
          </a>
        </div>

        {loadingAppts ? (
          <div className="mt-4 space-y-2">
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-16 rounded-2xl" />
          </div>
        ) : apptsInstavel ? (
          /* ⚠️ O convite a "agendar a primeira" é a pior frase possível para
             quem já tem consulta marcada e veio conferir a hora. */
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Não consegui carregar sua agenda agora
            </p>
            <p className="mt-1 text-[13px] leading-snug text-amber-900/80 dark:text-amber-100/80">
              Isso é a nossa conexão. Se você tem consulta marcada, ela continua marcada.
            </p>
            <button
              type="button"
              onClick={() => void loadAppts()}
              className="mt-3 min-h-[44px] rounded-full border border-amber-400 px-4 text-sm font-medium text-amber-900 dark:text-amber-100"
            >
              Tentar de novo
            </button>
          </div>
        ) : appts.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-secondary/50 p-5 text-center">
            <p className="text-2xl">🗓️</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você ainda não tem consultas por aqui. Agende a primeira — leva 1 minuto.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Use o mesmo e-mail da sua conta para o agendamento aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {proposed.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border-2 border-violet-300 bg-violet-50/70 p-4"
              >
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${APPT_STATUS_UI.counter_proposed.cls}`}
                >
                  {APPT_STATUS_UI.counter_proposed.emoji} {APPT_STATUS_UI.counter_proposed.label}
                </span>
                <p className="mt-2 text-sm text-foreground/80">
                  O horário que você pediu não estava livre. O médico sugeriu:
                </p>
                <p className="mt-1 text-base font-extrabold text-violet-800">
                  {a.proposed_date ? formatApptDate(a.proposed_date) : "—"} · {a.proposed_time}
                </p>
                {a.price_brl != null && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Valor: R$ {(a.price_brl / 100).toFixed(2)}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respondProposal(a.id, true)}
                    disabled={respondingId === a.id}
                    className="press flex-1 rounded-full bg-emerald-700 py-2 text-xs font-extrabold text-white disabled:opacity-40"
                  >
                    Aprovar este horário
                  </button>
                  <button
                    onClick={() => respondProposal(a.id, false)}
                    disabled={respondingId === a.id}
                    className="press rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground disabled:opacity-40"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            ))}
            {upcoming.map((a, i) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 ${
                  i === 0 ? "border-emerald-300 bg-emerald-50/60" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${APPT_STATUS_UI.confirmed.cls}`}
                  >
                    {APPT_STATUS_UI.confirmed.emoji} {i === 0 ? "Próxima consulta" : "Confirmada"}
                  </span>
                  {a.price_brl != null && (
                    <span className="text-xs text-muted-foreground">
                      R$ {(a.price_brl / 100).toFixed(2)}
                      {a.payment_status === "pago" ? " · pago ✓" : ""}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {formatApptDate(a.confirmed_date!)} · {a.confirmed_time}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
              </div>
            ))}
            {pending.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-background p-4">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${APPT_STATUS_UI.pending.cls}`}
                >
                  {APPT_STATUS_UI.pending.emoji} {APPT_STATUS_UI.pending.label}
                </span>
                <p className="mt-2 text-sm">
                  Você pediu {formatApptDate(a.preferred_date)} · {a.preferred_time}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.reason} — o consultório confirma em até 1 dia útil.
                </p>
              </div>
            ))}
            {history.length > 0 && (
              <details className="pt-1">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-primary">
                  Histórico ({history.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {history.map((a) => {
                    const ui = APPT_STATUS_UI[a.status === "confirmed" ? "done" : a.status];
                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-border/60 bg-background/60 p-3 opacity-80"
                      >
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ui.cls}`}>
                          {ui.emoji} {ui.label}
                        </span>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {new Date(
                            (a.confirmed_date ?? a.preferred_date) + "T00:00:00",
                          ).toLocaleDateString("pt-BR")}{" "}
                          · {a.confirmed_time ?? a.preferred_time} — {a.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Fila de espera */}
      <WaitlistCard />

      {/* Recording card */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Gravar consulta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Grave o áudio da consulta e a IA extrai orientações, medicamentos e exames
          automaticamente.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!recording && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 rounded-full bg-rose-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-rose-600"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
              Iniciar gravação
            </button>
          )}
          {recording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-full border-2 border-rose-500 px-6 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              Parar gravação
            </button>
          )}
          {recording && (
            <span className="flex items-center gap-1.5 text-sm text-rose-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              Gravando…
            </span>
          )}
        </div>

        {audioUrl && (
          <div className="mt-4 space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <button
              onClick={transcribe}
              disabled={transcribing}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {transcribing ? "Transcrevendo…" : "Transcrever com IA"}
            </button>
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div className="rounded-3xl card-material p-6">
          {result.error ? (
            <p className="text-sm text-destructive">{result.error}</p>
          ) : (
            <>
              <p className="font-serif text-lg">{result.titulo ?? "Consulta transcrita"}</p>

              {/* Sub-tabs */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {(["transcript", "orientacoes", "medicamentos", "exames"] as const).map((tab) => {
                  const labels: Record<typeof tab, string> = {
                    transcript: "Transcrição",
                    orientacoes: "Orientações",
                    medicamentos: "Medicamentos",
                    exames: "Exames",
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveNoteTab(tab)}
                      className={`rounded-full px-4 py-1 text-xs font-medium transition-colors ${
                        activeNoteTab === tab
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl bg-secondary/40 p-4 text-sm">
                {activeNoteTab === "transcript" && (
                  <p className="whitespace-pre-wrap">{result.transcript || "Sem transcrição."}</p>
                )}
                {activeNoteTab === "orientacoes" &&
                  (result.orientacoes?.length ? (
                    <ul className="space-y-1.5">
                      {result.orientacoes.map((o, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 text-primary">•</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Nenhuma orientação identificada.</p>
                  ))}
                {activeNoteTab === "medicamentos" &&
                  (result.medicamentos?.length ? (
                    <ul className="space-y-1.5">
                      {result.medicamentos.map((m, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 text-primary">💊</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Nenhum medicamento mencionado.</p>
                  ))}
                {activeNoteTab === "exames" && (
                  <>
                    {result.proximos_exames?.length ? (
                      <ul className="space-y-1.5">
                        {result.proximos_exames.map((e, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 text-primary">🔬</span>
                            {e}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">Nenhum exame solicitado.</p>
                    )}
                    {result.proxima_consulta && (
                      <p className="mt-3 rounded-lg border border-border bg-background p-2 text-xs">
                        📅 Próxima consulta: {result.proxima_consulta}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={saveNote}
                  disabled={saving}
                  className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Salvando…" : "Salvar nota"}
                </button>
                {savedMsg && <p className="text-sm text-primary">{savedMsg}</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* History */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Histórico de consultas</p>
        {loadingNotes ? (
          <div className="mt-4 space-y-2">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : notesInstavel ? (
          <NaoConsegueLer
            oQue="suas consultas salvas"
            sossego="O que foi gravado continua salvo."
            aoTentar={() => void loadNotes()}
          />
        ) : notes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma consulta salva ainda.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {notes.map((n) => (
              <details key={n.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{n.title ?? "Consulta"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.recorded_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </summary>
                <div className="mt-3 space-y-2 text-sm">
                  {n.orientacoes && (
                    <div>
                      <p className="font-medium text-primary">Orientações</p>
                      <p className="whitespace-pre-line text-muted-foreground">{n.orientacoes}</p>
                    </div>
                  )}
                  {n.medicamentos && (
                    <div>
                      <p className="font-medium text-primary">Medicamentos</p>
                      <p className="whitespace-pre-line text-muted-foreground">{n.medicamentos}</p>
                    </div>
                  )}
                  {n.proximos_exames && (
                    <div>
                      <p className="font-medium text-primary">Exames</p>
                      <p className="whitespace-pre-line text-muted-foreground">
                        {n.proximos_exames}
                      </p>
                    </div>
                  )}
                  {n.proxima_consulta && (
                    <p className="text-xs text-muted-foreground">
                      Próxima consulta: {n.proxima_consulta}
                    </p>
                  )}
                  {n.raw_transcript && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">
                        Ver transcrição completa
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-background p-3 text-xs">
                        {n.raw_transcript}
                      </p>
                    </details>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Linha do Tempo (Feature #12) ---------- */

type TimelineEvent = {
  id: string;
  date: string;
  type: "saude" | "diario" | "consulta" | "chutes" | "preconsulta" | "marco";
  title: string;
  detail?: string;
  badge?: string;
};

const EV_STYLE: Record<TimelineEvent["type"], { dot: string; badge: string }> = {
  saude: { dot: "bg-primary/50", badge: "bg-primary/10 text-primary" },
  diario: { dot: "bg-primary/60", badge: "bg-primary/10 text-primary" },
  consulta: { dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  chutes: { dot: "bg-primary", badge: "bg-primary/10 text-primary" },
  preconsulta: { dot: "bg-rose-400", badge: "bg-rose-100 text-rose-700" },
  marco: { dot: "bg-primary", badge: "bg-primary/10 text-primary" },
};

const EV_LABEL: Record<TimelineEvent["type"], string> = {
  saude: "Saúde",
  diario: "Diário",
  consulta: "Consulta",
  chutes: "Chutes",
  preconsulta: "Pré-consulta",
  marco: "Marco",
};

function TimelineTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineEvent["type"] | "todos">("todos");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sua sessão expirou — entre novamente.");
        return;
      }
      await loadEvents(u.user.id);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents(userId: string) {
    const [logsRes, journalRes, consultRes, kicksRes, preRes] = await Promise.all([
      (supabase as any)
        .from("health_logs")
        .select("id, log_date, weight_kg, systolic, diastolic")
        .eq("user_id", userId)
        .order("log_date", { ascending: false }),
      (supabase as any)
        .from("journal_entries")
        .select("id, entry_date, mood, content")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false }),
      (supabase as any)
        .from("consultation_notes")
        .select("id, recorded_at, title, orientacoes")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false }),
      (supabase as any)
        .from("kick_sessions")
        .select("id, started_at, kick_count")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false }),
      (supabase as any)
        .from("preconsulta_forms")
        .select("id, submitted_at, weeks_at_submission, emotional_state")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false }),
    ]);

    const all: TimelineEvent[] = [];

    for (const r of logsRes.data ?? []) {
      const parts = [];
      if (r.weight_kg) parts.push(`Peso: ${r.weight_kg} kg`);
      if (r.systolic && r.diastolic) parts.push(`PA: ${r.systolic}/${r.diastolic}`);
      all.push({
        id: r.id,
        date: r.log_date,
        type: "saude",
        title: "Registro de saúde",
        detail: parts.join(" · ") || undefined,
      });
    }
    for (const r of journalRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.entry_date,
        type: "diario",
        title: `Diário ${r.mood ?? ""}`.trim(),
        detail: r.content?.slice(0, 100) + (r.content?.length > 100 ? "…" : ""),
      });
    }
    for (const r of consultRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.recorded_at?.slice(0, 10),
        type: "consulta",
        title: r.title ?? "Consulta",
        detail: r.orientacoes?.split("\n")?.[0],
      });
    }
    for (const r of kicksRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.started_at?.slice(0, 10),
        type: "chutes",
        title: `${r.kick_count ?? 0} chutes registrados`,
      });
    }
    for (const r of preRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.submitted_at?.slice(0, 10),
        type: "preconsulta",
        title: `Pré-consulta — semana ${r.weeks_at_submission ?? "?"}`,
        detail: r.emotional_state ? `Humor: ${r.emotional_state}` : undefined,
      });
    }

    // Marcos gestacionais já alcançados entram como eventos na linha do tempo
    if (gest && profile) {
      for (const m of PRENATAL_MILESTONES) {
        if (m.week > gest.weeks) continue;
        const d = weekToDate(m.week, profile);
        if (!d) continue;
        all.push({
          id: `milestone-${m.week}-${m.label}`,
          date: ymdLocal(d),
          type: "consulta",
          title: `📌 ${m.label} (semana ${m.week})`,
          detail: m.detail,
        });
      }
    }

    const failed = [logsRes, journalRes, consultRes, kicksRes, preRes].filter(
      (r) => r.error,
    ).length;
    if (failed > 0) {
      toast.error(`Alguns registros não puderam ser carregados (${failed} de 5 fontes).`);
    }

    all.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    setEvents(all);
  }

  const filtered = filter === "todos" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Sua jornada pré-natal</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os seus registros numa linha do tempo cronológica.
        </p>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(["todos", "saude", "diario", "consulta", "chutes", "preconsulta"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f === "todos" ? "Todos" : EV_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-serif text-xl text-foreground/70">Nenhum registro ainda</p>
          <p className="mt-2 text-sm text-muted-foreground">Comece usando as outras abas!</p>
        </div>
      ) : (
        <div className="relative ml-4">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 h-full w-px bg-border" />

          <div className="space-y-4">
            {filtered.map((ev) => {
              const s = EV_STYLE[ev.type];
              return (
                <div key={ev.id} className="relative flex gap-4 pl-10">
                  {/* Dot */}
                  <div
                    className={`absolute left-0 top-4 h-6 w-6 rounded-full border-2 border-background ${s.dot} flex items-center justify-center`}
                  />

                  <div className="flex-1 rounded-2xl card-material p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{ev.title}</p>
                        {ev.detail && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{ev.detail}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>
                          {EV_LABEL[ev.type]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ev.date
                            ? new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR")
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Humor (Feature #18) ---------- */

/**
 * ⚠️ TODO EMOJI QUE O APP GRAVA EM `journal_entries.mood` PRECISA ESTAR AQUI.
 *
 * O gráfico faz `MOOD_VALUE[e.mood] ?? 3` — um emoji que falte nesta tabela
 * entra como "normal" e some no meio da média, sem erro e sem rastro. Foi o
 * risco de acrescentar o fechamento da meditação (😌 🥱 💛 😐 😟): dois já
 * existiam e três não, e três quintos das respostas dela viravam ruído neutro.
 *
 * Quem escreve nesta tabela hoje: o check-in rápido da home, o diário, a
 * Gratidão (🙏) e o fechamento da meditação.
 */
const MOOD_VALUE: Record<string, number> = {
  "🥰": 5,
  "😊": 4,
  "😌": 4, // tranquila (check-in rápido da home) · "mais calma" (meditação)
  "💛": 4, // conectada (fechamento da meditação)
  "🙏": 4, // gratidão registrada
  "😴": 3,
  "🥱": 3, // com sono (fechamento da meditação)
  "😐": 3, // igual (fechamento da meditação)
  "🤢": 2,
  "😟": 2, // ansiosa (check-in rápido da home) · "ainda ansiosa" (meditação)
  "😢": 1,
  "😰": 1,
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MOOD_SUGGESTIONS: Record<number, string[]> = {
  5: [
    "Que semana maravilhosa! Anote o que trouxe tanta alegria para se lembrar depois.",
    "Compartilhe sua energia com quem você ama.",
  ],
  4: [
    "Você está indo muito bem! Uma caminhada leve pode ampliar ainda mais essa sensação.",
    "Pratique gratidão escrevendo 3 coisas boas do dia.",
  ],
  3: [
    "O cansaço é parte normal da gestação. Descanse sem culpa e peça ajuda quando precisar.",
    "Hidrate-se bem e tente dormir mais cedo esta semana.",
  ],
  2: [
    "Dias difíceis passam. Gentileza consigo mesma é o melhor remédio.",
    "Gengibre, torradas secas e pequenas refeições frequentes podem ajudar no mal-estar.",
  ],
  1: [
    "Seus sentimentos são válidos. Se a tristeza ou ansiedade persistir, conversar com o seu médico pode ajudar.",
    "Técnicas de respiração profunda e meditação guiada (aba Meditações) podem aliviar a ansiedade.",
  ],
};

function HumorTab() {
  const [entries, setEntries] = useState<{ entry_date: string; mood: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("journal_entries")
        .select("entry_date, mood")
        .order("entry_date", { ascending: false })
        .limit(180);
      setEntries(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <TabSkeleton />;

  if (entries.length === 0)
    return (
      <div className="py-14 text-center">
        <p className="text-4xl mb-3">💛</p>
        <p className="font-serif text-xl text-foreground/70">Nenhum registro ainda</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a aba <strong>Diário</strong> para registrar seu humor diariamente.
        </p>
      </div>
    );

  // Last 8 weeks of data for chart
  const today = new Date();
  const weeks: { label: string; avg: number | null }[] = [];
  for (let w = 7; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    const inWeek = entries.filter((e) => {
      const d = new Date(e.entry_date + "T00:00:00");
      return d >= weekStart && d <= weekEnd;
    });
    const vals = inWeek.map((e) => MOOD_VALUE[e.mood ?? ""] ?? 3).filter(Boolean);
    weeks.push({ label, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
  }

  // Day-of-week averages
  const dayMap: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  entries.forEach((e) => {
    const d = new Date(e.entry_date + "T00:00:00");
    const v = MOOD_VALUE[e.mood ?? ""];
    if (v) dayMap[d.getDay()].push(v);
  });
  const dayAvg = Array.from({ length: 7 }, (_, i) => {
    const vals = dayMap[i];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  // Overall trend
  const recent = entries.slice(0, 14);
  const recentAvg = recent.map((e) => MOOD_VALUE[e.mood ?? ""] ?? 3);
  const overallAvg = recentAvg.length
    ? Math.round(recentAvg.reduce((a, b) => a + b, 0) / recentAvg.length)
    : 3;
  const suggestions = MOOD_SUGGESTIONS[Math.min(5, Math.max(1, overallAvg))] ?? MOOD_SUGGESTIONS[3];

  const bestDay = dayAvg.reduce<number>(
    (best, v, i) => (v !== null && (best === -1 || v > (dayAvg[best] ?? 0)) ? i : best),
    -1,
  );
  const hardDay = dayAvg.reduce<number>(
    (hard, v, i) => (v !== null && (hard === -1 || v < (dayAvg[hard] ?? 6)) ? i : hard),
    -1,
  );

  // SVG chart dimensions
  const W = 340,
    H = 100,
    pad = 10;
  const chartW = W - pad * 2;
  const chartH = H - pad * 2;
  const points = weeks.map((w, i) => ({
    x: pad + (i / (weeks.length - 1)) * chartW,
    y: w.avg !== null ? pad + chartH - ((w.avg - 1) / 4) * chartH : null,
    avg: w.avg,
    label: w.label,
  }));
  const polyline = points
    .filter((p) => p.y !== null)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  // Mood frequency
  const moodCount: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.mood) moodCount[e.mood] = (moodCount[e.mood] ?? 0) + 1;
  });
  const topMoods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Resumo dos últimos 14 dias</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-secondary/50 p-3 text-center">
            <p className="text-2xl">
              {Object.entries(MOOD_VALUE).find(([, v]) => v === Math.round(overallAvg))?.[0] ??
                "😊"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Humor médio</p>
          </div>
          <div className="rounded-2xl bg-secondary/50 p-3 text-center">
            <p className="text-lg font-bold text-primary">{entries.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Registros totais</p>
          </div>
          {bestDay >= 0 && (
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">{DAY_NAMES[bestDay]}</p>
              <p className="mt-1 text-xs text-muted-foreground">Melhor dia da semana</p>
            </div>
          )}
          {hardDay >= 0 && hardDay !== bestDay && (
            <div className="rounded-2xl bg-primary/6 p-3 text-center">
              <p className="text-lg font-bold text-primary">{DAY_NAMES[hardDay]}</p>
              <p className="mt-1 text-xs text-muted-foreground">Dia mais difícil</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly mood chart */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Humor por semana</p>
        <p className="text-xs text-muted-foreground mt-1">
          Média semanal das últimas 8 semanas (1=muito ruim · 5=ótimo)
        </p>
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full max-w-sm">
            {/* Grid lines */}
            {[1, 2, 3, 4, 5].map((v) => {
              const y = pad + chartH - ((v - 1) / 4) * chartH;
              return (
                <line
                  key={v}
                  x1={pad}
                  y1={y}
                  x2={W - pad}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeWidth={1}
                />
              );
            })}
            {/* Polyline */}
            {polyline && (
              <polyline
                points={polyline}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}
            {/* Data points */}
            {points.map(
              (p, i) =>
                p.y !== null && (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y!} r={4} fill="var(--primary)" />
                    <text
                      x={p.x}
                      y={H + 18}
                      textAnchor="middle"
                      fontSize={8}
                      fill="currentColor"
                      opacity={0.5}
                    >
                      {p.label}
                    </text>
                  </g>
                ),
            )}
          </svg>
        </div>
      </div>

      {/* Day of week heatmap */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Padrão por dia da semana</p>
        <div className="mt-4 flex gap-2">
          {DAY_NAMES.map((name, i) => {
            const avg = dayAvg[i];
            const val = avg !== null ? Math.round(avg) : null;
            const colors = [
              "",
              "bg-rose-200",
              "bg-orange-200",
              "bg-amber-100",
              "bg-emerald-100",
              "bg-emerald-300",
            ];
            return (
              <div key={name} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={`h-10 w-full rounded-lg ${val !== null ? colors[val] : "bg-secondary"} flex items-center justify-center`}
                >
                  {val !== null ? (
                    <span className="text-lg">
                      {Object.entries(MOOD_VALUE).find(([, v]) => v === val)?.[0] ?? "😐"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{name}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top moods */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Seus humores mais frequentes</p>
        <div className="mt-4 space-y-2">
          {topMoods.map(([emoji, count]) => (
            <div key={emoji} className="flex items-center gap-3">
              <span className="text-2xl">{emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{MOOD_LABEL[emoji] ?? emoji}</span>
                  <span className="text-muted-foreground">{count}×</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((count / entries.length) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Personalized suggestions */}
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
        <p className="font-serif text-lg">Sugestões personalizadas</p>
        <ul className="mt-3 space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-primary">✦</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Meditações Guiadas (Feature #17) ---------- */

type Meditation = {
  id: string;
  title: string;
  duration: string;
  topic: string;
  trimester: 1 | 2 | 3 | 0;
  script: string;
};

const MEDITATIONS: Meditation[] = [
  {
    id: "nausea",
    title: "Alívio das náuseas",
    duration: "5 min",
    topic: "Bem-estar físico",
    trimester: 1,
    script: `Encontre uma posição confortável, de preferência sentada com as costas apoiadas. Feche os olhos suavemente. Comece a respirar fundo pelo nariz, devagar. Inspire... e expire... Inspire contando até quatro... e expire contando até seis... Sinta seu corpo relaxar a cada expiração. Agora visualize uma cor calmante — pode ser azul suave, verde menta, ou qualquer cor que traga paz para você. Imagine essa cor preenchendo seu corpo de cima para baixo, como uma luz gentil. Enquanto respira, sinta sua digestão se acalmando. Seu corpo é sábio. Ele cuida de você e do seu bebê a cada momento. A náusea é um sinal de que sua gestação está saudável — mas agora você escolhe dar ao seu corpo um momento de descanso. Continue respirando devagar... Inspire pelo nariz... Expire pela boca, soltando a tensão... Visualize sua barriga se aquecendo com uma luz dourada e protetora. Você e seu bebê estão seguros e bem. Permaneça nesse estado de quietude por mais alguns instantes. Quando estiver pronta, abra os olhos lentamente.`,
  },
  {
    id: "ansiedade-inicial",
    title: "Acalmando a ansiedade",
    duration: "6 min",
    topic: "Saúde mental",
    trimester: 1,
    script: `Sente-se ou deite-se confortavelmente. Feche os olhos. Coloque uma mão sobre o coração e a outra sobre a barriga. Respire fundo... Sinta o movimento suave das suas mãos. Você está aqui. Você está presente. Comece a respiração em quatro tempos: inspire pelo nariz enquanto conta 1... 2... 3... 4... Segure suavemente: 1... 2... 3... 4... Expire pela boca: 1... 2... 3... 4... 5... 6... Repita esse ciclo mais três vezes. Enquanto você respira, reconheça que a ansiedade é uma forma de amor — é seu corpo tentando proteger você e seu bebê. Mas você é capaz. As gerações de mulheres que vieram antes de você carregaram seus filhos com amor e saíram fortes pelo outro lado. Você também vai. Visualize um lugar seguro — pode ser uma praia, um jardim, o sofá da sua casa. Esteja completamente nesse lugar. Sinta a textura, ouça os sons, perceba o cheiro. Você está segura. Seu bebê está seguro. Continue respirando... Lentamente, devagar. Permita que essa sensação de calma se espalhe por todo o seu corpo. Quando estiver pronta, abra os olhos, piscando devagar.`,
  },
  {
    id: "conexao-bebe",
    title: "Conexão com o bebê",
    duration: "7 min",
    topic: "Vínculo materno",
    trimester: 2,
    script: `Deite-se de lado, com um travesseiro entre os joelhos, na posição mais confortável possível. Feche os olhos. Coloque as duas mãos sobre a barriga com carinho. Respire fundo e, na expiração, imagine que seu amor vai diretamente para o seu bebê — como uma onda de calor que o envolve. Neste momento, pense no nome que você escolheu, ou simplesmente pense: meu bebê. Seu bebê já te ouve. Já sente a temperatura da sua voz. Sente seus movimentos. Diga baixinho — ou apenas pense: Eu te amo. Estou aqui com você. Você é muito esperado. Visualize seu bebê quentinho e confortável dentro de você. Pequeno, mas completo. Perfeito a cada dia. Sinta os batimentos do seu próprio coração... e imagine o coraçãozinho do seu bebê batendo no mesmo ritmo. Dois corações. Uma só história. Permaneça nessa conexão por quantos momentos quiser. Não existe pressa. Você tem tudo que seu bebê precisa agora mesmo. Quando estiver pronta, agradeça ao seu corpo por este momento. Abra os olhos com calma.`,
  },
  {
    id: "dor-lombar",
    title: "Relaxamento para dor lombar",
    duration: "8 min",
    topic: "Bem-estar físico",
    trimester: 2,
    script: `Deite-se de costas em uma superfície firme, com os joelhos dobrados e os pés apoiados no chão. Se preferir, coloque um travesseiro embaixo dos joelhos. Feche os olhos. Respire fundo, lentamente. Na inspiração, sinta seu pulmão expandir. Na expiração, sinta seu corpo afundar na superfície, mais pesado, mais relaxado. Comece pelo topo da cabeça. Solte a tensão da testa. Relaxe as sobrancelhas, os olhos, as bochechas, a mandíbula. Desça pelo pescoço... pelos ombros... Sinta os ombros afundarem gentilmente. Agora concentre sua atenção na lombar — a parte baixa das costas. A cada expiração, imagine que a tensão nessa área vai se dissolvendo como açúcar na água. Inspire... expire... Visualize uma luz quente e relaxante envolvendo sua coluna, do sacro até os ombros. Quente, suave, aliviante. Seu corpo carrega um precioso presente. É natural sentir desconforto, mas agora você escolhe dar a ele descanso. Permaneça nessa leveza. Continue respirando. Sinta a gravidade trabalhar por você, liberando peso. Quando quiser, flexione os pés, vire para o lado, e levante-se com cuidado.`,
  },
  {
    id: "insonia",
    title: "Para dormir melhor",
    duration: "10 min",
    topic: "Sono",
    trimester: 3,
    script: `Este exercício é para ser feito na cama, na hora de dormir. Deite-se na posição que for mais confortável. Feche os olhos. Deixe o corpo relaxar completamente. Não há mais nada a fazer hoje. Você cuidou de tudo que precisava. Agora é o tempo do descanso. Comece relaxando os pés. Solte os dedos... os arcos plantares... os calcanhares... Suba pelos tornozelos, panturrilhas, joelhos. Sinta as pernas ficarem pesadas e quentes. Continue pelo quadril... pela barriga... Agradeça ao seu bebê por este dia de companhia. Relaxe o peito... os ombros... os braços... as mãos. Solte os dedos das mãos. Sinta-os formigando de relaxamento. Pelo pescoço... pelo rosto inteiro... Respire lento, ritmado. Inspire... quatro tempos... Expire... seis tempos... Imagine que você está flutuando em uma água morna e tranquila. Não há esforço. Só flutuação. A cada onda de pensamento, deixe passar sem segurar. Pensamento? Deixa ir. Preocupação? Amanhã você resolve. Agora só existe o presente momento. Você... seu bebê... este quarto... esta cama... Continuando a respiração lenta e ritmada... Cada expiração te leva mais fundo para o descanso... Mais fundo... Mais tranquila... Permita que o sono venha naturalmente.`,
  },
  {
    id: "preparo-parto",
    title: "Preparando-se para o parto",
    duration: "9 min",
    topic: "Preparo emocional",
    trimester: 3,
    script: `Sente-se confortavelmente, com as costas apoiadas e as mãos sobre a barriga. Feche os olhos. Respire fundo... Inspire... e expire... Você está se aproximando de um dos momentos mais poderosos da sua vida. E você está pronta. Nem todo o preparo vem de livros ou cursos — parte dele já está dentro de você, inscrita na sua biologia, no instinto milenar de cada mãe que já existiu antes de você. Comece visualizando o dia do parto como você gostaria que fosse: você está calm, rodeada de pessoas que te apoiam. A cada contração, você respira fundo. A dor é sua aliada — ela te aproxima do seu bebê. Visualize você mesma forte, presente, capaz. Agora pense no momento em que você verá seu bebê pela primeira vez. O peso nos seus braços. O cheiro. Os olhinhos tentando te enxergar. Este momento está se aproximando. E você está mais do que pronta para ele. Respire... Inspire força... Expire medo... Inspire confiança... Expire tensão... Continue por alguns ciclos, no seu ritmo. Lembre: cada contração te traz mais perto. Cada respiração é suporte para o seu bebê. Você foi feita para isso. Quando estiver pronta, abra os olhos com gratidão.`,
  },
  {
    id: "gratidao",
    title: "Gratidão gestacional",
    duration: "6 min",
    topic: "Bem-estar mental",
    trimester: 0,
    script: `Encontre uma posição confortável. Feche os olhos. Coloque as mãos sobre o coração. Comece respirando lentamente. Inspire... e expire... Neste momento, pense em três coisas pelas quais você é grata hoje. Podem ser pequenas: o sol entrando pela janela, uma mensagem de alguém que você ama, um momento de quietude. Sinta essa gratidão no peito — como um calor agradável que se expande. Agora pense no seu bebê. Ele está aí, crescendo, se desenvolvendo, se preparando para te conhecer. Que milagre silencioso acontece dentro de você a cada momento. Agradeça ao seu corpo pelo trabalho incansável que realiza. Agradeça ao seu coração, aos seus pulmões, aos seus rins, à sua placenta. Tudo funciona em harmonia para proteger a vida que você carrega. Você não precisa fazer tudo perfeito. Você só precisa estar presente. E você está. Respire essa gratidão... Deixe ela preencher cada célula. Quando estiver pronta, abra os olhos com um sorriso gentil.`,
  },
];

const TOPICS = [...new Set(MEDITATIONS.map((m) => m.topic))];

/**
 * ⚠️ `careMode` ENTROU AQUI, e a falta dele era o pior defeito de som do app.
 *
 * Esta aba manda o roteiro inteiro da meditação para o `speechSynthesis` — e os
 * roteiros contêm, literalmente: "Conexão com o bebê", "Você está segura. Seu
 * bebê está seguro.", "Agradeça ao seu bebê por este dia de companhia.".
 *
 * Para quem acabou de perder a gestação, o app FALAVA ISSO EM VOZ ALTA.
 *
 * É exatamente o defeito que a meditação do Caminho corrigiu em ago/2026 e que
 * está registrado lá como "o pior que a revisão encontrou" — e aqui é pior,
 * porque lá o texto era lido na TELA e aqui é falado. As duas vizinhas na mesma
 * linha (`SonsBebêTab`, `ApoioEmocionalTab`) já recebiam `careMode`; esta não.
 */
/**
 * ⚠️ O PORTÃO DE LUTO É UM EMBRULHO, e não um `return` no meio dos hooks.
 *
 * A primeira versão punha `if (careMode) return null` dentro do componente — e
 * o lint pegou na hora: os `useState` abaixo passariam a ser chamados
 * condicionalmente, que é a regra dos hooks quebrada. Embrulhando, o
 * componente de verdade nem é montado.
 *
 * A grade já não mostra o ladrilho no Modo Cuidado, mas esta é a tranca que
 * importa: o `sub` também chega por estado guardado e por navegação vinda de
 * outra tela, e "está gateado lá atrás" é a garantia que este projeto já viu
 * falhar. A prop existia e era MORTA — eu a passei numa rodada anterior e nunca
 * a usei, e a voz continuou lendo sobre o bebê em voz alta.
 */
function MeditacoesTab({ gest, careMode }: { gest: Gest; careMode: boolean }) {
  if (careMode) return null;
  return <MeditacoesConteudo gest={gest} />;
}

function MeditacoesConteudo({ gest }: { gest: Gest }) {
  const currentTrimester = gest ? trimesterForWeek(gest.weeks) : null;
  /* Suporte à voz só se sabe no CLIENTE. Lido no render, `window` não existe
     no SSR do TanStack Start e a página inteira caía no servidor. */
  const [semVoz, setSemVoz] = useState(false);
  useEffect(() => setSemVoz(!("speechSynthesis" in window)), []);
  const [selected, setSelected] = useState<Meditation | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.9);
  const [topicFilter, setTopicFilter] = useState<string>("todos");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [decorrido, setDecorrido] = useState<number | null>(null);
  const breathRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE AQUI NÃO TEM MAIS BOLINHA DE RESPIRAÇÃO
   *
   * Havia um círculo 4-4-6 que animava do play até o fim, com "Inspire… /
   * Segure… / Expire…" escrito embaixo. Três problemas, e os três vinham do
   * mesmo lugar — a tela instruindo por cima da voz:
   *
   *  1. A PRIMEIRA FRASE DE TODO ROTEIRO manda fechar os olhos. E aí a tela
   *     pedia para olhá-la por dez minutos. O app dava duas ordens opostas.
   *
   *  2. O RITMO ERA OUTRO. Os roteiros contam o próprio compasso — "inspire
   *     contando até quatro e expire contando até seis" — enquanto o círculo
   *     rodava num `setTimeout` paralelo, iniciado no clique do play. Os dois
   *     nunca se alinhavam. Quem tentasse seguir os dois recebia instruções
   *     contraditórias, e o exercício de acalmar virava exercício de decidir
   *     em quem obedecer.
   *
   *  3. O CÍRCULO PROMETIA UM GUIA QUE NÃO EXISTIA. `speechSynthesis` não
   *     informa onde está na fala, então não havia como sincronizar nem
   *     querendo. Sincronizar de verdade exige áudio gravado com marcações —
   *     o caminho da Isabella, que ainda não está aqui.
   *
   * O que fica é o mínimo que serve a quem está de olhos fechados: o tempo
   * decorrido, para quem abrir o olho saber quanto falta. Nenhuma palavra a
   * seguir, nenhum compasso a acompanhar.
   *
   * A respiração com compasso continua existindo — no Caminho, onde ela é o
   * exercício em si, com som e vibração que duram a fase inteira e não pedem
   * a tela. Ali o ritmo é o produto; aqui, ele era ruído.
   */
  /**
   * Começa a contar, ou RETOMA de onde parou.
   *
   * `togglePlay` chama isto no play e no resume. Zerar aqui faria o resume
   * mandar a paciente de volta ao 0:00 no meio da meditação — um número que
   * seria mentira, e o único número da tela.
   */
  function startBreathing() {
    if (breathRef.current) clearInterval(breathRef.current);
    setDecorrido((s) => s ?? 0);
    breathRef.current = setInterval(() => setDecorrido((s) => (s ?? 0) + 1), 1000);
  }

  /** Pausa: o relógio para, o número fica. */
  function pauseClock() {
    if (breathRef.current) clearInterval(breathRef.current);
    breathRef.current = null;
  }

  /** Fim de verdade: some o relógio. */
  function stopBreathing() {
    pauseClock();
    setDecorrido(null);
  }

  function speak(med: Meditation) {
    /* Era um `alert()` do sistema. Num app instalado, isso é um diálogo modal
       do iOS/Android surgindo no meio de uma meditação — a coisa mais oposta
       possível ao que a tela está tentando fazer. E o texto mandava "usar
       Chrome ou Edge", conselho que dentro do app nativo não significa nada. */
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast("Este aparelho não tem voz guiada. O texto da meditação está logo abaixo. 💛");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(med.script);
    utter.lang = "pt-BR";
    utter.rate = rate;
    utter.pitch = 0.95;

    /* `getVoices()` é ASSÍNCRONO no Chrome: na primeira reprodução depois de
       uma carga fria ele devolve lista VAZIA, `utter.voice` nunca era
       definido, e o sistema lia o português com a voz padrão — em inglês.
       O `voiceschanged` é a única forma de saber que a lista chegou; sem ele,
       a primeira meditação do dia soava errada e a segunda soava certa, o que
       ninguém consegue reportar como bug. */
    const escolherVoz = () => {
      const voices = window.speechSynthesis.getVoices();
      const pt = voices.find((v) => v.lang?.toLowerCase().startsWith("pt-br"));
      const qualquerPt = voices.find((v) => v.lang?.toLowerCase().startsWith("pt"));
      const voz = pt ?? qualquerPt ?? null;
      if (voz) utter.voice = voz;
      return Boolean(voz) || voices.length > 0;
    };

    utter.onend = () => {
      setPlaying(false);
      stopBreathing();
    };
    utterRef.current = utter;

    const falar = () => {
      window.speechSynthesis.speak(utter);
      setPlaying(true);
      startBreathing();
    };
    if (escolherVoz()) falar();
    else {
      /* Lista ainda não chegou: espera o evento, com teto de 400ms para o
         botão nunca ficar sem resposta num navegador que não dispara o
         evento. */
      let disparou = false;
      const uma = () => {
        if (disparou) return;
        disparou = true;
        window.speechSynthesis.removeEventListener("voiceschanged", uma);
        escolherVoz();
        falar();
      };
      window.speechSynthesis.addEventListener("voiceschanged", uma);
      setTimeout(uma, 400);
    }
  }

  function togglePlay() {
    if (!selected) return;
    if (playing) {
      window.speechSynthesis.pause();
      setPlaying(false);
      pauseClock();
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPlaying(true);
      startBreathing();
    } else {
      speak(selected);
    }
  }

  function stop() {
    window.speechSynthesis.cancel();
    setPlaying(false);
    stopBreathing();
  }

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (breathRef.current) clearInterval(breathRef.current);
    };
  }, []);

  const filtered = MEDITATIONS.filter((m) => {
    const matchesTopic = topicFilter === "todos" || m.topic === topicFilter;
    return matchesTopic;
  });

  const relogio =
    decorrido === null
      ? ""
      : `${Math.floor(decorrido / 60)}:${String(decorrido % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Meditações Guiadas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sessões de meditação para ler ou ouvir, específicas para cada fase da gestação.
          {currentTrimester &&
            ` No ${currentTrimester}º trimestre, recomendamos as meditações destacadas.`}
        </p>

        {/* O app tem DUAS meditações, e esta é a pior das duas.
            A do Caminho tem voz gravada (Isabella, 25 faixas embarcadas), som
            de fundo, vibração por fase, pergunta de fechamento, sequência de
            dias e meia-estrela. Esta aqui lê o texto com a voz do SISTEMA — a
            que estiver instalada no aparelho, que no Android costuma ser a
            robótica, e que ninguém consegue escolher nem instalar.
            Enquanto as duas convivem, quem chega aqui pela navegação de
            Saúde ao menos fica sabendo que a outra existe. */}
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
          A meditação do <strong>Caminho</strong> tem voz gravada, som de fundo e conta ponto do
          dia. Esta aqui é a versão de leitura, com a voz do próprio aparelho.
        </p>

        {/* `semVoz` vem de efeito, não do render: `window` não existe no SSR e
            ler `"speechSynthesis" in window` aqui derrubava a página inteira
            no servidor. */}
        {semVoz && (
          <p className="mt-2 rounded-xl bg-primary/6 px-3 py-2 text-xs text-primary">
            Este aparelho não tem voz guiada — o texto completo de cada meditação está logo abaixo.
          </p>
        )}
      </div>

      {/* Topic filter */}
      <div className="flex flex-wrap gap-2">
        {["todos", ...TOPICS].map((t) => (
          <button
            key={t}
            onClick={() => setTopicFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              topicFilter === t
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t === "todos" ? "Todos os temas" : t}
          </button>
        ))}
      </div>

      {/* Player */}
      {selected && (
        <div className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-6">
          <p className="font-serif text-xl">{selected.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected.topic} · {selected.duration}
          </p>

          {/* De olhos fechados: nada a seguir, só onde ela está.
              O `aria-hidden` no anel é de propósito — para o leitor de tela ele
              não existe, porque não carrega informação nenhuma; quem usa leitor
              de tela recebe o tempo, que é o único dado real aqui. */}
          {decorrido !== null && (
            <div className="my-6 flex flex-col items-center gap-3">
              {/* Ela, de olhos fechados — a mesma companhia da respiração no
                  Caminho. Aqui NÃO respira em compasso de propósito: quem
                  manda o ritmo é a voz, e uma bolha inflando no relógio dela
                  seria o mesmo erro do círculo 4-4-6 que acabou de sair.
                  Ela só flutua devagar: presença, não instrução. */}
              <Bolha tamanho={88} humor="dormindo" />
              <p className="text-2xl font-light tabular-nums text-primary" aria-live="off">
                {relogio}
              </p>
              <p className="max-w-[240px] text-center text-xs text-muted-foreground">
                Pode fechar os olhos e apoiar o celular. A voz conduz sozinha.
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {playing ? "⏸ Pausar" : "▶ Iniciar meditação"}
            </button>
            {(playing || window.speechSynthesis?.paused) && (
              <button
                onClick={stop}
                className="rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
              >
                ⏹ Parar
              </button>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Velocidade
              <input
                type="range"
                min="0.6"
                max="1.2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-20"
              />
              <span>{rate}×</span>
            </label>
          </div>

          {/* Script preview */}
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">
              Ver script completo
            </summary>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-background p-4 text-xs leading-relaxed text-muted-foreground">
              {selected.script}
            </p>
          </details>
        </div>
      )}

      {/* Meditation list */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((med) => {
          const isRecommended =
            currentTrimester !== null &&
            (med.trimester === 0 || med.trimester === currentTrimester);
          return (
            <button
              key={med.id}
              onClick={() => {
                setSelected(med);
                stop();
              }}
              className={`rounded-2xl border p-4 text-left transition-all hover:border-primary/50 ${
                selected?.id === med.id ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{med.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{med.topic}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">{med.duration}</span>
                  {isRecommended && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {med.trimester === 0 ? "Para qualquer trimestre" : `${med.trimester}º trim.`}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Teleconsulta (Feature #13) ---------- */

function TeleconsultaTab({ profile }: { profile: Profile | null }) {
  const [sessions, setSessions] = useState<TeleconsultaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<TeleconsultaSession | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  /* ⚠️ Falha de leitura NÃO é lista vazia — ver `NaoConsegueLer`. */
  const [instavel, setInstavel] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token ?? "";
    const res = await getMyTeleconsultas({ data: { accessToken: tk } });
    /* ⚠️ `{ ok: false }` chega numa resposta 200 NORMAL — o `try/catch` não
       pega. Sem este `else`, o médico abre a sala, ela abre o app, lê "Nenhuma
       consulta agendada no momento" e PERDE a teleconsulta com a sala aberta
       do outro lado. */
    if (res.ok) {
      setSessions(res.sessions);
      setInstavel(false);
    } else {
      setInstavel(true);
    }
    setLoading(false);
  }

  async function saveNotes(id: string) {
    setSavingNotes(true);
    try {
      const { data } = await supabase.auth.getSession();
      const tk = data.session?.access_token ?? "";
      const res = await savePatientNotes({ data: { accessToken: tk, id, notes } });
      if (!res.ok) {
        toast.error("Não foi possível salvar as anotações. Tente novamente.");
        return;
      }
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, patient_notes: notes } : s)));
      toast.success("Anotações salvas");
    } catch {
      toast.error("Não foi possível salvar as anotações. Tente novamente.");
    } finally {
      setSavingNotes(false);
    }
  }

  const STATUS_LABEL_TC: Record<string, string> = {
    agendada: "Agendada",
    sala_aberta: "Sala aberta",
    encerrada: "Encerrada",
  };
  const STATUS_STYLE_TC: Record<string, string> = {
    agendada: "bg-primary/10 text-primary",
    sala_aberta: "bg-emerald-100 text-emerald-700",
    encerrada: "bg-secondary text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Teleconsulta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando o seu médico abrir a sala, você receberá um e-mail com o link do Google Meet e
          poderá entrar também por aqui com um clique.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Para solicitar uma teleconsulta, entre em contato pelo WhatsApp ou pelo formulário de{" "}
          <strong>Agendamento</strong>.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      ) : instavel ? (
        <NaoConsegueLer
          oQue="suas teleconsultas"
          sossego="Se você tem uma teleconsulta marcada, ela continua marcada."
          aoTentar={() => void load()}
        />
      ) : sessions.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">📱</p>
          <p className="font-serif text-xl text-foreground/70">Nenhuma teleconsulta</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma consulta agendada no momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-3xl card-material p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {s.scheduled_for
                      ? new Date(s.scheduled_for).toLocaleString("pt-BR", {
                          dateStyle: "full",
                          timeStyle: "short",
                        })
                      : "Horário a definir"}
                  </p>
                  {s.doctor_notes && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.doctor_notes}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE_TC[s.status]}`}
                >
                  {STATUS_LABEL_TC[s.status]}
                </span>
              </div>

              {s.status === "sala_aberta" && s.meet_url && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={s.meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    🎥 Entrar na teleconsulta
                  </a>
                  <p className="self-center text-xs text-muted-foreground">
                    Abre o Google Meet em nova aba
                  </p>
                </div>
              )}

              {/* Patient notes */}
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Suas anotações da consulta
                </p>
                <textarea
                  value={s.id === activeSession?.id ? notes : (s.patient_notes ?? "")}
                  onChange={(e) => setNotes(e.target.value)}
                  onFocus={() => {
                    setActiveSession(s);
                    setNotes(s.patient_notes ?? "");
                  }}
                  rows={2}
                  placeholder="Anote dúvidas antes ou orientações recebidas durante a consulta…"
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
                {activeSession?.id === s.id && (
                  <button
                    onClick={() => saveNotes(s.id)}
                    disabled={savingNotes}
                    className="mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {savingNotes ? "Salvando…" : "Salvar anotações"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Carta Semanal do Bebê (Feature #21) ---------- */

function CartaBebêTab({
  profile,
  gest,
  onNavigate,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
}) {
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cachedWeek, setCachedWeek] = useState<number | null>(null);
  const week = gest?.weeks ?? null;

  useEffect(() => {
    if (!week) return;
    loadCached(week);
  }, [week]);

  async function loadCached(w: number) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("baby_letters")
      .select("week, content")
      .eq("user_id", u.user.id)
      .eq("week", w)
      .single();
    if (data?.content) {
      setLetter(data.content);
      setCachedWeek(data.week);
    }
  }

  async function generate() {
    if (!week) return;
    setLoading(true);
    try {
      const baby = babyForWeek(week);
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/carta-semanal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // O endpoint agora exige sessão: era proxy aberto para o Gemini.
          Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          week,
          babyName: profile?.baby_name ?? null,
          babyDesc: `${baby.desc} Tamanho: ${baby.size}. Peso estimado: ${baby.weight}. Comparado a: ${baby.fruit}.`,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setLetter(json.letter);
      setCachedWeek(week);
      // Save to DB
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { error } = await (supabase as any)
          .from("baby_letters")
          .upsert(
            { user_id: u.user.id, week, content: json.letter },
            { onConflict: "user_id,week" },
          );
        if (error) {
          toast.error("Não foi possível salvar a carta. Ela não ficará guardada para depois.");
        }
      }
    } catch (e: any) {
      setLetter("Erro ao gerar a carta: " + (e?.message ?? "tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  if (!gest || !week) {
    return (
      <div className="rounded-3xl card-material p-8 text-center">
        <p className="text-muted-foreground">
          Configure sua gestação em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            Perfil
          </button>{" "}
          para receber a carta semanal do seu bebê.
        </p>
      </div>
    );
  }

  const baby = babyForWeek(week);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl card-material p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-[15px] font-semibold text-primary">Semana {week}</p>
            <p className="mt-1 font-serif text-2xl">Carta do seu bebê</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Uma mensagem especial na perspectiva do {profile?.baby_name ?? "seu bebê"}, gerada por
              IA com base no desenvolvimento real desta semana.
            </p>
          </div>
          <div className="text-4xl">{baby.fruit}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-secondary px-3 py-1">📏 {baby.size}</span>
          <span className="rounded-full bg-secondary px-3 py-1">⚖️ {baby.weight}</span>
        </div>
      </div>

      {/* Letter display */}
      {letter ? (
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 to-background p-8">
          {/* Decorative stamp */}
          <div className="absolute right-6 top-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/20 text-xs font-bold uppercase tracking-wider text-primary/40">
            Semana
            <br />
            {week}
          </div>
          <p className="mb-6 font-serif text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="whitespace-pre-line font-serif text-base leading-relaxed text-foreground">
            {letter}
          </p>
          {cachedWeek === week && (
            <p className="mt-6 text-xs text-muted-foreground">
              Carta da semana {week} · salva automaticamente
            </p>
          )}
        </div>
      ) : (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">💌</p>
          <p className="font-serif text-xl text-foreground/70">Sua carta ainda não chegou</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Clique abaixo para receber uma mensagem especial do seu bebê nesta semana.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading
            ? "Gerando carta…"
            : letter
              ? "Gerar nova carta"
              : "✉️ Receber carta desta semana"}
        </button>
        {letter && (
          <button
            onClick={() => {
              const text = `Carta do bebê — Semana ${week}\n\n${letter}`;
              /* Idem: mensagem curta é `toast`, nunca diálogo do sistema. */
              navigator.clipboard?.writeText(text).then(() => toast.success("Copiado 💛"));
            }}
            className="rounded-full border border-border px-6 py-3 text-sm text-muted-foreground hover:bg-secondary"
          >
            Copiar texto
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        A IA gera uma carta única por semana — clique em "Gerar nova carta" para criar uma versão
        diferente.
      </p>
    </div>
  );
}

/* ---------- Sons para o Bebê (Feature #25) ---------- */

type SoundType = "heartbeat" | "pink-noise" | "binaural" | "lullaby" | "rain";

const SOUND_INFO: Record<
  SoundType,
  { label: string; description: string; minWeek: number; icon: string }
> = {
  heartbeat: {
    label: "Batimento cardíaco materno",
    description: "Sons do coração da mamãe — o primeiro som que o bebê ouve.",
    minWeek: 16,
    icon: "❤️",
  },
  "pink-noise": {
    label: "Ruído rosa",
    description: "Frequências suaves que imitam o ambiente uterino e auxiliam no sono.",
    minWeek: 20,
    icon: "🌊",
  },
  binaural: {
    label: "Batidas binaurais",
    description: "Dois tons levemente diferentes criam uma sensação de relaxamento profundo.",
    minWeek: 24,
    icon: "🎵",
  },
  lullaby: {
    label: "Melodia de ninar",
    description: "Sequência pentatônica suave — o bebê reconhecerá essa melodia após o nascimento.",
    minWeek: 24,
    icon: "🎶",
  },
  rain: {
    label: "Chuva suave",
    description: "Som de chuva filtrado, semelhante ao líquido amniótico.",
    minWeek: 18,
    icon: "🌧️",
  },
};

function SonsBebêTab({
  gest,
  careMode = false,
  onNavigate,
}: {
  gest: Gest;
  careMode?: boolean;
  onNavigate?: (t: Tab) => void;
}) {
  const currentWeek = gest?.weeks ?? 0;
  const [playing, setPlaying] = useState<SoundType | null>(null);
  const [volume, setVolume] = useState(0.5);
  // Chave com prefixo dc-path- para entrar no sync do journey_state (a
  // preferência de sons mais tocados segue a paciente entre aparelhos).
  const [playCount, setPlayCount] = useState<Partial<Record<SoundType, number>>>(() =>
    lsGet<Partial<Record<SoundType, number>>>("dc-path-sons-play-count", {}),
  );
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const masterRef = useRef<GainNode | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatRef = useRef<number>(0);

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      /* `webkitAudioContext` como reserva: o Safari mais antigo (e alguns
         WebViews de iOS) só expõem a versão com prefixo, e sem isto o
         `new AudioContext()` LANÇA — os cinco sons do bebê morriam de uma vez.
         `breath-audio.ts` e `celebrate.ts` já faziam esse desvio; só esta
         tela não fazia. */
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  function stopAll() {
    if (schedulerRef.current) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
    nodesRef.current.forEach((n) => {
      try {
        (n as any).stop?.();
        n.disconnect();
      } catch {}
    });
    nodesRef.current = [];
    if (masterRef.current) {
      masterRef.current.disconnect();
      masterRef.current = null;
    }
    setPlaying(null);
  }

  function playPinkNoise(ctx: AudioContext, master: GainNode) {
    const bufferSize = 4 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(master);
    src.start();
    nodesRef.current.push(src);
  }

  function playRain(ctx: AudioContext, master: GainNode) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.5;
    src.connect(filter);
    filter.connect(master);
    src.start();
    nodesRef.current.push(src);
  }

  function playBinaural(ctx: AudioContext, master: GainNode) {
    const merger = ctx.createChannelMerger(2);
    merger.connect(master);
    const left = ctx.createOscillator();
    const right = ctx.createOscillator();
    const gL = ctx.createGain();
    gL.gain.value = 0.3;
    const gR = ctx.createGain();
    gR.gain.value = 0.3;
    left.frequency.value = 200;
    right.frequency.value = 210;
    left.connect(gL);
    gL.connect(merger, 0, 0);
    right.connect(gR);
    gR.connect(merger, 0, 1);
    left.start();
    right.start();
    nodesRef.current.push(left, right);
  }

  function scheduleHeartbeats(ctx: AudioContext, master: GainNode) {
    // ~72 bpm: frequência cardíaca materna em repouso (o rótulo do som é "coração da mamãe")
    const interval = 60 / 72;
    nextBeatRef.current = ctx.currentTime + 0.1;
    schedulerRef.current = setInterval(() => {
      const t = nextBeatRef.current;
      if (t > ctx.currentTime + 0.3) return;
      // Lub
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = "sine";
      o1.frequency.value = 80;
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(0.4, t + 0.02);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o1.connect(g1);
      g1.connect(master);
      o1.start(t);
      o1.stop(t + 0.14);
      // Dub
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = "sine";
      o2.frequency.value = 65;
      const t2 = t + 0.13;
      g2.gain.setValueAtTime(0, t2);
      g2.gain.linearRampToValueAtTime(0.25, t2 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.1);
      o2.connect(g2);
      g2.connect(master);
      o2.start(t2);
      o2.stop(t2 + 0.12);
      nextBeatRef.current = t + interval;
    }, 50) as ReturnType<typeof setInterval>;
  }

  function scheduleLullaby(ctx: AudioContext, master: GainNode) {
    // C major pentatonic: C4 D4 E4 G4 A4
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
    const dur = 0.6;
    let idx = 0;
    let t = ctx.currentTime + 0.1;

    function scheduleNote() {
      const freq = notes[idx % notes.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
      gain.gain.linearRampToValueAtTime(0, t + dur - 0.05);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
      idx++;
    }

    for (let i = 0; i < 16; i++) scheduleNote();
    schedulerRef.current = setInterval(() => {
      if (t - ctx.currentTime < 1.5) {
        for (let i = 0; i < 8; i++) scheduleNote();
      }
    }, 2000) as ReturnType<typeof setInterval>;
  }

  function play(type: SoundType) {
    if (playing === type) {
      stopAll();
      return;
    }
    stopAll();
    const ctx = getCtx();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    masterRef.current = master;
    if (type === "pink-noise") playPinkNoise(ctx, master);
    else if (type === "rain") playRain(ctx, master);
    else if (type === "binaural") playBinaural(ctx, master);
    else if (type === "heartbeat") scheduleHeartbeats(ctx, master);
    else if (type === "lullaby") scheduleLullaby(ctx, master);
    setPlaying(type);
    const newCount = { ...playCount, [type]: (playCount[type] ?? 0) + 1 };
    setPlayCount(newCount);
    lsSet("dc-path-sons-play-count", newCount);
  }

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => () => stopAll(), []);

  const sortedByPlays = (Object.keys(SOUND_INFO) as SoundType[]).sort(
    (a, b) => (playCount[b] ?? 0) - (playCount[a] ?? 0),
  );

  /* Modo Cuidado: cala. A aba diz "o bebê pode reconhecê-los após o
     nascimento". */
  /* Tela acesa enquanto um som toca. Esta aba existe para embalar — o ruído
     rosa e o batimento são feitos em Web Audio, e o `AudioContext` é suspenso
     quando a tela bloqueia. Um som de ninar que para quando a tela apaga é o
     oposto do que a aba promete.
     Isto NÃO resolve áudio em segundo plano (sair do app ainda corta): para
     isso é preciso plugin nativo, e está anotado no relatório. */
  useEffect(() => {
    if (!playing) return;
    return manterTelaAcesa();
  }, [playing]);

  if (careMode) return <SilencioDoCuidado onNavigate={onNavigate} />;
  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Sons para o bebê</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O bebê começa a ouvir sons por volta da semana 16–18. Sons reproduzidos regularmente
          durante a gestação são reconhecidos pelo recém-nascido.
        </p>
        {currentWeek > 0 && currentWeek < 16 && (
          <p className="mt-3 rounded-xl bg-primary/6 px-3 py-2 text-xs text-primary">
            Na semana {currentWeek}, o bebê ainda não ouve sons externos. A partir da semana 16 o
            sistema auditivo começa a se desenvolver.
          </p>
        )}
      </div>

      {/* Volume */}
      <div className="flex items-center gap-4 rounded-2xl card-material px-5 py-3">
        <span className="text-sm text-muted-foreground">🔉 Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-10 text-right text-xs text-muted-foreground">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Sound cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {sortedByPlays.map((type) => {
          const info = SOUND_INFO[type];
          const isPlaying = playing === type;
          const unlocked = currentWeek === 0 || currentWeek >= info.minWeek;
          const count = playCount[type] ?? 0;
          return (
            <button
              key={type}
              onClick={() => unlocked && play(type)}
              className={`rounded-2xl border p-5 text-left transition-all ${
                isPlaying
                  ? "border-primary bg-primary/10 shadow-md"
                  : unlocked
                    ? "border-border bg-card hover:border-primary/40"
                    : "border-border bg-secondary/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{info.icon}</span>
                    <p className="text-sm font-medium">{info.label}</p>
                    {isPlaying && (
                      <span className="flex gap-0.5">
                        {[1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className="inline-block h-3 w-1 animate-bounce rounded-full bg-primary"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{info.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  {!unlocked && (
                    <span className="text-xs text-muted-foreground">Sem. {info.minWeek}</span>
                  )}
                  {count > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{count}× tocado</p>
                  )}
                </div>
              </div>
              {isPlaying && (
                <p className="mt-3 text-xs font-medium text-primary">
                  ▶ Tocando — clique para pausar
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Most played */}
      {Object.values(playCount).some((v) => v > 0) && (
        <div className="rounded-3xl card-material p-6">
          <p className="font-serif text-lg">Sons favoritos do seu bebê</p>
          <div className="mt-4 space-y-2">
            {sortedByPlays
              .filter((t) => (playCount[t] ?? 0) > 0)
              .map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="text-xl">{SOUND_INFO[t].icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{SOUND_INFO[t].label}</span>
                      <span className="text-muted-foreground">{playCount[t]}×</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.round(((playCount[t] ?? 0) / Math.max(...Object.values(playCount).map((v) => v ?? 0))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Anote os sons favoritos — o bebê pode reconhecê-los após o nascimento 🌟
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Exercícios por Trimestre (Feature #19) ---------- */

type Exercise = {
  id: string;
  title: string;
  category: string;
  duration: string;
  benefit: string;
  description: string;
  steps: string[];
  trimester: number[];
  minWeek: number;
  maxWeek?: number;
  safetyLevel: "verde" | "amarelo";
  caution?: string;
  youtubeSearch: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "kegel",
    title: "Exercícios de Kegel",
    category: "Assoalho Pélvico",
    duration: "10 min",
    benefit: "Fortalece o assoalho pélvico, reduz risco de incontinência e facilita o parto",
    description:
      "Contrações do assoalho pélvico — o exercício mais recomendado durante toda a gestação.",
    steps: [
      "Sente-se ou deite-se confortavelmente",
      "Identifique os músculos do assoalho pélvico (como se fosse segurar a urina)",
      "Contraia por 5 segundos, relaxe por 5 segundos",
      "Repita 10 vezes por série",
      "Faça 3 séries ao longo do dia",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    youtubeSearch: "exercício kegel gestação como fazer",
  },
  {
    id: "agachamento",
    title: "Agachamento com apoio",
    category: "Fortalecimento",
    duration: "15 min",
    benefit: "Fortalece pernas e quadril, abre a pelve para o parto",
    description:
      "Agachamento parcial apoiado na parede — excelente para preparar o corpo para o parto.",
    steps: [
      "Fique de costas para a parede, pés afastados na largura dos ombros",
      "Deslize as costas pela parede até os joelhos formarem ~90°",
      "Segure por 10–30 segundos",
      "Suba devagar contraindo os glúteos",
      "Repita 5–8 vezes",
    ],
    trimester: [1, 2, 3],
    minWeek: 8,
    safetyLevel: "verde",
    caution: "Interrompa se sentir dor pélvica ou pressão excessiva",
    youtubeSearch: "agachamento gestante seguro exercício",
  },
  {
    id: "respiracao-diafragmatica",
    title: "Respiração diafragmática",
    category: "Respiração",
    duration: "10 min",
    benefit: "Reduz ansiedade, melhora oxigenação e prepara para o parto",
    description:
      "Técnica de respiração profunda que acalma o sistema nervoso e aumenta a oxigenação.",
    steps: [
      "Sente-se confortavelmente com uma mão na barriga",
      "Inspire pelo nariz contando até 4, sentindo a barriga subir",
      "Segure por 2 segundos",
      "Expire lentamente pela boca contando até 6",
      "Repita por 10 ciclos, 2× ao dia",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    youtubeSearch: "respiração diafragmática gestantes técnica",
  },
  {
    id: "caminhada",
    title: "Caminhada moderada",
    category: "Cardio",
    duration: "20–30 min",
    benefit: "Melhora circulação, controla peso, reduz inchaço e melhora humor",
    description: "A caminhada é o exercício mais seguro e recomendado durante toda a gestação.",
    steps: [
      "Use tênis com boa sustentação",
      "Comece com 10 min e aumente gradualmente",
      "Mantenha ritmo confortável — você deve conseguir conversar",
      "Hidrate-se bem antes, durante e depois",
      "Evite horários muito quentes (prefira manhã cedo ou fim de tarde)",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    caution: "Reduza a intensidade e distância no 3º trimestre conforme o conforto",
    youtubeSearch: "caminhada gestante benefícios dicas segurança",
  },
  {
    id: "gato-vaca",
    title: "Gato e Vaca (Cat-Cow)",
    category: "Yoga",
    duration: "10 min",
    benefit: "Alivia dor lombar, melhora postura e mobiliza a coluna vertebral",
    description:
      "Movimento clássico de yoga — excelente para aliviar as dores lombares comuns na gestação.",
    steps: [
      "Ajoelhe-se em 4 apoios (mãos e joelhos)",
      "Inspire: arqueie as costas para baixo, levante a cabeça (posição vaca)",
      "Expire: redonde as costas para cima, abaixe a cabeça (posição gato)",
      "Repita 10–15 vezes de forma fluida e suave",
      "Mantenha os movimentos lentos e controlados",
    ],
    trimester: [1, 2, 3],
    minWeek: 8,
    safetyLevel: "verde",
    youtubeSearch: "yoga gestante gato vaca lombar alívio",
  },
  {
    id: "alongamento-pescoco",
    title: "Alongamento de pescoço e ombros",
    category: "Alongamento",
    duration: "8 min",
    benefit: "Alivia tensão cervical e cefaleias comuns no 1º trimestre",
    description: "Alongamentos suaves para aliviar a tensão acumulada na região cervical.",
    steps: [
      "Sente-se ereto numa cadeira sem encostar na coluna",
      "Incline a cabeça lateralmente devagar, orelha ao ombro",
      "Segure 20–30 segundos de cada lado",
      "Gire o pescoço suavemente em semicírculos (NUNCA círculo completo)",
      "Encolha e abaixe os ombros, solte. Repita 5 vezes.",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    youtubeSearch: "alongamento pescoço ombros gestante tensão cervical",
  },
  {
    id: "borboleta",
    title: "Postura da borboleta",
    category: "Yoga",
    duration: "10 min",
    benefit: "Abre o quadril, flexibiliza a virilha e prepara para o parto",
    description: "Sentada com as plantas dos pés juntas — abre o quadril progressivamente.",
    steps: [
      "Sente-se no chão com as costas apoiadas na parede",
      "Junte as plantas dos pés, deixando os joelhos caírem para os lados",
      "Segure os pés com as mãos",
      "Mantenha a posição por 1–3 minutos respirando profundamente",
      'Opcionalmente, mova os joelhos levemente para cima e para baixo ("asa de borboleta")',
    ],
    trimester: [1, 2, 3],
    minWeek: 10,
    safetyLevel: "verde",
    caution: "Não force além do conforto — respeite os limites do seu corpo",
    youtubeSearch: "postura borboleta gestante yoga quadril",
  },
  {
    id: "hidroginastica",
    title: "Hidroginástica gestacional",
    category: "Cardio",
    duration: "30–45 min",
    benefit: "Baixo impacto, alivia inchaço e dores articulares, melhora circulação",
    description:
      "A água reduz o impacto sobre as articulações — ideal especialmente no 3º trimestre.",
    steps: [
      "Procure uma turma específica para gestantes",
      "Use roupa de banho confortável e óculos de natação",
      "Comunicique à professora sua semana gestacional",
      "Prefira piscinas aquecidas (evite frio extremo)",
      "Hidrate-se mesmo dentro d'água",
    ],
    trimester: [2, 3],
    minWeek: 14,
    safetyLevel: "verde",
    youtubeSearch: "hidroginástica gestante benefícios exercícios água",
  },
  {
    id: "yoga-3t",
    title: "Yoga para o 3º trimestre",
    category: "Yoga",
    duration: "20 min",
    benefit: "Prepara corpo e mente para o parto, alivia desconfortos do final da gestação",
    description:
      "Sequência de yoga adaptada para o 3º trimestre com foco em abertura de quadril e relaxamento.",
    steps: [
      "Postura do guerreiro modificada: apoie a mão na parede",
      "Postura da pomba: com apoios, abre quadril profundamente",
      "Postura da criança adaptada: abre joelhos para a barriga",
      "Savasana lateral: deite-se de lado com travesseiros de suporte",
      "Mantenha cada posição por 1–3 minutos",
    ],
    trimester: [3],
    minWeek: 28,
    safetyLevel: "verde",
    youtubeSearch: "yoga terceiro trimestre gestante preparação parto",
  },
];

const EXERCISE_CATEGORIES = [...new Set(EXERCISES.map((e) => e.category))];

function ExerciciosTab({ gest }: { gest: Gest }) {
  const currentWeek = gest?.weeks ?? 0;
  const currentTrimester = gest ? trimesterForWeek(gest.weeks) : null;
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [expanded, setExpanded] = useState<string | null>(null);

  const available = EXERCISES.filter((ex) => {
    const weekOk =
      currentWeek === 0 ||
      (currentWeek >= ex.minWeek && (!ex.maxWeek || currentWeek <= ex.maxWeek));
    const trimOk = currentTrimester === null || ex.trimester.includes(currentTrimester);
    const catOk = catFilter === "todos" || ex.category === catFilter;
    return catOk && weekOk && trimOk;
  });

  const locked = EXERCISES.filter((ex) => {
    const weekOk =
      currentWeek > 0 && (currentWeek < ex.minWeek || (ex.maxWeek && currentWeek > ex.maxWeek));
    const catOk = catFilter === "todos" || ex.category === catFilter;
    return catOk && weekOk;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Exercícios para gestantes</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentTrimester
            ? `Exercícios liberados para o ${currentTrimester}º trimestre (semana ${currentWeek}).`
            : "Configure sua gestação em Perfil para ver os exercícios recomendados para sua semana."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          ⚠️ Consulte seu médico antes de iniciar qualquer atividade física na gestação.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {["todos", ...EXERCISE_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              catFilter === cat
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {cat === "todos" ? "Todos" : cat}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {available.length === 0 && locked.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum exercício encontrado para este filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {available.map((ex) => (
            <div key={ex.id} className="rounded-2xl card-material overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}
                className="flex w-full items-start justify-between gap-3 p-5 text-left"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{ex.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${ex.safetyLevel === "verde" ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}
                    >
                      {ex.safetyLevel === "verde" ? "✓ Liberado" : "⚠ Consulte médico"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ex.category} · {ex.duration} · {ex.benefit}
                  </p>
                </div>
                <span className="text-muted-foreground">{expanded === ex.id ? "▲" : "▼"}</span>
              </button>

              {expanded === ex.id && (
                <div className="border-t border-border px-5 pb-5">
                  <p className="mt-4 text-sm text-muted-foreground">{ex.description}</p>
                  {ex.caution && (
                    <p className="mt-2 rounded-xl bg-primary/6 px-3 py-2 text-xs text-primary">
                      {ex.caution}
                    </p>
                  )}
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Como fazer
                    </p>
                    <ol className="mt-2 space-y-1.5">
                      {ex.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.youtubeSearch)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary"
                  >
                    ▶ Ver vídeos no YouTube
                  </a>
                </div>
              )}
            </div>
          ))}

          {locked.length > 0 && (
            <details className="rounded-2xl p-4">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {locked.length} exercício(s) não disponíveis para sua semana atual
              </summary>
              <div className="mt-3 space-y-2">
                {locked.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground"
                  >
                    <span>{ex.title}</span>
                    <span>A partir da semana {ex.minWeek}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Quartinho (Feature #29) ---------- */

type QuartinhoItem = {
  id: string;
  category: string;
  label: string;
  priority: "essencial" | "recomendado" | "opcional";
  weekSuggested: number;
  searchQuery: string;
};

const QUARTO_ITEMS: QuartinhoItem[] = [
  // Sono
  {
    id: "qb-bercinho",
    category: "Sono",
    label: "Berço ou mini berço",
    priority: "essencial",
    weekSuggested: 25,
    searchQuery: "berço bebê",
  },
  {
    id: "qb-colchao",
    category: "Sono",
    label: "Colchão firminho para berço",
    priority: "essencial",
    weekSuggested: 25,
    searchQuery: "colchão berço bebê",
  },
  {
    id: "qb-protetor",
    category: "Sono",
    label: "Protetor de berço respirável",
    priority: "recomendado",
    weekSuggested: 28,
    searchQuery: "protetor berço respirável",
  },
  {
    id: "qb-mosquiteiro",
    category: "Sono",
    label: "Mosquiteiro para berço",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "mosquiteiro berço bebê",
  },
  {
    id: "qb-baba",
    category: "Sono",
    label: "Babá eletrônica / monitor de bebê",
    priority: "recomendado",
    weekSuggested: 32,
    searchQuery: "babá eletrônica monitor bebê",
  },
  {
    id: "qb-cortina",
    category: "Sono",
    label: "Cortina blackout",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "cortina blackout quarto bebê",
  },
  // Troca
  {
    id: "qb-trocador",
    category: "Troca",
    label: "Trocador com proteção lateral",
    priority: "essencial",
    weekSuggested: 28,
    searchQuery: "trocador bebê",
  },
  {
    id: "qb-fraldas-rn",
    category: "Troca",
    label: "Fraldas descartáveis RN e P",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "fralda descartável recém-nascido",
  },
  {
    id: "qb-toalhinhas",
    category: "Troca",
    label: "Toalhinhas umedecidas sem álcool",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "toalhinhas umedecidas bebê sem álcool",
  },
  {
    id: "qb-pomada",
    category: "Troca",
    label: "Pomada para assadura",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "pomada assadura bebê",
  },
  {
    id: "qb-termometro",
    category: "Troca",
    label: "Termômetro digital axilar",
    priority: "essencial",
    weekSuggested: 32,
    searchQuery: "termômetro digital bebê",
  },
  // Banho
  {
    id: "qb-banheira",
    category: "Banho",
    label: "Banheira plástica com suporte",
    priority: "essencial",
    weekSuggested: 28,
    searchQuery: "banheira bebê plástica",
  },
  {
    id: "qb-sabonete",
    category: "Banho",
    label: "Sabonete líquido neutro para bebê",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "sabonete líquido neutro bebê",
  },
  {
    id: "qb-shampoo",
    category: "Banho",
    label: "Shampoo para bebê sem lágrimas",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "shampoo bebê sem lágrimas",
  },
  {
    id: "qb-toalha",
    category: "Banho",
    label: "Toalhas com capuz (mín. 3)",
    priority: "essencial",
    weekSuggested: 32,
    searchQuery: "toalha capuz bebê",
  },
  {
    id: "qb-algodao",
    category: "Banho",
    label: "Algodão hidrófilo e cotonete bebê",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "algodão hidrófilo bebê cotonete",
  },
  // Alimentação
  {
    id: "qb-almofada",
    category: "Alimentação",
    label: "Almofada de amamentação",
    priority: "essencial",
    weekSuggested: 30,
    searchQuery: "almofada amamentação",
  },
  {
    id: "qb-bomba",
    category: "Alimentação",
    label: "Bomba de leite (manual ou elétrica)",
    priority: "recomendado",
    weekSuggested: 32,
    searchQuery: "bomba de leite materno",
  },
  {
    id: "qb-mamadeiras",
    category: "Alimentação",
    label: "Mamadeiras anticolica (caso necessário)",
    priority: "opcional",
    weekSuggested: 35,
    searchQuery: "mamadeira anticólica bebê",
  },
  {
    id: "qb-creme",
    category: "Alimentação",
    label: "Lanolina para mamilos",
    priority: "recomendado",
    weekSuggested: 34,
    searchQuery: "lanolina mamilo amamentação",
  },
  // Transporte
  {
    id: "qb-carrinho",
    category: "Transporte",
    label: "Carrinho de bebê",
    priority: "essencial",
    weekSuggested: 28,
    searchQuery: "carrinho de bebê",
  },
  {
    id: "qb-bebe-conforto",
    category: "Transporte",
    label: "Bebê conforto (obrigatório por lei)",
    priority: "essencial",
    weekSuggested: 26,
    searchQuery: "bebê conforto cadeirinha carro",
  },
  {
    id: "qb-sling",
    category: "Transporte",
    label: "Sling ou canguru ergonômico",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "sling ergonômico bebê",
  },
  // Segurança e conforto
  {
    id: "qb-aspirador",
    category: "Saúde",
    label: "Aspirador nasal",
    priority: "essencial",
    weekSuggested: 35,
    searchQuery: "aspirador nasal bebê",
  },
  {
    id: "qb-cortador-unhas",
    category: "Saúde",
    label: "Kit manicure para bebê",
    priority: "essencial",
    weekSuggested: 35,
    searchQuery: "kit manicure cortador unhas bebê",
  },
  {
    id: "qb-cadeira",
    category: "Conforto",
    label: "Cadeira de amamentação/poltrona",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "cadeira amamentação poltrona",
  },
  {
    id: "qb-humidificador",
    category: "Conforto",
    label: "Umidificador de ar",
    priority: "opcional",
    weekSuggested: 32,
    searchQuery: "umidificador ar quarto bebê",
  },
];

const PRIORITY_STYLE: Record<QuartinhoItem["priority"], { badge: string; label: string }> = {
  essencial: { badge: "bg-rose-100 text-rose-700", label: "Essencial" },
  recomendado: { badge: "bg-primary/10 text-primary", label: "Recomendado" },
  opcional: { badge: "bg-secondary text-muted-foreground", label: "Opcional" },
};

const QUARTO_CATEGORIES = [...new Set(QUARTO_ITEMS.map((i) => i.category))];

function QuartinhoTab({ gest }: { gest: Gest }) {
  // Chave com prefixo dc-path- para pegar carona no sync do journey_state:
  // o checklist do quartinho passa a viver na CONTA, não só no aparelho.
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(lsGet<string[]>("dc-path-quartinho-checked", [])),
  );
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [priorityFilter, setPriorityFilter] = useState<string>("todos");
  const currentWeek = gest?.weeks ?? 0;

  function toggle(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    lsSet("dc-path-quartinho-checked", [...next]);
  }

  const filtered = QUARTO_ITEMS.filter((item) => {
    const catOk = catFilter === "todos" || item.category === catFilter;
    const prioOk = priorityFilter === "todos" || item.priority === priorityFilter;
    return catOk && prioOk;
  });

  const essentialItems = QUARTO_ITEMS.filter((i) => i.priority === "essencial");
  const doneEssential = essentialItems.filter((i) => checked.has(i.id)).length;
  const totalChecked = QUARTO_ITEMS.filter((i) => checked.has(i.id)).length;
  const completionPct = Math.round((totalChecked / QUARTO_ITEMS.length) * 100);

  // Items to focus this week
  const upcoming =
    currentWeek > 0
      ? QUARTO_ITEMS.filter(
          (i) =>
            !checked.has(i.id) &&
            i.weekSuggested <= currentWeek + 4 &&
            i.weekSuggested >= currentWeek - 1,
        )
          .sort((a, b) => a.weekSuggested - b.weekSuggested)
          .slice(0, 5)
      : [];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="rounded-3xl card-material p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-serif text-lg">Preparação do quartinho</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {doneEssential}/{essentialItems.length} itens essenciais adquiridos · {totalChecked}/
              {QUARTO_ITEMS.length} total
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/20 text-sm font-bold text-primary">
            {completionPct}%
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Upcoming this week */}
      {upcoming.length > 0 && (
        <div className="rounded-3xl border border-primary/20 bg-primary/6 p-5">
          <p className="text-sm font-semibold text-foreground">⏰ Comprar nas próximas semanas</p>
          <div className="mt-3 space-y-2">
            {upcoming.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs text-primary">
                <span>{item.label}</span>
                <span>Sem. {item.weekSuggested}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {["todos", ...QUARTO_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${catFilter === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}
            >
              {c === "todos" ? "Todas as categorias" : c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["todos", "essencial", "recomendado", "opcional"].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${priorityFilter === p ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}
            >
              {p === "todos" ? "Todas as prioridades" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Items grouped by category */}
      {QUARTO_CATEGORIES.filter((cat) => catFilter === "todos" || catFilter === cat).map((cat) => {
        const items = filtered.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const doneCat = items.filter((i) => checked.has(i.id)).length;
        return (
          <div key={cat} className="rounded-3xl card-material overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="font-medium">{cat}</p>
              <span className="text-xs text-muted-foreground">
                {doneCat}/{items.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {items.map((item) => {
                const isChecked = checked.has(item.id);
                const pStyle = PRIORITY_STYLE[item.priority];
                const isTimely = currentWeek > 0 && Math.abs(item.weekSuggested - currentWeek) <= 3;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-5 py-3.5 ${isChecked ? "bg-secondary/30" : ""}`}
                  >
                    <button
                      onClick={() => toggle(item.id)}
                      className={`h-5 w-5 shrink-0 rounded border-2 transition-colors ${isChecked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}
                    >
                      {isChecked && (
                        <span className="flex items-center justify-center text-xs">✓</span>
                      )}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`text-sm ${isChecked ? "line-through text-muted-foreground" : ""}`}
                      >
                        {item.label}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${pStyle.badge}`}>
                          {pStyle.label}
                        </span>
                        {currentWeek > 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${isTimely ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
                          >
                            Sem. {item.weekSuggested}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={`https://www.amazon.com.br/s?k=${encodeURIComponent(item.searchQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full border border-border p-1.5 text-xs text-muted-foreground hover:bg-secondary"
                      title="Buscar na Amazon"
                    >
                      🛒
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Conta Regressiva ---------- */
const MILESTONES = [
  { week: 12, label: "Fim do 1º trimestre", emoji: "🌱" },
  { week: 20, label: "Metade da gestação", emoji: "🌟" },
  { week: 24, label: "Viabilidade fetal", emoji: "💪" },
  { week: 28, label: "3º trimestre", emoji: "🌙" },
  { week: 34, label: "Bebê já pode nascer", emoji: "🎉" },
  { week: 37, label: "Gestação a termo", emoji: "✅" },
  { week: 40, label: "Data provável do parto", emoji: "🍼" },
];

function CountdownTab({
  profile,
  gest,
  onNavigate,
  careMode = false,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
  careMode?: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile || !gest) {
    return (
      <div className="rounded-3xl card-material p-8 text-center text-muted-foreground">
        Configure seu perfil (DPP ou DUM) para ver a contagem regressiva.
      </div>
    );
  }

  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  if (!due) {
    return (
      <div className="rounded-3xl card-material p-8 text-center text-muted-foreground">
        Adicione a data provável do parto em{" "}
        <button
          type="button"
          onClick={() => onNavigate("Perfil")}
          className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
        >
          Perfil
        </button>
        .
      </div>
    );
  }

  const dueMs = new Date(due + "T00:00:00").getTime();
  const diffMs = Math.max(0, dueMs - now);
  const isDueToday = now >= dueMs && now < dueMs + 86400000;
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const progress = Math.min(100, (gest.totalDays / 280) * 100);
  // Reta final: âncora unificada (idade gestacional + DPP). Havendo mensagem de
  // reta e não sendo o dia da DPP, troca a contagem regressiva por acolhimento —
  // nunca deixa a contagem congelada em 00:00:00:00.
  const reta = retaFinalMensagemFor({ weeks: gest.weeks, dueDate: due });

  const lmpMs = profile.lmp_date
    ? new Date(profile.lmp_date + "T00:00:00").getTime()
    : dueMs - 280 * 86400000;

  // Modo Cuidado: sem contagem regressiva nem comemoração — só acolhimento.
  if (careMode) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 text-center">
        <p className="text-3xl">🤍</p>
        <p className="mt-3 font-serif text-xl text-foreground">Estamos aqui com você</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A contagem está pausada. No seu tempo. Se precisar, fale com o consultório ou acesse o
          apoio emocional.
        </p>
        <button
          onClick={() => onNavigate("Bem-estar")}
          className="press mt-5 rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Apoio emocional
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!isDueToday && reta ? (
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-rose-50 p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-serif text-[15px] font-semibold text-primary">{reta.eyebrow}</p>
          <p className="mt-3 font-serif text-2xl text-foreground">{reta.titulo}</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-foreground/80">
            {reta.corpo}
          </p>
          <div className="mx-auto mt-5 max-w-md rounded-2xl border border-primary/15 bg-white/60 p-4 text-left text-sm leading-relaxed text-foreground/75">
            <span className="mr-1">🤍</span>
            {reta.dica}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-rose-50 p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-serif text-[15px] font-semibold text-primary">Faltam para a DPP</p>
          <div className="mt-6 flex justify-center gap-4 sm:gap-8">
            {[
              { value: days, label: "dias" },
              { value: hours, label: "horas" },
              { value: mins, label: "min" },
              { value: secs, label: "seg" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center">
                <span className="tabular-nums text-4xl font-bold text-primary sm:text-5xl">
                  {String(value).padStart(2, "0")}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <div className="mx-auto h-3 max-w-sm overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {progress.toFixed(1)}% da gestação completa
            </p>
          </div>
          {isDueToday && (
            <p className="mt-4 text-lg font-semibold text-primary">
              🎊 Hoje é a data provável do parto! Parabéns, mamãe!
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-4 font-semibold">Marcos da gestação</h3>
        <div className="space-y-3">
          {MILESTONES.map((m) => {
            const milestoneMs = lmpMs + m.week * 7 * 86400000;
            const passed = now >= milestoneMs;
            const isCurrent = gest.weeks === m.week;
            const diffDays = Math.ceil((milestoneMs - now) / 86400000);

            return (
              <div
                key={m.week}
                className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : passed
                      ? "border-border bg-secondary/30 opacity-70"
                      : "border-border bg-card"
                }`}
              >
                <span className="text-2xl">{passed ? "✅" : m.emoji}</span>
                <div className="flex-1">
                  <p
                    className={`font-medium ${passed ? "line-through text-muted-foreground" : ""}`}
                  >
                    {m.label}
                  </p>
                  <p className="text-xs text-muted-foreground">Semana {m.week}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {passed ? "Conquistado! 🎉" : isCurrent ? "Esta semana!" : `Em ${diffDays} dias`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Álbum Familiar ---------- */
function AlbumTab({ profile }: { profile: Profile | null }) {
  const [posts, setPosts] = useState<AlbumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [emoji, setEmoji] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ⚠️ Falha de leitura NÃO é lista vazia — ver `NaoConsegueLer`. */
  const [instavel, setInstavel] = useState(false);

  /* ⚠️ Nomeada para o "Tentar de novo" poder chamá-la: um estado de falha sem
     saída é o vazio silencioso outra vez, só que honesto. */
  const load = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await getMyAlbumPosts({ data: { accessToken: s.session.access_token } });
    /* ⚠️ "Nenhuma memória ainda" — com o contador do título dizendo
         "Álbum (0 memórias)" — faz ela achar que as fotos da gestação foram
         apagadas. É o menor risco clínico desta leva e o maior risco
         emocional. */
    if (res.ok) {
      setPosts(res.posts);
      setInstavel(false);
    } else {
      setInstavel(true);
    }

    // Get companion invite token for sharing
    const { data: invites } = await (supabase as any)
      .from("companion_invites")
      /* ⚠️ **`album_token` TEM DE SER PEDIDO.** Este `select` trazia só
           `token`, então `invites[0].album_token` era SEMPRE `undefined` e o
           `??` abaixo caía sempre no recuo — que não era recuo nenhum: era o
           caminho de todo mundo. E o comentário ao lado afirmava o contrário,
           dizendo que depois do SQL `album_token` estaria preenchido. Está —
           NO BANCO. A consulta é que não o trazia. */
      .select("token, album_token")
      .eq("user_id", s.session.user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (invites?.[0]?.token) {
      setInviteToken(invites[0].token);
      /**
       * ⚠️ **SEM `album_token`, O LINK NÃO SAI — e nunca cai no `token`.**
       *
       * Os dois vivem na mesma linha e têm privilégios OPOSTOS: `token` abre
       * o painel do acompanhante E os SOS dos últimos 30 minutos com
       * latitude e longitude (`getRecentPanicByToken`, que filtra por
       * `token`). `album_token` abre só o álbum.
       *
       * O link do álbum é o que ela cola no grupo da família — numa
       * influenciadora, para muito mais gente. Um recuo para `token` aqui
       * publica a localização dela em tempo real de emergência para todo
       * mundo que receber a mensagem.
       *
       * E o recuo nem funcionava: `getFamilyAlbum` busca por `album_token`,
       * então um link com o `token` do acompanhante **não abre o álbum**.
       * Ou seja, o recuo trocava um álbum que não abre por um vazamento de
       * GPS — as duas pontas erradas de uma vez.
       *
       * Sem a coluna, o certo é NÃO oferecer o link: o álbum ficar
       * indisponível até o SQL rodar é recuperável; o GPS espalhado no
       * WhatsApp não é.
       */
      const doAlbum = invites[0].album_token;
      setShareUrl(doAlbum ? `${window.location.origin}/album/${doAlbum}` : "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageData(codificarFoto(canvas, 0.75));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!caption && !imageData && !emoji) return;
    setSubmitting(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setSubmitting(false);
      return;
    }
    const displayName = profile?.display_name ?? "Mamãe";
    const res = await createAlbumPost({
      data: {
        accessToken: s.session.access_token,
        authorName: displayName,
        caption: caption || null,
        imageData,
        emoji: emoji || null,
      },
    });
    if (res.ok) {
      const res2 = await getMyAlbumPosts({ data: { accessToken: s.session.access_token } });
      if (res2.ok) setPosts(res2.posts);
      setCaption("");
      setEmoji("");
      setImageData(null);
      if (fileRef.current) fileRef.current.value = "";
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await deleteAlbumPost({ data: { accessToken: s.session.access_token, id } });
    if (!res.ok) {
      toast.error("Não foi possível excluir a foto. Tente novamente.");
      return;
    }
    setPosts((p) => p.filter((x) => x.id !== id));
  }

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl card-material p-6">
        <h3 className="font-semibold mb-4">Adicionar ao álbum</h3>
        <div className="space-y-3">
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary"
          />
          {imageData && (
            <div className="relative inline-block">
              <img
                src={imageData}
                alt="pré-visualização da imagem"
                className="h-32 rounded-xl object-cover"
              />
              <button
                onClick={() => {
                  setImageData(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
              >
                ×
              </button>
            </div>
          )}
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Legenda (opcional)…"
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <div className="flex gap-2">
            {["💕", "🤰", "👶", "🌸", "⭐", "🎀", "💙", "🌈"].map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(emoji === e ? "" : e)}
                className={`rounded-xl p-2 text-xl transition-colors ${emoji === e ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-secondary"}`}
              >
                {e}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || (!caption && !imageData && !emoji)}
            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "Salvando…" : "Publicar no álbum"}
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium mb-2">Link para família ver o álbum:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white"
            >
              Copiar
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {/* ⚠️ A frase antiga dizia "a família acessa o álbum com o MESMO
                link do acompanhante" — e ensinava exatamente o que não pode
                ser verdade: o link do acompanhante abre o alerta de emergência
                com localização. Os dois links são diferentes de propósito. */}
            Este link abre só o álbum. Ele é diferente do link do acompanhante, que mostra mais
            coisas suas.
          </p>
        </div>
      )}

      {!inviteToken && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          Crie um convite de acompanhante na aba <strong>Acompanhante</strong> para compartilhar o
          álbum com a família.
        </div>
      )}

      {/* ⚠️ **O SILÊNCIO AQUI LERIA COMO APP QUEBRADO.** Existe convite, e mesmo
          assim não há link: é o caso em que a linha ainda não tem `album_token`
          (o SQL da rotação não rodou). O link NÃO cai no token do acompanhante
          — ele abre o SOS com GPS —, então em vez de um link perigoso ela
          recebe a explicação. */}
      {inviteToken && !shareUrl && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          O link do álbum ainda não está disponível nesta conta. Ele é diferente do link do
          acompanhante de propósito — o do acompanhante abre o seu alerta de emergência, e não pode
          ir para o grupo da família. Avise o consultório para liberar.
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-4">
          {/* ⚠️ O contador é a afirmação em NÚMERO, e ele mente antes da prosa:
              "Álbum (0 memórias)" já diz que não há nada, mesmo com o aviso de
              falha logo abaixo. */}
          Álbum
          {instavel ? "" : ` (${posts.length} ${posts.length === 1 ? "memória" : "memórias"})`}
        </h3>
        {instavel ? (
          <NaoConsegueLer
            oQue="seu álbum"
            sossego="Suas fotos continuam guardadas."
            aoTentar={() => void load()}
          />
        ) : posts.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-4xl mb-3">📷</p>
            <p className="font-serif text-xl text-foreground/70">Nenhuma memória ainda</p>
            <p className="mt-2 text-sm text-muted-foreground">Comece adicionando a primeira!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="group relative rounded-2xl card-material overflow-hidden"
              >
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={post.caption ?? "Foto do álbum"}
                    className="w-full object-cover"
                    style={{ maxHeight: 220 }}
                  />
                )}
                <div className="p-4">
                  {post.emoji && <span className="text-2xl">{post.emoji}</span>}
                  {post.caption && <p className="mt-1 text-sm">{post.caption}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {post.author_name} · {new Date(post.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-xs text-destructive transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Nome do Bebê ---------- */
function NomeTab({ profile }: { profile: Profile | null }) {
  const [session, setSession] = useState<NameSession | null>(null);
  const [entries, setEntries] = useState<NameEntry[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const res = await getOrCreateNameSession({ data: { accessToken: s.session.access_token } });
      if (res.ok) {
        setSession(res.session);
        setEntries(res.entries);
        setShareUrl(`${window.location.origin}/votar-nome/${res.session.share_token}`);
      }
      setLoading(false);
    })();
  }, []);

  async function handleAddName() {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setSaving(false);
      return;
    }
    const addRes = await addNameByPatient({
      data: {
        accessToken: s.session.access_token,
        name: newName.trim(),
        suggestedBy: "Mamãe",
      },
    });
    if (!addRes.ok) {
      toast.error("Não foi possível adicionar o nome. Tente novamente.");
      setSaving(false);
      return;
    }
    const res = await getOrCreateNameSession({ data: { accessToken: s.session.access_token } });
    if (res.ok) {
      setSession(res.session);
      setEntries(res.entries);
    }
    setNewName("");
    setSaving(false);
  }

  async function handleToggle(isActive: boolean, revealWinner: boolean) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await toggleNameSession({
      data: { accessToken: s.session.access_token, isActive, revealWinner },
    });
    if (!res.ok) {
      toast.error("Não foi possível atualizar a votação. Tente novamente.");
      return;
    }
    setSession((prev) =>
      prev ? { ...prev, is_active: isActive, reveal_winner: revealWinner } : prev,
    );
  }

  async function handleRemove(entryId: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await removeNameEntry({ data: { accessToken: s.session.access_token, entryId } });
    if (!res.ok) {
      toast.error("Não foi possível remover o nome. Tente novamente.");
      return;
    }
    setEntries((e) => e.filter((x) => x.id !== entryId));
  }

  if (loading) return <TabSkeleton />;
  if (!session)
    return <div className="text-muted-foreground text-center py-12">Erro ao carregar sessão.</div>;

  const sortedEntries = [...entries].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  const maxVotes = sortedEntries[0]?.vote_count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center justify-between rounded-3xl card-material p-6">
        <div>
          <h3 className="font-semibold">Votação de nomes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {session.is_active ? "Aberta para votos" : "Votação encerrada"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleToggle(!session.is_active, session.reveal_winner)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              session.is_active ? "bg-secondary text-foreground" : "bg-primary text-white"
            }`}
          >
            {session.is_active ? "Encerrar votação" : "Reabrir votação"}
          </button>
          <button
            onClick={() => handleToggle(session.is_active, !session.reveal_winner)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              session.reveal_winner
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}
          >
            {session.reveal_winner ? "Revelar vencedor ✓" : "Revelar vencedor"}
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium mb-2">Link para a família votar:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white"
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl card-material p-6">
        <h3 className="font-semibold mb-3">Sugerir nome</h3>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddName()}
            placeholder="Nome do bebê…"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <button
            onClick={handleAddName}
            disabled={saving || !newName.trim()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4">
          Nomes ({entries.length}){" "}
          {!session.reveal_winner && entries.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              — votos ocultos para a família
            </span>
          )}
        </h3>
        {entries.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-4xl mb-3">👶</p>
            <p className="font-serif text-xl text-foreground/70">Nenhum nome ainda</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione o primeiro ou compartilhe o link para a família sugerir!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEntries.map((entry, i) => {
              const votes = entry.vote_count ?? 0;
              const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${
                    i === 0 && votes > 0
                      ? "border-primary/25 bg-primary/8"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {i === 0 && votes > 0 ? "👑" : `${i + 1}°`}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">por {entry.suggested_by}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{votes}</p>
                    <p className="text-xs text-muted-foreground">
                      {votes === 1 ? "voto" : "votos"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="text-xs text-destructive hover:opacity-80"
                    title="Remover nome"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 36 — Escola do Bebê
───────────────────────────────────────────────────────────────────────────── */

function EscolaBebêTab({ gest, onNavigate }: { gest: Gest; onNavigate: (tab: string) => void }) {
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWeek = gest?.weeks ?? 0;

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoading(false);
        return;
      }
      const res = await getCourseProgress({ data: { accessToken: s.session.access_token } });
      if (res.ok) setProgress(res.progress);
      setLoading(false);
    })();
  }, []);

  const completedCount = COURSE_MODULES.filter((m) =>
    progress.some((p) => p.module_week === m.week),
  ).length;
  const hasCertificate = COURSE_MODULES.length > 0 && completedCount >= COURSE_MODULES.length;
  const unlockedCount = COURSE_MODULES.filter((m) => currentWeek >= m.week).length;
  const nextLesson = COURSE_MODULES.find(
    (m) => currentWeek >= m.week && !progress.some((p) => p.module_week === m.week),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* As lições agora moram DENTRO do caminho — esta aba vira a porta de entrada */}
      <div className="glass-card glass-pink rounded-3xl p-8 text-center">
        <p className="text-5xl">📚</p>
        <h2 className="mt-3 font-serif text-2xl">As lições agora fazem parte da sua jornada!</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Cada semana-chave da gestação tem uma <strong>moeda de lição</strong> no seu caminho:
          aprenda o conteúdo, responda o quiz e ganhe a estrela — tudo dentro do jogo.
        </p>
        <button
          onClick={() => onNavigate("Caminho")}
          className="press mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-float)]"
        >
          🗺️ Ir para o Caminho
        </button>
        {nextLesson && (
          <p className="mt-3 text-xs text-muted-foreground">
            Próxima lição disponível: <strong>semana {nextLesson.week}</strong> — {nextLesson.title}
          </p>
        )}
      </div>

      {/* Progresso resumido */}
      <div className="rounded-3xl card-material p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg">Seu progresso</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {loading
                ? "Carregando…"
                : `${completedCount} de ${COURSE_MODULES.length} lições · ${unlockedCount} já liberadas`}
            </p>
          </div>
          {hasCertificate && (
            <div className="rounded-2xl border border-primary/30 bg-primary/6 px-4 py-2 text-center">
              <p className="text-lg">🎓</p>
              <p className="text-xs font-semibold text-primary">Certificado</p>
            </div>
          )}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${COURSE_MODULES.length > 0 ? (completedCount / COURSE_MODULES.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {COURSE_MODULES.map((m) => {
            const done = progress.some((p) => p.module_week === m.week);
            const unlocked = currentWeek >= m.week;
            return (
              <button
                key={m.week}
                onClick={() => onNavigate("Caminho")}
                title={`Semana ${m.week}: ${m.title}`}
                className={`press flex h-11 w-11 items-center justify-center rounded-xl text-lg ${
                  done
                    ? "bg-amber-100"
                    : unlocked
                      ? "bg-violet-50"
                      : "bg-slate-50 opacity-40 grayscale"
                }`}
              >
                {done ? "⭐" : unlocked ? "📚" : "🔒"}
              </button>
            );
          })}
        </div>
      </div>

      {hasCertificate && (
        <div className="rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/6 to-primary/12 p-8 text-center">
          <p className="mb-2 text-4xl">🎓</p>
          <h3 className="font-serif text-2xl font-bold text-foreground">
            Certificado de Pré-natal
          </h3>
          <p className="mt-2 text-primary">
            Parabéns! Você concluiu todas as lições do curso de pré-natal.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 40 — FAQ Personalizado por Semana
───────────────────────────────────────────────────────────────────────────── */

type FAQItem = {
  q: string;
  a: string;
  weeks: [number, number]; // [min, max] inclusive
  tags: string[];
};

const FAQ_ITEMS: FAQItem[] = [
  // 1º Trimestre
  {
    q: "Náuseas e vômitos são normais?",
    a: "Sim, afetam até 80% das gestantes, especialmente no 1º trimestre. São causadas pelo hCG. Coma pequenas porções frequentes, evite odores fortes, prefira alimentos secos pela manhã. Converse com seu médico se vomitar mais de 3-4 vezes ao dia (hiperemese).",
    weeks: [4, 14],
    tags: ["náuseas", "sintomas"],
  },
  {
    q: "Posso sangrar no início da gravidez?",
    a: "Um pequeno sangramento na implantação (por volta de 6-10 dias após a fecundação) pode ocorrer e é normal. Porém, qualquer sangramento deve ser comunicado ao médico. Ele avaliará se é necessário ultrassom para verificar a vitalidade do embrião.",
    weeks: [4, 12],
    tags: ["sangramento"],
  },
  {
    q: "Cólicas leves são normais?",
    a: "Cólicas leves e ocasionais no início da gestação são comuns — o útero está se expandindo. Mas dor intensa, contínua ou acompanhada de sangramento exige avaliação médica urgente.",
    weeks: [4, 14],
    tags: ["cólicas", "dor"],
  },
  {
    q: "Posso continuar tomando meus remédios habituais?",
    a: "Não tome nenhum medicamento sem orientação médica durante a gestação. Alguns são seguros, outros são contraindicados. Leve uma lista de todos os seus medicamentos para o pré-natal.",
    weeks: [4, 42],
    tags: ["medicamentos"],
  },
  {
    q: "Com que frequência preciso ir às consultas do pré-natal?",
    a: "O calendário mínimo do pré-natal: mensal até 32 semanas, quinzenal até 36, e semanal a partir daí. Gestações de alto risco têm consultas mais frequentes. Não pule nenhuma — cada consulta tem um objetivo específico.",
    weeks: [4, 40],
    tags: ["consultas", "pré-natal"],
  },
  {
    q: "É seguro ter relações sexuais na gestação?",
    a: "Em gestações sem complicações, o sexo é completamente seguro. O bebê está protegido pelo líquido amniótico e tampão mucoso. Evite posições que pressionem a barriga. Em caso de sangramento, placenta prévia ou ameaça de parto prematuro, pode ser contraindicado.",
    weeks: [4, 38],
    tags: ["sexo", "relações"],
  },
  // 1º-2º Trimestre
  {
    q: "Quais exames são feitos na semana 11-14?",
    a: "A morfológica do 1º trimestre avalia a translucência nucal (rastreamento de síndrome de Down), batimentos cardíacos e anatomia inicial. Junto com exames de sangue (PAPP-A e beta-hCG livre), compõe o rastreamento combinado do 1º trimestre.",
    weeks: [10, 16],
    tags: ["exames", "morfológica"],
  },
  {
    q: "O que é síndrome de Down e como é o rastreamento?",
    a: "A síndrome de Down (trissomia 21) ocorre em 1 a cada 800 nascimentos. O rastreamento combinado do 1º trimestre (translucência nucal + exames de sangue) estima o risco. Se alto, pode ser indicada amniocentese ou biopsia de vilosidade corial para diagnóstico definitivo.",
    weeks: [10, 20],
    tags: ["Down", "rastreamento"],
  },
  // 2º Trimestre
  {
    q: "Quando sentirei os primeiros movimentos?",
    a: "Primíparas geralmente sentem entre 18-22 semanas. Quem já teve filhos pode perceber antes, entre 16-18 semanas. No início parece um borbulhar ou 'borboletas'. Não ficou preocupada se demorar — cada corpo é diferente.",
    weeks: [14, 22],
    tags: ["movimentos", "chutes"],
  },
  {
    q: "Posso viajar de avião grávida?",
    a: "Até 28 semanas, viagens aéreas são geralmente seguras com autorização médica. Entre 28-36 semanas, algumas companhias exigem atestado médico. Após 36 semanas, a maioria das companhias não aceita. Levante a cada hora, hidrate-se bem e use meia de compressão.",
    weeks: [14, 36],
    tags: ["viagem", "avião"],
  },
  {
    q: "O que é o exame morfológico do 2º trimestre?",
    a: "A morfológica do 2º trimestre (20-24 semanas) avalia detalhadamente a anatomia fetal: cabeça, coração (4 câmaras), pulmões, rins, fígado, coluna, membros e face. É o exame mais completo da gestação. Um especialista em medicina fetal realiza o exame.",
    weeks: [18, 26],
    tags: ["morfológica", "exames"],
  },
  {
    q: "Preciso fazer o teste de diabetes gestacional?",
    a: "Sim, o TOTG (teste oral de tolerância à glicose) é feito entre 24-28 semanas para todas as gestantes. Se você tem fatores de risco (obesidade, histórico familiar, bebê grande), pode ser feito antes. O diabetes gestacional tem tratamento eficaz.",
    weeks: [22, 30],
    tags: ["diabetes", "TOTG", "exames"],
  },
  // 2º-3º Trimestre
  {
    q: "O que são contrações de Braxton Hicks?",
    a: "São contrações irregulares, sem dor intensa, que preparam o útero para o parto. São normais a partir do 2º trimestre. Diferem do trabalho de parto por serem irregulares, curtas e cessam com mudança de posição. Se ficarem regulares e progressivas, ligue para o médico.",
    weeks: [20, 40],
    tags: ["contrações", "Braxton Hicks"],
  },
  {
    q: "O bebê está em posição correta para o parto?",
    a: "A maioria dos bebês se vira para a posição cefálica (cabeça para baixo) entre as semanas 32-36. Se ainda estiver pélvico (nádegas para baixo) na semana 36, o médico pode tentar uma versão cefálica externa ou planejar a cesárea.",
    weeks: [28, 38],
    tags: ["posição fetal", "pélvico"],
  },
  {
    q: "Posso continuar trabalhando durante a gravidez?",
    a: "Na maioria dos casos sim, até próximo ao parto. A licença-maternidade no Brasil começa a partir de 28 semanas, mas muitas mulheres trabalham até 37-38 semanas. Em gestações de alto risco, o afastamento pode ser necessário antes.",
    weeks: [4, 38],
    tags: ["trabalho", "licença"],
  },
  // 3º Trimestre
  {
    q: "O que é pré-eclâmpsia e como identificar?",
    a: "Pré-eclâmpsia é pressão alta na gestação acompanhada de proteína na urina, geralmente após 20 semanas. Sinais: pressão ≥140x90, inchaço súbito de mãos e rosto, dor de cabeça intensa, visão turva, dor no estômago. Procure o médico imediatamente.",
    weeks: [20, 42],
    tags: ["pré-eclâmpsia", "pressão alta", "urgência"],
  },
  {
    q: "Quanto líquido amniótico é normal?",
    a: "O volume de líquido amniótico é avaliado no ultrassom (ILA — índice de líquido amniótico). Oligoâmnio (pouco líquido) e polidrâmnio (muito líquido) precisam de avaliação. O bebê engole o líquido e urina dentro do útero, mantendo o equilíbrio.",
    weeks: [16, 42],
    tags: ["líquido amniótico"],
  },
  {
    q: "Quais são os sinais de parto prematuro?",
    a: "Contrações regulares antes de 37 semanas, pressão pélvica intensa, dor lombar nova, sangramento, perda de líquido ou muco. Na dúvida, vá ao hospital. Não espere: cada semana dentro do útero conta muito para o bebê prematuro.",
    weeks: [20, 37],
    tags: ["parto prematuro", "urgência"],
  },
  {
    q: "Como saber se é trabalho de parto verdadeiro?",
    a: "Trabalho de parto verdadeiro: contrações regulares a cada 5 minutos, duração de 1 minuto, por 1 hora (regra 5-1-1), que não cessam com mudança de posição e ficam progressivamente mais fortes e frequentes. Falso trabalho: irregular, cessa com repouso.",
    weeks: [36, 42],
    tags: ["parto", "contrações"],
  },
  {
    q: "Posso ter epidural?",
    a: "A anestesia peridural (epidural) é segura e muito usada no parto. Reduz a dor sem impedir os movimentos. Pode ser administrada em qualquer fase do trabalho de parto ativo. Converse com o seu médico sobre seu plano de parto.",
    weeks: [34, 42],
    tags: ["parto", "epidural", "dor"],
  },
  {
    q: "O que levar para a maternidade?",
    a: "Para a mãe: documentos (RG, carteirinha, pré-natal), roupas confortáveis, itens de higiene, calcinha descartável, sutiã de amamentação, absorvente pós-parto. Para o bebê: roupinhas, fraldas, manta, cadeirinha de carro (obrigatória para ir embora). Monte a bolsa a partir de 34 semanas.",
    weeks: [32, 42],
    tags: ["maternidade", "parto", "preparação"],
  },
];

function FAQTab({ gest, onNavigate }: { gest: Gest; onNavigate: (tab: string) => void }) {
  const currentWeek = gest?.weeks ?? 0;
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(currentWeek === 0);

  const filtered = FAQ_ITEMS.filter((item) => {
    const matchesWeek =
      showAll || currentWeek === 0
        ? true
        : currentWeek >= item.weeks[0] && currentWeek <= item.weeks[1];
    const matchesSearch =
      !search ||
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesWeek && matchesSearch;
  });

  return (
    <div className="max-w-2xl space-y-5">
      {/* ── Suporte em 2 passos: chat primeiro, e-mail se precisar ── */}
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <h2 className="font-serif text-xl">Precisa de ajuda? 💬</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nosso suporte funciona em 2 passos — comece sempre pelo chat.
        </p>
        <div className="mt-4 space-y-2.5">
          <button
            onClick={() => onNavigate("Chat IA")}
            className="press flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">
              1️⃣
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">Fale com o chat</span>
              <span className="block text-xs opacity-85">
                Resposta na hora, 24h — resolve a maioria das dúvidas
              </span>
            </span>
          </button>
          <a
            href={`mailto:${DOCTOR.supportEmail}?subject=${encodeURIComponent("Preciso de ajuda — app Obstétrica")}&body=${encodeURIComponent("Olá! Já tentei pelo chat e ainda preciso de ajuda com: ")}`}
            className="press flex w-full items-center gap-3 rounded-2xl card-material p-4 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-lg">
              2️⃣
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">
                Não resolveu? Mande um e-mail
              </span>
              <span className="block text-xs text-muted-foreground">
                {DOCTOR.supportEmail} — resposta em até 1 dia útil
              </span>
            </span>
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          🚨 Emergência médica não é suporte: ligue 192 (SAMU) ou vá à maternidade.
        </p>
      </div>

      <div className="rounded-3xl card-material p-5">
        <h2 className="font-serif text-xl mb-1">Perguntas frequentes</h2>
        {currentWeek > 0 && (
          <p className="text-sm text-muted-foreground">
            Mostrando perguntas relevantes para a semana {currentWeek}
          </p>
        )}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pergunta…"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              showAll ? "bg-primary text-white" : "bg-secondary text-foreground"
            }`}
          >
            {showAll ? "Ver da minha semana" : "Ver todas"}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-serif text-lg text-foreground/70">Nenhuma pergunta encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <div key={i} className="rounded-2xl card-material overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-sm font-medium pr-4">{item.q}</span>
                <span className="shrink-0 text-muted-foreground text-sm">
                  {open === i ? "▲" : "▼"}
                </span>
              </button>
              {open === i && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Sem. {item.weeks[0]}–{item.weeks[1]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-center text-muted-foreground">
        Não encontrou sua dúvida?{" "}
        <button
          onClick={() => onNavigate("Chat IA")}
          className="text-primary font-medium hover:underline"
        >
          Pergunte ao assistente de IA
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 45 — Clima & Qualidade do Ar
───────────────────────────────────────────────────────────────────────────── */

type WeatherData = {
  temp: number;
  apparentTemp: number;
  humidity: number;
  weatherCode: number;
  aqi: number | null;
  pm25: number | null;
};

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

function weatherDesc(code: number): string {
  if (code === 0) return "Céu limpo";
  if (code <= 3) return "Parcialmente nublado";
  if (code <= 48) return "Névoa / Nevoeiro";
  if (code <= 57) return "Chuviscos";
  if (code <= 67) return "Chuva";
  if (code <= 77) return "Neve";
  if (code <= 82) return "Pancadas de chuva";
  return "Tempestade";
}

function aqiLabel(aqi: number): { label: string; color: string } {
  if (aqi <= 20) return { label: "Ótima", color: "text-green-600" };
  if (aqi <= 40) return { label: "Boa", color: "text-lime-600" };
  if (aqi <= 60) return { label: "Moderada", color: "text-amber-600" };
  if (aqi <= 80) return { label: "Ruim", color: "text-primary" };
  return { label: "Muito ruim", color: "text-red-600" };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 50 — Portal Pós-parto
───────────────────────────────────────────────────────────────────────────── */

const EPDS_QUESTIONS = [
  {
    q: "Tenho sido capaz de rir e ver o lado divertido das coisas",
    opts: ["Tanto quanto antes", "Não tanto agora", "Definitivamente menos", "Não consigo mais"],
    reverse: false,
  },
  {
    q: "Tenho aguardado com satisfação as coisas boas que estavam por acontecer",
    opts: [
      "Sim, tanto quanto antes",
      "Um pouco menos que antes",
      "Definitivamente menos",
      "Quase nada",
    ],
    reverse: false,
  },
  {
    q: "Me culpei sem necessidade quando as coisas correram mal",
    opts: ["Nunca", "Raramente", "Às vezes", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "Tenho estado ansiosa ou preocupada sem motivo",
    opts: ["Não, de jeito nenhum", "Quase nunca", "Sim, às vezes", "Sim, com muita frequência"],
    reverse: false,
  },
  {
    q: "Tenho sentido medo ou ficado apavorada sem motivo",
    opts: ["Não, nunca", "Não muito", "Sim, às vezes", "Sim, bastante"],
    reverse: false,
  },
  {
    q: "As coisas têm me oprimido",
    opts: [
      "Tenho lidado tão bem quanto antes",
      "Tenho lidado na maioria das vezes",
      "Às vezes não consigo lidar",
      "Não tenho conseguido lidar",
    ],
    reverse: false,
  },
  {
    q: "Tenho me sentido tão infeliz que tenho tido dificuldade em dormir",
    opts: ["Nunca", "Raramente", "Às vezes", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "Tenho me sentido triste ou muito mal",
    opts: ["Nunca", "Raramente", "Sim, com bastante frequência", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "Tenho estado tão infeliz que tenho chorado",
    opts: ["Nunca", "Às vezes", "Sim, com bastante frequência", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "O pensamento de me machucar ocorreu a mim",
    opts: ["Nunca", "Quase nunca", "Às vezes", "Sim, com bastante frequência"],
    reverse: false,
  },
];

const VACCINE_SCHEDULE = [
  { key: "bcg", name: "BCG", disease: "Tuberculose", ageLabel: "Ao nascer" },
  { key: "hepb_0", name: "Hepatite B (1ª)", disease: "Hepatite B", ageLabel: "Ao nascer" },
  { key: "hepb_1", name: "Hepatite B (2ª)", disease: "Hepatite B", ageLabel: "1 mês" },
  { key: "penta_1", name: "Pentavalente (1ª)", disease: "DTP + Hib + HepB", ageLabel: "2 meses" },
  { key: "vip_1", name: "VIP (1ª)", disease: "Poliomielite", ageLabel: "2 meses" },
  { key: "pneumo_1", name: "Pneumocócica 10v (1ª)", disease: "Pneumococo", ageLabel: "2 meses" },
  { key: "rota_1", name: "Rotavírus (1ª)", disease: "Rotavírus", ageLabel: "2 meses" },
  { key: "meningo_1", name: "Meningocócica C (1ª)", disease: "Meningite C", ageLabel: "3 meses" },
  { key: "penta_2", name: "Pentavalente (2ª)", disease: "DTP + Hib + HepB", ageLabel: "4 meses" },
  { key: "vip_2", name: "VIP (2ª)", disease: "Poliomielite", ageLabel: "4 meses" },
  { key: "pneumo_2", name: "Pneumocócica 10v (2ª)", disease: "Pneumococo", ageLabel: "4 meses" },
  { key: "rota_2", name: "Rotavírus (2ª)", disease: "Rotavírus", ageLabel: "4 meses" },
  { key: "penta_3", name: "Pentavalente (3ª)", disease: "DTP + Hib + HepB", ageLabel: "6 meses" },
  { key: "vip_3", name: "VIP (3ª)", disease: "Poliomielite", ageLabel: "6 meses" },
  { key: "fa_1", name: "Febre Amarela", disease: "Febre Amarela", ageLabel: "9 meses" },
  {
    key: "scr_1",
    name: "Tríplice Viral (1ª)",
    disease: "Sarampo/Caxumba/Rubéola",
    ageLabel: "12 meses",
  },
  { key: "hepa_1", name: "Hepatite A (1ª)", disease: "Hepatite A", ageLabel: "12 meses" },
  {
    key: "meningo_ref",
    name: "Meningocócica C (reforço)",
    disease: "Meningite C",
    ageLabel: "12 meses",
  },
  { key: "varicela_1", name: "Varicela (1ª)", disease: "Catapora", ageLabel: "12 meses" },
  {
    key: "dtp_ref1",
    name: "DTP (1º reforço)",
    disease: "Difteria/Tétano/Coqueluche",
    ageLabel: "15 meses",
  },
  { key: "vop_1", name: "VOP (1ª)", disease: "Poliomielite", ageLabel: "15 meses" },
  {
    key: "pneumo_ref",
    name: "Pneumocócica (reforço)",
    disease: "Pneumococo",
    ageLabel: "15 meses",
  },
  {
    key: "scr_2",
    name: "Tríplice Viral (2ª)",
    disease: "Sarampo/Caxumba/Rubéola",
    ageLabel: "15 meses",
  },
];

const MILESTONES_DEF = [
  { key: "primeiro_sorriso", label: "Primeiro sorriso social", emoji: "😊", weekApprox: 6 },
  { key: "vira_cabeca", label: "Vira a cabeça para sons", emoji: "👂", weekApprox: 8 },
  { key: "segura_cabeca", label: "Sustenta a cabeça", emoji: "💪", weekApprox: 12 },
  { key: "rola", label: "Rola sozinho", emoji: "🔄", weekApprox: 16 },
  { key: "gargalhada", label: "Ri alto / gargalha", emoji: "😂", weekApprox: 16 },
  { key: "senta", label: "Senta sem apoio", emoji: "🪑", weekApprox: 26 },
  { key: "first_tooth", label: "Primeiro dente", emoji: "🦷", weekApprox: 26 },
  { key: "papas", label: "Primeiras papas/alimentos", emoji: "🥣", weekApprox: 26 },
  { key: "engatinha", label: "Engatinha", emoji: "🐣", weekApprox: 34 },
  { key: "fica_em_pe", label: "Fica de pé com apoio", emoji: "🧍", weekApprox: 38 },
  { key: "primeiro_passo", label: "Primeiro passo", emoji: "👣", weekApprox: 52 },
  { key: "primeira_palavra", label: "Primeira palavra", emoji: "💬", weekApprox: 52 },
];

/**
 * ⚠️ O PORTAL PÓS-PARTO NÃO CONHECIA O MODO CUIDADO — e este era o pior lugar
 * do app para isso faltar.
 *
 * `care_mode` não limpa `birth_date`. Numa perda DEPOIS do nascimento
 * (natimorto, óbito neonatal), a data está preenchida e o Portal abria
 * inteiro: "Helena nasceu! 3 semanas de vida", com o convite a marcar o
 * primeiro sorriso e o calendário de 24 vacinas de um bebê que morreu.
 *
 * ⚠️ **E O CONSERTO NÃO É ESCONDER A ABA.** Duas coisas aqui importam MAIS
 * depois de uma perda, não menos:
 *
 *   · **Bem-estar (EPDS)** — a escala de Edinburgh, cuja décima pergunta é
 *     ideação de autolesão. Quem perdeu um bebê está no risco máximo de
 *     depressão perinatal. Tirar isso seria o Modo Cuidado desligando socorro,
 *     que é exatamente o que a régua deste repositório proíbe.
 *   · **Retorno** — a consulta de puerpério. O corpo dela passou pelo parto do
 *     mesmo jeito, e o retorno é onde hemorragia, infecção e pré-eclâmpsia de
 *     pós-parto são pegas.
 *
 * O que sai são as três abas que falam DO BEBÊ: amamentação, marcos e vacinas.
 * E o cabeçalho deixa de anunciar um nascimento — sem narrar a perda, que não
 * é o app quem conta.
 */
function PosPartoTab({
  profile,
  onNavigate,
  careMode = false,
}: {
  profile: Profile | null;
  onNavigate: (tab: string) => void;
  careMode?: boolean;
}) {
  const [subTab, setSubTab] = useState<"saúde" | "amamentação" | "marcos" | "vacinas" | "retorno">(
    "saúde",
  );

  if (!profile?.birth_date) {
    return (
      <div className="max-w-md mx-auto rounded-3xl card-material p-8 text-center space-y-4">
        <p className="text-4xl">🍼</p>
        <h2 className="font-serif text-xl">Portal Pós-parto</h2>
        <p className="text-sm text-muted-foreground">
          Ative o portal após o nascimento do bebê preenchendo a data de nascimento em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Perfil → Pós-parto
          </button>
          .
        </p>
        <div className="rounded-xl bg-secondary/50 p-4 text-left text-sm space-y-1">
          <p className="font-medium">Recursos disponíveis:</p>
          <p>🧠 Rastreio de depressão pós-parto (EPDS)</p>
          <p>🤱 Registro de amamentações</p>
          <p>⭐ Marcos do bebê</p>
          <p>💉 Calendário de vacinas</p>
          <p>📅 Consultas de retorno</p>
        </div>
      </div>
    );
  }

  const birthDate = new Date(profile.birth_date + "T00:00:00");
  const babyAgeDays = Math.floor((Date.now() - birthDate.getTime()) / 86400000);
  const babyAgeWeeks = Math.floor(babyAgeDays / 7);
  const babyName = profile.baby_name ?? "bebê";

  const subTabs: { key: typeof subTab; label: string }[] = careMode
    ? /* Só o que é sobre o corpo e a cabeça DELA. */
      [
        { key: "saúde", label: "Bem-estar" },
        { key: "retorno", label: "Retorno" },
      ]
    : [
        { key: "saúde", label: "Bem-estar" },
        { key: "amamentação", label: "Amamentação" },
        { key: "marcos", label: "Marcos" },
        { key: "vacinas", label: "Vacinas" },
        { key: "retorno", label: "Retorno" },
      ];

  return (
    <div className="space-y-6">
      {careMode ? (
        /* ⚠️ Sóbrio, e sem contar o que aconteceu: o Modo Cuidado pode ter
           sido ligado pelo médico, e narrar a perda de volta para ela na
           abertura da tela é o app dando a notícia mais íntima que existe. */
        <div className="rounded-3xl card-material p-5">
          <p className="font-semibold">Cuidando de você</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu corpo passou por um parto, e o acompanhamento continua. O que estiver pesando também
            é cuidado — e o seu médico está aqui.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-4">
          <span className="text-4xl">🍼</span>
          <div>
            <p className="font-semibold">
              {babyName} nasceu!{" "}
              {babyAgeWeeks > 0
                ? `${babyAgeWeeks} semana${babyAgeWeeks > 1 ? "s" : ""}`
                : `${babyAgeDays} dia${babyAgeDays !== 1 ? "s" : ""}`}{" "}
              de vida
            </p>
            <p className="text-xs text-muted-foreground">
              Nascimento: {birthDate.toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {subTabs.map((st) => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              subTab === st.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === "saúde" && <PpdSection babyAgeDays={babyAgeDays} />}
      {/* ⚠️ O cinto, além do suspensório: as três abas do bebê já não têm
          botão no Modo Cuidado, mas o portão fica também no corpo. Uma prop de
          sub-tela inicial acrescentada amanhã (como `initialSub`, que outras
          abas já têm) abriria "Marcos" por link sem passar pela fita. */}
      {!careMode && subTab === "amamentação" && <BreastfeedingSection />}
      {!careMode && subTab === "marcos" && (
        <MilestonesSection babyAgeWeeks={babyAgeWeeks} babyName={babyName} />
      )}
      {!careMode && subTab === "vacinas" && <VaccinesSection birthDate={birthDate} />}
      {subTab === "retorno" && <RetornoSection birthDate={birthDate} profile={profile} />}
    </div>
  );
}

// ── PPD Section ────────────────────────────────────────────────────────────

function PpdSection({ babyAgeDays }: { babyAgeDays: number }) {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [history, setHistory] = useState<PpdScreening[]>([]);
  /**
   * ⚠️ `null` = ainda não tentou. `false` = tentou e NÃO deu.
   *
   * Os dois não podem virar o mesmo estado: a tela precisa poder dizer "não
   * consegui avisar seu médico" sem dizer isso antes de ter tentado.
   */
  const [avisouOMedico, setAvisouOMedico] = useState<boolean | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoadingHistory(false);
        return;
      }
      const res = await getMyPpdScreenings({ data: { accessToken: s.session.access_token } });
      if (res.ok) setHistory(res.screenings);
      setLoadingHistory(false);
    })();
  }, []);

  function getScore(ans: (number | null)[]): number {
    return EPDS_QUESTIONS.reduce((sum, q, i) => {
      const v = ans[i] ?? 0;
      return sum + (q.reverse ? 3 - v : v);
    }, 0);
  }

  /**
   * ⚠️ **A RESPOSTA DELA PRECISA CHEGAR AO MÉDICO — e não chegava.**
   *
   * Esta função gravava só em `ppd_screenings`, uma tabela que **não tem
   * coluna `doctor_id`** e que NENHUM caminho do médico lê: nem o prontuário,
   * nem `clinical_events`, nem a fila de trabalho. Varredura do repositório:
   * os únicos toques são o `insert` daqui e o histórico que a própria paciente
   * abre.
   *
   * Então uma puérpera abria Pós-parto → Bem-estar, respondia **"sim, tive
   * pensamentos de me machucar"** (questão 10), via a caixa vermelha com o
   * 188 — e o obstetra dela não recebia NADA.
   *
   * A MESMA resposta, dada na página pública `/epds`, dispara o e-mail
   * "🚨 EPDS URGENTE — {nome} relatou pensamentos de autolesão" e entra em
   * `eventosQuePedemOlhar` como gravidade GRAVE. Duas telas, o mesmo
   * questionário validado, e só uma avisava alguém.
   *
   * E a tela ainda prometia o contrário: "o resultado deve ser compartilhado
   * com o seu médico".
   *
   * ⚠️ **Grava nas DUAS**, e a ordem importa: `saveEpdsLog` primeiro, porque é
   * ele que carimba `doctor_id` e dispara o alerta. `ppd_screenings` continua
   * porque é dele que sai o HISTÓRICO que ela relê nesta tela — apagar seria
   * tirar dela um dado que já é seu.
   */
  async function handleSubmit() {
    if (answers.some((a) => a === null)) return;
    const s = getScore(answers as number[]);
    setScore(s);
    setSubmitted(true);
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    const token = sess.session.access_token;

    /* ⚠️ O ALERTA VEM PRIMEIRO, e o retorno é LIDO. `saveEpdsLog` devolve
       `{ ok: false }` numa resposta 200 normal — um `try/catch` em volta não
       pegaria, e o "não registrei" precisa aparecer na tela: ela achar que o
       médico foi avisado quando não foi é pior que o silêncio. */
    let alertou = false;
    try {
      const { saveEpdsLog } = await import("@/lib/epds.functions");
      const r = await saveEpdsLog({
        data: {
          accessToken: token,
          score: s,
          q10Score: respostaDaQuestao10(answers),
          level: nivelDaEpds(s, respostaDaQuestao10(answers)),
        },
      });
      alertou = Boolean((r as { ok?: boolean })?.ok);
    } catch {
      alertou = false;
    }
    setAvisouOMedico(alertou);

    await savePpdScreening({
      data: { accessToken: token, score: s, answers: answers as number[] },
    });
    const res = await getMyPpdScreenings({ data: { accessToken: token } });
    if (res.ok) setHistory(res.screenings);
  }

  function scoreColor(s: number) {
    if (s <= 9) return "text-green-600";
    if (s <= 12) return "text-amber-600";
    return "text-red-600";
  }

  function scoreLabel(s: number) {
    if (s <= 9) return "Sem indicativo de depressão pós-parto";
    if (s <= 12) return "Possível depressão leve — monitore e converse com seu médico";
    return "Indicativo de depressão pós-parto — busque apoio profissional";
  }

  const q10Score = submitted ? (answers[9] ?? 0) : 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-3xl card-material p-6">
        <h3 className="font-semibold mb-1">Rastreio de depressão pós-parto (EPDS)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escala de Edimburgo — 10 perguntas sobre como você se sentiu nos últimos 7 dias
        </p>

        {!submitted ? (
          <div className="space-y-6">
            {EPDS_QUESTIONS.map((q, qi) => (
              <div key={qi}>
                <p className="text-sm font-medium mb-2">
                  {qi + 1}. {q.q}
                </p>
                <div className="space-y-1.5">
                  {q.opts.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                      className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        answers[qi] === oi
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={answers.some((a) => a === null)}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Ver resultado
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary/40 p-5 text-center">
              <p className="text-4xl font-bold">
                <span className={scoreColor(score!)}>{score}</span>
                <span className="text-xl text-muted-foreground"> / 30</span>
              </p>
              <p className={`mt-2 font-medium ${scoreColor(score!)}`}>{scoreLabel(score!)}</p>
            </div>

            {score! >= 13 && (
              <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
                <p className="font-semibold text-red-700 mb-2">Apoio disponível agora:</p>
                <div className="space-y-2">
                  <a
                    href="tel:188"
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="font-semibold text-sm">CVV — Centro de Valorização da Vida</p>
                      <p className="text-lg font-bold text-red-600">188</p>
                    </div>
                  </a>
                </div>
                {/* ⚠️ **A FRASE MUDOU PORQUE O COMPORTAMENTO MUDOU.** Ela dizia
                    "informe o seu médico na próxima consulta" — e era a única
                    coisa verdadeira enquanto nada avisava ninguém. Agora o
                    aviso sai na hora, e a tela diz isso.

                    ⚠️ E quando ele NÃO sai, ela diz isso também: "avisamos seu
                    médico" sobre um envio que falhou é a mentira mais cara que
                    esta tela pode contar, porque ela para de procurar ajuda
                    achando que já pediu. */}
                {avisouOMedico === true && (
                  <p className="mt-2 text-xs font-medium text-red-700">
                    Avisamos o seu médico agora. Se você não estiver bem, ligue 188 ou procure
                    atendimento — não espere a resposta dele.
                  </p>
                )}
                {avisouOMedico === false && (
                  <p className="mt-2 text-xs font-medium text-red-700">
                    Não conseguimos avisar o seu médico agora. Ligue 188 ou procure atendimento, e
                    fale com ele por outro caminho.
                  </p>
                )}
              </div>
            )}

            {submitted && q10Score >= 1 && (
              <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4">
                <p className="font-bold text-red-700">🚨 Resposta à questão 10</p>
                <p className="text-sm text-red-700 mt-1">
                  Você indicou ter pensamentos de se machucar. Por favor, ligue imediatamente para o
                  CVV (188) ou vá ao pronto-socorro mais próximo.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setAnswers(Array(10).fill(null));
                setSubmitted(false);
                setScore(null);
              }}
              className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-secondary"
            >
              Refazer o rastreio
            </button>
          </div>
        )}
      </div>

      {!loadingHistory && history.length > 0 && (
        <div className="rounded-3xl card-material p-6">
          <h3 className="font-semibold mb-3">Histórico</h3>
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3"
              >
                <span className="text-sm">
                  {new Date(h.screened_at).toLocaleDateString("pt-BR")}
                </span>
                <span className={`font-semibold ${scoreColor(h.score)}`}>{h.score}/30</span>
                <span className="text-xs text-muted-foreground">
                  {scoreLabel(h.score).split(" — ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        A EPDS é um rastreio, não um diagnóstico. Apenas um profissional de saúde pode diagnosticar
        depressão pós-parto. Quando o resultado indica atenção, o seu médico é avisado
        automaticamente.
        {babyAgeDays < 42 && (
          <span> Recomenda-se repetir o rastreio com 6 semanas após o parto.</span>
        )}
      </div>
    </div>
  );
}

// ── Breastfeeding Section ─────────────────────────────────────────────────

function BreastfeedingSection() {
  const [logs, setLogs] = useState<BreastfeedingLog[]>([]);
  const [activeSide, setActiveSide] = useState("esquerdo");
  const [activeLog, setActiveLog] = useState<string | null>(null);
  const [activeStart, setActiveStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!activeLog || !activeStart) return;
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - activeStart.getTime()) / 1000)));
    update();
    const t = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", update);
    };
  }, [activeLog, activeStart]);

  async function loadLogs() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setLoading(false);
      return;
    }
    const res = await getBreastfeedingLogs({ data: { accessToken: s.session.access_token } });
    if (res.ok) {
      setLogs(res.logs);
      // Retomar mamada em andamento (ex.: após recarregar a página)
      const open = res.logs.find((l) => !l.ended_at);
      if (open) {
        setActiveLog(open.id);
        setActiveStart(new Date(open.started_at));
        setActiveSide(open.side);
      }
    }
    setLoading(false);
  }

  async function handleStart() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await startBreastfeeding({
      data: { accessToken: s.session.access_token, side: activeSide },
    });
    if (res.ok && res.id) {
      setActiveLog(res.id);
      setActiveStart(new Date());
      setElapsed(0);
    }
  }

  async function handleEnd() {
    if (!activeLog) return;
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    await endBreastfeeding({
      data: { accessToken: s.session.access_token, id: activeLog, notes: notes || null },
    });
    setActiveLog(null);
    setActiveStart(null);
    setElapsed(0);
    setNotes("");
    await loadLogs();
  }

  const todayLogs = logs.filter(
    (l) => new Date(l.started_at).toDateString() === new Date().toDateString(),
  );
  const todayCount = todayLogs.length;
  const todayMinutes = todayLogs.reduce((sum, l) => {
    if (!l.ended_at) return sum;
    return (
      sum + Math.round((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 60000)
    );
  }, 0);

  return (
    <div className="max-w-xl space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl card-material p-4 text-center">
          <p className="text-3xl font-bold text-primary">{todayCount}</p>
          <p className="text-xs text-muted-foreground">mamadas hoje</p>
        </div>
        <div className="rounded-2xl card-material p-4 text-center">
          <p className="text-3xl font-bold text-primary">{todayMinutes}</p>
          <p className="text-xs text-muted-foreground">minutos hoje</p>
        </div>
      </div>

      {/* Timer */}
      <div className="rounded-3xl card-material p-6">
        <h3 className="font-semibold mb-4">Registrar mamada</h3>
        {!activeLog ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {["esquerdo", "direito", "ambos", "mamadeira"].map((side) => (
                <button
                  key={side}
                  onClick={() => setActiveSide(side)}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium capitalize transition-colors ${
                    activeSide === side
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {side === "esquerdo"
                    ? "🤱 Esq."
                    : side === "direito"
                      ? "🤱 Dir."
                      : side === "ambos"
                        ? "🤱 Ambos"
                        : "🍼 Mamadeira"}
                </button>
              ))}
            </div>
            <button
              onClick={handleStart}
              className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-white"
            >
              ▶ Iniciar mamada
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Em andamento — {activeSide}
            </p>
            <p className="text-5xl font-bold tabular-nums text-primary">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observação opcional…"
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
            />
            <button
              onClick={handleEnd}
              className="w-full rounded-2xl bg-secondary py-3 text-sm font-medium text-foreground"
            >
              ■ Finalizar mamada
            </button>
          </div>
        )}
      </div>

      {/* Recent logs */}
      {!loading && logs.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Últimos 7 dias</h3>
          <div className="space-y-2">
            {logs.slice(0, 20).map((log) => {
              const dur = log.ended_at
                ? Math.round(
                    (new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000,
                  )
                : null;
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-xl">{log.side === "mamadeira" ? "🍼" : "🤱"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{log.side}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.started_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {dur != null && (
                    <span className="text-sm font-semibold text-primary">{dur}min</span>
                  )}
                  {!log.ended_at && (
                    <span className="text-xs text-primary font-medium">em andamento</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Milestones Section ────────────────────────────────────────────────────

function MilestonesSection({ babyAgeWeeks, babyName }: { babyAgeWeeks: number; babyName: string }) {
  const [milestones, setMilestones] = useState<BabyMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState(ymdLocal());

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoading(false);
        return;
      }
      const res = await getMilestones({ data: { accessToken: s.session.access_token } });
      if (res.ok) setMilestones(res.milestones);
      setLoading(false);
    })();
  }, []);

  function isDone(key: string) {
    return milestones.some((m) => m.milestone_key === key);
  }

  /**
   * ⚠️ **A MESMA RÉGUA DA CADERNETA DE VACINAS, que vive logo abaixo nesta tela.**
   *
   * `setMilestone` e `removeMilestone` devolvem `{ ok: false }` numa resposta
   * **200 NORMAL** — sessão expirada, RLS, coluna faltando —, e um `try/catch`
   * em volta não pega nada disso. A tela pintava o marco na hora e nunca
   * corrigia: a mãe registrava o primeiro sorriso, via o ✓, fechava o app, e na
   * abertura seguinte não havia nada.
   *
   * ⚠️ **E aqui dói mais que em quase todo lugar: isto é o livro de memórias do
   * bebê.** O primeiro sorriso não volta para ser registrado de novo — quando
   * ela descobrir que não gravou, a data já passou.
   *
   * ⚠️ E a irmã ao lado JÁ estava consertada, com o comentário do conserto
   * visível na mesma tela. É a forma mais comum de defeito deste repositório:
   * a régua aplicada num lugar e deixada de pé no vizinho.
   */
  async function toggleMilestone(key: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const marcado = isDone(key);
    try {
      const r = marcado
        ? await removeMilestone({
            data: { accessToken: s.session.access_token, milestoneKey: key },
          })
        : await setMilestone({
            data: {
              accessToken: s.session.access_token,
              milestoneKey: key,
              achievedAt: dateInput,
              notes: null,
              customLabel: null,
            },
          });
      if (!r.ok) {
        toast.error("Não consegui salvar — tente de novo.");
        return;
      }
      /* Só depois do desfecho: a tela passa a refletir o banco, não a intenção. */
      setMilestones((m) =>
        marcado
          ? m.filter((x) => x.milestone_key !== key)
          : [
              ...m,
              {
                id: "",
                milestone_key: key,
                custom_label: null,
                achieved_at: dateInput,
                notes: null,
              },
            ],
      );
    } catch {
      toast.error("Não consegui salvar — tente de novo.");
    } finally {
      setMarking(null);
    }
  }

  const doneMilestones = MILESTONES_DEF.filter((m) => isDone(m.key));
  const upcoming = MILESTONES_DEF.filter(
    (m) => !isDone(m.key) && m.weekApprox > babyAgeWeeks,
  ).slice(0, 3);

  if (loading) return <TabSkeleton />;

  return (
    <div className="max-w-xl space-y-6">
      {doneMilestones.length > 0 && (
        <div className="rounded-3xl border border-primary/20 bg-primary/6 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
            🎉 {doneMilestones.length} marcos conquistados!
          </p>
          <div className="flex flex-wrap gap-2">
            {doneMilestones.map((m) => (
              <span
                key={m.key}
                className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
              >
                {m.emoji} {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="rounded-3xl card-material p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Em breve para {babyName}
          </p>
          <div className="space-y-2">
            {upcoming.map((m) => (
              <div key={m.key} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{m.emoji}</span>
                <span>{m.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  ~{m.weekApprox}ª semana
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-semibold flex-1">Todos os marcos</h3>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
          />
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Selecione a data e clique para marcar como conquistado
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MILESTONES_DEF.map((m) => {
            const done = isDone(m.key);
            const rec = milestones.find((x) => x.milestone_key === m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMilestone(m.key)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  done
                    ? "border-primary/25 bg-primary/8"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.label}</p>
                    {done && rec && (
                      <p className="text-xs text-primary">
                        ✅ {new Date(rec.achieved_at + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {!done && (
                      <p className="text-xs text-muted-foreground">~{m.weekApprox}ª semana</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Vaccines Section ──────────────────────────────────────────────────────

function VaccinesSection({ birthDate }: { birthDate: Date }) {
  const [vaccines, setVaccines] = useState<BabyVaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateInput, setDateInput] = useState(ymdLocal());

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoading(false);
        return;
      }
      const res = await getBabyVaccines({ data: { accessToken: s.session.access_token } });
      if (res.ok) setVaccines(res.vaccines);
      setLoading(false);
    })();
  }, []);

  function isDone(key: string) {
    return vaccines.some((v) => v.vaccine_key === key);
  }

  /**
   * ⚠️ **A CADERNETA MARCAVA NA TELA SEM CONFERIR SE GRAVOU.**
   *
   * As duas funções devolvem `{ ok: boolean }` — resposta 200 normal, mesmo
   * quando o `upsert` falha — e o resultado era descartado. A vacina aparecia
   * marcada, a mãe fechava o app, e na abertura seguinte o quadradinho estava
   * vazio de novo. Numa caderneta isso é pior que um contador errado: ela usa
   * esta tela para saber **o que ainda falta aplicar no bebê**.
   *
   * Agora a tela só muda depois do "gravou", e a falha é dita. É a mesma régua
   * do presente entre amigas ("relê depois de gravar") e do bônus da dupla
   * ("`ganho += BONUS` somava por fé").
   */
  async function toggleVaccine(key: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const marcada = isDone(key);
    try {
      const r = marcada
        ? await removeVaccine({ data: { accessToken: s.session.access_token, vaccineKey: key } })
        : await markVaccineGiven({
            data: {
              accessToken: s.session.access_token,
              vaccineKey: key,
              administeredAt: dateInput,
              batch: null,
            },
          });
      if (!r.ok) {
        toast.error("Não consegui salvar — tente de novo.");
        return;
      }
      /* Só depois do desfecho: a tela passa a refletir o banco, não a intenção. */
      setVaccines((v) =>
        marcada
          ? v.filter((x) => x.vaccine_key !== key)
          : [...v, { id: "", vaccine_key: key, administered_at: dateInput, batch: null }],
      );
    } catch {
      toast.error("Não consegui salvar — tente de novo.");
    }
  }

  const done = vaccines.length;
  const total = VACCINE_SCHEDULE.length;

  if (loading) return <TabSkeleton />;

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-3xl card-material p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Calendário de vacinas</h3>
            <p className="text-xs text-muted-foreground">Calendário Nacional de Vacinação (SUS)</p>
          </div>
          <span className="text-sm font-semibold text-primary">
            {done}/{total}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Data de aplicação:</label>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1 text-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        {VACCINE_SCHEDULE.map((v) => {
          const done = isDone(v.key);
          const rec = vaccines.find((x) => x.vaccine_key === v.key);
          return (
            <button
              key={v.key}
              onClick={() => toggleVaccine(v.key)}
              className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                done
                  ? "border-green-300 bg-green-50"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span
                className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center text-xs ${done ? "border-green-500 bg-green-700 text-white" : "border-muted-foreground"}`}
              >
                {done ? "✓" : ""}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground">{v.disease}</p>
                {done && rec && (
                  <p className="text-xs text-green-700">
                    Aplicada em{" "}
                    {new Date(rec.administered_at + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {v.ageLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Return Visits Section ─────────────────────────────────────────────────

function RetornoSection({ birthDate, profile }: { birthDate: Date; profile: Profile }) {
  const [babyWeight, setBabyWeight] = useState("");
  const [weightDate, setWeightDate] = useState(ymdLocal());
  const [weights, setWeights] = useState<BabyWeight[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const res = await getBabyWeights({ data: { accessToken: s.session.access_token } });
      if (res.ok) setWeights(res.weights);
    })();
  }, []);

  async function handleAddWeight() {
    if (!babyWeight || parseFloat(babyWeight) <= 0) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (s.session) {
      const weightG = Math.round(parseFloat(babyWeight) * 1000);
      /* ⚠️ **O CAMPO SÓ LIMPA DEPOIS DO "GRAVOU".** A lista aqui é relida do
         servidor, então ela nunca mente — mas o campo era limpo de qualquer
         jeito: numa falha, o número que ela digitou sumia E nada aparecia na
         lista. Perder o valor e não receber recado nenhum é a pior combinação
         possível, porque não sobra nem o que tentar de novo. */
      const r = await addBabyWeight({
        data: { accessToken: s.session.access_token, measuredAt: weightDate, weightG },
      });
      if (!r.ok) {
        toast.error("Não consegui salvar o peso — tente de novo.");
        setSaving(false);
        return;
      }
      const res = await getBabyWeights({ data: { accessToken: s.session.access_token } });
      if (res.ok) setWeights(res.weights);
      setBabyWeight("");
    }
    setSaving(false);
  }

  const returnVisits = [
    {
      label: "Revisão pós-parto (mãe)",
      daysAfter: 7,
      note: "Verificar cicatriz, pressão, involução uterina",
    },
    { label: "Consulta pediátrica (bebê)", daysAfter: 15, note: "Peso, reflexos, icterícia" },
    { label: "Revisão 40 dias (mãe)", daysAfter: 40, note: "Consulta completa de puerpério" },
    { label: "Consulta 1 mês (bebê)", daysAfter: 30, note: "Desenvolvimento, vacinas" },
    { label: "Consulta 2 meses (bebê)", daysAfter: 60, note: "Vacinas do 2º mês" },
    { label: "Consulta 4 meses (bebê)", daysAfter: 120, note: "Vacinas do 4º mês" },
    {
      label: "Consulta 6 meses (bebê)",
      daysAfter: 180,
      note: "Início da alimentação complementar",
    },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Consultas de retorno</h3>
        <div className="space-y-2">
          {returnVisits.map((v) => {
            const date = new Date(birthDate.getTime() + v.daysAfter * 86400000);
            const isPast = date < new Date();
            return (
              <div
                key={v.label}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  isPast ? "border-border bg-secondary/30 opacity-60" : "border-border bg-card"
                }`}
              >
                <span className="text-xl mt-0.5">{isPast ? "✅" : "📅"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.label}</p>
                  <p className="text-xs text-muted-foreground">{v.note}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {date.toLocaleDateString("pt-BR")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl card-material p-6">
        <h3 className="font-semibold mb-3">Peso do bebê</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="number"
            step="0.01"
            value={babyWeight}
            onChange={(e) => setBabyWeight(e.target.value)}
            placeholder="Peso em kg (ex: 3.5)"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={weightDate}
            onChange={(e) => setWeightDate(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
          <button
            onClick={handleAddWeight}
            disabled={saving || !babyWeight}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            +
          </button>
        </div>
        {weights.length > 0 && (
          <div className="space-y-2">
            {weights.map((w, i) => {
              const prev = weights[i - 1];
              const gain = prev ? w.weight_g - prev.weight_g : null;
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-2.5"
                >
                  <span className="text-xs text-muted-foreground">
                    {new Date(w.measured_at + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  <span className="font-semibold">{(w.weight_g / 1000).toFixed(2)} kg</span>
                  {gain != null && (
                    <span className={`text-xs ${gain >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {gain >= 0 ? "+" : ""}
                      {gain}g
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 16 — Conquistas
───────────────────────────────────────────────────────── */
/**
 * Hub "Recompensas": o Cantinho (onde ela gasta Sementinhas) e as Conquistas.
 * Começa no Cantinho, que é pra onde o botão da lojinha do jogo aponta.
 *
 * ─── ⚠️ A LOJA DE PRODUTOS SAIU DA FITA (ago/2026) ─────────────────────────
 *
 * Pedido do dono, sem meio-termo: "a loja não é pra estar ali de maneira
 * alguma; ela já está lá no perfil. A única aba que vai estar ali vai ser a de
 * conquistas e a própria aba onde compra os jogos".
 *
 * A razão é que são DUAS LOJAS com naturezas opostas encostadas uma na outra: o
 * Cantinho vende enfeite por Sementinhas — moeda que ela ganha cuidando de si —,
 * e a Loja vende suplemento, conforto e enxoval por DINHEIRO. Lado a lado, na
 * mesma fita de pílulas, elas leem como duas prateleiras da mesma coisa; e é
 * assim que uma paciente toca em "Loja" achando que vai gastar o que juntou e
 * encontra um carrinho de compras de verdade.
 *
 * ⚠️ ELA NÃO SUMIU — VIROU DESTINO PRÓPRIO (`tab: "Loja"`, ao lado do Perfil),
 * que é o "está no perfil" do pedido. `MenuDaConta` aponta para lá no celular e
 * a categoria "Conta" a mostra no computador.
 *
 * ⚠️ A primeira versão a manteve como sub-aba escondida (`initialSub="loja"`,
 * fita oculta) e isso trouxe DOIS defeitos que uma auditoria mediu:
 *
 *  1. **o computador ficava sem porta** — `MenuDaConta` vive dentro de um
 *     `md:hidden`, então a pílula ERA a única entrada do desktop;
 *  2. **a sub-aba grudava**: a fita de abas do desktop chamava `setTab` direto,
 *     que não limpa `consultasSub` — toda visita a "Recompensas" reabria a
 *     Loja, e com a fita escondida o Cantinho ficava inalcançável por ali.
 *
 * Destino próprio mata os dois de uma vez, e de quebra some com o `| "loja"`
 * costurado à mão no tipo, que era a linha mais fácil de apagar sem querer.
 */
const RECOMPENSAS_SUBTABS = [
  { key: "cantinho", label: "Meu Cantinho" },
  { key: "conquistas", label: "Conquistas" },
] as const;

function RecompensasHub({
  careMode,
  gest,
  onNavigate,
  skyTheme,
  onSkyChange,
  initialSub = null,
}: {
  careMode: boolean;
  gest: Gest;
  onNavigate?: (t: string) => void;
  skyTheme?: "v2" | "v1";
  onSkyChange?: (t: "v2" | "v1") => void;
  /** O menu da conta entra por "loja"; quem chega por outro caminho cai no
      Cantinho, como antes. */
  initialSub?: string | null;
}) {
  type SubRec = (typeof RECOMPENSAS_SUBTABS)[number]["key"];
  const eSub = (v: unknown): v is SubRec => RECOMPENSAS_SUBTABS.some((x) => x.key === v);
  const [sub, setSub] = useState<SubRec>(eSub(initialSub) ? initialSub : "cantinho");
  useEffect(() => {
    if (eSub(initialSub)) setSub(initialSub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSub]);

  /* ─── ⚠️ O EMBLEMA QUE FAZ ELA IR PEGAR ──────────────────────────────
     O prêmio da conquista passou a esperar o toque dela (pedido do dono, "como
     o Duolingo faz"). Mas no Duolingo o que produz a visita é o EMBLEMA — e
     sem ele a mudança tem um custo silencioso: quem não abre esta aba por
     conta própria fica com as Sementinhas paradas e sem saber que existem.
     Trocar "recebe sem saber" por "não recebe e não sabe" é pior que o ponto
     de partida.

     ⚠️ `null` (não consegui ler) não vira 0 nem vira o total — não aparece
     emblema nenhum. Ver `evento-conquistas.ts`. */
  const [aResgatar, setAResgatar] = useState<number | null>(null);
  useEffect(() => ouvirConquistasAResgatar(setAResgatar), []);

  return (
    <div className="space-y-5">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto">
        {RECOMPENSAS_SUBTABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              sub === s.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground/55 hover:text-foreground/80"
            }`}
          >
            {s.label}
            {/* Só em Conquistas, e só quando há o que pegar. O número, e não um
                pontinho: "tem coisa" obriga a abrir para descobrir se vale a
                pena, e a pergunta que ela faz é QUANTAS. Teto em 9+, que é
                limite de largura numa fita de celular — a mesma régua do
                emblema do bebê bolha. */}
            {s.key === "conquistas" && !careMode && aResgatar != null && aResgatar > 0 && (
              <span
                className="ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-emerald-700 px-1 py-0.5 text-xs font-black leading-none text-white tabular-nums"
                aria-label={`${aResgatar} ${aResgatar === 1 ? "conquista" : "conquistas"} com Sementinhas para pegar`}
              >
                {aResgatar > 9 ? "9+" : aResgatar}
              </span>
            )}
          </button>
        ))}
      </div>
      <Fade key={sub}>
        {sub === "cantinho" && (
          <CantinhoTab
            careMode={careMode}
            onNavigate={onNavigate}
            skyTheme={skyTheme}
            onSkyChange={onSkyChange}
          />
        )}
        {sub === "conquistas" && <ConquistasTab careMode={careMode} onNavigate={onNavigate} />}
      </Fade>
    </div>
  );
}

/**
 * O que uma aba de bebê mostra em Modo Cuidado.
 *
 * O app já tinha a regra ("nunca celebrar no luto") e o transporte
 * (`isCareModeActive`), mas cinco telas não a aplicavam: Conquistas exibia
 * "Bebê chegou! 🔒 bloqueada"; Chutes oferecia "conte 10 movimentos de
 * {nome}"; Sons dizia "o bebê pode reconhecê-los após o nascimento"; a loja
 * mostrava Berço com preço. Para quem perdeu o bebê, essas são as telas mais
 * duras do aplicativo, e a paciente em luto é justamente quem menos consegue
 * fugir delas.
 *
 * A resposta certa não é uma versão suavizada: é silêncio, e uma porta de
 * saída. Nada de emoji, nada de cor, nada de "continue firme".
 */

/* ─────────────────────────────────────────────────────────
   Feature 13 — Loja Curada
───────────────────────────────────────────────────────── */

/**
 * Produto da curadoria do consultório.
 *
 * NÃO tem preço, nem preço antigo, nem desconto — e isso é deliberado. Tinha
 * os três, escritos à mão no arquivo, e os três eram ficção: `link` aponta
 * para uma BUSCA da Amazon (`/s?k=...`), não para um produto. A paciente lia
 * "R$ 18,00 · 25% OFF · Envio grátis", tocava, e caía numa lista com preços
 * completamente outros. Preço inventado ao lado do selo "recomendado pelo seu
 * médico" não é só feio: é publicidade enganosa, e o consultório é quem
 * responde por ela.
 *
 * Enquanto os links forem buscas, o preço mora na Amazon. Se um dia entrarem
 * links de produto de verdade (com tag de afiliado), o preço volta VINDO DE
 * LÁ — nunca digitado aqui.
 */
type ShopProduct = {
  id: string;
  name: string;
  description: string;
  category: "suplementos" | "conforto" | "amamentacao" | "enxoval" | "livros";
  link: string;
  weeks_min?: number;
  weeks_max?: number;
  badge?: string;
};

const CURATED_PRODUCTS: ShopProduct[] = [
  {
    id: "p1",
    name: "Ácido Fólico 5mg",
    description: "Essencial no 1º trimestre para prevenção de defeitos do tubo neural.",
    category: "suplementos",
    link: "https://www.amazon.com.br/s?k=acido+folico+gestante",
    weeks_min: 1,
    weeks_max: 20,
    badge: "MAIS VENDIDO",
  },
  {
    id: "p2",
    name: "Sulfato Ferroso + Vitamina C",
    description: "Combo para absorção ideal do ferro, prevenindo anemia gestacional.",
    category: "suplementos",
    link: "https://www.amazon.com.br/s?k=sulfato+ferroso+vitamina+c",
    weeks_min: 16,
  },
  {
    id: "p3",
    name: "DHA / Ômega-3 Gestante",
    description: "Desenvolvimento cerebral do bebê. 200mg/dia de DHA recomendado.",
    category: "suplementos",
    link: "https://www.amazon.com.br/s?k=dha+omega3+gestante",
  },
  {
    id: "p4",
    name: "Travesseiro de Gestante Formato U",
    description: "Apoio lombar, pélvico e para os joelhos. Fundamental após a semana 20.",
    category: "conforto",
    link: "https://www.amazon.com.br/s?k=travesseiro+gestante+formato+u",
    weeks_min: 20,
    badge: "MAIS VENDIDO",
  },
  {
    id: "p5",
    name: "Cinta de Suporte Gestacional",
    description: "Alivia dores lombares e suporta o abdômen no 3º trimestre.",
    category: "conforto",
    link: "https://www.amazon.com.br/s?k=cinta+abdominal+gestante",
    weeks_min: 28,
  },
  {
    id: "p6",
    name: "Meias de Compressão Gestante",
    description: "Previnem varizes e edemas — problema comum na gravidez.",
    category: "conforto",
    link: "https://www.amazon.com.br/s?k=meias+compressao+gestante",
    weeks_min: 14,
  },
  {
    id: "p7",
    name: "Sutiã de Amamentação",
    description: "Alças largas, abertura fácil e tecido respirável para o pós-parto.",
    category: "amamentacao",
    link: "https://www.amazon.com.br/s?k=sutia+amamentacao+confortavel",
    weeks_min: 30,
  },
  {
    id: "p8",
    name: "Almofada de Amamentação",
    description: "Posiciona o bebê corretamente durante a mamada, aliviando tensão.",
    category: "amamentacao",
    link: "https://www.amazon.com.br/s?k=almofada+amamentacao",
    weeks_min: 30,
  },
  {
    id: "p9",
    name: "Absorvente para Seios Lavável",
    description: "Para vazamentos de colostro no final da gestação e na amamentação.",
    category: "amamentacao",
    link: "https://www.amazon.com.br/s?k=absorvente+seios+amamentacao+lavavel",
    weeks_min: 34,
  },
  {
    id: "p10",
    name: "Kit Enxoval Recém-nascido",
    description: "Body, mijão e macacão em algodão orgânico para o RN.",
    category: "enxoval",
    link: "https://www.amazon.com.br/s?k=kit+enxoval+recem+nascido+algodao",
    weeks_min: 20,
    badge: "PREPARE-SE",
  },
  {
    id: "p11",
    name: "Banheirinha Dobrável para Bebê",
    description: "Ergonômica, anti-escorregante, economiza espaço.",
    category: "enxoval",
    link: "https://www.amazon.com.br/s?k=banheira+bebe+dobravel",
    weeks_min: 24,
  },
  /* Aqui havia um "Monitor Doppler Fetal" — sonar doméstico, com o texto
     "Ouça o coração do seu bebê em casa entre as consultas", exibido sob o
     cabeçalho "Por que seu médico recomenda".

     Saiu, e não volta. O doppler caseiro é o aparelho classicamente associado
     à FALSA TRANQUILIZAÇÃO: a mãe percebe menos movimento, encosta o sonar,
     escuta um batimento — que pode ser o dela, a placenta, ou um foco que não
     diz nada sobre vitalidade — e deixa de procurar o pronto-socorro. O
     conselho obstétrico é o oposto: redução de movimento fetal se avalia com
     cardiotocografia, hoje, no serviço. Perder horas é o que muda desfecho.

     Num app de gestação de ALTO RISCO, vender isso já seria ruim. Vender com
     o selo do médico transforma o aviso clínico do app no seu contrário — a
     paciente confia no aparelho justamente porque veio daqui.

     Se um dia algum item de monitoramento fetal for reconsiderado, ele passa
     antes pelo Dr. Clóvis, por escrito. Não é decisão de catálogo. */
  {
    id: "p13",
    name: "Gravidez Semana a Semana — Livro",
    description: "O guia mais completo em português, com fotos e explicações médicas.",
    category: "livros",
    link: "https://www.amazon.com.br/s?k=gravidez+semana+a+semana+livro",
  },
  {
    id: "p14",
    name: "O Bebê da Barriga — Livro",
    description: "Leitura afetiva sobre desenvolvimento fetal, ideal para o casal.",
    category: "livros",
    link: "https://www.amazon.com.br/s?k=bebe+da+barriga+livro+gestacao",
  },
  {
    id: "p15",
    name: "Protetor Solar FPS 50+ Gestante",
    description: "Fórmula sem oxi-benzona, segura para a gestação e contra melasma.",
    category: "suplementos",
    link: "https://www.amazon.com.br/s?k=protetor+solar+gestante+fps50",
  },
];

const SHOP_CATEGORIES = [
  { key: "all", label: "Tudo" },
  { key: "suplementos", label: "Suplementos" },
  { key: "conforto", label: "Conforto" },
  { key: "amamentacao", label: "Amamentação" },
  { key: "enxoval", label: "Enxoval" },
  { key: "livros", label: "Livros" },
];

// Placeholder visual por categoria (simula foto do produto)
const CAT_VISUAL: Record<
  ShopProduct["category"],
  { bg: string; dark: string; emoji: string; label: string }
> = {
  suplementos: {
    bg: "from-emerald-50 to-teal-100",
    dark: "from-[#0d3322] to-[#1a5c3a]",
    emoji: "💊",
    label: "Suplementos",
  },
  conforto: {
    bg: "from-rose-50 to-rose-100",
    dark: "from-[#2d0a14] to-[#5c1a28]",
    emoji: "🛏️",
    label: "Conforto",
  },
  amamentacao: {
    bg: "from-rose-50 to-pink-100",
    dark: "from-[#3d0b1a] to-[#6b1a32]",
    emoji: "🤱",
    label: "Amamentação",
  },
  enxoval: {
    bg: "from-stone-50 to-stone-100",
    dark: "from-[#1a1410] to-[#2d2218]",
    emoji: "🍼",
    label: "Enxoval",
  },
  livros: {
    bg: "from-amber-50 to-orange-100",
    dark: "from-[#2d1800] to-[#5c3300]",
    emoji: "📖",
    label: "Livros",
  },
};

function ProductSheet({
  product,
  onClose,
  onSelectRelated,
}: {
  product: ShopProduct | null;
  onClose: () => void;
  onSelectRelated: (p: ShopProduct) => void;
}) {
  const vis = product ? CAT_VISUAL[product.category] : null;
  const related = product
    ? CURATED_PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(
        0,
        4,
      )
    : [];

  useEffect(() => {
    document.body.style.overflow = product ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [product]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          product ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white overflow-hidden transition-transform duration-300 ease-out ${
          product ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "88dvh" }}
      >
        {product && vis && (
          <div className="overflow-y-auto overscroll-contain">
            {/* Handle + fechar */}
            <div className="sticky top-0 z-10 flex items-center justify-center px-4 pt-3 pb-2 bg-white border-b border-gray-100">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
              <button
                onClick={onClose}
                className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Imagem */}
            <div
              className={`relative w-full bg-gradient-to-br ${vis.bg} flex items-center justify-center`}
              style={{ height: 210 }}
            >
              <span className="text-8xl select-none drop-shadow-md">{vis.emoji}</span>
              {product.badge && (
                <span className="absolute top-3 left-3 bg-[#ff7733] text-white text-xs font-bold px-2 py-1 rounded-sm uppercase tracking-wide leading-none">
                  {product.badge}
                </span>
              )}
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-4 pb-8">
              {/* Nome. Sem preço, sem "% OFF", sem "Envio grátis" — ver a nota
                  em CURATED_PRODUCTS: o link vai para uma BUSCA da Amazon, e
                  nenhum desses três números poderia ser verdade. */}
              <div>
                <h2 className="text-[18px] font-semibold text-gray-900 leading-snug">
                  {product.name}
                </h2>
              </div>

              {/* Recomendação médica */}
              <div className="rounded-xl bg-primary/[0.06] border border-primary/15 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1.5">
                  👨‍⚕️ Por que seu médico recomenda
                </p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{product.description}</p>
              </div>

              {/* Semana recomendada */}
              {(product.weeks_min != null || product.weeks_max != null) && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">📅 Semana recomendada:</span>
                  <span className="font-semibold text-gray-800">
                    {product.weeks_min != null && product.weeks_max != null
                      ? `Sem. ${product.weeks_min}–${product.weeks_max}`
                      : product.weeks_min != null
                        ? `A partir da sem. ${product.weeks_min}`
                        : `Até a sem. ${product.weeks_max}`}
                  </span>
                </div>
              )}

              {/* Selo de confiança */}
              <p className="text-xs text-gray-400">
                ✓ Curado e recomendado pelo seu médico — Ginecologia e Obstetrícia, especialista em
                gestação de alto risco
              </p>

              {/* CTA Amazon */}
              <a
                href={product.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff9900] py-4 text-[15px] font-bold text-white shadow-sm active:scale-[0.98] transition-transform"
              >
                Comprar na Amazon →
              </a>

              {/* Produtos relacionados */}
              {related.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 shrink-0">
                      Também recomendados
                    </p>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {related.map((r) => {
                      const rv = CAT_VISUAL[r.category];
                      return (
                        <button
                          key={r.id}
                          onClick={() => onSelectRelated(r)}
                          className="flex shrink-0 flex-col rounded-2xl overflow-hidden bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] active:scale-[0.96] transition-transform text-left"
                          style={{ width: 120 }}
                        >
                          <div
                            className={`w-full bg-gradient-to-br ${rv.dark} flex items-center justify-center relative`}
                            style={{ height: 90 }}
                          >
                            <span
                              className="text-[36px] leading-none"
                              style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.2))" }}
                            >
                              {rv.emoji}
                            </span>
                          </div>
                          <div className="px-2 pt-2 pb-2.5">
                            <p className="text-xs font-medium line-clamp-2 text-gray-800 leading-snug">
                              {r.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Meu Cantinho 🌱 (spend das Sementinhas) ---------- */
/**
 * Card "Compartilhe no Instagram e ganhe 100 🌱". Só aparece quando a integração
 * está configurada na Meta (enabled) — assim nunca prometemos algo que ainda não
 * credita. A paciente registra o @ dela; ao marcar @obstetrica.app num Story, o
 * webhook casa e credita automático (no máx. 1x/semana). Sem aprovação manual.
 */

/**
 * Card "Avalie o app e ganhe 100 🌱". Só aparece quando há loja publicada
 * (Play/App Store configurada). A paciente abre a loja, avalia e toca "já
 * avaliei" → ganha 100 uma vez (por confiança; a loja não diz quem avaliou).
 */

/**
 * Card "Deixe seu depoimento". A paciente escreve; o Dr. Clóvis aprova no
 * painel → ela ganha 100 🌱 (uma vez) e o texto pode ir pra página pública.
 * Mostra o status (em análise / publicado / recusado) e permite editar.
 */

/**
 * ─── A REDE DE SEGURANÇA DO CÓDIGO DE EMBAIXADORA ───────────────────────────
 *
 * Muita gente vê o Reels no computador ou numa conta secundária e depois abre a
 * loja no celular e busca "Obstétrica" — sem clicar no link. Sem este campo, a
 * influenciadora perde a indicação e a paciente perde o bônus, e nenhuma das
 * duas fica sabendo por quê.
 *
 * ⚠️ A JANELA NÃO É DE 48 HORAS, e a escolha é deliberada. A proposta original
 * dava 48h; o que decide de verdade é `ref_code` ainda estar vazio — a comissão
 * prende na ASSINATURA PAGA, e a assinatura pode acontecer no dia 40. Um
 * relógio de 48h recusaria uma indicação legítima e obrigaria a paciente a
 * escrever para o suporte por causa de um campo de texto.
 *
 * O que o `.is("ref_code", null)` do servidor garante é o que importa: o
 * primeiro código vence e ninguém rouba a indicação de ninguém depois.
 *
 * ⚠️ E O CARTÃO SOME quando ela já tem código. Um campo que aceita digitação e
 * responde "você já tem" a cada tentativa é um campo que ensina a paciente a
 * não confiar nos campos desta tela.
 */

/**
 * Card "Indique uma amiga". Mostra o link pessoal da paciente; quando a amiga
 * entra pelo link e cria a conta, a indicadora ganha 100 🌱 (uma vez por amiga).
 */

/**
 * A LOJA DE PRODUTOS DE VERDADE — suplemento, conforto e enxoval, por dinheiro.
 *
 * ⚠️ ELA ERA A QUINTA TELA SEM MODO CUIDADO, e ninguém tinha reparado.
 *
 * O comentário de `SilencioDoCuidado` lista quatro telas que exibiam bebê para
 * quem tinha acabado de perder a gestação, e diz "a loja mostrava Berço com
 * preço" — mas aquela "loja" é o CANTINHO (`objeto-berco`, enfeite por
 * Sementinhas). Esta aqui, que vende **Kit Enxoval Recém-nascido**,
 * **Banheirinha Dobrável para Bebê**, **Sutiã de Amamentação** e **Almofada de
 * Amamentação**, nunca recebeu `careMode` em nenhuma versão.
 *
 * E o caminho até ela é curto: a linha "Loja · Suplementos, conforto e enxoval"
 * está no menu da conta, ao lado de tudo o mais — nada avisa o que tem dentro.
 *
 * Os suplementos continuariam fazendo sentido depois de uma perda (ferro para
 * anemia, por exemplo). Não é motivo para deixar a tela de pé: isto aqui é uma
 * lista de afiliados da Amazon, não é cuidado — não se perde clínica nenhuma
 * calando-a, e o cuidado de verdade continua inteiro no resto do app.
 */
function LojaTab({
  gest,
  careMode,
  onNavigate,
}: {
  gest: Gest;
  careMode: boolean;
  onNavigate?: (t: Tab) => void;
}) {
  const [category, setCategory] = useState("all");
  const [weekFilter, setWeekFilter] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [filtersHidden, setFiltersHidden] = useState(false);
  const lastScrollY = useRef(0);
  const currentWeek = gest?.weeks ?? null;

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 140 && y > lastScrollY.current + 8) {
        setFiltersHidden(true);
      } else if (y < lastScrollY.current - 6) {
        setFiltersHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ⚠️ DEPOIS dos hooks, nunca antes: um `return` acima deles muda a ordem de
     chamada entre renders e o React quebra. É por isso que o `careMode` das
     outras quatro telas também aparece só aqui embaixo. */
  const filtered = CURATED_PRODUCTS.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (weekFilter && currentWeek !== null) {
      const afterMin = p.weeks_min == null || currentWeek >= p.weeks_min - 2;
      const beforeMax = p.weeks_max == null || currentWeek <= p.weeks_max + 2;
      if (!afterMin || !beforeMax) return false;
    }
    return true;
  });

  // Produtos em destaque desta semana
  const weekHighlights =
    currentWeek !== null
      ? CURATED_PRODUCTS.filter((p) => {
          const afterMin = p.weeks_min == null || currentWeek >= p.weeks_min;
          const beforeMax = p.weeks_max == null || currentWeek <= p.weeks_max;
          return afterMin && beforeMax;
        }).slice(0, 2)
      : [];

  if (careMode) return <SilencioDoCuidado onNavigate={onNavigate} />;

  return (
    <div className="-mx-4 bg-white px-4 pb-8 pt-4 space-y-4">
      {/* ── Header ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-serif text-[15px] font-semibold text-primary/70">
            Curadoria do seu médico
          </p>
          <h2 className="font-serif text-[22px] font-medium leading-tight text-gray-900 mt-0.5">
            Seleção da semana
          </h2>
        </div>
        {currentWeek !== null && (
          <button
            onClick={() => setWeekFilter((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              weekFilter ? "bg-primary text-white" : "border border-primary/30 text-primary"
            }`}
          >
            <span className="text-xs">⬤</span> Sem. {currentWeek}
          </button>
        )}
      </div>

      {/* ── Destaque da semana — cards horizontais premium ── */}
      {weekFilter && weekHighlights.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {weekHighlights.map((p) => {
            const vis = CAT_VISUAL[p.category];
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className="flex shrink-0 overflow-hidden rounded-2xl shadow-sm text-left active:scale-[0.97] transition-transform"
                style={{ width: 220 }}
              >
                <div
                  className={`bg-gradient-to-br ${vis.dark} flex items-center justify-center`}
                  style={{ width: 72, flexShrink: 0 }}
                >
                  <span className="text-[36px]">{vis.emoji}</span>
                </div>
                <div className="flex flex-col justify-center bg-white px-3 py-3 flex-1 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary/70 mb-0.5">
                    {vis.label}
                  </span>
                  <p className="text-xs font-medium leading-tight line-clamp-2 text-gray-800">
                    {p.name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filtros — sticky, some on scroll down ── */}
      <div
        style={{ top: "var(--safe-top)" }}
        className={`sticky z-20 -mx-4 px-4 py-2.5 bg-white/95 backdrop-blur-sm border-b border-gray-100 transition-transform duration-200 ease-in-out ${
          filtersHidden ? "-translate-y-[130%]" : "translate-y-0"
        }`}
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {SHOP_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                category === c.key
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground/60 hover:text-foreground/80"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de produtos ─────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-serif text-lg text-foreground/70">Nenhum produto neste filtro</p>
          <button
            onClick={() => setWeekFilter(false)}
            className="mt-2 text-xs text-primary underline"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product) => {
            const vis = CAT_VISUAL[product.category];
            return (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.09)] active:scale-[0.96] transition-transform text-left"
              >
                {/* Imagem escura — premium */}
                <div
                  className={`relative w-full bg-gradient-to-br ${vis.dark} flex items-center justify-center`}
                  style={{ aspectRatio: "1 / 1" }}
                >
                  <span
                    className="text-[62px] select-none leading-none"
                    style={{ filter: "drop-shadow(0 0 18px rgba(255,255,255,0.25))" }}
                  >
                    {vis.emoji}
                  </span>

                  {/* Label categoria — canto superior direito */}
                  <span className="absolute top-2 right-2 text-xs font-semibold uppercase tracking-widest text-white/50">
                    {vis.label}
                  </span>

                  {/* Badge destaque — canto superior esquerdo */}
                  {product.badge && (
                    <span className="absolute top-2 left-2 bg-[#ff7733] text-white text-xs font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide leading-none">
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col px-2.5 pt-2.5 pb-3">
                  <p className="text-xs font-medium leading-snug line-clamp-2 text-gray-800">
                    {product.name}
                  </p>
                  <div className="mt-2 flex items-center justify-end">
                    <span className="text-xs font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded-full">
                      ✓ Recomendado
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Dizia "comprar pelo link apoia o portal". Não apoiava: nenhum dos 15
          links carrega tag de afiliado, então ninguém era remunerado por
          nenhuma compra. Enquanto não houver programa de afiliados de fato, a
          linha diz só o que é verdade. */}
      <p className="text-center text-xs text-gray-400 pb-4">
        Seleção do consultório · os preços você confere na Amazon
      </p>

      <ProductSheet
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSelectRelated={(p) => setSelectedProduct(p)}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 11 — Consulta Particular
───────────────────────────────────────────────────────── */
function ConsultaParticularTab({ profile }: { profile: Profile | null }) {
  const [consultations, setConsultations] = useState<PrivateConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"list" | "new">("list");
  const [selectedType, setSelectedType] = useState(CONSULT_TYPES[0].key);
  const [preferredDates, setPreferredDates] = useState(["", "", ""]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  /* PIX do médico DA PACIENTE — e `null` até saber qual é.
     
     Antes o estado nascia na chave central do dono da plataforma, e como
     `getMyDoctorPix` devolve nulo quando o médico dela não cadastrou chave, o
     fallback nunca era substituído: ela pagava a consulta de outro profissional
     na conta do fundador. Dinheiro no lugar errado é o tipo de erro que não
     pode ter fallback — sem chave, a tela diz que não há como pagar por aqui. */
  const [pix, setPix] = useState<{ key: string; name: string } | null>(null);
  const [meuMedicoNome, setMeuMedicoNome] = useState("");
  const PIX_KEY = pix?.key ?? "";
  const PIX_NAME = pix?.name ?? "";

  /* O valor que a tela mostra é o valor GRAVADO na consulta.
  
     A tabela de `CONSULT_TYPES` é uma sugestão da plataforma; o servidor agora
     cobra o `consultation_price_brl` do médico dela e grava isso em
     `amount_cents`. Enquanto a tela lia a tabela, um médico de R$ 600 gerava um
     registro de R$ 600 e a paciente lia "R$ 150" ao lado da chave PIX dele — e
     pagava 150. Preço exibido diferente do preço cobrado é dinheiro errado nas
     duas direções. */
  const precoDaConsulta = (c: { amount_cents?: number | null }, tabela?: string) =>
    c.amount_cents != null && c.amount_cents > 0
      ? `R$ ${(c.amount_cents / 100).toFixed(2).replace(".", ",")}`
      : (tabela ?? "a combinar");

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await getMyPrivateConsultations({ data: { accessToken: s.session.access_token } });
    if (res.ok) setConsultations(res.consultations);
    /* PIX do médico DELA. Sem chave cadastrada, fica nulo de propósito — a
       tela avisa em vez de mostrar a chave de outra pessoa. */
    const pixRes = await getMyDoctorPix({ data: { accessToken: s.session.access_token } });
    if (pixRes.ok && pixRes.pix?.key) {
      setPix({ key: pixRes.pix.key, name: pixRes.pix.name || "seu médico" });
    }
    /* Nome do médico DELA para o título da aba. Sem vínculo fica vazio e o
       título vira "Consulta particular" — nunca o nome do fundador. */
    try {
      const cont = await getMyDoctorContact({ data: { accessToken: s.session.access_token } });
      if (cont.ok && cont.doctor?.nome) setMeuMedicoNome(cont.doctor.nome.trim());
    } catch {
      /* título genérico é resposta suficiente */
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRequest() {
    setSubmitting(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const res = await requestPrivateConsultation({
        data: {
          accessToken: s.session.access_token,
          consultType: selectedType,
          preferredDates: preferredDates.filter(Boolean),
          message: message || null,
        },
      });
      if (!res.ok) {
        toast.error("Não foi possível enviar a solicitação. Tente novamente.");
        return;
      }
      setNewId(res.consultation.id);
      setStep("list");
      await load();
    } catch {
      toast.error("Não foi possível enviar a solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkPayment(id: string) {
    setMarkingId(id);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const res = await markPaymentSent({ data: { accessToken: s.session.access_token, id } });
      if (!res.ok) {
        toast.error("Não foi possível registrar o pagamento. Tente novamente.");
        return;
      }
      await load();
    } catch {
      toast.error("Não foi possível registrar o pagamento. Tente novamente.");
    } finally {
      setMarkingId(null);
    }
  }

  const selectedConsultType = CONSULT_TYPES.find((c) => c.key === selectedType) ?? CONSULT_TYPES[0];

  const statusConfig: Record<string, { label: string; color: string; emoji: string }> = {
    pendente_pagamento: {
      label: "Aguardando pagamento",
      color: "border-primary/20 bg-primary/6",
      emoji: "⏳",
    },
    pagamento_enviado: {
      label: "Pagamento enviado — aguardando confirmação",
      color: "border-border bg-secondary/60",
      emoji: "💸",
    },
    confirmado: {
      label: "Confirmado — aguardando agendamento",
      color: "border-green-200 bg-green-50",
      emoji: "✅",
    },
    realizado: { label: "Consulta realizada", color: "border-border bg-secondary/30", emoji: "🏁" },
    cancelado: { label: "Cancelado", color: "border-red-200 bg-red-50", emoji: "❌" },
  };

  if (loading) return <TabSkeleton />;

  if (step === "new") {
    return (
      <div className="max-w-xl space-y-6">
        <button onClick={() => setStep("list")} className="text-sm text-primary">
          ← Voltar
        </button>

        <div className="rounded-3xl card-material p-6">
          <h2 className="font-serif text-xl mb-4">Nova consulta particular</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de consulta</label>
              <div className="space-y-3">
                {CONSULT_TYPES.map((ct) => (
                  <label
                    key={ct.key}
                    className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${
                      selectedType === ct.key ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      value={ct.key}
                      checked={selectedType === ct.key}
                      onChange={() => setSelectedType(ct.key)}
                      className="mt-1 accent-primary"
                    />
                    <div>
                      <p className="font-medium text-sm">{ct.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ct.desc}</p>
                      <p className="text-sm font-semibold text-primary mt-1">{ct.price}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Datas e horários preferidos (opcional)
              </label>
              <div className="space-y-2">
                {preferredDates.map((d, i) => (
                  <input
                    key={i}
                    type="datetime-local"
                    value={d}
                    onChange={(e) => {
                      const next = [...preferredDates];
                      next[i] = e.target.value;
                      setPreferredDates(next);
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Informe até 3 opções — o seu médico confirmará a disponibilidade.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mensagem (opcional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Descreva brevemente o motivo da consulta…"
                className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Sem chave PIX do médico dela não há o que mostrar — e mostrar a de
            outra pessoa seria mandar o dinheiro para a conta errada. */}
        {!pix ? (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 dark:bg-amber-500/10">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              💳 Pagamento a combinar
            </p>
            <p className="mt-1 text-sm leading-snug text-amber-900/85 dark:text-amber-200/85">
              Seu médico ainda não cadastrou uma chave PIX no app. Solicite a consulta normalmente —
              ele entra em contato para combinar o pagamento.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
            <p className="font-semibold mb-3">💳 Pagamento via PIX</p>
            <p className="text-sm text-muted-foreground mb-3">
              Após solicitar, efetue o pagamento via PIX e marque como pago. Seu médico confirmará e
              entrará em contato.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-background border border-border px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Chave PIX</span>
                <span className="font-mono text-sm font-medium">{PIX_KEY}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-background border border-border px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Favorecido</span>
                <span className="text-sm font-medium">{PIX_NAME}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-background border border-border px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Valor</span>
                <span className="text-sm font-semibold text-primary">
                  {selectedConsultType.price}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleRequest}
          disabled={submitting}
          className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? "Solicitando…" : "Solicitar consulta"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-[15px] font-semibold text-primary mb-1">
          Consultas particulares
        </p>
        {/* Sem nome do fundador: esta aba é de TODA paciente de TODO médico. */}
        <h2 className="font-serif text-2xl">
          {meuMedicoNome ? `Consulta com ${meuMedicoNome}` : "Consulta particular"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Videochamadas particulares sem intermediário. Pagamento via PIX direto ao médico.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CONSULT_TYPES.map((ct) => (
            <div key={ct.key} className="rounded-2xl border border-border bg-secondary/20 p-4">
              <p className="text-sm font-medium">{ct.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{ct.desc}</p>
              <p className="mt-2 font-bold text-primary">{ct.price}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => setStep("new")}
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white"
        >
          + Solicitar consulta
        </button>
      </div>

      {newId && (
        <div className="rounded-3xl border border-green-200 bg-green-50 p-5">
          <p className="font-semibold text-green-700">✅ Solicitação enviada!</p>
          <p className="text-sm text-green-600 mt-1">
            {consultations.find((c) => c.id === newId)?.pix_qr_code_base64
              ? "Escaneie o QR Code PIX abaixo ou copie o código para pagar. A confirmação é automática."
              : "Use a chave PIX abaixo para pagar e depois toque em “Marquei o pagamento” — seu médico confirmará manualmente."}
          </p>
        </div>
      )}

      {consultations.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-serif text-xl text-foreground/70">Nenhuma consulta ainda</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Solicite sua primeira consulta particular acima.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((c) => {
            const st = statusConfig[c.status] ?? statusConfig["pendente_pagamento"];
            const typeInfo = CONSULT_TYPES.find((t) => t.key === c.consult_type);
            return (
              <div key={c.id} className={`rounded-2xl border p-5 ${st.color}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {st.emoji} {typeInfo?.label ?? c.consult_type}
                    </p>
                    <p className="text-xs mt-0.5 text-muted-foreground">{st.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Solicitado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    {c.preferred_dates.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Datas sugeridas:{" "}
                        {c.preferred_dates
                          .map((d) => new Date(d).toLocaleString("pt-BR"))
                          .join(", ")}
                      </p>
                    )}
                    {c.message && (
                      <p className="text-xs mt-1 italic text-muted-foreground">"{c.message}"</p>
                    )}
                  </div>
                  <span className="shrink-0 font-bold text-sm text-primary">
                    {precoDaConsulta(c, typeInfo?.price)}
                  </span>
                </div>
                {c.status === "pendente_pagamento" && (
                  <div className="mt-4 space-y-3">
                    {c.pix_qr_code_base64 ? (
                      <>
                        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white/80 p-4">
                          <img
                            src={`data:image/png;base64,${c.pix_qr_code_base64}`}
                            alt="QR Code PIX"
                            className="h-44 w-44 rounded-xl"
                          />
                          <p className="text-xs text-center text-muted-foreground">
                            Escaneie com o app do seu banco ou copie o código abaixo
                          </p>
                        </div>
                        {c.pix_qr_code && (
                          <button
                            onClick={() => navigator.clipboard.writeText(c.pix_qr_code!)}
                            className="w-full rounded-full border border-primary px-4 py-2 text-xs font-medium text-primary hover:bg-primary/5"
                          >
                            📋 Copiar código PIX (copia e cola)
                          </button>
                        )}
                        <p className="text-xs text-center text-muted-foreground">
                          A confirmação é automática — assim que o PIX for processado você receberá
                          a confirmação.
                        </p>
                      </>
                    ) : !PIX_KEY ? (
                      /* Sem chave PIX do médico dela, o cartão mostrava
                         "Chave PIX:" e "Favorecido:" em branco, com um botão
                         "✓ Marquei o pagamento" — e um banner acima dizendo
                         "use a chave PIX abaixo". Nada para copiar e um botão
                         para confirmar um pagamento impossível. */
                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs dark:bg-amber-500/10">
                        <p className="font-semibold text-amber-800 dark:text-amber-200">
                          Pagamento a combinar
                        </p>
                        <p className="mt-1 leading-snug text-amber-900/80 dark:text-amber-100/80">
                          {meuMedicoNome || "Seu médico"} ainda não cadastrou uma chave PIX no app.
                          Combine o pagamento direto com o consultório — o pedido de consulta já
                          está registrado.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-xl bg-white/70 border border-border p-3 text-xs space-y-1">
                          <p className="font-medium">
                            Chave PIX: <span className="font-mono">{PIX_KEY}</span>
                          </p>
                          <p>
                            Favorecido: {PIX_NAME} · Valor: {precoDaConsulta(c, typeInfo?.price)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleMarkPayment(c.id)}
                          disabled={markingId === c.id}
                          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
                        >
                          {markingId === c.id ? "Marcando…" : "✓ Marquei o pagamento"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Após confirmar o pagamento, seu médico entrará em contato para confirmar o horário.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 40a — Ciclo Menstrual
───────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────
   Ciclo visual — estilo Apple Health (anel de fases + calendário)
───────────────────────────────────────────────────────── */

// Ovulação ~14 dias antes do próximo período. Em base 1 (dia 1 = início do
// período), isso cai no dia `cycleLen - 13`.

// Dia do ciclo (base 1) para uma data qualquer, projetando o ciclo médio pra
// frente e pra trás a partir do último período registrado.

// Próximos marcos (a partir de hoje): período, ovulação, janela fértil.

const SAUDE_MULHER_SUBTABS = [
  { key: "ciclo", label: "Ciclo menstrual" },
  { key: "preventivos", label: "Preventivos" },
] as const;

/** Hub "Saúde da mulher": Ciclo Menstrual + Preventivos numa tela só. */
function SaudeMulherHub() {
  const [sub, setSub] = useState<(typeof SAUDE_MULHER_SUBTABS)[number]["key"]>("ciclo");
  return (
    <div className="space-y-5">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto">
        {SAUDE_MULHER_SUBTABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              sub === s.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground/55 hover:text-foreground/80"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Fade key={sub}>
        {sub === "ciclo" && <CicloMenstrualTab />}
        {sub === "preventivos" && <PreventivosTab />}
      </Fade>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 40b — Preventivos
───────────────────────────────────────────────────────── */

type ExamDef = {
  key: string;
  name: string;
  emoji: string;
  frequency: string;
  frequencyMonths: number;
  description: string;
  ageFrom?: number;
};

const PREVENTIVE_EXAMS: ExamDef[] = [
  {
    key: "papanicolau",
    name: "Papanicolau",
    emoji: "🔬",
    frequency: "Anual",
    frequencyMonths: 12,
    description:
      "Rastreamento do câncer de colo do útero. Após 2 exames normais seguidos, pode ser feito a cada 3 anos.",
  },
  {
    key: "mamografia",
    name: "Mamografia",
    emoji: "🩻",
    frequency: "Anual (40+)",
    frequencyMonths: 12,
    description:
      "Rastreamento do câncer de mama. A partir de 40 anos ou 35 anos em caso de histórico familiar.",
    ageFrom: 40,
  },
  {
    key: "ultrassom_tv",
    name: "Ultrassom Pélvico",
    emoji: "📡",
    frequency: "Anual",
    frequencyMonths: 12,
    description:
      "Avaliação dos ovários, útero e endométrio. Detecta cistos, miomas e outras alterações.",
  },
  {
    key: "glicemia",
    name: "Glicemia em Jejum",
    emoji: "🩸",
    frequency: "Anual",
    frequencyMonths: 12,
    description: "Rastreamento de diabetes e pré-diabetes.",
  },
  {
    key: "colesterol",
    name: "Perfil Lipídico",
    emoji: "💉",
    frequency: "A cada 5 anos",
    frequencyMonths: 60,
    description: "Colesterol total, HDL, LDL e triglicérides. Risco cardiovascular.",
  },
  {
    key: "tsh",
    name: "TSH / T4 Livre",
    emoji: "🦋",
    frequency: "A cada 2 anos",
    frequencyMonths: 24,
    description: "Função da tireoide. Importante para mulheres em idade fértil.",
    ageFrom: 35,
  },
  {
    key: "pressao_arterial",
    name: "Pressão Arterial",
    emoji: "💊",
    frequency: "Semestral",
    frequencyMonths: 6,
    description:
      "Controle da pressão arterial. Hipertensão é silenciosa — medir regularmente é fundamental.",
  },
  {
    key: "dentista",
    name: "Dentista",
    emoji: "🦷",
    frequency: "Semestral",
    frequencyMonths: 6,
    description:
      "Saúde bucal com impacto direto na saúde geral. Cáries e inflamações gengivas elevam risco sistêmico.",
  },
  {
    key: "dermatologista",
    name: "Mapeamento de Pintas",
    emoji: "☀️",
    frequency: "Anual",
    frequencyMonths: 12,
    description: "Dermatoscopia para rastreamento do melanoma e outros cânceres de pele.",
  },
  {
    key: "oftalmologista",
    name: "Oftalmologista",
    emoji: "👁️",
    frequency: "A cada 2 anos",
    frequencyMonths: 24,
    description: "Avaliação da visão, pressão intraocular e saúde ocular.",
  },
];

function nextDueDate(lastDone: string | null, frequencyMonths: number): Date | null {
  if (!lastDone) return null;
  const d = new Date(lastDone + "T00:00:00");
  d.setMonth(d.getMonth() + frequencyMonths);
  return d;
}

function PreventivosTab() {
  const [reminders, setReminders] = useState<PreventiveReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await getPreventiveReminders({ data: { accessToken: s.session.access_token } });
    if (res.ok) setReminders(res.reminders);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!editingKey) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setSaving(false);
      return;
    }
    await setPreventiveReminder({
      data: {
        accessToken: s.session.access_token,
        examKey: editingKey,
        lastDoneDate: editDate || null,
        notes: editNotes || null,
      },
    });
    setEditingKey(null);
    await load();
    setSaving(false);
  }

  if (loading) return <TabSkeleton />;

  const reminderMap = Object.fromEntries(reminders.map((r) => [r.exam_key, r]));
  const today = new Date();

  // Group: overdue, due soon (within 60 days), ok
  const examGroups = PREVENTIVE_EXAMS.map((exam) => {
    const r = reminderMap[exam.key];
    const nextDue = r?.last_done_date ? nextDueDate(r.last_done_date, exam.frequencyMonths) : null;
    const daysUntil = nextDue ? Math.round((nextDue.getTime() - today.getTime()) / 86400000) : null;
    let status: "overdue" | "soon" | "ok" | "never" = "never";
    if (r?.last_done_date) {
      if (daysUntil !== null) {
        if (daysUntil < 0) status = "overdue";
        else if (daysUntil <= 60) status = "soon";
        else status = "ok";
      }
    }
    return { exam, r, nextDue, daysUntil, status };
  });

  const overdueCount = examGroups.filter((e) => e.status === "overdue").length;
  const soonCount = examGroups.filter((e) => e.status === "soon").length;
  const neverCount = examGroups.filter((e) => e.status === "never").length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Em atraso",
            value: overdueCount,
            color: "text-red-600 bg-red-50 border-red-200",
          },
          {
            label: "Em breve",
            value: soonCount,
            color: "text-primary bg-primary/6 border-primary/20",
          },
          {
            label: "Não registrado",
            value: neverCount,
            color: "text-muted-foreground bg-secondary border-border",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Exam list */}
      <div className="space-y-3">
        {examGroups.map(({ exam, r, nextDue, daysUntil, status }) => {
          const isEditing = editingKey === exam.key;
          const statusColor =
            status === "overdue"
              ? "border-red-200 bg-red-50"
              : status === "soon"
                ? "border-primary/20 bg-primary/6"
                : status === "ok"
                  ? "border-green-200 bg-green-50"
                  : "border-border bg-card";
          const statusEmoji =
            status === "overdue" ? "⚠️" : status === "soon" ? "🔔" : status === "ok" ? "✅" : "📋";

          return (
            <div key={exam.key} className={`rounded-2xl border p-4 ${statusColor}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xl shrink-0 mt-0.5">{exam.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{exam.name}</p>
                      <span className="text-sm">{statusEmoji}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{exam.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Frequência recomendada: {exam.frequency}
                    </p>
                    {r?.last_done_date && (
                      <p className="text-xs mt-1">
                        Último:{" "}
                        {new Date(r.last_done_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {nextDue && ` · Próximo: ${nextDue.toLocaleDateString("pt-BR")} `}
                        {daysUntil !== null && (
                          <span
                            className={
                              daysUntil < 0
                                ? "text-red-600 font-medium"
                                : daysUntil <= 60
                                  ? "text-primary font-medium"
                                  : "text-green-600"
                            }
                          >
                            {daysUntil < 0
                              ? `(${Math.abs(daysUntil)} dias em atraso)`
                              : daysUntil === 0
                                ? "(hoje)"
                                : `(em ${daysUntil} dias)`}
                          </span>
                        )}
                      </p>
                    )}
                    {r?.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.notes}"</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingKey(isEditing ? null : exam.key);
                    setEditDate(r?.last_done_date ?? "");
                    setEditNotes(r?.notes ?? "");
                  }}
                  className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                >
                  {isEditing ? "Fechar" : r?.last_done_date ? "Atualizar" : "Registrar"}
                </button>
              </div>
              {isEditing && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Data do último exame</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Observações</label>
                      <input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Resultado, local, médico…"
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {saving ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground pb-4">
        Frequências baseadas nas diretrizes da FEBRASGO e CFM. Consulte seu médico para orientações
        individualizadas.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉDICO TAB — perfil completo do médico associado (DOCTOR config)
// ─────────────────────────────────────────────────────────────────────────────
function MédicoTab() {
  const [token, setToken] = useState<string | null>(null);
  const [link, setLink] = useState<MyDoctorLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryDoctor[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  /** O nome digitado não casou com ninguém — a lista é o diretório inteiro. */
  const [semMatch, setSemMatch] = useState(false);
  /** A lista veio sem os filtros (banco sem as colunas do perfil). */
  const [filtrosFora, setFiltrosFora] = useState(false);
  /**
   * ⚠️ **"NÃO CONSEGUI LER" TINHA A CARA DE "ELE NÃO ESTÁ AQUI".**
   *
   * `searchDoctors` devolve `{ ok: false, error }` quando a leitura falha — e a
   * tela descartava o sinal, caía em `results: []` com `searched: true`, e
   * escrevia **"Nenhum médico com esse nome"**. Uma queda de rede fazia o app
   * afirmar, sobre o mundo real, que o obstetra dela não está na plataforma.
   *
   * Nesta aba isso é o pior desfecho possível: ela procura o SEU médico, lê que
   * ele não existe aqui, e **para de procurar**. O vínculo que liga uma gestação
   * de alto risco ao obstetra dela morre numa frase que não era verdade.
   *
   * ⚠️ É a mesma correção que `meuFeed`, `sugestoesDoFeed` e `buscarPerfis`
   * ganharam na Comunidade (`motivo: "instavel"`), deixada de pé aqui.
   */
  const [falhouABusca, setFalhouABusca] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function loadLink() {
    const tk = await getToken();
    setToken(tk);
    if (!tk) {
      setLoading(false);
      return;
    }
    const res = await getMyDoctorLink({ data: { accessToken: tk } });
    if (res.ok) setLink(res.link);
    setLoading(false);
  }

  useEffect(() => {
    void loadLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Já busca ao abrir, com o campo vazio: a paciente vê a lista de obstetras
     sem digitar nada. Antes a tela abria vazia esperando um nome — e quem não
     sabe o nome de nenhum obstetra do app não tinha o que digitar. */
  useEffect(() => {
    if (!link?.doctor && !link?.pending) void doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  /* Busca no diretório, não na RPC antiga: ranqueada por plano, devolvendo
     cidade e experiência. E sem exigir selo — antes um médico que acabou de se
     cadastrar não aparecia para ninguém, e a paciente concluía que ele não
     estava no app. */
  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setSearching(true);
    try {
      const res = await buscarDiretorio({ data: { q: query.trim() } });
      /* `semCorrespondencia` = o nome que ela digitou não casou com ninguém, e
         a lista é o diretório inteiro. Sem ler esse sinal, esta aba — que é
         justamente "Meu médico", onde ela procura o SEU obstetra — mostrava
         obstetras aleatórios como se fossem o resultado da busca, cada um com
         um botão "Solicitar". Pedir vínculo ao médico errado era o desfecho
         provável. */
      setFalhouABusca(!res.ok);
      setSemMatch(res.ok ? !!res.semCorrespondencia : false);
      setFiltrosFora(res.ok ? !!res.filtrosIgnorados : false);
      setResults(res.ok ? res.doctors : []);
    } catch {
      /* Queda de rede é o MESMO caso: o que não pode acontecer é a tela
         concluir "ele não está aqui" a partir de uma lista que ninguém leu. */
      setFalhouABusca(true);
      setResults([]);
    }
    setSearched(true);
    setSearching(false);
  }

  async function sendRequest(d: DirectoryDoctor) {
    const tk = token ?? (await getToken());
    if (!tk) return;
    setBusyId(d.id);
    const res = await requestDoctor({ data: { accessToken: tk, doctorId: d.id } });
    setBusyId(null);
    if (res.ok) {
      toast.success(
        res.status === "accepted"
          ? "Você já está vinculada a esse médico."
          : "Solicitação enviada! Aguarde o médico aceitar.",
      );
      setShowSearch(false);
      await loadLink();
    } else {
      toast.error("Não foi possível enviar a solicitação.");
    }
  }

  async function cancelPending() {
    const tk = token ?? (await getToken());
    if (!tk || !link?.pending) return;
    setBusyId("cancel");
    await cancelDoctorRequest({ data: { accessToken: tk, requestId: link.pending.id } });
    setBusyId(null);
    await loadLink();
  }

  if (loading)
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>;

  const doctor = link?.doctor ?? null;
  const pending = link?.pending ?? null;

  return (
    <div className="space-y-6 pb-8">
      {doctor ? (
        <div className="rounded-2xl card-material p-6">
          <p className="font-serif text-[15px] font-semibold text-primary">Meu obstetra</p>
          <h2 className="mt-1 font-serif text-2xl text-foreground">
            {doctor.display_name || "Obstetra"}
          </h2>
          {(doctor.title || doctor.specialty) && (
            <p className="text-sm text-muted-foreground">
              {[doctor.title, doctor.specialty].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Você está vinculada a este obstetra. No <strong>Chat IA</strong>, o assistente responde
            com o estilo e as condutas que o seu médico validou.
          </p>
          {/* ─── ONDE ELE ATENDE ──────────────────────────────────────────
              ⚠️ O médico cadastra vários consultórios no painel e a paciente
              via um campo de texto solto do perfil dele — e, uma vez vinculada,
              endereço NENHUM. `listDoctorAddresses` é pública, existe desde a
              primeira migração do painel e tinha zero chamadores.

              O custo é ela ir ao lugar errado: um obstetra que atende na segunda
              e na quinta em endereços diferentes é o caso comum, e falta em
              consultório de alto risco é vaga perdida duas vezes. */}
          <ConsultoriosDoMedico doctorId={doctor.id} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/agendamento"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Agendar consulta
            </Link>
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="rounded-full border border-primary/40 px-4 py-2 text-sm font-medium text-primary"
            >
              Trocar de médico
            </button>
          </div>
        </div>
      ) : pending ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <p className="font-serif text-[15px] font-semibold text-amber-700">Solicitação enviada</p>
          <h2 className="mt-1 font-serif text-xl text-foreground">
            Aguardando {pending.doctor.display_name || "o médico"} aceitar
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Assim que o médico aceitar, você poderá conversar com a IA do consultório dele aqui no
            app.
          </p>
          <button
            onClick={cancelPending}
            disabled={busyId === "cancel"}
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-40"
          >
            Cancelar solicitação
          </button>
        </div>
      ) : (
        <div className="rounded-2xl card-material p-6">
          <p className="font-serif text-[15px] font-semibold text-primary">Meu obstetra</p>
          <h2 className="mt-1 font-serif text-xl text-foreground">Encontre o seu obstetra</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Busque pelo nome do seu médico e envie uma solicitação. Quando ele aceitar, seu
            acompanhamento fica conectado — e o Chat IA passa a responder como o consultório dele.
          </p>
        </div>
      )}

      {(!doctor || showSearch) && !pending && (
        <div className="rounded-2xl card-material p-6">
          <form onSubmit={doSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome do médico ou especialidade…"
              className="flex-1 rounded-full border border-input bg-card px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {falhouABusca && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-500/10">
                <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">
                  Não consegui carregar a lista agora
                </p>
                <p className="mt-0.5 text-xs leading-snug text-amber-900/80 dark:text-amber-100/80">
                  Isso é a nossa conexão, não o cadastro do seu médico — ele pode muito bem estar
                  aqui.
                </p>
                <button
                  type="button"
                  onClick={() => doSearch()}
                  disabled={searching}
                  className="mt-2 min-h-[44px] rounded-full border border-amber-400 px-4 text-sm font-medium text-amber-900 disabled:opacity-40 dark:text-amber-100"
                >
                  {searching ? "Buscando…" : "Tentar de novo"}
                </button>
              </div>
            )}
            {searched && !falhouABusca && results.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum médico com esse nome. Tente só o sobrenome, ou deixe o campo vazio e toque em
                Buscar para ver todos os obstetras do app.
              </p>
            )}
            {filtrosFora && results.length > 0 && (
              <p className="rounded-xl bg-secondary/60 p-3 text-xs leading-snug text-muted-foreground">
                Esta lista está sem filtros — mostrando todos os obstetras do app.
              </p>
            )}
            {semMatch && results.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-500/10">
                <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">
                  Não encontramos “{query.trim()}” no app
                </p>
                <p className="mt-0.5 text-xs leading-snug text-amber-900/80 dark:text-amber-100/80">
                  Seu médico talvez ainda não esteja aqui. Abaixo estão os obstetras que já atendem
                  pelo app — confira o nome antes de solicitar.
                </p>
              </div>
            )}
            {results.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {d.display_name || "Obstetra"}
                  </p>
                  {(d.title || d.specialty) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[d.title, d.specialty].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {/* Cidade e tempo de atuação: era o que faltava para ela
                      decidir. Antes o resultado dizia só nome e especialidade —
                      insuficiente para escolher entre cinco obstetras.
                      A cidade cai no endereço do consultório quando o perfil
                      não tem cidade preenchida — é o mesmo dado, e ela só
                      quer saber se é perto. */}
                  {(d.city || d.endereco_cidade || d.years_experience) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[
                        d.city
                          ? `${d.city}${d.state ? `/${d.state}` : ""}`
                          : d.endereco_cidade || null,
                        d.years_experience ? `${d.years_experience} anos de atuação` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {/* Como ele atende e quanto custa: as duas perguntas que ela
                      faz antes de solicitar. Sem elas, "Solicitar" era um pedido
                      no escuro — e ela descobria o preço depois de aceita. */}
                  {(d.accepts_insurance || d.accepts_private || d.consultation_price_brl) && (
                    <p className="mt-1 flex flex-wrap gap-1 text-xs">
                      {d.accepts_insurance && (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5">💳 Convênio</span>
                      )}
                      {d.accepts_private && (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5">
                          💰 Particular
                          {(d.consultation_price_cents ?? d.consultation_price_brl)
                            ? ` · ${formatarDinheiro(
                                d.consultation_price_cents ?? (d.consultation_price_brl ?? 0) * 100,
                                d.consultation_currency,
                              )}`
                            : ""}
                        </span>
                      )}
                    </p>
                  )}
                  {d.endereco ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">📍 {d.endereco}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => sendRequest(d)}
                  disabled={busyId === d.id}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  {busyId === d.id ? "Enviando…" : "Solicitar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Plano de Parto ---------- */
const PAIN_RELIEF_OPTIONS = [
  "Epidural / peridural",
  "Técnicas de respiração",
  "Banho quente / banheira",
  "Massagem",
  "Óxido nitroso (gás)",
  "Sem medicação — quero tentar natural",
];

function PlanoPártoTab({ profile }: { profile: Profile | null }) {
  const DEFAULTS: BirthPlan = {
    birth_type: "",
    pain_relief: [],
    who_present: "",
    cord_cutting: "",
    skin_to_skin: true,
    breastfeeding: "",
    lighting: "",
    music: "",
    notes: "",
  };
  const [plan, setPlan] = useState<BirthPlan>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("birth_plans").select("*").maybeSingle();
      if (data) setPlan(data as BirthPlan);
      setLoading(false);
    })();
  }, []);

  async function savePlan() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      return;
    }
    const { error } = await (supabase as any)
      .from("birth_plans")
      .upsert(
        { ...plan, user_id: u.user.id, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) {
      toast.error("Não foi possível salvar o plano. Tente novamente.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleRelief(opt: string) {
    setPlan((p) => ({
      ...p,
      pain_relief: p.pain_relief.includes(opt)
        ? p.pain_relief.filter((x) => x !== opt)
        : [...p.pain_relief, opt],
    }));
  }

  if (loading)
    return <div className="py-12 text-center text-muted-foreground text-sm">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-2xl">Plano de parto</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Registre suas preferências para compartilhar com o seu médico e a equipe da maternidade. O
          plano é um ponto de partida — decisões clínicas sempre prevalecem.
        </p>
      </div>

      {/* Tipo de parto */}
      <div className="rounded-3xl card-material p-6 space-y-3">
        <p className="font-serif text-lg">Tipo de parto desejado</p>
        {[
          { value: "normal", label: "Parto normal / vaginal" },
          { value: "cesarea", label: "Cesárea" },
          { value: "sem_preferencia", label: "Sem preferência — confio na decisão médica" },
        ].map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="birth_type"
              value={opt.value}
              checked={plan.birth_type === opt.value}
              onChange={() => setPlan({ ...plan, birth_type: opt.value })}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>

      {/* Alívio da dor */}
      <div className="rounded-3xl card-material p-6 space-y-3">
        <p className="font-serif text-lg">Alívio da dor (marque os que aceitar)</p>
        {PAIN_RELIEF_OPTIONS.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={plan.pain_relief.includes(opt)}
              onChange={() => toggleRelief(opt)}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>

      {/* Presença e procedimentos */}
      <div className="rounded-3xl card-material p-6 space-y-4">
        <p className="font-serif text-lg">Presença e procedimentos</p>
        <PlanoField
          label="Quem você quer presente no parto"
          value={plan.who_present}
          onChange={(v) => setPlan({ ...plan, who_present: v })}
          placeholder="Ex.: meu parceiro, minha mãe"
        />
        <PlanoField
          label="Clampeamento do cordão umbilical"
          value={plan.cord_cutting}
          onChange={(v) => setPlan({ ...plan, cord_cutting: v })}
          placeholder="Ex.: tardio, meu parceiro quer cortar"
        />
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={plan.skin_to_skin}
            onChange={() => setPlan({ ...plan, skin_to_skin: !plan.skin_to_skin })}
            className="accent-primary"
          />
          <span className="text-sm text-foreground">
            Contato pele a pele imediato após o nascimento
          </span>
        </label>
        <PlanoField
          label="Amamentação na sala de parto"
          value={plan.breastfeeding}
          onChange={(v) => setPlan({ ...plan, breastfeeding: v })}
          placeholder="Ex.: quero tentar na primeira hora"
        />
      </div>

      {/* Ambiente */}
      <div className="rounded-3xl card-material p-6 space-y-4">
        <p className="font-serif text-lg">Ambiente</p>
        <PlanoField
          label="Iluminação"
          value={plan.lighting}
          onChange={(v) => setPlan({ ...plan, lighting: v })}
          placeholder="Ex.: luz baixa, sem refletores diretos"
        />
        <PlanoField
          label="Música / som"
          value={plan.music}
          onChange={(v) => setPlan({ ...plan, music: v })}
          placeholder="Ex.: playlist pessoal, silêncio"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Observações gerais
          </label>
          <textarea
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            rows={4}
            placeholder="Alergias, medo específico, pedidos especiais…"
            value={plan.notes}
            onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={savePlan}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {saved ? "Salvo ✓" : "Salvar plano"}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:text-primary"
        >
          Imprimir / salvar PDF
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Imprima ou tire um print para levar à maternidade. Leve também uma cópia para a consulta com
        o seu médico.
      </p>
    </div>
  );
}

function PlanoField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ---------- Apoio Emocional ---------- */
function ApoioEmocionalTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-primary/20 bg-[image:var(--gradient-warm)] p-8">
        <p className="font-serif text-2xl text-foreground">Você não está sozinha.</p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Perdas gestacionais, diagnósticos difíceis e momentos de medo fazem parte da jornada de
          muitas mulheres — e cada uma delas merece acolhimento, não silêncio.
        </p>
        <p className="mt-3 text-sm italic text-muted-foreground">
          "Cada gestação tem sua própria história. Cuidar de você é tão importante quanto cuidar do
          bebê." — {DOCTOR.name}
        </p>
      </div>

      {/* O que é normal sentir */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-xl">O que é normal sentir</p>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {[
            "Medo intenso antes de cada ultrassom após uma perda anterior",
            "Sensação de que não pode comemorar antes do bebê nascer",
            "Ansiedade e tristeza coexistindo com alegria — tudo ao mesmo tempo",
            "Raiva, culpa e vazio depois de uma perda gestacional",
            "Dificuldade de vínculo durante a gestação por medo de perder novamente",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Quando buscar ajuda */}
      <div className="rounded-3xl border border-primary/20 bg-primary/6 p-6">
        <p className="font-serif text-lg text-foreground">Quando buscar ajuda profissional</p>
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {[
            "Tristeza profunda por mais de 2 semanas que não passa",
            "Dificuldade de cuidar de si mesma ou de outras responsabilidades",
            "Pensamentos de não querer continuar a gravidez por medo",
            "Ansiedade que impede o sono ou as atividades do dia a dia",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1">•</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-primary">
          Converse com o seu médico na sua próxima consulta. Ele pode indicar acompanhamento
          psicológico especializado em gestação.
        </p>
      </div>

      {/* Redes de apoio */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-xl">Redes de apoio</p>
        <div className="mt-4 space-y-3">
          {[
            {
              name: "ALMA — Apoio em Luto Materno",
              desc: "Comunidade de apoio para mães que vivenciaram perdas gestacionais. Grupos online e presenciais.",
              url: "https://www.almaluto.com.br",
            },
            {
              name: "CVV — Centro de Valorização da Vida",
              desc: "Apoio emocional 24h — ligue 188 (gratuito) ou acesse o chat online.",
              url: "https://www.cvv.org.br",
            },
            {
              name: "FEBRASGO — Saúde Mental na Gestação",
              desc: "Informações sobre depressão perinatal e ansiedade na gestação.",
              url: "https://www.febrasgo.org.br",
            },
          ].map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <p className="font-medium text-sm text-foreground">{r.name} ↗</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Escrever no diário */}
      <div className="rounded-3xl bg-secondary/40 p-6 text-center">
        <p className="font-serif text-xl">Escreva o que sente</p>
        <p className="mt-2 text-sm text-muted-foreground">
          O diário é um espaço só seu — sem julgamentos, sem respostas certas.
        </p>
        <button
          onClick={() => onNavigate("Registros")}
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Abrir meu diário
        </button>
      </div>
    </div>
  );
}
