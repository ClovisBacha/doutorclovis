/**
 * A localização do SOS.
 *
 * O que se protege aqui é uma falha que NÃO deixa rastro. O SOS trata "sem
 * coordenada" como "manda o aviso assim mesmo" — o que é o comportamento certo
 * numa emergência, e é exatamente o que esconde o defeito: se o aparelho nunca
 * teve permissão para responder, o médico recebe "sem localização" e ninguém
 * desconfia de nada.
 *
 * Por isso os testes cobram as DECLARAÇÕES nativas. Elas são a diferença entre
 * uma coordenada e um silêncio, e nenhuma delas aparece no código TypeScript.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("as permissões sem as quais o app não recebe coordenada", () => {
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  const plist = readFileSync("ios/App/App/Info.plist", "utf8");

  test("Android declara as duas permissões de localização", () => {
    expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
    expect(manifest).toContain("android.permission.ACCESS_COARSE_LOCATION");
  });

  test("Android declara POST_NOTIFICATIONS — sem ela o push chega e não aparece", () => {
    expect(manifest).toContain("android.permission.POST_NOTIFICATIONS");
  });

  test("iOS declara o uso da localização", () => {
    expect(plist).toContain("NSLocationWhenInUseUsageDescription");
  });

  test("o texto do iOS diz PARA QUE serve — genérico a Apple reprova", () => {
    /* A diretriz é explícita: a string tem que explicar o uso. "O app quer sua
       localização" é reprovação garantida, e o custo é uma rodada de revisão. */
    const i = plist.indexOf("NSLocationWhenInUseUsageDescription");
    const trecho = plist.slice(i, i + 400);
    expect(trecho).toContain("SOS");
    expect(trecho.length).toBeGreaterThan(120);
  });

  test("NÃO pede localização 'sempre' — seria seguir a gestante o dia inteiro", () => {
    /* O SOS é disparado por ela tocando num botão: o app está na frente.
       Permissão "sempre" exigiria justificar na revisão e guardaria um dado que
       é melhor não ter. */
    expect(plist).not.toContain("NSLocationAlwaysUsageDescription");
    expect(manifest).not.toContain("ACCESS_BACKGROUND_LOCATION");
  });
});

describe("a espera do SOS tem teto, mesmo quando a plataforma não responde", () => {
  const fonte = readFileSync("src/lib/localizacao.ts", "utf8");

  test("há uma corrida com prazo além do timeout da plataforma", () => {
    /* O `timeout` do plugin depende de o SISTEMA responder — e um sistema que
       não responde é justamente o caso contra o qual se está protegendo. Sem
       este prazo próprio, o botão trava em "Localizando e avisando…" para
       sempre e a emergência não sai. */
    expect(fonte).toContain("Promise.race");
    expect(fonte).toMatch(/op\.timeout \+ \d+/);
  });

  test("nunca lança: os dois caminhos devolvem null em vez de erro", () => {
    expect(fonte).not.toMatch(/\bthrow\b/);
    expect(fonte).toContain("resolve(null)");
  });
});

describe("o SOS não fala mais com a API da web direto", () => {
  const sos = readFileSync("src/components/emergency-sheet.tsx", "utf8");
  /* Sem comentários: o código EXPLICA por que não usa a API da web, e citá-la
     na explicação não pode reprovar o teste. */
  const codigo = sos.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  test("nenhum `navigator.geolocation` sobrou na folha de emergência", () => {
    /* Era o ponto exato do defeito: a chamada da web não pede permissão
       nenhuma ao sistema, e dentro da casca isso é um erro silencioso. */
    expect(codigo).not.toContain("navigator.geolocation");
    expect(codigo).not.toContain("navigator?.geolocation");
  });

  test("usa o intermediário nos dois momentos — ao abrir e ao disparar", () => {
    expect(sos.match(/localizacaoAgora\(/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
