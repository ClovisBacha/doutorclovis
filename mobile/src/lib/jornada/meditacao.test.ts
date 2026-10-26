import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DENSIDADES, planejarSessao } from "@/lib/meditacao-sessao";
import { FALAS_DO_PROGRAMA, PROGRAMA } from "@/lib/meditacao-programa";
import { ROTEIROS } from "@/lib/meditacao-roteiros";
import { semComentarios } from "@/lib/sem-comentarios";
import { SONS_CONTINUOS } from "@/lib/som-receitas";
import {
  COMO_ESTOU,
  comoEstouPara,
  ESCALA_RESPIRO,
  FALA_DO_FECHAMENTO,
  falaDoBalao,
  FECHAMENTO,
  FALAS_FORA_DO_APP,
  FECHAMENTO_TROCADO_NO_APP,
  formatarRestante,
  indiceDoTemaDoDia,
  lerRegistro,
  minutosAoEncerrar,
  planoDaSessao,
  PRECISA_NO_APP,
  registrar,
  TEMAS_DE_MEDITACAO,
} from "./meditacao";

const RAIZ = join(import.meta.dir, "..", "..", "..", "..");
const SITE = semComentarios(
  readFileSync(join(RAIZ, "src", "components", "gestacao-path.tsx"), "utf8"),
);
const BOLHA = semComentarios(readFileSync(join(RAIZ, "src", "components", "bolha.tsx"), "utf8"));
const VOZES = readFileSync(join(import.meta.dir, "..", "audio", "vozes.ts"), "utf8");
const SONS = readFileSync(join(import.meta.dir, "..", "audio", "sons-de-fundo.ts"), "utf8");

/** O trecho do site entre `inicio` e o primeiro `fim` depois dele. */
function trecho(fonte: string, inicio: string, fim: string): string {
  const i = fonte.indexOf(inicio);
  expect(i).toBeGreaterThan(-1);
  return fonte.slice(i, fonte.indexOf(fim, i));
}

const falasGravadas = new Set(
  [
    ...trecho(VOZES, "export const VOZ_DA_MEDITACAO", "};").matchAll(/^\s+"([\w-]+)": require\(/gm),
  ].map((m) => m[1]),
);

describe("a meditação do app é a do site", () => {
  test("os temas são os de MEDITACOES, na mesma ordem e com o mesmo luto", () => {
    const bloco = trecho(SITE, "const MEDITACOES", "];");
    const site = [
      ...bloco.matchAll(
        /theme: "([^"]+)",\s*need: "([^"]+)",\s*emoji: "([^"]+)",(\s*noLuto: true,)?/g,
      ),
    ].map((m) => ({
      tema: m[1],
      /* "Quero sentir o bebê" é trocado no app (as mexidinhas ficam fora). */
      precisa: PRECISA_NO_APP[m[1]!]?.site === m[2] ? PRECISA_NO_APP[m[1]!]!.app : m[2],
      emoji: m[3],
      noLuto: !!m[4],
    }));
    for (const [tema, t] of Object.entries(PRECISA_NO_APP))
      expect(bloco).toMatch(new RegExp(`theme: "${tema}",\\s*need: "${t.site}"`));
    expect(
      TEMAS_DE_MEDITACAO.map((t) => ({
        tema: t.tema,
        precisa: t.precisa,
        emoji: t.emoji,
        noLuto: !!t.noLuto,
      })),
    ).toEqual(site);
  });

  test("o fechamento: as cinco respostas, os textos e as falas gravadas", () => {
    const como = trecho(SITE, "const COMO_ESTOU", "] as const;");
    expect(
      [...como.matchAll(/emoji: "([^"]+)", label: "([^"]+)"/g)].map((m) => ({
        emoji: m[1],
        label: m[2],
      })),
    ).toEqual(COMO_ESTOU.map((c) => ({ emoji: c.emoji, label: c.label })));
    const fechamento = trecho(SITE, "const FECHAMENTO", "};");
    for (const [rotulo, texto] of Object.entries(FECHAMENTO)) {
      const troca = FECHAMENTO_TROCADO_NO_APP[rotulo];
      expect(fechamento).toContain(JSON.stringify(troca ? troca.site : texto));
      if (troca) {
        /* A trocada não leva a voz do site, que diz a frase antiga. */
        expect(FALA_DO_FECHAMENTO[rotulo]).toBeUndefined();
        expect(texto).not.toMatch(/consulta|médic|\bele\b/i);
      }
    }
    const falas = trecho(SITE, "const FALA_DO_FECHAMENTO", "};");
    for (const [rotulo, id] of Object.entries(FALA_DO_FECHAMENTO)) {
      expect(falas).toMatch(new RegExp(`"?${rotulo}"?: "${id}"`));
      expect(falasGravadas.has(id)).toBe(true);
    }
    expect(comoEstouPara(true).map((c) => c.label)).not.toContain("Conectada");
  });

  test("o círculo respira na escala da bolha do site", () => {
    const bloco = trecho(BOLHA, "export const ESCALA_RESPIRO", "};");
    expect(bloco).toContain(`in: ${ESCALA_RESPIRO.inspire}`);
    expect(bloco).toContain(`hold: ${ESCALA_RESPIRO.segure}`);
    expect(bloco).toContain(`out: ${ESCALA_RESPIRO.solte}`);
  });

  test("toda fala que o plano pode marcar tem gravação — nenhuma frase escrita sem voz", () => {
    const temas = [...TEMAS_DE_MEDITACAO.map((t) => t.tema), ...PROGRAMA.map((d) => d.tema)];
    const sem = new Set<string>();
    for (const tema of temas)
      for (const variacao of [1, 2, 3] as const)
        for (const { chave } of DENSIDADES)
          for (const minutos of [1, 2, 3, 5, 7, 10])
            for (const careMode of [false, true])
              for (const semanas of [null, 10, 24, 34]) {
                const p = planejarSessao({
                  minutos,
                  tema,
                  variacao,
                  densidade: chave,
                  careMode,
                  semanas,
                  semente: 7,
                });
                for (const d of p.deixas) if (!falasGravadas.has(d.fala.id)) sem.add(d.fala.id);
              }
    expect([...sem]).toEqual([]);
  });

  test("todo som contínuo do site tem arquivo no app, com volume de verdade", () => {
    /* O mapa passa pelo formatador: aspas e quebras de linha variam. */
    const bloco = trecho(SONS, "export const SONS_DE_FUNDO", "};").replace(/\s+/g, " ");
    const linhas = [
      ...bloco.matchAll(/"?([\w-]+)"?: \{ arquivo: require\("([^"]+)"\), volume: ([\d.]+),? \}/g),
    ];
    expect(linhas.map((m) => m[1]).sort()).toEqual([...SONS_CONTINUOS].sort());
    for (const [, , caminho, volume] of linhas) {
      expect(() => readFileSync(join(import.meta.dir, "..", "audio", caminho!))).not.toThrow();
      expect(Number(volume)).toBeGreaterThan(0.05);
      expect(Number(volume)).toBeLessThanOrEqual(1);
    }
  });
});

describe("as contas da meditação", () => {
  test("o tema do dia gira pelo dia e cabe na lista", () => {
    expect(indiceDoTemaDoDia(171, 8)).toBe(171 % 8);
    expect(indiceDoTemaDoDia(5, 0)).toBe(0);
  });

  test("o registro: o dia entra uma vez, os minutos somam, o humor guarda os 30 últimos", () => {
    let r = lerRegistro({ dias: ["2026-10-14"], minutos: 5, humores: [] });
    r = registrar(r, { hoje: "2026-10-15", minutos: 2 });
    r = registrar(r, { hoje: "2026-10-15", minutos: 0, humor: "Mais calma" });
    expect(r).toEqual({ dias: ["2026-10-14", "2026-10-15"], minutos: 7, humores: ["Mais calma"] });
    expect(lerRegistro("lixo")).toEqual({ dias: [], minutos: 0, humores: [] });
  });

  test("o balão conta a sequência de dias", () => {
    const hoje = new Date(2026, 9, 15, 10);
    expect(falaDoBalao(lerRegistro(null), hoje)).toBe(
      "Alguns minutos só seus. Comece por onde der.",
    );
    expect(
      falaDoBalao({ dias: ["2026-10-14", "2026-10-15"], minutos: 12, humores: [] }, hoje),
    ).toBe("🔥 2 dias seguidos · 12 min no total");
  });

  test("o tempo ao lado da barra e os minutos de quem encerra antes", () => {
    expect(formatarRestante(null)).toBe("");
    expect(formatarRestante(45)).toBe("45s");
    expect(formatarRestante(192)).toBe("3m");
    expect(minutosAoEncerrar(0)).toBe(1);
    expect(minutosAoEncerrar(14)).toBe(4);
  });
});

describe("as falas que o app não diz", () => {
  /** Todos os planos que a tela pode montar. */
  function* planos() {
    const temas = [...TEMAS_DE_MEDITACAO.map((t) => t.tema), ...PROGRAMA.map((d) => d.tema)];
    for (const tema of temas)
      for (const dias of [0, 1, 2])
        for (const { chave } of DENSIDADES)
          for (const minutos of [1, 5, 10])
            for (const [cuidado, posParto] of [
              [false, false],
              [true, false],
              [false, true],
            ] as const)
              for (const semanas of [null, 10, 24, 34])
                yield {
                  cuidado,
                  posParto,
                  plano: planoDaSessao({
                    minutos,
                    tema,
                    semanas,
                    cuidado,
                    posParto,
                    densidade: chave,
                    registro: { dias: Array(dias).fill("x"), minutos: 7, humores: [] },
                  }),
                };
  }

  test("cada fala de fora ainda existe no site (se o site mudar, a catraca avisa)", () => {
    const ids = new Set([...ROTEIROS, ...FALAS_DO_PROGRAMA].map((f) => f.id));
    for (const id of FALAS_FORA_DO_APP) expect(ids.has(id)).toBe(true);
  });

  test("nenhum plano diz consulta, 'normal', 'não é sinal', o bebê seguro aí dentro ou a respiração que mais ajuda no parto", () => {
    const fora = new Set<string>();
    for (const { plano } of planos())
      for (const d of plano.deixas)
        if (
          FALAS_FORA_DO_APP.has(d.fala.id) ||
          /consult|normal que|não é sinal|lugar seguro|o que mais ajuda|No dia, o corpo lembra|ser verdade/i.test(
            d.fala.texto,
          )
        )
          fora.add(`${d.fala.id}: ${d.fala.texto}`);
    expect([...fora]).toEqual([]);
  });

  test("no luto e no pós-parto, nada da gestação; no pós-parto, nem o bebê 'aqui dentro'", () => {
    const fora = new Set<string>();
    for (const { cuidado, posParto, plano } of planos())
      for (const d of plano.deixas) {
        if (cuidado && /gesta|grávid|gravidez|recém-nascid/i.test(d.fala.texto))
          fora.add(`luto ${d.fala.id}: ${d.fala.texto}`);
        if (posParto && /aqui dentro|gesta|grávid|gravidez|batendo por dois/i.test(d.fala.texto))
          fora.add(`pós ${d.fala.id}: ${d.fala.texto}`);
      }
    expect([...fora]).toEqual([]);
  });
});
