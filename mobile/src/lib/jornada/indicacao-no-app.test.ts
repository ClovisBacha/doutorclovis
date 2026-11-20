import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import {
  codigoLimpo,
  fraseDaIndicacao,
  lerResultadoDaIndicacao,
  mensagemDeConviteDoApp,
} from "~/lib/jornada/amigas";
import { RECOMPENSA_DA_INDICACAO } from "~/lib/jornada/recompensas";

/**
 * O CÓDIGO DA AMIGA NO APP (fase 3). Antes, só o link do SITE levava o código
 * de quem convidou: quem baixava o app criava a conta e nunca virava amiga de
 * quem a chamou (nem a amizade, nem o seguir, nem as sementinhas dela). Agora o
 * cadastro pergunta "Uma amiga te chamou?" e o convite do app leva o código
 * escrito.
 */

const RAIZ = join(import.meta.dir, "..", "..");

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}
const FONTES = arquivos(RAIZ).map((p) => ({
  arquivo: relative(RAIZ, p),
  codigo: semComentarios(readFileSync(p, "utf8")),
}));

describe("ligar-se à amiga pelo código", () => {
  test("o resultado do servidor vira uma de quatro frases", () => {
    expect(lerResultadoDaIndicacao({ ok: true, attributed: true })).toBe("ligou");
    expect(lerResultadoDaIndicacao({ ok: true, attributed: false })).toBe("nao-encontrou");
    expect(lerResultadoDaIndicacao({ ok: true, attributed: false, retry: true })).toBe("depois");
    expect(lerResultadoDaIndicacao({ ok: false, error: "Não autenticado" })).toBe("falhou");
    expect(fraseDaIndicacao("ligou", 100)).toContain("100 sementinhas");
    /* O servidor não distingue "código errado" de "já entrou por outra": a frase diz as duas. */
    expect(fraseDaIndicacao("nao-encontrou", 100)).toContain("convite de outra amiga");
  });

  test("o código limpo, como o servidor guarda", () => {
    expect(codigoLimpo(" juli-7k ")).toBe("JULI7K");
    expect(codigoLimpo("@ana 12")).toBe("ANA12");
  });

  test("o convite do app leva o código escrito (e o link, quando há)", () => {
    const m = mensagemDeConviteDoApp("JULI7K", "https://www.obstetrica.com.br/?amiga=JULI7K");
    expect(m).toContain("use o meu código JULI7K");
    expect(m).toContain("?amiga=JULI7K");
    expect(mensagemDeConviteDoApp("JULI7K", null)).not.toContain("http");
    expect(m).not.toMatch(/consulta|médic|saúde|tem me ajudado/i);
  });

  test("a recompensa do app é a do servidor (100 🌱 por amiga)", () => {
    const servidor = readFileSync(
      join(RAIZ, "..", "..", "src", "lib", "referral.functions.ts"),
      "utf8",
    );
    expect(servidor).toMatch(new RegExp(`REFERRAL_REWARD = ${RECOMPENSA_DA_INDICACAO};`));
  });

  test("nenhuma tela manda o convite do site (sem o código escrito)", () => {
    const quem = FONTES.filter((f) => /\bmensagemDeConvite\(/.test(f.codigo)).map((f) => f.arquivo);
    expect(quem).toEqual([]);
  });

  test("o cadastro pergunta pela amiga — e corrigir a data, não", () => {
    const ritual = FONTES.find((f) => f.arquivo === join("app", "ritual.tsx"))!.codigo;
    expect(ritual).toContain("const total = editar ? PASSO_DA_REDE : PASSOS;");
    expect(ritual).toContain("ligarPeloCodigo(codigo)");
  });
});
