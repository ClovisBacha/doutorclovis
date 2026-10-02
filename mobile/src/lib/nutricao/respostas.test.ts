import { describe, expect, test } from "bun:test";
import { desfechoDaFoto, desfechoDoChat, motivoDoBloqueio, recadoDaFoto, RECADO_DO_AVISO } from "./respostas";

describe("o que cada resposta do /api/nutrition quer dizer", () => {
  test("2xx abre o stream", () => {
    expect(desfechoDoChat(200)).toEqual({ tipo: "stream" });
  });
  test("401 é sessão expirada", () => {
    expect(desfechoDoChat(401)).toEqual({ tipo: "aviso", aviso: "sessao" });
    expect(RECADO_DO_AVISO.sessao.toLowerCase()).toContain("sessão expirou");
  });
  test("402 é a porta, com o motivo do corpo", () => {
    expect(desfechoDoChat(402, { bloqueado: true, motivo: "teto_diario" })).toEqual({
      tipo: "bloqueio",
      motivo: "teto_diario",
    });
    expect(desfechoDoChat(402, { bloqueado: true, motivo: "sem_premium" })).toEqual({
      tipo: "bloqueio",
      motivo: "sem_premium",
    });
    /* Corpo ilegível: a porta do Premium, como no site. */
    expect(desfechoDoChat(402, null)).toEqual({ tipo: "bloqueio", motivo: "sem_premium" });
  });
  test("429 pede espera", () => {
    expect(desfechoDoChat(429)).toEqual({ tipo: "aviso", aviso: "muitas" });
    expect(RECADO_DO_AVISO.muitas.toLowerCase()).toContain("muitas mensagens em pouco tempo");
  });
  test("o resto é falha genérica, sem texto do servidor", () => {
    expect(desfechoDoChat(500)).toEqual({ tipo: "aviso", aviso: "falha" });
    expect(desfechoDoChat(400)).toEqual({ tipo: "aviso", aviso: "falha" });
  });
  test("nenhum recado oferece compra (não há IAP nesta versão)", () => {
    for (const t of Object.values(RECADO_DO_AVISO)) expect(t).not.toMatch(/assin|R\$|preço|plano/i);
  });
});

describe("o que cada resposta do /api/prato quer dizer", () => {
  test("ok com texto: a resposta, a assinatura e a amostra", () => {
    expect(desfechoDaFoto(200, { ok: true, texto: " Prato colorido! ", assinatura: "s", restantesNaAmostra: 1 })).toEqual({
      tipo: "ok",
      texto: "Prato colorido!",
      assinatura: "s",
      amostra: 1,
    });
    expect(desfechoDaFoto(200, { ok: true, texto: "x", restantesNaAmostra: null })).toEqual({
      tipo: "ok",
      texto: "x",
      amostra: null,
    });
  });
  test("{ok:false} numa resposta 200 NÃO é sucesso", () => {
    expect(desfechoDaFoto(200, { ok: false, motivo: "vazio" }).tipo).toBe("recado");
    expect(desfechoDaFoto(200, { ok: true, texto: "" }).tipo).toBe("recado");
    expect(desfechoDaFoto(200, null).tipo).toBe("recado");
  });
  test("402 bloqueado:* é a mesma porta da conversa", () => {
    expect(desfechoDaFoto(402, { ok: false, motivo: "bloqueado:teto_diario" })).toEqual({
      tipo: "bloqueio",
      motivo: "teto_diario",
    });
    expect(desfechoDaFoto(402, { ok: false, motivo: "bloqueado:sem_premium" })).toEqual({
      tipo: "bloqueio",
      motivo: "sem_premium",
    });
  });
  test("401 é sessão", () => {
    expect(desfechoDaFoto(401, null)).toEqual({ tipo: "sessao" });
  });
  test("cada motivo tem recado próprio, que diz o que fazer", () => {
    const motivos = ["muitas", "sem_ia", "invalido", "grande", "formato", "demorou", "bloqueada", "vazio", "sem_sinal"];
    const recados = motivos.map((m) => {
      const d = desfechoDaFoto(m === "muitas" ? 429 : 502, { ok: false, motivo: m });
      expect(d.tipo).toBe("recado");
      return d.tipo === "recado" ? d.texto : "";
    });
    /* Motivos diferentes, recados diferentes (menos invalido/sem_foto, que são o mesmo caso). */
    expect(new Set(recados).size).toBe(recados.length);
    expect(recadoDaFoto("sem_foto")).toBe(recadoDaFoto("invalido"));
    expect(recadoDaFoto("bloqueada")).toMatch(/sem pessoas/);
    expect(recadoDaFoto("muitas")).toMatch(/minutos/);
  });
  test("429 sem corpo ainda diz 'muitas'", () => {
    const d = desfechoDaFoto(429, null);
    expect(d.tipo === "recado" && d.texto).toBe(recadoDaFoto("muitas"));
  });
  test("motivo do servidor 'rede' (servidor sem falar com o Google) não diz que ela está sem sinal", () => {
    expect(recadoDaFoto("rede")).not.toMatch(/sinal|conexão/i);
  });
});

test("motivoDoBloqueio tira o prefixo e cai em sem_premium no desconhecido", () => {
  expect(motivoDoBloqueio("bloqueado:teto_diario")).toBe("teto_diario");
  expect(motivoDoBloqueio("teto_diario")).toBe("teto_diario");
  expect(motivoDoBloqueio("qualquer")).toBe("sem_premium");
  expect(motivoDoBloqueio(undefined)).toBe("sem_premium");
});
