/**
 * A GRATIDÃO — a pergunta do dia, a releitura, e a carta que sai dela.
 *
 * ─── O QUE HAVIA (ago/2026) ────────────────────────────────────────────────
 *
 * Um `textarea`, cinco fichinhas fixas e um título: "O que foi bom hoje?".
 * As mesmas cinco fichinhas no dia 1 e no dia 280. O texto ia para
 * `journal_entries` e NENHUMA tela desta atividade o mostrava de novo.
 *
 * Isso perdia para aplicativo de graça. O Presently tem prompt variado,
 * sequência própria e exportação; o Five Minute Journal tem estrutura de manhã
 * e de noite; o Finch transformou autocuidado em bichinho virtual. O nosso era
 * um campo de texto.
 *
 * ⚠️ E a releitura não é enfeite: é onde está a evidência do exercício.
 * Escrever ajuda; RELER é o que muda o afeto depois. Guardávamos tudo e nunca
 * devolvíamos nada.
 *
 * ─── O QUE ESTE ARQUIVO É ──────────────────────────────────────────────────
 *
 * Texto e régua, sem JSX — mesma razão de `frases-do-mascote.ts` e de
 * `exercicios.ts`: é isto que o dono relê e corrige, e texto enterrado num
 * componente de nove mil linhas é texto que ninguém revisa.
 *
 * As quatro regras de escrita são as mesmas do mascote e da meditação:
 *
 *  1. **Nunca cobra.** Não existe "você não escreveu", "faltou", "devia".
 *  2. **Convida, não manda.** Toda pergunta pode ser respondida com "nada".
 *  3. **Não promete clínica.** Não diz que está tudo bem, não opina sobre
 *     sintoma, não tranquiliza sobre o parto.
 *  4. **Fala com uma pessoa.** Segunda pessoa, presente, frase curta.
 *
 * ⚠️ QUEM CITA O BEBÊ É MARCADO NO CAMPO `bebe`, e nunca adivinhado do texto.
 * A meditação usa uma regex sobre a prosa para o mesmo fim, e ela corta por
 * engano 3 a 4 falas boas por sessão (o `\bele\b` pega o AR e o DESENHO). Aqui
 * a marcação é explícita desde o primeiro dia.
 */

import { type Periodo } from "./frases-do-mascote";

export type FaseGratidao = "t1" | "t2" | "t3" | "pos";

export type Pergunta = {
  /** Permanente: entra na rotação por índice e é o que os testes ancoram. */
  id: string;
  texto: string;
  /** Fichinhas de um toque, para os dias em que escrever é demais. */
  fichas: string[];
  /** Ausente = serve em qualquer fase. */
  fases?: FaseGratidao[];
  /** Cita o bebê, a barriga ou o parto — fora do Modo Cuidado. */
  bebe?: boolean;
};

/* ══════════════════════════════════════════════════════════════════════════
   AS PERGUNTAS

   Universais primeiro, depois as de fase. A paciente vê a soma das duas
   listas, então quem está no segundo trimestre tem 22 perguntas na roda: três
   semanas até a primeira repetição, contra "nunca muda".
   ══════════════════════════════════════════════════════════════════════════ */

const UNIVERSAIS: Pergunta[] = [
  {
    id: "u-boa",
    texto: "O que foi bom hoje?",
    fichas: ["Um carinho que recebi 💕", "Uma boa notícia 📩", "Descansei um pouquinho 😴"],
  },
  {
    id: "u-riso",
    texto: "Quem te fez rir hoje?",
    fichas: ["Alguém de casa 🏠", "Uma amiga 💬", "Ri sozinha mesmo 😄"],
  },
  {
    id: "u-comida",
    texto: "O que você comeu hoje que valeu a pena?",
    fichas: ["Comi algo gostoso 🍓", "Alguém cozinhou pra mim 🍲", "Tomei um café em paz ☕"],
  },
  {
    id: "u-calmo",
    texto: "Qual foi o momento mais tranquilo do seu dia?",
    fichas: ["O banho 🚿", "A cama, enfim 🛏️", "O caminho de volta 🚗"],
  },
  {
    id: "u-ajuda",
    texto: "Alguém te ajudou hoje sem você precisar pedir?",
    fichas: ["Alguém de casa 🏠", "Alguém do trabalho 💼", "Uma pessoa que nem conheço 🙂"],
  },
  {
    id: "u-conta",
    texto: "Do que você deu conta hoje?",
    fichas: ["Trabalhei 💼", "Cuidei da casa 🧺", "Só de levantar já valeu 🌤️"],
  },
  {
    id: "u-casa",
    texto: "O que na sua casa te deu paz hoje?",
    fichas: ["Uma janela ☀️", "O sofá 🛋️", "O silêncio 🤫"],
  },
  {
    id: "u-musica",
    texto: "Que música, série ou livro te acompanhou hoje?",
    fichas: ["Uma música 🎵", "Uma série 📺", "Um livro 📖"],
  },
  {
    id: "u-mensagem",
    texto: "Qual foi a melhor mensagem que você recebeu?",
    fichas: ["De quem eu amo 💛", "De uma amiga 💬", "Uma foto que me pegou 📷"],
  },
  {
    id: "u-cheiro",
    texto: "Que cheiro bom passou pelo seu dia?",
    fichas: ["Café ☕", "Chuva na terra 🌧️", "Comida na cozinha 🍲"],
  },
  {
    id: "u-janela",
    texto: "O que você viu na rua ou pela janela que valeu o olhar?",
    fichas: ["O céu 🌇", "Uma árvore 🌳", "Um bicho 🐦"],
  },
  {
    id: "u-facil",
    texto: "O que ficou mais fácil esta semana do que era antes?",
    fichas: ["Dormir 😴", "Comer 🍽️", "Estar comigo mesma 🌱"],
  },
  {
    id: "u-nao-abriu-mao",
    texto: "Do que você não abriu mão hoje, mesmo cansada?",
    fichas: ["Do meu banho 🚿", "De um tempo sozinha 🌙", "De falar com alguém 💬"],
  },
  {
    id: "u-corpo",
    texto: "O que o seu corpo fez hoje que você nem percebeu?",
    fichas: ["Me levou até o fim do dia 🚶", "Descansou quando pedi 😴", "Aguentou firme 💪"],
  },
  {
    id: "u-pequeno",
    texto: "Qual foi a menor coisa boa de hoje?",
    fichas: ["Um gole de água gelada 💧", "Um assento vago 💺", "Cinco minutos de silêncio 🤫"],
  },
  {
    id: "u-quem",
    texto: "Com quem você quer falar antes de dormir?",
    fichas: ["Com quem mora comigo 🏠", "Com a minha mãe 💛", "Com uma amiga 💬"],
  },
];

const POR_FASE: Pergunta[] = [
  /* ── Primeiro trimestre ────────────────────────────────────────────────
     A fase em que quase nada aparece por fora e quase tudo pesa por dentro.
     As perguntas ficam no corpo e nas pessoas, e não na barriga que não há. */
  {
    id: "t1-enjoo",
    texto: "O que te ajudou hoje quando o enjoo apertou?",
    fichas: ["Uma comida específica 🍋", "Deitar um pouco 🛏️", "Ar fresco 🌬️"],
    fases: ["t1"],
  },
  {
    id: "t1-eu",
    texto: "Em que hora do dia você se sentiu mais você?",
    fichas: ["De manhã ☀️", "No fim da tarde 🌇", "Só à noite 🌙"],
    fases: ["t1"],
  },
  {
    id: "t1-sono",
    texto: "O sono chegou hoje? Onde e quando?",
    fichas: ["Um cochilo salvador 😴", "Dormi cedo 🌙", "Não veio, mas descansei 🛋️"],
    fases: ["t1"],
  },
  {
    id: "t1-sabe",
    texto: "Quem já sabe, e reagiu de um jeito que você quer guardar?",
    fichas: ["Quem mora comigo 🏠", "Minha mãe 💛", "Uma amiga 💬"],
    fases: ["t1"],
    bebe: true,
  },
  {
    id: "t1-mudou",
    texto: "O que você já mudou por causa dele, e não pesou?",
    fichas: ["O que eu como 🥗", "O meu ritmo 🐢", "O que eu deixo pra depois 📵"],
    fases: ["t1"],
    bebe: true,
  },
  {
    id: "t1-espera",
    texto: "O que você está esperando com vontade?",
    fichas: ["A próxima consulta 🩺", "Contar pra alguém 💬", "O tempo passar 📆"],
    fases: ["t1"],
  },

  /* ── Segundo trimestre ─────────────────────────────────────────────────
     A fase em que muita mulher volta a respirar. As perguntas podem
     comemorar sem soar cobrança. */
  {
    id: "t2-mexeu",
    texto: "Quando foi que você sentiu ele hoje?",
    fichas: ["De manhã ☀️", "Depois de comer 🍽️", "Quando deitei 🛏️"],
    fases: ["t2"],
    bebe: true,
  },
  {
    id: "t2-leve",
    texto: "O que ficou mais leve agora que o começo passou?",
    fichas: ["O enjoo 🍋", "O cansaço 😴", "O medo 💛"],
    fases: ["t2"],
  },
  {
    id: "t2-roupa",
    texto: "Que roupa te deixou confortável hoje?",
    fichas: ["Uma que já era minha 👗", "Uma nova 🛍️", "A mais folgada que eu tenho ☁️"],
    fases: ["t2"],
  },
  {
    id: "t2-mao",
    texto: "Quem encostou a mão na sua barriga hoje?",
    fichas: ["Quem mora comigo 🏠", "Uma pessoa da família 💛", "Só eu mesma 🤍"],
    fases: ["t2"],
    bebe: true,
  },
  {
    id: "t2-consegui",
    texto: "O que você fez hoje que no começo da gestação não daria?",
    fichas: ["Saí de casa 🚶", "Trabalhei o dia todo 💼", "Comi normal 🍽️"],
    fases: ["t2"],
  },
  {
    id: "t2-planos",
    texto: "Que plano de vocês te deu vontade de sorrir hoje?",
    fichas: ["Um passeio 🚗", "O quarto dele 🧸", "O nome 💭"],
    fases: ["t2"],
    bebe: true,
  },

  /* ── Terceiro trimestre ────────────────────────────────────────────────
     A reta final é pesada, e é normal que seja. As perguntas reconhecem o
     peso sem transformar a gratidão numa prova. */
  {
    id: "t3-dormir",
    texto: "O que te ajudou a dormir ontem?",
    fichas: ["Um travesseiro no lugar certo 🛏️", "Um banho quente 🚿", "Cansaço mesmo 😴"],
    fases: ["t3"],
  },
  {
    id: "t3-pronto",
    texto: "O que já está pronto esperando por ele?",
    fichas: ["Uma roupinha 🧦", "O cantinho dele 🧸", "A mala 🎒"],
    fases: ["t3"],
    bebe: true,
  },
  {
    id: "t3-sentada",
    texto: "Qual foi o melhor minuto sentada hoje?",
    fichas: ["Com os pés pra cima 🦶", "Num lugar fresco 🌬️", "Sozinha, enfim 🤫"],
    fases: ["t3"],
  },
  {
    id: "t3-aguentou",
    texto: "O que o seu corpo aguentou hoje que você achou que não aguentaria?",
    fichas: ["Um dia inteiro de pé 🚶", "Uma noite mal dormida 🌙", "Uma escada 🪜"],
    fases: ["t3"],
  },
  {
    id: "t3-disse",
    texto: "Quem te disse alguma coisa boa sobre o parto?",
    fichas: ["Meu médico 🩺", "Alguém que já passou 💬", "Quem mora comigo 🏠"],
    fases: ["t3"],
    bebe: true,
  },
  {
    id: "t3-espera",
    texto: "O que da espera está sendo bom, mesmo com o cansaço?",
    fichas: ["O carinho das pessoas 💛", "Ver a barriga mexer 🤰", "Saber que falta pouco 📆"],
    fases: ["t3"],
    bebe: true,
  },

  /* ── Pós-parto ─────────────────────────────────────────────────────────
     O dia não tem mais forma, e a pergunta precisa caber entre uma mamada e
     outra. Nada aqui pede que ela esteja feliz. */
  {
    id: "pos-so-voces",
    texto: "Que hora do dia foi só de vocês dois?",
    fichas: ["De madrugada 🌙", "Depois do banho dele 🛁", "No colo, sem pressa 🤱"],
    fases: ["pos"],
    bebe: true,
  },
  {
    id: "pos-apareceu",
    texto: "Quem apareceu e ajudou de verdade?",
    fichas: ["Alguém da família 💛", "Uma amiga 💬", "Quem mora comigo 🏠"],
    fases: ["pos"],
  },
  {
    id: "pos-duas-maos",
    texto: "O que você conseguiu fazer hoje com as duas mãos livres?",
    fichas: ["Comer 🍽️", "Tomar banho 🚿", "Nada, e tudo bem 🤍"],
    fases: ["pos"],
  },
  {
    id: "pos-dormiu",
    texto: "Quanto tempo seguido você conseguiu dormir?",
    fichas: ["Um cochilo 😴", "Umas horas 🌙", "Quase nada, mas deitei 🛏️"],
    fases: ["pos"],
  },
  {
    id: "pos-lembrar",
    texto: "O que ele fez hoje que você quer lembrar daqui a dez anos?",
    fichas: ["Um som novo 🔊", "Uma careta 😝", "O jeito de dormir 😴"],
    fases: ["pos"],
    bebe: true,
  },
  {
    id: "pos-corpo",
    texto: "O que o seu corpo fez hoje que merece um obrigada?",
    fichas: ["Me sustentou 💪", "Me deixou descansar 😴", "Está se recuperando 🌱"],
    fases: ["pos"],
  },
];

export const PERGUNTAS: Pergunta[] = [...UNIVERSAIS, ...POR_FASE];

/**
 * ⚠️ O DIA DIFÍCIL TEM PERGUNTA PRÓPRIA — e ela NÃO minimiza.
 *
 * Num dia em que ela apertou o SOS ou marcou humor baixo no check-in,
 * perguntar "o que foi bom hoje?" soa surdo. Mas o conserto não é consolar:
 * "vai passar", "está tudo bem" e "olhe o lado positivo" são exatamente o que
 * faz alguém fechar o app — é a mesma razão pela qual a carinha `preocupada`
 * saiu do mascote e pela qual as frases dele não prometem clínica.
 *
 * A pergunta ESTREITA: reconhece o dia como ele foi e pede uma coisa menor.
 */
export const PERGUNTAS_DIA_DIFICIL: Pergunta[] = [
  {
    id: "d-atravessar",
    texto: "Hoje foi duro. Teve alguma coisa, mesmo pequena, que ajudou a atravessar?",
    fichas: ["Uma pessoa 💬", "Um lugar 🏠", "Um minuto de silêncio 🤫"],
  },
  {
    id: "d-menos-pesado",
    texto: "Não precisa ter sido um bom dia. Teve algum minuto menos pesado?",
    fichas: ["Quando deitei 🛏️", "Quando comi 🍽️", "Quando falei com alguém 💬"],
  },
  {
    id: "d-pequeno",
    texto: "Em dia assim costuma ser pouca coisa: uma pessoa, um copo d'água, uma cadeira.",
    fichas: ["Uma pessoa 💬", "Água gelada 💧", "Sentar um pouco 💺"],
  },
  {
    id: "d-chegou",
    texto: "Você chegou até aqui hoje. Alguma coisa te acompanhou nisso?",
    fichas: ["Alguém 💛", "Uma música 🎵", "Só eu mesma 🤍"],
  },
];

export function faseDaGratidao(
  semanas: number | null | undefined,
  posParto: boolean,
): FaseGratidao {
  if (posParto) return "pos";
  if (semanas == null || !Number.isFinite(semanas)) return "t2";
  if (semanas >= 28) return "t3";
  if (semanas >= 14) return "t2";
  return "t1";
}

/**
 * A pergunta de hoje.
 *
 * ⚠️ A ROTAÇÃO É `dia % n`, e não um passo fixo. Um passo de 7 só funciona
 * quando `n` não é múltiplo de 7 — foi assim que a lista da manhã do mascote
 * (14 frases) passou a mostrar duas, alternadas, para sempre. O comentário de
 * lá tinha previsto, e o teste pegou.
 */
export function perguntaDoDia(o: {
  /** Dia gestacional, ou qualquer contador estável que ande de um em um. */
  dia: number;
  semanas?: number | null;
  posParto?: boolean;
  careMode?: boolean;
  diaDificil?: boolean;
}): Pergunta {
  const fase = faseDaGratidao(o.semanas, o.posParto ?? false);
  const dia = Math.abs(Math.floor(o.dia));
  if (o.diaDificil) return PERGUNTAS_DIA_DIFICIL[dia % PERGUNTAS_DIA_DIFICIL.length];
  const lista = PERGUNTAS.filter(
    (p) => (!p.fases || p.fases.includes(fase)) && !(o.careMode && p.bebe),
  );
  /* A lista universal sozinha já garante que isto nunca fica vazio — mas o
     recuo existe porque uma fase nova escrita só com perguntas de bebê
     deixaria o Modo Cuidado sem nenhuma, e a tela abriria sem pergunta. */
  if (!lista.length) return UNIVERSAIS[dia % UNIVERSAIS.length];
  return lista[dia % lista.length];
}

/* ══════════════════════════════════════════════════════════════════════════
   O QUE ELA ESCREVEU — ler de volta
   ══════════════════════════════════════════════════════════════════════════ */

/** O prefixo com que a gratidão é gravada em `journal_entries`. */
export const PREFIXO_GRATIDAO = "Gratidão: ";

/** O emoji de humor da gratidão. `MOOD_VALUE` o lê como 4 (bom). */
export const HUMOR_GRATIDAO = "🙏";

export function ehGratidao(content: string | null | undefined): boolean {
  return typeof content === "string" && content.startsWith(PREFIXO_GRATIDAO);
}

export function textoDaGratidao(content: string): string {
  return content.startsWith(PREFIXO_GRATIDAO)
    ? content.slice(PREFIXO_GRATIDAO.length).trim()
    : content.trim();
}

export type Gratidao = { texto: string; quando: string };

/**
 * ⚠️ OS HUMORES QUE FAZEM UM DIA SER DIFÍCIL.
 *
 * São os de valor 1 e 2 em `MOOD_VALUE` — triste, angustiada, ansiosa, enjoada.
 * A lista mora aqui e não no componente porque é ela que decide o TOM do que a
 * paciente lê, e uma segunda cópia divergiria no primeiro emoji novo.
 */
export const HUMORES_DIFICEIS = ["😢", "😰", "😟", "🤢"] as const;

export function ehDiaDificil(humoresDeHoje: (string | null | undefined)[]): boolean {
  return humoresDeHoje.some((h) => !!h && (HUMORES_DIFICEIS as readonly string[]).includes(h));
}

const DIA = 86_400_000;

/** Quantos dias inteiros separam duas datas, pelo calendário local. */
export function diasEntre(quando: string, agora: Date): number {
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return 0;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((b - a) / DIA);
}

/**
 * "há um mês", "há uma semana", "ontem".
 *
 * Aproximado de propósito: a frase existe para dar a DISTÂNCIA, e "há 37 dias"
 * faz a paciente contar em vez de lembrar.
 */
export function haQuantoTempo(quando: string, agora: Date): string {
  const d = diasEntre(quando, agora);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  if (d < 14) return "há uma semana";
  if (d < 30) return `há ${Math.round(d / 7)} semanas`;
  if (d < 45) return "há um mês";
  if (d < 365) return `há ${Math.round(d / 30)} meses`;
  return "há mais de um ano";
}

/**
 * A gratidão que volta para ela na tela de guardado.
 *
 * ⚠️ NUNCA A DE HOJE, e nem a de ontem: reler o que se acabou de escrever não
 * é releitura, é eco. A preferência é pelo que já ficou longe o bastante para
 * ter sido esquecido — e é justamente esse reencontro que faz o exercício
 * valer. Sem nada com pelo menos três dias, devolve `null` e a tela não mostra
 * a seção: melhor não ter do que ter uma seção que repete a frase de cima.
 */
export function gratidaoParaReler(
  lista: Gratidao[],
  agora: Date,
  /** Gira a escolha para não devolver sempre a mesma. */
  semente = 0,
): Gratidao | null {
  const antigas = lista.filter((g) => diasEntre(g.quando, agora) >= 3);
  if (!antigas.length) return null;
  const longe = antigas.filter((g) => diasEntre(g.quando, agora) >= 21);
  const poco = longe.length ? longe : antigas;
  return poco[Math.abs(Math.floor(semente)) % poco.length];
}

/* ══════════════════════════════════════════════════════════════════════════
   O RESUMO DE DOMINGO

   Nenhum app de gratidão do mercado faz isto: todos empurram o PRÓXIMO
   registro, nenhum comemora os que já existem. Aos domingos, antes de pedir
   mais uma, a tela para e olha para trás — ela escolhe qual da semana quer
   guardar mais perto do coração. Não substitui a escrita do dia: é um passo
   ANTES dela, e some sozinho se ela já escreveu hoje.

   ⚠️ Não persiste nada. A "escolha" é só dela, na hora — não existe coluna de
   favorita, e inventar uma so para isto seria migration por decoração. O
   valor do exercício é o RELER, não o registro da escolha.
   ══════════════════════════════════════════════════════════════════════════ */

/** As gratidões dos últimos 7 dias — janela corrida, não semana de calendário. */
export function gratidoesDaSemana(lista: Gratidao[], agora: Date): Gratidao[] {
  return lista.filter((g) => diasEntre(g.quando, agora) <= 6);
}

/**
 * É domingo, e há gratidões de sobra para escolher entre elas?
 *
 * ⚠️ O MÍNIMO É DOIS. Escolher uma "favorita" entre uma coisa só não é
 * escolha — é reler o que ela acabou de ver na tela de guardado.
 */
export function ehDomingoDeResumo(agora: Date, semana: Gratidao[]): boolean {
  return agora.getDay() === 0 && semana.length >= 2;
}

/* ══════════════════════════════════════════════════════════════════════════
   O BEBÊ BOLHA NESTA TELA

   Pedido do dono: "coloque o bebê bolha nessa tela também comunicando essas
   informações, ele é o nosso porta-voz do app".

   ⚠️ ELE NÃO REPETE A PERGUNTA. A pergunta do dia é o título grande da tela;
   um balão dizendo a mesma coisa daria dois textos disputando o olho, e a
   personagem viraria enfeite. O que ele entrega é o que HOJE é rótulo seco: o
   contador ("você já me contou 12 coisas boas") e a releitura ("olha o que
   você me contou há um mês") — informação que um porta-voz dá e uma etiqueta
   em caixa alta não.

   ⚠️ E ELE NÃO DECIDE A PRÓPRIA CARA. O humor sai de `humorDaJornada`
   (`bolha.tsx`), que é onde mora o portão de Modo Cuidado — uma segunda régua
   local faria carinha festiva aparecer para quem perdeu a gestação.

   As frases seguem as mesmas quatro regras do resto: nunca cobram, convidam,
   não prometem clínica, e falam com uma pessoa.
   ══════════════════════════════════════════════════════════════════════════ */

export type TelaDaGratidao = "escrever" | "guardado" | "lista" | "resumo";

/**
 * ⚠️ MARCOS REDONDOS — o contador subia sem festa nenhuma.
 *
 * O troféu, a chama e as cinco estrelas do resto do jogo têm celebração
 * própria; esta atividade não tinha nenhuma, e "23 coisas boas" e "24 coisas
 * boas" liam exatamente igual. Os degraus não são lineares — a distância
 * cresce, para o próximo ainda surpreender (mesma forma de `nivelDaSequencia`,
 * em `celebrate.ts`).
 */
export const MARCOS = [10, 25, 50, 100, 200, 365] as const;

/**
 * O marco que ELA ACABOU DE ATINGIR com este total — ou `null`.
 *
 * ⚠️ Funciona porque `total` sobe exatamente +1 por guardada, nunca pula:
 * comparar por IGUALDADE é seguro aqui, e mais simples que testar uma faixa.
 * Quem já tinha mais gratidões que o primeiro marco antes de este recurso
 * existir simplesmente não vê aquele marco — não dá para comemorar
 * retroativamente uma travessia que já aconteceu em silêncio.
 */
export function marcoAtingido(total: number): number | null {
  return (MARCOS as readonly number[]).includes(total) ? total : null;
}

export function falaDaBolha(o: {
  tela: TelaDaGratidao;
  /** Quantas ela já guardou — CONTANDO a que acabou de guardar. */
  total: number;
  diaDificil?: boolean;
  /** Há uma gratidão antiga para reencontrar na tela de guardado? */
  temReleitura?: boolean;
  /** Ela ACABOU de bater um número redondo com esta guardada. Ver `marcoAtingido`. */
  marco?: number | null;
  /**
   * A faixa do dia (madrugada/manhã/tarde/noite — `frases-do-mascote.ts`).
   *
   * ⚠️ SÓ ENTRA NA TELA DE ESCREVER, e só no caso padrão (sem dia difícil, sem
   * ser a primeira vez): as outras duas frases já são a coisa mais importante
   * a dizer naquele instante, e casar hora do dia com "essa foi a primeira"
   * deixaria a frase comprida sem ganhar nada.
   */
  periodo?: Periodo;
}): string {
  const n = Math.max(0, Math.floor(o.total));
  const coisas = `${n} ${n === 1 ? "coisa boa" : "coisas boas"}`;

  if (o.tela === "lista") {
    return n === 1 ? "A coisa boa que você me contou." : `Tudo que você me contou até aqui.`;
  }

  if (o.tela === "resumo") {
    if (n === 0) return "Essa semana ainda não tem nada guardado.";
    return `Essa semana você me contou ${coisas}.`;
  }

  if (o.tela === "guardado") {
    /* O marco vem PRIMEIRO — é a informação mais rara desta tela, e o cartão
       de releitura continua aparecendo embaixo de qualquer jeito: os dois não
       disputam o mesmo espaço. */
    if (o.marco) return `Guardei 💛 Essa faz ${o.marco}. Número redondo!`;
    /* A releitura é a segunda informação mais importante, e é ele quem
       apresenta: o rótulo em caixa alta que fazia isso não tinha voz nenhuma. */
    if (o.temReleitura) return "Guardei 💛 E olha o que você me contou antes:";
    if (n <= 1) return "Guardei 💛 Essa foi a primeira.";
    return `Guardei 💛 Já são ${coisas} comigo.`;
  }

  /* ── A tela de escrever ────────────────────────────────────────────────
     ⚠️ No dia difícil ele NÃO consola e NÃO minimiza — ele diminui o pedido.
     "Vai passar" e "está tudo bem" são o que faz alguém fechar o app, e é a
     mesma razão pela qual a carinha `preocupada` saiu da personagem. */
  if (o.diaDificil) return "Hoje pode ser bem pequeno. Eu guardo do mesmo jeito.";
  /* A primeira vez explica a mecânica, que é o que ninguém explicava: ela
     escrevia sem saber para onde ia. */
  if (n === 0) return "Me conta uma coisa boa? Eu guardo pra você.";

  /* ── ⚠️ ELE MUDA DE ASSUNTO PELA HORA DO DIA ─────────────────────────────
     A madrugada é tratada à parte, sem o contador: é a mesma exceção que
     `humorDaJornada` faz para "surpresa" — quem está acordada às 3h numa
     gestação de risco não precisa de mais ninguém contando número pra ela,
     precisa de companhia. Nas outras três faixas o contador continua, só
     com abertura diferente — a informação não se perde, o tom muda. */
  if (o.periodo === "madrugada") return "Você está acordada bem cedo. Eu fico aqui, é só falar.";
  if (o.periodo === "manha") return `Bom dia! Você já me contou ${coisas}.`;
  if (o.periodo === "tarde") return `Boa tarde! Você já me contou ${coisas}.`;
  if (o.periodo === "noite") return `Antes de dormir — você já me contou ${coisas}.`;
  return `Você já me contou ${coisas}.`;
}

/* ══════════════════════════════════════════════════════════════════════════
   A CARTA QUE SAI DAS GRATIDÕES
   ══════════════════════════════════════════════════════════════════════════ */

/** A partir de quantas gratidões a carta existe. */
export const MINIMO_PARA_CARTA = 8;

/** Quantas linhas dela entram — a carta é para LER EM VOZ ALTA. */
export const LINHAS_DA_CARTA = 10;

/**
 * ⚠️ A CARTA NASCIA ESCONDIDA — e este é o conserto disso.
 *
 * Ela só aparecia dentro da atividade Bebê, na abertura. Quem escreve na
 * Gratidão nunca ficava sabendo que aquilo virava carta — a descoberta
 * dependia de ela abrir OUTRA atividade por acaso e notar um botão novo.
 *
 * `cartaAcabouDeNascer` marca o instante exato em que a carta passa a
 * existir — a MESMA lógica de `marcoAtingido` (funciona porque `total` sobe
 * +1 por guardada, nunca pula: comparar por igualdade é seguro). É esse
 * instante que a tela de guardado anuncia, uma vez só; depois disso um link
 * discreto continua disponível, para a descoberta não depender de estar
 * exatamente na oitava.
 */
export function cartaAcabouDeNascer(total: number): boolean {
  return total === MINIMO_PARA_CARTA;
}

/** Onde uma linha comprida é cortada, para caber numa respiração. */
const LIMITE_DA_LINHA = 90;

function encurtar(texto: string): string {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= LIMITE_DA_LINHA) return t;
  const corte = t.slice(0, LIMITE_DA_LINHA);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 40 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

/**
 * As gratidões dela viram uma carta para o bebê.
 *
 * ⚠️ ELAS SÃO ESCOLHIDAS AO LONGO DE TODO O PERÍODO, e não as dez últimas.
 * A carta conta a história de quem cresceu junto — pegar só as recentes daria
 * a última semana dela, que é diário, não é carta. As dez saem espaçadas da
 * lista inteira, em ordem cronológica.
 *
 * ⚠️ E O TEXTO É DELA, sem uma palavra reescrita. A tentação de "melhorar" a
 * frase da paciente é o jeito mais rápido de a carta deixar de ser dela — o
 * que a função acrescenta é só a abertura e o fecho, que são a moldura.
 *
 * Devolve `null` abaixo do mínimo: uma carta de três linhas seria um cartão de
 * felicitação, e a atividade promete ler para o bebê as coisas boas de meses.
 */
export function cartaDasGratidoes(
  lista: Gratidao[],
  o: { nomeDoBebe?: string | null } = {},
): { title: string; emoji: string; lines: string[] } | null {
  const limpas = lista
    .map((g) => ({ ...g, texto: encurtar(g.texto) }))
    .filter((g) => g.texto.length >= 3);
  if (limpas.length < MINIMO_PARA_CARTA) return null;

  const passo = limpas.length / LINHAS_DA_CARTA;
  const escolhidas =
    limpas.length <= LINHAS_DA_CARTA
      ? limpas
      : Array.from({ length: LINHAS_DA_CARTA }, (_, i) => limpas[Math.floor(i * passo)]);

  const nome = (o.nomeDoBebe ?? "").trim();
  return {
    title: "As coisas boas que aconteceram",
    emoji: "✨",
    lines: [
      nome
        ? `Oi, ${nome}. Deixa eu te contar uma coisa.`
        : "Oi, meu amor. Deixa eu te contar uma coisa.",
      "Enquanto você crescia aqui dentro, aconteceram coisas boas. Eu anotei todas.",
      ...escolhidas.map((g) => g.texto),
      "Foi tudo isso — e você estava junto em cada uma delas. 💛",
    ],
  };
}
