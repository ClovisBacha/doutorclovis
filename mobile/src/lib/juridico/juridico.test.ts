import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { CONTATO_EMAIL } from "~/config";
import { DATA_DOS_TERMOS } from "~/lib/juridico/aceite";
import {
  paraHtml,
  paraMarkdown,
  paraSuporte,
  type DocumentoJuridico,
} from "~/lib/juridico/documento";
import { PRIVACIDADE } from "~/lib/juridico/privacidade";
import { TERMOS } from "~/lib/juridico/termos";
import { PONTOS_DO_ACEITE, TEXTO_DO_CONSENTIMENTO_DE_SAUDE } from "~/lib/juridico/textos-do-aceite";

/**
 * OS TERMOS E A PRIVACIDADE DO APP (fase 4). Um texto só, em três formas — a
 * tela do app, o Markdown para revisão e a página para hospedar —, o aceite por
 * versão na porta do app, e as regras do app (21/10/2026) valendo também aqui.
 */

const RAIZ = join(import.meta.dir, "..", "..");
const DOCS = join(RAIZ, "..", "..", "docs", "juridico");

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
const fonte = (a: string) => FONTES.find((f) => f.arquivo === a)!.codigo;

const textoDe = (doc: DocumentoJuridico) =>
  [
    doc.titulo,
    doc.resumo,
    ...doc.secoes.flatMap((s) => [
      s.titulo,
      ...s.blocos.flatMap((b) => (typeof b === "string" ? [b] : b.lista)),
    ]),
  ].join("\n");

/** O texto visível de uma página (o formatador mexe nas quebras, nunca no texto). */
const textoDaPagina = (html: string) =>
  html
    .slice(html.indexOf("<main>"), html.indexOf("</main>"))
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

describe("os documentos do app", () => {
  test("as cópias de docs/juridico estão em dia com o texto do app (rode scripts/gerar-juridico.ts)", () => {
    for (const [nome, doc] of [
      ["termos", TERMOS],
      ["privacidade", PRIVACIDADE],
    ] as const) {
      const md = readFileSync(join(DOCS, `${nome}.md`), "utf8");
      expect([nome, md.replace(/\s+/g, " ").trim()]).toEqual([
        nome,
        paraMarkdown(doc, DATA_DOS_TERMOS, CONTATO_EMAIL).replace(/\s+/g, " ").trim(),
      ]);
      const html = readFileSync(join(DOCS, `${nome}.html`), "utf8");
      expect([nome, textoDaPagina(html)]).toEqual([
        nome,
        textoDaPagina(paraHtml(doc, DATA_DOS_TERMOS, CONTATO_EMAIL)),
      ]);
    }
    const suporte = readFileSync(join(DOCS, "index.html"), "utf8");
    expect(textoDaPagina(suporte)).toEqual(
      textoDaPagina(paraSuporte(DATA_DOS_TERMOS, CONTATO_EMAIL)),
    );
  });

  test("a página de suporte (a URL de suporte da loja) leva a um contato e aos documentos", () => {
    const html = paraSuporte(DATA_DOS_TERMOS, CONTATO_EMAIL);
    const texto = textoDaPagina(html);
    expect(html).toContain(`href="mailto:${CONTATO_EMAIL}"`);
    expect(html).toContain('href="termos.html"');
    expect(html).toContain('href="privacidade.html"');
    expect(texto).toContain("não dá orientação médica");
    expect(texto).toContain("ligue 192");
    expect(texto).toContain("Perfil → Excluir minha conta");
    expect(texto).toContain("Perfil → Baixar uma cópia dos meus dados");
    expect(texto).not.toMatch(/sangramento|febre|perda de líquido|\btome\b|\bevite\b/i);
    /* E cada documento volta para o suporte e para o outro documento. */
    for (const doc of [TERMOS, PRIVACIDADE]) {
      const pagina = paraHtml(doc, DATA_DOS_TERMOS, CONTATO_EMAIL);
      for (const destino of ["index.html", "termos.html", "privacidade.html"])
        expect(pagina).toContain(`href="${destino}"`);
    }
  });

  test("nenhum documento dá orientação médica nem lista sinal de alerta (sinal mora no SOS)", () => {
    for (const doc of [TERMOS, PRIVACIDADE]) {
      const t = textoDe(doc);
      expect(t).not.toMatch(
        /sangramento|febre|perda de líquido|falta de ar|mexendo menos|pré-eclâmpsia|contração forte/i,
      );
      expect(t).not.toMatch(/\btome\b|\bevite\b|procure o seu médico se|em caso de dor/i);
    }
    expect(textoDe(TERMOS)).toContain("não dá orientação médica");
    expect(textoDe(TERMOS)).toContain("192");
  });

  test("nada do produto antigo: teleconsulta, médico assinante, pagamento, assistente com IA", () => {
    for (const doc of [TERMOS, PRIVACIDADE]) {
      expect(textoDe(doc)).not.toMatch(
        /teleconsulta|assinante|Stripe|Google Agenda|Meet|chatbot|assistente|Gemini/i,
      );
    }
  });

  test("o dado de saúde é exatamente o que o app guarda, e tem consentimento próprio", () => {
    for (const parte of [
      "cartão do SOS",
      "datação da gestação",
      "nascimento",
      "movimentos do bebê",
    ]) {
      expect(TEXTO_DO_CONSENTIMENTO_DE_SAUDE).toContain(parte);
      expect(textoDe(PRIVACIDADE)).toContain(parte);
    }
    expect(textoDe(PRIVACIDADE)).toContain("art. 11, I");
    expect(textoDe(PRIVACIDADE)).toMatch(
      /não pede peso, altura, pressão, glicemia, exames, sintomas/,
    );
    expect(PONTOS_DO_ACEITE.join(" ")).toContain("não dá orientação médica");
  });

  test("o que a Privacidade promete, o app faz (o inventário do build 43)", () => {
    const privacidade = textoDe(PRIVACIDADE);
    /* A localização é só "durante o uso". Com a chave "sempre" no Info.plist,
       o expo-location pede "sempre" até no pedido comum
       (`EXLocationPermissionRequester.m`: `isConfiguredForAlwaysAuthorization`
       → `requestAlwaysAuthorization`) — então ela fica fora, e isto desfaz a
       decisão de 06/10 (o diário, "29/10 — a localização 'sempre'"). E o app
       nunca pede localização em segundo plano. */
    const app = JSON.parse(readFileSync(join(RAIZ, "..", "app.json"), "utf8"));
    const local = app.expo.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === "expo-location",
    )[1];
    expect(local.locationAlwaysPermission).toBe(false);
    expect(local.locationAlwaysAndWhenInUsePermission).toBe(false);
    expect(typeof local.locationWhenInUsePermission).toBe("string");
    expect(
      FONTES.filter((f) =>
        /requestBackgroundPermissionsAsync|startLocationUpdatesAsync|startGeofencingAsync/.test(
          f.codigo,
        ),
      ).map((f) => f.arquivo),
    ).toEqual([]);
    expect(privacidade).toContain("só enquanto o app está aberto");
    /* A cópia dos dados existe onde o texto diz. */
    expect(privacidade).toContain("Perfil → Baixar uma cópia dos meus dados");
    expect(fonte(join("app", "perfil", "index.tsx"))).toContain("Baixar uma cópia dos meus dados");
    expect(fonte(join("app", "perfil", "index.tsx"))).toContain("exportarMeusDados(");
    /* O cartão do SOS vai para a conta: a tela não pode dizer que fica só no celular. */
    expect(fonte(join("app", "perfil", "dados.tsx"))).not.toMatch(/Fica guardado no celular/);
    /* As amigas veem o nome do bebê: o texto e a chave do perfil dizem isso. */
    expect(privacidade).toMatch(/para as amigas, o seu nome, o nome do bebê/);
    expect(fonte(join("app", "perfil", "editar.tsx"))).toContain(
      "As suas amigas veem o nome do bebê de qualquer jeito",
    );
    /* O SOS manda o aviso mesmo sem localização, e por mais de um canal. */
    for (const doc of [TERMOS, PRIVACIDADE]) {
      expect(textoDe(doc)).toMatch(/se você permitir/);
      expect(textoDe(doc)).toMatch(/WhatsApp ou SMS/);
    }
  });
});

describe("o aceite na porta do app", () => {
  test("a porta manda para o aceite quem não aceitou a versão em vigor (fora da bancada)", () => {
    const porta = fonte(join("app", "index.tsx"));
    expect(porta).toContain("precisaAceitar(sessao.user.user_metadata)");
    expect(porta).toContain('<Redirect href="/aceite" />');
    expect(porta.indexOf('href="/aceite"')).toBeLessThan(porta.indexOf('href="/ritual"'));
  });

  test("o cadastro grava a versão aceita e pede o consentimento do dado de saúde, destacado", () => {
    const cadastro = fonte(join("app", "(entrada)", "cadastro.tsx"));
    expect(cadastro).toContain("...metadadosDoAceite(new Date())");
    expect(cadastro).toContain("rotulo={TEXTO_DO_CONSENTIMENTO_DE_SAUDE}");
    expect(cadastro).toContain("destaque");
  });

  test("o aceite tem o SOS à mão, e não prende ninguém (sair e excluir)", () => {
    const aceite = fonte(join("app", "aceite.tsx"));
    expect(aceite).toContain("<PilulaSos />");
    expect(aceite).toContain("Sair da conta");
    expect(aceite).toContain("Excluir a minha conta");
  });

  test("ninguém abre mais as páginas do site para os documentos", () => {
    const quem = FONTES.filter((f) => /\$\{SITE\}\/(termos|privacidade)\b/.test(f.codigo)).map(
      (f) => f.arquivo,
    );
    expect(quem).toEqual([]);
    expect(existsSync(join(RAIZ, "app", "termos.tsx"))).toBe(true);
    expect(existsSync(join(RAIZ, "app", "privacidade.tsx"))).toBe(true);
  });
});
