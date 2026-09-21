import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ O BOTÃO DE SOCORRO NÃO EXISTIA ENQUANTO O APP CARREGAVA (set/2026).
 *
 * A barra de baixo e a Central de Emergência ficavam DEPOIS do
 * `if (loading) return` de `minha-conta.tsx`. A paciente que abre o app
 * justamente porque está passando mal encontrava um esqueleto cinza e nenhuma
 * saída — e quem abre com pressa e não acha o SOS conclui que o app é assim.
 *
 * ⚠️ **E a intenção original estava DOCUMENTADA na mesma tela**: o comentário
 * de `medicoResolvido` afirma, por escrito, que "o SOS está clicável desde o
 * primeiro pixel". O retorno antecipado tinha quebrado esse desenho em
 * silêncio. Comentário desatualizado é a forma mais barata de um defeito
 * sobreviver a uma revisão — aqui ele foi a prova de que havia um.
 *
 * O que torna isto valer alguma coisa, e não ser enfeite: `dispararEmergencia`
 * recebe só o token da SESSÃO e as coordenadas, e o servidor resolve médico,
 * contato e ficha. **O socorro funciona inteiro com o perfil ainda nulo.**
 *
 * Esta catraca cobre só o que os outros testes de SOS NÃO cobrem
 * (`socorro-nao-e-gateado.test.ts` já cobre o portão de Modo Cuidado e o alarme
 * sonoro): que o cromo está no primeiro quadro, que ele é UMA fonte só, e que o
 * único portão dele é a marca de médico.
 */

/** ⚠️ A prosa desta região CITA as formas proibidas — sai antes da busca. */
const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
const QUADRO = semComentarios(readFileSync("src/components/primeiro-quadro.tsx", "utf8"));

/**
 * O corpo do `if (loading) return ( … )`, recortado por CONTAGEM DE
 * PARÊNTESES.
 *
 * ⚠️ Nunca por distância em caracteres: medir janela mente no dia em que o
 * bloco cresce, e este repositório já pagou isso várias vezes.
 */
function ramoDeCarregamento(): string {
  const i = CONTA.indexOf("if (loading)");
  expect(i).toBeGreaterThan(-1);
  const abre = CONTA.indexOf("(", CONTA.indexOf("return", i));
  let n = 0;
  for (let k = abre; k < CONTA.length; k++) {
    if (CONTA[k] === "(") n++;
    else if (CONTA[k] === ")") {
      n--;
      if (n === 0) return CONTA.slice(abre, k + 1);
    }
  }
  throw new Error("o ramo de carregamento não fecha");
}

describe("o socorro existe desde o primeiro quadro", () => {
  test("⚠️ o cromo é montado no ramo de CARREGAMENTO", () => {
    /* Sem isto, voltar ao estado antigo — o esqueleto sozinho — passa verde. */
    expect(ramoDeCarregamento()).toContain("cromoDoApp");
  });

  test("⚠️ é UMA fonte só, usada nos DOIS caminhos", () => {
    /* Duas cópias do JSX divergiriam no primeiro conserto, e a que divergisse
       seria a do carregamento: a menos olhada, e a que existe exatamente para
       o pior momento. O `tsc` não pega, porque toda prop da folha é a mesma. */
    const usos = [...CONTA.matchAll(/\bcromoDoApp\b/g)].length;
    const declaracao = [...CONTA.matchAll(/const cromoDoApp\s*=/g)].length;
    expect(declaracao).toBe(1);
    expect(usos - declaracao).toBe(2);
    /* E as duas peças aparecem uma vez cada: uma segunda montagem em qualquer
       lugar do arquivo é alguém duplicando. */
    expect([...CONTA.matchAll(/<EmergencySheet\b/g)]).toHaveLength(1);
    expect([...CONTA.matchAll(/<AppBottomNav\b/g)]).toHaveLength(1);
  });

  test("a fonte é declarada ANTES do retorno antecipado", () => {
    /* Documenta a ordem para quem for reorganizar — e a regra dos hooks em si
       já é coberta pelo lint, então aqui é só o cinto. */
    expect(CONTA.indexOf("const cromoDoApp")).toBeLessThan(CONTA.indexOf("if (loading)"));
  });

  test("⚠️ o ÚNICO portão do cromo é a marca de médico", () => {
    /* O app dele é o painel, e o caminho dele é o mais longo do boot: sem esta
       guarda ele veria a barra da gestante em TODA abertura do app instalado
       (`start_url` do manifesto é `/minha-conta`).
       ⚠️ E nada de `careMode` aqui: o Modo Cuidado governa CONTEÚDO, nunca o
       acesso ao socorro. */
    const ramo = ramoDeCarregamento();
    expect(ramo).toMatch(/!podeSerMedico && cromoDoApp/);
    expect(ramo).not.toContain("careMode");
  });

  test("⚠️ `podeSerMedico` nasce FALSO — errar é para o lado da paciente", () => {
    /* O pior caso dele é uma barra que não aparece; o pior caso dela é o
       socorro que não aparece. */
    expect(CONTA).toMatch(/const \[podeSerMedico, setPodeSerMedico\] = useState\(false\)/);
    /* E ele é carimbado a partir da MESMA marca do Auth que já decide o papel —
       não é uma segunda régua. */
    const i = CONTA.indexOf("setPodeSerMedico(true)");
    expect(i).toBeGreaterThan(-1);
    expect(CONTA.lastIndexOf("marcaDeMedico", i)).toBeGreaterThan(-1);
  });
});

describe("⚠️ `gest` e `activeSection` vivem antes do retorno antecipado", () => {
  test("e isso conserta uma TDZ que já existia", () => {
    /* O efeito da dica da bolha lê `gest?.weeks` dentro de um `.then()`, e
       `gest` era declarada DEPOIS do `if (loading) return`. Numa paciente com
       perfil e SEM âncora gestacional, `setProfile` comita com `loading` ainda
       true: aquele render sai cedo, `gest` nunca é inicializada naquele escopo,
       e o fecho do efeito estoura em TDZ. A dica nunca aparecia, em silêncio —
       o `void` engole a rejeição.
       ⚠️ Nem o `tsc` nem o lint pegam isso: o símbolo EXISTE. A regra geral que
       fica é esta — nenhum símbolo declarado depois de um retorno antecipado
       pode ser lido dentro do corpo de um efeito declarado antes dele. */
    const decl = CONTA.indexOf("const gest =");
    const usoNoEfeito = CONTA.indexOf("weeks: gest?.weeks");
    const saidaCedo = CONTA.indexOf("if (loading)");
    expect(decl).toBeGreaterThan(-1);
    expect(usoNoEfeito).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(saidaCedo);
    expect(CONTA.indexOf("const activeSection")).toBeLessThan(saidaCedo);
  });
});

describe("o primeiro quadro não afirma o que não sabe", () => {
  test("⚠️ o céu só quando o destino É a home", () => {
    /* Quem abre por deep link (`?tab=Caminho`, `?tab=Feed` — os pushes usam
       isso) não vai para a home: pintar a home durante a espera mostraria uma
       tela que não é a dela, e o app trocaria de ASSUNTO ao carregar. */
    const ramo = ramoDeCarregamento();
    expect(ramo).toMatch(/ceu=\{mobileHome \?/);
    /* E o componente sabe desenhar o vulto neutro quando não há céu. */
    expect(QUADRO).toMatch(/ceu \?/);
    expect(QUADRO).toContain("skeleton");
  });

  test("⚠️ a ficha diz DESCONHECIDO, e não 'nenhuma'", () => {
    /* "Alergias: nenhuma informada" e "Medicamentos: nenhum" são AFIRMAÇÕES, e
       quem as lê é um socorrista. Enquanto o perfil não chegou, o valor é
       desconhecido — a mesma régua que o modo consulta aplica com
       `ficha.degradada`. */
    const FOLHA = semComentarios(readFileSync("src/components/emergency-sheet.tsx", "utf8"));
    expect(FOLHA).toMatch(/fichaResolvida \? info\.allergies \|\| "nenhuma informada"/);
    expect(FOLHA).toMatch(/fichaResolvida \? info\.medications \|\| "nenhum"/);
    /* E a acusação de perfil incompleto não sai enquanto ele não chegou. */
    expect(FOLHA).toMatch(/fichaResolvida && \(!info\.bloodType/);
    /* O padrão é `true`: nenhum chamador de hoje muda de comportamento. */
    expect(FOLHA).toMatch(/fichaResolvida = true/);
    /* E a tela passa o PERFIL, não `!loading`: é o perfil que a torna
       verdadeira. */
    expect(CONTA).toMatch(/fichaResolvida=\{!!profile\}/);
  });

  test("⚠️ o rótulo da ficha FALHA FECHADO sem perfil", () => {
    /* `careMode` é derivado do perfil: durante o carregamento ele é `false` e o
       `??` da folha caía em "FICHA DE EMERGÊNCIA - GESTANTE" — a frase que o
       Modo Cuidado existe para apagar, em caixa alta, no topo da ficha. */
    expect(CONTA).toMatch(/tituloDaFicha=\{\s*!profile \|\| careMode \?/);
  });
});
