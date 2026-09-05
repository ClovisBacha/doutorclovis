/**
 * EXPORTAR OS DADOS DA PACIENTE — a régua, sem banco.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * `conta.functions.ts` tinha `excluirMinhaConta` e `apagarMinhasConversas`, e
 * mais nada. A LGPD dá dois direitos que este app não atendia (Art. 18, II —
 * acesso; V — portabilidade), e a paciente só tinha a opção DESTRUTIVA: para
 * levar o que é dela, apagava tudo.
 *
 * Num app de saúde isso pesa mais que na média: o que ela registrou aqui é a
 * gestação inteira dela, e a única forma de tirar era perder.
 *
 * ─── A DECISÃO CENTRAL: LISTA DE PERMISSÃO, NUNCA VARREDURA ─────────────────
 *
 * ⚠️ **Um export que vaze dado de TERCEIRO é pior que não ter export.** A
 * tentação é varrer toda tabela que tenha o `user_id` dela — e essa varredura
 * um dia encontra uma tabela onde "o id dela" significa outra coisa:
 *
 *   · `presente_reservas` tem o NOME de quem deu o presente;
 *   · `rede_reacoes` tem quem reagiu ao post dela;
 *   · `rede_perguntas` tem `quem_id` — a caixinha é ANÔNIMA, e esse campo é
 *     gravado justamente para nunca ser devolvido;
 *   · `amizades` e `duplas` têm o id da outra pessoa;
 *   · `rede_denuncias` tem quem foi denunciado.
 *
 * Então cada tabela entra AQUI, à mão, com a razão escrita e com as colunas
 * que saem. Tabela nova não entra sozinha — e é assim que se quer.
 *
 * ─── A SEGUNDA LINHA: O QUE É DELA E O QUE É DO MÉDICO ──────────────────────
 *
 * ⚠️ **`consultations` entra pela METADE, e a metade é a que o produto já
 * separou.** `resumo_paciente` é o campo rotulado "O QUE ELA VAI LER", escrito
 * para ela — entra. `achados` e `conduta` são o registro profissional do
 * médico sobre ela; liberá-los por um botão automático é decisão de prontuário
 * médico, não de software, e não é minha para tomar. Ficam de fora, e a tela
 * DIZ que ficaram — omitir em silêncio seria fingir completude.
 */

/** Uma tabela no export, com a razão de estar aqui. */
export type FonteDoExport = {
  /** Nome da tabela no Postgres. */
  tabela: string;
  /** A coluna que aponta para ela. */
  coluna: string;
  /** Como o bloco aparece no arquivo. */
  chave: string;
  /** Colunas que saem. `"*"` = todas as da tabela. */
  colunas: string;
  /** Por que isto é dado DELA. Obrigatório — sem razão, não entra. */
  porque: string;
};

/**
 * ⚠️ **TODA ENTRADA TEM `porque` PREENCHIDO.** Há teste. A razão não é
 * decoração: é o que obriga quem acrescenta uma tabela a parar e perguntar se
 * o dado é mesmo só dela.
 */
export const FONTES: FonteDoExport[] = [
  {
    tabela: "patient_profiles",
    coluna: "id",
    chave: "perfil",
    colunas:
      "display_name, baby_name, phone, lmp_date, due_date, height_cm, pre_pregnancy_weight, blood_type, allergies, medications, emergency_contact, emergency_phone, care_mode, created_at",
    porque: "o cadastro que ela mesma preencheu",
  },
  {
    tabela: "journal_entries",
    coluna: "user_id",
    chave: "diario",
    colunas: "content, mood, created_at",
    porque: "o diário é o texto dela, escrito por ela",
  },
  {
    tabela: "health_logs",
    coluna: "user_id",
    chave: "registros_de_saude",
    colunas: "*",
    porque: "pressão, peso e glicemia que ela mediu em casa",
  },
  {
    tabela: "glucose_diary",
    coluna: "user_id",
    chave: "diario_de_glicemia",
    colunas: "*",
    porque: "medição dela",
  },
  {
    tabela: "kick_sessions",
    coluna: "user_id",
    chave: "movimentos_do_bebe",
    colunas: "*",
    porque: "contagem feita por ela",
  },
  {
    tabela: "contraction_logs",
    coluna: "user_id",
    chave: "contracoes",
    colunas: "*",
    porque: "cronometragem feita por ela",
  },
  {
    tabela: "checklist_items",
    coluna: "user_id",
    chave: "listas",
    colunas: "*",
    porque: "as listas que ela montou",
  },
  {
    tabela: "birth_plans",
    coluna: "user_id",
    chave: "plano_de_parto",
    colunas: "*",
    porque: "escrito por ela, e é o documento que ela mais quer levar",
  },
  {
    tabela: "baby_letters",
    coluna: "user_id",
    chave: "cartas_para_o_bebe",
    colunas: "*",
    porque: "texto dela para o filho",
  },
  {
    tabela: "baby_weights",
    coluna: "user_id",
    chave: "peso_do_bebe",
    colunas: "*",
    porque: "registro dela no pós-parto",
  },
  {
    tabela: "baby_vaccines",
    coluna: "user_id",
    chave: "vacinas_do_bebe",
    colunas: "*",
    porque: "caderneta que ela preenche",
  },
  {
    tabela: "baby_milestones",
    coluna: "user_id",
    chave: "marcos_do_bebe",
    colunas: "*",
    porque: "registro dela",
  },
  {
    tabela: "breastfeeding_logs",
    coluna: "user_id",
    chave: "amamentacao",
    colunas: "*",
    porque: "registro dela",
  },
  {
    tabela: "epds_logs",
    coluna: "user_id",
    chave: "epds",
    colunas: "*",
    porque: "rastreio que ela respondeu sobre si",
  },
  {
    tabela: "chat_messages",
    coluna: "patient_id",
    chave: "conversa_com_a_ia",
    colunas: "role, content, created_at",
    porque: "a conversa dela — e o dado mais íntimo do produto",
  },
  {
    tabela: "doctor_questions",
    coluna: "user_id",
    chave: "perguntas_ao_medico",
    colunas: "question, answer, created_at, answered_at",
    porque:
      "a pergunta é dela; a resposta foi escrita PARA ela, então acompanha — é o mesmo par que ela lê na tela",
  },
  {
    tabela: "consultations",
    coluna: "patient_id",
    chave: "resumos_de_consulta",
    /* ⚠️ Só `resumo_paciente`. Ver o cabeçalho: `achados` e `conduta` são o
       registro profissional do médico, e liberá-los por botão automático é
       decisão de prontuário, não de software. */
    colunas: "occurred_at, kind, resumo_paciente",
    porque: "o resumo escrito PARA ela — o campo rotulado 'o que ela vai ler'",
  },
  {
    tabela: "journey_state",
    coluna: "user_id",
    chave: "jornada",
    colunas: "*",
    porque: "o progresso dela no Caminho, incluindo gratidões e aulas",
  },
  {
    tabela: "cantinho_items",
    coluna: "user_id",
    chave: "itens_do_cantinho",
    colunas: "*",
    porque: "o que ela comprou com Sementinhas",
  },
  {
    tabela: "sementinhas_ledger",
    coluna: "user_id",
    chave: "extrato_de_sementinhas",
    colunas: "razao, quantidade, created_at",
    /* ⚠️ Sem `dedupe_key`: ela carrega o id de QUEM DEU o presente. */
    porque: "o extrato da moeda dela",
  },
  {
    tabela: "patient_achievements",
    coluna: "user_id",
    chave: "conquistas",
    colunas: "*",
    porque: "o que ela conquistou",
  },
  {
    tabela: "appointment_requests",
    coluna: "patient_user_id",
    chave: "consultas",
    colunas: "requested_date, requested_time, confirmed_date, confirmed_time, status, notes",
    porque: "os pedidos de consulta dela",
  },
  /* ─── A COMUNIDADE ─────────────────────────────────────────────────────────
   *
   * ⚠️ **VINTE E SETE TABELAS `rede_*` no banco, e ZERO no export.** A aba
   * nasceu depois desta lista e ninguém voltou aqui: ela baixava "todos os meus
   * dados" e não vinha uma publicação, um comentário, uma mensagem nem um
   * story. O direito de portabilidade cobre o que ela ESCREVEU, e a Comunidade
   * é hoje onde ela mais escreve.
   *
   * ⚠️ **SÓ O QUE ELA PRODUZIU, e nunca o que fizeram com ela.** Quem reagiu ao
   * post dela, quem a segue e quem a bloqueou são dados de TERCEIROS: um export
   * com a lista de quem a bloqueou entregaria, num arquivo que ela pode mandar
   * por WhatsApp, uma decisão que essas pessoas tomaram em silêncio — e o
   * silêncio é o recurso. Pelo mesmo motivo `rede_denuncias` fica de fora:
   * a denúncia que ELA fez tem o nome de quem ela denunciou.
   *
   * ⚠️ **E `rede_perguntas` FICA DE FORA INTEIRA, mesmo a que ela mandou.** A
   * catraca já a proibia, e a proibição está certa: é a tabela mais sensível da
   * aba, porque o anonimato da caixinha é o recurso. Exportar até a metade dela
   * cria mais uma superfície por onde o autor pode vazar — hoje, ou no dia em
   * que alguém trocar a coluna do recorte por engano. O ganho (reler o que ela
   * perguntou) não paga o risco de derrubar o anonimato para todo mundo.
   */
  {
    tabela: "rede_posts",
    coluna: "autor_id",
    chave: "publicacoes",
    colunas:
      "texto, visibilidade, criado_em, editado_em, arquivado_em, fixado_em, " +
      "alt_texto, marco_tipo, marco_dias, enquete_opcoes, quem_comenta",
    porque: "as publicações são dela, e a legenda é texto que ela escreveu",
  },
  {
    tabela: "rede_stories",
    coluna: "autor_id",
    chave: "stories",
    colunas:
      "texto, visibilidade, criado_em, expira_em, carimbo_semana, " +
      "destacado_em, destaque_titulo, enquete_opcoes, pergunta_aberta",
    porque: "o story some em 24 h da tela, mas a linha é dela enquanto existir",
  },
  {
    tabela: "rede_comentarios",
    coluna: "autor_id",
    chave: "comentarios",
    colunas: "texto, criado_em, editado_em, apagado_em",
    porque: "o comentário é texto dela, e some da tela quando o post sai do ar",
  },
  {
    tabela: "rede_mensagens",
    coluna: "autor_id",
    chave: "mensagens_diretas",
    colunas: "texto, criada_em, apagada_em",
    porque: "o que ela escreveu no direct — e só o que ELA escreveu",
  },
  {
    tabela: "rede_notas",
    coluna: "autor_id",
    chave: "notas",
    colunas: "texto, criada_em, expira_em",
    porque: "a nota é uma frase dela, e vive 24 h",
  },
];

/**
 * O QUE FICA DE FORA, e por quê. Vai DENTRO do arquivo exportado.
 *
 * ⚠️ **Omitir em silêncio seria fingir completude.** Um export que não diz o
 * que não trouxe faz a paciente acreditar que tem tudo — e é pior que um export
 * menor e honesto. Se ela precisar do que está aqui, ela sabe o que pedir.
 */
export const FORA_DO_EXPORT: { o_que: string; porque: string }[] = [
  {
    o_que: "Achados e conduta das consultas",
    porque:
      "são o registro profissional do seu médico sobre você. Peça a ele — é o caminho do prontuário médico, e não um botão automático.",
  },
  {
    o_que: "Quem reservou presentes na sua lista, e quem reagiu às suas publicações",
    porque: "é dado de outra pessoa. Você vê na tela; num arquivo, sairia do controle dela.",
  },
  {
    o_que: "Quem mandou pergunta na sua caixinha",
    porque: "a caixinha é anônima. Esse dado existe para você poder bloquear, nunca para ser lido.",
  },
  {
    o_que: "As fotos e os áudios",
    porque:
      "os arquivos são grandes demais para caber aqui. Eles continuam no app, e você pode baixá-los de lá.",
  },
];

/**
 * Um valor que sobrevive a `JSON.stringify`.
 *
 * ⚠️ Explícito, e não `unknown`: o `createServerFn` do TanStack recusa retorno
 * não-serializável em tempo de tipo, e é a checagem certa — o export inteiro
 * existe para virar arquivo.
 */
export type ValorJson = string | number | boolean | null | ValorJson[] | { [k: string]: ValorJson };

/** O que o servidor devolve. */
export type Export = {
  gerado_em: string;
  sobre: string;
  fora: { o_que: string; porque: string }[];
  /** Fontes que não puderam ser lidas — nunca omitidas em silêncio. */
  falhas: string[];
  dados: Record<string, ValorJson[]>;
};

/**
 * O nome do arquivo.
 *
 * ⚠️ Sem o nome dela: o arquivo vai para a pasta de downloads, que num
 * computador compartilhado é a pasta de todo mundo. A data basta para
 * distinguir dois exports.
 */
export function nomeDoArquivo(agora: Date): string {
  const d = agora.toISOString().slice(0, 10);
  return `obstetrica-meus-dados-${d}.json`;
}

/**
 * A frase de abertura do arquivo.
 *
 * ⚠️ Ela diz que o arquivo pode conter dado de saúde. Quem exporta costuma
 * mandar por e-mail ou WhatsApp sem pensar, e este é o único momento em que dá
 * para avisar.
 */
export const AVISO =
  "Este arquivo tem os dados que você registrou no Obstétrica, incluindo informações de saúde. " +
  "Guarde-o com o mesmo cuidado que teria com um exame. " +
  "Se for enviar para alguém, lembre que ele não tem senha.";

/** Quantas linhas o export traz por fonte. Teto para não estourar a memória. */
export const LIMITE_POR_FONTE = 5000;
