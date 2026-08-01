/**
 * As telas do carrossel, em HTML.
 *
 * Por que HTML e não IA: carrossel é tipografia e cor chapada. Modelo de imagem
 * erra letra, cobra crédito e varia entre gerações — e variação é exatamente o
 * que mata a identidade de quem posta três vezes por dia. Aqui o texto sai
 * sempre certo, as cores saem do `styles.css` do próprio site, e rodar de novo
 * devolve o mesmo pixel.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COR, pilarDoDia } from "./marca.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

const b64 = (caminho) => readFileSync(caminho).toString("base64");
const FONTE = b64(join(AQUI, "fontes", "nunito.woff2"));
const LOGO = b64(join(RAIZ, "src", "assets", "logo-obstetrica.png"));

const escapar = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/**
 * O rodapé.
 *
 * Não sou médico e o Obstétrica não é o consultório de um médico específico —
 * então o rodapé não traz CRM (traria uma autoridade que não existe). Traz o
 * que sustenta o conteúdo de verdade: que é educativo e que não substitui
 * consulta. Isso é mais honesto e, em rede social, lê como rigor.
 */
const RODAPE = "Conteúdo educativo · não substitui consulta médica";

function base({ largura, altura, corpo, fundo = COR.fundo }) {
  /**
   * Zona segura do 9:16.
   *
   * No TikTok, a legenda, o nome do perfil e a coluna de botões ficam por cima
   * do terço de baixo do vídeo. Texto colocado ali some atrás da interface — e
   * como o mesmo arquivo também roda no Reels, que cobre a mesma faixa, a
   * conta é a mesma nos dois. Por isso o formato alto reserva 380px no pé e
   * empurra o conteúdo para cima, em vez de centralizar no meio geométrico.
   */
  const alto = altura / largura > 1.5;
  const pePagina = alto ? 380 : 88;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
@font-face{font-family:Nunito;src:url(data:font/woff2;base64,${FONTE}) format('woff2');font-weight:100 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${largura}px;height:${altura}px}
body{
  font-family:Nunito,system-ui,sans-serif;
  background:${fundo};
  color:${COR.tinta};
  display:flex;flex-direction:column;
  padding:88px 80px ${pePagina}px;
  overflow:hidden;
  -webkit-font-smoothing:antialiased;
}
.topo{display:flex;align-items:center;justify-content:space-between;gap:24px}
.selo{
  font-size:30px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:${COR.primaria};
}
.passo{
  font-size:28px;font-weight:700;color:${COR.tintaSuave};
  font-variant-numeric:tabular-nums;
}
.meio{flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px;min-height:0}
.rodape{
  display:flex;align-items:center;justify-content:space-between;gap:24px;
  font-size:22px;font-weight:600;color:${COR.tintaSuave};white-space:nowrap;
}
.rodape .sitio{color:${COR.primaria};font-weight:800}
h1{font-size:104px;line-height:1.02;font-weight:800;letter-spacing:-.02em;text-wrap:balance}
h2{font-size:66px;line-height:1.14;font-weight:800;letter-spacing:-.01em;text-wrap:balance}
.sub{font-size:40px;line-height:1.35;font-weight:600;color:${COR.tintaSuave};text-wrap:balance}
.cartao{
  background:${COR.cartao};border:3px solid ${COR.borda};border-radius:44px;
  padding:52px 56px;
}
.tag{
  display:inline-flex;align-items:center;gap:14px;align-self:flex-start;
  background:${COR.acento};color:${COR.primaria};
  font-size:28px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  padding:16px 30px;border-radius:999px;
}
.opcoes{display:flex;flex-direction:column;gap:22px}
.opcao{
  display:flex;align-items:flex-start;gap:26px;
  background:${COR.cartao};border:3px solid ${COR.borda};border-radius:32px;
  padding:32px 36px;font-size:38px;line-height:1.3;font-weight:600;
}
.opcao .letra{
  flex:none;width:60px;height:60px;border-radius:999px;
  background:${COR.secundaria};color:${COR.primaria};
  font-size:32px;font-weight:800;
  display:flex;align-items:center;justify-content:center;
}
.opcao.certa{border-color:${COR.primaria};background:${COR.acento}}
.opcao.certa .letra{background:${COR.primaria};color:#fff}
.desliza{
  display:flex;align-items:center;justify-content:flex-end;gap:18px;
  font-size:32px;font-weight:800;color:${COR.primaria};
}
.seta{font-size:44px;line-height:1}
.porque{font-size:40px;line-height:1.42;font-weight:600;color:${COR.tinta}}
.fato{font-size:52px;line-height:1.36;font-weight:700;text-wrap:balance}
.numero{
  font-size:150px;line-height:.85;font-weight:800;color:${COR.primariaSuave};
  letter-spacing:-.04em;
}
.logo{width:420px;height:auto;display:block}
.cta-lista{display:flex;flex-direction:column;gap:26px;font-size:40px;font-weight:600}
.cta-lista li{display:flex;align-items:center;gap:22px;list-style:none}
.bolinha{
  flex:none;width:18px;height:18px;border-radius:999px;background:${COR.primaria};
}
</style></head><body>${corpo}</body></html>`;
}

const moldura = ({ selo, passo, meio, largura, altura, fundo }) =>
  base({
    largura,
    altura,
    fundo,
    corpo: `
<div class="topo"><div class="selo">${escapar(selo)}</div><div class="passo">${escapar(passo)}</div></div>
<div class="meio">${meio}</div>
<div class="rodape"><span>${RODAPE}</span><span class="sitio">obstetrica.com.br</span></div>`,
  });

/* ---------------------------------------------------------------- QUIZ ---- */

export function telasQuiz(perguntas, tela) {
  const { largura, altura } = tela;
  const total = perguntas.length * 2 + 2;
  const telas = [];
  let n = 1;
  const passo = () => `${n++}/${total}`;

  telas.push({
    nome: "01-capa",
    html: moldura({
      largura,
      altura,
      selo: "quiz da gestação",
      passo: passo(),
      meio: `
<div class="tag">👶 ${perguntas.length} perguntas</div>
<h1>Você<br>acerta<br>as ${perguntas.length}?</h1>
<div class="sub">São perguntas reais da jornada do Obstétrica. A resposta vem sempre na tela seguinte — com o porquê.</div>`,
    }),
  });

  perguntas.forEach((q, i) => {
    const letras = ["A", "B", "C", "D", "E"];
    const pilar = pilarDoDia(q.D);

    telas.push({
      nome: `${String(telas.length + 1).padStart(2, "0")}-pergunta-${i + 1}`,
      html: moldura({
        largura,
        altura,
        selo: `pergunta ${i + 1}`,
        passo: passo(),
        meio: `
<div class="tag">${pilar.emoji} semana ${q.semana}</div>
<h2>${escapar(q.q)}</h2>
<div class="opcoes">
${q.o.map((o, j) => `<div class="opcao"><span class="letra">${letras[j]}</span><span>${escapar(o)}</span></div>`).join("\n")}
</div>
<div class="desliza"><span>deslize para a resposta</span><span class="seta">→</span></div>`,
      }),
    });

    telas.push({
      nome: `${String(telas.length + 1).padStart(2, "0")}-resposta-${i + 1}`,
      html: moldura({
        largura,
        altura,
        selo: `resposta ${i + 1}`,
        passo: passo(),
        meio: `
<div class="tag">✅ resposta</div>
<div class="opcoes">
<div class="opcao certa"><span class="letra">${letras[q.a]}</span><span>${escapar(q.o[q.a])}</span></div>
</div>
<div class="cartao"><div class="porque">${escapar(q.why)}</div></div>`,
      }),
    });
  });

  telas.push({
    nome: `${String(telas.length + 1).padStart(2, "0")}-cta`,
    html: telaCta(tela, passo()),
  });
  return telas;
}

/* --------------------------------------------------------------- FATOS ---- */

export function telasFatos(fatos, tela) {
  const { largura, altura } = tela;
  const total = fatos.length + 2;
  const telas = [];
  let n = 1;
  const passo = () => `${n++}/${total}`;

  telas.push({
    nome: "01-capa",
    html: moldura({
      largura,
      altura,
      selo: "você sabia?",
      passo: passo(),
      meio: `
<div class="tag">✨ ${fatos.length} coisas</div>
<h1>${fatos.length} coisas<br>que quase<br>ninguém<br>te conta</h1>
<div class="sub">Sobre o que acontece de verdade em cada semana da gestação.</div>`,
    }),
  });

  fatos.forEach((f, i) => {
    const pilar = pilarDoDia(f.D);
    telas.push({
      nome: `${String(telas.length + 1).padStart(2, "0")}-fato-${i + 1}`,
      html: moldura({
        largura,
        altura,
        selo: `${pilar.emoji} semana ${f.semana}`,
        passo: passo(),
        meio: `
<div class="numero">${i + 1}</div>
<div class="fato">${escapar(f.fato)}</div>`,
      }),
    });
  });

  telas.push({
    nome: `${String(telas.length + 1).padStart(2, "0")}-cta`,
    html: telaCta(tela, passo()),
  });
  return telas;
}

/* ----------------------------------------------------------------- CTA ---- */

/**
 * A última tela.
 *
 * O carrossel inteiro entregou valor completo — dá para tirar print de tudo e
 * nunca baixar nada. É justamente isso que dá direito de pedir alguma coisa
 * aqui. O pedido é pequeno e específico, e diz o que a pessoa ganha, não o que
 * a gente quer.
 */
function telaCta(tela, passo) {
  const { largura, altura } = tela;
  return moldura({
    largura,
    altura,
    fundo: COR.secundaria,
    selo: "obstétrica",
    passo,
    meio: `
<img class="logo" src="data:image/png;base64,${LOGO}" alt="">
<h2>Isso é um dia<br>da sua jornada.</h2>
<ul class="cta-lista">
<li><span class="bolinha"></span>Uma aula nova por dia, da semana 4 à 42</li>
<li><span class="bolinha"></span>O tamanho e o desenvolvimento do seu bebê</li>
<li><span class="bolinha"></span>Contrações, exames, ciclo e plano de parto</li>
<li><span class="bolinha"></span>Seu médico do outro lado, a qualquer hora</li>
</ul>
<div class="sub"><strong>obstetrica.com.br</strong> — grátis para começar.</div>`,
  });
}
