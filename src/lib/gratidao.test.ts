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
  MINIMO_PARA_CARTA,
  PERGUNTAS,
  PERGUNTAS_DIA_DIFICIL,
  PREFIXO_GRATIDAO,
  cartaDasGratidoes,
  diasEntre,
  ehDiaDificil,
  ehGratidao,
  faseDaGratidao,
  gratidaoParaReler,
  haQuantoTempo,
  perguntaDoDia,
  textoDaGratidao,
  type FaseGratidao,
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
