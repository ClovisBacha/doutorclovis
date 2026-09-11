/**
 * O LADRILHO "SONS · RELAXAR E DORMIR" ABRIA OUTRO RECURSO — E UM QUE FAZ O
 * CONTRÁRIO DO QUE ELE PROMETE.
 *
 * ⚠️ Ele dizia "Relaxar e dormir" e renderizava `SonsBebêTab`: cinco sons
 * feitos em **Web Audio**. O iOS SUSPENDE o `AudioContext` quando o aparelho
 * bloqueia — então o ladrilho de dormir abria um tocador que para no segundo
 * em que ela apoia o celular na mesa de cabeceira. É literalmente o defeito que
 * `sons-para-dormir.tsx` foi escrito para evitar, e o cabeçalho de lá diz isso
 * com todas as letras ("um player de dormir feito assim para no segundo em que
 * ela apoia o celular na mesa de cabeceira").
 *
 * ⚠️ E o `mapa-do-app` PROMETIA por escrito, para `tab: "Bem-estar",
 * sub: "sons"`, que os sons "tocam com a tela apagada". O tocador que cumpre
 * isso — WAV renderizado + `<audio loop>`, que sobrevive à tela apagada e
 * pendura o card na tela de bloqueio — existia e só era alcançável DENTRO da
 * aba Jogo, atrás de um botão flutuante.
 *
 * ⚠️ E o `BemEstarHub` era o ÚNICO dos cinco hubs sem `initialSub`: mesmo com
 * o destino certo, a porta do ☰ caía na GRADE e a paciente tinha de adivinhar
 * em qual quadrado o app queria pôr ela.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FUNCOES_DO_APP } from "@/lib/mapa-do-app";

/** ⚠️ A prosa acima cita o que ela proíbe — sai antes da busca. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

/** O corpo do `BemEstarHub`, do `function` até a próxima função de topo. */
function hub() {
  const i = CONTA.indexOf("function BemEstarHub(");
  expect(i).toBeGreaterThan(-1);
  const j = CONTA.indexOf("\nfunction ", i + 1);
  expect(j).toBeGreaterThan(i);
  return CONTA.slice(i, j);
}

/** A lista de ladrilhos do Bem-estar, como texto. */
function ladrilhos() {
  const i = CONTA.indexOf("export const BEMESTAR_SUBTABS");
  expect(i).toBeGreaterThan(-1);
  const j = CONTA.indexOf("] as const;", i);
  expect(j).toBeGreaterThan(i);
  return CONTA.slice(i, j);
}

describe("⚠️ o ladrilho entrega o que o rótulo promete", () => {
  test("o quadrado que fala em dormir abre o TOCADOR de dormir", () => {
    const h = hub();
    /* A folha certa: `sons-para-dormir.tsx`, e por `lazy()` — ela carrega as
       trinta e duas receitas de som, e quem abre o app para ver a semana do
       bebê não pode pagar isso na abertura. */
    expect(CONTA).toMatch(/lazy\(\(\) =>\s*import\("@\/components\/sons-para-dormir"\)/);
    expect(h).toContain("<SonsParaDormir");
    /* E o toque no ladrilho `sons` é o que a abre. */
    expect(h).toMatch(/if \(k === "sons"\) setDormirAberto\(true\)/);
  });

  test("⚠️ e os sons do BEBÊ deixaram de se chamar 'relaxar e dormir'", () => {
    const l = ladrilhos();
    /* Os dois existem, com nomes que dizem o que entregam. */
    expect(l).toContain('key: "sons"');
    expect(l).toContain('label: "Sons para dormir"');
    expect(l).toContain('key: "sons-bebe"');
    expect(l).toContain('label: "Sons para o bebê"');
    /* A promessa antiga não pode voltar para cima do recurso errado. */
    const iBebe = l.indexOf('key: "sons-bebe"');
    expect(l.slice(iBebe)).not.toContain("Relaxar e dormir");
    /* E o componente dos sons do bebê só é renderizado pelo ladrilho dele. */
    expect(hub()).toMatch(/sub === "sons-bebe" &&[\s\S]{0,80}<SonsBebêTab/);
  });

  test("⚠️ o tocador de dormir NÃO é desenhado dentro da moldura da grade", () => {
    /* Ele é `fixed inset-0` com tema escuro e botão de fechar próprios: dentro
       do `VoltarDaGrade` apareceria um cabeçalho claro por baixo de uma tela
       preta, com dois botões de voltar. */
    const folha = readFileSync("src/components/sons-para-dormir.tsx", "utf8");
    expect(folha).toContain("fixed inset-0");
    const h = hub();
    /* A folha é irmã da grade, e não filha do `<Fade>` das sub-telas. */
    expect(h).toMatch(/const folhaDeDormir = dormirAberto \?/);
  });

  test("o hub aceita initialSub — era o único dos cinco que não aceitava", () => {
    const h = hub();
    expect(h).toMatch(/initialSub\?: string \| null/);
    /* E o chamador passa o MESMO `consultasSub` dos outros hubs. */
    const i = CONTA.indexOf("<BemEstarHub");
    expect(i).toBeGreaterThan(-1);
    expect(CONTA.slice(i, CONTA.indexOf("/>", i))).toContain("initialSub={consultasSub}");
    /* `sons` abre a FOLHA, e não uma sub-tela que não existe. */
    expect(h).toMatch(/useState\(initialSub === "sons"\)/);
  });

  test("⚠️ toda porta do mapa aponta para um ladrilho que EXISTE neste hub", () => {
    /* É o que impede a promessa de voltar a apontar para o nada. */
    const l = ladrilhos();
    for (const f of FUNCOES_DO_APP.filter((x) => x.tab === "Bem-estar" && x.sub)) {
      expect(l).toContain(`key: "${f.sub}"`);
    }
    /* E a promessa da tela apagada continua escrita — ela agora é verdade. */
    const sons = FUNCOES_DO_APP.find((f) => f.sub === "sons");
    expect(sons?.descricao).toContain("tela apagada");
  });

  test("⚠️ no Modo Cuidado saem as meditações E os sons do bebê", () => {
    /* Seis dos sete roteiros de meditação citam o bebê, e o app os LÊ EM VOZ
       ALTA; os sons do bebê são, pelo próprio rótulo, o que ele escuta daí de
       dentro. O tocador de DORMIR fica: `porFamilia(luto)` já esconde o
       coração e o ventre lá dentro, e dormir mal é justamente o que ela tem
       depois de uma perda. */
    const h = hub();
    expect(h).toMatch(
      /careMode[\s\S]{0,120}filter\([\s\S]{0,120}"meditacoes"[\s\S]{0,60}"sons-bebe"/,
    );
    /* E o ladrilho de dormir NÃO entra no filtro do luto. */
    const i = h.indexOf("const itens = careMode");
    const filtro = h.slice(i, h.indexOf(";", i));
    expect(filtro).not.toMatch(/!== "sons"/);
  });
});
