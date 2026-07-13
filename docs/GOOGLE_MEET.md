# Teleconsulta com Google Agenda + Google Meet

Quando o médico clica em **"Abrir sala"** na aba Teleconsultas do painel, o
portal:

1. Cria um **evento no Google Agenda** com **Google Meet** embutido;
2. **Convida médico e paciente por e-mail** — o próprio Google envia o convite
   com data/hora e o link do Meet;
3. Salva o link na sessão (aparece no painel do médico e na aba Teleconsulta da
   paciente, com botões **Entrar** e **Copiar link**).

Se as credenciais abaixo **não** estiverem configuradas, o sistema usa o
**Jitsi** como fallback (sala gratuita, sem convite de agenda) e manda o link à
paciente por e-mail (Resend). Ou seja: **funciona mesmo sem o Google** — o
Google só deixa a experiência melhor (Meet + convite na agenda dos dois).

## O que configurar (uma vez)

Três variáveis de ambiente (na Vercel → Settings → Environment Variables):

```
GOOGLE_MEET_CLIENT_ID="..."
GOOGLE_MEET_CLIENT_SECRET="..."
GOOGLE_MEET_REFRESH_TOKEN="..."
```

O `refresh_token` precisa ter sido gerado com o escopo:

```
https://www.googleapis.com/auth/calendar.events
```

(opcionalmente também `https://www.googleapis.com/auth/meetings.space.created`,
usado só no fallback de "sala avulsa" sem evento de agenda).

## Passo a passo

### 1. Projeto + APIs no Google Cloud

1. Acesse <https://console.cloud.google.com> e crie (ou escolha) um projeto.
2. Em **APIs & Services → Library**, ative a **Google Calendar API**
   (e, se quiser o fallback de sala avulsa, a **Google Meet API**).

### 2. Tela de consentimento OAuth

1. **APIs & Services → OAuth consent screen**.
2. Tipo **External**, preencha nome do app e e-mail de suporte.
3. Em **Scopes**, adicione `.../auth/calendar.events`.
4. Em **Test users**, adicione a conta Google que vai **hospedar** as reuniões
   (a conta do médico/consultório). Enquanto o app estiver em "Testing", só os
   test users conseguem autorizar — o que é suficiente aqui.

### 3. Credenciais OAuth 2.0

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Tipo **Desktop app** (mais simples para gerar o refresh token).
3. Anote o **Client ID** e o **Client secret** → viram
   `GOOGLE_MEET_CLIENT_ID` e `GOOGLE_MEET_CLIENT_SECRET`.

### 4. Gerar o refresh_token (uma vez)

Autorize a conta do médico e troque o `code` pelo `refresh_token`.

1. Abra no navegador (troque `SEU_CLIENT_ID`), logado na conta do médico:

   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=SEU_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent
   ```

   > Se o Google recusar `redirect_uri=urn:ietf:...`, crie a credencial como
   > **Web app** com o redirect `https://developers.google.com/oauthplayground`
   > e use o [OAuth Playground](https://developers.google.com/oauthplayground)
   > (engrenagem → "Use your own OAuth credentials") — é o caminho mais fácil e
   > já entrega o refresh token na tela.

2. Autorize e copie o `code` exibido.
3. Troque o `code` pelo refresh token:

   ```bash
   curl -s https://oauth2.googleapis.com/token \
     -d client_id=SEU_CLIENT_ID \
     -d client_secret=SEU_CLIENT_SECRET \
     -d code=O_CODE_COPIADO \
     -d grant_type=authorization_code \
     -d redirect_uri=urn:ietf:wg:oauth:2.0:oob
   ```

4. A resposta traz `"refresh_token": "..."` → esse é o
   `GOOGLE_MEET_REFRESH_TOKEN`.

### 5. Colar na Vercel e redeploy

Cole as 3 variáveis em **Production** (e Preview, se quiser testar na branch) e
faça um redeploy. Pronto: a próxima "Abrir sala" cria o evento na agenda e
convida os dois.

## Detalhes bons de saber

- **Fuso:** os eventos são criados em `America/Sao_Paulo`, com 40 min de
  duração.
- **Paciente sem conta Google:** recebe o convite por e-mail e entra no Meet
  como convidada pelo link — o médico admite na sala (fluxo normal do Meet).
- **Conta única (hoje):** as reuniões são hospedadas na conta do refresh token
  (o consultório). No modelo SaaS multi-médico, cada médico conectar a própria
  conta Google é uma evolução futura (hoje é uma conta por instalação).
- **Segurança:** as chaves são secretas (server-side); nunca vão para o bundle
  do navegador nem para o git (o `.env` está no `.gitignore`).
