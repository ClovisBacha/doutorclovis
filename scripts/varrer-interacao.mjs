#!/usr/bin/env node
/**
 * VARREDURA DE INTERAÇÃO — o que CARREGAR a tela não pega.
 *
 * ─── POR QUE ELA EXISTE ─────────────────────────────────────────────────────
 *
 * `varrer-bancadas.mjs` abre cada `/preview-*` e lê o console. Isso pega erro
 * de import, laço de render, hidratação e tela que não desenha. Não pega o que
 * só acontece DEPOIS de um toque — e foi exatamente ali que a barrinha do story
 * escondeu um defeito por meses: o objeto de estilo misturava o atalho
 * `animation` com o longhand `animationPlayState`, e numa REPINTURA o atalho
 * reescrevia o play-state, fazendo a barra correr sozinha enquanto o dedo a
 * segurava. O aviso do React só aparece na repintura que o toque provoca.
 *
 * Esta varredura TOCA nos controles e lê o console durante a interação.
 *
 * ⚠️ **Os passos são OPCIONAIS por padrão.** Um roteiro que exige um controle
 * que mudou de nome vira vermelho sobre código correto, e catraca que reprova
 * o certo é catraca que alguém desliga. O que ela cobra é o CONSOLE — erro,
 * hidratação, laço — e a fronteira de erro depois do clique.
 *
 * Uso:  node scripts/varrer-interacao.mjs        (precisa do dev em 8080)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080";

/** Cada roteiro: uma tela e os controles que valem tocar. */
const ROTEIRO = [
  {
    q: "/preview-instagram",
    nome: "feed · reagir",
    passos: [{ clique: /Reagir|Amei/ }, { clique: "Ver quem reagiu" }],
  },
  {
    q: "/preview-instagram?tela=comentarios",
    nome: "comentários · ordenar, responder, denunciar",
    passos: [
      { clique: "mais curtidos" },
      { clique: "mais recentes" },
      { clique: "Responder" },
      { clique: "Denunciar comentário" },
    ],
  },
  {
    q: "/preview-instagram?tela=perfil",
    nome: "perfil de terceiro · menu de segurança",
    passos: [{ clique: "Opções deste perfil" }, { clique: /Silenciar/ }],
  },
  {
    q: "/preview-instagram?tela=perfil&meu=1",
    nome: "meu perfil · ⋯ e ♡",
    passos: [{ clique: "Opções deste perfil" }, { clique: "O que você reagiu" }],
  },
  {
    q: "/preview-instagram?tela=novo&comFoto=1",
    nome: "compositor · camada e descrição",
    passos: [{ clique: /Qualquer pessoa|Quem me segue|Só amigas/ }, { clique: /Descri/ }],
  },
  {
    q: "/preview-instagram?tela=conversa",
    nome: "conversa · lupa e opções",
    passos: [{ clique: /Procurar|Buscar/ }, { clique: /Opções desta conversa/ }],
  },
  {
    q: "/preview-instagram?tela=story",
    nome: "story · avançar, segurar, reagir",
    passos: [{ clique: /Próximo/ }, { segurar: true }, { clique: /Reagir/ }],
  },
  {
    q: "/preview-instagram?tela=caixinha",
    nome: "caixinha · opções da pergunta",
    passos: [{ clique: /Opções desta pergunta/ }],
  },
  { q: "/preview-instagram?tela=busca", nome: "busca · digitar", passos: [{ digitar: "mar" }] },
  {
    q: "/preview-instagram?tela=filtro",
    nome: "filtro · acrescentar palavra",
    passos: [{ digitar: "perdi" }, { clique: /Acrescentar|Adicionar/ }],
  },
  {
    q: "/preview-moderacao",
    nome: "moderação · ficha e desfechos",
    passos: [{ clique: "ver ficha" }, { clique: "Sem ação" }],
  },
];

/** Ruído de ambiente, não da tela — a mesma lista da varredura de bancadas. */
const RUIDO = /fonts\.goog|favicon|429|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|net::ERR_ABORTED/;

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 393, height: 852 } });
let ruins = 0;

for (const t of ROTEIRO) {
  const p = await ctx.newPage();
  const erros = [];
  p.on("console", (m) => {
    const x = m.text();
    /* ⚠️ O aviso de shorthand/hidratação/laço NÃO é `type === "error"`. */
    if (/hydrat|did not match|Maximum update|style property during rerender/i.test(x)) {
      erros.push("AVISO " + x.slice(0, 120));
      return;
    }
    if (m.type() !== "error" || RUIDO.test(x)) return;
    erros.push(x.slice(0, 140));
  });
  p.on("pageerror", (x) => erros.push("PAGEERROR " + x.message.slice(0, 140)));

  let toques = 0;
  try {
    await p.goto(BASE + t.q, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(2400);
    for (const s of t.passos) {
      try {
        if (s.digitar) {
          await p
            .locator("input[type=text], input:not([type]), textarea")
            .first()
            .fill(s.digitar, { timeout: 4000 });
          toques++;
        } else if (s.segurar) {
          await p.mouse.down();
          await p.waitForTimeout(700);
          await p.mouse.up();
          toques++;
        } else {
          const alvo = p.getByRole("button", { name: s.clique }).first();
          if (await alvo.count()) {
            await alvo.click({ timeout: 4000 });
            toques++;
          }
        }
        await p.waitForTimeout(700);
      } catch {
        /* Controle que mudou de nome não é defeito — ver o cabeçalho. */
      }
    }
    const txt = await p.locator("body").innerText();
    if (/Algo deu errado/.test(txt)) erros.push("FRONTEIRA DE ERRO depois do toque");
  } catch (x) {
    erros.push("NAVEGAÇÃO " + String(x.message).split("\n")[0].slice(0, 80));
  }

  if (erros.length) {
    ruins++;
    console.log(`  ⚠️  ${t.nome} (${toques} toques)`);
    for (const e of erros) console.log(`       ${e}`);
  } else {
    console.log(`  ✅ ${t.nome} (${toques} toques)`);
  }
  await p.close();
}

await navegador.close();
console.log(`\n${ROTEIRO.length} roteiros de interação · ${ruins} com problema`);
process.exit(ruins > 0 ? 1 : 0);
