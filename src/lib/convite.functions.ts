/**
 * QUEM CONVIDOU — a leitura pública, sem sessão.
 *
 * A régua (o que pode ser dito, e o que nem é lido) mora em
 * `src/lib/quem-convidou.ts`. Aqui é só a ida ao banco.
 *
 * ─── POR QUE ESTA FUNÇÃO PODE VIVER SEM LOGIN ──────────────────────────────
 *
 * Ela responde a quem tem o CÓDIGO em mãos, e o código é uma capacidade: sete
 * caracteres num alfabeto de 32 (≈ 34 bilhões de combinações), que só se tem
 * recebendo o link. É a mesma decisão já registrada em `convidarAmiga` — o
 * código PODE revelar, e é isso que o torna gostoso de usar —, e é o oposto de
 * uma busca por nome, que transformaria a base numa lista navegável.
 *
 * O que sai daqui é PRIMEIRO NOME e FOTO. Semana, DPP, nome do bebê e
 * sobrenome não são lidos do banco: o `select` não os pede.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";
import {
  codigoDeCriadoraLimpo,
  codigoLimpo,
  primeiroNome,
  type QuemConvidou,
} from "@/lib/quem-convidou";
import type { PerfilPublico, PostPublico } from "@/lib/perfil-publico";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ⚠️ **O limitador é a única defesa contra enumeração**, e por isso ele existe
 * mesmo com 34 bilhões de combinações: sem ele, um script poderia varrer o
 * espaço de códigos CURTOS (os de 3 e 4 caracteres, se algum dia existirem) e
 * colher primeiros nomes. Trinta por minuto por IP é folgado para uma pessoa
 * abrindo um link e apertado para uma varredura.
 */
const limitado = makeRateLimiter(30, 60_000);

export const quemConvidou = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        codigo: z.string().min(1).max(24),
        /** `amiga` = paciente (`referral_code`) · `criadora` = afiliada (`code`). */
        tipo: z.enum(["amiga", "criadora"]),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<{ quem: QuemConvidou | null }> => {
    /* ⚠️ Limpar ANTES da consulta — é a régua que impede `%` e `_` de virarem
       curinga. Ver `codigoLimpo`. */
    /* ⚠️ **A FORMA DEPENDE DA ORIGEM.** `referral_code` de paciente é gerado
       pelo app (alfanumérico curto); `affiliates.code` é escrito à mão e o
       próprio app aceita hífen, sublinhado e até 24 caracteres na captura de
       `?ref=`. Uma régua só escondia a faixa de toda criadora com código
       fora da forma estreita — em silêncio, no link da bio dela. */
    const codigo =
      data.tipo === "criadora" ? codigoDeCriadoraLimpo(data.codigo) : codigoLimpo(data.codigo);
    if (!codigo) return { quem: null };

    try {
      const req = getRequest();
      if (req && limitado(clientIp(req))) return { quem: null };
    } catch {
      /* Sem requisição em mãos (build, teste), segue: o limitador é defesa em
         profundidade, não o portão. */
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    if (data.tipo === "criadora") {
      /* ⚠️ O nome da criadora é CURADO pelo dono (`affiliates.name`), e não
         digitado pela pessoa — então aqui não há o risco de vazar sobrenome de
         paciente. E só afiliada ATIVA aparece: um código desligado não atribui
         nada, e anunciar quem não paga comissão seria prometer o que o
         servidor nega (mesma razão de `codigoDoPerfil`). */
      const { data: linha, error } = await sb
        .from("affiliates")
        .select("name, active")
        .eq("code", codigo)
        .maybeSingle();
      if (error || !linha || !(linha as any).active) return { quem: null };
      const nome = primeiroNome((linha as any).name);
      return nome ? { quem: { nome, avatarUrl: null, tipo: "criadora" } } : { quem: null };
    }

    /* ⚠️ `display_name` e `avatar_url` e MAIS NADA. `care_mode` entra só para
       ser conferido — nunca devolvido. */
    const { data: perfil, error } = await sb
      .from("patient_profiles")
      .select("display_name, avatar_url, care_mode")
      .eq("referral_code", codigo)
      .maybeSingle();
    if (error || !perfil) return { quem: null };

    /* ⚠️ **MODO CUIDADO DEVOLVE A MESMA COISA QUE "CÓDIGO NÃO EXISTE".**
       Distinguir os dois — mesmo com um motivo genérico — contaria por
       eliminação que alguma coisa aconteceu com ela, para quem abriu o link.
       É a mesma resposta única de `verPerfil` e de `decidirPergunta`. */
    if ((perfil as any).care_mode) return { quem: null };

    const nome = primeiroNome((perfil as any).display_name);
    if (!nome) return { quem: null };

    /* ⚠️ **A FOTO PRECISA SER RENOVADA, e o comentário anterior estava velho.**
       Ele dizia "já é data URL no banco (JPEG 256px reduzido no canvas)" — e era
       verdade até o editor de perfil da rede passar a SUBIR a foto para o balde
       e gravar uma URL ASSINADA, que vence em 7 dias. Devolvida crua, a foto de
       quem convidou respondia 403 a partir do oitavo dia: a faixa aparecia com
       o nome certo e um buraco no lugar do rosto, que é justamente a metade que
       faz a pessoa confiar no link.

       `renovarUrlAssinada` conhece os dois formatos e devolve a data URL
       intacta — é a mesma função, e o mesmo defeito, que `perfisPorId` já
       conserta para a rede inteira. */
    const { renovarUrlAssinada } = await import("@/lib/imagens.server");
    return {
      quem: {
        nome,
        avatarUrl: await renovarUrlAssinada((perfil as any).avatar_url),
        tipo: "amiga",
      },
    };
  });

/**
 * O CÓDIGO QUE VAI NO RODAPÉ DAS PÁGINAS PÚBLICAS — a régua, num lugar só.
 *
 * As três páginas públicas (`/presente`, `/album`, `/acompanhar`) precisam da
 * mesma decisão: mostrar o convite, e com o código DELA. Escrita em três
 * lugares, ela divergiria no primeiro conserto — e a divergência apareceria
 * como convite oferecido a quem está em luto, que é o pior desfecho possível.
 *
 * ⚠️ **Modo Cuidado devolve `null`.** As três páginas continuam de pé no luto —
 * o álbum é a memória dela, e o acompanhante é a rede de apoio —, mas o convite
 * fala de gestação em curso ("o app da gestação dela", "se você também está
 * grávida"). Ele é a única coisa daquelas telas que precisa sumir.
 *
 * ⚠️ **E sem código não há convite.** Um link sem indicação é indistinguível de
 * um bom para quem manda e para quem recebe; só o vínculo não acontece. Mesma
 * decisão de `linkDeIndicacao` devolver `null`.
 */
export async function codigoParaConvite(sb: any, userId: string): Promise<string | null> {
  try {
    const { data } = await sb
      .from("patient_profiles")
      .select("referral_code, care_mode")
      .eq("id", userId)
      .maybeSingle();
    if (!data || (data as any).care_mode) return null;
    return codigoLimpo((data as any).referral_code);
  } catch {
    /* Sem o código, o rodapé não aparece — e é o certo. */
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   O PERFIL PÚBLICO — a vitrine de quem abriu o perfil ao mundo
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O perfil de uma paciente, para uma pessoa SEM CONTA.
 *
 * A régua (o portão, o teto, o que fica de fora) mora em
 * `src/lib/perfil-publico.ts`. Aqui é a ida ao banco.
 *
 * ⚠️ **Um `null` só, para três motivos.** Perfil fechado, Modo Cuidado e código
 * inexistente devolvem a mesma coisa — ver `podeAbrirPerfilPublico`.
 *
 * ⚠️ **A SEMANA passa pela régua única** (`seloDoPerfil`), com `birth_date` no
 * select: sem ele, `computeGestation` conta para sempre e uma mãe que pariu na
 * 39ª apareceria como "47 semanas" numa página aberta ao mundo. É o mesmo
 * defeito que a legenda sugerida teve.
 */
export const perfilPublicoPorCodigo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ codigo: z.string().min(1).max(24) }).parse(i))
  .handler(async ({ data }): Promise<{ perfil: PerfilPublico | null }> => {
    const codigo = codigoLimpo(data.codigo);
    if (!codigo) return { perfil: null };

    try {
      const req = getRequest();
      if (req && limitado(clientIp(req))) return { perfil: null };
    } catch {
      /* ver o comentário gêmeo em `quemConvidou` */
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const COLUNAS =
      "id, display_name, bio, avatar_url, care_mode, perfil_publico, referral_code, " +
      "birth_date, lmp_date, reference_date, reference_weeks, reference_days, baby_name";
    /* ⚠️ RECUO POR COLUNA AUSENTE: `mostrar_semana`/`mostrar_bebe` nascem num
       `APLICAR_` que o dono roda à mão, e o PostgREST recusa o SELECT INTEIRO
       por causa de uma coluna que não conhece. Sem o recuo, a página inteira
       deixaria de existir na janela entre o deploy e o SQL. */
    const um = async (colunas: string) =>
      await sb.from("patient_profiles").select(colunas).eq("referral_code", codigo).maybeSingle();
    let r = await um(`${COLUNAS}, mostrar_semana, mostrar_bebe, vitrine_publica`);
    /* ⚠️ Degrau por degrau, como em `perfisPorId`: `vitrine_publica` nasceu
       depois das chaves do selo, então existe banco com uma e sem a outra. E
       ausente vale FALSE nas duas pontas — banco sem a coluna é banco sem
       consentimento, e a vitrine simplesmente não abre. */
    if (r.error) r = await um(`${COLUNAS}, mostrar_semana, mostrar_bebe`);
    if (r.error) r = await um(COLUNAS);
    const p = r.data as Record<string, any> | null;

    const { podeAbrirPerfilPublico, POSTS_NA_VITRINE } = await import("@/lib/perfil-publico");
    if (
      !podeAbrirPerfilPublico({
        existe: !!p,
        perfilPublico: !!p?.perfil_publico,
        vitrine: !!p?.vitrine_publica,
        emCuidado: !!p?.care_mode,
      })
    ) {
      return { perfil: null };
    }

    const { computeGestation } = await import("@/lib/gestacao");
    const { renovarUrlAssinada } = await import("@/lib/imagens.server");
    const { entradaDoSelo, hojeEmSaoPaulo, seloDoPerfil } = await import("@/lib/selo-do-perfil");
    const g = computeGestation({
      lmp: p!.lmp_date ?? null,
      referenceDate: p!.reference_date ?? null,
      referenceWeeks: p!.reference_weeks ?? null,
      referenceDays: p!.reference_days ?? null,
      /* O dia de São Paulo, e não o do contêiner — ver `seloDe`. */
      today: hojeEmSaoPaulo(),
    });
    const selo = seloDoPerfil(entradaDoSelo(p as any, g?.totalDays ?? null));

    /* ⚠️ **SÓ A CAMADA `publico`, e o filtro está na CONSULTA.** Um visitante
       sem conta não segue ninguém e não é amiga de ninguém: filtrar depois de
       ler seria trazer para a memória do servidor exatamente o que esta página
       não pode mostrar. E `arquivado_em` fora, porque arquivar é tirar do ar. */
    let posts: PostPublico[] = [];
    try {
      const { data: linhas } = await sb
        .from("rede_posts")
        .select("id, texto, imagem_path, criado_em")
        .eq("autor_id", p!.id)
        .eq("visibilidade", "publico")
        .is("arquivado_em", null)
        .order("criado_em", { ascending: false })
        .limit(POSTS_NA_VITRINE);
      const { urlAssinada } = await import("@/lib/imagens.server");
      posts = await Promise.all(
        ((linhas ?? []) as any[]).map(async (l) => ({
          id: l.id as string,
          imagemUrl: l.imagem_path ? await urlAssinada("rede", l.imagem_path, 3600) : null,
          texto: (l.texto as string | null) ?? null,
          criadoEm: l.criado_em as string,
        })),
      );
    } catch {
      /* Sem as publicações a vitrine vira só o cartão de perfil — que é melhor
         que uma página que não abre. */
    }

    return {
      perfil: {
        nome: (p!.display_name as string | null)?.trim() || "Alguém",
        bio: ((p!.bio as string | null) ?? "").trim() || null,
        /* ⚠️ Renovada, como em `quemConvidou` e em `perfisPorId`: a foto do
           editor de perfil é URL ASSINADA e vence em 7 dias. Crua, a vitrine
           pública — a página que existe para apresentar o app a quem não tem
           conta — abriria sem rosto a partir do oitavo dia. */
        avatarUrl: await renovarUrlAssinada(p!.avatar_url),
        seloSemana: selo.semana,
        seloBebe: selo.bebe,
        posts,
        codigoDeConvite: codigo,
      },
    };
  });

/**
 * CONTA UMA ABERTURA DE LINK DE CONVITE.
 *
 * ─── O DEGRAU CEGO ──────────────────────────────────────────────────────────
 *
 * O painel de indicação media "criaram conta", "publicaram" e "seguem alguém",
 * e o degrau de cima aparecia como NÃO MEDIDO com todas as letras. Sem esse
 * número, todas as taxas abaixo dele são cegas — não dá para saber se o
 * problema é o link não circular ou a página não converter, que são dois
 * problemas com consertos opostos.
 *
 * ⚠️ **NÃO GUARDA NADA DE QUEM ABRIU.** Sem IP, sem user agent, sem
 * identificador de visitante, sem hora — só o dia. Isto é um contador de
 * alcance, não um rastreador: quem abre o link de uma gestante pode ser a
 * chefe dela, a sogra ou o ex, e a única pergunta que o painel precisa
 * responder é "quantas pessoas abriram". Colher mais seria dado de terceiro
 * sem conta e sem consentimento, para uma pergunta já respondida sem ele.
 *
 * ⚠️ **UMA POR VISITA, e quem garante isso é o chamador.** `FaixaDeConvite` já
 * guarda o código no `sessionStorage` para não repintar a faixa a cada
 * navegação — a mesma memória serve aqui. Contar no efeito sem esse guarda
 * multiplicaria a visita pelo número de páginas que ela abriu.
 *
 * ⚠️ **E ela nunca derruba nada.** É métrica: falha de rede, tabela ausente
 * (`42P01`, antes de o dono rodar o SQL) ou limitador estourado devolvem
 * silêncio. Um contador que quebrasse a landing seria a pior troca possível.
 */
export const contarVisitaDeConvite = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        codigo: z.string().min(1).max(24),
        tipo: z.enum(["amiga", "criadora"]),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    /* A MESMA limpeza da faixa, e pela mesma razão: o código entra numa chave
       primária de texto, e a forma dele depende da origem. */
    const codigo =
      data.tipo === "criadora" ? codigoDeCriadoraLimpo(data.codigo) : codigoLimpo(data.codigo);
    if (!codigo) return { ok: false };

    try {
      const req = getRequest();
      /* ⚠️ O IP entra no LIMITADOR e nunca no banco: ele existe para impedir
         que um script infle o número de uma criadora, e some no fim da
         requisição. É o mesmo `clientIp` de `quemConvidou`. */
      if (req && limitado(clientIp(req))) return { ok: false };
    } catch {
      /* Sem requisição em mãos (build, teste), segue. */
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      /* O dia de SÃO PAULO, e não o do contêiner: o servidor roda em UTC, e
         das 21h à meia-noite ele já está no dia seguinte — o painel mostraria
         visitas de hoje na linha de amanhã. */
      const dia = new Date(
        new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
      ).toLocaleDateString("en-CA");
      await (supabaseAdmin as any).rpc("contar_visita_de_convite", {
        p_codigo: codigo,
        p_tipo: data.tipo,
        p_dia: dia,
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
