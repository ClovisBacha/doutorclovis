/**
 * O MAPA DO APP — a lista única de tudo o que ele faz, e para onde cada coisa
 * leva.
 *
 * Nasceu do estudo de navegação (set/2026): 24 abas, mais de 60 destinos, e
 * mais de trinta funções que nenhum tutorial, onboarding ou frase da bolha
 * jamais mencionava. A paciente podia usar o app por nove meses sem saber que
 * existia uma triagem de sintomas, uma carteirinha, sons para dormir ou um
 * álbum da família.
 *
 * Duas coisas leem esta lista, e por isso ela é UMA:
 *
 *  1. **A tela "Tudo o que o app faz"** (no ☰) — agrupada por PERGUNTA
 *     ("estou bem?", "e o bebê?", "quem está comigo?"), com busca por nome. É
 *     a rede de segurança de quem procura alguma coisa e não acha.
 *  2. **O "Você sabia?" da bolha** — uma vez por semana, no dia em que não há
 *     recado, o personagem apresenta UMA função que ela nunca abriu, com o
 *     toque que leva até lá.
 *
 * Função nova entra aqui e aparece nos dois lugares sozinha. Função que sai
 * do produto sai daqui — uma entrada apontando para uma aba que não existe
 * é o defeito que `mapa-do-app.test.ts` existe para pegar.
 *
 * ─── AS REGRAS DE ESCRITA DA DICA ──────────────────────────────────────────
 *
 * A `dica` é falada pela bolha, então segue as regras dela: diz o que a
 * função FAZ por ela, em uma ou duas linhas, e **nunca cobra** ("você ainda
 * não…", "não perca", "falta"). Numa gestação de alto risco, uma bolha que
 * cobra é uma bolha que ela para de ler. Há teste com regex.
 *
 * ─── `noLuto` ──────────────────────────────────────────────────────────────
 *
 * `false` = some no Modo Cuidado. Não é só a porta da tela que decide: a dica
 * é FALADA na home, e "você sabia que dá para votar no nome do bebê?" para
 * quem acabou de perder a gestação é o app não ter entendido o que aconteceu.
 * `dicaDaSemana` devolve `null` inteiro no luto — nem as funções permitidas
 * viram dica, porque quem está de luto não abre o app para um passeio guiado.
 */

export type GrupoDoMapa = "estou-bem" | "e-o-bebe" | "quem-esta-comigo" | "meu-dia" | "minha-conta";

export const GRUPOS_DO_MAPA: readonly { id: GrupoDoMapa; titulo: string }[] = [
  { id: "estou-bem", titulo: "Estou bem?" },
  { id: "e-o-bebe", titulo: "E o bebê?" },
  { id: "quem-esta-comigo", titulo: "Quem está comigo" },
  { id: "meu-dia", titulo: "Meu dia" },
  { id: "minha-conta", titulo: "Minha conta" },
] as const;

export type FuncaoDoApp = {
  /** Id estável: é a chave do "já abriu" e a da dica já mostrada. */
  id: string;
  titulo: string;
  /** Uma linha, na tela do mapa. */
  descricao: string;
  /** A frase da bolha, depois de "Você sabia?". */
  dica: string;
  /** A aba (rótulo exato de `TABS`) e, quando a aba tem várias telas, a sub-tela. */
  tab: string;
  sub?: string;
  grupo: GrupoDoMapa;
  /** Aparece no Modo Cuidado? */
  noLuto: boolean;
  /** Só faz sentido a partir desta semana (o Pós-parto, por exemplo). */
  semanaMin?: number;
};

export const FUNCOES_DO_APP: readonly FuncaoDoApp[] = [
  // ── Estou bem? ──
  {
    id: "saude",
    titulo: "Peso, pressão e glicemia",
    descricao: "Registre e veja a evolução. O seu médico vê tudo.",
    dica: "cada peso e pressão que você anota aqui chega ao seu médico antes da consulta?",
    tab: "Saúde",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "sintomas",
    titulo: "Estou com um sintoma",
    descricao: "Uma triagem rápida diz o que fazer agora, e avisa o seu médico se for o caso.",
    dica: "existe uma triagem de sintomas fora do botão de emergência, que diz o que fazer agora?",
    tab: "Alertas",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "carteirinha",
    titulo: "Carteirinha de emergência",
    descricao: "Sangue, alergias, medicamentos e contato, para mostrar a qualquer médico.",
    dica: "a sua carteirinha de emergência fica pronta para mostrar num plantão, com QR e tudo?",
    tab: "Carteirinha",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "nutricao",
    titulo: "Nutrição",
    descricao: "O que comer hoje, pensado para a sua fase.",
    dica: "tem uma sugestão do que comer hoje, pensada para a semana em que você está?",
    tab: "Nutrição",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "bem-estar",
    titulo: "Bem-estar",
    descricao: "Meditações, sons para dormir, exercícios leves e apoio emocional.",
    dica: "tem uma biblioteca inteira de meditações e exercícios leves, sem contar pontos?",
    tab: "Bem-estar",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "sons",
    titulo: "Sons para dormir",
    descricao: "Chuva, mar, ventre e mais trinta — tocam com a tela apagada.",
    dica: "tem sons para dormir que continuam tocando com o celular bloqueado?",
    tab: "Bem-estar",
    sub: "sons",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "saude-da-mulher",
    titulo: "Saúde da mulher",
    descricao: "Ciclo, mamas e colo — e o que fica para depois do parto.",
    dica: "a aba Saúde da mulher guarda os seus preventivos para depois do parto?",
    tab: "Saúde da mulher",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "diario",
    titulo: "Diário",
    descricao: "Como você está, no seu ritmo. Dá para falar em vez de escrever.",
    dica: "no diário você pode falar em vez de digitar, e eu transcrevo para você conferir?",
    tab: "Registros",
    sub: "diario",
    grupo: "estou-bem",
    noLuto: true,
  },
  {
    id: "linha-do-tempo",
    titulo: "Linha do tempo",
    descricao: "Tudo o que você registrou, em ordem.",
    dica: "tem uma linha do tempo com tudo o que você já registrou, do começo até hoje?",
    tab: "Registros",
    sub: "timeline",
    grupo: "estou-bem",
    noLuto: true,
  },

  // ── E o bebê? ──
  {
    id: "semana",
    titulo: "A semana do bebê",
    descricao: "Tamanho, peso e o que muda nesta semana.",
    dica: "tocar no bebê da tela inicial mostra o que muda nele nesta semana?",
    tab: "Bebê",
    sub: "semana",
    grupo: "e-o-bebe",
    noLuto: false,
  },
  {
    id: "chutes",
    titulo: "Contar os chutes",
    descricao: "Conte os movimentos e veja o padrão dele.",
    dica: "dá para contar os chutes e ver o padrão dele ao longo dos dias?",
    tab: "Registros",
    sub: "chutes",
    grupo: "e-o-bebe",
    noLuto: false,
  },
  {
    id: "contracoes",
    titulo: "Cronometrar contrações",
    descricao: "Marque cada uma e o app mostra o intervalo e a duração.",
    dica: "o cronômetro de contrações calcula sozinho o intervalo e diz quando ligar?",
    tab: "Registros",
    sub: "contracoes",
    grupo: "e-o-bebe",
    noLuto: false,
  },
  {
    id: "contagem",
    titulo: "Contagem regressiva",
    descricao: "Quantos dias faltam, e os marcos até lá.",
    dica: "tem uma contagem regressiva para o parto, com os marcos de cada semana?",
    tab: "Bebê",
    sub: "contagem",
    grupo: "e-o-bebe",
    noLuto: false,
  },
  {
    id: "album",
    titulo: "Álbum da família",
    descricao: "Fotos da gestação, com um link para a família acompanhar.",
    dica: "o álbum tem um link só para a família, sem precisar de conta?",
    tab: "Bebê",
    sub: "album",
    grupo: "e-o-bebe",
    noLuto: true,
  },
  {
    id: "nome",
    titulo: "Votação do nome",
    descricao: "Sugestões e votos de quem você convidar.",
    dica: "a família pode votar no nome do bebê por um link, e você vê o placar aqui?",
    tab: "Bebê",
    sub: "nome",
    grupo: "e-o-bebe",
    noLuto: false,
  },
  {
    id: "carta",
    titulo: "Carta para o bebê",
    descricao: "Uma carta por dia, para ler em voz alta.",
    dica: "tem uma carta nova para ler para o bebê a cada dia da gestação?",
    tab: "Bebê",
    sub: "carta",
    grupo: "e-o-bebe",
    noLuto: false,
  },
  {
    id: "enxoval",
    titulo: "Enxoval e quartinho",
    descricao: "A lista do que falta, para não comprar duas vezes.",
    dica: "tem uma lista de enxoval para marcar o que já chegou?",
    tab: "Bebê",
    sub: "quartinho",
    grupo: "e-o-bebe",
    noLuto: false,
  },
  {
    id: "pos-parto",
    titulo: "Pós-parto",
    descricao: "Vacinas, marcos e o retorno — para você e para o bebê.",
    dica: "a partir da 36ª semana abre a aba do pós-parto, com a caderneta de vacinas?",
    tab: "Pós-parto",
    grupo: "e-o-bebe",
    noLuto: true,
    semanaMin: 36,
  },

  // ── Quem está comigo ──
  {
    id: "medico",
    titulo: "Meu médico",
    descricao: "Quem acompanha a sua gestação, e como falar com o consultório.",
    dica: "a aba do seu médico tem o telefone do consultório e os endereços onde ele atende?",
    tab: "Médico",
    grupo: "quem-esta-comigo",
    noLuto: true,
  },
  {
    id: "chat",
    titulo: "Conversar com a bolha",
    descricao: "Dúvidas a qualquer hora, com o que o seu médico ensinou ao app.",
    dica: "você pode me perguntar qualquer coisa às três da manhã, com o que o seu médico ensinou ao app?",
    tab: "Chat IA",
    grupo: "quem-esta-comigo",
    noLuto: true,
  },
  {
    id: "acompanhante",
    titulo: "Acompanhante",
    descricao: "Um link para quem vive isso com você ver o que importa.",
    dica: "quem vive isso com você pode acompanhar por um link, sem criar conta?",
    tab: "Acompanhante",
    grupo: "quem-esta-comigo",
    noLuto: true,
  },
  {
    id: "amigas",
    titulo: "Amigas",
    descricao: "Outras gestantes que você conhece, com dupla e presentes.",
    dica: "dá para formar uma dupla com uma amiga e as duas ganharem Sementinhas juntas?",
    tab: "Amigas",
    grupo: "quem-esta-comigo",
    noLuto: true,
  },
  {
    id: "cha",
    titulo: "Chá de bebê",
    descricao: "A lista de presentes, com fraldas por tamanho e cotas.",
    dica: "a lista do chá de bebê já calcula as fraldas por tamanho, e a família reserva por um link?",
    tab: "Chá de bebê",
    grupo: "quem-esta-comigo",
    noLuto: false,
  },
  {
    id: "feed",
    titulo: "Comunidade",
    descricao: "Publicações, stories e mensagens de quem você escolher.",
    dica: "na Comunidade cada publicação escolhe quem vê — todo mundo, quem te acompanha, ou só as amigas?",
    tab: "Feed",
    grupo: "quem-esta-comigo",
    noLuto: false,
  },

  // ── Meu dia ──
  {
    id: "caminho",
    titulo: "O Caminho",
    descricao: "A aula do dia, uma meditação, um movimento, a gratidão.",
    dica: "cinco minutos por dia no Caminho rendem Sementinhas, e a aula muda todo dia?",
    tab: "Caminho",
    grupo: "meu-dia",
    noLuto: true,
  },
  {
    id: "cantinho",
    titulo: "Meu Cantinho",
    descricao: "Onde as Sementinhas viram enfeites.",
    dica: "as Sementinhas que você ganha viram enfeites no seu Cantinho?",
    tab: "Recompensas",
    sub: "cantinho",
    grupo: "meu-dia",
    noLuto: false,
  },
  {
    id: "conquistas",
    titulo: "Conquistas",
    descricao: "As medalhas da sua jornada, com raridade e Sementinhas.",
    dica: "tem 39 conquistas para descobrir, e cada uma dá Sementinhas quando você resgata?",
    tab: "Recompensas",
    sub: "conquistas",
    grupo: "meu-dia",
    noLuto: false,
  },

  // ── Minha conta ──
  {
    id: "consultas",
    titulo: "Consultas",
    descricao: "Agenda, preparo, perguntas ao médico, mala e plano de parto.",
    dica: "dá para anotar as perguntas para a próxima consulta e levá-las prontas?",
    tab: "Consultas",
    sub: "perguntas",
    grupo: "minha-conta",
    noLuto: true,
  },
  {
    id: "plano-de-parto",
    titulo: "Plano de parto",
    descricao: "O que você quer para o dia, escrito com calma.",
    dica: "tem um plano de parto para preencher com calma e mostrar na maternidade?",
    tab: "Consultas",
    sub: "parto",
    grupo: "minha-conta",
    noLuto: false,
  },
  {
    id: "mala",
    titulo: "Mala da maternidade",
    descricao: "A lista do que levar, para marcar o que já está pronto.",
    dica: "a lista da mala da maternidade já vem pronta, é só ir marcando?",
    tab: "Consultas",
    sub: "checklist",
    grupo: "minha-conta",
    noLuto: false,
  },
  {
    id: "assinatura",
    titulo: "Assinatura",
    descricao: "Plano, renovação e como cancelar.",
    dica: "a tela da assinatura mostra quando renova e como cancelar, sem letra miúda?",
    tab: "Assinatura",
    grupo: "minha-conta",
    noLuto: true,
  },
  {
    id: "loja",
    titulo: "Loja de produtos",
    descricao: "Suplementos, conforto e enxoval.",
    dica: "tem uma loja de produtos de verdade — suplementos, conforto e enxoval — separada dos enfeites?",
    tab: "Loja",
    grupo: "minha-conta",
    noLuto: true,
  },
  {
    id: "perfil",
    titulo: "Meus dados e ajustes",
    descricao: "Nome, DUM, cidade, notificações, exportar e apagar os seus dados.",
    dica: "você pode baixar tudo o que registrou aqui num arquivo só, quando quiser?",
    tab: "Perfil",
    grupo: "minha-conta",
    noLuto: true,
  },
  {
    id: "faq",
    titulo: "Dúvidas frequentes",
    descricao: "As perguntas que todo mundo faz.",
    dica: "as dúvidas mais comuns já estão respondidas numa tela só?",
    tab: "FAQ",
    grupo: "minha-conta",
    noLuto: true,
  },
] as const;

/** O que aparece para ESTA paciente: sem o que o luto tira, sem o que a semana ainda não abriu. */
export function funcoesVisiveis({
  careMode,
  weeks,
}: {
  careMode: boolean;
  weeks: number | null | undefined;
}): FuncaoDoApp[] {
  return FUNCOES_DO_APP.filter((f) => {
    if (careMode && !f.noLuto) return false;
    if (f.semanaMin != null && (weeks == null || weeks < f.semanaMin)) return false;
    return true;
  });
}

function semAcento(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Busca por nome, sem acento e sem caixa. Termo vazio devolve a lista inteira. */
export function buscarFuncoes(termo: string, lista: readonly FuncaoDoApp[]): FuncaoDoApp[] {
  const t = semAcento(termo);
  if (!t) return [...lista];
  return lista.filter((f) => semAcento(`${f.titulo} ${f.descricao} ${f.dica}`).includes(t));
}

/**
 * O id da função que um toque de navegação abriu — para marcar "já abriu".
 *
 * O mais ESPECÍFICO vence: `("Registros", "chutes")` é "chutes", e não
 * "diario". Sem sub-tela, vale a entrada da aba sem `sub` — ou, se toda
 * entrada daquela aba tiver `sub`, a primeira delas (abrir a aba do Bebê é
 * chegar na grade, e a grade já mostra a semana).
 */
export function idDaFuncao(tab: string, sub?: string | null): string | null {
  const daAba = FUNCOES_DO_APP.filter((f) => f.tab === tab);
  if (daAba.length === 0) return null;
  if (sub) {
    const exata = daAba.find((f) => f.sub === sub);
    if (exata) return exata.id;
  }
  return (daAba.find((f) => !f.sub) ?? daAba[0]).id;
}

/** ⚠️ Prefixo `dc-path-`: viaja no `journey_state`, então "já abriu" e "já
 *  mostrei esta dica" valem no outro aparelho — sem isso a bolha repetiria a
 *  mesma dica no celular e no computador. */
export const CHAVE_VISITADAS = "dc-path-funcoes-visitadas";
export const CHAVE_DICA = "dc-path-dica-da-semana";

export const DIAS_ENTRE_DICAS = 7;
const DIA_MS = 86_400_000;

export type DicaMostrada = { id: string; em: number };

/**
 * A dica desta semana — ou `null`, que é o silêncio.
 *
 * - **Nunca no Modo Cuidado.** Quem está de luto não abre o app para um
 *   passeio guiado pelas funcionalidades.
 * - **Uma por semana.** Mostrada uma vez, a bolha volta às frases do dia até
 *   completar sete dias. O canal é o mesmo do recado do médico: gastá-lo com
 *   repetição ensina a ignorá-lo.
 * - **Nunca uma que ela já abriu**, e nunca a última mostrada.
 * - **Determinística no dia**: a escolha gira pelo número da semana, então
 *   duas montagens da home no mesmo dia dão a mesma dica.
 */
export function dicaDaSemana({
  visitadas,
  careMode,
  weeks,
  agora,
  ultima,
}: {
  visitadas: ReadonlySet<string>;
  careMode: boolean;
  weeks: number | null | undefined;
  agora: number;
  ultima: DicaMostrada | null;
}): FuncaoDoApp | null {
  if (careMode) return null;
  if (ultima && agora - ultima.em < DIAS_ENTRE_DICAS * DIA_MS) return null;
  const candidatas = funcoesVisiveis({ careMode, weeks }).filter(
    (f) => !visitadas.has(f.id) && f.id !== ultima?.id,
  );
  if (candidatas.length === 0) return null;
  const semana = Math.floor(agora / (DIAS_ENTRE_DICAS * DIA_MS));
  return candidatas[semana % candidatas.length];
}

/** A fala da bolha para a dica. */
export function falaDaDica(f: FuncaoDoApp): { texto: string; aria: string } {
  return { texto: `Você sabia? ${f.dica}`, aria: `Abrir ${f.titulo}` };
}
