/**
 * DoctorThink — servidor standalone. Node HTTP puro (roda em bun ou node).
 * Rotas:
 *   GET  /health           → status
 *   POST /v1/ask           → bloco de contexto do cérebro do profissional
 *   POST /v1/train         → adiciona conhecimento (Q&A)
 * Auth: header Authorization: Bearer dtk_...  (ou X-API-Key).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runBrainQuery } from "./orchestrator";
import { createBrainStore } from "./store";
import { authApiKey } from "./auth";
import { DEFAULT_LABELS } from "./labels";
import { db } from "./db";

function json(res: ServerResponse, status: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1_000_000) req.destroy(); // cap 1MB
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

/** Metering (fire-and-forget): uma linha por chamada. */
function logUsage(
  tenantId: string,
  doctorId: string | null,
  endpoint: "ask" | "train",
  hadCoverage?: boolean,
): void {
  db.from("doctorthink_usage")
    .insert({
      tenant_id: tenantId,
      doctor_id: doctorId,
      endpoint,
      had_coverage: hadCoverage ?? null,
    })
    .then(
      () => {},
      () => {},
    );
}

const store = createBrainStore();

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "doctorthink" });
    }
    if (req.method !== "POST") return json(res, 404, { error: "not_found" });

    const authHeader =
      (req.headers["authorization"] as string) || (req.headers["x-api-key"] as string) || null;
    const auth = await authApiKey(authHeader);
    if (!auth) return json(res, 401, { error: "unauthorized" });

    const body = await readJson(req);
    if (!body) return json(res, 400, { error: "json_invalido" });

    if (url.pathname === "/v1/ask") {
      const message = typeof body.message === "string" ? body.message : "";
      if (!message) return json(res, 400, { error: "message é obrigatório" });
      const doctorId = auth.doctorId ?? (typeof body.doctorId === "string" ? body.doctorId : null);
      if (!doctorId) return json(res, 400, { error: "doctorId é obrigatório" });
      if (auth.doctorId && body.doctorId && body.doctorId !== auth.doctorId) {
        return json(res, 403, { error: "forbidden: chave trancada a outro profissional" });
      }
      const ch = body.channel;
      const channel = ch === "whatsapp" || ch === "teste" ? ch : "app";
      const result = await runBrainQuery(
        { tenantId: auth.tenantId, doctorId, message, channel },
        store,
        DEFAULT_LABELS,
        { maxEntriesLoaded: 200, maxEntriesScored: 6 },
      );
      logUsage(auth.tenantId, doctorId, "ask", result.hadCoverage);
      return json(res, 200, result);
    }

    if (url.pathname === "/v1/train") {
      const question = (typeof body.question === "string" ? body.question : "").trim();
      const answer = (typeof body.answer === "string" ? body.answer : "").trim();
      if (!question || !answer)
        return json(res, 400, { error: "question e answer são obrigatórios" });
      const doctorId = auth.doctorId ?? (typeof body.doctorId === "string" ? body.doctorId : null);
      if (!doctorId) return json(res, 400, { error: "doctorId é obrigatório" });
      if (auth.doctorId && body.doctorId && body.doctorId !== auth.doctorId) {
        return json(res, 403, { error: "forbidden: chave trancada a outro profissional" });
      }
      const row = await store.addEntry(doctorId, question, answer);
      if (!row) return json(res, 500, { error: "internal_error" });
      logUsage(auth.tenantId, doctorId, "train");
      return json(res, 200, { ok: true, id: row.id });
    }

    return json(res, 404, { error: "not_found" });
  } catch {
    return json(res, 500, { error: "internal_error" });
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`DoctorThink ouvindo em http://localhost:${port}`);
});
