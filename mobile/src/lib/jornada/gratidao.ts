import { PERGUNTAS, perguntaDoDia, type Pergunta } from "@/lib/gratidao";

/**
 * A PERGUNTA DA GRATIDÃO COMO O APP A FAZ — a régua do site (`@/lib/gratidao`,
 * congelado), com duas mudanças.
 *
 * ⚠️ 1. NO MODO CUIDADO, SÓ AS PERGUNTAS SEM FASE. O site corta do luto só as
 * marcadas `bebe`, mas as semanas continuam correndo: quem perdeu o bebê no 1º
 * trimestre recebia "O que você está esperando com vontade? — Contar pra
 * alguém", "O que você fez hoje que no começo da gestação não daria?" e, com a
 * data do nascimento, "O que você conseguiu fazer hoje com as duas mãos
 * livres?". No luto, a roda é a das universais — que já servem a qualquer dia.
 *
 * ⚠️ 2. AS FRASES QUE FOGEM DAS REGRAS DO APP (21/10/2026: rede social +
 * gamificação, não conselho médico) são trocadas pelo `id`: a consulta e o
 * médico das fichas, o enjoo, o sono como contagem ("Quanto tempo seguido você
 * conseguiu dormir?"), "Comi normal", o corpo "se recuperando", o "ele" para o
 * bebê e "Quando foi que você sentiu ele hoje?" — o que ela sente das
 * mexidinhas fica fora: quem sentiu pouco lê ali um sinal, e sinal mora no SOS.
 *
 * A troca guarda o texto do site que ela substitui; a catraca do teste cobra
 * que ele ainda seja o do site.
 */
export const PERGUNTAS_NO_APP: Readonly<
  Record<
    string,
    { site: Pick<Pergunta, "texto" | "fichas">; app: Pick<Pergunta, "texto" | "fichas"> }
  >
> = {
  "u-facil": {
    site: {
      texto: "O que ficou mais fácil esta semana do que era antes?",
      fichas: ["Dormir 😴", "Comer 🍽️", "Estar comigo mesma 🌱"],
    },
    app: {
      texto: "O que ficou mais fácil esta semana do que era antes?",
      fichas: ["Pedir ajuda 🙋", "Sair de casa 🚶", "Estar comigo mesma 🌱"],
    },
  },
  "t1-enjoo": {
    site: {
      texto: "O que te ajudou hoje quando o enjoo apertou?",
      fichas: ["Uma comida específica 🍋", "Deitar um pouco 🛏️", "Ar fresco 🌬️"],
    },
    app: {
      texto: "Que mimo pequeno você se deu hoje?",
      fichas: ["Um lanche gostoso 🍓", "Deitar um pouco 🛏️", "Ar fresco na janela 🌬️"],
    },
  },
  "t1-sono": {
    site: {
      texto: "O sono chegou hoje? Onde e quando?",
      fichas: ["Um cochilo salvador 😴", "Dormi cedo 🌙", "Não veio, mas descansei 🛋️"],
    },
    app: {
      texto: "Que pausa boa você conseguiu fazer hoje?",
      fichas: ["Um cochilo gostoso 😴", "Um chá sem pressa 🍵", "Ficar à toa um pouco 🛋️"],
    },
  },
  "t1-mudou": {
    site: {
      texto: "O que você já mudou por causa dele, e não pesou?",
      fichas: ["O que eu como 🥗", "O meu ritmo 🐢", "O que eu deixo pra depois 📵"],
    },
    app: {
      texto: "O que você já mudou pela chegada do bebê, e não pesou?",
      fichas: ["O meu ritmo 🐢", "Os planos do fim de semana 📆", "O que eu deixo pra depois 📵"],
    },
  },
  "t1-espera": {
    site: {
      texto: "O que você está esperando com vontade?",
      fichas: ["A próxima consulta 🩺", "Contar pra alguém 💬", "O tempo passar 📆"],
    },
    app: {
      texto: "O que você está esperando com vontade?",
      fichas: ["Um fim de semana tranquilo 🌤️", "Contar pra alguém 💬", "O tempo passar 📆"],
    },
  },
  "t2-mexeu": {
    site: {
      texto: "Quando foi que você sentiu ele hoje?",
      fichas: ["De manhã ☀️", "Depois de comer 🍽️", "Quando deitei 🛏️"],
    },
    app: {
      texto: "O que você contou para o bebê hoje?",
      fichas: ["Como foi o meu dia 💬", "Cantei uma música 🎵", "Só fiz carinho na barriga 🤍"],
    },
  },
  "t2-leve": {
    site: {
      texto: "O que ficou mais leve agora que o começo passou?",
      fichas: ["O enjoo 🍋", "O cansaço 😴", "O medo 💛"],
    },
    app: {
      texto: "O que ficou mais leve nas últimas semanas?",
      fichas: ["A rotina 🗓️", "O medo 💛", "A cabeça 🌤️"],
    },
  },
  "t2-consegui": {
    site: {
      texto: "O que você fez hoje que no começo da gestação não daria?",
      fichas: ["Saí de casa 🚶", "Trabalhei o dia todo 💼", "Comi normal 🍽️"],
    },
    app: {
      texto: "O que você fez hoje que te deixou orgulhosa?",
      fichas: ["Saí de casa 🚶", "Trabalhei o dia todo 💼", "Resolvi uma pendência ✅"],
    },
  },
  "t2-planos": {
    site: {
      texto: "Que plano de vocês te deu vontade de sorrir hoje?",
      fichas: ["Um passeio 🚗", "O quarto dele 🧸", "O nome 💭"],
    },
    app: {
      texto: "Que plano de vocês te deu vontade de sorrir hoje?",
      fichas: ["Um passeio 🚗", "O quartinho do bebê 🧸", "O nome 💭"],
    },
  },
  "t3-dormir": {
    site: {
      texto: "O que te ajudou a dormir ontem?",
      fichas: ["Um travesseiro no lugar certo 🛏️", "Um banho quente 🚿", "Cansaço mesmo 😴"],
    },
    app: {
      texto: "O que deixou a sua noite mais gostosa?",
      fichas: ["Um travesseiro macio 🛏️", "Um banho quente 🚿", "Uma série boa 📺"],
    },
  },
  "t3-pronto": {
    site: {
      texto: "O que já está pronto esperando por ele?",
      fichas: ["Uma roupinha 🧦", "O cantinho dele 🧸", "A mala 🎒"],
    },
    app: {
      texto: "O que já está pronto esperando pelo bebê?",
      fichas: ["Uma roupinha 🧦", "O cantinho do bebê 🧸", "A mala 🎒"],
    },
  },
  "t3-sentada": {
    site: {
      texto: "Qual foi o melhor minuto sentada hoje?",
      fichas: ["Com os pés pra cima 🦶", "Num lugar fresco 🌬️", "Sozinha, enfim 🤫"],
    },
    app: {
      texto: "Qual foi o melhor minuto sentada hoje?",
      fichas: ["No sofá preferido 🛋️", "Num lugar fresco 🌬️", "Sozinha, enfim 🤫"],
    },
  },
  "t3-disse": {
    site: {
      texto: "Quem te disse alguma coisa boa sobre o parto?",
      fichas: ["Meu médico 🩺", "Alguém que já passou 💬", "Quem mora comigo 🏠"],
    },
    app: {
      texto: "Quem te disse alguma coisa boa sobre o parto?",
      fichas: ["Alguém da Comunidade 💬", "Alguém que já passou 💛", "Quem mora comigo 🏠"],
    },
  },
  "t3-espera": {
    site: {
      texto: "O que da espera está sendo bom, mesmo com o cansaço?",
      fichas: ["O carinho das pessoas 💛", "Ver a barriga mexer 🤰", "Saber que falta pouco 📆"],
    },
    app: {
      texto: "O que da espera está sendo bom, mesmo com o cansaço?",
      fichas: ["O carinho das pessoas 💛", "Conversar com o bebê 💬", "Saber que falta pouco 📆"],
    },
  },
  "pos-so-voces": {
    site: {
      texto: "Que hora do dia foi só de vocês dois?",
      fichas: ["De madrugada 🌙", "Depois do banho dele 🛁", "No colo, sem pressa 🤱"],
    },
    app: {
      texto: "Que hora do dia foi só de vocês dois?",
      fichas: ["De madrugada 🌙", "Numa troca de olhares 👀", "No colo, sem pressa 🤱"],
    },
  },
  "pos-dormiu": {
    site: {
      texto: "Quanto tempo seguido você conseguiu dormir?",
      fichas: ["Um cochilo 😴", "Umas horas 🌙", "Quase nada, mas deitei 🛏️"],
    },
    app: {
      texto: "Qual foi o seu melhor descanso hoje?",
      fichas: ["Um cochilo 😴", "Um banho demorado 🚿", "Deitar um pouquinho 🛏️"],
    },
  },
  "pos-lembrar": {
    site: {
      texto: "O que ele fez hoje que você quer lembrar daqui a dez anos?",
      fichas: ["Um som novo 🔊", "Uma careta 😝", "O jeito de dormir 😴"],
    },
    app: {
      texto: "O que o bebê fez hoje que você quer lembrar daqui a dez anos?",
      fichas: ["Um som novo 🔊", "Uma careta 😝", "O jeito de dormir 😴"],
    },
  },
  "pos-corpo": {
    site: {
      texto: "O que o seu corpo fez hoje que merece um obrigada?",
      fichas: ["Me sustentou 💪", "Me deixou descansar 😴", "Está se recuperando 🌱"],
    },
    app: {
      texto: "O que o seu corpo fez hoje que merece um obrigada?",
      fichas: ["Me sustentou 💪", "Me deixou descansar 😴", "Me trouxe até aqui 🌱"],
    },
  },
};

const comATroca = (p: Pergunta): Pergunta => {
  const t = PERGUNTAS_NO_APP[p.id];
  return t ? { ...p, ...t.app } : p;
};

/** As perguntas que servem em qualquer fase e não citam o bebê — a roda do luto. */
const DE_QUALQUER_DIA = PERGUNTAS.filter((p) => !p.fases && !p.bebe);

/** A pergunta de hoje, como o app a faz (os mesmos parâmetros do site). */
export function perguntaDoDiaNoApp(o: Parameters<typeof perguntaDoDia>[0]): Pergunta {
  if (o.careMode && !o.diaDificil) {
    const dia = Math.abs(Math.floor(o.dia));
    return comATroca(DE_QUALQUER_DIA[dia % DE_QUALQUER_DIA.length]!);
  }
  return comATroca(perguntaDoDia(o));
}
