# Dr. Clóvis Bacha — Site

Site institucional e portal do paciente do Dr. Clóvis Bacha, ginecologista e
obstetra especialista em gestação de alto risco. Migrado do Lovable para
desenvolvimento no Claude Code.

## Stack

- **React 19** + **TanStack Start / Router** (SSR, file-based routing)
- **Tailwind CSS 4** + **shadcn/ui** (componentes em `src/components/ui`)
- **Supabase** (auth + banco Postgres)
- **AI SDK** (`ai`) para o chatbot
- **Vite 7** com `@lovable.dev/vite-tanstack-config` (preset de build)
- **Bun** como gerenciador de pacotes

## Comandos

```bash
bun install            # instalar dependências
bun run dev            # servidor de dev (porta 8080)
bun run build          # build de produção
bun run preview        # preview do build
bun run lint           # eslint
bun run format         # prettier --write
```

> **Ambiente sandbox (Claude Code na web):** o Vite tenta escutar em IPv6
> (`:::8080`), que não é suportado aqui. Rode com `bun run dev --host
127.0.0.1 --port 8080`.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os segredos:

```bash
cp .env.example .env
```

- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (+ versões `VITE_`): públicas,
  já preenchidas no `.env.example` (vão para o bundle do navegador).
- `SUPABASE_SERVICE_ROLE_KEY`: **secreto**, usado server-side.
- `GOOGLE_GENERATIVE_AI_API_KEY`: **secreto**, usado pelo chatbot e pela triagem
  de sintomas (ver abaixo).
- `CHAT_MODEL`: opcional, modelo do chatbot (padrão `gemini-2.5-flash`).
- `ADMIN_EMAILS`: e-mails (separados por vírgula) que acessam o **Painel do
  médico** (`/painel`) e recebem aviso de novos agendamentos.
- `RESEND_API_KEY` / `MAIL_FROM`: opcionais, envio de e-mail de confirmação de
  consulta via Resend. Sem a chave, o agendamento funciona, mas não envia e-mail.

O `.env` está no `.gitignore` — nunca commite chaves reais.

> **Banco em dia (ago/2026).** O dono aplicou todos os `APLICAR_*.sql`.
> Conferido por sondagem ao PostgREST: `doctor_slots`, `doctor_blocks`,
> `appointment_reminders` e `private_consultations` respondem 200, e
> `clinical_acks` responde 401 (existe, e a RLS barra o anon — o esperado).
>
> Os `APLICAR_*.sql` continuam idempotentes: rodar de novo é seguro, e é o que
> se faz depois de acrescentar uma migration.
>
> ⚠️ **O nome da tabela é `preconsulta_forms`**, não `pre_consultation_forms`.
> Escrever o segundo custou um pedido de pré-consulta que nunca era enviado, sem
> erro nem log — o chamador tratava a falha de leitura como "todas já
> responderam". `src/lib/tabelas-que-existem.test.ts` confere cada `.from()`
> contra o schema e contra os `APLICAR_*.sql`.

## Deploy (Vercel)

O build usa o preset **vercel** do Nitro e gera `.vercel/output` (Build Output
API), que a Vercel detecta automaticamente. Configurado em `vite.config.ts` e
`vercel.json` (`buildCommand: bun run build`).

Passo a passo (uma vez):

1. Acesse https://vercel.com e entre com o GitHub
2. **Add New → Project** e importe `clovisbacha/doutorclovis`
3. Em **Environment Variables**, adicione as chaves do `.env` (todas as
   `VITE_*` são necessárias no build; `GOOGLE_GENERATIVE_AI_API_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY` no runtime)
4. **Deploy**

Depois disso, cada `git push` atualiza o site: a branch de produção vira a URL
principal e as outras branches ganham uma URL de **preview** automática.

## Estrutura

```
src/
  routes/              # páginas (file-based routing do TanStack)
    index.tsx          # home
    sobre, agendamento, gestacao, batimentos, dpp, calculadora,
    hospitais, lives, mural, depoimentos, mitos, bastidores,
    primeira-consulta, tamanho-real, cards, modo-acompanhante...
    _authenticated/    # rotas que exigem login (minha-conta)
    api/chat.ts        # endpoint do chatbot (streaming)
    __root.tsx         # shell, head/SEO, error boundary, layout
  components/          # componentes do site
    ui/                # shadcn/ui
  integrations/supabase/  # client (browser), client.server, auth middleware
  lib/                 # utils, gestacao, appointments, ai-gateway, config
  server.ts            # wrapper de SSR com tratamento de erro
  start.ts             # middlewares (auth + erro)
supabase/migrations/   # schema do banco
```

## Banco de dados (Supabase)

Tabelas (ver `supabase/migrations/`):
`appointment_requests`, `patient_profiles`, `journal_entries`,
`kick_sessions`, `checklist_items`, `health_logs`, `doctor_questions`,
`companion_invites`.

## Chatbot (AI)

`src/routes/api/chat.ts` usa o **Google Gemini** via Vercel AI SDK
(`streamText` + `@ai-sdk/google`). Configuração em
`src/lib/ai-gateway.server.ts`. Requer `GOOGLE_GENERATIVE_AI_API_KEY`; o modelo
é definido por `CHAT_MODEL` (padrão `gemini-2.5-flash`).

## Conteúdo diário da jornada (Caminho)

Cada dia da jornada tem **duas** peças de conteúdo, ambas indexadas pelo dia
gestacional `D = semana * 7 + diaDaSemana` (0–6):

| Peça                          | Arquivo                              | Cobertura                                                          |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| **Aula da professora** (quiz) | `src/lib/daily-quizzes.data.json`    | gestação D 7–300 (semanas 1–42), 294 dias, 1331 perguntas          |
| **Desafio do dia**            | `src/lib/daily-challenges.data.json` | gestação D 7–300 + pós-parto D 7–90 (12 semanas de vida), 378 dias |

No pós-parto, `D = idade do bebê em dias + 7`.

Ritmo pedagógico por `D % 7` — vale para as duas peças:
`0 bebê · 1 corpo · 2 nutrição · 3 sinais · 4 exames · 5 vínculo · 6 revisão`.

`challengeForDay` / `challengeForPosDay` (em `gestacao-path.tsx`) leem a tabela
primeiro; as listas `CHALLENGES_T1/T2/T3/POSDATA/POS_*` só entram como rede de
segurança para dias fora da faixa (DUM corrigida, gestação além de 42s).

**Desenho da trilha:** todo dia é um nó, inclusive os anteriores à entrada na
jornada — o que separa grátis de premium é o portão da aula (`quizPremium`),
nunca o desenho. A cada 7 dias entra uma `WeekBar` (barra da semana com fruta,
marco, placar de 7 pontinhos), e é nela que mora o álbum da semana — antes era
uma moeda "memória" solta na trilha.

Ao editar o conteúdo, rode a auditoria antes de commitar — ela cobra cobertura
completa, gabarito dentro da faixa, "marque todos" sem todas as alternativas
corretas e enunciado repetido dentro de 14 dias:

```bash
bun run audit:conteudo
```

## Fluxo unificado de eventos clínicos (jul/2026)

O painel do médico enxergava **seis** tabelas. Triagem de sintomas, contrações,
SOS, exames, glicemia, biometria fetal, EPDS e a série pós-parto inteira eram
gravados pela paciente e nunca lidos por ninguém.

Agora existe um contrato só: a view **`clinical_events`** une onze fontes em
`(fonte, fonte_id, user_id, ocorrido_em, especie, dados jsonb, texto)`.

- **É view, não tabela.** Metade das fontes é escrita direto do navegador com a
  chave anon, então materializar a gravidade exigiria trigger em SQL — e a régua
  clínica passaria a viver em dois lugares. A view entrega números CRUS; a
  gravidade sai de `src/lib/sinais-clinicos.ts`, a mesma régua do app da
  paciente. **Nunca duplique um limite clínico fora desse arquivo.**
- **É montada dinamicamente** (`DO` + `to_regclass`): produção tem menos tabelas
  que o repo, e `CREATE VIEW` sobre tabela ausente falharia inteiro. Rode o SQL
  de novo depois de aplicar migrations — a view se amplia sozinha.
- **`security_invoker = true`**: a view respeita a RLS de quem consulta.
- `clinical_acks` guarda o DESFECHO que o médico registra ("já cuidei"), não a
  leitura.

Leitura: `src/lib/clinical.functions.ts` (`eventosQuePedemOlhar`,
`prontuarioDaPaciente`, `fichaClinica`, `registrarDesfecho`, `serieDe`).
Tela: `src/components/prontuario-paciente.tsx`.
Recorte: **sempre** pelo vínculo ATUAL (`patient_profiles.doctor_id`), nunca por
`doctor_id` carimbado na linha de origem.

**Aplicar no Supabase:** `supabase/APLICAR_EVENTOS_CLINICOS.sql` (idempotente).
Ele também traz seis índices que faltavam, as faixas plausíveis (CHECK) e o
`ON DELETE CASCADE` — sem o qual apagar a conta de uma paciente falhava com
violação de chave, tornando a LGPD inexequível.

A IA lê as medidas em `buildMedidasBlock` (`src/routes/api/chat.ts`): última
pressão, última glicemia e até três registros alterados dos últimos 14 dias.
Contexto, não conduta — o portão de cobertura do cérebro continua mandando.

## Resquícios do Lovable (opcional remover)

- `@lovable.dev/vite-tanstack-config` — preset de build (funciona; remover é
  refator grande).
- `src/lib/lovable-error-reporting.ts` — no-op fora do Lovable (usa
  `window.__lovableEvents`).
- `.lovable/project.json` — metadados do template.

## Fluxo de agenda + ciclo/cérebro (IMPLEMENTADO — jul/2026)

Estas eram pendências de backlog; já estão em produção. Precisam do
`supabase/APLICAR_AGENDA.sql` rodado no banco (contraproposta + fila de espera).

### Agenda (contraproposta + fila de espera)

- **Contraproposta**: o médico sugere outro horário (`proposeAppointmentTime`,
  status `counter_proposed`); a paciente aprova/recusa (`respondToProposedTime`).
  Colunas `proposed_date/time` em `appointment_requests`. Backstop de
  double-booking: índice único parcial `appt_confirmed_slot`.
- **Fila de espera por semana** (`appointment_waitlist`): sem horário, a paciente
  entra na fila; ao cancelar uma consulta confirmada, `offerFreedSlot` oferta à
  1ª da fila com prazo de **4h**; sem resposta → cascata pra próxima
  (`sweepWaitlist`). Cascata roda preguiçosa (ao abrir Consultas/Fila) e por cron
  seguro `/api/waitlist-tick` (`CRON_SECRET`). Ver `src/lib/waitlist.functions.ts`.

### Calendário único do mês (ago/2026)

Uma tela só, do mês, juntando as **três** fontes que viviam em abas separadas:
pedidos (`appointment_requests`), teleconsultas e consultas particulares. Régua
em `src/lib/agenda-unificada.ts` (funções puras, sem JSX); grade em
`src/components/calendario-do-mes.tsx`. Legenda por **tipo** — azul presencial,
laranja teleconsulta, roxo particular —, porque o tipo é o que muda o dia dele;
status vira texto ao abrir o dia. O que **não** tem hora combinada aparece
tracejado, nunca como compromisso.

A consulta particular ganhou `scheduled_for timestamptz`
(`supabase/APLICAR_HORA_DA_CONSULTA.sql`, idempotente) — era a única fonte que
não sabia dizer quando acontece. **Uma coluna com fuso, não duas de texto:**
`confirmed_time` aceitar "manhã" já quebrou ordenação. O médico marca no campo
`datetime-local`, que devolve hora sem fuso — a conversão passa por
`deCampoLocal`/`paraCampoLocal` e o servidor recusa string sem fuso
(`z.string().datetime({ offset: true })`). Mandar o valor cru para `timestamptz`
é o erro de três horas que a teleconsulta já teve aqui.

### Painel do médico: quatro grupos de abas (ago/2026)

Eram quinze abas numa fita rolável de uma linha. Hoje são **quatro grupos**
(`src/lib/abas-do-painel.ts` — sem JSX, testado; fita em
`src/components/abas-do-painel.tsx`):

| Grupo            | Telas                                                   |
| ---------------- | ------------------------------------------------------- |
| **Painel 📊**    | Painel, Engajamento, Lives                              |
| **Cérebro 🧠**   | Cérebro, Perguntas                                      |
| **Pacientes 👩‍🍼** | (uma só — pré-consultas e exames são seções dela)       |
| **Agenda 📅**    | (uma só — o Calendário, com pedidos/teles/pagas dentro) |

"Meu Perfil" e "Clínica 🏥" saem da fita e vivem no menu da bolinha
(`FORA_DA_FITA`).

**O Painel é a aba de entrada** (`ABA_DE_ENTRADA`), e isso inverteu a decisão
anterior (Cérebro primeiro). O que mudou não foi gosto: a **fila de trabalho**
saiu do cabeçalho que se repetia em todas as telas e passou a morar dentro do
Painel — com ela dentro, o Painel deixou de ser "o que aconteceu" e virou "o que
ainda precisa dele". O Cérebro é o segundo grupo.

Três regras que os testes cobram (`abas-do-painel.test.ts`, `cota-ia.test.ts`):

1. **O contador sobe para o grupo** (`somaDoGrupo`). O emblema de Pacientes soma
   `novasPacientes + unseenForms` — sem isso o número que faz o médico ir ler
   uma pré-consulta sumiria da fita, e a fusão passaria a esconder trabalho.
2. **A fila de trabalho fica FORA** da `div` que o app nativo esconde para
   mostrar `PainelNoApp`. Lá dentro, ela não existiria no celular.
3. **Toda aba da fita tem bloco de renderização**, e `onIr` do resumo do celular
   é tipado como `PanelTab` — apagar uma aba quebra o build em vez de deixar um
   botão que não faz nada.

Receituário e pedido de exame **não são mais uma aba**: abrem dentro do cartão
da paciente (`AcoesDaPaciente`), com a paciente já escolhida. A dica do painel de
exames vem de `exame-sugerido.ts`, que lê a faixa de semanas **do próprio título
do painel** em vez de duplicá-la; entre as faixas (14–17, 29–31) não há sugestão,
de propósito.

### O calendário é a agenda inteira (ago/2026)

`Agendamentos`, `Teleconsultas` e `Consultas Pagas` deixaram de ser abas: o
Calendário é a tela, e as três listas viraram seções abaixo dele, inteiras.

- **Clicar num dia abre `DiaDaAgenda`** (`src/components/dia-da-agenda.tsx`):
  tela grande com tudo do dia, botão de **marcar consulta** e, nas
  teleconsultas, **abrir a sala e mandar o link**.
- **Marcar funciona para quem NÃO tem conta no app.** `marcarConsultaNoDia`
  (`admin.functions.ts`) insere em `appointment_requests` já `confirmed` —
  nascer `pending` faria a consulta que ele acabou de marcar aparecer na fila
  pedindo que ele a confirmasse.
- **Teleconsulta é a exceção, e ela é dita**: a sala pendura na conta da
  paciente, então exige paciente vinculada. Régua em `validarNovaConsulta`
  (`agenda-unificada.ts`), testada em `marcar-no-dia.test.ts`.
- **O e-mail da paciente vinculada é resolvido no SERVIDOR** — ele mora em
  `auth.users` e nenhuma lista do painel o carrega. A tela manda o `pacienteId`;
  o servidor confere o vínculo (`patient_profiles.doctor_id`) antes de ler o
  e-mail. Sem essa conferência, qualquer `pacienteId` no corpo do pedido
  devolveria o e-mail de qualquer paciente da plataforma.
- **Cores:** 🟢 presencial, 🟠 teleconsulta, 🟣 particular (`CORES_DO_TIPO`).
  O que não tem hora combinada aparece tracejado.

### Duração, contato automático e passado bloqueado (ago/2026)

O calendário virou a agenda inteira; faltavam três coisas para marcar direto
por ele: duração real, telefone da paciente e não deixar marcar no passado.

- **`duracaoMinutos` é campo próprio** (`EventoDaAgenda.duracaoMinutos`,
  coluna `duration_minutes` em `appointment_requests`,
  `supabase/APLICAR_DURACAO_DA_CONSULTA.sql`), não um segundo horário em texto
  — é a mesma lição do `confirmed_time` aceitar "manhã" que já custou três
  horas aqui. `faixaHoraria` (`agenda-unificada.ts`) formata "10:00–10:30" a
  partir de `hora` + `duracaoMinutos`; nunca duas colunas de hora.
- **O choque de horário compara FAIXA, não instante exato.** `validarNovaConsulta`
  (cliente) e `marcarConsultaNoDia` (servidor, `admin.functions.ts`) leem o
  dia inteiro e testam sobreposição de intervalo
  (`inicioNovo < fimExistente && inicioExistente < fimNovo`) — a checagem
  antiga por igualdade de minuto deixava passar uma consulta de 30 min que
  começa 15 minutos depois de outra. As DUAS colunas novas
  (`patient_user_id`, `duration_minutes`) têm recuo próprio contra
  `PGRST204`, uma de cada vez — um recuo que só soubesse tirar a primeira
  quebraria de novo assim que a segunda faltasse num banco que só rodou meio
  SQL.
- **Nada no passado.** `validarNovaConsulta` ganhou um terceiro parâmetro
  (`agora: Date`) e recusa qualquer `dia+hora` anterior a ele — cobre "o dia
  inteiro já passou" e "é hoje, mas a hora já passou" com a mesma comparação,
  sem fuso: `datetime-local` já devolve hora local, e `new Date("YYYY-MM-DDTHH:MM:00")`
  é lida como local pelo ECMAScript.
- **`contatoDaPaciente`** (`admin.functions.ts`) resolve e-mail (de
  `auth.users`, só o servidor lê) e telefone (`patient_profiles.phone`) da
  paciente escolhida no formulário de `DiaDaAgenda`, confirmando o vínculo
  ATUAL antes — nunca antes de conferir, ou qualquer `pacienteId` forjado no
  pedido devolveria o contato de qualquer paciente da plataforma. Um
  `useRef` descarta resposta atrasada se a paciente escolhida mudar no meio
  da busca.
- **A aba virou "Calendário 📅"** (`abas-do-painel.ts`), e o `CalendarioDoMes`
  é o primeiro elemento do corpo da aba — as três seções (Pedidos,
  Teleconsultas, Particulares) continuam abaixo, inteiras.
- **O título duplicado de Teleconsultas** (a seção externa e o componente
  interno mostravam "Teleconsultas" duas vezes) virou um só, na seção
  externa — o texto sobre pré-consulta e nota clínica com IA foi para lá
  também, para não perder a informação.
- **`sendDoctorBroadcast` ganhou filtro por paciente** (`patientIds`
  opcional em `BroadcastSchema`): sem ele, manda para todas, como sempre;
  com ele, o `ids` já recortado pelo médico (`scopedBy`) é **interseção**
  com o `Set` de escolhidas — nunca `ids = data.patientIds` direto, ou um id
  forjado no corpo do pedido mandaria aviso a paciente de outro médico.
  Testado em `agenda-servidor.test.ts`.
- **Aplicar no Supabase:** `supabase/APLICAR_DURACAO_DA_CONSULTA.sql`.

### Lembretes de consulta (24 h e 4 h) — ago/2026

Falta em consultório de alto risco é vaga perdida duas vezes: o médico fica com
o buraco e quem estava na fila não foi chamada.

- **A régua é pura e testada**: `src/lib/lembretes.ts`. A janela é ABERTA
  ("faltam 24 h ou menos e ainda não mandei"), e não uma faixa estreita — cron
  atrasado manda tarde em vez de não mandar, e a ausência de um lembrete não
  deixa rastro nenhum.
- **A de 24 h só vale enquanto faltam mais de 4 h.** Sem isso, uma consulta
  marcada de véspera dispararia as duas no mesmo minuto.
- **O que impede o spam são DUAS coisas**: a régua não repete o que está em
  `appointment_reminders`, e o índice único dessa tabela recusa a segunda
  gravação numa corrida entre dois crons. O registro é gravado ANTES do envio:
  um push perdido é melhor que um push de hora em hora — é o mesmo canal por
  onde chega o aviso de emergência.
- **A pré-consulta usa a MESMA máquina** (espécie `48h_pre`): dois dias antes,
  push pedindo que ela responda. Só para quem tem conta (o formulário vive no
  app) e só se ela ainda não respondeu — pedir o que ela acabou de mandar ensina
  que os avisos deste app não valem leitura. Falha ao ler as respostas trata
  como "já respondeu": errar para o lado de não incomodar.
- **A consulta aponta para a paciente** (`appointment_requests.patient_user_id`,
  `supabase/APLICAR_CONSULTA_DA_PACIENTE.sql`). A tabela nasceu identificando
  por e-mail DIGITADO, e sem esse elo nada downstream funciona — saber se a
  pré-consulta chegou, juntar o que ela registrou entre consultas, pôr a
  consulta na linha do tempo clínica. `NULL` continua válido: consulta de quem
  não tem conta é caso legítimo. O INSERT **repete sem a coluna** (PGRST204) se
  o banco ainda não a tem, para não derrubar o que funcionava antes.
- **Aplicar:** `supabase/APLICAR_LEMBRETES.sql` (rode de novo se você já o
  tinha rodado — o CHECK antigo recusa `48h_pre`) e
  `supabase/APLICAR_CONSULTA_DA_PACIENTE.sql`. **Agendar:** cron de hora em
  hora apontando para `/api/lembretes-tick` com
  `Authorization: Bearer <CRON_SECRET>`. Não está no `vercel.json` de propósito
  — intervalo menor que diário exige plano Pro, e o `waitlist-tick` já segue
  esse mesmo caminho (serviço externo grátis).

### Horários disponíveis e bloqueios (ago/2026)

`doctor_slots` (grade semanal) e `doctor_blocks` (férias, congresso, uma tarde),
em `supabase/APLICAR_DISPONIBILIDADE.sql`. Nascem com `doctor_id NOT NULL` e RLS
própria — as tabelas anteriores foram revogadas por nascerem sem dono e com
política que deixava qualquer autenticado reescrever a agenda do médico.

- Régua em `src/lib/disponibilidade.ts` (pura, sem banco): expandir a grade,
  subtrair bloqueios (**início inclusivo, fim exclusivo**), subtrair o que já
  está marcado, subtrair o passado. Cada borda vale um encaixe por dia.
- **A paciente NÃO calcula os livres no navegador**: saber o que está livre
  exige subtrair consultas de outras pacientes. `horariosLivresDoMedico`
  (service role) devolve só `{dia, hora}`.
- Tela do médico: `GradeDeHorarios`, na aba Calendário. Tela da paciente:
  `EscolherHorario`, em `/agendamento` — só para quem está logada e vinculada;
  visitante continua com os campos livres, porque sem saber o médico não há
  agenda para consultar.
- **Pedido não confirmado NÃO ocupa horário** (é um "quem sabe"). Falha ao ler
  os ocupados devolve erro, e nunca "está tudo livre".

### Gráficos clínicos no prontuário (ago/2026)

`GraficoClinico` (`src/components/grafico-clinico.tsx`) desenha peso, pressão e
glicemia como série temporal, ao lado dos três cartões de "último valor".
Os cartões respondem "como ela está"; o gráfico responde "para onde isso vai" —
peso subindo 200 g/semana e 900 g/semana têm o mesmo último peso na tela.

- **Um gráfico por medida, nunca dois eixos.** Duas escalas fazem qualquer par
  de linhas parecer correlacionado. As duas linhas que dividem um gráfico são
  sistólica e diastólica, que são a mesma unidade.
- **`seriesDePressao` emparelha o PAR do mesmo evento** e calcula a gravidade
  uma vez, para os dois pontos. Duas séries independentes já casaram uma
  sistólica de hoje com uma diastólica de anteontem nesta base. **Nunca** chame
  `sinalPressao(sistolica, 70)` para tirar a gravidade de uma só — 90/70 dispara
  "diferença implausível" e pinta de laranja uma pressão normal.
- **Cor de linha = identidade; cor de ponto = gravidade** (de `sinais-clinicos`,
  nunca uma cópia). A paleta passou nas seis checagens do validador nos dois
  modos, com passo PRÓPRIO para o escuro (a banda dele é L 0,48–0,67).
- **Coordenadas em pixels com proporção mantida** (`viewBox` 600×190,
  `w-full h-auto`): `preserveAspectRatio="none"` esticado deforma os pontos em
  elipses.

### O cartão da paciente (ago/2026)

Abrir uma paciente entregava uma rolagem de ~440 linhas. Hoje são **três abas**
(`src/lib/abas-da-paciente.ts`, testado):

| Aba          | Pergunta                      | Conteúdo                                   |
| ------------ | ----------------------------- | ------------------------------------------ |
| **Agora**    | "o que eu faço com ela hoje?" | quem é, o que pede olhar, o que mudou, SOS |
| **História** | "como ela chegou aqui?"       | gráficos e linha do tempo                  |
| **Ficha**    | "quem ela é?"                 | perfil clínico e a conversa com a IA       |

- **O contador sobe para a aba** (`contadorDaAba`): pendentes + SOS sem
  desfecho, em "Agora". Sem isso a divisão esconderia trabalho clínico.
- "Quem é ela" fica em **Agora**, não em Ficha: 135/88 em 22 e em 38 semanas são
  conversas diferentes.
- `ProntuarioPaciente` ganhou a prop `secoes` em vez de virar três componentes —
  dividir o componente dividiria as chamadas ao servidor.

**A consulta abre pré-preenchida** (`resumo-da-consulta.ts`) com o que ela
registrou desde a última — **só no campo de ACHADOS**. Nunca nos campos de
medida: `consultas.systolic` é o que o médico aferiu, e preenchê-lo com a
pressão que ela mediu em casa faria o prontuário afirmar uma aferição que não
aconteceu.

**A paciente comparada com ela mesma** (`sinalPressaoComBase` em
`sinais-clinicos.ts`): +30/+15 sobre a média das PRIMEIRAS medidas dela. Base
móvel faria a subida lenta arrastar a referência junto. A gravidade final é
sempre a MAIOR entre absoluta e delta — o delta nunca rebaixa um 165/105.

**Quem parou de registrar** entra na fila (`silencio.ts`), no nível mais baixo:
`sinais-clinicos` declara que silêncio NÃO é sinal clínico. Prazo por fase
(7 d ≥36s, 12 d ≥28s, 21 d antes). Recém-cadastrada sem registro não entra.

**Folha para levar** (`folha-da-paciente.tsx`): impressão do navegador, sem
biblioteca de PDF. Carimba data, hora e a origem dos números.

**Modo consulta** (`modo-consulta.tsx` + régua em `src/lib/modo-consulta.ts`):
tela cheia para os quinze minutos com a paciente na frente — idade gestacional
em DIAS no corpo grande, alergias/medicações/risco/sangue, o que mudou desde a
última consulta, e o formulário. Sem gráfico, sem linha do tempo, sem IA.

- **Alergia e medicação aparecem SEMPRE**, mesmo vazias: espaço em branco onde
  deveria estar "alergias" é lido como "não tem alergia".
- **"Nada relatado" ≠ "desconhecido".** Com `ficha.degradada` (ou ficha nula) o
  valor é DESCONHECIDO, em âmbar e com ⚠️ — a diferença entre os dois é uma
  prescrição.
- **`idadeGestacional` mora aqui**, e não mais duplicada no prontuário: uma
  régua que arredonda num dos dois lugares faz a mesma paciente aparecer como
  36s numa tela e 36s6d noutra.
- O formulário é o MESMO `RegistrarConsulta`, e o "o que mudou" é o MESMO texto
  que entra no campo de achados — duas versões divergiriam, e ele leria uma e
  assinaria a outra.

### O bebê bolha ocupou o canto da home, e virou a voz do app (ago/2026)

Pedido do dono: "adicione no canto superior direito o bebê bolha; ele será o
personagem que vai ficar falando as notificações, entre outras interações, e vai
introduzir o app através de um tutorial no primeiro acesso".

A personagem já existia inteira (`bolha.tsx`) — o que faltava era ONDE morar na
tela principal e COMO falar. `mascote-da-home.tsx` é o lugar e a boca; nenhuma
arte nova.

- **O canto direito é o mesmo que a pílula do clima desocupou**, e ele cumpre a
  régua que ela não cumpria: "numa tela cujo assunto é o bebê, o canto tinha de
  dizer algo sobre ele, ou não dizer nada".
- **Duas bolhas na mesma tela é o risco real da mudança** — se as duas lerem
  como a mesma coisa, o app passa a ter dois filhos e o do canto fala. Três
  coisas separam: **tamanho** (44px contra ~236px), **rosto** (a do centro tem
  um FETO, sem olhos; esta pisca) e **lugar** (esta na fileira de ferramentas,
  aquela sozinha no céu).
- **Ficar quieto é metade do valor.** Sem recado ele não diz nada. Personagem
  que fala toda vez que a tela abre vira ruído em três dias — e aí ninguém lê o
  balão no dia em que ele tiver algo urgente.
- **O emblema mostra o NÚMERO, não um ponto**: "tem coisa" obriga a abrir para
  descobrir se vale a pena, e a pergunta que ela faz é quantos. Teto em `9+`,
  que é limite de LARGURA no canto da tela.
- ⚠️ **O ponto vermelho saiu do ☰.** Ele só quis dizer "há recado na central" a
  vida inteira, e agora a central tem um anunciante com rosto. Dois avisos para
  o mesmo fato lêem como assuntos diferentes ("o menu tem algo" · "a bolha tem
  algo"). O acesso pelo ☰ **não** mudou.
- **`fala` é a porta do tutorial**, e a precedência é regra testada: fala
  explícita VENCE recado. Um personagem que muda de assunto no meio da frase não
  ensina nada, e o recado continua lá quando ele terminar.
- **A régua mora em `src/lib/fala-do-mascote.ts`**, longe do JSX: o componente
  importa `bolha.tsx`, que importa cinco `.webp`, e um teste morreria no
  primeiro `import`.
- **O humor sai de `humorDaJornada`**, nunca de um `if` local — o portão de Modo
  Cuidado mora dentro dela, e uma segunda régua faria carinha festiva aparecer
  para quem perdeu a gestação.
- ⚠️ **`w-max` no balão não é estética.** Um absoluto com `right` e sem `left`
  decide a largura por shrink-to-fit contra o CONTAINER — 44px aqui. Sem
  `w-max`, "Tenho 3 recados 💌" saía em três linhas com o emoji sozinho na
  última; `max-w` não resolve, porque ele limita o teto e o problema era o piso.
- **Bancada:** `/preview-home?w=20&notif=3`.
  ⚠️ `quantos` lê o próprio campo antes de `notif`: o router serializa e
  revalida, e na segunda passada `s.notif` já é o booleano `true` — `Number(true)`
  é **1**, então `?notif=3` virava três e depois um. Terceira vez que esta
  armadilha aparece no repo (ver `preview-jogo` e `preview-saude`).

### O bebê bolha ganhou voz, tutorial e caixa de entrada (ago/2026)

Pedido do dono, em três partes: tutorial no primeiro acesso pelos cinco itens
da barra; TODA notificação passando pelo personagem, com número em cima e
leitura por toque; e frases de conforto quando não há recado.

**Os textos ficam em `lib/`, nunca no JSX** — `tutorial-do-mascote.ts` (sete
cartões) e `frases-do-mascote.ts` (22 frases). São o que o dono reescreve; um
texto enterrado em componente é um texto que ele não edita.

- **O holofote sai do `z-index`, e não de máscara.** O véu para em `z-38` e a
  barra vive em `z-40`: a tela apaga, a barra segue acesa e o item pulsa
  (`dc-nav-destaque`). Um `clip-path` com furo precisaria ser recalculado toda
  vez que a barra encolhe ao rolar — e tutorial que aponta para o lugar errado
  é pior que nenhum.
- **A barra continua clicável durante a aula.** Tocar num ícone encerra o
  tutorial e leva até lá: prender a paciente em sete telas para poder usar o
  app que ela acabou de instalar é a definição de tutorial ruim.
- **O tutorial espera o ritual de boas-vindas.** Duas telas cheias no primeiro
  minuto seriam dois tutoriais. Quem ainda vai ver o ritual encontra o tutorial
  na abertura seguinte, com o app já personalizado.
- **Nunca em Modo Cuidado**: quem perdeu a gestação não abre o app para um
  passeio guiado pelas funcionalidades.
- **Abrir a caixa deixou de ser ler tudo.** Quem abria e via cinco recados sem
  tempo de ler perdia o rastro dos cinco, e o emblema zerava sem nada ter sido
  lido. Agora quem marca é o toque em CADA item — e a marcação acontece ANTES
  de executar a ação, porque a ação pode fechar a folha e desmontar tudo.
- **Lida some depois de 7 dias; NÃO lida nunca some.** `lidas` virou
  `Map<id, instante>` (`Map.has()` é a mesma chamada do `Set`, então a folha
  não mudou uma linha). O formato antigo — array de ids — é convertido com o
  instante de AGORA: com zero, tudo que ela já leu sumiria no primeiro
  carregamento da versão nova.
- **O emblema conta sobre a lista JÁ PODADA** (`visiveis`), senão uma
  notificação invisível continuaria puxando o número e ela abriria a caixa
  procurando um recado que não está lá.
- **Uma frase por DIA, não por abertura.** A home remonta a cada toque em
  "Bebê"; um balão novo a cada toque viraria letreiro.
- ⚠️ **A rotação é `dia % n`, e a versão "esperta" quebrou.** A primeira andava
  de 7 em 7, e o próprio comentário avisava que 7 só serve quando `n` não é
  múltiplo de 7 — a lista da MANHÃ tem exatamente 14 frases, e a paciente via
  duas, alternadas, para sempre. O teste pegou; o comentário tinha previsto.
- **As frases nunca cobram e nunca prometem clínica** — há teste com regex
  proibindo "você não fez", "está tudo bem", "vai passar". É a mesma razão pela
  qual a carinha `preocupada` saiu da personagem.
- **`PublicBottomNav` some nas bancadas** (`/preview-*`): ela cobria a navbar na
  bancada do tutorial. O mesmo defeito continua em `/auth`, onde o app
  instalado abre com um botão "Entrar no app" por cima do login.
- **Bancadas:** `/preview-tutorial?nome=Ana` (e `?escura=1`) ·
  `/preview-home?w=20&notif=3`.

### A aba Saúde da paciente ficou clínica (ago/2026)

A aba se chamava Saúde e as duas ferramentas de automonitoramento com mais peso
clínico da gestação estavam **fora** dela: contar movimentos e cronometrar
contrações moravam em Registros, no grupo Gestação. Isso não era arrumação: a
triagem de sintomas mora na Saúde e cita as duas **pelo nome** — "redução dos
movimentos do bebê" e "contrações regulares antes de 37 semanas" são dois dos
nove sintomas VERMELHOS de `triage.ts`. Quem sentia o bebê parado abria Saúde,
encontrava a pergunta, e não tinha como contar dali.

- **Chutes e Contrações entraram como ATALHOS**, não cópias: os ladrilhos
  abrem `Registros` já na sub-tela certa (`destino` + `subDestino` em
  `HUB_SAUDE`, e `RegistrosHub` ganhou `initialSub` como Consultas e Bebê já
  tinham). Duas implementações de contagem de chutes divergiriam no primeiro
  conserto. Testado em `hub-da-saude.test.ts`, que lê `RED_SYMPTOMS` de
  verdade — o teste cobra o VÍNCULO, não a existência do quadrado.
- ⚠️ **A seta de voltar precisou de estado novo** (`voltarAoHub`). O hub abre
  uma aba de outra seção, então `tabToSection("Registros")` não é "saude" e
  `origem` fica vazia — a seta caía na última regra e despejava a paciente na
  tela do bebê. É o mesmo defeito que a regra 2 do `voltarDaBarra` conserta,
  chegando por um caminho novo.
- **"Saúde da mulher" sai da grade durante a gestação** (`mostrarSaudeDaMulher`:
  aparece sem gestação ou a partir da 36ª semana, a régua do Portal Pós-parto).
  Ciclo menstrual não tem o que mostrar por nove meses, e Papanicolau,
  mamografia e perfil lipídico em geral não se faz grávida — dois dos cinco
  quadrados eram para uma mulher que não está grávida, ocupando 40% da tela
  mais clínica do app. **Não tira o acesso**: a aba continua no grupo "Saúde"
  do menu (`SECOES`). A diferença entre "não está aqui agora" e "não existe
  mais" é o que separa arrumar de apagar.
- **O bloco de wearable saiu inteiro** — quatro cartões (SpO₂ · FC · Passos ·
  Sono), os quatro campos e o guia que ensinava a abrir o Apple Health e
  DIGITAR cada número aqui. Nenhum muda conduta obstétrica: era trabalho diário
  da paciente para um dado que nenhuma decisão consulta, e o próprio guia
  admitia que "a integração automática requer aplicativo nativo". Não confundir
  com pressão e glicemia, que ficam — a diferença não é o esforço, é quem lê o
  resultado. As colunas seguem em `health_logs` e o que já foi registrado
  continua à mostra: parar de pedir é uma decisão, apagar o que ela mandou
  seria outra.
- **A lista de registros recolheu, e virou "✏️ Ver e corrigir meus registros".**
  Ela era a terceira cópia dos mesmos números na mesma tela, mas apagá-la
  tiraria uma CAPACIDADE: é o único lugar com o × que apaga um registro. Quem
  digitou 1200 em vez de 120 precisa dele, e o painel do médico pinta a
  gravidade desses números — valor errado que não se pode apagar vira alarme
  falso no consultório.
- **A ordem da grade é clínica**: Saúde · Alertas · Chutes · Contrações ·
  Nutrição · Bem-estar. Alertas subiu para o segundo lugar porque é a tela que
  decide se ela procura atendimento.
- **Bancada:** `/preview-saude?w=20` (grávida, seis quadrados) · `?w=38` e sem
  parâmetro (sete, com Saúde da mulher).
  ⚠️ `validateSearch` usa `q.w == null` e **não** `=== undefined`: o router
  serializa e revalida, então na segunda passada chega `null` — e `Number(null)`
  é **0**. Com o `===`, abrir sem parâmetro terminava em `?w=0` e a grade
  escondia Saúde da mulher como se fosse uma gestante de zero semanas. Mesma
  armadilha que `preview-jogo` documenta para `?tela=`.

### A aba Pacientes mais tecnológica, e a pré-consulta mudou de casa (ago/2026)

- **O quadro da paciente (`PatientMirrorCard`) ganhou rodapé.** Nome branco
  sobre o céu do bebê era bonito e ilegível em metade dos horários, e era a
  ÚNICA informação nítida do quadro. Agora nome da mãe e nome do bebê vivem
  fora da imagem, em texto normal do cartão — legíveis em qualquer hora do
  dia — e o selo de idade gestacional mostra semana **e dia** (`22s3d`), não
  só semana.
- **A pré-consulta saiu da lista solta na aba Pacientes** — pedido do dono:
  "não tem que estar escrito ali". Ela não sumiu: virou um selo "Pré-consulta
  nova" no quadro da paciente e o relatório completo (`PreConsultaCard`,
  reaproveitando o `ficha` que `PatientDetailModal` já carrega — mesma
  chamada que a seção antiga fazia por trás, sem pedir de novo) dentro da
  própria ficha dela, na aba **Agora**. `ContagensDaPaciente` ganhou
  `preConsultaNova` para o contador da aba somar 1 sem depender da seção
  antiga existir — é a mesma regra de "o contador sobe para a aba" aplicada
  de novo, e o teste (`abas-da-paciente.test.ts`) cobra que o valor venha de
  `preConsulta.seen_by_doctor`, não de `false` fixo.
- **A ficha da paciente é quase a tela inteira.** Era um modal de `max-w-3xl`
  centralizado; agora ocupa o viewport quase por completo
  (`h-[100dvh]`/`h-[95svh]` conforme o tamanho de tela) — pedido do dono: "eu
  quero uma tela que ocupe basicamente a tela inteira do computador".
- **"Pedir consulta" ganhou um atalho para o Calendário**, não um jeito novo
  de marcar. Quem escolhe o horário continua sendo SÓ a paciente, no
  Agendamento dela — o botão "🗓️ Ver na Agenda" só fecha a ficha e troca de
  aba, para o médico acompanhar onde o pedido dela vai aparecer quando ela
  responder.
- **A mesada de Sementinhas (`MesadaDoMedico`) mudou de "Meu Perfil" para
  Pacientes** — presentear é uma ação sobre uma paciente, e é ali que ele já
  está olhando a lista delas.

### Cancelar consulta, direto no dia da agenda (ago/2026)

O ✕ mora ao lado de cada compromisso — na faixa de leitura do
`CalendarioDoMes` e na tela grande do dia (`DiaDaAgenda`) — e abre uma
**mensagem** de confirmação ("Cancelar esta consulta com Fulana?" · Sim/Não),
não o mesmo botão virando "tem certeza?": pedido do dono foi por uma
confirmação separada, explicitamente.

- **As três fontes cancelam em três lugares diferentes**, e o prefixo do id
  (`ped:`/`tele:`/`part:`, o mesmo que já distinguia `aoEnviarLink`) decide
  qual: `updateAppointmentStatus` (`appointment_requests`, já existia),
  `updateTeleconsultaStatus` (`teleconsulta_sessions`, ganhou o status
  `cancelada`) e `confirmPaymentForDoctor` (`private_consultations`, já
  aceitava `cancelado`). Nenhuma função nova — só a teleconsulta precisou de
  um status a mais, porque era a única das três sem "cancelada" no enum E no
  CHECK do banco.
- **`podeCancelar`** (`agenda-unificada.ts`, pura, testada) recusa o X em
  situações que já são fim de linha (Cancelada, Recusada, Realizada,
  Encerrada) — um X numa consulta já cancelada seria um botão que promete
  uma ação e não faz nada.
- **`daTeleconsulta`/`daParticular` aprenderam a mostrar "Cancelada"**: sem
  isso, uma teleconsulta cancelada continuava caindo no `else` e aparecendo
  como "Agendada" — a mesma consulta que ele acabou de cancelar, com cara de
  ainda ia acontecer.
- **Aplicar no Supabase:** `supabase/APLICAR_CANCELAR_CONSULTA.sql` (só a
  teleconsulta precisa — as outras duas tabelas já aceitavam o valor).

### O envio de exame (arquivo) saiu do produto (ago/2026)

Pedido do dono: "essa opção de enviar exames em todo o site já não deve
existir mais, pois não vamos ter essa responsabilidade em guardar os
exames". Removida a CAPACIDADE DE ENVIAR — patient e médico — em todo ponto
de entrada:

- **Removidos por inteiro:** `src/lib/exame-do-chat.functions.ts` (upload
  pelo chat), `src/components/exames-recebidos.tsx` (aba "Exames que elas
  enviaram" do painel), a aba "Exames" inteira de `minha-conta.tsx`
  (`ExamesTab`, upload + galeria + preview) e o menu de anexo do chat da
  paciente (o botão "+" só existia para isto — sem outro item, o menu
  inteiro saiu, junto com `handleImage`/`enviarParaOMedico`). `src/lib/abrir-pdf.ts`
  saiu junto — só o preview do laudo em PDF o chamava.
- **`clinical.functions.ts` perdeu só o visualizador dedicado**
  (`examesRecebidos`/`imagemDoExame`/`devolutivaDoExame`) — `EspecieEvento`
  continua com `"exame"`, e `clinical_events` continua unindo `exam_files`:
  os laudos enviados ANTES desta mudança continuam aparecendo na linha do
  tempo genérica da paciente (`prontuarioDaPaciente`) e no resumo "o que
  mudou desde a última consulta", só sem o visor de imagem próprio.
- **A tabela `exam_files`, o balde `exames` e a limpeza de conta
  NÃO SAÍRAM.** Dado já enviado é dado de paciente — apagá-lo é uma decisão
  diferente da de parar de aceitar mais, e mais irreversível. `conta.functions.ts`
  continua varrendo o balde de exames na exclusão de conta (LGPD); é
  justamente esse dado histórico que a varredura protege. Se um dia a
  decisão for apagar o que já existe, é outra migration, deliberada.
- **O WhatsApp do consultório** parou de apontar para "envie pelo app em
  Exames" quando a paciente manda foto/PDF por lá — apontaria para um
  caminho que não existe mais. Agora pede que ela leve o exame na consulta
  ou descreva por texto.
- **Não confundir com "Pedir exame"** (`AcoesDaPaciente`, `TipoDeEmissao`):
  o médico PEDINDO um exame por mensagem de texto é outra função — sempre
  foi um modelo de texto, nunca guardou arquivo, e continua existindo.

### O presente do médico agora CHEGA na paciente (ago/2026)

O médico presenteava Sementinhas (`MesadaDoMedico`), o servidor gravava a linha
em `sementinhas_ledger`, a mesada dele descia e o botão dizia "Enviado ✓". Do
lado dela: **nada**. O saldo subia sozinho e nenhuma tela dizia de onde veio.

Do lado de quem dá o recurso parecia inteiro; do lado de quem recebe, saldo que
sobe sozinho é indistinguível de bug. O desenho da mesada inteira (ele dá, **ela
vê que foi ele**, ela volta) morria no silêncio. A economia tinha 1.300 testes;
a ENTREGA não tinha nenhum — a mesma armadilha de `bonus-e-mesada.test.ts`.

- **`walletPayload` devolve `presente`** (`sementinhas.functions.ts`): a linha
  mais recente de presente nos últimos 30 dias, já com o nome de quem deu.
  Reaproveita o `claimDailyAndGetWallet` que o Caminho já chamava — sem viagem
  nova ao servidor.
- **O portão do Modo Cuidado mora DENTRO de `presenteRecente`**, não em cada
  tela. `presentearPaciente` já recusa enviar no luto, mas o modo pode ser
  ligado DEPOIS de um presente legítimo, e confete para quem acabou de perder a
  gestação é o que o Modo Cuidado existe para impedir.
- **Lê as DUAS razões** (`RAZAO_PRESENTE_MEDICO` e `RAZAO_PRESENTE_AMIGA`): a
  assinante presenteia as amigas pelo mesmo ledger.
- **`AvisoDePresente`** (`gestacao-path.tsx`): bolha comemorando, o NOME de quem
  deu como título e o número embaixo. Nessa ordem — "100 Sementinhas" com o
  remetente em letrinha viraria extrato bancário, e o nome é o ponto inteiro.
  O "já vi" é gravado com prefixo `dc-path-`, então viaja no `journey_state` e
  não reaparece no outro aparelho. A chave é o **instante** da linha, nunca o
  valor: dois presentes de 100 no mesmo mês são duas notícias.
- **Push junto** (`sendPushToUser`), depois do `if (!gravou)` — avisar de um
  presente que não gravou é pior que não avisar. Deep-link `?tab=Caminho`, com
  a caixa exata: `minha-conta` compara com os rótulos de `TABS` e ignora em
  silêncio o que não bate.
- **`nome-do-medico.ts`** nasceu de dois erros simétricos no mesmo dia:
  `Dr(a). ${display_name}` deu "Dr(a). Dr. Clóvis Bacha", e `split(" ")[0]` deu
  "**Dr.** te mandou um presente". `display_name` é campo livre e quase todo
  mundo escreve o título dentro. Régua única, e `aiNameFrom` passou a usá-la.
- **O painel não esquece mais quem já recebeu**: `EstadoDaMesada.presenteadas`
  sai dos `dedupe_key` que a mesada já lia. Era memória do componente — bastava
  recarregar para o botão de uma paciente presenteada voltar a dizer "Dar 30 🌱"
  e o servidor recusar. O formato da chave (`presente:<medico>:<paciente>:<mês>`)
  virou construtor + leitor em `economia-sementinhas.ts`, porque estava escrito
  em três lugares que precisavam concordar.
- **Bancada:** `/preview-jogo?presente=100&quem=Dr.%20Clóvis%20Bacha` desenha o
  aviso sem conta e sem ledger — ele só nasce de uma linha real, e foi por essa
  tela ser impossível de olhar que ela passou tanto tempo não existindo.

Sem migration: tudo sai de colunas que já existem.

### O presente perdeu o limite mensal, e a chave mudou de sentido (ago/2026)

Pedido do dono: "aqui eu posso mandar quantos presentes eu quiser pra cada
paciente, então tira essa limitação". O teto que sobrou é a **mesada** — o
mesmo número que paga a conta. Duas travas para o mesmo risco só serviam para
o médico bater na que ele não escolheu.

- **A `dedupe_key` trocou o CICLO pelo TOKEN DO CLIQUE**
  (`presente:<medico>:<paciente>:<token>`), e essa troca é o ponto todo.
  `grantSementinhas` grava com `ignoreDuplicates`, então a chave é a ÚNICA
  coisa entre um toque nervoso e dois presentes: **apagar o campo faria "sem
  limite" virar "sem defesa"**. O token nasce no navegador, um por clique —
  idempotência por INTENÇÃO, e não por calendário.
- **Achar a linha deixou de ser recusa.** Com o ciclo na chave, `jaExistia`
  queria dizer "ela já ganhou este mês"; com o token, quer dizer "este mesmo
  envio já foi processado" — sucesso, marcado com `repetido: true` para a tela
  não festejar duas vezes. Devolver erro aqui faria ele mandar DE NOVO, com
  token novo, e aí sim gastar a mesada duas vezes.
- **`tokenDePresente` limpa o que vem do cliente** (só `[a-zA-Z0-9-]`): o token
  entra numa chave separada por `:`, e um token forjado com dois-pontos
  deslocaria o parser e creditaria o presente à paciente errada. Vazio depois
  da limpeza vira `null` e o servidor sorteia — string vazia faria todos os
  presentes daquela paciente colidirem numa chave só, o limite de volta pela
  porta dos fundos.
- **`presenteadas: string[]` virou `recebido: Record<string, number>`.** Deixou
  de ser "quem está bloqueada" e virou informação ("já recebeu 90 🌱 este
  mês"), porque não há mais bloqueio. O teste cobra que o número **não**
  desabilite o botão — seria o limite de volta, agora só na tela, que é o pior
  lugar: o servidor aceitaria e a tela recusaria.
- **A mesada da PACIENTE (amigas) mantém o limite de uma por ciclo.** Bolso
  muito menor, e é o que impede uma assinante de despejar o mês numa conta só.
- **Busca por nome** (`src/lib/buscar-paciente.ts`, puro e testado) em vez da
  lista inteira: sem acento, sem caixa, e o nome do BEBÊ também acha ("a mãe da
  Helena"). Mora em `lib/` e não no componente porque `mesada-do-medico.tsx`
  importa `sonner`, que toca `document` ao carregar e derruba o `bun test`
  inteiro — o teste chegou a fazer isso.
- **"Modo Cuidado" virou link azul** com explicação em quatro perguntas (o que
  é · quem liga · o que fica pausado · por que o presente não chega). É
  vocabulário NOSSO, e decidia se a paciente recebia sem nunca se apresentar.
  A explicação diz também o que **não** para (SOS, conversa, registros,
  lembretes), senão o médico lê como paciente desassistida.

### A chama da sequência (ago/2026)

O contador de dias seguidos no topo da trilha ganhou fogo animado — aceso
enquanto a sequência vive, apagado em zero dias.

- **A arte veio em `.webm` com alfa de verdade** (medido: cantos alpha 0, 86%
  transparente), e mesmo assim virou **folha de sprites**. O motivo é o
  iPhone: **WebM com alfa não tem transparência no motor do Safari**, e o app é
  instalado na tela de início — a chama sairia dentro de um retângulo preto, só
  nos iPhones, que é a categoria de defeito que nenhuma máquina de
  desenvolvimento mostra. A folha não passa por codec nenhum, não esbarra em
  política de autoplay e não deixa um `<video>` decodificando num canto.
- 36 quadros, grade 6×6, 128 px por quadro, 83 KB. Animada por DUAS `steps(6)`
  (X varre as colunas, Y desce as linhas — daí a de X durar um sexto da de Y).
  O `to` vai a **120%**, não 100%: `steps(6)` amostra em `i/6`, então 120%
  entrega 0/20/40/60/80/100% — os seis quadros. Parando em 100%, o último
  sumiria e o primeiro apareceria duas vezes.
- **Apagada NÃO carrega a folha**: quem está em zero dias é justamente quem
  acabou de chegar. O desenho de apagado é um contorno, nunca fogo cinza —
  fogo sem cor lê como imagem que falhou.
- **`prefers-reduced-motion` PARA a chama, não a esconde**: apagá-la diria à
  paciente que ela perdeu a sequência.
- **`src/lib/sequencia.ts` unificou TRÊS cópias** do mesmo laço que viviam
  soltas em `gestacao-path.tsx` (gestação, pós-parto e meditação), nenhuma
  testada. A regra que elas repetiam é a que mais importa: **hoje ainda não
  fechado conta a partir de ONTEM** — sem isso, quem tem 40 dias abre o app às
  7h e vê zero. `sequenciaDeDatas` converte ISO → dias inteiros em UTC a partir
  de ano/mês/dia LOCAIS; ler a string crua com `new Date` a trataria como UTC e
  em São Paulo tudo antes das 21h viraria o dia anterior.
- **UM momento já conta o dia** (`diasComAlgumMomento`), e não os cinco. A
  primeira versão lia `doneDays` — o dono fez um exercício, a chama não acendeu,
  e ele estava certo: quem fez três de cinco ficava com o mesmo zero de quem
  não abriu o app. **`doneDays` NÃO mudou** — ele pinta o nó da trilha, solta a
  figurinha da semana e alimenta o total; dar isso por um exercício faria o
  placar de cinco pontinhos mentir. São duas perguntas ("fechou o dia?" e "ela
  veio hoje?") com duas fontes.
- A lista sai das chaves `dc-path-day-<D>` que já existem, e não de uma lista
  nova: assim é **retroativo** (o dia que ela fez antes do deploy conta na
  hora), e uma lista nova nasceria vazia zerando a sequência de todo mundo. Os
  prefixos saem de `LS.dayTasks(0)`/`LS.posDayTasks(0)`, nunca escritos à mão —
  uma cópia divergente faria a chama parar de acender sem erro nenhum.
- **Reproduzível:** `node scripts/sprite-de-video.mjs <video.webm> <destino.webp>
[quadros] [colunas] [larguraDoQuadro]`. Ele ABORTA se a origem não tiver alfa
  (em vez de gravar uma folha opaca) e se os quadros não fecharem a grade (celas
  vazias fariam o desenho sumir por uma fração de segundo a cada volta).
- **Bancada:** `/preview-jogo?streak=7` acende a chama sem conta — ela só arde
  com dias fechados de verdade, e é assim que uma animação entra no app sem
  ninguém nunca ter olhado para ela rodando.

### O troféu das cinco estrelas (ago/2026)

O troféu roxo do topo mostrava `stickers.length` — figurinhas de ÁLBUM DA
SEMANA. O dono olhou e disse a coisa certa: "tenho três conquistas e ele marca
oito, não tem significado nenhum". Agora ele conta **dias de cinco estrelas** e
destranca três itens da loja.

- **A fonte é o LEDGER, e isso é o ponto todo.** Não é `doneDays.length`: esse
  mora no `localStorage` e sobe no blob do `journey_state`, então quem o escreve
  é o navegador — e ele destrancaria item pago.
- **E é a PROVA, não o recibo.** A primeira versão contava as linhas
  `day_stars:<ciclo>:<dia>`. Parecia certo e não era: o dono fechou as cinco
  estrelas e o contador ficou em **zero**. `grantDayStarsBonus` é chamada UMA
  vez, no instante do fechamento, dentro de um `try/catch` que engole erros —
  rede oscilando, sessão expirada ou app fechado antes da resposta e a linha
  nunca é gravada, sem rastro e sem segunda tentativa. Agora a contagem lê as
  linhas `wellness:<atividade>:<ciclo>:<dia>`, uma por atividade, gravadas no
  momento em que cada uma é feita — e que `grantDayStarsBonus` já consultava
  para decidir o bônus. **Sempre foram a prova; `day_stars` era o recibo.**
  Conta dias com as quatro; é retroativo, sem migration; e a força anti-fraude
  é a mesma, porque quem escreve continua sendo só o servidor.
- **O agrupamento carrega o CICLO** (`<ciclo>:<dia>`): sem ele o dia 65 de duas
  gestações viraria um dia só, apagando um troféu de quem já teve outro bebê
  no app. E `ATIVIDADES_POR_TROFEU` sai da mesma lista que grava — já foram
  seis, depois cinco (a respiração virou tema da meditação).
- **O gate é conferido NA COMPRA** (`cantinho.functions.ts`), não só na vitrine
  — cadeado que só existe na tela é decoração. Falha ao contar **recusa**:
  liberar por não ter conseguido contar entrega o item e gasta a Sementinha
  dela do mesmo jeito. **Uma contagem só** serve vitrine e compra (`contarTrofeus`),
  porque dois números para a mesma palavra foi o defeito que abriu isto.
- **A escada** (`TROFEUS_PARA`): Borboleta (74 🌱) → 10, Fim de tarde no deserto
  (240 🌱) → 20, Bolinhas Coração (400 🌱) → 30. O troféu **não substitui o
  preço** — ele diz QUANDO a prateleira aparece. A vitrine mostra "faltam 4 🏆",
  nunca "bloqueado": a segunda frase não dá o que fazer a seguir e faz a
  paciente achar que o item é pago em dinheiro.
- **A comemoração dispara no bloco do dia fechado, e não numa comparação de
  números.** A primeira versão só abria se `novo > antes` — e como a contagem
  daquele momento devolvia 0, `0 > 0` era falso e a animação simplesmente não
  aparecia. Aquele bloco já É o instante da conquista e já roda uma vez por dia
  (`!doneDays.includes(D)`); qualquer condição a mais entre ele e a tela é uma
  chance a mais de a conquista passar em branco. Servidor fora do ar mostra
  `trofeus + 1` — número que se corrige no próximo carregamento é melhor que
  conquista engolida.
- **A comemoração roda UMA vez e para no último quadro** (`forwards`): sem isso
  o troféu some no instante em que a última estrela acende, que é o quadro que a
  tela inteira existe para mostrar. Fecha sozinha em 5,5 s, e **um toque em
  qualquer lugar pula** — a área é a tela toda, não o troféu, porque mirar num
  desenho de 60px que está crescendo é pedir para errar o alvo. `useRef` no
  fechamento: dois toques rápidos avançariam dois troféus com uma conquista só.
- **O ícone do topo NÃO roda em laço**, e aqui ele difere da chama de propósito:
  o **quadro 0 da folha está 100% vazio** (medido) — é uma animação que
  CONSTRÓI o troféu, não um ciclo. Em laço, um ícone de 22px sumiria e
  renasceria a cada 5 s, que lê como imagem quebrada. Fica no último quadro.
- **A fita inteira pousa na LINHA DE BASE** (`src/lib/alinhar-na-linha.ts`).
  `items-center` centra a CAIXA, e cada arte tem margem interna própria — a
  tinta termina a 78,1% da caixa na chama, 89,4% no calendário e 98,3% no
  troféu (medidos). Centradas, as bases caíam em 33,3 · 37,0 · 39,1 numa fita
  cuja base do texto está em 31,5: o troféu ficava pendurado 7,5px abaixo dos
  números, e o dono viu. `deslocamentoDaLinha` recebe altura e fração e devolve
  o `translateY` — px cravado quebraria no primeiro ícone que mudasse de
  tamanho. Depois: 31,67 · 31,67 · 32,00.
  ⚠️ **`baseDaTinta: 1` é sinal de estimativa, não de medição.** Nenhuma das
  quatro artes da fita encosta na borda do quadro — chama acesa 0,7813, chama
  apagada 0,7879, amigas 0,9242, troféu 0,9833. Escrevi `1` duas vezes por
  suposição e as duas custaram uma volta: o ícone das Amigas nasceu 1,67px
  acima da linha (o dono viu) e o contorno da chama apagada, 5,5px. O teste
  `alinhar-na-linha.test.ts` agora recusa qualquer `1`.
  ⚠️ **Medir a tinta DENTRO da fita não funciona**: o `bg-background/95` dela é
  opaco e vira "tinta" em toda linha — foi assim que uma verificação minha
  "aprovou" três ícones desalinhados. Mede-se o ícone isolado sobre fundo
  transparente, ou por diferença de duas fotos **com a chama congelada**
  (`animation-play-state: paused`), senão ela anima entre os dois quadros e a
  diferença vira ruído.
- **O ícone tem caixa de 34px, não 24.** O desenho não preenche o quadro: no
  último quadro ele ocupa 108×89 de 150×120 (medido), 72% da largura. Com 24 o
  troféu saía com ~17px visíveis ao lado de uma chama de 26 — e o dono viu na
  hora. 34 × 0,72 ≈ 24px visíveis. Comparar caixas de arte com margens
  diferentes é comparar o que não se vê.
- **Nitidez:** a origem tem 150px de largura, então a comemoração desenha 200 e
  não 250 — em dsf 3 seriam 750 pixels reais de uma arte de 150. Ampliar o vídeo
  num upscaler NÃO serve: eles devolvem H.264, que não tem canal alfa. O ganho
  real está em exportar a animação em 512px; o conversor já aceita.
- **Bancada:** `/preview-jogo?trofeus=12` põe número no topo;
  `?trofeuNovo=12` abre os 5 segundos inteiros.

### A aba das Amigas (ago/2026)

Pedido do dono: o ícone de "adicionar amigos" substitui o calendário azul da
fita e abre uma aba social "como as amizades do Duolingo", com perfil em
formato de jogo. Três funções: **Cantinho visitável · presente entre amigas ·
dupla de sequência**.

- **O que separa isto do Duolingo é clínico, não estético.** Num app de idioma,
  comparar é ganhar um jogo; aqui é comparar cuidado com o próprio bebê. E
  existe o caso que nenhum app de idioma tem: **uma delas pode perder a
  gestação**. Daí as três regras que atravessam `amigas.ts` inteiro:
  **nada clínico no perfil** (sem semana, sem DPP, sem medida),
  **cooperativo e nunca competitivo** (não há placar), e
  **só quem já se conhece**.
- **O grafo é o da INDICAÇÃO, nos dois sentidos** (`referred_by`). Sem busca,
  sem pedido de estranho, sem aceitar/recusar amizade — para duas contas se
  enxergarem foi preciso que uma mandasse o convite para a outra FORA do app.
  Não é economia de trabalho: é o que torna a aba segura **sem moderação**, num
  lugar onde o risco é conselho médico de leiga e assédio ao mesmo tempo.
- **O vínculo é conferido ANTES de toda leitura** (`saoAmigas`). Sem isso,
  qualquer uuid no corpo do pedido devolveria o Cantinho e o perfil de qualquer
  paciente — o mesmo defeito que `contatoDaPaciente` teve no painel.
- **Modo Cuidado tira a pessoa da aba SEM anunciar.** Ela sai da lista **no
  servidor** (filtrar na tela deixaria o nome viajar pela rede), o perfil
  responde `indisponivel` e nunca o motivo, e a dupla some dos dois lados **sem
  apagar a linha** — quando ela voltar, a dupla volta com a chama que tinham.
  "Fulana saiu" contaria a perda dela para todo mundo.
- **A dupla conta pelo CALENDÁRIO, não pelo dia gestacional.** Às segundas, uma
  pode estar no dia 65 e a outra no 190: intersectar números de dia juntaria
  terças com sábados. A data sai do `created_at` da linha `wellness:`, que o
  servidor carimba. Herda o perdão da meia-noite — e aqui ele importa mais,
  porque sem ele cada uma acharia que a OUTRA deixou cair.
- **O par é ordenado** (`menor < maior`): (A,B) e (B,A) são a mesma linha, senão
  duas convidando uma à outra ao mesmo tempo criam duas duplas e cada tela lê a
  sua. **Uma dupla ATIVA por pessoa** (índice parcial) — duas seriam um placar
  de várias frentes. **Recusar APAGA** a linha: marcar "recusada" bloquearia o
  par para sempre pela chave única.
- **O blob da jornada dela NÃO vai inteiro para a tela**: ele carrega dias
  feitos, notas das aulas e progresso. Só a decoração sai, e **saneada**
  (`saneiaEnfeites`) — é blob escrito pelo navegador dela, e um `s: 900` viraria
  um enfeite cobrindo a tela de quem visita.
- **O "11º dia da jornada" que estava no calendário** não se perdeu: virou o
  "no app há X" do perfil, que conta a mesma história.
- **A fita mostra o NÚMERO de amigas, não a palavra** (`rotuloDeAmigas`), com
  teto em `99+`. O teto é de LARGURA: são quatro itens dividindo a tela de um
  celular, e um "137" empurraria a chama e o troféu de lugar. `tabular-nums` +
  largura mínima de dois dígitos mantêm a fita imóvel entre 1 e 99 (medido: a
  chama e o troféu ficam no mesmo x com 7 e com 12).
- **O contador tem consulta PRÓPRIA** (`contarAmigas`), e não a lista:
  `minhasAmigas` varre o ledger de todas as amigas para calcular chama e
  troféus de cada uma, e a fita abre em toda visita ao Caminho. Os dois contam
  o MESMO conjunto (as em Modo Cuidado fora dos dois) — um contador que diz 5 e
  uma lista que mostra 4 faria a paciente procurar a amiga que sumiu, e é o
  sumiço que não pode ser perguntado.
- **Aplicar no Supabase:** `supabase/APLICAR_DUPLAS.sql`. Só a dupla depende
  dele — `lerDupla` engole a falha e devolve `null`, então lista, perfil,
  Cantinho e presente funcionam antes de ele rodar.

### A Central de Emergência segue o modelo do dono (ago/2026)

A primeira dobra do SOS (`emergency-sheet.tsx`) foi refeita a partir de uma
imagem de referência do Drive. **O que mudou não foi estilo: foi HIERARQUIA.**

Antes, a primeira coisa da tela eram dois botões lado a lado (192 e WhatsApp), e
o "pedir socorro" vinha depois como uma pílula fina. Agora o SOS é um círculo de
66% da largura e os outros números viram "Outras opções" abaixo dele.

A razão é o dedo em pânico: um alvo circular de ~250px acerta-se sem mirar, e é
o ÚNICO caminho da tela que avisa médico e contato de uma vez, com localização,
sem ela digitar nada. Os outros dois exigem que ela saiba o que dizer a um
estranho.

- **A ordem da tela**: título · círculo SOS · "avisa X e Y, **sem você precisar
  escrever nada**" · estado da localização · "Outras opções" · 192 e WhatsApp ·
  CVV. O 193 desceu para depois do CVV — não saiu do app, saiu da disputa pelo
  olho de quem está em pânico.
- **Telefone e pin são DESENHADOS, não emoji.** 📞 sai preto no iOS, e o modelo
  pede vermelho no cartão do 192 e verde no do WhatsApp. Mesma lição do
  calendário da fita: emoji tem cor própria em cada sistema.
- **Cores amostradas da referência**, não estimadas: vermelho do círculo
  `#fd1010→#e80709`, verde do WhatsApp `#2da348→#259941`.
- **O cartão do 192 é CLARO**, e não vermelho cheio: vermelho cheio ao lado do
  círculo do SOS faria dois "botões de emergência" disputando o olho.
- Nenhum estado se perdeu — `sending`/`sent`/`ninguem`, o recuo para 193 quando
  o médico não tem telefone, o aviso de perfil incompleto e o painel de "quem
  foi avisado" continuam iguais.
- **A tela de passagem SE RETIRA — e o WhatsApp continua abrindo sozinho.**
  No app instalado, `window.open` não abre aba: abre uma visão que toma a tela
  inteira, e sem barra de navegador não há botão de voltar. Navegar essa visão
  para `wa.me` a punha fora do nosso alcance, e ela ficava para sempre.
  ⚠️ **A correção NÃO é deixar de abrir.** Tentei isso primeiro e apaguei o
  recurso junto com o defeito — o dono foi claro: "estava funcionando
  perfeitamente, tinha que continuar abrindo e enviando; única coisa é que essa
  tela fica infinita".
  A entrega passou a usar o **esquema do aplicativo** (`esquemaWhatsApp`,
  `whatsapp://send`), que **não navega a página**: ela continua viva, percebe o
  WhatsApp assumir (`visibilitychange` → `document.hidden`) e se fecha. Ao
  voltar, a paciente encontra o app.
  O ouvinte é armado no CARREGAMENTO, não dentro de `__abrir`: entre abrir a
  tela e o servidor responder passam segundos, e sair do app nesse meio
  deixaria ela voltando para a tela verde.
- **Três redes, três falhas diferentes:** recuo para `wa.me` em 1,8 s (WhatsApp
  não instalado), botão "Voltar ao app" (a página web também não abriu), e cão
  de guarda de 12 s no pai (o envio nunca respondeu).
  ⚠️ **Nenhuma crase dentro do `<script>` injetado**: ele mora num template
  literal do TypeScript, e uma crase ali fecha a string. Custou uma volta, e há
  teste cobrando.
- **Bancada:** `/preview-sos` (e `?outro=1` para ver o cartão verde do WhatsApp,
  `?semtel=1` para o recuo, `?vazio=1` para o perfil incompleto).

### Ciclo menstrual + cérebro do paciente

- `buildCycleMoodBlock` em `src/routes/api/chat.ts` injeta no system prompt o
  ciclo (último período, ciclo médio, dia do ciclo, previsão, sintomas) + humor
  recente do diário (só o rótulo `mood`, nunca o conteúdo). É contexto de
  bem-estar (fonte confiável), NÃO conduta — o portão de cobertura do cérebro do
  médico continua mandando. LGPD: dado da própria paciente, na conversa dela.
- Ciclo visual estilo Apple Health: **feito** (anel de fases + calendário
  mensal na aba Ciclo Menstrual). Ver `CicloHero`/`CicloCalendario` em
  `minha-conta.tsx`.

## A tela principal do bebê — quatro céus e a composição nova (ago/2026)

Rebranding pedido pelo dono: "vai ficar muito mais simples". Dez artes em
`.webp` (700 KB, dez faixas de hora) e o ambiente animado por faixa saíram;
entraram **quatro cenas em SVG** (`src/components/ceu-do-dia.tsx`).

| Cena           | Quando (pelo sol)                      | `dark` |
| -------------- | -------------------------------------- | ------ |
| **Amanhecer**  | 50 min antes → 70 min depois do nascer | não    |
| **Dia**        | entre o nascer e o pôr                 | não    |
| **Pôr do sol** | 80 min antes → 30 min depois do pôr    | não    |
| **Anoitecer**  | o resto                                | sim    |

- **SVG e não imagem.** As cenas são malhas de gradiente com três elementos
  (astro, dunas, estrelas): ~2 KB cada em vez de ~70 KB, escalam sem borrar em
  qualquer densidade, e deixam a estrela cintilar (`.dc-estrela`) e o céu
  respirar (`.dc-sky-breathe`) sem um segundo arquivo.
- **A cena cobre a PRIMEIRA DOBRA, não o hero inteiro.** Com `inset-0` o
  `slice` ampliava tudo 1,155× para cobrir os 1104px do hero e a lua saía
  cortada pela borda direita — medido, não suposto. Daí `corDeBaixo`: a cor
  chapada que continua atrás da segunda dobra.
- **`dark` acompanha a ARTE, nunca o relógio** — é ele que decide texto claro
  ou escuro, o vidro dos cartões e a barra de status do iOS.
- **As estrelas têm posição DETERMINÍSTICA** (gerador congruente com semente).
  `Math.random()` daria mismatch de hidratação. E o brilho de cada uma vai em
  `fill-opacity`, porque `.dc-estrela` anima `opacity` e as duas se
  multiplicam — escritas na mesma propriedade, o CSS venceria o atributo e
  todas cintilariam igual.
- **O halo do astro tem quatro `stop`.** Dois caem linear e deixam uma borda
  de disco visível: o halo lê como círculo desenhado em vez de luz.

**A composição seguiu a referência aprovada:**

- Barra de topo: menu à esquerda, **nome do bebê no centro óptico da tela**,
  pílula do clima (ícone do céu + graus) à direita. O nome é posicionado em
  `absolute` com `-translate-x-1/2` e não no fluxo: o botão mede 40px e a
  pílula ~72px, então num `justify-between` ele nasceria fora do eixo — e
  andaria pela tela conforme a pílula do clima carregasse.
- **O cartão de vidro com as três medidas saiu.** Comprimento, peso e fruta
  continuam na aba do Bebê, que é onde ela vai quando quer o detalhe; aqui
  ficou o número da semana apoiado direto na cena.
- **A folga vertical é repartida por três espaçadores com pesos** (1.15 /
  0.72 / 0.85, e uma escala menor em `short:`), tirados das proporções da
  referência — bolha a ~39% da altura, número a ~68%. Antes o botão da bolha
  era `flex-1` e engolia toda a folga, empurrando o número para 90% da altura,
  a 21px da barra de baixo.
- **A barra de navegação inferior não mudou** — estava fora do escopo por
  pedido explícito.

**A barra de progresso MUDOU DE LUGAR (ago/2026)** — e não saiu. Ela mostra
Início · % concluído · Parto previsto, e hoje vive na **área clara**, logo
antes do cartão do médico.

⚠️ **Eu li "tirar da vista" como "apagar" e apaguei.** O dono corrigiu: "não
era tirar esse elemento, e sim posicionar mais embaixo para ficar fora da vista
da tela principal, antes dessa área do seu médico, porém já nessa outra parte
onde o fundo é mais claro". A primeira dobra é do bebê — a bolha e o número da
semana, nada mais; quem rola encontra o resto, e é aí que uma porcentagem cabe,
porque quem rolou escolheu olhar.

O cartão deixou de usar o `glass`: vidro precisa de céu atravessando, e sobre o
creme da página ele vira um retângulo cinza. Agora usa o mesmo material do
cartão do médico, que é o vizinho dele. Medido: a barra começa em 923px numa
tela de 852 (fora da dobra) e antes do médico, em 1012px.

**Os pesos dos espaçadores saíram de medição COM A ÁREA SEGURA injetada.** O
Chromium headless devolve 0 em `env(safe-area-inset-*)`, então a bancada media
uma tela sem a ilha dinâmica nem a barra de gestos — e é essa folga que empurra
a composição no aparelho de verdade. Com 59/34px (iPhone 15 Pro), as folgas
visíveis eram 100,5 / 75,8 / 111,6px; depois de mover 5,5px do último espaçador
para o primeiro (`1.20 / 0.72 / 0.80`), as de fora ficaram em 105,6 e 105,7. O
meio segue MENOR de propósito: elementos próximos lêem como um grupo, e três
folgas iguais fariam a bolha e o número parecerem dois assuntos soltos.

⚠️ **Os três espaçadores SAÍRAM em seguida** (ver a seção abaixo): eles
repartiam a folga entre bolha e número, e o número desceu para a área clara. A
medição fica registrada porque o método — injetar a área segura antes de medir —
continua valendo para tudo que se compõe nessa tela.

### A imagem do dia é o fundo, e a bolha é centrada nela (ago/2026)

Pedido do dono, com o arquivo do Drive na mão ("Referência Imagem Fundo Dia"):
"é literalmente colar lá no fundo… deixar a bolha do bebê centralizada nessa
imagem e maneirar o elemento dos 3 hambúrgueres… os outros elementos vão ficar
embaixo com o fundo rosa claro… **sem expandir a imagem**, ela já está no
tamanho exato que quero".

- **A arte é o fundo da PRIMEIRA TELA INTEIRA** (`.dc-hero-tela`), e o
  `object-cover` do `CeuDoDia` cobre o que falta. Medido: hero de 0 até o pé do
  viewport em 15 Pro, 16 Pro, 16 Pro Max, 13 mini e SE — fresta zero nos cinco.
- ⚠️ **`100svh` NÃO é "uma tela" em todo iOS.** Com `svh` a faixa creme voltou a
  aparecer no aparelho do dono, e a caixa começa em y=0 — então sobrar tela só é
  possível se o `svh` daquele iOS for menor que a tela visível, que é
  literalmente o que `svh` significa (viewport com TODAS as barras à mostra).
  `.dc-hero-tela` usa `lvh` com `svh` de reserva, nas duas declarações da mesma
  propriedade. **Não é `dvh`**: `dvh` muda enquanto se rola e faria a bolha
  pular de lugar. Sobrar céu é invisível; faltar céu é o defeito.
- **A EMENDA é a segunda defesa, e vale mesmo se a primeira falhar.** Logo
  abaixo do hero há uma faixa de 8rem que sai de `corDeBaixo` (o último pixel da
  arte, amostrado) e desmancha no `--background`. O que saltava aos olhos não
  era a faixa existir — era ela ser uma ARESTA entre a foto e o creme. Com a
  emenda, um aparelho que ainda feche o céu cedo mostra a cor do pé da cena
  continuando. O degradê termina em `var(--background)` explícito e não em
  `transparent`, que é preto-transparente e deixaria o meio acinzentado. O Céu
  Clássico fica de fora: ele não tem `corDeBaixo` amostrado, e inventar uma cor
  seria pintar a emenda errada.
- ⚠️ **"Colar sem expandir" e "preencher a tela" só são compatíveis num
  aparelho com EXATAMENTE a proporção da arte, e nenhum iPhone tem.** A caixa
  chegou a ser `aspect-[853/1844]` (a proporção do arquivo) para atender "ela já
  está no tamanho exato que quero"; o dono olhou no aparelho e devolveu o
  defeito: "embaixo ainda não está totalmente preenchido". A arte é 2,1618, um
  15 Pro é 2,168 e um 16 Pro é 2,174 — a caixa fechava alguns pixels antes do
  fim e o creme da página aparecia por baixo do céu. Com `100svh` o `cover`
  amplia **0,16% a 0,57%** nos iPhones reais (medido), que não é o "esticar"
  que o pedido barrava: aquilo era a arte puxada para um hero de altura
  arbitrária, com a lua saindo cortada.
- ⚠️ **`aspect-ratio` + `max-height` encolhe a LARGURA** se a largura for
  `auto`. No iPhone SE o hero nasceu com 308px em vez de 375 — a arte inteira
  deslocada para o meio da tela. Custou uma volta antes de a proporção sair de
  vez; não reintroduza `aspect-ratio` aqui.
- **Os quatro campos da cena foram MEDIDOS de novo** por
  `node scripts/ceu-do-drive.mjs <origem.png> <destino.webp> [largura]`, que
  converte e mede no mesmo passe. O dia virou a TERCEIRA cena a inverter o
  brilho entre as pontas: topo 0,118 (escuro) e base 0,524. Herdar o
  `topoEscuro: false` da arte antiga poria o nome do bebê em índigo sobre
  azul-cobalto — o defeito que fez estes serem dois booleanos e não um. Medido
  depois: o nome passa a 16,38:1 no dia novo.
- ⚠️ **A arte do dia tem 853 de largura**, e as outras três têm 1440. Ela não
  passou por upscale — o que salvou o anoitecer foi feito FORA (Higgsfield) e só
  depois reduzido aqui, e ampliar no script não inventa detalhe. Num iPhone Pro
  (densidade 3) o navegador estica a arte do dia em 1,38×.
- **`dc-sky-breathe` saiu do céu** (o CSS ficou, sem uso). O respiro era um zoom
  de 4% a 7,5% — recorte lento de uma imagem que o dono disse estar no tamanho
  exato. A vida da cena continua em `CeuEfeitos`, que anima o que está POR CIMA
  da arte.
- **Sobre a arte ficaram DUAS coisas**: a barra de topo (traço do menu + nome do
  bebê) e a bolha, centrada por uma camada `absolute inset-0` do hero.
  `inset-0` num filho de container com padding pega a caixa de preenchimento
  inteira, então o `px-5`/`pt` não desloca o centro — medido: o centro da bolha
  e o centro do hero batem em todos os aparelhos testados.
- **O botão do menu perdeu a pastilha de vidro** ("maneirar"). Ficou o traço,
  com o ALVO ainda de 40px: quem some é o desenho, não a área que o dedo acerta.
  A cor segue `topoEscuro` — branco sobre topo escuro, índigo sobre topo claro;
  branco fixo sumiria no amanhecer, que é a cena de topo mais claro.
- **Desceu para o fundo claro** o cartão de saudação do clima. Ele largou o
  `glass` pelo material do cartão, pela MESMA razão da barra de progresso —
  vidro precisa de céu atravessando, e sobre o creme vira retângulo cinza. Com
  ele saíram `glassLeve`, `glass`, `tracoDeVidro`, `cardText` e `cardMuted`,
  que existiam só para material sobre arte.
- **`scripts/contraste-hero.mjs` ganhou uma trava**: alvo fora do viewport
  REPROVA com o motivo escrito, em vez de o Playwright estourar num recorte
  vazio.

### O número voltou para o meio, entre a bolha e a barra (ago/2026)

Pedido do dono na volta seguinte: "coloque o número 20 semanas ali no meio
entre a bolha e a navbar". Ele tinha descido para o fundo claro por uma volta
só; voltou para cima da arte, e agora com lugar definido.

- **A bolha e o número são DUAS camadas, não uma coluna.** Tentei a coluna
  primeiro — dois `flex-1` em volta da bolha, com o `pb` da barra flutuante
  dentro do item de baixo — e a bolha saiu **65px acima do centro**, medido.
  ⚠️ **Num item flex, `flex-basis: 0%` mede a caixa de CONTEÚDO e o padding
  entra por fora**: os 130px reservados para a barra viraram 130px a mais no
  item de baixo. Padding não é neutro num item flexível.
- **A camada do número começa em `top-1/2`** e vai até `bottom-0`. Num bloco
  posicionado com topo E base presos, o padding não muda o tamanho de fora —
  só encolhe o miolo. Então `pt` de meia bolha + `pb` da barra recortam
  exatamente o vão, e `items-center` põe o número no meio dele. Medido no
  iPhone 15 Pro: bolha termina em 543,8 · número em 622,7 · barra em ~719,6.
- O `min(60vw,19.5rem,38svh)` do `pt` é o MESMO da caixa da bolha, e tem de
  continuar sendo: é meia bolha que ele reserva.
- O halo (`overArt`) e as cores de céu (`heroText`, `corDoCorpo`,
  `INDIGO_CORPO`) voltaram junto, e `contraste-hero.mjs` voltou a medir
  `numero` e `semanas`. No dia isso importa mais que antes: a faixa amarela do
  horizonte da arte nova passa bem atrás dos dígitos. Doze medições passam
  (o pior é 6,74:1 no amanhecer, contra 4,5 de mínimo).

### Os bebês são os cinco do Drive (ago/2026)

Pedido do dono: "tire todos os bebês e só coloque os que tem no drive, na
qualidade exata deles, não perca a qualidade".

Saíram DUAS séries: os cinco PNGs por estágio (`baby-embriao` e companhia) e os
39 `.webp` gerados semana a semana. Entraram cinco artes — 6, 10, 20, 30 e 40
semanas — em `src/assets/bebes/semana-NN.webp`.

- **Três das cinco chegaram SEM canal alfa**, com o XADREZ de transparência
  gravado como pixel (dois cinzas neutros, 254 e 241/243/246, em células
  grandes). É o que acontece quando o editor mostra transparência em xadrez e a
  exportação salva em RGB. No app viraria um retângulo quadriculado dentro da
  bolha — invisível no editor, só aparece sobre o céu.
- **O recorte não é limiar de brilho**, que comeria os reflexos claros da testa.
  São três testes juntos, em `scripts/bebes/do-drive.mjs`: **croma** (o xadrez é
  neutro, a pele nunca é), **brilho** (rampa de 250 a 220 no canal mais escuro,
  que dá borda suave e salva o cordão que se apaga em degradê por ~150px) e
  **conexão com a borda do quadro** (reflexo no meio da testa não alcança a
  borda, então fica opaco por construção). Depois a cor é
  DES-PREMULTIPLICADA — sem isso sobra auréola clara, que é o xadrez ainda
  misturado ao pixel.
- **"Não perca a qualidade" é medido, não afirmado.** O script não aceita
  largura de saída (nunca reduz) e imprime o PSNR contra a origem, reprovando
  abaixo de 42 dB. As cinco saíram entre **46,8 e 52,2 dB** — a mesma faixa com
  que os céus foram aprovados. Total: 548 KB, e só uma carrega por vez.
- **A semana escolhe a arte MAIS PRÓXIMA, com empate para a mais NOVA**
  (4–8 → 6 · 9–15 → 10 · 16–25 → 20 · 26–35 → 30 · 36–42 → 40). Empate para
  baixo não é detalhe: mostrar um bebê mais desenvolvido do que ele está
  antecipa marcos — cabelo, unhas, gordura — que ainda não existem.
- **`tinta` é MEDIDA por arte** (58,6% · 64% · 81,3% · 71,1% · 91,4% do maior
  lado, α ≥ 128) e é ela que `escalaDoCorpo` divide. Sem isso a semana 36
  mostraria um bebê 56% maior que a 35 sem nada ter acontecido — o salto não
  seria crescimento, seria o enquadramento do arquivo mudando. **Trocar um
  arquivo obriga a medir de novo**; o script imprime o valor.
- **O que ainda muda toda semana é o TAMANHO**: `escalaDoCorpo` é contínuo na
  semana, então entre a 20 e a 21 o bebê cresce mesmo desenhado pela mesma
  arte. Cinco desenhos não viraram cinco tamanhos.
- `scripts/bebes/olhar.mjs` responde as três perguntas antes de qualquer
  conversão: tem alfa de verdade? o fundo é xadrez gravado? que fração da caixa
  a tinta ocupa?

**Bancada:** `/preview-home?w=20` renderiza a tela real sem login (`?clima=1`
liga o clima). Para medir composição, injete
`:root{--safe-area-inset-top:59px;--safe-area-inset-bottom:34px}` — sem isso
você mede uma tela que não existe em nenhum iPhone. O céu vem do relógio do navegador, então o Playwright o escolhe
com `page.clock.setFixedTime` — sempre com offset explícito (`-03:00`), senão
o fuso do contêiner (UTC) muda a cena.

**O Céu Clássico (`sky_theme = "v1"`) continua de pé.** É item pago da Loja
(150 🌱); as dez artes eram o tema padrão, este é a alternativa que alguém
comprou. Apagá-la seria tirar da paciente uma coisa que ela pagou.

## Experiência "app de milhões" (IMPLEMENTADO — jul/2026)

- **Movimento**: primitivas `Reveal`/`Stagger`/`StaggerItem` em
  `src/components/motion-primitives.tsx` (usam `motion`, respeitam
  `prefers-reduced-motion`). Aplicadas na home (Bebê) e no Ciclo visual.
- **Onboarding**: `OnboardingRitual` (primeiro acesso, escreve nos campos do
  Perfil; sem coluna nova; "pular" lembrado em `localStorage`).
- **Celebração**: `src/lib/celebrate.ts` (confete em canvas + som Web Audio +
  vibração). Marco de nova semana em `WeekMilestoneModal`. Nunca em Modo Cuidado.

## Notificações push (IMPLEMENTADO — jul/2026)

Web Push **sem dependência externa** — o envio é 100% `node:crypto`
(`src/lib/push.server.ts`: aes128gcm RFC 8291/8188 + VAPID ES256 RFC 8292),
validado contra a lib `web-push` como oráculo. Cliente inscreve em
`src/lib/push.ts` → tabela `push_subscriptions` (RLS).

**Para ATIVAR (env vars):**

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (servidor).
- `VITE_VAPID_PUBLIC_KEY` = **mesma** pública (vai pro navegador).
- Gere com `npx web-push generate-vapid-keys` (ou peça ao Claude). Sem as
  chaves, tudo vira no-op — nada quebra. iPhone só recebe push com o app
  **instalado na Tela de Início** (iOS 16.4+).

**Gatilhos:**

- **Consulta** (evento): confirmação, contraproposta e vaga liberada disparam
  push junto com o e-mail (`sendPushToEmail` em `admin.functions`/`waitlist`).
- **Dicas semanais**: `/api/push-weekly-tick` (cron diário no `vercel.json`,
  `CRON_SECRET`). Stateless — notifica quem tem `gest.days === 0`.
- **Envio manual**: `sendDoctorBroadcast` (painel → aba Agendamentos), escopado
  por `doctor_id`.

## Voz do app (DECIDIDO — ago/2026)

A voz guiada da meditação e da respiração é **Isabella no motor ElevenLabs**
(`text2speech_v2`, `variant: elevenlabs`, `voice_id`
`80924413-1ea8-4e64-9719-e00b86796f05`). Use essa mesma voz em tudo que precisar
falar — meditação, respiração, movimento, qualquer narração futura. Voz que muda
entre telas soa como outro produto.

Foram testados quatro caminhos antes: `seed_audio` (ByteDance) em duas vozes, e
`text2speech_v2` nos motores ElevenLabs e MiniMax. As 57 vozes do catálogo têm
nome inglês e nenhuma é pt-BR nativa, então **o sotaque vem do motor, não da
voz** — o `seed_audio` trata português como língua secundária e sai soando
europeu. A comparação que decidiu foi a mesma voz (Isabella) em dois motores.

O `speechSynthesis` do navegador (`src/lib/fala.ts`) **está para sair**. Ele só
toca vozes instaladas no sistema da paciente: não dá para escolher, não dá para
instalar, e no Android padrão é justamente a robótica. Como os textos de
meditação e respiração são fixos, o caminho é gerar os áudios uma vez e embarcar
os arquivos — igual às ilustrações. Ganha qualidade, fica previsível e funciona
offline.
