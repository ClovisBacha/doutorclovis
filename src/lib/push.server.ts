/**
 * Envio de Web Push (lado do servidor) — implementação nativa, sem dependência.
 *
 * Usa só `node:crypto` para: (1) criptografar o payload com aes128gcm conforme
 * RFC 8291 + RFC 8188 e (2) assinar o token VAPID (ES256, RFC 8292). Assim não
 * precisamos da lib `web-push` (que o ambiente offline não consegue instalar).
 *
 * Requer as env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * Sem elas, `sendPushToUser` vira no-op (0 enviados) — nada quebra.
 *
 * Inscrições mortas (404/410) são removidas automaticamente.
 */

import crypto from "node:crypto";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
};

function b64uToBuf(s: string): Buffer {
  return Buffer.from(s, "base64url");
}
function bufToB64u(b: Buffer): string {
  return b.toString("base64url");
}

function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, len: number): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len));
}

/**
 * Criptografa `plaintext` para o destinatário (chave pública + auth da
 * inscrição), devolvendo o corpo aes128gcm pronto (header + ciphertext).
 */
function encryptPayload(plaintext: Buffer, uaPublic: Buffer, authSecret: Buffer): Buffer {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65 bytes, não comprimido
  const sharedSecret = ecdh.computeSecret(uaPublic);

  // RFC 8291: ikm = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0"||ua||as)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);

  const salt = crypto.randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);

  // Registro único: plaintext || 0x02 (delimitador do último registro).
  const record = Buffer.concat([plaintext, Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(record), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Header aes128gcm (RFC 8188): salt(16) || rs(4) || idlen(1) || keyid(as 65)
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const idlen = Buffer.from([asPublic.length]);
  return Buffer.concat([salt, rs, idlen, asPublic, encrypted, tag]);
}

/** Token VAPID (JWT ES256) para o header Authorization. */
function vapidToken(audience: string, subject: string, pub: string, priv: string): string {
  const header = bufToB64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = bufToB64u(Buffer.from(JSON.stringify({ aud: audience, exp, sub: subject })));
  const signingInput = `${header}.${payload}`;

  // Reconstrói a chave privada EC a partir do escalar (priv) + ponto (pub).
  const pubBuf = b64uToBuf(pub); // 65 bytes: 0x04 || x(32) || y(32)
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: priv,
    x: bufToB64u(pubBuf.subarray(1, 33)),
    y: bufToB64u(pubBuf.subarray(33, 65)),
  };
  const keyObject = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: keyObject,
    dsaEncoding: "ieee-p1363", // r||s cru (64 bytes), como o JWS exige
  });
  return `${signingInput}.${bufToB64u(signature)}`;
}

let vapidCache: { pub: string; priv: string; subject: string } | null | undefined;

function vapidKeys() {
  if (vapidCache !== undefined) return vapidCache;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:bachaclovis@gmail.com";
  vapidCache = pub && priv ? { pub, priv, subject } : null;
  return vapidCache;
}

/** Diz se o Web Push está configurado no servidor (chaves VAPID presentes). */
export function pushConfigured(): boolean {
  return vapidKeys() !== null;
}

/** Há chaves de APNs ou FCM? Carregado sob demanda para o bundle não crescer. */
async function temPushNativo(): Promise<boolean> {
  try {
    const { pushNativoConfigurado } = await import("./push-nativo.server");
    return pushNativoConfigurado();
  } catch {
    return false;
  }
}

/** Entrega pelo aparelho. Nunca lança — um aviso não derruba o fluxo. */
async function enviarNativo(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  try {
    const { enviarPushNativo } = await import("./push-nativo.server");
    return await enviarPushNativo(userId, payload);
  } catch {
    return { sent: 0, failed: 0 };
  }
}

type SubRow = { endpoint: string; p256dh: string; auth_key: string };

async function sendOne(sub: SubRow, payload: Buffer): Promise<number> {
  const keys = vapidKeys();
  if (!keys) return 0;
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = vapidToken(audience, keys.subject, keys.pub, keys.priv);
  const body = encryptPayload(payload, b64uToBuf(sub.p256dh), b64uToBuf(sub.auth_key));

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      TTL: "86400",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${keys.pub}`,
    },
    body: body as unknown as BodyInit,
  });
  return res.status;
}

/**
 * Envia push para uma paciente identificada por e-mail (resolve o user_id pela
 * RPC `get_user_id_by_email`). Best-effort: engole qualquer erro e nunca lança —
 * seguro pra chamar no meio de um fluxo (confirmação de consulta etc.).
 */
export async function sendPushToEmail(email: string, payload: PushPayload): Promise<void> {
  /* `pushConfigured()` fala só do VAPID. Testar aqui excluiria o push NATIVO,
     que tem chaves próprias — e daria o pior resultado possível: um servidor
     com APNs configurado e VAPID não, que devolve "0 enviados" sem nunca ter
     tentado. Quem decide se há para onde enviar é `sendPushToUser`. */
  if (!pushConfigured() && !(await temPushNativo())) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: uid } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
      p_email: email.toLowerCase(),
    });
    if (!uid) return;
    await sendPushToUser(uid as string, payload);
  } catch {
    /* best-effort */
  }
}

/**
 * Envia uma notificação para todas as inscrições de um usuário. Retorna quantas
 * foram entregues/falharam. Poda inscrições que o navegador descartou (404/410).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  /* Duas rotas para a mesma pergunta: o navegador (Web Push, aqui) e o aparelho
     (APNs/FCM, em `push-nativo.server.ts`). A mesma pessoa pode ter as duas — o
     site no computador e o app no celular — e as duas têm chaves próprias.
     Somar em vez de escolher é o que faz "avise esta pessoa" continuar
     significando a mesma coisa nos quatro pontos do servidor que chamam isto. */
  const nativo = await enviarNativo(userId, payload);
  if (!pushConfigured()) return nativo;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subs } = await (supabaseAdmin as any)
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", userId);
  const rows = (subs ?? []) as SubRow[];
  if (!rows.length) return nativo;

  const bodyBytes = Buffer.from(JSON.stringify(payload));
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (s) => {
      try {
        const status = await sendOne(s, bodyBytes);
        if (status >= 200 && status < 300) sent++;
        else {
          failed++;
          if (status === 404 || status === 410) dead.push(s.endpoint);
        }
      } catch {
        failed++;
      }
    }),
  );

  if (dead.length) {
    const { error } = await (supabaseAdmin as any)
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .in("endpoint", dead);
    /* Faxina: inscrição que o navegador já descartou. Não apagar não perde
       nenhuma notificação — só faz `failed` subir para sempre, e é justamente
       esse número que diria se o push está saudável. */
    if (error) console.error("[push] inscrições mortas não foram apagadas", userId, error);
  }

  return { sent: sent + nativo.sent, failed: failed + nativo.failed };
}
