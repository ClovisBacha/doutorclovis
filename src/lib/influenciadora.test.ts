/**
 * O CÓDIGO DA INFLUENCIADORA — as travas que não podem cair.
 *
 * Três decisões estão travadas aqui, e cada uma existe por um risco concreto:
 *
 *  1. o código NÃO escreve em `referred_by` (senão a influenciadora vira amiga
 *     de cada gestante que usou o código dela);
 *  2. o bônus é 150 e não 500 (senão a parede da conversão cai do 15º para o
 *     6º dia);
 *  3. o painel dela é resolvido pelo E-MAIL DA SESSÃO (senão qualquer pessoa
 *     lê o faturamento de qualquer criadora).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BONUS_INFLUENCIADORA,
  CUSTO_LOJA_GRATIS,
  GANHO_DIA_TIPICO,
  GANHO_SEMANAL,
  BONUS_VINCULO_MEDICO,
  entradaDeGraca,
  diasParaZerarLoja,
} from "./economia-sementinhas";
import { REFERRAL_REWARD } from "./referral.functions";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const servidor = semComentarios("src/lib/influenciadora.functions.ts");

describe("⚠️ o código da influenciadora NÃO é o grafo de amizade", () => {
  test("nunca escreve em `referred_by`", () => {
    /* ─── O RISCO, POR EXTENSO ────────────────────────────────────────────
       `referred_by` não é um registro de origem: é o grafo que `saoAmigas`
       consulta para decidir quem enxerga o Cantinho de quem
       (`minha.referred_by === outra || dela.referred_by === eu`).

       Se o código da influenciadora escrevesse ali, uma criadora com três mil
       seguidoras viraria "amiga" de três mil gestantes — apareceria na lista de
       Amigas de cada uma, poderia visitar o Cantinho, formar dupla e receber
       presente. E como `referred_by` é fixado UMA VEZ, ele queimaria a
       indicação de uma amiga de verdade. */
    expect(servidor).not.toContain("referred_by");
  });

  test("escreve em `ref_code`, e só se ainda estiver vazio", () => {
    /* `.is("ref_code", null)` na CONDIÇÃO do update, não só numa leitura antes:
       entre ler e escrever cabe o checkout gravando o dele. */
    expect(servidor).toContain(".update({ ref_code: codigo })");
    expect(servidor).toContain('.is("ref_code", null)');
  });

  /* ⚠️ A CHAMADA, NUNCA O NOME SOLTO. A primeira versão destes dois testes
     usava `indexOf("grantSementinhas")` e as duas reprovaram — o primeiro
     acerto é a linha de IMPORT, no topo do arquivo, antes de tudo que elas
     queriam medir. Um teste de ORDEM tem de ancorar no ponto de uso. */
  const chamadaDoCredito = servidor.indexOf("grantSementinhas(typedDb(");

  test("o bônus só é pago fora do Modo Cuidado", () => {
    /* Quem acabou de perder a gestação não recebe festa de boas-vindas. */
    expect(chamadaDoCredito).toBeGreaterThan(-1);
    expect(servidor.slice(0, chamadaDoCredito)).toContain("isCareModeActive(supabaseAdmin, uid)");
  });

  test("conta sem e-mail confirmado não credita nada", () => {
    /* Sementinha compra item de verdade na loja: sem esta trava, criar contas
       com e-mails inventados seria uma torneira de moeda. */
    const i = servidor.indexOf("if (!confirmado)");
    expect(i).toBeGreaterThan(-1);
    expect(chamadaDoCredito).toBeGreaterThan(i);
  });

  test("código inativo não atribui — e a tela é avisada", () => {
    /* `invalido` é o que permite à tela dizer "não encontrei esse código". Sem
       ele a paciente digita, vê "pronto" e nunca recebe o bônus. */
    expect(servidor).toContain("invalido: true");
    expect(servidor).toContain('.select("code,active")');
  });
});

describe("⚠️ 150, e o número é medido — não é gosto", () => {
  test("o bônus entra em `entradaDeGraca`", () => {
    /* Fora dela, os testes de teto da economia mediriam uma paciente que não
       existe: quem chega por influenciadora começa com 150 a mais. */
    expect(entradaDeGraca({ comMedico: false })).toBe(0);
    expect(entradaDeGraca({ comMedico: false, porInfluenciadora: true })).toBe(
      BONUS_INFLUENCIADORA,
    );
    expect(entradaDeGraca({ comMedico: true, porInfluenciadora: true })).toBe(
      BONUS_VINCULO_MEDICO + BONUS_INFLUENCIADORA,
    );
  });

  test("a parede continua no 15º dia no caso base", () => {
    /* É ESTA a razão do número. A parede — o dia em que ela zera a loja grátis e
       passa a acumular moeda sem ter no que gastar — é a mecânica de conversão
       inteira do app. Um bônus de boas-vindas não pode desfazer o desenho que
       ele deveria alimentar. */
    const parede = diasParaZerarLoja({ comMedico: false, porInfluenciadora: true });
    expect(parede).toBeGreaterThanOrEqual(15);
  });

  test("⚠️ 500 teria derrubado a parede para menos de uma semana", () => {
    /* A conta que reprovou a proposta original, refeita aqui a partir das
       MESMAS constantes — se alguém subir o ganho diário, este teste passa a
       medir o mundo novo em vez de repetir um número velho. */
    const porDia = GANHO_DIA_TIPICO + GANHO_SEMANAL / 7;
    const comQuinhentos = Math.ceil((CUSTO_LOJA_GRATIS - 500) / porDia);
    expect(comQuinhentos).toBeLessThan(7);
    /* E 500 seria a maior parte da loja grátis entregue no cadastro. */
    expect(500 / CUSTO_LOJA_GRATIS).toBeGreaterThan(0.6);
  });

  test("é maior que a indicação entre pacientes, mas na mesma ordem de grandeza", () => {
    /* Precisa soar como presente ("comece com 150 sementinhas grátis") sem
       virar uma categoria à parte do resto da economia. */
    expect(BONUS_INFLUENCIADORA).toBeGreaterThan(REFERRAL_REWARD);
    expect(BONUS_INFLUENCIADORA).toBeLessThanOrEqual(2 * REFERRAL_REWARD);
  });
});

describe("⚠️ o painel dela é resolvido pela SESSÃO, nunca por um código do cliente", () => {
  test("o e-mail vem do token, e o código sai do banco", () => {
    /* Se a tela mandasse o código e o servidor confiasse, bastaria trocar uma
       letra na requisição para ler o faturamento de outra criadora. Mesma regra
       de `contatoDaPaciente` no painel do médico. */
    const i = servidor.indexOf("meuPainelDeInfluenciadora");
    expect(i).toBeGreaterThan(-1);
    const corpo = servidor.slice(i);
    expect(corpo).toContain("u.user?.email");
    expect(corpo).toContain("const codigo = linha.code");
    /* O validador da função aceita SÓ o token — nenhum código, nenhum id. */
    const validador = corpo.slice(corpo.indexOf(".inputValidator"), corpo.indexOf(".handler"));
    expect(validador).toContain("accessToken");
    expect(validador).not.toContain("codigo");
  });

  test("a comparação de e-mail é em minúsculas dos dois lados", () => {
    /* O Supabase guarda o e-mail como a pessoa digitou. Sem normalizar, quem se
       cadastrou com maiúscula abriria a tela e veria "você ainda não é
       embaixadora" com o painel dela existindo do outro lado. */
    expect(servidor).toContain("toLowerCase()");
    /* ⚠️ **E o valor VAI ESCAPADO.** `.ilike("email", email)` cru fazia `%` e
       `_` do e-mail virarem CURINGAS: uma conta `maria_silva@hotmail.com`
       casava a linha de `maria.silva@hotmail.com` e abria o faturamento, o
       código e a lista de até 200 indicadas dela. É o mesmo vazamento que
       `appointments.functions.ts` já tinha consertado inline — e que três
       chamadas novas de afiliada nasceram sem. Ver `like-seguro.ts`, que tem
       catraca varrendo todo `.ilike(` do repo. */
    expect(servidor).toContain('.ilike("email", paraLike(email))');
    expect(servidor).not.toContain('.ilike("email", email)');
    const sql = readFileSync("supabase/APLICAR_INFLUENCIADORA.sql", "utf8");
    expect(sql).toContain("lower(email)");
  });

  test("«não é afiliada» NÃO é erro", () => {
    /* É o caso mais comum — qualquer gestante logada que abrir a URL. Devolver
       erro faria a tela mostrar "algo deu errado" para um estado normal. */
    expect(servidor).toContain("return { ok: true as const, painel: null }");
  });

  test("a tela não oferece cadastro de embaixadora", () => {
    /* Quem cria código é a equipe, no /admin: é parceria comercial com 50% de
       comissão, não formulário aberto. Um botão que promete o que ninguém
       aprovou é pior que não ter botão. */
    const tela = semComentarios("src/routes/influenciadora.tsx");
    expect(tela).not.toMatch(/cadastr\w*\s+como\s+embaixadora/i);
    expect(tela).toContain("Falar com a gente");
  });
});
