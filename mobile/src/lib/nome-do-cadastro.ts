/**
 * O NOME QUE O CADASTRO SUGERE (o ritual, passo 0) — é o nome que as amigas e
 * a Comunidade veem.
 *
 * Quem entra pela Apple nasce com o nome tirado do e-mail: o gatilho do banco
 * (`handle_new_patient`) grava o começo do e-mail quando a conta chega sem
 * nome, e o nome que a folha da Apple manda só entra depois, nos metadados da
 * conta (`lib/apple.ts`). O ritual sugeria o do perfil primeiro — então ela via
 * como nome o começo do próprio e-mail, ou o código do "Ocultar meu e-mail"
 * da Apple.
 *
 * O começo do e-mail não é nome: aceito como nome, ele ia para a Comunidade e
 * entregava o e-mail dela a quem visse. Sem um nome de verdade, ela digita.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

type Entrada = {
  /** O nome gravado no perfil (pode ser o começo do e-mail). */
  doPerfil?: string | null;
  /** O nome dos metadados da conta (o cadastro por e-mail, ou a folha da Apple). */
  daConta?: string | null;
  email?: string | null;
};

export function ehOComecoDoEmail(
  nome: string | null | undefined,
  email: string | null | undefined,
) {
  const n = (nome ?? "").trim().toLowerCase();
  const comeco = (email ?? "").split("@")[0]?.trim().toLowerCase() ?? "";
  return n !== "" && comeco !== "" && n === comeco;
}

/** Um nome de verdade, que ela possa só confirmar — ou vazio, para ela digitar. */
export function nomeParaSugerir({ doPerfil, daConta, email }: Entrada): string {
  const perfil = (doPerfil ?? "").trim();
  if (perfil && !ehOComecoDoEmail(perfil, email)) return perfil;
  const conta = (daConta ?? "").trim();
  if (conta && !ehOComecoDoEmail(conta, email)) return conta;
  return "";
}

/** O passo do nome só segue vazio se o perfil já tem um nome de verdade. */
export function precisaDeNome({ digitado, doPerfil, email }: Entrada & { digitado: string }) {
  if (digitado.trim()) return false;
  const perfil = (doPerfil ?? "").trim();
  return !perfil || ehOComecoDoEmail(perfil, email);
}
