import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type ElementType,
} from "react";

type Variant = "up" | "fade" | "scale" | "left" | "right" | "blur";

export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const base: CSSProperties = {
    transition:
      "opacity 800ms cubic-bezier(.2,.8,.2,1), transform 800ms cubic-bezier(.2,.8,.2,1), filter 800ms cubic-bezier(.2,.8,.2,1)",
    transitionDelay: `${delay}ms`,
    willChange: "opacity, transform, filter",
  };

  const hidden: Record<Variant, CSSProperties> = {
    up: { opacity: 0, transform: "translate3d(0,28px,0)" },
    fade: { opacity: 0 },
    scale: { opacity: 0, transform: "scale(.94)" },
    left: { opacity: 0, transform: "translate3d(-28px,0,0)" },
    right: { opacity: 0, transform: "translate3d(28px,0,0)" },
    blur: { opacity: 0, filter: "blur(14px)", transform: "translate3d(0,16px,0)" },
  };

  const visible: CSSProperties = {
    opacity: 1,
    transform: "translate3d(0,0,0) scale(1)",
    filter: "blur(0)",
  };

  const style = { ...base, ...(shown ? visible : hidden[variant]) };

  return (
    <As ref={ref as never} style={style} className={className}>
      {children}
    </As>
  );
}
