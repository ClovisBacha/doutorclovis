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
> só as unidades que caem dentro dela — é o que faz 2.500 mensagens custarem
> R$ 339,40. No volume, TODAS as unidades pegariam o preço da última faixa, e o
> mesmo pedido sairia R$ 225,00. São **34% da sua receita** nessa única escolha,
> e o erro é invisível: o Stripe aceita as duas configurações sem reclamar.

### As dez camadas

| Camada | De    | Até   | Por unidade | Taxa fixa da camada |
| ------ | ----- | ----- | ----------- | ------------------- |
| 1      | 1     | 150   | R$ 0,00     | **R$ 29,90**        |
| 2      | 151   | 300   | **R$ 0,19** | R$ 0,00             |
| 3      | 301   | 500   | **R$ 0,18** | R$ 0,00             |
| 4      | 501   | 750   | **R$ 0,17** | R$ 0,00             |
| 5      | 751   | 1.000 | **R$ 0,15** | R$ 0,00             |
| 6      | 1.001 | 1.250 | **R$ 0,14** | R$ 0,00             |
| 7      | 1.251 | 1.500 | **R$ 0,13** | R$ 0,00             |
| 8      | 1.501 | 1.750 | **R$ 0,11** | R$ 0,00             |
| 9      | 1.751 | 2.000 | **R$ 0,10** | R$ 0,00             |
| 10     | 2.001 | ∞     | **R$ 0,09** | R$ 0,00             |

A camada 1 é a entrada: quem compra 150 mensagens paga R$ 29,90 e nada por
unidade. A partir da 151 cada mensagem entra pelo preço da sua faixa.

> **Por que dez camadas, e não quatro.** A escada anterior ia de R$ 0,15 direto,
> e isso punha quase todo o desconto na mensagem 151: a entrada sai a R$ 0,1993
> por mensagem, então comprar UMA a mais que o pacote mínimo derrubava o preço
> marginal em 25% de uma vez. Quem comprava 151 já tinha levado o desconto, e o
> resto da escada não motivava mais nada. Agora a segunda camada é R$ 0,19 —
> encosta na entrada — e o desconto é conquistado camada a camada, que é onde
> ele foi pedido: nas mensagens de cima.

> A última camada fica em ∞ porque o Stripe exige. **O teto real é nosso**: o
> checkout manda `adjustable_quantity.maximum = 2500` e o servidor recusa acima
> disso (`fora_da_escada`) — acima de 2.500 é contrato de Clínica.

### Confira antes de salvar

Estes são os números que o site mostra. Se algum não bater, uma camada está
errada:

| Mensagens | Fatura        | Por mensagem | Desconto |
| --------- | ------------- | ------------ | -------- |
| 150       | **R$ 29,90**  | R$ 0,1993    | —        |
| 300       | R$ 58,40      | R$ 0,1947    | 2%       |
| 500       | R$ 94,40      | R$ 0,1888    | 5%       |
| 750       | R$ 136,90     | R$ 0,1825    | 8%       |
| 1.000     | **R$ 174,40** | R$ 0,1744    | 12%      |
| 1.250     | R$ 209,40     | R$ 0,1675    | 15%      |
| 1.500     | R$ 241,90     | R$ 0,1613    | 19%      |
| 1.750     | R$ 269,40     | R$ 0,1539    | 22%      |
| 2.000     | **R$ 294,40** | R$ 0,1472    | 26%      |
| 2.500     | **R$ 339,40** | R$ 0,1358    | 31%      |

> **O "R$ 0,09" é o preço MARGINAL da última camada, não a média.** Em preço
> graduado o efetivo nunca alcança o marginal do fim: quem compra 2.500 paga
> R$ 0,1358 por mensagem. É a coluna "Por mensagem" que pode ir para a tela —
> nunca a tabela de camadas.

> **Onde foi parar o R$ 295,40.** O topo antigo (quatro camadas) valia 2.500
> mensagens por R$ 295,40. Com dez camadas, o mesmo bolso compra **2.000
> mensagens por R$ 294,40** — e as 500 seguintes passaram a custar R$ 0,09 cada,
> que é exatamente onde o desconto foi pedido.

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
