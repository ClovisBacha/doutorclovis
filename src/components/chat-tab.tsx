import { useEffect, useRef, useState } from "react";
import { Mic, Send } from "lucide-react";
import { toast } from "sonner";
import { Bolha } from "@/components/bolha";
import { avisoQuePodeAparecer, lerLinhaDoStream, passoDaDigitacao } from "@/lib/chat-stream";
import { useWeatherSky } from "@/components/weather-sky";
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

  /* A tinta segue o LADO, não o céu. A bolha da paciente é cor sólida, então
     escreve em branco; a da IA é vidro claro — e vidro claro pede tinta
     escura em qualquer hora do dia. Foi por isso que a bolha da IA não ficou
     translúcida de verdade: sobre o céu de madrugada, um vidro fino com
     texto escuro seria ilegível, e com texto branco ficaria ilegível ao
     meio-dia. Vidro claro e denso é o único que atravessa as 24 horas. */
  const ink = isUser ? "rgba(255,255,255,0.97)" : "rgba(22,26,50,0.92)";
  const inkSoft = isUser ? "rgba(255,255,255,0.74)" : "rgba(22,26,50,0.55)";

  return (
    <div className={`flex items-end gap-1.5 mb-0.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && <AiAvatar tamanho={28} careMode={careMode} className="mb-0.5 self-end" />}

      <div
        className={`max-w-[75%] overflow-hidden ${isUser ? "rounded-2xl rounded-tr-none" : "rounded-2xl rounded-tl-none"}`}
        style={
          isUser
            ? {
                /* A fala da paciente é a única cor SÓLIDA da tela — é ela que
                   diz "isto sou eu". O degradê violeta→rosa é o mesmo par que
                   o site usa para o Chat e para o botão do bebê. */
                background: "linear-gradient(140deg, #8b5cf6 0%, #d946a8 62%, #ec4899 100%)",
                border: "1px solid rgba(255,255,255,0.28)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 22px -8px rgba(150,50,150,0.6)",
              }
            : {
                /* A fala da IA é vidro claro — o mesmo material dos cartões
                   da home, com o céu passando por trás. */
                background:
                  "linear-gradient(152deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.26) 52%)," +
                  " rgba(255,253,252,0.5)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.7)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.95), 0 10px 26px -12px rgba(20,25,60,0.4)",
              }
        }
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-[13px]"
              style={{
                background: isUser ? "rgba(255,255,255,0.26)" : "rgba(22,26,50,0.1)",
                color: ink,
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4)",
              }}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <div className="flex flex-1 items-center gap-[2px]">
              {[3, 6, 4, 9, 5, 7, 4, 8, 6, 5, 9, 4, 7, 5, 8].map((h, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-full shrink-0"
                  style={{ height: h, background: inkSoft }}
                />
              ))}
            </div>
            <span className="text-xs shrink-0" style={{ color: inkSoft }}>
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ background: isUser ? "rgba(255,255,255,0.22)" : "rgba(22,26,50,0.08)" }}
            >
              📄
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold line-clamp-1" style={{ color: ink }}>
                {msg.fileName}
              </p>
              {msg.fileSize && (
                <p className="text-xs mt-0.5" style={{ color: inkSoft }}>
                  {msg.fileSize}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Texto */}
        {msg.content && (
          <p
            className="px-3 pt-2 text-[14px] leading-snug whitespace-pre-wrap"
            style={{ color: ink }}
          >
            {msg.content}
          </p>
        )}

        {/* RESPOSTA VAZIA.

            O modelo às vezes termina sem texto nenhum — no Gemini 2.5 isso
            acontece quando o raciocínio consome todo o orçamento de saída. Sem
            esta guarda a paciente via uma bolha em branco com dois botões de
            joinha: nada para ler, nada para entender, e nenhum erro na tela.
            Uma bolha muda é pior que um erro — erro pelo menos se pode
            reagir a.

            Só depois que a mensagem terminou de chegar: durante o streaming o
            texto nasce vazio e isso é normal. */}
        {!isUser && terminada && !msg.content && !msg.fileName && !msg.audioUrl && (
          <p className="px-3 pt-2 text-[14px] leading-snug italic" style={{ color: inkSoft }}>
            Não consegui formular a resposta agora. Pode perguntar de novo?
          </p>
        )}

        {/* Timestamp + feedback 👍👎 (só em respostas da IA) */}
        <div className="flex items-center justify-end gap-1 px-2.5 pb-1.5 pt-0.5">
          {!isUser && onFeedback && (
            <span className="mr-auto flex items-center gap-1.5 pl-0.5">
              {feedback ? (
                <span className="text-xs" style={{ color: inkSoft }}>
                  {/* A FRASE SEGUE O QUE O SERVIDOR REALMENTE FEZ.
                      "Anotado — seu médico vai ver" era dito para todo 👎, e o
                      retorno de `submitBrainFeedback` era ignorado. Um 👎 numa
                      pergunta de plataforma ("quanto custa?") não entra em fila
                      nenhuma: a paciente lia que o médico veria, e ele nunca
                      veria. É o mesmo portão que o `chat.ts` já usa para a IA
                      não prometer registro que não houve — faltava no botão. */}
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
                    className="rounded-full px-1.5 py-0.5 text-[13px] leading-none opacity-60 transition-opacity hover:opacity-100"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => onFeedback(false)}
                    aria-label="Resposta não ajudou"
                    className="rounded-full px-1.5 py-0.5 text-[13px] leading-none opacity-60 transition-opacity hover:opacity-100"
                  >
                    👎
                  </button>
                </>
              )}
            </span>
          )}
          <span className="text-xs leading-none" style={{ color: inkSoft }}>
            {timeStr}
          </span>
          {isUser && (
            <span className="text-xs leading-none" style={{ color: "rgba(255,255,255,0.85)" }}>
              ✓✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Exportado só para a bancada de design `/preview-chat` (ver o arquivo). */
export function ChatTab({
  profile,
  gest,
  careMode = false,
}: {
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

  /* O céu do site — o MESMO gradiente do hero da página pública e do item
     "Céu Clássico" da loja. Usar aqui não é economia de código: é o que faz
     esta aba pertencer ao app em vez de parecer um chat colado de fora. E ele
     muda com a hora, então o chat de madrugada é escuro sem ninguém pedir. */
  const sky = useWeatherSky();

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

  /* O céu vem do gradiente do site; as auroras são a camada de "tecnologia"
     por cima dele. A tinta do cabeçalho segue o céu, não o material. */
  const skyDark = sky.isDark;
  const headInk = skyDark ? "rgba(255,255,255,0.96)" : "rgba(20,24,48,0.92)";
  const headInkSoft = skyDark ? "rgba(255,255,255,0.62)" : "rgba(20,24,48,0.58)";
  /* ⚠️ O AVISO DE QUEM LÊ A CONVERSA NÃO USA A TINTA DA ASSINATURA. Ele vivia
     na MESMA linha e na MESMA tinta do crédito da plataforma — e o crédito tem
     gradiente e peso 600, então a marca era o elemento mais chamativo da linha
     e o consentimento era o texto cinza depois do "·". Numa tela onde ela conta
     o que não conta a ninguém, a hierarquia estava invertida. */
  const headInkAviso = skyDark ? "rgba(255,255,255,0.86)" : "rgba(20,24,48,0.82)";

  return (
    <div
      className="relative -mx-4 flex flex-col overflow-hidden rounded-t-none"
      style={{ height: "72vh", background: sky.gradient }}
    >
      {/* ── Atmosfera: três manchas de luz derivando atrás de tudo ──────
          Elas ficam FORA do fluxo e sem eventos de ponteiro; o que se move é
          só `transform`. Blur alto e mistura `screen` para somarem luz em vez
          de pintar por cima — sobre o céu de madrugada isso vira brilho de
          neon, sobre o de meio-dia quase não aparece, que é o desejado. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          {
            cls: "dc-aurora-a",
            pos: "-left-1/4 -top-1/4 h-[70%] w-[85%]",
            cor: "139,92,246",
            b: 46,
          },
          {
            cls: "dc-aurora-b",
            pos: "-right-1/4 top-1/4 h-[65%] w-[80%]",
            cor: "236,72,153",
            b: 52,
          },
          {
            cls: "dc-aurora-c",
            pos: "-bottom-1/4 left-1/5 h-[60%] w-[75%]",
            cor: "56,189,248",
            b: 50,
          },
        ].map((a) => (
          <span
            key={a.cls}
            className={`${a.cls} absolute rounded-full ${a.pos}`}
            style={{
              background: `radial-gradient(circle, rgba(${a.cor},${skyDark ? 0.55 : 0.6}) 0%, transparent 68%)`,
              filter: `blur(${a.b}px)`,
              /* `screen` SOMA luz: perfeito no céu de madrugada, invisível ao
                 meio-dia, porque somar luz a um azul já claro não muda quase
                 nada. Sobre céu claro a mancha precisa TINGIR, e `soft-light`
                 faz isso sem chapar — medido nas duas horas. */
              mixBlendMode: skyDark ? "screen" : "soft-light",
            }}
          />
        ))}
      </div>

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div
        className="relative flex items-center gap-3 px-4 py-3"
        style={{
          background: skyDark
            ? "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 60%)"
            : "linear-gradient(160deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 60%)",
          backdropFilter: "blur(22px) saturate(180%)",
          WebkitBackdropFilter: "blur(22px) saturate(180%)",
          borderBottom: `1px solid ${skyDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.6)"}`,
          boxShadow: `inset 0 1px 0 ${skyDark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.9)"}`,
        }}
      >
        <AiAvatar careMode={careMode} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[16px] font-semibold leading-tight"
            style={{ color: headInk }}
          >
            {aiName}
          </p>
          {/* A assinatura de quem construiu — pequena, mas presente em toda
              conversa. É a única marca da plataforma dentro do app. */}
          <p className="text-xs leading-tight" style={{ color: headInkSoft }}>
            Desenvolvido por{" "}
            <span
              className="font-semibold"
              style={{
                /* O degradê da marca troca de faixa conforme o céu. Os mesmos
                   três tons servem de dia e de noite, mas o ciano claro some
                   sobre o lilás do entardecer e o violeta escuro some no céu
                   de madrugada — então cada lado usa a ponta do espectro que
                   sobrevive ali. */
                backgroundImage: skyDark
                  ? "linear-gradient(96deg, #c4b5fd, #f9a8d4 58%, #7dd3fc)"
                  : "linear-gradient(96deg, #6d28d9, #be185d 70%, #a21caf)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              DoctorThink
            </span>
            {/* ─── ELA PRECISA SABER QUEM LÊ ISTO ────────────────────────────
                O painel do médico tem a aba Conversas, e ele lê a transcrição
                inteira. O comentário de `listBrainConversations` é honesto
                sobre o que isso significa: "é o dado mais íntimo do produto: é
                para a IA que ela conta o que não conta a ninguém."
                E não havia UMA palavra na tela dela dizendo isso. Consentimento
                que ninguém informou não é consentimento — e aqui o efeito
                prático é pior que o jurídico: ela escreve coisas que talvez não
                escrevesse, e descobre depois.
                Fica na linha de assinatura, no cabeçalho, presente em toda
                conversa — não num termo que ela aceitou uma vez e nunca leu. */}
          </p>
          {/* ⚠️ LINHA PRÓPRIA, e não o rabicho do crédito. Colado depois do "·"
              ele QUEBRAVA NO MEIO DA FRASE ("…pode / ler esta conversa") num
              aparelho de 393px — medido —, o que faz uma informação de
              consentimento parecer sobra de outra frase. Aqui ele tem a linha
              inteira, tinta mais forte e peso médio: continua discreto, e
              deixa de perder para a assinatura de quem construiu. */}
          {doctorName ? (
            <p className="mt-0.5 text-xs font-medium leading-tight" style={{ color: headInkAviso }}>
              {doctorName} pode ler esta conversa
            </p>
          ) : null}
        </div>
      </div>

      {/* A RESPOSTA É ANUNCIADA UMA VEZ, NO FIM — não 60 vezes por segundo.
          `aria-live` num container cujo texto muda a cada quadro é
          anti-padrão: o leitor de tela enfileira ou repete a cada mutação, e
          quem usa VoiceOver sem `prefers-reduced-motion` pega o pior caso.
          A bolha visual fica `aria-hidden` durante o streaming, e o texto
          completo vai para a região abaixo quando termina de chegar. */}
      <div
        ref={scrollRef}
        aria-hidden={loading}
        className="relative flex-1 overflow-y-auto space-y-0.5 px-3 py-3"
      >
        {/* Enquanto o histórico não respondeu, a lista está vazia de propósito.
            Três pontinhos discretos são melhores que uma tela em branco — e
            muito melhores que uma saudação que aparece e é trocada. */}
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
          // Avaliável: resposta da IA com pergunta anterior, fora do streaming.
          const canVote =
            m.role === "assistant" &&
            !m.error &&
            /* Bolha VAZIA não é votável. Quando o provedor falha, a resposta
               chega em branco e a paciente vê o aviso de "não consegui
               formular" — um 👎 ali viraria lacuna (ou revisão) sobre uma falha
               de infraestrutura, e o médico receberia trabalho criado por um
               erro 429 do Gemini. */
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

        {/* O que o leitor de tela lê: a resposta inteira, uma vez só, quando
            ela termina de chegar. Enquanto `loading`, fica vazio. */}
        <div role="status" aria-live="polite" className="sr-only">
          {loading
            ? ""
            : messages[messages.length - 1]?.role === "assistant"
              ? messages[messages.length - 1]?.content
              : ""}
        </div>

        {/* ── Primeiras perguntas ───────────────────────────────────────
            Uma tela de chat vazia é uma folha em branco, e folha em branco
            trava — ainda mais quando a dúvida é sobre o próprio corpo. Estas
            três existem enquanto a conversa não começou e somem no primeiro
            envio. São as mesmas famílias de pergunta que o campo digita
            sozinho, mas aqui em um toque. */}
        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2 pl-9 pt-2">
            {["Posso tomar dipirona?", "Quantos chutes por dia é normal?", "Estou com azia"].map(
              (q) => (
                <button
                  key={q}
                  onClick={() => sendText(q)}
                  className="rounded-full px-3.5 py-2 text-xs font-medium transition-transform active:scale-95"
                  style={{
                    color: headInk,
                    background: skyDark ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.55)",
                    backdropFilter: "blur(16px) saturate(170%)",
                    WebkitBackdropFilter: "blur(16px) saturate(170%)",
                    border: `1px solid ${skyDark ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.8)"}`,
                    boxShadow: `inset 0 1px 0 ${skyDark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.95)"}`,
                  }}
                >
                  {q}
                </button>
              ),
            )}
          </div>
        )}

        {/* ── "Pensando" ────────────────────────────────────────────────
            Os três pontinhos saltitantes viraram uma varredura de luz
            atravessando a bolha vazia. Diz a mesma coisa — está processando —
            mas sem imitar o "digitando" de um humano, que é a leitura errada
            para uma máquina que responde em nome de um consultório. */}
        {loading && (
          <div className="flex items-end gap-1.5">
            <AiAvatar tamanho={28} careMode={careMode} />
            <div
              className="relative overflow-hidden rounded-2xl rounded-tl-none px-6 py-3.5"
              style={{
                background:
                  "linear-gradient(152deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.26) 52%)," +
                  " rgba(255,253,252,0.5)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.7)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.95), 0 10px 26px -12px rgba(20,25,60,0.4)",
              }}
            >
              <span
                aria-hidden
                className="dc-think-sweep absolute inset-y-0 -left-1/3 w-1/3"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(139,92,246,0.55), transparent)",
                }}
              />
              {/* `role="status"`: o `sr-only` era inserido e removido do DOM sem
                  live region nenhuma, então NUNCA era anunciado. Quem usa
                  leitor de tela mandava a pergunta e ficava sem saber se algo
                  estava acontecendo. */}
              <span role="status" className="sr-only">
                Pensando
              </span>
              <span
                aria-hidden
                className="relative block h-2 w-12 rounded-full"
                style={{ background: "rgba(22,26,50,0.14)" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Barra de mensagem ─────────────────────────────────────────── */}
      <div
        className="relative flex items-end gap-2 px-2 py-2"
        style={{
          background: skyDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.3)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderTop: `1px solid ${skyDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)"}`,
        }}
      >
        {/* Campo de texto */}
        <div
          className="relative flex min-h-[42px] flex-1 items-end rounded-3xl px-4 py-2"
          style={{
            background: skyDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.62)",
            backdropFilter: "blur(16px) saturate(170%)",
            WebkitBackdropFilter: "blur(16px) saturate(170%)",
            border: `1px solid ${skyDark ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.85)"}`,
            boxShadow: `inset 0 1px 0 ${skyDark ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.95)"}`,
          }}
        >
          {/* O convite que se digita sozinho.
              Ele NÃO é o `placeholder` do textarea: placeholder nativo não
              aceita um cursor piscando ao lado. É uma camada por baixo, sem
              eventos de ponteiro, que some no instante em que a paciente
              digita a primeira letra ou toca no campo. O `placeholder` real
              fica vazio para as duas coisas não se sobreporem. */}
          {!input && !focado && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-4 right-11 flex items-center text-[15px]"
              style={{ color: headInkSoft }}
            >
              <span className="truncate">{typed}</span>
              <span className="dc-caret ml-px shrink-0" style={{ opacity: 0.8 }}>
                |
              </span>
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
            className="relative flex-1 resize-none bg-transparent text-[15px] leading-[1.45] outline-none"
            style={{ maxHeight: 100, color: headInk }}
          />
        </div>

        {/* PARAR — a saída de emergência. Enquanto a resposta corre, o botão de
            enviar não serve para nada (o envio já está barrado por `loading`),
            e o que ela precisa é interromper. */}
        {loading ? (
          <button
            onClick={() => pararRef.current?.abort()}
            aria-label="Parar a resposta"
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/85 text-background transition-transform active:scale-95"
          >
            <span className="block h-3 w-3 rounded-[3px] bg-current" />
          </button>
        ) : input.trim() ? (
          <button
            onClick={() => sendText()}
            disabled={loading}
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-60"
            style={{
              background: "linear-gradient(140deg, #8b5cf6 0%, #d946a8 60%, #ec4899 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow:
                "0 8px 22px -6px rgba(180,60,190,0.65), inset 0 1px 1px rgba(255,255,255,0.5)",
            }}
          >
            <Send className="h-[21px] w-[21px] -translate-x-px translate-y-px" strokeWidth={1.9} />
          </button>
        ) : (
          <button
            onClick={handleAudioSoon}
            aria-label="Mensagem de voz"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95"
            style={{
              background: "linear-gradient(140deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
              boxShadow:
                "0 8px 22px -6px rgba(110,80,220,0.6), inset 0 1px 1px rgba(255,255,255,0.5)",
            }}
          >
            <Mic className="h-[21px] w-[21px]" strokeWidth={1.9} />
          </button>
        )}
      </div>
    </div>
  );
}
