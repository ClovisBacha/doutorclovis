/**
 * PAUSAR — e o que acontecia quando não dava.
 *
 * Duas coisas, e a segunda é a grave. A primeira: em dez minutos a campainha
 * toca, e só havia sair. A segunda: quando o app saía da tela, o iOS suspendia
 * o áudio sintetizado e congelava os relógios — a paciente voltava para uma
 * bolha imóvel, muda, com a barra parada, e nada dizia o que tinha acontecido.
 *
 * ⚠️ ESTES TESTES LEEM O FONTE, e isso tem um limite conhecido: eles cobram
 * que a régua esteja LIGADA, nunca que ela funcione. O que é comportamento vive
 * onde pode ser executado — `soundscapes.test.ts` roda o som com um
 * `AudioContext` de mentira, `pausa-da-sessao.test.ts` roda a régua de "posso
 * retomar?". Uma revisão adversarial mostrou por que isso importa: a primeira
 * versão deste arquivo continuava VERDE com o guarda do relógio apagado, porque
 * a mesma linha existia 370 linhas abaixo. Daí o `trecho()`: fatia entre dois
 * marcadores e ESTOURA se um deles sumir, em vez de medir o arquivo inteiro.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const arquivo = readFileSync("src/components/gestacao-path.tsx", "utf8");

/* Recortado na meditação: são quatro `close()` em `gestacao-path.tsx` (um por
   atividade), e `indexOf` pega o primeiro. */
const path = arquivo.slice(
  arquivo.indexOf("function MeditationBlock({"),
  arquivo.indexOf("function BondingBlock({"),
);

/** Fatia entre dois marcadores, gritando se qualquer um deles tiver sumido. */
function trecho(de: string, ate: string): string {
  const i = path.indexOf(de);
  if (i < 0) throw new Error(`marcador sumiu do fonte: ${de}`);
  const j = path.indexOf(ate, i + de.length);
  if (j < 0) throw new Error(`marcador sumiu do fonte: ${ate}`);
  return path.slice(i, j);
}

describe("a sessão para de verdade", () => {
  test("o relógio da respiração não corre pausado", () => {
    /* Sem isto a sessão continuaria respirando por trás do véu: ela voltaria
       do banheiro com três minutos a menos e nenhuma respiração feita. */
    const relogio = trecho("// Relógio da respiração", "}, [etapa, fase, ciclo, pausada]);");
    expect(relogio).toContain('if (etapa !== "sessao" || pausada) return;');
  });

  test("a barra de progresso congela junto", () => {
    /* Uma barra que continua andando com a sessão parada é a tela mentindo
       sobre quanto falta. */
    expect(path).toContain('transition: pausada ? "none" : `width ${CICLO_SEGS}s linear`,');
  });

  test("a bolha volta ao repouso, para a inspiração ter de onde crescer", () => {
    /* É a MESMA máquina do primeiro quadro da sessão (dois
       `requestAnimationFrame`). Uma segunda seria uma segunda chance de a
       transição não acontecer. */
    const bolha = trecho("const [respiroPronto, setRespiroPronto]", "const faseVisual");
    expect(bolha).toContain('if (etapa !== "sessao" || pausada) {');
    expect(bolha).toContain("setRespiroPronto(false);");
    expect(bolha).toContain("}, [etapa, pausada]);");
  });

  test("a voz cala e o som de fundo suspende", () => {
    const fn = trecho('function pausarSessao(motivo: "toque" | "fundo")', "async function retomar");
    expect(fn).toContain("audioRef.current?.pausar()");
    expect(fn).toContain("pararVoz()");
  });

  test("a tela deixa de ser segurada acesa", () => {
    /* Ela largou o celular na mesa de cabeceira; segurar a tela acesa numa
       sessão parada é bateria gasta pelo app inteiro. */
    const tela = trecho("return manterTelaAcesa();", "}, [etapa, pausada]);");
    expect(tela.length).toBeLessThan(200);
  });
});

describe("⚠️ o app saindo da tela pausa, e a tela DIZ que foi isso", () => {
  test("o ouvinte de visibilidade existe, pausa com motivo próprio e é removido", () => {
    const ouvinte = trecho("const aoTrocar = () => {", "}, [etapa, pausa]);");
    expect(ouvinte).toContain('if (document.hidden) pausarSessao("fundo");');
    expect(ouvinte).toContain('document.addEventListener("visibilitychange", aoTrocar);');
    expect(ouvinte).toContain('document.removeEventListener("visibilitychange", aoTrocar)');
  });

  test("o texto do véu separa os dois motivos", () => {
    /* "Por que parou?" é a pergunta que ela faria — e a resposta é o que
       impede que ela desconfie do aplicativo. */
    const veu = trecho('role="dialog"', "── 3. Fechamento");
    expect(veu).toContain('pausa === "fundo"');
    expect(veu).toContain("O app saiu da tela e a sessão parou aqui");
  });
});

describe("voltar", () => {
  const fn = () => trecho("async function retomarSessao()", "function close()");

  test("⚠️ a régua de retomar é conferida DUAS vezes — antes e depois da espera", () => {
    /* Entre o toque e a resposta do navegador cabem: fechar a folha, a sessão
       acabar, e sair do app. O ▶︎ da tela bloqueada chega COM a página
       escondida. Ver `pausa-da-sessao.ts`. */
    const corpo = fn();
    expect(corpo.match(/podeRetomar\(/g)?.length).toBe(2);
    expect(corpo).toContain("escondida: estaEscondida(), viva: vivaRef.current");
  });

  test("⚠️ o som recriado é o ATUAL, não o da closure do toque", () => {
    /* Ela pode ter silenciado enquanto o contexto voltava. */
    const corpo = fn();
    expect(corpo).toContain("const somAgora = somRef.current;");
    expect(corpo).toContain("createSoundscape(somAgora)");
  });

  test("a respiração recomeça do início, e o ciclo NÃO volta", () => {
    /* Recomeçar a fase custa 12 s; retomar no meio exigiria animar a bolha a
       partir de uma escala intermediária, que é o quadro que transição de CSS
       não sabe fazer. Já o `ciclo` voltar faria a barra andar para trás. */
    const corpo = fn();
    expect(corpo).toContain('setFase("in")');
    expect(corpo).not.toContain("setCiclo");
  });

  test("⚠️ a deixa do ciclo é DITA DE NOVO ao voltar", () => {
    /* `pararVoz()` cortou a fala no meio e o texto dela continua na tela: sem
       isto a frase ficaria escrita sem nunca ter sido falada. E "Inspire" só
       sairia quando a pausa tivesse caído fora da inspiração — o mesmo gesto
       com dois comportamentos. */
    expect(fn()).toContain("setRetomada((n) => n + 1)");
    expect(path).toContain("}, [etapa, voz, falaAgora?.id, pausada, retomada]);");
    expect(path).toContain(
      "}, [etapa, fase, voz, ciclo, plano?.palavrasAte, pausada, retomada, falaAgora?.id]);",
    );
  });

  test("sair e começar de novo sempre nascem despausados", () => {
    for (const [de, ate] of [
      ["function close()", "function trocarSom("],
      ["function begin(", "function encerrarGuardando()"],
      ["function encerrarGuardando()", "function pausarSessao(motivo"],
    ] as const) {
      expect({ de, limpa: trecho(de, ate).includes("setPausa(null)") }).toEqual({
        de,
        limpa: true,
      });
    }
  });
});

describe("o que continua alcançável com o véu no ar", () => {
  test("a faixa de cima fica ACIMA do véu", () => {
    /* O ✕ é a saída, e ele hoje GUARDA a sessão em vez de descartá-la. Coberto
       pelo véu, quem pausou para sair ficaria sem saída. */
    expect(path).toContain('<div className="relative z-30 flex items-center px-4 py-3">');
    expect(path).toContain('className="absolute inset-0 z-20 flex flex-col');
  });

  test("⚠️ e por isso trocar o som pausada NÃO começa a tocar", () => {
    /* 🔊 continua alcançável. Sem o guarda, silenciar e religar durante a pausa
       trazia o pad de volta em volume cheio por cima do véu. */
    const fn = trecho("function trocarSom(k: SoundscapeKey)", "function alternarVoz()");
    expect(fn).toContain('if (etapa === "sessao" && !pausada)');
    expect(fn).toContain("somRef.current = k;");
  });

  test("o véu oferece continuar e, passado o minuto, encerrar guardando", () => {
    const veu = trecho('role="dialog"', "── 3. Fechamento");
    expect(veu).toContain("void retomarSessao()");
    expect(veu).toContain("{ciclo >= UM_MINUTO && (");
    expect(veu).toContain("onClick={encerrarGuardando}");
  });

  test("⚠️ o leitor de tela não atravessa o véu", () => {
    /* O véu esconde do dedo, não do VoiceOver: sem isto, quem navega por gestos
       deslizava até a frase da sessão e até um SEGUNDO "Encerrar por aqui" —
       numa tela que diz estar parada. */
    expect(path).toContain("aria-hidden={pausada}");
    expect(path).toContain("{ciclo >= UM_MINUTO && !pausada && (");
    expect(path).toContain('aria-modal="true"');
  });
});

describe("o card do sistema", () => {
  test("as ações passam por ref, escrito num efeito", () => {
    /* Escrever no corpo do render faria os botões do sistema agirem sobre
       estado de um render que o React pode descartar. E trocar os handlers a
       cada pausa faria o card piscar no sistema operacional. */
    const bloco = trecho("const acoesDaMidia = useRef<", "}, [etapa, med.theme]);");
    expect(bloco).toContain("useEffect(() => {\n    acoesDaMidia.current = {");
    expect(bloco).toContain("aoPausar: () => acoesDaMidia.current.pausar(),");
  });

  test("o estado ▶︎/⏸ acompanha a pausa", () => {
    expect(path).toContain('estadoDaMidia(pausada ? "paused" : "playing");');
  });
});

describe("⚠️ uma voz de cada vez", () => {
  test("a palavra do compasso cala quando há instrução nesta respiração", () => {
    /* Era o defeito que o dono ouviu: "as frases estão se sobrepondo, e parece
       que algumas nem são lidas". Elas eram lidas — 191 de 191 têm áudio — mas
       com "Inspire" tocando por cima. Medido: 11 das 24 instruções de uma
       sessão de dez minutos, e TODAS as do primeiro minuto de qualquer sessão.

       Dois canais existem para uma fala não CORTAR a outra; não para as duas
       falarem juntas. */
    const bloco = trecho("As três palavras da respiração", "async function finish()");
    expect(bloco).toContain("if (falaAgora) return;");
  });

  test("o compasso vem de UMA fonte, e a tela não tem a sua", () => {
    /* Eram dois números que precisavam concordar — `CICLO = 12` no planejador
       e um `RESPIRO` próprio no componente — e nada obrigava isso. */
    /* Fora da fatia do componente: o compasso é declarado antes dele. */
    expect(arquivo).toContain("const CICLO_SEGS = CICLO;");
    expect(arquivo).not.toContain("const RESPIRO = {");
  });
});
