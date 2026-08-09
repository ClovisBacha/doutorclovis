/**
 * O CARIMBO NÃO É O VÍNCULO.
 *
 * Três arquivos do painel (`admin`, `teleconsulta`, `secondbrain`) têm cada um
 * a sua cópia de `requireScope`/`scopedBy`, e todas filtram pelo `doctor_id`
 * gravado NA LINHA no instante em que ela nasceu. `encerrarAcompanhamento` zera
 * `patient_profiles.doctor_id` e não toca em carimbo nenhum — é uma tabela só.
 *
 * Resultado: a paciente troca de médico, e as listas do painel do médico
 * ANTERIOR continuam carregando as linhas dela sozinhas, na abertura da tela.
 * Pré-consulta com peso e pressão, perguntas para o médico, notas de
 * teleconsulta, e a transcrição inteira das conversas dela com a IA.
 *
 * É a mesma falha que `panic_events` tinha e que a migration 20260731050000
 * fechou no banco. Aqui não dá para fechar por RLS: estas leituras passam por
 * `supabaseAdmin`, que ignora RLS por definição. O recorte tem que ser em
 * código, e é este — um lugar só, em vez das três cópias que já existem.
 *
 * `null` = equipe (ADMIN_EMAILS), que enxerga a instalação inteira de propósito.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISTO **NÃO** COBRE, e é decisão, não esquecimento
 *
 *  · `appointment_requests` não tem coluna de conta — identifica por
 *    `patient_email` digitado num formulário público. É a fila de ENTRADA: quem
 *    pede consulta ainda não é paciente de ninguém. Recortar por vínculo
 *    esvaziaria a caixa de pedidos.
 *
 *  · `private_consultations` é registro financeiro de consulta que ele prestou
 *    e recebeu. Sumir do painel é sumir da contabilidade dele.
 *
 * E o limite do que isto resolve: a resolução 1.821/2007 do CFM obriga o médico
 * a GUARDAR o prontuário por 20 anos. Isto não apaga nada — só tira a
 * ex-paciente das listas OPERACIONAIS, que é o que estas telas são. Um arquivo,
 * com regra própria e trilha própria, é outra tela, que ainda não existe.
 */

/**
 * Ids das pacientes vinculadas AGORA — E SE A LEITURA DEU CERTO.
 *
 * ─── POR QUE A FALHA PRECISA SUBIR ──────────────────────────────────────────
 *
 * `supabase-js` não lança: devolve `{ data, error }`. O `error` era descartado,
 * e aí um conjunto vazio passou a significar duas coisas opostas: "este médico
 * não tem paciente" e "não consegui ler quais são".
 *
 * Para AUTORIZAR, as duas dão no mesmo e está certo — quem não sabe de quem é a
 * paciente não deixa ninguém passar. Falha fechando.
 *
 * Para LISTAR, não. Uma fila que se esvazia por um timeout e diz "Tudo
 * respondido 🎉" é a mesma mentira que este projeto já corrigiu em meia dúzia
 * de telas. Pior: `listUnansweredQuestions` tem um comentário longo explicando
 * exatamente isso na SUA leitura — e ganhou uma segunda leitura, esta, sem a
 * mesma proteção.
 */
export async function vinculadasAgoraComEstado(
  sb: { from: (t: string) => any },
  scope: { isTeam: boolean; doctorId: string | null },
): Promise<{ ids: Set<string> | null; falhou: boolean }> {
  if (scope.isTeam) return { ids: null, falhou: false };
  /* Sem médico resolvido e sem ser equipe: conjunto VAZIO, não `null`. Os dois
     valores são opostos aqui — `null` significa "não recorte nada", e devolvê-lo
     por engano num caso de borda abriria exatamente a porta que esta função
     existe para fechar. Falha fechando. */
  if (!scope.doctorId) return { ids: new Set<string>(), falhou: false };
  const { data, error } = await sb
    .from("patient_profiles")
    .select("id")
    .eq("doctor_id", scope.doctorId);
  return {
    ids: new Set(((data ?? []) as { id: string }[]).map((p) => p.id)),
    falhou: !!error,
  };
}

/**
 * O recorte sem o estado — para quem só precisa do conjunto.
 *
 * Continua devolvendo conjunto vazio quando a leitura falha, que é o
 * comportamento seguro para autorização. Quem PRECISA distinguir vazio de falha
 * — as listas — usa `vinculadasAgoraComEstado`.
 */
export async function vinculadasAgora(
  sb: { from: (t: string) => any },
  scope: { isTeam: boolean; doctorId: string | null },
): Promise<Set<string> | null> {
  return (await vinculadasAgoraComEstado(sb, scope)).ids;
}

/**
 * Mantém só as linhas de paciente vinculada agora.
 *
 * `atuais === null` devolve a lista intacta — é o caminho da equipe, e
 * confundir "sem recorte" com "conjunto vazio" apagaria o painel inteiro dela.
 */
export function soVinculadas<T>(
  linhas: T[],
  atuais: Set<string> | null,
  chave: (linha: T) => string | null | undefined,
): T[] {
  if (!atuais) return linhas;
  return linhas.filter((linha) => {
    const id = chave(linha);
    return !!id && atuais.has(id);
  });
}
