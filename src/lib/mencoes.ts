/**
 * O `@`, A TROCA DE `@` E A `#` — régua pura.
 *
 * Pedido do dono: "faça exatamente como o Instagram faz hoje". As duas regras
 * abaixo foram VERIFICADAS na documentação e na cobertura de 2026, não
 * lembradas:
 *
 *  · troca de `@`: **duas vezes a cada 14 dias**, e o antigo fica **reservado
 *    14 dias** antes de voltar ao pool;
 *  · mencionar: uma **configuração de três opções** — Todos (padrão), Só quem
 *    eu sigo, Ninguém.
 *
 * ⚠️ **E UMA DIFERENÇA FICA REGISTRADA, porque ela não é do Instagram.** Aqui
 * os perfis nascem PRIVADOS, e a base é de gestantes de alto risco. "Todos"
 * como padrão significa que qualquer conta pode pôr o nome de uma paciente num
 * post público — no Instagram isso é aceitável, aqui é a porta que eu teria
 * fechado. A decisão é do dono, foi tomada com o risco à vista, e a chave
 * existe para ela fechar sozinha. Se um dia uma paciente reclamar, o padrão é a
 * primeira coisa a mudar.
 */

/** Como o Instagram: 1 a 30, letras, números, ponto e sublinhado. */
export const HANDLE_MAX = 30;

/**
 * ⚠️ **RESERVADOS, e a lista é curta de propósito.** Ela existe para impedir
 * que alguém pegue `@obstetrica` ou `@suporte` e passe por conta oficial —
 * uma conta que parece do consultório dando conselho é o pior desfecho social
 * possível neste app.
 */
export const HANDLES_RESERVADOS = new Set([
  "obstetrica",
  "obstétrica",
  "suporte",
  "admin",
  "ajuda",
  "oficial",
  "clovis",
  "drclovis",
  "consultorio",
  "consultório",
  "equipe",
]);

export type RecusaDeHandle = "curto" | "longo" | "caracteres" | "so_pontos" | "reservado";

export function recusaDoHandle(bruto: string): RecusaDeHandle | null {
  const h = (bruto ?? "").trim().toLowerCase();
  if (h.length < 1) return "curto";
  if (h.length > HANDLE_MAX) return "longo";
  if (!/^[a-z0-9._]+$/.test(h)) return "caracteres";
  /* ⚠️ Só pontos e sublinhados é um nome invisível na tela — e o clássico
     truque de personificação: `@.....` ao lado de `@obstetrica`. */
  if (!/[a-z0-9]/.test(h)) return "so_pontos";
  if (HANDLES_RESERVADOS.has(h)) return "reservado";
  return null;
}

/** O `@` normalizado para gravar e comparar. */
export function normalizarHandle(bruto: string): string {
  return (bruto ?? "").trim().toLowerCase();
}

/* ── A TROCA ───────────────────────────────────────────────────────────── */

/** Como o Instagram: duas trocas a cada 14 dias. */
export const TROCAS_POR_JANELA = 2;
export const JANELA_DE_TROCA_DIAS = 14;
/** E o antigo fica reservado o mesmo tempo. */
export const RESERVA_DO_ANTIGO_DIAS = 14;

/**
 * Ela pode trocar agora?
 *
 * ⚠️ **A JANELA É CORRIDA, e não "por quinzena de calendário".** Com quinzena,
 * quem trocasse duas vezes no dia 14 trocaria mais duas no dia 15 — quatro em
 * dois dias, que é exatamente o que o limite existe para impedir.
 */
export function podeTrocarHandle(trocasRecentes: string[], agora: Date): boolean {
  const corte = agora.getTime() - JANELA_DE_TROCA_DIAS * 86400_000;
  const dentro = trocasRecentes.filter((t) => new Date(t).getTime() > corte);
  return dentro.length < TROCAS_POR_JANELA;
}

/**
 * Um `@` liberado por outra pessoa já pode ser pego?
 *
 * ⚠️ **A RESERVA É O QUE IMPEDE A MENÇÃO ANTIGA DE APONTAR PARA OUTRA
 * PESSOA.** Sem ela, alguém troca de `@`, um estranho pega o antigo, e um post
 * de três meses atrás passa a mencionar quem nunca esteve lá.
 */
export function reservaVencida(liberadoEm: string, agora: Date): boolean {
  return agora.getTime() - new Date(liberadoEm).getTime() > RESERVA_DO_ANTIGO_DIAS * 86400_000;
}

/* ── QUEM PODE MENCIONAR ───────────────────────────────────────────────── */

/** As três opções do Instagram. */
export type QuemMenciona = "todos" | "sigo" | "ninguem";
export const QUEM_MENCIONA_PADRAO: QuemMenciona = "todos";

/**
 * ⚠️ **"SIGO" É QUEM **ELA** SEGUE, e não quem a segue.** É o que confunde no
 * Instagram e é fácil de inverter aqui: a opção protege ela deixando passar
 * apenas as pessoas que ELA escolheu acompanhar. Invertido, qualquer seguidora
 * — inclusive uma recém-chegada — poderia mencioná-la, e a chave não protegeria
 * de nada.
 */
export function podeMencionar(v: {
  config: QuemMenciona;
  /** A MENCIONADA segue quem está mencionando? */
  mencionadaSegueQuemMenciona: boolean;
}): boolean {
  if (v.config === "ninguem") return false;
  if (v.config === "sigo") return v.mencionadaSegueQuemMenciona;
  return true;
}

/* ── ACHAR NO TEXTO ────────────────────────────────────────────────────── */

/**
 * ⚠️ **NÃO CASA DENTRO DE E-MAIL.** `fulana@gmail.com` tem um `@` no meio de
 * palavra; sem o limite à esquerda, todo e-mail escrito numa legenda viraria
 * uma menção a `@gmail`. O mesmo vale para `#` dentro de URL.
 */
const RE_MENCAO = /(^|[^A-Za-z0-9._])@([a-z0-9._]{1,30})/gi;
const RE_TAG = /(^|[^A-Za-z0-9_#/])#([\p{L}\p{N}_]{1,60})/giu;

export function acharMencoes(texto: string | null | undefined): string[] {
  const t = texto ?? "";
  const achados = new Set<string>();
  for (const m of t.matchAll(RE_MENCAO)) {
    const h = normalizarHandle(m[2]);
    /* ⚠️ Passa pela MESMA régua do cadastro: `@.....` não é menção de
       ninguém, e deixá-lo virar consulta ao banco é uma ida à toa por
       legenda. */
    if (!recusaDoHandle(h)) achados.add(h);
  }
  return [...achados];
}

/**
 * ⚠️ **A TAG ACEITA ACENTO, e isso não é detalhe.** `#gestação`, `#gêmeos` e
 * `#mãedemenina` são como as pacientes escrevem — uma regex `[a-z0-9]` cortaria
 * a palavra no acento e criaria `#gesta`, que é uma tag que ninguém quis.
 */
export function acharTags(texto: string | null | undefined): string[] {
  const t = texto ?? "";
  const achadas = new Set<string>();
  for (const m of t.matchAll(RE_TAG)) {
    const tag = m[2].toLowerCase();
    /* Só número não é assunto — `#2026` viraria a tag mais usada do app. */
    if (/\p{L}/u.test(tag)) achadas.add(tag);
  }
  return [...achadas];
}

/** Teto por publicação, contra a legenda que é só um monte de tag. */
export const TAGS_POR_POST = 15;
export const MENCOES_POR_POST = 10;
