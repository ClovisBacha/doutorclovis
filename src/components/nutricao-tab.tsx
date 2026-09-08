/**
 * A NUTRICIONISTA VIRTUAL — a única tela da grade da Saúde que é CONVERSA.
 *
 * Ela saiu de `minha-conta.tsx` byte a byte (conferido por SHA-256), e o corte
 * veio antes de qualquer melhoria, pela razão de sempre: um move que também
 * "melhora" é uma reescrita, e a mudança de comportamento se esconde num diff
 * de quatrocentas linhas.
 *
 * ⚠️ **E O CORTE É O QUE PERMITE OLHÁ-LA.** Enquanto ela morava num arquivo de
 * ROTA, importá-la de uma bancada poria o código dela no pedaço da árvore de
 * rotas, que TODA página do site carrega (`rotas-sem-export-solto`). Sem
 * bancada, conferir o estado de erro do fluxo, o "…" da bolha vazia ou os três
 * desfechos do 👎 exigia uma conta real, cota de IA e provocar uma falha de
 * rede na hora certa.
 *
 * `ChatMsg`, `Gest` e `Profile` viajam por `import type` — apagados na
 * compilação, então não há dependência de execução do arquivo de rota.
 */
import {
  Camera,
  Check,
  Droplets,
  Leaf,
  Minus,
  Pill,
  Plus,
  Refrigerator,
  ScanLine,
  Search,
  Send,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ChatMsg, Gest, Profile } from "@/routes/_authenticated/minha-conta";
import { supabase } from "@/integrations/supabase/client";
import { avisoQuePodeAparecer, lerLinhaDoStream, passoDaDigitacao } from "@/lib/chat-stream";
import icNutricao from "@/assets/saude/nutricao.webp";
import { trimesterForWeek } from "@/lib/gestacao";
import {
  ALIVIOS,
  META_COPOS,
  REFEICOES,
  chaveDaAgua,
  chavesDeAguaVencidas,
  chaveDosSuplementos,
  chavesDeSuplementosVencidas,
  itensDaPrescricao,
  limparAlimento,
  limparIngredientes,
  perguntaDeAlivio,
  perguntaDoPrato,
  perguntaDoQueTenho,
  perguntaPossoComer,
  refeicaoDaHora,
  resumoDosSuplementos,
  type Refeicao,
} from "@/lib/nutricao-ferramentas";
import { FOTO_LADO_MAX, tituloDaFoto, type AssuntoDaFoto } from "@/lib/foto-da-nutricao";
import { codificarFoto } from "@/lib/codificar-imagem";
import { nutricaoDaSemana } from "@/lib/nutricao-da-semana";
import { conviteDoMomento, momentoDoDia } from "@/lib/nutricao-perfil";
import { ymdLocal } from "@/lib/utils";
import { alturaNoFluxo, useJanelaDoTeclado } from "@/lib/janela-do-teclado";
import { submitBrainFeedback } from "@/lib/secondbrain.functions";

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

/* ─── AS PEÇAS ─────────────────────────────────────────────────────────────
   A identidade é a do ladrilho Nutrição da grade da Saúde (`lime-50 →
   amber-50`, tinta `lime`): quem toca no verde-limão chega numa tela
   verde-limão. As três "ferramentas" abrem um painel e mandam a pergunta
   pronta para a MESMA conversa — nada responde fora do chat. */

type Ferramenta = "comer" | "prato" | "alivio" | "casa";

function Avatar({ tamanho }: { tamanho: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgba(77,124,15,0.55)] ring-1 ring-lime-200/80"
      style={{ width: tamanho, height: tamanho }}
    >
      <img src={icNutricao} alt="" width={tamanho * 0.72} height={tamanho * 0.72} />
    </span>
  );
}

/**
 * A foto reduzida no aparelho dela.
 *
 * ⚠️ Falha devolve `null`, e quem chama manda o arquivo ORIGINAL: o teto do
 * servidor é folgado justamente para caber esse caso. Recusar aqui trocaria
 * uma foto grande por uma ferramenta que não funciona no aparelho cujo canvas
 * é bloqueado.
 */
async function reduzirParaAFoto(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = codificarFoto(canvas, 0.82);
    return await (await fetch(url)).blob();
  } catch {
    return null;
  }
}

/**
 * ⚠️ CADA MOTIVO TEM RECADO PRÓPRIO, e o genérico não diz o que fazer
 * diferente. "Muitas fotos" faz ela esperar; "não consegui ver" faz ela
 * fotografar de novo com mais luz — e o mesmo texto para os dois faria ela
 * tentar de novo justamente quando tentar de novo não adianta.
 */
function recadoDaFoto(motivo?: string): string {
  if (motivo === "muitas")
    return "Recebi bastante foto agora há pouco. Tente de novo em alguns minutos 💛";
  if (motivo === "grande") return "Essa foto ficou pesada demais para eu abrir. Tente tirar outra.";
  if (motivo === "formato")
    return "Não consegui abrir esse arquivo. Vale uma foto tirada agora pela câmera.";
  if (motivo === "vazio")
    return "Não consegui enxergar o que tem aí. Tente de novo com mais luz e a foto mais de perto.";
  /* ⚠️ Bloqueada pelo filtro do modelo NÃO é "mais luz": a foto tinha algo que
     ele não comenta (gente, em geral). O que resolve é enquadrar só a comida. */
  if (motivo === "bloqueada")
    return "Não consigo comentar essa foto. Se for do prato, tente uma foto só da comida, sem pessoas.";
  if (motivo === "demorou")
    return "Demorei demais para ler essa foto e desisti. Tente uma vez mais — ou me conte por escrito o que tem no prato.";
  if (motivo === "sem_ia")
    return "A leitura de fotos está indisponível neste momento. Me conte por escrito o que tem no prato que eu ajudo do mesmo jeito.";
  return "Não consegui ler essa foto agora. Tente de novo daqui a pouco — e, se preferir, me conte por escrito o que tem no prato.";
}

function CartaoFerramenta({
  aberta,
  icone,
  titulo,
  legenda,
  onClick,
}: {
  aberta: boolean;
  icone: React.ReactNode;
  titulo: string;
  legenda: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberta}
      className={`press flex min-h-[92px] flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${
        aberta
          ? "border-lime-500 bg-gradient-to-b from-lime-100 to-lime-50 shadow-[0_10px_22px_-14px_rgba(77,124,15,0.6)]"
          : "card-material border-lime-200/70 bg-gradient-to-b from-lime-100/80 to-lime-50/40"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lime-700 ring-1 ring-lime-200/80">
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block font-serif text-[15px] font-semibold leading-tight text-foreground">
          {titulo}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{legenda}</span>
      </span>
    </button>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pill-3d press min-h-[44px] rounded-full px-4 py-2 text-[13px] font-semibold text-lime-800"
    >
      {children}
    </button>
  );
}

export function NutricaoTab({
  profile,
  gest,
  careMode = false,
  bancada,
}: {
  profile: Profile | null;
  gest: Gest;
  /** Mesma razão do Chat IA: em Modo Cuidado, nada de semana nem trimestre. */
  careMode?: boolean;
  /* ⚠️ A bancada injeta o DADO nos MESMOS `useState` da produção, nunca o
     desenho: é a lição do `?streak=41` da folha da chama. Sem ela, a bolha
     vazia do "…", o erro do fluxo e os TRÊS desfechos do 👎 exigiriam uma
     conta real, cota de IA e provocar uma falha de rede no instante certo. */
  bancada?: {
    /* ⚠️ SEM a saudação: ela é DERIVADA do perfil e do Modo Cuidado, e a
       bancada tem de exercitar essa derivação em vez de cravar um texto.
       A primeira versão cravava a saudação inteira e, com `?luto=1`, a foto
       saiu dizendo "No 2º trimestre, vou focar nas necessidades da semana 24"
       — a frase exata que o Modo Cuidado existe para apagar. Bancada que
       aprova o que a produção não produz é pior que bancada nenhuma. */
    mensagens?: ChatMsg[];
    votos?: Record<number, boolean | "fila">;
    carregando?: boolean;
    /** A água do dia e a ferramenta aberta — os dois estados que dependem de
        `localStorage` e de um toque, e por isso eram impossíveis de fotografar. */
    agua?: number;
    ferramenta?: Ferramenta;
    /** Quais suplementos já foram marcados hoje, e a hora do relógio dela. */
    suplementos?: string[];
    hora?: number;
  };
}) {
  const ehBancada = bancada != null;
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

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: greeting },
    ...(bancada?.mensagens ?? []),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(bancada?.carregando ?? false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /* ─── A CAIXA DEIXA DE ENCOLHER JUNTO COM O TECLADO ────────────────────────
     `55vh` mede a tela INTEIRA, e no iPhone o teclado NÃO mexe nela — só no
     `visualViewport`. A caixa continuava com 469px numa janela visível de
     ~500: não cabia junto com o campo, o navegador rolava a página, e a
     conversa que ela acabou de pedir ficava espremida. Medido com o
     `visualViewport` forjado em 500: caixa 469 → 380, lista 305 → 216.
     ⚠️ Em repouso `alturaNoFluxo` devolve `null` e o desenho de todo dia não
     muda um pixel; só com o teclado aberto a caixa passa a valer o que SOBRA.
     A régua é a MESMA do Chat IA (`lib/janela-do-teclado.ts`) — a paciente usa
     os dois na mesma tela trocando de aba, e duas medições divergiriam. */
  const janela = useJanelaDoTeclado();
  const alturaDaCaixa = alturaNoFluxo(janela);

  /* ─── AS FERRAMENTAS ─────────────────────────────────────────────────────── */
  const [ferramenta, setFerramenta] = useState<Ferramenta | null>(bancada?.ferramenta ?? null);
  const [alimento, setAlimento] = useState("");
  const [temEmCasa, setTemEmCasa] = useState("");
  const conversaRef = useRef<HTMLDivElement>(null);
  /* ⚠️ Estado PRÓPRIO, e não o `input` da caixa de baixo: dois campos ligados
     ao mesmo estado se escreveriam um no outro enquanto ela digita. */
  const [pergunta, setPergunta] = useState("");
  /** Manda a pergunta pronta e leva a paciente até a conversa. */
  function perguntar(texto: string) {
    setFerramenta(null);
    setAlimento("");
    void send(texto);
    conversaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ─── A HORA DELA ─────────────────────────────────────────────────────────
     ⚠️ Num EFEITO, nunca no render: o relógio do servidor não é o dela, e um
     convite derivado da hora divergiria entre as duas execuções — é a
     divergência de hidratação que já deixou este app sem abrir. `null` até
     montar, e aí o convite não aparece. */
  const [hora, setHora] = useState<number | null>(bancada?.hora ?? null);
  useEffect(() => {
    if (ehBancada) return;
    setHora(new Date().getHours());
  }, [ehBancada]);

  /* ─── OS SUPLEMENTOS QUE O MÉDICO PRESCREVEU ──────────────────────────────
     ⚠️ O app NÃO sugere suplemento — ele acompanha o que já foi prescrito. A
     lista sai de `medications` do perfil; o "tomei hoje" mora no aparelho, um
     dia por vez, pela mesma razão da água (a chave `dc-path-` viajaria no blob
     da jornada e dispararia um push por toque). */
  const suplementos = itensDaPrescricao(profile?.medications);
  const [tomados, setTomados] = useState<string[]>(bancada?.suplementos ?? []);
  useEffect(() => {
    if (ehBancada || !suplementos.length) return;
    try {
      const cru = localStorage.getItem(chaveDosSuplementos(ymdLocal()));
      const lidos: unknown = cru ? JSON.parse(cru) : [];
      setTomados(
        Array.isArray(lidos) ? lidos.filter((x): x is string => typeof x === "string") : [],
      );
    } catch {
      setTomados([]);
    }
    /* `suplementos.length` e não a lista: um array remontado a cada render
       faria o efeito re-rodar em toda pintura. */
  }, [ehBancada, suplementos.length]);

  /* ─── A FOTO ─────────────────────────────────────────────────────────────
     ⚠️ A imagem NÃO passa pela conversa: ela vai por `/api/prato`, e o que
     entra no histórico é o TÍTULO ("📷 Foto do meu prato") mais a resposta. É
     o que mantém `/api/nutrition` recebendo só texto — a decisão que o
     comentário dele explica — e o que permite ela continuar perguntando sobre
     o mesmo prato na conversa depois. */
  const entradaDaFoto = useRef<HTMLInputElement | null>(null);
  const [assuntoDaFoto, setAssuntoDaFoto] = useState<AssuntoDaFoto>("prato");

  function escolherFoto(assunto: AssuntoDaFoto) {
    setAssuntoDaFoto(assunto);
    /* O valor é limpo ANTES de abrir: sem isso, escolher a MESMA foto duas
       vezes seguidas não dispara `change` e o toque não faz nada. */
    if (entradaDaFoto.current) entradaDaFoto.current.value = "";
    entradaDaFoto.current?.click();
  }

  async function mandarFoto(file: File, assunto: AssuntoDaFoto) {
    if (loading) return;
    const titulo = tituloDaFoto(assunto);
    const next: ChatMsg[] = [...messages, { role: "user", content: titulo }];
    setMessages(next);
    setFerramenta(null);
    setLoading(true);
    conversaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      /* ⚠️ A REDUÇÃO ACONTECE NO APARELHO, e o lado é 1024 (e não os 512 do
         avatar): o modelo precisa LER a tabela nutricional de um rótulo, que é
         texto miúdo, e a 512 a leitura falha. */
      const menor = await reduzirParaAFoto(file);
      const corpo = new FormData();
      corpo.append("foto", menor ?? file, "foto.webp");
      corpo.append("assunto", assunto);
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/prato", {
        method: "POST",
        headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
        body: corpo,
      });
      const r = (await res.json().catch(() => null)) as {
        ok?: boolean;
        texto?: string;
        assinatura?: string;
        motivo?: string;
      } | null;
      /* ⚠️ `{ ok: false }` chega numa resposta 200 NORMAL em alguns caminhos,
         e um `catch` não o pega: quem decide é o VALOR. Sem isto a bolha
         renderiza "…" para sempre — o defeito que a conversa já pagou aqui. */
      if (!res.ok || !r?.ok || !r.texto) {
        /* O motivo fica LEGÍVEL no console: a paciente lê o recado, quem
           investiga lê isto. Antes, cinco falhas do servidor viravam a mesma
           frase e nada dizia qual tinha sido. */
        console.warn("[prato] não leu a foto", { http: res.status, motivo: r?.motivo });
        setMessages([...next, { role: "assistant", content: recadoDaFoto(r?.motivo) }]);
        return;
      }
      setMessages([...next, { role: "assistant", content: r.texto, assinatura: r.assinatura }]);
    } catch {
      setMessages([...next, { role: "assistant", content: recadoDaFoto() }]);
    } finally {
      setLoading(false);
    }
  }

  function alternarSuplemento(item: string) {
    const proximo = tomados.includes(item) ? tomados.filter((x) => x !== item) : [...tomados, item];
    setTomados(proximo);
    if (ehBancada) return;
    try {
      const hoje = ymdLocal();
      chavesDeSuplementosVencidas(Object.keys(localStorage), hoje).forEach((k) =>
        localStorage.removeItem(k),
      );
      localStorage.setItem(chaveDosSuplementos(hoje), JSON.stringify(proximo));
    } catch {
      /* sem armazenamento, a marca vive só nesta abertura */
    }
  }

  /* ─── A ÁGUA DO DIA ───────────────────────────────────────────────────────
     ⚠️ Lida num EFEITO, nunca no render: `localStorage` não existe no servidor
     e o dia local muda entre as duas execuções — é a divergência de hidratação
     que já deixou este app sem abrir. `null` = ainda não li. */
  const [agua, setAgua] = useState<number | null>(bancada?.agua ?? null);
  useEffect(() => {
    if (ehBancada) return;
    try {
      const v = Number(localStorage.getItem(chaveDaAgua(ymdLocal())) ?? "0");
      setAgua(Number.isFinite(v) ? v : 0);
    } catch {
      setAgua(0);
    }
  }, [ehBancada]);
  function beber(delta: number) {
    const proximo = Math.max(0, Math.min(99, (agua ?? 0) + delta));
    setAgua(proximo);
    if (ehBancada) return;
    try {
      const hoje = ymdLocal();
      /* As chaves de outros dias saem a cada escrita — cota do localStorage. */
      chavesDeAguaVencidas(Object.keys(localStorage), hoje).forEach((k) =>
        localStorage.removeItem(k),
      );
      localStorage.setItem(chaveDaAgua(hoje), String(proximo));
    } catch {
      /* sem armazenamento, o contador vive só nesta abertura */
    }
  }
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
  const [votos, setVotos] = useState<Record<number, boolean | "fila">>(bancada?.votos ?? {});

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
      /* ⚠️ A ASSINATURA VOLTA COM CADA RESPOSTA. Sem ela o servidor descarta o
         turno do assistente (é assim que a forja continua fechada) — e sem as
         próprias respostas o modelo recebia três perguntas dela em fila,
         saudava de novo e respondia a PRIMEIRA. Ver `turno-assinado.server.ts`. */
      const uiMessages = next.map((m, i) => ({
        id: String(i),
        role: m.role,
        parts: [{ type: "text", text: m.content }],
        ...(m.role === "assistant" && m.assinatura
          ? { metadata: { assinatura: m.assinatura } }
          : {}),
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
      let assinatura: string | undefined;
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
          else if (parte.tipo === "assinatura") assinatura = parte.assinatura;
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
        else if (parte.tipo === "assinatura") assinatura = parte.assinatura;
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
      setMessages([...next, { role: "assistant", content: acc, assinatura }]);
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

  /* A frase da semana — régua pura, com as cinco proibições escritas lá. */
  const daSemana = nutricaoDaSemana(gest?.weeks ?? null, careMode);

  return (
    <div className="space-y-5">
      {/* ─── A PORTA: A PERGUNTA, E A SEMANA DELA ─────────────────────────
          ⚠️ **O QUE SOBE PARA O TOPO É O CAMPO, e não a caixa de conversa
          inteira.** A caixa tem 55vh; movida para cá, as quatro ferramentas —
          que são as portas mais usadas — cairiam abaixo da dobra. O que a
          paciente precisa ver primeiro é que dá para PERGUNTAR; a conversa
          cresce a partir daí, no lugar onde ela já mora.

          E o pedido do dono bate com o que se mede: a dúvida dominante da
          gestante é de SEGURANÇA ("posso comer X?"), buscada online por 96%
          delas — e o que elas encontram é ruim (30% dos sites sem fonte
          nenhuma). O campo abre com essa pergunta escrita no placeholder. */}
      <section aria-label="A sua semana e a sua pergunta" className="space-y-3">
        {daSemana && (
          /* ⚠️ O SUJEITO DA FRASE É O BEBÊ, e isso não é tom: 81,5% das
             gestantes usam app de gestação para acompanhar o desenvolvimento
             FETAL, contra 26,2% para nutrição. A nutrição pega carona no motor
             que já existe em vez de competir com ele. */
          <div className="rounded-3xl card-material p-4">
            <p className="font-serif text-[15px] font-semibold text-lime-800">{daSemana.titulo}</p>
            <p className="mt-1 text-sm leading-snug text-foreground">{daSemana.texto}</p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = pergunta.trim();
            if (!t) return;
            setPergunta("");
            void send(t);
            conversaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="flex items-end gap-2"
        >
          <div className="card-material flex min-h-[52px] flex-1 items-center rounded-[26px] px-4">
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              aria-label="Perguntar à nutricionista"
              placeholder="Posso comer…?"
              /* ⚠️ 16px, nunca menos — o zoom do Safari ao focar. A regra
                 global já sobe campo no aparelho; aqui vai explícito porque
                 este é o primeiro campo que a paciente toca na aba. */
              className="min-h-[52px] w-full bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !pergunta.trim()}
            aria-label="Perguntar"
            className="btn-3d press flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-lime-700 text-white disabled:opacity-50"
          >
            <Send className="h-[21px] w-[21px] -translate-x-px translate-y-px" strokeWidth={1.9} />
          </button>
        </form>
      </section>

      {/* ─── AS FERRAMENTAS ─────────────────────────────────────────────
          As três perguntas que só uma nutricionista recebe, prontas para
          tocar. Cada uma abre um painel e manda a pergunta MONTADA para a
          mesma conversa — nada responde fora do chat. Em Modo Cuidado elas
          ficam (comer bem é dela), e o texto não diz "gestação". */}
      <section aria-label="Ferramentas da nutrição">
        <div className="grid grid-cols-2 gap-2">
          <CartaoFerramenta
            aberta={ferramenta === "comer"}
            icone={<Search className="h-[18px] w-[18px]" strokeWidth={2} />}
            titulo="Posso comer?"
            legenda="Sushi, queijo, café…"
            onClick={() => setFerramenta(ferramenta === "comer" ? null : "comer")}
          />
          <CartaoFerramenta
            aberta={ferramenta === "prato"}
            icone={<UtensilsCrossed className="h-[18px] w-[18px]" strokeWidth={2} />}
            titulo="Meu prato"
            legenda="A próxima refeição"
            onClick={() => setFerramenta(ferramenta === "prato" ? null : "prato")}
          />
          <CartaoFerramenta
            aberta={ferramenta === "alivio"}
            icone={<Leaf className="h-[18px] w-[18px]" strokeWidth={2} />}
            titulo="Alívio"
            legenda="Enjoo, azia…"
            onClick={() => setFerramenta(ferramenta === "alivio" ? null : "alivio")}
          />
          {/* ⚠️ A pergunta que nenhum app grande faz, e que é a do Brasil real:
              fim do mês, a geladeira do jeito que está. Um app que só sabe
              sugerir salmão e quinoa é um app que ela fecha. */}
          <CartaoFerramenta
            aberta={ferramenta === "casa"}
            icone={<Refrigerator className="h-[18px] w-[18px]" strokeWidth={2} />}
            titulo="O que tenho"
            legenda="Cozinhar com o que há"
            onClick={() => setFerramenta(ferramenta === "casa" ? null : "casa")}
          />
        </div>

        {/* ─── A CÂMERA ────────────────────────────────────────────────────
            ⚠️ Ela é uma faixa de LARGURA INTEIRA, e não um quinto quadrado:
            cinco cartões numa grade de duas colunas deixam um sozinho na
            última fileira, e as duas fotos são o MESMO gesto (abrir a câmera)
            com dois assuntos — dois quadrados duplicariam a afordância da
            câmera lado a lado.

            ⚠️ E o `<input>` é UM só, com `capture="environment"`: no iPhone
            ele abre a câmera traseira direto, que é o gesto de quem está com
            o prato na frente ou o pote na mão. Dois inputs dariam duas caixas
            de permissão para a mesma coisa. */}
        <input
          ref={entradaDaFoto}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void mandarFoto(f, assuntoDaFoto);
          }}
        />
        <div className="card-material mt-2 rounded-2xl border border-lime-200/70 p-3">
          <p className="text-sm font-semibold text-foreground">
            <Camera
              className="mr-1.5 inline h-4 w-4 -translate-y-px text-lime-700"
              strokeWidth={2}
            />
            Me mostre por foto
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => escolherFoto("prato")}
              className="btn-3d press flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-lime-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <UtensilsCrossed className="h-4 w-4" strokeWidth={2} />
              Meu prato
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => escolherFoto("rotulo")}
              className="pill-3d press flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold text-lime-800 disabled:opacity-50"
            >
              <ScanLine className="h-4 w-4" strokeWidth={2} />
              Um rótulo
            </button>
          </div>
          {/* ⚠️ A frase da foto NÃO é política de privacidade escondida: ela é
              dita ANTES do toque, no lugar onde a decisão acontece. É foto da
              cozinha dela e do supermercado onde ela está. */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            A foto vira texto na hora e não fica guardada em lugar nenhum.
          </p>
        </div>

        {ferramenta === "comer" && (
          <form
            className="card-material mt-2 rounded-2xl border border-lime-200/70 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const a = limparAlimento(alimento);
              if (a) perguntar(perguntaPossoComer(a, careMode));
            }}
          >
            <label htmlFor="alimento" className="block text-sm font-semibold text-foreground">
              Qual alimento?
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="alimento"
                value={alimento}
                onChange={(e) => setAlimento(e.target.value)}
                placeholder="Ex.: sushi, queijo brie, café…"
                autoComplete="off"
                maxLength={60}
                /* ⚠️ 16px, nunca menos: abaixo disso o Safari do iPhone dá zoom
                   ao focar. */
                className="min-h-[44px] flex-1 rounded-full border border-lime-200 bg-white px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus:border-lime-500"
              />
              <button
                type="submit"
                disabled={!limparAlimento(alimento) || loading}
                className="btn-3d press min-h-[44px] rounded-full bg-lime-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Perguntar
              </button>
            </div>
          </form>
        )}

        {ferramenta === "prato" && (
          <div className="card-material mt-2 rounded-2xl border border-lime-200/70 p-3">
            <p className="text-sm font-semibold text-foreground">Qual refeição?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REFEICOES.map((r: Refeicao) => (
                <Chip key={r} onClick={() => perguntar(perguntaDoPrato(r))}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {ferramenta === "casa" && (
          <form
            className="card-material mt-2 rounded-2xl border border-lime-200/70 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const ing = limparIngredientes(temEmCasa);
              if (ing) perguntar(perguntaDoQueTenho(ing, momentoDoDia(hora ?? 12)));
            }}
          >
            <label htmlFor="tem-em-casa" className="block text-sm font-semibold text-foreground">
              O que você tem em casa?
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Separe por vírgula. A receita sai só com o que você listar.
            </p>
            <textarea
              id="tem-em-casa"
              value={temEmCasa}
              onChange={(e) => setTemEmCasa(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Ex.: ovo, arroz, feijão, cenoura, banana"
              /* ⚠️ 16px, nunca menos — o zoom do Safari ao focar. */
              className="mt-2 w-full resize-none rounded-2xl border border-lime-200 bg-white px-4 py-2.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground focus:border-lime-500"
            />
            <button
              type="submit"
              disabled={!limparIngredientes(temEmCasa) || loading}
              className="btn-3d press mt-2 min-h-[44px] w-full rounded-full bg-lime-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Montar {momentoDoDia(hora ?? 12)} com isso
            </button>
          </form>
        )}

        {ferramenta === "alivio" && (
          <div className="card-material mt-2 rounded-2xl border border-lime-200/70 p-3">
            <p className="text-sm font-semibold text-foreground">O que está incomodando?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALIVIOS.map((a) => (
                <Chip key={a.rotulo} onClick={() => perguntar(perguntaDeAlivio(a.frase))}>
                  {a.rotulo}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── O CONVITE DA HORA ──────────────────────────────────────────
          ⚠️ Só depois de montar (a `hora` nasce `null`), porque o relógio do
          servidor não é o dela. E só fora do Modo Cuidado com a conversa ainda
          no começo: um convite a cada abertura vira letreiro.

          ⚠️ E ele SOME com uma ferramenta aberta — a foto da bancada mostrou
          "Montar almoço com isso" e "Vamos montar um almoço equilibrado?" um em
          cima do outro, dois convites para a mesma refeição. Quem abriu uma
          ferramenta já escolheu por onde começar; o convite é o atalho de quem
          ainda não escolheu nada. */}
      {!careMode && hora != null && ferramenta === null && messages.length <= 1 && (
        <button
          type="button"
          onClick={() => perguntar(perguntaDoPrato(refeicaoDaHora(hora)))}
          className="card-material press flex w-full items-center gap-3 rounded-2xl border border-lime-200/70 bg-gradient-to-r from-lime-50 to-amber-50/60 p-3 text-left"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lime-700 ring-1 ring-lime-200/80">
            <UtensilsCrossed className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-foreground">
              {conviteDoMomento(hora)}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Toque para montar agora
            </span>
          </span>
        </button>
      )}

      {/* ─── OS SUPLEMENTOS QUE O MÉDICO PRESCREVEU ─────────────────────
          ⚠️ O app NUNCA sugere suplemento — ele acompanha o que já está no
          perfil dela. Sem prescrição, a seção não existe: um checklist vazio
          convidaria a inventar um. */}
      {suplementos.length > 0 && (
        <section
          aria-label="Suplementos de hoje"
          className="card-material rounded-2xl border border-lime-200/70 p-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-serif text-[15px] font-semibold text-foreground">
              <Pill
                className="mr-1.5 inline h-4 w-4 -translate-y-px text-lime-700"
                strokeWidth={2}
              />
              Do seu médico, hoje
            </p>
            <p className="text-xs text-muted-foreground">
              {resumoDosSuplementos(
                tomados.filter((t) => suplementos.includes(t)).length,
                suplementos.length,
              )}
            </p>
          </div>
          <ul className="mt-2 space-y-1.5">
            {suplementos.map((item) => {
              const feito = tomados.includes(item);
              return (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => alternarSuplemento(item)}
                    aria-pressed={feito}
                    className="press flex min-h-[44px] w-full items-center gap-3 rounded-xl px-1 text-left"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        feito
                          ? "border-lime-700 bg-lime-700 text-white"
                          : "border-lime-300 bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span
                      className={`min-w-0 flex-1 text-[15px] ${
                        feito ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* ⚠️ A frase existe para a marca não virar cobrança nem conduta. */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Marcar aqui é só para você lembrar. Dose e horário são do seu médico.
          </p>
        </section>
      )}

      {/* ─── A ÁGUA DO DIA ──────────────────────────────────────────────
          Contador, não meta clínica: 8 copos é REFERÊNCIA e a tela diz. */}
      <section
        aria-label="Água de hoje"
        className="card-material flex items-center gap-3 rounded-2xl border border-lime-200/70 bg-gradient-to-r from-lime-50 to-amber-50/60 p-3"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sky-600 ring-1 ring-lime-200/80">
          <Droplets className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl font-semibold leading-none tabular-nums text-foreground">
              {agua ?? "–"}
            </span>
            <span className="text-sm text-muted-foreground">de {META_COPOS} copos hoje</span>
          </div>
          <div className="mt-1.5 flex gap-1" aria-hidden>
            {Array.from({ length: META_COPOS }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  agua != null && i < agua ? "bg-sky-500" : "bg-lime-200/70"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Referência de cerca de 2 litros — quem ajusta é o seu médico.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => beber(-1)}
            disabled={!agua}
            aria-label="Tirar um copo"
            className="pill-3d press flex h-11 w-11 items-center justify-center rounded-full text-lime-800 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => beber(1)}
            aria-label="Bebi um copo"
            className="btn-3d press flex h-11 w-11 items-center justify-center rounded-full bg-lime-700 text-white"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
      </section>

      {/* ─── A CONVERSA ─────────────────────────────────────────────────── */}
      <div
        ref={conversaRef}
        className="card-material flex scroll-mt-4 flex-col overflow-hidden rounded-3xl border border-lime-200/70"
        style={{ height: alturaDaCaixa ?? "55vh" }}
      >
        <div className="flex items-center gap-3 border-b border-lime-100 bg-gradient-to-r from-lime-50 to-amber-50/60 px-4 py-3">
          <Avatar tamanho={40} />
          <div className="min-w-0">
            <p className="font-serif text-[17px] font-semibold leading-tight text-foreground">
              Nutricionista virtual
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {careMode
                ? "Orientações de alimentação — não substitui avaliação nutricional individual."
                : "Orientações para a sua gestação — não substitui avaliação nutricional individual."}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {messages.map((m, i) => {
            const dela = m.role === "user";
            return (
              <div
                key={i}
                className={`flex items-end gap-1.5 ${dela ? "flex-row-reverse" : "flex-row"}`}
              >
                {!dela && <Avatar tamanho={28} />}
                <div
                  /* ⚠️ `whitespace-pre-wrap`: o modelo responde em LINHAS —
                     "para a próxima, duas ideias:" e depois duas linhas com
                     marcador. Sem isto elas colavam num parágrafo só, e a foto
                     da bancada mostrou a lista virando uma parede de texto com
                     os "•" no meio da frase. O Chat IA já rendia assim; esta
                     bolha ficou de fora. */
                  className={`max-w-[80%] whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed ${
                    dela
                      ? "rounded-3xl rounded-br-md bg-lime-700 text-white shadow-[0_10px_22px_-12px_rgba(77,124,15,0.7)]"
                      : "card-material rounded-3xl rounded-bl-md text-foreground"
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
                          {/* ⚠️ ALVO DE 44px, e aqui ele NÃO pode sair de um
                              `after:-inset`: são dois VIZINHOS e opostos, e
                              estendê-los faria os alvos se encavalarem —
                              tocar entre eles acertaria o contrário do que
                              ela quis. É a lição do ✕ do chá de bebê. Os
                              `-m` devolvem o espaço que o quadrado tomou. */}
                          <button
                            onClick={() => votar(i, true)}
                            aria-label="Esta resposta ajudou"
                            className="-my-2 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-sm opacity-50 hover:opacity-100"
                          >
                            👍
                          </button>
                          <button
                            onClick={() => votar(i, false)}
                            aria-label="Esta resposta não ajudou"
                            className="-my-2 flex h-11 w-11 items-center justify-center rounded-full text-sm opacity-50 hover:opacity-100"
                          >
                            👎
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões: em Modo Cuidado somem. NUTRITION_CHIPS traz "Posso comer
            tâmara para preparar o parto?" e coisas do tipo. */}
        {!careMode && messages.length <= 1 && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto border-t border-lime-100 px-3 py-2">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                className="pill-3d press min-h-[44px] shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold text-lime-800"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-lime-100 bg-card/92 px-3 py-2">
          <div className="card-material flex min-h-[44px] flex-1 items-center rounded-[22px] px-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              aria-label="Mensagem"
              placeholder={careMode ? "Pergunte sobre alimentação…" : "Pergunte sobre alimentação…"}
              /* ⚠️ 16px, nunca menos — o zoom do Safari ao focar. */
              className="min-h-[44px] w-full bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label="Enviar"
            className="btn-3d press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-700 text-white disabled:opacity-50"
          >
            <Send className="h-[21px] w-[21px] -translate-x-px translate-y-px" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {/* ─── O FOCO DO TRIMESTRE ───────────────────────────────────────
          Some em Modo Cuidado: "Formação óssea do bebê" e "Desenvolvimento do
          cérebro fetal" são o conteúdo dele. */}
      {!careMode && (
        <section aria-label="Nutrientes em foco">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <p className="font-serif text-[17px] font-semibold text-foreground">
              Foco do {trimester}º trimestre
            </p>
            <p className="text-xs text-muted-foreground">deslize →</p>
          </div>
          <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
            {tips.map((t) => (
              <article
                key={t.nutrient}
                className="card-material w-[210px] shrink-0 snap-start rounded-2xl border border-lime-200/70 bg-gradient-to-b from-lime-50 to-amber-50/60 p-3.5"
              >
                <p className="font-serif text-[15px] font-semibold text-lime-800">{t.nutrient}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.why}</p>
                <p className="mt-2 text-[13px] leading-snug text-foreground">{t.foods}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
