# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

> Conteúdo em PT-BR (idioma do projeto). Última atualização: julho/2026.

## O que é o projeto

**Obstétrica** (www.obstetrica.com.br) — plataforma SaaS para ginecologistas e
obstetras: portal da paciente gestante (app com dezenas de abas), painel do
médico com IA e site institucional. Começou como o site do **Dr. Clóvis Bacha**
(gestação de alto risco) e virou **multi-tenant**: qualquer médico pode se
cadastrar, assinar um plano e atender as próprias pacientes. O Dr. Clóvis é o
**dono da instalação** (primeiro tenant); `src/lib/doctor.config.ts` guarda os
dados dele e funciona como *fallback* quando a paciente não tem médico
vinculado — para médicos assinantes, a fonte é a tabela `doctors`.

Migrado do Lovable para desenvolvimento no Claude Code.

## Stack

- **React 19** + **TanStack Start / Router** (SSR, file-based routing)
- **Tailwind CSS 4** + **shadcn/ui** (componentes em `src/components/ui`)
- **Supabase** (auth + Postgres com RLS)
- **AI SDK** (`ai` + `@ai-sdk/google`) — chatbot, Segundo Cérebro, agente WhatsApp
- **Stripe** (assinaturas) e **Mercado Pago** (PIX automático)
- **Vite 7** com `@lovable.dev/vite-tanstack-config` (preset de build)
- **Bun** como gerenciador de pacotes

## Comandos

```bash
bun install            # instalar dependências
bun run dev            # servidor de dev (porta 8080)
bun run build          # build de produção (gera .vercel/output, preset vercel do Nitro)
bun run lint           # eslint
bun run typecheck      # tsc --noEmit
bun run format         # prettier --write
```

- **Não há testes automatizados.** O CI (`.github/workflows/ci.yml`) roda
  `tsc --noEmit` e `eslint` em todo push/PR — rode os dois antes de commitar.
- Pre-commit (husky + lint-staged) roda eslint --fix + prettier nos staged.
- **Prettier está fixado em `3.8.3` (sem caret)** — não atualizar: versões
  divergentes entre local e CI já causaram falhas recorrentes de Lint.
- `src/routeTree.gen.ts` é gerado pelo router plugin — nunca editar à mão.

> **Ambiente sandbox (Claude Code na web):** o Vite tenta escutar em IPv6
> (`:::8080`), que não é suportado aqui. Rode com `bun run dev --host
> 127.0.0.1 --port 8080`.

## Variáveis de ambiente

Copie `.env.example` para `.env` — o arquivo é extensamente comentado e é a
referência canônica de cada chave. Resumo dos grupos:

- **Supabase**: `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (+ versões `VITE_`,
  públicas) e `SUPABASE_SERVICE_ROLE_KEY` (secreta, só server-side).
- **IA**: `GOOGLE_GENERATIVE_AI_API_KEY` (chatbot, triagem, agente WhatsApp);
  `CHAT_MODEL` opcional (padrão `gemini-2.5-flash`).
- **Acesso**: `ADMIN_EMAILS` (equipe da instalação — vê o `/painel` inteiro);
  `PLATFORM_ADMIN_EMAIL` (super-admin — console `/admin`).
- **Pagamentos**: `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` + um
  `STRIPE_PRICE_*` por plano; `MERCADO_PAGO_ACCESS_TOKEN` (PIX automático);
  `PIX_KEY` / `PIX_RECEIVER_NAME` (PIX manual, fallback).
- **WhatsApp (Meta Cloud API)**: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (sem ele o webhook ignora tudo
  — fail-closed), `WHATSAPP_DISPLAY_PHONE`.
- **Google Meet/Agenda**: `GOOGLE_MEET_CLIENT_ID/SECRET/REFRESH_TOKEN`
  (teleconsulta; sem elas cai no Jitsi). Ver `docs/GOOGLE_MEET.md`.
- **E-mail**: `RESEND_API_KEY` / `MAIL_FROM` (opcional).
- **Push**: `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` (opcional).
- `SITE_URL`: URL pública — fixa redirects OAuth (segurança) e links de e-mail.

O `.env` está no `.gitignore` — nunca commite chaves reais.

Setup fora do código (Supabase, Vercel, Google Cloud, Stripe, Meta):
**`docs/CONFIGURACAO.md`** é o guia único, em ordem, com o que é bloqueante.

## Estrutura

```
src/
  routes/                  # file-based routing — ver src/routes/README.md
    index.tsx              # home
    medicos.tsx            # página de vendas dos planos de médico
    medicos_.cadastro.tsx  # onboarding do médico (cria linha em `doctors`)
    encontrar-medico.tsx   # diretório público (só médicos com selo `verified`)
    empresas.tsx           # planos corporativos
    agendamento, gestacao, batimentos, dpp, calculadora, hospitais,
    lives, mural, depoimentos, mitos, epds, diabetes-gestacional, ...
    acompanhar.$token.tsx, album.$token.tsx, votar-nome.$token.tsx  # links por token
    _authenticated/        # exige login (redirect p/ /auth)
      minha-conta.tsx      # app da PACIENTE (arquivo gigante, ~13k linhas, todas as abas)
      painel.tsx           # painel do MÉDICO (~5k linhas)
      admin.tsx            # console do super-admin da plataforma
    api/                   # endpoints server-side
      chat.ts              # chatbot (streaming)
      whatsapp.ts          # webhook Meta (valida X-Hub-Signature-256)
      stripe-webhook.ts, mp-webhook.ts, transcribe.ts, nutrition.ts, carta-semanal.ts
    __root.tsx             # shell, head/SEO, error boundary
  components/              # componentes do site (ui/ = shadcn)
  integrations/supabase/   # client (browser), client.server (service role), auth middleware
  lib/                     # *.functions.ts = server functions; *.server.ts = só servidor
  server.ts / start.ts     # SSR wrapper + middlewares (auth + erro)
supabase/migrations/       # schema (fonte de verdade)
docs/                      # CONFIGURACAO, MULTI_TENANT, GOOGLE_LOGIN, GOOGLE_MEET, auditorias
scripts/stripe-setup.mjs   # cria produtos/preços no Stripe de uma vez
```

Convenções de código que importam:

- **Backend = server functions** (`createServerFn` do TanStack Start) em
  `src/lib/*.functions.ts` — não há API REST própria além de `src/routes/api/`.
- Sufixo **`.server.ts`** impede o Vite de levar o módulo para o browser —
  obrigatório para tudo que lê segredos. Leia `process.env` **dentro** de
  função/handler, nunca no escopo do módulo (ver `src/lib/config.server.ts`).
- Roteamento: só as convenções do TanStack (`$param`, `_layout`, `__root`) —
  nada de `src/pages/` ou padrões Next.js. Ver `src/routes/README.md`.
- `vite.config.ts`: o preset do Lovable já inclui react/tailwind/nitro/aliases —
  **não** adicionar esses plugins de novo (quebra com plugin duplicado).
- Textos da interface e mensagens de commit em **PT-BR**.

## Multi-tenant — ATENÇÃO CRÍTICA

Princípio (detalhes e roadmap em `docs/MULTI_TENANT.md`): **todo dado pertence
a um perfil** — o Segundo Cérebro ao médico, a gestação/jornada à paciente, e
cada paciente a um médico (`patient_profiles.doctor_id`; `null` = dono da
instalação, compatibilidade com a era single-tenant).

Regras que valem para qualquer código novo:

1. **RLS em toda tabela nova.** Paciente lê só o próprio dado; médico lê só os
   dados **das suas** pacientes (policies por `doctor_id`).
2. **Escrita administrativa sempre via server function com gate** — nunca
   policy aberta a `authenticated`. Padrão em `admin.functions.ts`:
   `requireScope` (quem é? equipe ou médico assinante?) + `scopedBy` nas
   leituras + `assertOwnsRow` fail-closed nas mutações.
3. **Fail-closed sempre.** Erro ao resolver o `doctor_id` do assinante NUNCA
   pode cair no `doctor_id` do dono da instalação (já vazou dados duas vezes —
   auditoria de 13/07). Em dúvida, retorne vazio/negue.
4. **Selo `verified`**: busca de médicos, vínculo direto (`chooseDoctor` /
   `requestDoctor`) e diretório só expõem médicos verificados.
5. **Planos e limites**: `src/lib/entitlements.ts` é a fonte única das
   capacidades por plano (`trial | free | starter | pro | clinica | elite |
   black`). Plano desconhecido cai em `free` (o mais restritivo). Gates novos
   de funcionalidade paga passam por aí, não por checagens ad-hoc.
6. **Conteúdo de paciente jamais entra em prompt de sistema** (anti-injection).

## IA

- **Chatbot do site**: `src/routes/api/chat.ts` — Gemini via AI SDK
  (`streamText`), config em `src/lib/ai-gateway.server.ts`.
- **Segundo Cérebro**: base de conhecimento POR MÉDICO (`brain_settings` /
  `brain_entries`), montada em `src/lib/secondbrain.server.ts` e usada pelo
  chat e pelo WhatsApp. A IA só afirma **o que o médico validou** — disclaimers
  jurídicos fazem parte do produto, não remover.
- **Agente WhatsApp**: webhook `src/routes/api/whatsapp.ts` → `whatsapp-agent.server.ts`;
  cada número Meta mapeia a um médico (`doctor_whatsapp_numbers`).
- **Triagem de sintomas** (`src/lib/triage.ts`): o nível de risco
  (verde/amarelo/vermelho) é **determinístico, por regras — nunca pela IA**.
  A IA só redige a explicação e não pode rebaixar um alerta. Não mudar isso.

## Banco de dados (Supabase)

Schema em `supabase/migrations/` (~46 migrations). Não há CLI do Supabase no
fluxo — migrations são aplicadas colando SQL no SQL Editor:

- `supabase/APLICAR_PENDENTES.sql` — consolida tudo de `20260608120000` em
  diante (idempotente, pode rodar de novo). **Enquanto não for aplicado em
  produção, a maioria das abas do app não persiste dados** (ver
  `docs/CONFIGURACAO.md`, item 1 — bloqueante).
- `supabase/BANCO_COMPLETO.sql` — banco inteiro do zero (idempotente).

Ao criar uma migration nova, adicione-a também ao(s) arquivo(s) consolidado(s),
mantendo a idempotência (`IF NOT EXISTS`, `DROP POLICY` antes de recriar etc.).

## Pagamentos

- **Stripe** (`src/lib/stripe.server.ts` + `api/stripe-webhook.ts`):
  assinaturas recorrentes — premium da paciente (quiz) e planos do médico.
  Trial do médico expira em 14 dias e passa a contar como `free`.
- **Mercado Pago** (`api/mp-webhook.ts`): PIX automático com QR Code para
  consulta particular; sem a chave, cai no PIX manual (chave exibida + botão
  "marquei o pagamento"). O PIX exibido é o do médico da paciente.

## Deploy (Vercel)

Build usa o preset **vercel** do Nitro e gera `.vercel/output` (Build Output
API), auto-detectado pela Vercel (`vite.config.ts` + `vercel.json`). Cada
`git push` faz deploy: branch de produção vira a URL principal, demais branches
ganham preview. Env vars na Vercel: todas as `VITE_*` no build; segredos no
runtime (lista completa em `docs/CONFIGURACAO.md`).

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

## Resquícios do Lovable (opcional remover)

- `@lovable.dev/vite-tanstack-config` — preset de build (funciona; remover é
  refator grande).
- `src/lib/lovable-error-reporting.ts` — no-op fora do Lovable.
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
