#!/usr/bin/env node
/**
 * Auditoria do conteúdo diário da jornada — `bun run audit:conteudo`.
 *
 * O Caminho serve dois conteúdos por dia: a aula da professora (quiz) e o
 * desafio do dia. Os dois são tabelas indexadas pelo dia gestacional, e é
 * fácil abrir um buraco sem perceber: um dia sem entrada cai num texto
 * genérico, um gabarito fora da faixa trava a pergunta, um "marque todos" com
 * todas as alternativas certas vira clique automático.
 *
 * Este script falha (exit 1) em qualquer um desses casos.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => JSON.parse(fs.readFileSync(path.join(raiz, p), "utf8"));

const aulas = ler("src/lib/daily-quizzes.data.json");
const desafios = ler("src/lib/daily-challenges.data.json");

/** Faixas cobertas. Gestação: semanas 1–42. Pós-parto: 12 semanas de vida. */
const GEST = [7, 300];
const POS = [7, 90];
/** Uma pergunta reaparecer semanas depois é revisão espaçada; em 13 dias, não. */
const JANELA_REVISAO = 14;

const probs = [];
const erro = (m) => probs.push(m);
/* Aviso ≠ erro: sai no relatório e não reprova o build. É para o problema
   REAL cuja correção exige escrita clínica, que não é trabalho de script. */
const avisos = [];
const aviso = (m) => avisos.push(m);

/* ── Aulas ── */
for (let D = GEST[0]; D <= GEST[1]; D++) {
  if (!aulas[String(D)]) erro(`aula: falta o dia ${D} (semana ${Math.floor(D / 7)})`);
}
for (const k of Object.keys(aulas)) {
  if (+k < GEST[0] || +k > GEST[1]) erro(`aula: dia ${k} fora da faixa ${GEST.join("–")}`);
}

const enunciados = new Map();

/* ── Contadores de "dá pra gabaritar sem ler?" ──────────────────────────
   Uma paciente que descobre um padrão de FORMA passa a acertar sem estudar,
   e o quiz deixa de ensinar sem que nada pareça quebrado. Estes três
   contadores existem para que isso não volte em silêncio.
   `posicao[n][i]` = quantas escolhas únicas de n alternativas têm a certa em i. */
const posicao = {};
let totalMulti = 0;
let multiQuaseTodas = 0;
let totalComparaveis = 0;
let certaMaisLonga = 0;
const licoes = new Map();
let totalPerguntas = 0;

for (const [D, aula] of Object.entries(aulas)) {
  if (!aula.teach?.trim()) erro(`aula D${D}: sem texto`);
  const t = aula.teach?.trim();
  if (licoes.has(t)) erro(`aula D${D}: texto idêntico ao de D${licoes.get(t)}`);
  else licoes.set(t, D);

  const qs = aula.questions ?? [];
  totalPerguntas += qs.length;
  if (qs.length < 4) erro(`aula D${D}: só ${qs.length} perguntas`);

  qs.forEach((q, i) => {
    const id = `D${D}.q${i + 1}`;
    if (!q.q?.trim()) erro(`${id}: enunciado vazio`);
    if (!q.why?.trim()) erro(`${id}: sem explicação`);
    if (!Array.isArray(q.o) || q.o.length < 2) erro(`${id}: precisa de 2+ alternativas`);
    const opts = q.o ?? [];
    if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== opts.length)
      erro(`${id}: alternativas repetidas`);

    const gab = Array.isArray(q.a) ? q.a : [q.a];
    for (const a of gab) {
      if (typeof a !== "number" || a < 0 || a >= opts.length)
        erro(`${id}: gabarito ${a} fora das ${opts.length} alternativas`);
    }
    if (Array.isArray(q.a)) {
      if (new Set(gab).size !== gab.length) erro(`${id}: gabarito com índice repetido`);
      if (gab.length === opts.length) erro(`${id}: "marque todos" com TODAS corretas`);
    }

    const chave = q.q?.trim().toLowerCase();
    const antes = enunciados.get(chave);
    if (antes != null && Math.abs(+D - +antes) < JANELA_REVISAO)
      erro(`${id}: mesmo enunciado de D${antes}, a ${Math.abs(+D - +antes)} dias`);
    /* Guarda SEMPRE a ocorrência mais recente. Guardava só a primeira, e aí o
       mesmo enunciado em D10, D100 e D105 comparava D105 contra D10 (95 dias,
       passa) e nunca comparava D100 contra D105 (5 dias, deveria acusar). */
    enunciados.set(chave, D);

    /* Estatística de posição do gabarito — ver o bloco no fim do arquivo. */
    if (opts.length > 2) {
      const cesta = Array.isArray(q.a) ? null : (posicao[opts.length] ??= []);
      if (cesta) {
        cesta[q.a] = (cesta[q.a] ?? 0) + 1;
        cesta.total = (cesta.total ?? 0) + 1;
      }
    }
    if (Array.isArray(q.a)) {
      totalMulti++;
      if (gab.length === opts.length - 1) multiQuaseTodas++;
    }
    if (!Array.isArray(q.a) && opts.length > 2) {
      const comp = opts.map((t) => t.length);
      const max = Math.max(...comp);
      if (comp.filter((c) => c === max).length === 1) {
        totalComparaveis++;
        if (comp[q.a] === max) certaMaisLonga++;
      }
    }
  });
}

/* ── Desafios ── */
function auditaDesafios(tag, tabela, [de, ate]) {
  for (let D = de; D <= ate; D++) {
    if (!tabela[String(D)]) erro(`desafio ${tag}: falta o dia ${D}`);
  }
  for (const k of Object.keys(tabela)) {
    if (+k < de || +k > ate) erro(`desafio ${tag}: dia ${k} fora da faixa ${de}–${ate}`);
  }
  const vistos = new Map();
  for (const [D, it] of Object.entries(tabela)) {
    if (!it.label?.trim()) erro(`desafio ${tag} D${D}: sem texto`);
    if (it.label && it.label.length > 46)
      erro(`desafio ${tag} D${D}: ${it.label.length} caracteres (o card corta em 46)`);
    if (!it.emoji?.trim()) erro(`desafio ${tag} D${D}: sem emoji`);
    const chave = it.label?.trim().toLowerCase();
    if (vistos.has(chave)) erro(`desafio ${tag} D${D}: repete o de D${vistos.get(chave)}`);
    else vistos.set(chave, D);
  }
}
auditaDesafios("gestação", desafios.gest, GEST);
auditaDesafios("pós-parto", desafios.pos, POS);

/* ── Placar ── */
const nGest = Object.keys(desafios.gest).length;
const nPos = Object.keys(desafios.pos).length;
console.log(
  `aulas: ${Object.keys(aulas).length} dias · ${totalPerguntas} perguntas\n` +
    `desafios: ${nGest} dias de gestação + ${nPos} de pós-parto`,
);

/* ── Viés de posição: trava dura ────────────────────────────────────────
   Antes do embaralhamento, as 294 perguntas "marque todas" tinham a
   alternativa 0 correta em 294 delas — 100%. Bastava marcar a primeira,
   todo dia, para gabaritar sem abrir a aula.
   A trava é por índice: em escolha única de n alternativas cada posição
   deve receber perto de 1/n. A banda é generosa (±10 pontos) porque isto
   pega REGRESSÃO estrutural, não flutuação de amostra — com 745 perguntas,
   um desvio de 10 pontos está a quase 6 desvios-padrão do acaso. */
for (const [n, cesta] of Object.entries(posicao)) {
  const alvo = 100 / Number(n);
  for (let i = 0; i < Number(n); i++) {
    const pc = ((cesta[i] ?? 0) / cesta.total) * 100;
    if (Math.abs(pc - alvo) > 10)
      erro(
        `viés de posição: em ${n} alternativas, a certa cai no índice ${i} em ` +
          `${pc.toFixed(1)}% das ${cesta.total} perguntas (o acaso é ${alvo.toFixed(1)}%). ` +
          `Reembaralhe — dá para acertar sem ler.`,
      );
  }
}

/* ── Os dois vazamentos que NÃO se consertam embaralhando ───────────────
   Ficam como aviso, não como erro: consertar exige escrever alternativa
   clínica nova, e isso passa pelo médico — não por script. */
if (totalMulti) {
  const pc = (multiQuaseTodas / totalMulti) * 100;
  if (pc > 60)
    aviso(
      `${pc.toFixed(1)}% dos "marque todas" têm exatamente UMA alternativa errada ` +
        `(${multiQuaseTodas} de ${totalMulti}). Marcar todas menos uma acerta quase sempre. ` +
        `Some um segundo distrator a parte delas.`,
    );
}
if (totalComparaveis) {
  const pc = (certaMaisLonga / totalComparaveis) * 100;
  if (pc > 50)
    aviso(
      `a alternativa CERTA é a mais longa em ${pc.toFixed(1)}% das escolhas únicas ` +
        `(${certaMaisLonga} de ${totalComparaveis}; o acaso seria ~33%). ` +
        `Distrator curto entrega a resposta — dê corpo aos errados.`,
    );
}

if (avisos.length) {
  console.warn(`\n${avisos.length} aviso(s) — não reprovam, mas custam aprendizado:`);
  for (const a of avisos) console.warn(` ! ${a}`);
}

if (probs.length) {
  console.error(`\n${probs.length} problema(s):`);
  for (const p of probs.slice(0, 50)) console.error(` - ${p}`);
  if (probs.length > 50) console.error(` … e mais ${probs.length - 50}`);
  process.exit(1);
}
console.log("tudo certo — nenhum dia sem conteúdo próprio.");
