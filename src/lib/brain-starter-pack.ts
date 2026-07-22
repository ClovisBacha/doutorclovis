/**
 * Kit de partida do Segundo Cérebro — ~30 dúvidas mais comuns do pré-natal
 * com respostas em condutas CONSOLIDADAS e conservadoras.
 *
 * Instalado sempre como RASCUNHO (approved=false): a IA NÃO usa nada daqui
 * até o médico revisar, ajustar ao próprio estilo e aprovar uma a uma.
 * Resolve o cold start (cérebro vazio no dia 1) sem jamais colocar conduta
 * não validada na boca do médico.
 */
export const BRAIN_STARTER_PACK: { question: string; answer: string }[] = [
  {
    question: "Estou com muito enjoo, o que posso fazer?",
    answer:
      "Náuseas são muito comuns no 1º trimestre. Fracione as refeições (a cada 2-3h), prefira alimentos secos e frios, evite jejum prolongado e cheiros fortes. Gengibre pode ajudar. Se houver vômitos frequentes que impedem você de se alimentar ou hidratar, me avise — existem medicações seguras que podemos usar.",
  },
  {
    question: "Posso tomar dipirona ou paracetamol na gravidez?",
    answer:
      "O paracetamol é o analgésico de escolha na gestação, na menor dose que resolver e por curto período. A dipirona deve ser evitada, especialmente no 3º trimestre. Nunca use anti-inflamatórios (ibuprofeno, nimesulida) sem me consultar. Dor persistente merece avaliação — me conte na consulta.",
  },
  {
    question: "Posso tomar café?",
    answer:
      "Pode, com moderação: até cerca de 200 mg de cafeína por dia (± 1 xícara de café coado), somando também chá preto, mate e refrigerantes de cola.",
  },
  {
    question: "Posso pintar o cabelo?",
    answer:
      "A partir do 2º trimestre, tinturas sem amônia e sem chumbo são consideradas seguras, em ambiente ventilado. Evite alisamentos com formol em qualquer fase.",
  },
  {
    question: "Posso viajar de avião?",
    answer:
      "Em gestação de baixo risco, sim — geralmente até 36 semanas (companhias podem exigir atestado após 28). Levante-se a cada 1-2h, hidrate-se bem e use meias de compressão em voos longos. Me avise antes de viagens longas para avaliarmos o seu caso.",
  },
  {
    question: "Posso ter relações sexuais na gravidez?",
    answer:
      "Na gestação de baixo risco, sim — é seguro em todas as fases, respeitando o seu conforto. Suspenda e me procure se houver sangramento, perda de líquido, dor forte ou se eu tiver orientado repouso pélvico no seu caso.",
  },
  {
    question: "Que exercícios posso fazer?",
    answer:
      "Atividade física regular faz bem para você e o bebê: caminhada, natação, hidroginástica, pilates e musculação orientada, ~150 min/semana em intensidade moderada (você consegue conversar durante). Evite esportes de impacto/queda e exercícios deitada de barriga para cima por longos períodos após o 2º trimestre.",
  },
  {
    question: "Quais chás posso tomar?",
    answer:
      "Com moderação: camomila, erva-cidreira e gengibre são geralmente considerados seguros. Evite boldo, carqueja, canela em grande quantidade, sene, hibisco e arruda. Na dúvida sobre um chá específico, me pergunte antes.",
  },
  {
    question: "Tive um pequeno sangramento, é normal?",
    answer:
      "Pequenos escapes podem acontecer, principalmente no início, mas TODO sangramento merece avaliação. Se for pouco, sem dor e parar sozinho, me avise para conversarmos. Se houver sangramento vivo em quantidade, dor forte ou coágulos, procure a maternidade imediatamente.",
  },
  {
    question: "Quais são os sinais de alerta para procurar a maternidade?",
    answer:
      "Procure a maternidade imediatamente se tiver: sangramento vaginal importante, perda de líquido pela vagina, dor de cabeça forte que não melhora, visão embaçada ou pontos brilhantes, dor intensa no alto da barriga, febre, diminuição importante dos movimentos do bebê ou contrações regulares antes de 37 semanas.",
  },
  {
    question: "O que são as contrações de treinamento (Braxton Hicks)?",
    answer:
      "São contrações irregulares, geralmente indolores e que passam com repouso ou mudança de posição — o útero 'treinando'. Diferente do trabalho de parto, elas NÃO ficam ritmadas nem aumentam de intensidade. Se vierem regulares (ex.: a cada 5-10 min), doloridas e progressivas, aí é hora de avaliar.",
  },
  {
    question: "Com quantas semanas começo a sentir o bebê mexer?",
    answer:
      "Em geral entre 18 e 22 semanas (às vezes um pouco antes em quem já teve filhos). No 3º trimestre, fique atenta ao padrão diário: se notar diminuição clara dos movimentos, faça um teste — coma algo, deite do lado esquerdo e conte; menos de 6 movimentos em 2 horas merece avaliação na maternidade.",
  },
  {
    question: "Quais vacinas devo tomar na gravidez?",
    answer:
      "As recomendadas são: dTpa (tríplice bacteriana acelular, a partir de 20 semanas, em toda gestação), hepatite B (se não imunizada), influenza (em qualquer fase, na campanha) e COVID-19 conforme calendário vigente. Vacinas de vírus vivo (tríplice viral, febre amarela) são evitadas na gestação — converse comigo sobre casos especiais.",
  },
  {
    question: "Para que serve o ácido fólico?",
    answer:
      "Ele reduz o risco de malformações do tubo neural do bebê. O ideal é usar desde antes de engravidar até pelo menos o fim do 1º trimestre (400 mcg/dia na maioria dos casos; doses maiores em situações específicas que eu indico).",
  },
  {
    question: "Quantos ultrassons vou fazer e quando?",
    answer:
      "No pré-natal de baixo risco, os principais são: o inicial (6-9 semanas, para datar a gestação), o morfológico do 1º trimestre (11-14 semanas), o morfológico do 2º trimestre (20-24 semanas) e o obstétrico do 3º trimestre (crescimento e apresentação). Casos específicos podem precisar de exames adicionais — eu oriento conforme o seu caso.",
  },
  {
    question: "O que é o teste de tolerância à glicose (TOTG)? Preciso fazer?",
    answer:
      "É o exame que rastreia diabetes gestacional, feito em geral entre 24 e 28 semanas, com jejum: você colhe glicemia em jejum, toma um líquido com 75g de glicose e colhe mais 2 amostras. É desconfortável, mas importante — o diagnóstico precoce protege você e o bebê.",
  },
  {
    question: "Estou com azia, o que ajuda?",
    answer:
      "Muito comum, principalmente no 3º trimestre. Fracione as refeições, evite deitar logo após comer (espere 1-2h), reduza frituras, café e pimenta, e eleve a cabeceira da cama. Se não melhorar, existem antiácidos seguros na gestação — me pergunte antes de usar por conta própria.",
  },
  {
    question: "Prisão de ventre é normal? O que fazer?",
    answer:
      "Sim, é comum pela ação hormonal e pelo ferro dos suplementos. Aumente fibras (frutas com casca, verduras, aveia), beba bastante água (2-3L/dia) e mantenha atividade física. Se persistir, me avise — há opções seguras que podemos usar.",
  },
  {
    question: "Estou com corrimento, é normal?",
    answer:
      "Um corrimento claro/esbranquiçado, sem cheiro forte e sem coceira, costuma ser fisiológico na gestação. Procure avaliação se houver coceira, ardência, cheiro desagradável, cor amarelada/esverdeada ou se vier acompanhado de dor — pode ser candidíase ou outra infecção que trataremos com segurança.",
  },
  {
    question: "Dor lombar na gravidez: o que posso fazer?",
    answer:
      "Muito comum com o crescimento da barriga. Ajudam: fortalecimento e alongamento orientados, boa postura, calor local, travesseiro entre os joelhos para dormir de lado e calçados confortáveis. Dor que desce para a perna com formigamento, ou dor lombar ritmada antes de 37 semanas, merecem avaliação.",
  },
  {
    question: "Cãibras nas pernas, é normal?",
    answer:
      "Comuns no 2º-3º trimestre, principalmente à noite. Alongue a panturrilha antes de dormir, mantenha boa hidratação e atividade física regular. Se forem muito frequentes, me avise na consulta — às vezes ajustamos suplementação.",
  },
  {
    question: "Inchaço nos pés é normal? Quando me preocupo?",
    answer:
      "Inchaço leve nos pés/tornozelos ao fim do dia é comum, principalmente no calor e no 3º trimestre. Eleve as pernas e use meias de compressão. ATENÇÃO: inchaço súbito de rosto e mãos, principalmente com dor de cabeça ou alteração visual, pode indicar pressão alta — procure avaliação no mesmo dia.",
  },
  {
    question: "Não estou dormindo bem, o que fazer?",
    answer:
      "A insônia é comum, principalmente no 3º trimestre. Tente rotina regular de sono, evitar telas e cafeína à noite, e dormir de lado (o esquerdo melhora o fluxo para o bebê) com travesseiros de apoio. Evite medicações para dormir por conta própria — se estiver muito difícil, conversamos sobre opções seguras.",
  },
  {
    question: "Posso comer peixe? E sushi?",
    answer:
      "Peixe faz bem (ômega-3) — prefira os de baixo mercúrio (sardinha, tilápia, salmão) 2x/semana. Evite carnes e peixes CRUS (sushi/sashimi, carpaccio), além de cação, peixe-espada e atum em excesso. Queijos de leite não pasteurizado também devem ser evitados pelo risco de listeriose.",
  },
  {
    question: "Posso usar adoçante?",
    answer:
      "Com moderação, sucralose e estévia são consideradas seguras na gestação. Evite exageros e, se você tem diabetes gestacional, seguimos o plano alimentar orientado pela nutricionista.",
  },
  {
    question: "Como usar o cinto de segurança com a barriga?",
    answer:
      "Sempre use! A faixa inferior deve passar ABAIXO da barriga, sobre os quadris, e a diagonal entre as mamas, ao lado da barriga — nunca sobre ela. O airbag deve permanecer ativado; afaste um pouco o banco do volante.",
  },
  {
    question: "Posso ir à piscina, praia e sauna?",
    answer:
      "Piscina e mar: sim, ótima atividade. Evite SAUNA, banhos muito quentes e imersão prolongada em água quente (banheira de hidromassagem) — o superaquecimento não faz bem, principalmente no 1º trimestre.",
  },
  {
    question: "Como sei que a bolsa rompeu?",
    answer:
      "Costuma ser uma perda de líquido claro (às vezes em jato, às vezes aos poucos, molhando a roupa íntima repetidamente), diferente de urina ou corrimento. Rompeu ou ficou na dúvida? Anote o horário e a cor do líquido e vá para a maternidade para avaliação — não espere as contrações.",
  },
  {
    question: "Quando devo ir para a maternidade em trabalho de parto?",
    answer:
      "Em geral: contrações regulares e fortes a cada 5 minutos, durando ~1 minuto, por pelo menos 1 hora (padrão 5-1-1) — antes disso, no rompimento da bolsa, sangramento importante ou diminuição dos movimentos. Cada caso tem detalhes; alinharemos o seu plano nas consultas do fim da gestação.",
  },
  {
    question: "O que devo levar na mala da maternidade?",
    answer:
      "Para você: documentos e exames do pré-natal, camisolas com abertura frontal, sutiãs de amamentação, absorventes pós-parto e itens de higiene. Para o bebê: 4-6 bodies e macacões RN, mantas, fraldas RN e a roupa da saída. Deixe pronta por volta de 34-36 semanas. O checklist completo está no app!",
  },
  {
    question: "Suplemento de ferro: precisa mesmo? Faz mal?",
    answer:
      "A suplementação de ferro é recomendada na gestação para prevenir anemia (em geral a partir do 2º trimestre, ou antes se os exames indicarem). Pode causar intestino preso ou náusea — tomar longe do café/leite e junto com vitamina C (suco de laranja) melhora a absorção. Não suspenda sem conversar comigo.",
  },
  {
    question: "Dor de cabeça na gravidez: posso me preocupar?",
    answer:
      "Dor de cabeça leve e ocasional é comum (hormônios, sono, jejum). Sinal de ALERTA: dor forte que não melhora com paracetamol e repouso, principalmente após 20 semanas, com visão embaçada, pontos brilhantes ou inchaço súbito — pode ser pressão alta; procure avaliação no mesmo dia.",
  },
];
