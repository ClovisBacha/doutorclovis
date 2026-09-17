/**
 * A URL EFETIVA PRESERVA O PARÂMETRO QUE A BANCADA PEDIU?
 *
 * ⚠️ **Esta régua existe por quatro estados de bancada que NUNCA foram
 * desenhados**, e que a prosa do CLAUDE.md documentava como se funcionassem:
 * `/preview-sons?luto=1`, `/preview-cantinho?luto=1`, `?vazio=1` e
 * `/preview-jogo?premium=1`. O router JSON-parseia a query — `?luto=1` chega
 * como o NÚMERO 1 — e `q.luto === "1"` é falso: a bancada abre no PADRÃO e a
 * URL volta reescrita como `?luto=false`.
 *
 * ⚠️ **E A VARREDURA DE CONSOLE NÃO TEM COMO VER.** Ela abre a página e lê os
 * erros; uma tela que desenha o estado ERRADO não registra erro nenhum. As
 * quatro passaram verdes por levas.
 *
 * `parametro-de-bancada.test.ts` é a catraca ESTÁTICA — ela varre o fonte
 * atrás da forma conhecida (`=== "1"` sem `String(...)`) e morde antes de a
 * bancada abrir. Esta é a DINÂMICA: ela não conhece forma nenhuma, compara o
 * que foi pedido com o que o router devolveu, e por isso pega também a forma
 * que ninguém previu.
 *
 * ⚠️ **CADA LINHA DA RÉGUA SAIU DE MEDIÇÃO, e não de suposição.** Rodada em
 * 172 alvos com parâmetro (set/2026):
 *
 *   · `"1" -> "true"`   38 casos — a normalização LEGÍTIMA de booleano
 *   · `"0" -> "false"`  idem, do outro lado
 *   · `"3" -> "true"`   `/preview-home?notif=3` — o VALOR não se perdeu: ele
 *                       foi para `quantos=3`, que é o campo que o CLAUDE.md
 *                       descreve. Uma régua ingênua acusaria aqui, e **catraca
 *                       que reprova o estado correto é catraca que alguém
 *                       desliga.**
 *   · omissão            ZERO casos — o router escreve TODOS os parâmetros com
 *                       os padrões na URL, então um que sumiu foi DESCARTADO.
 *                       Medido: `?w=20&inexistente=1` volta com o desconhecido
 *                       intacto, ou seja nem o que ele não conhece some.
 *
 * ⚠️ Ela deixa passar de propósito um caso: numérico truthy virando `"true"`
 * (o `notif=3`). É um falso NEGATIVO consciente, e é o preço de não ter o
 * falso positivo — que custa a catraca inteira.
 */

/** O que o router escreve quando o parâmetro caiu no padrão desligado. */
const FALSO = new Set(["", "0", "false"]);

/**
 * `null` quando o parâmetro sobreviveu; senão, POR QUE ele não sobreviveu.
 * Recebe strings porque é assim que `URLSearchParams` entrega — e `null` no
 * efetivo quer dizer que a chave sumiu da URL.
 */
export function porQueSePerdeu(pedido, efetivo) {
  if (efetivo === null) return "sumiu da URL (descartado pelo validateSearch)";
  if (efetivo === pedido) return null;
  /* As duas normalizações legítimas de booleano. */
  if (pedido === "1" && efetivo === "true") return null;
  if (pedido === "0" && efetivo === "false") return null;
  /* Truthy virando `true`: o valor foi para outro campo (o `?notif=3`). */
  if (!FALSO.has(pedido) && efetivo === "true") return null;
  if (!FALSO.has(pedido) && FALSO.has(efetivo)) return "caiu no padrão desligado";
  return "trocado por outro valor";
}

/** Os parâmetros da `pedida` que a `efetiva` não preservou, já com o motivo. */
export function parametrosPerdidos(pedida, efetiva) {
  const p = new URL(pedida, "http://b").searchParams;
  const e = new URL(efetiva, "http://b").searchParams;
  const perdidos = [];
  for (const [k, v] of p) {
    const motivo = porQueSePerdeu(v, e.get(k));
    if (motivo) perdidos.push(`?${k}=${v} — ${motivo} (efetivo: ${e.get(k) ?? "ausente"})`);
  }
  return perdidos;
}
