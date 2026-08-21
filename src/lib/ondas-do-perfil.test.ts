/**
 * A CATRACA DAS ONDAS SERIAIS — quantas ESPERAS custa abrir um perfil.
 *
 * ─── POR QUE ESTE TESTE EXISTE ──────────────────────────────────────────────
 *
 * Relato do dono, no aparelho: "clico na foto do paciente que fez a postagem, e
 * às vezes demora muito tempo pra ler lá pra área do perfil, demora cinco
 * segundos, ou até mais".
 *
 * O que importa numa função de servidor não é quantas consultas ela faz — é
 * quantas vezes ela ESPERA. Vinte consultas em paralelo custam uma latência;
 * cinco em fila custam cinco. Medido com este banco de mentira, `verPerfil`
 * fazia 24 idas em **18 ondas seriais** — e cada onda, num celular com a
 * latência de sempre, é um pedaço dos cinco segundos.
 *
 * Depois de juntar o que não dependia de nada (`idsDasAmigas`, o perfil com o
 * vínculo, as marcações com as publicações, e as cinco esperas do fim): 22 idas
 * em **10 ondas**.
 *
 * ⚠️ **A conta que este teste trava é a das ONDAS, não a das consultas.** Uma
 * consulta a mais dentro de uma onda que já existe é de graça; uma consulta a
 * menos numa onda nova é uma regressão. É a diferença que um teste de
 * "quantas queries" não veria.
 *
 * ⚠️ E ele é um teto FROUXO de propósito. Ele não existe para exigir que
 * ninguém acrescente nada — existe para que acrescentar uma CASCATA doa. Quem
 * precisar de uma onda a mais por uma razão boa sobe o teto e escreve a razão
 * aqui.
 */
import { describe, expect, mock, test } from "bun:test";

const LATENCIA = 5; // ms artificiais por ida, só para as ondas ficarem distinguíveis
type Registro = { t: number; alvo: string; detalhe: string; fim?: number };
const log: Registro[] = [];

/**
 * O teto, e ele é EXATO — 10, que é o medido depois do conserto.
 *
 * ⚠️ **Um teto frouxo não trava nada.** Ele começou em 12 "para não atrapalhar
 * trabalho honesto", e a mutação provou o problema na hora: re-serializar as
 * cinco esperas do fim de `verPerfil` — exatamente a cascata que este teste
 * existe para impedir — cabia na folga e passava VERDE.
 *
 * Então ele é exato, e subir é uma DECISÃO: quem precisar de uma onda a mais
 * sobe o número e escreve aqui por quê. É a mesma ideia do teto de Sementinhas
 * da economia — o número existe para a mudança ser deliberada, não para ser
 * impossível.
 */
const TETO_DE_ONDAS = 10;
let t0 = 0;

/** Uma URL assinada que vence em um minuto — força a renovação. */
function assinadaVencendo(caminho: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `https://x/storage/v1/object/sign/rede/${caminho}?token=a.${payload}.b`;
}

function linhaPerfil(id: string) {
  return {
    id,
    display_name: "Fulana",
    bio: "oi",
    /* ⚠️ Uma URL assinada VENCENDO — senão `renovarUrlsAssinadas` devolveria o
       valor intacto sem tocar na rede, e a medição perderia justamente a onda
       que a renovação custa. */
    avatar_url: assinadaVencendo("u/" + id + ".jpg"),
    perfil_publico: true,
    care_mode: false,
    mostrar_semana: true,
    mostrar_bebe: true,
    conta_oficial: false,
    aceita_perguntas: true,
    lmp_date: "2026-02-01",
    reference_date: null,
    reference_weeks: null,
    reference_days: null,
    ref_code: null,
    referral_code: "ABC1234",
    vitrine_publica: false,
  };
}
let ids0: string[] = [];
const POSTS = Array.from({ length: 12 }, (_, i) => ({
  id: "p" + i,
  autor_id: "alvo",
  texto: "t",
  imagem_path: "a/" + i + ".jpg",
  imagens: ["b/" + i + ".jpg", "c/" + i + ".jpg"],
  visibilidade: "publico",
  criado_em: new Date(Date.now() - i * 86400000).toISOString(),
  enquete_opcoes: null,
  aula: null,
  pergunta: null,
  comparacao_de: null,
  editado_em: null,
  arquivado_em: null,
}));

function dadosPara(tabela: string, cols: string, ids: string[]) {
  if (tabela === "patient_profiles") {
    if (cols.includes("care_mode") && cols.length < 20) return { care_mode: false };
    if (cols.trim() === "ref_code") return { ref_code: null };
    if (cols.includes("vitrine_publica")) return { vitrine_publica: false, referral_code: "A" };
    return (ids.length ? ids : ["alvo"]).map(linhaPerfil);
  }
  if (tabela === "rede_posts") return POSTS.map((p) => ({ ...p, autor_id: ids0[0] ?? "alvo" }));
  if (tabela === "rede_seguidores") return [{ estado: "ativo", seguido_id: "x", seguidor_id: "y" }];
  if (tabela === "affiliates") return { code: "MARIA", active: true };
  return [];
}

function builder(tabela: string) {
  const st = { tabela, cols: "", detalhe: [] as string[], ids: [] as string[] };
  const p: any = {
    select(c: string, o?: any) {
      st.cols = c;
      if (o?.head) st.detalhe.push("count");
      return p;
    },
    eq(k: string, v: any) {
      st.detalhe.push(`eq(${k})`);
      return p;
    },
    is() {
      return p;
    },
    in(k: string, v: any[]) {
      st.detalhe.push(`in(${k},${v.length})`);
      if (k === "id") st.ids = v;
      return p;
    },
    order() {
      return p;
    },
    or(x: string) {
      st.detalhe.push(`or(${x.slice(0, 24)}…)`);
      return p;
    },
    not() {
      return p;
    },
    gte() {
      return p;
    },
    lte() {
      return p;
    },
    gt() {
      return p;
    },
    lt() {
      return p;
    },
    neq() {
      return p;
    },
    range() {
      return p;
    },
    ilike() {
      return p;
    },
    filter() {
      return p;
    },
    contains() {
      return p;
    },
    overlaps() {
      return p;
    },
    single() {
      st.detalhe.push("single");
      return p;
    },
    limit(n: number) {
      st.detalhe.push(`limit(${n})`);
      return p;
    },
    maybeSingle() {
      st.detalhe.push("single");
      return p;
    },
    then(res: any, rej: any) {
      if (st.tabela === "patient_profiles" && st.ids.length) ids0 = st.ids;
      const reg: Registro = {
        t: Math.round(performance.now() - t0),
        alvo: st.tabela,
        detalhe: `${st.cols.slice(0, 46)} | ${st.detalhe.join(" ")}`,
      };
      log.push(reg);
      return new Promise((r) => setTimeout(r, LATENCIA))
        .then(() => {
          reg.fim = Math.round(performance.now() - t0);
          const d = dadosPara(st.tabela, st.cols, st.ids);
          const single = st.detalhe.includes("single");
          return { data: single ? (Array.isArray(d) ? d[0] : d) : d, error: null, count: 3 };
        })
        .then(res, rej);
    },
  };
  return p;
}

/** O que `urlsAssinadas` pediu, para o teste do LOTE conferir. */
const chamadas: string[][] = [];

const sbFake: any = {
  from: (t: string) => builder(t),
  storage: {
    from: (balde: string) => ({
      createSignedUrls: async (paths: string[]) => {
        chamadas.push(paths);
        const reg: Registro = {
          t: Math.round(performance.now() - t0),
          alvo: "STORAGE",
          detalhe: `createSignedUrls(${paths.length})`,
        };
        log.push(reg);
        await new Promise((r) => setTimeout(r, LATENCIA));
        reg.fim = Math.round(performance.now() - t0);
        return {
          data: paths.map((x) => ({ error: null, path: x, signedUrl: `NOVA:${balde}/${x}` })),
          error: null,
        };
      },
    }),
  },
  auth: {
    getUser: async () => {
      const reg: Registro = {
        t: Math.round(performance.now() - t0),
        alvo: "AUTH",
        detalhe: "getUser(token)",
      };
      log.push(reg);
      await new Promise((r) => setTimeout(r, LATENCIA));
      reg.fim = Math.round(performance.now() - t0);
      return { data: { user: { id: "eu" } } };
    },
    admin: {
      getUserById: async () => {
        const reg: Registro = {
          t: Math.round(performance.now() - t0),
          alvo: "AUTH",
          detalhe: "getUserById",
        };
        log.push(reg);
        await new Promise((r) => setTimeout(r, LATENCIA));
        reg.fim = Math.round(performance.now() - t0);
        return { data: { user: { email: "a@b.c" } } };
      },
    },
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: sbFake }));
/* ⚠️ **`imagens.server` NÃO é dublê aqui, e isso é de propósito.** Mocá-lo faria
   este arquivo medir uma assinatura imaginária — e, pior, o dublê vazaria para
   os testes do LOTE logo abaixo, que precisam do módulo de verdade (`mock.module`
   do bun é global e o último registro vence). O que é dublê é o STORAGE, dentro
   de `sbFake`: assim o caminho medido é o real, `createSignedUrls` inclusive. */

const ALVO = "00000000-0000-4000-8000-000000000001";
test("⚠️ abrir um perfil não pode voltar a ser uma cascata", async () => {
  const { verPerfil } = await import("@/lib/rede-social.functions");
  t0 = performance.now();
  const _r: any = await (verPerfil as any)({ data: { accessToken: "x".repeat(20), alvoId: ALVO } });
  const total = Math.round(performance.now() - t0);
  console.log("\n===== IDAS AO BANCO, verPerfil =====");
  log.forEach((l, i) =>
    console.log(
      String(i + 1).padStart(2) +
        `  t=${String(l.t).padStart(4)}ms→${String(l.fim ?? "?").padStart(4)}  ${l.alvo.padEnd(17)} ${l.detalhe}`,
    ),
  );
  const ondas = new Set(log.map((l) => l.t)).size;
  console.log(
    `\nTOTAL idas: ${log.length}  |  ONDAS SERIAIS (t distintos): ${ondas}  |  tempo total ${total}ms com ${LATENCIA}ms/ida`,
  );
  /* ⚠️ **A MEDIÇÃO SÓ VALE SE A FUNÇÃO RODOU ATÉ O FIM.** Um `verPerfil` que
     devolvesse `indisponivel` na primeira linha teria UMA onda e passaria com
     folga, afirmando um desempenho que ninguém tem — o teste estaria medindo a
     recusa, não a tela.

     A prova não é o retorno (o embrulho de `createServerFn` não o devolve quando
     chamado assim, e foi por isso que a bancada original imprimia `undefined`):
     é o RASTRO. Estas três chamadas só acontecem depois do portão de alcance,
     das publicações e da montagem — se a função tivesse desistido no meio,
     nenhuma delas estaria no log. */
  const alvos = log.map((l) => `${l.alvo} ${l.detalhe}`).join(" | ");
  expect(alvos).toContain("rede_posts");
  expect(alvos).toContain("createSignedUrls");
  expect(alvos).toContain("affiliates");
  expect(log.length).toBeGreaterThan(15);

  expect(ondas).toBeLessThanOrEqual(TETO_DE_ONDAS);
});

import { renovarUrlsAssinadas } from "./imagens.server";

const agora = () => Math.floor(Date.now() / 1000);
const comExp = (segundos: number, caminho: string) => {
  const payload = Buffer.from(JSON.stringify({ exp: agora() + segundos })).toString("base64url");
  return `https://x/storage/v1/object/sign/rede/${caminho}?token=a.${payload}.b`;
};
/** Vence em um minuto: precisa ser renovada. */
const velha = (c: string) => comExp(60, c);
/** Sete dias pela frente: não se toca nela. */
const fresca = (c: string) => comExp(7 * 24 * 3600, c);

describe("o lote, por comportamento", () => {
  /**
   * ⚠️ A ORDEM É O INVARIANTE, e é o que separa este conserto de um acidente.
   *
   * Quem chama casa por índice (`linhas.map((p, i) => …urls[i])`). Uma saída
   * fora de ordem trocaria o rosto de uma paciente pelo de outra, em silêncio,
   * no feed inteiro. A entrada aqui é de propósito a pior possível: assinada
   * vencendo, data URL, nulo, assinada vencendo, assinada fresca e link
   * externo — tudo misturado.
   */
  test("⚠️ preserva a ORDEM com a entrada toda misturada", async () => {
    chamadas.length = 0;
    const entrada = [
      velha("a.jpg"),
      "data:image/jpeg;base64,ZZZ",
      null,
      velha("b.jpg"),
      fresca("ok.jpg"),
      "https://externo/x.png",
    ];
    const saida = await renovarUrlsAssinadas(entrada);
    expect(saida).toHaveLength(entrada.length);
    expect(saida[0]).toBe("NOVA:rede/a.jpg");
    /* data URL passa intacta — é o que o `campo-foto` e o ritual gravam. */
    expect(saida[1]).toBe("data:image/jpeg;base64,ZZZ");
    expect(saida[2]).toBeNull();
    expect(saida[3]).toBe("NOVA:rede/b.jpg");
    /* A fresca volta IGUAL, sem passar pela rede. */
    expect(saida[4]).toBe(entrada[4]);
    expect(saida[5]).toBe("https://externo/x.png");
  });

  test("⚠️ UMA requisição para o lote inteiro, não uma por item", async () => {
    chamadas.length = 0;
    await renovarUrlsAssinadas([velha("1.jpg"), velha("2.jpg"), velha("3.jpg"), velha("4.jpg")]);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toHaveLength(4);
  });

  /* ⚠️ O caso COMUM: o avatar é assinado por sete dias, então quase toda
     leitura da rede não precisa renovar nada. Antes, toda leitura renovava
     tudo. */
  test("⚠️ NENHUMA requisição quando tudo ainda está fresco", async () => {
    chamadas.length = 0;
    const r = await renovarUrlsAssinadas([fresca("1.jpg"), fresca("2.jpg")]);
    expect(chamadas).toHaveLength(0);
    expect(r[0]).toContain("token=");
  });

  /* ⚠️ O mesmo caminho repetido (duas pacientes com a mesma foto, ou o mesmo
     post citado duas vezes) não vira duas entradas no pedido. */
  test("caminho repetido entra uma vez só no pedido", async () => {
    chamadas.length = 0;
    const saida = await renovarUrlsAssinadas([velha("x.jpg"), velha("x.jpg")]);
    expect(chamadas[0]).toHaveLength(1);
    expect(saida[0]).toBe("NOVA:rede/x.jpg");
    expect(saida[1]).toBe("NOVA:rede/x.jpg");
  });
});
