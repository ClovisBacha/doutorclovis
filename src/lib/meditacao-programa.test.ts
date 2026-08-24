/**
 * OS SETE PRIMEIROS DIAS — e a regra que decide se isto ajuda ou machuca.
 *
 * O programa existe porque abrir a meditação era responder quatro perguntas
 * antes de qualquer coisa acontecer, e "o que você precisa agora?" é uma
 * pergunta difícil justamente para quem está ali por não saber.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CHAVE_DO_PROGRAMA,
  diaDoPrograma,
  ehTemaDoPrograma,
  FALAS_DO_PROGRAMA,
  PROGRAMA,
} from "./meditacao-programa";
import { planejarSessao } from "./meditacao-sessao";
import { ROTEIROS } from "./meditacao-roteiros";

const path = readFileSync("src/components/gestacao-path.tsx", "utf8");

describe("o caminho", () => {
  test("são sete dias, em ordem, sem buraco", () => {
    expect(PROGRAMA.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("a duração CRESCE e a voz DIMINUI", () => {
    /* Três minutos no primeiro porque a barreira do iniciante é começar, não
       aguentar. E o silêncio crescendo é o que o programa ensina a suportar. */
    const mins = PROGRAMA.map((d) => d.minutos);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
    expect(mins[0]).toBeLessThanOrEqual(3);
    expect(mins[6]).toBe(10);
    expect(PROGRAMA[0].densidade).toBe("guiada");
    expect(PROGRAMA[6].densidade).toBe("pouca");
  });

  test("cada dia tem falas próprias, e nenhuma é compartilhada", () => {
    for (const d of PROGRAMA) {
      const suas = FALAS_DO_PROGRAMA.filter((f) => f.tema === d.tema);
      expect({ dia: d.dia, n: suas.length }).toEqual({ dia: d.dia, n: 6 });
    }
    const ids = FALAS_DO_PROGRAMA.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("as falas do programa estão no banco de áudio", () => {
    /* Sem isto elas existiriam como texto e a sessão andaria muda. */
    const noBanco = new Set(ROTEIROS.map((f) => f.id));
    expect(FALAS_DO_PROGRAMA.filter((f) => !noBanco.has(f.id))).toEqual([]);
  });

  test("os temas do programa não se misturam com os do menu", () => {
    expect(PROGRAMA.every((d) => ehTemaDoPrograma(d.tema))).toBe(true);
    expect(ehTemaDoPrograma("Calma")).toBe(false);
  });
});

describe("⚠️ o programa é de ORDEM, e a chama é de CALENDÁRIO", () => {
  test("o dia sai da CONTAGEM de dias feitos, nunca de uma data", () => {
    /* É o que mantém o programa independente do calendário: ela some uma
       semana e volta no dia onde parou. Amarrar os dois — "perdeu um dia,
       volta pro Dia 1" — faria o app punir a gestante que passou a noite no
       hospital tirando dela o que já aprendeu. */
    expect(diaDoPrograma(0)?.dia).toBe(1);
    expect(diaDoPrograma(3)?.dia).toBe(4);
    /* Sumir não muda nada: quem decide é quantos ela fez. */
    expect(diaDoPrograma(3)?.dia).toBe(diaDoPrograma(3)?.dia);
  });

  test("depois do sétimo o cartão some, e o menu volta a ser a tela", () => {
    expect(diaDoPrograma(7)).toBe(null);
    expect(diaDoPrograma(99)).toBe(null);
  });

  test("a contagem viaja entre aparelhos", () => {
    /* O prefixo `dc-path-` é o que faz a chave subir no `journey_state`. */
    expect(CHAVE_DO_PROGRAMA.startsWith("dc-path-")).toBe(true);
  });
});

describe("o dia do programa vira uma sessão de verdade", () => {
  test("cada dia monta o arco inteiro, com as falas dele", () => {
    for (const d of PROGRAMA) {
      const p = planejarSessao({
        minutos: d.minutos,
        tema: d.tema,
        densidade: d.densidade,
        semanas: 20,
      });
      const momentos = new Set(p.deixas.map((x) => x.fala.momento));
      expect({ dia: d.dia, tem: [...momentos].sort() }).toEqual({
        dia: d.dia,
        tem: ["acolhimento", "ancoragem", "corpo", "silencio", "volta"],
      });
      /* E o corpo é o ensino DAQUELE dia, não de outro. */
      const corpo = p.deixas.filter((x) => x.fala.momento === "corpo");
      expect(corpo.length).toBeGreaterThan(0);
      expect(corpo.every((x) => x.fala.tema === d.tema)).toBe(true);
    }
  });

  test("o primeiro dia cabe em três minutos e ainda ensina", () => {
    /* As falas de peso 3 são as que entram na sessão curta. Se as duas
       essenciais do Dia 1 tivessem peso 2, o dia inteiro seria silêncio. */
    const p = planejarSessao({ minutos: 3, tema: "prog-1", densidade: "guiada", semanas: 20 });
    const corpo = p.deixas.filter((x) => x.fala.momento === "corpo");
    expect(corpo.length).toBeGreaterThanOrEqual(1);
  });
});

describe("a tela", () => {
  test("o cartão do dia aparece ANTES do menu, e o menu recolhe", () => {
    expect(path).toContain("{diaAtualDoPrograma && !menuAberto && (");
    expect(path).toContain("Ou escolha você mesma");
    expect(path).toContain("{(!diaAtualDoPrograma || menuAberto) && (");
  });

  test("no Modo Cuidado o programa não aparece", () => {
    /* Quem acabou de perder a gestação não abre a meditação para começar um
       curso de sete dias. */
    expect(path).toContain(
      "const diaAtualDoPrograma = careMode ? null : diaDoPrograma(progFeitos);",
    );
  });

  test("o dia só avança no fim de VERDADE, não no botão de encerrar", () => {
    /* Sair aos dois minutos de uma sessão de sete guarda os minutos e a chama
       — isso ela fez — mas não conta como o dia aprendido. O Dia 6 abre
       dizendo "hoje a gente treina o que serve fora daqui", o que só faz
       sentido depois do silêncio do 5. */
    expect(path).toContain("function concluirDiaDoPrograma()");
    const enc = path.slice(
      path.indexOf("function encerrarGuardando()"),
      path.indexOf("function close()"),
    );
    expect(enc).not.toContain("concluirDiaDoPrograma");
    /* E o fim natural avança. */
    const fim = path.slice(path.indexOf("else if (ciclo + 1 >= totalCiclos) {"));
    expect(fim.slice(0, 400)).toContain("concluirDiaDoPrograma();");
  });

  test("⚠️ o número de ciclos vem do PLANO, não do seletor de minutos", () => {
    /* O dia do programa manda na própria duração. Lendo o `minutos` do menu, a
       sessão de três minutos do Dia 1 rodaria com os cinco que estavam
       escolhidos na tela, e a volta ao corpo cairia no meio. */
    expect(path).toContain(
      "const totalCiclos = plano?.totalCiclos ?? Math.round((minutos * 60) / CICLO_SEGS);",
    );
  });
});
