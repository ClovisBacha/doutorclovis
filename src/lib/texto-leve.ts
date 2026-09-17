/**
 * TEXTO LEVE — negrito e lista, e mais nada.
 *
 * A nutricionista responde em linhas curtas, com "•" no começo das ideias e,
 * às vezes, um `**assim**` para o que importa. A bolha pintava isso CRU: os
 * asteriscos apareciam na tela e a lista era só texto com marcador.
 *
 * ⚠️ NÃO é Markdown, e não deve virar. O `react-markdown` inteiro custa ~70 kB
 * comprimidos e já foi tirado do pacote de entrada uma vez; aqui a pergunta é
 * menor — duas marcas — e a resposta é uma régua pura que devolve BLOCOS, para
 * um componente desenhar em nós de React. Nunca HTML: o texto vem do modelo,
 * e a única forma segura de destacar pedaços dele é quebrar em nós.
 *
 * O que ela reconhece:
 *   - `**negrito**` dentro de uma linha (par fechado; um `**` solto fica como
 *     está, porque no meio de um streaming o par ainda não chegou);
 *   - linha que começa com `•`, `-`, `–`, `*` ou `1.`/`1)` seguido de espaço é
 *     item de lista; itens seguidos formam UMA lista;
 *   - linha em branco separa parágrafos.
 *
 * Tudo o mais é texto, e sai como entrou.
 */

export type Trecho = { texto: string; negrito: boolean };

export type Bloco =
  | { tipo: "paragrafo"; linhas: Trecho[][] }
  | { tipo: "lista"; ordenada: boolean; itens: Trecho[][] };

/* O marcador só vale no COMEÇO da linha. `**Negrito**` não casa: o `*` vem
   seguido de outro `*`, e não de espaço. */
const MARCADOR = /^\s*(?:([•\-–*])|(\d{1,2})[.)])\s+/;
const NEGRITO = /\*\*([^*\n]+?)\*\*/g;

/** Uma linha em trechos, com o que estava entre `**` marcado. */
export function trechosDe(linha: string): Trecho[] {
  const out: Trecho[] = [];
  let ultimo = 0;
  for (const m of linha.matchAll(NEGRITO)) {
    const i = m.index ?? 0;
    if (i > ultimo) out.push({ texto: linha.slice(ultimo, i), negrito: false });
    out.push({ texto: m[1], negrito: true });
    ultimo = i + m[0].length;
  }
  if (ultimo < linha.length) out.push({ texto: linha.slice(ultimo), negrito: false });
  return out.length ? out : [{ texto: "", negrito: false }];
}

/** O texto inteiro em blocos: parágrafos (linhas) e listas (itens). */
export function blocosDe(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let paragrafo: Trecho[][] = [];
  let lista: { ordenada: boolean; itens: Trecho[][] } | null = null;
  const fechaParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", linhas: paragrafo });
    paragrafo = [];
  };
  const fechaLista = () => {
    if (lista) blocos.push({ tipo: "lista", ...lista });
    lista = null;
  };
  for (const bruta of texto.replace(/\r\n/g, "\n").split("\n")) {
    const linha = bruta.trimEnd();
    if (!linha.trim()) {
      fechaParagrafo();
      fechaLista();
      continue;
    }
    const m = MARCADOR.exec(linha);
    if (m) {
      fechaParagrafo();
      const ordenada = m[2] != null;
      if (!lista || lista.ordenada !== ordenada) {
        fechaLista();
        lista = { ordenada, itens: [] };
      }
      lista.itens.push(trechosDe(linha.slice(m[0].length)));
      continue;
    }
    fechaLista();
    paragrafo.push(trechosDe(linha));
  }
  fechaParagrafo();
  fechaLista();
  return blocos;
}

/** Há alguma coisa a desenhar além de texto cru? Sem marca, a bolha pinta a
 *  string como sempre pintou — o caminho antigo continua sendo o caminho. */
export function temMarcas(texto: string): boolean {
  if (NEGRITO.test(texto)) {
    NEGRITO.lastIndex = 0;
    return true;
  }
  NEGRITO.lastIndex = 0;
  return texto.split("\n").some((l) => MARCADOR.test(l));
}

/** O texto SEM as marcas, para onde só cabe uma linha de prévia (o cartão
 *  compacto, com `line-clamp`): os asteriscos saem e todo marcador vira "•". */
export function semMarcas(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(MARCADOR, (m) => (m.trim() ? "• " : m)))
    .join("\n")
    .replace(NEGRITO, "$1");
}
