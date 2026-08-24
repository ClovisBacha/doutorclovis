/**
 * QUEM ME CHAMOU PRA CÁ — a régua da porta de entrada.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────────
 *
 * `?amiga=CODIGO` é capturado em SILÊNCIO no `__root` (`useReferralCapture`) e
 * guardado por 60 dias. `?ref=CODIGO`, o da criadora, idem. E a landing mostra
 * a MESMA tela para todo mundo: quem chegou porque a irmã mandou o link lê
 * exatamente o que lê quem caiu ali pelo Google.
 *
 * É a distância mais cara do funil inteiro. O convite já fez o trabalho difícil
 * — alguém em quem ela confia disse "entra aqui" —, e a primeira tela joga essa
 * confiança fora. Dizer o nome de quem chamou é o degrau que todo produto com
 * indicação tem, e o código já está na URL.
 *
 * ─── O QUE PODE SER DITO, E O QUE NÃO ──────────────────────────────────────
 *
 * ⚠️ **PRIMEIRO NOME E FOTO. Nada além disso.** O link roda no grupo do
 * trabalho, no grupo da família, no story de uma criadora com milhares de
 * seguidoras — e quem abre pode ser qualquer pessoa. Semana gestacional, nome
 * do bebê, DPP e sobrenome ficam de fora por construção: eles nem são lidos.
 *
 * ⚠️ **E o código É uma capacidade, não um segredo.** Sete caracteres num
 * alfabeto de 32 (32⁷ ≈ 34 bilhões): só tem o código quem recebeu o link. É a
 * mesma decisão já tomada em `convidarAmiga` — "o código PODE revelar, e é o
 * que o torna gostoso de usar" —, e é o que separa isto de uma busca por nome,
 * que transformaria a base de pacientes numa lista navegável.
 *
 * ⚠️ **Modo Cuidado devolve NADA**, sem dizer por quê. É a mesma resposta de
 * "código não existe": distinguir os dois contaria a perda dela para quem
 * abriu o link.
 */

/** De onde veio o convite. Muda a FRASE, nunca o dado. */
export type TipoDeConvite = "amiga" | "criadora";

export type QuemConvidou = {
  /** Só o PRIMEIRO nome. Ver o cabeçalho. */
  nome: string;
  /** Data URL ou URL assinada; `null` quando ela não tem foto. */
  avatarUrl: string | null;
  tipo: TipoDeConvite;
};

/**
 * O código, limpo — ou `null`.
 *
 * ⚠️ **A validação acontece ANTES de qualquer consulta**, e é ela que impede o
 * campo de virar entrada para `ilike`: só `[A-Z0-9]`, 3 a 12. Um `%` ou `_`
 * que passasse daqui viraria curinga no PostgREST, e um único caractere
 * devolveria o primeiro nome de uma paciente qualquer da base — que é
 * exatamente o oráculo que este arquivo existe para não ser.
 */
export function codigoLimpo(cru: string | null | undefined): string | null {
  const c = (cru ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{3,12}$/.test(c) ? c : null;
}

/**
 * O código de uma CRIADORA, limpo — ou `null`.
 *
 * ⚠️ **A FORMA É OUTRA, e usar a de cima escondia a faixa dela em silêncio.**
 * `referral_code` de paciente é gerado pelo app e é sempre `[A-Z0-9]` curto;
 * `affiliates.code` é escrito À MÃO pelo dono, e o próprio app já aceita bem
 * mais do que isso: a captura de `?ref=` em `__root.tsx` valida
 * `[a-zA-Z0-9_-]{3,24}`, guarda 90 dias, atribui a assinatura e paga a
 * comissão. Ou seja, um código como `DRA-ANA` funciona de ponta a ponta na
 * economia — e a faixa "Fulana te chamou pra cá" simplesmente não aparecia,
 * sem erro nenhum, justamente no link que a criadora pôs na bio para trinta
 * mil pessoas.
 *
 * ⚠️ **E `_` PODE entrar aqui porque a consulta é `.eq()`, nunca `ilike`.** O
 * curinga só existe em `ilike`; é a mesma distinção que `like-seguro.ts`
 * documenta. `%` continua fora — ele não está no alfabeto que a captura
 * aceita, então um código com `%` nunca chegaria a ser atribuído de qualquer
 * forma, e recusá-lo mantém este arquivo seguro se um dia a consulta mudar.
 *
 * ⚠️ **A forma é a MESMA da captura, e tem de continuar sendo.** Duas réguas
 * para "que código é válido" divergem no primeiro ajuste — e a divergência
 * aparece como criadora sem faixa, que é exatamente este defeito.
 */
export function codigoDeCriadoraLimpo(cru: string | null | undefined): string | null {
  const c = (cru ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{3,24}$/.test(c) ? c : null;
}

/**
 * O PRIMEIRO nome, e só ele.
 *
 * ⚠️ Sobrenome identifica; primeiro nome apresenta. "Marina Costa" num convite
 * que roda no grupo do trabalho é o nome completo de uma gestante circulando
 * para quem ela não escolheu.
 */
export function primeiroNome(nome: string | null | undefined): string | null {
  const inteiro = (nome ?? "").trim().replace(/\s+/g, " ");
  if (!inteiro) return null;
  const primeiro = inteiro.split(" ")[0];
  /* Um "nome" de um caractere é lixo de cadastro, não nome. */
  return primeiro.length >= 2 ? primeiro : null;
}

/**
 * A frase da faixa.
 *
 * ⚠️ **Ela nunca promete nada clínico** — nem "vai te ajudar", nem "cuida de
 * você". Quem convidou é uma pessoa, não um anúncio, e a frase que ela
 * assinaria é a que diz o fato: ela usa o app e te chamou.
 *
 * ⚠️ **E a da criadora é diferente de propósito.** "A Marina te chamou pra cá"
 * dito por uma influenciadora que a paciente não conhece pessoalmente soa
 * falso; "Você chegou pelo convite da Marina" é o mesmo fato sem fingir
 * intimidade.
 */
export function fraseDoConvite(q: QuemConvidou): string {
  return q.tipo === "amiga"
    ? `${q.nome} te chamou pra cá 💛`
    : `Você chegou pelo convite de ${q.nome} 💛`;
}

/** A linha pequena, embaixo da frase. */
export function subtextoDoConvite(q: QuemConvidou): string {
  return q.tipo === "amiga"
    ? "Criando sua conta, vocês já ficam ligadas aqui dentro."
    : "Criar conta é grátis.";
}

/**
 * A inicial do círculo, quando não há foto.
 *
 * ⚠️ Nunca a Bolha: ela é a personagem do app, a mesma para todas — usá-la
 * como avatar é dizer "alguém" onde deveria dizer um nome. Mesma decisão da
 * lista de Amigas.
 */
export function inicialDoConvite(nome: string): string {
  return (nome.trim()[0] ?? "?").toUpperCase();
}
