/**
 * O PRESENTE PRECISA CHEGAR — e até hoje ele não chegava.
 *
 * ─── O DEFEITO ─────────────────────────────────────────────────────────────
 *
 * O médico presenteava, `presentearPaciente` gravava a linha no ledger, a
 * mesada dele descia, o botão dizia "Enviado ✓" e o saldo dela subia. Tudo
 * certo — menos a única coisa que importava: **nada, em canto nenhum do app
 * dela, dizia que aquilo tinha acontecido.**
 *
 * Do lado de quem dá o recurso parecia inteiro. Do lado de quem recebe, um
 * saldo que sobe sozinho é indistinguível de bug. O desenho da mesada (ele dá,
 * ela vê que foi ELE, ela volta) morria no silêncio, e o dono só descobriu
 * porque foi conferir na conta da paciente e não achou nada.
 *
 * A economia inteira tinha teste; a ENTREGA não tinha nenhum. É a mesma
 * armadilha de `bonus-e-mesada.test.ts`: prova-se a função extraída e nunca o
 * caminho até os olhos de quem recebe.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  RAZAO_PRESENTE_AMIGA,
  RAZAO_PRESENTE_MEDICO,
  chaveDoPresente,
  prefixoDosPresentes,
  quemJaRecebeu,
} from "./economia-sementinhas";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const sementinhas = semComentarios("src/lib/sementinhas.functions.ts");
const mesada = semComentarios("src/lib/mesada.functions.ts");
const jogo = semComentarios("src/components/gestacao-path.tsx");
const cartao = semComentarios("src/components/mesada-do-medico.tsx");

describe("a chave do presente tem um dono só", () => {
  test("construtor e prefixo do LIKE concordam", () => {
    /* Era esta a divergência possível: o construtor numa linha e o `LIKE`
       escrito à mão três linhas acima. Se os dois deixarem de casar, a mesada
       conta zero gasto e o médico distribui sem teto. */
    const k = chaveDoPresente("med-1", "pac-9", "2026-08");
    const prefixo = prefixoDosPresentes("med-1").replace(/%$/, "");
    expect(k.startsWith(prefixo)).toBe(true);
  });

  test("quemJaRecebeu tira a paciente do meio, não o ciclo", () => {
    expect(quemJaRecebeu([chaveDoPresente("med-1", "pac-9", "2026-08")])).toEqual(["pac-9"]);
  });

  test("chave torta é descartada, nunca vira id inventado", () => {
    /* Um id errado aqui desabilitaria o botão de uma paciente que nunca ganhou
       nada — silencioso, e do lado ruim do erro. */
    expect(
      quemJaRecebeu(["presente:med-1:pac-9", "checkin:2026-08-11", "", null, undefined]),
    ).toEqual([]);
  });

  test("a mesma paciente duas vezes conta uma", () => {
    expect(
      quemJaRecebeu([
        chaveDoPresente("m", "p", "2026-07"),
        chaveDoPresente("m", "p", "2026-08"),
        chaveDoPresente("m", "outra", "2026-08"),
      ]).sort(),
    ).toEqual(["outra", "p"]);
  });

  test("a razão não é escrita à mão em lugar nenhum", () => {
    /* Duas cópias da string divergem em silêncio: a mesada contaria de volta
       linhas que o ledger gravou com outro rótulo. */
    expect(mesada).not.toContain(`"${RAZAO_PRESENTE_MEDICO}"`);
    expect(sementinhas).not.toContain(`"${RAZAO_PRESENTE_MEDICO}"`);
    expect(sementinhas).not.toContain(`"${RAZAO_PRESENTE_AMIGA}"`);
  });
});

describe("a carteira dela entrega o presente para a tela", () => {
  test("walletPayload devolve `presente`", () => {
    /* Sem este campo, nenhuma tela tem como saber que o presente existiu — foi
       exatamente este o buraco. */
    expect(sementinhas).toMatch(/presente:\s*await presenteRecente\(/);
  });

  test("as duas portas da carteira passam careMode", () => {
    /* `getWallet` e `claimDailyAndGetWallet`. Se uma delas esquecer, a festa
       aparece para quem está de luto — pela porta que ninguém testou. */
    const chamadas = [...sementinhas.matchAll(/walletPayload\([^)]*\)/g)].map((m) => m[0]);
    expect(chamadas.length).toBeGreaterThanOrEqual(2);
    for (const c of chamadas) expect(c).toContain("careMode");
  });

  test("o portão do luto mora DENTRO de presenteRecente", () => {
    /* E não em cada chamador. Nove pontos de uso lembram e o décimo esquece —
       a mesma lição de `recado-da-bolha.ts`. */
    expect(sementinhas).toMatch(/presenteRecente\([^)]*careMode: boolean,?\s*\)/s);
    expect(sementinhas).toMatch(/if \(careMode\) return null;/);
  });

  test("procura as DUAS razões, não só a do médico", () => {
    /* A mesada da assinante presenteia as amigas dela pelo mesmo ledger. Ler só
       a razão do médico deixaria metade dos presentes invisível. */
    expect(sementinhas).toMatch(
      /\.in\("reason", \[RAZAO_PRESENTE_MEDICO, RAZAO_PRESENTE_AMIGA\]\)/,
    );
  });
});

describe("o app dela mostra o presente", () => {
  test("o Caminho renderiza o aviso", () => {
    expect(jogo).toContain("<AvisoDePresente");
    expect(jogo).toMatch(/w\.ok && w\.presente/);
  });

  test("o aviso diz QUEM deu, e é o título", () => {
    /* "100 Sementinhas" com o remetente em letrinha embaixo transformaria um
       gesto num crédito bancário. O nome é o ponto inteiro da mesada. */
    expect(jogo).toContain("te mandou um presente");
    expect(jogo).toMatch(/presente\.de === "medico"/);
  });

  test("sem remetente ainda é um presente", () => {
    /* `nome` volta null quando o vínculo foi encerrado depois do envio. Um
       espaço em branco no título lê como tela quebrada. */
    expect(jogo).toContain('"O seu médico"');
  });

  test("fecha marcando visto — senão ele reaparece para sempre", () => {
    const fechamentos = [...jogo.matchAll(/lsSet\(chaveDoPresente\([^)]*\), true\)/g)];
    expect(fechamentos.length).toBeGreaterThanOrEqual(2); // "Agora não" e "Ver o Cantinho"
  });

  test("a chave do visto é o INSTANTE, não o valor", () => {
    /* Dois presentes de 100 no mesmo mês são duas notícias; uma chave por valor
       engoliria a segunda. */
    expect(jogo).toMatch(/function chaveDoPresente\(quando: string\)/);
    expect(jogo).toMatch(/chaveDoPresente\(w\.presente\.quando\)/);
  });

  test("a chave viaja com a jornada", () => {
    /* Prefixo `dc-path-`: entra no blob do `journey_state`. Sem ele, o mesmo
       presente seria anunciado de novo no computador, e presente anunciado duas
       vezes faz duvidar se chegaram dois. */
    expect(jogo).toMatch(/`dc-path-presente-visto-\$\{quando\}`/);
  });
});

describe("ela é avisada mesmo com o app fechado", () => {
  test("o presente dispara push", () => {
    expect(mesada).toContain("sendPushToUser");
  });

  test("o push vem DEPOIS da conferência de que gravou", () => {
    /* Avisar de um presente que não foi gravado é pior que não avisar. */
    const posGravou = mesada.indexOf('error: "nao_gravou"');
    const posPush = mesada.indexOf("sendPushToUser");
    expect(posGravou).toBeGreaterThan(-1);
    expect(posPush).toBeGreaterThan(posGravou);
  });

  test("o deep-link usa o rótulo exato da aba", () => {
    /* `minha-conta` compara o `?tab=` com os rótulos de `TABS` e IGNORA o que
       não bate: errar a caixa abriria a aba do Bebê, sem erro nenhum. */
    expect(mesada).toContain("/minha-conta?tab=Caminho");
    const tabs = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");
    expect(tabs).toMatch(/const TABS = \[[\s\S]*?"Caminho"/);
  });

  test("push que falha não desfaz presente que já está no ledger", () => {
    const trecho = mesada.slice(mesada.indexOf("sendPushToUser"));
    expect(trecho).toMatch(/\}\s*catch\s*\{/);
  });
});

describe("o painel do médico não esquece quem já recebeu", () => {
  test("a mesada devolve a lista", () => {
    /* Era memória do componente: bastava recarregar o painel para o botão de
       uma paciente presenteada voltar a dizer "Dar 30 🌱", o servidor recusar,
       e o recurso parecer quebrado justamente quando funcionava. */
    expect(mesada).toContain("presenteadas: quemJaRecebeu(");
  });

  test("a tela nasce com ela, e não vazia", () => {
    expect(cartao).toMatch(/for \(const id of m\.presenteadas \?\? \[\]\) nova\.add\(id\)/);
  });

  test("toda resposta do servidor passa pelo mesmo aplicador", () => {
    /* Atualizar a mesada sem a lista (ou o contrário) é como as duas passaram a
       discordar antes. */
    expect(cartao).not.toMatch(/setMesada\(res\.mesada\)/);
  });
});
