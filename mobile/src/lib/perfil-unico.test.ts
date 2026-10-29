import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";

/**
 * UM PERFIL SÓ (fase 3, a rede social no centro).
 *
 * Antes eram dois "meu perfil": o Perfil (dados, SOS, conta) e o "Meu perfil"
 * da Comunidade (foto, bio, @) — e o MESMO nome (`display_name`) se gravava
 * pelos dois, com regras diferentes (lá obrigatório e sem ofensa; aqui, nada).
 * Esta catraca cobra que a divisão não volte: o Perfil em `/perfil`, a cara
 * social em `/perfil/editar`, os dados em `/perfil/dados`, o nome gravado só
 * pelo servidor da rede, e a foto dela no topo das abas levando ao Perfil.
 */

const RAIZ = join(import.meta.dir, "..");

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
const fonte = (arquivo: string) => FONTES.find((f) => f.arquivo === arquivo)!.codigo;

describe("um perfil só", () => {
  test("o antigo 'Meu perfil' da Comunidade só redireciona, e ninguém leva até ele", () => {
    const eu = fonte(join("app", "comunidade", "eu.tsx"));
    expect(eu).toContain('<Redirect href="/perfil" />');
    expect(eu).not.toContain("salvarPerfilSocial");
    const quem = FONTES.filter((f) => /["'`]\/comunidade\/eu["'`?]/.test(f.codigo)).map(
      (f) => f.arquivo,
    );
    expect(quem).toEqual([]);
  });

  test("o nome dela se grava só por Editar perfil (as regras da Comunidade)", () => {
    const dados = fonte(join("app", "perfil", "dados.tsx"));
    expect(dados).not.toContain("display_name");
    const editar = fonte(join("app", "perfil", "editar.tsx"));
    expect(editar).toContain("api.salvarPerfilSocial({");
    expect(editar).toContain("ehOfensivo(nome)");
    /* Fora do ritual (o primeiro nome, no cadastro), nenhuma tela grava o nome direto. */
    const gravamONome = FONTES.filter(
      (f) =>
        /\bdisplay_name\s*(?::|=(?!=))/.test(f.codigo) &&
        /gravarPerfil|\.from\(\s*["']patient_profiles["']\s*\)/.test(f.codigo),
    ).map((f) => f.arquivo);
    expect(gravamONome).toEqual([join("app", "ritual.tsx")]);
  });

  test("a foto dela no topo das quatro abas leva ao Perfil", () => {
    const botao = fonte(join("componentes", "botao-do-perfil.tsx"));
    expect(botao).toContain('router.push(rota("/perfil")');
    for (const aba of ["jornada", "comunidade", "amigas", "inicio"])
      expect([aba, fonte(join("app", "(abas)", `${aba}.tsx`)).includes("<BotaoDoPerfil")]).toEqual([
        aba,
        true,
      ]);
  });

  test("o SOS e o nascimento levam aos dados (contato, médico, data), não ao topo do Perfil", () => {
    expect(fonte("app/sos.tsx")).not.toMatch(/["'`]\/perfil["'`]/);
    expect(fonte("app/sos.tsx")).toContain('"/perfil/dados"');
    expect(fonte(join("app", "jornada", "nascimento.tsx"))).toContain('"/perfil/dados"');
  });

  test("o espelho só vale sobre o próprio perfil", () => {
    const tela = fonte(join("app", "comunidade", "perfil", "[id].tsx"));
    expect(tela).toMatch(/sessao\?\.user\.id === alvoId \? comoAgora : null/);
    expect(tela).toContain('"trancado"');
  });

  test("sair da conta esquece o perfil e os selos da memória", () => {
    const hub = fonte(join("app", "perfil", "index.tsx"));
    expect(hub).toContain("esquecerMeuPerfilSocial()");
    expect(hub).toContain("zerarSelos()");
    expect(hub).toContain("limparRastrosLocais()");
  });
});
