/**
 * Rolar até uma âncora que AINDA NÃO EXISTE.
 *
 * ─── O DEFEITO QUE ISTO RESOLVE ─────────────────────────────────────────────
 *
 * O menu do perfil tem "Plano, limite e cobrança", que troca de aba e rola até
 * `#cobranca`. A primeira versão fazia:
 *
 *     setTab("Meu Perfil");
 *     requestAnimationFrame(() => document.getElementById("cobranca")?.…);
 *
 * O quadro extra resolvia metade do problema — a troca de aba só vale no render
 * seguinte. Mas a metade que faltava é a que aparece na PRIMEIRA abertura: a
 * seção de perfil renderiza um esqueleto enquanto busca os dados do médico, e
 * `#cobranca` só entra na árvore quando essa busca termina. No quadro seguinte
 * o nó ainda não existe, o `?.` engole tudo, e o item de menu não faz nada.
 *
 * O sintoma é o pior tipo: funciona para quem já abriu o perfil antes (dados em
 * memória) e falha para quem clica pela primeira vez. Quem testa uma vez vê
 * funcionar.
 *
 * ─── POR QUE UMA ESPERA, E NÃO UM `setTimeout` MAIOR ────────────────────────
 *
 * Um `setTimeout(500)` é um palpite sobre a rede de outra pessoa: rápido demais
 * numa conexão ruim, e meio segundo de espera à toa numa boa. Aqui a condição é
 * observável — o nó existe ou não —, então dá para olhar a cada quadro e parar
 * no instante em que ele aparece.
 *
 * O teto existe para o caso de a âncora nunca chegar (erro no carregamento,
 * âncora renomeada). Sem ele, isto viraria um laço que roda para sempre numa
 * tela que o médico já abandonou.
 */

/** Quanto tempo, no máximo, vale a pena esperar a âncora aparecer. */
const LIMITE_MS = 4000;

export function rolarAte(
  id: string,
  opts: { limiteMs?: number; comportamento?: ScrollBehavior } = {},
): void {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  const limite = opts.limiteMs ?? LIMITE_MS;
  /* `performance.now` e não `Date.now`: só nos interessa o tempo decorrido, e
     ele não anda para trás quando o relógio do sistema é ajustado. */
  const inicio = performance.now();

  const tentar = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: opts.comportamento ?? "smooth", block: "start" });
      return;
    }
    if (performance.now() - inicio >= limite) return;
    requestAnimationFrame(tentar);
  };
  requestAnimationFrame(tentar);
}
