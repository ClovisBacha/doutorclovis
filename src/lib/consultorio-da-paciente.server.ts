/**
 * O CONSULTÓRIO DESTA PACIENTE — a leitura que abre toda resposta da nutrição.
 *
 * ⚠️ ELA MORA AQUI, E NÃO DENTRO DE UM ENDPOINT, PORQUE TEM DOIS LEITORES:
 * `/api/nutrition` (a conversa) e `/api/prato` (a foto). Ela nasceu privada no
 * primeiro, e no dia em que o segundo precisou dela a tentação era copiar as
 * quinze linhas — uma segunda cópia divergiria no primeiro conserto, e a
 * divergência apareceria como a resposta da FOTO falando da gestação de quem
 * acabou de perdê-la. É a mesma lição de `epds.ts`, que precisou virar régua
 * única porque a mesma pergunta vivia em duas telas.
 */

/**
 * ⚠️ AS DUAS PONTAS FALHAVAM ABERTAS, e as duas com a mesma aritmética: o
 * `error` era descartado, e o PostgREST devolve `data: null` numa falha sem
 * LANÇAR — `Boolean(null)` é `false`, ou seja **"não está de luto"**.
 *
 * O custo é o pior desfecho que este produto tem: o system prompt manda tratar
 * a paciente como GESTANTE e adaptar tudo ao trimestre. Uma oscilação de rede
 * fazia a nutrição conversar sobre a gestação com quem acabou de perdê-la.
 *
 * ⚠️ E a assimetria decide o lado seguro, que NÃO é o mesmo dos dois campos.
 * Para `doctorId`, "não sei" → segue sem o cérebro, e a resposta sai
 * consolidada: degradação inofensiva. Para `careMode`, "não sei" → trata como
 * LUTO: uma gestante recebe orientação genérica em vez de orientação por
 * trimestre (chato, reversível na tentativa seguinte), contra o app falar do
 * bebê de quem o perdeu (irreversível).
 */
export async function consultorioDaPaciente(
  userId: string,
): Promise<{ doctorId: string | null; patientId: string; careMode: boolean }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      /* `care_mode` VEM JUNTO: este é o mesmo perfil que o chat lê, e pedir só
         `doctor_id` foi o que deixou o luto de fora por meses. */
      .select("doctor_id,care_mode")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[nutricao] perfil ilegível — assumindo Modo Cuidado", error);
      return { doctorId: null, patientId: userId, careMode: true };
    }
    return {
      doctorId: (data?.doctor_id as string | null) ?? null,
      patientId: userId,
      careMode: Boolean(data?.care_mode),
    };
  } catch (e) {
    /* Falha de banco não pode derrubar o chat dela: segue sem o cérebro — e
       pelo mesmo motivo acima, sem falar da gestação. */
    console.error("[nutricao] perfil inacessível — assumindo Modo Cuidado", e);
    return { doctorId: null, patientId: userId, careMode: true };
  }
}
