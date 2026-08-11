#!/usr/bin/env node
/**
 * Cria (ou reaproveita) os Products e Prices do Stripe e imprime as variáveis
 * de ambiente prontas para colar na Vercel.
 *
 * Uso:
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/stripe-setup.mjs
 *   (sk_test_… para o modo teste; sk_live_… para produção)
 *
 * Idempotente: cada Price tem um `lookup_key` fixo. Se já existir, é
 * reaproveitado — pode rodar quantas vezes quiser sem criar duplicado.
 * Sem dependências: usa só o `fetch` nativo do Node 18+.
 *
 * ─── O QUE ESTE ARQUIVO ERA, E POR QUE ESTAVA QUEBRADO (ago/2026) ────────────
 *
 * Ele criava OITO preços dos planos nomeados — Starter, Pro, Elite e Black,
 * mensal e anual, com valor fixo — e imprimia oito variáveis
 * `STRIPE_PRICE_DOCTOR_*`.
 *
 * Nenhuma delas é lida pelo app. A escada de planos passou a ter um eixo só
 * (mensagens de IA), e `priceIdFor` em `src/lib/stripe.server.ts` conhece
 * exatamente UMA variável para o médico: `STRIPE_PRICE_DOCTOR_MENSAGENS`.
 *
 * Então quem rodasse este script para "configurar o Stripe" terminava com oito
 * preços criados, oito variáveis coladas na Vercel, e o checkout do médico
 * continuando a falhar com `preco_indisponivel` — porque a única variável que
 * importa seguia vazia. O script não errava: ele resolvia um problema que não
 * existe mais.
 *
 * ─── O PREÇO DO MÉDICO NÃO PODE SER DIGITADO À MÃO ───────────────────────────
 *
 * São DEZ faixas graduadas, e três delas têm centavo fracionário (16,9c /
 * 14,45c / 14,18c…). O painel do Stripe aceita, mas basta um dígito trocado
 * para a tela prometer um preço e a fatura cobrar outro — e ninguém descobre
 * até o primeiro extrato.
 *
 * Por isso as faixas saem de `src/lib/planos-medico.ts`, o MESMO arquivo que
 * calcula o preço mostrado na tela. Uma fonte só para os dois lados.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

/**
 * Lê as faixas de `planos-medico.ts` sem importar o módulo.
 *
 * Import direto não serve: o arquivo é TypeScript e este script roda no Node
 * puro (sem build), justamente para poder ser executado por quem só tem a
 * chave do Stripe na mão. Ler o texto e extrair a tabela mantém a fonte única
 * sem arrastar uma etapa de compilação para dentro de uma tarefa de operação.
 */
function lerFaixas() {
  const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
  const src = readFileSync(join(raiz, "src", "lib", "planos-medico.ts"), "utf8");
  const bloco = src.slice(src.indexOf("export const FAIXAS = ["));
  const corpo = bloco.slice(0, bloco.indexOf("] as const;"));
  const faixas = [
    ...corpo.matchAll(/\{\s*ate:\s*([\d_]+),\s*(fixo|centavos):\s*([\d_.]+)\s*\}/g),
  ].map((m) => ({
    ate: Number(m[1].replace(/_/g, "")),
    tipo: m[2],
    valor: Number(m[3].replace(/_/g, "")),
  }));
  if (faixas.length < 5) {
    throw new Error(
      "Não consegui ler FAIXAS de src/lib/planos-medico.ts — o formato mudou? " +
        `Achei ${faixas.length} faixa(s).`,
    );
  }
  const entrada = Number(/ENTRADA_MENSAGENS = ([\d_]+)/.exec(src)?.[1]?.replace(/_/g, ""));
  const teto = Number(/TETO_AUTOATENDIMENTO = ([\d_]+)/.exec(src)?.[1]?.replace(/_/g, ""));
  if (!entrada || !teto) throw new Error("Não achei ENTRADA_MENSAGENS/TETO_AUTOATENDIMENTO.");
  return { faixas, entrada, teto };
}

/**
 * Monta os `tiers` do Stripe a partir das faixas.
 *
 * Duas traduções que precisam estar certas:
 *
 * · A primeira faixa é `flat_amount` (R$ 29,90 fechados até 150), e não preço
 *   por unidade. É o tíquete mínimo — ninguém assina por R$ 5.
 *
 * · As outras usam `unit_amount_decimal`, em centavos COM casa decimal. Sem a
 *   casa a conta não fecha: as nove faixas por unidade precisam somar exato, e
 *   com marginais inteiros a soma vira sempre múltipla de 50 centavos.
 *
 * O último tier tem `up_to: "inf"` porque o Stripe exige. Quem impede a venda
 * acima do teto do autoatendimento é o `adjustable_quantity` do checkout, em
 * `billing.functions.ts` — acima de lá é contrato de Clínica, com preço olhado
 * a mão.
 */
function montarTiers({ faixas, teto }) {
  return faixas.map((f, i) => {
    const ultimo = i === faixas.length - 1;
    const up_to = ultimo ? "inf" : f.ate;
    if (f.tipo === "fixo") return { up_to, flat_amount: f.valor, unit_amount: 0 };
    return { up_to, unit_amount_decimal: f.valor.toFixed(2) };
  });
}

const PRECOS_SIMPLES = [
  {
    produto: "quiz_premium",
    nome: "Quiz Premium (paciente)",
    lk: "quiz_premium_monthly",
    env: "STRIPE_PRICE_QUIZ_MONTHLY",
    amount: 1990,
    interval: "month",
  },
  {
    produto: "quiz_premium",
    nome: "Quiz Premium (paciente)",
    lk: "quiz_premium_annual",
    env: "STRIPE_PRICE_QUIZ_ANNUAL",
    amount: 11880,
    interval: "year",
  },
];

function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const nome = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) =>
        typeof item === "object"
          ? form(item, `${nome}[${i}]`, out)
          : out.push(`${encodeURIComponent(`${nome}[${i}]`)}=${encodeURIComponent(String(item))}`),
      );
    } else if (typeof v === "object") {
      form(v, nome, out);
    } else {
      out.push(`${encodeURIComponent(nome)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out.join("&");
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

async function acharPorLookup(lk) {
  const r = await stripe(`/prices?lookup_keys[]=${encodeURIComponent(lk)}&limit=1`);
  return r.data?.[0] ?? null;
}

/**
 * CONFERE se o preço que está no Stripe cobra o mesmo que a tela promete.
 *
 * Existe porque criar não é o problema mais provável — o preço da conta já
 * podia ter sido montado à mão no painel, com dez faixas digitadas uma a uma,
 * três delas com centavo fracionário. Um dígito trocado ali não quebra nada:
 * a tela mostra R$ 295,40 e a fatura chega com outro valor, e quem descobre é
 * o médico, no extrato.
 */
async function conferirFaixas(preco, faixas) {
  const p = preco.tiers ? preco : await stripe(`/prices/${preco.id}?expand[]=tiers`);
  const tiers = p.tiers ?? [];
  if (p.billing_scheme !== "tiered" || p.tiers_mode !== "graduated") {
    console.log(
      `   ⚠️  Este preço NÃO é graduado (billing_scheme=${p.billing_scheme}, ` +
        `tiers_mode=${p.tiers_mode ?? "—"}). O checkout do médico precisa de ` +
        `tiered/graduated.`,
    );
    return;
  }
  if (tiers.length !== faixas.length) {
    console.log(`   ⚠️  ${tiers.length} faixas no Stripe contra ${faixas.length} no código.`);
  }
  let divergencias = 0;
  faixas.forEach((f, i) => {
    const t = tiers[i];
    if (!t) return;
    const ultimo = i === faixas.length - 1;
    const ate = t.up_to == null ? "inf" : t.up_to;
    const esperadoAte = ultimo ? "inf" : f.ate;
    const valorStripe =
      f.tipo === "fixo" ? Number(t.flat_amount ?? 0) : Number(t.unit_amount_decimal ?? -1);
    const igualAte = String(ate) === String(esperadoAte);
    const igualValor = Math.abs(valorStripe - f.valor) < 0.005;
    if (!igualAte || !igualValor) {
      divergencias++;
      console.log(
        `   ⚠️  faixa ${i + 1}: Stripe até ${ate} = ${valorStripe} · ` +
          `código até ${esperadoAte} = ${f.valor}`,
      );
    }
  });
  if (divergencias === 0 && tiers.length === faixas.length) {
    console.log(`   ✓ as ${faixas.length} faixas batem com src/lib/planos-medico.ts`);
  }
}

const produtos = {};
async function garantirProduto(chave, nome) {
  if (produtos[chave]) return produtos[chave];
  const p = await stripe("/products", "POST", { name: nome, metadata: { app_key: chave } });
  produtos[chave] = p.id;
  console.log(`＋ Produto criado: ${nome}  ${p.id}`);
  return p.id;
}

async function run() {
  console.log(`\n🔧 Stripe setup — modo ${MODE}\n`);
  const saida = [];

  // ── 1. O plano do médico: UM preço, dez faixas graduadas ──────────────────
  const { faixas, entrada, teto } = lerFaixas();
  const LK_MEDICO = "doctor_mensagens_v1";
  /* Aceita o preço já criado à mão: `STRIPE_PRICE_DOCTOR_MENSAGENS=price_…`
     no ambiente manda no `lookup_key`. O preço da conta pode ter nascido pelo
     painel, sem lookup nenhum — e aí procurar por lookup não acharia nada e o
     script criaria um SEGUNDO preço, que é o pior desfecho possível: metade
     dos médicos numa tabela e metade na outra. */
  const jaConfigurado = process.env.STRIPE_PRICE_DOCTOR_MENSAGENS;
  const existente = jaConfigurado
    ? await stripe(`/prices/${jaConfigurado}?expand[]=tiers`)
    : await acharPorLookup(LK_MEDICO);
  if (existente) {
    saida.push(["STRIPE_PRICE_DOCTOR_MENSAGENS", existente.id]);
    console.log(`✓ STRIPE_PRICE_DOCTOR_MENSAGENS  (já existia)  ${existente.id}`);
    await conferirFaixas(existente, faixas);
  } else {
    const prod = await garantirProduto("doctor_mensagens", "Mensagens de IA (médico)");
    const preco = await stripe("/prices", "POST", {
      currency: "brl",
      product: prod,
      lookup_key: LK_MEDICO,
      nickname: `Mensagens de IA — ${faixas.length} faixas graduadas`,
      billing_scheme: "tiered",
      tiers_mode: "graduated",
      recurring: { interval: "month", usage_type: "licensed" },
      tiers: montarTiers({ faixas, teto }),
    });
    saida.push(["STRIPE_PRICE_DOCTOR_MENSAGENS", preco.id]);
    console.log(`＋ STRIPE_PRICE_DOCTOR_MENSAGENS  criado  ${preco.id}`);
    console.log(`   ${faixas.length} faixas · entrada ${entrada} · teto ${teto} mensagens`);
  }

  // ── 2. Premium da paciente (preço simples) ────────────────────────────────
  for (const p of PRECOS_SIMPLES) {
    const achado = await acharPorLookup(p.lk);
    if (achado) {
      saida.push([p.env, achado.id]);
      console.log(`✓ ${p.env}  (já existia)  ${achado.id}`);
      continue;
    }
    const prod = await garantirProduto(p.produto, p.nome);
    const preco = await stripe("/prices", "POST", {
      currency: "brl",
      unit_amount: p.amount,
      recurring: { interval: p.interval },
      product: prod,
      lookup_key: p.lk,
      nickname: `${p.nome} ${p.interval === "year" ? "anual" : "mensal"}`,
    });
    saida.push([p.env, preco.id]);
    console.log(`＋ ${p.env}  criado  ${preco.id}`);
  }

  console.log(`\n────────────────────────────────────────────────────────`);
  console.log(`📋 Cole na Vercel (Settings → Environment Variables):\n`);
  for (const [env, id] of saida) console.log(`${env}=${id}`);
  console.log(`\n⚠️  As duas do QUIZ ficam vazias na Vercel de propósito: a`);
  console.log(`   paciente assina DENTRO do app (iOS/Android), nunca pelo site.`);
  console.log(`   A que o plano do médico precisa é a PRIMEIRA.`);
  console.log(`\n✅ Pronto, modo ${MODE}. Rodar de novo não duplica.\n`);
}

run().catch((e) => {
  console.error(`\n❌ Erro: ${e.message}\n`);
  process.exit(1);
});
