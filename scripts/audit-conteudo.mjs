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

/* ── Aulas ── */
for (let D = GEST[0]; D <= GEST[1]; D++) {
  if (!aulas[String(D)]) erro(`aula: falta o dia ${D} (semana ${Math.floor(D / 7)})`);
}
for (const k of Object.keys(aulas)) {
  if (+k < GEST[0] || +k > GEST[1]) erro(`aula: dia ${k} fora da faixa ${GEST.join("–")}`);
}

const enunciados = new Map();
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
    else if (antes == null) enunciados.set(chave, D);
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

if (probs.length) {
  console.error(`\n${probs.length} problema(s):`);
  for (const p of probs.slice(0, 50)) console.error(` - ${p}`);
  if (probs.length > 50) console.error(` … e mais ${probs.length - 50}`);
  process.exit(1);
}
console.log("tudo certo — nenhum dia sem conteúdo próprio.");
