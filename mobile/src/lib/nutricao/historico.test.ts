import { describe, expect, test } from "bun:test";
import { turnosDaMemoria } from "@/lib/nutricao-memoria";
import { historicoParaEnviar, MAX_MENSAGENS, turnosDaTela, type Turno } from "./historico";

const ela = (id: string, texto = `pergunta ${id}`): Turno => ({ id, role: "user", texto, especie: "conversa" });
const ia = (id: string, assinatura: string | undefined = `sig-${id}`): Turno => ({
  id,
  role: "assistant",
  texto: `resposta ${id}`,
  especie: "conversa",
  ...(assinatura ? { assinatura } : {}),
});

function papeis(m: { role: string }[]) {
  return m.map((x) => (x.role === "user" ? "E" : "A")).join("");
}

describe("o histórico que sobe para /api/nutrition", () => {
  test("conversa vazia: só a pergunta nova", () => {
    const m = historicoParaEnviar([], "Posso comer sushi?");
    expect(m).toEqual([{ id: "nova-0", role: "user", parts: [{ type: "text", text: "Posso comer sushi?" }] }]);
  });

  test("alterna ela/assistente e termina nela; a assinatura volta no metadata", () => {
    const m = historicoParaEnviar([ela("1"), ia("2"), ela("3"), ia("4")], "e agora?");
    expect(papeis(m)).toBe("EAEAE");
    expect(m[1]).toEqual({
      id: "2",
      role: "assistant",
      parts: [{ type: "text", text: "resposta 2" }],
      metadata: { assinatura: "sig-2" },
    });
    expect(m[m.length - 1].parts[0].text).toBe("e agora?");
    expect(m[0]).not.toHaveProperty("metadata");
  });

  test("resposta SEM assinatura não sobe — e a pergunta dela cai junto", () => {
    const m = historicoParaEnviar([ela("1"), ia("2", ""), ela("3"), ia("4")], "nova");
    expect(papeis(m)).toBe("EAE");
    expect(m.map((x) => x.id)).toEqual(["3", "4", "nova-4"]);
  });

  test("o socorro NÃO sai do aparelho: o par não entra no corpo", () => {
    const turnos: Turno[] = [
      ela("1"),
      ia("2"),
      { id: "s1", role: "user", texto: "estou sangrando", especie: "socorro" },
      { id: "s2", role: "assistant", texto: "Procure atendimento", especie: "socorro" },
    ];
    const m = historicoParaEnviar(turnos, "nova");
    expect(JSON.stringify(m)).not.toContain("sangrando");
    expect(m.map((x) => x.id)).toEqual(["1", "2", "nova-4"]);
  });

  test("recado do app (foto que falhou, resposta pela metade) não sobe", () => {
    const turnos: Turno[] = [
      ela("1", "📷 Foto do meu prato"),
      { id: "r", role: "assistant", texto: "Não consegui ler essa foto", especie: "recado" },
      ela("3"),
      ia("4"),
    ];
    const m = historicoParaEnviar(turnos, "nova");
    expect(m.map((x) => x.id)).toEqual(["3", "4", "nova-4"]);
  });

  test("pergunta dela sem resposta (falhou) não fica em fila com a nova", () => {
    const m = historicoParaEnviar([ela("1"), ia("2"), ela("3")], "nova");
    expect(papeis(m)).toBe("EAE");
    expect(m.map((x) => x.id)).toEqual(["1", "2", "nova-3"]);
  });

  test("no máximo 12, e a primeira é sempre dela", () => {
    const turnos: Turno[] = [];
    for (let i = 0; i < 20; i++) turnos.push(ela(`e${i}`), ia(`a${i}`));
    const m = historicoParaEnviar(turnos, "nova");
    expect(m.length).toBeLessThanOrEqual(MAX_MENSAGENS);
    expect(m[0].role).toBe("user");
    expect(m[m.length - 1].parts[0].text).toBe("nova");
    for (let i = 1; i < m.length; i++) expect(m[i].role).not.toBe(m[i - 1].role);
    /* Ficam as MAIS RECENTES. */
    expect(m[m.length - 2].id).toBe("a19");
  });

  test("texto vazio não sobe (assistente vazio faz o Gemini recusar a seguinte)", () => {
    const vazio: Turno = { id: "v", role: "assistant", texto: "  ", especie: "conversa", assinatura: "x" };
    const m = historicoParaEnviar([ela("1"), vazio], "nova");
    expect(m.map((x) => x.id)).toEqual(["nova-2"]);
  });
});

describe("da memória do banco para a tela", () => {
  test("as linhas chegam da mais nova para a mais velha; a tela lê em ordem, começando nela", () => {
    const linhas = [
      { role: "assistant" as const, content: "r2", assinatura: "s2" },
      { role: "user" as const, content: "p2" },
      { role: "assistant" as const, content: "r1", assinatura: "s1" },
      { role: "user" as const, content: "p1" },
      { role: "assistant" as const, content: "órfã", assinatura: "s0" },
    ];
    const t = turnosDaTela(turnosDaMemoria(linhas));
    expect(t.map((x) => x.texto)).toEqual(["p1", "r1", "p2", "r2"]);
    expect(t[1].assinatura).toBe("s1");
    expect(t.every((x) => x.especie === "conversa")).toBe(true);
    /* E o que veio da memória sobe de novo, com a assinatura. */
    const m = historicoParaEnviar(t, "nova");
    expect(papeis(m)).toBe("EAEAE");
  });
});
