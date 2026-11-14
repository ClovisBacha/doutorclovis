import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MOVIMENTOS } from "@/lib/exercicios";
import { HISTORIAS } from "@/lib/historias-para-dormir";
import { FALAS_DO_PROGRAMA } from "@/lib/meditacao-programa";
import { ROTEIROS } from "@/lib/meditacao-roteiros";
import { SESSAO_DO_CASAL } from "@/lib/sessao-do-casal";
import { TEXTO_REGRAVADO } from "~/lib/audio/regravadas-texto";
import { blocosDoCasalNoApp } from "~/lib/jornada/casal";
import {
  FALAS_FORA_DO_APP,
  falaDoFechamento,
  FECHAMENTO,
  FECHAMENTO_TROCADO_NO_APP,
  planoDaSessao,
  TEMAS_DE_MEDITACAO,
} from "~/lib/jornada/meditacao";
import { movimentoNoApp, narracaoNoApp } from "~/lib/jornada/mexer";

/**
 * A REGRAVAÇÃO (`docs/regravacao`): o roteiro, os mapas gerados e a troca.
 *
 * Texto e voz entram juntos: uma fala só está nos mapas quando o arquivo dela
 * existe. Enquanto a pasta está vazia, os mapas estão vazios e o app segue como
 * antes — e a troca é conferida aqui com um mapa de mentira, com as 40 falas.
 */

const RAIZ = join(import.meta.dir, "..", "..", "..", "..");
const ROTEIRO = JSON.parse(
  readFileSync(join(RAIZ, "docs", "regravacao", "roteiro.json"), "utf8"),
) as {
  voz: { voice_id: string };
  falas: { id: string; texto_do_site: string; texto_novo: string }[];
};
const PASTA = join(RAIZ, "mobile", "assets", "vozes", "regravadas");
const MAPA_DA_VOZ = readFileSync(join(import.meta.dir, "regravadas.ts"), "utf8");

/** Todas as falas regravadas, como se os 40 arquivos já existissem. */
const TODAS = Object.fromEntries(ROTEIRO.falas.map((f) => [f.id, f.texto_novo]));

const FECHAMENTO_DO_ID: Record<string, string> = {
  "fe-sono": "Com sono",
  "fe-conectada": "Conectada",
  "fe-ansiosa": "Ainda ansiosa",
};

/** O que o SITE diz hoje no lugar de cada fala do roteiro. */
function textoDoSite(id: string): string | undefined {
  const fala = [...ROTEIROS, ...FALAS_DO_PROGRAMA].find((f) => f.id === id);
  if (fala) return fala.texto;
  const bloco = SESSAO_DO_CASAL.blocos.find((b) => b.id === id);
  if (bloco) return bloco.texto;
  for (const h of HISTORIAS) {
    const b = h.blocos.find((x) => x.id === id);
    if (b) return b.texto;
  }
  if (id.startsWith("mov-")) {
    const m = MOVIMENTOS.find((x) => x.id === id.slice(4));
    return m ? `${m.name}. ${m.cue}` : undefined;
  }
  const rotulo = FECHAMENTO_DO_ID[id];
  return rotulo ? FECHAMENTO_TROCADO_NO_APP[rotulo]?.site : undefined;
}

describe("o roteiro da regravação", () => {
  test("cada texto de hoje ainda é o do site (se o site mudar, a catraca avisa)", () => {
    for (const f of ROTEIRO.falas)
      expect([f.id, textoDoSite(f.id)]).toEqual([f.id, f.texto_do_site]);
    expect(ROTEIRO.voz.voice_id).toBe("80924413-1ea8-4e64-9719-e00b86796f05");
  });

  test("onde o app já mostra o texto novo, a voz nova diz o mesmo (fechamento e Mexer)", () => {
    for (const f of ROTEIRO.falas) {
      const rotulo = FECHAMENTO_DO_ID[f.id];
      if (rotulo) expect(f.texto_novo).toBe(FECHAMENTO[rotulo]!);
      if (f.id.startsWith("mov-")) {
        const m = movimentoNoApp(MOVIMENTOS.find((x) => x.id === f.id.slice(4))!);
        expect(f.texto_novo).toBe(`${m.name}. ${m.cue}`);
      }
    }
  });

  test("nenhum texto novo dá gênero ao bebê, cita consulta ou promete eficácia", () => {
    const fora = ROTEIRO.falas.filter((f) =>
      /\b(ele|dele) (conhece|sente|continua|não julga|vai reconhecer)\b|corpo dele|pra ele|com ele\b|consult|normal|não é sinal|o que mais ajuda|mais útil|\bfunciona\b|no exame|grávida|ninguém vai lembrar/i.test(
        f.texto_novo,
      ),
    );
    expect(fora.map((f) => f.id)).toEqual([]);
  });
});

describe("os mapas gerados (texto e voz juntos)", () => {
  test("batem com a pasta e com o roteiro — só entra a fala cujo arquivo existe", () => {
    const naPasta = existsSync(PASTA)
      ? readdirSync(PASTA)
          .filter((f) => f.endsWith(".mp3"))
          .map((f) => f.slice(0, -4))
          .sort()
      : [];
    const naVoz = [...MAPA_DA_VOZ.matchAll(/^\s+"([\w-]+)": require\(/gm)].map((m) => m[1]).sort();
    expect(Object.keys(TEXTO_REGRAVADO).sort()).toEqual(naPasta);
    expect(naVoz).toEqual(naPasta);
    for (const [id, texto] of Object.entries(TEXTO_REGRAVADO)) expect(texto).toBe(TODAS[id]!);
  });
});

describe("a troca, com as 40 falas regravadas", () => {
  test("a meditação diz o texto novo e devolve as falas que tinham saído", () => {
    const vistas = new Map<string, string>();
    const temas = TEMAS_DE_MEDITACAO.map((t) => t.tema);
    for (const tema of [...temas, "prog-3", "prog-5", "prog-6"])
      for (const dias of [0, 1, 2])
        for (const minutos of [5, 10])
          for (const semanas of [10, 20, 34])
            for (const d of planoDaSessao({
              minutos,
              tema,
              semanas,
              cuidado: false,
              densidade: "guiada",
              registro: { dias: Array(dias).fill("x"), minutos: 7, humores: [] },
              regravadas: TODAS,
            }).deixas)
              vistas.set(d.fala.id, d.fala.texto);
    for (const [id, texto] of vistas) if (TODAS[id]) expect(texto).toBe(TODAS[id]!);
    /* O tema "Conexão com o bebê" sem o "ele", e as falas que tinham saído de volta. */
    expect([...vistas.values()].some((t) => /\bele (conhece|sente)\b|pra ele/i.test(t))).toBe(
      false,
    );
    const devolvidas = [...FALAS_FORA_DO_APP].filter((id) => vistas.has(id));
    expect(devolvidas.length).toBeGreaterThan(0);
  });

  test("sem a regravação, nada muda: as falas de fora seguem fora", () => {
    for (const tema of TEMAS_DE_MEDITACAO.map((t) => t.tema))
      for (const d of planoDaSessao({
        minutos: 10,
        tema,
        semanas: 34,
        cuidado: false,
        densidade: "guiada",
        registro: { dias: [], minutos: 7, humores: [] },
        regravadas: {},
      }).deixas)
        expect(FALAS_FORA_DO_APP.has(d.fala.id)).toBe(false);
  });

  test("o fechamento, o casal e o Mexer trocam texto e voz juntos", () => {
    expect(falaDoFechamento("Com sono", TODAS)).toBe("fe-sono");
    expect(falaDoFechamento("Ainda ansiosa", TODAS)).toBe("fe-ansiosa");
    expect(falaDoFechamento("Com sono", {})).toBeNull();
    expect(falaDoFechamento("Mais calma", {})).toBe("fe-calma");

    const blocos = blocosDoCasalNoApp(TODAS);
    for (const id of ["casal-05", "casal-13", "casal-15"])
      expect(blocos.find((b) => b.id === id)?.texto).toBe(TODAS[id]!);
    expect(blocosDoCasalNoApp({})).toEqual(SESSAO_DO_CASAL.blocos);

    expect(narracaoNoApp("tornozelo", TODAS)).toBe("regravada");
    expect(narracaoNoApp("tornozelo", {})).toBeNull();
    expect(narracaoNoApp("ombros", {})).toBe("site");
  });
});
