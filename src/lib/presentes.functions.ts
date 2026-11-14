/**
 * A LISTA DE PRESENTES — o lado do servidor.
 *
 * As réguas moram em `fraldas.ts`, `cotas.ts`, `presentes.ts` e
 * `agradecimento.ts`, todas testadas sem banco. Aqui fica o que exige o
 * servidor: provar quem é quem, reler o saldo antes de gravar, e nunca
 * devolver mais do que quem pergunta pode ver.
 *
 * ─── AS QUATRO TRAVAS, E NENHUMA PODE FALTAR ───────────────────────────────
 *
 * 1. ⚠️ **`listaPorToken` NUNCA devolve `user_id`.** É a mesma correção que
 *    `getAlbumByToken` já levou e que `getPublicNameSession` levou 190 linhas
 *    antes — e que precisou ser feita DUAS vezes porque não foi propagada ao
 *    irmão. Colunas nomeadas, jamais `select("*")`.
 *
 * 2. ⚠️ **A página pública NÃO diz QUEM reservou.** A amiga precisa saber que
 *    o item está reservado, não por quem. Quem deu é surpresa, e revelar cria
 *    comparação entre as convidadas ("a Fulana deu o carrinho e eu dei
 *    fralda"). Só a DONA vê os nomes.
 *
 * 3. ⚠️ **O saldo é RELIDO dentro da mesma operação da gravação.** A régua pura
 *    responde "pode" com toda a confiança do mundo quando recebe um saldo
 *    velho. Duas amigas na última cota, no mesmo segundo, é o caso real.
 *
 * 4. ⚠️ **Modo Cuidado é conferido em TODAS as funções públicas**, lendo o
 *    perfil da DONA. Este é o recurso com o maior risco de Modo Cuidado do app
 *    inteiro, porque o objeto vive FORA do aparelho dela: um link de chá de
 *    bebê que continua vivo depois de uma perda está na mão de trinta pessoas.
 *    E a página pública **não conta o que aconteceu** — nem "modo cuidado",
 *    nem emoji de luto, nada. Contar a perda dela para o grupo de WhatsApp da
 *    família é o app tomando a decisão mais íntima que existe no lugar dela.
 */
import { createServerFn } from "@tanstack/react-start";
import { codigoLimpo } from "@/lib/quem-convidou";
import { z } from "zod";
import { faixaDe, metaDeFraldas, podeReservarFralda, TAMANHOS } from "@/lib/fraldas";
import { podeReservarCotas } from "@/lib/cotas";
import { sanitizarNomeDeQuemDeu, type ItemDaLista, type ReservaPublica } from "@/lib/presentes";

/** O que a página pública recebe. Sem `user_id`, sem nome de quem reservou. */
export type ListaPublica = {
  titulo: string | null;
  recado: string | null;
  bebeNome: string | null;
  donaNome: string;
  dataDoCha: string | null;
  aberta: boolean;
  itens: ItemDaLista[];
  /**
   * O código de indicação DELA, para o rodapé de convite — ou `null`.
   *
   * ⚠️ É o mesmo `referral_code` do convite pelo WhatsApp, então quem cria
   * conta pela lista de presentes vira indicação dela e as 100 🌱 são pagas.
   * `null` em Modo Cuidado e sem código; ver `codigoParaConvite`.
   */
  codigoDeConvite?: string | null;
};

/** O que a DONA recebe — com os nomes, porque é ela. */
export type ListaDaDona = ListaPublica & {
  token: string;
  reservas: ReservaPublica[];
};

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(accessToken);
  return data.user?.id ?? null;
}

/** Token opaco, do servidor. Nunca derivado do uuid da paciente. */
function novoToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 32);
}

/**
 * A lista existe e está no ar?
 *
 * ⚠️ Devolve o MESMO `null` para "token inválido", "lista fechada" e "a dona
 * está em Modo Cuidado". Distinguir contaria à torcida inteira uma coisa sobre
 * a gestação dela que ela não pediu para contar.
 */
async function listaViva(
  sb: any,
  token: string,
): Promise<{ id: string; userId: string; row: any; perfil: any } | null> {
  const { data } = await sb
    .from("presente_listas")
    .select("id, user_id, titulo, recado, data_do_cha, aberta")
    .eq("token", token)
    .maybeSingle();
  if (!data || !data.aberta) return null;

  const { data: p } = await sb
    .from("patient_profiles")
    /* ⚠️ `referral_code` entra AQUI, e não numa segunda consulta em
       `listaPorToken`: o perfil já está sendo lido, e o `care_mode` logo abaixo
       já é o portão do convite. Uma ida a mais ao banco por abertura de uma
       página que trinta pessoas abrem seria puro desperdício — e obrigaria
       `listaPorToken` a mencionar `user_id`, que é justamente o que a catraca
       desta tela proíbe (ela nunca devolve o uuid dela). */
    .select("display_name, baby_name, care_mode, referral_code")
    .eq("id", data.user_id)
    .maybeSingle();
  /**
   * ⚠️ **O PORTÃO DE MODO CUIDADO FALHAVA ABERTO — e aqui dói mais, porque o
   * objeto vive FORA do aparelho dela.**
   *
   * Era `if (p?.care_mode)`. Com a leitura falhando, `p` é `null`,
   * `p?.care_mode` é `undefined`, o `if` não dispara e **a lista de presentes
   * continua no ar** — para as trinta pessoas que já têm o link, depois de uma
   * perda.
   *
   * `!p` entra na frente. A página pública já responde o MESMO silêncio para
   * token inválido, lista fechada e Modo Cuidado, então recusar por falha de
   * leitura não conta nada a ninguém — e o pior caso é a lista ficar
   * indisponível por um minuto.
   */
  if (!p || p.care_mode) return null;

  return { id: data.id, userId: data.user_id, row: data, perfil: p ?? {} };
}

/** Itens + saldo. O saldo é SOMA das reservas vivas, nunca uma coluna. */
async function itensComSaldo(sb: any, listaId: string): Promise<ItemDaLista[]> {
  const [{ data: itens }, { data: reservas }] = await Promise.all([
    sb
      .from("presente_itens")
      .select("id, tipo, titulo, nota, ordem, tamanho, meta, teto, centavos_total")
      .eq("lista_id", listaId)
      .eq("arquivado", false)
      .order("ordem", { ascending: true }),
    sb
      .from("presente_reservas")
      .select("item_id, quantidade")
      .eq("lista_id", listaId)
      .is("cancelada_em", null),
  ]);

  const soma = new Map<string, number>();
  for (const r of (reservas ?? []) as { item_id: string; quantidade: number }[]) {
    soma.set(r.item_id, (soma.get(r.item_id) ?? 0) + (r.quantidade ?? 0));
  }

  return ((itens ?? []) as any[]).map((i) => ({
    id: i.id,
    tipo: i.tipo,
    titulo: i.titulo,
    nota: i.nota ?? null,
    ordem: i.ordem ?? 0,
    tamanho: i.tamanho ?? null,
    meta: i.meta ?? 1,
    teto: i.teto ?? null,
    centavosTotal: i.centavos_total ?? null,
    reservado: soma.get(i.id) ?? 0,
  }));
}

/**
 * A lista da PACIENTE. Cria na primeira chamada, já com os cinco cartões de
 * fralda — uma lista vazia é uma tela que não ensina nada, e as fraldas são o
 * que ela ia pedir de qualquer jeito.
 */
export const minhaLista = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    let { data: lista } = await sb
      .from("presente_listas")
      .select("id, token, titulo, recado, data_do_cha, aberta")
      .eq("user_id", eu)
      .maybeSingle();

    if (!lista) {
      const { data: nova, error } = await sb
        .from("presente_listas")
        .insert({ user_id: eu, token: novoToken() })
        .select("id, token, titulo, recado, data_do_cha, aberta")
        .single();
      if (error || !nova) return { ok: false as const, motivo: "banco" as const };
      lista = nova;

      /* Os cinco cartões de fralda nascem junto, com meta e teto vindos da
         régua — nunca escritos à mão aqui, senão o dia em que a tabela mudar
         as listas novas e as antigas passam a discordar. */
      const meta = metaDeFraldas();
      const { error: erroFraldas } = await sb.from("presente_itens").insert(
        TAMANHOS.map((t, n) => ({
          lista_id: nova.id,
          tipo: "fralda",
          titulo: `Fraldas ${t}`,
          tamanho: t,
          meta: meta[t],
          teto: faixaDe(t).tetoPacotes,
          ordem: n,
        })),
      );
      /* Falhar aqui em silêncio entregaria uma lista VAZIA a quem acabou de
         abrir a tela pela primeira vez — e ela concluiria que o recurso não
         funciona, que é exatamente o que a catraca de escritas sem checagem
         existe para impedir. */
      if (erroFraldas) return { ok: false as const, motivo: "banco" as const };
    }

    const { data: perfil } = await sb
      .from("patient_profiles")
      .select("display_name, baby_name")
      .eq("id", eu)
      .maybeSingle();

    const [itens, { data: reservas }] = await Promise.all([
      itensComSaldo(sb, lista.id),
      sb
        .from("presente_reservas")
        .select(
          "id, item_id, quantidade, quem_nome, recado, audio_path, revelar_em, revelada_em, agradecida_em, criada_em",
        )
        .eq("lista_id", lista.id)
        .is("cancelada_em", null)
        .order("criada_em", { ascending: false }),
    ]);

    const hoje = new Date().toISOString().slice(0, 10);

    const saida: ListaDaDona = {
      token: lista.token,
      titulo: lista.titulo ?? null,
      recado: lista.recado ?? null,
      dataDoCha: lista.data_do_cha ?? null,
      aberta: !!lista.aberta,
      donaNome: ((perfil as any)?.display_name ?? "").trim() || "Você",
      bebeNome: ((perfil as any)?.baby_name ?? "").trim() || null,
      itens,
      /* ⚠️ O AGENDADO NÃO APARECE PARA ELA ANTES DA HORA — é o recurso inteiro.
         Um presente marcado para a 36ª semana que ela vê hoje na lista deixou
         de ser surpresa, e quem o marcou fez isso de propósito. O corte é aqui,
         no servidor: filtrar na tela deixaria o recado viajando pela rede. */
      reservas: ((reservas ?? []) as any[])
        .filter((r) => !r.revelar_em || r.revelar_em <= hoje || r.revelada_em)
        .map((r) => ({
          id: r.id,
          itemId: r.item_id,
          quantidade: r.quantidade,
          quemNome: r.quem_nome,
          recado: r.recado ?? null,
          temAudio: !!r.audio_path,
          revelarEm: r.revelar_em ?? null,
          agradecidaEm: r.agradecida_em ?? null,
          criadaEm: r.criada_em,
        })),
    };

    /* Quantos ainda estão guardados. Ela vê o NÚMERO, nunca o conteúdo — é o
       que faz a espera ser gostosa em vez de parecer que a lista está vazia. */
    const guardados = ((reservas ?? []) as any[]).filter(
      (r) => r.revelar_em && r.revelar_em > hoje && !r.revelada_em,
    ).length;

    return { ok: true as const, lista: saida, guardados };
  });

const ItemSchema = z.object({
  id: z.string().uuid().nullable(),
  tipo: z.enum(["item", "fralda", "cota"]),
  titulo: z.string().min(1).max(120),
  nota: z.string().max(300).nullable(),
  ordem: z.number().int().min(0).max(999),
  tamanho: z.enum(["RN", "P", "M", "G", "XG"]).nullable(),
  meta: z.number().int().min(1).max(999),
  teto: z.number().int().min(1).max(999).nullable(),
  centavosTotal: z.number().int().min(1).max(100_000_00).nullable(),
});

/** A dona monta a lista. */
export const salvarItens = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        titulo: z.string().max(120).nullable().optional(),
        recado: z.string().max(500).nullable().optional(),
        dataDoCha: z.string().max(10).nullable().optional(),
        /**
         * ⚠️ **OPCIONAL, e isso é o que separa os dois assuntos.**
         *
         * `salvarItens` grava o CONVITE (título, recado, data) e a LISTA. Com
         * `itens` obrigatório, salvar só o convite obrigaria a tela a
         * reenviar a lista inteira — e uma diferença de forma entre o que ela
         * mandou e o que o banco tem apagaria itens que ninguém pediu para
         * apagar.
         *
         * Ausente = "não mexi na lista". Presente (mesmo vazio) = "esta é a
         * lista agora", que é como a tela de montar sempre a usou.
         */
        itens: z.array(ItemSchema).max(80).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: lista } = await sb
      .from("presente_listas")
      .select("id")
      .eq("user_id", eu)
      .maybeSingle();
    if (!lista) return { ok: false as const, motivo: "sem-lista" as const };

    if (data.titulo !== undefined || data.recado !== undefined || data.dataDoCha !== undefined) {
      const { error } = await sb
        .from("presente_listas")
        .update({
          ...(data.titulo !== undefined ? { titulo: data.titulo } : {}),
          ...(data.recado !== undefined ? { recado: data.recado } : {}),
          ...(data.dataDoCha !== undefined ? { data_do_cha: data.dataDoCha || null } : {}),
        })
        .eq("id", lista.id);
      if (error) return { ok: false as const, motivo: "banco" as const };
    }

    /* ⚠️ Sem `itens`, o pedido era só do convite — a lista não é tocada. */
    if (data.itens === undefined) return { ok: true as const };

    for (const it of data.itens ?? []) {
      const linha = {
        lista_id: lista.id,
        tipo: it.tipo,
        titulo: it.titulo,
        nota: it.nota,
        ordem: it.ordem,
        tamanho: it.tamanho,
        meta: it.meta,
        teto: it.teto,
        centavos_total: it.centavosTotal,
      };
      /* ⚠️ O erro de CADA item é conferido, e o primeiro para o laço.
         Sem isso, uma lista de vinte itens em que o oitavo falha grava
         dezenove e devolve sucesso — e ela só descobre quando a amiga abre o
         link e o item não está lá. */
      const { error } = it.id
        ? await sb.from("presente_itens").update(linha).eq("id", it.id).eq("lista_id", lista.id)
        : await sb.from("presente_itens").insert(linha);
      if (error) return { ok: false as const, motivo: "banco" as const };
    }

    return { ok: true as const };
  });

/**
 * ARQUIVAR um item — nunca apagar.
 *
 * ⚠️ Apagar um item já reservado apaga a promessa de alguém e deixa o
 * agradecimento com um buraco que ninguém explica. E arquivar um item COM
 * reserva é recusado: quem prometeu merece saber antes.
 */
export const arquivarItem = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), itemId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: lista } = await sb
      .from("presente_listas")
      .select("id")
      .eq("user_id", eu)
      .maybeSingle();
    if (!lista) return { ok: false as const, motivo: "sem-lista" as const };

    /* ⚠️ **NÃO CONSEGUIR CONTAR RECUSA.** O `error` era descartado e
       `(count ?? 0) > 0` virava falso: qualquer falha de leitura ARQUIVAVA o
       item por cima de uma reserva viva — quebrando, em silêncio, a promessa
       que o comentário desta função faz três linhas acima ("quem prometeu
       merece saber antes"). A amiga que reservou o carrinho perde a reserva sem
       ninguém avisar, e a mãe fica sem o presente achando que ele foi retirado.

       ⚠️ E o motivo é PRÓPRIO: "tem-reserva" sobre uma contagem que falhou
       faria a mãe procurar uma reserva que talvez não exista. */
    const { count, error: erroDaContagem } = await sb
      .from("presente_reservas")
      .select("id", { count: "exact", head: true })
      .eq("item_id", data.itemId)
      .is("cancelada_em", null);
    if (erroDaContagem || count === null)
      return { ok: false as const, motivo: "contagem-ilegivel" as const };
    if (count > 0) return { ok: false as const, motivo: "tem-reserva" as const };

    const { error } = await sb
      .from("presente_itens")
      .update({ arquivado: true })
      .eq("id", data.itemId)
      .eq("lista_id", lista.id);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** A amiga abre o link. */
export const listaPorToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const viva = await listaViva(sb, data.token);
    if (!viva) return { ok: false as const, motivo: "indisponivel" as const };

    const itens = await itensComSaldo(sb, viva.id);

    /* ⚠️ SEM `user_id` e SEM `quem_nome`. Ver as travas 1 e 2 no cabeçalho. */
    const saida: ListaPublica = {
      titulo: viva.row.titulo ?? null,
      recado: viva.row.recado ?? null,
      dataDoCha: viva.row.data_do_cha ?? null,
      aberta: true,
      donaNome: (viva.perfil.display_name ?? "").trim() || "Ela",
      /* ⚠️ O CÓDIGO DELA, para o rodapé de convite. `codigoParaConvite` já
         devolve `null` em Modo Cuidado — e `listaViva` nem chegaria aqui nesse
         caso, mas a régua fica num lugar só de propósito. */
      /* ⚠️ `listaViva` já recusou a lista inteira em Modo Cuidado, então aqui
         basta limpar o código. Ver `convite-do-app.ts`. */
      codigoDeConvite: codigoLimpo(viva.perfil.referral_code),
      bebeNome: (viva.perfil.baby_name ?? "").trim() || null,
      itens,
    };
    return { ok: true as const, lista: saida };
  });

/** Reservar — a amiga promete o que vai dar. */
export const reservarPorToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        token: z.string().min(8).max(64),
        itemId: z.string().uuid(),
        quantidade: z.number().int().min(1).max(99),
        quemNome: z.string().max(120),
        recado: z.string().max(300).nullable(),
        revelarEm: z.string().max(10).nullable(),
        idemKey: z.string().max(64).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const viva = await listaViva(sb, data.token);
    if (!viva) return { ok: false as const, motivo: "indisponivel" as const };

    const { data: item } = await sb
      .from("presente_itens")
      .select("id, tipo, tamanho, meta, teto, centavos_total, arquivado")
      .eq("id", data.itemId)
      .eq("lista_id", viva.id)
      .maybeSingle();
    if (!item || item.arquivado) return { ok: false as const, motivo: "sem-item" as const };

    /* ⚠️ O SALDO É RELIDO AQUI, imediatamente antes de decidir. A régua pura
       responde "pode" com toda a confiança quando recebe um saldo velho, e
       duas amigas na última cota no mesmo segundo é o caso real. */
    const { data: vivas, error: erroDoSaldo } = await sb
      .from("presente_reservas")
      .select("quantidade")
      .eq("item_id", item.id)
      .is("cancelada_em", null);
    /* ⚠️ **A FALHA DESTA LEITURA NÃO PODE VIRAR "ITEM LIVRE".**
       O erro era descartado, e `vivas ?? []` fazia `jaReservado` virar ZERO —
       ou seja, a régua recebia "ninguém reservou nada" e liberava o item
       inteiro. Duas amigas comprariam o mesmo berço, e a lista diria que estava
       tudo certo para as duas.

       É a mesma forma do defeito da agenda (`doctor_blocks` não conferido, que
       oferecia horários dentro das férias): uma leitura cujo silêncio faz a
       coisa parecer MAIS disponível do que está. Toda leitura que só SUBTRAI
       disponibilidade tem de falhar fechada.

       E o próprio comentário acima já dizia por que a releitura existe — "duas
       amigas na última cota no mesmo segundo é o caso real". Ela existia e
       falhava aberta. */
    if (erroDoSaldo) return { ok: false as const, motivo: "indisponivel" as const };
    const jaReservado = ((vivas ?? []) as { quantidade: number }[]).reduce(
      (s, r) => s + (r.quantidade ?? 0),
      0,
    );

    if (item.tipo === "fralda" && item.tamanho) {
      const r = podeReservarFralda(faixaDe(item.tamanho), jaReservado, data.quantidade);
      if (!r.ok) return { ok: false as const, motivo: r.motivo, maximo: r.maximo };
    } else if (item.tipo === "cota") {
      const r = podeReservarCotas(item.meta, jaReservado, data.quantidade);
      if (!r.ok) return { ok: false as const, motivo: r.motivo, maximo: r.maximo };
    } else {
      const limite = item.teto ?? item.meta;
      const livre = Math.max(0, limite - jaReservado);
      if (data.quantidade > livre) {
        return { ok: false as const, motivo: "acima-do-teto" as const, maximo: livre };
      }
    }

    const tokenReserva = novoToken();
    /* `idem_key` sanitizada pela MESMA régua do token de presente: ela entra
       numa chave e um valor forjado com dois-pontos deslocaria o parser. */
    const idem = (data.idemKey ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || null;

    const { data: gravada, error } = await sb
      .from("presente_reservas")
      .insert({
        item_id: item.id,
        lista_id: viva.id,
        quem_nome: sanitizarNomeDeQuemDeu(data.quemNome),
        token_reserva: tokenReserva,
        quantidade: data.quantidade,
        recado: data.recado,
        revelar_em: data.revelarEm || null,
        idem_key: idem,
      })
      .select("id, token_reserva")
      .single();

    if (error) {
      /* ⚠️ Colidir na `idem_key` é SUCESSO REPETIDO, não erro. Devolver falha
         aqui faria a amiga tentar de novo, com chave nova, e aí sim reservar
         duas vezes — a mesma lição do presente do médico. */
      if (String(error.code) === "23505" && idem) {
        const { data: anterior } = await sb
          .from("presente_reservas")
          .select("id, token_reserva")
          .eq("item_id", item.id)
          .eq("idem_key", idem)
          .maybeSingle();
        if (anterior) {
          return {
            ok: true as const,
            reservaId: anterior.id,
            tokenReserva: anterior.token_reserva,
            repetido: true,
          };
        }
      }
      return { ok: false as const, motivo: "banco" as const };
    }

    return {
      ok: true as const,
      reservaId: gravada.id,
      tokenReserva: gravada.token_reserva,
      repetido: false,
    };
  });

/** A amiga volta atrás. Marca, nunca apaga. */
export const cancelarReserva = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ tokenReserva: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { error } = await sb
      .from("presente_reservas")
      .update({ cancelada_em: new Date().toISOString() })
      .eq("token_reserva", data.tokenReserva)
      .is("cancelada_em", null);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/** A dona marca que já agradeceu. É a única escrita dela numa reserva. */
export const marcarAgradecida = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        reservaIds: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: lista } = await sb
      .from("presente_listas")
      .select("id")
      .eq("user_id", eu)
      .maybeSingle();
    if (!lista) return { ok: false as const, motivo: "sem-lista" as const };

    /* ⚠️ O `.eq("lista_id")` é o que impede marcar como agradecida uma reserva
       da lista de OUTRA paciente — os ids vêm do cliente. */
    const { error } = await sb
      .from("presente_reservas")
      .update({ agradecida_em: new Date().toISOString() })
      .in("id", data.reservaIds)
      .eq("lista_id", lista.id);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });
