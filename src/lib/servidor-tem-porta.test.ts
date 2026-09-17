/**
 * TODA FUNÇÃO DE SERVIDOR PRECISA DE UMA PORTA.
 *
 * ⚠️ **Um recurso que existe inteiro no servidor e não tem chamador no app é
 * indistinguível de um recurso que não existe** — e este repositório já pagou
 * por isso cinco vezes: as sete funções da rede social sem porta,
 * `escadaDeTrofeus` escrita e nunca mostrada, `legendaSugerida` com uma única
 * ocorrência (a definição), as três conquistas da Escola do Bebê apontando para
 * uma tabela que nada escrevia, e agora `generateInviteCode` — com o app da
 * paciente pedindo, em três telas, um código que nenhum médico conseguia gerar.
 *
 * `rede-tem-porta.test.ts` fechava essa classe **só nos módulos da rede**. Esta
 * catraca varre TODOS os `*.functions.ts`.
 *
 * ⚠️ **Ela NOMEIA a dívida em vez de exigir um refator que ninguém pediu.** As
 * órfãs que já existiam entram na lista abaixo com a razão de cada uma; o que
 * ela impede é a PRÓXIMA. É a mesma forma de `rotas-sem-export-solto`, e a
 * razão é a mesma: catraca que obriga a um mutirão é catraca que alguém
 * desliga.
 *
 * ⚠️ **Bancada NÃO conta.** É exatamente onde as sete da rede social viveram
 * enquanto ninguém as alcançava.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

function arquivos(dir: string, pred: (n: string) => boolean, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const c = join(dir, n);
    if (statSync(c).isDirectory()) arquivos(c, pred, out);
    else if (pred(n)) out.push(c);
  }
  return out;
}

const ehFonte = (n: string) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n);
const doApp = (n: string) => ehFonte(n) && !n.startsWith("preview-");

const APP = arquivos("src/components", doApp)
  .concat(arquivos("src/routes", doApp))
  .map((f) => ({ f, t: semComentarios(readFileSync(f, "utf8")) }));

const LIBS = arquivos("src/lib", (n) => /\.functions\.ts$/.test(n) && !/\.test\./.test(n));
const TODAS_LIBS = arquivos("src/lib", (n) => /\.ts$/.test(n) && !/\.test\./.test(n)).map((f) => ({
  f,
  t: semComentarios(readFileSync(f, "utf8")),
}));

/**
 * As órfãs conhecidas, com a razão. Tirar uma daqui exige DAR a porta a ela —
 * nunca o contrário.
 */
const DIVIDA_CONHECIDA: Record<string, string> = {
  getMyAchievements: "a aba de conquistas usa outro caminho; esta ficou para trás",
  getCareMode: "o Modo Cuidado é lido do perfil em toda tela; esta é redundante",
};

function chamadoresNoApp(nome: string, modulo: string): string[] {
  /* ⚠️ Palavra INTEIRA, e só nos arquivos que IMPORTAM o módulo: nome de função
     é palavra comum em português, e `includes` já fez `bloquear` passar por
     `bloquearPeriodo` nesta base. */
  const re = new RegExp(`\\b${nome}\\b`);
  return APP.filter((a) => a.t.includes(modulo) && re.test(a.t)).map((a) => a.f);
}

function chamadoresNoServidor(nome: string, arquivo: string): string[] {
  const re = new RegExp(`\\b${nome}\\b`);
  return TODAS_LIBS.filter((l) => l.f !== arquivo && re.test(l.t)).map((l) => l.f);
}

type Orfa = { nome: string; modulo: string };

const ORFAS: Orfa[] = [];
for (const arquivo of LIBS) {
  const txt = semComentarios(readFileSync(arquivo, "utf8"));
  const modulo = arquivo.replace("src/lib/", "").replace(/\.ts$/, "");
  for (const m of txt.matchAll(/^export const (\w+) = createServerFn/gm)) {
    const nome = m[1];
    if (chamadoresNoApp(nome, modulo).length > 0) continue;
    /* Uma função chamada por outra função do servidor tem porta — só que
       indireta. Ela é legítima (o cron do push nativo é assim). */
    if (chamadoresNoServidor(nome, arquivo).length > 0) continue;
    ORFAS.push({ nome, modulo });
  }
}

describe("nenhuma função de servidor nova sem porta", () => {
  test("⚠️ as órfãs são exatamente as já conhecidas", () => {
    const novas = ORFAS.filter((o) => !(o.nome in DIVIDA_CONHECIDA));
    expect(
      novas.map((o) => `${o.nome} (${o.modulo}) — escrita, testada, e inalcançável no app`),
    ).toEqual([]);
  });

  test("⚠️ a dívida não cresce, e cada linha dela tem razão escrita", () => {
    for (const [nome, razao] of Object.entries(DIVIDA_CONHECIDA)) {
      expect(razao.length).toBeGreaterThan(20);
      expect(nome.length).toBeGreaterThan(2);
    }
    /* ⚠️ Ela pode ENCOLHER — e encolher é o objetivo. O que não pode é uma
       entrada ficar aqui depois de ganhar porta: seria uma lista de exceções
       que descreve um problema que não existe mais, e a próxima pessoa
       aprenderia a não confiar nela. */
    const aindaOrfas = new Set(ORFAS.map((o) => o.nome));
    const jaTemPorta = Object.keys(DIVIDA_CONHECIDA).filter((n) => !aindaOrfas.has(n));
    expect(jaTemPorta).toEqual([]);
  });

  test("a varredura de fato encontra alguma coisa", () => {
    /* ⚠️ Catraca que passa em vazio é catraca que mente: se o extrator parar de
       reconhecer `createServerFn`, tudo acima fica verde para sempre. */
    expect(LIBS.length).toBeGreaterThan(10);
    expect(APP.length).toBeGreaterThan(20);
  });
});

describe("os consultórios do médico chegam à paciente", () => {
  const TELA = semComentarios(readFileSync("src/components/consultorios-do-medico.tsx", "utf8"));
  const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

  test("⚠️ `listDoctorAddresses` deixou de ser órfã", () => {
    expect(chamadoresNoApp("listDoctorAddresses", "doctor-addresses.functions").length).toBe(1);
  });

  test("⚠️ e a lista é montada no cartão do médico DELA", () => {
    /* O componente existir não basta. */
    expect(CONTA).toContain("<ConsultoriosDoMedico doctorId={doctor.id} />");
  });

  test("⚠️ 'não consegui ler' NÃO vira 'ele não tem consultório'", () => {
    /* Ela concluiria que precisa perguntar o endereço — ou, pior, iria ao
       antigo. Mesma classe da busca de obstetra e da agenda. */
    expect(TELA).toMatch(/if \(!r\.ok\)/);
    expect(TELA).toContain('setEstado("falhou")');
    expect(TELA).toContain("onClick={() => void carregar()}");
  });

  test("⚠️ sem endereço a seção NÃO existe — nunca um 'nenhum cadastrado'", () => {
    /* Ela não pode fazer nada com essa frase, e ela insinua um problema com o
       médico dela que provavelmente não existe. */
    expect(TELA).toContain("if (lista.length === 0) return null;");
  });

  test("⚠️ o mapa abre por `https://`, nunca por esquema nativo", () => {
    /* `geo:` e `maps:` não existem no navegador, e num PWA instalado o link
       simplesmente não faria nada — sem erro nenhum. Mesma lição do
       `itms-apps://` da tela de assinatura. */
    expect(TELA).toContain("https://www.google.com/maps/search/");
    expect(TELA).not.toMatch(/href=\{`(geo|maps|comgooglemaps):/);
  });

  test("⚠️ o principal vem primeiro, e o chip só aparece com mais de um", () => {
    /* Com um endereço só, "principal" é ruído: não há do que distinguir. */
    expect(TELA).toContain(
      "Number(b.is_primary) - Number(a.is_primary) || a.position - b.position",
    );
    expect(TELA).toContain("a.is_primary && ordenados.length > 1");
  });

  test("os alvos de toque têm 44px", () => {
    const links = TELA.match(/min-h-\[44px\]/g) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});
