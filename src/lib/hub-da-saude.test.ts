/**
 * A GRADE DA ABA SAÚDE — o que está nela e o que não está.
 *
 * Este arquivo existe porque a aba se chamava Saúde e as duas ferramentas de
 * automonitoramento com mais peso clínico da gestação estavam FORA dela:
 * contar movimentos do bebê e cronometrar contrações moravam em Registros,
 * dentro do grupo Gestação.
 *
 * O que torna isso um defeito, e não arrumação: a triagem de sintomas mora na
 * aba Saúde e cita as duas pelo nome. "Redução dos movimentos do bebê" e
 * "contrações regulares antes de 37 semanas" são dois dos nove sintomas
 * VERMELHOS de `src/lib/triage.ts`. Uma paciente que sente o bebê parado abria
 * Saúde, encontrava a pergunta, e não tinha como contar dali.
 *
 * O teste cobra o VÍNCULO entre as duas coisas — ele lê a lista de sintomas
 * vermelhos de verdade. Se um dia alguém tirar o atalho de chutes da grade, ou
 * mudar o texto do sintoma sem perceber, aqui reprova.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { RED_SYMPTOMS } from "./triage";

const conta = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

/** O bloco do `HUB_SAUDE`, do abre-colchete até o fecha. */
const gradeDaSaude = (() => {
  const i = conta.indexOf("const HUB_SAUDE: LadrilhoDaSaude[] = [");
  expect(i).toBeGreaterThan(-1);
  const fim = conta.indexOf("\n];", i);
  return conta.slice(i, fim);
})();

describe("o que a grade da Saúde oferece", () => {
  test("os dois sintomas vermelhos que pedem uma FERRAMENTA têm atalho na grade", () => {
    /* Sete dos nove sintomas vermelhos são "ligue agora": não há o que a
       paciente possa medir sozinha sobre convulsão ou perda de líquido. Dois
       têm ferramenta no app, e é por isso que só esses dois são cobrados. */
    /* Falhar aqui quer dizer que o SINTOMA saiu da triagem — e aí o atalho na
       grade perde a razão de existir, não o contrário. */
    const movimentos = RED_SYMPTOMS.find((s) => /movimentos do bebê/i.test(s.label));
    const contracoes = RED_SYMPTOMS.find((s) => /contrações/i.test(s.label));
    expect(movimentos).toBeTruthy();
    expect(contracoes).toBeTruthy();

    expect(gradeDaSaude).toContain('key: "chutes"');
    expect(gradeDaSaude).toContain('key: "contracoes"');
  });

  test("os atalhos abrem a tela REAL, e não uma cópia", () => {
    /* Duas implementações de contagem de chutes divergiriam no primeiro
       conserto. Os ladrilhos apontam para `Registros` com a sub-tela. */
    expect(gradeDaSaude).toContain('destino: "Registros"');
    expect(gradeDaSaude).toContain('subDestino: "chutes"');
    expect(gradeDaSaude).toContain('subDestino: "contracoes"');
  });

  test("todo ladrilho declara para onde vai", () => {
    /* Sem `destino`, o `find` do `HubSaude` devolve o item e o toque não faz
       nada — um quadrado que promete uma tela e não abre nada. */
    const ladrilhos = gradeDaSaude.split(/\n {2}\{/).slice(1);
    /* Cinco na lista: quatro na gestação (Saúde da mulher sai de cena) e o
       quinto fora dela. Eram sete; Alertas e Bem-estar saíram a pedido do
       dono — os nove sintomas vermelhos continuam no SOS, e os momentos de
       bem-estar têm implementação própria no Caminho. */
    expect(ladrilhos.length).toBe(5);
    const semDestino = ladrilhos.filter((l) => !/destino: "/.test(l));
    /* A lista dos culpados entra na mensagem de falha: "esperava 0, veio 1"
       mandaria a próxima pessoa procurar qual dos sete é. */
    expect(semDestino.map((l) => /key: "([^"]+)"/.exec(l)?.[1] ?? "?")).toEqual([]);
  });

  test("o bloco de wearable não voltou", () => {
    /* SpO₂, frequência, passos e sono digitados à mão do Apple Health: nenhum
       muda conduta obstétrica, e o guia antigo admitia que "a integração
       automática requer aplicativo nativo". Trabalho da paciente, decisão de
       ninguém. O que fica proibido é PEDIR de novo — as colunas seguem no
       banco e os valores antigos continuam à mostra na lista de correção. */
    expect(conta).not.toContain("Adicionar dados do wearable");
    expect(conta).not.toContain("Como sincronizar com seu dispositivo");
    expect(conta).not.toContain('label="SpO₂ (%)"');
  });

  test("a lista de registros continua tendo como APAGAR", () => {
    /* Ela recolheu para deixar de ser a terceira cópia dos mesmos números na
       mesma tela, mas o × é o único jeito de corrigir quem digitou 1200 em vez
       de 120 — e o painel do médico pinta a gravidade desses números. */
    expect(conta).toContain("Ver e corrigir meus registros");
    expect(conta).toContain('aria-label="Apagar este registro"');
  });
});
