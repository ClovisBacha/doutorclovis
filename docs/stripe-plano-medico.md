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
> R$ 295,40. No volume, TODAS as unidades pegariam o preço da última faixa, e o
> mesmo pedido sairia R$ 225,00. A diferença é de 24% na sua receita.

### As quatro camadas

| Camada | De    | Até   | Por unidade | Taxa fixa da camada |
| ------ | ----- | ----- | ----------- | ------------------- |
| 1      | 1     | 150   | R$ 0,00     | **R$ 29,90**        |
| 2      | 151   | 600   | **R$ 0,15** | R$ 0,00             |
| 3      | 601   | 1.500 | **R$ 0,12** | R$ 0,00             |
| 4      | 1.501 | ∞     | **R$ 0,09** | R$ 0,00             |

A camada 1 é a entrada: quem compra 150 mensagens paga R$ 29,90 e nada por
unidade. A partir da 151 cada mensagem entra pelo preço da sua faixa.

> A última camada fica em ∞ porque o Stripe exige. **O teto real é nosso**: o
> checkout manda `adjustable_quantity.maximum = 2500` e o servidor recusa acima
> disso (`fora_da_escada`) — acima de 2.500 é contrato de Clínica.

### Confira antes de salvar

Estes são os quatro números que o site mostra. Se algum não bater, a camada
está errada:

| Mensagens | Fatura        | Por mensagem | Conta                 |
| --------- | ------------- | ------------ | --------------------- |
| 150       | **R$ 29,90**  | R$ 0,199     | taxa fixa             |
| 600       | **R$ 97,40**  | R$ 0,162     | 29,90 + 450 × 0,15    |
| 1.500     | **R$ 205,40** | R$ 0,137     | 97,40 + 900 × 0,12    |
| 2.500     | **R$ 295,40** | R$ 0,118     | 205,40 + 1.000 × 0,09 |

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

**O cupom de 20% do médico** vale para a assinatura da paciente — que é IAP.
Cupom do Stripe **não funciona** dentro da App Store nem do Google Play; lá o
instrumento é Offer Code (Apple) / código promocional (Google), com cota
trimestral e regras próprias. O `CUPOM_MEDICO_ID` no Stripe só entra se a venda
web for reativada.

**Nada de plano anual** para o médico: a escada tem um Price mensal só. A página
de vendas deixou de mostrar alternador anual justamente por isso.
