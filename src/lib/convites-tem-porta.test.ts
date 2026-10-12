/**
 * O APP PEDIA UM CÓDIGO QUE NINGUÉM CONSEGUIA GERAR.
 *
 * ⚠️ Três telas da paciente — a oferta Premium, o Caminho e a Jornada do bebê —
 * dizem **"Digite o código do seu médico"** e prometem **um ano de Premium**.
 * `generateInviteCode` e `getMyInviteInfo` estavam escritas, testadas, com a
 * cota mensal inteira resolvida no servidor — e com **zero chamadores no app**.
 * O médico não tinha onde gerar.
 *
 * O desfecho é o pior possível para os dois lados: ela pede o código, ele
 * procura no painel e não acha, e a conclusão razoável dela é que ele não quis
 * dar. **Um recurso que existe inteiro no servidor e não tem porta é
 * indistinguível de um recurso que não existe** — é a mesma família das sete
 * funções da rede social que viveram meses sem chamador, e a razão de
 * `rede-tem-porta.test.ts` existir. Ela não alcançava este módulo.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/** Todo `.ts`/`.tsx` do app — bancada NÃO conta, que é onde estas viveriam. */
function arquivosDoApp(dir: string, fora: string[]): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) out.push(...arquivosDoApp(cheio, fora));
    else if (
      /\.tsx?$/.test(nome) &&
      !/\.test\.tsx?$/.test(nome) &&
      !fora.some((f) => nome.startsWith(f))
    )
      out.push(cheio);
  }
  return out;
}

const APP = arquivosDoApp("src/components", ["preview-"])
  .concat(arquivosDoApp("src/routes", ["preview-"]))
  .map((f) => ({ f, txt: semComentarios(readFileSync(f, "utf8")) }));

function chamadores(nome: string): string[] {
  /* ⚠️ Palavra INTEIRA, e só nos arquivos que IMPORTAM o módulo: nome de função
     é palavra comum, e `includes` já fez `bloquear` passar por
     `bloquearPeriodo` nesta base. */
  const re = new RegExp(`\\b${nome}\\b`);
  return APP.filter((a) => a.txt.includes("invites.functions") && re.test(a.txt)).map((a) => a.f);
}

describe("as três funções de convite são alcançáveis", () => {
  for (const fn of ["generateInviteCode", "getMyInviteInfo", "redeemInviteCode"]) {
    test(`⚠️ \`${fn}\` tem chamador no app`, () => {
      expect(chamadores(fn).length).toBeGreaterThan(0);
    });
  }

  test("⚠️ a porta do médico é montada no PAINEL, não só escrita", () => {
    /* O componente existir não basta — `escadaDeTrofeus` existia, testada, com
       zero chamadores. O que fecha o laço é ele ser renderizado. */
    const painel = semComentarios(readFileSync("src/routes/_authenticated/painel.tsx", "utf8"));
    expect(painel).toContain("<ConvitesDoMedico");
    expect(painel).toContain('from "@/components/convites-do-medico"');
  });
});

const TELA = semComentarios(readFileSync("src/components/convites-do-medico.tsx", "utf8"));

/** Corpo por CONTAGEM DE CHAVES — nunca janela de caracteres. */
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

describe("a tela do médico não mente sobre a cota", () => {
  test("⚠️ `ok: false` é LIDO nos DOIS caminhos — 200 normal, não exceção", () => {
    /* Sem ler, a tela mostraria "0 de 0" e ele concluiria que o plano dele não
       dá convites. Um `try/catch` em volta não pega este caso.

       ⚠️ Ancorado no CORPO de cada função: `if (!r.ok)` aparece nas duas, e
       sobre o arquivo inteiro a mutação que apagava a de `carregar` passava
       verde. Enésima vez que "outra ocorrência do mesmo nome" engana um teste
       nesta base. */
    const carregar = corpoDe(TELA, "async function carregar(");
    const gerar = corpoDe(TELA, "async function gerar(");
    expect(carregar.length).toBeGreaterThan(0);
    expect(gerar.length).toBeGreaterThan(0);
    expect(carregar).toMatch(/if \(!r\.ok\)/);
    expect(gerar).toMatch(/if \(!r\.ok\)/);
  });

  test("⚠️ contagem ILEGÍVEL não vira '0 usados'", () => {
    /* Um painel que afirma "25 disponíveis" sobre uma leitura que falhou faz o
       médico contar com convites que talvez não tenha. */
    expect(TELA).toContain("info.usedIlegivel ?");
    expect(TELA).toMatch(/Não consegui conferir quantos você já usou/);
  });

  test("⚠️ o botão desliga na cota ESGOTADA, e não na ilegível", () => {
    /* Esgotada: o servidor recusa, então um botão aceso promete o que não
       acontece. Ilegível: ninguém sabe se acabou, e desligar tiraria dele uma
       capacidade que talvez tenha — na dúvida, quem decide é o servidor.

       ⚠️ Isto é o OPOSTO da decisão do presente entre amigas, e de propósito:
       lá o servidor não tem limite, e desabilitar pela contagem seria "o limite
       de volta, agora só na tela". */
    expect(TELA).toContain("disabled={gerando || (!info.usedIlegivel && info.remaining <= 0)}");
  });

  test("⚠️ `cota_ilegivel` NÃO é dito como 'acabou'", () => {
    /* Dizer "cota esgotada" sobre uma contagem que falhou faria o médico parar
       de tentar num mês em que ele ainda tem convites. */
    const i = TELA.indexOf("cota_ilegivel:");
    expect(i).toBeGreaterThan(-1);
    const frase = TELA.slice(i, TELA.indexOf("\n", i));
    expect(frase).toMatch(/tente de novo/i);
    expect(frase).not.toMatch(/esgotad|acabou|todos os convites/i);
  });

  test("⚠️ a falha de leitura tem saída", () => {
    expect(TELA).toContain('estado === "falhou"');
    expect(TELA).toContain("onClick={() => void carregar()}");
  });

  test("⚠️ o limite ético está na tela", () => {
    /* Toda tela que fala de Premium diz que o cuidado não depende dele — e aqui
       mais ainda, porque é o MÉDICO que vai repetir a frase para ela. */
    expect(TELA).toMatch(/Nada do cuidado dela/);
    expect(TELA).toMatch(/SOS/);
  });
});
