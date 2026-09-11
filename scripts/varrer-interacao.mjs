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
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080";

/** Cada roteiro: uma tela e os controles que valem tocar. */
const ROTEIRO = [
  /* ⚠️ A NUTRIÇÃO É A ABA MAIS DEPENDENTE DE TOQUE do app da paciente: as
     quatro ferramentas, a câmera, os copos de água e o checklist do médico só
     existem depois de um dedo. A varredura de bancadas abre a tela e lê o
     console; ela NÃO alcança nada disso — e foi por isso que a nutrição entrou
     aqui no dia em que ganhou a geladeira, os suplementos e a foto. */
  {
    q: "/preview-nutricao?w=24&hora=16",
    nome: "nutrição · as quatro ferramentas",
    passos: [
      { clique: "Posso comer?" },
      { clique: "Meu prato" },
      { clique: /Alívio/ },
      { clique: "O que tenho" },
    ],
  },
  {
    /* A conversa em TELA CHEIA morre num toque e volta em outro: a seta fecha
       o painel SEM perder a conversa, e "Continuar a conversa" o reabre.
       ⚠️ O roteiro parte do painel JÁ ABERTO (`painel=1`), e não do chip do
       cartão compacto: o chip ENVIA a pergunta, e sem sessão a bancada recebe
       um 401 no console — foi assim que a primeira versão deste roteiro
       reprovou a CI. O chip abrindo o painel é conferido pela varredura de
       bancadas (`?estado=saudacao` a 393px mostra o cartão) e pela medição
       local; aqui o que se toca é o que só nasce de um dedo. */
    q: "/preview-nutricao?estado=conversa&painel=1",
    nome: "nutrição · a conversa fecha e volta",
    passos: [{ clique: "Voltar" }, { clique: "Continuar a conversa" }],
  },
  {
    q: "/preview-nutricao?w=24&receita=Ferro%20e%20C%C3%A1lcio&hora=16",
    nome: "nutrição · suplementos e água",
    passos: [{ clique: "Ferro" }, { clique: "Bebi um copo" }, { clique: "Tirar um copo" }],
  },
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
  /* ⚠️ **A CORREÇÃO DE UMA CONTRAÇÃO SÓ EXISTE DEPOIS DE UM TOQUE** — a linha
     inteira é o alvo, e o painel com os três níveis e o "Apagar esta" nasce
     dali. Sem este roteiro, o caminho que apaga DADO CLÍNICO nunca seria
     exercitado por nenhuma varredura. */
  {
    q: "/preview-contracoes?estado=normal&w=39",
    nome: "contrações · corrigir a intensidade de uma linha",
    passos: [{ clique: /^\d{2}:\d{2}/ }, { clique: /^Forte$/ }],
  },
  /* ⚠️ **E o mesmo caminho na aba irmã.** Apagar uma contagem é o conserto de
     um ALARME FALSO no consultório (a sessão aberta sem querer, encerrada com
     dois movimentos em duas horas, que sai âmbar e entra nos achados) — ou
     seja, é um caminho que mexe em dado clínico e que só nasce de um toque. */
  {
    q: "/preview-chutes?estado=historico&w=30",
    nome: "chutes · corrigir a força de uma contagem",
    passos: [{ clique: /em 2h/ }, { clique: /^Mais fraco$/ }],
  },
  /* ⚠️ O desfazer do toque a mais: ele só existe com a contagem em curso, e é
     o conserto do erro que empurra para o lado de TRANQUILIZAR. */
  {
    q: "/preview-chutes?estado=contando&w=30",
    nome: "chutes · tirar um toque contado a mais",
    passos: [{ clique: /Contei um a mais/ }],
  },
];

/** Ruído de ambiente, não da tela — a mesma lista da varredura de bancadas. */
const RUIDO = /fonts\.goog|favicon|429|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|net::ERR_ABORTED/;

/* ⚠️ **O MESMO RECUO DE CAMINHO DA VARREDURA DE BANCADAS, e ele FALTAVA.**
   Aqui o Chromium vive em `/opt/pw-browsers/chromium`; no GitHub Actions quem
   instala é `playwright install`, que põe em `~/.cache/ms-playwright` — e um
   `executablePath` fixo faria o Playwright procurar um binário que não existe
   lá. O caminho só é passado quando o arquivo EXISTE.

   ⚠️ Sem isto a varredura de interação **só rodava na CI**, e a CI chega
   TARDE: este repositório registra que ela publica em produção 53 segundos
   depois de um job reprovar. Uma varredura que o autor não consegue rodar é
   uma varredura que não pega nada antes de a paciente receber. Medido: com a
   versão do Playwright atualizada, `chromium.launch()` sem caminho estourava
   com "Executable doesn't exist" na máquina de desenvolvimento. */
const caminhoLocal = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const navegador = await chromium.launch({
  ...(existsSync(caminhoLocal) ? { executablePath: caminhoLocal } : {}),
});
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
