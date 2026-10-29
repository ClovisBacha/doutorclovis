/**
 * A CONVERSA, MEDIDA.
 *
 * As três travas contra assédio são o que este arquivo guarda. Nenhuma delas é
 * enfeite: caixa de entrada aberta a desconhecidos, numa base de gestantes de
 * alto risco, é o desenho que transforma um recurso de afeto numa porta de
 * perseguição.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MENSAGENS_ANTES_DE_ACEITAR,
  minhaColunaDeLeitura,
  parOrdenado,
  podeEnviar,
  podeIniciarConversa,
  previaDaMensagem,
  temNaoLida,
  foiLidaPeloOutro,
  colunaDoOutro,
  minhaColuna,
  fotoEhDeQuemMandou,
} from "./conversa";

const EU = "aaa";
const ELA = "zzz";

const iniciar = (v: Partial<Parameters<typeof podeIniciarConversa>[0]> = {}) =>
  podeIniciarConversa({
    euId: EU,
    alvoId: ELA,
    temBloqueio: false,
    alcancaOPerfil: true,
    alvoMeSegue: false,
    ...v,
  });

describe("⚠️ trava 1 — só quem alcança o perfil escreve", () => {
  test("perfil fora de alcance recusa", () => {
    /* Quem não consegue nem abrir o perfil dela não pode aparecer na caixa de
       entrada dela. É a MESMA régua de `alcancaOPerfil`, de propósito. */
    expect(iniciar({ alcancaOPerfil: false })).toEqual({
      pode: false,
      motivo: "fora_de_alcance",
    });
  });

  test("⚠️ o bloqueio vem ANTES do alcance, e o motivo não conta a diferença", () => {
    /* Quem bloqueou pode continuar com perfil público; responder "fora de
       alcance" ali revelaria que o bloqueio existe. */
    expect(iniciar({ temBloqueio: true, alcancaOPerfil: true })).toEqual({
      pode: false,
      motivo: "bloqueio",
    });
    expect(iniciar({ temBloqueio: true, alcancaOPerfil: false })).toEqual({
      pode: false,
      motivo: "bloqueio",
    });
  });

  test("ninguém puxa conversa consigo mesma", () => {
    expect(iniciar({ alvoId: EU })).toEqual({ pode: false, motivo: "eu_mesma" });
  });
});

describe("⚠️ trava 2 — se ela não me segue, é pedido", () => {
  test("desconhecida cai na caixa de pedidos", () => {
    expect(iniciar({ alvoMeSegue: false })).toEqual({ pode: true, comoPedido: true });
  });

  test("quem já me segue abre conversa direta", () => {
    expect(iniciar({ alvoMeSegue: true })).toEqual({ pode: true, comoPedido: false });
  });
});

describe("⚠️ trava 3 — UMA mensagem até ser aceito", () => {
  const enviar = (v: Partial<Parameters<typeof podeEnviar>[0]> = {}) =>
    podeEnviar({
      souODono: true,
      aceita: false,
      euIniciei: true,
      minhasMensagens: 0,
      temBloqueio: false,
      ...v,
    });

  test("a primeira passa; a segunda espera o aceite", () => {
    /* É a trava que o Instagram não tem: lá dá para encher a caixa de
       solicitações. Aqui, quem pediu escreve uma e espera. */
    expect(enviar({ minhasMensagens: 0 }).pode).toBe(true);
    expect(enviar({ minhasMensagens: MENSAGENS_ANTES_DE_ACEITAR })).toEqual({
      pode: false,
      motivo: "aguardando_aceite",
    });
    expect(enviar({ minhasMensagens: 7 }).pode).toBe(false);
  });

  test("⚠️ QUEM RECEBEU O PEDIDO RESPONDE SEM ACEITAR FORMALMENTE", () => {
    /* Responder É aceitar. Obrigar dois toques faria a paciente escrever e a
       mensagem não sair — o pior desfecho possível numa caixa de entrada. */
    expect(enviar({ euIniciei: false, minhasMensagens: 0 }).pode).toBe(true);
    expect(enviar({ euIniciei: false, minhasMensagens: 5 }).pode).toBe(true);
  });

  test("aceita libera os dois lados", () => {
    expect(enviar({ aceita: true, minhasMensagens: 99 }).pode).toBe(true);
  });

  test("bloqueio fecha mesmo em conversa aceita", () => {
    expect(enviar({ aceita: true, temBloqueio: true })).toEqual({
      pode: false,
      motivo: "bloqueio",
    });
  });

  test("quem não é das duas pontas não escreve", () => {
    expect(enviar({ souODono: false, aceita: true })).toEqual({
      pode: false,
      motivo: "nao_e_minha",
    });
  });
});

describe("⚠️ o par ordenado", () => {
  test("(A,B) e (B,A) são a MESMA conversa", () => {
    /* Sem isto, duas pessoas que se escrevem ao mesmo tempo criam duas
       conversas, cada uma vê a sua, e as mensagens da outra somem. */
    expect(parOrdenado("zzz", "aaa")).toEqual(parOrdenado("aaa", "zzz"));
    expect(parOrdenado("zzz", "aaa")).toEqual({ a: "aaa", b: "zzz" });
  });

  test("a coluna de leitura segue o lado do par", () => {
    expect(minhaColunaDeLeitura("aaa", "aaa")).toBe("lida_a");
    expect(minhaColunaDeLeitura("zzz", "aaa")).toBe("lida_b");
  });
});

describe("o não lido", () => {
  const base = { ultimaEm: "2026-08-24T10:00:00Z", minhaLeitura: null, ultimoAutor: ELA, euId: EU };

  test("nunca vi: é não lida", () => {
    expect(temNaoLida(base)).toBe(true);
  });

  test("⚠️ a MINHA mensagem nunca conta como não lida", () => {
    /* Sem esta regra o emblema acende no instante em que ela manda, e o número
       perde o sentido na primeira mensagem enviada. */
    expect(temNaoLida({ ...base, ultimoAutor: EU })).toBe(false);
    expect(temNaoLida({ ...base, ultimoAutor: EU, minhaLeitura: null })).toBe(false);
  });

  test("li depois da última: não há novidade", () => {
    expect(temNaoLida({ ...base, minhaLeitura: "2026-08-24T11:00:00Z" })).toBe(false);
    expect(temNaoLida({ ...base, minhaLeitura: "2026-08-24T09:00:00Z" })).toBe(true);
  });

  test("conversa sem mensagem não acende nada", () => {
    expect(temNaoLida({ ...base, ultimaEm: null })).toBe(false);
  });
});

describe("a prévia da lista", () => {
  test("⚠️ apagada vira aviso, e NÃO some da lista", () => {
    /* Uma conversa que perde a última linha e volta a mostrar a anterior faz a
       paciente achar que a mensagem que ela viu chegar não existiu. */
    expect(previaDaMensagem("qualquer coisa", true)).toBe("Mensagem apagada");
  });

  test("corta sem quebrar, e junta as quebras de linha", () => {
    expect(previaDaMensagem("oi\n\n  tudo   bem?", false)).toBe("oi tudo bem?");
    const longa = "a".repeat(200);
    expect(previaDaMensagem(longa, false, 10)).toBe("aaaaaaaaa…");
    expect(previaDaMensagem(longa, false, 10).length).toBe(10);
  });

  test("vazia não vira reticências soltas", () => {
    expect(previaDaMensagem(null, false)).toBe("");
    expect(previaDaMensagem("   ", false)).toBe("");
  });
});

describe("⚠️ quem avisa, e quem NÃO avisa", () => {
  const FONTE_MSG = readFileSync("src/lib/conversa.functions.ts", "utf8");
  const FONTE_COM = readFileSync("src/lib/comentarios.functions.ts", "utf8");

  test("⚠️ a MENSAGEM manda push — sem isso a caixa é um canal morto", () => {
    /* Foi um defeito real: a mensagem direta foi construída inteira e não
       avisava ninguém. A pessoa só descobria se por acaso abrisse a caixa. */
    expect(FONTE_MSG).toContain("sendPushToUser");
  });

  test("⚠️ mas o PEDIDO não manda — só a conversa ACEITA", () => {
    /* O ponto delicado: uma desconhecida poderia acordar a paciente às três da
       manhã com uma mensagem que ela nunca pediu. Sem esta distinção, a trava
       de uma-mensagem viraria uma trava de um-push, que não é a mesma coisa. */
    /* ⚠️ **COBRA O PORTÃO, e não o texto exato do `if`.** A primeira versão
       exigia a string `if (aceitaAgora)` e ficou VERMELHA no dia em que a
       condição virou `if (aceitaAgora && !outroSilenciou)` — uma guarda
       estritamente mais forte. Um teste que reprova código melhor é um teste
       que ensina a relaxá-lo, e é assim que ele começa a mentir. */
    const i = FONTE_MSG.indexOf("await sendPushToUser(");
    const antes = FONTE_MSG.slice(Math.max(0, i - 900), i);
    const guarda = /if \(\s*aceitaAgora\b[^)]*\)\s*\{/.exec(antes);
    expect({ temGuarda: !!guarda }).toEqual({ temGuarda: true });
  });

  test("⚠️ e conversa SILENCIADA não manda push", () => {
    /* Sem isto, "silenciar" seria um interruptor decorativo: a conversa ficaria
       marcada como silenciada na tela dela e o celular continuaria tocando —
       pior que não ter o botão, porque ela para de procurar outra saída achando
       que resolveu. */
    const i = FONTE_MSG.indexOf("await sendPushToUser(");
    const antes = FONTE_MSG.slice(Math.max(0, i - 900), i);
    expect(antes).toContain("!outroSilenciou");
  });

  test("⚠️ e o silêncio lido é o DA OUTRA, nunca o meu", () => {
    /* Com `minhaColuna` aqui, eu silenciaria o celular dela ao silenciar o meu
       — o mesmo par de colunas invertido que `minhaColuna`/`colunaDoOutro`
       existem para não deixar acontecer. */
    expect(FONTE_MSG).toContain('colunaDoOutro("silenciada"');
    const i = FONTE_MSG.indexOf("const outroSilenciou");
    expect(FONTE_MSG.slice(i, i + 120)).not.toContain('minhaColuna("silenciada"');
  });

  test("⚠️ o TEXTO da mensagem não vai na notificação", () => {
    /* Ela aparece na tela bloqueada, e uma conversa entre duas gestantes é o
       conteúdo mais íntimo desta aba — quem estiver do lado leria. */
    /* ⚠️ ANCORA NA CHAMADA, e não na primeira ocorrência do nome — a primeira
       é o `import`, e a fatia a partir dela media o destructuring em vez do
       corpo do aviso. A asserção passou a olhar `await sendPushToUser(`. */
    const i = FONTE_MSG.indexOf("await sendPushToUser(");
    expect(i).toBeGreaterThan(-1);
    const chamada = FONTE_MSG.slice(i, i + 320);
    expect(chamada).toContain("te mandou uma mensagem");
    expect(chamada).not.toContain("texto");
  });

  test("⚠️ o COMENTÁRIO avisa na caixa ♡ e NÃO manda push", () => {
    /* O push é o mesmo canal do aviso de emergência: quem desliga por causa de
       um comentário de madrugada desliga o resto junto. A régua do app diz que
       push é para o que fica esperando resposta — comentário não fica. */
    expect(FONTE_COM).toContain('especie: "comentou"');
    expect(FONTE_COM).not.toContain("sendPushToUser");
  });

  test("⚠️ e o aviso do comentário vai DEPOIS do insert", () => {
    /* Avisar de um comentário que não gravou é pior que não avisar. */
    const c = FONTE_COM.replace(/\s+/g, " ");
    const ondeInsere = c.indexOf('.from("rede_comentarios") .insert(');
    const ondeAvisa = c.indexOf("registrarAtividade(sb");
    expect(ondeInsere).toBeGreaterThan(-1);
    expect(ondeAvisa).toBeGreaterThan(ondeInsere);
  });

  test("⚠️ o comentário reaproveita `registrarAtividade`, nunca escreve à mão", () => {
    /* As duas armadilhas daquele helper (o `insert` em vez de `upsert`, e o
       `23505` que é sucesso repetido) já custaram a caixa ♡ inteira uma vez. */
    expect(FONTE_COM).not.toContain('from("rede_atividade")');
  });
});

describe("o ✓✓ — ela já leu?", () => {
  test("lida quando o carimbo do outro é posterior ao envio", () => {
    expect(
      foiLidaPeloOutro({
        souEu: true,
        criadaEm: "2026-08-24T10:00:00Z",
        leituraDoOutro: "2026-08-24T10:05:00Z",
      }),
    ).toBe(true);
  });

  test("não lida quando o carimbo é anterior", () => {
    expect(
      foiLidaPeloOutro({
        souEu: true,
        criadaEm: "2026-08-24T10:00:00Z",
        leituraDoOutro: "2026-08-24T09:00:00Z",
      }),
    ).toBe(false);
  });

  test("o mesmo instante conta como lida", () => {
    /* `marcarConversaLida` carimba `now()` e a mensagem pode ter o mesmo
       instante ao milissegundo. Com `>` estrito, a última mensagem de cada
       conversa ficaria eternamente sem ✓✓. */
    expect(
      foiLidaPeloOutro({
        souEu: true,
        criadaEm: "2026-08-24T10:00:00Z",
        leituraDoOutro: "2026-08-24T10:00:00Z",
      }),
    ).toBe(true);
  });

  test("⚠️ NUNCA desenha ✓✓ na mensagem DELA", () => {
    /* Seria o app afirmando que EU li — informação que quem está do outro lado
       não tem como conferir, e que ela não pediu para publicar. */
    expect(
      foiLidaPeloOutro({
        souEu: false,
        criadaEm: "2026-08-24T10:00:00Z",
        leituraDoOutro: "2026-08-24T23:00:00Z",
      }),
    ).toBe(false);
  });

  test("sem carimbo nenhum, não lida", () => {
    expect(
      foiLidaPeloOutro({ souEu: true, criadaEm: "2026-08-24T10:00:00Z", leituraDoOutro: null }),
    ).toBe(false);
  });
});

describe("as colunas com sufixo _a/_b", () => {
  test("a minha e a da outra são opostas, sempre", () => {
    const eu = "aaa";
    const outra = "bbb";
    for (const [euId, aId] of [
      [eu, eu],
      [eu, outra],
    ] as const) {
      expect(minhaColuna("silenciada", euId, aId)).not.toBe(colunaDoOutro("silenciada", euId, aId));
    }
  });

  test("⚠️ concorda com `minhaColunaDeLeitura`, que já existia", () => {
    /* Duas funções respondendo à mesma pergunta é como uma delas sai invertida
       — e uma invertida silencia a conversa da OUTRA pessoa. */
    expect(minhaColuna("lida", "x", "x")).toBe(minhaColunaDeLeitura("x", "x"));
    expect(minhaColuna("lida", "x", "y")).toBe(minhaColunaDeLeitura("x", "y"));
  });
});

describe("a prévia de uma mensagem sem texto", () => {
  test("⚠️ foto vira 📷 Foto, nunca linha em branco", () => {
    /* Sem isto, a paciente vê o nome da amiga, a hora e NADA — e não tem como
       saber se é defeito ou mensagem vazia. */
    expect(previaDaMensagem("", false, 60, { imagem: true })).toBe("📷 Foto");
  });

  test("publicação e story anexados também se anunciam", () => {
    expect(previaDaMensagem(null, false, 60, { ref: "post" })).toBe("Publicação");
    expect(previaDaMensagem(null, false, 60, { ref: "story" })).toBe("Respondeu ao seu story");
  });

  test("com texto, o texto vence o anexo", () => {
    expect(previaDaMensagem("olha isso", false, 60, { imagem: true })).toBe("olha isso");
  });

  test("apagada vence tudo", () => {
    expect(previaDaMensagem("olha", true, 60, { imagem: true })).toBe("Mensagem apagada");
  });
});

describe("o caminho da foto", () => {
  test("aceita a pasta de quem mandou", () => {
    expect(fotoEhDeQuemMandou("abc/1.jpg", "abc")).toBe(true);
  });

  test("⚠️ recusa a pasta de outra pessoa", () => {
    /* O cliente escolhe o caminho ao subir pela URL assinada: sem esta trava,
       a mensagem exibiria dentro de uma conversa privada um arquivo alheio. */
    expect(fotoEhDeQuemMandou("outra/1.jpg", "abc")).toBe(false);
  });

  test("⚠️ a barra final é obrigatória", () => {
    /* Sem ela, `abc` casaria `abcdef` por prefixo. */
    expect(fotoEhDeQuemMandou("abcdef/1.jpg", "abc")).toBe(false);
    expect(fotoEhDeQuemMandou("abc", "abc")).toBe(false);
  });

  test("recusa travessia e barra dupla", () => {
    expect(fotoEhDeQuemMandou("abc/../outra/1.jpg", "abc")).toBe(false);
    expect(fotoEhDeQuemMandou("abc//1.jpg", "abc")).toBe(false);
  });
});

describe("⚠️ as travas do envio que a mutação pegou sem teste", () => {
  /**
   * ⚠️ **Recorta o CORPO de `enviarMensagem` e tira os comentários ANTES de
   * procurar.** Sem o recorte, uma trava escrita em qualquer outra função do
   * arquivo satisfaria a asserção; sem tirar a prosa, o próprio comentário que
   * descreve a trava a faria passar — as duas armadilhas já custaram uma volta
   * neste repo, em arquivos diferentes.
   */
  const corpoDoEnvio = (() => {
    const fonte = readFileSync("src/lib/conversa.functions.ts", "utf8");
    const i = fonte.indexOf("export const enviarMensagem");
    const resto = fonte.slice(i + 10);
    const j = resto.indexOf("\nexport const");
    return (j === -1 ? resto : resto.slice(0, j))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  })();

  test("⚠️ a foto é conferida contra a pasta de quem manda", () => {
    /* O caminho vem do CLIENTE (ele sobe pela URL assinada). Sem esta
       conferência, uma paciente aponta para a pasta de outra e a mensagem passa
       a exibir, dentro de uma conversa privada, um arquivo que não é dela. */
    /* ⚠️ **A PASTA É A DERIVADA, e não o uuid cru.** O upload passou a usar
       `pastaDoDono` porque o caminho vaza para a URL assinada e um uuid de
       paciente ali é identificador exposto — a regra que `imagens.test.ts` já
       cobrava para os outros baldes. A conferência acompanhou: comparar com
       `eu` recusaria TODA foto nova. */
    expect(corpoDoEnvio).toContain("fotoEhDeQuemMandou(data.imagemPath, pastaDe(eu))");
    expect(corpoDoEnvio).toContain('motivo: "foto_invalida"');
  });

  test("⚠️ a régua clínica roda no texto da mensagem", () => {
    /* O comentário passa por `triarTexto`, a caixinha passa, e a mensagem
       direta — o canal mais íntimo e o mais provável de carregar "no seu lugar
       eu esperava" — não passava por nada. */
    expect(corpoDoEnvio).toContain("triarTexto(texto)");
  });

  test("⚠️ EMERGÊNCIA é recusada, e o resto só avisa", () => {
    /* A recusa aqui é estreita de propósito: bloquear "toma chá de camomila"
       numa conversa privada entre duas adultas que se escolheram seria o app
       censurando as duas. O que ele faz é o que pode fazer sem mentir — manda,
       e avisa quem escreveu. */
    expect(corpoDoEnvio).toContain('desfecho === "emergencia"');
    expect(corpoDoEnvio).toContain('motivo: "emergencia"');
    expect(corpoDoEnvio).toContain('avisoClinico = "conduta"');
  });

  test("⚠️ falha ao triar NÃO derruba a mensagem", () => {
    /* A régua é proteção adicional, não condição de existir da conversa:
       derrubar o direct inteiro porque um módulo não carregou seria trocar um
       risco por uma avaria certa. */
    const i = corpoDoEnvio.indexOf("triarTexto");
    expect(corpoDoEnvio.slice(i, i + 500)).toContain("catch");
  });

  test("⚠️ anexo pela metade é recusado", () => {
    /* `refTipo` sem `refId` (ou o contrário) viraria uma mensagem que anuncia
       uma publicação e não abre nada. */
    expect(corpoDoEnvio).toContain("!!data.refTipo !== !!data.refId");
  });
});
