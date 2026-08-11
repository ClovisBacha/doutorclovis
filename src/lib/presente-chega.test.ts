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
  recebidoPorPaciente,
  tokenDePresente,
} from "./economia-sementinhas";
/* De `lib/`, e não do componente: `mesada-do-medico.tsx` importa `sonner`, que
   toca `document` ao carregar e derruba o `bun test` inteiro com um erro que
   não tem nada a ver com busca de nome. */
import { filtrarPacientes } from "./buscar-paciente";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const sementinhas = semComentarios("src/lib/sementinhas.functions.ts");
const mesada = semComentarios("src/lib/mesada.functions.ts");
const jogo = semComentarios("src/components/gestacao-path.tsx");
const cartao = semComentarios("src/components/mesada-do-medico.tsx");

/** Três pacientes de mentira para o filtro do nome. */
const PACIENTES = [
  { id: "1", display_name: "Sofía Andrade", baby_name: "Miguel" },
  { id: "2", display_name: "Ana Paula", baby_name: "Helena" },
  { id: "3", display_name: "Beatriz Lima", baby_name: null },
] as unknown as Parameters<typeof filtrarPacientes>[0];

describe("a chave do presente tem um dono só", () => {
  test("construtor e prefixo do LIKE concordam", () => {
    /* Era esta a divergência possível: o construtor numa linha e o `LIKE`
       escrito à mão três linhas acima. Se os dois deixarem de casar, a mesada
       conta zero gasto e o médico distribui sem teto. */
    const k = chaveDoPresente("med-1", "pac-9", "tok1");
    const prefixo = prefixoDosPresentes("med-1").replace(/%$/, "");
    expect(k.startsWith(prefixo)).toBe(true);
  });

  test("recebidoPorPaciente soma pelo id do meio", () => {
    expect(
      recebidoPorPaciente([{ dedupe_key: chaveDoPresente("med-1", "pac-9", "t1"), amount: 30 }]),
    ).toEqual({ "pac-9": 30 });
  });

  test("chave torta é descartada, nunca carimba valor na paciente errada", () => {
    expect(
      recebidoPorPaciente([
        { dedupe_key: "presente:med-1:pac-9", amount: 30 },
        { dedupe_key: "checkin:2026-08-11", amount: 5 },
        { dedupe_key: "", amount: 9 },
        { dedupe_key: null, amount: 9 },
      ]),
    ).toEqual({});
  });

  test("SEM LIMITE: dois presentes à mesma paciente somam, não colidem", () => {
    /* O limite de "um por paciente por mês" caiu a pedido do dono. Este teste é
       o que impede alguém de ressuscitá-lo sem perceber: com a chave carregando
       o ciclo, os dois envios abaixo teriam a MESMA chave, o índice único
       recusaria o segundo, e o total daria 30 em vez de 90. */
    const chaves = [
      { dedupe_key: chaveDoPresente("m", "p", "t1"), amount: 30 },
      { dedupe_key: chaveDoPresente("m", "p", "t2"), amount: 60 },
    ];
    expect(new Set(chaves.map((c) => c.dedupe_key)).size).toBe(2);
    expect(recebidoPorPaciente(chaves)).toEqual({ p: 90 });
  });

  test("pacientes diferentes ficam separadas", () => {
    expect(
      recebidoPorPaciente([
        { dedupe_key: chaveDoPresente("m", "p", "t1"), amount: 30 },
        { dedupe_key: chaveDoPresente("m", "outra", "t2"), amount: 100 },
      ]),
    ).toEqual({ p: 30, outra: 100 });
  });

  test("token com dois-pontos não desloca o parser", () => {
    /* O token vem do CLIENTE e entra numa chave separada por `:`. Sem limpeza,
       um token forjado com dois-pontos faria o painel creditar o presente à
       paciente errada. */
    expect(tokenDePresente("aa:bb:cc")).toBe("aabbcc");
    expect(tokenDePresente("../../etc")).toBe("etc");
    const k = chaveDoPresente("m", "p", tokenDePresente("x:y") ?? "");
    expect(k.split(":")).toHaveLength(4);
    expect(recebidoPorPaciente([{ dedupe_key: k, amount: 30 }])).toEqual({ p: 30 });
  });

  test("token vazio devolve null, e nunca string vazia", () => {
    /* String vazia faria TODOS os presentes daquela paciente colidirem numa
       chave só — o limite de um por mês voltando pela porta dos fundos. */
    for (const v of ["", "   ", ":::", null, undefined]) {
      expect(tokenDePresente(v)).toBeNull();
    }
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

describe("o painel mostra quanto cada uma já recebeu", () => {
  test("a mesada devolve o mapa", () => {
    expect(mesada).toContain("recebido: recebidoPorPaciente(");
  });

  test("a tela nasce com ele, e não vazio", () => {
    /* Era memória do componente: bastava recarregar o painel para o número
       sumir da tela sem ter sumido do ledger. */
    expect(cartao).toMatch(/setRecebido\(m\.recebido \?\? \{\}\)/);
  });

  test("toda resposta do servidor passa pelo mesmo aplicador", () => {
    /* Atualizar a mesada sem o mapa (ou o contrário) é como os dois passaram a
       discordar antes. */
    expect(cartao).not.toMatch(/setMesada\(res\.mesada\)/);
  });

  test("o número NÃO desabilita o botão", () => {
    /* O pedido do dono foi tirar o limite. Um `disabled` amarrado ao que ela já
       recebeu seria o limite de volta, agora só na tela — o pior lugar, porque
       o servidor aceitaria e a tela recusaria. */
    const linha = cartao.slice(cartao.indexOf("disabled={!cabe"));
    expect(linha.slice(0, 120)).not.toContain("recebido");
  });
});

describe("sem limite não pode virar sem defesa", () => {
  test("a tela manda um token por clique", () => {
    /* `grantSementinhas` usa `ignoreDuplicates`, então a chave é a ÚNICA coisa
       entre um toque duplo e dois presentes. */
    expect(cartao).toContain("token: crypto.randomUUID()");
  });

  test("o servidor sorteia um token quando não vem nenhum", () => {
    expect(mesada).toMatch(
      /tokenDePresente\(data\.token\) \?\? globalThis\.crypto\.randomUUID\(\)/,
    );
  });

  test("o mesmo clique repetido é sucesso, não recusa", () => {
    /* Devolver erro num toque nervoso faria ele mandar DE NOVO, com token novo,
       e aí sim gastar a mesada duas vezes. */
    expect(mesada).toMatch(/repetido: true as const/);
    expect(mesada).not.toContain('error: "ja_presenteada"');
  });

  test("o segundo 'enviado!' não aparece na tela", () => {
    expect(cartao).toMatch(/if \(!res\.repetido\)/);
  });
});

describe("o médico entende o que é Modo Cuidado", () => {
  test("o termo virou um link, e não texto solto", () => {
    /* Ele decide se a paciente recebe o presente e estava escrito como se todo
       médico já soubesse — é vocabulário nosso, não do consultório. */
    expect(cartao).toContain("setExplicandoCuidado(true)");
    expect(cartao).toMatch(/text-sky-600/);
  });

  test("a explicação responde o que muda para ELE", () => {
    expect(cartao).toContain("Por que o presente não chega");
    expect(cartao).toContain("Quem liga é a paciente");
  });

  test("e diz o que NÃO para — senão ele lê como paciente desassistida", () => {
    expect(cartao).toContain("O Modo Cuidado cala a");
    expect(cartao).toMatch(/SOS/);
  });
});

describe("achar a paciente sem rolar a lista toda", () => {
  test("busca por nome, sem acento e sem caixa", () => {
    expect(filtrarPacientes(PACIENTES, "sof")).toHaveLength(1);
    expect(filtrarPacientes(PACIENTES, "SOFIA")).toHaveLength(1);
    expect(filtrarPacientes(PACIENTES, "sofía")).toHaveLength(1);
  });

  test("busca também pelo nome do bebê", () => {
    /* É assim que muito médico guarda a paciente na cabeça — "a mãe da
       Helena" —, e o dado já está na mão. */
    const r = filtrarPacientes(PACIENTES, "helena");
    expect(r.map((p) => p.display_name)).toEqual(["Ana Paula"]);
  });

  test("busca vazia devolve todas", () => {
    expect(filtrarPacientes(PACIENTES, "   ")).toHaveLength(PACIENTES.length);
  });

  test("nome que não existe devolve nenhuma, e não todas", () => {
    /* Cair para "todas" num filtro sem resultado é o defeito clássico: ele
       digitaria um nome, veria a lista inteira e presentearia a errada. */
    expect(filtrarPacientes(PACIENTES, "zzz")).toHaveLength(0);
  });

  test("a lista cortada diz quantas ficaram de fora", () => {
    /* Lista truncada em silêncio faz o médico concluir que a paciente que ele
       procura não está vinculada a ele. */
    expect(cartao).toMatch(/escreva o nome para encontrar/);
  });
});
