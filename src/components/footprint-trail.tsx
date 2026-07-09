import { useEffect, useRef, useState } from "react";

/**
 * Pezinho de bebê — mesma silhueta usada no jogo da gestação (planta em gota +
 * dedão interno + 4 dedinhos), aqui numa cópia leve e independente para as
 * páginas de marketing (sem puxar o componente pesado do jogo).
 */
export function BabyFootprint({
  color = "#f4a6c0",
  className = "h-[18px] w-auto",
}: {
  color?: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 20 28" className={className} aria-hidden>
      <ellipse cx="11" cy="19" rx="6.8" ry="8.8" fill="rgba(0,0,0,0.12)" />
      <ellipse cx="10.5" cy="18" rx="6.5" ry="8.6" fill={color} />
      <ellipse cx="9" cy="15" rx="4" ry="5" fill="rgba(255,255,255,0.30)" />
      <circle cx="16" cy="7.6" r="3" fill={color} />
      <circle cx="10.6" cy="5.4" r="2.2" fill={color} />
      <circle cx="6.2" cy="6" r="1.9" fill={color} />
      <circle cx="2.6" cy="7.8" r="1.6" fill={color} />
      <circle cx="1.4" cy="10.2" r="1.3" fill={color} />
    </svg>
  );
}

/**
 * Trilha de pezinhos que "caminha" de uma tela do celular até a próxima
 * conforme a pessoa rola a página: ao entrar na viewport, cada pegada faz um
 * fade-in em sequência (revelando o caminho), alternando pé esquerdo/direito e
 * driftando na direção do próximo celular.
 *
 * `dir` = para qual lado o caminho segue ("ltr" desce da esquerda p/ direita).
 */
export function FootprintTrail({
  dir = "ltr",
  count = 6,
  color = "#f4a6c0",
}: {
  dir?: "ltr" | "rtl";
  count?: number;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respeita "reduzir movimento": mostra o caminho já revelado, sem stagger.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const startX = dir === "ltr" ? 32 : 68;
  const endX = dir === "ltr" ? 68 : 32;
  // inclinação leve das pegadas na direção do caminho (graus)
  const tilt = Math.atan2(endX - startX, 100) * (180 / Math.PI) * 0.5;

  const steps = Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const side = i % 2 === 0 ? 1 : -1; // alterna pé esq/dir
    return {
      x: startX + (endX - startX) * t + side * 2.4, // afasta o pé da linha central
      y: t * 100,
      angle: 180 + tilt, // 180 = pontas dos dedos apontando para baixo
      left: side === 1,
      delay: i * 130,
    };
  });

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none relative mx-auto h-28 w-full max-w-sm md:h-40 md:max-w-md"
    >
      {steps.map((s, i) => (
        <span
          key={i}
          className="absolute transition-all duration-500 ease-out"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `translate(-50%,-50%) rotate(${s.angle}deg)${
              s.left ? " scaleX(-1)" : ""
            } scale(${visible ? 1 : 0.35})`,
            opacity: visible ? 0.85 : 0,
            transitionDelay: `${s.delay}ms`,
          }}
        >
          <BabyFootprint color={color} className="h-[15px] w-auto md:h-[19px]" />
        </span>
      ))}
    </div>
  );
}
