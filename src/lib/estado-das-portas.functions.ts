import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { EstadoDaPorta, EstadoDasPortas } from "./estado-das-portas";

/**
 * O RESUMO DA ABA COMUNIDADE — uma ida ao servidor, seis portas.
 *
 * A régua (o que desenha, o que cala, como ordena) mora em
 * `estado-das-portas.ts`, pura e testada. Aqui é só o trabalho sujo.
 *
 * ⚠️ **NÃO CONFUNDIR com `resumo-da-comunidade.ts`**, que é o push semanal.
 *
 * ⚠️ **AS SEIS LEITURAS SÃO PARALELAS, e isso é o ponto.** Em série, abrir a
 * aba custaria seis latências antes de o primeiro cartão mudar — e a aba
 * inteira existe para ser aberta de relance. É a mesma lição de
 * `contextoDe`/`verPerfil`, onde o que custa não é o número de consultas, é o
 * número de VEZES que se espera.
 *
 * ⚠️ **CADA LEITURA FALHA SOZINHA, e falha em `null`.** Uma porta que não pôde
 * ser lida não derruba as outras cinco e **não vira zero**: `null` não desenha
 * emblema nenhum, e a porta volta a ser só a porta. Zero afirmaria que não há
 * nada atrás dela, e ela deixaria de abrir onde havia.
 *
 * ⚠️ **MODO CUIDADO SAI ANTES DE TUDO.** As portas já somem por
 * `portasDaComunidade`, mas contar aqui e devolver números que a tela vai jogar
 * fora é gastar seis consultas para nada — e, pior, é o tipo de caminho por
 * onde um número de bebê acaba vazando para uma tela em luto quando alguém
 * mexer na régua da tela.
 */
export const estadoDasPortas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }): Promise<{ ok: boolean; resumo: EstadoDasPortas }> => {
    const vazio = { ok: false as const, resumo: {} as EstadoDasPortas };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return vazio;
      const eu = u.user.id;
      const sb = supabaseAdmin as any;

      /* Modo Cuidado antes das contagens — ver o cabeçalho. */
      const { data: perfil } = await sb
        .from("patient_profiles")
        .select("care_mode")
        .eq("id", eu)
        .maybeSingle();
      if (perfil?.care_mode) return { ok: true as const, resumo: {} };

      /** Uma contagem que nunca lança e nunca mente: erro vira `null`. */
      const contar = async (fn: () => Promise<{ count: number | null; error: unknown }>) => {
        try {
          const { count, error } = await fn();
          if (error) return null;
          return typeof count === "number" ? count : null;
        } catch {
          return null;
        }
      };

      const [reservas, amigas, album, nome, acompanhante] = await Promise.all([
        /* Presentes que alguém reservou na lista dela. É o fato mais bonito da
           aba: outra pessoa fez algo por ela. */
        (async () => {
          try {
            const { data: lista, error } = await sb
              .from("presente_listas")
              .select("id")
              .eq("user_id", eu)
              .maybeSingle();
            if (error || !lista) return null;
            return await contar(() =>
              sb
                .from("presente_reservas")
                .select("id", { count: "exact", head: true })
                .eq("lista_id", lista.id)
                .is("cancelada_em", null),
            );
          } catch {
            return null;
          }
        })(),
        /* ⚠️ **`idsDasAmigas`, e NUNCA uma consulta minha a `amizades`.**
           A primeira versão contava `amizades` direto — e estava errada de duas
           formas. A grave: o grafo de amigas deste app tem DOIS lados (a
           indicação, via `referred_by`, e a amizade aceita), menos as
           encerradas. Contar só uma tabela daria um número MENOR do que a
           lista que ela encontra ao abrir a porta, e um emblema que não bate
           com a tela é pior que emblema nenhum.

           A besta, achada ao conferir o schema: eu tinha inventado os nomes das
           colunas (`de_id`/`para_id`/`estado`). Elas se chamam `menor`/`maior`
           (par ordenado) e `aceita`. A consulta teria falhado com `42703`, o
           contador viraria `null`, e o recurso ficaria invisível **sem nunca dar
           erro** — exatamente a falha silenciosa que o resto desta noite passou
           consertando.

           `idsDasAmigas` já resolve os dois grafos e falha FECHADA. Reusá-la
           também garante que o número aqui e a lista lá são o mesmo conjunto. */
        (async () => {
          try {
            const { idsDasAmigas } = await import("./amigas.functions");
            const r = await idsDasAmigas(sb, eu);
            /* Degradada = não consegui ler direito. `null`, nunca zero. */
            return r.degradada ? null : r.todas.length;
          } catch {
            return null;
          }
        })(),
        contar(() =>
          sb
            .from("family_album_posts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", eu),
        ),
        contar(() =>
          sb
            .from("baby_name_entries")
            .select("id", { count: "exact", head: true })
            .eq("user_id", eu),
        ),
        /* ⚠️ `expires_at`, e não `revoked_at` — esta coluna eu também tinha
           inventado. Conferido no schema: a tabela tem `token`,
           `companion_name`, `created_at` e `expires_at`, e mais nada.
           "Ativo" = sem prazo, ou com prazo no futuro. */
        contar(() =>
          sb
            .from("companion_invites")
            .select("id", { count: "exact", head: true })
            .eq("user_id", eu)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
        ),
      ]);

      const porta = (n: number | null, frase?: (n: number) => string): EstadoDaPorta => ({
        quantas: n,
        frase: n !== null && n > 0 && frase ? frase(n) : null,
      });

      return {
        ok: true as const,
        resumo: {
          cha: porta(reservas, (n) =>
            n === 1 ? "1 presente reservado" : `${n} presentes reservados`,
          ),
          amigas: porta(amigas, (n) => (n === 1 ? "1 amiga com você" : `${n} amigas com você`)),
          album: porta(album, (n) => (n === 1 ? "1 foto no álbum" : `${n} fotos no álbum`)),
          nome: porta(nome, (n) => (n === 1 ? "1 sugestão de nome" : `${n} sugestões de nome`)),
          acompanhante: porta(acompanhante, (n) =>
            n === 1 ? "1 convite ativo" : `${n} convites ativos`,
          ),
          /* ⚠️ O FEED FICA DE FORA, de propósito. "Publicações novas desde a
             última visita" exigiria guardar a última visita e contar o feed
             inteiro — duas consultas caras e um estado novo, para um número que
             o próprio feed já mostra ao abrir. E um contador de feed é a única
             porta desta aba que empurraria consumo em vez de relatar um fato. */
        },
      };
    } catch {
      return vazio;
    }
  });
