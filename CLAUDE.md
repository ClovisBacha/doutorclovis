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

> **Atenção:** o banco de produção só tem as 8 tabelas originais — todas as
> migrations a partir de `20260608120000` estão pendentes (28 tabelas faltando,
> verificado em 2026-06-12). Aplique `supabase/APLICAR_PENDENTES.sql` no
> SQL Editor do Supabase (arquivo consolidado e idempotente; pode rodar mais
> de uma vez). Sem isso, Contrações, Pré-consulta, Exames, Linha do Tempo,
> Ciclo Menstrual, Plano de Parto, Teleconsulta, Álbum, Pós-parto, Escola,
> Conquistas e outras abas não persistem dados.

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

### Ciclo menstrual + cérebro do paciente

- `buildCycleMoodBlock` em `src/routes/api/chat.ts` injeta no system prompt o
  ciclo (último período, ciclo médio, dia do ciclo, previsão, sintomas) + humor
  recente do diário (só o rótulo `mood`, nunca o conteúdo). É contexto de
  bem-estar (fonte confiável), NÃO conduta — o portão de cobertura do cérebro do
  médico continua mandando. LGPD: dado da própria paciente, na conversa dela.
- Ciclo visual estilo Apple Health: **feito** (anel de fases + calendário
  mensal na aba Ciclo Menstrual). Ver `CicloHero`/`CicloCalendario` em
  `minha-conta.tsx`.

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
