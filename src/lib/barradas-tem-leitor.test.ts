/**
 * A REINCIDÊNCIA CLÍNICA CHEGOU AO ADMIN — a tabela era escrita em sete pontos
 * e lida em NENHUM.
 *
 * ⚠️ `anotarBarrada` grava desde que o rastro nasceu (post, story, comentário,
 * bio, resposta da caixinha, nota), `agruparPorPessoa` existia pura e testada
 * com o limiar de três — e nenhuma função de servidor lia
 * `rede_triagem_barrada`. O sinal MAIS FORTE de moderação da aba (alguém
 * tentando publicar conduta clínica repetidamente) era gravado para ninguém.
 *
 * É o `denunciado_em` outra vez: a promessa do módulo ("a plataforma passa a
 * ver o padrão") sem a metade que vê. `servidor-tem-porta` não pegava porque a
 * função de LEITURA nem existia — não havia órfã para acusar; e a lista de
 * réguas de `rede-tem-porta` não alcançava o módulo. As duas coisas mudaram.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const MOD = semComentarios(readFileSync("src/lib/moderacao.functions.ts", "utf8"));
const FILA = semComentarios(readFileSync("src/components/fila-de-denuncias.tsx", "utf8"));

function corpoDe(fonte: string, assinatura: string, depois: readonly string[] = []): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  let de = i;
  for (const marca of depois) {
    de = fonte.indexOf(marca, de);
    if (de < 0) return "";
    de += marca.length;
  }
  const abre = fonte.indexOf("{", de);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

/** ⚠️ `.handler(` → `=>` sem a chave — o marcador com ela começaria a contagem
 *  na desestruturação `{ data }`. Terceira volta deste extrator na base. */
const LEITOR = corpoDe(MOD, "export const filaDeBarradas", [".handler(", "=>"]);

describe("o leitor existe e lê certo", () => {
  test("⚠️ ele lê a tabela que só tinha escritor", () => {
    expect(LEITOR.length).toBeGreaterThan(0);
    expect(LEITOR).toContain('.from("rede_triagem_barrada")');
    expect(LEITOR).toContain("agruparPorPessoa");
  });

  test("⚠️ tabela AUSENTE ≠ leitura FALHOU, e nenhum é 'ninguém reincide'", () => {
    /* O primeiro é "falta rodar o SQL"; o segundo é "tente de novo". Fundi-los
       foi o defeito do export LGPD. */
    expect(LEITOR).toContain(
      'if (error?.code === "42P01") return { ok: false as const, motivo: "sem_tabela"',
    );
    expect(LEITOR).toContain('motivo: "banco"');
  });

  test("⚠️ SÓ os grupos acima do limiar viajam para o navegador", () => {
    /* "Uma tentativa isolada não é caso" — mandar os trechos de quem não é
       caso despejaria texto quase-clínico de pacientes inocentes na tela do
       admin. */
    expect(LEITOR).toContain("grupos.filter((g) => g.chamaAtencao)");
  });

  test("⚠️ a emergência não entra nem no agregado", () => {
    /* É pedido de socorro; somá-la faria o número da régua parecer maior do
       que o que ela BARRA. */
    expect(LEITOR).toContain('l.desfecho !== "emergencia"');
  });

  test("⚠️ os nomes saem em LOTE, por `id` — nunca um por pessoa", () => {
    expect(LEITOR).toContain('.in("id", ids)');
    expect(LEITOR).not.toMatch(/for[\s\S]{0,120}\.eq\("id"/);
  });

  test("o portão é ADMIN_EMAILS, como o resto do módulo", () => {
    expect(LEITOR).toContain("ADMIN_EMAILS");
    expect(LEITOR).toContain('motivo: "sem_acesso"');
  });
});

describe("a tela mostra, e não mente", () => {
  test("⚠️ a seção é MONTADA na fila de moderação", () => {
    expect(FILA).toContain("<ReincidenciaClinica bancada={bancada} />");
    expect(FILA).toContain("filaDeBarradas({");
  });

  test("⚠️ a falha NÃO tem a cara de 'ninguém reincide'", () => {
    expect(FILA).toMatch(/Isso não quer dizer que ninguém reincide/);
    expect(FILA).toMatch(/Tentar de novo/);
  });

  test("⚠️ a tabela ausente NOMEIA o SQL", () => {
    /* "Rode o arquivo X" é o que o admin consegue fazer; um erro genérico o
       deixaria achando que a fila quebrou. */
    expect(FILA).toContain("APLICAR_NOVE_DA_REDE.sql");
  });

  test("⚠️ o vazio VERDADEIRO diz o agregado — a régua viva se apresenta", () => {
    /* Sem o número, "nenhum grupo" é indistinguível de "o rastro está morto" —
       que é exatamente o estado em que a tabela viveu até aqui. */
    const i = FILA.indexOf("if (grupos.length === 0)");
    expect(i).toBeGreaterThan(-1);
    const bloco = FILA.slice(i, i + 700);
    expect(bloco).toContain("{total}");
    /* \s+ e não espaço literal: o prettier quebra a frase em duas linhas, e
       um regex de espaço único ficaria vermelho sobre código certo — a
       armadilha de forma exata, outra vez. */
    expect(bloco).toMatch(/nenhuma conta passou\s+do limiar/);
  });

  test("⚠️ o limiar da frase vem da RÉGUA, nunca escrito à mão", () => {
    /* Um "3" digitado divergiria de `REPETICOES_QUE_CHAMAM` no primeiro
       ajuste, e a tela passaria a descrever um limiar que o servidor não usa. */
    expect(FILA).toContain("REPETICOES_QUE_CHAMAM");
    expect(FILA).toMatch(/\{REPETICOES_QUE_CHAMAM_ROTULO\}\s+ou mais vezes/);
  });

  test("⚠️ aqui o NOME aparece — e o porquê está escrito", () => {
    /* O oposto da seção da caixinha, de propósito: barrada é tentativa de
       publicação PÚBLICA, sem contrato de anonimato, e a identidade é o que o
       admin precisa para agir pela ficha. */
    expect(FILA).toContain('{g.quemNome ?? "Sem nome"}');
  });
});
