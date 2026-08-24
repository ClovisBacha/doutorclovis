/**
 * A AMIGA QUE ENTROU PELO CONVITE PASSA A SER SEGUIDA — a régua.
 *
 * ─── O BURACO QUE ISTO FECHA ────────────────────────────────────────────────
 *
 * `attributeReferral` já fazia o mais difícil: fixava `referred_by`, pagava as
 * 100 🌱 e mandava o push que traz a indicadora até a aba Amigas. E paravam aí.
 *
 * Na Comunidade — a aba que é um feed — as duas continuavam invisíveis uma para
 * a outra: a indicadora tinha de ir à busca e procurar pelo nome da amiga que
 * ela mesma acabou de trazer. O convite entregava a AMIZADE e não entregava a
 * única coisa que faz um feed existir, que é ter alguém para ver.
 *
 * ─── POR QUE PODE SER AUTOMÁTICO ───────────────────────────────────────────
 *
 * ⚠️ **Seguir é ESTRITAMENTE MENOS que o vínculo que já foi criado.** O
 * `referred_by` que acabou de ser fixado é o grafo de AMIZADE deste app: ele já
 * dá acesso ao Cantinho uma da outra, à dupla de sequência, ao presente entre
 * amigas, e destranca a camada `amigas` — a mais restrita do feed, onde mora o
 * desabafo de terça. Pedir consentimento para o degrau menor depois de ter
 * concedido o maior seria teatro.
 *
 * E o consentimento existe dos dois lados, explícito: uma mandou o convite, a
 * outra abriu o link e criou a conta.
 *
 * ⚠️ **`ativo` nos dois sentidos, e não `pendente`.** Perfil fechado não é
 * obstáculo aqui: `alcancaOPerfil` já deixa passar quem é amiga
 * (`sigoAtivo || somosAmigas`). Deixar `pendente` criaria um pedido que a
 * indicadora teria de aceitar — da amiga que ela própria convidou.
 *
 * ─── E OS DOIS SILÊNCIOS ───────────────────────────────────────────────────
 *
 * ⚠️ **E O BLOQUEIO CANCELA O SEGUIR, nos dois sentidos.** `bloquear` desfaz o
 * seguir de propósito, e numa ordem escolhida a dedo para que meio bloqueio
 * nunca exista. Ligar as duas de volta aqui ressuscitaria exatamente o vínculo
 * que ela desfez — e sem nenhum aviso, porque o bloqueio é calado. O caso é
 * estreito (a recém-chegada acabou de criar a conta) e não é impossível: uma
 * conta antiga sem `referred_by` fixado passa por este caminho, e o bloqueio
 * dela pode ser de meses atrás. Guardar custa uma linha; não guardar custa a
 * proteção inteira.
 *
 * ⚠️ **Modo Cuidado de QUALQUER UMA das duas cancela o seguir**, e só o seguir:
 * a atribuição, a moeda e a amizade continuam (são o recibo, e o recibo fica).
 * Quem está em luto some da rede sem anunciar; criar um vínculo social para
 * dentro do luto é o oposto disso.
 */

export type FatosDoSeguirAposConvite = {
  indicadoraEmCuidado: boolean;
  novaEmCuidado: boolean;
  /** Defesa contra o par degenerado — o banco tem CHECK, mas erro de banco é erro na tela. */
  mesmaPessoa: boolean;
  /**
   * Existe bloqueio entre as duas, em QUALQUER sentido?
   *
   * ⚠️ **Ausente vale BLOQUEADA quando a leitura falhou** — quem chama decide,
   * e o lado seguro aqui é não ligar: um seguir a menos é um incômodo, um
   * seguir que ressuscita um bloqueio é a proteção dela desfeita em silêncio.
   */
  bloqueada: boolean;
};

export function deveLigarNaRede(f: FatosDoSeguirAposConvite): boolean {
  if (f.mesmaPessoa) return false;
  if (f.bloqueada) return false;
  if (f.indicadoraEmCuidado) return false;
  if (f.novaEmCuidado) return false;
  return true;
}

/**
 * As duas linhas, na ordem em que devem ser gravadas.
 *
 * ⚠️ **A DA INDICADORA VEM PRIMEIRO**, e a ordem é a régua: se a segunda
 * gravação falhar, o estado que sobra é "a indicadora segue a recém-chegada" —
 * a que ela pediu ao mandar o convite. Invertido, o estado parcial seria a
 * recém-chegada seguindo alguém sem que a outra a visse, que é o lado errado
 * de um vínculo que nasceu de um convite. Mesma lição da ordem de `bloquear`.
 */
export function paresDoSeguir(
  indicadoraId: string,
  novaId: string,
): { seguidor_id: string; seguido_id: string; estado: "ativo" }[] {
  return [
    { seguidor_id: indicadoraId, seguido_id: novaId, estado: "ativo" },
    { seguidor_id: novaId, seguido_id: indicadoraId, estado: "ativo" },
  ];
}
