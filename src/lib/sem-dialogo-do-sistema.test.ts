import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ⚠️ NADA DE `alert`/`confirm`/`prompt` NO APP QUE RODA NO IPHONE.
 *
 * Duas razões, e as duas são concretas:
 *
 *  1. **No app instalado o diálogo do sistema abre com "www.obstetrica.com.br
 *     diz:"** — o nome do domínio, dentro do app. É a cara de "site
 *     embrulhado" que a diretriz 4.2 da Apple reprova, e ela aparece
 *     justamente nas telas de apagar coisa, que é onde a paciente menos
 *     precisa duvidar de onde está.
 *  2. **É a decisão que o dono já tomou**, explicitamente, no cancelar
 *     consulta: confirmação em MENSAGEM separada, com Sim/Não — nunca o mesmo
 *     botão virando "tem certeza?", e nunca um diálogo do navegador.
 *
 * ⚠️ **A lição já estava escrita numa das telas e não tinha sido aplicada às
 * outras.** `minha-conta.tsx` tinha, desde antes, um comentário dizendo "era um
 * `alert()` do sistema; num app instalado isso é um diálogo modal" — e três
 * outros `alert`/`confirm` seguiam vivos no mesmo arquivo. É a mesma forma do
 * `42703` em caminho de escrita: consertado num lugar, deixado em cinco.
 */
function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.tsx?$/.test(n) && !n.includes(".test.")) out.push(p);
  }
  return out;
}

/** Sem comentários: a prosa deste repo cita os padrões que ela condena. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * ⚠️ **O RECORTE É O APP DA PACIENTE, e é deliberado.**
 *
 * É ele que vira app de iPhone (`capacitor.config.ts` aponta para `/auth`, e a
 * paciente cai em `/minha-conta`). O painel do médico é usado no computador,
 * onde um `confirm` é feio mas não é o problema de revisão da Apple — e proibir
 * ali obrigaria a mexer em oito lugares para resolver zero.
 *
 * As BANCADAS ficam de fora: `alert` numa `/preview-*` é o jeito mais direto de
 * mostrar para onde um toque levaria, e elas não vão para a loja.
 */
const DO_APP = [
  "src/routes/_authenticated/minha-conta.tsx",
  ...arquivos("src/components").filter((f) => !f.includes("/ui/")),
];

describe("o app da paciente não usa diálogo do sistema", () => {
  test("⚠️ nenhum alert/confirm/prompt", () => {
    const culpados: string[] = [];
    for (const f of DO_APP) {
      const codigo = semComentarios(readFileSync(f, "utf8"));
      /* `window.confirm(`, `alert(`, `confirm(` — mas não `.prompt()` de um
         objeto (o evento de instalação do PWA tem um método com esse nome). */
      if (/(^|[^.\w])(window\.)?(alert|confirm)\s*\(/.test(codigo)) {
        culpados.push(f.replace("src/", ""));
      }
    }
    expect(culpados).toEqual([]);
  });

  test("a varredura olha arquivos de verdade", () => {
    expect(DO_APP.length).toBeGreaterThan(30);
    expect(DO_APP).toContain("src/routes/_authenticated/minha-conta.tsx");
  });
});
