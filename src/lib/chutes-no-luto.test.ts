/**
 * NO MODO CUIDADO, O CONVITE A CONTAR CHUTES SAI DA TELA.
 *
 * ⚠️ Depois do batimento, o contador de movimentos é a tela mais dolorosa do
 * app para quem acabou de perder a gestação: ele convida, com o nome do bebê,
 * a "contar 10 movimentos". A aba já se calava por dentro (`SilencioDoCuidado`),
 * mas as DUAS portas continuavam desenhando o ladrilho "Chutes · Contar os
 * movimentos" — o convite acontecia antes do toque.
 *
 * ⚠️ E o CRONÔMETRO DE CONTRAÇÕES FICA, de propósito, nas duas grades: quem
 * perdeu a gestação pode estar em trabalho de parto. É a mesma linha que o
 * comentário de `contracoes-tab.tsx` já defende, e a mesma que mantém o SOS
 * aceso: o Modo Cuidado faz o app parar de FALAR DO BEBÊ, nunca de socorrer.
 *
 * ⚠️ E o HISTÓRICO dela não é apagado — é a memória dela, a mesma decisão que
 * manteve `exam_files` e o Álbum de pé quando o envio de exames saiu.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
/**
 * ⚠️ O HUB saiu de `minha-conta.tsx` para cá (set/2026) — ele era `export
 * function` num arquivo de ROTA, e isso o içava para o pedaço de ENTRADA.
 * O filtro do luto foi junto, e as asserções seguiram o CAMINHO: as duas
 * negativas abaixo teriam ficado CEGAS lendo só a conta, verdes sobre um
 * arquivo que já não contém o código que elas proíbem.
 */
const HUB = semComentarios(readFileSync("src/components/hub-saude.tsx", "utf8"));
/** As duas juntas — a proibição de tirar Contrações vale nos DOIS arquivos. */
const CONTA_E_HUB = CONTA + "\n" + HUB;

describe("⚠️ as duas grades tiram o ladrilho de Chutes no luto", () => {
  test("o hub da Saúde", () => {
    expect(HUB).toMatch(/HUB_SAUDE\.filter\(\(i\) => !\(careMode && i\.key === "chutes"\)\)/);
    /* E ele RECEBE o estado — sem a prop, o filtro seria código morto. */
    expect(CONTA).toMatch(/<HubSaude\s+careMode=\{careMode\}/);
  });

  test("a grade de Registros", () => {
    expect(CONTA).toMatch(
      /REGISTROS_SUBTABS\.filter\(\(i\) => !\(careMode && i\.key === "chutes"\)\)/,
    );
  });

  test("⚠️ e NENHUMA das duas tira Contrações", () => {
    /* Tirar o cronômetro seria trocar um defeito por outro pior: quem perdeu a
       gestação pode estar em trabalho de parto. */
    expect(CONTA_E_HUB).not.toContain('careMode && i.key === "contracoes"');
    expect(CONTA_E_HUB).not.toContain('i.key !== "contracoes"');
  });

  test("⚠️ e a aba continua se calando POR DENTRO — o ladrilho não é a única defesa", () => {
    /* A porta pode ser alcançada por deep link (`initialSub`), e o portão de
       dentro é o que segura isso. */
    const chutes = semComentarios(readFileSync("src/components/kicks-tab.tsx", "utf8"));
    expect(chutes).toContain("if (careMode) return <SilencioDoCuidado");
  });
});
