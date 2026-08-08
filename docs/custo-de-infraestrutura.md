# Quanto custa uma paciente, e até onde o Free é grátis

Esta conta nunca tinha sido feita. A plataforma precificava **mensagem de IA** e
tratava todo o resto como se fosse de graça — banco, egresso, funções. A pergunta
do dono foi direta: _"o cara pode ter mil pacientes; quanto cada paciente custa
para a gente?"_

Resposta curta: **R$ 0,024 por paciente ativa por mês.** Menos que UMA mensagem
de IA, que custa R$ 0,027. Um médico no Free com 20 pacientes custa **R$ 0,47 por
mês**.

A conta longa está abaixo, junto com o que a torna frágil.

---

## Os preços de lista

Conferidos em 8 de agosto de 2026, nas páginas de preço dos dois fornecedores.
Câmbio de trabalho: **US$ 1 = R$ 5,40**.

| Supabase Pro — US$ 25/mês | Incluído | Excedente          |
| ------------------------- | -------- | ------------------ |
| Banco (disco)             | 8 GB     | US$ 0,125 /GB/mês  |
| Arquivos (Storage)        | 100 GB   | US$ 0,0213 /GB/mês |
| Egresso                   | 250 GB   | US$ 0,09 /GB       |
| Usuários ativos (MAU)     | 100.000  | US$ 0,00325 /MAU   |

| Vercel Pro — US$ 20/mês | Incluído | Excedente    |
| ----------------------- | -------- | ------------ |
| Transferência           | 1 TB     | US$ 0,15 /GB |
| Invocações              | —        | US$ 0,60 /1M |
| CPU ativa               | —        | US$ 0,128 /h |
| Edge requests           | 10M      | US$ 2 /1M    |

**O piso fixo é US$ 45/mês ≈ R$ 243**, e ele é pago com dez usuários ou com dez
mil. Nenhuma conta abaixo muda isso.

---

## O que uma paciente escreve por mês

Contado a partir das funcionalidades que existem, não estimado no olho:

| Linhas  | Tabela                                                     |
| ------- | ---------------------------------------------------------- |
| 120     | `sementinhas_ledger` — check-in, aula, bem-estar, estrelas |
| 30      | `chat_messages` — pergunta + resposta                      |
| 15      | `ai_usage` — uma por chamada                               |
| 15      | `brain_hits` / `brain_gaps`                                |
| 20      | `course_progress` / `journey_state`                        |
| 10      | `health_logs` — peso, pressão, glicemia                    |
| 10      | `kick_sessions`                                            |
| 8       | `journal_entries`                                          |
| 8       | `patient_achievements` / `cantinho_items`                  |
| 15      | contrações, EPDS, ciclo, vacinas, mamadas…                 |
| **251** | **por mês**                                                |

A ~300 bytes por linha já com índices, isso dá **74 KB por mês**. É nada.

## E as imagens — que são 96% do problema

```
  dados (251 linhas + índices) ····   74 KB/mês
  imagens em base64 NO BANCO ······ 1.700 KB/mês
  ──────────────────────────────────────────────
  total ··························· 1.774 KB/mês  ·  ~21 MB/ano
```

Quatro fotos de álbum (200 KB cada, canvas 800px) e uma imagem e meia de exame
(600 KB, canvas 1600px) por mês. **Vinte e três vezes** o peso de tudo o que a
paciente escreve em texto.

### O erro de arquitetura

`family_album_posts.image_data` e `exam_files.image_data` são **colunas TEXT com
base64 dentro do Postgres**. O Supabase Storage existe no projeto — há um bucket
`medicos` para a foto do perfil do médico — e as imagens das pacientes não passam
por ele.

Três custos empilhados nessa escolha:

1. **Base64 infla 33%.** Um JPEG de 150 KB vira 200 KB de texto.
2. **Banco custa 5,9× o Storage** — US$ 0,125 contra US$ 0,0213 por GB/mês.
3. **Backup e PITR multiplicam o banco**, não o Storage.

Guardar uma paciente por um ano custa **R$ 0,08** hoje e custaria **R$ 0,02** com
as imagens no Storage — 80% a menos. Em valor absoluto é pouco; o que importa é
que 96% do banco é conteúdo que não deveria estar nele, e é o banco que dita o
tamanho da instância.

---

## O egresso é o que realmente cobra

Guardar é barato; **servir de volta** é o que aparece na fatura. Cada abertura do
álbum puxa as fotos do banco, pela API, para o navegador dela.

```
  álbum (15 aberturas × 4 fotos) ··· 11,7 MB/mês
  exames abertos ···················  1,2 MB/mês
  telas e JSON ·····················  2,9 MB/mês
  ─────────────────────────────────────────────
  15,8 MB por paciente por mês
```

| Pacientes | Egresso/mês | Custo/mês |
| --------- | ----------- | --------- |
| 1.000     | 15 GB       | R$ 0      |
| 5.000     | 77 GB       | R$ 0      |
| 20.000    | 309 GB      | R$ 29     |
| 100.000   | 1.545 GB    | R$ 1.051  |

Até cinco mil pacientes o egresso cabe no que já está pago.

---

## O custo de uma paciente ativa

| Item                         | Por mês      |
| ---------------------------- | ------------ |
| Banco (o que ela acrescenta) | R$ 0,0011    |
| Egresso (Supabase + Vercel)  | R$ 0,0200    |
| Invocações de função         | R$ 0,0024    |
| **Total**                    | **R$ 0,024** |

Para comparar: **uma única mensagem de IA custa R$ 0,027.** A paciente inteira,
por um mês, custa menos que uma pergunta ao Segundo Cérebro.

---

## Até onde o Free é grátis

As pacientes de um médico no Free usam o app inteiro — diário, contrações,
exames, álbum, pré-consulta. Só a IA não responde com a voz dele. Ou seja:
**o Free custa a mesma infraestrutura de um plano pago, menos o modelo.**

| Pacientes do médico Free | Custo/mês | Custo/ano |
| ------------------------ | --------- | --------- |
| 5                        | R$ 0,12   | R$ 1,42   |
| 20                       | R$ 0,47   | R$ 5,66   |
| 50                       | R$ 1,18   | R$ 14,16  |
| 100                      | R$ 2,36   | R$ 28,31  |

**Mil médicos no Free, com 20 pacientes cada, custam R$ 470 por mês.** É o preço
de um único assinante no topo da escada — e esses mil médicos são o funil inteiro
de quem pode virar assinante.

A conclusão que a conta permite: **o Free não é o problema de custo.** O que
custa é a IA, e a IA já está fechada atrás do plano. O gargalo do Free é o portão
do chat, não o banco de dados.

---

## O cenário de mil pacientes

O médico no topo da escada: R$ 999,00, 11.100 mensagens, 1.000 pacientes.

| Linha                         | Valor               |
| ----------------------------- | ------------------- |
| Receita                       | R$ 999,00           |
| − Taxa do Stripe (3,99%+0,39) | R$ 40,25            |
| − IA (11.100 × R$ 0,027)      | R$ 299,70           |
| − Infraestrutura (1.000 pac.) | R$ 23,59            |
| **Margem**                    | **R$ 635,46 · 64%** |

No cenário de estresse — mensagens no tamanho máximo e o modelo custando o dobro
— a margem cai para **R$ 335,76 · 34%**.

**A infraestrutura é 2,4% da receita. A IA é 30%.** Precificar por mensagem foi a
escolha certa: é onde o dinheiro realmente vai.

---

## O que esta conta NÃO cobre

Honestidade sobre os limites do modelo, para ninguém tomar decisão grande em cima
dele sem saber onde ele é frágil:

- **Compute é degrau, não linha reta.** O Supabase Pro inclui uma instância
  pequena. Um banco de centenas de GB precisa de instância maior, e o salto é de
  dezenas de dólares de uma vez — não está precificado aqui. É o primeiro número
  a levantar quando passarmos de ~20 mil pacientes.
- **Backup e PITR** multiplicam o tamanho do banco e não entraram na conta. Com
  96% do banco sendo imagem, o multiplicador incide justamente sobre o que não
  deveria estar lá.
- **As médias são estimativas do produto**, não medição de produção. Quinze
  aberturas de álbum por mês é palpite educado; quatro fotos por mês também. O
  que NÃO é palpite são os preços de lista e o tamanho das imagens — esses vêm
  das páginas dos fornecedores e do código.
- **Não há WhatsApp aqui.** A conta Meta Business é do próprio médico.

## O que fazer com isso

1. **Mover `image_data` para o Supabase Storage.** É a única mudança com efeito
   composto: corta 80% do custo de guardar, tira 96% do peso do banco, adia o
   salto de instância e faz o CDN servir as fotos em vez do Postgres.
2. **Não temer o Free.** R$ 0,47 por médico com 20 pacientes. O que precisa de
   decisão é o portão do chat, que é onde a IA é chamada mesmo sem plano.
3. **Voltar aqui quando passar de 20 mil pacientes**, para precificar o degrau de
   compute — que a esta altura é o maior número desconhecido da conta.
