/**
 * Gera os carrosséis do dia: PNGs prontos para postar + a legenda.
 *
 *   bun run social                    → 1 quiz + 1 "você sabia", nos 2 formatos
 *   bun run social -- --so quiz       → só o quiz
 *   bun run social -- --semente x     → repete exatamente a mesma seleção
 *   bun run social -- --espiar        → não marca o conteúdo como usado
 *   bun run social -- --estoque       → quanto conteúdo inédito ainda existe
 *
 * A saída vai para `saida/social/<data>/`, que está no .gitignore: são dezenas
 * de PNGs por dia e eles não têm por que entrar no repositório.
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TELAS } from "./marca.mjs";
import { montarQuiz, montarFatos, estoque } from "./conteudo.mjs";
import { telasQuiz, telasFatos } from "./telas.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

/** O Chromium do ambiente. Baixar outro é proibido e desnecessário. */
const CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const args = process.argv.slice(2);
const opcao = (nome, padrao = null) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : padrao;
};
const tem = (nome) => args.includes(`--${nome}`);

if (tem("estoque")) {
  const e = estoque();
  console.log(`
Conteúdo inédito ainda disponível:

  perguntas .......... ${e.perguntas}   →  ${e.carrosseisQuiz} carrosséis de quiz
  fatos .............. ${e.fatos}   →  ${e.carrosseisFato} carrosséis "você sabia"

O quiz dura muito mais que o "você sabia" — são 3 perguntas por post contra 5
fatos, e há 4,5× mais perguntas. Postar quiz todo dia e "você sabia" duas ou
três vezes por semana faz os dois acabarem juntos.
`);
  process.exit(0);
}

const hoje = new Date().toISOString().slice(0, 10);
const semente = opcao("semente", hoje);
const espiar = tem("espiar");
const so = opcao("so");

const destino = join(RAIZ, "saida", "social", hoje);
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });

/** Legendas. O texto do post é tão parte da peça quanto a imagem. */
function legendaQuiz(perguntas) {
  const semanas = [...new Set(perguntas.map((q) => q.semana))].sort((a, b) => a - b);
  return `Você acerta as ${perguntas.length}? 👶

Três perguntas que aparecem de verdade na jornada de quem está grávida — semanas ${semanas.join(", ")}.

Responde aí nos comentários antes de deslizar: acertou quantas?

Salva pra responder depois com calma, e manda pra uma amiga grávida ver se ela acerta mais que você. 💗

Conteúdo educativo — não substitui a consulta com seu médico.

#gestacao #gravidez #maternidade #prenatal #gestante #gravidezdealtorisco #maedeprimeiraviagem #gestante2026 #obstetricia #quizdagravidez`;
}

function legendaFatos(fatos) {
  return `${fatos.length} coisas que quase ninguém te conta ✨

Uma para cada fase da gestação. A ${fatos.length > 3 ? "terceira" : "segunda"} surpreende quase todo mundo.

Qual dessas você não sabia? Conta nos comentários 👇

Salva para lembrar e manda para quem está grávida. 💗

Conteúdo educativo — não substitui a consulta com seu médico.

#gestacao #gravidez #maternidade #prenatal #gestante #vocesabia #curiosidades #gravidezsemanaasemana #maedeprimeiraviagem #obstetricia`;
}

const trabalhos = [];
if (so !== "fatos") {
  const perguntas = montarQuiz(semente, { marcarUsado: !espiar });
  trabalhos.push({
    tipo: "quiz",
    itens: perguntas,
    telas: telasQuiz,
    legenda: legendaQuiz(perguntas),
  });
}
if (so !== "quiz") {
  const fatos = montarFatos(semente, { marcarUsado: !espiar });
  trabalhos.push({
    tipo: "voce-sabia",
    itens: fatos,
    telas: telasFatos,
    legenda: legendaFatos(fatos),
  });
}

/**
 * A Nunito precisa estar realmente desenhando as letras — não só carregada.
 *
 * O Google Fonts entrega a família fatiada por faixa de caracteres, e uma
 * dessas fatias é a cirílica. Se a errada for embutida, `document.fonts.check`
 * responde que sim (a face carregou) e mesmo assim o texto sai na fonte do
 * sistema, porque a fatia não tem nenhum glifo latino. Já aconteceu aqui. Por
 * isso a conferência mede a largura de um texto com acento contra a mesma
 * medida numa serifada: se derem igual, a Nunito não está sendo usada.
 */
async function conferirFonte(pagina) {
  const ok = await pagina.evaluate(async () => {
    await document.fonts.ready;
    const medir = (familia) => {
      const s = document.createElement("span");
      s.textContent = "Você acertação — ê ã ç";
      s.style.cssText = `position:absolute;visibility:hidden;font-size:60px;font-weight:800;font-family:${familia}`;
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    };
    return medir("Nunito") !== medir("serif");
  });
  if (!ok) {
    throw new Error(
      "A Nunito não está desenhando as letras — o texto sairia na fonte do sistema.\n" +
        "Confira se scripts/social/fontes/nunito.woff2 é a fatia LATINA (unicode-range U+0000-00FF).",
    );
  }
}

const navegador = await chromium.launch({ executablePath: CHROMIUM });
let total = 0;

for (const t of trabalhos) {
  for (const rede of Object.values(TELAS)) {
    const pasta = join(destino, `${t.tipo}-${rede.nome}`);
    mkdirSync(pasta, { recursive: true });

    const pagina = await navegador.newPage({
      viewport: { width: rede.largura, height: rede.altura },
      deviceScaleFactor: 1,
    });

    for (const tela of t.telas(t.itens, rede)) {
      await pagina.setContent(tela.html, { waitUntil: "load" });
      await conferirFonte(pagina);
      await pagina.screenshot({ path: join(pasta, `${tela.nome}.png`), type: "png" });
      total++;
    }

    await pagina.close();
  }

  writeFileSync(join(destino, `${t.tipo}-legenda.txt`), t.legenda);
}

await navegador.close();

const e = estoque();
console.log(`
${total} telas geradas em  saida/social/${hoje}/

${trabalhos.map((t) => `  ${t.tipo}  —  ${t.itens.length} itens, dois formatos (ig 4:5 e tt 9:16)`).join("\n")}

Legendas prontas nos arquivos *-legenda.txt.
${espiar ? "\nModo espiar: nada foi marcado como usado." : ""}
Restam ${e.carrosseisQuiz} carrosséis de quiz e ${e.carrosseisFato} de "você sabia".
`);
