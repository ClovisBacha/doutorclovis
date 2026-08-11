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

**Bancada:** `/preview-home?w=20` renderiza a tela real sem login (`?clima=1`
liga o clima). O céu vem do relógio do navegador, então o Playwright o escolhe
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
