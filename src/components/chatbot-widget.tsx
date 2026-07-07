import { useChat } from "@ai-sdk/react";
import { useRouterState } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export function ChatbotWidget() {
  const { location } = useRouterState();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({ transport });
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
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] hover:scale-105 ${
          open || showButton
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-24 opacity-0"
        }`}
        aria-label="Abrir chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div className="border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <p className="font-serif text-lg">Assistente do consultório</p>
            <p className="text-xs opacity-80">Tire dúvidas sobre consultas e atendimento</p>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Olá! Posso ajudar com informações sobre o Dr. Clóvis, gestação de alto risco,
                agendamento e mais.
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
        </div>
      )}
    </>
  );
}
