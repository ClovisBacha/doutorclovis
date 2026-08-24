/**
 * A CONTA OFICIAL DO CONSULTÓRIO — a régua.
 *
 * Pedido do dono (ideia 6). O feed de TODA conta nova nasce vazio: ela abre a
 * Comunidade e vê o convite, a fileira de sugeridas e mais nada. Uma conta
 * oficial que publica resolve o dia um — e dá ao dono um canal próprio para os
 * 13,7 mil seguidores do Instagram dele.
 *
 * ─── ⚠️ ELA É UMA CONTA COMO QUALQUER OUTRA (decisão do dono, ago/2026) ─────
 *
 * A pergunta que ficou pendente por uma leva — "o médico pode ver as
 * publicações sociais da paciente?" — foi respondida, e a resposta desfez uma
 * decisão MINHA que estava escrita aqui ("ela publica e é seguida; ela NÃO
 * lê"). Palavras dele:
 *
 *   "o que o médico vê não tem limitação diferente de qualquer pessoa que
 *    acessa a plataforma, mesmo modelo do Instagram — existem perfil aberto e
 *    privado, e isso vai da paciente."
 *
 * Então esta conta **publica E lê**, e não ganha nada por ser do consultório:
 *
 *  · perfil PRIVADO continua privado para ela — ela precisa pedir e ser
 *    aceita, como qualquer conta;
 *  · a camada `amigas` continua fora (ela não é amiga de ninguém);
 *  · Modo Cuidado esconde a paciente dela como esconde de todo mundo;
 *  · e ela NÃO tem porta a partir do painel do consultório: o médico entra
 *    nela pelo `/auth`, com o e-mail dela, como numa conta qualquer. Uma porta
 *    a partir da sessão do painel seria exatamente o privilégio que a decisão
 *    do dono recusa.
 *
 * ⚠️ **O que muda é o ALCANCE dela, nunca a régua.** `podeVerPost`,
 * `alcancaOPerfil` e `conjuntoDeBloqueio` continuam sendo os mesmos para ela e
 * para uma paciente — não existe, e não pode passar a existir, um `if` que
 * pergunte `conta_oficial` dentro de uma régua de visibilidade.
 *
 * ─── ⚠️ E ELA NÃO É SEGUIDA AUTOMATICAMENTE ────────────────────────────────
 *
 * Seria fácil escrever a linha em `rede_seguidores` no primeiro login, e seria
 * errado: seguir é um gesto, e um app que segue coisas pela paciente ensina que
 * a lista dela não é dela. Ela aparece em PRIMEIRO na fileira de sugeridas —
 * um toque —, e os posts dela já aparecem na zona de sugeridos mesmo sem
 * seguir, porque são públicos.
 *
 * O único caso em que este app cria vínculo sem perguntar é o do convite
 * (`seguir-apos-convite.ts`), e lá existe consentimento explícito dos DOIS
 * lados: uma mandou o link, a outra o abriu.
 *
 * ─── ⚠️ E ELA NÃO É PACIENTE ───────────────────────────────────────────────
 *
 * A linha vive em `patient_profiles` porque é isso que `perfisPorId`,
 * `podeVerPost` e `rede_seguidores` já sabem ler — inventar uma tabela nova
 * faria a conta oficial sumir de metade da rede, que foi exatamente o defeito
 * da reação do médico. Mas ela precisa ficar FORA de tudo que trata perfil como
 * paciente: contagem de funil, lista do médico, cobrança, lembretes clínicos.
 * `ehContaOficial` é o portão, e ele é uma coluna própria — nunca um nome
 * reconhecido por texto.
 */

/** A coluna que marca a conta. `false` em toda paciente. */
export const COLUNA_OFICIAL = "conta_oficial";

export type PerfilComOficial = { conta_oficial?: boolean | null } | null | undefined;

/**
 * É a conta oficial?
 *
 * ⚠️ **Ausente vale FALSE.** Um banco sem a coluna (o deploy chega antes do
 * SQL) se comporta como "não existe conta oficial" — que é a verdade, e é o
 * lado seguro: o pior caso é a fileira de sugeridas ficar como está hoje.
 */
export function ehContaOficial(p: PerfilComOficial): boolean {
  return p?.conta_oficial === true;
}

/**
 * O selo que a tela desenha ao lado do nome.
 *
 * ⚠️ **É o selo do CONSULTÓRIO, e não o do obstetra dela.** O selo do médico
 * (em `quemReagiuAoPost`) é resolvido pelo vínculo ATUAL e só aparece na lista
 * que a autora abre — dizer a terceiros quem é a médica dela é o que ele evita.
 * Este outro é público por natureza: identifica uma conta institucional, e não
 * uma relação clínica de ninguém.
 */
export const SELO_OFICIAL = "Conta oficial";

/**
 * Ela vem PRIMEIRO na fileira de sugeridas.
 *
 * ⚠️ **Fixada no topo, e não ordenada junto.** `ordenarPessoas` classifica por
 * elos em comum e recência — e a conta oficial não tem elos com ninguém, então
 * ela cairia no fim exatamente na conta NOVA, que é a única para quem ela
 * importa. Fixar é a única forma de o dia um funcionar.
 *
 * ⚠️ **E ela nunca aparece duas vezes**: se já estiver na lista ordenada, a
 * cópia de baixo sai.
 */
export function comOficialNoTopo<T extends { id: string }>(
  pessoas: T[],
  oficialId: string | null,
): T[] {
  if (!oficialId) return pessoas;
  const oficial = pessoas.find((p) => p.id === oficialId);
  if (!oficial) return pessoas;
  return [oficial, ...pessoas.filter((p) => p.id !== oficialId)];
}

/**
 * A fileira de sugeridas com a conta oficial na frente, mesmo que o ranking a
 * tenha cortado.
 *
 * ⚠️ **O CORTE É QUEM A APAGAVA, e `comOficialNoTopo` sozinha não via.** A
 * fileira é o recorte de `PESSOAS_SUGERIDAS` de um ranking ordenado por elos em
 * comum — e a conta oficial não tem elo com ninguém, então ela cai no FIM e é
 * exatamente a primeira a ser cortada. Procurá-la depois do corte era procurar
 * no único lugar de onde ela sempre tinha acabado de sair: a função rodava,
 * devolvia a lista intacta e nada na tela dizia que a conta oficial não estava
 * lá. Quem recebe `oficial` aqui é a candidata achada ANTES do corte.
 *
 * ⚠️ E ela nunca aparece duas vezes: se o ranking já a tinha incluído, a cópia
 * de baixo sai (é `comOficialNoTopo` quem faz isso).
 */
export function fileiraComOficial<T extends { id: string }>(
  pessoas: T[],
  oficial: T | null | undefined,
): T[] {
  if (!oficial) return pessoas;
  const juntas = pessoas.some((p) => p.id === oficial.id) ? pessoas : [oficial, ...pessoas];
  return comOficialNoTopo(juntas, oficial.id);
}
