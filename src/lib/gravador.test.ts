/**
 * O GRAVADOR — o que quebra silenciosamente se estiver errado.
 *
 * Duas coisas, e as duas só aparecem no aparelho da paciente: o formato que o
 * iPhone grava (se a lista começar em webm, funciona em toda máquina de
 * desenvolvimento e falha no celular) e o teto de bytes, que é o que separa um
 * recado de um minuto de uma fatura de centenas de milhares de tokens.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CANAIS_DA_COTA } from "./cota-ia.server";
import {
  FORMATOS,
  LIMITE_BYTES,
  LIMITE_SEGUNDOS,
  ehAudioAceito,
  melhorMime,
  relogio,
  tipoBase,
} from "./gravador";

describe("⚠️ o formato que o iPhone grava", () => {
  test("audio/mp4 vem PRIMEIRO — é o único que o Safari do iOS grava", () => {
    expect(FORMATOS[0]).toBe("audio/mp4");
  });

  test("num navegador que só faz mp4, é mp4 que sai", () => {
    expect(melhorMime((t) => t === "audio/mp4")).toBe("audio/mp4");
  });

  test("num que faz os dois, mp4 ganha", () => {
    expect(melhorMime((t) => t === "audio/mp4" || t === "audio/webm")).toBe("audio/mp4");
  });

  test("num que só faz webm, webm serve", () => {
    expect(melhorMime((t) => t === "audio/webm")).toBe("audio/webm");
  });

  test("⚠️ nenhum formato suportado devolve null — e é isso que esconde o botão", () => {
    /* Um microfone desenhado numa tela que não grava é um botão que promete e
       não faz. `podeGravar()` lê exatamente este null. */
    expect(melhorMime(() => false)).toBe(null);
  });
});

describe("o tipo com parâmetros", () => {
  test("o que vale é o que vem antes do ponto-e-vírgula", () => {
    expect(tipoBase("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(tipoBase("AUDIO/MP4")).toBe("audio/mp4");
    expect(tipoBase(null)).toBe("");
  });

  test("o servidor aceita os cinco, e nada além deles", () => {
    for (const f of FORMATOS) expect(ehAudioAceito(`${f};codecs=x`)).toBe(true);
    expect(ehAudioAceito("video/mp4")).toBe(false);
    expect(ehAudioAceito("application/pdf")).toBe(false);
    expect(ehAudioAceito("")).toBe(false);
    expect(ehAudioAceito(undefined)).toBe(false);
  });
});

describe("os limites, que os dois lados precisam concordar", () => {
  test("dois megabytes cobrem 90 s nos dois codecs, e são 10× menos que a consulta", () => {
    /* Opus a 24 kbps: ~270 KB em 90 s. AAC do iPhone: ~1 MB. O endpoint da
       consulta aceita 20 MB — lá é uma consulta, aqui é uma frase. */
    expect(LIMITE_BYTES).toBe(2 * 1024 * 1024);
    expect(LIMITE_BYTES * 10).toBe(20 * 1024 * 1024);
    expect(LIMITE_SEGUNDOS).toBe(90);
  });

  test("⚠️ o servidor confere o TETO e o FORMATO — o cliente pode mentir", () => {
    /* O relógio do navegador em segundo plano é estrangulado pelo sistema, e
       um corpo montado à mão nem passa pela tela. A garantia é do servidor. */
    const fonte = readFileSync("src/routes/api/transcrever-diario.ts", "utf8");
    expect(fonte).toContain("audio.size > LIMITE_BYTES");
    expect(fonte).toContain("ehAudioAceito(audio.type)");
    expect(fonte).toContain("usuarioDaRequisicao(request)");
    expect(fonte).toContain("rateLimited(clientIp(request))");
  });

  test("⚠️ a transcrição É MEDIDA, e fora da cota clínica dela", () => {
    /* O endpoint da consulta passou meses sendo o único de IA sem medição — e
       era o mais caro da base. O dono só descobriria pela fatura do Google. */
    const fonte = readFileSync("src/routes/api/transcrever-diario.ts", "utf8");
    expect(fonte).toContain("registrarUsoAgora");
    expect(fonte).toContain('canal: "diario"');
    expect((CANAIS_DA_COTA as readonly string[]).includes("diario")).toBe(false);
  });

  test("⚠️ o prompt não deixa o modelo reescrever a frase dela", () => {
    /* O diário é lido pelo médico. Um modelo que 'melhora' a frase põe no
       prontuário palavras que a paciente não disse. */
    const fonte = readFileSync("src/routes/api/transcrever-diario.ts", "utf8");
    expect(fonte).toContain("Não resuma, não corrija");
    expect(fonte).toContain("temperature: 0");
  });

  test("⚠️ o áudio não é guardado em lugar nenhum", () => {
    const fonte = readFileSync("src/routes/api/transcrever-diario.ts", "utf8");
    expect(/\.storage|from\(["'`]exam|insert\(/.test(fonte)).toBe(false);
  });
});

describe("o relógio da gravação", () => {
  test("mostra minuto e segundo com dois dígitos", () => {
    expect(relogio(0)).toBe("0:00");
    expect(relogio(7)).toBe("0:07");
    expect(relogio(67)).toBe("1:07");
    expect(relogio(-3)).toBe("0:00");
  });
});
