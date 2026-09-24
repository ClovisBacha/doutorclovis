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

import { semComentarios } from "@/lib/sem-comentarios";

/** ⚠️ A prosa deste repositório CITA o que ela proíbe — sai antes da busca. */
/** ⚠️ Corta na próxima função exportada, nunca num `});` — o primeiro deles
 *  é o `.order(..., { ascending: false });`, e cortar ali deixava de fora
 *  justamente a linha que este teste existe para cobrar. */
const proximoExport = (f: string, i: number) => {
  const j = f.indexOf("\nexport ", i + 1);
  return j === -1 ? undefined : j;
};

/* ⚠️ **O APAGADOR INGÊNUO CEGAVA 83 LINHAS DE `minha-conta.tsx`.** A forma de
   regex abre um "comentário" na barra-asterisco que vive DENTRO de uma string
   (`accept="image/…"`) e só o fecha centenas de linhas abaixo — e uma delas era
   o `AlbumTab`, cuja frase proibida reaparecia e deixava a asserção NEGATIVA
   verde. É exatamente a armadilha que `src/lib/sem-comentarios.ts` foi escrito
   para substituir: ela ancora a abertura no COMEÇO DA LINHA, que é onde todo
   comentário de bloco deste repositório começa. */

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

/** ⚠️ O QUINTO corte (set/2026): a saúde da mulher — o ciclo e os preventivos.
 *  Ela SOME por nove meses (`mostrarSaudeDaMulher`), e era a metade da grade da
 *  Saúde sem bancada nenhuma. Mesma lição dos blocos acima: a garantia não
 *  mudou, mudou o endereço. */
const MULHER = semComentarios(readFileSync("src/components/saude-mulher.tsx", "utf8"));

/** ⚠️ O TERCEIRO corte (set/2026): os chutes. Mesma lição, quarta vez — e é
 *  por isso que o helper aceita o arquivo ao lado do nome. */
const CHUTES = semComentarios(readFileSync("src/components/kicks-tab.tsx", "utf8"));

/** ⚠️ O SEXTO e o SÉTIMO da classe, fora da aba Saúde — ver o bloco no fim. */
const CANTINHO = semComentarios(readFileSync("src/components/cantinho-tab.tsx", "utf8"));

/** ⚠️ O QUARTO corte (set/2026): peso, pressão e glicemia. Quinta vez que uma
 *  catraca fica vermelha por mudança de caminho — e a razão de o helper aceitar
 *  o arquivo ao lado do nome. */
const SAUDE = semComentarios(readFileSync("src/components/health-tab.tsx", "utf8"));

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
  /*
    ⚠️ **AS TRÊS DA ABA SAÚDE (set/2026), e elas eram as que faltavam.**
    A auditoria da aba encontrou a mesma classe nas três telas mais clínicas
    que o coração abre, e nenhuma delas estava aqui:

      · `HealthTab` — a tela de peso, pressão e glicemia, e a OITAVA da classe.
        Com `data ?? []` a tela inteira virava a de quem acabou de instalar o
        app: quatro cartões em "—", os três gráficos sumindo, e a lista
        afirmando "Você ainda não registrou nada." sobre meses de medição.
        ⚠️ E o pior caso é o RE-READ: `add()` e `remove()` terminam chamando
        `load()`, então uma falha DEPOIS de um insert bem-sucedido apagava da
        tela o que ela acabou de gravar — e `health_logs` não tem chave única
        por dia, então registrar de novo duplica no prontuário do médico.
      · `KicksTab` — a tela que MEDE um sintoma vermelho. É a comparação com as
        sessões anteriores que responde "ele está se mexendo menos que o normal
        DELE?"; sem histórico, a tela não responde o que ela veio perguntar.
      · `HumorTab` — a curva de oito semanas do estado emocional dela. O
        Diário, que lê a MESMA tabela, já estava consertado desde ago/2026.
  */
  {
    nome: "HealthTab",
    vazio: "Você ainda não registrou nada",
    marca: "setInstavel(true)",
    arquivo: SAUDE,
  },
  {
    nome: "KicksTab",
    vazio: "Nenhuma sessão registrada ainda",
    marca: "setInstavel(true)",
    arquivo: CHUTES,
  },
  {
    nome: "HumorTab",
    vazio: "Nenhum registro ainda",
    marca: "setInstavel(true)",
  },
] as { nome: string; vazio: string; marca: string; arquivo?: string }[];

/**
 * A condição do `if` mais próximo ANTES de um ponto do texto.
 *
 * ⚠️ **ESTE HELPER É O CONSERTO DA PRÓPRIA CATRACA, e ele nasceu de seis
 * mutações que passaram VERDES.** A versão anterior cobrava
 * `expect(c).toContain("setInstavel(true)")` — ou seja, que a STRING existisse
 * no arquivo. Trocando `const { data, error } = await` por `const { data } =
 * await`, o `error` vira `undefined`, o `if (error)` nunca dispara, o estado de
 * falha nunca é ligado — **e a string continua lá.** O teste ficava verde sobre
 * o defeito exato que ele existe para pegar.
 *
 * O comentário antigo já contava metade da história ("a primeira versão cobrava
 * só o RENDER"); o conserto daquela vez trocou uma asserção de presença por
 * outra asserção de presença. O que faltava era cobrar a CORRENTE: quem liga o
 * estado de falha tem de estar dentro de um ramo que fala de ERRO.
 *
 * ⚠️ E é por CONTAGEM DE PARÊNTESES, nunca por janela de N caracteres: medir
 * distância mente no dia em que alguém acrescenta uma linha, e esta base já
 * pagou isso mais de dez vezes.
 */
function guardaDoIf(texto: string, ate: number): string {
  const i = texto.lastIndexOf("if (", ate);
  return i === -1 ? "" : texto.slice(i, ate);
}

/**
 * O guarda de um trecho de JSX: `{cond && (` — ou um `if (`, o que estiver
 * MAIS PERTO.
 *
 * ⚠️ São duas formas porque são duas naturezas. LIGAR o estado é uma
 * instrução, e ela mora sempre dentro de um `if`; DESENHAR é JSX, e ali o
 * guarda é `{instavel && …}`. Um helper só, procurando `if (`, dava a
 * condição de um `careMode` trinta linhas acima na `KicksTab` — e teria
 * reprovado código correto, que é como uma catraca ensina alguém a
 * desligá-la.
 */
function guardaDoJsx(texto: string, ate: number): string {
  const iIf = texto.lastIndexOf("if (", ate);
  const iChave = texto.lastIndexOf("{", ate);
  const i = Math.max(iIf, iChave);
  return i === -1 ? "" : texto.slice(i, ate);
}

/**
 * Fala de falha de leitura? `error`, `res.ok`, `!r.ok`, `err`…
 *
 * ⚠️ **E TAMBÉM A SESSÃO QUE NÃO RENOVOU** — `!s.session?.access_token`. Este
 * termo entrou quando a auditoria achou a MESMA classe num segundo ramo da
 * mesma função: `load()` começa pedindo a sessão, e o ramo de cima saía com a
 * lista vazia e `instavel` FALSO enquanto o de baixo (`res.ok === false`) já
 * estava consertado. "Não consegui ler" chegava à tela com a cara de "não há
 * nada" pela outra porta — e ele é alcançável: o portão de `_authenticated`
 * deixa entrar com token no aparelho, e `getSession()` devolve `session: null`
 * quando o refresh falha, que é o caso da rede ruim e não o do logout.
 *
 * ⚠️ O termo é ESPECÍFICO de propósito (`access_token`/`session?.`), e não um
 * `session` solto: um `if` que fale de sessão por qualquer outro motivo não
 * pode passar a autorizar o desenho do vazio.
 */
const FALA_DE_ERRO = /\berror\b|\.ok\b|\berr\b|access_token|session\?\./;

/**
 * O bloco da função que contém um ponto do texto — do `function …` ou do
 * `=> {` mais próximo até ele.
 *
 * ⚠️ **O RECORTE TEM DE SER A FUNÇÃO, e não o componente inteiro.** Uma tela
 * tem várias leituras: a `HealthTab` destrutura `error` no `load()`, no
 * `add()` e no `remove()`. Perguntar "existe algum `const { …, error } =
 * await` neste componente?" fica verde com o `error` do `load()` apagado,
 * porque o do `add()` continua lá — e é justamente o `load()` que decide se a
 * tela afirma o vazio.
 */
function blocoDaFuncao(texto: string, ate: number): string {
  const i = Math.max(texto.lastIndexOf("function ", ate), texto.lastIndexOf("=> {", ate));
  return i === -1 ? "" : texto.slice(i, ate);
}

describe("o vazio não pode ser a falha", () => {
  for (const { nome, vazio, marca, arquivo } of TELAS) {
    test(`⚠️ ${nome} distingue "não consegui" de "não há nada"`, () => {
      const c = componente(nome, arquivo);

      /* 1 · A METADE DA LEITURA — e agora ela é cobrada pela CORRENTE. Toda
         ocorrência que liga o estado de falha tem de estar dentro de um `if`
         que fala de erro. Sem isto, apagar o `error` do destructuring deixa
         a marca no arquivo e o teste verde. */
      const ligacoes: number[] = [];
      for (let k = c.indexOf(marca); k !== -1; k = c.indexOf(marca, k + 1)) ligacoes.push(k);
      expect(ligacoes.length).toBeGreaterThan(0);
      for (const k of ligacoes) {
        expect(guardaDoIf(c, k)).toMatch(FALA_DE_ERRO);
      }

      /* 2 · ⚠️ E O `error` PRECISA SER VINCULADO, NA MESMA FUNÇÃO — esta é a
         asserção que faltava, e sem ela TRÊS mutações passavam verdes. Tirar
         `error` do destructuring (`const { data, error } = await` →
         `const { data } = await`) deixa todo o resto no lugar: o `if (error)`
         continua escrito, o `setInstavel(true)` continua escrito, o guarda
         continua dizendo "error" — e a variável é `undefined`, então o ramo
         NUNCA dispara e a tela volta a afirmar o vazio.
         ⚠️ E a primeira tentativa de fechar isto também passou verde, por
         alternação frouxa (`… | \.ok\b`): `.ok` aparece em qualquer lugar de
         um componente grande. O que vale é a ORIGEM do valor que o guarda usa,
         dentro do bloco que o usa. */
      for (const k of ligacoes) {
        const guarda = guardaDoIf(c, k);
        if (/\berror\b/.test(guarda)) {
          /* ⚠️ `const` OU `let`: uma leitura com DEGRAU de coluna ausente
             precisa reatribuir (`let { data, error } = await …; if (error &&
             colunaAusente(error)) ({ data, error } = await …)`), e exigir a
             palavra `const` reprovava esse conserto — que só APERTA a garantia.
             O que se cobra é a ORIGEM do valor: `error` sai de um `await`
             DENTRO do bloco que o usa. */
          expect(blocoDaFuncao(c, k)).toMatch(/(?:const|let) \{[^}]*\berror\b[^}]*\} = await/);
        }
      }

      /* 3 · O RENDER: o componente único é desenhado, e a condição que o
         governa fala do estado de falha. Trocar por `if (false)` reprova. */
      const falha = c.search(/<NaoConsegueLer/);
      expect(falha).toBeGreaterThan(-1);
      expect(guardaDoJsx(c, falha)).toMatch(/instavel/i);

      /* 4 · E o texto que AFIRMA o vazio só é alcançado DEPOIS dele. */
      expect(c.indexOf(vazio)).toBeGreaterThan(falha);
    });
  }

  test('⚠️ os preventivos: a mentira é um NÚMERO — "Em atraso: 0"', () => {
    /*
      Esta não entra na lista acima porque a forma é outra: `PreventivosTab`
      não tem uma FRASE que afirme o vazio, tem três CONTADORES. Com a lista
      de lembretes vazia, todo exame cai em `status: "never"` e o topo diz
      "Em atraso: 0" — que é exatamente o que ela abriu a tela para conferir —
      e conta como "Nunca registrado" o Papanicolau que ela anotou no ano
      passado. Ou ela refaz um exame que já fez, ou conclui que o app perdeu
      o registro.

      ⚠️ E ERA DE DUAS CAMADAS: `getPreventiveReminders` devolvia `ok: true`
      com lista vazia sobre um erro — um vazio AUTENTICADO COMO VERDADE, que
      nenhuma correção só de tela alcançaria. O conserto certo já existia
      QUARENTA LINHAS ACIMA no mesmo arquivo, em `getRecentCycles`.
    */
    const servidor = semComentarios(readFileSync("src/lib/saudefeminina.functions.ts", "utf8"));
    const i = servidor.indexOf("export const getPreventiveReminders");
    expect(i).toBeGreaterThan(-1);
    const j = servidor.indexOf("\nexport ", i + 1);
    const fn = servidor.slice(i, j === -1 ? undefined : j);
    expect(fn).toMatch(/const \{ data: rows, error \} = await/);
    expect(fn).toMatch(/if \(error\) return \{ ok: false as const/);

    const c = componente("PreventivosTab", MULHER);
    /* A CORRENTE, e não a presença da string — a mesma régua do bloco acima:
       quem liga o estado de falha está dentro de um ramo que fala de erro. */
    const k = c.indexOf("setInstavel(true)");
    expect(k).toBeGreaterThan(-1);
    expect(guardaDoIf(c, k)).toMatch(FALA_DE_ERRO);
    /* A falha vem ANTES de qualquer contagem — os três números do topo mentem
       juntos, e o de atraso é o que ela veio ler. */
    const falha = c.search(/<NaoConsegueLer/);
    expect(falha).toBeGreaterThan(-1);
    /* ⚠️ E o guarda dele fala do estado de falha: sem esta linha, trocar
       `if (instavel)` por `if (false)` mantinha a ordem e passava verde. */
    expect(guardaDoJsx(c, falha)).toMatch(/instavel/i);
    expect(c.indexOf("const overdueCount")).toBeGreaterThan(falha);
  });

  /**
   * ⚠️ **O SEGUNDO RAMO DA MESMA FUNÇÃO — o de CIMA, e ele ficou de pé.**
   *
   * `load()` começa pedindo a sessão. O ramo `res.ok === false` foi consertado
   * na leva dos vazios mentirosos, com o comentário explicando o custo; o ramo
   * `!s.session?.access_token`, três linhas ACIMA, continuou saindo com a lista
   * vazia e `instavel` FALSO. Mesma tela, mesma função, mesma mentira.
   *
   * O bloco acima cobra a direção contrária ("toda ligação está num ramo de
   * falha") e por construção NÃO pega isto: ele olha as ligações que EXISTEM.
   * Aqui se cobra o contrário — que este ramo específico ligue.
   */
  for (const { nome, arquivo } of [
    { nome: "PreventivosTab", arquivo: MULHER },
    { nome: "CicloMenstrualTab", arquivo: CICLO },
  ]) {
    test(`⚠️ ${nome}: a sessão que não renovou também acende o instável`, () => {
      const c = componente(nome, arquivo);
      const i = c.indexOf("async function load(");
      expect(i).toBeGreaterThan(-1);
      const fn = c.slice(i, c.indexOf("\n  }", i));
      const k = fn.indexOf("!s.session?.access_token");
      expect(k).toBeGreaterThan(-1);
      /* O corpo do `if`, até a chave que o fecha — e ele tem de LIGAR a falha
         antes de sair. Medir "existe setInstavel no arquivo" ficaria verde com
         esta linha apagada, porque o ramo de baixo continua ligando. */
      const ramo = fn.slice(k, fn.indexOf("}", k));
      expect(ramo).toContain("setInstavel(true)");
      expect(ramo).toContain("return");
    });
  }

  /**
   * ⚠️ **E OS QUATRO CAMINHOS DE ESCRITA VOLTAVAM MUDOS.** Nada gravado, e a
   * única diferença para o ramo vizinho (que tem `toast`) era ela não ser
   * avisada — não havia comentário justificando a diferença em nenhum dos
   * quatro. Numa tela de preventivos isso vira um exame que ela acha que
   * registrou; no ciclo, uma data que vira DUM e nunca foi gravada.
   */
  for (const [arquivo, nomes] of [
    [CICLO, ["handleLogStart", "handleMarkEnd", "handleDelete"]],
    [MULHER, ["handleSave"]],
  ] as [string, string[]][]) {
    for (const nome of nomes) {
      test(`⚠️ ${nome}: a sessão que não renovou avisa, nunca volta calada`, () => {
        const i = arquivo.indexOf(`async function ${nome}(`);
        expect(i).toBeGreaterThan(-1);
        const fn = arquivo.slice(i, arquivo.indexOf("\n  }", i));
        const k = fn.indexOf("!s.session?.access_token");
        expect(k).toBeGreaterThan(-1);
        const ramo = fn.slice(k, fn.indexOf("}", k));
        expect(ramo).toContain("toast.error(");
      });
    }
  }

  /**
   * ⚠️ **E O `add()` DA TELA CLÍNICA MORRIA NO `getUser()`, QUE VAI À REDE.**
   * O `error` era descartado e o `return` era mudo: ela tocava em "Adicionar",
   * a tela não se mexia, e o registro de peso/pressão/glicemia não existia.
   * Dentro da MESMA função três dos quatro caminhos de erro já falavam.
   */
  test("⚠️ HealthTab.add(): a sessão sai do DISCO, e a falha fala", () => {
    const i = SAUDE.indexOf("async function add(");
    expect(i).toBeGreaterThan(-1);
    const fn = SAUDE.slice(i, SAUDE.indexOf("\n  }", i));
    /* `getUser()` é REDE; `getSession()` lê o disco e dá o mesmo `user.id`. */
    expect(fn).not.toContain("auth.getUser(");
    expect(fn).toContain("auth.getSession(");
    const k = fn.search(/if \(!uid\)/);
    expect(k).toBeGreaterThan(-1);
    expect(fn.slice(k, fn.indexOf("}", k))).toContain("toast.error(");
  });

  test("⚠️ e salvar um preventivo LÊ a resposta antes de fechar o painel", () => {
    /* `setPreventiveReminder` devolve `{ ok }` numa resposta 200 NORMAL —
       nenhum `try/catch` pega. O painel fechava, a lista recarregava sem a
       data que ela acabou de digitar, e a leitura razoável é que ela errou o
       campo. Numa tela de preventivos isso vira um exame que ela acha que
       registrou e o app não conhece. */
    const c = componente("PreventivosTab", MULHER);
    const i = c.indexOf("async function handleSave(");
    expect(i).toBeGreaterThan(-1);
    const fn = c.slice(i, c.indexOf("\n  }", i));
    expect(fn).toMatch(/const r = await setPreventiveReminder\(/);
    expect(fn).toMatch(/if \(!r\.ok\)/);
    /* ⚠️ Fica ABERTO com o que ela digitou: fechar perderia o texto, e é o
       que a fazia digitar de novo. O `setEditingKey(null)` vem DEPOIS do
       `return` da falha. */
    expect(fn.indexOf("if (!r.ok)")).toBeLessThan(fn.indexOf("setEditingKey(null)"));
    expect(fn).toContain("toast.error(");
  });

  /**
   * ⚠️ **A MESMA CLASSE FORA DA ABA SAÚDE.** A varredura do ramo
   * `if (!s.session?.access_token) { setLoading(false); return; }` achou mais
   * três telas; duas entraram, pela régua de sempre — *se esta leitura voltar
   * vazia, o app AFIRMA um fato que ela não tem como saber que é falso, e que
   * muda o que ela faz a seguir?*
   *
   *   · **consultas particulares** — "Nenhuma consulta ainda · Solicite sua
   *     primeira consulta particular acima", dito a quem já solicitou e talvez
   *     já PAGOU. A leitura razoável é pedir de novo, e aqui isso custa
   *     dinheiro.
   *   · **Cantinho** — saldo ZERO: a vitrine passa a dizer "faltam 74 🌱" a
   *     quem tem setecentas, e os itens que ela já comprou voltam a parecer
   *     compráveis. É a mesma classe que este repositório já pagou aqui uma
   *     vez, com "faltam 10 🏆" dito a quem tem 30.
   *
   * ⚠️ **E A TERCEIRA FICOU DE FORA, de propósito:** em `conquistas-tab` a
   * lista vazia não muda o que ela faz a seguir — é informativa, e a régua da
   * casa recorta exatamente aí (os onze contadores que a varredura anterior
   * deixou de pé pela mesma razão).
   */
  for (const { nome, arquivo, marca } of [
    { nome: "ConsultaParticularTab", arquivo: CONTA, marca: "setInstavel(true)" },
    { nome: "CantinhoTab", arquivo: CANTINHO, marca: "setInstavel(true)" },
  ]) {
    test(`⚠️ ${nome}: a sessão que não renovou acende o instável`, () => {
      const c = componente(nome, arquivo);
      const k = c.indexOf("!s.session?.access_token");
      expect(k).toBeGreaterThan(-1);
      const ramo = c.slice(k, c.indexOf("}", k));
      expect(ramo).toContain(marca);
      /* E o desenho da falha vem ANTES do texto que afirma o vazio. */
      const falha = c.search(/<NaoConsegueLer/);
      expect(falha).toBeGreaterThan(-1);
      expect(guardaDoJsx(c, falha)).toMatch(/instavel/i);
    });
  }

  test("⚠️ e a consulta particular só diz «solicite a primeira» DEPOIS da falha", () => {
    const c = componente("ConsultaParticularTab", CONTA);
    const falha = c.search(/<NaoConsegueLer/);
    expect(c.indexOf("Nenhuma consulta ainda")).toBeGreaterThan(falha);
  });

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
       único botão do SAMU desta tela.

       ⚠️ **ESTA ASSERÇÃO TRAVAVA A GRAFIA, e reprovou uma melhoria.** Ela
       cobrava `!instavel && analysisWindow.length >= 2` — e o `>= 2` SAIU de
       propósito na reescrita por semana gestacional: antes do termo é
       justamente com ZERO contrações registradas que a tela precisa dizer a
       única coisa que a ACOG diz para aquela faixa ("não espere fechar um
       padrão, ligue"). O portão que importa é o `!instavel`, e ele continua
       inteiro. Décima terceira vez nesta base: cobre a GARANTIA, nunca a
       escrita. */
    const i = c.search(/\{!instavel && \(/);
    expect(`portao: ${i > -1}`).toBe("portao: true");
    /* E o banner que ele guarda é o da análise — o que carrega o label e o
       detail da régua, e o par de botões de ligar. */
    const bloco = c.slice(i, i + 1800);
    expect(bloco).toContain("{analysis.label}");
    expect(bloco).toContain("{analysis.detail}");
    expect(bloco).toContain('href="tel:192"');
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
     ⚠️ Ela ficou INALCANÇÁVEL até set/2026 (não havia `server.errorPath` no
     `capacitor.config.ts`); agora está ligada, e este conserto é o que
     garantiu que ligá-la não ligasse junto um vazamento. */
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
