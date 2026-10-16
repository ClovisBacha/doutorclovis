/**
 * "NÃO CONSEGUI LER" NÃO PODE TER A CARA DE "VOCÊ NÃO TEM CONSULTA".
 *
 * ⚠️ `fetchAppointmentsCached` devolvia lista VAZIA numa falha de primeira
 * carga, e as duas telas que a consomem escreviam afirmações:
 *
 *   · o cartão da agenda — **"Nenhuma consulta marcada ainda."**
 *   · a aba Consultas — **"Você ainda não tem consultas por aqui. Agende a
 *     primeira — leva 1 minuto."**
 *
 * Quem tem consulta confirmada para amanhã abria o app para conferir a hora e
 * lia que não tinha consulta nenhuma — e a segunda frase ainda a convida a
 * marcar OUTRA.
 *
 * ⚠️ **Falta em consultório de alto risco é vaga perdida duas vezes.** É a
 * frase que abre o desenho dos lembretes de 24 h e 4 h; este defeito produzia
 * exatamente a perda que aquele sistema inteiro existe para impedir, e do lado
 * de dentro. Pior: o push do servidor continuaria dizendo "consulta amanhã"
 * enquanto a tela dizia que não havia nenhuma.
 *
 * ⚠️ É a MESMA correção que a Comunidade e a busca de obstetra já ganharam.
 * Terceira vez que esta classe aparece — por isso ela tem catraca.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/** ⚠️ A prosa sai antes: a tela CITA as frases proibidas para explicá-las. */
const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  const abre = fonte.indexOf("{", i);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

const CARREGADOR = corpoDe(CONTA, "async function fetchAppointmentsCached(");

describe("o carregador distingue falha de vazio", () => {
  test("⚠️ ele devolve a bandeira, e não um array pelado", () => {
    expect(CARREGADOR.length).toBeGreaterThan(0);
    expect(CONTA).toContain("Promise<ListaDeConsultas>");
    expect(CONTA).toContain("appointments: MyAppointment[]; instavel: boolean");
  });

  test("⚠️ os DOIS caminhos de falha levantam a bandeira", () => {
    /* Sem sessão e `ok: false` são o mesmo caso: ninguém leu lista nenhuma. */
    const falhas = CARREGADOR.match(/instavel: !apptsCache/g) ?? [];
    expect(falhas.length).toBe(2);
  });

  test("⚠️ servindo CACHE a bandeira NÃO sobe", () => {
    /* Cache é dado de verdade, no máximo alguns segundos velho: a lista não
       mente, e um aviso sobre ela seria ruído que ensina a ignorar o aviso.
       `!apptsCache` é exatamente essa distinção — some quando há cache. */
    expect(CARREGADOR).toContain("instavel: false");
    expect(CARREGADOR).not.toMatch(/instavel: true/);
  });
});

describe("as duas frases que afirmam", () => {
  test("⚠️ 'Nenhuma consulta marcada ainda' não sai numa falha", () => {
    const i = CONTA.indexOf("Nenhuma consulta marcada ainda");
    expect(i).toBeGreaterThan(-1);
    /* A frase tem de estar no ramo `: instavel ? … : "…"`. */
    const antes = CONTA.slice(Math.max(0, i - 300), i);
    expect(antes).toContain("instavel");
  });

  test("⚠️ o convite a 'agendar a primeira' não sai numa falha", () => {
    /* É a pior frase possível para quem já tem consulta e veio conferir a
       hora — ela marcaria uma segunda. */
    /* ⚠️ O que garante o ramo é a ORDEM DA CADEIA, e nunca a distância: a
       primeira versão desta asserção olhava 900 caracteres antes da frase e
       ficou VERMELHA sobre o código certo, porque o bloco âmbar do estado de
       falha é mais longo que isso. Medir distância mente nas duas direções, e
       este repositório já pagou por ela quatro vezes. */
    const carregando = CONTA.indexOf("{loadingAppts ? (");
    const falha = CONTA.indexOf("apptsInstavel ? (");
    const convite = CONTA.indexOf("Você ainda não tem consultas por aqui");
    expect(carregando).toBeGreaterThan(-1);
    expect(falha).toBeGreaterThan(carregando);
    expect(convite).toBeGreaterThan(falha);
  });

  test("⚠️ nenhum dos dois textos de falha conclui sobre a agenda dela", () => {
    /* O app pode dizer que ELE falhou, nunca que ela não tem consulta. */
    for (const marca of [
      "Não consegui carregar sua agenda agora — se você",
      "Não consegui carregar sua agenda agora\n",
    ]) {
      if (!CONTA.includes(marca)) continue;
      const bloco = CONTA.slice(CONTA.indexOf(marca), CONTA.indexOf(marca) + 700);
      expect(bloco).toMatch(/continua marcada/);
    }
    /* As duas dizem que a consulta dela segue de pé. */
    expect(CONTA.match(/continua marcada/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("⚠️ a falha da aba tem saída, e ela força a releitura", () => {
    /* Sem `force`, o cache de 30 s devolveria a mesma lista vazia sem tocar na
       rede — um botão que não faz nada. */
    const carga = corpoDe(CONTA, "async function loadAppts(");
    expect(carga).toContain("fetchAppointmentsCached(true)");
    expect(CONTA).toContain("onClick={() => void loadAppts()}");
    expect(CONTA).toMatch(/min-h-\[44px\][^"]*"\s*>\s*Tentar de novo/s);
  });
});
