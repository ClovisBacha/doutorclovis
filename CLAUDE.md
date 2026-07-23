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

## Resquícios do Lovable (opcional remover)

- `@lovable.dev/vite-tanstack-config` — preset de build (funciona; remover é
  refator grande).
- `src/lib/lovable-error-reporting.ts` — no-op fora do Lovable (usa
  `window.__lovableEvents`).
- `.lovable/project.json` — metadados do template.

## Backlog — pendências combinadas (lembrar de resolver)

> Registrado a pedido do Cláudio. NÃO estão implementadas — são os próximos
> grandes blocos. Ao retomar, confirmar prioridade antes de construir.

### 1. Agenda real com o médico (booking por horário + lista de espera)

Hoje `agendamento` só cria um **pedido** (`appointment_requests`), não é reserva
por horário. Objetivo:

- Médico define **disponibilidade** (slots recorrentes + exceções/bloqueios).
- Paciente marca em um **horário disponível** (confirma na hora, não "pedido").
- Se o horário preferido estiver cheio, o sistema **sugere outros horários**.
- Sem vaga → entra em **lista de espera** e é avisada quando abrir vaga.
- Tabelas prováveis: `doctor_availability`, `appointments` (estado do booking),
  `appointment_waitlist`. Integrar com o painel do médico e com o Google
  Agenda/Meet que já existem (ver `docs/GOOGLE_MEET.md`).

### 2. Ciclo menstrual estilo Apple Health + cérebro do paciente

Já existe a aba "Ciclo Menstrual". Evoluir para uma experiência tipo Apple
Health (Cycle Tracking):

- Previsão de ciclo e janela fértil, registro de sintomas, calendário visual,
  lembretes.
- **Integrar os dados do ciclo ao "cérebro do paciente"** (IA do consultório,
  `src/lib/secondbrain.server.ts`) para insights personalizados.
- Regras que continuam valendo: a IA médica NUNCA responde/aprende sem
  aprovação do médico; dado sensível (LGPD) só com consentimento explícito.
