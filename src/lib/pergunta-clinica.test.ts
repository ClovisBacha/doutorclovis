import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BANDEIRA_VERMELHA,
  LIMITE_DA_PERGUNTA,
  PEDIDO_DE_CONDUTA,
  PERGUNTAS_POR_DIA,
  recadoDoDesfecho,
  SINTOMA_EM_PRIMEIRA_PESSOA,
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

describe("⚠️ o PEDIDO DE CONDUTA — o caso que fechou os comentários", () => {
  test('"comigo foi assim, não precisa ir ao pronto-socorro" não é publicável', () => {
    // Esta frase não tem bandeira vermelha NENHUMA e é a mais perigosa que uma
    // paciente pode escrever para outra. É forma, não vocabulário.
    const t = "comigo foi assim, não precisa ir ao pronto-socorro";
    expect(BANDEIRA_VERMELHA.test(t)).toBe(false);
    expect(triarTexto(t)).toBe("clinica");
  });

  test("pega o pedido E a entrega", () => {
    for (const t of [
      "posso tomar dipirona?",
      "devo ir ao hospital?",
      "isso é normal?",
      "no seu lugar eu esperava",
      "não precisa ir não",
      "fica em casa que passa",
    ]) {
      expect(triarTexto(t)).not.toBe("publicavel");
    }
  });

  test("⚠️ a ORDEM importa: conduta é conferida antes do vocabulário", () => {
    // "não precisa ir ao pronto-socorro" não tem termo clínico nenhum:
    // invertida, a régua a deixaria virar post público.
    const t = "não precisa ir";
    expect(TERMOS_CLINICOS.test(t)).toBe(false);
    expect(PEDIDO_DE_CONDUTA.test(t)).toBe(true);
    expect(triarTexto(t)).toBe("clinica");
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
