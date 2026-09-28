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
export type Consultorio = {
  doctorId: string | null;
  patientId: string;
  careMode: boolean;
  /**
   * Ela assina o Premium?
   *
   * ⚠️ **`null` QUER DIZER "NÃO SEI", E NÃO "NÃO".** É a coluna mais nova das
   * três, e num banco atrás das migrations ela não existe — ver o degrau
   * abaixo. `decidirAcesso` trata `null` liberando: o pior caso de liberar é
   * uma pergunta que não foi paga; o de bloquear é uma assinante pagando e
   * batendo numa parede cujo defeito é nosso.
   */
  premium: boolean | null;
};

/** As colunas em ordem: a mais nova primeiro, para o degrau tirá-la sozinha. */
const COLUNAS = "doctor_id,care_mode,quiz_premium";
const COLUNAS_SEM_PREMIUM = COLUNAS.replace(",quiz_premium", "");

export async function consultorioDaPaciente(userId: string): Promise<Consultorio> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ler = (colunas: string) =>
      (supabaseAdmin as any)
        .from("patient_profiles")
        /* `care_mode` VEM JUNTO: este é o mesmo perfil que o chat lê, e pedir só
           `doctor_id` foi o que deixou o luto de fora por meses. */
        .select(colunas)
        .eq("id", userId)
        .maybeSingle();

    let { data, error } = await ler(COLUNAS);
    let semPremium = false;

    /* ─── O DEGRAU DA COLUNA NOVA ──────────────────────────────────────────
       `quiz_premium` não existe em todo banco — `APLICAR_ESCRITAS_ABERTAS.sql`
       chega a testar `IF colunas ? 'quiz_premium'` antes de tocá-la. Sem este
       recuo, um `42703` derrubaria o select INTEIRO e a nutricionista passaria
       a assumir Modo Cuidado para todo mundo: o luto entrando pela porta de um
       recurso de cobrança. É o mesmo defeito que `perfisPorId` já pagou na
       rede social, e a mesma correção. */
    if (error && (error as { code?: string }).code === "42703") {
      ({ data, error } = await ler(COLUNAS_SEM_PREMIUM));
      semPremium = true;
    }

    if (error) {
      console.error("[nutricao] perfil ilegível — assumindo Modo Cuidado", error);
      return { doctorId: null, patientId: userId, careMode: true, premium: null };
    }
    return {
      doctorId: (data?.doctor_id as string | null) ?? null,
      patientId: userId,
      careMode: Boolean(data?.care_mode),
      premium: semPremium ? null : Boolean(data?.quiz_premium),
    };
  } catch (e) {
    /* Falha de banco não pode derrubar o chat dela: segue sem o cérebro — e
       pelo mesmo motivo acima, sem falar da gestação. */
    console.error("[nutricao] perfil inacessível — assumindo Modo Cuidado", e);
    return { doctorId: null, patientId: userId, careMode: true, premium: null };
  }
}
