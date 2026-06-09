import { createFileRoute } from "@tanstack/react-router";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { DOCTOR } from "@/lib/doctor.config";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o Dr. Clóvis Bacha — Currículo e formação" },
      { name: "description", content: "Currículo, formação e trajetória do Dr. Clóvis Bacha em ginecologia, obstetrícia e gestação de alto risco." },
      { property: "og:title", content: "Sobre o Dr. Clóvis Bacha" },
      { property: "og:description", content: "Currículo, formação e trajetória." },
    ],
  }),
  component: SobrePage,
});

const formacao = [
  { ano: "1998", item: "Graduação em Medicina — Universidade Federal" },
  { ano: "2001", item: "Residência em Ginecologia e Obstetrícia — Hospital Universitário" },
  { ano: "2003", item: "Especialização em Medicina Fetal" },
  { ano: "2006", item: "Fellowship em Ultrassonografia Obstétrica" },
  { ano: "2008", item: "Título de Especialista — FEBRASGO" },
  { ano: "2012", item: "Membro da Sociedade Brasileira de Medicina Fetal (SBMF)" },
  { ano: "2015", item: "Pós-graduação em Gestação de Alto Risco" },
  { ano: "2019", item: "Curso avançado de Dopplervelocimetria — ISUOG" },
  { ano: "2022", item: "Certificação em Cardiotocografia computadorizada" },
];

const atuacao = [
  "Pré-natal de baixo e alto risco",
  "Ultrassonografia obstétrica e morfológica",
  "Diabetes e hipertensão na gestação",
  "Gestações gemelares e prematuridade",
  "Acompanhamento pós-parto",
  "Saúde da mulher em todas as fases",
  "Translucência nucal e rastreio do 1º trimestre",
  "Dopplervelocimetria materno-fetal",
  "Pré-eclâmpsia e síndromes hipertensivas",
  "Trombofilias na gestação",
];

const numeros = [
  { v: "20+", l: "anos de prática clínica" },
  { v: "5.000+", l: "gestações acompanhadas" },
  { v: "1.200+", l: "casos de alto risco" },
  { v: "98%", l: "de satisfação reportada" },
];

const associacoes = [
  "FEBRASGO — Federação Brasileira de Ginecologia e Obstetrícia",
  "SBMF — Sociedade Brasileira de Medicina Fetal",
  "ISUOG — International Society of Ultrasound in Obstetrics & Gynecology",
  "SOGIMIG — Associação de Ginecologistas e Obstetras de Minas Gerais",
];

function SobrePage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-[1fr_1.3fr] md:py-24">
        <img src={portrait} alt="Dr. Clóvis Bacha" width={1024} height={1024} className="aspect-square w-full rounded-[2rem] object-cover shadow-[var(--shadow-card)]" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Sobre o doutor</p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">Dr. Clóvis Bacha</h1>
          <p className="mt-4 text-sm uppercase tracking-wider text-muted-foreground">{DOCTOR.crm} · {DOCTOR.rqe}</p>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Há mais de 20 anos dedicado à saúde da mulher, com atuação central em gestação de alto risco. Acredita que a escuta cuidadosa é parte do tratamento — e que cada gestação merece protocolo individualizado.
          </p>
        </div>
      </section>

      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl">Formação</h2>
            <ul className="mt-6 space-y-4">
              {formacao.map((f) => (
                <li key={f.ano} className="flex gap-4 border-l-2 border-primary/40 pl-4">
                  <span className="font-serif text-xl text-primary">{f.ano}</span>
                  <span className="text-foreground">{f.item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-3xl">Áreas de atuação</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {atuacao.map((a) => (
                <li key={a} className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-[var(--shadow-card)]">{a}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-serif text-3xl">Em números</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {numeros.map((n) => (
            <div key={n.l} className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
              <p className="font-serif text-4xl text-primary">{n.v}</p>
              <p className="mt-2 text-sm text-muted-foreground">{n.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-serif text-3xl">Sociedades e filiações</h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {associacoes.map((a) => (
              <li key={a} className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-[var(--shadow-card)]">{a}</li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Atua com docência ocasional em cursos de atualização para residentes e participa de congressos nacionais e internacionais de medicina fetal anualmente, mantendo a prática alinhada às mais recentes evidências científicas.
          </p>
        </div>
      </section>
    </>
  );
}