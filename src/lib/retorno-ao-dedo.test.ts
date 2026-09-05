import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ O SOS ERA O ÚNICO GESTO DE CONSEQUÊNCIA DO APP MUDO AO DEDO (set/2026).
 *
 * O único retorno do botão vermelho era SOM — e o som não é confiável no
 * aparelho em que ele mais importa: **no iPhone no silencioso o Web Audio
 * simplesmente não toca** (o WebKit trata isso como o bug 237322, e
 * `sessao-de-audio.ts` existe por causa disso). Uma paciente em pânico
 * apertava o círculo e não recebia sinal nenhum de que o app tinha entendido.
 *
 * E o cronômetro de contrações tinha o mesmo buraco no COMEÇO: o fim já tinha
 * tique (o comentário dele chama isto de "o caso de mão ocupada"), o início
 * não tinha nada.
 *
 * Esta catraca protege as três garantias que fazem esse retorno valer alguma
 * coisa: que ele acontece DENTRO do gesto, que ele não passa por preferência
 * nenhuma, e que o instante gravado é o do dedo.
 */

/** Sem os comentários — a prosa deste repositório cita o que ela cobra. */
function semComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const SOS = semComentarios("src/components/emergency-sheet.tsx");
/**
 * ⚠️ O CRONÔMETRO SAIU DE `minha-conta.tsx` (set/2026) e esta catraca ficou
 * VERMELHA só porque o caminho mudou — a garantia não mudou uma linha.
 *
 * E o modo como ela ficou vermelha é a lição: o `corpoDe` roda no corpo do
 * `describe`, ou seja FORA de um `test()`. Com a âncora sumindo, o `indexOf`
 * devolve −1 e o `expect` estoura ali — e o `bun` conta isso como **`error`**,
 * nunca como `fail`. O portão local, que julgava por `grep "^ 0 fail"`, disse
 * "tudo verde" sobre uma suíte que a CI reprovou dez minutos depois. O passo
 * dos testes passou a ser julgado pelo CÓDIGO DE SAÍDA no mesmo commit.
 */
const CONTRACOES = semComentarios("src/components/contracoes-tab.tsx");
const NATIVO = semComentarios("src/lib/nativo.ts");

/** O corpo de uma função, contado por chaves a partir da assinatura. */
function corpoDe(fonte: string, assinatura: string): string {
  const i = fonte.indexOf(assinatura);
  expect(i).toBeGreaterThan(-1);
  const abre = fonte.indexOf("{", i + assinatura.length - 1);
  let n = 0;
  for (let k = abre; k < fonte.length; k++) {
    if (fonte[k] === "{") n++;
    else if (fonte[k] === "}") {
      n--;
      if (n === 0) return fonte.slice(abre, k + 1);
    }
  }
  throw new Error(`não fecha: ${assinatura}`);
}

describe("o SOS responde ao dedo", () => {
  const corpo = corpoDe(SOS, "async function sendLocation()");

  test("⚠️ a vibração do envio acontece ANTES de qualquer `await`", () => {
    /* Depois do primeiro `await` o gesto já passou — é a mesma armadilha que
       `destravarSomDeUI()` documenta duas linhas acima, e que os Sons para
       dormir já pagaram. */
    const vibra = corpo.indexOf("tocarPadrao(");
    const primeiroAwait = corpo.indexOf("await ");
    expect(vibra).toBeGreaterThan(-1);
    expect(primeiroAwait).toBeGreaterThan(-1);
    expect(vibra).toBeLessThan(primeiroAwait);
  });

  test("⚠️ ela sai ao lado do destravar do som, e não em outro lugar", () => {
    /* Os dois existem pela MESMA razão e no MESMO instante. Separados, o
       próximo conserto move um e esquece o outro. */
    const som = corpo.indexOf("destravarSomDeUI()");
    const vibra = corpo.indexOf("tocarPadrao(");
    expect(som).toBeGreaterThan(-1);
    expect(Math.abs(vibra - som)).toBeLessThan(900);
  });

  test("⚠️ o desfecho é sentido pela MESMA régua do som", () => {
    /* Duas réguas fariam o iPhone no silencioso dizer uma coisa pelo tato e a
       tela dizer outra. */
    expect(corpo).toMatch(
      /tocarSomDeUI\(\s*chegouEmTodos[\s\S]{0,220}hapticoDeAviso\(\s*chegouEmTodos/,
    );
    /* E o caminho de falha total também vibra. */
    expect(corpo).toMatch(/tocarSomDeUI\("sos-falhou"\);\s*hapticoDeAviso\("erro"\)/);
  });

  test("⚠️ NADA disso passa por preferência de som nem por Modo Cuidado", () => {
    /* O SOS é ALARME: quem perdeu a gestação continua podendo passar mal, e
       quem desligou os sons do app não desligou o socorro. `podeSoar` é o
       portão das outras espécies e não pode alcançar este caminho. */
    expect(corpo).not.toContain("podeSoar");
    expect(corpo).not.toContain("careMode");
  });
});

describe("a contração marca o instante do dedo", () => {
  const corpo = corpoDe(CONTRACOES, "async function startContraction()");

  test("⚠️ `started_at` é carimbado no CLIENTE, não pelo relógio do servidor", () => {
    /* `ended_at` sempre foi o instante do dedo (`new Date()` dentro do
       `update`) e `started_at` caía no `DEFAULT now()` do banco, depois de
       duas idas à rede: as duas pontas mediam em relógios diferentes, e toda
       contração era gravada mais CURTA do que foi. O intervalo entre elas —
       o dado que decide ir para a maternidade — saía deslocado pela latência. */
    expect(corpo).toContain("started_at:");
    const instante = corpo.indexOf("const agora = Date.now()");
    expect(instante).toBeGreaterThan(-1);
    const primeiroAwait = corpo.indexOf("await ");
    expect(instante).toBeLessThan(primeiroAwait);
    /* E o que vai para o banco é ESSE instante, não um `Date.now()` novo. */
    const carimbo = corpo.slice(corpo.indexOf("started_at:"));
    expect(carimbo.slice(0, 60)).toContain("agora");
  });

  test("⚠️ o cronômetro da tela usa o MESMO instante do banco", () => {
    /* Dois relógios fariam a tela contar uma coisa e o registro guardar
       outra — e é o registro que o médico lê depois. */
    expect(corpo).toContain("startRef.current = agora");
  });

  test("o dedo recebe resposta antes de qualquer ida à rede", () => {
    const toque = corpo.indexOf("hapticTap()");
    expect(toque).toBeGreaterThan(-1);
    expect(toque).toBeLessThan(corpo.indexOf("await "));
  });

  test("⚠️ a sessão vem do DISCO, não da rede", () => {
    /* `getUser()` é uma ida ao servidor; `getSession()` lê o que já está no
       aparelho. Uma espera a menos entre o toque e o cronômetro. */
    expect(corpo).toContain("getSession()");
    expect(corpo).not.toContain("getUser()");
  });

  test("e a falha também é sentida — ela pode não estar olhando", () => {
    expect(corpo).toContain('hapticoDeAviso("erro")');
  });
});

describe("o retorno tátil de desfecho", () => {
  const corpo = corpoDe(NATIVO, "export function hapticoDeAviso(");

  test("⚠️ na casca ele usa o padrão do SISTEMA, não uma agenda nossa", () => {
    /* `Haptics.notification` é a assinatura tátil que o iPhone usa para
       "concluído" e "falhou" — a paciente já a conhece de todo outro app. */
    expect(corpo).toContain("notification");
    expect(corpo).toContain("ehNativo()");
  });

  test("⚠️ e o erro é distinguível do sucesso sem olhar", () => {
    const sucesso = corpo.match(/\[([\d,\s]+)\][^[]*:/);
    expect(corpo).toMatch(/tocarPadrao\(/);
    /* Padrões diferentes: se fossem iguais, o tato não diria nada. */
    const padroes = [...corpo.matchAll(/\[([\d,\s]+)\]/g)].map((m) => m[1].replace(/\s/g, ""));
    expect(padroes.length).toBeGreaterThanOrEqual(2);
    expect(new Set(padroes).size).toBe(padroes.length);
    expect(sucesso).toBeTruthy();
  });

  test("⚠️ nunca lança e nunca espera — ele está no caminho do socorro", () => {
    expect(corpo).not.toMatch(/\bawait\b/);
    expect(corpo).toContain("catch");
  });
});
