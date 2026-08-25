import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BANDEIRA_VERMELHA,
  LIMITE_DA_PERGUNTA,
  ENTREGA_DE_CONDUTA,
  PEDIDO_DE_CONDUTA,
  PERGUNTAS_POR_DIA,
  recadoDoDesfecho,
  SINTOMA_EM_PRIMEIRA_PESSOA,
  temTermoClinicoAlemDaAbertura,
  TERMOS_CLINICOS,
  triarTexto,
} from "./pergunta-clinica";

describe("a bandeira vermelha vence tudo", () => {
  test("os sintomas que abrem a Central de Emergência", () => {
    for (const t of [
      "estou sangrando muito",
      "o bebê não mexe desde ontem",
      "minha bolsa rompeu",
      "estou com visão embaçada",
      "acho que vou desmaiar, apaguei agora",
      "quero morrer",
    ]) {
      expect(triarTexto(t)).toBe("emergencia");
    }
  });

  test("⚠️ vence mesmo dentro de uma frase leve", () => {
    // "Aparecendo, torna a conversa clínica independentemente de tudo mais que
    // esteja escrito junto."
    expect(triarTexto("oi meninas, tudo bem? to sangrando um pouquinho, é normal?")).toBe(
      "emergencia",
    );
  });
});

describe("⚠️ a ENTREGA DE CONDUTA — o caso que fechou os comentários", () => {
  test('"comigo foi assim, não precisa ir ao pronto-socorro" não é publicável', () => {
    // Esta frase não tem bandeira vermelha NENHUMA e é a mais perigosa que uma
    // paciente pode escrever para outra. É forma, não vocabulário.
    const t = "comigo foi assim, não precisa ir ao pronto-socorro";
    expect(BANDEIRA_VERMELHA.test(t)).toBe(false);
    expect(triarTexto(t)).toBe("clinica");
  });

  test("⚠️ e as VARIANTES NATURAIS dela, que passavam todas", () => {
    /* Medido: a primeira régua pegava só a forma exata acima. Estas cinco são a
       mesma frase parafraseada — as que uma gestante de verdade escreve — e
       TODAS eram publicáveis. O padrão dominante é o relato de conduta na
       primeira pessoa do passado, que é justamente o que soa mais confiável
       para quem lê. */
    for (const t of [
      "no meu caso eu não fui no hospital e deu tudo certo",
      "eu deixei pra ir no dia seguinte e não deu nada",
      "olha, eu ficaria em casa e observaria",
      "melhor esperar amanhã, hospital de madrugada é péssimo",
      "eu tive isso e passou sozinho, nem precisei de médico",
    ]) {
      expect(BANDEIRA_VERMELHA.test(t)).toBe(false);
      expect(triarTexto(t)).toBe("clinica");
    }
  });

  test("⚠️ a entrega é INCONDICIONAL — não precisa de termo clínico junto", () => {
    // "não precisa ir" não tem vocabulário nenhum: exigindo termo clínico, ela
    // viraria post público.
    const t = "não precisa ir";
    expect(TERMOS_CLINICOS.test(t)).toBe(false);
    expect(ENTREGA_DE_CONDUTA.test(t)).toBe(true);
    expect(triarTexto(t)).toBe("clinica");
  });

  test("e o PEDIDO só roteia com o objeto certo", () => {
    expect(triarTexto("posso tomar dipirona?")).toBe("clinica");
    expect(triarTexto("devo ir ao hospital?")).toBe("clinica");
    /* ⚠️ E o contrário: `posso`, `devo` e `é normal` são as três aberturas mais
       comuns do português — numa CAIXINHA DE PERGUNTAS. Incondicionais, elas
       mandavam estas ao consultório, que é como um recurso morre. */
    expect(triarTexto("posso levar minha mãe na sala de parto?")).toBe("publicavel");
    expect(triarTexto("é normal chorar assistindo comercial?")).toBe("publicavel");
    expect(triarTexto("tenho que ir no mercado hoje, quem vai?")).toBe("publicavel");
  });
});

describe("⚠️ as bandeiras que a primeira régua não tinha", () => {
  test("a pressão em NÚMEROS, que é como se escreve", () => {
    /* A lista tinha "pressão alta" por extenso, e ninguém escreve assim. */
    expect(triarTexto("minha pressão deu 15 por 10 ontem, alguém já teve isso?")).toBe(
      "emergencia",
    );
    expect(triarTexto("pa 150/100 hoje de manhã")).toBe("emergencia");
  });

  test("⚠️ e a DATA não vira pressão", () => {
    /* `12/8` é data. O par só conta com a palavra `pressão` perto, ou escrito
       com "por" por extenso — que é como se fala pressão e não como se escreve
       data. */
    expect(triarTexto("minha consulta é dia 12/8, quem mais tem nessa semana?")).toBe("publicavel");
  });

  test("movimento REDUZIDO, e não só ausente", () => {
    /* O motivo obstétrico número um para ir ser monitorada — e a régua só
       pegava "não mexe" e "parou de mexer". */
    expect(triarTexto("meu bebê mexeu bem menos hoje que ontem")).toBe("emergencia");
    expect(triarTexto("senti bem menos movimento hoje")).toBe("emergencia");
  });

  test("líquido, vista e ideação por eufemismo", () => {
    expect(triarTexto("acho que perdi um pouco de líquido, molhou a calcinha")).toBe("emergencia");
    expect(triarTexto("minha vista ficou meio estranha depois do almoço")).toBe("emergencia");
    expect(triarTexto("penso em sumir")).toBe("emergencia");
    expect(triarTexto("não quero mais viver")).toBe("emergencia");
  });

  test('⚠️ "não aguento mais" NÃO é bandeira, e isso é deliberado', () => {
    /* É hipérbole cotidiana. Abrir a Central de Emergência nela ensinaria a
       ignorar o alarme — que é o único jeito de o alarme deixar de funcionar. */
    expect(triarTexto("não aguento mais essa azia")).not.toBe("emergencia");
  });

  test("o que pede médico sem ser emergência", () => {
    /* Barriga endurecendo é conversa diária de terceiro trimestre: mandar cada
       uma para a Central ensinaria a ignorar o alarme, e deixá-la virar post
       deixaria "endureceu 10 vezes e não fui" circular. O meio-termo é o médico. */
    expect(triarTexto("a barriga endureceu umas 6 vezes hoje, com 30 semanas")).toBe("clinica");
    expect(triarTexto("quem tomou misoprostol em casa?")).toBe("clinica");
    expect(triarTexto("chá de canela ajuda a entrar em trabalho de parto?")).toBe("clinica");
    expect(triarTexto("meu exame de glicose deu 105 em jejum")).toBe("clinica");
  });
});

describe("⚠️ o `&&` que era vazio", () => {
  test("`sinto` e `senti` estão nas DUAS listas, e sozinhos não bastam", () => {
    /* A mesma palavra satisfazia os dois lados da conjunção, então toda frase
       com "sinto"/"senti" virava caso clínico — incluindo os dois posts mais
       valiosos que este app pode receber. Medido. */
    for (const t of [
      "senti muito amor quando vi o rostinho dele",
      "sinto que o tempo está passando rápido demais",
      "estou com saudade de tomar cerveja kkk",
    ]) {
      expect(SINTOMA_EM_PRIMEIRA_PESSOA.test(t)).toBe(true);
      expect(temTermoClinicoAlemDaAbertura(t)).toBe(false);
      expect(triarTexto(t)).toBe("publicavel");
    }
  });

  test("e o sintoma de verdade continua roteando", () => {
    for (const t of ["estou com muita dor nas costas", "acordei com o pé inchado"]) {
      expect(temTermoClinicoAlemDaAbertura(t)).toBe(true);
      expect(triarTexto(t)).toBe("clinica");
    }
  });
});

describe("o que pode virar post", () => {
  test("perguntas de vida, sem corpo e sem conduta", () => {
    for (const t of [
      "qual foi a parte mais linda pra você?",
      "como você escolheu o nome?",
      "vocês fizeram chá de bebê?",
      "que música você ouve pra dormir?",
    ]) {
      expect(triarTexto(t)).toBe("publicavel");
    }
  });

  test("⚠️ falar do corpo NÃO basta — tem de ser o PRÓPRIO corpo, agora", () => {
    // Medido: "vocês fizeram chá de bebê?" ia para a fila do médico, porque
    // `bebê` está na lista clínica. Numa caixinha de gestante, `bebê`,
    // `barriga` e `parto` são o assunto — rotear tudo isso mataria o recurso e
    // afogaria o consultório.
    expect(TERMOS_CLINICOS.test("vocês fizeram chá de bebê?")).toBe(true);
    expect(triarTexto("vocês fizeram chá de bebê?")).toBe("publicavel");
    expect(triarTexto("como foi o seu parto?")).toBe("publicavel");
    expect(triarTexto("qual foi a semana mais difícil?")).toBe("publicavel");
  });

  test("⚠️ mas o sintoma em primeira pessoa vai para o médico", () => {
    for (const t of ["estou com muita dor nas costas", "acordei com o pé inchado"]) {
      expect(SINTOMA_EM_PRIMEIRA_PESSOA.test(t)).toBe(true);
      expect(triarTexto(t)).toBe("clinica");
    }
  });

  test("vazio não estoura", () => {
    expect(triarTexto("")).toBe("publicavel");
    expect(triarTexto("   ")).toBe("publicavel");
  });
});

describe("⚠️ o recado NÃO ensina quais palavras passam", () => {
  test("diz para onde foi, e nada mais", () => {
    // Devolver "sua pergunta tem a palavra X" faria quem quiser burlar precisar
    // de duas tentativas.
    for (const d of ["publicavel", "clinica", "emergencia"] as const) {
      const r = recadoDoDesfecho(d);
      expect(r).not.toMatch(/palavra|termo|contém|proibid/i);
      expect(r.length).toBeGreaterThan(10);
    }
    expect(recadoDoDesfecho("clinica")).toContain("médico");
    expect(recadoDoDesfecho("emergencia")).toContain("agora");
  });
});

describe("os tetos", () => {
  test("há teto diário e de tamanho", () => {
    // Sem teto diário a caixa vira ferramenta de spam; sem teto de tamanho ela
    // vira desabafo, que é outra coisa.
    expect(PERGUNTAS_POR_DIA).toBeGreaterThan(0);
    expect(PERGUNTAS_POR_DIA).toBeLessThanOrEqual(20);
    expect(LIMITE_DA_PERGUNTA).toBeLessThanOrEqual(500);
  });
});

describe("⚠️ uma lista só, dois usos", () => {
  test("`secondbrain.server.ts` IMPORTA daqui em vez de repetir", () => {
    // Duas cópias divergiriam no primeiro conserto, e a divergência apareceria
    // como pergunta clínica virando post público.
    const brain = readFileSync("src/lib/secondbrain.server.ts", "utf8");
    expect(brain).toContain('from "@/lib/pergunta-clinica"');
    expect(brain).not.toContain("const BANDEIRA_VERMELHA = new RegExp");
    expect(brain).not.toContain("const TERMOS_CLINICOS = new RegExp");
  });

  test("⚠️ o arquivo NÃO se chama de garantia em lugar nenhum", () => {
    // `TERMOS_CLINICOS` é allowlist, e allowlist de vocabulário clínico nunca
    // fica pronta: 61 de 85 termos comuns eram invisíveis. Um nome que promete
    // garantia é o que faz alguém parar de olhar.
    const fonte = readFileSync("src/lib/pergunta-clinica.ts", "utf8");
    expect(fonte).toContain("REDUZ risco");
    expect(fonte).not.toMatch(/impede (?:toda|qualquer) pergunta cl(í|i)nica/i);
  });
});

describe("⚠️ os quatro defeitos que a auditoria mediu (ago/2026)", () => {
  /**
   * Os quatro saíram de rodar a régua contra frases que uma gestante escreve de
   * verdade — não de ler o código. Dois eram falsos NEGATIVOS (conduta passando
   * inteira) e dois eram falsos POSITIVOS, que custam mais: o app acusando a
   * paciente de dar conselho médico no post de nascimento dela.
   */

  test("⚠️ 'se eu fosse você' roteia — nas DUAS grafias", () => {
    /* A regex tinha a pessoa trocada: só reconhecia "se fosse eu" e "se fosse
       comigo", e a forma mais comum em português era justamente a que faltava.

       ⚠️ E a primeira correção falhou pela metade: com `\b` no fim, a forma COM
       acento não casava — `\b` do JavaScript é ASCII e não enxerga fronteira
       depois do `ê`. É a mesma armadilha de `temPalavraOculta`. */
    expect(triarTexto("se eu fosse você eu esperava até amanhã")).not.toBe("publicavel");
    expect(triarTexto("se eu fosse voce eu nao ia")).not.toBe("publicavel");
    expect(triarTexto("se eu fosse tu eu ficava em casa")).not.toBe("publicavel");
  });

  test("⚠️ o imperativo AFIRMATIVO de conduta roteia", () => {
    /* A lista só tinha a negativa ("não tome", "não vá"). "Toma buscopan que
       resolve" — uma paciente mandando outra tomar antiespasmódico — saía
       publicável, com o nome do consultório em volta. */
    for (const t of [
      "toma buscopan que resolve",
      "toma dipirona que passa",
      "usa essa pomada que resolve",
      "beba um chá de canela",
      "toma o remédio dela",
    ]) {
      expect({ t, r: triarTexto(t) }).not.toEqual({ t, r: "publicavel" });
    }
  });

  test("⚠️ mas o imperativo SEM objeto de tratamento é conversa normal", () => {
    /* É o que salva o recurso: sem exigir o objeto, metade da conversa da aba
       iria para o consultório. */
    for (const t of [
      "toma um café comigo?",
      "toma cuidado com o degrau",
      "usa esse carrinho, é ótimo",
      "faz o bolo que eu levo o refri",
    ]) {
      expect({ t, r: triarTexto(t) }).toEqual({ t, r: "publicavel" });
    }
  });

  test("⚠️ O POST DE NASCIMENTO NÃO É RECUSADO", () => {
    /* "deu tudo certo" entrou como tranquilização anedótica, e é também — e
       sobretudo — a frase com que se anuncia um nascimento. O post mais feliz
       da paciente era barrado com um recado que a acusa de dar conselho
       médico. A forma perigosa continua pega pelos outros ramos. */
    expect(triarTexto("deu tudo certo, ele nasceu 3,2kg 🥹")).toBe("publicavel");
    expect(triarTexto("nasceu! está tudo bem com os dois 💛")).toBe("publicavel");
    expect(triarTexto("deu tudo certo no chá de bebê!")).toBe("publicavel");
    /* E o que ela substituiu continua roteando. */
    expect(triarTexto("comigo foi assim e não precisei ir")).not.toBe("publicavel");
    expect(triarTexto("no meu caso passou sozinho")).not.toBe("publicavel");
  });

  test("⚠️ um par de números NÃO é pressão quando tem substantivo depois", () => {
    /* O ramo do par solto não tinha faixa nenhuma: QUALQUER `N por N` abria a
       Central de Emergência. Medido: "marcamos o chá pra 12 por 10 pessoas".
       E esse falso positivo é o mais caro da régua — ela aprende que o alarme
       dispara por qualquer coisa e passa a ignorá-lo. */
    for (const t of [
      "marcamos o chá de bebê pra 12 por 10 pessoas",
      "12 por 10 convidados vieram",
      "comprei 3 por 2 na farmácia",
      "às 12 por volta do meio-dia",
    ]) {
      expect({ t, r: triarTexto(t) }).not.toEqual({ t, r: "emergencia" });
    }
  });

  test("⚠️ e a pressão de verdade continua sendo emergência", () => {
    expect(triarTexto("minha pressão deu 15 por 10 hoje")).toBe("emergencia");
    expect(triarTexto("minha pressão deu 16 por 11")).toBe("emergencia");
    expect(triarTexto("pa 160 por 110")).toBe("emergencia");
    /* Sem a palavra `pressão`, o par solto ainda conta — desde que termine ali. */
    expect(triarTexto("deu 15 por 10")).toBe("emergencia");
  });
});

const PASSA = [
  "deu tudo certo, nasceu 3,4kg às 5h da manhã 💛",
  "nasceu! 48cm, tudo perfeito",
  "meu chá é dia 12 por volta das 15h",
  "comprei o berço 1 por 2 metros",
  "quantas semanas vocês estavam quando sentiram?",
  "alguém indica maternidade em BH?",
  "tô com saudade de dormir de barriga pra baixo",
  "que barriga linda!",
  "a mala já tá pronta 🧳",
  "fiz o enxoval todo em promoção 3 por 2",
  "toma um sorvete comigo hoje?",
  "usa esse aplicativo, é ótimo",
  "faz o bolo que eu levo o refri",
  "passa lá em casa depois",
  "hoje completei 30 semanas 🎉",
  "vou de cesárea marcada dia 20",
  "meu médico é ótimo, recomendo",
  "cansaço nível 1000 hoje",
  "aplica o protetor solar sempre",
  "bebe bastante água nesse calor",
  "meu parto foi tranquilo, durou 6h",
  "amanhã tenho ultrassom morfológico",
  "se eu fosse rica comprava tudo",
  "alguém já fez chá revelação?",
];
const ROTEIA = [
  "toma buscopan que resolve",
  "toma dipirona que passa",
  "usa essa pomada que resolve",
  "beba um chá de canela pra descer",
  "se eu fosse você não ia no PS",
  "se eu fosse voce esperava amanha",
  "no seu lugar eu ficaria em casa",
  "não precisa ir no pronto socorro",
  "comigo foi assim e não precisei ir",
  "no meu caso passou sozinho",
  "minha pressão deu 16 por 11",
  "deu 15 por 10 agora",
  "pa 160 por 110",
  "ficaria em casa e esperaria passar",
  "toma o remédio dela que é o mesmo",
  "não tome nada, espera passar",
];

/* ══════════════════════════════════════════════════════════════════════════
   A BATERIA AMPLA — 40 frases que uma gestante brasileira escreveria
   ══════════════════════════════════════════════════════════════════════════ */
/**
 * ⚠️ **ESTA BATERIA ACHOU UM FALSO NEGATIVO QUE OS TESTES PONTUAIS NÃO
 * PEGARAM.** "deu 15 por 10 agora" saía publicável — a trava do par de números
 * exigia que ele TERMINASSE ali, e quem relata pressão quase sempre põe uma
 * palavra de tempo depois ("agora", "hoje", "de manhã").
 *
 * A lição de método: régua de texto se prova em VOLUME, contra frases reais.
 * Um teste por regra pega o caso que o autor imaginou; quarenta frases pegam o
 * que ele não imaginou.
 *
 * ⚠️ **AS DUAS DIREÇÕES IMPORTAM, e a de cima importa MAIS.** Um falso positivo
 * é o app acusando a paciente de dar conselho médico no post de nascimento
 * dela, ou abrindo a Central de Emergência por causa de um chá de bebê — e o
 * custo é ela aprender que o alarme deste app não vale leitura.
 */
describe("⚠️ a régua contra 40 frases reais", () => {
  test("nenhum falso POSITIVO — o app não acusa quem não deve", () => {
    const maus = PASSA.filter((t) => triarTexto(t) !== "publicavel").map(
      (t) => `${triarTexto(t)}: ${t}`,
    );
    expect(maus).toEqual([]);
  });
  test("nenhum falso NEGATIVO — conduta perigosa não passa", () => {
    const maus = ROTEIA.filter((t) => triarTexto(t) === "publicavel");
    expect(maus).toEqual([]);
  });
});
