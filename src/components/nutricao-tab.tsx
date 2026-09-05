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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ChatMsg, Gest, Profile } from "@/routes/_authenticated/minha-conta";
import { supabase } from "@/integrations/supabase/client";
import { avisoQuePodeAparecer, lerLinhaDoStream, passoDaDigitacao } from "@/lib/chat-stream";
import { trimesterForWeek } from "@/lib/gestacao";
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
  };
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
      <div
        className="flex flex-col rounded-3xl card-material"
        style={{ height: alturaDaCaixa ?? "55vh" }}
      >
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
