/**
 * TRÊS PORTAS QUE ESTAVAM ABERTAS.
 *
 * Achados de uma varredura de doze agentes sobre o Segundo Cérebro. Os três
 * têm a mesma forma: uma defesa que existe, e um caminho que passa por fora.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chat = readFileSync("src/routes/api/chat.ts", "utf8");
/* SEM COMENTÁRIOS. Um verificador burlou as asserções abaixo movendo o valor
   para uma variável e deixando a linha original DENTRO de um comentário:
     const papelDeSaida = null;
     /* .update({ clinic_id: null, clinic_role: "member" }) *\/
     ... .update({ clinic_id: null, clinic_role: papelDeSaida })
   A porta de saída voltava a falhar sempre (a coluna é NOT NULL) e os testes
   continuavam verdes. Asserção sobre CÓDIGO, nunca sobre prosa. */
const clinica = readFileSync("src/lib/clinic.functions.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
const sql = readFileSync("supabase/APLICAR_PENDENTES.sql", "utf8");

describe("o limitador do chat não é desligável por uma string inventada", () => {
  /**
   * A chave saía do SUFIXO do header `Authorization`, sem validação nenhuma.
   * `Bearer <32 aleatórios>` a cada requisição fazia o balde nunca acumular —
   * e, de quebra, pulava o teto global do site anônimo, que só vale para
   * chaves que NÃO começam com `u:`. Depois disso o token é rejeitado, o fluxo
   * segue com o prompt público e o modelo é chamado na nossa chave.
   * Duas defesas de custo desligadas por uma string.
   */
  test("a chave vem do usuário RESOLVIDO, não do header", () => {
    expect(chat).toContain("const usuarioDoLimite = await usuarioDaRequisicao(request)");
    expect(chat).toContain("`u:${usuarioDoLimite.id}`");
  });

  test("token inválido cai no balde de IP", () => {
    /* O IP passou a ser calculado UMA vez, acima, para que o portão de Auth e
       o balde não possam discordar sobre quem é o cliente. A asserção é sobre
       o invariante — anônimo vai para um balde de IP —, não sobre a grafia. */
    const i = chat.indexOf("const usuarioDoLimite");
    expect(chat.slice(i, i + 300)).toContain("`ip:${ipDaRequisicao}`");
    expect(chat).toContain("const ipDaRequisicao = clientIp(request)");
  });

  test("o sufixo do header não é usado em lugar nenhum", () => {
    expect(chat).not.toContain("auth.slice(-32)");
  });
});

describe("o texto livre da paciente não reescreve o prompt", () => {
  test("o bloco de pendências higieniza antes de interpolar", () => {
    /* `brain_gaps.question` é o que ela digitou, cortado em 300 caracteres e
       mais nada. Ia cru para o system prompt, sob o rótulo "fonte: sistema" —
       o mesmo vetor que a memória já fechava. */
    expect(chat).toContain("const minha = memoriaSegura(textoDela.get(g.id)");
  });
});

describe("a porta de saída da clínica abre", () => {
  /**
   * Um admin adiciona qualquer médico só com o e-mail — sem convite, sem
   * aceite — e passa a operar o Segundo Cérebro dele e a ler as conversas das
   * pacientes dele com a IA. O próprio comentário do código admitia isso e
   * dizia "agora ele tem como sair".
   *
   * Não tinha: `sairDaClinica` escrevia `clinic_role: null` numa coluna
   * `NOT NULL DEFAULT 'member'` — o update falhava sempre — e nenhuma tela
   * chamava a função.
   */
  test("a coluna é NOT NULL — escrever null falha", () => {
    /* O fato que torna o defeito real, e não teórico. */
    expect(sql).toContain(
      "ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS clinic_role text NOT NULL DEFAULT 'member'",
    );
  });

  test("a saída grava 'member', o DEFAULT da coluna", () => {
    const i = clinica.indexOf("export const sairDaClinica");
    expect(i).toBeGreaterThan(-1);
    const janela = clinica.slice(i, i + 1800);
    expect(janela).toContain('.update({ clinic_id: null, clinic_role: "member" })');
    expect(janela).not.toContain("clinic_role: null");
  });

  test("e o papel é um LITERAL — nada de variável no meio do caminho", () => {
    /* A forma exata da burla: `clinic_role: papelDeSaida`. Uma variável ali
       significa que o valor escrito não é mais visível neste arquivo, e a
       asserção de cima passa a provar um comentário. */
    const i = clinica.indexOf("export const sairDaClinica");
    const janela = clinica.slice(i, i + 1800);
    const escritas = [...janela.matchAll(/clinic_role:\s*([^,}\s]+)/g)].map((m) => m[1]);
    expect(escritas).toEqual(['"member"']);
  });

  test("e a falha não vira sucesso silencioso", () => {
    const i = clinica.indexOf("export const sairDaClinica");
    expect(clinica.slice(i, i + 1800)).toContain("[clínica] o médico não conseguiu sair");
  });

  test("existe um botão, e ele fica onde o médico anexado consegue ver", () => {
    /* A aba Clínica exige o plano Pro Equipe. O médico ANEXADO pode não ter
       esse plano — ele veria "não liberado" no lugar da porta. Por isso o
       cartão mora em Meu Perfil, que todo médico vê. */
    expect(painel).toContain("function SairDaClinicaCard");
    expect(painel).toContain("<SairDaClinicaCard tokenFn={token} />");
    const i = painel.indexOf('{tab === "Meu Perfil" && (');
    expect(painel.slice(i, i + 900)).toContain("SairDaClinicaCard");
  });

  test("o dono da clínica não vê a porta — ele não pode sair", () => {
    /* Sair deixaria a clínica sem administrador e os membros presos de vez. */
    const i = painel.indexOf("function SairDaClinicaCard");
    expect(painel.slice(i, i + 1200)).toContain('res.clinic.role === "member"');
  });
});
