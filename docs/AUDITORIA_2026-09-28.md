# Auditoria geral diária — 28 de setembro de 2026

Revisão diária recorrente (pedida pelo dono) do código inteiro em busca de
bugs, com cinco agentes especializados cobrindo segurança clínica, agendamento,
o chatbot de IA, as abas da paciente e o painel do médico/admin — seguida de
avaliação de produto sob a ótica de marketing, análise de dados, gestão de
projeto, médico-cliente e gestante-usuária.

**Nenhuma correção foi aplicada neste PR.** É levantamento; a suíte inteira
(`bun test src/`) segue verde — **6.655 testes, 0 falhas** — porque nenhum
código mudou. O dono decide o que vira tarefa e em que ordem.

---

## 1. Bugs encontrados, por severidade

### 🔴 Alto — quebra a regra mais importante do produto: limite clínico duplicado

Dois achados que repetem a classe de defeito que o diário já chama de "o pior
defeito clínico que este repositório já teve" (a régua de glicemia duplicada,
que uma vez mostrou 35 mg/dL em verde). O `CLAUDE.md` proíbe isso
explicitamente: _"Limite clínico mora só em `src/lib/sinais-clinicos.ts`.
Nunca duplique um limite fora dele."_

- **EPDS (rastreio de depressão pós-parto) duplicado**
  `src/lib/clinical.functions.ts:140-146` (`avaliar()`) tem os cortes 13 e 10
  escritos à mão, quando eles já existem como constantes nomeadas em
  `src/lib/epds.ts` (`CORTE_RASTREIO_POSITIVO`, `CORTE_ATENCAO`,
  `nivelDaEpds`). O próprio cabeçalho de `clinical.functions.ts` promete
  _"Nenhum limite clínico mora neste arquivo, de propósito"_ — a promessa foi
  quebrada. Se o corte do EPDS mudar em `epds.ts`, a fila do médico
  (`prontuário`) continua usando o número antigo, e a tela da paciente e o
  painel do médico passam a discordar sobre a mesma resposta de um
  questionário que pergunta sobre ideação suicida.
- **Pressão arterial duplicada em `triage.ts`**
  `src/lib/triage.ts:57,60` tem `>=160/>=110` (vermelho) e `>=140/>=90`
  (amarelo) escritos direto na tela de triagem de sintomas, sem importar de
  `faixaPressao` (`sinais-clinicos.ts:84-85`) e sem nenhum teste amarrando os
  dois. Os números batem hoje; nada impede que parem de bater amanhã.

**Sugestão de correção, não aplicada:** importar as constantes/funções de
`epds.ts` e `sinais-clinicos.ts` nos dois lugares, e adicionar um teste no
molde de `cadeia-do-stripe.test.ts` (que já faz isso para preço) travando os
dois pontos juntos — para essa classe de bug parar de voltar.

### 🔴 Alto — Modo Cuidado vaza no perfil do bebê

`src/components/baby-tab.tsx:409-424` — a ilustração animada do bebê
(`BabyIllustration`) está fora do `{!careMode && ...}` que protege todo o
resto do mesmo bloco (chips, descrição, barra de progresso). `HeartbeatFeel`,
logo abaixo, tem um comentário no código contando que esse mesmo descuido já
mostrou "o coração de {nome}" com som e vibração para uma paciente enlutada —
"a coisa mais dolorosa que este app consegue fazer". `subtabs-do-bebe.ts`
assume que `BabyTab` "já se trata por dentro" para manter a aba Semana aberta
em Modo Cuidado; essa suposição está errada especificamente para a ilustração.
**Cenário:** uma paciente com `care_mode=true` abre Bebê → Semana e ainda vê o
bebê grande flutuando na tela.

### 🔴 Alto — resposta da IA promete um registro que pode nunca ser gravado

`src/routes/api/chat.ts:1096-1119` — quando o plano do médico não inclui IA
(`brain.semPlano`), a rota devolve a resposta pronta **antes** de
`gravacaoDaLacuna` (a gravação em `brain_gaps`, iniciada na linha 1061) ser
aguardada — o `await` normal só acontece dentro de `onFinish`, que este
caminho nunca alcança. A paciente lê **"Registrei a sua pergunta para ele
ver"**, mas se a função serverless for encerrada logo depois de o texto ser
enviado (o mesmo modo de falha que o arquivo já tenta evitar em outros
pontos), a gravação pode não completar — e nada avisa ninguém.

### 🟠 Médio — agendamento: dois caminhos sem a proteção que o terceiro já tem

- **`src/lib/admin.functions.ts:349-358` (`confirmAppointment`)** verifica
  choque só por igualdade exata de data/hora, não por faixa de horário. A
  função irmã `marcarConsultaNoDia` (linhas 533-599) já resolve isso com
  checagem de sobreposição por duração, com o comentário explícito
  "O CHOQUE É DE FAIXA, NÃO DE MINUTO EXATO" — a correção não foi replicada
  aqui. **Cenário:** o médico confirma uma consulta pendente às 14:00 (30 min,
  termina 14:30) e depois confirma outra pendente às 14:15 — a checagem exata
  e o índice único do banco deixam passar, e duas consultas que se sobrepõem
  ficam confirmadas.
- **`src/lib/consultaparticular.functions.ts:312-333`** (agenda de consulta
  particular) grava o horário sem nenhuma checagem de choque contra
  `appointment_requests` ou `doctor_blocks` — só o médico mexe nessa tela, mas
  ele pode marcar em cima de um horário que já tem outra consulta sem saber.
- **Lembrete de consulta remarcada não é reenviado**
  `src/lib/lembretes.ts:69` guarda "já enviei" por `fonte:id:especie`, sem
  data/hora. Se uma consulta confirmada é remarcada dentro de 72h de um
  lembrete já disparado para o horário antigo, o lembrete do horário novo é
  descartado como duplicado. **Cenário:** consulta de segunda 14h com o
  lembrete "4h antes" já enviado; remarcada para quarta 10h no mesmo dia — o
  lembrete de quarta nunca sai, porque a chave já está na lista de enviados.

### 🟠 Médio — broadcast do médico é sequencial, não paralelo

`src/lib/admin.functions.ts:919-956` (`sendDoctorBroadcast`) envia push para
até mil pacientes num `for` sequencial — cada iteração faz pelo menos duas
idas ao banco/rede, uma de cada vez, em vez de `Promise.all` com limite de
concorrência. Um médico com algumas centenas de pacientes clicando "avisar
todas" pode travar a função serverless até o tempo limite da Vercel, sem
nenhum retorno parcial na tela.

### 🟡 Baixo — a classe de bug de fuso horário recorrente ainda aparece

O `CLAUDE.md` já proíbe `toISOString().slice(0,10)` para "hoje" (a régua é
`ymdLocal()`/`ymdBrasilia()`), mas o padrão ainda existe em código servidor
novo:

- **`src/lib/presentes.functions.ts:228`** — um presente agendado para
  revelar num dia pode aparecer até ~3h **antes** da hora, todas as noites
  entre 21h e meia-noite (Brasília = UTC-3), contradizendo o comentário duas
  linhas acima ("O AGENDADO NÃO APARECE PARA ELA ANTES DA HORA — é o recurso
  inteiro").
- **`src/lib/dashboard.functions.ts:163`** — no mesmo horário, uma consulta
  confirmada para hoje à noite deixa de contar como "próxima consulta" no
  painel do médico.
- **`src/lib/retrospectiva.ts:135`**, **`src/lib/exportar-dados.ts:346`** e o
  corte de 14 dias em **`chat.ts:581,600`** (`buildMedidasBlock`) têm o mesmo
  padrão, com impacto menor (janela de cache/exportação, não um limite
  clínico).

### 🟡 Baixo / cosmético

- **`sinais-clinicos.ts:700-711`** (`baseDePressao`) filtra leituras
  implausíveis pelo valor absoluto, mas não exclui um par com sistólica e
  diastólica invertidas ou iguais — esse par entra sem corrigir no cálculo da
  base pessoal de pressão.
- **`glucose_diary.moment`** (jejum/pós-prandial) é projetado pela view
  `clinical_events` mas `avaliar()` nunca o lê — hoje é inofensivo porque não
  existe caminho de escrita para essa tabela em `src/`, mas fica pronto para
  surpreender se um dia existir.
- **`chat.ts:616-654`** pode mostrar a mesma leitura de pressão/glicemia duas
  vezes no prompt da IA (como "última" e de novo em "alterados nos últimos 14
  dias") — desperdiça tokens, não afeta a resposta.
- **Cobertura de teste**: o mecanismo de falha-visível do painel
  (`fonteFalhou`/`incompleto` em `painel.tsx`) não tem um teste dedicado como
  `vazio-nao-e-falha.test.ts`, que hoje só cobre a paciente.

### O que os cinco agentes procuraram e **não** encontraram

Vale registrar, porque é sinal de maturidade real: nenhum vazamento de dado
entre pacientes de médicos diferentes, nenhuma checagem de autorização feita
só no cliente, nenhuma injeção de prompt funcional no chat, nenhum recorte por
`doctor_id` carimbado (histórico) em vez do vínculo atual nas áreas
revisadas hoje, nenhuma leitura falha mostrando lista vazia sem avisar, e o
SOS/cronômetro de contrações corretamente **nunca** somem no Modo Cuidado.

---

## 2. Cinco pontos fracos — o que precisa de esforço agora

1. **A paciente não consegue pagar.** `IAP_ATIVO = false`: falta o plugin de
   compra e a validação de recibo no servidor. Toda a jornada Premium é hoje
   uma vitrine sem caixa — é o maior buraco de receita do produto, e trava
   tudo o que depende dela.
2. **A casca nativa nunca rodou num iPhone de verdade.** Sem conta Apple, sem
   assinatura, sem teste em dispositivo físico. `docs/app-store-revisao.md`
   também aponta rótulo de privacidade e conta de demonstração pendentes —
   itens que reprovam a submissão sozinhos, e nenhum depende de escrever mais
   código.
3. **`src/integrations/supabase/types.ts` cobre 27 de ~128 tabelas.** O `tsc`
   não pega nome de coluna errado fora dessas 27 — e o histórico do projeto já
   teve dois incidentes reais dessa classe (o nome da tabela `preconsulta_forms`
   e a régua de glicemia duplicada). Regenerar os tipos reduz a superfície de
   erro silencioso de forma barata.
4. **A verificação de produção tem dois buracos conhecidos e medidos.** A CI
   não bloqueia o deploy (53 segundos entre o teste reprovar e a Vercel
   publicar o mesmo commit), e a varredura de bancadas abre o servidor de
   desenvolvimento, nunca o build de produção — exatamente onde um defeito de
   hidratação já deixou o app sem abrir. Resolver isso é decisão do dono nos
   dois painéis (Vercel + proteção de branch do GitHub), não no repositório.
5. **Limite clínico duplicado fora de `sinais-clinicos.ts` continua
   acontecendo** (achados de hoje: EPDS e pressão). É a regra mais repetida no
   `CLAUDE.md` porque já causou o incidente mais grave do histórico do
   produto, e ainda depende de vigilância manual — falta um teste automatizado
   que amarre todo lugar que decide gravidade a essa fonte única, como já
   existe para o preço do Stripe.

## 3. Cinco pontos fortes — o que já está maduro

1. **Disciplina de teste.** 6.655 testes, 0 falhas, regra de negócio isolada
   em função pura e testada, fuso fixado em `America/Sao_Paulo` para os
   testes, portão único (`verificar.sh`) que barra tsc/lint/suíte/cobertura
   juntos.
2. **Arquitetura de vínculo atual e RLS.** Os cinco agentes de hoje
   confirmaram, de forma independente, que quase todo ponto de leitura e
   escrita do painel já filtra pelo `doctor_id` **atual** de
   `patient_profiles`, não por um valor histórico carimbado na linha — uma
   decisão arquitetural (`vinculo.server.ts`) bem propagada pelo código.
3. **Modelo de custo e precificação calculados, não estimados.** R$ 0,024 por
   paciente ativa por mês, margem de 64% no plano de topo do médico, preço em
   camadas do Stripe travado por teste (`cadeia-do-stripe.test.ts`) contra o
   código — raro ver essa precisão numa fase pré-receita.
4. **A jornada diária de conteúdo (o Caminho).** 294 dias de gestação + 378
   dias de pós-parto, com auditoria automatizada de cobertura, gabarito e
   repetição (`audit:conteudo`) — um ativo de conteúdo grande, difícil e lento
   de copiar por um concorrente.
5. **A postura de produto com o Modo Cuidado e o luto.** A maioria dos apps de
   gravidez trata a perda como caso de borda; aqui existe uma bandeira
   dedicada, uma varredura já rodada especificamente atrás desse tipo de
   vazamento (a "noite da gamificação") e um vocabulário próprio no código
   para isso — a intenção e a maior parte da execução estão certas, mesmo com
   o vazamento pontual achado hoje.

## 4. Dez novidades que fazem sentido para o negócio

1. **Painel de risco agregado para o médico.** Hoje `clinical_events` mostra
   evento a evento; falta uma visão "quem está piorando" — tendência de
   pressão/glicemia/frequência de sintomas por paciente e por carteira
   inteira, para o médico decidir em quem ligar primeiro no dia.
2. **Resumo pré-consulta em uma página.** Juntar `preconsulta_forms` + saúde
   clínica num PDF/tela de 20 segundos de leitura antes da consulta
   presencial — aumenta o valor percebido do plano pago sem inventar recurso
   novo, só compondo o que já existe.
3. **Fila de prioridade da teleconsulta cruzada com sinais clínicos.** Unir a
   fila de quem pediu consulta com a régua de `sinais-clinicos.ts`, para
   destacar quem pediu consulta **e** já tem sinal amarelo/grave.
4. **Programa de indicação.** Paciente indica outra gestante e ganha
   Sementinhas; médico indica outro médico e ganha desconto na mensalidade —
   alavanca crescimento orgânico num nicho onde aquisição paga é cara.
5. **Selo de "atende alto risco" no diretório de busca.** `encontrar-medico`
   já lista médicos verificados; filtrar/destacar quem atende alto risco ajuda
   a atrair exatamente o segmento que, pelo `brief-paciente.md`, mais paga.
6. **Modo gestação múltipla (gemelar).** Não existe hoje em nenhum lugar do
   código ou da documentação — gestação de alto risco tem proporção relevante
   de gemelares, e é o público central do produto ficando sem conteúdo
   dedicado (cálculos de DPP, tamanho do bebê, riscos específicos).
7. **Subgrupos de comunidade por condição clínica.** `RedeNoApp` já existe;
   agrupar por diabetes gestacional, pré-eclâmpsia, perda anterior ataca
   direto a dor nº 2 do `brief-paciente.md` ("a solidão de quem está
   acompanhada").
8. **Alerta ativo para o parceiro no cronômetro de contrações.** O Modo
   Acompanhante hoje é passivo (só visualiza); notificar o parceiro quando o
   intervalo cruza o limiar de "hora de ir" transforma um observador em
   usuário engajado — e é um canal a mais de quem pode converter em Premium.
9. **Retomar o pós-parto de sono e alimentação.** `docs/pos-nascimento-sono-e-alimentacao.md`
   está "NA FILA" desde agosto, explicitamente esperando a aba do médico
   ficar pronta — e os lotes 1-4 do app iOS (painel, casca) já saíram. Vale
   revisitar a decisão do dono agora que a condição que ele mesmo pôs deixou
   de bloquear.
10. **Restaurar compras + IAP como uma única entrega, não duas.** Não é
    "novidade" no sentido de conteúdo, mas é a peça que faltava para o item 1
    dos pontos fracos virar receita: o `plano-iap.md` já descreve o
    caminho inteiro (produtos → plugin → validação de recibo → restaurar
    compras → oferta introdutória) — o ganho está em não deixar como projeto
    difuso, e sim tratar como uma entrega com essa ordem.

## 5. Quatro óticas, num produto só

### Marketing

O gancho certo já está escrito no `brief-paciente.md`
("ninguém deveria atravessar isso sozinha") e o tom está bem definido — o
risco de marketing hoje não é a mensagem, é a **prova social ausente**: não há
depoimento de médico parceiro real usando o produto para vender o plano dele
(a página `/depoimentos` existe, mas o funil de aquisição de médicos parece
depender de venda direta). Vincular o selo "atende alto risco" (item 5 acima)
a um caso de uso real de um médico pagante seria a peça que falta para o
anúncio B2B.

### Análise de dados

O produto mede custo e conteúdo com rigor (`custo-de-infraestrutura.md`,
`audit:conteudo`) mas **não mede retenção nem conversão** em lugar nenhum do
repositório — nenhum evento de funil (instalou → cadastrou → assinou →
renovou) aparece no código revisado hoje. Sem IAP ainda não há dado de
conversão para medir, mas instrumentar agora (mesmo antes do IAP existir, para
medir intenção de compra nos toques no botão "assinar") custa pouco e evita
decidir preço "no olho" quando a receita começar a entrar.

### Gestão de projeto

A dependência mais crítica do roadmap é sequencial e está exposta:
IAP → receita da paciente → tudo o que o Premium paga depende disso. O
`plano-iap.md` já ordena os passos corretamente; o risco de projeto é o
mesmo do resto do produto — itens que só o dono destrava (conta Apple/Google,
produtos nas lojas) estão intercalados com itens de código, e um atraso na
parte dele atrasa a parte técnica mesmo que ela esteja pronta antes.

### Médico-cliente (o que faria eu pagar)

Como médico que atende alto risco, o que me faria manter a assinatura mês a
mês não é o chat da paciente — é **não perder tempo com falso alarme e não
perder o alarme real**. O painel de risco agregado (novidade #1) e o resumo
pré-consulta (#2) valem mais para mim do que qualquer polimento visual: hoje
eu preciso abrir prontuário por prontuário para saber quem está piorando.

### Gestante-usuária (o que melhora minha experiência)

Como usuária, o que mais me prende ao app no dia a dia — a trilha, o álbum, as
conquistas — já está bem resolvido. O que eu sentiria falta, lendo o que
existe: se eu tiver gêmeos, o app não fala comigo (item 6); e se meu
companheiro só pode olhar, e não ser avisado quando o cronômetro diz que é
hora de ir (item 8), a pessoa que mais precisa saber na hora certa fica de
fora até eu mesma avisar.

---

## Achados críticos (não corrigidos neste PR — apenas documentados)

- EPDS e pressão arterial com limite clínico duplicado fora de
  `sinais-clinicos.ts` (seção 1, 🔴).
- Ilustração do bebê não suprimida pelo Modo Cuidado em `baby-tab.tsx` (seção 1, 🔴).
- Resposta da IA promete registro de pergunta sem garantir a gravação quando o
  médico não tem plano de IA (seção 1, 🔴).
- Confirmação de consulta e agenda particular sem checagem de sobreposição de
  horário (seção 1, 🟠).
- Lembrete de consulta remarcada silenciosamente descartado como duplicado
  (seção 1, 🟠).

## Plano de teste

- [x] Apenas adição de documentação (`docs/AUDITORIA_2026-09-28.md`) —
      nenhuma mudança de código
- [ ] Dono decide quais achados viram tarefas de correção em PRs separados
