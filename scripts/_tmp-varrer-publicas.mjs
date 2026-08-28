import { chromium } from "playwright";
import { existsSync } from "node:fs";
const base = "http://127.0.0.1:8081";
const ROTAS = [
  "/",
  "/auth",
  "/auth#access_token=x&type=recovery",
  "/agendamento",
  "/sobre",
  "/gestacao",
  "/batimentos",
  "/dpp",
  "/calculadora",
  "/hospitais",
  "/lives",
  "/mural",
  "/depoimentos",
  "/mitos",
  "/bastidores",
  "/primeira-consulta",
  "/tamanho-real",
  "/cards",
  "/modo-acompanhante",
  "/acompanhante",
  "/medicos",
  "/medicos/cadastro",
  "/encontrar-medico",
  "/empresas",
  "/epds",
  "/diabetes-gestacional",
  "/experiencia",
  "/influenciadora",
  "/privacidade",
  "/termos",
  "/p/ABCDEFG",
  "/pub/ABCDEFGHIJ",
  "/album/tok",
  "/presente/tok",
  "/acompanhar/tok",
  "/votar-nome/tok",
];
const IGNORAR = /cert|ERR_CERT|favicon|net::ERR_ABORTED|status of 429|Failed to load resource/i;
const cam = "/opt/pw-browsers/chromium";
const b = await chromium.launch({
  ...(existsSync(cam) ? { executablePath: cam } : {}),
  args: ["--no-proxy-server"],
});
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, ignoreHTTPSErrors: true });
async function abrir(r) {
  const p = await ctx.newPage();
  const e = [];
  p.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !IGNORAR.test(m.text()))
      e.push(m.type() + ": " + m.text().slice(0, 300));
  });
  p.on("pageerror", (x) => e.push("PAGEERROR: " + String(x).slice(0, 300)));
  try {
    await p.goto(base + r, { waitUntil: "networkidle", timeout: 30000 });
    await p.waitForTimeout(2000);
  } catch (x) {
    e.push("NAV: " + String(x).slice(0, 120));
  }
  await p.close();
  return e;
}
for (const r of ROTAS) {
  const e = await abrir(r);
  const hid = e.filter((x) =>
    /hydrat|did not match|Maximum update|server rendered|Text content/i.test(x),
  );
  if (hid.length) {
    console.log("❌ HIDRATACAO " + r);
    hid.slice(0, 2).forEach((x) => console.log("    " + x));
  } else if (e.length) {
    console.log("·  " + r + "  (" + e.length + " outros)");
    e.slice(0, 1).forEach((x) => console.log("    " + x));
  } else console.log("ok " + r);
}
await b.close();
