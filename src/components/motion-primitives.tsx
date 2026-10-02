import { motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useState } from "react";

/**
 * ⚠️ `useReduzDepoisDeMontar()` NÃO PODE DECIDIR O PRIMEIRO RENDER.
 *
 * No servidor ela devolve `false` (não há `matchMedia`); no aparelho de quem
 * ligou "Reduzir movimento" ela devolve `true` já na primeira pintura. Com a
 * decisão no render, o servidor mandava `<motion.div style="opacity:0">` e o
 * cliente montava `<div>` sem estilo — o React acusava atributos divergentes
 * em TODA aba com `Stagger`, para toda paciente com essa opção do iOS. Medido
 * na `/preview-bebe-tab`: `reducedMotion: "reduce"` → 1 aviso; sem → 0.
 *
 * A régua é a mesma de `podeGravar` (`capacidade-fora-do-render`): o que
 * depende do aparelho é lido DEPOIS de montar. O primeiro render é igual dos
 * dois lados; quem pede menos movimento recebe o `<div>` estático um quadro
 * depois — sem animação no meio, porque `initial` já era opacidade 0.
 */
function useReduzDepoisDeMontar(): boolean {
  const prefere = useReducedMotion();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado && !!prefere;
}
import type { ReactNode } from "react";

/**
 * Primitivas de movimento do app da paciente.
 *
 * Reutilizam a `motion` (já instalada) para dar aquela sensação de app nativo:
 * conteúdo que entra em cascata e revela ao rolar. Todas respeitam
 * `prefers-reduced-motion` — quando ativo, renderizam um `<div>` estático sem
 * animação nenhuma.
 *
 * Casa com o easing do resto do app: `--ease-out-expo` = cubic-bezier(0.16,1,0.3,1).
 */

const EASE = [0.16, 1, 0.3, 1] as const;

type BaseProps = {
  children: ReactNode;
  className?: string;
};

/** Revela o bloco (fade + subida suave) quando ele entra na viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
}: BaseProps & { delay?: number; y?: number }) {
  const reduce = useReduzDepoisDeMontar();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * Container que faz os filhos (`StaggerItem`) entrarem em cascata ao montar.
 * Ideal pra telas que a paciente abre — os cards surgem um após o outro.
 */
export function Stagger({ children, className }: BaseProps) {
  const reduce = useReduzDepoisDeMontar();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/**
 * Fade + subida sutil ao montar. Ideal pra trocar conteúdo de sub-aba: passe
 * `key` (ex.: a sub-aba atual) pra reanimar a cada troca.
 */
export function Fade({ children, className }: BaseProps) {
  const reduce = useReduzDepoisDeMontar();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Item de um `Stagger`. */
export function StaggerItem({ children, className }: BaseProps) {
  const reduce = useReduzDepoisDeMontar();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
