import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Mic, Send } from "lucide-react";
import { toast } from "sonner";
import { Bolha } from "@/components/bolha";
import { avisoQuePodeAparecer, lerLinhaDoStream, passoDaDigitacao } from "@/lib/chat-stream";
import { supabase } from "@/integrations/supabase/client";
import { DOCTOR } from "@/lib/doctor.config";
import { nomeDoMedico } from "@/lib/nome-do-medico";
import { getMyDoctorLink } from "@/lib/patientlink.functions";
import { submitBrainFeedback } from "@/lib/secondbrain.functions";
import type { Gest, Profile } from "@/routes/_authenticated/minha-conta";

/**
 * O CHAT DA PACIENTE — a conversa com a bolha (a IA do consultório).
 *
 * Saiu de `minha-conta.tsx` (set/2026) como um MOVE, byte a byte, pelas duas
 * razões de sempre: um `export function` num arquivo de ROTA entra no pedaço
 * da árvore de rotas que toda página carrega, e um componente de 1.250 linhas
 * dentro de um arquivo de 20 mil não tem como ser redesenhado com segurança.
 * O redesenho (pedido do dono: "o design dele não está interessante", e o
 * campo que empurra a tela ao ganhar foco) vem no commit seguinte, neste
 * arquivo.
 */

/* ---------- Chat IA ---------- */

function buildPatientContext(profile: Profile | null, gest: Gest): string {
  if (!profile) return "";
  /* ─── O CAMINHO EM QUE O SERVIDOR NÃO SABE DE NADA ───────────────────────
   * Este prefixo vai na PRIMEIRA mensagem e é a única coisa que o modelo sabe
   * sobre ela quando `resolvePatientDoctor` devolve null (token expirado,
   * soluço no Auth): ali o `clinicalBlock` nem é calculado e o system vira o
   * prompt público. Sem esta guarda, a mulher em luto mandava, com as próprias
   * palavras aparentes, "estou na semana 24 e o nome do meu bebê é Lucas".
   * `gest` já vem nulo em Modo Cuidado; o NOME não vinha. */
  const emLuto = Boolean((profile as { care_mode?: boolean }).care_mode);
  const parts: string[] = [];
  if (profile.display_name) parts.push(`Meu nome é ${profile.display_name}.`);
  if (gest) {
    parts.push(`Estou na semana ${gest.weeks} e ${gest.days} dias de gestação.`);
  }
  if (profile.baby_name && !emLuto) parts.push(`O nome do meu bebê é ${profile.baby_name}.`);
  return parts.join(" ");
}

/**
 * "Dr. Clóvis Bacha" → "Dr. Clóvis IA".
 *
 * Título + primeiro nome, não o nome inteiro: "Dr. Clóvis Bacha IA" não cabe
 * no cabeçalho de um celular e soa a crachá. Sem título reconhecido, fica só
 * o primeiro nome — vale para médica, para nome composto e para quem cadastrou
 * o nome sem "Dr.".
 */
function aiNameFrom(displayName: string | null | undefined): string {
  /* A régua de "título + primeiro nome" mora em `nome-do-medico.ts`, e não
     mais aqui: o aviso de presente precisou da MESMA conta, e uma segunda
     cópia é como a mesma pessoa vira "Dr. Clóvis" numa tela e "Dr." na
     outra. O que continua sendo desta tela é só o fallback. */
  const base = nomeDoMedico(displayName);
  return base ? `${base} IA` : "Assistente IA";
}

/** As perguntas que o campo de mensagem digita sozinho quando está vazio. */
const CHAT_SUGESTOES = [
  "Posso tomar dipirona?",
  "Esse exame está normal?",
  "Quantos chutes por dia?",
  "O que ajuda na azia?",
  "Posso viajar de avião?",
  "Quando ir para a maternidade?",
];

/**
 * Texto que se digita, apaga e troca de frase — só enquanto o campo está
 * vazio e a paciente não está escrevendo.
 *
 * `prefers-reduced-motion` não recebe uma versão sem graça: recebe a primeira
 * frase inteira, parada. Texto que aparece letra por letra é exatamente o tipo
 * de movimento que essa preferência existe para desligar.
 */
function useTypedPlaceholder(frases: string[], ativo: boolean): string {
  const [texto, setTexto] = useState("");
  const [parado, setParado] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ler = () => setParado(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);

  useEffect(() => {
    if (!ativo || parado) return;
    let i = 0;
    let n = 0;
    let apagando = false;
    let timer: ReturnType<typeof setTimeout>;
    const passo = () => {
      const frase = frases[i % frases.length];
      n += apagando ? -1 : 1;
      setTexto(frase.slice(0, n));
      let espera = apagando ? 26 : 52;
      if (!apagando && n === frase.length) {
        apagando = true;
        espera = 2100; // a frase fica parada tempo de ser lida
      } else if (apagando && n === 0) {
        apagando = false;
        i += 1;
        espera = 420;
      }
      timer = setTimeout(passo, espera);
    };
    timer = setTimeout(passo, 700);
    return () => clearTimeout(timer);
  }, [frases, ativo, parado]);

  if (parado) return frases[0];
  return texto;
}

// ─── WhatsApp-style chat ─────────────────────────────────────────────────────

type WAMsg = {
  role: "user" | "assistant";
  content: string;
  ts: Date;
  audioUrl?: string;
  audioDuration?: string;
  fileName?: string;
  fileSize?: string;
  /** Mensagem de erro transitório — não votável. */
  error?: boolean;
};

/**
 * O rosto da IA. Não é uma foto nem um robô: é uma pedra de vidro com luz
 * própria, do mesmo material do resto da tela, e uma faísca dentro. Diz
 * "máquina" sem fingir ser gente — que é a linha que este assistente não
 * pode cruzar, já que ele fala em nome de um consultório.
 */
/**
 * O avatar de quem responde no chat É A BOLHA — decisão do dono.
 *
 * Era um orbe roxo genérico com duas faíscas. A paciente toca na BOLHA na home
 * para chegar aqui, e chegava numa tela onde ela não estava: o personagem que a
 * trouxe sumia na porta, e quem respondia era um ícone de IA de catálogo.
 * Agora quem fala é quem ela tocou.
 *
 * ⚠️ `flutua={false}`: a bolha da home respira e flutua porque é UMA, sozinha
 * no céu. Aqui ela aparece em cada mensagem da conversa — trinta bolhas
 * flutuando viram ruído, e a repintura contínua num histórico longo custa
 * bateria. Parada, ela é avatar; flutuando, é trinta personagens.
 *
 * ⚠️ `humor="feliz"` fixo, pelo mesmo padrão de `estudiosa`/`exercicio`: é
 * identidade da TELA, não estado da jornada — e `Bolha` já rebaixa qualquer
 * humor festivo sozinha no Modo Cuidado, então `careMode` passa adiante.
 */
function AiAvatar({
  tamanho = 36,
  careMode = false,
  className = "",
}: {
  tamanho?: number;
  careMode?: boolean;
  /** Só posicionamento no pai (`self-end`, margens) — o desenho é da Bolha. */
  className?: string;
}) {
  return (
    <span aria-hidden className={`relative flex shrink-0 items-center justify-center ${className}`}>
      <Bolha humor="feliz" tamanho={tamanho} flutua={false} careMode={careMode} />
    </span>
  );
}

function WABubble({
  msg,
  careMode = false,
  feedback,
  onFeedback,
  terminada = true,
}: {
  msg: WAMsg;
  /** A bolha-avatar rebaixa humor festivo no luto — precisa saber. */
  careMode?: boolean;
  /** Voto já dado nesta resposta (persistido no estado do chat). */
  /* `down-fila` distingue "chegou ao médico" de "só registrado" — a frase de
     confirmação muda, porque prometer o que não aconteceu deixa a paciente
     esperando resposta que ninguém vai dar. */
  feedback?: "up" | "down" | "down-fila";
  /** Presente só em respostas da IA elegíveis a avaliação. */
  onFeedback?: (helpful: boolean) => void;
  /** `false` só na mensagem que ainda está chegando pelo streaming. */
  terminada?: boolean;
}) {
  const isUser = msg.role === "user";
  const timeStr = msg.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className={`mb-1 flex items-end gap-1.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && <AiAvatar tamanho={28} careMode={careMode} className="mb-0.5 self-end" />}
      <div
        className={`max-w-[78%] overflow-hidden ${
          isUser
            ? "rounded-3xl rounded-br-md bg-primary text-primary-foreground shadow-[0_10px_22px_-12px_rgba(224,85,122,0.7)]"
            : "card-material rounded-3xl rounded-bl-md text-foreground"
        }`}
      >
        {/* Áudio */}
        {msg.audioUrl && (
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ minWidth: 180 }}>
            <button
              onClick={() => {
                if (!audioRef.current) return;
                if (playing) {
                  audioRef.current.pause();
                  setPlaying(false);
                } else {
                  audioRef.current.play().then(() => setPlaying(true));
                }
              }}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] ${
                isUser ? "bg-white/25 text-primary-foreground" : "bg-foreground/8 text-foreground"
              }`}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <div className="flex flex-1 items-center gap-[2px]">
              {[3, 6, 4, 9, 5, 7, 4, 8, 6, 5, 9, 4, 7, 5, 8].map((h, i) => (
                <div
                  key={i}
                  className={`w-[2px] shrink-0 rounded-full ${isUser ? "bg-white/70" : "bg-foreground/40"}`}
                  style={{ height: h }}
                />
              ))}
            </div>
            <span
              className={`shrink-0 text-xs ${isUser ? "text-white/80" : "text-muted-foreground"}`}
            >
              {msg.audioDuration ?? "0:00"}
            </span>
            <audio
              ref={audioRef}
              src={msg.audioUrl}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </div>
        )}
        {/* Arquivo */}
        {msg.fileName && (
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ minWidth: 180 }}>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                isUser ? "bg-white/20" : "bg-foreground/8"
              }`}
            >
              📄
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-semibold">{msg.fileName}</p>
              {msg.fileSize && (
                <p
                  className={`mt-0.5 text-xs ${isUser ? "text-white/80" : "text-muted-foreground"}`}
                >
                  {msg.fileSize}
                </p>
              )}
            </div>
          </div>
        )}
        {/* Texto — 16px: é o piso de leitura, e é o tamanho em que uma
            conversa longa se lê deitada. */}
        {msg.content && (
          <p className="whitespace-pre-wrap px-4 pt-3 text-[16px] leading-[1.5]">{msg.content}</p>
        )}
        {/* RESPOSTA VAZIA — ver o histórico deste bloco: o modelo às vezes
            termina sem texto, e uma bolha muda é pior que um erro. Só depois
            que a mensagem terminou de chegar. */}
        {!isUser && terminada && !msg.content && !msg.fileName && !msg.audioUrl && (
          <p className="px-4 pt-3 text-[16px] italic leading-[1.5] text-muted-foreground">
            Não consegui formular a resposta agora. Pode perguntar de novo?
          </p>
        )}
        {/* Hora + 👍👎 (só em respostas da IA) */}
        <div className="flex items-center justify-end gap-1 px-3 pb-2 pt-1">
          {!isUser && onFeedback && (
            <span className="mr-auto flex items-center gap-1.5">
              {feedback ? (
                <span className="text-xs text-muted-foreground">
                  {/* A frase segue o que o servidor de fato fez — ver
                      `submitBrainFeedback`: só promete "seu médico vai ver"
                      quando o 👎 entrou na fila dele. */}
                  {feedback === "up"
                    ? "Obrigado! 💛"
                    : feedback === "down-fila"
                      ? "Anotado — seu médico vai ver 💛"
                      : "Obrigada pelo aviso 💛"}
                </span>
              ) : (
                <>
                  <button
                    onClick={() => onFeedback(true)}
                    aria-label="Resposta útil"
                    className="press flex h-9 w-9 items-center justify-center rounded-full text-[15px] leading-none opacity-70 hover:opacity-100"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => onFeedback(false)}
                    aria-label="Resposta não ajudou"
                    className="press flex h-9 w-9 items-center justify-center rounded-full text-[15px] leading-none opacity-70 hover:opacity-100"
                  >
                    👎
                  </button>
                </>
              )}
            </span>
          )}
          <span
            className={`text-xs leading-none ${isUser ? "text-white/80" : "text-muted-foreground"}`}
          >
            {timeStr}
          </span>
          {isUser && <span className="text-xs leading-none text-white/85">✓✓</span>}
        </div>
      </div>
    </div>
  );
}

export function ChatTab({
  profile,
  gest,
  careMode = false,
  onVoltar,
}: {
  /**
   * A seta do cabeçalho, só no celular. O chat cobre a tela inteira ali (ver
   * o container), então a barra de voltar da página fica por baixo — sem esta
   * prop a paciente não teria como sair da conversa.
   */
  onVoltar?: () => void;
  profile: Profile | null;
  gest: Gest;
  /* ─── O CHAT ERA A ÚNICA ABA QUE NÃO RECEBIA ISTO ────────────────────────
     Todas as outras recebem `careMode`. O Chat IA e a Nutrição não recebiam —
     e são justamente as duas que FALAM com ela.
     O servidor foi reescrito para que, em Modo Cuidado, a semana e o trimestre
     nunca entrem no prompt. E a primeira bolha da tela, escrita como se fosse
     a IA, abria com "Você está na semana 24". A proibição do servidor e o
     texto da tela se contradiziam na mesma conversa. */
  careMode?: boolean;
}) {
  const ctx = buildPatientContext(profile, gest);
  const firstName = profile?.display_name?.split(" ")[0];

  /* O nome do consultório de VERDADE. Cada paciente é de um médico, então
     "Dr. Clóvis" no código seria errado para todo mundo menos os dele. */
  const [doctorName, setDoctorName] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) {
          /* Sem sessão aqui é anomalia (a aba vive dentro de `_authenticated`),
             e ficar com o rótulo genérico para sempre seria pior que usar o
             médico desta instalação — o mesmo destino do `catch`. */
          if (vivo) setDoctorName(DOCTOR.name);
          return;
        }
        const res = await getMyDoctorLink({ data: { accessToken: s.session.access_token } });
        if (!vivo) return;
        if (res.ok && res.link.doctor?.display_name) setDoctorName(res.link.doctor.display_name);
        else setDoctorName(DOCTOR.name);
      } catch {
        if (vivo) setDoctorName(DOCTOR.name);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  /* Antes de a resposta chegar fica "Assistente IA" e não um nome chutado:
     mostrar o médico errado por meio segundo é pior do que não mostrar. */
  const aiName = doctorName ? aiNameFrom(doctorName) : "Assistente IA";

  const greeting = [
    firstName ? `Olá, ${firstName}!` : "Olá!",
    /* Em Modo Cuidado a semana some daqui também. Não é detalhe de texto: é a
       PRIMEIRA coisa que ela lê ao abrir o chat, e dizia "você está na semana
       24" para quem acabou de perder o bebê. */
    !careMode && gest
      ? `Você está na semana ${gest.weeks} — vou responder levando em conta sua gestação.`
      : "",
    "Sou o assistente virtual do consultório do seu obstetra. Como posso ajudar?",
  ]
    .filter(Boolean)
    .join(" ");

  /* Começa VAZIO, não com a saudação.

     Se nascesse com a saudação, ela apareceria e seria trocada pelo histórico
     meio segundo depois — um salto visível, logo na abertura. Como não dá para
     saber de antemão se existe conversa anterior, a lista fica vazia até a
     resposta chegar, e aí é uma coisa ou outra. */
  const [messages, setMessages] = useState<WAMsg[]>([]);

  /* O HISTÓRICO na tela.

     Tudo o que ela conversou já era guardado, e o servidor reconstruía as
     últimas 12 a cada mensagem — é por isso que a IA lembra do que foi dito
     ontem. A TELA não: abria com a saudação e mais nada, toda vez. A paciente
     perguntava sobre uma dor na terça, voltava na quinta e não achava a
     resposta que tinha recebido, enquanto a IA continuava lembrando.

     A IA lembrava e ela não. */
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  useEffect(() => {
    let vivo = true;
    /* Toda saída deste efeito passa por aqui: sem sessão, sem histórico, erro
       de rede. Em todos os casos a paciente precisa ver ALGUMA coisa — um chat
       em branco para sempre porque o banco não respondeu é pior que um chat sem
       histórico. */
    const abrirVazio = () => {
      if (!vivo) return;
      setMessages((ms) =>
        ms.length === 0 ? [{ role: "assistant", content: greeting, ts: new Date() }] : ms,
      );
      setCarregandoHistorico(false);
    };
    void (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session?.access_token) return abrirVazio();
        const { historicoDaConversa } = await import("@/lib/historico-chat.functions");
        const r = await historicoDaConversa({
          data: { accessToken: sess.session.access_token },
        });
        if (!vivo) return;
        if (!r.ok || r.mensagens.length === 0) return abrirVazio();
        setMessages((ms) => {
          /* Se ela já escreveu enquanto o banco respondia, o que acabou de
             digitar vale mais que o histórico — não se sobrescreve. */
          if (ms.length > 0) return ms;
          return r.mensagens.map((m) => ({
            role: m.role,
            content: m.content,
            ts: new Date(m.created_at),
          }));
        });
        setCarregandoHistorico(false);
      } catch {
        abrirVazio();
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /* Quando o nome do consultório chega, a saudação passa a citá-lo — mas SÓ
     se a conversa ainda não começou. Reescrever uma mensagem que a paciente
     já leu e respondeu seria adulterar o histórico dela. */
  useEffect(() => {
    if (!doctorName) return;
    setMessages((ms) => {
      if (ms.length !== 1 || ms[0].role !== "assistant") return ms;
      return [
        {
          ...ms[0],
          content: ms[0].content.replace(
            "do consultório do seu obstetra",
            `do consultório do ${doctorName}`,
          ),
        },
      ];
    });
    /* `messages.length` nas dependências, e não só `doctorName`.

       A lista agora começa VAZIA e só ganha a saudação quando o histórico
       responde. Se o nome do consultório chegasse ANTES disso — o caso comum,
       porque é uma consulta mais rápida —, este efeito rodaria com a lista
       vazia, não faria nada, e a saudação apareceria depois para sempre com o
       texto genérico. */
  }, [doctorName, messages.length]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  /* O texto que se digita sozinho para de digitar assim que a paciente entra
     no campo: escrever POR CIMA de algo que está se movendo é desconcertante,
     mesmo que o convite desapareça no primeiro caractere. */
  const [focado, setFocado] = useState(false);
  const typed = useTypedPlaceholder(CHAT_SUGESTOES, !input && !focado);
  // Feedback 👍👎 por índice de mensagem — o 👎 vira lacuna na fila do médico.
  /* `down-fila` = o 👎 chegou de fato ao médico (virou lacuna ou revisão);
     `down` = registrado, mas não gerou trabalho para ele. A tela precisa saber
     a diferença para não prometer o que não aconteceu. */
  const [votes, setVotes] = useState<Record<number, "up" | "down" | "down-fila">>({});

  /* ─── A RESPOSTA APARECE SENDO ESCRITA ─────────────────────────────────────
     O streaming já entregava a resposta em pedaços, mas cada pedaço virava um
     `setState` imediato — e o modelo manda blocos grandes, então o texto
     surgia aos trancos: nada, nada, parágrafo inteiro.

     Aqui a CHEGADA é separada da EXIBIÇÃO. O que chega vai para `alvoRef`; o
     que aparece avança sozinho, quadro a quadro, até alcançar. A paciente vê a
     resposta sendo escrita, que é o que uma conversa parece.

     O passo é adaptativo de propósito: quanto mais texto acumulado, mais
     rápido ele anda. Um ritmo fixo faria a paciente esperar depois de a
     resposta inteira já ter chegado — trocaria um defeito por outro, e o
     segundo é pior, porque é tempo que ela perde sem ganhar nada. */
  const alvoRef = useRef("");
  const mostradoRef = useRef(0);
  const quadroRef = useRef<number | null>(null);
  const streamAbertoRef = useRef(false);
  /* O texto que o SERVIDOR mandou quando recusou a requisição (429 do
     limitador, manutenção). O `catch` monta a bolha de erro e não tem acesso à
     resposta HTTP — sem este ref, a mensagem acionável era descartada e a
     paciente recebia o genérico. */
  const avisoDoServidorRef = useRef<string | null>(null);
  /** O que cancela a resposta em andamento (botão "Parar"). */
  const pararRef = useRef<AbortController | null>(null);

  /* Quem pede menos movimento recebe o texto inteiro de uma vez. A animação
     aqui é conforto, nunca informação — nada se perde ao desligá-la. */
  const semAnimacao =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    /* Sair da tela no meio da digitação não pode deixar um laço de quadros
       vivo chamando `setState` num componente que não existe mais. */
    return () => {
      if (quadroRef.current !== null) cancelAnimationFrame(quadroRef.current);
      quadroRef.current = null;
      streamAbertoRef.current = false;
    };
  }, []);

  function voteMessage(i: number, helpful: boolean) {
    setVotes((v) => ({ ...v, [i]: helpful ? "up" : "down" }));
    void (async () => {
      try {
        const q = messages
          .slice(0, i)
          .reverse()
          .find((x) => x.role === "user")?.content;
        if (!q) return;
        /* A RESPOSTA vai junto agora.
           Antes só a pergunta viajava — e a pergunta é justamente a única coisa
           que não estava errada. Sem o texto que ela leu, o médico revisaria no
           escuro: veria a dúvida e teria que adivinhar o que a IA respondeu. */
        const resposta = messages[i]?.content ?? "";
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const r = await submitBrainFeedback({
          data: {
            accessToken: s.session.access_token,
            question: q,
            ...(resposta ? { answer: resposta } : {}),
            helpful,
          },
        });
        /* Só promete quando o servidor confirma que enfileirou. */
        if (!helpful && r?.ok && "chegouAoMedico" in r && r.chegouAoMedico) {
          setVotes((v) => ({ ...v, [i]: "down-fila" }));
        }
      } catch {
        /* telemetria é best-effort */
      }
    })();
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function sendText(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const enrichedText =
      ctx && messages.filter((m) => m.role === "user").length === 0
        ? `[Contexto: ${ctx}]\n\n${text}`.trim()
        : text;

    const displayMsg: WAMsg = { role: "user", content: text, ts: new Date() };
    const displayNext = [...messages, displayMsg];

    setMessages(displayNext);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    /* A bolha da IA é criada ANTES do `try` porque o `catch` precisa achá-la:
       é o `ts` dela que identifica onde escrever. */
    const asstMsg: WAMsg = { role: "assistant", content: "", ts: new Date() };

    try {
      const uiMessages = [...messages.filter((m) => m.content?.trim()), displayMsg].map((m, i) => {
        const msgText = m === displayMsg ? enrichedText : m.content;
        return {
          id: String(i),
          role: m.role,
          parts: msgText ? [{ type: "text", text: msgText }] : [],
        };
      });
      // Envia o token da paciente para o /api/chat resolver o médico dela e
      // usar a IA do consultório correto (cada conta é individual).
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      /* A SAÍDA DE EMERGÊNCIA. Sem ela, uma resposta longa e errada obrigava a
         paciente a esperar os ~19s até o fim — sem parar, sem perguntar de
         novo. Todo chat de IA tem esse botão. */
      const parar = new AbortController();
      pararRef.current = parar;
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: parar.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: uiMessages }),
      });
      if (!res.ok) {
        /* O TEXTO DO SERVIDOR CHEGA À TELA.
           Era `throw new Error(await res.text())`, e o `catch` lá embaixo
           descartava o erro e mostrava "Desculpe, ocorreu um erro. Tente
           novamente." O 429 do limitador local devolve algo ACIONÁVEL —
           "Muitas mensagens em pouco tempo. Aguarde um instante." — e ela
           recebia o genérico, que ainda sugere que ela fez algo errado.
           Guardado num ref porque o `catch` monta a bolha e não enxerga isto. */
        /* SÓ O QUE FOI FEITO PARA ELA LER.
           Aceitar qualquer corpo com menos de 300 caracteres fazia a gestante
           ler "Missing GOOGLE_GENERATIVE_AI_API_KEY" numa bolha de chat. */
        const corpo = await res.text().catch(() => "");
        avisoDoServidorRef.current = avisoQuePodeAparecer(corpo);
        throw new Error(corpo || "http");
      }
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buffer = "";
      /* O provedor falhou DEPOIS de o fluxo abrir? Então o texto que a paciente
         lê é um aviso, não uma resposta — e aviso não vai para a fila do
         médico. */
      let houveErro = false;
      avisoDoServidorRef.current = null;
      setMessages([...displayNext, asstMsg]);

      alvoRef.current = "";
      mostradoRef.current = 0;
      streamAbertoRef.current = true;

      /* O laço de exibição. Ele anda por conta própria, quadro a quadro, e não
         depende do ritmo em que os pedaços chegam — é essa separação que
         transforma "bloco de texto surgindo" em "resposta sendo escrita". */
      /* A ESCRITA DA BOLHA DA IA, num lugar só.
         O laço por quadro foi consertado para atualização funcional, mas as
         QUATRO escritas de fim de stream continuaram usando `displayNext` — o
         retrato capturado quando o envio começou. Uma mensagem enviada
         durante a resposta sobrevivia ao laço e era apagada quando o stream
         fechava: o mesmo defeito, ~1s depois. Uma função só, e as cinco usam
         ela. */
      const escreverNaBolha = (texto: string, extra?: Partial<WAMsg>) =>
        setMessages((atuais) => {
          const i = atuais.findIndex((m) => m.ts === asstMsg.ts);
          if (i < 0) return [...atuais, { ...asstMsg, content: texto, ...extra }];
          const copia = [...atuais];
          copia[i] = { ...copia[i], content: texto, ...extra };
          return copia;
        });

      const digitar = () => {
        const alvo = alvoRef.current;
        const atraso = alvo.length - mostradoRef.current;
        if (atraso > 0) {
          /* Passo adaptativo: 2 caracteres por quadro num ritmo de leitura
             confortável quando o texto está chegando, e MUITO mais rápido
             quando já chegou tudo.

             O teto era 12 caracteres por quadro — 720/s a 60fps. Medido: uma
             resposta de 4.000 caracteres deixava 6,7s de cauda DEPOIS de o
             texto inteiro já estar no navegador, e uma de 8.000 deixava 12,3s.
             Resposta obstétrica longa passa de 2.000 com frequência, e o teste
             só cobria até lá — passando por 0,03s de folga.

             O piso de 2/quadro é o que faz parecer escrita; o teto solto é o
             que impede que "parecer escrita" vire "fazer esperar". Quando o
             stream fechou, a cauda inteira sai em no máximo ~1s. */
          const passo = passoDaDigitacao(atraso, streamAbertoRef.current);
          mostradoRef.current = Math.min(alvo.length, mostradoRef.current + passo);
          /* Atualização FUNCIONAL, e isto é conserto de um apagão real.
             Era `setMessages([...displayNext, …])` — um retrato capturado
             quando o envio começou. Qualquer mensagem acrescentada durante o
             streaming era APAGADA no quadro seguinte: anexar um exame enquanto
             a resposta digitava fazia sumir da tela a bolha do arquivo e a
             confirmação "já encaminhei para a sua médica". O arquivo estava
             salvo no servidor, e a paciente via o contrário disso. */
          /* Pelo `ts`, e não pela última posição: se a paciente anexar um
             exame durante o streaming, a bolha do arquivo entra DEPOIS da
             resposta, e escrever "na última" sobrescreveria a bolha errada. */
          escreverNaBolha(alvo.slice(0, mostradoRef.current));
        }
        if (streamAbertoRef.current || mostradoRef.current < alvoRef.current.length) {
          quadroRef.current = requestAnimationFrame(digitar);
        } else {
          quadroRef.current = null;
        }
      };
      if (!semAnimacao) quadroRef.current = requestAnimationFrame(digitar);

      const processLine = (line: string) => {
        /* A leitura mora em `src/lib/chat-stream.ts` porque aqui dentro nenhum
           teste alcançava: é a peça que decide se a paciente vê a resposta, o
           texto do erro, ou uma bolha em branco — o defeito mais caro deste
           chat — e não tinha um único teste. */
        const p = lerLinhaDoStream(line);
        if (p.tipo === "texto") acc += p.texto;
        else if (p.tipo === "erro") {
          acc = p.texto;
          /* A BOLHA DE ERRO NÃO PODE SER VOTÁVEL. Ler a parte `error`
             consertou a bolha vazia e abriu um buraco por baixo: a mensagem
             passou a TER conteúdo e continuava sem a marca, então os polegares
             apareciam. Um 👎 num 429 do Gemini virava lacuna na fila do médico. */
          houveErro = true;
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(processLine);
        alvoRef.current = acc;
        /* Sem animação, a chegada É a exibição — igual ao comportamento
           anterior, que é exatamente o que quem pediu menos movimento quer. */
        if (semAnimacao) {
          /* `mostradoRef` TAMBÉM anda aqui. Sem isto, quem pediu menos
             movimento ficava com ele em zero para sempre — e o `catch` abaixo,
             que corta o texto parcial em `mostradoRef`, devolvia string vazia:
             o texto que ela estava lendo sumia da tela e virava o erro
             genérico. O conserto do texto parcial existia e não valia para a
             trilha de acessibilidade. */
          mostradoRef.current = acc.length;
          escreverNaBolha(acc);
        }
      }
      (buffer + decoder.decode()).split("\n").forEach(processLine);
      alvoRef.current = acc;
      streamAbertoRef.current = false;

      if (semAnimacao) {
        mostradoRef.current = acc.length;
        escreverNaBolha(acc, houveErro ? { error: true } : undefined);
      } else {
        /* Espera o texto terminar de aparecer antes de liberar o "digitando".
           Sem isto, o indicador sumiria com a bolha ainda pela metade — e a
           paciente veria uma resposta truncada parecendo pronta. */
        await new Promise<void>((resolve) => {
          const conferir = () => {
            if (mostradoRef.current >= alvoRef.current.length) resolve();
            else setTimeout(conferir, 60);
          };
          conferir();
        });
        escreverNaBolha(acc, houveErro ? { error: true } : undefined);
      }
    } catch (e) {
      /* O QUE ELA JÁ ESTAVA LENDO NÃO SE PERDE.
         Antes a lista era reconstruída a partir de `displayNext` — o retrato
         anterior à resposta. Se a rede caísse no meio, o texto que ela estava
         lendo sumia da tela e virava um erro genérico. Pior: o servidor
         terminava e GRAVAVA a resposta inteira, então ela reaparecia "do nada"
         na próxima abertura do chat.
         Agora o que chegou fica, e o aviso vem depois — que é o que qualquer
         conversa interrompida deveria fazer. */
      /* O que CHEGOU, não só o que já apareceu.
         Cortar em `mostradoRef` jogava fora o texto que o servidor já tinha
         mandado e o laço ainda não tinha desenhado — e o comentário acima diz
         "o que chegou fica". Agora diz a verdade. */
      /* Cancelamento pedido POR ELA não é falha: o que já apareceu fica, e não
         há aviso de erro nenhum. */
      if ((e as Error)?.name === "AbortError") {
        const lido = alvoRef.current.trim();
        if (lido) {
          setMessages((atuais) => {
            const i = atuais.findIndex((m) => m.ts === asstMsg.ts);
            if (i < 0) return atuais;
            const copia = [...atuais];
            copia[i] = { ...copia[i], content: lido };
            return copia;
          });
        }
        return;
      }
      const parcial = alvoRef.current.trim();
      const aviso: WAMsg = {
        role: "assistant",
        content:
          /* O aviso do servidor manda, quando existe: ele sabe o que houve
             (limite de mensagens, manutenção) e a tela não. */
          avisoDoServidorRef.current ??
          (parcial
            ? "A conexão caiu no meio da resposta. Pode perguntar de novo?"
            : "Desculpe, ocorreu um erro. Tente novamente."),
        ts: new Date(),
        error: true, // falha transitória não é votável (senão 👎 vira lacuna falsa)
      };
      /* FUNCIONAL aqui também, e pelo mesmo motivo dos outros quatro: o
         `displayNext` é o retrato de antes do envio, então reconstruir a lista
         a partir dele apagaria qualquer mensagem enviada enquanto a resposta
         chegava — justamente no caminho de erro, onde ela mais precisa ver a
         tela consistente. A bolha parcial substitui a da IA no lugar dela, e
         o aviso entra no fim. */
      setMessages((atuais) => {
        const i = atuais.findIndex((m) => m.ts === asstMsg.ts);
        const semVazia = i < 0 ? atuais : atuais.filter((_, k) => k !== i);
        return [
          ...semVazia.slice(0, i < 0 ? semVazia.length : i),
          ...(parcial ? [{ ...asstMsg, content: parcial }] : []),
          ...semVazia.slice(i < 0 ? semVazia.length : i),
          aviso,
        ];
      });
    } finally {
      /* O laço de digitação morre AQUI, sempre. Deixá-lo vivo depois de um erro
         faria ele reescrever por cima da mensagem de falha — a paciente veria a
         resposta antiga voltando por cima do aviso. */
      streamAbertoRef.current = false;
      if (quadroRef.current !== null) cancelAnimationFrame(quadroRef.current);
      quadroRef.current = null;
      pararRef.current = null;
      setLoading(false);
    }
  }

  function handleAudioSoon() {
    toast("Mensagens de áudio em breve — por enquanto, envie texto.");
  }

  /* ─── A TELA INTEIRA NO CELULAR, e o teclado sem empurrar nada ──────────
     Pedido do dono: "quando eu clico para digitar, por algum motivo desce o
     texto, a tela se desloca". Eram duas causas somadas:

     1. O chat era uma caixa de 72vh DENTRO da página rolável — com a barra de
        voltar acima e o rodapé abaixo. Ao focar o campo, o iOS rola a página
        para trazer o input à vista, e a caixa inteira saltava.
     2. O campo tinha 15px. Abaixo de 16px o Safari do iPhone dá ZOOM na
        página ao focar um input — é essa a "tela que se desloca por algum
        motivo". Hoje é 16px, que também é o piso de leitura.

     Agora, no celular, o painel é `fixed` e mede exatamente o
     `visualViewport`: quando o teclado sobe, a altura visual encolhe e o
     painel encolhe junto — a lista rola por dentro, o compositor pousa em cima
     do teclado, e a página por baixo fica travada (`overflow: hidden` no
     body enquanto o chat está montado). No computador ele continua uma caixa
     estática de 72vh, dentro da página. */
  const [janela, setJanela] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const celular = () => window.matchMedia("(max-width: 767px)").matches;
    const medir = () => {
      if (!celular() || !vv) {
        setJanela(null);
        return;
      }
      setJanela({ h: Math.round(vv.height), top: Math.round(vv.offsetTop) });
    };
    medir();
    vv?.addEventListener("resize", medir);
    vv?.addEventListener("scroll", medir);
    window.addEventListener("resize", medir);
    return () => {
      vv?.removeEventListener("resize", medir);
      vv?.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);
  /* Com o teclado aberto o painel encolhe; a lista precisa continuar no fim,
     senão a última mensagem some atrás do compositor. */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [janela?.h]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[45] flex h-[100dvh] flex-col bg-background md:static md:z-auto md:h-[72vh] md:overflow-hidden md:rounded-3xl md:border md:border-border md:shadow-[var(--shadow-card)]"
      style={janela ? { height: janela.h, top: janela.top } : undefined}
    >
      {/* Um sopro de rosa no alto, e mais nada: o chat é a MESMA casa do resto
          do app (o creme, o Nunito, os cartões), não uma tela de outro produto
          colada aqui. Era um céu de madrugada com três auroras — bonito, e
          dizia "isto é outra coisa". */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(224,85,122,0.12),transparent_70%)]"
      />

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <header className="relative flex items-center gap-3 border-b border-border/70 bg-card/92 px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur md:rounded-t-3xl md:px-4 md:pt-3">
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar"
            className="press -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground md:hidden"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} />
          </button>
        )}
        <AiAvatar tamanho={40} careMode={careMode} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[17px] font-bold leading-tight text-foreground">
            {aiName}
          </p>
          <p className="text-xs leading-tight text-muted-foreground">
            Desenvolvido por <span className="font-bold text-primary">DoctorThink</span>
          </p>
          {/* ELA PRECISA SABER QUEM LÊ ISTO — o médico lê a transcrição inteira
              no painel. Linha própria, presente em toda conversa, e não um
              termo aceito uma vez. */}
          {doctorName ? (
            <p className="mt-0.5 text-xs font-semibold leading-tight text-foreground/75">
              {doctorName} pode ler esta conversa
            </p>
          ) : null}
        </div>
      </header>

      {/* A RESPOSTA É ANUNCIADA UMA VEZ, NO FIM — a bolha visual fica
          `aria-hidden` durante o streaming, e o texto completo vai para a
          região `aria-live` abaixo quando termina de chegar. */}
      <div
        ref={scrollRef}
        aria-hidden={loading}
        className="relative flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {carregandoHistorico && messages.length === 0 && (
          <div className="flex justify-center py-6" aria-label="Carregando a conversa">
            <span className="flex gap-1">
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/25"
                  style={{ animationDelay: `${n * 160}ms` }}
                />
              ))}
            </span>
          </div>
        )}
        {messages.map((m, i) => {
          const canVote =
            m.role === "assistant" &&
            !m.error &&
            /* Sem texto não há o que avaliar: um 👎 numa bolha que chegou em
               branco viraria lacuna sobre uma falha de infraestrutura. */
            !!m.content?.trim() &&
            messages.slice(0, i).some((x) => x.role === "user") &&
            !(loading && i === messages.length - 1);
          return (
            <WABubble
              careMode={careMode}
              key={i}
              msg={m}
              feedback={votes[i]}
              onFeedback={canVote ? (helpful) => voteMessage(i, helpful) : undefined}
              terminada={!(loading && i === messages.length - 1)}
            />
          );
        })}
        <div role="status" aria-live="polite" className="sr-only">
          {loading
            ? ""
            : messages[messages.length - 1]?.role === "assistant"
              ? messages[messages.length - 1]?.content
              : ""}
        </div>
        {/* ── Primeiras perguntas: existem enquanto a conversa não começou. */}
        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2 pl-9 pt-2">
            {["Posso tomar dipirona?", "Quantos chutes por dia é normal?", "Estou com azia"].map(
              (q) => (
                <button
                  key={q}
                  onClick={() => sendText(q)}
                  className="pill-3d press rounded-full px-3.5 py-2 text-[13px] font-semibold text-primary"
                >
                  {q}
                </button>
              ),
            )}
          </div>
        )}
        {/* ── "Pensando": uma varredura de luz atravessando a bolha vazia. */}
        {loading && (
          <div className="flex items-end gap-1.5">
            <AiAvatar tamanho={28} careMode={careMode} />
            <div className="card-material relative overflow-hidden rounded-3xl rounded-bl-md px-6 py-3.5">
              <span
                aria-hidden
                className="dc-think-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(224,85,122,0.35),transparent)]"
              />
              <span role="status" className="sr-only">
                Pensando
              </span>
              <span aria-hidden className="relative block h-2 w-12 rounded-full bg-foreground/12" />
            </div>
          </div>
        )}
      </div>

      {/* ── Barra de mensagem ─────────────────────────────────────────── */}
      <div className="relative flex items-end gap-2 border-t border-border/70 bg-card/92 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur md:rounded-b-3xl md:pb-2">
        <div className="card-material relative flex min-h-[44px] flex-1 items-end rounded-[22px] px-4 py-2">
          {/* O convite que se digita sozinho — uma camada por baixo do campo,
              que some no primeiro caractere ou no toque. */}
          {!input && !focado && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-4 right-4 flex items-center text-[16px] text-muted-foreground"
            >
              <span className="truncate">{typed}</span>
              <span className="dc-caret ml-px shrink-0 opacity-80">|</span>
            </span>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            aria-label="Mensagem"
            placeholder={focado ? "Escreva sua dúvida…" : ""}
            rows={1}
            /* ⚠️ 16px, NUNCA menos: abaixo disso o Safari do iPhone dá zoom na
               página ao focar — era metade do "a tela se desloca". */
            className="relative flex-1 resize-none bg-transparent text-[16px] leading-[1.45] text-foreground outline-none placeholder:text-muted-foreground"
            style={{ maxHeight: 100 }}
          />
        </div>

        {/* PARAR — enquanto a resposta corre, o que ela precisa é interromper. */}
        {loading ? (
          <button
            onClick={() => pararRef.current?.abort()}
            aria-label="Parar a resposta"
            className="btn-3d press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
          >
            <span className="block h-3 w-3 rounded-[3px] bg-current" />
          </button>
        ) : input.trim() ? (
          <button
            onClick={() => sendText()}
            disabled={loading}
            aria-label="Enviar"
            className="btn-3d press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Send className="h-[21px] w-[21px] -translate-x-px translate-y-px" strokeWidth={1.9} />
          </button>
        ) : (
          <button
            onClick={handleAudioSoon}
            aria-label="Mensagem de voz"
            className="pill-3d press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary"
          >
            <Mic className="h-[21px] w-[21px]" strokeWidth={1.9} />
          </button>
        )}
      </div>
    </div>
  );
}
