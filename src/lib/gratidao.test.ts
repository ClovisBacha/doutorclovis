/**
 * A GRATIDÃO — o que precisa estar certo.
 *
 * A atividade era um `textarea` com cinco fichinhas fixas, e nota 5 numa
 * auditoria em que ela perdia para aplicativo de graça. Estes testes cobram o
 * que mudou: a pergunta gira, o dia difícil tem tom próprio, o que ela
 * escreveu volta, e a carta é feita das palavras dela.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  HUMORES_DIFICEIS,
  LINHAS_DA_CARTA,
  MARCOS,
  MINIMO_PARA_CARTA,
  PERGUNTAS,
  PERGUNTAS_DIA_DIFICIL,
  PREFIXO_GRATIDAO,
  cartaAcabouDeNascer,
  cartaDasGratidoes,
  diasEntre,
  ehDiaDificil,
  ehDomingoDeResumo,
  ehGratidao,
  faseDaGratidao,
  gratidaoParaReler,
  gratidoesDaSemana,
  haQuantoTempo,
  falaDaBolha,
  marcoAtingido,
  perguntaDoDia,
  textoDaGratidao,
  type FaseGratidao,
  type TelaDaGratidao,
  type Gratidao,
} from "./gratidao";

const FASES: FaseGratidao[] = ["t1", "t2", "t3", "pos"];
const SEMANA_DA_FASE: Record<FaseGratidao, { semanas: number | null; posParto: boolean }> = {
  t1: { semanas: 8, posParto: false },
  t2: { semanas: 20, posParto: false },
  t3: { semanas: 32, posParto: false },
  pos: { semanas: null, posParto: true },
};

describe("o banco de perguntas", () => {
  test("nenhum id repetido — o id é o que a rotação ancora", () => {
    const ids = [...PERGUNTAS, ...PERGUNTAS_DIA_DIFICIL].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("toda pergunta tem fichinhas — elas são o caminho do dia cansado", () => {
    for (const p of [...PERGUNTAS, ...PERGUNTAS_DIA_DIFICIL]) {
      expect({ id: p.id, ok: p.fichas.length >= 3 && p.texto.length > 12 }).toEqual({
        id: p.id,
        ok: true,
      });
    }
  });

  test("⚠️ nenhuma pergunta cobra, promete clínica ou minimiza", () => {
    /* As mesmas quatro regras do mascote e da meditação. "Vai passar" e "está
       tudo bem" são o que faz alguém fechar o app num dia ruim — e é por isso
       que a carinha `preocupada` saiu do mascote. */
    const proibido =
      /você não (escreveu|fez|conseguiu)|faltou|devia|precisa escrever|vai passar|est[áa] tudo bem|fique (calma|tranquila)|lado positivo|pense positivo/i;
    for (const p of [...PERGUNTAS, ...PERGUNTAS_DIA_DIFICIL]) {
      const tudo = [p.texto, ...p.fichas].join(" · ");
      expect({ id: p.id, proibido: proibido.test(tudo) }).toEqual({ id: p.id, proibido: false });
    }
  });

  test("cada fase tem pergunta de sobra — três semanas até repetir", () => {
    /* O problema que a lista resolve é "nunca muda". Uma fase com cinco
       perguntas voltaria a ser quase isso. */
    for (const f of FASES) {
      const n = PERGUNTAS.filter((p) => !p.fases || p.fases.includes(f)).length;
      expect({ fase: f, suficiente: n >= 20 }).toEqual({ fase: f, suficiente: true });
    }
  });

  test("as de fase são realmente daquela fase, e as universais de todas", () => {
    for (const f of FASES) {
      const o = SEMANA_DA_FASE[f];
      const vistas = new Set<string>();
      for (let dia = 0; dia < 400; dia++) vistas.add(perguntaDoDia({ dia, ...o }).id);
      for (const p of PERGUNTAS) {
        const deveEntrar = !p.fases || p.fases.includes(f);
        expect({ fase: f, id: p.id, entra: vistas.has(p.id) }).toEqual({
          fase: f,
          id: p.id,
          entra: deveEntrar,
        });
      }
    }
  });
});

describe("a pergunta do dia", () => {
  test("⚠️ a rotação é dia % n — dois dias seguidos nunca são iguais", () => {
    /* A armadilha registrada em `frases-do-mascote.ts`: um passo fixo de 7 só
       funciona quando `n` não é múltiplo de 7, e a lista da manhã tinha 14 —
       a paciente via duas frases alternadas para sempre. */
    for (const f of FASES) {
      const o = SEMANA_DA_FASE[f];
      for (let dia = 0; dia < 60; dia++) {
        const a = perguntaDoDia({ dia, ...o }).id;
        const b = perguntaDoDia({ dia: dia + 1, ...o }).id;
        expect({ fase: f, dia, iguais: a === b }).toEqual({ fase: f, dia, iguais: false });
      }
    }
  });

  test("o mesmo dia dá a mesma pergunta", () => {
    expect(perguntaDoDia({ dia: 137, semanas: 20 }).id).toBe(
      perguntaDoDia({ dia: 137, semanas: 20 }).id,
    );
  });

  test("dia negativo ou quebrado não quebra a tela", () => {
    for (const dia of [-5, 0.5, -0.1, 1e6]) {
      expect(perguntaDoDia({ dia, semanas: 20 }).texto.length).toBeGreaterThan(5);
    }
  });

  test("⚠️ no Modo Cuidado nenhuma pergunta cita o bebê", () => {
    /* E o portão lê o campo `bebe`, marcado à mão em cada pergunta — nunca uma
       regex sobre a prosa. A da meditação faz isso e corta por engano as falas
       em que "ele" é o AR ou o DESENHO. */
    for (const f of FASES) {
      const o = SEMANA_DA_FASE[f];
      for (let dia = 0; dia < 200; dia++) {
        const p = perguntaDoDia({ dia, ...o, careMode: true });
        expect({ fase: f, dia, id: p.id, bebe: !!p.bebe }).toEqual({
          fase: f,
          dia,
          id: p.id,
          bebe: false,
        });
      }
    }
  });

  test("as bordas das fases", () => {
    expect(faseDaGratidao(13, false)).toBe("t1");
    expect(faseDaGratidao(14, false)).toBe("t2");
    expect(faseDaGratidao(27, false)).toBe("t2");
    expect(faseDaGratidao(28, false)).toBe("t3");
    expect(faseDaGratidao(20, true)).toBe("pos");
    expect(faseDaGratidao(null, false)).toBe("t2");
  });
});

describe("⚠️ o dia difícil", () => {
  test("humor baixo troca a pergunta inteira", () => {
    const normal = perguntaDoDia({ dia: 3, semanas: 20 });
    const dificil = perguntaDoDia({ dia: 3, semanas: 20, diaDificil: true });
    expect(dificil.id).not.toBe(normal.id);
    expect(PERGUNTAS_DIA_DIFICIL.some((p) => p.id === dificil.id)).toBe(true);
  });

  test("a pergunta do dia difícil nunca pergunta o que foi BOM", () => {
    /* É a diferença entre estreitar e insistir: num dia em que ela apertou o
       SOS, "o que foi bom hoje?" soa surdo. */
    for (const p of PERGUNTAS_DIA_DIFICIL) {
      expect({ id: p.id, insiste: /o que foi bom/i.test(p.texto) }).toEqual({
        id: p.id,
        insiste: false,
      });
    }
  });

  test("os humores difíceis são os de valor 1 e 2 do gráfico dela", () => {
    expect([...HUMORES_DIFICEIS].sort()).toEqual(["🤢", "😟", "😢", "😰"].sort());
    expect(ehDiaDificil(["😊", "😢"])).toBe(true);
    expect(ehDiaDificil(["😊", "🙏", null, undefined])).toBe(false);
    expect(ehDiaDificil([])).toBe(false);
  });
});

describe("o que ela escreveu volta", () => {
  const hoje = new Date("2026-08-13T20:00:00-03:00");
  const dias = (n: number) => new Date(hoje.getTime() - n * 86_400_000).toISOString();

  test("o prefixo do diário é reconhecido e removido", () => {
    expect(ehGratidao(`${PREFIXO_GRATIDAO}o café da manhã`)).toBe(true);
    expect(ehGratidao("Exercício: lombar")).toBe(false);
    expect(ehGratidao(null)).toBe(false);
    expect(textoDaGratidao(`${PREFIXO_GRATIDAO}o café da manhã`)).toBe("o café da manhã");
  });

  test("⚠️ nunca devolve a de hoje nem a de ontem", () => {
    /* Reler o que se acabou de escrever é eco, não releitura — e a frase
       apareceria idêntica logo abaixo da que ela acabou de guardar. */
    const lista: Gratidao[] = [
      { texto: "hoje", quando: dias(0) },
      { texto: "ontem", quando: dias(1) },
      { texto: "anteontem", quando: dias(2) },
    ];
    expect(gratidaoParaReler(lista, hoje)).toBe(null);
  });

  test("prefere o que já ficou longe — é o reencontro que faz valer", () => {
    const lista: Gratidao[] = [
      { texto: "recente", quando: dias(4) },
      { texto: "antiga", quando: dias(40) },
    ];
    expect(gratidaoParaReler(lista, hoje)?.texto).toBe("antiga");
  });

  test("sem nada antigo, serve o que houver com três dias ou mais", () => {
    const lista: Gratidao[] = [
      { texto: "de hoje", quando: dias(0) },
      { texto: "de cinco dias", quando: dias(5) },
    ];
    expect(gratidaoParaReler(lista, hoje)?.texto).toBe("de cinco dias");
  });

  test("a semente gira a escolha, e a lista vazia devolve null", () => {
    const lista: Gratidao[] = [
      { texto: "a", quando: dias(30) },
      { texto: "b", quando: dias(40) },
    ];
    expect(gratidaoParaReler(lista, hoje, 0)?.texto).toBe("a");
    expect(gratidaoParaReler(lista, hoje, 1)?.texto).toBe("b");
    expect(gratidaoParaReler([], hoje)).toBe(null);
  });

  test("a distância é dita em palavra, não em número exato", () => {
    expect(haQuantoTempo(dias(0), hoje)).toBe("hoje");
    expect(haQuantoTempo(dias(1), hoje)).toBe("ontem");
    expect(haQuantoTempo(dias(4), hoje)).toBe("há 4 dias");
    expect(haQuantoTempo(dias(9), hoje)).toBe("há uma semana");
    expect(haQuantoTempo(dias(21), hoje)).toBe("há 3 semanas");
    expect(haQuantoTempo(dias(35), hoje)).toBe("há um mês");
    expect(haQuantoTempo(dias(120), hoje)).toBe("há 4 meses");
    expect(haQuantoTempo("nada disso é data", hoje)).toBe("hoje");
  });

  test("⚠️ a distância é em DIAS DE CALENDÁRIO, não em 24 horas", () => {
    /* 23h de ontem e 1h de hoje são duas horas de diferença e um dia inteiro
       de distância — e é o dia que a paciente reconhece. */
    const madrugada = new Date("2026-08-13T01:00:00-03:00");
    const ontemTarde = new Date("2026-08-12T23:00:00-03:00").toISOString();
    expect(diasEntre(ontemTarde, madrugada)).toBe(1);
  });
});

describe("a carta feita das gratidões dela", () => {
  const g = (n: number): Gratidao[] =>
    Array.from({ length: n }, (_, i) => ({
      texto: `coisa boa número ${i}`,
      quando: new Date(2026, 0, i + 1).toISOString(),
    }));

  test("⚠️ abaixo do mínimo não existe carta", () => {
    /* Uma carta de três linhas seria um cartão de felicitação, e a atividade
       promete ler para o bebê as coisas boas de meses. */
    expect(cartaDasGratidoes(g(MINIMO_PARA_CARTA - 1))).toBe(null);
    expect(cartaDasGratidoes([])).toBe(null);
    expect(cartaDasGratidoes(g(MINIMO_PARA_CARTA))).not.toBe(null);
  });

  test("as linhas são AS PALAVRAS DELA, com abertura e fecho por fora", () => {
    const c = cartaDasGratidoes(g(10))!;
    const dela = c.lines.slice(2, -1);
    expect(dela).toEqual(g(10).map((x) => x.texto));
    expect(c.lines[0]).toContain("Oi, meu amor");
    expect(c.lines[c.lines.length - 1]).toContain("você estava junto");
  });

  test("o nome do bebê entra na abertura quando o app o conhece", () => {
    expect(cartaDasGratidoes(g(10), { nomeDoBebe: "Helena" })!.lines[0]).toBe(
      "Oi, Helena. Deixa eu te contar uma coisa.",
    );
    expect(cartaDasGratidoes(g(10), { nomeDoBebe: "   " })!.lines[0]).toContain("meu amor");
  });

  test("⚠️ com muitas, ela pega o PERÍODO INTEIRO e não as últimas", () => {
    /* Só as recentes dariam a última semana dela — isso é diário, não é a
       história de quem cresceu junto. */
    const c = cartaDasGratidoes(g(100))!;
    const dela = c.lines.slice(2, -1);
    expect(dela.length).toBe(LINHAS_DA_CARTA);
    expect(dela[0]).toBe("coisa boa número 0");
    expect(dela[dela.length - 1]).toBe("coisa boa número 90");
  });

  test("linha comprida é cortada em palavra inteira — é para ler em voz alta", () => {
    const longa = [{ texto: "a".repeat(40) + " " + "b".repeat(200), quando: "2026-01-01" }];
    const c = cartaDasGratidoes([...g(9), ...longa])!;
    const cortada = c.lines.find((l) => l.endsWith("…"));
    expect(cortada).toBeTruthy();
    expect(cortada!.length).toBeLessThanOrEqual(92);
  });

  test("texto vazio ou de duas letras não vira linha da carta", () => {
    const c = cartaDasGratidoes([...g(9), { texto: "  ", quando: "2026-01-01" }])!;
    expect(c.lines.some((l) => l.trim().length < 3)).toBe(false);
  });
});

describe("a tela usa a régua — e não uma segunda cópia dela", () => {
  const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
  const bloco = fonte.slice(
    fonte.indexOf("export function GratitudeBlock("),
    fonte.indexOf('/** Motor dos "jogos do dia"'),
  );

  test("a pergunta e as fichinhas saem de `perguntaDoDia`", () => {
    /* As cinco fichinhas antigas estavam cravadas no JSX. Se voltarem para lá,
       o dono deixa de conseguir editá-las. */
    expect(bloco).toContain("perguntaDoDia({");
    expect(bloco).toContain("pergunta.fichas.map");
    expect(bloco).not.toContain('"Meu bebê mexeu 🦶"');
  });

  test("⚠️ o prefixo e o emoji do diário vêm do módulo", () => {
    /* `Gratidão: ` escrito à mão no insert e lido por `ehGratidao` no módulo
       são duas verdades que divergem no primeiro conserto — e a divergência
       seria silenciosa: a linha grava e some da lista dela. */
    expect(bloco).toContain("${PREFIXO_GRATIDAO}${text.trim()}");
    expect(bloco).toContain("mood: HUMOR_GRATIDAO");
  });

  test("⚠️ a transcrição cai no CAMPO, nunca direto no diário", () => {
    const trecho = bloco.slice(bloco.indexOf("async function pararEEnviar"));
    expect(trecho.slice(0, trecho.indexOf("async function save"))).toContain("setText((t) =>");
    /* E o botão de guardar fica travado enquanto o microfone está aberto ou a
       transcrição não voltou — senão ela salva um texto pela metade. */
    expect(bloco.replace(/\s+/g, " ")).toContain("saving || transcrevendo || gravando");
  });

  test("⚠️ o dia difícil sai do humor de HOJE, e o Modo Cuidado é repassado", () => {
    expect(bloco).toContain("ehDiaDificil(");
    expect(bloco).toContain("new Date().setHours(0, 0, 0, 0)");
    expect(bloco).toContain("careMode,");
  });

  test("a carta das gratidões existe no bloco do Bebê, e fora do luto", () => {
    const bonding = fonte.slice(
      fonte.indexOf("function BondingBlock("),
      fonte.indexOf("export function GratitudeBlock("),
    );
    expect(bonding).toContain("cartaDasGratidoes(");
    /* Sem o espaço em branco: o formatador quebra o ternário em três linhas
       quando o comentário acima cresce, e um teste que dependesse disso
       falharia por causa de um `bun run format`. */
    expect(bonding.replace(/\s+/g, " ")).toContain("careMode || !minhasGratidoes ? null");
    /* CRESCENTE: a carta conta a história na ordem em que aconteceu. */
    expect(bonding).toContain('.order("created_at", { ascending: true })');
  });
});

describe("⚠️ o bebê bolha como porta-voz desta tela", () => {
  test("ele NÃO repete a pergunta do dia", () => {
    /* A pergunta é o título grande. Dois textos dizendo a mesma coisa fariam
       da personagem um enfeite — e ela é a voz do app. */
    const perguntas = new Set([...PERGUNTAS, ...PERGUNTAS_DIA_DIFICIL].map((p) => p.texto));
    for (const tela of ["escrever", "guardado", "lista"] as TelaDaGratidao[]) {
      for (const total of [0, 1, 5, 42]) {
        for (const dificil of [false, true]) {
          const f = falaDaBolha({ tela, total, diaDificil: dificil });
          expect({ tela, total, repete: perguntas.has(f) }).toEqual({
            tela,
            total,
            repete: false,
          });
        }
      }
    }
  });

  test("ele entrega o CONTADOR, que era rótulo seco", () => {
    expect(falaDaBolha({ tela: "escrever", total: 12 })).toContain("12 coisas boas");
    expect(falaDaBolha({ tela: "escrever", total: 1 })).toContain("1 coisa boa");
    expect(falaDaBolha({ tela: "guardado", total: 13 })).toContain("13 coisas boas");
  });

  test("a primeira vez explica pra onde vai — ninguém explicava", () => {
    expect(falaDaBolha({ tela: "escrever", total: 0 })).toContain("guardo");
    expect(falaDaBolha({ tela: "guardado", total: 1 })).toContain("primeira");
  });

  test("⚠️ ele ANUNCIA a releitura quando ela existe, e cala quando não", () => {
    const com = falaDaBolha({ tela: "guardado", total: 9, temReleitura: true });
    const sem = falaDaBolha({ tela: "guardado", total: 9, temReleitura: false });
    expect(com).toContain("me contou antes");
    expect(sem).not.toContain("me contou antes");
  });

  test("⚠️ no dia difícil ele diminui o pedido — nunca consola", () => {
    /* Consolo é o que faz alguém fechar o app num dia ruim, e é a mesma razão
       pela qual a carinha `preocupada` saiu da personagem. */
    const f = falaDaBolha({ tela: "escrever", total: 8, diaDificil: true });
    expect(f).toContain("pequeno");
    expect(
      /vai passar|est[áa] tudo bem|fique (calma|tranquila)|lado positivo|amanhã melhora/i.test(f),
    ).toBe(false);
  });

  test("nenhuma fala cobra, e todas cabem num balão", () => {
    const proibido = /você não (escreveu|fez|veio)|faltou|devia|precisa (escrever|voltar)|há dias/i;
    for (const tela of ["escrever", "guardado", "lista", "resumo"] as TelaDaGratidao[]) {
      for (const total of [0, 1, 2, 17, 300]) {
        for (const temReleitura of [false, true]) {
          const f = falaDaBolha({ tela, total, temReleitura });
          expect({ tela, total, ok: f.length > 8 && f.length <= 64 && !proibido.test(f) }).toEqual({
            tela,
            total,
            ok: true,
          });
        }
      }
    }
  });

  test("⚠️ e cabem mesmo com marco ou período aplicados", () => {
    const proibido = /você não (escreveu|fez|veio)|faltou|devia|precisa (escrever|voltar)|há dias/i;
    for (const total of [10, 50, 100, 365]) {
      const f = falaDaBolha({ tela: "guardado", total, marco: total });
      expect({ total, ok: f.length > 8 && f.length <= 64 && !proibido.test(f) }).toEqual({
        total,
        ok: true,
      });
    }
    for (const periodo of ["madrugada", "manha", "tarde", "noite"] as const) {
      for (const total of [1, 300]) {
        const f = falaDaBolha({ tela: "escrever", total, periodo });
        expect({ periodo, total, ok: f.length > 8 && f.length <= 64 && !proibido.test(f) }).toEqual(
          { periodo, total, ok: true },
        );
      }
    }
  });

  test("⚠️ a CARA sai de `humorDaJornada`, nunca de um if local", () => {
    /* É lá que mora o portão de Modo Cuidado. Uma segunda régua faria carinha
       festiva aparecer na tela de quem perdeu a gestação. */
    const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
    const bloco = fonte.slice(
      fonte.indexOf("function BolhaComBalao("),
      fonte.indexOf("/* ══════════════════ Gratidão do dia"),
    );
    expect(bloco).toContain("humorDaJornada({ comemorando, careMode })");
    expect(bloco).not.toMatch(/humor=\{"(comemorando|feliz|orgulhosa)"\}/);
    expect(bloco).toContain("careMode={careMode}");
  });
});

describe("⚠️ os marcos redondos", () => {
  test("só os números da lista contam como marco", () => {
    for (const m of MARCOS) expect(marcoAtingido(m)).toBe(m);
    for (const n of [9, 11, 24, 26, 49, 51, 99, 101, 0, 1]) expect(marcoAtingido(n)).toBe(null);
  });

  test("⚠️ os degraus crescem — não são lineares", () => {
    /* Mesma forma de `nivelDaSequencia`: o salto precisa aumentar, senão o
       próximo marco não surpreende mais que o anterior. */
    const distancias = MARCOS.map((m, i) => (i === 0 ? m : m - MARCOS[i - 1]));
    for (let i = 1; i < distancias.length; i++) {
      expect(distancias[i]).toBeGreaterThanOrEqual(distancias[i - 1]);
    }
  });

  test("o balão prioriza o marco sobre a releitura", () => {
    /* O cartão de releitura continua aparecendo embaixo de qualquer jeito —
       os dois não disputam o mesmo espaço na tela, só o balão. */
    const f = falaDaBolha({ tela: "guardado", total: 50, marco: 50, temReleitura: true });
    expect(f).toContain("50");
    expect(f).not.toContain("antes");
  });

  test("sem marco, o comportamento de antes continua intacto", () => {
    expect(falaDaBolha({ tela: "guardado", total: 12 })).not.toContain("redondo");
  });
});

describe("⚠️ ele muda de assunto pela hora do dia", () => {
  test("madrugada é tratada à parte — companhia, não contador", () => {
    /* A mesma exceção que `humorDaJornada` faz para a "surpresa" da
       madrugada: quem está acordada às 3h não precisa de mais ninguém
       contando número pra ela. */
    const f = falaDaBolha({ tela: "escrever", total: 12, periodo: "madrugada" });
    expect(f).not.toContain("12");
    expect(f.length).toBeGreaterThan(8);
  });

  test("manhã, tarde e noite mudam a abertura, mas o contador continua", () => {
    for (const periodo of ["manha", "tarde", "noite"] as const) {
      const f = falaDaBolha({ tela: "escrever", total: 7, periodo });
      expect(f).toContain("7 coisas boas");
    }
  });

  test("⚠️ sem período, a frase é exatamente a de antes — nada quebrou", () => {
    expect(falaDaBolha({ tela: "escrever", total: 7 })).toBe("Você já me contou 7 coisas boas.");
  });

  test("dia difícil e primeira vez continuam vencendo o período", () => {
    /* As duas já são a coisa mais importante a dizer naquele instante —
       casar hora do dia com elas só alongaria a frase à toa. */
    expect(falaDaBolha({ tela: "escrever", total: 5, diaDificil: true, periodo: "noite" })).toBe(
      falaDaBolha({ tela: "escrever", total: 5, diaDificil: true }),
    );
    expect(falaDaBolha({ tela: "escrever", total: 0, periodo: "manha" })).toBe(
      falaDaBolha({ tela: "escrever", total: 0 }),
    );
  });
});

describe("⚠️ o resumo de domingo", () => {
  const domingo = new Date("2026-08-16T10:00:00-03:00"); // é domingo
  const segunda = new Date("2026-08-17T10:00:00-03:00");
  const dias = (base: Date, n: number) => new Date(base.getTime() - n * 86_400_000).toISOString();

  test("as gratidões da semana são uma janela corrida de 7 dias", () => {
    const lista: Gratidao[] = [
      { texto: "hoje", quando: dias(domingo, 0) },
      { texto: "seis dias atrás", quando: dias(domingo, 6) },
      { texto: "sete dias atrás", quando: dias(domingo, 7) },
    ];
    const semana = gratidoesDaSemana(lista, domingo);
    expect(semana.map((g) => g.texto)).toEqual(["hoje", "seis dias atrás"]);
  });

  test("só é domingo de resumo com duas gratidões OU MAIS na semana", () => {
    const uma: Gratidao[] = [{ texto: "a", quando: dias(domingo, 1) }];
    const duas: Gratidao[] = [...uma, { texto: "b", quando: dias(domingo, 2) }];
    expect(ehDomingoDeResumo(domingo, uma)).toBe(false);
    expect(ehDomingoDeResumo(domingo, duas)).toBe(true);
  });

  test("⚠️ nunca fora de domingo, mesmo com gratidões de sobra", () => {
    const duas: Gratidao[] = [
      { texto: "a", quando: dias(segunda, 1) },
      { texto: "b", quando: dias(segunda, 2) },
    ];
    expect(ehDomingoDeResumo(segunda, duas)).toBe(false);
  });

  test("a fala do resumo conta a semana, não a gestação inteira", () => {
    const f = falaDaBolha({ tela: "resumo", total: 3 });
    expect(f).toContain("Essa semana");
    expect(f).toContain("3 coisas boas");
  });

  test("semana vazia não quebra a fala", () => {
    expect(falaDaBolha({ tela: "resumo", total: 0 }).length).toBeGreaterThan(8);
  });
});

describe("⚠️ a carta deixou de ficar escondida", () => {
  test("nasce exatamente na oitava — nunca antes, nunca duas vezes", () => {
    for (let n = 0; n < 12; n++) {
      expect({ n, nasceu: cartaAcabouDeNascer(n) }).toEqual({
        n,
        nasceu: n === MINIMO_PARA_CARTA,
      });
    }
  });

  test("quem já tinha mais que o mínimo antes deste recurso não vê o anúncio retroativo", () => {
    /* Mesmo raciocínio de `marcoAtingido`: comparar por igualdade só funciona
       porque o total sobe +1 por guardada — não dá pra comemorar uma
       travessia que já aconteceu em silêncio. */
    expect(cartaAcabouDeNascer(50)).toBe(false);
    expect(cartaAcabouDeNascer(9)).toBe(false);
  });
});

describe("⚠️ a tela anuncia a carta, e nunca no luto", () => {
  const fonte = readFileSync("src/components/gestacao-path.tsx", "utf8");
  const bloco = fonte.slice(
    fonte.indexOf("export function GratitudeBlock("),
    fonte.indexOf('/** Motor dos "jogos do dia"'),
  );

  test("o cartão só nasce no instante certo — `cartaAcabouDeNascer`, não um cálculo local", () => {
    expect(bloco).toContain("cartaAcabouDeNascer(novoTotal)");
    expect(bloco).toContain("setCartaNova(!careMode && cartaAcabouDeNascer(novoTotal))");
  });

  test("⚠️ o RENDER confere `!careMode` de novo — a bancada prova por quê", () => {
    /* `save()` já não deixa `cartaNova` nascer `true` no luto — mas a
       bancada (`?carta=1&luto=1`) força o estado direto, por cima desse
       portão, e foi assim que o cartão apareceu numa captura de tela em
       Modo Cuidado. A checagem no render é o que fecha esse caminho. */
    expect(bloco).toContain("{cartaNova && !careMode && (");
  });

  test("o link persistente não duplica o anúncio, e some no luto", () => {
    expect(bloco).toContain(
      "{!cartaNova && total >= MINIMO_PARA_CARTA && aoIrParaBebe && !careMode && (",
    );
  });

  test("o botão só existe quando há para onde ir — a bancada não quebra sem ele", () => {
    expect(bloco).toContain("{aoIrParaBebe && (");
  });
});
