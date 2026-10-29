# A loja — o que se preenche no App Store Connect

Reescrito na fase 4 (28/10/2026) para o app de HOJE: o React Native de
`mobile/`, uma comunidade de gestantes e mães com um jogo de cuidado diário, sem
orientação médica, sem médico vinculado na v1, sem assistente com IA e sem nada
à venda. O texto de setembro descrevia outro produto (médico vinculado,
pressão, glicemia, exames, assistente, categoria Medicina) — e a Apple compara o
que a loja promete com o que o app faz.

Tudo aqui é para copiar e colar. Nada depende de código: depende da conta
Apple, que é sua. Os campos com limite de caracteres foram contados.

> **Antes de tudo:** o app abre numa tela de LOGIN. App atrás de login sem conta
> de demonstração é devolvido sem o revisor abrir a segunda tela. Veja "Notas
> para a revisão" no fim.

---

## Identidade

| campo                | valor                                                          |
| -------------------- | -------------------------------------------------------------- |
| Bundle ID            | `br.com.obstetrica.app`                                        |
| Nome na loja         | `Obstétrica — Gestantes e Mães` (29 de 30)                     |
| Nome no iPhone       | Obstétrica (o `name` do `app.json`, não muda)                  |
| Categoria primária   | **Redes sociais**                                              |
| Categoria secundária | **Saúde e fitness**                                            |
| Idioma principal     | Português (Brasil)                                             |
| Preço                | Grátis, sem compras dentro do app (as sementinhas são do jogo) |
| URL de suporte       | `https://clovisbacha.github.io/doutorclovis/`                  |
| URL da privacidade   | `https://clovisbacha.github.io/doutorclovis/privacidade.html`  |

**Por que Redes sociais, e não Medicina.** É a decisão do dono de 21/10/2026: o
app é rede social + gamificação, não conselho médico. Medicina é a categoria do
escrutínio mais duro (diretriz 1.4.1) e prometeria o que o app deixou de fazer.
Saúde e fitness, como secundária, é onde as gestantes procuram. Se preferir o
inverso (Saúde e fitness primária), nada no app muda — mas a descrição abaixo
continua tendo de dizer que o app não orienta.

**Classificação etária.** Os Termos do app exigem 18 anos, e o cadastro e o
aceite pedem a confirmação. No questionário, responda o que o app tem:
conteúdo gerado por usuárias (a Comunidade), com moderação; nada de violência,
sexo, apostas, compras ou navegação livre na web; "informação médica ou de
tratamento": **nenhuma** (o app não orienta). Se a App Store Connect oferecer
escolher uma classificação acima da calculada, escolha **18+**, para casar com
os Termos.

---

## Textos

**Subtítulo** (30 caracteres; este tem 26)

```
Sua gestação, entre amigas
```

**Palavras-chave** (100 caracteres; estas têm 95 — sem espaço depois da vírgula,
e sem repetir o que já está no nome e no subtítulo, que a loja já indexa)

```
gravidez,grávida,bebê,semanas,comunidade,maternidade,pós-parto,meditação,mamãe,gratidão,cuidado
```

**Texto promocional** (170 caracteres; este tem 124 — muda sem nova revisão)

```
A sua gestação entre amigas: o cuidado de cada dia, a semana do bebê, uma comunidade que entende você e um SOS sempre à mão.
```

**Descrição**

```
O Obstétrica é uma comunidade de gestantes e mães, com um jogo de cuidado
diário que cabe em cinco minutos.

O CUIDADO DE HOJE
• Uma aula curta sobre a semana do bebê, um momento para respirar, uma
  história lida para o bebê, uma coisa boa guardada e um movimento leve — no
  seu ritmo
• Sementinhas, conquistas, a chama dos dias seguidos e o seu Cantinho para
  enfeitar
• A trilha da gestação inteira, com o álbum de cada semana

A COMUNIDADE
• Conte como você está, com fotos, para todo mundo, para quem te acompanha ou
  só para as suas amigas
• Encontre quem está numa fase parecida com a sua
• Publique os seus marcos e conquistas com um toque
• Denunciar e bloquear em toda publicação, perfil e comentário

AS AMIGAS
• Convide as suas amigas e veja o Cantinho de cada uma
• Formem uma dupla e segurem juntas a mesma chama

O BEBÊ
• A semana a semana, do tamanho de uma semente ao dia de conhecer
• Os movimentos do bebê, no seu tempo
• A agenda das suas consultas, com lembrete na véspera
• Depois do nascimento, as 12 primeiras semanas de vocês

O SOS
• Na tela do SOS: um toque liga para o 192, e outro avisa quem você escolheu,
  com a sua localização

MODO CUIDADO
• Para quando a gestação não seguiu: o app para de falar do bebê, e o SOS e o
  acolhimento continuam

IMPORTANTE
O Obstétrica não dá orientação médica: não faz diagnóstico, não indica
tratamento, exame, remédio ou dieta e não substitui consulta. Quem orienta é
quem acompanha a sua gestação. Em emergência, use o SOS ou ligue 192.
```

> **Por que o parágrafo final não é opcional.** As diretrizes 1.4.1 e 5.1.1
> põem app que toca em saúde numa fila de escrutínio, e o que reprova é texto
> que soe como conduta. "Não dá orientação médica" e "em emergência, ligue 192"
> precisam estar na descrição, não só dentro do app.

**Novidades desta versão** (primeira submissão)

```
Primeira versão do Obstétrica.
```

---

## Capturas de tela

A App Store pede as de 6,9" (iPhone 16 Pro Max / 17 Pro Max) — e aceita usá-las
para os tamanhos menores. O app não declara iPad (`supportsTablet: false`).

As cinco que contam a história, nesta ordem:

1. **O Hoje** — o céu da hora, o bebê da semana e o cuidado do dia.
2. **A Comunidade** — o feed, com o "Conte como você está hoje".
3. **As Amigas** — a dupla com a chama e os rostos das amigas.
4. **O Bebê** — a semana a semana.
5. **O SOS** — um toque para o 192 e para quem você escolheu.

> Tire os prints com a conta de demonstração povoada, nunca com dados reais.
> Print com nome de gestante de verdade é vazamento publicado — e a Comunidade
> mostra rostos e nomes de outras pessoas.

---

## Privacidade — as respostas do questionário ("App Privacy")

Preencher errado aqui é pior que preencher de menos: a Apple compara o
declarado com o que o binário faz. A tabela sai do inventário do que o app de
hoje coleta (diário, "28/10 — build 42" e "build 43") e bate com a Política de
privacidade do app (`docs/juridico/privacidade.md`).

**Todas as linhas: vinculado à pessoa = SIM · usado para rastrear = NÃO.** A
finalidade é **Funcionalidade do app** em todas; três linhas somam outra, na
coluna "finalidade". (Não há anúncios, SDK de análise de terceiros nem
corretores de dados.)

| categoria da Apple        | tipo                      | finalidade                          | o que é, no app                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Informações de contato    | Nome                      | Funcionalidade                      | o nome dela                                                                                                                                                                                                                                                                                   |
| Informações de contato    | Endereço de e-mail        | Funcionalidade                      | o e-mail da conta (pela Apple, pode ser o endereço do "Ocultar meu e-mail")                                                                                                                                                                                                                   |
| Saúde e condicionamento   | Saúde                     | Funcionalidade + **Personalização** | a datação da gestação, o nascimento (data e, se ela contar, hora, peso e comprimento), os movimentos do bebê, as contrações cronometradas (horários e intensidade), como ela estava no dia, a agenda (consultas, ultrassons, exames e vacinas), o tipo sanguíneo, as alergias e as medicações |
| Informações confidenciais | Dados confidenciais       | Funcionalidade + **Personalização** | gestação e parto (a Apple lista "pregnancy or childbirth information" aqui) e o Modo Cuidado (a gestação que não seguiu)                                                                                                                                                                      |
| Localização               | Localização precisa       | Funcionalidade                      | só quando ela toca em "Pedir socorro agora", no SOS                                                                                                                                                                                                                                           |
| Contatos                  | Contatos                  | Funcionalidade                      | o contato de emergência e quem acompanha a gestação (nome, telefone e e-mail), que ela digita; e a rede dela no app — as amigas, quem ela segue e quem a segue                                                                                                                                |
| Conteúdo do usuário       | Fotos ou vídeos           | Funcionalidade                      | as fotos da Comunidade e a do perfil                                                                                                                                                                                                                                                          |
| Conteúdo do usuário       | Outro conteúdo do usuário | Funcionalidade                      | publicações, comentários, bio, as publicações salvas, as linhas guardadas (as coisas boas e as cartas para o bebê) e o depoimento                                                                                                                                                             |
| Identificadores           | ID do usuário             | Funcionalidade                      | o id da conta                                                                                                                                                                                                                                                                                 |
| Dados de uso              | Interação com o produto   | Funcionalidade + **Análise**        | o progresso da jornada (o "lugar salvo" do jogo), o "vista há…" das Amigas e os números de uso que a equipe vê (quantas pessoas fizeram o cuidado do dia)                                                                                                                                     |

**Por que essas três finalidades a mais.** _Personalização_: a datação (Saúde e
Confidenciais) também sugere pessoas numa fase parecida, quando ela liga o
filtro — a Apple chama isso de personalização, mesmo sem terceiro nenhum.
_Análise_: os números de uso que a equipe vê para melhorar o app são análise
de primeira parte. Declarar de menos é o que reprova; declarar o que é verdade,
não.

**O que NÃO entra:** compras, dados financeiros, histórico de navegação, de
busca (a busca de pessoas não é guardada), diagnósticos e crash (não há SDK),
identificador de aparelho (o app não registra token de push) e contatos da
agenda do iPhone (o app não lê a agenda).

> Se um dia entrar um SDK de análise, de crash ou de anúncio, ou o push do
> servidor, esta tabela e a Política mudam ANTES do SDK.

URL da política de privacidade (Privacy Policy URL):
`https://clovisbacha.github.io/doutorclovis/privacidade.html` — ver "Onde a
Privacidade e os Termos estão hospedados", no fim.

---

## Notas para a revisão

Cole no campo "App Review Information → Notes".

```
CONTA DE DEMONSTRAÇÃO
E-mail: (crie uma conta de teste povoada e coloque aqui)
Senha: (idem)
A conta já tem a gestação configurada, alguns dias de jornada, amigas, uma
dupla e publicações na Comunidade, para que todas as telas possam ser abertas.

O QUE O APP É (diretriz 1.4.1)
Uma comunidade de gestantes e mães com um jogo de cuidado diário. O app NÃO dá
orientação médica: não faz diagnóstico, não indica tratamento, exame, remédio
ou dieta, e diz isso no app (Perfil e Bebê), nos Termos e nesta descrição.

O SOS E A LOCALIZAÇÃO
A permissão de localização é só "durante o uso", e é pedida quando a usuária
abre a tela do SOS, para a localização estar pronta no aperto. Ela só sai do
aparelho quando a usuária toca em "Pedir socorro agora": o servidor avisa,
por e-mail (e por WhatsApp ou SMS, quando esses canais estão ligados), o
contato de emergência e quem acompanha a gestação, que ela mesma cadastrou. O
SOS também liga para o 192 pelo telefone. Não há localização em segundo
plano, e o app não pede a permissão "sempre".

CONTEÚDO DE USUÁRIAS (diretriz 1.2)
- Antes de publicar, comentar ou reagir pela primeira vez, a usuária aceita as
  regras da Comunidade (tolerância zero com conteúdo ofensivo ou abusivo).
- Toda publicação, perfil e comentário tem Denunciar e Bloquear (botão ⋯).
- Texto ofensivo é barrado no aparelho e no servidor; conteúdo denunciado é
  revisto em até 24 horas, e contas que quebram as regras são removidas.
- Contato publicado no app: contato@drclovisbacha.com.br.

CONTA (diretriz 5.1.1(v))
Perfil → Excluir minha conta: a exclusão é feita dentro do app, na hora.
Perfil → Baixar uma cópia dos meus dados: um arquivo com o que ela registrou.
Sign in with Apple disponível na tela de entrada.

COMPRAS
Não há compras no app. As sementinhas são pontos do jogo, ganhos com as
atividades, sem valor em dinheiro.
```

---

## Antes de apertar "enviar" (o que só o dono destrava)

- [x] **Ligar o GitHub Pages, uma vez** (feito em 29/10; as três páginas respondem): Settings → Pages → Build and
      deployment → Source: **GitHub Actions**. Sem isso as URLs de suporte e de
      privacidade da tabela de identidade não respondem — ver "Onde a
      Privacidade e os Termos estão hospedados", no fim.
- [ ] Revisão jurídica dos Termos e da Privacidade (`docs/juridico/*.md`): foram
      escritos a partir do que o app faz, mas não por advogado.
- [ ] Conta de demonstração criada e povoada (as notas acima dependem dela).
- [ ] As capturas de tela, com a conta de demonstração.
- [ ] O questionário de privacidade, com a tabela acima.
- [ ] Um build de verdade num iPhone: nada neste repositório substitui isso.

### Onde a Privacidade e os Termos estão hospedados

No **GitHub Pages** deste repositório, publicados pelo workflow
`.github/workflows/paginas-juridicas.yml`:

| página                  | URL                                                           |
| ----------------------- | ------------------------------------------------------------- |
| Suporte                 | `https://clovisbacha.github.io/doutorclovis/`                 |
| Política de privacidade | `https://clovisbacha.github.io/doutorclovis/privacidade.html` |
| Termos de uso           | `https://clovisbacha.github.io/doutorclovis/termos.html`      |

- **Sai só `docs/juridico`** (as três páginas), nunca a pasta `docs` inteira —
  ali mora o diário.
- **Fica em dia sozinho:** mudou o texto em `mobile/src/lib/juridico/`, rode
  `bun mobile/scripts/gerar-juridico.ts` e empurre; o workflow publica a cada
  push que muda `docs/juridico`. E a CI reprova se as cópias ficarem atrás do
  texto do app.
- **A página de suporte** é a URL de suporte que a App Store exige (ela precisa
  levar a um contato): o e-mail, que saúde é com quem acompanha a gestação, o
  192, e onde ficam a exclusão da conta e a cópia dos dados.
- ⚠️ **Não renomeie os arquivos nem o repositório** depois de pôr as URLs no
  App Store Connect: o link quebra, e a revisão reprova app com link de
  privacidade quebrado.

Por que não os outros caminhos: o domínio de hoje (`www.obstetrica.com.br`)
exigiria mexer no deploy do site, que está congelado; e um documento colado
no Google Docs ou no Notion ficaria atrás do texto do app na primeira mudança.
