import { useState } from "react";

const meses = [
  { mes: 1, semana: "1-4", tamanho: "0,2 cm", peso: "—", fruta: "Semente de papoula", desc: "Implantação no útero e formação do tubo neural. Coração começa a se formar.", consulta: "1ª consulta pré-natal: confirmação da gestação, exames iniciais e ácido fólico." },
  { mes: 2, semana: "5-8", tamanho: "1,6 cm", peso: "1 g", fruta: "Framboesa", desc: "Início dos batimentos cardíacos. Braços e pernas começam a brotar.", consulta: "Ultrassom inicial para datação e avaliação do saco gestacional." },
  { mes: 3, semana: "9-13", tamanho: "7,4 cm", peso: "23 g", fruta: "Limão", desc: "Órgãos vitais formados. O bebê já se mexe, mesmo que você ainda não sinta.", consulta: "Translucência nucal (11-13s6d) + bioquímica do 1º trimestre." },
  { mes: 4, semana: "14-17", tamanho: "13 cm", peso: "140 g", fruta: "Abacate", desc: "Cabelo e sobrancelhas aparecem. Reflexos de sucção começam.", consulta: "Consulta mensal + exames de rotina (sangue e urina)." },
  { mes: 5, semana: "18-22", tamanho: "19 cm", peso: "300 g", fruta: "Banana", desc: "Você começa a sentir os movimentos. Sexo já visível no ultrassom.", consulta: "Ultrassom morfológico do 2º trimestre — exame fundamental." },
  { mes: 6, semana: "23-27", tamanho: "32 cm", peso: "900 g", fruta: "Berinjela", desc: "Pulmões em maturação. O bebê responde a sons e luz.", consulta: "Teste oral de tolerância à glicose (rastreio de diabetes gestacional)." },
  { mes: 7, semana: "28-31", tamanho: "38 cm", peso: "1,5 kg", fruta: "Couve-flor", desc: "Abre e fecha os olhos. Já distingue dia e noite.", consulta: "Consulta quinzenal. Avaliação de crescimento e bem-estar fetal." },
  { mes: 8, semana: "32-35", tamanho: "45 cm", peso: "2,4 kg", fruta: "Abacaxi", desc: "Ganho rápido de peso e gordura. Posição cefálica se define.", consulta: "Ultrassom de crescimento + Doppler quando indicado." },
  { mes: 9, semana: "36-40", tamanho: "50 cm", peso: "3,4 kg", fruta: "Melancia pequena", desc: "Pulmões prontos. O bebê encaixa na pelve, pronto para nascer.", consulta: "Consulta semanal. Cardiotocografia e planejamento do parto." },
];

export function BabyEvolution() {
  const [m, setM] = useState(5);
  const atual = meses[m - 1];

  return (
    <section className="border-y border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Mês a mês</p>
          <h2 className="mt-3 font-serif text-3xl md:text-4xl">Evolução do bebê e suas consultas</h2>
          <p className="mt-3 text-muted-foreground">
            Acompanhe o tamanho, o desenvolvimento e os exames obrigatórios em cada fase da gestação.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {meses.map((x) => (
            <button
              key={x.mes}
              type="button"
              onClick={() => setM(x.mes)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                m === x.mes
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "border border-border bg-card text-muted-foreground hover:text-primary"
              }`}
            >
              Mês {x.mes}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:grid-cols-[1fr_1.4fr] md:p-10">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--gradient-warm)] p-8 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Tamanho aproximado</p>
            <div
              className="mt-4 rounded-full bg-primary/15"
              style={{
                width: `${Math.min(220, 30 + atual.mes * 22)}px`,
                height: `${Math.min(220, 30 + atual.mes * 22)}px`,
              }}
            />
            <p className="mt-5 font-serif text-3xl text-primary">{atual.tamanho}</p>
            <p className="text-sm text-muted-foreground">Peso: {atual.peso}</p>
            <p className="mt-3 text-xs text-muted-foreground">Equivalente a: {atual.fruta}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Semanas {atual.semana}</p>
            <h3 className="mt-1 font-serif text-2xl text-foreground">Mês {atual.mes}</h3>
            <p className="mt-4 text-base leading-relaxed text-foreground">{atual.desc}</p>
            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Consulta obrigatória
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{atual.consulta}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
