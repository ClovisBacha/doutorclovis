/**
 * A CAIXINHA DE PERGUNTAS — o servidor.
 *
 * ⚠️ **É A FUNÇÃO MAIS ARRISCADA DA ABA**, e é a mesma razão que fechou os
 * comentários: de 1.098 respostas com conselho em fóruns de gestação, **20,9%
 * estavam erradas e 5,5% eram potencialmente danosas** — e o grupo não se
 * autocorrige (5,2% de retificação). A diferença aqui é que o texto perigoso é
 * a RESPOSTA: quem responde é uma paciente, e ela responde para todo mundo de
 * uma vez, num app que carrega o nome do consultório.
 *
 * Por isso a régua (`pergunta-clinica.ts`) roda nos DOIS textos, e não só na
 * pergunta. Uma caixinha que triasse só a entrada deixaria passar exatamente a
 * frase que motivou tudo — "comigo foi assim, não precisa ir ao
 * pronto-socorro" — porque ela nunca é a pergunta, é sempre a resposta.
 *
 * ─── ⚠️ ANONIMATO NA TELA, NUNCA NO BANCO ──────────────────────────────────
 *
 * `quem_id` é gravado sempre e devolvido nunca. A caixa ser anônima para a dona
 * é o que faz alguém perguntar; o servidor saber quem é o que permite as quatro
 * coisas que impedem a caixa de virar canal de assédio: rotear a pergunta
 * clínica para o médico DE QUEM PERGUNTOU, aplicar o teto diário, recusar quem
 * foi bloqueada, e bloquear a partir de uma pergunta.
 *
 * ─── ⚠️ E ELA NÃO PASSA POR `rede_atividade` ───────────────────────────────
 *
 * A caixa do coração tem `quem_id NOT NULL` e a tela dela RESOLVE O NOME de
 * quem fez cada gesto. Uma espécie "perguntou" ali entregaria, na primeira
 * renderização, exatamente o que a caixinha existe para não entregar. O
 * emblema da caixinha sai da contagem de não respondidas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LIMITE_DA_PERGUNTA, type DesfechoDaPergunta } from "@/lib/pergunta-clinica";
import {
  decidirPergunta,
  decidirResposta,
  recadoDaResposta,
  recadoDoVeredicto,
} from "@/lib/caixinha";
import { alcancaOPerfil } from "@/lib/selo-do-perfil";
import { LIMITE_DO_TEXTO } from "@/lib/rede-social";
import { FUSO_DA_CLINICA } from "@/lib/disponibilidade";

export type PerguntaNaCaixa = {
  id: string;
  texto: string;
  criadoEm: string;
  /** A resposta dela, quando já respondeu. */
  resposta: string | null;
  /** O post que a resposta virou — para a tela levar até ele. */
  postId: string | null;
  denunciada: boolean;
  /* ⚠️ Não há `quem`, `quemId`, `autor` nem `avatar`. Ver o cabeçalho. */
};

async function pacienteDaSessao(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(accessToken);
  return data.user?.id ?? null;
}

/**
 * Meia-noite de hoje no fuso da clínica, em ISO — a janela do teto diário.
 *
 * ⚠️ **Pelo `Intl`, e nunca por `-3h` cravado.** A primeira versão subtraía três
 * horas na mão: funciona hoje e vira a QUINTA grafia da mesma ideia num repo em
 * que `conquistas.ts`, `cota-ia.server.ts`, `desafio-em-grupo.functions.ts` e
 * `clinical.functions.ts` já usam `America/Sao_Paulo` explícito. O offset do
 * Brasil já foi -2 (horário de verão até 2019) e volta a ser discutido — no dia
 * em que voltar, quatro arquivos acertam e um erra por uma hora, em silêncio.
 *
 * O fuso sai de `FUSO_DA_CLINICA`, que já existe: uma string repetida é uma
 * string que um dia diverge.
 */
function inicioDoDia(): string {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_CLINICA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  /* O deslocamento do fuso NAQUELE dia, e não um número fixo: é ele que
     transforma a meia-noite local no instante UTC que o `gte` compara. */
  const meiaNoiteUTC = new Date(`${dia}T00:00:00Z`).getTime();
  const desloc = new Date(`${dia}T00:00:00Z`).toLocaleString("en-US", {
    timeZone: FUSO_DA_CLINICA,
    hour12: false,
    hour: "2-digit",
  });
  /* `desloc` é a hora local correspondente a 00:00Z. Se for 21, o fuso está
     3 h atrás e a meia-noite local acontece 3 h DEPOIS de 00:00Z. */
  const h = Number(desloc) % 24;
  const atraso = h === 0 ? 0 : 24 - h;
  return new Date(meiaNoiteUTC + atraso * 3600_000).toISOString();
}

/**
 * A CAIXA DELA.
 *
 * ⚠️ O `select` NÃO pede `quem_id`. Pedir a coluna e descartá-la no `.map()`
 * funcionaria hoje e falharia no dia em que alguém devolvesse a linha inteira
 * por conveniência — o defeito que `listUnansweredQuestions` documenta ao lado.
 * O que não é lido não vaza.
 */
export const minhaCaixinha = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: perfil } = await sb
      .from("patient_profiles")
      .select("aceita_perguntas, care_mode")
      .eq("id", eu)
      .maybeSingle();

    /* ⚠️ Modo Cuidado: a caixa não existe, e a tela não conta por quê. Ela
       volta inteira quando o modo sair — nada é apagado. */
    if ((perfil as any)?.care_mode) {
      return { ok: true as const, aceita: false, perguntas: [] as PerguntaNaCaixa[], novas: 0 };
    }

    const { data: linhas, error } = await sb
      .from("rede_perguntas")
      .select("id, texto, criado_em, resposta, post_id, denunciado_em")
      .eq("dona_id", eu)
      .is("arquivado_em", null)
      .order("criado_em", { ascending: false })
      .limit(100);

    /* ⚠️ Falhar ao LER não pode virar "não tem pergunta". A caixa vazia é a
       tela que ela lê como "ninguém me perguntou nada", e é a conclusão errada
       para tirar de um timeout. Mesma régua de `chavesResgatadas`. */
    if (error) {
      console.error("[caixinha] leitura falhou — rode APLICAR_REDE_SOCIAL.sql");
      return { ok: false as const, motivo: "banco" as const };
    }

    const perguntas: PerguntaNaCaixa[] = ((linhas ?? []) as any[]).map((l) => ({
      id: l.id,
      texto: l.texto,
      criadoEm: l.criado_em,
      resposta: l.resposta ?? null,
      postId: l.post_id ?? null,
      denunciada: !!l.denunciado_em,
    }));

    return {
      ok: true as const,
      aceita: !!(perfil as any)?.aceita_perguntas,
      perguntas,
      novas: perguntas.filter((p) => !p.resposta).length,
    };
  });

/**
 * PERGUNTAR.
 *
 * ⚠️ **Só o `publicavel` vira linha na caixa.** As outras duas saem daqui por
 * canais que já existem e são melhores:
 *
 *  · **emergência** → a Central de Emergência, que avisa o médico e o contato
 *    dela com localização. Ninguém responde "estou sangrando" com um
 *    coraçãozinho, e deixar essa frase esperando a boa vontade de outra
 *    paciente é o pior desfecho possível desta tela.
 *  · **clínica** → `doctor_questions`, com o `doctor_id` de QUEM PERGUNTOU.
 *    ⚠️ Nunca o da dona da caixa: a pergunta é sobre o corpo de quem escreveu,
 *    e mandá-la ao obstetra de outra pessoa é entregar dado de saúde a um
 *    médico que não a acompanha.
 */
export const perguntar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        donaId: z.string().uuid(),
        texto: z.string().min(1).max(LIMITE_DA_PERGUNTA),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const texto = data.texto.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* ⚠️ Tudo conferido no SERVIDOR: o botão some da tela, e um pedido montado
       à mão não passa pela tela. */
    const { data: dona } = await sb
      .from("patient_profiles")
      .select("aceita_perguntas, care_mode, perfil_publico")
      .eq("id", data.donaId)
      .maybeSingle();

    /* ⚠️ O bloqueio vale nos DOIS sentidos, como em `contextoDe`. */
    const { data: bloqueios, error: erroBloqueio } = await sb
      .from("rede_bloqueios")
      .select("quem_id")
      .or(
        `and(quem_id.eq.${eu},bloqueado_id.eq.${data.donaId}),` +
          `and(quem_id.eq.${data.donaId},bloqueado_id.eq.${eu})`,
      );
    /* ⚠️ Falha de leitura conta como BLOQUEADAS — mesma direção do
       `conjuntoDeBloqueio`. Numa caixa anônima, errar para o lado de aceitar é
       derrubar a única defesa que a dona tem. */
    const bloqueadas = !!erroBloqueio || (bloqueios ?? []).length > 0;

    /* O alcance é a MESMA régua de `verPerfil`. */
    const [sigo, amiga] = await Promise.all([
      sb
        .from("rede_seguidores")
        .select("estado")
        .eq("seguidor_id", eu)
        .eq("seguido_id", data.donaId)
        .maybeSingle(),
      (async () => {
        try {
          const { saoAmigas } = await import("@/lib/amigas.functions");
          return await saoAmigas(sb, eu, data.donaId);
        } catch {
          /* Sem o grafo, `amigas` fecha em vez de abrir. */
          return false;
        }
      })(),
    ]);

    const desde = inicioDoDia();
    const [{ count: hoje }, { count: paraEla }] = await Promise.all([
      sb
        .from("rede_perguntas")
        .select("id", { count: "exact", head: true })
        .eq("quem_id", eu)
        .gte("criado_em", desde),
      sb
        .from("rede_perguntas")
        .select("id", { count: "exact", head: true })
        .eq("quem_id", eu)
        .eq("dona_id", data.donaId)
        .gte("criado_em", desde),
    ]);

    const veredicto = decidirPergunta(
      {
        souADona: eu === data.donaId,
        donaExiste: !!dona,
        donaEmCuidado: !!(dona as any)?.care_mode,
        donaAceita: !!(dona as any)?.aceita_perguntas,
        alcancoOPerfil: alcancaOPerfil({
          perfilPublico: !!(dona as any)?.perfil_publico,
          souEu: false,
          sigoAtivo: ((sigo as any)?.data?.estado ?? null) === "ativo",
          somosAmigas: !!amiga,
        }),
        bloqueadas,
        mandeiHoje: hoje ?? 0,
        mandeiParaElaHoje: paraEla ?? 0,
      },
      texto,
    );

    if (!veredicto.pode) {
      return { ok: false as const, motivo: veredicto.motivo, recado: recadoDoVeredicto(veredicto) };
    }

    const recado = recadoDoVeredicto(veredicto);

    /* ⚠️ **TODA tentativa vira linha**, inclusive as que não chegam à caixa.
       Antes, `emergencia` não gravava NADA: o app detectava uma bandeira
       vermelha, mostrava um botão, e se ela fechasse a folha não sobrava
       registro nenhum de que a frase existiu. A hierarquia estava invertida —
       `publicavel` persistia, `clinica` persistia, e o mais grave dos três era o
       único volátil.
       ⚠️ E as duas não-publicáveis nascem ARQUIVADAS: a linha existe para o teto
       e para quem for investigar, e a dona da caixa nunca a vê. */
    const naCaixa = veredicto.desfecho === "publicavel";
    const agora = new Date().toISOString();
    const { error } = await sb.from("rede_perguntas").insert({
      dona_id: data.donaId,
      quem_id: eu,
      texto,
      desfecho: veredicto.desfecho,
      arquivado_em: naCaixa ? null : agora,
    });
    if (error && naCaixa) return { ok: false as const, motivo: "banco" as const };

    if (!naCaixa) {
      /* O médico DE QUEM PERGUNTOU. ⚠️ Nunca o da dona da caixa: a pergunta é
         sobre o corpo de quem escreveu, e mandá-la ao obstetra de outra pessoa é
         entregar dado de saúde a um médico que não a acompanha. */
      const { data: meu } = await sb
        .from("patient_profiles")
        .select("doctor_id")
        .eq("id", eu)
        .maybeSingle();
      const marca = veredicto.desfecho === "emergencia" ? "🚨 " : "";
      const { error: erroFila } = await sb.from("doctor_questions").insert({
        user_id: eu,
        question: `${marca}${texto}`,
        doctor_id: (meu as any)?.doctor_id ?? null,
      });
      /* ⚠️ Falhar aqui é ERRO na tela, e não um "enviado 💛" mentiroso: ela
         acabou de escrever uma dúvida clínica e precisa saber que ninguém a
         recebeu. */
      if (erroFila) return { ok: false as const, motivo: "banco" as const };
    }

    return { ok: true as const, desfecho: veredicto.desfecho, recado };
  });

/**
 * RESPONDER — e a resposta vira post.
 *
 * ⚠️ **A régua roda de novo, agora na RESPOSTA.** É este o texto perigoso: a
 * pergunta é de quem não sabe, a resposta é de quem afirma. Uma caixinha que
 * triasse só a entrada publicaria "no seu lugar eu esperava" com o nome do
 * consultório em volta.
 *
 * ⚠️ **A resposta é PÚBLICA por natureza** (na camada que ela escolher). Uma
 * resposta privada exigiria uma tela de entrega do lado de quem perguntou — e a
 * caixa é anônima justamente para não ter esse lado.
 */
export const responderPergunta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        perguntaId: z.string().uuid(),
        resposta: z.string().min(1).max(LIMITE_DO_TEXTO),
        visibilidade: z.enum(["publico", "seguidores", "amigas"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const resposta = data.resposta.trim();

    const [meu, { data: pergunta }] = await Promise.all([
      /* ⚠️ Falha de leitura conta como EM CUIDADO — o portão que falha aberto é
         o mesmo que não existir. */
      (async () => {
        const { data, error } = await sb
          .from("patient_profiles")
          .select("care_mode")
          .eq("id", eu)
          .maybeSingle();
        return { care_mode: error ? true : !!(data as any)?.care_mode };
      })(),
      /* ⚠️ O recorte por dona vem na LEITURA, e não só no `update` do fim: sem
         ele, a pergunta anônima de outra mulher era lida e o texto dela ia para
         o feed dentro do post desta paciente. */
      sb
        .from("rede_perguntas")
        .select("id, texto, resposta, arquivado_em, dona_id")
        .eq("id", data.perguntaId)
        .maybeSingle(),
    ]);

    const veredicto = decidirResposta(
      {
        souADona: !!pergunta && (pergunta as any).dona_id === eu,
        euEmCuidado: !!(meu as any)?.care_mode,
        perguntaExiste: !!pergunta,
        jaRespondida: !!(pergunta as any)?.resposta,
        arquivada: !!(pergunta as any)?.arquivado_em,
      },
      resposta,
    );
    if (!veredicto.pode) {
      return { ok: false as const, motivo: veredicto.motivo, recado: recadoDaResposta(veredicto) };
    }

    const { data: post, error: erroPost } = await sb
      .from("rede_posts")
      .insert({
        autor_id: eu,
        texto: resposta,
        visibilidade: data.visibilidade,
        pergunta: (pergunta as any).texto,
      })
      .select("id")
      .single();

    /* ⚠️ Recuo para banco sem `pergunta`, como em `publicarPost`: o deploy chega
       antes do SQL. A pergunta entra CITADA no próprio texto — perdê-la deixaria
       uma resposta solta que ninguém entende. */
    let postId: string | null = post?.id ?? null;
    if (erroPost || !postId) {
      console.warn("[caixinha] post sem `pergunta` — rode APLICAR_REDE_SOCIAL.sql");
      const { data: p2, error: erro2 } = await sb
        .from("rede_posts")
        .insert({
          autor_id: eu,
          texto: `“${(pergunta as any).texto}”\n\n${resposta}`,
          visibilidade: data.visibilidade,
        })
        .select("id")
        .single();
      if (erro2 || !p2) return { ok: false as const, motivo: "banco" as const };
      postId = p2.id;
    }

    /* ⚠️ A marcação vem DEPOIS do post existir. Marcar antes deixaria a pergunta
       fora da caixa com a resposta em lugar nenhum — e a caixa é anônima, então
       não haveria a quem perguntar o que houve. */
    const { error } = await sb
      .from("rede_perguntas")
      .update({ resposta, post_id: postId, respondido_em: new Date().toISOString() })
      .eq("id", data.perguntaId)
      .eq("dona_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };

    return { ok: true as const, postId };
  });

/** Sair da caixa sem responder. Marca, nunca apaga — a denúncia precisa da linha. */
export const arquivarPergunta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), perguntaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("rede_perguntas")
      .update({ arquivado_em: new Date().toISOString() })
      .eq("id", data.perguntaId)
      .eq("dona_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });

/**
 * DENUNCIAR — e, se ela quiser, bloquear quem escreveu.
 *
 * ⚠️ **É a única forma de a dona se defender de uma caixa anônima**, e por isso
 * o bloqueio acontece aqui dentro: pedir que ela "descubra quem foi e bloqueie
 * no perfil" é pedir o impossível, e sem esta porta a anonimidade viraria
 * impunidade.
 *
 * ⚠️ **E ela continua sem saber quem é.** O servidor resolve `quem_id`,
 * bloqueia, e devolve `ok` — nenhum nome, nenhuma inicial, nenhuma foto. Contar
 * quem foi transformaria a proteção num confronto entre duas pessoas que
 * provavelmente se conhecem da vida real; é a mesma decisão que já tornou o
 * bloqueio da rede calado dos dois lados.
 */
export const denunciarPergunta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        perguntaId: z.string().uuid(),
        bloquear: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const eu = await pacienteDaSessao(data.accessToken);
    if (!eu) return { ok: false as const, motivo: "sessao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    /* `quem_id` é lido AQUI e só aqui — é o único ponto do módulo que precisa
       dele, e ele não sai desta função. */
    const { data: linha } = await sb
      .from("rede_perguntas")
      .select("id, quem_id")
      .eq("id", data.perguntaId)
      .eq("dona_id", eu)
      .maybeSingle();
    if (!linha) return { ok: false as const, motivo: "indisponivel" as const };

    const agora = new Date().toISOString();
    const { error } = await sb
      .from("rede_perguntas")
      .update({ denunciado_em: agora, arquivado_em: agora })
      .eq("id", data.perguntaId)
      .eq("dona_id", eu);
    if (error) return { ok: false as const, motivo: "banco" as const };

    if (data.bloquear) {
      /* ⚠️ Mesma ORDEM de `bloquear`: desfaz o seguir ANTES de gravar o
         bloqueio, para o estado intermediário ruim ser o inofensivo. */
      await sb
        .from("rede_seguidores")
        .delete()
        .or(
          `and(seguidor_id.eq.${eu},seguido_id.eq.${(linha as any).quem_id}),` +
            `and(seguidor_id.eq.${(linha as any).quem_id},seguido_id.eq.${eu})`,
        );
      const { error: erroBloqueio } = await sb
        .from("rede_bloqueios")
        .upsert(
          { quem_id: eu, bloqueado_id: (linha as any).quem_id },
          { onConflict: "quem_id,bloqueado_id" },
        );
      /* A denúncia já foi gravada; falhar o bloqueio é o gesto MENOR falhando,
         e ela vê o erro. Nunca o contrário. */
      if (erroBloqueio) return { ok: false as const, motivo: "bloqueio" as const };
    }

    return { ok: true as const };
  });

/* ══════════════════════════════════════════════════════════════════════════
   A FILA DE DENÚNCIAS — o lado que LÊ
   ══════════════════════════════════════════════════════════════════════════ */

export type DenunciaNaFila = {
  id: string;
  texto: string;
  quando: string;
  /** Quantas denúncias já pesam sobre quem escreveu esta. */
  reincidencias: number;
};

/**
 * ⚠️ **ESTA FUNÇÃO EXISTE PORQUE A TELA JÁ PROMETIA O QUE ELA FAZ.**
 *
 * `denunciarPergunta` gravava `denunciado_em` desde o primeiro dia, e uma
 * varredura do `src/` inteiro não achou NENHUMA consulta que lesse a coluna.
 * Enquanto isso a folha de confirmação dizia, com todas as letras: *"Ela sai da
 * sua caixa e fica registrada para a gente olhar."*
 *
 * Era o par mais perigoso do recurso — denúncia que não chega + bloqueio cego.
 * A paciente denuncia, acredita que alguém do consultório vai ver, ninguém vê, e
 * a pessoa cria outra conta e volta amanhã. Ou a promessa sai da tela, ou o
 * leitor existe; a promessa é a parte certa.
 *
 * ⚠️ **O `quem_id` NÃO sai daqui tampouco.** Nem para o administrador: o que
 * ele precisa para agir é o TEXTO e a REINCIDÊNCIA ("três denúncias da mesma
 * conta"), e um id na tela vira um nome na primeira vez que alguém o colar numa
 * consulta. O que ele decidir fazer com a conta é decisão de plataforma, tomada
 * com o dado na mão do servidor — não na tela.
 */
export const denunciasAbertas = createServerFn({ method: "POST" })
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
    const { data: linhas, error } = await sb
      .from("rede_perguntas")
      .select("id, texto, denunciado_em, quem_id")
      .not("denunciado_em", "is", null)
      .is("resolvido_em", null)
      .order("denunciado_em", { ascending: false })
      .limit(100);
    /* ⚠️ Falhar ao ler não vira "nenhuma denúncia": é a mesma régua de
       `listUnansweredQuestions` — o administrador leria "está tudo limpo"
       durante um erro de banco. */
    if (error) return { ok: false as const, motivo: "banco" as const };

    const brutas = (linhas ?? []) as {
      id: string;
      texto: string;
      denunciado_em: string;
      quem_id: string;
    }[];
    /* A reincidência é contada AQUI e o id morre nesta função. */
    const porAutor = new Map<string, number>();
    for (const l of brutas) porAutor.set(l.quem_id, (porAutor.get(l.quem_id) ?? 0) + 1);

    return {
      ok: true as const,
      fila: brutas.map((l) => ({
        id: l.id,
        texto: l.texto,
        quando: l.denunciado_em,
        reincidencias: porAutor.get(l.quem_id) ?? 1,
      })) satisfies DenunciaNaFila[],
    };
  });

/** Marca uma denúncia como olhada. Não apaga — o histórico é a reincidência. */
export const resolverDenuncia = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), perguntaId: z.string().uuid() }).parse(i),
  )
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
    const { error } = await (supabaseAdmin as any)
      .from("rede_perguntas")
      .update({ resolvido_em: new Date().toISOString() })
      .eq("id", data.perguntaId);
    if (error) return { ok: false as const, motivo: "banco" as const };
    return { ok: true as const };
  });
