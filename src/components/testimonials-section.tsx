"use client";
import { motion } from "motion/react";
import { TestimonialsColumn } from "@/components/ui/testimonials-columns-1";

const testimonials = [
  {
    text: "Tive pré-eclâmpsia na primeira gestação. O Dr. Clóvis me acompanhou semanalmente, com calma e firmeza. Cheguei ao parto segura.",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    name: "Marina S.",
    role: "Belo Horizonte · MG",
  },
  {
    text: "Gestação gemelar, com muito medo. O doutor me explicava cada exame com paciência. A escuta dele faz toda a diferença.",
    image: "https://randomuser.me/api/portraits/women/22.jpg",
    name: "Juliana R.",
    role: "São Paulo · SP",
  },
  {
    text: "Diabetes gestacional descoberta tarde. Em duas semanas com o protocolo do Dr. Clóvis estávamos com tudo sob controle.",
    image: "https://randomuser.me/api/portraits/women/33.jpg",
    name: "Ana Carolina M.",
    role: "Rio de Janeiro · RJ",
  },
  {
    text: "Já indiquei para várias amigas. Atendimento humano de verdade, sem pressa e sem rodeios.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Fernanda L.",
    role: "Curitiba · PR",
  },
  {
    text: "Após uma perda, voltei a engravidar com receio. O acolhimento foi essencial. Hoje tenho um menino saudável.",
    image: "https://randomuser.me/api/portraits/women/55.jpg",
    name: "Camila T.",
    role: "Salvador · BA",
  },
  {
    text: "Equipe sempre disponível, respostas rápidas, exames acompanhados pelo próprio doutor. Recomendo sem reservas.",
    image: "https://randomuser.me/api/portraits/women/66.jpg",
    name: "Patrícia A.",
    role: "Goiânia · GO",
  },
  {
    text: "Senti segurança do início ao fim. O acompanhamento próximo me trouxe tranquilidade em cada trimestre.",
    image: "https://randomuser.me/api/portraits/women/77.jpg",
    name: "Beatriz N.",
    role: "Vitória · ES",
  },
  {
    text: "Profissional atento, ético e extremamente cuidadoso. Recomendo a todas as gestantes que buscam excelência.",
    image: "https://randomuser.me/api/portraits/women/88.jpg",
    name: "Larissa P.",
    role: "Brasília · DF",
  },
  {
    text: "O Dr. Clóvis transformou uma gestação de risco em uma jornada confiante. Gratidão eterna pela nossa família.",
    image: "https://randomuser.me/api/portraits/women/90.jpg",
    name: "Renata V.",
    role: "Contagem · MG",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

// Durations are 50% slower than the typical (15/19/17) baseline.
export function TestimonialsSection() {
  return (
    <section className="bg-background relative">
      <div className="container z-10 mx-auto max-w-6xl px-5 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center justify-center max-w-2xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            Depoimentos
          </div>
          <h2 className="mt-5 font-serif text-4xl md:text-5xl tracking-tight text-foreground">
            Histórias reais de quem foi acompanhada
          </h2>
          <p className="mt-4 text-muted-foreground">
            O que as pacientes do Dr. Clóvis dizem sobre a jornada.
          </p>
        </motion.div>

        <div className="flex justify-center gap-6 mt-12 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={22} />
          <TestimonialsColumn
            testimonials={secondColumn}
            className="hidden md:block"
            duration={29}
          />
          <TestimonialsColumn
            testimonials={thirdColumn}
            className="hidden lg:block"
            duration={26}
          />
        </div>
      </div>
    </section>
  );
}
