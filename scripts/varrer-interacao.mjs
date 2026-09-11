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
  /* ⚠️ **E o mesmo caminho na aba irmã.** Corrigir a força é o conserto de um
     dado clínico já gravado (o eixo com aOR 2,53 para desfecho ruim), e o
     painel com os três níveis só nasce de um toque na linha.

     ⚠️ **A CONTAGEM TOCADA É A DA FILA, e nunca uma do servidor — este roteiro
     JÁ REPROVOU A CI por isso.** A primeira versão abria `?estado=historico`,
     cujas linhas vêm do banco: o toque em "Mais fraco" chama o `update` em
     `kick_sessions`, e sem sessão a bancada recebe **400** no console. A
     varredura contou como problema, com razão — uma chamada não autenticada
     saindo de uma bancada é justamente o que ela existe para acusar. É a mesma
     armadilha que o roteiro da nutrição já tinha pago com um 401.

     `?estado=pendente` é a contagem salva no aparelho que ainda não subiu, e a
     correção dela acontece NA FILA (`fila-de-chutes.ts`), sem uma ida à rede. */
  {
    q: "/preview-chutes?estado=pendente&w=30",
    nome: "chutes · corrigir a força de uma contagem salva no aparelho",
    passos: [
      { dentro: "Salva no seu celular", clique: /min/ },
      { dentro: "Salva no seu celular", clique: /^Mais fraco$/ },
    ],
  },
  /* ⚠️ O desfazer do toque a mais: ele só existe com a contagem em curso, e é
     o conserto do erro que empurra para o lado de TRANQUILIZAR. */
  {
    q: "/preview-chutes?estado=contando&w=30",
    nome: "chutes · tirar um toque contado a mais",
    passos: [{ clique: /Contei um a mais/ }],
  },
  /* ⚠️ **A LINHA QUE ABRE PARA APAGAR UM REGISTRO CLÍNICO.** Ela só existe
     depois de dois toques — abrir a lista recolhida e tocar na linha —, então
     a varredura de bancadas nunca a alcançou: até set/2026 o que havia ali era
     um `×` de 8×18 pixels que apagava peso, pressão ou glicemia na hora.

     ⚠️ **O ROTEIRO PARA NO "ABRIR", e não toca em "Apagar este registro".** O
     apagar chama o servidor, e sem sessão a bancada receberia 400 no console —
     que a varredura contaria como problema, com razão. É a lição que este
     roteiro já custou DUAS vezes: aqui se toca em controle LOCAL; o que
     dispara rede se prova na medição, com a rede forjada. */
  {
    q: "/preview-saude-registros?estado=grave&w=28",
    nome: "saúde · abrir uma linha do histórico para corrigir",
    passos: [
      { abrirLista: "Ver e corrigir meus registros" },
      /* A linha do dia da pressão grave — o nome acessível dela carrega a data
         e os três números, então o `165` a distingue das outras quatro. */
      { clique: /165/ },
    ],
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
        } else if (s.abrirLista) {
          /* ⚠️ **`<summary>` NÃO TEM ROLE DE BOTÃO**, e `getByRole("button")`
             não o alcança — medido: o passo que tentava abrir a lista recolhida
             dos registros saía com ZERO toques, e o roteiro passava em vazio
             sobre a linha que ele existe para exercitar. Aqui o toque é na TAG,
             que é o que o dedo de verdade acerta. */
          await p.locator("summary", { hasText: s.abrirLista }).first().click({ timeout: 4000 });
          toques++;
        } else if (s.segurar) {
          await p.mouse.down();
          await p.waitForTimeout(700);
          await p.mouse.up();
          toques++;
        } else {
          /* ⚠️ **`dentro` ESCOPA O TOQUE A UM CARTÃO.** Numa lista em que toda
             linha tem o mesmo formato, um nome de botão não distingue a linha
             que o roteiro precisa tocar da vizinha — e tocar a errada aqui não
             é um roteiro fraco, é um roteiro que exercita OUTRO caminho (no
             histórico de chutes, o da rede em vez do da fila). O filtro pega o
             cartão que contém o texto e a busca do botão acontece dentro dele;
             `.last()` é o `div` MAIS INTERNO que ainda contém o texto, que é o
             cartão, e não a página inteira em volta. */
          const raiz = s.dentro ? p.locator("div").filter({ hasText: s.dentro }).last() : p;
          const alvo = raiz.getByRole("button", { name: s.clique }).first();
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
