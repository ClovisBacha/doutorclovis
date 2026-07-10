import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionTemplate,
  type Variants,
} from "motion/react";
import { Check } from "lucide-react";

// Ruído sutil por cima do vidro — dá textura e tira o aspecto "plástico".
const NOISE_PATTERN =
  'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")';

// Rosé quente da marca (aprox. do --primary) usado nos brilhos e detalhes.
const ACCENT = "228, 150, 142";

export type PricingGlassTier = {
  name: string;
  /** Linha secundária (o "para quem é" do plano). */
  tagline: string;
  /** Valor já formatado, sem moeda. Ex.: "347", "0", "1.500". */
  price: string;
  /** Valor riscado (promoção). */
  oldPrice?: string;
  /** Moeda exibida antes do número. Padrão "R$". */
  currency?: string;
  /** Sufixo do preço. Padrão "/mês". */
  period?: string;
  /** Mostra "a partir de" acima do preço. */
  fromPrefix?: boolean;
  /** Linha pequena abaixo do preço (ex.: economia no anual). */
  footnote?: string;
  isPopular?: boolean;
  /** Texto da fita do plano em destaque. Padrão "Mais popular". */
  popularLabel?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
};

export interface PricingGlassProps {
  tiers: PricingGlassTier[];
  /** Estado do toggle (controlado). */
  annual?: boolean;
  /** Ao passar o handler, o toggle Mensal/Anual aparece. Sem ele, fica oculto. */
  onAnnualChange?: (annual: boolean) => void;
  monthlyLabel?: string;
  annualLabel?: string;
  /** Selo verde ao lado de "Anual" (ex.: "25% OFF"). */
  saveBadge?: string;
  /** Legenda opcional abaixo do toggle. */
  toggleNote?: string;
  className?: string;
}

const legoVariant: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.8 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 25 },
  },
};

function PricingCard({ tier }: { tier: PricingGlassTier }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const currency = tier.currency ?? "R$";
  const period = tier.period ?? "/mês";

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 60, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring",
            stiffness: 300,
            damping: 24,
            staggerChildren: 0.1,
            delayChildren: 0.15,
          },
        },
      }}
      onMouseMove={handleMouseMove}
      className={`group relative flex w-full flex-col overflow-hidden rounded-[32px] bg-white/[0.02] backdrop-blur-3xl backdrop-saturate-200 backdrop-brightness-110 transition-all duration-500 ${
        tier.isPopular
          ? "border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(255,255,255,0.05),0_32px_64px_-12px_rgba(0,0,0,0.6),0_0_80px_rgba(228,150,142,0.10)] md:-translate-y-4"
          : "border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_32px_64px_-12px_rgba(0,0,0,0.6)]"
      }`}
    >
      {/* Brilho que segue o cursor */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 rounded-[32px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(600px at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.14), transparent)`,
        }}
      />

      {/* Borda giratória no plano em destaque */}
      {tier.isPopular && (
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-[32px] p-px"
          style={{
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        >
          <div
            className="absolute -inset-full animate-[spin_4s_linear_infinite]"
            style={{
              background: `conic-gradient(from 0deg, transparent 70%, rgba(${ACCENT},0.9) 100%)`,
            }}
          />
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: NOISE_PATTERN }}
      />

      {tier.isPopular && (
        <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-xl border-x border-b border-white/10 bg-white/10 px-4 py-1 text-xs font-medium text-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md">
          {tier.popularLabel ?? "Mais popular"}
        </div>
      )}

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col p-8 md:p-10">
        <motion.h3
          variants={legoVariant}
          className="text-xl font-semibold tracking-wide text-white/85"
        >
          {tier.name}
        </motion.h3>

        <motion.p variants={legoVariant} className="mt-1 text-sm font-medium text-white/45">
          {tier.tagline}
        </motion.p>

        {(tier.fromPrefix || tier.oldPrice) && (
          <motion.span variants={legoVariant} className="mt-4 text-xs text-white/40">
            {tier.oldPrice ? (
              <>
                de{" "}
                <span className="font-medium line-through">
                  {currency} {tier.oldPrice}
                </span>{" "}
                por
              </>
            ) : (
              "a partir de"
            )}
          </motion.span>
        )}

        <motion.div
          variants={legoVariant}
          className={`mb-2 flex items-baseline gap-1 ${tier.fromPrefix || tier.oldPrice ? "mt-1" : "mt-4"}`}
        >
          <span className="text-2xl font-medium tracking-tight text-white/40">{currency}</span>
          {/* overflow-y-hidden clipa só o eixo vertical (slide da animação);
              shrink-0 impede o flexbox de encolher e cortar o último dígito. */}
          <div className="flex h-[60px] shrink-0 items-center overflow-y-hidden">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={tier.price}
                initial={{ y: 40, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -40, opacity: 0, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="block whitespace-nowrap text-[56px] font-bold leading-none tracking-tighter text-white md:text-[60px]"
              >
                {tier.price}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="ml-1 text-lg font-medium text-white/40">{period}</span>
        </motion.div>

        {tier.footnote && (
          <motion.p
            variants={legoVariant}
            className="mb-6 min-h-[20px] text-xs font-medium text-white/50"
          >
            {tier.footnote}
          </motion.p>
        )}

        <motion.div variants={legoVariant} className="mb-8 h-px w-full bg-white/10" />

        <div className="mb-10 flex flex-1 flex-col gap-4">
          {tier.features.map((feat, i) => (
            <motion.div key={i} variants={legoVariant} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                style={{ backgroundColor: `rgba(${ACCENT},0.18)` }}
              >
                <Check className="h-3 w-3 text-white/95" strokeWidth={3} />
              </div>
              <span className="text-[14px] font-medium leading-tight text-white/70">{feat}</span>
            </motion.div>
          ))}
        </div>

        <motion.div variants={legoVariant} className="pointer-events-auto mt-auto">
          <a
            href={tier.ctaHref}
            className={`block w-full rounded-[16px] py-4 text-center text-[15px] font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all duration-300 ${
              tier.isPopular
                ? "bg-white text-[#2a1518] hover:scale-[1.02] hover:bg-white/90"
                : "border border-white/10 bg-white/10 text-white hover:scale-[1.02] hover:bg-white/20"
            }`}
          >
            {tier.ctaLabel}
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function PricingGlass({
  tiers,
  annual: annualProp,
  onAnnualChange,
  monthlyLabel = "Mensal",
  annualLabel = "Anual",
  saveBadge,
  toggleNote,
  className,
}: PricingGlassProps) {
  // Toggle controlado quando onAnnualChange é passado; senão, estado interno.
  const [internalAnnual, setInternalAnnual] = useState(false);
  const isAnnual = annualProp ?? internalAnnual;
  const showToggle = typeof onAnnualChange === "function";
  const setAnnual = (v: boolean) => (onAnnualChange ? onAnnualChange(v) : setInternalAnnual(v));

  const cols =
    tiers.length >= 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : tiers.length === 2
        ? "sm:grid-cols-2"
        : "md:grid-cols-3";

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
      className={`relative flex w-full flex-col items-center justify-center gap-12 p-4 ${className || ""}`}
    >
      {/* Brilho central rosé */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ backgroundColor: `rgba(${ACCENT},0.10)` }}
        animate={{ scale: isAnnual ? 1.05 : 1, opacity: isAnnual ? 0.16 : 0.1 }}
        transition={{ duration: 1 }}
      />

      {showToggle && (
        <div className="relative z-20 flex flex-col items-center gap-3">
          <motion.div
            variants={legoVariant}
            className="relative flex items-center rounded-full border border-white/10 bg-white/5 p-1.5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
          >
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`relative z-10 rounded-full px-6 py-3 text-sm font-semibold transition-colors duration-300 md:px-8 ${
                !isAnnual ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {monthlyLabel}
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`relative z-10 rounded-full px-6 py-3 text-sm font-semibold transition-colors duration-300 md:px-8 ${
                isAnnual ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {annualLabel}
              {saveBadge && (
                <span className="absolute -right-3 -top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold tracking-wider text-[#2a1518] shadow-lg md:-right-6">
                  {saveBadge}
                </span>
              )}
            </button>

            <motion.div
              className="absolute bottom-1.5 left-1.5 top-1.5 w-[calc(50%-6px)] rounded-full border border-white/20 bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              animate={{ x: isAnnual ? "100%" : "0%" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </motion.div>
          {toggleNote && (
            <motion.p variants={legoVariant} className="text-xs font-medium text-white/60">
              {toggleNote}
            </motion.p>
          )}
        </div>
      )}

      <div className={`relative z-20 grid w-full grid-cols-1 items-stretch gap-6 lg:gap-8 ${cols}`}>
        {tiers.map((tier) => (
          <PricingCard key={tier.name} tier={tier} />
        ))}
      </div>
    </motion.div>
  );
}
