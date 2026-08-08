# Plano do In-App Purchase — a paciente assinando dentro do app

> **A decisão que motiva este documento:** a paciente só usa o app nativo
> (iOS/Android) e **só consegue assinar por dentro dele**. O médico usa o app,
> mas **assina no site**. Isso torna o IAP obrigatório e bloqueante: sem ele,
> nenhuma paciente consegue virar Premium.

## O estado de hoje, sem enfeite

|                            |                                                                               |
| -------------------------- | ----------------------------------------------------------------------------- |
| Capacitor instalado        | **Não** — nem `ios/`, nem `android/`, nem `@capacitor/*` no `package.json`    |
| O que existe               | `capacitor.config.ts`, `native/shell/index.html`, a ponte `src/lib/nativo.ts` |
| Portas de pagamento no app | **Todas fechadas**, com o motivo em português                                 |
| Chaves do Stripe           | vazias                                                                        |

**A divisão mora num arquivo só: `src/lib/canal-de-venda.ts`.** Ele diz que
`premium_paciente` e `sementinhas` se vendem no canal "app", `plano_medico` no
canal "site", e `consulta` em qualquer um (serviço do mundo real, isento). As
seis telas leem de lá — a regra e o texto que a paciente ou o médico lê.

A regra vale **também no servidor**, e é aí que ela fica à prova de burla: um
checkout do Stripe _é_ o canal "site" por definição, então
`createSubscriptionCheckout` e `createSementinhasCheckout` recusam os produtos
de canal "app" sem depender de nenhum campo que o cliente informe.

Enquanto `IAP_ATIVO` for `false`, a compra da paciente aparece como
indisponível, com o motivo em português. Ligar o IAP é mudar **essa constante**
— nenhuma tela precisa ser tocada.

Consequência de hoje: **a paciente não tem como assinar**, e isso é esperado.
O IAP não é melhoria; é o que destrava a receita dela.

---

## O que precisa existir

### 1. Produtos nas lojas

Dois produtos assinatura e quatro consumíveis. Os ids devem ser iguais nas duas
lojas, para o servidor não precisar de duas tabelas.

| id sugerido         | tipo                      | preço         |
| ------------------- | ------------------------- | ------------- |
| `premium.mensal`    | assinatura auto-renovável | R$ 19,90/mês  |
| `premium.anual`     | assinatura auto-renovável | R$ 109,90/ano |
| `sementinhas.1000`  | consumível                | R$ 39,90      |
| `sementinhas.2000`  | consumível                | R$ 69,90      |
| `sementinhas.5000`  | consumível                | R$ 139,90     |
| `sementinhas.10000` | consumível                | R$ 249,00     |

**Cuidado com o preço:** na App Store o valor sai de uma **faixa**, não é digitado.
Os valores acima precisam existir como faixa disponível no Brasil — confira
antes de prometer o número na tela. (A oferta de boas-vindas de R$ 89,90 foi
APOSENTADA: o anual passou a R$ 109,90 cheios, e não há mais promoção de
primeiro ano a cadastrar. Ver o cabeçalho de `src/lib/promo.ts`.) Se a faixa
mais próxima do anual não for R$ 109,90, o preço muda e
`promo.ts` tem de acompanhar (o preço é a constante lá justamente para isso).

### 2. A promoção, no molde da loja — **decidido: introdutória**

O Clóvis escolheu tirar o contador, e com isso a oferta virou exatamente o que
a loja oferece de fábrica:

**Oferta introdutória** — automática para quem nunca assinou, sem prazo por
pessoa. Não exige chave de assinatura, nem JWS, nem uma nova superfície de erro
em cima de dinheiro. É o que o app já implementa hoje no lado web: o servidor
confere se existe assinatura anterior em `subscriptions` e libera o desconto se
não existir — a mesma regra que a loja aplica sozinha.

A **oferta promocional** (token assinado pelo servidor, elegibilidade por
pessoa, com prazo) fica disponível se um dia a janela de horas voltar. Não é
o caso agora, e o contador e a coluna `promo_started_at` foram removidos em
vez de ficarem no código sem uso.

### 3. Validação de recibo no servidor

É a parte inegociável, e é o espelho do que o webhook do Stripe já faz hoje:
**nunca acreditar no cliente**.

- **Apple:** App Store Server API + notificações V2 (`SUBSCRIBED`,
  `DID_RENEW`, `EXPIRED`, `REFUND`).
- **Google:** Play Developer API (`purchases.subscriptions.get`) + Real-time
  Developer Notifications via Pub/Sub.

O fluxo já existe e não muda: o servidor confere na fonte, escreve em
`subscriptions` e o flag derivado `patient_profiles.quiz_premium` acompanha —
igual a `src/routes/api/stripe-webhook.ts`.

**Sementinhas têm uma exigência extra:** saldo é acumulativo, então creditar
duas vezes credita duas vezes. A proteção já está pronta: o `UNIQUE (user_id,
dedupe_key)` do `sementinhas_ledger`. Basta usar o **transaction id da loja**
como `dedupeKey`, exatamente como hoje se usa o id da sessão do Stripe.

### 4. Restaurar compras

Obrigatório na revisão da Apple. Trocar de celular tem de devolver o Premium
sem pagar de novo. Como o vínculo é pela conta Supabase e não pelo aparelho,
isto é uma tela chamando a revalidação — não um sistema novo.

### 5. Excluir a conta

Continua pendente desde julho e **reprova sozinho** (5.1.1(v)). Não é IAP, mas
está no mesmo caminho crítico.

---

## Ordem sugerida

1. Instalar o Capacitor e gerar `ios/` e `android/` — hoje não existem.
2. Cadastrar os seis produtos nas duas lojas.
3. Validação de recibo no servidor, com as notificações.
4. Virar `IAP_ATIVO` para `true` em `canal-de-venda.ts` e ligar a compra da
   loja nas telas da paciente.
5. Restaurar compras + excluir conta.
6. Só então a oferta introdutória.

## O que fica decidido, e o que não

**Decidido e no código:**

- A paciente só assina no app; o médico só no site. As seis portas refletem
  isso.
- Consulta particular é serviço do mundo real e **continua fora do IAP**, em
  PIX/Mercado Pago, mesmo dentro do app. É a exceção que economiza comissão.
- O Stripe continua vivo para os planos do médico.

**Não decidido, e precisa de você:**

- Qual faixa de preço usar no Brasil para o anual (R$ 109,90) e o mensal.
- Introdutória ou promocional — e, se for introdutória, o contador sai.
- Conta de desenvolvedor Apple (US$ 99/ano) e Google (US$ 25 uma vez).

**O que eu não verifiquei:** nada disto foi testado contra loja real, porque
não há conta de desenvolvedor nem macOS neste ambiente. As regras de comissão
e de levar o usuário para pagar fora do app mudaram várias vezes nos últimos
dois anos — confira o texto vigente na submissão, não este documento.
