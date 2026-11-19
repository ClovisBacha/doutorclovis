# Proposta — a Bolha com IA de verdade

Escrita em 19/11/2026, na noite em que a Bolha virou a guia do app (decisão do
dono: "o bebê bolha vai ser aquele personagem que vai conversar com a mãe [...]
ele tem que ser algo inteligente"). **É uma proposta para o dono decidir, não
uma coisa feita.**

## O que já existe (feito nesta noite, no app)

A Bolha já CONVERSA, sem IA: `mobile/src/lib/bolha/conversa.ts` lê o momento —
a hora, a semana, a chama, o que ela já fez hoje e como disse que está — e
escolhe a fala e as respostas (botões). Ela pergunta como você está, reage ao
humor, sugere o cuidado certo para a hora (de manhã a aula, cansada respirar, à
noite os sons), oferece "outra coisa", aceita "agora não" e comemora o dia
completo. Tudo no aparelho, nada sai dele, e a catraca garante que ela nunca dá
conduta médica.

É a inteligência de um BOM GUIA. O que ela não faz: entender uma frase escrita
livremente ("estou com medo do parto", "o que é diástase?").

## O que mudaria com IA

Ela poderia ter uma caixa de "fala com a Bolha", entender o que a mãe escreve e
responder com acolhimento, explicar o que já está nas aulas e levar ao cuidado
certo.

## O que precisa ser decidido antes (é do dono)

1. **O risco médico.** Uma IA solta responde o que perguntarem, inclusive
   conduta ("posso tomar…", "é normal sangrar…"). O app tem a regra de 21/10:
   não é conselho médico. Uma Bolha com IA precisa de guarda-corpos fortes:
   - responder só a partir do conteúdo do app (as aulas, as atividades) — o
     "portão de cobertura" que o chatbot do site já tem;
   - recusar com gentileza tudo o que for sintoma, remédio, exame ou conduta,
     e oferecer o 192 quando houver sinal de urgência (como o app já faz);
   - uma catraca de saída (as mesmas palavras de conduta da `conversa.test.ts`
     aplicadas à resposta antes de mostrar).
2. **A privacidade.** O que ela escreve sai do aparelho para um provedor de IA.
   O app já tem a régua da permissão de IA (`lib/ia/`, `IA_NO_APP` desligada
   desde 15/10) e o chatbot do site usa o Google Gemini. Ligar pede:
   - a folha de permissão antes do primeiro envio (já existe);
   - Termos e Privacidade novos (`VERSAO_DOS_TERMOS` sobe, o aceite pede de
     novo) e a seção de IA no consentimento;
   - a loja ("Dados usados para…") atualizada.
3. **O custo.** Cada conversa custa centavos; com muitas usuárias, vira conta
   mensal. O site já mediu isso para o chatbot (`src/routes/api/chat.ts`).
   Um limite diário por usuária resolve.
4. **A Apple.** A revisão olha app de saúde com chat de IA com lupa: o aviso
   "não substitui seu médico" na tela e a recusa de conduta precisam estar lá.

## A minha recomendação

Lançar com a Bolha de HOJE (a guia que lê o momento, sem IA), que é segura e
já parece inteligente, e ligar a IA numa segunda fase, só para PERGUNTAS SOBRE
O CONTEÚDO DAS AULAS ("explica de novo o que é o tampão"), com o portão de
cobertura e a recusa de conduta — o caminho que o site já pavimentou. A
conversa livre e emocional ("estou com medo") fica com respostas escritas por
gente e testadas, como as de hoje.

Para começar a segunda fase: dizer sim a esta proposta, escolher o provedor (o
Gemini do site é o caminho mais curto) e aprovar os textos novos de Termos e
Privacidade.
