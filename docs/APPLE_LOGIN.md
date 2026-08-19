# Entrar com a Apple (paciente e médico)

> ✅ **LIGADO E FUNCIONANDO desde 19/08/2026.** O login foi conferido numa aba
> anônima em `www.obstetrica.com.br/auth` e o endpoint `/auth/v1/settings` do
> projeto lista `apple` ao lado de `google` e `email`.
>
> |                 |                                       |
> | --------------- | ------------------------------------- |
> | **Team ID**     | `8PL2X9F9PV`                          |
> | **Key ID**      | `LC326T8BHZ`                          |
> | **Services ID** | `br.com.obstetrica.web`               |
> | **App ID**      | `br.com.obstetrica.app`               |
> | **Chave**       | `AuthKey_LC326T8BHZ.p8` (fora do Git) |
>
> ⏰ **O segredo vence por volta de 17/02/2027.** Nenhum destes valores é
> credencial — o segredo é o `.p8` e o JWT gerado a partir dele.

O botão **"Continuar com a Apple"** já está na tela de entrada (`/auth`), ao
lado do Google, nas duas portas — paciente e médico. Enquanto o provedor não
estiver ligado no Supabase ele mostra um aviso e o login por e-mail/senha
continua funcionando.

> **Por que isto não é opcional.** A diretriz **4.8** da App Store: um app que
> oferece login social de terceiros (o nosso oferece Google) **é obrigado** a
> oferecer o Entrar com a Apple. Sem isso o app é reprovado na revisão.

Você vai precisar de uma conta no **Apple Developer Program** (US$ 99/ano). É a
mesma conta que o app nativo e as notificações (APNs) vão usar.

---

## O que você vai colher pelo caminho

Quatro valores. Anote cada um quando aparecer — dois deles a Apple mostra **uma
vez só**:

| valor           | onde aparece               | exemplo                 |
| --------------- | -------------------------- | ----------------------- |
| **Team ID**     | canto superior direito     | `ABCDE12345`            |
| **Services ID** | você escolhe               | `br.com.obstetrica.web` |
| **Key ID**      | no nome do arquivo baixado | `FGHIJ67890`            |
| **arquivo .p8** | ⚠️ baixa **uma vez só**    | `AuthKey_FGHIJ67890.p8` |

---

## 1. O App ID (a identidade do produto)

<https://developer.apple.com/account> → **Certificates, IDs & Profiles** →
**Identifiers** → **＋** → **App IDs** → **App**.

- **Bundle ID**: `br.com.obstetrica.app` (é o que o `.env.example` já usa em
  `APNS_BUNDLE_ID` — mantenha igual, senão as notificações e o login ficam em
  identidades diferentes).
- Em **Capabilities**, marque **Sign In with Apple**.

> Ele existe mesmo que o app ainda não esteja na loja: o login web pendura-se
> nele.

## 2. O Services ID (o "Client ID" do site)

**Identifiers** → **＋** → **Services IDs**.

- **Identifier**: `br.com.obstetrica.web` — ⚠️ **diferente do App ID**. A Apple
  recusa repetir o mesmo identificador.
- Marque **Sign In with Apple** → **Configure**:
  - **Primary App ID**: o do passo 1.
  - **Domains and Subdomains**:

    ```
    zqmqbnwvrmeabnmaaxfr.supabase.co
    ```

  - **Return URLs**:

    ```
    https://zqmqbnwvrmeabnmaaxfr.supabase.co/auth/v1/callback
    ```

⚠️ **É o domínio do SUPABASE, não `obstetrica.com.br`.** Quem recebe a resposta
da Apple é o Supabase; só depois ele devolve a pessoa ao nosso site. Pôr o nosso
domínio aqui é o erro que faz a Apple responder `invalid_request` — e a mensagem
não diz qual campo está errado.

## 3. A chave (.p8)

**Keys** → **＋**.

- Nome: `Entrar com a Apple — Obstetrica`.
- Marque **Sign In with Apple** → **Configure** → escolha o **App ID** do passo 1.
- **Register** → **Download**.

⚠️ **O download acontece UMA VEZ.** Perdeu o arquivo, a chave se revoga e cria
outra. Guarde junto com as outras chaves do projeto (nunca no Git).

O **Key ID** é o pedaço do meio do nome do arquivo: `AuthKey_FGHIJ67890.p8` →
`FGHIJ67890`.

## 4. O segredo que o Supabase pede

A Apple é o único provedor que não entrega um "client secret" pronto: ela dá a
chave e espera um **JWT assinado**. Há duas ferramentas, e as duas assinam
localmente — a chave privada não sai da máquina:

**No navegador** (`scripts/segredo-apple.html`) — foi a usada, e é a
recomendada para quem não tem o repositório clonado. Baixe o arquivo e abra do
disco; ele assina com o WebCrypto e não faz nenhuma chamada de rede.

⚠️ **ABRA NO CHROME, NÃO NO SAFARI.** O Safari não considera um arquivo
`file://` um contexto seguro e simplesmente não expõe `crypto.subtle` — e a
primeira versão da página engolia isso num `try/catch` e acusava a CHAVE, o que
custou uma volta procurando o problema no lugar errado. Hoje ela detecta e diz
para trocar de navegador.

**Na linha de comando** (`scripts/segredo-apple.mjs`), se o repositório estiver
clonado:

```bash
node scripts/segredo-apple.mjs \
  --p8 ~/Downloads/AuthKey_FGHIJ67890.p8 \
  --team ABCDE12345 \
  --key FGHIJ67890 \
  --servico br.com.obstetrica.web
```

⚠️ **A diferença entre as duas não é só de embalagem.** O WebCrypto devolve a
assinatura CRUA (`r‖s`), que é o que o JWT pede; o Node devolve DER por padrão e
precisa de `dsaEncoding: "ieee-p1363"`. Um JWT ES256 com assinatura DER é
recusado sem explicação.

⚠️ **ESSE SEGREDO VENCE EM SEIS MESES**, por regra da Apple. No dia em que
vencer, o "Continuar com a Apple" para de funcionar **sem aviso nenhum** — o
botão simplesmente devolve erro. O script imprime a data de vencimento no fim:
marque na agenda e rode de novo antes.

## 5. Ligar no Supabase

<https://supabase.com/dashboard> → o projeto → **Authentication → Providers →
Apple**:

- **Enable Sign in with Apple**: ligado.
- **Client IDs**: `br.com.obstetrica.web` (o Services ID).
- **Secret Key (for OAuth)**: o JWT que a ferramenta gerou.

⚠️ **CONFIRA OS DOIS CAMPOS ANTES DE SALVAR — o Chrome autopreenche.** Na
configuração real, o navegador tinha posto o **e-mail do dono** em "Client IDs"
e algo em "Secret Key" (os dois parecem campos de login para o gerenciador de
senhas). Salvo assim, o resultado é `invalid_client` num campo que ninguém
lembra de ter tocado. Clique em **Reveal** no segredo e leia o Client IDs antes
de salvar.

Salvar.

> Se o painel mostrar campos separados para Team ID e Key ID em vez do JWT,
> preencha com os valores da tabela do começo — é a mesma informação, montada
> pelo Supabase em vez de pelo script.

## 6. As URLs de volta

**Authentication → URL Configuration → Redirect URLs**. São as mesmas do Google
e provavelmente já estão lá:

```
https://www.obstetrica.com.br/minha-conta
https://www.obstetrica.com.br/medicos/cadastro
```

⚠️ A comparação é **exata**, sem query string. Quando o Supabase recusa o
redirecionamento ele não avisa: manda a pessoa para a Site URL do projeto. Foi
assim que o médico entrava com o Google e aparecia no app da gestante, sem erro
nenhum na tela.

---

## Duas armadilhas que só aparecem depois

**1. O nome vem UMA vez, e só na primeira autorização.** Diferente do Google, a
Apple manda nome e sobrenome apenas na primeira vez que a pessoa autoriza o app
— nunca mais. Se ela apagar a conta e criar de novo, volta sem nome. O ritual de
boas-vindas já pergunta o nome, então isso não quebra nada aqui; só não conte
com o nome vindo do provedor.

**2. "Ocultar meu e-mail" (Hide My Email).** A Apple oferece um endereço-relé
(`algo@privaterelay.appleid.com`). Ele funciona como e-mail normal para login,
**mas só entrega mensagens vindas de um remetente registrado na Apple**. Como o
app manda confirmação de consulta por e-mail (Resend, `MAIL_FROM`), esse domínio
precisa ser cadastrado em **Certificates, IDs & Profiles → More → Configure**
(Sign in with Apple for Email Communication) — senão a paciente que escolher
ocultar o e-mail **nunca recebe a confirmação da consulta**, e nada na tela
denuncia isso.

---

## Conferir

⚠️ **Antes de abrir o navegador, dá para perguntar ao próprio Supabase** se o
provedor subiu — o endpoint é público (pede só a chave anon):

```bash
curl -sS "https://zqmqbnwvrmeabnmaaxfr.supabase.co/auth/v1/settings" \
  -H "apikey: <SUPABASE_PUBLISHABLE_KEY>" | grep -o '"apple":[a-z]*'
```

`"apple":true` quer dizer que a configuração foi aceita. Depois:

1. Abra `/auth` numa aba anônima.
2. **Continuar com a Apple** → a folha da Apple abre.
3. Autorize → volta em `/minha-conta` (paciente) ou `/medicos/cadastro` (médico).

Deu `invalid_client`? É quase sempre uma destas três: Team ID e Key ID trocados,
o segredo vencido, ou o **Client IDs** do Supabase com o App ID no lugar do
Services ID.
