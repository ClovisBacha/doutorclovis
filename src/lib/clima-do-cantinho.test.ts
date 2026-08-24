/**
 * NO AR — o tipo novo.
 *
 * Uma partícula errada aqui não quebra nada: ela simplesmente não aparece, ou
 * aparece parada num canto. É o pior tipo de defeito de loja — a paciente
 * pagou 90 🌱 pela Chuva de pétalas e concluiu que o app não funciona.
 *
 * Por isso a régua saiu do JSX e veio para cá inteira.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CLIMAS_NA_TELA,
  CLIMA_POR_ITEM,
  PARTICULAS_POR_CLIMA,
  climasAtivos,
  ehClima,
  particulasDe,
} from "./clima-do-cantinho";
import { CANTINHO_ITEMS, CANTINHO_LOJA } from "./cantinho";

const IDS = Object.keys(CLIMA_POR_ITEM);

describe("⚠️ o mapa e o catálogo concordam", () => {
  test("todo item do tipo `clima` tem receita", () => {
    /* Sem receita, o item é comprável e não faz nada — que é exatamente o
       defeito que a "Chuva mansa" tinha e que este arquivo veio consertar. */
    const semReceita = CANTINHO_ITEMS.filter((i) => i.type === "clima" && !ehClima(i.id)).map(
      (i) => i.id,
    );
    expect(semReceita).toEqual([]);
  });

  test("toda receita aponta para um item que existe", () => {
    const ids = new Set(CANTINHO_ITEMS.map((i) => i.id));
    expect(IDS.filter((id) => !ids.has(id))).toEqual([]);
  });

  test("⚠️ os dois consertos continuam sendo `especial`, e à venda", () => {
    /* `especial-chuva` e `especial-vagalume` prometiam comportamento no NOME e
       eram adesivos parados. Ganharam o motor do clima em vez de serem
       aposentados — e continuam com o halo, o tamanho e o preço de `especial`.
       Se alguém os mover para o tipo `clima`, quem só tinha um deles perde a
       categoria "especial" da Coroa. */
    for (const id of ["especial-chuva", "especial-vagalume"]) {
      const item = CANTINHO_LOJA.find((i) => i.id === id);
      expect(item?.type).toBe("especial");
      expect(ehClima(id)).toBe(true);
    }
  });

  test("⚠️ o tipo novo é todo Premium — a loja grátis é fechada em 15 itens", () => {
    /* Este teste já pegou o erro uma vez. A primeira versão do `clima` tinha
       uma "porta grátis" de 90 🌱, e ela sozinha empurrava em quase três dias
       a parede que `economia-sementinhas.ts` calibra para o 15º — a mecânica
       de conversão inteira, desfeita por uma decisão de arrumação de loja. */
    const climas = CANTINHO_LOJA.filter((i) => i.type === "clima");
    expect(climas.length).toBeGreaterThan(0);
    expect(climas.every((i) => i.premium)).toBe(true);
  });
});

describe("⚠️ o clima vem do que ela POSSUI, nunca de onde ele está", () => {
  /* ─── O DEFEITO QUE ESTE TESTE TRAVA ────────────────────────────────────
     A camada No ar nasceu lendo `visiblePlaced` — os sprites espalhados pela
     trilha. Mas o clima não tem lugar: é a definição do tipo.

     A consequência era silenciosa e cara. Com a trilha cheia (120 sprites, e
     cada item não-`especial` custa dois), o item recém-comprado não era
     espalhado; `climasAtivos` recebia uma lista sem ele e a camada renderizava
     `null`. A paciente pagava 200 🌱 na Poeira de estrelas e NADA acontecia —
     exatamente o defeito que "Chuva mansa" e "Vaga-lumes" tinham antes desta
     rodada, reintroduzido pela porta dos fundos.

     Estes dois testes leem a FONTE porque o acoplamento mora no componente, e
     `gestacao-path.tsx` importa cinco `.webp`: um teste que o importasse
     morreria na primeira linha. */
  const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");

  test("a camada não é alimentada pelos sprites espalhados", () => {
    expect(fonte).not.toMatch(/<ClimaNoAr[^>]*visiblePlaced/);
    /* E vem da lista derivada de `decor` (o que ela comprou), com o portão do
       Modo Cuidado dentro dela. */
    expect(fonte).toMatch(/<ClimaNoAr ids=\{bancada\?\.clima \?\? climaDela\}/);
    expect(fonte).toMatch(/careMode \? \[\] : decor\.filter\(\(id\) => ehClima\(id\)\)/);
  });

  test("e o tipo `clima` não entra na bandeja nem gasta vaga de enfeite", () => {
    /* Se voltasse para `trayItems`, ele seria espalhado como adesivo (um 💮
       parado num canto), consumiria duas das 120 vagas e sumiria do ar se ela
       apagasse esse adesivo esquisito no modo Arrumar. */
    expect(fonte).toMatch(/CANTINHO_BY_ID\[id\]\.type !== "clima"/);
    /* E os sprites já GRAVADOS antes da correção também são descartados. */
    expect(fonte).toMatch(/CANTINHO_BY_ID\[p\.id\]\?\.type !== "clima"/);
  });

  test("⚠️ mas os dois `especial` que emitem continuam sendo adesivos", () => {
    /* `especial-chuva` e `especial-vagalume` têm halo, tamanho grande e preço
       de `especial`. Tirá-los da bandeja apagaria o enfeite que ela comprou —
       o filtro é por TIPO, e não por `ehClima`. */
    for (const id of ["especial-chuva", "especial-vagalume"]) {
      expect(CANTINHO_ITEMS.find((i) => i.id === id)?.type).toBe("especial");
      expect(ehClima(id)).toBe(true);
    }
  });
});

describe("as receitas são plausíveis", () => {
  test("nada atravessa a tela correndo", () => {
    /* É enfeite atrás do texto da aula. Abaixo de 8 s vira granizo, e a
       paciente fecha a tela em que ela deveria ficar dez minutos. */
    for (const [id, s] of Object.entries(CLIMA_POR_ITEM)) {
      expect(`${id}:${s.duracao[0] >= 8}`).toBe(`${id}:true`);
      expect(`${id}:${s.duracao[1] >= s.duracao[0]}`).toBe(`${id}:true`);
    }
  });

  test("nada é opaco demais nem invisível", () => {
    for (const [id, s] of Object.entries(CLIMA_POR_ITEM)) {
      expect(`${id}:${s.opacidade > 0.4 && s.opacidade <= 1}`).toBe(`${id}:true`);
    }
  });

  test("tamanho mínimo antes do máximo, e sempre visível", () => {
    for (const [id, s] of Object.entries(CLIMA_POR_ITEM)) {
      expect(`${id}:${s.tamanho[0] > 0.3 && s.tamanho[0] <= s.tamanho[1]}`).toBe(`${id}:true`);
    }
  });

  test("⚠️ gota não plana", () => {
    /* A chuva é a única que precisa cair reta e depressa: uma gota com a
       deriva da peninha lê como confete. */
    const chuva = CLIMA_POR_ITEM["especial-chuva"];
    const pena = CLIMA_POR_ITEM["clima-peninhas"];
    expect(chuva.giro).toBe(0);
    expect(chuva.deriva < pena.deriva).toBe(true);
    expect(chuva.duracao[1] < pena.duracao[0]).toBe(true);
  });
});

describe("climasAtivos", () => {
  test("ignora o que não é clima", () => {
    expect(climasAtivos(["planta-suculenta", "bicho-gato"])).toEqual([]);
  });

  test("pega os climas na ORDEM em que ela os pôs", () => {
    const r = climasAtivos(["planta-suculenta", "clima-neve", "bicho-gato", "clima-petalas"]);
    expect(r).toEqual(["clima-neve", "clima-petalas"]);
  });

  test("o mesmo item posto duas vezes não dobra a chuva", () => {
    expect(climasAtivos(["clima-neve", "clima-neve", "clima-neve"])).toEqual(["clima-neve"]);
  });

  test("⚠️ o teto é do MOTOR, e corta o que ela pôs por último", () => {
    /* Ordenar por preço ou por id faria um item novo expulsar, sem aviso, o
       clima que ela já via ontem. Assim o que sai é o último que ela colocou,
       que é a única regra que ela consegue prever. */
    const r = climasAtivos(IDS);
    expect(r.length).toBe(CLIMAS_NA_TELA);
    expect(r).toEqual(IDS.slice(0, CLIMAS_NA_TELA));
  });

  test("lista vazia devolve vazio", () => {
    expect(climasAtivos([])).toEqual([]);
  });
});

describe("particulasDe", () => {
  test("item que não é clima devolve nada — e não estoura", () => {
    expect(particulasDe("planta-suculenta")).toEqual([]);
    expect(particulasDe("nao-existe")).toEqual([]);
  });

  test("a conta é a declarada, para todos", () => {
    for (const id of IDS) expect(particulasDe(id).length).toBe(PARTICULAS_POR_CLIMA);
  });

  test("⚠️ é determinística — duas chamadas, o mesmo resultado", () => {
    /* `Math.random()` daria mismatch de hidratação (o servidor desenha uma
        posição e o cliente outra) e uma chuva diferente a cada abertura. */
    expect(JSON.stringify(particulasDe("clima-petalas"))).toBe(
      JSON.stringify(particulasDe("clima-petalas")),
    );
  });

  test("chaves únicas — senão o React reaproveita o elemento errado", () => {
    for (const id of IDS) {
      const ks = particulasDe(id).map((p) => p.k);
      expect(new Set(ks).size).toBe(ks.length);
    }
  });

  test("nenhuma nasce fora da tela na horizontal", () => {
    for (const id of IDS) {
      for (const p of particulasDe(id)) {
        expect(`${p.k}:${p.esquerda >= 0 && p.esquerda <= 100}`).toBe(`${p.k}:true`);
      }
    }
  });

  test("⚠️ o atraso é NEGATIVO e cabe numa volta", () => {
    /* É o que faz a chuva já estar caindo quando a tela abre. Com atraso
       positivo (ou zero), as catorze pétalas entram juntas nos primeiros
       segundos e a tela fica vazia até a próxima volta — que é a diferença
       entre "está chovendo" e "começou a chover agora". */
    for (const id of IDS) {
      for (const p of particulasDe(id)) {
        expect(`${p.k}:${p.atraso <= 0 && p.atraso >= -p.duracao}`).toBe(`${p.k}:true`);
      }
    }
  });

  test("as duas direções de giro aparecem", () => {
    /* Todas girando para o mesmo lado lê como engrenagem, não como vento. */
    const gs = particulasDe("clima-folhas").map((p) => p.giro);
    expect(gs.some((g) => g > 0)).toBe(true);
    expect(gs.some((g) => g < 0)).toBe(true);
  });

  test("o que não gira, não gira em nenhuma partícula", () => {
    expect(particulasDe("clima-bolhas").every((p) => p.giro === 0)).toBe(true);
  });

  test("a duração de cada uma está na faixa da receita", () => {
    for (const id of IDS) {
      const [min, max] = CLIMA_POR_ITEM[id].duracao;
      for (const p of particulasDe(id)) {
        expect(`${p.k}:${p.duracao >= min && p.duracao <= max}`).toBe(`${p.k}:true`);
      }
    }
  });

  test("⚠️ as partículas não nascem todas no mesmo lugar", () => {
    /* O hash é determinístico de propósito — mas um hash mal usado (por
       exemplo o mesmo `h` para todos os campos) daria catorze partículas
       idênticas empilhadas numa coluna só, que é indistinguível de uma
       partícula só. */
    for (const id of IDS) {
      const xs = new Set(particulasDe(id).map((p) => Math.round(p.esquerda)));
      expect(`${id}:${xs.size >= PARTICULAS_POR_CLIMA - 2}`).toBe(`${id}:true`);
    }
  });
});
