/**
 * Entrega de push nativo — APNs (iPhone) e FCM (Android), sem dependência.
 *
 * Segue a mesma escolha que `push.server.ts` já tinha feito para o Web Push:
 * só `node:crypto` e `node:http2`. Não é preciosismo — é que os dois protocolos
 * são, no fundo, "assine um JWT e faça um POST", e a alternativa (o SDK do
 * Firebase) traz um cliente inteiro de RPC para isso.
 *
 * ─── O que cada lado exige ──────────────────────────────────────────────
 *
 * **APNs** — HTTP/2 obrigatório (a Apple não aceita HTTP/1.1) e um JWT ES256
 * assinado com a chave `.p8`. O token de autorização vale 1 hora e a Apple
 * RECUSA quem o renova com menos de 20 minutos de intervalo, então ele é
 * guardado em memória por 50 minutos.
 *
 * **FCM** — dois passos: a conta de serviço assina um JWT RS256, troca por um
 * `access_token` no Google, e só então envia. O access token também é guardado.
 *
 * ─── Sem chaves, silêncio ───────────────────────────────────────────────
 *
 * Igual ao VAPID: sem as variáveis de ambiente isto devolve `{sent: 0}` e nada
 * quebra. É o que permite o app rodar hoje, antes de existirem as contas de
 * desenvolvedor.
 *
 * ─── Env vars ───────────────────────────────────────────────────────────
 *
 * APNs: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (conteúdo do .p8),
 * `APNS_BUNDLE_ID` (= `br.com.obstetrica.app`), `APNS_PRODUCTION` ("1" para a
 * App Store; ausente = sandbox, que é onde roda o app instalado pelo Xcode).
 *
 * FCM: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`.
 */

import crypto from "node:crypto";

export type PushPayload = { title: string; body: string; url?: string; icon?: string };

type TokenRow = { token: string; platform: string };

function env(nome: string): string | undefined {
  const v = process.env[nome];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Chaves privadas em variável de ambiente chegam de dois jeitos: com quebras de
 * linha de verdade (colando o arquivo) ou com `\n` literal (a forma que a
 * maioria dos painéis aceita). As duas precisam funcionar — errar isto dá um
 * "chave inválida" que parece problema da chave, e não é.
 */
function chavePEM(bruta: string): string {
  return bruta.includes("\\n") ? bruta.replace(/\\n/g, "\n") : bruta;
}

function b64u(b: Buffer | string): string {
  return Buffer.from(b).toString("base64url");
}

export function apnsConfigurado(): boolean {
  return !!(
    env("APNS_KEY_ID") &&
    env("APNS_TEAM_ID") &&
    env("APNS_PRIVATE_KEY") &&
    env("APNS_BUNDLE_ID")
  );
}

export function fcmConfigurado(): boolean {
  return !!(env("FCM_PROJECT_ID") && env("FCM_CLIENT_EMAIL") && env("FCM_PRIVATE_KEY"));
}

export function pushNativoConfigurado(): boolean {
  return apnsConfigurado() || fcmConfigurado();
}

/* ── APNs ────────────────────────────────────────────────────────────────── */

let apnsJwt: { valor: string; ate: number } | null = null;

/**
 * O JWT da Apple, guardado por 50 minutos.
 *
 * Os dois limites vêm da Apple e apertam dos dois lados: o token EXPIRA em 1
 * hora, e renovar com menos de 20 minutos de intervalo é recusado com 403
 * `TooManyProviderTokenUpdates`. Cinquenta minutos fica com folga nos dois.
 */
function tokenApns(): string | null {
  if (!apnsConfigurado()) return null;
  const agora = Date.now();
  if (apnsJwt && apnsJwt.ate > agora) return apnsJwt.valor;
  try {
    const cabecalho = b64u(JSON.stringify({ alg: "ES256", kid: env("APNS_KEY_ID") }));
    const corpo = b64u(JSON.stringify({ iss: env("APNS_TEAM_ID"), iat: Math.floor(agora / 1000) }));
    const assinatura = crypto.sign("sha256", Buffer.from(`${cabecalho}.${corpo}`), {
      key: crypto.createPrivateKey(chavePEM(env("APNS_PRIVATE_KEY")!)),
      dsaEncoding: "ieee-p1363",
    });
    const jwt = `${cabecalho}.${corpo}.${b64u(assinatura)}`;
    apnsJwt = { valor: jwt, ate: agora + 50 * 60_000 };
    return jwt;
  } catch {
    return null;
  }
}

const APNS_PRODUCAO = "https://api.push.apple.com";
const APNS_SANDBOX = "https://api.sandbox.push.apple.com";

/**
 * O aparelho sumiu de vez? Só o 410 diz isso.
 *
 * `410 Unregistered` é a Apple afirmando que aquele token não existe mais — app
 * desinstalado. É o único motivo para apagar a linha.
 */
function apnsTokenMorto(status: number): boolean {
  return status === 410;
}

/**
 * O token é de OUTRO ambiente?
 *
 * `400 BadDeviceToken` quase nunca quer dizer "token inválido": quer dizer
 * "este token não é deste ambiente". E um app cruza três ambientes na vida:
 *
 *   instalado pelo Xcode   → sandbox
 *   TestFlight             → PRODUÇÃO
 *   App Store              → produção
 *
 * A primeira versão disto tratava `BadDeviceToken` como token morto e APAGAVA a
 * linha. O resultado seria descoberto no pior dia possível: ao subir para o
 * TestFlight, todo iPhone cadastrado responderia 400 e o servidor apagaria os
 * tokens de todas as pacientes de uma vez. O push morreria em silêncio e cada
 * uma teria que reativar na mão — o que quase ninguém faz, porque ninguém
 * percebe que parou.
 *
 * Então aqui isso vira uma SEGUNDA TENTATIVA no outro ambiente, e o
 * `APNS_PRODUCTION` deixa de ser uma configuração que, errada, quebra tudo
 * calado: ele passa a ser só a ordem em que se tenta.
 */
function apnsAmbienteErrado(status: number, corpo: string): boolean {
  return status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(corpo);
}

type SaidaApns = { sent: number; failed: number; mortos: string[]; outroAmbiente: string[] };

function enviarApnsNoHost(
  host: string,
  tokens: string[],
  corpo: string,
  jwt: string,
  http2: typeof import("node:http2"),
): Promise<SaidaApns> {
  return new Promise((resolve) => {
    const cliente = http2.connect(host);
    let sent = 0;
    let failed = 0;
    const mortos: string[] = [];
    const outroAmbiente: string[] = [];
    let restantes = tokens.length;

    /* Uma conexão HTTP/2 para todos os aparelhos — é o ponto do protocolo aqui,
       e a Apple penaliza quem abre uma conexão por mensagem. */
    const terminar = () => {
      cliente.close();
      resolve({ sent, failed, mortos, outroAmbiente });
    };
    cliente.on("error", () => {
      failed += restantes;
      restantes = 0;
      resolve({ sent, failed, mortos, outroAmbiente });
    });

    for (const token of tokens) {
      const req = cliente.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": env("APNS_BUNDLE_ID")!,
        "apns-push-type": "alert",
        /* Prioridade 10 = entregar agora. É um SOS que pode estar do outro
           lado; economizar bateria não é a preocupação certa aqui. */
        "apns-priority": "10",
        "content-type": "application/json",
      });
      let status = 0;
      let resposta = "";
      req.on("response", (h) => {
        status = Number(h[":status"] ?? 0);
      });
      req.setEncoding("utf8");
      req.on("data", (d: string) => {
        resposta += d;
      });
      const fecha = () => {
        if (status >= 200 && status < 300) sent++;
        else if (apnsAmbienteErrado(status, resposta)) outroAmbiente.push(token);
        else {
          failed++;
          if (apnsTokenMorto(status)) mortos.push(token);
        }
        if (--restantes === 0) terminar();
      };
      req.on("end", fecha);
      req.on("error", () => {
        failed++;
        if (--restantes === 0) terminar();
      });
      req.end(corpo);
    }
  });
}

async function enviarApns(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; mortos: string[] }> {
  const jwt = tokenApns();
  if (!jwt || !tokens.length) return { sent: 0, failed: 0, mortos: [] };
  const http2 = await import("node:http2");

  /* `APNS_PRODUCTION` diz por onde COMEÇAR, não onde é permitido entregar. */
  const primeiro = env("APNS_PRODUCTION") ? APNS_PRODUCAO : APNS_SANDBOX;
  const segundo = primeiro === APNS_PRODUCAO ? APNS_SANDBOX : APNS_PRODUCAO;

  const corpo = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      "mutable-content": 1,
    },
    url: payload.url,
  });

  const a = await enviarApnsNoHost(primeiro, tokens, corpo, jwt, http2);
  if (!a.outroAmbiente.length) {
    return { sent: a.sent, failed: a.failed, mortos: a.mortos };
  }

  /* Segunda tentativa, só com os que recusaram por ambiente. Quem cair de novo
     conta como falha — e ainda assim NÃO é apagado: um token que erra os dois
     ambientes é um mistério, e apagar mistério é perder o aparelho da paciente
     sem saber por quê. */
  const b = await enviarApnsNoHost(segundo, a.outroAmbiente, corpo, jwt, http2);
  return {
    sent: a.sent + b.sent,
    failed: a.failed + b.failed + b.outroAmbiente.length,
    mortos: [...a.mortos, ...b.mortos],
  };
}

/* ── FCM ─────────────────────────────────────────────────────────────────── */

let fcmToken: { valor: string; ate: number } | null = null;

async function tokenFcm(): Promise<string | null> {
  if (!fcmConfigurado()) return null;
  const agora = Date.now();
  if (fcmToken && fcmToken.ate > agora) return fcmToken.valor;
  try {
    const iat = Math.floor(agora / 1000);
    const cabecalho = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const corpo = b64u(
      JSON.stringify({
        iss: env("FCM_CLIENT_EMAIL"),
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat,
        exp: iat + 3600,
      }),
    );
    const assinatura = crypto.sign(
      "sha256",
      Buffer.from(`${cabecalho}.${corpo}`),
      crypto.createPrivateKey(chavePEM(env("FCM_PRIVATE_KEY")!)),
    );
    const jwt = `${cabecalho}.${corpo}.${b64u(assinatura)}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    /* Um minuto a menos que o prazo informado: o relógio do servidor e o do
       Google não são o mesmo, e um token que expira no voo vira 401. */
    fcmToken = { valor: j.access_token, ate: agora + ((j.expires_in ?? 3600) - 60) * 1000 };
    return j.access_token;
  } catch {
    return null;
  }
}

async function enviarFcm(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; mortos: string[] }> {
  const acesso = await tokenFcm();
  if (!acesso || !tokens.length) return { sent: 0, failed: 0, mortos: [] };
  const url = `https://fcm.googleapis.com/v1/projects/${env("FCM_PROJECT_ID")}/messages:send`;

  let sent = 0;
  let failed = 0;
  const mortos: string[] = [];

  /* A API v1 do FCM não tem envio em lote: é uma requisição por aparelho.
     `Promise.all` porque o SOS não pode esperar uma fila. */
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${acesso}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              /* `data` do FCM só aceita string. O `url` é o que o app usa para
                 abrir a tela certa ao tocar no aviso. */
              data: payload.url ? { url: payload.url } : undefined,
              android: { priority: "high" },
            },
          }),
        });
        if (res.ok) {
          sent++;
          return;
        }
        failed++;
        /* 404 = UNREGISTERED (o app foi desinstalado). 400 costuma ser token
           malformado. Nos dois casos a linha não serve mais. */
        if (res.status === 404 || res.status === 400) mortos.push(token);
      } catch {
        failed++;
      }
    }),
  );

  return { sent, failed, mortos };
}

/* ── A porta de entrada ──────────────────────────────────────────────────── */

/**
 * Envia para todos os aparelhos nativos de um usuário e poda os tokens mortos.
 *
 * Nunca lança: é chamada no meio de fluxos que não podem falhar por causa de um
 * aviso (confirmar consulta, registrar SOS).
 */
export async function enviarPushNativo(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!pushNativoConfigurado()) return { sent: 0, failed: 0 };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("native_push_tokens")
      .select("token, platform")
      .eq("user_id", userId);
    const linhas = (data ?? []) as TokenRow[];
    if (!linhas.length) return { sent: 0, failed: 0 };

    const ios = linhas.filter((l) => l.platform === "ios").map((l) => l.token);
    const android = linhas.filter((l) => l.platform !== "ios").map((l) => l.token);

    const [a, f] = await Promise.all([enviarApns(ios, payload), enviarFcm(android, payload)]);

    const mortos = [...a.mortos, ...f.mortos];
    if (mortos.length) {
      await (supabaseAdmin as any).from("native_push_tokens").delete().in("token", mortos);
    }
    return { sent: a.sent + f.sent, failed: a.failed + f.failed };
  } catch {
    return { sent: 0, failed: 0 };
  }
}
