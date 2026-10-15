import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* O diário é lido pelo gráfico de humor e pelo histórico dela, que esperam as
   linhas no formato do site. Se um lado mudar o texto, o outro precisa saber. */
const RAIZ = join(import.meta.dir, "..", "..", "..", "..");
/* O formatador quebra as linhas como quiser: compara com os espaços juntados. */
const ler = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8").replace(/\s+/g, " ");
const SITE = ler("src", "components", "gestacao-path.tsx");

describe("as atividades escrevem no diário como o site", () => {
  test("o exercício: 'Exercício de N min · queixa: desfecho'", () => {
    expect(SITE).toContain(
      "content: `Exercício de ${minutos} min · ${rotulo}: ${desfecho.toLowerCase()}`",
    );
    expect(ler("mobile", "src", "app", "jornada", "mexer.tsx")).toContain(
      "`Exercício de ${minutos} min · ${rotulo}: ${d.toLowerCase()}`",
    );
  });
  test("a meditação: 'Meditação de N min · humor', com o emoji no humor", () => {
    expect(SITE).toContain("content: `Meditação de ${minutos} min · ${label}`");
    expect(SITE).toContain("mood: emoji");
    const app = ler("mobile", "src", "app", "jornada", "meditar.tsx");
    expect(app).toContain("`Meditação de ${minutosFeitos || minutos} min · ${c.label}`, c.emoji,");
  });
});
