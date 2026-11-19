import { describe, expect, test } from "bun:test";
import {
  abrirConversa,
  depois,
  HUMORES_DA_CONVERSA,
  menu,
  ordemDaSugestao,
  responder,
  responderAoHumor,
  sugestao,
  todasAsFrases,
  type ContextoDaBolha,
} from "~/lib/bolha/conversa";

const BASE: ContextoDaBolha = {
  hora: 9,
  D: 120,
  modo: "gestacao",
  nomeDela: "Marina Costa",
  nomeDoBebe: "Helena",
  semana: 24,
  feitos: [],
  chama: 3,
};

/** O que a Bolha NUNCA diz: conduta, clínica, promessa de efeito. */
const CONDUTA =
  /\b(m[eé]dic[oa]s?|consultas?|exames?|rem[eé]dios?|medica\w*|suplement\w*|vitaminas?|dieta|sintomas?|dores?|sangr\w*|contra[cç][aã]o|contra[cç][oõ]es|press[aã]o|glicemia|diagn[oó]stic\w*|procure|deve(ria)?|precisa|tratar|trata\w*|cura\w*|previne|preven\w*|reduz\w*|melhora\w*|garant\w*|saud[aá]vel|terapia|ansiedade|depress\w*|normal é|é normal)\b/i;

describe("a Bolha guia", () => {
  test("nunca conduta, nunca promessa de efeito, nunca gênero para o bebê", () => {
    const fora = todasAsFrases().flatMap((f) => {
      const m = [
        ...(f.match(new RegExp(CONDUTA.source, "gi")) ?? []),
        ...(f.match(/\b(ele|ela|dele|dela|nele|nela)\b/gi) ?? []),
      ];
      return m.length ? [`${f} → ${m.join(", ")}`] : [];
    });
    expect(fora).toEqual([]);
  });

  test("a voz do app: sem travessão, sem emoji, sem exclamação em série", () => {
    const fora = todasAsFrases().filter(
      (f) => /—|–/.test(f) || /\p{Extended_Pictographic}/u.test(f) || /!.*!/.test(f),
    );
    expect(fora).toEqual([]);
  });

  test("sem humor marcado, ela pergunta como você está, com os humores do check-in", () => {
    const f = abrirConversa(BASE);
    expect(f.texto).toContain("Bom dia");
    expect(f.texto).toContain("Como você está hoje?");
    expect(f.respostas.map((r) => r.rotulo)).toEqual([...HUMORES_DA_CONVERSA]);
  });

  test("cansada ou enjoada, a primeira sugestão é respirar", () => {
    for (const h of ["Cansada", "Enjoada"] as const) {
      const f = responderAoHumor(BASE, h);
      expect(f.respostas[0]).toMatchObject({ tipo: "abrir", destino: "meditation" });
      expect(f.pose).toBe("dormindo");
    }
  });

  test("de manhã e bem, a aula vem primeiro; o que já foi feito não volta", () => {
    expect(responderAoHumor(BASE, "Bem").respostas[0]).toMatchObject({ destino: "aula" });
    const semAula = ordemDaSugestao({ ...BASE, humor: "Bem", feitos: ["aula"] });
    expect(semAula[0]).toBe("movement");
    expect(semAula).not.toContain("aula");
  });

  test("à noite os sons entram na lista, e com o dia cheio a Bolha comemora", () => {
    const noite = { ...BASE, hora: 22, humor: "Bem" };
    expect(ordemDaSugestao(noite)).toContain("dormir");
    const cheio = sugestao({
      ...noite,
      feitos: ["aula", "movement", "meditation", "bonding", "gratitude"],
    });
    expect(cheio.pose).toBe("comemorando");
    expect(cheio.respostas[0]).toMatchObject({ destino: "dormir" });
  });

  test("a mesma fala o dia inteiro, e outra no dia seguinte", () => {
    expect(abrirConversa(BASE).texto).toBe(abrirConversa({ ...BASE }).texto);
    const hoje = sugestao({ ...BASE, humor: "Bem" }).texto;
    const amanha = sugestao({ ...BASE, humor: "Bem", D: BASE.D + 1 }).texto;
    expect(hoje).not.toBe(amanha);
  });

  test("as respostas cabem num botão e levam a algum lugar", () => {
    const k = { ...BASE, humor: "Bem" };
    for (const f of [abrirConversa(BASE), sugestao(k), menu(k), depois(k)]) {
      for (const r of f.respostas) {
        expect(r.rotulo.length).toBeLessThanOrEqual(24);
        if (r.tipo !== "abrir") expect(responder(k, r)).not.toBeNull();
      }
    }
  });

  test("o nome do bebê vai sem artigo; sem nome, 'o bebê'", () => {
    const comNome = menu({ ...BASE, humor: "Bem" }).respostas.map((r) => r.rotulo);
    expect(comNome).toContain("Ler para Helena");
    const semNome = menu({ ...BASE, humor: "Bem", nomeDoBebe: null }).respostas.map(
      (r) => r.rotulo,
    );
    expect(semNome).toContain("Ler para o bebê");
  });
});
