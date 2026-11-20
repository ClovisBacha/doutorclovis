import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { ASSINATURA_NO_APP } from "~/config";
import { decidirPortao, RECURSOS, type Recurso } from "~/lib/assinatura/plano";
import { VERSAO_DOS_TERMOS } from "~/lib/juridico/aceite";
import { PRIVACIDADE } from "~/lib/juridico/privacidade";
import { TERMOS } from "~/lib/juridico/termos";

/**
 * A CATRACA DA ASSINATURA (20/11/2026) — ver `ASSINATURA_NO_APP`.
 *
 * Desligada, NADA muda para quem usa o app: as atividades abrem, nenhum
 * portão aparece, o StoreKit não é chamado, o Perfil não mostra o plano e a
 * rota `/assinatura` segue para o destino. Ligada, os Termos e a Privacidade
 * têm de dizer o que se vende.
 */

const RAIZ = join(import.meta.dir, "..", "..");
const ler = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

function arquivos(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivos(p));
    else if (/\.(tsx|ts)$/.test(nome) && !nome.endsWith(".test.ts")) fora.push(p);
  }
  return fora;
}

/** As atividades do plano completo e o recurso de cada uma. */
const PORTOES: Record<string, Recurso> = {
  "meditar.tsx": "meditar",
  "dormir.tsx": "sons",
  "mexer.tsx": "mexer",
  "bebe.tsx": "ler",
  "casal.tsx": "casal",
};

describe("a chave da assinatura", () => {
  test("nasce DESLIGADA (até o dono criar os produtos no App Store Connect)", () => {
    expect(ASSINATURA_NO_APP).toBe(false);
  });

  test.skipIf(ASSINATURA_NO_APP)("desligada, todo portão abre", () => {
    for (const recurso of Object.keys(RECURSOS) as Recurso[]) {
      expect(
        decidirPortao({
          chaveLigada: ASSINATURA_NO_APP,
          emCuidado: false,
          recurso,
          conhecido: false,
          temPlano: false,
        }),
      ).toBe("liberado");
    }
  });

  test("o portão desligado devolve a atividade sem hook nenhum", () => {
    const portao = ler("componentes", "assinatura", "portao.tsx");
    expect(portao).toContain("if (!portaoLigado()) return <>{children}</>;");
    const bancada = ler("lib", "assinatura", "bancada.ts");
    expect(bancada).toContain('ASSINATURA_NO_APP || parametroDaBancada("portao") === "1"');
  });

  test("a rota da assinatura segue para o destino com a chave desligada ou no luto", () => {
    const rota = ler("app", "assinatura.tsx");
    expect(rota).toContain("!vendaLigada() || perfil?.care_mode === true");
    expect(rota).toContain("if (semVenda) sair();");
    expect(ler("lib", "assinatura", "bancada.ts")).toContain("ASSINATURA_NO_APP || ehBancada()");
  });

  test("o vigia da App Store e o Perfil só entram com a chave ligada", () => {
    expect(ler("app", "_layout.tsx")).toContain(
      '{ASSINATURA_NO_APP && Platform.OS === "ios" ? <VigiaDoPlano /> : null}',
    );
    expect(ler("app", "perfil", "index.tsx")).toContain(
      "{ASSINATURA_NO_APP && !cuidadoDaSessao ? <SecaoDoPlano /> : null}",
    );
  });

  test("a assinatura abre sem conta (o funil vem antes do cadastro)", () => {
    expect(ler("app", "_layout.tsx")).toMatch(/const ABERTAS = new Set\(\[[^\]]*"assinatura"/);
  });
});

describe("os portões", () => {
  for (const [arquivo, recurso] of Object.entries(PORTOES)) {
    test(`${arquivo} abre pelo portão do plano (${recurso})`, () => {
      const s = ler("app", "jornada", arquivo);
      expect(s).toContain(`<PortaoDoPlano recurso="${recurso}">`);
      expect(RECURSOS[recurso].doPlano).toBe(true);
      /* O portão é o default export: todo caminho até a atividade passa por ele. */
      expect(s).toMatch(/export default function \w+\(\) \{\n {2}return \(\n {4}<PortaoDoPlano/);
    });
  }

  test("nada de socorro, documentos ou conta passa por um portão", () => {
    const livres = [
      join("app", "termos.tsx"),
      join("app", "privacidade.tsx"),
      join("app", "sos.tsx"),
      join("app", "perfil", "index.tsx"),
      join("app", "perfil", "dados.tsx"),
      join("app", "jornada", "aula.tsx"),
      join("app", "jornada", "gratidao.tsx"),
      join("app", "(abas)", "jornada.tsx"),
      join("app", "(abas)", "trilha.tsx"),
      join("app", "(abas)", "amigas.tsx"),
      join("lib", "socorro.ts"),
    ];
    for (const f of livres)
      expect({ f, portao: ler(f).includes("PortaoDoPlano") }).toEqual({ f, portao: false });
  });

  test("só as cinco atividades do plano têm portão", () => {
    const com = ["app", "componentes"]
      .flatMap((d) => arquivos(join(RAIZ, d)))
      .filter((f) => !f.includes(join("componentes", "assinatura")))
      .filter((f) => semComentarios(readFileSync(f, "utf8")).includes("<PortaoDoPlano"))
      .map((f) => relative(join(RAIZ, "app", "jornada"), f))
      .sort();
    expect(com).toEqual(Object.keys(PORTOES).sort());
  });
});

describe("ligada, os documentos dizem o que se vende", () => {
  test.skipIf(!ASSINATURA_NO_APP)(
    "os Termos falam do plano completo, da renovação e do cancelamento",
    () => {
      const termos = JSON.stringify(TERMOS);
      expect(termos).toMatch(/plano completo/i);
      expect(termos).toMatch(/renova/i);
      expect(termos).toMatch(/cancel/i);
      expect(termos).toMatch(/Apple/);
    },
  );

  test.skipIf(!ASSINATURA_NO_APP)("a Privacidade diz o que a compra pela Apple guarda", () => {
    expect(JSON.stringify(PRIVACIDADE)).toMatch(/compra|assinatura/i);
  });

  test.skipIf(!ASSINATURA_NO_APP)(
    "ligar a venda muda a versão dos Termos (todas aceitam o texto com o plano completo)",
    () => {
      /* 2026-11-20 é a versão SEM o plano completo (o texto dele só entra
         com a chave). Ligou? A versão sobe junto. */
      expect(VERSAO_DOS_TERMOS > "2026-11-20").toBe(true);
    },
  );
});

describe("desligada, os documentos não falam de venda", () => {
  test.skipIf(ASSINATURA_NO_APP)("nem os Termos nem a Privacidade citam o plano completo", () => {
    expect(JSON.stringify(TERMOS)).not.toMatch(/plano completo|assinatura|vitalício/i);
    expect(JSON.stringify(PRIVACIDADE)).not.toMatch(/plano completo|assinatura|vitalício/i);
  });
});
