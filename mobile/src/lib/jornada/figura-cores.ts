/**
 * AS CORES DA PERSONAGEM DO MEXER (e do "Para vocês dois").
 *
 * 21/11/2026, a segunda volta ("ficou bom, mas se possível tente refinar ainda
 * mais e dar mais leveza", o dono): a primeira personagem tinha a legging
 * quase preta, o cabelo e o traço do rosto em ameixa-noite e a blusa na cor
 * forte da atividade — três massas escuras num disco branco, e era isso que
 * pesava. Agora nada é escuro: a blusa é a cor da atividade aberta em pastel,
 * a legging é lilás (a névoa do tema), o cabelo é um castanho quente, e o
 * contorno de cada parte sai da diferença entre dois tons claros, não de uma
 * cor de tinta.
 *
 * Aqui, e não no componente, para a prévia (e o teste) usarem as mesmas cores
 * do app. Sem react-native.
 */

import { clarear, escurecer, misturar } from "../cor";
import type { Parada, Tom } from "./figura-desenho";

export function coresDaFigura(tinta: string): Record<Tom, string> {
  /* A blusa: a cor da atividade, aberta. Escura demais some a leveza; clara
     demais some do disco branco — com o verde do Mexer (#007a55), 0,3 dá
     #4da288, 3:1 contra o branco (a legging lilás dá 3,2:1). */
  const roupa = clarear(tinta, 0.3);
  return {
    pele: "#efb898",
    peleSombra: "#dc9c7e",
    cabelo: "#6b4150",
    roupa,
    roupaLuz: clarear(tinta, 0.72),
    roupaSombra: escurecer(roupa, 0.16),
    legging: "#9488c8",
    leggingSombra: "#7d70b4",
    /* Branco puro sumia no disco branco: um lilás quase branco, e a sola. */
    tenis: "#eee9f8",
    sola: "#cfc5e6",
    tapete: clarear(tinta, 0.88),
    tapeteBorda: clarear(tinta, 0.76),
    apoio: "#f0ebf8",
    apoioSombra: "#dcd2ec",
    sombra: "#3b2d63",
    rosto: "#6b4150",
    bochecha: "#f59ab0",
    parceiroPele: "#c08a69",
    parceiroManga: misturar("#7d8fd6", "#ffffff", 0.08),
    alvo: "#ffd230",
  };
}

/**
 * A cor de um ponto de degradê, e a opacidade dele. A luz vai para um branco
 * quente e a sombra para a ameixa-noite da marca, e não para o preto: sombra
 * cinza é o que faz um volume parecer sujo; sombra colorida é o que faz
 * parecer render.
 *
 * Uma cor translúcida (`rgba`, o banquinho na noite do casal) vira a cor e a
 * opacidade separadas: o degradê do iPhone ignora a transparência escrita
 * dentro da cor, e o banquinho saía branco sólido.
 */
export function paradaEmCor(
  cores: Record<Tom, string>,
  parada: Parada,
): { cor: string; opacidade: number } {
  const [, tom, luz = 0, opacidade = 1] = parada;
  let base = cores[tom];
  let alfa = 1;
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(base);
  if (rgba) {
    const hex = (v: string) => Number(v).toString(16).padStart(2, "0");
    base = `#${hex(rgba[1]!)}${hex(rgba[2]!)}${hex(rgba[3]!)}`;
    alfa = Number(rgba[4]);
  }
  const cor =
    luz > 0 ? misturar(base, "#fff9f2", luz) : luz < 0 ? misturar(base, "#2a1f55", -luz) : base;
  return { cor, opacidade: opacidade * alfa };
}

/** Só a cor de um ponto de degradê (ver `paradaEmCor`). */
export function corDaParada(cores: Record<Tom, string>, parada: Parada): string {
  return paradaEmCor(cores, parada).cor;
}
