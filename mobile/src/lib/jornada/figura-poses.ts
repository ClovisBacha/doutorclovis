/**
 * AS POSES: um desenho por exercício, montado com o kit de
 * `figura-desenho.ts`, na posição que os passos do exercício descrevem.
 *
 * `JUNTAS` guarda as juntas em volta das quais algum pedaço gira: a tabela de
 * animação (`USOS`, em `figura.ts`) lê as origens daqui, e assim mudar uma
 * junta no desenho muda o giro junto.
 */

import type { PoseKey } from "@/lib/exercicios";
import {
  almofada,
  barrigaNoLugar,
  braco,
  cabecaDeFrente,
  cabecaDePerfil,
  canela,
  caixaRedonda,
  cinturaDeFrente,
  costasCurvas,
  coxa,
  elipse,
  cilindro,
  esfera,
  GROSSO,
  luzDeEsfera,
  luzDaParede,
  MEDIDA,
  noDesenho,
  pernaDeMovel,
  tampo,
  perna,
  pescocoDeFrente,
  pescocoDePerfil,
  quadrilNoLugar,
  sombraNoChao,
  tapete,
  tenisDeFrente,
  tenisDePerfil,
  troncoDeFrente,
  troncoDePerfil,
  TRONCO,
  type Camada,
  type Desenho,
  type Forma,
  type Lugar,
  type P,
} from "./figura-desenho";

const espelharX = (p: P, eixo = 60): P => [2 * eixo - p[0], p[1]];
const mais = (p: P, dx: number, dy: number): P => [p[0] + dx, p[1] + dy];

/** O lado de longe aparece um pouco deslocado, e mais escuro. */
const LONGE = 4.4;

/* ── Em pé, de frente ────────────────────────────────────────────────────── */

const PE = {
  chao: 145,
  /** O alto do tronco (os ombros): a cabeça fica `CABECA` acima. */
  tronco: 41.5,
  quadrilE: [53.6, 89.5] as P,
  joelhoE: [52.4, 114.5] as P,
  tornozeloE: [51.8, 138.6] as P,
  ombroE: [47, 46.2] as P,
} as const;

/** De frente, o centro da cabeça fica 15,3 acima dos ombros (era 17,5, e o
    pescoço comprido pesava o desenho). */
const CABECA = 15.3;

function pernasDeFrente(): Forma[] {
  return [
    ...perna(PE.quadrilE, PE.joelhoE, PE.tornozeloE),
    ...perna(espelharX(PE.quadrilE), espelharX(PE.joelhoE), espelharX(PE.tornozeloE)),
    ...tenisDeFrente(PE.tornozeloE[0] - 0.4, PE.chao),
    ...tenisDeFrente(120 - PE.tornozeloE[0] + 0.4, PE.chao),
  ];
}

/* Os braços soltos, encostados de leve no corpo. */
const BRACO_BAIXO_E = [PE.ombroE, [41, 65.4], [40, 84.2], [39.8, 89.4]] as const;
const BRACOS_BAIXOS: Forma[] = [
  ...braco(...BRACO_BAIXO_E),
  ...braco(
    espelharX(BRACO_BAIXO_E[0]),
    espelharX(BRACO_BAIXO_E[1]),
    espelharX(BRACO_BAIXO_E[2]),
    espelharX(BRACO_BAIXO_E[3]),
  ),
];

const BRACOS_ALTOS: Forma[] = [
  ...braco(PE.ombroE, [43.4, 25.5], [55.4, 11.2], [58.2, 8]),
  ...braco(espelharX(PE.ombroE), [76.6, 25.5], [64.6, 11.2], [61.8, 8]),
  /* As mãos entrelaçadas, palmas para o alto. */
  {
    d: caixaRedonda(54.4, 3.6, 11.2, 5.8, 2.9),
    cor: "pele",
    gradiente: luzDeEsfera([60, 6.5], 5.8, "pele", 0.7),
  },
];

/* Os dedos entrelaçados à frente do peito, os cotovelos abertos: o começo de
   "alongar os braços pro alto" (passo 1). Antes, os braços soltos ao lado. */
const BRACO_NO_PEITO_E = [PE.ombroE, [37.6, 61.6], [52.2, 62.8], [56.6, 61.6]] as const;
const BRACOS_NO_PEITO: Forma[] = [
  ...braco(...BRACO_NO_PEITO_E),
  ...braco(
    espelharX(BRACO_NO_PEITO_E[0]),
    espelharX(BRACO_NO_PEITO_E[1]),
    espelharX(BRACO_NO_PEITO_E[2]),
    espelharX(BRACO_NO_PEITO_E[3]),
  ),
  {
    d: caixaRedonda(54.8, 58.4, 10.4, 5.8, 2.9),
    cor: "pele",
    gradiente: luzDeEsfera([60, 61.3], 5.6, "pele", 0.7),
  },
];

function emPeDeFrente(alonga: boolean): Desenho {
  const t = PE.tronco;
  return {
    caixa: [0, 0, 120, 150],
    camadas: [
      { formas: [sombraNoChao(60, PE.chao, 24)] },
      { formas: [...pernasDeFrente(), cinturaDeFrente(60, t + 42.6)] },
      {
        formas: [
          ...pescocoDeFrente(60, t - CABECA + 7, t + 3),
          ...troncoDeFrente(60, t),
          ...cabecaDeFrente(60, t - CABECA),
        ],
      },
      {
        parte: "ombros",
        dentro: [
          { parte: "bracosBaixos", formas: alonga ? BRACOS_NO_PEITO : BRACOS_BAIXOS },
          ...(alonga ? [{ parte: "bracosAltos" as const, formas: BRACOS_ALTOS }] : []),
        ],
      },
    ],
  };
}

/* ── Em pé de perfil, de costas na parede (a báscula da bacia) ──────────────── */

const PELVE = {
  chao: 144,
  parede: 34,
  tronco: { x: 44.6, y: 39, giro: 0 } as Lugar,
} as const;

function pelveNaParede(): Desenho {
  const l = PELVE.tronco;
  const quadril = noDesenho(l, TRONCO.quadril);
  const ombro = noDesenho(l, TRONCO.ombro);
  const joelho: P = [quadril[0] + 3.2, quadril[1] + 24.8];
  const tornozelo: P = [quadril[0] + 1.6, PELVE.chao - 6.4];
  const cabeca: P = [l.x + 1.8, l.y - MEDIDA.cabecaDePerfil];
  return {
    caixa: [6, 0, 100, 150],
    camadas: [
      {
        formas: [
          {
            d: caixaRedonda(-80, -80, PELVE.parede + 80, PELVE.chao + 80, 2),
            cor: "apoio",
            gradiente: luzDaParede(PELVE.parede, -1),
          },
          {
            d: `M${PELVE.parede} -80L${PELVE.parede} ${PELVE.chao}`,
            traco: "apoioSombra",
            espessura: 1.6,
          },
          sombraNoChao(52, PELVE.chao, 18),
        ],
      },
      {
        formas: [
          ...braco(
            mais(ombro, -2.6, 0.6),
            [ombro[0] - 2.4, 67],
            [ombro[0] - 0.4, 86],
            [ombro[0] + 0.6, 91],
            true,
          ),
          ...perna(mais(quadril, 2, 0), mais(joelho, 3.6, 0), mais(tornozelo, 3.6, 0), true),
          tenisDePerfil(mais(tornozelo, 3.6, 0), 0, false, true),
        ],
      },
      {
        formas: [...perna(quadril, joelho, tornozelo), tenisDePerfil(tornozelo)],
      },
      { parte: "bacia", formas: [quadrilNoLugar(l)] },
      {
        formas: [
          troncoDePerfil(l, false),
          barrigaNoLugar(l),
          pescocoDePerfil([l.x, l.y], [cabeca[0] + 0.4, cabeca[1] + 4]),
          cabecaDePerfil({ x: cabeca[0], y: cabeca[1], giro: 0 }),
          ...braco(ombro, [ombro[0] + 0.6, 67], [ombro[0] + 3, 85.8], [ombro[0] + 4.2, 90.6]),
        ],
      },
    ],
  };
}

/* ── Sentada numa cadeira, de frente ─────────────────────────────────────── */

/** Da cintura para cima, tudo desce 22 em relação a "em pé". */
const SENTADA = {
  desce: 22,
  chao: 151,
  assento: 118,
  quadrilE: [53.6, 111.5] as P,
  joelhoE: [49.6, 122] as P,
  tornozeloE: [49.6, 144.6] as P,
} as const;

/** A cadeira de frente, com o encosto atrás dela (os passos falam em "costas
    apoiadas", "mão no encosto", "cadeira firme"; era um banquinho). */
function cadeiraDeFrente(): Forma[] {
  const a = SENTADA.assento;
  return [
    pernaDeMovel([37.8, a], 1.6, [37.2, 74], 1.5),
    pernaDeMovel([82.2, a], 1.6, [82.8, 74], 1.5),
    tampo(33.4, 69.6, 53.2, 6.6, 3.3),
    pernaDeMovel([38.6, a + 4], 1.9, [37.4, SENTADA.chao - 1], 1.7),
    pernaDeMovel([81.4, a + 4], 1.9, [82.6, SENTADA.chao - 1], 1.7),
    tampo(32, a - 2, 56, 8, 3.6),
  ];
}

function pernasSentadaDeFrente(cruzada: boolean): Forma[] {
  const c = SENTADA.chao;
  const fora: Forma[] = [];
  /* A canela de cada lado desce do joelho; a coxa vem na nossa direção e
     aparece curta, por cima da barra da blusa. */
  fora.push(canela(SENTADA.joelhoE, SENTADA.tornozeloE), ...tenisDeFrente(49.4, c));
  if (!cruzada)
    fora.push(
      canela(espelharX(SENTADA.joelhoE), espelharX(SENTADA.tornozeloE)),
      ...tenisDeFrente(70.6, c),
    );
  fora.push(coxa(SENTADA.quadrilE, SENTADA.joelhoE));
  if (cruzada) {
    /* O tornozelo direito sobre o joelho esquerdo: a coxa abre para o lado e
       a canela atravessa deitada. */
    const joelhoD: P = [82, 118.6];
    fora.push(
      coxa(espelharX(SENTADA.quadrilE), joelhoD),
      canela(joelhoD, [53.4, 115.8]),
      tenisDePerfil([52.6, 113.6], 4, true),
    );
  } else {
    fora.push(coxa(espelharX(SENTADA.quadrilE), espelharX(SENTADA.joelhoE)));
  }
  return fora;
}

function sentadaDeFrente(
  opcoes: {
    cruzada?: boolean;
    /** As mãos: nos joelhos (o padrão); na torção, a direita no encosto e a
        esquerda na coxa direita; na respiração, uma na barriga e uma nas costelas. */
    maos?: "joelhos" | "torcao" | "respira";
  } = {},
): Desenho {
  const d = SENTADA.desce;
  const t = PE.tronco + d;
  const ombroE: P = mais(PE.ombroE, 0, d);
  const ombroD = espelharX(ombroE);
  const maos = opcoes.maos ?? "joelhos";
  const bracos: Forma[] =
    maos === "torcao"
      ? [
          /* A mão direita dela (à esquerda na tela) para trás, no encosto. */
          ...braco(ombroE, [36.6, 84.4], [36.2, 98.4], [36.8, 102.8]),
          /* A esquerda cruza na frente da barriga até a coxa direita. */
          ...braco(ombroD, [77.2, 88.6], [57.6, 104.6], [52.8, 107.6]),
        ]
      : maos === "respira"
        ? [
            /* Uma mão nas costelas, de lado, e a outra na barriga. */
            ...braco(ombroE, [36.4, 85.6], [43.6, 82.6], [48.4, 81]),
            ...braco(ombroD, [81.4, 87.4], [70.6, 95.2], [65.8, 95.6]),
          ]
        : opcoes.cruzada
          ? [
              ...braco(ombroE, [40.2, 86.4], [45.6, 104], [49.6, 108]),
              ...braco(ombroD, [80.4, 86.6], [78.4, 105], [74.4, 109.6]),
            ]
          : [
              ...braco(ombroE, [40, 87], [45.2, 104.6], [48.6, 108.4]),
              ...braco(ombroD, [80, 87], [74.8, 104.6], [71.4, 108.4]),
            ];
  return {
    caixa: [0, 26, 120, 128],
    camadas: [
      { formas: [sombraNoChao(60, SENTADA.chao, 30), ...cadeiraDeFrente()] },
      {
        parte: "tronco",
        formas: [cinturaDeFrente(60, t + 42.6), ...troncoDeFrente(60, t)],
      },
      { formas: pernasSentadaDeFrente(!!opcoes.cruzada) },
      {
        parte: "tronco",
        formas: bracos,
        dentro: [
          {
            parte: "cabeca",
            formas: [
              ...pescocoDeFrente(60, t - CABECA + 7, t - 1.6),
              ...cabecaDeFrente(60, t - CABECA),
            ],
          },
        ],
      },
    ],
  };
}

/* ── Sentada na bola, de frente ───────────────────────────────────────────── */

function sentadaNaBola(): Desenho {
  const d = SENTADA.desce;
  const t = PE.tronco + d;
  const ombroE: P = mais(PE.ombroE, 0, d);
  const joelhoE: P = [33, 121.6];
  const tornozeloE: P = [29.6, 144.6];
  return {
    caixa: [0, 26, 120, 128],
    camadas: [
      { formas: [sombraNoChao(60, SENTADA.chao, 34)] },
      {
        formas: [
          canela(joelhoE, tornozeloE),
          canela(espelharX(joelhoE), espelharX(tornozeloE)),
          ...tenisDeFrente(29.2, SENTADA.chao),
          ...tenisDeFrente(90.8, SENTADA.chao),
        ],
      },
      {
        parte: "corpo",
        formas: [
          /* A bola: uma esfera de verdade, com o brilho do estúdio. */
          esfera(60, 129.6, 21.2, "apoio", 1.5),
          { d: elipse(51.4, 119.2, 6.4, 4), cor: "tenis", opacidade: 0.55 },
          cinturaDeFrente(60, t + 42.6),
          ...troncoDeFrente(60, t),
        ],
      },
      {
        formas: [
          coxa(SENTADA.quadrilE, joelhoE),
          coxa(espelharX(SENTADA.quadrilE), espelharX(joelhoE)),
        ],
      },
      {
        parte: "corpo",
        formas: [
          ...braco(ombroE, [39.4, 87], [39.6, 106], [39.4, 111]),
          ...braco(espelharX(ombroE), [80.6, 87], [80.4, 106], [80.6, 111]),
          ...pescocoDeFrente(60, t - CABECA + 7, t - 1.6),
          ...cabecaDeFrente(60, t - CABECA),
        ],
      },
    ],
  };
}

/* ── Sentada numa cadeira, de perfil ─────────────────────────────────────── */

const PERFIL_SENTADA = {
  chao: 143.6,
  tronco: { x: 44, y: 62, giro: 0 } as Lugar,
  joelho: [70, 112.4] as P,
  /** A perna esticada, com o calcanhar no banquinho. */
  tornozeloEsticado: [91.6, 123.6] as P,
} as const;

function cadeiraDePerfil(): Forma[] {
  const c = PERFIL_SENTADA.chao;
  return [
    pernaDeMovel([33, 120], 1.9, [32, c - 1], 1.7),
    pernaDeMovel([62, 120], 1.9, [63.4, c - 1], 1.7),
    pernaDeMovel([30.6, 76], 2.6, [32.4, 117], 2.6),
    tampo(28, 116, 38, 6.4, 3.2),
  ];
}

function sentadaDePerfil(o: { esticada: boolean; bracosAFrente: boolean }): Desenho {
  const l = PERFIL_SENTADA.tronco;
  const ombro = noDesenho(l, TRONCO.ombro);
  const quadril = noDesenho(l, TRONCO.quadril);
  const cabeca: P = [l.x + 1.8, l.y - MEDIDA.cabecaDePerfil];
  const j = PERFIL_SENTADA.joelho;
  const c = PERFIL_SENTADA.chao;
  const tornozeloDobrado: P = [j[0] - 1, c - 6.4];
  const bracoPerto = o.bracosAFrente
    ? braco(
        ombro,
        [ombro[0] + 20.8, ombro[1] + 1.4],
        [ombro[0] + 39.6, ombro[1] + 2.4],
        [ombro[0] + 39.6, ombro[1] + 2.4],
      )
    : braco(
        ombro,
        [ombro[0] + 3, ombro[1] + 20.6],
        [ombro[0] + 16, ombro[1] + 34.2],
        [ombro[0] + 20.6, ombro[1] + 36.4],
      );
  const bracoLonge = o.bracosAFrente
    ? braco(
        mais(ombro, -2, -0.6),
        [ombro[0] + 18.8, ombro[1] - 1.6],
        [ombro[0] + 37.6, ombro[1] - 1.8],
        [ombro[0] + 37.6, ombro[1] - 1.8],
        true,
      )
    : braco(
        mais(ombro, -2.4, 0),
        [ombro[0] - 0.6, ombro[1] + 20.6],
        [ombro[0] + 11.4, ombro[1] + 35],
        [ombro[0] + 15.4, ombro[1] + 37.6],
        true,
      );
  const punho: P = [ombro[0] + 39.6, ombro[1] + 2.4];
  const punhoLonge: P = [ombro[0] + 37.6, ombro[1] - 1.8];
  const maos = (p: P, longe: boolean, aberta: boolean): Forma[] => {
    const cor = longe ? ("peleSombra" as const) : ("pele" as const);
    return aberta
      ? [
          cilindro(p, 2.3, [p[0] + 7.2, p[1] - 0.2], 1.8, cor, 0.7),
          cilindro(mais(p, 1.4, -1.4), 1.0, [p[0] + 5.4, p[1] - 5], 0.9, cor, 0.7),
        ]
      : [esfera(p[0] + 2.6, p[1] + 0.2, 3.0, cor, 0.7)];
  };
  const camadas: Camada[] = [
    { formas: [sombraNoChao(60, c, 32), ...cadeiraDePerfil()] },
    ...(o.esticada
      ? [
          {
            formas: [
              tampo(83, 128.4, 20, 5.4, 2.6),
              pernaDeMovel([86, 133], 1.6, [85.4, c - 1], 1.5),
              pernaDeMovel([100, 133], 1.6, [100.6, c - 1], 1.5),
            ],
          },
        ]
      : []),
    {
      formas: [
        ...bracoLonge,
        ...(o.bracosAFrente ? [] : []),
        ...perna(mais(quadril, 2, 0), mais(j, -2, 0.6), mais(tornozeloDobrado, -2.2, 0), true),
        tenisDePerfil(mais(tornozeloDobrado, -2.2, 0), 0, false, true),
      ],
    },
    ...(o.bracosAFrente
      ? [
          { parte: "maoAbertaLonge" as const, formas: maos(punhoLonge, true, true) },
          { parte: "punhoLonge" as const, formas: maos(punhoLonge, true, false) },
        ]
      : []),
    {
      formas: [
        troncoDePerfil(l),
        barrigaNoLugar(l),
        pescocoDePerfil([l.x, l.y], [cabeca[0] + 0.4, cabeca[1] + 4]),
        cabecaDePerfil({ x: cabeca[0], y: cabeca[1], giro: 0 }),
      ],
    },
    {
      formas: o.esticada
        ? [coxa(quadril, j), canela(j, PERFIL_SENTADA.tornozeloEsticado)]
        : [coxa(quadril, j), canela(j, tornozeloDobrado), tenisDePerfil(tornozeloDobrado)],
    },
    ...(o.esticada
      ? [{ parte: "pe" as const, formas: [tenisDePerfil(PERFIL_SENTADA.tornozeloEsticado, -64)] }]
      : []),
    { formas: bracoPerto },
    ...(o.bracosAFrente
      ? [
          { parte: "maoAberta" as const, formas: maos(punho, false, true) },
          { parte: "punho" as const, formas: maos(punho, false, false) },
        ]
      : []),
  ];
  return { caixa: [18, 22, 100, 128], camadas };
}

/* ── No chão, pés juntos (a borboleta), de frente ──────────────────────────── */

const BORBOLETA = {
  tapete: 141,
  quadrilE: [53.6, 133] as P,
  joelhoE: [31, 127.4] as P,
  tornozeloE: [54.2, 137.6] as P,
} as const;

function borboleta(): Desenho {
  const t = 85.4;
  const q = BORBOLETA.quadrilE;
  const j = BORBOLETA.joelhoE;
  const tz = BORBOLETA.tornozeloE;
  const ombroE: P = [PE.ombroE[0], t + 4.5];
  return {
    caixa: [6, 44, 108, 108],
    camadas: [
      { formas: tapete(-40, 160, BORBOLETA.tapete) },
      { formas: [cinturaDeFrente(60, t + 42.6), ...troncoDeFrente(60, t)] },
      { parte: "coxaE", formas: [coxa(q, j)] },
      { parte: "coxaD", formas: [coxa(espelharX(q), espelharX(j))] },
      { parte: "canelaE", formas: [canela(j, tz)] },
      { parte: "canelaD", formas: [canela(espelharX(j), espelharX(tz))] },
      {
        formas: [
          /* As solas juntas: os dois pés de lado, um de frente para o outro. */
          tenisDePerfil([53.4, 137.8], -90, false),
          tenisDePerfil([66.6, 137.8], 90, true),
          ...braco(ombroE, [40.4, 109.2], [50.4, 124.6], [53.4, 129]),
          ...braco(espelharX(ombroE), [79.6, 109.2], [69.6, 124.6], [66.6, 129]),
          ...pescocoDeFrente(60, t - CABECA + 7, t + 3),
          ...cabecaDeFrente(60, t - CABECA),
        ],
      },
    ],
  };
}

/* ── De quatro apoios, de perfil ─────────────────────────────────────────── */

const QUATRO = {
  tapete: 102,
  /** O tronco: a base do pescoço, inclinado 15° (o ombro mais alto). */
  tronco: { x: 116.6, y: 57.3, giro: 75 } as Lugar,
  punho: [111, 99.6] as P,
  joelho: [70.4, 97.3] as P,
  /** A canela deitada no tapete, e o peito do pé apoiado nele. */
  tornozelo: [46.4, 98.6] as P,
} as const;

function deQuatro(gato: boolean): Desenho {
  const l = QUATRO.tronco;
  const ombro = noDesenho(l, TRONCO.ombro);
  const quadril = noDesenho(l, TRONCO.quadril);
  const cabeca: P = [128.2, 57.6];
  const punho = QUATRO.punho;
  const joelho = QUATRO.joelho;
  const tz = QUATRO.tornozelo;
  return {
    caixa: [8, 24, 148, 86],
    camadas: [
      { formas: tapete(-40, 200, QUATRO.tapete) },
      /* O lado de longe, mais escuro, atrás do corpo. */
      {
        parte: "bracoLonge",
        formas: braco(
          mais(ombro, -LONGE, 0.4),
          [ombro[0] - LONGE + 0.4, 80.4],
          mais(punho, -LONGE, 0),
          [punho[0] - LONGE + 6, 100.2],
          true,
        ),
      },
      {
        formas: [
          canela(mais(joelho, -LONGE, 0), mais(tz, -LONGE, 0), true),
          tenisDePerfil(mais(tz, -LONGE, 0), 172, false, true),
        ],
      },
      {
        parte: "coxaLonge",
        formas: [coxa(mais(quadril, -LONGE, 0), mais(joelho, -LONGE, 0), true)],
      },
      {
        parte: "corpo",
        formas: [troncoDePerfil(l)],
        dentro: [
          ...(gato
            ? [
                /* As costas que arredondam: a própria blusa abaulando. */
                { parte: "corcunda" as const, formas: [costasCurvas(l)] },
              ]
            : []),
          { parte: "barriga", formas: [barrigaNoLugar(l)] },
          {
            parte: "cabeca",
            formas: [
              pescocoDePerfil([l.x, l.y], [cabeca[0] - 4, cabeca[1] - 0.4]),
              cabecaDePerfil({ x: cabeca[0], y: cabeca[1], giro: 24 }),
            ],
          },
        ],
      },
      { formas: [canela(joelho, tz), tenisDePerfil(tz, 172)] },
      { parte: "coxa", formas: [coxa(quadril, joelho)] },
      {
        parte: "braco",
        formas: braco(ombro, [ombro[0] + 0.4, 80.4], punho, [punho[0] + 6, 100.2]),
      },
    ],
  };
}

/* ── Deitada do lado esquerdo, vista de frente ─────────────────────────────── */

/**
 * Como nos desenhos de "durma de lado": a câmera na frente dela, deitada do
 * lado esquerdo no tapete, a cabeça no travesseiro, a barriga apoiada, os
 * joelhos dobrados para a frente. É a figura de frente (a mesma de "sentada",
 * com as coxas vindo na nossa direção) deitada: o desenho é feito em pé e
 * TRANSPOSTO — o x dele vira o y da tela e o y vira o x —, então o lado
 * direito dela fica em cima e o esquerdo encosta no tapete.
 */
const deitar = (formas: readonly Forma[]): Forma => ({
  grupo: formas,
  transform: "rotate(-90) scale(-1 1)",
});
/** Um ponto do desenho em pé levado para a tela (a transposição). */
const naTela = (p: P): P => [p[1], p[0]];

const DEITADA = {
  tapete: 80,
  tronco: 41.5,
  /* As pernas vão direto na tela (sem transpor): o quadril de cima e o de baixo. */
  quadrilCima: [88.6, 54] as P,
  quadrilBaixo: [88.6, 66.4] as P,
  joelhoCima: [112.6, 52.6] as P,
  joelhoBaixo: [113.2, 70.4] as P,
} as const;

function deitadaDeLado(o: {
  travesseiro: boolean;
  maoNaBarriga: boolean;
  pernasAltas?: boolean;
  /** O joelho de cima vem para o peito, por fora da barriga, com a mão nele. */
  joelhoAoPeito?: boolean;
}): Desenho {
  const t = DEITADA.tronco;
  const alta = !!o.pernasAltas;
  const qC = DEITADA.quadrilCima;
  const qB = DEITADA.quadrilBaixo;
  const juntos = !o.travesseiro && !alta;
  /* Com o travesseiro entre os joelhos, a perna de cima fica afastada da de
     baixo; sem ele, apoiada nela. Com as pernas para o alto, as duas sobem: a
     de baixo com a canela e o tênis APOIADOS na almofada de cima, e a de cima
     deitada sobre ela (21/11/2026: as duas flutuavam acima das almofadas). */
  const jB: P = alta ? [109.6, 46.8] : DEITADA.joelhoBaixo;
  const tB: P = alta ? [134, 42.8] : [136, 73.4];
  const jC: P = alta ? [109.4, 40] : juntos ? [112.8, 61] : DEITADA.joelhoCima;
  const tC: P = alta ? [133.6, 36.2] : juntos ? [135.4, 63.6] : [134.6, 60.4];
  const pernaDeCima: Forma[] = [...perna(qC, jC, tC), tenisDePerfil(tC, alta ? -9 : 4)];
  const pernaDeBaixo: Forma[] = [
    ...perna(qB, jB, tB, true),
    tenisDePerfil(tB, alta ? -9 : 4, false, true),
  ];
  const ombroC: P = PE.ombroE;
  const ombroB: P = espelharX(PE.ombroE);
  const cabeca = naTela([60, t - CABECA]);
  return {
    caixa: [0, 18, 160, 76],
    camadas: [
      {
        formas: [
          ...tapete(-40, 200, DEITADA.tapete),
          /* O braço de baixo, esticado sob o travesseiro, e a mão escondida
             nele (ela saía do outro lado, um palito no tapete). */
          deitar(braco(ombroB, [76.4, 28], [76.6, 12.4], [76.4, 8.6], true)),
          ...almofada(cabeca[0] - 1, DEITADA.tapete - 7, 21, 7.4),
          ...(alta
            ? [
                ...almofada(128, DEITADA.tapete - 8.6, 26, 8.4),
                ...almofada(130, DEITADA.tapete - 23.4, 21, 7.6),
              ]
            : []),
        ],
      },
      { formas: pernaDeBaixo },
      ...(o.travesseiro && !alta
        ? [
            {
              parte: "travesseiro" as const,
              formas: almofada(DEITADA.joelhoCima[0] + 1, 61.4, 8.6, 4.4),
            },
          ]
        : []),
      {
        parte: "barriga",
        formas: [deitar([cinturaDeFrente(60, t + 42.6), ...troncoDeFrente(60, t)])],
      },
      {
        formas: [
          deitar([
            ...pescocoDeFrente(60, t - CABECA + 7, t + 3),
            ...cabecaDeFrente(60, t - CABECA),
          ]),
        ],
      },
      ...(o.joelhoAoPeito
        ? [
            {
              parte: "pernaDeCima" as const,
              formas: [
                ...pernaDeCima,
                deitar(braco(ombroC, [40.4, 65], [42.4, 83.8], [43.6, 88.6])),
              ],
            },
            {
              /* O joelho no peito, por cima da barriga, e a mão segurando a
                 perna logo abaixo dele. */
              parte: "joelhoNoPeito" as const,
              formas: [
                coxa(qC, JOELHO_NO_PEITO.joelho),
                canela(JOELHO_NO_PEITO.joelho, JOELHO_NO_PEITO.tornozelo),
                tenisDePerfil(JOELHO_NO_PEITO.tornozelo, 14),
                ...braco(naTela(ombroC), [57.6, 31.4], [71, 34.6], [75.6, 36.2]),
              ],
            },
          ]
        : [
            { parte: "pernaDeCima" as const, formas: pernaDeCima },
            {
              formas: [
                deitar(
                  o.maoNaBarriga && !alta
                    ? braco(ombroC, [40.8, 65.4], [49.2, 81.6], [53.2, 84.8])
                    : braco(ombroC, [40.4, 65], [42.4, 83.8], [43.6, 88.6]),
                ),
              ],
            },
          ]),
    ],
  };
}

/** Na tela: o joelho de cima trazido ao peito, por cima da barriga. */
const JOELHO_NO_PEITO = { joelho: [74, 33] as P, tornozelo: [96.4, 40.6] as P } as const;

/* ── Na parede, de perfil ────────────────────────────────────────────────── */

const PANTURRILHA = {
  chao: 144,
  parede: 110,
  quadril: [63, 96] as P,
  giro: 12,
} as const;

function paredeAFrente(x: number, chao: number): Forma[] {
  return [
    { d: caixaRedonda(x, -80, 80, chao + 80, 2), cor: "apoio", gradiente: luzDaParede(x, 1) },
    { d: `M${x} -80L${x} ${chao}`, traco: "apoioSombra", espessura: 1.6 },
  ];
}

/** Lugar do tronco dado o quadril e a inclinação (positiva: para a frente). */
function troncoPeloQuadril(quadril: P, giro: number): Lugar {
  const r = (giro * Math.PI) / 180;
  const [qx, qy] = TRONCO.quadril;
  return {
    x: quadril[0] - (qx * Math.cos(r) - qy * Math.sin(r)),
    y: quadril[1] - (qx * Math.sin(r) + qy * Math.cos(r)),
    giro,
  };
}

/** A cabeça no prolongamento do tronco inclinado. */
function cabecaNoTronco(l: Lugar, dist: number = MEDIDA.cabecaDePerfil): P {
  const r = (l.giro * Math.PI) / 180;
  return [l.x + dist * Math.sin(r) + 1.8, l.y - dist * Math.cos(r)];
}

function panturrilhaNaParede(): Desenho {
  const c = PANTURRILHA.chao;
  const q = PANTURRILHA.quadril;
  const l = troncoPeloQuadril(q, PANTURRILHA.giro);
  const ombro = noDesenho(l, TRONCO.ombro);
  const cabeca = cabecaNoTronco(l);
  /* A perna da frente dobrada, a de trás esticada com o calcanhar no chão. */
  const joelhoFrente: P = [q[0] + 12.6, q[1] + 20.4];
  const tornozeloFrente: P = [q[0] + 8.2, c - 6.4];
  const tornozeloTras: P = [q[0] - 26.6, c - 6.4];
  const joelhoTras: P = [(q[0] + tornozeloTras[0]) / 2, (q[1] + tornozeloTras[1]) / 2];
  /* Os braços quase esticados, as mãos espalmadas na parede na altura do ombro. */
  const maoNaParede = (sh: P, longe: boolean) =>
    braco(
      sh,
      [sh[0] + 20, sh[1] + 5],
      [PANTURRILHA.parede - 3, sh[1] - 4.6],
      [PANTURRILHA.parede - 2.6, sh[1] - 10],
      longe,
    );
  return {
    caixa: [14, 4, 108, 146],
    camadas: [
      { formas: [...paredeAFrente(PANTURRILHA.parede, c), sombraNoChao(58, c, 30)] },
      {
        formas: [
          ...perna(mais(q, -1, 0), mais(joelhoTras, -1, 0), mais(tornozeloTras, -1, 0), true),
          tenisDePerfil(mais(tornozeloTras, -1, 0), 0, false, true),
        ],
      },
      { parte: "corpo", formas: maoNaParede(mais(ombro, -2.4, -0.6), true) },
      {
        formas: [...perna(q, joelhoFrente, tornozeloFrente), tenisDePerfil(tornozeloFrente)],
      },
      {
        parte: "corpo",
        formas: [
          troncoDePerfil(l),
          barrigaNoLugar(l),
          pescocoDePerfil([l.x, l.y], [cabeca[0] - 0.4, cabeca[1] + 4]),
          cabecaDePerfil({ x: cabeca[0], y: cabeca[1], giro: 6 }),
          ...maoNaParede(ombro, false),
        ],
      },
    ],
  };
}

const COSTELAS = {
  chao: 147,
  parede: 104,
  quadril: [50, 92] as P,
  giro: 40,
  cotovelo: [100.6, 40] as P,
} as const;

function costelasNaParede(): Desenho {
  const c = COSTELAS.chao;
  const q = COSTELAS.quadril;
  const l = troncoPeloQuadril(q, COSTELAS.giro);
  const ombro = noDesenho(l, TRONCO.ombro);
  /* A cabeça solta entre os braços: o pescoço dobra um pouco para a frente. */
  const cabeca: P = mais(cabecaNoTronco(l, 15.4), -1.6, 4.6);
  const cot = COSTELAS.cotovelo;
  const joelho: P = [q[0] + 4.4, q[1] + 24.4];
  const tornozelo: P = [q[0] + 3.4, c - 6.4];
  const antebraco = (e: P, longe: boolean): Forma[] => {
    const cor = longe ? ("peleSombra" as const) : ("pele" as const);
    return [
      cilindro(e, GROSSO.antebraco[0], [e[0] + 0.6, e[1] - 19], GROSSO.antebraco[1], cor, 0.7),
      cilindro(
        [e[0] + 0.6, e[1] - 19],
        GROSSO.mao[0],
        [e[0] + 0.8, e[1] - 24],
        GROSSO.mao[1],
        cor,
        0.7,
      ),
    ];
  };
  const cotLonge = mais(cot, 0, -3.6);
  const ombroLonge = mais(ombro, -2.4, -1);
  return {
    caixa: [14, 0, 104, 150],
    camadas: [
      { formas: [...paredeAFrente(COSTELAS.parede, c), sombraNoChao(62, c, 18)] },
      { formas: antebraco(cotLonge, true) },
      {
        parte: "bracoLonge",
        formas: [
          cilindro(ombroLonge, GROSSO.braco[0], cotLonge, GROSSO.braco[1], "peleSombra", 0.7),
        ],
      },
      {
        formas: [
          ...perna(mais(q, -2, 0), mais(joelho, -3.4, 0), mais(tornozelo, -4.4, 0), true),
          tenisDePerfil(mais(tornozelo, -4.4, 0), 0, false, true),
          ...perna(q, joelho, tornozelo),
          tenisDePerfil(tornozelo),
        ],
      },
      {
        parte: "corpo",
        formas: [
          troncoDePerfil(l),
          barrigaNoLugar(l),
          pescocoDePerfil([l.x, l.y], [cabeca[0] - 1, cabeca[1] + 3.6]),
          cabecaDePerfil({ x: cabeca[0], y: cabeca[1], giro: 44 }),
        ],
      },
      { formas: antebraco(cot, false) },
      {
        parte: "braco",
        formas: [cilindro(ombro, GROSSO.braco[0], cot, GROSSO.braco[1], "pele", 0.7)],
      },
    ],
  };
}

const AGACHAMENTO = {
  chao: 144.4,
  parede: 30,
  tornozelo: [52, 138] as P,
  joelho: [55.3, 114.2] as P,
  quadril: [41.6, 93.3] as P,
} as const;

function agachamentoNaParede(): Desenho {
  const c = AGACHAMENTO.chao;
  const tz = AGACHAMENTO.tornozelo;
  const j = AGACHAMENTO.joelho;
  const q = AGACHAMENTO.quadril;
  const l = troncoPeloQuadril(q, 0);
  const ombro = noDesenho(l, TRONCO.ombro);
  const cabeca = cabecaNoTronco(l);
  const parede: Forma[] = [
    {
      d: caixaRedonda(-80, -80, AGACHAMENTO.parede + 80, c + 80, 2),
      cor: "apoio",
      gradiente: luzDaParede(AGACHAMENTO.parede, -1),
    },
    {
      d: `M${AGACHAMENTO.parede} -80L${AGACHAMENTO.parede} ${c}`,
      traco: "apoioSombra",
      espessura: 1.6,
    },
  ];
  return {
    caixa: [6, 0, 100, 150],
    camadas: [
      { formas: [...parede, sombraNoChao(50, c, 18)] },
      {
        parte: "corpo",
        formas: braco(
          mais(ombro, -2.4, 0.6),
          [ombro[0] - 2, ombro[1] + 21],
          [ombro[0] + 1.4, ombro[1] + 39.6],
          [ombro[0] + 2.6, ombro[1] + 44.4],
          true,
        ),
      },
      {
        formas: [tenisDePerfil(mais(tz, LONGE, 0), 0, false, true)],
      },
      {
        parte: "canelaLonge",
        formas: [canela(mais(j, LONGE, 0), mais(tz, LONGE, 0), true)],
        dentro: [
          { parte: "coxaLonge", formas: [coxa(mais(q, LONGE * 0.5, 0), mais(j, LONGE, 0), true)] },
        ],
      },
      {
        formas: [tenisDePerfil(tz)],
      },
      {
        parte: "canela",
        formas: [canela(j, tz)],
        dentro: [{ parte: "coxa", formas: [coxa(q, j)] }],
      },
      {
        parte: "corpo",
        formas: [
          troncoDePerfil(l),
          barrigaNoLugar(l),
          pescocoDePerfil([l.x, l.y], [cabeca[0] - 0.4, cabeca[1] + 4]),
          cabecaDePerfil({ x: cabeca[0], y: cabeca[1], giro: 0 }),
          ...braco(
            ombro,
            [ombro[0] + 0.6, ombro[1] + 21],
            [ombro[0] + 4, ombro[1] + 39.6],
            [ombro[0] + 5.2, ombro[1] + 44.4],
          ),
        ],
      },
    ],
  };
}

/* ── O catálogo ──────────────────────────────────────────────────────────── */

/** As juntas dos giros, nas coordenadas de cada desenho (para a tabela de animação). */
export const JUNTAS = {
  ombros: [60, 47] as P,
  pelve: noDesenho(PELVE.tronco, TRONCO.quadril),
  pescoco: [60, PE.tronco + SENTADA.desce - 2] as P,
  torcao: [60, SENTADA.quadrilE[1]] as P,
  /** Sentada de frente, a altura das costelas: é dali que elas abrem. */
  costelasDeFrente: [60, PE.tronco + SENTADA.desce + 24] as P,
  tornozelo: PERFIL_SENTADA.tornozeloEsticado,
  borboleta: {
    quadrilE: BORBOLETA.quadrilE,
    quadrilD: espelharX(BORBOLETA.quadrilE),
    tornozeloE: BORBOLETA.tornozeloE,
    tornozeloD: espelharX(BORBOLETA.tornozeloE),
  },
  quatro: {
    pescoco: [QUATRO.tronco.x, QUATRO.tronco.y] as P,
    punho: QUATRO.punho,
    punhoLonge: mais(QUATRO.punho, -LONGE, 0),
    joelho: QUATRO.joelho,
    joelhoLonge: mais(QUATRO.joelho, -LONGE, 0),
  },
  /** Deitada, o tronco inteiro respira em volta do meio dele. */
  barrigaDeitada: naTela([60, DEITADA.tronco + 24]),
  travesseiro: [DEITADA.joelhoCima[0] + 1, 61.4] as P,
  quadrilDeitada: DEITADA.quadrilCima,
  costelas: {
    quadril: COSTELAS.quadril,
    cotovelo: COSTELAS.cotovelo,
    cotoveloLonge: mais(COSTELAS.cotovelo, 0, -3.6),
  },
  agachamento: {
    tornozelo: AGACHAMENTO.tornozelo,
    tornozeloLonge: mais(AGACHAMENTO.tornozelo, LONGE, 0),
    joelho: AGACHAMENTO.joelho,
    joelhoLonge: mais(AGACHAMENTO.joelho, LONGE, 0),
  },
  bola: [60, 126] as P,
} as const;

/** O desenho de cada exercício. Sem desenho próprio, o da pose. */
export function desenhoDoMovimento(id: string, pose: PoseKey): Desenho {
  switch (id) {
    case "ombros":
      return emPeDeFrente(false);
    case "bracos":
      return emPeDeFrente(true);
    case "pelve":
      return pelveNaParede();
    case "piriforme":
      return sentadaDeFrente({ cruzada: true });
    case "torcao":
      return sentadaDeFrente({ maos: "torcao" });
    case "respiracao-diafragma":
      return sentadaDeFrente({ maos: "respira" });
    case "tornozelo":
      return sentadaDePerfil({ esticada: true, bracosAFrente: false });
    case "punho-dedos":
      return sentadaDePerfil({ esticada: false, bracosAFrente: true });
    case "circulos-bola":
      return sentadaNaBola();
    case "quadril":
      return borboleta();
    case "gatocamelo":
      return deQuatro(true);
    case "balanco":
      return deQuatro(false);
    case "travesseiro-entre-joelhos":
      return deitadaDeLado({ travesseiro: true, maoNaBarriga: false });
    case "joelho-ao-peito":
      return deitadaDeLado({ travesseiro: false, maoNaBarriga: false, joelhoAoPeito: true });
    case "pernas-elevadas":
      return deitadaDeLado({ travesseiro: false, maoNaBarriga: true, pernasAltas: true });
    case "panturrilha-parede":
      return panturrilhaNaParede();
    case "costelas-parede":
      return costelasNaParede();
    case "agachamento-parede":
      return agachamentoNaParede();
    default:
      break;
  }
  switch (pose) {
    case "pe":
      return emPeDeFrente(false);
    case "sentada":
      return sentadaDeFrente();
    case "borboleta":
      return borboleta();
    case "quatro":
      return deQuatro(false);
    case "deitada":
      return deitadaDeLado({ travesseiro: true, maoNaBarriga: true });
    case "parede":
      return panturrilhaNaParede();
  }
}
