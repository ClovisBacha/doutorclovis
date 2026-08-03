# Fase 4 — o que se preenche nas lojas

Tudo aqui é para copiar e colar no **App Store Connect** e no **Play Console**.
Nada depende de código: depende das contas, que são suas.

> **Antes de tudo:** o app abre numa tela de LOGIN. App atrás de login sem
> credencial de teste é reprovado sem o revisor sequer abrir a segunda tela — é
> uma das causas mais banais de reprovação, e custa uma rodada inteira. Veja
> "Notas para a revisão" no fim.

---

## Identidade

| campo                | valor                     |
| -------------------- | ------------------------- |
| Bundle ID / Package  | `br.com.obstetrica.app`   |
| Nome de exibição     | Obstétrica                |
| Categoria primária   | Medicina                  |
| Categoria secundária | Saúde e fitness           |
| Classificação etária | 12+ (referências médicas) |
| Idioma principal     | Português (Brasil)        |

---

## App Store

**Subtítulo** (30 caracteres — conta os espaços)

```
Sua gestação, com seu médico
```

**Palavras-chave** (100 caracteres, separadas por vírgula, sem espaço depois da
vírgula — espaço gasta caractere e não ajuda em nada)

```
gestação,gravidez,pré-natal,obstetra,bebê,semanas,contrações,ultrassom,gestante,pré-eclâmpsia
```

**Descrição**

```
Obstétrica acompanha a sua gestação semana a semana, junto com o médico que
cuida de você.

O QUE VOCÊ ENCONTRA

• A semana do seu bebê — tamanho, desenvolvimento e o que muda no seu corpo
• Diário da gestação, com fotos e o registro do que você sentiu
• Contador de chutes e registro de contrações
• Pressão, glicemia, peso e exames em um lugar só
• Respiração guiada, com vibração no ritmo da inspiração
• SOS: um toque avisa o seu médico e os seus contatos de emergência, com a sua
  localização
• Conversa com uma assistente que conhece o seu acompanhamento

COM O SEU MÉDICO, NÃO NO LUGAR DELE

Ao vincular a sua conta ao seu obstetra, o que você registra chega a ele: os
sinais que merecem atenção aparecem no painel dele, e o SOS toca no celular
dele. Sem vínculo, o app segue sendo seu diário — a parte que depende do médico
é a que precisa dele.

IMPORTANTE

O Obstétrica acompanha e organiza informações. Ele NÃO faz diagnóstico, não
substitui consulta e não indica tratamento. Diante de qualquer sinal de alerta,
procure o seu médico ou um serviço de emergência.
```

> **Por que o parágrafo final não é opcional.** As diretrizes 1.4.1 e 5.1.1 da
> Apple colocam app de saúde numa fila de escrutínio, e o que mais reprova é
> texto que soe como conduta. "Acompanha e organiza", "não faz diagnóstico" e
> "procure o seu médico" precisam estar na descrição, não só dentro do app.

**Texto promocional** (170 caracteres, editável sem nova submissão — é onde
promoção e novidade entram, para não gastar uma revisão só por causa de texto)

```
A sua gestação, semana a semana, ligada ao médico que cuida de você. Diário,
exames, contrações e um SOS que avisa quem precisa saber.
```

**Novidades desta versão** (primeira submissão)

```
Primeira versão do Obstétrica como aplicativo.
```

---

## Google Play

**Descrição curta** (80 caracteres)

```
Sua gestação semana a semana, ligada ao obstetra que cuida de você.
```

**Descrição completa** — a mesma da App Store. O Play aceita até 4000
caracteres e não usa palavras-chave separadas: o texto da descrição É a busca,
então vale repetir "gestação", "pré-natal" e "obstetra" naturalmente no corpo.

---

## Capturas de tela

Mínimo exigido:

| loja      | o que pede                                                      |
| --------- | --------------------------------------------------------------- |
| App Store | 6,7" (iPhone 15/16 Pro Max) e 6,5". iPad só se declarar suporte |
| Play      | mínimo 2, entre 320px e 3840px, proporção até 2:1               |

As cinco telas que contam a história, nesta ordem:

1. **A home com o céu do momento** — é o que o app tem de mais distinto, e muda
   com a hora do dia.
2. **A semana do bebê** — o motivo pelo qual ela abre o app todo dia.
3. **O caminho / jornada** — mostra que há conteúdo, não só formulário.
4. **O SOS** — mostra a seriedade do produto.
5. **A ligação com o médico** — é o que separa este app dos concorrentes.

> Tire os prints com uma conta de demonstração povoada, nunca com dados reais de
> paciente. Print com nome de gestante de verdade é vazamento publicado.

---

## Privacidade — as respostas do questionário

Preencher errado aqui é pior que preencher de menos: a Apple compara o
declarado com o que o binário faz, e divergência vira reprovação com
desconfiança.

| dado                                                     | coletado | vinculado à pessoa | usado para rastrear |
| -------------------------------------------------------- | -------- | ------------------ | ------------------- |
| Nome, e-mail, telefone                                   | sim      | sim                | não                 |
| **Saúde** (pressão, glicemia, peso, exames, sintomas)    | sim      | sim                | não                 |
| **Localização precisa** (só no SOS)                      | sim      | sim                | não                 |
| Fotos (álbum da gestação)                                | sim      | sim                | não                 |
| Conteúdo do usuário (diário, conversas com a assistente) | sim      | sim                | não                 |
| Compras                                                  | sim      | sim                | não                 |
| Identificadores de dispositivo (token de push)           | sim      | sim                | não                 |
| Publicidade / corretores de dados                        | **não**  | —                  | **não**             |

**"Usado para rastrear" é NÃO em todas as linhas**, e isso é uma afirmação forte:
significa que nenhum dado sai para rede de anúncios ou corretor. Se um dia
entrar SDK de marketing, esta tabela muda antes do SDK.

URL da política de privacidade: `https://www.obstetrica.com.br/privacidade`

---

## Notas para a revisão

Cole isto no campo "App Review Information → Notes". Ele é lido — e é onde se
responde, antecipadamente, as três perguntas que este app provoca.

```
CONTA DE DEMONSTRAÇÃO
E-mail: (crie uma conta de teste povoada e coloque aqui)
Senha: (idem)

Esta conta já tem gestação configurada, diário, exames e vínculo com um médico
de teste, para que todas as telas possam ser abertas.

SOBRE A NATUREZA DO APP (diretriz 1.4.1)
O Obstétrica acompanha e organiza informações da gestação. Ele não faz
diagnóstico, não indica tratamento e não substitui consulta. A conduta é sempre
do médico que acompanha a paciente — o app apenas leva a ele o que ela
registrou.

SOBRE A LOCALIZAÇÃO
Pedida apenas quando a paciente aciona o SOS, com permissão "durante o uso". A
coordenada vai junto com o alerta para o médico dela e para os contatos de
emergência que ela mesma cadastrou. Não há rastreamento em segundo plano e o app
não pede permissão "sempre".

SOBRE EXCLUSÃO DE CONTA (diretriz 5.1.1(v))
Perfil → Excluir minha conta. A exclusão é imediata e feita por dentro do app.
Contas de MÉDICO passam por atendimento, porque a conta profissional é o vínculo
de pacientes ativas e a autoria de prontuário cuja guarda a lei brasileira
exige por 20 anos — a própria diretriz prevê essa exceção para setor regulado.
```

---

## Antes de apertar "enviar"

- [ ] `supabase/APLICAR_PUSH_NATIVO.sql` aplicado (sem ele o push nativo é mudo)
- [ ] `APLICAR_ESQUECIMENTO.sql` e `APLICAR_EVENTOS_CLINICOS.sql` aplicados —
      **sem os cascades a exclusão de conta FALHA**, e é a diretriz que reprova
      sozinha
- [ ] Capability "Push Notifications" ligada no Xcode
- [ ] `google-services.json` do Firebase em `android/app/`
- [ ] Variáveis `APNS_*` e `FCM_*` no ambiente de produção
- [ ] Conta de demonstração criada e povoada
- [ ] O workflow **App nativo** verde nos dois jobs
- [ ] Um `Run` de verdade num iPhone e num Android — nada neste repositório
      substitui isso
