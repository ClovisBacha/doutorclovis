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
  prioridadeDe,
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

  test("⚠️ o portão do luto é fechado POR PADRÃO no runtime", () => {
    /* A régua é pura e recebe `careMode`; quem o fornece é o runtime. E lá ele
       deixou de depender de cada ponto de chamada passar à mão — o carimbo
       (`carimbarModoCuidado`) é lido quando ninguém passa nada.

       Isso importa porque há um caminho onde passar é IMPOSSÍVEL:
       `creditarSementinhas` é o funil de dezessete pontos de concessão, num
       módulo que de propósito não importa nada. A moeda tocaria sem saber do
       luto. */
    const fonte = readFileSync("src/lib/tocar-som-de-ui.ts", "utf8");
    expect(fonte).toContain("export function carimbarModoCuidado");
    /* ⚠️ `?? lutoAtual`, e nunca `!!o?.careMode`: o primeiro herda o estado
       real quando ninguém passa; o segundo herda `false`, que é o portão
       ABERTO. */
    expect(fonte).toContain("careMode: o?.careMode ?? lutoAtual");
    expect(fonte).not.toContain("careMode: !!o?.careMode");
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

  test("⚠️ a festa pode ser SILENCIADA — mas não por omissão", () => {
    /* A tensão real: a comemoração já existia e já tocava, então aplicar o
       padrão desligado a ela seria TIRAR uma coisa do app. Mas ser impossível
       de silenciar também é defeito — era o único som que a paciente não
       conseguia desligar de jeito nenhum.

       A régua separa "não escolheu" de "escolheu desligar": quem nunca mexeu
       recebe `completo` e ouve; quem tocou em "Não" recebe `desligado` e não. */
    expect(podeSoar("conquista", { ...NORMAL, nivel: "completo" })).toBe(true);
    expect(podeSoar("trofeu", { ...NORMAL, nivel: "completo" })).toBe(true);
    expect(podeSoar("conquista", { ...NORMAL, nivel: "desligado" })).toBe(false);
    expect(podeSoar("trofeu", { ...NORMAL, nivel: "desligado" })).toBe(false);
    /* E o alarme atravessa as duas escolhas. */
    expect(podeSoar("sos", { ...NORMAL, nivel: "desligado" })).toBe(true);
  });

  test("⚠️ o alarme não tem teto — ela pode passar mal duas vezes no mesmo dia", () => {
    expect(TETO_POR_DIA.sos).toBeUndefined();
    expect(podeSoar("sos", { ...NORMAL, jaTocouHoje: 99 })).toBe(true);
  });
});

describe("⚠️ a regra da vez — o fechamento do dia disparava TRÊS sons", () => {
  /* Ao fechar o dia com cinco estrelas o app dispara o chime na hora, a moeda
     quando o servidor confirma o bônus, e o troféu quando a carteira volta. Os
     três são separados só pela LATÊNCIA DA REDE — num wi-fi bom eles se
     atropelam, e o momento mais bonito do jogo vira caixa registradora.

     Um teto por espécie não pega isso: cada um está dentro do seu limite. */

  test("a moeda cala depois da conquista", () => {
    expect(podeSoar("moeda", { ...NORMAL, ultimaEspecie: "conquista", desdeOUltimo: 300 })).toBe(
      false,
    );
  });

  test("⚠️ mas o TROFÉU passa por cima da conquista — ele é o maior", () => {
    /* Se a régua fosse "o primeiro cala todos", o troféu — que é o clímax e a
       única animação de 5,5 s do app — seria engolido pelo chime que veio um
       segundo antes. A prioridade existe para isso. */
    expect(podeSoar("trofeu", { ...NORMAL, ultimaEspecie: "conquista", desdeOUltimo: 300 })).toBe(
      true,
    );
  });

  test("o alarme passa por cima de tudo, sempre", () => {
    for (const antes of TODAS) {
      expect(podeSoar("sos", { ...NORMAL, ultimaEspecie: antes, desdeOUltimo: 10 })).toBe(true);
    }
  });

  test("passada a janela, o som volta a caber", () => {
    expect(podeSoar("moeda", { ...NORMAL, ultimaEspecie: "conquista", desdeOUltimo: 2000 })).toBe(
      true,
    );
  });

  test("⚠️ e o mesmo som NÃO toca duas vezes seguidas dentro da janela", () => {
    /* `<=` e não `<`: prioridade igual também cala. Dois "guardado" em meio
       segundo é o mesmo gesto contado duas vezes. */
    expect(podeSoar("guardado", { ...NORMAL, ultimaEspecie: "guardado", desdeOUltimo: 400 })).toBe(
      false,
    );
  });

  test("a ordem da prioridade é a que a prosa declara", () => {
    const p = prioridadeDe;
    expect(p("sos")).toBeGreaterThan(p("trofeu"));
    expect(p("trofeu")).toBeGreaterThan(p("conquista"));
    expect(p("conquista")).toBeGreaterThan(p("fim"));
    expect(p("fim")).toBeGreaterThan(p("guardado"));
    expect(p("guardado")).toBeGreaterThan(p("compasso"));
    expect(p("compasso")).toBeGreaterThan(p("moeda"));
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

  test("⚠️ o que separa o alarme é o BRILHO, não o fundamental", () => {
    /* A primeira redação da prosa dizia que o SOS era "o único acima do teto de
       1100 Hz". A foto da bancada desmentiu: as notas dele são 432 e 864 Hz,
       abaixo do teto. Quem atravessa a faixa reservada é o CORTE do filtro. */
    for (const e of ALARME) {
      expect({ e, brilhante: DESENHOS[e].corte > TETO_HZ }).toEqual({ e, brilhante: true });
    }
  });

  test("⚠️ a faixa do ALARME é reservada — nenhum som de interface entra nela", () => {
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

  test("são dez espécies, e duas delas são alarme", () => {
    /* ⚠️ O número está travado de propósito: a lista é FECHADA, e cada entrada
       teve de justificar por escrito por que os olhos não estão nela. Uma
       espécie nova reprova aqui e obriga quem a acrescentou a escrever a razão
       — que é o único jeito de a lista não virar "som em tudo". */
    expect(TODAS.length).toBe(10);
    expect(ALARME.length).toBe(2);
  });

  test("⚠️ tudo que repete muitas vezes por dia tem TETO", () => {
    /* A moeda é a mais exposta: ela cai na aula, nas quatro atividades, no
       fechamento do dia, no bônus da dupla, no presente e na conquista — seis
       ou mais vezes por dia. Sem teto o app vira caixa registradora, e a décima
       moeda não acrescenta nada à nona. */
    for (const e of ["conquista", "trofeu", "moeda", "guardado", "acerto"] as EspecieDeSom[]) {
      expect({ e, tem: (TETO_POR_DIA[e] ?? 0) > 0 }).toEqual({ e, tem: true });
    }
    /* E o alarme NUNCA tem teto — ela pode passar mal duas vezes no mesmo dia. */
    for (const e of ALARME) expect(TETO_POR_DIA[e]).toBeUndefined();
  });

  test("⚠️ o guardado DESCE em relação ao compasso — guardar é fechar", () => {
    /* Se subisse, leria como "conseguiu!" — e a paciente que escreveu uma
       gratidão num dia difícil não conseguiu nada. Ela guardou. */
    expect(DESENHOS.guardado.passos[0].hz).toBeGreaterThan(DESENHOS.compasso.passos[0].hz);
    expect(DESENHOS.guardado.corte).toBeLessThan(DESENHOS.conquista.corte);
  });

  test("⚠️ o troféu é mais LENTO que a conquista — a animação dura 5,5 s", () => {
    /* Um arpejo rápido acabaria antes do desenho e deixaria os últimos quatro
       segundos em silêncio, que é o defeito que ele veio consertar. */
    const dur = (e: EspecieDeSom) => Math.max(...DESENHOS[e].passos.map((p) => p.em + p.dur));
    expect(dur("trofeu")).toBeGreaterThan(dur("conquista"));
  });

  test("⚠️ o som maior CORTA o menor — não soa por cima dele", () => {
    /* A régua da vez cala o menos importante que chega depois. O caso inverso
       não estava resolvido: o mais importante chegando 5 ms depois passava, e os
       dois soavam JUNTOS. Medido nos pares reais do app — guardado → conquista
       com 275 ms sobrepostos, fim → conquista com 245, moeda → conquista com
       128. E o do meio é estrutural: `finish()` chama `onEarn()` antes de
       qualquer `await`, então os dois saem no MESMO tick do JavaScript.

       O conserto é roubo de voz, que é o que todo sintetizador faz. */
    const fonte = readFileSync("src/lib/som-da-interface.ts", "utf8");
    expect(fonte).toContain("function roubarAVez");
    /* Ele desce em rampa e não corta seco — corte seco é o clique clássico. */
    const corpo = fonte.slice(fonte.indexOf("function roubarAVez"));
    expect(corpo.slice(0, 600)).toContain("linearRampToValueAtTime(0.0001");
    /* E os DOIS sintetizadores o chamam: `desenhar` e `tocarConquista`. */
    expect(fonte.split("roubarAVez(ctx)").length - 1).toBe(2);
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
