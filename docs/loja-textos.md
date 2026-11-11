# A loja — o que se preenche no App Store Connect

Reescrito em 11/11/2026 para o app de HOJE (decisão do dono: "um Duolingo para
gestantes", o mais simples possível para lançar): o React Native de `mobile/`,
um jogo para aprender sobre a gestação — uma trilha com uma aula curta por dia,
sementinhas, conquistas e amigas —, com o acompanhamento do bebê. Sem
orientação médica, sem SOS, sem Comunidade (feed), sem assistente com IA e sem
nada à venda. As versões anteriores deste texto (com o SOS e a Comunidade)
estão no git — e a Apple compara o que a loja promete com o que o app faz.

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
| Categoria primária   | **Educação**                                                   |
| Categoria secundária | **Saúde e fitness**                                            |
| Idioma principal     | Português (Brasil)                                             |
| Preço                | Grátis, sem compras dentro do app (as sementinhas são do jogo) |
| URL de suporte       | `https://clovisbacha.github.io/doutorclovis/`                  |
| URL da privacidade   | `https://clovisbacha.github.io/doutorclovis/privacidade.html`  |

**Por que Educação.** O app agora é um jogo de aprendizado (a trilha com uma
aula por dia), como o Duolingo, que está em Educação. Medicina é a categoria do
escrutínio mais duro (diretriz 1.4.1) e prometeria o que o app não faz; Redes
sociais deixou de servir quando a Comunidade saiu. Saúde e fitness, como
secundária, é onde as gestantes procuram. A descrição continua tendo de dizer
que o app não orienta.

**Classificação etária.** Os Termos do app exigem 18 anos, e o cadastro e o
aceite pedem a confirmação. No questionário, responda o que o app tem: nenhum
conteúdo gerado por usuárias além do nome e da foto de perfil, que só as amigas
aceitas veem; nada de violência, sexo, apostas, compras ou navegação livre na
web; "informação médica ou de tratamento": **nenhuma** (o app não orienta). Se
a App Store Connect oferecer escolher uma classificação acima da calculada,
escolha **18+**, para casar com os Termos.

---

## Textos

**Subtítulo** (30 caracteres; este tem 30)

```
Sua gestação, uma aula por dia
```

**Palavras-chave** (100 caracteres; estas têm 98 — sem espaço depois da vírgula,
e sem repetir o que já está no nome e no subtítulo, que a loja já indexa)

```
gravidez,grávida,bebê,semanas,aprender,jogo,maternidade,pós-parto,meditação,mamãe,gratidão,cuidado
```

**Texto promocional** (170 caracteres; este tem 145 — muda sem nova revisão)

```
Uma aula curta por dia sobre a sua semana de gestação, sementinhas a cada passo e amigas jogando junto com você. Como um Duolingo para gestantes.
```

**Descrição**

```
O Obstétrica é um jogo para aprender sobre a gestação, um pouco por dia —
como um Duolingo para gestantes.

A TRILHA
• Uma aula curtinha por dia, escrita para a semana em que você está
• O cuidado do dia: um momento para respirar, uma história lida para o bebê,
  uma coisa boa guardada e um movimento leve — no seu ritmo
• A gestação inteira numa trilha, com o álbum de cada semana

O JOGO
• Sementinhas a cada passo, conquistas e a chama dos dias seguidos
• O seu Cantinho para enfeitar com o que você conquistar

AS AMIGAS
• Convide as suas amigas e veja o progresso de cada uma
• Formem uma dupla e segurem juntas a mesma chama

O BEBÊ
• A semana a semana, do tamanho de uma semente ao dia de conhecer
• Os movimentos do bebê, no seu tempo
• A agenda das suas consultas, com lembrete na véspera
• O contato de quem acompanha a sua gestação, sempre à mão
• Depois do nascimento, as 12 primeiras semanas de vocês

MODO CUIDADO
• Para quando a gestação não seguiu: o app para de falar do bebê, e o
  acolhimento continua

IMPORTANTE
O Obstétrica não dá orientação médica: não faz diagnóstico, não indica
tratamento, exame, remédio ou dieta e não substitui consulta. Quem orienta é
quem acompanha a sua gestação. Em emergência, ligue 192.
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

1. **A Trilha** — a aba que abre o app, com a chama e as sementinhas no topo.
2. **A aula do dia** — uma pergunta da semana, com as sementinhas ganhas.
3. **As atividades de hoje** — os cinco momentos do dia.
4. **As Amigas** — a dupla com a chama e os rostos das amigas.
5. **O Bebê** — a semana a semana.

> Tire os prints com a conta de demonstração povoada, nunca com dados reais.
> Print com nome de gestante de verdade é vazamento publicado — e as Amigas
> mostram rostos e nomes de outras pessoas.

---

## Privacidade — as respostas do questionário ("App Privacy")

Preencher errado aqui é pior que preencher de menos: a Apple compara o
declarado com o que o binário faz. A tabela sai do inventário do que o app
coleta (diário, "28/10 — build 42" e "build 43"), refeito sem o SOS e sem a
Comunidade (diário, "11/11 — build 44"), e bate com a Política de privacidade
do app (`docs/juridico/privacidade.md`).

**Todas as linhas: vinculado à pessoa = SIM · usado para rastrear = NÃO.** A
finalidade é **Funcionalidade do app** em todas; uma linha soma outra, na
coluna "finalidade". (Não há anúncios, SDK de análise de terceiros nem
corretores de dados.)

| categoria da Apple        | tipo                      | finalidade                   | o que é, no app                                                                                                                                                                           |
| ------------------------- | ------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Informações de contato    | Nome                      | Funcionalidade               | o nome dela                                                                                                                                                                               |
| Informações de contato    | Endereço de e-mail        | Funcionalidade               | o e-mail da conta (pela Apple, pode ser o endereço do "Ocultar meu e-mail")                                                                                                               |
| Saúde e condicionamento   | Saúde                     | Funcionalidade               | a datação da gestação, o nascimento (data e, se ela contar, hora, peso e comprimento), os movimentos do bebê, como ela estava no dia e a agenda (consultas, ultrassons, exames e vacinas) |
| Informações confidenciais | Dados confidenciais       | Funcionalidade               | gestação e parto (a Apple lista "pregnancy or childbirth information" aqui) e o Modo Cuidado (a gestação que não seguiu)                                                                  |
| Contatos                  | Contatos                  | Funcionalidade               | o contato de quem acompanha a gestação (nome, celular e e-mail), que ela digita; e as amigas dela no app                                                                                  |
| Conteúdo do usuário       | Fotos ou vídeos           | Funcionalidade               | a foto do perfil, se ela escolher uma                                                                                                                                                     |
| Conteúdo do usuário       | Outro conteúdo do usuário | Funcionalidade               | as linhas guardadas (as coisas boas e as cartas para o bebê) e o depoimento                                                                                                               |
| Identificadores           | ID do usuário             | Funcionalidade               | o id da conta                                                                                                                                                                             |
| Dados de uso              | Interação com o produto   | Funcionalidade + **Análise** | o progresso da trilha (o "lugar salvo" do jogo), o "vista há…" das Amigas e os números de uso que a equipe vê (quantas pessoas fizeram a aula do dia)                                     |

**Por que Análise.** Os números de uso que a equipe vê para melhorar o app são
análise de primeira parte. Declarar de menos é o que reprova; declarar o que é
verdade, não. (A "Personalização" da versão anterior era o filtro "fase
parecida" da Comunidade, que saiu.)

**O que NÃO entra:** localização (sem o SOS, o app não a pede), compras, dados
financeiros, histórico de navegação, de busca, diagnósticos e crash (não há
SDK), identificador de aparelho (o app não registra token de push) e contatos
da agenda do iPhone (o app não lê a agenda).

> Se um dia entrar um SDK de análise, de crash ou de anúncio, o push do
> servidor, ou se o SOS ou a Comunidade voltarem (`SOS_NO_APP` e
> `COMUNIDADE_NO_APP`, em `mobile/src/config.ts`), esta tabela e a Política
> mudam ANTES do build.

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
A conta já tem a gestação configurada, alguns dias de trilha, amigas e uma
dupla, para que todas as telas possam ser abertas.

O QUE O APP É (diretriz 1.4.1)
Um jogo para aprender sobre a gestação, um pouco por dia: uma trilha com uma
aula curta por dia, de acordo com a semana da gestação, sementinhas e
conquistas. O app NÃO dá orientação médica: não faz diagnóstico, não indica
tratamento, exame, remédio ou dieta, e diz isso no app (Perfil e Bebê), nos
Termos e nesta descrição. Em emergência, o app orienta a ligar 192.

AMIGAS (diretriz 1.2)
O único conteúdo de usuárias é o nome e a foto de perfil, vistos só pelas
amigas aceitas (a amizade precisa de aceite dos dois lados). O nome passa por
um filtro de palavras ofensivas, a amizade pode ser desfeita a qualquer
momento, e o contato da equipe fica no Perfil: contato@drclovisbacha.com.br.

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
