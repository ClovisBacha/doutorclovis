/**
 * Segundo Cérebro do médico — módulo server puro (sem createServerFn).
 *
 * Este arquivo é o ADAPTADOR da Obstétrica para o núcleo portável DoctorThink
 * (src/lib/doctorthink/). Toda a lógica de ranking e montagem do bloco vive no
 * núcleo (portável, sem acoplamento); aqui fica só o I/O específico da
 * Obstétrica (Supabase, entitlements do plano, e-mail de lacuna) + os rótulos
 * de domínio (OBSTETRICA_LABELS). Trocar os rótulos = trocar o domínio.
 *
 * Monta o bloco de contexto injetado no system prompt do chatbot do site
 * (api/chat.ts) e do agente WhatsApp (whatsapp-agent.server.ts), a partir de:
 *   - brain_settings (persona, frases típicas, regras, chaves liga/desliga)
 *   - brain_entries aprovadas (Q&A reais do médico), selecionadas por
 *     relevância em relação à mensagem da paciente.
 *
 * SEGURANÇA (anti prompt-injection): o conteúdo das entries vem do médico
 * (confiável); a mensagem da paciente NÃO é confiável — ela é usada apenas
 * para pontuar a relevância das entries e NUNCA é interpolada no block.
 *
 * Falha de banco NUNCA quebra o chat: qualquer erro resulta em block vazio
 * com os recursos habilitados (enabled true).
 */

import {
  assembleBrainBlock,
  normalizeGapQuestion,
  rankEntriesByKeywords,
  type BrainBlockLabels,
  type BrainEntry,
} from "./doctorthink/core";

// Re-export para compatibilidade: chat.ts importa normalizeGapQuestion daqui.
export { normalizeGapQuestion };

/**
 * Rótulos de domínio da Obstétrica para o bloco do cérebro. É o único ponto
 * "médico/obstétrico" da montagem — outro app (DoctorThink para outra área)
 * fornece os seus. As strings são idênticas às originais (saída byte-a-byte).
 */
export const OBSTETRICA_LABELS: BrainBlockLabels = {
  header: "## Segundo Cérebro do médico",
  roleInstruction:
    "Você responde COMO O PRÓPRIO médico responderia, seguindo o estilo, as frases e as condutas registradas abaixo.",
  styleLabel: "### Estilo",
  phrasesLabel: "### Frases típicas",
  rulesLabel: "### Regras",
  referenceLabel:
    "### Respostas reais do médico (use como referência de conduta e tom; NUNCA invente conduta que não esteja aqui ou em conhecimento obstétrico consolidado; caso não coberto, oriente agendar consulta)",
};

export type BrainContext = {
  block: string;
  enabledApp: boolean;
  enabledWhatsapp: boolean;
  /**
   * true = alguma orientação validada do médico casou com a pergunta.
   * false = sem cobertura (a lacuna já foi registrada) — o chat usa isso para
   * ESCALAR com honestidade ("registrei sua dúvida para o médico") em vez de
   * improvisar conduta.
   */
  hadCoverage: boolean;
  /**
   * Similaridade de cosseno do MELHOR acerto semântico (0 a 1), quando a busca
   * por vetor foi quem selecionou. `null` quando não houve busca semântica —
   * sem chave de IA, sem a extensão, ou quando o fallback por palavras assumiu.
   *
   * Existe para uma pergunta que hoje não tem resposta: **qual é a eficiência
   * real do cérebro?** O corte está em 0,55, que para este modelo de embedding
   * ainda aceita "vagamente relacionado" — e o erro daí é o mais perigoso num
   * app clínico: a IA acha que tem cobertura e responde "a sua médica orienta
   * que…" com uma entrada que não responde bem à pergunta.
   *
   * Guardando a similaridade de cada acerto, a decisão de mexer no corte passa
   * a ser tomada com a distribuição na mão em vez de por intuição.
   */
  melhorSimilaridade: number | null;
  /**
   * A cota do ciclo do médico acabou.
   *
   * Precisa ser um campo PRÓPRIO, e não "bloco vazio": sem cobertura e cota
   * esgotada produzem o mesmo bloco vazio e pedem respostas opostas. Sem
   * cobertura, a IA diz "registrei para ele ver" — uma promessa que se cumpre.
   * Com a cota estourada, ele NÃO vai responder pelo app, e repetir a mesma
   * frase seria mentir para a paciente e deixá-la esperando.
   */
  cotaEsgotada: boolean;
  /**
   * A resposta pode ser ATRIBUÍDA ao médico ("a sua médica orienta que…").
   *
   * Separado de `hadCoverage` porque são decisões de custo diferente: usar o
   * conhecimento dele numa resposta parecida é barato; pôr o nome dele em algo
   * que ele não disse para AQUELA pergunta é caro. Ver os dois cortes acima.
   */
  podeAtribuir: boolean;
  /**
   * A gravação da lacuna, ainda em voo.
   *
   * A IA diz à paciente, com todas as letras, *"registrei aqui para ela ver"*.
   * A escrita que torna isso verdade era disparada e esquecida — e em servidor
   * sem servidor a invocação congela quando a resposta termina, então a
   * promessa dependia de a escrita ganhar uma corrida contra o fim do
   * streaming.
   *
   * Devolver a promessa em vez de aguardá-la aqui é de propósito: aguardar
   * dentro do `getBrainContext` poria ~300ms de banco ANTES da primeira
   * palavra, e justamente no caminho em que a paciente já não tem cobertura.
   * Quem recebe isto aguarda no `onFinish`, que a SDK mantém vivo — nenhum
   * atraso para ela, e a promessa cumprida.
   */
  gravacaoDaLacuna?: Promise<void>;
};

/** Canal em que o cérebro foi usado (telemetria do dashboard do médico). */
export type BrainChannel = "app" | "whatsapp" | "teste";

/**
 * Registra (fire-and-forget) um "acerto" do cérebro em brain_hits, para o
 * dashboard do médico medir quantas vezes o cérebro respondeu no mês.
 * O teste do painel (channel 'teste') NÃO conta como uso real. A falha do
 * insert NUNCA pode quebrar o chat: tudo dentro de try/catch, sem await que
 * propague (void em IIFE — a promise não é aguardada por quem chama).
 */
function logBrainHit(doctorId: string, channel: BrainChannel): void {
  if (channel === "teste") return;
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("brain_hits").insert({ doctor_id: doctorId, channel });
    } catch {
      /* telemetria é best-effort — nunca afeta a resposta ao paciente */
    }
  })();
}

/**
 * Registra (fire-and-forget) uma LACUNA: pergunta que o cérebro não cobriu.
 * Deduplicada por (doctor_id, norm_question): repetição incrementa `hits` —
 * a fila do painel ordena pelo que as pacientes mais perguntam. Best-effort:
 * tabela ausente (migração pendente) ou corrida no insert nunca quebram o chat.
 */
/**
 * "Como envio meu exame pelo app?" não é lacuna do médico — é suporte, e a IA
 * já responde sozinha. Sem este filtro toda dúvida de uso caía na fila do
 * painel (nada casa no cérebro clínico), afogando as perguntas que realmente
 * pedem a palavra dele. Heurística de superfície de propósito: na dúvida
 * REGISTRA (perder uma lacuna clínica é pior que uma de suporte a mais).
 */
/**
 * FRONTEIRA DE PALAVRA QUE ENTENDE PORTUGUÊS.
 *
 * O `\b` do JavaScript é ASCII: para ele, `ó` não é letra. Duas consequências
 * medidas, e as duas silenciosas:
 *
 *   · `\b(ótimo)\b` NUNCA casa. Depois de um espaço, antes de `ó`, não existe
 *     fronteira — então "vocês são ótimos" passava direto pelo filtro de
 *     elogio, virava lacuna na fila do médico e disparava o e-mail "sua IA
 *     recebeu uma pergunta que não soube responder". Por um elogio.
 *   · o `\b` final mata todo plural: "ótimos" nunca casaria nem sem acento.
 *
 * E a falta de fronteira é igualmente cara: `dor` sem delimitador casa dentro
 * de "aDORei", então "adorei o app!" era tratado como queixa clínica — com
 * embedding, busca vetorial e uma unidade da cota do médico.
 *
 * `PRE`/`POS` usam lookaround sobre a faixa acentuada, e valem para as duas
 * pontas: não casar no meio da palavra, e casar até o fim dela.
 */
const PRE = "(?<![0-9a-zà-ÿ])";
const POS = "(?![a-zà-ÿ])";

/** Envolve cada alternativa numa fronteira que respeita acento. */
function comFronteira(alternativas: string): string {
  return `${PRE}(?:${alternativas})${POS}`;
}

const TERMOS_SUPORTE = new RegExp(
  comFronteira(
    [
      // superfície do produto (nomeia a coisa na tela)
      "app|aplicativo|site|aba|tela|menu|bot(?:ã|a)o|(?:í|i)cone",
      // conta e cobrança
      "login|logar|senha|assinatura|assinar|premium|pagamento|cadastr\\w*|notifica(?:ç|c)\\w*",
      /* DINHEIRO é da plataforma, não do médico.
         "quanto custa o plano?" entrava na fila CLÍNICA dele, com a IA
         prometendo resposta pessoal — para uma pergunta de cobrança que ele
         não tem como responder e que a plataforma responde na hora.

         A lista é de RADICAIS, e sem stemming ela erra por conjugação: tinha
         `cancelar` e não tinha `cancelo`, então "como cancelo?" — literalmente
         a frase que o pedido citou — vazava para a fila clínica. Os `\\w*`
         abaixo cobrem a família inteira de cada verbo. */
      "cust\\w*|pre(?:ç|c)o\\w*|valor\\w*|mensalidade\\w*|cobran(?:ç|c)\\w*|cobra\\w*|reembols\\w*|estorn\\w*",
      "cancel\\w*|desativ\\w*|descadastr\\w*|excluir|exclu(?:o|(?:í|i)r)|apagar (?:minha|meus|a) \\w+|deletar",
      // falha técnica
      "instalar|atualiza(?:r|ç|c)\\w*|carregar|carrega|travand?o|travou|bug|sair da conta",
      /* "não consigo entrar" / "não carrega nada aqui" são as duas frases de
         suporte mais comuns e nenhuma casava: `entrar` está fora da lista de
         propósito (entrar na piscina) e `carrega` só existia no infinitivo. A
         forma NEGADA desfaz a ambiguidade — "não consigo entrar" não é sobre
         piscina, e ninguém escreve "não consigo entrar" sobre o próprio corpo
         sem citar uma parte dele (aí `TERMOS_CLINICOS` desempata). */
      "n(?:ã|a)o (?:consigo|estou conseguindo|to conseguindo|d(?:á|a) para) \\w+",
      "n(?:ã|a)o (?:carrega|abre|funciona|recebo|recebi|chega\\w*|aparece)",
    ].join("|"),
  ),
  "i",
);
/* Fora de propósito: "plano" (plano de parto), "cartão" (cartão de pré-natal),
   "entrar" (entrar na piscina) e "erro" (erro no exame) são palavras clínicas
   no vocabulário da gestante — incluí-las derrubava lacunas de verdade. */

export function isSuporteDoApp(question: string): boolean {
  return TERMOS_SUPORTE.test(question);
}

/**
 * Vocabulário CLÍNICO — o sinal que impede o caminho enxuto de roubar contexto.
 *
 * `isSuporteDoApp` é heurística de superfície e erra para o lado seguro numa
 * decisão barata (registrar uma lacuna a mais). Para DESLIGAR o cérebro numa
 * conversa, o mesmo erro fica caro na direção oposta: "estou com dor de cabeça,
 * é normal? aliás o app travou" casa com "app" e perderia toda a orientação do
 * médico — a paciente receberia suporte técnico para uma queixa clínica.
 *
 * Por isso o caminho enxuto exige DOIS sinais: fala de app E não fala de corpo.
 * Na dúvida, é clínica.
 */
const TERMOS_CLINICOS = new RegExp(
  comFronteira(
    [
      /* `dor` SEM fronteira casava dentro de "aDORei" — e "adorei o app!" ia
         para o caminho clínico completo: embedding, busca vetorial e uma
         unidade da cota do médico, por um elogio. */
      "dor(?:es)?|sangr\\w*|c(?:ó|o)lica\\w*|contra(?:ç|c)\\w*|enjo\\w*|n(?:á|a)usea\\w*|v(?:ô|o)mit\\w*|tontur\\w*",
      "press(?:ã|a)o|glicem\\w*|diabet\\w*|incha\\w*|edema|febre|corrim\\w*|secre(?:ç|c)\\w*",
      "beb(?:ê|e)|feto|mexer|mexeu|chute\\w*|movimento\\w*|barriga|(?:ú|u)tero|placenta|l(?:í|i)quido",
      "exame\\w*|ultrassom|ultrasso\\w*|resultado\\w*|hemogram\\w*|urina|parto|ces(?:á|a)re\\w*|amamenta\\w*",
      "rem(?:é|e)dio\\w*|medicament\\w*|comprimido\\w*|dose|tomar|s(?:í|i)ntoma\\w*|sinto|senti|semana\\w*",
    ].join("|"),
  ),
  "i",
);

/**
 * É pergunta de suporte PURA — cabe à plataforma, não ao médico.
 *
 * Quando é, a conversa não precisa do Segundo Cérebro dele, nem da memória
 * clínica dela, nem das medidas: "como troco minha senha" não melhora com o
 * histórico de pressão arterial da paciente. Injetar tudo isso gasta os créditos
 * do médico e ainda produz a resposta longa que mistura dois assuntos.
 */
export function ehSoSuporte(question: string): boolean {
  return isSuporteDoApp(question) && !TERMOS_CLINICOS.test(question);
}

/**
 * Cortesia — agradecimento, despedida, confirmação.
 *
 * "obrigada!!" normaliza para "obrigada": oito caracteres, passa o piso de
 * tamanho e virava lacuna na fila do médico. Isso já era ruído; virou defeito
 * de verdade quando a lacuna passou a registrar QUEM perguntou — a paciente
 * ficava esperando resposta para um "obrigada", e ganharia um push quando ele
 * "respondesse".
 *
 * Comparação EXATA depois de normalizar, nunca substring: "obrigada, mas posso
 * tomar dipirona?" é uma pergunta clínica de verdade e não pode cair aqui.
 */
const CORTESIAS = new Set([
  "obrigada",
  "obrigado",
  "muito obrigada",
  "muito obrigado",
  "brigada",
  "brigado",
  "valeu",
  "ta bom",
  "tudo bem",
  "entendi",
  "entendido",
  "certo",
  "beleza",
  "perfeito",
  "otimo",
  "ate mais",
  "tchau",
  "bom dia",
  "boa tarde",
  "boa noite",
]);

export function isCortesia(question: string): boolean {
  return CORTESIAS.has(normalizeGapQuestion(question));
}

/**
 * Corte para JUNTAR duas lacunas.
 *
 * Muito mais alto que o 0,55 da leitura, e de propósito: são erros de custo
 * diferente. Ler uma entrada meio relacionada dá uma resposta mais fraca;
 * JUNTAR duas perguntas diferentes numa só faz o médico responder uma e achar
 * que respondeu a outra — e a paciente da segunda recebe uma orientação que não
 * era para ela.
 *
 * ─── POR QUE 0,82, E NÃO O 0,86 QUE EU TINHA CHUTADO ────────────────────────
 *
 * 0,86 foi palpite. Dois casos reais, medidos na fila de verdade, o corrigiram:
 *
 *   · "a doutora já viu minhas dúvidas?" JUNTOU com "A doutora já respondeu
 *     minha dúvida" → o corte alcança paráfrase limpa.
 *   · "Olá tudo bem a doutora já chegou a aprovar e responder as dúvidas" NÃO
 *     juntou — mesma pergunta, com saudação e enrolo em volta.
 *
 * Ou seja: 0,86 pegava a paráfrase curta e perdia a mesma pergunta escrita do
 * jeito que gente escreve. A margem é estreita — por isso a mudança é pequena,
 * e vem acompanhada da limpeza do texto abaixo, que ataca a causa em vez de só
 * afrouxar a régua.
 */
export const GAP_MERGE_MIN_SIMILARITY = 0.82;

/**
 * O texto que vira VETOR — não o que vira lacuna.
 *
 * A paciente escreve "Olá, tudo bem? A doutora já chegou a responder?". Metade
 * disso é protocolo social e entra no vetor com o mesmo peso do resto,
 * afastando duas perguntas idênticas só porque uma veio com saudação.
 *
 * O que o médico VÊ na fila continua sendo o texto cru dela — é o que ele
 * precisa para entender quem perguntou o quê. Só a comparação usa a versão
 * enxuta.
 *
 * Aplicado nos DOIS lados (ao gravar a lacuna e ao consultar): vetores de
 * espaços diferentes não se comparam, e limpar só uma ponta seria pior que não
 * limpar nenhuma.
 *
 * Conservador: se sobrar pouca coisa, devolve o texto original. Uma mensagem
 * que é SÓ saudação não deve virar vetor vazio.
 */
const ABERTURAS = new RegExp(
  "^(\\s*(oi+|ol(á|a)|e a(í|i)|bom dia|boa tarde|boa noite|tudo bem|tudo bom|" +
    "como vai|doutora?|dra?\\.?|por favor|pfv|desculpa|desculpe|licen(ç|c)a|" +
    "gostaria de saber|queria saber|uma d(ú|u)vida|tenho uma d(ú|u)vida|" +
    "me tira uma d(ú|u)vida|s(ó|o) uma d(ú|u)vida)[\\s,.!?;:-]*)+",
  "i",
);

export function textoParaVetor(texto: string): string {
  const enxuto = texto.replace(ABERTURAS, "").trim();
  /* Piso de 12 caracteres: abaixo disso a limpeza tirou conteúdo, não
     protocolo — e comparar sobra de frase gera semelhança sem sentido. */
  return enxuto.length >= 12 ? enxuto : texto;
}

/**
 * Elogio à IA ou ao app — "bacana dms, gostei muito dessa ia".
 *
 * A lista fechada de cortesias não alcança isto: elogio é frase livre, e a
 * comparação exata só pega o que está no dicionário. Uma paciente satisfeita
 * escrevendo isso virava um item na fila do médico, com botão "Responder" —
 * trabalho clínico gerado por um agrado.
 *
 * A regra é conservadora de propósito, porque o erro caro é o outro: perder
 * uma dúvida clínica de verdade é muito pior que uma linha de ruído na fila.
 * Por isso exige TRÊS coisas ao mesmo tempo:
 *
 *   1. palavra de elogio,
 *   2. nenhum sinal de pergunta ("?" ou palavra interrogativa),
 *   3. nenhuma palavra do corpo ou da gestação.
 *
 * Com as três, "adorei, mas posso tomar dipirona?" continua sendo lacuna (tem
 * "?" e "posso"), e "gostei do resultado do exame, é normal?" também.
 */
const ELOGIOS = new RegExp(
  comFronteira(
    /* Cada palavra aceita plural e flexão. O `\b` final da versão anterior
       matava "ótimos", "excelentes", "maravilhosas" — e o `\b` inicial, sendo
       ASCII, fazia "ótimo" NUNCA casar. Medido: `ótimo`→0, `ótimos`→0,
       `otimo`→1. Ou seja, o filtro só funcionava para quem escrevia sem
       acento. */
    "gostei|gostando|adorei|adorando|amei|amando|curti|bacana\\w*|legal|legais|" +
      "(?:ó|o)tim\\w*|excelente\\w*|maravilhos\\w*|perfeit\\w*|top|show|" +
      "incr(?:í|i)ve\\w*|sensacional|sensacionais|parab(?:é|e)ns|muito bom|muito boa|" +
      /* Gíria e superlativo são metade do elogio real que chega. "vcs sao
         demais", "melhor coisa que já usei" e "vocês arrasam" viravam lacuna
         clínica — e disparavam o e-mail "sua IA não soube responder" para o
         médico, por um agradecimento. */
      "demais|arras\\w*|fant(?:á|a)stic\\w*|(?:ó|o)tima ideia|nota 10|nota dez|" +
      "melhor (?:app|aplicativo|coisa|programa)|melhor que|" +
      "ajudou muito|me ajudou|ajudando muito|salvou|salvando|" +
      "recomendo|indiquei|indico|amando (?:o|a)\\w*",
  ),
  "i",
);
/* Sinal de que ainda é pergunta, mesmo com elogio no meio. */
const SINAL_DE_PERGUNTA = new RegExp(
  "\\?|" +
    comFronteira(
      "qual|quais|quando|como|onde|quem|quanto|quanta|por que|porque|pq|" +
        "posso|pode|devo|preciso|tenho que|serve|adianta|vale a pena|(?:é|e) normal|" +
        "normal|segur\\w*|perigos\\w*|faz mal|pode ser",
    ),
  "i",
);
/* Vocabulário clínico: se aparece, não é só elogio — é relato. */
const TEM_ASSUNTO_CLINICO = new RegExp(
  comFronteira(
    "dor(?:es)?|sangr\\w*|enjoo|n(?:á|a)usea\\w*|v(?:ô|o)mit\\w*|febre|press(?:ã|a)o|" +
      "gl(?:i|í)cemia|beb(?:ê|e)|parto|gravid\\w*|gesta(?:ç|c)\\w*|exame\\w*|ultrass\\w*|" +
      "rem(?:é|e)dio\\w*|medicament\\w*|contra(?:ç|c)\\w*|mexer|chute\\w*|corrimento|" +
      "c(?:ó|o)lica\\w*|incha\\w*|cabe(?:ç|c)a|barriga|peso|consulta\\w*|cesare\\w*|" +
      "amament\\w*|leite",
  ),
  "i",
);

export function isElogio(question: string): boolean {
  return (
    ELOGIOS.test(question) &&
    !SINAL_DE_PERGUNTA.test(question) &&
    !TEM_ASSUNTO_CLINICO.test(question)
  );
}

/**
 * A pergunta merece entrar na fila do médico?
 *
 * Existe como função ÚNICA porque a condição vive em dois lugares: aqui, que
 * decide se a lacuna é gravada, e no `chat.ts`, que decide se a IA pode dizer
 * "registrei aqui para ele ver". Duas cópias divergem — e divergiam: uma
 * filtrava o texto cortado em 300 caracteres e a outra o texto inteiro, então
 * uma mensagem longa com a palavra de suporte depois do caractere 300 era
 * registrada por um lado e negada pelo outro. A IA dizia que não registrou, e
 * tinha registrado.
 *
 * Usa `ehSoSuporte` (dois sinais), e não `isSuporteDoApp` (um): "o app travou
 * e estou com dor de cabeça" mencionava o app, então a queixa clínica era
 * DESCARTADA da fila. Uma dor de cabeça sumindo porque a frase citava o
 * aplicativo é o erro mais caro que este filtro pode cometer.
 */
export function mereceFila(pergunta: string): boolean {
  const clean = pergunta.trim().slice(0, 300);
  return (
    normalizeGapQuestion(clean).length >= 8 &&
    !ehSoSuporte(clean) &&
    !isCortesia(clean) &&
    !isElogio(clean)
  );
}

export function logBrainGap(
  doctorId: string,
  question: string,
  channel: BrainChannel,
  /**
   * Quem perguntou.
   *
   * Opcional porque o painel também gera lacuna ao TESTAR a IA (canal
   * "teste"), e ali não há paciente esperando resposta. Quando existe, é o que
   * permite a IA cumprir o que ela promete a ela — "registrei aqui para ele
   * ver" — em vez de a resposta morrer no treinamento.
   */
  patientId?: string,
  /**
   * O vetor da pergunta, quando já existe.
   *
   * Ele acabou de ser calculado — alguns milissegundos antes, para procurar
   * cobertura nas entradas do médico. Reaproveitá-lo aqui é o que faz o
   * agrupamento custar ZERO embedding a mais no caminho do chat, que é o
   * volume.
   *
   * Omitir é permitido: quem não tem um à mão (o polegar para baixo no app, a
   * API do DoctorThink) deixa a função calcular. Sem chave de IA, a lacuna
   * nasce sem vetor e a deduplicação segue sendo a por texto — o comportamento
   * de antes, nunca pior.
   */
  embedding?: number[] | null,
): void {
  void logBrainGapAgora(doctorId, question, channel, patientId, embedding);
}

/**
 * A MESMA coisa, aguardável — e quem promete à paciente TEM que aguardar.
 *
 * O chat instrui a IA a dizer, com todas as letras, *"registrei aqui para ela
 * ver"*. Essa frase é uma promessa feita a uma gestante, e a gravação que a
 * torna verdadeira era disparada e esquecida: em servidor sem servidor a
 * invocação congela quando a resposta termina, então a promessa dependia de a
 * escrita ganhar a corrida contra o fim do streaming.
 *
 * Aguardar de dentro do `onFinish` resolve, porque a SDK aguarda o `onFinish` —
 * é a mesma trava que já mantém `registrarUsoAgora` vivo.
 */
export async function logBrainGapAgora(
  doctorId: string,
  question: string,
  channel: BrainChannel,
  patientId?: string,
  embedding?: number[] | null,
): Promise<void> {
  const clean = question.trim().slice(0, 300);
  const norm = normalizeGapQuestion(clean);
  if (!mereceFila(question)) return;
  {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      /* Primeiro pelo texto exato (barato e certeiro), depois por semelhança.
         `.limit(1)` em vez de `.maybeSingle()`, e isso é conserto de uma bola
         de neve: `maybeSingle()` devolve ERRO quando acha mais de uma linha, e
         o erro caía no chão do destructuring. Com `data` nulo, o código
         concluía "não existe" e inseria MAIS uma duplicata — então bastava uma
         duplicata nascer (corrida entre duas pacientes, ou índice único ausente
         no banco) para aquela pergunta nunca mais juntar, nem repetida com o
         texto idêntico. Pegar a primeira e seguir é sempre correto: se há
         duplicata, juntar em qualquer uma delas é melhor que criar a terceira. */
      const achadasPorTexto = await sb
        .from("brain_gaps")
        .select("id,hits,status")
        .eq("doctor_id", doctorId)
        .eq("norm_question", norm)
        .order("created_at", { ascending: true })
        .limit(1);
      let existing = (achadasPorTexto.data ?? [])[0] as
        | { id: string; hits: number; status: string }
        | undefined;

      /* O vetor, quando quem chamou não tinha um.
         Só DEPOIS da busca por texto, de propósito: se o texto exato já bateu,
         não há nada para agrupar e o embedding seria dinheiro no lixo.
         Quem chega aqui sem vetor são os caminhos raros — o polegar para baixo
         no app e a API do DoctorThink, que não têm um calculado à mão. O chat,
         que é o volume, sempre passa o dele. Timeout folgado porque isto roda
         solto: ninguém está esperando esta resposta. */
      let vetor = embedding ?? null;
      if (!existing && !vetor) {
        try {
          const { embedText } = await import("./embeddings.server");
          vetor = await embedText(textoParaVetor(clean), 4000, "semelhanca");
        } catch {
          vetor = null; // sem chave de IA → segue a deduplicação por texto
        }
      }

      /* Não achou pelo texto: procura uma lacuna ABERTA que seja a mesma
         pergunta escrita de outro jeito. É isto que impede o médico de
         responder "é normal sentir enjoo?" três vezes. */
      if (!existing && vetor) {
        const { data: parecidas, error: erroRpc } = await sb.rpc("match_brain_gaps", {
          p_doctor_id: doctorId,
          p_embedding: vetor,
          p_limit: 1,
        });
        const perto = (parecidas ?? [])[0] as
          | { id: string; hits: number; similarity: number }
          | undefined;
        if (perto && perto.similarity >= GAP_MERGE_MIN_SIMILARITY) {
          existing = { id: perto.id, hits: perto.hits, status: "aberta" };
        }
        /* ─── POR QUE ISTO EXISTE ────────────────────────────────────────────
           O `error` desta RPC era IGNORADO, e os três desfechos abaixo eram
           indistinguíveis de fora — todos terminavam numa linha nova na fila:

             · a função não existe no banco (SQL não aplicado);
             · a função existe e não achou nada parecido;
             · achou, mas abaixo do corte.

           Sem separá-los, ajustar o corte é chute: dois dos três casos não têm
           nada a ver com o corte. Custou três rodadas de tentativa e erro para
           perceber. Uma linha por lacuma nova é volume desprezível — lacuna já
           é o caminho raro. */
        if (erroRpc) {
          console.error(
            `[lacuna] agrupamento INDISPONÍVEL: ${erroRpc.code ?? "?"} ${erroRpc.message ?? ""}` +
              ` — aplique supabase/APLICAR_LACUNAS_PARECIDAS.sql`,
          );
        } else if (!perto) {
          console.log("[lacuna] nenhuma lacuna aberta com vetor para comparar");
        } else {
          console.log(
            `[lacuna] mais parecida: ${perto.similarity.toFixed(4)} ` +
              `(corte ${GAP_MERGE_MIN_SIMILARITY}) → ${existing ? "JUNTOU" : "linha nova"}`,
          );
        }
      }
      /* Registra quem está esperando. Tabela separada de propósito: a lacuna é
         deduplicada por `(médico, pergunta)` — é isso que faz cinquenta
         pacientes com a mesma dúvida virarem UM item na fila dele. */
      const anotaQuemPerguntou = async (gapId: string) => {
        if (!patientId || !gapId) return;
        await sb
          .from("brain_gap_askers")
          .upsert({ gap_id: gapId, user_id: patientId }, { onConflict: "gap_id,user_id" });
      };

      if (existing) {
        // Reaparecer conta como novo hit; lacuna ignorada não reabre sozinha.
        await sb
          .from("brain_gaps")
          .update({
            hits: (existing.hits ?? 1) + 1,
            updated_at: new Date().toISOString(),
            ...(existing.status === "respondida" ? { status: "aberta" } : {}),
          })
          .eq("id", existing.id);
        await anotaQuemPerguntou(existing.id);
      } else {
        const base = {
          doctor_id: doctorId,
          question: clean,
          norm_question: norm,
          channel,
        };
        const gravar = (linha: Record<string, unknown>) =>
          sb.from("brain_gaps").insert(linha).select("id").maybeSingle();

        /* Sem vetor a lacuna funciona igual — só não agrupa. Melhor nascer sem
           que não nascer. */
        const primeira = await gravar(vetor ? { ...base, embedding: vetor } : base);
        let nova = primeira.data;

        /* O código sobe pela Vercel a cada push; o SQL é aplicado à mão. Nessa
           janela a coluna `embedding` ainda não existe, e o PostgREST recusa a
           LINHA INTEIRA por causa dela — o insert não estoura, devolve `error`.
           Ignorar esse `error` fazia toda lacuna nova sumir calada justamente
           enquanto ninguém desconfia de nada: a IA segue dizendo à paciente
           "registrei aqui para ele ver", e não registrou.
           Então a segunda tentativa vai sem o vetor: perde o agrupamento,
           mantém a pergunta. */
        if (primeira.error && vetor) {
          nova = (await gravar(base)).data;
        }
        await anotaQuemPerguntou(nova?.id);
        // Fecha o ciclo em horas, não em dias: avisa o médico que a IA tem
        // pergunta sem resposta. No máximo 1 e-mail por dia por médico (o
        // primeiro gap do dia dispara; os demais só aparecem no painel).
        /* Só quando a linha REALMENTE nasceu. Sem esta guarda, um insert que
           falhou (corrida com outra paciente na mesma pergunta) ainda mandava
           o e-mail "sua IA recebeu uma pergunta que não soube responder" — e o
           médico abria o painel para procurar uma lacuna que não existe. */
        if (nova?.id) notifyDoctorOfGap(doctorId, sb);
      }
    } catch {
      /* best-effort — nunca afeta a resposta ao paciente */
    }
  }
}

/** Quantas lacunas cegas se cura por abertura do painel. */
const CURA_POR_VEZ = 20;
/**
 * Teto por embedding da cura, e quantas saem por vez.
 *
 * Era 2500ms com TODAS disparadas de uma vez — erro meu, e do tipo que se
 * esconde: com doze lacunas eram doze chamadas simultâneas ao modelo, e uma
 * lentidão ou um 429 de limite de taxa derrubava as doze juntas. Cada uma
 * devolvia null, a cura relatava zero, e a cada abertura do painel a mesma
 * rajada falhava igual. Os vetores nunca voltavam.
 *
 * O aperto existia porque a cura rodava no caminho da tela. Agora ela tem
 * requisição própria (`curarLacunasDoMedico`), então pode ir devagar: lotes
 * pequenos e o tempo folgado que uma chamada de embedding realmente precisa.
 */
const CURA_TIMEOUT_MS = 6000;
const CURA_POR_LOTE = 4;

/* `emLotes` mora em `embeddings.server.ts` — a razão de existir é o limite de
   taxa da API de vetores, então a regra é de lá. Havia uma cópia aqui; duas
   cópias de uma regra é exatamente como os dois filtros de lacuna divergiram. */

/**
 * Dá vetor às lacunas que nasceram sem um.
 *
 * Toda lacuna anterior à migration é cega, e lacuna cega não agrupa — nem
 * agrupa nem É agrupada. Sem esta cura, a fila que o médico tem HOJE nunca se
 * beneficia: uma paciente nova perguntando a mesma coisa que uma lacuna antiga
 * abre uma linha nova, e o recurso só passaria a valer quando a fila inteira
 * girasse.
 *
 * Não é só o passado. O vetor também falta quando o `embedText` estoura o
 * tempo ou a quota — então isto é a rede que conserta sozinha, não um script
 * de mudança de casa.
 *
 * DE PROPÓSITO só preenche o vetor; não junta o que já está na fila. Fundir
 * retroativamente mexeria em itens que o médico já está olhando — e o ganho
 * real vem da PRÓXIMA paciente, que agora encontra a lacuna antiga pela
 * frente.
 *
 * É `async` DE PROPÓSITO, e quem chama TEM que aguardar.
 *
 * A primeira versão era `void (async () => {…})()`, disparar e esquecer. Não
 * curou nada: em serverless a invocação congela quando a resposta sai, e
 * `listBrainGaps` devolve a lista na hora — a cura morria antes do primeiro
 * embedding. O painel abria, a consulta no banco seguia mostrando as mesmas
 * lacunas cegas, e não havia erro nenhum para explicar.
 *
 * Este arquivo vizinho (`embeddings.server.ts`) já tinha essa cicatriz escrita
 * em cima do `embedBrainEntry`. Copiei o padrão errado do lado dela.
 *
 * O custo do `await` é limitado pelo TETO, não pela paralelização total: vinte
 * por visita, em lotes de quatro, com 6s cada — típico ~1,5s, pior caso ~30s
 * se toda chamada estourar o tempo. Cabe porque isto tem requisição própria e
 * ninguém espera por ela; nas visitas seguintes é zero, porque não sobra
 * lacuna cega.
 *
 * (A versão anterior deste comentário dizia "todos de uma vez, pior caso 2,5s".
 * Era descrição do código ANTIGO, mantida por cima do novo — e um comentário
 * que descreve o que o código deixou de fazer engana melhor que nenhum.)
 *
 * Devolve quantas curou — quem chama pode ignorar, mas o número é o que torna
 * o efeito verificável de fora.
 */
export async function curarLacunasSemVetor(doctorId: string): Promise<number> {
  try {
    /* Sem chave, sai antes até de consultar o banco: nenhuma das vinte teria
       vetor, e a consulta seria uma ida ao banco por abertura de painel. */
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 0;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: cegas, error } = await sb
      .from("brain_gaps")
      .select("id,question")
      .eq("doctor_id", doctorId)
      .eq("status", "aberta")
      .is("embedding", null)
      /* Teto por vez: um médico com centenas de lacunas antigas dispararia
         centenas de embeddings de uma vez só por ter aberto o painel. Com o
         teto, ele cura vinte por abertura e chega no fim do mesmo jeito. */
      .limit(CURA_POR_VEZ);
    /* Coluna ainda não existe (SQL não aplicado) → `error`, e nada acontece. */
    if (error || !cegas?.length) return 0;

    const { embedText, emLotes } = await import("./embeddings.server");
    const linhas = cegas as { id: string; question: string }[];
    /* Mesma limpeza dos outros dois caminhos. Curar com o texto cru deixaria
       as lacunas antigas num tratamento e as novas noutro — e duas perguntas
       iguais não se encontrariam por causa de uma saudação. */
    const vetores = await emLotes(linhas, CURA_POR_LOTE, (g) =>
      embedText(
        textoParaVetor(String(g.question ?? "").slice(0, 300)),
        CURA_TIMEOUT_MS,
        "semelhanca",
      ),
    );

    const curadas = linhas
      .map((g, i) => ({ id: g.id, vetor: vetores[i] }))
      .filter((c): c is { id: string; vetor: number[] } => !!c.vetor);
    /* Conferir o resultado de cada update, e não só disparar.
       Antes isto devolvia `curadas.length` sem olhar nada: com a coluna
       ausente ou a RLS no caminho, a função relatava "curei 20" tendo gravado
       ZERO. Um número que mente sobre o próprio trabalho é pior que nenhum —
       foi exatamente o tipo de silêncio que fez esta investigação durar. */
    const gravacoes = await Promise.all(
      curadas.map((c) => sb.from("brain_gaps").update({ embedding: c.vetor }).eq("id", c.id)),
    );
    const falhas = gravacoes.filter((r: any) => r?.error);
    if (falhas.length) {
      console.error(
        `[lacuna] cura: ${falhas.length} de ${curadas.length} updates falharam — ` +
          `${(falhas[0] as any)?.error?.code ?? "?"} ${(falhas[0] as any)?.error?.message ?? ""}`,
      );
    }
    return curadas.length - falhas.length;
  } catch {
    /* best-effort — a fila do médico aparece do mesmo jeito */
    return 0;
  }
}

/**
 * Qual entrada do cérebro respondeu esta pergunta.
 *
 * Existe para o 👎: sem saber QUAL entrada produziu a resposta ruim, não há o
 * que revisar — sobra a pergunta, que é justamente a única coisa que não
 * estava errada.
 *
 * O chat não carrega esse id até o voto, e plumbá-lo pelo streaming seria
 * muito encanamento para um caminho raro. Refazer a busca com a mesma pergunta
 * acha a mesma entrada, porque é exatamente o que o chat fez segundos antes.
 *
 * ─── O CORTE É O DE COBERTURA, e isto foi um conserto ───────────────────────
 *
 * Usava o corte de ATRIBUIÇÃO (0,74), que é o de "posso dizer que seu médico
 * orienta isso". A pergunta aqui é outra e mais frouxa: "esta entrada ENTROU na
 * resposta?" — e quem decide isso é o corte de COBERTURA (0,62), porque é ele
 * que faz o bloco ser injetado no prompt.
 *
 * A diferença não era teórica: TODA resposta montada com uma entrada entre 0,62
 * e 0,74 caía na fila de LACUNAS ao levar 👎. O médico lia "sua IA não soube
 * responder" sobre algo que ela respondeu com o material dele, respondia de
 * novo, e criava uma SEGUNDA entrada sobre o mesmo assunto — deixando a
 * primeira aprovada e competindo com a nova na busca. É exatamente o defeito
 * que a fila de revisão foi criada para matar, sobrevivendo numa faixa inteira.
 *
 * `null` em qualquer falha: sem chave de IA, sem vetores, sem match. Nunca
 * lança — o voto da paciente não pode depender disto.
 */
export async function entradaQueRespondeu(
  doctorId: string,
  pergunta: string,
): Promise<string | null> {
  try {
    const { embedText } = await import("./embeddings.server");
    const qvec = await embedText(textoParaVetor(pergunta), 4000, "consulta");
    if (!qvec) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("match_brain_entries_id", {
      p_doctor_id: doctorId,
      p_embedding: qvec,
      p_limit: 1,
    });
    if (error) {
      /* A RPC não existe (migration pendente) → 100% dos 👎 voltam a virar
         lacuna, que é precisamente o defeito que a fila de revisão fechou. Sem
         este log, a regressão é invisível. */
      console.error(
        `[cerebro] match_brain_entries_id falhou (${error.code ?? "?"}) — ` +
          `rode supabase/APLICAR_REVISAO.sql. Todo 👎 vira lacuna até lá.`,
      );
      return null;
    }
    if (!Array.isArray(data) || !data.length) return null;
    const melhor = data[0] as { id: string; similarity: number };
    return melhor.similarity >= SEMANTIC_MIN_SIMILARITY ? melhor.id : null;
  } catch {
    return null;
  }
}

/**
 * E-mail "sua IA tem perguntas sem resposta" (fire-and-forget, ≤1/dia).
 * Sem RESEND_API_KEY vira no-op (o painel continua sendo a fonte).
 */
function notifyDoctorOfGap(doctorId: string, sb: any): void {
  void (async () => {
    try {
      if (!process.env.RESEND_API_KEY) return;
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { count, error } = await sb
        .from("brain_gaps")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .gte("created_at", dayStart.toISOString());
      // Só o PRIMEIRO gap novo do dia notifica (throttle sem coluna extra).
      if (error || (count ?? 0) !== 1) return;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(doctorId);
      const email = u?.user?.email;
      if (!email) return;

      const { sendEmail, emailLayout } = await import("./email.server");
      const { DOCTOR } = await import("./doctor.config");
      await sendEmail({
        to: email,
        subject: "🧠 Sua IA recebeu uma pergunta que não soube responder",
        html: emailLayout(
          "Sua paciente perguntou — a IA registrou para você",
          `<p style="margin:0 0 12px;line-height:1.6">Uma paciente fez uma pergunta que ainda não está coberta pelo seu Segundo Cérebro. Ela foi avisada com acolhimento e a pergunta ficou registrada para você.</p>
           <p style="margin:0 0 16px;line-height:1.6">Responda no painel (leva menos de 1 minuto com o rascunho da IA) e o cérebro aprende na hora — a próxima paciente com a mesma dúvida já recebe a SUA orientação.</p>
           <p style="margin:0"><a href="${DOCTOR.siteUrl}/painel" style="display:inline-block;background:#a85a44;color:#fff;text-decoration:none;border-radius:999px;padding:10px 22px;font-size:14px">Responder no painel</a></p>
           <p style="margin:16px 0 0;font-size:12px;color:#9b8178">Você recebe no máximo 1 aviso destes por dia.</p>`,
        ),
      });
    } catch {
      /* best-effort */
    }
  })();
}

/* ── Multi-inquilino: cada médico tem o SEU cérebro ──────────────────────────
   Todas as tabelas são chaveadas por doctor_id (uid do médico no auth). Não
   existe mais "dono da instalação": o chat/WhatsApp usam o cérebro do médico
   DAQUELA paciente (doctorId passado a getBrainContext); sem médico → genérico.
   O admin da plataforma não é médico e não opera cérebro (ver /admin).       */

type BrainSettingsRow = {
  persona: string | null;
  sample_phrases: string | null;
  rules: string | null;
  enabled_app: boolean | null;
  enabled_whatsapp: boolean | null;
};

type BrainEntryRow = { question: string; answer: string };

const MAX_ENTRIES_LOADED = 200;
const MAX_ENTRIES_SCORED = 6;

/**
 * Teto de CARACTERES das entradas que entram no prompt.
 *
 * Seis entradas era um limite de contagem, não de tamanho — e o tamanho é do
 * médico. Um que escreve orientações longas e detalhadas produz um bloco de
 * ~1.500 tokens; um que escreve em duas linhas, ~300. Cinco vezes de diferença
 * na maior parcela variável do prompt, e ela se paga em TODA mensagem.
 *
 * Isso importa por dois motivos que se somam:
 *
 *  · O custo cresce junto com a QUALIDADE do uso — o médico caprichoso, que é o
 *    melhor cliente, é o mais caro de servir.
 *  · Se um dia a plataforma cobrar por mensagem, "1 mensagem = 1 unidade" só é
 *    honesto se a mensagem custar mais ou menos o mesmo. Sem este teto, não
 *    custa.
 *
 * 4.000 caracteres ≈ 1.000 tokens: cabe folgado o caso comum (6 entradas de
 * ~300 caracteres) e corta só a cauda.
 */
const MAX_BLOCK_CHARS = 4000;

/**
 * Corta as entradas até caber no teto — sempre INTEIRAS, e nunca até zero.
 *
 * Duas regras que parecem detalhe e não são:
 *
 *  · **Nunca corta uma entrada pela metade.** O texto é orientação clínica
 *    escrita pelo médico; meia frase pode inverter o sentido ("não use X em
 *    caso de…" cortado no "não use X"). Entrada que não cabe inteira não entra.
 *
 *  · **Nunca devolve lista vazia se havia alguma.** `selected.length > 0` é o
 *    que define `hadCoverage`, e `hadCoverage` muda o que a IA DIZ: sem
 *    cobertura ela responde "essa dúvida o seu médico prefere responder
 *    pessoalmente" e registra uma lacuna. Zerar aqui transformaria uma
 *    otimização de custo numa mudança de comportamento clínico — e ninguém
 *    entenderia por quê. Se a primeira entrada sozinha estoura o teto, ela
 *    passa: pagar caro uma vez é melhor que mentir sobre cobertura.
 */
export function limitarPorCaracteres(
  selected: BrainEntry[],
  maxChars = MAX_BLOCK_CHARS,
): BrainEntry[] {
  const out: BrainEntry[] = [];
  let usado = 0;
  for (const e of selected) {
    const custo = (e.question?.length ?? 0) + (e.answer?.length ?? 0) + 8; /* "P: \nR: \n" */
    if (out.length > 0 && usado + custo > maxChars) break;
    out.push(e);
    usado += custo;
  }
  return out;
}
/**
 * DOIS cortes, porque são duas decisões com custos diferentes.
 *
 * ─── Por que 0,55 era perigoso ─────────────────────────────────────────────
 *
 * A escala real deste espaço foi medida na própria fila: "a mesma pergunta com
 * outras palavras" vive entre 0,82 e 0,86 (ver GAP_MERGE_MIN_SIMILARITY). Com
 * o topo em ~0,85, um corte em 0,55 não quer dizer "relacionado" — quer dizer
 * "é português, é clínico, e tem formato de pergunta".
 *
 * "posso comer sushi?" e "posso tomar café na gravidez?" têm o mesmo verbo
 * modal, o mesmo domínio e a mesma sintaxe: passam de 0,55 com folga e têm
 * condutas completamente diferentes. O resultado era o erro mais caro de um
 * app clínico — a IA dizendo "a sua médica orienta que…" sobre uma entrada que
 * não responde à pergunta.
 *
 * Truncar de 3072 para 768 agrava: as dimensões descartadas são justamente as
 * que fazem a discriminação FINA, então as similaridades ficam mais altas e
 * mais amontoadas do que seriam.
 *
 * ─── Por que dois, e não um mais alto ──────────────────────────────────────
 *
 * Subir o corte único resolveria a atribuição errada e criaria outro problema:
 * a paciente deixaria de receber a orientação do médico em casos que são, sim,
 * dela. As duas coisas não têm o mesmo custo:
 *
 *   USAR o conhecimento dele numa resposta parecida → no pior caso, contexto
 *   a mais. Barato.
 *   ATRIBUIR a ele ("a sua médica orienta que…") algo que ele não disse para
 *   aquela pergunta → quebra a confiança e pode virar conduta errada. Caro.
 *
 * Então o conhecimento entra a partir de 0,62, e o nome dele só é usado a
 * partir de 0,74. Entre os dois, a resposta usa o material dele sem dizer que
 * é a orientação dele — e a pergunta VAI para a fila, para ele confirmar.
 *
 * Os dois números continuam sendo estimativa informada, não medição — e é por
 * isso que `melhorSimilaridade` é gravada em `ai_usage` a cada resposta. Com
 * tráfego real, a distribuição manda; até lá, o lado seguro é este.
 */
const SEMANTIC_MIN_SIMILARITY = 0.62;
/** A partir daqui a IA pode dizer "o(a) Dr(a). X orienta que…". */
const ATRIBUICAO_MIN_SIMILARITY = 0.74;

/**
 * Carrega settings + entries DO MÉDICO e monta o bloco para o prompt.
 * `userMessage` serve SÓ para ranquear as entries — nunca entra no block.
 * `doctorId` opcional: sem ele, usa o médico dono da instalação.
 */
export async function getBrainContext(
  userMessage: string,
  doctorId?: string,
  channel: BrainChannel = "app",
  /** Quem está perguntando — vai junto para a lacuna saber quem espera. */
  patientId?: string,
): Promise<BrainContext> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Multi-inquilino puro: o cérebro é o do médico DAQUELA paciente. Sem
    // médico vinculado (doctorId undefined) → chat genérico, sem cérebro.
    // Não existe mais fallback para "o dono da instalação".
    const target = doctorId ?? null;
    if (!target)
      return {
        block: "",
        enabledApp: true,
        enabledWhatsapp: true,
        hadCoverage: false,
        melhorSimilaridade: null,
        cotaEsgotada: false,
        podeAtribuir: false,
      };

    const { getEntitlementsByDoctorId } = await import("./entitlements.server");
    const [settingsRes, entriesRes, ent] = await Promise.all([
      (supabaseAdmin as any)
        .from("brain_settings")
        .select("persona,sample_phrases,rules,enabled_app,enabled_whatsapp")
        .eq("doctor_id", target)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("brain_entries")
        .select("question,answer")
        .eq("doctor_id", target)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(MAX_ENTRIES_LOADED),
      getEntitlementsByDoctorId(target),
    ]);

    const settings = (settingsRes.data ?? null) as BrainSettingsRow | null;
    const entries = (entriesRes.data ?? []) as BrainEntryRow[];

    const persona = (settings?.persona ?? "").trim();
    const samplePhrases = (settings?.sample_phrases ?? "").trim();
    const rules = (settings?.rules ?? "").trim();
    // Entitlement do plano MANDA sobre o toggle salvo: mesmo com enabled_*=true,
    // se o plano não cobre o canal, o cérebro nunca é injetado nele. É isto que
    // faz "quem pagou o plano X ter exatamente o acesso do plano X".
    const enabledApp = (settings?.enabled_app ?? true) && ent.aiApp;
    const enabledWhatsapp = (settings?.enabled_whatsapp ?? true) && ent.aiWhatsapp;

    // Canal não coberto pelo plano → bloco vazio (nada do cérebro vaza).
    if (channel === "app" && !enabledApp)
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
        cotaEsgotada: false,
        podeAtribuir: false,
      };

    /* ─── COTA DO CICLO ESTOURADA ────────────────────────────────────────────
       O que sai da resposta é o Segundo Cérebro do médico — só ele. A paciente
       continua conversando, continua recebendo informação obstétrica
       consolidada, e a dúvida dela continua entrando na fila dele: por isso a
       lacuna é registrada AQUI, antes de sair.

       Bloquear a resposta seria transferir para a gestante a consequência de
       um limite que não é dela e que ela não pode resolver.

       A checagem vem ANTES da busca de propósito. Depois dela custaria uma
       consulta ao banco, um embedding e uma varredura vetorial para descobrir
       algo que já se sabia — e economizar importa mais justamente no médico
       que estourou a conta.

       'teste' fica de fora: o painel dele não pode parar de funcionar
       enquanto ele decide se sobe de plano. */
    if (channel !== "teste") {
      const { cotaDoMedico } = await import("./cota-ia.server");
      const cota = await cotaDoMedico(target, ent.aiRepliesPerCycle);
      if (cota.estado === "estourada") {
        return {
          block: "",
          enabledApp,
          enabledWhatsapp,
          hadCoverage: false,
          melhorSimilaridade: null,
          cotaEsgotada: true,
          podeAtribuir: false,
          gravacaoDaLacuna: logBrainGapAgora(target, userMessage, channel, patientId, null),
        };
      }
    }
    if (channel === "whatsapp" && !enabledWhatsapp) {
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
        cotaEsgotada: false,
        podeAtribuir: false,
      };
    }
    if (channel === "teste" && !ent.aiApp)
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
        cotaEsgotada: false,
        podeAtribuir: false,
      };

    // ── Seleção em 2 camadas ─────────────────────────────────────────────
    // 1ª) SEMÂNTICA (pgvector + embedding da pergunta): entende sinônimos —
    //     "tô enjoada" encontra "náuseas no 1º trimestre". Busca em TODAS as
    //     entradas aprovadas com vetor (sem o teto de 200 do fallback).
    // 2ª) PALAVRAS (fallback): sem chave de IA, sem extensão/migração ou
    //     nenhum match acima do corte → o ranking clássico assume.
    // A mensagem da paciente vira só o VETOR de consulta — segue nunca
    // entrando no texto do bloco (anti prompt-injection preservado).
    let selected: BrainEntryRow[] = [];
    /* A similaridade do MELHOR acerto, antes do corte — inclusive quando ela
       fica ABAIXO dele. Guardar só os aprovados esconderia metade da
       informação: saber que a melhor entrada deu 0,52 é o que revela um corte
       apertado demais, e isso some se a gente só olhar o que passou. */
    let melhorSimilaridade: number | null = null;
    if (entries.length > 0) {
      try {
        const { embedText } = await import("./embeddings.server");
        // Timeout CURTO: estamos no caminho crítico do chat — se o embedding
        // não chegar em 1,8s, o fallback por palavras responde na hora.
        /* A limpeza de saudação vale aqui também: "Oi, tudo bem? posso
           comer sushi?" e "posso comer sushi?" têm que encontrar a mesma
           entrada do médico. */
        const qvec = await embedText(textoParaVetor(userMessage), 1800, "consulta");
        if (qvec) {
          const { data: matches, error } = await (supabaseAdmin as any).rpc("match_brain_entries", {
            p_doctor_id: target,
            p_embedding: qvec,
            p_limit: MAX_ENTRIES_SCORED,
          });
          if (!error && Array.isArray(matches)) {
            const achados = matches as { question: string; answer: string; similarity: number }[];
            if (achados.length > 0) {
              melhorSimilaridade = Math.max(...achados.map((m) => m.similarity));
            }
            selected = achados
              .filter((m) => m.similarity >= SEMANTIC_MIN_SIMILARITY)
              .map((m) => ({ question: m.question, answer: m.answer }));
          }
        }
      } catch {
        /* RPC/extensão ausente ou falha de embedding → fallback por palavras */
      }
    }

    if (selected.length === 0) {
      // Fallback por palavras (núcleo DoctorThink). SEM "mais recentes":
      // injetar entradas aleatórias quando nada casa é ruído no prompt — em vez
      // disso o miss vira uma LACUNA para o médico responder no painel.
      selected = rankEntriesByKeywords(userMessage, entries, MAX_ENTRIES_SCORED);
    }

    /* A promessa em voo: quem chama aguarda no `onFinish`. */
    let gravacaoDaLacuna: Promise<void> | undefined;
    if (selected.length === 0 && channel !== "teste") {
      /* O vetor da lacuna é calculado por ela, e NÃO reaproveitado daqui.

         O atalho existia e economizava um embedding — mas com o `taskType` ele
         virou erro: o vetor acima é de CONSULTA (pergunta procurando resposta
         longa), e a lacuna precisa de um SIMÉTRICO (pergunta comparada com
         pergunta). Misturar os dois produz uma similaridade que parece número
         normal e não é.

         O que se paga é uma chamada de embedding a mais, só quando não houve
         cobertura. É a chamada mais barata do sistema — só entrada, texto
         curto — e correção vale mais que a economia. */
      gravacaoDaLacuna = logBrainGapAgora(target, userMessage, channel, patientId, null);
    }

    // Montagem do bloco pelo núcleo DoctorThink (rótulos de domínio da
    // Obstétrica). Retorna "" quando não há persona/regras nem entries.
    const block = assembleBrainBlock(
      { persona, samplePhrases, rules },
      /* O teto de caracteres entra aqui, e não dentro do `assembleBrainBlock`:
         a persona e as regras são a VOZ do médico e valem para toda pergunta —
         cortá-las mudaria como ele soa. O que se corta é a lista de referência,
         que é longa, variável e específica daquela pergunta. */
      limitarPorCaracteres(selected),
      OBSTETRICA_LABELS,
    );
    if (!block) {
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
        cotaEsgotada: false,
        podeAtribuir: false,
        gravacaoDaLacuna,
      };
    }

    // Bloco não-vazio realmente montado → o cérebro vai ser usado: registra o
    // hit (fire-and-forget; 'teste' é ignorado dentro de logBrainHit).
    logBrainHit(target, channel);

    return {
      block,
      enabledApp,
      enabledWhatsapp,
      hadCoverage: selected.length > 0,
      melhorSimilaridade,
      cotaEsgotada: false,
      /* Só com similaridade medida E alta. O fallback por palavras não produz
         número nenhum — e sem número não há como afirmar que a orientação é
         dele, então ali a resposta usa o material sem assinar o nome. */
      podeAtribuir:
        selected.length > 0 &&
        melhorSimilaridade !== null &&
        melhorSimilaridade >= ATRIBUICAO_MIN_SIMILARITY,
      gravacaoDaLacuna,
    };
  } catch {
    // Falha de banco não pode derrubar o chat: segue sem o segundo cérebro.
    return {
      block: "",
      enabledApp: true,
      enabledWhatsapp: true,
      hadCoverage: false,
      melhorSimilaridade: null,
      cotaEsgotada: false,
      podeAtribuir: false,
    };
  }
}

/**
 * Resolve o contexto do cérebro escolhendo a FONTE: DoctorThink remoto (produto
 * standalone) OU o cérebro local. Opt-in explícito por env
 * (DOCTORTHINK_API_URL + DOCTORTHINK_API_KEY) + kill switch/rollout pela flag
 * `doctorthink_remote`. Sem env (padrão) → SEMPRE local, comportamento provado.
 * Qualquer falha do remoto (timeout/rede/erro) → cai no local. É o mesmo shape
 * de retorno do getBrainContext, então os chamadores não mudam.
 */
export async function getBrainContextResolved(
  userMessage: string,
  doctorId?: string,
  channel: BrainChannel = "app",
  patientId?: string,
): Promise<BrainContext> {
  const url = process.env.DOCTORTHINK_API_URL;
  const apiKey = process.env.DOCTORTHINK_API_KEY;
  if (url && apiKey && doctorId) {
    try {
      // Duplo opt-in: além do env, a flag precisa estar EXPLICITAMENTE ligada
      // (ausência = desligado) — evita ligar o remoto em 100% por acidente ao
      // só setar as envs.
      const { isFlagExplicitlyEnabled } = await import("./platform-flags.server");
      if (await isFlagExplicitlyEnabled("doctorthink_remote", doctorId)) {
        const { askBrainRemote } = await import("./doctorthink/client");
        const remote = await askBrainRemote(url, apiKey, {
          doctorId,
          message: userMessage,
          channel,
        });
        if (remote) {
          return {
            block: remote.block,
            enabledApp: remote.enabledChannels.app ?? true,
            enabledWhatsapp: remote.enabledChannels.whatsapp ?? true,
            hadCoverage: remote.hadCoverage,
            /* O cérebro remoto não devolve similaridade: `null` é honesto. */
            melhorSimilaridade: null,
            cotaEsgotada: false,
            podeAtribuir: false,
          };
        }
      }
    } catch {
      /* qualquer problema → cai no cérebro local */
    }
  }
  return getBrainContext(userMessage, doctorId, channel, patientId);
}

/**
 * Placar de qualidade do cérebro de UM médico (mês corrente) — usado no card
 * do painel e no relatório por médico da aba Clínica. null = tabelas do
 * autoaprendizado ainda não migradas / erro (o chamador esconde o placar).
 */
export async function computeBrainQualityStats(doctorId: string): Promise<{
  hitsMonth: number;
  gapsOpen: number;
  gapHitsMonth: number;
  coveragePct: number | null;
  satisfactionPct: number | null;
  feedbackCount: number;
} | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const since = monthStart.toISOString();

    const [hitsRes, gapsOpenRes, gapRowsRes, fbRes] = await Promise.all([
      sb
        .from("brain_hits")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .gte("created_at", since),
      sb
        .from("brain_gaps")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .eq("status", "aberta"),
      sb
        .from("brain_gaps")
        .select("hits,created_at")
        .eq("doctor_id", doctorId)
        .gte("updated_at", since)
        .limit(500),
      sb
        .from("brain_feedback")
        .select("helpful")
        .eq("doctor_id", doctorId)
        .gte("created_at", since)
        .limit(1000),
    ]);
    if (hitsRes.error || gapsOpenRes.error || gapRowsRes.error || fbRes.error) return null;

    const hitsMonth = hitsRes.count ?? 0;
    const gapsOpen = gapsOpenRes.count ?? 0;
    // Misses SÓ do mês: lacuna criada no mês → todos os hits dela são do mês;
    // lacuna antiga tocada no mês → conta 1 (não arrasta o histórico).
    const gapHitsMonth = ((gapRowsRes.data ?? []) as { hits: number; created_at: string }[]).reduce(
      (s, g) => s + (g.created_at >= since ? (g.hits ?? 1) : 1),
      0,
    );
    const fb = (fbRes.data ?? []) as { helpful: boolean }[];
    const fbPos = fb.filter((f) => f.helpful).length;
    const denomCov = hitsMonth + gapHitsMonth;
    return {
      hitsMonth,
      gapsOpen,
      gapHitsMonth,
      coveragePct: denomCov > 0 ? Math.round((hitsMonth / denomCov) * 100) : null,
      satisfactionPct: fb.length > 0 ? Math.round((fbPos / fb.length) * 100) : null,
      feedbackCount: fb.length,
    };
  } catch {
    return null;
  }
}
