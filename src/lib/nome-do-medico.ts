/**
 * COMO SE CHAMA O MÉDICO NA TELA DA PACIENTE.
 *
 * ─── POR QUE ISTO É UM ARQUIVO ──────────────────────────────────────────────
 *
 * `doctors.display_name` já vem com o título: o cadastro é livre e quase todo
 * mundo escreve "Dr. Clóvis Bacha". Quem não souber disso e escrever
 * `Dr(a). ${nome}` produz **"Dr(a). Dr. Clóvis Bacha"** — e produziu, no aviso
 * de presente, até esta função existir.
 *
 * O erro simétrico é igualmente fácil: pegar `split(" ")[0]` para encurtar
 * devolve **"Dr."**, que é como o push do presente ia chamar o médico.
 *
 * ─── A REGRA ────────────────────────────────────────────────────────────────
 *
 * Título + primeiro nome, quando há título; só o primeiro nome, quando não há.
 * Nome inteiro não cabe no cabeçalho de um celular e soa a crachá.
 *
 * Vale para médica ("Dra. Ana"), para nome composto e para quem cadastrou sem
 * título nenhum ("Clóvis"). O caso vazio devolve `null` — quem chama decide o
 * texto de fallback, porque "O seu médico" e "Assistente IA" são frases de
 * telas diferentes e nenhuma das duas cabe aqui dentro.
 */
/**
 * O título, e ele casa a PARTE INTEIRA — nunca um prefixo.
 *
 * ⚠️ É essa âncora de ponta a ponta que faz a régua acertar, e a falta dela
 * custou caro: cinco telas carregavam à mão uma expressão com a alternância
 * `(Dr|Dra)` como PREFIXO para tirar o título antes de pegar a inicial — e a
 * alternância de uma expressão regular é resolvida da ESQUERDA para a
 * direita — em "Dra. Marina Costa" ela casa **"Dr"**, sobra `"a. Marina"`, e a
 * inicial do círculo saía **"a" minúscula**. Ou seja: toda obstetra do app
 * aparecia com um "a" no lugar do nome, nas cinco telas, e nenhuma asserção
 * chegava perto — quem viu foi a FOTO da bancada.
 *
 * E ela também não pode comer nome de gente: "Drauzio" não é título, e um
 * prefixo solto o transformaria em "uzio".
 */
const TITULO = /^(dr|dra|drª)\.?$/i;

/**
 * A INICIAL que vai no círculo quando não há foto — a mesma pergunta desta
 * casa ("como se chama o médico na tela da paciente"), e por isso mora aqui.
 *
 * Sempre MAIÚSCULA: duas das cinco cópias esqueciam o `toUpperCase`, então o
 * mesmo círculo saía "m" numa tela e "M" na outra.
 *
 * Devolve `"?"` só para o nome vazio — quem chama não precisa repetir o recuo.
 */
export function inicialDoMedico(displayName: string | null | undefined): string {
  const nome = (displayName ?? "").trim();
  if (!nome) return "?";
  const partes = nome.split(/\s+/).filter(Boolean);
  const semTitulo = TITULO.test(partes[0]) ? partes.slice(1) : partes;
  /* Um "Dra." pelado não nomeia ninguém, mas ainda é melhor que um ponto de
     interrogação no lugar do rosto dele. */
  const primeira = semTitulo[0] ?? partes[0] ?? "";
  return primeira.charAt(0).toUpperCase() || "?";
}

export function nomeDoMedico(displayName: string | null | undefined): string | null {
  const nome = (displayName ?? "").trim();
  if (!nome) return null;
  const partes = nome.split(/\s+/);
  const temTitulo = TITULO.test(partes[0]);
  /* Com título, DUAS partes: o título sozinho não nomeia ninguém — e um
     "Dr." pelado no título de um aviso é pior que nenhum nome. */
  if (temTitulo) return partes.length >= 2 ? partes.slice(0, 2).join(" ") : null;
  return partes[0];
}
