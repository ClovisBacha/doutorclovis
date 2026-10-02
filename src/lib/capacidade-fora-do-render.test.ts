/**
 * CAPACIDADE DO NAVEGADOR NÃO SE LÊ NO RENDER.
 *
 * ⚠️ Estas funções respondem uma coisa no SERVIDOR e outra no CLIENTE — é a
 * natureza delas. Chamadas durante o render, o HTML do SSR e a primeira pintura
 * do cliente discordam, e o React DESCARTA a árvore inteira. Num app que já
 * ficou SEM ABRIR por um defeito de hidratação, isto não é detalhe.
 *
 * O padrão certo é `useState(false)` + `useEffect(() => set(...), [])`, e ele já
 * existia em `gestacao-path.tsx` (o gravador do diário) quando eu escrevi a
 * versão errada na conversa — a três arquivos de distância.
 *
 * ⚠️ **O guarda `typeof window === "undefined"` NÃO resolve.** Ele evita o
 * CRASH no servidor; a DIVERGÊNCIA continua, porque as duas execuções são
 * exatamente as que precisam concordar. Mesma lição do `location.origin`.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** ⚠️ Tira a prosa: a explicação acima cita o que ela proíbe. */
const semProsa = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Funções cuja resposta depende do navegador — logo, do lado que executa. */
const CAPACIDADES = ["podeGravar", "podeCompartilhar", "ehNativo"];

function arquivos(dir: string): string[] {
  const saida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivos(p));
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) saida.push(p);
  }
  return saida;
}

describe("capacidade do navegador fica fora do render", () => {
  for (const fn of CAPACIDADES) {
    test(`\`${fn}()\` nunca é chamada dentro de JSX`, () => {
      const culpados: string[] = [];
      for (const f of [...arquivos("src/components"), ...arquivos("src/routes")]) {
        const c = semProsa(readFileSync(f, "utf8"));
        /* Dentro de JSX é sempre `{fn() …` ou `{algo && fn()`. Fora dele, a
           chamada legítima mora num `useEffect`, num manipulador ou num `const`
           de módulo — nenhum dos três começa com `{`. */
        if (new RegExp(`\\{[^}\\n]*\\b${fn}\\(\\)`).test(c)) culpados.push(f);
      }
      expect(culpados).toEqual([]);
    });
  }

  test("⚠️ e a varredura MORDE — o padrão ruim é reconhecido", () => {
    /* Catraca que passa em vazio é catraca que mente. */
    const ruim = `{podeGravar() && !texto.trim() && (`;
    expect(new RegExp(`\\{[^}\\n]*\\bpodeGravar\\(\\)`).test(ruim)).toBe(true);
    const bom = `useEffect(() => setTemMicrofone(podeGravar()), []);`;
    expect(new RegExp(`\\{[^}\\n]*\\bpodeGravar\\(\\)`).test(bom)).toBe(false);
  });
});
