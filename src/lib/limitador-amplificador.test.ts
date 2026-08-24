/**
 * O LIMITADOR TINHA VIRADO O AMPLIFICADOR.
 *
 * O conserto anterior era certo e a ordem em que ele foi posto era errada.
 *
 * Antes, a chave do limite saía do SUFIXO do header `Authorization`, sem
 * validação nenhuma. Bastava mandar `Bearer <32 caracteres aleatórios>` a cada
 * requisição para que o balde por IP nunca acumulasse (chave nova toda vez) e o
 * teto global do site anônimo fosse pulado (ele só vale para chaves que NÃO
 * começam com `u:`). As duas defesas de custo desligadas por uma string
 * inventada.
 *
 * O conserto passou a tirar a chave do usuário RESOLVIDO — e, com isso, pôs uma
 * ida ao Supabase Auth ANTES do limitador. A mesma rajada de tokens inventados
 * passou a custar uma viagem de rede por requisição, INCLUSIVE nas que iam levar
 * 429. O 429 existe justamente para ser a resposta barata; virou a cara. E o
 * limitador, em vez de conter a rajada, passou a multiplicá-la em chamadas ao
 * Auth: quanto mais rápido o atacante mandasse, mais nós gastávamos.
 *
 * Duas defesas, nesta ordem:
 *
 *  1. FORMA: um token que não é um JWT (três segmentos base64url) nunca chega à
 *     rede. Isso mata a rajada de lixo com custo zero — e não recusa nada que o
 *     Auth fosse aceitar.
 *  2. PORTÃO POR IP, antes de qualquer rede, com teto folgado. Cobre o resto:
 *     token bem-formado e inválido, ou token real repetido em rajada.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tokenPlausivel, usuarioDaRequisicao } from "./api-auth.server";
import { makeRateLimiter } from "./rate-limit.server";
import { AUTH_POR_IP_POR_MINUTO } from "@/routes/api/chat";

const chat = readFileSync("src/routes/api/chat.ts", "utf8");

/* Se a rede for tocada, o teste QUEBRA — é essa a asserção. Nenhum dos casos
   abaixo pode chegar ao Supabase; todos têm que ser recusados pela forma. */
function req(auth?: string): Request {
  return new Request("https://obstetrica.com.br/api/chat", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
}

describe("1. o que não tem forma de JWT não custa uma viagem de rede", () => {
  /**
   * ─── POR QUE A ASSERÇÃO É SOBRE `tokenPlausivel`, E NÃO SOBRE O RESULTADO ──
   *
   * A primeira versão destes testes exercitava `usuarioDaRequisicao` e conferia
   * que o retorno era `null`. Todos passavam — e continuavam passando com a
   * defesa REMOVIDA, porque num ambiente sem Supabase a viagem de rede falha e
   * o `catch` também devolve `null`. O mutante sobreviveu à bateria.
   *
   * O que precisa ser provado não é o retorno: é que a rede NÃO FOI TOCADA. O
   * atalho virou uma função pura, e é nela que o teste encosta.
   */
  test("64 caracteres aleatórios — a rajada que o teto de 10 deixava passar", () => {
    /* O `token.length < 10` anterior recusava `abc` e deixava passar isto. */
    expect(tokenPlausivel("a".repeat(64))).toBe(false);
  });

  test("dois segmentos não bastam — JWT tem três", () => {
    expect(tokenPlausivel("aaaa.bbbb")).toBe(false);
  });

  test("quatro também não", () => {
    expect(tokenPlausivel("aaaa.bbbb.cccc.dddd")).toBe(false);
  });

  test("segmento vazio não passa", () => {
    expect(tokenPlausivel("aaaa..cccc")).toBe(false);
  });

  test("caractere fora do base64url não passa", () => {
    /* `+` e `/` são base64 clássico; JWT usa base64URL (`-` e `_`). */
    expect(tokenPlausivel("aa+a.bb/b.cccc")).toBe(false);
    expect(tokenPlausivel("aaaa.bbbb.cc cc")).toBe(false);
  });

  test("um JWT de verdade PASSA — a defesa não pode recusar quem é legítimo", () => {
    /* O controle positivo. Sem ele, `return false` seria uma "defesa" perfeita
       que derruba todas as pacientes logadas do app. Este é o formato exato do
       `session.access_token` do Supabase: header.payload.assinatura. */
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
      ".eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ" +
      ".dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(tokenPlausivel(jwt)).toBe(true);
  });

  test("e um com `-` e `_` também — é base64URL", () => {
    expect(tokenPlausivel("ab-c.de_f.gh-i_j")).toBe(true);
  });

  test("sem header nenhum, nem começa", async () => {
    expect(await usuarioDaRequisicao(req())).toBeNull();
  });

  test("outro esquema de autenticação não é lido como Bearer", async () => {
    expect(await usuarioDaRequisicao(req("Basic YWxhZGRpbjpvcGVuc2VzYW1l"))).toBeNull();
  });

  test("o caminho completo continua recusando o lixo", async () => {
    /* Fraco de propósito, e mantido de propósito: prova a LIGAÇÃO entre o
       atalho e o chamador. Sozinho não prova nada; ao lado dos de cima, prova
       que ninguém desconectou os dois. */
    expect(await usuarioDaRequisicao(req(`Bearer ${"a".repeat(64)}`))).toBeNull();
  });
});

describe("2. o esquema é case-insensitive — a RFC 7235 permite `bearer`", () => {
  /**
   * Havia um `startsWith("Bearer ")` literal. Um cliente que mandasse o esquema
   * em minúsculas — o que a norma permite — era tratado como ANÔNIMO: caía no
   * prompt público, sem nenhum aviso, e a paciente conversava com o assistente
   * geral achando que falava com a IA do médico dela.
   *
   * O teste não pode afirmar que `bearer` AUTENTICA (não há Supabase aqui), mas
   * pode afirmar que ele é RECONHECIDO — e a prova é que passa a ser recusado
   * pela FORMA do token, não pelo esquema. Com um token bem-formado, o código
   * teria que ir à rede; então usamos um mal-formado e checamos o código-fonte
   * para o esquema.
   */
  /* Sem os comentários. A primeira versão deste teste afirmava que o arquivo
     NÃO contém `startsWith("Bearer ")` — e reprovou, porque o comentário que
     explica a correção cita a linha que ela removeu. É a terceira vez neste
     projeto que uma asserção casa com a minha própria prosa; o remédio é
     sempre o mesmo: afirmar sobre o CÓDIGO. */
  const fonte = readFileSync("src/lib/api-auth.server.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  test("o casamento do esquema ignora maiúsculas", () => {
    expect(fonte).toContain("/^\\s*bearer\\s+(\\S+)\\s*$/i");
    expect(fonte).not.toContain('startsWith("Bearer ")');
  });

  test("e o header é lido uma vez só — `get` já é case-insensitive", () => {
    /* Havia `get("authorization") || get("Authorization")`: a segunda chamada
       nunca podia devolver nada diferente da primeira, porque a norma dos
       Headers manda normalizar o nome. Código que sugere uma proteção que não
       existe é pior que código a menos. */
    expect(fonte).not.toContain('request.headers.get("Authorization")');
  });
});

describe("3. o portão de Auth vem ANTES da rede", () => {
  test("a checagem do portão está acima da chamada ao Auth", () => {
    const portao = chat.indexOf("portaoDeAuth(ipDaRequisicao)");
    const rede = chat.indexOf("await usuarioDaRequisicao(request)");
    expect(portao).toBeGreaterThan(-1);
    expect(rede).toBeGreaterThan(-1);
    expect(portao).toBeLessThan(rede);
  });

  test("e só vale para quem TRAZ o header — sem header não há rede a limitar", () => {
    const i = chat.indexOf("portaoDeAuth(ipDaRequisicao)");
    const linha = chat.slice(Math.max(0, i - 120), i + 40);
    expect(linha).toContain('request.headers.get("authorization")');
  });

  test("o IP é calculado uma vez e reaproveitado na chave", () => {
    /* Duas chamadas a `clientIp` seriam duas leituras do mesmo header — e a
       oportunidade de o portão e o balde discordarem sobre quem é o cliente. */
    expect(chat).toContain("const ipDaRequisicao = clientIp(request)");
    expect(chat).toContain("`ip:${ipDaRequisicao}`");
  });
});

describe("4. o teto do portão é folgado — ele não é o limite de conversa", () => {
  /**
   * Este é o ponto em que o conserto poderia repetir o defeito que ele mesmo
   * consertou: o limite por IP existia e machucava CGNAT de operadora e wifi de
   * clínica, onde várias pacientes do mesmo médico se encontram. Se o portão
   * fosse apertado, ele traria o problema de volta por outra porta.
   */
  test("cabe uma clínica inteira — bem acima do limite por usuária", () => {
    expect(AUTH_POR_IP_POR_MINUTO).toBeGreaterThanOrEqual(100);
  });

  test("mas é um teto de verdade: a rajada 121 é barrada", () => {
    /* Números literais de propósito. Um teste escrito em cima da própria
       constante que ele protege passa quando a constante muda — foi assim que
       `LACUNA_VOLTA_APOS` sobreviveu a uma mutação 3→1. */
    const portao = makeRateLimiter(120, 60_000);
    for (let i = 0; i < 120; i++) expect(portao("187.0.0.1")).toBe(false);
    expect(portao("187.0.0.1")).toBe(true);
  });

  test("e é POR IP: o abuso de um não fecha a porta do outro", () => {
    const portao = makeRateLimiter(120, 60_000);
    for (let i = 0; i < 200; i++) portao("187.0.0.1");
    expect(portao("200.0.0.9")).toBe(false);
  });
});

describe("5. o furo original continua fechado", () => {
  test("a chave do limite sai do usuário RESOLVIDO, nunca do header", () => {
    /* A regressão que estamos consertando não pode reabrir a original: se a
       chave voltar a sair do sufixo do header, a rajada de tokens inventados
       volta a zerar o balde a cada requisição. */
    expect(chat).toContain("usuarioDoLimite ? `u:${usuarioDoLimite.id}`");
    expect(chat).not.toContain("cabecalho.slice(7)");
  });

  test("o teto global anônimo continua valendo só para quem não tem conta", () => {
    expect(chat).toContain('!chaveDoLimite.startsWith("u:") && tetoGlobalAnonimoEstourado()');
  });
});
