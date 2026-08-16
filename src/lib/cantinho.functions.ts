import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { faltamTrofeus, trofeusExigidos } from "@/lib/trofeus";
import {
  CANTINHO_BY_ID,
  CANTINHO_ITEMS,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_COMPLETION_MIN,
  cantinhoCategoriasCompletas,
  isCantinhoCollectionComplete,
} from "@/lib/cantinho";
import {
  CONJUNTO_POR_ID,
  bonusDoConjunto,
  chaveDoBonus,
  conjuntosCompletos,
} from "@/lib/conjuntos";

/**
 * Itens grátis (preço 0) — sempre possuídos, não precisam de compra. O troféu
 * da coleção (também preço 0) é EXCLUÍDO: ele não é grátis, é desbloqueado ao
 * completar a coleção.
 */
const FREE_ITEM_IDS = CANTINHO_ITEMS.filter(
  (i) => i.price <= 0 && i.id !== CANTINHO_COMPLETIONIST_ID,
).map((i) => i.id);

/**
 * Backend do Meu Cantinho. Toda compra valida o PREÇO pelo catálogo do servidor
 * (nunca confia no cliente) e roda pela função atômica buy_cantinho_item.
 */

async function authUid(accessToken: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return data.user.id;
  } catch (e) {
    console.error("[cantinho authUid] erro:", e);
    return null;
  }
}

/** Saldo + itens que a paciente já possui. */
/**
 * QUANTOS TROFÉUS ELA TEM — delega, e não reimplementa.
 *
 * A conta mora em `sementinhas.functions.ts` (`contarTrofeus`), junto do
 * `WELLNESS_ACTIVITIES` que ela precisa conhecer. Aqui só se envolve o
 * `typedDb` e se distingue "zero troféus" de "não consegui contar" — a
 * diferença que decide se a compra é recusada.
 *
 * Duas contagens para a mesma palavra é como o troféu do topo passou a
 * discordar das conquistas, que foi o defeito que abriu este trabalho.
 */
async function contarTrofeus(
  admin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  uid: string,
): Promise<{ trofeus: number; falhou: boolean }> {
  try {
    const { contarTrofeus: contar } = await import("@/lib/sementinhas.functions");
    return { trofeus: await contar(typedDb(admin), uid), falhou: false };
  } catch {
    /* Falha aqui RECUSA a compra (ver o chamador). Liberar por não ter
       conseguido contar entrega o item e gasta a Sementinha dela do mesmo
       jeito. */
    return { trofeus: 0, falhou: true };
  }
}

export const getCantinho = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: ledger } = await db
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", uid);
    const balance = ((ledger ?? []) as { amount: number }[]).reduce(
      (s, r) => s + (r.amount ?? 0),
      0,
    );
    const { data: owned } = await db.from("cantinho_items").select("item_id").eq("user_id", uid);
    const { data: prof } = await supabaseAdmin
      .from("patient_profiles")
      .select("quiz_premium, cantinho_fundo")
      .eq("id", uid)
      .single();
    const p = prof as { quiz_premium?: boolean; cantinho_fundo?: string | null } | null;

    /* Modo Cuidado: a loja inteira se cala.
       `claimDailyAndGetWallet` e `getWellnessProgress` já respeitavam o Modo
       Cuidado; esta função não. O resultado é o pior que este app pode
       produzir: uma paciente que perdeu o bebê abre "Recompensas" e encontra
       um saldo em destaque e um "Berço (opcional)" à venda por 250 🌱.
       Devolve saldo zerado e nada possuído — a aba mostra o estado vazio, que
       é silêncio. */
    const { isCareModeActive } = await import("@/lib/care-mode.functions");
    if (await isCareModeActive(supabaseAdmin, uid)) {
      return {
        ok: true as const,
        balance: 0,
        owned: [] as string[],
        premium: Boolean(p?.quiz_premium),
        equippedFundo: null,
        collectionComplete: false,
        collectionOwned: 0,
        collectionTotal: CANTINHO_COMPLETION_MIN,
        /* Zero no luto, como o saldo: o troféu é gamificação. Nada é apagado
           no banco — a loja inteira é que se cala. */
        trofeus: 0,
        careMode: true as const,
      };
    }
    // Itens grátis entram como possuídos sempre (sem linha na tabela de compras).
    const ownedIds = new Set(((owned ?? []) as { item_id: string }[]).map((r) => r.item_id));
    for (const id of FREE_ITEM_IDS) ownedIds.add(id);
    // Troféu da coleção: concedido (virtual) assim que tem todos os itens comuns.
    const collectionComplete = isCantinhoCollectionComplete(ownedIds);
    if (collectionComplete) ownedIds.add(CANTINHO_COMPLETIONIST_ID);
    /* Conta CATEGORIAS com item pago, não itens de uma lista fixa. O contador
       antigo somava ids representativos e, com a regra por categoria, diria
       "2 de 10" para quem tem oito categorias fechadas. */
    const collectionOwned = cantinhoCategoriasCompletas(ownedIds);
    return {
      ok: true as const,
      balance,
      owned: [...ownedIds],
      premium: Boolean(p?.quiz_premium),
      // Nada por padrão: o Caminho só ganha cenário quando a paciente ESCOLHE
      // um fundo que possui (nada aparece sem ela querer).
      equippedFundo: p?.cantinho_fundo ?? null,
      collectionComplete,
      collectionOwned,
      collectionTotal: CANTINHO_COMPLETION_MIN,
      /* Para a vitrine desenhar o cadeado e dizer QUANTOS faltam. A compra
         reconta no servidor — este número é para a tela, nunca para a decisão. */
      trofeus: (await contarTrofeus(supabaseAdmin, uid)).trofeus,
    };
  });

/** Compra um item do catálogo. Preço vem do servidor; débito é atômico. */
export const buyCantinhoItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), itemId: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data }) => {
    // TUDO num try/catch: a compra NUNCA lança pro cliente. Qualquer exceção
    // (import, RPC, rede) vira um { ok:false, error } com a mensagem real, que
    // o app mostra no toast — em vez do "Não consegui comprar agora" genérico.
    try {
      const uid = await authUid(data.accessToken);
      if (!uid) return { ok: false as const, error: "Sua sessão expirou — entre novamente." };
      const item = CANTINHO_BY_ID[data.itemId];
      if (!item) return { ok: false as const, error: "Item inexistente" };
      // Troféu da coleção não se compra — desbloqueia ao completar a coleção.
      if (item.id === CANTINHO_COMPLETIONIST_ID) {
        return { ok: false as const, error: "Desbloqueia ao completar a coleção 👑" };
      }
      // Item grátis não passa pela compra — já é da paciente desde o início.
      if (item.price <= 0) return { ok: false as const, error: "Este item já é seu 💛" };
      /* Aposentado só sai da vitrine — e a vitrine é o cliente. Sem esta
         linha, um pedido montado à mão (ou uma aba aberta antes do deploy)
         ainda compraria o item que saiu de circulação. Mesma régua do gate de
         Premium e do de troféu: quem decide é o servidor. */
      if (item.aposentado) {
        return { ok: false as const, error: "Este item saiu da lojinha 🌙" };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Gate de Premium no servidor: item premium só p/ assinante (nunca confia no cliente).
      if (item.premium) {
        // maybeSingle (não single): .single() LANÇA quando não há linha de perfil,
        // e era isso que derrubava a compra de itens premium com erro opaco.
        const { data: prof } = await supabaseAdmin
          .from("patient_profiles")
          .select("quiz_premium")
          .eq("id", uid)
          .maybeSingle();
        if (!(prof as { quiz_premium?: boolean } | null)?.quiz_premium) {
          return { ok: false as const, error: "Item exclusivo do Premium 💎" };
        }
      }

      /* ─── GATE DE TROFÉU, NO SERVIDOR ────────────────────────────────────
       *
       * Três itens só abrem depois de N dias de cinco estrelas
       * (`TROFEUS_PARA`). Conferir só na tela deixaria o cadeado decorativo:
       * o botão sumiria e a chamada continuaria passando.
       *
       * A contagem sai das linhas `day_stars:` do LEDGER, que só o servidor
       * escreve e só depois de conferir as cinco atividades do dia. Contar
       * `doneDays` do `journey_state` seria contar o que o navegador digitou. */
      if (trofeusExigidos(item.id) > 0) {
        const { trofeus, falhou } = await contarTrofeus(supabaseAdmin, uid);
        /* Falha de leitura RECUSA a compra. É o único lado seguro: liberar por
           não ter conseguido contar entrega o item a quem não o conquistou, e
           a Sementinha sairia do saldo dela do mesmo jeito. */
        if (falhou) {
          return { ok: false as const, error: "Não consegui conferir seus troféus agora." };
        }
        const faltam = faltamTrofeus(item.id, trofeus);
        if (faltam > 0) {
          return {
            ok: false as const,
            error: `Faltam ${faltam} ${faltam === 1 ? "troféu" : "troféus"} 🏆`,
          };
        }
      }
      // Chama o RPC DIRETO no objeto (sem extrair o método pra uma variável):
      // extrair perdia o `this`, e por dentro o supabase-js lê `this.rest` —
      // dava "Cannot read properties of undefined (reading 'rest')" e derrubava
      // TODA compra. Manter a chamada ligada ao supabaseAdmin preserva o `this`.
      const { data: res, error } = await (
        supabaseAdmin as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: unknown }>;
        }
      ).rpc("buy_cantinho_item", {
        p_user: uid,
        p_item: item.id,
        p_price: item.price,
      });
      if (error) {
        // Surface o motivo real (ex.: função ausente, permissão) — ajuda o
        // diagnóstico em produção em vez de um "Falha na compra" opaco.
        const m = (error as { message?: string; code?: string })?.message ?? "erro desconhecido";
        console.error("[buyCantinhoItem] RPC error:", error);
        return { ok: false as const, error: `Erro no banco: ${m}` };
      }
      const r = (res ?? {}) as { ok?: boolean; error?: string; balance?: number };
      if (!r.ok) {
        const msg =
          r.error === "saldo_insuficiente"
            ? "Sementinhas insuficientes 🌱"
            : r.error === "ja_possui"
              ? "Você já tem este item 💛"
              : `Não foi possível comprar (${r.error ?? "motivo desconhecido"})`;
        /* `motivo` é o código CRU da RPC, e existe porque o cliente precisava
           reagir a "já possui" (item comprado noutro aparelho → basta
           sincronizar, não é erro). Ele fazia isso comparando a frase, e a
           frase tem emoji: `error === "Você já tem este item"` nunca casava
           com `"Você já tem este item 💛"`, então o auto-conserto jamais rodou.
           Texto de tela é para gente ler; decisão de código se toma por código. */
        return { ok: false as const, error: msg, motivo: r.error ?? null, balance: r.balance ?? 0 };
      }
      /* ── O BÔNUS DE CONJUNTO ────────────────────────────────────────────
         Paga DEPOIS de a compra ter dado certo, e só aqui: é o único
         momento em que a coleção dela pode ter mudado.

         ⚠️ Idempotente por `conjunto:<id>` — a mesma trava de todo ganho do
         app. Sem ela, uma recompra recusada ("já possui") vinda de outro
         aparelho pagaria o conjunto de novo a cada sincronização.

         ⚠️ E é `try/catch` que ENGOLE: a compra já aconteceu e o item já é
         dela. Derrubar a resposta aqui faria a tela dizer "falha na compra"
         de um item que está no cantinho — o pior dos dois mundos. O bônus se
         auto-corrige na compra seguinte, porque a chave de dedupe não deixa
         pagar duas vezes. */
      let conjuntosFechados: string[] = [];
      /* Os que fecharam AGORA — é o que a tela comemora, e é o que soma ao
         saldo. Ver o bloco abaixo. */
      let conjuntosNovos: string[] = [];
      let bonusNovo = 0;
      try {
        const db = typedDb(supabaseAdmin);
        const { data: agora } = await db
          .from("cantinho_items")
          .select("item_id")
          .eq("user_id", uid);
        const possui = new Set([
          ...((agora ?? []) as { item_id: string }[]).map((x) => x.item_id),
          ...FREE_ITEM_IDS,
        ]);
        const fechados = conjuntosCompletos(possui);
        if (fechados.length > 0) {
          /* ⚠️ QUAIS DELES JÁ FORAM PAGOS. `conjuntosCompletos` devolve TODOS
             os fechados, não os que fecharam agora — quem já tem três
             conjuntos recebe os três nesta lista em toda compra. O
             `ignoreDuplicates` de `grantSementinhas` impede o pagamento duplo
             no banco, mas quem quiser somar o bônus ao saldo da tela precisa
             saber quais linhas NASCERAM aqui: somar a lista inteira mostraria
             um número inflado que se corrige sozinho no recarregamento. */
          const chaves = fechados.map((cid) => chaveDoBonus(cid));
          const { data: jaPagos } = await db
            .from("sementinhas_ledger")
            .select("dedupe_key")
            .eq("user_id", uid)
            .in("dedupe_key", chaves);
          const pagas = new Set(
            ((jaPagos ?? []) as { dedupe_key: string | null }[]).map((l) => l.dedupe_key ?? ""),
          );
          const novos = fechados.filter((cid) => !pagas.has(chaveDoBonus(cid)));

          const { grantSementinhas } = await import("@/lib/sementinhas.functions");
          await grantSementinhas(
            db,
            uid,
            fechados.map((cid) => ({
              amount: bonusDoConjunto(CONJUNTO_POR_ID[cid]),
              reason: `Conjunto completo: ${CONJUNTO_POR_ID[cid].nome}`,
              dedupeKey: chaveDoBonus(cid),
            })),
          );
          conjuntosFechados = fechados;
          bonusNovo = novos.reduce((t, cid) => t + bonusDoConjunto(CONJUNTO_POR_ID[cid]), 0);
          conjuntosNovos = novos;
        }
      } catch (e) {
        console.error("[cantinho] bônus de conjunto não pagou", uid, e);
      }

      /* ─── ⚠️ O SALDO É RELIDO DEPOIS DO BÔNUS ────────────────────────────
         `r.balance` vem do RPC da COMPRA, que roda ANTES do bloco acima. Com
         ele, a paciente fechava um conjunto, o servidor creditava 36–48 🌱, a
         prateleira virava "completo ✓" e **o número na tela não se movia** — o
         bônus só aparecia na próxima montagem, do nada.

         É o defeito do presente do médico ao contrário ("saldo que sobe
         sozinho é indistinguível de bug"), e aqui é pior: ela associa o número
         parado à compra que acabou de fazer.

         Falha na releitura devolve o saldo antigo, que é o lado seguro: um
         número desatualizado por uma tela é melhor que um `0` afirmado. */
      /* O saldo é a SOMA DO LEDGER (não há tabela de carteira — ver
         `computeBalance`), então somar o que ACABOU de ser creditado é exato e
         dispensa uma segunda consulta. `bonusNovo` é zero quando nenhum
         conjunto fechou agora. */
      const balance = (r.balance ?? 0) + bonusNovo;

      return {
        ok: true as const,
        balance,
        itemId: item.id,
        /* Os conjuntos que ela JÁ tem fechados — a tela usa para saber se este
           item acabou de fechar um, e comemorar. */
        conjuntosFechados,
        /* Os que fecharam NESTA compra, e quanto pagaram — é com isto que a
           tela comemora e mostra o saldo novo. Sem eles, a paciente fechava um
           conjunto, ganhava 36–48 🌱 e o número na tela não se movia. */
        conjuntosNovos,
        bonusNovo,
      };
    } catch (e) {
      const m = (e as { message?: string })?.message ?? String(e);
      console.error("[buyCantinhoItem] exceção:", e);
      return { ok: false as const, error: `Erro ao comprar: ${m}` };
    }
  });

/**
 * Troca o tema do céu da home. "v2" (arte por momento do dia) é o padrão e
 * não custa nada; "v1" (o céu original) exige ter comprado `tema-ceu-v1`.
 * A posse é checada AQUI e não no cliente — o cliente só pede.
 */
export const setSkyTheme = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), theme: z.enum(["v2", "v1"]) }).parse(i),
  )
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.theme === "v1") {
      const db = typedDb(supabaseAdmin);
      const { data: owned } = await db
        .from("cantinho_items")
        .select("item_id")
        .eq("user_id", uid)
        .eq("item_id", "tema-ceu-v1")
        .maybeSingle();
      if (!owned) return { ok: false as const, error: "Você ainda não tem o Céu Clássico" };
    }
    const { error: upErr } = await (
      supabaseAdmin.from("patient_profiles") as unknown as {
        update: (v: { sky_theme: string }) => {
          eq: (c: string, val: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update({ sky_theme: data.theme })
      .eq("id", uid);
    // 42703 = coluna ausente (migração pendente): a troca não persiste, mas o
    // app não pode quebrar por causa disso. Reporta em vez de fingir sucesso.
    if (upErr) return { ok: false as const, error: "Falha ao salvar" };
    return { ok: true as const, theme: data.theme };
  });

/** Equipa (ou limpa, com null) o cenário ativo do Cantinho. Só 1 por vez. */
export const setCantinhoFundo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), fundoId: z.string().max(80).nullable() }).parse(i),
  )
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.fundoId) {
      const item = CANTINHO_BY_ID[data.fundoId];
      if (!item || item.type !== "fundo") return { ok: false as const, error: "Cenário inválido" };
      // Item grátis dispensa a checagem de posse (sempre é da paciente).
      if (item.price > 0) {
        // Precisa possuir o item pra equipar.
        const db = typedDb(supabaseAdmin);
        const { data: owned } = await db
          .from("cantinho_items")
          .select("item_id")
          .eq("user_id", uid)
          .eq("item_id", data.fundoId)
          .maybeSingle();
        if (!owned) return { ok: false as const, error: "Você ainda não tem este cenário" };
      }
    }
    const { error: upErr } = await (
      supabaseAdmin.from("patient_profiles") as unknown as {
        update: (v: { cantinho_fundo: string | null }) => {
          eq: (c: string, val: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update({ cantinho_fundo: data.fundoId })
      .eq("id", uid);
    if (upErr) return { ok: false as const, error: "Falha ao salvar" };
    return { ok: true as const, equippedFundo: data.fundoId };
  });
