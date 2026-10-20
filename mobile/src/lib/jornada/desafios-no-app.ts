import { gestChallenge } from "@/lib/daily-challenges";

/**
 * OS DESAFIOS DA GESTAÇÃO NO APP — o texto do site
 * (src/lib/daily-challenges.data.json, congelado), com 62 dos 294 trocados:
 * os que mandavam para telas que o app não tem (a aba Consultas, a aba Exames,
 * o Álbum de fotos, o Diário, as Meditações, a aba Nutrição, os Alertas, a
 * aba Chutes antes de ela existir, o "Dr. Clóvis" como se fosse o médico de
 * todas). Viram o gesto que o app acompanha — a agenda, o SOS (que lista os
 * sinais de alerta), "Estou com um sintoma", Movimentos do bebê, a meditação
 * — ou um gesto do mundo (uma pasta, o celular, papel e caneta).
 *
 * A catraca de `desafios-no-app.test.ts` confere que o texto do site ainda é o
 * que foi trocado, e que nenhum desafio do app aponta para tela que não existe.
 * Os do pós-parto moram em `pos-parto.ts` (`desafioDoPos`), pela mesma régua.
 */

export const DESAFIOS_DA_GESTACAO_NO_APP: Readonly<Record<number, { site: string; app: string }>> =
  {
    18: {
      site: "Abrir a aba Consultas e pedir um horário",
      app: "Marcar sua próxima consulta na agenda",
    },
    20: {
      site: "Revisar seus hábitos da semana na aba Saúde",
      app: "Revisar como foi a semana: sono, água e comida",
    },
    25: {
      site: "Anotar dúvidas na aba Consultas pro médico",
      app: "Anotar dúvidas para o médico na consulta da agenda",
    },
    26: {
      site: "Fazer 10 minutos de Meditações à noite",
      app: "Fazer 10 minutos de meditação à noite",
    },
    30: {
      site: "Anotar o lanche da tarde na aba Nutrição",
      app: "Anotar o que comeu no lanche da tarde",
    },
    34: {
      site: "Registrar no Diário como recebeu a notícia",
      app: "Escrever como você recebeu a notícia",
    },
    36: {
      site: "Anotar o enjoo do dia na aba Saúde",
      app: "Anotar como foi o enjoo hoje e o que ajudou",
    },
    38: {
      site: "Registrar qualquer sangramento em Alertas",
      app: 'Conheça o "Estou com um sintoma", na aba Saúde',
    },
    40: {
      site: "Montar sua playlist calma na aba Bem-estar",
      app: "Montar uma playlist calma para os seus dias",
    },
    46: {
      site: "Marcar o primeiro ultrassom na aba Exames",
      app: "Pôr o primeiro ultrassom na sua agenda",
    },
    53: {
      site: "Guardar os exames de sangue na aba Exames",
      app: "Guardar os exames de sangue numa pasta",
    },
    57: {
      site: "Anote no Diário a hora em que o enjoo aperta",
      app: "Anote a hora em que o enjoo aperta",
    },
    59: {
      site: "Leia a aba Alertas e saiba quando ligar",
      app: "Veja no SOS os sinais de quando ligar",
    },
    61: {
      site: "Ouça 5 minutos de Meditações antes de dormir",
      app: "Ouça 5 minutos de meditação antes de dormir",
    },
    62: {
      site: "Releia o Diário da semana e marque 1 vitória",
      app: "Releia as coisas boas da semana e marque 1 vitória",
    },
    64: {
      site: "Registre em Saúde quantas horas você dormiu",
      app: "Anote quantas horas você dormiu esta noite",
    },
    68: {
      site: "Escreva uma carta curta pro bebê no Diário",
      app: "Escreva uma carta curta para o bebê",
    },
    71: {
      site: "Meça a cintura e anote a mudança no Diário",
      app: "Meça a cintura e anote a mudança",
    },
    76: {
      site: "Confira quantos dias do Diário você preencheu",
      app: "Confira quantas coisas boas você já guardou",
    },
    80: {
      site: "Avise no app qualquer sangramento, mesmo leve",
      app: 'Sangramento, mesmo leve? Abra "Estou com um sintoma"',
    },
    82: {
      site: "Chame seu par para ouvir uma Meditação junto",
      app: 'Chame seu par para a meditação "Para vocês dois"',
    },
    90: {
      site: "Guarde a imagem do ultrassom no Álbum",
      app: "Guarde a imagem do ultrassom no celular",
    },
    94: {
      site: "Revise em Alertas quando ir à emergência",
      app: "Revise no SOS quando ir à emergência",
    },
    95: {
      site: "Confira os resultados na aba Exames",
      app: "Separe os resultados para levar na consulta",
    },
    96: {
      site: "Tire a primeira foto da barriga para o Álbum",
      app: "Tire a primeira foto da barriga",
    },
    97: {
      site: "Escreva no Diário como foi entrar no 2º tri",
      app: "Escreva como foi entrar no 2º trimestre",
    },
    108: {
      site: "Leia a aba Alertas e saiba o que é urgência",
      app: "Leia no SOS o que é urgência",
    },
    110: {
      site: "Escreva no Diário um desejo para a semana 15",
      app: "Escreva um desejo para a semana 15",
    },
    111: {
      site: "Releia seu Diário da semana 15 antes de dormir",
      app: "Releia as coisas boas da semana antes de dormir",
    },
    116: {
      site: "Agende o morfológico pela aba Consultas",
      app: "Ponha o morfológico na sua agenda",
    },
    118: {
      site: "Registre em Chutes a primeira mexida sentida",
      app: "Anote o dia em que sentir a primeira mexida",
    },
    123: {
      site: "Organize seus laudos antigos na aba Exames",
      app: "Organize seus laudos antigos numa pasta",
    },
    125: {
      site: "Tire a foto da barriga da semana 17 no Álbum",
      app: "Tire a foto da barriga da semana 17",
    },
    138: {
      site: "Ouça 10 minutos em Meditações à noite",
      app: "Ouça 10 minutos de meditação à noite",
    },
    139: {
      site: "Compare no Álbum a barriga da 15 e da 19",
      app: "Compare as fotos da barriga da 15 e da 19",
    },
    141: {
      site: "Meça a barriga com fita e anote em Saúde",
      app: "Meça a barriga com fita e anote a medida",
    },
    145: {
      site: "Guarde a imagem do morfológico no Álbum",
      app: "Guarde a imagem do morfológico no celular",
    },
    146: {
      site: "Conte no Diário como foi ver o bebê",
      app: "Escreva como foi ver o bebê no ultrassom",
    },
    150: {
      site: "Avise em Alertas se a dor de cabeça insistir",
      app: "Veja no SOS quando a dor de cabeça é sinal de alerta",
    },
    151: {
      site: "Salve o laudo do morfológico na aba Exames",
      app: "Guarde o laudo do morfológico na sua pasta",
    },
    158: {
      site: "Confira o morfológico na aba Exames",
      app: "Releia com calma o laudo do morfológico",
    },
    161: {
      site: "Registre no Diário o chute mais forte",
      app: "Anote o chute mais forte do dia",
    },
    164: {
      site: "Leia sobre as Braxton Hicks na aba Alertas",
      app: "Descubra o que são as contrações de treino",
    },
    174: {
      site: "Liste 3 dúvidas para levar ao Dr. Clóvis",
      app: "Liste 3 dúvidas para levar ao seu médico",
    },
    179: {
      site: "Guarde o resultado do TOTG na aba Exames",
      app: "Guarde o resultado do TOTG na sua pasta",
    },
    180: {
      site: "Escreva uma carta para o bebê no Diário",
      app: "Escreva uma carta para o bebê",
    },
    188: {
      site: "Anote no Diário o padrão de chutes da semana",
      app: "Anote o padrão de chutes da semana",
    },
    189: {
      site: "Teste a contagem de chutes na aba Chutes",
      app: "Teste a contagem em Movimentos do bebê, na Saúde",
    },
    193: {
      site: "Veja a próxima consulta na aba Consultas",
      app: "Veja a próxima consulta na sua agenda",
    },
    202: {
      site: "Pergunte ao Dr. Clóvis sobre a anti-D",
      app: "Pergunte ao seu médico sobre a anti-D",
    },
    203: {
      site: "Contar 10 movimentos do bebê na aba Chutes",
      app: "Contar 10 movimentos em Movimentos do bebê",
    },
    209: {
      site: "Revisar seus registros da semana no Diário",
      app: "Revisar seus registros da semana na aba Saúde",
    },
    213: {
      site: "Revisar os sinais de pré-eclâmpsia (Alertas)",
      app: "Revisar no SOS os sinais de pré-eclâmpsia",
    },
    215: {
      site: "Ouvir uma meditação de 5 min (Meditações)",
      app: "Ouvir uma meditação de 5 minutos",
    },
    227: {
      site: "Anotar dor de cabeça forte no Diário",
      app: 'Dor de cabeça forte? Abra "Estou com um sintoma"',
    },
    235: {
      site: "Guardar o último resultado na aba Exames",
      app: "Guardar o último resultado na sua pasta",
    },
    236: {
      site: "Escrever um desejo para o bebê no Diário",
      app: "Escrever um desejo para o bebê",
    },
    241: {
      site: "Saber quando abrir a aba Contrações",
      app: "Saber quando abrir Contrações, na aba Saúde",
    },
    250: {
      site: "Tirar a foto de 35 semanas para o Álbum",
      app: "Tirar a foto de 35 semanas",
    },
    257: {
      site: "Escreva no Diário uma carta pro seu bebê",
      app: "Escreva uma carta para o seu bebê",
    },
    271: {
      site: "Ouça 10 minutos em Meditações antes de dormir",
      app: "Ouça 10 minutos de meditação antes de dormir",
    },
    293: {
      site: "Converse sobre indução com o Dr. Clóvis",
      app: "Converse sobre indução com o seu médico",
    },
  };

export type DesafioDoDia = { id: string; emoji: string; label: string };

/** O desafio do dia D da gestação, como o app o mostra (`null` fora de 7–300). */
export function desafioDaGestacao(D: number): DesafioDoDia | null {
  const c = gestChallenge(D);
  if (!c) return null;
  const troca = DESAFIOS_DA_GESTACAO_NO_APP[D];
  return troca && troca.site === c.label ? { ...c, label: troca.app } : c;
}
