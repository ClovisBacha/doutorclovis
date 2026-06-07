"use client";
import React from "react";
import { motion } from "motion/react";

type Testimonial = {
  text: string;
  image: string;
  name: string;
  role: string;
};

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-background"
      >
        {[0, 1].map((_, outerIndex) => (
          <React.Fragment key={outerIndex}>
            {props.testimonials.map(({ text, image, name, role }, i) => (
              <div
                key={i}
                className="p-8 rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] max-w-xs w-full"
              >
                <div className="text-foreground/90 leading-relaxed">"{text}"</div>
                <div className="flex items-center gap-3 mt-5">
                  <img
                    src={image}
                    alt={name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="flex flex-col">
                    <div className="font-medium text-foreground leading-5 tracking-tight">{name}</div>
                    <div className="text-sm text-muted-foreground leading-5 tracking-tight">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};