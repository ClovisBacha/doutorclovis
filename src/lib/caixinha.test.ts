import { describe, expect, test } from "bun:test";
import {
  decidirPergunta,
  decidirResposta,
  PERGUNTAS_POR_DIA,
  PERGUNTAS_POR_PESSOA,
  recadoDaResposta,
  recadoDoVeredicto,
  type FatosDaPergunta,
} from "./caixinha";

/**
 * ⚠️ **ESTE ARQUIVO EXISTE PORQUE O ANTERIOR MENTIA.**
 *
 * Uma auditoria por mutação rodou 88 quebras contra este repositório e DEZ
 * asserções minhas passaram verdes — todas no arquivo que abria dizendo "todas
 * foram conferidas por mutação". Elas liam o FONTE, e o fonte engana de quatro
 * jeitos que agora estão documentados em `caixinha.ts`.
 *
 * Aqui a régua é CHAMADA. Apagar, mover ou inverter qualquer guarda muda o
 * resultado — não a posição de uma string.
 */

const PODE: FatosDaPergunta = {
  souADona: false,
  donaExiste: true,
  donaEmCuidado: false,
  donaAceita: true,
  alcancoOPerfil: true,
  bloqueadas: false,
  mandeiHoje: 0,
  mandeiParaElaHoje: 0,
};

describe("o caminho feliz", () => {
  test("pergunta comum entra na caixa", () => {
    expect(decidirPergunta(PODE, "Como você escolheu o nome?")).toEqual({
      pode: true,
      desfecho: "publicavel",
    });
  });
});

describe("⚠️ as seis portas fechadas — cada uma foi um defeito", () => {
  const casos: [string, Partial<FatosDaPergunta>][] = [
    ["não dá para perguntar a si mesma", { souADona: true }],
    ["conta que não existe", { donaExiste: false }],
    ["Modo Cuidado", { donaEmCuidado: true }],
    ["caixa fechada", { donaAceita: false }],
    ["bloqueadas em qualquer sentido", { bloqueadas: true }],
    ["perfil que eu não alcanço", { alcancoOPerfil: false }],
  ];
  for (const [nome, mudanca] of casos) {
    test(nome, () => {
      expect(decidirPergunta({ ...PODE, ...mudanca }, "oi, tudo bem?")).toEqual({
        pode: false,
        motivo: "indisponivel",
      });
    });
  }

  test("⚠️ e as SEIS respondem a MESMA coisa", () => {
    /* Distinguir entregaria, por eliminação, que ela está em Modo Cuidado —
       contando a perda dela a um estranho. */
    const motivos = casos.map(
      ([, m]) => (decidirPergunta({ ...PODE, ...m }, "oi") as { motivo: string }).motivo,
    );
    expect(new Set(motivos).size).toBe(1);
  });

  test("⚠️ o ALCANCE fecha ANTES da triagem, e não depois", () => {
    /* `perguntar` não conferia `alcancaOPerfil`, e `verPerfil` conferia — quem
       tivesse o uuid (e ele viaja em toda reação, todo story visto, todo pedido
       de seguir) escrevia na caixa de um perfil FECHADO, anonimamente, quantas
       vezes quisesse. Fechar o perfil não fechava nada.
       Prova: mesmo um texto de EMERGÊNCIA é recusado — se a triagem viesse
       antes, ela responderia sobre o texto em vez da porta. */
    expect(decidirPergunta({ ...PODE, alcancoOPerfil: false }, "estou sangrando muito")).toEqual({
      pode: false,
      motivo: "indisponivel",
    });
  });
});

describe("⚠️ os dois tetos, e o segundo é o que importa", () => {
  test("o teto global segura o spam", () => {
    expect(decidirPergunta({ ...PODE, mandeiHoje: PERGUNTAS_POR_DIA }, "oi")).toEqual({
      pode: false,
      motivo: "teto",
    });
    expect(decidirPergunta({ ...PODE, mandeiHoje: PERGUNTAS_POR_DIA - 1 }, "oi").pode).toBe(true);
  });

  test("⚠️ e o teto POR PESSOA segura o assédio dirigido", () => {
    /* O teto global não protegia contra assédio: as dez podiam ir todas para a
       mesma pessoa. Numa caixa anônima, dez mensagens de um estranho num dia é
       o recurso virando o problema. */
    expect(PERGUNTAS_POR_PESSOA).toBeLessThan(PERGUNTAS_POR_DIA);
    expect(decidirPergunta({ ...PODE, mandeiParaElaHoje: PERGUNTAS_POR_PESSOA }, "oi")).toEqual({
      pode: false,
      motivo: "teto_pessoa",
    });
  });

  test("⚠️ o teto conta TODA TENTATIVA, inclusive a clínica", () => {
    /* O teto contava só o que entrava na caixa, e o ramo `clinica` escrevia em
       `doctor_questions` sem limite — com `posso tomar` produzindo `clinica`.
       Um script mandando isso quatro mil vezes entupia a fila do consultório, e
       as dúvidas reais afundavam nela. */
    expect(
      decidirPergunta({ ...PODE, mandeiHoje: PERGUNTAS_POR_DIA }, "posso tomar dipirona?"),
    ).toEqual({ pode: false, motivo: "teto" });
  });
});

describe("a triagem decide o DESTINO, não o direito", () => {
  test("os três desfechos passam pela régua clínica", () => {
    expect(decidirPergunta(PODE, "estou sangrando muito")).toEqual({
      pode: true,
      desfecho: "emergencia",
    });
    expect(decidirPergunta(PODE, "posso tomar dipirona?")).toEqual({
      pode: true,
      desfecho: "clinica",
    });
    expect(decidirPergunta(PODE, "vocês fizeram chá de bebê?")).toEqual({
      pode: true,
      desfecho: "publicavel",
    });
  });

  test("vazio não estoura", () => {
    expect(decidirPergunta(PODE, "   ")).toEqual({ pode: false, motivo: "vazio" });
  });
});

describe("a resposta — o texto perigoso", () => {
  const DONA = {
    souADona: true,
    euEmCuidado: false,
    perguntaExiste: true,
    jaRespondida: false,
    arquivada: false,
  };

  test("resposta comum publica", () => {
    expect(decidirResposta(DONA, "Foi na 20ª semana, num sábado 💛")).toEqual({ pode: true });
  });

  test("⚠️ a régua clínica roda AQUI TAMBÉM — é este o texto perigoso", () => {
    /* A pergunta é de quem não sabe; a resposta é de quem afirma, e vai para
       todo mundo de uma vez. */
    expect(decidirResposta(DONA, "no meu caso eu não fui e deu tudo certo")).toEqual({
      pode: false,
      motivo: "clinica",
    });
    expect(decidirResposta(DONA, "comigo foi assim, não precisa ir ao pronto-socorro")).toEqual({
      pode: false,
      motivo: "clinica",
    });
  });

  test("⚠️ responder pergunta ALHEIA é recusado", () => {
    /* O id vem do cliente. Sem o recorte, a pergunta anônima de outra mulher
       seria publicada como post desta paciente. */
    expect(decidirResposta({ ...DONA, souADona: false }, "oi")).toEqual({
      pode: false,
      motivo: "indisponivel",
    });
  });

  test("Modo Cuidado, arquivada e já respondida", () => {
    expect(decidirResposta({ ...DONA, euEmCuidado: true }, "oi")).toEqual({
      pode: false,
      motivo: "indisponivel",
    });
    expect(decidirResposta({ ...DONA, arquivada: true }, "oi")).toEqual({
      pode: false,
      motivo: "indisponivel",
    });
    expect(decidirResposta({ ...DONA, jaRespondida: true }, "oi")).toEqual({
      pode: false,
      motivo: "respondida",
    });
  });
});

describe("⚠️ o recado NÃO ensina quais palavras passam", () => {
  test("nem no pedido, nem na resposta", () => {
    const textos = [
      recadoDoVeredicto({ pode: true, desfecho: "publicavel" }),
      recadoDoVeredicto({ pode: true, desfecho: "clinica" }),
      recadoDoVeredicto({ pode: true, desfecho: "emergencia" }),
      recadoDoVeredicto({ pode: false, motivo: "teto" }),
      recadoDoVeredicto({ pode: false, motivo: "teto_pessoa" }),
      recadoDaResposta({ pode: false, motivo: "clinica" }),
      recadoDaResposta({ pode: false, motivo: "emergencia" }),
    ];
    for (const t of textos) {
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toMatch(/palavra|termo|cont(é|e)m|proibid/i);
    }
    expect(recadoDoVeredicto({ pode: true, desfecho: "clinica" })).toContain("médico");
    expect(recadoDoVeredicto({ pode: true, desfecho: "emergencia" })).toContain("agora");
    expect(recadoDaResposta({ pode: false, motivo: "emergencia" })).toContain("SOS");
  });

  test("⚠️ e a porta fechada NÃO diz que a pessoa te bloqueou nem que está em luto", () => {
    expect(recadoDoVeredicto({ pode: false, motivo: "indisponivel" })).not.toMatch(
      /bloque|luto|cuidado|fechad/i,
    );
  });
});
