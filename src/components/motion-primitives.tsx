import { motion, useReducedMotion, type Variants } from "motion/react";
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
  const reduce = useReducedMotion();
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
  const reduce = useReducedMotion();
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
  const reduce = useReducedMotion();
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
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
