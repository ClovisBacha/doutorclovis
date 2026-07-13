#!/usr/bin/env node
/**
 * Cria (ou reaproveita) os Products e Prices do Stripe usados pelo Obstétrica
 * e imprime as variáveis de ambiente prontas para colar na Vercel.
 *
 * Uso:
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/stripe-setup.mjs
 *   (use sk_test_... para o modo teste; sk_live_... para produção)
 *
 * Idempotente: cada Price tem um `lookup_key` fixo. Se já existir, é
 * reaproveitado — pode rodar quantas vezes quiser sem criar duplicado.
 * Sem dependências: usa só o fetch nativo do Node 18+.
 */

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY || !/^sk_(test|live)_/.test(KEY)) {
  console.error(
    "❌ Defina STRIPE_SECRET_KEY (sk_test_... ou sk_live_...).\n" +
      "   Ex.: STRIPE_SECRET_KEY=sk_test_123 node scripts/stripe-setup.mjs",
  );
  process.exit(1);
}
const MODE = KEY.startsWith("sk_live_") ? "PRODUÇÃO (live)" : "TESTE (test)";
const API = "https://api.stripe.com/v1";

// Valores em CENTAVOS (BRL). Anual do médico = 25% off sobre 12 meses.
const PLANS = [
  {
    key: "doctor_starter",
    name: "Médico Starter",
    prices: [
      {
        lk: "doctor_starter_monthly",
        env: "STRIPE_PRICE_DOCTOR_STARTER_MONTHLY",
        amount: 19700,
        interval: "month",
      },
      {
        lk: "doctor_starter_annual",
        env: "STRIPE_PRICE_DOCTOR_STARTER_ANNUAL",
        amount: 177300,
        interval: "year",
      },
    ],
  },
  {
    key: "doctor_pro",
    name: "Médico Pro",
    prices: [
      {
        lk: "doctor_pro_monthly",
        env: "STRIPE_PRICE_DOCTOR_PRO_MONTHLY",
        amount: 34700,
        interval: "month",
      },
      {
        lk: "doctor_pro_annual",
        env: "STRIPE_PRICE_DOCTOR_PRO_ANNUAL",
        amount: 312300,
        interval: "year",
      },
    ],
  },
  {
    key: "doctor_elite",
    name: "Médico Elite",
    prices: [
      {
        lk: "doctor_elite_monthly",
        env: "STRIPE_PRICE_DOCTOR_ELITE_MONTHLY",
        amount: 69700,
        interval: "month",
      },
      {
        lk: "doctor_elite_annual",
        env: "STRIPE_PRICE_DOCTOR_ELITE_ANNUAL",
        amount: 627300,
        interval: "year",
      },
    ],
  },
  {
    key: "doctor_black",
    name: "Médico Black",
    prices: [
      {
        lk: "doctor_black_monthly",
        env: "STRIPE_PRICE_DOCTOR_BLACK_MONTHLY",
        amount: 199900,
        interval: "month",
      },
      {
        lk: "doctor_black_annual",
        env: "STRIPE_PRICE_DOCTOR_BLACK_ANNUAL",
        amount: 1799100,
        interval: "year",
      },
    ],
  },
  {
    key: "quiz_premium",
    name: "Quiz Premium (paciente)",
    prices: [
      // 19,90/mês; anual = 9,90/mês → 118,80/ano
      {
        lk: "quiz_premium_monthly",
        env: "STRIPE_PRICE_QUIZ_MONTHLY",
        amount: 1990,
        interval: "month",
      },
      {
        lk: "quiz_premium_annual",
        env: "STRIPE_PRICE_QUIZ_ANNUAL",
        amount: 11880,
        interval: "year",
      },
    ],
  },
];

function form(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripe(path, method = "GET", body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" && body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `${path} ${res.status}`);
  return json;
}

async function findPriceByLookup(lk) {
  const q = `lookup_keys[]=${encodeURIComponent(lk)}&expand[]=data.product&limit=1`;
  const r = await stripe(`/prices?${q}`);
  return r.data?.[0] ?? null;
}

async function run() {
  console.log(`\n🔧 Stripe setup — modo ${MODE}\n`);
  const out = [];
  const productCache = {};

  for (const plan of PLANS) {
    for (const p of plan.prices) {
      const existing = await findPriceByLookup(p.lk);
      if (existing) {
        out.push([p.env, existing.id]);
        // reaproveita o produto do preço já existente para os irmãos do mesmo plano
        const prodId =
          typeof existing.product === "string" ? existing.product : existing.product?.id;
        if (prodId) productCache[plan.key] = prodId;
        console.log(`✓ ${p.env}  (já existia)  ${existing.id}`);
        continue;
      }
      // garante o produto (um por plano)
      if (!productCache[plan.key]) {
        const prod = await stripe("/products", "POST", {
          name: plan.name,
          "metadata[app_key]": plan.key,
        });
        productCache[plan.key] = prod.id;
        console.log(`＋ Produto criado: ${plan.name}  ${prod.id}`);
      }
      const price = await stripe("/prices", "POST", {
        currency: "brl",
        unit_amount: p.amount,
        "recurring[interval]": p.interval,
        product: productCache[plan.key],
        lookup_key: p.lk,
        nickname: `${plan.name} ${p.interval === "year" ? "anual" : "mensal"}`,
      });
      out.push([p.env, price.id]);
      console.log(`＋ ${p.env}  criado  ${price.id}`);
    }
  }

  console.log(`\n────────────────────────────────────────────────────────`);
  console.log(`📋 Cole estas variáveis na Vercel (Environment Variables):\n`);
  for (const [env, id] of out) console.log(`${env}=${id}`);
  console.log(`\n✅ Pronto. ${out.length} preços configurados no modo ${MODE}.`);
  console.log(`   (Rodar de novo não duplica — reaproveita pelo lookup_key.)\n`);
}

run().catch((e) => {
  console.error(`\n❌ Erro: ${e.message}\n`);
  process.exit(1);
});
