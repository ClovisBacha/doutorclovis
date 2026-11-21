/**
 * AS FIGURAS DO "PARA VOCÊS DOIS" com a mesma personagem do Mexer (21/11/2026:
 * os dois desenhos de pessoa eram de traço fino, como o boneco do exercício).
 * Ela sentada de lado num banquinho, e de quem acompanha só aparece o braço,
 * entrando pela borda: a mão espalmada na base da coluna, ou as duas mãos na
 * barriga. O ponto âmbar (o `alvo`) continua dizendo exatamente onde a mão vai.
 */

import {
  barrigaNoLugar,
  braco,
  cabecaDePerfil,
  canela,
  capsula,
  cilindro,
  circulo,
  coxa,
  MEDIDA,
  noDesenho,
  pernaDeMovel,
  pescocoDePerfil,
  tampo,
  tenisDePerfil,
  troncoDePerfil,
  TRONCO,
  type Desenho,
  type Forma,
  type Lugar,
  type P,
} from "./figura-desenho";

const mais = (p: P, dx: number, dy: number): P => [p[0] + dx, p[1] + dy];

/** Ela, sentada de lado no banquinho, olhando para a direita. */
function elaSentada(giro: number, maos: "coxas" | "lado"): { formas: Forma[]; l: Lugar } {
  const l: Lugar = { x: 64, y: 38, giro };
  const chao = 120;
  const r = (giro * Math.PI) / 180;
  const quadril = noDesenho(l, TRONCO.quadril);
  const ombro = noDesenho(l, TRONCO.ombro);
  const d = MEDIDA.cabecaDePerfil;
  const cabeca: P = [l.x + d * Math.sin(r) + 1.8, l.y - d * Math.cos(r)];
  const joelho: P = [quadril[0] + 24.6, quadril[1] + 2];
  const tornozelo: P = [joelho[0] - 1.4, chao - 6.4];
  const bracoDela =
    maos === "coxas"
      ? braco(
          ombro,
          [ombro[0] + 4, ombro[1] + 20.4],
          [ombro[0] + 18, ombro[1] + 33],
          [ombro[0] + 22.4, ombro[1] + 35],
        )
      : braco(
          ombro,
          [ombro[0] - 1.6, ombro[1] + 20.8],
          [ombro[0] + 6, ombro[1] + 38.2],
          [ombro[0] + 9.6, ombro[1] + 41.4],
        );
  return {
    l,
    formas: [
      /* O banquinho. */
      pernaDeMovel([quadril[0] - 9, quadril[1] + 11], 1.8, [quadril[0] - 10.4, chao - 1], 1.6),
      pernaDeMovel([quadril[0] + 9, quadril[1] + 11], 1.8, [quadril[0] + 10.4, chao - 1], 1.6),
      tampo(quadril[0] - 14, quadril[1] + 6.2, 28, 5.6, 2.8),
      /* A perna de longe. */
      coxa(mais(quadril, -2, 0), mais(joelho, -2.4, 0.4), true),
      canela(mais(joelho, -2.4, 0.4), mais(tornozelo, -2.6, 0), true),
      tenisDePerfil(mais(tornozelo, -2.6, 0), 0, false, true),
      troncoDePerfil(l),
      barrigaNoLugar(l),
      pescocoDePerfil([l.x, l.y], [cabeca[0] - 0.2, cabeca[1] + 4]),
      cabecaDePerfil({ x: cabeca[0], y: cabeca[1], giro: giro * 0.6 }),
      coxa(quadril, joelho),
      canela(joelho, tornozelo),
      tenisDePerfil(tornozelo),
      ...bracoDela,
    ],
  };
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/**
 * A manga de quem acompanha, que vem de fora do desenho. Ela SOME antes da
 * borda da caixa (21/11/2026): o desenho é recortado na caixa, e a manga
 * terminava num corte reto, um toco de braço solto no céu.
 */
function manga(ombro: P, cotovelo: P, borda: number, op: number): Forma {
  const t = (borda - ombro[0]) / (cotovelo[0] - ombro[0]);
  const naBorda: P = [borda, ombro[1] + (cotovelo[1] - ombro[1]) * t];
  return {
    d: capsula(ombro, 5.2, cotovelo, 3.9),
    cor: "parceiroManga",
    opacidade: op,
    gradiente: {
      tipo: "linear",
      de: naBorda,
      ate: cotovelo,
      /* Some em curva, e não em rampa: na rampa reta, o fim do sumiço ainda
         lia como um corte (medido no iPhone). */
      paradas: [
        [0, "parceiroManga", -0.12, 0],
        [0.18, "parceiroManga", -0.08, 0.1],
        [0.4, "parceiroManga", -0.04, 0.45],
        [0.68, "parceiroManga", 0, 0.92],
        [1, "parceiroManga", 0.1, 1],
      ],
    },
  };
}

/**
 * A mão espalmada: a palma abre do punho para os dedos, com a ponta redonda e o
 * polegar de lado (`polegar`: de que lado do eixo). Era uma cápsula mais
 * grossa que o punho, e virava um pino.
 */
function maoEspalmada(punho: P, dedos: P, polegar: 1 | -1 | 0, op: number): Forma[] {
  const L = Math.hypot(dedos[0] - punho[0], dedos[1] - punho[1]) || 1;
  const u: P = [(dedos[0] - punho[0]) / L, (dedos[1] - punho[1]) / L];
  const lado = polegar || 1;
  const v: P = [-u[1] * lado, u[0] * lado];
  /* s: de lado (para o polegar); t: ao longo, do punho (0) aos dedos (1). */
  const em = (s: number, t: number): P => [
    punho[0] + v[0] * s + u[0] * t * L,
    punho[1] + v[1] * s + u[1] * t * L,
  ];
  const q = (s: number, t: number) => em(s, t).map(n).join(" ");
  return [
    ...(polegar
      ? [
          {
            ...cilindro(em(1.6, 0.14), 1.25, em(3.8, 0.46), 0.95, "parceiroPele", 0.7),
            opacidade: op,
          },
        ]
      : []),
    {
      /* A luz de um cilindro no eixo da mão, com o contorno da palma. */
      ...cilindro(punho, 2.2, dedos, 3, "parceiroPele", 0.7, 3),
      d:
        `M${q(-2.1, 0)}C${q(-2.6, 0.3)} ${q(-3.3, 0.5)} ${q(-3.2, 0.78)}` +
        `C${q(-3.1, 1.02)} ${q(-1.3, 1.07)} ${q(0, 1.06)}` +
        `C${q(1.3, 1.07)} ${q(3.1, 1.02)} ${q(3.2, 0.78)}` +
        `C${q(3.3, 0.5)} ${q(2.6, 0.3)} ${q(2.1, 0)}Z`,
      opacidade: op,
    },
  ];
}

/** O braço de quem acompanha: a manga, o antebraço e a mão espalmada. */
function bracoDeQuemAcompanha(
  ombro: P,
  cotovelo: P,
  punho: P,
  dedos: P,
  o: { borda: number; polegar: 1 | -1 | 0; longe?: boolean },
): Forma[] {
  const op = o.longe ? 0.78 : 1;
  return [
    manga(ombro, cotovelo, o.borda, op),
    { ...cilindro(cotovelo, 3.0, punho, 2.1, "parceiroPele", 0.7, 3.0), opacidade: op },
    ...maoEspalmada(punho, dedos, o.polegar, op),
  ];
}

/** O ponto âmbar com o halo: onde a mão vai. */
function alvo(p: P): Forma[] {
  return [
    { d: circulo(p[0], p[1], 11), cor: "alvo", opacidade: 0.28 },
    { d: circulo(p[0], p[1], 7), cor: "alvo", opacidade: 0.6 },
  ];
}

export function desenhoDoCasal(tipo: "mao-no-sacro" | "mao-na-barriga"): Desenho {
  if (tipo === "mao-no-sacro") {
    /* De lado, um pouco inclinada para a frente; a mão espalmada na base da
       coluna, logo acima do bumbum, vindo de trás. */
    const { formas, l } = elaSentada(12, "coxas");
    const sacro = noDesenho(l, [-9.4, 41.6]);
    const palma = mais(sacro, -2.2, 0);
    return {
      caixa: [0, 4, 150, 118],
      camadas: [
        { formas: [...alvo(sacro), ...formas] },
        {
          formas: bracoDeQuemAcompanha(
            [-10, palma[1] + 7],
            [palma[0] - 21, palma[1] + 6.4],
            mais(palma, -1.4, 4.7),
            mais(palma, 3.6, -5.5),
            { borda: 0, polegar: 0 },
          ),
        },
      ],
    };
  }
  /* As duas mãos na barriga, uma de cada lado, vindo da frente. */
  const { formas, l } = elaSentada(4, "lado");
  const frente = noDesenho(l, [TRONCO.barriga[0] + 9.2, TRONCO.barriga[1] + 1]);
  const embaixo = mais(frente, -0.6, 6.4);
  const emCima = mais(frente, -3.6, -6.6);
  return {
    caixa: [0, 4, 150, 118],
    camadas: [
      {
        formas: [
          ...alvo(emCima),
          ...alvo(embaixo),
          /* A mão de longe, do outro lado da barriga, mais apagada. */
          ...bracoDeQuemAcompanha(
            [162, emCima[1] - 6],
            [emCima[0] + 26, emCima[1] + 2],
            mais(emCima, 5.6, 1.6),
            mais(emCima, -3.6, -2.4),
            { borda: 150, polegar: 1, longe: true },
          ),
          ...formas,
        ],
      },
      {
        formas: bracoDeQuemAcompanha(
          [162, embaixo[1] + 10],
          [embaixo[0] + 26, embaixo[1] + 6],
          mais(embaixo, 5.6, 1),
          mais(embaixo, -3, -3.4),
          { borda: 150, polegar: 1 },
        ),
      },
    ],
  };
}
