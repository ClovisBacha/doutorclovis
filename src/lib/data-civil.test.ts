/**
 * A DATA DE "HOJE" É O DIA CIVIL DO APARELHO, NUNCA O DIA UTC.
 *
 * ⚠️ Em UTC-3, das 21h à meia-noite, `toISOString()` já está no dia SEGUINTE.
 * O ritual de boas-vindas pré-preenchia a data do ultrassom assim: quem
 * aceitava a data à noite gravava `reference_date` de amanhã, e a idade
 * gestacional e a DPP ficavam um dia à frente pela gestação inteira — o número
 * que decide conduta, herdado pelo painel do médico. O mesmo defeito já tinha
 * sido consertado na DUM e ficou de pé aqui.
 *
 * `ymdLocal` (`utils.ts`) é a régua. Este arquivo prova a diferença e proíbe a
 * forma errada nas telas da paciente.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { ymdLocal } from "@/lib/utils";

function sobFuso<T>(tz: string, f: () => T): T {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try {
    return f();
  } finally {
    process.env.TZ = antes;
  }
}

function arquivosTsx(dir: string): string[] {
  const saida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivosTsx(caminho));
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) saida.push(caminho);
  }
  return saida;
}

describe("⚠️ às 22h30 de São Paulo ainda é hoje", () => {
  test("a régua devolve o dia civil; o ISO já virou", () => {
    const noite = new Date("2026-09-05T22:30:00-03:00");
    expect(sobFuso("America/Sao_Paulo", () => ymdLocal(noite))).toBe("2026-09-05");
    expect(noite.toISOString().slice(0, 10)).toBe("2026-09-06");
  });
});

describe("⚠️ nenhuma tela da paciente tira 'hoje' do ISO", () => {
  const PROIBIDO =
    /toISOString\(\)\s*\.\s*(split\("T"\)\[0\]|slice\(0,\s*10\)|substring\(0,\s*10\))/;

  test("componentes e rotas autenticadas", () => {
    const arquivos = [
      ...arquivosTsx("src/components"),
      ...arquivosTsx("src/routes/_authenticated"),
    ];
    expect(arquivos.length).toBeGreaterThan(50);
    const culpados = arquivos.filter((f) => PROIBIDO.test(semComentarios(readFileSync(f, "utf8"))));
    expect(culpados).toEqual([]);
  });

  test("e o ritual de boas-vindas usa a régua", () => {
    const ritual = semComentarios(readFileSync("src/components/onboarding-ritual.tsx", "utf8"));
    expect(ritual).toContain("useState(ymdLocal())");
  });
});
