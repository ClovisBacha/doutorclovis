/**
 * Ambiente do céu da home — a vida de FUNDO de cada momento do dia.
 *
 * É detalhe, não protagonista: o bebê na bolha é a estrela da tela, e nada
 * aqui pode competir com ele. Por isso todo efeito obedece três limites:
 *
 *   ZONA   só as áreas de céu que a medição abaixo prova estarem livres.
 *   RITMO  ciclos longos com o efeito visível numa fração pequena do tempo.
 *          Uma estrela cadente a cada 3s vira chuva de meteoro.
 *   PESO   só `transform` e `opacity`, e no máximo ~6 elementos por cena.
 *
 * As posições e atrasos são CONSTANTES, nunca sorteados: `Math.random()` no
 * render faria servidor e cliente desenharem coisas diferentes e quebraria a
 * hidratação.
 *
 * ─────────────────── O MAPA DA TELA (medido, não estimado) ───────────────
 *
 * `top`/`left` em % contam a partir do herói, que é MAIS ALTO que a janela:
 * num iPhone de 430×900 o herói tem ~1107px. Ou seja: **1% aqui ≈ 11px, e a
 * dobra da tela cai em y 81%**, não em 100%. A primeira versão deste arquivo
 * ignorou isso e enterrou a névoa do pré-amanhecer atrás dos cartões — ela
 * renderizava e ninguém via.
 *
 * Zonas OCUPADAS (nada de partícula aqui — em % do herói):
 *
 *   y  0.0– 6.3   botão voltar (x 5–15) e chip de clima (x 67–95)
 *   y  6.0–17.0   assinatura "Acompanhando / Clovis" e as duas pílulas
 *   y 18.3–51.3   TINTA DO BEBÊ, entre x 19.6 e x 80.4
 *   y 54.6–61.6   "19 semanas e 6 dias" (x 31–69)
 *   y 61.6–72.6   cartão de medidas  (x 5–95)
 *   y 74.6–80.4   barra de navegação (x 4–96)
 *   y 82.8+       segunda dobra: progresso e saudação
 *
 * Sobram três faixas de céu limpo, e é nelas que tudo abaixo vive:
 *
 *   A) o alto entre os dois chips        →  x 16–66,  y 0–6
 *   B) as duas calhas ao lado do bebê    →  x < 19  ou  x > 81,  y 18–60
 *   C) a faixa sob o bebê                →  y 51.5–54.5, largura toda
 *
 * Quem mudar uma coordenada aqui: com o dev server de pé,
 *
 *   bun run sky:geo 21     # redesenha o mapa acima para aquela hora
 *   bun run sky:check      # prova que nada cobre o bebê nem some atrás de card
 *
 * Olhar o print não basta — foi assim que a névoa se perdeu.
 */

/** Partícula genérica posicionada em % — a base de quase todos os efeitos. */
type Particula = { x: number; y: number; delay: number; size?: number };

/* ── Madrugada (00–04): estrela cadente rara ────────────────────────
   Nas calhas (zona B) e quase na vertical, que é como meteoro cai de
   verdade. A primeira versão riscava na horizontal no meio do título: o
   `rotate` estava inline e a animação, que também mexe em `transform`, o
   sobrescrevia — a risca virava um traço parado ao lado do "Clovis". Agora
   a rotação mora DENTRO do keyframe, junto do deslocamento. */
const ESTRELAS_CADENTES: Particula[] = [
  { x: 1, y: 20, delay: 0 }, // desce pela calha esquerda
  { x: 86, y: 30, delay: 21 }, // e a seguinte, pela direita
];

/* ── Pré-amanhecer (04–06): as últimas estrelas e a névoa baixa ─────
   A hora tem duas coisas ao mesmo tempo: o céu ainda tem estrela, e o chão
   ainda tem neblina. A névoa é uma faixa única logo abaixo do bebê (zona
   C, estendida) — mais para baixo ela cai atrás do cartão de medidas. */
const NEVOAS: Particula[] = [{ x: 0, y: 55, delay: 0 }];
const ESTRELAS_QUE_APAGAM: Particula[] = [
  { x: 24, y: 3.5, delay: 0, size: 3 },
  { x: 60, y: 4.5, delay: 5, size: 3 },
  { x: 5, y: 40, delay: 9, size: 3 }, // longe da lua da arte, que fica em (5–13, 22)
  { x: 92, y: 22, delay: 14, size: 3 },
];
/* A arte do pré-amanhecer já vem cheia de estrelas pintadas, e ponto parado
   some no meio delas. O que NÃO existe na arte é movimento — por isso a cena
   ganha um satélite: um pontinho atravessando a faixa livre do alto em 34s,
   devagar o bastante para ser satélite e não estrela cadente. Às 5 da manhã é
   o que se vê no céu de verdade. */
const SATELITE: Particula = { x: 16, y: 5.5, delay: 6, size: 3 };

/* ── Anoitecer (19–21): as primeiras estrelas, acendendo em sequência ──
   Atrasos crescentes: elas aparecem uma a uma, como no céu de verdade.
   Duas versões atrás havia estrelas em (41,11) e (80,14) — a primeira
   sumia atrás do "Clovis", a segunda atrás da pílula do parto. E as de 2px
   se perdiam no gradiente do pôr do sol. Agora todas têm 3px e ficam nas
   zonas A e B. */
const PRIMEIRAS_ESTRELAS: Particula[] = [
  { x: 22, y: 2.4, delay: 0, size: 3 },
  { x: 58, y: 4.2, delay: 1.6, size: 3 },
  { x: 8, y: 21, delay: 3.4, size: 3 },
  { x: 92, y: 27, delay: 5.1, size: 3 },
  { x: 5, y: 36, delay: 6.8, size: 3 },
  { x: 94, y: 42, delay: 8.2, size: 3 },
];

/* ── Noite (21–24): vaga-lumes subindo nas laterais ─────────────────
   A primeira versão os pôs na metade de baixo (y 71–88%) e eles ficaram
   ATRÁS dos cartões. Agora vivem na zona B, onde o bebê não chega e
   nenhum cartão cobre. */
const VAGALUMES: Particula[] = [
  { x: 6, y: 52, delay: 0 },
  { x: 93, y: 44, delay: 4.5 },
  { x: 10, y: 57, delay: 8.5 },
  { x: 89, y: 58, delay: 12.5 },
];

/* ── Amanhecer (06–08): passarinhos ao longe ────────────────────────
   Três, em alturas e atrasos diferentes, cruzando o alto do céu (acima da
   tinta do bebê). É a hora em que eles cantam. Passar por trás da
   assinatura por um instante não é defeito: pássaro distante faz isso. */
const PASSAROS: Particula[] = [
  { x: 6, y: 2.5, delay: 0, size: 12 },
  { x: 2, y: 11.8, delay: 11, size: 10 },
  { x: 10, y: 6.5, delay: 22, size: 11 },
];

/* ── Manhã (08–11): sementinhas de dente-de-leão ────────────────────
   Nas calhas, subindo. Amarra com as Sementinhas, a moeda do app. */
const SEMENTINHAS: Particula[] = [
  { x: 8, y: 46, delay: 0, size: 6 },
  { x: 91, y: 38, delay: 6, size: 5 },
  { x: 13, y: 53, delay: 12, size: 4 },
  { x: 87, y: 52, delay: 17, size: 6 },
];

/* ── Meio-dia (11–14): o sol a pino ─────────────────────────────────
   Dois registros da mesma ideia: o halo quente no alto (zona A, achatado
   para não descer até o bebê — a versão anterior era um círculo de 62vw e
   cobria a barriga dele) e os estalos de luz nas calhas, aquele brilho de
   quatro pontas que só aparece com sol forte. */
const ESTALOS: Particula[] = [
  { x: 5, y: 26, delay: 0 },
  { x: 91, y: 34, delay: 3.2 },
  { x: 8, y: 45, delay: 6.4 },
];

/* ── Tarde (14–16): nuvens à deriva no alto ─────────────────────── */
const NUVENS: Particula[] = [
  { x: 4, y: 7, delay: 0, size: 92 },
  { x: 2, y: 15, delay: 24, size: 66 },
];

/* ── Golden hour (16–18): poeira dourada nas laterais ───────────── */
const MOTES: Particula[] = [
  { x: 7, y: 44, delay: 0, size: 5 },
  { x: 92, y: 36, delay: 3.5, size: 4 },
  { x: 11, y: 55, delay: 7, size: 6 },
  { x: 88, y: 50, delay: 10.5, size: 4 },
  { x: 5, y: 33, delay: 14, size: 5 },
];

/* ── Entardecer (18–19): o bando voltando, em V ─────────────────── */
const BANDO: { dx: number; dy: number; size: number }[] = [
  { dx: 0, dy: 0, size: 12 },
  { dx: -14, dy: -7, size: 11 },
  { dx: 14, dy: -7, size: 11 },
  { dx: -27, dy: -14, size: 9 },
  { dx: 27, dy: -14, size: 9 },
];

/** A silhueta de um pássaro distante: um "v" aberto, nada mais. Desenho com
 *  mais detalhe que isso, no tamanho que cabe aqui, vira mancha. */
function Passaro({ size, cor }: { size: number; cor: string }) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 20 11" fill="none">
      <path
        d="M1 9C4.5 9 7 1.5 10 1.5C13 1.5 15.5 9 19 9"
        stroke={cor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type SkyAmbienceProps = {
  /** Nome da faixa de hora (o campo `nome` de SKY_SLOTS). */
  slot: string;
  /** Modo Cuidado silencia tudo: numa perda, céu festivo é crueldade. */
  careMode?: boolean;
};

export function SkyAmbience({ slot, careMode }: SkyAmbienceProps) {
  if (careMode) return null;

  // `inset-0` + `overflow-hidden` no pai: nada escapa do herói. `z-0` deixa o
  // efeito ATRÁS do conteúdo, que vive em `relative` acima.
  const camada = "pointer-events-none absolute inset-0 z-0 overflow-hidden";

  if (slot === "madrugada") {
    return (
      <div aria-hidden className={camada}>
        {ESTRELAS_CADENTES.map((e, i) => (
          <span
            key={i}
            // Uma desce pela esquerda, a outra pela direita: mesma ideia,
            // dois cantos do céu.
            className={`absolute h-px w-16 rounded-full ${
              i % 2 === 0 ? "dc-shooting-star" : "dc-shooting-star-l"
            }`}
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              animationDelay: `${e.delay}s`,
              // Transparente nas duas pontas: a cauda nasce do nada e a
              // cabeça afina. Sem o segundo `transparent` o brilho terminava
              // num corte reto e parecia um traço quebrado.
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 86%, transparent 100%)",
              boxShadow: "0 0 6px 1px rgba(255,255,255,0.5)",
            }}
          />
        ))}
      </div>
    );
  }

  if (slot === "pré-amanhecer") {
    return (
      <div aria-hidden className={camada}>
        {ESTRELAS_QUE_APAGAM.map((e, i) => (
          <span
            key={i}
            className="dc-star-fade absolute rounded-full bg-white"
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              width: `${e.size}px`,
              height: `${e.size}px`,
              animationDelay: `${e.delay}s`,
              boxShadow: "0 0 5px 1px rgba(255,255,255,0.5)",
            }}
          />
        ))}
        <span
          className="dc-satellite absolute rounded-full bg-white"
          style={{
            left: `${SATELITE.x}%`,
            top: `${SATELITE.y}%`,
            width: `${SATELITE.size}px`,
            height: `${SATELITE.size}px`,
            animationDelay: `${SATELITE.delay}s`,
            boxShadow: "0 0 6px 2px rgba(226,236,255,0.55)",
          }}
        />
        {NEVOAS.map((n, i) => (
          <span
            key={i}
            className="dc-mist absolute left-0 w-full"
            style={{
              top: `${n.y}%`,
              height: "8%",
              animationDelay: `${n.delay}s`,
              background:
                "linear-gradient(180deg, transparent, rgba(214,222,244,0.34) 50%, transparent)",
              filter: "blur(10px)",
            }}
          />
        ))}
      </div>
    );
  }

  if (slot === "anoitecer") {
    return (
      <div aria-hidden className={camada}>
        {PRIMEIRAS_ESTRELAS.map((e, i) => (
          <span
            key={i}
            className="dc-star-wake absolute rounded-full bg-white"
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              width: `${e.size}px`,
              height: `${e.size}px`,
              animationDelay: `${e.delay}s`,
              boxShadow: "0 0 6px 1px rgba(255,255,255,0.6)",
            }}
          />
        ))}
      </div>
    );
  }

  if (slot === "noite") {
    return (
      <div aria-hidden className={camada}>
        {VAGALUMES.map((v, i) => (
          <span
            key={i}
            className="dc-firefly absolute h-1.5 w-1.5 rounded-full"
            style={{
              left: `${v.x}%`,
              top: `${v.y}%`,
              animationDelay: `${v.delay}s`,
              background:
                "radial-gradient(circle, #fff6c2 0%, #fbe08a 55%, rgba(251,224,138,0) 100%)",
              boxShadow: "0 0 10px 3px rgba(253,224,120,0.45)",
            }}
          />
        ))}
      </div>
    );
  }

  if (slot === "amanhecer") {
    return (
      <div aria-hidden className={camada}>
        {PASSAROS.map((p, i) => (
          <span
            key={i}
            className="dc-bird absolute"
            style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.delay}s` }}
          >
            {/* O filho leva o bater de asas; o pai leva a travessia. Duas
                animações num elemento só se cancelariam. */}
            <span>
              {/* Silhueta forte de propósito: com 0.62 de opacidade os
                  pássaros sumiam no lilás do amanhecer e viravam sujeira de
                  tela em vez de bicho. */}
              <Passaro size={p.size ?? 8} cor="rgba(58,46,78,0.85)" />
            </span>
          </span>
        ))}
      </div>
    );
  }

  if (slot === "manhã") {
    return (
      <div aria-hidden className={camada}>
        {SEMENTINHAS.map((e, i) => (
          <span
            key={i}
            className="dc-seed absolute rounded-full"
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              width: `${e.size}px`,
              height: `${e.size}px`,
              animationDelay: `${e.delay}s`,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.6) 32%, rgba(255,255,255,0) 74%)",
              // Semente branca em céu creme é branco no branco: sumia. A
              // sombra segue o alfa (drop-shadow, não box-shadow, que faria
              // um círculo duro) e dá o contorno que separa do fundo claro.
              filter: "drop-shadow(0 0 3px rgba(120,92,132,0.45))",
            }}
          />
        ))}
      </div>
    );
  }

  if (slot === "meio-dia") {
    return (
      <div aria-hidden className={camada}>
        {/* Halo achatado, colado no topo: o sol a pino respirando. A altura
            (13vh) é o que o mantém acima da tinta do bebê. */}
        <span
          className="dc-ray absolute rounded-full"
          style={{
            left: "50%",
            top: "0.5%",
            width: "74vw",
            height: "13vh",
            marginLeft: "-37vw",
            background:
              "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,247,214,0.24) 42%, rgba(255,255,255,0) 72%)",
          }}
        />
        {ESTALOS.map((e, i) => (
          <span
            key={i}
            className="dc-glint absolute"
            style={{ left: `${e.x}%`, top: `${e.y}%`, animationDelay: `${e.delay}s` }}
          />
        ))}
      </div>
    );
  }

  if (slot === "tarde") {
    return (
      <div aria-hidden className={camada}>
        {NUVENS.map((n, i) => (
          <span
            key={i}
            className="dc-cloud absolute rounded-full"
            style={{
              left: `${n.x}%`,
              top: `${n.y}%`,
              width: `${n.size}px`,
              height: `${(n.size ?? 80) * 0.34}px`,
              animationDelay: `${n.delay}s`,
              background: "rgba(255,255,255,0.72)",
              filter: "blur(9px)",
            }}
          />
        ))}
      </div>
    );
  }

  if (slot === "golden hour") {
    return (
      <div aria-hidden className={camada}>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="dc-mote absolute rounded-full"
            style={{
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              animationDelay: `${m.delay}s`,
              background:
                "radial-gradient(circle, rgba(255,252,236,1) 0%, rgba(252,205,104,0.7) 48%, rgba(252,211,120,0) 100%)",
              // Mesmo motivo das sementinhas: dourado sobre nuvem dourada
              // desaparece. O miolo vira quase branco e a sombra âmbar
              // escura destaca o grão contra a luz.
              filter: "drop-shadow(0 0 3px rgba(146,84,26,0.5))",
            }}
          />
        ))}
      </div>
    );
  }

  if (slot === "entardecer") {
    return (
      <div aria-hidden className={camada}>
        {/* O bando inteiro é UM elemento que atravessa; os pássaros são
            posições relativas dentro dele, para a formação em V não se
            desmanchar no meio do caminho. */}
        <span className="dc-flock absolute" style={{ left: "0%", top: "9%" }}>
          {BANDO.map((p, i) => (
            <span key={i} className="absolute" style={{ left: `${p.dx}px`, top: `${p.dy}px` }}>
              <Passaro size={p.size} cor="rgba(52,30,52,0.88)" />
            </span>
          ))}
        </span>
      </div>
    );
  }

  return null;
}
