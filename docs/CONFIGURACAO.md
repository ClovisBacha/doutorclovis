# Configuração — passo a passo (o que fica do seu lado)

Guia único de tudo que precisa ser configurado FORA do código para o site ficar
100% no ar. Faça na ordem. O item 1 é **bloqueante** (sem ele, várias abas não
persistem dados); os demais você faz conforme quer ligar cada recurso.

Legenda: 🔴 bloqueante · 🟡 recomendado · 🟢 opcional

---

## 1. 🔴 Banco de dados — aplicar o SQL pendente

Sem isso, faltam ~28 tabelas e colunas novas (`doctor_id`, `verified`,
`doctor_google_tokens`, a RPC `search_doctors`, etc.) e as abas de teleconsulta,
pré-consulta, multi-médico e diretório não funcionam.

1. Abra o **Supabase** → seu projeto → menu **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/APLICAR_PENDENTES.sql` do repositório, **copie todo
   o conteúdo** e cole no editor.
3. Clique em **Run**.
4. O arquivo é **idempotente** — se der algum aviso de "already exists", tudo
   bem, pode rodar de novo sem quebrar nada.

✅ Pronto quando rodar sem erro vermelho.

---

## 2. 🔴 Variáveis de ambiente na Vercel

Em **Vercel → seu projeto → Settings → Environment Variables**. Marque
**Production** (e Preview, se quiser testar nas branches). Depois de mexer aqui,
faça um **Redeploy**.

### Já devem existir (o site está no ar, então provavelmente sim)

| Variável                                                     | O que é                                        |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL`                         | URL do projeto Supabase                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | chave pública (anon)                           |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | 🔒 chave secreta do servidor                   |
| `ADMIN_EMAILS`                                               | e-mails da equipe/dono (separados por vírgula) |
| `GOOGLE_GENERATIVE_AI_API_KEY`                               | 🔒 chatbot + triagem de sintomas               |

### Adicionar agora (novas/importantes)

| Variável                       | Para quê                                                | Valor                           |
| ------------------------------ | ------------------------------------------------------- | ------------------------------- |
| `SITE_URL`                     | fixa o redirect do Google (segurança) e links de e-mail | `https://www.obstetrica.com.br` |
| `PLATFORM_ADMIN_EMAIL`         | 🟡 dono da plataforma (console super-admin)             | seu e-mail                      |
| `RESEND_API_KEY` + `MAIL_FROM` | 🟡 e-mails (confirmação de consulta, teleconsulta)      | ver item 6                      |

As de **Stripe** e **Google Meet** entram nos itens 4 e 5.

---

## 3. 🟡 Login com Google (paciente e médico)

Deixa a paciente e o médico entrarem com um clique. Para o médico, o e-mail da
conta passa a ser o do Google (as teleconsultas caem na Agenda dele).

### 3.1 Criar a credencial OAuth no Google Cloud

1. <https://console.cloud.google.com> → crie/escolha um projeto.
2. **APIs & Services → OAuth consent screen**: tipo **External**, preencha nome
   do app e e-mail de suporte, salve.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   tipo **Web application**.
4. Em **Authorized redirect URIs**, adicione (guarde, vamos usar as três):
   - `https://<SEU-REF>.supabase.co/auth/v1/callback` (login — item 3.2)
   - `https://www.obstetrica.com.br/medicos/google-callback` (teleconsulta nível 2 — item 5)
     > `<SEU-REF>` é o subdomínio do seu `SUPABASE_URL`.
5. Anote **Client ID** e **Client secret**.

### 3.2 Ligar o provider no Supabase

1. Supabase → **Authentication → Providers → Google** → **Enable**.
2. Cole o **Client ID** e o **Client secret** do passo anterior. Salve.
3. Supabase → **Authentication → URL Configuration → Redirect URLs**, adicione:
   ```
   https://www.obstetrica.com.br/minha-conta
   https://www.obstetrica.com.br/medicos/cadastro
   ```

✅ Pronto: o botão "Continuar com Google" passa a funcionar no `/auth` e no
cadastro de médico.

Detalhes: `docs/GOOGLE_LOGIN.md`.

---

## 4. 🟡 Cobrança dos planos (Stripe)

Sem isso, o médico não consegue assinar um plano pago (o resto do site funciona).

### 4.1 Conta e produtos

1. Crie a conta em <https://dashboard.stripe.com> (ative o país/negócio).
2. Em **Products**, crie um **Product** por plano e, dentro de cada um, os
   **Prices** recorrentes (mensal e anual). Copie o **ID de cada Price**
   (começa com `price_...`):

   | Plano                   | Var. mensal                           | Var. anual                           |
   | ----------------------- | ------------------------------------- | ------------------------------------ |
   | Quiz premium (paciente) | `STRIPE_PRICE_QUIZ_MONTHLY`           | `STRIPE_PRICE_QUIZ_ANNUAL`           |
   | Médico Starter          | `STRIPE_PRICE_DOCTOR_STARTER_MONTHLY` | `STRIPE_PRICE_DOCTOR_STARTER_ANNUAL` |
   | Médico Pro              | `STRIPE_PRICE_DOCTOR_PRO_MONTHLY`     | `STRIPE_PRICE_DOCTOR_PRO_ANNUAL`     |
   | Médico Elite            | `STRIPE_PRICE_DOCTOR_ELITE_MONTHLY`   | `STRIPE_PRICE_DOCTOR_ELITE_ANNUAL`   |
   | Médico Black            | `STRIPE_PRICE_DOCTOR_BLACK_MONTHLY`   | `STRIPE_PRICE_DOCTOR_BLACK_ANNUAL`   |

### 4.2 Chaves e variáveis (na Vercel)

3. **Developers → API keys** → copie a **Secret key** → `STRIPE_SECRET_KEY`.
4. Cole na Vercel todas as `STRIPE_PRICE_*` da tabela acima + `STRIPE_SECRET_KEY`.

### 4.3 Webhook

5. **Developers → Webhooks → Add endpoint**:
   - URL: `https://www.obstetrica.com.br/api/stripe-webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted` (e `invoice.paid` se quiser).
6. Copie o **Signing secret** (começa com `whsec_...`) → `STRIPE_WEBHOOK_SECRET`
   na Vercel.

### 4.4 Portal de cobrança

7. **Settings → Billing → Customer portal** → ative (deixa o médico cancelar/
   trocar cartão sozinho). Não precisa de variável.

8. **Redeploy** na Vercel para carregar as variáveis.

---

## 5. 🟡 Teleconsulta com Google Meet / Agenda

A teleconsulta funciona sem isso (usa **Jitsi**). Com o Google, cria a reunião
do Meet e convida médico + paciente pela Agenda. Há dois níveis.

### 5.1 App OAuth + variáveis (nível 1 — conta central)

Reaproveite o **mesmo OAuth client** do item 3 (ou crie um "Desktop app" só para
isto). Preencha na Vercel:

```
GOOGLE_MEET_CLIENT_ID
GOOGLE_MEET_CLIENT_SECRET
GOOGLE_MEET_REFRESH_TOKEN   ← gerar uma vez (passo a passo em docs/GOOGLE_MEET.md, item 4)
```

Escopo do consentimento: `https://www.googleapis.com/auth/calendar.events`.

### 5.2 Nível 2 — cada médico na própria Agenda

Para o médico hospedar as teleconsultas na conta Google DELE:

1. No OAuth client, confirme o redirect URI:
   `https://www.obstetrica.com.br/medicos/google-callback` (já adicionado no 3.1).
2. Garanta o escopo `calendar.events` na tela de consentimento.
3. Enquanto o app OAuth estiver em **Testing**, adicione a conta de cada médico
   em **Test users** (ou clique **Publish app** para liberar geral).
4. No painel do médico → **Meu Perfil → Google Agenda das teleconsultas** →
   **Conectar Google Agenda**.

Detalhes completos: `docs/GOOGLE_MEET.md` (seção "Nível 2").

---

## 6. 🟢 E-mails (Resend) — opcional

Para enviar confirmação de consulta e link de teleconsulta por e-mail:

1. Crie conta em <https://resend.com>, verifique seu domínio.
2. Copie a API key → `RESEND_API_KEY` (Vercel).
3. `MAIL_FROM` = remetente verificado, ex.: `Dr. Clóvis Bacha <contato@obstetrica.com.br>`.

Sem isso, o agendamento funciona, só não manda e-mail.

---

## 7. 🟡 Depois de configurar — dois cliques finais

1. **Verificar os médicos legítimos:** o selo `verified` agora é obrigatório
   para o médico aparecer na busca e ser escolhido. No **console super-admin**
   (logado com `PLATFORM_ADMIN_EMAIL`), marque **Verificar** em cada médico real.
2. **Apagar os dados de teste:** remova a conta `teste.e2e.obstetrica@gmail.com`
   e o perfil "Paciente Teste E2E" (Supabase → Authentication → Users, e a linha
   correspondente em `patient_profiles`).

---

## Ordem sugerida

```
1 (SQL)  →  2 (env básicas + SITE_URL)  →  3 (login Google)  →
5 (teleconsulta)  →  4 (Stripe)  →  6 (e-mail)  →  7 (verificar/limpar)
```

Guias detalhados por tema: `docs/GOOGLE_LOGIN.md`, `docs/GOOGLE_MEET.md`,
`docs/MULTI_TENANT.md`, `docs/AUDITORIA_2026-07-13.md`.
