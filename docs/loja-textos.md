# A loja — o que se preenche no App Store Connect

> **APROVADO PELO DONO EM 20/11/2026** ("bora faz o recomendado"): é este o
> texto que vai para o App Store Connect. Escrito em 19/11 como rascunho.
>
> **O app de bem-estar materno, com a Bolha guia.** O dono, em 19/11: "a mãe esperta é também aquela que cuida da saúde [...]
> um aplicativo de bem-estar materno [...] o bebê bolha será esse guia neste
> caminho". Este texto reposiciona a loja: de "um Duolingo para gestantes"
> (um jogo de aprender) para **bem-estar materno** (aprender, respirar, mexer
> o corpo, criar vínculo e guardar o que foi bom), com a Bolha como guia.
>
> **O que mudou em relação à versão de 11/11** (cada campo mudado traz a
> marca **[NOVO 19/11]** e o valor anterior logo abaixo, para comparar):
>
> 1. **Nome na loja**: `Mãe Esperta: Bem-estar Materno` (antes, `Mãe Esperta:
Aula da Gravidez`). Ver a nota sobre o `CLAUDE.md` na tabela.
> 2. **Categoria**: Saúde e fitness passa a primária, Educação vira a
>    secundária (antes, o contrário). O porquê está logo abaixo da tabela.
> 3. **Subtítulo, palavras-chave, texto promocional e descrição** reescritos
>    para o bem-estar, com a Bolha e os cinco pilares.
> 4. **Sai o "Duolingo"** do texto promocional e da descrição: a diretriz
>    2.3.7 proíbe nome de outro app nos metadados, e era um motivo de recusa
>    à toa.
> 5. **As capturas** mudam de ordem e ganham legenda; sai a captura do bebê
>    ilustrado (a ilustração saiu do app em 19/11).
> 6. **As notas para a revisão**: só o parágrafo "O QUE O APP É", para casar
>    com a descrição nova. O resto (a conta de demonstração, a falta de
>    orientação médica, as Amigas, a conta, as compras) ficou igual.
>
> **O que NÃO mudou**: a classificação etária, o questionário de privacidade
> inteiro, as URLs de suporte, privacidade e termos, a lista de "antes de
> apertar enviar" e o lugar onde as páginas estão hospedadas.

Escrito em 11/11/2026 para o app de HOJE (o React Native de `mobile/`) e
reposicionado em 19/11/2026: um app de bem-estar para a gestação, com uma
aula curta por dia, pausas para respirar, movimentos leves, histórias para o
bebê e gratidão, guiado pela Bolha, com o acompanhamento do bebê, a trilha,
as sementinhas e as amigas. Sem orientação médica, sem SOS, sem Comunidade
(feed), sem assistente com IA e sem nada à venda. As versões anteriores deste
texto estão no git, e a Apple compara o que a loja promete com o que o app faz.

Tudo aqui é para copiar e colar. Nada depende de código: depende da conta
Apple, que é sua. Os campos com limite de caracteres foram contados.

> **Antes de tudo:** o app abre numa tela de LOGIN. App atrás de login sem conta
> de demonstração é devolvido sem o revisor abrir a segunda tela. Veja "Notas
> para a revisão" no fim.

> **Saúde sem promessa (a Apple e o CFM).** Bem-estar não é conselho médico.
> Em nenhum campo: "reduz a ansiedade", "melhora o sono", "fortalece",
> "previne", "alivia", "faz bem para o bebê", "saudável", "recomendado". A
> Apple reprova metadado que promete efeito de saúde sem prova (diretrizes
> 1.4.1 e 2.3.1), e a publicidade ligada a um médico não pode prometer
> resultado (Resolução CFM 2.336/2023). Se um dia o texto citar o Dr. Clóvis,
> que seja como quem escreveu as aulas, nunca como garantia. O que pode:
> "uma pausa para respirar", "movimentos leves, no seu ritmo", "desacelerar",
> "cuidar de você".

---

## Identidade

**O nome é Mãe Esperta** (decisão do dono, 12/11/2026 — antes, Obstétrica). O
perfil do Instagram é `@maeesperta.app`. No INPI, o único pedido para "Mãe
Esperta" é de 2014, de outra pessoa, na classe 45, e foi definitivamente
arquivado: vale pedir o registro nas classes 9 e 41. O Bundle ID não muda (a
pessoa não o vê, e trocá-lo seria outro app na loja).

| campo                | valor                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Bundle ID            | `br.com.obstetrica.app`                                           |
| Nome na loja         | **[NOVO 19/11]** `Mãe Esperta: Bem-estar Materno` (30 de 30)      |
|                      | antes: `Mãe Esperta: Aula da Gravidez` (29 de 30)                 |
| Nome no iPhone       | Mãe Esperta (o `name` do `app.json`)                              |
| Ícone                | A Bolha de capelo saindo do livro aberto (`mobile/assets/marca/`) |
| Categoria primária   | **[NOVO 19/11]** **Saúde e fitness** (antes, Educação)            |
| Categoria secundária | **[NOVO 19/11]** **Educação** (antes, Saúde e fitness)            |
| Idioma principal     | Português (Brasil)                                                |
| Preço                | Grátis, sem compras dentro do app (as sementinhas são do jogo)    |
| URL de suporte       | `https://clovisbacha.github.io/doutorclovis/`                     |
| URL da privacidade   | `https://clovisbacha.github.io/doutorclovis/privacidade.html`     |

**O nome na loja.** "Bem-estar Materno" diz em duas palavras o que o app
virou, e vale para a gestação e para as 12 semanas depois do parto. A palavra
que as gestantes digitam na busca ("gravidez") vai nas palavras-chave. A
alternativa que ficou de fora era `Mãe Esperta: Gravidez Leve` (26 de 30). O
nome pode mudar até a primeira submissão sem custo; depois, só com versão nova.
O `CLAUDE.md` da raiz já cita o nome novo.

**[NOVO 19/11] Por que Saúde e fitness passa a primária** (antes, Educação):

- **O que o app promete mudou.** Em 11/11 ele era "um jogo para aprender",
  como o Duolingo, que mora em Educação. Agora a promessa é bem-estar:
  aprender, mas também respirar, desacelerar, mexer o corpo, criar vínculo e
  guardar o que foi bom. É o que se acha em Saúde e fitness (os apps de
  meditação e os de gestação moram lá), e é lá que a gestante procura.
- **A loja compara a categoria com o app.** Um app cuja descrição abre com
  respiração e meditação, na categoria Educação, soa desencontrado para o
  revisor e para quem navega.
- **Não aumenta o escrutínio.** A Apple olha a saúde pelo conteúdo, não pela
  categoria: o que reprova é promessa de efeito e orientação, e o texto não
  tem nenhuma das duas. Medicina continua fora (diretriz 1.4.1: é a
  categoria de quem orienta, e o app não orienta).
- **O custo.** Saúde e fitness é mais disputada que Educação, então subir
  nas listas da categoria é mais difícil. Para um app novo, o que traz gente
  é a busca, e a busca não depende da categoria. Educação fica como
  secundária, porque a aula do dia continua no centro.

**Antes (11/11), para comparar:** "O app agora é um jogo de aprendizado (a
trilha com uma aula por dia), como o Duolingo, que está em Educação. Medicina
é a categoria do escrutínio mais duro (diretriz 1.4.1) e prometeria o que o
app não faz; Redes sociais deixou de servir quando a Comunidade saiu. Saúde e
fitness, como secundária, é onde as gestantes procuram."

**Classificação etária.** Os Termos do app exigem 18 anos, e o cadastro e o
aceite pedem a confirmação. No questionário, responda o que o app tem: nenhum
conteúdo gerado por usuárias além do nome e da foto de perfil, que só as amigas
aceitas veem; nada de violência, sexo, apostas, compras ou navegação livre na
web; "informação médica ou de tratamento": **nenhuma** (o app não orienta). Se
a App Store Connect oferecer escolher uma classificação acima da calculada,
escolha **18+**, para casar com os Termos.

---

## Textos

**[NOVO 19/11] Subtítulo** (30 caracteres; este tem 29)

```
Uma aula e um respiro por dia
```

> antes: `Sua gestação, uma aula por dia` (30). O conhecimento e a paz, os dois
> lados do bem-estar que o dono descreveu, numa frase.

**[NOVO 19/11] Palavras-chave** (100 caracteres; estas têm 95, sem espaço
depois da vírgula e sem repetir o que já está no nome e no subtítulo, que a
loja já indexa: mãe, esperta, bem-estar, materno, aula, respiro, dia)

```
gravidez,gestante,grávida,gestação,bebê,semanas,meditação,respiração,relaxar,gratidão,pós-parto
```

> antes: `grávida,gestante,bebê,semanas,aprender,jogo,maternidade,pós-parto,meditação,mamãe,gratidão,cuidado`
> (98). Saem "jogo" e "aprender" (o app não se vende mais como jogo), e
> "maternidade", "mamãe" e "cuidado" (perto demais de "materno" e "mãe", que
> o nome já cobre). Entram "gravidez" e "gestação" (as buscas mais comuns,
> que o nome antigo cobria), "respiração" e "relaxar".

**[NOVO 19/11] Texto promocional** (170 caracteres; este tem 155, e muda sem
nova revisão)

```
Com a Bolha como guia: uma aula curta sobre a sua semana, uma pausa para respirar, movimentos leves e uma coisa boa guardada. Ser esperta é cuidar de você.
```

> antes: "Uma aula curta por dia sobre a sua semana de gestação, sementinhas a
> cada passo e amigas jogando junto com você. Como um Duolingo para
> gestantes." (145). O "Duolingo" saiu: nome de outro app nos metadados é
> motivo de recusa (diretriz 2.3.7).

**[NOVO 19/11] Descrição**

```
O Mãe Esperta é um app de bem-estar para a gestação. Ser esperta é cuidar de você, e cuidar de você é cuidar de vocês dois.

Quem guia é a Bolha, uma bolha de sabão curiosa e carinhosa. Todo dia ela pergunta como você está e sugere o próximo passo, no seu ritmo.

APRENDER
• Uma aula curtinha por dia, escrita para a semana em que você está
• Perguntas rápidas no fim, com o porquê de cada resposta
• A gestação inteira numa trilha, com o álbum de cada semana

RESPIRAR E DESACELERAR
• Pausas guiadas para respirar e meditar, de poucos minutos
• Sons para a noite, como chuva e mar, para descansar

MEXER O CORPO
• Movimentos leves, no seu ritmo, e você pula o que quiser

VÍNCULO
• Histórias curtinhas para ler em voz alta para o bebê
• Para vocês dois: da 28ª semana em diante, um momento com quem vai estar com você, para respirarem juntos e combinarem um gesto e uma palavra

GRATIDÃO
• Uma coisa boa guardada por dia, que vira uma carta para depois

A SUA SEMANA
• A semana a semana, do tamanho de uma semente ao dia de conhecer
• Os movimentos do bebê, no seu tempo
• A agenda das suas consultas, com lembrete na véspera
• O contato de quem acompanha a sua gestação, sempre à mão
• Depois do nascimento, as 12 primeiras semanas de vocês

O JOGO E AS AMIGAS
• Sementinhas a cada cuidado, conquistas e a chama dos dias seguidos
• Convide as suas amigas e formem uma dupla para manter a chama juntas
• O seu Cantinho, para enfeitar com o que você conquistar

MODO CUIDADO
• Para quando a gestação não seguiu: o app para de falar do bebê, e o acolhimento continua

IMPORTANTE
O Mãe Esperta é um app de bem-estar e aprendizado e não dá orientação médica: não faz diagnóstico, não indica tratamento, exame, remédio ou dieta e não substitui consulta. Quem orienta é quem acompanha a sua gestação. Em emergência, ligue 192.
```

> **O que mudou na descrição:** abre pelo bem-estar e pela Bolha (antes, "um
> jogo para aprender sobre a gestação [...] como um Duolingo para
> gestantes"); os cinco pilares viram as seções (aprender, respirar, mexer,
> vínculo, gratidão); o jogo e as amigas descem para depois do que ela faz
> por si. Cada linha descreve o que o app TEM, sem efeito prometido: "pausas
> para respirar", e nunca "para reduzir a ansiedade". O parágrafo final é o
> mesmo, com "app de bem-estar e aprendizado" na frente.

> **Por que o parágrafo final não é opcional.** As diretrizes 1.4.1 e 5.1.1
> põem app que toca em saúde numa fila de escrutínio, e o que reprova é texto
> que soe como conduta. "Não dá orientação médica" e "em emergência, ligue 192"
> precisam estar na descrição, não só dentro do app. Com a categoria Saúde e
> fitness, isso vale ainda mais.

**Novidades desta versão** (primeira submissão)

```
Primeira versão do Mãe Esperta.
```

---

## Capturas de tela

A App Store pede as de 6,9" (iPhone 16 Pro Max / 17 Pro Max) — e aceita usá-las
para os tamanhos menores. O app não declara iPad (`supportsTablet: false`).

**[NOVO 19/11]** As que contam a história, nesta ordem, cada uma com a legenda
que vai em cima do print (as três primeiras são as que aparecem na busca):

| #   | o que mostra                                                      | legenda                                  |
| --- | ----------------------------------------------------------------- | ---------------------------------------- |
| 1   | A aba do Bebê: o céu com o número da semana e a Bolha conversando | Conheça a Bolha, a sua guia na gestação  |
| 2   | A aula do dia: uma pergunta, com a Bolha no veredito              | Uma aula curta sobre a sua semana        |
| 3   | Meditar: a pausa para respirar                                    | Uma pausa para respirar, quando quiser   |
| 4   | Mexer: um movimento leve                                          | Movimentos leves, no seu ritmo           |
| 5   | Ler para o bebê, ou a carta da gratidão                           | Uma história na sua voz, e o que foi bom |
| 6   | A trilha, com a Bolha no nó de hoje e a chama no topo             | Cada dia vira um passo da sua trilha     |
| 7   | As Amigas: a dupla com a chama                                    | Chame as amigas para a sua dupla         |

> antes: 1. a Trilha; 2. a aula do dia; 3. as atividades de hoje; 4. as
> Amigas; 5. o Bebê, a semana a semana (sem legenda). A semana a semana saiu
> da lista porque a ilustração do bebê saiu do app (19/11); o céu com o
> número da semana e a Bolha, na aba do Bebê, é a vitrine nova.

> Legenda é descrição, nunca promessa: "uma pausa para respirar", e não
> "durma melhor". Tire os prints com a conta de demonstração povoada, nunca
> com dados reais. Print com nome de gestante de verdade é vazamento
> publicado — e as Amigas mostram rostos e nomes de outras pessoas.

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

> **[NOVO 19/11]** Só o parágrafo "O QUE O APP É" mudou, para casar com a
> descrição nova. Antes ele dizia: "Um jogo para aprender sobre a gestação, um
> pouco por dia: uma trilha com uma aula curta por dia, de acordo com a semana
> da gestação, sementinhas e conquistas."

```
CONTA DE DEMONSTRAÇÃO
E-mail: (crie uma conta de teste povoada e coloque aqui)
Senha: (idem)
A conta já tem a gestação configurada, alguns dias de trilha, amigas e uma
dupla, para que todas as telas possam ser abertas.

O QUE O APP É (diretriz 1.4.1)
Um app de bem-estar para a gestação, guiado por uma personagem (a Bolha): uma
aula curta por dia, de acordo com a semana da gestação, pausas para respirar
e meditar, movimentos leves, histórias para ler para o bebê e uma coisa boa
guardada por dia, numa trilha com sementinhas e conquistas. O app NÃO dá
orientação médica: não faz diagnóstico, não indica tratamento, exame, remédio
ou dieta, não promete efeito de saúde, e diz isso no app (Perfil e Bebê), nos
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

## Quando a assinatura ligar (o plano completo, 20/11/2026)

O app já tem a venda pronta: a tela do plano completo (anual, mensal e
vitalício, pela Apple), os portões nas atividades pagas e a compra pelo
StoreKit, tudo atrás da chave `ASSINATURA_NO_APP` (desligada). Enquanto ela
estiver desligada, valem os textos acima ("sem compras dentro do app"). No dia
de ligar, nesta ordem:

1. **No App Store Connect** (Negócios): aceitar o **Contrato de Apps Pagos** e
   preencher os dados bancários e fiscais.
2. **Os produtos** (Monetização):
   - grupo de assinaturas **"Plano Mãe Esperta"**, com
     `br.com.obstetrica.app.plano.anual` (1 ano, R$ 99,90) e
     `br.com.obstetrica.app.plano.mensal` (1 mês, R$ 34,90); o anual no nível
     mais alto do grupo;
   - não consumível `br.com.obstetrica.app.plano.vitalicio` (R$ 249,90);
   - em cada um, o nome e a descrição em português e uma captura da tela de
     venda para a revisão;
   - se quiser, a oferta introdutória do anual (Teste gratuito, 1 semana): a
     tela mostra sozinha, e só para quem tem direito.
3. **No código**: `ASSINATURA_NO_APP = true` em `mobile/src/config.ts`,
   `VERSAO_DOS_TERMOS` nova (a catraca cobra), `bun mobile/scripts/gerar-juridico.ts`
   e um build novo. Os Termos ganham sozinhos a seção "O plano completo", e a
   Privacidade, a compra pela Apple.
4. **Os produtos vão JUNTO com esse build** na primeira revisão.
5. **Os textos da loja**:
   - Preço: "Grátis, com compras dentro do app".
   - Na descrição, antes de "IMPORTANTE":

```
GRÁTIS PARA COMEÇAR
A semana do bebê, a Bolha, a aula do dia, a trilha, a gratidão e as amigas.

O PLANO COMPLETO
Libera as pausas para respirar e meditar, os sons da noite, o Mexer, as leituras para o bebê e o Para vocês dois. Anual, mensal ou vitalício, pela Apple. As assinaturas se renovam sozinhas até você cancelar, nos Ajustes do iPhone, até 24 horas antes da renovação.

Termos de uso: https://clovisbacha.github.io/doutorclovis/termos.html
Privacidade: https://clovisbacha.github.io/doutorclovis/privacidade.html
```

- Nas notas para a revisão, trocar o parágrafo COMPRAS por:

```
COMPRAS
O plano completo é vendido pela Apple: br.com.obstetrica.app.plano.anual e br.com.obstetrica.app.plano.mensal (assinaturas do grupo "Plano Mãe Esperta") e br.com.obstetrica.app.plano.vitalicio (compra única). A tela de venda aparece no fim do cadastro e ao tocar em Respirar, Sons, Mexer, Ler para o bebê ou "Para vocês dois"; também pelo Perfil, em "Plano completo". "Restaurar compras" fica na própria tela. As sementinhas continuam sendo pontos do jogo, sem valor em dinheiro.
```

- O questionário de privacidade não muda: a compra é processada pela
  Apple, e o app guarda no aparelho só a marca de que o plano está ativo.

**Para decidir antes de ligar** (o diário, "20/11 (noite)", tem o porquê):
quem já usa o app perde respirar, sons e Mexer no dia em que a chave ligar
(vale um período de cortesia); sem o plano, ela faz 2 dos 5 cuidados do dia
(a aula e a gratidão) e não fecha o dia; o lembrete "Vamos respirar?" cai no
convite para quem não assina; e o plano segue a conta da Apple, não a do app,
até existir a validação da compra no servidor.

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
