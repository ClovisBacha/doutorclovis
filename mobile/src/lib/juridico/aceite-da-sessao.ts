/**
 * O aceite feito NESTA abertura do app, em memória: os metadados da conta
 * chegam à sessão um instante depois de gravados, e sem isto a porta do app
 * mandaria de volta para a tela de aceite quem acabou de aceitar.
 */
let aceitou: string | null = null;

export function lembrarAceite(versao: string) {
  aceitou = versao;
}

export function aceitouNestaSessao(versao: string): boolean {
  return aceitou === versao;
}
