/**
 * O PLANO DE UMA SESSÃO — quais falas tocam, e em qual respiração.
 *
 * Função pura: recebe duração, tema, fase da gestação e densidade de voz, e
 * devolve uma lista de `{ ciclo, fala }`. Não toca áudio, não sabe de React.
 *
 * ─── O ARCO É FIXO; O QUE MUDA É QUANTO CABE DENTRO DELE ───────────────────
 *
 * Acolhimento → ancoragem → corpo do tema → silêncio → volta ao corpo. É o
 * mesmo arco que o Headspace usa há uma década, e é o que faz uma sessão
 * parecer uma sessão em vez de uma playlist. Uma de 1 minuto e uma de 10 têm
 * as mesmas cinco partes: a de 10 tem mais falas em cada uma.
 *
 * ─── A CADÊNCIA CRESCE, E ISSO É O PRODUTO ─────────────────────────────────
 *
 * No acolhimento fala-se a cada respiração; no corpo, a cada duas; no
 * silêncio, a cada três. Não é economia de conteúdo — é a forma. Quem nunca
 * meditou precisa de voz o tempo todo no começo e de silêncio no fim, e o
 * Headspace faz os silêncios crescerem ao longo do curso pelo mesmo motivo.
 * A régua antiga fazia o contrário: 34 segundos de voz e nove minutos de três
 * palavras em rodízio.
 *
 * ⚠️ Cada janela recebe pelo menos UM ciclo. Sem isso, a sessão de 1 minuto
 * (cinco respirações, cinco janelas) perderia a volta ao corpo — terminar de
 * repente com a paciente funda é o defeito mais comum de meditação amadora.
 */

import {
  ROTEIROS,
  trimestreDaSemana,
  type Fala,
  type Momento,
  type Trimestre,
} from "./meditacao-roteiros";

export { trimestreDaSemana };

/**
 * Quanta voz ela quer.
 *
 * O Headspace oferece guiada, semi-guiada e não guiada, e é uma das razões de
 * ele ser o melhor para quem está começando: quem quer silêncio pede silêncio,
 * em vez de o app decidir por todo mundo. Aqui são os mesmos três degraus.
 */
export type Densidade = "guiada" | "pouca" | "silenciosa";

export const DENSIDADES: { chave: Densidade; rotulo: string; sub: string }[] = [
  { chave: "guiada", rotulo: "Guiada", sub: "Uma voz acompanhando você" },
  { chave: "pouca", rotulo: "Pouca voz", sub: "Só o essencial, muito silêncio" },
  { chave: "silenciosa", rotulo: "Só o ritmo", sub: "Sem voz, só o desenho" },
];

/** Segundos de um ciclo de respiração. Igual ao `CICLO_SEGS` da tela. */
export const CICLO = 12;

/**
 * As cinco janelas, em fração da sessão, e de quantos em quantos ciclos se
 * fala dentro de cada uma.
 */
const JANELAS: { momento: Momento; ate: number; cada: number }[] = [
  { momento: "acolhimento", ate: 0.12, cada: 1 },
  { momento: "ancoragem", ate: 0.3, cada: 1 },
  { momento: "corpo", ate: 0.64, cada: 2 },
  { momento: "silencio", ate: 0.88, cada: 3 },
  { momento: "volta", ate: 1, cada: 1 },
];

/**
 * O peso mínimo que entra, por duração e densidade.
 *
 * É o que faz UM banco servir quatro durações: a sessão curta toca só o
 * esqueleto (peso 3), a longa toca tudo. Sem isso seriam quatro gravações por
 * tema — 84 faixas em vez de 149 trechos, e um custo que não cabia.
 */
export function pesoMinimo(minutos: number, densidade: Densidade): number {
  if (densidade === "silenciosa") return 4; // nada entra
  if (densidade === "pouca") return 3;
  if (minutos >= 10) return 1;
  if (minutos >= 5) return 2;
  return 3;
}

export type Deixa = { ciclo: number; fala: Fala };

export type Plano = {
  deixas: Deixa[];
  totalCiclos: number;
  /**
   * Até qual ciclo as três palavras da respiração ("Inspire/Segure/Solte")
   * continuam tocando.
   *
   * ⚠️ Elas tocavam 47 vezes numa sessão de dez minutos — 141 palavras, o
   * grosso de tudo que se ouvia. Agora conduzem só enquanto o desenho ainda
   * está ensinando o compasso e depois calam, que é quando a paciente já
   * aprendeu. Na densidade "só o ritmo" elas vão até o fim: são o único guia
   * que sobra, e sem elas quem está de olhos fechados fica sem nada.
   */
  palavrasAte: number;
};

/** Quantos ciclos cabem numa sessão de N minutos. */
export function ciclosDe(minutos: number): number {
  return Math.max(1, Math.round((minutos * 60) / CICLO));
}

/**
 * As falas candidatas de um momento, já filtradas e na ordem em que devem ser
 * ditas.
 */
function candidatas(
  momento: Momento,
  o: { tema: string; variacao: 1 | 2 | 3; trimestre: Trimestre | null; minimo: number },
): Fala[] {
  const doMomento = ROTEIROS.filter((f) => f.momento === momento && f.peso >= o.minimo);
  if (momento === "corpo") {
    return doMomento.filter((f) => f.tema === o.tema && f.variacao === o.variacao);
  }
  if (momento === "acolhimento") {
    /* As comuns primeiro, depois a da fase da gestação — ela reconhece onde a
       paciente está, e só faz sentido depois do "não precisa fazer nada".
       Sem semana conhecida (sem DUM, pós-parto), a de fase não entra: uma voz
       que erra sobre o corpo dela derruba a confiança na sessão inteira. */
    const comuns = doMomento.filter((f) => !f.trimestre);
    const daFase = o.trimestre ? doMomento.filter((f) => f.trimestre === o.trimestre) : [];
    return [...comuns, ...daFase];
  }
  return doMomento;
}

/**
 * Monta o plano.
 *
 * `semente` embaralha as rechamadas de forma determinística — a mesma sessão
 * pedida duas vezes dá o mesmo plano (senão a tela mudaria sozinha ao
 * re-renderizar), mas duas sessões seguidas ouvem rechamadas diferentes. Com
 * vinte no poço e três a oito por sessão, ela pode meditar duas semanas sem
 * ouvir a mesma frase duas vezes.
 */
export function planejarSessao(o: {
  minutos: number;
  tema: string;
  variacao?: 1 | 2 | 3;
  /** Semana gestacional. Sem ela, o acolhimento de fase não entra. */
  semanas?: number | null;
  densidade?: Densidade;
  careMode?: boolean;
  semente?: number;
}): Plano {
  const densidade = o.densidade ?? "guiada";
  const totalCiclos = ciclosDe(o.minutos);
  const minimo = pesoMinimo(o.minutos, densidade);
  const trimestre = trimestreDaSemana(o.semanas);
  const variacao = o.variacao ?? 1;
  const semente = Math.abs(Math.floor(o.semente ?? 0));

  /* Na densidade "só o ritmo" as palavras conduzem a sessão inteira. Nas
     outras, elas param quando a ancoragem acaba — a essa altura o desenho já
     ensinou o compasso, e continuar seria a mesma interrupção a cada quatro
     segundos que fazia a sessão de dez minutos ser 141 palavras. */
  const fimDaAncoragem = Math.max(1, Math.round(totalCiclos * JANELAS[1].ate));
  const palavrasAte = densidade === "silenciosa" ? totalCiclos : fimDaAncoragem;

  const deixas: Deixa[] = [];
  if (densidade === "silenciosa") return { deixas, totalCiclos, palavrasAte };
  /* "Pouca voz" não muda só o peso: dobra a distância entre as falas. Sem
     isso, nas sessões de 1 e 2 minutos — em que o peso mínimo já é 3 nas duas
     densidades — escolher "pouca voz" não mudava absolutamente nada, e um
     controle que não faz nada ensina que os controles desta tela não valem. */
  const espaco = densidade === "pouca" ? 2 : 1;

  /* ⚠️ Cada janela recebe pelo menos um ciclo, e as fronteiras andam para a
     frente conforme isso acontece. Sem o piso, a sessão de 1 minuto (cinco
     ciclos, cinco janelas) perdia a volta ao corpo. */
  let inicio = 0;
  JANELAS.forEach((j, k) => {
    const restantes = JANELAS.length - k - 1;
    const alvo = Math.round(totalCiclos * j.ate);
    const fim = Math.min(totalCiclos - restantes, Math.max(inicio + 1, alvo));
    const lista = candidatas(j.momento, { tema: o.tema, variacao, trimestre, minimo });
    /* As rechamadas giram pela semente; as outras seguem a ordem escrita,
       porque nelas a ordem é o roteiro. */
    const ordenada =
      j.momento === "silencio" && lista.length
        ? lista.map((_, i) => lista[(i + semente) % lista.length])
        : lista;
    /* ⚠️ AS FALAS SE ESPALHAM PELA JANELA INTEIRA, e não se amontoam no
       começo dela. Com passo fixo, as cinco falas de corpo ocupavam os
       primeiros 96 s de uma janela de 204 s e sobrava 1 min 48 s de vazio
       antes do silêncio começar — medido. O passo é o maior entre a cadência
       mínima daquele momento (que é o que separa o acolhimento do silêncio) e
       a largura dividida pelo número de falas. */
    const largura = fim - inicio;
    const cabem = Math.min(ordenada.length, Math.max(1, Math.floor(largura / (j.cada * espaco))));
    const passo = Math.max(j.cada * espaco, largura / cabem);
    let n = 0;
    for (let i = 0; i < cabem; i++) {
      const c = inicio + Math.round(i * passo);
      if (c >= fim || n >= ordenada.length) break;
      const fala = ordenada[n++];
      /* No Modo Cuidado nenhuma fala que cite o bebê ou o parto entra — o
         mesmo portão que a lista de temas aplica, agora fala a fala, porque as
         rechamadas e o acolhimento alcançam TODOS os temas. */
      if (o.careMode && /\b(beb[êe]|barriga|parto|mãe|vocês dois|dele\b|ele\b)/i.test(fala.texto))
        continue;
      deixas.push({ ciclo: c, fala });
    }
    inicio = fim;
  });

  return { deixas, totalCiclos, palavrasAte };
}

/** A fala daquele ciclo, se houver. */
export function falaNoCiclo(plano: Plano, ciclo: number): Fala | null {
  return plano.deixas.find((d) => d.ciclo === ciclo)?.fala ?? null;
}

/**
 * Quanto da sessão tem voz, em fração — o número que a auditoria mediu em
 * 5,5% na versão antiga.
 *
 * Estimativa por caractere: as 149 falas saíram a 16 caracteres por segundo
 * (medido: 9.361 caracteres em 12,5 minutos de áudio).
 */
export function densidadeDeVoz(plano: Plano): number {
  const seg = plano.deixas.reduce((s, d) => s + d.fala.texto.length / 16, 0);
  return seg / (plano.totalCiclos * CICLO);
}
