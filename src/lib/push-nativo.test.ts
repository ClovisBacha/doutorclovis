/**
 * Push nativo — o que dá para verificar sem Apple, sem Google e sem aparelho.
 *
 * Três coisas, e todas já falharam em produção alheia por motivos bobos:
 *
 * 1. A **chave privada** chega de dois jeitos por variável de ambiente — com
 *    quebras de linha de verdade ou com `\n` literal. Errar isso dá um "chave
 *    inválida" que parece problema da chave, e a pessoa vai gerar outra.
 * 2. O **JWT** tem que ter a forma que a Apple e o Google esperam, e a
 *    assinatura ES256 tem que ser IEEE P1363 (64 bytes crus) e não DER — o
 *    `node:crypto` faz DER por padrão, e a Apple recusa com 403 sem dizer por
 *    quê.
 * 3. O gate de configuração: sem chave, tudo tem que virar silêncio, não erro.
 */

import { afterEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

/** Uma chave EC de verdade, gerada na hora — nada de segredo no repositório. */
function chaveEC(): string {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function chaveRSA(): string {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

describe("sem chave, silêncio — nunca erro", () => {
  test("nada configurado: os três gates dizem não", async () => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("APNS_") || k.startsWith("FCM_")) delete process.env[k];
    }
    const m = await import("./push-nativo.server");
    expect(m.apnsConfigurado()).toBe(false);
    expect(m.fcmConfigurado()).toBe(false);
    expect(m.pushNativoConfigurado()).toBe(false);
  });

  test("APNs pela metade não conta como configurado", async () => {
    /* Faltando o bundle id, o envio sairia com `apns-topic` vazio e a Apple
       responderia 400 em TODOS os aparelhos. Melhor não tentar. */
    process.env.APNS_KEY_ID = "ABC123";
    process.env.APNS_TEAM_ID = "TEAM99";
    process.env.APNS_PRIVATE_KEY = chaveEC();
    delete process.env.APNS_BUNDLE_ID;
    const m = await import("./push-nativo.server");
    expect(m.apnsConfigurado()).toBe(false);
  });
});

describe("a chave privada nas duas formas que um painel entrega", () => {
  test("com `\\n` literal funciona igual à chave com quebras de verdade", () => {
    const pem = chaveEC();
    const escapada = pem.replace(/\n/g, "\\n");
    /* A mesma normalização que `chavePEM` faz no servidor. */
    const voltou = escapada.includes("\\n") ? escapada.replace(/\\n/g, "\n") : escapada;
    expect(voltou).toBe(pem);
    expect(() => crypto.createPrivateKey(voltou)).not.toThrow();
  });

  test("a chave com quebras de verdade passa intacta", () => {
    const pem = chaveEC();
    const voltou = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
    expect(voltou).toBe(pem);
  });
});

describe("o JWT que a Apple aceita", () => {
  test("ES256 assinado em P1363 tem 64 bytes — DER teria tamanho variável", () => {
    /* Este é o erro clássico: `crypto.sign` devolve DER por padrão, a Apple
       espera os dois inteiros crus, e a recusa vem como 403 genérico. */
    const key = crypto.createPrivateKey(chaveEC());
    const p1363 = crypto.sign("sha256", Buffer.from("x.y"), {
      key,
      dsaEncoding: "ieee-p1363",
    });
    const der = crypto.sign("sha256", Buffer.from("x.y"), { key });
    expect(p1363.length).toBe(64);
    expect(der.length).not.toBe(64);
  });

  test("e o servidor de fato assina em P1363, não só o teste", () => {
    /* O caso acima prova o CONCEITO com o `crypto` na mão — e passava mesmo
       depois de eu tirar o `dsaEncoding` do servidor. Um teste que não cai
       quando o código quebra não é guarda nenhuma: este cobra o arquivo. */
    const fonte = readFileSync("src/lib/push-nativo.server.ts", "utf8");
    const assina = fonte.indexOf("crypto.sign");
    expect(assina).toBeGreaterThan(0);
    expect(fonte.slice(assina, assina + 400)).toContain('dsaEncoding: "ieee-p1363"');
  });

  test("as três partes existem e o cabeçalho carrega o kid", () => {
    const key = crypto.createPrivateKey(chaveEC());
    const cab = Buffer.from(JSON.stringify({ alg: "ES256", kid: "KID123" })).toString("base64url");
    const corpo = Buffer.from(JSON.stringify({ iss: "TEAM", iat: 1 })).toString("base64url");
    const sig = crypto
      .sign("sha256", Buffer.from(`${cab}.${corpo}`), { key, dsaEncoding: "ieee-p1363" })
      .toString("base64url");
    const jwt = `${cab}.${corpo}.${sig}`;
    const partes = jwt.split(".");
    expect(partes).toHaveLength(3);
    expect(JSON.parse(Buffer.from(partes[0], "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "KID123",
    });
  });
});

describe("o JWT que o Google aceita", () => {
  test("RS256 verifica com a pública correspondente", () => {
    const priv = crypto.createPrivateKey(chaveRSA());
    const pub = crypto.createPublicKey(priv);
    const dados = Buffer.from("cabecalho.corpo");
    const sig = crypto.sign("sha256", dados, priv);
    expect(crypto.verify("sha256", dados, pub, sig)).toBe(true);
  });

  test("o escopo pedido é o do FCM — outro escopo devolve token que o envio recusa", () => {
    const fonte = readFileSync("src/lib/push-nativo.server.ts", "utf8");
    expect(fonte).toContain("https://www.googleapis.com/auth/firebase.messaging");
    expect(fonte).toContain("urn:ietf:params:oauth:grant-type:jwt-bearer");
  });
});

describe("tokens mortos saem do banco — e só os mortos mesmo", () => {
  const fonte = readFileSync("src/lib/push-nativo.server.ts", "utf8");

  test("só o 410 da Apple apaga a linha", () => {
    /* 410 Unregistered é a Apple afirmando que o token nao existe mais (app
       desinstalado). É o único motivo honesto para apagar. */
    expect(fonte).toContain("function apnsTokenMorto(status: number): boolean");
    expect(fonte).toContain("return status === 410;");
  });

  test("BadDeviceToken NÃO conta como token morto", () => {
    /* Este é o teste que existe por causa de um defeito real: BadDeviceToken
       quase nunca quer dizer "token inválido", quer dizer "outro ambiente". A
       versão anterior apagava a linha — e no dia da subida para o TestFlight
       isso apagaria o token de TODAS as pacientes de uma vez, em silêncio.
       A função que decide morte não pode nem mencionar o erro de ambiente. */
    const corpoMorto = fonte
      .slice(fonte.indexOf("function apnsTokenMorto"), fonte.indexOf("function apnsAmbienteErrado"))
      /* Sem comentários: o bloco seguinte EXPLICA o defeito e cita
         `BadDeviceToken` — citar na explicação não pode reprovar o teste. */
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(corpoMorto).not.toMatch(/BadDeviceToken/);
    expect(corpoMorto).not.toMatch(/DeviceTokenNotForTopic/);
  });

  test("ambiente errado vira SEGUNDA TENTATIVA no outro host", () => {
    expect(fonte).toContain("apnsAmbienteErrado(status, resposta)) outroAmbiente.push(token)");
    /* E a segunda tentativa acontece de verdade, no host oposto. */
    expect(fonte).toContain(
      "const segundo = primeiro === APNS_PRODUCAO ? APNS_SANDBOX : APNS_PRODUCAO",
    );
    expect(fonte).toContain("enviarApnsNoHost(segundo, a.outroAmbiente");
  });

  test("quem falha nos DOIS ambientes conta como falha, mas não é apagado", () => {
    /* Um token que erra os dois lados é um mistério — e apagar mistério é
       perder o aparelho da paciente sem saber por quê. */
    expect(fonte).toContain("failed: a.failed + b.failed + b.outroAmbiente.length");
    expect(fonte).toContain("mortos: [...a.mortos, ...b.mortos]");
  });

  test("404 do Google é app desinstalado", () => {
    const fonte = readFileSync("src/lib/push-nativo.server.ts", "utf8");
    expect(fonte).toContain("res.status === 404");
  });
});

describe("o caminho nativo não pode ser engolido pelo gate do VAPID", () => {
  test("`sendPushToUser` tenta o nativo ANTES de olhar o VAPID", () => {
    /* Era o defeito mais provável desta integração: um servidor com APNs
       configurado e VAPID não devolveria "0 enviados" sem nunca ter tentado. */
    const fonte = readFileSync("src/lib/push.server.ts", "utf8");
    const nativo = fonte.indexOf("const nativo = await enviarNativo(userId, payload);");
    const gate = fonte.indexOf("if (!pushConfigured()) return nativo;");
    expect(nativo).toBeGreaterThan(0);
    expect(nativo).toBeLessThan(gate);
  });

  test("o total somado inclui o nativo", () => {
    const fonte = readFileSync("src/lib/push.server.ts", "utf8");
    expect(fonte).toContain("sent: sent + nativo.sent");
    expect(fonte).toContain("failed: failed + nativo.failed");
  });
});

describe("o AppDelegate do iOS repassa o token", () => {
  test("as duas funções de registro existem", () => {
    /* Sem elas o `register()` roda sem erro e o evento `registration` nunca
       chega: o app espera o prazo inteiro e conclui "sem token". */
    const fonte = readFileSync("ios/App/App/AppDelegate.swift", "utf8");
    expect(fonte).toContain("didRegisterForRemoteNotificationsWithDeviceToken");
    expect(fonte).toContain("capacitorDidRegisterForRemoteNotifications");
    expect(fonte).toContain("didFailToRegisterForRemoteNotificationsWithError");
  });
});
