/**
 * A CASCA iOS, NOS ARQUIVOS QUE COMPILAM SEM MAC.
 *
 * Nada aqui roda num iPhone — o que este arquivo trava é o que dá para provar
 * em texto: a tela offline ALCANÇÁVEL e com saída, o Info.plist dizendo o que o
 * app é (retrato, iPhone, claro, pt-BR, sem criptografia própria), e a URL de
 * volta da tela offline igual à porta da casca.
 *
 * ⚠️ O que continua só no aparelho: o diálogo de permissão de localização com o
 * texto novo, e a tela offline de fato aparecendo em modo avião.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const CONFIG = readFileSync("capacitor.config.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const CASCA = readFileSync("native/shell/index.html", "utf8").replace(/<!--[\s\S]*?-->/g, "");
const PLIST = readFileSync("ios/App/App/Info.plist", "utf8").replace(/<!--[\s\S]*?-->/g, "");
const PROJETO = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");

describe("⚠️ a tela offline é alcançável, e tem saída", () => {
  test("`server.errorPath` aponta para a casca", () => {
    expect(CONFIG).toMatch(/errorPath:\s*"index\.html"/);
    expect(CONFIG).toMatch(/webDir:\s*"native\/shell"/);
  });

  test("a casca tem botão de tentar de novo e volta sozinha quando a rede retorna", () => {
    expect(CASCA).toContain('<button id="tentar"');
    expect(CASCA).toContain('addEventListener("online", tentarDeNovo)');
    expect(CASCA).toContain("window.location.replace(SERVIDOR)");
  });

  test("⚠️ navegação atropelada COM rede volta para a tela anterior, não para o login", () => {
    /* O Capacitor carrega a casca em QUALQUER falha de navegação, inclusive a
       cancelada por outra (-999). Com histórico atrás, voltar devolve a tela
       em que ela estava; só sem histórico é queda de rede de verdade. */
    expect(CASCA).toContain("window.history.length > 1");
    expect(CASCA).toContain("window.history.back()");
    expect(CASCA).toContain("navigator.onLine && window.history.length > 1");
  });

  test("⚠️ e volta para a MESMA porta da casca — a página é estática e não lê a config", () => {
    const daConfig = CONFIG.match(/url:\s*"([^"]+)"/)?.[1];
    const daCasca = CASCA.match(/var SERVIDOR = "([^"]+)"/)?.[1];
    expect(daConfig).toBeTruthy();
    expect(daCasca).toBe(daConfig);
  });

  test("a casca continua sem `tel:` além do 192 e sem rede nenhuma exigida", () => {
    expect(CASCA.match(/href="tel:[^"]+"/g)).toEqual(['href="tel:192"']);
    expect(CASCA).not.toMatch(/<script[^>]+src=/);
  });
});

describe("o Info.plist diz o que o app é", () => {
  const valor = (chave: string) =>
    PLIST.match(
      new RegExp(`<key>${chave}</key>\\s*<(string|true|false|array)[^>]*>([\\s\\S]*?)(</\\1>|$)`),
    );

  test("só retrato, e sem bloco de iPad", () => {
    const m = PLIST.match(
      /<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/,
    );
    expect(m?.[1].match(/<string>/g)).toHaveLength(1);
    expect(m?.[1]).toContain("UIInterfaceOrientationPortrait");
    expect(PLIST).not.toContain("UISupportedInterfaceOrientations~ipad");
  });

  test("só iPhone no projeto — o iPad mostraria o site de mesa dentro da casca", () => {
    expect(PROJETO).not.toContain('TARGETED_DEVICE_FAMILY = "1,2"');
    expect(PROJETO.match(/TARGETED_DEVICE_FAMILY = 1;/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("aparência clara declarada, enquanto não houver tema escuro", () => {
    expect(PLIST).toMatch(/<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/);
  });

  test("sem criptografia própria, dito de uma vez", () => {
    expect(PLIST).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });

  test("português do Brasil como região e idioma", () => {
    expect(PLIST).toMatch(/<key>CFBundleDevelopmentRegion<\/key>\s*<string>pt-BR<\/string>/);
    expect(PLIST).toMatch(/<key>CFBundleLocalizations<\/key>\s*<array>\s*<string>pt-BR<\/string>/);
  });

  test("o WhatsApp pode ser consultado pelo SOS", () => {
    expect(PLIST).toMatch(
      /<key>LSApplicationQueriesSchemes<\/key>\s*<array>\s*<string>whatsapp<\/string>/,
    );
  });

  test("⚠️ a frase da localização fala do CÉU e do SOS — os dois usos que o app faz", () => {
    const m = valor("NSLocationWhenInUseUsageDescription");
    expect(m?.[2]).toMatch(/céu|tempo/);
    expect(m?.[2]).toContain("SOS");
  });

  test("o plist continua bem formado", () => {
    const abre = (PLIST.match(/<key>/g) ?? []).length;
    const fecha = (PLIST.match(/<\/key>/g) ?? []).length;
    expect(abre).toBe(fecha);
    expect(PLIST).not.toContain("armv7");
  });
});
