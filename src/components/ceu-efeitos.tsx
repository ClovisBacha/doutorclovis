/**
 * A VIDA POR CIMA DA ARTE — estrelas, cadentes e luz que respira.
 *
 * As quatro artes de `ceu-do-dia.tsx` são imagens: bonitas e paradas. Isto é a
 * camada que se move em cima delas.
 *
 * ─── AS CINCO REGRAS ────────────────────────────────────────────────────────
 *
 * 1. **O bebê é o protagonista.** Tudo vive nas bordas e no alto, ATRÁS da
 *    bolha. Um risco de luz cruzando a barriga do bebê estraga a cena — e o
 *    conteúdo desta tela é o filho de alguém, não um papel de parede.
 * 2. **Só `transform` e `opacity`.** É o que a GPU faz de graça; qualquer
 *    coisa que mexa em layout trava o rolamento no celular.
 * 3. **Ciclos LONGOS, efeito visível numa fração pequena.** Uma estrela
 *    cadente a cada 3s vira chuva de meteoro e perde a graça. A cada 16s ela
 *    volta a ser um acontecimento.
 * 4. **Posições CONSTANTES, nunca sorteadas.** `Math.random()` daria mismatch
 *    de hidratação: o servidor sorteia um céu e o cliente sorteia outro.
 * 5. **Cada arte recebe só o que combina com ela.** Estrela cadente ao
 *    meio-dia seria mentira; brilho de sol à meia-noite também.
 *
 * ─── MODO CUIDADO ───────────────────────────────────────────────────────────
 *
 * Silencia tudo. Quem perdeu a gestação abre este app para falar com o médico,
 * e uma estrela cadente cortando o céu é festa — o mesmo motivo pelo qual o
 * confete e o placar já são desligados.
 */

import type { NomeDoCeu } from "@/components/ceu-do-dia";

/** Estrelas cadentes: onde nascem e quando. Constantes, nunca sorteadas. */
const CADENTES = [
  { esq: 62, topo: 9, atraso: 0, dur: 15 },
  { esq: 30, topo: 20, atraso: 6.5, dur: 19 },
  { esq: 78, topo: 26, atraso: 11.5, dur: 23 },
];

/**
 * Estrelas que piscam.
 *
 * Ficam nos 45% de cima e fora da faixa central (35%–65% da largura), que é
 * por onde a bolha passa — ver a regra 1.
 */
const ESTRELAS = [
  { esq: 8, topo: 12, r: 1.6, atraso: 0 },
  { esq: 17, topo: 27, r: 1.1, atraso: 2.1 },
  { esq: 26, topo: 7, r: 1.4, atraso: 4.4 },
  { esq: 12, topo: 38, r: 1.2, atraso: 1.2 },
  { esq: 31, topo: 33, r: 1, atraso: 5.8 },
  { esq: 70, topo: 15, r: 1.5, atraso: 3.3 },
  { esq: 82, topo: 30, r: 1.2, atraso: 0.9 },
  { esq: 90, topo: 10, r: 1.3, atraso: 6.2 },
  { esq: 76, topo: 40, r: 1, atraso: 2.7 },
  { esq: 94, topo: 24, r: 1.4, atraso: 4.9 },
];

/** Onde mora o astro de cada arte — o brilho respira em volta dele. */
const ASTRO: Record<NomeDoCeu, { esq: number; topo: number; cor: string } | null> = {
  // A lua do amanhecer, à direita, na altura da esfera.
  amanhecer: { esq: 86, topo: 31, cor: "255,247,235" },
  // O sol alto do meio-dia.
  dia: { esq: 79, topo: 15, cor: "255,244,196" },
  // O sol encostando na duna.
  "por-do-sol": { esq: 84, topo: 56, cor: "255,226,150" },
  anoitecer: { esq: 84, topo: 20, cor: "246,228,255" },
};

export function CeuEfeitos({ nome, careMode = false }: { nome: NomeDoCeu; careMode?: boolean }) {
  if (careMode) return null;

  const noite = nome === "anoitecer";
  const madrugadinha = nome === "amanhecer";
  const astro = ASTRO[nome];

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100svh+0.5rem+var(--safe-top))] overflow-hidden"
      aria-hidden
    >
      {/* ── O BRILHO DO ASTRO ──────────────────────────────────────────
          Um halo que incha e murcha devagar em volta do sol/da lua que já
          está PINTADO na arte. Não desenha um segundo astro: só faz o que
          existe pulsar, como uma fonte de luz de verdade. */}
      {astro && (
        <span
          className="dc-astro-brilho absolute rounded-full"
          style={{
            left: `${astro.esq}%`,
            top: `${astro.topo}%`,
            width: "34vw",
            height: "34vw",
            marginLeft: "-17vw",
            marginTop: "-17vw",
            background: `radial-gradient(circle, rgba(${astro.cor},0.3) 0%, rgba(${astro.cor},0.12) 34%, rgba(${astro.cor},0) 68%)`,
          }}
        />
      )}

      {/* ── AS ESTRELAS ────────────────────────────────────────────────
          Só onde faz sentido: a noite inteira, e no amanhecer as últimas que
          ainda resistem — por isso a opacidade cai pela metade lá. */}
      {(noite || madrugadinha) &&
        ESTRELAS.map((e, i) => (
          <span
            key={i}
            className="dc-pisca absolute rounded-full bg-white"
            style={{
              left: `${e.esq}%`,
              top: `${e.topo}%`,
              width: e.r * 2,
              height: e.r * 2,
              /* O brilho de cada uma vai no `box-shadow` e num `opacity` de
                 base que a animação MULTIPLICA — escritos os dois em
                 `opacity`, o CSS venceria e todas piscariam igual. */
              opacity: madrugadinha ? 0.4 : 0.85,
              boxShadow: `0 0 ${e.r * 3}px rgba(255,255,255,0.8)`,
              animationDelay: `${e.atraso}s`,
            }}
          />
        ))}

      {/* ── AS CADENTES ────────────────────────────────────────────────
          Só à noite. Cada uma cruza um pedaço curto do céu no ALTO e some —
          nunca atravessa a tela inteira, e nunca desce até a faixa do bebê.
          O risco é um gradiente que morre nas duas pontas: cadente não tem
          começo nem fim, tem passagem. */}
      {noite &&
        CADENTES.map((c, i) => (
          <span
            key={i}
            className="dc-cadente absolute"
            style={{
              left: `${c.esq}%`,
              top: `${c.topo}%`,
              animationDelay: `${c.atraso}s`,
              animationDuration: `${c.dur}s`,
            }}
          />
        ))}

      {/* ── A AURORA ───────────────────────────────────────────────────
          Uma faixa de luz muito fraca que desliza pela banda das ondas, na
          altura em que a arte já tem os fios acesos. Reforça o que está
          pintado em vez de inventar um elemento novo. */}
      {noite && (
        <span className="dc-aurora absolute inset-x-0" style={{ top: "58%", height: "22%" }} />
      )}
    </div>
  );
}
