/**
 * De onde sai o conteúdo dos posts.
 *
 * Nada aqui é inventado. Tudo vem de `daily-quizzes.data.json`, que já foi
 * escrito e revisado para o app: 294 dias, 1331 perguntas com explicação e 294
 * fatos curiosos. Gerar post é escolher, não redigir — e isso é o que mantém o
 * conteúdo defensável quando alguém pergunta de onde veio.
 *
 * O arquivo `.usado.json` guarda o que já saiu, para não repetir. Ele fica de
 * fora do git: é estado da máquina de quem posta, não do projeto.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CAMINHOS } from "./caminhos.mjs";

const QUIZZES = CAMINHOS.quizzes;
const ESTADO = CAMINHOS.estado;

/** D = semana × 7 + dia. A semana gestacional que o dia representa. */
export const semanaDoDia = (D) => Math.floor(Number(D) / 7);

export function lerQuizzes() {
  return JSON.parse(readFileSync(QUIZZES, "utf8"));
}

function lerEstado() {
  if (!existsSync(ESTADO)) return { fatos: [], perguntas: [] };
  try {
    return JSON.parse(readFileSync(ESTADO, "utf8"));
  } catch {
    return { fatos: [], perguntas: [] };
  }
}

function gravarEstado(e) {
  mkdirSync(dirname(ESTADO), { recursive: true });
  writeFileSync(ESTADO, JSON.stringify(e, null, 2));
}

/**
 * Sorteio determinístico a partir de uma semente — o mesmo dia gera sempre o
 * mesmo post. Sem isso, rodar o gerador duas vezes no mesmo dia devolveria
 * conteúdos diferentes e não daria para conferir nada.
 */
function baralhar(lista, semente) {
  const arr = [...lista];
  let s = 0;
  for (const c of String(semente)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const proximo = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(proximo() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Só a faixa em que o conteúdo é útil para quem está grávida agora. */
function diasUteis(quizzes, { deSemana = 4, ateSemana = 41 } = {}) {
  return Object.keys(quizzes)
    .map(Number)
    .filter((D) => {
      const s = semanaDoDia(D);
      return s >= deSemana && s <= ateSemana;
    })
    .sort((a, b) => a - b);
}

/**
 * Um carrossel de quiz leva TRÊS perguntas, não uma.
 *
 * Uma pergunta rende 4 telas, e carrossel curto rende pouco alcance — a faixa
 * que performa é 8 a 12 telas. Três perguntas dão 8 telas E triplicam o número
 * de vezes que a pessoa precisa deslizar para saber a resposta, que é
 * exatamente o gesto que o algoritmo pesa.
 */
export function montarQuiz(semente, { quantas = 3, marcarUsado = true } = {}) {
  const quizzes = lerQuizzes();
  const estado = lerEstado();
  const usadas = new Set(estado.perguntas);

  const todas = [];
  for (const D of diasUteis(quizzes)) {
    const dia = quizzes[String(D)];
    (dia.questions || []).forEach((q, i) => {
      const id = `${D}:${i}`;
      if (usadas.has(id)) return;
      // Pergunta sem explicação não vira post: a explicação É o valor.
      if (!q.why || !q.q || !Array.isArray(q.o)) return;
      todas.push({ id, D, semana: semanaDoDia(D), ...q });
    });
  }

  if (todas.length < quantas) {
    throw new Error(
      `Só restam ${todas.length} perguntas inéditas. Apague ${ESTADO} para recomeçar o ciclo.`,
    );
  }

  const escolhidas = baralhar(todas, semente).slice(0, quantas);

  if (marcarUsado) {
    estado.perguntas = [...usadas, ...escolhidas.map((q) => q.id)];
    gravarEstado(estado);
  }

  return escolhidas;
}

/**
 * Um carrossel de "Você sabia?" leva CINCO fatos.
 *
 * O fato surpreendente é o que a pessoa manda para a amiga no direct, e
 * compartilhamento por mensagem pesa muito mais que curtida. Cinco dá margem
 * para que pelo menos um pegue.
 */
export function montarFatos(semente, { quantos = 5, marcarUsado = true } = {}) {
  const quizzes = lerQuizzes();
  const estado = lerEstado();
  const usados = new Set(estado.fatos);

  const todos = [];
  for (const D of diasUteis(quizzes)) {
    const dia = quizzes[String(D)];
    if (!dia.funFact) continue;
    const id = String(D);
    if (usados.has(id)) continue;
    todos.push({ id, D, semana: semanaDoDia(D), fato: dia.funFact.trim() });
  }

  if (todos.length < quantos) {
    throw new Error(
      `Só restam ${todos.length} fatos inéditos. Apague ${ESTADO} para recomeçar o ciclo.`,
    );
  }

  const escolhidos = baralhar(todos, semente).slice(0, quantos);

  if (marcarUsado) {
    estado.fatos = [...usados, ...escolhidos.map((f) => f.id)];
    gravarEstado(estado);
  }

  return escolhidos;
}

/** Quanto conteúdo inédito ainda existe — para saber quando o ciclo fecha. */
export function estoque() {
  const quizzes = lerQuizzes();
  const estado = lerEstado();
  const dias = diasUteis(quizzes);

  let perguntas = 0;
  let fatos = 0;
  for (const D of dias) {
    const dia = quizzes[String(D)];
    (dia.questions || []).forEach((q, i) => {
      if (q.why && q.q && Array.isArray(q.o) && !estado.perguntas.includes(`${D}:${i}`))
        perguntas++;
    });
    if (dia.funFact && !estado.fatos.includes(String(D))) fatos++;
  }

  return {
    perguntas,
    fatos,
    carrosseisQuiz: Math.floor(perguntas / 3),
    carrosseisFato: Math.floor(fatos / 5),
  };
}
