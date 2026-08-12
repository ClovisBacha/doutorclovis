/**
 * A MEDITAÇÃO — as cinco travas do Nível 1.
 *
 * Cada uma existe por um defeito MEDIDO no navegador (Chromium, iPhone 15 Pro,
 * amostragem a cada 150 ms lendo a matriz de transformação real). Os números
 * estão nos comentários de cada teste, porque um dia alguém vai olhar uma
 * destas regras e achar que é preciosismo.
 *
 * O arquivo lê o FONTE em vez de renderizar: `gestacao-path.tsx` abre com
 * dezenas de `import` de imagem e áudio, e um teste morreria na primeira linha.
 * É a mesma razão de `fala-do-mascote.test.ts`.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const path = readFileSync("src/components/gestacao-path.tsx", "utf8");
const bolha = readFileSync("src/components/bolha.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const conta = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

describe("a primeira inspiração acontece", () => {
  test("a bolha monta pequena e só então cresce", () => {
    /* ⚠️ Medido antes: t=78 ms escala 1,160 (já no máximo) · t=4086 ms escala
       1,160 (nada se moveu) · t=7163 ms escala 1,114 (primeiro movimento, já
       no "Solte"). A fase inicial é "in", então o elemento montava já na escala
       inspirada e a transição não tinha de onde animar. O quadro em que o
       exercício se explica sozinho não existia. */
    expect(path).toContain("const [respiroPronto, setRespiroPronto] = useState(false);");
    expect(path).toContain(
      'const faseVisual: "in" | "hold" | "out" = respiroPronto ? fase : "out";',
    );
    expect(path).toContain("const respiroMs = respiroPronto ? RESPIRO[fase] * 1000 : 0;");
  });

  test("são DOIS requestAnimationFrame, e não um", () => {
    /* Com um só, o React pode não ter PINTADO o quadro pequeno e o navegador
       colapsa as duas escalas numa transição que nunca acontece. */
    const i = path.indexOf("const [respiroPronto");
    const bloco = path.slice(i, i + 900);
    expect((bloco.match(/requestAnimationFrame/g) ?? []).length).toBeGreaterThanOrEqual(2);
    /* E os dois são cancelados no desmonte. */
    expect((bloco.match(/cancelAnimationFrame/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("a bolha e os anéis leem a MESMA fase visual", () => {
    /* Um deles ficando na `fase` crua reintroduziria o defeito só nele — e o
       resultado seria pior que o original: um círculo cheio dentro de um
       vazio. */
    expect(path).toContain("respiro={{ fase: faseVisual, duracaoMs: respiroMs }}");
    expect(path).toContain("const escala = ESCALA_RESPIRO[faseVisual];");
    expect(path).not.toMatch(/--guiado-ms.*RESPIRO\[fase\]/);
  });
});

describe("o anel e a bolha respiram juntos", () => {
  test("a escala do anel vem da tabela da bolha", () => {
    /* Medido antes: anel 1,00 → 1,34, bolha 0,90 → 1,16. Aos 13,1 s a bolha
       tinha andado 26% do percurso e o anel 19% — dois círculos concêntricos
       deslizando um dentro do outro. */
    expect(bolha).toContain("export const ESCALA_RESPIRO");
    expect(path).toContain("ESCALA_RESPIRO");
    /* E nenhuma amplitude própria sobrou no componente. */
    expect(path).not.toContain('fase === "out" ? 1 : 1.34');
  });

  test("as duas usam a mesma função de tempo", () => {
    /* `.dc-guiado` era `cubic-bezier`; `.bolha-respira` é `linear`. */
    const i = css.indexOf(".dc-guiado {");
    expect(i).toBeGreaterThan(-1);
    const regra = css.slice(i, css.indexOf("}", i));
    expect(regra).toContain("linear");
    expect(regra).not.toContain("cubic-bezier");
  });
});

describe("o contador não confunde mais", () => {
  test("o número regressivo saiu, junto com o intervalo que o movia", () => {
    /* Ele contava 4→1, depois 2→1, depois 6→1: três máximos por ciclo. E o
       `setInterval` de 1 s corria contra o `setTimeout` da fase no último
       decremento. Quem conta é o desenho. */
    expect(path).not.toContain("const [tick, setTick]");
    expect(path).not.toContain("setTick");
  });

  test("a palavra da fase continua na tela", () => {
    /* Tirar as duas coisas deixaria quem está de olhos abertos sem nada. */
    expect(path).toContain("const faseLabel =");
    expect(path).toContain("{faseLabel}");
  });
});

describe("o ✕ guarda a sessão", () => {
  test("fechar no meio de uma sessão de mais de um minuto registra", () => {
    /* ⚠️ Nove minutos de meditação sumiam por ela tocar no ✕ do canto superior
       em vez do botão pequeno do rodapé — sem estrela, sem minutos, sem dia de
       sequência. Dois botões que significam a mesma coisa, e o app cobrava
       dela saber a diferença. */
    expect(path).toContain('if (etapa === "sessao" && ciclo >= 5) {');
    expect(path).toContain("encerrarGuardando();");
  });

  test("é o MESMO caminho do botão 'Encerrar por aqui'", () => {
    /* Duas cópias divergiriam no primeiro conserto — e a divergência seria
       invisível, porque as duas telas parecem iguais. */
    expect(path).toContain("function encerrarGuardando()");
    expect(path).toContain("onClick={encerrarGuardando}");
    expect((path.match(/registrarMeditacao\(feitos, null\)/g) ?? []).length).toBe(1);
  });

  test("o corte é o mesmo dos dois botões", () => {
    /* 5 ciclos = um minuto redondo (o ciclo tem 12 s). Abaixo disso não houve
       sessão para guardar. */
    expect(path).toContain("{ciclo >= 5 && (");
  });
});

describe("o humor do fechamento sai do aparelho", () => {
  test("vai para o diário, que é o que o prontuário lê", () => {
    /* `log.humores` era gravado no localStorage e NUNCA lido — nem pela tela
       dela, nem pela do médico. "Ainda ansiosa" cinco sessões seguidas é
       achado clínico numa gestação de alto risco. */
    expect(path).toContain("async function registrarHumorDaMeditacao");
    expect(path).toContain('.from("journal_entries")');
    expect(path).toContain("void registrarHumorDaMeditacao(c.emoji, c.label,");
  });

  test("grava o EMOJI CRU, e o rótulo fica no conteúdo", () => {
    /* ⚠️ `MOOD_VALUE` é indexado por emoji e faz `?? 3`. "😌 Mais calma"
       viraria chave desconhecida e a sessão entraria no gráfico como valor
       neutro, em silêncio. */
    const i = path.indexOf("async function registrarHumorDaMeditacao");
    const bloco = path.slice(i, i + 1200);
    expect(bloco).toContain("mood: emoji,");
    expect(bloco).toMatch(/content: `Meditação de \$\{minutos\} min · \$\{label\}`/);
  });

  test("os cinco emojis do fechamento têm valor no gráfico dela", () => {
    /* Sem isto, três dos cinco entram como "normal" e somem na média. */
    const i = conta.indexOf("const MOOD_VALUE");
    const tabela = conta.slice(i, conta.indexOf("};", i));
    for (const e of ["😌", "🥱", "💛", "😐", "😟"]) {
      expect(tabela).toContain(`"${e}"`);
    }
    const rot = conta.slice(
      conta.indexOf("const MOOD_LABEL"),
      conta.indexOf("};", conta.indexOf("const MOOD_LABEL")),
    );
    for (const e of ["😌", "🥱", "💛", "😐", "😟"]) {
      expect(rot).toContain(`"${e}"`);
    }
  });
});

describe("o Modo Cuidado chegou à meditação", () => {
  /* ⚠️ O PIOR DEFEITO DESTA REVISÃO, e ele estava em produção.
     `careMode` aparecia UMA vez no bloco inteiro da meditação: no portão de
     recompensa do `finish()`. Nada filtrava o conteúdo. Uma paciente que
     acabou de perder a gestação abria a meditação e encontrava o tema
     "Conexão com o bebê" na lista, a fala "Você está segura. Seu bebê está bem
     aqui com você." dentro de "Calma" — que é justamente o tema que alguém em
     sofrimento escolhe — e a rechamada "Você e o bebê, respirando juntos", que
     entra em QUALQUER tema a cada cinco ciclos. */
  const bloco = path.slice(
    path.indexOf("const MEDITACOES"),
    path.indexOf("function MeditationBlock"),
  );

  test("os temas sobre o bebê e o parto NÃO são oferecidos no luto", () => {
    const temas = [...bloco.matchAll(/theme: "([^"]+)"([\s\S]*?)(?=\n {2}\{|\n\];)/g)].map((m) => ({
      nome: m[1],
      passa: /noLuto: true/.test(m[2]),
    }));
    expect(temas.length).toBeGreaterThanOrEqual(8);
    const proibidos = ["Conexão com o bebê", "Coragem pro parto"];
    for (const nome of proibidos) {
      const t = temas.find((x) => x.nome === nome);
      expect(t).toBeTruthy();
      expect(t!.passa).toBe(false);
    }
    /* E sobra o que serve: respirar, calma, descanso, presente, sono. */
    expect(temas.filter((t) => t.passa).length).toBeGreaterThanOrEqual(4);
  });

  test("nenhuma fala do luto cita o bebê, a barriga ou o parto", () => {
    /* Um tema pode passar e o texto dele não — é para isso que existe
       `linesLuto`. O teste lê as falas que o luto realmente ouve. */
    const proibido = /\b(beb[êe]|barriga|parto|filho|nascer|v[íi]nculo|voc[êe]s dois)\b/i;
    const temas = [...bloco.matchAll(/theme: "([^"]+)"([\s\S]*?)(?=\n {2}\{|\n\];)/g)];
    for (const [, nome, corpo] of temas) {
      if (!/noLuto: true/.test(corpo)) continue;
      const usadas =
        /linesLuto:\s*\[([\s\S]*?)\]/.exec(corpo) ?? /lines:\s*\[([\s\S]*?)\]/.exec(corpo);
      for (const f of [...(usadas?.[1] ?? "").matchAll(/"([^"]+)"/g)]) {
        expect({ tema: nome, fala: f[1], cita: proibido.test(f[1]) }).toEqual({
          tema: nome,
          fala: f[1],
          cita: false,
        });
      }
    }
  });

  test("a rechamada do bebê é filtrada — ela entra em qualquer tema", () => {
    expect(path).toContain("careMode ? RECHAMADAS.filter((r) => !/bebê/i.test(r)) : RECHAMADAS");
  });

  test("o índice do tema sugerido nasce dentro da lista JÁ filtrada", () => {
    /* `day % MEDITACOES.length` apontaria para a lista completa, e o tema do
       dia poderia ser um que nem está desenhado. */
    expect(path).toContain("const sugerida = day % temas.length;");
    expect(path).toContain("careMode ? MEDITACOES.filter((m) => m.noLuto) : MEDITACOES");
    expect(path).toContain("{temas.map((m, i) => (");
  });

  test("o fechamento 'Conectada' não é oferecido no luto", () => {
    /* Ele responde "Esse instante também é cuidado com ele. Vocês dois
       sentiram." */
    expect(path).toContain('!careMode || c.label !== "Conectada"');
  });
});
