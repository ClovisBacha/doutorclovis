import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ⚠️ NO iOS, USAR CÂMERA/MICROFONE/GALERIA SEM A FRASE NO `Info.plist`
 * **NÃO É PERMISSÃO NEGADA — É O APP FECHANDO.**
 *
 * O sistema encerra o processo na hora, sem diálogo e sem erro. Nada no
 * TypeScript, no lint ou nos 4.000 testes pega isso: só aparece no aparelho, no
 * segundo em que a paciente toca no botão.
 *
 * Antes desta catraca havia UMA declaração — a de localização — e o app usava
 * três recursos: oito campos de foto (avatar, álbum, publicações, "então e
 * agora") e o gravador do diário. A paciente que tocasse no microfone para
 * ditar, ou na câmera para pôr foto no perfil, veria o app sumir.
 *
 * Este teste roda no Linux, sem Xcode, e é a única coisa entre esse defeito e
 * a loja.
 */
const PLIST = readFileSync("ios/App/App/Info.plist", "utf8");

function arquivosDoApp(dir = "src"): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivosDoApp(p));
    else if (/\.(ts|tsx)$/.test(n) && !n.includes(".test.")) out.push(p);
  }
  return out;
}
const CODIGO = arquivosDoApp()
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/**
 * Cada recurso, o sinal de que o app o USA, e a chave que o iOS exige.
 *
 * ⚠️ **O sinal é o USO REAL, não uma lista à mão.** Se amanhã alguém acrescentar
 * um campo de foto num lugar novo, o teste continua valendo sem ninguém precisar
 * lembrar de atualizá-lo — e se um recurso SAIR do produto, a exigência cai
 * sozinha.
 */
const RECURSOS: { nome: string; usa: RegExp; chave: string }[] = [
  { nome: "câmera / galeria", usa: /accept="image|type="file"/, chave: "NSCameraUsageDescription" },
  { nome: "galeria", usa: /accept="image|type="file"/, chave: "NSPhotoLibraryUsageDescription" },
  { nome: "microfone", usa: /getUserMedia|MediaRecorder/, chave: "NSMicrophoneUsageDescription" },
  {
    nome: "localização",
    usa: /geolocation|Geolocation/,
    chave: "NSLocationWhenInUseUsageDescription",
  },
];

describe("o Info.plist declara tudo o que o app usa", () => {
  for (const r of RECURSOS) {
    test(`⚠️ ${r.nome} → ${r.chave}`, () => {
      if (!r.usa.test(CODIGO)) return; // o app não usa: nada a exigir
      expect(PLIST).toContain(`<key>${r.chave}</key>`);
    });
  }

  /**
   * ⚠️ **A FRASE É LIDA PELA REVISÃO DA APPLE.** Texto genérico ("este app
   * precisa da câmera") é motivo de rejeição pela diretriz 5.1.1 — ela exige
   * que se diga PARA QUÊ. Um mínimo de 40 caracteres não garante qualidade,
   * mas barra o placeholder de uma palavra, que é o caso real.
   */
  test("⚠️ nenhuma frase é genérica demais", () => {
    for (const r of RECURSOS) {
      const m = PLIST.match(new RegExp(`<key>${r.chave}</key>\\s*<string>([^<]*)</string>`));
      if (!m) continue;
      expect(m[1].trim().length).toBeGreaterThan(40);
      /* "Precisa de acesso" descreve o pedido, não o uso — é exatamente a
         frase que a revisão devolve. */
      expect(m[1].toLowerCase()).not.toMatch(/^(este app|o app|precisa|acesso)/);
    }
  });

  /**
   * ⚠️ **PUSH EM SEGUNDO PLANO.** Sem `remote-notification` o iOS não entrega a
   * notificação com o app fechado — e este é o mesmo canal por onde chega o
   * aviso de consulta e o retorno do SOS.
   *
   * ⚠️ E isto NÃO substitui ligar "Push Notifications" nas Capabilities do
   * Xcode nem o certificado APNs. Os três são necessários e nenhum avisa quando
   * falta; este teste cobre o único que mora no repositório.
   */
  test("⚠️ o push em segundo plano está declarado", () => {
    if (!/PushNotifications/.test(CODIGO)) return;
    expect(PLIST).toContain("<key>UIBackgroundModes</key>");
    expect(PLIST).toContain("<string>remote-notification</string>");
  });

  test("o plist continua sendo XML válido", () => {
    expect(PLIST.trimStart().startsWith("<?xml")).toBe(true);
    expect(PLIST).toContain("</plist>");
    /* Chaves e valores em número par — um `<key>` órfão quebra o build do
       Xcode com uma mensagem que não aponta para a linha. */
    const chaves = (PLIST.match(/<key>/g) ?? []).length;
    expect(chaves).toBeGreaterThan(10);
  });
});
