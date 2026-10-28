/**
 * O FORMATO DOS DOCUMENTOS JURÍDICOS DO APP — um só, para três saídas: a tela
 * do app (`TelaDoDocumento`), o Markdown de `docs/juridico/` (para revisão) e a
 * página HTML pronta para hospedar (a URL pública que a App Store pede).
 *
 * Um texto, três formas: se o texto mudar só numa, a tela diria uma coisa e a
 * loja outra. `scripts/gerar-juridico.ts` escreve as duas cópias de `docs/` a
 * partir daqui, e a catraca cobra que estejam em dia.
 *
 * Sem react-native: é testado pelo bun.
 */

export type Bloco = string | { lista: readonly string[] };

export type Secao = { titulo: string; blocos: readonly Bloco[] };

export type DocumentoJuridico = {
  titulo: string;
  /** Duas ou três frases que dizem o essencial, antes das seções. */
  resumo: string;
  secoes: readonly Secao[];
};

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O Markdown para revisão (`docs/juridico/*.md`). */
export function paraMarkdown(doc: DocumentoJuridico, data: string, contato: string): string {
  const linhas: string[] = [`# ${doc.titulo}`, "", `_Versão de ${data}._`, "", doc.resumo, ""];
  for (const s of doc.secoes) {
    linhas.push(`## ${s.titulo}`, "");
    for (const b of s.blocos) {
      if (typeof b === "string") linhas.push(b, "");
      else linhas.push(...b.lista.map((i) => `- ${i}`), "");
    }
  }
  linhas.push(`Dúvidas: ${contato}`, "");
  return linhas.join("\n");
}

/** A página HTML que se hospeda (sem dependência externa, legível no celular). */
export function paraHtml(doc: DocumentoJuridico, data: string, contato: string): string {
  const corpo: string[] = [];
  for (const s of doc.secoes) {
    corpo.push(`<h2>${escapar(s.titulo)}</h2>`);
    for (const b of s.blocos) {
      if (typeof b === "string") corpo.push(`<p>${escapar(b)}</p>`);
      else corpo.push(`<ul>${b.lista.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>`);
    }
  }
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(doc.titulo)} — Obstétrica</title>
<style>
:root{--fundo:#fffaf6;--texto:#2f2140;--apagado:#6d5b85;--marca:#b0306a}
@media (prefers-color-scheme:dark){:root{--fundo:#1d1622;--texto:#f4eef7;--apagado:#bfb2cc;--marca:#f08bb6}}
body{margin:0;background:var(--fundo);color:var(--texto);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:42rem;margin:0 auto;padding:2rem 1rem 4rem}
h1{font-size:1.9rem;line-height:1.2;margin:0 0 .25rem}
h2{font-size:1.15rem;margin:2rem 0 .5rem}
.data{color:var(--apagado);margin:0 0 1.5rem}
.resumo{border-left:4px solid var(--marca);padding:.25rem 0 .25rem 1rem}
a{color:var(--marca)}
li{margin:.3rem 0}
</style>
</head>
<body>
<main>
<h1>${escapar(doc.titulo)}</h1>
<p class="data">Versão de ${escapar(data)}.</p>
<p class="resumo">${escapar(doc.resumo)}</p>
${corpo.join("\n")}
<p>Dúvidas: <a href="mailto:${escapar(contato)}">${escapar(contato)}</a></p>
</main>
</body>
</html>
`;
}
