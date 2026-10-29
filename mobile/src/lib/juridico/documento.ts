/**
 * O FORMATO DOS DOCUMENTOS JURÍDICOS DO APP — um só, para três saídas: a tela
 * do app (`TelaDoDocumento`), o Markdown de `docs/juridico/` (para revisão) e a
 * página HTML hospedada no GitHub Pages (a URL pública que a App Store pede),
 * com a página de suporte que liga as duas.
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

/** O estilo das páginas hospedadas: sem dependência externa, legível no celular, claro e escuro. */
const ESTILO = `:root{--fundo:#fffaf6;--texto:#2f2140;--apagado:#6d5b85;--marca:#b0306a;--linha:#eadfe6}
@media (prefers-color-scheme:dark){:root{--fundo:#1d1622;--texto:#f4eef7;--apagado:#bfb2cc;--marca:#f08bb6;--linha:#3a2e42}}
body{margin:0;background:var(--fundo);color:var(--texto);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:42rem;margin:0 auto;padding:2rem 1rem 4rem}
h1{font-size:1.9rem;line-height:1.2;margin:0 0 .25rem}
h2{font-size:1.15rem;margin:2rem 0 .5rem}
.data{color:var(--apagado);margin:0 0 1.5rem}
.resumo{border-left:4px solid var(--marca);padding:.25rem 0 .25rem 1rem}
a{color:var(--marca)}
li{margin:.3rem 0}
.rodape{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--linha);color:var(--apagado)}`;

function pagina(titulo: string, conteudo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
<style>
${ESTILO}
</style>
</head>
<body>
<main>
${conteudo}
</main>
</body>
</html>
`;
}

/**
 * As três páginas se ligam pelo rodapé. Links relativos: valem no GitHub Pages
 * (`clovisbacha.github.io/doutorclovis/`) e em qualquer outro lugar que
 * hospede a pasta inteira.
 */
const RODAPE = `<nav class="rodape"><a href="index.html">Suporte</a> · <a href="termos.html">Termos de uso</a> · <a href="privacidade.html">Política de privacidade</a></nav>`;

/** A página HTML que se hospeda (a URL pública que a App Store pede). */
export function paraHtml(doc: DocumentoJuridico, data: string, contato: string): string {
  const corpo: string[] = [];
  for (const s of doc.secoes) {
    corpo.push(`<h2>${escapar(s.titulo)}</h2>`);
    for (const b of s.blocos) {
      if (typeof b === "string") corpo.push(`<p>${escapar(b)}</p>`);
      else corpo.push(`<ul>${b.lista.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>`);
    }
  }
  return pagina(
    `${doc.titulo} — Obstétrica`,
    `<h1>${escapar(doc.titulo)}</h1>
<p class="data">Versão de ${escapar(data)}.</p>
<p class="resumo">${escapar(doc.resumo)}</p>
${corpo.join("\n")}
<p>Dúvidas: <a href="mailto:${escapar(contato)}">${escapar(contato)}</a></p>
${RODAPE}`,
  );
}

/**
 * A PÁGINA DE SUPORTE — a raiz do site dos documentos, e a URL de suporte que
 * a App Store exige (ela precisa levar a um contato de verdade). Diz o mesmo
 * que o Perfil do app: o contato, que saúde é com quem acompanha a gestação,
 * o 192, e onde ficam a exclusão da conta e a cópia dos dados.
 */
export function paraSuporte(data: string, contato: string): string {
  const email = `<a href="mailto:${escapar(contato)}">${escapar(contato)}</a>`;
  return pagina(
    "Obstétrica — Suporte",
    `<h1>Obstétrica</h1>
<p class="data">Suporte do app</p>
<p class="resumo">O Obstétrica é uma comunidade de gestantes e mães, com um jogo de cuidado diário. Ele não dá orientação médica e não substitui quem acompanha a sua gestação.</p>
<h2>Fale com a gente</h2>
<p>Dúvidas sobre o app, a sua conta ou a Comunidade: ${email}.</p>
<p>Assuntos de saúde são com quem acompanha a sua gestação. Em emergência, ligue 192.</p>
<h2>A sua conta</h2>
<ul><li>Excluir a conta: no app, em Perfil → Excluir minha conta. A exclusão é feita na hora.</li><li>Uma cópia dos seus dados: no app, em Perfil → Baixar uma cópia dos meus dados.</li></ul>
<h2>Os documentos</h2>
<ul><li><a href="termos.html">Termos de uso</a></li><li><a href="privacidade.html">Política de privacidade</a></li></ul>
<p class="data">Versão de ${escapar(data)}.</p>`,
  );
}
