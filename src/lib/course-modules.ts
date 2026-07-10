/**
 * Módulos educacionais do pré-natal ("Escola do Bebê") — agora vivem DENTRO da
 * jornada gamificada (aba Caminho), como lições estilo Duolingo: cada semana-
 * chave da gestação tem uma lição com conteúdo + quiz que destrava a moeda de
 * lição no caminho. Compartilhado entre o game (gestacao-path) e o resumo de
 * progresso (minha-conta).
 */

export type CourseModule = {
  week: number;
  title: string;
  theme: string;
  content: string;
  videoSearch: string;
  quiz: { question: string; options: [string, string, string, string]; correct: number }[];
};

export const COURSE_MODULES: CourseModule[] = [
  {
    week: 6,
    title: "O coração começa a bater",
    theme: "Sistema cardiovascular",
    content:
      "Na semana 6, o coração do seu bebê já bate cerca de 100-160 vezes por minuto — é o som mais emocionante da gestação! O embrião mede cerca de 5mm e está se formando rapidamente. O tubo neural, que dará origem ao cérebro e medula espinhal, está se fechando. Os brotos dos braços e pernas também começam a aparecer. Nessa fase é fundamental a suplementação de ácido fólico para prevenir defeitos do tubo neural.",
    videoSearch: "Dr Clóvis Bacha semana 6 gestação desenvolvimento embrião",
    quiz: [
      {
        question: "Quantas vezes por minuto bate o coração fetal na semana 6?",
        options: ["40-60 bpm", "100-160 bpm", "200-240 bpm", "60-80 bpm"],
        correct: 1,
      },
      {
        question: "Qual suplemento é essencial para fechar o tubo neural?",
        options: ["Vitamina C", "Ferro", "Ácido fólico", "Cálcio"],
        correct: 2,
      },
      {
        question: "O que está se formando na semana 6?",
        options: [
          "Dentes e cabelos",
          "Brotos de braços e pernas",
          "Pulmões completos",
          "Sistema imune",
        ],
        correct: 1,
      },
    ],
  },
  {
    week: 8,
    title: "De embrião a feto",
    theme: "Transição embrião→feto",
    content:
      "A semana 8 marca uma virada: seu bebê passa a ser chamado de feto! Mede cerca de 1,6cm e todos os órgãos vitais estão formados — agora vêm amadurecer. Os dedos das mãos começam a se separar, os olhos migram para a frente do rosto, e o rabo embrionário desaparece. O cérebro está se desenvolvendo rapidamente com divisões específicas. Você provavelmente já está sentindo as náuseas do 1º trimestre, causadas pelo hormônio hCG.",
    videoSearch: "Dr Clóvis Bacha semana 8 feto náuseas primeiro trimestre",
    quiz: [
      {
        question: "Como o bebê é chamado a partir da semana 8?",
        options: ["Zigoto", "Embrião", "Feto", "Neonato"],
        correct: 2,
      },
      {
        question: "O que causa as náuseas do 1º trimestre?",
        options: ["Progesterona", "hCG", "Estrogênio", "Oxitocina"],
        correct: 1,
      },
      {
        question: "Quanto mede o feto na semana 8?",
        options: ["0,5 cm", "1,6 cm", "5 cm", "10 cm"],
        correct: 1,
      },
    ],
  },
  {
    week: 10,
    title: "Movimentos e reflexos",
    theme: "Sistema nervoso",
    content:
      "Na semana 10, o feto já faz movimentos espontâneos — mas você ainda não os sente! Mede cerca de 3cm. Os dedos dos pés e das mãos estão completamente separados. O cérebro está produzindo neurônios a uma velocidade incrível: 250.000 por minuto! Os testículos ou ovários já estão se formando. A placenta está assumindo a produção de hormônios, o que geralmente marca o fim das náuseas mais intensas para muitas gestantes.",
    videoSearch: "Dr Clóvis Bacha semana 10 movimentos feto placenta",
    quiz: [
      {
        question: "Quantos neurônios por minuto são produzidos na semana 10?",
        options: ["10.000", "100.000", "250.000", "1.000.000"],
        correct: 2,
      },
      {
        question: "Quando a placenta assume a produção hormonal?",
        options: ["Semana 4", "Semana 10", "Semana 20", "Semana 30"],
        correct: 1,
      },
      {
        question: "O feto já se movimenta na semana 10?",
        options: [
          "Não, só na semana 20",
          "Sim, mas a mãe ainda não sente",
          "Sim, e a mãe já sente",
          "Não, só após o nascimento",
        ],
        correct: 1,
      },
    ],
  },
  {
    week: 12,
    title: "Fim do 1º trimestre — Grande conquista!",
    theme: "Marco gestacional",
    content:
      "Parabéns! O 1º trimestre é considerado o mais crítico e você chegou ao final dele. O risco de abortamento espontâneo cai significativamente. O bebê mede cerca de 5,5cm e pesa 14g. Todos os órgãos estão formados e agora crescem e amadurecem. O bebê já pode chupar o dedo, abrir a boca e fazer movimentos de respiração. A morfológica do 1º trimestre avalia a translucência nucal (risco de síndrome de Down) e é realizada entre as semanas 11 e 14.",
    videoSearch: "Dr Clóvis Bacha semana 12 morfológica primeiro trimestre translucência nucal",
    quiz: [
      {
        question: "O que avalia a translucência nucal?",
        options: [
          "Posição do bebê",
          "Risco de síndrome de Down",
          "Peso fetal",
          "Batimentos cardíacos",
        ],
        correct: 1,
      },
      {
        question: "Quanto mede o bebê na semana 12?",
        options: ["1 cm", "3 cm", "5,5 cm", "12 cm"],
        correct: 2,
      },
      {
        question: "Quando é feita a morfológica do 1º trimestre?",
        options: ["Semanas 6-8", "Semanas 11-14", "Semanas 18-22", "Semanas 28-32"],
        correct: 1,
      },
    ],
  },
  {
    week: 16,
    title: "Primeiros movimentos sentidos",
    theme: "Movimentos fetais",
    content:
      "Por volta da semana 16-18, a maioria das mães primíparas começa a sentir os primeiros movimentos do bebê — chamados de 'perceptio'. Parece um borbulhar ou borboleta no abdômen. O bebê mede cerca de 11,6cm e pesa 100g. O sistema auditivo está bem desenvolvido: o bebê pode ouvir sua voz! Sua pele ainda é transparente. É a época ideal para a amniocentese, se indicada. O bebê tem padrões de sono e vigília.",
    videoSearch: "Dr Clóvis Bacha semana 16 primeiros movimentos bebê percepção",
    quiz: [
      {
        question: "Como se chama a primeira percepção dos movimentos fetais?",
        options: ["Quickening/Perceptio", "Braxton Hicks", "Expulsão", "Versão"],
        correct: 0,
      },
      {
        question: "O bebê consegue ouvir na semana 16?",
        options: [
          "Não, só na semana 30",
          "Sim, o sistema auditivo já está desenvolvido",
          "Só após o nascimento",
          "Apenas sons muito altos",
        ],
        correct: 1,
      },
      {
        question: "Qual exame pode ser feito com segurança entre as semanas 15-18?",
        options: ["Ecocardiograma", "Amniocentese", "Cordocentese", "Biópsia de vilo corial"],
        correct: 1,
      },
    ],
  },
  {
    week: 20,
    title: "Metade da jornada — Morfológica do 2º tri",
    theme: "Anatomia fetal",
    content:
      "Metade da gestação! O bebê mede cerca de 25cm e pesa 300g. A morfológica do 2º trimestre (semanas 20-24) é o exame mais completo: avalia todos os órgãos, face, coluna, coração em detalhes. Você já deve estar sentindo os chutes claramente. O bebê cobre-se de vernix caseosa (substância branca protetora). Os neurônios continuam se multiplicando. É nessa época que muitas famílias descobrem o sexo do bebê.",
    videoSearch: "Dr Clóvis Bacha semana 20 morfológica segundo trimestre anatomia fetal",
    quiz: [
      {
        question: "O que é vernix caseosa?",
        options: [
          "Líquido amniótico",
          "Substância branca que protege a pele fetal",
          "Placenta prévia",
          "Tampão mucoso",
        ],
        correct: 1,
      },
      {
        question: "Quando é feita a morfológica do 2º trimestre?",
        options: ["Semanas 10-12", "Semanas 16-18", "Semanas 20-24", "Semanas 32-36"],
        correct: 2,
      },
      {
        question: "Quanto pesa o bebê na semana 20?",
        options: ["100g", "300g", "800g", "1.500g"],
        correct: 1,
      },
    ],
  },
  {
    week: 24,
    title: "Viabilidade fetal",
    theme: "Desenvolvimento pulmonar",
    content:
      "A semana 24 é um marco: o bebê atinge a chamada viabilidade fetal — com cuidados intensivos neonatais, tem chances de sobreviver fora do útero. Os pulmões começam a produzir surfactante, essencial para a respiração após o nascimento. O bebê abre e fecha os olhos. Pesa cerca de 600g e mede 30cm. O exame de glicemia (TOTG) para detectar diabetes gestacional é realizado entre 24-28 semanas.",
    videoSearch: "Dr Clóvis Bacha semana 24 viabilidade fetal pulmões surfactante",
    quiz: [
      {
        question: "O que é surfactante?",
        options: [
          "Hormônio da gravidez",
          "Substância que amadurece os pulmões fetais",
          "Tipo de antibiótico",
          "Proteína do cordão umbilical",
        ],
        correct: 1,
      },
      {
        question: "Quando é feito o exame de diabetes gestacional (TOTG)?",
        options: ["8-10 semanas", "14-16 semanas", "24-28 semanas", "36-38 semanas"],
        correct: 2,
      },
      {
        question: "A partir de qual semana o bebê tem chance de sobreviver com suporte intensivo?",
        options: ["Semana 18", "Semana 24", "Semana 30", "Semana 36"],
        correct: 1,
      },
    ],
  },
  {
    week: 28,
    title: "Início do 3º trimestre",
    theme: "Crescimento cerebral",
    content:
      "Bem-vinda ao 3º trimestre! O bebê pesa cerca de 1kg e mede 37cm. O cérebro está se desenvolvendo intensamente — as dobras e sulcos do córtex estão se formando. Os olhos respondem à luz. O bebê pode ter soluços que você sente. É hora de começar a contar os chutes (10 movimentos em 2 horas). O exame de streptococo B (GBS) será feito mais adiante. As consultas pré-natais ficam mais frequentes.",
    videoSearch: "Dr Clóvis Bacha semana 28 terceiro trimestre crescimento cerebral",
    quiz: [
      {
        question: "Quanto pesa o bebê na semana 28?",
        options: ["300g", "600g", "1kg", "2kg"],
        correct: 2,
      },
      {
        question: "Quantos movimentos fetais em 2 horas são considerados normais?",
        options: ["2 movimentos", "5 movimentos", "10 movimentos", "20 movimentos"],
        correct: 2,
      },
      {
        question: "O que está se formando intensamente no cérebro fetal no 3º trimestre?",
        options: ["Neurônios", "Sulcos e dobras do córtex", "Nervos ópticos", "Hipófise"],
        correct: 1,
      },
    ],
  },
  {
    week: 32,
    title: "Posicionamento e preparação",
    theme: "Posição fetal",
    content:
      "Na semana 32, o bebê pesa cerca de 1,7kg. A maioria já se vira para a posição cefálica (cabeça para baixo). As contrações de Braxton-Hicks ficam mais frequentes — são ensaios do útero para o parto. O bebê dorme 90% do tempo, com ciclos de sono REM. A gordura subcutânea está se depositando — o bebê está ficando menos enrugado. O ecocardiograma fetal avalia o coração com detalhes e geralmente é feito nessa época.",
    videoSearch: "Dr Clóvis Bacha semana 32 posição fetal Braxton Hicks ecocardiograma",
    quiz: [
      {
        question: "O que são contrações de Braxton-Hicks?",
        options: [
          "Contrações de trabalho de parto",
          "Ensaios do útero, sem dor intensa regular",
          "Sinal de pré-eclâmpsia",
          "Contrações do diafragma",
        ],
        correct: 1,
      },
      {
        question: "Qual é a posição ideal do bebê para o parto vaginal?",
        options: [
          "Pélvica (nádegas para baixo)",
          "Transversa",
          "Cefálica (cabeça para baixo)",
          "Oblíqua",
        ],
        correct: 2,
      },
      {
        question: "Quando é realizado o ecocardiograma fetal?",
        options: ["Semana 6", "Semana 14", "Semanas 28-32", "Semana 38"],
        correct: 2,
      },
    ],
  },
  {
    week: 36,
    title: "Pré-termo tardio — Preparação final",
    theme: "Maturidade fetal",
    content:
      "Na semana 36, o bebê pesa cerca de 2,6kg e está quase pronto. Os pulmões estão maduros na maioria dos casos. A cabeça geralmente encaixa na pelve materna (insinuação). O teste de estreptococo B (GBS) é feito entre as semanas 35-37 — se positivo, você receberá antibióticos durante o parto. O médico avaliará o colo do útero. Bebês nascidos entre 34-36 semanas são chamados de pré-termos tardios e podem precisar de cuidados especiais.",
    videoSearch: "Dr Clóvis Bacha semana 36 pré-termo tardio estreptococo B parto",
    quiz: [
      {
        question: "Quando é feito o exame de estreptococo B (GBS)?",
        options: ["Semanas 12-14", "Semanas 20-22", "Semanas 35-37", "No dia do parto"],
        correct: 2,
      },
      {
        question: "O que é insinuação fetal?",
        options: [
          "Bebê virado de ponta-cabeça",
          "Encaixamento da cabeça na pelve materna",
          "Posição transversa",
          "Bebê com soluço",
        ],
        correct: 1,
      },
      {
        question: "Bebês de que semanas são chamados pré-termos tardios?",
        options: ["20-28 semanas", "28-32 semanas", "34-36 semanas", "37-39 semanas"],
        correct: 2,
      },
    ],
  },
  {
    week: 38,
    title: "Gestação a termo — Sinais do parto",
    theme: "Sinais de trabalho de parto",
    content:
      "A partir de 37 semanas, a gestação é considerada a termo. Agora é esperar os sinais do parto! Perda do tampão mucoso (rolha de muco com sangue — pode sair dias antes). Contrações regulares e progressivas (regra 5-1-1: a cada 5 min, duração de 1 min, por 1 hora). Ruptura da bolsa (líquido claro, inodoro — vá para o hospital). O bebê pesa em média 3,1kg. Fique atenta a movimentos reduzidos — relate ao médico imediatamente.",
    videoSearch: "Dr Clóvis Bacha semana 38 sinais trabalho de parto tampão mucoso contrações",
    quiz: [
      {
        question: "O que é a regra 5-1-1 das contrações?",
        options: [
          "5 respirações, 1 push, 1 hora",
          "Contrações a cada 5 min, com 1 min de duração, por 1 hora",
          "5 horas de trabalho, 1 médico, 1 hospital",
          "Nenhuma das anteriores",
        ],
        correct: 1,
      },
      {
        question: "Se a bolsa rompeu, o líquido deve ser:",
        options: [
          "Verde ou com sangue",
          "Claro e inodoro",
          "Espesso e rosado",
          "Amarelo e com odor",
        ],
        correct: 1,
      },
      {
        question: "Movimentos fetais reduzidos exigem:",
        options: [
          "Esperar 24 horas",
          "Tomar líquidos e descansar",
          "Contato imediato com o médico",
          "Fazer exercícios",
        ],
        correct: 2,
      },
    ],
  },
  {
    week: 40,
    title: "Pré-natal completo — Você chegou!",
    theme: "Pós-parto e amamentação",
    content:
      "Parabéns! Você completou as semanas essenciais do pré-natal. Esteja preparada: o parto pode acontecer em qualquer momento. O bebê pesa em média 3,4kg e mede 51cm. Nas semanas após o parto, você passará pelos lóquios (sangramento pós-parto normal), cuidados com a cicatriz (cesárea ou episiotomia), e início da amamentação. O leite materno exclusivo pelos primeiros 6 meses é a melhor nutrição para o bebê. Cuide de você também — o puerpério pode trazer desafios emocionais.",
    videoSearch: "Dr Clóvis Bacha semana 40 parto pós-parto amamentação puerpério",
    quiz: [
      {
        question: "Como se chama o sangramento normal após o parto?",
        options: ["Menstruação", "Lóquios", "Epistaxis", "Metrorragia"],
        correct: 1,
      },
      {
        question: "Até quando é recomendado o aleitamento materno exclusivo?",
        options: ["2 meses", "4 meses", "6 meses", "12 meses"],
        correct: 2,
      },
      {
        question: "Quanto pesa o bebê na semana 40?",
        options: ["2,2kg", "2,8kg", "3,4kg", "4,2kg"],
        correct: 2,
      },
    ],
  },
];
