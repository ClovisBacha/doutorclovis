/**
 * SOM DE INTERFACE — a régua, e os limites que ela existe para não deixar cair.
 *
 * ⚠️ Nada aqui toca nada: o sintetizador precisa de Web Audio e não é o que
 * quebra em silêncio. O que quebra em silêncio é a REGRA — um som novo entrando
 * na lista sem justificar, o Modo Cuidado deixando passar, o teto de fadiga
 * sumindo. É isso que se cobra.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { nota } from "./afinacao";
import { semDissonancia } from "./afinacao";
import {
  ALARME,
  DESENHOS,
  NIVEL_PADRAO,
  TETO_HZ,
  TETO_POR_DIA,
  ehAlarme,
  podeSoar,
  type Contexto,
  type EspecieDeSom,
} from "./som-da-interface";

const NORMAL: Contexto = {
  nivel: "completo",
  careMode: false,
  visivel: true,
  desdeOGesto: 200,
  jaTocouHoje: 0,
};

const TODAS = Object.keys(DESENHOS) as EspecieDeSom[];

describe("⚠️ nasce DESLIGADO, e a decisão é sobre quem paga o erro", () => {
  test("o padrão é o silêncio", () => {
    /* Ligar custa um toque. O erro custa um incidente — e o incidente não é
       "ela desliga o som de interface", é "ela silencia o app inteiro nas
       Configurações do iPhone", que é o mesmo canal do aviso de emergência. */
    expect(NIVEL_PADRAO).toBe("desligado");
  });

  test("com o som desligado, nada de interface soa", () => {
    for (const e of TODAS) {
      if (ehAlarme(e)) continue;
      expect({ e, soa: podeSoar(e, { ...NORMAL, nivel: "desligado" }) }).toEqual({ e, soa: false });
    }
  });

  test("⚠️ mas o ALARME soa mesmo assim — ele não é som de interface", () => {
    /* O SOS é o único ponto do app em que a confirmação é clínica e a
       destinatária pode estar em pânico, sem ler a tela. E a FALHA do SOS é o
       único erro cuja consequência é clínica. */
    for (const e of ALARME) {
      expect({ e, soa: podeSoar(e, { ...NORMAL, nivel: "desligado" }) }).toEqual({ e, soa: true });
    }
  });

  test("o nível ESSENCIAL deixa passar o compasso e barra a conquista", () => {
    /* Três estados e não dois: um booleano obrigaria quem quer a deixa da
       respiração a aceitar também a festa da conquista. */
    const ctx = { ...NORMAL, nivel: "essencial" as const };
    expect(podeSoar("compasso", ctx)).toBe(true);
    expect(podeSoar("fim", ctx)).toBe(true);
    expect(podeSoar("intervalo", ctx)).toBe(true);
    expect(podeSoar("conquista", ctx)).toBe(false);
  });
});

describe("⚠️ os portões que impedem o som de aparecer do nada", () => {
  test("Modo Cuidado silencia tudo que não é alarme", () => {
    for (const e of TODAS) {
      const soa = podeSoar(e, { ...NORMAL, careMode: true });
      expect({ e, soa }).toEqual({ e, soa: ehAlarme(e) });
    }
  });

  test("⚠️ e o alarme continua tocando no Modo Cuidado — quem perdeu a gestação continua podendo passar mal", () => {
    expect(podeSoar("sos", { ...NORMAL, careMode: true, nivel: "desligado" })).toBe(true);
  });

  test("aba em segundo plano não soa", () => {
    /* Ela não está aqui: o som iria para o quarto e não para ela. */
    expect(podeSoar("conquista", { ...NORMAL, visivel: false })).toBe(false);
  });

  test("⚠️ sem gesto recente, não soa", () => {
    /* Som que ela não provocou é som que aparece do nada — e este app tem push,
       cron e temporizadores capazes de disparar sozinhos. */
    expect(podeSoar("conquista", { ...NORMAL, desdeOGesto: 5000 })).toBe(false);
    expect(podeSoar("conquista", { ...NORMAL, desdeOGesto: 1500 })).toBe(true);
  });

  test("o teto de fadiga corta a quarta conquista do dia", () => {
    /* Num dia bom ela fecha o dia, ganha troféu e completa um conjunto: três
       festas. A quarta não acrescenta e começa a tirar. */
    expect(TETO_POR_DIA.conquista).toBe(3);
    expect(podeSoar("conquista", { ...NORMAL, jaTocouHoje: 2 })).toBe(true);
    expect(podeSoar("conquista", { ...NORMAL, jaTocouHoje: 3 })).toBe(false);
  });

  test("⚠️ o alarme não tem teto — ela pode passar mal duas vezes no mesmo dia", () => {
    expect(TETO_POR_DIA.sos).toBeUndefined();
    expect(podeSoar("sos", { ...NORMAL, jaTocouHoje: 99 })).toBe(true);
  });
});

describe("⚠️ os números, e o que cada um impede", () => {
  test("nenhum som sobe em menos de 20 ms", () => {
    /* A resposta de sobressalto cai monotonicamente com o tempo de subida entre
       2 e 100 ms: ataque abaixo de ~15 ms é a diferença entre INFORMAR e
       ASSUSTAR. É o parâmetro mais importante da lista, e assustar uma gestante
       de alto risco é o oposto do trabalho deste arquivo. */
    for (const e of TODAS) {
      expect({ e, ataque: DESENHOS[e].ataque >= 0.02 }).toEqual({ e, ataque: true });
    }
  });

  test("⚠️ a faixa do ALARME é reservada — só o SOS entra nela", () => {
    /* O pico de sensibilidade do ouvido está entre 2 e 5 kHz, e é por isso que
       a norma de alarme médico (IEC 60601-1-8) exige harmônicos ali. Som de
       interface que colocar energia nessa faixa toma emprestado o timbre de
       emergência — e este app tem um alarme de verdade. */
    for (const e of TODAS) {
      if (ehAlarme(e)) continue;
      for (const p of DESENHOS[e].passos) {
        expect({ e, hz: p.hz, dentro: p.hz <= TETO_HZ }).toEqual({ e, hz: p.hz, dentro: true });
      }
      expect({ e, corte: DESENHOS[e].corte <= TETO_HZ }).toEqual({ e, corte: true });
    }
  });

  test("⚠️ e nenhum som desce abaixo de 400 Hz", () => {
    /* O alto-falante do iPhone cai forte abaixo de ~500 Hz: um som "escuro"
       feito com fundamental grave fica quase inaudível no viva-voz e ALTO no
       fone — uma assimetria perigosa. A escuridão vem do FILTRO. */
    for (const e of TODAS) {
      for (const p of DESENHOS[e].passos) {
        expect({ e, hz: p.hz, ok: p.hz >= 400 }).toEqual({ e, hz: p.hz, ok: true });
      }
    }
  });

  test("toda nota está na grade de A = 432 e na pentatônica de lá", () => {
    /* Dois sons que se sobreponham por acidente continuam consonantes — e num
       app sobreposição acidental é o caso comum, não o raro. */
    const permitidas = new Set<number>();
    for (let o = 3; o <= 6; o++) {
      for (const n of ["la", "do", "re", "mi", "sol"] as const) {
        permitidas.add(Math.round(nota(n, o) * 100));
      }
    }
    for (const e of TODAS) {
      for (const p of DESENHOS[e].passos) {
        expect({ e, hz: p.hz, naEscala: permitidas.has(Math.round(p.hz * 100)) }).toEqual({
          e,
          hz: p.hz,
          naEscala: true,
        });
      }
    }
    /* E a escala é a única segura para sobreposição livre — ver o teorema. */
    expect(semDissonancia([0, 3, 5, 7, 10])).toBe(true);
  });

  test("o SOS SOBE e o fim DESCE — e essa é a diferença que ela ouve sem olhar", () => {
    /* Subir é o vocabulário de "chegou"; descer é o de "pronto". Trocar os dois
       faria a confirmação do SOS soar como o fim de um exercício. */
    const sos = DESENHOS.sos.passos;
    expect(sos[sos.length - 1].hz).toBeGreaterThan(sos[0].hz);
    const fim = DESENHOS.fim.passos;
    expect(fim[fim.length - 1].hz).toBeLessThan(fim[0].hz);
  });

  test("o tique é curto e a conquista é longa — as três classes existem", () => {
    const dur = (e: EspecieDeSom) => {
      const p = DESENHOS[e].passos;
      return Math.max(...p.map((x) => x.em + x.dur));
    };
    expect(dur("intervalo")).toBeLessThan(0.09);
    expect(dur("fim")).toBeGreaterThan(0.15);
    expect(dur("fim")).toBeLessThan(0.3);
    expect(dur("conquista")).toBeGreaterThan(0.55);
    expect(dur("conquista")).toBeLessThan(0.95);
  });
});

describe("⚠️ a lista é FECHADA — o que não entrou, não entrou por razão escrita", () => {
  test("nenhuma espécie de confirmação de toque, navegação ou reação", () => {
    /* O critério não é importância: é "som só onde os olhos NÃO estão". Se a
       informação já está na tela que ela está olhando, o som é redundância — e
       redundância repetida é a definição de fadiga. */
    const proibidas =
      /toque|botao|botão|navegar|aba|curtir|reagir|salvar|publicar|rolar|atualizar|erro|validacao|validação/i;
    for (const e of TODAS)
      expect({ e, proibida: proibidas.test(e) }).toEqual({ e, proibida: false });
  });

  test("são seis espécies, e duas delas são alarme", () => {
    expect(TODAS.length).toBe(6);
    expect(ALARME.length).toBe(2);
  });

  test("⚠️ som de interface é SEMPRE Web Audio, nunca <audio>", () => {
    /* Elemento de mídia ignora o botão de silêncio do iPhone E faz a sessão de
       áudio escalar para `playback`, contaminando tudo que vier depois. */
    const fonte = readFileSync("src/lib/som-da-interface.ts", "utf8");
    expect(fonte).not.toContain("new Audio(");
    expect(fonte).not.toContain('createElement("audio")');
    expect(fonte).toContain("createOscillator");
  });
});
