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
  { x: 86, y: 30, delay: 32 }, // e a seguinte, pela direita, 32s depois
];

/* ── Pré-amanhecer (04–06): as últimas estrelas e a névoa baixa ─────
   A hora tem duas coisas ao mesmo tempo: o céu ainda tem estrela, e o chão
   ainda tem neblina.
   A névoa é uma faixa única na zona C. Medida ao vivo, a versão anterior
   (y 55, 8% de altura) tinha o PICO em cima dos cartões e quase não pisava
   no vão limpo entre o bebê e eles — lia como brilho de tela mal calibrado.
   Agora é mais fina, o pico cai no vão, e só a barra de baixo escorrega
   atrás do cartão: é esse o gesto de neblina assentando. */
const NEVOAS: Particula[] = [{ x: 0, y: 53.5, delay: 0 }];
const ESTRELAS_QUE_APAGAM: Particula[] = [
  { x: 24, y: 3.5, delay: 0, size: 3 },
  { x: 60, y: 4.5, delay: 5, size: 3 },
  { x: 5, y: 40, delay: 9, size: 3 }, // longe da lua da arte, que fica em (5–13, 22)
  { x: 92, y: 22, delay: 14, size: 3 },
];
/* A arte do pré-amanhecer já vem cheia de estrelas pintadas, e ponto parado
   some no meio delas. O que NÃO existe na arte é movimento — por isso a cena
   ganha um satélite: um pontinho atravessando a faixa livre do alto a 6px/s
   — dezesseis vezes mais devagar que o meteoro da madrugada, então ninguém
   confunde os dois. Às 5 da manhã é o que se vê no céu de verdade. */
const SATELITE: Particula = { x: 16, y: 5.5, delay: 6, size: 3 };

/* ── Anoitecer (19–21): as primeiras estrelas, acendendo em sequência ──
   Atrasos crescentes: elas aparecem uma a uma, como no céu de verdade.
   Todas com 3px (as de 2px se perdiam no gradiente do poente) e todas na
   parte ESCURA do céu: nas calhas, a arte das 20h só é escura até y ~24%;
   de 26% pra baixo entram as nuvens de fogo do pôr do sol, e estrela sobre
   faixa alaranjada é astronomicamente errada — lê como pixel morto. As
   primeiras estrelas nascem do lado escuro do céu. */
const PRIMEIRAS_ESTRELAS: Particula[] = [
  { x: 22, y: 2.4, delay: 0, size: 3 },
  { x: 58, y: 4.2, delay: 1.6, size: 3 },
  { x: 8, y: 19, delay: 3.4, size: 3 },
  { x: 92, y: 18, delay: 5.1, size: 3 },
  { x: 5, y: 24, delay: 6.8, size: 3 },
  { x: 94, y: 23, delay: 8.2, size: 3 },
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
   Os três moram na zona A (y 0–6), acima da assinatura. Antes dois deles
   ficavam em y 6.5 e 11.8: um cruzava POR TRÁS das letras de "Clovis"
   durante mais de um terço do ciclo, piscando nos vãos das letras, e o
   outro pairava sobre o "Acompanhando" como um acento solto. Tamanhos
   diferentes (12/9/11) devolvem a profundidade que a faixa estreita tira. */
const PASSAROS: Particula[] = [
  { x: 6, y: 2.4, delay: 0, size: 12 },
  { x: 2, y: 4.0, delay: 15, size: 9 },
  { x: 10, y: 5.4, delay: 30, size: 11 },
];

/* ── Manhã (08–11): sementinhas de dente-de-leão ────────────────────
   Nas calhas, subindo. Amarra com as Sementinhas, a moeda do app.
   A primeira versão era um círculo branco borrado: media 1,2:1 de
   contraste sobre o céu creme e não tinha forma nenhuma — lia como poeira
   no sensor. Agora é um paraquedinha desenhado, com filamentos e haste. */
const SEMENTINHAS: Particula[] = [
  { x: 8, y: 46, delay: 0, size: 9 },
  { x: 91, y: 38, delay: 6, size: 8 },
  { x: 11, y: 53, delay: 12, size: 7 },
  { x: 87, y: 52, delay: 17, size: 9 },
];

/* ── Meio-dia (11–14): o sol a pino ─────────────────────────────────
   Dois registros da mesma ideia: o halo quente entrando pelo topo do quadro
   e os estalos de luz nas calhas, aquele brilho de quatro pontas que só
   aparece com sol forte. */
const ESTALOS: Particula[] = [
  // Atrasos de 6 em 6 num ciclo de 18s: um estalo a cada 6s, espaçados por
  // igual. Com 0/3.2/6.4 os três piscavam nos primeiros 6s e depois vinham
  // 12s de silêncio — a mesma armadilha da "chuva de meteoro".
  { x: 5, y: 26, delay: 0 },
  { x: 90, y: 41, delay: 6 }, // sobre a borda da nuvem pintada da calha direita
  { x: 8, y: 45, delay: 12 },
];

/* ── Tarde (14–16): o aviãozinho lá em cima ─────────────────────
   Um só, cruzando o alto. Ver o porquê no comentário de dcPlaneCross: a
   arte da tarde já é feita de nuvens, e nuvem falsa ao lado de nuvem
   pintada vira borrão. */
const AVIAO: Particula = { x: 0, y: 4, delay: 0, size: 17 };

/* ── Golden hour (16–18): poeira dourada nas laterais ─────────────
   Menores e mais suaves que na primeira versão: com o miolo branco opaco
   e a borda definida eles liam como bolhinhas luminosas, e poeira em
   contraluz é justamente o contrário — desfocada e de baixo contraste. */
const MOTES: Particula[] = [
  { x: 7, y: 44, delay: 0, size: 4 },
  { x: 92, y: 36, delay: 3.5, size: 3 },
  { x: 9, y: 50, delay: 7, size: 5 },
  { x: 88, y: 50, delay: 10.5, size: 3 },
  { x: 5, y: 33, delay: 14, size: 4 },
];

/* ── Entardecer (18–19): o bando voltando, em V ──────────────────
   O bando viaja para a ESQUERDA, então o líder é quem tem dx 0 e as duas
   linhas ficam atrás dele, abrindo para a direita. A primeira versão era
   simétrica nos dois lados com o pássaro central embaixo: um V apontando
   para BAIXO, atravessado à direção do voo. Lia como cinco pingos num
   sorriso, não como formação. */
const BANDO: { dx: number; dy: number; size: number }[] = [
  { dx: 0, dy: 16, size: 12 }, // o líder, na ponta
  { dx: 15, dy: 8, size: 11 },
  { dx: 15, dy: 24, size: 10 },
  { dx: 30, dy: 0, size: 9 },
  { dx: 30, dy: 32, size: 9 },
];

/**
 * A silhueta de um pássaro distante: um "v" aberto, nada mais. Desenho com
 * mais detalhe que isso, no tamanho que cabe aqui, vira mancha.
 *
 * CUIDADO COM O SENTIDO DO Y. Em SVG o y cresce para BAIXO, então o path
 * antigo — que ia de y 9 (pontas) para y 1.5 (meio) — desenhava um "^", de
 * cabeça para baixo: pontas das asas embaixo e corpo em cima. Ao lado do
 * título aquilo lia como acento circunflexo, não como bicho. O certo é o
 * oposto: pontas das asas EM CIMA (y 3) e o corpo no vale (y 9).
 */
function Passaro({ size, cor }: { size: number; cor: string }) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 20 11" fill="none">
      <path
        d="M1 3C4 3 6.5 9 10 9C13.5 9 16 3 19 3"
        stroke={cor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Uma sementinha de dente-de-leão: leque de filamentos, haste e o grão.
 * Era um círculo com gradiente radial — sem forma, sem assimetria, e com o
 * miolo comido pelo próprio gradiente (3px visíveis de 6 declarados). Um
 * ponto de luz redondo no céu não lê como semente, lê como poeira na lente.
 */
function Sementinha({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 12 16"
      fill="none"
      // A sombra deslocada vira CONTORNO; centrada em 0 0 ela só dilui. É o
      // que dá o contraste contra o creme do céu da manhã.
      style={{ filter: "drop-shadow(0 1px 1.5px rgba(110,74,116,0.8))" }}
    >
      <g stroke="rgba(255,255,255,0.97)" strokeWidth="1.1" strokeLinecap="round">
        <path d="M6 6.5 1.6 1.4M6 6.5 4 0.8M6 6.5 6.4 0.6M6 6.5 8.6 1M6 6.5 10.6 1.8" />
        <path d="M6 6.5V13" strokeWidth="0.9" />
      </g>
      <circle cx="6" cy="14" r="1.35" fill="rgba(255,255,255,0.97)" />
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
              height: "5%",
              animationDelay: `${n.delay}s`,
              background:
                "linear-gradient(180deg, transparent, rgba(214,222,244,0.42) 50%, transparent)",
              filter: "blur(7px)",
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
              // Halo forte: a arte das 21–24h não é noite fechada, é um
              // crepúsculo lavanda com nuvens acesas. O lampejo precisa
              // vencer um fundo claro nas calhas.
              boxShadow: "0 0 14px 5px rgba(253,224,120,0.75)",
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
            className="dc-seed absolute"
            style={{ left: `${e.x}%`, top: `${e.y}%`, animationDelay: `${e.delay}s` }}
          >
            <Sementinha size={e.size ?? 8} />
          </span>
        ))}
      </div>
    );
  }

  if (slot === "meio-dia") {
    return (
      <div aria-hidden className={camada}>
        {/* O sol a pino respirando: metade do halo fica FORA do quadro, o que
            faz a luz parecer entrar pelo topo. Antes ele tinha 74vw e
            começava em y 0.5%, ou seja, era uma elipse larga centrada
            exatamente sobre "Acompanhando / Clovis" — lia como scrim de
            texto, não como sol, e ainda por cima com o miolo tão fraco
            (0.16 de opacidade) que na prática não se via nada. Menor,
            mais alto e mais forte. */}
        <span
          className="dc-ray absolute rounded-full"
          style={{
            left: "50%",
            top: "-3%",
            width: "56vw",
            height: "9vh",
            marginLeft: "-28vw",
            background:
              "radial-gradient(ellipse at center, rgba(255,255,255,0.72) 0%, rgba(255,247,214,0.26) 42%, rgba(255,255,255,0) 72%)",
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
        <span className="dc-aviao absolute" style={{ left: `${AVIAO.x}%`, top: `${AVIAO.y}%` }}>
          <svg
            width={AVIAO.size}
            height={(AVIAO.size ?? 13) * 0.62}
            viewBox="0 0 26 16"
            fill="none"
          >
            {/* O rastro sai da cauda e se desfaz — é ele que dá a escala de
                "10 km de altura". Sem o rastro o avião vira um risco. */}
            <path
              d="M6 8H0"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M23.4 8 15 9.6h-3.1l-3.4 4H7l1.9-4H6.4l-1.3 1.5H3.9l1-2.5-1-2.5h1.2l1.3 1.5h2.5L7 2.4h1.5l3.4 4H15L23.4 8Z"
              fill="rgba(72,86,116,0.72)"
            />
          </svg>
        </span>
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
                "radial-gradient(circle, rgba(255,246,220,0.85) 0%, rgba(250,196,92,0.55) 48%, rgba(252,211,120,0) 100%)",
              // Poeira em contraluz é DESFOCADA e de baixo contraste. Com o
              // miolo branco opaco e a borda definida, o grão lia como
              // bolhinha luminosa. O blur de meio pixel tira a borda; a
              // sombra âmbar é o que ainda o separa da nuvem dourada.
              filter: "blur(0.5px) drop-shadow(0 0 3px rgba(146,84,26,0.5))",
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
        {/* y 5% e não 9%: com 9 o bando voava dentro da faixa da assinatura
            (6–17%) e o primeiro terço da travessia acontecia POR TRÁS de
            "Acompanhando / Clovis". Em 5% ele passa atrás do botão de menu e
            do chip de clima, que são opacos — oclusão limpa, sem piscar nos
            vãos das letras. */}
        {/* O invólucro tem tamanho EXPLÍCITO. Sem isso ele media 0×0 (todos os
            filhos são `absolute`), e a régua de `sky:check` aprovava o
            entardecer sem medir NADA: um ponto sem área nunca sobrepõe o bebê
            nem some atrás de um cartão. Por isso os `dy` são todos positivos —
            assim o topo do bando é o topo da caixa.
            Com a caixa medindo de verdade apareceu o defeito que ela escondia:
            a 5% de altura a ave de baixo encostava no "Acompanhando". Daí 2.2%. */}
        <span
          className="dc-flock absolute"
          style={{ left: "0%", top: "2.2%", width: "42px", height: "38px" }}
        >
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
