import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * QUANTAS DENÚNCIAS ESPERAM — o número que impede a fila de crescer calada.
 *
 * ⚠️ **A fila vivia dentro da aba de entrada e não tinha contador em lugar
 * nenhum.** Quem estivesse noutra aba não tinha como saber que ela cresceu — e
 * uma denúncia de risco clínico pode esperar semanas sem nada apitar. Agora o
 * número sobe para a fita de abas, que é onde o painel já chama o médico para o
 * trabalho que ainda precisa dele.
 *
 * ⚠️ **CONTA AS DUAS FILAS, com os MESMOS filtros que as telas usam.** Um
 * número que diga 3 sobre uma lista de 2 faz o médico procurar uma denúncia
 * fantasma, e na terceira vez ele para de acreditar no número. A da rede é
 * `resolvido_em IS NULL`; a da caixinha é `denunciado_em NOT NULL` e
 * `resolvido_em IS NULL` — exatamente o que `denunciasDaRede` e
 * `denunciasAbertas` filtram.
 *
 * ⚠️ **`head: true`: conta sem trazer uma linha.** O corpo de uma denúncia tem
 * o trecho congelado do que foi dito, e ele não precisa viajar para virar um
 * número numa fita de abas.
 *
 * ⚠️ **Falha ao contar devolve `null`, nunca zero.** Zero AFIRMA que a fila
 * está limpa — é a frase mais perigosa que um painel de moderação pode dizer
 * errado, e faria o médico deixar de abrir a tela.
 */
export const contarDenunciasAbertas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u.user?.email?.trim().toLowerCase();
    const permitidos = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!email || !permitidos.includes(email)) {
      return { ok: false as const, motivo: "sem_acesso" as const };
    }

    const sb = supabaseAdmin as any;
    const [rede, caixinha] = await Promise.all([
      sb
        .from("rede_denuncias")
        .select("id", { count: "exact", head: true })
        .is("resolvido_em", null),
      sb
        .from("rede_perguntas")
        .select("id", { count: "exact", head: true })
        .not("denunciado_em", "is", null)
        .is("resolvido_em", null),
    ]);

    /* ⚠️ Tabela ausente NÃO é falha de contagem — num banco atrás das
       migrations simplesmente não há denúncia daquela espécie ainda. Falha de
       verdade (rede fora, permissão) vira `null`, e a fita não desenha número
       nenhum em vez de afirmar "está limpo". */
    const conta = (r: { count: number | null; error: unknown }) => {
      const codigo = (r.error as { code?: string } | null)?.code;
      if (r.error && codigo !== "42P01") return null;
      return r.count ?? 0;
    };
    const a = conta(rede);
    const b = conta(caixinha);
    if (a === null || b === null) return { ok: true as const, total: null };
    return { ok: true as const, total: a + b };
  });
