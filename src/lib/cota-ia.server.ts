/**
 * A cota de respostas da IA por médico.
 *
 * ─── DOIS LIVROS-CAIXA QUE NUNCA SE TOCAM ───────────────────────────────────
 *
 * O do Google é UM, da plataforma inteira, medido em TOKENS, e quem paga é a
 * Obstétrica. Ele não sabe que existem médicos: a chave da API é uma só, e
 * qualquer limite lá seria global — quando estourasse, cortaria todos ao mesmo
 * tempo, inclusive quem nem usou. O papel do Google é teto de catástrofe (um
 * alerta de orçamento contra laço infinito ou abuso), nunca controle de plano.
 *
 * O do plano é POR MÉDICO, medido em MENSAGENS, e quem paga é ele.
 *
 * A ponte entre os dois é `ai_usage`: toda chamada grava `doctor_id` E os
 * tokens. É de lá que sai a conversão de "340 respostas" para "R$ tanto", e é
 * ela que revela a margem real de cada plano.
 *
 * ─── O QUE ACONTECE AO ESTOURAR ─────────────────────────────────────────────
 *
 * A paciente NUNCA bate numa parede. O que ela perde é o Segundo Cérebro do
 * médico — a parte cara e diferenciada — e continua recebendo informação
 * obstétrica consolidada, com a dúvida indo para a fila dele do mesmo jeito.
 *
 * Bloquear a resposta seria transferir para a gestante a consequência de um
 * limite que não é dela e que ela não pode resolver.
 */

/** Onde a régua muda de cor. 80% é aviso; 100% desliga o cérebro do médico. */
export const AVISO_EM = 0.8;

export type SituacaoDaCota = {
  usadas: number;
  /** `null` = ilimitado (contrato sob medida). */
  teto: number | null;
  /** 0 a 1+; `0` quando o teto é ilimitado (não há fração de infinito). */
  fracao: number;
  estado: "ok" | "aviso" | "estourada";
  /**
   * A contagem foi ZERO porque não deu para medir?
   *
   * `respostasNoCiclo` devolve 0 em qualquer falha — o que está certo (na
   * dúvida o médico é atendido) e fazia "não consegui medir" e "você não usou
   * nada" produzirem a MESMA tela. Com a migration pendente, o médico lia
   * "nenhuma resposta ainda neste ciclo" enquanto as pacientes conversavam.
   */
  falha?: "rede" | "migracao" | null;
};

/**
 * Início do ciclo atual.
 *
 * Mês-calendário, e isso é uma escolha com trade-off honesto: quem assina dia
 * 20 ganha um primeiro ciclo curto. O certo seria ancorar no aniversário da
 * assinatura, e é para lá que isto vai quando a cobrança recorrente estiver
 * fechada — mas amarrar agora numa data que ainda não existe no banco seria
 * inventar complexidade antes do problema.
 */
export function inicioDoCiclo(agora = new Date()): Date {
  /* NO FUSO DE BRASÍLIA, não no do processo.
     `new Date(ano, mês, 1)` monta a data no fuso de quem roda — e a Vercel roda
     em UTC. O ciclo virava às 21h do último dia do mês: três horas de respostas
     caíam no mês errado, e o médico via a cota zerar antes da meia-noite dele.
     O resto do repo já usa `America/Sao_Paulo` explícito; este arquivo tinha
     ficado de fora, e `src/test-setup.ts` força TZ=America/Sao_Paulo — ou seja,
     os testes passavam sempre e jamais pegariam isto. */
  const emSP = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const parte = (t: string) => Number(emSP.find((p) => p.type === t)?.value ?? 0);
  /* Meia-noite de Brasília do dia 1 é 03:00 UTC (UTC−3). O Brasil não tem
     horário de verão desde 2019; se voltar, esta conta precisa do offset real
     do dia, não de uma constante. */
  return new Date(Date.UTC(parte("year"), parte("month") - 1, 1, 3, 0, 0));
}

/**
 * Quantas RESPOSTAS a IA deu para as pacientes deste médico no ciclo.
 *
 * Conta `especie = 'chat'` — não `memoria` nem `embedding`. As três custam
 * dinheiro e as três estão medidas, mas o que se VENDE é a resposta: cobrar do
 * médico um resumo de memória que ele não pediu e não vê seria vender uma
 * unidade que ele não consegue conferir.
 *
 * `head: true` traz só o número, sem as linhas — isto roda a cada mensagem.
 */
/**
 * ─── A COTA CONTA UM CANAL SÓ ───────────────────────────────────────────────
 *
 * O portão que interrompe as respostas do cérebro vive em `getBrainContext`, e
 * ele protege os chats CLÍNICOS da paciente dentro do app: o chat principal
 * (`app`) e o de nutrição (`nutricao`). A cota conta exatamente o que esse
 * portão consegue parar — nada mais.
 *
 * A nutrição entrou nesta lista quando entrou no ciclo do cérebro. Ela é a
 * mesma coisa que o chat principal do ponto de vista do que importa aqui: IA
 * respondendo à paciente DELE, com as orientações DELE, sobre um assunto
 * clínico. Deixá-la de fora seria uma segunda porta de entrada que não custa
 * franquia nenhuma — e ninguém teria escolhido isso de propósito.
 *
 * ─── POR QUE ERA UMA LISTA DE EXCLUSÕES, E POR QUE ISSO ERRAVA ──────────────
 *
 * Antes o recorte era `.neq("canal","suporte").neq("canal","teste")…`: contava
 * TUDO menos o que estivesse na lista. Ou seja, todo canal novo entrava na cota
 * do médico por omissão — sem ninguém decidir, sem aparecer em revisão.
 *
 * E aconteceu. Uma trava mecânica encontrou OITO chamadas pagas de modelo que
 * ninguém media (agenda do WhatsApp, triagem de sintomas, carta semanal, busca
 * de médicos, teleconsulta, conselheiro, nutrição, rascunho do cérebro).
 * Passar a medi-las com a régua antiga faria a franquia de dúvidas clínicas da
 * gestante ser consumida por uma busca de médico ou uma carta do bebê — e a
 * paciente ficaria sem resposta clínica por causa disso.
 *
 * Invertido, o erro fica impossível por construção: quem quiser que um canal
 * novo conte precisa dizer isso aqui, de propósito.
 *
 * O consumo — o que custa dinheiro — continua medindo TODOS os canais. São
 * perguntas diferentes: "quanto isto gasta" e "quanto do plano dele já foi".
 */
export const CANAIS_DA_COTA = ["app", "nutricao"] as const;

export function aplicarRecorteDaCota<T>(q: T): T {
  const query = q as unknown as { in: (c: string, v: readonly string[]) => unknown };
  return query.in("canal", CANAIS_DA_COTA) as T;
}

export async function respostasNoCiclo(doctorId: string, agora = new Date()): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await aplicarRecorteDaCota(
      (supabaseAdmin as any)
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .eq("especie", "chat"),
    ).gte("created_at", inicioDoCiclo(agora).toISOString());
    /* Tabela ausente ou falha de rede → 0, ou seja, NÃO estoura.
       Na dúvida o médico é atendido: uma cota que se fecha sozinha por um
       soluço de banco tiraria o cérebro dele do ar sem ele ter feito nada. */
    if (error) {
      /* O MOTIVO SOBE JUNTO. Devolver 0 está certo (na dúvida o médico é
         atendido) — mas devolver 0 CALADO faz "não consegui medir" e "você não
         usou nada" produzirem a mesma tela, e é o médico com a migration
         pendente que lê "nenhuma resposta ainda" enquanto as pacientes
         conversam. `42P01` é tabela ausente; o resto é rede. */
      ultimaFalha = (error as { code?: string })?.code === "42P01" ? "migracao" : "rede";
      return 0;
    }
    ultimaFalha = null;
    return typeof count === "number" ? count : 0;
  } catch {
    ultimaFalha = "rede";
    return 0;
  }
}

/**
 * Por que a última contagem foi zero — se é que foi por falha.
 *
 * Módulo-escopo em vez de retorno composto porque `respostasNoCiclo` é chamada
 * de quatro lugares e só um deles (a tela) precisa do motivo; mudar a
 * assinatura obrigaria os outros três a carregar um campo que ignoram.
 */
let ultimaFalha: "rede" | "migracao" | null = null;
export function motivoDaUltimaContagem(): "rede" | "migracao" | null {
  return ultimaFalha;
}

/** Junta consumo e teto numa decisão. Puro — o teste não precisa de banco. */
export function situacaoDaCota(usadas: number, teto: number | null): SituacaoDaCota {
  if (teto === null) return { usadas, teto, fracao: 0, estado: "ok" };
  /* Teto zero é plano SEM IA, e aí não há o que estourar: quem barra é o
     entitlement (`aiApp`), muito antes daqui. Tratar como "estourada" faria a
     mensagem errada aparecer no painel de quem nunca teve o recurso. */
  if (teto <= 0) return { usadas, teto, fracao: 0, estado: "ok" };
  const fracao = usadas / teto;
  return {
    usadas,
    teto,
    fracao,
    estado: usadas >= teto ? "estourada" : fracao >= AVISO_EM ? "aviso" : "ok",
  };
}

/** Consulta o consumo e devolve a situação. Nunca lança. */
export async function cotaDoMedico(
  doctorId: string,
  teto: number | null,
  agora = new Date(),
): Promise<SituacaoDaCota> {
  /* TETO ZERO é plano sem IA: não há consumo porque não há recurso. Sai antes
     de consultar o banco, e isso está certo. */
  if (teto !== null && teto <= 0) return situacaoDaCota(0, teto);
  /* TETO NULO é plano ILIMITADO — e ilimitado não quer dizer INVISÍVEL.
     Este ramo também devolvia `usadas: 0` sem consultar nada, então o card de
     consumo (que exige `usadas > 0`) nunca aparecia: justamente o cliente que
     paga contrato aberto era o único que não enxergava o próprio uso. E o
     teste que deveria pegar isso só procurava a string "plano sem limite" no
     arquivo — passava por cima de um ramo inalcançável. */
  const usadas = await respostasNoCiclo(doctorId, agora);
  return { ...situacaoDaCota(usadas, teto), falha: motivoDaUltimaContagem() };
}

/** Uma paciente na lista de quem mais consome. */
export type ConsumoDaPaciente = {
  patientId: string;
  nome: string;
  respostas: number;
  /** Fatia do consumo TOTAL do médico no ciclo, de 0 a 1. */
  fatia: number;
};

/**
 * Quem está consumindo o plano do médico.
 *
 * O total já aparece no painel; isto responde a pergunta seguinte, que é a que
 * ele realmente faz: *quem*. Numa fila de cinquenta gestantes, três costumam
 * responder por metade das conversas — e saber quais são muda o que ele faz.
 * Pode ser uma paciente ansiosa que precisa de uma consulta, ou uma dúvida
 * recorrente que vale virar entrada do cérebro.
 *
 * Nome vem de `patient_profiles`; sem nome, um rótulo neutro. O que NÃO se faz
 * aqui é mostrar o conteúdo das conversas: o médico vê quanto, não o quê.
 */
export async function consumoPorPaciente(
  doctorId: string,
  agora = new Date(),
  limite = 6,
): Promise<{ total: number; pacientes: ConsumoDaPaciente[] }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await aplicarRecorteDaCota(
      sb.from("ai_usage").select("patient_id").eq("doctor_id", doctorId).eq("especie", "chat"),
    )
      .gte("created_at", inicioDoCiclo(agora).toISOString())
      /* Teto de leitura: a agregação acontece aqui, não no banco, porque o
         PostgREST não faz GROUP BY. Com milhares de linhas isto viraria uma
         view materializada — mas otimizar antes de existir o problema é
         inventar complexidade.
         O `order` NÃO é enfeite: sem ele o PostgREST não garante ordem nenhuma,
         então acima de 5000 respostas no mês o "quem mais conversou" era
         calculado sobre uma amostra ARBITRÁRIA — e o médico não tinha como
         saber que estava lendo um recorte aleatório do próprio mês. */
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error || !Array.isArray(data)) return { total: 0, pacientes: [] };

    const porPaciente = new Map<string, number>();
    for (const linha of data as { patient_id: string | null }[]) {
      if (!linha.patient_id) continue;
      porPaciente.set(linha.patient_id, (porPaciente.get(linha.patient_id) ?? 0) + 1);
    }
    const total = data.length;
    if (!porPaciente.size) return { total, pacientes: [] };

    const topo = [...porPaciente.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite);
    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id,display_name")
      .in(
        "id",
        topo.map(([id]) => id),
      );
    const nomes = new Map<string, string>(
      ((perfis ?? []) as { id: string; display_name: string | null }[]).map((p) => [
        p.id,
        p.display_name ?? "",
      ]),
    );

    return {
      total,
      pacientes: topo.map(([id, respostas]) => ({
        patientId: id,
        nome: nomes.get(id)?.trim() || "Paciente",
        respostas,
        fatia: total > 0 ? respostas / total : 0,
      })),
    };
  } catch {
    return { total: 0, pacientes: [] };
  }
}

/**
 * AVISAR O MÉDICO — porque hoje ele descobre pela paciente.
 *
 * `cotaDoMedico` era lida em três lugares e nenhum deles falava com ele: o
 * portão do chat, o 👎 e o card do painel. Ou seja, o único jeito de saber que
 * a cota estourou era abrir o painel por conta própria — ou receber a mensagem
 * de uma gestante dizendo que "a IA está estranha".
 *
 * Dois momentos, e só uma vez cada um por ciclo:
 *
 *   80%  → dá para agir com antecedência (subir de plano, ou só saber).
 *   100% → as pacientes já estão recebendo resposta sem a voz dele.
 *
 * A marca de "já avisei" mora em `ai_usage`, na tabela que já existe, como uma
 * linha de espécie própria: criar uma coluna nova em `doctors` exigiria mais
 * uma migration pendente, e este arquivo inteiro já degrada com elegância
 * quando o banco está atrás.
 *
 * Nunca lança e nunca bloqueia: é chamado de dentro do caminho da resposta da
 * paciente, e um e-mail não pode atrasar uma conversa.
 */
export async function avisarMedicoDaCota(
  doctorId: string,
  situacao: SituacaoDaCota,
  agora = new Date(),
): Promise<void> {
  if (situacao.teto === null || situacao.teto <= 0) return;
  const marco =
    situacao.estado === "estourada" ? "cota-100" : situacao.estado === "aviso" ? "cota-80" : null;
  if (!marco) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    /* Uma vez por ciclo, por marco. Sem esta guarda, cada mensagem de cada
       paciente dispararia um e-mail a partir dos 80% — e o médico aprenderia a
       ignorar o aviso justamente antes de ele importar. */
    const { count } = await sb
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      /* `especie` fica em "chat" e o marco vai no CANAL.
         Eu tinha inventado `especie: "aviso"` — e `ai_usage` tem
         `CHECK (especie IN ('chat','memoria','embedding'))`. O insert falhava
         com 23514, o `if (error) return` engolia, e o aviso ao médico NUNCA
         saía: uma função inteira escrita para o defeito que o docstring dela
         descreve ("hoje ele descobre pela paciente"), morta na primeira linha.
         `canal` não tem CHECK, e `respostasNoCiclo` já exclui os canais que
         não são conversa — então a marca não contamina a contagem. */
      .eq("especie", "chat")
      .eq("canal", marco)
      .gte("created_at", inicioDoCiclo(agora).toISOString());
    if (typeof count === "number" && count > 0) return;

    const { error } = await sb.from("ai_usage").insert({
      doctor_id: doctorId,
      especie: "chat",
      canal: marco,
      modelo: "-",
      input_tokens: 0,
      output_tokens: 0,
    });
    /* Se a marca não gravou, NÃO manda: melhor um aviso perdido que um e-mail
       por mensagem de paciente. */
    if (error) return;

    const [{ avisarMedico }, { sendEmail, emailLayout }] = await Promise.all([
      import("./doctor-mail.server"),
      import("./email.server"),
    ]);
    const destino = await avisarMedico(doctorId);
    if (!destino.para.length) return;

    const estourou = situacao.estado === "estourada";
    const corpo = estourou
      ? `<p>Suas pacientes continuam sendo atendidas pelo app, mas <strong>sem as suas orientações</strong> — a IA passou a responder com informação geral da plataforma.</p>
         <p>Você usou <strong>${situacao.usadas} de ${situacao.teto}</strong> respostas deste ciclo. Elas voltam na virada do mês, ou assim que você subir de plano.</p>`
      : `<p>Você já usou <strong>${situacao.usadas} das ${situacao.teto}</strong> respostas da IA deste mês.</p>
         <p>Quando acabar, suas pacientes continuam atendidas — porém com informação geral da plataforma, sem as suas orientações.</p>`;
    await sendEmail({
      to: destino.para.join(","),
      subject: estourou ? "Sua cota de respostas da IA acabou" : "Você já usou 80% da cota da IA",
      html: emailLayout(
        estourou ? "Cota da IA esgotada" : "80% da cota da IA",
        corpo,
        destino.marca,
      ),
    });
    try {
      const { sendPushToEmail } = await import("./push.server");
      await sendPushToEmail(destino.para[0], {
        title: estourou ? "Cota da IA esgotada" : "80% da cota da IA usada",
        body: `${situacao.usadas} de ${situacao.teto} respostas neste ciclo.`,
        url: "/painel",
      });
    } catch {
      /* sem push configurado: o e-mail já saiu */
    }
  } catch {
    /* medir e avisar são opcionais; responder à paciente não é */
  }
}
