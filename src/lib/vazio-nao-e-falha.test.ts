/**
 * "NÃO CONSEGUI LER" NÃO PODE TER CARA DE "NÃO HÁ NADA".
 *
 * ⚠️ Seis telas do app da paciente descartavam o erro da leitura — `data ?? []`
 * ou um `{ ok: false }` que chega numa resposta **200 NORMAL** e que nenhum
 * `try/catch` pega — e desenhavam um vazio que AFIRMA um fato falso. O custo
 * nunca é a tela feia; é a conclusão que ela induz, e o que a paciente faz com
 * ela:
 *
 *   · contrações — a pior. `analysisWindow.length >= 2` esconde o banner de
 *     análise, e o banner é o ÚNICO lugar desta tela com o botão "Ligar 192".
 *     **Uma falha de rede silenciava o caminho de emergência, em trabalho de
 *     parto** — e a contração aberta não era retomada, então o cronômetro
 *     voltava para "Iniciar" com uma contração em curso no banco.
 *   · teleconsulta — o médico abre a sala, ela lê "Nenhuma consulta agendada".
 *   · consultas salvas — ela abre para reler a posologia que o médico ditou.
 *   · ciclo — a data da última menstruação é a base da DUM e da DPP.
 *   · diário — "Seu diário começará aqui" para quem escreve há meses.
 *   · álbum — "Álbum (0 memórias)" sobre as fotos da gestação.
 *
 * ⚠️ **DUAS DELAS ERAM DE DUAS CAMADAS.** `getRecentCycles` e `getMyAlbumPosts`
 * devolviam `ok: true` com lista vazia sobre um erro — um vazio AUTENTICADO
 * COMO VERDADE, que nenhuma correção só de tela alcançaria.
 *
 * ⚠️ **E A CORREÇÃO JÁ EXISTIA, aplicada em UM fluxo.** Os agendamentos
 * distinguem instável de vazio desde ago/2026, com o comentário explicando o
 * custo. É a forma mais comum de defeito deste repositório: a régua aplicada
 * num lugar e deixada de pé em cinco vizinhos.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** ⚠️ A prosa deste repositório CITA o que ela proíbe — sai antes da busca. */
/** ⚠️ Corta na próxima função exportada, nunca num `});` — o primeiro deles
 *  é o `.order(..., { ascending: false });`, e cortar ali deixava de fora
 *  justamente a linha que este teste existe para cobrar. */
const proximoExport = (f: string, i: number) => {
  const j = f.indexOf("\nexport ", i + 1);
  return j === -1 ? undefined : j;
};

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

/**
 * O corpo de um componente de topo, do `function X(` até o próximo `function`
 * na coluna zero.
 *
 * ⚠️ **Não é uma janela de N caracteres.** `minha-conta.tsx` tem 21 mil linhas
 * e as mesmas palavras aparecem dezenas de vezes; uma janela larga ficaria
 * verde com a checagem apagada, que é a armadilha que este repositório já
 * pagou onze vezes.
 */
function componente(nome: string, arquivo = CONTA) {
  const i = arquivo.indexOf(`function ${nome}(`);
  expect(i).toBeGreaterThan(-1);
  const j = arquivo.indexOf("\nfunction ", i + 1);
  return arquivo.slice(i, j === -1 ? undefined : j);
}

/**
 * ⚠️ **A TELA CARREGA O PRÓPRIO ARQUIVO, e isso é o conserto de uma lição.**
 * `minha-conta.tsx` está sendo partido em componentes (set/2026), e a primeira
 * aba a sair — o ciclo menstrual — deixou esta catraca vermelha só porque o
 * caminho mudou. A garantia não mudou uma linha; o que faltava era o teste
 * saber onde procurar. Com o arquivo ao lado do nome, o próximo corte não
 * repete isto.
 */
const CICLO = semComentarios(readFileSync("src/components/ciclo-menstrual-tab.tsx", "utf8"));

/** As cinco de mesma forma: lê o erro, e o vazio vem DEPOIS do instável. */
const TELAS = [
  { nome: "JournalTab", vazio: "Seu diário começará aqui", marca: "setInstavel(true)" },
  { nome: "ConsultasTab", vazio: "Nenhuma consulta salva ainda", marca: "setNotesInstavel(true)" },
  {
    nome: "TeleconsultaTab",
    vazio: "Nenhuma consulta agendada no momento",
    marca: "setInstavel(true)",
  },
  {
    nome: "CicloMenstrualTab",
    vazio: "Nenhum ciclo registrado",
    marca: "setInstavel(true)",
    arquivo: CICLO,
  },
  { nome: "AlbumTab", vazio: "Nenhuma memória ainda", marca: "setInstavel(true)" },
] as { nome: string; vazio: string; marca: string; arquivo?: string }[];

describe("o vazio não pode ser a falha", () => {
  for (const { nome, vazio, marca, arquivo } of TELAS) {
    test(`⚠️ ${nome} distingue "não consegui" de "não há nada"`, () => {
      const c = componente(nome, arquivo);
      /* ⚠️ A METADE DA LEITURA, e ela é a que importa. A primeira versão deste
         teste cobrava só o RENDER — e três mutações passaram verdes, porque
         apagar a checagem do erro não tira `instavel` da tela. O estado
         existia e ninguém mais o ligava. */
      expect(c).toContain(marca);
      /* A GARANTIA, e não a grafia: existe um estado de falha, ele é desenhado
         pelo componente único, e o texto que AFIRMA o vazio só é alcançado
         depois dele. */
      expect(c).toMatch(/instavel/i);
      expect(c).toContain("<NaoConsegueLer");
      const falha = c.search(/<NaoConsegueLer/);
      expect(c.indexOf(vazio)).toBeGreaterThan(falha);
    });
  }

  test("⚠️ o componente da falha é UM só, e não cinco cópias", () => {
    /* Cinco cópias do mesmo JSX divergiriam no primeiro ajuste de texto, e a
       que divergisse seria justamente a menos olhada. */
    expect(CONTA).not.toMatch(/Não consegui carregar (seu diário|seus ciclos|seu álbum)/);
  });

  test("⚠️ a frase de sossego é PROP, e não fixa", () => {
    /* "O que você registrou continua salvo" é verdade no diário e MENTIRA na
       teleconsulta, onde quem marcou foi o consultório. Uma frase genérica
       seria a segunda mentira no lugar da primeira. */
    const comp = readFileSync("src/components/nao-consegui-ler.tsx", "utf8");
    expect(comp).toMatch(/sossego:\s*string/);
    expect(comp).toMatch(/\{sossego\}/);
    const tele = componente("TeleconsultaTab");
    expect(tele).toMatch(/ela continua marcada/);
  });
});

describe("⚠️ as contrações: a falha não pode calar o 192", () => {
  const c = componente("ContracoesTab");

  test("a leitura confere o erro e não vira lista vazia", () => {
    expect(c).toMatch(/const \{ data, error \} = await[\s\S]{0,200}contraction_logs/);
    expect(c).not.toMatch(/setContractions\(data \?\? \[\]\)/);
  });

  test("⚠️ o banner de análise não é desenhado sobre uma lista que falhou", () => {
    /* Sem isto, `analysisWindow` fica vazio e o banner some — junto com o
       único botão do SAMU desta tela. */
    expect(c).toMatch(/!instavel && analysisWindow\.length >= 2/);
  });

  test("⚠️ e o aviso de falha OFERECE o caminho que o banner daria", () => {
    /* O app não pode INVENTAR uma análise que não tem; o que ele pode, e deve,
       é dizer que não conseguiu ler E dar o telefone. Errar para o lado de
       mandar ligar é o único lado seguro aqui. */
    /* ⚠️ O bloco INTEIRO por contagem de chaves, nunca uma janela de N
       caracteres: `ContracoesTab` tem um segundo `tel:192` (o do banner de
       análise) a menos de 1400 caracteres daqui, e com a janela a mutação que
       APAGAVA o botão do aviso passava verde. Décima segunda vez que medir
       distância mente nesta base. */
    const i = c.search(/\{instavel && \(/);
    expect(i).toBeGreaterThan(-1);
    let n = 0;
    let fim = i;
    for (let j = i; j < c.length; j++) {
      if (c[j] === "{") n++;
      else if (c[j] === "}" && --n === 0) {
        fim = j + 1;
        break;
      }
    }
    expect(fim).toBeGreaterThan(i);
    const bloco = c.slice(i, fim);
    expect(bloco).toContain('href="tel:192"');
    expect(bloco).toMatch(/não espere o app/i);
  });
});

describe("⚠️ as duas de DUAS camadas", () => {
  test("getRecentCycles não devolve `ok: true` sobre um erro", () => {
    const f = semComentarios(readFileSync("src/lib/saudefeminina.functions.ts", "utf8"));
    const i = f.indexOf("export const getRecentCycles");
    expect(i).toBeGreaterThan(-1);
    const trecho = f.slice(i, proximoExport(f, i));
    expect(trecho).toMatch(/data: rows, error/);
    expect(trecho).toMatch(/if \(error \|\| !rows\) return \{ ok: false/);
  });

  test("getMyAlbumPosts não devolve `ok: true` sobre um erro", () => {
    const f = semComentarios(readFileSync("src/lib/family.functions.ts", "utf8"));
    const i = f.indexOf("export const getMyAlbumPosts");
    expect(i).toBeGreaterThan(-1);
    const trecho = f.slice(i, proximoExport(f, i));
    expect(trecho).toMatch(/data: posts, error/);
    expect(trecho).toMatch(/if \(error \|\| !posts\) return \{ ok: false/);
  });
});
