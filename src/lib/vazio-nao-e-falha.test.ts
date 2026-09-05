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

/** ⚠️ O SEGUNDO corte (set/2026): as contrações. Mesma lição do bloco acima,
 *  e a razão de o helper aceitar o arquivo — sem ele, mover a tela deixaria
 *  vermelha a catraca que guarda o único botão do 192 desta aba. */
const CONTRACOES = semComentarios(readFileSync("src/components/contracoes-tab.tsx", "utf8"));

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
  const c = componente("ContracoesTab", CONTRACOES);

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

describe("⚠️ a SÉTIMA — a carteirinha de emergência (set/2026)", () => {
  /* Ela ficou de pé quando as seis foram consertadas, e é a de maior
     consequência: `CardTab` fazia `if (!profile) return "Preencha seu perfil
     primeiro"`, e `profile` vinha de uma leitura cujo erro era DESCARTADO
     (`const { data } = perfilRes`). Uma oscilação de rede transformava o
     documento que ela mostra no pronto-socorro — tipo sanguíneo, alergias,
     medicações, contato de emergência, o QR — numa frase que é falsa, que
     culpa ela, e que a manda ao Perfil refazer o que já existe.
     A ironia estava no próprio arquivo: o comentário do QR promete "funciona
     offline" sobre uma tela que não chegava a montar sem rede. */
  const CONTA = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  test("o erro da leitura do perfil NÃO é descartado", () => {
    /* ⚠️ A âncora NÃO é `setProfile(data)`: ele aparece CINCO vezes neste
       arquivo, e a primeira é outra leitura — a armadilha de substring que
       este repositório já pagou uma dúzia de vezes. Quem identifica o lugar é
       o estado que decide a tela. */
    const i = CONTA.indexOf("setPerfilInstavel(");
    expect(i).toBeGreaterThan(-1);
    const decisao = CONTA.slice(i, CONTA.indexOf(";", i));
    /* E ela sai do ERRO da leitura, nunca de um booleano solto: com
       `setPerfilInstavel(false)` cravado, a tela volta a acusar a paciente. */
    const nomeDoErro = decisao.match(/!!\s*(\w+)/)?.[1];
    expect(nomeDoErro).toBeTruthy();
    const desestrutura = CONTA.slice(CONTA.lastIndexOf("const {", i), i);
    expect(desestrutura).toContain(`error: ${nomeDoErro}`);
  });

  test("⚠️ a falha vem ANTES do vazio — trocadas, ela lê a acusação", () => {
    const vazio = CONTA.indexOf("Preencha seu perfil primeiro");
    expect(vazio).toBeGreaterThan(-1);
    const falha = CONTA.indexOf("a sua carteirinha");
    expect(falha).toBeGreaterThan(-1);
    expect(falha).toBeLessThan(vazio);
    /* E o que ela vê é o componente único desta classe, não um texto novo. */
    const trecho = CONTA.slice(falha - 400, vazio);
    expect(trecho).toContain("NaoConsegueLer");
  });

  test("⚠️ o sossego dela dá o caminho de emergência, e não só consolo", () => {
    /* É a única das sete em que a paciente pode estar num pronto-socorro
       agora. A frase tem de dizer o que fazer sem o app. */
    const i = CONTA.indexOf("a sua carteirinha");
    const bloco = CONTA.slice(i, i + 320);
    expect(bloco).toContain("192");
  });
});

describe("⚠️ a casca offline não pode nomear o médico errado", () => {
  /* `native/shell/index.html` é a única coisa dentro do aparelho quando o
     Capacitor não alcança o site. Ela é um arquivo ESTÁTICO: sem sessão, sem
     banco, sem como saber de quem é a paciente. Havia ali o telefone do
     consultório FUNDADOR rotulado só "Consultório", oferecido a paciente de
     qualquer médico da plataforma — exatamente o que `emergency-sheet.tsx`
     gastou uma decisão inteira para não fazer.
     ⚠️ Hoje a tela é INALCANÇÁVEL (não há `server.errorPath` no
     `capacitor.config.ts`), e é isso que torna este conserto barato: quem
     ligar o `errorPath` amanhã não liga junto um vazamento. */
  const CASCA = readFileSync("native/shell/index.html", "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const MEDICO = readFileSync("src/lib/doctor.config.ts", "utf8");

  test("o 192 fica — ele é certo para todo mundo e funciona sem rede", () => {
    expect(CASCA).toContain('href="tel:192"');
  });

  test("⚠️ e nenhum outro telefone, porque ela não sabe de quem é a paciente", () => {
    const tels = CASCA.match(/href="tel:[^"]+"/g) ?? [];
    expect(tels).toEqual(['href="tel:192"']);
  });

  test("⚠️ o número do consultório fundador não aparece — nem em outro formato", () => {
    /* A âncora sai do PRÓPRIO `doctor.config.ts`: cravar o número aqui faria o
       teste envelhecer no dia em que ele mudar, e envelhecer para o lado de
       aprovar. */
    const numero = MEDICO.match(/wa\.me\/(\d+)/)?.[1];
    expect(numero).toBeTruthy();
    const soDigitos = CASCA.replace(/\D/g, "");
    expect(soDigitos).not.toContain(numero!);
    expect(soDigitos).not.toContain(numero!.replace(/^55/, ""));
  });
});
