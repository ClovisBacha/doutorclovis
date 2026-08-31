/**
 * O MODO CUIDADO PRECISA VALER NOS QUATRO CAMINHOS.
 *
 * `buildClinicalBlock` foi consertado para que, em Modo Cuidado, a semana e o
 * trimestre nunca entrem no prompt. Uma varredura encontrou o conserto sendo
 * DESFEITO por quatro vizinhos:
 *
 *  1. A primeira bolha do chat, escrita pela TELA como se fosse a IA, abria com
 *     "Você está na semana 24". O servidor proibia e a tela anunciava.
 *  2. O bloco de MEMÓRIA reinjetava a gestação: o resumo é prosa construída
 *     sobre as conversas dela ("preocupada com o enxoval", "perguntou sobre o
 *     parto") e entrava sob o rótulo "fonte: sistema".
 *  3. O SUMARIZADOR que escreve esse resumo era instruído a manter "a memória
 *     de uma paciente gestante" — então o resumo renascia em termos de
 *     gestação a cada seis mensagens.
 *  4. A paciente SEM médico vinculado perdia o `clinicalBlock` inteiro — que
 *     estava calculado três linhas acima e era jogado fora. É o estado de
 *     entrada de toda paciente, e o estado de quem teve o acompanhamento
 *     encerrado.
 *
 * Uma proteção contornada por quatro caminhos não é uma proteção.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { memoryBlock } from "./chat-memory.server";
import { buildClinicalBlock } from "@/routes/api/chat";

const chat = readFileSync("src/routes/api/chat.ts", "utf8");
const tela = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");
const memoria = readFileSync("src/lib/chat-memory.server.ts", "utf8");

describe("1. a idade gestacional some da TELA INTEIRA, não de duas abas", () => {
  /**
   * ─── EU CONSERTEI QUINZE LUGARES MENOS ONZE ──────────────────────────────
   *
   * A primeira versão escondia a semana na saudação do Chat IA e da Nutrição, e
   * eu escrevi no commit que "eram as únicas duas abas que não recebiam
   * careMode". Era falso, e um verificador adversarial listou o resto: o
   * cabeçalho do desktop ("Acompanhando Lucas · 24s 3d") em cima de TODA aba;
   * o Diário — onde uma mulher em luto escreve — abrindo com "Semana 24 — 2º
   * trimestre"; a carteirinha de emergência com "GESTANTE", nome do bebê e IG;
   * o corpo inteiro da Nutrição; e o contexto que o cliente manda ao servidor.
   *
   * Gatear um por um sempre deixaria o décimo sexto. `gest` é a FONTE de todos:
   * nula em Modo Cuidado, cada `{gest && ...}` que já existe passa a fazer a
   * coisa certa sozinho.
   *
   * Estes testes valem sobre a fonte, e por isso não podem ser satisfeitos por
   * uma ocorrência solta em outro componente — que era o furo do teste antigo.
   */
  test("`gest` é nula em Modo Cuidado — a fonte, não os consumidores", () => {
    const i = tela.indexOf("const gest =");
    expect(i).toBeGreaterThan(-1);
    expect(tela.slice(i, i + 200)).toContain("profile && !careMode");
    expect(tela.slice(i, i + 200)).toContain("computeGestation({");
  });

  test("o nome do bebê some junto — `gest` nula não o tira", () => {
    /* "Acompanhando Lucas", sozinho, é pior que a semana. */
    expect(tela).toContain("{!careMode && (profile?.baby_name || gest) && (");
  });

  test("o contexto que o CLIENTE manda ao servidor também", () => {
    /* É a única coisa que o modelo sabe sobre ela quando o token expira e o
       `clinicalBlock` nem chega a ser calculado. */
    const i = tela.indexOf("function buildPatientContext");
    expect(i).toBeGreaterThan(-1);
    expect(tela.slice(i, i + 1400)).toContain("profile.baby_name && !emLuto");
  });
});

describe("2. a memória não reinjeta a gestação", () => {
  const RESUMO = "- preocupada com o enxoval\n- perguntou sobre o parto na semana 24";

  test("com Modo Cuidado, o bloco de memória some inteiro", () => {
    expect(memoryBlock(RESUMO, true)).toBe("");
  });

  test("sem Modo Cuidado, ele continua existindo", () => {
    /* O simétrico importa: uma proteção que apaga a memória de todo mundo teria
       passado no teste acima e destruído o recurso. */
    expect(memoryBlock(RESUMO, false)).toContain("Memória da paciente");
  });

  test("o padrão é NÃO suprimir — quem não sabe do luto não inventa", () => {
    /* `careMode` é opcional na assinatura. Se o padrão fosse `true`, qualquer
       chamador que esquecesse o argumento apagaria a memória em silêncio. */
    expect(memoryBlock(RESUMO)).toContain("Memória da paciente");
  });

  test("o chat passa o sinal — não adianta a função saber e ninguém contar", () => {
    expect(chat).toContain("memoryBlock(memorySummary, patient.careMode)");
  });
});

describe("3. o resumo para de ser escrito em termos de gestação", () => {
  /* O teste antigo conferia que as DUAS strings existiam no arquivo — e
     inverter o ternário (`!careMode ? "...PERDA..." : "...gestante..."`), que
     reintroduz o defeito para TODAS as pacientes de uma vez, mantinha as duas
     lá e o teste verde. Agora a ordem dentro do ternário é afirmada. */
  test("o ramo do luto é o do careMode VERDADEIRO", () => {
    const i = memoria.indexOf("          careMode");
    expect(i).toBeGreaterThan(-1);
    expect(memoria.slice(i, i + 200)).toContain("A GESTAÇÃO DELA TERMINOU EM PERDA");
  });

  test("e o ramo normal continua existindo para as outras", () => {
    expect(memoria).toContain("Você mantém a MEMÓRIA de uma paciente gestante");
  });

  test("e o chat o repassa", () => {
    expect(chat).toContain("persistFor.careMode");
  });
});

describe("4. a paciente sem médico vinculado mantém tudo", () => {
  const emLutoSemMedico = {
    care_mode: true,
    lmp_date: null,
    reference_date: "2026-08-01",
    reference_weeks: 24,
    reference_days: 0,
    pregnancy_number: 1,
  };

  test("o bloco clínico dela continua trazendo o Modo Cuidado", () => {
    expect(buildClinicalBlock(emLutoSemMedico)).toContain("MODO CUIDADO");
  });

  test("e o ramo sem vínculo passou a injetá-lo", () => {
    /* Ele estava calculado e era jogado fora: `clinicalBlock` só aparecia
       dentro do ramo com médico. */
    const i = chat.indexOf("} else if (patient) {");
    expect(i).toBeGreaterThan(-1);
    expect(chat.slice(i, i + 2600)).toContain("patient.clinicalBlock");
  });

  test("e a promessa impossível é cancelada", () => {
    /* `medicalSystemPrompt` manda "diga que registrou a pergunta para ele" — e
       não há "ele". Nenhuma lacuna é gravada neste caminho. */
    const i = chat.indexOf("} else if (patient) {");
    const janela = chat.slice(i, i + 2600);
    expect(janela).toContain("NÃO diga que registrou a pergunta");
  });
});

describe("5. o histórico não traz a conduta do consultório anterior", () => {
  test("sem médico, filtra por IS NULL — não deixa de filtrar", () => {
    /* Era `if (doctorId) q = q.eq(...)`, sem `else`. Depois de encerrar o
       acompanhamento vinham as 12 últimas mensagens de QUALQUER médico —
       respostas assinadas com a conduta dele, que o modelo lê como suas. */
    expect(memoria).toContain(
      'q = doctorId ? q.eq("doctor_id", doctorId) : q.is("doctor_id", null)',
    );
  });
});

describe("6. o servidor da Nutrição também sabe do luto", () => {
  /**
   * Eu tinha calado a SAUDAÇÃO da aba e deixado o servidor intacto: o
   * `NUTRITION_SYSTEM` manda "orientar gestantes" e "adaptar as orientações ao
   * trimestre". O mesmo defeito do Chat IA, com os papéis trocados — a tela
   * calava e o servidor anunciava, assim que ela digitasse a primeira palavra.
   */
  const nutricao = readFileSync("src/routes/api/nutrition.ts", "utf8");

  test("o perfil é lido com care_mode", () => {
    expect(nutricao).toContain('.select("doctor_id,care_mode")');
  });

  test("existe um prompt próprio para quem perdeu a gestação", () => {
    expect(nutricao).toContain("NUTRICAO_EM_LUTO");
    expect(nutricao).toContain("ESTÁ EM LUTO");
  });

  test("e é ELE que entra quando careMode é verdadeiro", () => {
    /* A ordem do ternário importa: invertida, todas as gestantes receberiam o
       prompt de luto e a paciente em luto receberia o de gestação. */
    expect(nutricao).toContain("careMode ? NUTRICAO_EM_LUTO : NUTRITION_SYSTEM");
  });

  test("alimentação continua sendo assunto — não vira silêncio", () => {
    /* Recuperação, anemia, leite que desceu: o luto não tira dela o direito à
       orientação nutricional. Suprimir tudo seria trocar um erro por outro. */
    expect(nutricao).toContain("recuperação depois da perda");
  });
});

describe("7. os avisos de cota e de plano não contradizem o luto", () => {
  /**
   * Os dois entram no MESMO system prompt que o bloco de Modo Cuidado — que
   * proíbe falar em gestação — e diziam "o acompanhamento da GESTAÇÃO segue
   * normalmente", com o rótulo IMPORTANTE. Duas instruções contraditórias no
   * mesmo prompt, e a marcada como importante ganha. Bastava a cota estourar
   * ou o plano vencer, que são estados comuns.
   */
  test("a frase é montada conforme o estado dela", () => {
    expect(chat).toContain("const seguirAcompanhamento = patient.careMode");
  });

  test("em Modo Cuidado, o acompanhamento é com o MÉDICO, não da gestação", () => {
    const i = chat.indexOf("const seguirAcompanhamento");
    expect(chat.slice(i, i + 300)).toContain("O acompanhamento com ${medico} segue normalmente");
  });

  test("os dois avisos usam a frase montada, não a fixa", () => {
    const i = chat.indexOf("const avisoDeCota");
    const j = chat.indexOf("const avisoSemPlano");
    expect(chat.slice(i, i + 400)).toContain("${seguirAcompanhamento}");
    expect(chat.slice(j, j + 400)).toContain("${seguirAcompanhamento}");
  });

  test('nenhum deles diz "informação obstétrica" a quem perdeu a gestação', () => {
    /* Trocado por "informação consolidada", com a ordem explícita de respeitar
       o contexto clínico acima — que é onde o Modo Cuidado vive. */
    const i = chat.indexOf("const avisoDeCota");
    expect(chat.slice(i, i + 900)).toContain("respeitando integralmente o contexto clínico acima");
  });
});

describe("8. os dois últimos vizinhos", () => {
  test("a lista de urgência não menciona o bebê em Modo Cuidado", () => {
    /* Sangramento é o sintoma mais provável de quem acabou de sofrer uma perda,
       e o bloco de Modo Cuidado manda tratá-lo. A instrução de urgência que a
       IA cita ao responder sobre sangramento vinha emparelhada com "redução dos
       movimentos do bebê". Os sinais continuam os mesmos; o que sai é a
       menção. */
    /* A lista foi EXTRAÍDA para `sinaisDeUrgencia`, porque o aviso de cota
       passou a precisar dela e uma segunda cópia seria uma segunda régua
       clínica — o que o CLAUDE.md proíbe. A asserção acompanha a fonte. */
    const i = chat.indexOf("export function sinaisDeUrgencia(");
    expect(i).toBeGreaterThan(-1);
    const janela = chat.slice(i, i + 400);
    expect(janela).toContain("sangramento intenso, dor intensa, febre, pressão muito alta");
    expect(janela).toContain("redução dos movimentos do bebê"); // o ramo normal
    /* E a ordem do ternário: invertida, a paciente em luto ouviria falar do
       bebê e a gestante não. */
    expect(janela).toContain('careMode\n    ? "sangramento intenso');
  });

  test("o bloco de pendências some — a porta ao lado da memória", () => {
    /* A memória foi apagada inteira com o argumento de que não dá para saber
       quais linhas falam da gestação. Este bloco cita, ENTRE ASPAS e sob rótulo
       de fonte confiável, as perguntas que ela fez antes da perda. */
    const i = chat.indexOf("async function buildPendenciasBlock");
    expect(chat.slice(i, i + 1200)).toContain('if (careMode) return "";');
  });
});

/**
 * ⚠️ O PORTAL PÓS-PARTO — o pior lugar do app para o Modo Cuidado faltar.
 *
 * `setCareMode` grava `care_mode` e **não limpa `birth_date`**. Numa perda
 * DEPOIS do nascimento (natimorto, óbito neonatal), a data está preenchida e o
 * Portal abria inteiro: *"Helena nasceu! 3 semanas de vida"*, com o convite a
 * marcar o primeiro sorriso e o calendário de 24 vacinas de um bebê que morreu.
 * A aba era a ÚNICA da lista sem a prop — as quatro vizinhas já recebiam.
 *
 * ⚠️ **E ESTE TESTE COBRA AS DUAS METADES, porque o conserto óbvio é o defeito
 * oposto.** Esconder a aba tiraria dela justamente as duas coisas que importam
 * MAIS depois de uma perda: a **EPDS** (cuja décima pergunta é ideação de
 * autolesão, no momento de risco máximo de depressão perinatal) e o
 * **Retorno** (a consulta de puerpério, onde hemorragia, infecção e
 * pré-eclâmpsia de pós-parto são pegas). O corpo dela passou pelo parto do
 * mesmo jeito.
 */
describe("o Portal Pós-parto no Modo Cuidado", () => {
  const PORTAL = (() => {
    const i = tela.indexOf("function PosPartoTab(");
    expect(i).toBeGreaterThan(-1);
    const j = tela.indexOf("\nfunction ", i + 1);
    return tela.slice(i, j === -1 ? undefined : j);
  })();

  test("⚠️ a aba recebe a bandeira", () => {
    expect(tela).toMatch(/<PosPartoTab[\s\S]{0,120}careMode=\{careMode\}/);
    expect(PORTAL).toMatch(/careMode/);
  });

  test("⚠️ as três abas do bebê saem — fita E corpo", () => {
    /* A fita, para ela não ver o convite; o corpo, porque outras abas deste
       arquivo já ganharam `initialSub` e uma sub-tela inicial acrescentada
       amanhã abriria "Marcos" por link, sem passar pela fita. */
    for (const sub of ["amamentação", "marcos", "vacinas"]) {
      expect(PORTAL).toContain(`{!careMode && subTab === "${sub}"`);
    }
  });

  test("⚠️ Bem-estar (EPDS) e Retorno FICAM — o Modo Cuidado não desliga cuidado", () => {
    /* A metade que impede o conserto de virar o defeito oposto. As duas
       precisam continuar alcançáveis pela fita no luto. */
    /* ⚠️ O RAMO DO LUTO, e só ele. A primeira versão cortava no `];`, que é o
       fim da EXPRESSÃO inteira — então o `noLuto` continha as duas listas e o
       teste passava sobre um ramo que ainda oferecia "Marcos". O corte é o
       `: [` do ramo de quem não está em luto. */
    const i = PORTAL.indexOf("const subTabs");
    expect(i).toBeGreaterThan(-1);
    const j = PORTAL.indexOf("\n    : [", i);
    expect(j).toBeGreaterThan(i);
    const noLuto = PORTAL.slice(i, j);
    expect(noLuto).toContain('key: "saúde"');
    expect(noLuto).toContain('key: "retorno"');
    expect(noLuto).not.toContain('key: "marcos"');
    expect(noLuto).not.toContain('key: "vacinas"');
  });

  test("⚠️ o cabeçalho deixa de anunciar um nascimento", () => {
    const i = PORTAL.indexOf("{careMode ? (");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(PORTAL.indexOf("nasceu!"));
  });
});
