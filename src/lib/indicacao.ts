/**
 * O LINK DE INDICAÇÃO — um lugar só, porque a aba inteira depende dele.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────────
 *
 * A aba das Amigas tinha um botão "Convidar" que mandava `${origin}/auth` — o
 * link de login, PURO, sem código de indicação nenhum.
 *
 * Não é um detalhe de texto: o grafo de amizade deste app É o de indicação
 * (`referred_by`, nos dois sentidos). Sem o código, a amiga que entrasse por
 * aquele link criava a conta e **nunca virava amiga dela**. Ela não apareceria
 * na lista, não daria para formar dupla, não daria para presentear, e as 100 🌱
 * da indicação não seriam pagas a ninguém.
 *
 * Ou seja: o botão da tela cujo assunto inteiro é trazer alguém era o único
 * caminho do app que NÃO trazia ninguém. E falhava em silêncio — as duas
 * pacientes achariam que o app estava quebrado, sem nada a que apontar.
 *
 * ─── POR QUE UM MÓDULO, E NÃO DUAS STRINGS ──────────────────────────────────
 *
 * O `ReferralCard` (dentro do Cantinho) montava o link certo à mão; a aba das
 * Amigas montava o errado à mão. Duas construções do mesmo link, e a que
 * divergiu foi a mais nova — que é sempre como isto acontece. Aqui é função
 * pura e testada, e as duas telas chamam a mesma.
 *
 * ⚠️ O PARÂMETRO TAMBÉM MORA AQUI. `?amiga=` está escrito em `__root.tsx` (que
 * captura), em `referral.functions.ts` (a prosa) e nas telas que montam o link.
 * Trocar o nome em três lugares e esquecer o quarto quebraria a indicação
 * inteira sem erro nenhum — todo mundo continuaria funcionando, e nenhuma amiga
 * seria atribuída de novo.
 */

/** O nome do parâmetro na URL. `__root.tsx` lê exatamente este. */
export const PARAM_INDICACAO = "amiga";

/** O domínio de produção — recuo para quando não há `window` (SSR). */
export const SITE = "https://www.obstetrica.com.br";

/**
 * O link que carrega a indicação.
 *
 * ⚠️ Aponta para a RAIZ, e não para `/auth`. O código é capturado em QUALQUER
 * página (`useReferralCapture` roda no `__root`), e a raiz é a que apresenta o
 * app a quem nunca ouviu falar dele. Mandar direto para o login pede que ela
 * crie conta num produto que ainda não viu.
 *
 * ⚠️ E devolve `null` sem código, nunca um link "quase certo". Um convite sem
 * código é indistinguível de um convite bom para quem manda e para quem
 * recebe — só o vínculo não acontece, semanas depois, sem nada a que apontar.
 * Quem chama decide o que fazer com o `null`; o que não pode é mandar mesmo
 * assim.
 */
export function linkDeIndicacao(code: string | null | undefined, origem?: string): string | null {
  const limpo = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(limpo)) return null;
  const base = (origem ?? SITE).replace(/\/+$/, "");
  return `${base}/?${PARAM_INDICACAO}=${limpo}`;
}

/**
 * O texto que acompanha o link no compartilhamento.
 *
 * Primeira pessoa e sem promessa clínica: quem recebe é uma amiga, não um
 * anúncio. O que ele promete é o que o app entrega — acompanhar a gestação —, e
 * nunca um desfecho.
 */
export function mensagemDeConvite(link: string): string {
  return `Estou usando o Obstétrica na minha gestação e tem me ajudado muito 💛 Entra pelo meu link: ${link}`;
}
