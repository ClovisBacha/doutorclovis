# Amanhã, no MacBook — o app da Obstétrica no iPhone

> Escrito na madrugada de 22/ago para o Dr. Clóvis rodar no MacBook M5.
> Cada comando abaixo foi verificado contra o estado real do repositório —
> onde eu **não pude** verificar (porque exige macOS ou conta Apple), está
> dito com todas as letras.

---

## Antes de começar: o que já está pronto

Isto é importante porque o `docs/plano-iap.md` estava **desatualizado** e
estimava para baixo. Conferido item por item hoje:

| o que                       | estado                                                 |
| --------------------------- | ------------------------------------------------------ |
| Capacitor                   | ✅ instalado — 8.5.0 (`core`, `cli`, `ios`, `android`) |
| Projeto iOS                 | ✅ existe, em `ios/`                                   |
| Gerenciador de dependências | ✅ **Swift Package Manager** — _não_ CocoaPods         |
| Bundle ID                   | ✅ `br.com.obstetrica.app`                             |
| Ícone 1024                  | ✅ presente                                            |
| Permissões no `Info.plist`  | ✅ **corrigidas esta noite** — ver abaixo              |
| Push em segundo plano       | ✅ declarado esta noite                                |
| Plugin de COMPRA (IAP)      | ❌ não instalado                                       |
| Validação de recibo         | ❌ não existe                                          |
| Produtos nas lojas          | ❌ **só você pode fazer**                              |

⚠️ **`pod install` NÃO existe neste projeto.** Ele usa SPM (`ios/App/CapApp-SPM`).
Se algum tutorial mandar rodar `pod install`, ignore — vai falhar e confundir.

---

## O que eu consertei esta noite, e que teria te travado

**Faltavam quatro frases no `Info.plist`.** No iOS, usar câmera, microfone ou
galeria sem a frase correspondente **não é permissão negada — é o app
fechando**, na hora, sem diálogo e sem erro.

O arquivo tinha **uma** declaração (localização), e o app usa três recursos:
oito campos de foto e o gravador do diário. Você teria descoberto isso tocando
no microfone e vendo o app sumir.

Corrigido, com teste que roda no Linux e não deixa voltar.

---

## Passo 1 — trazer o código e conferir (5 min)

```bash
git clone https://github.com/ClovisBacha/doutorclovis.git
cd doutorclovis
git checkout claude/determined-edison-XSh9l

# Bun, se ainda não tiver:  curl -fsSL https://bun.sh/install | bash
bun install

cp .env.example .env       # as chaves públicas; os segredos ficam vazios
bun run verificar          # tsc + lint + testes + git — tem de sair "tudo verde"
```

⚠️ **Se `bun run verificar` não sair verde, PARE aqui.** Seguir para o Xcode com
o projeto vermelho troca um erro fácil de ler por um difícil.

---

## Passo 2 — gerar e abrir o projeto iOS (5 min)

> ✅ **`cap sync ios` foi rodado aqui e passou** — 0,39 s, os seis plugins
> encontrados, `Package.swift` escrito. O que não dá para verificar no Linux é
> o que vem depois de abrir o Xcode.

```bash
bun run build              # gera .vercel/output — leva ~2 min
npx cap sync ios           # copia a casca e os 6 plugins para o projeto iOS
npx cap open ios           # abre o Xcode
```

**O que `cap sync` faz aqui:** copia `native/shell` e registra os seis plugins
(`app`, `geolocation`, `haptics`, `push-notifications`, `splash-screen`,
`status-bar`). Ele resolve os pacotes SPM sozinho — pode demorar na primeira vez.

---

## Passo 3 — no Xcode, três coisas que só se fazem lá (15 min)

Estas eu **não consigo fazer daqui**, e nenhuma delas avisa quando falta.

1. **Signing** — aba _Signing & Capabilities_ → marque _Automatically manage
   signing_ → escolha seu Team. Sem conta paga ainda? Dá para rodar no
   **simulador** sem nada disso. No iPhone de verdade, uma conta grátis já
   serve para 7 dias.

2. **Push Notifications** — no mesmo lugar, `+ Capability` → _Push
   Notifications_. ⚠️ Isto é **separado** do `UIBackgroundModes` que eu
   declarei: os dois são necessários, e o iOS não avisa quando só um existe.

3. **Rodar** — escolha um simulador (iPhone 16, por exemplo) e ▶︎.

⚠️ **O que esperar:** o app abre e carrega `www.obstetrica.com.br/auth` — ele
carrega o site publicado, não arquivos locais. Isso é deliberado e está
explicado em `capacitor.config.ts`. Consequência prática: **sem internet o app
não abre** (mostra a tela de `native/shell`).

---

## Passo 4 — o que testar no aparelho, e por quê

Nesta ordem, porque é a ordem do risco:

| #   | teste                               | o que ele prova                                  |
| --- | ----------------------------------- | ------------------------------------------------ |
| 1   | tocar no microfone (ditar o diário) | as frases novas do `Info.plist` — antes, fechava |
| 2   | pôr foto no perfil                  | idem, câmera e galeria                           |
| 3   | apertar o SOS                       | localização + o registro que consertei ontem     |
| 4   | receber um push                     | Capability + APNs + `UIBackgroundModes`, os três |
| 5   | abrir Comunidade e Jogo             | a aba nova, e a trilha (a mais pesada do app)    |

---

## Passo 5 — o IAP, que é o que destrava a receita

⚠️ **A ordem aqui importa, e a primeira etapa é só sua.**

1. **Cadastrar os produtos** em App Store Connect. Sem id de produto não há o
   que comprar nem o que validar — isto bloqueia as outras duas. Os ids
   sugeridos e os preços estão em `docs/plano-iap.md`.
2. **Instalar um plugin de compra** e ligar o `comprar()` das três telas
   (assinatura, Sementinhas, paywall da aula).
3. **Validar o recibo no servidor** — App Store Server API + notificações V2.
   É a parte inegociável: nunca acreditar no cliente.

⚠️ **`IAP_ATIVO` é a ÚLTIMA coisa a virar, não a primeira.** Com os produtos
ausentes, ligá-la troca "a compra ainda não está aberta" por **um erro de loja
no meio do checkout** — pior, porque a paciente já decidiu pagar.

**Não fiz os passos 2 e 3 de propósito:** sem produto cadastrado não há como
exercitar nenhum dos dois, e código de pagamento que nunca rodou é a pior coisa
para se ter no repositório com cara de pronto.

---

## Um comando de 30 segundos que vale muito: regenerar os tipos

⚠️ **`src/integrations/supabase/types.ts` conhece 27 tabelas de 112, e não sabe
o que é `doctor_id`.** Medido esta noite.

Consequência prática: o autocompletar e a checagem de tipo do Supabase valem
para **menos de um quarto do banco** — e é por isso que existem **559 casts
`as any`** nos arquivos de servidor. Cada um deles é um lugar onde o TypeScript
parou de ajudar.

E foi essa lacuna que deixou passar, esta noite, três nomes de coluna que eu
inventei no contador da Comunidade (`amizades.de_id` não existe; é `menor`).
Achei conferindo o SQL à mão. Com os tipos em dia, o `tsc` teria acusado.

```bash
# na raiz do projeto, no seu Mac (você tem as credenciais)
npx supabase login                       # se for a primeira vez
npx supabase gen types typescript \
  --project-id <o-ref-do-projeto> \
  > src/integrations/supabase/types.ts

bun run verificar                        # tem de continuar verde
```

⚠️ **Olhe o diff antes de commitar.** Se ele vier vazio ou pequeno demais, a
geração falhou em silêncio — o arquivo é a fonte de tipo do app inteiro, e um
truncado é pior que um desatualizado.

**Eu não fiz isso daqui de propósito:** exige conectar na sua base de produção,
e um `types.ts` gerado torto quebraria os tipos de tudo. É seu, e é um comando.

---

## O risco que precisa de decisão sua: a diretriz 4.2

O app carrega o site publicado. A Apple reprova app que é "só um site
embrulhado" — e a defesa precisa estar **implementada na primeira submissão**,
não prometida.

O que já joga a favor: push nativo, geolocalização nativa no SOS, haptics.
O que ajudaria muito: alguma coisa que **só faça sentido no aparelho** — o
Health Kit, um widget, ou o SOS funcionando com o app fechado.

Vale conversarmos antes de submeter. Uma rejeição por 4.2 custa semanas.

---

## Se algo der errado

| sintoma                                | causa provável                                     |
| -------------------------------------- | -------------------------------------------------- |
| `pod install` falha                    | este projeto usa SPM — não rode                    |
| app abre em branco                     | sem internet, ou o site fora do ar                 |
| app fecha ao tocar em câmera/microfone | `Info.plist` — mas isso foi corrigido; me avise    |
| push não chega                         | falta a Capability no Xcode, ou o certificado APNs |
| `cap sync` reclama de `webDir`         | rode `bun run build` antes                         |

Me manda o erro exato que eu resolvo — inclusive o texto do Xcode, que costuma
apontar para a linha errada.
