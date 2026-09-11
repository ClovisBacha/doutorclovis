/**
 * PARA ONDE UM AVISO LEVA — e por que isto é uma régua, e não um `href`.
 *
 * O servidor manda `url` em todo push que ele dispara (a consulta confirmada,
 * a vaga liberada, o presente, o resumo de domingo), e ninguém lia: o
 * `notificationclick` do service worker abria `"/minha-conta"` cru, e o app
 * nativo não tinha ouvinte nenhum. Tocar no aviso "sua consulta é amanhã"
 * abria a tela em que o app estava — e ela ficava procurando o que o aviso
 * dizia.
 *
 * ⚠️ **O CAMINHO VEM DE FORA, e por isso ele é LIMPO antes de virar
 * navegação.** O corpo do push é montado pelo servidor, mas o que chega ao
 * aparelho passa pelo serviço de push da Apple/Google e é entregue como dado
 * arbitrário. Navegar para o que vier de lá sem conferir é abrir a porta para
 * `javascript:` (execução na origem do app, com a sessão dela dentro) e para
 * `https://outro.site` (uma tela que PARECE o app pedindo a senha dela).
 *
 * A régua é uma linha e ela é fechada, não aberta: **só caminho relativo da
 * própria origem**. Nada de esquema, nada de host, nada de `//`.
 *
 * ⚠️ **Recusar cai no app, nunca em lugar nenhum.** Um aviso que não abre nada
 * é indistinguível de um aviso quebrado; o destino padrão é a casca do app,
 * que é para onde ela ia antes.
 */

/** Onde um aviso sem destino — ou com destino recusado — leva. */
export const DESTINO_PADRAO = "/minha-conta";

export function caminhoSeguroDoPush(cru: unknown): string {
  if (typeof cru !== "string") return DESTINO_PADRAO;
  const t = cru.trim();
  if (!t) return DESTINO_PADRAO;

  /* ⚠️ Tem de COMEÇAR com uma barra só. `//outro.site` é um endereço absoluto
     sem esquema — o navegador o resolve como `https://outro.site` — e é o caso
     que uma checagem ingênua de "começa com /" deixa passar. */
  if (!t.startsWith("/") || t.startsWith("//")) return DESTINO_PADRAO;

  /* Esquema embutido: `/\njavascript:…`, `/%0ajavascript:` e afins. Nenhum
     caminho legítimo deste app tem dois-pontos antes da primeira `?`. */
  const antesDaQuery = t.split(/[?#]/)[0];
  if (antesDaQuery.includes(":")) return DESTINO_PADRAO;

  /* Controle e espaço em branco: nenhum destino legítimo tem isso, e um
     caminho com quebra de linha crua é sinal de que alguém está montando o
     valor para enganar quem lê o log.
     ⚠️ A FAIXA VAI POR ESCAPE, nunca com os caracteres literais: eles são
     INVISÍVEIS no editor, e quem reformatar o arquivo os apaga sem ver — é a
     mesma lição das marcas combinantes do filtro de palavras. */
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(t)) return DESTINO_PADRAO;

  /* Subir de diretório não muda a origem, mas não existe caminho deste app com
     `..` — e aceitar o que não se usa é superfície à toa. */
  if (t.includes("..")) return DESTINO_PADRAO;

  return t;
}
