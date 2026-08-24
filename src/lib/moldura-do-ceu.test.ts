/**
 * A MOLDURA DO iOS — a faixa atrás do relógio e do indicador de início.
 *
 * No app instalado, o iOS não pinta a página fora da área segura: pinta o fundo
 * do DOCUMENTO. A home escreve ali a cor do topo da cena, e a emenda entre as
 * duas passa exatamente atrás do relógio do sistema — o pior lugar possível
 * para uma cor errada.
 *
 * O defeito que este arquivo fecha: quem comprou o **Céu Clássico** (item pago
 * da Loja, 150 🌱) recebia na moldura a cor das cenas NOVAS. Duas paletas
 * encostadas uma na outra, num tema que a paciente pagou para ter.
 */

import { describe, expect, test } from "bun:test";
import { corDeTopoClassica, gradientFor } from "@/components/weather-sky";

const PERIODOS = ["madrugada", "manha", "dia", "entardecer", "noite"] as const;
/** Céu limpo, nublado, chuva e tempestade — os quatro ramos de `gradientFor`. */
const CODIGOS = [0, 3, 61, 95];

describe("a cor chapada do Céu Clássico", () => {
  test("sai do PRÓPRIO gradiente, em todo período e todo tempo", () => {
    /* Uma segunda tabela de cores divergiria na primeira troca de paleta — a
       mesma lição que `corDeTopo` carrega nas cenas novas. O teste cobra que a
       cor devolvida seja, literalmente, um pedaço do gradiente. */
    for (const p of PERIODOS) {
      for (const c of CODIGOS) {
        const cor = corDeTopoClassica(p, c);
        expect(cor).not.toBe("");
        expect(gradientFor(p, c)).toContain(cor);
      }
    }
  });

  test("é a PRIMEIRA parada, que é o pixel de cima", () => {
    /* A moldura de cima encosta na barra de status. Pegar a última parada
       (o pé da cena) poria a cor do horizonte atrás do relógio. */
    for (const p of PERIODOS) {
      const g = gradientFor(p, 0);
      const cor = corDeTopoClassica(p, 0);
      expect(g.indexOf(cor)).toBe(g.indexOf("180deg,") + "180deg,".length + 1);
    }
  });

  test("formato desconhecido devolve vazio, e não uma cor inventada", () => {
    /* Vazio faz a raiz voltar ao creme do documento — o estado ANTERIOR a esta
       função. Uma cor chutada poderia ficar pior que ele, e ninguém saberia. */
    expect(corDeTopoClassica("dia", 0)).not.toBe("");
    const semGradiente = /linear-gradient\(180deg,\s*([^),]*\([^)]*\)|[^,)]+)/.exec("nada aqui");
    expect(semGradiente).toBeNull();
  });
});
