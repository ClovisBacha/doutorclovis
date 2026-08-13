import { describe, expect, test } from "bun:test";
import {
  CARTAS,
  poolDaFase,
  cartaDoDia,
  comNome,
  cartaComNome,
  registrarLeitura,
  ultimaLeitura,
  fraseDeUltimaLeitura,
  falaDaBolhaNaCarta,
} from "./cartas-do-bebe";

describe("o banco de cartas", () => {
  test("são trinta", () => {
    expect(CARTAS.length).toBe(30);
  });

  test("ids são únicos", () => {
    const ids = CARTAS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("toda carta tem pelo menos quatro linhas", () => {
    for (const c of CARTAS) expect(c.lines.length).toBeGreaterThanOrEqual(4);
  });
});

describe("⚠️ o tempo verbal não pode vazar entre gestação e pós-parto", () => {
  const gestacao = CARTAS.filter((c) => !c.fases?.includes("pos"));
  const pos = CARTAS.filter((c) => c.fases?.includes("pos"));

  test("nenhuma carta de pós-parto promete um nascimento futuro", () => {
    const proibidas = [
      /quando você nascer/i,
      /ainda não te vi/i,
      /ainda não nos vimos/i,
      /a gente ainda não se viu/i,
      /vou te conhecer/i,
    ];
    for (const c of pos) {
      const texto = [c.title, ...c.lines].join(" ");
      for (const re of proibidas) {
        expect(texto).not.toMatch(re);
      }
    }
  });

  test("nenhuma carta de gestação usa tempo de pós-parto ('desde que você nasceu' etc.)", () => {
    const proibidas = [/desde que você (nasceu|chegou)/i, /seu primeiro banho/i, /seu cheirinho/i];
    for (const c of gestacao) {
      const texto = [c.title, ...c.lines].join(" ");
      for (const re of proibidas) {
        expect(texto).not.toMatch(re);
      }
    }
  });

  test("cartas de pós-parto são SEMPRE marcadas — nunca herdam por omissão", () => {
    // poolDaFase("pos") só pode conter cartas com fases:["pos"] explícito.
    for (const c of poolDaFase("pos")) {
      expect(c.fases).toContain("pos");
    }
  });
});

describe("nenhuma carta promete clínica ou consola com frase vazia", () => {
  const proibidas = [
    /vai passar/i,
    /está tudo bem/i,
    /vai dar tudo certo/i,
    /não vai doer/i,
    /vai ser rápido/i,
    /vai ser tranquilo/i,
  ];

  test("em nenhuma das trinta", () => {
    for (const c of CARTAS) {
      const texto = [c.title, ...c.lines].join(" ");
      for (const re of proibidas) {
        expect(texto).not.toMatch(re);
      }
    }
  });
});

describe("poolDaFase", () => {
  test("t1: as gerais + as três de primeiro trimestre", () => {
    expect(poolDaFase("t1").length).toBe(13);
    expect(poolDaFase("t1").every((c) => !c.fases || c.fases.includes("t1"))).toBe(true);
  });

  test("t2: as gerais + as três de segundo trimestre", () => {
    expect(poolDaFase("t2").length).toBe(13);
  });

  test("t3: as gerais + as quatro da reta final", () => {
    expect(poolDaFase("t3").length).toBe(14);
  });

  test("pos: só as dez marcadas — nada geral, nada de t1/t2/t3", () => {
    const pool = poolDaFase("pos");
    expect(pool.length).toBe(10);
    expect(pool.every((c) => c.fases?.length === 1 && c.fases[0] === "pos")).toBe(true);
  });
});

describe("cartaDoDia", () => {
  test("nunca sai do poço da fase", () => {
    for (let dia = 0; dia < 40; dia++) {
      const c = cartaDoDia({ dia, semanas: 20 });
      expect(poolDaFase("t2")).toContain(c);
    }
  });

  test("pós-parto nunca devolve carta pré-natal", () => {
    for (let dia = 0; dia < 90; dia++) {
      const c = cartaDoDia({ dia, posParto: true });
      expect(c.fases).toContain("pos");
    }
  });

  test("é determinística: mesmo dia e fase, mesma carta", () => {
    const a = cartaDoDia({ dia: 45, semanas: 30 });
    const b = cartaDoDia({ dia: 45, semanas: 30 });
    expect(a.id).toBe(b.id);
  });

  test("32ª semana escolhe do poço de t3, não de t2", () => {
    const c = cartaDoDia({ dia: 0, semanas: 32 });
    expect(poolDaFase("t3")).toContain(c);
  });
});

describe("comNome", () => {
  test("substitui {bebe} pelo nome", () => {
    expect(comNome("Oi, {bebe}.", "Helena")).toBe("Oi, Helena.");
  });

  test("sem nome, cai em 'meu amor'", () => {
    expect(comNome("Oi, {bebe}.", null)).toBe("Oi, meu amor.");
    expect(comNome("Oi, {bebe}.", "")).toBe("Oi, meu amor.");
    expect(comNome("Oi, {bebe}.", "   ")).toBe("Oi, meu amor.");
  });

  test("texto sem o token não muda", () => {
    expect(comNome("Sem token aqui.", "Helena")).toBe("Sem token aqui.");
  });

  test("cartaComNome aplica ao título e a todas as linhas", () => {
    const carta = {
      id: "x",
      title: "Oi, {bebe}",
      emoji: "💛",
      lines: ["Linha 1 {bebe}", "Linha 2"],
    };
    const com = cartaComNome(carta, "Helena");
    expect(com.title).toBe("Oi, Helena");
    expect(com.lines[0]).toBe("Linha 1 Helena");
    expect(com.lines[1]).toBe("Linha 2");
  });
});

describe("o rastro de leitura", () => {
  test("nunca lida: null", () => {
    expect(ultimaLeitura({}, "g-ainda-nao-vi")).toBeNull();
  });

  test("registrar grava o instante", () => {
    const agora = new Date("2026-08-13T10:00:00Z");
    const leituras = registrarLeitura({}, "g-ainda-nao-vi", agora);
    expect(ultimaLeitura(leituras, "g-ainda-nao-vi")).toBe(agora.toISOString());
  });

  test("registrar não apaga o rastro de outras cartas", () => {
    const agora = new Date("2026-08-13T10:00:00Z");
    const leituras = registrarLeitura({ "outra-carta": "2026-01-01T00:00:00Z" }, "g-casa", agora);
    expect(ultimaLeitura(leituras, "outra-carta")).toBe("2026-01-01T00:00:00Z");
  });

  test("fraseDeUltimaLeitura: null sem histórico", () => {
    expect(fraseDeUltimaLeitura(null, new Date())).toBeNull();
  });

  test("fraseDeUltimaLeitura: null se foi hoje mesmo (evita eco)", () => {
    const agora = new Date("2026-08-13T18:00:00Z");
    const hoje = new Date("2026-08-13T09:00:00Z").toISOString();
    expect(fraseDeUltimaLeitura(hoje, agora)).toBeNull();
  });

  test("fraseDeUltimaLeitura: com dias de distância, menciona 'há'", () => {
    const agora = new Date("2026-08-13T12:00:00Z");
    const duasSemanasAtras = new Date("2026-07-30T12:00:00Z").toISOString();
    expect(fraseDeUltimaLeitura(duasSemanasAtras, agora)).toMatch(/há/);
  });
});

describe("falaDaBolhaNaCarta", () => {
  test("done: fala de encerramento", () => {
    expect(falaDaBolhaNaCarta({ tela: "done" })).toMatch(/guardei/i);
  });

  test("lendo as gratidões dela: fala própria", () => {
    const fala = falaDaBolhaNaCarta({ tela: "intro", lendoAsDelas: true });
    expect(fala).toMatch(/suas/i);
  });

  test("com rastro de leitura, convida a ler de novo", () => {
    const fala = falaDaBolhaNaCarta({
      tela: "intro",
      fraseDeLeitura: "Você leu esta carta há 2 semanas.",
    });
    expect(fala).toContain("Você leu esta carta há 2 semanas.");
    expect(fala).toMatch(/de novo/);
  });

  test("madrugada e noite têm abertura própria", () => {
    expect(falaDaBolhaNaCarta({ tela: "intro", periodo: "madrugada" })).toMatch(/madrugada/);
    expect(falaDaBolhaNaCarta({ tela: "intro", periodo: "noite" })).toMatch(/dormir/);
  });

  test("nunca cobra nem promete clínica", () => {
    const falas = [
      falaDaBolhaNaCarta({ tela: "intro" }),
      falaDaBolhaNaCarta({ tela: "done" }),
      falaDaBolhaNaCarta({ tela: "intro", periodo: "manha" }),
    ];
    for (const f of falas) {
      expect(f).not.toMatch(/você (não|deveria|precisa)/i);
      expect(f).not.toMatch(/vai passar|está tudo bem/i);
    }
  });
});
