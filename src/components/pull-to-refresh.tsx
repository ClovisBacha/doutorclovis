import { useEffect, useRef, useState, type ReactNode } from "react";
import { ehNativo } from "@/lib/nativo";

/**
 * Puxar-para-atualizar estilo app nativo.
 *
 * De propósito SÓ ativa onde o navegador NÃO oferece o gesto: app instalado na
 * Tela de Início, ou a casca nativa. No navegador comum, o próprio browser já
 * tem o gesto — então aqui vira um passthrough (zero mudança, zero risco de
 * brigar com o scroll nativo). Também só reage quando a página está no topo.
 *
 * ⚠️ **`ehNativo()` NÃO É REDUNDANTE com `display-mode: standalone`** — ele é o
 * caso que faltava. Dentro do WKWebView do Capacitor o display-mode é
 * `browser` e `navigator.standalone` é indefinido, então o app NATIVO era o
 * único lugar onde este gesto não existia: puxar no topo lá só fazia a página
 * balançar. A prova de que standalone é falso na casca está em
 * `src/lib/avisos.ts` — o botão de avisos dentro do app devolvia
 * `ios-not-installed`, motivo que `push.ts` só dá quando `!standalone`.
 *
 * ⚠️ E a decisão continua num EFEITO, nunca no render: `ehNativo()` lê um
 * global que não existe no servidor, e decidir no render trocaria um gesto
 * faltando por uma quebra de hidratação — que é o que
 * `capacidade-fora-do-render.test.ts` existe para barrar.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const THRESHOLD = 70;
  const MAX = 110;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const touch = "ontouchstart" in window;
    setEnabled(Boolean((standalone || ehNativo()) && touch));
  }, []);

  if (!enabled) return <>{children}</>;

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing) return;
    if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
    else startY.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    // resistência: puxa cada vez "mais pesado"
    setPull(Math.min(MAX, delta * 0.5));
  }
  async function onTouchEnd() {
    if (startY.current === null || refreshing) {
      startY.current = null;
      return;
    }
    startY.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  const ready = pull >= THRESHOLD;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden text-primary"
        style={{
          height: refreshing ? THRESHOLD : pull,
          transition: startY.current === null ? "height 0.25s ease" : "none",
        }}
      >
        <span
          className={refreshing ? "animate-spin" : ""}
          style={{
            fontSize: 20,
            opacity: Math.min(1, pull / THRESHOLD),
            transform: `rotate(${refreshing ? 0 : pull * 2}deg)`,
          }}
        >
          {refreshing ? "◌" : ready ? "↻" : "↓"}
        </span>
      </div>
      {children}
    </div>
  );
}
