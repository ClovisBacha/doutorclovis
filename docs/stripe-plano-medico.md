# Stripe — o plano do médico, passo a passo

O que configurar no painel do Stripe para a escada de mensagens funcionar.
**Um Price só.** O plano deixou de ser um nome e passou a ser um número: a
quantidade comprada É o plano.

A conta do nosso lado vive em `src/lib/planos-medico.ts` (`precoDe`). Os números
abaixo são os mesmos, e há teste travando os dois juntos
(`src/lib/cadeia-do-stripe.test.ts`) — mudar as faixas aqui sem mudar lá faz a
tela prometer um preço e a fatura cobrar outro.

---

## 1. Criar o Produto

**Produtos → Adicionar produto**

| Campo     | Valor                                                           |
| --------- | --------------------------------------------------------------- |
| Nome      | `Obstetrica — Segundo Cérebro`                                  |
| Descrição | `Mensagens de IA por mês, com a sua voz. Pacientes ilimitadas.` |

## 2. Criar o Preço — graduado, mensal, em BRL

Ainda na tela do produto:

| Campo           | Valor                                        |
| --------------- | -------------------------------------------- |
| Modelo de preço | **Preço em camadas → Progressivo**           |
| Camadas por     | Unidade (a unidade é **1 mensagem**)         |
| Moeda           | **BRL**                                      |
| Cobrança        | **Recorrente · mensal**                      |
| Tipo de uso     | **Licenciado** (quantidade fixa, não medido) |

> ⚠️ **Progressivo (graduated)**, não "Volume". No progressivo, cada faixa cobra
> só as unidades que caem dentro dela — é o que faz 11.100 mensagens custarem
> R$ 999,00. No volume, TODAS as unidades pegariam o preço da última camada, e o
> mesmo pedido sairia R$ 888,00. São **11% da sua receita no topo** nessa única
> escolha — e muito mais nos degraus de baixo, onde 1.350 mensagens cairiam de
> R$ 187,11 para R$ 108,00 — 42%. O erro é invisível: o Stripe aceita as duas
> configurações sem reclamar.

### As dez camadas

| Camada | De    | Até   | Por unidade   | Taxa fixa da camada |
| ------ | ----- | ----- | ------------- | ------------------- |
| 1      | 1     | 150   | R$ 0,0000     | **R$ 29,90**        |
| 2      | 151   | 250   | **R$ 0,1690** | R$ 0,00             |
| 3      | 251   | 350   | **R$ 0,1445** | R$ 0,00             |
| 4      | 351   | 550   | **R$ 0,1418** | R$ 0,00             |
| 5      | 551   | 850   | **R$ 0,1285** | R$ 0,00             |
| 6      | 851   | 1.350 | **R$ 0,1179** | R$ 0,00             |
| 7      | 1.351 | 2.100 | **R$ 0,1046** | R$ 0,00             |
| 8      | 2.101 | 3.200 | **R$ 0,0914** | R$ 0,00             |
| 9      | 3.201 | 5.000 | **R$ 0,0805** | R$ 0,00             |
| 10     | 5.001 | ∞     | **R$ 0,0800** | R$ 0,00             |

A camada 1 é a entrada: quem compra 150 mensagens paga R$ 29,90 e nada por
unidade. A partir da 151 cada mensagem entra pelo preço da sua faixa.

> **Os preços por unidade têm QUATRO casas, e isso é obrigatório.** As nove
> faixas por unidade precisam somar exatamente R$ 969,10 em 10.950 mensagens;
> com valores redondos a soma seria sempre múltipla de 50 centavos, e R$ 969,10
> não é. O campo do Stripe é `unit_amount_decimal` — ele aceita decimal por
> unidade justamente para isto. Digite os quatro dígitos.

> **Por que dez camadas.** Os dois números são decisão do dono: a entrada custa
> 20 centavos por mensagem (R$ 29,90 ÷ 150 = 19,93c) e o último plano de
> autoatendimento custa **R$ 999,00 a 9 centavos por mensagem** — o que define
> 11.100 mensagens, porque 999 ÷ 0,09 = 11.100. Tudo entre os dois é
> consequência, e a escada foi resolvida de trás para a frente para que os dois
> batessem exatos.

> A última camada fica em ∞ porque o Stripe exige. **O teto real é nosso**: o
> checkout manda `adjustable_quantity.maximum = 11100` e o servidor recusa acima
> disso (`fora_da_escada`) — acima de 11.100 é contrato de Clínica.

### Confira antes de salvar

Esta tabela é GERADA a partir de `precoDe`, não digitada — e há teste que a
confere linha por linha contra o código. Se algum número não bater no painel do
Stripe, é a camada que está errada, não esta lista.

| Mensagens | Fatura        | Por mensagem | Desconto |
| --------- | ------------- | ------------ | -------- |
| 150       | **R$ 29,90**  | R$ 0,1993    | 0%       |
| 250       | R$ 46,80      | R$ 0,1872    | 6%       |
| 350       | R$ 61,25      | R$ 0,1750    | 12%      |
| 550       | R$ 89,61      | R$ 0,1629    | 18%      |
| 850       | R$ 128,16     | R$ 0,1508    | 24%      |
| 1.350     | **R$ 187,11** | R$ 0,1386    | 30%      |
| 2.100     | R$ 265,56     | R$ 0,1265    | 36%      |
| 3.200     | R$ 366,10     | R$ 0,1144    | 42%      |
| 5.000     | R$ 511,00     | R$ 0,1022    | 48%      |
| 11.100    | **R$ 999,00** | R$ 0,0900    | 54%      |

> **O "9 centavos" do topo é o preço EFETIVO, não o marginal.** Em preço
> graduado o efetivo nunca alcança o marginal do fim: a última camada cobra
> R$ 0,08 por mensagem, e é a mistura com as camadas de cima que faz a média
> fechar em R$ 0,09. Não "corrija" a camada 10 para 0,0900 — isso quebra o
> R$ 999,00.

> **O desconto sobe seis pontos por degrau**, sempre o mesmo passo: 0 · 6 · 12 ·
> 18 · 24 · 30 · 36 · 42 · 48 · 54%. É o que "dividir em dez partes" quer dizer.

## 3. Copiar o ID do Price

Na página do preço, copie o `price_…` e coloque no ambiente da Vercel:

```
STRIPE_PRICE_DOCTOR_MENSAGENS="price_…"
```

Sem essa variável o médico clica em assinar e **nada acontece** — `priceIdFor`
devolve `null` e o servidor responde `plano_indisponivel`. Silencioso do lado
dele.

## 4. Webhook

**Desenvolvedores → Webhooks → Adicionar endpoint**

- URL: `https://www.obstetrica.com.br/api/stripe-webhook`
- Eventos (exatamente estes sete, que é o que o código trata):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `charge.refunded`
  - `charge.dispute.created`

Copie o `whsec_…` para `STRIPE_WEBHOOK_SECRET`.

> É do **item da assinatura** que o webhook lê a quantidade
> (`subscription.items.data[0].quantity`), nunca do metadata. O metadata é
> pista; o item é a fatura. Ler do metadata deixaria qualquer um forjar um POST
> com 20.000 mensagens.

## 5. O SQL, ANTES de vender

`supabase/migrations/20260807180000_mensagens_contratadas.sql` cria
`doctors.ai_messages_per_cycle`. É idempotente.

Sem ela o webhook grava o plano e a quantidade se perde — o médico paga e a
cota dele fica no piso da escada (150), não no que comprou. Não é catastrófico
(erra concedendo de MENOS, que é a direção certa), mas é uma reclamação.

---

## O que NÃO configurar aqui

**O Premium da paciente** (R$ 19,90/mês · R$ 109,90/ano) não passa pelo Stripe:
é compra dentro do app iOS/Android, e a loja exige o pagamento dela. Os Prices
`STRIPE_PRICE_QUIZ_*` existem para o caso de a venda pela web voltar, e hoje o
`canal-de-venda` recusa esse checkout no servidor.

**Nenhum cupom do médico.** Ele não dá mais desconto — dá **Sementinhas**, a
moeda do app, com uma mesada mensal dimensionada pelas mensagens que contratou.
Isso não passa por Stripe nenhum: é escrita em `sementinhas_ledger`, dentro do
produto. Se você encontrar `CUPOM_MEDICO_ID` num cupom antigo do painel do
Stripe, pode arquivar — nada no código o pede mais.

**Nada de plano anual** para o médico: a escada tem um Price mensal só. A página
de vendas deixou de mostrar alternador anual justamente por isso.
