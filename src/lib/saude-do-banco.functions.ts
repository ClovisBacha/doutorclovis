import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAPA_DO_BANCO } from "./mapa-do-banco";

/**
 * ⚠️ QUAIS `APLICAR_*.sql` O BANCO AINDA NÃO RECEBEU.
 *
 * Este é o remédio para o defeito que mais se repete neste repositório. O dono
 * roda os `APLICAR_*.sql` À MÃO, e **o deploy do código chega sempre antes** —
 * então existe uma janela em que a tela nova conversa com um banco velho.
 *
 * O que torna essa janela cara é justamente a proteção: toda leitura tem
 * degrau de recuo, então **nada quebra**. O recurso simplesmente NÃO EXISTE,
 * sem erro, sem log e sem nada na tela. O CLAUDE.md registra recursos que
 * passaram semanas assim — silenciar uma conversa gravando no nada, a foto do
 * direct, o carimbo da semana no story, a caixa ♡ que nunca recebeu uma linha.
 *
 * Até aqui a única forma de descobrir era alguém reparar que um recurso não
 * fazia nada. Esta tela PERGUNTA ao banco.
 *
 * ⚠️ **NENHUMA LINHA DE PACIENTE VIAJA.** Toda sonda é `head: true` com
 * `count: "exact"`: o PostgREST valida a lista de colunas e devolve só o
 * cabeçalho. Um painel de diagnóstico não é motivo para trafegar prontuário.
 *
 * ⚠️ **"NÃO CONSEGUI CONFERIR" NUNCA VIRA "OK".** Um painel de saúde de banco
 * erra numa direção só que importa — para o lado de dizer que está tudo certo.
 * Erro desconhecido vira `erro`, e o arquivo inteiro fica em "não sei".
 */

/** O cliente sem a tipagem gerada — ver a nota na sonda. */
type SupabaseLivre = {
  from: (t: string) => {
    select: (
      c: string,
      o: { head: boolean; count: "exact" },
    ) => {
      limit: (n: number) => PromiseLike<{ error: { code?: string; message: string } | null }>;
    };
  };
};

export type EstadoDoAlvo = "ok" | "tabela_ausente" | "coluna_ausente" | "erro";

export type AlvoConferido = {
  tabela: string;
  colunas: string[];
  estado: EstadoDoAlvo;
  /** A mensagem crua do banco, só quando `estado === "erro"`. */
  detalhe?: string;
};

export type ArquivoConferido = {
  arquivo: string;
  alvos: AlvoConferido[];
  /** `faltando` = há alvo ausente. `incerto` = alguma sonda não respondeu. */
  estado: "aplicado" | "faltando" | "incerto";
};

/** Ausência de TABELA — o Postgres e o cache do PostgREST falam diferente. */
const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST200"]);
/** Ausência de COLUNA num SELECT. (Numa escrita seria `PGRST204`.) */
const COLUNA_AUSENTE = new Set(["42703", "PGRST204"]);

export const saudeDoBanco = createServerFn({ method: "POST" })
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

    /* ⚠️ Sem a chave de serviço a sonda mediria a RLS, e não o SCHEMA: uma
       tabela que existe e barra o anônimo responderia como problema. Dizer
       isso é a única resposta honesta — um painel que "não conseguiu conferir"
       não pode se apresentar como verde. */
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { ok: false as const, motivo: "sem_chave_de_servico" as const };
    }

    const sondar = async (tabela: string, colunas: string[]): Promise<AlvoConferido> => {
      /* ⚠️ O `types.ts` gerado conhece 27 tabelas das 127 que os `APLICAR_`
         criam (o CLAUDE.md registra que ele está desatualizado), e o nome da
         tabela aqui é DINÂMICO por natureza — a sonda existe justamente para
         perguntar por tabelas que o tipo não conhece. */
      const { error } = await (supabaseAdmin as unknown as SupabaseLivre)
        .from(tabela)
        .select(colunas.length ? colunas.join(",") : "*", { head: true, count: "exact" })
        .limit(1);
      if (!error) return { tabela, colunas, estado: "ok" };
      const code = (error as { code?: string }).code ?? "";
      if (TABELA_AUSENTE.has(code)) return { tabela, colunas, estado: "tabela_ausente" };
      if (COLUNA_AUSENTE.has(code)) return { tabela, colunas, estado: "coluna_ausente" };
      return { tabela, colunas, estado: "erro", detalhe: `${code} ${error.message}`.trim() };
    };

    /* Em lotes: são ~190 sondas, e uma de cada vez seria uma tela que demora
       meio minuto para abrir. */
    const achatado = MAPA_DO_BANCO.flatMap((a) =>
      a.alvos.map((x) => ({ arquivo: a.arquivo, ...x })),
    );
    const resultados: (AlvoConferido & { arquivo: string })[] = [];
    const LOTE = 12;
    for (let i = 0; i < achatado.length; i += LOTE) {
      const parte = await Promise.all(
        achatado.slice(i, i + LOTE).map(async (x) => ({
          arquivo: x.arquivo,
          ...(await sondar(x.tabela, x.colunas)),
        })),
      );
      resultados.push(...parte);
    }

    const arquivos: ArquivoConferido[] = MAPA_DO_BANCO.map((a) => {
      const alvos = resultados.filter((r) => r.arquivo === a.arquivo);
      const estado = alvos.some((x) => x.estado === "erro")
        ? ("incerto" as const)
        : alvos.some((x) => x.estado !== "ok")
          ? ("faltando" as const)
          : ("aplicado" as const);
      return { arquivo: a.arquivo, alvos, estado };
    });

    return {
      ok: true as const,
      arquivos,
      conferidoEm: new Date().toISOString(),
    };
  });
