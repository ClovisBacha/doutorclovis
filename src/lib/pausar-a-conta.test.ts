import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { foraDaRede } from "./rede-social.functions";

/**
 * ⚠️ **PAUSAR A CONTA — o meio-termo que não existia.**
 *
 * Havia apagar (LGPD, irreversível) e o Modo Cuidado (o luto, no app inteiro).
 * Faltava o mais comum: sumir da Comunidade por um tempo e voltar inteira.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-social.tsx", "utf8");
const ABA = readFileSync("src/components/rede-instagram.tsx", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const s = semProsa(FONTE);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("a régua única de quem está fora da rede", () => {
  test("o luto e a pausa produzem o MESMO efeito", () => {
    /* As duas escondem a pessoa da rede, e é por isso que passam por uma função
       só: um `if` a mais em cada um dos vinte e seis pontos de decisão é como
       um deles fica de fora e a pausa vaza por ali. */
    expect(foraDaRede({ care_mode: true })).toBe(true);
    expect(foraDaRede({ rede_pausada_em: "2026-08-25T00:00:00Z" })).toBe(true);
    expect(foraDaRede({ care_mode: false, rede_pausada_em: null })).toBe(false);
  });

  test("⚠️ FALHA FECHADO — sem perfil, está fora", () => {
    /**
     * O pior caso é uma publicação não aparecer; o pior caso oposto é a
     * publicação de quem acabou de perder a gestação aparecendo no feed de todo
     * mundo por causa de um `undefined`. É o defeito que `!!a.care_mode` com
     * `a` indefinido já teve aqui.
     */
    expect(foraDaRede(null)).toBe(true);
    expect(foraDaRede(undefined)).toBe(true);
  });
});

describe("⚠️ ela é a régua ÚNICA — nenhum ponto de decisão fica de fora", () => {
  /**
   * ⚠️ **A CATRACA.** Um `care_mode` solto numa decisão é um lugar por onde a
   * PAUSA vaza: o luto continuaria escondendo e a pausa não. A varredura aceita
   * `care_mode` no `select`, no tipo e na própria `foraDaRede`; o que ela
   * recusa é o campo entrando numa CONDIÇÃO.
   */
  const PERMITIDO = [
    /* A régua, que por definição lê o campo.
       ⚠️ Ela ganhou a SUSPENSÃO (`APLICAR_SUSPENDER_DA_REDE.sql`): luto (dela),
       pausa (dela) e suspensão (da plataforma) produzem o mesmo efeito nesta
       aba, e um `if` a mais em cada ponto de decisão é como um deles fica de
       fora e a suspensão vaza por ali. */
    "return !!perfil.care_mode || !!perfil.rede_pausada_em || !!perfil.rede_suspensa_em;",
    /* `euEmCuidado` é o LUTO DELA, e não a pausa: quem pausou continua lendo o
       próprio feed, de propósito — cortar a leitura derrubaria conversas
       abertas com quem está apoiando ela. */
    "return !!(data as any)?.care_mode;",
    /* `meuPerfilSocial` devolve os DOIS campos separados para a tela dela: o
       luto tem desenho próprio, a pausa tem outro. */
    "emCuidado: !p || !!(p as any).care_mode,",
    /**
     * ⚠️ **A MEMÓRIA: isto NÃO é uma decisão — é o FATO sendo entregue à régua
     * que decide.**
     *
     * `memoriaDeHoje` tem cinco travas e a primeira é o luto; ela falha FECHADA
     * em `undefined`. O `perfil ?` existe exatamente para que "não sei quem ela
     * é" chegue como `undefined` (cala) e nunca como `false` (mostra) — trocar
     * por `!!perfil?.care_mode` é a mutação que este arquivo derruba.
     *
     * ⚠️ E a PAUSA não entra aqui de propósito: a memória é mostrada só a ELA
     * mesma, e pausar é "me esconda dos OUTROS". Suprimir a própria memória de
     * quem pausou seria a pausa decidindo uma coisa que não é dela.
     */
    "careMode: perfil ? !!perfil.care_mode : undefined,",
  ];

  test("nenhuma decisão nova lê `care_mode` fora da régua", () => {
    const s = semProsa(FONTE)
      .split("\n")
      .filter((l) => /care_mode/.test(l))
      /**
       * `select`, listas de colunas e o `?.` de tipo não são decisão.
       *
       * ⚠️ **A LINHA DE CONTINUAÇÃO conta como lista.** A lista de colunas do
       * perfil é quebrada em várias linhas com `" +`, e a catraca acusava a
       * segunda delas como se fosse uma condição. O recorte é sintático: uma
       * linha que é SÓ um literal de string concatenado não decide nada.
       */
      .filter(
        (l) =>
          !/select\(|COLUNAS|"id, display_name|care_mode,\s*$/.test(l) &&
          !/^\s*"[^"]*"\s*\+?\s*;?\s*$/.test(l),
      )
      .map((l) => l.trim())
      .filter((l) => !PERMITIDO.includes(l));
    expect(s).toEqual([]);
  });

  test("⚠️ e a catraca MORDE — o padrão ruim é reconhecido", () => {
    /* Catraca que passa em vazio é catraca que mente. */
    const ruim = ["  if (!p || p.care_mode) continue;"]
      .filter((l) => !/select\(|COLUNAS|"id, display_name|care_mode,\s*$/.test(l))
      .map((l) => l.trim())
      .filter((l) => !PERMITIDO.includes(l));
    expect(ruim).toHaveLength(1);
  });
});

describe("⚠️ o servidor: pausar", () => {
  const C = corpoDe("pausarMinhaRede");

  test("a sessão é o ÚNICO recorte — não há alvo vindo do cliente", () => {
    /* Um `pacienteId` no corpo do pedido deixaria qualquer paciente pausar (ou
       REATIVAR) a conta de outra. */
    expect(C).toContain('.eq("id", eu)');
    expect(C.slice(0, C.indexOf(".handler("))).not.toContain("alvoId");
  });

  test("⚠️ pausar GRAVA o instante; voltar grava `null`", () => {
    /* Um booleano não diria QUANDO — e sem o instante não há como, um dia,
       responder "você está pausada desde…". */
    expect(C).toMatch(/rede_pausada_em: data\.pausar \? new Date\(\)\.toISOString\(\) : null/);
  });

  test("⚠️ falha devolve ERRO, e nunca um 'pausado ✓' mudo", () => {
    /**
     * É a pior mentira que esta tela pode contar: ela publicaria imaginando que
     * ninguém está vendo. Sem a coluna, o `PGRST204` cai aqui.
     */
    expect(C).toContain('motivo: "sem_suporte"');
  });
});

describe("⚠️ a coluna tem degrau próprio, no TOPO da escada", () => {
  test("o degrau existe e trata ausente como NÃO pausada", () => {
    /* Tratar "não sei" como pausada esconderia da rede toda paciente de um
       banco atrasado — o oposto exato do que a coluna faz. */
    const s = semProsa(FONTE);
    expect(s).toContain("async function semAColunaDaPausa");
    const i = s.indexOf("async function semAColunaDaPausa");
    expect(s.slice(i, i + 700)).toContain("rede_pausada_em: null");
  });

  test("⚠️ e o degrau de baixo é o do `@`, nunca o fundo", () => {
    /* Um recuo que pulasse daqui direto ao mínimo apagaria o `@`, o feed
       fechado e a conta oficial por causa de uma pausa que ninguém ainda usa. */
    const s = semProsa(FONTE).replace(/\s+/g, " ");
    const i = s.indexOf("async function semAColunaDaPausa");
    expect(s.slice(i, i + 400)).toContain("if (error) return semAColunaDoArroba(sb, ids)");
  });

  test("⚠️ e COMENTAR não pode parar por causa dela", () => {
    /* Sem `rede_pausada_em` o `42703` cai em `erroAutor` e `postQueEuVejo`
       RECUSA — comentar pararia de funcionar para todo mundo por causa de uma
       coluna que ainda não existe naquele banco. */
    /* ⚠️ COBRA A GARANTIA, e não a grafia. A primeira versão travava a chamada
       literal `lerAutor("id, care_mode, perfil_publico")` numa janela de 500
       caracteres, e ficou VERMELHA no dia em que a escada ganhou um terceiro
       degrau (`rede_suspensa_em`) e virou um laço — ou seja, reprovou uma
       mudança que só APERTOU a garantia. Décima segunda vez nesta base. */
    const c = semProsa(readFileSync("src/lib/comentarios.functions.ts", "utf8"));
    const i = c.indexOf("const DEGRAUS_DO_AUTOR");
    expect(i).toBeGreaterThan(-1);
    const escada = c.slice(i, c.indexOf("];", i));
    /* Existe um degrau SEM a pausa — é ele que salva o banco atrasado. */
    const degraus = escada
      .split("\n")
      .map((l) => l.match(/"([^"]+)"/)?.[1])
      .filter((x): x is string => !!x);
    expect(degraus.some((d) => !d.includes("rede_pausada_em"))).toBe(true);
    /* E o laço para no primeiro que responde, senão o recuo não recua. */
    const j = c.indexOf("for (const colunas of DEGRAUS_DO_AUTOR)");
    expect(j).toBeGreaterThan(-1);
    expect(c.slice(j, j + 220)).toMatch(/if \(!erroAutor\) break;/);
  });
});

describe("⚠️ as duas telas", () => {
  test("o interruptor existe, e diz que NADA é apagado", () => {
    /* Quem não tem certeza de que as fotos ficam não pausa — vai embora de vez,
       ou fica sem descansar. */
    const t = semProsa(TELA);
    expect(t).toContain("pausarMinhaRede");
    expect(t).toContain("Nada é apagado");
    expect(t).toContain("Ninguém é avisado");
  });

  test("⚠️ e a tela DESFAZ quando o servidor recusa", () => {
    const t = semProsa(TELA);
    const i = t.indexOf("async function pausar(");
    const corpo = t.slice(i, t.indexOf("\n  async function", i + 10));
    expect(corpo).toContain("setPausada(!ligar)");
  });

  test("⚠️ a FAIXA no feed existe — senão o interruptor parece quebrado", () => {
    /**
     * A pausa esconde ela dos OUTROS, e o feed é o que ela vê: sem a faixa nada
     * muda na tela dela, e a conclusão razoável é que a pausa não pegou. Aí ela
     * publica imaginando que está invisível.
     */
    const a = semProsa(ABA);
    expect(a).toContain("Sua conta está pausada");
    expect(a).toContain("Reativar a minha conta");
    expect(a).toMatch(/pausada=\{pausada\}/);
  });

  test("⚠️ e a faixa vem ANTES do desafio", () => {
    /* Ela muda o significado de tudo que vem abaixo. Enterrada no meio da
       rolagem, seria um aviso que ela encontra depois de já ter publicado. */
    const a = semProsa(ABA);
    const iFaixa = a.indexOf("Sua conta está pausada");
    const iDesafio = a.indexOf("<CartaoDoDesafio");
    expect(iFaixa).toBeGreaterThan(-1);
    expect(iFaixa).toBeLessThan(iDesafio);
  });
});
