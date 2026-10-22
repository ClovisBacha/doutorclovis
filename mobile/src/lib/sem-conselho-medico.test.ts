import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * O APP É REDE SOCIAL + GAMIFICAÇÃO, NÃO CONSELHO MÉDICO (decisão do dono,
 * 21/10/2026 — ver o CLAUDE.md).
 *
 * A fase 1 tirou a triagem, o registro de peso, pressão e glicemia, as réguas
 * dos chutes e das contrações, os exames, a dieta e as frases que prometiam um
 * médico. Esta catraca cobra que nada disso volte por um caminho novo: nem a
 * tela, nem a régua do site importada direto, nem a frase.
 */

const RAIZ = join(import.meta.dir, "..");

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}

const FONTES = arquivos(RAIZ).map((p) => ({
  arquivo: relative(RAIZ, p),
  codigo: semComentarios(readFileSync(p, "utf8")),
}));

/** Onde um padrão aparece, fora dos arquivos permitidos. */
function ondeAparece(padrao: RegExp, permitidos: readonly string[] = []): string[] {
  return FONTES.filter(
    (f) => !permitidos.some((p) => f.arquivo.startsWith(p)) && padrao.test(f.codigo),
  ).map((f) => f.arquivo);
}

describe("o app não dá conselho médico", () => {
  test("as telas que saíram não existem nem são chamadas", () => {
    expect(existsSync(join(RAIZ, "app", "saude", "sintomas.tsx"))).toBe(false);
    expect(existsSync(join(RAIZ, "app", "saude", "registros.tsx"))).toBe(false);
    expect(ondeAparece(/["'`]\/saude\/(sintomas|registros|contracoes)["'`?]/)).toEqual([]);
  });

  test("nenhuma régua clínica do site entra direto numa tela", () => {
    /* A triagem só empresta a lista de sinais ao SOS; a nutrição com IA está
       desligada atrás de IA_NO_APP (ver ia-desligada.test.ts). */
    expect(ondeAparece(/from "@\/lib\/triage"/, ["lib/saude/triagem-local.ts"])).toEqual([]);
    expect(ondeAparece(/from "@\/lib\/(analise-de-contracoes|bandeiras-do-parto)"/)).toEqual([]);
    expect(ondeAparece(/from "@\/lib\/sinais-clinicos"/)).toEqual([]);
    expect(ondeAparece(/import \{[^}]*\} from "@\/lib\/serie-de-chutes"/)).toEqual([]);
    expect(
      ondeAparece(/from "@\/lib\/nutricao-da-semana"/, ["lib/nutricao/", "componentes/nutricao/"]),
    ).toEqual([]);
  });

  test("o app não grava nem lê registro de saúde nem triagem", () => {
    expect(ondeAparece(/["'`](health_logs|triage_logs)["'`]/)).toEqual([]);
    expect(ondeAparece(/saveTriageLog|assessSymptoms/)).toEqual([]);
  });

  test("o bebê da semana, a reta final e os exames passam pelo app", () => {
    /* `babyForWeek` tem quatro semanas que falam como prontuário, e
       `retaFinalMensagem` cita exames e indução: só `bebe-da-semana.ts` os
       chama. A agenda de exames (`consultaForWeek`) saiu de vez. */
    expect(ondeAparece(/\b(babyForWeek|retaFinalMensagem)\(/, ["lib/bebe-da-semana.ts"])).toEqual(
      [],
    );
    expect(ondeAparece(/\bconsultaForWeek\b/)).toEqual([]);
    expect(ondeAparece(/\bfraseDoDia\(/, ["lib/frase-do-dia.ts"])).toEqual([]);
  });

  test("nenhuma frase promete um médico que a v1 não tem, nem dá régua", () => {
    /* `frase-do-dia.ts` guarda a frase do site justamente para tirá-la. */
    expect(
      ondeAparece(/seu médico vê|chega ao seu médico|Guardado no seu histórico/, [
        "lib/frase-do-dia.ts",
      ]),
    ).toEqual([]);
    /* `desafios-no-app.ts` guarda o texto do site que ele troca; o que ela vê
       é conferido em `desafios-no-app.test.ts`. */
    expect(
      ondeAparece(/5-1-1|o esperado são 10|Chegou a 10/, ["lib/jornada/desafios-no-app.ts"]),
    ).toEqual([]);
  });

  test("os movimentos do bebê têm a linha fixa para o SOS, e nenhuma meta", () => {
    const chutes = FONTES.find((f) => f.arquivo === "app/saude/chutes.tsx")!.codigo;
    expect(chutes).toContain("Sentiu o bebê diferente?");
    expect(chutes).toContain('router.push("/sos")');
    expect(chutes).not.toMatch(/de 10\b/);
  });

  test("o cronômetro de contrações mora no SOS e não diz quando ligar", () => {
    const sos = FONTES.find((f) => f.arquivo === "app/sos.tsx")!.codigo;
    expect(sos).toContain('router.push("/contracoes")');
    const contracoes = FONTES.find((f) => f.arquivo === "app/contracoes.tsx")!.codigo;
    expect(contracoes).not.toMatch(/ligue|Ligar 192|maternidade/i);
  });
});
