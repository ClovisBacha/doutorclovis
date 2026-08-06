import { useChat } from "@ai-sdk/react";
import { useRouterState } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { avisoQuePodeAparecer } from "@/lib/chat-stream";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export function ChatbotWidget() {
  const { location } = useRouterState();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  /* `error` sai do `useChat` porque falha ANTES do stream abrir (rede, 500)
     nunca vira mensagem — sem isto ela é engolida e a visitante fica olhando
     "digitando…" que some sem nada aparecer. */
  const { messages, sendMessage, status, error } = useChat({ transport });
  const scrollRef = useRef<HTMLDivElement>(null);

  // O botão só aparece quando a visitante rola PARA CIMA (sinal de que procura
  // algo) — rolando para baixo ele some e não atrapalha a leitura do conteúdo.
  const [showButton, setShowButton] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (delta < -12) setShowButton(true);
      else if (delta > 12) setShowButton(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const loading = status === "submitted" || status === "streaming";

  // No app logado o chat tem aba própria (Chat IA); o botão flutuante cobriria a navegação inferior.
  if (location.pathname.startsWith("/minha-conta") || location.pathname.startsWith("/painel"))
    return null;

  return (
    <>
      {/* bottom-24 no mobile: fica acima da barra de navegação inferior (botão "App");
          no desktop (sem a barra) volta para bottom-6. Entrada em fade suave de 600ms. */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-[600ms] ease-out hover:scale-105 ${
          open || showButton
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0"
        }`}
        aria-label="Abrir chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      {open && (
        <div className="fixed bottom-[10.5rem] right-4 md:bottom-24 md:right-6 z-50 flex h-[30rem] max-h-[calc(100dvh-14rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div className="border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <p className="font-serif text-lg">Assistente da plataforma</p>
            <p className="text-xs opacity-80">Dúvidas sobre o app, o site e suporte</p>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Olá! Posso ajudar com dúvidas sobre o app, como se vincular ao seu obstetra,
                agendamento e suporte.
              </p>
            )}
            {messages.map((m) => {
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={isUser ? "flex justify-end" : ""}>
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "max-w-[90%] text-sm leading-relaxed text-foreground"
                    }
                  >
                    {isUser ? (
                      text
                    ) : (
                      <div className="prose prose-sm max-w-none [&_p]:my-1">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && <p className="text-xs italic text-muted-foreground">digitando…</p>}
            {/* A BOLHA VAZIA DO SITE PÚBLICO.
                O `error` do `useChat` era desestruturado fora e nunca lido:
                qualquer falha — rede, 500, cota do provedor, o 429 do limitador
                local — fazia o "digitando…" sumir e NADA aparecer no lugar. A
                visitante ficava olhando uma conversa que não respondeu, sem uma
                palavra explicando. É o mesmo sintoma que foi corrigido no chat
                da paciente; aqui tinha ficado.
                Quando o servidor manda um texto útil (o `onError` de
                `api/chat.ts` escreve um para cota estourada, por exemplo), é ele
                que aparece; senão, uma frase honesta e um caminho. */}
            {!loading && error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {/* FILTRADO. `DefaultChatTransport` lança
                    `new Error(await response.text())`, então um 500 mandava
                    "Missing GOOGLE_GENERATIVE_AI_API_KEY" — o nome de uma
                    variável de ambiente — para a visitante do site público. */}
                {avisoQuePodeAparecer(error.message ?? "") ??
                  "Não consegui responder agora. Tente de novo em instantes — se persistir, fale com o consultório."}
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = input.trim();
              if (!t || loading) return;
              sendMessage({ text: t });
              setInput("");
            }}
            className="flex items-center gap-2 border-t border-border bg-background px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva sua pergunta…"
              autoFocus
              className="flex-1 rounded-full border border-input bg-card px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="border-t border-border bg-background px-3 pb-2 text-center text-[10px] leading-tight text-muted-foreground">
            Assistente de IA — não substitui a consulta médica. Em urgência, ligue 192 (SAMU).
          </p>
        </div>
      )}
    </>
  );
}
