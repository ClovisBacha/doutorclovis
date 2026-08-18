/**
 * AS TRAVAS DO SERVIDOR DA LISTA DE PRESENTES.
 *
 * Este teste LÊ O FONTE. Não é preguiça: as funções aqui falam com o Supabase
 * com service role, e o que precisa ser garantido não é o valor que elas
 * devolvem num caso feliz — é que certas linhas EXISTAM e certas outras nunca
 * apareçam. Um mock devolveria o que eu mandasse ele devolver.
 *
 * É o mesmo desenho de `travas-do-servidor.test.ts`, e a mesma razão pela qual
 * ele existe: a página pública desta lista é lida por trinta pessoas que não
 * fizeram login, e o dado que vaza por ela é o círculo social de uma gestante.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const FONTE = readFileSync("src/lib/presentes.functions.ts", "utf8");

/** Sem comentários — senão o teste passa por causa da prosa que o explica. */
function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const CODIGO = semComentarios(FONTE);

/** O corpo de uma função exportada, do nome dela até o próximo `export`. */
function corpoDe(nome: string): string {
  const i = CODIGO.indexOf(`export const ${nome} =`);
  expect(i).toBeGreaterThan(-1);
  const resto = CODIGO.slice(i + 10);
  const j = resto.indexOf("\nexport ");
  return j === -1 ? resto : resto.slice(0, j);
}

describe("o que a página pública NUNCA devolve", () => {
  test("⚠️ `listaPorToken` não seleciona nem devolve `user_id`", () => {
    // Mesma correção que `getAlbumByToken` levou e que `getPublicNameSession`
    // levou 190 linhas antes — e que precisou ser feita DUAS vezes porque não
    // foi propagada ao irmão.
    const c = corpoDe("listaPorToken");
    expect(c).not.toContain("user_id");
    expect(c).not.toContain("userId");
  });

  test("⚠️ `listaPorToken` não devolve o nome de quem reservou", () => {
    // A amiga precisa saber que o item está reservado, não POR QUEM. Revelar
    // cria comparação entre as convidadas ("a Fulana deu o carrinho e eu dei
    // fralda"), que é o constrangimento que a lista não pode produzir.
    expect(corpoDe("listaPorToken")).not.toContain("quem_nome");
  });

  test('⚠️ nenhuma função usa `select("*")`', () => {
    // Um `select("*")` só é seguro no dia em que é escrito: colunas novas
    // entram sozinhas e ninguém revisita a linha. Foi assim que o uuid dela
    // vazou pelo álbum.
    expect(CODIGO).not.toMatch(/select\(\s*["'`]\*/);
  });
});

describe("Modo Cuidado", () => {
  test("⚠️ `listaViva` tem o PORTÃO, não só a palavra", () => {
    // Este é o recurso com o maior risco de Modo Cuidado do app, porque o
    // objeto vive FORA do aparelho dela: um link de chá de bebê que continua
    // vivo depois de uma perda está na mão de trinta pessoas.
    //
    // ⚠️ A primeira versão deste teste procurava `care_mode` e `return null`
    // soltos no corpo. Uma mutação que APAGOU a linha do portão passou verde:
    // `care_mode` continuava no `.select(...)` e `return null` continuava na
    // linha de cima. Teste que procura palavra é teste que mente — a
    // asserção tem de ser sobre a GUARDA.
    const i = CODIGO.indexOf("async function listaViva");
    const corpo = CODIGO.slice(i, CODIGO.indexOf("\n}\n", i));
    expect(corpo.replace(/\s+/g, " ")).toContain("if (p?.care_mode) return null;");
  });

  test("⚠️ as DUAS funções públicas passam por `listaViva`", () => {
    // Filtrar numa e esquecer a outra é como um portão some sem ninguém notar:
    // a leitura pararia de funcionar e a RESERVA continuaria gravando.
    for (const f of ["listaPorToken", "reservarPorToken"]) {
      expect(corpoDe(f)).toContain("listaViva(sb");
    }
  });

  test("⚠️ o motivo nunca é dito — é sempre `indisponivel`", () => {
    // Contar a perda dela para o grupo de WhatsApp da família inteira é o app
    // tomando a decisão mais íntima que existe no lugar dela.
    expect(CODIGO).not.toMatch(/care_?mode.*motivo|motivo.*["'`]luto/i);
    for (const f of ["listaPorToken", "reservarPorToken"]) {
      expect(corpoDe(f)).toContain('"indisponivel"');
    }
  });
});

describe("a reserva", () => {
  test("⚠️ a régua recebe o saldo RELIDO, não um número solto", () => {
    // A régua pura responde "pode" com toda a confiança quando recebe um saldo
    // velho. Duas amigas na última cota, no mesmo segundo, é o caso real.
    //
    // ⚠️ A primeira versão comparava `indexOf` de duas strings, e uma mutação
    // que introduziu um `jaReservado2 = 0` passou verde — a posição da PRIMEIRA
    // ocorrência não diz nada sobre qual valor chegou na régua. O que amarra é
    // a cadeia: a soma vem do `select` das vivas, e é ELA que é passada.
    const c = corpoDe("reservarPorToken").replace(/\s+/g, " ");

    // 1. O saldo é somado a partir das reservas não canceladas.
    expect(c).toContain('.is("cancelada_em", null)');
    expect(c).toMatch(/const jaReservado = \(\(vivas \?\? \[\]\)/);

    // 2. E é esse mesmo identificador que as duas réguas recebem.
    expect(c).toContain("podeReservarFralda(faixaDe(item.tamanho), jaReservado, data.quantidade)");
    expect(c).toContain("podeReservarCotas(item.meta, jaReservado, data.quantidade)");
  });

  test("⚠️ as duas réguas vêm de lib/, nunca reescritas aqui", () => {
    expect(FONTE).toContain('from "@/lib/fraldas"');
    expect(FONTE).toContain('from "@/lib/cotas"');
    // Nenhum número de teto escrito à mão no servidor.
    expect(corpoDe("reservarPorToken")).not.toMatch(/>\s*6\b|tetoPacotes\s*=/);
  });

  test("⚠️ colidir na idem_key é SUCESSO, não erro", () => {
    // Devolver falha faria a amiga tentar de novo, com chave nova, e aí sim
    // reservar duas vezes — a mesma lição do presente do médico.
    const c = corpoDe("reservarPorToken");
    expect(c).toContain("23505");
    expect(c).toContain("repetido: true");
  });

  test("⚠️ a idem_key é sanitizada antes de virar chave", () => {
    // Um valor forjado com dois-pontos deslocaria o parser da chave.
    expect(corpoDe("reservarPorToken")).toMatch(/replace\(\/\[\^a-zA-Z0-9-\]/);
  });

  test("o item é conferido contra a lista do token", () => {
    // Sem isso, um `itemId` de outra lista seria reservado pelo token desta.
    expect(corpoDe("reservarPorToken")).toContain('.eq("lista_id", viva.id)');
  });
});

describe("nada é apagado", () => {
  test("⚠️ `cancelarReserva` MARCA, nunca deleta", () => {
    // O agradecimento e o contador precisam saber que houve e voltou.
    const c = corpoDe("cancelarReserva");
    expect(c).toContain("cancelada_em");
    expect(c).not.toContain(".delete(");
  });

  test("⚠️ `arquivarItem` recusa item que já tem reserva", () => {
    // Apagar um item reservado apaga a promessa de alguém e deixa o
    // agradecimento com um buraco que ninguém explica.
    const c = corpoDe("arquivarItem");
    expect(c).toContain("tem-reserva");
    expect(c).not.toContain(".delete(");
  });

  test("nenhuma função do arquivo chama .delete()", () => {
    expect(CODIGO).not.toContain(".delete(");
  });
});

describe("a dona", () => {
  test("⚠️ `marcarAgradecida` recorta pela lista dela", () => {
    // Os ids vêm do cliente: sem o recorte, ela marcaria como agradecida uma
    // reserva da lista de outra paciente.
    expect(corpoDe("marcarAgradecida")).toContain('.eq("lista_id", lista.id)');
  });

  test("⚠️ o presente AGENDADO não aparece para ela antes da hora", () => {
    // É o recurso inteiro. Quem marcou a revelação para a 36ª semana fez isso
    // de propósito, e o corte é no servidor — filtrar na tela deixaria o
    // recado viajando pela rede.
    const c = corpoDe("minhaLista");
    expect(c).toContain("revelar_em");
    expect(c).toMatch(/filter\(/);
    expect(c).toContain("guardados");
  });

  test("as três funções da dona exigem sessão", () => {
    for (const f of ["minhaLista", "salvarItens", "marcarAgradecida", "arquivarItem"]) {
      const c = corpoDe(f);
      expect(c).toContain("pacienteDaSessao");
      expect(c).toContain('"sessao"');
    }
  });

  test("as funções públicas NÃO pedem sessão — é o ponto delas", () => {
    // A amiga do trabalho não tem conta e não vai criar uma para reservar uma
    // fralda. Quem prova o vínculo aqui é o token.
    for (const f of ["listaPorToken", "reservarPorToken", "cancelarReserva"]) {
      expect(corpoDe(f)).not.toContain("pacienteDaSessao");
    }
  });
});

describe("o token", () => {
  test("⚠️ é gerado no servidor e não sai do uuid da paciente", () => {
    const i = CODIGO.indexOf("function novoToken");
    const corpo = CODIGO.slice(i, CODIGO.indexOf("\n}", i));
    expect(corpo).toContain("randomUUID");
    expect(corpo).not.toContain("user");
  });

  test("⚠️ NÃO é o token de companion_invites", () => {
    // Aquele abre TRÊS portas — álbum, painel do acompanhante e os SOS dos
    // últimos 30 minutos, com latitude e longitude. Reusá-lo faria o link do
    // chá de bebê abrir junto o painel de emergência dela.
    expect(FONTE).not.toContain("companion_invites");
  });
});
