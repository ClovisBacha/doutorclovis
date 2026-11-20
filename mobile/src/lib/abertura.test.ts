import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * A ABERTURA E A CASCA (18/11/2026, "o app está travado" e "ainda parece
 * IA"). Rosa, creme e índigo em menos de um segundo, com um spinner embaixo da
 * ilha do iPhone, era a sequência de um site carregando. Esta catraca segura:
 * - a splash da cor do céu da noite, com a bolha feliz, e o mesmo chão na
 *   porta e por trás de tudo (`app.json`);
 * - o ícone sem o quadrado desenhado dentro, sem alfa (a App Store recusa);
 * - a splash que espera o app (sem `useFonts` nem `return null` na raiz);
 * - as telas que são tarefa subindo de baixo, os documentos em folha e
 *   abertos sem conta, e as telas de baixo da pilha congeladas;
 * - o peso morto fora do pacote (a Nunito, o expo-video).
 */

const MOBILE = join(import.meta.dir, "..", "..");
const SRC = join(MOBILE, "src");
const ler = (...p: string[]) => readFileSync(join(...p), "utf8");
const codigo = (...p: string[]) => semComentarios(ler(...p));

const APP = JSON.parse(ler(MOBILE, "app.json")).expo;
const SPLASH = APP.plugins.find(
  (p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen",
)[1] as { image: string; backgroundColor: string };
const NOITE = /noite: \{[\s\S]*?chao: "(#[0-9a-f]{6})"/.exec(
  codigo(SRC, "componentes", "ceu-vivo.tsx"),
)![1]!;

describe("a abertura", () => {
  test("a splash é o céu da noite com a bolha, e o fundo do app também", () => {
    expect(NOITE).toBe("#2a1f9a");
    expect(SPLASH.backgroundColor.toLowerCase()).toBe(NOITE);
    expect(APP.backgroundColor.toLowerCase()).toBe(NOITE);
    expect(SPLASH.image).toBe("./assets/abertura.png");
    expect(existsSync(join(MOBILE, "assets", "abertura.png"))).toBe(true);
    /* O modelo do Expo (a grade com círculos) não volta. */
    expect(existsSync(join(MOBILE, "assets", "splash-icon.png"))).toBe(false);
    /* A porta, enquanto decide, fica no mesmo céu, centrada e fora da ilha. */
    const porta = codigo(SRC, "app", "index.tsx");
    expect(porta).toMatch(/backgroundColor: CEUS\.noite\.chao/);
    expect(porta).toMatch(/<SafeAreaView[\s\S]*?justifyContent: "center"/);
    expect(porta).not.toMatch(/<Carregando/);
  });

  test("o ícone enche o quadrado, 1024×1024 e sem alfa", () => {
    const png = readFileSync(join(MOBILE, "assets", "icon.png"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1024, 1024]);
    /* Tipo de cor 2 = RGB (6 seria RGBA). */
    expect(png[25]).toBe(2);
    expect(APP.icon).toBe("./assets/icon.png");
  });

  test("a splash espera a sessão e o perfil, com teto, e some num fade", () => {
    const raiz = codigo(SRC, "app", "_layout.tsx");
    expect(raiz).not.toMatch(/useFonts|Nunito|return null;\s*\n\s*return \(/);
    expect(raiz).toMatch(
      /SplashScreen\.setOptions\(\{ fade: true, duration: 250 \}\);\s*void SplashScreen\.hideAsync\(\)/,
    );
    expect(raiz.match(/hideAsync/g)).toHaveLength(1);
    expect(raiz).toMatch(/const TETO_DA_SPLASH_MS = 2500;/);
    expect(raiz).toMatch(/const conhecida = !carregandoSessao && \(!sessao \|\| confirmado\);/);
    /* O perfil guardado no aparelho é apagado ao sair (prefixo `dc-`). */
    expect(codigo(SRC, "lib", "sessao.tsx")).toMatch(/`dc-perfil:\$\{uid\}`/);
  });

  test("a pilha fala iOS: tarefa sobe de baixo, documento em folha, e o resto congela", () => {
    const raiz = codigo(SRC, "app", "_layout.tsx");
    expect(raiz).toMatch(/<Stack\s+screenOptions=\{\{[^<]*freezeOnBlur: true/);
    expect(raiz).toMatch(
      /name="jornada\/aula"\s+options=\{\{ presentation: "fullScreenModal", gestureEnabled: false \}\}/,
    );
    for (const a of ["mexer", "meditar", "bebe", "gratidao", "casal", "dormir"])
      expect(raiz).toContain(`<Stack.Screen name="jornada/${a}" options={ATIVIDADE} />`);
    expect(raiz).toMatch(/presentation: "fullScreenModal", animation: "slide_from_bottom"/);
    for (const doc of ["termos", "privacidade", "agenda/marcar", "sos"])
      expect(raiz).toContain(`<Stack.Screen name="${doc}" options={{ presentation: "modal" }} />`);
    expect(raiz).toMatch(/name="perfil\/editar"[\s\S]*?presentation: "formSheet"/);
    for (const corte of ["(abas)", "aceite", "ritual"])
      expect(raiz).toContain(`<Stack.Screen name="${corte}" options={{ animation: "fade" }} />`);
    /* O dia e a semana continuam empurrados: o dia é o céu (`vidro-e-luz`). */
    expect(raiz).not.toMatch(/name="jornada\/(dia|semana)"/);
  });

  test("os Termos e a Privacidade abrem sem conta (o cadastro pede que ela os leia)", () => {
    const raiz = codigo(SRC, "app", "_layout.tsx");
    const abertas = /const ABERTAS = new Set\(\[([^\]]*)\]\)/.exec(raiz)![1]!;
    expect(abertas).toContain('"termos"');
    expect(abertas).toContain('"privacidade"');
    expect(abertas).toContain('"(entrada)"');
  });

  test("o peso morto saiu do pacote: a Nunito e o expo-video", () => {
    const pacote = JSON.parse(ler(MOBILE, "package.json"));
    expect(Object.keys(pacote.dependencies)).not.toContain("@expo-google-fonts/nunito");
    expect(Object.keys(pacote.dependencies)).not.toContain("expo-video");
    expect(JSON.stringify(APP.plugins)).not.toContain("expo-video");
  });

  test("a loja só acorda as telas quando algo mudou", () => {
    const loja = codigo(SRC, "lib", "jornada", "loja.ts");
    expect(loja).toMatch(
      /function definir\(parcial: Partial<EstadoDaLoja>\) \{\s*const campos = [^\n]*\n\s*if \(campos\.every\(\(k\) => estado\[k\] === parcial\[k\]\)\) return;/,
    );
  });
});
