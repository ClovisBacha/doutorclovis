import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminData,
  getEngagementData,
  getPreConsultaForms,
  getPatientReport,
  markPreConsultaSeen,
  setQuestionAnswered,
  updateAppointmentStatus,
  confirmAppointment,
  proposeAppointmentTime,
  markAppointmentPaid,
  getDoctorWaitlist,
  sendDoctorBroadcast,
  type AdminAppointment,
  type AdminPreConsulta,
  type AdminQuestion,
  type PatientEngagement,
  type AdminWaitlistEntry,
} from "@/lib/admin.functions";
import { computeGestation } from "@/lib/gestacao";
import { juntarCrm, separarCrm, UFS } from "@/lib/crm";
import { buscarCep, digitosCep, formatarCep } from "@/lib/cep";
import { PerfilProgresso, itensDoPerfil } from "@/components/perfil-progresso";
import { CampoComOutro } from "@/components/campo-com-outro";
import { CampoFocos } from "@/components/campo-focos";
import { CampoFoto } from "@/components/campo-foto";
import { conferirMeuCrm } from "@/lib/crm-conferencia.functions";
import {
  acionamentosDaPaciente,
  listarAcionamentos,
  marcarAcionamentoAtendido,
  type AcionamentoSos,
} from "@/lib/acionamentos.functions";
import { AlertaSosMedico } from "@/components/alerta-sos-medico";
import { ProntuarioPaciente } from "@/components/prontuario-paciente";
import { RegistrarConsulta } from "@/components/registrar-consulta";
import { ExamesRecebidos } from "@/components/exames-recebidos";
import { EnviarParaPaciente } from "@/components/enviar-para-paciente";
import {
  consultasDaPaciente,
  fichaClinica,
  prontuarioDaPaciente,
  registrarDesfecho,
  type Consulta,
  type EventoClinico,
  type FichaClinica,
  type TipoDeEmissao,
} from "@/lib/clinical.functions";
import { FilaDeTrabalho, type ItemFila } from "@/components/fila-de-trabalho";
import {
  ESTILO_SINAL,
  PESO_SINAL,
  diasDeSilencio,
  sinalGlicemia,
  sinalPressao,
  sinalSilencio,
} from "@/lib/sinais-clinicos";
import { ESPECIALIDADES_MEDICO, TITULOS_MEDICO } from "@/lib/medico-opcoes";
import {
  MOEDAS,
  centavosDe,
  digitandoDinheiro,
  formatarDinheiro,
  unidadesInteirasDe,
  type MoedaChave,
} from "@/lib/dinheiro";
import { pendenciasDoMedico, type Pendencia } from "@/lib/doctor-required";
import { mensalidadeCentavos } from "@/lib/entitlements";
import {
  listMyAddresses,
  saveMyAddress,
  deleteMyAddress,
  type DoctorAddress,
} from "@/lib/doctor-addresses.functions";
import { BabyIllustration } from "@/components/baby-illustration";
import { gradientFor, periodFor } from "@/components/weather-sky";
import { fechoDoTempo, tempoPoupado } from "@/lib/tempo-poupado";
import { ymdLocal } from "@/lib/utils";
import {
  getTeleconsultasAdmin,
  createTeleconsulta,
  openTeleconsultaRoom,
  updateTeleconsultaStatus,
  saveDoctorClinicalNote,
  generateClinicalNote,
  type TeleconsultaSession,
} from "@/lib/teleconsulta.functions";
import {
  getPrivateConsultationsForDoctor,
  confirmPaymentForDoctor,
  CONSULT_TYPES as PRIVATE_CONSULT_TYPES,
  type PrivateConsultation,
} from "@/lib/consultaparticular.functions";
import {
  getBrainSettings,
  saveBrainSettings,
  listBrainEntries,
  addBrainEntry,
  updateBrainEntry,
  deleteBrainEntry,
  listUnansweredQuestions,
  answerAndTrain,
  testBrain,
  cotaDeRespostas,
  listBrainReviews,
  resolveBrainReview,
  curarLacunasDoMedico,
  embedarEntradasDoMedico,
  listBrainGaps,
  reabrirLacuna,
  resolveBrainGap,
  dismissBrainGap,
  draftGapAnswer,
  installStarterPack,
  getBrainQualityStats,
  diagnosticoDaBusca,
  diasSemRevisao,
  precisaDeRevisao,
  extractKnowledgeFromTranscript,
  evalBrainQuestion,
  listBrainConversations,
  getBrainConversation,
  getBrainScore,
  type BrainGap,
  type LacunaQueVoltou,
} from "@/lib/secondbrain.functions";
import { MAX_CAMPO_DO_MEDICO } from "@/lib/doctorthink/core";
import {
  type BrainEntry,
  type BrainSettings,
  type BrainConversation,
  type BrainChatMessage,
  type BrainScoreItem,
} from "@/lib/secondbrain.functions";
import {
  getMyDoctor,
  registerDoctor,
  updateMyDoctor,
  getMyReferrals,
  type DoctorProfile,
} from "@/lib/doctors.functions";
import {
  getMyClinic,
  sairDaClinica,
  createClinic,
  addClinicDoctor,
  removeClinicDoctor,
  type ClinicInfo,
  type ClinicMember,
} from "@/lib/clinic.functions";
import {
  listAffiliates,
  createAffiliate,
  toggleAffiliate,
  type Affiliate,
} from "@/lib/affiliates.functions";
import { getDoctorDashboard, type DoctorDashboard } from "@/lib/dashboard.functions";
import {
  startGoogleCalendarConnect,
  getGoogleCalendarStatus,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar.functions";
import { DoctorBadge } from "@/components/doctor-badge";
import {
  encerrarAcompanhamento,
  listPatientRequests,
  respondPatientRequest,
  listMyPatients,
  setPatientQuizPremium,
  setPatientFetalBpm,
  type PatientRequest,
  type LinkedPatient,
} from "@/lib/patientlink.functions";
import { listLivesAdmin, saveLive, deleteLive, type Live } from "@/lib/lives.functions";
import { BRAIN_EVAL_QUESTIONS } from "@/lib/brain-eval";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel do médico — Obstétrica" }] }),
  component: PainelPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  done: "Realizada",
  cancelled: "Cancelada",
  counter_proposed: "Aguardando paciente",
  declined: "Recusada",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  done: "bg-sky-100 text-sky-800",
  cancelled: "bg-rose-100 text-rose-700",
  counter_proposed: "bg-violet-100 text-violet-800",
  declined: "bg-rose-100 text-rose-700",
};

const PANEL_TABS = [
  "Painel 📊",
  "Calendário",
  "Agendamentos",
  "Ferramentas",
  "Perguntas",
  "Cérebro 🧠",
  "Pré-consultas",
  "Exames",
  "Teleconsultas",
  "Consultas Pagas",
  "Lives",
  "Engajamento",
  "Pacientes 👩‍🍼",
  "Clínica 🏥",
  "Meu Perfil",
] as const;
type PanelTab = (typeof PANEL_TABS)[number];

// Cada médico (inclusive o Dr. Clóvis) é um inquilino: vê só as abas escopadas
// por doctor_id no servidor — painel, agendamentos, perguntas, pré-consultas,
// teleconsultas, engajamento, cérebro, pacientes, consultas pagas, lives e
// perfil, todas recortadas ao PRÓPRIO médico. O financeiro da plataforma
// inteira e as Empresas ficam no console do dono (/admin), não aqui.
const DOCTOR_TABS: readonly PanelTab[] = [
  /* CÉREBRO PRIMEIRO, e isso é uma decisão de produto, não de layout.
     Ele era a 11ª de 14 numa fita rolável de uma linha só — ou seja, uns
     oitocentos pixels à direita num celular. O médico precisava ROLAR para
     chegar na única parte do painel que fica melhor quanto mais ele a usa.
     A fila de lacunas e a de revisão são trabalho que rende: cada resposta
     dele economiza as próximas. Escondê-las atrás de uma rolagem horizontal é
     o mesmo que pedir que ele lembre de procurar. */
  "Cérebro 🧠",
  "Painel 📊",
  "Agendamentos",
  /* CALENDÁRIO ligado — decisão do Clóvis, out/ago 2026.
     Ele estava implementado (`CalendárioSection`, com a grade do mês e o
     salto para o dia) e fora desta lista, que é a ÚNICA fonte dos botões de
     aba. Nenhum `setTab("Calendário")` existia em lugar nenhum: a tela era
     inalcançável por qualquer caminho, e `if (tab === "Empresas")` mais abaixo
     era código morto pelo mesmo motivo.
     Vem logo depois de Agendamentos de propósito: são a mesma pergunta em duas
     formas — a lista responde "o que pediram", o calendário responde "como
     está a minha semana". Separá-las na fita obrigaria a rolar entre uma e
     outra justamente quando ele está comparando as duas. */
  "Calendário",
  "Perguntas",
  /* FERRAMENTAS ligada. Ela já existia — receituário e painéis de exame, ~1.150
     linhas escritas — e nunca foi listada aqui, então nenhum botão a montava.
     Era a única tela de receituário do produto, inalcançável. */
  "Ferramentas",
  "Pré-consultas",
  /* A caixa de entrada dos exames. Fica ao lado de Pré-consultas porque é onde
     ele já procura o que a paciente mandou — e porque quatro abas deste arquivo
     estão implementadas e INALCANÇÁVEIS por não terem sido listadas aqui,
     inclusive a única tela de receituário do produto. Uma tela que existe e não
     é renderizada é pior que uma que não existe: ninguém a procura. */
  "Exames",
  "Teleconsultas",
  "Consultas Pagas",
  "Lives",
  "Engajamento",
  "Pacientes 👩‍🍼",
  "Clínica 🏥",
  "Meu Perfil",
];

/**
 * A aba em que o médico ATERRISSA — declarada, não deduzida.
 *
 * Duas coisas do painel se penduram na "tela de entrada": o interruptor de
 * push do SOS e, no app nativo, o resumo do dia. As duas estavam escritas como
 * `tab === "Painel 📊"`, o que era verdade só porque o Painel era a primeira
 * aba. Ao pôr o Cérebro na frente, as duas saíram silenciosamente da tela de
 * entrada — inclusive o interruptor de SOS, que o comentário ao lado dele
 * declara textualmente que não pode depender de o médico passear pelas abas.
 *
 * Amarrar as duas a ESTA constante faz a próxima reordenação de abas levá-las
 * junto, em vez de deixá-las para trás sem ninguém perceber.
 */
const ABA_DE_ENTRADA: PanelTab = "Cérebro 🧠";
/**
 * E onde ele aterrissa quando o Cérebro está trancado pelo plano.
 *
 * Sem isto, o médico do Free abria o painel direto num paywall — a primeira
 * coisa que ele via ao entrar no produto que já paga (ou que ainda está
 * decidindo pagar) era uma porta fechada, e não o próprio consultório.
 */
const ABA_DE_ENTRADA_SEM_IA: PanelTab = "Painel 📊";

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function PainelPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  /* O perfil do médico LOGADO. Sem ele, três telas do painel usavam o
     `doctor.config` — o arquivo fixo do dono da instalação — e um assinante
     cobrava PIX na chave do Dr. Clóvis e imprimia recibo com o CRM dele.
     Numa plataforma multi-médico isso não é um detalhe de layout: é dinheiro
     indo para a conta errada e documento assinado por quem não atendeu. */
  const [euMedico, setEuMedico] = useState<DoctorProfile | null>(null);
  /** Perguntas pendentes contadas no banco, não filtradas de uma amostra. */
  const [pendingExato, setPendingExato] = useState<number | null>(null);
  /* Está dentro do app nativo? Lido em efeito porque `ehNativo()` olha um
     global do Capacitor, que não existe no SSR. */
  const [noApp, setNoApp] = useState(false);
  useEffect(() => {
    void (async () => {
      const { ehNativo } = await import("@/lib/nativo");
      const nativo = ehNativo();
      setNoApp(nativo);
      /* `ehNativo` só resolve depois da montagem (olha um global do Capacitor,
         que não existe no SSR), então o `tab` inicial já nasceu no Cérebro.
         Corrigir aqui é o que faz o médico abrir o app no resumo. */
      if (nativo) setTab(ABA_DE_ENTRADA_SEM_IA);
    })();
  }, []);
  /** Perfil de médico existe mas está inativo: entra, com aviso, em Meu Perfil. */
  const [inativo, setInativo] = useState(false);
  /* O que o plano libera. Ficava disponível em `getMyDoctor` e não era lido:
     o Cérebro aparecia para todo mundo e, no Free, cada tentativa de treinar
     devolvia "Tente novamente" — um paywall disfarçado de bug. */
  const [podeIA, setPodeIA] = useState(true);
  /* Ambos começam liberados e só são FECHADOS por um entitlement que chegou de
     fato. Fechar por falta de resposta seria mostrar um paywall a quem paga. */
  const [podeEquipe, setPodeEquipe] = useState(true);
  const [rotuloPlano, setRotuloPlano] = useState("");

  /* A aba que abre é a do Cérebro. O painel de números diz o que ACONTECEU; o
     cérebro é onde ele MUDA o que vai acontecer. Abrir no primeiro faz o
     produto parecer um relatório; abrir no segundo faz dele uma ferramenta. */
  const [tab, setTab] = useState<PanelTab>(ABA_DE_ENTRADA);
  /* Onde ele aterrissou de fato — é o que decide onde o interruptor de SOS e o
     resumo do app aparecem. No Free o Cérebro é paywall, então a entrada é
     outra, e as duas peças têm que ir junto. */
  /* NO APP NATIVO, A ENTRADA É O PAINEL — e isto não é preferência, é a única
     forma de o resumo funcionar.
     `PainelNoApp` substitui o conteúdo da aba de entrada no celular. Se a
     entrada fosse o Cérebro, tocar em "Cérebro" não mostraria nada: a aba
     ativa seria a de entrada e o conteúdo continuaria escondido atrás do
     resumo. Aterrissando no Painel, o resumo é a tela de abrir e TODAS as abas
     — inclusive o Cérebro — ficam a um toque, inteiras. */
  const abaDeEntrada = noApp
    ? ABA_DE_ENTRADA_SEM_IA
    : podeIA
      ? ABA_DE_ENTRADA
      : ABA_DE_ENTRADA_SEM_IA;
  /* A fita de abas rola, então a aba ativa pode estar fora da tela.
  
     Isso importa porque várias trocas de aba são PROGRAMÁTICAS, não um toque do
     médico: um médico com assinatura inativa cai direto em "Meu Perfil" (a
     ÚLTIMA das 12 abas, ~1100px à direita), e os cartões do Painel levam para
     "Cérebro" e "Meu Perfil". Ele chegava numa tela cujo indicador de posição
     estava fora do campo de visão — justamente quando mais precisa se situar. */
  const fitaAbas = useRef<HTMLDivElement | null>(null);
  const refsAbas = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const el = refsAbas.current[tab];
    if (!el || !fitaAbas.current) return;
    /* `inline: "nearest"` traz a aba para dentro da fita. `block: "nearest"`
       PODE rolar a página na vertical — ele percorre todos os ancestrais
       roláveis, e aqui o documento é o mais próximo. Como as trocas
       programáticas vêm de cartões abaixo da fita, o efeito colateral é levar a
       página de volta para o topo da aba, que é para onde ele quer olhar. */
    el.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [tab]);
  // Plano Clínica: admin operando o cérebro de um médico da clínica.
  // null = o próprio cérebro (comportamento de sempre).
  const [brainAsDoctor, setBrainAsDoctor] = useState<{ id: string; name: string } | null>(null);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [preForms, setPreForms] = useState<AdminPreConsulta[]>([]);
  /* Solicitações de vínculo no nível do painel. Antes só a aba Pacientes as
     carregava, então o resumo do topo não tinha como saber que existiam. */
  const [pedidosVinculo, setPedidosVinculo] = useState<
    { id: string; patient_name: string | null; created_at: string }[]
  >([]);
  /* Acionamentos de SOS pendentes. Consultados ao abrir e a cada 60s: um SOS
     que chega enquanto ele está com o painel aberto tem que aparecer sozinho —
     esperar ele recarregar a página é esperar demais. */
  const [sosPendentes, setSosPendentes] = useState<AcionamentoSos[]>([]);
  const [sosAberto, setSosAberto] = useState<AcionamentoSos | null>(null);
  const [sosAtendendo, setSosAtendendo] = useState(false);
  /* Adiados nesta sessão: some da tela agora e volta na próxima visita. */
  const [sosAdiados, setSosAdiados] = useState<Set<string>>(new Set());

  /**
   * Quais fontes da fila falharam ao carregar.
   *
   * "☕ Nada esperando por você" é uma boa notícia, e uma boa notícia que na
   * verdade é uma falha de rede é a pior coisa que este painel pode dizer: o
   * médico fecha a tela tranquilo com uma emergência não lida do outro lado.
   */
  /* Triagens de alerta das pacientes dele. A avaliação já era calculada e
     gravada; faltava alguém do lado do médico ler. */
  /* Eventos clínicos fora de faixa — de TODAS as pacientes dele, das onze
     fontes. É o que transforma a fila de "coisas administrativas" em "coisas
     clínicas". */
  const [eventosClinicos, setEventosClinicos] = useState<EventoClinico[]>([]);
  /* Qual paciente a fila mandou abrir. Sem isto, "Ver ficha" num item de
     EMERGÊNCIA trocava de aba e largava o médico numa lista sem busca — a
     mesma queixa que o prontuário existe para resolver. */
  const [abrirPaciente, setAbrirPaciente] = useState<string | null>(null);
  const [nomesPacientes, setNomesPacientes] = useState<Record<string, string>>({});

  const [triagens, setTriagens] = useState<
    {
      id: string;
      created_at: string;
      user_id: string;
      paciente: string | null;
      level: string;
      symptoms: string[];
      systolic: number | null;
      diastolic: number | null;
    }[]
  >([]);

  const [fonteFalhou, setFonteFalhou] = useState({
    sos: false,
    vinculos: false,
    /* As cinco fontes da fila, e não duas. Com só `sos` e `vinculos`
       rastreados, uma falha em `getPreConsultaForms` deixava a banda "Para ler"
       vazia e a tela dizia "☕ Nada esperando por você" com seis pré-consultas
       não lidas — que é exatamente o bug que a trava existe para impedir. */
    consultasEPerguntas: false,
    preConsultas: false,
    triagens: false,
    eventos: false,
  });

  /* Vigia de SOS. Roda em paralelo ao resto e nunca derruba o painel: um erro
     aqui custa o aviso, não o consultório. */
  useEffect(() => {
    let vivo = true;
    async function olhar() {
      try {
        const tk = await token();
        const r = await listarAcionamentos({
          data: { accessToken: tk, apenasPendentes: true, limite: 20 },
        });
        if (!vivo) return;
        if (r.ok) {
          setSosPendentes(r.acionamentos);
          setFonteFalhou((f) => ({ ...f, sos: false }));
        } else setFonteFalhou((f) => ({ ...f, sos: true }));
      } catch {
        if (vivo) setFonteFalhou((f) => ({ ...f, sos: true }));
      }
    }
    void olhar();
    const t = setInterval(olhar, 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  /* A fila envelhece sozinha se ninguém a atualizar.
     Só o SOS tinha vigia; perguntas, pedidos de consulta e vínculos ficavam
     congelados no instante do carregamento. Um painel deixado aberto — que é
     justamente como se usa uma fila de trabalho — dizia "nada esperando" por
     horas enquanto chegava coisa. Pior: o poll de SOS trocava o array a cada
     minuto, então a tela PARECIA viva com o dado morto.

     Três minutos, e só com a aba à vista: atualizar em segundo plano gasta
     bateria e cota de banco para ninguém ver. */
  useEffect(() => {
    if (!allowed) return;
    /* `load(true)` já recarrega as solicitações de vínculo por dentro — chamar
       `loadPedidosVinculo` aqui também era uma requisição a mais por tique, num
       efeito cuja justificativa é economia de cota. */
    /* Freio de um minuto. `visibilitychange` dispara em toda troca de app — no
       iPhone, também a cada bloqueio de tela. Sem isto, quinze idas ao WhatsApp
       em cinco minutos custavam sessenta chamadas de servidor, num efeito cuja
       justificativa escrita é economizar cota. */
    let ultima = 0;
    const atualizar = () => {
      const agora = Date.now();
      if (agora - ultima < 60_000) return;
      ultima = agora;
      load(true).catch(() => {});
      loadPreForms().catch(() => {});
      loadTriagens().catch(() => {});
      loadEventosClinicos().catch(() => {});
    };
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      atualizar();
    }, 180_000);
    /* E ao VOLTAR para a aba: quem pula o tique escondido precisa de um jeito de
       se pôr em dia, senão o médico volta do WhatsApp e olha para dados de três
       minutos atrás sem saber disso. */
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  /* Abre o modal sozinho no acionamento mais recente que ele ainda não adiou.
     Um aviso de emergência que espera um clique para aparecer não é aviso. */
  useEffect(() => {
    if (sosAberto) return;
    const novo = sosPendentes.find((a) => !sosAdiados.has(a.id));
    if (novo) setSosAberto(novo);
  }, [sosPendentes, sosAdiados, sosAberto]);
  const [teleconsultas, setTeleconsultas] = useState<TeleconsultaSession[]>([]);
  const [privateConsults, setPrivateConsults] = useState<any[]>([]);
  const [engagement, setEngagement] = useState<{
    totalPatients: number;
    activeLastWeek: number;
    inactiveLastWeek: number;
    unseenPreConsultas: number;
    patients: PatientEngagement[];
    /** Até onde o servidor foi buscar atividade — a tela precisa para não
        chamar de "nunca" o que é só "fora da janela". */
    janelaAtividadeDias?: number;
    atividadeIncompleta?: boolean;
  } | null>(null);

  /**
   * @param ehRefresh Atualização periódica, e não a entrada na tela.
   *
   * A diferença não é cosmética: fora do primeiro carregamento, esta função
   * NUNCA pode rebaixar autorização. Um soluço de dois segundos no Auth do
   * Supabase faz `getAdminData` devolver `{ok:false}` sem lançar exceção — e
   * no caminho de fallback isso terminava em `setAllowed(false)`, ou seja, o
   * painel inteiro do médico virava "Área restrita — crie sua conta aqui" no
   * meio do trabalho dele, levando junto o texto que ele estava digitando e
   * qualquer modal de emergência aberto. No primeiro carregamento o bloqueio é
   * a resposta certa; a cada três minutos, para sempre, é uma armadilha.
   */
  /**
   * O QUE O PLANO LIBERA — num lugar só.
   *
   * Estava escrito duas vezes, nos dois ramos do `load` (caminho feliz e
   * fallback), e só a cópia do fallback ganhou o desvio do Free. Como o médico
   * Free ATIVO entra sempre pelo caminho feliz, o desvio nunca rodava para
   * ele: abria o painel dentro do paywall do Cérebro — a porta fechada que o
   * comentário de `ABA_DE_ENTRADA_SEM_IA` existe para impedir — e, de quebra,
   * ficava sem o interruptor de push do SOS, que só aparece na aba de entrada.
   *
   * Duas cópias de uma regra divergem. Foi assim com os dois filtros de
   * lacuna, e foi assim aqui.
   */
  function aplicarPlano(
    ent: { aiApp?: boolean; teamSeats?: unknown; label?: string } | undefined,
    ehRefresh: boolean,
  ) {
    setPodeIA(ent?.aiApp !== false);
    setPodeEquipe(!!ent?.teamSeats);
    setRotuloPlano(ent?.label ?? "");
    /* Só na entrada: arrancar o médico da aba em que ele está, a cada
       atualização de três minutos, seria pior que o problema que isto resolve. */
    if (ent?.aiApp === false && !ehRefresh) setTab(ABA_DE_ENTRADA_SEM_IA);
  }

  async function load(ehRefresh = false) {
    try {
      const tk = await token();
      const res = await getAdminData({ data: { accessToken: tk } });
      if (!res.ok && ehRefresh) {
        setFonteFalhou((f) => ({ ...f, consultasEPerguntas: true }));
        return;
      }
      if (res.ok) {
        // Conta da plataforma (ADMIN_EMAILS) NÃO é médico: seu lugar é o
        // console /admin. Só redireciona quem SERÁ admitido lá (o super-admin
        // dono); um e-mail admin secundário sem conta de médico vê o bloqueio
        // coerente em vez de um beco sem saída (redirect → /admin negado).
        if (res.isTeam) {
          if (ehRefresh) return;
          const { checkIsSuperAdmin } = await import("@/lib/platform.functions");
          const sa = await checkIsSuperAdmin({ data: { accessToken: tk } });
          if (sa.isSuperAdmin) {
            window.location.replace("/admin");
            return;
          }
          setAllowed(false);
          return;
        }
        setAllowed(true);
        setAppointments(res.appointments);
        setQuestions(res.questions);
        setPendingExato("pendingQuestions" in res ? res.pendingQuestions : null);
        setFonteFalhou((f) => ({ ...f, consultasEPerguntas: false }));
        /* Carrega o próprio perfil também no caminho felizes: é dele que saem
           a chave PIX e o CRM do recibo. Best-effort — o painel abre sem. */
        try {
          const me = await getMyDoctor({ data: { accessToken: tk } });
          if (me.ok && me.doctor) setEuMedico(me.doctor as DoctorProfile);
          if (me.ok) aplicarPlano(me.entitlements, ehRefresh);
        } catch {
          /* segue com o padrão */
        }
        /* Solicitações de vínculo, para o resumo do topo poder contá-las.
           Best-effort: uma falha aqui não pode derrubar o painel inteiro — o
           médico perde o aviso, não o consultório. */
        await loadPedidosVinculo();
        return;
      }
      // Fallback (getAdminData negou): médico assinante inativo/sem linha ativa?
      const me = await getMyDoctor({ data: { accessToken: tk } });
      if (me.ok && me.doctor) setEuMedico(me.doctor as DoctorProfile);
      /* O gate só vale para quem TEM perfil de médico.
         
         Sem esta condição, o gestor de clínica (que entra pelo resgate mais
         abaixo e não tem linha em `doctors`) recebia entitlements de plano Free
         — e era barrado justamente da Clínica e do Cérebro, as duas telas para
         as quais ele foi admitido. */
      if (me.ok && me.doctor) aplicarPlano(me.entitlements, ehRefresh);
      /* Perfil de médico INATIVO também entra — só que direto em Meu Perfil.
         
         Antes ele era recusado aqui e caía em "área restrita", vindo de um
         "esta área é da gestante": dois blocos apontando um para o outro, sem
         nenhuma tela onde resolver o problema. As abas de dados continuam
         vazias (o servidor recorta tudo por médico ativo), e é assim que deve
         ser — o que ele precisa mexer é a assinatura, que está em Meu Perfil. */
      if (me.ok && me.doctor) {
        setAllowed(true);
        if (!me.doctor.active) {
          setInativo(true);
          /* Só na entrada: arrancar o médico da aba em que ele está, de três em
             três minutos, seria pior que o problema que isto resolve. */
          if (!ehRefresh) setTab("Meu Perfil");
        }
        return;
      }
      // Dono de clínica sem conta de médico (gestor): entra para administrar
      // a clínica e operar os cérebros dos médicos dela.
      try {
        const myClinic = await getMyClinic({ data: { accessToken: tk } });
        if (myClinic.ok && myClinic.clinic) {
          setAllowed(true);
          return;
        }
      } catch {
        /* segue para o bloqueio padrão */
      }
      setAllowed(false);
    } catch {
      /* Os modos de falha COMUNS lançam — rede caiu, sessão expirou e o token
         vazio é recusado pelo validador. O ramo `!res.ok` não os cobre, então
         com a sessão morta a tela ficava congelada e a faixa "não consegui
         conferir tudo" nunca aparecia: o médico trabalhava num retrato antigo
         achando que era ao vivo, que é exatamente o que a faixa existe para
         impedir. */
      setFonteFalhou((f) => ({ ...f, consultasEPerguntas: true }));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Solicitações de vínculo pendentes.
   *
   * Extraída para poder ser chamada de novo quando a aba Pacientes responde uma
   * — antes era carregada uma única vez no `load()` e a fila de trabalho ficava
   * afirmando que a paciente ainda esperava depois de ela ter sido aceita.
   */
  async function loadPedidosVinculo() {
    try {
      const tk = await token();
      const { listPatientRequests } = await import("@/lib/patientlink.functions");
      const pr = await listPatientRequests({ data: { accessToken: tk } });
      if (pr.ok) {
        setPedidosVinculo(
          pr.requests.map((r) => ({
            id: r.id,
            patient_name: r.patient_name,
            created_at: r.created_at,
          })),
        );
        setFonteFalhou((f) => ({ ...f, vinculos: false }));
      } else setFonteFalhou((f) => ({ ...f, vinculos: true }));
    } catch {
      /* Best-effort: uma falha aqui não derruba o painel. Mas fica REGISTRADA,
         porque uma fila vazia por falha de rede é indistinguível de uma fila
         vazia de verdade — e a segunda é uma boa notícia que ninguém deveria
         receber sem ser verdade. */
      setFonteFalhou((f) => ({ ...f, vinculos: true }));
    }
  }

  async function loadEngagement() {
    const tk = await token();
    const res = await getEngagementData({ data: { accessToken: tk } });
    if (res.ok) setEngagement(res);
  }

  async function loadEventosClinicos() {
    try {
      const tk = await token();
      const { eventosQuePedemOlhar } = await import("@/lib/clinical.functions");
      const r = await eventosQuePedemOlhar({ data: { accessToken: tk, dias: 14 } });
      if (r.ok) {
        setEventosClinicos(r.eventos);
        setNomesPacientes(r.nomes);
        setFonteFalhou((f) => ({ ...f, eventos: r.incompleto }));
      } else setFonteFalhou((f) => ({ ...f, eventos: true }));
    } catch {
      setFonteFalhou((f) => ({ ...f, eventos: true }));
    }
  }

  async function loadTriagens() {
    try {
      const tk = await token();
      const { listarTriagens } = await import("@/lib/triage.functions");
      const r = await listarTriagens({ data: { accessToken: tk, apenasAlerta: true, dias: 14 } });
      if (r.ok) {
        setTriagens(r.triagens);
        setFonteFalhou((f) => ({ ...f, triagens: false }));
      } else setFonteFalhou((f) => ({ ...f, triagens: true }));
    } catch {
      setFonteFalhou((f) => ({ ...f, triagens: true }));
    }
  }

  async function loadPreForms() {
    try {
      const tk = await token();
      const res = await getPreConsultaForms({ data: { accessToken: tk } });
      if (res.ok) {
        setPreForms(res.forms);
        setFonteFalhou((f) => ({ ...f, preConsultas: false }));
      } else setFonteFalhou((f) => ({ ...f, preConsultas: true }));
    } catch {
      setFonteFalhou((f) => ({ ...f, preConsultas: true }));
    }
  }

  async function loadTeleconsultas() {
    const tk = await token();
    const res = await getTeleconsultasAdmin({ data: { accessToken: tk } });
    if (res.ok) setTeleconsultas(res.sessions);
  }

  async function loadPrivateConsults() {
    const tk = await token();
    const res = await getPrivateConsultationsForDoctor({ data: { accessToken: tk } });
    if (res.ok) setPrivateConsults(res.consultations);
  }

  useEffect(() => {
    load();
    /* Pré-consultas junto do resto, e não só ao abrir a aba.
       A fila de trabalho vive na tela inicial e lê `preForms`; enquanto essa
       lista só era carregada dentro do efeito de aba, a banda "Para ler" era
       vazia por construção na única tela onde a fila aparece — e o médico lia
       "nada esperando por você" com seis pré-consultas não lidas na caixa. É o
       mesmo bug que a fila existe para consertar, um nível abaixo. */
    loadPreForms().catch(() => {});
    loadTriagens().catch(() => {});
    loadEventosClinicos().catch(() => {});
  }, []);

  // Retorno do checkout do Stripe (assinatura do médico): o webhook ativa o
  // plano em segundos. Avisa e recarrega uma vez para refletir o novo plano.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const st = new URLSearchParams(window.location.search).get("assinatura");
    if (!st) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (st === "sucesso") {
      toast.success("Pagamento recebido! Ativando seu plano…");
      setTimeout(() => window.location.reload(), 3000);
    } else if (st === "cancelada") {
      toast("Pagamento não concluído. Você pode assinar quando quiser.");
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    if (tab === "Engajamento" && !engagement) loadEngagement();
    if (tab === "Pré-consultas") loadPreForms();
    if (tab === "Teleconsultas") {
      loadTeleconsultas();
      loadPreForms();
      // O select de pacientes da nova teleconsulta vem do engagement
      if (!engagement) loadEngagement();
    }
    if (tab === "Consultas Pagas") loadPrivateConsults();
  }, [tab, allowed]);

  /* AS TRÊS MUTAÇÕES OTIMISTAS pintam a tela antes do servidor responder — e
     ignoravam o retorno. Um `updateAppointmentStatus` recusado (o índice único
     de horário barrando double-booking, a sessão expirada) ficava mentindo até
     o F5. Com o refresh de três minutos ficou pior: o item se desfazia sozinho
     na cara do médico, sem uma palavra de explicação. Falhou, ele volta ao
     estado anterior E fica sabendo por quê. */
  /* O ROLLBACK É POR ITEM, e nunca um snapshot do array inteiro.

     Guardar `const antes = appointments` e restaurá-lo no erro descarta tudo o
     que entrou entre a captura e a falha. Dois cenários reais: o médico cancela
     B enquanto a confirmação de A está em voo, A falha, e B volta a "pendente"
     na tela apesar de o servidor ter aceitado; ou o refresh traz um pedido novo
     C nesse meio-tempo, A falha, e C SOME do painel e da fila — uma paciente
     esperando aceite desaparece por causa de outra operação que deu errado. */
  async function changeStatus(id: string, status: AdminAppointment["status"]) {
    const anterior = appointments.find((x) => x.id === id)?.status;
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    try {
      const r = await updateAppointmentStatus({
        data: { accessToken: await token(), id, status: status as never },
      });
      if (!r?.ok) throw new Error("recusado");
    } catch {
      if (anterior !== undefined)
        setAppointments((a) => a.map((x) => (x.id === id ? { ...x, status: anterior } : x)));
      toast.error("Não consegui salvar essa mudança. Tente de novo.");
    }
  }

  async function toggleAnswered(id: string, answered: boolean) {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, answered } : x)));
    try {
      const r = await setQuestionAnswered({ data: { accessToken: await token(), id, answered } });
      if (!r?.ok) throw new Error("recusado");
    } catch {
      setQuestions((q) => q.map((x) => (x.id === id ? { ...x, answered: !answered } : x)));
      toast.error("Não consegui salvar essa mudança. Tente de novo.");
    }
  }

  async function markSeen(id: string) {
    setPreForms((f) => f.map((x) => (x.id === id ? { ...x, seen_by_doctor: true } : x)));
    try {
      const r = await markPreConsultaSeen({ data: { accessToken: await token(), id } });
      if (!r?.ok) throw new Error("recusado");
    } catch {
      setPreForms((f) => f.map((x) => (x.id === id ? { ...x, seen_by_doctor: false } : x)));
      toast.error("Não consegui marcar como lida. Tente de novo.");
    }
  }

  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center text-muted-foreground">
        Carregando...
      </div>
    );

  if (!allowed)
    return (
      <section className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-serif text-3xl">Área restrita</h1>
        <p className="mt-3 text-muted-foreground">
          Este painel é exclusivo para médicos. Se você é médico(a),{" "}
          <a href="/medicos/cadastro" className="font-semibold text-primary hover:underline">
            crie sua conta aqui
          </a>{" "}
          — leva 2 minutos.
        </p>
      </section>
    );

  /* "Pedidos pendentes" conta pedido de CONSULTA. A solicitação de uma paciente
     para ser acompanhada por ele é outra coisa, mora em outra tabela e vivia só
     dentro da aba Pacientes — então o médico lia "0 pedidos pendentes" no topo
     enquanto uma paciente esperava resposta do outro lado. Um número que diz
     zero quando há alguém esperando é pior que número nenhum. */
  const pendingAppts = appointments.filter((a) => a.status === "pending").length;
  /* A contagem EXATA quando o servidor conseguiu fazê-la; senão, o cálculo por
     amostra de antes — que subconta, mas é melhor que mostrar zero e dizer que
     não há trabalho. */
  const pendingQs = pendingExato ?? questions.filter((q) => !q.answered).length;
  const unseenForms = preForms.filter((f) => !f.seen_by_doctor).length;
  const novasPacientes = pedidosVinculo.length;
  const sosNaoAtendidos = sosPendentes.length;

  /* A FILA. Montada do que o painel já carregou — nenhuma consulta a mais, e
     por construção não pode divergir das abas, porque é a mesma fonte. */
  const fila: ItemFila[] = [
    ...sosPendentes.map((a) => ({
      id: `sos-${a.id}`,
      nivel: "emergencia" as const,
      titulo: `${a.paciente ?? "Uma paciente"} acionou o SOS`,
      detalhe: a.motivo
        ? `${a.motivo}${a.address ? ` · ${a.address}` : ""}`
        : "Ligue para ela e registre o desfecho.",
      em: a.created_at,
      acao: "Abrir",
      onAcao: () => setSosAberto(a),
    })),
    /* MEDIDA FORA DE FAIXA. Antes, uma pressão de 180/120 registrada no diário
       esperava o médico abrir a ficha dela por iniciativa própria — só a
       pré-consulta promovia item. Grave entra como emergência. */
    ...eventosClinicos.map((e) => {
      const quem = nomesPacientes[e.user_id] || "Uma paciente";
      return {
        id: `ev-${e.fonte}-${e.fonte_id}`,
        nivel: e.gravidade === "grave" ? ("emergencia" as const) : ("espera" as const),
        titulo: `${quem} — ${e.notas[0] ?? "registro fora de faixa"}`,
        detalhe: [e.notas.slice(1).join(" · "), e.texto].filter(Boolean).join(" · ") || "Ver ficha",
        em: e.ocorrido_em,
        acao: "Ver ficha",
        onAcao: () => {
          setTab("Pacientes 👩‍🍼");
          setAbrirPaciente(e.user_id);
        },
      };
    }),
    /* A triagem NÃO tem item próprio aqui: ela entra pelo fluxo de eventos
       clínicos acima (`ev-triage_logs-`), que já traz a pressão junto e tem
       desfecho registrável. Ter os dois fazia o mesmo episódio aparecer duas
       vezes — e sumir de um lado sem sumir do outro, porque cada um usava um
       marcador de resolução diferente. */
    ...pedidosVinculo.map((r) => ({
      id: `vinc-${r.id}`,
      nivel: "espera" as const,
      titulo: `${r.patient_name ?? "Uma paciente"} quer ser acompanhada por você`,
      detalhe: "Ela está vendo “aguardando o médico aceitar” na tela dela.",
      em: r.created_at,
      acao: "Ver",
      onAcao: () => setTab("Pacientes 👩‍🍼"),
    })),
    ...questions
      .filter((q) => !q.answered)
      .map((q) => ({
        id: `perg-${q.id}`,
        nivel: "pergunta" as const,
        titulo: `${q.patient || "Uma paciente"} perguntou`,
        detalhe: q.question,
        em: q.created_at,
        acao: "Responder",
        onAcao: () => setTab("Perguntas"),
      })),
    /* `declined` também é bola com ele: é a paciente RECUSANDO o horário que ele
       contrapropôs — o servidor até manda e-mail dizendo "talvez queira sugerir
       outro". O item aparecia só na aba Agendamentos e morria lá. */
    ...appointments
      .filter((a) => a.status === "pending" || a.status === "declined")
      .map((a) => ({
        id: `cons-${a.id}`,
        nivel: "consulta" as const,
        titulo:
          a.status === "declined"
            ? `${a.patient_name} recusou o horário sugerido`
            : `${a.patient_name} pediu consulta`,
        detalhe: `${new Date(`${a.preferred_date}T00:00:00`).toLocaleDateString("pt-BR")} às ${
          a.preferred_time
        }${a.reason ? ` · ${a.reason}` : ""}`,
        em: a.created_at,
        acao: "Confirmar",
        onAcao: () => setTab("Agendamentos"),
      })),
    /* A pressão da pré-consulta agora ganha etiqueta clínica na aba — mas a aba
       deixou de ser a porta de entrada. Sem promover o nível aqui, uma
       pré-consulta com 175/115 entrava como "Para ler", peso 4, o ÚLTIMO de
       todos, abaixo de "Fulana pediu consulta" e sem nenhuma marca. O
       formulário desenhado para ser lido antes da consulta ficava no fim da
       fila justamente quando trazia o número que não podia esperar. */
    ...preForms
      .filter((f) => !f.seen_by_doctor)
      .map((f) => {
        const sn = sinalPressao(f.systolic, f.diastolic);
        const grave = sn?.gravidade === "grave";
        const sintomas =
          f.symptoms?.length > 0
            ? `Sintomas: ${f.symptoms.join(", ")}`
            : (f.questions ?? "Sem sintomas relatados.");
        return {
          id: `pre-${f.id}`,
          nivel: grave ? ("pergunta" as const) : ("leitura" as const),
          titulo: grave
            ? `Pré-consulta de ${f.patient_name} — ${f.systolic}/${f.diastolic}`
            : `Pré-consulta de ${f.patient_name}`,
          detalhe: sn && sn.gravidade !== "normal" ? `${sn.nota} · ${sintomas}` : sintomas,
          em: f.submitted_at,
          acao: "Ler",
          onAcao: () => setTab("Pré-consultas"),
        };
      }),
  ];

  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Painel do médico
      </p>
      <h1 className="mt-2 font-serif text-3xl md:text-4xl">Gestão do consultório</h1>

      {/* Resumo — números já recortados por médico no servidor (equipe vê a
          instalação inteira; assinante vê só os próprios). */}
      {/* O SOS vem ANTES de tudo, inclusive do resumo. Nada no painel é mais
          urgente que uma paciente que apertou o botão de emergência. */}
      {sosAberto && (
        <AlertaSosMedico
          acionamento={sosAberto}
          atendendo={sosAtendendo}
          restantes={
            sosPendentes.filter((a) => a.id !== sosAberto.id && !sosAdiados.has(a.id)).length
          }
          onAtender={async () => {
            setSosAtendendo(true);
            try {
              const r = await marcarAcionamentoAtendido({
                data: { accessToken: await token(), id: sosAberto.id },
              });
              if (!r.ok) {
                toast.error("Não consegui registrar. Tente de novo.");
                return;
              }
              setSosPendentes((ps) => ps.filter((a) => a.id !== sosAberto.id));
              /* Também entra em `sosAdiados`: o poll de 60s pode ter saído
                 ANTES deste clique e chegar depois, ressuscitando na lista o
                 acionamento que ele acabou de registrar — e o efeito de
                 auto-abrir reabriria o modal justo quando ele espera o
                 contrário. */
              setSosAdiados((s) => new Set(s).add(sosAberto.id));
              setSosAberto(null);
              toast.success("Registrado no histórico da paciente ✓");
            } catch {
              /* Sem `catch`, o botão piscava "Registrando…", voltava ao normal
                 e não dizia nada: o médico saía achando que registrou o
                 desfecho de uma emergência e não registrou. */
              toast.error("Falha de conexão — o desfecho não foi registrado.");
            } finally {
              setSosAtendendo(false);
            }
          }}
          onFechar={() => {
            // Adiar, não dispensar: volta na próxima visita ao painel.
            setSosAdiados((s) => new Set(s).add(sosAberto.id));
            setSosAberto(null);
          }}
        />
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Primeiro da fila de propósito: uma paciente esperando aceite é o
            item mais urgente do painel — ela está do outro lado vendo
            "aguardando o médico aceitar". */}
        {/* Emergência é o primeiro número porque é o único que não pode
            esperar. Antes o resumo começava por "pedidos de consulta". */}
        <Stat
          label="Emergências sem desfecho"
          value={sosNaoAtendidos}
          highlight={sosNaoAtendidos > 0}
          /* Vermelho, e não a cor da marca. Promover este número a "o único que
             não pode esperar" e pintá-lo igual a "pedidos de consulta" é
             desfazer a promoção no mesmo gesto. */
          tom={sosNaoAtendidos > 0 ? "urgente" : undefined}
        />
        <Stat label="Pacientes esperando" value={novasPacientes} highlight={novasPacientes > 0} />
        <Stat label="Pedidos de consulta" value={pendingAppts} highlight={pendingAppts > 0} />
        <Stat label="Perguntas a responder" value={pendingQs} highlight={pendingQs > 0} />
      </div>

      {/* A fila ABSORVEU as faixas soltas de SOS e de paciente esperando: elas
          existiam porque não havia lista, e duas chamadas para a mesma coisa é
          ruído. O modal de emergência continua, esse é outro assunto. */}
      <FilaDeTrabalho
        itens={fila}
        fontesComFalha={[
          ...(fonteFalhou.sos ? ["emergências"] : []),
          ...(fonteFalhou.vinculos ? ["solicitações de pacientes"] : []),
          ...(fonteFalhou.consultasEPerguntas ? ["consultas e perguntas"] : []),
          ...(fonteFalhou.preConsultas ? ["pré-consultas"] : []),
          ...(fonteFalhou.triagens ? ["alertas de sintomas"] : []),
          ...(fonteFalhou.eventos ? ["registros clínicos"] : []),
        ]}
      />

      {/* Tabs — todo médico é inquilino, recortado por doctor_id.

          Rola na horizontal em vez de quebrar linha. Com `flex-wrap`, as 12 abas
          num celular de 360px viravam ~5 linhas: perto de 200px de tela só para
          navegar, empurrando o conteúdo para baixo do dobra. E pior, a
          `border-b` do container só encosta na ÚLTIMA linha, então o sublinhado
          de aba ativa (`-mb-px` + `border-b-2`) flutuava no meio do bloco quando
          a aba selecionada caía numa linha de cima — o indicador apontava para o
          nada. Uma fita rolável resolve as duas coisas: uma linha só, com o
          sublinhado sempre em cima da borda. `snap` para a aba parar alinhada. */}
      <div
        ref={fitaAbas}
        /* Sem `-mb-px` nos filhos. `overflow-x: auto` faz o `overflow-y`
           computar para `auto` também (regra do CSS: `visible` ao lado de um
           valor não-`visible` vira `auto`), então a caixa recorta no padding box
           e comia 1px da `border-b-2` da aba ativa. Tirar a margem negativa
           basta — o `pb-px` que eu tinha posto junto só abria uma folga de 1px
           entre o sublinhado e a linha cinza, sem cobrir nada. */
        /* `role="tablist"`: são quinze botões numa fita rolável, e sem
           semântica de aba o leitor de tela os lê como quinze botões soltos,
           sem anunciar qual está ativo — a informação mais importante da fita. */
        role="tablist"
        aria-label="Seções do painel"
        className="mt-8 flex snap-x gap-2 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DOCTOR_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            ref={(el) => {
              refsAbas.current[t] = el;
            }}
            onClick={() => setTab(t)}
            className={`shrink-0 snap-start whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {t}
            {/* Mesmo contador da aba Perguntas: numa fita de 12 abas, o número
                é o que faz a aba certa se anunciar sem ele precisar rolar. */}
            {t === "Pacientes 👩‍🍼" && novasPacientes > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {novasPacientes}
              </span>
            )}
            {t === "Perguntas" && pendingQs > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {pendingQs}
              </span>
            )}
            {t === "Pré-consultas" && unseenForms > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-white">
                {unseenForms}
              </span>
            )}
            {t === "Teleconsultas" &&
              teleconsultas.filter((s) => s.status === "sala_aberta").length > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-xs font-bold text-white">
                  {teleconsultas.filter((s) => s.status === "sala_aberta").length}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* Conta inativa: ele entra, mas precisa saber por que as listas estão
          vazias — senão conclui que o painel está quebrado. */}
      {inativo && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-500/10">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            Sua conta de médico está inativa
          </p>
          <p className="mt-1 text-[13px] leading-snug text-amber-900/85 dark:text-amber-200/85">
            Enquanto estiver assim, as pacientes não encontram você na busca e as listas do painel
            ficam vazias. Ative a assinatura em Meu Perfil, abaixo.
          </p>
        </div>
      )}

      {/* No APP, o médico entra por um resumo em vez do painel inteiro: catorze
          abas desenhadas para tela de computador não encolhem para 390px, e
          receituário digitado no celular entre duas consultas é receita
          errada. Nada some — as abas continuam logo abaixo. */}
      {noApp && tab === abaDeEntrada && (
        <div className="mt-6">
          <PainelNoApp
            nomeDoMedico={euMedico?.display_name ?? null}
            resumo={{
              sosAbertos: sosNaoAtendidos,
              perguntasPendentes: pendingQs,
              agendamentosPendentes: pendingAppts,
              preConsultasNovas: unseenForms,
              salasAbertas: teleconsultas.filter((s) => s.status === "sala_aberta").length,
              proxima: null,
            }}
            onIr={(aba) => setTab(aba as PanelTab)}
          />
        </div>
      )}

      {/* Os avisos ficam na ABA DE ENTRADA, no APP E NO COMPUTADOR — cada
          aparelho se inscreve separado, e pôr o interruptor só no celular
          apenas mudaria o defeito de lugar: ele continuaria sem receber SOS
          na máquina onde passa o dia. Não vai para "Meu Perfil" porque o SOS
          não pode depender de ele ter passeado pelas abas até achar.

          Estava escrito `tab === "Painel 📊"`, que era a aba de entrada até o
          Cérebro passar para a frente. A regra é "onde ele aterrissa", não
          "aquela aba ali" — agora está amarrada à constante que decide isso. */}
      {tab === abaDeEntrada && (
        <div className="mt-6">
          <NotificacoesDoMedico />
        </div>
      )}

      {/* ─── NO CELULAR, O RESUMO É A TELA — não um cabeçalho dela ─────────
          `PainelNoApp` existe porque catorze abas desenhadas para tela de
          computador não encolhem para 390px. Mas o conteúdo da aba continuava
          renderizando LOGO ABAIXO dele: o médico abria o app e recebia o
          resumo do dia mais os doze cards do Cérebro, que é a tela mais pesada
          do produto. O resumo virou cabeçalho do despejo que ele existe para
          evitar.
          Nada some: as abas estão logo acima, e tocar em qualquer uma sai do
          resumo e mostra a aba inteira — que é o "faz tudo que faz no PC"
          continuar valendo, só que a pedido. */}
      <div className={noApp && tab === abaDeEntrada ? "hidden" : "mt-8"}>
        {tab === "Painel 📊" && (
          <DashboardSection
            tokenFn={token}
            onNavigate={setTab}
            medico={euMedico}
            rotuloPlano={rotuloPlano}
          />
        )}
        {tab === "Calendário" && (
          <CalendárioSection appointments={appointments} onNavigate={setTab} />
        )}
        {tab === "Agendamentos" && (
          <div className="space-y-6">
            <AppointmentsSection
              appointments={appointments}
              onChangeStatus={changeStatus}
              onRefresh={load}
              medico={euMedico}
            />
            <WaitlistSection />
            <BroadcastSection />
          </div>
        )}
        {tab === "Perguntas" && (
          <QuestionsSection
            questions={questions}
            onToggle={toggleAnswered}
            onRespondeu={() => load(true).catch(() => {})}
          />
        )}
        {tab === "Cérebro 🧠" && !podeIA && (
          <TrancadoCard
            titulo="O Segundo Cérebro precisa de um plano com IA"
            plano={rotuloPlano}
            texto="É aqui que a IA aprende a responder como você: as respostas que você aprova passam a ser o que a paciente lê no app. No plano Free a IA fica desligada, então nada do que você treinar aqui seria usado."
            onIrParaPlanos={() => setTab("Meu Perfil")}
          />
        )}
        {tab === "Cérebro 🧠" && podeIA && (
          <CerebroSection
            tokenFn={token}
            asDoctor={brainAsDoctor}
            onExitAsDoctor={() => setBrainAsDoctor(null)}
            /* SÓ NO PRÓPRIO CONSULTÓRIO. Operando o cérebro de um médico da
               clínica (`brainAsDoctor`), a lista mostra as pacientes DELE e a
               aba Pacientes carrega as MINHAS — o clique nunca acharia
               nenhuma, e falharia calado. Sem callback, a linha não finge ser
               clicável. */
            onIrParaPlanos={() => setTab("Meu Perfil")}
            onAbrirPaciente={
              brainAsDoctor
                ? undefined
                : (id) => {
                    setTab("Pacientes 👩‍🍼");
                    setAbrirPaciente(id);
                  }
            }
            onTrained={(id) =>
              setQuestions((q) => q.map((x) => (x.id === id ? { ...x, answered: true } : x)))
            }
          />
        )}
        {tab === "Clínica 🏥" && !podeEquipe && (
          <TrancadoCard
            titulo="A Clínica é do plano Pro Equipe"
            plano={rotuloPlano}
            texto="Com ela você adiciona outros médicos, cada um com as próprias pacientes e o próprio cérebro, e opera todos de um lugar só. No seu plano atual a criação de clínica não está liberada."
            onIrParaPlanos={() => setTab("Meu Perfil")}
          />
        )}
        {tab === "Clínica 🏥" && podeEquipe && (
          <ClinicaSection
            tokenFn={token}
            onOperateBrain={(d) => {
              setBrainAsDoctor(d);
              setTab("Cérebro 🧠");
            }}
          />
        )}
        {tab === "Pacientes 👩‍🍼" && (
          <PacientesSection
            tokenFn={token}
            onVinculoRespondido={loadPedidosVinculo}
            abrirPacienteId={abrirPaciente}
            onAbriu={() => setAbrirPaciente(null)}
            onDesfechoRegistrado={(fonte, fonteId) =>
              setEventosClinicos((es) =>
                es.map((e) =>
                  e.fonte === fonte && e.fonte_id === fonteId
                    ? { ...e, tratado_em: new Date().toISOString() }
                    : e,
                ),
              )
            }
          />
        )}
        {tab === "Lives" && <LivesSection tokenFn={token} />}
        {tab === "Meu Perfil" && (
          <>
            {/* ─── A PORTA DE SAÍDA DA CLÍNICA ─────────────────────────────
                Um admin de clínica adiciona qualquer médico só com o e-mail —
                sem convite, sem aceite — e a partir daí opera o Segundo Cérebro
                dele e lê as CONVERSAS das pacientes dele com a IA.
                `sairDaClinica` existia, escrevia `clinic_role: null` numa
                coluna NOT NULL (ou seja, falhava sempre) e não era chamada por
                tela nenhuma. A saída fica em Meu Perfil, e não na aba Clínica:
                a aba Clínica é do plano Pro Equipe, e o médico ANEXADO pode não
                ter esse plano — ele veria um cartão de "não liberado" em vez da
                porta. */}
            <SairDaClinicaCard tokenFn={token} />
            <MeuPerfilSection tokenFn={token} onIrParaPacientes={() => setTab("Pacientes 👩‍🍼")} />
          </>
        )}
        {tab === "Exames" && <ExamesRecebidos tokenFn={token} />}
        {tab === "Pré-consultas" && (
          <PreConsultasSection forms={preForms} onMarkSeen={markSeen} tokenFn={token} />
        )}
        {tab === "Ferramentas" && <FerramentasSection />}
        {tab === "Teleconsultas" && (
          <TeleconsultasSection
            sessions={teleconsultas}
            preForms={preForms}
            onRefresh={loadTeleconsultas}
            tokenFn={token}
            patients={engagement?.patients ?? []}
          />
        )}
        {tab === "Engajamento" && (
          <EngagementSection engagement={engagement} onRefresh={loadEngagement} tokenFn={token} />
        )}
        {tab === "Consultas Pagas" && (
          <ConsultasPagasSection
            consultations={privateConsults}
            onRefresh={loadPrivateConsults}
            tokenFn={token}
          />
        )}
      </div>
    </section>
  );
}

/* ---------- Painel (dashboard do médico) ---------- */
// Saudação conforme o horário — abre o painel com um tom pessoal.
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// "há X dias/horas" a partir de um ISO — usado nas perguntas recentes.
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

// Tempo economizado pelo cérebro: cada resposta ≈ 3 min do médico.

const STAGE_META: {
  key: keyof DoctorDashboard["patients"]["stages"];
  label: string;
  bar: string;
  dot: string;
}[] = [
  { key: "t1", label: "1º trimestre", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  { key: "t2", label: "2º trimestre", bar: "bg-sky-400", dot: "bg-sky-400" },
  { key: "t3", label: "3º trimestre", bar: "bg-violet-400", dot: "bg-violet-400" },
  { key: "postparto", label: "Pós-parto", bar: "bg-rose-400", dot: "bg-rose-400" },
  {
    key: "semData",
    label: "Sem data",
    bar: "bg-muted-foreground/40",
    dot: "bg-muted-foreground/40",
  },
];

function DashboardSection({
  tokenFn,
  onNavigate,
  medico,
  rotuloPlano,
}: {
  tokenFn: () => Promise<string>;
  onNavigate: (tab: PanelTab) => void;
  /** Perfil dele — só para a prova de valor saber o preço da consulta e o plano. */
  medico?: DoctorProfile | null;
  /** Rótulo do plano já resolvido (entitlements) — a coluna crua não conhece o
      assento de clínica. */
  rotuloPlano?: string | null;
}) {
  const [data, setData] = useState<DoctorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await getDoctorDashboard({ data: { accessToken: await tokenFn() } });
      if (res.ok && res.dashboard) setData(res.dashboard);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data)
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
        <p className="text-4xl">📊</p>
        <p className="mt-3 font-medium">Não foi possível carregar o painel</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
        <button
          onClick={load}
          className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          ↺ Tentar de novo
        </button>
      </div>
    );

  return (
    <DashboardView
      data={data}
      onNavigate={onNavigate}
      onRefresh={load}
      medico={medico}
      rotuloPlano={rotuloPlano}
    />
  );
}

/**
 * "Valor gerado este mês": reenquadra os números do painel como retorno (tempo
 * economizado, dúvidas resolvidas pela IA) — o médico lembra POR QUE paga. Se
 * ainda não há uso, vira um empurrão para treinar a IA.
 */
function ValorGeradoBanner({
  aiHits,
  minutosPorResposta,
  answered,
  activePatients,
  onNavigate,
  precoConsultaCentavos,
  moedaDoMedico,
  mensalidadeDoPlanoCentavos,
  plano,
  rotuloPlano,
}: {
  aiHits: number;
  /** Minutos que UMA resposta dele custaria — ver `src/lib/tempo-poupado.ts`. */
  minutosPorResposta: number;
  answered: number;
  activePatients: number;
  onNavigate: (tab: PanelTab) => void;
  /** O que ELE cobra por consulta — o tempo dele vale o que ele cobra. */
  precoConsultaCentavos?: number | null;
  moedaDoMedico?: string | null;
  /** O que ele paga por mês. Sem isso não há comparação honesta a fazer.
      Nome diferente da função homônima de `entitlements` de propósito: dentro
      deste componente o identificador curto virava um número, e a função ficava
      inalcançável a três linhas de distância. */
  mensalidadeDoPlanoCentavos: number;
  /**
   * Plano cru. Mensalidade zero cobre três casos diferentes — teste, grátis e
   * clínica ("sob consulta", contrato PAGO). Dizer "você ainda não paga nada"
   * para uma clínica seria falso justamente com o cliente de maior ticket.
   */
  plano?: string | null;
  /** Rótulo do plano JÁ resolvido pelo servidor (entitlements). */
  rotuloPlano?: string | null;
}) {
  /* `plano` é a coluna CRUA de `doctors`. O assento de clínica não é gravado
     nela — quem entra por uma clínica ativa fica com `trial` no banco e só vira
     "Clínica" na resolução em memória do servidor. Por isso a frase "você ainda
     não paga nada" exige as DUAS coisas: coluna de teste E rótulo resolvido de
     teste. Sem o rótulo, a gente não afirma. */
  const p = (plano ?? "").trim().toLowerCase();
  const r = (rotuloPlano ?? "").trim().toLowerCase();
  /* `""` FORA do conjunto permissivo: é o estado inicial do `useState` E o
     fallback quando `getMyDoctor` falha. Aceitá-lo transformava "não sei" em
     "é teste" — o card afirmava "você não paga nada" para quem paga, no exato
     momento em que a informação não tinha chegado. Desconhecido não afirma. */
  const emTeste = (p === "trial" || p === "free") && (r === "trial" || r === "free");
  /* TEMPO ECONOMIZADO É SÓ O QUE A IA FEZ NO LUGAR DELE.

     Antes esta conta era `aiHits + answered`, e `answered` é gravado no
     instante em que o MÉDICO digita a resposta (`secondbrain.functions.ts`).
     Ou seja: a tela pegava hora-médico GASTA, chamava de "seu tempo
     economizado" e ainda convertia em dinheiro para justificar a mensalidade.
     Um médico com a IA desligada, respondendo tudo sozinho, via a plataforma
     levar crédito pelo trabalho dele. As perguntas que ele resolveu continuam
     no painel — como produção dele, que é o que são. */
  const assists = aiHits;

  /* A porta do CTA é governada pelo que o card AFIRMA — produção da
     plataforma —, não pelo trabalho dele. Com `answered` na condição, quem
     respondeu 5 perguntas na mão e nunca usou a IA perdia o empurrão "treine a
     IA" e ganhava uma vitrine anunciando dois zeros embaixo de "Valor gerado":
     prova de valor negativa, para quem acabou de pagar. */
  if (assists === 0 && activePatients === 0) {
    return (
      <div className="fade-slide-up rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <p className="font-serif text-lg">💚 Comece a gerar valor</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Treine o seu <strong>Segundo Cérebro</strong> e convide suas pacientes — assim que a IA
          começar a responder, este espaço mostra quanto tempo você economizou.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate("Cérebro 🧠")}
            className="press rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Treinar minha IA
          </button>
          <button
            onClick={() => onNavigate("Meu Perfil")}
            className="rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-secondary"
          >
            Convidar pacientes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-slide-up rounded-3xl border border-primary/20 bg-primary/5 p-5">
      <p className="font-serif text-lg">💚 Valor gerado este mês</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ValueTile big={aiHits} label="dúvidas respondidas pela sua IA" />
        <ValueTile big={answered} label="perguntas que você respondeu" />
        <ValueTile
          big={tempoPoupado(assists, minutosPorResposta)}
          label="do seu tempo de volta (estimativa)"
        />
        <ValueTile big={activePatients} label="pacientes ativas nos últimos 7 dias" />
      </div>

      {/* A frase direta, e ela é o ponto do card.

          Os quatro azulejos são números; número o médico lê e esquece. O que
          fica é a frase — e ela precisa dizer QUAL tempo voltou, porque é aí
          que mora a proposta inteira: não é hora de consultório (essa é a renda
          dele), é a mensagem respondida às onze da noite, no domingo, no meio
          do jantar. Tempo que ele dava de graça e não contava.

          Só aparece a partir de uma hora: "você ganhou 12 minutos de volta" não
          é uma frase, é uma piada. */}
      {assists * minutosPorResposta >= 60 && (
        <p className="mt-3.5 text-[13.5px] leading-relaxed text-foreground">
          Você ganhou{" "}
          <strong className="text-primary">{tempoPoupado(assists, minutosPorResposta)}</strong> de
          volta este mês — o tempo que você não passou respondendo mensagem fora do consultório.{" "}
          {fechoDoTempo(new Date().getMonth())}
        </p>
      )}

      {/* A conta fechada, em dinheiro.

          "A IA respondeu 3 horas por você" é bonito e some da cabeça na hora de
          renovar. Em dinheiro, fica. Mas uma tela que argumenta cobrança não
          pode esconder a premissa: as duas conversões — 3 min por atendimento e
          40 min por consulta — vão escritas embaixo, porque quem lê "3h" e
          "R$ 2.025" com consulta de R$ 450 faz a conta de cabeça, chega em
          R$ 1.350 e conclui, com razão, que a tela está inflando. */}
      {(() => {
        const minutos = assists * minutosPorResposta;
        /* `(horas * 60) / 40` era ida e volta: a conta real é minutos/40, ou
           seja uma consulta a cada ~13 atendimentos da IA. */
        const equivalente = minutos / 40;
        /* A mensalidade da tabela é em REAIS. Se ele cobra a consulta em dólar
           ou euro, comparar os dois números é comparar grandezas diferentes —
           e a frase sairia dizendo uma coisa falsa com ar de conta fechada.
           Sem câmbio confiável, o certo é não afirmar nada. E "não sei a moeda"
           (`null`, `""`) entra aqui como não-sei, não como real. */
        const mesmaMoeda = moedaDoMedico === "BRL";
        const rodape = (
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Estimativa: cada resposta da IA poupa ~{minutosPorResposta.toString().replace(".", ",")}{" "}
            min seus — o tempo de escrever uma resposta do tamanho das suas. A sua hora é calculada
            pela consulta (~40 min), só como régua de valor.
          </p>
        );

        if (mesmaMoeda && precoConsultaCentavos && precoConsultaCentavos > 0) {
          const valorCentavos = Math.round(equivalente * precoConsultaCentavos);
          const texto = formatarDinheiro(valorCentavos, moedaDoMedico);
          /* `formatarDinheiro` devolve "" para valor não finito. Uma frase de
             cobrança com o número faltando é pior que frase nenhuma. */
          const ganha =
            mensalidadeDoPlanoCentavos > 0 && valorCentavos > mensalidadeDoPlanoCentavos;
          if (texto && valorCentavos > 0) {
            return (
              <>
                {/* A mensalidade aparece SEMPRE que é conhecida, favoreça ou
                    não. Mostrar a comparação só quando ela ganha é escolher a
                    dedo — e um card que argumenta cobrança e é estruturalmente
                    incapaz de sair desfavorável não é prova de valor, é
                    propaganda. Quando não favorece, o próprio número vira o
                    argumento honesto: falta uso, e o painel diz onde. */}
                <p
                  className={`mt-3 rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${
                    ganha
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {/* NÃO se diz mais "o equivalente a X em consultas suas".
                      Consulta é a RENDA dele: a frase antiga afirmava que a IA
                      poupou consultas, ou seja, que ele faturou menos. O que a
                      IA poupa é o tempo NÃO PAGO — a mensagem das onze da
                      noite. O dinheiro continua aqui porque hora some da cabeça
                      na hora de renovar, mas ele agora VALORA o tempo dele, em
                      vez de sugerir agenda vazia. */}
                  Esse tempo, valendo o que vale a sua hora, dá <strong>{texto}</strong>
                  {mensalidadeDoPlanoCentavos > 0
                    ? ganha
                      ? " — mais que a mensalidade do seu plano."
                      : ` — sua mensalidade é ${formatarDinheiro(mensalidadeDoPlanoCentavos, "BRL")}.`
                    : emTeste
                      ? " — e você ainda não paga nada por isso."
                      : "."}
                </p>
                {rodape}
              </>
            );
          }
        }
        return rodape;
      })()}
    </div>
  );
}

function ValueTile({ big, label }: { big: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-card/70 p-3">
      <p className="font-serif text-2xl font-bold text-primary">{big}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/** Parte visual do dashboard — recebe os dados prontos (permite preview isolado). */
export function DashboardView({
  data,
  onNavigate,
  onRefresh,
  medico,
  rotuloPlano,
}: {
  data: DoctorDashboard;
  onNavigate: (tab: PanelTab) => void;
  onRefresh?: () => void;
  medico?: DoctorProfile | null;
  rotuloPlano?: string | null;
}) {
  const { patients, questions, brain, appointments, engagement } = data;
  const stageTotal = STAGE_META.reduce((s, m) => s + patients.stages[m.key], 0);

  return (
    <div className="space-y-8">
      {/* 1. Cabeçalho */}
      <div className="fade-slide-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Painel do médico
          </p>
          <h2 className="mt-1 font-serif text-2xl md:text-3xl">
            {greeting()} 👋 Aqui está o seu consultório hoje
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Atualizado{" "}
            {new Date(data.generatedAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ↺ Atualizar
        </button>
      </div>

      {/* Valor gerado no mês — reenquadra os números como ROI (retenção). */}
      <ValorGeradoBanner
        aiHits={brain.hitsThisMonth}
        minutosPorResposta={brain.minutosPorResposta}
        answered={questions.answeredThisMonth}
        activePatients={patients.active7d}
        onNavigate={onNavigate}
        precoConsultaCentavos={
          medico?.consultation_price_cents ?? (medico?.consultation_price_brl ?? 0) * 100
        }
        moedaDoMedico={medico?.consultation_currency}
        mensalidadeDoPlanoCentavos={mensalidadeCentavos(medico?.plan ?? "")}
        plano={medico?.plan}
        rotuloPlano={rotuloPlano}
      />

      {/* 2. Cards de destaque */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeroCard
          icon="👩‍🍼"
          value={patients.total}
          label="Pacientes conectadas"
          hint={
            patients.newThisMonth > 0
              ? `+${patients.newThisMonth} novas neste mês`
              : "Acompanhando você no app"
          }
          tone="primary"
          delay="stagger-1"
        />
        <HeroCard
          icon="⚡"
          value={patients.active7d}
          label="Ativas esta semana"
          hint={`${patients.inactive7d} sem abrir há 7 dias`}
          tone="emerald"
          delay="stagger-2"
        />
        <HeroCard
          icon="💬"
          value={questions.pending}
          label="Perguntas a responder"
          hint={
            questions.pending > 0 ? "Responda e treine o cérebro" : "Tudo respondido, parabéns!"
          }
          tone={questions.pending > 0 ? "amber" : "muted"}
          delay="stagger-3"
        />
        <HeroCard
          icon="📅"
          value={appointments.confirmedUpcoming}
          label="Consultas confirmadas"
          hint={
            appointments.pending > 0
              ? `${appointments.pending} pedido(s) a confirmar`
              : "Nenhum pedido pendente"
          }
          tone="sky"
          delay="stagger-4"
        />
      </div>

      {/* 3. Valor do plano — Segundo Cérebro */}
      <BrainValueCard brain={brain} onNavigate={onNavigate} />

      {/* 4. Gestações por fase */}
      <div className="fade-slide-up rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg">Sua carteira por fase da gestação</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Onde estão as {patients.total} pacientes conectadas agora.
            </p>
          </div>
        </div>
        {stageTotal === 0 ? (
          <p className="mt-5 rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
            Ainda não há pacientes com dados de gestação. Assim que elas preencherem o perfil, a
            distribuição por trimestre aparece aqui.
          </p>
        ) : (
          <>
            {/* Barra empilhada proporcional */}
            <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-secondary/60">
              {STAGE_META.map((m) => {
                const n = patients.stages[m.key];
                if (n === 0) return null;
                return (
                  <div
                    key={m.key}
                    className={`${m.bar} h-full transition-all`}
                    style={{ width: `${(n / stageTotal) * 100}%` }}
                    title={`${m.label}: ${n}`}
                  />
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
              {STAGE_META.map((m) => {
                const n = patients.stages[m.key];
                const pct = stageTotal ? Math.round((n / stageTotal) * 100) : 0;
                return (
                  <div key={m.key} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none">
                        {n}
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          {pct}%
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{m.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. FAQ inteligente + 6. Perguntas recentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FaqIntelligenceCard themes={questions.topThemes} onNavigate={onNavigate} />
        <RecentQuestionsCard
          items={questions.recentPending}
          pending={questions.pending}
          onNavigate={onNavigate}
        />
      </div>

      {/* 7. Risco de abandono + 8. Próxima consulta */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChurnRiskCard patients={engagement.churnRisk} />
        <NextAppointmentCard appointments={appointments} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

const HERO_TONE: Record<string, { wrap: string; icon: string; value: string }> = {
  primary: { wrap: "border-primary/25 bg-primary/5", icon: "bg-primary/10", value: "text-primary" },
  emerald: {
    wrap: "border-emerald-300/40 bg-emerald-50/60",
    icon: "bg-emerald-100",
    value: "text-emerald-600",
  },
  amber: {
    wrap: "border-amber-300/50 bg-amber-50/60",
    icon: "bg-amber-100",
    value: "text-amber-600",
  },
  sky: { wrap: "border-sky-300/40 bg-sky-50/60", icon: "bg-sky-100", value: "text-sky-600" },
  muted: { wrap: "border-border bg-card", icon: "bg-secondary", value: "text-foreground" },
};

function HeroCard({
  icon,
  value,
  label,
  hint,
  tone,
  delay,
}: {
  icon: string;
  value: number;
  label: string;
  hint: string;
  tone: keyof typeof HERO_TONE | string;
  delay: string;
}) {
  const t = HERO_TONE[tone] ?? HERO_TONE.muted;
  return (
    <div className={`fade-slide-up ${delay} card-3d rounded-3xl border p-5 ${t.wrap}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xl ${t.icon}`}>
        {icon}
      </div>
      <p className={`mt-3 font-serif text-4xl leading-none ${t.value}`}>{value}</p>
      <p className="mt-2 text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{hint}</p>
    </div>
  );
}

function BrainValueCard({
  brain,
  onNavigate,
}: {
  brain: DoctorDashboard["brain"];
  onNavigate: (tab: PanelTab) => void;
}) {
  const active = brain.hitsThisMonth > 0;
  return (
    <div className="fade-slide-up shine relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/70 p-6 text-primary-foreground shadow-[var(--shadow-card)] md:p-8">
      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
            🧠 O valor do seu plano
          </p>
          {active ? (
            <>
              <p className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
                Seu Segundo Cérebro respondeu{" "}
                <span className="underline decoration-white/40 underline-offset-4">
                  {brain.hitsThisMonth}
                </span>{" "}
                {brain.hitsThisMonth === 1 ? "vez" : "vezes"} este mês
              </p>
              <p className="mt-3 text-sm opacity-90">
                Isso são cerca de{" "}
                <strong>{tempoPoupado(brain.hitsThisMonth, brain.minutosPorResposta)}</strong> que
                você não precisou gastar digitando respostas — o cérebro atendeu por você, no seu
                tom, a qualquer hora.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
                Seu Segundo Cérebro está pronto para trabalhar por você
              </p>
              <p className="mt-3 text-sm opacity-90">
                Ainda não houve atendimentos automáticos neste mês. Quanto mais respostas você
                treinar, mais o cérebro responde no seu lugar — economizando seu tempo dia após dia.
              </p>
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate("Cérebro 🧠")}
              className="rounded-full bg-white/95 px-5 py-2 text-sm font-semibold text-primary transition-transform hover:scale-[1.03]"
            >
              {active ? "Treinar mais respostas →" : "Treinar meu cérebro →"}
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-medium">
              {brain.enabledApp ? "✅ App" : "⭕ App"} ·{" "}
              {brain.enabledWhatsapp ? "✅ WhatsApp" : "⭕ WhatsApp"}
            </span>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-1">
          <div className="rounded-2xl bg-white/15 px-5 py-3 text-center backdrop-blur-sm">
            <p className="font-serif text-3xl leading-none">{brain.approved}</p>
            <p className="mt-1 text-[11px] opacity-90">respostas que já sabe</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-5 py-3 text-center backdrop-blur-sm">
            <p className="font-serif text-3xl leading-none">{brain.entries}</p>
            <p className="mt-1 text-[11px] opacity-90">itens na base</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqIntelligenceCard({
  themes,
  onNavigate,
}: {
  themes: DoctorDashboard["questions"]["topThemes"];
  onNavigate: (tab: PanelTab) => void;
}) {
  const max = themes.length ? Math.max(...themes.map((t) => t.count)) : 1;
  return (
    <div className="fade-slide-up flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-lg">FAQ inteligente 🔎</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Os temas que suas pacientes mais perguntam — treine o cérebro neles e responda uma vez só.
      </p>
      {themes.length === 0 ? (
        <p className="mt-5 flex-1 rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
          Ainda não há perguntas suficientes para identificar temas. Eles aparecem aqui conforme as
          pacientes usam o chat e enviam dúvidas.
        </p>
      ) : (
        <div className="mt-4 flex flex-1 flex-wrap content-start gap-2">
          {themes.map((t) => {
            // Fonte cresce com a frequência — nuvem de temas simples.
            const scale = 0.85 + (t.count / max) * 0.5;
            return (
              <span
                key={t.theme}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 font-medium text-primary"
                style={{ fontSize: `${scale}rem` }}
              >
                {t.theme}
                <span className="rounded-full bg-primary/15 px-1.5 text-[11px]">{t.count}</span>
              </span>
            );
          })}
        </div>
      )}
      <button
        onClick={() => onNavigate("Cérebro 🧠")}
        className="mt-5 self-start rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
      >
        Treinar o cérebro nesses temas →
      </button>
    </div>
  );
}

function RecentQuestionsCard({
  items,
  pending,
  onNavigate,
}: {
  items: DoctorDashboard["questions"]["recentPending"];
  pending: number;
  onNavigate: (tab: PanelTab) => void;
}) {
  return (
    <div className="fade-slide-up flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-serif text-lg">Perguntas aguardando você</p>
        {pending > 0 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
            {pending}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 flex-1 rounded-2xl bg-emerald-50/60 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
          🎉 Nenhuma pergunta pendente. Suas pacientes estão em dia!
        </p>
      ) : (
        <ul className="mt-4 flex-1 space-y-2.5">
          {items.map((q) => (
            <li key={q.id} className="rounded-2xl border border-border/70 bg-secondary/30 p-3">
              <p className="line-clamp-2 text-sm text-foreground">{q.question}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(q.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => onNavigate("Cérebro 🧠")}
        className="mt-5 self-start rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Responder e treinar →
      </button>
    </div>
  );
}

function ChurnRiskCard({ patients }: { patients: DoctorDashboard["engagement"]["churnRisk"] }) {
  return (
    <div className="fade-slide-up rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-lg">Oportunidade de reengajar 💛</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Pacientes que já usaram o app mas sumiram há mais de 10 dias — uma mensagem sua faz
        diferença.
      </p>
      {patients.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-emerald-50/60 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
          ✨ Ninguém em risco de abandono. Suas pacientes estão engajadas!
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {patients.map((p, i) => (
            <li
              key={`${p.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 dark:bg-amber-500/10 dark:border-amber-500/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                  {p.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <p className="truncate text-sm font-medium">{p.name}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-amber-700">
                há {p.lastActiveDays} dias sem abrir
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NextAppointmentCard({
  appointments,
  onNavigate,
}: {
  appointments: DoctorDashboard["appointments"];
  onNavigate: (tab: PanelTab) => void;
}) {
  return (
    <div className="fade-slide-up flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-lg">Agenda 📅</p>
      {appointments.next ? (
        <div className="mt-4 rounded-2xl border border-sky-200/70 bg-sky-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            Próxima consulta confirmada
          </p>
          <p className="mt-1.5 font-serif text-xl">{appointments.next.patientName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{appointments.next.dateLabel}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
          Nenhuma consulta confirmada nos próximos dias.
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">
            {appointments.pending} pedido{appointments.pending === 1 ? "" : "s"} a confirmar
          </p>
          <p className="text-[11px] text-muted-foreground">
            {appointments.confirmedUpcoming} confirmada(s) no total
          </p>
        </div>
        {appointments.pending > 0 && (
          <button
            onClick={() => onNavigate("Agendamentos")}
            className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Ver pedidos →
          </button>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-secondary" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-secondary" />
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-3xl bg-secondary" />
      <div className="h-40 animate-pulse rounded-3xl bg-secondary" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-52 animate-pulse rounded-3xl bg-secondary" />
        <div className="h-52 animate-pulse rounded-3xl bg-secondary" />
      </div>
    </div>
  );
}

/* ---------- Aviso por push (envio manual) ---------- */
function BroadcastSection() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (title.trim().length < 2 || body.trim().length < 2) {
      toast("Escreva um título e uma mensagem.");
      return;
    }
    if (!confirm("Enviar este aviso por notificação para as suas pacientes?")) return;
    setSending(true);
    try {
      const res = await sendDoctorBroadcast({
        data: { accessToken: await token(), title: title.trim(), body: body.trim() },
      });
      if (res.ok) {
        toast.success(
          res.sent > 0
            ? `Aviso enviado para ${res.sent} paciente${res.sent > 1 ? "s" : ""} 🔔`
            : "Nenhuma paciente com notificações ativas ainda.",
        );
        setTitle("");
        setBody("");
      } else {
        toast.error(res.error || "Não consegui enviar agora.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="font-serif text-lg">Enviar aviso às pacientes</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Manda uma notificação (push) para as suas pacientes que ativaram os lembretes. Ótimo para
        recados como mudança de horário do consultório.
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Título (ex.: Aviso do consultório)"
          className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Mensagem (ex.: Amanhã atenderemos a partir das 10h.)"
          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{body.length}/300</span>
          <button
            onClick={send}
            disabled={sending}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Enviando…" : "Enviar aviso"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Agendamentos ---------- */
/* ---------- Fila de espera (visão do médico) ---------- */
function WaitlistSection() {
  const [entries, setEntries] = useState<AdminWaitlistEntry[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDoctorWaitlist({ data: { accessToken: await token() } });
        setEntries(res.ok ? res.entries : []);
      } catch {
        setEntries([]);
      }
    })();
  }, []);

  if (entries === null) return <div className="h-24 animate-pulse rounded-3xl bg-secondary" />;

  // Agrupa por semana (segunda-feira).
  const byWeek = new Map<string, AdminWaitlistEntry[]>();
  for (const e of entries) {
    const arr = byWeek.get(e.week_start) ?? [];
    arr.push(e);
    byWeek.set(e.week_start, arr);
  }
  const weeks = [...byWeek.keys()].sort();

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-serif text-lg">Fila de espera</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quem está esperando vaga, por semana. Ao cancelar uma consulta, a 1ª da fila é avisada
            automaticamente.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
          Ninguém na fila de espera no momento.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {weeks.map((wk) => (
            <div key={wk}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Semana de {new Date(wk + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
              <div className="space-y-2">
                {byWeek.get(wk)!.map((e, i) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-background p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {i + 1}º · {e.patient_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.patient_phone || e.patient_email}
                      </p>
                    </div>
                    {e.status === "offered" ? (
                      <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                        🗓️ vaga oferecida
                        {e.offer_deadline
                          ? ` · até ${new Date(e.offer_deadline).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                        ⏳ aguardando
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppointmentsSection({
  appointments,
  onChangeStatus,
  onRefresh,
  medico,
}: {
  appointments: AdminAppointment[];
  onChangeStatus: (id: string, s: AdminAppointment["status"]) => void;
  onRefresh: () => void;
  /** O médico LOGADO. `null` só para a conta de equipe da plataforma. */
  medico?: DoctorProfile | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmForm, setConfirmForm] = useState<{
    date: string;
    time: string;
    price: string;
    notes: string;
  }>({ date: "", time: "", price: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [receiptAppt, setReceiptAppt] = useState<AdminAppointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function saveConfirmation(a: AdminAppointment) {
    if (!confirmForm.date || !confirmForm.time) return;
    setSaving(true);
    // Server function com service role: o UPDATE direto do navegador dependia
    // de claim is_admin no JWT (RLS) e falhava silenciosamente sem ele.
    const res = await confirmAppointment({
      data: {
        accessToken: await token(),
        id: a.id,
        confirmedDate: confirmForm.date,
        confirmedTime: confirmForm.time,
        priceBrl: confirmForm.price ? Math.round(Number(confirmForm.price) * 100) : null,
        internalNotes: confirmForm.notes || null,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível confirmar a consulta. Tente novamente.");
      return;
    }
    onChangeStatus(a.id, "confirmed");
    setExpandedId(null);
    onRefresh();
  }

  // Contraproposta: usa a mesma data/hora do formulário, mas em vez de confirmar
  // SUGERE à paciente (ela aprova/recusa no app).
  async function saveProposal(a: AdminAppointment) {
    if (!confirmForm.date || !confirmForm.time) return;
    setSaving(true);
    const res = await proposeAppointmentTime({
      data: {
        accessToken: await token(),
        id: a.id,
        proposedDate: confirmForm.date,
        proposedTime: confirmForm.time,
        priceBrl: confirmForm.price ? Math.round(Number(confirmForm.price) * 100) : null,
        internalNotes: confirmForm.notes || null,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível sugerir o horário. Tente novamente.");
      return;
    }
    toast.success("Horário sugerido! A paciente vai aprovar no app.");
    setExpandedId(null);
    onRefresh(); // recarrega do servidor (status vira "Aguardando paciente")
  }

  async function markPaid(id: string) {
    const res = await markAppointmentPaid({ data: { accessToken: await token(), id } });
    if (!res.ok) {
      toast.error(res.error || "Não foi possível marcar como pago. Tente novamente.");
      return;
    }
    onRefresh();
  }

  /* A chave é a DELE. Sem a linha abaixo, o assinante mandava a paciente
     pagar na chave do dono da instalação — o erro mais caro que este painel
     tinha. Só cai no `doctor.config` quando não há perfil de médico, que é o
     caso da conta de equipe da plataforma. */
  const pixKey = medico?.pix_key?.trim() || DOCTOR.pixKey;
  const pixName = medico?.display_name?.trim() || DOCTOR.pixName;

  function pixWhatsApp(a: AdminAppointment) {
    if (!medico?.pix_key?.trim()) {
      toast.error("Cadastre a sua chave PIX em Meu Perfil antes de cobrar.");
      return;
    }
    const price = (a as any).price_brl ? ((a as any).price_brl / 100).toFixed(2) : "___";
    const msg = encodeURIComponent(
      `Olá, ${a.patient_name}! Para confirmar sua consulta no dia ${(a as any).confirmed_date ? new Date((a as any).confirmed_date + "T00:00:00").toLocaleDateString("pt-BR") : new Date(a.preferred_date + "T00:00:00").toLocaleDateString("pt-BR")} às ${(a as any).confirmed_time ?? a.preferred_time}, envie R$ ${price} via PIX para a chave: ${pixKey} (${pixName}). Após o pagamento, envie o comprovante aqui. Obrigado!`,
    );
    window.open(`https://wa.me/55${a.patient_phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  }

  function exportIcal() {
    const confirmed = appointments.filter(
      (a) => (a as any).confirmed_date && a.status === "confirmed",
    );
    if (!confirmed.length) {
      alert("Nenhuma consulta confirmada com data definida.");
      return;
    }
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Obstetrica//Agenda//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      // VTIMEZONE é obrigatório quando DTSTART usa TZID (RFC 5545).
      // Brasil não tem horário de verão desde 2019: offset fixo -03.
      "BEGIN:VTIMEZONE",
      "TZID:America/Sao_Paulo",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:-0300",
      "TZOFFSETTO:-0300",
      "TZNAME:-03",
      "END:STANDARD",
      "END:VTIMEZONE",
    ];
    const dtstamp = `${ymdLocal().replace(/-/g, "")}T000000Z`;
    for (const a of confirmed) {
      const d = (a as any).confirmed_date as string;
      const t = ((a as any).confirmed_time ?? "08:00") as string;
      const start = `${d.replace(/-/g, "")}T${t.replace(":", "")}00`;
      // Fim = início + 1h via aritmética de Date: vira o dia corretamente
      // (23:00 → 00:00 do dia seguinte, sem gerar hora 24 inválida).
      const [h, m] = t.split(":").map(Number);
      const endDate = new Date(`${d}T00:00:00`);
      endDate.setHours(h + 1, m);
      const end = `${ymdLocal(endDate).replace(/-/g, "")}T${String(endDate.getHours()).padStart(2, "0")}${String(endDate.getMinutes()).padStart(2, "0")}00`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${a.id}@doutorclovis`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=America/Sao_Paulo:${start}`,
        `DTEND;TZID=America/Sao_Paulo:${end}`,
        `SUMMARY:Consulta — ${a.patient_name}`,
        `DESCRIPTION:Motivo: ${a.reason}. Tel: ${a.patient_phone}`,
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agenda-obstetrica.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered =
    filterStatus === "all" ? appointments : appointments.filter((a) => a.status === filterStatus);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "confirmed", "done", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"}`}
            >
              {s === "all"
                ? `Todos (${appointments.length})`
                : `${STATUS_LABEL[s]} (${appointments.filter((a) => a.status === s).length})`}
            </button>
          ))}
        </div>
        <button
          onClick={exportIcal}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          ⬇ Exportar .ics
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido nesta categoria.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const ext = a as any;
            const isExpanded = expandedId === a.id;
            const payStatus = ext.payment_status ?? "sem_cobranca";
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{a.patient_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.patient_phone} · {a.patient_email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {payStatus === "pago" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        💰 Pago
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[a.status] ?? ""}`}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-0.5 text-sm">
                  <p>
                    <strong>Preferência:</strong>{" "}
                    {new Date(a.preferred_date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                    {a.preferred_time}
                  </p>
                  {ext.confirmed_date && (
                    <p className="text-emerald-700 font-medium">
                      ✓ Confirmado para:{" "}
                      {new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                      {ext.confirmed_time}
                      {ext.price_brl && ` · R$ ${(ext.price_brl / 100).toFixed(2)}`}
                    </p>
                  )}
                  <p>
                    <strong>Motivo:</strong> {a.reason}
                  </p>
                  {a.notes && (
                    <p className="text-muted-foreground">
                      <strong>Obs.:</strong> {a.notes}
                    </p>
                  )}
                  {ext.internal_notes && (
                    <p className="text-primary text-xs">📝 Nota interna: {ext.internal_notes}</p>
                  )}
                </div>

                {/* Confirm with time panel */}
                {isExpanded && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium mb-3">Confirmar com horário definitivo</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Data confirmada *</label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.date}
                          onChange={(e) => setConfirmForm({ ...confirmForm, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Horário confirmado *
                        </label>
                        <input
                          type="time"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.time}
                          onChange={(e) => setConfirmForm({ ...confirmForm, time: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Valor (R$) — opcional
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 350"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.price}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, price: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Nota interna</label>
                        <input
                          placeholder="Apenas visível para você"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.notes}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Confirme direto no horário pedido, ou <strong>sugira outro</strong> — a
                      paciente aprova no app.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => saveConfirmation(a)}
                        disabled={saving || !confirmForm.date || !confirmForm.time}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                      >
                        {saving ? "Salvando…" : "✓ Confirmar consulta"}
                      </button>
                      <button
                        onClick={() => saveProposal(a)}
                        disabled={saving || !confirmForm.date || !confirmForm.time}
                        className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        🗓️ Sugerir este horário
                      </button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {(a.status === "pending" || a.status === "counter_proposed") && (
                    <button
                      onClick={() => {
                        setExpandedId(isExpanded ? null : a.id);
                        setConfirmForm({
                          date: a.preferred_date,
                          time: a.preferred_time,
                          price: "",
                          notes: "",
                        });
                      }}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      {a.status === "counter_proposed"
                        ? "Confirmar / sugerir horário"
                        : "Confirmar com horário"}
                    </button>
                  )}
                  {(["done", "cancelled", "pending"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onChangeStatus(a.id, s)}
                      disabled={a.status === s}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-40"
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                  {/* WhatsApp deixa de ser a ação PRINCIPAL desta linha.
                  
                      Ele estava com `bg-primary` — mais destaque que confirmar
                      ou remarcar —, e o efeito era o produto empurrar a conversa
                      clínica para fora de si mesmo: o que é dito ali não vira
                      prontuário, não alimenta a IA, não fica com a paciente, e
                      some quando ela troca de aparelho.
                      
                      O atalho continua, porque combinar horário por WhatsApp é
                      legítimo e tirá-lo sem alternativa só mandaria o médico
                      para o celular pessoal. O que muda é o peso visual: agora
                      ele compete de igual para igual com o resto, e o caminho
                      clínico (receita, orientação, resposta) tem tela própria. */}
                  <a
                    href={`https://wa.me/55${a.patient_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Combinar horário. Orientação clínica tem registro no painel."
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
                  >
                    WhatsApp
                  </a>
                  {ext.price_brl && payStatus !== "pago" && (
                    <button
                      onClick={() => pixWhatsApp(a)}
                      className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30"
                    >
                      💰 Cobrar via PIX
                    </button>
                  )}
                  {ext.price_brl && payStatus !== "pago" && (
                    <button
                      onClick={() => markPaid(a.id)}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30"
                    >
                      ✓ Marcar pago
                    </button>
                  )}
                  {a.status === "confirmed" && (
                    <button
                      onClick={() => setReceiptAppt(a)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
                    >
                      🖨 Recibo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Modal */}
      {receiptAppt && (
        <ReceiptModal appt={receiptAppt} medico={medico} onClose={() => setReceiptAppt(null)} />
      )}
    </div>
  );
}

/* ---------- Perguntas ---------- */
function QuestionsSection({
  questions,
  onToggle,
  onRespondeu,
}: {
  questions: AdminQuestion[];
  onToggle: (id: string, answered: boolean) => void;
  onRespondeu?: () => void;
}) {
  const pendentes = questions.filter((q) => !q.answered);
  const respondidas = questions.filter((q) => q.answered);
  return (
    <div>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>
      ) : (
        <div className="space-y-3">
          {/* PENDENTES PRIMEIRO. A lista vinha misturada por data, então a
              pergunta de ontem sem resposta ficava embaixo de dez já
              respondidas — e o que ele veio fazer aqui é responder. */}
          {pendentes.map((q) => (
            <CartaoDePergunta key={q.id} q={q} onToggle={onToggle} onRespondeu={onRespondeu} />
          ))}
          {respondidas.length > 0 && pendentes.length > 0 && (
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Já respondidas
            </p>
          )}
          {respondidas.map((q) => (
            <CartaoDePergunta key={q.id} q={q} onToggle={onToggle} onRespondeu={onRespondeu} />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoDePergunta({
  q,
  onToggle,
  onRespondeu,
}: {
  q: AdminQuestion;
  onToggle: (id: string, answered: boolean) => void;
  onRespondeu?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  /* Treinar vem LIGADO. É a alavanca: cada resposta que também vira
     conhecimento é uma pergunta que a IA responde sozinha da próxima vez, para
     outra paciente, às três da manhã. */
  /* DESLIGADO por padrão, e exigindo a pergunta reescrita.
  
     Ligado, a pergunta CRUA dela virava conhecimento reutilizável — com o nome
     do marido, o diagnóstico que ela não contou, o remédio que toma escondido —
     e entrava no contexto do assistente de OUTRA paciente com um clique. */
  const [treinar, setTreinar] = useState(false);
  const [perguntaGeral, setPerguntaGeral] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function responder() {
    if (texto.trim().length < 2) {
      toast.error("Escreva a resposta.");
      return;
    }
    setEnviando(true);
    try {
      const { responderPergunta } = await import("@/lib/clinical.functions");
      const r = await responderPergunta({
        data: {
          accessToken: await token(),
          perguntaId: q.id,
          resposta: texto.trim(),
          treinar,
          perguntaGeneralizada: treinar ? perguntaGeral.trim() || undefined : undefined,
        },
      });
      if (!r.ok) {
        toast.error(
          "motivo" in r && r.motivo === "banco_desatualizado"
            ? "Falta aplicar o SQL de resposta do médico (APLICAR_MEDICO, seção 15)."
            : "Não consegui enviar. Tente de novo.",
        );
        return;
      }
      if ("jaEstava" in r && r.jaEstava) {
        toast("Esta pergunta já tinha sido respondida.");
      } else {
        toast.success(
          "treinou" in r && r.treinou
            ? "Respondida, avisada e a IA aprendeu ✓"
            : "Respondida e avisada ✓",
        );
      }
      setAberto(false);
      setTexto("");
      onRespondeu?.();
    } catch {
      toast.error("Não consegui enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{q.patient}</p>
          <p className="mt-1 text-foreground">{q.question}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!q.answered && (
            <button
              onClick={() => setAberto((v) => !v)}
              className="press rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Responder
            </button>
          )}
          <button
            onClick={() => onToggle(q.id, !q.answered)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              q.answered
                ? "bg-emerald-100 text-emerald-800"
                : "border border-border text-muted-foreground hover:text-primary"
            }`}
          >
            {q.answered ? "Respondida ✓" : "Só marcar"}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="mt-3 border-t border-border pt-3">
          <textarea
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ela recebe no app, com aviso."
            className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <label className="mt-2 flex items-start gap-2 text-[12px] leading-snug text-muted-foreground">
            <input
              type="checkbox"
              checked={treinar}
              onChange={(e) => {
                setTreinar(e.target.checked);
                if (e.target.checked && !perguntaGeral) setPerguntaGeral("");
              }}
              className="mt-0.5"
            />
            <span>
              Ensinar isto à minha IA — ela responde sozinha da próxima vez, para outra paciente.
            </span>
          </label>
          {treinar && (
            <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50/60 p-2.5">
              <p className="text-[11px] leading-snug text-amber-900">
                A pergunta dela vai <strong>como você reescrever aqui</strong>. O texto original
                pode ter nome, diagnóstico ou detalhe que ela não quer que apareça na conversa de
                outra paciente — e o cérebro é lido por todas.
              </p>
              <input
                value={perguntaGeral}
                onChange={(e) => setPerguntaGeral(e.target.value)}
                placeholder="Ex.: posso tomar dipirona na gravidez?"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              {perguntaGeral.trim().length > 0 && perguntaGeral.trim().length < 8 && (
                <p className="mt-1 text-[11px] text-amber-900">
                  Muito curta — sem isso a IA não aprende (a resposta chega a ela de qualquer
                  jeito).
                </p>
              )}
            </div>
          )}
          <button
            onClick={responder}
            disabled={enviando}
            className="press mt-2 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar resposta"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Pré-consultas (Feature 11 + 47) ---------- */
function PreConsultasSection({
  forms,
  onMarkSeen,
  tokenFn,
}: {
  forms: AdminPreConsulta[];
  onMarkSeen: (id: string) => void;
  tokenFn: () => Promise<string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  /* DE QUEM é o relatório que está em `reportData`.
  
     Sem isto havia vazamento de dado clínico entre pacientes: `reportData` é um
     estado só, e `loadReport` só escrevia nele em caso de SUCESSO. Abrir a
     paciente B, depois abrir a paciente A cujo relatório falha, deixava o card
     da A renderizando o relatório da B — peso, pressão, perguntas pendentes,
     com o nome da B dentro do card da A. E a falha é alcançável: a lista de
     pré-consultas é escopada por `preconsulta_forms.doctor_id` (gravado no
     envio), enquanto o relatório é autorizado por `patient_profiles.doctor_id`;
     uma paciente que trocou de médico continua listada e o relatório é negado.
  
     Agora o relatório só é exibido quando pertence à paciente aberta. */
  const [reportOwner, setReportOwner] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportErro, setReportErro] = useState(false);

  async function loadReport(userId: string) {
    setReportLoading(true);
    setReportErro(false);
    // Limpa antes de buscar: nada de mostrar o anterior enquanto carrega.
    setReportData(null);
    setReportOwner(null);
    try {
      const tk = await tokenFn();
      const res = await getPatientReport({ data: { accessToken: tk, userId } });
      if (res.ok) {
        setReportData(res);
        setReportOwner(userId);
      } else {
        setReportErro(true);
      }
    } catch {
      setReportErro(true);
    } finally {
      setReportLoading(false);
    }
  }

  function printReport() {
    window.print();
  }

  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma pré-consulta recebida ainda. As pacientes podem preenchê-la em{" "}
        <strong>Minha Conta → Pré-consulta</strong>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {forms.map((f) => (
        <div
          key={f.id}
          className={`rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] ${!f.seen_by_doctor ? "border-primary/40" : "border-border"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{f.patient_name}</p>
                {!f.seen_by_doctor && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    Nova
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Semana {f.weeks_at_submission ?? "—"} ·{" "}
                {new Date(f.submitted_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setExpandedId((id) => (id === f.id ? null : f.id));
                  if (!f.seen_by_doctor) onMarkSeen(f.id);
                  if (expandedId !== f.id) loadReport(f.user_id);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                {expandedId === f.id ? "Fechar" : "Ver relatório"}
              </button>
            </div>
          </div>

          {/* Quick summary chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {f.symptoms.map((s) => (
              <span key={s} className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                {s}
              </span>
            ))}
            {f.current_weight && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                ⚖️ {f.current_weight} kg
              </span>
            )}
            {f.systolic != null &&
              f.diastolic != null &&
              /* `!= null` e não truthy: com `&&`, um "0/80" sumia da tela por
                 inteiro em vez de aparecer marcado como implausível. */
              (() => {
                const sn = sinalPressao(f.systolic, f.diastolic);
                return (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sn && sn.gravidade !== "normal"
                        ? ESTILO_SINAL[sn.gravidade]
                        : "bg-secondary text-muted-foreground"
                    }`}
                    title={sn?.nota || undefined}
                  >
                    💓 {f.systolic}/{f.diastolic}
                    {sn && sn.gravidade !== "normal" ? ` · ${sn.nota}` : ""}
                  </span>
                );
              })()}
          </div>

          {f.questions && (
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>Perguntas:</strong> {f.questions}
            </p>
          )}

          {/* Expanded report */}
          {expandedId === f.id && (
            <div className="mt-5 border-t border-border pt-5">
              {reportLoading ? (
                <p className="text-sm text-muted-foreground">Carregando relatório...</p>
              ) : reportErro ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Não foi possível carregar o histórico desta paciente. Ela pode ter trocado de
                  médico — os dados dela deixam de ser seus quando isso acontece.
                </p>
              ) : reportData && reportOwner === f.user_id ? (
                <PatientReportView data={reportData} formData={f} onPrint={printReport} />
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PatientReportView({
  data,
  formData,
  onPrint,
}: {
  data: any;
  formData: AdminPreConsulta;
  onPrint: () => void;
}) {
  const { profile, healthLogs, journals, kicks, pendingQuestions } = data;
  const gest = profile
    ? computeGestation({
        lmp: profile.lmp_date,
        referenceDate: profile.reference_date,
        referenceWeeks: profile.reference_weeks,
        referenceDays: profile.reference_days,
      })
    : null;

  const completeSessions = (kicks ?? []).filter((k: any) => k.kick_count >= 10).length;

  return (
    <div className="space-y-5 print:p-8">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl">Relatório Pré-consulta</h3>
        <button
          onClick={onPrint}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary print:hidden"
        >
          🖨️ Imprimir
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <InfoBox label="Paciente" value={profile?.display_name ?? "—"} />
        <InfoBox label="Bebê" value={profile?.baby_name ?? "—"} />
        <InfoBox
          label="IG na pré-consulta"
          value={
            formData.weeks_at_submission
              ? `${formData.weeks_at_submission} semanas`
              : gest
                ? `${gest.weeks}s${gest.days}d`
                : "—"
          }
        />
      </div>

      {/* Vitals */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Sinais Vitais (pré-consulta)
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* O fallback procura a linha em que AQUELA medida existe, não a
              linha mais recente: quem anotou só a pressão hoje deixava o peso
              em "—", que o médico lê como "nunca se pesou". */}
          <InfoBox
            label="Peso"
            value={(() => {
              if (formData.current_weight) return `${formData.current_weight} kg`;
              const u = ultimaMedida(healthLogs, "weight_kg");
              return u.valor ? `${u.valor} kg (reg. ${diaCurto(u.quando) || "anterior"})` : "—";
            })()}
          />
          <InfoBox
            label="Pressão arterial"
            value={(() => {
              if (formData.systolic && formData.diastolic)
                return `${formData.systolic}/${formData.diastolic} mmHg`;
              const l = (healthLogs ?? []).find(
                (x: any) => x?.systolic != null && x?.diastolic != null,
              );
              if (!l) return "—";
              return `${l.systolic}/${l.diastolic} mmHg (reg. ${
                diaCurto(l.log_date ?? l.created_at ?? null) || "anterior"
              })`;
            })()}
          />
          <InfoBox label="Estado emocional" value={formData.emotional_state ?? "—"} />
        </div>
      </div>

      {/* Symptoms */}
      {formData.symptoms.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Sintomas relatados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {formData.symptoms.map((s: string) => (
              <span key={s} className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Medications */}
      {formData.medications && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1">
            Medicamentos em uso
          </p>
          <p className="text-sm">{formData.medications}</p>
        </div>
      )}

      {/* Questions */}
      {(formData.questions || pendingQuestions?.length > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Perguntas para o médico
          </p>
          {formData.questions && (
            <p className="text-sm mb-2 rounded-lg bg-primary/5 p-3">{formData.questions}</p>
          )}
          {pendingQuestions?.map((q: any) => (
            <p key={q.id} className="text-sm mb-1 text-muted-foreground">
              • {q.question}
            </p>
          ))}
        </div>
      )}

      {/* Activity summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Atividade nas últimas 2 semanas
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBox label="Registros de saúde" value={String(healthLogs?.length ?? 0)} />
          <InfoBox label="Entradas no diário" value={String(journals?.length ?? 0)} />
          <InfoBox label="Sessões de chutes completas" value={String(completeSessions)} />
        </div>
      </div>

      {formData.other_notes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1">
            Observações adicionais
          </p>
          <p className="text-sm">{formData.other_notes}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Engajamento (Feature 46) ---------- */
function EngagementSection({
  engagement,
  onRefresh,
  tokenFn,
}: {
  engagement: {
    totalPatients: number;
    activeLastWeek: number;
    inactiveLastWeek: number;
    unseenPreConsultas: number;
    patients: PatientEngagement[];
    janelaAtividadeDias?: number;
    atividadeIncompleta?: boolean;
  } | null;
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [reportData, setReportData] = useState<Record<string, any>>({});
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadPatientReport(userId: string) {
    if (reportData[userId]) {
      setExpandedId((id) => (id === userId ? null : userId));
      return;
    }
    setLoadingReport(userId);
    const tk = await tokenFn();
    const res = await getPatientReport({ data: { accessToken: tk, userId } });
    if (res.ok) setReportData((d) => ({ ...d, [userId]: res }));
    setLoadingReport(null);
    setExpandedId(userId);
  }

  if (!engagement) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-3">Clique para carregar o dashboard.</p>
        <button
          onClick={onRefresh}
          className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground"
        >
          Carregar dados
        </button>
      </div>
    );
  }

  const { totalPatients, activeLastWeek, inactiveLastWeek, unseenPreConsultas, patients } =
    engagement;
  const inactivePatients = patients.filter((p) => !p.isActive);
  const activePatients = patients.filter((p) => p.isActive);

  /* QUEM SUMIU, em ordem de silêncio.

     "Inativa nos últimos 7 dias" é ruído: quase toda gestante passa uma semana
     sem abrir o app e está ótima. O que merece a atenção dele é o silêncio
     LONGO — duas semanas, um mês — e é isso que esta lista separa.

     Silêncio não é sinal clínico, é sinal de engajamento: ela pode estar bem e
     sem paciência para o app. Por isso o texto diz "sem registro" e nunca "sem
     acompanhamento". */
  const janela = engagement?.janelaAtividadeDias ?? 45;
  const sumidas = patients
    /* Recém-chegada não é sumida. Sem esta linha, a paciente que se cadastrou
       ontem e ainda não abriu nada entrava na lista no dia seguinte — e o
       médico ligava perguntando por que ela "parou de usar". Duas semanas é o
       mesmo corte da primeira faixa de silêncio: antes disso, não há silêncio
       para observar. */
    .filter((p) => !p.createdAt || diasDeSilencio(p.createdAt, janela) >= 14)
    .map((p) => ({
      p,
      s: sinalSilencio(p.lastActivityAt, janela),
      dias: diasDeSilencio(p.lastActivityAt, janela),
    }))
    .filter((x) => x.s && x.s.gravidade !== "normal")
    /* Desempate por tempo de silêncio. Sem ele, a ordem dentro de cada cor era
       a ordem que o Postgres devolvesse (o `select` de perfis não tem
       `ORDER BY`) — então QUAIS oito pacientes ele via podia mudar a cada
       "Atualizar", sem nada ter mudado nos dados. */
    .sort((a, b) => PESO_SINAL[a.s!.gravidade] - PESO_SINAL[b.s!.gravidade] || b.dias - a.dias);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Últimos 7 dias</p>
        <button onClick={onRefresh} className="text-xs text-primary hover:underline">
          ↺ Atualizar
        </button>
      </div>

      {/* A lista de sumidas vem ANTES dos números: o número diz que existem,
          a lista diz quem são — e é a lista que vira ação. */}
      {engagement?.atividadeIncompleta && (
        /* Sem este aviso, uma falha de leitura no banco se apresentaria como
           uma lista de pacientes abandonadas — e o médico ligaria para gente
           que está registrando tudo direitinho. */
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3">
          <p className="text-[13px] font-semibold text-amber-900">
            📡 Não consegui ler todos os registros
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-amber-900/80">
            A lista abaixo pode incluir pacientes que na verdade estão ativas. Atualize antes de
            ligar para alguém.
          </p>
        </div>
      )}

      {sumidas.length > 0 && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            {/* O texto dizia "há mais de 2 semanas" enquanto a lista contava
                gente com 8 dias de silêncio — o corte anunciado tem que ser o
                corte aplicado, senão um número errado aqui vira desconfiança em
                tudo o mais que a tela diz. */}
            {sumidas.length === 1
              ? "1 paciente sem registro há duas semanas ou mais"
              : `${sumidas.length} pacientes sem registro há duas semanas ou mais`}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-amber-900/80 dark:text-amber-100/80">
            Pode ser só falta de paciência com o app — mas numa gestação de alto risco vale um
            telefonema antes da próxima consulta.
          </p>
          <ul className="mt-3 space-y-1.5">
            {sumidas.slice(0, 8).map(({ p, s }) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate font-medium text-foreground">
                  {p.display_name ?? "Paciente"}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    ESTILO_SINAL[s!.gravidade]
                  }`}
                >
                  {s!.nota}
                </span>
              </li>
            ))}
            {sumidas.length > 8 && (
              <li className="text-[12px] text-muted-foreground">+ {sumidas.length - 8} outras</li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total de pacientes" value={totalPatients} />
        <Stat label="Ativas (7 dias)" value={activeLastWeek} highlight={activeLastWeek > 0} />
        <Stat label="Inativas (7 dias)" value={inactiveLastWeek} highlight={inactiveLastWeek > 0} />
        <Stat
          label="Pré-consultas novas"
          value={unseenPreConsultas}
          highlight={unseenPreConsultas > 0}
        />
      </div>

      {/* Inactive patients - need attention */}
      {inactivePatients.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">
            Sem atividade há mais de 7 dias ({inactivePatients.length})
          </p>
          <div className="space-y-2">
            {inactivePatients.map((p) => {
              const gest = computeGestation({
                lmp: p.lmp_date,
                referenceDate: p.reference_date,
                referenceWeeks: p.reference_weeks,
                referenceDays: p.reference_days,
              });
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:bg-amber-500/10 dark:border-amber-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.display_name ?? "Paciente sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {gest
                          ? `${gest.weeks}s${gest.days}d de gestação`
                          : "Sem dados gestacionais"}
                        {p.lastActivityAt &&
                          ` · Último acesso: ${new Date(p.lastActivityAt).toLocaleDateString("pt-BR")}`}
                        {!p.lastActivityAt && " · Nunca acessou"}
                      </p>
                    </div>
                    <button
                      onClick={() => loadPatientReport(p.id)}
                      disabled={loadingReport === p.id}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {loadingReport === p.id ? "..." : "Ver relatório"}
                    </button>
                  </div>
                  {expandedId === p.id && reportData[p.id] && (
                    <div className="mt-4 border-t border-amber-200 pt-4">
                      <EngagementReportSnippet data={reportData[p.id]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active patients */}
      {activePatients.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
            Ativas nos últimos 7 dias ({activePatients.length})
          </p>
          <div className="space-y-2">
            {activePatients.map((p) => {
              const gest = computeGestation({
                lmp: p.lmp_date,
                referenceDate: p.reference_date,
                referenceWeeks: p.reference_weeks,
                referenceDays: p.reference_days,
              });
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:bg-emerald-500/10 dark:border-emerald-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{p.display_name ?? "Paciente"}</p>
                        {p.hasUnseenForm && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                            Pré-consulta nova
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {gest ? `${gest.weeks}s${gest.days}d` : "Sem dados gestacionais"}
                        {p.baby_name && ` · ${p.baby_name}`}
                        {p.lastActivityAt &&
                          ` · Último acesso: ${new Date(p.lastActivityAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <button
                      onClick={() => loadPatientReport(p.id)}
                      disabled={loadingReport === p.id}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {loadingReport === p.id ? "..." : "Ver relatório"}
                    </button>
                  </div>
                  {expandedId === p.id && reportData[p.id] && (
                    <div className="mt-4 border-t border-emerald-200 pt-4">
                      <EngagementReportSnippet data={reportData[p.id]} />
                    </div>
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

/**
 * A última medida DE VERDADE.
 *
 * `health_logs` tem uma linha por registro, e o app envia só os campos que a
 * paciente preencheu (`minha-conta.tsx` monta o objeto com o que existe). Ler
 * `healthLogs[0]` e pegar dali o peso significa que uma paciente que hoje
 * anotou só a pressão faz o médico ver "Último peso: —" — indistinguível de
 * "nunca se pesou". Aqui procuramos a linha mais recente em que AQUELA medida
 * está preenchida, e devolvemos também a data, que é metade da informação.
 */
function ultimaMedida<T extends Record<string, any>>(
  logs: T[] | null | undefined,
  campo: keyof T,
): { valor: any; quando: string | null } {
  for (const l of logs ?? []) {
    const v = l?.[campo];
    if (v !== null && v !== undefined && v !== "") {
      return { valor: v, quando: (l.log_date as string) ?? (l.created_at as string) ?? null };
    }
  }
  return { valor: null, quando: null };
}

/** "12/03" — data curta para caber ao lado do número. */
function diaCurto(ymd: string | null): string {
  if (!ymd) return "";
  const d = new Date(ymd.length <= 10 ? `${ymd}T00:00:00` : ymd);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function EngagementReportSnippet({ data }: { data: any }) {
  const { healthLogs, journals, kicks, pendingQuestions, latestPreConsulta } = data;
  const peso = ultimaMedida(healthLogs, "weight_kg");
  return (
    <div className="grid gap-3 sm:grid-cols-4 text-sm">
      <InfoBox
        label="Último peso"
        value={
          peso.valor
            ? `${peso.valor} kg${diaCurto(peso.quando) ? ` · ${diaCurto(peso.quando)}` : ""}`
            : "—"
        }
      />
      {/* A PA é UM par: a sistólica sem a diastólica renderizava o literal
          "120/null". Se falta metade, a medida não está pronta para ser lida. */}
      <InfoBox
        label="Última PA"
        value={(() => {
          const l = (healthLogs ?? []).find(
            (x: any) => x?.systolic != null && x?.diastolic != null,
          );
          if (!l) return "—";
          const d = diaCurto(l.log_date ?? l.created_at ?? null);
          /* Regra compartilhada em `lib/sinais-clinicos`, não repetida aqui:
             a mesma faixa precisa valer em toda tela que mostra pressão, senão
             o médico aprende que a cor não quer dizer nada. */
          const sinal = sinalPressao(l.systolic, l.diastolic);
          const marca =
            sinal?.gravidade === "grave" ? "🔴 " : sinal?.gravidade === "atencao" ? "⚠️ " : "";
          return `${marca}${l.systolic}/${l.diastolic}${d ? ` · ${d}` : ""}`;
        })()}
      />
      <InfoBox label="Entradas no diário" value={String(journals?.length ?? 0)} />
      <InfoBox label="Perguntas pendentes" value={String(pendingQuestions?.length ?? 0)} />
      {latestPreConsulta && (
        <div className="sm:col-span-4 rounded-lg bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary mb-1">Última pré-consulta</p>
          {latestPreConsulta.questions && (
            <p className="text-muted-foreground">{latestPreConsulta.questions}</p>
          )}
          {latestPreConsulta.symptoms?.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              Sintomas: {latestPreConsulta.symptoms.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Shared components ---------- */
function Stat({
  label,
  value,
  highlight,
  tom,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  /** `urgente` sai da cor da marca — é o que separa "olhe isto" de "corra". */
  tom?: "urgente";
}) {
  const urgente = tom === "urgente";
  return (
    <div
      className={`rounded-2xl border p-4 text-center shadow-[var(--shadow-card)] ${
        urgente
          ? "border-rose-300 bg-rose-50"
          : highlight
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-card"
      }`}
    >
      <p
        className={`font-serif text-3xl ${
          urgente ? "text-rose-700" : highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
      <p className={`mt-1 text-xs ${urgente ? "text-rose-900/80" : "text-muted-foreground"}`}>
        {label}
      </p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/* ---------- Teleconsultas ---------- */

function TeleconsultasSection({
  sessions,
  preForms,
  onRefresh,
  tokenFn,
  patients,
}: {
  sessions: TeleconsultaSession[];
  preForms: AdminPreConsulta[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
  patients: import("@/lib/admin.functions").PatientEngagement[];
}) {
  const [form, setForm] = useState({ patientUserId: "", scheduledFor: "", doctorNotes: "" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [openingRoom, setOpeningRoom] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  // Se a sala foi criada via Google Agenda (convida médico + paciente por
  // e-mail) ou via fallback (só e-mail à paciente) — muda o texto de confirmação.
  const [invitedBoth, setInvitedBoth] = useState(false);
  const [noteBullets, setNoteBullets] = useState<Record<string, string>>({});
  const [generatedNote, setGeneratedNote] = useState<Record<string, string>>({});
  const [generatingNote, setGeneratingNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const STATUS_LABEL_TC: Record<string, string> = {
    agendada: "Agendada",
    sala_aberta: "Sala aberta ✅",
    encerrada: "Encerrada",
  };
  const STATUS_STYLE_TC: Record<string, string> = {
    agendada: "bg-amber-100 text-amber-700",
    sala_aberta: "bg-emerald-100 text-emerald-700",
    encerrada: "bg-secondary text-muted-foreground",
  };

  async function openRoom(s: TeleconsultaSession) {
    setOpeningRoom(s.id);
    const tk = await tokenFn();
    const res = await openTeleconsultaRoom({
      data: {
        accessToken: tk,
        id: s.id,
        patientUserId: s.patient_user_id,
        scheduledFor: s.scheduled_for,
      },
    });
    setOpeningRoom(null);
    if (res.ok) {
      setInvitedBoth("invited" in res ? !!res.invited : false);
      setEmailSent(s.id);
      setTimeout(() => setEmailSent(null), 5000);
    }
    onRefresh();
  }

  async function closeRoom(id: string) {
    const tk = await tokenFn();
    await updateTeleconsultaStatus({ data: { accessToken: tk, id, status: "encerrada" } });
    setActiveVideoId(null);
    onRefresh();
  }

  async function create() {
    if (!form.patientUserId) return;
    setCreating(true);
    const tk = await tokenFn();
    await createTeleconsulta({
      data: {
        accessToken: tk,
        patientUserId: form.patientUserId,
        scheduledFor: form.scheduledFor || null,
        doctorNotes: form.doctorNotes || null,
      },
    });
    setCreating(false);
    setShowForm(false);
    setForm({ patientUserId: "", scheduledFor: "", doctorNotes: "" });
    onRefresh();
  }

  async function doGenerateNote(s: TeleconsultaSession) {
    const pre = preForms.find((f) => f.user_id === s.patient_user_id);
    const bullets = noteBullets[s.id] ?? "";
    if (!bullets.trim()) return;
    setGeneratingNote(s.id);
    const tk = await tokenFn();
    const res = await generateClinicalNote({
      data: {
        accessToken: tk,
        bullets,
        patient: {
          name: s.patient_name ?? "Paciente",
          weeksAtSubmission: pre?.weeks_at_submission ?? null,
          weight: pre?.current_weight ?? null,
          systolic: pre?.systolic ?? null,
          diastolic: pre?.diastolic ?? null,
          symptoms: pre?.symptoms ?? [],
          medications: pre?.medications ?? null,
          questions: pre?.questions ?? null,
          emotionalState: pre?.emotional_state ?? null,
        },
      },
    });
    setGeneratingNote(null);
    if (res.ok) setGeneratedNote((p) => ({ ...p, [s.id]: res.note }));
  }

  async function doSaveNote(id: string) {
    const note = generatedNote[id] ?? noteBullets[id] ?? "";
    if (!note.trim()) return;
    setSavingNote(id);
    const tk = await tokenFn();
    await saveDoctorClinicalNote({ data: { accessToken: tk, id, clinicalNote: note } });
    setSavingNote(null);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-serif text-2xl">Teleconsultas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra a sala de vídeo, veja a pré-consulta da paciente e gere a nota clínica com IA.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          + Agendar
        </button>
      </div>

      {showForm && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <p className="font-serif text-lg">Nova teleconsulta</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paciente
              </label>
              <select
                value={form.patientUserId}
                onChange={(e) => setForm((f) => ({ ...f, patientUserId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione a paciente...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name ?? p.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data e hora
              </label>
              <input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Observações para a paciente
            </label>
            <input
              type="text"
              value={form.doctorNotes}
              onChange={(e) => setForm((f) => ({ ...f, doctorNotes: e.target.value }))}
              placeholder="Ex: Trazer resultados dos últimos exames"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={create}
            disabled={creating || !form.patientUserId}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {creating ? "Criando..." : "Criar teleconsulta"}
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Nenhuma teleconsulta cadastrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessions.map((s) => {
            const pre = preForms.find((f) => f.user_id === s.patient_user_id);
            const isVideoOpen = activeVideoId === s.id;
            return (
              <div key={s.id} className="rounded-3xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-lg">{s.patient_name ?? "Paciente"}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {s.scheduled_for
                          ? new Date(s.scheduled_for).toLocaleString("pt-BR", {
                              dateStyle: "long",
                              timeStyle: "short",
                            })
                          : "Horário a definir"}
                      </p>
                      {s.doctor_notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{s.doctor_notes}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE_TC[s.status]}`}
                    >
                      {STATUS_LABEL_TC[s.status]}
                    </span>
                  </div>

                  {/* Patient notes */}
                  {s.patient_notes && (
                    <p className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs italic text-muted-foreground">
                      <span className="font-medium not-italic">Notas da paciente: </span>
                      {s.patient_notes}
                    </p>
                  )}

                  {/* Pre-consultation summary */}
                  {pre && s.status !== "encerrada" && (
                    <div className="mt-4 rounded-2xl bg-primary/5 border border-primary/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                        Pré-consulta preenchida pela paciente
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-foreground sm:grid-cols-4">
                        {pre.weeks_at_submission && (
                          <span>
                            <span className="text-muted-foreground">IG: </span>
                            {pre.weeks_at_submission}s
                          </span>
                        )}
                        {pre.current_weight && (
                          <span>
                            <span className="text-muted-foreground">Peso: </span>
                            {pre.current_weight} kg
                          </span>
                        )}
                        {pre.systolic != null && pre.diastolic != null && (
                          <span>
                            <span className="text-muted-foreground">PA: </span>
                            {pre.systolic}/{pre.diastolic} mmHg
                            {(() => {
                              const sn = sinalPressao(pre.systolic, pre.diastolic);
                              return sn?.nota ? (
                                <span
                                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ESTILO_SINAL[sn.gravidade]}`}
                                >
                                  {sn.nota}
                                </span>
                              ) : null;
                            })()}
                          </span>
                        )}
                        {pre.emotional_state && (
                          <span>
                            <span className="text-muted-foreground">Emocional: </span>
                            {pre.emotional_state}
                          </span>
                        )}
                      </div>
                      {pre.symptoms.length > 0 && (
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Sintomas: </span>
                          {pre.symptoms.join(", ")}
                        </p>
                      )}
                      {pre.medications && (
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Medicamentos: </span>
                          {pre.medications}
                        </p>
                      )}
                      {pre.questions && (
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Dúvidas: </span>
                          {pre.questions}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {s.status === "agendada" && (
                      <button
                        onClick={() => openRoom(s)}
                        disabled={openingRoom === s.id}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {openingRoom === s.id ? "Criando sala…" : "🟢 Abrir sala agora"}
                      </button>
                    )}
                    {emailSent === s.id && (
                      <span className="text-xs text-emerald-700 font-medium">
                        {invitedBoth
                          ? "✓ Convite (Google Agenda) enviado ao médico e à paciente"
                          : "✓ Link enviado à paciente por e-mail"}
                      </span>
                    )}
                    {s.status === "sala_aberta" && s.meet_url && (
                      <>
                        <a
                          href={s.meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                        >
                          🎥 Entrar no Google Meet
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(s.meet_url!)}
                          className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary"
                        >
                          Copiar link
                        </button>
                        <button
                          onClick={() => closeRoom(s.id)}
                          className="rounded-full border border-destructive/30 px-4 py-2 text-xs text-destructive hover:bg-destructive/5"
                        >
                          Encerrar consulta
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* AI Note generator (available when sala_aberta or encerrada) */}
                {(s.status === "sala_aberta" || s.status === "encerrada") && (
                  <div className="border-t border-border p-6 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      🤖 Nota clínica IA — Gerador SOAP
                    </p>

                    {s.clinical_note && !generatedNote[s.id] ? (
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Nota salva:
                        </p>
                        <pre className="whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed">
                          {s.clinical_note}
                        </pre>
                        <button
                          onClick={() =>
                            setGeneratedNote((p) => ({ ...p, [s.id]: s.clinical_note! }))
                          }
                          className="mt-3 text-xs text-primary underline"
                        >
                          Editar nota
                        </button>
                      </div>
                    ) : (
                      <>
                        <textarea
                          value={noteBullets[s.id] ?? ""}
                          onChange={(e) =>
                            setNoteBullets((p) => ({ ...p, [s.id]: e.target.value }))
                          }
                          rows={4}
                          placeholder={`Ex:\n- Paciente refere dor em baixo ventre leve\n- MF presentes, BCF 148bpm\n- PA 120/80, sem edema\n- USG: crescimento adequado, LA normal`}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => doGenerateNote(s)}
                            disabled={generatingNote === s.id || !(noteBullets[s.id] ?? "").trim()}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                          >
                            {generatingNote === s.id ? "Gerando..." : "✨ Gerar nota SOAP"}
                          </button>
                        </div>

                        {generatedNote[s.id] && (
                          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                            <pre className="whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed">
                              {generatedNote[s.id]}
                            </pre>
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => doSaveNote(s.id)}
                                disabled={savingNote === s.id}
                                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                              >
                                {savingNote === s.id ? "Salvando..." : "💾 Salvar nota"}
                              </button>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(generatedNote[s.id] ?? "")
                                }
                                className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Consultas Pagas ---------- */
function ConsultasPagasSection({
  consultations,
  onRefresh,
  tokenFn,
}: {
  consultations: any[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleConfirm(id: string, status: "confirmado" | "realizado" | "cancelado") {
    setUpdatingId(id);
    const tk = await tokenFn();
    await confirmPaymentForDoctor({ data: { accessToken: tk, id, status } });
    onRefresh();
    setUpdatingId(null);
  }

  const statusColors: Record<string, string> = {
    pendente_pagamento: "bg-amber-50 border-amber-200",
    pagamento_enviado: "bg-blue-50 border-blue-200",
    confirmado: "bg-green-50 border-green-200",
    realizado: "bg-secondary border-border",
    cancelado: "bg-red-50 border-red-200",
  };
  const statusLabels: Record<string, string> = {
    pendente_pagamento: "⏳ Aguardando pagamento",
    pagamento_enviado: "💸 Pagamento enviado",
    confirmado: "✅ Confirmado",
    realizado: "🏁 Realizado",
    cancelado: "❌ Cancelado",
  };

  if (consultations.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Nenhuma consulta particular solicitada ainda.</p>
    );

  return (
    <div className="space-y-3">
      {consultations.map((c: any) => {
        const typeInfo = PRIVATE_CONSULT_TYPES.find((t) => t.key === c.consult_type);
        const color = statusColors[c.status] ?? "bg-card border-border";
        return (
          <div key={c.id} className={`rounded-2xl border p-5 ${color}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">
                  {c.patient_profiles?.display_name ?? "Paciente"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeInfo?.label ?? c.consult_type} · {typeInfo?.price ?? ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs mt-1">{statusLabels[c.status] ?? c.status}</p>
                {c.preferred_dates?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Datas sugeridas:{" "}
                    {c.preferred_dates
                      .map((d: string) => new Date(d).toLocaleString("pt-BR"))
                      .join(", ")}
                  </p>
                )}
                {c.message && (
                  <p className="text-xs mt-0.5 italic text-muted-foreground">"{c.message}"</p>
                )}
              </div>
              {c.status === "pagamento_enviado" && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => handleConfirm(c.id, "confirmado")}
                    disabled={updatingId === c.id}
                    className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    ✓ Confirmar
                  </button>
                  <button
                    onClick={() => handleConfirm(c.id, "cancelado")}
                    disabled={updatingId === c.id}
                    className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40"
                  >
                    × Cancelar
                  </button>
                </div>
              )}
              {c.status === "confirmado" && (
                <button
                  onClick={() => handleConfirm(c.id, "realizado")}
                  disabled={updatingId === c.id}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Marcar realizada
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Empresas ---------- */
function AffiliatesCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [affiliates, setAffiliates] = useState<Affiliate[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pct, setPct] = useState("50");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await listAffiliates({ data: { accessToken: await tokenFn() } });
      if (res.ok) setAffiliates(res.affiliates);
      else if ("missingTable" in res && res.missingTable) {
        setMissing(true);
        setAffiliates([]);
      } else setAffiliates([]);
    } catch {
      setAffiliates([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (creating || code.trim().length < 3 || name.trim().length < 2) return;
    setCreating(true);
    try {
      const res = await createAffiliate({
        data: {
          accessToken: await tokenFn(),
          code: code.trim(),
          name: name.trim(),
          commissionPct: Math.min(90, Math.max(1, parseInt(pct, 10) || 50)),
        },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "duplicado"
            ? "Esse código já existe."
            : "reason" in res && res.reason === "migracao"
              ? "Rode o APLICAR_PENDENTES.sql no Supabase para ativar os afiliados."
              : "Não foi possível criar o código.",
        );
        return;
      }
      toast.success(`Código ${code.trim().toUpperCase()} criado 🎉`);
      setCode("");
      setName("");
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  const brl = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <h3 className="font-semibold">Afiliados (influenciadores)</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Permuta: o influenciador divulga o link com o código dele e ganha a comissão de cada
        mensalidade Premium paga pelas pacientes que ele trouxe — creditada automaticamente.
      </p>

      {missing && (
        <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
          Rode o <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar os afiliados.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0">
          <label className="block text-[11px] font-medium text-muted-foreground">Código</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="MARIA"
            className="mt-1 w-32 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="block text-[11px] font-medium text-muted-foreground">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maria Influencer"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground">% comissão</label>
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="mt-1 w-20 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={create}
          disabled={creating || code.trim().length < 3 || name.trim().length < 2}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {creating ? "Criando…" : "+ Criar código"}
        </button>
      </div>

      {affiliates === null ? (
        <div className="mt-3 h-16 animate-pulse rounded-2xl bg-secondary" />
      ) : affiliates.length === 0 ? (
        !missing && (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum afiliado ainda. Crie o primeiro código acima — o link fica{" "}
            <span className="font-medium text-foreground">{DOCTOR.siteUrl}/?ref=CODIGO</span>.
          </p>
        )
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5">Código</th>
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">%</th>
                <th className="px-4 py-2.5">Pacientes</th>
                <th className="px-4 py-2.5">Faturado</th>
                <th className="px-4 py-2.5">Comissão</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.code} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-mono font-semibold">{a.code}</td>
                  <td className="px-4 py-2.5">{a.name}</td>
                  <td className="px-4 py-2.5">{a.commission_pct}%</td>
                  <td className="px-4 py-2.5">{a.signups}</td>
                  <td className="px-4 py-2.5">{brl(a.revenueCents)}</td>
                  <td className="px-4 py-2.5 font-semibold text-emerald-600">
                    {brl(a.commissionCents)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={async () => {
                        const res = await toggleAffiliate({
                          data: {
                            accessToken: await tokenFn(),
                            code: a.code,
                            active: !a.active,
                          },
                        });
                        if (res.ok) load();
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        a.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {a.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Ferramentas clínicas ---------- */

const PRESCRIPTIONS = [
  {
    title: "Suplementação pré-natal padrão",
    icon: "💊",
    text: `Sulfato ferroso 40mg (elementar) — 1 comprimido VO 1x/dia, em jejum
Ácido fólico 5mg — 1 comprimido VO 1x/dia`,
  },
  {
    title: "Suplementação de cálcio",
    icon: "🦴",
    text: `Carbonato de cálcio 1250mg (= 500mg Ca elementar) — 2 comprimidos VO/dia, fracionados às refeições`,
  },
  {
    title: "Náuseas e vômitos (1º tri)",
    icon: "🤢",
    text: `Opção 1: Ondansetrona 4mg — 1 cp VO 8/8h (máx 12mg/dia)
Opção 2: Metoclopramida 10mg — 1 cp VO 3x/dia antes das refeições
Opção 3: Dimenidrinato 50mg — 1 cp VO 3x/dia`,
  },
  {
    title: "Hipertensão gestacional / pré-eclâmpsia",
    icon: "🫀",
    text: `Metildopa 250mg — 1 cp VO 3x/dia (dose inicial; pode aumentar até 3g/dia)
Alternativa: Nifedipino ação prolongada 30mg VO 1x/dia

Urgência hipertensiva (PA ≥ 160/110):
Nifedipino 10mg VO 1 cp — repetir em 30 min se necessário`,
  },
  {
    title: "Profilaxia pré-eclâmpsia (AAS)",
    icon: "💉",
    text: `AAS 100–150mg VO 1x/dia (à noite)
Início: 11–16 semanas | Duração: até 36 semanas
+ Carbonato de cálcio 1–2g/dia se ingesta baixa`,
  },
  {
    title: "Diabetes gestacional — Metformina",
    icon: "🩸",
    text: `Metformina 500mg VO 2x/dia às refeições (dose inicial)
Aumentar para 1g VO 2x/dia após 1 semana se tolerado
Monitorar: glicemia jejum e pós-prandial 1h e 2h`,
  },
  {
    title: "ITU na gestante (1ª linha)",
    icon: "🦠",
    text: `Cefalexina 500mg VO 6/6h por 7 dias
OU Nitrofurantoína 100mg VO 6/6h por 5–7 dias (evitar no 3º tri)
OU Amoxicilina-clavulanato 875/125mg VO 12/12h por 7 dias

Pielonefrite: internação + Ceftriaxone 1–2g EV/dia`,
  },
  {
    title: "Profilaxia TVP / TEV",
    icon: "🩻",
    text: `Enoxaparina 40mg SC 1x/dia (dose profilática, peso < 80kg)
Enoxaparina 60mg SC 1x/dia (peso 80–120kg)
Início: 12h após parto vaginal | 24h após cesárea
Duração: mínimo 10 dias pós-parto; ampliar em alto risco`,
  },
];

const EXAM_PANELS = [
  {
    title: "1º Trimestre — 8 a 13 semanas",
    icon: "🔬",
    exams: [
      "Hemograma completo",
      "Grupo sanguíneo e fator Rh",
      "Coombs indireto (se Rh negativo)",
      "Glicemia de jejum",
      "Urina tipo 1 + urocultura",
      "TSH",
      "Sorologias: Toxoplasmose IgG/IgM, Rubéola IgG/IgM, CMV IgG/IgM",
      "Sífilis (VDRL + FTA-ABS)",
      "HIV 1 e 2 (anti-HIV)",
      "HBsAg, Anti-HBs, Anti-HCV",
      "Eletroforese de hemoglobinas",
      "Ultrassom obstétrico — datação + translucência nucal (11s–13s6d)",
      "PAPP-A + β-hCG livre (rastreio aneuploidias, junto com TN)",
    ],
  },
  {
    title: "2º Trimestre — 18 a 28 semanas",
    icon: "📋",
    exams: [
      "Ultrassom morfológico (18–22 semanas) — obrigatório",
      "TOTG 75g: glicemia jejum, 1h e 2h (24–28 semanas)",
      "Hemograma",
      "Urina tipo 1 + urocultura",
      "Sorologias de controle (toxo, sífilis, HIV — se negativas no 1º tri)",
      "Ultrassom + Doppler uterino (24–28 sem, se risco de pré-eclâmpsia)",
    ],
  },
  {
    title: "3º Trimestre — 32 a 37 semanas",
    icon: "🏥",
    exams: [
      "Hemograma",
      "Coagulograma: TP, TTPA, fibrinogênio",
      "Urina tipo 1",
      "Pesquisa de Streptococcus agalactiae (SGB) — 35–37 semanas",
      "Cardiotocografia basal (a partir de 32 semanas)",
      "Ultrassom de crescimento fetal",
      "Dopplervelocimetria (artéria umbilical e cerebral média)",
      "Coombs indireto (repetir se Rh negativo)",
      "Classificação sanguínea (repetir se Rh negativo)",
    ],
  },
];

function FerramentasSection() {
  const [openRx, setOpenRx] = useState<number | null>(null);
  const [envio, setEnvio] = useState<{
    tipo: TipoDeEmissao;
    titulo: string;
    conteudo: string;
  } | null>(null);
  const [openExam, setOpenExam] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function printText(title: string, text: string) {
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; color: #111; }
        h2 { font-size: 18px; margin-bottom: 24px; }
        pre { font-family: inherit; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
        .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 12px; color: #666; }
      </style></head><body>
      <h2>${title}</h2><pre>${text}</pre>
      <div class="footer">Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
      <script>window.print();</script></body></html>`);
  }

  return (
    <div className="space-y-10">
      {/* Receituário */}
      <div>
        <p className="font-serif text-2xl">Receituário Rápido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Prescrições comuns de obstetrícia. Clique para expandir, copiar ou imprimir.
        </p>
        <div className="mt-5 space-y-2">
          {PRESCRIPTIONS.map((rx, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOpenRx(openRx === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30"
              >
                <span className="flex items-center gap-3 font-medium">
                  <span className="text-xl">{rx.icon}</span>
                  {rx.title}
                </span>
                <span className="text-muted-foreground text-sm">{openRx === i ? "▲" : "▼"}</span>
              </button>
              {openRx === i && (
                <div className="border-t border-border px-5 py-4 space-y-3">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                    {rx.text}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(rx.text, `rx-${i}`)}
                      className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-muted/40"
                    >
                      {copied === `rx-${i}` ? "✅ Copiado!" : "Copiar"}
                    </button>
                    <button
                      onClick={() => printText(rx.title, rx.text)}
                      className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-muted/40"
                    >
                      🖨️ Imprimir
                    </button>
                    {/* ENVIAR vira a ação principal, e imprimir desce para
                        secundária. Enquanto imprimir era o destaque, a receita
                        existia só no papel que ela levava — e o sistema, que
                        tem a caixa onde o laudo volta, nunca soube que o exame
                        tinha sido pedido. */}
                    <button
                      onClick={() =>
                        setEnvio({ tipo: "prescricao", titulo: rx.title, conteudo: rx.text })
                      }
                      className="press rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Enviar a uma paciente
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Solicitações de exame */}
      <div>
        <p className="font-serif text-2xl">Solicitação de Exames</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Painéis padrão por trimestre. Copie ou imprima em um clique.
        </p>
        <div className="mt-5 space-y-2">
          {EXAM_PANELS.map((panel, i) => {
            const examText = panel.exams.join("\n");
            return (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenExam(openExam === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30"
                >
                  <span className="flex items-center gap-3 font-medium">
                    <span className="text-xl">{panel.icon}</span>
                    {panel.title}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {openExam === i ? "▲" : `${panel.exams.length} exames ▼`}
                  </span>
                </button>
                {openExam === i && (
                  <div className="border-t border-border px-5 py-4 space-y-3">
                    <ul className="space-y-1">
                      {panel.exams.map((e, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="mt-0.5 text-primary shrink-0">•</span>
                          {e}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyText(examText, `exam-${i}`)}
                        className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-muted/40"
                      >
                        {copied === `exam-${i}` ? "✅ Copiado!" : "Copiar lista"}
                      </button>
                      <button
                        onClick={() =>
                          printText(`Solicitação de Exames — ${panel.title}`, examText)
                        }
                        className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-muted/40"
                      >
                        🖨️ Imprimir
                      </button>
                      <button
                        onClick={() =>
                          setEnvio({ tipo: "exame", titulo: panel.title, conteudo: examText })
                        }
                        className="press rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        Enviar a uma paciente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        ⚕️ Prescrições e painéis baseados nos protocolos FEBRASGO/SBD/SBH 2022–2024. Sempre confirme
        com o protocolo vigente da sua instituição e ajuste conforme o quadro clínico da paciente.
      </p>

      {envio && (
        <EnviarParaPaciente
          tipo={envio.tipo}
          titulo={envio.titulo}
          conteudoInicial={envio.conteudo}
          tokenFn={token}
          onFechar={() => setEnvio(null)}
        />
      )}
    </div>
  );
}

/* ---------- Calendário (week view) ---------- */
const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function CalendárioSection({
  appointments,
  onNavigate,
}: {
  appointments: AdminAppointment[];
  onNavigate: (tab: PanelTab) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function goToday() {
    setWeekStart(getWeekStart(new Date()));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const confirmedAppts = appointments.filter(
    (a) => a.status === "confirmed" && (a as any).confirmed_date,
  );

  function getAppts(day: Date) {
    const iso = ymdLocal(day);
    return confirmedAppts
      .filter((a) => (a as any).confirmed_date === iso)
      .sort((a, b) =>
        ((a as any).confirmed_time ?? "").localeCompare((b as any).confirmed_time ?? ""),
      );
  }

  const today = ymdLocal();

  const weekLabel = `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            ← Anterior
          </button>
          <button
            onClick={goToday}
            className="rounded-full border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary"
          >
            Hoje
          </button>
          <button
            onClick={nextWeek}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            Próxima →
          </button>
        </div>
        <p className="text-sm font-medium">{weekLabel}</p>
        <button
          onClick={() => onNavigate("Agendamentos")}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Ver todos
        </button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day, i) => {
          const iso = ymdLocal(day);
          const isToday = iso === today;
          const dayAppts = getAppts(day);
          return (
            <div
              key={i}
              className={`rounded-2xl border p-2 min-h-[120px] flex flex-col gap-1.5 ${isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="text-center">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}
                >
                  {DOW_LABELS[i]}
                </p>
                <p className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>
                  {day.getDate()}
                </p>
              </div>
              {dayAppts.map((a) => (
                <div
                  key={a.id}
                  title={`${a.patient_name} — ${(a as any).confirmed_time}`}
                  className="rounded-lg bg-primary/10 px-1.5 py-1 text-[10px] leading-tight text-primary truncate"
                >
                  <span className="font-medium">{(a as any).confirmed_time}</span>{" "}
                  {a.patient_name.split(" ")[0]}
                </div>
              ))}
              {dayAppts.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center mt-1">—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming confirmed list */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
          Próximas confirmadas
        </p>
        {confirmedAppts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma consulta confirmada com data definida.
          </p>
        ) : (
          <div className="space-y-2">
            {confirmedAppts
              .filter((a) => (a as any).confirmed_date >= today)
              .sort((a, b) => {
                const da = `${(a as any).confirmed_date}T${(a as any).confirmed_time ?? "00:00"}`;
                const db = `${(b as any).confirmed_date}T${(b as any).confirmed_time ?? "00:00"}`;
                return da.localeCompare(db);
              })
              .slice(0, 10)
              .map((a) => {
                const ext = a as any;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-2.5"
                  >
                    <div className="text-center min-w-[48px]">
                      <p className="text-sm font-bold text-primary">
                        {new Date(ext.confirmed_date + "T00:00:00").getDate()}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR", {
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ext.confirmed_time} · {a.reason}
                      </p>
                    </div>
                    {ext.price_brl && (
                      <p
                        className={`text-xs font-medium shrink-0 ${ext.payment_status === "pago" ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {ext.payment_status === "pago" ? "✓ " : ""}R${" "}
                        {(ext.price_brl / 100).toFixed(2)}
                      </p>
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

/* ---------- Agenda (availability config) ---------- */

/* A aba "Agenda" (grade semanal + datas bloqueadas) foi removida.
   
   Ela escrevia direto, do navegador, em `doctor_availability` e
   `blocked_dates` — duas tabelas que nasceram single-tenant: sem coluna
   `doctor_id`, uma linha por dia da semana para o consultório inteiro, e com
   política de RLS que deixava QUALQUER pessoa logada (inclusive uma paciente)
   reescrever os horários e apagar as férias.
   
   A tabela também não alimentava nada: nenhum fluxo de agendamento lia esses
   horários. Era uma tela que gravava num lugar que ninguém consultava, por um
   caminho que ninguém deveria ter. A escrita foi revogada na migration
   `20260730020000`, e a tela saiu junto — quando a agenda por médico for
   construída, ela nasce com `doctor_id` e com política própria. */

/* ---------- Cérebro 🧠 (Segundo Cérebro do médico) ---------- */

const BRAIN_SOURCE_STYLE: Record<string, string> = {
  manual: "bg-secondary text-muted-foreground",
  pergunta: "bg-violet-100 text-violet-700",
  whatsapp: "bg-emerald-100 text-emerald-800",
};

function BrainToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function CerebroSection({
  tokenFn,
  onTrained,
  asDoctor,
  onExitAsDoctor,
  onAbrirPaciente,
  onIrParaPlanos,
}: {
  tokenFn: () => Promise<string>;
  onTrained: (questionId: string) => void;
  // Plano Clínica: admin operando o cérebro de um médico da clínica.
  asDoctor?: { id: string; name: string } | null;
  onExitAsDoctor?: () => void;
  /** Da lista "quem mais conversou" direto para o prontuário dela. */
  onAbrirPaciente?: (patientId: string) => void;
  /** Do aviso de cota direto para os planos — a ação que resolve o problema. */
  onIrParaPlanos?: () => void;
}) {
  const asId = asDoctor?.id;
  /* Cada fila reporta o seu número; a faixa soma. Contar aqui em cima exigiria
     levantar as três buscas para este componente — muito mais código para o
     mesmo resultado, e cada card deixaria de saber carregar sozinho. */
  const [fila, setFila] = useState({ lacunas: 0, revisao: 0, perguntas: 0 });
  const esperando = fila.lacunas + fila.revisao + fila.perguntas;
  return (
    // key: trocar de médico REMONTA todos os cards — cada cérebro carrega do
    // zero, sem estado (lacunas, base, placar) vazando de um médico p/ outro.
    <div key={asId ?? "own"} className="space-y-6">
      {asDoctor && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm">
            🏥 Você está operando o cérebro de <strong>{asDoctor.name}</strong> (clínica). Tudo o
            que fizer aqui vale só para o cérebro deste médico.
          </p>
          <button
            onClick={onExitAsDoctor}
            className="shrink-0 rounded-full border border-primary px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Voltar ao meu cérebro
          </button>
        </div>
      )}
      <div>
        <p className="font-serif text-xl">
          {asDoctor ? `Segundo Cérebro de ${asDoctor.name}` : "Seu Segundo Cérebro"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ensine a IA a responder como {asDoctor ? "este médico" : "você"} responderia: defina o
          estilo, responda perguntas reais das pacientes e alimente a base de conhecimento. O
          cérebro é usado pelo chat do app e pelo atendimento no WhatsApp.
        </p>
        {/* AS DUAS FILAS, ditas antes de aparecerem.
            A distinção entre ensinar e corrigir era ensinada só a quem já
            tinha item na fila — e a fila de revisão some quando está vazia,
            então o médico podia usar o Cérebro por meses sem descobrir que ela
            existe. Uma linha aqui custa nada e é o que dá nome às duas coisas
            que ele vai encontrar rolando a página. */}
        <p className="mt-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Abaixo há <strong>três filas</strong>, e elas pedem coisas diferentes:{" "}
          <strong>🕳️ Lacunas</strong> é o que a IA <em>não soube</em> responder —{" "}
          {asDoctor ? "ele ensina" : "você ensina"} algo novo. <strong>✋ Revisão</strong> é o que
          ela <em>soube</em> e a paciente reprovou — {asDoctor ? "ele corrige" : "você corrige"} o
          que já existe. <strong>❓ Perguntas</strong> são dúvidas que a paciente mandou direto —{" "}
          {asDoctor ? "ele responde" : "você responde"} e a IA aprende junto.
        </p>
      </div>
      <ComecePorAqui tokenFn={tokenFn} asDoctor={asId} />

      {/* ─── ① O QUE ESTÁ ESPERANDO ELE ──────────────────────────────────
          O argumento para pôr o Cérebro na PRIMEIRA aba foi "a fila de lacunas
          e a de revisão são trabalho que rende". Dentro da aba, as filas eram o
          4º e o 5º card: ~1.200px de placar e fatura antes do que ele tem para
          fazer. A tese e o layout diziam coisas opostas. */}
      <h3 className="flex items-center gap-2 pt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        O que está esperando você
        {/* O NÚMERO NA FAIXA. Sem ele, o médico rolava as três filas para
            descobrir se havia trabalho — e as três, vazias, são ~400px de
            "nada". Com a soma no cabeçalho, ele decide sem rolar. */}
        {esperando > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
            {esperando}
          </span>
        )}
      </h3>
      <BrainGapsCard
        tokenFn={tokenFn}
        asDoctor={asId}
        onContar={(n) => setFila((f) => ({ ...f, lacunas: n }))}
      />
      <BrainReviewCard
        tokenFn={tokenFn}
        asDoctor={asId}
        onContar={(n) => setFila((f) => ({ ...f, revisao: n }))}
      />
      <BrainTrainCard
        tokenFn={tokenFn}
        onTrained={onTrained}
        asDoctor={asId}
        onContar={(n) => setFila((f) => ({ ...f, perguntas: n }))}
      />

      {/* ─── ② COMO ESTÁ O CÉREBRO ───────────────────────────────────────── */}
      <h3 className="pt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Como está o seu cérebro
      </h3>
      <BrainLevelCard tokenFn={tokenFn} asDoctor={asId} />
      <BuscaPorSignificadoCard tokenFn={tokenFn} asDoctor={asId} />
      <ConsumoDaIACard
        tokenFn={tokenFn}
        asDoctor={asId}
        onAbrirPaciente={onAbrirPaciente}
        onIrParaPlanos={onIrParaPlanos}
      />

      {/* ─── ③ FERRAMENTAS ───────────────────────────────────────────────── */}
      <h3 className="pt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Ferramentas
      </h3>
      <BrainConversationsCard tokenFn={tokenFn} asDoctor={asId} />
      <BrainConsultaCard tokenFn={tokenFn} asDoctor={asId} />
      <BrainEvalCard tokenFn={tokenFn} asDoctor={asId} />
      <BrainKnowledgeCard tokenFn={tokenFn} asDoctor={asId} />
      <BrainPlaygroundCard tokenFn={tokenFn} asDoctor={asId} />

      {/* ─── ④ AJUSTES ───────────────────────────────────────────────────
          Por último de propósito: é o que ele mexe uma vez e não volta. */}
      <h3 className="pt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Ajustes
      </h3>
      <BrainSettingsCard tokenFn={tokenFn} asDoctor={asId} />
    </div>
  );
}

type EvalRow = {
  id: string;
  status: "pendente" | "rodando" | "aprovada" | "reprovada" | "erro";
  issue?: string | null;
  answer?: string;
  usedBrain?: boolean;
};

/**
 * Prova de qualidade (eval): roda a bateria de perguntas críticas contra o
 * cérebro REAL e um juiz independente aprova/reprova cada resposta. É o que
 * permite afirmar "zero conduta inventada" com evidência — sem esperar meses
 * de uso. Rode após treinar o cérebro e antes de divulgar.
 */
function BrainEvalCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
}) {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function runEval() {
    if (running) return;
    setRunning(true);
    setRows(BRAIN_EVAL_QUESTIONS.map((q) => ({ id: q.id, status: "pendente" as const })));
    try {
      const tk = await tokenFn();
      // Sequencial de propósito: progresso ao vivo e sem estourar cota.
      for (const q of BRAIN_EVAL_QUESTIONS) {
        setRows((rs) => rs.map((r) => (r.id === q.id ? { ...r, status: "rodando" } : r)));
        try {
          const res = await evalBrainQuestion({
            data: {
              accessToken: tk,
              question: q.question,
              expect: q.expect,
              criterion: q.criterion,
              ...(asDoctor ? { asDoctor } : {}),
            },
          });
          if (!res.ok) {
            if ("reason" in res && res.reason === "plan") {
              toast.error("Seu plano atual não inclui a IA.");
              setRows([]);
              return;
            }
            if ("reason" in res && res.reason === "config") {
              toast.error("IA não configurada nesta instalação.");
              setRows([]);
              return;
            }
            setRows((rs) => rs.map((r) => (r.id === q.id ? { ...r, status: "erro" } : r)));
            continue;
          }
          setRows((rs) =>
            rs.map((r) =>
              r.id === q.id
                ? {
                    ...r,
                    status: res.approved ? "aprovada" : "reprovada",
                    issue: res.issue,
                    answer: res.answer,
                    usedBrain: res.usedBrain,
                  }
                : r,
            ),
          );
        } catch {
          setRows((rs) => rs.map((r) => (r.id === q.id ? { ...r, status: "erro" } : r)));
        }
      }
    } finally {
      setRunning(false);
    }
  }

  const done =
    rows.length > 0 && rows.every((r) => r.status !== "pendente" && r.status !== "rodando");
  const approvedCount = rows.filter((r) => r.status === "aprovada").length;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-xl">🧪 Prova de qualidade</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {BRAIN_EVAL_QUESTIONS.length} perguntas críticas (urgências, pedidos de receita, exames)
            rodam contra a sua IA e um juiz independente aprova ou reprova cada resposta. Rode após
            treinar o cérebro.
          </p>
        </div>
        <button
          onClick={runEval}
          disabled={running}
          className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {running ? "Avaliando…" : rows.length > 0 ? "Rodar de novo" : "▶ Rodar avaliação"}
        </button>
      </div>

      {done && (
        <p
          className={`mt-4 rounded-2xl border p-3 text-sm font-semibold ${
            approvedCount === rows.length
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {approvedCount === rows.length
            ? `✅ Aprovada em ${approvedCount}/${rows.length} — sua IA respondeu com segurança a toda a bateria.`
            : `⚠️ ${approvedCount}/${rows.length} aprovadas — veja abaixo o que reprovou e ajuste o cérebro.`}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-2">
          {BRAIN_EVAL_QUESTIONS.map((q) => {
            const r = rows.find((x) => x.id === q.id);
            if (!r) return null;
            const icon =
              r.status === "aprovada"
                ? "✅"
                : r.status === "reprovada"
                  ? "❌"
                  : r.status === "rodando"
                    ? "⏳"
                    : r.status === "erro"
                      ? "⚠️"
                      : "•";
            return (
              <div key={q.id} className="rounded-xl border border-border bg-background p-3">
                <button
                  onClick={() => setOpenId(openId === q.id ? null : q.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <span className="min-w-0 flex-1 text-sm">
                    {icon} "{q.question}"
                    {r.usedBrain === true && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase text-primary">
                        · seu cérebro
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {q.expect}
                  </span>
                </button>
                {r.issue && r.status === "reprovada" && (
                  <p className="mt-1.5 text-xs text-destructive">↳ {r.issue}</p>
                )}
                {openId === q.id && r.answer && (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                    {r.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Conversas da IA por paciente: o médico vê o que a IA respondeu em cada
 * chat, cada paciente com a SUA conversa individual. Controle e supervisão —
 * o médico sabe exatamente o que está sendo dito em nome dele.
 */
function BrainConversationsCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
}) {
  const [convs, setConvs] = useState<BrainConversation[] | null>(null);
  const [missingTable, setMissingTable] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BrainChatMessage[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await listBrainConversations({
          data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
        });
        if (res.ok) setConvs(res.conversations);
        else if ("missingTable" in res && res.missingTable) {
          setMissingTable(true);
          setConvs([]);
        } else setConvs([]);
      } catch {
        setConvs([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFn]);

  async function openConversation(patientId: string) {
    if (openId === patientId) {
      setOpenId(null);
      setMessages(null);
      return;
    }
    setOpenId(patientId);
    setMessages(null);
    setLoadingMsgs(true);
    try {
      const res = await getBrainConversation({
        data: {
          accessToken: await tokenFn(),
          patientId,
          ...(asDoctor ? { asDoctor } : {}),
        },
      });
      setMessages(res.ok ? res.messages : []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">💬 Conversas da IA com as pacientes</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        O que a IA respondeu em cada chat, paciente por paciente — supervisione e, se algo não
        estiver do seu jeito, ajuste o estilo ou a base de conhecimento.
      </p>

      {convs === null ? (
        <div className="mt-4 space-y-2">
          <div className="h-14 animate-pulse rounded-xl bg-secondary" />
          <div className="h-14 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : missingTable ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
          O histórico de conversas ainda não existe no banco — rode o{" "}
          <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar.
        </p>
      ) : convs.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          Nenhuma conversa registrada ainda. Assim que uma paciente falar com a IA no app, a
          conversa aparece aqui.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {convs.map((c) => (
            <div key={c.patientId} className="rounded-xl border border-border">
              <button
                onClick={() => openConversation(c.patientId)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">"{c.lastPreview}"</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.lastAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.count} msg{c.count === 1 ? "" : "s"} {openId === c.patientId ? "▴" : "▾"}
                  </p>
                </div>
              </button>
              {openId === c.patientId && (
                <div className="max-h-96 space-y-2 overflow-y-auto border-t border-border p-4">
                  {loadingMsgs ? (
                    <div className="h-16 animate-pulse rounded-xl bg-secondary" />
                  ) : (messages ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sem mensagens nesta conversa (ou falha ao carregar — tente de novo).
                    </p>
                  ) : (
                    (messages ?? []).map((m, i) => (
                      <div
                        key={i}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                            m.role === "user"
                              ? "rounded-br-sm bg-primary/10 text-foreground"
                              : "rounded-bl-sm bg-secondary"
                          }`}
                        >
                          {m.content}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {m.role === "user" ? "Paciente" : "IA"} ·{" "}
                            {new Date(m.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Consulta → conhecimento: o médico grava a consulta (ou cola a transcrição)
 * e a IA extrai os pares pergunta→resposta que ELE deu, como rascunhos para
 * aprovar. Uma consulta de 30 min rende ~10 entradas na voz literal dele —
 * o jeito mais rápido de o cérebro virar o próprio médico.
 */
function BrainConsultaCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
}) {
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const audioRef = useRef<HTMLInputElement>(null);

  async function transcribeAudio(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Áudio acima de 20MB — grave trechos menores.");
      return;
    }
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
        // O endpoint agora exige sessão: aceitava 20 MB de áudio de qualquer um.
        headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
      });
      if (!res.ok) {
        toast.error("Não foi possível transcrever o áudio — tente novamente.");
        return;
      }
      const data = (await res.json()) as { transcript?: string };
      if (!data.transcript?.trim()) {
        toast.error("A transcrição veio vazia — o áudio está audível?");
        return;
      }
      setTranscript(data.transcript.trim());
      toast.success("Transcrição pronta — revise e clique em Extrair conhecimento 👇");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setTranscribing(false);
      if (audioRef.current) audioRef.current.value = "";
    }
  }

  async function extract() {
    const text = transcript.trim();
    if (text.length < 80 || extracting) return;
    setExtracting(true);
    try {
      const tk = await tokenFn();
      const res = await extractKnowledgeFromTranscript({
        data: {
          accessToken: tk,
          transcript: text.slice(0, 30000),
          ...(asDoctor ? { asDoctor } : {}),
        },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "reason" in res && res.reason === "config"
              ? "IA não configurada nesta instalação."
              : "Não foi possível extrair — tente novamente.",
        );
        return;
      }
      if (res.created === 0) {
        toast("Nenhuma orientação reaproveitável encontrada nesta transcrição.");
        return;
      }
      toast.success(
        `${res.created} rascunhos criados na sua voz 🎙️ — revise e aprove na Base de conhecimento 👇`,
      );
      setTranscript("");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-xl">🎙️ Consulta vira conhecimento</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Grave a consulta no celular (com consentimento da paciente) e envie o áudio — a IA extrai as
        orientações que <strong>você</strong> deu e cria rascunhos genéricos (sem nomes nem dados da
        paciente) para você aprovar. Uma consulta rende ~10 entradas na sua voz.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) transcribeAudio(f);
          }}
        />
        <button
          onClick={() => audioRef.current?.click()}
          disabled={transcribing || extracting}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {transcribing ? "Transcrevendo…" : "🎙️ Enviar áudio da consulta"}
        </button>
        <span className="text-xs text-muted-foreground">ou cole a transcrição abaixo</span>
      </div>

      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={4}
        placeholder="Cole aqui a transcrição da consulta (mínimo ~80 caracteres)…"
        className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Nada entra no cérebro sem a sua aprovação — tudo nasce como rascunho.
        </p>
        <button
          onClick={extract}
          disabled={extracting || transcribing || transcript.trim().length < 80}
          className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {extracting ? "Extraindo…" : "🧠 Extrair conhecimento"}
        </button>
      </div>
    </div>
  );
}

/**
 * "A MINHA RESPOSTA CHEGOU A SER ENCONTRADA?"
 *
 * Nasceu de um caso real: a paciente perguntou "pode comer comida japonesa",
 * recebeu informação geral e, no fim, *"registrei sua pergunta para a Dra."* —
 * com a médica já tendo escrito sobre peixe cru. A leitura dela foi a única
 * possível: o que eu respondi não valeu de nada.
 *
 * A causa está em `podeAtribuir`: assinar o nome do médico exige uma
 * similaridade MEDIDA, e o ranking por palavras não produz número nenhum. Sem
 * a busca vetorial, atribuir é impossível e toda pergunta vira lacuna — o
 * cérebro responde e parece vazio.
 *
 * O que este card faz é tirar isso do log do servidor e pôr na tela dele. Os
 * três estados são deliberadamente diferentes em CONSEQUÊNCIA, não em tom:
 *
 *   · desligada  → nada que ele escrever será encontrado por significado;
 *   · com dívida → parte da base está invisível, e a barra diz quanto;
 *   · funcionando→ a distribuição real, e o que a faixa do meio significa.
 *
 * O número não vem de uma chamada de teste ("o serviço responde agora?") — vem
 * de `ai_usage.similaridade`, o que aconteceu com as pacientes DELE.
 */
function BuscaPorSignificadoCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  asDoctor?: string;
}) {
  const [d, setD] = useState<{
    respostas: number;
    comNumero: number;
    assinadas: number;
    faixaDoMeio: number;
    semNada: number;
    cegas: number;
    entradas: number;
  } | null>(null);
  const [semTabela, setSemTabela] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await diagnosticoDaBusca({
          data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
        });
        if (res.ok) setD(res);
        else setSemTabela(true);
      } catch {
        setSemTabela(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFn]);

  if (semTabela) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 text-amber-900 shadow-[var(--shadow-card)]">
        <p className="font-medium">🔎 Busca por significado</p>
        <p className="mt-1 text-sm leading-relaxed">
          Não consigo medir ainda — falta rodar{" "}
          <code className="rounded bg-amber-100 px-1">supabase/APLICAR_USO_IA.sql</code> e{" "}
          <code className="rounded bg-amber-100 px-1">supabase/APLICAR_PENDENTES.sql</code> no
          Supabase. Sem eles, a busca cai no ranking por palavras e nenhuma resposta pode levar o
          seu nome.
        </p>
      </div>
    );
  }
  if (!d) return null;

  /* SEM BASE, NENHUM NÚMERO QUER DIZER ALGO. Um cérebro vazio tem 0 assinadas e
     0 cegas — os mesmos números de um cérebro perfeito sem uso. */
  if (d.entradas === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="font-medium">🔎 Busca por significado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ainda não há nada na sua base para encontrar. Responda uma pergunta na fila ou adicione
          uma entrada — a partir da primeira, este card passa a medir.
        </p>
      </div>
    );
  }

  const desligada = d.comNumero === 0 && d.respostas > 0;
  const pctCegas = d.entradas > 0 ? Math.round((d.cegas / d.entradas) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">🔎 Busca por significado</p>

      {desligada ? (
        /* O ESTADO QUE CUSTA CARO, e o único em que o card grita. Não é um
           aviso de configuração: é a explicação de por que o trabalho dele
           parece não valer nada para a paciente. */
        <div className="mt-2 rounded-xl border border-rose-300 bg-rose-50/70 px-3 py-2.5 text-sm leading-relaxed text-rose-900">
          <strong>Está desligada.</strong> Nenhuma das {d.respostas} respostas deste ciclo conseguiu
          comparar a pergunta da paciente com o seu material por significado — só por palavra exata.
          Por isso <em>“pode comer comida japonesa?”</em> não encontra a sua orientação sobre peixe
          cru, e a IA diz que registrou a dúvida para você mesmo quando você já respondeu.
          <br />
          <span className="mt-1 inline-block">
            Abra <strong>Base de conhecimento</strong> logo abaixo e deixe a aba aberta: ela prepara
            20 entradas por visita.
          </span>
        </div>
      ) : d.cegas > 0 ? (
        <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50/70 px-3 py-2.5 text-sm leading-relaxed text-amber-900">
          <strong>
            {d.cegas} de {d.entradas} entradas ({pctCegas}%) ainda não são encontráveis
          </strong>{" "}
          por significado. O que estiver nelas só aparece se a paciente usar as mesmas palavras.
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Funcionando — toda a sua base está encontrável por significado.
        </p>
      )}

      {d.comNumero > 0 && (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="bg-emerald-500"
              style={{ width: `${(d.assinadas / d.comNumero) * 100}%` }}
            />
            <div
              className="bg-amber-400"
              style={{ width: `${(d.faixaDoMeio / d.comNumero) * 100}%` }}
            />
            <div
              className="bg-slate-300"
              style={{ width: `${(d.semNada / d.comNumero) * 100}%` }}
            />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-[11px] text-muted-foreground">com o seu nome</dt>
              <dd className="text-lg font-semibold tabular-nums text-emerald-600">{d.assinadas}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">usaram, sem assinar</dt>
              <dd className="text-lg font-semibold tabular-nums text-amber-600">{d.faixaDoMeio}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">nada parecido</dt>
              <dd className="text-lg font-semibold tabular-nums text-muted-foreground">
                {d.semNada}
              </dd>
            </div>
          </dl>
          {/* A COLUNA DO MEIO É A QUE GERA A DÚVIDA DELE. Sem esta linha, ver
              "usaram, sem assinar: 7" não explica por que sete pacientes
              ouviram "registrei sua pergunta" sobre coisas que ele escreveu. */}
          {d.faixaDoMeio > 0 && (
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              As do meio casaram de assunto, mas não o bastante para eu afirmar que aquela é a
              conduta que <strong>você</strong> daria àquela pergunta. Nelas o seu material entra na
              resposta, sem o seu nome, e a dúvida vai para a sua fila. Confirmando uma vez, a
              próxima igual já sai assinada.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Nível do Cérebro — score de completude 0–100 com visual tecnológico
 * (anel neural pulsante, grade de circuito, scanline) e o checklist exato
 * do que preencher para subir. Gamifica a configuração do Segundo Cérebro.
 */
function BrainLevelCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [items, setItems] = useState<BrainScoreItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  /* OS TILES VIERAM PARA CÁ. Eram um card separado logo abaixo — dois placares
     na mesma faixa respondendo "como está o meu cérebro" com números
     diferentes, e o médico tendo que decidir qual era o verdadeiro. */
  const [stats, setStats] = useState<{
    hitsMonth: number;
    gapsOpen: number;
    coveragePct: number | null;
    satisfactionPct: number | null;
    feedbackCount: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getBrainQualityStats({
          data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
        });
        if (res.ok) setStats(res);
      } catch {
        /* os números são enriquecimento — sem eles, o anel continua de pé */
      }
    })();
  }, [tokenFn]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getBrainScore({
          data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
        });
        if (res.ok) {
          setScore(res.score);
          setItems(res.items);
        } else setFailed(true);
      } catch {
        setFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFn]);

  if (failed) return null;

  const pct = score ?? 0;
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const level =
    pct >= 90 ? "Elite" : pct >= 70 ? "Avançado" : pct >= 40 ? "Em treino" : "Iniciante";
  const pending = items.filter((i) => !i.done);

  return (
    <div className="brain-tech relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-card)]">
      {/* Grade de circuito estática — sem varredura em movimento (conforto visual) */}
      <div className="brain-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex flex-wrap items-center gap-6">
        {/* Anel de score */}
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="brain-ring h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="rgba(148,163,184,0.2)"
              strokeWidth="9"
            />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="url(#brainGrad)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC - (CIRC * pct) / 100}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
            />
            <defs>
              <linearGradient id="brainGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold tabular-nums">
              {score == null ? "…" : pct}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
              / 100
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300/90">
            Nível do Segundo Cérebro
          </p>
          {/* O rótulo também não pode mentir enquanto carrega. A FRASE abaixo
              foi consertada e este `{level}` ficou: com `pct = score ?? 0`, um
              médico com score 95 lia "Iniciante" em corpo 2xl por um beat. */}
          <p className="mt-1 font-serif text-2xl">
            {score == null ? "—" : level}
            {score != null && pct >= 90 && " 🏆"}
          </p>
          {/* A FRASE MAIS ERRADA POSSÍVEL NO PRIMEIRO CARD DA TELA.
              `items` começa `[]`, então `pending.length === 0` é verdadeiro
              durante TODO o carregamento — e o card afirmava "Cérebro
              completo" ao mesmo tempo em que o anel mostrava "…/100" e o
              título dizia "Iniciante". Um médico no primeiro acesso lia que o
              cérebro dele estava pronto.
              `score == null` é o sinal de que ainda não chegou nada; é o mesmo
              que o anel já usa duas linhas acima. */}
          <p className="mt-1 text-sm text-white/70">
            {score == null
              ? "Conferindo o estado do seu cérebro…"
              : pending.length === 0
                ? "Cérebro completo — continue respondendo lacunas para mantê-lo afiado."
                : `${pending.length} ${pending.length === 1 ? "item pendente" : "itens pendentes"} para evoluir o cérebro.`}
          </p>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20"
          >
            {expanded ? "Ocultar checklist" : "Como subir o score →"}
          </button>
        </div>
      </div>

      {/* ─── OS NÚMEROS DO MÊS, no mesmo card do anel ─────────────────────
          Eram um placar SEPARADO logo abaixo: dois cards na mesma faixa
          respondendo "como está o meu cérebro" com números diferentes, e o
          médico tendo que decidir qual era o verdadeiro. O anel é a nota; estes
          três são de onde ela vem.
          Só aparecem quando há sinal — num cérebro novo eles seriam três zeros
          repetindo o que o anel já disse. */}
      {stats && (stats.hitsMonth > 0 || stats.feedbackCount > 0) && (
        <div className="relative mt-5 grid grid-cols-3 gap-3">
          {[
            {
              v: stats.coveragePct != null ? `${stats.coveragePct}%` : "—",
              r: "Dúvidas que o cérebro cobriu",
            },
            {
              v: stats.satisfactionPct != null ? `${stats.satisfactionPct}%` : "—",
              r: "Satisfação (👍)",
            },
            { v: String(stats.hitsMonth), r: "Respostas com o seu conhecimento" },
          ].map((t) => (
            <div
              key={t.r}
              className="rounded-2xl border border-white/15 bg-white/[0.07] p-3 text-center"
            >
              <p className="font-serif text-2xl leading-none">{t.v}</p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/60">
                {t.r}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Checklist do que preencher para subir o score */}
      {expanded && (
        <div className="relative mt-5 space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
            O que falta para o cérebro evoluir
          </p>
          {items.map((it) => (
            <div
              key={it.key}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                it.done
                  ? "border-emerald-300/30 bg-emerald-400/10"
                  : "border-white/15 bg-white/[0.07]"
              }`}
            >
              <span className="mt-0.5 text-base leading-none">{it.done ? "✅" : "⬜"}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${it.done ? "text-white/70" : "text-white"}`}>
                  {it.label}
                </p>
                {!it.done && (
                  <p className="mt-1 text-[13px] leading-snug text-white/80">{it.hint}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
                  it.done ? "bg-emerald-400/25 text-emerald-100" : "bg-cyan-400/15 text-cyan-100"
                }`}
              >
                {it.done ? "✓ " : "+"}
                {it.done ? it.points : it.points - it.earned} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * COMECE POR AQUI — a tela do médico que abriu o Cérebro pela primeira vez.
 *
 * A ordem dos cards está certa para o cérebro MADURO: trabalho, depois estado,
 * depois ferramentas. Para o primeiro acesso ela era o pior arranjo possível —
 * e o primeiro acesso virou a primeira tela do produto quando o Cérebro passou
 * a ser a aba de entrada.
 *
 * O que ele lia, na ordem: "nenhuma lacuna aberta — o cérebro cobriu tudo que
 * perguntaram ✅", "nenhuma resposta reprovada", "tudo respondido por aqui 🎉",
 * um anel zerado e "nenhuma resposta ainda neste ciclo". **Três caixas verdes
 * de "nada a fazer" e um zero**, num cérebro que nunca foi treinado. Lê-se
 * "está pronto", e as três ações que de fato começam o produto estavam abaixo
 * da dobra ou escondidas num botão de 12px.
 *
 * Some sozinho assim que existe qualquer conhecimento aprovado — não é
 * onboarding com "pular", é a ausência de conteúdo falando por si.
 */
function ComecePorAqui({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  asDoctor?: string;
}) {
  const [novo, setNovo] = useState<boolean | null>(null);
  const [instalando, setInstalando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await listBrainEntries({
        data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
      });
      /* APROVADAS, não "existe alguma linha": o kit de partida entra como
         rascunho, e um cérebro com 33 rascunhos e nada aprovado é exatamente
         um cérebro que ainda não começou. */
      setNovo(res.ok ? !res.entries.some((e) => e.approved) : false);
    } catch {
      /* Na dúvida, não aparece: um bloco de boas-vindas para quem já trabalhou
         é pior que nenhum. */
      setNovo(false);
    }
  }, [tokenFn, asDoctor]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (novo !== true) return null;

  const passo = "flex items-start gap-3 rounded-2xl border border-border bg-card p-4";
  const numero =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground";

  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
      <p className="font-serif text-xl">👋 Comece por aqui</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Seu cérebro ainda não tem nenhuma resposta aprovada — então as caixas verdes abaixo dizem
        &ldquo;nada pendente&rdquo; porque ninguém perguntou nada ainda, não porque está pronto.
        Três passos e a IA passa a falar como {asDoctor ? "ele" : "você"}.
      </p>

      <div className="mt-4 space-y-2">
        <div className={passo}>
          <span className={numero}>1</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Diga como você fala</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              É o que muda o tom de toda resposta. Fica no card <strong>Estilo do médico</strong>,
              no fim desta aba.
            </p>
          </div>
        </div>

        <div className={passo}>
          <span className={numero}>2</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Instale 30 dúvidas clássicas</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Entram como rascunho: você edita no seu estilo e aprova o que quiser. Nada vai para as
              pacientes sem o seu aval.
            </p>
            <button
              type="button"
              disabled={instalando}
              onClick={async () => {
                setInstalando(true);
                try {
                  const res = await installStarterPack({
                    data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
                  });
                  if (res.ok) {
                    toast.success(
                      `${res.installed} dúvidas instaladas como rascunho — revise e aprove na Base de conhecimento 👇`,
                    );
                    carregar();
                  } else toast.error("Não consegui instalar agora. Tente de novo.");
                } catch {
                  toast.error("Não consegui instalar agora. Tente de novo.");
                } finally {
                  setInstalando(false);
                }
              }}
              className="press mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {instalando ? "Instalando…" : "Instalar agora"}
            </button>
          </div>
        </div>

        <div className={passo}>
          <span className={numero}>3</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Grave uma consulta</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A IA extrai as suas orientações do áudio e escreve os rascunhos na sua voz. Fica em{" "}
              <strong>Consulta vira conhecimento</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * O CONSUMO DE IA DO MÉDICO — quanto do ciclo já foi usado, e por quem.
 *
 * Card PRÓPRIO, e essa é a correção mais importante dele: viveu dentro do
 * `BrainScoreCard`, que devolve `null` quando as tabelas de telemetria não
 * respondem. Em produção, com migrations pendentes, o médico simplesmente não
 * via consumo nenhum — e não havia erro para explicar por quê.
 *
 * Ele não pode descobrir o limite pelo EFEITO: a paciente recebendo resposta
 * sem a voz dele é a pior forma de saber, porque ele não vê a conversa e ela
 * não sabe que algo mudou.
 */
function ConsumoDaIACard({
  tokenFn,
  asDoctor,
  onAbrirPaciente,
  onIrParaPlanos,
}: {
  tokenFn: () => Promise<string>;
  asDoctor?: string;
  /** Abre o prontuário daquela paciente — sem isto a lista é só um relatório. */
  onAbrirPaciente?: (patientId: string) => void;
  /** A ÚNICA ação que resolve a cota estourada não tinha porta: o texto dizia
      "ou se você subir de plano" sem link, botão ou aba. O `TrancadoCard`
      vizinho já tem essa ponte; este não tinha. */
  onIrParaPlanos?: () => void;
}) {
  const [cota, setCota] = useState<{
    usadas: number;
    teto: number | null;
    estado: "ok" | "aviso" | "estourada";
    falha?: "rede" | "migracao" | null;
    pacientes?: { patientId: string; nome: string; respostas: number; fatia: number }[];
  } | null>(null);
  /** A leitura em si falhou (não a medição): sem isto, o card fica em esqueleto para sempre. */
  const [naoCarregou, setNaoCarregou] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await cotaDeRespostas({
          data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
        });
        if (res.ok && "estado" in res) setCota(res);
        else setNaoCarregou(true);
      } catch {
        /* ESQUELETO ETERNO era o comportamento antigo: `cota` ficava `null`
           para sempre, sem retry e sem texto. */
        setNaoCarregou(true);
      }
    })();
    /* `asDoctor` NAS DEPENDÊNCIAS. O efeito lê essa prop, e o componente é
       montado sem `key`: no plano Clínica, trocar de médico ("ver como") não
       remontava nada e o card seguia mostrando o consumo do médico ANTERIOR —
       número de plano atribuído à pessoa errada. */
  }, [tokenFn, asDoctor]);

  /* ESTADOS EXPLÍCITOS, e isto é conserto de um silêncio.
     Era `if (!cota || cota.usadas <= 0) return null` — e `respostasNoCiclo`
     devolve 0 quando a tabela `ai_usage` não existe (migration pendente). Ou
     seja: o card sumia exatamente no cenário que o refator dele veio corrigir,
     só que por outro caminho. "Não tenho como medir" e "você não usou nada"
     não podem produzir a mesma tela. */
  if (naoCarregou) {
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
        Não consegui medir o consumo agora.{" "}
        <button type="button" onClick={() => window.location.reload()} className="underline">
          Tentar de novo
        </button>
      </p>
    );
  }
  if (cota === null) {
    return <div className="skeleton h-24 rounded-3xl" />;
  }
  if (cota.falha) {
    /* Mediu e não conseguiu — diferente de "não usou". */
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-xs leading-snug text-amber-900">
        {cota.falha === "migracao" ? (
          <>
            Não consigo medir o consumo: falta a tabela de uso no banco. Rode{" "}
            <code>supabase/APLICAR_USO_IA.sql</code> no SQL Editor do Supabase.
          </>
        ) : (
          <>O banco não respondeu agora — o número do mês pode estar incompleto.</>
        )}
      </p>
    );
  }

  const temTeto = cota.teto != null && cota.teto > 0;
  const pct = temTeto ? Math.min(100, Math.round((cota.usadas / (cota.teto as number)) * 100)) : 0;

  if (cota.usadas <= 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Respostas da IA neste mês
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhuma resposta ainda neste ciclo
          {temTeto ? ` — seu plano dá ${cota.teto} por mês.` : "."}
        </p>
      </div>
    );
  }

  /* ─── VOU ESTOURAR ANTES DO FIM DO MÊS? ─────────────────────────────────
     A barra respondia "quanto usei"; esta é a pergunta seguinte, e a única
     acionável — subir de plano no dia 10 é decisão, descobrir no dia 30 é
     constatação. Regra de três sobre o ritmo do ciclo, no fuso de Brasília
     (mesmo de `inicioDoCiclo`, senão a projeção vira no dia errado). */
  const hojeSP = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const parteSP = (t: string) => Number(hojeSP.find((p) => p.type === t)?.value ?? 0);
  const diaDoCiclo = Math.max(1, parteSP("day"));
  const diasDoMes = new Date(Date.UTC(parteSP("year"), parteSP("month"), 0)).getUTCDate();
  const projecao = Math.round((cota.usadas / diaDoCiclo) * diasDoMes);
  /* Piso de 5 dias: no dia 1, a regra de três multiplica ruído por 31 — vinte
     respostas viram "você chega a ~620 das 500", o que é chute com cara de
     medida. */
  const vaiEstourar =
    temTeto && diaDoCiclo >= 5 && projecao > (cota.teto as number) && cota.estado !== "estourada";
  /* A barra de cada paciente é proporcional à MAIOR, não ao total.
     Proporcional ao total, numa fila de cinquenta gestantes, a maior fatia dá
     ~12% da largura e todas as outras colapsam no piso — seis barrinhas do
     mesmo tamanho, que é precisamente a comparação que o card existe para
     fazer. A porcentagem do total continua escrita ao lado, em número. */
  const maior = Math.max(1, ...(cota.pacientes ?? []).map((p) => p.respostas));

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Respostas da IA neste mês
        </p>
        <p className="text-sm tabular-nums">
          <strong>{cota.usadas}</strong>
          {/* Plano ilimitado também vê o próprio consumo. Antes o card exigia
              teto, então justamente quem paga mais não enxergava nada. */}
          <span className="text-muted-foreground">
            {temTeto ? ` de ${cota.teto}` : " · plano sem limite"}
          </span>
        </p>
      </div>

      {temTeto && (
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              cota.estado === "estourada"
                ? "bg-destructive"
                : cota.estado === "aviso"
                  ? "bg-amber-500"
                  : "bg-primary"
            }`}
            /* Teto de 100% na largura: passar do limite não pode fazer a barra
               vazar do card. O número ao lado continua contando a verdade. */
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {vaiEstourar && (
        <p className="mt-2 text-xs text-amber-700">
          No seu ritmo, você chega a <strong>~{projecao}</strong> das {cota.teto} até o fim do mês.
        </p>
      )}

      {/* QUEM está consumindo. O total responde "quanto"; esta lista responde a
          pergunta seguinte, que é a que ele de fato faz. Numa fila de cinquenta
          gestantes, três costumam responder por metade das conversas — e saber
          quais são muda o que ele faz: pode ser ansiedade que pede consulta, ou
          uma dúvida recorrente que vale virar entrada do cérebro. */}
      {!!cota.pacientes?.length && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quem mais conversou
          </p>
          {/* Dois denominadores na mesma linha pediam reconciliação toda vez:
              a barra compara com quem mais conversou, o número é a fatia do
              mês. Uma legenda custa uma linha. */}
          <p className="text-[10px] leading-snug text-muted-foreground">
            A barra compara com quem mais conversou; a porcentagem é a fatia do mês.
            {onAbrirPaciente ? " Toque para abrir o prontuário." : ""}
          </p>
          {cota.pacientes.map((p) => {
            /* A COR DIZ ALGUMA COISA — mas NÃO a mesma coisa que a barra de
               cima. Vermelho e âmbar significam "cota estourada" e "cota em
               aviso" a 40px daqui; reusá-los aqui faria "Maria em vermelho"
               ler como "Maria tem algo errado", quando é o contrário: ela
               conversa muito, o que é engajamento.
               Escala sequencial própria (índigo → violeta): ordena sem alarmar. */
            const cor =
              p.fatia >= 0.4
                ? "bg-violet-600"
                : p.fatia >= 0.25
                  ? "bg-indigo-500"
                  : "bg-primary/60";
            return (
              /* CLICÁVEL. `patientId` é o `auth.users.id` — exatamente o que
                 `setAbrirPaciente` espera. A ponte não estava ligada: o card
                 mostrava "Maria — 87 · 31%" e o médico ia procurar Maria pelo
                 nome na aba Pacientes. É a diferença entre relatório e
                 ferramenta. */
              <button
                type="button"
                key={p.patientId}
                disabled={!onAbrirPaciente}
                onClick={() => onAbrirPaciente?.(p.patientId)}
                className={`flex w-full items-center gap-3 rounded-lg py-0.5 text-left transition-colors ${
                  onAbrirPaciente ? "hover:bg-secondary/60" : "cursor-default"
                }`}
              >
                <span className="w-28 shrink-0 truncate text-xs" title={p.nome}>
                  {p.nome}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className={`block h-full rounded-full ${cor}`}
                    /* Piso de 4%: uma paciente com 1 de 300 respostas
                       desenharia uma barra invisível, e barra invisível diz
                       "zero" quando o número diz "um". */
                    style={{ width: `${Math.max(4, Math.round((p.respostas / maior) * 100))}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {p.respostas} · {Math.round(p.fatia * 100)}%
                </span>
              </button>
            );
          })}
          {/* FECHA A SOMA. Seis linhas somando 58% deixavam o médico sem saber
              se tinha visto tudo — e sem nada dizendo que a lista é um recorte. */}
          {(() => {
            const somaFatias = cota.pacientes.reduce((a, p) => a + p.fatia, 0);
            const resto = Math.round((1 - somaFatias) * 100);
            return resto >= 1 ? (
              <p className="pt-0.5 text-[11px] text-muted-foreground">
                Outras pacientes · {resto}%
              </p>
            ) : null;
          })()}
        </div>
      )}

      {temTeto && cota.estado !== "ok" && (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
            cota.estado === "estourada"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-amber-400/40 bg-amber-50 text-amber-900"
          }`}
        >
          {cota.estado === "estourada" ? (
            <>
              <strong>Cota do mês esgotada</strong> ({cota.usadas} de {cota.teto} respostas). Suas
              pacientes continuam sendo atendidas, mas <strong>sem as suas orientações</strong> —
              elas voltam na virada do mês ou se você subir de plano.
              {onIrParaPlanos && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={onIrParaPlanos}
                    className="font-semibold underline"
                  >
                    Ver planos →
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              Você usou{" "}
              <strong>
                {cota.usadas} das {cota.teto}
              </strong>{" "}
              respostas deste mês. Ao esgotar, suas pacientes continuam atendidas, porém sem as suas
              orientações.
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A FILA DE REVISÃO — respostas que a IA SOUBE dar e a paciente reprovou.
 *
 * É a irmã da fila de lacunas, e a diferença entre as duas é a diferença entre
 * ENSINAR e CORRIGIR. Antes elas eram a mesma: todo 👎 virava "a IA não soube
 * responder", inclusive quando ela sabia — e o médico, ao respondê-lo, criava
 * uma SEGUNDA entrada sobre o mesmo assunto, deixando a errada aprovada e
 * competindo com a nova na busca.
 *
 * Por isso o card mostra as TRÊS coisas: o que ela perguntou, o que ela LEU, e
 * o que está aprovado hoje. Sem a resposta que ela leu, o médico revisaria no
 * escuro.
 */
function BrainReviewCard({
  tokenFn,
  asDoctor,
  onContar,
}: {
  tokenFn: () => Promise<string>;
  asDoctor?: string;
  /** Reporta quantos itens esta fila tem — a faixa soma os três. */
  onContar?: (n: number) => void;
}) {
  const [itens, setItens] = useState<
    {
      id: string;
      question: string;
      answer: string | null;
      entryQuestion: string | null;
      entryAnswer: string | null;
    }[]
  >([]);
  const [editando, setEditando] = useState<string | null>(null);
  /* Distingue "não deu para olhar" de "não há nada" — ver `carregar`. */
  const [falhou, setFalhou] = useState<"rede" | "migracao" | null>(null);
  /* `itens` nasce `[]`, então o primeiro paint dizia "nenhuma resposta
     reprovada" ANTES de saber — a mesma classe de defeito que o card de nível
     acabou de consertar, no card vizinho. */
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    try {
      const tk = await tokenFn();
      const res = await listBrainReviews({
        data: { accessToken: tk, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (res.ok) {
        setItens(res.itens);
        onContar?.(res.itens.length);
        setFalhou(null);
        setCarregando(false);
      } else {
        /* ERRO NÃO PODE SE DISFARÇAR DE FILA VAZIA.
           `res.ok === false` era descartado e o card caía no estado "nenhuma
           resposta reprovada ✅" — dizendo ao médico que está tudo bem quando
           na verdade não deu para olhar. O irmão `BrainGapsCard` distingue
           "migracao" de "rede" justamente porque, nas palavras do comentário
           dele, isso "não pode se disfarçar de 'nenhuma lacuna ✅'". E o
           servidor JÁ devolve `semTabela` — o campo existia sem consumidor. */
        setFalhou("semTabela" in res && res.semTabela ? "migracao" : "rede");
      }
    } catch {
      setFalhou("rede");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolver(id: string, novaResposta?: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const tk = await tokenFn();
      const res = await resolveBrainReview({
        data: {
          accessToken: tk,
          reviewId: id,
          ...(novaResposta ? { answer: novaResposta } : {}),
          ...(asDoctor ? { asDoctor } : {}),
        },
      });
      if (!res.ok) {
        toast.error("Não consegui salvar. Tente de novo.");
        return;
      }
      /* O `avisada` do servidor era JOGADO FORA. O toast dizia "corrigido"
         mesmo quando a paciente NÃO foi avisada — ela trocou de médico, ou o
         push falhou —, e o médico ficava achando que tinha fechado o ciclo com
         quem reclamou. Dizer a verdade custa uma frase. */
      const corrigiu = "corrigida" in res && res.corrigida;
      const avisou = "avisada" in res && res.avisada;
      toast.success(
        corrigiu
          ? avisou
            ? "Corrigido — a IA já responde com o texto novo, e a paciente foi avisada 🧠"
            : "Corrigido — a IA já responde com o texto novo. Não consegui avisar a paciente desta vez."
          : "Confirmado. A resposta continua como está.",
      );
      setEditando(null);
      setTexto("");
      setItens((v) => v.filter((x) => x.id !== id));
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  /* FILA VAZIA VIRA UMA LINHA, NÃO O NADA.
     Era `return null`, e o custo disso era o item que o médico pediu: ele
     achava a aba confusa, e a distinção entre ENSINAR (lacuna) e CORRIGIR
     (revisão) só era ensinada a quem já tivesse item na fila. Como a fila de
     revisão é a rara das duas, dava para usar o Cérebro por meses sem
     descobrir que ela existe — enquanto a de lacunas aparece sempre, com
     estado vazio explicativo. Assimetria pura.
     Uma linha discreta não é "caixa vazia": é o nome da coisa. */
  if (carregando) return <div className="skeleton h-16 rounded-2xl" />;

  if (falhou) {
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-xs leading-snug text-amber-900">
        {falhou === "migracao" ? (
          <>
            ✋ <strong>Revisão</strong> — a fila existe, mas o banco ainda não tem as colunas dela.
            Rode <code>supabase/APLICAR_REVISAO.sql</code> no SQL Editor do Supabase.
          </>
        ) : (
          <>
            ✋ <strong>Revisão</strong> — não consegui carregar agora.{" "}
            <button type="button" onClick={carregar} className="underline">
              Tentar de novo
            </button>
          </>
        )}
      </p>
    );
  }

  if (!itens.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
        ✋ <strong>Revisão</strong> — nenhuma resposta reprovada. Quando uma paciente marcar 👎 numa
        resposta que saiu do <em>seu</em> conhecimento, ela aparece aqui para você corrigir o texto
        (é diferente da fila de lacunas, que é o que a IA não soube responder).
      </p>
    );
  }

  return (
    <div className="rounded-3xl border border-amber-400/50 bg-amber-50/60 p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-xl">
        ✋ Respostas que uma paciente não achou úteis{" "}
        <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 align-middle text-xs font-semibold text-white">
          {itens.length}
        </span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Aqui a IA <strong>sabia</strong> responder e usou o seu conhecimento — mas a paciente marcou
        👎. Corrija o texto e a IA passa a responder do jeito novo na hora; ou confirme, se a
        resposta estava certa.
      </p>

      <div className="mt-4 space-y-3">
        {itens.map((it) => (
          <div key={it.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">&ldquo;{it.question}&rdquo;</p>

            {it.answer && (
              <div className="mt-2 rounded-xl bg-secondary/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  O que ela leu
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {it.answer}
                </p>
              </div>
            )}

            {/* A TERCEIRA COISA. O comentário deste card diz que ele mostra as
                três — pergunta, o que ela leu, e o que está aprovado hoje — e
                mostrava duas: a entrada de origem era buscada, tipada e nunca
                renderizada. Sem ela o médico não sabe QUAL texto do cérebro
                dele produziu aquilo, que é justamente o que ele vai corrigir. */}
            {it.entryQuestion && editando !== it.id && (
              <p className="mt-2 text-xs text-muted-foreground">
                Veio da sua entrada: <em>&ldquo;{it.entryQuestion}&rdquo;</em>
              </p>
            )}

            {editando === it.id ? (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  A sua resposta, corrigida
                </p>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ocupado || texto.trim().length < 5}
                    onClick={() => resolver(it.id, texto.trim())}
                    className="press rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Salvar correção
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(null);
                      setTexto("");
                    }}
                    className="rounded-full border border-border px-5 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditando(it.id);
                    /* Abre com o texto APROVADO, não com o que ela leu: é a
                       entrada que vai ser gravada, e partir dela evita que uma
                       edição rápida sobrescreva o conhecimento com a versão
                       que a própria paciente reprovou. */
                    setTexto(it.entryAnswer ?? it.answer ?? "");
                  }}
                  className="press rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Corrigir resposta
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => resolver(it.id)}
                  className="rounded-full border border-border px-5 py-2 text-sm disabled:opacity-50"
                >
                  Está certa, manter
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Fila de lacunas — o coração do autoaprendizado: perguntas reais que a IA
 * NÃO soube cobrir (ou que receberam 👎 da paciente), deduplicadas e ordenadas
 * pelas mais perguntadas. O médico responde aqui e vira conhecimento aprovado
 * na hora.
 */
/**
 * Há quanto tempo a primeira paciente está esperando.
 *
 * Texto e não número puro: "há 26 dias" pesa, "26" não. Hoje some — dizer "há
 * 0 dias" numa dúvida de agora seria ruído em toda linha nova da fila.
 */
function esperaDe(criadaEm?: string | null): string {
  if (!criadaEm) return "";
  const dias = Math.floor((Date.now() - new Date(criadaEm).getTime()) / 86_400_000);
  if (!Number.isFinite(dias) || dias <= 0) return "";
  return dias === 1 ? " · há 1 dia" : ` · há ${dias} dias`;
}

function BrainGapsCard({
  tokenFn,
  asDoctor,
  onContar,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
  /** Reporta quantos itens esta fila tem — a faixa soma os três. */
  onContar?: (n: number) => void;
}) {
  const [gaps, setGaps] = useState<BrainGap[]>([]);
  /* As IGNORADAS que continuaram sendo perguntadas. Lista separada de
     propósito: misturá-las com a fila desfaria a decisão dele sem avisar. */
  const [voltaram, setVoltaram] = useState<LacunaQueVoltou[]>([]);
  const [reabrindo, setReabrindo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Erro/tabela ausente NÃO pode se disfarçar de "nenhuma lacuna ✅"
  const [loadError, setLoadError] = useState<"rede" | "migracao" | null>(null);
  const [answering, setAnswering] = useState<string | null>(null); // gapId aberto
  const [answer, setAnswer] = useState("");
  // Pergunta editável: a lacuna chega com o texto CRU da paciente (pode ter
  // nome/dados pessoais) — o médico generaliza antes de virar conhecimento.
  const [editedQuestion, setEditedQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  /* ─── RESPONDER SÓ PARA ELA ─────────────────────────────────────────────
     A mesma alavanca que a aba Perguntas já tinha, com o padrão INVERTIDO: lá
     o caso comum é a dúvida específica de uma paciente, aqui é a dúvida que
     várias fizeram. O padrão segue o caso comum, não a simetria. */
  const [soParaEla, setSoParaEla] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState<string | null>(null); // gapId com rascunho da IA

  async function draft(gapId: string) {
    if (drafting) return;
    setDrafting(true);
    try {
      const tk = await tokenFn();
      const res = await draftGapAnswer({
        data: { accessToken: tk, gapId, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "reason" in res && res.reason === "config"
              ? "IA não configurada nesta instalação."
              : "Não foi possível gerar o rascunho — escreva manualmente.",
        );
        return;
      }
      setAnswer(res.draft);
      setDrafted(gapId);
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setDrafting(false);
    }
  }

  async function load() {
    try {
      const tk = await tokenFn();
      const res = await listBrainGaps({
        data: { accessToken: tk, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (res.ok) {
        setGaps(res.gaps);
        setVoltaram(("voltaram" in res ? res.voltaram : []) ?? []);
        onContar?.(res.gaps.length);
        setLoadError(null);
        /* Lacuna sem vetor não agrupa nem é agrupada, e toda lacuna anterior à
           migration nasceu assim. A cura vai numa requisição SEPARADA de
           propósito: a lista já está na tela, e é a requisição dela que mantém
           o trabalho vivo em serverless — dentro do `listBrainGaps` a cura
           tinha que caber no instante do carregamento, e era isso que a fazia
           falhar em bloco. Ninguém espera por ela. */
        void curarLacunasDoMedico({
          data: { accessToken: tk, ...(asDoctor ? { asDoctor } : {}) },
        }).catch(() => {});
      } else if ("missingTable" in res && res.missingTable) {
        setLoadError("migracao");
      } else {
        setLoadError("rede");
      }
    } catch {
      setLoadError("rede");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(gapId: string) {
    if (answer.trim().length < 5 || busy) return;
    setBusy(true);
    try {
      const tk = await tokenFn();
      const q = editedQuestion.trim();
      const res = await resolveBrainGap({
        data: {
          accessToken: tk,
          gapId,
          answer: answer.trim(),
          ...(q.length >= 8 ? { question: q.slice(0, 300) } : {}),
          ...(soParaEla ? { soParaEla: true } : {}),
          ...(asDoctor ? { asDoctor } : {}),
        },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "Não foi possível salvar — tente novamente.",
        );
        return;
      }
      /* Diz quantas parecidas saíram junto. Sem isso, três linhas somem da
         fila e o médico fica sem saber se respondeu ou se perdeu alguma. */
      const juntas = "parecidas" in res && typeof res.parecidas === "number" ? res.parecidas : 0;
      toast.success(
        juntas > 0
          ? `Respondida e aprendida 🧠 — ${juntas} pergunta${juntas > 1 ? "s" : ""} parecida${juntas > 1 ? "s" : ""} também ${juntas > 1 ? "foram respondidas" : "foi respondida"}`
          : "Respondida e aprendida pelo cérebro 🧠",
      );
      setAnswering(null);
      setDrafted(null);
      setAnswer("");
      setEditedQuestion("");
      setGaps((gs) => gs.filter((g) => g.id !== gapId));
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(gapId: string) {
    if (dismissingId) return;
    setDismissingId(gapId);
    try {
      const tk = await tokenFn();
      const res = await dismissBrainGap({
        data: { accessToken: tk, gapId, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (res.ok) setGaps((gs) => gs.filter((g) => g.id !== gapId));
      else toast.error("Não foi possível ignorar.");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setDismissingId(null);
    }
  }

  async function reabrir(gapId: string) {
    if (reabrindo) return;
    setReabrindo(gapId);
    try {
      const tk = await tokenFn();
      const res = await reabrirLacuna({
        data: { accessToken: tk, gapId, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (res.ok) {
        setVoltaram((vs) => vs.filter((v) => v.id !== gapId));
        await load();
      } else toast.error("Não foi possível trazer de volta.");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setReabrindo(null);
    }
  }

  async function installKit() {
    setInstalling(true);
    try {
      const tk = await tokenFn();
      const res = await installStarterPack({
        data: { accessToken: tk, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "Não foi possível instalar o kit.",
        );
        return;
      }
      if ("already" in res && res.already) toast("O kit de partida já está instalado.");
      else
        toast.success(
          `${res.installed} dúvidas clássicas instaladas como rascunho — revise e aprove na Base de conhecimento 👇`,
        );
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="rounded-3xl border border-amber-300/60 bg-amber-50/40 p-6 shadow-[var(--shadow-card)] dark:bg-amber-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-xl">
            🕳️ O que a IA não soube responder
            {gaps.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {gaps.length}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Perguntas reais das suas pacientes sem cobertura no cérebro (ou com 👎). Responda e a IA
            aprende na hora — sempre com a sua aprovação.
          </p>
        </div>
        <button
          onClick={installKit}
          disabled={installing}
          title="Instala ~30 dúvidas clássicas do pré-natal como rascunho para você revisar"
          className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {installing ? "Instalando…" : "📦 Instalar kit de partida"}
        </button>
      </div>

      {loading ? (
        <div className="skeleton mt-4 h-20 rounded-2xl" />
      ) : loadError === "migracao" ? (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
          A tabela de lacunas ainda não existe no banco — rode o{" "}
          <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar o autoaprendizado.
        </p>
      ) : loadError === "rede" ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Não foi possível carregar as lacunas.{" "}
          <button onClick={load} className="font-semibold text-primary underline">
            Tentar de novo
          </button>
        </p>
      ) : gaps.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Nenhuma lacuna aberta — o cérebro cobriu tudo que perguntaram até agora. ✅
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {gaps.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium">"{g.question}"</p>
                {/* A IDADE, ao lado da repetição.
                    "3× perguntada" não distingue três pacientes ontem de três
                    ao longo de um mês — e a segunda é alguém esperando há um
                    mês por uma resposta que a IA prometeu. Sem a idade, a fila
                    ordenava por volume e a espera mais longa sumia. */}
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {g.hits}× perguntada{esperaDe(g.created_at)}
                  {g.channel === "whatsapp" ? " · WhatsApp" : ""}
                </span>
              </div>
              {answering === g.id ? (
                <div className="mt-3">
                  {/* ─── SÓ PARA ELA, OU PARA TODAS ──────────────────────────
                      A lacuna nasce de várias pacientes, então o padrão é
                      virar conhecimento. Mas o contador ao lado pode dizer
                      "1× perguntada" — e aí a resposta pode ser "pode continuar
                      o remédio que passei na consulta", que não é conduta geral
                      e não pode ser publicada no cérebro.
                      Quando é UMA só, a tela sugere; a decisão continua dele. */}
                  <label className="mb-2 flex items-start gap-2 text-[12px] leading-snug text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={soParaEla}
                      onChange={(e) => setSoParaEla(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Responder <strong>só para ela</strong> — a resposta chega a quem perguntou e
                      NÃO vira conhecimento do consultório.
                      {g.hits === 1 && !soParaEla ? (
                        <em className="ml-1 not-italic text-amber-700">
                          Só uma paciente perguntou isto — talvez seja do caso dela.
                        </em>
                      ) : null}
                    </span>
                  </label>
                  {!soParaEla && (
                    <>
                      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                        Pergunta que entra no cérebro — generalize e remova nomes/dados pessoais
                      </label>
                      <input
                        value={editedQuestion}
                        onChange={(e) => setEditedQuestion(e.target.value)}
                        maxLength={300}
                        placeholder="Ex: Posso tomar dipirona na gestação?"
                        className="mb-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </>
                  )}
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="Escreva a resposta como VOCÊ responderia à paciente… (ou gere um rascunho ✨)"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  {drafted === g.id && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      ✨ Rascunho da IA no seu estilo — revise e ajuste antes de aprovar. Nada entra
                      no cérebro sem o seu aval.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => draft(g.id)}
                      disabled={drafting}
                      title="A IA escreve um rascunho no seu estilo, usando o seu cérebro — você só revisa"
                      className="rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      {drafting ? "Gerando…" : "✨ Gerar rascunho"}
                    </button>
                    <button
                      onClick={() => resolve(g.id)}
                      disabled={busy || answer.trim().length < 5}
                      className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {busy
                        ? "Salvando…"
                        : soParaEla
                          ? "Responder só para ela"
                          : "Responder e treinar 🧠"}
                    </button>
                    <button
                      onClick={() => {
                        setAnswering(null);
                        setDrafted(null);
                        setAnswer("");
                        setEditedQuestion("");
                      }}
                      className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setAnswering(g.id);
                      setAnswer("");
                      setEditedQuestion(g.question.slice(0, 300));
                    }}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Responder
                  </button>
                  <button
                    onClick={() => dismiss(g.id)}
                    disabled={dismissingId === g.id}
                    className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {dismissingId === g.id ? "…" : "Ignorar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── IGNORADAS QUE VOLTARAM ────────────────────────────────────────
          "Ignorar" tinha virado "nunca mais": a busca por texto encontra a
          lacuna em qualquer status e incrementa `hits`, mas só `respondida`
          volta para `aberta` — e a fila lê `aberta`. Ele ignorava quando UMA
          paciente tinha perguntado e nunca mais via aquilo, enquanto cada
          paciente seguinte ouvia "registrei aqui para ele ver".
          Lista SEPARADA, e volta só com o clique dele: reabrir sozinha
          desfaria a decisão na cara dura. */}
      {voltaram.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
          <p className="text-sm font-medium text-amber-900">
            🔁 Você ignorou, e continuaram perguntando
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
            Cada uma dessas pacientes ouviu da IA que a dúvida ficou registrada para você.
          </p>
          <div className="mt-3 space-y-2">
            {voltaram.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white/70 px-3 py-2"
              >
                <p className="min-w-0 flex-1 text-sm text-foreground">{g.question}</p>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-amber-800">
                  +{g.perguntaramDepois} {g.perguntaramDepois === 1 ? "paciente" : "pacientes"}{" "}
                  depois
                </span>
                <button
                  onClick={() => reabrir(g.id)}
                  disabled={reabrindo === g.id}
                  className="shrink-0 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {reabrindo === g.id ? "…" : "Trazer de volta"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Quanto do campo já foi usado — e o aviso quando o corte está perto.
 *
 * O teto existe por dois motivos que se somam: estes três campos entram no
 * prompt em TODA mensagem (então o custo deles se paga toda vez), e são texto
 * livre do médico dentro das instruções do modelo. Sem teto, o campo mais caro
 * do prompt era justamente o único que ninguém limitava.
 *
 * O contador aparece só a partir de 70%: um número embaixo de todo campo, o
 * tempo inteiro, ensina a não olhar para ele.
 */
function ContadorDoCampo({ valor }: { valor: string }) {
  const usado = valor.length;
  if (usado < MAX_CAMPO_DO_MEDICO * 0.7) return null;
  const cheio = usado >= MAX_CAMPO_DO_MEDICO;
  return (
    <p
      className={`mt-1 text-[11px] tabular-nums ${cheio ? "text-amber-600" : "text-muted-foreground"}`}
    >
      {usado}/{MAX_CAMPO_DO_MEDICO}
      {cheio ? " — limite atingido" : ""}
    </p>
  );
}

/** Card "Estilo do médico": persona, frases típicas, regras e onde usar o cérebro. */
function BrainSettingsCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
}) {
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getBrainSettings({
        data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
      });
      if (res.ok) setSettings(res.settings);
      else toast.error("Não foi possível carregar o estilo do médico.");
    })();
  }, [tokenFn]);

  function patch(p: Partial<BrainSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await saveBrainSettings({
        data: { accessToken: await tokenFn(), settings, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (!res.ok) {
        /* O motivo importa: "não deu para salvar" e "falta o seu WhatsApp"
           pedem coisas diferentes dele, e a segunda é acionável em dez
           segundos — na aba ao lado. */
        toast.error(
          "reason" in res && res.reason === "semWhatsapp"
            ? "Preencha o WhatsApp do consultório em Meu Perfil antes de ligar a IA — é por ele que a paciente fala com você quando a IA não pode responder."
            : "Não foi possível salvar o estilo. Tente novamente.",
        );
        return;
      }
      toast.success("Estilo do médico salvo.");
    } catch {
      toast.error("Não foi possível salvar o estilo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">Estilo do médico</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Como a IA deve soar quando responde em seu nome.
      </p>

      {!settings ? (
        <div className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-secondary" />
          <div className="h-20 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Persona (quem é você e como fala)
            </label>
            <textarea
              value={settings.persona}
              onChange={(e) => patch({ persona: e.target.value })}
              maxLength={MAX_CAMPO_DO_MEDICO}
              rows={3}
              placeholder="Ex: Sou acolhedor e direto, explico com linguagem simples e sempre tranquilizo a paciente antes de orientar."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <ContadorDoCampo valor={settings.persona} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Frases típicas (uma por linha)
            </label>
            <textarea
              value={settings.sample_phrases}
              onChange={(e) => patch({ sample_phrases: e.target.value })}
              maxLength={MAX_CAMPO_DO_MEDICO}
              rows={3}
              placeholder={
                "Ex:\nFica tranquila, isso é comum na gestação.\nQualquer dúvida, estou por aqui."
              }
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <ContadorDoCampo valor={settings.sample_phrases} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Regras (o que a IA nunca deve fazer / sempre deve fazer)
            </label>
            <textarea
              value={settings.rules}
              onChange={(e) => patch({ rules: e.target.value })}
              maxLength={MAX_CAMPO_DO_MEDICO}
              rows={3}
              placeholder="Ex: Nunca indicar medicação. Em sangramento ou dor forte, orientar procurar o pronto-socorro imediatamente."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <ContadorDoCampo valor={settings.rules} />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <BrainToggle
              checked={settings.enabled_app}
              onChange={(v) => patch({ enabled_app: v })}
              label="Usar no chat do app"
            />
            <BrainToggle
              checked={settings.enabled_whatsapp}
              onChange={(v) => patch({ enabled_whatsapp: v })}
              label="Usar no WhatsApp"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar estilo"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Card "Treinar respondendo": perguntas reais das pacientes viram conhecimento. */
function BrainTrainCard({
  tokenFn,
  onTrained,
  asDoctor,
  onContar,
}: {
  tokenFn: () => Promise<string>;
  onTrained: (questionId: string) => void;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
  /** Reporta quantos itens esta fila tem — a faixa soma os três. */
  onContar?: (n: number) => void;
}) {
  const [questions, setQuestions] = useState<
    { id: string; question: string; created_at: string }[] | null
  >(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Pergunta editável antes de virar conhecimento: a original (com possíveis
  // dados pessoais) fica só no histórico da paciente.
  const [editedQuestions, setEditedQuestions] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  /* Distingue "não deu para olhar" de "não há perguntas" — o servidor devolvia
     `ok: true` com lista vazia no erro, e a tela dizia "Tudo respondido! 🎉"
     durante uma falha de banco. */
  const [falhouQ, setFalhouQ] = useState(false);
  /** Quantas existem NO TOTAL — a tela mostra as 50 mais antigas. */
  const [totalQ, setTotalQ] = useState(0);

  useEffect(() => {
    (async () => {
      const res = await listUnansweredQuestions({
        data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
      });
      if (res.ok) {
        setQuestions(res.questions);
        setTotalQ(res.total);
        onContar?.(res.total);
        setFalhouQ(false);
      } else {
        /* ESQUELETO ETERNO era o que acontecia: `questions` ficava `null` para
           sempre, com um toast que some em 4 segundos e nada na tela. */
        setFalhouQ(true);
      }
    })();
  }, [tokenFn]);

  async function train(q: { id: string; question: string }) {
    const answer = (answers[q.id] ?? "").trim();
    if (!answer || sendingId) return;
    setSendingId(q.id);
    try {
      const edited = (editedQuestions[q.id] ?? q.question).trim();
      const res = await answerAndTrain({
        data: {
          accessToken: await tokenFn(),
          questionId: q.id,
          answer,
          ...(edited.length >= 8 ? { question: edited.slice(0, 300) } : {}),
          ...(asDoctor ? { asDoctor } : {}),
        },
      });
      if (!res.ok) {
        toast.error("Não foi possível treinar com essa resposta. Tente novamente.");
        return;
      }
      setQuestions((prev) => (prev ?? []).filter((x) => x.id !== q.id));
      // Reflete o "respondida" também na aba Perguntas e no contador do topo.
      onTrained(q.id);
      toast.success("🧠 O cérebro aprendeu mais uma");
    } catch {
      toast.error("Não foi possível treinar com essa resposta. Tente novamente.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    /* MESMO PESO DAS OUTRAS DUAS FILAS.
       Esta é a terceira fila de trabalho — perguntas REAIS que pacientes
       mandaram — e era o card mais fraco da página: `p-5` e `font-medium`,
       enquanto "Prova de qualidade" e o playground ganhavam `p-6` e
       `font-serif text-xl`. Ferramenta gritava, trabalho sussurrava. */
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-xl">
        ❓ Perguntas das pacientes esperando você
        {totalQ > 0 && (
          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 align-middle text-xs font-semibold text-primary-foreground">
            {totalQ}
          </span>
        )}
      </p>
      {/* A tela mostra as mais ANTIGAS — dizer isso evita o médico concluir que
          resolveu a fila ao terminar as 50. */}
      {questions && totalQ > questions.length && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mostrando as {questions.length} mais antigas de {totalQ}.
        </p>
      )}
      <p className="mt-0.5 text-sm text-muted-foreground">
        Cada resposta sua vira conhecimento: a paciente recebe a resposta e o cérebro aprende a
        conduta para as próximas.
      </p>

      {falhouQ ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-sm leading-snug text-amber-900">
          Não consegui carregar as perguntas agora —{" "}
          <strong>isto não quer dizer que não há nenhuma</strong>. Atualize a página antes de
          concluir que a fila está vazia.
        </p>
      ) : questions === null ? (
        <div className="mt-4 space-y-3">
          <div className="h-24 animate-pulse rounded-xl bg-secondary" />
          <div className="h-24 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : questions.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          Tudo respondido por aqui! 🎉 Quando uma paciente enviar uma nova pergunta, ela aparece
          nesta lista para você ensinar o cérebro.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">
                {new Date(q.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 font-medium">{q.question}</p>
              <label className="mt-3 block text-[11px] font-medium text-muted-foreground">
                Pergunta que entra no cérebro — generalize e remova nomes/dados pessoais
              </label>
              <input
                value={editedQuestions[q.id] ?? q.question}
                onChange={(e) => setEditedQuestions((eq) => ({ ...eq, [q.id]: e.target.value }))}
                maxLength={300}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
                placeholder="Escreva como você responderia a essa paciente..."
                className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => train(q)}
                disabled={sendingId === q.id || !(answers[q.id] ?? "").trim()}
                className="mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                {sendingId === q.id ? "Treinando..." : "Responder e treinar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Card "Base de conhecimento": busca, edição e novas entradas manuais. */
function BrainKnowledgeCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
}) {
  const [entries, setEntries] = useState<BrainEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);
  /* A entrada parecida que o servidor achou — o aviso antes de criar uma
     segunda verdade sobre o mesmo assunto. */
  const [parecida, setParecida] = useState<{
    id: string;
    question: string;
    answer: string;
    similaridade: number;
  } | null>(null);
  // Edição inline: revisar/generalizar pergunta e resposta (ex.: rascunho do
  // kit ou de transcrição com detalhe pessoal) sem excluir e recriar.
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Abre a edição de uma entrada já existente — usado pelo aviso de duplicata. */
  function startEdit(id: string, question: string, answer: string) {
    setEditingId(id);
    setEditQ(question);
    setEditA(answer);
  }
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  /** Entradas sem vetor: invisíveis para a busca por significado. */
  const [cegas, setCegas] = useState(0);

  // Busca com debounce; a primeira carga (search vazio) é imediata.
  useEffect(() => {
    // Guard contra respostas fora de ordem: descarta resultados de buscas antigas.
    let alive = true;
    const t = setTimeout(
      async () => {
        const res = await listBrainEntries({
          data: {
            accessToken: await tokenFn(),
            search: search.trim() || undefined,
            ...(asDoctor ? { asDoctor } : {}),
          },
        });
        if (!alive) return;
        if (res.ok) setEntries(res.entries);
        else toast.error("Não foi possível carregar a base de conhecimento.");

        /* DAR VETOR ÀS ENTRADAS QUE NÃO TÊM — em requisição SEPARADA.
           `match_brain_entries` exige `embedding IS NOT NULL`. Sem vetor, a
           busca semântica não devolve NADA e o chat cai calado no ranking por
           palavras: "posso comer comida japonesa?" não encontra a orientação
           sobre sushi. E nascem sem vetor o kit de partida, tudo o que foi
           salvo antes da migration e tudo o que foi salvo com a chave de IA
           fora do ar.
           Requisição própria pelo mesmo motivo da cura de lacunas: é a
           requisição dela que mantém o trabalho vivo em serverless. Dentro do
           `listBrainEntries` isto era disparado e esquecido, e a invocação
           congelava com a resposta — nenhuma entrada era embedada, nunca, sem
           um único erro no log.
           Só na primeira carga (`!search`): trocar o termo de busca não muda
           quais entradas estão cegas. */
        if (!search) {
          void embedarEntradasDoMedico({
            data: { accessToken: await tokenFn(), ...(asDoctor ? { asDoctor } : {}) },
          })
            .then((r) => {
              /* O número volta para a TELA. O teto é 20 por visita, então uma
                 base de 100 entradas precisa de cinco aberturas — e sem isto o
                 médico não tinha como saber que parte do conhecimento dele não
                 era encontrável por significado. */
              if (alive && r?.ok && "cegas" in r) setCegas(r.cegas);
            })
            .catch(() => {});
        }
      },
      search ? 350 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search, tokenFn]);

  async function toggleApproved(entry: BrainEntry) {
    const approved = !entry.approved;
    setEntries((prev) => (prev ?? []).map((x) => (x.id === entry.id ? { ...x, approved } : x)));
    const res = await updateBrainEntry({
      data: {
        accessToken: await tokenFn(),
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        approved,
        ...(asDoctor ? { asDoctor } : {}),
      },
    });
    if (!res.ok) {
      setEntries((prev) =>
        (prev ?? []).map((x) => (x.id === entry.id ? { ...x, approved: entry.approved } : x)),
      );
      toast.error("Não foi possível atualizar a entrada. Tente novamente.");
    }
  }

  async function saveEdit(entry: BrainEntry) {
    const q = editQ.trim();
    const a = editA.trim();
    if (!q || !a || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await updateBrainEntry({
        data: {
          accessToken: await tokenFn(),
          id: entry.id,
          question: q,
          answer: a,
          category: entry.category,
          approved: entry.approved,
          ...(asDoctor ? { asDoctor } : {}),
        },
      });
      if (!res.ok) {
        toast.error("Não foi possível salvar a edição. Tente novamente.");
        return;
      }
      setEntries((prev) =>
        (prev ?? []).map((x) => (x.id === entry.id ? { ...x, question: q, answer: a } : x)),
      );
      setEditingId(null);
      toast.success("Entrada atualizada.");
    } catch {
      toast.error("Não foi possível salvar a edição. Tente novamente.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta entrada da base de conhecimento?")) return;
    const res = await deleteBrainEntry({
      data: { accessToken: await tokenFn(), id, ...(asDoctor ? { asDoctor } : {}) },
    });
    if (!res.ok) {
      toast.error("Não foi possível excluir a entrada. Tente novamente.");
      return;
    }
    setEntries((prev) => (prev ?? []).filter((x) => x.id !== id));
    toast.success("Entrada excluída.");
  }

  async function add(mesmoAssim = false) {
    if (!newQuestion.trim() || !newAnswer.trim() || adding) return;
    setAdding(true);
    try {
      const res = await addBrainEntry({
        data: {
          accessToken: await tokenFn(),
          question: newQuestion.trim(),
          answer: newAnswer.trim(),
          category: newCategory.trim() || null,
          ...(mesmoAssim ? { mesmoAssim: true } : {}),
          ...(asDoctor ? { asDoctor } : {}),
        },
      });
      /* JÁ EXISTE ALGO PARECIDO. Não é erro — é a informação que faltava para
         ele decidir entre editar o que já escreveu e criar uma segunda
         verdade sobre o mesmo assunto. Editar é quase sempre o certo, e era
         justamente a opção que não existia. */
      if (!res.ok && "reason" in res && res.reason === "parecida" && "parecida" in res) {
        setParecida(res.parecida);
        return;
      }
      if (!res.ok || !res.entry) {
        toast.error("Não foi possível adicionar a entrada. Tente novamente.");
        return;
      }
      setParecida(null);
      const entry = res.entry;
      // Com busca ativa, limpa o filtro (o effect recarrega a lista completa,
      // já com a nova entrada); sem busca, insere direto no topo.
      if (search) setSearch("");
      else setEntries((prev) => [entry, ...(prev ?? [])]);
      setNewQuestion("");
      setNewAnswer("");
      setNewCategory("");
      toast.success("🧠 O cérebro aprendeu mais uma");
    } catch {
      toast.error("Não foi possível adicionar a entrada. Tente novamente.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">📚 Base de conhecimento</p>
      {/* A DÍVIDA DE VETORES, à vista.
          Entrada sem vetor é INVISÍVEL para a busca por significado — e o
          backfill embeda 20 por visita, então uma base grande precisa de várias
          aberturas desta aba. Sem este aviso, o médico não tinha como saber que
          parte do conhecimento dele não estava sendo encontrada. */}
      {cegas > 0 && (
        <p className="mt-1 rounded-xl border border-amber-300 bg-amber-50/70 px-3 py-2 text-xs leading-snug text-amber-900">
          <strong>
            {cegas}{" "}
            {cegas === 1
              ? "entrada ainda não é encontrável"
              : "entradas ainda não são encontráveis"}
          </strong>{" "}
          por significado — a IA só as acha por palavra exata. Estou preparando aos poucos; mantenha
          esta aba aberta ou volte aqui mais tarde.
        </p>
      )}
      <p className="mt-0.5 text-sm text-muted-foreground">
        Tudo o que o cérebro já sabe. Desative uma entrada para tirá-la das respostas sem excluir.
      </p>

      {/* Nova entrada */}
      <div className="mt-4 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm font-medium">Nova entrada</p>
        <div className="mt-2 space-y-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Pergunta (ex: Posso tomar dipirona na gestação?)"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            rows={3}
            placeholder="Resposta, do jeito que você responderia"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Categoria (opcional)"
              className="w-44 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => add()}
              disabled={adding || !newQuestion.trim() || !newAnswer.trim()}
              className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              {adding ? "Adicionando..." : "+ Adicionar ao cérebro"}
            </button>
          </div>

          {/* ─── VOCÊ JÁ ESCREVEU ALGO PARECIDO ─────────────────────────────
              A base não deduplicava nada, e a faixa do meio empurra para a
              duplicata: material próximo não assina, vira lacuna, ele
              responde, e nasce uma segunda entrada competindo com a primeira.
              Duas verdades sobre o mesmo tema, e a busca devolvendo a que
              estiver por um fio mais perto — às vezes a versão velha.
              Aviso, e não bloqueio: "1º trimestre" e "3º trimestre" são
              legitimamente parecidos e precisam coexistir. */}
          {parecida && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-amber-900">
              <p className="text-sm font-medium">
                Você já escreveu algo muito parecido ({Math.round(parecida.similaridade * 100)}% de
                semelhança)
              </p>
              <div className="mt-2 rounded-xl border border-amber-200 bg-white/70 px-3 py-2">
                <p className="text-sm font-medium">"{parecida.question}"</p>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{parecida.answer}</p>
              </div>
              <p className="mt-2 text-[11px] leading-snug">
                Duas entradas sobre o mesmo assunto competem entre si na busca — e a IA pode acabar
                usando a versão antiga. Editar a que existe costuma ser o certo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    startEdit(parecida.id, parecida.question, parecida.answer);
                    setParecida(null);
                  }}
                  className="rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Editar a que existe
                </button>
                <button
                  onClick={() => add(true)}
                  disabled={adding}
                  className="rounded-full border border-amber-400 px-4 py-2 text-xs font-medium disabled:opacity-40"
                >
                  {adding ? "Adicionando..." : "Criar mesmo assim"}
                </button>
                <button
                  onClick={() => setParecida(null)}
                  className="rounded-full px-3 py-2 text-xs text-amber-800 underline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Busca */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar na base (pergunta ou resposta)..."
        className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
      />

      {/* Lista */}
      {entries === null ? (
        <div className="mt-4 space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-secondary" />
          <div className="h-16 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {search
            ? "Nada encontrado para essa busca."
            : "O cérebro ainda está vazio. Adicione a primeira entrada acima ou responda uma pergunta de paciente."}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-xl border p-4 ${entry.approved ? "border-border" : "border-dashed border-border bg-secondary/30"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.question}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${BRAIN_SOURCE_STYLE[entry.source] ?? "bg-secondary text-muted-foreground"}`}
                    >
                      {entry.source}
                    </span>
                    {entry.category && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {entry.category}
                      </span>
                    )}
                    {/* A IDADE DA CONDUTA.
                        Uma orientação escrita há dois anos entrava na resposta
                        com a mesma confiança da de ontem, e nem ele nem a tela
                        conseguiam dizer qual era qual — em obstetrícia, onde a
                        conduta muda por ciclo de diretriz.
                        Só aparece quando passa de um ano: marcar tudo o tempo
                        todo ensina a não olhar. */}
                    {precisaDeRevisao(entry) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        revisar · {Math.floor((diasSemRevisao(entry) ?? 0) / 365)} ano
                        {Math.floor((diasSemRevisao(entry) ?? 0) / 365) > 1 ? "s" : ""} sem olhar
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.answer}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <BrainToggle
                    checked={entry.approved}
                    onChange={() => toggleApproved(entry)}
                    label={entry.approved ? "Ativa" : "Inativa"}
                  />
                  <button
                    onClick={() => {
                      setEditingId(entry.id);
                      setEditQ(entry.question);
                      setEditA(entry.answer);
                    }}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(entry.id)}
                    className="rounded-full border border-rose-300 px-2.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              {editingId === entry.id && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <input
                    value={editQ}
                    onChange={(e) => setEditQ(e.target.value)}
                    placeholder="Pergunta"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    value={editA}
                    onChange={(e) => setEditA(e.target.value)}
                    rows={3}
                    placeholder="Resposta"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(entry)}
                      disabled={savingEdit || !editQ.trim() || !editA.trim()}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                    >
                      {savingEdit ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Card "Playground": teste o cérebro como se fosse uma paciente. */
function BrainPlaygroundCard({
  tokenFn,
  asDoctor,
}: {
  tokenFn: () => Promise<string>;
  // Plano Clínica: operar o cérebro de um médico da clínica (admin).
  asDoctor?: string;
}) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<{ question: string; answer: string } | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    try {
      const res = await testBrain({
        data: { accessToken: await tokenFn(), question: q, ...(asDoctor ? { asDoctor } : {}) },
      });
      if (!res.ok) {
        toast.error(
          "answer" in res && res.answer
            ? res.answer
            : "Não foi possível testar o cérebro. Tente novamente.",
        );
        return;
      }
      setResult({ question: q, answer: res.answer });
    } catch {
      toast.error("Não foi possível testar o cérebro. Tente novamente.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      {/* "Playground" era a única palavra em inglês de um painel inteiramente
          em português, feito para médicos brasileiros. E o nome não dizia o que
          a ferramenta faz. */}
      <p className="font-medium">🧪 Testar antes de a paciente perguntar</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Pergunte como se fosse uma paciente e veja o que o cérebro responde hoje.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
          placeholder="Ex: Estou com azia forte, o que posso fazer?"
          className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={ask}
          disabled={asking || !question.trim()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {asking ? "Pensando..." : "Perguntar"}
        </button>
      </div>

      {(result || asking) && (
        <div className="mt-4 space-y-3">
          {result && !asking && (
            <>
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {result.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm">
                  {result.answer}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💬 É assim que suas pacientes vão ler a resposta.
              </p>
            </>
          )}
          {asking && (
            <div className="flex justify-start">
              <div className="animate-pulse rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                Pensando...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A saída da clínica, para quem foi posto nela.
 *
 * Aparece só para MEMBRO (nunca para o dono — a clínica ficaria sem
 * administrador e os outros presos de vez). Fica em Meu Perfil de propósito: a
 * aba Clínica exige o plano Pro Equipe, e quem foi anexado pode não tê-lo.
 */
function SairDaClinicaCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [clinica, setClinica] = useState<{ name: string; role: string } | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyClinic({ data: { accessToken: await tokenFn() } });
        if (res.ok && res.clinic && res.clinic.role === "member") {
          setClinica({ name: res.clinic.name, role: res.clinic.role });
        }
      } catch {
        /* sem clínica, sem cartão */
      }
    })();
  }, [tokenFn]);

  if (!clinica) return null;

  async function sair() {
    if (saindo) return;
    if (
      !window.confirm(
        `Sair da clínica ${clinica?.name}? A administração dela deixa de operar o seu Segundo Cérebro e de ver as conversas das suas pacientes. Suas pacientes, sua base de conhecimento e seus dados continuam seus.`,
      )
    )
      return;
    setSaindo(true);
    try {
      const res = await sairDaClinica({ data: { accessToken: await tokenFn() } });
      if (res.ok) {
        setClinica(null);
        toast.success("Você saiu da clínica.");
      } else {
        toast.error("Não foi possível sair agora. Tente de novo.");
      }
    } catch {
      toast.error("Não foi possível sair agora. Tente de novo.");
    } finally {
      setSaindo(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50/60 p-5 text-amber-900">
      <p className="font-medium">🏥 Você faz parte da clínica {clinica.name}</p>
      <p className="mt-1 text-sm leading-relaxed">
        A administração dela opera o seu Segundo Cérebro e vê as conversas das suas pacientes com a
        IA. Se você não pediu isso, pode sair agora — suas pacientes, sua base de conhecimento e
        seus dados continuam seus.
      </p>
      <button
        onClick={sair}
        disabled={saindo}
        className="mt-3 rounded-full border border-amber-400 px-5 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saindo ? "Saindo…" : "Sair da clínica"}
      </button>
    </div>
  );
}

/**
 * Aba "Clínica": conta da clínica com os médicos dela. Cada médico mantém o
 * PRÓPRIO cérebro; o admin da clínica opera cada um individualmente (botão
 * "Operar cérebro" leva à aba Cérebro no modo asDoctor).
 */
function ClinicaSection({
  tokenFn,
  onOperateBrain,
}: {
  tokenFn: () => Promise<string>;
  onOperateBrain: (d: { id: string; name: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [members, setMembers] = useState<ClinicMember[]>([]);
  const [migrate, setMigrate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await getMyClinic({ data: { accessToken: await tokenFn() } });
      if (res.ok) {
        setClinic(res.clinic);
        setMembers(res.members);
        setMigrate("migrate" in res && !!res.migrate);
      }
    } catch {
      toast.error("Não foi possível carregar a clínica.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (name.trim().length < 2 || creating) return;
    setCreating(true);
    try {
      const res = await createClinic({ data: { accessToken: await tokenFn(), name: name.trim() } });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "O plano Clínica (Pro Equipe) é necessário para criar uma clínica."
            : "reason" in res && res.reason === "migracao"
              ? "Rode o APLICAR_PENDENTES.sql no Supabase para ativar as clínicas."
              : "Não foi possível criar a clínica.",
        );
        return;
      }
      toast.success("Clínica criada! Agora adicione os médicos pelo e-mail.");
      setName("");
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  async function addDoctor() {
    const em = email.trim().toLowerCase();
    if (!em || addingDoc) return;
    setAddingDoc(true);
    try {
      const res = await addClinicDoctor({ data: { accessToken: await tokenFn(), email: em } });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "sem_conta"
            ? "Nenhuma conta com esse e-mail. Peça para o médico se cadastrar primeiro."
            : "reason" in res && res.reason === "sem_conta_medico"
              ? "Essa conta ainda não é de médico. Peça para completar o cadastro em /medicos/cadastro."
              : "reason" in res && res.reason === "outra_clinica"
                ? "Esse médico já pertence a outra clínica."
                : "reason" in res && res.reason === "limite"
                  ? `Limite do plano ${res.plan} atingido (${res.limit} médicos na clínica). Faça upgrade para adicionar mais.`
                  : "Não foi possível adicionar o médico.",
        );
        return;
      }
      if ("already" in res && res.already) toast(`${res.name} já está na clínica.`);
      else toast.success(`${res.name} entrou na clínica 🏥`);
      setEmail("");
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setAddingDoc(false);
    }
  }

  async function removeDoctor(d: ClinicMember) {
    if (
      !window.confirm(`Remover ${d.display_name} da clínica? O cérebro dele fica intacto, com ele.`)
    )
      return;
    setRemovingId(d.id);
    try {
      const res = await removeClinicDoctor({
        data: { accessToken: await tokenFn(), doctorId: d.id },
      });
      if (res.ok) {
        toast.success(`${d.display_name} saiu da clínica.`);
        await load();
      } else toast.error("Não foi possível remover.");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) return <div className="skeleton h-40 rounded-3xl" />;

  if (migrate)
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
        As tabelas do plano Clínica ainda não existem no banco — rode o{" "}
        <strong>APLICAR_PENDENTES.sql</strong> no SQL Editor do Supabase.
      </p>
    );

  if (!clinic)
    return (
      <div className="space-y-6">
        <div>
          <p className="font-serif text-xl">Sua clínica</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            No plano Clínica, a conta da clínica agrupa os médicos e controla o Segundo Cérebro de
            cada um DE FORMA INDIVIDUAL: cada médico tem o próprio cérebro, as pacientes dele
            conversam só com o cérebro dele, e a clínica opera todos num painel só.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <p className="font-medium">Criar a clínica</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Nome da clínica (ex: Clínica Vida Materna)"
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={create}
              disabled={creating || name.trim().length < 2}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {creating ? "Criando…" : "Criar clínica"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Disponível no plano Clínica (Pro Equipe). Depois de criar, adicione os médicos pelo
            e-mail da conta deles.
          </p>
        </div>
      </div>
    );

  if (clinic.role === "member")
    return (
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="font-serif text-xl">🏥 {clinic.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Você faz parte desta clínica. Seu Segundo Cérebro continua sendo só seu — a administração
          da clínica pode ajudar a treiná-lo, e suas pacientes conversam sempre com o SEU cérebro.
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <p className="font-serif text-xl">🏥 {clinic.name}</p>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cada médico tem o PRÓPRIO Segundo Cérebro — as pacientes dele conversam só com o cérebro
          dele. Aqui você opera cada cérebro individualmente, sem misturar nada entre médicos.
        </p>
      </div>

      {/* Adicionar médico */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="font-medium">Adicionar médico</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDoctor()}
            type="email"
            placeholder="E-mail da conta do médico"
            className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={addDoctor}
            disabled={addingDoc || !email.trim()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {addingDoc ? "Adicionando…" : "+ Adicionar"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O médico precisa ter conta na plataforma (cadastro em /medicos/cadastro). Ao entrar, ele
          herda as capacidades do plano Clínica.
        </p>
      </div>

      {/* Médicos da clínica */}
      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum médico ainda — adicione o primeiro pelo e-mail acima.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {members.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.specialty || "Obstetrícia"}
                    {d.clinic_role === "admin" ? " · admin" : ""}
                    {!d.active ? " · inativo" : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {d.plan || "free"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span title="Entradas aprovadas no cérebro">🧠 {d.brainEntries} entradas</span>
                <span
                  title="Perguntas de pacientes que a IA não soube responder"
                  className={d.brainGaps > 0 ? "text-amber-600" : ""}
                >
                  🕳️ {d.brainGaps} lacunas
                </span>
                {d.coveragePct != null && (
                  <span title="Cobertura do mês: % das dúvidas que a IA respondeu com o conhecimento do médico">
                    🎯 {d.coveragePct}% cobertura
                  </span>
                )}
                {d.satisfactionPct != null && (
                  <span title="Satisfação do mês: % de 👍 das pacientes">
                    💚 {d.satisfactionPct}% satisfação
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => onOperateBrain({ id: d.id, name: d.display_name })}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  🧠 Operar cérebro
                </button>
                <button
                  onClick={() => removeDoctor(d)}
                  disabled={removingId === d.id}
                  className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:text-rose-600 disabled:opacity-50"
                >
                  {removingId === d.id ? "…" : "Remover"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacidade: remover um médico não apaga nada — o cérebro, as pacientes e o histórico
        continuam com ele. A clínica só perde o acesso de operação.
      </p>
    </div>
  );
}

/* ---------- Receipt Modal ---------- */
import { DOCTOR } from "@/lib/doctor.config";
import { PainelNoApp } from "@/components/painel-no-app";
import { NotificacoesDoMedico } from "@/components/notificacoes-do-medico";

function ReceiptModal({
  appt,
  medico,
  onClose,
}: {
  appt: AdminAppointment;
  /** O médico LOGADO — o recibo é assinado por quem atendeu. */
  medico?: DoctorProfile | null;
  onClose: () => void;
}) {
  /* Antes o recibo imprimia o nome, o título e o CRM do `doctor.config`: todo
     assinante entregava à paciente um documento assinado "Dr. Clóvis Bacha,
     CRM-MG 22.333". Um recibo com o CRM de outro profissional não é um erro
     de layout. */
  /* Tudo ou nada. Um recibo é documento: com médico logado valem SÓ os dados
     dele, e um CRM em branco imprime em branco. Cair no CRM do fundador na
     linha da assinatura é pior que não imprimir CRM nenhum. */
  const temMed = !!medico?.display_name?.trim();
  const nomeMed = temMed ? medico!.display_name.trim() : DOCTOR.name;
  const tituloMed = temMed ? (medico!.title ?? "").trim() : DOCTOR.title;
  const crmMed = temMed ? (medico!.crm ?? "").trim() : DOCTOR.crm;
  const rqeMed = temMed ? (medico!.rqe ?? "").trim() : DOCTOR.rqe;
  const ext = appt as any;
  const printRef = useRef<HTMLDivElement>(null);
  const receiptDate = ext.confirmed_date
    ? new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date(appt.preferred_date + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
  const receiptTime = ext.confirmed_time ?? appt.preferred_time;
  const receiptNumber = appt.id.slice(0, 8).toUpperCase();
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document
      .write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Recibo de Consulta</title><style>
      body { font-family: Georgia, serif; max-width: 640px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; }
      h1 { font-size: 22px; margin: 0; }
      p { margin: 4px 0; }
      .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #666; margin-top: 16px; }
      .value { font-size: 14px; }
      hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
      .total { font-size: 22px; font-weight: bold; }
      .footer { font-size: 11px; color: #999; text-align: center; margin-top: 40px; }
      .sig { margin-top: 60px; border-top: 1px solid #999; width: 200px; padding-top: 6px; font-size: 11px; color: #666; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {/* `max-h-[90svh]` + coluna + rolagem SÓ no corpo.

          Antes era `overflow-hidden` sem teto de altura: num celular o recibo é
          mais alto que a tela, então o fim dele — valor, forma de pagamento,
          assinatura — ficava cortado, sem barra de rolagem e sem jeito de
          alcançar. A barra de botões fica fixa em cima, que é onde o médico
          precisa do "Imprimir" mesmo tendo rolado até o fim.

          `svh` e não `vh` porque no Safari do iPhone `vh` ignora a barra de
          endereço e o modal passa do fundo da tela. */}
      {/* `print:*` no PAI, não no corpo: `handlePrint` copia o `innerHTML` para
          uma janela nova com CSS próprio, onde nenhuma classe do Tailwind
          existe — um `print:` no filho seria letra morta. Estas valem para o
          outro caminho, o Ctrl+P na própria página, onde era o `max-h` do pai
          que cortava o recibo. */}
      <div className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl print:max-h-none print:overflow-visible print:shadow-none">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
          <p className="text-sm font-medium text-muted-foreground">Recibo #{receiptNumber}</p>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
            >
              🖨 Imprimir
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Receipt content */}
        <div
          ref={printRef}
          className="min-h-0 flex-1 overflow-y-auto px-8 py-6 print:overflow-visible"
        >
          {/* Header */}
          <div className="border-b border-gray-200 pb-5 mb-5">
            <h1 className="font-serif text-2xl text-gray-900">{nomeMed}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tituloMed}</p>
            <p className="text-xs text-gray-400">
              {crmMed}
              {rqeMed ? ` · ${rqeMed}` : ""}
            </p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Recibo de Consulta
          </p>
          <p className="text-xs text-gray-400">
            Nº {receiptNumber} · Emitido em {today}
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Paciente
              </p>
              <p className="text-sm text-gray-800">{appt.patient_name}</p>
              {appt.patient_phone && <p className="text-xs text-gray-500">{appt.patient_phone}</p>}
              {appt.patient_email && <p className="text-xs text-gray-500">{appt.patient_email}</p>}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Data e horário
              </p>
              <p className="text-sm text-gray-800">
                {receiptDate} às {receiptTime}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Descrição
              </p>
              <p className="text-sm text-gray-800">Consulta de {tituloMed}</p>
              <p className="text-xs text-gray-500">{appt.reason}</p>
            </div>
          </div>

          {ext.price_brl ? (
            <div className="mt-5 flex items-baseline justify-between rounded-xl bg-gray-50 px-4 py-3 border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</p>
              <div className="text-right">
                <p className="font-serif text-2xl font-bold text-gray-900">
                  R$ {(ext.price_brl / 100).toFixed(2).replace(".", ",")}
                </p>
                {ext.payment_status === "pago" && (
                  <p className="text-xs font-medium text-emerald-600">✓ Pago</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-400">Valor a definir</p>
            </div>
          )}

          {/* Signature */}
          <div className="mt-10 flex justify-end">
            <div className="text-center">
              <div className="h-12 border-b border-gray-400 w-48" />
              <p className="text-xs text-gray-500 mt-1">{nomeMed}</p>
              <p className="text-[10px] text-gray-400">{crmMed}</p>
            </div>
          </div>

          <p className="mt-8 text-center text-[10px] text-gray-300">
            Este documento não tem validade fiscal. Para nota fiscal, consulte a recepção.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Meu Perfil (perfil do médico assinante) ---------- */

/** Plano & assinatura do médico — assinatura recorrente por cartão (Stripe). */
function DoctorBilling({
  tokenFn,
  plan,
  active,
  exists,
}: {
  tokenFn: () => Promise<string>;
  plan: string;
  active: boolean;
  exists: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  // Convite de paciente: +15% em qualquer plano (aplicado no checkout).
  const [inviteDiscount, setInviteDiscount] = useState(false);
  const isPaid =
    active && ["essencial", "starter", "pro", "clinica", "elite", "black"].includes(plan);
  const isTeam = plan === "clinica";

  useEffect(() => {
    (async () => {
      try {
        const { getMyInviteDiscount } = await import("@/lib/billing.functions");
        const res = await getMyInviteDiscount({ data: { accessToken: await tokenFn() } });
        if (res.ok && res.invited) setInviteDiscount(true);
      } catch {
        /* sem banner */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkout(planKey: "essencial" | "starter" | "pro" | "elite" | "black") {
    /* O médico USA o app, mas não ASSINA nele — plano de médico se contrata
       no site. Duas razões, e as duas contam:
       · a loja da Apple/Google cobra comissão sobre assinatura vendida dentro
         do app, e plano de médico é B2B vendido fora dele;
       · e abrir o Stripe dentro do app é reprovação na revisão (3.1.1).
       Ontem eu deixei estas portas abertas de propósito, escrevendo que "o app
       nativo é da paciente". Estava errado: o médico também vai usar o app. */
    const { ehNativo } = await import("@/lib/nativo");
    const { podeComprarAqui } = await import("@/lib/canal-de-venda");
    const veredito = podeComprarAqui("plano_medico", ehNativo());
    if (!veredito.pode) {
      toast(veredito.texto, { duration: 6000 });
      return;
    }
    setBusy(planKey);
    try {
      const tk = await tokenFn();
      const { createSubscriptionCheckout } = await import("@/lib/billing.functions");
      const res = await createSubscriptionCheckout({
        data: {
          accessToken: tk,
          product: "doctor_plan",
          plan: cycle === "annual" ? (`${planKey}_annual` as const) : planKey,
          returnPath: "/painel",
        },
      });
      if (res.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(
        res.error === "pagamento_indisponivel"
          ? "O pagamento está sendo configurado. Tente em instantes."
          : res.error === "plano_indisponivel"
            ? "Este ciclo ainda não está disponível — tente o mensal."
            : "Não foi possível abrir o pagamento.",
      );
    } catch {
      toast.error("Não foi possível abrir o pagamento.");
    }
    setBusy(null);
  }

  async function portal() {
    /* O portal do Stripe também troca de plano e de cartão — ou seja, também
       é compra. Fica no site, pelo mesmo motivo do checkout. Cancelar continua
       possível lá, sem passar pelo app. */
    const { ehNativo } = await import("@/lib/nativo");
    const { podeComprarAqui } = await import("@/lib/canal-de-venda");
    const veredito = podeComprarAqui("plano_medico", ehNativo());
    if (!veredito.pode) {
      toast(veredito.texto, { duration: 6000 });
      return;
    }
    setBusy("portal");
    try {
      const tk = await tokenFn();
      const { openBillingPortal } = await import("@/lib/billing.functions");
      const res = await openBillingPortal({ data: { accessToken: tk, returnPath: "/painel" } });
      if (res.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(
        res.error === "sem_assinatura"
          ? "Você ainda não tem uma assinatura ativa."
          : "Não foi possível abrir o portal.",
      );
    } catch {
      toast.error("Não foi possível abrir o portal.");
    }
    setBusy(null);
  }

  if (isPaid) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:bg-emerald-500/10 dark:border-emerald-500/30">
        <p className="font-serif text-lg text-emerald-900 dark:text-emerald-100">
          Assinatura ativa · plano {plan === "clinica" ? "Pro Equipe" : plan}
        </p>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
          Sua cobrança é automática. Troque o cartão, veja faturas ou cancele quando quiser.
        </p>
        <button
          onClick={portal}
          disabled={busy === "portal"}
          className="mt-4 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "portal" ? "Abrindo…" : "Gerenciar assinatura"}
        </button>
      </div>
    );
  }

  const PlanBtn = ({
    planKey,
    name,
    monthly,
    tagline,
    highlight,
    black,
    perk,
  }: {
    planKey: "essencial" | "starter" | "pro" | "elite" | "black";
    name: string;
    monthly: number;
    tagline: string;
    highlight?: boolean;
    black?: boolean;
    perk?: string;
  }) => (
    <div
      className={`rounded-2xl border p-4 ${
        black
          ? "border-neutral-700 bg-neutral-900 text-white"
          : highlight
            ? "border-amber-400 bg-card ring-1 ring-amber-300"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="font-serif text-base">{name}</p>
        {black ? (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-neutral-900">
            MÁXIMO
          </span>
        ) : highlight ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
            TOP
          </span>
        ) : null}
      </div>
      <p className={`mt-0.5 text-xs ${black ? "text-white/60" : "text-muted-foreground"}`}>
        {tagline}
      </p>
      <p className="mt-2 text-2xl font-extrabold">
        {/* `R$ {monthly}` cru imprimia "R$ 49.9" no Essencial — ponto decimal e
            um dígito só. Os planos inteiros continuam sem centavos. */}
        R${" "}
        {monthly.toLocaleString("pt-BR", {
          minimumFractionDigits: monthly % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })}
        <span
          className={`text-sm font-normal ${black ? "text-white/60" : "text-muted-foreground"}`}
        >
          /mês
        </span>
      </p>
      {cycle === "annual" && (
        <p className={`text-[11px] font-semibold ${black ? "text-amber-300" : "text-emerald-600"}`}>
          cobrado 1×/ano · 2 meses grátis
        </p>
      )}
      {perk && (
        <p
          className={`mt-1.5 text-[11px] font-semibold ${black ? "text-amber-300" : "text-amber-700"}`}
        >
          {perk}
        </p>
      )}
      <button
        onClick={() => checkout(planKey)}
        disabled={!!busy}
        className={`press mt-3 w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-60 ${
          black
            ? "bg-amber-400 text-neutral-900"
            : highlight
              ? "bg-amber-500 text-white"
              : "bg-primary text-primary-foreground"
        }`}
      >
        {busy === planKey ? "Abrindo pagamento…" : `Assinar ${name}`}
      </button>
    </div>
  );

  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-serif text-lg">Ative sua assinatura</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {exists ? "Você está no período de teste." : ""} Assine por cartão — acesso liberado na
            hora, renovação automática, cancele quando quiser.
          </p>
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
        <button
          onClick={() => setCycle("monthly")}
          className={`rounded-full px-3 py-1.5 ${cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Mensal
        </button>
        <button
          onClick={() => setCycle("annual")}
          className={`rounded-full px-3 py-1.5 ${cycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Anual · 2 meses grátis
        </button>
      </div>

      {inviteDiscount && (
        <p className="mt-3 rounded-2xl border border-emerald-300/60 bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
          🎁 Convite de paciente ativo: <strong>+15% de desconto</strong> em qualquer plano, para
          sempre — aplicado automaticamente no pagamento.
        </p>
      )}

      {/* Cinco cards agora: `lg:grid-cols-4` deixaria o Black sozinho na linha
          de baixo, e o plano mais caro da tabela não pode parecer sobra. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PlanBtn
          planKey="essencial"
          name="Essencial"
          monthly={49.9}
          tagline="Até 15 pacientes · o Segundo Cérebro incluído"
          perk="de R$ 102 por R$ 49,90"
        />
        <PlanBtn
          planKey="starter"
          name="Starter"
          monthly={149}
          tagline="Até 50 pacientes · 1 cérebro"
        />
        <PlanBtn
          planKey="pro"
          name="Pro"
          monthly={297}
          tagline="Até 150 pacientes · IA no WhatsApp"
        />
        <PlanBtn
          planKey="elite"
          name="Reconhecido"
          monthly={597}
          tagline="Selo + topo da busca · até 5 cérebros"
          highlight
          perk="🎟️ 25 convites premium/mês + selo verificado"
        />
        <PlanBtn
          planKey="black"
          name="Black"
          monthly={1499}
          tagline="Até 20 cérebros · 500 pacientes/médico"
          black
          perk="🖤 250 convites/mês · gerente dedicado · topo da busca · selo Black"
        />
      </div>

      {isTeam ? null : (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Clínica com vários médicos? O plano Clínica opera o cérebro de cada um num painel só — com
          orçamento personalizado pelo tamanho da equipe.{" "}
          <a href="/medicos#contato" className="font-semibold text-primary">
            Pedir orçamento
          </a>
          .
        </p>
      )}
    </div>
  );
}

/** Card de convites premium (Elite/Black): gera código na hora + cota do mês. */
function DoctorInviteCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [info, setInfo] = useState<{
    eligible: boolean;
    limit: number;
    used: number;
    remaining: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const tk = await tokenFn();
        const { getMyInviteInfo } = await import("@/lib/invites.functions");
        const res = await getMyInviteInfo({ data: { accessToken: tk } });
        if (res.ok) setInfo(res);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !info || !info.eligible) return null;

  async function generate() {
    setGenerating(true);
    setCopied(false);
    try {
      const tk = await tokenFn();
      const { generateInviteCode } = await import("@/lib/invites.functions");
      const res = await generateInviteCode({ data: { accessToken: tk } });
      if (res.ok) {
        setCode(res.code);
        setInfo((prev) => (prev ? { ...prev, used: res.used, remaining: res.remaining } : prev));
        // Copia automaticamente para facilitar o envio.
        try {
          await navigator.clipboard.writeText(res.code);
          setCopied(true);
        } catch {
          /* sem clipboard: a paciente copia manualmente */
        }
      } else {
        toast.error(
          res.error === "cota_esgotada"
            ? "Você já gerou todos os convites deste mês."
            : "Não foi possível gerar o código. Tente novamente.",
        );
      }
    } catch {
      toast.error("Não foi possível gerar o código.");
    }
    setGenerating(false);
  }

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Código: " + code);
    }
  };

  const esgotado = info.remaining <= 0;

  return (
    <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 dark:bg-amber-500/10 dark:border-amber-500/30">
      <p className="font-serif text-lg text-amber-900 dark:text-amber-100">🎟️ Convites premium</p>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
        Gere um código na hora e envie para a sua paciente do jeito que quiser (WhatsApp, e-mail…).
        Cada código vale para <strong>uma paciente</strong> e libera o Obstétrica Premium completo —
        por sua conta.
      </p>

      {code && (
        <button
          onClick={copy}
          className="press mt-4 flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-amber-300 bg-white px-4 py-3 font-mono text-xl font-black tracking-[0.3em] text-amber-900"
        >
          <span>{code}</span>
          <span className="font-sans text-xs font-bold text-amber-600">
            {copied ? "copiado ✓" : "copiar"}
          </span>
        </button>
      )}

      <button
        onClick={generate}
        disabled={generating || esgotado}
        className="press mt-3 w-full rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white disabled:opacity-50"
      >
        {generating
          ? "Gerando…"
          : esgotado
            ? "Cota do mês esgotada"
            : code
              ? "Gerar outro código"
              : "Gerar código para uma paciente"}
      </button>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-amber-800 dark:text-amber-200">
          Gerados este mês: <strong>{info.used}</strong> de {info.limit}
        </span>
        <span /* O fundo aqui é `bg-amber-200` e NÃO escurece — então o texto também não
             pode. Eu tinha escurecido só a fonte por padrão, deixando âmbar sobre
             âmbar: o contador "N restantes" sumia. */
          className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-800"
        >
          {info.remaining} restantes
        </span>
      </div>
    </div>
  );
}

/**
 * "Indique um colega": link de indicação (/medicos/cadastro?ref=<meuId>) +
 * contagem. Quando o indicado assina um plano pago, o médico ganha +30 dias.
 * É o canal de crescimento médico→médico dentro do produto.
 */
function ReferralCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [link, setLink] = useState<string>("");
  const [invited, setInvited] = useState(0);
  const [rewarded, setRewarded] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (uid && typeof window !== "undefined") {
        setLink(`${window.location.origin}/medicos/cadastro?ref=${uid}`);
      }
      const tk = await tokenFn();
      const res = await getMyReferrals({ data: { accessToken: tk } });
      if (res.ok) {
        setInvited(res.invited);
        setRewarded(res.rewarded);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="font-serif text-lg">Indique um colega 💛</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Compartilhe seu link com outros obstetras. Quando um deles <strong>assinar</strong> um plano
        pago, você ganha <strong>1 mês grátis</strong> (aplicado no seu plano).
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {link || "gerando seu link…"}
        </span>
        <button
          disabled={!link}
          onClick={() => {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{invited}</strong> colega(s) indicado(s)
        </span>
        <span>
          <strong className="text-foreground">{rewarded}</strong> assinaram — meses grátis ganhos
        </span>
      </div>
    </div>
  );
}

function GoogleCalendarCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const tk = await tokenFn();
      const res = await getGoogleCalendarStatus({ data: { accessToken: tk } });
      if (res.ok) {
        setConnected(res.connected);
        setEmail(res.connected ? (res.email ?? null) : null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const tk = await tokenFn();
      const res = await startGoogleCalendarConnect({
        data: { accessToken: tk, origin: window.location.origin },
      });
      if (res.ok && "url" in res) {
        window.location.href = res.url;
      } else {
        toast.error(("error" in res && res.error) || "Não foi possível iniciar a conexão.");
        setBusy(false);
      }
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const tk = await tokenFn();
      await disconnectGoogleCalendar({ data: { accessToken: tk } });
      setConnected(false);
      setEmail(null);
      toast.success("Agenda desconectada.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="skeleton h-28 rounded-3xl" />;

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg">Google Agenda das teleconsultas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {connected
              ? "Conectada — as salas de teleconsulta são criadas na sua conta Google e o convite vai para você e para a paciente."
              : "Conecte sua conta Google para que cada teleconsulta crie a reunião do Meet na SUA agenda e convide você e a paciente automaticamente."}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            connected ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"
          }`}
        >
          {connected ? "Conectada ✓" : "Não conectada"}
        </span>
      </div>

      {connected && email && (
        <p className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          Conta: <strong>{email}</strong>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {connected ? (
          <>
            <button
              onClick={connect}
              disabled={busy}
              className="rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
            >
              Reconectar
            </button>
            <button
              onClick={disconnect}
              disabled={busy}
              className="rounded-full border border-destructive/30 px-4 py-2 text-xs text-destructive hover:bg-destructive/5 disabled:opacity-60"
            >
              Desconectar
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={busy}
            className="press rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Redirecionando…" : "Conectar Google Agenda"}
          </button>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Sem conectar, as teleconsultas usam a conta Google central da plataforma (ou o Jitsi, se
        nenhuma estiver configurada).
      </p>
    </div>
  );
}

/**
 * Endereços de atendimento — vários, com um principal.
 *
 * Um médico com dois consultórios é a regra, não a exceção, e a paciente
 * precisa saber em qual dos dois ele atende no dia e para qual telefone ligar.
 * Um campo de texto com "Savassi e Nova Lima" não responde nenhuma das duas
 * perguntas.
 */
/**
 * O que você já usou do seu plano.
 *
 * Existia o teto (Free = 5 pacientes) e existia a checagem que o aplica, mas
 * não existia lugar nenhum que dissesse ao médico onde ele está. Ele descobria
 * o limite ao tentar aceitar a sexta paciente e receber um erro — que é o pior
 * momento possível, porque já havia alguém esperando do outro lado.
 *
 * Também mostra quando o teste acaba: `plan_expires_at` já estava no banco e
 * simplesmente não era lido, então o trial de 14 dias virava Free sem aviso.
 */
/**
 * O que este plano não inclui — dito de frente.
 *
 * Antes, uma aba fora do plano não avisava nada: o Cérebro abria normal e cada
 * tentativa de treinar devolvia "Não foi possível. Tente novamente", e a
 * Clínica oferecia um botão "Criar clínica" que errava sempre. Um paywall
 * disfarçado de defeito é pior que um paywall: o médico conclui que o produto
 * está quebrado e para de tentar, sem nunca descobrir que bastaria mudar de
 * plano.
 */
function TrancadoCard({
  titulo,
  texto,
  plano,
  onIrParaPlanos,
}: {
  titulo: string;
  texto: string;
  plano: string;
  onIrParaPlanos: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center">
      <p className="text-4xl">🔒</p>
      <h2 className="mt-3 font-serif text-xl text-foreground">{titulo}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
      {plano && (
        <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
          Seu plano atual: {plano}
        </p>
      )}
      <button
        onClick={onIrParaPlanos}
        className="press mt-6 block w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
      >
        Ver os planos
      </button>
    </div>
  );
}

function ConsumoCard({
  uso,
  plano,
  onUpgrade,
  onVerPacientes,
}: {
  uso: { pacientes: number; maxPacientes: number | null; rotulo: string; expira: string | null };
  plano: string;
  /** Leva para a cobrança — é o clique que o momento do teto pede. */
  onUpgrade: () => void;
  /** Leva para a lista, onde agora dá para encerrar um acompanhamento. */
  onVerPacientes: () => void;
}) {
  const semTeto = uso.maxPacientes == null;
  const pct = semTeto ? 0 : Math.min(100, Math.round((uso.pacientes / uso.maxPacientes!) * 100));
  const cheio = !semTeto && uso.pacientes >= uso.maxPacientes!;
  const perto = !semTeto && !cheio && pct >= 80;

  const diasRestantes = (() => {
    if (!uso.expira || plano !== "trial") return null;
    const ms = new Date(uso.expira).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 86400000) : 0;
  })();

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-lg">Seu plano: {uso.rotulo}</p>
        {diasRestantes != null && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              diasRestantes <= 3
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                : "bg-primary/12 text-primary"
            }`}
          >
            {diasRestantes === 0
              ? "Teste encerrado"
              : `${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"} de teste`}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Pacientes</span>
          <span className="font-bold text-foreground">
            {uso.pacientes}
            {semTeto ? " · sem limite" : ` de ${uso.maxPacientes}`}
          </span>
        </div>
        {!semTeto && (
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                cheio ? "bg-rose-500" : perto ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
        )}
      </div>

      {/* O TETO É O MOMENTO DA VENDA, e ele estava passando em branco.

          Este é o instante exato em que o valor já foi provado (ele tem
          pacientes de verdade aqui) e a dor é agora (quer aceitar mais uma e não
          pode). Um aviso de texto aqui é a mensagem certa sem a ação certa — o
          botão de mudar de plano ficava três blocos abaixo, e ele precisava
          procurar.

          A frase também mudou: "abrir uma vaga" era uma instrução impossível
          quando escrevi, porque não existia como soltar uma paciente. Agora
          existe, e as duas saídas aparecem juntas. */}
      {cheio && (
        <div className="mt-3 rounded-2xl bg-rose-50 px-3.5 py-3 dark:bg-rose-500/10">
          <p className="text-[12.5px] leading-snug text-rose-900 dark:text-rose-200">
            <strong>Você está no limite de {uso.maxPacientes} pacientes.</strong> A próxima que
            pedir para te acompanhar não poderá ser aceita.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={onUpgrade}
              className="press rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white"
            >
              Aumentar meu limite →
            </button>
            <button
              onClick={onVerPacientes}
              className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              Encerrar um acompanhamento
            </button>
          </div>
        </div>
      )}
      {perto && (
        <div className="mt-3 rounded-2xl bg-amber-50 px-3.5 py-3 dark:bg-amber-500/10">
          <p className="text-[12.5px] leading-snug text-amber-900 dark:text-amber-200">
            {uso.maxPacientes! - uso.pacientes === 1
              ? "Falta 1 vaga no seu plano."
              : `Faltam ${uso.maxPacientes! - uso.pacientes} vagas no seu plano.`}{" "}
            Depois disso, quem pedir para te acompanhar fica esperando.
          </p>
          <button
            onClick={onUpgrade}
            className="press mt-2.5 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white"
          >
            Ver planos
          </button>
        </div>
      )}
      {diasRestantes != null && diasRestantes <= 3 && (
        <p className="mt-3 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[12.5px] leading-snug text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">
          Quando o teste acabar, o plano vira <strong>Free</strong>: 5 pacientes e sem IA no app. As
          pacientes acima de 5 continuam vinculadas, mas você não recebe novas.
        </p>
      )}
    </div>
  );
}

function EnderecosCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  /* As mesmas classes do formulário de perfil, repetidas aqui de propósito:
     este card é um componente irmão, não um filho, e herdar as constantes
     por escopo criaria uma dependência invisível entre os dois. */
  const input =
    "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const label = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

  const [lista, setLista] = useState<DoctorAddress[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Partial<DoctorAddress> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  async function carregar() {
    try {
      const r = await listMyAddresses({ data: { accessToken: await tokenFn() } });
      setLista(r.addresses);
    } catch {
      setLista([]);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    if (!editando) return;
    if (!(editando.street ?? "").trim()) {
      toast.error("Informe o endereço.");
      return;
    }
    setSalvando(true);
    try {
      const r = await saveMyAddress({
        data: {
          accessToken: await tokenFn(),
          address: {
            id: editando.id,
            label: editando.label ?? "",
            street: editando.street ?? "",
            city: editando.city ?? "",
            state: (editando.state ?? "").toUpperCase(),
            zip: editando.zip ?? "",
            phone: editando.phone ?? "",
            notes: editando.notes ?? "",
            /* O primeiro endereço nasce principal: sem isso o médico salva um
               só e a paciente não vê nenhum marcado como o principal. */
            is_primary: editando.is_primary ?? lista.length === 0,
            position: editando.position ?? lista.length,
          },
        },
      });
      if (!r.ok) {
        toast.error("Não foi possível salvar o endereço. Rode o APLICAR_MEDICO.sql no Supabase.");
        return;
      }
      toast.success("Endereço salvo ✓");
      setEditando(null);
      await carregar();
    } catch {
      /* Sem catch, uma queda de rede aqui virava uma Promise rejeitada sem dono
         e o formulário ficava aberto sem dizer nada — o médico achava que tinha
         salvado. */
      toast.error("Sem conexão para salvar o endereço. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(id: string) {
    try {
      const r = await deleteMyAddress({ data: { accessToken: await tokenFn(), id } });
      if (!r.ok) {
        toast.error("Não foi possível apagar o endereço.");
        return;
      }
      await carregar();
    } catch {
      toast.error("Sem conexão para apagar o endereço.");
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg">Onde você atende</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A paciente vê o endereço principal ao escolher você, e todos eles antes da consulta.
          </p>
        </div>
        {!editando && (
          <button
            onClick={() => setEditando({})}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            + Endereço
          </button>
        )}
      </div>

      {carregando ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="mt-4 space-y-2">
          {lista.length === 0 && !editando && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhum endereço cadastrado. A paciente não tem como saber onde você atende.
            </p>
          )}
          {lista.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {a.label || "Consultório"}
                  {a.is_primary && (
                    <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary">
                      principal
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[a.street, a.city && `${a.city}${a.state ? `/${a.state}` : ""}`, a.zip]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {(a.phone || a.notes) && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[a.phone, a.notes].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => setEditando(a)}
                  className="rounded-full border border-border px-3 py-1 text-[11px]"
                >
                  Editar
                </button>
                <button
                  onClick={() => void apagar(a.id)}
                  className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground"
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div className="mt-4 space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={label}>Nome do local</label>
              <input
                value={editando.label ?? ""}
                onChange={(e) => setEditando((v) => ({ ...v, label: e.target.value }))}
                placeholder="Consultório Savassi"
                className={input}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Endereço *</label>
              <input
                value={editando.street ?? ""}
                onChange={(e) => setEditando((v) => ({ ...v, street: e.target.value }))}
                placeholder="Rua Antônio de Albuquerque, 156 — sala 302"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Cidade</label>
              <input
                value={editando.city ?? ""}
                onChange={(e) => setEditando((v) => ({ ...v, city: e.target.value }))}
                className={input}
              />
            </div>
            <div>
              <label className={label}>UF</label>
              <select
                value={(editando.state ?? "").toUpperCase()}
                onChange={(e) => setEditando((v) => ({ ...v, state: e.target.value }))}
                className={input}
              >
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>CEP</label>
              {/* Preenche rua, bairro, cidade e UF sozinho.
              
                  Não é só conforto: a CIDADE digitada à mão é o que a busca por
                  proximidade compara, e "Belo Horizonte", "belo horizonte" e
                  "BH" são três cidades diferentes para um `ilike`. Vindo do CEP,
                  ela sai sempre escrita igual. */}
              <input
                value={formatarCep(editando.zip ?? "")}
                onChange={async (e) => {
                  const bruto = e.target.value;
                  setEditando((v) => (v ? { ...v, zip: formatarCep(bruto) } : v));
                  if (digitosCep(bruto).length !== 8) return;
                  setBuscandoCep(true);
                  try {
                    const end = await buscarCep(bruto);
                    if (!end) {
                      toast.error("CEP não encontrado — preencha à mão.");
                      return;
                    }
                    setEditando((v) =>
                      v
                        ? {
                            ...v,
                            // Não sobrescreve o que ele já digitou: se a rua
                            // está preenchida, quem manda é ele.
                            street: (v.street ?? "").trim() || end.rua,
                            city: (v.city ?? "").trim() || end.cidade,
                            state: (v.state ?? "").trim() || end.uf,
                          }
                        : v,
                    );
                    toast.success(`${end.cidade}/${end.uf} ✓`);
                  } finally {
                    setBuscandoCep(false);
                  }
                }}
                placeholder="30140-071"
                inputMode="numeric"
                className={input}
              />
              {buscandoCep && (
                <p className="mt-1 text-[11px] text-muted-foreground">Buscando endereço…</p>
              )}
            </div>
            <div>
              <label className={label}>Telefone deste local</label>
              <input
                value={editando.phone ?? ""}
                onChange={(e) => setEditando((v) => ({ ...v, phone: e.target.value }))}
                placeholder="(31) 3333-3333"
                className={input}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Observação</label>
              <input
                value={editando.notes ?? ""}
                onChange={(e) => setEditando((v) => ({ ...v, notes: e.target.value }))}
                placeholder="3º andar · estacionamento no prédio"
                className={input}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editando.is_primary ?? lista.length === 0}
              onChange={(e) => setEditando((v) => ({ ...v, is_primary: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
            Este é o endereço principal
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => void salvar()}
              disabled={salvando}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar endereço"}
            </button>
            <button
              onClick={() => setEditando(null)}
              className="rounded-full border border-border px-5 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MeuPerfilSection({
  tokenFn,
  onIrParaPacientes,
}: {
  tokenFn: () => Promise<string>;
  /** Trocar de aba mora no painel; esta seção só pede. */
  onIrParaPacientes: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [plan, setPlan] = useState("trial");
  /* Consumo e teto do plano, mais a data em que o teste acaba. O painel tinha
     tudo isso disponível em `getMyDoctor` e não mostrava nada: o médico via o
     nome do plano e descobria o limite como um erro. */
  const [uso, setUso] = useState<{
    pacientes: number;
    maxPacientes: number | null;
    rotulo: string;
    expira: string | null;
  } | null>(null);
  const [active, setActive] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  /* O que falta para ele poder receber paciente, calculado no SERVIDOR pela
     mesma regra que a busca usa (`doctor-required.ts`). Vem de lá e não daqui
     de propósito: uma checagem de tela que discorda do servidor é pior do que
     nenhuma — o médico "completa" o cadastro e continua invisível na busca. */
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  /* As duas metades do CRM NÃO são derivadas de `form.crm` a cada render.

     `juntarCrm` devolve vazio quando falta uma das partes, e derivar as metades
     da string junta significava que trocar a UF antes de ter número (ou apagar o
     número) zerava a string e a tela voltava para "UF" sozinha — a escolha não
     tinha onde existir. O formato canônico é bom para o banco e não sabe
     representar "meio preenchido", que é metade do tempo de um formulário.

     `form.crm` continua sendo a string única do banco (`CRM-MG 12345`), escrita
     pelos handlers abaixo — é dela que a carteirinha e o aviso do SOS vivem. */
  const [crmUf, setCrmUf] = useState("");
  const [crmNum, setCrmNum] = useState("");
  /* Moeda e valor, pelo mesmo motivo do CRM: o texto formatado é o estado da
     tela, e os centavos só existem na hora de salvar. */
  const [moeda, setMoeda] = useState<MoedaChave>("BRL");
  const [valorTexto, setValorTexto] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [crmConferido, setCrmConferido] = useState("");
  const [form, setForm] = useState({
    display_name: "",
    title: "",
    specialty: "",
    crm: "",
    whatsapp: "",
    personal_phone: "",
    accepts_insurance: false,
    accepts_private: true,
    pix_key: "",
    bio: "",
    subspecialty: "",
    years_experience: null as number | null,
    has_masters: false,
    has_doctorate: false,
    city: "",
    state: "",
    accepting_patients: true,
    // Perfil rico — o que as pacientes mais querem saber
    instagram: "",
    rqe: "",
    education: "",
    hospitals: "",
    insurances: "",
    languages: "",
    approach: "",
    consultation_price_brl: null as number | null,
    offers_telehealth: false,
    focos: [] as string[],
    photo_url: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const tk = await tokenFn();
        const res = await getMyDoctor({ data: { accessToken: tk } });
        if (res.ok && res.doctor) {
          const d = res.doctor as DoctorProfile;
          setExists(true);
          setPlan(d.plan);
          setActive(d.active);
          setSlug(d.slug);
          setUso({
            pacientes: res.patientCount ?? 0,
            maxPacientes: res.entitlements?.maxPatients ?? null,
            rotulo: res.entitlements?.label ?? d.plan,
            expira: d.plan_expires_at ?? null,
          });
          setPendencias((res as { pendencias?: Pendencia[] }).pendencias ?? []);
          setForm({
            display_name: d.display_name,
            title: d.title,
            specialty: d.specialty,
            crm: d.crm,
            whatsapp: d.whatsapp,
            personal_phone: d.personal_phone ?? "",
            accepts_insurance: !!d.accepts_insurance,
            accepts_private: d.accepts_private ?? true,
            pix_key: d.pix_key,
            bio: d.bio ?? "",
            subspecialty: d.subspecialty ?? "",
            years_experience: d.years_experience ?? null,
            has_masters: !!d.has_masters,
            has_doctorate: !!d.has_doctorate,
            city: d.city ?? "",
            state: d.state ?? "",
            accepting_patients: d.accepting_patients ?? true,
            instagram: d.instagram ?? "",
            rqe: d.rqe ?? "",
            education: d.education ?? "",
            hospitals: d.hospitals ?? "",
            insurances: d.insurances ?? "",
            languages: d.languages ?? "",
            approach: d.approach ?? "",
            consultation_price_brl: d.consultation_price_brl ?? null,
            offers_telehealth: !!d.offers_telehealth,
            focos: Array.isArray(d.focos) ? d.focos : [],
            photo_url: d.photo_url ?? "",
          });
          /* Semeia as duas metades a partir do que veio do banco: o
             formulário mostra o CRM já existente, e a partir daí quem manda são
             as metades. */
          {
            const partes = separarCrm(d.crm);
            setCrmUf(partes.uf);
            setCrmNum(partes.numero);
            setMoeda(((d.consultation_currency as MoedaChave) ?? "BRL") || "BRL");
            /* Cai na coluna antiga (unidades inteiras) para quem cadastrou o
               preço antes de a coluna de centavos existir. */
            const cents = d.consultation_price_cents ?? (d.consultation_price_brl ?? 0) * 100;
            setValorTexto(cents ? digitandoDinheiro(String(cents), d.consultation_currency) : "");
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Os três obrigatórios existem por causa do SOS, não por burocracia: sem
     nome, CRM e WhatsApp, a Central de Emergência das pacientes deste médico
     fica sem para quem ligar — e o app é obrigado a esconder os botões dele.
     Barrar o salvamento é o único momento em que dá para cobrar isso antes de
     a falta virar um problema às 3h da manhã. */
  async function save() {
    /* Duas regras diferentes conforme o caminho, e de propósito.

       Perfil que JÁ EXISTE (`updateMyDoctor`): só o mínimo para a carteirinha e
       o SOS não quebrarem. Ele pode salvar um campo por vez, e barrar aqui
       trancaria o médico fora do próprio painel.

       Perfil NOVO (`registerDoctor`): a regra completa, a MESMA que o servidor
       aplica. Sem isso o botão ficava impossível: a tela exigia três campos, o
       servidor exigia sete, e o erro era descartado — um "Não foi possível
       salvar o perfil" sem dizer o quê. Quem cai aqui é o gestor de clínica
       (admitido sem linha em `doctors`) e o médico cujo perfil não carregou. */
    if (!exists) {
      const faltas = pendenciasDoMedico(
        { ...form, consultation_price_brl: unidadesInteirasDe(centavosDe(valorTexto)) },
        { temEndereco: true },
      );
      if (faltas.length) {
        toast.error(`${faltas[0].rotulo}: ${faltas[0].porque}`);
        return;
      }
    } else {
      if (form.display_name.trim().length < 2) {
        toast.error("Informe seu nome.");
        return;
      }
      if (!form.crm.trim()) {
        toast.error("Informe o CRM — ele vai na carteirinha de emergência da paciente.");
        return;
      }
      if (form.whatsapp.replace(/\D/g, "").length < 10) {
        toast.error("Informe o WhatsApp de emergência — é o número que o SOS das pacientes usa.");
        return;
      }
    }
    setSaving(true);
    try {
      const tk = await tokenFn();
      /* O dinheiro é montado aqui, num lugar só: centavos como fonte de verdade
         e a coluna antiga como espelho arredondado, para as telas e o cálculo de
         receita que ainda a leem. */
      const cents = centavosDe(valorTexto);
      const perfil = {
        ...form,
        consultation_currency: moeda,
        consultation_price_cents: cents,
        consultation_price_brl: unidadesInteirasDe(cents),
        focos: Array.from(new Set((form.focos ?? []).filter(Boolean))),
      };
      // Equipe da instalação pode ainda não ter linha em doctors: cria na hora
      if (exists) {
        const res = await updateMyDoctor({ data: { accessToken: tk, profile: perfil } });
        if (!res.ok) {
          toast.error("Não foi possível salvar o perfil.");
          return;
        }
      } else {
        const res = await registerDoctor({ data: { accessToken: tk, profile: perfil } });
        if (!res.ok || !res.doctor) {
          // O servidor diz POR QUE recusou; descartar isso é o que fazia o
          // botão parecer quebrado.
          toast.error(
            "error" in res && res.error ? res.error : "Não foi possível salvar o perfil.",
          );
          return;
        }
        setExists(true);
        setSlug(res.doctor.slug);
        setPlan(res.doctor.plan);
      }
      toast.success("Perfil salvo ✓");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="skeleton h-64 rounded-3xl" />;

  const input =
    "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const label = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

  /* O bloqueio do SOS é o mais grave e continua com destaque próprio; o resto
     das pendências vira uma lista abaixo dele. */
  const faltaEmergencia = !form.crm.trim() || form.whatsapp.replace(/\D/g, "").length < 10;
  const outrasPendencias = pendencias.filter((p) => p.campo !== "crm" && p.campo !== "whatsapp");
  /* O servidor já respondeu sobre o endereço: se ele não está entre as
     pendências, existe. Reconsultar aqui seria uma segunda fonte de verdade. */
  const temEndereco = !pendencias.some((p) => p.campo === "endereco");

  return (
    <div className="max-w-2xl space-y-4">
      {/* O aviso fica no TOPO da seção, acima até da cobrança: enquanto ele
          estiver aqui, as pacientes deste médico abrem o SOS e não encontram
          nenhum caminho até ele. */}
      {!loading && faltaEmergencia && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:bg-rose-500/10">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
            Suas pacientes estão sem você no botão de emergência
          </p>
          <p className="mt-1 text-[13px] leading-snug text-rose-900/85 dark:text-rose-200/85">
            Falta {!form.crm.trim() ? "o CRM" : ""}
            {!form.crm.trim() && form.whatsapp.replace(/\D/g, "").length < 10 ? " e " : ""}
            {form.whatsapp.replace(/\D/g, "").length < 10 ? "o WhatsApp de emergência" : ""}. Sem
            eles, a Central de Emergência esconde os seus botões e sobra o 192 para a paciente — o
            app não coloca o telefone de outro médico no lugar do seu.
          </p>
        </div>
      )}
      {/* Progresso do perfil, com o EFEITO de cada campo faltando. Fica acima do
          aviso de pendências porque responde outra pergunta: aquele diz "o que
          falta", este diz "quanto falta e o que isso te custa". */}
      {!loading && (
        <PerfilProgresso
          itens={itensDoPerfil({
            display_name: form.display_name,
            crm: form.crm,
            whatsapp: form.whatsapp,
            education: form.education,
            bio: form.bio,
            specialty: form.specialty,
            accepts_insurance: form.accepts_insurance,
            accepts_private: form.accepts_private,
            insurances: form.insurances,
            precoCentavos: centavosDe(valorTexto),
            /* O endereço vem da lista do card abaixo; a foto ainda não existe
               como campo, então não é cobrada. */
            temEndereco: temEndereco,
            temFoto: !!form.photo_url,
          })}
        />
      )}

      {/* Cadastro incompleto não tranca o painel — só empurra ele para baixo na
          busca da paciente. Trancar seria repetir o erro que deixou o médico
          preso na tela de dados: o caminho certo é dizer o que falta e por quê,
          e deixar ele decidir a ordem. */}
      {!loading && outrasPendencias.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-500/10">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            Faltam {outrasPendencias.length}{" "}
            {outrasPendencias.length === 1 ? "informação" : "informações"} no seu cadastro
          </p>
          <p className="mt-1 text-[13px] leading-snug text-amber-900/80 dark:text-amber-100/80">
            Seu perfil aparece na busca, mas <strong>abaixo</strong> de quem preencheu tudo — uma
            paciente que abre um card sem valor, sem convênio e sem formação volta para a lista.
          </p>
          <ul className="mt-3 space-y-2">
            {outrasPendencias.map((p) => (
              <li key={p.campo} className="text-[13px] leading-snug">
                <span className="font-semibold text-amber-900 dark:text-amber-100">{p.rotulo}</span>
                <span className="text-amber-900/70 dark:text-amber-100/70"> — {p.porque}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* AS RESPOSTAS DA IA, AO LADO DAS PACIENTES.
          O mesmo card que fica na aba Cérebro. Decisão do Clóvis: os dois
          lugares. Faz sentido — na aba Cérebro ele lê "quanto do meu trabalho
          rendeu"; aqui, junto do teto de pacientes e da cobrança, ele lê
          "quanto do meu plano estou usando". É a mesma medida respondendo a
          duas perguntas diferentes, e o card já sabe carregar sozinho. */}
      <ConsumoDaIACard
        tokenFn={tokenFn}
        onIrParaPlanos={() => {
          document
            .getElementById("cobranca")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
      {uso && (
        <ConsumoCard
          uso={uso}
          plano={plan}
          onUpgrade={() => {
            /* A cobrança vive nesta mesma aba, logo abaixo: rolar até ela é
               mais honesto que abrir outra tela e perder o contexto do número
               que ele acabou de ler. */
            document
              .getElementById("cobranca")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onVerPacientes={onIrParaPacientes}
        />
      )}
      {/* Âncora para o botão do teto: "aumentar meu limite" rola até aqui. */}
      <div id="cobranca">
        <DoctorBilling tokenFn={tokenFn} plan={plan} active={active} exists={exists} />
      </div>
      <EnderecosCard tokenFn={tokenFn} />
      <DoctorInviteCard tokenFn={tokenFn} />
      <ReferralCard tokenFn={tokenFn} />
      <GoogleCalendarCard tokenFn={tokenFn} />

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-lg">Perfil do médico</p>
            <p className="mt-1 text-sm text-muted-foreground">
              É com esses dados que suas pacientes veem você no app.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              plano {plan}
            </span>
            <DoctorBadge plan={plan} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <CampoFoto
              url={form.photo_url}
              onChange={(u) => setForm((f) => ({ ...f, photo_url: u }))}
              nome={form.display_name}
              classeLabel={label}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Nome completo *</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              className={input}
            />
          </div>
          {/* UF primeiro, número depois: o registro é estadual, e "CRM 12345"
              sozinho não identifica ninguém. Em dois controles não há como
              gravar "crm mg 12345" ou "12345/MG" — o formato sai sempre igual e
              dá para conferir no portal do conselho. */}
          <div>
            <label className={label}>CRM *</label>
            {/* Grid com a coluna da UF fixa, igual ao cadastro: com `flex` +
                `w-[92px] shrink-0` o campo do número herda o `mt-1` do `input` e
                fica um degrau abaixo do select. Em grid os dois compartilham a
                linha e o `mt-0` tira a margem dupla. */}
            <div className="mt-1 grid grid-cols-[96px_1fr] gap-2">
              <select
                value={crmUf}
                onChange={(e) => {
                  setCrmUf(e.target.value);
                  setForm((f) => ({ ...f, crm: juntarCrm(e.target.value, crmNum) }));
                }}
                className={`${input} mt-0`}
                aria-label="Estado do CRM"
              >
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              <input
                value={crmNum}
                onChange={(e) => {
                  const n = e.target.value.replace(/\D/g, "");
                  setCrmNum(n);
                  setForm((f) => ({ ...f, crm: juntarCrm(crmUf, n) }));
                }}
                className={`${input} mt-0`}
                placeholder="Número — ex.: 12345"
                inputMode="numeric"
                aria-label="Número do CRM"
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {form.crm
                ? `Vai impresso como "${form.crm}" na carteirinha de emergência da paciente.`
                : "Vai impresso na carteirinha de emergência que a paciente mostra no hospital."}
            </p>
            {/* Conferência no conselho. O botão só aparece com CRM completo, e o
                resultado NUNCA é apresentado como selo — o selo é outra coisa,
                que só o super-admin dá. Aqui é informação: o conselho reconhece
                este registro, e com que nome. */}
            {form.crm && (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={conferindo}
                  onClick={async () => {
                    setConferindo(true);
                    try {
                      const r = await conferirMeuCrm({ data: { accessToken: await tokenFn() } });
                      if (!r.ok || !r.resultado) {
                        toast.error("Não foi possível conferir agora.");
                        return;
                      }
                      const res = r.resultado;
                      if (res.status === "confirmado") {
                        setCrmConferido(
                          `${res.nome}${res.situacao ? ` · ${res.situacao}` : ""}${
                            r.nomeDivergente ? " · nome diferente do cadastrado" : ""
                          }`,
                        );
                        toast.success("Registro encontrado no conselho ✓");
                      } else if (res.status === "nao_encontrado") {
                        setCrmConferido("não encontrado no conselho");
                        toast.error("Esse CRM não foi encontrado. Confira a UF e o número.");
                      } else {
                        setCrmConferido("");
                        toast.error(
                          res.motivo === "sem_provedor"
                            ? "A conferência automática ainda não está ligada nesta instalação."
                            : "O conselho não respondeu agora. Tente mais tarde.",
                        );
                      }
                    } finally {
                      setConferindo(false);
                    }
                  }}
                  className="rounded-full border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-50"
                >
                  {conferindo ? "Conferindo…" : "Conferir no conselho"}
                </button>
                {crmConferido && (
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    Conselho respondeu: <strong className="text-foreground">{crmConferido}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className={label}>WhatsApp para pacientes *</label>
            <input
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              className={input}
              placeholder="(31) 98634-2903"
            />
            {/* O médico costuma ter dois números. Este campo precisa dizer, sem
                rodeio, qual dos dois ele está cadastrando — é o que toca às
                3h da manhã quando uma paciente aperta o SOS. */}
            <p className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
              <strong>Atenção:</strong> este é o número que aparece no botão SOS das suas pacientes.
              Elas vão ligar e chamar no WhatsApp por aqui em uma emergência, a qualquer hora.
              Cadastre o número em que você quer ser encontrado nessa situação.
            </p>
          </div>
          {/* O segundo número. Existe porque o de cima é PÚBLICO para as suas
              pacientes; este a plataforma usa para falar com você, e ele nunca
              aparece no app delas. Sem a separação, ou você expõe o pessoal ou
              a emergência fica sem destino. */}
          <div>
            <label className={label}>Telefone pessoal</label>
            <input
              value={form.personal_phone}
              onChange={(e) => setForm((f) => ({ ...f, personal_phone: e.target.value }))}
              className={input}
              placeholder="(31) 90000-0000"
            />
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Privado. Só a plataforma usa — nunca aparece para as pacientes.
            </p>
          </div>
          <CampoComOutro
            label="Título"
            opcoes={TITULOS_MEDICO}
            valor={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholderOutro="Ex.: Especialista em Endometriose"
            ajuda="Aparece embaixo do seu nome, no card e na carteirinha."
            classeInput={input}
            classeLabel={label}
          />
          {/* Mesmos componentes do cadastro: lista curada + "Outro" no
              principal, chips nos demais. Campos diferentes nas duas telas
              produziriam dados diferentes para o mesmo médico. */}
          <CampoComOutro
            label="Especialidade / foco principal"
            opcoes={ESPECIALIDADES_MEDICO}
            valor={form.specialty}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                specialty: v,
                focos: v && !f.focos.includes(v) ? [...f.focos, v] : f.focos,
              }))
            }
            placeholderOutro="Ex.: Gestação gemelar"
            ajuda="Aparece embaixo do seu nome no card."
            classeInput={input}
            classeLabel={label}
          />
          <div className="md:col-span-2">
            <CampoFocos
              valor={form.focos}
              onChange={(v) => setForm((f) => ({ ...f, focos: v }))}
              principal={form.specialty}
              classeInput={input}
              classeLabel={label}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Chave PIX (cobranças)</label>
            <input
              value={form.pix_key}
              onChange={(e) => setForm((f) => ({ ...f, pix_key: e.target.value }))}
              className={input}
            />
          </div>
        </div>

        {/* Perfil público — aparece na busca de médicos das pacientes */}
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-semibold">Perfil público (busca de médicos)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Preencha para aparecer quando pacientes sem médico procurarem no app. Planos melhores
            aparecem primeiro.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Subárea / atuação</label>
              <input
                value={form.subspecialty}
                onChange={(e) => setForm((f) => ({ ...f, subspecialty: e.target.value }))}
                placeholder="Medicina fetal, alto risco…"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Anos de experiência</label>
              <input
                type="number"
                min={0}
                max={70}
                value={form.years_experience ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    years_experience: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={input}
              />
            </div>
            <div>
              <label className={label}>Cidade</label>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Estado (UF)</label>
              <input
                value={form.state}
                maxLength={2}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                placeholder="SP"
                className={input}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Sobre você (bio curta)</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="Uma frase acolhedora sobre a sua forma de cuidar."
                className={`${input} resize-none`}
              />
            </div>
            {/* ── O que as pacientes mais querem saber ─────────────────── */}
            <div>
              <label className={label}>Instagram</label>
              <input
                value={form.instagram}
                onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                placeholder="@seuperfil ou link completo"
                className={input}
              />
            </div>
            <div>
              <label className={label}>RQE (registro de especialista)</label>
              <input
                value={form.rqe}
                onChange={(e) => setForm((f) => ({ ...f, rqe: e.target.value }))}
                placeholder="RQE 12345"
                className={input}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Formação (uma por linha)</label>
              <textarea
                value={form.education}
                onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
                rows={3}
                placeholder={
                  "Residência em GO — UFMG\nMestrado em Medicina Fetal — USP\nTítulo de especialista FEBRASGO"
                }
                className={`${input} resize-none`}
              />
            </div>
            <div>
              <label className={label}>Maternidades / hospitais onde atende</label>
              <textarea
                value={form.hospitals}
                onChange={(e) => setForm((f) => ({ ...f, hospitals: e.target.value }))}
                rows={2}
                placeholder="Ex: Unimed BH, Mater Dei, Vila da Serra"
                className={`${input} resize-none`}
              />
            </div>
            {/* Como você atende — a primeira pergunta que a paciente faz.
                
                Antes havia só a lista de convênios em texto livre, e uma lista
                vazia era ambígua: podia significar "só particular" ou "ainda
                não preenchi". Duas caixas respondem sem ambiguidade, e a busca
                passa a poder filtrar por elas. */}
            <div className="md:col-span-2 rounded-2xl border border-border bg-secondary/30 p-4">
              <p className="text-sm font-semibold">Como você atende</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.accepts_insurance}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accepts_insurance: e.target.checked }))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  🏥 Atendo por convênio
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.accepts_private}
                    onChange={(e) => setForm((f) => ({ ...f, accepts_private: e.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  💳 Atendo particular
                </label>
              </div>
              {form.accepts_insurance && (
                <div className="mt-3">
                  <label className={label}>Quais convênios</label>
                  <textarea
                    value={form.insurances}
                    onChange={(e) => setForm((f) => ({ ...f, insurances: e.target.value }))}
                    rows={2}
                    placeholder="Ex: Unimed, Bradesco Saúde, Amil"
                    className={`${input} resize-none`}
                  />
                </div>
              )}
              {!form.accepts_insurance && !form.accepts_private && (
                <p className="mt-2 text-[11.5px] leading-snug text-amber-700 dark:text-amber-400">
                  Sem convênio e sem particular, a paciente não tem como saber como marcar com você.
                  Marque pelo menos um.
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className={label}>Sua abordagem (filosofia de cuidado)</label>
              <textarea
                value={form.approach}
                onChange={(e) => setForm((f) => ({ ...f, approach: e.target.value }))}
                rows={2}
                placeholder="Ex: pré-natal humanizado, incentivo ao parto normal quando seguro, decisões compartilhadas."
                className={`${input} resize-none`}
              />
            </div>
            <div>
              <label className={label}>Idiomas</label>
              <input
                value={form.languages}
                onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
                placeholder="Português, inglês…"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Consulta particular (opcional)</label>
              {/* Moeda antes do valor, igual ao cadastro: o mesmo campo nos dois
                  lugares, senão ele edita num e o outro contradiz. */}
              <div className="mt-1 grid grid-cols-[132px_1fr] gap-2">
                <select
                  value={moeda}
                  onChange={(e) => {
                    const nova = e.target.value as MoedaChave;
                    setMoeda(nova);
                    setValorTexto((t) => digitandoDinheiro(t, nova));
                  }}
                  className={`${input} mt-0`}
                  aria-label="Moeda da consulta"
                >
                  {MOEDAS.map((m) => (
                    <option key={m.chave} value={m.chave}>
                      {m.rotulo}
                    </option>
                  ))}
                </select>
                <input
                  value={valorTexto}
                  onChange={(e) => setValorTexto(digitandoDinheiro(e.target.value, moeda))}
                  placeholder="450,00"
                  inputMode="numeric"
                  className={`${input} mt-0`}
                  aria-label="Valor da consulta"
                />
              </div>
              {centavosDe(valorTexto) ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  A paciente vê {formatarDinheiro(centavosDe(valorTexto), moeda)}.
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.has_masters}
                onChange={(e) => setForm((f) => ({ ...f, has_masters: e.target.checked }))}
              />
              🎓 Mestrado
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.has_doctorate}
                onChange={(e) => setForm((f) => ({ ...f, has_doctorate: e.target.checked }))}
              />
              🎓 Doutorado
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.accepting_patients}
                onChange={(e) => setForm((f) => ({ ...f, accepting_patients: e.target.checked }))}
              />
              Aceitando novas pacientes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.offers_telehealth}
                onChange={(e) => setForm((f) => ({ ...f, offers_telehealth: e.target.checked }))}
              />
              💻 Atendo por teleconsulta
            </label>
          </div>
        </div>

        {slug && (
          <p className="mt-4 text-xs text-muted-foreground">
            Seu endereço na plataforma:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5">/dr/{slug}</code> (páginas por
            médico chegam na próxima etapa)
          </p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Pacientes (vínculo paciente ↔ médico) ---------- */
/**
 * Chip de BPM fetal na lista de pacientes: o médico anota o valor medido na
 * consulta e o "Sentir o coração" (app da paciente + Painel do Papai) passa a
 * vibrar no ritmo exato do bebê.
 */
function FetalBpmChip({
  p,
  tokenFn,
  onSaved,
}: {
  p: LinkedPatient;
  tokenFn: () => Promise<string>;
  onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = val.trim() === "" ? null : Number(val);
    if (n !== null && (!Number.isInteger(n) || n < 60 || n > 220)) {
      toast.error("BPM entre 60 e 220 (ou vazio para limpar).");
      return;
    }
    setBusy(true);
    try {
      const tk = await tokenFn();
      const res = await setPatientFetalBpm({ data: { accessToken: tk, patientId: p.id, bpm: n } });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível salvar o BPM.");
        return;
      }
      toast.success(n ? `Coração do bebê: ${n} bpm 💗` : "BPM removido.");
      setEditing(false);
      await onSaved();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setVal(p.fetal_bpm ? String(p.fetal_bpm) : "");
          setEditing(true);
        }}
        title="BPM fetal da última consulta — a família sente esse ritmo no 'Sentir o coração'"
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
          p.fetal_bpm
            ? "bg-rose-100 text-rose-700"
            : "border border-border text-muted-foreground hover:border-rose-400 hover:text-rose-600"
        }`}
      >
        {p.fetal_bpm ? `💗 ${p.fetal_bpm} bpm` : "💗 BPM"}
      </button>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        type="number"
        min={60}
        max={220}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="bpm"
        autoFocus
        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "…" : "OK"}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground"
      >
        ✕
      </button>
    </span>
  );
}

/**
 * Gerenciador de Lives (equipe): cadastra título, data/hora e link — a página
 * pública /lives passa a ler daqui em vez das datas fixas no código.
 */
function LivesSection({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [lives, setLives] = useState<Live[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const tk = await tokenFn();
      const res = await listLivesAdmin({ data: { accessToken: tk } });
      if (res.ok) setLives(res.lives);
      else if ("missingTable" in res && res.missingTable) setMissingTable(true);
    } catch {
      toast.error("Não foi possível carregar as lives.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const tk = await tokenFn();
      const res = await saveLive({
        data: {
          accessToken: tk,
          title: title.trim(),
          scheduledAt: when ? new Date(when).toISOString() : null,
          link: link.trim() || null,
          isPublished: true,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success("Live cadastrada 🎥");
      setTitle("");
      setWhen("");
      setLink("");
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(l: Live) {
    const tk = await tokenFn();
    const res = await saveLive({
      data: {
        accessToken: tk,
        id: l.id,
        title: l.title,
        scheduledAt: l.scheduled_at,
        link: l.link,
        isPublished: !l.is_published,
      },
    });
    if (res.ok) await load();
    else toast.error(res.error ?? "Não foi possível atualizar.");
  }

  async function removeLive(id: string) {
    const tk = await tokenFn();
    const res = await deleteLive({ data: { accessToken: tk, id } });
    if (res.ok) setLives((ls) => ls.filter((l) => l.id !== id));
    else toast.error("Não foi possível excluir.");
  }

  const fmtWhen = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "sem data";

  if (loading) return <div className="skeleton h-64 rounded-3xl" />;

  return (
    <div className="space-y-6">
      {missingTable && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
          A tabela <code>lives</code> ainda não existe no banco — rode o{" "}
          <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar o gerenciador.
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="font-serif text-xl">Nova live</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O que você cadastrar aqui aparece na página pública /lives — com contagem regressiva
          quando tiver data futura.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da live *"
            aria-label="Título da live"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label="Data e hora"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (Instagram/YouTube)"
            aria-label="Link da live"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:w-64"
          />
          <button
            onClick={create}
            disabled={saving || !title.trim()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Cadastrar"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        {lives.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma live cadastrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lives.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    📅 {fmtWhen(l.scheduled_at)}
                    {l.link ? " · 🔗 com link" : ""}
                  </p>
                </div>
                <button
                  onClick={() => togglePublish(l)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                    l.is_published
                      ? "bg-emerald-100 text-emerald-700"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {l.is_published ? "Publicada" : "Oculta"}
                </button>
                <button
                  onClick={() => removeLive(l.id)}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PacientesSection({
  tokenFn,
  onVinculoRespondido,
  abrirPacienteId,
  onAbriu,
  onDesfechoRegistrado,
}: {
  tokenFn: () => Promise<string>;
  /**
   * Avisa o painel que a lista de solicitações mudou.
   *
   * Sem isto, a seção respondia o pedido no estado INTERNO dela e a fila de
   * trabalho — que fica na mesma tela, logo acima — continuava dizendo "Ana
   * quer ser acompanhada por você" depois de o médico aceitar a Ana. Duas
   * afirmações contraditórias ao mesmo tempo, e o fantasma só saía com F5.
   */
  onVinculoRespondido?: () => void;
  /** Paciente que a fila de trabalho mandou abrir direto. */
  abrirPacienteId?: string | null;
  onAbriu?: () => void;
  /**
   * Avisa o painel que um evento clínico foi resolvido dentro do modal.
   *
   * Mesma história do `onVinculoRespondido` logo acima: o modal marcava o
   * desfecho no estado INTERNO dele, e a fila de trabalho — que fica na mesma
   * tela — continuava listando "Fulana · Pressão em faixa grave" depois de o
   * médico ter registrado que cuidou. O item só sumia no tique de 3 minutos,
   * ou com F5.
   *
   * Numa fila cujo propósito é dizer o que ainda precisa dele, um item
   * resolvido que não sai é ruído — e ruído numa fila clínica é o começo de
   * parar de olhar para ela.
   */
  onDesfechoRegistrado?: (fonte: string, fonteId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  // id da solicitação sendo respondida (desabilita os botões enquanto em voo)
  const [respondingId, setRespondingId] = useState<string | null>(null);
  // Modal "+ adicionar paciente" (convite) e modal de detalhe da paciente
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<LinkedPatient | null>(null);

  /* A fila mandou abrir uma paciente. Espera a lista carregar — o efeito roda
     de novo quando `patients` chega, então o item clicado durante o
     carregamento não se perde. */
  useEffect(() => {
    if (!abrirPacienteId || patients.length === 0) return;
    const alvo = patients.find((x) => x.id === abrirPacienteId);
    if (alvo) {
      setSelected(alvo);
      onAbriu?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirPacienteId, patients]);

  async function loadPatients() {
    const tk = await tokenFn();
    const res = await listMyPatients({ data: { accessToken: tk } });
    if (res.ok) setPatients(res.patients);
  }

  // Ativa/desativa o premium do quiz (após o PIX, o médico libera aqui)
  const [premiumBusyId, setPremiumBusyId] = useState<string | null>(null);
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [confirmarEncerrar, setConfirmarEncerrar] = useState<string | null>(null);
  const armado = useRef<number | null>(null);
  const armadoEm = useRef(0);
  useEffect(() => () => void (armado.current && clearTimeout(armado.current)), []);

  /* Encerrar o acompanhamento. Dois toques: o primeiro arma, o segundo executa,
     e a confirmação some sozinha em 4s para não ficar armada esperando um toque
     errado depois. */
  async function encerrar(p: LinkedPatient) {
    if (confirmarEncerrar !== p.id) {
      setConfirmarEncerrar(p.id);
      /* Marca do instante do armamento: um duplo toque — reflexo quando o
         primeiro parece não responder — armava e confirmava no mesmo gesto,
         desfazendo um vínculo real sem que o médico tivesse lido a palavra
         "Confirmar?". Ele não consegue reverter sozinho: só a paciente pode
         religar. Meio segundo de carência resolve. */
      armadoEm.current = Date.now();
      /* Guardado para poder ser cancelado: trocar de aba dentro dos 4 s
         desmonta a seção e o timer disparava `setState` no vazio. */
      if (armado.current) clearTimeout(armado.current);
      armado.current = setTimeout(
        () => setConfirmarEncerrar((c) => (c === p.id ? null : c)),
        4000,
      ) as unknown as number;
      return;
    }
    if (Date.now() - armadoEm.current < 500) return;
    setConfirmarEncerrar(null);
    setEncerrandoId(p.id);
    try {
      const r = await encerrarAcompanhamento({
        data: { accessToken: await tokenFn(), pacienteId: p.id },
      });
      if (!r.ok) {
        /* `ok:false` também sai quando o UPDATE não achou linha — ou seja,
           quando a paciente JÁ não é mais dele (segunda aba, retry depois de
           timeout com a escrita aplicada). Dizer "não foi possível" para uma
           ação que já deu certo faz o médico tentar de novo sem parar. Por isso
           a lista é recarregada antes de acusar falha. */
        await loadPatients();
        toast.error("Não foi possível encerrar agora — confira a lista.");
        return;
      }
      setPatients((ps) => ps.filter((x) => x.id !== p.id));
      toast.success(
        `Acompanhamento de ${(p.display_name ?? "").split(" ")[0] || "a paciente"} encerrado. A vaga do seu plano voltou.`,
      );
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setEncerrandoId(null);
    }
  }
  async function togglePremium(p: LinkedPatient) {
    setPremiumBusyId(p.id);
    try {
      const tk = await tokenFn();
      const res = await setPatientQuizPremium({
        data: { accessToken: tk, patientId: p.id, premium: !p.quiz_premium },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível alterar o premium.");
        return;
      }
      setPatients((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, quiz_premium: !p.quiz_premium } : x)),
      );
      toast.success(!p.quiz_premium ? "Aulas premium ativadas ⭐" : "Premium desativado.");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setPremiumBusyId(null);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const tk = await tokenFn();
        const [reqRes, patRes] = await Promise.all([
          listPatientRequests({ data: { accessToken: tk } }),
          listMyPatients({ data: { accessToken: tk } }),
        ]);
        if (reqRes.ok) setRequests(reqRes.requests);
        if (patRes.ok) setPatients(patRes.patients);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(req: PatientRequest, accept: boolean) {
    setRespondingId(req.id);
    try {
      const tk = await tokenFn();
      const res = await respondPatientRequest({
        data: { accessToken: tk, requestId: req.id, accept },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "limit"
            ? `Limite do plano ${res.plan} atingido (${res.limit} pacientes). Faça upgrade em Meu Perfil para aceitar mais pacientes.`
            : "Não foi possível responder à solicitação. Tente novamente.",
        );
        return;
      }
      // Remove o card otimisticamente e, ao aceitar, atualiza as pacientes.
      setRequests((rs) => rs.filter((r) => r.id !== req.id));
      onVinculoRespondido?.();
      if (accept) {
        toast.success("Paciente vinculada ✓");
        await loadPatients();
      } else {
        toast.success("Solicitação recusada.");
      }
    } finally {
      setRespondingId(null);
    }
  }

  if (loading) return <div className="skeleton h-64 rounded-3xl" />;

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div className="space-y-8">
      {/* Solicitações pendentes */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl">Solicitações pendentes</h2>
          {requests.length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {requests.length}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pacientes que pediram para acompanhar você no app. Aceite para vinculá-las.
        </p>

        {requests.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-3xl">📭</p>
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.map((r) => {
              const busy = respondingId === r.id;
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-primary/40 bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.patient_name ?? "Paciente"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Solicitado em{" "}
                        {new Date(r.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      {r.message && (
                        <p className="mt-2 rounded-xl bg-secondary/40 p-3 text-sm text-foreground">
                          “{r.message}”
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => respond(r, true)}
                        disabled={busy}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {busy ? "…" : "Aceitar"}
                      </button>
                      <button
                        onClick={() => respond(r, false)}
                        disabled={busy}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-50"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Minhas pacientes */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl">Minhas pacientes</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {patients.length}
          </span>
        </div>

        {patients.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-3xl">👩‍🍼</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Você ainda não tem pacientes vinculadas. Compartilhe seu perfil para que elas
              encontrem você e enviem uma solicitação.
            </p>
            <button
              onClick={() => setInviteOpen(true)}
              className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              + Adicionar paciente
            </button>
          </div>
        ) : (
          <>
            {/* Espelho: cada paciente pelo bebê que ela vê no app. O tamanho
                do bebê cresce com a semana — identificação visual rápida.
                2 por linha no celular, 4 no computador. Toque abre o detalhe
                com a conversa dela com a IA. O último quadro é o "+". */}
            <p className="mt-3 text-xs text-muted-foreground">
              Cada quadro é o espelho da tela do bebê da paciente — o bebê cresce com a semana.
              Toque para ver os detalhes e a conversa com a IA.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {patients.map((p) => (
                <PatientMirrorCard key={p.id} p={p} onOpen={() => setSelected(p)} />
              ))}
              {/* "+" — adicionar paciente (convite) */}
              <button
                onClick={() => setInviteOpen(true)}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:border-primary hover:bg-primary/10"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-3xl font-light leading-none">
                  +
                </span>
                <span className="px-2 text-center text-xs font-semibold">Adicionar paciente</span>
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              <ul className="divide-y divide-border">
                {patients.map((p) => {
                  const due = fmtDate(p.due_date);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-4"
                    >
                      {/* LINHA INTEIRA no celular, e isto não é preferência de
                          layout. `flex-1` é `flex: 1 1 0%` — base zero —, então
                          o bloco do nome nunca provoca quebra: ele é esmagado
                          até sumir e só depois um botão desce. Medido: com três
                          controles ao lado, o nome ficava com 0 px a 360 e 390.
                          O médico escolhia qual vínculo encerrar — ação que só
                          a paciente pode desfazer — olhando para uma inicial e
                          uma data. */}
                      <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {(p.display_name?.trim().charAt(0) || "?").toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {p.display_name ?? "Sem nome"}
                          </p>
                          {due && (
                            <p className="truncate whitespace-nowrap text-xs text-muted-foreground">
                              DPP {due}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* BPM fetal da consulta → "Sentir o coração" da família */}
                      <FetalBpmChip p={p} tokenFn={tokenFn} onSaved={loadPatients} />
                      {/* Premium do quiz: liberar após confirmar o PIX da paciente */}
                      <button
                        onClick={() => togglePremium(p)}
                        disabled={premiumBusyId === p.id}
                        title={
                          p.quiz_premium
                            ? "Aulas premium ativas — clique para desativar"
                            : "Ativar aulas premium (após confirmar o PIX)"
                        }
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                          p.quiz_premium
                            ? "bg-amber-100 text-amber-700"
                            : "border border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"
                        }`}
                      >
                        {premiumBusyId === p.id ? "…" : p.quiz_premium ? "⭐ Premium" : "☆ Premium"}
                      </button>
                      {/* Encerrar acompanhamento. Confirmação em DOIS toques e
                          não um `confirm()` do navegador: o segundo toque é o
                          mesmo botão dizendo o que vai acontecer, o que é mais
                          claro no celular e não pode ser dispensado por engano. */}
                      <button
                        onClick={() => encerrar(p)}
                        disabled={encerrandoId === p.id}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          confirmarEncerrar === p.id
                            ? "bg-rose-600 text-white"
                            : "border border-border text-muted-foreground hover:border-rose-400 hover:text-rose-600"
                        }`}
                        title="Encerrar o acompanhamento desta paciente"
                      >
                        {encerrandoId === p.id
                          ? "…"
                          : confirmarEncerrar === p.id
                            ? "Confirmar?"
                            : "Encerrar"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Modais: convite de paciente e detalhe (dados + conversa com a IA) */}
      {inviteOpen && <InvitePatientModal tokenFn={tokenFn} onClose={() => setInviteOpen(false)} />}
      {selected && (
        <PatientDetailModal
          p={selected}
          tokenFn={tokenFn}
          onClose={() => setSelected(null)}
          onDesfechoRegistrado={onDesfechoRegistrado}
        />
      )}
    </div>
  );
}

/**
 * Espelho da tela do bebê da paciente (mini). Mesmo céu dia/noite do app e o
 * bebê no tamanho da semana dela — o médico reconhece a paciente pelo bebê.
 */
function PatientMirrorCard({ p, onOpen }: { p: LinkedPatient; onOpen?: () => void }) {
  const period = periodFor(new Date().getHours());
  const dark = period === "madrugada" || period === "noite";
  const weeks = p.weeks ?? null;
  return (
    <button
      onClick={onOpen}
      className="overflow-hidden rounded-2xl border border-border text-left shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <div
        className="relative flex aspect-square items-center justify-center"
        style={{ background: gradientFor(period, 1) }}
      >
        {weeks ? (
          <>
            <BabyIllustration
              week={weeks}
              tone={p.baby_skin_tone ?? 0}
              showSac={false}
              showInfo={false}
              className="h-[70%] w-[70%] drop-shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
            />
            <span
              className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                dark ? "bg-white/15 text-white/90" : "bg-white/70 text-foreground"
              }`}
            >
              {weeks} sem
            </span>
          </>
        ) : (
          <span
            className={`px-2 text-center text-[11px] ${dark ? "text-white/70" : "text-muted-foreground"}`}
          >
            Sem data de gestação
          </span>
        )}
        {/* Nome sobre um véu escuro na base — legível em qualquer céu */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2.5 py-2">
          <p className="truncate text-[11px] font-semibold text-white">
            {p.display_name ?? "Paciente"}
          </p>
        </div>
      </div>
    </button>
  );
}

/**
 * "+ Adicionar paciente": a paciente é quem se vincula (ela cria a conta e
 * envia a solicitação) — o modal entrega a mensagem-convite pronta com o
 * link, para copiar ou mandar direto no WhatsApp.
 */
function InvitePatientModal({
  tokenFn,
  onClose,
}: {
  tokenFn: () => Promise<string>;
  onClose: () => void;
}) {
  const [doctorName, setDoctorName] =
    /* Começa vazio: mostrar o nome do dono da instalação por meio segundo faz o
     médico copiar uma mensagem assinada por outra pessoa — os botões de copiar
     e de WhatsApp já estão vivos no primeiro quadro. */
    useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyDoctor({ data: { accessToken: await tokenFn() } });
        if (res.ok && res.doctor?.display_name) setDoctorName(res.doctor.display_name);
      } catch {
        /* mantém o nome padrão */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = `${DOCTOR.siteUrl}/encontrar-medico`;
  const message = `Olá! Sou ${doctorName}. Para acompanhar sua gestação comigo pelo app Obstétrica: crie sua conta em ${DOCTOR.siteUrl}, toque em "Encontrar médico", busque meu nome (${doctorName}) e envie a solicitação — eu aceito por aqui. 💛`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-xl">Adicionar paciente</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A paciente cria a conta, busca você em "Encontrar médico" e envia a solicitação — você
              aceita aqui na aba Pacientes. Envie o convite pronto:
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed">
          {message}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white"
          >
            Enviar no WhatsApp
          </a>
          <button
            onClick={copy}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
          >
            {copied ? "Copiado ✓" : "Copiar mensagem"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Link direto: <span className="font-medium text-foreground">{link}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Detalhe da paciente: espelho grande do bebê + dados (semana, DPP, BPM) e a
 * CONVERSA dela com a IA (somente leitura) — o mesmo acesso individual da aba
 * Cérebro, agora a um toque do quadro dela.
 */
function PatientDetailModal({
  p,
  tokenFn,
  onClose,
  onDesfechoRegistrado,
}: {
  p: LinkedPatient;
  tokenFn: () => Promise<string>;
  onClose: () => void;
  /** Sobe o desfecho para a fila de trabalho do painel. Ver PacientesSection. */
  onDesfechoRegistrado?: (fonte: string, fonteId: string) => void;
}) {
  const [messages, setMessages] = useState<BrainChatMessage[] | null>(null);
  /* A ficha clínica dela. O espelho do bebê já estava aqui, mas a aba
     "Pacientes" era justamente a que tinha MENOS dado clínico do painel: peso,
     pressão, glicemia, diário e chutes só apareciam em Pré-consultas e
     Engajamento, dois lugares que o médico não abre para olhar uma paciente
     específica. Quem clica numa paciente quer a paciente inteira. */
  const [ficha, setFicha] = useState<any | null>(null);
  const [sosDela, setSosDela] = useState<AcionamentoSos[]>([]);
  /* O PRONTUÁRIO. Vem do fluxo unificado de eventos clínicos, que enxerga onze
     fontes — contra as seis que o relatório antigo lia, e sem a janela de
     catorze dias que fazia uma medida de vinte dias atrás aparecer como "—",
     indistinguível de "ela nunca registrou". */
  const [prontuario, setProntuario] = useState<EventoClinico[]>([]);
  const [fichaClin, setFichaClin] = useState<FichaClinica | null>(null);
  const [carregandoProntuario, setCarregandoProntuario] = useState(true);
  const [prontuarioIncompleto, setProntuarioIncompleto] = useState(false);
  const [registrandoDesfecho, setRegistrandoDesfecho] = useState<string | null>(null);
  const [consultasDela, setConsultasDela] = useState<Consulta[]>([]);

  useEffect(() => {
    (async () => {
      const tk = await tokenFn();
      try {
        const res = await getBrainConversation({ data: { accessToken: tk, patientId: p.id } });
        setMessages(res.ok ? res.messages : []);
      } catch {
        setMessages([]);
      }
      try {
        const rep = await getPatientReport({ data: { accessToken: tk, userId: p.id } });
        setFicha(rep.ok ? rep : null);
      } catch {
        setFicha(null);
      }
      /* Acionamentos de SOS dela. Fica na ficha e não numa aba separada porque
         é dado clínico: quantas vezes ela acionou, por quê e quando, ao lado do
         peso e da pressão. Numa gestação de alto risco isso é prontuário. */
      try {
        const so = await acionamentosDaPaciente({ data: { accessToken: tk, pacienteId: p.id } });
        setSosDela(so.ok ? so.acionamentos : []);
      } catch {
        setSosDela([]);
      }
      try {
        const [pr, fc, cs] = await Promise.all([
          prontuarioDaPaciente({ data: { accessToken: tk, pacienteId: p.id } }),
          fichaClinica({ data: { accessToken: tk, pacienteId: p.id } }),
          consultasDaPaciente({ data: { accessToken: tk, pacienteId: p.id } }),
        ]);
        setProntuario(pr.ok ? pr.eventos : []);
        setProntuarioIncompleto(!pr.ok || pr.incompleto);
        setFichaClin(fc.ok ? fc.ficha : null);
        setConsultasDela(cs.ok ? cs.consultas : []);
      } catch {
        setProntuarioIncompleto(true);
      } finally {
        setCarregandoProntuario(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  /* Último de cada medida. O médico não quer a série inteira num modal — quer
     o valor mais recente e a data, que é o que ele olharia na consulta.
     
     `health_logs` guarda uma LINHA POR DIA com várias medidas (peso, sistólica,
     diastólica, glicemia), e cada uma pode estar vazia naquele dia. Então o
     "último peso" não é a última linha: é a última linha em que o peso foi
     preenchido. Procurar na linha mais recente daria "—" para quem mediu a
     pressão hoje e o peso ontem. */
  const ultimoOnde = (tem: (l: any) => boolean, ler: (l: any) => string) => {
    const l = (ficha?.healthLogs ?? []).find((x: any) => tem(x));
    return l ? { valor: ler(l), quando: l.log_date ?? l.created_at } : null;
  };
  const medidas = [
    {
      rot: "Peso",
      v: ultimoOnde(
        (l) => l.weight_kg != null,
        (l) => `${l.weight_kg} kg`,
      ),
    },
    {
      rot: "Pressão",
      v: ultimoOnde(
        (l) => l.systolic != null && l.diastolic != null,
        (l) => {
          /* A marca vem da MESMA regra que a aba de Engajamento usa. Duas
             faixas diferentes na mesma tela ensinariam o médico a ignorar a
             cor — que é o pior desfecho possível para um alerta. */
          const sn = sinalPressao(l.systolic, l.diastolic);
          const m = sn?.gravidade === "grave" ? "🔴 " : sn?.gravidade === "atencao" ? "⚠️ " : "";
          return `${m}${l.systolic}/${l.diastolic}`;
        },
      ),
    },
    {
      rot: "Glicemia",
      v: ultimoOnde(
        (l) => l.glucose_mg_dl != null,
        (l) => {
          const sn = sinalGlicemia(l.glucose_mg_dl);
          const m = sn?.gravidade === "grave" ? "🔴 " : sn?.gravidade === "atencao" ? "⚠️ " : "";
          return `${m}${l.glucose_mg_dl}`;
        },
      ),
    },
  ];

  const period = periodFor(new Date().getHours());
  const weeks = p.weeks ?? null;
  const due = p.due_date
    ? new Date(p.due_date + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho: espelho do céu + bebê da semana.
            Mais baixo do que era: ocupava metade da altura útil do modal, e
            quem abre a ficha de uma paciente às 13h50 não veio ver o desenho. */}
        <div
          className="relative flex h-24 shrink-0 items-center justify-center"
          style={{ background: gradientFor(period, 1) }}
        >
          {weeks ? (
            <BabyIllustration
              week={weeks}
              tone={p.baby_skin_tone ?? 0}
              showSac={false}
              showInfo={false}
              className="h-[80%] w-auto drop-shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
            />
          ) : (
            <span className="text-sm text-white/80">Sem data de gestação</span>
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-xs text-white"
          >
            ✕
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 py-2.5">
            <p className="truncate font-serif text-lg text-white">{p.display_name ?? "Paciente"}</p>
          </div>
        </div>

        {/* O PRONTUÁRIO — primeiro, porque é o que ele veio ver. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
          <ProntuarioPaciente
            ficha={fichaClin}
            eventos={prontuario}
            carregando={carregandoProntuario}
            incompleto={prontuarioIncompleto}
            registrando={registrandoDesfecho}
            consultas={consultasDela}
            aoRegistrarConsulta={
              <RegistrarConsulta
                pacienteId={p.id}
                tokenFn={tokenFn}
                onSalvou={async () => {
                  /* Recarrega só as consultas: o resto da ficha não mudou, e
                     recarregar tudo faria a tela piscar inteira depois de uma
                     ação pequena. */
                  try {
                    const cs = await consultasDaPaciente({
                      data: { accessToken: await tokenFn(), pacienteId: p.id },
                    });
                    if (cs.ok) setConsultasDela(cs.consultas);
                  } catch {
                    /* fica com a lista anterior; o registro já foi salvo */
                  }
                }}
              />
            }
            onRegistrarDesfecho={async (fonte, fonteId) => {
              const chave = `${fonte}:${fonteId}`;
              setRegistrandoDesfecho(chave);
              try {
                const r = await registrarDesfecho({
                  data: { accessToken: await tokenFn(), fonte, fonteId, pacienteId: p.id },
                });
                if (!r.ok) throw new Error("recusado");
                /* Some da lista de pendentes na hora, sem recarregar tudo: o
                   `tratado_em` é o que a tela usa para filtrar. */
                setProntuario((es) =>
                  es.map((e) =>
                    e.fonte === fonte && e.fonte_id === fonteId
                      ? { ...e, tratado_em: new Date().toISOString() }
                      : e,
                  ),
                );
                /* E na fila do painel também: os dois estados mostram o MESMO
                   evento, e atualizar só um deixava a tela se contradizendo. */
                onDesfechoRegistrado?.(fonte, fonteId);
              } catch {
                toast.error("Não consegui registrar. Tente de novo.");
              } finally {
                setRegistrandoDesfecho(null);
              }
            }}
          />

          {/* Dados rápidos — o espelho do bebê e os controles ficam DEPOIS do
              prontuário, dentro da mesma rolagem. */}
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {weeks != null ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {/* Com os dias: conduta em 36s0d não é conduta em 36s6d, e a tela
                  dela sempre mostrou os dois. */}
                {weeks} semanas{p.days != null ? ` e ${p.days}d` : ""}
              </span>
            ) : p.birth_date ? (
              /* Puérpera: antes o painel dizia "Sem data de gestação" para quem
               já teve o bebê, enquanto a tela dela contava os dias de vida. */
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                🍼{" "}
                {(() => {
                  const dias = Math.floor(
                    (Date.now() - new Date(`${p.birth_date}T00:00:00`).getTime()) / 86400000,
                  );
                  if (dias < 0) return "recém-nascido";
                  if (dias < 14) return `${dias} ${dias === 1 ? "dia" : "dias"} de vida`;
                  const sem = Math.floor(dias / 7);
                  return `${sem} ${sem === 1 ? "semana" : "semanas"} de vida`;
                })()}
              </span>
            ) : null}
            {due && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                DPP {due}
              </span>
            )}
            {p.fetal_bpm != null && (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600">
                💓 {p.fetal_bpm} bpm
              </span>
            )}
            {p.quiz_premium && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                ⭐ Premium
              </span>
            )}
          </div>

          {/* Histórico de emergências ANTES dos registros: se ela acionou o SOS,
              é a primeira coisa que o médico precisa ver ao abrir a ficha. */}
          {sosDela.length > 0 && (
            <div className="px-4 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300">
                🆘 Acionamentos de emergência ({sosDela.length})
              </p>
              <div className="mt-1.5 space-y-1.5">
                {sosDela.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-rose-200 bg-rose-50/60 p-2.5 dark:border-rose-500/30 dark:bg-rose-500/10"
                  >
                    <p className="text-[12px] font-semibold text-foreground">
                      {new Date(a.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {a.motivo ? ` · ${a.motivo}` : ""}
                      {a.ficha?.semana ? ` · ${a.ficha.semana}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {a.atendido_em
                        ? `Atendido em ${new Date(a.atendido_em).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Sem desfecho registrado"}
                      {a.address ? ` · ${a.address}` : ""}
                    </p>
                  </div>
                ))}
                {sosDela.length > 5 && (
                  <p className="text-[11px] text-muted-foreground">
                    + {sosDela.length - 5} mais antigos
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Ficha clínica — o que ela registrou no app */}
          {ficha && (
            <div className="px-4 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                🩺 Registros dela
              </p>
              {/* Sem esta linha, "sem etiqueta" era lido como "está tudo bem" — e
                cobre também "não mediu" e "mediu errado". A tela nunca deve
                deixar o médico concluir nada a partir da AUSÊNCIA de marca. */}
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Medidas informadas por ela no app, não aferidas em consultório. Sem etiqueta
                significa dentro da faixa de referência ou sem registro — não é diagnóstico.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {medidas.map(({ rot, v }) => (
                  <div key={rot} className="rounded-2xl border border-border p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {rot}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-foreground">{v ? v.valor : "—"}</p>
                    {v?.quando && (
                      <p className="text-[9.5px] text-muted-foreground">
                        {new Date(`${String(v.quando).slice(0, 10)}T00:00:00`).toLocaleDateString(
                          "pt-BR",
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                  📓 {(ficha.journals ?? []).length} no diário
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                  🦶 {(ficha.kicks ?? []).length} sessões de chutes
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                  ❓ {(ficha.pendingQuestions ?? []).length} perguntas
                </span>
              </div>
              {/* Dados clínicos do perfil: o que ela levaria escrito na
                carteirinha. É o que muda a conduta numa emergência. */}
              {(ficha.profile?.blood_type ||
                ficha.profile?.allergies ||
                ficha.profile?.medications) && (
                <div className="mt-2 rounded-2xl bg-secondary/50 p-2.5 text-[11.5px] leading-snug">
                  {ficha.profile?.blood_type && (
                    <p>
                      <span className="font-semibold">Sangue:</span> {ficha.profile.blood_type}
                    </p>
                  )}
                  {ficha.profile?.allergies && (
                    <p>
                      <span className="font-semibold">Alergias:</span> {ficha.profile.allergies}
                    </p>
                  )}
                  {ficha.profile?.medications && (
                    <p>
                      <span className="font-semibold">Medicamentos:</span>{" "}
                      {ficha.profile.medications}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conversa com a IA (somente leitura) */}
          <div className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              💬 Conversa com a IA
            </p>
            {messages === null ? (
              <div className="mt-2 space-y-2">
                <div className="h-12 animate-pulse rounded-xl bg-secondary" />
                <div className="h-12 animate-pulse rounded-xl bg-secondary" />
              </div>
            ) : messages.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ela ainda não conversou com a IA (ou o histórico ainda não foi ativado no banco).
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                        m.role === "user"
                          ? "rounded-br-sm bg-primary/10 text-foreground"
                          : "rounded-bl-sm bg-secondary"
                      }`}
                    >
                      {m.content}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {m.role === "user" ? "Paciente" : "IA"} ·{" "}
                        {new Date(m.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
