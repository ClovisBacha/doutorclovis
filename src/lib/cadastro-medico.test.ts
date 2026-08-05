/**
 * O cadastro do médico não pode cobrar duas vezes o mesmo trabalho.
 *
 * Relato real: o médico preencheu o perfil, voltou ao cadastro numa aba
 * privada e teve que digitar tudo de novo. O formulário só sabia recuperar o
 * rascunho do `localStorage` — que é do aparelho e do navegador — e nunca
 * perguntava ao servidor o que já estava salvo.
 *
 * O incômodo era a menor parte. Na volta, o `upsert` grava o que veio da tela:
 * campo em branco na segunda passada APAGAVA o valor bom que estava no banco.
 * E `education` é sempre remontado a partir das categorias, então um formulário
 * que abre com as categorias vazias zera a formação inteira sem nunca ter
 * mostrado o que havia ali.
 *
 * Estes testes prendem os três caminhos.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { montarFormacoes, separarFormacoes, CATEGORIAS_FORMACAO } from "./medico-opcoes";

function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// A formação sobrevive à ida e à volta
// ─────────────────────────────────────────────────────────────────────────────

describe("formação: o que entra é o que volta", () => {
  const preenchido = {
    graduacao: "UFMG, 2010",
    residencia: "Ginecologia e Obstetrícia — Hospital das Clínicas UFMG",
    titulo: "TEGO — FEBRASGO/AMB, RQE 12345",
    mestrado: "Medicina Fetal — USP",
  };

  test("ida e volta preservam cada categoria", () => {
    /* Se a volta perder uma categoria, o próximo envio a apaga do banco —
       porque `education` é remontado só do que está na tela. */
    const { valores } = separarFormacoes(montarFormacoes(preenchido));
    for (const [chave, v] of Object.entries(preenchido)) {
      expect(valores[chave]).toBe(v);
    }
  });

  test("o texto final é idêntico depois de dar a volta", () => {
    const texto = montarFormacoes(preenchido);
    const { valores } = separarFormacoes(texto);
    expect(montarFormacoes(valores)).toBe(texto);
  });

  test("perfil antigo, escrito à mão, não é descartado", () => {
    /* O que existe hoje foi digitado sem categoria nenhuma. Sumir com isso
       seria apagar o currículo de quem se cadastrou antes das categorias. */
    const { valores, livre } = separarFormacoes("Fiz medicina na federal e residência no HC");
    expect(Object.keys(valores)).toHaveLength(0);
    expect(livre).toContain("federal");
  });

  test("texto vazio não inventa categoria", () => {
    expect(separarFormacoes("").valores).toEqual({});
    expect(separarFormacoes(null).livre).toBe("");
  });

  test("toda categoria tem prefixo reconhecível na volta", () => {
    /* Uma categoria cujo prefixo não casa consigo mesma vira dado órfão: sai
       no texto e não volta para campo nenhum. */
    for (const c of CATEGORIAS_FORMACAO) {
      const { valores } = separarFormacoes(montarFormacoes({ [c.chave]: "teste" }));
      expect(valores[c.chave]).toBe("teste");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// O formulário lê o servidor, não só o aparelho
// ─────────────────────────────────────────────────────────────────────────────

describe("o formulário abre preenchido com o que já está salvo", () => {
  const tela = codigoDe("src/routes/medicos_.cadastro.tsx");

  test("busca o perfil do servidor quando ele existe e não está ativo", () => {
    /* Sem esta linha, a única fonte é o rascunho do `localStorage` — e em aba
       privada, noutro aparelho ou depois de limpar o histórico ele não
       existe. Foi exatamente assim que o cadastro foi redigitado. */
    expect(tela).toContain("if (me.ok && me.doctor) preencherDoServidor(me.doctor)");
  });

  test("médico ATIVO continua indo direto para o painel", () => {
    /* O preenchimento não pode ter trocado o atalho de quem já está pronto. */
    expect(tela).toMatch(/me\.doctor\?\.active[\s\S]{0,80}navigate\(\{ to: "\/painel" \}\)/);
  });

  test("a formação volta pelo caminho de volta, e não em branco", () => {
    expect(tela).toContain("separarFormacoes(texto(d.education))");
  });

  test("o preenchimento nunca passa por cima do que está na tela", () => {
    /* O rascunho é carregado antes (é síncrono; a busca é de rede). O que ele
       digitou agora vale mais que a versão salva — sobrescrever seria trocar o
       recente pelo antigo no meio da edição. */
    expect(tela).toContain("if (!texto((n as any)[k]).trim() && texto(d[k]).trim())");
    expect(tela).toContain("if (!crmUf && !crmNumero &&");
    expect(tela).toContain("if (!valorTexto)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Branco não apaga o que estava bom
// ─────────────────────────────────────────────────────────────────────────────

describe("reenviar o formulário não zera o perfil", () => {
  const servidor = codigoDe("src/lib/doctors.functions.ts");

  test("campo em branco de perfil EXISTENTE é descartado, não gravado", () => {
    /* `title`, `specialty`, `crm`, `whatsapp` e `pix_key` têm `.default("")` no
       schema: quando o formulário não os manda, chegam VAZIOS, não ausentes —
       e o `stripUndefined` não distingue os dois. */
    expect(servidor).toContain("COM_PADRAO_VAZIO");
    expect(servidor).toMatch(/if \(existing\)[\s\S]{0,200}delete profile\[k\]/);
  });

  test("os cinco campos com padrão vazio estão todos cobertos", () => {
    const lista = servidor.match(/COM_PADRAO_VAZIO = \[([^\]]*)\]/)?.[1] ?? "";
    for (const campo of ["title", "specialty", "crm", "whatsapp", "pix_key"]) {
      expect(lista).toContain(`"${campo}"`);
    }
  });

  test("no cadastro NOVO o vazio continua passando pela validação", () => {
    /* A limpeza é só para perfil existente. Num cadastro novo, apagar o vazio
       faria a linha nascer sem CRM e sem ninguém reclamar. */
    expect(servidor).toMatch(/if \(existing\) \{\s*for \(const k of COM_PADRAO_VAZIO\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// O trial saiu
// ─────────────────────────────────────────────────────────────────────────────

describe("médico novo não nasce mais em trial", () => {
  const servidor = codigoDe("src/lib/doctors.functions.ts");

  test("entra em `free`, sem prazo de expiração", () => {
    /* O trial dava as capacidades de Pro — incluindo o Segundo Cérebro — sem
       cartão nenhum. Cada conversa dessas é chamada de modelo que a
       plataforma paga. */
    expect(servidor).toContain('plan: "free"');
    expect(servidor).not.toContain('plan: "trial"');
    expect(servidor).not.toContain("14 * 86400000");
  });

  test("médico que JÁ existe não tem o plano mexido no cadastro", () => {
    /* Pode ser um assinante pago só atualizando o perfil — rebaixá-lo para
       `free` aqui tiraria o que ele está pagando. */
    expect(servidor).toMatch(/camposDeEntrada = existing\s*\?\s*\{\}/);
  });

  test("quem já está em trial continua expirando pela regra antiga", () => {
    /* Tirar o trial dos novos não pode deixar os antigos presos nele para
       sempre — nem cortá-los antes do prazo prometido. */
    const ent = codigoDe("src/lib/entitlements.server.ts");
    expect(ent).toContain('data.plan === "trial"');
    expect(ent).toContain('plan = "free"');
  });
});

describe("nenhuma tela promete 14 dias grátis", () => {
  /* Uma promessa que sobra numa tela é pior que nenhuma: o médico assina
     esperando o teste que não existe mais. */
  const TELAS = [
    "src/routes/medicos.tsx",
    "src/routes/medicos_.cadastro.tsx",
    "src/routes/auth.tsx",
    "src/routes/_authenticated/painel.tsx",
    "src/lib/doctors.functions.ts",
  ];

  test("nem em texto visível, nem em meta, nem em e-mail", () => {
    for (const arquivo of TELAS) {
      const fonte = readFileSync(arquivo, "utf8");
      /* Sem comentários: eles EXPLICAM por que o trial saiu, e vão citar o
         prazo antigo para o próximo leitor entender. */
      const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
      expect({ arquivo, tem: /14 dias grátis|grátis por 14|trial de 14/.test(codigo) }).toEqual({
        arquivo,
        tem: false,
      });
    }
  });
});
