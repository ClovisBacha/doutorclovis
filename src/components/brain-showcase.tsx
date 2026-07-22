import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/reveal";

/**
 * Cérebro neural animado — desenhado em SVG puro, sem assets externos.
 * Silhueta orgânica (amigável) + rede de sinapses com pulsos viajando
 * (tecnológico). Gradiente rosa→violeta→ciano: a ponte entre o acolhimento
 * do site e a mensagem de tecnologia. Tudo CSS; respeita reduced-motion.
 */
export function NeuralBrain({ className = "" }: { className?: string }) {
  // Nós da rede neural (coordenadas no viewBox 220×190)
  const nodes: [number, number, number][] = [
    // [cx, cy, raio]
    [74, 72, 3.2],
    [104, 58, 4],
    [146, 72, 3.2],
    [64, 98, 3],
    [88, 102, 3.6],
    [104, 122, 4.4],
    [132, 102, 3.6],
    [156, 98, 3],
    [62, 132, 2.8],
    [158, 132, 2.8],
    [104, 88, 5],
  ];
  // Sinapses: pares de nós conectados (índices em `nodes`)
  const links: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 4],
    [4, 10],
    [10, 5],
    [5, 6],
    [6, 7],
    [7, 2],
    [8, 5],
    [9, 5],
    [4, 5],
    [6, 10],
    [1, 10],
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Halo pulsante atrás do cérebro */}
      <div
        className="brain-halo absolute inset-[8%] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(167,139,250,0.35), rgba(103,232,249,0.12) 55%, transparent 75%)",
          filter: "blur(18px)",
        }}
        aria-hidden
      />
      <svg viewBox="0 0 220 190" className="relative h-auto w-full" aria-hidden>
        <defs>
          <linearGradient id="neuralGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f9a8d4" />
            <stop offset="52%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <linearGradient id="synapseGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
        </defs>

        {/* Órbita de "dados" girando ao redor */}
        <g className="brain-orbit">
          <ellipse
            cx="110"
            cy="95"
            rx="102"
            ry="78"
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="1"
            strokeDasharray="2 7"
          />
          <circle cx="212" cy="95" r="3" fill="#67e8f9" />
          <circle cx="8" cy="95" r="2.2" fill="#f9a8d4" />
        </g>

        {/* Silhueta do cérebro (blobby, amigável) */}
        <path
          d="M62 30 C 40 34, 24 52, 26 74 C 12 84, 12 106, 24 116 C 20 136, 34 154, 56 154 C 64 168, 86 172, 100 162 C 118 174, 142 170, 152 156 C 174 156, 190 140, 188 120 C 202 108, 202 84, 188 74 C 190 52, 172 36, 152 38 C 140 22, 118 18, 104 28 C 90 16, 72 20, 62 30 Z"
          fill="rgba(167,139,250,0.07)"
          stroke="url(#neuralGrad)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Fissura central + giros (dobras) */}
        <path
          d="M104 30 C 100 62, 110 92, 102 160"
          fill="none"
          stroke="url(#neuralGrad)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
        />
        {[
          "M40 70 C 60 62, 72 78, 64 96",
          "M36 112 C 56 104, 70 118, 60 132",
          "M62 40 C 78 44, 84 60, 74 72",
          "M180 70 C 160 62, 148 78, 156 96",
          "M184 112 C 164 104, 150 118, 160 132",
          "M158 40 C 142 44, 136 60, 146 72",
        ].map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="url(#neuralGrad)"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.4"
          />
        ))}

        {/* Sinapses: pulsos de luz viajando entre os nós */}
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke="url(#synapseGrad)"
            strokeWidth="1.3"
            className="synapse"
            style={{ animationDelay: `${(i % 7) * 0.4}s` }}
            opacity="0.8"
          />
        ))}

        {/* Neurônios pulsando */}
        {nodes.map(([cx, cy, r], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill={
              i === 10 ? "#e9d5ff" : i % 3 === 0 ? "#f9a8d4" : i % 3 === 1 ? "#a78bfa" : "#67e8f9"
            }
            className="brain-node"
            style={{ animationDelay: `${(i % 5) * 0.5}s` }}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * Seção-vitrine do Segundo Cérebro na home: a faixa escura tecnológica que
 * apresenta o produto mais forte — para o MÉDICO (seu conhecimento vira um
 * assistente que aprende) e para a PACIENTE (a IA responde como o médico
 * dela). Cérebro animado + demonstração viva do chat + CTAs para os dois.
 */
export function BrainShowcase() {
  return (
    <section id="segundo-cerebro" className="brain-tech relative overflow-hidden text-white">
      {/* Grade de circuito estática — sem varredura em movimento (conforto visual) */}
      <div className="brain-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1fr_1.05fr] md:gap-14 md:py-24">
        {/* ── Cérebro vivo + balões de conversa flutuando ── */}
        <Reveal variant="scale" className="relative mx-auto w-full max-w-md">
          <NeuralBrain className="mx-auto w-[82%]" />

          {/* Demonstração viva: a paciente pergunta, a IA responde como o médico */}
          <div className="brain-bubble absolute -left-1 top-[8%] max-w-[220px] rounded-2xl rounded-bl-sm bg-white/95 px-3.5 py-2.5 text-[12px] font-medium text-slate-800 shadow-xl md:-left-4">
            “Posso tomar dipirona na gestação?” 🤰
          </div>
          <div
            className="brain-bubble absolute -right-1 bottom-[10%] max-w-[240px] rounded-2xl rounded-br-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3.5 py-2.5 text-[12px] font-medium text-white shadow-xl md:-right-4"
            style={{ animationDelay: "1.6s" }}
          >
            “A Dra. orienta que sim, na dose certa — e explica quando evitar.” 🧠
          </div>
          <div
            className="brain-bubble absolute -bottom-2 left-[12%] rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur"
            style={{ animationDelay: "0.8s" }}
          >
            aprende a cada conversa
          </div>
        </Reveal>

        {/* ── Mensagem ── */}
        <div>
          <Reveal variant="up">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
              </span>
              Nossa tecnologia exclusiva
            </p>
          </Reveal>
          <Reveal variant="up" delay={100}>
            <h2 className="mt-4 font-serif text-3xl leading-tight md:text-5xl">
              O{" "}
              <span className="bg-gradient-to-r from-pink-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                Segundo Cérebro
              </span>{" "}
              do seu médico
            </h2>
          </Reveal>
          <Reveal variant="up" delay={200}>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
              O conhecimento do obstetra vira uma inteligência que atende as pacientes dele 24h —
              com as respostas, o tom e as condutas que{" "}
              <strong className="text-white">ele mesmo validou</strong>. E a cada conversa, o
              cérebro aprende: o que ele não sabe, pergunta ao médico e nunca mais esquece.
            </p>
          </Reveal>

          {/* O ciclo em 3 passos */}
          <Reveal variant="up" delay={300}>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                [
                  "🧬",
                  "O médico ensina",
                  "Estilo, frases e condutas — em minutos, até gravando a própria consulta.",
                ],
                [
                  "💬",
                  "A IA atende 24h",
                  "Cada paciente fala com o cérebro do PRÓPRIO médico, dia e noite.",
                ],
                [
                  "📈",
                  "Aprende sempre",
                  "Dúvida nova vira aprendizado aprovado pelo médico — o cérebro só cresce.",
                ],
              ].map(([emoji, title, text]) => (
                <div
                  key={title as string}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <p className="text-xl">{emoji}</p>
                  <p className="mt-1.5 text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/60">{text}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal variant="up" delay={400}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/medicos"
                className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_30px_rgba(167,139,250,0.35)] transition-transform hover:scale-[1.03]"
              >
                Sou médico — criar meu Segundo Cérebro
              </Link>
              <Link
                to="/encontrar-medico"
                className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
              >
                Sou paciente — falar com a IA do meu médico
              </Link>
            </div>
          </Reveal>
          <Reveal variant="fade" delay={500}>
            <p className="mt-4 text-xs text-white/45">
              🔒 Nada entra no cérebro sem a aprovação do médico. Em urgência, a IA orienta procurar
              atendimento — sempre.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
