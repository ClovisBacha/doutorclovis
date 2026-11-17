import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * O VIDRO E A LUZ (16/11/2026, pedido do dono: "está com muita cara de feito
 * no Claude [...] precisamos de efeito Apple"). A letra do sistema (SF Pro), o
 * fundo de luz, o cartão com sombra em camadas e o Liquid Glass na camada que
 * flutua (a barra, o placar da trilha, os botões soltos, as etiquetas do céu).
 *
 * Esta catraca segura as três coisas que se perdem sem ninguém ver:
 * - a letra passa pelo tema (`fonte.*`): um nome de fonte escrito numa tela
 *   escapa da chave `LETRA_DO_SISTEMA` e volta a Nunito (ou some) sozinho;
 * - o vidro do sistema é sempre o CLARO: o app não tem modo escuro, e o vidro
 *   escuro de um iPhone em modo escuro deixaria o texto vinho ilegível;
 * - a barra de abas flutua, então as abas terminam a rolagem acima dela
 *   (`useFimDaRolagem`/`useFolgaDaBarra`), e não num número fixo.
 */

const RAIZ = join(import.meta.dir, "..");

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}

const FONTES = arquivos(RAIZ).map((p) => ({
  arquivo: relative(RAIZ, p),
  codigo: semComentarios(readFileSync(p, "utf8")),
}));

const de = (arquivo: string) => FONTES.find((f) => f.arquivo === arquivo)!.codigo;

describe("o vidro e a luz", () => {
  test("nenhuma tela escreve o nome de uma fonte: a letra vem de `fonte.*` do tema", () => {
    const LIVRES = new Set([join("tema", "index.ts"), join("app", "_layout.tsx")]);
    const fora = FONTES.filter(
      (f) => !LIVRES.has(f.arquivo) && /Nunito_|fontFamily:\s*["'`]/.test(f.codigo),
    ).map((f) => f.arquivo);
    expect(fora).toEqual([]);
  });

  test("o Liquid Glass é sempre o claro, e só entra pelo componente `Vidro`", () => {
    const vidro = de(join("componentes", "vidro.tsx"));
    expect(vidro).toMatch(/<GlassView[\s\S]*?colorScheme="light"/);
    const fora = FONTES.filter(
      (f) =>
        f.arquivo !== join("componentes", "vidro.tsx") && /from "expo-glass-effect"/.test(f.codigo),
    ).map((f) => f.arquivo);
    expect(fora).toEqual([]);
  });

  test("a barra de abas flutua e entrega a folga; as abas terminam a rolagem acima dela", () => {
    const barra = de(join("app", "(abas)", "_layout.tsx"));
    expect(barra).toMatch(/<FolgaDaBarra\.Provider value=\{folga\}>/);
    expect(barra).toMatch(/position: "absolute"/);
    expect(barra).toMatch(/<Vidro/);
    for (const aba of [
      join("componentes", "jornada", "hoje.tsx"),
      join("componentes", "jornada", "hoje-pos.tsx"),
      join("app", "(abas)", "amigas.tsx"),
    ])
      expect({ aba, usa: /useFimDaRolagem\(/.test(de(aba)) }).toEqual({ aba, usa: true });
    for (const trilha of [
      join("componentes", "caminho", "caminho.tsx"),
      join("componentes", "caminho", "caminho-pos.tsx"),
    ])
      expect({ trilha, usa: /useFolgaDaBarra\(/.test(de(trilha)) }).toEqual({ trilha, usa: true });
  });

  test("a paleta Amanhecer segura o contraste AA (4,5:1) onde há texto", () => {
    const tema = de(join("tema", "index.ts"));
    const cor = (nome: string) => {
      const m = new RegExp(`\\b${nome}: "(#[0-9a-fA-F]{6})"`).exec(tema);
      if (!m) throw new Error(`o tema não tem a cor ${nome}`);
      return m[1]!;
    };
    const luminancia = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contraste = (a: string, b: string) => {
      const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
      return (claro! + 0.05) / (escuro! + 0.05);
    };
    const pares: [string, string, string][] = [
      ["o texto do botão cheio", "#ffffff", cor("primaria")],
      ["o link na névoa", cor("primariaEscura"), cor("fundo")],
      ["o texto na névoa", cor("texto"), cor("fundo")],
      ["o texto apagado na névoa", cor("textoApagado"), cor("fundo")],
      ["o texto apagado no cartão", cor("textoApagado"), cor("cartao")],
      ["a etiqueta de destaque", cor("textoDestaque"), cor("destaque")],
    ];
    const fracos = pares
      .map(([onde, a, b]) => ({ onde, razao: Math.round(contraste(a, b) * 100) / 100 }))
      .filter((x) => x.razao < 4.5);
    expect(fracos).toEqual([]);
    /* E a paleta antiga — o creme e o vinho do site, a "cara de Claude" — não volta. */
    expect(tema).not.toMatch(/#fffaf6|#ab5e5c|#8f4b49/i);
  });

  test("o número gigante atrás do bebê é enfeite: o leitor de tela não o lê, e a semana segue em texto", () => {
    const topo = de(join("componentes", "jornada", "ceu-do-bebe.tsx"));
    expect(topo).toMatch(/accessibilityElementsHidden/);
    expect(topo).toMatch(/importantForAccessibility="no-hide-descendants"/);
    expect(topo).toMatch(/\{semana\} semanas/);
    /* O bebê é da tela do bebê, com o acompanhamento logo abaixo (13/11/2026). */
    const tela = de(join("componentes", "jornada", "hoje.tsx"));
    expect(tela).toMatch(/<CeuDoBebe/);
    expect(tela).toMatch(/useParalaxe\(\)/);
  });

  test("o céu vivo é a tela inteira do bebê e da entrada, e é só enfeite", () => {
    const ceu = de(join("componentes", "ceu-vivo.tsx"));
    expect(ceu).toMatch(/pointerEvents="none"/);
    expect(ceu).toMatch(/accessibilityElementsHidden/);
    /* Todo laço do céu para com "reduzir movimento". */
    expect(ceu).toMatch(/useMovimentoReduzido\(\)/);
    const entrada = de(join("componentes", "entrada.tsx"));
    expect(entrada).toMatch(/<CeuVivo fase=\{fase\}/);
    /* A entrada não sabe se quem volta está no Modo Cuidado: o céu, sim; o bebê, nunca. */
    for (const arquivo of [
      join("componentes", "entrada.tsx"),
      join("componentes", "marca.tsx"),
      join("app", "(entrada)", "entrar.tsx"),
      join("app", "(entrada)", "cadastro.tsx"),
      join("app", "(entrada)", "esqueci.tsx"),
    ])
      expect({
        arquivo,
        bebe: /arte-do-bebe|ceu-do-bebe|bebe-da-semana/.test(de(arquivo)),
      }).toEqual({
        arquivo,
        bebe: false,
      });
    /* A rolagem da entrada vai até a borda de baixo: presa na área segura, a
       folha branca aparecia cortada numa linha reta sobre o céu. */
    for (const arquivo of ["entrar.tsx", "cadastro.tsx", "esqueci.tsx"])
      expect({
        arquivo,
        cortada: /<Tela bordas=\{\["top", "bottom"\]\}/.test(de(join("app", "(entrada)", arquivo))),
      }).toEqual({ arquivo, cortada: false });
  });

  test("a régua do tempo é um controle ajustável para o leitor de tela, com os dados do semana a semana", () => {
    const topo = de(join("componentes", "jornada", "ceu-do-bebe.tsx"));
    expect(topo).toMatch(/accessibilityRole="adjustable"/);
    expect(topo).toMatch(/name: "increment"/);
    expect(topo).toMatch(/name: "decrement"/);
    /* O que a régua mostra é o que o app já diz de cada semana — sem texto novo. */
    expect(topo).toMatch(/bebeDaSemana\(vista\)/);
    expect(topo).toMatch(/Voltar para a semana de hoje/);
  });

  test("nada acompanha a bolha: sem vídeo, sem disco rosa, sem brilho atrás", () => {
    /* "Vamos tirar esse fundo rosa que veio acompanhando" (o dono, 16/11/2026). A
       bolha viva era um vídeo com o rosa embutido, dentro de um disco rosa. */
    const movimento = de(join("componentes", "movimento.tsx"));
    expect(movimento).not.toMatch(/expo-video|VideoView|ROSA_DO_VIDEO|\.mp4/);
    const fora = FONTES.filter((f) => /ROSA_DO_VIDEO|bolha-\w+\.mp4/.test(f.codigo)).map(
      (f) => f.arquivo,
    );
    expect(fora).toEqual([]);
    /* E a faixa cor-de-rosa das Amigas (uma imagem com o fundo junto) não volta. */
    expect(de(join("app", "(abas)", "amigas.tsx"))).not.toMatch(/amigas\/heroi/);
  });

  test("as três abas flutuam sobre UM céu só", () => {
    const abas = de(join("app", "(abas)", "_layout.tsx"));
    expect(abas).toMatch(/<CeuVivo fase=\{fase\}/);
    expect(abas).toMatch(/<CeuCompartilhado\.Provider/);
    expect(abas).toMatch(/sceneStyle: \{ backgroundColor: "transparent" \}/);
    /* Cada aba lê o céu das abas, e não monta o seu por cima. */
    for (const arquivo of [
      join("componentes", "jornada", "hoje.tsx"),
      join("app", "(abas)", "amigas.tsx"),
      join("app", "(abas)", "jornada.tsx"),
    ])
      expect({ arquivo, le: /useCeuDasAbas\(\)/.test(de(arquivo)) }).toEqual({ arquivo, le: true });
  });

  test("as telas de dentro falam a mesma língua: a pergunta sobre a luz, e o bebê no céu", () => {
    /* A pergunta da aula era um branco chapado, com opções de contorno. */
    const aula = de(join("app", "jornada", "aula.tsx"));
    expect(aula).toMatch(/<FundoDeLuz \/>/);
    expect(aula).toMatch(/\.\.\.sombraFlutuante/);
    /* O "semana a semana" mostrava o bebê num cartão cor-de-rosa. */
    const semanas = de(join("app", "bebe.tsx"));
    expect(semanas).toMatch(/CEUS\[faseDeAgora\(\)\]/);
    expect(semanas).not.toMatch(/fundo=\{cor\.rosaMarca\}/);
    /* O botão desabilitado das atividades não é mais a cor cheia esmaecida. */
    const atividade = de(join("componentes", "jornada", "atividade.tsx"));
    expect(atividade).not.toMatch(/opacity: desabilitado \? 0\.45 : 1/);
  });

  test("a bancada no simulador nunca sai num build de loja", () => {
    /* Duas travas: o pacote de DEV (`__DEV__`) e a variável do Metro. */
    const bancada = de(join("lib", "bancada.ts"));
    expect(bancada).toMatch(/__DEV__ && process\.env\.EXPO_PUBLIC_BANCADA === "1"/);
    const MOBILE = join(RAIZ, "..");
    const quemPodeLigar = [
      ...readdirSync(MOBILE)
        .filter((n) => n.startsWith(".env"))
        .map((n) => join(MOBILE, n)),
      join(MOBILE, "scripts", "testflight.sh"),
      join(MOBILE, "scripts", "verificar.sh"),
      join(MOBILE, "app.json"),
      join(MOBILE, "ios", ".xcode.env"),
      join(MOBILE, "ios", ".xcode.env.local"),
    ].filter((p) => existsSync(p));
    const ligam = quemPodeLigar.filter((p) => /EXPO_PUBLIC_BANCADA/.test(readFileSync(p, "utf8")));
    expect(ligam).toEqual([]);
  });
});
