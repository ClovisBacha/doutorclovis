# Login com Google (paciente e médico)

O portal oferece **"Continuar com Google"** no login/cadastro — tanto para a
paciente quanto para o médico. Para o médico é especialmente útil: o e-mail da
conta passa a ser o e-mail do Google, então as **teleconsultas caem direto na
Agenda Google dele** (o convite do evento vai para esse endereço).

O botão usa o **provider Google do Supabase Auth**. Enquanto ele não estiver
habilitado no projeto, o botão mostra um aviso e o login por e-mail/senha segue
funcionando normalmente.

## Configurar (uma vez)

### 1. Credenciais OAuth no Google Cloud

1. <https://console.cloud.google.com> → seu projeto → **APIs & Services →
   Credentials → Create credentials → OAuth client ID**.
2. Tipo **Web application**.
3. Em **Authorized redirect URIs**, adicione a URL de callback do Supabase:

   ```
   https://<SEU-PROJECT-REF>.supabase.co/auth/v1/callback
   ```

   (o `PROJECT-REF` é o subdomínio do seu `SUPABASE_URL`).

4. Anote o **Client ID** e o **Client secret**.

### 2. Habilitar no Supabase

1. No painel do Supabase → **Authentication → Providers → Google**.
2. Ligue **Enable**, cole o **Client ID** e o **Client secret** e salve.

### 3. URLs de redirect da aplicação

Em **Authentication → URL Configuration → Redirect URLs**, adicione as URLs
para onde o app manda a pessoa de volta após o Google:

```
https://www.obstetrica.com.br/minha-conta
https://www.obstetrica.com.br/medicos/cadastro
```

(e, se quiser testar nos previews da Vercel, as URLs de preview equivalentes —
ou um wildcard `https://*.vercel.app/**`).

Pronto. A partir daí o botão "Continuar com Google" loga a pessoa e:

- **Paciente** → vai para `/minha-conta`.
- **Médico** → vai para `/medicos/cadastro`, que manda direto ao `/painel` se o
  perfil profissional já existe, ou mostra a etapa de perfil (CRM, etc.) na
  primeira vez — com o nome já pré-preenchido a partir do Google.

## Observações

- **Isso NÃO é o mesmo que hospedar a teleconsulta na conta do médico.** O login
  com Google só autentica (escopo básico de e-mail/perfil). Fazer o portal criar
  os eventos de Meet **na conta Google do próprio médico** (em vez de uma conta
  única da instalação) exige um passo a mais — conectar a Agenda com escopo
  `calendar.events` e guardar o refresh token por médico. Está descrito como
  próximo passo em `docs/GOOGLE_MEET.md`. Por enquanto, o login com Google já
  garante que o **e-mail** do médico é o do Google (o convite chega na Agenda
  dele), usando a conta única configurada nas variáveis `GOOGLE_MEET_*`.
- As chaves do provider ficam no Supabase (não no repositório).
