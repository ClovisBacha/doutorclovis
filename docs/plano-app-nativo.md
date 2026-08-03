# Plano — o app nativo

Decisão tomada em 2 de agosto: **vamos para o app nativo.** Este documento diz
como, o que muda, o que custa, e as três coisas que travam se não forem
resolvidas antes.

---

## A escolha: Capacitor, não React Native

O código tem **97.250 linhas** de TS/TSX em 48 rotas. Reescrever isso em React
Native levaria meses para reconstruir telas que já funcionam — e nenhuma das
coisas que faltam hoje precisa de reescrita.

Olhe o que você pediu e o que cada caminho entrega:

| o que falta                              | Capacitor          | React Native           |
| ---------------------------------------- | ------------------ | ---------------------- |
| Vibração no iPhone                       | plugin Haptics     | idem                   |
| Barra de status e safe-area sob controle | plugin StatusBar   | idem                   |
| Localização do SOS em segundo plano      | plugin Geolocation | idem                   |
| Push sem "adicionar à Tela de Início"    | APNs               | idem                   |
| Presença na App Store                    | sim                | sim                    |
| **Custo**                                | **semanas**        | **meses de reescrita** |

Capacitor embrulha o app web num contêiner nativo de verdade: o mesmo código
roda dentro de um `WKWebView`, e o JavaScript ganha acesso às APIs do sistema
por ponte nativa. Não é "site num quadro" — é o que o Instagram, o Notion e boa
parte dos apps de saúde fazem.

**React Native só se justificaria** se o gargalo fosse desempenho de rolagem ou
animação nativa de 120fps. Não é: a auditoria de performance mediu 1 quadro
perdido em 331, zero layout, e o gargalo real era fill-rate de GPU num efeito
que a gente pode desligar.

---

## O que fica web e o que vira app

O site **não vira app**. Ele continua onde está, e por bons motivos:

| superfície                                                            | onde vive  | por quê                                                                              |
| --------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| Site institucional, agendamento, calculadoras, blog, hospitais, lives | **web**    | é o que traz paciente pelo Google e por link compartilhado. Dentro de app isso some. |
| **App da paciente** (`/minha-conta`, jornada, respiração, SOS)        | **nativo** | é onde falta haptics, localização e push de verdade                                  |
| Painel do médico (`/painel`)                                          | **web**    | ninguém quer instalar app para ver agenda no computador                              |
| Modo acompanhante (link com token)                                    | **web**    | quem recebe o link não tem o app                                                     |

Um repositório, dois destinos: a Vercel continua publicando o site, e o build
nativo empacota **só as rotas do app**.

---

## Os três bloqueios — resolver ANTES de escrever código

### 1. Não existe como construir para iOS sem macOS

Isto é da Apple, não escolha nossa: assinar e empacotar um `.ipa` exige Xcode,
que só roda em Mac. **Eu não tenho Mac neste contêiner** — posso escrever todo o
código, a configuração e a ponte nativa, e não posso gerar o app.

Três saídas:

| opção                               | custo                        | observação                                                   |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| **GitHub Actions com runner macOS** | grátis até o limite do plano | a mais provável de servir; o build roda na nuvem a cada push |
| **Expo EAS Build**                  | ~US$ 30/mês                  | funciona com Capacitor, mais simples de configurar           |
| **Um Mac**                          | de US$ 600                   | resolve para sempre, e serve para testar de verdade          |

**Recomendo começar pelo GitHub Actions.** Se emperrar, EAS.

### 2. Conta de desenvolvedor

- **Apple Developer Program: US$ 99 por ano.** Sem isso não sai da sua máquina.
- **Google Play: US$ 25, uma vez só.**

A conta da Apple pode demorar dias para aprovar, e para conta de empresa exige
D-U-N-S. Como pessoa física sai mais rápido, mas o app fica no seu nome.

### 3. O risco de reprovação, e ele é real

Duas regras da App Store batem direto neste app:

**Diretriz 4.2 — funcionalidade mínima.** A Apple reprova app que é só um site
embrulhado. A nossa defesa tem que ser concreta, e é: push nativo, haptics no
exercício de respiração, localização em segundo plano no SOS, e funcionamento
offline. Isso precisa estar **implementado na primeira submissão**, não
prometido.

**Diretrizes 1.4.1 e 5.1.1 — app de saúde.** App de gestação de alto risco entra
na fila de escrutínio. O que ajuda: deixar explícito que o app **acompanha e não
diagnostica**, ter política de privacidade clara (já existe), e não prometer
resultado clínico. O que atrapalha: qualquer texto que soe como conduta médica.

Vale revisar os textos do chatbot e do SOS com esse olho antes de submeter.

---

## O que muda no dia a dia — e você não vai gostar de uma

**Hoje:** `git push` e em 90 segundos está no ar para todo mundo.

**Depois:** mudança de conteúdo web continua instantânea. Mudança que toque a
casca nativa vira **submissão + revisão da Apple: de 1 a 7 dias.**

Dá para amenizar: o Capacitor permite servir o conteúdo web atualizado sem
passar pela loja (Live Updates), desde que não mude código nativo. Mas a regra
de ouro passa a ser: **casca nativa muda pouco, conteúdo muda sempre.**

---

## A ordem que eu faria

### Fase 1 — a casca ✅ FEITA

Instalar Capacitor, configurar iOS e Android, e um build que gere o app. Nada de
funcionalidade nova. O objetivo é só ter o app abrindo no simulador.

**O que existe no repositório agora:**

| item                  | estado                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `@capacitor/*`        | 8.5.0 — `core`, `cli`, `ios`, `android` + `app`, `haptics`, `splash-screen`, `status-bar` |
| `ios/`                | projeto Xcode gerado, 4 plugins registrados                                               |
| `android/`            | projeto Gradle gerado, 4 plugins registrados                                              |
| `capacitor.config.ts` | `appId: br.com.obstetrica.app`, carrega o site publicado                                  |
| `native/shell/`       | a tela que aparece quando não há rede                                                     |

**Como se constrói, na sua máquina:**

```bash
bun install
bun run build      # o site — o app carrega a versão PUBLICADA, mas o build valida
bun run app:sync   # copia a casca e registra os plugins nos dois projetos
bun run app:ios      # abre no Xcode  (só macOS)
bun run app:android  # abre no Android Studio
```

**O que eu verifiquei aqui, e o que não dá para verificar:** `cap sync` roda e
registra os quatro plugins nas duas plataformas; `tsc`, lint, os 309 testes e o
build de produção passam; `bun install --frozen-lockfile` passa (era o que
quebrava a CI). O que **não** foi verificado é o app abrindo: não há macOS,
Xcode, Android SDK nem simulador neste ambiente. O primeiro `Run` é seu.

**Uma armadilha que ficou fechada:** o `SplashScreen` estava configurado com
`launchAutoHide: false`. Isso deixa a tela de abertura na tela até o JavaScript
mandar escondê-la — e se ele não rodar (rede caída, bundle que não carregou), o
app fica congelado na marca **para sempre**, sem erro nenhum no log. Agora o
lado nativo esconde sozinho em 6s e `esconderSplash()` só antecipa.

### Fase 2 — os três bugs que te incomodam hoje

Com a casca no lugar, eles deixam de ser negociação com o navegador:

- `StatusBar.setStyle` e `setOverlaysWebView` — a faixa branca acaba
- safe-area passa a vir do sistema, não de `env()` — os ícones sobem
- o botão de baixo centraliza na área real

**Isto sozinho resolve o que você me mostrou nos dois prints.**

### Fase 3 — o que a web não podia dar

1. **Haptics** — a respiração guiada finalmente vibra no iPhone. Todo o trabalho
   do padrão por duração passa a valer para as suas pacientes de iPhone, que
   hoje não sentem nada.
2. **Push nativo** — sem exigir "adicionar à Tela de Início". Hoje quem não
   instalou não recebe aviso de consulta.
3. **SOS com localização em segundo plano** — o item que está no seu backlog
   desde que a gente descobriu que a web não entrega.

### Fase 4 — loja

Ícones, capturas, textos, política, e a submissão. Conte com **duas ou três
rodadas** de revisão na primeira vez.

---

## O que eu preciso de você para começar

1. **Conta Apple Developer** — é o caminho crítico, começa hoje porque a
   aprovação demora.
2. **Escolher a pista de build** — GitHub Actions, EAS ou Mac.
3. **Android junto ou depois?** Junto custa pouco a mais e dobra o alcance; o
   Brasil é majoritariamente Android.

Enquanto isso eu já posso fazer a Fase 1 inteira — a casca não depende de conta
nem de Mac para ser escrita, só para ser compilada.

---

## O que eu paro de fazer a partir de agora

Contorno de safe-area, negociação com a barra de status e polimento de PWA
viram trabalho descartável. Vou parar de investir neles e apontar quando um
pedido cair nessa categoria — porque a partir da Fase 2 o sistema entrega isso
de graça.

A bolha, as ilustrações do bebê, o conteúdo, a vibração por duração e todos os
testes **continuam valendo integralmente**: é o mesmo código rodando dentro do
contêiner nativo.
