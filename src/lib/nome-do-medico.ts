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
export function nomeDoMedico(displayName: string | null | undefined): string | null {
  const nome = (displayName ?? "").trim();
  if (!nome) return null;
  const partes = nome.split(/\s+/);
  const temTitulo = /^(dr|dra|drª)\.?$/i.test(partes[0]);
  /* Com título, DUAS partes: o título sozinho não nomeia ninguém — e um
     "Dr." pelado no título de um aviso é pior que nenhum nome. */
  if (temTitulo) return partes.length >= 2 ? partes.slice(0, 2).join(" ") : null;
  return partes[0];
}
